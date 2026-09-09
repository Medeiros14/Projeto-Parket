import { createClient } from "@supabase/supabase-js";

// Gateway local (api.parket.works) em vez do Supabase oficial — ISP brasileiro tem
// problema de roteamento pros IPs do Supabase (alguns retornam 400 em /auth/v1/token).
// Gateway proxa: /rest /auth /realtime /storage. Para o cliente é transparente.
const url = import.meta.env.VITE_SUPABASE_URL || "https://api.parket.works";
// Cloud Parket: onde o financeiro core.* de verdade vive (watcher escreve lá).
const CLOUD_URL = "https://hbxpilrxmitvzebluoom.supabase.co";
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhieHBpbHJ4bWl0dnplYmx1b29tIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI5NDI1MjcsImV4cCI6MjA4ODUxODUyN30.ciZA1H-UvlYG2OPWqrFChj-_ttiFD5W5BmrST-gUJ-0";

export const supabase = createClient(url, anon, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    storageKey: "parket-core-auth",
  },
  db: { schema: "core" },
});

/** Cliente que aponta pro schema `public` (mesma instância Supabase).
 *  Usado pelo módulo Prestadores: as tabelas obras / prestadores /
 *  prestadores_obra_servicos / prestadores_pagamentos /
 *  prestadores_fechamentos vivem no schema public (compartilhado com
 *  o Dashboard Parket), não no schema core do Parket Core financeiro. */
export const supabasePublic = createClient(url, anon, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    storageKey: "parket-core-auth",  // mesma sessão (compartilha login)
  },
  db: { schema: "public" },
});

/** Cliente do FINANCEIRO (schema core) apontando pro Supabase CLOUD.
 *
 *  Por quê: o gateway api.parket.works serve o parket-pg-local, mas o watcher
 *  compras-contratos (e todo o fluxo financeiro: lançamentos CT-/NF-/TERMO-,
 *  obras, comissões, RT, impostos) escreve no Cloud hbxpilrxmitvzebluoom.
 *  Ler core.* pelo gateway local = tela vazia (/recebimentos sem nada).
 *
 *  Como funciona: o GoTrue local assina JWT com o MESMO secret do Cloud,
 *  então o access_token da sessão logada em api.parket.works é aceito pelo
 *  PostgREST do Cloud (role authenticated → passa nas RLS "auth read").
 *  accessToken entrega esse token a cada request; sem sessão cai no anon
 *  (que NÃO tem grant em core.* — leitura exige login, como deve ser).
 *
 *  Auth/app_users/login continuam no client `supabase` (local): o Cloud tem
 *  só 3 users em app_users vs 7 no local — o gate de acesso é o local. */
export const supabaseCore = createClient(CLOUD_URL, anon, {
  accessToken: async () => {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token ?? anon;
  },
  db: { schema: "core" },
});
