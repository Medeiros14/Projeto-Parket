-- ═══════════════════════════════════════════════════════════════════
-- 026 — Casamento frete/NF ↔ obra tolerante a acento, nome contido e typo
-- Will 24/08/2026
--
-- Gap: core.resolver_obra_por_projeto_texto (024) só aceitava nome
-- IDÊNTICO (upper+btrim). Dos 135 fretes sem obra, apenas 3 batiam exato
-- e os 3 eram ambíguos. Causas medidas no Cloud:
--   42  1 caminhão com vários clientes  (precisa rateio, fica manual)
--   28  nome curto, cliente tem N obras (precisa escolha humana)
--   26  cliente não existe no Core
--   17  erro de digitação
--   10  nome curto que cabe em 1 obra só  <- resolve aqui
--    8  não é obra (amostra, insumo, produção)
--    3  obras homônimas
--    1  só o acento diferente             <- resolve aqui
--
-- Ficha desta migração:
--   1. core.norm_obra_txt(txt): unaccent + upper + colapsa espaço/pontuação
--   2. resolver ganha 3 regras, TODAS exigindo obra ÚNICA (ambíguo → NULL):
--        R1 identidade normalizada
--        R2 nome do frete contido no nome da obra (>= 6 chars, sem +/,)
--        R3 similaridade trigram >= 0.70
--      Limiar 0.55 foi testado e REJEITADO: "MARIA E MEL E JULIANA" casava
--      com "MARIA E MEL" (0.58) mas é carga multi-cliente. Typo abaixo de
--      0.70 vira sugestão na tela, nunca vínculo automático.
--   3. core.sugerir_obras_por_texto(txt, lim): candidatos ranqueados pra UI
--      (a tela de fretes mostra os top-N num clique só)
--   4. wrapper public.sugerir_obras_por_texto pro PostgREST/cloudFetch
--   5. backfill: re-dispara o trigger dos fretes sem obra
--
-- Dry-run confirmado antes de aplicar: 12 fretes vinculam (1 por R1,
-- 11 por R2, 0 por R3). Nenhum vínculo existente é alterado.
-- ═══════════════════════════════════════════════════════════════════

CREATE EXTENSION IF NOT EXISTS unaccent;
CREATE EXTENSION IF NOT EXISTS pg_trgm;


-- ─── 1. Normalizador único (usado pelo resolver e pelas sugestões) ───
-- IMMUTABLE exige unaccent com dicionário qualificado; sem isso o Postgres
-- recusa a marcação (unaccent(text) é STABLE por depender de search_path).
CREATE OR REPLACE FUNCTION core.norm_obra_txt(p_txt text)
RETURNS text
  LANGUAGE sql IMMUTABLE
  SET search_path = public, core, pg_catalog AS $$
  SELECT NULLIF(
    btrim(regexp_replace(
      upper(public.unaccent('public.unaccent', btrim(COALESCE(p_txt, '')))),
      '[[:space:][:punct:]]+', ' ', 'g')),
    '');
$$;

GRANT EXECUTE ON FUNCTION core.norm_obra_txt(text) TO authenticated, service_role;


-- ─── 1b. Nome normalizado materializado ─────────────────────────────
-- Sem isso a sugestão em lote roda norm_obra_txt 870 obras × 121 fretes =
-- 105k chamadas e leva 5,8s. Coluna gerada + índice trigram sobre ela
-- derruba pra ~200ms. Se norm_obra_txt mudar, rodar:
--   ALTER TABLE core.obras ALTER COLUMN nome_norm DROP EXPRESSION;  (e recriar)
ALTER TABLE core.obras
  ADD COLUMN IF NOT EXISTS nome_norm text
  GENERATED ALWAYS AS (core.norm_obra_txt(nome)) STORED;

CREATE INDEX IF NOT EXISTS idx_obras_nome_norm_trgm
  ON core.obras USING gin (nome_norm gin_trgm_ops);


-- ─── 2. Resolver com as 3 regras ────────────────────────────────────
CREATE OR REPLACE FUNCTION core.resolver_obra_por_projeto_texto(p_txt text)
RETURNS uuid
  LANGUAGE plpgsql STABLE
  SET search_path = public, core, pg_catalog AS $$
DECLARE
  v_arr  uuid[] := '{}';
  v_norm text;
BEGIN
  v_norm := core.norm_obra_txt(p_txt);
  IF v_norm IS NULL THEN RETURN NULL; END IF;

  -- R1: identidade normalizada (acento, caixa, pontuação e espaço duplo
  -- não contam). "MIGUEL ANGÊLO" = "MIGUEL ANGELO".
  SELECT array_agg(id) INTO v_arr FROM (
    SELECT id FROM core.obras
     WHERE nome_norm = v_norm LIMIT 2) s;
  IF COALESCE(array_length(v_arr, 1), 0) = 1 THEN RETURN v_arr[1]; END IF;

  -- Código da obra (proposta) escrito no texto
  SELECT array_agg(id) INTO v_arr FROM (
    SELECT id FROM core.obras
     WHERE upper(btrim(codigo)) = v_norm LIMIT 2) s;
  IF COALESCE(array_length(v_arr, 1), 0) = 1 THEN RETURN v_arr[1]; END IF;

  -- R2: nome do frete contido no nome da obra. A obra costuma ter sufixo
  -- ("CASA FLORAIS - REINALDO MORAIS") e o frete traz só o começo.
  -- Guardas: >= 6 chars (senão "ANA" casa 53 obras) e sem separador de
  -- carga (+ / ,) — com separador é caminhão multi-cliente, não obra.
  IF length(v_norm) >= 6 AND v_norm !~ '[+/,]' THEN
    SELECT array_agg(id) INTO v_arr FROM (
      SELECT id FROM core.obras
       WHERE nome_norm LIKE '%' || v_norm || '%' LIMIT 2) s;
    IF COALESCE(array_length(v_arr, 1), 0) = 1 THEN RETURN v_arr[1]; END IF;
  END IF;

  -- R3: typo. Limiar alto de propósito; abaixo disso a chance de trocar de
  -- cliente é real e o custo cai na obra errada.
  IF length(v_norm) >= 6 AND v_norm !~ '[+/,]' THEN
    SELECT array_agg(id) INTO v_arr FROM (
      SELECT id FROM core.obras
       WHERE similarity(nome_norm, v_norm) >= 0.70 LIMIT 2) s;
    IF COALESCE(array_length(v_arr, 1), 0) = 1 THEN RETURN v_arr[1]; END IF;
  END IF;

  RETURN NULL;
END $$;

GRANT EXECUTE ON FUNCTION core.resolver_obra_por_projeto_texto(text)
  TO authenticated, service_role;


-- ─── 3. Sugestões ranqueadas pra tela ───────────────────────────────
-- O resolver devolve NULL nos casos ambíguos por segurança; a UI precisa
-- justamente desses casos pra oferecer escolha. Aqui não há corte por
-- unicidade: devolve os melhores candidatos com o motivo, e quem decide
-- é a Expedição.
-- valor_venda e status vão junto porque obras homônimas (mesmo cliente, duas
-- propostas) sairiam como duas linhas idênticas na tela: o valor é o que
-- permite a Expedição escolher a certa.
DROP FUNCTION IF EXISTS core.sugerir_obras_por_texto(text, int);
CREATE OR REPLACE FUNCTION core.sugerir_obras_por_texto(
  p_txt text,
  p_lim int DEFAULT 5
) RETURNS TABLE (obra_id uuid, codigo text, nome text, valor_venda numeric,
                 status text, score numeric, motivo text)
  LANGUAGE plpgsql STABLE
  SET search_path = public, core, pg_catalog AS $$
DECLARE
  v_norm text := core.norm_obra_txt(p_txt);
  v_tok  text;
BEGIN
  IF v_norm IS NULL THEN RETURN; END IF;

  -- Carga multi-cliente: usa o primeiro trecho antes do separador como
  -- chave de busca ("TRAJANO + GIC + INSUMOS" → "TRAJANO"). Melhor sugerir
  -- a obra do primeiro cliente do que não sugerir nada.
  v_tok := btrim(split_part(regexp_replace(v_norm, '[+/,]', '|', 'g'), '|', 1));
  IF length(COALESCE(v_tok, '')) < 4 THEN v_tok := v_norm; END IF;

  RETURN QUERY
  SELECT s.id, s.codigo, s.nome, s.valor_venda, s.status, round(s.sc, 3), s.mot
    FROM (
      SELECT o.id, o.codigo, o.nome, o.valor_venda, o.status,
             CASE
               WHEN o.nome_norm = v_norm THEN 1.00
               WHEN o.nome_norm LIKE '%' || v_norm || '%' THEN 0.95
               WHEN v_tok <> v_norm
                    AND o.nome_norm LIKE '%' || v_tok || '%' THEN 0.85
               ELSE GREATEST(
                      similarity(o.nome_norm, v_norm),
                      similarity(o.nome_norm, v_tok))
             END::numeric AS sc,
             CASE
               WHEN o.nome_norm = v_norm THEN 'nome igual'
               WHEN o.nome_norm LIKE '%' || v_norm || '%' THEN 'nome contido'
               WHEN v_tok <> v_norm
                    AND o.nome_norm LIKE '%' || v_tok || '%' THEN 'primeiro cliente da carga'
               ELSE 'parecido'
             END AS mot
        FROM core.obras o
    ) s
   WHERE s.sc >= 0.30
   ORDER BY s.sc DESC, s.valor_venda DESC NULLS LAST, s.nome
   LIMIT GREATEST(COALESCE(p_lim, 5), 1);
END $$;

GRANT EXECUTE ON FUNCTION core.sugerir_obras_por_texto(text, int)
  TO authenticated, service_role;

-- Wrapper no schema public: PostgREST/cloudFetch só enxerga public.
DROP FUNCTION IF EXISTS public.sugerir_obras_por_texto(text, int);
CREATE OR REPLACE FUNCTION public.sugerir_obras_por_texto(
  p_txt text,
  p_lim int DEFAULT 5
) RETURNS TABLE (obra_id uuid, codigo text, nome text, valor_venda numeric,
                 status text, score numeric, motivo text)
  LANGUAGE sql STABLE SECURITY DEFINER
  SET search_path = public, core, pg_catalog AS $$
  SELECT * FROM core.sugerir_obras_por_texto(p_txt, p_lim);
$$;

GRANT EXECUTE ON FUNCTION public.sugerir_obras_por_texto(text, int)
  TO anon, authenticated, service_role;


-- ─── 5. Sugestões de TODOS os fretes órfãos numa chamada ────────────
-- A tela lista ~120 fretes sem obra; uma RPC por linha seria 120 idas ao
-- banco. Aqui sai tudo de uma vez, candidatos aninhados em jsonb.
CREATE OR REPLACE FUNCTION public.sugerir_obras_fretes(p_lim int DEFAULT 4)
RETURNS TABLE (frete_id uuid, candidatos jsonb)
  LANGUAGE sql STABLE SECURITY DEFINER
  SET search_path = public, core, pg_catalog AS $$
  SELECT f.id,
         COALESCE((
           SELECT jsonb_agg(jsonb_build_object(
                    'obra_id', s.obra_id, 'nome', s.nome,
                    'valor_venda', s.valor_venda, 'score', s.score,
                    'motivo', s.motivo))
             FROM core.sugerir_obras_por_texto(f.cliente_nome, p_lim) s
         ), '[]'::jsonb)
    FROM public.expedicao_fretes f
   WHERE f.obra_id IS NULL AND COALESCE(f.status, '') <> 'cancelado';
$$;

GRANT EXECUTE ON FUNCTION public.sugerir_obras_fretes(int)
  TO anon, authenticated, service_role;


-- ─── 6. Backfill: re-dispara o trigger dos fretes órfãos ────────────
-- UPDATE trivial; o BEFORE trigger (025) chama o resolver novo e, quando
-- casa, reescreve obra_id dos 3 lançamentos do frete.
UPDATE public.expedicao_fretes SET numero = numero
 WHERE obra_id IS NULL AND COALESCE(status, '') <> 'cancelado';
