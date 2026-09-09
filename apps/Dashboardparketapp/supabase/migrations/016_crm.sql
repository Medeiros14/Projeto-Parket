-- ═══════════════════════════════════════════════════════
-- 016_crm.sql — Tabelas dinâmicas para dept-comercial.tsx
-- ═══════════════════════════════════════════════════════

-- ── crm_pipeline ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS crm_pipeline (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stage      TEXT NOT NULL,
  value_k    NUMERIC(10,0) NOT NULL DEFAULT 0,  -- valor em R$ mil
  deals      INTEGER NOT NULL DEFAULT 0,
  ordem      INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── crm_funil ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS crm_funil (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT NOT NULL,
  value      INTEGER NOT NULL DEFAULT 0,
  cor        TEXT NOT NULL DEFAULT '#3B82F6',
  ordem      INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── crm_closer_ranking ───────────────────────────────
CREATE TABLE IF NOT EXISTS crm_closer_ranking (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome       TEXT NOT NULL,
  papel      TEXT NOT NULL DEFAULT 'closer' CHECK (papel IN ('closer','bdr','sdr')),
  propostas  INTEGER NOT NULL DEFAULT 0,
  fechados   INTEGER NOT NULL DEFAULT 0,
  valor_k    NUMERIC(10,0) NOT NULL DEFAULT 0,  -- R$ mil
  taxa_pct   NUMERIC(5,1),
  destaque   BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── crm_agenda_showroom ───────────────────────────────
CREATE TABLE IF NOT EXISTS crm_agenda_showroom (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dia        TEXT NOT NULL,
  data       DATE NOT NULL,
  hora       TEXT NOT NULL,
  cliente    TEXT NOT NULL,
  status     TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('confirmado','pendente','cancelado','realizado')),
  closer     TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── crm_conversion_monthly ────────────────────────────
CREATE TABLE IF NOT EXISTS crm_conversion_monthly (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mes        TEXT NOT NULL,
  taxa       NUMERIC(5,1) NOT NULL DEFAULT 0,
  leads      INTEGER NOT NULL DEFAULT 0,
  periodo    DATE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── RLS ───────────────────────────────────────────────
ALTER TABLE crm_pipeline            ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_funil               ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_closer_ranking      ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_agenda_showroom     ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_conversion_monthly  ENABLE ROW LEVEL SECURITY;

CREATE POLICY "allow_all_crm_pipeline"           ON crm_pipeline           FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_crm_funil"              ON crm_funil              FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_crm_closer_ranking"     ON crm_closer_ranking     FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_crm_agenda_showroom"    ON crm_agenda_showroom    FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_crm_conversion_monthly" ON crm_conversion_monthly FOR ALL USING (true) WITH CHECK (true);

-- ── Seed ─────────────────────────────────────────────
INSERT INTO crm_pipeline (stage, value_k, deals, ordem) VALUES
  ('Prospeccao',  275, 2, 1),
  ('Qualificacao',570, 2, 2),
  ('Proposta',    185, 1, 3),
  ('Negociacao',  142, 1, 4),
  ('Fechamento',  320, 1, 5);

INSERT INTO crm_funil (name, value, cor, ordem) VALUES
  ('Leads Ativos',  47, '#3B82F6', 1),
  ('Qualificados',  28, '#60A5FA', 2),
  ('Propostas',     12, '#8B5CF6', 3),
  ('Negociacao',     6, '#F97316', 4),
  ('Fechados',       4, '#10B981', 5);

INSERT INTO crm_closer_ranking (nome, papel, propostas, fechados, valor_k, taxa_pct, destaque) VALUES
  ('Rafael',       'closer', 5, 2, 505, 40.0, true),
  ('Marina',       'closer', 4, 1, 250, 25.0, false),
  ('Ana',          'bdr',    0, 0,   0, NULL,  false),
  ('Carlos',       'bdr',    0, 0,   0, NULL,  false);

INSERT INTO crm_agenda_showroom (dia, data, hora, cliente, status, closer) VALUES
  ('Seg 10/03', '2026-03-10', '10:00', 'Arq. Patricia Gomes', 'confirmado', 'Rafael'),
  ('Ter 11/03', '2026-03-11', '14:00', 'Eng. Roberto Campos', 'pendente',   'Marina'),
  ('Qua 12/03', '2026-03-12', '11:00', 'Studio Debora Aguiar','confirmado', 'Rafael'),
  ('Qui 13/03', '2026-03-13', '15:00', 'Res. Alphaville',     'pendente',   'Marina'),
  ('Sex 14/03', '2026-03-14', '09:30', 'Corp. Berrini',       'confirmado', 'Rafael');

INSERT INTO crm_conversion_monthly (mes, taxa, leads, periodo) VALUES
  ('Set', 22, 38, '2025-09-01'),
  ('Out', 28, 42, '2025-10-01'),
  ('Nov', 31, 45, '2025-11-01'),
  ('Dez', 25, 35, '2025-12-01'),
  ('Jan', 30, 48, '2026-01-01'),
  ('Fev', 34, 47, '2026-02-01');
