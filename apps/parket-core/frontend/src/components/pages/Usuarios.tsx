import { useMemo, useState } from "react";
import { Loader2, Settings, Pencil, Search, ShieldCheck, ShieldOff } from "lucide-react";
import { api, useFetch, type SpaceUser } from "../../lib/api";
import { fmtDate } from "../../lib/format";
import { Input } from "../ui/Form";
import { SpaceUserForm } from "../forms/SpaceUserForm";

const ROLE_COLOR: Record<string, { fg: string; bg: string }> = {
  superadmin: { fg: "#F87171", bg: "#3F1D1D" },
  admin: { fg: "#A78BFA", bg: "#2E1065" },
  dept_leader: { fg: "#60A5FA", bg: "#1E3A8A" },
  viewer: { fg: "#9CA3AF", bg: "#1F2937" },
  projetista: { fg: "#34D399", bg: "#022C22" },
  inactive: { fg: "#6B7280", bg: "#111827" },
};

export function UsuariosPage() {
  const us = useFetch(() => api.spaceUsers(), []);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<SpaceUser | null>(null);
  const [busca, setBusca] = useState("");
  const [filtroRole, setFiltroRole] = useState<string>("todos");
  const [mostrarInativos, setMostrarInativos] = useState(false);

  const lista = useMemo(() => {
    if (!us.data) return null;
    const q = busca.trim().toLowerCase();
    return us.data
      .filter((u) => {
        const inactive = (u.dept_permissions as any)?._inactive;
        if (inactive && !mostrarInativos) return false;
        if (filtroRole !== "todos" && u.role !== filtroRole) return false;
        if (q && !(u.full_name || "").toLowerCase().includes(q) && !u.email.toLowerCase().includes(q)) return false;
        return true;
      });
  }, [us.data, busca, filtroRole, mostrarInativos]);

  const stats = useMemo(() => {
    if (!us.data) return null;
    const ativos = us.data.filter((u) => !(u.dept_permissions as any)?._inactive);
    const byRole = new Map<string, number>();
    for (const u of ativos) byRole.set(u.role, (byRole.get(u.role) || 0) + 1);
    return {
      total: us.data.length,
      ativos: ativos.length,
      inativos: us.data.length - ativos.length,
      admins: (byRole.get("superadmin") || 0) + (byRole.get("admin") || 0),
    };
  }, [us.data]);

  if (us.loading) return <div className="p-8 flex items-center gap-2 text-xs text-parket-textDim"><Loader2 size={14} className="animate-spin"/> Carregando…</div>;
  if (us.error) return <div className="p-8 text-xs text-red-400">Erro: {us.error}</div>;
  if (!lista || !stats) return null;

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-xl font-bold flex items-center gap-2">
          <Settings size={18} className="text-parket-accent" /> Usuários do Space
        </h1>
        <p className="text-xs text-parket-textDim mt-1">
          Gerenciamento dos usuários da plataforma Space — roles, permissões por setor, ativação
        </p>
      </div>

      <div className="grid grid-cols-4 gap-4 mb-5">
        <Stat label="Total" value={String(stats.total)} />
        <Stat label="Ativos" value={String(stats.ativos)} accent />
        <Stat label="Admins" value={String(stats.admins)} />
        <Stat label="Desativados" value={String(stats.inativos)} />
      </div>

      <div className="flex items-center gap-2 mb-4 flex-wrap">
        <div className="relative flex-1 min-w-64">
          <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-parket-textDim" />
          <Input className="pl-7" placeholder="Buscar por nome ou email…" value={busca} onChange={(e) => setBusca(e.target.value)} />
        </div>
        {(["todos", ...Object.keys(ROLE_COLOR)] as string[]).map((r) => (
          <button
            key={r}
            onClick={() => setFiltroRole(r)}
            className={`px-2.5 py-1.5 rounded text-[11px] font-semibold transition ${
              filtroRole === r
                ? "bg-parket-accent text-parket-bg"
                : "bg-parket-panel border border-parket-border text-parket-textDim hover:text-parket-text"
            }`}
          >{r}</button>
        ))}
        <label className="flex items-center gap-1.5 text-xs cursor-pointer ml-2">
          <input type="checkbox" checked={mostrarInativos} onChange={(e) => setMostrarInativos(e.target.checked)} />
          Mostrar inativos
        </label>
      </div>

      <div className="bg-parket-panel border border-parket-border rounded-xl overflow-hidden">
        <table className="w-full text-xs">
          <thead className="bg-parket-panelLight">
            <tr>
              <Th>Usuário</Th>
              <Th>Email</Th>
              <Th>Role</Th>
              <Th>Permissões</Th>
              <Th>Atualizado</Th>
              <Th>Ações</Th>
            </tr>
          </thead>
          <tbody>
            {lista.map((u) => {
              const inactive = (u.dept_permissions as any)?._inactive;
              const c = inactive ? ROLE_COLOR.inactive : (ROLE_COLOR[u.role] || ROLE_COLOR.viewer);
              const dp = (u.dept_permissions || {}) as Record<string, any>;
              const depts = Object.entries(dp).filter(([k]) => !k.startsWith("_"));
              return (
                <tr
                  key={u.id}
                  onClick={() => { setEditing(u); setOpen(true); }}
                  className={`border-t border-parket-border cursor-pointer ${inactive ? "opacity-50" : "hover:bg-parket-panelLight"}`}
                >
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold"
                        style={{ background: u.avatar_color || "#374151", color: "#fff" }}
                      >
                        {(u.full_name || u.email).slice(0, 1).toUpperCase()}
                      </div>
                      <span className="font-medium">{u.full_name || "—"}</span>
                      {inactive && <ShieldOff size={11} className="text-parket-textDim" />}
                    </div>
                  </td>
                  <td className="px-3 py-2 text-parket-textDim">{u.email}</td>
                  <td className="px-3 py-2">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold" style={{ color: c.fg, background: c.bg }}>
                      {(u.role === "superadmin" || u.role === "admin") && !inactive && <ShieldCheck size={10} />}
                      {inactive ? "inactive" : u.role}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-[10px] text-parket-textDim max-w-md">
                    {depts.length === 0 ? "—" : depts.map(([d, v]) => (
                      <span key={d} className="inline-block px-1.5 py-0.5 rounded mr-1 mb-0.5" style={{ background: v === "manage" ? "#2E1065" : "#1F2937", color: v === "manage" ? "#A78BFA" : "#9CA3AF" }}>
                        {d}{v !== "manage" && v !== "view" ? `:${v}` : ""}{v === "manage" ? " ✎" : ""}
                      </span>
                    ))}
                  </td>
                  <td className="px-3 py-2 text-[10px] text-parket-textDim">{fmtDate(u.updated_at)}</td>
                  <td className="px-3 py-2">
                    <button onClick={(e) => { e.stopPropagation(); setEditing(u); setOpen(true); }} className="text-parket-textDim hover:text-parket-accent">
                      <Pencil size={12} />
                    </button>
                  </td>
                </tr>
              );
            })}
            {lista.length === 0 && (
              <tr><td colSpan={6} className="px-3 py-8 text-center text-parket-textDim">Nenhum usuário encontrado.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <SpaceUserForm
        open={open}
        onClose={() => { setOpen(false); setEditing(null); }}
        onSaved={() => us.reload()}
        initial={editing}
      />

      <p className="text-[10px] text-parket-textDim mt-4">
        ℹ Esta tela edita usuários do <strong>Space</strong> (Dashboard Parket). Cadastro de novos usuários
        ainda é feito via convite/signup tradicional — aqui você gerencia permissões e ativação.
      </p>
    </div>
  );
}

const Th = ({ children, className = "" }: { children: any; className?: string }) => (
  <th className={`text-left px-3 py-2 text-[10px] uppercase tracking-wider text-parket-textDim font-semibold ${className}`}>{children}</th>
);

const Stat = ({ label, value, accent }: { label: string; value: string; accent?: boolean }) => (
  <div className="bg-parket-panel border border-parket-border rounded-xl p-4">
    <div className="text-[10px] uppercase tracking-wider text-parket-textDim font-semibold mb-1">{label}</div>
    <div className={`text-xl font-bold ${accent ? "text-parket-accent" : ""}`}>{value}</div>
  </div>
);
