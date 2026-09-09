-- ═══════════════════════════════════════════════════════
-- 025_orcamento_extra.sql — Composição de custo e templates
-- ═══════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS orcamento_composicao (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item       TEXT NOT NULL,
  perc       NUMERIC(5,1) NOT NULL DEFAULT 0,
  cor        TEXT NOT NULL DEFAULT '#3B82F6',
  ordem      INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS orcamento_templates (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome       TEXT NOT NULL,
  m2_range   TEXT,
  tipo       TEXT,
  margem_ref TEXT NOT NULL,
  usos       INTEGER NOT NULL DEFAULT 0,
  ativo      BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE orcamento_composicao ENABLE ROW LEVEL SECURITY;
ALTER TABLE orcamento_templates  ENABLE ROW LEVEL SECURITY;

CREATE POLICY "allow_all_orcamento_composicao" ON orcamento_composicao FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_orcamento_templates"  ON orcamento_templates  FOR ALL USING (true) WITH CHECK (true);

INSERT INTO orcamento_composicao (item, perc, cor, ordem) VALUES
  ('Material',           48, '#3B82F6', 1),
  ('Mao de Obra (inst.)',25, '#F97316', 2),
  ('Mao de Obra (fab.)', 12, '#8B5CF6', 3),
  ('Frete/Logistica',     5, '#14B8A6', 4),
  ('Overhead',            5, '#EAB308', 5),
  ('Margem Bruta',        5, '#10B981', 6);

INSERT INTO orcamento_templates (nome, m2_range, tipo, margem_ref, usos) VALUES
  ('Piso Madera (Rev.)',  '50-300m2',  NULL,      '32-38%', 28),
  ('Marcenaria Completa', NULL,        'modulos',  '28-35%', 15),
  ('Deck Externo',        '20-100m2',  NULL,      '35-42%', 12),
  ('Forro Acustico',      '100-500m2', NULL,      '30-36%',  8),
  ('Fachada Cumaru',      '50-200m2',  NULL,      '33-40%',  5);
