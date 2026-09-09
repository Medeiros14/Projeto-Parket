-- ═══════════════════════════════════════════════════════
-- 015_producao_extra.sql — Tabelas dinâmicas para dept-producao.tsx
-- ═══════════════════════════════════════════════════════

-- ── producao_nc ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS producao_nc (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo      TEXT NOT NULL UNIQUE,
  obra_code   TEXT NOT NULL,
  descricao   TEXT NOT NULL,
  data        DATE NOT NULL DEFAULT CURRENT_DATE,
  status      TEXT NOT NULL DEFAULT 'aberta' CHECK (status IN ('aberta','em_tratamento','resolvida')),
  severidade  TEXT NOT NULL DEFAULT 'media' CHECK (severidade IN ('alta','media','baixa')),
  responsavel TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ── producao_capacidade ───────────────────────────────
CREATE TABLE IF NOT EXISTS producao_capacidade (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dia        TEXT NOT NULL,
  capacidade INTEGER NOT NULL DEFAULT 100,
  uso        INTEGER NOT NULL DEFAULT 0,
  data       DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── producao_equipes ──────────────────────────────────
CREATE TABLE IF NOT EXISTS producao_equipes (
  id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome      TEXT NOT NULL,
  lider     TEXT NOT NULL,
  bancada   TEXT NOT NULL,
  ordem     TEXT,
  operacao  TEXT,
  carga     INTEGER NOT NULL DEFAULT 0 CHECK (carga BETWEEN 0 AND 100),
  status    TEXT NOT NULL DEFAULT 'ativo' CHECK (status IN ('ativo','bloqueado','manutencao','disponivel')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── RLS ───────────────────────────────────────────────
ALTER TABLE producao_nc         ENABLE ROW LEVEL SECURITY;
ALTER TABLE producao_capacidade ENABLE ROW LEVEL SECURITY;
ALTER TABLE producao_equipes    ENABLE ROW LEVEL SECURITY;

CREATE POLICY "allow_all_producao_nc"         ON producao_nc         FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_producao_capacidade" ON producao_capacidade FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_producao_equipes"    ON producao_equipes    FOR ALL USING (true) WITH CHECK (true);

-- ── Seed ─────────────────────────────────────────────
INSERT INTO producao_nc (codigo, obra_code, descricao, data, status, severidade, responsavel) VALUES
  ('NC-047', 'PKT-050', 'Porta c/ desvio de 2mm — fora de tolerancia',      '2026-03-05', 'aberta',       'alta',  'Germano'),
  ('NC-046', 'PKT-050', 'Ficha tecnica desatualizada — versao antiga usada', '2026-03-03', 'aberta',       'media', 'Germano'),
  ('NC-045', 'PKT-045', 'Arranhao superficial em acabamento',                '2026-02-28', 'resolvida',    'baixa', 'Ricardo'),
  ('NC-044', 'PKT-042', 'Tonalidade madeira diverge do aprovado',            '2026-02-20', 'resolvida',    'media', 'Marcos'),
  ('NC-043', 'PKT-051', 'Dimensoes fora do projeto — retrabalho',            '2026-02-15', 'em_tratamento','alta',  'Tiago');

INSERT INTO producao_capacidade (dia, capacidade, uso, data) VALUES
  ('Seg',  100, 92, CURRENT_DATE - 6),
  ('Ter',  100, 85, CURRENT_DATE - 5),
  ('Qua',  100, 78, CURRENT_DATE - 4),
  ('Qui',  100, 88, CURRENT_DATE - 3),
  ('Sex',  100, 82, CURRENT_DATE - 2),
  ('Seg+1',100, 95, CURRENT_DATE - 1),
  ('Ter+1',100, 72, CURRENT_DATE);

INSERT INTO producao_equipes (nome, lider, bancada, ordem, operacao, carga, status) VALUES
  ('Equipe A', 'Marcos',   'Bancada 3', 'OP-221 (PKT-050)', 'Usinagem portas',      95, 'ativo'),
  ('Equipe B', 'Tiago',    'Bancada 1', 'OP-219 (PKT-051)', 'BLOQUEADO — projeto',   0, 'bloqueado'),
  ('Equipe C', 'Ricardo',  'Bancada 2', 'OP-220 (PKT-045)', 'Acabamento/pintura',   75, 'ativo'),
  ('Equipe D', 'Fernando', 'Bancada 4', 'Disponivel',        'Manutencao preventiva',20, 'disponivel');
