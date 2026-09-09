-- ═══════════════════════════════════════════════════════
-- 013_rh.sql — Tabelas dinâmicas para dept-rh.tsx
-- ═══════════════════════════════════════════════════════

-- ── rh_vagas ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS rh_vagas (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo      TEXT NOT NULL,
  dept        TEXT NOT NULL,
  solicitante TEXT NOT NULL,
  dias_aberta INTEGER NOT NULL DEFAULT 0,
  candidatos  INTEGER NOT NULL DEFAULT 0,
  urgencia    TEXT NOT NULL DEFAULT 'media' CHECK (urgencia IN ('alta','media','baixa')),
  etapa       TEXT NOT NULL DEFAULT 'triagem' CHECK (etapa IN ('triagem','entrevista','proposta','finalizado')),
  status      TEXT NOT NULL DEFAULT 'aberta' CHECK (status IN ('aberta','fechada','pausada')),
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ── rh_treinamentos ───────────────────────────────────
CREATE TABLE IF NOT EXISTS rh_treinamentos (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo         TEXT NOT NULL,
  obrigatorio    BOOLEAN NOT NULL DEFAULT false,
  participantes  INTEGER NOT NULL DEFAULT 0,
  concluidos     INTEGER NOT NULL DEFAULT 0,
  vencimento     TEXT,
  status         TEXT NOT NULL DEFAULT 'em_andamento' CHECK (status IN ('em_andamento','concluido','atrasado')),
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

-- ── rh_contratos_vencendo ─────────────────────────────
CREATE TABLE IF NOT EXISTS rh_contratos_vencendo (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome          TEXT NOT NULL,
  cargo         TEXT NOT NULL,
  dept          TEXT NOT NULL,
  vencimento    DATE NOT NULL,
  dias_restantes INTEGER NOT NULL DEFAULT 0,
  tipo          TEXT NOT NULL DEFAULT 'clt' CHECK (tipo IN ('clt','pj','estagio')),
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ── rh_headcount ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS rh_headcount (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dept          TEXT NOT NULL,
  ativos        INTEGER NOT NULL DEFAULT 0,
  afastados     INTEGER NOT NULL DEFAULT 0,
  ferias        INTEGER NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ── RLS ───────────────────────────────────────────────
ALTER TABLE rh_vagas ENABLE ROW LEVEL SECURITY;
ALTER TABLE rh_treinamentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE rh_contratos_vencendo ENABLE ROW LEVEL SECURITY;
ALTER TABLE rh_headcount ENABLE ROW LEVEL SECURITY;

CREATE POLICY "allow_all_rh_vagas"              ON rh_vagas              FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_rh_treinamentos"       ON rh_treinamentos       FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_rh_contratos_vencendo" ON rh_contratos_vencendo FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_rh_headcount"          ON rh_headcount          FOR ALL USING (true) WITH CHECK (true);

-- ── Seed ─────────────────────────────────────────────
INSERT INTO rh_vagas (titulo, dept, solicitante, dias_aberta, candidatos, urgencia, etapa) VALUES
  ('2o Fiscal de Obras',        'Fiscal', 'Pamella', 15, 3, 'alta',  'triagem'),
  ('Instalador Piso — SP (1)',  'Obras',  'Dany',    10, 5, 'media', 'entrevista'),
  ('Instalador Piso — SP (2)',  'Obras',  'Dany',    10, 5, 'media', 'triagem'),
  ('Marceneiro Sênior',         'Producao','Germano',  7, 2, 'alta',  'triagem'),
  ('Coordenador Comercial',     'Comercial','Aline',   20, 8, 'media','proposta');

INSERT INTO rh_treinamentos (titulo, obrigatorio, participantes, concluidos, vencimento, status) VALUES
  ('NR-35 — Trabalho em Altura', true,  12, 8,  '15/03', 'em_andamento'),
  ('NR-18 — Construção Civil',   true,  20, 20, '30/04', 'concluido'),
  ('Qualidade ISO 9001',         false, 8,  3,  '30/03', 'em_andamento'),
  ('Integração Novos Func.',     true,  3,  0,  '20/03', 'em_andamento'),
  ('Segurança Elétrica NR-10',   true,  15, 15, '01/06', 'concluido');

INSERT INTO rh_contratos_vencendo (nome, cargo, dept, vencimento, dias_restantes, tipo) VALUES
  ('Carlos Silva',  'Instalador',          'Obras',    '2026-03-25', 13, 'clt'),
  ('Ana Beatriz',   'Auxiliar Adm.',       'Adm',      '2026-04-01', 20, 'estagio'),
  ('Pedro Alves',   'Assistente Comercial','Comercial', '2026-04-10', 29, 'pj'),
  ('Lucia Mendes',  'Fiscal de Obras',     'Fiscal',   '2026-04-15', 34, 'clt');

INSERT INTO rh_headcount (dept, ativos, afastados, ferias) VALUES
  ('Obras',     14, 1, 2),
  ('Producao',   8, 0, 1),
  ('Comercial',  5, 0, 0),
  ('Fiscal',     4, 1, 0),
  ('Adm',        3, 0, 1),
  ('RH',         2, 0, 0);
