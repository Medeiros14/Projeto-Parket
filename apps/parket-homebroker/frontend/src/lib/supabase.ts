import { createClient } from "@supabase/supabase-js";

// Gateway local (api.parket.works) em vez do Supabase oficial — ISP brasileiro tem
// problema de roteamento pros IPs do Supabase (uns retornam 400 em /auth/v1/token).
// Gateway proxa: /rest /auth /realtime /storage. Para o cliente é transparente.
const url = import.meta.env.VITE_SUPABASE_URL || "https://api.parket.works";
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhieHBpbHJ4bWl0dnplYmx1b29tIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI5NDI1MjcsImV4cCI6MjA4ODUxODUyN30.ciZA1H-UvlYG2OPWqrFChj-_ttiFD5W5BmrST-gUJ-0";

// Cliente principal — schema public (kanban_cards, whatsapp_messages etc.)
export const supabase = createClient(url, anon, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    storageKey: "parket-homebroker-auth",
  },
  realtime: { params: { eventsPerSecond: 8 } },
});

/** Cliente VALORIA — banco próprio do valor.parket.works (skbjmlzgaeupflujomzw).
 *  Schema `ops` é onde mora `cards_solicitacao` (kanban pessoal do orçamentista).
 *  Passa pelo gateway (rota /valoria/rest/v1/ → Supabase da Valoria) pelo MESMO
 *  motivo do cliente principal: ISP BR com roteamento quebrado pros IPs do
 *  Supabase. Direto, a falha era silenciosa (supabase-js devolve .error sem
 *  lançar) e o Pipeline ficava sem os valores de proposta (02/09). */
export const supabaseValoria = createClient(
  "https://api.parket.works/valoria",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNrYmptbHpnYWV1cGZsdWpvbXp3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE2MjA1NDYsImV4cCI6MjA5NzE5NjU0Nn0.iAPj6bE_Kysd1I_RLWp3gR-J4YFy-Ps71-E-ukjOUGI",
  {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false, storageKey: "hb-valoria" },
    db: { schema: "ops" as any },
  }
);
