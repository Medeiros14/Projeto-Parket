-- ═══════════════════════════════════════════════════════
-- 024_pmo.sql — Tabelas dinâmicas para dept-pmo.tsx
-- ═══════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS pmo_produtividade (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  equipe     TEXT NOT NULL,
  m2dia      NUMERIC(6,1) NOT NULL DEFAULT 0,
  meta       NUMERIC(6,1) NOT NULL DEFAULT 18,
  obra_code  TEXT NOT NULL,
  tipo       TEXT NOT NULL,
  data       DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS pmo_m2_semanal (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  semana     TEXT NOT NULL,
  piso       INTEGER NOT NULL DEFAULT 0,
  forro      INTEGER NOT NULL DEFAULT 0,
  deck       INTEGER NOT NULL DEFAULT 0,
  periodo    DATE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS pmo_retencoes (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  obra_code  TEXT NOT NULL,
  valor      TEXT NOT NULL,
  status     TEXT NOT NULL DEFAULT 'retido' CHECK (status IN ('retido','liberar','liberado')),
  vencimento TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS pmo_ranking_equipes (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  equipe     TEXT NOT NULL,
  lider      TEXT NOT NULL,
  m2_total   INTEGER NOT NULL DEFAULT 0,
  m2_media   NUMERIC(5,1) NOT NULL DEFAULT 0,
  obras      INTEGER NOT NULL DEFAULT 0,
  bonus      BOOLEAN NOT NULL DEFAULT false,
  periodo    DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE pmo_produtividade   ENABLE ROW LEVEL SECURITY;
ALTER TABLE pmo_m2_semanal      ENABLE ROW LEVEL SECURITY;
ALTER TABLE pmo_retencoes       ENABLE ROW LEVEL SECURITY;
ALTER TABLE pmo_ranking_equipes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "allow_all_pmo_produtividade"   ON pmo_produtividade   FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_pmo_m2_semanal"      ON pmo_m2_semanal      FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_pmo_retencoes"       ON pmo_retencoes       FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_pmo_ranking_equipes" ON pmo_ranking_equipes FOR ALL USING (true) WITH CHECK (true);

INSERT INTO pmo_produtividade (equipe, m2dia, meta, obra_code, tipo) VALUES
  ('Alpha', 22,  18, 'PKT-042', 'piso'),
  ('Delta', 15,  18, 'PKT-048', 'piso+forro'),
  ('Gamma',  0,  18, 'PKT-050', 'marc (PARADA)'),
  ('Beta',   0,  18, 'PKT-053', 'rev (mobilizacao)');

INSERT INTO pmo_m2_semanal (semana, piso, forro, deck, periodo) VALUES
  ('S1',  95, 42, 15, CURRENT_DATE - 28),
  ('S2',  88, 38, 12, CURRENT_DATE - 21),
  ('S3', 102, 45, 18, CURRENT_DATE - 14),
  ('S4',  78, 40, 20, CURRENT_DATE - 7);

INSERT INTO pmo_retencoes (obra_code, valor, status, vencimento) VALUES
  ('PKT-042', 'R$ 18.5k', 'retido',  '30d pos-entrega'),
  ('PKT-045', 'R$ 12.8k', 'retido',  '30d pos-entrega'),
  ('PKT-048', 'R$ 22.0k', 'retido',  '30d pos-entrega'),
  ('PKT-050', 'R$ 15.2k', 'retido',  '30d pos-entrega'),
  ('PKT-053', 'R$ 14.5k', 'retido',  '30d pos-entrega'),
  ('PKT-039', 'R$ 8.5k',  'liberar', 'VENCIDO — 15d');

INSERT INTO pmo_ranking_equipes (equipe, lider, m2_total, m2_media, obras, bonus) VALUES
  ('Equipe Alpha', 'Marcos R.',   198, 22,   1, true),
  ('Equipe Delta', 'Fernando L.', 135, 15,   1, false),
  ('Equipe Beta',  'Ricardo S.',    0,  0,   0, false),
  ('Equipe Gamma', 'Tiago M.',     85, 12,   1, false);
