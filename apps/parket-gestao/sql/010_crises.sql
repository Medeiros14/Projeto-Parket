-- 010 — Gestor de Crises: kanban ENTRADA → ANALISANDO → RESOLVENDO → RESOLVIDO
-- Aplicado no parket-pg-local via deploy-gestao.sh

CREATE TABLE IF NOT EXISTS gestao.crises (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id text,
  projeto_id uuid REFERENCES gestao.projetos(id) ON DELETE SET NULL,
  cliente text,
  descricao text NOT NULL,
  gravidade text NOT NULL DEFAULT 'media' CHECK (gravidade IN ('leve','media','grave')),
  origem text NOT NULL DEFAULT 'manual' CHECK (origem IN ('relacionamento','projeto','manual')),
  coluna text NOT NULL DEFAULT 'entrada' CHECK (coluna IN ('entrada','analisando','resolvendo','resolvido')),
  responsavel_email text,
  responsavel_nome text,
  notificar jsonb NOT NULL DEFAULT '[]'::jsonb,
  prazo date,
  criado_por text,
  resolucao text,
  resolvido_em timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_gestao_crises_coluna
  ON gestao.crises (coluna, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_gestao_crises_card_aberta
  ON gestao.crises (card_id) WHERE coluna <> 'resolvido';

DROP TRIGGER IF EXISTS trg_gestao_crises_touch ON gestao.crises;
CREATE TRIGGER trg_gestao_crises_touch BEFORE UPDATE ON gestao.crises
FOR EACH ROW EXECUTE FUNCTION gestao._touch();

GRANT ALL ON gestao.crises TO gestao_rw;
