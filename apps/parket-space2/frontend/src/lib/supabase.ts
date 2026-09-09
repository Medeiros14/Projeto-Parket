import { createClient } from "@supabase/supabase-js";

// Gateway local api.parket.works (proxa /rest /auth /realtime /storage pro
// PostgREST/GoTrue locais — mesmos dados que o Space e o Homebroker usam).
const url = import.meta.env.VITE_SUPABASE_URL || "https://api.parket.works";
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhieHBpbHJ4bWl0dnplYmx1b29tIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI5NDI1MjcsImV4cCI6MjA4ODUxODUyN30.ciZA1H-UvlYG2OPWqrFChj-_ttiFD5W5BmrST-gUJ-0";

export const supabase = createClient(url, anon, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    storageKey: "parket-space2-auth",
  },
  realtime: { params: { eventsPerSecond: 8 } },
});
