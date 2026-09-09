-- Schema `gestao` — Gestor de Projetos Parket
-- Espelha do operacional (public.simulacao_projetos + simulacao_itens +
-- kanban_cards + contratos_docusign) mas trabalha ITEM-A-ITEM em vez
-- de metragem quadrada.
--
-- Fluxo: contrato assinado → RPC gestao.projetar_de_proposta() cria
-- gestao.projetos + copia gestao.itens da simulacao_itens.

CREATE SCHEMA IF NOT EXISTS gestao;

-- Reusa role teca_reader se existir; senão cria
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'gestao_rw') THEN
    CREATE ROLE gestao_rw LOGIN PASSWORD 'gestao_rw_pw_change_me';
  END IF;
END$$;

GRANT USAGE ON SCHEMA gestao TO gestao_rw;
GRANT ALL ON ALL TABLES IN SCHEMA gestao TO gestao_rw;
GRANT ALL ON ALL SEQUENCES IN SCHEMA gestao TO gestao_rw;
ALTER DEFAULT PRIVILEGES IN SCHEMA gestao GRANT ALL ON TABLES TO gestao_rw;
ALTER DEFAULT PRIVILEGES IN SCHEMA gestao GRANT ALL ON SEQUENCES TO gestao_rw;

-- ── touch trigger helper (idempotente) ──────────────────────
CREATE OR REPLACE FUNCTION gestao._touch() RETURNS trigger AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ── PROJETOS (mirror de simulacao_projetos ASSINADA) ────────
CREATE TABLE IF NOT EXISTS gestao.projetos (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  simulacao_id      uuid UNIQUE,                  -- 1 projeto por proposta assinada
  card_id           uuid,                          -- kanban_cards.id (operacional)
  contrato_id       uuid,                          -- contratos_docusign.id
  numero_proposta   text,
  cliente           text NOT NULL,
  cnpj_cpf          text,
  endereco          text,
  obra_code         text,
  vendedor          text,
  arquiteto         text,
  orcamentista      text,
  gestor_email      text,                          -- quem tá tocando o projeto
  valor_total       numeric(14,2) DEFAULT 0,
  status            text NOT NULL DEFAULT 'novo',  -- novo|em_execucao|pausado|entregue|cancelado
  etapa_atual       int  DEFAULT 1,                 -- 1..9 (checklist..avaliacao)
  assinado_em       timestamptz,
  iniciado_em       timestamptz,
  entregue_em       timestamptz,
  meta              jsonb DEFAULT '{}'::jsonb,
  created_at        timestamptz DEFAULT now(),
  updated_at        timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_gestao_projetos_cliente ON gestao.projetos(cliente);
CREATE INDEX IF NOT EXISTS idx_gestao_projetos_status  ON gestao.projetos(status);
CREATE INDEX IF NOT EXISTS idx_gestao_projetos_gestor  ON gestao.projetos(gestor_email);
DROP TRIGGER IF EXISTS trg_gestao_projetos_touch ON gestao.projetos;
CREATE TRIGGER trg_gestao_projetos_touch BEFORE UPDATE ON gestao.projetos
FOR EACH ROW EXECUTE FUNCTION gestao._touch();

-- ── ITENS (cópia de simulacao_itens, expandido pra execução) ─
CREATE TABLE IF NOT EXISTS gestao.itens (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  projeto_id        uuid NOT NULL REFERENCES gestao.projetos(id) ON DELETE CASCADE,
  simulacao_item_id uuid,                          -- rastreabilidade
  ordem             int NOT NULL DEFAULT 0,
  categoria         text NOT NULL,                 -- ex: PISO||CARVALHO...||dim
  descritivo        text NOT NULL,
  ambiente          text,                          -- Hall, Sala, Living... (preenchido no Draw)
  quantidade        numeric(14,3) DEFAULT 0,       -- m², ml, un
  unidade           text DEFAULT 'un',
  valor_unit        numeric(14,2) DEFAULT 0,
  valor_total       numeric(14,2) DEFAULT 0,
  status            text DEFAULT 'pendente',       -- pendente|preparando|em_execucao|instalado|entregue|com_ressalva|cancelado
  responsavel       text,
  previsao_inicio   date,
  previsao_fim      date,
  executado_em      timestamptz,
  observacoes       text,
  meta              jsonb DEFAULT '{}'::jsonb,
  created_at        timestamptz DEFAULT now(),
  updated_at        timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_gestao_itens_projeto  ON gestao.itens(projeto_id, ordem);
CREATE INDEX IF NOT EXISTS idx_gestao_itens_status   ON gestao.itens(status);
CREATE INDEX IF NOT EXISTS idx_gestao_itens_ambiente ON gestao.itens(projeto_id, ambiente);
DROP TRIGGER IF EXISTS trg_gestao_itens_touch ON gestao.itens;
CREATE TRIGGER trg_gestao_itens_touch BEFORE UPDATE ON gestao.itens
FOR EACH ROW EXECUTE FUNCTION gestao._touch();

-- ── ETAPAS (as 9 do Command Center; catálogo global) ────────
CREATE TABLE IF NOT EXISTS gestao.etapas_catalogo (
  numero       int PRIMARY KEY,                    -- 1..9
  slug         text NOT NULL UNIQUE,
  categoria    text NOT NULL,                     -- LIBERACAO | VISTORIA | PROJETO | ...
  titulo       text NOT NULL,
  subtitulo    text,
  descricao    text
);

INSERT INTO gestao.etapas_catalogo (numero, slug, categoria, titulo, subtitulo, descricao) VALUES
 (1, 'checklist',   'LIBERACAO',   'Checklist Técnico',       'Documento de liberação de obras',            'Validação de contrapiso, área livre, pisos frios, esquadrias, caçamba e umidade.'),
 (2, 'vistoria-1',  'VISTORIA',    '1ª Vistoria Técnica',     'Relatório de campo · primeira leitura',      'Primeira leitura técnica da obra, impedimentos e registros fotográficos.'),
 (3, 'vistoria-2',  'VISTORIA',    '2ª Vistoria Técnica',     'Reavaliação técnica',                        'Reavaliação técnica e definição das condições para avanço da primeira etapa.'),
 (4, 'mapeamento',  'PROJETO',     'Mapeamento e Paginação',  'Planta técnica de paginação',                'Paginação de piso por ambiente, transições, rodapé, elétrica e fixação.'),
 (5, 'cronograma',  'PRAZOS',      'Cronograma de Produção',  'Calendário de execução por ambiente',        'Datas de início/fim por ambiente, observações por etapa.'),
 (6, 'executivo',   'EXECUTIVO',   'Projeto Executivo',       'Base técnica final',                          'Base técnica final para execução, compatibilização e conferência.'),
 (7, 'execucao',    'EXECUCAO',    'Acompanhamento da Instalação','Evolução por ambiente',                  'Resumo da evolução, itens instalados, pendências e status por ambiente.'),
 (8, 'termo',       'FINALIZACAO', 'Termo de Entrega',        'Documento de encerramento formal',            'Validação da entrega, assinatura digital e encerramento formal.'),
 (9, 'avaliacao',   'CLIENTE',     'Avaliação da Experiência','Feedback da obra Parket',                     'Avaliação da entrega, atendimento e experiência geral.')
ON CONFLICT (numero) DO UPDATE SET
  slug = EXCLUDED.slug, categoria = EXCLUDED.categoria, titulo = EXCLUDED.titulo,
  subtitulo = EXCLUDED.subtitulo, descricao = EXCLUDED.descricao;

-- Status da etapa por projeto (1 linha por etapa)
CREATE TABLE IF NOT EXISTS gestao.projeto_etapas (
  projeto_id      uuid NOT NULL REFERENCES gestao.projetos(id) ON DELETE CASCADE,
  etapa_numero    int  NOT NULL REFERENCES gestao.etapas_catalogo(numero),
  status          text DEFAULT 'pendente',   -- pendente|em_andamento|concluida|com_ressalva|na
  responsavel     text,
  iniciada_em     timestamptz,
  concluida_em    timestamptz,
  observacoes     text,
  meta            jsonb DEFAULT '{}'::jsonb,
  updated_at      timestamptz DEFAULT now(),
  PRIMARY KEY (projeto_id, etapa_numero)
);
DROP TRIGGER IF EXISTS trg_gestao_petapas_touch ON gestao.projeto_etapas;
CREATE TRIGGER trg_gestao_petapas_touch BEFORE UPDATE ON gestao.projeto_etapas
FOR EACH ROW EXECUTE FUNCTION gestao._touch();

-- Ligação etapa × item (avança item-a-item DENTRO de cada etapa)
CREATE TABLE IF NOT EXISTS gestao.item_etapa_status (
  item_id       uuid NOT NULL REFERENCES gestao.itens(id) ON DELETE CASCADE,
  etapa_numero  int  NOT NULL REFERENCES gestao.etapas_catalogo(numero),
  status        text DEFAULT 'pendente',
  concluida_em  timestamptz,
  observacoes   text,
  meta          jsonb DEFAULT '{}'::jsonb,
  updated_at    timestamptz DEFAULT now(),
  PRIMARY KEY (item_id, etapa_numero)
);
DROP TRIGGER IF EXISTS trg_gestao_ietapa_touch ON gestao.item_etapa_status;
CREATE TRIGGER trg_gestao_ietapa_touch BEFORE UPDATE ON gestao.item_etapa_status
FOR EACH ROW EXECUTE FUNCTION gestao._touch();

-- ── EVENTOS (timeline do projeto) ───────────────────────────
CREATE TABLE IF NOT EXISTS gestao.eventos (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  projeto_id   uuid NOT NULL REFERENCES gestao.projetos(id) ON DELETE CASCADE,
  item_id      uuid REFERENCES gestao.itens(id) ON DELETE SET NULL,
  etapa_numero int REFERENCES gestao.etapas_catalogo(numero),
  tipo         text NOT NULL,                   -- criado|status_change|foto|observacao|pendencia|conclusao
  titulo       text NOT NULL,
  descricao    text,
  autor_email  text,
  payload      jsonb DEFAULT '{}'::jsonb,
  created_at   timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_gestao_eventos_projeto ON gestao.eventos(projeto_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_gestao_eventos_item    ON gestao.eventos(item_id);

-- ── DOCUMENTOS (checklist, relatórios de vistoria, mapeamento, termo) ─
CREATE TABLE IF NOT EXISTS gestao.documentos (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  projeto_id   uuid NOT NULL REFERENCES gestao.projetos(id) ON DELETE CASCADE,
  etapa_numero int REFERENCES gestao.etapas_catalogo(numero),
  slug         text NOT NULL,                       -- checklist|1-vistoria|2-vistoria|mapeamento|cronograma|projeto|termo
  titulo       text NOT NULL,
  arquivo_url  text,
  storage_path text,
  content_type text DEFAULT 'application/pdf',
  gerado_por   text,                               -- draw|manual|api
  meta         jsonb DEFAULT '{}'::jsonb,
  created_at   timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_gestao_doc_projeto ON gestao.documentos(projeto_id, etapa_numero);

-- ── FOTOS (registro fotográfico agrupado por item/ambiente) ─
CREATE TABLE IF NOT EXISTS gestao.fotos (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  projeto_id   uuid NOT NULL REFERENCES gestao.projetos(id) ON DELETE CASCADE,
  item_id      uuid REFERENCES gestao.itens(id) ON DELETE SET NULL,
  etapa_numero int REFERENCES gestao.etapas_catalogo(numero),
  url          text NOT NULL,
  legenda      text,
  autor_email  text,
  created_at   timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_gestao_fotos_projeto ON gestao.fotos(projeto_id, created_at DESC);

-- ── RPC: cria projeto a partir de uma proposta (idempotente) ─
-- Usa 1 proposta como fonte; se já existe projeto pra ela, NÃO refaz itens.
CREATE OR REPLACE FUNCTION gestao.projetar_de_proposta(
  p_simulacao_id uuid,
  p_contrato_id  uuid DEFAULT NULL,
  p_gestor_email text DEFAULT NULL
) RETURNS uuid AS $$
DECLARE
  v_projeto_id uuid;
  v_prop record;
  v_new_item_id uuid;
BEGIN
  SELECT * INTO v_prop FROM public.simulacao_projetos WHERE id = p_simulacao_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'simulacao_projetos % not found', p_simulacao_id;
  END IF;

  SELECT id INTO v_projeto_id FROM gestao.projetos WHERE simulacao_id = p_simulacao_id;
  IF v_projeto_id IS NOT NULL THEN
    -- Só atualiza gestor/contrato se vier novo
    UPDATE gestao.projetos
       SET contrato_id  = COALESCE(p_contrato_id, contrato_id),
           gestor_email = COALESCE(p_gestor_email, gestor_email)
     WHERE id = v_projeto_id;
    RETURN v_projeto_id;
  END IF;

  -- ADITIVO: se a sim é aditivo, o projeto na gestão foi criado pela sim PAI
  -- (que fechou primeiro). Aqui achamos o projeto pai pelo card_id e APPENDAMOS
  -- os itens do aditivo (marcados com meta.eh_aditivo=true + numero_display já
  -- calculado). NÃO cria novo projeto — obra é uma só.
  IF (v_prop.meta ? 'eh_aditivo') AND (v_prop.meta->>'eh_aditivo')::boolean IS TRUE THEN
    SELECT id INTO v_projeto_id FROM gestao.projetos
     WHERE card_id = v_prop.card_id
     ORDER BY created_at ASC LIMIT 1;
    IF v_projeto_id IS NOT NULL THEN
      DECLARE v_new_item_id2 uuid; v_row record;
      BEGIN
        FOR v_row IN
          SELECT * FROM public.simulacao_itens
          WHERE simulacao_id = p_simulacao_id ORDER BY ordem
        LOOP
          INSERT INTO gestao.itens (
            projeto_id, simulacao_item_id, ordem, categoria, descritivo,
            quantidade, unidade, valor_unit, valor_total, meta
          ) VALUES (
            v_projeto_id, v_row.id,
            -- ordem: shift pra sair sempre depois dos originais
            COALESCE((SELECT MAX(ordem) FROM gestao.itens WHERE projeto_id = v_projeto_id), 0) + 10 + v_row.ordem,
            v_row.categoria, v_row.descritivo,
            COALESCE((v_row.meta->>'quantidade')::numeric, 1),
            COALESCE(v_row.meta->>'unidade', 'un'),
            COALESCE((v_row.meta->>'preco')::numeric, v_row.valor),
            v_row.valor,
            -- garante eh_aditivo=true no meta gravado (numero_display já vem do Valor)
            COALESCE(v_row.meta, '{}'::jsonb) || jsonb_build_object('eh_aditivo', true)
          ) RETURNING id INTO v_new_item_id2;
          INSERT INTO gestao.item_etapa_status (item_id, etapa_numero, status)
          SELECT v_new_item_id2, numero, 'pendente' FROM gestao.etapas_catalogo;
        END LOOP;
      END;
      INSERT INTO gestao.eventos (projeto_id, tipo, titulo, descricao, autor_email, payload)
      VALUES (
        v_projeto_id, 'aditivo', 'Aditivo assinado',
        format('%s itens do aditivo adicionados', (SELECT COUNT(*) FROM public.simulacao_itens WHERE simulacao_id = p_simulacao_id)),
        p_gestor_email,
        jsonb_build_object('aditivo_simulacao_id', p_simulacao_id, 'contrato_id', p_contrato_id)
      );
      RETURN v_projeto_id;
    END IF;
  END IF;

  INSERT INTO gestao.projetos (
    simulacao_id, card_id, contrato_id, numero_proposta, cliente, cnpj_cpf,
    endereco, obra_code, vendedor, arquiteto, orcamentista, gestor_email,
    valor_total, status, assinado_em
  ) VALUES (
    v_prop.id, v_prop.card_id, p_contrato_id,
    v_prop.numero, COALESCE(v_prop.cliente, 'Cliente'), v_prop.cnpj_cpf,
    v_prop.endereco, v_prop.obra_code, v_prop.vendedor, v_prop.arquiteto,
    v_prop.orcamentista, p_gestor_email,
    COALESCE((SELECT SUM(valor) FROM public.simulacao_itens WHERE simulacao_id = v_prop.id), 0),
    'novo', CASE WHEN p_contrato_id IS NOT NULL THEN now() ELSE NULL END
  ) RETURNING id INTO v_projeto_id;

  -- Copia itens (todos, mesmo insumos/instalação — user filtra na UI se quiser)
  FOR v_prop IN
    SELECT * FROM public.simulacao_itens
    WHERE simulacao_id = p_simulacao_id ORDER BY ordem
  LOOP
    INSERT INTO gestao.itens (
      projeto_id, simulacao_item_id, ordem, categoria, descritivo,
      quantidade, unidade, valor_unit, valor_total, meta
    ) VALUES (
      v_projeto_id, v_prop.id, v_prop.ordem, v_prop.categoria, v_prop.descritivo,
      COALESCE((v_prop.meta->>'quantidade')::numeric, 1),
      COALESCE(v_prop.meta->>'unidade', 'un'),
      COALESCE((v_prop.meta->>'preco')::numeric, v_prop.valor),
      v_prop.valor,
      COALESCE(v_prop.meta, '{}'::jsonb)
    ) RETURNING id INTO v_new_item_id;

    -- Cria linhas em item_etapa_status pra cada etapa
    INSERT INTO gestao.item_etapa_status (item_id, etapa_numero, status)
    SELECT v_new_item_id, numero, 'pendente' FROM gestao.etapas_catalogo;
  END LOOP;

  -- Cria projeto_etapas (9 linhas, pendentes)
  INSERT INTO gestao.projeto_etapas (projeto_id, etapa_numero, status)
  SELECT v_projeto_id, numero, 'pendente' FROM gestao.etapas_catalogo
  ON CONFLICT DO NOTHING;

  -- Timeline
  INSERT INTO gestao.eventos (projeto_id, tipo, titulo, descricao, autor_email, payload)
  VALUES (
    v_projeto_id, 'criado', 'Projeto criado a partir da proposta',
    format('%s itens copiados', (SELECT COUNT(*) FROM gestao.itens WHERE projeto_id = v_projeto_id)),
    p_gestor_email,
    jsonb_build_object('simulacao_id', p_simulacao_id, 'contrato_id', p_contrato_id)
  );

  RETURN v_projeto_id;
END;
$$ LANGUAGE plpgsql;

-- ── Trigger: quando contrato DocuSign vira 'assinado'/'completed', cria projeto ─
CREATE OR REPLACE FUNCTION gestao._on_contrato_assinado() RETURNS trigger AS $$
DECLARE
  v_sim_id uuid;
BEGIN
  -- Assinado quando status muda pra 'assinado' | 'completed' | 'signed'
  IF NEW.status = OLD.status THEN RETURN NEW; END IF;
  IF NEW.status NOT IN ('assinado', 'completed', 'signed', 'finalizado') THEN RETURN NEW; END IF;

  -- Descobre a simulação pelo card_id (contrato liga em card)
  SELECT id INTO v_sim_id FROM public.simulacao_projetos
   WHERE card_id = NEW.card_id OR card_comercial_id = NEW.card_id
   ORDER BY selected_at DESC NULLS LAST, created_at DESC
   LIMIT 1;

  IF v_sim_id IS NOT NULL THEN
    PERFORM gestao.projetar_de_proposta(v_sim_id, NEW.id, NULL);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_gestao_contrato_signed ON public.contratos_docusign;
CREATE TRIGGER trg_gestao_contrato_signed
AFTER UPDATE OF status ON public.contratos_docusign
FOR EACH ROW EXECUTE FUNCTION gestao._on_contrato_assinado();

-- ── Views agregadas úteis (progresso, contagem) ──────────────
CREATE OR REPLACE VIEW gestao.v_projeto_progresso AS
SELECT p.id AS projeto_id, p.cliente, p.status,
  COUNT(i.*) FILTER (WHERE i.status IN ('entregue', 'concluido'))       AS n_entregues,
  COUNT(i.*) FILTER (WHERE i.status IN ('em_execucao', 'em_andamento')) AS n_em_execucao,
  COUNT(i.*) FILTER (WHERE i.status = 'com_ressalva') AS n_com_ressalva,
  COUNT(i.*)                                          AS n_total,
  -- Ponderado pela quantidade: sobe com o registro diário do instalador
  -- (meta.obra.qtd_instalada), não só quando o item vira 'entregue'.
  CASE WHEN COUNT(i.*) FILTER (WHERE i.status != 'cancelado') = 0 THEN 0
       ELSE ROUND(100.0 *
         SUM(CASE WHEN i.status IN ('entregue', 'concluido') THEN COALESCE(NULLIF(i.quantidade, 0), 1)
                  WHEN COALESCE(i.quantidade, 0) > 0
                    THEN LEAST(COALESCE((i.meta->'obra'->>'qtd_instalada')::numeric, 0), i.quantidade)
                  ELSE 0 END) FILTER (WHERE i.status != 'cancelado')
         / SUM(COALESCE(NULLIF(i.quantidade, 0), 1)) FILTER (WHERE i.status != 'cancelado'), 1)
  END AS pct_completo
FROM gestao.projetos p
LEFT JOIN gestao.itens i ON i.projeto_id = p.id
GROUP BY p.id, p.cliente, p.status;
