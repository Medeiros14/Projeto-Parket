/**
 * Auth do Space v2 — usa `public.user_profiles` (mesma tabela que o Space atual
 * e o Homebroker). Não restringe por dept_permission de um setor específico:
 * qualquer user_profile válido entra; a navegação é gateada por dept_permissions
 * pra cada seção (a definir depois).
 */
import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "./supabase";

export type AppRole = "superadmin" | "admin" | "dept_leader" | "editor" | "user" | "viewer";

export type DeptPermission = { view?: boolean; edit?: boolean; add?: boolean; manage?: boolean };

export type AppUser = {
  id: string;
  email: string;
  nome: string | null;
  role: AppRole;
  avatar_color: string | null;
  perms: Record<string, DeptPermission>;       // chave = slug do dept
  isAdmin: boolean;                             // superadmin | admin
  isDeptLeader: boolean;
};

function normalizePerm(raw: any): DeptPermission {
  if (!raw) return {};
  if (typeof raw === "string") {
    const lvl = raw.toLowerCase();
    if (lvl === "manage") return { view: true, edit: true, add: true, manage: true };
    if (lvl === "edit")   return { view: true, edit: true };
    if (lvl === "add")    return { view: true, add: true };
    if (lvl === "view")   return { view: true };
    return {};
  }
  if (typeof raw === "object") return raw as DeptPermission;
  return {};
}

function normalizeAllPerms(raw: any): Record<string, DeptPermission> {
  if (!raw || typeof raw !== "object") return {};
  const out: Record<string, DeptPermission> = {};
  for (const [k, v] of Object.entries(raw)) out[k] = normalizePerm(v);
  return out;
}

export function useAuth() {
  const [session, setSession] = useState<Session | null>(null);
  const [appUser, setAppUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    const safety = setTimeout(() => { if (alive) setLoading(false); }, 6000);

    supabase.auth.getSession()
      .then(async ({ data }) => {
        if (!alive) return;
        clearTimeout(safety);
        if (data.session) await loadAppUser(data.session);
        else { setSession(null); setAppUser(null); setLoading(false); }
      })
      .catch((e) => {
        if (!alive) return;
        clearTimeout(safety);
        console.error("[auth] getSession", e);
        setLoading(false);
      });

    const sub = supabase.auth.onAuthStateChange((event, sess) => {
      if (!alive) return;
      if (event === "SIGNED_OUT" || !sess) {
        setSession(null); setAppUser(null); setLoading(false); setError(null);
        return;
      }
      if (sess) setTimeout(() => { if (alive) loadAppUser(sess); }, 0);
    });

    return () => { alive = false; clearTimeout(safety); sub.data.subscription.unsubscribe(); };
  }, []);

  async function loadAppUser(sess: Session) {
    setSession(sess);
    setError(null);
    try {
      const { data, error: e } = await supabase
        .from("user_profiles")
        .select("id, email, full_name, role, dept_permissions, avatar_color")
        .eq("id", sess.user.id)
        .maybeSingle();
      if (e) throw e;
      if (!data) throw new Error("Usuário não cadastrado em user_profiles. Contate o admin.");

      const role = (data.role || "viewer") as AppRole;
      const perms = normalizeAllPerms(data.dept_permissions);
      const isAdmin = role === "superadmin" || role === "admin";
      const isDeptLeader = isAdmin || role === "dept_leader"
        || Object.values(perms).some((p) => p.manage === true);

      setAppUser({
        id: data.id,
        email: data.email,
        nome: data.full_name,
        role,
        avatar_color: data.avatar_color,
        perms,
        isAdmin,
        isDeptLeader,
      });
    } catch (e: any) {
      console.error("[auth] loadAppUser", e);
      setError(e?.message || "Falha ao carregar perfil");
      setAppUser(null);
    } finally {
      setLoading(false);
    }
  }

  return { session, appUser, loading, error };
}

export async function signIn(email: string, password: string) {
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
}

export async function signOut() {
  await supabase.auth.signOut();
  window.location.assign("/");
}

// Helpers de permissão por dept
export function canView(user: AppUser | null, dept: string): boolean {
  if (!user) return false;
  if (user.isAdmin) return true;
  const p = user.perms[dept];
  return !!(p && (p.view || p.edit || p.add || p.manage));
}
