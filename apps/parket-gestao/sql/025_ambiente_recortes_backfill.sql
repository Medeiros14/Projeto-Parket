-- ═══════════════════════════════════════════════════════════════════
-- Backfill coluna ambiente (02/09/2026, sequência do bug Neymar:
-- "na central do cliente nao saiu do ambiente" + "isso tem que
-- ajustar pra todas essas coisas que arrumamos")
-- QUE FAZ: a coluna gestao.itens.ambiente é o que a Central do
-- Cliente (ItensContratados.tsx) e o gestão (Obras.tsx,
-- ObraAcompanhamento) exibem. A expansão de recortes da função
-- itens_hierarquicos_de_sim (sql/024) inseria sub-itens X.Y.Z com
-- ambiente NULL; a 024 foi corrigida pra herdar do item pai X.Y
-- (Will 02/09: "recortes entram como sub item do item igual sai na
-- nossa proposta"). Este script:
--   1. reaplica a função corrigida (rodar a 024 antes deste arquivo);
--   2. backfilla os recortes já expandidos herdando o ambiente do
--      pai (item is_recorte_agregado com mesmo meta.codigo do
--      parent_codigo) — 27 itens em 6 projetos na auditoria;
--   3. caso pontual ROBERTO MOREIRA BLOES: item 1.1 com sim cujo
--      descritivo começa com o ambiente ("SALA") na linha 1.
-- FORA DE ESCOPO (auditado, legítimo sem ambiente): 525 itens legado
-- de planilha (descritivo já é o ambiente, gestão faz fallback
-- it.ambiente || it.descritivo); serviços avulsos sem ambiente na
-- proposta (LITTLE ROCK, LAVVI, ROBERTO MARTIN); TESTE FLUXO E2E.
-- Idempotente: os UPDATEs só pegam ambiente IS NULL.
-- ═══════════════════════════════════════════════════════════════════
BEGIN;

-- 2. recortes expandidos herdam ambiente do item pai
UPDATE gestao.itens r
   SET ambiente = pai.ambiente
  FROM gestao.itens pai
 WHERE r.ambiente IS NULL
   AND (r.meta->>'is_recorte')::boolean IS TRUE
   AND pai.projeto_id = r.projeto_id
   AND (pai.meta->>'is_recorte_agregado')::boolean IS TRUE
   AND pai.meta->>'codigo' = COALESCE(r.meta->>'parent_codigo',
                                      substring(r.meta->>'codigo' FROM '^(\d+\.\d+)\.\d+$'))
   AND pai.ambiente IS NOT NULL;

-- 3. ROBERTO MOREIRA BLOES: ambiente = linha 1 do descritivo da sim ("SALA")
UPDATE gestao.itens i
   SET ambiente = NULLIF(TRIM(SPLIT_PART(si.descritivo, E'\n', 1)), '')
  FROM public.simulacao_itens si
 WHERE si.id = i.simulacao_item_id
   AND i.ambiente IS NULL
   AND i.projeto_id IN (SELECT id FROM gestao.projetos WHERE cliente = 'ROBERTO MOREIRA BLOES')
   AND TRIM(SPLIT_PART(si.descritivo, E'\n', 1)) = 'SALA';

-- conferência: nenhum recorte com pai identificável deve seguir sem ambiente
SELECT count(*) AS recortes_sem_ambiente
  FROM gestao.itens r
 WHERE (r.meta->>'is_recorte')::boolean IS TRUE
   AND r.ambiente IS NULL
   AND EXISTS (SELECT 1 FROM gestao.itens pai
                WHERE pai.projeto_id = r.projeto_id
                  AND (pai.meta->>'is_recorte_agregado')::boolean IS TRUE
                  AND pai.meta->>'codigo' = COALESCE(r.meta->>'parent_codigo',
                        substring(r.meta->>'codigo' FROM '^(\d+\.\d+)\.\d+$'))
                  AND pai.ambiente IS NOT NULL);

COMMIT;
