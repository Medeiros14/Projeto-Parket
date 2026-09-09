import { useMemo, useState } from "react";
import { Loader2, Plus, Search, X, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { useFetch, api } from "@/lib/api";
import { supabase } from "@/lib/supabase";
import { fmtDate } from "@/lib/format";

type AppUser = {
  id: string;
  user_id: string | null;
  email: string;
  nome: string | null;
  role: "admin" | "rh" | "gestor" | "colaborador";
  empresa_id: string | null;
  ativo: boolean;
  created_at: string;
};

const ROLES: AppUser["role"][] = ["admin", "rh", "gestor", "colaborador"];

async function fetchAppUsers(): Promise<AppUser[]> {
  const r = await supabase.from("app_users").select("*").order("created_at", { ascending: false });
  if (r.error) throw new Error(r.error.message);
  return (r.data || []) as AppUser[];
}

export function UsuariosPage() {
  const users = useFetch(() => fetchAppUsers(), []);
  const empresas = useFetch(() => api.empresas(), []);
  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState(false);

  const empresaMap = useMemo(() => {
    const m: Record<string, string> = {};
    (empresas.data || []).forEach((e) => { m[e.id] = e.nome_fantasia || e.razao_social; });
    return m;
  }, [empresas.data]);

  const lista = useMemo(() => {
    let arr = users.data || [];
    if (search) {
      const s = search.toLowerCase();
      arr = arr.filter((u) =>
        (u.nome || "").toLowerCase().includes(s) ||
        (u.email || "").toLowerCase().includes(s)
      );
    }
    return arr;
  }, [users.data, search]);

  const updateField = async (id: string, patch: Partial<AppUser>) => {
    const { error } = await supabase.from("app_users").update(patch).eq("id", id);
    if (error) {
      alert("Erro: " + error.message);
      return;
    }
    users.reload();
  };

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Usuários do Parket RH</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Quem tem acesso ao sistema. {users.data ? `${users.data.length} no total.` : ""}
          </p>
        </div>
        <Button onClick={() => setShowModal(true)}>
          <Plus size={14} /> Adicionar usuário
        </Button>
      </div>

      <div className="relative max-w-md">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Buscar por nome ou email…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {users.loading && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground p-12 justify-center">
          <Loader2 size={14} className="animate-spin" /> Carregando usuários…
        </div>
      )}
      {users.error && <Card className="p-4 text-sm text-red-400">Erro: {users.error}</Card>}

      {!users.loading && lista.length === 0 && (
        <Card className="p-12 text-center">
          <AlertCircle size={32} className="mx-auto text-muted-foreground mb-3" />
          <div className="font-semibold mb-1">Nenhum usuário encontrado</div>
          <div className="text-sm text-muted-foreground">
            {search ? "Tente outra busca." : "Adicione o primeiro usuário pra liberar acesso."}
          </div>
        </Card>
      )}

      {lista.length > 0 && (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-secondary/40 text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="text-left px-4 py-3 font-semibold">Nome / email</th>
                  <th className="text-left px-4 py-3 font-semibold">Papel</th>
                  <th className="text-left px-4 py-3 font-semibold">Empresa</th>
                  <th className="text-left px-4 py-3 font-semibold">Status</th>
                  <th className="text-left px-4 py-3 font-semibold">Criado em</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {lista.map((u) => (
                  <tr key={u.id} className="hover:bg-secondary/30">
                    <td className="px-4 py-3">
                      <div className="font-medium">{u.nome || <span className="text-muted-foreground">—</span>}</div>
                      <div className="text-xs text-muted-foreground">{u.email}</div>
                    </td>
                    <td className="px-4 py-3">
                      <select
                        value={u.role}
                        onChange={(e) => updateField(u.id, { role: e.target.value as AppUser["role"] })}
                        className="bg-input border border-border rounded-md text-xs px-2 py-1 outline-none focus:ring-2 focus:ring-ring"
                      >
                        {ROLES.map((r) => (
                          <option key={r} value={r}>{r}</option>
                        ))}
                      </select>
                      <RoleBadge role={u.role} className="ml-2" />
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {u.empresa_id ? (empresaMap[u.empresa_id] || "—") : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => updateField(u.id, { ativo: !u.ativo })}
                        className="cursor-pointer"
                        title="Clique pra alternar"
                      >
                        <Badge variant={u.ativo ? "success" : "outline"}>
                          {u.ativo ? "ativo" : "inativo"}
                        </Badge>
                      </button>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{fmtDate(u.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {showModal && (
        <NovoUsuarioModal
          empresas={empresas.data || []}
          onClose={() => setShowModal(false)}
          onSaved={() => {
            setShowModal(false);
            users.reload();
          }}
        />
      )}
    </div>
  );
}

function RoleBadge({ role, className }: { role: AppUser["role"]; className?: string }) {
  if (role === "admin") return <Badge variant="default" className={className}>admin</Badge>;
  if (role === "rh") return <Badge variant="secondary" className={className}>rh</Badge>;
  return <Badge variant="outline" className={className}>{role}</Badge>;
}

function NovoUsuarioModal({
  empresas,
  onClose,
  onSaved,
}: {
  empresas: { id: string; nome_fantasia: string | null; razao_social: string }[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [email, setEmail] = useState("");
  const [nome, setNome] = useState("");
  const [role, setRole] = useState<AppUser["role"]>("colaborador");
  const [empresaId, setEmpresaId] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    if (!email) {
      setErr("Email é obrigatório.");
      return;
    }
    setSaving(true);
    // Tenta achar user_id no auth (view opcional). Fallback: cria sem user_id, é preenchido no primeiro login.
    let userId: string | null = null;
    try {
      const r = await supabase.from("auth_users_view" as any).select("id").eq("email", email).maybeSingle();
      if (!r.error && r.data && (r.data as any).id) userId = (r.data as any).id;
    } catch {
      // view pode não existir — segue
    }

    const { error } = await supabase.from("app_users").insert({
      email,
      nome: nome || null,
      role,
      empresa_id: empresaId || null,
      user_id: userId,
      ativo: true,
    });
    setSaving(false);
    if (error) {
      setErr(error.message);
      return;
    }
    onSaved();
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <Card className="w-full max-w-md p-6" onClick={(ev) => ev.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <div className="text-base font-semibold">Adicionar usuário</div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X size={16} />
          </button>
        </div>
        <form onSubmit={submit} className="space-y-3">
          <Field label="Email">
            <Input
              type="email"
              placeholder="pessoa@parket.works"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </Field>
          <Field label="Nome (opcional)">
            <Input value={nome} onChange={(e) => setNome(e.target.value)} />
          </Field>
          <Field label="Papel">
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as AppUser["role"])}
              className="w-full h-9 bg-input border border-border rounded-md text-sm px-3 outline-none focus:ring-2 focus:ring-ring"
            >
              {ROLES.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </Field>
          <Field label="Empresa">
            <select
              value={empresaId}
              onChange={(e) => setEmpresaId(e.target.value)}
              className="w-full h-9 bg-input border border-border rounded-md text-sm px-3 outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="">— sem empresa —</option>
              {empresas.map((e) => (
                <option key={e.id} value={e.id}>{e.nome_fantasia || e.razao_social}</option>
              ))}
            </select>
          </Field>

          {err && <div className="text-xs text-red-400">{err}</div>}

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
              Cancelar
            </Button>
            <Button type="submit" disabled={saving}>
              {saving && <Loader2 size={12} className="animate-spin" />}
              Adicionar
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <div className="text-xs text-muted-foreground mb-1">{label}</div>
      {children}
    </label>
  );
}
