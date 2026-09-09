import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Building2, Loader2, Plus, Pencil, Users as UsersIcon, X, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { useFetch, api } from "@/lib/api";
import { supabaseCore } from "@/lib/supabase";

function formatCNPJ(s: string) {
  const d = s.replace(/\D/g, "").slice(0, 14);
  if (d.length <= 2) return d;
  if (d.length <= 5) return `${d.slice(0, 2)}.${d.slice(2)}`;
  if (d.length <= 8) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5)}`;
  if (d.length <= 12) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8)}`;
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
}

export function EmpresasPage() {
  const empresas = useFetch(() => api.empresas(), []);
  const colabs = useFetch(() => api.colaboradores(), []);
  const [showModal, setShowModal] = useState(false);

  const stats = useMemo(() => {
    const arr = empresas.data || [];
    return {
      total: arr.length,
      ativas: arr.filter((e) => e.ativo).length,
      colaboradores: (colabs.data || []).length,
    };
  }, [empresas.data, colabs.data]);

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Empresas</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Grupo Parket — uma empresa por CNPJ.
          </p>
        </div>
        <Button onClick={() => setShowModal(true)}>
          <Plus size={14} /> Nova empresa
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <KPI label="Total de empresas" value={stats.total} icon={Building2} />
        <KPI label="Ativas" value={stats.ativas} icon={Building2} accent="success" />
        <KPI label="Colaboradores (todas as empresas)" value={stats.colaboradores} icon={UsersIcon} />
      </div>

      {empresas.loading && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground p-12 justify-center">
          <Loader2 size={14} className="animate-spin" /> Carregando empresas…
        </div>
      )}
      {empresas.error && <Card className="p-4 text-sm text-red-400">Erro: {empresas.error}</Card>}

      {!empresas.loading && (empresas.data || []).length === 0 && (
        <Card className="p-12 text-center">
          <AlertCircle size={32} className="mx-auto text-muted-foreground mb-3" />
          <div className="font-semibold mb-1">Nenhuma empresa cadastrada</div>
          <div className="text-sm text-muted-foreground">
            Comece adicionando o CNPJ principal do grupo.
          </div>
        </Card>
      )}

      {(empresas.data || []).length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {empresas.data!.map((e) => (
            <Card key={e.id} className="p-5 flex flex-col gap-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="text-base font-semibold truncate">
                    {e.nome_fantasia || e.razao_social}
                  </div>
                  {e.nome_fantasia && (
                    <div className="text-xs text-muted-foreground truncate">{e.razao_social}</div>
                  )}
                </div>
                <Badge variant={e.ativo ? "success" : "outline"}>
                  {e.ativo ? "ativo" : "inativo"}
                </Badge>
              </div>

              <div className="space-y-1 text-sm">
                <div className="font-mono text-xs text-muted-foreground">{e.cnpj}</div>
                <div className="text-muted-foreground text-xs">
                  {e.cidade && e.uf ? `${e.cidade} / ${e.uf}` : "—"}
                </div>
              </div>

              <div className="flex gap-2 mt-auto pt-2 border-t border-border">
                <Button variant="outline" size="sm" className="flex-1" disabled title="Em breve">
                  <Pencil size={12} /> Editar
                </Button>
                <Link to={`/colaboradores?empresa=${e.id}`} className="flex-1">
                  <Button variant="secondary" size="sm" className="w-full">
                    <UsersIcon size={12} /> Colaboradores
                  </Button>
                </Link>
              </div>
            </Card>
          ))}
        </div>
      )}

      {showModal && (
        <NovaEmpresaModal
          onClose={() => setShowModal(false)}
          onSaved={() => {
            setShowModal(false);
            empresas.reload();
          }}
        />
      )}
    </div>
  );
}

function KPI({ label, value, icon: Icon, accent }: { label: string; value: number; icon: any; accent?: "success" }) {
  return (
    <Card className="p-5">
      <div className="flex items-start justify-between">
        <div>
          <div className="text-xs text-muted-foreground uppercase tracking-wider">{label}</div>
          <div className="text-2xl font-bold mt-1">{value}</div>
        </div>
        <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${accent === "success" ? "bg-green-500/15 text-green-400" : "bg-primary/10 text-primary"}`}>
          <Icon size={16} />
        </div>
      </div>
    </Card>
  );
}

function NovaEmpresaModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [cnpj, setCnpj] = useState("");
  const [razaoSocial, setRazaoSocial] = useState("");
  const [nomeFantasia, setNomeFantasia] = useState("");
  const [cidade, setCidade] = useState("");
  const [uf, setUf] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    if (!cnpj || !razaoSocial) {
      setErr("CNPJ e razão social são obrigatórios.");
      return;
    }
    setSaving(true);
    const { error } = await supabaseCore.from("empresas").insert({
      cnpj: cnpj.replace(/\D/g, ""),
      razao_social: razaoSocial,
      nome_fantasia: nomeFantasia || null,
      cidade: cidade || null,
      uf: uf ? uf.toUpperCase() : null,
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
          <div className="text-base font-semibold">Nova empresa</div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X size={16} />
          </button>
        </div>
        <form onSubmit={submit} className="space-y-3">
          <Field label="CNPJ">
            <Input
              placeholder="00.000.000/0000-00"
              value={cnpj}
              onChange={(e) => setCnpj(formatCNPJ(e.target.value))}
              maxLength={18}
            />
          </Field>
          <Field label="Razão social">
            <Input value={razaoSocial} onChange={(e) => setRazaoSocial(e.target.value)} />
          </Field>
          <Field label="Nome fantasia">
            <Input value={nomeFantasia} onChange={(e) => setNomeFantasia(e.target.value)} />
          </Field>
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <Field label="Cidade">
                <Input value={cidade} onChange={(e) => setCidade(e.target.value)} />
              </Field>
            </div>
            <Field label="UF">
              <Input
                value={uf}
                onChange={(e) => setUf(e.target.value.replace(/[^a-zA-Z]/g, "").slice(0, 2))}
                maxLength={2}
              />
            </Field>
          </div>

          {err && <div className="text-xs text-red-400">{err}</div>}

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
              Cancelar
            </Button>
            <Button type="submit" disabled={saving}>
              {saving && <Loader2 size={12} className="animate-spin" />}
              Salvar
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
