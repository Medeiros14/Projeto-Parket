-- ================================================================
-- PARKET DASHBOARD — Tabela de Alertas Dinâmicos
-- ================================================================

CREATE TABLE IF NOT EXISTS public.alertas (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  severity      TEXT        NOT NULL DEFAULT 'warning'
                            CHECK (severity IN ('critical', 'warning', 'info')),
  rule          TEXT        NOT NULL,
  message       TEXT        NOT NULL,
  dept          TEXT        NOT NULL,
  obra_id       TEXT        REFERENCES public.obras(id) ON DELETE CASCADE,
  auto_generated BOOLEAN    NOT NULL DEFAULT true,
  resolved      BOOLEAN     NOT NULL DEFAULT false,
  resolved_at   TIMESTAMPTZ,
  resolved_by   TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_alertas_severity  ON public.alertas (severity);
CREATE INDEX IF NOT EXISTS idx_alertas_dept      ON public.alertas (dept);
CREATE INDEX IF NOT EXISTS idx_alertas_resolved  ON public.alertas (resolved);
CREATE INDEX IF NOT EXISTS idx_alertas_obra      ON public.alertas (obra_id);

CREATE OR REPLACE TRIGGER trg_alertas_updated_at
  BEFORE UPDATE ON public.alertas
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.alertas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth_read_alertas" ON public.alertas
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "auth_write_alertas" ON public.alertas
  FOR INSERT WITH CHECK (public.current_user_role() IN ('superadmin', 'admin', 'dept_leader'));

CREATE POLICY "auth_update_alertas" ON public.alertas
  FOR UPDATE USING (public.current_user_role() IN ('superadmin', 'admin', 'dept_leader'));

CREATE POLICY "auth_delete_alertas" ON public.alertas
  FOR DELETE USING (public.current_user_role() IN ('superadmin', 'admin'));

-- ================================================================
-- FUNÇÃO: Gerar alertas automaticamente a partir das obras
-- Chamada via trigger ou manualmente
-- ================================================================

CREATE OR REPLACE FUNCTION public.refresh_auto_alertas()
RETURNS void AS $$
BEGIN
  -- Remove alertas automáticos antigos (serão recriados)
  DELETE FROM public.alertas WHERE auto_generated = true;

  -- REGRA: obras travadas → critical
  INSERT INTO public.alertas (severity, rule, message, dept, obra_id, auto_generated)
  SELECT
    'critical',
    'obra_travada',
    'Obra ' || id || ' (' || cliente || ') está TRAVADA — gate ' || gate || ' · ' || localizacao,
    'Obras',
    id,
    true
  FROM public.obras
  WHERE status = 'travado';

  -- REGRA: obras de alta prioridade aguardando → warning
  INSERT INTO public.alertas (severity, rule, message, dept, obra_id, auto_generated)
  SELECT
    'warning',
    'alta_prioridade_aguardando',
    'Obra ' || id || ' (' || cliente || ') é ALTA PRIORIDADE mas está aguardando início · ' || localizacao,
    'PMO',
    id,
    true
  FROM public.obras
  WHERE prioridade = 'alta' AND status = 'aguardando';

  -- REGRA: obras em execução com progresso < 25% no gate 3+ → warning
  INSERT INTO public.alertas (severity, rule, message, dept, obra_id, auto_generated)
  SELECT
    'warning',
    'progresso_baixo_gate_alto',
    'Obra ' || id || ' (' || cliente || ') com ' || progresso || '% de progresso no Gate ' || gate || ' — possível atraso',
    'PMO',
    id,
    true
  FROM public.obras
  WHERE status = 'em_execucao' AND progresso < 25 AND gate >= 3;

  -- REGRA: obras em execução com data de finalização vencida → critical
  INSERT INTO public.alertas (severity, rule, message, dept, obra_id, auto_generated)
  SELECT
    'critical',
    'prazo_vencido',
    'Obra ' || id || ' (' || cliente || ') com prazo VENCIDO — prevista para ' || TO_CHAR(data_finalizacao, 'DD/MM/YYYY'),
    'Obras',
    id,
    true
  FROM public.obras
  WHERE status NOT IN ('finalizado', 'aguardando')
    AND data_finalizacao IS NOT NULL
    AND data_finalizacao < CURRENT_DATE;

  -- REGRA: obras mobilização com progresso 0 → info
  INSERT INTO public.alertas (severity, rule, message, dept, obra_id, auto_generated)
  SELECT
    'info',
    'mobilizacao_iniciando',
    'Obra ' || id || ' (' || cliente || ') em mobilização — equipe se deslocando para ' || localizacao,
    'Logística',
    id,
    true
  FROM public.obras
  WHERE status = 'mobilizacao' AND progresso <= 10;

  -- REGRA: obras internacionais em execução → info
  INSERT INTO public.alertas (severity, rule, message, dept, obra_id, auto_generated)
  SELECT
    'info',
    'obra_internacional',
    'Obra internacional ' || id || ' (' || cliente || ') em andamento — ' || localizacao || ' · ' || progresso || '% concluído',
    'PMO',
    id,
    true
  FROM public.obras
  WHERE regiao = 'PY' AND status NOT IN ('finalizado', 'aguardando');

END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ================================================================
-- TRIGGER: Regenera alertas automáticos sempre que uma obra muda
-- ================================================================

CREATE OR REPLACE FUNCTION public.trg_refresh_alertas_on_obra_change()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM public.refresh_auto_alertas();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_obras_refresh_alertas ON public.obras;
CREATE TRIGGER trg_obras_refresh_alertas
  AFTER INSERT OR UPDATE OR DELETE ON public.obras
  FOR EACH STATEMENT EXECUTE FUNCTION public.trg_refresh_alertas_on_obra_change();

-- ================================================================
-- SEED — Alertas manuais fixos (regras de negócio / processos)
-- ================================================================

INSERT INTO public.alertas (severity, rule, message, dept, obra_id, auto_generated) VALUES
('warning', 'handoff_vencido',
  '3 handoffs vencidos entre Compras→Produção — SLA médio estourado em 4h',
  'Compras', NULL, false),

('warning', 'diario_faltando',
  '2 equipes não preencheram diário de obra ontem (Equipe Gamma, Equipe Delta)',
  'PMO', NULL, false),

('info', 'meta_atingida',
  'Comercial: taxa de fechamento 34% vs meta 30% — meta batida este mês',
  'Comercial', NULL, false),

('warning', 'lead_sem_contato',
  '5 leads sem próximo passo definido no CRM há 3+ dias',
  'Comercial', NULL, false),

('warning', 'nc_aberta_3d',
  '2 NCs abertas há 3+ dias sem resolução — investigar causa raiz',
  'Produção', NULL, false),

('info', 'produtividade_destaque',
  'Equipe com 22 m²/dia — 28% acima da média. Candidata a bônus.',
  'PMO', NULL, false);

-- ================================================================
-- EXECUTAR a geração inicial de alertas automáticos
-- ================================================================

SELECT public.refresh_auto_alertas();

-- ================================================================
-- CONCLUÍDO
-- ================================================================
