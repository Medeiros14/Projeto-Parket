/**
 * Ver Orçamento Link — chunk hotpatch
 * Botão que aparece no card comercial quando há proposta vinculada.
 * Click → abre /proposta/{id} em nova aba pro vendedor mandar pro cliente.
 */
import { R as h } from "./index-DZtetJYP.js";

const SB_URL = "https://hbxpilrxmitvzebluoom.supabase.co";
const SB_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhieHBpbHJ4bWl0dnplYmx1b29tIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI5NDI1MjcsImV4cCI6MjA4ODUxODUyN30.ciZA1H-UvlYG2OPWqrFChj-_ttiFD5W5BmrST-gUJ-0";
const c = h.createElement;

const _cache = new Map(); // cardId → { ts, data }
const TTL = 30_000;

function _userToken() {
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      const raw = k && localStorage.getItem(k);
      if (!raw || (raw[0] !== "{" && raw[0] !== "[")) continue;
      let p; try { p = JSON.parse(raw); } catch { continue; }
      const tok = (p && p.access_token)
        || (p && p.currentSession && p.currentSession.access_token)
        || (p && p.session && p.session.access_token)
        || null;
      if (tok && tok.length > 40) return tok;
    }
  } catch (e) {}
  return SB_KEY;
}

async function _fetchProposta(cardId) {
  if (!cardId) return null;
  const now = Date.now();
  const cached = _cache.get(cardId);
  if (cached && now - cached.ts < TTL) return cached.data;
  try {
    const tok = _userToken();
    // Busca por card_id OU obra_id (cobre os 2 jeitos de criar proposta)
    // card_comercial_id é a coluna nova (mai/2026) que vincula simulações
    // feitas no setor orçamento ao card original do comercial (backfill + trigger).
    const url = `${SB_URL}/rest/v1/simulacao_projetos?select=id,numero,cliente,status,created_at&or=(card_id.eq.${cardId},obra_id.eq.${cardId},card_comercial_id.eq.${cardId})&order=created_at.desc&limit=1`;
    const r = await fetch(url, { headers: { apikey: SB_KEY, Authorization: `Bearer ${tok}` } });
    if (!r.ok) { _cache.set(cardId, { ts: now, data: null }); return null; }
    const arr = await r.json();
    const data = arr && arr[0] ? arr[0] : null;
    _cache.set(cardId, { ts: now, data });
    return data;
  } catch (e) { return null; }
}

// Só exibe a partir destas colunas no funil comercial (regra do user).
const COLS_VISIVEIS = new Set([
  "apresentacao-proposta", "em-negociacao", "ganho",
]);

function VerOrcamentoLink({ card }) {
  const [proposta, setProposta] = h.useState(null);
  const [loading, setLoading] = h.useState(true);
  const cardId = card && card.id;
  const colId = card && card.column_id;

  h.useEffect(() => {
    if (!cardId) { setLoading(false); return; }
    let alive = true;
    setLoading(true);
    _fetchProposta(cardId).then((p) => {
      if (alive) { setProposta(p); setLoading(false); }
    });
    return () => { alive = false; };
  }, [cardId]);

  // Esconde antes de "Apresentação/Proposta" — vendedor só vê quando faz sentido apresentar.
  if (!COLS_VISIVEIS.has(colId)) return null;
  if (loading || !proposta || !proposta.id) return null;

  const numero = proposta.numero || "?";
  const status = proposta.status || "rascunho";
  const url = `${window.location.origin}/proposta/${proposta.id}`;

  const STATUS_COLORS = {
    enviada: "#10B981", rascunho: "#F59E0B", aceita: "#06B6D4",
    rejeitada: "#EF4444", em_revisao: "#8B5CF6",
  };
  const color = STATUS_COLORS[status] || "#3B82F6";

  return c("a", {
    href: url,
    target: "_blank",
    rel: "noopener noreferrer",
    onClick: (e) => e.stopPropagation(),
    style: {
      display: "inline-flex", alignItems: "center", gap: 6,
      padding: "5px 10px", borderRadius: 6,
      background: `${color}15`, color: color,
      border: `1px solid ${color}50`,
      fontSize: "0.62rem", fontWeight: 700,
      textDecoration: "none", cursor: "pointer",
      whiteSpace: "nowrap", marginRight: 6, marginBottom: 4,
    },
    title: `Abrir orçamento #${numero} em nova aba (${status})`,
  },
    c("span", { style: { fontSize: "0.7rem" } }, "📄"),
    c("span", null, `Ver Orçamento #${numero}`),
    c("span", { style: { opacity: 0.7, fontWeight: 500, marginLeft: 4 } }, `· ${status}`),
  );
}

export { VerOrcamentoLink as V };
