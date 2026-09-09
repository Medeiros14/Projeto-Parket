/**
 * Auth do Portal Space — login GoTrue (api.parket.works) + perfil em user_profiles.
 * Diferente do gestão, o portal NÃO exige permissão de setor específico:
 * qualquer usuário ativo entra e vê os apps liberados pro(s) departamento(s) dele.
 */
import { useEffect, useState } from "react";
import { supabase } from "./supabase";
import type { Session } from "@supabase/supabase-js";

export type AppRole = "superadmin" | "admin" | "dept_leader" | "viewer" | "projetista";

export type DeptPermission = { view?: boolean; edit?: boolean; add?: boolean; manage?: boolean };

export type AppUser = {
  id: string;
  email: string;
  nome: string | null;
  role: AppRole;
  avatar_color: string | null;
  /** Departamentos onde o usuário tem view/manage. */
  depts: string[];
  allPerms: Record<string, DeptPermission>;
  isAdmin: boolean;
};

function normalizePerm(raw: any): DeptPermission {
  if (!raw) return {};
  if (typeof raw === "string") {
    const level = raw.toLowerCase();
    if (level === "manage") return { view: true, edit: true, add: true, manage: true };
    if (level === "edit")   return { view: true, edit: true };
    if (level === "add")    return { view: true, add: true };
    if (level === "view")   return { view: true };
    return {};
  }
  if (typeof raw === "object") return raw as DeptPermission;
  return {};
}

export function useAuth() {
  const [session, setSession] = useState<Session | null>(null);
  const [appUser, setAppUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    let bootDone = false;

    const safety = setTimeout(() => {
      if (alive && !bootDone) setLoading(false);
    }, 5000);

    supabase.auth.getSession()
      .then(async ({ data }) => {
        if (!alive) return;
        bootDone = true;
        clearTimeout(safety);
        if (data.session) {
          await loadAppUser(data.session);
        } else {
          setSession(null); setAppUser(null); setLoading(false);
        }
      })
      .catch((e) => {
        if (!alive) return;
        bootDone = true;
        clearTimeout(safety);
        setSession(null); setAppUser(null);
        setError(e?.message || "Falha ao verificar sessão");
        setLoading(false);
      });

    const sub = supabase.auth.onAuthStateChange((event, sess) => {
      if (!alive) return;
      // NUNCA awaitar supabase dentro deste callback (auth lock). Defere com setTimeout(0).
      switch (event) {
        case "SIGNED_OUT":
          setSession(null); setAppUser(null); setLoading(false); setError(null);
          break;
        case "SIGNED_IN":
        case "INITIAL_SESSION":
          if (sess) setTimeout(() => { if (alive) loadAppUser(sess); }, 0);
          break;
        case "TOKEN_REFRESHED":
        case "USER_UPDATED":
          if (sess) setSession(sess);
          break;
        default:
          if (sess) setSession(sess);
          break;
      }
    });

    return () => { alive = false; clearTimeout(safety); sub.data.subscription.unsubscribe(); };
  }, []);

  async function loadAppUser(sess: Session) {
    setSession(sess);
    setError(null);
    const safety = setTimeout(() => setLoading(false), 10000);
    try {
      const { data, error: e } = await supabase
        .from("user_profiles")
        .select("id, email, full_name, role, dept_permissions, avatar_color, ativo")
        .eq("id", sess.user.id)
        .maybeSingle();
      if (e) throw e;
      if (!data) throw new Error("Usuário não cadastrado. Contate o admin.");
      if (data.ativo === false) throw new Error("Usuário desativado. Contate o admin.");

      const role = (data.role || "viewer") as AppRole;
      let dp: any = data.dept_permissions || {};
      if (typeof dp === "string") { try { dp = JSON.parse(dp); } catch { dp = {}; } }
      if (Array.isArray(dp)) dp = typeof dp[1] === "object" ? dp[1] : {};

      const allPerms: Record<string, DeptPermission> = {};
      if (dp && typeof dp === "object") {
        for (const k of Object.keys(dp)) {
          if (k.startsWith("_")) continue;
          allPerms[k] = normalizePerm(dp[k]);
        }
      }
      const depts = Object.keys(allPerms).filter(
        (k) => allPerms[k].view === true || allPerms[k].manage === true
      );

      setAppUser({
        id: data.id,
        email: data.email,
        nome: data.full_name,
        role,
        avatar_color: data.avatar_color,
        depts,
        allPerms,
        isAdmin: role === "superadmin" || role === "admin",
      });
    } catch (e: any) {
      setError(e?.message || "Falha de autenticação");
      setAppUser(null);
    } finally {
      clearTimeout(safety);
      setLoading(false);
    }
  }

  return { session, appUser, loading, error };
}

export async function signIn(email: string, password: string) {
  try {
    const { data } = await supabase.auth.getSession();
    if (!data.session) await supabase.auth.signOut({ scope: "local" } as any);
  } catch {}
  const result = await Promise.race([
    supabase.auth.signInWithPassword({ email, password }),
    new Promise<never>((_, rej) => setTimeout(() => rej(new Error(
      "Timeout 20s ao contatar o servidor. Tente de novo."
    )), 20000)),
  ]);
  if (result.error) {
    const msg = result.error.message || "";
    if (/invalid login credentials/i.test(msg)) throw new Error("Email ou senha incorretos.");
    if (/email not confirmed/i.test(msg)) throw new Error("Email não confirmado. Contate o admin.");
    if (/rate limit/i.test(msg)) throw new Error("Muitas tentativas. Espere alguns minutos.");
    throw result.error;
  }
}

export async function signOut() {
  await supabase.auth.signOut();
}
