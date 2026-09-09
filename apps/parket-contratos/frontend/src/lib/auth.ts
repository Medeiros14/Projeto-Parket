/**
 * Auth helpers — carrega o user_profiles.dept_permissions do usuário logado
 * pra gate de acesso ao setor Financeiro. Mesmo scheme que o Space usa.
 */
import { useEffect, useState } from "react";
import { supabase } from "./supabase";

export type DeptPermission = "view" | "edit" | "manage";
export type Profile = {
  id: string;
  email: string | null;
  full_name: string | null;
  role: string | null;
  ativo: boolean | null;
  dept_permissions: Record<string, DeptPermission> | null;
};

export type AppUser = {
  id: string;
  email: string;
  profile: Profile | null;
  canAccessFinanceiro: boolean;
  canEditFinanceiro: boolean;
};

// Lista curta de emails com acesso administrativo geral — atalho pra quando o
// user_profiles ainda não tem dept_permissions setado. Superadmin + admin
// (via role) já entram automaticamente pela lógica de isAdmin abaixo.
const ADMIN_EMAILS = new Set([
  "admin@parket.com.br",
  "douglas@parket.com.br",
  "will@parket.com.br",
]);

export function useSession() {
  const [user, setUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    async function loadProfile(uid: string, email: string) {
      const { data, error } = await supabase
        .from("user_profiles")
        .select("id,email,full_name,role,ativo,dept_permissions")
        .eq("id", uid)
        .maybeSingle();
      if (error) console.warn("[auth] user_profiles select falhou:", error.message);
      const profile = (data || null) as Profile | null;
      const dp = profile?.dept_permissions || {};
      const finPerm = dp["financeiro"] as DeptPermission | undefined;
      const isAdmin = profile?.role === "admin" || profile?.role === "superadmin";
      const emailAllow = ADMIN_EMAILS.has((email || "").toLowerCase());
      return {
        id: uid,
        email,
        profile,
        canAccessFinanceiro: isAdmin || emailAllow || !!finPerm,
        canEditFinanceiro:   isAdmin || emailAllow || finPerm === "edit" || finPerm === "manage",
      };
    }
    supabase.auth.getSession().then(async ({ data }) => {
      if (!mounted) return;
      const s = data.session;
      if (!s) { setUser(null); setLoading(false); return; }
      setUser(await loadProfile(s.user.id, s.user.email || ""));
      setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange(async (_ev, session) => {
      if (!mounted) return;
      if (!session) { setUser(null); return; }
      setUser(await loadProfile(session.user.id, session.user.email || ""));
    });
    return () => { mounted = false; sub.subscription.unsubscribe(); };
  }, []);

  return { user, loading };
}

export async function signIn(email: string, password: string) {
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
}

export async function signOut() {
  await supabase.auth.signOut();
}
