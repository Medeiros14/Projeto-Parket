/**
 * MuraisAdmin — lista de murais (RH cria/edita conteúdo + vê link público
 * + acompanha assinaturas).
 */
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Loader2, Plus, FileText, Eye, EyeOff, Copy, CheckCircle2, Send, Users, X, Search } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Input } from "@/components/ui/Input";
import { supabase, supabaseCore } from "@/lib/supabase";

type Mural = {
  id: string; slug: string; titulo: string; ativo: boolean;
  exige_assinatura: boolean; created_at: string; updated_at: string;
  template_whatsapp?: string | null;
};

export function MuraisAdminPage() {
  const [murais, setMurais] = useState<Mural[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const [counts, setCounts] = useState<Record<string, { total: number; assinados: number }>>({});
  const [broadcastMural, setBroadcastMural] = useState<Mural | null>(null);

  const reload = async () => {
    setLoading(true);
    const { data } = await supabase.from("murais").select("*").order("created_at", { ascending: false });
    const ms = (data || []) as Mural[];
    setMurais(ms);

    // Conta assinaturas por mural — usa o schema "rh"
    const ids = ms.map((m) => m.id);
    if (ids.length > 0) {
      const { data: docs } = await supabase
        .from("documentos_emitidos")
        .select("mural_id, status")
        .in("mural_id", ids);
      const c: Record<string, { total: number; assinados: number }> = {};
      (docs || []).forEach((d: any) => {
        if (!d.mural_id) return;
        if (!c[d.mural_id]) c[d.mural_id] = { total: 0, assinados: 0 };
        c[d.mural_id].total++;
        if (d.status === "assinado") c[d.mural_id].assinados++;
      });
      setCounts(c);
    }
    setLoading(false);
  };
  useEffect(() => { reload(); }, []);

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Murais</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Documentos públicos lidos e assinados via link — colaborador entra com nome+CPF.
          </p>
        </div>
        <Button onClick={() => setShowNew(true)}><Plus size={14} /> Novo mural</Button>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground p-12 justify-center">
          <Loader2 size={14} className="animate-spin" /> Carregando…
        </div>
      ) : murais.length === 0 ? (
        <Card className="p-12 text-center">
          <FileText size={32} className="mx-auto text-muted-foreground mb-3" />
          <div className="font-semibold mb-1">Nenhum mural cadastrado</div>
          <div className="text-sm text-muted-foreground">Crie o primeiro pra disponibilizar pros colaboradores.</div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {murais.map((m) => {
            const link = `${window.location.origin}/mural/${m.slug}`;
            const c = counts[m.id] || { total: 0, assinados: 0 };
            return (
              <Card key={m.id} className="p-4 hover:bg-secondary/30 transition">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold truncate">{m.titulo}</div>
                    <div className="text-[10px] text-muted-foreground mt-0.5">slug: {m.slug}</div>
                  </div>
                  {m.ativo ? <Badge variant="success" className="text-[10px]"><Eye size={10} className="mr-1" />Ativo</Badge>
                           : <Badge variant="outline" className="text-[10px]"><EyeOff size={10} className="mr-1" />Inativo</Badge>}
                </div>

                <div className="mt-3 text-[10px] text-muted-foreground">
                  {c.assinados} assinados · {c.total - c.assinados} pendentes · {c.total} acessos
                </div>

                <div className="mt-3 grid grid-cols-2 gap-2">
                  <Link to={`/murais/${m.slug}`}>
                    <Button size="sm" variant="outline" className="w-full">Editar / Acessos</Button>
                  </Link>
                  <CopyLinkBtn link={link} />
                </div>
                <Button
                  size="sm"
                  className="w-full mt-2"
                  onClick={() => setBroadcastMural(m)}
                >
                  <Send size={11} /> Disparar pelo agente
                </Button>
              </Card>
            );
          })}
        </div>
      )}

      {showNew && <NovoMuralModal onClose={() => setShowNew(false)} onSaved={() => { setShowNew(false); reload(); }} />}
      {broadcastMural && (
        <BroadcastModal mural={broadcastMural} onClose={() => setBroadcastMural(null)} />
      )}
    </div>
  );
}

// ─── Disparo em massa via agente.parket.works ───────────────────────
// Mensagem curta = teaser. O conteúdo completo fica no link do mural,
// onde o colaborador lê e assina. O link é apendado pelo backend.
const TEMPLATES = {
  treinamento_0406: {
    label: "📚 Treinamento – 04/06",
    msg: `📚 *Treinamento — 04/06*

Olá! Você está convocado(a) para o próximo treinamento obrigatório no dia *04/06*.

Acesse o link abaixo pra ver detalhes (local, horário e conteúdo programático) e *assinar a confirmação de ciência*.

⚠ Leitura e assinatura obrigatórias até a data do treinamento.`,
  },
  saude: {
    label: "🩺 Saúde Preventiva",
    msg: `🩺 *Lembrete – Saúde Preventiva*

A empresa reforça a importância dos cuidados preventivos com a saúde.

Acesse o link abaixo pra ler o comunicado completo e *assinar a ciência*.`,
  },
  generico: {
    label: "📢 Comunicado genérico",
    msg: `📢 *Comunicado interno – Parket RH*

Há um novo comunicado pra você.

Acesse o link abaixo pra ler e *assinar a ciência*.`,
  },
} as const;
type TemplateKey = keyof typeof TEMPLATES;
const TEMPLATE_DEFAULT: TemplateKey = "treinamento_0406";
const MSG_PADRAO_SAUDE = TEMPLATES[TEMPLATE_DEFAULT].msg;

interface ColabRow { id: string; nome: string; celular: string | null; cpf?: string | null; endereco_uf?: string | null; empresa_id?: string | null; }
interface EmpresaRow { id: string; razao_social: string; }
interface DeptRow { id: string; nome: string; }

// UF: aceita sigla ou nome completo → retorna sigla 2 letras
const UF_BY_NAME: Record<string, string> = {
  "ACRE": "AC", "ALAGOAS": "AL", "AMAPA": "AP", "AMAZONAS": "AM", "BAHIA": "BA",
  "CEARA": "CE", "DISTRITO FEDERAL": "DF", "ESPIRITO SANTO": "ES", "GOIAS": "GO",
  "MARANHAO": "MA", "MATO GROSSO": "MT", "MATO GROSSO DO SUL": "MS", "MINAS GERAIS": "MG",
  "PARA": "PA", "PARAIBA": "PB", "PARANA": "PR", "PERNAMBUCO": "PE", "PIAUI": "PI",
  "RIO DE JANEIRO": "RJ", "RIO GRANDE DO NORTE": "RN", "RIO GRANDE DO SUL": "RS",
  "RONDONIA": "RO", "RORAIMA": "RR", "SANTA CATARINA": "SC", "SAO PAULO": "SP",
  "SERGIPE": "SE", "TOCANTINS": "TO",
};
function normalizeUf(raw: string | null | undefined): string {
  if (!raw) return "";
  const s = raw.normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase().trim();
  if (s.length === 2) return s;
  return UF_BY_NAME[s] || "";
}

function BroadcastModal({ mural, onClose }: { mural: Mural; onClose: () => void }) {
  const [colabs, setColabs] = useState<ColabRow[]>([]);
  const [empresas, setEmpresas] = useState<EmpresaRow[]>([]);
  const [departamentos, setDepartamentos] = useState<DeptRow[]>([]);
  const [colabEmpresa, setColabEmpresa] = useState<Record<string, string>>({});
  const [empresaFilter, setEmpresaFilter] = useState<string>("");
  const [deptFilter, setDeptFilter] = useState<string>("");
  const [ufFilter, setUfFilter] = useState<string>("");
  const [search, setSearch] = useState<string>("");
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());
  // Mensagem: prioriza template salvo no banco pro mural. Senão usa o default.
  const [mensagem, setMensagem] = useState<string>(mural.template_whatsapp || MSG_PADRAO_SAUDE);
  const [savingTpl, setSavingTpl] = useState(false);
  const [savedTplOk, setSavedTplOk] = useState(false);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{ enviados: any[]; sem_telefone: any[]; falhas: any[]; queued?: boolean; com_celular?: number; estimativa_minutos?: number; delay_min_s?: number; delay_max_s?: number } | null>(null);
  // Velocidade do envio: "seguro" = devagar (anti-bloqueio), "normal", "rápido".
  // Recomendamos "seguro" pra qualquer broadcast > 20 pessoas.
  type Velocidade = "seguro" | "normal" | "rapido";
  const [velocidade, setVelocidade] = useState<Velocidade>("seguro");
  const VEL_DELAYS: Record<Velocidade, [number, number]> = {
    seguro: [15, 35], normal: [8, 18], rapido: [3, 8],
  };
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        // Empresas + departamentos vêm do schema core
        const [{ data: emp }, { data: dep }] = await Promise.all([
          supabaseCore.from("empresas").select("id, razao_social").order("razao_social"),
          supabaseCore.from("departamentos").select("id, nome").order("nome"),
        ]);
        setEmpresas((emp as EmpresaRow[]) || []);
        setDepartamentos((dep as DeptRow[]) || []);
        const [{ data: cs }, { data: ctrs }] = await Promise.all([
          supabase.from("colaboradores").select("id, nome, celular, cpf, endereco_uf").is("deleted_at", null).order("nome"),
          supabase.from("contratos").select("colaborador_id, empresa_id, status"),
        ]);
        // mapa colab → empresa (contrato ativo tem prioridade)
        const m: Record<string, string> = {};
        ((ctrs as any[]) || []).forEach((c) => {
          if (!m[c.colaborador_id] || c.status === "ativo") m[c.colaborador_id] = c.empresa_id;
        });
        setColabEmpresa(m);
        setColabs(((cs as any[]) || []).map((c) => ({
          id: c.id, nome: c.nome, celular: c.celular || null,
          cpf: c.cpf || null, endereco_uf: c.endereco_uf || null,
          empresa_id: m[c.id] || null,
        })));
      } catch (e: any) {
        setError(e.message || String(e));
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const filtered = useMemo(() => {
    let arr = colabs;
    if (empresaFilter) arr = arr.filter((c) => colabEmpresa[c.id] === empresaFilter);
    if (ufFilter) arr = arr.filter((c) => normalizeUf(c.endereco_uf) === ufFilter);
    if (search.trim()) {
      const s = search.trim().toLowerCase();
      arr = arr.filter((c) =>
        (c.nome || "").toLowerCase().includes(s) ||
        (c.cpf || "").includes(s)
      );
    }
    return arr;
  }, [colabs, empresaFilter, deptFilter, ufFilter, search, colabEmpresa]);

  // UFs disponíveis no conjunto atual (sem aplicar o próprio filtro UF)
  const ufList = useMemo(() => {
    const base = empresaFilter ? colabs.filter((c) => colabEmpresa[c.id] === empresaFilter) : colabs;
    const m: Record<string, number> = {};
    base.forEach((c) => {
      const uf = normalizeUf(c.endereco_uf);
      if (uf) m[uf] = (m[uf] || 0) + 1;
    });
    return Object.entries(m).sort((a, b) => b[1] - a[1]) as [string, number][];
  }, [colabs, empresaFilter, colabEmpresa]);

  const allSelected = filtered.length > 0 && filtered.every((c) => selecionados.has(c.id));

  const toggleAll = () => {
    if (allSelected) {
      const next = new Set(selecionados);
      filtered.forEach((c) => next.delete(c.id));
      setSelecionados(next);
    } else {
      const next = new Set(selecionados);
      filtered.forEach((c) => next.add(c.id));
      setSelecionados(next);
    }
  };

  const toggle = (id: string) => {
    const next = new Set(selecionados);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelecionados(next);
  };

  const onSaveTemplate = async () => {
    setSavingTpl(true);
    setSavedTplOk(false);
    try {
      const { error: e } = await supabase
        .from("murais")
        .update({ template_whatsapp: mensagem })
        .eq("id", mural.id);
      if (e) throw new Error(e.message);
      setSavedTplOk(true);
      setTimeout(() => setSavedTplOk(false), 2500);
    } catch (e: any) {
      setError(e.message || String(e));
    } finally {
      setSavingTpl(false);
    }
  };

  const onSend = async () => {
    if (selecionados.size === 0) {
      setError("Selecione pelo menos 1 colaborador.");
      return;
    }
    if (!mensagem.trim()) {
      setError("Mensagem vazia.");
      return;
    }
    setSending(true);
    setError(null);
    try {
      const [d_min, d_max] = VEL_DELAYS[velocidade];
      const r = await fetch("https://agente.parket.works/api/rh-whatsapp/mural-broadcast", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mural_slug: mural.slug,
          mural_titulo: mural.titulo,
          mensagem,
          colaborador_ids: Array.from(selecionados),
          delay_min_s: d_min,
          delay_max_s: d_max,
          personalizar: true,
          simular_digitacao: true,
        }),
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}: ${(await r.text()).slice(0, 300)}`);
      const data = await r.json();
      setResult({
        enviados: data.enviados || [],
        sem_telefone: data.sem_telefone || [],
        falhas: data.falhas || [],
        queued: data.queued,
        com_celular: data.com_celular,
        estimativa_minutos: data.estimativa_minutos,
        delay_min_s: data.delay_min_s,
        delay_max_s: data.delay_max_s,
      });
    } catch (e: any) {
      setError(e.message || String(e));
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4" onMouseDown={onClose}>
      <div
        className="bg-card border border-border rounded-xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div>
            <div className="font-semibold flex items-center gap-2">
              <Send size={14} /> Disparar mural pelo agente
            </div>
            <div className="text-xs text-muted-foreground mt-0.5">{mural.titulo}</div>
          </div>
          <Button size="sm" variant="outline" onClick={onClose}><X size={12} /></Button>
        </div>

        {!result ? (
          <div className="flex-1 overflow-auto p-4 space-y-4">
            {/* Mensagem */}
            <div>
              <div className="flex items-center justify-between mb-1 flex-wrap gap-1">
                <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Mensagem (link do mural anexado automaticamente)
                </div>
                <div className="flex gap-1 flex-wrap items-center">
                  {(Object.entries(TEMPLATES) as [TemplateKey, typeof TEMPLATES[TemplateKey]][]).map(([key, t]) => (
                    <button
                      key={key}
                      onClick={() => setMensagem(t.msg)}
                      className="text-[10px] px-2 py-1 rounded border border-border hover:bg-secondary transition"
                      title={`Carregar template "${t.label}"`}
                    >
                      {t.label}
                    </button>
                  ))}
                  <button
                    onClick={onSaveTemplate}
                    disabled={savingTpl}
                    className={`text-[10px] px-2 py-1 rounded border transition ${
                      savedTplOk
                        ? "bg-green-500/20 border-green-500 text-green-300"
                        : "border-border hover:bg-secondary"
                    }`}
                    title="Salva o texto atual como padrão pra este mural (persiste no banco pra próximos disparos)"
                  >
                    {savingTpl ? "💾 ..." : savedTplOk ? "✓ Salvo!" : "💾 Salvar como padrão"}
                  </button>
                </div>
              </div>
              <textarea
                value={mensagem}
                onChange={(e) => setMensagem(e.target.value)}
                rows={8}
                className="w-full text-xs bg-background border border-border rounded px-3 py-2 font-mono"
              />
              <div className="text-[10px] text-muted-foreground mt-1">
                Será adicionado ao final: 🔗 https://rh.parket.works/mural/{mural.slug}
              </div>
            </div>

            {/* Filtros */}
            <div className="space-y-2">
              <div className="relative">
                <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Buscar por nome ou CPF…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-7 text-xs h-8"
                />
              </div>
              <div className="flex flex-wrap gap-1.5">
                <button
                  onClick={() => setEmpresaFilter("")}
                  className={`text-[11px] px-2 py-1 rounded border transition ${
                    !empresaFilter ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-secondary"
                  }`}
                >Todas empresas</button>
                {empresas.map((e) => (
                  <button
                    key={e.id}
                    onClick={() => setEmpresaFilter(e.id)}
                    className={`text-[11px] px-2 py-1 rounded border transition ${
                      empresaFilter === e.id ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-secondary"
                    }`}
                  >{e.razao_social}</button>
                ))}
              </div>
              {ufList.length > 0 && (
                <div className="flex flex-wrap gap-1.5 items-center">
                  <span className="text-[10px] uppercase tracking-wide text-muted-foreground mr-1">Estado:</span>
                  <button
                    onClick={() => setUfFilter("")}
                    className={`text-[11px] px-2 py-1 rounded border transition ${
                      !ufFilter ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-secondary"
                    }`}
                  >Todos</button>
                  {ufList.map(([uf, n]) => (
                    <button
                      key={uf}
                      onClick={() => setUfFilter(uf)}
                      className={`text-[11px] px-2 py-1 rounded border transition ${
                        ufFilter === uf ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-secondary"
                      }`}
                    >{uf} ({n})</button>
                  ))}
                </div>
              )}
            </div>

            {/* Lista de colaboradores */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                  <Users size={12} /> Colaboradores ({filtered.length}) — {selecionados.size} selecionados
                </div>
                <Button size="sm" variant="outline" onClick={toggleAll}>
                  {allSelected ? "Desmarcar todos" : "Marcar todos"}
                </Button>
              </div>
              {loading ? (
                <div className="text-xs text-muted-foreground py-4 text-center">
                  <Loader2 size={14} className="animate-spin inline mr-2" /> Carregando…
                </div>
              ) : (
                <div className="max-h-64 overflow-auto border border-border rounded">
                  {filtered.map((c) => {
                    const checked = selecionados.has(c.id);
                    const noTel = !c.celular;
                    return (
                      <label key={c.id} className={`flex items-center gap-2 px-3 py-2 text-xs border-b border-border last:border-b-0 cursor-pointer hover:bg-secondary/30 ${noTel ? "opacity-60" : ""}`}>
                        <input type="checkbox" checked={checked} onChange={() => toggle(c.id)} />
                        <span className="flex-1">{c.nome}</span>
                        {noTel && <Badge variant="outline" className="text-[9px]">sem celular</Badge>}
                      </label>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Velocidade de envio (anti-bloqueio) */}
            <div>
              <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">
                Velocidade de envio (anti-bloqueio do WhatsApp)
              </div>
              <div className="flex gap-1.5 flex-wrap">
                {([
                  { key: "seguro", label: "🐢 Seguro (15-35s)", help: "Recomendado pra > 20 pessoas" },
                  { key: "normal", label: "🚶 Normal (8-18s)", help: "Pra 10-20 pessoas" },
                  { key: "rapido", label: "🏃 Rápido (3-8s)", help: "Risco de bloqueio — só pra grupos pequenos" },
                ] as { key: Velocidade; label: string; help: string }[]).map((v) => {
                  const [mn, mx] = VEL_DELAYS[v.key];
                  const media = (mn + mx) / 2;
                  const totalMin = Math.max(1, Math.round((media * Math.max(0, selecionados.size - 1)) / 60));
                  return (
                    <button
                      key={v.key}
                      onClick={() => setVelocidade(v.key)}
                      title={`${v.help} · estimado: ~${totalMin} min pra ${selecionados.size} pessoas`}
                      className={`text-[11px] px-2.5 py-1.5 rounded border transition ${
                        velocidade === v.key
                          ? "bg-primary text-primary-foreground border-primary"
                          : "border-border hover:bg-secondary"
                      }`}
                    >
                      {v.label}
                    </button>
                  );
                })}
              </div>
              {selecionados.size > 0 && (() => {
                const [mn, mx] = VEL_DELAYS[velocidade];
                const media = (mn + mx) / 2;
                const totalSec = Math.round(media * Math.max(0, selecionados.size - 1));
                const totalMin = Math.max(1, Math.round(totalSec / 60));
                return (
                  <div className="text-[10px] text-muted-foreground mt-1.5">
                    📊 Estimado: <strong className="text-foreground">~{totalMin} min</strong> pra enviar pra {selecionados.size} pessoa(s) · personalização com primeiro nome + "digitando…" entre cada
                  </div>
                );
              })()}
            </div>

            {error && (
              <div className="bg-destructive/10 border border-destructive/40 text-destructive text-xs p-2 rounded">
                ⚠ {error}
              </div>
            )}
          </div>
        ) : (
          /* Resultado */
          <div className="flex-1 overflow-auto p-4 space-y-3">
            {result.queued ? (
              <div className="bg-blue-500/10 border border-blue-500/40 text-blue-300 p-4 rounded text-sm space-y-2">
                <div className="font-semibold flex items-center gap-2">
                  🚀 Envio em andamento (gradual, anti-bloqueio)
                </div>
                <div className="text-xs">
                  <strong>{result.com_celular ?? 0}</strong> mensagens serão enviadas com intervalo aleatório
                  de <strong>{result.delay_min_s}–{result.delay_max_s}s</strong> entre cada,
                  com "digitando…" e personalizadas pelo primeiro nome.
                </div>
                <div className="text-xs">
                  ⏱ Tempo estimado: <strong>~{result.estimativa_minutos} min</strong>
                </div>
                <div className="text-xs">
                  📊 Acompanhe ao vivo em <strong>/documentosPendentes</strong> (atualiza a cada 10s)
                </div>
              </div>
            ) : (
            <div className="bg-green-500/10 border border-green-500/40 text-green-400 p-3 rounded text-sm">
              ✅ <strong>{result.enviados.length}</strong> WhatsApp enviados com sucesso
            </div>
            )}
            {result.sem_telefone.length > 0 && (
              <div className="bg-yellow-500/10 border border-yellow-500/40 p-3 rounded text-xs">
                <div className="font-semibold text-yellow-400 mb-1">
                  ⚠ {result.sem_telefone.length} sem celular cadastrado (não foi possível enviar):
                </div>
                <ul className="list-disc list-inside ml-2 text-muted-foreground">
                  {result.sem_telefone.map((c: any) => <li key={c.id}>{c.nome}</li>)}
                </ul>
              </div>
            )}
            {result.falhas.length > 0 && (
              <div className="bg-destructive/10 border border-destructive/40 p-3 rounded text-xs">
                <div className="font-semibold text-destructive mb-1">
                  ❌ {result.falhas.length} falharam:
                </div>
                <ul className="list-disc list-inside ml-2 text-muted-foreground">
                  {result.falhas.map((c: any) => <li key={c.id}>{c.nome} — {c.error}</li>)}
                </ul>
              </div>
            )}
          </div>
        )}

        <div className="p-4 border-t border-border flex justify-end gap-2">
          {!result ? (
            <>
              <Button size="sm" variant="outline" onClick={onClose} disabled={sending}>Cancelar</Button>
              <Button size="sm" onClick={onSend} disabled={sending || selecionados.size === 0}>
                {sending ? <><Loader2 size={12} className="animate-spin" /> Enviando…</>
                         : <><Send size={12} /> Enviar pra {selecionados.size}</>}
              </Button>
            </>
          ) : (
            <Button size="sm" onClick={onClose}>Fechar</Button>
          )}
        </div>
      </div>
    </div>
  );
}

function CopyLinkBtn({ link }: { link: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <Button size="sm" onClick={() => { navigator.clipboard.writeText(link); setCopied(true); setTimeout(() => setCopied(false), 1500); }}>
      {copied ? <><CheckCircle2 size={12} /> Copiado</> : <><Copy size={12} /> Copiar link</>}
    </Button>
  );
}

function NovoMuralModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [titulo, setTitulo] = useState("");
  const [slug, setSlug] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Auto-slug do título
  const onTitulo = (v: string) => {
    setTitulo(v);
    if (!slug) {
      const s = v.toLowerCase()
        .normalize("NFD").replace(/[̀-ͯ]/g, "")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 50);
      setSlug(s);
    }
  };

  const submit = async () => {
    setErr(null);
    if (!titulo.trim() || !slug.trim()) { setErr("Título e slug obrigatórios"); return; }
    setSaving(true);
    const { error } = await supabase.from("murais").insert({
      titulo: titulo.trim(),
      slug: slug.trim(),
      conteudo_html: "<p>Conteúdo em preparação…</p>",
    });
    if (error) { setErr(error.message); setSaving(false); return; }
    onSaved();
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <Card className="w-full max-w-md p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
        <div className="text-base font-bold">Novo mural</div>
        <div>
          <label className="text-xs font-medium mb-1 block">Título *</label>
          <Input value={titulo} onChange={(e) => onTitulo(e.target.value)} placeholder="Ex: Condutas e Políticas Internas" autoFocus />
        </div>
        <div>
          <label className="text-xs font-medium mb-1 block">Slug (URL) *</label>
          <Input value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="condutas-2026" />
          <div className="text-[10px] text-muted-foreground mt-1">
            Link público: <code>{window.location.origin}/mural/{slug || "..."}</code>
          </div>
        </div>
        {err && <div className="text-xs text-red-400">{err}</div>}
        <div className="flex justify-end gap-2">
          <Button variant="outline" size="sm" onClick={onClose}>Cancelar</Button>
          <Button size="sm" onClick={submit} disabled={saving}>
            {saving && <Loader2 size={12} className="animate-spin" />} Criar
          </Button>
        </div>
      </Card>
    </div>
  );
}
