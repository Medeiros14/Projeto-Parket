-- Overrides de instructions dos agentes (hot-reload, sem restart).
-- Linha presente = override ativo. Linha ausente = usa instructions base do código.

CREATE TABLE IF NOT EXISTS eas.agent_overrides (
    agent_id     text PRIMARY KEY,
    instructions text NOT NULL,
    note         text,
    updated_at   timestamptz NOT NULL DEFAULT now(),
    updated_by   text NOT NULL DEFAULT 'will'
);

CREATE INDEX IF NOT EXISTS agent_overrides_updated_at_idx
    ON eas.agent_overrides(updated_at DESC);
