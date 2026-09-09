-- =====================================================================
-- MERGE DE PROJETOS DUPLICADOS NO GESTAO - 2026-09-08 (aprovado Will)
-- QUE FAZ: unifica ~90 projetos duplicados (fantasmas do backfill OCR
-- 13/08 e 02/09 + pares antigos) em 1 card por obra, movendo TODO o
-- conteudo (itens/docs/fotos/eventos/etapas/crises/reunioes/insta/nfe)
-- pro sobrevivente e apagando o fantasma com tombstone.
-- REGRAS:
--  - sobrevivente = quem tem OP na fabrica (producao_ordens no Cloud)
--    ou maior conteudo; aprovado par a par pelo Will em 08/09.
--  - COSTANTINI (SIMULACAO) 7081d9fd NAO entra: teste vivo do Will.
--  - itens OCR valor 0 que sao copia dos itens do canonico: descartados
--    (flag discard_itens; ficam no backup).
--  - propostas irmas (aditivo) somam no valor_total (flag somar_valor).
--  - tombstone gestao.projetos_excluidos impede o auto-sync-cards de
--    recriar o projeto a partir do card fantasma (sync patcheado junto).
-- Rodar: docker exec -i $(docker ps -q -f name=parket-pg-local_postgres) \
--          psql -U postgres -v ON_ERROR_STOP=1 < este_arquivo.sql
-- Backup: tabelas *_dup_bak_20260908 criadas no passo 1.
-- =====================================================================

BEGIN;

-- ---------------------------------------------------------------
-- 1) BACKUP integral das tabelas tocadas (so cria se nao existir)
-- ---------------------------------------------------------------
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'gestao.projetos','gestao.itens','gestao.projeto_etapas','gestao.eventos',
    'gestao.documentos','gestao.fotos','gestao.obra_acompanhamento',
    'gestao.reuniao_bloco','gestao.crises','gestao.custo_lancamento',
    'insta.posts','insta.perfil_config','fiscal.notas']
  LOOP
    IF to_regclass(replace(t,'.','.')||'_dup_bak_20260908') IS NULL THEN
      EXECUTE format('CREATE TABLE %s_dup_bak_20260908 AS TABLE %s', t, t);
    END IF;
  END LOOP;
END $$;

-- ---------------------------------------------------------------
-- 2) Tombstone: card fantasma nunca mais vira projeto no sync
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS gestao.projetos_excluidos (
  card_id       uuid PRIMARY KEY,   -- kanban card do projeto excluido
  projeto_id    uuid,               -- id do gestao.projetos apagado
  cliente       text,
  absorvido_por uuid,               -- sobrevivente (NULL = stub sem par)
  motivo        text,
  created_at    timestamptz DEFAULT now()
);

-- ---------------------------------------------------------------
-- 3) Mapa de merge (prefixo de 8 hex -> resolve pro uuid completo)
--    discard_itens: itens do fantasma sao copia OCR valor 0, nao movem
--    somar_valor: proposta irma/aditivo, valor soma no sobrevivente
-- ---------------------------------------------------------------
CREATE TEMP TABLE merge_src(g8 text, s8 text, discard_itens bool, somar_valor bool);
INSERT INTO merge_src VALUES
  -- BUCKET A: fantasma vazio -> canonico
  ('6b43792d','ae3509b2',false,false),  -- HOTEL GLORIA
  ('18847fca','a077c1ad',false,false),  -- Lidia Nogueira
  ('bd4dc472','044d4ff5',false,false),  -- MARIANA NOVIS GRAZIANO
  ('390aa0b6','f4d3b32b',false,false),  -- VIA RIO OCTAVIO
  ('ec211cf0','c1dedfef',false,false),  -- DIOGO LUSTOSA
  ('342f8375','e3e0f811',false,false),  -- ITAMINAS ARGEU
  ('4ce06b28','f35d618f',false,false),  -- PHELIPE MATHIAS
  ('e5be60b9','b48de459',false,false),  -- FRANCISCO BALESTRIN
  ('668c4a4f','391f8db4',false,false),  -- SHINDI KADOBAYASHI
  ('a13e0d1b','b02d3d13',false,false),  -- Bernardo Amaral
  ('3892947e','420a5f1d',false,false),  -- JORGE FEFER
  ('afe948f1','4dc6c1fc',false,false),  -- TATIANA RAMALHO
  ('8016ac2d','bfe55e61',false,false),  -- Bruno Gaban
  ('5e817d80','b432a2b4',false,false),  -- PAULO JOSE DINIS
  ('b46f8850','f079b95d',false,false),  -- NH3
  ('017d2c09','7ad1796f',false,false),  -- GEOVANNA DONELLA
  ('f490a9d9','d869aa12',false,false),  -- ANA LUISA FISCHER
  ('5f7fe711','6d932fc0',false,false),  -- ROBERTO JUSTUS
  ('da387d16','ad2b94e9',false,false),  -- BRUNO SAID
  ('3fbf0c25','2b1ee471',false,false),  -- LUIZ HENRIQUE
  ('163f38e3','bee51885',false,false),  -- MARCIO JULIO
  ('d94c4534','e31ee25f',false,false),  -- FERNANDO ARAGON
  ('7297bf65','2ae6d77f',false,false),  -- FRANCISCO IVENS
  ('03cf40a9','3ab9ed12',false,false),  -- PATRICIA CAMPONOGARA
  ('a4e15038','8e83ed5e',false,false),  -- RENATA LEAL
  ('a83f9103','483f9a47',false,false),  -- LETICIA SECCHI
  ('845eb2cd','4e65abeb',false,false),  -- GUSTAVO LOPES
  ('60971ca2','7e6bf12f',false,false),  -- RICARDO FANIN
  ('1302cd0f','272eba56',true ,false),  -- ARTHUR GARROTE (itens identicos)
  ('37472843','af661357',true ,false),  -- ROCHA FBV (itens OCR val 0)
  ('591fe75a','af661357',false,false),  -- FAMILIA ROCHA FBV stub
  ('77d64bdc','0f12fba8',false,false),  -- ROCHA ALEMANHA stub 1
  ('1d362e09','0f12fba8',false,false),  -- ROCHA ALEMANHA stub 2
  ('dc946906','8372f508',false,false),  -- MOHMED ADITIVO vazio
  ('725f35d3','21fe7250',false,false),  -- YGOR MARCENARIA vazio
  ('84187778','19f8a157',false,false),  -- ICMVS GUARANA
  ('11d2d68b','9c13cd1f',false,false),  -- AMOSTRA PRISCILA
  ('1cd38517','620c23ac',false,false),  -- AMOSTRA ZARAPLAST
  ('c474f7eb','9fda3c96',false,false),  -- DB BASTOS -> Davi Bastos
  ('0f9fadc4','ce07f81f',false,false),  -- SD CONSTRUCOES
  ('3b22cf84','034459b8',false,false),  -- MARIANNA FERMAN
  ('ca62dbe2','0d2f81ca',false,false),  -- ALESSANDRA FISCHER
  ('779e5793','1e9de3a2',false,false),  -- AUREA ITAIM
  ('b01e0338','52d41d18',false,false),  -- LUIS C MARTINEZ ROMERO
  ('144f7340','636abcf6',false,false),  -- SOLARIUS JAZZ
  ('8ffea14e','717202a4',false,false),  -- SOLARIUS BLUES
  ('d4a06f41','e47939d9',false,false),  -- BRADESCO JABOATAO
  ('265692d2','415f1a5f',true ,false),  -- BRADESCO SALVADOR (1 item val 0)
  ('3ca15f73','02f6ed7c',false,false),  -- BRUNO QUEIROGA
  ('f87f6d98','ba4268b0',false,false),  -- CARSTEN MADER
  ('739e7ccb','899e7e44',false,false),  -- MIGUEL SALING (11 fotos movem)
  ('d9803f43','733c62a9',false,false),  -- MIGUEL SOARES PIRES
  ('1ff868c8','3d7dde50',false,false),  -- ANDRE GURGEL AP05 vazio
  ('687dc3c5','3d7dde50',false,false),  -- ANDRE GURGEL vazio 02/09
  ('c56d78c9','f12e5344',true ,false),  -- ALARICO (fotos movem, itens OCR nao)
  ('b209991b','907bb6f8',false,false),  -- THIAGO MIRANDA vazio
  ('939ed55b','03cde525',true ,false),  -- FELIPE NOBUHIRO (doc move)
  ('0e780d1a','4a3439ef',false,false),  -- MARIA E MEL PART vazio
  ('11a4d326','cecdb39e',false,false),  -- NOVO RUMO vazio
  ('8f6c471b','a23e7519',false,false),  -- PEDRO VANDOR vazio
  ('0a0c3637','c9e1715a',false,false),  -- 2C TRAMONTO vazio 1
  ('de4d8975','c9e1715a',false,false),  -- 2C TRAMONTO vazio 2
  ('4c014ff9','5597885a',true ,false),  -- DJACI marcado 17/08 (itens val 0)
  ('d7382af3','14483bd4',false,false),  -- RIVEIRA ISAB stub
  ('f77398b4','f60bd02b',false,false),  -- LH AGROPASTORIL stub
  -- BUCKET B: aprovado Will 08/09 (sobrevivente = OP/maior conteudo)
  ('c2d596c7','27f0fc32',false,false),  -- Bruno Colodetti 10743 -> 2177 (OP repontada no Cloud)
  ('c17a14b3','477acc3b',false,false),  -- CASA FLORAIS REINALDO -> 11624
  ('973edf3c','cecdb39e',false,false),  -- NOVO RUMO MARINA -> 10801
  ('b04fc6e2','4a3439ef',false,false),  -- MARIA E MEL PKT -> 1901
  ('46ca8b95','f60bd02b',false,false),  -- LUIZA TRAJANO -> LH AGROPASTORIL (OP)
  ('ba122905','b926e7af',false,false),  -- SILVIA VERISSINO fotos -> canonico (OP)
  ('27ce6d43','b926e7af',false,true ),  -- 1807 PART 99927 -> SILVIA (proposta irma)
  ('1fd84788','fba6845b',false,false),  -- ANVIVA
  ('9e2bb294','d13ee1f7',false,true ),  -- GIC 2231 -> canonico (proposta irma)
  ('3d8c9569','3d7dde50',false,false),  -- ANDRE GURGEL 3o -> 11230 (OP)
  ('a34447e7','bbdc47e8',false,false),  -- BRADESCO JOAO PESSOA vazio -> bare (renomeado abaixo)
  ('5de4f968','f31c9e29',false,false),  -- RONALDO ALMEIDAFILHO -> canonico
  ('7c2bf670','4178fbbe',false,false),  -- MC INVESTIMENTOS AMANDA -> canonico
  ('78e715cc','a23e7519',false,false),  -- Paulo Sergio Vandor -> PAULO VANDOR
  ('8bba3e1e','399626d7',false,false),  -- CINTIA BARBOZA -> CINTIA (sim vinculada)
  ('d1a9f63b','e6dd6bd3',true ,false),  -- JORGE BATISTA NETO (item = total duplicado)
  ('d49e22f9','55ae6832',false,false),  -- ANA CRISTINA GARCIA vazio
  ('5cb1df1a','55ae6832',false,false),  -- ANA CRISTINA 73k -> GARCIA DINIZ
  ('7b3fc22c','fee6f69d',false,false),  -- MICHELE REIS -> MICHELE
  ('2172a032','8e03e9a8',false,false),  -- LOURENCO GIMENES -> LOURENCO
  ('475f4f08','907bb6f8',false,true ),  -- D&T 100011 -> TIAGO MIRANDA (proposta irma)
  ('0d670663','d51a3534',false,true ),  -- ROBERTO BLOES 2141 -> 11512 (aditivo)
  ('22998ca3','0f12fba8',false,true ); -- ROCHA ALEMANHA 1986 -> 10952 (aditivo)

-- Stubs genericos vazios sem par (conteudo = teste; fica no backup)
CREATE TEMP TABLE stub_src(g8 text);
INSERT INTO stub_src VALUES
  ('8b0996b9'),  -- Roberta
  ('80eb3c9d'),  -- Silvia
  ('9e888b81'),  -- Sergio
  ('007d3f76'),  -- MARC
  ('858dbb94'); -- Roberto (crise "xxxx" resolvida + reuniao teste de audio)

-- Resolve prefixos -> uuid completo e valida 1:1
CREATE TEMP TABLE merge_map AS
SELECT pg.id AS ghost, ps.id AS survivor, m.discard_itens, m.somar_valor
  FROM merge_src m
  JOIN gestao.projetos pg ON pg.id::text LIKE m.g8||'%'
  JOIN gestao.projetos ps ON ps.id::text LIKE m.s8||'%';
CREATE TEMP TABLE stub_del AS
SELECT pg.id AS ghost FROM stub_src s JOIN gestao.projetos pg ON pg.id::text LIKE s.g8||'%';

DO $$
DECLARE n1 int; n2 int; n3 int; n4 int; nc int;
BEGIN
  SELECT count(*) INTO n1 FROM merge_src;  SELECT count(*) INTO n2 FROM merge_map;
  SELECT count(*) INTO n3 FROM stub_src;   SELECT count(*) INTO n4 FROM stub_del;
  IF n1 <> n2 THEN RAISE EXCEPTION 'merge_map resolveu % de % pares', n2, n1; END IF;
  IF n3 <> n4 THEN RAISE EXCEPTION 'stub_del resolveu % de % stubs', n4, n3; END IF;
  -- nenhuma cadeia: sobrevivente nao pode ser fantasma de outro par
  SELECT count(*) INTO nc FROM merge_map a JOIN merge_map b ON a.survivor = b.ghost;
  IF nc > 0 THEN RAISE EXCEPTION 'cadeia de merge detectada (% casos)', nc; END IF;
END $$;

-- ---------------------------------------------------------------
-- 4) Snapshot dos fantasmas (pra preencher campos e meta depois)
-- ---------------------------------------------------------------
CREATE TEMP TABLE ghost_info AS
SELECT m.ghost, m.survivor, m.somar_valor, p.card_id, p.cliente, p.endereco,
       p.cnpj_cpf, p.obra_code, p.vendedor, p.arquiteto, p.orcamentista,
       p.gestor_email, p.contrato_id, p.simulacao_id, p.numero_proposta,
       p.valor_total, p.status, p.assinado_em, p.iniciado_em, p.entregue_em
  FROM merge_map m JOIN gestao.projetos p ON p.id = m.ghost;

-- ---------------------------------------------------------------
-- 5) Itens: descarta copias OCR, move o resto marcando a origem
-- ---------------------------------------------------------------
DELETE FROM gestao.itens i USING merge_map m
 WHERE m.discard_itens AND i.projeto_id = m.ghost;

UPDATE gestao.itens i
   SET projeto_id = m.survivor,
       meta = coalesce(i.meta,'{}'::jsonb)
              || jsonb_build_object('absorvido_de', m.ghost::text)
  FROM merge_map m
 WHERE i.projeto_id = m.ghost;

-- Renumera blocos movidos quando o sobrevivente JA tem itens com codigo:
-- raiz nova = max raiz do sobrevivente + rank do bloco movido (padrao
-- NOVITA: aditivo entra como proximo bloco livre, sem colidir 1.1 x 1.1)
WITH mov AS (
  SELECT i.id, i.projeto_id, i.meta->>'absorvido_de' AS ghost,
         split_part(i.meta->>'codigo','.',1)::int AS raiz_old,
         i.meta->>'codigo' AS cod
    FROM gestao.itens i
   WHERE i.meta ? 'absorvido_de'
     AND coalesce(i.meta->>'codigo','') ~ '^[0-9]+(\..*)?$'
),
base AS (
  SELECT i.projeto_id,
         max(split_part(i.meta->>'codigo','.',1)::int) AS max_raiz
    FROM gestao.itens i
   WHERE NOT (i.meta ? 'absorvido_de')
     AND coalesce(i.meta->>'codigo','') ~ '^[0-9]+(\..*)?$'
   GROUP BY 1
),
ren AS (
  SELECT mov.id, mov.cod,
         b.max_raiz + dense_rank() OVER (PARTITION BY mov.projeto_id
                        ORDER BY mov.ghost, mov.raiz_old) AS raiz_new
    FROM mov JOIN base b ON b.projeto_id = mov.projeto_id
)
UPDATE gestao.itens i
   SET meta = i.meta || jsonb_build_object('codigo',
         ren.raiz_new::text
         || CASE WHEN position('.' IN ren.cod) > 0
                 THEN substr(ren.cod, position('.' IN ren.cod)) ELSE '' END,
         'codigo_original', ren.cod)
  FROM ren WHERE i.id = ren.id;

-- ---------------------------------------------------------------
-- 6) Filhas: move tudo pro sobrevivente
-- ---------------------------------------------------------------
-- etapas: so as que o sobrevivente ainda nao tem (evita 2x etapa 1)
UPDATE gestao.projeto_etapas e SET projeto_id = m.survivor
  FROM merge_map m
 WHERE e.projeto_id = m.ghost
   AND NOT EXISTS (SELECT 1 FROM gestao.projeto_etapas s
                    WHERE s.projeto_id = m.survivor
                      AND s.etapa_numero = e.etapa_numero);
DELETE FROM gestao.projeto_etapas e USING merge_map m WHERE e.projeto_id = m.ghost;

UPDATE gestao.eventos             t SET projeto_id = m.survivor FROM merge_map m WHERE t.projeto_id = m.ghost;
UPDATE gestao.documentos          t SET projeto_id = m.survivor FROM merge_map m WHERE t.projeto_id = m.ghost;
UPDATE gestao.fotos               t SET projeto_id = m.survivor FROM merge_map m WHERE t.projeto_id = m.ghost;
UPDATE gestao.obra_acompanhamento t SET projeto_id = m.survivor FROM merge_map m WHERE t.projeto_id = m.ghost;
UPDATE gestao.reuniao_bloco       t SET projeto_id = m.survivor FROM merge_map m WHERE t.projeto_id = m.ghost;
UPDATE gestao.crises              t SET projeto_id = m.survivor FROM merge_map m WHERE t.projeto_id = m.ghost;
UPDATE gestao.custo_lancamento    t SET projeto_id = m.survivor FROM merge_map m WHERE t.projeto_id = m.ghost;
UPDATE insta.posts                t SET projeto_id = m.survivor FROM merge_map m WHERE t.projeto_id = m.ghost;
UPDATE fiscal.notas               t SET obra_projeto_id = m.survivor FROM merge_map m WHERE t.obra_projeto_id = m.ghost;

-- perfil insta: 1 por projeto; move so se o sobrevivente nao tem
UPDATE insta.perfil_config c SET projeto_id = m.survivor
  FROM merge_map m
 WHERE c.projeto_id = m.ghost
   AND NOT EXISTS (SELECT 1 FROM insta.perfil_config s WHERE s.projeto_id = m.survivor);
DELETE FROM insta.perfil_config c USING merge_map m WHERE c.projeto_id = m.ghost;

-- ---------------------------------------------------------------
-- 7) Sobrevivente herda campos vazios + meta de auditoria
-- ---------------------------------------------------------------
-- libera as sims dos fantasmas (simulacao_id e UNIQUE)
UPDATE gestao.projetos SET simulacao_id = NULL
 WHERE id IN (SELECT ghost FROM merge_map);

WITH agg AS (
  SELECT survivor,
         max(endereco)      AS endereco,      max(cnpj_cpf)   AS cnpj_cpf,
         max(obra_code)     AS obra_code,     max(vendedor)   AS vendedor,
         max(arquiteto)     AS arquiteto,     max(orcamentista) AS orcamentista,
         max(gestor_email)  AS gestor_email,  max(contrato_id::text)::uuid AS contrato_id,
         max(simulacao_id::text)::uuid AS simulacao_id,
         max(numero_proposta) AS numero_proposta,
         max(valor_total)   AS max_valor,
         sum(valor_total) FILTER (WHERE somar_valor) AS soma_irmas,
         bool_or(status <> 'novo') AS tem_status_avancado,
         min(assinado_em) AS assinado_em, min(iniciado_em) AS iniciado_em,
         max(entregue_em) AS entregue_em,
         jsonb_agg(ghost::text)                                    AS ghosts,
         jsonb_agg(card_id::text)      FILTER (WHERE card_id IS NOT NULL)      AS cards_abs,
         jsonb_agg(simulacao_id::text) FILTER (WHERE simulacao_id IS NOT NULL) AS sims_abs,
         jsonb_agg(numero_proposta)    FILTER (WHERE numero_proposta IS NOT NULL) AS props_abs,
         jsonb_agg(valor_total)        FILTER (WHERE valor_total > 0)          AS vals_abs
    FROM ghost_info GROUP BY survivor
)
UPDATE gestao.projetos p
   SET endereco     = coalesce(nullif(trim(p.endereco),''), a.endereco),
       cnpj_cpf     = coalesce(nullif(trim(p.cnpj_cpf),''), a.cnpj_cpf),
       obra_code    = coalesce(nullif(trim(p.obra_code),''), a.obra_code),
       vendedor     = coalesce(nullif(trim(p.vendedor),''), a.vendedor),
       arquiteto    = coalesce(nullif(trim(p.arquiteto),''), a.arquiteto),
       orcamentista = coalesce(nullif(trim(p.orcamentista),''), a.orcamentista),
       gestor_email = coalesce(nullif(trim(p.gestor_email),''), a.gestor_email),
       contrato_id  = coalesce(p.contrato_id, a.contrato_id),
       simulacao_id = coalesce(p.simulacao_id, a.simulacao_id),
       numero_proposta = coalesce(nullif(trim(p.numero_proposta),''), a.numero_proposta),
       valor_total  = CASE
                        WHEN a.soma_irmas IS NOT NULL THEN p.valor_total + a.soma_irmas
                        WHEN coalesce(p.valor_total,0) = 0 THEN coalesce(a.max_valor,0)
                        ELSE p.valor_total END,
       status       = CASE WHEN p.status = 'novo' AND a.tem_status_avancado
                           THEN 'em_execucao' ELSE p.status END,
       assinado_em  = coalesce(p.assinado_em, a.assinado_em),
       iniciado_em  = coalesce(p.iniciado_em, a.iniciado_em),
       entregue_em  = coalesce(p.entregue_em, a.entregue_em),
       meta = coalesce(p.meta,'{}'::jsonb) || jsonb_strip_nulls(jsonb_build_object(
                'absorveu',            a.ghosts,
                'cards_absorvidos',    a.cards_abs,
                'sims_absorvidas',     a.sims_abs,
                'propostas_absorvidas',a.props_abs,
                'valores_absorvidos',  a.vals_abs,
                'merge_duplicados_em', '2026-09-08')),
       updated_at = now()
  FROM agg a WHERE p.id = a.survivor;

-- ---------------------------------------------------------------
-- 8) Tombstones + exclusao dos fantasmas e stubs
-- ---------------------------------------------------------------
INSERT INTO gestao.projetos_excluidos (card_id, projeto_id, cliente, absorvido_por, motivo)
SELECT g.card_id, g.ghost, g.cliente, g.survivor, 'merge duplicados 08/09 (aprovado Will)'
  FROM ghost_info g WHERE g.card_id IS NOT NULL
ON CONFLICT (card_id) DO NOTHING;

INSERT INTO gestao.projetos_excluidos (card_id, projeto_id, cliente, absorvido_por, motivo)
SELECT p.card_id, p.id, p.cliente, NULL, 'stub generico vazio removido 08/09'
  FROM gestao.projetos p JOIN stub_del s ON s.ghost = p.id
 WHERE p.card_id IS NOT NULL
ON CONFLICT (card_id) DO NOTHING;

-- conteudo de teste dos stubs (crise xxxx, reuniao teste) fica so no backup
DELETE FROM gestao.crises        WHERE projeto_id IN (SELECT ghost FROM stub_del);
DELETE FROM gestao.reuniao_bloco WHERE projeto_id IN (SELECT ghost FROM stub_del);
DELETE FROM gestao.eventos       WHERE projeto_id IN (SELECT ghost FROM stub_del);

DELETE FROM gestao.projetos
 WHERE id IN (SELECT ghost FROM merge_map UNION SELECT ghost FROM stub_del);

-- ---------------------------------------------------------------
-- 9) Ajustes finais
-- ---------------------------------------------------------------
-- Bradesco bare = obra de Joao Pessoa (endereco identico); assume o nome
UPDATE gestao.projetos
   SET cliente = 'FUNDACAO BRADESCO - JOAO PESSOA - PB', updated_at = now()
 WHERE id::text LIKE 'bbdc47e8%';

-- projetos de teste ficam, mas carimbados (Will mantem testes vivos)
UPDATE gestao.projetos
   SET meta = coalesce(meta,'{}'::jsonb) || '{"teste": true}'::jsonb
 WHERE id::text LIKE ANY (ARRAY['36381c77%','9f164b13%','388f29f7%','a3d38aa0%']);

-- resumo
SELECT 'projetos restantes: '||count(*) FROM gestao.projetos;
SELECT 'tombstones: '||count(*) FROM gestao.projetos_excluidos;
SELECT 'itens orfaos (deve ser 0): '||count(*) FROM gestao.itens i
 WHERE NOT EXISTS (SELECT 1 FROM gestao.projetos p WHERE p.id = i.projeto_id);

COMMIT;
