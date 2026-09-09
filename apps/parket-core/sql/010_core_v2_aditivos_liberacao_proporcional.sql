-- Core v2 (task #1669) — modelo simplificado centrado em OBRA.
-- Adiciona: aditivos como mini-contrato, regra de liberação por obra,
-- motor de cotas proporcionais (a cada baixa de recebimento cliente, cria
-- lançamentos incrementais de RT/comissão proporcionais ao % pago).
--
-- Regras finais (Will 11/08):
--   IMPOSTO base   = venda total × imposto_pct (default 28%)
--   RT           = venda × (1 − imposto_pct) × rt_percentual        ← base líquida
--   COMISSÃO     = venda × comissao_percentual                       ← base cheia
--   LIBERAÇÃO    = proporcional automática ao % pago pelo cliente
--                  (regra_liberacao='proporcional' default;
--                   'threshold_50' segura tudo até cliente pagar 50%;
--                   'manual' não gera nada automático)


-- ─── OBRAS: novos campos ────────────────────────────────────────────

ALTER TABLE core.obras
  ADD COLUMN IF NOT EXISTS imposto_pct      numeric(5,2) NOT NULL DEFAULT 28.00,
  ADD COLUMN IF NOT EXISTS comissao_pct     numeric(5,2),
  ADD COLUMN IF NOT EXISTS regra_liberacao  text NOT NULL DEFAULT 'proporcional'
    CHECK (regra_liberacao IN ('proporcional','threshold_50','manual'));

-- Se rt_threshold_pct estiver zerado nos legados, seta 50 como default
UPDATE core.obras SET rt_threshold_pct = 50 WHERE rt_threshold_pct IS NULL OR rt_threshold_pct = 0;


-- ─── ADITIVOS: mini-contrato dentro da obra ─────────────────────────

CREATE TABLE IF NOT EXISTS core.obra_aditivos (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  obra_id           uuid NOT NULL REFERENCES core.obras(id) ON DELETE CASCADE,
  numero            integer NOT NULL,                    -- 1, 2, 3… por obra
  descricao         text NOT NULL,
  valor             numeric(15,2) NOT NULL,
  data              date NOT NULL DEFAULT CURRENT_DATE,
  forma_pagamento   text,
  observacoes       text,
  created_at        timestamptz NOT NULL DEFAULT now(),
  UNIQUE (obra_id, numero)
);
CREATE INDEX IF NOT EXISTS obra_aditivos_obra_idx ON core.obra_aditivos(obra_id);

ALTER TABLE core.obra_aditivos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "auth read" ON core.obra_aditivos;
CREATE POLICY "auth read" ON core.obra_aditivos FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "finance write"  ON core.obra_aditivos;
DROP POLICY IF EXISTS "finance update" ON core.obra_aditivos;
DROP POLICY IF EXISTS "admin delete"   ON core.obra_aditivos;
CREATE POLICY "finance write"  ON core.obra_aditivos FOR INSERT TO authenticated WITH CHECK (core.can_write());
CREATE POLICY "finance update" ON core.obra_aditivos FOR UPDATE TO authenticated USING (core.can_write()) WITH CHECK (core.can_write());
CREATE POLICY "admin delete"   ON core.obra_aditivos FOR DELETE TO authenticated USING (core.is_admin());
GRANT SELECT, INSERT, UPDATE, DELETE ON core.obra_aditivos TO authenticated, service_role;

-- Trigger audit (mesmo padrão do 009)
DROP TRIGGER IF EXISTS trg_audit ON core.obra_aditivos;
CREATE TRIGGER trg_audit AFTER INSERT OR UPDATE OR DELETE ON core.obra_aditivos
  FOR EACH ROW EXECUTE FUNCTION core.log_change();


-- ─── VIEW: resumo da obra (venda_total, pago, pct_pago, custos) ─────
-- É a fonte única pra tela "Obra detalhe" e pros gerenciadores de RT/Comissão.

CREATE OR REPLACE VIEW core.obra_resumo AS
SELECT
  o.id,
  o.codigo,
  o.nome,
  o.empresa_id,
  o.cliente_id,
  o.vendedor_id,
  o.arquiteto_id,
  o.status,
  o.valor_venda                                                  AS venda_contrato,
  COALESCE((SELECT SUM(valor) FROM core.obra_aditivos WHERE obra_id = o.id), 0)
                                                                 AS valor_aditivos,
  o.valor_venda + COALESCE((SELECT SUM(valor) FROM core.obra_aditivos WHERE obra_id = o.id), 0)
                                                                 AS venda_total,
  -- Entradas do cliente (previstas + pagas)
  COALESCE((SELECT SUM(valor)      FROM core.lancamentos WHERE obra_id = o.id AND tipo='entrada' AND status <> 'cancelado'), 0)
                                                                 AS entradas_previstas,
  COALESCE((SELECT SUM(COALESCE(valor_pago, valor)) FROM core.lancamentos
              WHERE obra_id = o.id AND tipo='entrada'
                AND status IN ('pago','recebido','conciliado')), 0)
                                                                 AS entradas_recebidas,
  -- % pago pelo cliente = recebido / venda_total (guard divisão por zero)
  CASE
    WHEN (o.valor_venda + COALESCE((SELECT SUM(valor) FROM core.obra_aditivos WHERE obra_id = o.id), 0)) > 0
    THEN COALESCE((SELECT SUM(COALESCE(valor_pago, valor)) FROM core.lancamentos
                     WHERE obra_id = o.id AND tipo='entrada'
                       AND status IN ('pago','recebido','conciliado')), 0)
       / (o.valor_venda + COALESCE((SELECT SUM(valor) FROM core.obra_aditivos WHERE obra_id = o.id), 0))
    ELSE 0
  END                                                            AS pct_pago,
  -- Saídas realizadas
  COALESCE((SELECT SUM(COALESCE(valor_pago, valor)) FROM core.lancamentos
              WHERE obra_id = o.id AND tipo='saida'
                AND status IN ('pago','conciliado')), 0)
                                                                 AS custo_realizado,
  -- Regras
  o.imposto_pct,
  o.comissao_pct,
  o.rt_percentual,
  o.regra_liberacao,
  o.rt_threshold_pct,
  o.data_inicio,
  o.previsao_termino
FROM core.obras o;

GRANT SELECT ON core.obra_resumo TO authenticated, anon, service_role;


-- ─── FUNÇÃO: recalcular_liberacoes(obra_id) ─────────────────────────
-- Chamada sempre que uma entrada é baixada/estornada. Estratégia:
--
-- 1) Calcula pct_pago da obra a partir da view.
-- 2) Aplica regra_liberacao:
--      'proporcional' → libera pct_pago × valor_total
--      'threshold_50' → libera 100% se pct_pago ≥ 0.5, senão 0
--      'manual'       → não mexe (operador cria manualmente)
-- 3) Soma o que JÁ foi lançado como pagamento (COM-*/RT-*) → diff = a criar
-- 4) Se diff > R$1, cria 1 lançamento novo (comissão e/ou RT) com o delta.
-- 5) Nunca deleta lançamento existente (se pct desceu por estorno, apenas
--    não cria novos — os antigos ficam pra investigar/estornar manual).
--
-- Idempotente: rodar 10 vezes seguido gera 0 novos lançamentos.

CREATE OR REPLACE FUNCTION core.recalcular_liberacoes(p_obra_id uuid)
  RETURNS TABLE(criou_comissao numeric, criou_rt numeric)
  LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  r_obra    core.obra_resumo%ROWTYPE;
  v_pct     numeric;
  v_com_total   numeric := 0;
  v_com_liberada numeric := 0;
  v_com_lancado  numeric := 0;
  v_com_delta    numeric := 0;
  v_rt_total    numeric := 0;
  v_rt_liberado numeric := 0;
  v_rt_lancado  numeric := 0;
  v_rt_delta    numeric := 0;
  v_plano_com   uuid;
  v_plano_rt    uuid;
  v_centro      uuid;
  v_empresa_id  uuid;
  v_vend_id     uuid;
  v_arq_id      uuid;
  v_criou_com   numeric := 0;
  v_criou_rt    numeric := 0;
BEGIN
  SELECT * INTO r_obra FROM core.obra_resumo WHERE id = p_obra_id;
  IF NOT FOUND OR r_obra.venda_total <= 0 THEN
    RETURN QUERY SELECT 0::numeric, 0::numeric; RETURN;
  END IF;

  v_pct := r_obra.pct_pago;
  SELECT vendedor_id, arquiteto_id, empresa_id INTO v_vend_id, v_arq_id, v_empresa_id
    FROM core.obras WHERE id = p_obra_id;

  -- Fração liberada conforme regra
  DECLARE fracao numeric;
  BEGIN
    fracao := CASE r_obra.regra_liberacao
      WHEN 'proporcional' THEN LEAST(v_pct, 1)
      WHEN 'threshold_50' THEN CASE WHEN v_pct >= (r_obra.rt_threshold_pct / 100.0) THEN 1 ELSE 0 END
      ELSE 0  -- manual
    END;

    -- COMISSÃO VENDEDOR (base venda cheia)
    IF v_vend_id IS NOT NULL AND COALESCE(r_obra.comissao_pct, 0) > 0 THEN
      v_com_total   := ROUND(r_obra.venda_total * r_obra.comissao_pct / 100.0, 2);
      v_com_liberada := ROUND(v_com_total * fracao, 2);
      SELECT COALESCE(SUM(COALESCE(valor_pago, valor)), 0) INTO v_com_lancado
        FROM core.lancamentos
       WHERE obra_id = p_obra_id AND parceiro_id = v_vend_id
         AND numero_documento LIKE 'COM-%' AND status <> 'cancelado';
      v_com_delta := v_com_liberada - v_com_lancado;
      IF v_com_delta > 1 THEN
        SELECT id INTO v_plano_com FROM core.plano_contas WHERE codigo = '3102' LIMIT 1;
        SELECT id INTO v_centro    FROM core.centros_custo WHERE codigo = '3' LIMIT 1;
        INSERT INTO core.lancamentos
          (empresa_id, centro_custo_id, obra_id, parceiro_id, plano_conta_id,
           tipo, status, descricao, numero_documento, data_emissao,
           data_competencia, data_vencimento, valor, parcela_atual, parcela_total,
           observacoes)
          VALUES (COALESCE(v_empresa_id, '11111111-1111-1111-1111-111111111111'::uuid),
                  v_centro, p_obra_id, v_vend_id, v_plano_com,
                  'saida', 'previsto',
                  'Comissão vendedor · liberação proporcional ('
                    || ROUND(fracao * 100, 1) || '% do contrato pago)',
                  'COM-' || substring(p_obra_id::text, 1, 8) || '-' || to_char(now(),'YYYYMMDDHH24MISS'),
                  CURRENT_DATE, CURRENT_DATE, CURRENT_DATE + interval '15 days',
                  v_com_delta, 1, 1,
                  'Automática (recalcular_liberacoes) — obra ' || r_obra.codigo);
        v_criou_com := v_com_delta;
      END IF;
    END IF;

    -- RT ARQUITETO (base venda × (1 − imposto_pct))
    IF v_arq_id IS NOT NULL AND COALESCE(r_obra.rt_percentual, 0) > 0 THEN
      v_rt_total   := ROUND(r_obra.venda_total * (1 - r_obra.imposto_pct / 100.0) * r_obra.rt_percentual / 100.0, 2);
      v_rt_liberado := ROUND(v_rt_total * fracao, 2);
      SELECT COALESCE(SUM(COALESCE(valor_pago, valor)), 0) INTO v_rt_lancado
        FROM core.lancamentos
       WHERE obra_id = p_obra_id AND parceiro_id = v_arq_id
         AND numero_documento LIKE 'RT-%' AND status <> 'cancelado';
      v_rt_delta := v_rt_liberado - v_rt_lancado;
      IF v_rt_delta > 1 THEN
        SELECT id INTO v_plano_rt FROM core.plano_contas WHERE codigo = '3101' LIMIT 1;
        SELECT id INTO v_centro   FROM core.centros_custo WHERE codigo = '3' LIMIT 1;
        INSERT INTO core.lancamentos
          (empresa_id, centro_custo_id, obra_id, parceiro_id, plano_conta_id,
           tipo, status, descricao, numero_documento, data_emissao,
           data_competencia, data_vencimento, valor, parcela_atual, parcela_total,
           observacoes)
          VALUES (COALESCE(v_empresa_id, '11111111-1111-1111-1111-111111111111'::uuid),
                  v_centro, p_obra_id, v_arq_id, v_plano_rt,
                  'saida', 'previsto',
                  'RT arquiteto · liberação proporcional ('
                    || ROUND(fracao * 100, 1) || '% do contrato pago) · base venda × '
                    || (100 - r_obra.imposto_pct) || '%',
                  'RT-' || substring(p_obra_id::text, 1, 8) || '-' || to_char(now(),'YYYYMMDDHH24MISS'),
                  CURRENT_DATE, CURRENT_DATE, CURRENT_DATE + interval '15 days',
                  v_rt_delta, 1, 1,
                  'Automática (recalcular_liberacoes) — obra ' || r_obra.codigo);
        v_criou_rt := v_rt_delta;
      END IF;
    END IF;
  END;

  RETURN QUERY SELECT v_criou_com, v_criou_rt;
END; $$;

GRANT EXECUTE ON FUNCTION core.recalcular_liberacoes(uuid) TO authenticated, service_role;


-- ─── TRIGGER: chama recalcular ao baixar/estornar entrada ───────────
-- Precisa acionar em UPDATE de status pra pago/recebido/conciliado (baixa) e
-- em UPDATE reverso (estorno). AFTER pra usar o status novo.

CREATE OR REPLACE FUNCTION core._trigger_recalcular_liberacoes()
  RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  obra_id_alvo uuid;
  status_antes text;
  status_depois text;
BEGIN
  IF TG_OP = 'INSERT' THEN
    obra_id_alvo := NEW.obra_id;
    status_depois := NEW.status;
    status_antes := NULL;
  ELSIF TG_OP = 'UPDATE' THEN
    obra_id_alvo := NEW.obra_id;
    status_depois := NEW.status;
    status_antes := OLD.status;
  ELSE
    obra_id_alvo := OLD.obra_id;
    status_depois := NULL;
    status_antes := OLD.status;
  END IF;

  IF obra_id_alvo IS NULL THEN RETURN NULL; END IF;

  -- Só dispara em mudança de status envolvendo baixa/estorno de ENTRADA
  IF COALESCE(NEW.tipo, OLD.tipo) <> 'entrada' THEN RETURN NULL; END IF;
  IF status_antes IS NOT DISTINCT FROM status_depois THEN RETURN NULL; END IF;

  PERFORM core.recalcular_liberacoes(obra_id_alvo);
  RETURN NULL;
END; $$;

DROP TRIGGER IF EXISTS trg_recalcular_liberacoes ON core.lancamentos;
CREATE TRIGGER trg_recalcular_liberacoes
  AFTER INSERT OR UPDATE OR DELETE ON core.lancamentos
  FOR EACH ROW EXECUTE FUNCTION core._trigger_recalcular_liberacoes();


-- Trigger idem em obra_aditivos (aditivo muda venda_total → recalcula)
CREATE OR REPLACE FUNCTION core._trigger_recalcular_aditivo()
  RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE oid uuid;
BEGIN
  oid := COALESCE(NEW.obra_id, OLD.obra_id);
  IF oid IS NOT NULL THEN PERFORM core.recalcular_liberacoes(oid); END IF;
  RETURN NULL;
END; $$;

DROP TRIGGER IF EXISTS trg_recalcular_aditivo ON core.obra_aditivos;
CREATE TRIGGER trg_recalcular_aditivo
  AFTER INSERT OR UPDATE OR DELETE ON core.obra_aditivos
  FOR EACH ROW EXECUTE FUNCTION core._trigger_recalcular_aditivo();


-- ─── Popular comissao_pct nas obras existentes a partir do parceiro ─
-- (fallback do vendedor.comissao_padrao pro campo novo da obra)
UPDATE core.obras o SET comissao_pct = p.comissao_padrao
  FROM core.parceiros p
 WHERE o.vendedor_id = p.id AND o.comissao_pct IS NULL
   AND COALESCE(p.comissao_padrao, 0) > 0;


NOTIFY pgrst, 'reload schema';
