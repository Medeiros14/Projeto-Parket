/**
 * Orçamento Badge — patch chunk Parket
 * Pequeno badge mostrado no card do funil comercial quando o card já tem
 * orçamentista atribuído. Lê apenas de card.details (sem fetch async).
 * Mostra: "📋 Bruno · Aguarda aceite/Aceito/Em produção/etc"
 */
import { R as h } from "./index-DZtetJYP.js";

const SB_URL = "https://hbxpilrxmitvzebluoom.supabase.co";
const SB_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhieHBpbHJ4bWl0dnplYmx1b29tIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI5NDI1MjcsImV4cCI6MjA4ODUxODUyN30.ciZA1H-UvlYG2OPWqrFChj-_ttiFD5W5BmrST-gUJ-0";

const c = h.createElement;

const STATUS_LABELS = {
  aguarda_aceite: "Aguarda aceite",
  aceito: "Aceito",
  em_progresso: "Em produção",
  aguarda_info: "Aguarda info",
  concluido: "Concluído",
  recusado: "Recusado",
};
const STATUS_COLORS = {
  aguarda_aceite: "#F59E0B",
  aceito: "#3B82F6",
  em_progresso: "#8B5CF6",
  aguarda_info: "#D4A853",
  concluido: "#10B981",
  recusado: "#EF4444",
};

// Cache em memória pra evitar refetch em todo render
const _cache = new Map(); // cardId → { ts, data }
const TTL = 30_000; // 30s

async function _fetchDemanda(cardId) {
  const now = Date.now();
  const cached = _cache.get(cardId);
  if (cached && now - cached.ts < TTL) return cached.data;
  try {
    let userTok = SB_KEY;
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        const raw = k && localStorage.getItem(k);
        if (!raw || (raw[0] !== "{" && raw[0] !== "[")) continue;
        let p;
        try { p = JSON.parse(raw); } catch { continue; }
        const tok = (p && p.access_token) || (p && p.currentSession && p.currentSession.access_token) || null;
        if (tok && tok.length > 40) { userTok = tok; break; }
      }
    } catch (e) {}
    // Busca demanda — card pode ser o ORIGEM (comercial) OU o CLONE (orcamento).
    // Filtra por OR via PostgREST: kanban_card_id OU kanban_card_orc_id.
    const url = `${SB_URL}/rest/v1/orcamento_demandas?select=status,prazo_horas,prazo_unidade,prazo_data&or=(kanban_card_id.eq.${cardId},kanban_card_orc_id.eq.${cardId})&order=created_at.desc&limit=1`;
    const r = await fetch(url, {
      headers: { apikey: SB_KEY, Authorization: `Bearer ${userTok}` },
    });
    if (!r.ok) return null;
    const arr = await r.json();
    const data = arr && arr[0] ? arr[0] : null;
    _cache.set(cardId, { ts: now, data });
    return data;
  } catch (e) {
    return null;
  }
}

function _formatPrazo(horas, unidade) {
  if (!horas) return "";
  if (unidade === "dias" || horas >= 24) {
    const d = Math.round(horas / 24);
    return `${d}d`;
  }
  return `${horas}h`;
}

function OrcBadge({ card }) {
  const [demanda, setDemanda] = h.useState(null);
  const det = (card && card.details) || {};
  const orcNome = det.orcamentista_nome;
  const cardId = card && card.id;

  h.useEffect(() => {
    if (!cardId || !orcNome) return;
    let alive = true;
    _fetchDemanda(cardId).then((d) => { if (alive) setDemanda(d); });
    return () => { alive = false; };
  }, [cardId, orcNome]);

  if (!orcNome) return null;

  const status = (demanda && demanda.status) || "aguarda_aceite";
  const label = STATUS_LABELS[status] || status;
  const color = STATUS_COLORS[status] || "#3B82F6";
  const prazo = demanda && demanda.prazo_horas
    ? _formatPrazo(demanda.prazo_horas, demanda.prazo_unidade)
    : "";

  return c("div", {
    style: {
      display: "inline-flex", alignItems: "center", gap: 4,
      padding: "2px 6px", borderRadius: 4,
      background: `${color}20`, color: color,
      fontSize: "0.5rem", fontWeight: 600,
      marginBottom: 4, marginRight: 4,
      lineHeight: 1.2, whiteSpace: "nowrap",
    },
    title: `Orçamentista: ${orcNome} — ${label}${prazo ? " · " + prazo : ""}`,
  },
    c("span", { style: { fontSize: "0.55rem" } }, "📋"),
    c("span", null, orcNome),
    c("span", { style: { opacity: 0.7, marginLeft: 2 } }, "·", " ", label),
    prazo && c("span", { style: { opacity: 0.7, marginLeft: 2 } }, prazo),
  );
}

export { OrcBadge as O };
