-- Merge NAROOMA (pedido do Will 08/09, revoga a excecao "NAROOMA x2"):
-- deck e piso viram UM projeto gestao.
--   sobrevivente: 88badce9 (PISO, prop 1099, R$240.000, itens 1.1-1.6)
--   fantasma:     c0ebc429 (DECK, prop 2068, R$47.437,51, 1 item)
-- Os dois apontam pro MESMO card a1464ab7; o deck entra como bloco 2.1.
-- Fantasma nao tem filhas (etapas/eventos/docs/fotos/acomp = 0), mas os
-- UPDATEs de filhas rodam mesmo assim por seguranca (no-op se vazio).
BEGIN;

-- backup do fantasma + item antes de mexer
CREATE TABLE IF NOT EXISTS gestao.projetos_dup_bak_narooma_20260908 AS
  SELECT * FROM gestao.projetos WHERE false;
INSERT INTO gestao.projetos_dup_bak_narooma_20260908
  SELECT * FROM gestao.projetos WHERE id = 'c0ebc429-cee2-4fc0-827d-98ce01c37138';
CREATE TABLE IF NOT EXISTS gestao.itens_dup_bak_narooma_20260908 AS
  SELECT * FROM gestao.itens WHERE false;
INSERT INTO gestao.itens_dup_bak_narooma_20260908
  SELECT * FROM gestao.itens WHERE projeto_id = 'c0ebc429-cee2-4fc0-827d-98ce01c37138';

-- item do deck vira bloco 2 do sobrevivente (1.1 -> 2.1), marcando origem
UPDATE gestao.itens
   SET projeto_id = '88badce9-96e7-4d82-aa2a-908f025c86e3',
       meta = coalesce(meta,'{}'::jsonb) || jsonb_build_object(
                'absorvido_de', 'c0ebc429-cee2-4fc0-827d-98ce01c37138',
                'codigo', '2.' || split_part(coalesce(meta->>'codigo','1.1'),'.',2),
                'codigo_original', meta->>'codigo')
 WHERE projeto_id = 'c0ebc429-cee2-4fc0-827d-98ce01c37138';

-- filhas (fantasma nao tem nenhuma, mas garante)
UPDATE gestao.projeto_etapas     t SET projeto_id='88badce9-96e7-4d82-aa2a-908f025c86e3' WHERE t.projeto_id='c0ebc429-cee2-4fc0-827d-98ce01c37138' AND NOT EXISTS (SELECT 1 FROM gestao.projeto_etapas s WHERE s.projeto_id='88badce9-96e7-4d82-aa2a-908f025c86e3' AND s.etapa_numero=t.etapa_numero);
DELETE FROM gestao.projeto_etapas WHERE projeto_id='c0ebc429-cee2-4fc0-827d-98ce01c37138';
UPDATE gestao.eventos             SET projeto_id='88badce9-96e7-4d82-aa2a-908f025c86e3' WHERE projeto_id='c0ebc429-cee2-4fc0-827d-98ce01c37138';
UPDATE gestao.documentos          SET projeto_id='88badce9-96e7-4d82-aa2a-908f025c86e3' WHERE projeto_id='c0ebc429-cee2-4fc0-827d-98ce01c37138';
UPDATE gestao.fotos               SET projeto_id='88badce9-96e7-4d82-aa2a-908f025c86e3' WHERE projeto_id='c0ebc429-cee2-4fc0-827d-98ce01c37138';
UPDATE gestao.obra_acompanhamento SET projeto_id='88badce9-96e7-4d82-aa2a-908f025c86e3' WHERE projeto_id='c0ebc429-cee2-4fc0-827d-98ce01c37138';
UPDATE gestao.reuniao_bloco       SET projeto_id='88badce9-96e7-4d82-aa2a-908f025c86e3' WHERE projeto_id='c0ebc429-cee2-4fc0-827d-98ce01c37138';
UPDATE gestao.crises              SET projeto_id='88badce9-96e7-4d82-aa2a-908f025c86e3' WHERE projeto_id='c0ebc429-cee2-4fc0-827d-98ce01c37138';
UPDATE gestao.custo_lancamento    SET projeto_id='88badce9-96e7-4d82-aa2a-908f025c86e3' WHERE projeto_id='c0ebc429-cee2-4fc0-827d-98ce01c37138';
UPDATE insta.posts                SET projeto_id='88badce9-96e7-4d82-aa2a-908f025c86e3' WHERE projeto_id='c0ebc429-cee2-4fc0-827d-98ce01c37138';
UPDATE fiscal.notas               SET obra_projeto_id='88badce9-96e7-4d82-aa2a-908f025c86e3' WHERE obra_projeto_id='c0ebc429-cee2-4fc0-827d-98ce01c37138';

-- libera a sim do deck (UNIQUE) e soma escopos no sobrevivente
UPDATE gestao.projetos SET simulacao_id = NULL
 WHERE id = 'c0ebc429-cee2-4fc0-827d-98ce01c37138';

UPDATE gestao.projetos
   SET valor_total = valor_total + 47437.51,   -- 240000 (piso) + deck
       meta = coalesce(meta,'{}'::jsonb) || jsonb_build_object(
         'absorveu',             jsonb_build_array('c0ebc429-cee2-4fc0-827d-98ce01c37138'),
         'sims_absorvidas',      jsonb_build_array('bcec5a8d-73f5-4af9-b9cb-7825730cd953'),
         'propostas_absorvidas', jsonb_build_array('2068'),
         'valores_absorvidos',   jsonb_build_array(47437.51),
         'merge_narooma_em',     '2026-09-08'),
       updated_at = now()
 WHERE id = '88badce9-96e7-4d82-aa2a-908f025c86e3';

-- tombstone: card e o mesmo do sobrevivente; so bloqueia CRIACAO no sync,
-- nunca apaga projeto vivo, entao nao ameaca o sobrevivente
INSERT INTO gestao.projetos_excluidos (card_id, projeto_id, cliente, absorvido_por, motivo)
VALUES ('a1464ab7-089f-4479-870c-2c23865cb995',
        'c0ebc429-cee2-4fc0-827d-98ce01c37138',
        'NAROOMA EMPREENDIMENTOS E PARTICIPACOES',
        '88badce9-96e7-4d82-aa2a-908f025c86e3',
        'merge NAROOMA deck+piso 08/09 (pedido Will)')
ON CONFLICT (card_id) DO NOTHING;

DELETE FROM gestao.projetos WHERE id = 'c0ebc429-cee2-4fc0-827d-98ce01c37138';

-- conferencia
SELECT id, numero_proposta, valor_total,
       (SELECT count(*) FROM gestao.itens i WHERE i.projeto_id=p.id) n_itens
  FROM gestao.projetos p WHERE id='88badce9-96e7-4d82-aa2a-908f025c86e3';
SELECT meta->>'codigo' cod, categoria, valor_total FROM gestao.itens
 WHERE projeto_id='88badce9-96e7-4d82-aa2a-908f025c86e3' ORDER BY meta->>'codigo';

COMMIT;
