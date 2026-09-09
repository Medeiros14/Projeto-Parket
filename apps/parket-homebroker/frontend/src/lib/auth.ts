/**
 * Auth do home broker — usa `public.user_profiles` (mesma do Space).
 * Liberação: superadmin/admin entram livre.
 *            dept_leader/viewer precisam ter dept_permissions.comercial.view=true.
 *
 * IMPORTANTE: só derruba a sessão em SIGNED_OUT explícito. Eventos como
 * TOKEN_REFRESHED ou USER_UPDATED apenas atualizam — nunca causam logout.
 */
import { useEffect, useState } from "react";
import { supabase } from "./supabase";
import type { Session } from "@supabase/supabase-js";

export type AppRole = "superadmin" | "admin" | "dept_leader" | "viewer";

export type DeptPermission = { view?: boolean; edit?: boolean; add?: boolean; manage?: boolean };

export type FuncaoComercial = "sdr" | "vendedor" | "ambos" | null;

export type AppUser = {
  id: string;
  email: string;
  nome: string | null;
  /** Slug pra prefixar URLs (/:username/...). Default = prefixo do email. */
  username: string;
  /** Função no setor comercial — define quais leads o user vê. */
  funcaoComercial: FuncaoComercial;
  role: AppRole;
  ativo: boolean;
  avatar_color: string | null;
  perms: DeptPermission;
  isGestor: boolean;
  isSdr: boolean;
  isVendedor: boolean;
  /** True só pra superadmin/admin — vê todos os cards independentes de responsavel. */
  canSeeAll: boolean;
  /** Meta de receita mensal pra esse vendedor (R$). Configurável em user_profiles.meta_mensal. */
  metaMensal: number;
  /** Meta diária de agendamentos do SDR. Configurável em user_profiles.meta_agendamentos_diarios. */
  metaAgendamentosDiarios: number;
};

// Monitoramento (histórico de ações) — admins + Raphael. RLS de card_events
// aplica a mesma regra no banco (uuid do Raphael na policy).
const MONITOR_EMAILS = new Set([
  "marketing@parket.com.br",
  "raphael@parket.com.br",
  "raphael.camargo@parket.com.br",
]);
export function canSeeMonitoramento(appUser: AppUser): boolean {
  if (appUser.role === "admin" || appUser.role === "superadmin") return true;
  return MONITOR_EMAILS.has((appUser.email || "").toLowerCase().trim());
}

// Apagar card — admins/superadmin + Raphael. Ação destrutiva, permissão
// restrita mesmo em relação ao monitoramento (não inclui marketing@).
const DELETE_CARD_EMAILS = new Set([
  "raphael@parket.com.br",
  "raphael.camargo@parket.com.br",
]);
export function canDeleteCard(appUser: AppUser | null | undefined): boolean {
  if (!appUser) return false;
  if (appUser.role === "admin" || appUser.role === "superadmin") return true;
  return DELETE_CARD_EMAILS.has((appUser.email || "").toLowerCase().trim());
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

    // Boot inicial — tenta restaurar a sessão salva
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
      // IMPORTANTE: NUNCA awaitar chamadas do supabase (auth/from/realtime) dentro
      // deste callback — o supabase-js mantém uma auth lock interna durante a execução
      // do callback e qualquer query subsequente (que precisa pegar o token) trava.
      // Defere com setTimeout(0) pra rodar fora da lock.
      switch (event) {
        case "SIGNED_OUT":
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
        case "PASSWORD_RECOVERY":
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
      // NÃO derruba sessão — só mostra erro se nunca conseguiu carregar profile
      if (!appUser) {
        setError("Timeout carregando perfil. Recarregue a página.");
      }
      setLoading(false);
    }, 10000);
    try {
      const { data, error: e, status } = await supabase
        .from("user_profiles")
        .select("id, email, full_name, role, dept_permissions, avatar_color, username, funcao_comercial, ativo, meta_mensal, meta_agendamentos_diarios")
        .eq("id", sess.user.id)
        .maybeSingle();
      console.log("[useAuth] query user_profiles:", { status, hasData: !!data, error: e });
      if (e) throw e;
      if (!data) throw new Error(`Usuário não cadastrado em user_profiles. Contate o admin.`);

      const role = (data.role || "viewer") as AppRole;
      let dp: any = data.dept_permissions || {};
      if (typeof dp === "string") { try { dp = JSON.parse(dp); } catch { dp = {}; } }

      // Aceita dois formatos pra dept_permissions[setor]:
      //   • objeto: { view: true, edit: true, manage: true, add: true }
      //   • string: "view" | "edit" | "add" | "manage" (níveis hierárquicos)
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
      const comercial = normalizePerm(dp?.comercial);

      const isSuperOrAdmin = role === "superadmin" || role === "admin";
      // Will 16/07: Vinicius Arruda (SDR) vê os cards de todos os SDRs
      const VER_TODOS_EMAILS = new Set(["vinicius.arruda@parket.com.br", "comercial11@parket.com.br"]);
      const verTodos = isSuperOrAdmin || VER_TODOS_EMAILS.has(String(data.email || "").toLowerCase());
      const canView = isSuperOrAdmin || comercial.view === true || comercial.manage === true;
      if (!canView) {
        throw new Error(`Sem permissão no setor Comercial (role: ${role}).`);
      }

      const isGestor = isSuperOrAdmin || comercial.manage === true;
      const canEdit = isSuperOrAdmin || comercial.edit === true || comercial.add === true || comercial.manage === true;

      const funcao = (data.funcao_comercial as FuncaoComercial) || null;
      // Username — usa o do banco ou cai pro prefixo do email (compat com users que ainda não foram seedados).
      const username = (data.username && String(data.username).trim()) ||
        (data.email ? data.email.split("@")[0].replace(/[^a-zA-Z0-9]+/g, "-").toLowerCase() : data.id);

      setAppUser({
        id: data.id, email: data.email, nome: data.full_name,
        username,
        funcaoComercial: funcao,
        role, ativo: data.ativo !== false, avatar_color: data.avatar_color,
        perms: comercial,
        isGestor,
        // Refina os papéis: usa funcao_comercial se definida (mais preciso que canEdit puro)
        isSdr: canEdit && (funcao === "sdr" || funcao === "ambos" || funcao === null),
        isVendedor: canEdit && (funcao === "vendedor" || funcao === "ambos" || funcao === null),
        canSeeAll: verTodos,
        metaMensal: Number(data.meta_mensal) || 1_000_000,
        metaAgendamentosDiarios: Number(data.meta_agendamentos_diarios) || 5,
      });
    } catch (e: any) {
      console.error("[useAuth] erro loadAppUser:", e);
      // SÓ derruba se nunca carregou — se já tem appUser, mantém
      if (!appUser) {
        setError(e?.message || "Falha de autenticação");
        setAppUser(null);
      } else {
        console.warn("[useAuth] mantendo appUser anterior — erro não-fatal");
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
  // SÓ limpa estado zumbi se não houver sessão ativa válida
  // (evita derrubar sessão de quem já tá logado clicando "Entrar" de novo).
  try {
    const { data } = await supabase.auth.getSession();
    if (!data.session) {
      await supabase.auth.signOut({ scope: "local" } as any);
    }
  } catch {}
  const result = await Promise.race([
    supabase.auth.signInWithPassword({ email, password }),
    new Promise<never>((_, rej) => setTimeout(() => rej(new Error(
      "Timeout 20s ao contatar o servidor. Clique em 'Limpar sessão' e tente de novo."
    )), 20000)),
  ]);
  console.log("[signIn] result", { hasError: !!result.error });
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
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const k = localStorage.key(i);
      if (k && (k.startsWith("sb-") || k.includes("supabase") || k.includes("parket-homebroker"))) {
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
