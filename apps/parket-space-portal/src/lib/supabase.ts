/// <reference types="vite/client" />
import { createClient } from "@supabase/supabase-js";

// Mesmo padrão do gestão/Homebroker: gateway local api.parket.works
// (proxa /rest /auth /realtime /storage do stack Parket).
const url = import.meta.env.VITE_SUPABASE_URL || "https://api.parket.works";
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhieHBpbHJ4bWl0dnplYmx1b29tIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI5NDI1MjcsImV4cCI6MjA4ODUxODUyN30.ciZA1H-UvlYG2OPWqrFChj-_ttiFD5W5BmrST-gUJ-0";

export const supabase = createClient(url, anon, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    storageKey: "parket-space-portal-auth",
  },
});

/** Admin client — requer VITE_SUPABASE_SERVICE_KEY no ambiente de build.
 *  Bate no mesmo gateway que o cliente normal (api.parket.works é o auth
 *  oficial do portal — o Supabase Cloud é outro banco de usuários). */
export function createAdminClient() {
  const serviceKey = import.meta.env.VITE_SUPABASE_SERVICE_KEY as string | undefined;
  if (!serviceKey) throw new Error("VITE_SUPABASE_SERVICE_KEY não configurada no build");
  return createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
