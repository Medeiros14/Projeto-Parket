import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Search, Check, X, RotateCcw, UserPlus, KeyRound, Eye, EyeOff } from "lucide-react";
import type { ThemeMode, ThemeTokens } from "./components/gestao/theme";
import type { AppUser } from "../lib/auth";
import { supabase, createAdminClient } from "../lib/supabase";
import { ALL_DEPTS, type PortalApp, type PortalOverride } from "../lib/portalData";

const FONT_DISPLAY = "'Cinzel', serif";
const FONT_BODY = "'Inter', sans-serif";

interface PerfilRow {
  id: string;
  email: string;
  full_name: string;
  role: string;
  ativo: boolean;
  dept_permissions: any;
  senha_texto: string | null;
}

const ROLE_OPTIONS = ["superadmin", "admin", "dept_leader", "viewer", "projetista"];

function deptsOf(dp: any): string[] {
  let x: any = dp || {};
  if (typeof x === "string") { try { x = JSON.parse(x); } catch { x = {}; } }
  if (Array.isArray(x)) x = typeof x[1] === "object" ? x[1] : {};
  if (!x || typeof x !== "object") return [];
  return Object.keys(x).filter((k) => {
    if (k.startsWith("_")) return false;
    const v = x[k];
    if (v === true) return true;
    if (v && typeof v === "object") return v.view === true || v.manage === true;
    return false;
  });
}

interface AdminAcessosProps {
  user: AppUser;
  theme: ThemeMode;
  T: ThemeTokens;
  onBack: () => void;
  onChanged: () => void;
}

export function AdminAcessos({ user, theme, T, onBack, onChanged }: AdminAcessosProps) {
  const [apps, setApps] = useState<PortalApp[]>([]);
  const [overrides, setOverrides] = useState<PortalOverride[]>([]);
  const [perfis, setPerfis] = useState<PerfilRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [saving, setSaving] = useState<string | null>(null);
  const [tab, setTab] = useState<"apps" | "usuarios">("apps");
  const [userSearch, setUserSearch] = useState("");
  const [selUser, setSelUser] = useState<PerfilRow | null>(null);
  const [modalUser, setModalUser] = useState<"new" | PerfilRow | null>(null);
  const [pwdReset, setPwdReset] = useState<PerfilRow | null>(null);
  const [showPwd, setShowPwd] = useState(false);

  async function loadAll() {
    setLoading(true);
    setErr(null);
    try {
      const [a, o, p] = await Promise.all([
        supabase.from("portal_apps").select("*").order("ordem"),
        supabase.from("portal_user_overrides").select("*"),
        supabase.from("user_profiles").select("id, email, full_name, role, ativo, dept_permissions, senha_texto").order("full_name"),
      ]);
      if (a.error) throw a.error;
      if (o.error) throw o.error;
      if (p.error) throw p.error;
      setApps((a.data || []) as PortalApp[]);
      setOverrides((o.data || []) as PortalOverride[]);
      setPerfis((p.data || []) as PerfilRow[]);
    } catch (e: any) {
      setErr(e?.message || "Falha ao carregar");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadAll(); }, []);

  async function patchApp(id: string, patch: Partial<PortalApp>) {
    setSaving(id);
    const { error } = await supabase.from("portal_apps").update(patch).eq("id", id);
    setSaving(null);
    if (error) { setErr(error.message); return; }
    setApps((prev) => prev.map((a) => (a.id === id ? { ...a, ...patch } : a)));
    onChanged();
  }

  function toggleDept(app: PortalApp, dept: string) {
    let depts: string[] | null;
    if (app.depts === null) {
      // "todos" → vira lista com todos menos o clicado
      depts = ALL_DEPTS.filter((d) => d !== dept);
    } else if (app.depts.includes(dept)) {
      depts = app.depts.filter((d) => d !== dept);
    } else {
      depts = [...app.depts, dept];
    }
    patchApp(app.id, { depts });
  }

  async function setOverride(userId: string, appId: string, allow: boolean | null) {
    setSaving(`${userId}:${appId}`);
    try {
      if (allow === null) {
        const { error } = await supabase.from("portal_user_overrides")
          .delete().eq("user_id", userId).eq("app_id", appId);
        if (error) throw error;
        setOverrides((prev) => prev.filter((o) => !(o.user_id === userId && o.app_id === appId)));
      } else {
        const { error } = await supabase.from("portal_user_overrides")
          .upsert({ user_id: userId, app_id: appId, allow });
        if (error) throw error;
        setOverrides((prev) => {
          const rest = prev.filter((o) => !(o.user_id === userId && o.app_id === appId));
          return [...rest, { user_id: userId, app_id: appId, allow }];
        });
      }
      onChanged();
    } catch (e: any) {
      setErr(e?.message || "Falha ao salvar");
    } finally {
      setSaving(null);
    }
  }

  const filteredPerfis = useMemo(() => {
    const q = userSearch.trim().toLowerCase();
    const base = perfis.filter((p) => p.ativo !== false);
    if (!q) return base;
    return base.filter((p) =>
      (p.full_name || "").toLowerCase().includes(q) || (p.email || "").toLowerCase().includes(q));
  }, [perfis, userSearch]);

  const btn = (active: boolean): React.CSSProperties => ({
    padding: "6px 18px", cursor: "pointer",
    border: `1px solid ${active ? T.borderHover : T.border}`,
    background: active ? T.cardHover : "none",
    color: active ? T.textPrimary : T.textSecondary,
    fontFamily: FONT_BODY, fontSize: 9, letterSpacing: "0.16em",
  });

  return (
    <div style={{ backgroundColor: T.bg, minHeight: "100vh", color: T.textPrimary, transition: "background 0.35s" }}>
      {/* Header */}
      <div style={{
        position: "fixed", top: 0, left: 0, right: 0, zIndex: 10,
        borderBottom: `1px solid ${T.border}`, padding: "0 64px", height: 64,
        display: "flex", alignItems: "center", justifyContent: "space-between",
        backgroundColor: T.headerBg, backdropFilter: "blur(12px)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <button onClick={onBack} style={{
            display: "flex", alignItems: "center", gap: 7, background: "none", border: "none",
            cursor: "pointer", color: T.textSecondary, fontFamily: FONT_BODY, fontSize: 9, letterSpacing: "0.14em",
          }}>
            <ArrowLeft size={12} /> VOLTAR
          </button>
          <div style={{ width: 1, height: 16, backgroundColor: T.border }} />
          <p style={{ fontFamily: FONT_BODY, fontSize: 9, letterSpacing: "0.18em", color: T.textSecondary }}>
            GESTÃO DE ACESSOS
          </p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button style={btn(tab === "apps")} onClick={() => setTab("apps")}>APLICATIVOS</button>
          <button style={btn(tab === "usuarios")} onClick={() => setTab("usuarios")}>USUÁRIOS</button>
        </div>
      </div>

      <div style={{ paddingTop: 64, maxWidth: 1200, margin: "0 auto", padding: "104px 64px 80px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 32, gap: 24 }}>
          <div>
            <h1 style={{ fontFamily: FONT_DISPLAY, fontSize: 24, letterSpacing: "0.08em", fontWeight: 400, marginBottom: 8 }}>
              {tab === "apps" ? "APLICATIVOS × DEPARTAMENTOS" : "OVERRIDES POR USUÁRIO"}
            </h1>
            <p style={{ fontFamily: FONT_BODY, fontSize: 11, color: T.textMuted, lineHeight: 1.7, margin: 0 }}>
              {tab === "apps"
                ? "Clique nos departamentos para liberar/bloquear cada app. TODOS = qualquer usuário ativo. Nenhum = só admins."
                : "Exceções individuais: liberar um app fora do departamento do usuário, ou bloquear um app que o departamento veria."}
            </p>
          </div>
          {tab === "usuarios" && (
            <button
              onClick={() => setModalUser("new")}
              style={{
                display: "flex", alignItems: "center", gap: 8,
                padding: "10px 18px", cursor: "pointer",
                border: `1px solid ${T.borderHover}`, background: T.cardHover,
                color: T.textPrimary, fontFamily: FONT_BODY,
                fontSize: 9, letterSpacing: "0.16em", whiteSpace: "nowrap",
              }}
            >
              <UserPlus size={12} /> NOVO USUÁRIO
            </button>
          )}
        </div>

        {err && (
          <p style={{ fontFamily: FONT_BODY, fontSize: 11, color: "#B0563C", marginBottom: 20 }}>{err}</p>
        )}
        {loading && (
          <p style={{ fontFamily: FONT_BODY, fontSize: 11, color: T.textMuted }}>Carregando…</p>
        )}

        {!loading && tab === "apps" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            {apps.map((app) => {
              const todos = app.depts === null;
              const nenhum = app.depts !== null && app.depts.length === 0;
              return (
                <div key={app.id} style={{
                  border: `1px solid ${T.border}`, backgroundColor: T.statBg, padding: "20px 24px",
                  opacity: saving === app.id ? 0.6 : 1,
                }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                      <p style={{ fontFamily: FONT_DISPLAY, fontSize: 12, letterSpacing: "0.1em" }}>
                        {app.nome.toUpperCase()}
                      </p>
                      <span style={{ fontFamily: FONT_BODY, fontSize: 9, color: T.textMuted }}>{app.url.replace("https://", "")}</span>
                      {app.badge && (
                        <span style={{ fontFamily: FONT_BODY, fontSize: 8, letterSpacing: "0.12em", color: T.textSecondary, border: `1px solid ${T.border}`, padding: "2px 8px" }}>
                          {app.badge}
                        </span>
                      )}
                    </div>
                    <div style={{ display: "flex", gap: 8 }}>
                      <button style={btn(todos)} onClick={() => patchApp(app.id, { depts: todos ? [] : null })}>
                        {todos ? "TODOS ✓" : "TODOS"}
                      </button>
                      <button style={btn(app.ativo)} onClick={() => patchApp(app.id, { ativo: !app.ativo })}>
                        {app.ativo ? "ATIVO" : "INATIVO"}
                      </button>
                    </div>
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {ALL_DEPTS.map((d) => {
                      const on = todos || (app.depts || []).includes(d);
                      return (
                        <button
                          key={d}
                          onClick={() => toggleDept(app, d)}
                          style={{
                            padding: "4px 12px", cursor: "pointer",
                            border: `1px solid ${on ? T.borderHover : T.border}`,
                            background: on ? T.cardHover : "none",
                            color: on ? T.textPrimary : T.textMuted,
                            fontFamily: FONT_BODY, fontSize: 8, letterSpacing: "0.12em",
                          }}
                        >
                          {d.toUpperCase()}
                        </button>
                      );
                    })}
                    {nenhum && (
                      <span style={{ fontFamily: FONT_BODY, fontSize: 9, color: "#B0563C", alignSelf: "center", letterSpacing: "0.08em" }}>
                        SÓ ADMINS
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {!loading && tab === "usuarios" && (
          <div style={{ display: "grid", gridTemplateColumns: "320px 1fr", gap: 2, alignItems: "start" }}>
            {/* Lista de usuários */}
            <div style={{ border: `1px solid ${T.border}`, backgroundColor: T.statBg }}>
              <div style={{ position: "relative", borderBottom: `1px solid ${T.border}` }}>
                <Search size={12} color={T.textMuted} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)" }} />
                <input
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                  placeholder="Buscar usuário..."
                  style={{
                    width: "100%", padding: "10px 12px 10px 32px",
                    background: "none", border: "none", outline: "none",
                    color: T.textPrimary, fontFamily: FONT_BODY, fontSize: 11, boxSizing: "border-box",
                  }}
                />
              </div>
              <div style={{ maxHeight: 520, overflowY: "auto" }}>
                {filteredPerfis.map((p) => {
                  const nOv = overrides.filter((o) => o.user_id === p.id).length;
                  const sel = selUser?.id === p.id;
                  return (
                    <button
                      key={p.id}
                      onClick={() => setSelUser(p)}
                      style={{
                        display: "flex", justifyContent: "space-between", alignItems: "center",
                        width: "100%", textAlign: "left", padding: "10px 14px", cursor: "pointer",
                        background: sel ? T.cardHover : "none",
                        border: "none", borderBottom: `1px solid ${T.border}`,
                        color: T.textPrimary,
                      }}
                    >
                      <span style={{ fontFamily: FONT_BODY, fontSize: 11 }}>
                        {p.full_name || p.email}
                        <span style={{ display: "block", fontSize: 9, color: T.textMuted }}>
                          {p.email} · {p.role}
                          {(() => {
                            const ds = deptsOf(p.dept_permissions);
                            return ds.length ? ` · ${ds.join(", ")}` : "";
                          })()}
                        </span>
                      </span>
                      {nOv > 0 && (
                        <span style={{ fontFamily: FONT_BODY, fontSize: 8, letterSpacing: "0.1em", color: T.textSecondary, border: `1px solid ${T.border}`, padding: "2px 6px" }}>
                          {nOv}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Overrides do usuário selecionado */}
            <div style={{ border: `1px solid ${T.border}`, backgroundColor: T.statBg, padding: "20px 24px", minHeight: 300 }}>
              {!selUser ? (
                <p style={{ fontFamily: FONT_BODY, fontSize: 11, color: T.textMuted }}>
                  Selecione um usuário para ver e editar as exceções.
                </p>
              ) : (
                <>
                  <p style={{ fontFamily: FONT_DISPLAY, fontSize: 13, letterSpacing: "0.08em", marginBottom: 4 }}>
                    {(selUser.full_name || selUser.email).toUpperCase()}
                  </p>
                  <p style={{ fontFamily: FONT_BODY, fontSize: 9, color: T.textMuted, marginBottom: 12, letterSpacing: "0.06em" }}>
                    {selUser.email} · role {selUser.role}
                    {(() => {
                      const ds = deptsOf(selUser.dept_permissions);
                      return ds.length ? ` · setor ${ds.join(", ")}` : " · sem setor";
                    })()}
                  </p>

                  {/* Credenciais */}
                  <div style={{
                    display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap",
                    padding: "10px 12px", marginBottom: 20,
                    border: `1px solid ${T.border}`, background: T.bg,
                  }}>
                    <span style={{ fontFamily: FONT_BODY, fontSize: 8, letterSpacing: "0.14em", color: T.textMuted }}>
                      LOGIN
                    </span>
                    <span style={{ fontFamily: "monospace", fontSize: 11, color: T.textPrimary }}>
                      {selUser.email}
                    </span>
                    <div style={{ width: 1, height: 14, background: T.border }} />
                    <span style={{ fontFamily: FONT_BODY, fontSize: 8, letterSpacing: "0.14em", color: T.textMuted }}>
                      SENHA
                    </span>
                    <span style={{ fontFamily: "monospace", fontSize: 11, color: selUser.senha_texto ? T.textPrimary : T.textMuted }}>
                      {selUser.senha_texto
                        ? (showPwd ? selUser.senha_texto : "•".repeat(Math.min(12, selUser.senha_texto.length)))
                        : "— (defina uma nova)"}
                    </span>
                    {selUser.senha_texto && (
                      <button
                        onClick={() => setShowPwd((v) => !v)}
                        title={showPwd ? "Ocultar" : "Mostrar"}
                        style={{
                          background: "none", border: "none", cursor: "pointer",
                          color: T.textSecondary, display: "flex", alignItems: "center", padding: 2,
                        }}
                      >
                        {showPwd ? <EyeOff size={12} /> : <Eye size={12} />}
                      </button>
                    )}
                    <div style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
                      <button
                        onClick={() => setModalUser(selUser)}
                        style={{
                          display: "flex", alignItems: "center", gap: 5,
                          padding: "5px 10px", cursor: "pointer",
                          border: `1px solid ${T.border}`, background: "none",
                          color: T.textSecondary,
                          fontFamily: FONT_BODY, fontSize: 8, letterSpacing: "0.12em",
                        }}
                      >
                        EDITAR
                      </button>
                      <button
                        onClick={() => setPwdReset(selUser)}
                        style={{
                          display: "flex", alignItems: "center", gap: 5,
                          padding: "5px 10px", cursor: "pointer",
                          border: `1px solid ${T.border}`, background: "none",
                          color: T.textSecondary,
                          fontFamily: FONT_BODY, fontSize: 8, letterSpacing: "0.12em",
                        }}
                      >
                        <KeyRound size={10} /> REDEFINIR SENHA
                      </button>
                    </div>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
                    {apps.filter((a) => a.ativo).map((app) => {
                      const ov = overrides.find((o) => o.user_id === selUser.id && o.app_id === app.id);
                      const key = `${selUser.id}:${app.id}`;
                      const cell = (active: boolean, color: string): React.CSSProperties => ({
                        display: "flex", alignItems: "center", gap: 5, padding: "4px 10px", cursor: "pointer",
                        border: `1px solid ${active ? color : T.border}`,
                        background: active ? `${color}18` : "none",
                        color: active ? color : T.textMuted,
                        fontFamily: FONT_BODY, fontSize: 8, letterSpacing: "0.1em",
                        opacity: saving === key ? 0.5 : 1,
                      });
                      return (
                        <div key={app.id} style={{
                          display: "flex", alignItems: "center", justifyContent: "space-between",
                          padding: "8px 0", borderBottom: `1px solid ${T.border}`,
                        }}>
                          <span style={{ fontFamily: FONT_BODY, fontSize: 11 }}>
                            {app.nome}
                            <span style={{ fontSize: 9, color: T.textMuted, marginLeft: 8 }}>
                              {app.depts === null ? "todos" : app.depts.length === 0 ? "só admins" : app.depts.join(", ")}
                            </span>
                          </span>
                          <div style={{ display: "flex", gap: 6 }}>
                            <button style={cell(ov?.allow === true, "#7A9B76")} onClick={() => setOverride(selUser.id, app.id, true)}>
                              <Check size={9} /> LIBERAR
                            </button>
                            <button style={cell(ov?.allow === false, "#B0563C")} onClick={() => setOverride(selUser.id, app.id, false)}>
                              <X size={9} /> BLOQUEAR
                            </button>
                            <button style={cell(!ov, String(T.textSecondary))} onClick={() => setOverride(selUser.id, app.id, null)}>
                              <RotateCcw size={9} /> PADRÃO
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </div>

      {modalUser && (
        <UserModal
          T={T}
          editUser={modalUser === "new" ? null : modalUser}
          onClose={() => setModalUser(null)}
          onSaved={(saved) => {
            setModalUser(null);
            loadAll();
            if (saved) setSelUser(saved);
            onChanged();
          }}
        />
      )}

      {pwdReset && (
        <PasswordResetModal
          T={T}
          user={pwdReset}
          onClose={() => setPwdReset(null)}
          onSaved={(u) => {
            setPwdReset(null);
            loadAll();
            setSelUser(u);
          }}
        />
      )}
    </div>
  );
}

/* ─── Modal criar/editar ─── */
function UserModal({
  T, editUser, onClose, onSaved,
}: {
  T: ThemeTokens;
  editUser: PerfilRow | null;
  onClose: () => void;
  onSaved: (saved: PerfilRow | null) => void;
}) {
  const isEdit = !!editUser;
  const [nome, setNome] = useState(editUser?.full_name || "");
  const [email, setEmail] = useState(editUser?.email || "");
  const [senha, setSenha] = useState("");
  const [role, setRole] = useState(editUser?.role || "viewer");
  const [depts, setDepts] = useState<string[]>(() => deptsOf(editUser?.dept_permissions));
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  function toggleDept(d: string) {
    setDepts((prev) => prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d]);
  }

  function buildDeptPerms(): Record<string, { view: boolean; manage: boolean }> {
    const out: Record<string, { view: boolean; manage: boolean }> = {};
    for (const d of depts) out[d] = { view: true, manage: false };
    return out;
  }

  async function handleSave() {
    setSaving(true);
    setErr(null);
    try {
      const dp = buildDeptPerms();
      if (isEdit) {
        const patch: any = { full_name: nome, role, dept_permissions: dp };
        if (senha.trim()) patch.senha_texto = senha.trim();
        const { data, error } = await supabase.from("user_profiles")
          .update(patch).eq("id", editUser!.id).select().maybeSingle();
        if (error) throw error;
        if (senha.trim()) {
          const admin = createAdminClient();
          const r = await admin.auth.admin.updateUserById(editUser!.id, { password: senha.trim() });
          if (r.error) throw r.error;
        }
        onSaved((data as any) || null);
      } else {
        if (!email.trim() || !senha.trim()) throw new Error("Email e senha são obrigatórios");
        if (senha.trim().length < 6) throw new Error("Senha precisa ter ao menos 6 caracteres");
        const admin = createAdminClient();
        const { data, error } = await admin.auth.admin.createUser({
          email: email.trim(),
          password: senha.trim(),
          email_confirm: true,
          user_metadata: { full_name: nome },
        });
        if (error) throw error;
        const uid = data.user!.id;
        const { data: prof, error: upErr } = await supabase.from("user_profiles").upsert({
          id: uid,
          email: email.trim(),
          full_name: nome,
          role,
          dept_permissions: dp,
          ativo: true,
          senha_texto: senha.trim(),
        }).select().maybeSingle();
        if (upErr) throw upErr;
        onSaved((prof as any) || null);
      }
    } catch (e: any) {
      setErr(e?.message || "Falha ao salvar");
    } finally {
      setSaving(false);
    }
  }

  return (
    <ModalShell T={T} title={isEdit ? "EDITAR USUÁRIO" : "NOVO USUÁRIO"} onClose={onClose}>
      <ModalField T={T} label="NOME COMPLETO">
        <input value={nome} onChange={(e) => setNome(e.target.value)} style={inputStyle(T)} placeholder="Ex: João Silva" />
      </ModalField>
      <ModalField T={T} label="EMAIL">
        <input
          value={email} onChange={(e) => setEmail(e.target.value)}
          disabled={isEdit} type="email"
          style={{ ...inputStyle(T), opacity: isEdit ? 0.5 : 1 }}
          placeholder="email@parket.com.br"
        />
      </ModalField>
      <ModalField T={T} label={isEdit ? "NOVA SENHA (opcional — deixe vazio para manter)" : "SENHA INICIAL"}>
        <input
          value={senha} onChange={(e) => setSenha(e.target.value)}
          type="text" autoComplete="off"
          style={inputStyle(T)} placeholder={isEdit ? "•••••• (não alterar)" : "mínimo 6 caracteres"}
        />
      </ModalField>
      <ModalField T={T} label="ROLE">
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {ROLE_OPTIONS.map((r) => (
            <button key={r} onClick={() => setRole(r)}
              style={{
                padding: "6px 12px", cursor: "pointer",
                border: `1px solid ${role === r ? T.borderHover : T.border}`,
                background: role === r ? T.cardHover : "none",
                color: role === r ? T.textPrimary : T.textSecondary,
                fontFamily: FONT_BODY, fontSize: 9, letterSpacing: "0.12em",
              }}>
              {r.toUpperCase()}
            </button>
          ))}
        </div>
      </ModalField>
      <ModalField T={T} label="SETORES">
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {ALL_DEPTS.map((d) => {
            const on = depts.includes(d);
            return (
              <button key={d} onClick={() => toggleDept(d)}
                style={{
                  padding: "4px 12px", cursor: "pointer",
                  border: `1px solid ${on ? T.borderHover : T.border}`,
                  background: on ? T.cardHover : "none",
                  color: on ? T.textPrimary : T.textMuted,
                  fontFamily: FONT_BODY, fontSize: 8, letterSpacing: "0.12em",
                }}>
                {d.toUpperCase()}
              </button>
            );
          })}
        </div>
      </ModalField>
      {err && (
        <p style={{ fontFamily: FONT_BODY, fontSize: 11, color: "#B0563C", margin: "4px 0" }}>{err}</p>
      )}
      <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
        <button onClick={onClose} style={secondaryBtnStyle(T)}>CANCELAR</button>
        <button onClick={handleSave} disabled={saving} style={primaryBtnStyle(T, saving)}>
          {saving ? "SALVANDO..." : isEdit ? "SALVAR" : "CRIAR USUÁRIO"}
        </button>
      </div>
    </ModalShell>
  );
}

/* ─── Modal redefinir senha rápido ─── */
function PasswordResetModal({
  T, user, onClose, onSaved,
}: {
  T: ThemeTokens;
  user: PerfilRow;
  onClose: () => void;
  onSaved: (u: PerfilRow) => void;
}) {
  const [senha, setSenha] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function handleSave() {
    setSaving(true);
    setErr(null);
    try {
      if (senha.trim().length < 6) throw new Error("Mínimo 6 caracteres");
      const admin = createAdminClient();
      const r = await admin.auth.admin.updateUserById(user.id, { password: senha.trim() });
      if (r.error) throw r.error;
      const { data, error } = await supabase.from("user_profiles")
        .update({ senha_texto: senha.trim() }).eq("id", user.id).select().maybeSingle();
      if (error) throw error;
      onSaved((data as any) || { ...user, senha_texto: senha.trim() });
    } catch (e: any) {
      setErr(e?.message || "Falha ao redefinir");
    } finally {
      setSaving(false);
    }
  }

  return (
    <ModalShell T={T} title="REDEFINIR SENHA" onClose={onClose}>
      <p style={{ fontFamily: FONT_BODY, fontSize: 11, color: T.textMuted, marginBottom: 12 }}>
        {user.full_name || user.email} — <span style={{ fontFamily: "monospace" }}>{user.email}</span>
      </p>
      <ModalField T={T} label="NOVA SENHA">
        <input value={senha} onChange={(e) => setSenha(e.target.value)}
          type="text" autoComplete="off" autoFocus
          style={inputStyle(T)} placeholder="mínimo 6 caracteres" />
      </ModalField>
      {err && <p style={{ fontFamily: FONT_BODY, fontSize: 11, color: "#B0563C" }}>{err}</p>}
      <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
        <button onClick={onClose} style={secondaryBtnStyle(T)}>CANCELAR</button>
        <button onClick={handleSave} disabled={saving} style={primaryBtnStyle(T, saving)}>
          {saving ? "SALVANDO..." : "REDEFINIR"}
        </button>
      </div>
    </ModalShell>
  );
}

/* ─── Helpers de modal ─── */
function ModalShell({ T, title, onClose, children }: { T: ThemeTokens; title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 50,
      background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)",
      display: "flex", alignItems: "center", justifyContent: "center", padding: 16,
    }} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{
        background: T.bg, border: `1px solid ${T.border}`,
        maxWidth: 520, width: "100%", maxHeight: "90vh", overflowY: "auto",
        padding: 28, display: "flex", flexDirection: "column", gap: 14,
      }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
          <h3 style={{ fontFamily: FONT_DISPLAY, fontSize: 16, letterSpacing: "0.1em", margin: 0, color: T.textPrimary }}>{title}</h3>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: T.textSecondary, padding: 4 }}>
            <X size={16} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function ModalField({ T, label, children }: { T: ThemeTokens; label: string; children: React.ReactNode }) {
  return (
    <div>
      <label style={{
        display: "block", fontFamily: FONT_BODY, fontSize: 8,
        letterSpacing: "0.16em", color: T.textMuted, marginBottom: 6,
      }}>{label}</label>
      {children}
    </div>
  );
}

const inputStyle = (T: ThemeTokens): React.CSSProperties => ({
  width: "100%", background: T.statBg,
  border: `1px solid ${T.border}`, padding: "10px 12px",
  color: T.textPrimary, fontFamily: FONT_BODY, fontSize: 12,
  outline: "none", boxSizing: "border-box",
});

const primaryBtnStyle = (T: ThemeTokens, disabled: boolean): React.CSSProperties => ({
  flex: 2, padding: "10px", cursor: disabled ? "not-allowed" : "pointer",
  border: `1px solid ${T.borderHover}`, background: T.cardHover,
  color: T.textPrimary, fontFamily: FONT_BODY, fontSize: 10, letterSpacing: "0.14em",
  opacity: disabled ? 0.6 : 1,
});

const secondaryBtnStyle = (T: ThemeTokens): React.CSSProperties => ({
  flex: 1, padding: "10px", cursor: "pointer",
  border: `1px solid ${T.border}`, background: "none",
  color: T.textSecondary, fontFamily: FONT_BODY, fontSize: 10, letterSpacing: "0.14em",
});
