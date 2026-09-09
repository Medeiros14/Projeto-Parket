import { createClient } from "@supabase/supabase-js";

/**
 * Cliente único — Supabase Cloud Parket (hbxpilrxmitvzebluoom).
 * É o MESMO banco que o Space golden usa pro kanban de Compras
 * (kanban_cards, compras_fornecedores, compras_estoque, compras_pos),
 * então os dois sistemas coexistem em sync automático.
 * Auth = SSO Parket (mesma credencial do Space).
 *
 * IMPORTANTE (02/09): a URL aponta pro gateway api.parket.works/cloud,
 * NUNCA direto pro *.supabase.co. Motivo: ISPs BR com roteamento quebrado
 * derrubam supabase.co direto do navegador e o supabase-js falha em
 * silêncio (Will sem conseguir logar no compras, mesmo incidente do
 * Pipeline HB). O gateway proxya auth/rest/storage/realtime pelo Hetzner.
 */
export const sbParket = createClient(
  import.meta.env.VITE_PARKET_SUPABASE_URL,
  import.meta.env.VITE_PARKET_ANON_KEY,
  {
    auth: {
      persistSession: true,
      storageKey: "compras-parket-sso",  // único por app — evita Multiple GoTrueClient
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  }
);

export const sb = sbParket;
