/**
 * Supabase client apontando pro gateway local (api.parket.works). O gateway
 * já proxya /auth/v1 → Cloud, /rest/v1 → PostgREST local, /realtime → Cloud.
 * Padrão idêntico ao Homebroker (o custom `global.fetch` anterior quebrava
 * os headers de Authorization).
 */
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://api.parket.works";
const ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhieHBpbHJ4bWl0dnplYmx1b29tIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI5NDI1MjcsImV4cCI6MjA4ODUxODUyN30.ciZA1H-UvlYG2OPWqrFChj-_ttiFD5W5BmrST-gUJ-0";

export const supabase = createClient(SUPABASE_URL, ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
    storageKey: "parket-contratos-auth",
  },
  realtime: { params: { eventsPerSecond: 8 } },
});
