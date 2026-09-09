import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import ForceGraph3D from "3d-force-graph";
import SpriteText from "three-spritetext";
import { T, fonts, setorColor, resolveColor, useTheme, useIsMobile } from "../theme";
import { api, Graph, Node, RowHit, TableRows } from "../api";

export default function Nucleo() {
  const mount = useRef<HTMLDivElement>(null);
  const graphRef = useRef<any>(null);
  const [data, setData] = useState<Graph | null>(null);
  const [selected, setSelected] = useState<Node | null>(null);
  const [related, setRelated] = useState<any[]>([]);
  const [relatedSemantic, setRelatedSemantic] = useState<any[]>([]);
  const [q, setQ] = useState("");
  const [searchHits, setSearchHits] = useState<any[]>([]);
  const [rowHits, setRowHits] = useState<RowHit[]>([]);
  const [showHits, setShowHits] = useState(false);
  const [tableRows, setTableRows] = useState<TableRows | null>(null);
  const [tableRowsLoading, setTableRowsLoading] = useState(false);
  const [rowQ, setRowQ] = useState("");
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const [rowDetail, setRowDetail] = useState<Record<string, any> | null>(null);
  const [dossier, setDossier] = useState<any | null>(null);
  const [dossierLoading, setDossierLoading] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();
  const [mode] = useTheme();
  const isMobile = useIsMobile();
  const [showLegend, setShowLegend] = useState(false);
  const [sheetCollapsed, setSheetCollapsed] = useState(false);

  useEffect(() => { api.graph().then(setData).catch(console.error); }, []);

  // expande a sheet automaticamente quando um novo nó é selecionado
  useEffect(() => { if (selected) setSheetCollapsed(false); }, [selected?.id]);

  // Ao mudar de nó, zera o painel de registros
  useEffect(() => {
    setTableRows(null);
    setRowQ("");
    setExpandedRow(null);
    setRowDetail(null);
    setDossier(null);
    setDossierLoading(false);
  }, [selected?.id]);

  // Se o nó é uma tabela, carrega os registros (com debounce quando muda a busca)
  useEffect(() => {
    if (!selected || selected.kind !== "table") return;
    setTableRowsLoading(true);
    const t = setTimeout(() => {
      api.tableRows(selected.id, rowQ.trim() || undefined, 50)
        .then(setTableRows)
        .catch((e) => setTableRows({
          schema: selected.schema || "", table: selected.title, pk: "id",
          title_col: null, columns: [], rows: [{ __error__: String(e) }],
        }))
        .finally(() => setTableRowsLoading(false));
    }, 220);
    return () => clearTimeout(t);
  }, [selected?.id, rowQ]);

  // Carrega detalhe completo da linha expandida
  useEffect(() => {
    if (!expandedRow || !selected) { setRowDetail(null); return; }
    api.tableRow(selected.id, expandedRow)
      .then((r) => setRowDetail(r.row))
      .catch(() => setRowDetail(null));
  }, [expandedRow, selected?.id]);

  // Focus via URL ?focus=id
  useEffect(() => {
    const focus = searchParams.get("focus");
    if (!focus || !graphRef.current || !data) return;
    const gd = graphRef.current.graphData();
    const attempt = () => {
      const node: any = gd.nodes.find((x: any) => x.id === focus);
      if (!node) return false;
      if (typeof node.x !== "number") {
        setTimeout(attempt, 300);
        return true;
      }
      setSelected(node);
      api.node(focus).then((r) => {
        setRelated(r.related || []);
        setRelatedSemantic(r.related_semantic || []);
      }).catch(() => { setRelated([]); setRelatedSemantic([]); });
      const distRatio = 1 + 80 / Math.hypot(node.x || 1, node.y || 1, node.z || 1);
      graphRef.current.cameraPosition(
        { x: (node.x || 0) * distRatio, y: (node.y || 0) * distRatio, z: (node.z || 0) * distRatio },
        node, 1400,
      );
      setTimeout(() => {
        searchParams.delete("focus");
        setSearchParams(searchParams, { replace: true });
      }, 1600);
      return true;
    };
    setTimeout(attempt, 400);
  }, [searchParams, data]);

  const gData = useMemo(() => {
    if (!data) return { nodes: [], links: [] };
    const fallback = resolveColor("textSecondary");
    const nodes = data.nodes.map((n) => ({
      ...n,
      color: setorColor[n.setor] || fallback,
      val: Math.max(1, Math.log10(Math.max(1, n.rows || 1))) + (n.kind === "table" ? 1 : 0.5),
    }));
    const links = data.edges.map((e) => ({ source: e.src, target: e.dst, kind: e.kind }));
    return { nodes, links };
  }, [data, mode]);

  // Aplica tema no 3D quando muda
  useEffect(() => {
    if (!graphRef.current) return;
    const bg = resolveColor("bg");
    const walnut = resolveColor("walnut");
    const border = resolveColor("border");
    graphRef.current.backgroundColor(bg);
    graphRef.current.linkDirectionalParticleColor(() => walnut);
    // força re-render dos sprites e labels no novo tema
    graphRef.current.linkColor((l: any) =>
      l.kind === "wikilink"
        ? (mode === "light" ? "rgba(139,111,71,0.55)" : "rgba(199,164,91,0.35)")
        : l.kind === "semantic"
        ? (mode === "light" ? "rgba(90,84,74,0.30)" : "rgba(139,111,71,0.20)")
        : (mode === "light" ? "rgba(30,25,20,0.18)" : "rgba(216,211,199,0.10)"),
    );
    graphRef.current.refresh?.();
  }, [mode]);

  useEffect(() => {
    if (!mount.current || !data) return;
    if (graphRef.current) return;

    const bg = resolveColor("bg");
    const walnut = resolveColor("walnut");
    const spriteBgDark  = "rgba(5,5,5,0.55)";
    const spriteBgLight = "rgba(245,242,234,0.75)";

    const g = ForceGraph3D()(mount.current)
      .backgroundColor(bg)
      .nodeThreeObject((node: any) => {
        const prefix = node.kind === "note" ? "◇ " : node.kind === "memory" || node.kind === "doc" ? "▸ " : "";
        const s = new SpriteText(prefix + node.title);
        s.color        = node.color;
        s.textHeight   = 3 + Math.min(4, (node.val || 1));
        s.fontFace     = node.kind === "table" ? "Inter" : "Cinzel";
        s.fontWeight   = node.kind === "note" ? "600" : "400";
        s.backgroundColor = document.documentElement.getAttribute("data-theme") === "light" ? spriteBgLight : spriteBgDark;
        s.padding      = 1;
        s.borderRadius = 0;
        return s;
      })
      .nodeLabel((n: any) => {
        const p = resolveColor("textPrimary");
        const b = resolveColor("bg");
        const brd = resolveColor("border");
        const mut = resolveColor("textMuted");
        return `<div style="font-family:${fonts.inter}; color:${p}; background:${b}; padding:6px 10px; border:1px solid ${brd}; font-size:11px; letter-spacing:0.14em"><b style="letter-spacing:0.20em">${n.title}</b><br/><span style="color:${mut}; font-size:9px">${n.kind} · ${n.schema || n.setor} · ${n.rows ?? "-"} rows</span></div>`;
      })
      .linkColor((l: any) => l.kind === "wikilink" ? "rgba(199,164,91,0.35)" : l.kind === "semantic" ? "rgba(139,111,71,0.20)" : "rgba(216,211,199,0.10)")
      .linkOpacity(0.5)
      .linkDirectionalParticles((l: any) => l.kind === "wikilink" ? 2 : 0)
      .linkDirectionalParticleSpeed(0.004)
      .linkDirectionalParticleColor(() => walnut)
      .onNodeClick((n: any) => {
        setSelected(n);
        api.node(n.id).then(r => {
          setRelated(r.related || []);
          setRelatedSemantic(r.related_semantic || []);
        }).catch(() => { setRelated([]); setRelatedSemantic([]); });
        const dist = 80;
        const distRatio = 1 + dist / Math.hypot(n.x, n.y, n.z);
        g.cameraPosition({ x: n.x * distRatio, y: n.y * distRatio, z: n.z * distRatio }, n, 1200);
      });

    g.graphData(gData);
    g.d3Force("charge")?.strength(-70);
    g.d3Force("link")?.distance(30);

    // OrbitControls (Three.js) — habilita touch: 1 dedo rotaciona, 2 dedos zoom/pan
    try {
      const controls: any = g.controls?.();
      if (controls) {
        // TOUCH constants: ROTATE=0, DOLLY_PAN=2 (do THREE)
        controls.touches = { ONE: 0, TWO: 2 };
        controls.enableRotate = true;
        controls.enableZoom = true;
        controls.enablePan = true;
        controls.rotateSpeed = 0.9;
        controls.zoomSpeed = 1.2;
        controls.enableDamping = true;
        controls.dampingFactor = 0.12;
      }
    } catch { /* noop */ }

    graphRef.current = g;
  }, [data]);

  useEffect(() => {
    if (graphRef.current && data) graphRef.current.graphData(gData);
  }, [gData, data]);

  // Re-mede o canvas quando muda de layout mobile/desktop ou tela redimensiona
  useEffect(() => {
    const g = graphRef.current;
    if (!g || !mount.current) return;
    const ro = new ResizeObserver(() => {
      g.width?.(mount.current!.clientWidth);
      g.height?.(mount.current!.clientHeight);
    });
    ro.observe(mount.current);
    return () => ro.disconnect();
  }, [isMobile]);

  function focusNode(id: string | null) {
    if (!id) return;
    setShowHits(false);
    const node: any = graphRef.current?.graphData().nodes.find((x: any) => x.id === id);
    if (!node) return;
    setSelected(node);
    api.node(id).then(r => {
      setRelated(r.related || []);
      setRelatedSemantic(r.related_semantic || []);
    }).catch(() => { setRelated([]); setRelatedSemantic([]); });
    const distRatio = 1 + 80 / Math.hypot(node.x || 1, node.y || 1, node.z || 1);
    graphRef.current?.cameraPosition(
      { x: (node.x || 0) * distRatio, y: (node.y || 0) * distRatio, z: (node.z || 0) * distRatio },
      node, 1400,
    );
  }

  function doSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!q.trim()) return;
    // Prioridade: 1) registro por nome, 2) node semântico, 3) fallback textual
    if (rowHits.length > 0) {
      openRowHit(rowHits[0]);
      return;
    }
    if (searchHits.length > 0) {
      focusNode(searchHits[0].id);
      return;
    }
    if (!data) return;
    const term = q.trim().toLowerCase();
    const hit = data.nodes.find(n =>
      n.title.toLowerCase().includes(term) || n.id.toLowerCase().includes(term)
    );
    if (hit) focusNode(hit.id);
  }

  // Busca semântica (nodes) + busca textual em registros (tabelas-entidade),
  // com debounce 220ms
  useEffect(() => {
    if (!q.trim() || q.trim().length < 2) {
      setSearchHits([]); setRowHits([]); setShowHits(false); return;
    }
    const t = setTimeout(() => {
      Promise.all([
        api.search(q.trim()).catch(() => ({ hits: [] as any[] })),
        api.searchRows(q.trim()).catch(() => ({ hits: [] as RowHit[] })),
      ]).then(([s, r]) => {
        setSearchHits(s.hits || []);
        setRowHits(r.hits || []);
        setShowHits(true);
      });
    }, 220);
    return () => clearTimeout(t);
  }, [q]);

  function openRowHit(h: RowHit) {
    setShowHits(false);
    setQ("");
    // Foca no nó-tabela e já pré-seleciona a linha
    const node: any = graphRef.current?.graphData().nodes.find((x: any) => x.id === h.table_id);
    if (node) {
      setSelected(node);
      api.node(node.id).then((r) => {
        setRelated(r.related || []);
        setRelatedSemantic(r.related_semantic || []);
      }).catch(() => { setRelated([]); setRelatedSemantic([]); });
      const distRatio = 1 + 80 / Math.hypot(node.x || 1, node.y || 1, node.z || 1);
      graphRef.current?.cameraPosition(
        { x: (node.x || 0) * distRatio, y: (node.y || 0) * distRatio, z: (node.z || 0) * distRatio },
        node, 1400,
      );
    }
    // Deixa o effect de tableRows disparar (com rowQ preenchido)
    setRowQ(h.title);
    setExpandedRow(h.id);

    // Se a busca caiu num "cliente/pessoa" (simulacao_projetos, kanban_cards,
    // user_profiles, colaboradores), busca o dossiê agregado
    const pessoaTables = new Set([
      "table:public.simulacao_projetos",
      "table:public.kanban_cards",
      "table:public.user_profiles",
      "table:rh.colaboradores",
    ]);
    if (pessoaTables.has(h.table_id)) {
      setDossierLoading(true);
      setDossier(null);
      api.clientDossier(h.title)
        .then(setDossier)
        .catch(() => setDossier(null))
        .finally(() => setDossierLoading(false));
    } else {
      setDossier(null);
    }
  }

  const asideStyle: React.CSSProperties = isMobile
    ? {
        position: "absolute", left: 0, right: 0, bottom: 0,
        maxHeight: sheetCollapsed ? 78 : "62%", overflowY: "auto",
        background: T.cardBg, backdropFilter: "blur(10px)",
        borderTop: `1px solid ${T.borderHover}`,
        padding: "10px 18px 20px",
        transition: "max-height 0.22s ease-out",
      }
    : {
        position: "absolute", top: 0, right: 0, bottom: 0, width: 380,
        background: T.cardBg, backdropFilter: "blur(8px)",
        borderLeft: `1px solid ${T.borderHover}`,
        padding: "32px 28px", overflowY: "auto",
      };

  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
      <div
        ref={mount}
        style={{
          width: "100%",
          height: "100%",
          touchAction: "none",       // deixa o OrbitControls capturar gestos
          WebkitUserSelect: "none",
          userSelect: "none",
        }}
      />

      {/* Header sobre o grafo */}
      <div style={{
        position: "absolute", top: 16, left: 16, right: 16,
        display: "flex", alignItems: "center", gap: 12,
        flexWrap: "wrap", pointerEvents: "none",
      }}>
        <div style={{ pointerEvents: "auto" }}>
          <div style={{ fontFamily: fonts.cinzel, fontSize: 12, letterSpacing: "0.22em", color: T.textPrimary }}>
            NÚCLEO
          </div>
          <div style={{ fontFamily: fonts.inter, fontSize: 9, letterSpacing: "0.20em", color: T.textMuted, textTransform: "uppercase", marginTop: 3 }}>
            {data ? `${data.stats.tables} entidades · ${data.stats.fks} conexões` : "carregando…"}
          </div>
        </div>
        <div style={{ flex: 1 }} />
        <form onSubmit={doSearch} style={{
          pointerEvents: "auto",
          flex: isMobile ? "1 0 100%" : undefined,
          position: "relative",
        }}>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onFocus={() => setShowHits(searchHits.length + rowHits.length > 0)}
            onBlur={() => setTimeout(() => setShowHits(false), 180)}
            placeholder={isMobile ? "BUSCAR…" : "BUSCAR NÓ OU NOME…"}
            style={{
              width: isMobile ? "100%" : 300,
              padding: "10px 14px",
              background: T.inputBg, border: `1px solid ${T.border}`,
              color: T.textPrimary, outline: "none",
              fontFamily: fonts.inter, fontSize: 11, letterSpacing: "0.20em",
              textTransform: "uppercase",
            }}
          />
          {showHits && (searchHits.length + rowHits.length) > 0 && (
            <div style={{
              position: "absolute", top: "100%", left: 0, right: 0, marginTop: 4,
              background: T.cardBg, backdropFilter: "blur(8px)",
              border: `1px solid ${T.borderHover}`, maxHeight: 420, overflowY: "auto", zIndex: 5,
            }}>
              {rowHits.length > 0 && (
                <div style={{
                  padding: "6px 14px", fontFamily: fonts.cinzel, fontSize: 8,
                  letterSpacing: "0.22em", color: T.textMuted,
                  borderBottom: `1px solid ${T.border}`,
                }}>REGISTROS</div>
              )}
              {rowHits.slice(0, 10).map((h) => (
                <button
                  key={`${h.table_id}:${h.id}`}
                  onMouseDown={(e) => { e.preventDefault(); openRowHit(h); }}
                  style={{
                    display: "block", width: "100%", textAlign: "left",
                    background: "transparent", border: "none",
                    borderBottom: `1px solid ${T.border}`,
                    padding: "10px 14px", cursor: "pointer",
                    color: T.textPrimary, fontFamily: fonts.inter, fontSize: 11,
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                    <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{h.title}</span>
                    <span style={{
                      fontSize: 8, letterSpacing: "0.14em", textTransform: "uppercase",
                      color: "var(--walnut)", whiteSpace: "nowrap",
                    }}>{h.schema}.{h.table}</span>
                  </div>
                  {h.sub && (
                    <div style={{ color: T.textMuted, fontSize: 9, letterSpacing: "0.06em", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {h.sub}
                    </div>
                  )}
                </button>
              ))}
              {searchHits.length > 0 && (
                <div style={{
                  padding: "6px 14px", fontFamily: fonts.cinzel, fontSize: 8,
                  letterSpacing: "0.22em", color: T.textMuted,
                  borderBottom: `1px solid ${T.border}`,
                  borderTop: rowHits.length > 0 ? `1px solid ${T.border}` : undefined,
                }}>ENTIDADES</div>
              )}
              {searchHits.slice(0, 8).map((h: any) => (
                <button
                  key={h.id}
                  onMouseDown={(e) => { e.preventDefault(); focusNode(h.id); setQ(""); }}
                  style={{
                    display: "block", width: "100%", textAlign: "left",
                    background: "transparent", border: "none",
                    borderBottom: `1px solid ${T.border}`,
                    padding: "10px 14px", cursor: "pointer",
                    color: T.textPrimary, fontFamily: fonts.inter, fontSize: 11,
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                    <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{h.title}</span>
                    <span style={{
                      fontSize: 8, letterSpacing: "0.14em", textTransform: "uppercase",
                      color: setorColor[h.setor] || "var(--textMuted)", whiteSpace: "nowrap",
                    }}>{h.kind} · {h.setor}</span>
                  </div>
                  <div style={{ color: T.textMuted, fontSize: 9, letterSpacing: "0.10em", marginTop: 2 }}>
                    score {typeof h.score === "number" ? h.score.toFixed(2) : "–"}
                  </div>
                </button>
              ))}
            </div>
          )}
        </form>
        {isMobile && data && (
          <button
            onClick={() => setShowLegend((v) => !v)}
            style={{
              pointerEvents: "auto",
              background: T.cardBg, border: `1px solid ${T.border}`,
              color: T.textSecondary, padding: "6px 10px", cursor: "pointer",
              fontFamily: fonts.inter, fontSize: 9, letterSpacing: "0.18em",
              textTransform: "uppercase",
            }}
          >{showLegend ? "Ocultar setores" : "Mostrar setores"}</button>
        )}
      </div>

      {/* Legenda setores */}
      {data && (!isMobile || showLegend) && (
        <div style={{
          position: "absolute",
          bottom: isMobile ? "auto" : 24,
          top: isMobile ? 96 : "auto",
          left: 16,
          right: isMobile ? 16 : "auto",
          background: T.cardBg, border: `1px solid ${T.border}`,
          padding: 14, maxWidth: isMobile ? "none" : 240,
          zIndex: 2,
        }}>
          <div style={{ fontFamily: fonts.cinzel, fontSize: 10, letterSpacing: "0.22em", color: T.textPrimary, marginBottom: 10 }}>
            SETORES
          </div>
          <div style={{
            display: "grid",
            gridTemplateColumns: isMobile ? "repeat(auto-fill, minmax(120px, 1fr))" : "1fr 1fr",
            gap: 6,
          }}>
            {Object.entries(data.stats.setores).sort((a,b)=>b[1]-a[1]).map(([s, n]) => (
              <div key={s} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ width: 8, height: 8, background: setorColor[s] || "var(--textSecondary)", display: "inline-block" }} />
                <span style={{ fontFamily: fonts.inter, fontSize: 9, letterSpacing: "0.10em", color: T.textSecondary, textTransform: "uppercase" }}>
                  {s} <span style={{ color: T.textMuted }}>({n})</span>
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Painel do nó selecionado */}
      {selected && (
        <aside style={asideStyle}>
          {isMobile && (
            <button
              onClick={() => setSheetCollapsed((v) => !v)}
              aria-label={sheetCollapsed ? "Expandir" : "Recolher"}
              style={{
                display: "block", margin: "0 auto 6px",
                width: 44, height: 5, borderRadius: 3,
                background: T.borderHover, border: "none", padding: 0,
                cursor: "pointer",
              }}
            />
          )}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div style={{ flex: 1, minWidth: 0 }} onClick={isMobile ? () => setSheetCollapsed(false) : undefined}>
              <div style={{ fontFamily: fonts.inter, fontSize: 8, letterSpacing: "0.24em", color: T.textMuted, textTransform: "uppercase" }}>
                {selected.kind} · {selected.schema || ""}
              </div>
              <div style={{
                fontFamily: fonts.cinzel,
                fontSize: isMobile ? 14 : 20,
                letterSpacing: "0.10em", color: T.textPrimary,
                margin: isMobile ? "4px 0 10px" : "8px 0 16px",
                overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
              }}>
                {selected.title.toUpperCase()}
              </div>
            </div>
            {isMobile && (
              <button
                onClick={() => { setSelected(null); setSheetCollapsed(false); }}
                aria-label="Fechar"
                style={{
                  background: "transparent", border: "none", color: T.textMuted,
                  cursor: "pointer", fontSize: 22, padding: 0, lineHeight: 1, marginLeft: 8,
                }}
              >×</button>
            )}
          </div>
          {isMobile && sheetCollapsed && (
            <div style={{
              fontFamily: fonts.inter, fontSize: 9, color: T.textMuted,
              letterSpacing: "0.14em", textTransform: "uppercase", textAlign: "center", marginTop: 2,
            }}>toque pra expandir · arraste o núcleo</div>
          )}
          <div style={{ display: "flex", gap: 6, marginBottom: 20, flexWrap: "wrap" }}>
            <span style={{
              background: setorColor[selected.setor] || "var(--walnut)", color: "var(--bg)",
              padding: "2px 6px", fontFamily: fonts.inter, fontSize: 8, letterSpacing: "0.08em",
              textTransform: "uppercase",
            }}>{selected.setor}</span>
            {selected.rows !== undefined && (
              <span style={{
                background: "transparent", border: `1px solid ${T.border}`, color: T.textSecondary,
                padding: "2px 6px", fontFamily: fonts.inter, fontSize: 8, letterSpacing: "0.08em",
              }}>{selected.rows.toLocaleString("pt-BR")} rows</span>
            )}
          </div>
          {selected.comment && (
            <div style={{ fontFamily: fonts.inter, fontSize: 12, letterSpacing: "0.02em", color: T.textSecondary, marginBottom: 20, lineHeight: 1.6 }}>
              {selected.comment}
            </div>
          )}
          {selected.kind === "table" && (
            <>
              <div style={{ fontFamily: fonts.cinzel, fontSize: 10, letterSpacing: "0.22em", color: T.textPrimary, marginTop: 20, marginBottom: 8 }}>
                REGISTROS{tableRows ? ` (${tableRows.rows.length}${tableRows.rows.length >= 50 ? "+" : ""})` : ""}
              </div>
              <input
                value={rowQ}
                onChange={(e) => setRowQ(e.target.value)}
                placeholder="filtrar por nome…"
                style={{
                  width: "100%", padding: "8px 10px", marginBottom: 8,
                  background: T.inputBg, border: `1px solid ${T.border}`,
                  color: T.textPrimary, outline: "none",
                  fontFamily: fonts.inter, fontSize: 11, letterSpacing: "0.10em",
                }}
              />
              <div style={{ display: "flex", flexDirection: "column", gap: 2, marginBottom: 20 }}>
                {tableRowsLoading && !tableRows && (
                  <div style={{ color: T.textMuted, fontFamily: fonts.inter, fontSize: 10, padding: 8 }}>
                    carregando…
                  </div>
                )}
                {tableRows && tableRows.rows.length === 0 && !tableRowsLoading && (
                  <div style={{ color: T.textMuted, fontFamily: fonts.inter, fontSize: 10, padding: 8 }}>
                    nenhum registro encontrado
                  </div>
                )}
                {tableRows?.rows.map((r, i) => {
                  const pkVal = String(r[tableRows.pk] ?? i);
                  const titleVal = tableRows.title_col ? r[tableRows.title_col] : null;
                  const isOpen = expandedRow === pkVal;
                  return (
                    <div key={pkVal}>
                      <button
                        onClick={() => setExpandedRow(isOpen ? null : pkVal)}
                        style={{
                          textAlign: "left", padding: "8px 10px", width: "100%",
                          background: isOpen ? T.cardBg : T.statBg,
                          border: `1px solid ${isOpen ? "var(--borderHover)" : T.border}`,
                          color: T.textSecondary, cursor: "pointer",
                          fontFamily: fonts.inter, fontSize: 11,
                        }}
                      >
                        <div style={{ color: T.textPrimary, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {String(titleVal ?? pkVal)}
                        </div>
                        <div style={{ color: T.textMuted, fontSize: 8, letterSpacing: "0.14em", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {tableRows.pk}: {pkVal}
                        </div>
                      </button>
                      {isOpen && (
                        <div style={{
                          padding: "8px 10px", background: T.statBg,
                          border: `1px solid ${T.border}`, borderTop: "none",
                          fontFamily: fonts.inter, fontSize: 10, color: T.textSecondary,
                          maxHeight: 260, overflowY: "auto",
                        }}>
                          {rowDetail ? (
                            Object.entries(rowDetail).map(([k, v]) => (
                              <div key={k} style={{ display: "grid", gridTemplateColumns: "110px 1fr", gap: 8, padding: "3px 0", borderBottom: `1px dashed ${T.border}` }}>
                                <span style={{ color: T.textMuted, letterSpacing: "0.08em", textTransform: "uppercase", fontSize: 8, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{k}</span>
                                <span style={{ color: T.textPrimary, wordBreak: "break-word" }}>
                                  {v === null || v === undefined ? <em style={{ color: T.textMuted }}>—</em>
                                    : typeof v === "object" ? JSON.stringify(v)
                                    : String(v)}
                                </span>
                              </div>
                            ))
                          ) : (
                            <span style={{ color: T.textMuted }}>carregando detalhe…</span>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          )}
          {(dossierLoading || dossier) && (
            <div style={{ marginTop: 20 }}>
              <div style={{ fontFamily: fonts.cinzel, fontSize: 10, letterSpacing: "0.22em", color: T.textPrimary, marginBottom: 8 }}>
                FICHA · {(dossier?.nome_busca || rowQ || "").toUpperCase()}
              </div>
              {dossierLoading && !dossier && (
                <div style={{ color: T.textMuted, fontFamily: fonts.inter, fontSize: 10, padding: 8 }}>
                  agregando propostas, cards e whatsapp…
                </div>
              )}
              {dossier && (
                <>
                  <div style={{
                    display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(80px, 1fr))",
                    gap: 6, marginBottom: 12,
                  }}>
                    {(["propostas","cards","mensagens","colaboradores","notas"] as const).map((k) => (
                      <div key={k} style={{
                        padding: "6px 8px", background: T.statBg, border: `1px solid ${T.border}`,
                      }}>
                        <div style={{ fontFamily: fonts.cinzel, fontSize: 14, color: T.textPrimary }}>
                          {dossier.counts?.[k] ?? 0}
                        </div>
                        <div style={{ fontFamily: fonts.inter, fontSize: 8, color: T.textMuted, letterSpacing: "0.14em", textTransform: "uppercase" }}>
                          {k}
                        </div>
                      </div>
                    ))}
                  </div>

                  {dossier.propostas?.length > 0 && (
                    <DossierSection title="PROPOSTAS">
                      {dossier.propostas.slice(0, 6).map((p: any) => (
                        <DossierItem
                          key={p.id}
                          title={`${p.numero || "s/nº"} · ${p.status || ""}`}
                          sub={`${p.vendedor || "—"} · ${p.obra_code || p.obra_id || ""} · ${p.created_at ? new Date(p.created_at).toLocaleDateString("pt-BR") : ""}`}
                          href={`https://proposta.parket.works/proposta/${p.id}`}
                        />
                      ))}
                    </DossierSection>
                  )}

                  {dossier.cards?.length > 0 && (
                    <DossierSection title="CARDS KANBAN">
                      {dossier.cards.slice(0, 6).map((c: any) => (
                        <DossierItem
                          key={c.id}
                          title={c.title}
                          sub={`${c.dept_id} · ${c.responsavel} · SLA ${c.sla_status || "—"}`}
                        />
                      ))}
                    </DossierSection>
                  )}

                  {dossier.mensagens?.length > 0 && (
                    <DossierSection title="WHATSAPP (últimas)">
                      {dossier.mensagens.slice(0, 6).map((m: any, i: number) => (
                        <DossierItem
                          key={i}
                          title={`${m.direction === "in" ? "◀ " : "▶ "}${(m.message_text || "").slice(0, 80)}`}
                          sub={`${m.sender_name || m.phone} · ${m.instance || ""} · ${m.timestamp ? new Date(m.timestamp).toLocaleString("pt-BR") : ""}`}
                        />
                      ))}
                    </DossierSection>
                  )}

                  {dossier.colaboradores?.length > 0 && (
                    <DossierSection title="COLABORADORES">
                      {dossier.colaboradores.slice(0, 4).map((c: any) => (
                        <DossierItem
                          key={c.id}
                          title={c.nome}
                          sub={`${c.cargo || c.setor || ""} · ${c.email_profissional || c.telefone || ""}`}
                        />
                      ))}
                    </DossierSection>
                  )}

                  {dossier.notas?.length > 0 && (
                    <DossierSection title="NOTAS TECA">
                      {dossier.notas.slice(0, 5).map((n: any) => (
                        <DossierItem key={n.slug} title={n.titulo} sub={n.slug} />
                      ))}
                    </DossierSection>
                  )}
                </>
              )}
            </div>
          )}

          <div style={{ fontFamily: fonts.cinzel, fontSize: 10, letterSpacing: "0.22em", color: T.textPrimary, marginTop: 20, marginBottom: 12 }}>
            CONEXÕES ({related.length})
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            {related.map((r, i) => (
              <button
                key={i}
                onClick={() => {
                  const node: any = graphRef.current?.graphData().nodes.find((x: any) => x.id === r.other_id);
                  if (node) {
                    setSelected(node);
                    api.node(node.id).then(x => {
                      setRelated(x.related || []);
                      setRelatedSemantic(x.related_semantic || []);
                    }).catch(() => { setRelated([]); setRelatedSemantic([]); });
                    const distRatio = 1 + 80 / Math.hypot(node.x || 1, node.y || 1, node.z || 1);
                    graphRef.current.cameraPosition(
                      { x: (node.x || 0) * distRatio, y: (node.y || 0) * distRatio, z: (node.z || 0) * distRatio },
                      node, 1400,
                    );
                  }
                }}
                style={{
                  textAlign: "left", padding: "10px 12px",
                  background: T.statBg, border: `1px solid ${T.border}`,
                  color: T.textSecondary, cursor: "pointer",
                  fontFamily: fonts.inter, fontSize: 11,
                }}
                onMouseEnter={(e) => (e.currentTarget.style.borderColor = "var(--borderHover)")}
                onMouseLeave={(e) => (e.currentTarget.style.borderColor = "var(--border)")}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                  <span style={{ color: T.textPrimary, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.other_title}</span>
                  <span style={{
                    fontSize: 8, letterSpacing: "0.14em", textTransform: "uppercase",
                    color: setorColor[r.other_setor] || "var(--textMuted)", whiteSpace: "nowrap",
                  }}>{r.kind} · {r.other_setor}</span>
                </div>
              </button>
            ))}
          </div>
          {/* Próximos semânticos (embedding cosine) — só mostra se tiver algo relevante */}
          {relatedSemantic.length > 0 && (
            <>
              <div style={{ fontFamily: fonts.cinzel, fontSize: 10, letterSpacing: "0.22em", color: T.textPrimary, marginTop: 20, marginBottom: 8 }}>
                PRÓXIMOS · SEMÂNTICO
              </div>
              <div style={{ fontFamily: fonts.inter, fontSize: 8, color: T.textMuted, letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: 10 }}>
                sem edge, mas por similaridade
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                {relatedSemantic.map((r, i) => (
                  <button
                    key={i}
                    onClick={() => focusNode(r.other_id)}
                    style={{
                      textAlign: "left", padding: "8px 12px",
                      background: T.statBg, border: `1px dashed ${T.border}`,
                      color: T.textSecondary, cursor: "pointer",
                      fontFamily: fonts.inter, fontSize: 11,
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                      <span style={{ color: T.textPrimary, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {r.other_title}
                      </span>
                      <span style={{
                        fontSize: 8, letterSpacing: "0.14em", textTransform: "uppercase",
                        color: setorColor[r.other_setor] || "var(--textMuted)", whiteSpace: "nowrap",
                      }}>
                        {r.other_kind} · {r.score}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            </>
          )}

          {!isMobile && (
            <button
              onClick={() => setSelected(null)}
              style={{
                marginTop: 24, width: "100%", padding: 12,
                background: "transparent", border: `1px solid ${T.border}`,
                color: T.textSecondary, cursor: "pointer",
                fontFamily: fonts.inter, fontSize: 10, letterSpacing: "0.20em",
                textTransform: "uppercase",
              }}
            >Fechar</button>
          )}
        </aside>
      )}
    </div>
  );
}

function DossierSection({ title, children }: { title: string; children: any }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{
        fontFamily: fonts.inter, fontSize: 8, letterSpacing: "0.22em",
        color: "var(--textMuted)", textTransform: "uppercase",
        borderBottom: `1px solid ${T.border}`, paddingBottom: 4, marginBottom: 6,
      }}>{title}</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>{children}</div>
    </div>
  );
}

function DossierItem({ title, sub, href }: { title: string; sub?: string; href?: string }) {
  const style: React.CSSProperties = {
    display: "block", textDecoration: "none",
    padding: "6px 10px", background: T.statBg, border: `1px solid ${T.border}`,
    color: T.textPrimary, fontFamily: fonts.inter, fontSize: 11,
  };
  const content = (
    <>
      <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{title}</div>
      {sub && (
        <div style={{
          color: T.textMuted, fontSize: 9, letterSpacing: "0.08em",
          marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
        }}>{sub}</div>
      )}
    </>
  );
  return href ? (
    <a href={href} target="_blank" rel="noopener noreferrer" style={style}>{content}</a>
  ) : (
    <div style={style}>{content}</div>
  );
}
