-- ═══════════════════════════════════════════════════════════════════════
-- RPC gestao.projetar_de_proposta — versão hierárquica
--
-- Aplica a MESMA numeração e agrupamento da proposta pública (renderer
-- propostaRendererSpace35.js):
--   • Raiz N = cada `categoria` distinta (encoded PISO||especie||dim)
--   • Sub M  = cada AMBIENTE dentro da raiz (agrega PRODUTO+INSUMOS+INSTALAÇÃO)
--   • Código = "N.M" gravado em gestao.itens.meta.codigo
--
-- Também extrai metragem_real e metragem_com_perda do descritivo via regex
-- pra popular meta.metragem_real / meta.metragem_com_perda — mesmo formato
-- que o financeiro entrega no CSV manual.
--
-- Disparo automático permanece via trigger _on_contrato_assinado
-- (status → 'assinado'/'signed'/'completed'/'finalizado').
-- ═══════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION gestao.projetar_de_proposta(
  p_simulacao_id uuid,
  p_contrato_id  uuid DEFAULT NULL,
  p_gestor_email text DEFAULT NULL
) RETURNS uuid AS $$
DECLARE
  v_projeto_id uuid;
  v_prop record;
  v_column_id text := 'entrada';   -- coluna inicial: PMO/Produtividade
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

  -- ─── ITENS HIERÁRQUICOS ───────────────────────────────────────────────
  -- Cada categoria (encoded) = raiz N. Cada ambiente dentro da raiz = sub M.
  -- Um ambiente pode ter 1 a 3 linhas em simulacao_itens (PRODUTO, INSUMOS,
  -- INSTALAÇÃO). Agregamos os 3 em 1 gestao.itens.
  WITH itens_extraidos AS (
    SELECT
      i.id AS sim_item_id,
      i.categoria AS cat_encoded,
      i.descritivo,
      i.valor,
      i.ordem,
      -- Bloco = intervalos de 10 na ordem: 10-19 = ambiente A, 20-29 = ambiente B
      (i.ordem / 10) AS bloco_ordem,
      -- Tipo da linha: PRODUTO / INSUMOS / INSTALACAO
      CASE
        WHEN i.descritivo ILIKE 'INSUMOS%'                          THEN 'insumos'
        WHEN i.descritivo ILIKE 'INSTALAÇÃO E GEST%'
          OR i.descritivo ILIKE 'INSTALACAO E GEST%'
          OR i.descritivo ILIKE 'INSTALAÇÃO%'                       THEN 'instalacao'
        ELSE 'produto'
      END AS tipo_linha
    FROM public.simulacao_itens i
    WHERE i.simulacao_id = p_simulacao_id
  ),
  agrupado AS (
    -- Agrega 3 linhas de mesmo bloco (cat, bloco_ordem) em uma
    SELECT
      cat_encoded,
      bloco_ordem,
      MIN(ordem) AS ordem_minima,
      -- Descritivo do PRODUTO (ambiente + descrição da instalação)
      MAX(CASE WHEN tipo_linha = 'produto'    THEN descritivo END) AS descr_produto,
      MAX(CASE WHEN tipo_linha = 'instalacao' THEN descritivo END) AS descr_instalacao,
      -- Valores acumulados
      SUM(CASE WHEN tipo_linha = 'produto'    THEN valor ELSE 0 END) AS valor_produto,
      SUM(CASE WHEN tipo_linha = 'insumos'    THEN valor ELSE 0 END) AS valor_insumos,
      SUM(CASE WHEN tipo_linha = 'instalacao' THEN valor ELSE 0 END) AS valor_instalacao,
      -- ID do PRODUTO pra rastreabilidade
      MAX(CASE WHEN tipo_linha = 'produto'    THEN sim_item_id::text END)::uuid AS sim_item_produto_id
    FROM itens_extraidos
    GROUP BY cat_encoded, bloco_ordem
  ),
  numerado AS (
    SELECT
      *,
      -- Raiz N = ordem canônica _catOrder do renderer da proposta (PGSTRUCT35):
      -- PISO → PAINEL → FORRO → DECK → PORTA → ESCADA → LOGISTICA → COMPRAS → INSUMOS
      -- Categorias fora dessa lista vêm depois, ordem alfabética.
      DENSE_RANK() OVER (ORDER BY (
        SELECT
          CASE UPPER(split_part(a2.cat_encoded, '||', 1))
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
          END
        FROM agrupado a2 WHERE a2.cat_encoded = agrupado.cat_encoded LIMIT 1
      ), split_part(agrupado.cat_encoded, '||', 1)) AS raiz_n,
      -- Sub M = ordem dentro da categoria. Recortes (bloco_ordem alto) vão pro fim.
      ROW_NUMBER() OVER (PARTITION BY cat_encoded ORDER BY ordem_minima) AS sub_m
    FROM agrupado
  )
  INSERT INTO gestao.itens (
    projeto_id, simulacao_item_id, ordem, categoria, descritivo, ambiente,
    quantidade, unidade, valor_unit, valor_total, meta
  )
  SELECT
    v_projeto_id,
    sim_item_produto_id,
    (raiz_n * 100 + sub_m) AS ordem,   -- ordem estável pra list rendering
    split_part(cat_encoded, '||', 1) AS categoria,  -- só a categoria pura (PISO, FORRO...)
    -- descritivo canônico "N.M · CATEGORIA ESPECIE · DIM" (compatível c/ itemServicoLabel)
    (raiz_n::text || '.' || sub_m::text || ' · ' ||
      split_part(cat_encoded, '||', 1) || ' ' ||
      TRIM(
        COALESCE(NULLIF(split_part(cat_encoded, '||', 2), ''), '') ||
        CASE
          WHEN COALESCE(NULLIF(split_part(cat_encoded, '||', 3), ''), '') <> ''
          THEN ' · ' || split_part(cat_encoded, '||', 3)
          ELSE ''
        END
      )) AS descritivo,
    -- ambiente = primeira linha do descritivo original (ex: "TÉRREO - ACADEMIA")
    NULLIF(TRIM(SPLIT_PART(COALESCE(descr_produto, descr_instalacao, ''), E'\n', 1)), '') AS ambiente,
    -- quantidade = metragem_real extraída via regex
    COALESCE(
      NULLIF(regexp_replace(
        COALESCE(
          (regexp_match(descr_instalacao, 'Metragem\s+real\s+([\d.,]+)\s*m'))[1],
          (regexp_match(descr_produto,    'Metragem\s+real\s+([\d.,]+)\s*m'))[1],
          '0'
        ), ',', '.', 'g')::numeric,
        0
      ), 0
    ) AS quantidade,
    'm²' AS unidade,
    0 AS valor_unit,
    (valor_produto + valor_insumos + valor_instalacao) AS valor_total,
    jsonb_build_object(
      'codigo',              raiz_n::text || '.' || sub_m::text,
      'raiz',                raiz_n::text,
      -- produto_header = concatena partes 2 + 3 da categoria encoded (espécie + dim)
      'produto_header',      TRIM(
                               COALESCE(NULLIF(split_part(cat_encoded, '||', 2), ''), '') ||
                               CASE
                                 WHEN COALESCE(NULLIF(split_part(cat_encoded, '||', 3), ''), '') <> ''
                                 THEN ' · ' || split_part(cat_encoded, '||', 3)
                                 ELSE ''
                               END
                             ),
      'categoria_raiz',      split_part(cat_encoded, '||', 1),
      -- Metragem real (m²)
      'metragem_real',       NULLIF(regexp_replace(
                               COALESCE(
                                 (regexp_match(descr_instalacao, 'Metragem\s+real\s+([\d.,]+)\s*m'))[1],
                                 (regexp_match(descr_produto,    'Metragem\s+real\s+([\d.,]+)\s*m'))[1]
                               ), ',', '.', 'g'), ''),
      -- Metragem com perda (m²)
      'metragem_com_perda',  NULLIF(regexp_replace(
                               COALESCE(
                                 (regexp_match(descr_instalacao, '=\s*([\d.,]+)\s*m'))[1],
                                 (regexp_match(descr_produto,    '=\s*([\d.,]+)\s*m'))[1]
                               ), ',', '.', 'g'), ''),
      'perda_pct',           NULLIF(regexp_replace(
                               COALESCE(
                                 (regexp_match(descr_instalacao, '\+\s*([\d.,]+)\s*%'))[1],
                                 (regexp_match(descr_produto,    '\+\s*([\d.,]+)\s*%'))[1]
                               ), ',', '.', 'g'), ''),
      -- Valores desagregados pra auditoria
      'valor_produto',       valor_produto,
      'valor_insumos',       valor_insumos,
      'valor_instalacao',    valor_instalacao,
      -- Categoria encoded original
      'categoria_encoded',   cat_encoded,
      -- Descritivo cru (preserva recortes, obs, etc, pra o PDF de acompanhamento)
      'descritivo_original', COALESCE(descr_produto, descr_instalacao, ''),
      -- Flag SÓ MATERIAL: quando o bloco não tem linha INSUMOS nem INSTALAÇÃO
      -- (item de fornecimento puro, sem gestão de obras nem instalação da Parket).
      'so_material',         (COALESCE(valor_insumos,0) = 0 AND COALESCE(valor_instalacao,0) = 0)
    ) AS meta
  FROM numerado
  ORDER BY raiz_n, sub_m;

  -- ─── EXPANDE RECORTES EM SUB-ITENS ───────────────────────────────────
  -- O item pai (3.6 FORRO RECORTES) fica preservado — mesma numeração da
  -- proposta. Cada tipo de recorte vira um sub-item hierárquico "3.6.1",
  -- "3.6.2"... visível na tabela do Acompanhamento (o frontend já agrupa
  -- codes "N.M.K" como sub-grupo sob "N.M").
  UPDATE gestao.itens i
     SET meta = i.meta
                 || jsonb_build_object(
                      'is_recorte_agregado', true,
                      'recortes',
                      (SELECT jsonb_agg(
                        jsonb_build_object(
                          'nome', v->>'nome',
                          'qtd',  v->>'qtd',
                          'unidade', v->>'u',
                          'preco_unit', v->>'p'
                        )
                        ORDER BY v->>'nome')
                       FROM jsonb_each((regexp_match(i.meta->>'descritivo_original',
                                                    '__RECDATA__:(\{.+\})'))[1]::jsonb)
                            AS je(key, v))
                    )
   WHERE i.projeto_id = v_projeto_id
     AND (i.meta->>'descritivo_original') ILIKE '%\_\_RECDATA\_\_%' ESCAPE '\';

  WITH pais AS (
    SELECT id AS parent_id, projeto_id, ordem AS parent_ordem, categoria,
           meta->>'codigo' AS parent_cod,
           meta->>'raiz' AS raiz,
           meta->>'categoria_raiz' AS cat_raiz,
           meta->>'produto_header' AS prod_header,
           meta->>'categoria_encoded' AS cat_encoded,
           (regexp_match(meta->>'descritivo_original', '__RECDATA__:(\{.+\})'))[1]::jsonb AS recdata
      FROM gestao.itens
     WHERE projeto_id = v_projeto_id
       AND (meta->>'descritivo_original') ILIKE '%\_\_RECDATA\_\_%' ESCAPE '\'
  ),
  expandido AS (
    SELECT p.*,
           je.value AS rec,
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
    parent_cod || '.' || rec_idx::text || ' · ' || (rec->>'nome') AS descritivo,
    NULL AS ambiente,
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

  -- Cria linhas de projeto_etapas (9 pendentes) + item_etapa_status (9 pendentes por item)
  INSERT INTO gestao.projeto_etapas (projeto_id, etapa_numero, status)
  SELECT v_projeto_id, numero, 'pendente' FROM gestao.etapas_catalogo
  ON CONFLICT DO NOTHING;

  INSERT INTO gestao.item_etapa_status (item_id, etapa_numero, status)
  SELECT i.id, e.numero, 'pendente'
    FROM gestao.itens i
   CROSS JOIN gestao.etapas_catalogo e
   WHERE i.projeto_id = v_projeto_id
  ON CONFLICT DO NOTHING;

  -- Timeline
  INSERT INTO gestao.eventos (projeto_id, tipo, titulo, descricao, autor_email, payload)
  VALUES (
    v_projeto_id, 'criado', 'Projeto criado a partir da proposta',
    format('%s itens hierárquicos (raiz.sub) importados, coluna %s',
           (SELECT COUNT(*) FROM gestao.itens WHERE projeto_id = v_projeto_id),
           v_column_id),
    p_gestor_email,
    jsonb_build_object(
      'simulacao_id', p_simulacao_id,
      'contrato_id',  p_contrato_id,
      'column_id',    v_column_id,
      'algoritmo',    'hierarquico:v1'
    )
  );

  RETURN v_projeto_id;
END;
$$ LANGUAGE plpgsql;
