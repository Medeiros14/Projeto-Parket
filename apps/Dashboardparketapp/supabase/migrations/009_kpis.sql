-- ================================================================
-- PARKET DASHBOARD — KPIs Dinâmicos (calculados dos kanban_cards)
-- ================================================================

-- ─── VIEW: métricas ao vivo por departamento ───────────────────
CREATE OR REPLACE VIEW public.dept_kpis_live AS
SELECT
  dept_id,
  COUNT(*)                                                                 AS total_cards,
  COUNT(*) FILTER (WHERE sla_status = 'expired')                          AS expired_cards,
  COUNT(*) FILTER (WHERE sla_status = 'warning')                          AS warning_cards,
  COUNT(*) FILTER (WHERE sla_status = 'ok')                               AS ok_cards,
  ROUND(
    100.0 * COUNT(*) FILTER (WHERE sla_status = 'ok')
    / NULLIF(COUNT(*), 0)
  )                                                                        AS sla_ok_pct,
  COUNT(*) FILTER (WHERE 'bloqueado' = ANY(tags))                         AS blocked_cards,
  COUNT(*) FILTER (WHERE priority = 'alta')                               AS high_priority,
  ROUND(AVG(progress) FILTER (WHERE progress IS NOT NULL))                 AS avg_progress,
  COALESCE(
    ROUND(
      100.0 * SUM(checklist_done) / NULLIF(SUM(checklist_total), 0)
    ), 0
  )                                                                        AS checklist_pct,
  COUNT(*) FILTER (WHERE column_id ILIKE '%handoff%')                     AS in_handoff
FROM public.kanban_cards
GROUP BY dept_id;

-- ─── FUNCTION: snapshot de KPIs para histórico ────────────────
CREATE TABLE IF NOT EXISTS public.kpi_snapshots (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  dept_id     TEXT        NOT NULL,
  snapshot_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  total_cards INTEGER,
  expired_cards INTEGER,
  sla_ok_pct  NUMERIC,
  blocked_cards INTEGER,
  high_priority INTEGER,
  avg_progress  NUMERIC,
  checklist_pct NUMERIC,
  in_handoff    INTEGER
);

CREATE INDEX IF NOT EXISTS idx_kpi_snapshots_dept ON public.kpi_snapshots (dept_id, snapshot_at DESC);

ALTER TABLE public.kpi_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth_read_kpi_snapshots" ON public.kpi_snapshots
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "auth_write_kpi_snapshots" ON public.kpi_snapshots
  FOR INSERT WITH CHECK (public.current_user_role() IN ('superadmin','admin'));

-- ─── FUNCTION: grava snapshot atual e retorna ─────────────────
CREATE OR REPLACE FUNCTION public.save_kpi_snapshot(p_dept_id TEXT DEFAULT NULL)
RETURNS SETOF public.kpi_snapshots AS $$
BEGIN
  RETURN QUERY
  INSERT INTO public.kpi_snapshots (
    dept_id, total_cards, expired_cards, sla_ok_pct,
    blocked_cards, high_priority, avg_progress, checklist_pct, in_handoff
  )
  SELECT
    dept_id, total_cards, expired_cards, sla_ok_pct,
    blocked_cards, high_priority, avg_progress, checklist_pct, in_handoff
  FROM public.dept_kpis_live
  WHERE (p_dept_id IS NULL OR dept_id = p_dept_id)
  RETURNING *;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ─── SEED: snapshot inicial ────────────────────────────────────
SELECT public.save_kpi_snapshot();

-- ================================================================
-- CONCLUÍDO
-- ================================================================
