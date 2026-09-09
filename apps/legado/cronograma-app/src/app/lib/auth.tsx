import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import type { User } from "@supabase/supabase-js";
import { sb } from "./supabase";

type Profile = {
  id: string;
  email: string;
  full_name: string | null;
  role: string | null;
  dept_permissions: Record<string, string> | null;
};

type AuthCtx = {
  ready: boolean;
  user: User | null;
  profile: Profile | null;
  hasOperacional: boolean;
  signOut: () => Promise<void>;
};

const Ctx = createContext<AuthCtx>({ ready: false, user: null, profile: null, hasOperacional: false, signOut: async () => {} });

export function AuthProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);

  async function loadProfile(u: User) {
    const { data } = await sb.from("user_profiles").select("id,email,full_name,role,dept_permissions").eq("id", u.id).maybeSingle();
    setProfile(data as Profile | null);
  }

  useEffect(() => {
    sb.auth.getSession().then(({ data }) => {
      const u = data.session?.user ?? null;
      setUser(u);
      if (u) loadProfile(u).finally(() => setReady(true));
      else setReady(true);
    });
    const { data: sub } = sb.auth.onAuthStateChange((_event, session) => {
      const u = session?.user ?? null;
      setUser(u);
      if (u) loadProfile(u);
      else setProfile(null);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const hasOperacional =
    profile?.role === "superadmin" ||
    !!(profile?.dept_permissions && profile.dept_permissions["operacional"]);

  async function signOut() {
    await sb.auth.signOut();
    setUser(null);
    setProfile(null);
  }

  return <Ctx.Provider value={{ ready, user, profile, hasOperacional, signOut }}>{children}</Ctx.Provider>;
}

export const useAuth = () => useContext(Ctx);
