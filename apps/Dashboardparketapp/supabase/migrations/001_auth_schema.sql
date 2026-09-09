-- ================================================================
-- Parket Dashboard — Auth Schema
-- Execute no Supabase Dashboard > SQL Editor
-- ================================================================

-- Tabela de perfis de usuário
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

-- Row Level Security
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

-- Cada usuário pode ler seu próprio perfil
CREATE POLICY "self_select" ON public.user_profiles
  FOR SELECT USING (auth.uid() = id);

-- Função SECURITY DEFINER: lê o role do usuário atual sem passar pelo RLS
-- Isso evita dependência circular nas políticas
CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS TEXT AS $$
  SELECT role FROM public.user_profiles WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Superadmins podem ler todos os perfis
CREATE POLICY "superadmin_select_all" ON public.user_profiles
  FOR SELECT USING (public.current_user_role() = 'superadmin');

-- Superadmins podem inserir/atualizar/deletar qualquer perfil
CREATE POLICY "superadmin_insert" ON public.user_profiles
  FOR INSERT WITH CHECK (public.current_user_role() = 'superadmin');

CREATE POLICY "superadmin_update" ON public.user_profiles
  FOR UPDATE USING (public.current_user_role() = 'superadmin');

CREATE POLICY "superadmin_delete" ON public.user_profiles
  FOR DELETE USING (public.current_user_role() = 'superadmin');

-- Trigger: atualiza updated_at automaticamente
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER trg_user_profiles_updated_at
  BEFORE UPDATE ON public.user_profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Trigger: cria perfil automaticamente quando usuário é criado no Supabase Auth
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

-- ================================================================
-- PASSO FINAL: Crie o primeiro superadmin manualmente
-- 1. Vá em Authentication > Users > Add User no painel Supabase
-- 2. Crie o usuário (ex: admin@parket.com.br)
-- 3. Execute o SQL abaixo substituindo o UUID e email reais:
-- ================================================================
-- INSERT INTO public.user_profiles (id, email, full_name, role, dept_permissions)
-- VALUES (
--   '<UUID_DO_USUARIO>',
--   'admin@parket.com.br',
--   'Administrador',
--   'superadmin',
--   '{}'
-- )
-- ON CONFLICT (id) DO UPDATE SET role = 'superadmin';
