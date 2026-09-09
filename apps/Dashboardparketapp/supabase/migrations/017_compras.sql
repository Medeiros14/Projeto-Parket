-- ═══════════════════════════════════════════════════════
-- 017_compras.sql — Tabelas dinâmicas para dept-compras.tsx
-- ═══════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS compras_saving (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mes        TEXT NOT NULL,
  saving     NUMERIC(5,1) NOT NULL DEFAULT 0,
  mercado    NUMERIC(5,1) NOT NULL DEFAULT 0,
  periodo    DATE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS compras_fornecedores (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome       TEXT NOT NULL,
  categoria  TEXT NOT NULL,
  avaliacao  NUMERIC(3,1) NOT NULL DEFAULT 0,
  entregas   INTEGER NOT NULL DEFAULT 0,
  atrasos    INTEGER NOT NULL DEFAULT 0,
  valor_k    NUMERIC(10,0) NOT NULL DEFAULT 0,
  ativo      BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS compras_estoque (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item       TEXT NOT NULL,
  qtd        TEXT NOT NULL,
  minimo     TEXT NOT NULL,
  status     TEXT NOT NULL DEFAULT 'ok' CHECK (status IN ('ok','atencao','baixo','zerado')),
  consumo    TEXT NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS compras_pos (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo      TEXT NOT NULL UNIQUE,
  obra_code   TEXT NOT NULL,
  fornecedor  TEXT NOT NULL,
  valor       TEXT NOT NULL,
  dias        INTEGER NOT NULL DEFAULT 0,
  status      TEXT NOT NULL DEFAULT 'novo' CHECK (status IN ('novo','cotacao','no prazo','atrasado','entregue')),
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE compras_saving       ENABLE ROW LEVEL SECURITY;
ALTER TABLE compras_fornecedores ENABLE ROW LEVEL SECURITY;
ALTER TABLE compras_estoque      ENABLE ROW LEVEL SECURITY;
ALTER TABLE compras_pos          ENABLE ROW LEVEL SECURITY;

CREATE POLICY "allow_all_compras_saving"       ON compras_saving       FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_compras_fornecedores" ON compras_fornecedores FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_compras_estoque"      ON compras_estoque      FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_compras_pos"          ON compras_pos          FOR ALL USING (true) WITH CHECK (true);

INSERT INTO compras_saving (mes, saving, mercado, periodo) VALUES
  ('Set', 12, 85, '2025-09-01'), ('Out', 18, 92, '2025-10-01'),
  ('Nov', 22, 88, '2025-11-01'), ('Dez', 25, 95, '2025-12-01'),
  ('Jan', 24, 90, '2026-01-01'), ('Fev', 28, 87, '2026-02-01');

INSERT INTO compras_fornecedores (nome, categoria, avaliacao, entregas, atrasos, valor_k) VALUES
  ('Indusparquet',  'Piso',       4.8, 12, 0, 320),
  ('Duratex',       'MDF',        4.5,  8, 1, 180),
  ('Henkel (Cola)', 'Insumos',    4.7, 15, 0,  45),
  ('Ferr. Moreira', 'Ferragens',  3.2,  6, 3,  28),
  ('MadeiraMadeira','Cumaru',     4.3,  5, 0,  95);

INSERT INTO compras_estoque (item, qtd, minimo, status, consumo) VALUES
  ('Cola PU Premium',      '12 un',  '20 un', 'baixo',   '5/semana'),
  ('Parafuso Deck Inox',   '450 un', '500 un','atencao',  '100/obra'),
  ('Barrote Pinus 3x5',    '85 ml',  '50 ml', 'ok',       '15ml/obra'),
  ('MDF 18mm Nogueira',    '0 ch',   '5 ch',  'zerado',   'sob demanda');

INSERT INTO compras_pos (codigo, obra_code, fornecedor, valor, dias, status) VALUES
  ('#2847', 'PKT-053', 'Indusparquet',   'R$ 67k', 2, 'no prazo'),
  ('#2848', 'PKT-056', 'MadeiraMadeira', 'R$ 38k', 1, 'cotacao'),
  ('#2849', 'PKT-050', 'Ferr. Moreira',  'R$ 12k', 8, 'atrasado'),
  ('#2850', 'PKT-048', 'Duratex',        'R$ 28k', 0, 'novo');
