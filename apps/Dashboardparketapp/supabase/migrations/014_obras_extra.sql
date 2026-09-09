-- ═══════════════════════════════════════════════════════
-- 014_obras_extra.sql — Tabelas dinâmicas para dept-obras.tsx
-- ═══════════════════════════════════════════════════════

-- ── obras_equipes_campo ───────────────────────────────
CREATE TABLE IF NOT EXISTS obras_equipes_campo (
  id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  equipe    TEXT NOT NULL,
  lider     TEXT NOT NULL,
  obra_code TEXT NOT NULL,
  obra_nome TEXT NOT NULL,
  local     TEXT NOT NULL,
  progresso INTEGER NOT NULL DEFAULT 0 CHECK (progresso BETWEEN 0 AND 100),
  tipo      TEXT NOT NULL DEFAULT 'rev' CHECK (tipo IN ('piso','marc','rev','impermeabilizacao')),
  membros   INTEGER NOT NULL DEFAULT 1,
  status    TEXT NOT NULL DEFAULT 'executando' CHECK (status IN ('executando','pausado','concluido','deslocamento')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── obras_diarios ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS obras_diarios (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  equipe     TEXT NOT NULL,
  obra_code  TEXT NOT NULL,
  data       DATE NOT NULL DEFAULT CURRENT_DATE,
  preenchido BOOLEAN NOT NULL DEFAULT false,
  m2         INTEGER,
  obs        TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── obras_cronograma ──────────────────────────────────
CREATE TABLE IF NOT EXISTS obras_cronograma (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  obra_code   TEXT NOT NULL,
  etapa       TEXT NOT NULL,
  inicio      DATE NOT NULL,
  fim_previsto DATE NOT NULL,
  fim_real    DATE,
  status      TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente','em_andamento','concluido','atrasado')),
  responsavel TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ── RLS ───────────────────────────────────────────────
ALTER TABLE obras_equipes_campo ENABLE ROW LEVEL SECURITY;
ALTER TABLE obras_diarios       ENABLE ROW LEVEL SECURITY;
ALTER TABLE obras_cronograma    ENABLE ROW LEVEL SECURITY;

CREATE POLICY "allow_all_obras_equipes_campo" ON obras_equipes_campo FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_obras_diarios"       ON obras_diarios       FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_obras_cronograma"    ON obras_cronograma    FOR ALL USING (true) WITH CHECK (true);

-- ── Seed ─────────────────────────────────────────────
INSERT INTO obras_equipes_campo (equipe, lider, obra_code, obra_nome, local, progresso, tipo, membros, status) VALUES
  ('Equipe Alpha',   'Marcos R.', 'PKT-042', 'Res. Ipiranga',     'Ipiranga, SP',      88, 'piso',             3, 'executando'),
  ('Equipe Beta',    'Luiz F.',   'PKT-050', 'Ap. Moema',         'Moema, SP',         62, 'marc',             4, 'executando'),
  ('Equipe Gamma',   'Rafael S.', 'PKT-045', 'Casa Morumbi',      'Morumbi, SP',       91, 'marc',             3, 'executando'),
  ('Equipe Delta',   'Andre M.',  'PKT-055', 'Fachada Cumaru',    'Higienópolis, SP',  15, 'impermeabilizacao',2, 'deslocamento'),
  ('Equipe Epsilon', 'Paulo H.',  'PKT-051', 'Cobert. Jardins',   'Jardins, SP',       40, 'piso',             3, 'pausado');

INSERT INTO obras_diarios (equipe, obra_code, data, preenchido, m2, obs) VALUES
  ('Equipe Alpha',   'PKT-042', CURRENT_DATE, true,  22, 'Piso 88% — finalizando ult. ambiente'),
  ('Equipe Beta',    'PKT-050', CURRENT_DATE, true,  18, 'Marcenaria cozinha concluida, iniciando sala'),
  ('Equipe Gamma',   'PKT-045', CURRENT_DATE, true,  31, 'Acabamento portas — aguardando ferragens'),
  ('Equipe Delta',   'PKT-055', CURRENT_DATE, false, NULL, NULL),
  ('Equipe Epsilon', 'PKT-051', CURRENT_DATE, false, NULL, 'Aguardando liberação cliente');

INSERT INTO obras_cronograma (obra_code, etapa, inicio, fim_previsto, status, responsavel) VALUES
  ('PKT-042', 'Execucao piso',        '2026-01-15', '2026-03-20', 'em_andamento', 'Marcos R.'),
  ('PKT-042', 'Acabamento/limpeza',   '2026-03-21', '2026-03-28', 'pendente',     'Marcos R.'),
  ('PKT-050', 'Marcenaria cozinha',   '2026-02-01', '2026-03-10', 'em_andamento', 'Luiz F.'),
  ('PKT-050', 'Marcenaria demais amb','2026-03-11', '2026-04-05', 'pendente',     'Luiz F.'),
  ('PKT-045', 'Execucao marcenaria',  '2026-01-20', '2026-03-15', 'em_andamento', 'Rafael S.'),
  ('PKT-055', 'Impermeabilizacao',    '2026-03-10', '2026-04-30', 'em_andamento', 'Andre M.');
