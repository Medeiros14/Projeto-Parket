// Shim "@usehercules/auth/react" -> SSO Parket (GoTrue/Supabase).
import { useEffect, useState, useSyncExternalStore } from "react";
import { supabase } from "@/lib/supabase.ts";
import { getAuthState, subscribeAuth } from "./auth-store";

export function HerculesAuthProvider({ children }: { children: React.ReactNode; [k: string]: unknown }) {
  return <>{children}</>;
}

export interface ShimUser {
  id: string;
  profile: { name: string; email: string; sub: string };
}

export function useAuth() {
  const s = useSyncExternalStore(subscribeAuth, getAuthState);
  const [error] = useState<Error | null>(null);
  const su = s.session?.user;
  const user: ShimUser | null = su
    ? {
        id: su.id,
        profile: {
          name: (su.user_metadata?.name as string) ?? su.email?.split("@")[0] ?? "Usuário",
          email: su.email ?? "",
          sub: su.id,
        },
      }
    : null;
  return {
    isAuthenticated: !!s.session,
    isLoading: s.loading,
    error,
    user,
    signinRedirect: async () => {
      window.location.href = "/";
    },
    removeUser: async () => {
      await supabase.auth.signOut();
      window.location.href = "/";
    },
  };
}

export function useAuthCallback(_opts?: Record<string, unknown>) {
  useEffect(() => {
    window.location.replace("/");
  }, []);
  return { status: "loading" as const, error: null as Error | null, retry: () => window.location.replace("/") };
}
