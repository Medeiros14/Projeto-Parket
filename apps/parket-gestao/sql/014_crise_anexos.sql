-- 014 — Anexos em comentários de crise
-- Cada linha em anexos: {url, name, mime, size}
ALTER TABLE gestao.crise_comentario
  ADD COLUMN IF NOT EXISTS anexos jsonb NOT NULL DEFAULT '[]'::jsonb;
