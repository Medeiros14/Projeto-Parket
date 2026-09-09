import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router";
import {
  Plus, Trash2, Edit2, X, Check, Shield, Eye, ChevronLeft,
  UserCircle2, Users, Lock, Mail, AlertCircle, RefreshCw,
} from "lucide-react";
import { supabase, createAdminClient } from "../lib/supabase";
import { useAuth, type UserProfile, type Role, type Permission } from "../contexts/AuthContext";

const BG = "#0A0A0A";
const CARD_BG = "#111111";
const BORDER = "rgba(255,255,255,0.06)";
const ACCENT = "#D4A853";
const TEXT_DIM = "rgba(255,255,255,0.4)";
const TEXT_MED = "rgba(255,255,255,0.6)";
const RED = "#EF4444";
const GREEN = "#10B981";
const GOLD = "#D4A853";

const ALL_DEPTS = [
  { id: "comercial", label: "Comercial" },
  { id: "projetos", label: "Projetos" },
  { id: "compras", label: "Compras" },
  { id: "producao", label: "Produção" },
  { id: "logistica", label: "Logística" },
  { id: "obras", label: "Obras" },
  { id: "financeiro", label: "Financeiro" },
  { id: "atendimento", label: "Atendimento" },
  { id: "fiscal", label: "Fiscal" },
  { id: "produtividade", label: "PMO" },
  { id: "marketing", label: "Marketing" },
  { id: "rh", label: "RH" },
  { id: "orcamento", label: "Orçamento" },
];

const ROLE_LABELS: Record<Role, string> = {
  superadmin: "Super Admin",
  admin: "Administrador",
  dept_leader: "Líder de Dept.",
  viewer: "Visualizador",
};

const ROLE_COLORS: Record<Role, string> = {
  superadmin: "#8B5CF6",
  admin: "#D4A853",
  dept_leader: "#3B82F6",
  viewer: "rgba(255,255,255,0.4)",
};

const PERM_LABELS: Record<Permission, string> = {
  view: "Ver",
  edit: "Editar",
  manage: "Gerenciar",
};

/* ─── Modal de criação/edição ─── */
interface UserFormData {
  full_name: string;
  email: string;
  password: string;
  role: Role;
  dept_permissions: Record<string, Permission>;
}

function UserModal({
  editUser,
  onClose,
  onSaved,
}: {
  editUser: UserProfile | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEdit = !!editUser;
  const [form, setForm] = useState<UserFormData>({
    full_name: editUser?.full_name ?? "",
    email: editUser?.email ?? "",
    password: "",
    role: editUser?.role ?? "viewer",
    dept_permissions: editUser?.dept_permissions ?? {},
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isFullAccess = form.role === "superadmin" || form.role === "admin";

  function toggleDept(deptId: string) {
    setForm(prev => {
      const perms = { ...prev.dept_permissions };
      if (deptId in perms) {
        delete perms[deptId];
      } else {
        perms[deptId] = "view";
      }
      return { ...prev, dept_permissions: perms };
    });
  }

  function setDeptPerm(deptId: string, perm: Permission) {
    setForm(prev => ({
      ...prev,
      dept_permissions: { ...prev.dept_permissions, [deptId]: perm },
    }));
  }

  async function handleSave() {
    setSaving(true);
    setError(null);

    try {
      if (isEdit) {
        // Atualiza perfil existente
        const { error } = await supabase
          .from("user_profiles")
          .update({
            full_name: form.full_name,
            role: form.role,
            dept_permissions: isFullAccess ? {} : form.dept_permissions,
          })
          .eq("id", editUser!.id);
        if (error) throw new Error(error.message);
      } else {
        // Cria novo usuário via admin API
        let adminClient;
        try {
          adminClient = createAdminClient();
        } catch {
          throw new Error(
            "Para criar usuários, configure VITE_SUPABASE_SERVICE_KEY no ambiente de build."
          );
        }

        const { data, error: createError } = await adminClient.auth.admin.createUser({
          email: form.email,
          password: form.password,
          email_confirm: true,
          user_metadata: {
            full_name: form.full_name,
            role: form.role,
            dept_permissions: isFullAccess ? {} : form.dept_permissions,
          },
        });

        if (createError) throw new Error(createError.message);

        // Insere perfil (a trigger cuida disso, mas upsert garante)
        await supabase.from("user_profiles").upsert({
          id: data.user!.id,
          email: form.email,
          full_name: form.full_name,
          role: form.role,
          dept_permissions: isFullAccess ? {} : form.dept_permissions,
        });
      }

      onSaved();
      onClose();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Erro desconhecido");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 50,
        background: "rgba(0,0,0,0.8)", backdropFilter: "blur(4px)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: "1rem",
      }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        style={{
          background: CARD_BG, border: `1px solid ${BORDER}`,
          borderRadius: 16, width: "100%", maxWidth: 560,
          maxHeight: "90vh", overflowY: "auto", padding: 24,
        }}
      >
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
          <div>
            <h3 style={{ color: "white", fontSize: "0.95rem", fontWeight: 600, margin: 0 }}>
              {isEdit ? "Editar Usuário" : "Novo Usuário"}
            </h3>
            <p style={{ fontSize: "0.6rem", color: TEXT_DIM, margin: "2px 0 0" }}>
              {isEdit ? "Altere o perfil e permissões" : "Cadastre um novo acesso"}
            </p>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: TEXT_DIM }}>
            <X size={18} />
          </button>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {/* Nome */}
          <Field label="NOME COMPLETO">
            <input
              value={form.full_name}
              onChange={e => setForm(p => ({ ...p, full_name: e.target.value }))}
              placeholder="Ex: João Silva"
              style={inputStyle}
            />
          </Field>

          {/* Email (só criação) */}
          {!isEdit && (
            <Field label="EMAIL">
              <div style={{ position: "relative" }}>
                <Mail size={13} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: TEXT_DIM }} />
                <input
                  type="email"
                  value={form.email}
                  onChange={e => setForm(p => ({ ...p, email: e.target.value }))}
                  placeholder="email@parket.com.br"
                  style={{ ...inputStyle, paddingLeft: 30 }}
                />
              </div>
            </Field>
          )}

          {/* Senha (só criação) */}
          {!isEdit && (
            <Field label="SENHA INICIAL">
              <div style={{ position: "relative" }}>
                <Lock size={13} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: TEXT_DIM }} />
                <input
                  type="password"
                  value={form.password}
                  onChange={e => setForm(p => ({ ...p, password: e.target.value }))}
                  placeholder="Mínimo 8 caracteres"
                  minLength={8}
                  style={{ ...inputStyle, paddingLeft: 30 }}
                />
              </div>
            </Field>
          )}

          {/* Role */}
          <Field label="PERFIL DE ACESSO">
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
              {(["superadmin", "admin", "dept_leader", "viewer"] as Role[]).map(r => (
                <button
                  key={r}
                  onClick={() => setForm(p => ({ ...p, role: r }))}
                  style={{
                    background: form.role === r ? `${ROLE_COLORS[r]}18` : "rgba(255,255,255,0.02)",
                    border: `1px solid ${form.role === r ? ROLE_COLORS[r] + "50" : BORDER}`,
                    borderRadius: 8, padding: "8px 10px",
                    color: form.role === r ? "white" : TEXT_DIM,
                    fontSize: "0.7rem", fontWeight: form.role === r ? 600 : 400,
                    cursor: "pointer", textAlign: "left",
                    display: "flex", alignItems: "center", gap: 6,
                    transition: "all 0.15s",
                  }}
                >
                  <div style={{ width: 7, height: 7, borderRadius: "50%", background: form.role === r ? ROLE_COLORS[r] : "rgba(255,255,255,0.2)", flexShrink: 0 }} />
                  {ROLE_LABELS[r]}
                </button>
              ))}
            </div>
            <p style={{ fontSize: "0.55rem", color: TEXT_DIM, marginTop: 6, lineHeight: 1.5 }}>
              {form.role === "superadmin" && "Acesso total + gerenciamento de usuários"}
              {form.role === "admin" && "Acesso a todos os departamentos, sem gerenciar usuários"}
              {form.role === "dept_leader" && "Acesso somente aos departamentos selecionados abaixo"}
              {form.role === "viewer" && "Visualização somente dos departamentos selecionados"}
            </p>
          </Field>

          {/* Dept permissions — só para dept_leader e viewer */}
          {!isFullAccess && (
            <Field label="DEPARTAMENTOS E PERMISSÕES">
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                {ALL_DEPTS.map(dept => {
                  const hasPerm = dept.id in form.dept_permissions;
                  const perm = form.dept_permissions[dept.id];
                  return (
                    <div
                      key={dept.id}
                      style={{
                        display: "flex", alignItems: "center", gap: 8,
                        padding: "6px 8px", borderRadius: 8,
                        background: hasPerm ? "rgba(255,255,255,0.03)" : "transparent",
                        border: `1px solid ${hasPerm ? BORDER : "transparent"}`,
                        transition: "all 0.15s",
                      }}
                    >
                      <button
                        onClick={() => toggleDept(dept.id)}
                        style={{
                          width: 16, height: 16, borderRadius: 4, flexShrink: 0,
                          background: hasPerm ? ACCENT : "rgba(255,255,255,0.05)",
                          border: `1px solid ${hasPerm ? ACCENT : BORDER}`,
                          display: "flex", alignItems: "center", justifyContent: "center",
                          cursor: "pointer",
                        }}
                      >
                        {hasPerm && <Check size={10} color="#0A0A0A" />}
                      </button>
                      <span style={{ fontSize: "0.7rem", color: hasPerm ? "white" : TEXT_DIM, flex: 1 }}>
                        {dept.label}
                      </span>
                      {hasPerm && (
                        <div style={{ display: "flex", gap: 4 }}>
                          {(["view", "edit", "manage"] as Permission[]).map(p => (
                            <button
                              key={p}
                              onClick={() => setDeptPerm(dept.id, p)}
                              style={{
                                padding: "2px 8px", borderRadius: 6, fontSize: "0.5rem",
                                fontWeight: perm === p ? 600 : 400,
                                background: perm === p ? `${ACCENT}20` : "rgba(255,255,255,0.04)",
                                border: `1px solid ${perm === p ? ACCENT + "50" : BORDER}`,
                                color: perm === p ? ACCENT : TEXT_DIM,
                                cursor: "pointer",
                              }}
                            >
                              {PERM_LABELS[p]}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </Field>
          )}

          {/* Error */}
          {error && (
            <div style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: 8, padding: "8px 12px", display: "flex", gap: 8, alignItems: "flex-start" }}>
              <AlertCircle size={13} style={{ color: RED, flexShrink: 0, marginTop: 1 }} />
              <p style={{ fontSize: "0.65rem", color: RED, lineHeight: 1.5, margin: 0 }}>{error}</p>
            </div>
          )}

          {/* Actions */}
          <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
            <button
              onClick={onClose}
              style={{ flex: 1, padding: "9px", background: "rgba(255,255,255,0.04)", border: `1px solid ${BORDER}`, borderRadius: 8, color: TEXT_MED, fontSize: "0.72rem", cursor: "pointer" }}
            >
              Cancelar
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              style={{
                flex: 2, padding: "9px",
                background: saving ? "rgba(212,168,83,0.2)" : ACCENT,
                border: "none", borderRadius: 8,
                color: saving ? "rgba(255,255,255,0.4)" : "#0A0A0A",
                fontSize: "0.72rem", fontWeight: 700, cursor: saving ? "not-allowed" : "pointer",
              }}
            >
              {saving ? "Salvando…" : isEdit ? "Salvar Alterações" : "Criar Usuário"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label style={{ display: "block", fontSize: "0.55rem", color: TEXT_DIM, fontWeight: 600, letterSpacing: "0.1em", marginBottom: 6 }}>
        {label}
      </label>
      {children}
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%", background: "rgba(255,255,255,0.03)",
  border: `1px solid ${BORDER}`, borderRadius: 8,
  color: "white", fontSize: "0.78rem",
  padding: "9px 12px", outline: "none",
  boxSizing: "border-box",
};

/* ─── Confirm delete ─── */
function ConfirmDelete({ name, onConfirm, onCancel }: { name: string; onConfirm: () => void; onCancel: () => void }) {
  return (
    <div
      style={{ position: "fixed", inset: 0, zIndex: 60, background: "rgba(0,0,0,0.85)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem" }}
      onClick={e => { if (e.target === e.currentTarget) onCancel(); }}
    >
      <div style={{ background: CARD_BG, border: `1px solid rgba(239,68,68,0.25)`, borderRadius: 14, padding: 24, maxWidth: 340, width: "100%" }}>
        <p style={{ color: "white", fontSize: "0.9rem", fontWeight: 600, marginBottom: 6 }}>Remover usuário?</p>
        <p style={{ fontSize: "0.7rem", color: TEXT_DIM, marginBottom: 20, lineHeight: 1.6 }}>
          <strong style={{ color: "white" }}>{name}</strong> perderá acesso ao sistema. Essa ação não pode ser desfeita.
        </p>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={onCancel} style={{ flex: 1, padding: "8px", background: "rgba(255,255,255,0.04)", border: `1px solid ${BORDER}`, borderRadius: 8, color: TEXT_MED, fontSize: "0.72rem", cursor: "pointer" }}>Cancelar</button>
          <button onClick={onConfirm} style={{ flex: 1, padding: "8px", background: "rgba(239,68,68,0.15)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: 8, color: RED, fontSize: "0.72rem", fontWeight: 600, cursor: "pointer" }}>Remover</button>
        </div>
      </div>
    </div>
  );
}

/* ─── Page ─── */
export function AdminUsersPage() {
  const { user: me } = useAuth();
  const navigate = useNavigate();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalUser, setModalUser] = useState<UserProfile | null | "new">(null);
  const [deleteUser, setDeleteUser] = useState<UserProfile | null>(null);
  const [deleting, setDeleting] = useState(false);

  const loadUsers = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from("user_profiles").select("*").order("full_name");
    setUsers((data ?? []) as UserProfile[]);
    setLoading(false);
  }, []);

  useEffect(() => { loadUsers(); }, [loadUsers]);

  async function handleDelete() {
    if (!deleteUser) return;
    setDeleting(true);
    try {
      const adminClient = createAdminClient();
      await adminClient.auth.admin.deleteUser(deleteUser.id);
    } catch {
      await supabase.from("user_profiles").delete().eq("id", deleteUser.id);
    }
    setDeleteUser(null);
    setDeleting(false);
    loadUsers();
  }

  return (
    <div className="min-h-screen" style={{ background: BG, fontFamily: "'Inter', sans-serif" }}>
      {/* Top bar */}
      <div style={{ borderBottom: `1px solid ${BORDER}`, padding: "14px 24px", display: "flex", alignItems: "center", gap: 12 }}>
        <button onClick={() => navigate("/")} style={{ background: "none", border: "none", cursor: "pointer", color: TEXT_DIM, display: "flex", alignItems: "center", gap: 6, fontSize: "0.7rem" }}>
          <ChevronLeft size={14} /> Voltar
        </button>
        <div style={{ flex: 1 }} />
        <Shield size={14} style={{ color: GOLD }} />
        <span style={{ fontSize: "0.7rem", color: GOLD, fontWeight: 600 }}>Gerenciamento de Usuários</span>
        <span style={{ fontSize: "0.6rem", color: TEXT_DIM }}>·</span>
        <span style={{ fontSize: "0.6rem", color: TEXT_DIM }}>{me?.full_name}</span>
      </div>

      <div style={{ maxWidth: 860, margin: "0 auto", padding: "32px 16px" }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: 12, marginBottom: 28 }}>
          <div>
            <h1 style={{ color: "white", fontSize: "1.3rem", fontWeight: 700, margin: 0 }}>Usuários & Acessos</h1>
            <p style={{ fontSize: "0.7rem", color: TEXT_DIM, marginTop: 4 }}>
              {users.length} usuário{users.length !== 1 ? "s" : ""} cadastrado{users.length !== 1 ? "s" : ""}
            </p>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              onClick={loadUsers}
              style={{ padding: "8px 12px", background: "rgba(255,255,255,0.04)", border: `1px solid ${BORDER}`, borderRadius: 8, color: TEXT_DIM, cursor: "pointer", display: "flex", alignItems: "center", gap: 6, fontSize: "0.7rem" }}
            >
              <RefreshCw size={13} /> Atualizar
            </button>
            <button
              onClick={() => setModalUser("new")}
              style={{ padding: "8px 14px", background: ACCENT, border: "none", borderRadius: 8, color: "#0A0A0A", fontSize: "0.72rem", fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}
            >
              <Plus size={14} /> Novo Usuário
            </button>
          </div>
        </div>

        {/* Roles legend */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 20 }}>
          {(Object.entries(ROLE_LABELS) as [Role, string][]).map(([role, label]) => (
            <div key={role} style={{ display: "flex", alignItems: "center", gap: 5, padding: "4px 10px", borderRadius: 20, background: `${ROLE_COLORS[role]}12`, border: `1px solid ${ROLE_COLORS[role]}30` }}>
              <div style={{ width: 6, height: 6, borderRadius: "50%", background: ROLE_COLORS[role] }} />
              <span style={{ fontSize: "0.55rem", color: ROLE_COLORS[role], fontWeight: 600 }}>{label}</span>
            </div>
          ))}
        </div>

        {/* Users table */}
        {loading ? (
          <div style={{ textAlign: "center", padding: "60px 0", color: TEXT_DIM, fontSize: "0.75rem" }}>
            Carregando usuários…
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {users.map(u => {
              const isMe = u.id === me?.id;
              const deptCount = Object.keys(u.dept_permissions).length;
              const isFullAccess = u.role === "superadmin" || u.role === "admin";
              return (
                <div
                  key={u.id}
                  style={{
                    background: isMe ? `${ACCENT}08` : CARD_BG,
                    border: `1px solid ${isMe ? ACCENT + "25" : BORDER}`,
                    borderRadius: 12, padding: "14px 16px",
                    display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap",
                  }}
                >
                  {/* Avatar */}
                  <div style={{
                    width: 38, height: 38, borderRadius: 10, flexShrink: 0,
                    background: `${u.avatar_color}20`, display: "flex", alignItems: "center",
                    justifyContent: "center", fontSize: "0.8rem", fontWeight: 700, color: u.avatar_color,
                  }}>
                    {u.full_name.charAt(0).toUpperCase()}
                  </div>

                  {/* Info */}
                  <div style={{ flex: 1, minWidth: 160 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
                      <span style={{ fontSize: "0.8rem", fontWeight: 600, color: "white" }}>{u.full_name}</span>
                      {isMe && <span style={{ fontSize: "0.45rem", background: `${ACCENT}20`, color: ACCENT, padding: "1px 6px", borderRadius: 10, fontWeight: 600 }}>VOCÊ</span>}
                    </div>
                    <span style={{ fontSize: "0.6rem", color: TEXT_DIM }}>{u.email}</span>
                  </div>

                  {/* Role badge */}
                  <div style={{ display: "flex", alignItems: "center", gap: 5, padding: "4px 10px", borderRadius: 20, background: `${ROLE_COLORS[u.role]}12`, border: `1px solid ${ROLE_COLORS[u.role]}30` }}>
                    <div style={{ width: 6, height: 6, borderRadius: "50%", background: ROLE_COLORS[u.role] }} />
                    <span style={{ fontSize: "0.58rem", color: ROLE_COLORS[u.role], fontWeight: 600 }}>{ROLE_LABELS[u.role]}</span>
                  </div>

                  {/* Dept access */}
                  <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                    {isFullAccess ? (
                      <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: "0.58rem", color: GREEN }}>
                        <Eye size={11} /> Todos os departamentos
                      </div>
                    ) : (
                      <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: "0.58rem", color: TEXT_DIM }}>
                        <Users size={11} />
                        {deptCount === 0 ? "Sem acesso" : `${deptCount} dept${deptCount !== 1 ? "s" : ""}`}
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div style={{ display: "flex", gap: 6 }}>
                    <button
                      onClick={() => setModalUser(u)}
                      style={{ padding: "6px 10px", background: "rgba(255,255,255,0.04)", border: `1px solid ${BORDER}`, borderRadius: 8, color: TEXT_MED, cursor: "pointer", display: "flex", alignItems: "center", gap: 5, fontSize: "0.62rem" }}
                    >
                      <Edit2 size={12} /> Editar
                    </button>
                    {!isMe && (
                      <button
                        onClick={() => setDeleteUser(u)}
                        style={{ padding: "6px 10px", background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.15)", borderRadius: 8, color: RED, cursor: "pointer", display: "flex", alignItems: "center", gap: 5, fontSize: "0.62rem" }}
                      >
                        <Trash2 size={12} />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}

            {users.length === 0 && (
              <div style={{ textAlign: "center", padding: "60px 0", color: TEXT_DIM }}>
                <UserCircle2 size={32} style={{ margin: "0 auto 12px", opacity: 0.3 }} />
                <p style={{ fontSize: "0.75rem" }}>Nenhum usuário cadastrado ainda</p>
                <p style={{ fontSize: "0.6rem", marginTop: 4 }}>Clique em "Novo Usuário" para começar</p>
              </div>
            )}
          </div>
        )}

        {/* SQL hint */}
        <div style={{ marginTop: 32, padding: "14px 16px", borderRadius: 10, background: "rgba(212,168,83,0.05)", border: "1px solid rgba(212,168,83,0.12)" }}>
          <p style={{ fontSize: "0.6rem", color: GOLD, fontWeight: 600, marginBottom: 4 }}>Para criar usuários via este painel</p>
          <p style={{ fontSize: "0.58rem", color: TEXT_DIM, lineHeight: 1.6, margin: 0 }}>
            Configure <code style={{ color: ACCENT }}>VITE_SUPABASE_SERVICE_KEY</code> no build do Docker para habilitar criação de usuários diretamente pelo painel. Alternativamente, crie usuários pelo painel Supabase → Authentication.
          </p>
        </div>
      </div>

      {/* Modais */}
      {(modalUser === "new" || (modalUser && modalUser !== "new")) && (
        <UserModal
          editUser={modalUser === "new" ? null : modalUser as UserProfile}
          onClose={() => setModalUser(null)}
          onSaved={loadUsers}
        />
      )}
      {deleteUser && (
        <ConfirmDelete
          name={deleteUser.full_name}
          onConfirm={handleDelete}
          onCancel={() => setDeleteUser(null)}
        />
      )}
      {deleting && (
        <div style={{ position: "fixed", inset: 0, zIndex: 70, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <p style={{ color: "white", fontSize: "0.8rem" }}>Removendo…</p>
        </div>
      )}
    </div>
  );
}
