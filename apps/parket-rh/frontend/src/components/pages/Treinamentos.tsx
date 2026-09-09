/**
 * Treinamentos — catálogo, atribuições e certificados.
 *
 * Tabs:
 *   - Catálogo: lista de treinamentos disponíveis (NRs, integração, etc.) com CRUD
 *   - Realizados: histórico por colaborador, filtros por status/validade
 *   - Vencimentos: lista o que vence nos próximos 30/60/90 dias
 *   - Registrar: tela rápida pra marcar conclusão (com upload de certificado)
 */
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  GraduationCap, Plus, Search, AlertTriangle, CheckCircle2, Loader2,
  FileText, Calendar, Upload, X, ChevronRight, Award, Filter, Pencil, Trash2, Power,
} from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Input } from "@/components/ui/Input";
import { supabase } from "@/lib/supabase";
import { useFetch, api } from "@/lib/api";
import { fmtDate, fmtCPF } from "@/lib/format";

const CATEGORIAS = ["NR", "Integração", "Saúde", "Compliance", "Técnico", "Liderança", "Outros"];

type Treinamento = {
  id: string;
  nome: string;
  descricao: string | null;
  categoria: string | null;
  carga_horaria: number | null;
  valida_dias: number | null;
  obrigatorio_para_cargos: string[] | null;
  ativo: boolean;
};

type ColabTreinamento = {
  id: string;
  colaborador_id: string;
  treinamento_id: string;
  status: string;
  data_inicio: string | null;
  data_conclusao: string | null;
  data_validade: string | null;
  nota: number | null;
  certificado_storage_path: string | null;
  observacao: string | null;
  created_at: string;
};

export function TreinamentosPage() {
  const [tab, setTab] = useState<"catalogo" | "realizados" | "vencimentos" | "registrar">("realizados");

  return (
    <div className="p-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <GraduationCap size={22} /> Treinamentos
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Catálogo de NRs e cursos · histórico por colaborador · alertas de validade vencendo
        </p>
      </div>

      <div className="flex gap-2 border-b border-border overflow-x-auto">
        {[
          { key: "realizados", label: "Realizados", icon: CheckCircle2 },
          { key: "vencimentos", label: "Vencimentos próximos", icon: AlertTriangle },
          { key: "registrar", label: "Registrar conclusão", icon: Plus },
          { key: "catalogo", label: "Catálogo", icon: GraduationCap },
        ].map((t) => (
          <button key={t.key} onClick={() => setTab(t.key as any)}
            className={`px-4 py-2 text-sm font-semibold border-b-2 transition flex items-center gap-1.5 whitespace-nowrap ${
              tab === t.key ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"
            }`}>
            <t.icon size={14} /> {t.label}
          </button>
        ))}
      </div>

      {tab === "catalogo" && <CatalogoTab />}
      {tab === "realizados" && <RealizadosTab />}
      {tab === "vencimentos" && <VencimentosTab />}
      {tab === "registrar" && <RegistrarTab />}
    </div>
  );
}

// ─────────────────────────────────────────────────
function CatalogoTab() {
  const [items, setItems] = useState<Treinamento[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<Treinamento | null>(null);
  const [creating, setCreating] = useState(false);

  const reload = async () => {
    setLoading(true);
    const { data } = await supabase.from("treinamentos_catalogo").select("*").order("categoria").order("nome");
    setItems((data || []) as Treinamento[]);
    setLoading(false);
  };
  useEffect(() => { reload(); }, []);

  const filtered = items.filter((t) =>
    !search.trim() || t.nome.toLowerCase().includes(search.toLowerCase()) ||
    (t.descricao || "").toLowerCase().includes(search.toLowerCase()),
  );
  const byCat = useMemo(() => {
    const m: Record<string, Treinamento[]> = {};
    filtered.forEach((t) => {
      const k = t.categoria || "Outros";
      (m[k] = m[k] || []).push(t);
    });
    return m;
  }, [filtered]);

  const toggle = async (t: Treinamento) => {
    await supabase.from("treinamentos_catalogo").update({ ativo: !t.ativo }).eq("id", t.id);
    reload();
  };

  if (loading) return <Loading />;

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <div className="relative flex-1 max-w-md">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Buscar treinamento…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Button onClick={() => setCreating(true)}><Plus size={14} /> Novo</Button>
      </div>

      {Object.entries(byCat).map(([cat, lst]) => (
        <Card key={cat} className="p-4">
          <div className="text-xs uppercase tracking-wider font-semibold text-muted-foreground mb-2">
            {cat} · {lst.length}
          </div>
          <div className="space-y-1.5">
            {lst.map((t) => (
              <div key={t.id} className={`flex items-center gap-3 px-3 py-2 rounded hover:bg-secondary/30 ${!t.ativo ? "opacity-50" : ""}`}>
                <GraduationCap size={14} className="text-muted-foreground shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold truncate">{t.nome}</div>
                  <div className="text-[10px] text-muted-foreground">
                    {t.carga_horaria && `${t.carga_horaria}h · `}
                    {t.valida_dias ? `validade ${(t.valida_dias / 365).toFixed(1)} ano${t.valida_dias > 365 ? "s" : ""}` : "sem validade"}
                    {t.descricao && ` · ${t.descricao.slice(0, 80)}`}
                  </div>
                </div>
                <Button size="sm" variant="outline" onClick={() => toggle(t)} title={t.ativo ? "Desativar" : "Ativar"}><Power size={11} /></Button>
                <Button size="sm" variant="outline" onClick={() => setEditing(t)}><Pencil size={11} /></Button>
              </div>
            ))}
          </div>
        </Card>
      ))}

      {(editing || creating) && (
        <CatalogoEditModal item={editing} onClose={() => { setEditing(null); setCreating(false); }}
          onSaved={() => { setEditing(null); setCreating(false); reload(); }} />
      )}
    </div>
  );
}

function CatalogoEditModal({ item, onClose, onSaved }:
  { item: Treinamento | null; onClose: () => void; onSaved: () => void }) {
  const isNew = !item;
  const [form, setForm] = useState({
    nome: item?.nome || "",
    descricao: item?.descricao || "",
    categoria: item?.categoria || "NR",
    carga_horaria: item?.carga_horaria || 0,
    valida_dias: item?.valida_dias || 0,
    ativo: item?.ativo ?? true,
  });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async () => {
    setErr(null);
    if (!form.nome.trim()) { setErr("Nome obrigatório"); return; }
    setSaving(true);
    const payload = {
      nome: form.nome.trim(),
      descricao: form.descricao.trim() || null,
      categoria: form.categoria,
      carga_horaria: form.carga_horaria || null,
      valida_dias: form.valida_dias || null,
      ativo: form.ativo,
    };
    const { error } = isNew
      ? await supabase.from("treinamentos_catalogo").insert(payload)
      : await supabase.from("treinamentos_catalogo").update(payload).eq("id", item!.id);
    setSaving(false);
    if (error) setErr(error.message);
    else onSaved();
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <Card className="w-full max-w-lg" onClick={(e) => e.stopPropagation()}>
        <div className="p-4 border-b border-border flex justify-between">
          <div className="font-bold">{isNew ? "Novo treinamento" : "Editar"}</div>
          <button onClick={onClose}><X size={18} /></button>
        </div>
        <div className="p-4 space-y-3">
          <div>
            <label className="text-xs font-medium mb-1 block">Nome *</label>
            <Input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium mb-1 block">Categoria</label>
              <select value={form.categoria} onChange={(e) => setForm({ ...form, categoria: e.target.value })}
                className="w-full h-9 bg-input border border-border rounded-md text-xs px-3">
                {CATEGORIAS.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium mb-1 block">Carga horária</label>
              <Input type="number" min={0} value={form.carga_horaria}
                onChange={(e) => setForm({ ...form, carga_horaria: parseFloat(e.target.value) || 0 })} />
            </div>
            <div>
              <label className="text-xs font-medium mb-1 block">Validade (dias)</label>
              <Input type="number" min={0} value={form.valida_dias}
                onChange={(e) => setForm({ ...form, valida_dias: parseInt(e.target.value) || 0 })}
                placeholder="0 = sem validade" />
            </div>
            <div className="flex items-end">
              <label className="flex items-center gap-2 text-xs cursor-pointer h-9">
                <input type="checkbox" checked={form.ativo} onChange={(e) => setForm({ ...form, ativo: e.target.checked })} />
                Ativo
              </label>
            </div>
          </div>
          <div>
            <label className="text-xs font-medium mb-1 block">Descrição</label>
            <textarea value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })}
              rows={3} className="w-full bg-input border border-border rounded-md text-xs p-2" />
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
function RealizadosTab() {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const colabs = useFetch(() => api.colaboradores(), []);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data } = await supabase.from("colaborador_treinamentos")
        .select("*").order("data_conclusao", { ascending: false }).limit(500);
      const trIds = Array.from(new Set((data || []).map((x: any) => x.treinamento_id)));
      const { data: tr } = trIds.length > 0
        ? await supabase.from("treinamentos_catalogo").select("id,nome,categoria,valida_dias").in("id", trIds)
        : { data: [] };
      const trMap = new Map((tr || []).map((t: any) => [t.id, t]));
      const merged = (data || []).map((x: any) => ({ ...x, treinamento: trMap.get(x.treinamento_id) }));
      setItems(merged);
      setLoading(false);
    })();
  }, []);

  const colabMap = useMemo(() => new Map((colabs.data || []).map((c) => [c.id, c])), [colabs.data]);

  const filtered = items.filter((x) => {
    if (statusFilter && x.status !== statusFilter) return false;
    const q = search.trim().toLowerCase();
    if (q) {
      const c = colabMap.get(x.colaborador_id);
      const hit = (c?.nome || "").toLowerCase().includes(q) || (x.treinamento?.nome || "").toLowerCase().includes(q);
      if (!hit) return false;
    }
    return true;
  });

  if (loading) return <Loading />;

  if (items.length === 0) return (
    <Card className="p-12 text-center">
      <GraduationCap size={32} className="mx-auto text-muted-foreground mb-3" />
      <div className="font-semibold mb-1.5">Nenhum treinamento registrado ainda</div>
      <p className="text-xs text-muted-foreground">Vá pra aba "Registrar conclusão" pra começar.</p>
    </Card>
  );

  return (
    <div className="space-y-4">
      <div className="flex gap-2 flex-wrap">
        <div className="relative flex-1 max-w-md">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Colaborador ou treinamento…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
          className="h-9 bg-input border border-border rounded-md text-xs px-3">
          <option value="">Todos status</option>
          <option value="concluido">Concluído</option>
          <option value="agendado">Agendado</option>
          <option value="em_andamento">Em andamento</option>
          <option value="vencido">Vencido</option>
        </select>
      </div>
      <Card className="overflow-hidden">
        <div className="divide-y divide-border">
          {filtered.map((x) => {
            const c = colabMap.get(x.colaborador_id);
            const vencido = x.data_validade && new Date(x.data_validade) < new Date();
            return (
              <Link to={`/colaboradores/${x.colaborador_id}`} key={x.id}
                className="flex items-center gap-3 px-4 py-3 hover:bg-secondary/30">
                <Award size={14} className="text-muted-foreground shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-semibold truncate">{c?.nome || "—"}</span>
                    <span className="text-xs text-muted-foreground">·</span>
                    <span className="text-sm">{x.treinamento?.nome || "—"}</span>
                    {x.status === "concluido" && !vencido && <Badge variant="success" className="text-[10px]">Concluído</Badge>}
                    {vencido && <Badge variant="outline" className="text-[10px] text-rose-400">Vencido</Badge>}
                    {x.status === "agendado" && <Badge variant="outline" className="text-[10px] text-amber-400">Agendado</Badge>}
                    {x.status === "em_andamento" && <Badge variant="warning" className="text-[10px]">Em andamento</Badge>}
                  </div>
                  <div className="text-[10px] text-muted-foreground mt-0.5">
                    {x.data_conclusao && `Concluído em ${fmtDate(x.data_conclusao)}`}
                    {x.data_validade && ` · Validade ${fmtDate(x.data_validade)}`}
                    {x.nota != null && ` · Nota ${x.nota}`}
                  </div>
                </div>
                <ChevronRight size={14} className="text-muted-foreground" />
              </Link>
            );
          })}
        </div>
      </Card>
    </div>
  );
}

// ─────────────────────────────────────────────────
function VencimentosTab() {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const colabs = useFetch(() => api.colaboradores(), []);

  useEffect(() => {
    (async () => {
      const em90 = new Date();
      em90.setDate(em90.getDate() + 90);
      const { data } = await supabase.from("colaborador_treinamentos")
        .select("*")
        .not("data_validade", "is", null)
        .lte("data_validade", em90.toISOString().slice(0, 10))
        .order("data_validade", { ascending: true });
      const trIds = Array.from(new Set((data || []).map((x: any) => x.treinamento_id)));
      const { data: tr } = trIds.length > 0
        ? await supabase.from("treinamentos_catalogo").select("id,nome").in("id", trIds)
        : { data: [] };
      const trMap = new Map((tr || []).map((t: any) => [t.id, t]));
      setItems((data || []).map((x: any) => ({ ...x, treinamento: trMap.get(x.treinamento_id) })));
      setLoading(false);
    })();
  }, []);

  const colabMap = useMemo(() => new Map((colabs.data || []).map((c) => [c.id, c])), [colabs.data]);

  if (loading) return <Loading />;

  const grupos = {
    vencidos: items.filter((x) => new Date(x.data_validade) < new Date()),
    em_30: items.filter((x) => {
      const dt = new Date(x.data_validade);
      const hj = new Date();
      const em30 = new Date(); em30.setDate(em30.getDate() + 30);
      return dt >= hj && dt <= em30;
    }),
    em_60: items.filter((x) => {
      const dt = new Date(x.data_validade);
      const em30 = new Date(); em30.setDate(em30.getDate() + 30);
      const em60 = new Date(); em60.setDate(em60.getDate() + 60);
      return dt > em30 && dt <= em60;
    }),
    em_90: items.filter((x) => {
      const dt = new Date(x.data_validade);
      const em60 = new Date(); em60.setDate(em60.getDate() + 60);
      const em90 = new Date(); em90.setDate(em90.getDate() + 90);
      return dt > em60 && dt <= em90;
    }),
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-4 gap-3">
        <Box label="Vencidos" valor={grupos.vencidos.length} color="text-rose-400" />
        <Box label="≤ 30 dias" valor={grupos.em_30.length} color="text-amber-400" />
        <Box label="≤ 60 dias" valor={grupos.em_60.length} color="text-yellow-400" />
        <Box label="≤ 90 dias" valor={grupos.em_90.length} color="text-blue-400" />
      </div>
      {[
        ["Vencidos", grupos.vencidos, "rose-400"],
        ["Vencendo em 30 dias", grupos.em_30, "amber-400"],
        ["Vencendo em 60 dias", grupos.em_60, "yellow-400"],
        ["Vencendo em 90 dias", grupos.em_90, "blue-400"],
      ].map(([titulo, lst, color]: any) => lst.length > 0 && (
        <Card key={titulo} className="p-4">
          <div className={`text-xs uppercase tracking-wider font-semibold text-${color} mb-2`}>{titulo} · {lst.length}</div>
          <div className="space-y-1">
            {lst.map((x: any) => {
              const c = colabMap.get(x.colaborador_id);
              return (
                <Link to={`/colaboradores/${x.colaborador_id}`} key={x.id}
                  className="flex items-center gap-2 px-2 py-1.5 hover:bg-secondary/30 rounded text-xs">
                  <Award size={12} className="text-muted-foreground" />
                  <div className="flex-1 truncate">
                    <span className="font-semibold">{c?.nome || "—"}</span>
                    <span className="text-muted-foreground"> · {x.treinamento?.nome || "—"}</span>
                  </div>
                  <span className="text-[10px] text-muted-foreground">{fmtDate(x.data_validade)}</span>
                </Link>
              );
            })}
          </div>
        </Card>
      ))}
      {items.length === 0 && <Card className="p-8 text-center text-sm text-muted-foreground">✓ Nenhum treinamento vencendo nos próximos 90 dias.</Card>}
    </div>
  );
}

// ─────────────────────────────────────────────────
function RegistrarTab() {
  const colabs = useFetch(() => api.colaboradores(), []);
  const [trs, setTrs] = useState<Treinamento[]>([]);
  const [colabId, setColabId] = useState<string>("");
  const [trId, setTrId] = useState<string>("");
  const [dataConclusao, setDataConclusao] = useState(new Date().toISOString().slice(0, 10));
  const [nota, setNota] = useState<string>("");
  const [observacao, setObservacao] = useState("");
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    supabase.from("treinamentos_catalogo").select("*").eq("ativo", true).order("nome")
      .then(({ data }) => setTrs((data || []) as Treinamento[]));
  }, []);

  const tr = trs.find((t) => t.id === trId);
  const validade = useMemo(() => {
    if (!tr?.valida_dias || !dataConclusao) return null;
    const dt = new Date(dataConclusao);
    dt.setDate(dt.getDate() + tr.valida_dias);
    return dt.toISOString().slice(0, 10);
  }, [tr, dataConclusao]);

  const submit = async () => {
    setErr(null); setResult(null);
    if (!colabId) { setErr("Selecione um colaborador"); return; }
    if (!trId) { setErr("Selecione um treinamento"); return; }
    setSaving(true);
    try {
      let storagePath: string | null = null;
      if (arquivo) {
        const path = `${colabId}/${trId}/${Date.now()}-${arquivo.name}`;
        const { error: upErr } = await supabase.storage.from("rh-treinamentos").upload(path, arquivo, { upsert: true });
        if (upErr) throw new Error(`Storage: ${upErr.message}`);
        storagePath = path;
      }
      const payload = {
        colaborador_id: colabId,
        treinamento_id: trId,
        status: "concluido",
        data_conclusao: dataConclusao,
        data_validade: validade,
        nota: nota ? parseFloat(nota) : null,
        observacao: observacao || null,
        certificado_storage_path: storagePath,
      };
      const { error } = await supabase.from("colaborador_treinamentos").insert(payload);
      if (error) throw new Error(error.message);
      setResult(`✓ ${tr?.nome} registrado pra ${colabs.data?.find(c => c.id === colabId)?.nome}`);
      setTrId(""); setNota(""); setObservacao(""); setArquivo(null);
    } catch (e: any) {
      setErr(String(e?.message || e));
    } finally { setSaving(false); }
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <Card className="p-5 space-y-3">
        <h2 className="text-base font-bold flex items-center gap-2"><Plus size={16} /> Registrar conclusão</h2>
        <div>
          <label className="text-xs font-medium mb-1 block">Colaborador *</label>
          <select value={colabId} onChange={(e) => setColabId(e.target.value)}
            className="w-full h-9 bg-input border border-border rounded-md text-xs px-3">
            <option value="">— selecione —</option>
            {(colabs.data || []).map((c) => (
              <option key={c.id} value={c.id}>{c.nome}{c.cpf && ` (${fmtCPF(c.cpf)})`}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs font-medium mb-1 block">Treinamento *</label>
          <select value={trId} onChange={(e) => setTrId(e.target.value)}
            className="w-full h-9 bg-input border border-border rounded-md text-xs px-3">
            <option value="">— selecione —</option>
            {trs.map((t) => (
              <option key={t.id} value={t.id}>[{t.categoria}] {t.nome}{t.carga_horaria ? ` (${t.carga_horaria}h)` : ""}</option>
            ))}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-medium mb-1 block">Data de conclusão *</label>
            <Input type="date" value={dataConclusao} onChange={(e) => setDataConclusao(e.target.value)} />
          </div>
          <div>
            <label className="text-xs font-medium mb-1 block">Nota (0-10)</label>
            <Input type="number" min={0} max={10} step={0.1} value={nota} onChange={(e) => setNota(e.target.value)} placeholder="opcional" />
          </div>
        </div>
        {validade && (
          <div className="text-xs text-amber-300 p-2 bg-amber-500/10 rounded">
            ⏳ Validade automática até <strong>{fmtDate(validade)}</strong>
          </div>
        )}
        <div>
          <label className="text-xs font-medium mb-1 block">Observações</label>
          <textarea value={observacao} onChange={(e) => setObservacao(e.target.value)} rows={2}
            className="w-full bg-input border border-border rounded-md text-xs p-2" />
        </div>
        <div>
          <label className="text-xs font-medium mb-1 block">Certificado (PDF/JPG/PNG — opcional)</label>
          <input type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={(e) => setArquivo(e.target.files?.[0] || null)}
            className="w-full text-xs bg-input border border-border rounded-md p-2" />
        </div>

        {err && <div className="text-xs text-red-400 p-2 bg-red-500/10 rounded">{err}</div>}
        {result && <div className="text-xs text-emerald-300 p-2 bg-emerald-500/10 rounded">{result}</div>}

        <Button onClick={submit} disabled={saving || !colabId || !trId} className="w-full">
          {saving && <Loader2 size={12} className="animate-spin" />}
          <Award size={12} /> Registrar treinamento
        </Button>
      </Card>

      <Card className="p-5 space-y-3">
        <h2 className="text-base font-bold flex items-center gap-2"><FileText size={16} /> Sobre</h2>
        <ul className="text-xs space-y-2 text-muted-foreground">
          <li>• Treinamentos com <strong>validade configurada</strong> calculam data de vencimento automaticamente.</li>
          <li>• Certificado fica salvo no bucket <code>rh-treinamentos</code> e aparece no perfil do colaborador.</li>
          <li>• <strong>Vencimentos próximos</strong> aparecem na aba dedicada (≤ 30/60/90 dias).</li>
          <li>• Pra cursos com termo de ciência (ex: NR-06), use também <Link to="/documentos" className="text-primary hover:underline">/documentos</Link> pra mandar pra assinatura via Clicksign.</li>
        </ul>
      </Card>
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
