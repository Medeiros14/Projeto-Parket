-- ═══════════════════════════════════════════════════════
-- 019_orcamento.sql — Tabelas dinâmicas para dept-orcamento.tsx
-- ═══════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS orcamento_desvio (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mes        TEXT NOT NULL,
  desvio     NUMERIC(5,1) NOT NULL DEFAULT 0,
  periodo    DATE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS orcamento_propostas (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  obra_id       TEXT NOT NULL,
  cliente       TEXT NOT NULL,
  tipo          TEXT NOT NULL,
  valor         TEXT NOT NULL,
  versao        TEXT NOT NULL DEFAULT '-',
  status        TEXT NOT NULL DEFAULT 'em calculo' CHECK (status IN ('enviada','incompleta','em calculo','em analise','aprovada','perdida')),
  dias_pendente INTEGER NOT NULL DEFAULT 0,
  completo      BOOLEAN NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE orcamento_desvio    ENABLE ROW LEVEL SECURITY;
ALTER TABLE orcamento_propostas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "allow_all_orcamento_desvio"    ON orcamento_desvio    FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_orcamento_propostas" ON orcamento_propostas FOR ALL USING (true) WITH CHECK (true);

INSERT INTO orcamento_desvio (mes, desvio, periodo) VALUES
  ('Set', 9.8, '2025-09-01'), ('Out', 8.5, '2025-10-01'),
  ('Nov', 7.2, '2025-11-01'), ('Dez', 8.1, '2025-12-01'),
  ('Jan', 6.8, '2026-01-01'), ('Fev', 6.2, '2026-02-01');

INSERT INTO orcamento_propostas (obra_id, cliente, tipo, valor, versao, status, dias_pendente, completo) VALUES
  ('PKT-058', 'Arq. Debora Aguiar',   'Fachada Cumaru',     'R$ 320k',  'v1', 'enviada',    0, true),
  ('PKT-056', 'Casa Alto Pinheiros',  'Escada + Deck',      '~R$ 142k', '—',  'incompleta', 1, false),
  ('PKT-057', 'Corp. Berrini',        'Forro Acustico 450m2','~R$ 185k','v1', 'em calculo', 0, true),
  ('ALV-001', 'Res. Alphaville',      'Piso 280m2',         '~R$ 180k', '—',  'em analise', 1, true);
