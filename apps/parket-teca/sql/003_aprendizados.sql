-- Wave 3.8 — Sessão de Aprendizado por App
-- Cada app da Parket vira um bucket. Registra erros, acertos, melhorias e
-- padrões repetitivos (candidatos a automação/IA).

CREATE TABLE IF NOT EXISTS teca.aprendizados (
    id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    app           text NOT NULL,                     -- 'valoria' | 'draw' | 'status' | ...
    categoria     text NOT NULL,                     -- 'erro' | 'acerto' | 'melhoria' | 'automacao' | 'padrao_repetitivo'
    titulo        text NOT NULL,
    descricao     text,                              -- markdown livre
    contexto      jsonb DEFAULT '{}'::jsonb,         -- user_email, route, screenshot, timestamps, refs
    fonte         text DEFAULT 'user_report',        -- 'user_report' | 'observado_ia' | 'log_agregado' | 'proposto_ai'
    prioridade    text DEFAULT 'media',              -- 'baixa' | 'media' | 'alta' | 'critica'
    status        text DEFAULT 'aberto',             -- 'aberto' | 'em_analise' | 'automatizado' | 'implementado' | 'descartado'
    tags          text[] DEFAULT '{}',
    autor_email   text,
    embedding     vector(384),
    created_at    timestamptz DEFAULT now(),
    updated_at    timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_teca_aprend_app        ON teca.aprendizados(app);
CREATE INDEX IF NOT EXISTS idx_teca_aprend_categoria  ON teca.aprendizados(categoria);
CREATE INDEX IF NOT EXISTS idx_teca_aprend_status     ON teca.aprendizados(status);
CREATE INDEX IF NOT EXISTS idx_teca_aprend_app_cat    ON teca.aprendizados(app, categoria, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_teca_aprend_tags       ON teca.aprendizados USING gin(tags);
CREATE INDEX IF NOT EXISTS idx_teca_aprend_embed
    ON teca.aprendizados USING ivfflat (embedding vector_cosine_ops) WITH (lists = 50);

-- Reusa trigger _touch já criada em 001
DROP TRIGGER IF EXISTS trg_teca_aprend_touch ON teca.aprendizados;
CREATE TRIGGER trg_teca_aprend_touch BEFORE UPDATE ON teca.aprendizados
FOR EACH ROW EXECUTE FUNCTION teca._touch();

-- Emite NOTIFY quando muda pra invalidar cache e re-indexar no RAG
CREATE OR REPLACE FUNCTION teca._notify_aprendizado_change() RETURNS trigger AS $$
DECLARE
    payload text;
    aid uuid;
BEGIN
    aid := COALESCE(NEW.id, OLD.id);
    payload := json_build_object(
        'op', TG_OP, 'table', 'aprendizados', 'id', aid,
        'app', COALESCE(NEW.app, OLD.app)
    )::text;
    PERFORM pg_notify('teca_graph_change', payload);
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_teca_aprend_notify ON teca.aprendizados;
CREATE TRIGGER trg_teca_aprend_notify
AFTER INSERT OR UPDATE OR DELETE ON teca.aprendizados
FOR EACH ROW EXECUTE FUNCTION teca._notify_aprendizado_change();

GRANT SELECT ON teca.aprendizados TO teca_reader;

-- Seeds iniciais pros 3 primeiros apps (opcional; deixa exemplos concretos)
INSERT INTO teca.aprendizados (app, categoria, titulo, descricao, fonte, prioridade, tags)
VALUES
  ('valoria', 'melhoria', 'Catálogo Valoria precisa lembrar especie_id/dimensao_id',
   'Import F1 trouxe nomes mas perdeu FK — hoje useCatalogo usa chave sintética "name:"/"label:". Persistir espécie/dimensão no banco resolveria consultas cruzadas.',
   'observado_ia', 'media', ARRAY['catalogo','fk','import']),
  ('draw', 'padrao_repetitivo', 'Usuário sempre configura mesma linhagem de layers ao abrir projeto novo',
   'Padrão observado: ao criar projeto, usuário passa 30s+ configurando layers/estilos idênticos. Candidato a template default por tipo de obra.',
   'observado_ia', 'alta', ARRAY['layers','template','onboarding']),
  ('status', 'melhoria', 'Vincular quantitativos direto à Valoria (roadmap Will 30/06)',
   'Próxima fase: Status quantifica m²/ml/un e envia lista pra valor.parket.works. Tag rollback stable-status-pre-quantitativos-20260630.',
   'user_report', 'alta', ARRAY['integracao','valoria'])
ON CONFLICT DO NOTHING;
