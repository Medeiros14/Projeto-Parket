-- ═══════════════════════════════════════════════════════════════════
-- Backfill space_card_id por nome unico (02/09/2026, Will: "no card em
-- produtos nao esta saindo os itens tambem tem que aparecer em todos
-- o que foi vendido")
-- QUE FAZ: 69 cards abertos do board seguiam com space_card_id NULL
-- (sync so vincula por trello_url do dept projetos; o backfill #1774
-- rodou antes desses cards existirem ou nao achou match na epoca).
-- Este script repete o criterio do #1774: match UNICO por titulo
-- normalizado contra kanban_cards que TEM linha em gestao.projetos.
-- Ambiguos (2+ projetos gestao distintos pro mesmo nome) ficam fora.
-- Auditoria 02/09: 39 unicos, 2 ambiguos; MODELOS/THAINARA (cards
-- utilitarios) nao casam com nada e seguem NULL, correto.
-- O sync (trello.py _vincular_space passo 2) preenche
-- space_card_ids_obra desses cards na proxima rodada.
-- Idempotente: so pega space_card_id IS NULL.
-- ═══════════════════════════════════════════════════════════════════
BEGIN;

WITH alvo AS (
  SELECT c.id, lower(regexp_replace(trim(c.nome), '\s+', ' ', 'g')) AS k
    FROM trello_projetos.cards c
   WHERE NOT c.closed AND c.space_card_id IS NULL
), cand AS (
  SELECT a.id,
         count(DISTINCT p.card_id) AS n,
         min(p.card_id::text)::uuid AS card_unico
    FROM alvo a
    JOIN public.kanban_cards kc
      ON lower(regexp_replace(trim(kc.title), '\s+', ' ', 'g')) = a.k
    JOIN gestao.projetos p ON p.card_id = kc.id
   GROUP BY a.id
)
UPDATE trello_projetos.cards c
   SET space_card_id = cand.card_unico
  FROM cand
 WHERE c.id = cand.id
   AND cand.n = 1
   AND c.space_card_id IS NULL;

-- conferencia: quantos cards abertos seguem sem vinculo
SELECT count(*) AS ainda_sem_vinculo
  FROM trello_projetos.cards
 WHERE NOT closed AND space_card_id IS NULL;

COMMIT;
