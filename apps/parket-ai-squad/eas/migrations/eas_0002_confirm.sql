-- F2 — fila de confirmação humana via WhatsApp
-- Cada chamada de tool com requires_confirmation=True grava aqui.
-- Will responde "sim <token>" ou "não <token>" no WhatsApp → handler do EAS resolve.

CREATE TABLE IF NOT EXISTS eas.eas_confirmations (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    token       text UNIQUE NOT NULL,        -- código curto pro Will referenciar
    run_id      text,                         -- AgentOS run_id (pra continue)
    agent_id    text,
    tool_name   text NOT NULL,
    tool_args   jsonb NOT NULL DEFAULT '{}',
    summary     text NOT NULL,                -- descrição humana da ação
    status      text NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending','approved','denied','timeout','executed','failed')),
    requested_at timestamptz NOT NULL DEFAULT now(),
    answered_at  timestamptz,
    executed_at  timestamptz,
    result      jsonb,                        -- output da tool após execução
    notes       text
);

CREATE INDEX IF NOT EXISTS eas_confirmations_status_idx ON eas.eas_confirmations(status);
CREATE INDEX IF NOT EXISTS eas_confirmations_token_idx ON eas.eas_confirmations(token);

-- Espelho do log de handoffs entre squads (não duplica claude_atividades público)
CREATE TABLE IF NOT EXISTS eas.eas_handoffs (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    from_agent  text NOT NULL,
    to_squad    text NOT NULL,
    ticket_id   text,
    payload     jsonb NOT NULL DEFAULT '{}',
    status      text NOT NULL DEFAULT 'open'
                  CHECK (status IN ('open','accepted','done','failed')),
    created_at  timestamptz NOT NULL DEFAULT now(),
    closed_at   timestamptz,
    notes       text
);

CREATE INDEX IF NOT EXISTS eas_handoffs_status_idx ON eas.eas_handoffs(status);
CREATE INDEX IF NOT EXISTS eas_handoffs_to_squad_idx ON eas.eas_handoffs(to_squad);
