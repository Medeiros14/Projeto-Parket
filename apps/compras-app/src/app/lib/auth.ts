/** Login SSO Parket — mesma credencial do Space. */
import { sbParket } from "./supabase";

export type ComprasUser = {
  id: string;
  email: string | null;
  nome: string | null;
  avatar_url: string | null;
};

export async function login(email: string, password: string) {
  const { data, error } = await sbParket.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data.user;
}

export async function logout() {
  await sbParket.auth.signOut();
}

export async function getCurrentUser(): Promise<ComprasUser | null> {
  const { data } = await sbParket.auth.getUser();
  if (!data?.user) return null;
  const u = data.user;
  return {
    id: u.id,
    email: u.email ?? null,
    nome: (u.user_metadata?.full_name as string) || (u.user_metadata?.nome as string) || u.email || null,
    avatar_url: (u.user_metadata?.avatar_url as string) || null,
  };
}
