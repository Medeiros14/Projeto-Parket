-- ═══════════════════════════════════════════════════════════════════
-- 027 — Desempate de obras homônimas: única com valor de venda ganha
-- Will 26/08/2026 (auditoria E2E contrato → Core)
--
-- Gap: o resolver (024→026) devolve NULL sempre que o texto casa com
-- 2+ obras de nome idêntico. Auditoria 26/08 mediu 41 lançamentos NF
-- órfãos; 8 deles (R$3.689) eram homônimas onde UMA obra é a real e as
-- outras são shells:
--   GIC PATRIMONIAL S.A     -> real cod=6747743 venda=530k | shell cod=<uuid> venda=0
--   AMAURI DOS SANTOS       -> real cod=7235562 venda=489k | shell cod=<uuid> venda=0
--   ROCHA FAMILY RUA ALEMANHA> real cod=10952  venda=2.4M | shell cod=<uuid> venda=0
--   RENATA LEAL C. BELMONTE -> real cod=6785714 venda=930k | shell cod=PKT100416 venda=0
--
-- CUIDADO — regra por STATUS foi testada e REJEITADA: os shells têm
-- status='em_andamento' e as obras reais têm status NULL (seed). Um
-- desempate "única com status" escolheria a obra ERRADA nos 4 casos.
--
-- Ficha:
--   1. core.desempata_obras_por_venda(uuid[]): 1 candidata -> ela;
--      2+ candidatas -> se exatamente UMA tem valor_venda > 0, ela
--      (venda > 0 = obra com contrato; venda 0 + codigo uuid = shell).
--      2+ com venda (cliente com duas propostas reais, ex. MATHEUS
--      COSTANTINI ×3) -> NULL, continua exigindo escolha humana.
--   2. resolver reescrito usando o desempate em TODAS as regras
--      (R1 identidade, código, R2 contido, R3 trigram). Sem LIMIT 2:
--      agrega o grupo inteiro pra contar as vendas direito.
--   3. backfill NF: re-resolve lançamentos de saída órfãos do Compras.
--   4. backfill fretes: UPDATE trivial re-dispara o trigger da 025.
--
-- Dry-run confirmado no Cloud antes de aplicar: 8 lançamentos NF
-- vinculam (5 GIC + 1 AMAURI + 1 ROCHA FAMILY + 1 RENATA), zero
-- vínculo existente alterado, MATHEUS continua NULL.
-- ═══════════════════════════════════════════════════════════════════

-- ─── 1. Desempate por venda ─────────────────────────────────────────
CREATE OR REPLACE FUNCTION core.desempata_obras_por_venda(p_ids uuid[])
RETURNS uuid
  LANGUAGE plpgsql STABLE
  SET search_path = public, core, pg_catalog AS $$
DECLARE
  v_arr uuid[];
BEGIN
  IF COALESCE(array_length(p_ids, 1), 0) = 0 THEN RETURN NULL; END IF;
  IF array_length(p_ids, 1) = 1 THEN RETURN p_ids[1]; END IF;

  -- Entre homônimas, obra real = a que carrega valor de contrato.
  -- Shell (espelho criado por workflow) fica com valor_venda 0/NULL.
  SELECT array_agg(id) INTO v_arr
    FROM core.obras
   WHERE id = ANY(p_ids) AND COALESCE(valor_venda, 0) > 0;
  IF COALESCE(array_length(v_arr, 1), 0) = 1 THEN RETURN v_arr[1]; END IF;

  -- 0 ou 2+ com venda: ambíguo de verdade, decisão humana (UI sugere).
  RETURN NULL;
END $$;

GRANT EXECUTE ON FUNCTION core.desempata_obras_por_venda(uuid[])
  TO authenticated, service_role;


-- ─── 2. Resolver com desempate em todas as regras ───────────────────
CREATE OR REPLACE FUNCTION core.resolver_obra_por_projeto_texto(p_txt text)
RETURNS uuid
  LANGUAGE plpgsql STABLE
  SET search_path = public, core, pg_catalog AS $$
DECLARE
  v_arr  uuid[] := '{}';
  v_pick uuid;
  v_norm text;
BEGIN
  v_norm := core.norm_obra_txt(p_txt);
  IF v_norm IS NULL THEN RETURN NULL; END IF;

  -- R1: identidade normalizada (acento/caixa/pontuação não contam).
  SELECT array_agg(id) INTO v_arr FROM core.obras WHERE nome_norm = v_norm;
  v_pick := core.desempata_obras_por_venda(v_arr);
  IF v_pick IS NOT NULL THEN RETURN v_pick; END IF;

  -- Código da obra (proposta) escrito no texto.
  SELECT array_agg(id) INTO v_arr FROM core.obras
   WHERE upper(btrim(codigo)) = v_norm;
  v_pick := core.desempata_obras_por_venda(v_arr);
  IF v_pick IS NOT NULL THEN RETURN v_pick; END IF;

  -- R2: nome do texto contido no nome da obra (sufixos tipo
  -- "CASA FLORAIS - REINALDO"). Guardas da 026: >= 6 chars e sem
  -- separador de carga (+ / ,) que indica caminhão multi-cliente.
  IF length(v_norm) >= 6 AND v_norm !~ '[+/,]' THEN
    SELECT array_agg(id) INTO v_arr FROM core.obras
     WHERE nome_norm LIKE '%' || v_norm || '%';
    v_pick := core.desempata_obras_por_venda(v_arr);
    IF v_pick IS NOT NULL THEN RETURN v_pick; END IF;

    -- R3: typo (trigram >= 0.70, limiar alto de propósito — 026).
    SELECT array_agg(id) INTO v_arr FROM core.obras
     WHERE similarity(nome_norm, v_norm) >= 0.70;
    v_pick := core.desempata_obras_por_venda(v_arr);
    IF v_pick IS NOT NULL THEN RETURN v_pick; END IF;
  END IF;

  RETURN NULL;
END $$;

GRANT EXECUTE ON FUNCTION core.resolver_obra_por_projeto_texto(text)
  TO authenticated, service_role;


-- ─── 3. Backfill lançamentos NF órfãos (mesma query da 024) ─────────
UPDATE core.lancamentos l
   SET obra_id = core.resolver_obra_por_projeto_texto(
                   COALESCE(cn.projeto, ccp.projeto))
  FROM public.compras_contas_pagar ccp
  LEFT JOIN public.compras_notas cn ON cn.id = ccp.nota_id
 WHERE ccp.lancamento_id = l.id
   AND l.obra_id IS NULL
   AND core.resolver_obra_por_projeto_texto(COALESCE(cn.projeto, ccp.projeto)) IS NOT NULL;


-- ─── 4. Backfill fretes órfãos (re-dispara trigger da 025) ──────────
UPDATE public.expedicao_fretes SET numero = numero
 WHERE obra_id IS NULL AND COALESCE(status, '') <> 'cancelado';
