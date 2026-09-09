-- Timeline de comentários por crise: cada atualização/registro do tratamento.
-- Reaproveita padrão do reuniao_tarefa: audit trail cronológico.

CREATE TABLE IF NOT EXISTS gestao.crise_comentario (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  crise_id     uuid NOT NULL REFERENCES gestao.crises(id) ON DELETE CASCADE,
  autor_email  text,
  autor_nome   text,
  texto        text NOT NULL,
  tipo         text NOT NULL DEFAULT 'comentario',
    -- comentario | mudanca_coluna | mudanca_gravidade | resolucao (system-generated)
  meta         jsonb DEFAULT '{}'::jsonb,
  created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_gestao_crise_coment_crise
  ON gestao.crise_comentario (crise_id, created_at);
