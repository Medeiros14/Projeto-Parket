import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Loader2, AlertCircle, Plus, UserPlus, CheckCircle2, Clock, ShieldCheck,
  Link2, Copy, MessageCircle, Mail, X, Trash2,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { useFetch, api, sendWhatsAppViaAgent, type Admissao, type Cargo, type Empresa } from "@/lib/api";
import { supabase } from "@/lib/supabase";
import { fmtDate, initials } from "@/lib/format";
import { calcAdmissaoProgresso } from "@/lib/admissao-progresso";

const ETAPA_LABEL: Record<string, string> = {
  convite_enviado: "Convite enviado",
  formulario_em_preenchimento: "Em preenchimento",
  formulario_completo: "Formulário completo",
  contrato_gerado: "Contrato gerado",
  aguardando_assinatura: "Aguardando assinatura",
  assinado: "Assinado",
  aguardando_aprovacao_rh: "Aguardando aprovação RH",
  aprovado_ativo: "Aprovado",
  rejeitado: "Rejeitado",
  cancelado: "Cancelado",
  expirado: "Expirado",
};

type ColumnKey = "convidados" | "assinatura" | "aprovacao" | "aprovados";

const COLUMNS: { key: ColumnKey; title: string; etapas: string[]; icon: any; tone: string }[] = [
  {
    key: "convidados",
    title: "Convidados",
    etapas: ["convite_enviado", "formulario_em_preenchimento"],
    icon: UserPlus,
    tone: "text-amber-400",
  },
  {
    key: "assinatura",
    title: "Aguardando assinatura",
    etapas: ["formulario_completo", "contrato_gerado", "aguardando_assinatura"],
    icon: Clock,
    tone: "text-blue-400",
  },
  {
    key: "aprovacao",
    title: "Aguardando aprovação RH",
    etapas: ["assinado", "aguardando_aprovacao_rh"],
    icon: ShieldCheck,
    tone: "text-purple-400",
  },
  {
    key: "aprovados",
    title: "Aprovados",
    etapas: ["aprovado_ativo"],
    icon: CheckCircle2,
    tone: "text-green-400",
  },
];

function lastActionDate(a: Admissao): string | null {
  return a.aprovado_em || a.contrato_assinado_em || a.preenchido_em || null;
}

function isThisMonth(iso: string | null | undefined): boolean {
  if (!iso) return false;
  const d = new Date(iso);
  const now = new Date();
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
}

export function AdmissoesPage() {
  const navigate = useNavigate();
  const adms = useFetch(() => api.admissoes(), []);
  const cargos = useFetch(() => api.cargos(), []);
  const empresas = useFetch(() => api.empresas(), []);
  const [shareAdm, setShareAdm] = useState<Admissao | null>(null);
  const [deleteAdm, setDeleteAdm] = useState<Admissao | null>(null);

  const empresaMap = useMemo(() => {
    const m = new Map<string, Empresa>();
    (empresas.data || []).forEach((e) => m.set(e.id, e));
    return m;
  }, [empresas.data]);

  const cargoMap = useMemo(() => {
    const m = new Map<string, Cargo>();
    (cargos.data || []).forEach((c) => m.set(c.id, c));
    return m;
  }, [cargos.data]);

  const grouped = useMemo(() => {
    const buckets: Record<ColumnKey, Admissao[]> = {
      convidados: [], assinatura: [], aprovacao: [], aprovados: [],
    };
    const all = adms.data || [];
    for (const a of all) {
      for (const col of COLUMNS) {
        if (col.etapas.includes(a.etapa)) {
          buckets[col.key].push(a);
          break;
        }
      }
    }
    // Limita aprovados às últimas 10
    buckets.aprovados = buckets.aprovados
      .slice()
      .sort((a, b) => (b.aprovado_em || b.created_at).localeCompare(a.aprovado_em || a.created_at))
      .slice(0, 10);
    return buckets;
  }, [adms.data]);

  const kpis = useMemo(() => {
    const all = adms.data || [];
    const ativasEtapas = new Set([
      "convite_enviado", "formulario_em_preenchimento", "formulario_completo",
      "contrato_gerado", "aguardando_assinatura", "assinado", "aguardando_aprovacao_rh",
    ]);
    const ativas = all.filter((a) => ativasEtapas.has(a.etapa)).length;
    const concluidasMes = all.filter((a) => a.etapa === "aprovado_ativo" && isThisMonth(a.aprovado_em)).length;
    const totalMes = all.filter((a) => isThisMonth(a.created_at)).length;
    const pctConcluidas = totalMes > 0 ? Math.round((concluidasMes / totalMes) * 100) : 0;
    return { ativas, pctConcluidas, tempoMedio: "—" };
  }, [adms.data]);

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Admissões</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Acompanhe o pipeline de novos colaboradores em onboarding.
          </p>
        </div>
        <Button onClick={() => navigate("/admissoes/novo")}>
          <Plus size={14} /> Nova admissão
        </Button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-5">
            <div className="text-xs text-muted-foreground uppercase tracking-wider">Ativas</div>
            <div className="text-2xl font-bold mt-1">{kpis.ativas}</div>
            <div className="text-xs text-muted-foreground mt-1">admissões em andamento</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <div className="text-xs text-muted-foreground uppercase tracking-wider">Concluídas no mês</div>
            <div className="text-2xl font-bold mt-1">{kpis.pctConcluidas}%</div>
            <div className="text-xs text-muted-foreground mt-1">do total iniciado no mês</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <div className="text-xs text-muted-foreground uppercase tracking-wider">Tempo médio</div>
            <div className="text-2xl font-bold mt-1">{kpis.tempoMedio}</div>
            <div className="text-xs text-muted-foreground mt-1">do convite à aprovação</div>
          </CardContent>
        </Card>
      </div>

      {adms.loading && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground p-12 justify-center">
          <Loader2 size={14} className="animate-spin" /> Carregando admissões…
        </div>
      )}
      {adms.error && (
        <Card className="p-4 border-red-500/40 bg-red-500/10 text-sm text-red-400">
          Erro: {adms.error}
        </Card>
      )}

      {!adms.loading && !adms.error && (adms.data || []).length === 0 && (
        <Card className="p-12 text-center">
          <UserPlus size={36} className="mx-auto text-muted-foreground mb-3" />
          <div className="font-semibold mb-1">Ainda não há admissões</div>
          <div className="text-sm text-muted-foreground mb-4">
            Convide o primeiro colaborador e acompanhe o onboarding por aqui.
          </div>
          <Button onClick={() => navigate("/admissoes/novo")}>
            <Plus size={14} /> Inicie a primeira admissão
          </Button>
        </Card>
      )}

      {!adms.loading && !adms.error && (adms.data || []).length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          {COLUMNS.map((col) => {
            const items = grouped[col.key];
            const Icon = col.icon;
            return (
              <div key={col.key} className="flex flex-col gap-3 min-w-0">
                <div className="flex items-center justify-between px-1">
                  <div className="flex items-center gap-2">
                    <Icon size={14} className={col.tone} />
                    <div className="text-sm font-semibold">{col.title}</div>
                  </div>
                  <Badge variant="secondary">{items.length}</Badge>
                </div>
                <div className="flex flex-col gap-2 min-h-[120px]">
                  {items.length === 0 && (
                    <div className="text-xs text-muted-foreground px-3 py-6 text-center border border-dashed border-border rounded-lg">
                      Vazio
                    </div>
                  )}
                  {items.map((a) => {
                    const cargo = a.cargo_id ? cargoMap.get(a.cargo_id) : null;
                    const last = lastActionDate(a);
                    const podeCompartilhar = ["convite_enviado", "formulario_em_preenchimento"].includes(a.etapa);
                    return (
                      <Card key={a.id} className="p-3 hover:bg-secondary/50 transition">
                        <div className="flex items-start gap-3">
                          <Link to={`/admissoes/${a.id}`} className="shrink-0">
                            <div className="w-9 h-9 rounded-full bg-primary/15 text-primary flex items-center justify-center text-xs font-bold">
                              {initials(a.nome)}
                            </div>
                          </Link>
                          <Link to={`/admissoes/${a.id}`} className="flex-1 min-w-0">
                            <div className="font-semibold text-sm truncate">{a.nome}</div>
                            <div className="text-xs text-muted-foreground truncate">{a.email}</div>
                            <div className="text-xs text-muted-foreground mt-1 truncate">
                              {cargo?.nome || "Cargo não definido"}
                            </div>
                            <div className="flex items-center gap-2 mt-2 flex-wrap">
                              <Badge variant="outline" className="text-[10px]">
                                {ETAPA_LABEL[a.etapa] || a.etapa}
                              </Badge>
                              {a.data_admissao_prevista && (
                                <span className="text-[10px] text-muted-foreground">
                                  Início: {fmtDate(a.data_admissao_prevista)}
                                </span>
                              )}
                            </div>
                            {/* PROGRESSO: visível só pra quem está em preenchimento */}
                            {(a.etapa === "convite_enviado" || a.etapa === "formulario_em_preenchimento") && (() => {
                              const prog = calcAdmissaoProgresso(a.form_data);
                              const cor = prog.pct >= 75 ? "bg-emerald-500" : prog.pct >= 40 ? "bg-amber-500" : "bg-red-500";
                              return (
                                <div className="mt-2">
                                  <div className="flex items-center justify-between text-[10px] mb-1">
                                    <span className="text-muted-foreground">
                                      {prog.pct === 0 ? "Não começou" : `${prog.obrigatoriosFeitos}/${prog.obrigatoriosTotal} obrigatórios`}
                                    </span>
                                    <span className="font-bold">{prog.pct}%</span>
                                  </div>
                                  <div className="w-full h-1 bg-secondary rounded overflow-hidden">
                                    <div className={`h-1 ${cor} transition-all`} style={{ width: `${prog.pct}%` }} />
                                  </div>
                                  {prog.proximoStepPendente && prog.pct > 0 && prog.pct < 100 && (
                                    <div className="text-[10px] text-amber-400 mt-1">
                                      Parou em: <strong>{prog.proximoStepPendente}</strong>
                                    </div>
                                  )}
                                </div>
                              );
                            })()}
                            {last && (
                              <div className="text-[10px] text-muted-foreground mt-1">
                                Última ação: {fmtDate(last)}
                              </div>
                            )}
                          </Link>
                          {podeCompartilhar && (
                            <button
                              onClick={(e) => { e.preventDefault(); e.stopPropagation(); setShareAdm(a); }}
                              title="Enviar link do formulário pro funcionário"
                              className="shrink-0 p-1.5 rounded text-muted-foreground hover:text-primary hover:bg-secondary"
                            >
                              <Link2 size={14} />
                            </button>
                          )}
                          <button
                            onClick={(e) => { e.preventDefault(); e.stopPropagation(); setDeleteAdm(a); }}
                            title="Excluir admissão"
                            className="shrink-0 p-1.5 rounded text-muted-foreground hover:text-red-400 hover:bg-red-500/10"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </Card>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {shareAdm && (
        <ShareLinkModal
          admissao={shareAdm}
          empresaNome={empresaMap.get(shareAdm.empresa_id)?.nome_fantasia || empresaMap.get(shareAdm.empresa_id)?.razao_social || "Parket"}
          onClose={() => setShareAdm(null)}
        />
      )}

      {deleteAdm && (
        <DeleteAdmissaoModal
          admissao={deleteAdm}
          onClose={() => setDeleteAdm(null)}
          onDeleted={() => { setDeleteAdm(null); adms.reload(); }}
        />
      )}
    </div>
  );
}

function DeleteAdmissaoModal({ admissao, onClose, onDeleted }: {
  admissao: Admissao; onClose: () => void; onDeleted: () => void;
}) {
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async () => {
    setErr(null);
    setSubmitting(true);
    try {
      const { error } = await supabase.from("admissoes").delete().eq("id", admissao.id);
      if (error) throw error;
      onDeleted();
    } catch (e: any) {
      setErr(e.message || "Falha ao excluir");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <Card className="w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start gap-3 mb-4">
          <div className="w-10 h-10 rounded-full bg-red-500/15 flex items-center justify-center shrink-0">
            <Trash2 size={18} className="text-red-400" />
          </div>
          <div>
            <div className="text-base font-semibold">Excluir admissão</div>
            <div className="text-xs text-muted-foreground mt-0.5">
              Essa ação não pode ser desfeita.
            </div>
          </div>
        </div>
        <div className="text-sm mb-4 p-3 bg-secondary/30 rounded">
          <div className="font-semibold">{admissao.nome}</div>
          <div className="text-xs text-muted-foreground mt-1">
            {admissao.email}{admissao.telefone && ` · ${admissao.telefone}`}
          </div>
          <div className="text-xs text-muted-foreground mt-1">
            Etapa: {ETAPA_LABEL[admissao.etapa] || admissao.etapa}
          </div>
        </div>
        <div className="text-xs text-muted-foreground mb-4">
          O link público vai parar de funcionar e os documentos enviados serão removidos.
        </div>
        {err && <div className="text-xs text-red-400 mb-3">{err}</div>}
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose} disabled={submitting}>Cancelar</Button>
          <Button onClick={submit} disabled={submitting}
            className="bg-red-600 hover:bg-red-700 text-white">
            {submitting && <Loader2 size={12} className="animate-spin" />}
            <Trash2 size={12} /> Excluir definitivamente
          </Button>
        </div>
      </Card>
    </div>
  );
}

function ShareLinkModal({ admissao, empresaNome, onClose }: {
  admissao: Admissao; empresaNome: string; onClose: () => void;
}) {
  const url = `${window.location.origin}/admissao/${admissao.token}`;
  const firstName = admissao.nome.split(" ")[0];
  const msg = `Oi ${firstName}! Aqui é da ${empresaNome}. Pra começar tua admissão, preenche teus dados nesse link:\n\n${url}\n\nLeva uns 10 minutos. Qualquer dúvida me chama!`;
  const [copied, setCopied] = useState<"url" | "msg" | null>(null);

  const copy = async (text: string, kind: "url" | "msg") => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(kind);
      setTimeout(() => setCopied(null), 1500);
    } catch {}
  };

  const [wppNum, setWppNum] = useState((admissao.telefone || "").replace(/\D/g, ""));
  const [sending, setSending] = useState(false);
  const sendWhats = async () => {
    let phone = wppNum;
    if (!phone) {
      const input = window.prompt(`Cadastrar celular de ${firstName} (com DDD):`, "");
      if (!input) return;
      const digits = input.replace(/\D/g, "");
      if (digits.length < 10) { alert("Número inválido."); return; }
      const { error } = await supabase.from("admissoes").update({ telefone: digits }).eq("id", admissao.id);
      if (error) { alert("Erro: " + error.message); return; }
      setWppNum(digits);
      phone = digits;
    }
    setSending(true);
    const res = await sendWhatsAppViaAgent({ telefone: phone, mensagem: msg });
    setSending(false);
    if (res.ok) alert("✓ Enviado pelo Agente RH");
    else alert("Erro: " + (res.error || ""));
  };
  const mailHref = `mailto:${admissao.email}?subject=${encodeURIComponent("Admissão " + empresaNome)}&body=${encodeURIComponent(msg)}`;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <Card className="w-full max-w-lg p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="text-base font-semibold">Enviar formulário de admissão</div>
            <div className="text-xs text-muted-foreground mt-0.5">{admissao.nome} · {empresaNome}</div>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X size={16} /></button>
        </div>

        <div className="space-y-3">
          <div>
            <div className="text-xs font-medium mb-1">Link público</div>
            <div className="flex gap-2">
              <input readOnly value={url}
                className="flex-1 h-9 bg-input border border-border rounded-md text-xs px-3 outline-none font-mono" />
              <Button variant="outline" onClick={() => copy(url, "url")}>
                <Copy size={12} /> {copied === "url" ? "Copiado!" : "Copiar"}
              </Button>
            </div>
            <div className="text-[10px] text-muted-foreground mt-1">
              Funciona sem login. {admissao.token_expira_em && `Expira em ${fmtDate(admissao.token_expira_em)}.`}
            </div>
          </div>

          <div>
            <div className="text-xs font-medium mb-1">Mensagem pronta</div>
            <textarea readOnly value={msg} rows={5}
              className="w-full bg-input border border-border rounded-md text-xs p-2 outline-none resize-none" />
            <Button variant="outline" className="mt-1" onClick={() => copy(msg, "msg")}>
              <Copy size={12} /> {copied === "msg" ? "Copiado!" : "Copiar mensagem"}
            </Button>
          </div>

          <div className="grid grid-cols-2 gap-2 pt-2">
            <Button onClick={sendWhats} disabled={sending}
              className={wppNum ? "w-full bg-emerald-600 hover:bg-emerald-700 text-white" : "w-full bg-amber-600 hover:bg-amber-700 text-white"}>
              {sending ? <Loader2 size={14} className="animate-spin" /> : <MessageCircle size={14} />}
              {sending ? "Enviando…" : wppNum ? "Enviar pelo Agente RH" : "Cadastrar celular e enviar"}
            </Button>
            <a href={mailHref}>
              <Button variant="outline" className="w-full">
                <Mail size={14} /> Enviar email
              </Button>
            </a>
          </div>
        </div>
      </Card>
    </div>
  );
}
