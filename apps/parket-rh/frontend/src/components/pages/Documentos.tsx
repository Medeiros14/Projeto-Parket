/**
 * Documentos — listagem de modelos + emissão para colaboradores.
 * Fluxo:
 *   1. Lista modelos por categoria
 *   2. Botão "Emitir" → modal escolhe colaborador + preenche campos
 *   3. Sistema cria rh.documentos_emitidos com token + status=aguardando_assinatura
 *   4. RH copia link / envia WhatsApp
 *   5. Colaborador acessa /assinar/:token, lê o doc, assina → status=assinado
 */
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Loader2, FileText, Plus, X, Search, Copy, MessageCircle, Mail, AlertTriangle, CheckCircle2, Users, Send, Phone, RefreshCw, XCircle, Eye } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Input } from "@/components/ui/Input";
import { supabase, supabaseCore } from "@/lib/supabase";
import { useFetch, api, sendWhatsAppViaAgent, clicksign } from "@/lib/api";
import { fmtCPF, fmtDate } from "@/lib/format";

const CATEGORIAS = [
  { key: "mural", label: "Murais / Comunicados", color: "text-cyan-400" },
  { key: "advertencia", label: "Advertências / Suspensão", color: "text-red-400" },
  { key: "contrato", label: "Contratos", color: "text-emerald-400" },
  { key: "termo", label: "Termos", color: "text-blue-400" },
  { key: "nr", label: "NRs (treinamentos)", color: "text-yellow-400" },
  { key: "rescisao", label: "Rescisão", color: "text-rose-400" },
  { key: "ficha", label: "Fichas", color: "text-purple-400" },
];

export type Modelo = {
  id: string; tipo: string; variante: string | null; titulo: string;
  categoria: string; conteudo_html: string; campos: any;
};

type Emitido = {
  id: string; titulo: string; status: string;
  token: string | null; assinado_em: string | null; created_at: string;
  colaborador_id: string;
  modelo_id?: string | null;
  canal_assinatura?: string | null;
  clicksign_signer_url?: string | null;
  clicksign_signed_pdf_url?: string | null;
  clicksign_envelope_id?: string | null;
  clicksign_visualizado_em?: string | null;
  lote_id?: string | null;
  lote_titulo?: string | null;
  auth_methods?: string[] | null;
};

export function DocumentosPage() {
  const [modelos, setModelos] = useState<Modelo[]>([]);
  const [emitidos, setEmitidos] = useState<Emitido[]>([]);
  const [loading, setLoading] = useState(true);
  const [emit, setEmit] = useState<Modelo | null>(null);
  const [emitMass, setEmitMass] = useState<Modelo | null>(null);
  const [muralBroadcast, setMuralBroadcast] = useState<Modelo | null>(null);
  const [multiOpen, setMultiOpen] = useState(false);
  const [uploadAvulso, setUploadAvulso] = useState(false);
  const [tab, setTab] = useState<"modelos" | "emitidos" | "pendentes">("emitidos");
  const [pendentesCount, setPendentesCount] = useState<number>(0);

  // Conta pendências (não-resolvidas) e mantém atualizado a cada 30s
  useEffect(() => {
    let alive = true;
    async function countPendentes() {
      const { count } = await supabase
        .from("mural_pendencias")
        .select("id", { count: "exact", head: true })
        .eq("resolvido", false);
      if (alive && typeof count === "number") setPendentesCount(count);
    }
    countPendentes();
    const id = setInterval(countPendentes, 30_000);
    return () => { alive = false; clearInterval(id); };
  }, []);

  const reload = async () => {
    setLoading(true);
    const [m, e] = await Promise.all([
      supabase.from("modelos_documento").select("*").eq("ativo", true).order("ordem"),
      supabase.from("documentos_emitidos").select("id, titulo, status, token, assinado_em, created_at, colaborador_id, modelo_id, canal_assinatura, clicksign_signer_url, clicksign_signed_pdf_url, clicksign_envelope_id, clicksign_visualizado_em, lote_id, lote_titulo, auth_methods").order("created_at", { ascending: false }).limit(500),
    ]);
    setModelos((m.data || []) as Modelo[]);
    setEmitidos((e.data || []) as Emitido[]);
    setLoading(false);
  };
  useEffect(() => { reload(); }, []);

  const colabs = useFetch(() => api.colaboradores(), []);
  const colabMap = useMemo(() => {
    const m = new Map<string, any>();
    (colabs.data || []).forEach((c) => m.set(c.id, c));
    return m;
  }, [colabs.data]);

  const modelosByCat = useMemo(() => {
    const m: Record<string, Modelo[]> = {};
    modelos.forEach((mod) => {
      m[mod.categoria] = m[mod.categoria] || [];
      m[mod.categoria].push(mod);
    });
    return m;
  }, [modelos]);

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Documentos</h1>
          <p className="text-sm text-muted-foreground mt-1">Modelos e documentos emitidos pra assinatura virtual.</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => setUploadAvulso(true)} variant="outline">
            <Plus size={14} /> Upload PDF avulso
          </Button>
          <Button onClick={() => setMultiOpen(true)} className="bg-primary text-primary-foreground">
            <Send size={14} /> Novo envio (multi-doc)
          </Button>
        </div>
      </div>

      <div className="flex gap-2 border-b border-border">
        <button onClick={() => setTab("emitidos")}
          className={`px-4 py-2 text-sm font-semibold border-b-2 transition ${tab === "emitidos" ? "border-primary text-foreground" : "border-transparent text-muted-foreground"}`}>
          Emitidos ({emitidos.length})
        </button>
        <button onClick={() => setTab("modelos")}
          className={`px-4 py-2 text-sm font-semibold border-b-2 transition ${tab === "modelos" ? "border-primary text-foreground" : "border-transparent text-muted-foreground"}`}>
          Modelos ({modelos.length})
        </button>
        <button onClick={() => setTab("pendentes")}
          className={`px-4 py-2 text-sm font-semibold border-b-2 transition flex items-center gap-1.5 ${tab === "pendentes" ? "border-primary text-foreground" : "border-transparent text-muted-foreground"}`}>
          Pendentes WhatsApp
          {pendentesCount > 0 && (
            <span className="inline-flex items-center justify-center px-1.5 min-w-[18px] h-[18px] rounded-full bg-yellow-500/20 text-yellow-400 text-[10px] font-bold">
              {pendentesCount}
            </span>
          )}
        </button>
      </div>

      {loading && <div className="flex items-center gap-2 text-sm text-muted-foreground p-12 justify-center"><Loader2 size={14} className="animate-spin" /> Carregando…</div>}

      {!loading && tab === "modelos" && (
        <div className="space-y-6">
          {CATEGORIAS.filter((c) => modelosByCat[c.key]?.length).map((c) => (
            <div key={c.key}>
              <h3 className={`text-xs font-bold uppercase tracking-wider mb-2 ${c.color}`}>{c.label}</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {modelosByCat[c.key].map((m) => (
                  <Card key={m.id} className="p-4 hover:bg-secondary/30 transition">
                    <div className="flex items-start gap-3">
                      <FileText size={18} className="text-muted-foreground shrink-0 mt-0.5" />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-semibold">{m.titulo}</div>
                        <div className="text-[10px] text-muted-foreground mt-0.5">
                          {(m.campos || []).length} campo{(m.campos || []).length !== 1 ? "s" : ""}
                        </div>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2 mt-3">
                      <Button onClick={() => setEmit(m)} size="sm" variant="outline">
                        <Plus size={12} /> Individual
                      </Button>
                      <Button
                        onClick={() => {
                          // Mural usa fluxo de broadcast WhatsApp em vez
                          // de emitir N documentos individuais.
                          if (m.categoria === "mural") setMuralBroadcast(m);
                          else setEmitMass(m);
                        }}
                        size="sm"
                      >
                        <Users size={12} /> Em massa
                      </Button>
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {!loading && tab === "emitidos" && (
        <EmitidosList emitidos={emitidos} colabMap={colabMap} onChanged={reload} />
      )}

      {!loading && tab === "pendentes" && (
        <PendentesWhatsAppList />
      )}

      {multiOpen && (
        <MultiEnvioModal
          modelos={modelos}
          onClose={() => setMultiOpen(false)}
          onSent={() => { setMultiOpen(false); reload(); setTab("emitidos"); }}
        />
      )}

      {uploadAvulso && (
        <UploadAvulsoModal
          onClose={() => setUploadAvulso(false)}
          onSent={() => { setUploadAvulso(false); reload(); setTab("emitidos"); }}
        />
      )}

      {emit && (
        <EmitirModal modelo={emit} onClose={() => setEmit(null)}
          onEmitted={() => { setEmit(null); reload(); setTab("emitidos"); }} />
      )}

      {emitMass && (
        <EmitirEmMassaModal modelo={emitMass} onClose={() => setEmitMass(null)}
          onEmitted={() => { setEmitMass(null); reload(); setTab("emitidos"); }} />
      )}

      {muralBroadcast && (
        <MuralBroadcastModal
          modelo={muralBroadcast}
          onClose={() => setMuralBroadcast(null)}
          onDone={() => { setMuralBroadcast(null); setTab("pendentes"); }}
        />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────
function EmitidosList({ emitidos, colabMap, onChanged }: { emitidos: Emitido[]; colabMap: Map<string, any>; onChanged: () => void }) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [syncing, setSyncing] = useState(false);
  const [lastSync, setLastSync] = useState<Date | null>(null);

  // Polling: chama sync-all a cada 30s pra atualizar status dos Clicksign sem webhook
  useEffect(() => {
    let alive = true;
    async function poll() {
      try {
        const r = await fetch("/api/clicksign/sync-all", { method: "POST" });
        if (alive && r.ok) {
          const j = await r.json();
          if (j.atualizados > 0) onChanged();
          setLastSync(new Date());
        }
      } catch {}
    }
    poll();
    const id = setInterval(poll, 30_000);
    return () => { alive = false; clearInterval(id); };
  }, [onChanged]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return emitidos.filter((e) => {
      if (statusFilter && e.status !== statusFilter) return false;
      if (!q) return true;
      const c = colabMap.get(e.colaborador_id);
      return e.titulo.toLowerCase().includes(q) || (c?.nome || "").toLowerCase().includes(q);
    });
  }, [emitidos, search, statusFilter, colabMap]);

  // Agrupa por lote_id (preferido) ou por (modelo_id + dia) pra retrocompat
  type Lote = {
    chave: string;
    lote_id: string | null;
    titulo_base: string;
    canal: string;
    dia: string;
    quando: string;  // created_at do primeiro envio
    envios: Emitido[];
  };
  const lotes = useMemo<Lote[]>(() => {
    const map = new Map<string, Lote>();
    for (const e of filtered) {
      const dia = (e.created_at || "").slice(0, 10);
      const canal = e.canal_assinatura || "interno";
      // Lote: usa lote_id quando existir, senão modelo+dia+canal
      const key = e.lote_id || `_${e.modelo_id || "?"}|${dia}|${canal}`;
      if (!map.has(key)) {
        const base = e.lote_titulo || (e.titulo || "").split(" — ")[0] || e.titulo;
        map.set(key, {
          chave: key,
          lote_id: e.lote_id || null,
          titulo_base: base,
          canal,
          dia,
          quando: e.created_at,
          envios: [],
        });
      }
      const l = map.get(key)!;
      l.envios.push(e);
      if (e.created_at < l.quando) l.quando = e.created_at;
    }
    return Array.from(map.values()).sort((a, b) => (b.quando || "").localeCompare(a.quando || ""));
  }, [filtered]);

  const toggle = (k: string) => {
    const next = new Set(expanded);
    if (next.has(k)) next.delete(k); else next.add(k);
    setExpanded(next);
  };

  const syncManual = async () => {
    setSyncing(true);
    try {
      await fetch("/api/clicksign/sync-all", { method: "POST" });
      onChanged();
      setLastSync(new Date());
    } finally {
      setSyncing(false);
    }
  };

  if (emitidos.length === 0) return (
    <Card className="p-12 text-center">
      <FileText size={32} className="mx-auto text-muted-foreground mb-3" />
      <div className="font-semibold mb-1">Nenhum documento emitido ainda</div>
      <div className="text-sm text-muted-foreground">Vá em "Modelos" e emita o primeiro.</div>
    </Card>
  );

  return (
    <>
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Buscar por colaborador ou modelo…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
          className="h-9 bg-input border border-border rounded-md text-xs px-3 outline-none focus:ring-2 focus:ring-ring">
          <option value="">Todos status</option>
          <option value="aguardando_assinatura">Aguardando</option>
          <option value="visualizado">Visualizados</option>
          <option value="assinado">Assinados</option>
          <option value="recusado">Recusados</option>
          <option value="cancelado">Cancelados</option>
        </select>
        <Button size="sm" variant="outline" onClick={syncManual} disabled={syncing}>
          {syncing ? <Loader2 size={11} className="animate-spin" /> : <RefreshCw size={11} />}
          Sync Clicksign
        </Button>
        {lastSync && (
          <span className="text-[10px] text-muted-foreground">
            últ. sync {lastSync.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
          </span>
        )}
      </div>

      <div className="space-y-2">
        {lotes.map((lote) => {
          const isExp = expanded.has(lote.chave);
          const assinados = lote.envios.filter((e) => e.status === "assinado").length;
          const aguardando = lote.envios.filter((e) => e.status === "aguardando_assinatura" || e.status === "enviando_clicksign").length;
          const visualizados = lote.envios.filter((e) => e.status === "visualizado").length;
          const recusados = lote.envios.filter((e) => e.status === "recusado").length;
          const canceladosOuExp = lote.envios.filter((e) => e.status === "cancelado" || e.status === "expirado").length;
          const total = lote.envios.length;
          const pct = total > 0 ? Math.round((assinados / total) * 100) : 0;
          return (
            <Card key={lote.chave} className="overflow-hidden">
              <button onClick={() => toggle(lote.chave)}
                className="w-full p-4 text-left hover:bg-secondary/30 transition flex items-center gap-3">
                <FileText size={18} className="text-muted-foreground shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <div className="text-sm font-semibold truncate">{lote.titulo_base}</div>
                    <Badge variant="outline" className="text-[10px]">
                      {lote.canal === "clicksign" ? "Clicksign" : "Interno"}
                    </Badge>
                    {lote.lote_id && (
                      <Badge variant="outline" className="text-[10px] bg-blue-500/10 border-blue-500/40 text-blue-300">
                        Lote
                      </Badge>
                    )}
                    <span className="text-[10px] text-muted-foreground">
                      · {fmtDate(lote.quando)}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 mt-1.5 text-[11px]">
                    <span className="text-muted-foreground">{total} envio{total !== 1 ? "s" : ""}</span>
                    {assinados > 0 && <span className="text-emerald-400 flex items-center gap-1"><CheckCircle2 size={10} /> {assinados}</span>}
                    {visualizados > 0 && <span className="text-blue-400 flex items-center gap-1"><Eye size={10} /> {visualizados}</span>}
                    {aguardando > 0 && <span className="text-amber-400">⏳ {aguardando}</span>}
                    {recusados > 0 && <span className="text-rose-400 flex items-center gap-1"><XCircle size={10} /> {recusados}</span>}
                    {canceladosOuExp > 0 && <span className="text-muted-foreground">⊘ {canceladosOuExp}</span>}
                  </div>
                  <div className="mt-2 h-1 bg-secondary rounded overflow-hidden">
                    <div className="h-full bg-emerald-500 transition-all" style={{ width: `${pct}%` }} />
                  </div>
                </div>
                <div className="text-xs text-muted-foreground shrink-0">{pct}%</div>
              </button>
              {isExp && (() => {
                // Agrupa envios POR COLABORADOR dentro do lote
                const porColab = new Map<string, Emitido[]>();
                for (const e of lote.envios) {
                  const k = e.colaborador_id || "_sem";
                  if (!porColab.has(k)) porColab.set(k, []);
                  porColab.get(k)!.push(e);
                }
                // Se tem só 1 doc por colab E poucos colabs, renderiza flat
                const maxPorColab = Math.max(...Array.from(porColab.values()).map(v => v.length));
                const isFlat = maxPorColab === 1;
                if (isFlat) {
                  return (
                    <div className="border-t border-border divide-y divide-border">
                      {lote.envios.map((e) => <EnvioRow key={e.id} e={e} c={colabMap.get(e.colaborador_id)} />)}
                    </div>
                  );
                }
                // Modo agrupado: linha por colaborador, clica expande os docs dele
                const colabsArr = Array.from(porColab.entries()).sort((a, b) => {
                  const na = colabMap.get(a[0])?.nome || ""; const nb = colabMap.get(b[0])?.nome || "";
                  return na.localeCompare(nb);
                });
                return (
                  <div className="border-t border-border divide-y divide-border">
                    {colabsArr.map(([colabId, envs]) => {
                      const c = colabMap.get(colabId);
                      const colabKey = `${lote.chave}::${colabId}`;
                      const cExp = expanded.has(colabKey);
                      const assC = envs.filter(e => e.status === "assinado").length;
                      const visC = envs.filter(e => e.status === "visualizado").length;
                      const agC = envs.filter(e => e.status === "aguardando_assinatura" || e.status === "enviando_clicksign").length;
                      const recC = envs.filter(e => e.status === "recusado").length;
                      const totC = envs.length;
                      const pctC = totC > 0 ? Math.round((assC / totC) * 100) : 0;
                      return (
                        <div key={colabId}>
                          <button onClick={() => toggle(colabKey)}
                            className="w-full p-3 text-left hover:bg-secondary/30 transition flex items-center gap-3">
                            <Users size={14} className="text-muted-foreground shrink-0" />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <Link to={`/colaboradores/${colabId}`} onClick={(e) => e.stopPropagation()} className="text-sm font-medium hover:underline truncate">
                                  {c?.nome || "—"}
                                </Link>
                                {c?.cpf && <span className="text-[10px] text-muted-foreground">CPF {fmtCPF(c.cpf)}</span>}
                                <span className="text-[10px] text-muted-foreground">· {totC} doc{totC !== 1 ? "s" : ""}</span>
                              </div>
                              <div className="flex items-center gap-3 mt-1 text-[10px]">
                                {assC > 0 && <span className="text-emerald-400 flex items-center gap-1"><CheckCircle2 size={9} /> {assC}</span>}
                                {visC > 0 && <span className="text-blue-400 flex items-center gap-1"><Eye size={9} /> {visC}</span>}
                                {agC > 0 && <span className="text-amber-400">⏳ {agC}</span>}
                                {recC > 0 && <span className="text-rose-400 flex items-center gap-1"><XCircle size={9} /> {recC}</span>}
                              </div>
                              <div className="mt-1.5 h-0.5 bg-secondary rounded overflow-hidden">
                                <div className="h-full bg-emerald-500 transition-all" style={{ width: `${pctC}%` }} />
                              </div>
                            </div>
                            <div className="text-[10px] text-muted-foreground shrink-0">{pctC}% {cExp ? "▼" : "▶"}</div>
                          </button>
                          {cExp && (
                            <div className="bg-secondary/20 divide-y divide-border border-t border-border">
                              {envs.map((e) => <EnvioRow key={e.id} e={e} c={c} compact />)}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
            </Card>
          );
        })}
      </div>
    </>
  );
}

function EnvioRow({ e, c, compact }: { e: Emitido; c: any; compact?: boolean }) {
  const linkInterno = e.token ? `${window.location.origin}/assinar/${e.token}` : null;
  const linkClicksign = e.clicksign_signer_url || null;
  const link = linkClicksign || linkInterno;
  const pdfUrl = e.status === "assinado" ? `/api/clicksign/envios/${e.id}/pdf-assinado` : null;
  const statusBadge =
    e.status === "assinado" ? "success" :
    e.status === "cancelado" || e.status === "recusado" || e.status === "expirado" ? "outline" :
    e.status === "visualizado" ? "info" : "warning";
  return (
    <div className={`${compact ? "p-2 pl-8" : "p-3"} flex items-center justify-between gap-3 hover:bg-secondary/30`}>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          {compact ? (
            <div className="text-xs font-medium truncate">{e.titulo}</div>
          ) : (
            <Link to={`/colaboradores/${e.colaborador_id}`} className="text-sm font-medium hover:underline truncate">
              {c?.nome || "—"}
            </Link>
          )}
          <Badge variant={statusBadge as any} className="text-[10px]">{e.status}</Badge>
          {!compact && c?.cpf && <span className="text-[10px] text-muted-foreground">CPF {fmtCPF(c.cpf)}</span>}
        </div>
        <div className="text-[10px] text-muted-foreground mt-0.5">
          {compact ? "" : `Enviado ${fmtDate(e.created_at)}`}
          {e.clicksign_visualizado_em && <span className="text-blue-400"> · 👁 Visto {fmtDate(e.clicksign_visualizado_em)}</span>}
          {e.assinado_em && <span className="text-emerald-400"> · ✓ Assinado {fmtDate(e.assinado_em)}</span>}
        </div>
      </div>
      <div className="flex gap-1.5 shrink-0">
        {pdfUrl && (
          <a href={pdfUrl} target="_blank" rel="noopener noreferrer">
            <Button size="sm" variant="outline" title="Baixar PDF assinado">
              <FileText size={11} /> PDF
            </Button>
          </a>
        )}
        {link && (e.status === "aguardando_assinatura" || e.status === "visualizado" || e.status === "enviando_clicksign") && (
          <ShareButtons link={link} colab={c} titulo={e.titulo} docId={e.id} />
        )}
      </div>
    </div>
  );
}

function ShareButtons({ link, colab, titulo, docId }: { link: string; colab: any; titulo: string; docId?: string }) {
  const [copied, setCopied] = useState(false);
  const [tel, setTel] = useState((colab?.celular || "").replace(/\D/g, ""));
  const [sending, setSending] = useState(false);
  const firstName = (colab?.nome || "").split(" ")[0];
  const msg = `Oi ${firstName}! Você tem um documento aguardando assinatura: ${titulo}\n\n${link}`;
  const mailHref = colab?.email_pessoal ? `mailto:${colab.email_pessoal}?subject=${encodeURIComponent(titulo)}&body=${encodeURIComponent(msg)}` : null;

  const sendWhats = async () => {
    let phone = tel;
    if (!phone) {
      const input = window.prompt(`Cadastrar celular de ${firstName} (com DDD):`, "");
      if (!input) return;
      const digits = input.replace(/\D/g, "");
      if (digits.length < 10) { alert("Número inválido. Use DDD + número."); return; }
      const { error } = await supabase.from("colaboradores").update({ celular: digits }).eq("id", colab.id);
      if (error) { alert("Erro ao salvar: " + error.message); return; }
      setTel(digits);
      phone = digits;
    }
    setSending(true);
    const res = await sendWhatsAppViaAgent({
      telefone: phone, mensagem: msg, colaborador_id: colab.id, documento_id: docId,
    });
    setSending(false);
    if (res.ok) alert("✓ Enviado pelo Agente RH");
    else alert("Erro: " + (res.error || ""));
  };
  const copy = async () => {
    await navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <div className="flex gap-1.5 shrink-0">
      <Button size="sm" onClick={sendWhats} disabled={sending}
        className={tel ? "bg-emerald-600 hover:bg-emerald-700 text-white" : "bg-amber-600 hover:bg-amber-700 text-white"}>
        {sending ? <Loader2 size={11} className="animate-spin" /> : <MessageCircle size={11} />}
        {sending ? "Enviando" : tel ? "Whats" : "Cadastrar+enviar"}
      </Button>
      {mailHref && <a href={mailHref}><Button size="sm" variant="outline"><Mail size={11} /></Button></a>}
      <Button size="sm" variant="outline" onClick={copy}>{copied ? <CheckCircle2 size={11} /> : <Copy size={11} />}</Button>
    </div>
  );
}

// ─────────────────────────────────────────────────
export function EmitirModal({ modelo, onClose, onEmitted, colaboradorIdInicial }: {
  modelo: Modelo; onClose: () => void; onEmitted: () => void;
  colaboradorIdInicial?: string;
}) {
  const colabs = useFetch(() => api.colaboradoresAtivos(), []);
  const empresas = useFetch(() => api.empresas(), []);
  const [search, setSearch] = useState("");
  const [colabId, setColabId] = useState<string | null>(colaboradorIdInicial || null);
  const [valores, setValores] = useState<Record<string, any>>(() => {
    const v: any = {};
    (modelo.campos || []).forEach((f: any) => {
      if (f.default !== undefined) v[f.key] = f.default;
    });
    return v;
  });
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const colab = colabs.data?.find((c) => c.id === colabId);
  const emp = empresas.data?.find((e) => e.id === (colab as any)?.empresa_id);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!colabs.data) return [];
    if (!q) return colabs.data.slice(0, 50);
    return colabs.data.filter((c) =>
      c.nome.toLowerCase().includes(q) || (c.cpf || "").includes(q),
    ).slice(0, 50);
  }, [colabs.data, search]);

  const renderConteudo = () => {
    if (!colab) return modelo.conteudo_html;
    const subs: Record<string, any> = {
      ...valores,
      nome: colab.nome,
      cpf: colab.cpf ? fmtCPF(colab.cpf) : "—",
      cargo: (colab as any).cargo_atual_nome || "—",
      empresa: emp?.nome_fantasia || emp?.razao_social || "Parket",
      cnpj: emp?.cnpj || "—",
    };
    let out = modelo.conteudo_html;
    for (const [k, v] of Object.entries(subs)) {
      const safe = v === null || v === undefined ? "" : String(v);
      out = out.replace(new RegExp(`{{\\s*${k}\\s*}}`, "g"), safe);
    }
    // Coloca placeholders restantes em vermelho
    out = out.replace(/{{\s*(\w+)\s*}}/g, '<span style="color:#c00;background:#fee">[$1]</span>');
    return out;
  };

  const submit = async () => {
    if (!colab) { setErr("Selecione um colaborador"); return; }
    // Verifica required
    const missing = (modelo.campos || []).filter((f: any) => f.required && !valores[f.key]);
    if (missing.length) { setErr(`Preencha: ${missing.map((f: any) => f.label).join(", ")}`); return; }
    setSubmitting(true);
    setErr(null);
    try {
      const token = crypto.randomUUID().replace(/-/g, "");
      const conteudo = renderConteudo();
      const expira = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
      // Título inclui data + colaborador pra distinguir múltiplas emissões
      const dataEmissao = (valores.data as string) || new Date().toISOString().slice(0, 10);
      const dataFmt = dataEmissao.split("-").reverse().join("/");
      const tituloComData = `${modelo.titulo} — ${colab.nome.split(" ")[0]} — ${dataFmt}`;
      const { error } = await supabase.from("documentos_emitidos").insert({
        modelo_id: modelo.id,
        colaborador_id: colab.id,
        empresa_id: emp?.id || null,
        titulo: tituloComData,
        conteudo_html: conteudo,
        campos_valores: valores,
        status: "aguardando_assinatura",
        token,
        token_expira_em: expira,
        enviado_em: new Date().toISOString(),
      });
      if (error) throw error;
      onEmitted();
    } catch (e: any) {
      setErr(e.message || "Falha");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <Card className="w-full max-w-5xl h-[90vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div>
            <div className="text-base font-bold">{modelo.titulo}</div>
            <div className="text-xs text-muted-foreground mt-0.5">Selecione o colaborador e preencha os campos</div>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X size={18} /></button>
        </div>

        <div className="flex-1 overflow-hidden flex">
          {/* Sidebar: colaborador + campos */}
          <div className="w-1/2 overflow-y-auto p-4 border-r border-border space-y-4">
            <div>
              <label className="text-xs font-medium mb-1 block">Colaborador *</label>
              <Input placeholder="Buscar por nome ou CPF…" value={search} onChange={(e) => setSearch(e.target.value)} />
              <div className="mt-2 max-h-48 overflow-y-auto border border-border rounded">
                {filtered.map((c) => (
                  <button key={c.id} onClick={() => setColabId(c.id)}
                    className={`w-full text-left px-3 py-2 text-xs border-b border-border last:border-0 ${colabId === c.id ? "bg-primary/10 text-foreground" : "hover:bg-secondary/30"}`}>
                    <div className="font-semibold">{c.nome}</div>
                    {c.cpf && <div className="text-[10px] text-muted-foreground">CPF {fmtCPF(c.cpf)}</div>}
                  </button>
                ))}
              </div>
            </div>

            {colab && (modelo.campos || []).map((f: any) => (
              <div key={f.key}>
                <label className="text-xs font-medium mb-1 block">
                  {f.label}{f.required && " *"}
                </label>
                {f.type === "textarea" ? (
                  <textarea value={valores[f.key] || ""} onChange={(e) => setValores({ ...valores, [f.key]: e.target.value })}
                    placeholder={f.placeholder} rows={3}
                    className="w-full bg-input border border-border rounded-md text-xs p-2 outline-none focus:ring-2 focus:ring-ring" />
                ) : f.type === "select" ? (
                  <select value={valores[f.key] || ""} onChange={(e) => setValores({ ...valores, [f.key]: e.target.value })}
                    className="w-full h-9 bg-input border border-border rounded-md text-xs px-3 outline-none focus:ring-2 focus:ring-ring">
                    <option value="">— selecione —</option>
                    {(f.options || []).map((o: string) => <option key={o} value={o}>{o}</option>)}
                  </select>
                ) : (
                  <Input type={f.type === "number" || f.type === "date" ? f.type : "text"}
                    value={valores[f.key] || ""}
                    onChange={(e) => setValores({ ...valores, [f.key]: e.target.value })}
                    placeholder={f.placeholder} />
                )}
              </div>
            ))}

            {err && <div className="text-xs text-red-400">{err}</div>}

            <Button onClick={submit} disabled={!colab || submitting} className="w-full">
              {submitting && <Loader2 size={12} className="animate-spin" />}
              Emitir e enviar pra assinatura
            </Button>
          </div>

          {/* Preview */}
          <div className="flex-1 overflow-y-auto p-6 bg-white text-black">
            <div className="max-w-[600px] mx-auto" dangerouslySetInnerHTML={{ __html: renderConteudo() }} />
          </div>
        </div>
      </Card>
    </div>
  );
}

// ─────────────────────────────────────────────────
// Emissão em massa: filtra colaboradores por empresa + departamento e
// dispara N inserts em paralelo, um documento por colaborador. Cada doc
// herda os mesmos campos do modelo (texto comum) — só varia o nome/CPF/
// cargo via placeholders {{nome}}/{{cpf}}/{{cargo}}.
function EmitirEmMassaModal({ modelo, onClose, onEmitted }: { modelo: Modelo; onClose: () => void; onEmitted: () => void }) {
  const colabs = useFetch(() => api.colaboradores(), []);
  const empresas = useFetch(() => api.empresas(), []);
  const contratos = useFetch(() => api.contratos(), []);
  const departamentos = useFetch(() => api.departamentos(), []);

  const [empresaId, setEmpresaId] = useState<string>("");
  const [departamentoId, setDepartamentoId] = useState<string>("");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [valores, setValores] = useState<Record<string, any>>(() => {
    const v: any = {};
    (modelo.campos || []).forEach((f: any) => { if (f.default !== undefined) v[f.key] = f.default; });
    return v;
  });
  const [submitting, setSubmitting] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number; failed: number }>({ done: 0, total: 0, failed: 0 });
  const [err, setErr] = useState<string | null>(null);
  // Canal: 'interno' (canvas próprio) ou 'clicksign' (assinatura jurídica externa)
  const [canal, setCanal] = useState<"interno" | "clicksign">("clicksign");
  const [enviarWhatsapp, setEnviarWhatsapp] = useState(true);
  const [resultCS, setResultCS] = useState<{ enviados: number; erros: any[] } | null>(null);

  // Mapa colaborador_id → contrato ativo (pra resolver empresa/departamento)
  const contratoByColab = useMemo(() => {
    const m = new Map<string, any>();
    (contratos.data || []).forEach((c: any) => {
      if (c.status === "ativo" || c.status === "Ativo") {
        m.set(c.colaborador_id, c);
      } else if (!m.has(c.colaborador_id)) {
        m.set(c.colaborador_id, c); // fallback
      }
    });
    return m;
  }, [contratos.data]);

  // Departamentos da empresa selecionada
  const deptosFiltrados = useMemo(() => {
    const ds = departamentos.data || [];
    if (!empresaId) return ds;
    return ds.filter((d: any) => d.empresa_id === empresaId);
  }, [departamentos.data, empresaId]);

  // Colaboradores filtrados pelos critérios
  const colabsFiltrados = useMemo(() => {
    const all = colabs.data || [];
    const q = search.trim().toLowerCase();
    return all.filter((c) => {
      const contr = contratoByColab.get(c.id);
      if (empresaId && contr?.empresa_id !== empresaId) return false;
      if (departamentoId && contr?.departamento_id !== departamentoId) return false;
      if (q) {
        const hit = c.nome.toLowerCase().includes(q) || (c.cpf || "").includes(q);
        if (!hit) return false;
      }
      return true;
    });
  }, [colabs.data, empresaId, departamentoId, search, contratoByColab]);

  const toggleAll = () => {
    if (selected.size === colabsFiltrados.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(colabsFiltrados.map((c) => c.id)));
    }
  };
  const toggleOne = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelected(next);
  };

  const renderConteudo = (colab: any, emp: any) => {
    const subs: Record<string, any> = {
      ...valores,
      nome: colab?.nome || "—",
      cpf: colab?.cpf ? fmtCPF(colab.cpf) : "—",
      cargo: (colab as any)?.cargo_atual_nome || "—",
      empresa: emp?.nome_fantasia || emp?.razao_social || "Parket",
      cnpj: emp?.cnpj || "—",
    };
    let out = modelo.conteudo_html;
    for (const [k, v] of Object.entries(subs)) {
      const safe = v === null || v === undefined ? "" : String(v);
      out = out.replace(new RegExp(`{{\\s*${k}\\s*}}`, "g"), safe);
    }
    out = out.replace(/{{\s*(\w+)\s*}}/g, '<span style="color:#c00;background:#fee">[$1]</span>');
    return out;
  };

  const submitClicksign = async () => {
    const ids = Array.from(selected);
    setSubmitting(true);
    setErr(null);
    setResultCS(null);
    setProgress({ done: 0, total: ids.length, failed: 0 });
    try {
      const resp = await clicksign.enviar({
        modelo_ids: [modelo.id],
        colaborador_ids: ids,
        campos_extras: valores,
        enviar_whatsapp: enviarWhatsapp,
      });
      setProgress({ done: resp.total_enviados, total: ids.length, failed: resp.total_erros });
      setResultCS({ enviados: resp.total_enviados, erros: resp.erros });
      if (resp.total_erros === 0) {
        setTimeout(onEmitted, 1500);
      } else if (resp.total_enviados > 0) {
        setErr(`${resp.total_enviados} enviados via Clicksign, ${resp.total_erros} falharam`);
      } else {
        setErr(`Falha total: ${resp.erros[0]?.erro?.slice(0, 200) || "veja console"}`);
        console.warn("Erros Clicksign:", resp.erros);
      }
    } catch (e: any) {
      setErr(`Erro Clicksign: ${e?.message?.slice(0, 200) || e}`);
    } finally {
      setSubmitting(false);
    }
  };

  const submit = async () => {
    if (selected.size === 0) { setErr("Selecione ao menos um colaborador"); return; }
    const missing = (modelo.campos || []).filter((f: any) => f.required && !valores[f.key]);
    if (missing.length) { setErr(`Preencha: ${missing.map((f: any) => f.label).join(", ")}`); return; }
    if (canal === "clicksign") return submitClicksign();
    setSubmitting(true);
    setErr(null);
    const ids = Array.from(selected);
    setProgress({ done: 0, total: ids.length, failed: 0 });

    const dataEmissao = (valores.data as string) || new Date().toISOString().slice(0, 10);
    const dataFmt = dataEmissao.split("-").reverse().join("/");

    // Em paralelo limitado (8) pra evitar burst no PostgREST
    const POOL = 8;
    let cursor = 0; let done = 0; let failed = 0;
    const worker = async () => {
      while (cursor < ids.length) {
        const idx = cursor++;
        const colab = (colabs.data || []).find((c) => c.id === ids[idx]);
        if (!colab) { failed++; setProgress({ done, total: ids.length, failed }); continue; }
        const contr = contratoByColab.get(colab.id);
        const emp = (empresas.data || []).find((e) => e.id === contr?.empresa_id);
        const token = crypto.randomUUID().replace(/-/g, "");
        const conteudo = renderConteudo(colab, emp);
        const expira = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
        const tituloComData = `${modelo.titulo} — ${colab.nome.split(" ")[0]} — ${dataFmt}`;
        const { error } = await supabase.from("documentos_emitidos").insert({
          modelo_id: modelo.id,
          colaborador_id: colab.id,
          empresa_id: emp?.id || null,
          titulo: tituloComData,
          conteudo_html: conteudo,
          campos_valores: valores,
          status: "aguardando_assinatura",
          token,
          token_expira_em: expira,
          enviado_em: new Date().toISOString(),
        });
        if (error) { failed++; console.warn("Erro emissão", colab.nome, error.message); }
        done++;
        setProgress({ done, total: ids.length, failed });
      }
    };
    await Promise.all(Array.from({ length: Math.min(POOL, ids.length) }, () => worker()));

    setSubmitting(false);
    if (failed > 0) {
      setErr(`${done - failed} emitidos, ${failed} falharam — veja console.`);
      if (done - failed > 0) setTimeout(onEmitted, 1500);
    } else {
      onEmitted();
    }
  };

  // Preview usa o 1º selecionado, ou o 1º da lista filtrada
  const previewColab = useMemo(() => {
    if (selected.size > 0) {
      const id = Array.from(selected)[0];
      return (colabs.data || []).find((c) => c.id === id);
    }
    return colabsFiltrados[0];
  }, [selected, colabs.data, colabsFiltrados]);
  const previewEmpresa = useMemo(() => {
    const contr = previewColab ? contratoByColab.get(previewColab.id) : null;
    return (empresas.data || []).find((e) => e.id === contr?.empresa_id) || null;
  }, [previewColab, contratoByColab, empresas.data]);

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <Card className="w-full max-w-6xl h-[92vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div>
            <div className="text-base font-bold">{modelo.titulo} — Emissão em massa</div>
            <div className="text-xs text-muted-foreground mt-0.5">
              Filtre por empresa/setor, selecione os colaboradores e emita pra todos de uma vez
            </div>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X size={18} /></button>
        </div>

        <div className="flex-1 overflow-hidden flex">
          <div className="w-1/2 overflow-y-auto p-4 border-r border-border space-y-4">

            {/* Filtros */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium mb-1 block">Empresa</label>
                <select value={empresaId} onChange={(e) => { setEmpresaId(e.target.value); setDepartamentoId(""); }}
                  className="w-full h-9 bg-input border border-border rounded-md text-xs px-3 outline-none focus:ring-2 focus:ring-ring">
                  <option value="">Todas</option>
                  {(empresas.data || []).map((e) => (
                    <option key={e.id} value={e.id}>{e.nome_fantasia || e.razao_social}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium mb-1 block">Setor / Departamento</label>
                <select value={departamentoId} onChange={(e) => setDepartamentoId(e.target.value)}
                  className="w-full h-9 bg-input border border-border rounded-md text-xs px-3 outline-none focus:ring-2 focus:ring-ring">
                  <option value="">Todos</option>
                  {deptosFiltrados.map((d: any) => (
                    <option key={d.id} value={d.id}>{d.nome}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Busca + select all */}
            <div>
              <div className="flex items-center gap-2 mb-2">
                <div className="relative flex-1">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <Input placeholder="Buscar por nome ou CPF…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
                </div>
                <Button type="button" variant="outline" size="sm" onClick={toggleAll}>
                  {selected.size === colabsFiltrados.length && colabsFiltrados.length > 0 ? "Limpar" : "Todos"}
                </Button>
              </div>
              <div className="text-[10px] text-muted-foreground mb-2">
                {colabsFiltrados.length} colaborador{colabsFiltrados.length !== 1 ? "es" : ""} · {selected.size} selecionado{selected.size !== 1 ? "s" : ""}
              </div>
              <div className="max-h-72 overflow-y-auto border border-border rounded">
                {colabsFiltrados.length === 0 && (
                  <div className="px-3 py-6 text-center text-xs text-muted-foreground">
                    Nenhum colaborador no filtro
                  </div>
                )}
                {colabsFiltrados.map((c) => {
                  const isOn = selected.has(c.id);
                  const contr = contratoByColab.get(c.id);
                  const dept = (departamentos.data || []).find((d: any) => d.id === contr?.departamento_id);
                  return (
                    <label key={c.id} className={`flex items-start gap-2 px-3 py-2 text-xs border-b border-border last:border-0 cursor-pointer ${isOn ? "bg-primary/10" : "hover:bg-secondary/30"}`}>
                      <input type="checkbox" checked={isOn} onChange={() => toggleOne(c.id)} className="mt-0.5" />
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold truncate">{c.nome}</div>
                        <div className="text-[10px] text-muted-foreground">
                          {c.cpf && `CPF ${fmtCPF(c.cpf)}`}
                          {dept && ` · ${dept.nome}`}
                        </div>
                      </div>
                    </label>
                  );
                })}
              </div>
            </div>

            {/* Campos do modelo (mesmos pra todos) */}
            {(modelo.campos || []).length > 0 && (
              <div className="space-y-3 pt-2 border-t border-border">
                <div className="text-[10px] uppercase text-muted-foreground tracking-wider font-semibold">
                  Campos comuns pra todos
                </div>
                {(modelo.campos || []).map((f: any) => (
                  <div key={f.key}>
                    <label className="text-xs font-medium mb-1 block">{f.label}{f.required && " *"}</label>
                    {f.type === "textarea" ? (
                      <textarea value={valores[f.key] || ""} onChange={(e) => setValores({ ...valores, [f.key]: e.target.value })}
                        placeholder={f.placeholder} rows={3}
                        className="w-full bg-input border border-border rounded-md text-xs p-2 outline-none focus:ring-2 focus:ring-ring" />
                    ) : f.type === "select" ? (
                      <select value={valores[f.key] || ""} onChange={(e) => setValores({ ...valores, [f.key]: e.target.value })}
                        className="w-full h-9 bg-input border border-border rounded-md text-xs px-3 outline-none focus:ring-2 focus:ring-ring">
                        <option value="">— selecione —</option>
                        {(f.options || []).map((o: string) => <option key={o} value={o}>{o}</option>)}
                      </select>
                    ) : (
                      <Input type={f.type === "number" || f.type === "date" ? f.type : "text"}
                        value={valores[f.key] || ""}
                        onChange={(e) => setValores({ ...valores, [f.key]: e.target.value })}
                        placeholder={f.placeholder} />
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Canal de assinatura */}
            <div className="pt-2 border-t border-border space-y-2">
              <div className="text-[10px] uppercase text-muted-foreground tracking-wider font-semibold">
                Como enviar pra assinatura
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setCanal("clicksign")}
                  className={`text-left p-2.5 rounded-md border text-xs transition ${
                    canal === "clicksign"
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border hover:bg-secondary/30 text-muted-foreground"
                  }`}
                >
                  <div className="font-semibold text-[11px] flex items-center gap-1.5">
                    <CheckCircle2 size={12} /> Clicksign (jurídico)
                  </div>
                  <div className="text-[10px] mt-1 leading-snug">
                    Assinatura juridicamente válida. Envia email + WhatsApp.
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => setCanal("interno")}
                  className={`text-left p-2.5 rounded-md border text-xs transition ${
                    canal === "interno"
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border hover:bg-secondary/30 text-muted-foreground"
                  }`}
                >
                  <div className="font-semibold text-[11px] flex items-center gap-1.5">
                    <Eye size={12} /> Interno (canvas)
                  </div>
                  <div className="text-[10px] mt-1 leading-snug">
                    Assinatura desenhada no app. Sem validade jurídica oficial.
                  </div>
                </button>
              </div>
              {canal === "clicksign" && (
                <label className="flex items-center gap-2 text-xs cursor-pointer pt-1">
                  <input type="checkbox" checked={enviarWhatsapp} onChange={(e) => setEnviarWhatsapp(e.target.checked)} />
                  Também enviar aviso por WhatsApp ({"+55 41 98580250"} — RH)
                </label>
              )}
            </div>

            {err && <div className="text-xs text-red-400">{err}</div>}

            {resultCS && resultCS.enviados > 0 && (
              <div className="text-xs bg-emerald-500/10 border border-emerald-500/40 text-emerald-300 rounded p-2">
                ✅ {resultCS.enviados} envelope{resultCS.enviados !== 1 ? "s" : ""} criado{resultCS.enviados !== 1 ? "s" : ""} no Clicksign — colaboradores notificados.
              </div>
            )}

            {submitting && (
              <div className="text-xs text-muted-foreground">
                Emitindo… {progress.done}/{progress.total}
                {progress.failed > 0 && <span className="text-red-400"> · {progress.failed} falhas</span>}
              </div>
            )}

            <Button onClick={submit} disabled={selected.size === 0 || submitting} className="w-full">
              {submitting && <Loader2 size={12} className="animate-spin" />}
              {canal === "clicksign" ? "Enviar via Clicksign" : "Emitir pra"} {selected.size || 0} colaborador{selected.size !== 1 ? "es" : ""}
            </Button>
          </div>

          {/* Preview do 1º selecionado */}
          <div className="flex-1 overflow-y-auto p-6 bg-white text-black">
            {previewColab ? (
              <>
                <div className="max-w-[600px] mx-auto mb-3 text-[10px] uppercase tracking-wider text-gray-500 font-semibold">
                  Preview · {previewColab.nome} (1 de {selected.size || colabsFiltrados.length})
                </div>
                <div className="max-w-[600px] mx-auto" dangerouslySetInnerHTML={{ __html: renderConteudo(previewColab, previewEmpresa) }} />
              </>
            ) : (
              <div className="text-center text-sm text-gray-500 p-12">Selecione colaboradores pra ver o preview</div>
            )}
          </div>
        </div>
      </Card>
    </div>
  );
}


// ────────────────────────────────────────────────────────────────────
// Mural broadcast — quando modelo é categoria="mural", o "Em massa"
// não emite documentos individuais; faz disparo único em massa por
// WhatsApp com link do mural público. Colaboradores sem celular vão
// pra rh.mural_pendencias automaticamente (backend).
// ────────────────────────────────────────────────────────────────────

const MURAL_MSG_PADRAO = `*Lembrete Mensal – Saúde Preventiva*

A empresa reforça a importância dos cuidados preventivos com a saúde e incentiva seus colaboradores à realização periódica de consultas, exames e acompanhamentos preventivos, conforme orientação médica.

Como parte de seu compromisso com a promoção de um ambiente de trabalho saudável, seguro e responsável, a empresa apoia ações de conscientização e prevenção em saúde, observadas as disposições legais, normas internas e diretrizes aplicáveis.

Eventuais ausências relacionadas à realização de consultas ou exames médicos poderão ser justificadas na forma da legislação trabalhista vigente e das políticas internas da empresa, mediante apresentação da documentação comprobatória correspondente.

Para fins de organização das atividades e continuidade operacional, recomenda-se, sempre que possível, a comunicação prévia à liderança imediata e/ou ao setor responsável.

Este comunicado possui caráter exclusivamente informativo e preventivo, não substituindo normas internas, acordos aplicáveis, disposições legais ou orientações médicas específicas.

Em caso de dúvidas, o RH permanece à disposição para orientações adicionais.

*Link do mural do RH:*`;

type ColabComVinculo = {
  id: string; nome: string; celular: string | null;
  empresa_id: string | null;
  departamento_id: string | null;
};


// ─────────────────────────────────────────────────
// MultiEnvioModal — escolhe vários modelos + vários colaboradores +
// método(s) de assinatura e dispara tudo em UM lote via Clicksign.
// ─────────────────────────────────────────────────

const AUTH_METHODS: Array<{ key: string; label: string; descricao: string; default?: boolean }> = [
  { key: "email", label: "Email (token)", descricao: "Código por email — mais comum", default: true },
  { key: "whatsapp", label: "WhatsApp (token)", descricao: "Código por WhatsApp" },
  { key: "sms", label: "SMS (token)", descricao: "Código por SMS" },
  { key: "pix", label: "PIX", descricao: "Autenticação via Pix (CPF obrigatório)" },
  { key: "handwritten", label: "Assinatura à mão", descricao: "Signatário desenha a assinatura na tela" },
  { key: "selfie", label: "Selfie", descricao: "Foto do rosto com a câmera" },
  { key: "official_document", label: "Documento oficial", descricao: "Foto frente+verso do RG/CNH" },
  { key: "liveness", label: "Selfie dinâmica", descricao: "Foto do rosto com validação de prova de vida (sem precisar de documento)" },
  { key: "icp_brasil", label: "ICP-Brasil", descricao: "Certificado digital ICP-Brasil" },
];

// ─────────────────────────────────────────────────
// UploadAvulsoModal — sobe 1 PDF externo (TRCT, Ficha Registro, etc.) e
// manda pra assinar via Clicksign. Sem template, conteúdo vem do PDF original.
// ─────────────────────────────────────────────────

function UploadAvulsoModal({ onClose, onSent }: { onClose: () => void; onSent: () => void }) {
  const colabs = useFetch(() => api.colaboradoresAtivos(), []);
  const empresas = useFetch(() => api.empresas(), []);
  const contratos = useFetch(() => api.contratos(), []);
  const [colabId, setColabId] = useState<string>("");
  const [search, setSearch] = useState("");
  const [empresaFilter, setEmpresaFilter] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [titulo, setTitulo] = useState("");
  const [authSel, setAuthSel] = useState<Set<string>>(new Set(["email"]));
  const [enviarWa, setEnviarWa] = useState(true);
  const [deadlineDias, setDeadlineDias] = useState(30);
  const [incluirTestemunha, setIncluirTestemunha] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [err, setErr] = useState<string | null>(null);

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

  const toggleAuth = (k: string) => {
    const n = new Set(authSel);
    n.has(k) ? n.delete(k) : n.add(k);
    if (n.size === 0) n.add("email");
    setAuthSel(n);
  };

  const submit = async () => {
    setErr(null); setResult(null);
    if (!colabId) { setErr("Selecione um colaborador"); return; }
    if (!file) { setErr("Selecione um PDF"); return; }
    if (file.size > 50 * 1024 * 1024) { setErr("PDF excede 50MB"); return; }
    setSubmitting(true);
    const fd = new FormData();
    fd.append("pdf", file);
    fd.append("colaborador_id", colabId);
    if (titulo.trim()) fd.append("titulo", titulo.trim());
    fd.append("auth_methods", Array.from(authSel).join(","));
    fd.append("enviar_whatsapp", String(enviarWa));
    fd.append("deadline_dias", String(deadlineDias));
    fd.append("incluir_testemunha", String(incluirTestemunha));
    try {
      const r = await fetch("/api/clicksign/enviar-pdf", { method: "POST", body: fd });
      const j = await r.json();
      if (!r.ok) { setErr(j.detail || `HTTP ${r.status}`); }
      else { setResult(j); setTimeout(onSent, 1500); }
    } catch (e: any) {
      setErr(String(e?.message || e));
    } finally { setSubmitting(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <Card className="w-full max-w-4xl h-[90vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div>
            <div className="text-base font-bold flex items-center gap-2"><Plus size={16} /> Upload PDF avulso</div>
            <div className="text-xs text-muted-foreground mt-0.5">
              Pra docs externos (TRCT, Ficha Registro, holerite assinado, etc.) que vêm prontos de outro sistema.
            </div>
          </div>
          <button onClick={onClose}><X size={18} /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 grid grid-cols-2 gap-4">
          <div className="space-y-3">
            <div className="text-[10px] uppercase font-semibold tracking-wider text-muted-foreground">1. Colaborador</div>
            <div className="grid grid-cols-2 gap-2">
              <select value={empresaFilter} onChange={(e) => setEmpresaFilter(e.target.value)}
                className="h-9 bg-input border border-border rounded-md text-xs px-2">
                <option value="">Todas empresas</option>
                {(empresas.data || []).map((e) => (
                  <option key={e.id} value={e.id}>{e.nome_fantasia || e.razao_social}</option>
                ))}
              </select>
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input placeholder="Nome ou CPF…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
              </div>
            </div>
            <div className="text-[10px] text-muted-foreground">{colabsFilt.length} colaborador{colabsFilt.length !== 1 ? "es" : ""}</div>
            <div className="border border-border rounded max-h-[55vh] overflow-y-auto">
              {colabsFilt.map((c) => (
                <label key={c.id} className={`flex items-start gap-2 px-3 py-2 text-xs border-b border-border last:border-0 cursor-pointer ${colabId === c.id ? "bg-primary/10" : "hover:bg-secondary/30"}`}>
                  <input type="radio" name="colab" checked={colabId === c.id} onChange={() => setColabId(c.id)} className="mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold truncate">{c.nome}</div>
                    <div className="text-[10px] text-muted-foreground">
                      {c.cpf && `CPF ${fmtCPF(c.cpf)}`}
                      {!(c.email_pessoal || c.email_profissional) && <span className="text-red-400"> · ✗ sem email</span>}
                    </div>
                  </div>
                </label>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            <div className="text-[10px] uppercase font-semibold tracking-wider text-muted-foreground">2. PDF + opções</div>
            <div>
              <label className="text-xs font-medium mb-1 block">PDF (até 50MB) *</label>
              <input type="file" accept="application/pdf" onChange={(e) => setFile(e.target.files?.[0] || null)}
                className="w-full text-xs bg-input border border-border rounded-md p-2" />
              {file && <div className="text-[10px] text-muted-foreground mt-1">{file.name} · {(file.size / 1024 / 1024).toFixed(2)} MB</div>}
            </div>
            <div>
              <label className="text-xs font-medium mb-1 block">Título (opcional)</label>
              <Input value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="ex: TRCT Junho 2026" />
            </div>
            <div>
              <label className="text-xs font-medium mb-1 block">Prazo (dias)</label>
              <Input type="number" min={1} max={365} value={deadlineDias}
                onChange={(e) => setDeadlineDias(parseInt(e.target.value) || 30)} />
            </div>
            <div>
              <label className="text-xs font-medium mb-1 block">Métodos de assinatura</label>
              <div className="space-y-1 border border-border rounded p-2 max-h-48 overflow-y-auto">
                {AUTH_METHODS.map((a) => {
                  const on = authSel.has(a.key);
                  return (
                    <label key={a.key} className={`flex items-start gap-2 p-1.5 text-xs cursor-pointer rounded ${on ? "bg-primary/10" : "hover:bg-secondary/30"}`}>
                      <input type="checkbox" checked={on} onChange={() => toggleAuth(a.key)} className="mt-0.5" />
                      <div className="flex-1">
                        <div className="font-semibold">{a.label}</div>
                        <div className="text-[10px] text-muted-foreground">{a.descricao}</div>
                      </div>
                    </label>
                  );
                })}
              </div>
            </div>
            <label className="flex items-center gap-2 text-xs cursor-pointer">
              <input type="checkbox" checked={enviarWa} onChange={(e) => setEnviarWa(e.target.checked)} />
              Enviar aviso por WhatsApp (instância RH)
            </label>
            <label className="flex items-center gap-2 text-xs cursor-pointer">
              <input type="checkbox" checked={incluirTestemunha} onChange={(e) => setIncluirTestemunha(e.target.checked)} />
              Incluir testemunha (Talicia Camargo · RH) — recebe email depois que o colaborador assina
            </label>

            {err && <div className="text-xs text-red-400 p-2 bg-red-500/10 rounded">{err}</div>}
            {result && result.ok && (
              <div className="text-xs text-emerald-300 p-2 bg-emerald-500/10 rounded">
                ✓ Envelope criado · <code className="text-[10px]">{result.envelope_id?.slice(0, 8)}…</code>
              </div>
            )}

            <Button onClick={submit} disabled={!colabId || !file || submitting} className="w-full">
              {submitting && <Loader2 size={12} className="animate-spin" />}
              <Send size={12} /> Enviar pra assinatura
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}


function MultiEnvioModal({
  modelos, onClose, onSent,
}: { modelos: Modelo[]; onClose: () => void; onSent: () => void }) {
  const colabs = useFetch(() => api.colaboradoresAtivos(), []);
  const empresas = useFetch(() => api.empresas(), []);
  const contratos = useFetch(() => api.contratos(), []);
  const departamentos = useFetch(() => api.departamentos(), []);

  // Step 1: modelos
  const [modelosSel, setModelosSel] = useState<Set<string>>(new Set());
  const [modeloSearch, setModeloSearch] = useState("");
  const [catFilter, setCatFilter] = useState<string>("");

  // Step 2: colaboradores
  const [empresaId, setEmpresaId] = useState<string>("");
  const [departamentoId, setDepartamentoId] = useState<string>("");
  const [colabSearch, setColabSearch] = useState("");
  const [colabsSel, setColabsSel] = useState<Set<string>>(new Set());

  // Step 3: opções
  const [authSel, setAuthSel] = useState<Set<string>>(new Set(["email"]));
  const [enviarWa, setEnviarWa] = useState(true);
  const [deadlineDias, setDeadlineDias] = useState(30);
  const [loteTitulo, setLoteTitulo] = useState("");
  const [incluirTestemunha, setIncluirTestemunha] = useState(true);

  // Campos comuns
  const [valores, setValores] = useState<Record<string, any>>({
    cidade: "São Paulo",
    data: new Date().toISOString().slice(0, 10),
  });

  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{
    lote_id?: string; enviados: number; erros: any[]; resultados: any[];
  } | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const contratoByColab = useMemo(() => {
    const m = new Map<string, any>();
    (contratos.data || []).forEach((c: any) => {
      if (c.status === "ativo" || c.status === "Ativo") m.set(c.colaborador_id, c);
      else if (!m.has(c.colaborador_id)) m.set(c.colaborador_id, c);
    });
    return m;
  }, [contratos.data]);

  const modelosFiltered = useMemo(() => {
    const q = modeloSearch.trim().toLowerCase();
    return modelos.filter((m) => {
      if (catFilter && m.categoria !== catFilter) return false;
      // Murais não dão pra Clicksign (são broadcast)
      if (m.categoria === "mural") return false;
      if (q && !m.titulo.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [modelos, modeloSearch, catFilter]);

  const colabsFiltered = useMemo(() => {
    const q = colabSearch.trim().toLowerCase();
    return (colabs.data || []).filter((c) => {
      const contr = contratoByColab.get(c.id);
      if (empresaId && contr?.empresa_id !== empresaId) return false;
      if (departamentoId && contr?.departamento_id !== departamentoId) return false;
      if (q && !c.nome.toLowerCase().includes(q) && !(c.cpf || "").includes(q)) return false;
      return true;
    });
  }, [colabs.data, empresaId, departamentoId, colabSearch, contratoByColab]);

  const deptosFiltrados = useMemo(() => {
    const ds = departamentos.data || [];
    return empresaId ? ds.filter((d: any) => d.empresa_id === empresaId) : ds;
  }, [departamentos.data, empresaId]);

  const toggleModelo = (id: string) => {
    const n = new Set(modelosSel);
    n.has(id) ? n.delete(id) : n.add(id);
    setModelosSel(n);
  };
  const toggleColab = (id: string) => {
    const n = new Set(colabsSel);
    n.has(id) ? n.delete(id) : n.add(id);
    setColabsSel(n);
  };
  const toggleAuth = (k: string) => {
    const n = new Set(authSel);
    n.has(k) ? n.delete(k) : n.add(k);
    // Pelo menos 1 método
    if (n.size === 0) n.add("email");
    setAuthSel(n);
  };
  const toggleAllColabs = () => {
    if (colabsSel.size === colabsFiltered.length) setColabsSel(new Set());
    else setColabsSel(new Set(colabsFiltered.map((c) => c.id)));
  };

  const totalEnvelopes = modelosSel.size * colabsSel.size;

  const submit = async () => {
    if (modelosSel.size === 0) { setErr("Selecione ao menos 1 documento"); return; }
    if (colabsSel.size === 0) { setErr("Selecione ao menos 1 colaborador"); return; }
    setErr(null); setSubmitting(true); setResult(null);
    try {
      const resp = await clicksign.enviar({
        modelo_ids: Array.from(modelosSel),
        colaborador_ids: Array.from(colabsSel),
        campos_extras: valores,
        enviar_whatsapp: enviarWa,
        auth_methods: Array.from(authSel),
        deadline_dias: deadlineDias,
        lote_titulo: loteTitulo || undefined,
        incluir_testemunha: incluirTestemunha,
      });
      setResult({
        lote_id: resp.lote_id,
        enviados: resp.total_enviados,
        erros: resp.erros,
        resultados: resp.resultados,
      });
      if (resp.total_erros === 0) {
        setTimeout(onSent, 2000);
      }
    } catch (e: any) {
      setErr(`Erro: ${e?.message?.slice(0, 300) || e}`);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <Card className="w-full max-w-6xl h-[92vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div>
            <div className="text-base font-bold flex items-center gap-2"><Send size={16} /> Novo envio (multi documentos)</div>
            <div className="text-xs text-muted-foreground mt-0.5">
              Escolha um ou vários modelos, os colaboradores e a forma de assinatura — tudo em um lote único.
            </div>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X size={18} /></button>
        </div>

        <div className="flex-1 overflow-hidden grid grid-cols-3 divide-x divide-border">
          {/* COLUNA 1: MODELOS */}
          <div className="overflow-y-auto p-4 space-y-3">
            <div className="text-[10px] uppercase font-semibold tracking-wider text-muted-foreground">
              1. Documentos · {modelosSel.size} selecionado{modelosSel.size !== 1 ? "s" : ""}
            </div>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input placeholder="Buscar modelo…" value={modeloSearch} onChange={(e) => setModeloSearch(e.target.value)} className="pl-9" />
              </div>
              <select value={catFilter} onChange={(e) => setCatFilter(e.target.value)}
                className="h-9 bg-input border border-border rounded-md text-xs px-2">
                <option value="">Todas</option>
                {CATEGORIAS.filter(c => c.key !== "mural").map((c) => (
                  <option key={c.key} value={c.key}>{c.label}</option>
                ))}
              </select>
            </div>
            <div className="border border-border rounded">
              {modelosFiltered.length === 0 && (
                <div className="p-6 text-center text-xs text-muted-foreground">Nenhum modelo</div>
              )}
              {modelosFiltered.map((m) => {
                const on = modelosSel.has(m.id);
                const cat = CATEGORIAS.find(c => c.key === m.categoria);
                return (
                  <label key={m.id} className={`flex items-start gap-2 px-3 py-2 text-xs border-b border-border last:border-0 cursor-pointer ${on ? "bg-primary/10" : "hover:bg-secondary/30"}`}>
                    <input type="checkbox" checked={on} onChange={() => toggleModelo(m.id)} className="mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold truncate">{m.titulo}</div>
                      <div className={`text-[10px] ${cat?.color || "text-muted-foreground"}`}>{cat?.label || m.categoria}</div>
                    </div>
                  </label>
                );
              })}
            </div>
          </div>

          {/* COLUNA 2: COLABORADORES */}
          <div className="overflow-y-auto p-4 space-y-3">
            <div className="text-[10px] uppercase font-semibold tracking-wider text-muted-foreground">
              2. Colaboradores · {colabsSel.size} selecionado{colabsSel.size !== 1 ? "s" : ""}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <select value={empresaId} onChange={(e) => { setEmpresaId(e.target.value); setDepartamentoId(""); }}
                className="h-9 bg-input border border-border rounded-md text-xs px-2">
                <option value="">Todas empresas</option>
                {(empresas.data || []).map((e) => (
                  <option key={e.id} value={e.id}>{e.nome_fantasia || e.razao_social}</option>
                ))}
              </select>
              <select value={departamentoId} onChange={(e) => setDepartamentoId(e.target.value)}
                className="h-9 bg-input border border-border rounded-md text-xs px-2">
                <option value="">Todos setores</option>
                {deptosFiltrados.map((d: any) => (
                  <option key={d.id} value={d.id}>{d.nome}</option>
                ))}
              </select>
            </div>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input placeholder="Nome ou CPF…" value={colabSearch} onChange={(e) => setColabSearch(e.target.value)} className="pl-9" />
              </div>
              <Button variant="outline" size="sm" onClick={toggleAllColabs}>
                {colabsSel.size === colabsFiltered.length && colabsFiltered.length > 0 ? "Limpar" : "Todos"}
              </Button>
            </div>
            <div className="text-[10px] text-muted-foreground">{colabsFiltered.length} colaborador{colabsFiltered.length !== 1 ? "es" : ""}</div>
            <div className="border border-border rounded max-h-[55vh] overflow-y-auto">
              {colabsFiltered.map((c) => {
                const on = colabsSel.has(c.id);
                return (
                  <label key={c.id} className={`flex items-start gap-2 px-3 py-2 text-xs border-b border-border last:border-0 cursor-pointer ${on ? "bg-primary/10" : "hover:bg-secondary/30"}`}>
                    <input type="checkbox" checked={on} onChange={() => toggleColab(c.id)} className="mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold truncate">{c.nome}</div>
                      <div className="text-[10px] text-muted-foreground">
                        {c.cpf && `CPF ${fmtCPF(c.cpf)}`}
                        {!c.email_pessoal && !c.email_profissional && <span className="text-red-400"> · ✗ sem email</span>}
                      </div>
                    </div>
                  </label>
                );
              })}
            </div>
          </div>

          {/* COLUNA 3: AUTH + OPÇÕES + RESUMO */}
          <div className="overflow-y-auto p-4 space-y-4">
            <div className="text-[10px] uppercase font-semibold tracking-wider text-muted-foreground">
              3. Como vai assinar
            </div>
            <div className="space-y-1">
              {AUTH_METHODS.map((a) => {
                const on = authSel.has(a.key);
                return (
                  <label key={a.key} className={`flex items-start gap-2 p-2 rounded-md cursor-pointer text-xs ${on ? "bg-primary/10 border border-primary/40" : "hover:bg-secondary/30 border border-transparent"}`}>
                    <input type="checkbox" checked={on} onChange={() => toggleAuth(a.key)} className="mt-0.5" />
                    <div className="flex-1">
                      <div className="font-semibold">{a.label}</div>
                      <div className="text-[10px] text-muted-foreground">{a.descricao}</div>
                    </div>
                  </label>
                );
              })}
            </div>
            <div className="text-[10px] text-muted-foreground -mt-2 px-1">
              Pode marcar mais de um — o signatário precisa cumprir todos os marcados. Métodos não-disponíveis no plano são ignorados silenciosamente.
            </div>

            <div className="pt-2 border-t border-border space-y-3">
              <label className="flex items-center gap-2 text-xs cursor-pointer">
                <input type="checkbox" checked={enviarWa} onChange={(e) => setEnviarWa(e.target.checked)} />
                Avisar por WhatsApp (RH · 41 98580250)
              </label>
              <label className="flex items-center gap-2 text-xs cursor-pointer">
                <input type="checkbox" checked={incluirTestemunha} onChange={(e) => setIncluirTestemunha(e.target.checked)} />
                Incluir testemunha (Talicia Camargo · RH) — recebe email depois que o colaborador assina
              </label>
              <div>
                <label className="text-[11px] font-medium mb-1 block">Prazo (dias)</label>
                <Input type="number" min={1} max={365} value={deadlineDias}
                  onChange={(e) => setDeadlineDias(parseInt(e.target.value) || 30)} />
              </div>
              <div>
                <label className="text-[11px] font-medium mb-1 block">Nome do lote (opcional)</label>
                <Input placeholder="ex: Admissões 05/06" value={loteTitulo} onChange={(e) => setLoteTitulo(e.target.value)} />
              </div>
              <div>
                <label className="text-[11px] font-medium mb-1 block">Cidade</label>
                <Input value={valores.cidade || ""} onChange={(e) => setValores({ ...valores, cidade: e.target.value })} />
              </div>
              <div>
                <label className="text-[11px] font-medium mb-1 block">Data</label>
                <Input type="date" value={valores.data || ""} onChange={(e) => setValores({ ...valores, data: e.target.value })} />
              </div>
            </div>

            {/* RESUMO + AÇÃO */}
            <div className="pt-3 border-t border-border space-y-2">
              <div className="bg-secondary/40 p-3 rounded-md text-xs">
                <div className="font-semibold mb-1">Resumo</div>
                <div className="text-muted-foreground">
                  {modelosSel.size} doc{modelosSel.size !== 1 ? "s" : ""} × {colabsSel.size} colab{colabsSel.size !== 1 ? "s" : ""} ={" "}
                  <span className="text-foreground font-semibold">{totalEnvelopes} envelope{totalEnvelopes !== 1 ? "s" : ""}</span>
                </div>
                <div className="text-muted-foreground mt-1">Autenticação: {Array.from(authSel).join(", ") || "—"}</div>
              </div>

              {err && <div className="text-xs text-red-400">{err}</div>}

              {result && result.enviados > 0 && (
                <div className="text-xs bg-emerald-500/10 border border-emerald-500/40 text-emerald-300 rounded p-2">
                  ✅ {result.enviados} envelope{result.enviados !== 1 ? "s" : ""} criado{result.enviados !== 1 ? "s" : ""}.
                  {result.lote_id && <div className="text-[10px] mt-1 opacity-70">Lote: {result.lote_id.slice(0, 8)}…</div>}
                </div>
              )}
              {result && result.erros.length > 0 && (
                <div className="text-xs bg-amber-500/10 border border-amber-500/40 text-amber-300 rounded p-2 max-h-32 overflow-y-auto">
                  ⚠ {result.erros.length} falha{result.erros.length !== 1 ? "s" : ""}:
                  {result.erros.slice(0, 5).map((e, i) => (
                    <div key={i} className="text-[10px] mt-1">{e.colaborador_nome}: {e.erro?.slice(0, 100)}</div>
                  ))}
                </div>
              )}

              <Button onClick={submit} disabled={totalEnvelopes === 0 || submitting} className="w-full">
                {submitting && <Loader2 size={12} className="animate-spin" />}
                {submitting ? "Enviando…" : `Enviar ${totalEnvelopes || 0} envelope${totalEnvelopes !== 1 ? "s" : ""}`}
              </Button>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}


function MuralBroadcastModal({
  modelo, onClose, onDone,
}: { modelo: Modelo; onClose: () => void; onDone: () => void }) {
  const muralSlug = (modelo.campos as any)?.mural_slug || "mural-rh-saude";
  const muralTitulo = modelo.titulo;
  const [modo, setModo] = useState<"individual" | "massa">("massa");
  const [colabs, setColabs] = useState<ColabComVinculo[]>([]);
  const [empresas, setEmpresas] = useState<Array<{ id: string; razao_social: string }>>([]);
  const [departamentos, setDepartamentos] = useState<Array<{ id: string; nome: string }>>([]);
  const [empresaFilter, setEmpresaFilter] = useState<string>("");
  const [deptFilter, setDeptFilter] = useState<string>("");
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());
  const [mensagem, setMensagem] = useState<string>(MURAL_MSG_PADRAO);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [search, setSearch] = useState("");
  const [result, setResult] = useState<{ enviados: any[]; sem_telefone: any[]; falhas: any[] } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        // Endpoint backend usa service_role pra bypassar RLS de rh.colaboradores
        // (a policy `rh.is_rh()` filtra users que não estão marcados como RH).
        const r = await fetch("https://agente.parket.works/api/rh-whatsapp/colaboradores-broadcast");
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const data = await r.json();
        setEmpresas(data.empresas || []);
        setDepartamentos(data.departamentos || []);
        setColabs(((data.colaboradores) || []).map((c: any) => ({
          id: c.id, nome: c.nome, celular: c.celular || null,
          empresa_id: c.empresa_id || null,
          departamento_id: c.departamento_id || null,
        })));
      } catch (e: any) {
        setError(e.message || String(e));
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return colabs.filter((c) => {
      if (empresaFilter && c.empresa_id !== empresaFilter) return false;
      if (deptFilter && c.departamento_id !== deptFilter) return false;
      if (q && !c.nome.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [colabs, search, empresaFilter, deptFilter]);

  const allSelected = filtered.length > 0 && filtered.every((c) => selecionados.has(c.id));

  const toggleAll = () => {
    const next = new Set(selecionados);
    if (allSelected) filtered.forEach((c) => next.delete(c.id));
    else filtered.forEach((c) => next.add(c.id));
    setSelecionados(next);
  };

  const toggle = (id: string) => {
    if (modo === "individual") {
      // Modo individual = só 1 selecionado
      setSelecionados(new Set([id]));
      return;
    }
    const next = new Set(selecionados);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelecionados(next);
  };

  // Quando troca de modo, ajusta seleção: massa→individual mantém o primeiro
  useEffect(() => {
    if (modo === "individual" && selecionados.size > 1) {
      const first = Array.from(selecionados)[0];
      setSelecionados(new Set([first]));
    }
  }, [modo]); // eslint-disable-line react-hooks/exhaustive-deps

  const onSend = async () => {
    if (selecionados.size === 0) {
      setError("Selecione pelo menos 1 colaborador.");
      return;
    }
    setSending(true);
    setError(null);
    try {
      const r = await fetch("https://agente.parket.works/api/rh-whatsapp/mural-broadcast", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mural_slug: muralSlug,
          mural_titulo: muralTitulo,
          mensagem,
          colaborador_ids: Array.from(selecionados),
        }),
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}: ${(await r.text()).slice(0, 300)}`);
      const data = await r.json();
      setResult({
        enviados: data.enviados || [],
        sem_telefone: data.sem_telefone || [],
        falhas: data.falhas || [],
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
        className="bg-card border border-border rounded-xl w-full max-w-3xl max-h-[92vh] overflow-hidden flex flex-col"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div>
            <div className="font-semibold flex items-center gap-2">
              <Send size={14} /> Disparar mural pelo agente
            </div>
            <div className="text-xs text-muted-foreground mt-0.5">{muralTitulo}</div>
          </div>
          <Button size="sm" variant="outline" onClick={onClose}><X size={12} /></Button>
        </div>

        {!result ? (
          <div className="flex-1 overflow-auto p-4 space-y-4">
            {/* Toggle Individual / Em massa */}
            <div className="flex gap-1 bg-secondary/30 rounded p-1">
              <button
                onClick={() => setModo("individual")}
                className={`flex-1 px-3 py-1.5 text-xs font-semibold rounded transition ${modo === "individual" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
              >
                Individual (1 colaborador)
              </button>
              <button
                onClick={() => setModo("massa")}
                className={`flex-1 px-3 py-1.5 text-xs font-semibold rounded transition ${modo === "massa" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
              >
                Em massa (vários)
              </button>
            </div>

            <div>
              <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">
                Mensagem (link anexado automaticamente no final)
              </div>
              <textarea
                value={mensagem}
                onChange={(e) => setMensagem(e.target.value)}
                rows={8}
                className="w-full text-xs bg-background border border-border rounded px-3 py-2 font-mono"
              />
              <div className="text-[10px] text-muted-foreground mt-1">
                Acrescentado no final: 🔗 https://rh.parket.works/mural/{muralSlug}
              </div>
            </div>

            {/* Filtros */}
            <div className="grid grid-cols-2 gap-2">
              <select
                value={empresaFilter}
                onChange={(e) => setEmpresaFilter(e.target.value)}
                className="text-xs bg-background border border-border rounded px-2 py-2"
              >
                <option value="">Todas as empresas</option>
                {empresas.map((e) => <option key={e.id} value={e.id}>{e.razao_social}</option>)}
              </select>
              <select
                value={deptFilter}
                onChange={(e) => setDeptFilter(e.target.value)}
                className="text-xs bg-background border border-border rounded px-2 py-2"
              >
                <option value="">Todos os departamentos</option>
                {departamentos.map((d) => <option key={d.id} value={d.id}>{d.nome}</option>)}
              </select>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                  <Users size={12} /> {filtered.length} colaboradores · {selecionados.size} selecionado{selecionados.size !== 1 ? "s" : ""}
                </div>
                {modo === "massa" && (
                  <Button size="sm" variant="outline" onClick={toggleAll}>
                    {allSelected ? "Desmarcar todos" : "Marcar todos"}
                  </Button>
                )}
              </div>
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar por nome…"
                className="mb-2 text-xs"
              />
              {loading ? (
                <div className="text-xs text-muted-foreground py-4 text-center">
                  <Loader2 size={14} className="animate-spin inline mr-2" /> Carregando…
                </div>
              ) : (
                <div className="max-h-72 overflow-auto border border-border rounded">
                  {filtered.map((c) => {
                    const checked = selecionados.has(c.id);
                    const noTel = !c.celular;
                    return (
                      <label
                        key={c.id}
                        className={`flex items-center gap-2 px-3 py-2 text-xs border-b border-border last:border-b-0 cursor-pointer hover:bg-secondary/30 ${noTel ? "opacity-70" : ""}`}
                      >
                        <input
                          type={modo === "individual" ? "radio" : "checkbox"}
                          name="colab-select"
                          checked={checked}
                          onChange={() => toggle(c.id)}
                        />
                        <span className="flex-1">{c.nome}</span>
                        {noTel
                          ? <Badge variant="outline" className="text-[9px]">sem celular</Badge>
                          : <span className="text-[10px] text-muted-foreground">{c.celular}</span>}
                      </label>
                    );
                  })}
                </div>
              )}
            </div>

            {error && (
              <div className="bg-destructive/10 border border-destructive/40 text-destructive text-xs p-2 rounded">
                ⚠ {error}
              </div>
            )}
          </div>
        ) : (
          <div className="flex-1 overflow-auto p-4 space-y-3">
            <div className="bg-green-500/10 border border-green-500/40 text-green-400 p-3 rounded text-sm">
              ✅ <strong>{result.enviados.length}</strong> WhatsApp enviados com sucesso
            </div>
            {result.sem_telefone.length > 0 && (
              <div className="bg-yellow-500/10 border border-yellow-500/40 p-3 rounded text-xs">
                <div className="font-semibold text-yellow-400 mb-1">
                  ⚠ {result.sem_telefone.length} sem celular — adicionados à lista de pendências:
                </div>
                <ul className="list-disc list-inside ml-2 text-muted-foreground">
                  {result.sem_telefone.map((c: any) => <li key={c.id}>{c.nome}</li>)}
                </ul>
                <div className="text-[10px] text-muted-foreground mt-2">
                  Consulte a aba "Pendentes WhatsApp" pra cadastrar os celulares.
                </div>
              </div>
            )}
            {result.falhas.length > 0 && (
              <div className="bg-destructive/10 border border-destructive/40 p-3 rounded text-xs">
                <div className="font-semibold text-destructive mb-1">
                  ❌ {result.falhas.length} falharam (erro do WhatsApp):
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
                {sending
                  ? <><Loader2 size={12} className="animate-spin" /> Enviando…</>
                  : modo === "individual"
                  ? <><Send size={12} /> Enviar individual</>
                  : <><Send size={12} /> Enviar pra {selecionados.size}</>}
              </Button>
            </>
          ) : (
            <Button size="sm" onClick={onDone}>Ver pendentes</Button>
          )}
        </div>
      </div>
    </div>
  );
}


// ────────────────────────────────────────────────────────────────────
// Lista de pendências — colaboradores que precisam ter celular
// cadastrado pra receber WhatsApp do Mural. Marcar resolvido depois
// que o RH cadastra o celular.
// ────────────────────────────────────────────────────────────────────

function PendentesWhatsAppList() {
  const [data, setData] = useState<{
    total_envios: number;
    pendentes_sem_celular: any[];
    nao_abriram: any[];
    abriram_nao_assinaram: any[];
    assinaram: any[];
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [filter, setFilter] = useState<"todos" | "sem_celular" | "nao_abriu" | "abriu" | "assinou">("todos");
  const [fonte, setFonte] = useState<"mural" | "documentos" | "tudo">("mural");

  async function load(silent: boolean = false, fonteOverride?: "mural" | "documentos" | "tudo") {
    if (silent) setRefreshing(true); else setLoading(true);
    try {
      const f = fonteOverride || fonte;
      const r = await fetch(`https://agente.parket.works/api/rh-whatsapp/monitor?fonte=${f}`);
      if (r.ok) setData(await r.json());
    } catch {}
    setLastUpdate(new Date());
    if (silent) setRefreshing(false); else setLoading(false);
  }
  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  // Quando muda fonte, recarrega imediatamente
  useEffect(() => { load(true); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [fonte]);

  // Polling silencioso a cada 10s + recarrega quando a aba volta a ter foco.
  useEffect(() => {
    const id = setInterval(() => load(true), 10_000);
    const onFocus = () => load(true);
    window.addEventListener("focus", onFocus);
    return () => {
      clearInterval(id);
      window.removeEventListener("focus", onFocus);
    };
    /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, [fonte]);

  async function marcarResolvido(id: string) {
    await supabase.from("mural_pendencias")
      .update({ resolvido: true, resolved_at: new Date().toISOString() })
      .eq("id", id);
    load(true);
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground p-8 justify-center">
        <Loader2 size={14} className="animate-spin" /> Carregando…
      </div>
    );
  }
  if (!data) {
    return <Card className="p-8 text-center text-sm text-muted-foreground">Sem dados do monitoramento.</Card>;
  }

  const counts = {
    sem_celular: data.pendentes_sem_celular.length,
    nao_abriu: data.nao_abriram.length,
    abriu: data.abriram_nao_assinaram.length,
    assinou: data.assinaram.length,
  };

  // Agrega por mural: enviados/assinados/abertos por slug
  type MuralStat = { slug: string; titulo: string; enviados: number; assinados: number; abriram: number; nao_abriram: number; sem_cel: number };
  const porMural: Record<string, MuralStat> = {};
  const bump = (slug: string | undefined, titulo: string | undefined, field: keyof MuralStat) => {
    if (!slug) return;
    const k = slug;
    if (!porMural[k]) porMural[k] = { slug: k, titulo: titulo || k, enviados: 0, assinados: 0, abriram: 0, nao_abriram: 0, sem_cel: 0 };
    (porMural[k][field] as number) += 1;
  };
  data.assinaram.forEach((r: any) => { bump(r.mural_slug, r.mural_titulo, "enviados"); bump(r.mural_slug, r.mural_titulo, "assinados"); });
  data.abriram_nao_assinaram.forEach((r: any) => { bump(r.mural_slug, r.mural_titulo, "enviados"); bump(r.mural_slug, r.mural_titulo, "abriram"); });
  data.nao_abriram.forEach((r: any) => { bump(r.mural_slug, r.mural_titulo, "enviados"); bump(r.mural_slug, r.mural_titulo, "nao_abriram"); });
  data.pendentes_sem_celular.forEach((r: any) => { bump(r.mural_slug, r.mural_titulo, "sem_cel"); });
  const muralStats = Object.values(porMural).sort((a, b) => b.enviados - a.enviados);

  return (
    <div className="space-y-4">
      {/* Header de resumo + toggle de fonte */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="text-xs text-muted-foreground flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-green-500/15 border border-green-500/40 text-green-400 font-medium">
            <span className="relative inline-flex h-1.5 w-1.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-green-500"></span>
            </span>
            AO VIVO · 10s
          </span>
          <span>· {data.total_envios} envios totais</span>
          {refreshing && <Loader2 size={10} className="animate-spin opacity-60" />}
        </div>
        <div className="flex items-center gap-2">
          {/* Toggle fonte */}
          <div className="inline-flex rounded-md border border-border overflow-hidden">
            {([
              { v: "mural", label: "Murais" },
              { v: "documentos", label: "Documentos" },
              { v: "tudo", label: "Tudo" },
            ] as const).map((opt) => (
              <button
                key={opt.v}
                onClick={() => setFonte(opt.v)}
                className={`px-3 py-1 text-[11px] font-semibold transition ${
                  fonte === opt.v
                    ? "bg-primary text-primary-foreground"
                    : "bg-transparent text-muted-foreground hover:bg-secondary"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
          {lastUpdate && (
            <span className="text-[10px] text-muted-foreground">
              atualizado {lastUpdate.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
            </span>
          )}
          <Button size="sm" variant="outline" onClick={() => load(true)}><RefreshCw size={11} /></Button>
        </div>
      </div>

      {/* Resumo por mural com progresso de assinatura */}
      {muralStats.length > 0 && (
        <div className="space-y-2">
          <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Progresso por mural
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {muralStats.map((m) => {
              const pct = m.enviados > 0 ? Math.round((m.assinados / m.enviados) * 100) : 0;
              const done = m.enviados > 0 && m.assinados === m.enviados;
              return (
                <div key={m.slug} className="border border-border rounded-lg p-3 bg-card">
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <div className="text-sm font-medium truncate" title={m.titulo}>{m.titulo}</div>
                    {done ? (
                      <Badge variant="success" className="text-[10px] shrink-0">✅ Concluído</Badge>
                    ) : (
                      <span className="text-xs font-semibold shrink-0" style={{ color: pct >= 80 ? "#10b981" : pct >= 50 ? "#f59e0b" : "#ef4444" }}>
                        {m.assinados}/{m.enviados} ({pct}%)
                      </span>
                    )}
                  </div>
                  <div className="h-1.5 rounded-full overflow-hidden bg-secondary mb-2">
                    <div className="h-full transition-all" style={{ width: `${pct}%`, background: done ? "#10b981" : pct >= 50 ? "#f59e0b" : "#ef4444" }} />
                  </div>
                  <div className="flex gap-3 text-[10px] text-muted-foreground">
                    <span>📤 {m.enviados}</span>
                    <span>👁 {m.abriram}</span>
                    <span className="text-green-400">✓ {m.assinados}</span>
                    {m.sem_cel > 0 && <span className="text-yellow-400">⚠ {m.sem_cel} sem cel</span>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Cards de resumo / filtro clicável */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <FilterCard active={filter === "sem_celular"} onClick={() => setFilter(filter === "sem_celular" ? "todos" : "sem_celular")}
          icon={<Phone size={14} />} color="#eab308" label="Sem celular" count={counts.sem_celular} />
        <FilterCard active={filter === "nao_abriu"} onClick={() => setFilter(filter === "nao_abriu" ? "todos" : "nao_abriu")}
          icon={<XCircle size={14} />} color="#ef4444" label="Não abriram" count={counts.nao_abriu} />
        <FilterCard active={filter === "abriu"} onClick={() => setFilter(filter === "abriu" ? "todos" : "abriu")}
          icon={<Eye size={14} />} color="#f59e0b" label="Abriram, não assinaram" count={counts.abriu} />
        <FilterCard active={filter === "assinou"} onClick={() => setFilter(filter === "assinou" ? "todos" : "assinou")}
          icon={<CheckCircle2 size={14} />} color="#10b981" label="Assinaram" count={counts.assinou} />
      </div>

      {/* Listas. Quando o user clica num card, mostra SÓ aquela lista (mesmo vazia, com "ninguém").
          Em "todos" mostra todas que tiverem itens. */}
      {(filter === "todos" || filter === "sem_celular") && (filter === "sem_celular" || counts.sem_celular > 0) && (
        <MonitorTable
          title="⚠️ Sem celular cadastrado"
          color="#eab308"
          items={data.pendentes_sem_celular}
          cols={["nome", "mural", "desde"]}
          empty="Ninguém pendente por falta de celular."
          action={(p: any) => (
            <Button size="sm" variant="outline" onClick={() => marcarResolvido(p.id)}>Resolver</Button>
          )}
        />
      )}
      {(filter === "todos" || filter === "nao_abriu") && (filter === "nao_abriu" || counts.nao_abriu > 0) && (
        <MonitorTable
          title="🔴 Enviados, não abriram"
          color="#ef4444"
          items={data.nao_abriram}
          cols={["nome", "celular", "mural", "sent_at"]}
          empty="Todo mundo já abriu o link 🎉"
        />
      )}
      {(filter === "todos" || filter === "abriu") && (filter === "abriu" || counts.abriu > 0) && (
        <MonitorTable
          title="🟡 Abriram, não assinaram"
          color="#f59e0b"
          items={data.abriram_nao_assinaram}
          cols={["nome", "celular", "mural", "opened_at"]}
          empty="Quem abriu o link já assinou."
        />
      )}
      {(filter === "todos" || filter === "assinou") && (filter === "assinou" || counts.assinou > 0) && (
        <MonitorTable
          title="🟢 Assinaram"
          color="#10b981"
          items={data.assinaram}
          cols={["nome", "celular", "mural", "signed_at"]}
          empty="Ainda ninguém assinou."
        />
      )}

      {data.total_envios === 0 && counts.sem_celular === 0 && (
        <Card className="p-8 text-center">
          <CheckCircle2 size={28} className="mx-auto text-green-400 mb-2" />
          <div className="font-semibold mb-1">Nenhum envio registrado ainda</div>
          <div className="text-sm text-muted-foreground">Dispare um broadcast pelo modelo "Mural RH" em <strong>Modelos</strong>.</div>
        </Card>
      )}
    </div>
  );
}

function FilterCard({ active, onClick, icon, color, label, count }: any) {
  return (
    <button
      onClick={onClick}
      className="transition text-left hover:opacity-90 active:scale-[0.98]"
      title={active ? "Clique pra desfiltrar" : `Ver quem está em "${label}"`}
      style={{
        padding: 12, borderRadius: 8,
        background: active ? `${color}25` : "var(--card)",
        border: `1px solid ${active ? color : "var(--border)"}`,
        cursor: "pointer",
        opacity: !active && count === 0 ? 0.65 : 1,
        boxShadow: active ? `0 0 0 2px ${color}40` : "none",
      }}
    >
      <div className="flex items-center justify-between">
        <div style={{ color }} className="flex items-center gap-1.5">
          {icon}
          <span className="text-[10px] uppercase tracking-wider font-semibold">{label}</span>
        </div>
        {active && <span className="text-[9px] font-semibold" style={{ color }}>✓ filtrando</span>}
      </div>
      <div className="text-2xl font-bold mt-2" style={{ color: count > 0 ? color : "var(--muted-foreground)" }}>{count}</div>
    </button>
  );
}

function MonitorTable({ title, color, items, cols, action, empty }: {
  title: string; color: string; items: any[];
  cols: ("nome" | "celular" | "mural" | "desde" | "sent_at" | "opened_at" | "signed_at")[];
  action?: (item: any) => any;
  empty?: string;
}) {
  return (
    <Card className="overflow-hidden">
      <div style={{ background: `${color}15`, borderBottom: `1px solid ${color}30`, padding: "8px 12px" }}>
        <div className="text-xs font-semibold uppercase tracking-wider" style={{ color }}>
          {title} ({items.length})
        </div>
      </div>
      {items.length === 0 ? (
        <div className="p-6 text-center text-xs text-muted-foreground">
          {empty || "Ninguém nesta categoria."}
        </div>
      ) : (
      <table className="w-full text-xs">
        <thead className="bg-secondary/30 text-muted-foreground">
          <tr>
            {cols.includes("nome") && <th className="text-left px-3 py-2 font-semibold">Colaborador</th>}
            {cols.includes("celular") && <th className="text-left px-3 py-2 font-semibold">Celular</th>}
            {cols.includes("mural") && <th className="text-left px-3 py-2 font-semibold">Mural</th>}
            {cols.includes("desde") && <th className="text-left px-3 py-2 font-semibold">Desde</th>}
            {cols.includes("sent_at") && <th className="text-left px-3 py-2 font-semibold">Enviado</th>}
            {cols.includes("opened_at") && <th className="text-left px-3 py-2 font-semibold">Abriu em</th>}
            {cols.includes("signed_at") && <th className="text-left px-3 py-2 font-semibold">Assinou em</th>}
            {action && <th className="text-right px-3 py-2 font-semibold">Ação</th>}
          </tr>
        </thead>
        <tbody>
          {items.map((p: any) => {
            return (
              <tr key={p.id} className="border-t border-border">
                {cols.includes("nome") && (
                  <td className="px-3 py-2">
                    <Link to={`/colaboradores/${p.colaborador_id}`} className="hover:text-foreground underline">
                      {p.nome || p.colaborador_id.slice(0, 8)}
                    </Link>
                  </td>
                )}
                {cols.includes("celular") && (
                  <td className="px-3 py-2 text-muted-foreground">
                    {p.celular || <span className="text-yellow-400 flex items-center gap-1"><Phone size={10} /> sem</span>}
                  </td>
                )}
                {cols.includes("mural") && (
                  <td className="px-3 py-2 text-muted-foreground">{p.mural_titulo || p.mural_slug}</td>
                )}
                {cols.includes("desde") && (
                  <td className="px-3 py-2 text-muted-foreground">{fmtDate(p.created_at)}</td>
                )}
                {cols.includes("sent_at") && (
                  <td className="px-3 py-2 text-muted-foreground">{p.sent_at ? new Date(p.sent_at).toLocaleString("pt-BR") : "—"}</td>
                )}
                {cols.includes("opened_at") && (
                  <td className="px-3 py-2 text-muted-foreground">{p.opened_at ? new Date(p.opened_at).toLocaleString("pt-BR") : "—"}</td>
                )}
                {cols.includes("signed_at") && (
                  <td className="px-3 py-2 text-muted-foreground">{p.signed_at ? new Date(p.signed_at).toLocaleString("pt-BR") : "—"}</td>
                )}
                {action && (
                  <td className="px-3 py-2 text-right">{action(p)}</td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
      )}
    </Card>
  );
}

