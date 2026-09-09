import { useState, useEffect, useCallback } from "react";
import { supabase } from "../lib/supabase";

export interface TeamMemberDB {
  id: string;
  dept_id: string;
  nome: string;
  cargo: string;
  email?: string;
  telefone?: string;
  avatar_initials?: string;
  created_at: string;
}

export function useTeamMembers(deptId: string) {
  const [members, setMembers] = useState<TeamMemberDB[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchMembers = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("dept_team_members")
      .select("*")
      .eq("dept_id", deptId)
      .order("created_at", { ascending: true });
    if (!error) setMembers(data ?? []);
    else console.warn("[useTeamMembers]", error.message);
    setLoading(false);
  }, [deptId]);

  useEffect(() => {
    fetchMembers();
    const channel = supabase
      .channel(`dept_team_${deptId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "dept_team_members", filter: `dept_id=eq.${deptId}` }, () => fetchMembers())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchMembers, deptId]);

  const addMember = useCallback(async (member: { nome: string; cargo: string; email?: string; telefone?: string }) => {
    const initials = member.nome.split(" ").filter(Boolean).map(w => w[0]).join("").slice(0, 2).toUpperCase();
    const { error } = await supabase.from("dept_team_members").insert({
      dept_id: deptId,
      nome: member.nome,
      cargo: member.cargo,
      email: member.email ?? null,
      telefone: member.telefone ?? null,
      avatar_initials: initials,
    });
    if (error) throw new Error(error.message);
  }, [deptId]);

  const updateMember = useCallback(async (id: string, fields: Partial<Pick<TeamMemberDB, "nome" | "cargo" | "email" | "telefone">>) => {
    const patch: any = { ...fields };
    if (fields.nome) {
      patch.avatar_initials = fields.nome.split(" ").filter(Boolean).map(w => w[0]).join("").slice(0, 2).toUpperCase();
    }
    const { error } = await supabase.from("dept_team_members").update(patch).eq("id", id);
    if (error) throw new Error(error.message);
    setMembers(prev => prev.map(m => m.id === id ? { ...m, ...patch } : m));
  }, []);

  const deleteMember = useCallback(async (id: string) => {
    const { error } = await supabase.from("dept_team_members").delete().eq("id", id);
    if (error) throw new Error(error.message);
    setMembers(prev => prev.filter(m => m.id !== id));
  }, []);

  return { members, loading, addMember, updateMember, deleteMember };
}
