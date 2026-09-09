import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_PARKET_SUPABASE_URL ?? "https://hbxpilrxmitvzebluoom.supabase.co";
const anon = import.meta.env.VITE_PARKET_ANON_KEY ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhieHBpbHJ4bWl0dnplYmx1b29tIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI5NDI1MjcsImV4cCI6MjA4ODUxODUyN30.ciZA1H-UvlYG2OPWqrFChj-_ttiFD5W5BmrST-gUJ-0";

export const supabase = createClient(url, anon, {
  auth: {
    storageKey: "expedicao-parket-sso",
    persistSession: true,
    autoRefreshToken: true,
  },
});
