-- ═══════════════════════════════════════════════════════
-- 026_fiscal_checklist.sql — Checklist padrão de vistoria
-- ═══════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS fiscal_checklist (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item       TEXT NOT NULL,
  categoria  TEXT NOT NULL,
  ordem      INTEGER NOT NULL DEFAULT 0,
  ativo      BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE fiscal_checklist ENABLE ROW LEVEL SECURITY;
CREATE POLICY "allow_all_fiscal_checklist" ON fiscal_checklist FOR ALL USING (true) WITH CHECK (true);

INSERT INTO fiscal_checklist (item, categoria, ordem) VALUES
  ('Nivel laser — desvio max 2mm/m',      'Piso',       1),
  ('Umidade contrapiso <= 3%',            'Piso',       2),
  ('Junta de dilatacao posicionada',      'Piso',       3),
  ('Alinhamento paginacao vs projeto',    'Piso',       4),
  ('Acabamento rodape — encaixe perfeito','Acabamento',  5),
  ('Cola exposta — verificar limpeza',    'Acabamento',  6),
  ('Barrote deck — espaco uniforme',      'Deck',       7),
  ('Tratamento madeira — aplicacao correta','Deck',     8),
  ('Forro — fixacao e alinhamento',       'Forro',      9),
  ('Acustica — teste se aplicavel',       'Forro',     10);
