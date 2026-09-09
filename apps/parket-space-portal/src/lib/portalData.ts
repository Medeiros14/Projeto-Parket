import { supabase } from "./supabase";
import type { AppUser } from "./auth";

export interface PortalApp {
  id: string;
  nome: string;
  descricao: string;
  url: string;
  categoria: string;
  ordem: number;
  ativo: boolean;
  /** null = todos os usuários · [] = só admin · lista = depts com acesso */
  depts: string[] | null;
  destaque: boolean;
  wide: boolean;
  badge: string | null;
}

export interface PortalOverride {
  user_id: string;
  app_id: string;
  allow: boolean;
}

export const ALL_DEPTS = [
  "comercial", "atendimento", "marketing", "projetos", "orcamento",
  "producao", "operacional", "obras", "compras", "logistica",
  "financeiro", "fiscal", "prestadores", "rh", "ia", "produtividade",
];

export async function fetchApps(): Promise<PortalApp[]> {
  const { data, error } = await supabase
    .from("portal_apps")
    .select("*")
    .order("ordem", { ascending: true });
  if (error) throw error;
  return (data || []) as PortalApp[];
}

export async function fetchMyOverrides(userId: string): Promise<PortalOverride[]> {
  const { data, error } = await supabase
    .from("portal_user_overrides")
    .select("*")
    .eq("user_id", userId);
  if (error) throw error;
  return (data || []) as PortalOverride[];
}

export function canSeeApp(app: PortalApp, user: AppUser, overrides: PortalOverride[]): boolean {
  if (!app.ativo) return user.isAdmin;
  const ov = overrides.find((o) => o.app_id === app.id);
  if (ov) return ov.allow || user.isAdmin;
  if (user.isAdmin) return true;
  if (app.depts === null) return true;
  if (app.depts.length === 0) return false;
  return app.depts.some((d) => user.depts.includes(d));
}
