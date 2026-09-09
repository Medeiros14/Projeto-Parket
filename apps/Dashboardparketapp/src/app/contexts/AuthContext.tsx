import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";

/* ─── Types ─── */
export type Role = "superadmin" | "admin" | "dept_leader" | "viewer" | "projetista";
export type Permission = "view" | "edit" | "manage";

export interface UserProfile {
  id: string;
  email: string;
  full_name: string;
  role: Role;
  dept_permissions: Record<string, Permission>; // { "comercial": "edit", "projetos": "view" }
  avatar_color: string;
}

interface AuthContextValue {
  user: UserProfile | null;
  session: Session | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  /* Permission helpers */
  canAccessDept: (deptId: string) => boolean;
  getDeptPermission: (deptId: string) => Permission | null;
  canEdit: (deptId: string) => boolean;
  canAccessCeo: boolean;
  isSuperAdmin: boolean;
  isAdmin: boolean;
  isProjetista: boolean;
  projetistaId: string | null;
}

const AuthContext = createContext<AuthContextValue | null>(null);

/* ─── Provider ─── */
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [projetistaId, setProjetistaId] = useState<string | null>(null);

  const loadProfile = useCallback(async (userId: string, email: string) => {
    const { data } = await supabase
      .from("user_profiles")
      .select("*")
      .eq("id", userId)
      .single();

    if (data) {
      setUser({
        id: data.id,
        email: data.email || email,
        full_name: data.full_name,
        role: data.role,
        dept_permissions: typeof data.dept_permissions === "string"
          ? (() => { try { return JSON.parse(data.dept_permissions); } catch { return {}; } })()
          : (data.dept_permissions || {}),
        avatar_color: data.avatar_color || "#D4A853",
      });
      // Se for projetista, busca o id da equipe
      if (data.role === "projetista") {
        supabase.from("projetos_equipe").select("id").eq("user_id", userId).single()
          .then(({ data: pe }) => setProjetistaId(pe?.id ?? null));
      } else {
        setProjetistaId(null);
      }
    } else {
      // Perfil não encontrado — cria minimal
      setUser({
        id: userId,
        email,
        full_name: email.split("@")[0],
        role: "viewer",
        dept_permissions: {},
        avatar_color: "#D4A853",
      });
    }
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session?.user) {
        loadProfile(session.user.id, session.user.email ?? "").finally(() =>
          setLoading(false)
        );
      } else {
        setLoading(false);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session?.user) {
        loadProfile(session.user.id, session.user.email ?? "");
      } else {
        setUser(null);
      }
    });

    return () => subscription.unsubscribe();
  }, [loadProfile]);

  /* Auth actions */
  async function signIn(email: string, password: string) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { error: error.message };
    // Eagerly load the profile so the user state is populated
    // before returning — avoids the race with onAuthStateChange
    if (data.session?.user) {
      setSession(data.session);
      await loadProfile(data.session.user.id, data.session.user.email ?? "");
    }
    return { error: null };
  }

  async function signOut() {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
  }

  async function refreshProfile() {
    if (session?.user) {
      await loadProfile(session.user.id, session.user.email ?? "");
    }
  }

  /* Permission helpers */
  function canAccessDept(deptId: string): boolean {
    if (!user) return false;
    if (user.role === "superadmin" || user.role === "admin") return true;
    return deptId in user.dept_permissions;
  }

  function getDeptPermission(deptId: string): Permission | null {
    if (!user) return null;
    if (user.role === "superadmin" || user.role === "admin") return "manage";
    return user.dept_permissions[deptId] ?? null;
  }

  function canEdit(deptId: string): boolean {
    const p = getDeptPermission(deptId);
    return p === "edit" || p === "manage";
  }

  const isSuperAdmin = user?.role === "superadmin";
  const isAdmin = user?.role === "superadmin" || user?.role === "admin";
  const isProjetista = user?.role === "projetista";
  const canAccessCeo = isAdmin;

  return (
    <AuthContext.Provider value={{
      user, session, loading,
      signIn, signOut, refreshProfile,
      canAccessDept, getDeptPermission, canEdit,
      canAccessCeo, isSuperAdmin, isAdmin,
      isProjetista, projetistaId,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be inside AuthProvider");
  return ctx;
}
