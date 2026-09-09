import { useEffect, useMemo, useState } from "react";
import { T, fonts, setorColor, useIsMobile } from "../theme";
import { api } from "../api";

type App = {
  app: string;
  label: string;
  descricao: string;
  setor: string;
  counts: {
    total: number;
    por_categoria: Record<string, number>;
    por_status: Record<string, number>;
  };
};

type Aprendizado = {
  id: string;
  app: string;
  categoria: string;
  titulo: string;
  descricao: string | null;
  contexto: any;
  fonte: string;
  prioridade: string;
  status: string;
  tags: string[];
  autor_email: string | null;
  created_at: string;
  updated_at: string;
};

const CATEGORIAS: { key: string; label: string; sigla: string; color: string }[] = [
  { key: "erro",              label: "Erro",             sigla: "ERR", color: "#B85B4C" },
  { key: "acerto",            label: "Acerto",           sigla: "OK",  color: "#7BA394" },
  { key: "melhoria",          label: "Melhoria",         sigla: "IMP", color: "#C7A45B" },
  { key: "automacao",         label: "Automação",        sigla: "AUT", color: "#A98BC7" },
  { key: "padrao_repetitivo", label: "Padrão repetitivo",sigla: "RPT", color: "#8CA9B8" },
];

const PRIORIDADES = ["baixa", "media", "alta", "critica"] as const;
const STATUS_LIST  = ["aberto", "em_analise", "automatizado", "implementado", "descartado"] as const;

export default function Aprendizados() {
  const isMobile = useIsMobile();
  const [apps, setApps] = useState<App[]>([]);
  const [selectedApp, setSelectedApp] = useState<string>("valoria");
  const [categoriaFilter, setCategoriaFilter] = useState<string>("all");
  const [items, setItems] = useState<Aprendizado[]>([]);
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [analysisModal, setAnalysisModal] = useState<{ id: string; prompt: string; loading: boolean } | null>(null);
  const [copiedFlash, setCopiedFlash] = useState(false);
  const [viewMode, setViewMode] = useState<"categoria" | "historico">("categoria");
  const [history, setHistory] = useState<Aprendizado[]>([]);
  const [historyScope, setHistoryScope] = useState<"app" | "todos">("app");

  const [draft, setDraft] = useState({
    categoria: "melhoria", titulo: "", descricao: "",
    prioridade: "media", tags: "",
  });

  const loadApps = () => api.aprendizadosApps().then(setApps).catch(() => setApps([]));
  const loadItems = () => api.aprendizados({
    app: selectedApp,
    categoria: categoriaFilter === "all" ? undefined : categoriaFilter,
  }).then(setItems).catch(() => setItems([]));

  const loadHistory = () => api.aprendizadosHistory(
    historyScope === "app" ? selectedApp : undefined, 200,
  ).then(setHistory).catch(() => setHistory([]));

  useEffect(() => { loadApps(); }, []);
  useEffect(() => { loadItems(); }, [selectedApp, categoriaFilter]);
  useEffect(() => {
    if (viewMode !== "historico") return;
    loadHistory();
    const t = setInterval(loadHistory, 30_000);
    return () => clearInterval(t);
  }, [viewMode, selectedApp, historyScope]);

  const current = apps.find((a) => a.app === selectedApp);

  const startNew = () => {
    setCreating(true);
    setEditingId(null);
    setDraft({ categoria: "melhoria", titulo: "", descricao: "", prioridade: "media", tags: "" });
  };

  const startEdit = (a: Aprendizado) => {
    setEditingId(a.id);
    setCreating(true);
    setDraft({
      categoria: a.categoria, titulo: a.titulo, descricao: a.descricao || "",
      prioridade: a.prioridade, tags: (a.tags || []).join(", "),
    });
  };

  const save = async () => {
    const payload = {
      app: selectedApp,
      categoria: draft.categoria,
      titulo: draft.titulo,
      descricao: draft.descricao,
      prioridade: draft.prioridade,
      tags: draft.tags.split(",").map((s) => s.trim()).filter(Boolean),
      fonte: "user_report",
    };
    try {
      if (editingId) {
        await api.aprendizadoUpdate(editingId, payload);
      } else {
        await api.aprendizadoCreate(payload);
      }
      setCreating(false); setEditingId(null);
      loadItems(); loadApps();
    } catch (e: any) {
      alert("Falhou: " + (e.message || e));
    }
  };

  const changeStatus = async (a: Aprendizado, novo: string) => {
    await api.aprendizadoUpdate(a.id, { status: novo });
    loadItems(); loadApps();
  };

  const remover = async (a: Aprendizado) => {
    if (!confirm(`Descartar "${a.titulo}"?`)) return;
    await api.aprendizadoDelete(a.id);
    loadItems(); loadApps();
  };

  const pedirAnalise = async (a: Aprendizado) => {
    setAnalysisModal({ id: a.id, prompt: "", loading: true });
    try {
      const r = await api.aprendizadoAnalysisPrompt(a.id);
      setAnalysisModal({ id: a.id, prompt: r.prompt, loading: false });
    } catch (e: any) {
      setAnalysisModal({ id: a.id, prompt: `Erro: ${e.message || e}`, loading: false });
    }
  };

  const copiarPrompt = async () => {
    if (!analysisModal?.prompt) return;
    try {
      await navigator.clipboard.writeText(analysisModal.prompt);
      setCopiedFlash(true);
      setTimeout(() => setCopiedFlash(false), 1500);
    } catch {
      // fallback: seleciona no textarea
      const ta = document.getElementById("analysis-ta") as HTMLTextAreaElement | null;
      ta?.select(); document.execCommand?.("copy");
      setCopiedFlash(true);
      setTimeout(() => setCopiedFlash(false), 1500);
    }
  };

  const grouped = useMemo(() => {
    const g: Record<string, Aprendizado[]> = {};
    for (const a of items) (g[a.categoria] ??= []).push(a);
    return CATEGORIAS.filter((c) => g[c.key]?.length).map((c) => [c, g[c.key]] as const);
  }, [items]);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
      {/* HEADER */}
      <div style={{ padding: isMobile ? "16px 20px" : "24px 32px", borderBottom: `1px solid ${T.border}`, background: T.headerBg, backdropFilter: "blur(8px)" }}>
        <div style={{ fontFamily: fonts.cinzel, fontSize: 14, letterSpacing: "0.22em", color: T.textPrimary }}>
          APRENDIZADO
        </div>
        <div style={{ fontFamily: fonts.inter, fontSize: 9, letterSpacing: "0.20em", color: T.textMuted, textTransform: "uppercase", marginTop: 4 }}>
          o que a teca aprende sobre cada app
        </div>
      </div>

      {/* TABS de APPS */}
      <div style={{
        display: "flex", gap: 2, padding: isMobile ? "10px 12px 0" : "12px 24px 0",
        borderBottom: `1px solid ${T.border}`,
        overflowX: "auto", flexShrink: 0,
      }}>
        {apps.map((a) => {
          const active = selectedApp === a.app;
          return (
            <button
              key={a.app}
              onClick={() => setSelectedApp(a.app)}
              style={{
                background: active ? T.cardHover : "transparent",
                color: active ? T.textPrimary : T.textSecondary,
                border: "none",
                borderBottom: active ? `1px solid ${setorColor[a.setor] || T.textPrimary}` : "1px solid transparent",
                padding: "10px 16px",
                fontFamily: fonts.inter, fontSize: 10,
                letterSpacing: "0.18em", textTransform: "uppercase",
                cursor: "pointer", whiteSpace: "nowrap",
                display: "flex", alignItems: "center", gap: 6,
              }}
            >
              <span style={{ width: 6, height: 6, background: setorColor[a.setor] || T.textSecondary, display: "inline-block" }} />
              {a.label}
              {a.counts.total > 0 && (
                <span style={{ color: T.textMuted, fontSize: 9 }}>· {a.counts.total}</span>
              )}
            </button>
          );
        })}
      </div>

      {/* CONTEÚDO */}
      <div style={{ flex: 1, overflowY: "auto", padding: isMobile ? "16px 16px 60px" : "24px 32px" }}>
        {current && (
          <div style={{ marginBottom: 20 }}>
            <div style={{
              fontFamily: fonts.inter, fontSize: 11, color: T.textSecondary,
              letterSpacing: "0.04em", lineHeight: 1.6,
            }}>{current.descricao}</div>
          </div>
        )}

        {/* Toggle de modo de visualização */}
        <div style={{
          display: "flex", gap: 2, marginBottom: 16, borderBottom: `1px solid ${T.border}`,
        }}>
          <FilterBtn active={viewMode === "categoria"} onClick={() => setViewMode("categoria")}>
            POR CATEGORIA
          </FilterBtn>
          <FilterBtn active={viewMode === "historico"} onClick={() => setViewMode("historico")}>
            HISTÓRICO · TIMELINE
          </FilterBtn>
        </div>

        {/* Barra filtros + botão criar */}
        <div style={{
          display: "flex", flexWrap: "wrap", gap: 12,
          alignItems: "center", justifyContent: "space-between",
          marginBottom: 20, paddingBottom: 12, borderBottom: `1px solid ${T.border}`,
        }}>
          <div style={{ display: "flex", gap: 2, flexWrap: "wrap" }}>
            {viewMode === "categoria" ? (
              <>
                <FilterBtn active={categoriaFilter === "all"} onClick={() => setCategoriaFilter("all")}>
                  TODAS · {current?.counts.total || 0}
                </FilterBtn>
                {CATEGORIAS.map((c) => {
                  const n = current?.counts.por_categoria[c.key] || 0;
                  return (
                    <FilterBtn
                      key={c.key}
                      active={categoriaFilter === c.key}
                      onClick={() => setCategoriaFilter(c.key)}
                      color={c.color}
                    >
                      {c.sigla} · {n}
                    </FilterBtn>
                  );
                })}
              </>
            ) : (
              <>
                <FilterBtn active={historyScope === "app"} onClick={() => setHistoryScope("app")}>
                  APP ATUAL
                </FilterBtn>
                <FilterBtn active={historyScope === "todos"} onClick={() => setHistoryScope("todos")}>
                  TODOS OS APPS
                </FilterBtn>
              </>
            )}
          </div>
          <button onClick={startNew} style={{
            padding: "8px 16px", background: T.textPrimary, color: T.bg,
            border: "none", cursor: "pointer",
            fontFamily: fonts.inter, fontSize: 10, letterSpacing: "0.22em", textTransform: "uppercase",
          }}>+ Novo aprendizado</button>
        </div>

        {/* Form criar/editar */}
        {creating && (
          <div style={{
            padding: 20, marginBottom: 24,
            background: T.cardBg, border: `1px solid ${T.borderHover}`,
          }}>
            <div style={{ fontFamily: fonts.cinzel, fontSize: 11, letterSpacing: "0.20em", color: T.textPrimary, marginBottom: 14 }}>
              {editingId ? "EDITAR APRENDIZADO" : "NOVO APRENDIZADO"}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 8, marginBottom: 8 }}>
              <select
                value={draft.categoria}
                onChange={(e) => setDraft({ ...draft, categoria: e.target.value })}
                style={inputStyle}
              >
                {CATEGORIAS.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
              </select>
              <select
                value={draft.prioridade}
                onChange={(e) => setDraft({ ...draft, prioridade: e.target.value })}
                style={inputStyle}
              >
                {PRIORIDADES.map((p) => <option key={p} value={p}>Prioridade: {p}</option>)}
              </select>
            </div>
            <input
              placeholder="Título"
              value={draft.titulo}
              onChange={(e) => setDraft({ ...draft, titulo: e.target.value })}
              style={{ ...inputStyle, width: "100%", marginBottom: 8 }}
            />
            <textarea
              placeholder="Descrição (markdown livre)"
              rows={5}
              value={draft.descricao}
              onChange={(e) => setDraft({ ...draft, descricao: e.target.value })}
              style={{ ...inputStyle, width: "100%", marginBottom: 8, fontFamily: "monospace", resize: "vertical" }}
            />
            <input
              placeholder="tags separadas, por, vírgula"
              value={draft.tags}
              onChange={(e) => setDraft({ ...draft, tags: e.target.value })}
              style={{ ...inputStyle, width: "100%", marginBottom: 12 }}
            />
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={save} disabled={!draft.titulo.trim()} style={{
                padding: "10px 20px", background: T.textPrimary, color: T.bg,
                border: "none", cursor: draft.titulo.trim() ? "pointer" : "not-allowed",
                fontFamily: fonts.inter, fontSize: 10, letterSpacing: "0.22em", textTransform: "uppercase",
                opacity: draft.titulo.trim() ? 1 : 0.5,
              }}>Salvar</button>
              <button onClick={() => { setCreating(false); setEditingId(null); }} style={{
                padding: "10px 20px", background: "transparent",
                border: `1px solid ${T.border}`, color: T.textSecondary, cursor: "pointer",
                fontFamily: fonts.inter, fontSize: 10, letterSpacing: "0.22em", textTransform: "uppercase",
              }}>Cancelar</button>
            </div>
          </div>
        )}

        {/* Lista */}
        {!creating && items.length === 0 && (
          <div style={{
            padding: 40, textAlign: "center",
            background: T.cardBg, border: `1px solid ${T.border}`,
          }}>
            <div style={{ fontFamily: fonts.cinzel, fontSize: 13, letterSpacing: "0.16em", color: T.textPrimary }}>
              NADA APRENDIDO AINDA
            </div>
            <div style={{ fontFamily: fonts.inter, fontSize: 11, color: T.textSecondary, marginTop: 8 }}>
              Registre o primeiro erro, acerto ou melhoria observado neste app.
            </div>
          </div>
        )}

        {/* Modal Pedir Análise */}
        {analysisModal && (
          <div
            onClick={() => setAnalysisModal(null)}
            style={{
              position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)",
              zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center",
              padding: isMobile ? 12 : 40,
            }}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              style={{
                background: T.bg, border: `1px solid ${T.borderHover}`,
                width: "min(860px, 100%)", maxHeight: "90vh",
                display: "flex", flexDirection: "column",
                boxShadow: "0 20px 60px rgba(0,0,0,0.5)",
              }}
            >
              <div style={{
                padding: "16px 20px", borderBottom: `1px solid ${T.border}`,
                display: "flex", justifyContent: "space-between", alignItems: "center",
              }}>
                <div>
                  <div style={{ fontFamily: fonts.cinzel, fontSize: 12, letterSpacing: "0.20em", color: T.textPrimary }}>
                    PROMPT DE ANÁLISE
                  </div>
                  <div style={{ fontFamily: fonts.inter, fontSize: 9, letterSpacing: "0.16em", color: T.textMuted, textTransform: "uppercase", marginTop: 3 }}>
                    copie e cole no Claude Code
                  </div>
                </div>
                <div style={{ display: "flex", gap: 6 }}>
                  <button
                    onClick={copiarPrompt}
                    disabled={analysisModal.loading || !analysisModal.prompt}
                    style={{
                      padding: "8px 16px",
                      background: copiedFlash ? "#7BA394" : T.textPrimary,
                      color: T.bg, border: "none",
                      cursor: analysisModal.loading ? "wait" : "pointer",
                      fontFamily: fonts.inter, fontSize: 10, letterSpacing: "0.20em",
                      textTransform: "uppercase", transition: "background 0.2s",
                    }}
                  >{copiedFlash ? "✓ copiado" : "copiar"}</button>
                  <button
                    onClick={() => setAnalysisModal(null)}
                    style={{
                      padding: "8px 12px", background: "transparent",
                      border: `1px solid ${T.border}`, color: T.textSecondary, cursor: "pointer",
                      fontSize: 14, lineHeight: 1,
                    }}
                    aria-label="Fechar"
                  >×</button>
                </div>
              </div>
              <div style={{ padding: 16, overflow: "hidden", flex: 1, display: "flex" }}>
                {analysisModal.loading ? (
                  <div style={{ margin: "auto", color: T.textMuted, fontFamily: fonts.inter, fontSize: 11, letterSpacing: "0.14em" }}>
                    montando contexto…
                  </div>
                ) : (
                  <textarea
                    id="analysis-ta"
                    readOnly
                    value={analysisModal.prompt}
                    style={{
                      flex: 1, width: "100%", resize: "none",
                      background: T.inputBg, border: `1px solid ${T.border}`,
                      color: T.textPrimary, padding: 14,
                      fontFamily: "monospace", fontSize: 12, lineHeight: 1.55,
                      outline: "none",
                    }}
                    onFocus={(e) => e.currentTarget.select()}
                  />
                )}
              </div>
            </div>
          </div>
        )}

        {viewMode === "historico" && (
          <TimelineView items={history} apps={apps} />
        )}

        {viewMode === "categoria" && grouped.map(([cat, list]) => (
          <div key={cat.key} style={{ marginBottom: 32 }}>
            <div style={{
              display: "flex", alignItems: "center", gap: 10, marginBottom: 12,
              paddingBottom: 6, borderBottom: `1px solid ${T.border}`,
            }}>
              <span style={{
                background: cat.color, color: T.bg,
                padding: "3px 8px", fontFamily: fonts.inter, fontSize: 8,
                letterSpacing: "0.14em", textTransform: "uppercase",
              }}>{cat.sigla}</span>
              <span style={{ fontFamily: fonts.cinzel, fontSize: 11, letterSpacing: "0.18em", color: T.textPrimary }}>
                {cat.label.toUpperCase()}
              </span>
              <span style={{ fontFamily: fonts.inter, fontSize: 9, color: T.textMuted, letterSpacing: "0.10em" }}>
                {list.length}
              </span>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(auto-fill, minmax(360px, 1fr))", gap: 2 }}>
              {list.map((a) => (
                <div key={a.id} style={{
                  padding: 16, background: T.cardBg,
                  border: `1px solid ${T.border}`,
                  borderLeft: `3px solid ${prioridadeCor(a.prioridade)}`,
                }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6, gap: 8 }}>
                    <div style={{
                      fontFamily: fonts.cinzel, fontSize: 12, letterSpacing: "0.10em",
                      color: T.textPrimary, flex: 1,
                    }}>{a.titulo.toUpperCase()}</div>
                    <span style={{
                      fontFamily: fonts.inter, fontSize: 8, letterSpacing: "0.16em",
                      color: statusCor(a.status), textTransform: "uppercase",
                    }}>{a.status.replace("_", " ")}</span>
                  </div>
                  {a.descricao && (
                    <div style={{
                      fontFamily: fonts.inter, fontSize: 11, color: T.textSecondary,
                      lineHeight: 1.6, letterSpacing: "0.02em", marginBottom: 10,
                      whiteSpace: "pre-wrap",
                    }}>{a.descricao}</div>
                  )}
                  {a.tags?.length > 0 && (
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 10 }}>
                      {a.tags.map((t) => (
                        <span key={t} style={{
                          fontFamily: fonts.inter, fontSize: 9, color: T.textMuted,
                          padding: "2px 6px", border: `1px solid ${T.border}`,
                          letterSpacing: "0.06em",
                        }}>#{t}</span>
                      ))}
                    </div>
                  )}
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 4, alignItems: "center", justifyContent: "space-between" }}>
                    <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                      <select
                        value={a.status}
                        onChange={(e) => changeStatus(a, e.target.value)}
                        style={{ ...miniBtn, background: "transparent" }}
                        aria-label="Status"
                      >
                        {STATUS_LIST.map((s) => <option key={s} value={s}>{s.replace("_", " ")}</option>)}
                      </select>
                      <button onClick={() => pedirAnalise(a)}
                        title="Gera prompt pra colar no Claude Code"
                        style={{ ...miniBtn, color: "#A98BC7", borderColor: "#A98BC744" }}>
                        ⌘ analisar
                      </button>
                      <button onClick={() => startEdit(a)} style={miniBtn}>editar</button>
                      <button onClick={() => remover(a)} style={{ ...miniBtn, color: "#B85B4C" }}>descartar</button>
                    </div>
                    <span style={{ fontFamily: fonts.inter, fontSize: 8, color: T.textMuted, letterSpacing: "0.10em" }}>
                      {a.fonte} · {new Date(a.created_at).toLocaleDateString("pt-BR")}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── util styles ─────────────────────────────────────────────────
const inputStyle: React.CSSProperties = {
  padding: "10px 12px", background: "var(--inputBg)", border: `1px solid var(--border)`,
  color: "var(--textPrimary)", outline: "none",
  fontFamily: "'Inter', sans-serif", fontSize: 12, letterSpacing: "0.02em",
};

const miniBtn: React.CSSProperties = {
  padding: "4px 10px", background: "var(--statBg)",
  border: "1px solid var(--border)", color: "var(--textSecondary)",
  cursor: "pointer", fontFamily: "'Inter', sans-serif", fontSize: 9,
  letterSpacing: "0.14em", textTransform: "uppercase",
};

function FilterBtn({ active, onClick, children, color }: {
  active: boolean; onClick: () => void; children: any; color?: string;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        background: active ? T.cardHover : "transparent",
        color: active ? T.textPrimary : T.textSecondary,
        border: "none",
        borderBottom: active ? `1px solid ${color || T.textPrimary}` : "1px solid transparent",
        padding: "6px 12px",
        fontFamily: fonts.inter, fontSize: 9,
        letterSpacing: "0.16em", textTransform: "uppercase",
        cursor: "pointer",
      }}
    >{children}</button>
  );
}

function prioridadeCor(p: string): string {
  return p === "critica" ? "#B85B4C" : p === "alta" ? "#C7A45B" : p === "media" ? "#8B6F47" : "#77736A";
}

function statusCor(s: string): string {
  if (s === "implementado" || s === "automatizado") return "#7BA394";
  if (s === "descartado") return "#77736A";
  if (s === "em_analise") return "#C7A45B";
  return "#D8D3C7";  // aberto
}

// ── Timeline / Histórico ────────────────────────────────────────
function TimelineView({ items, apps }: { items: any[]; apps: App[] }) {
  const appLabel = (a: string) => apps.find((x) => x.app === a)?.label || a;
  const appSetor = (a: string) => apps.find((x) => x.app === a)?.setor || a;

  // Agrupa por dia (data local pt-BR)
  const groups: { day: string; items: any[] }[] = [];
  const map = new Map<string, any[]>();
  for (const it of items) {
    const d = new Date(it.updated_at || it.created_at);
    const day = d.toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });
    if (!map.has(day)) { map.set(day, []); groups.push({ day, items: [] }); }
    map.get(day)!.push(it);
  }
  for (const g of groups) g.items = map.get(g.day)!;

  if (items.length === 0) {
    return (
      <div style={{
        padding: 40, textAlign: "center",
        background: T.cardBg, border: `1px solid ${T.border}`,
      }}>
        <div style={{ fontFamily: fonts.cinzel, fontSize: 13, letterSpacing: "0.16em", color: T.textPrimary }}>
          SEM HISTÓRICO AINDA
        </div>
        <div style={{ fontFamily: fonts.inter, fontSize: 11, color: T.textSecondary, marginTop: 8 }}>
          Assim que a Teca observar padrões, aparecem aqui em ordem cronológica.
        </div>
      </div>
    );
  }

  return (
    <div style={{ position: "relative" }}>
      {groups.map((g) => (
        <div key={g.day} style={{ marginBottom: 28 }}>
          <div style={{
            display: "flex", alignItems: "center", gap: 12, marginBottom: 12,
          }}>
            <div style={{
              fontFamily: fonts.cinzel, fontSize: 11, letterSpacing: "0.20em",
              color: T.textPrimary, textTransform: "uppercase",
            }}>{g.day}</div>
            <div style={{ flex: 1, height: 1, background: T.border }} />
            <div style={{ fontFamily: fonts.inter, fontSize: 9, color: T.textMuted, letterSpacing: "0.14em" }}>
              {g.items.length} evento{g.items.length === 1 ? "" : "s"}
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, position: "relative", paddingLeft: 20 }}>
            <div style={{
              position: "absolute", left: 6, top: 6, bottom: 6, width: 1,
              background: T.border,
            }} />
            {g.items.map((it: any) => {
              const cor = statusCor(it.status);
              const created = new Date(it.created_at);
              const updated = new Date(it.updated_at);
              const foiAtualizado = it.foi_atualizado || (updated.getTime() - created.getTime() > 60_000);
              const hora = updated.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
              return (
                <div key={it.id + it.updated_at} style={{ position: "relative" }}>
                  <div style={{
                    position: "absolute", left: -18, top: 10,
                    width: 9, height: 9, borderRadius: "50%",
                    background: cor, border: `2px solid ${T.bg}`,
                  }} />
                  <div style={{
                    padding: 12, background: T.cardBg,
                    border: `1px solid ${T.border}`, borderLeft: `3px solid ${prioridadeCor(it.prioridade)}`,
                  }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8, flexWrap: "wrap" }}>
                      <div style={{ fontFamily: fonts.cinzel, fontSize: 11, letterSpacing: "0.10em", color: T.textPrimary, flex: 1 }}>
                        {it.titulo}
                      </div>
                      <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                        <span style={{
                          background: setorColor[appSetor(it.app)] || T.textPrimary,
                          color: T.bg, padding: "2px 6px",
                          fontFamily: fonts.inter, fontSize: 8, letterSpacing: "0.10em", textTransform: "uppercase",
                        }}>{appLabel(it.app)}</span>
                        <span style={{
                          fontFamily: fonts.inter, fontSize: 8, letterSpacing: "0.16em",
                          color: cor, textTransform: "uppercase",
                        }}>{it.status.replace("_", " ")}</span>
                      </div>
                    </div>
                    {it.descricao && (
                      <div style={{
                        fontFamily: fonts.inter, fontSize: 10, color: T.textSecondary,
                        lineHeight: 1.55, marginTop: 6,
                        display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical",
                        overflow: "hidden",
                      }}>{it.descricao}</div>
                    )}
                    <div style={{
                      display: "flex", gap: 10, marginTop: 8,
                      fontFamily: fonts.inter, fontSize: 8, color: T.textMuted,
                      letterSpacing: "0.10em", textTransform: "uppercase", flexWrap: "wrap",
                    }}>
                      <span>{hora}</span>
                      <span>·</span>
                      <span>{it.categoria}</span>
                      <span>·</span>
                      <span>fonte {it.fonte}</span>
                      {foiAtualizado && <><span>·</span><span style={{ color: "#C7A45B" }}>atualizado</span></>}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
