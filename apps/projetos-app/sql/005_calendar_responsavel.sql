-- Delegação de evento/tarefa no calendário — igual delegar card do kanban.
-- responsavel = quem TEM QUE fazer (aparece na agenda dele, recebe push).
-- Autor continua sendo quem criou; convidados são secundários (só participam).
ALTER TABLE trello_projetos.calendar_events
  ADD COLUMN IF NOT EXISTS responsavel_id   uuid,
  ADD COLUMN IF NOT EXISTS responsavel_nome text;

CREATE INDEX IF NOT EXISTS cal_ev_resp_idx
  ON trello_projetos.calendar_events (responsavel_id);
