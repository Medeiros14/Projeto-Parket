/**
 * Kanban de Compras — 3 responsáveis (Ronaldo / Taiara / Marco Antônio),
 * cada um com seu dept_id e conjunto de colunas (espelho 1:1 do Space golden).
 * Lê/escreve os MESMOS kanban_cards do Space — coexistência em sync.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { sb } from "../lib/supabase";
import { useTheme } from "../hooks/useTheme";
import { COLUNAS_COMPRAS, COLUNAS_COMPRAS_ITENS, RESPONSAVEIS_COMPRAS, type DeptCompras } from "../lib/theme";
import { Search, X, AlertTriangle, Clock, CheckSquare, MessageSquare, Package, Layers } from "lucide-react";
import CardModal from "../components/CardModal";

export type ComprasCard = {
  id: string;
  dept_id: string;
  column_id: string;
  title: string;
  subtitle: string | null;
  obra: string | null;
  responsavel: string | null;
  sla: string | null;
  sla_status: string | null;
  priority: string | null;
  checklist_done: number;
  checklist_total: number;
  parent_card_id: string | null;
  description: string | null;
  details: Record<string, any> | null;
  chat_messages: any[] | null;
  created_at: string;
  updated_at: string;
};

const DEPT_KEY = "compras-kanban-dept";

export default function Kanban() {
  const { t } = useTheme();
  const [dept, setDept] = useState<DeptCompras>(() => {
    const s = typeof window !== "undefined" ? localStorage.getItem(DEPT_KEY) : null;
    return (["compras", "compras-taiara", "compras-marco"].includes(s || "") ? s : "compras") as DeptCompras;
  });
  const [cards, setCards] = useState<ComprasCard[]>([]);
  const [parentTitles, setParentTitles] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState("");
  const [ocultarConcluidos, setOcultarConcluidos] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [dragOverCol, setDragOverCol] = useState<string | null>(null);
  // Moves otimistas ainda não confirmados pelo banco — protege contra reloads
  // do realtime que chegam fora de ordem e "devolviam" o card pra coluna velha.
  const pendingMoves = useRef<Record<string, string>>({});

  useEffect(() => { try { localStorage.setItem(DEPT_KEY, dept); } catch { /* noop */ } }, [dept]);

  async function load(d: DeptCompras = dept) {
    const { data } = await sb
      .from("kanban_cards")
      .select("id,dept_id,column_id,title,subtitle,obra,responsavel,sla,sla_status,priority,checklist_done,checklist_total,parent_card_id,description,details,chat_messages,created_at,updated_at")
      .eq("dept_id", d)
      .order("created_at", { ascending: false })
      .limit(600);
    let rows = (data as unknown as ComprasCard[]) || [];
    const pend = pendingMoves.current;
    for (const id of Object.keys(pend)) {
      const row = rows.find((c) => c.id === id);
      if (row && row.column_id === pend[id]) delete pend[id]; // banco confirmou
    }
    if (Object.keys(pend).length) {
      rows = rows.map((c) => (pend[c.id] && pend[c.id] !== c.column_id ? { ...c, column_id: pend[c.id] } : c));
    }
    setCards(rows);
    setLoading(false);
    // Título dos projetos vinculados (cards antigos/do Space não guardam projeto_nome)
    const pids = [...new Set(rows.map((c) => c.parent_card_id).filter(Boolean))] as string[];
    if (pids.length) {
      const { data: pais } = await sb.from("kanban_cards").select("id,title,obra").in("id", pids);
      const m: Record<string, string> = {};
      for (const p of (pais as any[]) || []) m[p.id] = `${p.obra ? p.obra + " — " : ""}${p.title}`;
      setParentTitles(m);
    } else {
      setParentTitles({});
    }
  }

  // Cabeçalho do card = projeto vinculado; sem projeto, não repete o
  // solicitante (já aparece no corpo) — vira "Solicitação — dd/mm/aaaa".
  function tituloCard(c: ComprasCard): string {
    const det = c.details || {};
    if (det.projeto_nome) return det.projeto_nome;
    if (c.parent_card_id && parentTitles[c.parent_card_id]) return parentTitles[c.parent_card_id];
    const m = /^Solicitação — .+ — (\d{2}\/\d{2}\/\d{4})$/.exec(c.title || "");
    if (m) return `Solicitação — ${m[1]}`;
    return c.title;
  }

  useEffect(() => { setLoading(true); load(dept); }, [dept]);

  // Realtime — mudanças no dept ativo (feitas aqui OU no Space) recarregam.
  // Debounce de 400ms: mover vários cards seguidos disparava uma tempestade de
  // reloads concorrentes que chegavam fora de ordem.
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    const ch = (sb as any).channel(`kanban:${dept}`)
      .on("postgres_changes",
          { event: "*", schema: "public", table: "kanban_cards", filter: `dept_id=eq.${dept}` },
          () => {
            if (timer) clearTimeout(timer);
            timer = setTimeout(() => load(dept), 400);
          })
      .subscribe();
    return () => { if (timer) clearTimeout(timer); (sb as any).removeChannel(ch); };
  }, [dept]);

  // Colunas legacy + ci-* que têm ao menos 1 card (evita bagunçar UI quando ninguém ativou o fluxo por item)
  const colunas = useMemo(() => {
    const base = COLUNAS_COMPRAS[dept];
    const ciSlugsAtivas = new Set(cards.map((c) => c.column_id).filter((s) => s?.startsWith("ci-")));
    const ci = COLUNAS_COMPRAS_ITENS.filter((c) => ciSlugsAtivas.has(c.id));
    return [...base, ...ci];
  }, [dept, cards]);
  const resp = RESPONSAVEIS_COMPRAS.find((r) => r.dept === dept)!;
  const colConcluido = colunas.find((c) => c.id === "concluido" || c.id === "finalizado" || c.id === "ci-pago")?.id;

  async function moverParaColuna(id: string, colId: string) {
    const atual = cards.find((c) => c.id === id);
    if (!atual || atual.column_id === colId) return;
    pendingMoves.current[id] = colId;
    setCards((prev) => prev.map((c) => (c.id === id ? { ...c, column_id: colId } : c)));
    const { data, error } = await sb.from("kanban_cards")
      .update({ column_id: colId, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select("id");
    if (error || !data?.length) {
      delete pendingMoves.current[id];
      alert(error ? "Falha ao mover: " + error.message : "Sem permissão pra mover este card (sessão expirada? Faça login de novo).");
      load(dept);
    }
  }

  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return cards.filter((c) => {
      if (!q) return true;
      const det = c.details || {};
      const materiais = Array.isArray(det.materiais) ? det.materiais.map((m: any) => `${m.tipo} ${m.justificativa || ""}`).join(" ") : "";
      const blob = [c.title, tituloCard(c), c.subtitle, c.obra, c.responsavel, det.solicitante, det.setor, det.pedido_por, materiais]
        .filter(Boolean).join(" ").toLowerCase();
      return blob.includes(q);
    });
  }, [cards, busca, parentTitles]);

  const porColuna = useMemo(() => {
    const m: Record<string, ComprasCard[]> = {};
    for (const c of colunas) m[c.id] = [];
    const fallback = colunas[0].id;
    for (const c of filtrados) (m[c.column_id] ?? m[fallback]).push(c);
    return m;
  }, [filtrados, colunas]);

  const nAtivos = cards.filter((c) => c.column_id !== colConcluido).length;

  return (
    // Altura 100% do <main> (não 100vh): no mobile o header do Shell come 48px,
    // e 100vh estouraria o container criando corte no meio + vazio embaixo
    <div style={{ padding: "24px 28px", height: "100%", minHeight: 0, display: "flex", flexDirection: "column" }}>
      <header style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 14 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h1 style={{ fontSize: 19, margin: 0, fontWeight: 600 }}>Compras</h1>
          <div style={{ fontSize: 12, color: t.textMuted }}>
            {resp.nome} · {resp.sub} — {nAtivos} em andamento
          </div>
        </div>

        <div style={{ position: "relative", width: 280 }}>
          <Search size={13} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: t.textMuted }} />
          <input value={busca} onChange={(e) => setBusca(e.target.value)}
                 placeholder="Pesquisar solicitações…"
                 style={{
                   width: "100%", background: t.inputBg, border: `1px solid ${t.border}`,
                   color: t.textPrimary, padding: "8px 28px 8px 30px", borderRadius: 0,
                   fontSize: 12, outline: "none",
                 }} />
          {busca && (
            <button onClick={() => setBusca("")} title="Limpar"
                    style={{ position: "absolute", right: 6, top: "50%", transform: "translateY(-50%)",
                             background: "transparent", border: "none", color: t.textMuted,
                             padding: 4, cursor: "pointer", display: "grid", placeItems: "center" }}>
              <X size={12} />
            </button>
          )}
        </div>

        <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: t.textSecondary, cursor: "pointer", userSelect: "none" }}>
          <input type="checkbox" checked={ocultarConcluidos} onChange={(e) => setOcultarConcluidos(e.target.checked)} />
          Ocultar finalizados
        </label>
      </header>

      {/* Abas por responsável */}
      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        {RESPONSAVEIS_COMPRAS.map((r) => {
          const ativo = r.dept === dept;
          return (
            <button key={r.dept} onClick={() => setDept(r.dept)} style={{
              display: "flex", alignItems: "center", gap: 8, cursor: "pointer",
              padding: "8px 14px", borderRadius: 0,
              background: ativo ? `${r.cor}18` : "transparent",
              border: `1px solid ${ativo ? r.cor : t.border}`,
              borderLeft: `3px solid ${ativo ? r.cor : t.border}`,
            }}>
              <span style={{
                width: 20, height: 20, borderRadius: "50%", background: r.cor, color: "#050505",
                fontSize: 9, fontWeight: 700, display: "grid", placeItems: "center",
              }}>{r.iniciais}</span>
              <span style={{ textAlign: "left" }}>
                <span style={{ display: "block", fontSize: 12, fontWeight: 600, color: ativo ? t.textPrimary : t.textSecondary }}>{r.nome}</span>
                <span style={{ display: "block", fontSize: 9, color: t.textMuted, textTransform: "uppercase", letterSpacing: "0.08em" }}>{r.sub}</span>
              </span>
            </button>
          );
        })}
      </div>

      {loading ? (
        <div style={{ padding: 40, color: t.textMuted }}>Carregando…</div>
      ) : (
        // minHeight 0 deixa a faixa de colunas encolher junto com a tela (sem ele o flex item trava no conteúdo)
        <div style={{ flex: 1, minHeight: 0, overflowX: "auto", overflowY: "hidden" }}>
          <div style={{ display: "flex", gap: 10, height: "100%", minWidth: "100%" }}>
            {colunas
              .filter((col) => !(ocultarConcluidos && col.id === colConcluido && dragId === null && busca === ""))
              .map((col) => {
              const list = porColuna[col.id] || [];
              const isDragOver = dragOverCol === col.id;
              return (
                <div key={col.id}
                  onDragOver={(e) => { e.preventDefault(); setDragOverCol(col.id); }}
                  onDragLeave={() => setDragOverCol((prev) => (prev === col.id ? null : prev))}
                  onDrop={(e) => {
                    e.preventDefault();
                    const id = e.dataTransfer.getData("text/plain");
                    setDragOverCol(null); setDragId(null);
                    if (id) moverParaColuna(id, col.id);
                  }}
                  style={{
                    width: 290, flexShrink: 0,
                    background: isDragOver ? `${col.cor}22` : t.statBg,
                    borderRadius: 0, padding: 10,
                    display: "flex", flexDirection: "column", gap: 8,
                    outline: isDragOver ? `2px dashed ${col.cor}` : "none",
                    outlineOffset: -2, transition: "background 0.15s",
                  }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "4px 6px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                      <div style={{ width: 8, height: 8, borderRadius: "50%", background: col.cor, flexShrink: 0 }} />
                      <div title={col.label} style={{
                        fontSize: 11.5, fontWeight: 600, color: t.textPrimary,
                        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                      }}>{col.label}</div>
                    </div>
                    <div style={{ fontSize: 11, color: t.textMuted, background: t.cardBg, padding: "2px 8px", borderRadius: 999, flexShrink: 0 }}>
                      {list.length}
                    </div>
                  </div>

                  <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 6, minHeight: 0 }}>
                    {list.map((c) => {
                      const det = c.details || {};
                      const isDragging = dragId === c.id;
                      const prazo = det.data_limite_entrega as string | undefined;
                      const atrasado = prazo && c.column_id !== colConcluido
                        && new Date(prazo + "T23:59:59") < new Date();
                      const materiais: any[] = Array.isArray(det.materiais) ? det.materiais : [];
                      const nChat = Array.isArray(c.chat_messages) ? c.chat_messages.length : 0;
                      const solicitante = det.solicitante || det.pedido_por;
                      return (
                        <div key={c.id}
                          draggable
                          onDragStart={(e) => {
                            e.dataTransfer.setData("text/plain", c.id);
                            e.dataTransfer.effectAllowed = "move";
                            setDragId(c.id);
                          }}
                          onDragEnd={() => { setDragId(null); setDragOverCol(null); }}
                          onClick={() => setSelectedId(c.id)}
                          style={{
                            background: t.cardBg, border: `1px solid ${t.border}`, borderRadius: 0,
                            padding: "10px 12px", cursor: "grab", transition: "all 0.15s",
                            opacity: isDragging ? 0.4 : 1,
                            borderLeft: c.priority === "alta"
                              ? `3px solid ${t.danger}`
                              : c.priority === "baixa"
                              ? `3px solid ${t.textMuted}`
                              : `3px solid ${col.cor}`,
                          }}
                          onMouseEnter={(e) => (e.currentTarget.style.background = t.cardHover)}
                          onMouseLeave={(e) => (e.currentTarget.style.background = t.cardBg)}>
                          <div style={{ fontSize: 12.5, fontWeight: 600, marginBottom: 6, color: t.textPrimary, lineHeight: 1.35 }}>
                            {tituloCard(c)}
                          </div>

                          {materiais.length > 0 && (
                            <div style={{ display: "flex", alignItems: "flex-start", gap: 5, fontSize: 10.5, color: t.textSecondary, marginBottom: 6 }}>
                              <Package size={10} style={{ marginTop: 2, flexShrink: 0 }} />
                              <span style={{
                                display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical",
                                overflow: "hidden", lineHeight: 1.4,
                              }}>
                                {materiais.map((m) => m.tipo).filter(Boolean).join(" · ")}
                              </span>
                            </div>
                          )}

                          {solicitante && (
                            <div style={{ fontSize: 10, color: t.textMuted, marginBottom: 4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                              {solicitante}{det.setor ? ` · ${det.setor}` : ""}
                            </div>
                          )}

                          <div style={{ fontSize: 9.5, color: t.textMuted, marginBottom: 4 }}>
                            Solicitado em {new Date(det.data_solicitacao || c.created_at).toLocaleString("pt-BR", {
                              day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit",
                            })}
                          </div>

                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 4 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                              {c.checklist_total > 0 && (
                                <div style={{
                                  display: "flex", alignItems: "center", gap: 3, fontSize: 10,
                                  color: c.checklist_done >= c.checklist_total ? t.success : t.textMuted,
                                }}>
                                  <CheckSquare size={10} /> {c.checklist_done}/{c.checklist_total}
                                </div>
                              )}
                              {(() => {
                                // Badge N/M concluídos (compras_itens_stats) + chip "Misto" + chip gargalo.
                                // Populado pelo trigger compras_recalc_card_column.
                                const s = (det as any).compras_itens_stats;
                                if (!s || !s.total) return null;
                                const ativos = Math.max(0, (s.total || 0) - (s.reprovados || 0));
                                if (!ativos) return null;
                                const aguardando = s.aguardando || 0;
                                const agingDays = s.aging_days || 0;
                                const isGargalo = aguardando > 0 && agingDays >= 3;
                                return (
                                  <>
                                    <div title="Itens completos (pagos) / itens ativos"
                                         style={{ display: "flex", alignItems: "center", gap: 3, fontSize: 10,
                                                  color: s.completos >= ativos ? t.success : "#8B5CF6" }}>
                                      <Layers size={10} /> {s.completos || 0}/{ativos}
                                    </div>
                                    {isGargalo && (
                                      <div title={`${aguardando} item(ns) aguardando aprovação há ${agingDays} dia(s)`}
                                           style={{ padding: "1px 6px", borderRadius: 999, fontSize: 9, fontWeight: 700,
                                                    background: "#EF444420", color: "#EF4444", textTransform: "uppercase",
                                                    letterSpacing: "0.06em", display: "inline-flex", alignItems: "center", gap: 3 }}>
                                        <AlertTriangle size={9} /> {agingDays}d aguardando
                                      </div>
                                    )}
                                    {s.andamento_misto && (
                                      <div title="Itens em fases muito distintas — inspecionar"
                                           style={{ padding: "1px 6px", borderRadius: 999, fontSize: 9, fontWeight: 600,
                                                    background: "#EAB30820", color: "#EAB308", textTransform: "uppercase",
                                                    letterSpacing: "0.06em" }}>
                                        Misto
                                      </div>
                                    )}
                                  </>
                                );
                              })()}
                              {nChat > 0 && (
                                <div style={{ display: "flex", alignItems: "center", gap: 3, fontSize: 10, color: t.textMuted }}>
                                  <MessageSquare size={10} /> {nChat}
                                </div>
                              )}
                            </div>
                            {prazo && (
                              <div style={{ display: "flex", alignItems: "center", gap: 3, fontSize: 10, color: atrasado ? t.danger : t.textMuted }}>
                                {atrasado ? <AlertTriangle size={10} /> : <Clock size={10} />}
                                {new Date(prazo + "T12:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}

                    {list.length === 0 && (
                      <div style={{ padding: 16, textAlign: "center", color: t.textMuted, fontSize: 11 }}>
                        Sem cards
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {selectedId && (
        <CardModal
          cardId={selectedId}
          dept={dept}
          onClose={() => setSelectedId(null)}
          onChanged={() => load(dept)}
        />
      )}
    </div>
  );
}
