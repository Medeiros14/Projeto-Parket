import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { sbParket } from "../lib/supabase";
import { login as authLogin, logout as authLogout, ComprasUser } from "../lib/auth";

type AuthCtx = {
  user: ComprasUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
};

const Ctx = createContext<AuthCtx | null>(null);

function toUser(u: any): ComprasUser | null {
  if (!u) return null;
  return {
    id: u.id,
    email: u.email ?? null,
    nome: (u.user_metadata?.full_name as string) || (u.user_metadata?.nome as string) || u.email || null,
    avatar_url: (u.user_metadata?.avatar_url as string) || null,
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<ComprasUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    let resolved = false;

    // Timeout: libera UI em 4s mesmo se auth não responder
    const timeout = setTimeout(() => {
      if (mounted && !resolved) { resolved = true; setLoading(false); }
    }, 4000);

    (async () => {
      try {
        const { data } = await sbParket.auth.getSession();
        if (mounted && !resolved) {
          resolved = true;
          setUser(toUser(data?.session?.user));
          setLoading(false);
          clearTimeout(timeout);
        }
      } catch {
        if (mounted && !resolved) {
          resolved = true; setLoading(false); clearTimeout(timeout);
        }
      }
    })();

    const { data: sub } = sbParket.auth.onAuthStateChange((_evt, session) => {
      if (!mounted) return;
      setUser(toUser(session?.user));
      if (!resolved) { resolved = true; setLoading(false); clearTimeout(timeout); }
    });

    return () => {
      mounted = false;
      clearTimeout(timeout);
      sub.subscription.unsubscribe();
    };
  }, []);

  return (
    <Ctx.Provider value={{
      user, loading,
      login: async (e, p) => { const u = await authLogin(e, p); setUser(toUser(u)); },
      logout: async () => { await authLogout(); setUser(null); },
    }}>
      {children}
    </Ctx.Provider>
  );
}

export const useAuth = () => {
  const c = useContext(Ctx);
  if (!c) throw new Error("useAuth fora do AuthProvider");
  return c;
};
