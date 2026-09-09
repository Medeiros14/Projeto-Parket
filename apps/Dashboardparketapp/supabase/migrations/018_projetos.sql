-- ═══════════════════════════════════════════════════════
-- 018_projetos.sql — Tabelas dinâmicas para dept-projetos.tsx
-- ═══════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS projetos_lead_time (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mes        TEXT NOT NULL,
  tempo      NUMERIC(5,1) NOT NULL DEFAULT 0,
  periodo    DATE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS projetos_versoes (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  obra_code  TEXT NOT NULL,
  versoes    INTEGER NOT NULL DEFAULT 1,
  status     TEXT NOT NULL DEFAULT 'em andamento' CHECK (status IN ('em andamento','bloqueado','aprovado','bom pronto')),
  dias       INTEGER NOT NULL DEFAULT 0,
  cliente    TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS projetos_bom (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  obra_code   TEXT NOT NULL UNIQUE,
  itens       INTEGER NOT NULL DEFAULT 0,
  conferidos  INTEGER NOT NULL DEFAULT 0,
  status      TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente','parcial','completo')),
  valor       TEXT NOT NULL,
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS projetos_aprovacoes (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  obra_code     TEXT NOT NULL,
  tipo          TEXT NOT NULL,
  versao        TEXT NOT NULL DEFAULT '-',
  dias_pendente INTEGER NOT NULL DEFAULT 0,
  urgencia      TEXT NOT NULL DEFAULT 'normal' CHECK (urgencia IN ('critico','normal','novo')),
  arquiteto     TEXT NOT NULL,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE projetos_lead_time  ENABLE ROW LEVEL SECURITY;
ALTER TABLE projetos_versoes    ENABLE ROW LEVEL SECURITY;
ALTER TABLE projetos_bom        ENABLE ROW LEVEL SECURITY;
ALTER TABLE projetos_aprovacoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "allow_all_projetos_lead_time"  ON projetos_lead_time  FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_projetos_versoes"    ON projetos_versoes    FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_projetos_bom"        ON projetos_bom        FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_projetos_aprovacoes" ON projetos_aprovacoes FOR ALL USING (true) WITH CHECK (true);

INSERT INTO projetos_lead_time (mes, tempo, periodo) VALUES
  ('Set', 12.5, '2025-09-01'), ('Out', 11.2, '2025-10-01'),
  ('Nov', 10.1, '2025-11-01'), ('Dez',  9.8, '2025-12-01'),
  ('Jan',  9.2, '2026-01-01'), ('Fev',  8.5, '2026-02-01');

INSERT INTO projetos_versoes (obra_code, versoes, status, dias, cliente) VALUES
  ('PKT-047', 3, 'bloqueado',   12, 'Nao responde'),
  ('PKT-051', 2, 'bloqueado',    8, 'Compatibilizacao'),
  ('PKT-048', 1, 'em andamento', 3, 'Desenvolvimento'),
  ('PKT-053', 2, 'aprovado',     0, 'Aprovado hoje'),
  ('PKT-045', 2, 'bom pronto',   0, 'BOM gerado');

INSERT INTO projetos_bom (obra_code, itens, conferidos, status, valor) VALUES
  ('PKT-045', 42,  42, 'completo', 'R$ 28k'),
  ('PKT-048', 38,  12, 'parcial',  'R$ 35k'),
  ('PKT-053', 25,  25, 'completo', 'R$ 67k'),
  ('PKT-058',  0,   0, 'pendente', 'R$ 180k');

INSERT INTO projetos_aprovacoes (obra_code, tipo, versao, dias_pendente, urgencia, arquiteto) VALUES
  ('PKT-047', 'Gate Freeze',       'v3', 12, 'critico', 'Arq. Carolina'),
  ('PKT-051', 'Compatibilizacao',  'v2',  8, 'critico', 'Arq. Fernanda'),
  ('PKT-048', 'Revisao Paginacao', 'v1',  2, 'normal',  'Arq. Marina'),
  ('PKT-058', 'Pre-Projeto',       '-',   0, 'novo',    'Arq. Debora Aguiar');
