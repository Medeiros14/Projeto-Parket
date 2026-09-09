-- ═══════════════════════════════════════════════════════════════════
-- RELINK RODRIGO LUIZ HENRIQUE SIMOES: proposta 10533 -> 10935 (03/09/2026)
--
-- QUE FAZ: o projeto do gestão 8255782e apontava pra simulação antiga
-- (espelho 7812421a, numero 10533, R$ 46.400 com 2 itens) e carregava 7
-- itens vindos de um backfill de PDF que somavam R$ 343.262,00. A proposta
-- viva do cliente é a 10935 (espelho 4e70b9b1, 20 itens, R$ 444.062,20),
-- que é a que o Valor e o espelho do Home Broker já mostram.
--
-- Este script: (1) guarda backup do projeto e dos itens antigos,
-- (2) apaga os itens antigos e as linhas de etapa deles, (3) reaponta o
-- projeto pra simulação certa, (4) recopia os 20 itens da proposta com
-- meta.codigo "X.Y" no mesmo template do backfill de 02/09, (5) registra
-- o evento na timeline.
--
-- POR QUE pode apagar os itens antigos: as 84 linhas de item_etapa_status
-- do projeto estavam TODAS em 'pendente', ou seja, nada tinha andado.
--
-- NÃO MEXE no card_id do projeto (b7849b00, card operacional de vistoria):
-- trocar o card quebraria thread de chat, documentos e aba fiscal.
-- ═══════════════════════════════════════════════════════════════════
BEGIN;

-- ── Backup ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS gestao.projetos_relink_bak_20260903 AS
  SELECT * FROM gestao.projetos WHERE false;
INSERT INTO gestao.projetos_relink_bak_20260903
  SELECT * FROM gestao.projetos WHERE id = '8255782e-ff9b-4f18-b1d3-4e61e348b6d4';

CREATE TABLE IF NOT EXISTS gestao.itens_relink_bak_20260903 AS
  SELECT * FROM gestao.itens WHERE false;
INSERT INTO gestao.itens_relink_bak_20260903
  SELECT * FROM gestao.itens WHERE projeto_id = '8255782e-ff9b-4f18-b1d3-4e61e348b6d4';

-- ── Limpa os itens antigos (e as etapas por item) ─────────────────
DELETE FROM gestao.item_etapa_status
 WHERE item_id IN (SELECT id FROM gestao.itens
                    WHERE projeto_id = '8255782e-ff9b-4f18-b1d3-4e61e348b6d4');
DELETE FROM gestao.itens
 WHERE projeto_id = '8255782e-ff9b-4f18-b1d3-4e61e348b6d4';

-- ── Reaponta o projeto pra proposta viva ──────────────────────────
UPDATE gestao.projetos p
   SET simulacao_id    = sp.id,
       numero_proposta = sp.numero,
       cliente         = COALESCE(sp.cliente, p.cliente),
       endereco        = COALESCE(sp.endereco, p.endereco),
       vendedor        = COALESCE(sp.vendedor, p.vendedor),
       arquiteto       = COALESCE(sp.arquiteto, p.arquiteto),
       orcamentista    = COALESCE(sp.orcamentista, p.orcamentista),
       updated_at      = now()
  FROM public.simulacao_projetos sp
 WHERE p.id = '8255782e-ff9b-4f18-b1d3-4e61e348b6d4'
   AND sp.id = '4e70b9b1-2bdf-4168-8653-67a8849c941d';

-- ── Recopia os itens da proposta (template do backfill 02/09) ─────
WITH src AS (
  SELECT '8255782e-ff9b-4f18-b1d3-4e61e348b6d4'::uuid AS projeto_id,
         si.id AS sitem_id, si.ordem, si.categoria, si.descritivo, si.valor, si.meta,
         split_part(si.categoria, '||', 1) AS cat_raiz
    FROM public.simulacao_itens si
   WHERE si.simulacao_id = '4e70b9b1-2bdf-4168-8653-67a8849c941d'
),
blocos AS (
  SELECT cat_raiz, row_number() OVER (ORDER BY min(ordem)) AS bloco
    FROM src GROUP BY cat_raiz
),
numerado AS (
  SELECT s.*, b.bloco,
         row_number() OVER (PARTITION BY s.cat_raiz ORDER BY s.ordem) AS seq
    FROM src s JOIN blocos b ON b.cat_raiz = s.cat_raiz
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
  RETURNING id
),
etapas_item AS (
  INSERT INTO gestao.item_etapa_status (item_id, etapa_numero, status)
  SELECT ins.id, ec.numero, 'pendente' FROM ins CROSS JOIN gestao.etapas_catalogo ec
  RETURNING item_id
),
etapas_proj AS (
  INSERT INTO gestao.projeto_etapas (projeto_id, etapa_numero, status)
  SELECT '8255782e-ff9b-4f18-b1d3-4e61e348b6d4'::uuid, ec.numero, 'pendente'
    FROM gestao.etapas_catalogo ec
  ON CONFLICT DO NOTHING
  RETURNING projeto_id
),
upd AS (
  UPDATE gestao.projetos
     SET valor_total = (SELECT SUM(valor) FROM src)
   WHERE id = '8255782e-ff9b-4f18-b1d3-4e61e348b6d4'
  RETURNING id
),
ev AS (
  INSERT INTO gestao.eventos (projeto_id, tipo, titulo, descricao, autor_email, payload)
  VALUES ('8255782e-ff9b-4f18-b1d3-4e61e348b6d4', 'status_change',
          'Projeto religado à proposta 10935',
          'Estava na proposta 10533 (simulação antiga, R$ 343.262,00 de backfill de PDF). Reapontado pra proposta viva 10935, com os 20 itens recopiados.',
          'will.tape@gmail.com',
          jsonb_build_object('simulacao_id_antiga', '7812421a-151b-4dda-b669-fc26ac6d46d5',
                             'simulacao_id_nova',   '4e70b9b1-2bdf-4168-8653-67a8849c941d',
                             'numero_antigo', '10533', 'numero_novo', '10935'))
  RETURNING projeto_id
)
SELECT (SELECT count(*) FROM ins)         AS itens_inseridos,
       (SELECT count(*) FROM etapas_item) AS etapas_item,
       (SELECT count(*) FROM upd)         AS projeto_atualizado;

COMMIT;
