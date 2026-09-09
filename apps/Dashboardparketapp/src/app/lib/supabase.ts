import { createClient } from "@supabase/supabase-js";
import { projectId, publicAnonKey } from "../../../utils/supabase/info";

export const SUPABASE_URL = `https://${projectId}.supabase.co`;

export const supabase = createClient(SUPABASE_URL, publicAnonKey, {
  auth: {
    persistSession: true,
    storageKey: "parket-auth",
  },
});

/** Admin client — requer VITE_SUPABASE_SERVICE_KEY no ambiente de build */
export function createAdminClient() {
  const serviceKey = import.meta.env.VITE_SUPABASE_SERVICE_KEY as string | undefined;
  if (!serviceKey) throw new Error("VITE_SUPABASE_SERVICE_KEY não configurada");
  return createClient(SUPABASE_URL, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
