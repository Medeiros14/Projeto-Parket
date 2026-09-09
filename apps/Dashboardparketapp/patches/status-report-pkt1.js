// status-report-pkt1.js
// ────────────────────────────────────────────────────────────────────
// Componente de relatório de Status pra dashboard PMO (Planejamento & Produtividade).
// Lista simulações que têm mapa criado + agrega contagem de anotações por fase.
// Cada simulação mostra: nº, cliente, barra de progresso por fase, total de itens, link pra editar.
// ────────────────────────────────────────────────────────────────────
import { r as React, s as supabase, j as _jrt } from "./index-DZtetJYP.js";

const h = _jrt.jsx;
const hs = _jrt.jsxs;
const u = React;

const FASES = {
  obra_nao_liberada:     { label: "Obra não liberada", cor: "#F87171" },
  aguardando_def_arq:    { label: "Aguardando def. arq.", cor: "#EC4899" },
  exec_parket:           { label: "Executivo Parket", cor: "#3B82F6" },
  aguardando_aprov_arq:  { label: "Aguardando aprov. arq.", cor: "#A78BFA" },
  aprovado:              { label: "Aprovado", cor: "#FCD34D" },
  aguarda_montagem:      { label: "Aguarda montagem", cor: "#86EFAC" },
  montagem:              { label: "Montagem", cor: "#FB923C" },
  entregue:              { label: "Entregue", cor: "#22C55E" },
};
const FASES_ORDEM = ["obra_nao_liberada","aguardando_def_arq","exec_parket","aguardando_aprov_arq","aprovado","aguarda_montagem","montagem","entregue"];

function StatusReportComponent() {
  const [rows, setRows] = u.useState([]);
  const [loading, setLoading] = u.useState(true);
  const [err, setErr] = u.useState(null);

  u.useEffect(() => {
    let alive = true;
    (async () => {
      try {
        // Lista mapas + dados da simulação + contagem por fase
        const { data: mapas, error: e1 } = await supabase
          .from("status_mapas")
          .select("id, simulacao_id, revisao_atual, pdf_atual_gerado_em")
          .order("updated_at", { ascending: false });
        if (e1) throw e1;
        if (!mapas || mapas.length === 0) {
          if (alive) { setRows([]); setLoading(false); }
          return;
        }
        const simIds = mapas.map(m => m.simulacao_id);
        const mapaIds = mapas.map(m => m.id);
        const [{ data: sims }, { data: anots }] = await Promise.all([
          supabase.from("simulacao_projetos")
            .select("id, numero, cliente, obra_code, status, created_at")
            .in("id", simIds),
          supabase.from("status_anotacoes")
            .select("mapa_id, fase, ambiente, descricao, numero_label, fase_entregue, fase_entrega_prevista")
            .in("mapa_id", mapaIds),
        ]);
        const simById = {};
        for (const s of (sims || [])) simById[s.id] = s;
        const anotsByMapa = {};
        for (const a of (anots || [])) {
          if (!anotsByMapa[a.mapa_id]) anotsByMapa[a.mapa_id] = [];
          anotsByMapa[a.mapa_id].push(a);
        }
        const out = mapas.map(m => {
          const sim = simById[m.simulacao_id] || {};
          const anots = anotsByMapa[m.id] || [];
          const faseCount = {};
          for (const k of FASES_ORDEM) faseCount[k] = 0;
          for (const a of anots) {
            faseCount[a.fase || "obra_nao_liberada"] = (faseCount[a.fase || "obra_nao_liberada"] || 0) + 1;
          }
          return {
            mapa_id: m.id,
            sim_id: m.simulacao_id,
            numero: sim.numero,
            cliente: sim.cliente,
            obra_code: sim.obra_code,
            revisao: m.revisao_atual,
            total: anots.length,
            faseCount,
            anots,
          };
        });
        if (alive) { setRows(out); setLoading(false); }
      } catch (e) {
        if (alive) { setErr(String(e.message || e)); setLoading(false); }
      }
    })();
    return () => { alive = false; };
  }, []);

  if (loading) return h("div", { style: { color: "#888", padding: 40, textAlign: "center", fontSize: 12 } }, "Carregando relatório…");
  if (err) return h("div", { style: { color: "#FCA5A5", padding: 20, background: "rgba(248,113,113,0.1)", borderRadius: 6, fontSize: 12 } }, "Erro: " + err);
  if (rows.length === 0) return h("div", { style: { color: "#888", padding: 40, textAlign: "center", fontSize: 12 } }, "Nenhum mapa de Status criado ainda. Acesse draw.parket.works/status pra criar.");

  return hs("div", { style: { padding: "16px 20px" } }, [
    h("div", { key: "hd", style: { fontSize: 16, fontWeight: 700, color: "#fff", marginBottom: 4 } }, "🗺️ Status — Diagramas de Obra"),
    h("div", { key: "sub", style: { fontSize: 11, color: "#888", marginBottom: 16 } }, `${rows.length} mapa(s) ativo(s) · vinculados a orçamentos`),
    hs("div", { key: "list", style: { display: "flex", flexDirection: "column", gap: 8 } }, rows.map(r => {
      const totalEntregue = r.faseCount.entregue;
      const pct = r.total > 0 ? Math.round((totalEntregue / r.total) * 100) : 0;
      return hs("div", {
        key: r.mapa_id,
        style: { background: "#161616", border: "1px solid #262626", borderRadius: 8, padding: "12px 14px" },
        children: [
          hs("div", { style: { display: "flex", alignItems: "center", gap: 12, marginBottom: 10 } }, [
            h("div", { style: { fontFamily: "monospace", color: "#22D3EE", fontWeight: 700, fontSize: 13 } }, "#" + (r.numero || "—")),
            h("div", { style: { flex: 1 } },
              hs("div", {}, [
                h("div", { style: { color: "#fff", fontWeight: 600, fontSize: 12 } }, r.cliente || "—"),
                h("div", { style: { color: "#666", fontSize: 9, marginTop: 2 } }, (r.obra_code || "sem obra") + " · " + r.total + " marcas · rev. " + (r.revisao || "—")),
              ])
            ),
            h("div", { style: { fontSize: 11, color: "#22C55E", fontWeight: 700 } }, pct + "% entregue"),
            h("a", {
              href: "https://draw.parket.works/status/mapa/" + r.sim_id,
              target: "_blank", rel: "noopener noreferrer",
              style: { fontSize: 10, padding: "4px 10px", background: "rgba(34,211,238,0.15)", border: "1px solid rgba(34,211,238,0.4)", borderRadius: 4, color: "#22D3EE", textDecoration: "none", fontWeight: 600 }
            }, "Abrir →"),
          ]),
          // Stack horizontal das fases
          hs("div", { style: { display: "flex", height: 8, borderRadius: 4, overflow: "hidden", background: "#0a0a0a" } },
            FASES_ORDEM.filter(k => r.faseCount[k] > 0).map(k =>
              h("div", {
                key: k,
                title: FASES[k].label + ": " + r.faseCount[k],
                style: {
                  flex: r.faseCount[k],
                  background: FASES[k].cor,
                  minWidth: 1,
                }
              })
            )
          ),
          // Legenda
          hs("div", { style: { display: "flex", flexWrap: "wrap", gap: 8, marginTop: 6, fontSize: 9, color: "#888" } },
            FASES_ORDEM.filter(k => r.faseCount[k] > 0).map(k =>
              hs("span", { key: k, style: { display: "inline-flex", alignItems: "center", gap: 4 } }, [
                h("span", { style: { width: 8, height: 8, borderRadius: "50%", background: FASES[k].cor, display: "inline-block" } }),
                h("span", {}, FASES[k].label + ": " + r.faseCount[k]),
              ])
            )
          ),
        ]
      });
    })),
  ]);
}

if (typeof window !== "undefined") {
  window.__pkt_StatusReportComponent = StatusReportComponent;
}

export { StatusReportComponent };
export default StatusReportComponent;
