/**
 * Equipe de Orçamentistas — patch chunk Parket
 * Aba "Equipe & Demandas" do dept orçamento.
 * Lista 6 orçamentistas (Raniere gestor + 5), kanban pessoal de demandas
 * por orçamentista, aceitar/recusar com prazo, notifica vendedor via Teka.
 * Usa React.createElement direto (universal, sem depender de jsx/jsxs).
 */
import { R as h } from "./index-DZtetJYP.js";
import { D as CardDetailModal } from "./orcamento-card-detail-pkt1.js";

const SB_URL = "https://hbxpilrxmitvzebluoom.supabase.co";
const SB_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhieHBpbHJ4bWl0dnplYmx1b29tIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI5NDI1MjcsImV4cCI6MjA4ODUxODUyN30.ciZA1H-UvlYG2OPWqrFChj-_ttiFD5W5BmrST-gUJ-0";
const AI_API = "https://agente.parket.works";

// Token do user logado pra passar nos PATCH/INSERT (RLS exige authenticated)
let _cachedToken = null;
let _cachedTokenAt = 0;
function _userToken() {
  const now = Date.now();
  if (_cachedToken && now - _cachedTokenAt < 30000) return _cachedToken;
  try {
    if (window.supabase && window.supabase.auth) {
      const s = (typeof window.supabase.auth.session === "function") ? window.supabase.auth.session() : null;
      if (s && s.access_token) { _cachedToken = s.access_token; _cachedTokenAt = now; return s.access_token; }
    }
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      const raw = k && localStorage.getItem(k);
      if (!raw || (raw[0] !== "{" && raw[0] !== "[")) continue;
      let parsed;
      try { parsed = JSON.parse(raw); } catch { continue; }
      const tok = (parsed && parsed.access_token)
        || (parsed && parsed.currentSession && parsed.currentSession.access_token)
        || (parsed && parsed.session && parsed.session.access_token)
        || (Array.isArray(parsed) && parsed[0] && parsed[0].access_token)
        || null;
      if (tok && typeof tok === "string" && tok.length > 40) {
        _cachedToken = tok; _cachedTokenAt = now;
        return tok;
      }
    }
  } catch (e) {}
  return SB_KEY;
}
function _authHeaders(extra) {
  return Object.assign({ apikey: SB_KEY, Authorization: `Bearer ${_userToken()}`, "Content-Type": "application/json" }, extra || {});
}

// Decodifica payload do JWT pra extrair email do user logado.
// Bruno só vê o kanban dele, Thayna só o dela. Gestor (Raniere) vê todos.
function _currentUserEmail() {
  try {
    const tok = _userToken();
    if (!tok || tok === SB_KEY) return null;
    const parts = tok.split(".");
    if (parts.length < 2) return null;
    const b64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const pad = b64.length % 4 ? "=".repeat(4 - b64.length % 4) : "";
    const json = atob(b64 + pad);
    const payload = JSON.parse(json);
    return (payload.email || (payload.user_metadata && payload.user_metadata.email) || "").toLowerCase() || null;
  } catch (e) { return null; }
}

const c = h.createElement;

// ── Cores / estilos compartilhados (alinhado ao tema escuro do dashboard) ──
const BG = "#0a0a0a", PANEL = "rgba(255,255,255,0.04)", BORDER = "rgba(255,255,255,0.08)";
const TEXT = "#fafafa", TEXT_DIM = "rgba(255,255,255,0.55)", TEXT_MED = "rgba(255,255,255,0.75)";
const ACCENT = "#3B82F6", GOLD = "#D4A853", GREEN = "#10B981", RED = "#EF4444", YELLOW = "#F59E0B", PURPLE = "#8B5CF6";

// Colunas do kanban orçamento principal (mesma ordem que aparece pra Raniere)
// Usadas TAMBÉM no kanban pessoal do orçamentista — view filtrada do mesmo dado.
const ORC_COLUMNS = [
  { slug: "solicitacao",      label: "Solicitação",       color: "#F59E0B" },
  { slug: "em-progresso",     label: "Em Progresso",      color: "#8B5CF6" },
  { slug: "analise-orc",      label: "Em Análise",        color: "#D4A853" },
  { slug: "analise-douglas",          label: "Análise Douglas",        color: "#3B82F6" },
  { slug: "refazer",          label: "Refazer",                color: "#EF4444" },
  { slug: "proposta-pronta",  label: "Proposta Pronta",   color: "#10B981" },
  { slug: "handoff-com",      label: "Enviada Comercial", color: "#14B8A6" },
  { slug: "proposta-aceita",  label: "Aprovado",          color: "#06B6D4" },
];
const COLUMN_BY_SLUG = Object.fromEntries(ORC_COLUMNS.map((c) => [c.slug, c]));

// Quando o card chega na coluna "proposta-pronta" do orçamento, o card
// COMERCIAL relacionado também é movido pra apresentacao-proposta + Teka notifica.
const TRIGGER_COLUMNS = {
  "proposta-pronta": { notify: true, comercialMoveTo: "apresentacao-proposta" },
  "handoff-com":     { notify: true, comercialMoveTo: "apresentacao-proposta" },
};

// Sync ao mover card no kanban pessoal: atualiza kanban_cards.column_id
// + dispara side-effects (notificação vendedor, mover comercial original).
async function syncCardColumn(card, newColumn, orcamentistaNome) {
  if (!card || card.column_id === newColumn) return;
  await sbPatch(`kanban_cards?id=eq.${card.id}`, { column_id: newColumn });

  const trigger = TRIGGER_COLUMNS[newColumn];
  if (trigger) {
    const det = card.details || {};
    if (trigger.comercialMoveTo && det.parent_card_id) {
      try {
        await sbPatch(`kanban_cards?id=eq.${det.parent_card_id}`, { column_id: trigger.comercialMoveTo });
      } catch (e) { console.warn("[sync] mover comercial falhou:", e); }
    }
    if (trigger.notify) {
      const vendedorNome = det.vendedor;
      if (vendedorNome) {
        await notifyVendedor({
          vendedor_nome: vendedorNome,
          evento: "concluido",
          orcamentista_nome: orcamentistaNome,
          titulo_card: card.title || "",
        });
      }
    }
  }
}

// Sync de status: atualiza demanda + card orçamento (e card comercial se concluído)
// + notifica vendedor via WhatsApp Teka quando aplicável.
async function syncStatus(demanda, newStatus, orcamentistaNome) {
  const patch = { status: newStatus };
  if (newStatus === "aceito" && !demanda.aceito_em) patch.aceito_em = new Date().toISOString();
  if (newStatus === "concluido") patch.concluido_em = new Date().toISOString();
  // 1. Update demanda
  await sbPatch(`orcamento_demandas?id=eq.${demanda.id}`, patch);

  // 2. Update card no kanban orçamento (column_id)
  const orcCol = STATUS_TO_ORC_COLUMN[newStatus];
  if (demanda.kanban_card_orc_id && orcCol) {
    await sbPatch(`kanban_cards?id=eq.${demanda.kanban_card_orc_id}`, { column_id: orcCol });
  }

  // 3. Quando concluído: move comercial pra apresentacao-proposta + notifica
  if (newStatus === "concluido") {
    if (demanda.kanban_card_id) {
      try {
        await sbPatch(`kanban_cards?id=eq.${demanda.kanban_card_id}`, { column_id: "apresentacao-proposta" });
      } catch (e) { console.warn("[sync] mover comercial falhou:", e); }
    }
    const vendedorNome = demanda.details && demanda.details.vendedor_nome;
    if (vendedorNome) {
      await notifyVendedor({
        vendedor_nome: vendedorNome,
        evento: "concluido",
        orcamentista_nome: orcamentistaNome,
        titulo_card: demanda.titulo,
      });
    }
  }
}

// ── Helpers Supabase REST ───────────────────────────────────────────────
async function sbGet(path) {
  const r = await fetch(`${SB_URL}/rest/v1/${path}`, { headers: _authHeaders() });
  if (!r.ok) throw new Error(`SB GET ${path}: ${r.status}`);
  return r.json();
}
async function sbPatch(path, body) {
  const r = await fetch(`${SB_URL}/rest/v1/${path}`, {
    method: "PATCH",
    headers: _authHeaders({ Prefer: "return=representation" }),
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(`SB PATCH ${path}: ${r.status} ${await r.text()}`);
  return r.json();
}
async function sbPost(table, body) {
  const r = await fetch(`${SB_URL}/rest/v1/${table}`, {
    method: "POST",
    headers: _authHeaders({ Prefer: "return=representation" }),
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(`SB POST ${table}: ${r.status} ${await r.text()}`);
  return r.json();
}

async function notifyVendedor(payload) {
  try {
    const r = await fetch(`${AI_API}/api/orcamento-equipe/notify-vendedor`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    return await r.json();
  } catch (e) {
    console.warn("notify falhou:", e);
    return { ok: false, error: String(e) };
  }
}

// ── Avatar circular com inicial ─────────────────────────────────────────
function Avatar(nome, color, size = 48) {
  const inicial = (nome || "?").trim().slice(0, 1).toUpperCase();
  return c("div", {
    style: {
      width: size, height: size, borderRadius: size / 2, background: color,
      display: "flex", alignItems: "center", justifyContent: "center",
      color: "#fff", fontWeight: 700, fontSize: size * 0.42,
      flexShrink: 0, boxShadow: "0 2px 6px rgba(0,0,0,0.3)",
    },
  }, inicial);
}

function Btn({ onClick, color = ACCENT, variant = "solid", size = "md", style = {}, disabled, children }) {
  const padding = size === "sm" ? "6px 10px" : "8px 14px";
  const fontSize = size === "sm" ? "0.65rem" : "0.7rem";
  const bg = variant === "ghost" ? "transparent" : variant === "soft" ? `${color}20` : color;
  const fg = variant === "solid" ? "#fff" : color;
  return c("button", {
    onClick, disabled,
    style: {
      padding, fontSize, fontWeight: 600, borderRadius: 6, cursor: disabled ? "not-allowed" : "pointer",
      border: variant === "solid" ? "none" : `1px solid ${color}40`,
      background: disabled ? "rgba(255,255,255,0.04)" : bg,
      color: disabled ? TEXT_DIM : fg,
      opacity: disabled ? 0.5 : 1,
      transition: "opacity 0.15s",
      ...style,
    },
  }, children);
}

function Modal({ onClose, title, children, width = 520 }) {
  return c("div", {
    onClick: onClose,
    style: { position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 },
  }, c("div", {
    onClick: (e) => e.stopPropagation(),
    style: { background: "#161616", border: `1px solid ${BORDER}`, borderRadius: 12, maxWidth: width, width: "100%", maxHeight: "85vh", overflow: "auto", padding: 20 },
  },
    c("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 } },
      c("h3", { style: { color: TEXT, fontSize: "0.95rem", fontWeight: 600, margin: 0 } }, title),
      c("button", { onClick: onClose, style: { background: "transparent", border: "none", color: TEXT_DIM, fontSize: "1.5rem", cursor: "pointer", padding: 0, lineHeight: 1 } }, "×")
    ),
    children
  ));
}

// ── Modal Aceitar/Editar com prazo ─────────────────────────────────────
// Quando demanda.status === "aceito", funciona em modo edição: só atualiza
// prazo_horas/prazo_unidade/prazo_data, sem re-disparar move de coluna nem
// notificar vendedor de novo. Quando aguarda_aceite, faz o fluxo completo.
// `targetColumn` permite override do destino (usado pelo drop-interceptor).
function AcceptModal({ demanda, card, orcamentistaNome, vendedorNome, targetColumn, onClose, onSaved }) {
  const isEdit = demanda && demanda.status === "aceito" && demanda.prazo_horas;
  const initialHoras = isEdit
    ? (demanda.prazo_unidade === "dias" ? Math.max(1, Math.round((demanda.prazo_horas || 24) / 24)) : (demanda.prazo_horas || 4))
    : 4;
  const [horas, setHoras] = h.useState(initialHoras);
  const [unidade, setUnidade] = h.useState((demanda && demanda.prazo_unidade) || "horas");
  const [saving, setSaving] = h.useState(false);
  const [err, setErr] = h.useState("");

  async function handleSave() {
    if (!horas || horas <= 0) { setErr("Informe um prazo válido"); return; }
    setSaving(true); setErr("");
    try {
      const horasTotal = unidade === "dias" ? horas * 24 : horas;
      const prazoData = new Date(Date.now() + horasTotal * 3600 * 1000).toISOString().slice(0, 10);
      const det = (card && card.details) || {};
      // Caso 1: demanda existe → patch
      if (demanda) {
        const patch = { prazo_horas: horasTotal, prazo_unidade: unidade, prazo_data: prazoData };
        if (!isEdit) {
          patch.status = "aceito";
          patch.aceito_em = new Date().toISOString();
        }
        await sbPatch(`orcamento_demandas?id=eq.${demanda.id}`, patch);
      } else {
        // Caso 2: card órfão (sem demanda) → cria demanda já aceita c/ prazo
        await sbPost("orcamento_demandas", {
          orcamentista_id: det.orcamentista_id || null,
          kanban_card_orc_id: (card && card.id) || null,
          kanban_card_id: det.parent_card_id || null,
          titulo: (card && card.title) || "",
          status: "aceito",
          aceito_em: new Date().toISOString(),
          prazo_horas: horasTotal,
          prazo_unidade: unidade,
          prazo_data: prazoData,
          details: { vendedor_nome: vendedorNome || det.vendedor || null },
        });
      }
      // Move coluna só na PRIMEIRA aceitação (edit não mexe; só pra alvos diferentes)
      if (!isEdit && card) {
        const dest = targetColumn || (card.column_id === "solicitacao" ? "em-progresso" : card.column_id);
        if (dest !== card.column_id) await syncCardColumn(card, dest, orcamentistaNome);
      }
      // Notifica vendedor só na primeira aceitação (e se houver vendedor)
      if (!isEdit && vendedorNome) {
        await notifyVendedor({
          vendedor_nome: vendedorNome, evento: "aceito",
          orcamentista_nome: orcamentistaNome, titulo_card: (demanda && demanda.titulo) || (card && card.title) || "",
          prazo_horas: horasTotal, prazo_unidade: unidade,
        });
      }
      onSaved && onSaved();
      onClose();
    } catch (e) {
      setErr(String(e));
    } finally { setSaving(false); }
  }

  const titulo = isEdit ? `Editar prazo — ${(card && card.title) || demanda.titulo}` : `Aceitar — ${(card && card.title) || demanda.titulo}`;
  const promptTxt = isEdit ? "Atualizar quanto tempo o orçamento vai levar:" : "Quanto tempo você estima pra fazer esse orçamento?";
  const btnTxt = isEdit ? "Salvar prazo" : "Aceitar";

  return c(Modal, { onClose, title: titulo },
    c("div", { style: { display: "flex", flexDirection: "column", gap: 12 } },
      c("div", { style: { color: TEXT_DIM, fontSize: "0.7rem" } }, promptTxt),
      c("div", { style: { display: "flex", gap: 8 } },
        c("input", {
          type: "number", min: 1, value: horas,
          onChange: (e) => setHoras(Number(e.target.value)),
          style: { flex: 1, background: PANEL, border: `1px solid ${BORDER}`, color: TEXT, padding: "8px 12px", borderRadius: 6, fontSize: "0.8rem" },
        }),
        c("select", {
          value: unidade, onChange: (e) => setUnidade(e.target.value),
          style: { background: PANEL, border: `1px solid ${BORDER}`, color: TEXT, padding: "8px 12px", borderRadius: 6, fontSize: "0.8rem" },
        },
          c("option", { value: "horas" }, "horas"),
          c("option", { value: "dias" }, "dias"),
        )
      ),
      !isEdit && vendedorNome && c("div", { style: { color: TEXT_DIM, fontSize: "0.65rem", padding: "8px 0" } },
        `Vendedor ${vendedorNome} receberá uma mensagem da Teka com o prazo.`),
      err && c("div", { style: { color: RED, fontSize: "0.7rem" } }, err),
      c("div", { style: { display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 8 } },
        c(Btn, { onClick: onClose, color: TEXT_DIM, variant: "ghost" }, "Cancelar"),
        c(Btn, { onClick: handleSave, color: GREEN, disabled: saving }, saving ? "Salvando…" : btnTxt),
      )
    )
  );
}

// ── Modal Recusar com motivo ────────────────────────────────────────────
// Aceita demanda null (cria uma demanda já recusada quando o card é órfão).
function RejectModal({ demanda, card, orcamentistaNome, vendedorNome, onClose, onSaved }) {
  const [motivo, setMotivo] = h.useState("");
  const [saving, setSaving] = h.useState(false);
  const [err, setErr] = h.useState("");

  async function handleSave() {
    if (!motivo.trim()) { setErr("Informe o motivo da recusa"); return; }
    setSaving(true); setErr("");
    try {
      const det = (card && card.details) || {};
      if (demanda) {
        await sbPatch(`orcamento_demandas?id=eq.${demanda.id}`, {
          status: "recusado", motivo_recusa: motivo, recusado_em: new Date().toISOString(),
        });
      } else {
        // Card órfão (sem demanda) → cria demanda já recusada pra registrar a recusa
        await sbPost("orcamento_demandas", {
          orcamentista_id: det.orcamentista_id || null,
          kanban_card_orc_id: (card && card.id) || null,
          kanban_card_id: det.parent_card_id || null,
          titulo: (card && card.title) || "",
          status: "recusado",
          motivo_recusa: motivo,
          recusado_em: new Date().toISOString(),
          details: { vendedor_nome: vendedorNome || det.vendedor || null },
        });
      }
      if (vendedorNome) {
        await notifyVendedor({ vendedor_nome: vendedorNome, evento: "recusado", orcamentista_nome: orcamentistaNome, titulo_card: (demanda && demanda.titulo) || (card && card.title) || "", motivo_recusa: motivo });
      }
      onSaved && onSaved();
      onClose();
    } catch (e) { setErr(String(e)); } finally { setSaving(false); }
  }

  return c(Modal, { onClose, title: `Recusar — ${(card && card.title) || (demanda && demanda.titulo) || ""}` },
    c("div", { style: { display: "flex", flexDirection: "column", gap: 12 } },
      c("textarea", {
        placeholder: "Motivo da recusa…", value: motivo, rows: 4,
        onChange: (e) => setMotivo(e.target.value),
        style: { background: PANEL, border: `1px solid ${BORDER}`, color: TEXT, padding: "8px 12px", borderRadius: 6, fontSize: "0.8rem", fontFamily: "inherit", resize: "vertical" },
      }),
      err && c("div", { style: { color: RED, fontSize: "0.7rem" } }, err),
      c("div", { style: { display: "flex", gap: 8, justifyContent: "flex-end" } },
        c(Btn, { onClick: onClose, color: TEXT_DIM, variant: "ghost" }, "Cancelar"),
        c(Btn, { onClick: handleSave, color: RED, disabled: saving }, saving ? "Salvando…" : "Recusar"),
      )
    )
  );
}

// ── Modal Criar card direto no orçamento ───────────────────────────────
// Permite gerar um card já carimbado com vendedor + orçamentista + prazo.
// O card cai no kanban pessoal do orçamentista escolhido (via orcamentista_id
// em details + filtro do EquipeOrcamentoTab) já em "em-progresso".
function CreateCardModal({ equipe, vendedoresHint, defaultOrcamentistaId, onClose, onCreated }) {
  const [titulo, setTitulo] = h.useState("");
  const [vendedor, setVendedor] = h.useState("");
  const [orcamentistaId, setOrcamentistaId] = h.useState(defaultOrcamentistaId || "");
  const [horas, setHoras] = h.useState(4);
  const [unidade, setUnidade] = h.useState("horas");
  const [saving, setSaving] = h.useState(false);
  const [err, setErr] = h.useState("");

  async function handleSave() {
    if (!titulo.trim()) { setErr("Informe um título"); return; }
    if (!orcamentistaId) { setErr("Escolha o orçamentista"); return; }
    if (!horas || horas <= 0) { setErr("Informe um prazo válido"); return; }
    setSaving(true); setErr("");
    try {
      const orcEntry = equipe.find((o) => o.id === orcamentistaId);
      const orcNome = orcEntry ? orcEntry.nome : "";
      const orcEmail = orcEntry ? orcEntry.email : "";
      const horasTotal = unidade === "dias" ? horas * 24 : horas;
      const prazoData = new Date(Date.now() + horasTotal * 3600 * 1000).toISOString().slice(0, 10);

      // 1. Cria o card no kanban orçamento — já em em-progresso pra ir
      //    direto pro fluxo de trabalho (o prazo já foi acordado na criação).
      const created = await sbPost("kanban_cards", {
        dept_id: "orcamento",
        column_id: "em-progresso",
        title: titulo.trim(),
        details: {
          orcamentista_id: orcamentistaId,
          orcamentista_nome: orcNome,
          orcamentista_email: orcEmail,
          vendedor: vendedor.trim() || null,
        },
      });
      const cardRow = Array.isArray(created) ? created[0] : created;

      // 2. Cria a demanda já aceita (com prazo)
      await sbPost("orcamento_demandas", {
        orcamentista_id: orcamentistaId,
        kanban_card_orc_id: cardRow.id,
        titulo: titulo.trim(),
        status: "aceito",
        aceito_em: new Date().toISOString(),
        prazo_horas: horasTotal,
        prazo_unidade: unidade,
        prazo_data: prazoData,
        details: { vendedor_nome: vendedor.trim() || null },
      });

      onCreated && onCreated(orcamentistaId);
      onClose();
    } catch (e) {
      setErr(String(e.message || e));
    } finally { setSaving(false); }
  }

  return c(Modal, { onClose, title: "Novo card de orçamento", width: 540 },
    c("div", { style: { display: "flex", flexDirection: "column", gap: 12 } },
      c("div", null,
        c("div", { style: { color: TEXT_DIM, fontSize: "0.65rem", marginBottom: 4, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" } }, "Título *"),
        c("input", {
          placeholder: "Nome do cliente / obra…", value: titulo,
          onChange: (e) => setTitulo(e.target.value),
          style: { width: "100%", boxSizing: "border-box", background: PANEL, border: `1px solid ${BORDER}`, color: TEXT, padding: "8px 12px", borderRadius: 6, fontSize: "0.8rem" },
        }),
      ),
      c("div", null,
        c("div", { style: { color: TEXT_DIM, fontSize: "0.65rem", marginBottom: 4, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" } }, "Vendedor"),
        c("input", {
          placeholder: "Nome do vendedor (opcional)", value: vendedor,
          onChange: (e) => setVendedor(e.target.value),
          list: "pkt-vend-hints",
          style: { width: "100%", boxSizing: "border-box", background: PANEL, border: `1px solid ${BORDER}`, color: TEXT, padding: "8px 12px", borderRadius: 6, fontSize: "0.8rem" },
        }),
        (vendedoresHint || []).length > 0 && c("datalist", { id: "pkt-vend-hints" },
          ...vendedoresHint.map((v) => c("option", { key: v, value: v })),
        ),
      ),
      c("div", null,
        c("div", { style: { color: TEXT_DIM, fontSize: "0.65rem", marginBottom: 4, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" } }, "Orçamentista *"),
        c("select", {
          value: orcamentistaId, onChange: (e) => setOrcamentistaId(e.target.value),
          style: { width: "100%", boxSizing: "border-box", background: PANEL, border: `1px solid ${BORDER}`, color: TEXT, padding: "8px 12px", borderRadius: 6, fontSize: "0.8rem" },
        },
          c("option", { value: "" }, "— escolher —"),
          ...equipe.filter((o) => o.ativo !== false).map((o) =>
            c("option", { key: o.id, value: o.id }, o.nome + (o.is_gestor ? " (gestor)" : ""))
          ),
        ),
      ),
      c("div", null,
        c("div", { style: { color: TEXT_DIM, fontSize: "0.65rem", marginBottom: 4, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" } }, "Prazo *"),
        c("div", { style: { display: "flex", gap: 8 } },
          c("input", {
            type: "number", min: 1, value: horas,
            onChange: (e) => setHoras(Number(e.target.value)),
            style: { flex: 1, background: PANEL, border: `1px solid ${BORDER}`, color: TEXT, padding: "8px 12px", borderRadius: 6, fontSize: "0.8rem" },
          }),
          c("select", {
            value: unidade, onChange: (e) => setUnidade(e.target.value),
            style: { background: PANEL, border: `1px solid ${BORDER}`, color: TEXT, padding: "8px 12px", borderRadius: 6, fontSize: "0.8rem" },
          },
            c("option", { value: "horas" }, "horas"),
            c("option", { value: "dias" }, "dias"),
          )
        ),
      ),
      err && c("div", { style: { color: RED, fontSize: "0.7rem" } }, err),
      c("div", { style: { display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 8 } },
        c(Btn, { onClick: onClose, color: TEXT_DIM, variant: "ghost" }, "Cancelar"),
        c(Btn, { onClick: handleSave, color: GREEN, disabled: saving }, saving ? "Criando…" : "Criar card"),
      )
    )
  );
}

// ── Countdown regressivo: aceito_em + prazo_horas → tempo restante ─────
// Tick a cada 30s. Cores: verde > 2h, amarelo < 2h, vermelho < 30min, piscando atrasado.
function Countdown({ aceitoEm, prazoHoras }) {
  const [now, setNow] = h.useState(() => Date.now());
  h.useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(id);
  }, []);
  if (!aceitoEm || !prazoHoras) return null;
  const aceitoMs = new Date(aceitoEm).getTime();
  if (isNaN(aceitoMs)) return null;
  const deadlineMs = aceitoMs + Number(prazoHoras) * 3600000;
  const diffMs = deadlineMs - now;
  const absMin = Math.floor(Math.abs(diffMs) / 60000);
  const h_ = Math.floor(absMin / 60);
  const m_ = absMin % 60;
  const overdue = diffMs < 0;
  let txt;
  if (h_ >= 24) {
    const d = Math.floor(h_ / 24);
    const hr = h_ % 24;
    txt = hr > 0 ? `${d}d ${hr}h` : `${d}d`;
  } else if (h_ > 0) {
    txt = m_ > 0 ? `${h_}h ${m_}min` : `${h_}h`;
  } else {
    txt = `${m_}min`;
  }
  let bg, fg, label;
  if (overdue) { bg = `${RED}30`; fg = RED; label = `⏰ Atrasado ${txt}`; }
  else if (diffMs < 30 * 60000) { bg = `${RED}25`; fg = RED; label = `⏱ Restam ${txt}`; }
  else if (diffMs < 2 * 3600000) { bg = `${YELLOW}25`; fg = YELLOW; label = `⏱ Restam ${txt}`; }
  else { bg = `${GREEN}25`; fg = GREEN; label = `⏱ Restam ${txt}`; }
  return c("span", {
    style: {
      background: bg, color: fg, padding: "3px 8px", borderRadius: 10,
      fontWeight: 700, fontSize: "0.7rem",
      animation: overdue ? "pktBlink 1.4s ease-in-out infinite" : undefined,
    },
  }, label);
}

if (typeof document !== "undefined" && !document.getElementById("pkt-countdown-style")) {
  const _s = document.createElement("style");
  _s.id = "pkt-countdown-style";
  _s.textContent = "@keyframes pktBlink{0%,100%{opacity:1}50%{opacity:0.45}}";
  document.head.appendChild(_s);
}

// ── Card (visual igual kanban geral) — opera sobre kanban_card real ────
function CardItem({ card, demanda, orcamentistaNome, onAction, onDragStart, onDragEnd }) {
  const [modal, setModal] = h.useState(null);
  const [detailOpen, setDetailOpen] = h.useState(false);
  const det = card.details || {};
  const colMeta = COLUMN_BY_SLUG[card.column_id];
  const colColor = (colMeta && colMeta.color) || TEXT_DIM;
  const isPending = card.column_id === "solicitacao";

  const vendedorNome = det.vendedor || "";
  const prazoStr = demanda && demanda.prazo_horas
    ? (demanda.prazo_unidade === "dias" ? `${Math.round(demanda.prazo_horas / 24)}d` : `${demanda.prazo_horas}h`)
    : null;

  const subtitlePieces = [];
  if (det.cidade) subtitlePieces.push(String(det.cidade).split(" ").slice(0, 3).join(" "));
  if (det.area_m2) subtitlePieces.push(`${det.area_m2} m²`);
  if (det.produto_interesse) subtitlePieces.push(String(det.produto_interesse).split(",")[0].trim().slice(0, 24));

  // Sintético "demanda" pra passar ao CardDetailModal (que aceita cardId direto agora)
  const parentCardId = det.parent_card_id || card.id;

  return c("div", {
    draggable: true,
    onDragStart: (e) => { e.dataTransfer.effectAllowed = "move"; onDragStart && onDragStart(card); },
    onDragEnd: () => { onDragEnd && onDragEnd(); },
    onClick: (e) => {
      const tgt = e.target;
      if (tgt && tgt.tagName === "BUTTON") return;
      if (tgt && tgt.closest && tgt.closest("button")) return;
      // Abre o MESMO modal nativo do kanban principal de orçamento.
      if (typeof window.__pktOpenCardModal === "function") {
        try { window.__pktOpenCardModal(card); return; } catch (e2) { console.warn("[orc] open fail:", e2); }
      }
      // Fallback: dispatch event (caso 2 ouvintes)
      try { window.dispatchEvent(new CustomEvent("pkt-open-orc-card", { detail: card })); } catch {}
    },
    style: {
      background: "rgba(20,20,22,0.95)",
      border: `1px solid ${BORDER}`,
      borderLeft: `3px solid ${colColor}`,
      borderRadius: 6,
      padding: "10px 11px",
      display: "flex", flexDirection: "column", gap: 6,
      cursor: "pointer",
      transition: "border-color 0.15s, background 0.15s",
      boxShadow: "0 1px 2px rgba(0,0,0,0.2)",
    },
    onMouseEnter: (e) => { e.currentTarget.style.borderColor = colColor + "60"; },
    onMouseLeave: (e) => { e.currentTarget.style.borderColor = BORDER; e.currentTarget.style.borderLeftColor = colColor; },
  },
    c("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 6 } },
      card.obra && c("span", { style: { color: TEXT_DIM, fontSize: "0.5rem", fontFamily: "monospace", letterSpacing: "0.04em" } }, card.obra),
      colMeta && c("span", { style: { fontSize: "0.48rem", padding: "1px 5px", borderRadius: 3, background: `${colColor}25`, color: colColor, fontWeight: 600, whiteSpace: "nowrap", textTransform: "uppercase", letterSpacing: "0.04em" } }, colMeta.label),
    ),
    c("p", { style: { color: TEXT, fontSize: "0.72rem", fontWeight: 700, lineHeight: 1.25, margin: 0, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" } }, card.title || "(sem título)"),
    subtitlePieces.length > 0 && c("p", { style: { color: TEXT_DIM, fontSize: "0.55rem", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, subtitlePieces.join(" · ")),
    c("div", { style: { display: "flex", gap: 6, fontSize: "0.5rem", color: TEXT_DIM, alignItems: "center", flexWrap: "wrap" } },
      vendedorNome && c("span", { style: { background: "rgba(255,255,255,0.05)", padding: "1px 5px", borderRadius: 3 } }, `👤 ${vendedorNome}`),
      (demanda && demanda.aceito_em && demanda.prazo_horas)
        ? c(Countdown, { aceitoEm: demanda.aceito_em, prazoHoras: demanda.prazo_horas })
        : (prazoStr && c("span", { style: { background: `${ACCENT}25`, padding: "3px 8px", borderRadius: 10, color: ACCENT, fontWeight: 700, fontSize: "0.7rem" } }, `⏱ Prazo: ${prazoStr}`)),
    ),
    // Ações por coluna — sempre permite aceitar/editar, mesmo sem demanda
    // (cards podem ter sido criados direto no orçamento, sem demanda associada).
    isPending && c("div", { style: { display: "flex", gap: 4, marginTop: 2 } },
      c(Btn, { onClick: () => setModal("accept"), color: GREEN, size: "sm" },
        demanda && demanda.prazo_horas ? "Editar prazo" : "Aceitar"),
      c(Btn, { onClick: () => setModal("reject"), color: RED, size: "sm", variant: "soft" }, "Recusar"),
    ),
    // Fora da Solicitação: permite preencher/editar o prazo retroativamente
    !isPending && (!demanda || demanda.status !== "recusado") && c("div", { style: { display: "flex", gap: 4, marginTop: 2 } },
      c(Btn, {
        onClick: () => setModal("accept"),
        color: ACCENT, size: "sm", variant: prazoStr ? "ghost" : "soft",
      }, prazoStr ? "Editar prazo" : "+ Prazo"),
    ),
    demanda && demanda.motivo_recusa && c("div", { style: { fontSize: "0.52rem", color: TEXT_DIM, padding: "4px 6px", background: `${RED}15`, borderRadius: 4 } }, `Recusa: ${demanda.motivo_recusa}`),
    modal === "accept" && c(AcceptModal, { demanda, orcamentistaNome, vendedorNome, card, onClose: () => setModal(null), onSaved: onAction }),
    modal === "reject" && c(RejectModal, { demanda, orcamentistaNome, vendedorNome, card, onClose: () => setModal(null), onSaved: onAction }),
    detailOpen && c(CardDetailModal, { cardId: parentCardId, demanda, onClose: () => setDetailOpen(false) }),
  );
}

// ── Kanban pessoal: 7 colunas (mesmas do orcamento principal) ──────────
function KanbanOrcamentista({ orcamentista, cards, demandasByOrc, onReload }) {
  const [dragging, setDragging] = h.useState(null);
  const [dragOverCol, setDragOverCol] = h.useState(null);
  // Drop interceptado: quando arrastam card de Solicitação pra qq outra coluna
  // sem ter aceito, abrimos o AcceptModal pra forçar entrada de prazo antes
  // do move. Resolve o caso de cards que vão pra em-progresso/cálculo/etc
  // sem ninguém registrar quanto tempo vai levar.
  const [pendingAccept, setPendingAccept] = h.useState(null);

  // Demanda lookup por card_orc_id
  const demandaForCard = (cardId) => demandasByOrc.find((d) => d.kanban_card_orc_id === cardId);

  async function handleDrop(colSlug) {
    if (!dragging) return;
    const d = dragging;
    setDragging(null);
    setDragOverCol(null);
    if (d.column_id === colSlug) return;

    // Saindo de "solicitacao" sem ter aceito → força modal de prazo
    if (d.column_id === "solicitacao" && colSlug !== "solicitacao") {
      const dem = demandaForCard(d.id);
      if (dem && (dem.status === "aguarda_aceite" || !dem.prazo_horas)) {
        setPendingAccept({ card: d, demanda: dem, targetCol: colSlug });
        return;
      }
    }

    try {
      await syncCardColumn(d, colSlug, orcamentista.nome);
      onReload && onReload();
    } catch (e) {
      alert("Erro ao mover: " + e.message);
    }
  }

  return c("div", {
    style: {
      display: "grid",
      gridTemplateColumns: `repeat(${ORC_COLUMNS.length}, minmax(160px, 1fr))`,
      gap: 8, marginTop: 12, alignItems: "stretch",
      overflowX: "auto",
      overflowY: "hidden",
      height: "calc(100vh - 240px)",
    },
  },
    ...ORC_COLUMNS.map((col) => {
      const items = cards.filter((c2) => c2.column_id === col.slug);
      return c("div", {
        key: col.slug,
        onDragOver: (e) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; if (dragOverCol !== col.slug) setDragOverCol(col.slug); },
        onDragLeave: () => { if (dragOverCol === col.slug) setDragOverCol(null); },
        onDrop: (e) => { e.preventDefault(); handleDrop(col.slug); },
        style: {
          display: "flex", flexDirection: "column",
          padding: "10px 8px",
          background: dragOverCol === col.slug ? `${col.color}10` : "rgba(255,255,255,0.015)",
          border: dragOverCol === col.slug ? `2px dashed ${col.color}60` : `1px solid ${BORDER}`,
          borderRadius: 8,
          minWidth: 0,
          minHeight: 0,
          height: "100%",
          overflow: "hidden",
          transition: "background 0.15s, border-color 0.15s",
        },
      },
        c("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center", paddingBottom: 6, borderBottom: `2px solid ${col.color}40`, flexShrink: 0 } },
          c("span", { style: { color: TEXT_MED, fontSize: "0.55rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, col.label),
          c("span", { style: { color: col.color, fontSize: "0.65rem", fontWeight: 700, background: `${col.color}20`, padding: "0 6px", borderRadius: 10, minWidth: 22, textAlign: "center", marginLeft: 6 } }, items.length),
        ),
        c("div", { style: { flex: 1, overflowY: "auto", overflowX: "hidden", paddingTop: 8, display: "flex", flexDirection: "column", gap: 8, minHeight: 0 } },
          ...items.map((card) => c(CardItem, {
            key: card.id, card, demanda: demandaForCard(card.id),
            orcamentistaNome: orcamentista.nome,
            onAction: onReload,
            onDragStart: setDragging,
            onDragEnd: () => setDragging(null),
          })),
          items.length === 0 && c("div", { style: { color: TEXT_DIM, fontSize: "0.55rem", textAlign: "center", padding: 16, fontStyle: "italic", opacity: 0.5 } }, "—"),
        ),
      );
    }),
    pendingAccept && c(AcceptModal, {
      demanda: pendingAccept.demanda,
      card: pendingAccept.card,
      orcamentistaNome: orcamentista.nome,
      vendedorNome: (pendingAccept.card.details || {}).vendedor || "",
      targetColumn: pendingAccept.targetCol,
      onClose: () => setPendingAccept(null),
      onSaved: () => { setPendingAccept(null); onReload && onReload(); },
    }),
  );
}

// ── Card grande na grade da equipe (preview de cada orçamentista) ──────
function _fmtPrazo(horas, unidade) {
  if (!horas) return "";
  if (unidade === "dias" || horas >= 24) {
    const d = Math.round(horas / 24);
    return `${d}d`;
  }
  return `${horas}h`;
}

function OrcamentistaCard({ orcamentista, count, onClick, demandasAtivas }) {
  const lista = (demandasAtivas || []).slice(0, 5);
  return c("div", {
    onClick,
    style: {
      background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 10, padding: 16,
      display: "flex", flexDirection: "column", gap: 12, cursor: "pointer",
      transition: "border-color 0.15s, background 0.15s",
    },
    onMouseEnter: (e) => { e.currentTarget.style.borderColor = orcamentista.avatar_color + "60"; },
    onMouseLeave: (e) => { e.currentTarget.style.borderColor = BORDER; },
  },
    c("div", { style: { display: "flex", gap: 12, alignItems: "center" } },
      Avatar(orcamentista.nome, orcamentista.avatar_color, 56),
      c("div", { style: { flex: 1, minWidth: 0 } },
        c("div", { style: { display: "flex", alignItems: "center", gap: 6 } },
          c("h3", { style: { color: TEXT, fontSize: "0.9rem", fontWeight: 600, margin: 0 } }, orcamentista.nome),
          orcamentista.is_gestor && c("span", { style: { fontSize: "0.55rem", padding: "2px 6px", borderRadius: 4, background: `${RED}25`, color: RED, fontWeight: 700, textTransform: "uppercase" } }, "Gestor"),
        ),
        orcamentista.especialidade && c("div", { style: { color: TEXT_DIM, fontSize: "0.65rem", marginTop: 2 } }, orcamentista.especialidade),
      ),
    ),
    c("div", { style: { display: "flex", justifyContent: "space-between", paddingTop: 8, borderTop: `1px solid ${BORDER}` } },
      c("div", null,
        c("div", { style: { color: TEXT_DIM, fontSize: "0.55rem", textTransform: "uppercase", letterSpacing: "0.05em" } }, "Demandas Ativas"),
        c("div", { style: { color: TEXT, fontSize: "1.2rem", fontWeight: 700, marginTop: 2 } }, count.ativas),
      ),
      c("div", { style: { textAlign: "right" } },
        c("div", { style: { color: TEXT_DIM, fontSize: "0.55rem", textTransform: "uppercase", letterSpacing: "0.05em" } }, "Concluídas"),
        c("div", { style: { color: GREEN, fontSize: "1.2rem", fontWeight: 700, marginTop: 2 } }, count.concluidas),
      ),
    ),
    lista.length > 0 && c("div", { style: { paddingTop: 8, borderTop: `1px solid ${BORDER}`, display: "flex", flexDirection: "column", gap: 4 } },
      c("div", { style: { color: TEXT_DIM, fontSize: "0.55rem", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 2 } }, "Aceitos com prazo"),
      ...lista.map((d) => c("div", {
        key: d.id,
        style: { display: "flex", alignItems: "center", gap: 6, fontSize: "0.7rem", color: TEXT },
      },
        c("span", { style: { background: `${ACCENT}25`, color: ACCENT, fontWeight: 700, padding: "2px 7px", borderRadius: 10, fontSize: "0.7rem", whiteSpace: "nowrap", flexShrink: 0 } }, `⏱ ${_fmtPrazo(d.prazo_horas, d.prazo_unidade)}`),
        c("span", { style: { overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: TEXT_MED, flex: 1, minWidth: 0 } }, d.titulo || "(sem título)"),
      )),
      (demandasAtivas || []).length > lista.length && c("div", { style: { color: TEXT_DIM, fontSize: "0.55rem", fontStyle: "italic", marginTop: 2 } }, `+${(demandasAtivas || []).length - lista.length} demanda(s)…`),
    ),
  );
}

// ── Componente principal ─────────────────────────────────────────────────
function EquipeOrcamentoTab() {
  const [equipe, setEquipe] = h.useState([]);
  const [demandas, setDemandas] = h.useState([]);
  const [loading, setLoading] = h.useState(true);
  const [selectedId, setSelectedId] = h.useState(null);
  const [error, setError] = h.useState("");
  const [userEmail, setUserEmail] = h.useState(null);
  const [autoSelected, setAutoSelected] = h.useState(false);
  const [createOpen, setCreateOpen] = h.useState(false);
  const [search, setSearch] = h.useState("");

  const [cards, setCards] = h.useState([]);

  const reload = h.useCallback(async () => {
    setLoading(true); setError("");
    try {
      const [eq, dem, crd] = await Promise.all([
        sbGet("orcamento_equipe?select=*&ativo=eq.true&order=ordem.asc"),
        sbGet("orcamento_demandas?select=*&order=created_at.desc&limit=500"),
        // Cards do kanban orçamento que tenham orcamentista_id setado
        sbGet("kanban_cards?select=id,title,subtitle,obra,responsavel,column_id,tags,details,priority,created_at&dept_id=eq.orcamento&details->>orcamentista_id=not.is.null&order=created_at.desc&limit=500"),
      ]);
      setEquipe(eq); setDemandas(dem); setCards(crd);
    } catch (e) { setError(String(e)); } finally { setLoading(false); }
  }, []);

  h.useEffect(() => { reload(); }, [reload]);

  // Login-based auto-select: orçamentista (não-gestor) vê só o próprio kanban.
  // Gestor (Raniere) e admins (sem match na equipe) veem a grade completa.
  h.useEffect(() => {
    if (autoSelected || !equipe.length) return;
    const email = _currentUserEmail();
    setUserEmail(email);
    if (!email) { setAutoSelected(true); return; }
    const me = equipe.find((o) => (o.email || "").toLowerCase() === email);
    if (me && !me.is_gestor) {
      setSelectedId(me.id);
    }
    setAutoSelected(true);
  }, [equipe, autoSelected]);

  const myEntry = userEmail ? equipe.find((o) => (o.email || "").toLowerCase() === userEmail) : null;
  const isGestor = !myEntry || myEntry.is_gestor;
  const lockedToSelf = myEntry && !myEntry.is_gestor;

  // IMPORTANTE: TODOS os hooks têm que ser chamados ANTES de qualquer early return
  const counts = h.useMemo(() => {
    const m = {};
    for (const o of equipe) {
      const cardsByOrc = cards.filter((c2) => (c2.details || {}).orcamentista_id === o.id);
      m[o.id] = {
        ativas: cardsByOrc.filter((c2) => c2.column_id !== "proposta-aceita" && c2.column_id !== "handoff-com").length,
        concluidas: cardsByOrc.filter((c2) => c2.column_id === "proposta-aceita" || c2.column_id === "handoff-com").length,
      };
    }
    return m;
  }, [equipe, cards]);

  const selected = selectedId ? equipe.find((e) => e.id === selectedId) : null;
  const allSelectedCards = selected ? cards.filter((c2) => (c2.details || {}).orcamentista_id === selectedId) : [];
  // Filtro de busca: título + ambiente (cidade) + vendedor + obra code, case-insensitive
  const searchNorm = search.trim().toLowerCase();
  const selectedCards = searchNorm
    ? allSelectedCards.filter((c2) => {
        const det = c2.details || {};
        const haystack = [
          c2.title, c2.obra, c2.subtitle,
          det.vendedor, det.cidade, det.contato_principal, det.celular,
        ].filter(Boolean).join(" ").toLowerCase();
        return haystack.includes(searchNorm);
      })
    : allSelectedCards;
  const selectedDemandas = selected ? demandas.filter((d) => d.orcamentista_id === selectedId) : [];

  if (loading) {
    return c("div", { style: { padding: 40, textAlign: "center", color: TEXT_DIM } }, "Carregando equipe…");
  }
  if (error) {
    return c("div", { style: { padding: 20, color: RED, fontSize: "0.8rem" } }, `Erro: ${error}`);
  }

  // ── Vista: detalhe de 1 orçamentista (kanban pessoal) ──
  if (selected) {
    const subtituloLbl = searchNorm
      ? `${selectedCards.length} de ${allSelectedCards.length} card(s) — filtrado por "${search.trim()}"`
      : `${allSelectedCards.length} card(s) atribuído(s)`;
    return c("div", { style: { padding: 16 } },
      c("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8, gap: 12, flexWrap: "wrap" } },
        c("div", { style: { display: "flex", gap: 12, alignItems: "center", flex: "0 0 auto" } },
          Avatar(selected.nome, selected.avatar_color, 44),
          c("div", null,
            c("h2", { style: { color: TEXT, fontSize: "1rem", fontWeight: 600, margin: 0 } }, selected.nome),
            c("p", { style: { color: TEXT_DIM, fontSize: "0.65rem", margin: "2px 0 0" } }, subtituloLbl),
          ),
        ),
        c("div", { style: { display: "flex", gap: 8, alignItems: "center", flex: 1, justifyContent: "flex-end", flexWrap: "wrap" } },
          c("div", { style: { position: "relative", flex: "1 1 280px", maxWidth: 360, minWidth: 200 } },
            c("input", {
              type: "text",
              value: search,
              onChange: (e) => setSearch(e.target.value),
              placeholder: "🔍 Buscar card por cliente, vendedor, cidade…",
              style: {
                width: "100%", boxSizing: "border-box",
                background: PANEL, border: `1px solid ${BORDER}`, color: TEXT,
                padding: "7px 32px 7px 12px", borderRadius: 6, fontSize: "0.75rem",
                outline: "none",
              },
            }),
            search && c("button", {
              onClick: () => setSearch(""),
              title: "Limpar busca",
              style: {
                position: "absolute", right: 6, top: "50%", transform: "translateY(-50%)",
                background: "transparent", border: "none", color: TEXT_DIM,
                cursor: "pointer", fontSize: "1rem", padding: 4, lineHeight: 1,
              },
            }, "×"),
          ),
          c(Btn, { onClick: () => setCreateOpen(true), color: GREEN, size: "sm" }, "+ Novo card"),
          c(Btn, { onClick: reload, color: ACCENT, variant: "soft", size: "sm" }, "↻ Atualizar"),
          !lockedToSelf && c(Btn, { onClick: () => setSelectedId(null), color: TEXT_DIM, variant: "ghost" }, "← Equipe"),
        ),
      ),
      c(KanbanOrcamentista, { orcamentista: selected, cards: selectedCards, demandasByOrc: selectedDemandas, onReload: reload }),
      createOpen && c(CreateCardModal, {
        equipe,
        vendedoresHint: Array.from(new Set(cards.map((c2) => (c2.details || {}).vendedor).filter(Boolean))),
        defaultOrcamentistaId: selected.id,
        onClose: () => setCreateOpen(false),
        onCreated: (orcId) => { setCreateOpen(false); setSelectedId(orcId); reload(); },
      }),
    );
  }

  // ── Vista: grade de todos os orçamentistas ──
  return c("div", { style: { padding: 20 } },
    c("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 } },
      c("div", null,
        c("h2", { style: { color: TEXT, fontSize: "1rem", fontWeight: 600, margin: 0 } }, "Equipe de Orçamentistas"),
        c("p", { style: { color: TEXT_DIM, fontSize: "0.65rem", margin: "4px 0 0" } }, `${equipe.length} membros · ${cards.length} cards no pipeline`),
      ),
      c("div", { style: { display: "flex", gap: 8 } },
        c(Btn, { onClick: () => setCreateOpen(true), color: GREEN, size: "sm" }, "+ Novo card"),
        c(Btn, { onClick: reload, color: ACCENT, variant: "soft", size: "sm" }, "↻ Atualizar"),
      ),
    ),
    c("div", { style: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 12 } },
      ...equipe.map((o) => c(OrcamentistaCard, {
        key: o.id, orcamentista: o, count: counts[o.id] || { ativas: 0, concluidas: 0 },
        demandasAtivas: demandas.filter((d) =>
          d.orcamentista_id === o.id &&
          d.prazo_horas &&
          (d.status === "aceito" || d.status === "em_progresso" || d.status === "em-progresso" || d.status === "aguarda_info")
        ),
        onClick: () => setSelectedId(o.id),
      })),
    ),
    createOpen && c(CreateCardModal, {
      equipe,
      vendedoresHint: Array.from(new Set(cards.map((c2) => (c2.details || {}).vendedor).filter(Boolean))),
      onClose: () => setCreateOpen(false),
      onCreated: (orcId) => { setCreateOpen(false); setSelectedId(orcId); reload(); },
    }),
  );
}

export { EquipeOrcamentoTab as E };
