-- Crises passam a apontar SETOR responsável (não pessoa individual).
-- responsavel_email/notificar continuam existindo pra compat (endpoint aceita ambos).

ALTER TABLE gestao.crises
  ADD COLUMN IF NOT EXISTS setor_responsavel text,
  ADD COLUMN IF NOT EXISTS setores_notificar text[] NOT NULL DEFAULT '{}'::text[];

CREATE INDEX IF NOT EXISTS idx_gestao_crises_setor_resp
  ON gestao.crises (setor_responsavel) WHERE setor_responsavel IS NOT NULL;
