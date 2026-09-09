-- Portal Space (space.parket.works): catálogo de apps + overrides por usuário
BEGIN;

CREATE TABLE IF NOT EXISTS public.portal_apps (
  id         text PRIMARY KEY,
  nome       text NOT NULL,
  descricao  text NOT NULL DEFAULT '',
  url        text NOT NULL,
  categoria  text NOT NULL DEFAULT 'APLICATIVO',
  ordem      int  NOT NULL DEFAULT 100,
  ativo      boolean NOT NULL DEFAULT true,
  -- null = todos os usuários ativos · {} = só admins · lista = depts com acesso
  depts      text[],
  destaque   boolean NOT NULL DEFAULT false,
  wide       boolean NOT NULL DEFAULT false,
  badge      text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.portal_user_overrides (
  user_id    uuid NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  app_id     text NOT NULL REFERENCES public.portal_apps(id) ON DELETE CASCADE,
  allow      boolean NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, app_id)
);

ALTER TABLE public.portal_apps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.portal_user_overrides ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS portal_apps_read ON public.portal_apps;
CREATE POLICY portal_apps_read ON public.portal_apps
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS portal_apps_admin_write ON public.portal_apps;
CREATE POLICY portal_apps_admin_write ON public.portal_apps
  FOR ALL TO authenticated
  USING (public.current_user_role() IN ('admin','superadmin'))
  WITH CHECK (public.current_user_role() IN ('admin','superadmin'));

DROP POLICY IF EXISTS portal_ov_self_read ON public.portal_user_overrides;
CREATE POLICY portal_ov_self_read ON public.portal_user_overrides
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.current_user_role() IN ('admin','superadmin'));

DROP POLICY IF EXISTS portal_ov_admin_write ON public.portal_user_overrides;
CREATE POLICY portal_ov_admin_write ON public.portal_user_overrides
  FOR ALL TO authenticated
  USING (public.current_user_role() IN ('admin','superadmin'))
  WITH CHECK (public.current_user_role() IN ('admin','superadmin'));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.portal_apps TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.portal_user_overrides TO authenticated;

-- Seed: catálogo definido pelo Will 18/08/2026 (setor→app + aplicativos gerais)
INSERT INTO public.portal_apps (id, nome, descricao, url, categoria, ordem, depts, destaque, wide, badge) VALUES
  ('homebroker', 'Homebroker',      'CRM comercial — leads, oportunidades e propostas',      'https://homebroker.parket.works', 'SETOR', 10,  '{comercial}',   false, false, NULL),
  ('projetos',   'Projetos',        'Kanban de projetos executivos',                          'https://projetos.parket.works',   'SETOR', 20,  '{projetos}',    false, false, NULL),
  ('compras',    'Compras',         'ERP de compras — solicitações, estoque e NF-e',          'https://compras.parket.works',    'SETOR', 30,  '{compras}',     false, false, NULL),
  ('producao',   'Produção · PCP',  'Ordens de produção da marcenaria',                       'https://producao.parket.works',   'SETOR', 40,  '{producao}',    false, false, NULL),
  ('gestao',     'Gestão de Obras', 'Painel operacional das obras',                           'https://gestao.parket.works',     'SETOR', 50,  '{operacional}', false, false, NULL),
  ('expedicao',  'Expedição',       'Agenda de entregas e logística',                         'https://expedicao.parket.works',  'SETOR', 60,  '{logistica}',   false, false, NULL),
  ('core',       'Core Financeiro', 'Contratos, aprovações, comissões e pagamentos',          'https://core.parket.works',       'SETOR', 70,  '{financeiro}',  false, false, NULL),
  ('tasks',      'Tasks · Marketing','OKRs e tarefas de marketing',                           'https://tasks.parket.works',      'SETOR', 80,  '{marketing}',   false, false, NULL),
  ('rh',         'RH',              'Contratos e documentos de colaboradores',                'https://rh.parket.works',         'SETOR', 90,  '{rh}',          false, false, NULL),
  ('chat',       'Chat Parket',     'Conversa interna entre setores e obras',                 'https://chat.parket.works',       'APLICATIVO', 100, NULL,        true,  false, NULL),
  ('insta',      'InstaParket',     'Acompanhamento fotográfico das obras',                   'https://insta.parket.works',      'APLICATIVO', 110, NULL,        false, true,  'NOVO'),
  ('instala',    'Instala',         'App dos instaladores — agenda, obras e pagamentos',      'https://instala.parket.works',    'APLICATIVO', 120, '{operacional,prestadores}', false, false, NULL),
  ('verifica',   'Verifica',        'App dos fiscais — laudos, vistorias e agenda',           'https://verifica.parket.works',   'APLICATIVO', 130, '{fiscal}',   false, false, NULL)
ON CONFLICT (id) DO NOTHING;

COMMIT;

NOTIFY pgrst, 'reload schema';
