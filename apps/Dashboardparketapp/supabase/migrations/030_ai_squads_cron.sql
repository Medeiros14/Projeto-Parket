/* ═══════════════════════════════════════════════════════════════════
   MIGRATION 030 — Parket Squad Skills · Cron Management · AI Tasks
   ═══════════════════════════════════════════════════════════════════ */

/* ─── 1. TABELAS ─── */

/* Registro de squads/agentes de IA */
CREATE TABLE IF NOT EXISTS ai_squads (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT NOT NULL,
  description   TEXT,
  dept_id       TEXT,                         -- NULL = transversal
  agent_type    TEXT DEFAULT 'area_agent'     -- control_tower | area_agent | specialist | webhook
                CHECK (agent_type IN ('control_tower','area_agent','specialist','webhook')),
  status        TEXT DEFAULT 'inactive'       -- active | inactive | error | running | paused
                CHECK (status IN ('active','inactive','error','running','paused')),
  webhook_url   TEXT,
  capabilities  TEXT[] DEFAULT '{}',
  config        JSONB DEFAULT '{}',
  last_ping_at  TIMESTAMPTZ,
  last_task_at  TIMESTAMPTZ,
  tasks_completed INTEGER DEFAULT 0,
  tasks_failed    INTEGER DEFAULT 0,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

/* Fila de tarefas da IA */
CREATE TABLE IF NOT EXISTS ai_task_queue (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  squad_id      UUID REFERENCES ai_squads(id) ON DELETE SET NULL,
  task_type     TEXT NOT NULL,               -- risk_scoring | weekly_report | gate_reminder | sla_check | custom
  payload       JSONB DEFAULT '{}',
  status        TEXT DEFAULT 'pending'       -- pending | running | completed | failed | cancelled
                CHECK (status IN ('pending','running','completed','failed','cancelled')),
  triggered_by  TEXT DEFAULT 'cron'          -- cron | manual | alert | handoff | webhook
                CHECK (triggered_by IN ('cron','manual','alert','handoff','webhook')),
  priority      INTEGER DEFAULT 5,          -- 1 (highest) – 10 (lowest)
  scheduled_at  TIMESTAMPTZ DEFAULT NOW(),
  started_at    TIMESTAMPTZ,
  completed_at  TIMESTAMPTZ,
  result        JSONB,
  error_message TEXT,
  created_by    UUID REFERENCES auth.users(id),
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

/* Log de execuções (cron + manual + webhook) */
CREATE TABLE IF NOT EXISTS ai_task_logs (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_name         TEXT NOT NULL,
  squad_id         UUID REFERENCES ai_squads(id) ON DELETE SET NULL,
  triggered_by     TEXT DEFAULT 'cron',
  started_at       TIMESTAMPTZ DEFAULT NOW(),
  completed_at     TIMESTAMPTZ,
  duration_ms      INTEGER,
  status           TEXT DEFAULT 'running'
                   CHECK (status IN ('running','success','error','timeout','skipped')),
  records_affected INTEGER DEFAULT 0,
  output           JSONB,
  error_message    TEXT,
  created_by       UUID REFERENCES auth.users(id)
);

/* Configuração de jobs cron gerenciáveis pelo admin */
CREATE TABLE IF NOT EXISTS cron_job_configs (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT NOT NULL UNIQUE,
  description   TEXT,
  schedule      TEXT NOT NULL,              -- cron expression ex: "0 7 * * *"
  command       TEXT NOT NULL,              -- SQL command executado pelo pg_cron
  category      TEXT DEFAULT 'system'       -- system | ai | alerts | reports | custom
                CHECK (category IN ('system','ai','alerts','reports','custom')),
  dept_id       TEXT,                       -- NULL = global
  enabled       BOOLEAN DEFAULT TRUE,
  last_run_at   TIMESTAMPTZ,
  last_status   TEXT,                       -- success | error | skipped
  last_error    TEXT,
  run_count     INTEGER DEFAULT 0,
  created_by    UUID REFERENCES auth.users(id),
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

/* ─── 2. ÍNDICES ─── */
CREATE INDEX IF NOT EXISTS idx_ai_task_queue_status    ON ai_task_queue (status, scheduled_at);
CREATE INDEX IF NOT EXISTS idx_ai_task_queue_squad     ON ai_task_queue (squad_id);
CREATE INDEX IF NOT EXISTS idx_ai_task_logs_job        ON ai_task_logs  (job_name, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_task_logs_status     ON ai_task_logs  (status, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_cron_job_configs_cat    ON cron_job_configs (category, enabled);

/* ─── 3. RLS ─── */
ALTER TABLE ai_squads           ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_task_queue       ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_task_logs        ENABLE ROW LEVEL SECURITY;
ALTER TABLE cron_job_configs    ENABLE ROW LEVEL SECURITY;

/* Leitura: qualquer autenticado */
CREATE POLICY "read_ai_squads"        ON ai_squads        FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY "read_ai_task_queue"    ON ai_task_queue    FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY "read_ai_task_logs"     ON ai_task_logs     FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY "read_cron_job_configs" ON cron_job_configs FOR SELECT TO authenticated USING (TRUE);

/* Escrita: superadmin + admin */
CREATE POLICY "write_ai_squads"        ON ai_squads        FOR ALL TO authenticated
  USING (current_user_role() IN ('superadmin','admin'));
CREATE POLICY "write_ai_task_queue"    ON ai_task_queue    FOR ALL TO authenticated
  USING (current_user_role() IN ('superadmin','admin'));
CREATE POLICY "write_ai_task_logs"     ON ai_task_logs     FOR ALL TO authenticated
  USING (current_user_role() IN ('superadmin','admin'));
CREATE POLICY "write_cron_job_configs" ON cron_job_configs FOR ALL TO authenticated
  USING (current_user_role() IN ('superadmin','admin'));

/* ─── 4. FUNÇÕES AUXILIARES ─── */

/* Calcula pontuação de risco de uma obra (0-100, menor = pior) */
CREATE OR REPLACE FUNCTION calc_obra_risk_score(p_obra_id UUID)
RETURNS INTEGER LANGUAGE plpgsql AS $$
DECLARE
  v_score    INTEGER := 100;
  v_obra     RECORD;
  v_expired  INTEGER;
  v_pending  INTEGER;
BEGIN
  SELECT progresso, status, data_prevista_entrega, prioridade
  INTO v_obra
  FROM obras WHERE id = p_obra_id;

  IF NOT FOUND THEN RETURN 100; END IF;

  -- Progresso baixo (< 30% e não aguardando)
  IF v_obra.progresso < 30 AND v_obra.status NOT IN ('aguardando','concluida') THEN
    v_score := v_score - 20;
  ELSIF v_obra.progresso < 60 AND v_obra.status = 'em_execucao' THEN
    v_score := v_score - 10;
  END IF;

  -- Prazo vencido
  IF v_obra.data_prevista_entrega IS NOT NULL AND v_obra.data_prevista_entrega < NOW() AND v_obra.status != 'concluida' THEN
    v_score := v_score - 30;
  END IF;

  -- Status travada
  IF v_obra.status = 'travada' THEN v_score := v_score - 25; END IF;

  -- Cards SLA expirados
  SELECT COUNT(*) INTO v_expired
  FROM kanban_cards WHERE obra_id = p_obra_id AND sla_status = 'expired';
  v_score := v_score - LEAST(v_expired * 5, 20);

  -- Handoffs pendentes há mais de 72h
  SELECT COUNT(*) INTO v_pending
  FROM handoffs
  WHERE obra_id = p_obra_id AND status = 'pendente'
    AND created_at < NOW() - INTERVAL '72 hours';
  v_score := v_score - LEAST(v_pending * 8, 16);

  -- Prioridade crítica
  IF v_obra.prioridade = 'critica' THEN v_score := v_score - 5; END IF;

  RETURN GREATEST(v_score, 0);
END;
$$;

/* Gera pontuação de risco para todas as obras ativas → cria alertas se score < 60 */
CREATE OR REPLACE FUNCTION run_risk_scoring()
RETURNS INTEGER LANGUAGE plpgsql AS $$
DECLARE
  v_obra    RECORD;
  v_score   INTEGER;
  v_count   INTEGER := 0;
  v_log_id  UUID;
BEGIN
  /* Registra início no log */
  INSERT INTO ai_task_logs (job_name, triggered_by, status)
  VALUES ('risk_scoring', 'cron', 'running')
  RETURNING id INTO v_log_id;

  FOR v_obra IN
    SELECT id, nome, status FROM obras
    WHERE status IN ('em_execucao','travada','mobilizacao')
  LOOP
    v_score := calc_obra_risk_score(v_obra.id);

    IF v_score < 60 THEN
      INSERT INTO alertas (
        obra_id, obra_nome, tipo, type, mensagem, description,
        status, departamento, prioridade, sla_horas, first_seen_at
      ) VALUES (
        v_obra.id,
        v_obra.nome,
        CASE WHEN v_score < 40 THEN 'risco_critico' ELSE 'risco_moderado' END,
        CASE WHEN v_score < 40 THEN 'critical'      ELSE 'warning' END,
        format('⚠️ Obra "%s" com pontuação de risco %s/100', v_obra.nome, v_score),
        format('Risk score calculado pelos agentes Parket Squad. Indicadores: progresso, prazo, SLAs e handoffs.'),
        'open',
        'obras',
        CASE WHEN v_score < 40 THEN 'critica' ELSE 'alta' END,
        CASE WHEN v_score < 40 THEN 4 ELSE 24 END,
        NOW()
      )
      ON CONFLICT DO NOTHING;
      v_count := v_count + 1;
    END IF;
  END LOOP;

  /* Atualiza log com resultado */
  UPDATE ai_task_logs SET
    status = 'success',
    completed_at = NOW(),
    duration_ms = EXTRACT(MILLISECONDS FROM (NOW() - started_at))::INTEGER,
    records_affected = v_count,
    output = jsonb_build_object('obras_analisadas', (SELECT COUNT(*) FROM obras WHERE status IN ('em_execucao','travada','mobilizacao')), 'alertas_gerados', v_count)
  WHERE id = v_log_id;

  RETURN v_count;
END;
$$;

/* Gera relatório semanal da Control Tower → alerta consolidado */
CREATE OR REPLACE FUNCTION generate_weekly_report()
RETURNS VOID LANGUAGE plpgsql AS $$
DECLARE
  v_total_obras    INTEGER;
  v_criticas       INTEGER;
  v_sla_expirados  INTEGER;
  v_handoffs_pend  INTEGER;
  v_score_medio    INTEGER;
  v_log_id         UUID;
BEGIN
  INSERT INTO ai_task_logs (job_name, triggered_by, status)
  VALUES ('weekly_report', 'cron', 'running')
  RETURNING id INTO v_log_id;

  SELECT COUNT(*) INTO v_total_obras   FROM obras WHERE status IN ('em_execucao','travada','mobilizacao','aguardando');
  SELECT COUNT(*) INTO v_criticas      FROM obras WHERE prioridade = 'critica' AND status != 'concluida';
  SELECT COUNT(*) INTO v_sla_expirados FROM kanban_cards WHERE sla_status = 'expired';
  SELECT COUNT(*) INTO v_handoffs_pend FROM handoffs WHERE status = 'pendente' AND created_at < NOW() - INTERVAL '48 hours';

  INSERT INTO alertas (
    tipo, type, mensagem, description, status, departamento, prioridade, first_seen_at
  ) VALUES (
    'relatorio_semanal',
    'info',
    format('📋 Relatório Semanal Control Tower — %s obras · %s críticas · %s SLAs vencidos · %s handoffs atrasados',
      v_total_obras, v_criticas, v_sla_expirados, v_handoffs_pend),
    format('Relatório gerado automaticamente pelo agente Control Tower Parket Squad. Semana de %s.',
      TO_CHAR(NOW(), 'DD/MM/YYYY')),
    'open',
    'geral',
    'baixa',
    NOW()
  );

  UPDATE ai_task_logs SET
    status = 'success', completed_at = NOW(),
    duration_ms = EXTRACT(MILLISECONDS FROM (NOW() - started_at))::INTEGER,
    output = jsonb_build_object(
      'total_obras', v_total_obras, 'criticas', v_criticas,
      'sla_expirados', v_sla_expirados, 'handoffs_pendentes', v_handoffs_pend
    )
  WHERE id = v_log_id;
END;
$$;

/* Lembretes de gate próximo (obras com prazo de gate em 48-72h) */
CREATE OR REPLACE FUNCTION process_gate_reminders()
RETURNS INTEGER LANGUAGE plpgsql AS $$
DECLARE
  v_card   RECORD;
  v_count  INTEGER := 0;
  v_log_id UUID;
BEGIN
  INSERT INTO ai_task_logs (job_name, triggered_by, status)
  VALUES ('gate_reminders', 'cron', 'running')
  RETURNING id INTO v_log_id;

  FOR v_card IN
    SELECT kc.id, kc.title, kc.obra_id, kc.due_date, kc.dept_id, o.nome AS obra_nome
    FROM kanban_cards kc
    LEFT JOIN obras o ON o.id = kc.obra_id
    WHERE kc.due_date BETWEEN NOW() AND NOW() + INTERVAL '72 hours'
      AND kc.sla_status != 'expired'
      AND kc.status NOT IN ('done','concluido','entregue')
  LOOP
    INSERT INTO alertas (
      obra_id, obra_nome, tipo, type, mensagem, status, departamento, prioridade, sla_horas
    ) VALUES (
      v_card.obra_id,
      v_card.obra_nome,
      'gate_deadline',
      'warning',
      format('⏰ Card "%s" vence em menos de 72h — Obra: %s', v_card.title, COALESCE(v_card.obra_nome,'')),
      'open',
      COALESCE(v_card.dept_id,'geral'),
      'media',
      72
    )
    ON CONFLICT DO NOTHING;
    v_count := v_count + 1;
  END LOOP;

  UPDATE ai_task_logs SET
    status = 'success', completed_at = NOW(),
    duration_ms = EXTRACT(MILLISECONDS FROM (NOW() - started_at))::INTEGER,
    records_affected = v_count
  WHERE id = v_log_id;

  RETURN v_count;
END;
$$;

/* Função para admin gerenciar pg_cron via RPC (SECURITY DEFINER) */
CREATE OR REPLACE FUNCTION manage_cron_job(
  p_action    TEXT,    -- 'schedule' | 'unschedule'
  p_job_name  TEXT,
  p_schedule  TEXT DEFAULT NULL,
  p_command   TEXT DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, cron
AS $$
DECLARE
  v_job_id BIGINT;
BEGIN
  IF p_action = 'unschedule' THEN
    SELECT jobid INTO v_job_id FROM cron.job WHERE jobname = p_job_name;
    IF v_job_id IS NOT NULL THEN
      PERFORM cron.unschedule(v_job_id);
    END IF;
    RETURN jsonb_build_object('success', TRUE, 'action', 'unscheduled', 'job', p_job_name);

  ELSIF p_action = 'schedule' THEN
    -- Unschedule first if exists
    SELECT jobid INTO v_job_id FROM cron.job WHERE jobname = p_job_name;
    IF v_job_id IS NOT NULL THEN
      PERFORM cron.unschedule(v_job_id);
    END IF;
    -- Schedule new
    SELECT cron.schedule(p_job_name, p_schedule, p_command) INTO v_job_id;
    RETURN jsonb_build_object('success', TRUE, 'action', 'scheduled', 'job', p_job_name, 'job_id', v_job_id);

  ELSE
    RETURN jsonb_build_object('success', FALSE, 'error', 'Action inválida: use schedule ou unschedule');
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION manage_cron_job FROM PUBLIC;
GRANT EXECUTE ON FUNCTION manage_cron_job TO authenticated;

/* Função para listar jobs do pg_cron (SECURITY DEFINER) */
CREATE OR REPLACE FUNCTION list_cron_jobs()
RETURNS TABLE (
  jobid     BIGINT,
  jobname   TEXT,
  schedule  TEXT,
  command   TEXT,
  active    BOOLEAN,
  username  TEXT
) LANGUAGE plpgsql SECURITY DEFINER SET search_path = cron, public AS $$
BEGIN
  RETURN QUERY SELECT j.jobid, j.jobname, j.schedule, j.command, j.active, j.username
               FROM cron.job j ORDER BY j.jobname;
END;
$$;

REVOKE ALL ON FUNCTION list_cron_jobs FROM PUBLIC;
GRANT EXECUTE ON FUNCTION list_cron_jobs TO authenticated;

/* View para painel de logs recentes */
CREATE OR REPLACE VIEW ai_task_logs_view AS
SELECT
  l.*,
  s.name  AS squad_name,
  s.agent_type,
  s.dept_id AS squad_dept
FROM ai_task_logs l
LEFT JOIN ai_squads s ON s.id = l.squad_id
ORDER BY l.started_at DESC;

GRANT SELECT ON ai_task_logs_view TO authenticated;

/* ─── 5. SEED — Squads iniciais ─── */
INSERT INTO ai_squads (name, description, dept_id, agent_type, status, capabilities) VALUES
  ('Control Tower',           'Agente central de inteligência — consolida dados de todos os departamentos, detecta riscos, impõe prioridades e gera relatórios para a Diretoria.', NULL,        'control_tower', 'active',   ARRAY['risk_scoring','weekly_report','war_room','priority_matrix']),
  ('Agente Obras',            'Monitora cronograma, gates e equipes de campo. Dispara alertas de atraso e bloqueia gates sem checklist completo.',                            'obras',       'area_agent',    'active',   ARRAY['gate_check','team_monitor','field_alerts','progress_tracking']),
  ('Agente Comercial',        'Acompanha funil de vendas, SLAs de proposta e follow-up. Notifica quando leads ficam parados.',                                               'comercial',   'area_agent',    'active',   ARRAY['funnel_monitor','proposal_sla','followup_reminder']),
  ('Agente Financeiro',       'Monitora fluxo de caixa, medições vencidas e inadimplência. Gera alertas de risco financeiro.',                                              'financeiro',  'area_agent',    'active',   ARRAY['cashflow','billing_sla','default_alert']),
  ('Agente Expedição',        'Controla prazos de entrega de material, Nota Fiscal e logística para obras.',                                                                 'logistica',   'area_agent',    'active',   ARRAY['delivery_tracking','nf_check','logistics_alert']),
  ('Agente Produção',         'Acompanha ordens de produção, FPY (First Pass Yield) e gargalos de linha.',                                                                  'producao',    'area_agent',    'active',   ARRAY['production_order','fpy_monitor','bottleneck_alert']),
  ('Agente Compras',          'Monitora lead times críticos, cotações vencidas e rupturas de estoque.',                                                                      'compras',     'area_agent',    'active',   ARRAY['lead_time','quotation_sla','stock_alert']),
  ('Agente Fiscal',           'Acompanha obrigações fiscais, documentos vencidos e auditorias.',                                                                             'fiscal',      'area_agent',    'active',   ARRAY['fiscal_deadline','document_check','audit_alert']),
  ('Agente PMO',              'Monitora produtividade geral, handoffs entre departamentos e closure de projetos.',                                                           'produtividade','area_agent',   'active',   ARRAY['productivity','handoff_monitor','project_closure'])
ON CONFLICT DO NOTHING;

/* ─── 6. SEED — Cron job configs (registro UI dos jobs) ─── */
INSERT INTO cron_job_configs (name, description, schedule, command, category, dept_id, enabled) VALUES
  ('refresh_alertas_4h',        'Atualiza alertas automáticos de todas as obras a cada 4 horas.',             '0 */4 * * *',      'SELECT refresh_auto_alertas()',      'alerts',   NULL,           TRUE),
  ('refresh_alertas_manha',     'Refresh matinal de alertas todos os dias às 7h.',                            '0 7 * * *',        'SELECT refresh_auto_alertas()',      'alerts',   NULL,           TRUE),
  ('risk_scoring_diario',       'Pontuação de risco de obras pelo agente Control Tower — todo dia às 8h.',    '0 8 * * *',        'SELECT run_risk_scoring()',           'ai',       'obras',        TRUE),
  ('gate_reminders_6h',         'Lembretes de cards com gate vencendo em 72h — a cada 6 horas.',              '0 */6 * * *',      'SELECT process_gate_reminders()',    'ai',       'obras',        TRUE),
  ('weekly_control_tower',      'Relatório semanal consolidado da Control Tower — todo domingo às 23h.',      '0 23 * * 0',       'SELECT generate_weekly_report()',    'reports',  NULL,           TRUE),
  ('sla_check_noturno',         'Verificação de SLAs vencidos durante a madrugada — todo dia à meia-noite.', '0 0 * * *',        'SELECT refresh_auto_alertas()',      'alerts',   NULL,           TRUE)
ON CONFLICT (name) DO NOTHING;

/* ─── 7. AGENDAR NOVOS JOBS NO pg_cron ─── */
DO $$
DECLARE v_id BIGINT;
BEGIN
  /* risk_scoring — todo dia 8h */
  SELECT jobid INTO v_id FROM cron.job WHERE jobname = 'risk_scoring_diario';
  IF v_id IS NULL THEN
    PERFORM cron.schedule('risk_scoring_diario', '0 8 * * *', 'SELECT run_risk_scoring()');
  END IF;

  /* gate_reminders — a cada 6h */
  SELECT jobid INTO v_id FROM cron.job WHERE jobname = 'gate_reminders_6h';
  IF v_id IS NULL THEN
    PERFORM cron.schedule('gate_reminders_6h', '0 */6 * * *', 'SELECT process_gate_reminders()');
  END IF;

  /* weekly_control_tower — domingo 23h */
  SELECT jobid INTO v_id FROM cron.job WHERE jobname = 'weekly_control_tower';
  IF v_id IS NULL THEN
    PERFORM cron.schedule('weekly_control_tower', '0 23 * * 0', 'SELECT generate_weekly_report()');
  END IF;

  /* sla_check_noturno — meia-noite */
  SELECT jobid INTO v_id FROM cron.job WHERE jobname = 'sla_check_noturno';
  IF v_id IS NULL THEN
    PERFORM cron.schedule('sla_check_noturno', '0 0 * * *', 'SELECT refresh_auto_alertas()');
  END IF;
END;
$$;
