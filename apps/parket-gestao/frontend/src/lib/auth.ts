/**
 * Auth do Gestor de Projetos — mesma estrutura do Homebroker/Valoria:
 * login GoTrue do Space (via api.parket.works) + perfil em `public.user_profiles`.
 *
 * Liberação: superadmin/admin entram livre.
 *            demais precisam de dept_permissions.operacional (view/manage) —
 *            o mesmo gate de quem entra em space.parket.works/operacional.
 *
 * `perms` fica exposto no AppUser pra permitir refinar acesso por seção depois.
 *
 * IMPORTANTE: só derruba a sessão em SIGNED_OUT explícito. Eventos como
 * TOKEN_REFRESHED ou USER_UPDATED apenas atualizam — nunca causam logout.
 */
import { useEffect, useState } from "react";
import { supabase } from "./supabase";
import type { Session } from "@supabase/supabase-js";

export type AppRole = "superadmin" | "admin" | "dept_leader" | "viewer";

export type DeptPermission = { view?: boolean; edit?: boolean; add?: boolean; manage?: boolean };

export type AppUser = {
  id: string;
  email: string;
  nome: string | null;
  role: AppRole;
  ativo: boolean;
  avatar_color: string | null;
  /** Permissão do setor operacional (normalizada). */
  perms: DeptPermission;
  /** dept_permissions completo — pra gates por seção no futuro. */
  allPerms: Record<string, DeptPermission>;
  /** Seções do gestão liberadas (dept_permissions.gestao_secoes).
   *  null = todas (default / admin). */
  secoes: string[] | null;
  isAdmin: boolean;
  isGestor: boolean;
};

/** Seções do app pro gate por usuário (gerenciador de acessos + sidebar). */
export const GESTAO_SECOES: { key: string; label: string }[] = [
  { key: "projetos",       label: "Gestão de Obras" },
  { key: "fiscal",         label: "Fiscal" },
  // key continua "equipes" (é o que está gravado nas permissões dos usuários);
  // só o rótulo virou "Instaladores"
  { key: "equipes",        label: "Instaladores" },
  { key: "compras",        label: "Compras" },
  { key: "relacionamento", label: "Relacionamento" },
];

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
      if (alive && !bootDone) {
        console.warn("[useAuth] safety timeout (boot) — render do Login");
        setLoading(false);
      }
    }, 5000);

    supabase.auth.getSession()
      .then(async ({ data }) => {
        if (!alive) return;
        bootDone = true;
        clearTimeout(safety);
        if (data.session) {
          await loadAppUser(data.session, "boot");
        } else {
          setSession(null); setAppUser(null); setLoading(false);
        }
      })
      .catch((e) => {
        if (!alive) return;
        bootDone = true;
        clearTimeout(safety);
        console.error("[useAuth] getSession falhou:", e);
        setSession(null); setAppUser(null);
        setError(e?.message || "Falha ao verificar sessão");
        setLoading(false);
      });

    const sub = supabase.auth.onAuthStateChange((event, sess) => {
      if (!alive) return;
      // NUNCA awaitar chamadas do supabase dentro deste callback — a auth lock
      // interna do supabase-js trava queries subsequentes. Defere com setTimeout(0).
      switch (event) {
        case "SIGNED_OUT":
          try {
            localStorage.removeItem("gestao_user_email");
            localStorage.removeItem("gestao_user_nome");
          } catch {}
          setSession(null); setAppUser(null); setLoading(false); setError(null);
          break;
        case "SIGNED_IN":
        case "INITIAL_SESSION":
          if (sess) setTimeout(() => { if (alive) loadAppUser(sess, event); }, 0);
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

  async function loadAppUser(sess: Session, source: string) {
    console.log("[useAuth] loadAppUser (" + source + ") user.id =", sess.user.id);
    setSession(sess);
    setError(null);
    const safety = setTimeout(() => {
      if (!appUser) setError("Timeout carregando perfil. Recarregue a página.");
      setLoading(false);
    }, 10000);
    try {
      const { data, error: e } = await supabase
        .from("user_profiles")
        .select("id, email, full_name, role, dept_permissions, avatar_color, ativo")
        .eq("id", sess.user.id)
        .maybeSingle();
      if (e) throw e;
      if (!data) throw new Error("Usuário não cadastrado em user_profiles. Contate o admin.");
      if (data.ativo === false) throw new Error("Usuário desativado. Contate o admin.");

      const role = (data.role || "viewer") as AppRole;
      let dp: any = data.dept_permissions || {};
      if (typeof dp === "string") { try { dp = JSON.parse(dp); } catch { dp = {}; } }
      if (Array.isArray(dp)) dp = typeof dp[1] === "object" ? dp[1] : {};

      const allPerms: Record<string, DeptPermission> = {};
      if (dp && typeof dp === "object") {
        for (const k of Object.keys(dp)) allPerms[k] = normalizePerm(dp[k]);
      }
      const operacional = allPerms["operacional"] || {};

      const isAdmin = role === "superadmin" || role === "admin";
      const canView = isAdmin || operacional.view === true || operacional.manage === true;
      if (!canView) {
        throw new Error(`Sem permissão no setor Operacional (role: ${role}).`);
      }

      try {
        localStorage.setItem("gestao_user_email", data.email || "");
        localStorage.setItem("gestao_user_nome", data.full_name || "");
      } catch {}

      let secoes: string[] | null = null;
      if (!isAdmin && Array.isArray(dp?.gestao_secoes)) {
        secoes = (dp.gestao_secoes as any[]).map(String);
      }

      setAppUser({
        id: data.id, email: data.email, nome: data.full_name,
        role, ativo: data.ativo !== false, avatar_color: data.avatar_color,
        perms: operacional, allPerms,
        secoes,
        isAdmin,
        isGestor: isAdmin || operacional.manage === true,
      });
    } catch (e: any) {
      console.error("[useAuth] erro loadAppUser:", e);
      if (!appUser) {
        setError(e?.message || "Falha de autenticação");
        setAppUser(null);
      }
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
      "Timeout 20s ao contatar o servidor. Clique em 'Limpar sessão' e tente de novo."
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

export function clearAllAndReload() {
  try {
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const k = localStorage.key(i);
      if (k && (k.startsWith("sb-") || k.includes("supabase") || k.includes("parket-gestao"))) {
        localStorage.removeItem(k);
      }
    }
    sessionStorage.clear();
  } catch {}
  window.location.href = window.location.pathname + "?_=" + Date.now();
}
