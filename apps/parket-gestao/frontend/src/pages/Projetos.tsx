import { useEffect, useState, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { fonts, useTokens } from "../theme";
import { api, Projeto, Coluna, CronogramaRow, CronogramaInput, EntregaCatalogo, EquipeParket, Fiscal } from "../api";
import { fmtBR, toISO, inputStyle, ItensProjetoLista } from "./Obras";
import TecaAtivarModal from "../components/TecaAtivarModal";
import { AlertarProblemaModal } from "./Crises";
import {
  COR_FASE, FASE_POR_COLUNA, mapearEntregas, agruparFases, type FaseEntrega,
} from "../lib/jornada";

type ViewId = "kanban" | "lista" | "cronograma" | "jornada" | "calendario";
const VIEWS: ViewId[] = ["kanban", "lista", "cronograma", "jornada", "calendario"];

/* Importância do projeto (1–5 estrelas) derivada do valor —
   o time interno não vê R$, só o peso relativo. */
function estrelasDoValor(v?: number | null): number {
  if (!v || v < 30_000) return 1;
  if (v < 60_000) return 2;
  if (v < 120_000) return 3;
  if (v < 300_000) return 4;
  return 5;
}

function Estrelas({ valor, size = 9 }: { valor?: number | null; size?: number }) {
  const t = useTokens();
  const n = estrelasDoValor(valor);
  return (
    <span title="importância do projeto" style={{ fontSize: size, letterSpacing: 2, whiteSpace: "nowrap", lineHeight: 1 }}>
      {[1, 2, 3, 4, 5].map((i) => (
        <span key={i} style={{ color: i <= n ? t.accent : t.border2 }}>★</span>
      ))}
    </span>
  );
}

export default function Projetos() {

  const t = useTokens();
  const [items, setItems] = useState<Projeto[]>([]);
  const [colunas, setColunas] = useState<Coluna[]>([]);
  const [q, setQ] = useState("");
  const [candidatos, setCandidatos] = useState<any[]>([]);
  const [importing, setImporting] = useState<string | null>(null);
  const [showCandidatos, setShowCandidatos] = useState(false);
  const [dragging, setDragging] = useState<string | null>(null);
  const [dragOverCol, setDragOverCol] = useState<string | null>(null);
  const [view, setView] = useState<ViewId>(() => {
    const v = localStorage.getItem("gestao_projetos_view") as ViewId | null;
    return v && VIEWS.includes(v) ? v : "kanban";
  });
  const trocarView = (v: ViewId) => {
    setView(v);
    localStorage.setItem("gestao_projetos_view", v);
  };

  const load = () => api.projetos({ q: q || undefined })
    .then(setItems).catch(() => setItems([]));
  const loadColunas = () => api.colunas().then(setColunas).catch(() => setColunas([]));
  const loadCandidatos = () => api.fonteProstas().then(setCandidatos).catch(() => setCandidatos([]));

  useEffect(() => { loadColunas(); load(); loadCandidatos(); }, []);
  useEffect(() => { const t = setTimeout(load, 220); return () => clearTimeout(t); }, [q]);

  const importar = async (simulacao_id: string) => {
    setImporting(simulacao_id);
    try {
      await api.syncProposta(simulacao_id);
      await Promise.all([load(), loadCandidatos()]);
    } catch (e: any) { alert("Falhou: " + e.message); }
    finally { setImporting(null); }
  };

  const byColumn = useMemo(() => {
    const m: Record<string, Projeto[]> = {};
    for (const p of items) (m[p.column_id] ??= []).push(p);
    return m;
  }, [items]);

  const onDragStart = (id: string) => setDragging(id);

  const onExcluir = async (p: Projeto) => {
    const ok = window.confirm(
      `Excluir "${p.cliente}" da gestão?\n\nIsso remove o projeto, itens, cronograma, fotos e eventos.\nO card do kanban em outros setores fica intacto. Não dá pra desfazer.`
    );
    if (!ok) return;
    const backup = items;
    setItems((prev) => prev.filter((x) => x.id !== p.id));
    try { await api.projetoDelete(p.id); }
    catch (e: any) { alert("Falhou excluir: " + e.message); setItems(backup); }
  };
  const onDrop = async (colId: string) => {
    const id = dragging;
    setDragging(null); setDragOverCol(null);
    if (!id) return;
    const proj = items.find(x => x.id === id);
    if (!proj || proj.column_id === colId) return;
    // Otimista
    setItems((prev) => prev.map(x => x.id === id ? { ...x, column_id: colId } : x));
    try { await api.mover(id, colId); }
    catch (e: any) { alert("Falhou mover: " + e.message); load(); }
  };

  return (
    <div style={{ height: "100%", display: "grid", gridTemplateRows: "auto 1fr", overflow: "hidden" }}>
      {/* HEADER: busca + toggle candidatos */}
      <div style={{
        display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center",
        padding: "16px 24px", borderBottom: `1px solid ${t.border1}`,
      }}>
        <input
          placeholder="BUSCAR CLIENTE / Nº PROPOSTA / OBRA"
          value={q} onChange={(e) => setQ(e.target.value)}
          style={{
            flex: "1 1 260px", maxWidth: 380, padding: "10px 14px",
            background: t.card1, border: `1px solid ${t.border2}`,
            color: t.textPrimary, outline: "none",
            fontFamily: fonts.inter, fontSize: 11, letterSpacing: "0.18em",
            textTransform: "uppercase",
          }}
        />
        <div style={{ display: "flex" }}>
          {VIEWS.map((v, i) => (
            <button
              key={v}
              onClick={() => trocarView(v)}
              style={{
                padding: "8px 14px",
                background: view === v ? t.accent : "transparent",
                color: view === v ? "#050505" : t.textSecondary,
                border: `1px solid ${t.border2}`,
                borderLeft: i > 0 ? "none" : `1px solid ${t.border2}`,
                fontFamily: fonts.inter, fontSize: 9, letterSpacing: "0.20em", textTransform: "uppercase",
                cursor: "pointer",
              }}
            >{v}</button>
          ))}
        </div>
        <div style={{ flex: 1 }} />
        <div style={{ fontSize: 9, letterSpacing: "0.20em", color: t.textTertiary, textTransform: "uppercase" }}>
          {items.length} projetos{view === "kanban" ? " · arraste entre colunas pra avançar" : ""}
        </div>
        {/* Botão "+ Criar Projeto" removido 02/09 (decisão Will): projeto novo
            nasce SÓ no Home Broker. O "+ Importar proposta" abaixo FICA (espelho). */}
        <button
          onClick={() => setShowCandidatos(v => !v)}
          style={{
            padding: "8px 14px",
            background: showCandidatos ? t.accent : "transparent",
            color: showCandidatos ? "#050505" : t.textSecondary,
            border: `1px solid ${t.border2}`,
            fontFamily: fonts.inter, fontSize: 9, letterSpacing: "0.20em", textTransform: "uppercase",
            cursor: "pointer",
          }}
        >+ Importar proposta ({candidatos.length})</button>
      </div>

      {/* KANBAN */}
      <div style={{ position: "relative", overflow: "hidden" }}>
        {showCandidatos && candidatos.length > 0 && (
          <ImportPanel
            candidatos={candidatos}
            importing={importing}
            onImportar={importar}
            onClose={() => setShowCandidatos(false)}
          />
        )}

        {view === "kanban" ? (
          <div style={{
            height: "100%", overflowX: "auto", overflowY: "hidden",
            padding: "16px 20px",
            display: "flex", gap: 10, alignItems: "stretch",
          }}>
            {colunas.map((col) => (
              <KanbanColumn
                key={col.id}
                col={col}
                cards={byColumn[col.id] || []}
                dragOver={dragOverCol === col.id}
                onDragOver={(e) => { e.preventDefault(); setDragOverCol(col.id); }}
                onDragLeave={() => setDragOverCol(cur => cur === col.id ? null : cur)}
                onDrop={() => onDrop(col.id)}
                onDragStart={onDragStart}
                onExcluir={onExcluir}
              />
            ))}
          </div>
        ) : view === "lista" ? (
          <ListaView colunas={colunas} byColumn={byColumn} />
        ) : view === "cronograma" ? (
          <CronogramaView byColumn={byColumn} />
        ) : view === "jornada" ? (
          <JornadaView byColumn={byColumn} colunas={colunas} />
        ) : (
          <CalendarioView byColumn={byColumn} />
        )}
      </div>
    </div>
  );
}

function KanbanColumn({
  col, cards, dragOver, onDragOver, onDragLeave, onDrop, onDragStart, onExcluir,
}: {
  col: Coluna; cards: Projeto[]; dragOver: boolean;
  onDragOver: (e: React.DragEvent) => void; onDragLeave: () => void;
  onDrop: () => void; onDragStart: (id: string) => void;
  onExcluir: (p: Projeto) => Promise<void>;
}) {
  const t = useTokens();
  return (
    <div
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      style={{
        flex: "0 0 280px", width: 280, height: "100%",
        display: "flex", flexDirection: "column",
        background: dragOver ? "#141414" : t.card1,
        border: `1px solid ${dragOver ? col.cor : t.border1}`,
        borderTop: `3px solid ${col.cor}`,
        transition: "background 0.15s, border-color 0.15s",
      }}
    >
      <div style={{
        padding: "12px 14px", borderBottom: `1px solid ${t.border1}`,
        display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
          <span style={{ width: 8, height: 8, background: col.cor, flexShrink: 0 }} />
          <span style={{
            fontFamily: fonts.cinzel, fontSize: 10, letterSpacing: "0.20em",
            color: t.textPrimary, textTransform: "uppercase",
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          }}>{col.titulo}</span>
        </div>
        <span style={{
          fontFamily: fonts.inter, fontSize: 9, letterSpacing: "0.14em",
          color: t.textTertiary,
        }}>{cards.length}</span>
      </div>

      <div style={{
        flex: 1, overflowY: "auto", padding: 8,
        display: "flex", flexDirection: "column", gap: 6,
      }}>
        {cards.length === 0 && (
          <div style={{
            padding: 16, textAlign: "center",
            fontSize: 9, color: t.textTertiary,
            letterSpacing: "0.14em", textTransform: "uppercase",
          }}>vazia</div>
        )}
        {cards.map((p) => (
          <ProjetoCard key={p.id} p={p} corColuna={col.cor}
            onDragStart={() => onDragStart(p.id)}
            onExcluir={onExcluir}
          />
        ))}
      </div>
    </div>
  );
}

function ProjetoCard({ p, corColuna, onDragStart, onExcluir }: {
  p: Projeto; corColuna: string; onDragStart: () => void;
  onExcluir: (p: Projeto) => Promise<void>;
}) {
  const t = useTokens();
  return (
    <Link to={`/projetos/${p.id}`} style={{ textDecoration: "none" }}
      draggable onDragStart={onDragStart}
    >
      <div style={{
        position: "relative",
        padding: 12, background: t.card2,
        border: `1px solid ${t.border1}`,
        borderLeft: `3px solid ${corColuna}`,
        cursor: "grab",
      }}
        onMouseEnter={(e) => (e.currentTarget.style.borderColor = t.border2)}
        onMouseLeave={(e) => (e.currentTarget.style.borderColor = t.border1)}
      >
        <button
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); onExcluir(p); }}
          title="Excluir card da gestão"
          style={{
            position: "absolute", top: 4, right: 4,
            width: 22, height: 22, padding: 0,
            background: "transparent", border: "none",
            color: t.textTertiary, cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 14, lineHeight: 1,
          }}
          onMouseEnter={(e) => { e.currentTarget.style.color = "#d05a3b"; }}
          onMouseLeave={(e) => { e.currentTarget.style.color = t.textTertiary; }}
        >×</button>
        <div style={{
          fontFamily: fonts.cinzel, fontSize: 11, letterSpacing: "0.08em",
          color: t.textPrimary, paddingRight: 22,
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
        }}>
          {p.cliente.toUpperCase()}
        </div>
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8,
          fontFamily: fonts.inter, fontSize: 8, letterSpacing: "0.18em",
          color: t.textTertiary, textTransform: "uppercase", marginTop: 4,
        }}>
          <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            #{p.numero_proposta || "s/nº"}
            {p.obra_code ? ` · ${p.obra_code}` : ""}
          </span>
          <Estrelas valor={p.valor_total} size={8} />
        </div>

        {p.endereco && (
          <div style={{
            fontSize: 10, color: t.textSecondary, marginTop: 6,
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          }}>{p.endereco}</div>
        )}

        <div style={{ marginTop: 10 }}>
          <div style={{
            display: "flex", justifyContent: "space-between", marginBottom: 3,
            fontSize: 8, letterSpacing: "0.14em", color: t.textTertiary,
            textTransform: "uppercase",
          }}>
            <span>{p.n_entregues}/{p.n_itens} itens</span>
            <span>{p.pct_completo}%</span>
          </div>
          <div style={{ height: 2, background: t.border1, position: "relative" }}>
            <div style={{
              position: "absolute", left: 0, top: 0, bottom: 0,
              width: `${p.pct_completo}%`, background: corColuna,
            }} />
          </div>
        </div>

        <div style={{
          marginTop: 8, display: "flex", justifyContent: "space-between",
          fontSize: 8, color: t.textTertiary, letterSpacing: "0.12em", textTransform: "uppercase",
        }}>
          <span>etapa {p.etapa_atual}/9</span>
          <span>{p.vendedor || "—"}</span>
        </div>
      </div>
    </Link>
  );
}

// Cronograma → projeto: match por card_id, fallback por nome normalizado
const normalizeNome = (s: string) =>
  s.toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
   .replace(/[^A-Z0-9 ]/g, "").trim();

function useCronoByProjeto(byColumn: Record<string, Projeto[]>) {
  const [crono, setCrono] = useState<CronogramaRow[]>([]);

  useEffect(() => {
    api.cronogramaList().then(setCrono).catch(() => setCrono([]));
  }, []);

  // Edição inline: otimista + PATCH; recarrega se falhar
  const patchRow = (id: string, patch: Partial<CronogramaInput>) => {
    setCrono((prev) => prev.map((r) => r.id === id ? { ...r, ...patch } as CronogramaRow : r));
    api.cronogramaPatch(id, patch).catch((e: any) => {
      alert("Falhou salvar: " + e.message);
      api.cronogramaList().then(setCrono).catch(() => {});
    });
  };

  const cronoByProjeto = useMemo(() => {
    const all: Projeto[] = Object.values(byColumn).flat();
    const byCard = new Map<string, Projeto>();
    const byNome = new Map<string, Projeto>();
    all.forEach((p) => {
      if (p.card_id) byCard.set(p.card_id, p);
      if (p.cliente) byNome.set(normalizeNome(p.cliente), p);
    });
    const m = new Map<string, CronogramaRow>();
    const setar = (p: Projeto, r: CronogramaRow) => {
      const atual = m.get(p.id);
      // prefere linha ativa (não finalizada); senão a primeira encontrada
      if (!atual || (atual.categoria === "finalizadas" && r.categoria !== "finalizadas")) m.set(p.id, r);
    };
    for (const r of crono) {
      let p: Projeto | undefined;
      if (r.card_id) p = byCard.get(r.card_id);
      if (!p) {
        const key = normalizeNome(r.nome_obra || "");
        if (key) {
          p = byNome.get(key);
          if (!p) {
            for (const [k, cand] of byNome) {
              if (k.startsWith(key) || key.startsWith(k)) { p = cand; break; }
            }
          }
        }
      }
      if (p) setar(p, r);
    }
    return m;
  }, [crono, byColumn]);

  return { cronoByProjeto, patchRow };
}

function ListaView({ colunas, byColumn }: {
  colunas: Coluna[]; byColumn: Record<string, Projeto[]>;
}) {
  const t = useTokens();
  const { cronoByProjeto } = useCronoByProjeto(byColumn);

  const grupos = colunas
    .map((col) => ({ col, cards: byColumn[col.id] || [] }))
    .filter((g) => g.cards.length > 0);

  const th: React.CSSProperties = {
    padding: "8px 12px", textAlign: "left",
    fontFamily: fonts.inter, fontSize: 8, fontWeight: 400,
    letterSpacing: "0.20em", color: t.textTertiary, textTransform: "uppercase",
    borderBottom: `1px solid ${t.border1}`, whiteSpace: "nowrap",
  };
  const td: React.CSSProperties = {
    padding: "10px 12px", fontSize: 10,
    color: t.textSecondary, borderBottom: `1px solid ${t.border1}`,
    verticalAlign: "middle",
  };

  return (
    <div style={{ height: "100%", overflowY: "auto", padding: "16px 20px" }}>
      {grupos.length === 0 && (
        <div style={{
          padding: 32, textAlign: "center", fontSize: 9,
          color: t.textTertiary, letterSpacing: "0.14em", textTransform: "uppercase",
        }}>nenhum projeto</div>
      )}
      {grupos.map(({ col, cards }) => {
        return (
          <div key={col.id} style={{
            marginBottom: 18, background: t.card1,
            border: `1px solid ${t.border1}`, borderTop: `3px solid ${col.cor}`,
          }}>
            <div style={{
              padding: "12px 14px", borderBottom: `1px solid ${t.border1}`,
              display: "flex", alignItems: "center", gap: 8,
            }}>
              <span style={{ width: 8, height: 8, background: col.cor, flexShrink: 0 }} />
              <span style={{
                fontFamily: fonts.cinzel, fontSize: 10, letterSpacing: "0.20em",
                color: t.textPrimary, textTransform: "uppercase",
              }}>{col.titulo}</span>
              <span style={{
                fontFamily: fonts.inter, fontSize: 9, letterSpacing: "0.14em", color: t.textTertiary,
              }}>{cards.length}</span>
            </div>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th style={th}>Cliente</th>
                  <th style={th}>Fiscal</th>
                  <th style={{ ...th, width: 80 }}>Início</th>
                  <th style={{ ...th, width: 80 }}>Término</th>
                  <th style={{ ...th, width: 140 }}>Progresso</th>
                  <th style={{ ...th, width: 70 }}>Etapa</th>
                  <th style={th}>Vendedor</th>
                  <th style={{ ...th, textAlign: "right" }} aria-label="importância" />
                </tr>
              </thead>
              <tbody>
                {cards.map((p) => (
                  <ListaRow key={p.id} p={p} corColuna={col.cor} td={td}
                    crono={cronoByProjeto.get(p.id) || null} />
                ))}
              </tbody>
            </table>
          </div>
        );
      })}
    </div>
  );
}

function ListaRow({ p, corColuna, td, crono }: {
  p: Projeto; corColuna: string; td: React.CSSProperties; crono: CronogramaRow | null;
}) {
  const t = useTokens();
  const navigate = useNavigate();
  const navRef = `/projetos/${p.id}`;
  return (
    <tr
      onClick={() => navigate(navRef)}
      style={{ cursor: "pointer" }}
      onMouseEnter={(e) => (e.currentTarget.style.background = t.card2)}
      onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
    >
      <td style={{ ...td, borderLeft: `3px solid ${corColuna}` }}>
        <Link to={navRef} onClick={(e) => e.stopPropagation()} style={{
          textDecoration: "none",
          fontFamily: fonts.cinzel, fontSize: 11, letterSpacing: "0.08em",
          color: t.textPrimary,
        }}>{p.cliente.toUpperCase()}</Link>
      </td>
      <td style={{ ...td, fontSize: 9, letterSpacing: "0.10em", color: t.textSecondary, textTransform: "uppercase", whiteSpace: "nowrap" }}>
        {crono?.fiscal || "—"}
      </td>
      <td style={{ ...td, whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums" as any }}>
        {crono?.inicio_dia ? fmtBR(toISO(crono.inicio_dia)) : "—"}
      </td>
      <td style={{ ...td, whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums" as any }}>
        {crono?.termino_dia ? fmtBR(toISO(crono.termino_dia)) : "—"}
      </td>
      <td style={td}>
        <div style={{
          display: "flex", justifyContent: "space-between", marginBottom: 3,
          fontSize: 8, letterSpacing: "0.14em", color: t.textTertiary, textTransform: "uppercase",
        }}>
          <span>{p.n_entregues}/{p.n_itens} itens</span>
          <span>{p.pct_completo}%</span>
        </div>
        <div style={{ height: 2, background: t.border1, position: "relative" }}>
          <div style={{
            position: "absolute", left: 0, top: 0, bottom: 0,
            width: `${p.pct_completo}%`, background: corColuna,
          }} />
        </div>
      </td>
      <td style={{ ...td, fontSize: 8, letterSpacing: "0.12em", color: t.textTertiary, textTransform: "uppercase", whiteSpace: "nowrap" }}>
        {p.etapa_atual}/9
      </td>
      <td style={{ ...td, fontSize: 8, letterSpacing: "0.12em", color: t.textTertiary, textTransform: "uppercase", whiteSpace: "nowrap" }}>
        {p.vendedor || "—"}
      </td>
      <td style={{ ...td, textAlign: "right", whiteSpace: "nowrap" }}>
        <Estrelas valor={p.valor_total} />
      </td>
    </tr>
  );
}

/* ═══ VIEW CRONOGRAMA ══════════════════════════════════════
   Layout tabela agrupada por categoria do cronograma_obras.
   Botão ▸ expande o painel com edição da linha + Itens da Obra. */

const CATS_CRONO = [
  { id: "acompanhamento",   label: "Acompanhamento",   cor: "#8CA9B8" },
  { id: "obras_liberadas",  label: "Obras liberadas",  cor: "#C7A45B" },
  { id: "cronograma_final", label: "Cronograma final", cor: "#7BA394" },
  { id: "travado",          label: "Travado",          cor: "#B85B4C" },
  { id: "finalizadas",      label: "Finalizadas",      cor: "#5F5D58" },
] as const;

function CronogramaView({ byColumn }: { byColumn: Record<string, Projeto[]> }) {
  const t = useTokens();
  const navigate = useNavigate();
  const { cronoByProjeto, patchRow } = useCronoByProjeto(byColumn);
  const [equipes, setEquipes] = useState<EquipeParket[]>([]);
  const [fiscais, setFiscais] = useState<Fiscal[]>([]);

  useEffect(() => {
    api.equipesList({ ativo: true }).then(setEquipes).catch(() => setEquipes([]));
    api.fiscalList({ ativo: true }).then(setFiscais).catch(() => setFiscais([]));
  }, []);

  const all: Projeto[] = useMemo(() => Object.values(byColumn).flat(), [byColumn]);

  const grupos = useMemo(() => {
    const semCrono: Projeto[] = [];
    const porCat = new Map<string, { p: Projeto; r: CronogramaRow }[]>();
    for (const p of all) {
      const r = cronoByProjeto.get(p.id);
      if (!r) { semCrono.push(p); continue; }
      const cat = r.categoria || "acompanhamento";
      (porCat.get(cat) ?? porCat.set(cat, []).get(cat)!).push({ p, r });
    }
    const ordem = CATS_CRONO.map(c => c.id as string);
    const g = [...porCat.entries()]
      .sort((a, b) => ordem.indexOf(a[0]) - ordem.indexOf(b[0]))
      .map(([cat, rows]) => ({
        cat,
        label: CATS_CRONO.find(c => c.id === cat)?.label || cat,
        cor: CATS_CRONO.find(c => c.id === cat)?.cor || "#8CA9B8",
        rows,
      }));
    return { g, semCrono };
  }, [all, cronoByProjeto]);

  const COLS = "26px 1.6fr 110px 110px 1.3fr 1fr 80px 80px";
  const hd: React.CSSProperties = {
    fontFamily: fonts.inter, fontSize: 8, letterSpacing: "0.20em",
    color: t.textTertiary, textTransform: "uppercase", whiteSpace: "nowrap",
  };

  return (
    <div style={{ height: "100%", overflowY: "auto", padding: "16px 20px" }}>
      {grupos.g.length === 0 && grupos.semCrono.length === 0 && (
        <div style={{
          padding: 32, textAlign: "center", fontSize: 9,
          color: t.textTertiary, letterSpacing: "0.14em", textTransform: "uppercase",
        }}>nenhum projeto</div>
      )}
      {grupos.g.map(({ cat, label, cor, rows }) => (
        <div key={cat} style={{
          marginBottom: 18, background: t.card1,
          border: `1px solid ${t.border1}`, borderTop: `3px solid ${cor}`,
        }}>
          <div style={{
            padding: "12px 14px", borderBottom: `1px solid ${t.border1}`,
            display: "flex", alignItems: "center", gap: 8,
          }}>
            <span style={{ width: 8, height: 8, background: cor, flexShrink: 0 }} />
            <span style={{
              fontFamily: fonts.cinzel, fontSize: 10, letterSpacing: "0.20em",
              color: t.textPrimary, textTransform: "uppercase",
            }}>{label}</span>
            <span style={{ fontFamily: fonts.inter, fontSize: 9, letterSpacing: "0.14em", color: t.textTertiary }}>
              {rows.length}
            </span>
          </div>
          <div style={{
            display: "grid", gridTemplateColumns: COLS, gap: 10,
            padding: "8px 14px", borderBottom: `1px solid ${t.border1}`,
          }}>
            <span />
            <span style={hd}>Obra</span><span style={hd}>Equipe</span><span style={hd}>Fiscal</span>
            <span style={hd}>Serviço</span><span style={hd}>Localização</span>
            <span style={hd}>Início</span><span style={hd}>Término</span>
          </div>
          {rows.map(({ p, r }) => (
            <CronoRow key={p.id} p={p} r={r} cor={cor} cols={COLS}
              equipes={equipes} fiscais={fiscais}
              onPatch={(patch) => patchRow(r.id, patch)}
              onOpen={() => navigate(`/projetos/${p.id}`)} />
          ))}
        </div>
      ))}
      {grupos.semCrono.length > 0 && (
        <div style={{
          marginBottom: 18, background: t.card1,
          border: `1px solid ${t.border1}`, borderTop: `3px solid ${t.border2}`,
        }}>
          <div style={{
            padding: "12px 14px", borderBottom: `1px solid ${t.border1}`,
            display: "flex", alignItems: "center", gap: 8,
          }}>
            <span style={{ width: 8, height: 8, background: t.border2, flexShrink: 0 }} />
            <span style={{
              fontFamily: fonts.cinzel, fontSize: 10, letterSpacing: "0.20em",
              color: t.textPrimary, textTransform: "uppercase",
            }}>Sem cronograma</span>
            <span style={{ fontFamily: fonts.inter, fontSize: 9, letterSpacing: "0.14em", color: t.textTertiary }}>
              {grupos.semCrono.length}
            </span>
          </div>
          {grupos.semCrono.map((p) => (
            <div key={p.id}
              onClick={() => navigate(`/projetos/${p.id}`)}
              style={{
                padding: "10px 14px", borderBottom: `1px solid ${t.border1}`,
                borderLeft: `3px solid ${t.border2}`, cursor: "pointer",
                fontFamily: fonts.cinzel, fontSize: 11, letterSpacing: "0.08em", color: t.textPrimary,
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = t.card2)}
              onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
            >{p.cliente.toUpperCase()}</div>
          ))}
        </div>
      )}
    </div>
  );
}

function CronoRow({ p, r, cor, cols, equipes, fiscais, onPatch, onOpen }: {
  p: Projeto; r: CronogramaRow; cor: string; cols: string;
  equipes: EquipeParket[]; fiscais: Fiscal[];
  onPatch: (patch: Partial<CronogramaInput>) => void;
  onOpen: () => void;
}) {
  const t = useTokens();
  const [aberto, setAberto] = useState(false);
  const [tecaOpen, setTecaOpen] = useState(false);
  const [alertaOpen, setAlertaOpen] = useState(false);

  const cell: React.CSSProperties = {
    fontSize: 10, color: t.textSecondary,
    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
  };
  const lbl: React.CSSProperties = {
    display: "block", marginBottom: 4,
    fontFamily: fonts.inter, fontSize: 8, letterSpacing: "0.18em",
    color: t.textTertiary, textTransform: "uppercase",
  };
  const dateStyle: React.CSSProperties = {
    ...inputStyle(t), padding: "6px 8px",
    fontVariantNumeric: "tabular-nums" as any,
    colorScheme: t.bg === "#050505" ? "dark" : "light",
  };

  return (
    <div style={{ borderBottom: `1px solid ${t.border1}`, borderLeft: `3px solid ${cor}` }}>
      <div
        style={{
          display: "grid", gridTemplateColumns: cols, gap: 10, alignItems: "center",
          padding: "10px 14px", cursor: "pointer",
        }}
        onClick={() => setAberto((v) => !v)}
        onMouseEnter={(e) => (e.currentTarget.style.background = t.card2)}
        onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
      >
        <button
          title="editar cronograma"
          onClick={(e) => { e.stopPropagation(); setAberto((v) => !v); }}
          style={{
            width: 24, height: 24, padding: 0,
            display: "flex", alignItems: "center", justifyContent: "center",
            background: t.card2, border: `1px solid ${t.border2}`,
            color: t.textSecondary, fontSize: 10, cursor: "pointer",
          }}
        >{aberto ? "▾" : "▸"}</button>
        <span style={{ ...cell, display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
          <span
            onClick={(e) => { e.stopPropagation(); onOpen(); }}
            title="abrir o projeto"
            style={{
              fontFamily: fonts.cinzel, fontSize: 11,
              letterSpacing: "0.08em", color: t.textPrimary,
              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
              flex: 1, minWidth: 0, cursor: "pointer",
            }}
          >{p.cliente.toUpperCase()}</span>
          <button
            onClick={(e) => { e.stopPropagation(); setAlertaOpen(true); }}
            title="Alerta de Riscos — abrir crise nesta obra"
            style={{
              flexShrink: 0,
              display: "inline-flex", alignItems: "center", gap: 4,
              padding: "3px 8px", fontSize: 8, letterSpacing: "0.14em",
              fontFamily: fonts.inter, textTransform: "uppercase",
              background: "#B85B4C", color: "#fff",
              border: "none", borderRadius: 3, cursor: "pointer",
              whiteSpace: "nowrap",
            }}
          >ALERTA</button>
          <button
            onClick={(e) => { e.stopPropagation(); setTecaOpen(true); }}
            title="Ativar Teca IA — captar reunião e gerar tarefas"
            style={{
              flexShrink: 0,
              display: "inline-flex", alignItems: "center", gap: 4,
              padding: "3px 8px", fontSize: 8, letterSpacing: "0.14em",
              fontFamily: fonts.inter, textTransform: "uppercase",
              background: t.accent, color: "#fff",
              border: "none", borderRadius: 3, cursor: "pointer",
              whiteSpace: "nowrap",
            }}
          >TECA IA</button>
        </span>
        <span style={{ ...cell, fontSize: 9, letterSpacing: "0.10em", textTransform: "uppercase" }}>
          {r.equipe || "—"}
        </span>
        <span style={{ ...cell, fontSize: 9, letterSpacing: "0.10em", textTransform: "uppercase" }}>
          {r.fiscal || "—"}
        </span>
        <span style={cell}>{r.servico || "—"}</span>
        <span style={cell}>{r.localizacao || "—"}</span>
        <span style={{ ...cell, fontVariantNumeric: "tabular-nums" as any }}>
          {r.inicio_dia ? fmtBR(toISO(r.inicio_dia)) : "—"}
        </span>
        <span style={{ ...cell, fontVariantNumeric: "tabular-nums" as any }}>
          {r.termino_dia ? fmtBR(toISO(r.termino_dia)) : "—"}
        </span>
      </div>

      {aberto && (
        <div style={{
          padding: "12px 14px 16px 48px", background: t.card2,
          borderTop: `1px solid ${t.border1}`,
        }}>
          <div style={{
            display: "grid", gap: 12,
            gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
          }}>
            <label>
              <span style={lbl}>Categoria</span>
              <select
                value={r.categoria || ""}
                onChange={(e) => onPatch({ categoria: e.target.value })}
                style={inputStyle(t)}
              >
                {CATS_CRONO.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
              </select>
            </label>
            <label>
              <span style={lbl}>Equipe responsável</span>
              <select
                value={r.equipe || ""}
                onChange={(e) => onPatch({ equipe: e.target.value || null })}
                style={inputStyle(t)}
              >
                <option value="">— equipe —</option>
                {equipes.map((eq) => (
                  <option key={eq.id} value={eq.nome}>{eq.nome} · {eq.categoria}</option>
                ))}
                {r.equipe && !equipes.find((e) => e.nome === r.equipe) && (
                  <option value={r.equipe}>{r.equipe}</option>
                )}
              </select>
            </label>
            <label>
              <span style={lbl}>Fiscal</span>
              <select
                value={r.fiscal || ""}
                onChange={(e) => onPatch({ fiscal: e.target.value || null })}
                style={inputStyle(t)}
              >
                <option value="">— fiscal —</option>
                {fiscais.map((f) => <option key={f.id} value={f.nome}>{f.nome}</option>)}
                {r.fiscal && !fiscais.find((f) => f.nome.trim().toUpperCase() === r.fiscal!.trim().toUpperCase()) && (
                  <option value={r.fiscal}>{r.fiscal}</option>
                )}
              </select>
            </label>
            <label>
              <span style={lbl}>Início</span>
              <input type="date" value={toISO(r.inicio_dia)} style={dateStyle}
                onChange={(e) => onPatch({ inicio_dia: e.target.value || null })} />
            </label>
            <label>
              <span style={lbl}>Término (entrega)</span>
              <input type="date" value={toISO(r.termino_dia)} style={dateStyle}
                onChange={(e) => onPatch({ termino_dia: e.target.value || null })} />
            </label>
            <label>
              <span style={lbl}>Serviço</span>
              <input defaultValue={r.servico || ""} style={inputStyle(t)}
                onBlur={(e) => { if (e.target.value !== (r.servico || "")) onPatch({ servico: e.target.value || null }); }} />
            </label>
            <label>
              <span style={lbl}>Localização</span>
              <input defaultValue={r.localizacao || ""} style={inputStyle(t)}
                onBlur={(e) => { if (e.target.value !== (r.localizacao || "")) onPatch({ localizacao: e.target.value || null }); }} />
            </label>
            <label>
              <span style={lbl}>Observação</span>
              <input defaultValue={r.observacao || ""} style={inputStyle(t)}
                onBlur={(e) => { if (e.target.value !== (r.observacao || "")) onPatch({ observacao: e.target.value || null }); }} />
            </label>
          </div>

          <div style={{ marginTop: 16 }}>
            <div style={{ fontFamily: fonts.cinzel, fontSize: 9, letterSpacing: "0.22em", textTransform: "uppercase", color: t.accent, marginBottom: 8 }}>
              Itens da Obra
            </div>
            <ItensProjetoLista projetoId={p.id} crono={r} equipes={equipes} />
          </div>
          <div style={{ marginTop: 10, fontSize: 9, color: t.textTertiary, letterSpacing: "0.06em" }}>
            alterações salvam automaticamente · clique no nome da obra para abrir o projeto
          </div>
        </div>
      )}

      {tecaOpen && (
        <TecaAtivarModal
          projetoId={p.id}
          projetoNome={p.cliente}
          cardId={p.card_id ?? null}
          onClose={() => setTecaOpen(false)}
        />
      )}

      {alertaOpen && (
        <AlertarProblemaModal
          origem="projeto"
          prefill={{
            card_id: p.card_id ?? null,
            projeto_id: p.id,
            cliente: p.cliente,
          }}
          onFechar={() => setAlertaOpen(false)}
          onOk={() => setAlertaOpen(false)}
        />
      )}
    </div>
  );
}

/* ═══ VIEW JORNADA ═════════════════════════════════════════
   Destaque: as bolinhas de evolução. As bolinhas são as
   ENTREGAS da Central de Documentos (fases 1-6 do catálogo);
   ponto cheio = documento preenchido. A coluna do kanban do
   projeto habilita as fases (o que trava/habilita no cliente).
   Padrão parket (Cinzel/Inter + tokens). */

function JornadaView({ byColumn, colunas }: {
  byColumn: Record<string, Projeto[]>; colunas: Coluna[];
}) {
  const t = useTokens();
  const [entregas, setEntregas] = useState<EntregaCatalogo[]>([]);
  const [preenchidos, setPreenchidos] = useState<Record<string, number[]>>({});

  useEffect(() => {
    api.jornada()
      .then((r) => {
        setEntregas(mapearEntregas(r.entregas || []));
        setPreenchidos(r.preenchidos || {});
      })
      .catch(() => { setEntregas([]); setPreenchidos({}); });
  }, []);

  const fases: FaseEntrega[] = useMemo(() => agruparFases(entregas), [entregas]);

  const all: Projeto[] = useMemo(() => Object.values(byColumn).flat(), [byColumn]);
  const ordemColuna = useMemo(() => {
    const m = new Map<string, number>();
    colunas.forEach((c, i) => m.set(c.id, c.ordem ?? i));
    return m;
  }, [colunas]);

  const linhas = useMemo(() => {
    const calc = (p: Projeto) => {
      const filled = new Set(preenchidos[p.id] || []);
      const travado = p.column_id === "travado";
      let faseMax = FASE_POR_COLUNA[p.column_id] ?? 4;
      if (travado) {
        // travado mantém o que já foi alcançado
        faseMax = Math.max(1, ...entregas.filter((e) => filled.has(e.id)).map((e) => e.fase));
      }
      const atual = entregas.find((e) => e.fase <= faseMax && !filled.has(e.id)) || null;
      return { p, filled, faseMax, travado, atual };
    };
    return all.map(calc).sort((a, b) =>
      (b.filled.size - a.filled.size) ||
      ((ordemColuna.get(b.p.column_id) ?? 0) - (ordemColuna.get(a.p.column_id) ?? 0)));
  }, [all, preenchidos, entregas, ordemColuna]);

  const GRID = "26px 210px 1fr 190px";

  return (
    <div style={{ height: "100%", overflow: "auto", padding: "16px 20px" }}>
      <div style={{ minWidth: 1100, background: t.card1, border: `1px solid ${t.border1}` }}>
        {/* header: fases da Central de Documentos */}
        <div style={{
          display: "grid", gridTemplateColumns: GRID, gap: 12, alignItems: "center",
          padding: "10px 16px", borderBottom: `1px solid ${t.border1}`,
          position: "sticky", top: 0, background: t.card1, zIndex: 2,
        }}>
          <span />
          <span style={{
            fontFamily: fonts.inter, fontSize: 8, letterSpacing: "0.20em",
            color: t.textTertiary, textTransform: "uppercase",
          }}>Obra</span>
          <div style={{ display: "flex", gap: 6 }}>
            {fases.map((f) => (
              <span key={f.fase} style={{
                flex: Math.max(f.entregas.length, 1.6), minWidth: 0, textAlign: "center",
                fontFamily: fonts.inter, fontSize: 8, letterSpacing: "0.14em",
                color: f.cor, textTransform: "uppercase",
                overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
              }}>{f.label}</span>
            ))}
          </div>
          <span style={{
            fontFamily: fonts.inter, fontSize: 8, letterSpacing: "0.20em",
            color: t.textTertiary, textTransform: "uppercase",
          }}>Está em</span>
        </div>

        {linhas.length === 0 && (
          <div style={{
            padding: 32, textAlign: "center", fontSize: 9,
            color: t.textTertiary, letterSpacing: "0.14em", textTransform: "uppercase",
          }}>nenhum projeto</div>
        )}
        {linhas.map(({ p, filled, faseMax, travado, atual }) => (
          <JornadaRow key={p.id} p={p} fases={fases} filled={filled}
            faseMax={faseMax} travado={travado} atual={atual}
            col={colunas.find((c) => c.id === p.column_id) || null}
            totalEntregas={entregas.length} grid={GRID} />
        ))}
      </div>
      <div style={{
        marginTop: 10, fontSize: 9, color: t.textTertiary,
        letterSpacing: "0.08em",
      }}>
        ▸ abre as entregas por extenso, agrupadas pelas etapas do painel do cliente ·
        ponto cheio = documento preenchido · anel maior = próxima entrega ·
        apagado = etapa ainda não habilitada pelo kanban · vermelho = travado ·
        obras ordenadas da mais avançada para a mais nova
      </div>
    </div>
  );
}

function JornadaRow({ p, fases, filled, faseMax, travado, atual, col, totalEntregas, grid }: {
  p: Projeto; fases: FaseEntrega[]; filled: Set<number>;
  faseMax: number; travado: boolean; atual: EntregaCatalogo | null;
  col: Coluna | null; totalEntregas: number; grid: string;
}) {
  const t = useTokens();
  const navigate = useNavigate();
  const [aberto, setAberto] = useState(false);

  const corPill = travado ? "#B85B4C" : (col?.cor || t.accent);

  const dot = (e: EntregaCatalogo): React.CSSProperties => {
    if (atual && e.id === atual.id) return {
      width: 13, height: 13, borderRadius: "50%", flexShrink: 0,
      background: t.card1, border: `1.5px solid ${travado ? "#B85B4C" : t.accent}`,
      boxShadow: `0 0 0 3px ${travado ? "#B85B4C" : t.accent}44`,
    };
    if (filled.has(e.id)) return {
      width: 9, height: 9, borderRadius: "50%", flexShrink: 0,
      background: t.accent, border: `1.5px solid ${t.accent}`,
    };
    if (e.fase > faseMax) return {
      width: 9, height: 9, borderRadius: "50%", flexShrink: 0,
      background: "transparent", border: `1.5px solid ${t.border1}`,
    };
    return {
      width: 9, height: 9, borderRadius: "50%", flexShrink: 0,
      background: t.border1, border: `1.5px solid ${t.border2}`,
    };
  };

  const linha = (e: EntregaCatalogo): React.CSSProperties => ({
    flex: 1, height: 2,
    background: filled.has(e.id)
      ? `linear-gradient(90deg, ${t.accentDim || t.accent}, ${t.accent})`
      : t.border1,
  });

  return (
    <div style={{ borderBottom: `1px solid ${t.border1}` }}>
      <div style={{
        display: "grid", gridTemplateColumns: grid, gap: 12, alignItems: "center",
        padding: "11px 16px",
      }}>
        <button
          onClick={() => setAberto((v) => !v)}
          title="ver as entregas por extenso"
          style={{
            width: 24, height: 24, padding: 0,
            display: "flex", alignItems: "center", justifyContent: "center",
            background: t.card2, border: `1px solid ${t.border2}`,
            color: t.textSecondary, fontSize: 10, cursor: "pointer",
          }}
        >{aberto ? "▾" : "▸"}</button>

        <button
          onClick={() => navigate(`/projetos/${p.id}`)}
          style={{
            minWidth: 0, padding: 0, background: "none", border: "none",
            cursor: "pointer", textAlign: "left",
          }}
        >
          <span style={{
            display: "block", fontFamily: fonts.cinzel, fontSize: 12,
            letterSpacing: "0.08em", color: t.textPrimary,
            whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
          }}>{p.cliente.toUpperCase()}</span>
          <span style={{
            display: "flex", alignItems: "center", gap: 6,
            marginTop: 2, fontFamily: fonts.inter,
            fontSize: 8, letterSpacing: "0.14em", color: t.textTertiary,
            textTransform: "uppercase", whiteSpace: "nowrap",
            overflow: "hidden",
          }}>
            <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>
              #{p.numero_proposta || "s/nº"} · {filled.size}/{totalEntregas}
            </span>
            <Estrelas valor={p.valor_total} size={8} />
          </span>
        </button>

        {/* trilha de bolinhas por fase — o destaque da view */}
        <div
          onClick={() => setAberto((v) => !v)}
          style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", minWidth: 0 }}
        >
          {fases.map((f) => (
            <span key={f.fase} style={{
              flex: Math.max(f.entregas.length, 1.6), minWidth: 0,
              display: "flex", alignItems: "center",
              background: f.fase > faseMax ? `${f.cor}0D` : `${f.cor}1E`,
              borderRadius: 7, padding: 6,
              opacity: f.fase > faseMax ? 0.55 : 1,
            }}>
              <span style={{ flex: 1, height: 2, background: t.border1 }} />
              {f.entregas.map((e) => (
                <span key={e.id} style={{ display: "contents" }}>
                  <span title={`${e.codigo} · ${e.titulo}${e.fase > faseMax ? " (habilita ao avançar no kanban)" : ""}`}
                    style={dot(e)} />
                  <span style={linha(e)} />
                </span>
              ))}
            </span>
          ))}
        </div>

        <button
          onClick={() => setAberto((v) => !v)}
          title={col ? `coluna do kanban: ${col.titulo}` : undefined}
          style={{
            display: "inline-flex", alignItems: "center", gap: 6,
            justifySelf: "start", maxWidth: "100%",
            padding: "3px 10px", borderRadius: 99, border: "none", cursor: "pointer",
            background: `${corPill}26`, color: corPill,
            fontFamily: fonts.inter, fontSize: 9, letterSpacing: "0.06em", fontWeight: 700,
          }}
        >
          <span style={{ width: 6, height: 6, borderRadius: "50%", background: "currentColor", flexShrink: 0 }} />
          <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {travado ? "TRAVADO" : (col?.titulo || "—")}
            {atual ? ` · ${atual.codigo}` : ""}
          </span>
        </button>
      </div>

      {aberto && (
        <div style={{
          padding: "4px 16px 16px 54px", background: t.card2,
          borderTop: `1px solid ${t.border1}`,
        }}>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 20, paddingTop: 12 }}>
            {fases.map((f) => (
              <div key={f.fase} style={{ minWidth: 170 }}>
                <div style={{
                  display: "inline-block", marginBottom: 9,
                  fontFamily: fonts.inter, fontSize: 8, fontWeight: 700,
                  letterSpacing: "0.14em", textTransform: "uppercase",
                  color: f.cor, background: `${f.cor}1E`,
                  borderRadius: 5, padding: "3px 9px",
                  opacity: f.fase > faseMax ? 0.55 : 1,
                }}>{f.label}{f.fase > faseMax ? " · travada" : ""}</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                  {f.entregas.map((e) => {
                    const isAtual = atual?.id === e.id;
                    const isDone = filled.has(e.id);
                    const bloqueada = e.fase > faseMax;
                    const cor = isDone || isAtual ? t.accent : t.textTertiary;
                    return (
                      <button key={e.id}
                        onClick={() => navigate(`/projetos/${p.id}?tab=documentos`)}
                        title={bloqueada ? "habilita quando o projeto avançar no kanban" : "abrir na central de documentos"}
                        style={{
                          display: "flex", alignItems: "center", gap: 8, width: "100%",
                          padding: "6px 10px", borderRadius: 7, cursor: "pointer", textAlign: "left",
                          background: isDone ? `${t.accent}1C` : t.card1,
                          border: `1px solid ${isAtual ? t.accent : isDone ? `${t.accent}55` : t.border1}`,
                          opacity: bloqueada ? 0.55 : 1,
                        }}
                      >
                        <span style={{
                          width: 26, fontFamily: fonts.inter, fontSize: 9,
                          fontVariantNumeric: "tabular-nums" as any, color: cor,
                        }}>{e.codigo}</span>
                        <span style={{
                          flex: 1, fontFamily: fonts.inter, fontSize: 10,
                          color: isAtual ? t.textPrimary : isDone ? t.textSecondary : t.textTertiary,
                        }}>{e.titulo}</span>
                        <span style={{ fontSize: 9, fontWeight: 700, color: cor, whiteSpace: "nowrap" }}>
                          {isDone ? "✓" : isAtual ? "● agora" : bloqueada ? "🔒" : ""}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 12, fontSize: 9, color: t.textTertiary, letterSpacing: "0.06em" }}>
            clique em qualquer entrega para abrir a central de documentos desta obra ·
            fases travadas habilitam conforme o projeto avança no kanban
          </div>
        </div>
      )}
    </div>
  );
}

function ImportPanel({ candidatos, importing, onImportar, onClose }: {
  candidatos: any[]; importing: string | null;
  onImportar: (id: string) => void; onClose: () => void;
}) {
  const t = useTokens();
  return (
    <div style={{
      position: "absolute", top: 0, right: 0, bottom: 0, width: 360, zIndex: 5,
      background: t.card1, borderLeft: `1px solid ${t.border2}`,
      display: "flex", flexDirection: "column",
    }}>
      <div style={{
        padding: "14px 16px", borderBottom: `1px solid ${t.border1}`,
        display: "flex", alignItems: "center", justifyContent: "space-between",
      }}>
        <div>
          <div style={{ fontFamily: fonts.cinzel, fontSize: 11, letterSpacing: "0.20em", color: t.textPrimary }}>
            IMPORTAR PROPOSTA
          </div>
          <div style={{ fontSize: 9, letterSpacing: "0.18em", color: t.textTertiary, textTransform: "uppercase", marginTop: 4 }}>
            {candidatos.length} sem projeto ainda
          </div>
        </div>
        <button onClick={onClose} style={{
          background: "transparent", border: "none", color: t.textSecondary,
          cursor: "pointer", fontSize: 18, padding: 0,
        }}>×</button>
      </div>
      <div style={{ flex: 1, overflowY: "auto", padding: 8, display: "flex", flexDirection: "column", gap: 4 }}>
        {candidatos.map((c: any) => (
          <div key={c.id} style={{
            padding: "10px 12px", background: t.card2,
            border: `1px solid ${t.border1}`, borderLeft: `3px solid ${t.accent}`,
            display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center",
          }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ color: t.textPrimary, fontSize: 11, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {c.cliente}
              </div>
              <div style={{ color: t.textTertiary, fontSize: 8, letterSpacing: "0.14em", textTransform: "uppercase", marginTop: 2 }}>
                #{c.numero || "s/nº"} · {c.status}
              </div>
            </div>
            <button
              onClick={() => onImportar(c.id)}
              disabled={importing === c.id}
              style={{
                padding: "6px 10px", background: t.accent, color: "#050505",
                border: "none", cursor: importing === c.id ? "wait" : "pointer",
                fontFamily: fonts.inter, fontSize: 8, letterSpacing: "0.20em", textTransform: "uppercase",
                opacity: importing === c.id ? 0.5 : 1,
              }}
            >{importing === c.id ? "…" : "importar"}</button>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   CalendarioView — timeline horizontal por projeto, mostra faixa
   entre inicio_dia e termino_dia do cronograma_obras vinculado.
   ═══════════════════════════════════════════════════════════════════ */

function CalendarioView({ byColumn }: { byColumn: Record<string, Projeto[]> }) {
  const t = useTokens();
  const navigate = useNavigate();
  const { cronoByProjeto } = useCronoByProjeto(byColumn);

  const parseISO = (s: string | null | undefined): Date | null => {
    if (!s) return null;
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
    if (!m) return null;
    return new Date(+m[1], +m[2] - 1, +m[3]);
  };
  const fmtBR = (d: Date | null) => d
    ? `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`
    : "—";
  const fmtMes = (d: Date) => d.toLocaleDateString("pt-BR", { month: "short", year: "2-digit" }).toUpperCase();
  const dayMs = 86400000;

  const rows = useMemo(() => {
    const all: Projeto[] = Object.values(byColumn).flat();
    const arr = all.map((p) => {
      const r = cronoByProjeto.get(p.id);
      const inicio = parseISO(r?.inicio_dia || null);
      const termino = parseISO(r?.termino_dia || null);
      return { p, inicio, termino, servico: r?.servico || "", fiscal: r?.fiscal || "" };
    }).filter(x => x.inicio || x.termino);
    arr.sort((a, b) => (a.inicio?.getTime() || Infinity) - (b.inicio?.getTime() || Infinity));
    return arr;
  }, [byColumn, cronoByProjeto]);

  const { minD, totalDays, months } = useMemo(() => {
    if (rows.length === 0) {
      const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
      return { minD: hoje, totalDays: 60, months: [] as { start: Date; days: number }[] };
    }
    let mn = Infinity, mx = -Infinity;
    for (const r of rows) {
      const i = r.inicio?.getTime() ?? r.termino!.getTime();
      const f = r.termino?.getTime() ?? r.inicio!.getTime();
      if (i < mn) mn = i;
      if (f > mx) mx = f;
    }
    const minDate = new Date(mn); minDate.setDate(1); minDate.setHours(0, 0, 0, 0);
    const maxDate = new Date(mx);
    maxDate.setMonth(maxDate.getMonth() + 1); maxDate.setDate(0); maxDate.setHours(0, 0, 0, 0);
    const total = Math.round((maxDate.getTime() - minDate.getTime()) / dayMs) + 1;
    const ms: { start: Date; days: number }[] = [];
    const cursor = new Date(minDate);
    while (cursor <= maxDate) {
      const startOfMonth = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
      const endOfMonth = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0);
      const s = startOfMonth < minDate ? minDate : startOfMonth;
      const e = endOfMonth > maxDate ? maxDate : endOfMonth;
      const d = Math.round((e.getTime() - s.getTime()) / dayMs) + 1;
      ms.push({ start: startOfMonth, days: d });
      cursor.setMonth(cursor.getMonth() + 1);
    }
    return { minD: minDate, totalDays: total, months: ms };
  }, [rows]);

  const PX_PER_DAY = 22;
  const NAME_COL = 240;
  const timelineWidth = totalDays * PX_PER_DAY;
  const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
  const hojeOffset = Math.round((hoje.getTime() - minD.getTime()) / dayMs);

  const posFor = (d: Date) => Math.round((d.getTime() - minD.getTime()) / dayMs) * PX_PER_DAY;
  const widthFor = (a: Date, b: Date) => Math.max(PX_PER_DAY / 2, (Math.round((b.getTime() - a.getTime()) / dayMs) + 1) * PX_PER_DAY);

  return (
    <div style={{ height: "100%", overflow: "auto", padding: "16px 20px" }}>
      {rows.length === 0 ? (
        <div style={{
          padding: 40, textAlign: "center", fontFamily: fonts.cinzel, fontSize: 10,
          letterSpacing: "0.24em", textTransform: "uppercase", color: t.textTertiary,
        }}>
          Nenhum projeto com data no cronograma
        </div>
      ) : (
        <div style={{ display: "inline-block", minWidth: "100%" }}>
          <div style={{ display: "flex", position: "sticky", top: 0, background: t.card1, zIndex: 2 }}>
            <div style={{
              width: NAME_COL, flexShrink: 0, padding: "10px 12px",
              borderBottom: `1px solid ${t.border1}`, borderRight: `1px solid ${t.border1}`,
              fontFamily: fonts.inter, fontSize: 9, letterSpacing: "0.20em",
              textTransform: "uppercase", color: t.textTertiary,
            }}>Projeto</div>
            <div style={{ display: "flex", position: "relative", width: timelineWidth }}>
              {months.map((m, i) => (
                <div key={i} style={{
                  width: m.days * PX_PER_DAY, borderBottom: `1px solid ${t.border1}`,
                  borderRight: `1px solid ${t.border1}`, padding: "10px 8px",
                  fontFamily: fonts.inter, fontSize: 9, letterSpacing: "0.18em",
                  textTransform: "uppercase", color: t.textSecondary, boxSizing: "border-box",
                }}>{fmtMes(m.start)}</div>
              ))}
            </div>
          </div>
          {rows.map(({ p, inicio, termino, servico, fiscal }) => {
            const a = inicio || termino!;
            const b = termino || inicio!;
            const left = posFor(a);
            const w = widthFor(a, b);
            return (
              <div key={p.id} style={{
                display: "flex", borderBottom: `1px solid ${t.border1}`, minHeight: 36,
                cursor: "pointer",
              }}
                onClick={() => navigate(`/projetos/${p.id}`)}
              >
                <div style={{
                  width: NAME_COL, flexShrink: 0, padding: "8px 12px",
                  borderRight: `1px solid ${t.border1}`,
                  fontFamily: fonts.cinzel, fontSize: 10, letterSpacing: "0.08em",
                  color: t.textPrimary, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                }} title={`${p.cliente}\n${servico}${fiscal ? " · " + fiscal : ""}`}>
                  {p.cliente.toUpperCase()}
                </div>
                <div style={{ position: "relative", width: timelineWidth, height: 36 }}>
                  {hojeOffset >= 0 && hojeOffset <= totalDays && (
                    <div style={{
                      position: "absolute", top: 0, bottom: 0,
                      left: hojeOffset * PX_PER_DAY, width: 2,
                      background: t.accent, opacity: 0.6, zIndex: 1,
                    }} />
                  )}
                  <div
                    title={`${fmtBR(inicio)} → ${fmtBR(termino)}${servico ? " · " + servico : ""}`}
                    style={{
                      position: "absolute", top: 8, height: 20,
                      left, width: w,
                      background: t.accent, opacity: 0.85,
                      border: `1px solid ${t.textPrimary}`,
                      display: "flex", alignItems: "center", padding: "0 8px",
                      overflow: "hidden", whiteSpace: "nowrap",
                      fontFamily: fonts.inter, fontSize: 9, letterSpacing: "0.08em",
                      color: "#050505",
                    }}>
                    {fmtBR(inicio)} → {fmtBR(termino)}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* CriarProjetoModal removido 02/09 (decisão Will): projeto novo nasce SÓ no
   Home Broker. Entrada de projeto no gestão = "+ Importar proposta" (espelho
   via /api/sync/from-proposta) ou o gatilho automático de proposta fechada. */
