import { useEffect, useRef, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "./supabase";

export type AppRole = "admin" | "rh" | "gestor" | "colaborador";

export type AppUser = {
  id: string;
  user_id: string;
  email: string;
  role: AppRole;
  nome: string | null;
  ativo: boolean;
  empresa_id: string | null;
  colaborador_id: string | null;
};

export type AuthState = {
  loading: boolean;
  session: Session | null;
  user: User | null;
  appUser: AppUser | null;
  error: string | null;
};

const CACHE_KEY = "parket-rh-app-user-cache";
const CACHE_TTL_MS = 60 * 60 * 1000; // 1h

function readCache(userId: string): AppUser | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const obj = JSON.parse(raw);
    if (obj.user_id !== userId) return null;
    if (Date.now() - obj.ts > CACHE_TTL_MS) return null;
    return obj.appUser as AppUser;
  } catch { return null; }
}

function writeCache(userId: string, appUser: AppUser) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ user_id: userId, appUser, ts: Date.now() }));
  } catch {}
}

function clearCache() {
  try { localStorage.removeItem(CACHE_KEY); } catch {}
}

async function fetchAppUser(userId: string, signal?: AbortSignal): Promise<{ appUser: AppUser | null; error: string | null }> {
  try {
    // Timeout próprio (10s) — supabase-js não respeita AbortSignal em todas
    // as versões, então faço Promise.race manual.
    const queryP = supabase
      .from("app_users")
      .select("id, user_id, email, role, nome, ativo, empresa_id, colaborador_id")
      .eq("user_id", userId)
      .maybeSingle();
    const timeoutP = new Promise<any>((_, rej) =>
      setTimeout(() => rej(new Error("timeout")), 10000),
    );
    const res: any = await Promise.race([queryP, timeoutP]);
    if (signal?.aborted) return { appUser: null, error: "aborted" };
    const { data, error } = res;
    if (error) {
      console.error("[parket-rh] loadAppUser error:", error);
      return { appUser: null, error: `Erro: ${error.message}` };
    }
    if (!data) return { appUser: null, error: "Sem permissão pra acessar o Parket RH. Fale com o admin." };
    if (!data.ativo) return { appUser: null, error: "Acesso desativado. Fale com o admin." };
    return { appUser: data as AppUser, error: null };
  } catch (e: any) {
    console.warn("[parket-rh] loadAppUser exception:", e?.message || e);
    return { appUser: null, error: e?.message || "Falha ao carregar perfil" };
  }
}

export function useAuth(): AuthState {
  const [state, setState] = useState<AuthState>({
    loading: true, session: null, user: null, appUser: null, error: null,
  });
  // Guarda último user.id pra evitar re-fetch redundante no onAuthStateChange
  const lastUserIdRef = useRef<string | null>(null);

  useEffect(() => {
    let alive = true;

    const applySession = async (session: Session | null, opts: { background?: boolean } = {}) => {
      const user = session?.user ?? null;
      if (!user) {
        lastUserIdRef.current = null;
        clearCache();
        if (alive) setState({ loading: false, session: null, user: null, appUser: null, error: null });
        return;
      }

      // Cache hit → mostra imediato (NÃO bloqueia UI)
      const cached = readCache(user.id);
      if (cached && lastUserIdRef.current !== user.id) {
        lastUserIdRef.current = user.id;
        if (alive) setState({ loading: false, session, user, appUser: cached, error: null });
      }

      // Refetch em background pra validar permissão / pegar mudanças
      // Só dispara se for usuário diferente do último OU se ainda não temos appUser
      const needsFetch = lastUserIdRef.current !== user.id || !cached;
      if (!needsFetch) return;
      lastUserIdRef.current = user.id;

      const { appUser, error } = await fetchAppUser(user.id);
      if (!alive) return;

      if (appUser) {
        writeCache(user.id, appUser);
        setState({ loading: false, session, user, appUser, error: null });
      } else if (cached && opts.background) {
        // Falha em background mas tem cache → mantém cache válido (não desloga)
        // Logs no console mas não atrapalha UX
        console.warn("[parket-rh] background refetch falhou, mantendo cache:", error);
      } else {
        setState({ loading: false, session, user, appUser: null, error });
      }
    };

    // 1) Sessão inicial (do localStorage)
    supabase.auth.getSession().then(({ data }) => {
      if (!alive) return;
      applySession(data.session ?? null);
    }).catch((e) => {
      if (!alive) return;
      setState({ loading: false, session: null, user: null, appUser: null, error: e?.message || "Erro" });
    });

    // 2) Listener de eventos auth — só re-fetch em SIGNED_IN/SIGNED_OUT
    //    (TOKEN_REFRESHED e INITIAL_SESSION não mudam o user, ignoramos)
    const { data: sub } = supabase.auth.onAuthStateChange((evt, session) => {
      if (!alive) return;
      if (evt === "SIGNED_OUT") {
        applySession(null);
      } else if (evt === "SIGNED_IN" || evt === "USER_UPDATED") {
        applySession(session, { background: true });
      } else if (evt === "TOKEN_REFRESHED" && session) {
        // Só atualiza session no state, não re-fetcha appUser
        setState((s) => ({ ...s, session, user: session.user ?? null }));
      }
    });

    return () => { alive = false; sub.subscription.unsubscribe(); };
  }, []);

  return state;
}

export async function signIn(email: string, password: string) {
  return supabase.auth.signInWithPassword({ email, password });
}

export async function signOut() {
  clearCache();
  return supabase.auth.signOut();
}
