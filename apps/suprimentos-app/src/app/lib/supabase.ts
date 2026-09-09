import { createClient } from "@supabase/supabase-js";

/**
 * Cliente único — Supabase Cloud Parket (hbxpilrxmitvzebluoom).
 * É o MESMO banco que o Space golden usa pro kanban de Compras
 * (kanban_cards, compras_fornecedores, compras_estoque, compras_pos),
 * então os dois sistemas coexistem em sync automático.
 * Auth = SSO Parket (mesma credencial do Space).
 */
export const sbParket = createClient(
  import.meta.env.VITE_PARKET_SUPABASE_URL,
  import.meta.env.VITE_PARKET_ANON_KEY,
  {
    auth: {
      persistSession: true,
      storageKey: "suprimentos-parket-sso",  // único por app — evita Multiple GoTrueClient
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  }
);

export const sb = sbParket;
