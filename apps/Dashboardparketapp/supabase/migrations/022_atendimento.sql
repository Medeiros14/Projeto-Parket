-- ═══════════════════════════════════════════════════════
-- 022_atendimento.sql — Tabelas dinâmicas para dept-atendimento.tsx
-- ═══════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS atendimento_nps (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mes        TEXT NOT NULL,
  nps        NUMERIC(4,1) NOT NULL DEFAULT 0,
  periodo    DATE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS atendimento_tempo_resposta (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dia        TEXT NOT NULL,
  tempo      INTEGER NOT NULL DEFAULT 0,
  data       DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS atendimento_grupos (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  obra_code  TEXT NOT NULL,
  cliente    TEXT NOT NULL,
  tipo       TEXT NOT NULL DEFAULT 'WhatsApp',
  membros    INTEGER NOT NULL DEFAULT 0,
  last_msg   TEXT NOT NULL DEFAULT 'novo',
  saude      TEXT NOT NULL DEFAULT 'verde' CHECK (saude IN ('verde','amarelo','vermelho','novo')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE atendimento_nps             ENABLE ROW LEVEL SECURITY;
ALTER TABLE atendimento_tempo_resposta  ENABLE ROW LEVEL SECURITY;
ALTER TABLE atendimento_grupos          ENABLE ROW LEVEL SECURITY;

CREATE POLICY "allow_all_atendimento_nps"             ON atendimento_nps             FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_atendimento_tempo_resposta"  ON atendimento_tempo_resposta  FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_atendimento_grupos"          ON atendimento_grupos          FOR ALL USING (true) WITH CHECK (true);

INSERT INTO atendimento_nps (mes, nps, periodo) VALUES
  ('Set', 8.5, '2025-09-01'), ('Out', 8.8, '2025-10-01'),
  ('Nov', 8.9, '2025-11-01'), ('Dez', 9.0, '2025-12-01'),
  ('Jan', 8.7, '2026-01-01'), ('Fev', 9.1, '2026-02-01');

INSERT INTO atendimento_tempo_resposta (dia, tempo, data) VALUES
  ('Seg', 45, CURRENT_DATE - 5), ('Ter', 38, CURRENT_DATE - 4),
  ('Qua', 42, CURRENT_DATE - 3), ('Qui', 35, CURRENT_DATE - 2),
  ('Sex', 30, CURRENT_DATE - 1), ('Sab', 55, CURRENT_DATE);

INSERT INTO atendimento_grupos (obra_code, cliente, tipo, membros, last_msg, saude) VALUES
  ('PKT-042', 'Fam. Andrade',    'WhatsApp', 6, '2h',  'verde'),
  ('PKT-050', 'Fam. Costa Lima', 'WhatsApp', 5, '4h',  'vermelho'),
  ('PKT-048', 'Arq. Marina',     'WhatsApp', 7, '1d',  'verde'),
  ('PKT-053', 'Eng. Civil',      'WhatsApp', 4, '3h',  'amarelo'),
  ('PKT-045', 'Fam. Silveira',   'WhatsApp', 5, '1d',  'verde'),
  ('PKT-057', 'Arq. Patricia',   'WhatsApp', 3, 'novo','novo');
