import { createClient } from "@supabase/supabase-js";

// Gateway local (api.parket.works) em vez do Supabase oficial — ISP brasileiro tem
// problema de roteamento pros IPs do Supabase (alguns retornam 400 em /auth/v1/token).
// Gateway proxa: /rest /auth /realtime /storage. Para o cliente é transparente.
const url = import.meta.env.VITE_SUPABASE_URL || "https://api.parket.works";
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhieHBpbHJ4bWl0dnplYmx1b29tIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI5NDI1MjcsImV4cCI6MjA4ODUxODUyN30.ciZA1H-UvlYG2OPWqrFChj-_ttiFD5W5BmrST-gUJ-0";

// Cliente principal — schema rh
export const supabase = createClient(url, anon, {
  auth: { persistSession: true, autoRefreshToken: true, storageKey: "parket-rh-auth" },
  db: { schema: "rh" },
});

// Cliente pra schema public (signer não precisa por ora; core pra empresas)
export const supabaseCore = createClient(url, anon, {
  auth: { persistSession: false, autoRefreshToken: false },
  db: { schema: "core" },
});

supabase.auth.onAuthStateChange((_, session) => {
  if (session) {
    supabaseCore.auth.setSession({
      access_token: session.access_token,
      refresh_token: session.refresh_token,
    });
  }
});

// Bootstrap: onAuthStateChange não dispara no carregamento inicial.
// Sem isso, queries em supabaseCore (empresas etc) caem em RLS — sumiam
// os filtros de empresa em /colaboradores depois de refresh.
//
// AWAITABLE: outras partes do código podem chamar awaitCoreReady() pra
// garantir que a sessão tá propagada antes do fetch (evita race condition
// onde useFetch dispara antes da promise abaixo resolver).
let _coreReadyResolve!: () => void;
export const coreReady = new Promise<void>((resolve) => { _coreReadyResolve = resolve; });

supabase.auth.getSession().then(({ data: { session } }) => {
  if (session) {
    supabaseCore.auth.setSession({
      access_token: session.access_token,
      refresh_token: session.refresh_token,
    }).finally(() => _coreReadyResolve());
  } else {
    _coreReadyResolve();
  }
});
