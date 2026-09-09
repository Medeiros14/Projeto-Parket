-- ═══════════════════════════════════════════════════════
-- 032_simulacao_orcamento.sql — Simulação de orçamento e geração de propostas
-- ═══════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS simulacao_projetos (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  numero        TEXT NOT NULL DEFAULT '',
  cliente       TEXT NOT NULL,
  cnpj_cpf      TEXT DEFAULT '',
  endereco      TEXT DEFAULT '',
  obra_code     TEXT DEFAULT '',
  vendedor      TEXT DEFAULT '',
  validade_dias INTEGER NOT NULL DEFAULT 15,
  desconto_perc NUMERIC(5,2) NOT NULL DEFAULT 0,
  status        TEXT NOT NULL DEFAULT 'rascunho'
    CHECK (status IN ('rascunho','enviada','aprovada','perdida')),
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS simulacao_itens (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  simulacao_id  UUID REFERENCES simulacao_projetos(id) ON DELETE CASCADE,
  categoria     TEXT NOT NULL,
  descritivo    TEXT NOT NULL,
  valor         NUMERIC(14,2) NOT NULL DEFAULT 0,
  ordem         INTEGER NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE simulacao_projetos ENABLE ROW LEVEL SECURITY;
ALTER TABLE simulacao_itens    ENABLE ROW LEVEL SECURITY;

CREATE POLICY "allow_all_simulacao_projetos" ON simulacao_projetos FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_simulacao_itens"    ON simulacao_itens    FOR ALL USING (true) WITH CHECK (true);
