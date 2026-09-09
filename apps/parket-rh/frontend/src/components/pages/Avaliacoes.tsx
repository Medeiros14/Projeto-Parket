/**
 * Avaliações — ciclos de avaliação de desempenho (modelo 360).
 *
 * Tabs:
 *   - Ciclos: lista de ciclos (CRUD)
 *   - Formulários: templates de perguntas por tipo (auto/gestor/pares/subordinados)
 *   - Aplicar: atribui avaliações em massa pra colaboradores
 *   - Resultados: visualização agregada do ciclo
 */
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  Star, Plus, Search, Loader2, CheckCircle2, AlertTriangle, FileText,
  ClipboardList, Users, BarChart3, Pencil, Trash2, X, ChevronRight, Calendar,
  Send, Eye, Power,
} from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Input } from "@/components/ui/Input";
import { supabase } from "@/lib/supabase";
import { useFetch, api } from "@/lib/api";
import { fmtDate } from "@/lib/format";

type Ciclo = {
  id: string;
  empresa_id: string | null;
  nome: string;
  inicio: string;
  fim: string;
  status: string;
  created_at: string;
};

type Formulario = {
  id: string;
  ciclo_id: string;
  nome: string;
  tipo: string;
  publico_alvo: string;
  ativo: boolean;
};

type Pergunta = {
  id: string;
  formulario_id: string;
  ordem: number;
  enunciado: string;
  tipo_resposta: string;
  opcoes: any;
  obrigatoria: boolean;
  competencia_avaliada: string | null;
};

const TIPO_FORM = [
  { key: "autoavaliacao", label: "Autoavaliação" },
  { key: "gestor", label: "Avaliação do Gestor" },
  { key: "pares", label: "Avaliação de Pares" },
  { key: "subordinados", label: "Avaliação de Subordinados" },
];

const TIPO_RESPOSTA = [
  { key: "escala_5", label: "Escala 1-5 (Likert)" },
  { key: "escala_10", label: "Escala 1-10" },
  { key: "sim_nao", label: "Sim / Não" },
  { key: "texto_curto", label: "Texto curto" },
  { key: "texto_longo", label: "Texto longo" },
];

export function AvaliacoesPage() {
  const [tab, setTab] = useState<"ciclos" | "formularios" | "aplicar" | "resultados">("ciclos");

  return (
    <div className="p-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Star size={22} /> Avaliações
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Ciclos de avaliação 360 — autoavaliação, gestor, pares e subordinados.
        </p>
      </div>

      <div className="flex gap-2 border-b border-border overflow-x-auto">
        {[
          { key: "ciclos", label: "Ciclos", icon: Calendar },
          { key: "formularios", label: "Formulários", icon: ClipboardList },
          { key: "aplicar", label: "Aplicar", icon: Send },
          { key: "resultados", label: "Resultados", icon: BarChart3 },
        ].map((t) => (
          <button key={t.key} onClick={() => setTab(t.key as any)}
            className={`px-4 py-2 text-sm font-semibold border-b-2 transition flex items-center gap-1.5 whitespace-nowrap ${
              tab === t.key ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"
            }`}>
            <t.icon size={14} /> {t.label}
          </button>
        ))}
      </div>

      {tab === "ciclos" && <CiclosTab />}
      {tab === "formularios" && <FormulariosTab />}
      {tab === "aplicar" && <AplicarTab />}
      {tab === "resultados" && <ResultadosTab />}
    </div>
  );
}

// ─────────────────────────────────────────────────
function CiclosTab() {
  const [ciclos, setCiclos] = useState<Ciclo[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Ciclo | null>(null);
  const [creating, setCreating] = useState(false);
  const empresas = useFetch(() => api.empresas(), []);

  const reload = async () => {
    setLoading(true);
    const { data } = await supabase.from("ciclos_avaliacao").select("*").order("inicio", { ascending: false });
    setCiclos((data || []) as Ciclo[]);
    setLoading(false);
  };
  useEffect(() => { reload(); }, []);

  const empresaMap = useMemo(() => new Map((empresas.data || []).map((e) => [e.id, e])), [empresas.data]);

  if (loading) return <Loading />;

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => setCreating(true)}><Plus size={14} /> Novo ciclo</Button>
      </div>

      {ciclos.length === 0 ? (
        <Card className="p-12 text-center">
          <Calendar size={32} className="mx-auto text-muted-foreground mb-3" />
          <div className="font-semibold mb-1.5">Nenhum ciclo de avaliação ainda</div>
          <p className="text-xs text-muted-foreground">Crie o primeiro ciclo (ex: "Avaliação Anual 2026").</p>
        </Card>
      ) : (
        <div className="space-y-2">
          {ciclos.map((c) => {
            const emp = c.empresa_id ? empresaMap.get(c.empresa_id) : null;
            const ativo = c.status === "aberto" || c.status === "em_andamento";
            return (
              <Card key={c.id} className="p-4 flex items-center gap-3 hover:bg-secondary/30">
                <Calendar size={16} className="text-muted-foreground" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-semibold">{c.nome}</span>
                    <Badge variant={ativo ? "success" : "outline"} className="text-[10px]">{c.status}</Badge>
                    {emp && <Badge variant="outline" className="text-[10px]">{emp.nome_fantasia || emp.razao_social}</Badge>}
                  </div>
                  <div className="text-[10px] text-muted-foreground mt-0.5">
                    {fmtDate(c.inicio)} → {fmtDate(c.fim)}
                  </div>
                </div>
                <Button size="sm" variant="outline" onClick={() => setEditing(c)}><Pencil size={11} /></Button>
              </Card>
            );
          })}
        </div>
      )}

      {(editing || creating) && (
        <CicloEditModal ciclo={editing} empresas={empresas.data || []}
          onClose={() => { setEditing(null); setCreating(false); }}
          onSaved={() => { setEditing(null); setCreating(false); reload(); }} />
      )}
    </div>
  );
}

function CicloEditModal({ ciclo, empresas, onClose, onSaved }:
  { ciclo: Ciclo | null; empresas: any[]; onClose: () => void; onSaved: () => void }) {
  const isNew = !ciclo;
  const hoje = new Date().toISOString().slice(0, 10);
  const fim30 = new Date(); fim30.setDate(fim30.getDate() + 30);
  const [form, setForm] = useState({
    nome: ciclo?.nome || "",
    empresa_id: ciclo?.empresa_id || "",
    inicio: ciclo?.inicio || hoje,
    fim: ciclo?.fim || fim30.toISOString().slice(0, 10),
    status: ciclo?.status || "rascunho",
  });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async () => {
    setErr(null);
    if (!form.nome.trim()) { setErr("Nome obrigatório"); return; }
    setSaving(true);
    const payload = {
      nome: form.nome.trim(),
      empresa_id: form.empresa_id || null,
      inicio: form.inicio,
      fim: form.fim,
      status: form.status,
    };
    const { error } = isNew
      ? await supabase.from("ciclos_avaliacao").insert(payload)
      : await supabase.from("ciclos_avaliacao").update(payload).eq("id", ciclo!.id);
    setSaving(false);
    if (error) setErr(error.message); else onSaved();
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <Card className="w-full max-w-lg" onClick={(e) => e.stopPropagation()}>
        <div className="p-4 border-b border-border flex justify-between">
          <div className="font-bold">{isNew ? "Novo ciclo" : "Editar ciclo"}</div>
          <button onClick={onClose}><X size={18} /></button>
        </div>
        <div className="p-4 space-y-3">
          <div>
            <label className="text-xs font-medium mb-1 block">Nome *</label>
            <Input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} placeholder="ex: Avaliação Anual 2026" />
          </div>
          <div>
            <label className="text-xs font-medium mb-1 block">Empresa (opcional, vazio = todas)</label>
            <select value={form.empresa_id} onChange={(e) => setForm({ ...form, empresa_id: e.target.value })}
              className="w-full h-9 bg-input border border-border rounded-md text-xs px-3">
              <option value="">Todas</option>
              {empresas.map((e: any) => (
                <option key={e.id} value={e.id}>{e.nome_fantasia || e.razao_social}</option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium mb-1 block">Início *</label>
              <Input type="date" value={form.inicio} onChange={(e) => setForm({ ...form, inicio: e.target.value })} />
            </div>
            <div>
              <label className="text-xs font-medium mb-1 block">Fim *</label>
              <Input type="date" value={form.fim} onChange={(e) => setForm({ ...form, fim: e.target.value })} />
            </div>
          </div>
          <div>
            <label className="text-xs font-medium mb-1 block">Status</label>
            <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}
              className="w-full h-9 bg-input border border-border rounded-md text-xs px-3">
              <option value="rascunho">Rascunho</option>
              <option value="aberto">Aberto (aceitando respostas)</option>
              <option value="em_andamento">Em andamento</option>
              <option value="fechado">Fechado</option>
              <option value="cancelado">Cancelado</option>
            </select>
          </div>
          {err && <div className="text-xs text-red-400">{err}</div>}
          <Button onClick={submit} disabled={saving} className="w-full">
            {saving && <Loader2 size={12} className="animate-spin" />} {isNew ? "Criar" : "Salvar"}
          </Button>
        </div>
      </Card>
    </div>
  );
}

// ─────────────────────────────────────────────────
function FormulariosTab() {
  const [forms, setForms] = useState<Formulario[]>([]);
  const [perguntas, setPerguntas] = useState<Record<string, Pergunta[]>>({});
  const [ciclos, setCiclos] = useState<Ciclo[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Formulario | null>(null);
  const [creating, setCreating] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const reload = async () => {
    setLoading(true);
    const [f, c] = await Promise.all([
      supabase.from("avaliacao_formularios").select("*").order("tipo"),
      supabase.from("ciclos_avaliacao").select("*").order("inicio", { ascending: false }),
    ]);
    setForms((f.data || []) as Formulario[]);
    setCiclos((c.data || []) as Ciclo[]);
    // Carrega perguntas
    if (f.data && f.data.length > 0) {
      const { data: p } = await supabase.from("avaliacao_perguntas")
        .select("*").in("formulario_id", f.data.map((x: any) => x.id)).order("ordem");
      const grouped: Record<string, Pergunta[]> = {};
      (p || []).forEach((q: any) => {
        (grouped[q.formulario_id] = grouped[q.formulario_id] || []).push(q);
      });
      setPerguntas(grouped);
    }
    setLoading(false);
  };
  useEffect(() => { reload(); }, []);

  const cicloMap = useMemo(() => new Map(ciclos.map((c) => [c.id, c])), [ciclos]);

  if (loading) return <Loading />;

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => setCreating(true)} disabled={ciclos.length === 0}>
          <Plus size={14} /> Novo formulário
        </Button>
      </div>
      {ciclos.length === 0 && (
        <Card className="p-4 text-xs text-amber-300 bg-amber-500/10 border border-amber-500/40">
          ⚠ Crie um ciclo primeiro na aba "Ciclos" antes de criar formulários.
        </Card>
      )}
      {forms.length === 0 ? (
        <Card className="p-12 text-center">
          <ClipboardList size={32} className="mx-auto text-muted-foreground mb-3" />
          <div className="font-semibold mb-1.5">Nenhum formulário cadastrado</div>
          <p className="text-xs text-muted-foreground">Cada ciclo pode ter formulários por tipo (auto/gestor/pares/subordinados).</p>
        </Card>
      ) : (
        <div className="space-y-2">
          {forms.map((f) => {
            const c = cicloMap.get(f.ciclo_id);
            const qs = perguntas[f.id] || [];
            const isExp = expandedId === f.id;
            return (
              <Card key={f.id} className="overflow-hidden">
                <button onClick={() => setExpandedId(isExp ? null : f.id)}
                  className="w-full p-4 text-left hover:bg-secondary/30 flex items-center gap-3">
                  <ClipboardList size={16} className="text-muted-foreground" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold">{f.nome}</span>
                      <Badge variant="outline" className="text-[10px]">{TIPO_FORM.find(t => t.key === f.tipo)?.label || f.tipo}</Badge>
                      <Badge variant={f.ativo ? "success" : "outline"} className="text-[10px]">{f.ativo ? "Ativo" : "Inativo"}</Badge>
                    </div>
                    <div className="text-[10px] text-muted-foreground mt-0.5">
                      Ciclo: {c?.nome || "—"} · {qs.length} pergunta{qs.length !== 1 ? "s" : ""}
                    </div>
                  </div>
                  <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); setEditing(f); }}>
                    <Pencil size={11} />
                  </Button>
                </button>
                {isExp && qs.length > 0 && (
                  <div className="border-t border-border divide-y divide-border">
                    {qs.map((q, i) => (
                      <div key={q.id} className="p-3 text-xs">
                        <div className="font-semibold">{i + 1}. {q.enunciado}</div>
                        <div className="text-[10px] text-muted-foreground mt-0.5">
                          Tipo: {TIPO_RESPOSTA.find(t => t.key === q.tipo_resposta)?.label || q.tipo_resposta}
                          {q.competencia_avaliada && ` · Competência: ${q.competencia_avaliada}`}
                          {q.obrigatoria && " · Obrigatória"}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {(editing || creating) && (
        <FormularioEditModal form={editing} ciclos={ciclos}
          onClose={() => { setEditing(null); setCreating(false); }}
          onSaved={() => { setEditing(null); setCreating(false); reload(); }} />
      )}
    </div>
  );
}

function FormularioEditModal({ form, ciclos, onClose, onSaved }:
  { form: Formulario | null; ciclos: Ciclo[]; onClose: () => void; onSaved: () => void }) {
  const isNew = !form;
  const [data, setData] = useState({
    nome: form?.nome || "",
    ciclo_id: form?.ciclo_id || (ciclos[0]?.id || ""),
    tipo: form?.tipo || "autoavaliacao",
    publico_alvo: form?.publico_alvo || "todos",
    ativo: form?.ativo ?? true,
  });
  const [perguntas, setPerguntas] = useState<Pergunta[]>([]);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (form?.id) {
      supabase.from("avaliacao_perguntas").select("*").eq("formulario_id", form.id).order("ordem")
        .then(({ data }) => setPerguntas((data || []) as Pergunta[]));
    } else {
      // Default questions pra autoavaliação
      setPerguntas([
        { id: "n1", formulario_id: "", ordem: 1, enunciado: "Como você avalia sua entrega de resultados no período?", tipo_resposta: "escala_5", opcoes: null, obrigatoria: true, competencia_avaliada: "Resultado" },
        { id: "n2", formulario_id: "", ordem: 2, enunciado: "Como você avalia sua colaboração em equipe?", tipo_resposta: "escala_5", opcoes: null, obrigatoria: true, competencia_avaliada: "Colaboração" },
        { id: "n3", formulario_id: "", ordem: 3, enunciado: "Quais foram seus principais aprendizados/conquistas?", tipo_resposta: "texto_longo", opcoes: null, obrigatoria: false, competencia_avaliada: null },
        { id: "n4", formulario_id: "", ordem: 4, enunciado: "Quais pontos você quer desenvolver no próximo ciclo?", tipo_resposta: "texto_longo", opcoes: null, obrigatoria: false, competencia_avaliada: null },
      ] as any);
    }
  }, [form?.id]);

  const updateQ = (idx: number, patch: Partial<Pergunta>) => {
    setPerguntas(perguntas.map((q, i) => i === idx ? { ...q, ...patch } : q));
  };
  const addQ = () => setPerguntas([...perguntas, {
    id: `n${Date.now()}`, formulario_id: "", ordem: perguntas.length + 1,
    enunciado: "", tipo_resposta: "escala_5", opcoes: null, obrigatoria: true, competencia_avaliada: null,
  } as any]);
  const delQ = (idx: number) => setPerguntas(perguntas.filter((_, i) => i !== idx));

  const submit = async () => {
    setErr(null);
    if (!data.nome.trim()) { setErr("Nome obrigatório"); return; }
    if (!data.ciclo_id) { setErr("Selecione um ciclo"); return; }
    setSaving(true);
    try {
      const payload = { ...data, nome: data.nome.trim() };
      let formId: string;
      if (isNew) {
        const { data: novo, error } = await supabase.from("avaliacao_formularios").insert(payload).select().single();
        if (error) throw new Error(error.message);
        formId = novo.id;
      } else {
        const { error } = await supabase.from("avaliacao_formularios").update(payload).eq("id", form!.id);
        if (error) throw new Error(error.message);
        formId = form!.id;
        await supabase.from("avaliacao_perguntas").delete().eq("formulario_id", formId);
      }
      const perguntasPayload = perguntas.map((q, i) => ({
        formulario_id: formId,
        ordem: i + 1,
        enunciado: q.enunciado,
        tipo_resposta: q.tipo_resposta,
        opcoes: q.opcoes,
        obrigatoria: q.obrigatoria,
        competencia_avaliada: q.competencia_avaliada,
      }));
      if (perguntasPayload.length > 0) {
        const { error } = await supabase.from("avaliacao_perguntas").insert(perguntasPayload);
        if (error) throw new Error(error.message);
      }
      onSaved();
    } catch (e: any) {
      setErr(String(e?.message || e));
    } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <Card className="w-full max-w-3xl h-[92vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="p-4 border-b border-border flex justify-between">
          <div className="font-bold">{isNew ? "Novo formulário" : "Editar formulário"}</div>
          <button onClick={onClose}><X size={18} /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium mb-1 block">Nome *</label>
              <Input value={data.nome} onChange={(e) => setData({ ...data, nome: e.target.value })} placeholder="ex: Autoavaliação 2026" />
            </div>
            <div>
              <label className="text-xs font-medium mb-1 block">Ciclo *</label>
              <select value={data.ciclo_id} onChange={(e) => setData({ ...data, ciclo_id: e.target.value })}
                className="w-full h-9 bg-input border border-border rounded-md text-xs px-3">
                {ciclos.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium mb-1 block">Tipo</label>
              <select value={data.tipo} onChange={(e) => setData({ ...data, tipo: e.target.value })}
                className="w-full h-9 bg-input border border-border rounded-md text-xs px-3">
                {TIPO_FORM.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
              </select>
            </div>
            <div className="flex items-end">
              <label className="flex items-center gap-2 text-xs cursor-pointer h-9">
                <input type="checkbox" checked={data.ativo} onChange={(e) => setData({ ...data, ativo: e.target.checked })} />
                Formulário ativo
              </label>
            </div>
          </div>

          <div className="pt-2 border-t border-border">
            <div className="flex items-center justify-between mb-2">
              <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Perguntas ({perguntas.length})</div>
              <Button size="sm" variant="outline" onClick={addQ}><Plus size={11} /> Pergunta</Button>
            </div>
            <div className="space-y-2">
              {perguntas.map((q, i) => (
                <Card key={q.id || i} className="p-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-muted-foreground">{i + 1}.</span>
                    <Input className="flex-1" value={q.enunciado} onChange={(e) => updateQ(i, { enunciado: e.target.value })} placeholder="Enunciado da pergunta" />
                    <Button size="sm" variant="outline" onClick={() => delQ(i)} className="text-rose-400"><X size={11} /></Button>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <select value={q.tipo_resposta} onChange={(e) => updateQ(i, { tipo_resposta: e.target.value })}
                      className="h-8 bg-input border border-border rounded-md text-xs px-2">
                      {TIPO_RESPOSTA.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
                    </select>
                    <Input value={q.competencia_avaliada || ""} onChange={(e) => updateQ(i, { competencia_avaliada: e.target.value })} placeholder="Competência (opc.)" />
                    <label className="flex items-center gap-2 text-xs">
                      <input type="checkbox" checked={q.obrigatoria} onChange={(e) => updateQ(i, { obrigatoria: e.target.checked })} />
                      Obrigatória
                    </label>
                  </div>
                </Card>
              ))}
            </div>
          </div>

          {err && <div className="text-xs text-red-400 p-2 bg-red-500/10 rounded">{err}</div>}
        </div>
        <div className="p-4 border-t border-border">
          <Button onClick={submit} disabled={saving} className="w-full">
            {saving && <Loader2 size={12} className="animate-spin" />} {isNew ? "Criar formulário" : "Salvar"}
          </Button>
        </div>
      </Card>
    </div>
  );
}

// ─────────────────────────────────────────────────
function AplicarTab() {
  const [ciclos, setCiclos] = useState<Ciclo[]>([]);
  const [forms, setForms] = useState<Formulario[]>([]);
  const [cicloId, setCicloId] = useState<string>("");
  const [formId, setFormId] = useState<string>("");
  const [avaliadorId, setAvaliadorId] = useState<string>("");  // pra tipo gestor/pares
  const colabs = useFetch(() => api.colaboradores(), []);
  const [avaliadosSel, setAvaliadosSel] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [prazo, setPrazo] = useState<string>(() => {
    const d = new Date(); d.setDate(d.getDate() + 15);
    return d.toISOString().slice(0, 10);
  });
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ criadas: number; erros: any[] } | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    supabase.from("ciclos_avaliacao").select("*").in("status", ["aberto", "em_andamento", "rascunho"]).order("inicio", { ascending: false })
      .then(({ data }) => setCiclos((data || []) as Ciclo[]));
  }, []);

  useEffect(() => {
    if (!cicloId) { setForms([]); return; }
    supabase.from("avaliacao_formularios").select("*").eq("ciclo_id", cicloId).eq("ativo", true)
      .then(({ data }) => setForms((data || []) as Formulario[]));
  }, [cicloId]);

  const form = forms.find((f) => f.id === formId);
  const isAuto = form?.tipo === "autoavaliacao";

  const colabsFilt = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (colabs.data || []).filter((c) =>
      !q || c.nome.toLowerCase().includes(q) || (c.cpf || "").includes(q),
    );
  }, [colabs.data, search]);

  const toggleAvaliado = (id: string) => {
    const n = new Set(avaliadosSel);
    n.has(id) ? n.delete(id) : n.add(id);
    setAvaliadosSel(n);
  };
  const toggleAll = () => {
    if (avaliadosSel.size === colabsFilt.length) setAvaliadosSel(new Set());
    else setAvaliadosSel(new Set(colabsFilt.map((c) => c.id)));
  };

  const submit = async () => {
    setErr(null); setResult(null);
    if (!cicloId || !formId) { setErr("Selecione ciclo + formulário"); return; }
    if (avaliadosSel.size === 0) { setErr("Selecione pelo menos 1 avaliado"); return; }
    if (!isAuto && !avaliadorId) { setErr("Pra avaliação não-auto, selecione o avaliador"); return; }
    setSubmitting(true);
    const payload = Array.from(avaliadosSel).map((avId) => ({
      ciclo_id: cicloId,
      formulario_id: formId,
      avaliado_id: avId,
      avaliador_id: isAuto ? avId : avaliadorId,
      status: "pendente",
      prazo,
      enviado_em: new Date().toISOString(),
    }));
    const { data, error } = await supabase.from("avaliacoes").insert(payload).select();
    setSubmitting(false);
    if (error) setErr(error.message);
    else {
      setResult({ criadas: (data || []).length, erros: [] });
      setAvaliadosSel(new Set());
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <Card className="p-5 space-y-3">
        <h2 className="text-base font-bold flex items-center gap-2"><Send size={16} /> Aplicar avaliações</h2>
        <div>
          <label className="text-xs font-medium mb-1 block">Ciclo *</label>
          <select value={cicloId} onChange={(e) => { setCicloId(e.target.value); setFormId(""); }}
            className="w-full h-9 bg-input border border-border rounded-md text-xs px-3">
            <option value="">— selecione —</option>
            {ciclos.map((c) => <option key={c.id} value={c.id}>{c.nome} ({c.status})</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs font-medium mb-1 block">Formulário *</label>
          <select value={formId} onChange={(e) => setFormId(e.target.value)} disabled={!cicloId}
            className="w-full h-9 bg-input border border-border rounded-md text-xs px-3">
            <option value="">— selecione —</option>
            {forms.map((f) => <option key={f.id} value={f.id}>{f.nome} ({TIPO_FORM.find(t => t.key === f.tipo)?.label})</option>)}
          </select>
        </div>
        {!isAuto && form && (
          <div>
            <label className="text-xs font-medium mb-1 block">Avaliador (quem vai responder) *</label>
            <select value={avaliadorId} onChange={(e) => setAvaliadorId(e.target.value)}
              className="w-full h-9 bg-input border border-border rounded-md text-xs px-3">
              <option value="">— selecione —</option>
              {(colabs.data || []).map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
            </select>
            <div className="text-[10px] text-muted-foreground mt-1">
              Pra autoavaliação, o avaliador = avaliado automaticamente.
            </div>
          </div>
        )}
        <div>
          <label className="text-xs font-medium mb-1 block">Prazo *</label>
          <Input type="date" value={prazo} onChange={(e) => setPrazo(e.target.value)} />
        </div>
        {err && <div className="text-xs text-red-400 p-2 bg-red-500/10 rounded">{err}</div>}
        {result && (
          <div className="text-xs text-emerald-300 p-2 bg-emerald-500/10 rounded">
            ✓ {result.criadas} avaliação{result.criadas !== 1 ? "ões" : ""} criada{result.criadas !== 1 ? "s" : ""}
          </div>
        )}
        <Button onClick={submit} disabled={submitting || !cicloId || !formId || avaliadosSel.size === 0} className="w-full">
          {submitting && <Loader2 size={12} className="animate-spin" />}
          Aplicar pra {avaliadosSel.size} colaborador{avaliadosSel.size !== 1 ? "es" : ""}
        </Button>
      </Card>

      <Card className="p-5 space-y-3">
        <h2 className="text-base font-bold flex items-center gap-2">
          <Users size={16} /> Avaliados ({avaliadosSel.size})
        </h2>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Buscar…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
          </div>
          <Button size="sm" variant="outline" onClick={toggleAll}>
            {avaliadosSel.size === colabsFilt.length && colabsFilt.length > 0 ? "Limpar" : "Todos"}
          </Button>
        </div>
        <div className="border border-border rounded max-h-[55vh] overflow-y-auto">
          {colabsFilt.map((c) => {
            const on = avaliadosSel.has(c.id);
            return (
              <label key={c.id} className={`flex items-start gap-2 px-3 py-2 text-xs border-b border-border last:border-0 cursor-pointer ${on ? "bg-primary/10" : "hover:bg-secondary/30"}`}>
                <input type="checkbox" checked={on} onChange={() => toggleAvaliado(c.id)} className="mt-0.5" />
                <div className="flex-1 min-w-0">
                  <div className="font-semibold truncate">{c.nome}</div>
                </div>
              </label>
            );
          })}
        </div>
      </Card>
    </div>
  );
}

// ─────────────────────────────────────────────────
function ResultadosTab() {
  const [ciclos, setCiclos] = useState<Ciclo[]>([]);
  const [cicloId, setCicloId] = useState<string>("");
  const [avaliacoes, setAvaliacoes] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const colabs = useFetch(() => api.colaboradores(), []);

  useEffect(() => {
    supabase.from("ciclos_avaliacao").select("*").order("inicio", { ascending: false })
      .then(({ data }) => setCiclos((data || []) as Ciclo[]));
  }, []);

  useEffect(() => {
    if (!cicloId) { setAvaliacoes([]); return; }
    setLoading(true);
    supabase.from("avaliacoes").select("*").eq("ciclo_id", cicloId).order("avaliado_id")
      .then(({ data }) => { setAvaliacoes(data || []); setLoading(false); });
  }, [cicloId]);

  const colabMap = useMemo(() => new Map((colabs.data || []).map((c) => [c.id, c])), [colabs.data]);

  const porColab = useMemo(() => {
    const m: Record<string, any[]> = {};
    avaliacoes.forEach((a) => (m[a.avaliado_id] = m[a.avaliado_id] || []).push(a));
    return Object.entries(m).map(([colab, items]) => {
      const concluidas = items.filter((x: any) => x.status === "concluida").length;
      const notas = items.filter((x: any) => x.nota_final != null).map((x: any) => x.nota_final);
      const media = notas.length > 0 ? notas.reduce((s: number, n: number) => s + Number(n), 0) / notas.length : null;
      return { colab, items, concluidas, total: items.length, media };
    }).sort((a, b) => (b.media || 0) - (a.media || 0));
  }, [avaliacoes]);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <label className="text-xs font-medium">Ciclo:</label>
        <select value={cicloId} onChange={(e) => setCicloId(e.target.value)}
          className="h-9 bg-input border border-border rounded-md text-xs px-3 min-w-[300px]">
          <option value="">— selecione —</option>
          {ciclos.map((c) => <option key={c.id} value={c.id}>{c.nome} ({c.status})</option>)}
        </select>
      </div>

      {!cicloId && (
        <Card className="p-12 text-center">
          <BarChart3 size={32} className="mx-auto text-muted-foreground mb-3" />
          <div className="font-semibold mb-1.5">Selecione um ciclo</div>
          <p className="text-xs text-muted-foreground">Pra ver os resultados consolidados.</p>
        </Card>
      )}

      {loading && <Loading />}

      {cicloId && !loading && (
        <>
          <div className="grid grid-cols-4 gap-3">
            <Box label="Avaliações" valor={avaliacoes.length} />
            <Box label="Concluídas" valor={avaliacoes.filter(a => a.status === "concluida").length} color="text-emerald-400" />
            <Box label="Pendentes" valor={avaliacoes.filter(a => a.status === "pendente").length} color="text-amber-400" />
            <Box label="Avaliados" valor={porColab.length} />
          </div>

          {porColab.length === 0 ? (
            <Card className="p-8 text-center text-sm text-muted-foreground">Nenhuma avaliação ainda nesse ciclo.</Card>
          ) : (
            <Card className="overflow-hidden">
              <div className="divide-y divide-border">
                {porColab.map((p) => {
                  const c = colabMap.get(p.colab);
                  return (
                    <Link to={`/colaboradores/${p.colab}`} key={p.colab}
                      className="flex items-center gap-3 px-4 py-3 hover:bg-secondary/30">
                      <Star size={14} className="text-muted-foreground" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold">{c?.nome || "—"}</span>
                          <span className="text-[10px] text-muted-foreground">
                            {p.concluidas}/{p.total} concluídas
                          </span>
                        </div>
                      </div>
                      {p.media != null && (
                        <Badge variant={p.media >= 4 ? "success" : p.media >= 3 ? "warning" : "outline"} className="text-[10px]">
                          Média {p.media.toFixed(1)}
                        </Badge>
                      )}
                      <ChevronRight size={14} className="text-muted-foreground" />
                    </Link>
                  );
                })}
              </div>
            </Card>
          )}
        </>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────
function Loading() {
  return <div className="flex items-center gap-2 text-sm text-muted-foreground p-8 justify-center">
    <Loader2 size={14} className="animate-spin" /> Carregando…
  </div>;
}

function Box({ label, valor, color }: { label: string; valor: number; color?: string }) {
  return (
    <Card className="p-4">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={`text-2xl font-bold mt-1 ${color || ""}`}>{valor}</div>
    </Card>
  );
}
