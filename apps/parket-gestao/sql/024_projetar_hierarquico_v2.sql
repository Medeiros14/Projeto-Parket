-- ═══════════════════════════════════════════════════════════════════════
-- 024 — projetar_de_proposta v2: SEMPRE hierárquico (Will 02/09)
--
-- QUE FAZ: "insumos e instalação NÃO são itens". A função instalada tinha
-- virado cópia crua (1 linha do gestao.itens por linha da sim: produto,
-- insumos e instalação separados) quando ganhou suporte a aditivo — isso
-- violou o padrão do 004_projetar_hierarquico (1 item por AMBIENTE que
-- agrega PRODUTO+INSUMOS+INSTALAÇÃO, meta.produto_header, quantidade em m²).
--
-- Este arquivo:
--   1) cria gestao.itens_hierarquicos_de_sim(projeto, sim, aditivo):
--      núcleo compartilhado que insere os itens agregados por ambiente
--      (bloco = ordem/10 da sim, mesmo agrupamento do renderer da proposta),
--      expande recortes __RECDATA__ em sub-itens N.M.K e cria as linhas de
--      item_etapa_status. Aditivo: ordem deslocada + meta.eh_aditivo=true +
--      código preferindo meta.numero_display calculado no Valor.
--   2) reescreve gestao.projetar_de_proposta usando o núcleo nos DOIS
--      caminhos (projeto novo e aditivo appendado no projeto pai).
--
-- Melhorias sobre o 004 preservando o padrão:
--   • meta da linha PRODUTO da sim é PRESERVADA como base (subtipo, espécie,
--     etc. que o PCP usa) e as chaves derivadas entram por cima;
--   • quantidade cai pra meta.quantidade quando não há "Metragem real" no
--     descritivo (porta em UN); unidade idem;
--   • subtipo de FORRO derivado por keyword quando falta (FORRO_SUB_PRODUCAO
--     do watcher do PCP, mesmo critério do backfill 02/09).
-- ═══════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION gestao.itens_hierarquicos_de_sim(
  p_projeto_id   uuid,
  p_simulacao_id uuid,
  p_aditivo      boolean DEFAULT false
) RETURNS integer AS $$
DECLARE
  v_base  integer := 0;   -- deslocamento de ordem pra aditivo sair depois dos originais
  v_count integer := 0;
BEGIN
  IF p_aditivo THEN
    SELECT COALESCE(MAX(ordem), 0) + 1000 INTO v_base
      FROM gestao.itens WHERE projeto_id = p_projeto_id;
  END IF;

  -- ─── AGRUPA POR AMBIENTE E INSERE 1 ITEM POR BLOCO ────────────────────
  WITH itens_extraidos AS (
    SELECT
      i.id AS sim_item_id,
      i.categoria AS cat_encoded,
      i.descritivo,
      i.valor,
      i.ordem,
      i.meta,
      -- Bloco = intervalos de 10 na ordem: 10-19 = ambiente A, 20-29 = B...
      (i.ordem / 10) AS bloco_ordem,
      CASE
        WHEN i.descritivo ILIKE 'INSUMOS%'                    THEN 'insumos'
        WHEN i.descritivo ILIKE 'INSTALAÇÃO E GEST%'
          OR i.descritivo ILIKE 'INSTALACAO E GEST%'
          OR i.descritivo ILIKE 'INSTALAÇÃO%'                 THEN 'instalacao'
        ELSE 'produto'
      END AS tipo_linha
    FROM public.simulacao_itens i
    WHERE i.simulacao_id = p_simulacao_id
  ),
  agrupado AS (
    SELECT
      cat_encoded,
      bloco_ordem,
      MIN(ordem) AS ordem_minima,
      MAX(CASE WHEN tipo_linha = 'produto'    THEN descritivo END) AS descr_produto,
      MAX(CASE WHEN tipo_linha = 'instalacao' THEN descritivo END) AS descr_instalacao,
      SUM(CASE WHEN tipo_linha = 'produto'    THEN valor ELSE 0 END) AS valor_produto,
      SUM(CASE WHEN tipo_linha = 'insumos'    THEN valor ELSE 0 END) AS valor_insumos,
      SUM(CASE WHEN tipo_linha = 'instalacao' THEN valor ELSE 0 END) AS valor_instalacao,
      MAX(CASE WHEN tipo_linha = 'produto'    THEN sim_item_id::text END)::uuid AS sim_item_produto_id,
      -- meta da linha PRODUTO (base preservada; array_agg porque jsonb não tem MAX)
      (array_agg(meta ORDER BY CASE tipo_linha WHEN 'produto' THEN 0 ELSE 1 END, ordem))[1] AS meta_produto
    FROM itens_extraidos
    GROUP BY cat_encoded, bloco_ordem
  ),
  numerado AS (
    SELECT
      *,
      -- Raiz N = ordem canônica das categorias do renderer da proposta
      DENSE_RANK() OVER (ORDER BY
        CASE UPPER(split_part(cat_encoded, '||', 1))
          WHEN 'PISO'      THEN 1
          WHEN 'PAINEL'    THEN 2
          WHEN 'FORRO'     THEN 3
          WHEN 'DECK'      THEN 4
          WHEN 'PORTA'     THEN 5
          WHEN 'ESCADA'    THEN 6
          WHEN 'LOGISTICA' THEN 7
          WHEN 'LOGÍSTICA' THEN 7
          WHEN 'COMPRAS'   THEN 8
          WHEN 'INSUMOS'   THEN 9
          ELSE 100
        END,
        split_part(cat_encoded, '||', 1)) AS raiz_n,
      ROW_NUMBER() OVER (PARTITION BY cat_encoded ORDER BY ordem_minima) AS sub_m
    FROM agrupado
  ),
  final AS (
    SELECT
      *,
      -- Código: aditivo preferindo numero_display já calculado no Valor
      -- (continuação da numeração da sim pai); senão N.M local.
      CASE WHEN p_aditivo
           THEN COALESCE(NULLIF(meta_produto->>'numero_display', ''),
                         raiz_n::text || '.' || sub_m::text)
           ELSE raiz_n::text || '.' || sub_m::text
      END AS codigo,
      NULLIF(TRIM(
        COALESCE(NULLIF(split_part(cat_encoded, '||', 2), ''), '') ||
        CASE WHEN COALESCE(NULLIF(split_part(cat_encoded, '||', 3), ''), '') <> ''
             THEN ' · ' || split_part(cat_encoded, '||', 3) ELSE '' END
      ), '') AS prod_header,
      -- Metragem real / com perda / perda% extraídas do descritivo
      NULLIF(regexp_replace(COALESCE(
        (regexp_match(descr_instalacao, 'Metragem\s+real\s+([\d.,]+)\s*m'))[1],
        (regexp_match(descr_produto,    'Metragem\s+real\s+([\d.,]+)\s*m'))[1]
      ), ',', '.', 'g'), '') AS mreal,
      NULLIF(regexp_replace(COALESCE(
        (regexp_match(descr_instalacao, '=\s*([\d.,]+)\s*m'))[1],
        (regexp_match(descr_produto,    '=\s*([\d.,]+)\s*m'))[1]
      ), ',', '.', 'g'), '') AS mperda,
      NULLIF(regexp_replace(COALESCE(
        (regexp_match(descr_instalacao, '\+\s*([\d.,]+)\s*%'))[1],
        (regexp_match(descr_produto,    '\+\s*([\d.,]+)\s*%'))[1]
      ), ',', '.', 'g'), '') AS ppct
    FROM numerado
  ),
  ins AS (
    INSERT INTO gestao.itens (
      projeto_id, simulacao_item_id, ordem, categoria, descritivo, ambiente,
      quantidade, unidade, valor_unit, valor_total, meta
    )
    SELECT
      p_projeto_id,
      sim_item_produto_id,
      v_base + (raiz_n * 100 + sub_m) AS ordem,
      split_part(cat_encoded, '||', 1) AS categoria,
      -- descritivo canônico "COD · CATEGORIA ESPECIE · DIM"
      (codigo || ' · ' || split_part(cat_encoded, '||', 1) ||
        COALESCE(' ' || prod_header, '')) AS descritivo,
      NULLIF(TRIM(SPLIT_PART(COALESCE(descr_produto, descr_instalacao, ''), E'\n', 1)), '') AS ambiente,
      -- quantidade: metragem real; senão meta.quantidade da sim (porta UN); senão 0
      COALESCE(NULLIF(mreal::numeric, 0), (meta_produto->>'quantidade')::numeric, 0) AS quantidade,
      CASE WHEN mreal IS NOT NULL THEN 'm²'
           ELSE COALESCE(meta_produto->>'unidade', 'm²') END AS unidade,
      0 AS valor_unit,
      (valor_produto + valor_insumos + valor_instalacao) AS valor_total,
      COALESCE(meta_produto, '{}'::jsonb)
        || jsonb_build_object(
             'codigo',              codigo,
             'raiz',                raiz_n::text,
             'produto_header',      prod_header,
             'categoria_raiz',      split_part(cat_encoded, '||', 1),
             'metragem_real',       mreal,
             'metragem_com_perda',  mperda,
             'perda_pct',           ppct,
             'valor_produto',       valor_produto,
             'valor_insumos',       valor_insumos,
             'valor_instalacao',    valor_instalacao,
             'categoria_encoded',   cat_encoded,
             'descritivo_original', COALESCE(descr_produto, descr_instalacao, ''),
             'so_material',         (COALESCE(valor_insumos,0) = 0 AND COALESCE(valor_instalacao,0) = 0)
           )
        -- subtipo de FORRO por keyword quando a sim não trouxe (PCP classifica por ele)
        || CASE WHEN split_part(cat_encoded, '||', 1) = 'FORRO'
                 AND NOT (COALESCE(meta_produto, '{}'::jsonb) ? 'subtipo')
                 AND lower(unaccent(COALESCE(descr_produto, '')))
                     ~ '(toblerone|muxarabi|ripado|lamin|macico|regua|recorte)'
           THEN jsonb_build_object('subtipo',
                CASE WHEN lower(unaccent(descr_produto)) ~ 'toblerone' THEN 'toblerone'
                     WHEN lower(unaccent(descr_produto)) ~ 'muxarabi'  THEN 'muxarabi'
                     WHEN lower(unaccent(descr_produto)) ~ 'ripado'    THEN 'ripado'
                     WHEN lower(unaccent(descr_produto)) ~ 'lamin'     THEN 'laminado'
                     WHEN lower(unaccent(descr_produto)) ~ 'macico'    THEN 'macico'
                     WHEN lower(unaccent(descr_produto)) ~ 'regua'     THEN 'regua'
                     ELSE 'recortes' END)
           ELSE '{}'::jsonb END
        || CASE WHEN p_aditivo THEN jsonb_build_object('eh_aditivo', true)
           ELSE '{}'::jsonb END
    FROM final
    RETURNING id
  )
  SELECT COUNT(*) INTO v_count FROM ins;

  -- ─── EXPANDE RECORTES __RECDATA__ EM SUB-ITENS N.M.K ──────────────────
  UPDATE gestao.itens i
     SET meta = i.meta
                 || jsonb_build_object(
                      'is_recorte_agregado', true,
                      'recortes',
                      (SELECT jsonb_agg(
                        jsonb_build_object(
                          'nome', v->>'nome', 'qtd', v->>'qtd',
                          'unidade', v->>'u', 'preco_unit', v->>'p')
                        ORDER BY v->>'nome')
                       FROM jsonb_each((regexp_match(i.meta->>'descritivo_original',
                                                    '__RECDATA__:(\{.+\})'))[1]::jsonb)
                            AS je(key, v))
                    )
   WHERE i.projeto_id = p_projeto_id
     AND NOT (i.meta ? 'is_recorte_agregado')
     AND (i.meta->>'descritivo_original') ILIKE '%\_\_RECDATA\_\_%' ESCAPE '\';

  WITH pais AS (
    SELECT id AS parent_id, projeto_id, ordem AS parent_ordem, categoria,
           -- ambiente do pai (ex "RECORTES") herdado pelos sub-itens; sem isso
           -- a Central do Cliente e o gestão mostram o recorte sem ambiente
           ambiente AS parent_ambiente,
           meta->>'codigo' AS parent_cod,
           meta->>'raiz' AS raiz,
           meta->>'categoria_raiz' AS cat_raiz,
           meta->>'produto_header' AS prod_header,
           meta->>'categoria_encoded' AS cat_encoded,
           (regexp_match(meta->>'descritivo_original', '__RECDATA__:(\{.+\})'))[1]::jsonb AS recdata
      FROM gestao.itens gi
     WHERE gi.projeto_id = p_projeto_id
       AND (gi.meta->>'is_recorte_agregado')::boolean IS TRUE
       -- só pais ainda não expandidos (não há filho com parent_codigo = codigo)
       AND NOT EXISTS (
         SELECT 1 FROM gestao.itens f
          WHERE f.projeto_id = p_projeto_id
            AND f.meta->>'parent_codigo' = gi.meta->>'codigo')
  ),
  expandido AS (
    SELECT p.*, je.value AS rec,
           ROW_NUMBER() OVER (PARTITION BY p.parent_id ORDER BY (je.value->>'nome')) AS rec_idx
      FROM pais p
      CROSS JOIN LATERAL jsonb_each(p.recdata) AS je(key, value)
  )
  INSERT INTO gestao.itens (
    projeto_id, ordem, categoria, descritivo, ambiente,
    quantidade, unidade, valor_unit, valor_total, meta
  )
  SELECT
    projeto_id,
    parent_ordem + rec_idx,
    categoria,
    parent_cod || '.' || rec_idx::text || ' · ' || (rec->>'nome'),
    parent_ambiente,
    COALESCE((rec->>'qtd')::numeric, 0),
    LOWER(COALESCE(rec->>'u', 'un')),
    COALESCE((rec->>'p')::numeric, 0),
    COALESCE((rec->>'p')::numeric, 0) * COALESCE((rec->>'qtd')::numeric, 0),
    jsonb_build_object(
      'codigo',            parent_cod || '.' || rec_idx::text,
      'raiz',              raiz,
      'categoria_raiz',    cat_raiz,
      'produto_header',    prod_header,
      'categoria_encoded', cat_encoded,
      'is_recorte',        true,
      'parent_codigo',     parent_cod
    )
  FROM expandido;

  -- ─── item_etapa_status pra todo item do projeto que ainda não tem ─────
  INSERT INTO gestao.item_etapa_status (item_id, etapa_numero, status)
  SELECT i.id, e.numero, 'pendente'
    FROM gestao.itens i
   CROSS JOIN gestao.etapas_catalogo e
   WHERE i.projeto_id = p_projeto_id
  ON CONFLICT DO NOTHING;

  RETURN v_count;
END;
$$ LANGUAGE plpgsql;


-- ─── projetar_de_proposta v2: hierárquico nos dois caminhos ─────────────
CREATE OR REPLACE FUNCTION gestao.projetar_de_proposta(
  p_simulacao_id uuid,
  p_contrato_id  uuid DEFAULT NULL,
  p_gestor_email text DEFAULT NULL
) RETURNS uuid AS $$
DECLARE
  v_projeto_id uuid;
  v_prop record;
  v_column_id text := 'entrada';
  v_n integer;
BEGIN
  SELECT * INTO v_prop FROM public.simulacao_projetos WHERE id = p_simulacao_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'simulacao_projetos % not found', p_simulacao_id;
  END IF;

  -- Idempotente: se já existe projeto pra essa proposta, só atualiza gestor/contrato
  SELECT id INTO v_projeto_id FROM gestao.projetos WHERE simulacao_id = p_simulacao_id;
  IF v_projeto_id IS NOT NULL THEN
    UPDATE gestao.projetos
       SET contrato_id  = COALESCE(p_contrato_id, contrato_id),
           gestor_email = COALESCE(p_gestor_email, gestor_email)
     WHERE id = v_projeto_id;
    RETURN v_projeto_id;
  END IF;

  -- ADITIVO: obra é uma só — acha o projeto pai pelo card_id e appenda os
  -- itens do aditivo (agregados por ambiente, meta.eh_aditivo=true).
  IF (v_prop.meta ? 'eh_aditivo') AND (v_prop.meta->>'eh_aditivo')::boolean IS TRUE THEN
    SELECT id INTO v_projeto_id FROM gestao.projetos
     WHERE card_id = v_prop.card_id
     ORDER BY created_at ASC LIMIT 1;
    IF v_projeto_id IS NOT NULL THEN
      v_n := gestao.itens_hierarquicos_de_sim(v_projeto_id, p_simulacao_id, true);
      INSERT INTO gestao.eventos (projeto_id, tipo, titulo, descricao, autor_email, payload)
      VALUES (
        v_projeto_id, 'aditivo', 'Aditivo assinado',
        format('%s itens do aditivo adicionados (agregados por ambiente)', v_n),
        p_gestor_email,
        jsonb_build_object('aditivo_simulacao_id', p_simulacao_id, 'contrato_id', p_contrato_id)
      );
      RETURN v_projeto_id;
    END IF;
  END IF;

  -- Se o card já está em coluna do operacional, herda
  IF v_prop.card_id IS NOT NULL THEN
    SELECT column_id INTO v_column_id
      FROM public.kanban_cards
     WHERE id = v_prop.card_id AND dept_id = 'operacional'
     LIMIT 1;
    v_column_id := COALESCE(v_column_id, 'entrada');
  END IF;

  INSERT INTO gestao.projetos (
    simulacao_id, card_id, contrato_id, numero_proposta, cliente, cnpj_cpf,
    endereco, obra_code, vendedor, arquiteto, orcamentista, gestor_email,
    valor_total, status, column_id, assinado_em
  ) VALUES (
    v_prop.id, v_prop.card_id, p_contrato_id,
    v_prop.numero, COALESCE(v_prop.cliente, 'Cliente'), v_prop.cnpj_cpf,
    v_prop.endereco, v_prop.obra_code, v_prop.vendedor, v_prop.arquiteto,
    v_prop.orcamentista, p_gestor_email,
    COALESCE((SELECT SUM(valor) FROM public.simulacao_itens WHERE simulacao_id = v_prop.id), 0),
    'novo', v_column_id,
    CASE WHEN p_contrato_id IS NOT NULL THEN now() ELSE NULL END
  ) RETURNING id INTO v_projeto_id;

  v_n := gestao.itens_hierarquicos_de_sim(v_projeto_id, p_simulacao_id, false);

  INSERT INTO gestao.projeto_etapas (projeto_id, etapa_numero, status)
  SELECT v_projeto_id, numero, 'pendente' FROM gestao.etapas_catalogo
  ON CONFLICT DO NOTHING;

  INSERT INTO gestao.eventos (projeto_id, tipo, titulo, descricao, autor_email, payload)
  VALUES (
    v_projeto_id, 'criado', 'Projeto criado a partir da proposta',
    format('%s itens hierárquicos (raiz.sub) importados, coluna %s', v_n, v_column_id),
    p_gestor_email,
    jsonb_build_object(
      'simulacao_id', p_simulacao_id,
      'contrato_id',  p_contrato_id,
      'column_id',    v_column_id,
      'algoritmo',    'hierarquico:v2'
    )
  );

  RETURN v_projeto_id;
END;
$$ LANGUAGE plpgsql;
