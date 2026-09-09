-- ============================================================
-- SOCIAL SELLING: import da planilha "Arquitetos Eng e Design"
-- (Will 01/09) — Google Sheets 1IMPtKEZBvJ2-WhB4ic9s9ov9P6EDZGMMPkLo156z18c
-- ============================================================
-- O QUÊ: sobe ~4.2k contatos (TOP1000 2024/2025, Levantamento
-- Showroom, Controle Arquitetos) pra coluna "base" do pipeline
-- social-aquisicao, 1 card por contato.
--
-- ONDE RODAR (IMPORTANTE): no PG LOCAL (parket-pg-local_postgres, psql -U postgres).
-- O frontend do HB le api.parket.works/rest/v1 -> rest-local -> PG LOCAL.
-- O Cloud hbx e so espelho; base subida so no Cloud NAO aparece na pagina
-- (incidente 01/09: kanban social vazio porque o import foi pro Cloud).
--
-- COMO RODAR (o CSV precisa estar DENTRO do container do psql):
--   curl -sL "https://docs.google.com/spreadsheets/d/<ID>/gviz/tq?tqx=out:csv&sheet=Arquitetos%20Eng%20e%20Design" -o /tmp/arquitetos_planilha.csv
--   L=$(docker ps -q -f name=parket-pg-local_postgres)
--   docker cp /tmp/arquitetos_planilha.csv "$L":/tmp/
--   docker exec -i "$L" psql -U postgres < sql/004_social_selling_planilha.sql
--
-- POR QUÊ idempotente: dedup no final por nome normalizado E por
-- telefone (11 últimos dígitos) contra TUDO que já existe nos 3
-- depts social-* — rodar de novo não duplica, e contato que o
-- Vinicius já promoveu pra Conexão/Ativação não volta pra base.
-- ============================================================

-- Staging espelhando as 13 colunas da planilha (tudo texto).
CREATE TEMP TABLE staging_planilha (
  nome_completo text, primeiro_nome text, sobrenome text, nome_arquitetura text,
  ocupacao text, telefone text, email text, cidade text, estado text, pais text,
  cep text, nascimento text, origem text
);

\copy staging_planilha FROM '/tmp/arquitetos_planilha.csv' CSV HEADER

WITH fonte AS (
  -- Normaliza espaços do nome e limpa campos vazios pra NULL.
  SELECT trim(regexp_replace(nome_completo, '\s+', ' ', 'g'))        AS nome,
         lower(trim(regexp_replace(nome_completo, '\s+', ' ', 'g'))) AS norm,
         nullif(trim(telefone), '')       AS telefone,
         nullif(lower(trim(email)), '')   AS email,
         nullif(trim(ocupacao), '')       AS ocupacao,
         nullif(trim(cidade), '')         AS cidade,
         nullif(trim(estado), '')         AS estado,
         nullif(trim(origem), '')         AS origem_lista,
         -- 11 últimos dígitos = chave de dedup por fone (DDD+numero)
         right(regexp_replace(coalesce(telefone, ''), '\D', '', 'g'), 11) AS fone_norm
    FROM staging_planilha
   WHERE length(coalesce(trim(nome_completo), '')) >= 4
     -- mesma blacklist do backfill 003 (lixo/placeholder)
     AND lower(trim(nome_completo)) NOT IN (
       'não tem','nao tem','sem arquiteto','nenhum','cliente',
       'proprio','próprio','parket','teste','n/a','none','null',
       'nao possui','não possui','sem','vários','varios'
     )
     AND trim(nome_completo) !~ '^[0-9() +\-.]+$'
),

-- 1 linha por contato (a planilha tem ~48 nomes repetidos):
-- display = variante mais longa, tel/email agregados de todas as linhas.
agg AS (
  SELECT norm,
         (array_agg(nome ORDER BY length(nome) DESC))[1] AS display,
         (array_agg(ocupacao)     FILTER (WHERE ocupacao     IS NOT NULL))[1] AS ocupacao,
         (array_agg(cidade)       FILTER (WHERE cidade       IS NOT NULL))[1] AS cidade,
         (array_agg(estado)       FILTER (WHERE estado       IS NOT NULL))[1] AS estado,
         (array_agg(origem_lista) FILTER (WHERE origem_lista IS NOT NULL))[1] AS origem_lista,
         jsonb_agg(DISTINCT telefone) FILTER (WHERE telefone IS NOT NULL)     AS telefones,
         jsonb_agg(DISTINCT email)    FILTER (WHERE email    IS NOT NULL)     AS emails,
         array_agg(DISTINCT fone_norm) FILTER (WHERE length(fone_norm) >= 8)  AS fones_norm
    FROM fonte
   GROUP BY norm
),

-- Tudo que já vive nos 3 pipelines: nome normalizado + fones (pra
-- não recriar quem entrou pelo backfill do HB ou por cadastro manual).
existentes AS (
  SELECT lower(trim(e.title)) AS norm,
         (SELECT array_agg(right(regexp_replace(t, '\D', '', 'g'), 11))
            FROM jsonb_array_elements_text(coalesce(e.details->'telefones', '[]'::jsonb)) AS t
           WHERE length(regexp_replace(t, '\D', '', 'g')) >= 8) AS fones
    FROM kanban_cards e
   WHERE e.dept_id IN ('social-aquisicao','social-conexao','social-ativacao')
)

INSERT INTO kanban_cards
       (dept_id, column_id, title, subtitle, tags, details, created_at, updated_at)
SELECT 'social-aquisicao',
       'base',
       a.display,
       coalesce(a.ocupacao, 'Arquiteto'),
       ARRAY[CASE
         WHEN a.ocupacao ILIKE 'engenheiro%' THEN 'engenheiro'
         WHEN a.ocupacao ILIKE 'design%'     THEN 'design'
         ELSE 'arquiteto'
       END],
       jsonb_build_object(
         'social_selling', true,
         'origem',         'planilha',                    -- de onde a base veio
         'origem_lista',   coalesce(a.origem_lista, ''),  -- TOP1000 2025 etc
         'telefones',      coalesce(a.telefones, '[]'::jsonb),
         'emails',         coalesce(a.emails,    '[]'::jsonb),
         'instagram',      '',                            -- preenchido pelo Vinicius
         'canal',          '',                            -- whatsapp | instagram | ambos
         'cidade',         coalesce(a.cidade, ''),
         'estado',         coalesce(a.estado, ''),
         'cards_origem',   '[]'::jsonb                    -- planilha não tem card do funil
       ),
       now(), now()
  FROM agg a
 WHERE NOT EXISTS (
         -- dedup por NOME ou por TELEFONE contra qualquer card social-*
         SELECT 1 FROM existentes e
          WHERE e.norm = a.norm
             OR (a.fones_norm IS NOT NULL AND e.fones IS NOT NULL
                 AND a.fones_norm && e.fones)
       );
