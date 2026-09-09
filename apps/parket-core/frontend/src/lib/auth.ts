import { useEffect, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "./supabase";

export type AppRole = "admin" | "finance" | "viewer";

export type AppUser = {
  id: string;
  user_id: string;
  email: string;
  role: AppRole;
  nome: string | null;
  ativo: boolean;
  /** Permissão pra módulo Prestadores: "view" | "manage" | "" (sem acesso) */
  prestadoresPerm: "" | "view" | "manage";
  /** True quando o usuário SÓ tem permissão pra Prestadores (sem
   *  financeiro/superadmin). Esses usuários só veem o item Prestadores
   *  no menu e são redirecionados pra /prestadores em qualquer outra
   *  rota. Caso típico: Natália (planejamento). */
  prestadoresOnly: boolean;
};

export type AuthState = {
  loading: boolean;
  session: Session | null;
  user: User | null;
  appUser: AppUser | null;
  error: string | null;
};

export function useAuth(): AuthState {
  const [state, setState] = useState<AuthState>({
    loading: true,
    session: null,
    user: null,
    appUser: null,
    error: null,
  });

  useEffect(() => {
    let alive = true;

    const withTimeout = async <T,>(p: Promise<T>, ms: number, label: string): Promise<T> => {
      let to: any;
      const timeout = new Promise<T>((_, rej) => {
        to = setTimeout(() => rej(new Error(`timeout ${label} ${ms}ms`)), ms);
      });
      try {
        return (await Promise.race([p, timeout])) as T;
      } finally {
        clearTimeout(to);
      }
    };

    const loadAppUser = async (user: User | null): Promise<{ appUser: AppUser | null; error: string | null }> => {
      if (!user) return { appUser: null, error: null };
      console.log("[parket-core/auth] loadAppUser → query user_profiles (Space) id=", user.id);
      try {
        // Acesso ao Core agora é definido pelo perfil no Space (public.user_profiles).
        // Libera entrada se: role superadmin/admin OU dept_permissions.financeiro = view/manage.
        // Bloqueia se _inactive=true.
        const queryPromise: Promise<any> = Promise.resolve(
          supabase.schema("public" as any)
            .from("user_profiles")
            .select("id, email, full_name, role, dept_permissions")
            .eq("id", user.id)
            .maybeSingle(),
        );
        const res: any = await withTimeout(queryPromise, 30000, "loadAppUser");
        console.log("[parket-core/auth] loadAppUser ← resposta", res);
        const { data, error } = res;
        if (error) {
          console.error("[parket-core] loadAppUser error:", error);
          return { appUser: null, error: `Erro ao carregar perfil: ${error.message}` };
        }
        if (!data) {
          return { appUser: null, error: "Sem perfil no Space. Fale com o admin." };
        }
        const dp = (data.dept_permissions || {}) as Record<string, any>;
        if (dp._inactive === true || dp._inactive === "true") {
          return { appUser: null, error: "Acesso desativado. Fale com o admin." };
        }
        const roleSpace = String(data.role || "").toLowerCase();
        const finPerm = String(dp.financeiro || "").toLowerCase();
        const prestPerm = String(dp.prestadores || "").toLowerCase();
        const prodPerm = String(dp.produtividade || "").toLowerCase();
        const isSuper = roleSpace === "superadmin";
        const hasFin = finPerm === "view" || finPerm === "manage";
        // Acesso ao Core: super OU financeiro OU prestadores OU produtividade=manage
        const hasPrest = prestPerm === "view" || prestPerm === "manage";
        const hasProd = prodPerm === "manage";
        if (!isSuper && !hasFin && !hasPrest && !hasProd) {
          return {
            appUser: null,
            error: "Acesso ao Core requer permissão Financeiro, Prestadores ou Produtividade. Peça ao admin.",
          };
        }
        const appRole: AppRole = isSuper || finPerm === "manage" ? "admin" : "viewer";
        // Permissão efetiva pra módulo Prestadores
        const prestadoresPerm: "" | "view" | "manage" = isSuper || finPerm === "manage" || prestPerm === "manage" || prodPerm === "manage"
          ? "manage"
          : (hasFin || hasPrest ? "view" : "");
        // Acesso restrito ao Prestadores: usuário NÃO tem acesso a financeiro
        // (nem é superadmin) — só passa no gate via prestadores/produtividade.
        // Esses usuários só veem o módulo Prestadores no menu.
        const prestadoresOnly = !isSuper && !hasFin;
        const appUser: AppUser = {
          id: data.id,
          user_id: data.id,
          email: data.email,
          role: appRole,
          nome: data.full_name || null,
          ativo: true,
          prestadoresPerm,
          prestadoresOnly,
        };
        return { appUser, error: null };
      } catch (e: any) {
        console.error("[parket-core] loadAppUser exception:", e);
        return { appUser: null, error: e?.message || "Falha ao verificar permissão" };
      }
    };

    const init = async () => {
      console.log("[parket-core/auth] init() — chamando getSession");
      try {
        // Timeout 60s — getSession do Supabase pode travar quando token está
        // sendo refreshed em background. Aguardamos generosamente.
        const { data } = await withTimeout(supabase.auth.getSession(), 60000, "getSession");
        const session = data.session;
        console.log("[parket-core/auth] getSession OK", session ? `(user=${session.user.email})` : "(sem sessão)");
        const { appUser, error } = await loadAppUser(session?.user ?? null);
        console.log("[parket-core/auth] loadAppUser OK", { appUser: appUser?.email, error });
        if (!alive) return;
        setState({ loading: false, session, user: session?.user ?? null, appUser, error });
      } catch (e: any) {
        console.error("[parket-core/auth] init error:", e);
        if (!alive) return;
        setState({ loading: false, session: null, user: null, appUser: null, error: e?.message || "Erro de inicialização" });
      }
    };
    init();

    const { data: sub } = supabase.auth.onAuthStateChange((evt, session) => {
      console.log("[parket-core/auth] onAuthStateChange", evt, session?.user?.email);
      // CRÍTICO: NÃO usar `await` ou chamadas síncronas pro supabase aqui dentro.
      // `onAuthStateChange` segura o lock interno do auth do supabase-js — qualquer
      // query (.from/.select) dispara dentro do callback → DEADLOCK até timeout.
      // Solução: defer com setTimeout(0) pra rodar depois do callback retornar.
      setTimeout(async () => {
        if (!alive) return;
        try {
          const { appUser, error } = await loadAppUser(session?.user ?? null);
          if (!alive) return;
          setState({ loading: false, session, user: session?.user ?? null, appUser, error });
        } catch (e: any) {
          console.error("[parket-core/auth] onAuthStateChange deferred error", e);
          if (!alive) return;
          setState({ loading: false, session, user: session?.user ?? null, appUser: null, error: e?.message || "Erro" });
        }
      }, 0);
    });

    return () => {
      alive = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  return state;
}

export async function signIn(email: string, password: string) {
  return supabase.auth.signInWithPassword({ email, password });
}

export async function signOut() {
  return supabase.auth.signOut();
}
