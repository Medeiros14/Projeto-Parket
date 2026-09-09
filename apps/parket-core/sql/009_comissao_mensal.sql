-- 009: Motor de comissão mensal por vendedor + RT default 10 + gate 50% na liberação
-- Regras Will 17/08/2026. Sem retroativo (corte 2026-08-18, aplicado no watcher).

BEGIN;

-- 1) Regra individual por vendedor
CREATE TABLE IF NOT EXISTS core.comissao_regras (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vendedor_id uuid NOT NULL UNIQUE REFERENCES core.parceiros(id),
  tipo        text NOT NULL CHECK (tipo IN ('faixa','fixo')),
  fixo_valor  numeric(15,2),
  ativo       boolean NOT NULL DEFAULT true,
  observacoes text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT comissao_regras_fixo_chk CHECK (tipo <> 'fixo' OR fixo_valor IS NOT NULL)
);

ALTER TABLE core.comissao_regras ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "admin write" ON core.comissao_regras;
DROP POLICY IF EXISTS "auth read" ON core.comissao_regras;
CREATE POLICY "admin write" ON core.comissao_regras TO authenticated
  USING (core.is_admin()) WITH CHECK (core.is_admin());
CREATE POLICY "auth read" ON core.comissao_regras FOR SELECT TO authenticated USING (true);

GRANT SELECT ON core.comissao_regras TO anon, teca_reader;
GRANT INSERT, SELECT, UPDATE, DELETE ON core.comissao_regras TO authenticated, service_role;

DROP TRIGGER IF EXISTS trg_audit ON core.comissao_regras;
CREATE TRIGGER trg_audit AFTER INSERT OR DELETE OR UPDATE ON core.comissao_regras
  FOR EACH ROW EXECUTE FUNCTION core.log_change();

-- 2) Faixas passam a pertencer à regra do vendedor; % único (modelo mensal)
ALTER TABLE core.comissao_faixas
  ADD COLUMN IF NOT EXISTS regra_id uuid REFERENCES core.comissao_regras(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS percentual numeric(5,2) NOT NULL DEFAULT 0;
ALTER TABLE core.comissao_faixas
  DROP COLUMN IF EXISTS percentual_sem_rt,
  DROP COLUMN IF EXISTS percentual_com_rt;
CREATE INDEX IF NOT EXISTS comissao_faixas_regra_idx ON core.comissao_faixas (regra_id);

-- 3) Comissões viram apuração mensal por vendedor
ALTER TABLE core.comissoes
  ALTER COLUMN obra_id DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS competencia date,
  ADD COLUMN IF NOT EXISTS volume_base numeric(15,2),
  ADD COLUMN IF NOT EXISTS qtd_fechamentos integer NOT NULL DEFAULT 0;
CREATE UNIQUE INDEX IF NOT EXISTS comissoes_vendedor_competencia_uq
  ON core.comissoes (vendedor_id, competencia) WHERE competencia IS NOT NULL;

-- 4) RT default 10%
ALTER TABLE core.obras ALTER COLUMN rt_percentual SET DEFAULT 10;

-- 5) Gate 50%: regra 'proporcional' só libera (proporcional ao recebido)
--    depois que o cliente passa de rt_threshold_pct (default 50) pago.
CREATE OR REPLACE FUNCTION core.recalcular_liberacoes(p_obra_id uuid)
 RETURNS TABLE(criou_comissao numeric, criou_rt numeric)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  r_obra    core.obra_resumo%ROWTYPE;
  v_pct     numeric;
  v_gate    numeric;
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

  v_pct  := r_obra.pct_pago;
  v_gate := COALESCE(r_obra.rt_threshold_pct, 50) / 100.0;
  SELECT vendedor_id, arquiteto_id, empresa_id INTO v_vend_id, v_arq_id, v_empresa_id
    FROM core.obras WHERE id = p_obra_id;

  -- Fração liberada conforme regra
  DECLARE fracao numeric;
  BEGIN
    fracao := CASE r_obra.regra_liberacao
      WHEN 'proporcional' THEN CASE WHEN v_pct > v_gate THEN LEAST(v_pct, 1) ELSE 0 END
      WHEN 'threshold_50' THEN CASE WHEN v_pct >= v_gate THEN 1 ELSE 0 END
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
END; $function$;

COMMIT;
