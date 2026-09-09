// mao-de-obra-modal-pkt1.js
// ────────────────────────────────────────────────────────────────────
// Modal standalone — Mão de Obra (Instalação) por ITEM do simulador
// de orçamento (cada linha do simulacao_itens). Lê o m² do descritivo
// do item, lista catálogo de orcamento_instalacao_precos filtrado pela
// categoria do item, salva em simulacao_itens.meta.mao_de_obra.
//
// Expõe `window.__pkt_openMaoDeObra(item, onSavedCb?)`.
// ────────────────────────────────────────────────────────────────────
import { r as React, s as supabase, j as _jrt } from "./index-DZtetJYP.js";

// `_jrt` é o namespace jsx-runtime (Et={jsx, jsxs, Fragment, ...}) — a
// convenção dos chunks da Parket é `e.jsx`/`e.jsxs`. Pra manter o código
// compacto eu uso aliases locais. NÃO chamar `_jrt(...)` direto — ele é
// objeto, não função.
const h = _jrt.jsx;
const hs = _jrt.jsxs;
const u = React;

function _parseM2(text) {
  if (!text) return 0;
  const m = String(text).match(/(\d{1,5}(?:[.,]\d{1,3})?)\s*m[²2]/i);
  if (!m) return 0;
  return parseFloat(m[1].replace(",", "."));
}

function _normCat(c) {
  return String(c || "").split("||")[0].trim().toUpperCase();
}

function _fmt(v) {
  return (Number(v) || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

const COLORS = {
  bg: "rgba(0,0,0,0.7)",
  card: "#0e0e0e",
  border: "rgba(255,255,255,0.1)",
  text: "#eaeaea",
  dim: "#888",
  accent: "#14B8A6",
  rowAlt: "rgba(255,255,255,0.03)",
  highlight: "rgba(20,184,166,0.06)",
};

const CAT_COLORS = {
  PISO: "#fbbf24",
  FORRO: "#34d399",
  DECK: "#fb923c",
  PAINEL: "#a78bfa",
  ACABAMENTO: "#60a5fa",
  REMOÇÃO: "#f87171",
};

function MaoDeObraModal(props) {
  const { item, onClose, onSaved } = props;
  const itemCat = _normCat(item && item.categoria);
  const itemM2 = _parseM2(item && item.descritivo);

  const [precos, setPrecos] = u.useState([]);
  const [entries, setEntries] = u.useState({}); // precoId -> {qtd, valor_unit}
  const [loading, setLoading] = u.useState(true);
  const [saving, setSaving] = u.useState(false);
  const [filter, setFilter] = u.useState("");
  const [showAllCats, setShowAllCats] = u.useState(false);
  const [initialized, setInitialized] = u.useState(false);

  // Carrega catálogo + entries existentes do meta
  u.useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const { data: ps } = await supabase
          .from("orcamento_instalacao_precos")
          .select("*")
          .eq("ativo", true)
          .order("categoria", { ascending: true })
          .order("ordem", { ascending: true });
        if (!alive) return;
        const precosList = ps || [];
        setPrecos(precosList);

        const existing = (item && item.meta && item.meta.mao_de_obra) || [];
        const entriesMap = {};
        for (const e of existing) {
          if (e && e.preco_id) {
            entriesMap[e.preco_id] = {
              qtd: Number(e.qtd) || 0,
              valor_unit: Number(e.valor_unit) || 0,
            };
          }
        }
        setEntries(entriesMap);
        setLoading(false);
        setInitialized(true);
      } catch (err) {
        console.error("[MaoDeObraModal] load error:", err);
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [item && item.id]);

  // Auto-prefill qty = item m² para serviços da mesma categoria, primeira vez
  u.useEffect(() => {
    if (!initialized || loading || precos.length === 0) return;
    if (!itemM2 || itemM2 <= 0) return;
    const newEntries = { ...entries };
    let touched = false;
    for (const p of precos) {
      if (newEntries[p.id] !== undefined) continue; // já tem (salvo)
      if (p.unidade !== "m²") continue;
      const sameCat = (p.categoria === itemCat);
      // Pré-preenche os serviços da categoria do item (ex: PISO → PISO RETO etc)
      if (sameCat) {
        newEntries[p.id] = { qtd: itemM2, valor_unit: Number(p.valor_unitario) || 0 };
        touched = true;
      }
    }
    if (touched) setEntries(newEntries);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialized]);

  const setEntry = (precoId, field, value) => {
    setEntries(prev => ({
      ...prev,
      [precoId]: { ...(prev[precoId] || { qtd: 0, valor_unit: 0 }), [field]: value },
    }));
  };

  const calcRowTotal = (precoId) => {
    const e = entries[precoId];
    if (!e) return 0;
    return (Number(e.qtd) || 0) * (Number(e.valor_unit) || 0);
  };

  const calcTotalGeral = () => {
    let t = 0;
    for (const id in entries) t += calcRowTotal(id);
    return t;
  };

  const save = async () => {
    if (saving) return;
    setSaving(true);
    try {
      const items = [];
      for (const p of precos) {
        const e = entries[p.id];
        if (!e) continue;
        const qtd = Number(e.qtd) || 0;
        if (qtd <= 0) continue;
        const valor_unit = Number(e.valor_unit) || Number(p.valor_unitario) || 0;
        items.push({
          preco_id: p.id,
          categoria: p.categoria,
          servico: p.servico,
          unidade: p.unidade,
          qtd: qtd,
          valor_unit: valor_unit,
          total: qtd * valor_unit,
        });
      }
      const total = items.reduce((s, it) => s + it.total, 0);
      const currentMeta = (item && item.meta) || {};
      const newMeta = {
        ...currentMeta,
        mao_de_obra: items,
        mao_de_obra_total: total,
        mao_de_obra_updated_at: new Date().toISOString(),
      };
      const { error } = await supabase
        .from("simulacao_itens")
        .update({ meta: newMeta })
        .eq("id", item.id);
      if (error) throw error;
      if (typeof onSaved === "function") {
        try { onSaved({ items: items, total: total, meta: newMeta }); } catch (_e) {}
      }
      setSaving(false);
      onClose();
    } catch (err) {
      console.error("[MaoDeObraModal] save error:", err);
      alert("Erro ao salvar: " + (err.message || err));
      setSaving(false);
    }
  };

  // ─── Geração de PDF (mesmo estilo do "📋 Insumos" — iframe + window.print) ───
  const buildPrintHtml = () => {
    const rows = [];
    let totalGeral = 0;
    // Agrupa entradas (qtd > 0) por categoria
    const byCat = {};
    for (const p of precos) {
      const e = entries[p.id];
      if (!e) continue;
      const qtd = Number(e.qtd) || 0;
      if (qtd <= 0) continue;
      const valor_unit = Number(e.valor_unit) || Number(p.valor_unitario) || 0;
      const tot = qtd * valor_unit;
      totalGeral += tot;
      byCat[p.categoria] = byCat[p.categoria] || [];
      byCat[p.categoria].push({ servico: p.servico, unidade: p.unidade, qtd, valor_unit, total: tot });
    }
    const catOrder = Object.keys(byCat).sort();

    const esc = (v) => String(v == null ? "" : v)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
    const fmtBR = (n) => Number(n || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const today = new Date().toLocaleDateString("pt-BR");
    const itemTitle = (item && item.descritivo ? String(item.descritivo).split("\n")[0] : "");
    const itemCatLabel = itemCat || "—";
    const obraInfo = (item && item.obra_code) || (item && item.simulacao_id) || "—";

    let body = "";
    for (const cat of catOrder) {
      const linhas = byCat[cat];
      const totCat = linhas.reduce((s, l) => s + l.total, 0);
      body += `<div class="catbox">`;
      body += `<div class="cathead">${esc(cat)}<span class="catmeta">${linhas.length} serviço${linhas.length > 1 ? "s" : ""}</span></div>`;
      body += `<table><thead><tr>`;
      body += `<th style="width:50%">Serviço</th><th style="width:10%">Unid.</th><th style="width:10%">Qtd.</th><th style="width:15%">R$ Unit.</th><th style="width:15%">Total</th>`;
      body += `</tr></thead><tbody>`;
      for (const l of linhas) {
        body += `<tr><td>${esc(l.servico)}</td><td>${esc(l.unidade)}</td><td>${fmtBR(l.qtd)}</td><td>R$ ${fmtBR(l.valor_unit)}</td><td><b>R$ ${fmtBR(l.total)}</b></td></tr>`;
      }
      body += `</tbody></table>`;
      body += `<div class="secfoot">Subtotal ${esc(cat)}: <b>R$ ${fmtBR(totCat)}</b></div>`;
      body += `</div>`;
    }
    if (catOrder.length === 0) {
      body = `<p style="text-align:center;padding:30pt;color:#666">Nenhum serviço selecionado.</p>`;
    }

    return `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Mão de Obra ${esc(obraInfo)}</title><style>
*{margin:0;padding:0;box-sizing:border-box}
body{font:8pt Arial, Helvetica, sans-serif;background:#666;color:#1a1a1a}
.pg{width:210mm;min-height:297mm;margin:20px auto;padding:20pt 24pt;background:#fff;box-shadow:0 4px 24px rgba(0,0,0,.4)}
.hd{display:flex;justify-content:space-between;border-bottom:2px solid #000;padding-bottom:10pt;margin-bottom:12pt}
.lo{font:700 20pt sans-serif;letter-spacing:2pt}
.em{text-align:right;font-size:7pt;line-height:1.4}
.inf{display:grid;grid-template-columns:1fr 1fr;gap:4pt 16pt;margin-bottom:12pt;font-size:7.5pt;border:1px solid #ccc;padding:8pt}
.inf b{color:#333}
table{width:100%;border-collapse:collapse;font-size:7.5pt;margin-bottom:6pt}
th{background:#1a1a1a;color:#fff;padding:5pt 6pt;text-align:left;font-size:7pt}
th:nth-child(n+3){text-align:right}
td{padding:4pt 6pt;border-bottom:1px solid #e0e0e0}
td:nth-child(n+3){text-align:right}
.catbox{margin-top:10pt;border:1px solid #d4d4d4;border-radius:4pt;padding:8pt;background:#fafafa}
.cathead{font:700 10pt sans-serif;margin-bottom:6pt;padding-bottom:4pt;border-bottom:2px solid #333;color:#111;overflow:hidden}
.catmeta{font:400 7.5pt sans-serif;color:#666;float:right}
.secfoot{font-size:8pt;text-align:right;padding:4pt 6pt;border-top:1px solid #999;margin-top:4pt}
.tot{margin-top:14pt;border:2px solid #14B8A6;border-radius:4pt;padding:10pt;background:rgba(20,184,166,0.08);display:flex;justify-content:space-between;align-items:center}
.tot .lbl{font-size:9pt;font-weight:700;color:#0d7a6a;text-transform:uppercase;letter-spacing:1pt}
.tot .val{font-size:14pt;font-weight:700;color:#0d7a6a}
.ft{display:flex;justify-content:space-around;margin-top:30pt;padding-top:20pt;border-top:1px dashed #999}
.sg{text-align:center;font-size:7pt;color:#555;border-top:1px solid #333;width:200pt;padding-top:4pt}
@media print{body{background:#fff}.pg{box-shadow:none;margin:0}}
</style></head><body><div class="pg">
<div class="hd"><div class="lo">PARKET</div><div class="em">MÃO DE OBRA — INSTALAÇÃO<br>Gerado em ${today}</div></div>
<div class="inf">
  <div><b>Item:</b> ${esc(itemTitle)}</div>
  <div><b>Categoria:</b> ${esc(itemCatLabel)}</div>
  <div><b>m² do item:</b> ${itemM2 > 0 ? fmtBR(itemM2) + " m²" : "—"}</div>
  <div><b>Data:</b> ${today}</div>
</div>
${body}
<div class="tot"><div class="lbl">Total Mão de Obra</div><div class="val">R$ ${fmtBR(totalGeral)}</div></div>
<div class="ft"><div class="sg">Assinatura conferente</div><div class="sg">Assinatura conferente Mundial</div></div>
</div></body></html>`;
  };

  const printPdf = () => {
    try {
      const html = buildPrintHtml();
      // Iframe oculto — mesmo padrão do botão Insumos
      const frame = document.createElement("iframe");
      frame.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden";
      document.body.appendChild(frame);
      const doc = frame.contentDocument || frame.contentWindow.document;
      doc.open(); doc.write(html); doc.close();
      setTimeout(() => {
        try { frame.contentWindow.focus(); frame.contentWindow.print(); }
        catch (err) { alert("Erro ao gerar PDF: " + (err.message || err)); }
        setTimeout(() => { try { document.body.removeChild(frame); } catch (_e) {} }, 30000);
      }, 600);
    } catch (err) {
      console.error("[MaoDeObraModal] print error:", err);
      alert("Erro ao gerar PDF: " + (err.message || err));
    }
  };

  // Agrupa por categoria, prioriza categoria do item e respeita filter / showAllCats
  const grouped = (() => {
    const g = {};
    const q = filter.trim().toLowerCase();
    for (const p of precos) {
      const isItemCat = (p.categoria === itemCat);
      const isAcabamentoOrRemocao = (p.categoria === "ACABAMENTO" || p.categoria === "REMOÇÃO");
      if (!showAllCats && !isItemCat && !isAcabamentoOrRemocao) continue;
      if (q && !(p.servico.toLowerCase().includes(q) || p.categoria.toLowerCase().includes(q))) continue;
      g[p.categoria] = g[p.categoria] || [];
      g[p.categoria].push(p);
    }
    return g;
  })();

  // Ordem das categorias: a do item primeiro, depois ACABAMENTO, depois resto
  const catOrder = Object.keys(grouped).sort((a, b) => {
    if (a === itemCat) return -1;
    if (b === itemCat) return 1;
    if (a === "ACABAMENTO") return -1;
    if (b === "ACABAMENTO") return 1;
    return a.localeCompare(b);
  });

  // ───── render ─────
  return h("div", {
    onClick: (ev) => { if (ev.target === ev.currentTarget) onClose(); },
    style: {
      position: "fixed", inset: 0, zIndex: 9999, background: COLORS.bg,
      display: "flex", alignItems: "center", justifyContent: "center",
    },
    children: hs("div", {
      style: {
        background: COLORS.card, border: `1px solid ${COLORS.border}`,
        borderRadius: 12, width: "min(900px, 95vw)", maxHeight: "92vh",
        display: "flex", flexDirection: "column", overflow: "hidden",
        color: COLORS.text,
      },
      children: [
        // Header
        hs("div", {
          style: {
            padding: "14px 18px", borderBottom: `1px solid ${COLORS.border}`,
            display: "flex", alignItems: "center", justifyContent: "space-between",
          },
          children: [
            hs("div", {
              children: [
                h("div", { style: { fontSize: "0.92rem", fontWeight: 700 }, children: "💼 Mão de Obra — Instalação" }),
                h("div", { style: { fontSize: "0.62rem", color: COLORS.dim, marginTop: 2 },
                  children: item && item.descritivo
                    ? String(item.descritivo).split("\n")[0].slice(0, 80)
                    : "" }),
              ],
            }),
            h("button", {
              onClick: onClose, style: {
                background: "transparent", border: `1px solid ${COLORS.border}`,
                color: COLORS.text, cursor: "pointer", borderRadius: 6, padding: "5px 10px",
                fontSize: "0.65rem",
              },
              children: "Fechar",
            }),
          ],
        }),

        // Resumo: categoria + m² extraído + toggle "ver todas"
        hs("div", {
          style: { padding: "10px 18px", background: COLORS.highlight, borderBottom: `1px solid ${COLORS.border}`,
            display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 },
          children: [
            hs("div", {
              style: { display: "flex", gap: 14, alignItems: "center", flexWrap: "wrap", fontSize: "0.62rem" },
              children: [
                hs("div", { style: { color: COLORS.dim }, children: [
                  "Item ",
                  h("span", { style: { color: CAT_COLORS[itemCat] || COLORS.text, fontWeight: 700 }, children: itemCat || "(?)" }),
                ]}),
                itemM2 > 0 && hs("div", { style: { color: COLORS.dim }, children: [
                  "m² puxado do orçamento: ",
                  h("span", { style: { color: COLORS.accent, fontWeight: 700 }, children: _fmt(itemM2) + " m²" }),
                ]}),
                !itemM2 && h("div", { style: { color: "#f87171", fontStyle: "italic" }, children: "Sem m² no descritivo — preencha qty manualmente" }),
              ],
            }),
            hs("label", {
              style: { display: "flex", alignItems: "center", gap: 6, fontSize: "0.6rem", cursor: "pointer", color: COLORS.dim },
              children: [
                h("input", { type: "checkbox", checked: showAllCats, onChange: ev => setShowAllCats(ev.target.checked) }),
                h("span", { children: "ver todas as categorias" }),
              ],
            }),
          ],
        }),

        // Filter
        h("div", {
          style: { padding: "10px 18px", borderBottom: `1px solid ${COLORS.border}` },
          children: h("input", {
            value: filter, onChange: (ev) => setFilter(ev.target.value),
            placeholder: "Buscar serviço...",
            style: {
              width: "100%", padding: "7px 10px", borderRadius: 7,
              fontSize: "0.65rem", background: "rgba(255,255,255,0.03)",
              border: `1px solid ${COLORS.border}`, color: COLORS.text, outline: "none",
            },
          }),
        }),

        // Body
        h("div", {
          style: { flex: 1, overflowY: "auto", padding: "12px 18px" },
          children: loading
            ? h("div", { style: { color: COLORS.dim, fontSize: "0.7rem", textAlign: "center", padding: 30 },
                children: "Carregando catálogo..." })
            : hs("div", {
              style: { display: "flex", flexDirection: "column", gap: 18 },
              children: catOrder.map(cat => hs("div", {
                key: cat,
                children: [
                  hs("div", {
                    style: {
                      display: "flex", alignItems: "center", gap: 8, padding: "5px 0",
                      borderBottom: `1px solid ${CAT_COLORS[cat] || COLORS.border}`,
                      marginBottom: 6,
                    },
                    children: [
                      h("span", { style: { width: 6, height: 6, borderRadius: "50%", background: CAT_COLORS[cat] || COLORS.dim, display: "inline-block" } }),
                      h("span", { style: { fontSize: "0.66rem", fontWeight: 700, letterSpacing: "0.06em", color: CAT_COLORS[cat] || COLORS.text },
                        children: cat + (cat === itemCat ? "  ← deste item" : "") }),
                    ],
                  }),
                  ...grouped[cat].map((p, idx) => {
                    const ent = entries[p.id] || {};
                    const qtd = Number(ent.qtd) || 0;
                    const vu = ent.valor_unit !== undefined ? Number(ent.valor_unit) : Number(p.valor_unitario);
                    const tot = qtd * vu;
                    const enabled = qtd > 0;
                    return hs("div", {
                      key: p.id,
                      style: {
                        display: "grid", gridTemplateColumns: "1fr 60px 100px 110px 80px",
                        gap: 8, alignItems: "center", padding: "6px 8px", borderRadius: 6,
                        background: idx % 2 ? COLORS.rowAlt : "transparent",
                        fontSize: "0.66rem",
                      },
                      children: [
                        h("div", { children: p.servico }),
                        h("div", { style: { color: COLORS.dim, textAlign: "center" }, children: p.unidade }),
                        h("input", {
                          type: "number", step: "0.01", min: "0", value: qtd || "",
                          onChange: (ev) => setEntry(p.id, "qtd", parseFloat(ev.target.value) || 0),
                          placeholder: "0",
                          style: {
                            width: "100%", padding: "5px 7px", borderRadius: 5,
                            background: "rgba(255,255,255,0.04)", border: `1px solid ${COLORS.border}`,
                            color: COLORS.text, outline: "none", textAlign: "right",
                          },
                        }),
                        hs("div", {
                          style: { display: "flex", alignItems: "center", gap: 4 },
                          children: [
                            h("span", { style: { color: COLORS.dim, fontSize: "0.58rem" }, children: "R$" }),
                            h("input", {
                              type: "number", step: "0.01", min: "0",
                              value: ent.valor_unit !== undefined ? vu : (Number(p.valor_unitario) || 0),
                              onChange: (ev) => setEntry(p.id, "valor_unit", parseFloat(ev.target.value) || 0),
                              style: {
                                width: "100%", padding: "5px 7px", borderRadius: 5,
                                background: "rgba(255,255,255,0.04)", border: `1px solid ${COLORS.border}`,
                                color: enabled ? COLORS.text : COLORS.dim, outline: "none", textAlign: "right",
                              },
                            }),
                          ],
                        }),
                        h("div", {
                          style: { textAlign: "right", fontWeight: enabled ? 700 : 400,
                            color: enabled ? COLORS.accent : COLORS.dim },
                          children: tot > 0 ? "R$ " + _fmt(tot) : "—",
                        }),
                      ],
                    });
                  }),
                ],
              })),
            }),
        }),

        // Footer total + actions
        hs("div", {
          style: {
            padding: "12px 18px", borderTop: `1px solid ${COLORS.border}`,
            display: "flex", alignItems: "center", justifyContent: "space-between",
            background: "rgba(20,184,166,0.04)",
          },
          children: [
            hs("div", {
              children: [
                h("div", { style: { fontSize: "0.55rem", color: COLORS.dim, letterSpacing: "0.08em" }, children: "TOTAL MÃO DE OBRA" }),
                h("div", { style: { fontSize: "1.05rem", fontWeight: 700, color: COLORS.accent },
                  children: "R$ " + _fmt(calcTotalGeral()) }),
              ],
            }),
            hs("div", {
              style: { display: "flex", gap: 8 },
              children: [
                h("button", {
                  onClick: onClose,
                  style: { padding: "8px 16px", borderRadius: 6, border: `1px solid ${COLORS.border}`,
                    background: "transparent", color: COLORS.text, fontSize: "0.65rem", cursor: "pointer" },
                  children: "Cancelar",
                }),
                h("button", {
                  onClick: printPdf, disabled: loading,
                  title: "Gera HTML e abre a janela de impressão (estilo Insumos)",
                  style: { padding: "8px 16px", borderRadius: 6, border: "1px solid rgba(249,115,22,0.4)",
                    background: "rgba(249,115,22,0.15)", color: "#FB923C", fontSize: "0.65rem",
                    fontWeight: 600, cursor: loading ? "not-allowed" : "pointer" },
                  children: "📄 Imprimir PDF",
                }),
                h("button", {
                  onClick: save, disabled: saving || loading,
                  style: { padding: "8px 16px", borderRadius: 6, border: "none",
                    background: COLORS.accent, color: "white", fontSize: "0.65rem", fontWeight: 600,
                    cursor: saving ? "not-allowed" : "pointer", opacity: saving ? 0.6 : 1 },
                  children: saving ? "Salvando..." : "Salvar",
                }),
              ],
            }),
          ],
        }),
      ],
    }),
  });
}

// ───── Global opener ─────
let _root = null;
let _container = null;

function ensureContainer() {
  if (_container) return _container;
  _container = document.createElement("div");
  _container.id = "__pkt_maoobra_root";
  document.body.appendChild(_container);
  return _container;
}

async function _getCreateRoot() {
  if (typeof window !== "undefined" && window.ReactDOM) {
    if (window.ReactDOM.createRoot) return window.ReactDOM.createRoot;
    if (window.ReactDOM.render) return null;
  }
  try {
    const m = await import("react-dom/client");
    if (m && m.createRoot) return m.createRoot;
  } catch (_e) {}
  return null;
}

async function openMaoDeObra(item, onSavedCb) {
  if (!item || !item.id) {
    alert("Item inválido — recarregue a página.");
    return;
  }
  const container = ensureContainer();
  const createRoot = await _getCreateRoot();
  const close = () => {
    try {
      if (_root && _root.unmount) _root.unmount();
      if (container) container.innerHTML = "";
    } catch (_e) {}
    _root = null;
  };
  const element = h(MaoDeObraModal, { item: item, onClose: close, onSaved: onSavedCb });
  if (createRoot) {
    _root = createRoot(container);
    _root.render(element);
  } else if (typeof window !== "undefined" && window.ReactDOM && window.ReactDOM.render) {
    window.ReactDOM.render(element, container);
    _root = { unmount: () => window.ReactDOM.unmountComponentAtNode(container) };
  } else {
    console.error("[MaoDeObraModal] React DOM não disponível");
    alert("Erro ao abrir modal — recarregue a página.");
  }
}

if (typeof window !== "undefined") {
  window.__pkt_openMaoDeObra = openMaoDeObra;
}

export { MaoDeObraModal, openMaoDeObra };
export default openMaoDeObra;
