/**
 * Configurações — administração geral do RH.
 *
 * Abas:
 *   - Modelos: CRUD de templates de documentos (rh.modelos_documento)
 *   - Integrações: status Clicksign + Evolution + Supabase + webhook URL
 *   - Sistema: empresas vinculadas, healthcheck geral, info ambiente
 */
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Settings, Plus, Pencil, Trash2, X, Loader2, CheckCircle2, AlertTriangle,
  FileText, Link2, Server, Building, Copy, ExternalLink, Webhook, MessageCircle,
  Eye, EyeOff, Power, Save,
} from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Input } from "@/components/ui/Input";
import { supabase } from "@/lib/supabase";
import { useFetch, api, clicksign } from "@/lib/api";

const CATEGORIAS = [
  { key: "advertencia", label: "Advertências / Suspensão", color: "text-red-400" },
  { key: "contrato", label: "Contratos", color: "text-emerald-400" },
  { key: "termo", label: "Termos", color: "text-blue-400" },
  { key: "nr", label: "NRs (treinamentos)", color: "text-yellow-400" },
  { key: "rescisao", label: "Rescisão", color: "text-rose-400" },
  { key: "ficha", label: "Fichas", color: "text-purple-400" },
  { key: "mural", label: "Murais", color: "text-cyan-400" },
];

type Modelo = {
  id: string;
  tipo: string;
  variante: string | null;
  titulo: string;
  descricao: string | null;
  categoria: string;
  ordem: number | null;
  ativo: boolean;
  conteudo_html: string;
  campos: any[];
  empresa_id: string | null;
  created_at: string;
  updated_at: string;
};

type CampoTpl = {
  key: string;
  type: "text" | "date" | "number" | "textarea" | "select";
  label: string;
  required?: boolean;
  default?: string;
  placeholder?: string;
  options?: string[];
};

export function ConfiguracoesPage() {
  const [tab, setTab] = useState<"modelos" | "integracoes" | "sistema">("modelos");

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Settings size={22} /> Configurações
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Administração do RH — modelos, integrações e parâmetros do sistema.
          </p>
        </div>
      </div>

      <div className="flex gap-2 border-b border-border">
        {[
          { key: "modelos", label: "Modelos de Documento", icon: FileText },
          { key: "integracoes", label: "Integrações", icon: Link2 },
          { key: "sistema", label: "Sistema", icon: Server },
        ].map((t) => (
          <button key={t.key} onClick={() => setTab(t.key as any)}
            className={`px-4 py-2 text-sm font-semibold border-b-2 transition flex items-center gap-1.5 ${
              tab === t.key
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}>
            <t.icon size={14} /> {t.label}
          </button>
        ))}
      </div>

      {tab === "modelos" && <ModelosTab />}
      {tab === "integracoes" && <IntegracoesTab />}
      {tab === "sistema" && <SistemaTab />}
    </div>
  );
}

// ─────────────────────────────────────────────────
// MODELOS — CRUD completo
// ─────────────────────────────────────────────────

function ModelosTab() {
  const [modelos, setModelos] = useState<Modelo[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [catFilter, setCatFilter] = useState("");
  const [showInactive, setShowInactive] = useState(false);
  const [editing, setEditing] = useState<Modelo | null>(null);
  const [creating, setCreating] = useState(false);

  const reload = async () => {
    setLoading(true);
    const { data } = await supabase.from("modelos_documento")
      .select("*").order("categoria").order("ordem");
    setModelos((data || []) as Modelo[]);
    setLoading(false);
  };
  useEffect(() => { reload(); }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return modelos.filter((m) => {
      if (!showInactive && !m.ativo) return false;
      if (catFilter && m.categoria !== catFilter) return false;
      if (q && !m.titulo.toLowerCase().includes(q) && !m.tipo.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [modelos, search, catFilter, showInactive]);

  const byCat = useMemo(() => {
    const m: Record<string, Modelo[]> = {};
    filtered.forEach((mod) => {
      m[mod.categoria] = m[mod.categoria] || [];
      m[mod.categoria].push(mod);
    });
    return m;
  }, [filtered]);

  const onToggleAtivo = async (m: Modelo) => {
    await supabase.from("modelos_documento").update({ ativo: !m.ativo }).eq("id", m.id);
    reload();
  };

  const onDelete = async (m: Modelo) => {
    if (!confirm(`Apagar o modelo "${m.titulo}"? Não dá pra desfazer.`)) return;
    await supabase.from("modelos_documento").delete().eq("id", m.id);
    reload();
  };

  if (loading) {
    return <div className="flex items-center gap-2 text-sm text-muted-foreground p-8 justify-center">
      <Loader2 size={14} className="animate-spin" /> Carregando…
    </div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[240px] max-w-md">
          <Input placeholder="Buscar modelo…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <select value={catFilter} onChange={(e) => setCatFilter(e.target.value)}
          className="h-9 bg-input border border-border rounded-md text-xs px-3">
          <option value="">Todas categorias</option>
          {CATEGORIAS.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
        </select>
        <label className="flex items-center gap-2 text-xs cursor-pointer">
          <input type="checkbox" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} />
          Mostrar inativos
        </label>
        <div className="ml-auto" />
        <Button onClick={() => setCreating(true)}><Plus size={14} /> Novo modelo</Button>
      </div>

      {Object.keys(byCat).length === 0 ? (
        <Card className="p-12 text-center">
          <FileText size={32} className="mx-auto text-muted-foreground mb-3" />
          <div className="font-semibold mb-1">Nenhum modelo encontrado</div>
          <div className="text-sm text-muted-foreground">Crie o primeiro clicando em "Novo modelo".</div>
        </Card>
      ) : (
        Object.entries(byCat).map(([cat, items]) => {
          const meta = CATEGORIAS.find((c) => c.key === cat);
          return (
            <Card key={cat} className="p-4">
              <div className={`text-xs uppercase tracking-wider font-semibold mb-3 ${meta?.color || "text-muted-foreground"}`}>
                {meta?.label || cat} · {items.length}
              </div>
              <div className="space-y-1.5">
                {items.map((m) => (
                  <div key={m.id} className={`flex items-center gap-3 px-3 py-2 rounded hover:bg-secondary/30 ${!m.ativo ? "opacity-50" : ""}`}>
                    <FileText size={14} className="text-muted-foreground shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold truncate">{m.titulo}</div>
                      <div className="text-[10px] text-muted-foreground">
                        tipo: <code>{m.tipo}{m.variante ? `/${m.variante}` : ""}</code> · {(m.campos || []).length} campo{(m.campos || []).length !== 1 ? "s" : ""}
                        {!m.ativo && " · INATIVO"}
                      </div>
                    </div>
                    <Button size="sm" variant="outline" onClick={() => onToggleAtivo(m)} title={m.ativo ? "Desativar" : "Ativar"}>
                      <Power size={11} />
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setEditing(m)} title="Editar">
                      <Pencil size={11} />
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => onDelete(m)} title="Apagar"
                      className="text-rose-400 hover:bg-rose-500/10">
                      <Trash2 size={11} />
                    </Button>
                  </div>
                ))}
              </div>
            </Card>
          );
        })
      )}

      {(editing || creating) && (
        <ModeloEditModal
          modelo={editing}
          onClose={() => { setEditing(null); setCreating(false); }}
          onSaved={() => { setEditing(null); setCreating(false); reload(); }}
        />
      )}
    </div>
  );
}

function ModeloEditModal({ modelo, onClose, onSaved }:
  { modelo: Modelo | null; onClose: () => void; onSaved: () => void }) {
  const isNew = !modelo;
  const [form, setForm] = useState({
    tipo: modelo?.tipo || "",
    variante: modelo?.variante || "",
    titulo: modelo?.titulo || "",
    descricao: modelo?.descricao || "",
    categoria: modelo?.categoria || "termo",
    ordem: modelo?.ordem ?? 100,
    ativo: modelo?.ativo ?? true,
    conteudo_html: modelo?.conteudo_html || "<h1>Título</h1>\n<p>Eu, <strong>{{nome}}</strong>, CPF {{cpf}}, declaro…</p>\n<p style=\"margin-top:40px\">{{cidade}}, {{data}}</p>",
    campos: (modelo?.campos as CampoTpl[]) || [
      { key: "cidade", type: "text", label: "Cidade", default: "São Paulo", required: true },
      { key: "data", type: "date", label: "Data", required: true },
    ],
  });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [preview, setPreview] = useState(false);

  const updateCampo = (idx: number, patch: Partial<CampoTpl>) => {
    setForm({ ...form, campos: form.campos.map((c, i) => i === idx ? { ...c, ...patch } : c) });
  };
  const addCampo = () => setForm({ ...form, campos: [...form.campos, { key: "novo_campo", type: "text", label: "Novo campo" }] });
  const removeCampo = (idx: number) => setForm({ ...form, campos: form.campos.filter((_, i) => i !== idx) });

  const submit = async () => {
    setErr(null);
    if (!form.titulo.trim()) { setErr("Título é obrigatório"); return; }
    if (!form.tipo.trim()) { setErr("Tipo é obrigatório (slug interno)"); return; }
    setSaving(true);
    const payload = {
      tipo: form.tipo.trim(),
      variante: form.variante.trim() || null,
      titulo: form.titulo.trim(),
      descricao: form.descricao.trim() || null,
      categoria: form.categoria,
      ordem: form.ordem,
      ativo: form.ativo,
      conteudo_html: form.conteudo_html,
      campos: form.campos,
    };
    const { error } = isNew
      ? await supabase.from("modelos_documento").insert(payload)
      : await supabase.from("modelos_documento").update(payload).eq("id", modelo!.id);
    setSaving(false);
    if (error) { setErr(error.message); return; }
    onSaved();
  };

  // preview com campos substituídos por valores fake
  const previewHtml = useMemo(() => {
    let out = form.conteudo_html;
    const subs: Record<string, string> = {
      nome: "NATHAN CESAR DA SILVA MEDEIROS",
      cpf: "453.684.758-88",
      empresa: "PARKET",
      cnpj: "22.951.220/0001-33",
      cargo: "ANALISTA DE SISTEMAS",
      cidade: "São Paulo",
      data: new Date().toLocaleDateString("pt-BR"),
    };
    form.campos.forEach((c) => {
      if (c.default !== undefined) subs[c.key] = String(c.default);
      if (!subs[c.key]) subs[c.key] = `[${c.label}]`;
    });
    for (const [k, v] of Object.entries(subs)) {
      out = out.replace(new RegExp(`{{\\s*${k}\\s*}}`, "g"), v);
    }
    return out.replace(/{{\s*(\w+)\s*}}/g, '<span style="background:#fee;color:#c00">[$1]</span>');
  }, [form.conteudo_html, form.campos]);

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <Card className="w-full max-w-6xl h-[92vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div>
            <div className="text-base font-bold">{isNew ? "Novo modelo" : "Editar modelo"}</div>
            <div className="text-xs text-muted-foreground mt-0.5">
              Use <code>{`{{nome}}`}</code> <code>{`{{cpf}}`}</code> <code>{`{{empresa}}`}</code> <code>{`{{cnpj}}`}</code> <code>{`{{cargo}}`}</code> <code>{`{{cidade}}`}</code> <code>{`{{data}}`}</code> + qualquer campo custom no HTML.
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setPreview(!preview)}>
              {preview ? <EyeOff size={11} /> : <Eye size={11} />} Preview
            </Button>
            <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X size={18} /></button>
          </div>
        </div>

        <div className="flex-1 overflow-hidden flex">
          <div className="w-1/2 overflow-y-auto p-4 border-r border-border space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium mb-1 block">Título *</label>
                <Input value={form.titulo} onChange={(e) => setForm({ ...form, titulo: e.target.value })} placeholder="Ex: Termo de Confidencialidade" />
              </div>
              <div>
                <label className="text-xs font-medium mb-1 block">Categoria</label>
                <select value={form.categoria} onChange={(e) => setForm({ ...form, categoria: e.target.value })}
                  className="w-full h-9 bg-input border border-border rounded-md text-xs px-3">
                  {CATEGORIAS.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium mb-1 block">Tipo (slug) *</label>
                <Input value={form.tipo} onChange={(e) => setForm({ ...form, tipo: e.target.value.replace(/[^a-z0-9_]/g, "") })} placeholder="termo_confidencialidade" />
              </div>
              <div>
                <label className="text-xs font-medium mb-1 block">Variante (opcional)</label>
                <Input value={form.variante} onChange={(e) => setForm({ ...form, variante: e.target.value })} placeholder="ex: 01" />
              </div>
              <div>
                <label className="text-xs font-medium mb-1 block">Ordem</label>
                <Input type="number" value={form.ordem} onChange={(e) => setForm({ ...form, ordem: parseInt(e.target.value) || 0 })} />
              </div>
              <div className="flex items-end">
                <label className="flex items-center gap-2 text-xs cursor-pointer h-9">
                  <input type="checkbox" checked={form.ativo} onChange={(e) => setForm({ ...form, ativo: e.target.checked })} />
                  Modelo ativo
                </label>
              </div>
            </div>
            <div>
              <label className="text-xs font-medium mb-1 block">Descrição</label>
              <Input value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} placeholder="Resumo de uma linha pra UI" />
            </div>
            <div>
              <label className="text-xs font-medium mb-1 block">Conteúdo HTML</label>
              <textarea value={form.conteudo_html}
                onChange={(e) => setForm({ ...form, conteudo_html: e.target.value })}
                rows={12}
                className="w-full bg-input border border-border rounded-md text-xs p-2 font-mono outline-none focus:ring-2 focus:ring-ring" />
            </div>

            <div className="pt-2 border-t border-border space-y-2">
              <div className="flex items-center justify-between">
                <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Campos custom</div>
                <Button size="sm" variant="outline" onClick={addCampo}><Plus size={11} /> Campo</Button>
              </div>
              {form.campos.map((c, i) => (
                <div key={i} className="grid grid-cols-12 gap-1.5 items-end">
                  <div className="col-span-3">
                    <Input placeholder="key" value={c.key} onChange={(e) => updateCampo(i, { key: e.target.value.replace(/[^a-z0-9_]/g, "") })} />
                  </div>
                  <div className="col-span-3">
                    <Input placeholder="Label" value={c.label} onChange={(e) => updateCampo(i, { label: e.target.value })} />
                  </div>
                  <div className="col-span-2">
                    <select value={c.type} onChange={(e) => updateCampo(i, { type: e.target.value as any })}
                      className="w-full h-9 bg-input border border-border rounded-md text-xs px-2">
                      <option value="text">texto</option>
                      <option value="date">data</option>
                      <option value="number">número</option>
                      <option value="textarea">parágrafo</option>
                      <option value="select">opções</option>
                    </select>
                  </div>
                  <div className="col-span-2">
                    <Input placeholder="Default" value={c.default || ""} onChange={(e) => updateCampo(i, { default: e.target.value })} />
                  </div>
                  <div className="col-span-1 flex items-center justify-center">
                    <label className="text-[10px] flex items-center gap-1">
                      <input type="checkbox" checked={!!c.required} onChange={(e) => updateCampo(i, { required: e.target.checked })} />
                      req
                    </label>
                  </div>
                  <div className="col-span-1">
                    <Button size="sm" variant="outline" onClick={() => removeCampo(i)} className="text-rose-400">
                      <X size={11} />
                    </Button>
                  </div>
                </div>
              ))}
            </div>

            {err && <div className="text-xs text-red-400">{err}</div>}
            <Button onClick={submit} disabled={saving} className="w-full">
              {saving && <Loader2 size={12} className="animate-spin" />}
              <Save size={12} /> {isNew ? "Criar modelo" : "Salvar"}
            </Button>
          </div>

          {preview ? (
            <div className="flex-1 overflow-y-auto p-6 bg-white text-black">
              <div className="max-w-[600px] mx-auto" dangerouslySetInnerHTML={{ __html: previewHtml }} />
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto p-6 bg-secondary/20 text-xs space-y-3">
              <div className="font-semibold uppercase tracking-wider text-muted-foreground">Placeholders disponíveis</div>
              <div className="space-y-1.5">
                {["nome", "cpf", "empresa", "cnpj", "cargo", "cidade", "data"].map((k) => (
                  <code key={k} className="block px-2 py-1 bg-secondary rounded">{`{{${k}}}`}</code>
                ))}
                {form.campos.map((c) => (
                  <code key={c.key} className="block px-2 py-1 bg-primary/10 text-primary rounded">{`{{${c.key}}}`} <span className="text-muted-foreground">— {c.label}</span></code>
                ))}
              </div>
              <div className="pt-3 border-t border-border text-muted-foreground">
                Os placeholders são substituídos automaticamente quando você envia o documento via Clicksign ou assinatura interna.
                Clique em "Preview" pra ver o resultado renderizado.
              </div>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}

// ─────────────────────────────────────────────────
// INTEGRAÇÕES — status de Clicksign, Evolution, Supabase
// ─────────────────────────────────────────────────

function IntegracoesTab() {
  const [csHealth, setCsHealth] = useState<any>(null);
  const [csLoading, setCsLoading] = useState(true);
  const [ultEvento, setUltEvento] = useState<any>(null);
  const [evolutionStatus, setEvolutionStatus] = useState<any>(null);

  useEffect(() => {
    (async () => {
      setCsLoading(true);
      try { setCsHealth(await clicksign.healthcheck()); } catch { setCsHealth({ ok: false }); }
      setCsLoading(false);
    })();
    (async () => {
      const { data } = await supabase.from("clicksign_eventos")
        .select("evento, recebido_em, envelope_id").order("recebido_em", { ascending: false }).limit(1);
      setUltEvento(data?.[0] || null);
    })();
    (async () => {
      try {
        const r = await fetch("https://conect.parket.works/instance/fetchInstances", {
          headers: { apikey: "4eab105201410d6865b86dca76ee9fa3" },
        });
        if (r.ok) setEvolutionStatus(await r.json());
      } catch { setEvolutionStatus(null); }
    })();
  }, []);

  const copy = (s: string) => navigator.clipboard.writeText(s);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {/* CLICKSIGN */}
      <Card className="p-5 space-y-3">
        <div className="flex items-center gap-2">
          <Webhook size={18} className="text-emerald-400" />
          <h2 className="text-base font-bold flex-1">Clicksign</h2>
          {csLoading ? <Loader2 size={14} className="animate-spin" /> :
            csHealth?.ok ? <Badge variant="success" className="text-[10px]">Conectado</Badge> :
            <Badge variant="outline" className="text-[10px] text-rose-400 border-rose-500/40">Offline</Badge>}
        </div>
        <div className="text-xs text-muted-foreground">
          API REST v3 — assinatura jurídica de documentos. Envia por email + WhatsApp.
        </div>
        {csHealth?.ok && (
          <div className="space-y-2 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Versão API</span>
              <code className="text-[10px]">{csHealth.clicksign_api}</code>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Envelopes visíveis</span>
              <span>{csHealth.envelopes_visiveis_amostra ?? "?"}</span>
            </div>
            <div className="space-y-1">
              <span className="text-muted-foreground text-[10px]">Webhook URL (registre no painel app.clicksign.com)</span>
              <div className="flex items-center gap-1.5">
                <code className="flex-1 px-2 py-1.5 bg-secondary rounded text-[10px] truncate">{csHealth.webhook_url}</code>
                <Button size="sm" variant="outline" onClick={() => copy(csHealth.webhook_url)}>
                  <Copy size={11} />
                </Button>
              </div>
            </div>
            <div className="pt-1">
              <span className="text-muted-foreground text-[10px]">Último evento recebido</span>
              <div className="text-xs mt-1">
                {ultEvento ? (
                  <span><code className="text-emerald-400">{ultEvento.evento}</code> · {new Date(ultEvento.recebido_em).toLocaleString("pt-BR")}</span>
                ) : (
                  <span className="text-muted-foreground">Nenhum evento ainda</span>
                )}
              </div>
            </div>
          </div>
        )}
        <div className="pt-2 border-t border-border">
          <a href="https://app.clicksign.com" target="_blank" rel="noopener noreferrer"
            className="text-[11px] text-primary hover:underline flex items-center gap-1">
            <ExternalLink size={11} /> Abrir painel Clicksign
          </a>
        </div>
      </Card>

      {/* EVOLUTION */}
      <Card className="p-5 space-y-3">
        <div className="flex items-center gap-2">
          <MessageCircle size={18} className="text-emerald-400" />
          <h2 className="text-base font-bold flex-1">WhatsApp (Evolution)</h2>
          {evolutionStatus?.length ? (
            <Badge variant="success" className="text-[10px]">{evolutionStatus.length} instância{evolutionStatus.length !== 1 ? "s" : ""}</Badge>
          ) : (
            <Badge variant="outline" className="text-[10px]">…</Badge>
          )}
        </div>
        <div className="text-xs text-muted-foreground">
          Envio de WhatsApp via Evolution API. Instância <code>Rh - Parket</code> é a padrão.
        </div>
        <div className="space-y-1.5 text-xs">
          {(evolutionStatus || []).map((i: any) => (
            <div key={i.name} className="flex items-center justify-between p-2 bg-secondary/30 rounded">
              <div>
                <div className="font-semibold">{i.name}</div>
                <code className="text-[10px] text-muted-foreground">{i.ownerJid?.replace("@s.whatsapp.net", "") || "—"}</code>
              </div>
              {i.connectionStatus === "open" ? (
                <Badge variant="success" className="text-[10px]">Conectado</Badge>
              ) : (
                <Badge variant="outline" className="text-[10px] text-rose-400">Desconectado</Badge>
              )}
            </div>
          ))}
        </div>
      </Card>

      {/* SUPABASE / DB */}
      <Card className="p-5 space-y-3">
        <div className="flex items-center gap-2">
          <Server size={18} className="text-emerald-400" />
          <h2 className="text-base font-bold flex-1">Banco de dados</h2>
          <Badge variant="success" className="text-[10px]">Online</Badge>
        </div>
        <div className="text-xs text-muted-foreground">
          Supabase (PostgreSQL) — schemas <code>rh</code>, <code>core</code>, <code>public</code>.
        </div>
        <div className="space-y-1.5 text-xs">
          <div className="flex items-center justify-between p-2 bg-secondary/30 rounded">
            <span className="text-muted-foreground">URL</span>
            <code className="text-[10px]">hbxpilrxmitvzebluoom</code>
          </div>
          <div className="flex items-center justify-between p-2 bg-secondary/30 rounded">
            <span className="text-muted-foreground">Schema principal</span>
            <code className="text-[10px]">rh</code>
          </div>
        </div>
      </Card>

      {/* BACKEND */}
      <Card className="p-5 space-y-3">
        <div className="flex items-center gap-2">
          <Server size={18} className="text-emerald-400" />
          <h2 className="text-base font-bold flex-1">Backend RH-API</h2>
          {csHealth?.ok ? <Badge variant="success" className="text-[10px]">Online</Badge> :
            <Badge variant="outline" className="text-[10px] text-rose-400">Offline</Badge>}
        </div>
        <div className="text-xs text-muted-foreground">
          API dedicada do RH (stack <code>parket-rh-api</code>) — atende todas as rotas <code>/api/*</code> do <code>rh.parket.works</code>.
        </div>
        <div className="space-y-1.5 text-xs">
          <div className="flex items-center justify-between p-2 bg-secondary/30 rounded">
            <span className="text-muted-foreground">Healthcheck</span>
            <code className="text-[10px]">/api/healthz</code>
          </div>
          <div className="flex items-center justify-between p-2 bg-secondary/30 rounded">
            <span className="text-muted-foreground">Clicksign endpoints</span>
            <code className="text-[10px]">/api/clicksign/*</code>
          </div>
        </div>
      </Card>
    </div>
  );
}

// ─────────────────────────────────────────────────
// SISTEMA — empresas + atalhos
// ─────────────────────────────────────────────────

function SistemaTab() {
  const nav = useNavigate();
  const empresas = useFetch(() => api.empresas(), []);
  const colabs = useFetch(() => api.colaboradores(), []);
  const [stats, setStats] = useState<{ modelos: number; emitidos: number; pendentes: number }>({ modelos: 0, emitidos: 0, pendentes: 0 });

  useEffect(() => {
    (async () => {
      const [m, e, p] = await Promise.all([
        supabase.from("modelos_documento").select("id", { count: "exact", head: true }).eq("ativo", true),
        supabase.from("documentos_emitidos").select("id", { count: "exact", head: true }),
        supabase.from("documentos_emitidos").select("id", { count: "exact", head: true })
          .in("status", ["aguardando_assinatura", "enviando_clicksign", "visualizado"]),
      ]);
      setStats({
        modelos: m.count || 0,
        emitidos: e.count || 0,
        pendentes: p.count || 0,
      });
    })();
  }, []);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatBox label="Empresas" valor={(empresas.data || []).length} icon={Building} onClick={() => nav("/empresas")} />
        <StatBox label="Colaboradores" valor={(colabs.data || []).length} icon={FileText} onClick={() => nav("/colaboradores")} />
        <StatBox label="Modelos ativos" valor={stats.modelos} icon={FileText} />
        <StatBox label="Doc pendentes" valor={stats.pendentes} icon={AlertTriangle} color="text-amber-400" />
      </div>

      <Card className="p-4">
        <h3 className="font-semibold mb-3 text-sm">Empresas cadastradas</h3>
        <div className="space-y-1.5">
          {(empresas.data || []).map((e) => (
            <div key={e.id} className="flex items-center gap-3 p-2 hover:bg-secondary/30 rounded">
              <Building size={14} className="text-muted-foreground shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold">{e.razao_social}</div>
                <div className="text-[10px] text-muted-foreground">
                  CNPJ {e.cnpj}{e.cidade && ` · ${e.cidade}/${e.uf || ""}`}
                </div>
              </div>
              <Badge variant={e.ativo ? "success" : "outline"} className="text-[10px]">
                {e.ativo ? "Ativa" : "Inativa"}
              </Badge>
            </div>
          ))}
        </div>
      </Card>

      <Card className="p-4">
        <h3 className="font-semibold mb-3 text-sm">Sobre</h3>
        <div className="space-y-1 text-xs text-muted-foreground">
          <div>rh.parket.works — sistema de RH da Parket</div>
          <div>Schemas: <code>rh</code> (principal), <code>core</code> (empresas), <code>public</code> (legado)</div>
          <div>Backend: <code>parket-rh-api</code> (FastAPI) · Frontend: <code>parket-rh</code> (React + Vite)</div>
        </div>
      </Card>
    </div>
  );
}

function StatBox({ label, valor, icon: Icon, color, onClick }:
  { label: string; valor: number; icon: any; color?: string; onClick?: () => void }) {
  return (
    <Card className={`p-4 ${onClick ? "cursor-pointer hover:bg-secondary/30" : ""}`} onClick={onClick}>
      <div className="flex items-center gap-2">
        <Icon size={16} className={color || "text-muted-foreground"} />
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      </div>
      <div className="text-2xl font-bold mt-1">{valor.toLocaleString("pt-BR")}</div>
    </Card>
  );
}
