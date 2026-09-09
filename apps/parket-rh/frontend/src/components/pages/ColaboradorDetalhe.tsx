import { useEffect, useMemo, useState } from "react";
import { useParams, Link } from "react-router-dom";
import {
  Loader2, ArrowLeft, Pencil, FileText, LogOut, Construction,
  User as UserIcon, Mail, MapPin, Briefcase, History, MessageCircle, Copy, Link2, AlertTriangle, CheckCircle2,
  Plus, Download, Eye, Send, RefreshCw, ExternalLink, Receipt, GraduationCap, Award, Calendar,
} from "lucide-react";
import { EmitirModal, type Modelo } from "@/components/pages/Documentos";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { useFetch, api, sendWhatsAppViaAgent, type Cargo, type Departamento, type Empresa } from "@/lib/api";
import { supabase } from "@/lib/supabase";
import { fmtBRL, fmtCPF, fmtDate, fmtTel, initials } from "@/lib/format";

type TabKey = "dados" | "vinculos" | "documentos" | "holerites" | "treinamentos" | "historico";

const STATUS_LABEL: Record<string, { label: string; variant: any }> = {
  completo: { label: "Cadastro completo", variant: "success" },
  pendente_validacao: { label: "Aguardando validação", variant: "warning" },
  incompleto: { label: "Cadastro incompleto", variant: "warning" },
};

const VINCULO_STATUS: Record<string, { label: string; variant: any }> = {
  ativo: { label: "Ativo", variant: "success" },
  encerrado: { label: "Encerrado", variant: "outline" },
  afastado: { label: "Afastado temporariamente", variant: "warning" },
  ferias: { label: "De férias", variant: "secondary" },
};

function calcAnos(adm: string | null) {
  if (!adm) return null;
  const d = new Date(adm.length === 10 ? adm + "T00:00:00" : adm);
  if (isNaN(d.getTime())) return null;
  const diff = Date.now() - d.getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24 * 365.25));
}

function calcIdade(nasc: string | null) {
  if (!nasc) return null;
  const d = new Date(nasc.length === 10 ? nasc + "T00:00:00" : nasc);
  if (isNaN(d.getTime())) return null;
  const hoje = new Date();
  let idade = hoje.getFullYear() - d.getFullYear();
  const m = hoje.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && hoje.getDate() < d.getDate())) idade--;
  return idade;
}

export function ColaboradorDetalhePage() {
  const { id } = useParams<{ id: string }>();
  const c = useFetch(() => api.colaborador(id!), [id]);
  const contratos = useFetch(() => api.contratosByColab(id!), [id]);
  const empresas = useFetch(() => api.empresas(), []);
  const cargos = useFetch(() => api.cargos(), []);
  const deptos = useFetch(() => api.departamentos(), []);

  const [tab, setTab] = useState<TabKey>("dados");
  const [showDesligar, setShowDesligar] = useState(false);
  const [desligData, setDesligData] = useState(() => new Date().toISOString().slice(0, 10));
  const [desligMotivo, setDesligMotivo] = useState("");
  const [desligObs, setDesligObs] = useState("");
  const [desligando, setDesligando] = useState(false);

  const onDesligar = async () => {
    if (!contratoAtual) { alert("Sem contrato ativo pra desligar."); return; }
    if (!desligMotivo.trim()) { alert("Informe o motivo do desligamento."); return; }
    setDesligando(true);
    try {
      const { error: e1 } = await supabase.from("contratos")
        .update({ status: "desligado", data_demissao: desligData })
        .eq("id", contratoAtual.id);
      if (e1) throw new Error(e1.message);
      const { error: e2 } = await supabase.from("desligamentos").insert({
        contrato_id: contratoAtual.id,
        data_desligamento: desligData,
        motivo: desligMotivo.trim(),
        observacao: desligObs.trim() || null,
        status: "concluido",
      });
      if (e2) throw new Error(e2.message);
      setShowDesligar(false);
      contratos.reload();
    } catch (e: any) {
      alert("Erro ao desligar: " + (e?.message || e));
    } finally {
      setDesligando(false);
    }
  };

  const empresaMap = useMemo(() => {
    const m: Record<string, Empresa> = {};
    (empresas.data || []).forEach((e) => { m[e.id] = e; });
    return m;
  }, [empresas.data]);

  const cargoMap = useMemo(() => {
    const m: Record<string, Cargo> = {};
    (cargos.data || []).forEach((x) => { m[x.id] = x; });
    return m;
  }, [cargos.data]);

  const deptoMap = useMemo(() => {
    const m: Record<string, Departamento> = {};
    (deptos.data || []).forEach((x) => { m[x.id] = x; });
    return m;
  }, [deptos.data]);

  const contratoAtual = useMemo(() => {
    const arr = (contratos.data || []).slice().sort((a, b) => (a.data_admissao < b.data_admissao ? 1 : -1));
    return arr.find((x) => x.status === "ativo") || arr[0] || null;
  }, [contratos.data]);

  if (c.loading) {
    return (
      <div className="p-8 flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 size={14} className="animate-spin" /> Carregando colaborador…
      </div>
    );
  }

  if (c.error || !c.data) {
    return (
      <div className="p-8">
        <Card className="p-6 text-sm text-red-400">
          Erro ao carregar colaborador: {c.error || "não encontrado"}
        </Card>
      </div>
    );
  }

  const colab = c.data;
  const status = STATUS_LABEL[colab.status_dados] || { label: colab.status_dados, variant: "outline" };
  const anosNaParket = calcAnos(contratoAtual?.data_admissao || null);

  return (
    <div className="p-8 space-y-6">
      <div>
        <Link to="/colaboradores" className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition">
          <ArrowLeft size={12} /> Voltar pra colaboradores
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Sidebar */}
        <div className="lg:col-span-1 space-y-4">
          <Card className="p-5 flex flex-col items-center text-center">
            {colab.foto_url ? (
              <img src={colab.foto_url} alt={colab.nome} className="w-24 h-24 rounded-full object-cover mb-3" />
            ) : (
              <div className="w-24 h-24 rounded-full bg-primary/15 text-primary flex items-center justify-center text-2xl font-bold mb-3">
                {initials(colab.nome)}
              </div>
            )}
            <div className="text-lg font-semibold">{colab.nome}</div>
            {colab.nome_social && (
              <div className="text-sm text-muted-foreground">também conhecido como {colab.nome_social}</div>
            )}
            <Badge variant={status.variant} className="mt-2">{status.label}</Badge>

            <div className="grid grid-cols-2 gap-3 w-full mt-5 pt-5 border-t border-border">
              <MiniStat label="na Parket" value={anosNaParket != null ? `${anosNaParket} ${anosNaParket === 1 ? "ano" : "anos"}` : "—"} />
              <MiniStat label="salário" value={fmtBRL(contratoAtual?.salario_base ?? null)} />
            </div>

            <div className="w-full mt-4 space-y-2">
              <Button variant="outline" size="sm" className="w-full" disabled title="Em breve">
                <Pencil size={12} /> Editar dados
              </Button>
              <Button variant="outline" size="sm" className="w-full" disabled title="Em breve">
                <FileText size={12} /> Documentos
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="w-full text-red-400 hover:text-red-300"
                disabled={!contratoAtual || contratoAtual.status === "desligado"}
                onClick={() => setShowDesligar(true)}
                title={contratoAtual?.status === "desligado" ? "Já desligado" : "Iniciar desligamento"}
              >
                <LogOut size={12} /> {contratoAtual?.status === "desligado" ? "Já desligado" : "Iniciar desligamento"}
              </Button>
            </div>
          </Card>
        </div>

        {/* Conteúdo */}
        <div className="lg:col-span-2 space-y-4">
          {/* Tabs */}
          <div className="flex gap-1 border-b border-border">
            <Tab active={tab === "dados"} onClick={() => setTab("dados")} icon={UserIcon}>Dados pessoais</Tab>
            <Tab active={tab === "vinculos"} onClick={() => setTab("vinculos")} icon={Briefcase}>Vínculos</Tab>
            <Tab active={tab === "documentos"} onClick={() => setTab("documentos")} icon={FileText}>Documentos</Tab>
            <Tab active={tab === "holerites"} onClick={() => setTab("holerites")} icon={Receipt}>Holerites</Tab>
            <Tab active={tab === "treinamentos"} onClick={() => setTab("treinamentos")} icon={GraduationCap}>Treinamentos</Tab>
            <Tab active={tab === "historico"} onClick={() => setTab("historico")} icon={History}>Histórico</Tab>
          </div>

          {tab === "dados" && (
            <div className="space-y-4">
              <Section title="Identidade" icon={UserIcon}>
                <Row label="Nome" value={colab.nome} />
                <Row label="Nome social" value={colab.nome_social} />
                <Row label="CPF" value={fmtCPF(colab.cpf)} />
                <Row
                  label="Data de nascimento"
                  value={
                    colab.data_nascimento
                      ? `${fmtDate(colab.data_nascimento)}${calcIdade(colab.data_nascimento) != null ? ` (${calcIdade(colab.data_nascimento)} anos)` : ""}`
                      : "—"
                  }
                />
                <Row label="Sexo" value={colab.sexo} />
                <Row label="Estado civil" value={colab.estado_civil} />
                <Row label="Cor / raça" value={colab.raca_cor} />
                <Row label="Dependentes IR" value={colab.qtd_dependentes_ir != null ? String(colab.qtd_dependentes_ir) : "—"} />
              </Section>

              <Section title="Contatos" icon={Mail}>
                <Row label="Email pessoal" value={colab.email_pessoal} />
                <Row label="Email profissional" value={colab.email_profissional} />
                <Row label="Celular" value={fmtTel(colab.celular)} />
              </Section>

              <Section title="Endereço" icon={MapPin}>
                <Row
                  label="Cidade / UF"
                  value={colab.endereco_cidade && colab.endereco_uf ? `${colab.endereco_cidade} / ${colab.endereco_uf}` : "—"}
                />
              </Section>
            </div>
          )}

          {tab === "vinculos" && (
            <Card className="p-5">
              {contratos.loading ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 size={14} className="animate-spin" /> Carregando vínculos…
                </div>
              ) : (contratos.data || []).length === 0 ? (
                <div className="text-sm text-muted-foreground py-6 text-center">
                  Nenhum vínculo registrado.
                </div>
              ) : (
                <div className="space-y-3">
                  {(contratos.data || [])
                    .slice()
                    .sort((a, b) => (a.data_admissao < b.data_admissao ? 1 : -1))
                    .map((k) => {
                      const empresa = empresaMap[k.empresa_id];
                      const cargo = k.cargo_id ? cargoMap[k.cargo_id] : null;
                      const depto = k.departamento_id ? deptoMap[k.departamento_id] : null;
                      const sk = VINCULO_STATUS[k.status] || { label: k.status, variant: "outline" };
                      return (
                        <div key={k.id} className="border border-border rounded-lg p-4 space-y-2">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <div className="font-semibold text-sm">
                                {empresa ? (empresa.nome_fantasia || empresa.razao_social) : "—"}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {cargo?.nome || "—"}
                                {depto && <> · {depto.nome}</>}
                                {k.matricula && <> · matrícula {k.matricula}</>}
                              </div>
                            </div>
                            <Badge variant={sk.variant}>{sk.label}</Badge>
                          </div>
                          <div className="grid grid-cols-3 gap-2 text-xs pt-2 border-t border-border">
                            <Mini label="Admissão" value={fmtDate(k.data_admissao)} />
                            <Mini label="Salário" value={fmtBRL(k.salario_base)} />
                            <Mini label="Tipo" value={(k.vinculo || k.tipo_contrato || "—").toUpperCase()} />
                          </div>
                          {k.data_demissao && (
                            <div className="text-xs text-red-400 pt-1">
                              Encerrado em {fmtDate(k.data_demissao)}
                            </div>
                          )}
                        </div>
                      );
                    })}
                </div>
              )}
            </Card>
          )}

          {tab === "documentos" && c.data && (
            <DocumentosTab colaboradorId={c.data.id} colaboradorNome={c.data.nome} colaboradorCelular={c.data.celular} />
          )}

          {tab === "holerites" && c.data && (
            <HoleritesTab colaboradorId={c.data.id} colaboradorNome={c.data.nome} />
          )}

          {tab === "treinamentos" && c.data && (
            <TreinamentosTab colaboradorId={c.data.id} colaboradorNome={c.data.nome} />
          )}

          {tab === "historico" && (
            <Card className="p-12 flex flex-col items-center text-center">
              <Construction size={28} className="text-primary mb-3" />
              <div className="font-semibold mb-1.5">Em construção</div>
              <p className="text-sm text-muted-foreground max-w-md">
                Histórico de alterações de cargo/salário, transferências, e eventos eSocial.
              </p>
            </Card>
          )}
        </div>
      </div>

      {showDesligar && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4" onMouseDown={() => !desligando && setShowDesligar(false)}>
          <div className="bg-card border border-border rounded-xl w-full max-w-md p-5" onMouseDown={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-2 mb-4">
              <LogOut size={16} className="text-red-400" />
              <div className="font-semibold">Desligar colaborador</div>
            </div>
            <div className="text-xs text-muted-foreground mb-4">
              {c.data?.nome} — contrato passa a <strong className="text-red-400">desligado</strong>.
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground block mb-1">Data do desligamento *</label>
                <input
                  type="date"
                  value={desligData}
                  onChange={(e) => setDesligData(e.target.value)}
                  className="w-full bg-background border border-border rounded px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground block mb-1">Motivo *</label>
                <select
                  value={desligMotivo}
                  onChange={(e) => setDesligMotivo(e.target.value)}
                  className="w-full bg-background border border-border rounded px-3 py-2 text-sm"
                >
                  <option value="">Selecione…</option>
                  <option value="Pedido de demissão">Pedido de demissão</option>
                  <option value="Demissão sem justa causa">Demissão sem justa causa</option>
                  <option value="Demissão por justa causa">Demissão por justa causa</option>
                  <option value="Acordo">Acordo (CLT art. 484-A)</option>
                  <option value="Término de contrato">Término de contrato</option>
                  <option value="Fim de experiência">Fim de experiência</option>
                  <option value="Aposentadoria">Aposentadoria</option>
                  <option value="Falecimento">Falecimento</option>
                  <option value="Outros">Outros</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground block mb-1">Observação (opcional)</label>
                <textarea
                  value={desligObs}
                  onChange={(e) => setDesligObs(e.target.value)}
                  rows={3}
                  className="w-full bg-background border border-border rounded px-3 py-2 text-sm"
                  placeholder="Detalhes adicionais…"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 mt-5">
              <Button variant="outline" size="sm" disabled={desligando} onClick={() => setShowDesligar(false)}>
                Cancelar
              </Button>
              <Button
                size="sm"
                disabled={desligando || !desligMotivo}
                onClick={onDesligar}
                className="bg-red-500 hover:bg-red-600 text-white"
              >
                {desligando ? <Loader2 size={12} className="animate-spin mr-1" /> : <LogOut size={12} className="mr-1" />}
                Confirmar desligamento
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Tab({ active, onClick, icon: Icon, children }: { active: boolean; onClick: () => void; icon: any; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition -mb-px ${
        active
          ? "border-primary text-foreground"
          : "border-transparent text-muted-foreground hover:text-foreground"
      }`}
    >
      <Icon size={14} /> {children}
    </button>
  );
}

function Section({ title, icon: Icon, children }: { title: string; icon: any; children: React.ReactNode }) {
  return (
    <Card className="p-5">
      <div className="flex items-center gap-2 mb-4">
        <Icon size={14} className="text-primary" />
        <div className="text-sm font-semibold">{title}</div>
      </div>
      <div className="divide-y divide-border">{children}</div>
    </Card>
  );
}

function Row({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="grid grid-cols-3 gap-2 py-2.5">
      <div className="text-xs text-muted-foreground col-span-1">{label}</div>
      <div className="text-sm col-span-2">{value && value !== "—" ? value : <span className="text-muted-foreground">—</span>}</div>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="text-center">
      <div className="text-sm font-semibold">{value}</div>
      <div className="text-[10px] text-muted-foreground uppercase tracking-wider mt-0.5">{label}</div>
    </div>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] text-muted-foreground uppercase tracking-wider">{label}</div>
      <div className="text-xs font-medium mt-0.5">{value}</div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────
// Documentos do colaborador — assinaturas pendentes/concluídas
// ────────────────────────────────────────────────────────────────
type DocItem = {
  id: string;
  tipo: "admissao_form" | "signer" | "emitido";
  titulo: string;
  status: "pendente" | "assinado" | "cancelado";
  etapa?: string;
  token?: string;
  expira_em?: string | null;
  criado_em: string;
  preenchido_em?: string | null;
  assinado_em?: string | null;
  telefone?: string | null;
  email?: string | null;
  nome?: string | null;
  empresa_nome?: string | null;
  empresa_razao?: string | null;
  categoria?: string;
  legado_origem?: string | null;
  legado_pdf_path?: string | null;
};

function DocumentosTab({ colaboradorId, colaboradorNome, colaboradorCelular }: {
  colaboradorId: string; colaboradorNome: string; colaboradorCelular: string | null;
}) {
  const [data, setData] = useState<{ admissoes: DocItem[]; emitidos?: DocItem[]; signer?: DocItem[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showEnviar, setShowEnviar] = useState(false);
  const [modeloEscolhido, setModeloEscolhido] = useState<Modelo | null>(null);
  const [celEdit, setCelEdit] = useState<string | null>(colaboradorCelular);
  useEffect(() => { setCelEdit(colaboradorCelular); }, [colaboradorCelular]);

  // Clicksign: fetch separado de documentos emitidos via Clicksign pra esse colab
  const [csDocs, setCsDocs] = useState<any[]>([]);
  const [csLoading, setCsLoading] = useState(true);
  const reloadCS = async () => {
    setCsLoading(true);
    const { data: cs } = await supabase.from("documentos_emitidos")
      .select("id, titulo, status, clicksign_envelope_id, clicksign_signer_url, clicksign_signed_pdf_url, clicksign_enviado_em, clicksign_visualizado_em, clicksign_assinado_em, created_at, lote_id, lote_titulo, auth_methods, canal_assinatura")
      .eq("colaborador_id", colaboradorId)
      .eq("canal_assinatura", "clicksign")
      .order("created_at", { ascending: false });
    setCsDocs(cs || []);
    setCsLoading(false);
  };

  const reload = () => {
    setLoading(true);
    supabase.rpc("colaborador_documentos_get", { p_colab_id: colaboradorId })
      .then(({ data: d, error: e }) => {
        if (e) setError(e.message);
        else setData(d as any);
        setLoading(false);
      });
    reloadCS();
  };
  useEffect(() => { reload(); }, [colaboradorId]); // eslint-disable-line

  // Polling: sync Clicksign a cada 30s pra detectar assinatura nova
  useEffect(() => {
    if (csDocs.length === 0) return;
    const id = setInterval(async () => {
      try {
        const r = await fetch("/api/clicksign/sync-all", { method: "POST" });
        if (r.ok) {
          const j = await r.json();
          if (j.atualizados > 0) reloadCS();
        }
      } catch {}
    }, 30_000);
    return () => clearInterval(id);
  }, [csDocs.length, colaboradorId]); // eslint-disable-line

  if (loading) return (
    <Card className="p-8 flex items-center justify-center gap-2 text-sm text-muted-foreground">
      <Loader2 size={14} className="animate-spin" /> Carregando documentos…
    </Card>
  );
  if (error) return (
    <Card className="p-6 text-sm text-red-400">Erro: {error}</Card>
  );

  const all = [...(data?.admissoes || []), ...((data as any)?.emitidos || [])];
  const pendentes = all.filter((d) => d.status === "pendente");
  const assinados = all.filter((d) => d.status === "assinado");

  return (
    <div className="space-y-5">
      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <div className="text-xs text-muted-foreground">
          {all.length} documento{all.length !== 1 ? "s" : ""} no total
          {assinados.length > 0 && ` · ${assinados.length} assinado${assinados.length !== 1 ? "s" : ""}`}
          {pendentes.length > 0 && ` · ${pendentes.length} pendente${pendentes.length !== 1 ? "s" : ""}`}
        </div>
        <Button onClick={() => setShowEnviar(true)} size="sm">
          <Send size={12} /> Enviar documento
        </Button>
      </div>

      {/* Banner de alerta se houver pendentes */}
      {pendentes.length > 0 && (
        <Card className="p-4 border-amber-500/40 bg-amber-500/10 flex items-start gap-3">
          <AlertTriangle size={18} className="text-amber-400 shrink-0 mt-0.5" />
          <div className="flex-1">
            <div className="text-sm font-semibold text-amber-300">
              {pendentes.length} documento{pendentes.length > 1 ? "s" : ""} aguardando assinatura
            </div>
            <div className="text-xs text-muted-foreground mt-0.5">
              {colaboradorNome.split(" ")[0]} ainda não assinou. Reenvie o link por WhatsApp ou email.
            </div>
          </div>
        </Card>
      )}

      {/* Pendentes */}
      {pendentes.length > 0 && (
        <div>
          <h3 className="text-xs font-bold uppercase tracking-wider text-amber-400 mb-2">Pendentes de assinatura</h3>
          <div className="space-y-2">
            {pendentes.map((d) => (
              <DocCard key={d.id} doc={d} colabNome={colaboradorNome} colabCelular={celEdit} colaboradorId={colaboradorId} onCelularUpdated={setCelEdit} />
            ))}
          </div>
        </div>
      )}

      {/* Assinados */}
      {assinados.length > 0 && (
        <div>
          <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-400 mb-2">Assinados</h3>
          <div className="space-y-2">
            {assinados.map((d) => (
              <DocCard key={d.id} doc={d} colabNome={colaboradorNome} colabCelular={celEdit} colaboradorId={colaboradorId} onCelularUpdated={setCelEdit} />
            ))}
          </div>
        </div>
      )}

      {all.length === 0 && csDocs.length === 0 && (
        <Card className="p-12 text-center">
          <FileText size={32} className="mx-auto text-muted-foreground mb-3" />
          <div className="font-semibold mb-1.5">Nenhum documento</div>
          <p className="text-xs text-muted-foreground">
            Use o botão "Enviar documento" pra mandar advertência, contrato, NR ou outro modelo.
          </p>
        </Card>
      )}

      {/* Seção dedicada aos documentos via Clicksign */}
      {csDocs.length > 0 && (
        <ClicksignSection docs={csDocs} loading={csLoading} onReload={reloadCS} colabNome={colaboradorNome} />
      )}

      {showEnviar && !modeloEscolhido && (
        <ModeloPickerModal onClose={() => setShowEnviar(false)} onPick={setModeloEscolhido} />
      )}
      {modeloEscolhido && (
        <EmitirModal
          modelo={modeloEscolhido as any}
          colaboradorIdInicial={colaboradorId}
          onClose={() => { setModeloEscolhido(null); setShowEnviar(false); }}
          onEmitted={() => { setModeloEscolhido(null); setShowEnviar(false); reload(); }}
        />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────
// ClicksignSection — documentos enviados pra assinatura jurídica externa
// ─────────────────────────────────────────────────

function ClicksignSection({ docs, loading, onReload, colabNome }: {
  docs: any[]; loading: boolean; onReload: () => void; colabNome: string;
}) {
  // Agrupa por lote_id
  const lotes = useMemo(() => {
    const map = new Map<string, any[]>();
    for (const d of docs) {
      const k = d.lote_id || `_${d.id}`;
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(d);
    }
    return Array.from(map.entries()).map(([k, items]) => ({
      key: k, items,
      titulo: items[0]?.lote_titulo || (items[0]?.titulo || "").split(" — ")[0] || items[0]?.titulo,
      quando: items.reduce((m, x) => x.created_at < m ? x.created_at : m, items[0]?.created_at || ""),
    })).sort((a, b) => (b.quando || "").localeCompare(a.quando || ""));
  }, [docs]);

  const [syncing, setSyncing] = useState(false);
  const syncManual = async () => {
    setSyncing(true);
    try { await fetch("/api/clicksign/sync-all", { method: "POST" }); onReload(); }
    finally { setSyncing(false); }
  };

  const labelStatus = (s: string) => {
    if (s === "assinado") return { variant: "success", icon: CheckCircle2, label: "Assinado" };
    if (s === "visualizado") return { variant: "outline", icon: Eye, label: "Visualizado" };
    if (s === "recusado") return { variant: "outline", icon: AlertTriangle, label: "Recusado" };
    if (s === "cancelado" || s === "expirado") return { variant: "outline", icon: AlertTriangle, label: s };
    return { variant: "warning", icon: AlertTriangle, label: "Aguardando" };
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-xs font-bold uppercase tracking-wider text-blue-400 flex items-center gap-1.5">
          <span className="text-[10px] px-1.5 py-0.5 bg-blue-500/15 border border-blue-500/40 rounded">CLICKSIGN</span>
          Assinaturas via plataforma externa
        </h3>
        <Button size="sm" variant="outline" onClick={syncManual} disabled={syncing}>
          {syncing ? <Loader2 size={11} className="animate-spin" /> : <RefreshCw size={11} />}
          Atualizar status
        </Button>
      </div>
      {loading && <div className="text-xs text-muted-foreground p-4">Carregando…</div>}
      <div className="space-y-2">
        {lotes.map((lote) => {
          const assinados = lote.items.filter((d: any) => d.status === "assinado").length;
          const pct = lote.items.length > 0 ? Math.round((assinados / lote.items.length) * 100) : 0;
          return (
            <Card key={lote.key} className="overflow-hidden">
              <div className="p-3 border-b border-border bg-secondary/30">
                <div className="flex items-center gap-2 flex-wrap">
                  <FileText size={14} className="text-blue-400" />
                  <div className="text-sm font-semibold flex-1 truncate">{lote.titulo}</div>
                  <Badge variant="outline" className="text-[10px]">{lote.items.length} doc{lote.items.length !== 1 ? "s" : ""}</Badge>
                  <Badge variant="outline" className="text-[10px]">{assinados}/{lote.items.length} assinados</Badge>
                  <span className="text-[10px] text-muted-foreground">{fmtDate(lote.quando)}</span>
                </div>
                <div className="mt-2 h-1 bg-secondary rounded overflow-hidden">
                  <div className="h-full bg-emerald-500 transition-all" style={{ width: `${pct}%` }} />
                </div>
              </div>
              <div className="divide-y divide-border">
                {lote.items.map((d: any) => {
                  const s = labelStatus(d.status);
                  // Backend faz fallback on-demand se o PDF ainda não foi cacheado.
                  const pdfUrl = d.status === "assinado"
                    ? `/api/clicksign/envios/${d.id}/pdf-assinado` : null;
                  const auths = (d.auth_methods || []).join(", ");
                  return (
                    <div key={d.id} className="p-3 flex items-start justify-between gap-3 hover:bg-secondary/30">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-medium truncate">{d.titulo}</span>
                          <Badge variant={s.variant as any} className="text-[10px]">
                            <s.icon size={10} className="inline mr-1" /> {s.label}
                          </Badge>
                        </div>
                        <div className="text-[10px] text-muted-foreground mt-0.5 space-x-2">
                          {d.clicksign_enviado_em && <span>📤 enviado {fmtDate(d.clicksign_enviado_em)}</span>}
                          {d.clicksign_visualizado_em && <span className="text-blue-400">👁 visto {fmtDate(d.clicksign_visualizado_em)}</span>}
                          {d.clicksign_assinado_em && <span className="text-emerald-400">✓ assinado {fmtDate(d.clicksign_assinado_em)}</span>}
                          {auths && <span>· auth: {auths}</span>}
                        </div>
                      </div>
                      <div className="flex gap-1.5 shrink-0">
                        {pdfUrl && (
                          <a href={pdfUrl} target="_blank" rel="noopener noreferrer">
                            <Button size="sm" variant="outline" title="Baixar PDF assinado com certificado">
                              <Download size={11} /> PDF assinado
                            </Button>
                          </a>
                        )}
                        {!pdfUrl && d.clicksign_signer_url && d.status !== "assinado" && (
                          <>
                            <a href={d.clicksign_signer_url} target="_blank" rel="noopener noreferrer">
                              <Button size="sm" variant="outline" title="Abrir link de assinatura">
                                <ExternalLink size={11} /> Assinar
                              </Button>
                            </a>
                            <Button size="sm" variant="outline" title="Copiar link"
                              onClick={() => navigator.clipboard.writeText(d.clicksign_signer_url)}>
                              <Copy size={11} />
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>
          );
        })}
      </div>
      <div className="text-[10px] text-muted-foreground mt-2 px-1">
        Os PDFs assinados incluem o <strong>certificado Clicksign</strong> com todos os métodos de autenticação registrados, IP, timestamp e hash de integridade.
      </div>
    </div>
  );
}


function ModeloPickerModal({ onClose, onPick }: { onClose: () => void; onPick: (m: Modelo) => void }) {
  const [modelos, setModelos] = useState<Modelo[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    supabase.from("modelos_documento").select("*").eq("ativo", true).order("ordem")
      .then(({ data }) => {
        setModelos((data || []) as Modelo[]);
        setLoading(false);
      });
  }, []);

  const filtered = modelos.filter((m) =>
    m.titulo.toLowerCase().includes(search.toLowerCase()) ||
    m.categoria.toLowerCase().includes(search.toLowerCase()),
  );
  const grouped: Record<string, Modelo[]> = {};
  filtered.forEach((m) => {
    grouped[m.categoria] = grouped[m.categoria] || [];
    grouped[m.categoria].push(m);
  });

  const CAT_LABEL: Record<string, string> = {
    advertencia: "Advertências / Suspensão",
    contrato: "Contratos",
    termo: "Termos",
    nr: "NRs (treinamentos)",
    rescisao: "Rescisão",
    ficha: "Fichas",
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <Card className="w-full max-w-2xl max-h-[85vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="p-4 border-b border-border">
          <div className="text-base font-semibold mb-1">Escolha o modelo de documento</div>
          <input value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar modelo…"
            className="w-full h-9 mt-2 bg-input border border-border rounded-md text-sm px-3 outline-none" />
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {loading && <div className="text-center text-sm text-muted-foreground py-6"><Loader2 size={14} className="animate-spin inline mr-2" /> Carregando…</div>}
          {!loading && Object.keys(grouped).length === 0 && (
            <div className="text-center text-sm text-muted-foreground py-6">Nenhum modelo encontrado.</div>
          )}
          {!loading && Object.keys(grouped).map((cat) => (
            <div key={cat}>
              <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">
                {CAT_LABEL[cat] || cat}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {grouped[cat].map((m) => (
                  <button key={m.id} onClick={() => onPick(m)}
                    className="text-left p-3 border border-border rounded hover:bg-secondary/50 transition">
                    <div className="text-sm font-medium">{m.titulo}</div>
                    <div className="text-[10px] text-muted-foreground mt-0.5">
                      {(m.campos || []).length} campo{(m.campos || []).length !== 1 ? "s" : ""}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

function DocCard({ doc, colabNome, colabCelular, colaboradorId, onCelularUpdated }: {
  doc: DocItem; colabNome: string; colabCelular: string | null;
  colaboradorId: string; onCelularUpdated: (cel: string) => void;
}) {
  const [copied, setCopied] = useState(false);
  const [legadoUrl, setLegadoUrl] = useState<string | null>(null);
  useEffect(() => {
    if (doc.legado_origem && (doc as any).legado_pdf_path) {
      supabase.storage.from("rh-documentos")
        .createSignedUrl((doc as any).legado_pdf_path, 3600)
        .then(({ data }) => { if (data?.signedUrl) setLegadoUrl(data.signedUrl); });
    }
  }, [doc]);
  const link = doc.legado_origem
    ? legadoUrl
    : doc.token
    ? (doc.tipo === "admissao_form"
        ? `${window.location.origin}/admissao/${doc.token}`
        : `${window.location.origin}/assinar/${doc.token}`)
    : null;

  const copy = async () => {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {}
  };

  const tel = (doc.telefone || colabCelular || "").replace(/\D/g, "");
  const firstName = colabNome.split(" ")[0];
  const empresa = doc.empresa_nome || doc.empresa_razao || "Parket";
  const msg = `Oi ${firstName}! Aqui é da ${empresa}. Você tem um documento aguardando assinatura:\n\n${doc.titulo}${link ? `\n\n👉 ${link}` : ""}\n\nLeva uns 10 minutos. Qualquer dúvida me chama.`;
  const mailHref = doc.email && link
    ? `mailto:${doc.email}?subject=${encodeURIComponent("Pendente: " + doc.titulo)}&body=${encodeURIComponent(msg)}`
    : null;

  const [sending, setSending] = useState(false);
  const sendWhats = async () => {
    if (!link) return;
    let phone = tel;
    if (!phone) {
      const input = window.prompt(`Cadastrar celular de ${colabNome.split(" ")[0]} (com DDD):`, "");
      if (!input) return;
      const digits = input.replace(/\D/g, "");
      if (digits.length < 10) { alert("Número inválido. Use DDD + número (ex: 11999998888)."); return; }
      const { error } = await supabase.from("colaboradores").update({ celular: digits }).eq("id", colaboradorId);
      if (error) { alert("Erro ao salvar: " + error.message); return; }
      phone = digits;
      onCelularUpdated(digits);
    }
    setSending(true);
    const res = await sendWhatsAppViaAgent({
      telefone: phone, mensagem: msg, colaborador_id: colaboradorId, documento_id: doc.id,
    });
    setSending(false);
    if (res.ok) alert("✓ Enviado pelo Agente RH no WhatsApp");
    else alert("Erro ao enviar: " + (res.error || "desconhecido"));
  };

  const statusBadge = doc.status === "assinado"
    ? <Badge variant="success" className="text-[10px]"><CheckCircle2 size={10} className="inline mr-1" />Assinado</Badge>
    : doc.status === "cancelado"
    ? <Badge variant="outline" className="text-[10px]">Cancelado</Badge>
    : <Badge variant="warning" className="text-[10px]"><AlertTriangle size={10} className="inline mr-1" />Pendente</Badge>;

  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <FileText size={14} className="text-muted-foreground" />
            <div className="text-sm font-semibold">{doc.titulo}</div>
            {statusBadge}
          </div>
          <div className="text-xs text-muted-foreground space-y-0.5">
            <div>Criado em {fmtDate(doc.criado_em)}</div>
            {doc.assinado_em && <div className="text-emerald-400">Assinado em {fmtDate(doc.assinado_em)}</div>}
            {doc.preenchido_em && doc.status !== "assinado" && (
              <div>Formulário preenchido em {fmtDate(doc.preenchido_em)}</div>
            )}
            {doc.expira_em && doc.status === "pendente" && (
              <div className="text-amber-400">Expira em {fmtDate(doc.expira_em)}</div>
            )}
          </div>
        </div>
      </div>

      {doc.status === "assinado" && link && (
        <div className="mt-3 pt-3 border-t border-border">
          <div className="flex gap-2 flex-wrap">
            <a href={link} target="_blank" rel="noopener noreferrer">
              <Button size="sm" variant="outline"><Eye size={12} /> Ver</Button>
            </a>
            <a href={link} download>
              <Button size="sm" variant="outline"><Download size={12} /> Baixar</Button>
            </a>
            {!doc.legado_origem && (
              <Button size="sm" variant="outline" onClick={copy}>
                {copied ? <CheckCircle2 size={12} /> : <Copy size={12} />} {copied ? "Copiado" : "Copiar link"}
              </Button>
            )}
            {doc.legado_origem && (
              <Badge variant="outline" className="text-[10px] ml-auto">📁 Documento histórico</Badge>
            )}
          </div>
        </div>
      )}

      {doc.status === "pendente" && link && (
        <div className="mt-3 pt-3 border-t border-border space-y-2">
          <div className="flex gap-2 flex-wrap">
            <Button size="sm" onClick={sendWhats} disabled={sending}
              className={tel ? "bg-emerald-600 hover:bg-emerald-700 text-white" : "bg-amber-600 hover:bg-amber-700 text-white"}>
              {sending ? <Loader2 size={12} className="animate-spin" /> : <MessageCircle size={12} />}
              {sending ? "Enviando…" : tel ? "Enviar pelo Agente RH" : "Cadastrar celular e enviar"}
            </Button>
            {mailHref && (
              <a href={mailHref}>
                <Button size="sm" variant="outline">
                  <Mail size={12} /> Email
                </Button>
              </a>
            )}
            <Button size="sm" variant="outline" onClick={copy}>
              {copied ? <CheckCircle2 size={12} /> : <Copy size={12} />}
              {copied ? "Copiado!" : "Copiar link"}
            </Button>
            <a href={link} target="_blank" rel="noopener noreferrer">
              <Button size="sm" variant="outline">
                <Link2 size={12} /> Abrir
              </Button>
            </a>
          </div>
        </div>
      )}
    </Card>
  );
}


// ─────────────────────────────────────────────────
// HOLERITES — lista holerites do colaborador
// ─────────────────────────────────────────────────

function HoleritesTab({ colaboradorId, colaboradorNome }: { colaboradorId: string; colaboradorNome: string }) {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/holerites/colaborador/${colaboradorId}`)
      .then((r) => r.json())
      .then((j) => setItems(j.items || []))
      .finally(() => setLoading(false));
  }, [colaboradorId]);

  if (loading) return (
    <Card className="p-8 flex items-center justify-center gap-2 text-sm text-muted-foreground">
      <Loader2 size={14} className="animate-spin" /> Carregando holerites…
    </Card>
  );

  if (items.length === 0) return (
    <Card className="p-12 text-center">
      <Receipt size={32} className="mx-auto text-muted-foreground mb-3" />
      <div className="font-semibold mb-1.5">Nenhum holerite ainda</div>
      <p className="text-xs text-muted-foreground">
        Faça upload em <Link to="/holerites" className="text-primary hover:underline">/holerites</Link> — sistema separa por CPF.
      </p>
    </Card>
  );

  // Agrupa por ano
  const byYear: Record<string, any[]> = {};
  items.forEach((h) => {
    const comp = h.competencia?.competencia || "0000-00";
    const ano = comp.slice(0, 4);
    (byYear[ano] = byYear[ano] || []).push(h);
  });

  return (
    <div className="space-y-4">
      <div className="text-xs text-muted-foreground">{items.length} holerite{items.length !== 1 ? "s" : ""} de {colaboradorNome.split(" ")[0]}</div>
      {Object.keys(byYear).sort().reverse().map((ano) => (
        <Card key={ano} className="p-4">
          <div className="text-xs uppercase tracking-wider font-semibold text-muted-foreground mb-2">{ano} · {byYear[ano].length}</div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            {byYear[ano].sort((a, b) => (b.competencia?.competencia || "").localeCompare(a.competencia?.competencia || "")).map((h) => (
              <a key={h.id} href={`/api/holerites/${h.id}/pdf`} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-2 p-3 border border-border rounded hover:bg-secondary/30 hover:border-primary transition">
                <Receipt size={14} className="text-muted-foreground" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold">{h.competencia?.competencia || "—"}</div>
                  <div className="text-[10px] text-muted-foreground">
                    {h.competencia?.tipo || "mensal"}
                    {h.liquido != null && ` · R$ ${Number(h.liquido).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`}
                  </div>
                </div>
                <Download size={12} className="text-muted-foreground" />
              </a>
            ))}
          </div>
        </Card>
      ))}
    </div>
  );
}


// ─────────────────────────────────────────────────
// TREINAMENTOS — lista treinamentos do colaborador
// ─────────────────────────────────────────────────

function TreinamentosTab({ colaboradorId, colaboradorNome }: { colaboradorId: string; colaboradorNome: string }) {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data: ct } = await supabase.from("colaborador_treinamentos")
        .select("*").eq("colaborador_id", colaboradorId).order("data_conclusao", { ascending: false });
      const trIds = Array.from(new Set((ct || []).map((x: any) => x.treinamento_id)));
      const { data: tr } = trIds.length > 0
        ? await supabase.from("treinamentos_catalogo").select("id,nome,categoria,carga_horaria,valida_dias").in("id", trIds)
        : { data: [] };
      const trMap = new Map((tr || []).map((t: any) => [t.id, t]));
      setItems((ct || []).map((x: any) => ({ ...x, treinamento: trMap.get(x.treinamento_id) })));
      setLoading(false);
    })();
  }, [colaboradorId]);

  if (loading) return (
    <Card className="p-8 flex items-center justify-center gap-2 text-sm text-muted-foreground">
      <Loader2 size={14} className="animate-spin" /> Carregando…
    </Card>
  );

  if (items.length === 0) return (
    <Card className="p-12 text-center">
      <GraduationCap size={32} className="mx-auto text-muted-foreground mb-3" />
      <div className="font-semibold mb-1.5">Nenhum treinamento registrado</div>
      <p className="text-xs text-muted-foreground">
        Registre conclusões em <Link to="/treinamentos" className="text-primary hover:underline">/treinamentos</Link>.
      </p>
    </Card>
  );

  const concluidos = items.filter((x) => x.status === "concluido");
  const vencidos = items.filter((x) => x.data_validade && new Date(x.data_validade) < new Date());

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <Card className="p-3">
          <div className="text-[10px] uppercase text-muted-foreground">Concluídos</div>
          <div className="text-2xl font-bold mt-1 text-emerald-400">{concluidos.length}</div>
        </Card>
        <Card className="p-3">
          <div className="text-[10px] uppercase text-muted-foreground">Vencidos</div>
          <div className="text-2xl font-bold mt-1 text-rose-400">{vencidos.length}</div>
        </Card>
        <Card className="p-3">
          <div className="text-[10px] uppercase text-muted-foreground">Carga horária total</div>
          <div className="text-2xl font-bold mt-1">{concluidos.reduce((s, x) => s + Number(x.treinamento?.carga_horaria || 0), 0)}h</div>
        </Card>
      </div>
      <Card className="overflow-hidden">
        <div className="divide-y divide-border">
          {items.map((x) => {
            const vencido = x.data_validade && new Date(x.data_validade) < new Date();
            const certUrl = x.certificado_storage_path
              ? supabase.storage.from("rh-treinamentos").getPublicUrl(x.certificado_storage_path).data.publicUrl
              : null;
            return (
              <div key={x.id} className="p-3 flex items-center gap-3">
                <Award size={14} className="text-muted-foreground shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-semibold">{x.treinamento?.nome || "—"}</span>
                    {x.treinamento?.categoria && <Badge variant="outline" className="text-[10px]">{x.treinamento.categoria}</Badge>}
                    {vencido ? (
                      <Badge variant="outline" className="text-[10px] text-rose-400">Vencido</Badge>
                    ) : x.status === "concluido" ? (
                      <Badge variant="success" className="text-[10px]">Concluído</Badge>
                    ) : (
                      <Badge variant="outline" className="text-[10px]">{x.status}</Badge>
                    )}
                  </div>
                  <div className="text-[10px] text-muted-foreground mt-0.5">
                    {x.data_conclusao && `Concluído em ${fmtDate(x.data_conclusao)}`}
                    {x.data_validade && ` · Validade ${fmtDate(x.data_validade)}`}
                    {x.nota != null && ` · Nota ${x.nota}`}
                    {x.treinamento?.carga_horaria && ` · ${x.treinamento.carga_horaria}h`}
                  </div>
                </div>
                {certUrl && (
                  <a href={certUrl} target="_blank" rel="noopener noreferrer">
                    <Button size="sm" variant="outline"><Download size={11} /> Certificado</Button>
                  </a>
                )}
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}
