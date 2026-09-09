-- ============================================================
-- RLS Policies — Parket RH + Signer
-- Roles: admin (tudo), rh (sua(s) empresa(s)), gestor (sua equipe),
-- colaborador (só si mesmo)
-- ============================================================

CREATE OR REPLACE FUNCTION rh.user_empresa_ids() RETURNS uuid[]
LANGUAGE sql SECURITY DEFINER STABLE SET search_path = '' AS $$
  SELECT array_agg(empresa_id) FROM rh.app_users
  WHERE user_id = auth.uid() AND ativo = true;
$$;

-- ── app_users ───────────────────────────────────────────────
ALTER TABLE rh.app_users ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "see self" ON rh.app_users;
DROP POLICY IF EXISTS "admin sees all" ON rh.app_users;
DROP POLICY IF EXISTS "admin write" ON rh.app_users;
CREATE POLICY "see self" ON rh.app_users FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "admin sees all" ON rh.app_users FOR SELECT TO authenticated USING (rh.is_admin());
CREATE POLICY "admin write" ON rh.app_users FOR ALL TO authenticated
  USING (rh.is_admin()) WITH CHECK (rh.is_admin());

-- ── colaboradores (RH lê tudo, colaborador lê o próprio) ────
ALTER TABLE rh.colaboradores ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "rh full" ON rh.colaboradores;
DROP POLICY IF EXISTS "self read" ON rh.colaboradores;
CREATE POLICY "rh full" ON rh.colaboradores FOR ALL TO authenticated
  USING (rh.is_rh()) WITH CHECK (rh.is_rh());
CREATE POLICY "self read" ON rh.colaboradores FOR SELECT TO authenticated USING (user_id = auth.uid());

-- ── contratos ───────────────────────────────────────────────
ALTER TABLE rh.contratos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "rh full" ON rh.contratos;
DROP POLICY IF EXISTS "self read" ON rh.contratos;
CREATE POLICY "rh full" ON rh.contratos FOR ALL TO authenticated
  USING (rh.is_rh()) WITH CHECK (rh.is_rh());
CREATE POLICY "self read" ON rh.contratos FOR SELECT TO authenticated
  USING (colaborador_id = rh.current_colaborador_id());

-- ── Tabelas filhas (RH lê tudo) ─────────────────────────────
DO $$
DECLARE t text;
BEGIN
  FOR t IN SELECT unnest(ARRAY[
    'colaborador_estrangeiro','colaborador_nacionalidades',
    'contatos_emergencia','formacao_academica','epi_tamanhos',
    'dependentes','dados_bancarios','documentos_pessoais',
    'contrato_alteracoes','contabilidade_dados','estagio_info',
    'beneficios','afastamentos',
    'admissoes','admissao_documentos',
    'colaborador_escala','batidas_ponto','justificativas_ponto',
    'banco_horas_movimentos','banco_horas_saldos',
    'ferias_periodos_aquisitivos','ferias_periodos_concessivos','ferias_solicitacoes',
    'holerites','holerite_eventos','adiantamentos',
    'desligamentos','verbas_rescisorias',
    'colaborador_treinamentos','avaliacoes','avaliacao_respostas',
    'notificacoes_canal_preferencias','notificacoes'
  ])
  LOOP
    EXECUTE format('ALTER TABLE rh.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS "rh full" ON rh.%I', t);
    EXECUTE format('CREATE POLICY "rh full" ON rh.%I FOR ALL TO authenticated '
                   'USING (rh.is_rh()) WITH CHECK (rh.is_rh())', t);
  END LOOP;
END $$;

-- ── Catálogos (todos leem, RH escreve) ──────────────────────
DO $$
DECLARE t text;
BEGIN
  FOR t IN SELECT unnest(ARRAY[
    'cbos','lotacoes_tributarias','rubricas','sindicatos',
    'departamentos','times','cargos','centros_custo_rh',
    'escalas','escala_horarios',
    'competencias','holerites_lotes',
    'checklist_templates','checklist_template_itens','checklist_execucoes','checklist_execucao_itens',
    'treinamentos_catalogo','trilhas','trilha_treinamentos',
    'ciclos_avaliacao','avaliacao_formularios','avaliacao_perguntas',
    'esocial_lotes','esocial_eventos'
  ])
  LOOP
    EXECUTE format('ALTER TABLE rh.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS "auth read" ON rh.%I', t);
    EXECUTE format('DROP POLICY IF EXISTS "rh write" ON rh.%I', t);
    EXECUTE format('CREATE POLICY "auth read" ON rh.%I FOR SELECT TO authenticated USING (true)', t);
    EXECUTE format('CREATE POLICY "rh write" ON rh.%I FOR ALL TO authenticated '
                   'USING (rh.is_rh()) WITH CHECK (rh.is_rh())', t);
  END LOOP;
END $$;

-- ── Signer ──────────────────────────────────────────────────
ALTER TABLE signer.documentos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "rh full" ON signer.documentos;
CREATE POLICY "rh full" ON signer.documentos FOR ALL TO authenticated
  USING (rh.is_rh()) WITH CHECK (rh.is_rh());

DO $$
DECLARE t text;
BEGIN
  FOR t IN SELECT unnest(ARRAY[
    'signatarios','signatario_links','otp_codes',
    'assinaturas','audit_logs','tsa_carimbos',
    'certificados_parket','tsa_providers'
  ])
  LOOP
    EXECUTE format('ALTER TABLE signer.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS "rh full" ON signer.%I', t);
    EXECUTE format('CREATE POLICY "rh full" ON signer.%I FOR ALL TO authenticated '
                   'USING (rh.is_rh()) WITH CHECK (rh.is_rh())', t);
  END LOOP;
END $$;

GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA rh TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA signer TO authenticated;
GRANT EXECUTE ON FUNCTION rh.is_admin(), rh.is_rh(), rh.current_colaborador_id(),
  rh.user_empresa_ids() TO authenticated;
