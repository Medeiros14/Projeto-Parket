-- ================================================================
-- PARKET DASHBOARD — Migração Completa (001 + 002)
-- Cole tudo isso no Supabase Dashboard → SQL Editor e clique RUN
-- ================================================================

-- ── 001: Auth Schema ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.user_profiles (
  id             UUID        REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email          TEXT        NOT NULL,
  full_name      TEXT        NOT NULL,
  role           TEXT        NOT NULL DEFAULT 'viewer'
                             CHECK (role IN ('superadmin', 'admin', 'dept_leader', 'viewer')),
  dept_permissions JSONB     NOT NULL DEFAULT '{}',
  avatar_color   TEXT        NOT NULL DEFAULT '#D4A853',
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "self_select" ON public.user_profiles
  FOR SELECT USING (auth.uid() = id);

CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS TEXT AS $$
  SELECT role FROM public.user_profiles WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE POLICY "superadmin_select_all" ON public.user_profiles
  FOR SELECT USING (public.current_user_role() = 'superadmin');

CREATE POLICY "superadmin_insert" ON public.user_profiles
  FOR INSERT WITH CHECK (public.current_user_role() = 'superadmin');

CREATE POLICY "superadmin_update" ON public.user_profiles
  FOR UPDATE USING (public.current_user_role() = 'superadmin');

CREATE POLICY "superadmin_delete" ON public.user_profiles
  FOR DELETE USING (public.current_user_role() = 'superadmin');

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER trg_user_profiles_updated_at
  BEFORE UPDATE ON public.user_profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_profiles (id, email, full_name, role, dept_permissions, avatar_color)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'role', 'viewer'),
    COALESCE((NEW.raw_user_meta_data->>'dept_permissions')::jsonb, '{}'::jsonb),
    '#D4A853'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Registrar superadmin existente (substitua se necessário)
INSERT INTO public.user_profiles (id, email, full_name, role, dept_permissions)
SELECT id, email, 'Administrador', 'superadmin', '{}'
FROM auth.users WHERE email = 'admin@parket.com.br'
ON CONFLICT (id) DO UPDATE SET role = 'superadmin';

-- ── 002: Kanban Cards ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.kanban_cards (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  dept_id           TEXT        NOT NULL,
  column_id         TEXT        NOT NULL,

  -- Campos visíveis no card
  title             TEXT        NOT NULL,
  subtitle          TEXT,
  obra              TEXT,
  responsavel       TEXT        NOT NULL DEFAULT 'N/A',
  sla               TEXT        NOT NULL DEFAULT '7d',
  sla_status        TEXT        NOT NULL DEFAULT 'ok'
                                CHECK (sla_status IN ('ok', 'warning', 'expired')),
  tags              TEXT[],
  progress          INTEGER     CHECK (progress >= 0 AND progress <= 100),
  value             TEXT,
  checklist_done    INTEGER,
  checklist_total   INTEGER,
  gate              INTEGER,
  priority          TEXT        DEFAULT 'media'
                                CHECK (priority IN ('alta', 'media', 'baixa')),
  parent_card_id    UUID        REFERENCES public.kanban_cards(id) ON DELETE SET NULL,

  -- Informações completas do projeto
  description       TEXT,
  details           JSONB       NOT NULL DEFAULT '{}',

  -- Auditoria
  created_by        TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_kanban_cards_dept    ON public.kanban_cards (dept_id);
CREATE INDEX IF NOT EXISTS idx_kanban_cards_column  ON public.kanban_cards (dept_id, column_id);
CREATE INDEX IF NOT EXISTS idx_kanban_cards_details ON public.kanban_cards USING gin (details);

CREATE OR REPLACE TRIGGER trg_kanban_cards_updated_at
  BEFORE UPDATE ON public.kanban_cards
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.kanban_cards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth_read_cards" ON public.kanban_cards
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "auth_write_cards" ON public.kanban_cards
  FOR INSERT WITH CHECK (
    public.current_user_role() IN ('superadmin', 'admin', 'dept_leader')
  );

CREATE POLICY "auth_update_cards" ON public.kanban_cards
  FOR UPDATE USING (
    public.current_user_role() IN ('superadmin', 'admin', 'dept_leader')
  );

CREATE POLICY "auth_delete_cards" ON public.kanban_cards
  FOR DELETE USING (
    public.current_user_role() IN ('superadmin', 'admin')
  );

-- ================================================================
-- CONCLUÍDO — Você pode fechar o SQL Editor
-- ================================================================
