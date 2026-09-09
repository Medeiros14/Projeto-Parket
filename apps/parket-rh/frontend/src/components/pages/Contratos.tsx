/**
 * Contratos — gestão completa de contratos de trabalho.
 *
 * Tabs:
 *   - Gestão: lista contratos por colaborador/empresa, filtros, status
 *   - Enviar pra assinar: modelos categoria=contrato + envio Clicksign em massa
 *   - Novo (Admissão): atalho pro wizard /admissoes/novo + atalho pra envio multi-doc
 */
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ClipboardCheck, Search, Plus, Send, Loader2, FileText, Users as UsersIcon,
  Building, Briefcase, Calendar, ChevronRight, CheckCircle2, AlertTriangle,
  UserPlus, ExternalLink, Filter, Mail, MessageCircle,
} from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Input } from "@/components/ui/Input";
import { supabase } from "@/lib/supabase";
import { useFetch, api, clicksign } from "@/lib/api";
import { fmtCPF, fmtDate } from "@/lib/format";

type Contrato = {
  id: string;
  colaborador_id: string;
  empresa_id: string;
  cargo_id: string | null;
  departamento_id: string | null;
  salario_base: string | null;
  data_admissao: string;
  data_demissao: string | null;
  data_fim_periodo_experiencia: string | null;
  primeiro_termino_experiencia: string | null;
  segundo_termino_experiencia: string | null;
  status: string;
  tipo_contrato: string | null;
  vinculo: string | null;
  matricula: string | null;
};

export function ContratosPage() {
  const [tab, setTab] = useState<"gestao" | "envios" | "novo">("gestao");

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <ClipboardCheck size={22} /> Contratos
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Gerencie contratos de trabalho — CLT, PJ, aditivos. Envio pra assinatura via Clicksign.
          </p>
        </div>
      </div>

      <div className="flex gap-2 border-b border-border">
        {[
          { key: "gestao", label: "Gestão", icon: ClipboardCheck },
          { key: "envios", label: "Enviar pra assinar", icon: Send },
          { key: "novo", label: "Novo / Admissão", icon: UserPlus },
        ].map((t) => (
          <button key={t.key} onClick={() => setTab(t.key as any)}
            className={`px-4 py-2 text-sm font-semibold border-b-2 transition flex items-center gap-1.5 ${
              tab === t.key ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"
            }`}>
            <t.icon size={14} /> {t.label}
          </button>
        ))}
      </div>

      {tab === "gestao" && <GestaoTab />}
      {tab === "envios" && <EnviosTab />}
      {tab === "novo" && <NovoTab />}
    </div>
  );
}

// ─────────────────────────────────────────────────
// GESTÃO — lista de contratos com filtros
// ─────────────────────────────────────────────────

function GestaoTab() {
  const [contratos, setContratos] = useState<Contrato[]>([]);
  const [loading, setLoading] = useState(true);
  const colabs = useFetch(() => api.colaboradores(), []);
  const empresas = useFetch(() => api.empresas(), []);
  const cargos = useFetch(() => api.cargos(), []);
  const departamentos = useFetch(() => api.departamentos(), []);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ativo");
  const [empresaFilter, setEmpresaFilter] = useState("");
  const [tipoFilter, setTipoFilter] = useState("");

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data } = await supabase.from("contratos")
        .select("*").is("deleted_at", null)
        .order("data_admissao", { ascending: false });
      setContratos((data || []) as Contrato[]);
      setLoading(false);
    })();
  }, []);

  const colabMap = useMemo(() => new Map((colabs.data || []).map((c) => [c.id, c])), [colabs.data]);
  const empresaMap = useMemo(() => new Map((empresas.data || []).map((e) => [e.id, e])), [empresas.data]);
  const cargoMap = useMemo(() => new Map((cargos.data || []).map((c) => [c.id, c])), [cargos.data]);
  const deptMap = useMemo(() => new Map((departamentos.data || []).map((d: any) => [d.id, d])), [departamentos.data]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return contratos.filter((c) => {
      if (statusFilter && c.status !== statusFilter) return false;
      if (empresaFilter && c.empresa_id !== empresaFilter) return false;
      if (tipoFilter && c.tipo_contrato !== tipoFilter) return false;
      if (q) {
        const colab = colabMap.get(c.colaborador_id);
        const hit = (colab?.nome || "").toLowerCase().includes(q) ||
                    (colab?.cpf || "").includes(q) ||
                    (c.matricula || "").toLowerCase().includes(q);
        if (!hit) return false;
      }
      return true;
    });
  }, [contratos, search, statusFilter, empresaFilter, tipoFilter, colabMap]);

  const stats = useMemo(() => ({
    total: contratos.filter((c) => c.status === "ativo").length,
    clt: contratos.filter((c) => c.status === "ativo" && c.tipo_contrato === "CLT").length,
    pj: contratos.filter((c) => c.status === "ativo" && c.tipo_contrato === "PJ").length,
    experiencia: contratos.filter((c) => {
      if (c.status !== "ativo") return false;
      const fim = c.data_fim_periodo_experiencia || c.segundo_termino_experiencia;
      if (!fim) return false;
      const dt = new Date(fim);
      const hoje = new Date();
      const em30 = new Date(hoje.getTime() + 30 * 24 * 60 * 60 * 1000);
      return dt >= hoje && dt <= em30;
    }).length,
  }), [contratos]);

  if (loading) {
    return <div className="flex items-center gap-2 text-sm text-muted-foreground p-8 justify-center">
      <Loader2 size={14} className="animate-spin" /> Carregando contratos…
    </div>;
  }

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatBox label="Ativos" valor={stats.total} icon={CheckCircle2} color="text-emerald-400" />
        <StatBox label="CLT" valor={stats.clt} icon={ClipboardCheck} />
        <StatBox label="PJ" valor={stats.pj} icon={Briefcase} />
        <StatBox label="Experiência vence em 30d" valor={stats.experiencia} icon={AlertTriangle} color="text-amber-400" />
      </div>

      {/* Filtros */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[240px] max-w-md">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Nome, CPF ou matrícula…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
          className="h-9 bg-input border border-border rounded-md text-xs px-3">
          <option value="">Todos status</option>
          <option value="ativo">Ativos</option>
          <option value="desligado">Desligados</option>
          <option value="afastado">Afastados</option>
        </select>
        <select value={empresaFilter} onChange={(e) => setEmpresaFilter(e.target.value)}
          className="h-9 bg-input border border-border rounded-md text-xs px-3">
          <option value="">Todas empresas</option>
          {(empresas.data || []).map((e) => (
            <option key={e.id} value={e.id}>{e.nome_fantasia || e.razao_social}</option>
          ))}
        </select>
        <select value={tipoFilter} onChange={(e) => setTipoFilter(e.target.value)}
          className="h-9 bg-input border border-border rounded-md text-xs px-3">
          <option value="">Todos tipos</option>
          <option value="CLT">CLT</option>
          <option value="PJ">PJ</option>
          <option value="Estagio">Estágio</option>
          <option value="Temporario">Temporário</option>
        </select>
      </div>

      <Card className="overflow-hidden">
        <div className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground px-4 py-2 border-b border-border bg-secondary/30">
          {filtered.length} contrato{filtered.length !== 1 ? "s" : ""}
        </div>
        <div className="divide-y divide-border">
          {filtered.map((c) => {
            const colab = colabMap.get(c.colaborador_id);
            const emp = empresaMap.get(c.empresa_id);
            const cargo = c.cargo_id ? cargoMap.get(c.cargo_id) : null;
            const dept = c.departamento_id ? deptMap.get(c.departamento_id) : null;
            const fimExp = c.data_fim_periodo_experiencia || c.segundo_termino_experiencia;
            const inExperiencia = fimExp && new Date(fimExp) > new Date();
            return (
              <Link to={`/colaboradores/${c.colaborador_id}`} key={c.id}
                className="flex items-center gap-3 px-4 py-3 hover:bg-secondary/30 transition">
                <ClipboardCheck size={16} className="text-muted-foreground shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <div className="text-sm font-semibold truncate">{colab?.nome || "—"}</div>
                    <Badge variant="outline" className="text-[10px]">{c.tipo_contrato || "—"}</Badge>
                    {c.status === "ativo" ? (
                      <Badge variant="success" className="text-[10px]">Ativo</Badge>
                    ) : c.status === "desligado" ? (
                      <Badge variant="outline" className="text-[10px] text-rose-400">Desligado</Badge>
                    ) : (
                      <Badge variant="outline" className="text-[10px]">{c.status}</Badge>
                    )}
                    {inExperiencia && (
                      <Badge variant="outline" className="text-[10px] text-amber-400 border-amber-500/40">
                        Experiência até {fmtDate(fimExp!)}
                      </Badge>
                    )}
                  </div>
                  <div className="text-[10px] text-muted-foreground mt-0.5">
                    {colab?.cpf && `CPF ${fmtCPF(colab.cpf)} · `}
                    {cargo?.nome && `${cargo.nome}`}
                    {dept?.nome && ` · ${dept.nome}`}
                    {emp && ` · ${emp.nome_fantasia || emp.razao_social}`}
                    {c.data_admissao && ` · Admitido em ${fmtDate(c.data_admissao)}`}
                    {c.salario_base && ` · R$ ${Number(c.salario_base).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`}
                  </div>
                </div>
                <ChevronRight size={14} className="text-muted-foreground shrink-0" />
              </Link>
            );
          })}
          {filtered.length === 0 && (
            <div className="p-12 text-center text-sm text-muted-foreground">
              Nenhum contrato no filtro
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}

// ─────────────────────────────────────────────────
// ENVIOS — enviar contratos pra assinar via Clicksign
// ─────────────────────────────────────────────────

type Modelo = {
  id: string; tipo: string; variante: string | null; titulo: string;
  categoria: string; conteudo_html: string; campos: any;
};

function EnviosTab() {
  const [modelos, setModelos] = useState<Modelo[]>([]);
  const [modelosSel, setModelosSel] = useState<Set<string>>(new Set());
  const colabs = useFetch(() => api.colaboradoresAtivos(), []);
  const empresas = useFetch(() => api.empresas(), []);
  const contratos = useFetch(() => api.contratos(), []);
  const [colabsSel, setColabsSel] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [empresaFilter, setEmpresaFilter] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    supabase.from("modelos_documento")
      .select("*").eq("ativo", true).eq("categoria", "contrato").order("ordem")
      .then(({ data }) => setModelos((data || []) as Modelo[]));
  }, []);

  const contratoByColab = useMemo(() => {
    const m = new Map<string, any>();
    (contratos.data || []).forEach((c: any) => {
      if (c.status === "ativo") m.set(c.colaborador_id, c);
      else if (!m.has(c.colaborador_id)) m.set(c.colaborador_id, c);
    });
    return m;
  }, [contratos.data]);

  const colabsFilt = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (colabs.data || []).filter((c) => {
      const contr = contratoByColab.get(c.id);
      if (empresaFilter && contr?.empresa_id !== empresaFilter) return false;
      if (q && !c.nome.toLowerCase().includes(q) && !(c.cpf || "").includes(q)) return false;
      return true;
    });
  }, [colabs.data, search, empresaFilter, contratoByColab]);

  const toggleModelo = (id: string) => {
    const n = new Set(modelosSel); n.has(id) ? n.delete(id) : n.add(id); setModelosSel(n);
  };
  const toggleColab = (id: string) => {
    const n = new Set(colabsSel); n.has(id) ? n.delete(id) : n.add(id); setColabsSel(n);
  };
  const toggleAllColabs = () => {
    if (colabsSel.size === colabsFilt.length) setColabsSel(new Set());
    else setColabsSel(new Set(colabsFilt.map((c) => c.id)));
  };

  const enviar = async () => {
    if (modelosSel.size === 0) { setErr("Selecione ao menos 1 contrato"); return; }
    if (colabsSel.size === 0) { setErr("Selecione ao menos 1 colaborador"); return; }
    setEnviando(true); setErr(null); setResult(null);
    try {
      const r = await clicksign.enviar({
        modelo_ids: Array.from(modelosSel),
        colaborador_ids: Array.from(colabsSel),
        campos_extras: {
          cidade: "São Paulo",
          data: new Date().toISOString().slice(0, 10),
        },
        enviar_whatsapp: true,
        auth_methods: ["email"],
        lote_titulo: `Contratos ${new Date().toLocaleDateString("pt-BR")}`,
        incluir_testemunha: true,
      });
      setResult(r);
    } catch (e: any) {
      setErr(`Erro: ${e?.message?.slice(0, 300) || e}`);
    } finally {
      setEnviando(false);
    }
  };

  const totalEnv = modelosSel.size * colabsSel.size;

  return (
    <div className="grid grid-cols-3 gap-4">
      {/* Modelos contrato */}
      <Card className="p-4 space-y-3">
        <div className="text-xs uppercase font-semibold tracking-wider text-muted-foreground">
          1. Contratos a enviar · {modelosSel.size} selecionado{modelosSel.size !== 1 ? "s" : ""}
        </div>
        {modelos.length === 0 ? (
          <div className="text-xs text-muted-foreground p-6 text-center">
            Nenhum modelo cadastrado em "contrato". Cadastre em <Link to="/configuracoes" className="text-primary hover:underline">Configurações</Link>.
          </div>
        ) : (
          <div className="space-y-1 max-h-[60vh] overflow-y-auto">
            {modelos.map((m) => {
              const on = modelosSel.has(m.id);
              return (
                <label key={m.id} className={`flex items-start gap-2 p-2 rounded text-xs cursor-pointer ${on ? "bg-primary/10 border border-primary/40" : "hover:bg-secondary/30 border border-transparent"}`}>
                  <input type="checkbox" checked={on} onChange={() => toggleModelo(m.id)} className="mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold">{m.titulo}</div>
                    <div className="text-[10px] text-muted-foreground">
                      {m.tipo}{m.variante ? `/${m.variante}` : ""} · {(m.campos || []).length} campo{(m.campos || []).length !== 1 ? "s" : ""}
                    </div>
                  </div>
                </label>
              );
            })}
          </div>
        )}
      </Card>

      {/* Colaboradores */}
      <Card className="p-4 space-y-3">
        <div className="text-xs uppercase font-semibold tracking-wider text-muted-foreground">
          2. Colaboradores · {colabsSel.size} selecionado{colabsSel.size !== 1 ? "s" : ""}
        </div>
        <select value={empresaFilter} onChange={(e) => setEmpresaFilter(e.target.value)}
          className="w-full h-9 bg-input border border-border rounded-md text-xs px-3">
          <option value="">Todas empresas</option>
          {(empresas.data || []).map((e) => (
            <option key={e.id} value={e.id}>{e.nome_fantasia || e.razao_social}</option>
          ))}
        </select>
        <div className="flex gap-2">
          <Input placeholder="Nome ou CPF…" value={search} onChange={(e) => setSearch(e.target.value)} />
          <Button size="sm" variant="outline" onClick={toggleAllColabs}>
            {colabsSel.size === colabsFilt.length && colabsFilt.length > 0 ? "Limpar" : "Todos"}
          </Button>
        </div>
        <div className="text-[10px] text-muted-foreground">{colabsFilt.length} colaborador{colabsFilt.length !== 1 ? "es" : ""}</div>
        <div className="space-y-0.5 max-h-[55vh] overflow-y-auto border border-border rounded">
          {colabsFilt.map((c) => {
            const on = colabsSel.has(c.id);
            return (
              <label key={c.id} className={`flex items-start gap-2 px-2 py-1.5 text-xs border-b border-border last:border-0 cursor-pointer ${on ? "bg-primary/10" : "hover:bg-secondary/30"}`}>
                <input type="checkbox" checked={on} onChange={() => toggleColab(c.id)} className="mt-0.5" />
                <div className="flex-1 min-w-0">
                  <div className="font-semibold truncate">{c.nome}</div>
                  <div className="text-[10px] text-muted-foreground">
                    {c.cpf && `CPF ${fmtCPF(c.cpf)}`}
                    {!(c.email_pessoal || c.email_profissional) && <span className="text-red-400"> · ✗ sem email</span>}
                  </div>
                </div>
              </label>
            );
          })}
        </div>
      </Card>

      {/* Resumo + envio */}
      <Card className="p-4 space-y-3">
        <div className="text-xs uppercase font-semibold tracking-wider text-muted-foreground">3. Confirmar envio</div>

        <div className="bg-secondary/40 p-3 rounded text-xs space-y-1">
          <div><span className="text-muted-foreground">Contratos selecionados:</span> {modelosSel.size}</div>
          <div><span className="text-muted-foreground">Colaboradores selecionados:</span> {colabsSel.size}</div>
          <div className="pt-1 border-t border-border">
            <span className="font-semibold">{totalEnv} envelope{totalEnv !== 1 ? "s" : ""} no Clicksign</span>
            <div className="text-[10px] text-muted-foreground">
              Cada colaborador recebe 1 email + 1 WhatsApp com os {modelosSel.size > 1 ? "contratos juntos" : "contrato"} pra assinar.
            </div>
          </div>
        </div>

        <div className="space-y-1 text-xs">
          <div className="text-muted-foreground">Autenticação: <Badge variant="outline" className="text-[10px]">Email</Badge></div>
          <div className="text-muted-foreground">WhatsApp: <Badge variant="success" className="text-[10px]">Ativo (RH)</Badge></div>
          <div className="text-muted-foreground">Dados auto: empresa + CNPJ + cargo do contrato ativo</div>
        </div>

        {err && <div className="text-xs text-red-400 p-2 bg-red-500/10 rounded">{err}</div>}

        {result && result.total_enviados > 0 && (
          <div className="text-xs text-emerald-300 p-2 bg-emerald-500/10 border border-emerald-500/40 rounded">
            ✅ {result.total_enviados} envelope{result.total_enviados !== 1 ? "s" : ""} enviado{result.total_enviados !== 1 ? "s" : ""}.
            {result.total_erros > 0 && <div>⚠ {result.total_erros} falha{result.total_erros !== 1 ? "s" : ""}</div>}
            <Link to="/documentos" className="block mt-1 text-primary hover:underline">→ Acompanhar status</Link>
          </div>
        )}
        {result && result.total_erros > 0 && result.erros && (
          <div className="text-xs text-amber-300 p-2 bg-amber-500/10 border border-amber-500/40 rounded max-h-32 overflow-y-auto">
            {result.erros.slice(0, 5).map((e: any, i: number) => (
              <div key={i} className="text-[10px]">{e.colaborador_nome}: {e.erro?.slice(0, 120)}</div>
            ))}
          </div>
        )}

        <Button onClick={enviar} disabled={totalEnv === 0 || enviando} className="w-full">
          {enviando && <Loader2 size={12} className="animate-spin" />}
          <Send size={12} /> {enviando ? "Enviando…" : `Enviar ${totalEnv || 0} pra assinar`}
        </Button>
      </Card>
    </div>
  );
}

// ─────────────────────────────────────────────────
// NOVO / ADMISSÃO — atalhos
// ─────────────────────────────────────────────────

function NovoTab() {
  const nav = useNavigate();
  const [colabsSem, setColabsSem] = useState<any[]>([]);
  const colabs = useFetch(() => api.colaboradores(), []);
  const contratos = useFetch(() => api.contratos(), []);

  useEffect(() => {
    if (!colabs.data || !contratos.data) return;
    const colabsComContrato = new Set((contratos.data || []).map((c: any) => c.colaborador_id));
    const sem = (colabs.data || []).filter((c) => !colabsComContrato.has(c.id));
    setColabsSem(sem);
  }, [colabs.data, contratos.data]);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <Card className="p-5 space-y-3">
        <div className="flex items-center gap-2">
          <UserPlus size={18} className="text-emerald-400" />
          <h2 className="text-base font-bold flex-1">Nova admissão</h2>
        </div>
        <div className="text-xs text-muted-foreground">
          Wizard guiado: cadastra o colaborador, gera contrato, manda link público pra ele preencher dados pessoais, e ao final dispara contratos + termos pra assinatura via Clicksign.
        </div>
        <Button onClick={() => nav("/admissoes/novo")} className="w-full">
          <UserPlus size={14} /> Abrir wizard de admissão
        </Button>
        <div className="pt-3 border-t border-border">
          <Link to="/admissoes" className="text-[11px] text-primary hover:underline flex items-center gap-1">
            <ExternalLink size={11} /> Todas as admissões em andamento
          </Link>
        </div>
      </Card>

      <Card className="p-5 space-y-3">
        <div className="flex items-center gap-2">
          <Send size={18} className="text-emerald-400" />
          <h2 className="text-base font-bold flex-1">Envio rápido em massa</h2>
        </div>
        <div className="text-xs text-muted-foreground">
          Mande o mesmo conjunto de contratos+termos pra vários colaboradores de uma vez (ex: pacote de admissão CLT, atualização de termo aditivo, etc.).
        </div>
        <Button onClick={() => nav("/documentos")} className="w-full" variant="outline">
          <FileText size={14} /> Ir pra Documentos (envio multi-doc)
        </Button>
      </Card>

      <Card className="p-5 space-y-3 md:col-span-2">
        <div className="flex items-center gap-2">
          <AlertTriangle size={18} className="text-amber-400" />
          <h2 className="text-base font-bold flex-1">Colaboradores sem contrato ativo</h2>
          <Badge variant="outline" className="text-[10px]">{colabsSem.length}</Badge>
        </div>
        {colabsSem.length === 0 ? (
          <div className="text-xs text-emerald-400">✓ Todos os colaboradores cadastrados têm contrato vinculado.</div>
        ) : (
          <div className="space-y-1 max-h-64 overflow-y-auto">
            {colabsSem.slice(0, 20).map((c) => (
              <Link key={c.id} to={`/colaboradores/${c.id}`}
                className="flex items-center gap-2 p-2 hover:bg-secondary/30 rounded text-xs">
                <UsersIcon size={12} className="text-muted-foreground" />
                <div className="flex-1">
                  <div className="font-semibold">{c.nome}</div>
                  {c.cpf && <div className="text-[10px] text-muted-foreground">CPF {fmtCPF(c.cpf)}</div>}
                </div>
                <ChevronRight size={12} className="text-muted-foreground" />
              </Link>
            ))}
            {colabsSem.length > 20 && (
              <div className="text-[10px] text-muted-foreground p-2 text-center">
                +{colabsSem.length - 20} outros…
              </div>
            )}
          </div>
        )}
      </Card>
    </div>
  );
}

function StatBox({ label, valor, icon: Icon, color }: { label: string; valor: number; icon: any; color?: string }) {
  return (
    <Card className="p-4">
      <div className="flex items-center gap-2">
        <Icon size={16} className={color || "text-muted-foreground"} />
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      </div>
      <div className="text-2xl font-bold mt-1">{valor.toLocaleString("pt-BR")}</div>
    </Card>
  );
}
