import { createClient } from "@supabase/supabase-js";

// Gateway local api.parket.works (mesmo padrão dos outros apps Parket).
// ISP brasileiro tem problema de roteamento pros IPs oficiais do Supabase;
// o gateway proxy /rest /auth /realtime /storage. Transparente pro cliente.
const url = import.meta.env.VITE_SUPABASE_URL || "https://api.parket.works";
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhieHBpbHJ4bWl0dnplYmx1b29tIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI5NDI1MjcsImV4cCI6MjA4ODUxODUyN30.ciZA1H-UvlYG2OPWqrFChj-_ttiFD5W5BmrST-gUJ-0";

// storageKey exclusivo pro parket-nfe evita colisão com outros apps que
// rodam no mesmo browser (parket-homebroker-auth, hb-valoria, etc).
export const supabase = createClient(url, anon, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    storageKey: "parket-nfe-auth",
  },
  realtime: { params: { eventsPerSecond: 4 } },
});
