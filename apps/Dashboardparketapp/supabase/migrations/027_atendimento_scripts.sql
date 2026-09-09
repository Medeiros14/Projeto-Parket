-- ═══════════════════════════════════════════════════════
-- 027_atendimento_scripts.sql — Biblioteca de scripts
-- ═══════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS atendimento_scripts (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo     TEXT NOT NULL,
  uso        INTEGER NOT NULL DEFAULT 0,
  tipo       TEXT NOT NULL,
  conteudo   TEXT,
  ativo      BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE atendimento_scripts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "allow_all_atendimento_scripts" ON atendimento_scripts FOR ALL USING (true) WITH CHECK (true);

INSERT INTO atendimento_scripts (titulo, uso, tipo) VALUES
  ('Boas-vindas novo cliente',          12, 'onboarding'),
  ('Update semanal de obra',            45, 'acompanhamento'),
  ('Solicitacao de vistoria',            8, 'vistoria'),
  ('Gestao de expectativa (atraso)',     6, 'crise'),
  ('Convite NPS',                       15, 'nps'),
  ('Pos-obra check-in 30d',              4, 'pos-venda');
