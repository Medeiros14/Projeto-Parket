-- ================================================================
-- PARKET DASHBOARD — Financeiro Dinâmico
-- Tabelas: fluxo_caixa, dre, margens_obra, recebiveis
-- ================================================================

-- ─── 1. FLUXO DE CAIXA ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.financeiro_fluxo_caixa (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  periodo     TEXT        NOT NULL,          -- "S1 Mar", "S2 Mar" ...
  periodo_dt  DATE        NOT NULL,          -- data real do início do período
  entradas    NUMERIC(12,2) NOT NULL DEFAULT 0,
  saidas      NUMERIC(12,2) NOT NULL DEFAULT 0,
  saldo       NUMERIC(12,2) GENERATED ALWAYS AS (entradas - saidas) STORED,
  obs         TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_fluxo_caixa_dt ON public.financeiro_fluxo_caixa (periodo_dt DESC);
ALTER TABLE public.financeiro_fluxo_caixa ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth_read_fluxo" ON public.financeiro_fluxo_caixa FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "auth_write_fluxo" ON public.financeiro_fluxo_caixa FOR ALL USING (public.current_user_role() IN ('superadmin','admin','dept_leader'));

-- ─── 2. DRE (Demonstração de Resultado) ───────────────────────
CREATE TABLE IF NOT EXISTS public.financeiro_dre (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  periodo     TEXT        NOT NULL,          -- "Mar/2026"
  periodo_dt  DATE        NOT NULL,
  item        TEXT        NOT NULL,          -- "Receita Bruta"
  valor_num   NUMERIC(14,2) NOT NULL,
  perc        NUMERIC(6,2) NOT NULL,         -- % sobre receita bruta
  cor         TEXT        NOT NULL DEFAULT 'green', -- green | red | orange | yellow
  posicao     INTEGER     NOT NULL DEFAULT 0, -- ordem de exibição
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dre_periodo ON public.financeiro_dre (periodo_dt DESC, posicao);
ALTER TABLE public.financeiro_dre ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth_read_dre" ON public.financeiro_dre FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "auth_write_dre" ON public.financeiro_dre FOR ALL USING (public.current_user_role() IN ('superadmin','admin','dept_leader'));

-- ─── 3. MARGENS POR OBRA ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.financeiro_margens (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  obra_code       TEXT        NOT NULL,      -- "PKT-042"
  obra_id         TEXT        REFERENCES public.obras(id) ON DELETE SET NULL,
  cliente         TEXT        NOT NULL,
  contrato_num    NUMERIC(14,2) NOT NULL,
  custo_orcado    NUMERIC(14,2),
  custo_real      NUMERIC(14,2),
  margem_orc      NUMERIC(6,2),             -- %
  margem_real     NUMERIC(6,2),             -- %
  status          TEXT        NOT NULL DEFAULT 'saudavel'
                              CHECK (status IN ('saudavel','atencao','risco')),
  fase            TEXT,
  progresso       INTEGER     CHECK (progresso BETWEEN 0 AND 100),
  responsavel     TEXT,
  nc_abertas      INTEGER     NOT NULL DEFAULT 0,
  retrabalhos     INTEGER     NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_margens_status ON public.financeiro_margens (status);
ALTER TABLE public.financeiro_margens ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth_read_margens" ON public.financeiro_margens FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "auth_write_margens" ON public.financeiro_margens FOR ALL USING (public.current_user_role() IN ('superadmin','admin','dept_leader'));

-- ─── 4. RECEBÍVEIS (Aging) ────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.financeiro_recebiveis (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  obra_code   TEXT        NOT NULL,
  obra_id     TEXT        REFERENCES public.obras(id) ON DELETE SET NULL,
  contato     TEXT        NOT NULL,
  valor_num   NUMERIC(14,2) NOT NULL,
  vencimento  DATE        NOT NULL,
  dias_atraso INTEGER     NOT NULL DEFAULT 0,  -- atualizado via trigger / recálculo
  status      TEXT        NOT NULL DEFAULT 'a vencer'
              CHECK (status IN ('atrasado','vencendo','a vencer','futuro','recebido')),
  parcela     INTEGER,
  total_parcelas INTEGER,
  obs         TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Função para calcular dias_atraso ao inserir/atualizar
CREATE OR REPLACE FUNCTION public.calc_dias_atraso()
RETURNS TRIGGER AS $$
BEGIN
  NEW.dias_atraso := GREATEST(0, (CURRENT_DATE - NEW.vencimento)::INTEGER);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER trg_recebiveis_dias_atraso
  BEFORE INSERT OR UPDATE ON public.financeiro_recebiveis
  FOR EACH ROW EXECUTE FUNCTION public.calc_dias_atraso();

CREATE INDEX IF NOT EXISTS idx_recebiveis_status ON public.financeiro_recebiveis (status, vencimento);
ALTER TABLE public.financeiro_recebiveis ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth_read_recebiveis" ON public.financeiro_recebiveis FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "auth_write_recebiveis" ON public.financeiro_recebiveis FOR ALL USING (public.current_user_role() IN ('superadmin','admin','dept_leader'));

-- ================================================================
-- SEED — dados reais do Parket (Mar/2026)
-- ================================================================

-- FLUXO DE CAIXA
INSERT INTO public.financeiro_fluxo_caixa (periodo, periodo_dt, entradas, saidas) VALUES
('S1 Mar', '2026-03-02', 380, 245),
('S2 Mar', '2026-03-09', 290, 310),
('S3 Mar', '2026-03-16', 450, 280),
('S4 Mar', '2026-03-23', 320, 295),
('S1 Abr', '2026-03-30', 280, 260);

-- DRE Mar/2026
INSERT INTO public.financeiro_dre (periodo, periodo_dt, item, valor_num, perc, cor, posicao) VALUES
('Mar/2026', '2026-03-01', 'Receita Bruta',    1420000,  100.0, 'green',  0),
('Mar/2026', '2026-03-01', '(-) Impostos',       142000,  -10.0, 'red',    1),
('Mar/2026', '2026-03-01', 'Receita Liquida',   1278000,   90.0, 'green',  2),
('Mar/2026', '2026-03-01', '(-) CMV',            845100,  -59.5, 'orange', 3),
('Mar/2026', '2026-03-01', 'Lucro Bruto',        432900,   30.5, 'green',  4),
('Mar/2026', '2026-03-01', '(-) Despesas Op.',   180300,  -12.7, 'yellow', 5),
('Mar/2026', '2026-03-01', 'EBITDA',             252600,   17.8, 'green',  6);

-- MARGENS POR OBRA
INSERT INTO public.financeiro_margens
  (obra_code, cliente, contrato_num, custo_orcado, custo_real, margem_orc, margem_real, status, fase, progresso, responsavel, nc_abertas, retrabalhos)
VALUES
('PKT-042', 'Familia Andrade',    185000, 118000, 112000, 36.2, 39.5, 'saudavel', 'Entrega',    88, 'Talita',  0, 2),
('PKT-045', 'Studio MV Arq.',     312000, 198000,  89000, 36.5, 34.1, 'saudavel', 'Compras',    42, 'Thainara',1, 0),
('PKT-048', 'Arq. Marina Luz',    228000, 148000,  12000, 35.1, 35.1, 'atencao',  'Projeto',    12, 'Thainara',0, 0),
('PKT-050', 'Familia Costa Lima', 290000, 195000, 118000, 32.8, 28.9, 'risco',    'Fabrica',    55, 'Germano', 2, 4),
('PKT-053', 'Res. Faria Lima',    398000, 252000, 172000, 36.7, 33.2, 'saudavel', 'Liberacao',  65, 'Talita',  1, 3),
('PKT-061', 'Trocha Family',      850000, 530000,  45000, 37.6,  5.3, 'atencao',  'Compras',    15, 'Ronaldo', 0, 0),
('PKT-055', 'Pedro Campos',       185000, 118000, 145000, 36.2, 21.6, 'risco',    'Execucao',   72, 'Dany',    0, 1),
('PKT-058', 'Jorbel Paraguay',    420000, 264000,  18000, 37.1,  4.3, 'atencao',  'Execucao',   15, 'Ailton',  0, 0);

-- RECEBÍVEIS
INSERT INTO public.financeiro_recebiveis
  (obra_code, contato, valor_num, vencimento, status, parcela, total_parcelas, obs)
VALUES
('PKT-045', 'Studio MV Arq.',     28000, '2026-03-04', 'atrasado',  2, 3, 'Parcela 2 — 8 dias atraso'),
('PKT-050', 'Fam. Costa Lima',    17000, '2026-03-09', 'atrasado',  2, 3, 'Parcela 2 — venceu semana passada'),
('PKT-048', 'Arq. Marina Luz',    78000, '2026-03-18', 'a vencer',  1, 4, 'Primeira medicao parcial'),
('PKT-053', 'Res. Faria Lima',   145000, '2026-03-28', 'futuro',    3, 4, 'Medicao 3/4 aprovada'),
('PKT-061', 'Trocha Family',      62000, '2026-03-14', 'vencendo',  1, 5, 'Sinal obra internacional'),
('PKT-055', 'Pedro Campos',       45000, '2026-02-28', 'atrasado',  3, 4, 'Terceira parcela — obra paralisada'),
('PKT-042', 'Familia Andrade',    85000, '2026-04-10', 'futuro',    4, 4, 'Saldo final — pendente aceite');

-- ================================================================
-- VIEW: resumo financeiro geral
-- ================================================================
CREATE OR REPLACE VIEW public.financeiro_resumo AS
SELECT
  (SELECT COALESCE(SUM(valor_num), 0) FROM public.financeiro_dre WHERE item = 'Receita Bruta' AND periodo_dt >= DATE_TRUNC('month', NOW())) AS receita_bruta_mes,
  (SELECT COALESCE(SUM(valor_num), 0) FROM public.financeiro_dre WHERE item = 'EBITDA' AND periodo_dt >= DATE_TRUNC('month', NOW()))        AS ebitda_mes,
  (SELECT COUNT(*) FROM public.financeiro_recebiveis WHERE status IN ('atrasado','vencendo'))                                               AS recebiveis_criticos,
  (SELECT COALESCE(SUM(valor_num), 0) FROM public.financeiro_recebiveis WHERE status IN ('atrasado','vencendo'))                           AS valor_recebiveis_criticos,
  (SELECT COUNT(*) FROM public.financeiro_margens WHERE status = 'risco')                                                                   AS obras_em_risco,
  (SELECT COUNT(*) FROM public.financeiro_margens WHERE status = 'saudavel')                                                                AS obras_saudaveis,
  (SELECT ROUND(AVG(margem_real), 1) FROM public.financeiro_margens WHERE margem_real IS NOT NULL)                                          AS margem_media_real;

-- ================================================================
-- CONCLUÍDO
-- ================================================================
