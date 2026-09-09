import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase.ts";

interface AuthState {
  session: Session | null;
  loading: boolean;
}

let state: AuthState = { session: null, loading: true };
const listeners = new Set<() => void>();

function set(next: AuthState) {
  state = next;
  listeners.forEach((l) => l());
}

supabase.auth.getSession().then(({ data }) => {
  set({ session: data.session, loading: false });
});

supabase.auth.onAuthStateChange((_event, session) => {
  set({ session, loading: false });
});

export const getAuthState = () => state;
export function subscribeAuth(l: () => void) {
  listeners.add(l);
  return () => { listeners.delete(l); };
}

export async function currentUserId(): Promise<string | null> {
  if (state.session) return state.session.user.id;
  const { data } = await supabase.auth.getSession();
  return data.session?.user.id ?? null;
}

export async function currentUserName(): Promise<string> {
  const session = state.session ?? (await supabase.auth.getSession()).data.session;
  const u = session?.user;
  return (u?.user_metadata?.name as string) ?? u?.email?.split("@")[0] ?? "—";
}
