/**
 * Scripts — biblioteca de scripts editáveis usados pelo SDR/vendedor.
 * - Lista agrupada por categoria
 * - CRUD (gestores editam, todos leem)
 * - Editor com co-pilot Claude (sugestões + melhorias)
 * - Mesmos scripts são injetados no /api/hb-ia/suggest como base de conhecimento
 */
import { useEffect, useMemo, useState } from "react";
import {
  Plus, Edit2, Trash2, X, Save, Loader2, Sparkles, BookOpen, Copy, Search,
  Check, RefreshCw, AlertCircle, ChevronDown,
} from "lucide-react";
import { supabase } from "../../lib/supabase";
import { fmtRelative } from "../../lib/format";
import type { AppUser } from "../../lib/auth";

const AGENTE_URL = "https://agente.parket.works";

type Script = {
  id: string;
  titulo: string;
  etapa: string | null;
  funil: string | null;
  categoria: string | null;
  texto: string;
  observacoes: string | null;
  ativo: boolean;
  uso_count: number;
  criado_por: string | null;
  created_at: string;
  updated_at: string;
};

const CATEGORIAS = [
  { key: "abertura",      label: "🚪 Abertura / Quebra-gelo" },
  { key: "qualificacao",  label: "🔍 Qualificação" },
  { key: "agendamento",   label: "📅 Agendamento de visita" },
  { key: "orcamento",     label: "💰 Envio de orçamento" },
  { key: "objecao",       label: "🛡️ Quebra de objeção" },
  { key: "fechamento",    label: "🏆 Fechamento" },
  { key: "followup",      label: "📞 Follow-up" },
  { key: "reativacao",    label: "🔥 Reativação" },
];

const ETAPAS_SDR = [
  "leads-de-entrada", "triagem-ia", "em-qualificacao", "qualificado",
  "qualificado-ia", "contato-inicial", "follow-up-1", "follow-up-2", "follow-up-3",
  "nao-qualificado", "vendedor",
];
const ETAPAS_VENDAS = [
  "novas-oportunidades", "contato-inicial", "em-briefing", "criacao-orcamento",
  "apresentacao-proposta", "em-negociacao", "ganho", "perda",
];

const VARIAVEIS_DISPONIVEIS = ["nome", "produto", "metragem", "valor", "cidade", "prazo", "sdr"];

export function ScriptsPage({ appUser }: { appUser: AppUser }) {
  const [scripts, setScripts] = useState<Script[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<Partial<Script> | null>(null);
  const [filterCat, setFilterCat] = useState<string>("");
  const isGestor = appUser.isGestor;

  const reload = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("hb_scripts")
      .select("*")
      .order("categoria", { ascending: true })
      .order("uso_count", { ascending: false });
    if (!error) setScripts((data || []) as Script[]);
    setLoading(false);
  };
  useEffect(() => { reload(); }, []);

  const filtered = useMemo(() => {
    let arr = scripts;
    if (filterCat) arr = arr.filter((s) => s.categoria === filterCat);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      arr = arr.filter((s) =>
        s.titulo.toLowerCase().includes(q) ||
        s.texto.toLowerCase().includes(q) ||
        (s.observacoes || "").toLowerCase().includes(q) ||
        (s.etapa || "").toLowerCase().includes(q)
      );
    }
    return arr;
  }, [scripts, search, filterCat]);

  const porCategoria = useMemo(() => {
    const m: Record<string, Script[]> = {};
    filtered.forEach((s) => {
      const k = s.categoria || "outros";
      if (!m[k]) m[k] = [];
      m[k].push(s);
    });
    return m;
  }, [filtered]);

  return (
    <div className="h-full flex flex-col">
      <div className="border-b border-hb-border bg-hb-panel px-4 py-3 flex items-center justify-between gap-3 flex-wrap">
        <div>
          <div className="text-sm font-bold uppercase tracking-wider text-hb-gold flex items-center gap-2">
            <BookOpen size={14} /> Scripts comerciais Parket
          </div>
          <div className="text-[10px] text-hb-textDim mt-0.5">
            Biblioteca de scripts pro SDR/vendedor · usado como base de conhecimento do Copiloto IA
          </div>
        </div>
        {isGestor && (
          <button onClick={() => setEditing({
            titulo: "", texto: "", categoria: "qualificacao", funil: "ambos", ativo: true,
          })} className="bg-hb-accent text-hb-bg font-semibold rounded px-3 py-1.5 text-xs flex items-center gap-1 hover:bg-hb-gold">
            <Plus size={12} /> Novo script
          </button>
        )}
      </div>

      <div className="px-4 py-2 border-b border-hb-border bg-hb-panel/50 flex items-center gap-2 flex-wrap">
        <div className="relative max-w-md flex-1 min-w-[200px]">
          <Search size={11} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-hb-textDim" />
          <input value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar título, texto, etapa…"
            className="w-full bg-hb-bg border border-hb-border rounded pl-7 pr-2 py-1.5 text-xs outline-none focus:border-hb-accent" />
        </div>
        <div className="flex gap-1 flex-wrap">
          <button onClick={() => setFilterCat("")}
            className={`px-2 py-1 rounded text-[10px] font-semibold transition ${
              !filterCat ? "bg-hb-accent text-hb-bg" : "text-hb-textDim hover:text-hb-text border border-hb-border"
            }`}>Todas</button>
          {CATEGORIAS.map((c) => (
            <button key={c.key} onClick={() => setFilterCat(c.key)}
              className={`px-2 py-1 rounded text-[10px] font-semibold transition ${
                filterCat === c.key ? "bg-hb-accent text-hb-bg" : "text-hb-textDim hover:text-hb-text border border-hb-border"
              }`}>
              {c.label}
            </button>
          ))}
        </div>
        <span className="text-[10px] text-hb-textDim ml-auto">{filtered.length} scripts</span>
      </div>

      <div className="flex-1 overflow-auto p-4 space-y-4">
        {loading && <div className="text-center text-hb-textDim text-xs py-8"><Loader2 size={14} className="animate-spin inline mr-1" /> Carregando…</div>}
        {!loading && filtered.length === 0 && (
          <div className="text-center text-hb-textDim text-xs py-12">
            Nenhum script {filterCat ? "nesta categoria" : ""}.
            {isGestor && <div className="mt-2">Clique em <strong>+ Novo script</strong> pra criar o primeiro.</div>}
          </div>
        )}
        {Object.entries(porCategoria).map(([cat, items]) => {
          const meta = CATEGORIAS.find((c) => c.key === cat);
          return (
            <div key={cat}>
              <div className="text-xs uppercase tracking-wider text-hb-gold font-bold mb-2">
                {meta?.label || cat} <span className="text-hb-textDim">({items.length})</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {items.map((s) => (
                  <ScriptCard key={s.id} script={s} isGestor={isGestor}
                    onEdit={() => setEditing(s)}
                    onDelete={async () => {
                      if (!confirm(`Excluir "${s.titulo}"?`)) return;
                      await supabase.from("hb_scripts").delete().eq("id", s.id);
                      reload();
                    }} />
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {editing && (
        <ScriptEditor script={editing} appUser={appUser}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); reload(); }} />
      )}
    </div>
  );
}

// ─── Card de script (lista) ────────────────────────────────────
function ScriptCard({ script, isGestor, onEdit, onDelete }: { script: Script; isGestor: boolean; onEdit: () => void; onDelete: () => void }) {
  const [copied, setCopied] = useState(false);
  const copiar = () => {
    navigator.clipboard.writeText(script.texto);
    setCopied(true); setTimeout(() => setCopied(false), 1500);
  };
  return (
    <div className={`bg-hb-panel border rounded-lg p-3 hover:border-hb-accent/60 transition ${
      script.ativo ? "border-hb-border" : "border-hb-border opacity-50"
    }`}>
      <div className="flex items-start justify-between gap-2 mb-1.5">
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-xs text-hb-text">{script.titulo}</div>
          <div className="flex items-center gap-1 text-[9px] text-hb-textDim mt-0.5">
            {script.etapa && <span className="font-mono">{script.etapa}</span>}
            {script.funil && <span className="bg-hb-bg/50 border border-hb-border rounded px-1">{script.funil}</span>}
            <span className="text-hb-gold">↺ {script.uso_count}</span>
            {!script.ativo && <span className="text-hb-red">inativo</span>}
          </div>
        </div>
        <div className="flex gap-1">
          <button onClick={copiar} title="Copiar" className="text-hb-textDim hover:text-hb-text p-1">
            {copied ? <Check size={11} className="text-hb-green" /> : <Copy size={11} />}
          </button>
          {isGestor && (
            <>
              <button onClick={onEdit} title="Editar" className="text-hb-textDim hover:text-hb-blue p-1"><Edit2 size={11} /></button>
              <button onClick={onDelete} title="Excluir" className="text-hb-textDim hover:text-hb-red p-1"><Trash2 size={11} /></button>
            </>
          )}
        </div>
      </div>
      <div className="text-[11px] text-hb-text whitespace-pre-wrap leading-snug bg-hb-bg/40 rounded p-2 border border-hb-border">
        {script.texto}
      </div>
      {script.observacoes && (
        <div className="text-[10px] text-hb-textDim mt-1.5 italic leading-snug">
          💡 {script.observacoes}
        </div>
      )}
      <div className="text-[9px] text-hb-textDim mt-1.5 text-right tabular">
        atualizado {fmtRelative(script.updated_at)}
      </div>
    </div>
  );
}

// ─── Editor com co-pilot Claude ────────────────────────────────
function ScriptEditor({ script, appUser, onClose, onSaved }: { script: Partial<Script>; appUser: AppUser; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState<Partial<Script>>(script);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Co-pilot Claude
  const [aiLoading, setAiLoading] = useState(false);
  const [aiSugs, setAiSugs] = useState<{ titulo: string; texto: string; motivo: string }[]>([]);
  const [aiMode, setAiMode] = useState<"variacoes" | "melhorar">("variacoes");

  const set = (k: keyof Script, v: any) => setForm((f) => ({ ...f, [k]: v }));

  const salvar = async () => {
    if (!form.titulo?.trim() || !form.texto?.trim()) {
      setError("Título e texto são obrigatórios");
      return;
    }
    setSaving(true); setError(null);
    try {
      const payload: any = {
        titulo: form.titulo.trim(),
        etapa: form.etapa || null,
        funil: form.funil || "ambos",
        categoria: form.categoria || null,
        texto: form.texto.trim(),
        observacoes: form.observacoes?.trim() || null,
        ativo: form.ativo !== false,
      };
      if (form.id) {
        await supabase.from("hb_scripts").update(payload).eq("id", form.id);
      } else {
        payload.criado_por = appUser.id;
        await supabase.from("hb_scripts").insert(payload);
      }
      onSaved();
    } catch (e: any) {
      setError(e.message || String(e));
    } finally { setSaving(false); }
  };

  const askClaude = async (modo: "variacoes" | "melhorar") => {
    setAiMode(modo); setAiLoading(true); setAiSugs([]);
    try {
      const r = await fetch(`${AGENTE_URL}/api/hb-ia/sugerir-script`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          titulo: form.titulo, etapa: form.etapa, funil: form.funil,
          categoria: form.categoria, texto_atual: form.texto,
          observacoes: form.observacoes, modo,
        }),
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}: ${(await r.text()).slice(0, 200)}`);
      const data = await r.json();
      setAiSugs(data.sugestoes || []);
    } catch (e: any) {
      setError(e.message || String(e));
    } finally { setAiLoading(false); }
  };

  // Preview do texto com variáveis substituídas
  const preview = useMemo(() => {
    const exemplos: Record<string, string> = {
      nome: "Marina", produto: "piso de carvalho", metragem: "120",
      valor: "185.000", cidade: "São Paulo", prazo: "dezembro", sdr: appUser.nome || "SDR",
    };
    return (form.texto || "").replace(/\{(\w+)\}/g, (_, k) => exemplos[k] || `{${k}}`);
  }, [form.texto, appUser.nome]);

  const etapasOptions = useMemo(() => {
    const f = form.funil || "ambos";
    if (f === "sdr") return ETAPAS_SDR;
    if (f === "vendas") return ETAPAS_VENDAS;
    return [...new Set([...ETAPAS_SDR, ...ETAPAS_VENDAS])];
  }, [form.funil]);

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4" onMouseDown={onClose}>
      <div onMouseDown={(e) => e.stopPropagation()}
        className="bg-hb-bg border border-hb-border rounded-xl w-full max-w-5xl max-h-[92vh] overflow-hidden flex flex-col">
        <div className="px-4 py-3 border-b border-hb-border flex items-center justify-between bg-hb-panel">
          <div className="font-bold text-sm">{form.id ? "Editar script" : "Novo script"}</div>
          <button onClick={onClose} className="text-hb-textDim hover:text-hb-text"><X size={14} /></button>
        </div>

        <div className="flex-1 overflow-auto grid grid-cols-1 lg:grid-cols-2 gap-4 p-4">
          {/* Editor */}
          <div className="space-y-3">
            <FormRow label="Título">
              <input value={form.titulo || ""} onChange={(e) => set("titulo", e.target.value)}
                placeholder="Ex: Quebra-gelo qualificação"
                className="w-full bg-hb-panel border border-hb-border rounded px-3 py-2 text-xs outline-none focus:border-hb-accent" />
            </FormRow>
            <div className="grid grid-cols-3 gap-2">
              <FormRow label="Funil">
                <select value={form.funil || "ambos"} onChange={(e) => set("funil", e.target.value)}
                  className="w-full bg-hb-panel border border-hb-border rounded px-2 py-2 text-xs outline-none focus:border-hb-accent">
                  <option value="ambos">Ambos</option>
                  <option value="sdr">SDR</option>
                  <option value="vendas">Vendas</option>
                </select>
              </FormRow>
              <FormRow label="Categoria">
                <select value={form.categoria || ""} onChange={(e) => set("categoria", e.target.value)}
                  className="w-full bg-hb-panel border border-hb-border rounded px-2 py-2 text-xs outline-none focus:border-hb-accent">
                  <option value="">—</option>
                  {CATEGORIAS.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
                </select>
              </FormRow>
              <FormRow label="Etapa do funil">
                <select value={form.etapa || ""} onChange={(e) => set("etapa", e.target.value || null)}
                  className="w-full bg-hb-panel border border-hb-border rounded px-2 py-2 text-xs outline-none focus:border-hb-accent">
                  <option value="">Qualquer etapa</option>
                  {etapasOptions.map((e) => <option key={e} value={e}>{e}</option>)}
                </select>
              </FormRow>
            </div>
            <FormRow label="Texto do script" hint={`Variáveis: ${VARIAVEIS_DISPONIVEIS.map((v) => `{${v}}`).join(" · ")}`}>
              <textarea value={form.texto || ""} onChange={(e) => set("texto", e.target.value)}
                rows={6} placeholder="Oi {nome}! Tudo bem? Vi que..."
                className="w-full bg-hb-panel border border-hb-border rounded px-3 py-2 text-xs outline-none focus:border-hb-accent resize-none font-mono" />
            </FormRow>
            <FormRow label="Observações (contexto pra IA usar)">
              <textarea value={form.observacoes || ""} onChange={(e) => set("observacoes", e.target.value)}
                rows={2} placeholder="Quando usar este script…"
                className="w-full bg-hb-panel border border-hb-border rounded px-3 py-2 text-xs outline-none focus:border-hb-accent resize-none" />
            </FormRow>
            <label className="flex items-center gap-2 text-xs">
              <input type="checkbox" checked={form.ativo !== false} onChange={(e) => set("ativo", e.target.checked)} />
              <span>Ativo (disponível pro SDR usar e pra IA referenciar)</span>
            </label>

            {preview && (
              <div className="bg-hb-accent/5 border border-hb-accent/30 rounded p-3 mt-2">
                <div className="text-[9px] uppercase tracking-wider font-bold text-hb-accent mb-1">Preview com exemplo</div>
                <div className="text-[11px] text-hb-text whitespace-pre-wrap">{preview}</div>
              </div>
            )}

            {error && (
              <div className="text-[11px] text-hb-red bg-hb-red/10 border border-hb-red/30 rounded p-2 flex items-center gap-1">
                <AlertCircle size={11} /> {error}
              </div>
            )}
          </div>

          {/* Co-pilot Claude */}
          <div className="space-y-2">
            <div className="bg-hb-panel border border-hb-blue/30 rounded-lg p-3">
              <div className="flex items-center justify-between mb-2">
                <div className="text-xs font-bold uppercase tracking-wider text-hb-blue flex items-center gap-1">
                  <Sparkles size={11} /> Co-pilot Claude
                </div>
                <span className="text-[10px] text-hb-textDim flex items-center gap-1 font-semibold">
                  <img src="/claude-symbol.svg" alt="" className="h-3 w-3" /> Claude
                </span>
              </div>
              <div className="text-[10px] text-hb-textDim leading-snug mb-2">
                Deixe a IA construir junto com você. Ela conhece os scripts já cadastrados e mantém consistência de tom.
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                <button onClick={() => askClaude("variacoes")} disabled={aiLoading}
                  className="text-[10px] font-semibold bg-hb-blue/15 border border-hb-blue/40 text-hb-blue rounded py-1.5 hover:bg-hb-blue/25 disabled:opacity-50 flex items-center justify-center gap-1">
                  {aiLoading && aiMode === "variacoes" ? <Loader2 size={10} className="animate-spin" /> : <Sparkles size={10} />}
                  Sugerir 3 variações
                </button>
                <button onClick={() => askClaude("melhorar")} disabled={aiLoading || !form.texto?.trim()}
                  className="text-[10px] font-semibold bg-hb-blue/15 border border-hb-blue/40 text-hb-blue rounded py-1.5 hover:bg-hb-blue/25 disabled:opacity-50 flex items-center justify-center gap-1">
                  {aiLoading && aiMode === "melhorar" ? <Loader2 size={10} className="animate-spin" /> : <RefreshCw size={10} />}
                  Melhorar meu texto
                </button>
              </div>
            </div>

            {aiLoading && (
              <div className="text-center py-6 text-hb-textDim text-[10px]">
                <Loader2 size={14} className="animate-spin inline mr-1" /> Claude pensando…
              </div>
            )}

            <div className="space-y-2">
              {aiSugs.map((s, i) => (
                <div key={i} className="bg-hb-panel border border-hb-border rounded p-2.5">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[10px] uppercase tracking-wider font-bold text-hb-accent">
                      💡 {s.titulo}
                    </span>
                    <button onClick={() => set("texto", s.texto)}
                      className="text-[10px] font-bold bg-hb-accent text-hb-bg rounded px-2 py-0.5 hover:bg-hb-gold">
                      Usar →
                    </button>
                  </div>
                  <div className="text-[11px] text-hb-text whitespace-pre-wrap font-mono leading-snug">{s.texto}</div>
                  {s.motivo && (
                    <div className="text-[10px] text-hb-textDim mt-1.5 italic">{s.motivo}</div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="px-4 py-3 border-t border-hb-border bg-hb-panel flex items-center justify-end gap-2">
          <button onClick={onClose} className="text-xs text-hb-textDim hover:text-hb-text px-3 py-2">Cancelar</button>
          <button onClick={salvar} disabled={saving}
            className="bg-hb-accent text-hb-bg font-semibold rounded px-4 py-2 text-xs flex items-center gap-1 hover:bg-hb-gold disabled:opacity-50">
            {saving ? <Loader2 size={11} className="animate-spin" /> : <Save size={11} />}
            {form.id ? "Salvar alterações" : "Criar script"}
          </button>
        </div>
      </div>
    </div>
  );
}

function FormRow({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-hb-textDim font-semibold mb-1 flex items-center justify-between">
        <span>{label}</span>
        {hint && <span className="text-[9px] normal-case text-hb-textDim">{hint}</span>}
      </div>
      {children}
    </div>
  );
}
