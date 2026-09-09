-- Model override por agente/team (hot-swap sem restart)
CREATE TABLE IF NOT EXISTS eas.model_overrides (
    agent_id   text PRIMARY KEY,
    model      text NOT NULL,
    updated_by text,
    updated_at timestamptz NOT NULL DEFAULT now()
);
