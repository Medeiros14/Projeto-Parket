/**
 * Gerenciador de Acessos — só admin/superadmin.
 *
 * Edita direto em `public.user_profiles` (via supabase/api.parket.works, RLS de admin):
 *   • Acesso: dept_permissions.operacional ("view" | "manage" | sem chave) —
 *     é a MESMA permissão do space.parket.works/operacional (fonte única).
 *   • Seções: dept_permissions.gestao_secoes (array; ausente = todas) —
 *     gate por seção só do gestão, não afeta o Space.
 *   • Ativo: user_profiles.ativo (GLOBAL — desativa o login em todos os apps Parket).
 */
import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";
import { GESTAO_SECOES, type AppRole } from "../lib/auth";
import { fonts, useTokens } from "../theme";

type Profile = {
  id: string;
  email: string;
  full_name: string | null;
  role: AppRole;
  ativo: boolean;
  dept_permissions: any;
};

type Nivel = "none" | "view" | "manage";

function parseDp(raw: any): Record<string, any> {
  let dp = raw || {};
  if (typeof dp === "string") { try { dp = JSON.parse(dp); } catch { dp = {}; } }
  if (Array.isArray(dp)) dp = typeof dp[1] === "object" && dp[1] ? dp[1] : {};
  return (dp && typeof dp === "object") ? { ...dp } : {};
}

function nivelDe(dp: Record<string, any>): Nivel {
  const raw = dp["operacional"];
  if (!raw) return "none";
  if (typeof raw === "string") {
    const l = raw.toLowerCase();
    return l === "manage" ? "manage" : (l === "view" || l === "edit" || l === "add") ? "view" : "none";
  }
  if (typeof raw === "object") {
    if (raw.manage === true) return "manage";
    if (raw.view === true || raw.edit === true || raw.add === true) return "view";
  }
  return "none";
}

export default function AdminAcessos() {
  const t = useTokens();
  const [users, setUsers] = useState<Profile[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [soComAcesso, setSoComAcesso] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [savedId, setSavedId] = useState<string | null>(null);

  const reload = async () => {
    setError(null);
    const { data, error: e } = await supabase
      .from("user_profiles")
      .select("id, email, full_name, role, ativo, dept_permissions")
      .order("full_name");
    if (e) { setError(e.message); return; }
    setUsers((data || []) as Profile[]);
  };
  useEffect(() => { reload(); }, []);

  const filtered = useMemo(() => {
    if (!users) return [];
    let arr = users;
    if (soComAcesso) {
      arr = arr.filter(u =>
        u.role === "admin" || u.role === "superadmin" || nivelDe(parseDp(u.dept_permissions)) !== "none");
    }
    const s = search.trim().toLowerCase();
    if (s) {
      arr = arr.filter(u =>
        (u.full_name || "").toLowerCase().includes(s) || u.email.toLowerCase().includes(s));
    }
    return arr;
  }, [users, search, soComAcesso]);

  const salvarDp = async (u: Profile, dp: Record<string, any>) => {
    setSavingId(u.id);
    setError(null);
    try {
      const r = await supabase.from("user_profiles").update({ dept_permissions: dp }).eq("id", u.id);
      if (r.error) throw r.error;
      setUsers(arr => arr ? arr.map(x => x.id === u.id ? { ...x, dept_permissions: dp } : x) : arr);
      setSavedId(u.id);
      setTimeout(() => setSavedId(cur => (cur === u.id ? null : cur)), 1200);
    } catch (e: any) {
      setError(e?.message || "Falha ao salvar.");
    } finally {
      setSavingId(null);
    }
  };

  const setNivel = (u: Profile, nivel: Nivel) => {
    const dp = parseDp(u.dept_permissions);
    if (nivel === "none") { delete dp["operacional"]; delete dp["gestao_secoes"]; }
    else dp["operacional"] = nivel;
    salvarDp(u, dp);
  };

  const toggleSecao = (u: Profile, key: string) => {
    const dp = parseDp(u.dept_permissions);
    const atual: string[] = Array.isArray(dp["gestao_secoes"])
      ? dp["gestao_secoes"].map(String)
      : GESTAO_SECOES.map(s => s.key); // ausente = todas
    const next = atual.includes(key) ? atual.filter(k => k !== key) : [...atual, key];
    if (next.length >= GESTAO_SECOES.length) delete dp["gestao_secoes"];
    else dp["gestao_secoes"] = next;
    salvarDp(u, dp);
  };

  const liberarTodas = (u: Profile) => {
    const dp = parseDp(u.dept_permissions);
    delete dp["gestao_secoes"];
    salvarDp(u, dp);
  };

  const toggleAtivo = async (u: Profile) => {
    const alvo = !u.ativo;
    if (!alvo && !window.confirm(
      `Desativar ${u.full_name || u.email}?\n\nIsso bloqueia o login em TODOS os apps Parket (Space, HB, Valoria, Gestão).`)) return;
    setSavingId(u.id);
    setError(null);
    try {
      const r = await supabase.from("user_profiles").update({ ativo: alvo }).eq("id", u.id);
      if (r.error) throw r.error;
      setUsers(arr => arr ? arr.map(x => x.id === u.id ? { ...x, ativo: alvo } : x) : arr);
    } catch (e: any) {
      setError(e?.message || "Falha ao salvar.");
    } finally {
      setSavingId(null);
    }
  };

  const th: React.CSSProperties = {
    padding: "8px 12px", textAlign: "left",
    fontFamily: fonts.cinzel, fontSize: 8, letterSpacing: "0.22em",
    color: t.textTertiary, textTransform: "uppercase",
    borderBottom: `1px solid ${t.border1}`, whiteSpace: "nowrap",
  };
  const td: React.CSSProperties = {
    padding: "9px 12px", fontSize: 12, borderBottom: `1px solid ${t.border1}`,
    verticalAlign: "middle",
  };
  const selectStyle: React.CSSProperties = {
    background: t.bg, color: t.textPrimary, border: `1px solid ${t.border1}`,
    fontFamily: fonts.inter, fontSize: 11, padding: "5px 8px", outline: "none",
    cursor: "pointer",
  };

  return (
    <div style={{ height: "100%", overflow: "auto", padding: "26px 30px", fontFamily: fonts.inter }}>
      <div style={{ marginBottom: 4, fontFamily: fonts.cinzel, fontSize: 15, letterSpacing: "0.18em" }}>
        GERENCIADOR DE ACESSOS
      </div>
      <div style={{ fontSize: 11, color: t.textTertiary, marginBottom: 18, lineHeight: 1.7, maxWidth: 720 }}>
        O nível de <b>Acesso</b> é a mesma permissão do setor Operacional do Space (fonte única) —
        mudar aqui muda lá também. As <b>Seções</b> valem só pro Gestão. Admin/superadmin entram
        sempre, com todas as seções.
      </div>

      <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 14 }}>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar nome ou email…"
          style={{
            width: 260, background: t.card1, border: `1px solid ${t.border1}`,
            color: t.textPrimary, padding: "8px 11px", fontSize: 12, outline: "none",
            fontFamily: fonts.inter,
          }} />
        <label style={{ fontSize: 11, color: t.textSecondary, display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
          <input type="checkbox" checked={soComAcesso} onChange={() => setSoComAcesso(v => !v)} />
          Só quem tem acesso
        </label>
        <div style={{ fontSize: 10, color: t.textTertiary }}>
          {users ? `${filtered.length} de ${users.length} usuários` : ""}
        </div>
      </div>

      {error && (
        <div style={{
          marginBottom: 12, padding: "8px 11px", fontSize: 12,
          color: "#c0605c", background: "rgba(192,96,92,0.10)", border: "1px solid rgba(192,96,92,0.35)",
        }}>{error}</div>
      )}

      {!users ? (
        <div style={{ padding: 40, color: t.textTertiary, fontSize: 12 }}>Carregando usuários…</div>
      ) : (
        <div style={{ background: t.card1, border: `1px solid ${t.border1}`, overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={th}>Usuário</th>
                <th style={th}>Role</th>
                <th style={th}>Acesso (Operacional)</th>
                <th style={th}>Seções do Gestão</th>
                <th style={th}>Ativo</th>
                <th style={th}></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(u => {
                const isAdminRow = u.role === "admin" || u.role === "superadmin";
                const dp = parseDp(u.dept_permissions);
                const nivel = nivelDe(dp);
                const temAcesso = isAdminRow || nivel !== "none";
                const secoes: string[] = Array.isArray(dp["gestao_secoes"])
                  ? dp["gestao_secoes"].map(String) : GESTAO_SECOES.map(s => s.key);
                const busy = savingId === u.id;
                return (
                  <tr key={u.id} style={{ opacity: u.ativo === false ? 0.45 : busy ? 0.6 : 1 }}>
                    <td style={td}>
                      <div style={{ color: t.textPrimary }}>{u.full_name || "—"}</div>
                      <div style={{ fontSize: 10, color: t.textTertiary }}>{u.email}</div>
                    </td>
                    <td style={{ ...td, fontSize: 10, color: isAdminRow ? t.accent : t.textSecondary, textTransform: "uppercase", letterSpacing: "0.12em" }}>
                      {u.role}
                    </td>
                    <td style={td}>
                      {isAdminRow ? (
                        <span style={{ fontSize: 10, color: t.accent, letterSpacing: "0.12em", textTransform: "uppercase" }}>Sempre</span>
                      ) : (
                        <select value={nivel} disabled={busy} style={selectStyle}
                          onChange={e => setNivel(u, e.target.value as Nivel)}>
                          <option value="none">Sem acesso</option>
                          <option value="view">Acesso (view)</option>
                          <option value="manage">Gestor (manage)</option>
                        </select>
                      )}
                    </td>
                    <td style={{ ...td, minWidth: 340 }}>
                      {isAdminRow ? (
                        <span style={{ fontSize: 10, color: t.textTertiary }}>Todas</span>
                      ) : !temAcesso ? (
                        <span style={{ fontSize: 10, color: t.textTertiary }}>—</span>
                      ) : (
                        <div style={{ display: "flex", flexWrap: "wrap", gap: "4px 12px", alignItems: "center" }}>
                          {GESTAO_SECOES.map(s => (
                            <label key={s.key} style={{
                              fontSize: 10.5, color: secoes.includes(s.key) ? t.textPrimary : t.textTertiary,
                              display: "flex", alignItems: "center", gap: 4, cursor: "pointer", whiteSpace: "nowrap",
                            }}>
                              <input type="checkbox" disabled={busy}
                                checked={secoes.includes(s.key)}
                                onChange={() => toggleSecao(u, s.key)} />
                              {s.label}
                            </label>
                          ))}
                          {Array.isArray(dp["gestao_secoes"]) && (
                            <button onClick={() => liberarTodas(u)} disabled={busy} style={{
                              background: "none", border: "none", cursor: "pointer", padding: 0,
                              fontSize: 10, color: t.accent, textDecoration: "underline",
                            }}>
                              todas
                            </button>
                          )}
                        </div>
                      )}
                    </td>
                    <td style={td}>
                      <button onClick={() => toggleAtivo(u)} disabled={busy} title="Ativo em TODOS os apps Parket"
                        style={{
                          ...selectStyle,
                          color: u.ativo === false ? "#c0605c" : "#5f9e6e",
                          borderColor: u.ativo === false ? "rgba(192,96,92,0.4)" : "rgba(95,158,110,0.4)",
                        }}>
                        {u.ativo === false ? "Inativo" : "Ativo"}
                      </button>
                    </td>
                    <td style={{ ...td, fontSize: 10, color: t.accent, whiteSpace: "nowrap" }}>
                      {savedId === u.id ? "salvo ✓" : busy ? "salvando…" : ""}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
