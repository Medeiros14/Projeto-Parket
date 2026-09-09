/**
 * Modal de detalhe do card pra Equipe & Demandas.
 * Quando orçamentista clica no card da demanda, abre esse modal mostrando
 * TODAS as informações que o comercial preencheu — abas Lead/Contato/Projeto/
 * Pagamento/Levantamento/Mensagens, igual ao modal nativo do kanban.
 */
import { R as h } from "./index-DZtetJYP.js";

const SB_URL = "https://hbxpilrxmitvzebluoom.supabase.co";
const SB_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhieHBpbHJ4bWl0dnplYmx1b29tIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI5NDI1MjcsImV4cCI6MjA4ODUxODUyN30.ciZA1H-UvlYG2OPWqrFChj-_ttiFD5W5BmrST-gUJ-0";

const c = h.createElement;
const TEXT = "#fafafa", DIM = "rgba(255,255,255,0.55)", MED = "rgba(255,255,255,0.75)";
const PANEL = "rgba(255,255,255,0.04)", BORDER = "rgba(255,255,255,0.08)";
const ACCENT = "#3B82F6", GREEN = "#10B981", PURPLE = "#8B5CF6";

function _userToken() {
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k || !k.startsWith("sb-") || !k.endsWith("-auth-token")) continue;
      const raw = localStorage.getItem(k);
      if (!raw) continue;
      const parsed = JSON.parse(raw);
      const tok = parsed && (parsed.access_token || (parsed.currentSession && parsed.currentSession.access_token));
      if (tok) return tok;
    }
  } catch (e) {}
  return SB_KEY;
}
async function sbGet(path) {
  const r = await fetch(`${SB_URL}/rest/v1/${path}`, {
    headers: { apikey: SB_KEY, Authorization: `Bearer ${_userToken()}` },
  });
  if (!r.ok) throw new Error(`SB GET ${path}: ${r.status}`);
  return r.json();
}

// Labels amigáveis pros campos do details (mesmo padrão do dept-layout)
const FIELD_LABELS = {
  // Lead/Contato
  nome_completo: "Nome Completo",
  celular: "Celular",
  telefone_comercial: "Telefone Comercial",
  pessoa_contato: "Pessoa de Contato",
  contato_responsavel: "Responsável Contato",
  email: "E-mail",
  outro_email: "E-mail Adicional",
  vendedor: "Vendedor",
  vendedor_telefone: "Telefone Vendedor",
  status_lead: "Status do Lead",
  kommo_id: "ID Kommo",
  funil_vendas: "Funil",
  // Projeto
  endereco: "Endereço",
  endereco_obra: "Endereço da Obra",
  cidade: "Cidade",
  estado: "Estado",
  area_m2: "Área (m²)",
  metragem_estimada: "Metragem Estimada",
  produto_interesse: "Produto de Interesse",
  faixa_investimento: "Faixa de Investimento",
  previsao_inicio: "Previsão de Início",
  primeira_vistoria_data: "1ª Vistoria",
  arquiteto: "Arquiteto",
  arquitetura: "Escritório de Arquitetura",
  // Qualificação
  resumo_qualificacao: "Resumo Qualificação",
  observacoes: "Observações",
  // Pagamento
  orc_valor_total: "Valor Total Orçamento",
  orc_valor_material: "Valor Material",
  orc_valor_mao_obra: "Valor Mão de Obra",
  condicoes_pagamento: "Condições de Pagamento",
  prazo_contratual: "Prazo Contratual",
  prazo_dias_uteis: "Prazo (dias úteis)",
  conta_corrente: "Conta Corrente",
  numero_pedido: "Nº do Pedido",
  // Outros
  data_criada: "Data Criação",
  data_proposta: "Data Proposta",
  grupo_wpp_csv: "Grupo WhatsApp",
  fiscal_responsavel: "Fiscal Responsável",
  status_projeto: "Status Projeto",
};

const TAB_FIELDS = {
  lead: ["nome_completo", "vendedor", "vendedor_telefone", "status_lead", "kommo_id", "funil_vendas", "data_criada"],
  contato: ["celular", "telefone_comercial", "pessoa_contato", "contato_responsavel", "email", "outro_email", "grupo_wpp_csv"],
  projeto: ["endereco_obra", "endereco", "cidade", "estado", "area_m2", "metragem_estimada", "produto_interesse", "previsao_inicio", "primeira_vistoria_data", "arquiteto", "arquitetura", "faixa_investimento"],
  pagamento: ["orc_valor_total", "orc_valor_material", "orc_valor_mao_obra", "condicoes_pagamento", "prazo_contratual", "prazo_dias_uteis", "conta_corrente", "numero_pedido", "data_proposta"],
  qualificacao: ["resumo_qualificacao", "observacoes", "status_projeto", "fiscal_responsavel"],
};

function fmtValue(v) {
  if (v === null || v === undefined || v === "") return "—";
  if (typeof v === "boolean") return v ? "Sim" : "Não";
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}

function FieldRow({ field, value }) {
  return c("div", { style: { display: "flex", flexDirection: "column", gap: 3, padding: "8px 10px", background: PANEL, borderRadius: 6, border: `1px solid ${BORDER}` } },
    c("span", { style: { fontSize: "0.5rem", color: DIM, textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 600 } }, FIELD_LABELS[field] || field),
    c("span", { style: { fontSize: "0.72rem", color: TEXT, wordBreak: "break-word" } }, fmtValue(value)),
  );
}

function FieldGrid({ details, fields }) {
  const filled = fields.filter((f) => details[f] !== null && details[f] !== undefined && details[f] !== "");
  if (filled.length === 0) {
    return c("div", { style: { padding: 30, textAlign: "center", color: DIM, fontSize: "0.7rem", fontStyle: "italic" } }, "Comercial ainda não preencheu nada nessa aba.");
  }
  return c("div", { style: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 8 } },
    ...filled.map((f) => c(FieldRow, { key: f, field: f, value: details[f] })),
  );
}

function LevantamentoTab({ snapshot }) {
  if (!snapshot || !snapshot.servicos || snapshot.servicos.length === 0) {
    return c("div", { style: { padding: 30, textAlign: "center", color: DIM, fontSize: "0.7rem", fontStyle: "italic" } }, "Sem itens de levantamento.");
  }
  return c("div", { style: { display: "flex", flexDirection: "column", gap: 12 } },
    ...snapshot.servicos.map((s, i) => c("div", { key: i, style: { background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 8, padding: 12 } },
      c("h4", { style: { margin: "0 0 8px", color: TEXT, fontSize: "0.78rem", fontWeight: 700 } }, s.nome),
      c("div", { style: { display: "flex", flexDirection: "column", gap: 6 } },
        ...(s.itens || []).map((it, j) => c("div", { key: j, style: { background: "rgba(0,0,0,0.2)", padding: "6px 8px", borderRadius: 4, display: "grid", gridTemplateColumns: "1fr auto auto", gap: 8, alignItems: "center", fontSize: "0.65rem" } },
          c("span", { style: { color: TEXT } }, it.descricao || it.servico || "(sem descrição)"),
          it.metragem_m2 && c("span", { style: { color: DIM, fontFamily: "monospace" } }, `${it.metragem_m2} ${it.unidade || "m²"}`),
          it.preco && c("span", { style: { color: GREEN, fontWeight: 600, fontFamily: "monospace" } }, `R$ ${Number(it.preco).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`),
        )),
      ),
    )),
  );
}

function MensagensTab({ messages }) {
  if (!messages || messages.length === 0) {
    return c("div", { style: { padding: 30, textAlign: "center", color: DIM, fontSize: "0.7rem", fontStyle: "italic" } }, "Sem mensagens registradas.");
  }
  return c("div", { style: { display: "flex", flexDirection: "column", gap: 8 } },
    ...messages.map((m, i) => c("div", { key: i, style: { background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 6, padding: 10 } },
      c("div", { style: { display: "flex", justifyContent: "space-between", marginBottom: 4 } },
        c("span", { style: { color: ACCENT, fontSize: "0.62rem", fontWeight: 700 } }, m.user_name || m.user || "Sistema"),
        c("span", { style: { color: DIM, fontSize: "0.55rem" } }, m.ts ? new Date(m.ts).toLocaleString("pt-BR") : ""),
      ),
      c("p", { style: { color: TEXT, fontSize: "0.7rem", margin: 0, whiteSpace: "pre-wrap" } }, m.msg || ""),
    )),
  );
}

// ════════════════════════════════════════════════════
//  CHAT REALTIME (inline tab)
// ════════════════════════════════════════════════════
function _userInfo() {
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      const raw = k && localStorage.getItem(k);
      if (!raw || raw[0] !== "{") continue;
      try {
        const p = JSON.parse(raw);
        const u = (p && p.user) || (p && p.currentSession && p.currentSession.user);
        if (u && u.email) {
          const name = (u.user_metadata && (u.user_metadata.name || u.user_metadata.full_name)) || u.email.split("@")[0];
          const avatar = name.split(/\s+/).map((s) => s[0]).join("").slice(0, 2).toUpperCase();
          return { name, email: u.email, avatar };
        }
      } catch (e) {}
    }
  } catch (e) {}
  return { name: "Você", email: null, avatar: "VC" };
}

async function _sbPost(table, body) {
  const r = await fetch(`${SB_URL}/rest/v1/${table}`, {
    method: "POST",
    headers: { apikey: SB_KEY, Authorization: `Bearer ${_userToken()}`, "Content-Type": "application/json", Prefer: "return=representation" },
    body: JSON.stringify(body),
  });
  return r.ok ? r.json() : null;
}
async function _sbDelete(table, q) {
  return fetch(`${SB_URL}/rest/v1/${table}?${q}`, { method: "DELETE", headers: { apikey: SB_KEY, Authorization: `Bearer ${_userToken()}` } });
}

function _openChatRealtime(contextId, onInsert) {
  let ws = null, alive = true, ref = 1;
  const topic = "realtime:public:card_chat_messages:context_id=eq." + contextId;
  function nextRef() { return String(ref++); }
  function connect() {
    if (!alive) return;
    const url = SB_URL.replace(/^http/, "ws") + "/realtime/v1/websocket?apikey=" + SB_KEY + "&vsn=1.0.0";
    try { ws = new WebSocket(url); } catch (e) { setTimeout(connect, 2000); return; }
    let hb = null;
    ws.onopen = () => {
      ws.send(JSON.stringify({
        topic, event: "phx_join",
        payload: { config: { postgres_changes: [{ event: "INSERT", schema: "public", table: "card_chat_messages", filter: "context_id=eq." + contextId }], broadcast: { ack: false, self: false }, presence: { key: "" } }, access_token: _userToken() },
        ref: nextRef(),
      }));
      if (hb) clearInterval(hb);
      hb = setInterval(() => { if (ws && ws.readyState === 1) ws.send(JSON.stringify({ topic: "phoenix", event: "heartbeat", payload: {}, ref: nextRef() })); }, 25000);
    };
    ws.onmessage = (ev) => {
      try {
        const data = JSON.parse(ev.data);
        if (data.event === "postgres_changes" && data.payload && data.payload.data) {
          const rec = data.payload.data.record;
          if (rec && String(rec.context_id) === String(contextId)) onInsert(rec);
        }
      } catch (e) {}
    };
    ws.onclose = () => { if (hb) clearInterval(hb); if (alive) setTimeout(connect, 2000); };
    ws.onerror = () => { try { ws.close(); } catch (e) {} };
  }
  connect();
  return () => { alive = false; try { ws && ws.close(); } catch (e) {} };
}

function _fmtTimeChat(iso) {
  try {
    const d = new Date(iso), today = new Date();
    const same = d.toDateString() === today.toDateString();
    return same
      ? d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
      : d.toLocaleDateString("pt-BR") + " " + d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  } catch (e) { return iso; }
}

function ChatTab({ contextId }) {
  const [msgs, setMsgs] = h.useState([]);
  const [input, setInput] = h.useState("");
  const [sending, setSending] = h.useState(false);
  const me = _userInfo();
  const bottomRef = h.useRef(null);

  h.useEffect(() => {
    if (!contextId) return;
    sbGet(`card_chat_messages?context_id=eq.${contextId}&select=*&order=created_at.asc&limit=500`).then((data) => setMsgs(data || []));
    const close = _openChatRealtime(contextId, (rec) => {
      setMsgs((prev) => prev.some((m) => m.id === rec.id) ? prev : [...prev, rec].sort((a, b) => new Date(a.created_at) - new Date(b.created_at)));
    });
    return close;
  }, [contextId]);

  h.useEffect(() => { if (bottomRef.current) bottomRef.current.scrollIntoView({ behavior: "smooth" }); }, [msgs.length]);

  async function send() {
    const v = input.trim();
    if (!v || sending) return;
    setSending(true);
    setInput("");
    const rows = await _sbPost("card_chat_messages", {
      context_id: contextId, context_type: "kanban_card",
      user_name: me.name, user_email: me.email, avatar: me.avatar, msg: v,
    });
    setSending(false);
    if (rows && rows[0]) setMsgs((prev) => prev.some((m) => m.id === rows[0].id) ? prev : [...prev, rows[0]]);
  }

  return c("div", { style: { display: "flex", flexDirection: "column", height: "60vh", gap: 10 } },
    c("div", { style: { fontSize: "0.55rem", color: "#10B981", textTransform: "uppercase", letterSpacing: "0.15em", flexShrink: 0 } }, "🟢 Realtime · Todos os setores veem ao vivo"),
    c("div", { style: { flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 8, paddingRight: 4 } },
      msgs.length === 0
        ? c("div", { style: { color: DIM, fontSize: "0.7rem", textAlign: "center", padding: 30 } }, "Sem mensagens. Inicie a conversa entre setores.")
        : msgs.map((m) => {
            const mine = me.email && m.user_email === me.email;
            return c("div", { key: m.id, style: { display: "flex", gap: 8, flexDirection: mine ? "row-reverse" : "row" } },
              c("div", { style: { width: 28, height: 28, borderRadius: 14, background: "rgba(184,170,154,0.2)", color: "#B8AA9A", fontSize: "0.55rem", fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 } }, m.avatar || "?"),
              c("div", { style: { maxWidth: "75%", padding: "8px 12px", borderRadius: 10, background: mine ? "rgba(184,170,154,0.18)" : "rgba(255,255,255,0.04)", border: `1px solid ${mine ? "rgba(184,170,154,0.35)" : BORDER}` } },
                c("div", { style: { display: "flex", gap: 8, marginBottom: 3 } },
                  c("span", { style: { fontSize: "0.55rem", color: "#B8AA9A", fontWeight: 600 } }, m.user_name || "—"),
                  c("span", { style: { fontSize: "0.5rem", color: DIM } }, _fmtTimeChat(m.created_at)),
                ),
                c("div", { style: { fontSize: "0.7rem", color: "#ddd", whiteSpace: "pre-wrap", lineHeight: 1.5 } }, m.msg || ""),
              ),
            );
          }),
      c("div", { ref: bottomRef }),
    ),
    c("div", { style: { display: "flex", gap: 6, flexShrink: 0 } },
      c("input", {
        value: input, onChange: (e) => setInput(e.target.value),
        onKeyDown: (e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } },
        placeholder: "Mensagem pra equipe…",
        style: { flex: 1, background: "rgba(255,255,255,0.04)", border: `1px solid ${BORDER}`, color: TEXT, padding: "9px 12px", borderRadius: 8, fontSize: "0.7rem", outline: "none" },
      }),
      c("button", {
        onClick: send, disabled: sending,
        style: { background: "#B8AA9A", color: "#000", border: "none", borderRadius: 8, padding: "9px 18px", cursor: sending ? "default" : "pointer", fontWeight: 700, fontSize: "0.7rem", opacity: sending ? 0.6 : 1 },
      }, "Enviar"),
    ),
  );
}

// ════════════════════════════════════════════════════
//  ANEXOS & LINKS (inline tab)
// ════════════════════════════════════════════════════
const DOC_TIPOS = [
  { v: "link", l: "Link / URL", emoji: "🔗" },
  { v: "pdf", l: "PDF", emoji: "📄" },
  { v: "dwg", l: "DWG (CAD)", emoji: "📐" },
  { v: "imagem", l: "Imagem", emoji: "🖼️" },
  { v: "proposta", l: "Proposta", emoji: "💰" },
  { v: "projeto", l: "Projeto Técnico", emoji: "🛠️" },
  { v: "contrato", l: "Contrato", emoji: "📋" },
  { v: "medicao", l: "Medição", emoji: "📏" },
  { v: "nf", l: "Nota Fiscal", emoji: "🧾" },
  { v: "outro", l: "Outro", emoji: "📎" },
];

function AnexosTab({ contextId }) {
  const [docs, setDocs] = h.useState([]);
  const [nome, setNome] = h.useState("");
  const [tipo, setTipo] = h.useState("link");
  const [url, setUrl] = h.useState("");
  const [saving, setSaving] = h.useState(false);
  const me = _userInfo();

  function refresh() {
    if (!contextId) return;
    sbGet(`card_documentos?context_id=eq.${contextId}&select=*&order=created_at.desc&limit=200`).then((d) => setDocs(d || []));
  }
  h.useEffect(refresh, [contextId]);

  async function add() {
    const n = (nome || "").trim();
    let u = (url || "").trim();
    if (!n || !u) { alert("Preencha nome e URL"); return; }
    if (!/^https?:\/\//i.test(u)) u = "https://" + u;
    setSaving(true);
    await _sbPost("card_documentos", { context_id: contextId, nome: n, tipo, url: u, uploaded_by_name: me.name, uploaded_by_email: me.email });
    setNome(""); setUrl(""); setSaving(false);
    refresh();
  }
  async function del(id) {
    if (!confirm("Remover este anexo/link?")) return;
    await _sbDelete("card_documentos", "id=eq." + id);
    refresh();
  }

  const emoji = (t) => (DOC_TIPOS.find((x) => x.v === t) || { emoji: "📎" }).emoji;
  const label = (t) => (DOC_TIPOS.find((x) => x.v === t) || { l: t }).l;

  return c("div", { style: { display: "flex", flexDirection: "column", gap: 14 } },
    // form de adição
    c("div", { style: { background: "rgba(184,170,154,0.04)", border: `1px solid ${BORDER}`, borderRadius: 10, padding: 12, display: "flex", flexDirection: "column", gap: 8 } },
      c("div", { style: { display: "grid", gridTemplateColumns: "1fr 160px", gap: 8 } },
        c("input", { placeholder: "Nome (ex: Planta baixa final)", value: nome, onChange: (e) => setNome(e.target.value), style: { background: "rgba(255,255,255,0.04)", border: `1px solid ${BORDER}`, color: TEXT, padding: "8px 10px", borderRadius: 6, fontSize: "0.7rem", outline: "none" } }),
        c("select", { value: tipo, onChange: (e) => setTipo(e.target.value), style: { background: "rgba(255,255,255,0.04)", border: `1px solid ${BORDER}`, color: TEXT, padding: "8px 10px", borderRadius: 6, fontSize: "0.7rem", outline: "none" } },
          ...DOC_TIPOS.map((t) => c("option", { key: t.v, value: t.v }, `${t.emoji} ${t.l}`)),
        ),
      ),
      c("input", { placeholder: "URL — Drive, Dropbox, link público, etc.", value: url, onChange: (e) => setUrl(e.target.value), onKeyDown: (e) => e.key === "Enter" && add(), style: { background: "rgba(255,255,255,0.04)", border: `1px solid ${BORDER}`, color: TEXT, padding: "8px 10px", borderRadius: 6, fontSize: "0.7rem", outline: "none" } }),
      c("button", { onClick: add, disabled: saving, style: { background: "#B8AA9A", color: "#000", border: "none", borderRadius: 6, padding: "9px 14px", cursor: saving ? "default" : "pointer", fontWeight: 700, fontSize: "0.7rem", opacity: saving ? 0.6 : 1 } }, "+ Adicionar anexo / link"),
    ),
    // lista
    docs.length === 0
      ? c("div", { style: { color: DIM, fontSize: "0.7rem", textAlign: "center", padding: 24, fontStyle: "italic" } }, "Nenhum anexo/link ainda.")
      : c("div", { style: { display: "flex", flexDirection: "column", gap: 8 } },
          ...docs.map((d) => c("div", { key: d.id, style: { display: "flex", gap: 10, alignItems: "center", padding: "10px 12px", background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 8 } },
            c("div", { style: { width: 32, height: 32, borderRadius: 8, background: "rgba(184,170,154,0.12)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1rem", flexShrink: 0 } }, emoji(d.tipo)),
            c("div", { style: { flex: 1, minWidth: 0 } },
              c("div", { style: { fontSize: "0.72rem", color: TEXT, fontWeight: 600, textOverflow: "ellipsis", whiteSpace: "nowrap", overflow: "hidden" } }, d.nome || "—"),
              c("div", { style: { fontSize: "0.5rem", color: DIM, marginTop: 2, textTransform: "uppercase", letterSpacing: "0.08em" } }, label(d.tipo) + (d.uploaded_by_name ? " · " + d.uploaded_by_name : "")),
            ),
            c("a", { href: d.url, target: "_blank", rel: "noopener", style: { background: "rgba(184,170,154,0.15)", color: "#B8AA9A", border: "1px solid rgba(184,170,154,0.3)", borderRadius: 6, padding: "5px 10px", fontSize: "0.6rem", textDecoration: "none" } }, "Abrir ↗"),
            c("button", { onClick: () => del(d.id), style: { background: "transparent", border: "none", color: DIM, cursor: "pointer", fontSize: "0.8rem", padding: 4 } }, "🗑"),
          )),
        ),
  );
}

function CardDetailModal({ cardId, demanda, onClose }) {
  const [card, setCard] = h.useState(null);
  const [snapshot, setSnapshot] = h.useState(null);
  const [messages, setMessages] = h.useState([]);
  const [tab, setTab] = h.useState("lead");
  const [loading, setLoading] = h.useState(true);
  const [err, setErr] = h.useState("");

  // Expõe cardId pro card-chat-realtime-pkt1.js + card-docs-pkt1.js
  // injetarem os botões flutuantes "💬 Chat" e "📎 Anexos" usando esse card_id
  // como context_id (mesmo do chat do comercial).
  h.useEffect(() => {
    window.__pktCurrentOrcamentoCardId = cardId;
    return () => {
      if (window.__pktCurrentOrcamentoCardId === cardId) {
        window.__pktCurrentOrcamentoCardId = null;
      }
    };
  }, [cardId]);

  h.useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [cardArr, lvArr, msgArr] = await Promise.all([
          sbGet(`kanban_cards?select=id,title,subtitle,obra,responsavel,dept_id,column_id,tags,details,description&id=eq.${cardId}&limit=1`),
          sbGet(`levantamento_versoes?select=snapshot,created_at,resumo&card_id=eq.${cardId}&order=created_at.desc&limit=1`),
          sbGet(`kanban_card_messages?select=*&card_id=eq.${cardId}&order=ts.desc&limit=50`).catch(() => []),
        ]);
        if (!alive) return;
        if (!cardArr || cardArr.length === 0) {
          setErr("Card original não encontrado");
        } else {
          setCard(cardArr[0]);
        }
        setSnapshot(lvArr && lvArr[0] ? lvArr[0].snapshot : null);
        setMessages(msgArr || []);
      } catch (e) {
        if (alive) setErr(String(e.message || e));
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [cardId]);

  const tabs = [
    { id: "lead", label: "Lead" },
    { id: "contato", label: "Contato" },
    { id: "projeto", label: "Projeto" },
    { id: "qualificacao", label: "Qualificação" },
    { id: "pagamento", label: "Pagamento" },
    { id: "levantamento", label: "Levantamento" },
    { id: "mensagens", label: "WhatsApp" },
    { id: "chat", label: "💬 Chat" },
    { id: "anexos", label: "📎 Anexos" },
  ];

  return c("div", {
    onClick: onClose,
    style: { position: "fixed", inset: 0, background: "rgba(0,0,0,0.82)", zIndex: 60, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 },
  }, c("div", {
    onClick: (e) => e.stopPropagation(),
    style: { background: "#0d0d0d", border: `1px solid ${BORDER}`, borderRadius: 12, width: "100%", maxWidth: 900, maxHeight: "90vh", display: "flex", flexDirection: "column" },
  },
    // Header
    c("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", padding: 18, borderBottom: `1px solid ${BORDER}` } },
      c("div", { style: { flex: 1, minWidth: 0 } },
        c("h2", { style: { color: TEXT, fontSize: "1rem", fontWeight: 700, margin: "0 0 4px" } }, card ? card.title : "Carregando..."),
        c("div", { style: { display: "flex", gap: 10, fontSize: "0.62rem", color: DIM } },
          card && card.obra && c("span", { style: { fontFamily: "monospace" } }, card.obra),
          demanda && demanda.details && demanda.details.vendedor_nome && c("span", null, `👤 ${demanda.details.vendedor_nome}`),
          demanda && demanda.prazo_horas && c("span", { style: { color: ACCENT } }, `⏱ ${demanda.prazo_unidade === "dias" ? Math.round(demanda.prazo_horas / 24) + "d" : demanda.prazo_horas + "h"}`),
        ),
      ),
      c("button", { onClick: onClose, style: { background: "transparent", border: "none", color: DIM, fontSize: "1.4rem", cursor: "pointer", padding: 0, lineHeight: 1, marginLeft: 12 } }, "×"),
    ),
    // Tabs
    c("div", { style: { display: "flex", gap: 2, padding: "8px 18px", borderBottom: `1px solid ${BORDER}`, overflowX: "auto" } },
      ...tabs.map((t) => c("button", {
        key: t.id, onClick: () => setTab(t.id),
        style: {
          padding: "6px 12px", fontSize: "0.65rem", fontWeight: 600,
          background: tab === t.id ? `${ACCENT}20` : "transparent",
          color: tab === t.id ? ACCENT : DIM,
          border: tab === t.id ? `1px solid ${ACCENT}40` : "1px solid transparent",
          borderRadius: 6, cursor: "pointer", whiteSpace: "nowrap",
        },
      }, t.label)),
    ),
    // Body
    c("div", { style: { flex: 1, overflow: "auto", padding: 18 } },
      loading && c("div", { style: { textAlign: "center", color: DIM, padding: 40 } }, "Carregando…"),
      err && c("div", { style: { color: "#EF4444", padding: 20 } }, `Erro: ${err}`),
      !loading && !err && card && tab !== "levantamento" && tab !== "mensagens" && tab !== "chat" && tab !== "anexos" && c(FieldGrid, { details: card.details || {}, fields: TAB_FIELDS[tab] || [] }),
      !loading && !err && tab === "levantamento" && c(LevantamentoTab, { snapshot }),
      !loading && !err && tab === "mensagens" && c(MensagensTab, { messages }),
      !loading && !err && tab === "chat" && c(ChatTab, { contextId: cardId }),
      !loading && !err && tab === "anexos" && c(AnexosTab, { contextId: cardId }),
    ),
  ));
}

export { CardDetailModal as D };
