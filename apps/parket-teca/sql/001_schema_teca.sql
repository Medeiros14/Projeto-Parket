-- Núcleo Teca Parket — schema teca no parket-pg-local
-- Nós = tabelas, docs de memória, briefings, README, insights
-- Arestas = FK, tags, referências semânticas

CREATE SCHEMA IF NOT EXISTS teca;
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ─── Nós do grafo ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS teca.nodes (
    id           text PRIMARY KEY,
    kind         text NOT NULL,                -- 'table' | 'doc' | 'memory' | 'insight' | 'note' | 'app' | 'concept'
    title        text NOT NULL,
    body         text,
    schema_name  text,                         -- p/ nodes kind=table
    setor        text,                         -- setor Parket derivado
    meta         jsonb DEFAULT '{}'::jsonb,
    embedding    vector(384),                  -- multilingual-MiniLM
    created_at   timestamptz DEFAULT now(),
    updated_at   timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_teca_nodes_kind    ON teca.nodes(kind);
CREATE INDEX IF NOT EXISTS idx_teca_nodes_schema  ON teca.nodes(schema_name);
CREATE INDEX IF NOT EXISTS idx_teca_nodes_setor   ON teca.nodes(setor);
CREATE INDEX IF NOT EXISTS idx_teca_nodes_embed
    ON teca.nodes USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
CREATE INDEX IF NOT EXISTS idx_teca_nodes_title_trgm
    ON teca.nodes USING gin (title gin_trgm_ops);

-- ─── Arestas do grafo ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS teca.edges (
    id           bigserial PRIMARY KEY,
    src_id       text NOT NULL REFERENCES teca.nodes(id) ON DELETE CASCADE,
    dst_id       text NOT NULL REFERENCES teca.nodes(id) ON DELETE CASCADE,
    kind         text NOT NULL,                -- 'fk' | 'tag' | 'ref' | 'wikilink' | 'semantic'
    weight       real DEFAULT 1.0,
    meta         jsonb DEFAULT '{}'::jsonb,
    UNIQUE(src_id, dst_id, kind)
);

CREATE INDEX IF NOT EXISTS idx_teca_edges_src  ON teca.edges(src_id);
CREATE INDEX IF NOT EXISTS idx_teca_edges_dst  ON teca.edges(dst_id);
CREATE INDEX IF NOT EXISTS idx_teca_edges_kind ON teca.edges(kind);

-- ─── Notas markdown (second-brain) ────────────────────────────
CREATE TABLE IF NOT EXISTS teca.notas (
    id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    slug         text UNIQUE NOT NULL,
    titulo       text NOT NULL,
    conteudo_md  text NOT NULL DEFAULT '',
    tags         text[] DEFAULT '{}',
    autor_email  text,
    created_at   timestamptz DEFAULT now(),
    updated_at   timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_teca_notas_tags ON teca.notas USING gin(tags);

-- ─── Consultas registradas (histórico + telemetria) ───────────
CREATE TABLE IF NOT EXISTS teca.consultas (
    id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    usuario_email text,
    pergunta      text NOT NULL,
    resposta      text,
    node_ids      text[] DEFAULT '{}',
    modo          text,                        -- 'sql' | 'rag' | 'mix'
    latency_ms    integer,
    created_at    timestamptz DEFAULT now()
);

-- ─── Insights automáticos (cron) ──────────────────────────────
CREATE TABLE IF NOT EXISTS teca.insights (
    id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    slug         text NOT NULL,
    titulo       text NOT NULL,
    corpo        text,
    severidade   text DEFAULT 'info',          -- info | warn | crit
    setor        text,
    node_ids     text[] DEFAULT '{}',
    payload      jsonb DEFAULT '{}'::jsonb,
    created_at   timestamptz DEFAULT now(),
    dismissed_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_teca_insights_slug ON teca.insights(slug);
CREATE INDEX IF NOT EXISTS idx_teca_insights_ativas
    ON teca.insights(created_at DESC) WHERE dismissed_at IS NULL;

-- ─── Trigger updated_at ───────────────────────────────────────
CREATE OR REPLACE FUNCTION teca._touch() RETURNS trigger AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_teca_nodes_touch ON teca.nodes;
CREATE TRIGGER trg_teca_nodes_touch BEFORE UPDATE ON teca.nodes
FOR EACH ROW EXECUTE FUNCTION teca._touch();

DROP TRIGGER IF EXISTS trg_teca_notas_touch ON teca.notas;
CREATE TRIGGER trg_teca_notas_touch BEFORE UPDATE ON teca.notas
FOR EACH ROW EXECUTE FUNCTION teca._touch();

-- ─── Role read-only pra sandbox de SQL do LLM ─────────────────
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'teca_reader') THEN
        CREATE ROLE teca_reader NOLOGIN;
    END IF;
END $$;

GRANT USAGE ON SCHEMA public, rh, core, erp, orcamento_produtos, teca TO teca_reader;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO teca_reader;
GRANT SELECT ON ALL TABLES IN SCHEMA rh TO teca_reader;
GRANT SELECT ON ALL TABLES IN SCHEMA core TO teca_reader;
GRANT SELECT ON ALL TABLES IN SCHEMA erp TO teca_reader;
GRANT SELECT ON ALL TABLES IN SCHEMA orcamento_produtos TO teca_reader;
GRANT SELECT ON ALL TABLES IN SCHEMA teca TO teca_reader;
ALTER DEFAULT PRIVILEGES IN SCHEMA public              GRANT SELECT ON TABLES TO teca_reader;
ALTER DEFAULT PRIVILEGES IN SCHEMA rh                  GRANT SELECT ON TABLES TO teca_reader;
ALTER DEFAULT PRIVILEGES IN SCHEMA core                GRANT SELECT ON TABLES TO teca_reader;
ALTER DEFAULT PRIVILEGES IN SCHEMA erp                 GRANT SELECT ON TABLES TO teca_reader;
ALTER DEFAULT PRIVILEGES IN SCHEMA orcamento_produtos  GRANT SELECT ON TABLES TO teca_reader;
