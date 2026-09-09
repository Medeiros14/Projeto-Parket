-- ═══════════════════════════════════════════════════════════════════
-- Backfill massa gestao.itens (02/09/2026, pedido do Will)
-- QUE FAZ: todo gestao.projetos com simulacao_id e ZERO itens recebe a
-- cópia dos itens da proposta (public.simulacao_itens = PG local, fonte).
-- Mesmo template do backfill auditado de 26/08 (backfill_gestao_itens_3gaps.sql):
--   itens + meta.codigo "X.Y" (bloco = categoria raiz por 1a aparição,
--   seq = linha no bloco) + item_etapa_status + projeto_etapas +
--   valor_total do projeto + evento na timeline.
-- Idempotente: só age em projeto com zero itens.
-- ═══════════════════════════════════════════════════════════════════
BEGIN;

WITH vazio AS (
  SELECT p.id AS projeto_id, p.simulacao_id AS sim_id
    FROM gestao.projetos p
   WHERE p.simulacao_id IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM gestao.itens gi WHERE gi.projeto_id = p.id)
),
src AS (
  SELECT v.projeto_id, v.sim_id, si.id AS sitem_id, si.ordem, si.categoria,
         si.descritivo, si.valor, si.meta, split_part(si.categoria, '||', 1) AS cat_raiz
    FROM vazio v JOIN public.simulacao_itens si ON si.simulacao_id = v.sim_id
),
blocos AS (
  SELECT projeto_id, cat_raiz,
         row_number() OVER (PARTITION BY projeto_id ORDER BY min(ordem)) AS bloco
    FROM src GROUP BY projeto_id, cat_raiz
),
numerado AS (
  SELECT s.*, b.bloco,
         row_number() OVER (PARTITION BY s.projeto_id, s.cat_raiz ORDER BY s.ordem) AS seq
    FROM src s JOIN blocos b ON b.projeto_id = s.projeto_id AND b.cat_raiz = s.cat_raiz
),
ins AS (
  INSERT INTO gestao.itens (projeto_id, simulacao_item_id, ordem, categoria,
                            descritivo, quantidade, unidade, valor_unit, valor_total, meta)
  SELECT projeto_id, sitem_id, ordem, categoria, descritivo,
         COALESCE((meta->>'quantidade')::numeric, 1),
         COALESCE(meta->>'unidade', 'un'),
         COALESCE((meta->>'preco')::numeric, valor),
         valor,
         COALESCE(meta, '{}'::jsonb) || jsonb_build_object('codigo', bloco || '.' || seq)
    FROM numerado
  RETURNING id, projeto_id
),
etapas_item AS (
  INSERT INTO gestao.item_etapa_status (item_id, etapa_numero, status)
  SELECT ins.id, ec.numero, 'pendente' FROM ins CROSS JOIN gestao.etapas_catalogo ec
  RETURNING item_id
),
etapas_proj AS (
  INSERT INTO gestao.projeto_etapas (projeto_id, etapa_numero, status)
  SELECT DISTINCT s.projeto_id, ec.numero, 'pendente' FROM src s CROSS JOIN gestao.etapas_catalogo ec
  ON CONFLICT DO NOTHING
  RETURNING projeto_id
),
upd AS (
  UPDATE gestao.projetos p
     SET valor_total = (SELECT SUM(s.valor) FROM src s WHERE s.projeto_id = p.id)
   WHERE p.id IN (SELECT DISTINCT projeto_id FROM src)
  RETURNING p.id
),
ev AS (
  INSERT INTO gestao.eventos (projeto_id, tipo, titulo, descricao, autor_email, payload)
  SELECT DISTINCT s.projeto_id, 'criado', 'Itens copiados da proposta (backfill vínculos 02/09)',
         format('%s itens copiados', (SELECT count(*) FROM src x WHERE x.projeto_id = s.projeto_id)),
         'will.tape@gmail.com',
         jsonb_build_object('simulacao_id', s.sim_id, 'backfill', 'vinculos-massa-02-09')
    FROM src s
  RETURNING projeto_id
)
SELECT (SELECT count(*) FROM ins)                          AS itens_inseridos,
       (SELECT count(DISTINCT projeto_id) FROM ins)        AS projetos_populados,
       (SELECT count(*) FROM etapas_item)                  AS etapas_item,
       (SELECT count(*) FROM upd)                          AS projetos_valor,
       (SELECT count(*) FROM vazio)                        AS projetos_alvo;

COMMIT;
