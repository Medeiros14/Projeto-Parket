-- ═══════════════════════════════════════════════════════
-- 021_logistica.sql — Tabelas dinâmicas para dept-logistica.tsx
-- ═══════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS logistica_entregas (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  obra_code   TEXT NOT NULL,
  destino     TEXT NOT NULL,
  motorista   TEXT NOT NULL DEFAULT '—',
  eta         TEXT NOT NULL,
  status      TEXT NOT NULL DEFAULT 'separacao' CHECK (status IN ('separacao','carregando','em transito','entregue','cancelado')),
  itens       INTEGER NOT NULL DEFAULT 0,
  tipo        TEXT NOT NULL DEFAULT 'proprio' CHECK (tipo IN ('proprio','terceiro')),
  data        DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS logistica_frota (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  veiculo     TEXT NOT NULL,
  motorista   TEXT NOT NULL,
  status      TEXT NOT NULL DEFAULT 'na base' CHECK (status IN ('em rota','na base','manutencao','disponivel')),
  km          TEXT NOT NULL,
  manutencao  TEXT NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS logistica_otif (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mes        TEXT NOT NULL,
  otif       NUMERIC(5,1) NOT NULL DEFAULT 0,
  periodo    DATE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE logistica_entregas ENABLE ROW LEVEL SECURITY;
ALTER TABLE logistica_frota    ENABLE ROW LEVEL SECURITY;
ALTER TABLE logistica_otif     ENABLE ROW LEVEL SECURITY;

CREATE POLICY "allow_all_logistica_entregas" ON logistica_entregas FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_logistica_frota"    ON logistica_frota    FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_logistica_otif"     ON logistica_otif     FOR ALL USING (true) WITH CHECK (true);

INSERT INTO logistica_entregas (obra_code, destino, motorista, eta, status, itens, tipo) VALUES
  ('PKT-042', 'R. Ipiranga, 245 — SP',     'Joao',   '14:30',  'em transito', 6,  'proprio'),
  ('PKT-053', 'Av. Paulista, 1578 — SP',   'Carlos', '16:00',  'carregando',  12, 'proprio'),
  ('PKT-045', 'R. Morumbi, 890 — SP',      '—',      'amanha', 'separacao',   8,  'terceiro');

INSERT INTO logistica_frota (veiculo, motorista, status, km, manutencao) VALUES
  ('Sprinter 01', 'Joao',   'em rota',   '42.500', '15/04'),
  ('HR 02',       'Carlos', 'na base',   '38.200', '20/03'),
  ('Sprinter 03', 'Pedro',  'manutencao','55.800', 'hoje');

INSERT INTO logistica_otif (mes, otif, periodo) VALUES
  ('Set', 88, '2025-09-01'), ('Out', 91, '2025-10-01'),
  ('Nov', 90, '2025-11-01'), ('Dez', 93, '2025-12-01'),
  ('Jan', 92, '2026-01-01'), ('Fev', 94, '2026-02-01');
