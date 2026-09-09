-- ═══════════════════════════════════════════════════════
-- 020_fiscal.sql — Tabelas dinâmicas para dept-fiscal.tsx
-- ═══════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS fiscal_vistorias (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  data_label  TEXT NOT NULL,
  hora        TEXT NOT NULL,
  obra_code   TEXT NOT NULL,
  tipo        TEXT NOT NULL,
  local       TEXT NOT NULL,
  status      TEXT NOT NULL DEFAULT 'agendada' CHECK (status IN ('agendada','realizada','cancelada','sem projeto')),
  checklist   TEXT,
  data        DATE NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS fiscal_relatorios (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  obra_code   TEXT NOT NULL,
  tipo        TEXT NOT NULL,
  data        DATE NOT NULL,
  ambientes   INTEGER NOT NULL DEFAULT 0,
  itens_ok    INTEGER NOT NULL DEFAULT 0,
  itens_total INTEGER NOT NULL DEFAULT 0,
  status      TEXT NOT NULL DEFAULT 'postado' CHECK (status IN ('rascunho','postado','aprovado')),
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE fiscal_vistorias  ENABLE ROW LEVEL SECURITY;
ALTER TABLE fiscal_relatorios ENABLE ROW LEVEL SECURITY;

CREATE POLICY "allow_all_fiscal_vistorias"  ON fiscal_vistorias  FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_fiscal_relatorios" ON fiscal_relatorios FOR ALL USING (true) WITH CHECK (true);

INSERT INTO fiscal_vistorias (data_label, hora, obra_code, tipo, local, status, checklist, data) VALUES
  ('10/03 Seg', '08:00', 'PKT-053', '2a Vistoria (liberacao)', 'Av. Paulista, SP',     'agendada',    'umidade/nivel/alinhamento',        '2026-03-10'),
  ('11/03 Ter', '09:00', 'PKT-048', 'Vistoria Parcial',        'Vila Madalena, SP',    'agendada',    'piso 60% — conferencia',            '2026-03-11'),
  ('12/03 Qua', '14:00', 'PKT-042', 'Vistoria Final',          'Ipiranga, SP',         'agendada',    'checklist 24 itens — aceite',       '2026-03-12'),
  ('13/03 Qui', '—',     'PKT-047', 'BLOQUEADA',               'Pinheiros, SP',        'sem projeto', 'NAO IR — aguardando Thainara',      '2026-03-13');

INSERT INTO fiscal_relatorios (obra_code, tipo, data, ambientes, itens_ok, itens_total, status) VALUES
  ('PKT-048', '1a Vistoria',       '2026-03-07',  3, 8,  10, 'postado'),
  ('PKT-042', 'Vistoria Parcial 2','2026-03-05',  5, 18, 20, 'postado'),
  ('PKT-053', 'Medicao Inicial',   '2026-03-01',  4, 12, 12, 'postado');
