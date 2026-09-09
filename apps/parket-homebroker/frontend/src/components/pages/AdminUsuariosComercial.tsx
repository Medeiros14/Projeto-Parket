/**
 * AdminUsuariosComercial — área de gestão dos usuários do setor comercial.
 * Só admin/superadmin acessa.
 *
 * Mostra 2 tabs: SDR | Vendedor.
 * Por usuário: editar `username`, `funcao_comercial`, `ativo`, role.
 * Lê/escreve via supabase no `user_profiles` — RLS já garante que só admin
 * faz update/select-all (vide migration).
 */
import { useEffect, useMemo, useState } from "react";
import { Loader2, Save, Search, ShieldCheck, User, UserCheck, UserX, AlertCircle, CheckCircle2, UserPlus, X, Copy, Mail, Calculator } from "lucide-react";
import { supabase } from "../../lib/supabase";
import { api, type OrcamentistaEquipe } from "../../lib/api";
import type { AppUser, AppRole, FuncaoComercial } from "../../lib/auth";

type Profile = {
  id: string;
  email: string;
  full_name: string | null;
  role: AppRole;
  username: string | null;
  funcao_comercial: FuncaoComercial;
  ativo: boolean;
  avatar_color: string | null;
  orcamentista_padrao_id: string | null;
};

export function AdminUsuariosComercialPage({ appUser }: { appUser: AppUser }) {
  const isAdmin = appUser.role === "admin" || appUser.role === "superadmin";

  const [users, setUsers] = useState<Profile[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<"sdr" | "vendedor">("sdr");
  const [search, setSearch] = useState("");
  const [savingId, setSavingId] = useState<string | null>(null);
  const [savedId, setSavedId] = useState<string | null>(null);
  const [novoUserOpen, setNovoUserOpen] = useState(false);
  const [equipeOrc, setEquipeOrc] = useState<OrcamentistaEquipe[]>([]);

  const reload = async () => {
    setLoading(true);
    setError(null);
    try {
      const [usersRes, eq] = await Promise.all([
        // Admin RLS: vê todos. Filtra no client por funcao_comercial.
        supabase.from("user_profiles")
          .select("id, email, full_name, role, username, funcao_comercial, ativo, avatar_color, orcamentista_padrao_id")
          .order("full_name"),
        api.equipeOrcamento(),
      ]);
      if (usersRes.error) throw usersRes.error;
      setUsers((usersRes.data || []) as Profile[]);
      setEquipeOrc(eq);
    } catch (e: any) {
      setError(e?.message || "Falha ao carregar usuários.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { reload(); }, []);

  const filtered = useMemo(() => {
    if (!users) return [];
    const want = tab; // 'sdr' | 'vendedor'
    let arr = users.filter((u) =>
      u.funcao_comercial === want || u.funcao_comercial === "ambos"
    );
    if (search.trim()) {
      const s = search.trim().toLowerCase();
      arr = arr.filter((u) =>
        (u.full_name || "").toLowerCase().includes(s) ||
        u.email.toLowerCase().includes(s) ||
        (u.username || "").toLowerCase().includes(s)
      );
    }
    return arr;
  }, [users, tab, search]);

  const counts = useMemo(() => {
    if (!users) return { sdr: 0, vendedor: 0, ambos: 0, inativos: 0 };
    return {
      sdr: users.filter((u) => u.funcao_comercial === "sdr").length,
      vendedor: users.filter((u) => u.funcao_comercial === "vendedor").length,
      ambos: users.filter((u) => u.funcao_comercial === "ambos").length,
      inativos: users.filter((u) => !u.ativo).length,
    };
  }, [users]);

  const updateProfile = async (id: string, patch: Partial<Profile>) => {
    setSavingId(id);
    setError(null);
    try {
      const r = await supabase.from("user_profiles").update(patch).eq("id", id);
      if (r.error) throw r.error;
      setUsers((arr) => (arr ? arr.map((u) => (u.id === id ? { ...u, ...patch } : u)) : arr));
      setSavedId(id);
      setTimeout(() => setSavedId((cur) => (cur === id ? null : cur)), 1200);
    } catch (e: any) {
      setError(e?.message || "Falha ao salvar.");
    } finally {
      setSavingId(null);
    }
  };

  if (!isAdmin) {
    return (
      <div className="p-12 text-center text-hb-textDim text-sm">
        <ShieldCheck size={32} className="mx-auto mb-3 opacity-40" />
        Esta área é restrita a administradores.
      </div>
    );
  }

  if (loading) return (
    <div className="p-12 flex items-center justify-center text-hb-textDim text-sm">
      <Loader2 size={16} className="animate-spin mr-2" /> Carregando usuários…
    </div>
  );

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="border-b border-hb-border bg-hb-panel px-5 py-3 sticky top-0 z-20">
        <div className="flex items-center justify-between gap-2 mb-2">
          <div className="flex items-center gap-2 min-w-0">
            <span className="block w-[3px] h-[14px] bg-hb-accent shrink-0" />
            <h1 className="text-[12px] font-display uppercase text-hb-text" style={{ letterSpacing: "0.22em" }}>
              Usuários Comercial
            </h1>
            <span className="text-[9px] text-hb-textDim uppercase ml-2 shrink-0" style={{ letterSpacing: "0.14em" }}>
              · Gestão de SDRs e Vendedores
            </span>
          </div>
          <button
            onClick={() => setNovoUserOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[10px] uppercase bg-hb-accent text-hb-bg hover:opacity-90 transition shrink-0"
            style={{ letterSpacing: "0.16em", fontWeight: 600 }}
            title="Criar novo usuário SDR ou Vendedor"
          >
            <UserPlus size={11} /> Adicionar Usuário
          </button>
        </div>

        {/* Stats */}
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <Stat label="SDRs" value={counts.sdr} />
          <Stat label="Vendedores" value={counts.vendedor} />
          <Stat label="SDR + Vendedor" value={counts.ambos} highlight />
          {counts.inativos > 0 && <Stat label="Inativos" value={counts.inativos} warn />}
        </div>

        {/* Tabs + busca */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex border border-hb-border">
            <TabBtn active={tab === "sdr"} onClick={() => setTab("sdr")} label={`SDR (${counts.sdr + counts.ambos})`} />
            <TabBtn active={tab === "vendedor"} onClick={() => setTab("vendedor")} label={`Vendedor (${counts.vendedor + counts.ambos})`} divider />
          </div>
          <div className="relative max-w-md flex-1 min-w-[180px]">
            <Search size={11} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-hb-textDim" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar nome, e-mail, username…"
              className="w-full bg-hb-bg border border-hb-border pl-7 pr-3 py-1.5 text-xs outline-none focus:border-hb-accent"
            />
          </div>
        </div>
        {error && (
          <div className="mt-2 text-[10px] text-hb-red inline-flex items-center gap-1">
            <AlertCircle size={10} /> {error}
          </div>
        )}
      </div>

      {/* Lista */}
      <div className="flex-1 overflow-auto">
        <table className="w-full text-xs">
          <thead className="bg-hb-panelLight border-b border-hb-border sticky top-0 z-10">
            <tr className="text-[9px] uppercase text-hb-textDim" style={{ letterSpacing: "0.14em" }}>
              <th className="text-left px-3 py-2 font-semibold">Nome</th>
              <th className="text-left px-3 py-2 font-semibold">E-mail</th>
              <th className="text-left px-3 py-2 font-semibold">Username</th>
              <th className="text-left px-3 py-2 font-semibold">Função</th>
              <th className="text-left px-3 py-2 font-semibold">
                <span className="inline-flex items-center gap-1"><Calculator size={9} /> Orçamentista padrão</span>
              </th>
              <th className="text-left px-3 py-2 font-semibold">Papel</th>
              <th className="text-left px-3 py-2 font-semibold">Status</th>
              <th className="text-right px-3 py-2 font-semibold">Salvar</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr><td colSpan={8} className="text-center py-12 text-hb-textDim text-[11px]">
                Nenhum {tab === "sdr" ? "SDR" : "vendedor"} encontrado nessa filtragem.
              </td></tr>
            )}
            {filtered.map((u) => (
              <UserRow
                key={u.id}
                u={u}
                equipeOrc={equipeOrc}
                onUpdate={(patch) => updateProfile(u.id, patch)}
                saving={savingId === u.id}
                saved={savedId === u.id}
              />
            ))}
          </tbody>
        </table>

      </div>

      {/* Modal Adicionar Usuário */}
      {novoUserOpen && (
        <NovoUsuarioModal
          onClose={() => setNovoUserOpen(false)}
          onCreated={() => { setNovoUserOpen(false); reload(); }}
        />
      )}
    </div>
  );
}

/* ───────────────────────── MODAL: Adicionar Usuário ───────────────────────── */
function NovoUsuarioModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [email, setEmail] = useState("");
  const [nome, setNome] = useState("");
  const [username, setUsername] = useState("");
  const [funcao, setFuncao] = useState<FuncaoComercial>("vendedor");
  const [role, setRole] = useState<AppRole>("dept_leader");
  const [perm, setPerm] = useState<"view"|"edit"|"add"|"manage">("edit");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [okPassword, setOkPassword] = useState<string | null>(null);
  const [okEmail, setOkEmail] = useState<string | null>(null);

  // Auto-sugere username quando muda o e-mail (se ainda não foi editado manualmente)
  const onEmailBlur = () => {
    if (!username.trim() && email.includes("@")) {
      setUsername(email.split("@")[0].toLowerCase().replace(/[^a-z0-9]+/g, "-"));
    }
    if (!nome.trim() && email.includes("@")) {
      const prefix = email.split("@")[0];
      setNome(prefix.charAt(0).toUpperCase() + prefix.slice(1));
    }
  };

  const podeSalvar = email.includes("@") && nome.trim().length > 1 && username.trim().length > 1 && !saving;

  const salvar = async () => {
    if (!podeSalvar) return;
    setSaving(true);
    setError(null);
    try {
      // 1) Gera senha temporária forte
      const tempPass = gerarSenha(12);

      // 2) Cria auth.user via /auth/v1/signup direto (não afeta a sessão admin).
      //    O trigger `handle_new_user` cria user_profiles automaticamente
      //    usando full_name/role/dept_permissions de raw_user_meta_data.
      const supabaseUrl = (import.meta as any).env?.VITE_SUPABASE_URL || "https://api.parket.works";
      const anonKey = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY ||
        "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhieHBpbHJ4bWl0dnplYmx1b29tIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI5NDI1MjcsImV4cCI6MjA4ODUxODUyN30.ciZA1H-UvlYG2OPWqrFChj-_ttiFD5W5BmrST-gUJ-0";

      const signupRes = await fetch(`${supabaseUrl}/auth/v1/signup`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "apikey": anonKey,
        },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          password: tempPass,
          data: {
            full_name: nome.trim(),
            role,
            dept_permissions: { comercial: perm },
          },
        }),
      });
      const signupBody = await signupRes.json().catch(() => ({}));
      if (!signupRes.ok) {
        throw new Error(signupBody?.msg || signupBody?.error_description || signupBody?.message || `Erro ${signupRes.status}`);
      }

      // 3) Pequena pausa pro trigger handle_new_user criar user_profiles
      await new Promise((r) => setTimeout(r, 600));

      // 4) UPDATE em user_profiles pra setar username + funcao + ativo (campos que o trigger não preenche)
      const upd = await supabase.from("user_profiles")
        .update({
          username: username.trim().toLowerCase(),
          funcao_comercial: funcao,
          ativo: true,
        })
        .eq("email", email.trim().toLowerCase());
      if (upd.error) throw upd.error;

      setOkPassword(tempPass);
      setOkEmail(email.trim().toLowerCase());
    } catch (e: any) {
      setError(e?.message || "Falha ao criar usuário.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4" onMouseDown={onClose}>
      <div className="bg-hb-panel border border-hb-border w-full max-w-lg max-h-[92vh] flex flex-col" onMouseDown={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-3 border-b border-hb-border">
          <div className="flex items-center gap-2">
            <span className="block w-[3px] h-[14px] bg-hb-accent" />
            <h2 className="text-[11px] font-display uppercase text-hb-text" style={{ letterSpacing: "0.22em" }}>
              Adicionar Usuário
            </h2>
          </div>
          <button onClick={onClose} className="p-1 text-hb-textDim hover:text-hb-text"><X size={14} /></button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
          {okPassword ? (
            <SuccessPanel email={okEmail!} password={okPassword} onDone={onCreated} />
          ) : (
            <>
              <Field label="E-mail *">
                <input
                  type="email" inputMode="email" autoFocus
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onBlur={onEmailBlur}
                  placeholder="usuario@parket.com.br"
                  className="hb-input"
                />
              </Field>
              <Field label="Nome completo *">
                <input
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  placeholder="Ex.: Raphael Camargo"
                  className="hb-input"
                />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Username *">
                  <input
                    value={username}
                    onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9\-]/g, "-"))}
                    placeholder="raphael"
                    className="hb-input font-mono"
                  />
                </Field>
                <Field label="Função">
                  <select
                    value={funcao || ""}
                    onChange={(e) => setFuncao((e.target.value || null) as FuncaoComercial)}
                    className="hb-input"
                  >
                    <option value="vendedor">Vendedor</option>
                    <option value="sdr">SDR</option>
                    <option value="ambos">SDR + Vendedor</option>
                  </select>
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Papel (role)">
                  <select value={role} onChange={(e) => setRole(e.target.value as AppRole)} className="hb-input">
                    <option value="dept_leader">dept_leader</option>
                    <option value="viewer">viewer</option>
                    <option value="admin">admin</option>
                    <option value="superadmin">superadmin</option>
                  </select>
                </Field>
                <Field label="Permissão Comercial">
                  <select value={perm} onChange={(e) => setPerm(e.target.value as any)} className="hb-input">
                    <option value="view">view</option>
                    <option value="edit">edit</option>
                    <option value="add">add</option>
                    <option value="manage">manage</option>
                  </select>
                </Field>
              </div>

              <div className="text-[10px] text-hb-textDim leading-relaxed" style={{ letterSpacing: "0.04em" }}>
                Será gerada uma <b>senha temporária</b> que aparecerá após salvar — compartilhe com a pessoa. Ela pode trocar pelo "Esqueci minha senha" no login.
              </div>

              {error && (
                <div className="text-[10px] text-hb-red inline-flex items-center gap-1">
                  <AlertCircle size={10} /> {error}
                </div>
              )}
            </>
          )}
        </div>

        {!okPassword && (
          <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-hb-border bg-hb-panelLight/40">
            <button
              onClick={onClose}
              className="px-3 py-1.5 text-[10px] uppercase border border-hb-border text-hb-textDim hover:text-hb-text transition"
              style={{ letterSpacing: "0.14em" }}
            >Cancelar</button>
            <button
              onClick={salvar}
              disabled={!podeSalvar}
              className="px-4 py-1.5 text-[10px] uppercase bg-hb-accent text-hb-bg disabled:opacity-40 disabled:cursor-not-allowed inline-flex items-center gap-1.5 transition"
              style={{ letterSpacing: "0.14em", fontWeight: 600 }}
            >
              {saving ? <Loader2 size={10} className="animate-spin" /> : <UserPlus size={10} />}
              {saving ? "Criando" : "Criar Usuário"}
            </button>
          </div>
        )}
      </div>

      <style>{`
        .hb-input {
          width: 100%;
          background: rgb(var(--hb-bg) / 1);
          border: 1px solid rgb(var(--hb-border) / 1);
          padding: 6px 9px;
          font-size: 11px;
          color: rgb(var(--hb-text) / 1);
          outline: none;
          transition: border-color .15s;
        }
        .hb-input::placeholder { color: rgb(var(--hb-textDim) / 0.7); }
        .hb-input:focus { border-color: rgb(var(--hb-accent) / 1); }
      `}</style>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <div className="text-[9px] uppercase text-hb-textDim mb-1" style={{ letterSpacing: "0.14em" }}>{label}</div>
      {children}
    </label>
  );
}

function SuccessPanel({ email, password, onDone }: { email: string; password: string; onDone: () => void }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(`E-mail: ${email}\nSenha temporária: ${password}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {}
  };
  return (
    <div className="space-y-3">
      <div className="inline-flex items-center gap-1.5 text-[11px] text-hb-green font-semibold" style={{ letterSpacing: "0.08em" }}>
        <CheckCircle2 size={12} /> Usuário criado · sincronizado em todo o ecossistema Parket
      </div>
      <div className="border border-hb-border bg-hb-bg p-3 space-y-2">
        <div>
          <div className="text-[9px] uppercase text-hb-textDim mb-0.5" style={{ letterSpacing: "0.14em" }}>E-mail</div>
          <div className="text-[12px] font-mono text-hb-text inline-flex items-center gap-1.5">
            <Mail size={10} className="text-hb-textDim" /> {email}
          </div>
        </div>
        <div>
          <div className="text-[9px] uppercase text-hb-textDim mb-0.5" style={{ letterSpacing: "0.14em" }}>Senha temporária</div>
          <div className="text-[12px] font-mono text-hb-accent select-all">{password}</div>
        </div>
        <button
          onClick={copy}
          className="inline-flex items-center gap-1 px-2 py-1 text-[9px] uppercase border border-hb-border text-hb-textDim hover:text-hb-accent hover:border-hb-accent/60 transition"
          style={{ letterSpacing: "0.14em" }}
        >
          <Copy size={9} /> {copied ? "Copiado!" : "Copiar credenciais"}
        </button>
      </div>
      <p className="text-[10px] text-hb-textDim leading-relaxed" style={{ letterSpacing: "0.04em" }}>
        Envie pra pessoa via WhatsApp. Ela faz login com essa senha e pode trocar depois em <b>"Esqueci minha senha"</b>.
      </p>
      <div className="flex justify-end">
        <button
          onClick={onDone}
          className="px-3 py-1.5 text-[10px] uppercase bg-hb-accent text-hb-bg hover:opacity-90 transition"
          style={{ letterSpacing: "0.14em", fontWeight: 600 }}
        >Fechar</button>
      </div>
    </div>
  );
}

function gerarSenha(n: number): string {
  // Pool sem chars ambíguos (0/O/l/I/1) pra facilitar leitura/digitação manual.
  const chars = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const arr = new Uint32Array(n);
  crypto.getRandomValues(arr);
  return Array.from(arr, (v) => chars[v % chars.length]).join("");
}

function UserRow({ u, equipeOrc, onUpdate, saving, saved }: {
  u: Profile;
  equipeOrc: OrcamentistaEquipe[];
  onUpdate: (patch: Partial<Profile>) => void;
  saving: boolean;
  saved: boolean;
}) {
  const [username, setUsername] = useState(u.username || "");
  const [funcao, setFuncao] = useState<FuncaoComercial>(u.funcao_comercial);
  const [role, setRole] = useState<AppRole>(u.role);
  const [ativo, setAtivo] = useState(u.ativo);
  const [orcPadrao, setOrcPadrao] = useState<string>(u.orcamentista_padrao_id || "");

  useEffect(() => {
    setUsername(u.username || "");
    setFuncao(u.funcao_comercial);
    setRole(u.role);
    setAtivo(u.ativo);
    setOrcPadrao(u.orcamentista_padrao_id || "");
  }, [u.id, u.username, u.funcao_comercial, u.role, u.ativo, u.orcamentista_padrao_id]);

  const dirty = username !== (u.username || "") || funcao !== u.funcao_comercial
    || role !== u.role || ativo !== u.ativo
    || orcPadrao !== (u.orcamentista_padrao_id || "");

  const handleSave = () => {
    if (!dirty || saving) return;
    onUpdate({
      username: username.trim() || null,
      funcao_comercial: funcao,
      role,
      ativo,
      orcamentista_padrao_id: orcPadrao || null,
    } as any);
  };

  return (
    <tr className={`border-b border-hb-border hover:bg-hb-panelLight/40 ${!u.ativo ? "opacity-60" : ""}`}>
      <td className="px-3 py-2">
        <div className="flex items-center gap-2">
          <span
            className="inline-flex items-center justify-center w-6 h-6 rounded-full text-[9px] font-bold text-hb-bg"
            style={{ background: u.avatar_color || "#968473" }}
          >
            {(u.full_name || u.email)[0]?.toUpperCase()}
          </span>
          <span className="text-hb-text">{u.full_name || "—"}</span>
        </div>
      </td>
      <td className="px-3 py-2 text-hb-textDim text-[11px]">{u.email}</td>
      <td className="px-3 py-2">
        <input
          value={username}
          onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9\-]/g, "-"))}
          placeholder="username"
          className="w-32 bg-hb-bg border border-hb-border px-2 py-1 text-xs outline-none focus:border-hb-accent font-mono"
        />
      </td>
      <td className="px-3 py-2">
        <select
          value={funcao || ""}
          onChange={(e) => setFuncao((e.target.value || null) as FuncaoComercial)}
          className="bg-hb-bg border border-hb-border px-2 py-1 text-xs outline-none focus:border-hb-accent"
        >
          <option value="">— sem função —</option>
          <option value="sdr">SDR</option>
          <option value="vendedor">Vendedor</option>
          <option value="ambos">SDR + Vendedor</option>
        </select>
      </td>
      <td className="px-3 py-2">
        {/* Orçamentista padrão — quando o vendedor clica "Solicitar Orçamento"
            no card, o orçamentista escolhido aqui é pré-selecionado no modal.
            Só faz sentido pra quem é vendedor ou ambos. */}
        {(funcao === "vendedor" || funcao === "ambos") ? (
          <select
            value={orcPadrao}
            onChange={(e) => setOrcPadrao(e.target.value)}
            className="bg-hb-bg border border-hb-border px-2 py-1 text-xs outline-none focus:border-hb-accent max-w-[160px]"
          >
            <option value="">— nenhum —</option>
            {equipeOrc.map((o) => (
              <option key={o.id} value={o.id}>{o.nome}{o.is_gestor ? " · gestor" : ""}</option>
            ))}
          </select>
        ) : (
          <span className="text-[10px] text-hb-textDim opacity-60">—</span>
        )}
      </td>
      <td className="px-3 py-2">
        <select
          value={role}
          onChange={(e) => setRole(e.target.value as AppRole)}
          className="bg-hb-bg border border-hb-border px-2 py-1 text-xs outline-none focus:border-hb-accent"
        >
          <option value="viewer">viewer</option>
          <option value="dept_leader">dept_leader</option>
          <option value="admin">admin</option>
          <option value="superadmin">superadmin</option>
        </select>
      </td>
      <td className="px-3 py-2">
        <button
          onClick={() => setAtivo(!ativo)}
          className={`inline-flex items-center gap-1 px-2 py-1 text-[9px] uppercase border ${
            ativo
              ? "border-hb-green/40 text-hb-green bg-hb-green/10"
              : "border-hb-red/40 text-hb-red bg-hb-red/10"
          }`}
          style={{ letterSpacing: "0.14em" }}
        >
          {ativo ? <><UserCheck size={9} /> Ativo</> : <><UserX size={9} /> Inativo</>}
        </button>
      </td>
      <td className="px-3 py-2 text-right">
        <button
          onClick={handleSave}
          disabled={!dirty || saving}
          className={`inline-flex items-center gap-1 px-2 py-1 text-[9px] uppercase border transition ${
            dirty
              ? "bg-hb-accent text-hb-bg border-hb-accent hover:opacity-90"
              : "border-hb-border text-hb-textDim cursor-default opacity-40"
          }`}
          style={{ letterSpacing: "0.14em", fontWeight: 600 }}
        >
          {saving ? <Loader2 size={9} className="animate-spin" /> : saved ? <CheckCircle2 size={9} /> : <Save size={9} />}
          {saved ? "Salvo" : "Salvar"}
        </button>
      </td>
    </tr>
  );
}

function Stat({ label, value, highlight, warn }: { label: string; value: number; highlight?: boolean; warn?: boolean }) {
  const color = warn ? "text-hb-amber border-hb-amber/40" : highlight ? "text-hb-accent border-hb-accent/40" : "text-hb-textDim border-hb-border";
  return (
    <div className={`px-2 py-1 border ${color} text-[9px] uppercase inline-flex items-center gap-1.5`} style={{ letterSpacing: "0.14em" }}>
      <span className="font-display text-[11px]">{value}</span>
      <span className="opacity-80">{label}</span>
    </div>
  );
}

function TabBtn({ active, onClick, label, divider }: { active: boolean; onClick: () => void; label: string; divider?: boolean }) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1 text-[10px] uppercase transition ${divider ? "border-l border-hb-border" : ""} ${
        active ? "bg-hb-accent/15 text-hb-accent" : "text-hb-textDim hover:text-hb-text"
      }`}
      style={{ letterSpacing: "0.18em", fontWeight: 600 }}
    >
      {label}
    </button>
  );
}
