-- ═══════════════════════════════════════════════════════════════════
-- 024 — Custos da obra sobem no painel /obras assim que aprovados
-- Will 24/08/2026
--
-- Gap:
--   1. obra_resumo.custo_realizado só somava saídas com status pago/conciliado.
--      Compra aprovada (status='previsto') NÃO aparecia. Painel mostrava R$0
--      mesmo com R$40k em compras aprovadas.
--   2. NF-e importadas via XML no compras-app viravam lançamento sem obra_id
--      (trigger compras_cp_criar_lancamento não amarrava obra) — 10 dos 12
--      lançamentos de saída estavam órfãos.
--
-- Ficha:
--   - custo_comprometido = saídas em previsto + pago (exclui cancelado)
--   - custo_realizado    = saídas pago + conciliado (definição antiga preservada)
--   - resolver_obra_por_projeto_texto(txt): match ÚNICO por nome (upper+trim);
--     ambíguo (múltiplas obras mesmo nome) → NULL (evita gastar na obra errada)
--   - trigger da NF chama o resolver e grava obra_id no lançamento
--   - backfill lançamentos NF órfãos existentes
-- ═══════════════════════════════════════════════════════════════════

-- ─── 1. Resolver por texto (NF só tem "projeto" string) ─────────────
CREATE OR REPLACE FUNCTION core.resolver_obra_por_projeto_texto(p_txt text)
RETURNS uuid
  LANGUAGE plpgsql STABLE
  SET search_path = public, core, pg_catalog AS $$
DECLARE
  v_arr uuid[] := '{}';
  v_norm text;
BEGIN
  v_norm := NULLIF(upper(btrim(COALESCE(p_txt, ''))), '');
  IF v_norm IS NULL THEN RETURN NULL; END IF;

  -- Match exato (case/trim-insensitive). Só retorna se for único: obras
  -- com mesmo nome (mesmo cliente, propostas diferentes) requerem escolha
  -- humana. Ambíguo → NULL evita creditar na obra errada.
  SELECT array_agg(id) INTO v_arr FROM (
    SELECT id FROM core.obras
     WHERE upper(btrim(nome)) = v_norm LIMIT 2) s;
  IF COALESCE(array_length(v_arr, 1), 0) = 1 THEN RETURN v_arr[1]; END IF;

  -- Fallback: código da obra (proposta) escrito no projeto texto
  SELECT array_agg(id) INTO v_arr FROM (
    SELECT id FROM core.obras
     WHERE codigo = v_norm LIMIT 2) s;
  IF COALESCE(array_length(v_arr, 1), 0) = 1 THEN RETURN v_arr[1]; END IF;

  RETURN NULL;
END $$;

GRANT EXECUTE ON FUNCTION core.resolver_obra_por_projeto_texto(text)
  TO authenticated, service_role;


-- ─── 2. Trigger da NF resolve obra_id (base = 022) ──────────────────
CREATE OR REPLACE FUNCTION public.compras_cp_criar_lancamento()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'core', 'pg_catalog'
AS $function$
DECLARE
  v_empresa uuid;
  v_pc uuid;
  v_lanc uuid;
  v_doc text;
  v_obra uuid;
  v_projeto_nota text;
BEGIN
  IF NEW.lancamento_id IS NOT NULL OR NEW.status <> 'pendente' THEN
    RETURN NEW;
  END IF;

  v_doc := NULLIF(regexp_replace(COALESCE(NEW.documento,''), '^\s*NFE?[\s.-]*', '', 'i'), '');

  SELECT id INTO v_empresa FROM core.empresas WHERE ativo ORDER BY created_at LIMIT 1;
  SELECT id INTO v_pc FROM core.plano_contas WHERE codigo = '6203' LIMIT 1;
  IF v_pc IS NULL THEN
    SELECT id INTO v_pc FROM core.plano_contas WHERE tipo = 'despesa' ORDER BY codigo LIMIT 1;
  END IF;
  IF v_empresa IS NULL OR v_pc IS NULL THEN
    RETURN NEW;
  END IF;

  -- Resolve obra: NF tem projeto texto; se a conta_pagar veio de nota,
  -- tenta o projeto da nota primeiro (mais confiável que o duplicado na parcela).
  IF NEW.nota_id IS NOT NULL THEN
    SELECT projeto INTO v_projeto_nota
      FROM public.compras_notas WHERE id = NEW.nota_id LIMIT 1;
    v_obra := core.resolver_obra_por_projeto_texto(v_projeto_nota);
  END IF;
  IF v_obra IS NULL THEN
    v_obra := core.resolver_obra_por_projeto_texto(NEW.projeto);
  END IF;

  INSERT INTO core.lancamentos
    (empresa_id, plano_conta_id, obra_id, tipo, status, descricao, numero_documento,
     data_emissao, data_competencia, data_vencimento, valor, forma_pagamento,
     parcela_atual, observacoes)
  VALUES
    (v_empresa, v_pc, v_obra, 'saida', 'previsto',
     'NF ' || COALESCE(v_doc, 's/n') || ' - ' || COALESCE(NULLIF(NEW.fornecedor,''), 'fornecedor nao informado')
       || COALESCE(' - ' || NULLIF(NEW.projeto,''), ''),
     'NF-' || COALESCE(v_doc, left(NEW.id::text, 8)) || '/' || COALESCE(NEW.parcela, 1),
     CURRENT_DATE,
     COALESCE(NEW.data_vencimento, CURRENT_DATE),
     COALESCE(NEW.data_vencimento, CURRENT_DATE),
     NEW.valor,
     NEW.forma_pagamento,
     COALESCE(NEW.parcela, 1),
     'Origem: Contas a Pagar do Compras (entrada de NF/estoque). conta_id=' || NEW.id
       || CASE WHEN v_obra IS NULL AND (v_projeto_nota IS NOT NULL OR NEW.projeto IS NOT NULL)
               THEN ' — projeto="' || COALESCE(v_projeto_nota, NEW.projeto) || '" nao resolvido (sem match unico em core.obras)'
               ELSE '' END)
  RETURNING id INTO v_lanc;

  NEW.lancamento_id := v_lanc;
  RETURN NEW;
END $function$;


-- ─── 3. obra_resumo: expõe custo_comprometido (previsto+pago) ───────
-- Realizado (pago+conciliado) fica onde estava — motor de RT/comissão usa.
CREATE OR REPLACE VIEW core.obra_resumo AS
SELECT
  o.id, o.codigo, o.nome, o.empresa_id, o.cliente_id, o.vendedor_id, o.arquiteto_id,
  o.status,
  o.valor_venda                                                  AS venda_contrato,
  COALESCE((SELECT SUM(valor) FROM core.obra_aditivos WHERE obra_id = o.id), 0)
                                                                 AS valor_aditivos,
  o.valor_venda + COALESCE((SELECT SUM(valor) FROM core.obra_aditivos WHERE obra_id = o.id), 0)
                                                                 AS venda_total,
  COALESCE((SELECT SUM(valor) FROM core.lancamentos
              WHERE obra_id = o.id AND tipo='entrada' AND status <> 'cancelado'), 0)
                                                                 AS entradas_previstas,
  COALESCE((SELECT SUM(COALESCE(valor_pago, valor)) FROM core.lancamentos
              WHERE obra_id = o.id AND tipo='entrada'
                AND status IN ('pago','recebido','conciliado')), 0)
                                                                 AS entradas_recebidas,
  CASE
    WHEN (o.valor_venda + COALESCE((SELECT SUM(valor) FROM core.obra_aditivos WHERE obra_id = o.id), 0)) > 0
    THEN COALESCE((SELECT SUM(COALESCE(valor_pago, valor)) FROM core.lancamentos
                     WHERE obra_id = o.id AND tipo='entrada'
                       AND status IN ('pago','recebido','conciliado')), 0)
       / (o.valor_venda + COALESCE((SELECT SUM(valor) FROM core.obra_aditivos WHERE obra_id = o.id), 0))
    ELSE 0
  END                                                            AS pct_pago,
  -- Realizado: só o que foi baixado (para RT/comissão continuar batendo)
  COALESCE((SELECT SUM(COALESCE(valor_pago, valor)) FROM core.lancamentos
              WHERE obra_id = o.id AND tipo='saida'
                AND status IN ('pago','conciliado')), 0)
                                                                 AS custo_realizado,
  o.imposto_pct, o.comissao_pct, o.rt_percentual, o.regra_liberacao, o.rt_threshold_pct,
  o.data_inicio, o.previsao_termino,
  -- Comprometido: previsto + pago (compra aprovada já sobe no painel).
  -- No FIM da view pra CREATE OR REPLACE não falhar por reordenação.
  COALESCE((SELECT SUM(COALESCE(valor_pago, valor)) FROM core.lancamentos
              WHERE obra_id = o.id AND tipo='saida'
                AND status IN ('previsto','pago','conciliado')), 0)
                                                                 AS custo_comprometido
FROM core.obras o;

GRANT SELECT ON core.obra_resumo TO authenticated, anon, service_role;


-- ─── 4. Backfill lançamentos NF órfãos ──────────────────────────────
UPDATE core.lancamentos l
   SET obra_id = core.resolver_obra_por_projeto_texto(
                   COALESCE(cn.projeto, ccp.projeto))
  FROM public.compras_contas_pagar ccp
  LEFT JOIN public.compras_notas cn ON cn.id = ccp.nota_id
 WHERE ccp.lancamento_id = l.id
   AND l.obra_id IS NULL
   AND core.resolver_obra_por_projeto_texto(COALESCE(cn.projeto, ccp.projeto)) IS NOT NULL;
