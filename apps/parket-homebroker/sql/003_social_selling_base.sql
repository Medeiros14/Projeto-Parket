-- ============================================================
-- SOCIAL SELLING: backfill da Base de arquitetos (Will 01/09)
-- ============================================================
-- O QUÊ: extrai todos os arquitetos que passaram pelo funil do
-- Homebroker e cria 1 card por arquiteto (dedup por nome
-- normalizado) na coluna "base" do pipeline social-aquisicao.
--
-- Fontes (2):
--   1. kanban_cards.details.arquiteto        -> texto livre, só nome
--   2. details.contatos_adicionais[]         -> objetos com papel
--      "arquiteto": tem nome + telefones[] + emails[]
--
-- POR QUÊ idempotente: o WHERE NOT EXISTS no final permite rodar
-- de novo (ex: re-backfill depois de novas obras) sem duplicar.
-- Cards já movidos pelo Vinicius NÃO voltam pra base (o guard
-- checa o dept inteiro social-aquisicao, e quem foi promovido
-- pra social-conexao/ativacao é achado pelo details.social_selling).
--
-- ONDE RODAR (IMPORTANTE): no PG LOCAL (parket-pg-local_postgres,
-- psql -U postgres). O frontend do HB le api.parket.works/rest/v1
-- -> rest-local -> PG LOCAL; o Cloud hbx e so espelho (incidente
-- 01/09: kanban social vazio porque o import foi pro Cloud).
-- ============================================================

WITH fonte AS (
  -- Fonte 1: campo arquiteto do card (só nome, sem contato)
  SELECT trim(regexp_replace(details->>'arquiteto', '\s+', ' ', 'g')) AS nome,
         NULL::jsonb AS telefones,
         NULL::jsonb AS emails,
         id AS card_id
    FROM kanban_cards
   WHERE COALESCE(trim(details->>'arquiteto'), '') <> ''

  UNION ALL

  -- Fonte 2: contatos adicionais com papel arquiteto (nome + tel + email)
  SELECT trim(regexp_replace(c->>'nome', '\s+', ' ', 'g')),
         CASE WHEN jsonb_typeof(c->'telefones') = 'array' THEN c->'telefones' END,
         CASE WHEN jsonb_typeof(c->'emails')    = 'array' THEN c->'emails'    END,
         k.id
    FROM kanban_cards k,
         jsonb_array_elements(k.details->'contatos_adicionais') AS c
   WHERE jsonb_typeof(k.details->'contatos_adicionais') = 'array'
     AND (c->>'papel' ILIKE '%arquitet%' OR c->>'papel_label' ILIKE '%arquitet%')
     AND COALESCE(trim(c->>'nome'), '') <> ''
),

-- Filtro de lixo: nomes curtos demais, placeholders e strings que
-- são telefone puro. Blacklist inclui "parket" (assinatura da equipe
-- já contaminou nomes antes, ver incidente teka-analyzer 28/08).
filtrado AS (
  SELECT *, lower(nome) AS norm
    FROM fonte
   WHERE length(nome) >= 4
     AND lower(nome) NOT IN (
       'não tem','nao tem','sem arquiteto','nenhum','cliente',
       'proprio','próprio','parket','teste','n/a','none','null',
       'nao possui','não possui','sem','vários','varios'
     )
     AND nome !~ '^[0-9() +\-.]+$'
),

-- 1 linha por arquiteto: display = variante mais longa do nome
-- (tende a ser a mais completa), cards = todos os cards de origem
agg AS (
  SELECT norm,
         (array_agg(nome ORDER BY length(nome) DESC))[1] AS display,
         array_agg(DISTINCT card_id) AS cards
    FROM filtrado
   GROUP BY norm
),

-- Telefones/emails distintos agregados de todas as aparições
tels AS (
  SELECT norm, jsonb_agg(DISTINCT trim(t)) AS telefones
    FROM filtrado, jsonb_array_elements_text(COALESCE(telefones, '[]'::jsonb)) AS t
   WHERE trim(t) <> ''
   GROUP BY norm
),
mails AS (
  SELECT norm, jsonb_agg(DISTINCT lower(trim(e))) AS emails
    FROM filtrado, jsonb_array_elements_text(COALESCE(emails, '[]'::jsonb)) AS e
   WHERE trim(e) <> ''
   GROUP BY norm
)

INSERT INTO kanban_cards
       (dept_id, column_id, title, subtitle, tags, details, created_at, updated_at)
SELECT 'social-aquisicao',
       'base',
       a.display,
       'Arquiteto',
       ARRAY['arquiteto'],
       jsonb_build_object(
         'social_selling', true,                       -- marca os cards deste funil
         'origem',         'homebroker',               -- de onde essa base veio
         'telefones',      COALESCE(t.telefones, '[]'::jsonb),
         'emails',         COALESCE(m.emails,    '[]'::jsonb),
         'instagram',      '',                         -- preenchido pelo Vinicius
         'canal',          '',                         -- whatsapp | instagram | ambos
         'cards_origem',   to_jsonb(a.cards)           -- cards do funil que citam o arquiteto
       ),
       now(), now()
  FROM agg a
  LEFT JOIN tels  t USING (norm)
  LEFT JOIN mails m USING (norm)
 WHERE NOT EXISTS (
         -- dedup contra qualquer card social selling já existente
         -- (base ou já promovido pra conexão/ativação)
         SELECT 1 FROM kanban_cards e
          WHERE e.dept_id IN ('social-aquisicao','social-conexao','social-ativacao')
            AND lower(trim(e.title)) = a.norm
       );
