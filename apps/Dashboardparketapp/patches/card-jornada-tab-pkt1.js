// card-jornada-tab-pkt1.js
// Aba "🛤️ Status de Projeto" do modal de card no Operacional.
// Mostra timeline da jornada do mirror em Projetos: fases já passadas (✅),
// fase atual (🔵 ATUAL) e fases futuras (⚪), com data em que entrou em cada.
//
// Dados: kanban_cards (mirror via parent_card_id) + card_events (action='move')
// + kanban_columns (ordem das fases de projetos).

import { r as RE, s as SB, j as o } from "./index-DZtetJYP.js";

const ACCENT = "#FF6B35";
const BG_PANEL = "#111";
const BG_CARD = "#1a1a1a";
const BORDER = "#2a2a2a";
const TXT = "#fafafa";
const TXT_DIM = "#a1a1aa";
const TXT_MUTED = "#71717a";

function fmtDate(s) {
  if (!s) return "";
  try { return new Date(s).toLocaleDateString("pt-BR"); } catch { return s; }
}
function fmtDateTime(s) {
  if (!s) return "";
  try { return new Date(s).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }); } catch { return s; }
}

function CardJornadaTab({ cardId }) {
  const [loading, setLoading] = RE.useState(true);
  const [err, setErr] = RE.useState(null);
  const [data, setData] = RE.useState(null);

  RE.useEffect(() => {
    if (!cardId) return;
    let alive = true;
    setLoading(true);
    setErr(null);
    setData(null);
    (async () => {
      try {
        // 1) mirror em projetos vinculado a este card_id (parent_card_id)
        const mR = await SB.from("kanban_cards")
          .select("id,title,column_id,created_at,updated_at,details,parent_card_id")
          .eq("dept_id", "projetos")
          .eq("parent_card_id", cardId)
          .maybeSingle();
        if (!alive) return;
        const mirror = mR.data || null;

        // 2) colunas de projetos (ordem)
        const cR = await SB.from("kanban_columns")
          .select("slug,title,color,position")
          .eq("dept_id", "projetos")
          .order("position");
        if (!alive) return;
        const cols = cR.data || [];

        // 3) eventos de move do mirror
        let events = [];
        if (mirror) {
          const eR = await SB.from("card_events")
            .select("action,from_column_slug,to_column_slug,created_at,user_id")
            .eq("card_id", mirror.id)
            .eq("action", "move")
            .order("created_at", { ascending: true });
          if (!alive) return;
          events = eR.data || [];
        }
        if (alive) setData({ mirror, cols, events });
      } catch (e) {
        if (alive) setErr(String(e));
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [cardId]);

  if (loading) {
    return o.jsx("div", {
      style: { padding: 40, textAlign: "center", color: TXT_DIM },
      children: "Carregando jornada do projeto…",
    });
  }
  if (err) {
    return o.jsx("div", {
      style: { padding: 20, color: "#f87171", background: BG_CARD, borderRadius: 4, border: `1px solid ${BORDER}` },
      children: `Erro: ${err}`,
    });
  }
  if (!data) return null;

  const { mirror, cols, events } = data;

  if (!mirror) {
    return o.jsxs("div", {
      style: { padding: 20 },
      children: [
        o.jsxs("div", {
          style: { padding: 16, background: "#7c2d1233", border: "1px solid #d97706", borderRadius: 4, color: "#fcd34d", fontSize: "0.75rem" },
          children: [
            o.jsx("div", { style: { fontWeight: 700, marginBottom: 6 }, children: "⚠️ Sem espelho em Projetos" }),
            o.jsx("div", { children: "Este card ainda não foi espelhado no setor de Projetos. Quando ele entrar na coluna 'Projeto' do Operacional, o mirror é criado automaticamente em Projetos > Contratos Novos." }),
          ],
        }),
      ],
    });
  }

  // Reconstrói datas: { slug: timestamp de quando entrou }
  const enteredAt = new Map();
  // Estado inicial: criação do mirror
  enteredAt.set(events.length > 0 && events[0].from_column_slug
    ? events[0].from_column_slug
    : "contratos-novos", mirror.created_at);
  events.forEach((e) => {
    if (e.to_column_slug) enteredAt.set(e.to_column_slug, e.created_at);
  });

  const currentSlug = mirror.column_id;
  const currentCol = cols.find((c) => c.slug === currentSlug);
  const currentPos = currentCol ? currentCol.position : -1;

  return o.jsxs("div", {
    style: { padding: 16, color: TXT },
    children: [
      // Header
      o.jsxs("div", {
        style: { marginBottom: 16 },
        children: [
          o.jsx("div", {
            style: { fontSize: "0.6rem", color: ACCENT, textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 700 },
            children: "🛤️ Jornada no setor Projetos",
          }),
          o.jsx("div", {
            style: { fontSize: "0.7rem", color: TXT_DIM, marginTop: 4 },
            children: "Acompanhamento automático em tempo real — atualiza conforme o time de Projetos move o card no kanban deles.",
          }),
        ],
      }),

      // Resumo info
      o.jsxs("div", {
        style: { display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" },
        children: [
          o.jsxs("div", {
            style: { flex: 1, minWidth: 180, padding: 10, background: BG_CARD, border: `1px solid ${BORDER}`, borderRadius: 4 },
            children: [
              o.jsx("div", { style: { fontSize: "0.55rem", color: TXT_MUTED, textTransform: "uppercase" }, children: "Fase atual em Projetos" }),
              o.jsx("div", {
                style: { fontSize: "1rem", fontWeight: 700, color: ACCENT, marginTop: 2 },
                children: (currentCol && currentCol.title) || currentSlug,
              }),
            ],
          }),
          o.jsxs("div", {
            style: { flex: 1, minWidth: 140, padding: 10, background: BG_CARD, border: `1px solid ${BORDER}`, borderRadius: 4 },
            children: [
              o.jsx("div", { style: { fontSize: "0.55rem", color: TXT_MUTED, textTransform: "uppercase" }, children: "Espelhado em" }),
              o.jsx("div", { style: { fontSize: "0.8rem", color: TXT, marginTop: 2 }, children: fmtDate(mirror.created_at) }),
            ],
          }),
          o.jsxs("div", {
            style: { flex: 1, minWidth: 140, padding: 10, background: BG_CARD, border: `1px solid ${BORDER}`, borderRadius: 4 },
            children: [
              o.jsx("div", { style: { fontSize: "0.55rem", color: TXT_MUTED, textTransform: "uppercase" }, children: "Movimentações" }),
              o.jsx("div", { style: { fontSize: "0.8rem", color: TXT, marginTop: 2 }, children: `${events.length}` }),
            ],
          }),
        ],
      }),

      // Timeline (cada fase = uma linha)
      o.jsx("div", {
        style: { display: "flex", flexDirection: "column", gap: 4 },
        children: cols.map((c, idx) => {
          const passed = idx < currentPos;
          const current = idx === currentPos;
          const when = enteredAt.get(c.slug);
          const icon = current ? "🔵" : passed ? "✅" : "⚪";
          const color = current ? ACCENT : passed ? "#10b981" : TXT_MUTED;
          const bg = current ? "#FF6B3520" : passed ? "#10b98115" : "transparent";
          const bdr = current ? `2px solid ${ACCENT}` : `1px solid ${BORDER}`;
          return o.jsxs("div", {
            style: { display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", background: bg, border: bdr, borderRadius: 4, fontSize: "0.75rem" },
            children: [
              o.jsx("div", { style: { fontSize: "1rem" }, children: icon }),
              o.jsxs("div", {
                style: { flex: 1 },
                children: [
                  o.jsx("div", { style: { color, fontWeight: current ? 700 : 600 }, children: c.title }),
                  when ? o.jsx("div", { style: { fontSize: "0.6rem", color: TXT_MUTED, marginTop: 2 }, children: passed || current ? `Entrou em ${fmtDateTime(when)}` : "" }) : null,
                ],
              }),
              current ? o.jsx("div", { style: { fontSize: "0.6rem", color: ACCENT, fontWeight: 700, letterSpacing: "0.05em" }, children: "ATUAL" }) : null,
              passed ? o.jsx("div", { style: { fontSize: "0.6rem", color: "#10b981", fontWeight: 700 }, children: "✓" }) : null,
            ],
          }, c.slug);
        }),
      }),

      // Footer info
      o.jsx("div", {
        style: { marginTop: 16, padding: 10, background: BG_CARD, border: `1px solid ${BORDER}`, borderRadius: 4, fontSize: "0.6rem", color: TXT_MUTED, lineHeight: 1.5 },
        children: "ℹ️ Quando o time de Projetos mover o mirror para 'Finalizado', o card aqui no Operacional será automaticamente movido para a coluna 'Projeto Finalizado'.",
      }),
    ],
  });
}

export { CardJornadaTab as J };
