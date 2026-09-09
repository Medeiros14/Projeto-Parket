-- ═══════════════════════════════════════════════════════
-- 023_marketing.sql — Tabelas dinâmicas para dept-marketing.tsx
-- ═══════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS marketing_leads_canal (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  canal       TEXT NOT NULL,
  leads       INTEGER NOT NULL DEFAULT 0,
  cpl         TEXT NOT NULL DEFAULT 'R$ 0',
  conversao   TEXT NOT NULL DEFAULT '0%',
  gasto       TEXT NOT NULL DEFAULT '—',
  periodo     DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS marketing_leads_mensal (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mes        TEXT NOT NULL,
  leads      INTEGER NOT NULL DEFAULT 0,
  periodo    DATE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS marketing_conteudo (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo        TEXT NOT NULL,
  titulo      TEXT NOT NULL,
  status      TEXT NOT NULL DEFAULT 'criacao',
  data_label  TEXT NOT NULL,
  plataforma  TEXT NOT NULL DEFAULT 'IG',
  data        DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS marketing_campanhas (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome       TEXT NOT NULL,
  canal      TEXT NOT NULL,
  orcamento  TEXT NOT NULL,
  gasto      TEXT NOT NULL,
  leads      INTEGER NOT NULL DEFAULT 0,
  cpl        TEXT NOT NULL,
  status     TEXT NOT NULL DEFAULT 'ativo' CHECK (status IN ('ativo','pausado','encerrado')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE marketing_leads_canal   ENABLE ROW LEVEL SECURITY;
ALTER TABLE marketing_leads_mensal  ENABLE ROW LEVEL SECURITY;
ALTER TABLE marketing_conteudo      ENABLE ROW LEVEL SECURITY;
ALTER TABLE marketing_campanhas     ENABLE ROW LEVEL SECURITY;

CREATE POLICY "allow_all_marketing_leads_canal"  ON marketing_leads_canal  FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_marketing_leads_mensal" ON marketing_leads_mensal FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_marketing_conteudo"     ON marketing_conteudo     FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_marketing_campanhas"    ON marketing_campanhas    FOR ALL USING (true) WITH CHECK (true);

INSERT INTO marketing_leads_canal (canal, leads, cpl, conversao, gasto) VALUES
  ('Google Ads', 28, 'R$ 62',  '32%', 'R$ 1.7k'),
  ('Instagram',  22, 'R$ 108', '24%', 'R$ 2.4k'),
  ('Indicacao',  35, 'R$ 0',   '45%', '—'),
  ('Showroom',    7, 'R$ 150', '57%', 'R$ 1.1k');

INSERT INTO marketing_leads_mensal (mes, leads, periodo) VALUES
  ('Set', 62, '2025-09-01'), ('Out', 68, '2025-10-01'),
  ('Nov', 75, '2025-11-01'), ('Dez', 58, '2025-12-01'),
  ('Jan', 82, '2026-01-01'), ('Fev', 92, '2026-02-01');

INSERT INTO marketing_conteudo (tipo, titulo, status, data_label, plataforma, data) VALUES
  ('Reel',     'Bastidores Instalacao PKT-048',  'edicao 50%',      'Ter', 'IG',     CURRENT_DATE + 1),
  ('Carrossel','10 Diferenciais Parket',          'criacao',         'Qua', 'IG',     CURRENT_DATE + 2),
  ('Story',    'Obra PKT-048 — update',           'agendado',        'Qui 11h','IG',  CURRENT_DATE + 3),
  ('Anuncio',  'Google Ads: Piso Premium',        'A/B test',        'Seg', 'Google', CURRENT_DATE),
  ('Case',     'Case PKT-042 — Carvalho',         'roteiro pendente','Sex', 'Site',   CURRENT_DATE + 4);

INSERT INTO marketing_campanhas (nome, canal, orcamento, gasto, leads, cpl, status) VALUES
  ('Piso Premium SP',   'Google Ads', 'R$ 3k/mes',   'R$ 1.7k', 28, 'R$ 62',  'ativo'),
  ('Marcenaria Luxo',   'Instagram',  'R$ 2k/mes',   'R$ 1.2k', 12, 'R$ 100', 'ativo'),
  ('Deck & Fachada',    'Google Ads', 'R$ 1.5k/mes', 'R$ 800',   8, 'R$ 100', 'pausado');
