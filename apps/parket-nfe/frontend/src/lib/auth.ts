/**
 * Auth do parket-nfe (fiscal.parket.works) — usa `public.user_profiles` do Space
 * (mesma base auth GoTrue do resto do ecossistema Parket).
 *
 * Gate v1: qualquer user ativo entra. Filtro por departamento Fiscal fica pra v2
 * quando o esquema tiver dept_permissions.fiscal.view padronizado — hoje o campo
 * varia (alguns têm "operacional", outros "fiscal", outros nada). Sem gate agora
 * pra não bloquear Ronaldo no primeiro login.
 *
 * Padrão de robustez copiado do parket-homebroker:
 *  - SÓ derruba sessão em SIGNED_OUT explícito
 *  - TOKEN_REFRESHED / USER_UPDATED só atualizam
 *  - Nunca awaitar supabase dentro do callback onAuthStateChange (auth lock)
 */
import { useEffect, useState } from "react";
import { supabase } from "./supabase";
import type { Session } from "@supabase/supabase-js";

export type AppRole = "superadmin" | "admin" | "dept_leader" | "viewer";

export type AppUser = {
  id: string;
  email: string;
  nome: string | null;
  role: AppRole;
  ativo: boolean;
  avatar_color: string | null;
};

export function useAuth() {
  const [session, setSession] = useState<Session | null>(null);
  const [appUser, setAppUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    let bootDone = false;

    // Safety timeout — se o boot travar (rede/CORS/etc), força render do Login
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
      console.log("[useAuth] event:", event, "hasSession:", !!sess);
      switch (event) {
        case "SIGNED_OUT":
          setSession(null); setAppUser(null); setLoading(false); setError(null);
          break;
        case "SIGNED_IN":
        case "INITIAL_SESSION":
          // Defer com setTimeout(0) pra sair da auth lock interna do supabase-js
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
      console.warn("[useAuth] loadAppUser timeout 10s");
      if (!appUser) setError("Timeout carregando perfil. Recarregue a página.");
      setLoading(false);
    }, 10000);
    try {
      const { data, error: e } = await supabase
        .from("user_profiles")
        .select("id, email, full_name, role, avatar_color, ativo")
        .eq("id", sess.user.id)
        .maybeSingle();
      if (e) throw e;
      if (!data) throw new Error("Usuário não cadastrado em user_profiles. Contate o admin.");

      const role = (data.role || "viewer") as AppRole;
      if (data.ativo === false) throw new Error("Usuário desativado.");

      setAppUser({
        id: data.id,
        email: data.email,
        nome: data.full_name,
        role,
        ativo: data.ativo !== false,
        avatar_color: data.avatar_color,
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
  console.log("[signIn] start", { email });
  try {
    const { data } = await supabase.auth.getSession();
    if (!data.session) {
      // Limpa sessão zumbi local sem derrubar quem já tá logado válido
      await supabase.auth.signOut({ scope: "local" } as any);
    }
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

export function clearAllAndReload() {
  try {
    // Limpa storage do próprio app + qualquer chave sb-* pra derrubar sessão zumbi
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const k = localStorage.key(i);
      if (k && (k.startsWith("sb-") || k.includes("supabase") || k.includes("parket-nfe"))) {
        localStorage.removeItem(k);
      }
    }
    sessionStorage.clear();
  } catch {}
  window.location.href = window.location.pathname + "?_=" + Date.now();
}

export async function signOut() {
  await supabase.auth.signOut();
}
