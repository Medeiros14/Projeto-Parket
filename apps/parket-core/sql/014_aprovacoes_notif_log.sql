-- Core v2 — log de notificações do chat (dedup).
-- Notifier do parket-chat lê pendentes e compara aqui pra não repostar
-- item já anunciado. sent_at é só pra debug.

CREATE TABLE IF NOT EXISTS core.aprovacoes_notif_log (
  tipo    text        NOT NULL,   -- receber|prestadores|compras|fretes|viagens|rh|reembolsos
  row_id  text        NOT NULL,   -- id da row de origem (as tabelas usam UUID)
  sent_at timestamptz NOT NULL DEFAULT now(),
  message text,                   -- texto postado (opcional, ajuda debug)
  PRIMARY KEY (tipo, row_id)
);
CREATE INDEX IF NOT EXISTS ix_aprov_notif_sent_at ON core.aprovacoes_notif_log(sent_at);
GRANT SELECT, INSERT ON core.aprovacoes_notif_log TO authenticated, service_role;
