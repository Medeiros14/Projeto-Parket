import { useMemo, useState } from "react";
import { Loader2, Sun, AlertCircle, Calendar, Check, X, Eye, Plus } from "lucide-react";
import { Card, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { useFetch, api, type FeriasSolicitacao, type Colaborador, type Contrato } from "@/lib/api";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { fmtDate, initials } from "@/lib/format";

const STATUS_LABEL: Record<string, string> = {
  pendente: "Pendente",
  aprovada: "Aprovada",
  rejeitada: "Rejeitada",
  cancelada: "Cancelada",
  iniciada: "Em curso",
  concluida: "Concluída",
};

function statusVariant(s: string): "success" | "warning" | "destructive" | "secondary" | "default" {
  if (s === "aprovada" || s === "concluida") return "success";
  if (s === "pendente") return "warning";
  if (s === "rejeitada" || s === "cancelada") return "destructive";
  if (s === "iniciada") return "default";
  return "secondary";
}

type TabKey = "pendentes" | "aprovadas" | "historico";

const TABS: { key: TabKey; label: string }[] = [
  { key: "pendentes", label: "Pendentes" },
  { key: "aprovadas", label: "Aprovadas" },
  { key: "historico", label: "Histórico" },
];

function isThisMonth(iso: string | null | undefined): boolean {
  if (!iso) return false;
  const d = new Date(iso);
  const now = new Date();
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
}

export function FeriasPage() {
  const { appUser } = useAuth();
  const [tab, setTab] = useState<TabKey>("pendentes");
  const [acting, setActing] = useState<string | null>(null);

  const fs = useFetch(() => api.feriasSolicitacoes(), []);
  const colabs = useFetch(() => api.colaboradores(), []);
  const contratos = useFetch(() => api.contratos(), []);

  const colabPorContrato = useMemo(() => {
    const cmap = new Map<string, Colaborador>();
    (colabs.data || []).forEach((c) => cmap.set(c.id, c));
    const m = new Map<string, Colaborador | null>();
    (contratos.data || []).forEach((k: Contrato) => {
      m.set(k.id, cmap.get(k.colaborador_id) || null);
    });
    return m;
  }, [colabs.data, contratos.data]);

  const lista = useMemo(() => {
    const all = fs.data || [];
    if (tab === "pendentes") return all.filter((f) => f.status === "pendente");
    if (tab === "aprovadas") return all.filter((f) => ["aprovada", "iniciada"].includes(f.status));
    return all.filter((f) => ["concluida", "rejeitada", "cancelada"].includes(f.status));
  }, [fs.data, tab]);

  const kpis = useMemo(() => {
    const all = fs.data || [];
    const pendentes = all.filter((f) => f.status === "pendente").length;
    const aprovadasMes = all.filter((f) => f.status === "aprovada" && isThisMonth(f.solicitado_em)).length;
    const diasAcumulados = all
      .filter((f) => ["aprovada", "iniciada", "concluida"].includes(f.status))
      .reduce((acc, f) => acc + (f.dias || 0), 0);
    return { pendentes, aprovadasMes, diasAcumulados };
  }, [fs.data]);

  async function aprovar(f: FeriasSolicitacao) {
    if (!confirm(`Aprovar férias de ${fmtDate(f.inicio)} a ${fmtDate(f.fim)} (${f.dias} dias)?`)) return;
    setActing(f.id);
    try {
      const { error } = await supabase
        .from("ferias_solicitacoes")
        .update({
          status: "aprovada",
          aprovado_por: appUser?.id || null,
          aprovado_em: new Date().toISOString(),
        })
        .eq("id", f.id);
      if (error) throw error;
      fs.reload();
    } catch (e: any) {
      alert("Erro ao aprovar: " + (e?.message || "desconhecido"));
    } finally {
      setActing(null);
    }
  }

  async function rejeitar(f: FeriasSolicitacao) {
    const motivo = prompt("Motivo da rejeição:");
    if (motivo == null) return;
    if (!motivo.trim()) {
      alert("Informe um motivo.");
      return;
    }
    setActing(f.id);
    try {
      const { error } = await supabase
        .from("ferias_solicitacoes")
        .update({
          status: "rejeitada",
          rejeitado_motivo: motivo.trim(),
          aprovado_por: appUser?.id || null,
          aprovado_em: new Date().toISOString(),
        })
        .eq("id", f.id);
      if (error) throw error;
      fs.reload();
    } catch (e: any) {
      alert("Erro ao rejeitar: " + (e?.message || "desconhecido"));
    } finally {
      setActing(null);
    }
  }

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Férias</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Aprove solicitações e acompanhe o saldo do time.
          </p>
        </div>
        <Button onClick={() => alert("Em breve: cadastro manual de férias pelo RH.")}>
          <Plus size={14} /> Solicitar férias
        </Button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-5">
            <div className="flex items-start justify-between">
              <div>
                <div className="text-xs text-muted-foreground uppercase tracking-wider">Pendentes urgentes</div>
                <div className="text-2xl font-bold mt-1">{kpis.pendentes}</div>
                <div className="text-xs text-muted-foreground mt-1">aguardando aprovação</div>
              </div>
              <div className="w-10 h-10 rounded-lg bg-amber-500/15 text-amber-400 flex items-center justify-center">
                <AlertCircle size={18} />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <div className="flex items-start justify-between">
              <div>
                <div className="text-xs text-muted-foreground uppercase tracking-wider">Aprovadas no mês</div>
                <div className="text-2xl font-bold mt-1">{kpis.aprovadasMes}</div>
                <div className="text-xs text-muted-foreground mt-1">solicitações aprovadas</div>
              </div>
              <div className="w-10 h-10 rounded-lg bg-primary/15 text-primary flex items-center justify-center">
                <Sun size={18} />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <div className="flex items-start justify-between">
              <div>
                <div className="text-xs text-muted-foreground uppercase tracking-wider">Dias acumulados</div>
                <div className="text-2xl font-bold mt-1">{kpis.diasAcumulados}</div>
                <div className="text-xs text-muted-foreground mt-1">somando aprovadas e ativas</div>
              </div>
              <div className="w-10 h-10 rounded-lg bg-green-500/15 text-green-400 flex items-center justify-center">
                <Calendar size={18} />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-border">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={
              "px-4 py-2 text-sm font-medium border-b-2 transition -mb-px " +
              (tab === t.key
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground")
            }
          >
            {t.label}
          </button>
        ))}
      </div>

      {fs.loading && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground p-12 justify-center">
          <Loader2 size={14} className="animate-spin" /> Carregando solicitações…
        </div>
      )}
      {fs.error && (
        <Card className="p-4 border-red-500/40 bg-red-500/10 text-sm text-red-400">
          Erro: {fs.error}
        </Card>
      )}

      {!fs.loading && !fs.error && lista.length === 0 && (
        <Card className="p-12 text-center">
          <Sun size={32} className="mx-auto text-muted-foreground mb-3" />
          <div className="font-semibold mb-1">Nada por aqui</div>
          <div className="text-sm text-muted-foreground">
            {tab === "pendentes" && "Sem solicitações pendentes — bom trabalho!"}
            {tab === "aprovadas" && "Nenhuma solicitação aprovada no momento."}
            {tab === "historico" && "Sem histórico ainda."}
          </div>
        </Card>
      )}

      {!fs.loading && !fs.error && lista.length > 0 && (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-secondary/40 text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="text-left font-medium py-3 px-4">Colaborador</th>
                  <th className="text-left font-medium py-3 px-4">Período</th>
                  <th className="text-left font-medium py-3 px-4">Datas</th>
                  <th className="text-left font-medium py-3 px-4">Solicitado em</th>
                  <th className="text-left font-medium py-3 px-4">Status</th>
                  <th className="text-right font-medium py-3 px-4">Ações</th>
                </tr>
              </thead>
              <tbody>
                {lista.map((f) => {
                  const colab = colabPorContrato.get(f.contrato_id);
                  const nome = colab?.nome || "Colaborador desconhecido";
                  return (
                    <tr key={f.id} className="border-t border-border hover:bg-secondary/20">
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-full bg-primary/15 text-primary flex items-center justify-center text-[10px] font-bold shrink-0">
                            {initials(nome)}
                          </div>
                          <div className="min-w-0">
                            <div className="font-medium truncate">{nome}</div>
                            {colab?.email_profissional && (
                              <div className="text-xs text-muted-foreground truncate">{colab.email_profissional}</div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <span className="font-medium">{f.dias}</span>
                        <span className="text-muted-foreground"> dias</span>
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        {fmtDate(f.inicio)} <span className="text-muted-foreground">→</span> {fmtDate(f.fim)}
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap text-muted-foreground">
                        {fmtDate(f.solicitado_em)}
                      </td>
                      <td className="py-3 px-4">
                        <Badge variant={statusVariant(f.status)}>{STATUS_LABEL[f.status] || f.status}</Badge>
                      </td>
                      <td className="py-3 px-4 text-right">
                        {f.status === "pendente" ? (
                          <div className="inline-flex items-center gap-1">
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={acting === f.id}
                              onClick={() => aprovar(f)}
                            >
                              {acting === f.id ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
                              Aprovar
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              disabled={acting === f.id}
                              onClick={() => rejeitar(f)}
                            >
                              <X size={12} /> Rejeitar
                            </Button>
                          </div>
                        ) : (
                          <Button size="sm" variant="ghost" onClick={() => alert("Detalhe da solicitação em breve.")}>
                            <Eye size={12} /> Ver
                          </Button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
