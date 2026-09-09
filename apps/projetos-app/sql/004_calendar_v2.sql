-- Calendário v2 (estilo Google Calendar completo):
--   tipo: evento | chamada | tarefa
--   local: texto livre
--   link_chamada: URL da videochamada (auto-gera Jitsi se tipo=chamada)
--   lembretes: jsonb array de int (minutos antes) — dispara push
--   rrule: RRULE simplificada (FREQ=DAILY|WEEKLY|MONTHLY;COUNT=N ou UNTIL=YYYY-MM-DD)
--   rsvp: jsonb map email→'sim'|'nao'|'talvez'
ALTER TABLE trello_projetos.calendar_events
  ADD COLUMN IF NOT EXISTS local        text,
  ADD COLUMN IF NOT EXISTS tipo         text NOT NULL DEFAULT 'evento',
  ADD COLUMN IF NOT EXISTS link_chamada text,
  ADD COLUMN IF NOT EXISTS lembretes    jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS rrule        text,
  ADD COLUMN IF NOT EXISTS rsvp         jsonb NOT NULL DEFAULT '{}'::jsonb;

-- Idempotência: cada lembrete só sai uma vez por (evento, usuário, offset).
CREATE TABLE IF NOT EXISTS trello_projetos.calendar_reminders_sent (
  event_id   bigint      NOT NULL REFERENCES trello_projetos.calendar_events(id) ON DELETE CASCADE,
  user_id    uuid        NOT NULL,
  offset_min int         NOT NULL,
  occurrence timestamptz NOT NULL,   -- ocorrência específica (importa em recorrentes)
  sent_at    timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (event_id, user_id, offset_min, occurrence)
);
CREATE INDEX IF NOT EXISTS cal_rem_sent_idx ON trello_projetos.calendar_reminders_sent (occurrence);
