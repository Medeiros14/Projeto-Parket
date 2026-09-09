/**
 * CEO Aprovações — chunk hotpatch Parket (pkt2)
 * No /ceo-dashboard, injeta uma ABA nova "✓ Aprovação (N)" no menu de abas,
 * posicionada logo após "📊 Projetos". Click → abre overlay com a fila de
 * propostas pendentes, com botões Aprovar/Rejeitar funcionando direto via API.
 *
 * pkt2:
 *  - Modal de REJEIÇÃO custom (textarea, em vez de prompt() do navegador)
 *  - Botão "💬 Dúvida" novo: comentário aberto que vai pro chat do card
 *  - Comentários e rejeições salvos em card_chat_messages com user_name
 *    prefixado "🟡 CEO" + msg prefixada [REJEIÇÃO]/[DÚVIDA] pra destaque visual.
 */
(function () {
  if (typeof window === "undefined") return;
  if (window.__pktCeoAprovLoaded) return;
  window.__pktCeoAprovLoaded = true;

  const SB_URL = "https://hbxpilrxmitvzebluoom.supabase.co";
  const SB_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhieHBpbHJ4bWl0dnplYmx1b29tIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI5NDI1MjcsImV4cCI6MjA4ODUxODUyN30.ciZA1H-UvlYG2OPWqrFChj-_ttiFD5W5BmrST-gUJ-0";
  const API = "https://core.parket.works";
  const REFRESH_MS = 60_000;
  const WA_URL = "https://conect.parket.works";
  const WA_KEY = "4eab105201410d6865b86dca76ee9fa3";
  const WA_INSTANCE = "Parket";
  const WA_GROUP = "120363425314205066@g.us"; // Parket — Orçamentos

  // Lookup do telefone do orçamentista por primeiro nome
  async function lookupOrcamentistaPhone(nomeCompleto) {
    if (!nomeCompleto) return null;
    const firstName = String(nomeCompleto).trim().split(/\s+/)[0].toLowerCase();
    try {
      const r = await fetch(SB_URL + "/rest/v1/orcamento_notify_phones?nome_key=eq." + encodeURIComponent(firstName) + "&ativo=eq.true&select=telefone&limit=1", {
        headers: { apikey: SB_KEY },
      });
      const rows = await r.json();
      if (Array.isArray(rows) && rows[0] && rows[0].telefone) return String(rows[0].telefone);
    } catch (e) { console.warn("[lookup-phone]", e); }
    return null;
  }

  async function waNotifyGroup(text, mentionPhone) {
    try {
      // Prefix com @<phone> no texto + array `mentioned` no payload pro Evolution destacar
      const body = { number: WA_GROUP };
      if (mentionPhone) {
        body.text = "@" + mentionPhone + " " + text;
        body.mentioned = [mentionPhone];
      } else {
        body.text = text;
      }
      await fetch(WA_URL + "/message/sendText/" + WA_INSTANCE, {
        method: "POST",
        headers: { apikey: WA_KEY, "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
    } catch (e) { console.warn("[wa-notify-group]", e); }
  }

  let lastCount = 0;

  function getUserEmail() {
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        const raw = k && localStorage.getItem(k);
        if (!raw || (raw[0] !== "{" && raw[0] !== "[")) continue;
        let p; try { p = JSON.parse(raw); } catch { continue; }
        const e = (p && p.user && p.user.email) || (p && p.currentSession && p.currentSession.user && p.currentSession.user.email) || null;
        if (e) return e.toLowerCase();
      }
    } catch {}
    return null;
  }
  function getUserNome() {
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        const raw = k && localStorage.getItem(k);
        if (!raw || (raw[0] !== "{" && raw[0] !== "[")) continue;
        let p; try { p = JSON.parse(raw); } catch { continue; }
        const m = (p && p.user && p.user.user_metadata) || {};
        if (m.full_name || m.name) return m.full_name || m.name;
      }
    } catch {}
    return null;
  }

  async function fetchCount() {
    try {
      const r = await fetch(
        `${SB_URL}/rest/v1/kanban_cards?select=id&dept_id=eq.orcamento&column_id=eq.analise-douglas`,
        { headers: { apikey: SB_KEY, Prefer: "count=exact" } }
      );
      const cr = r.headers.get("content-range") || "";
      const m = cr.match(/\/(\d+)$/);
      if (m) return parseInt(m[1], 10);
      const arr = await r.json();
      return Array.isArray(arr) ? arr.length : 0;
    } catch { return 0; }
  }

  function findTabBar() {
    const buttons = document.querySelectorAll("button");
    for (const b of buttons) {
      const tx = (b.textContent || "").trim();
      if (tx === "📊 Projetos" || tx.startsWith("📊 Projetos")) {
        return { bar: b.parentElement, projBtn: b };
      }
    }
    return null;
  }

  function buildTabButton(count, refBtn) {
    const tab = document.createElement("button");
    tab.id = "pkt-ceo-aprov-tab";
    if (refBtn) {
      tab.className = refBtn.className || "";
      const inline = refBtn.getAttribute("style") || "";
      tab.setAttribute("style", inline);
      tab.style.opacity = "1";
    }
    tab.innerHTML =
      '<span style="display:inline-flex;align-items:center;gap:6px">✓ Aprovação' +
      (count > 0 ? ' <span style="background:' + (count >= 5 ? '#EF4444' : '#D4A853') + ';color:#000;font-size:10px;font-weight:800;padding:1px 7px;border-radius:10px;line-height:1.3">' + count + '</span>' : '') +
      '</span>';
    tab.onclick = (ev) => { ev.preventDefault(); ev.stopPropagation(); abrirOverlay(); };
    return tab;
  }

  function ensureTab() {
    const isCEO = /^\/ceo-dashboard(\/|$)/.test(location.pathname);
    if (!isCEO) {
      const old = document.getElementById("pkt-ceo-aprov-tab");
      if (old) old.remove();
      return;
    }
    const found = findTabBar();
    if (!found) return;
    const existing = document.getElementById("pkt-ceo-aprov-tab");
    if (existing) {
      existing.innerHTML =
        '<span style="display:inline-flex;align-items:center;gap:6px">✓ Aprovação' +
        (lastCount > 0 ? ' <span style="background:' + (lastCount >= 5 ? '#EF4444' : '#D4A853') + ';color:#000;font-size:10px;font-weight:800;padding:1px 7px;border-radius:10px;line-height:1.3">' + lastCount + '</span>' : '') +
        '</span>';
      if (existing.previousElementSibling !== found.projBtn) {
        found.projBtn.parentNode.insertBefore(existing, found.projBtn.nextSibling);
      }
      return;
    }
    const tab = buildTabButton(lastCount, found.projBtn);
    found.projBtn.parentNode.insertBefore(tab, found.projBtn.nextSibling);
  }

  async function refresh() {
    lastCount = await fetchCount();
    ensureTab();
  }

  let pendentesCache = null;
  let chatCountsCache = {};
  let chatLatestCache = {};
  let _ceoRefreshTimer = null;

  async function fetchPendentes() {
    try {
      const r = await fetch(`${API}/api/orcamento/aprovacao/pendentes`);
      return r.ok ? await r.json() : { items: [] };
    } catch { return { items: [] }; }
  }

  async function fetchChatCounts(cardIds) {
    if (!cardIds.length) return { counts: {}, latest: {} };
    const counts = {};
    const latest = {};
    try {
      const reqs = cardIds.map(id =>
        Promise.all([
          fetch(SB_URL + "/rest/v1/card_chat_messages?context_id=eq." + id + "&select=id", {
            headers: { apikey: SB_KEY, Prefer: "count=exact" },
          }).then(r => {
            const cr = r.headers.get("content-range") || "";
            const m = cr.match(/\/(\d+)$/);
            counts[id] = m ? parseInt(m[1], 10) : 0;
          }).catch(() => { counts[id] = 0; }),
          fetch(SB_URL + "/rest/v1/card_chat_messages?context_id=eq." + id + "&select=created_at,user_email&order=created_at.desc&limit=1", {
            headers: { apikey: SB_KEY },
          }).then(r => r.json()).then(rows => {
            if (Array.isArray(rows) && rows[0]) latest[id] = { created_at: rows[0].created_at, user_email: rows[0].user_email };
          }).catch(() => {}),
        ])
      );
      await Promise.all(reqs);
    } catch (e) { console.warn("[chat-counts]", e); }
    return { counts, latest };
  }

  function getLastSeenChat() {
    try { return JSON.parse(localStorage.getItem("__pkt_chat_last_seen") || "{}"); } catch (_) { return {}; }
  }
  function hasUnreadFor(cardId) {
    const latest = chatLatestCache[cardId];
    if (!latest || !latest.created_at) return false;
    const me = (getUserEmail() || "").toLowerCase();
    // Própria msg = considerada lida no momento do envio
    if (latest.user_email && me && String(latest.user_email).toLowerCase() === me) return false;
    const seen = getLastSeenChat();
    const lastReadIso = seen[cardId] || "1970-01-01T00:00:00Z";
    return new Date(latest.created_at) > new Date(lastReadIso);
  }

  function fmtSince(iso) {
    const ms = Date.now() - new Date(iso).getTime();
    if (ms < 60000) return "agora";
    const m = Math.floor(ms / 60000);
    if (m < 60) return m + "min";
    const h = Math.floor(m / 60);
    if (h < 48) return h + "h";
    return Math.floor(h / 24) + "d";
  }

  // Pulse animation pra botão Resposta NOVA
  (function () {
    if (document.getElementById("__pkt_ceo_pulse_css")) return;
    const s = document.createElement("style");
    s.id = "__pkt_ceo_pulse_css";
    s.textContent = "@keyframes __pktCeoPulse{0%,100%{box-shadow:0 0 0 0 rgba(239,68,68,0.55);transform:scale(1)}50%{box-shadow:0 0 0 6px rgba(239,68,68,0);transform:scale(1.04)}}";
    (document.head || document.body).appendChild(s);
  })();

  async function abrirOverlay() {
    if (document.getElementById("pkt-ceo-aprov-overlay")) return;
    const overlay = document.createElement("div");
    overlay.id = "pkt-ceo-aprov-overlay";
    Object.assign(overlay.style, {
      position: "fixed", inset: "0", background: "rgba(0,0,0,0.92)",
      zIndex: 999999, display: "flex", flexDirection: "column",
      fontFamily: "system-ui, sans-serif", color: "#fff",
    });
    overlay.innerHTML =
      '<div style="background:#0A0A0A;border-bottom:1px solid rgba(212,168,83,0.3);padding:16px 24px;display:flex;align-items:center;justify-content:space-between;gap:16px">' +
        '<div><div style="font-size:0.6rem;color:#D4A853;text-transform:uppercase;letter-spacing:0.12em;font-weight:700">Análise Douglas</div>' +
        '<h2 style="margin:2px 0 0;font-size:1.15rem;color:#fafafa;font-weight:700">Fila de Aprovação</h2></div>' +
        '<button id="pkt-overlay-close" style="background:transparent;border:1px solid rgba(255,255,255,0.2);color:#fff;padding:7px 14px;border-radius:6px;cursor:pointer;font-size:13px">✕ Fechar</button>' +
      '</div>' +
      '<div id="pkt-overlay-body" style="flex:1;overflow-y:auto;padding:24px;display:flex;flex-direction:column;gap:14px;max-width:1100px;width:100%;margin:0 auto">' +
      '<div style="text-align:center;color:rgba(255,255,255,0.5);padding:40px">Carregando…</div></div>';
    document.body.appendChild(overlay);
    document.getElementById("pkt-overlay-close").onclick = () => overlay.remove();
    overlay.onclick = (ev) => { if (ev.target === overlay) overlay.remove(); };

    const data = await fetchPendentes();
    pendentesCache = data.items || [];
    const ids = pendentesCache.map(p => p.card && p.card.id).filter(Boolean);
    const cc = await fetchChatCounts(ids);
    chatCountsCache = cc.counts || {};
    chatLatestCache = cc.latest || {};
    renderLista();
    // Refresh enquanto overlay aberto pra pegar respostas do orçamentista
    if (_ceoRefreshTimer) clearInterval(_ceoRefreshTimer);
    _ceoRefreshTimer = setInterval(async () => {
      const ov = document.getElementById("pkt-ceo-aprov-overlay");
      if (!ov) { clearInterval(_ceoRefreshTimer); _ceoRefreshTimer = null; return; }
      const ids2 = (pendentesCache || []).map(p => p.card && p.card.id).filter(Boolean);
      const cc2 = await fetchChatCounts(ids2);
      chatCountsCache = cc2.counts || {};
      chatLatestCache = cc2.latest || {};
      if (viewState === "lista") renderLista();
    }, 12000);
  }

  let viewState = "lista";
  let propostaAberta = null;

  function renderLista() {
    const body = document.getElementById("pkt-overlay-body");
    if (!body) return;
    viewState = "lista";
    propostaAberta = null;
    if (pendentesCache.length === 0) {
      body.innerHTML = '<div style="text-align:center;color:rgba(255,255,255,0.55);padding:60px"><div style="font-size:2.4rem;margin-bottom:10px">✓</div><div style="font-size:1rem;font-weight:600">Fila zerada</div><div style="font-size:0.8rem;margin-top:4px">Nenhuma proposta pendente de aprovação.</div></div>';
      return;
    }
    body.innerHTML = "";
    pendentesCache.forEach((item) => {
      const card = document.createElement("div");
      Object.assign(card.style, {
        background: "#0A0A0A", border: "1px solid rgba(255,255,255,0.08)",
        borderRadius: "10px", padding: "16px 18px",
      });
      const obraTag = item.card && item.card.obra ? '<span style="font-size:10px;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.08);padding:2px 7px;border-radius:4px;color:rgba(255,255,255,0.6)">' + item.card.obra + '</span> ' : '';
      const histTag = item.historico && item.historico.length > 0
        ? ' · <span style="color:#F59E0B">' + item.historico.length + 'ª análise</span>' : '';
      card.innerHTML =
        '<div style="display:flex;justify-content:space-between;gap:12px;margin-bottom:10px">' +
          '<div style="flex:1;min-width:0">' +
            '<div style="font-size:15px;font-weight:700;color:#fff;margin-bottom:4px">' + (item.cliente || "—") + '</div>' +
            '<div style="font-size:11px;color:rgba(255,255,255,0.55)">' + obraTag +
              'Há ' + fmtSince(item.card.updated_at || item.card.created_at) + histTag +
            '</div>' +
          '</div>' +
        '</div>' +
        '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;font-size:12px;color:rgba(255,255,255,0.65);margin-bottom:14px">' +
          '<div>Vendedor: <b style="color:#fff">' + (item.vendedor || "—") + '</b></div>' +
          '<div>Orçamentista: <b style="color:#fff">' + (item.orcamentista || "—") + '</b></div>' +
        '</div>' +
        '<div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">' +
          (item.proposta_link
            ? '<button data-act="ver" data-id="' + item.card.id + '" style="padding:7px 15px;border-radius:6px;background:rgba(212,168,83,0.18);border:1px solid rgba(212,168,83,0.5);color:#D4A853;cursor:pointer;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.05em">Ver Proposta</button>'
            : '<span style="font-size:11px;color:#F59E0B">⚠ Sem proposta vinculada</span>') +
          (chatCountsCache[item.card.id] > 0
            ? (hasUnreadFor(item.card.id)
                ? '<button data-act="conversa" data-id="' + item.card.id + '" title="Mensagem nova — orçamentista respondeu" style="padding:7px 13px;border-radius:6px;background:rgba(239,68,68,0.22);border:1.5px solid #EF4444;color:#fff;cursor:pointer;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;animation:__pktCeoPulse 1.4s ease-in-out infinite;box-shadow:0 0 0 0 rgba(239,68,68,0.6)">💬 Resposta NOVA <span style="background:#fff;color:#EF4444;padding:1px 7px;border-radius:8px;margin-left:5px;font-size:10px;font-weight:800">' + chatCountsCache[item.card.id] + '</span></button>'
                : '<button data-act="conversa" data-id="' + item.card.id + '" title="Ver thread completa" style="padding:7px 13px;border-radius:6px;background:rgba(168,85,247,0.18);border:1px solid rgba(168,85,247,0.5);color:#A855F7;cursor:pointer;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.05em">💬 Conversa <span style="background:#A855F7;color:#fff;padding:1px 6px;border-radius:8px;margin-left:4px;font-size:10px">' + chatCountsCache[item.card.id] + '</span></button>')
            : '') +
          '<div style="flex:1"></div>' +
          '<button data-act="duvida" data-id="' + item.card.id + '" style="padding:7px 15px;border-radius:6px;background:rgba(59,130,246,0.18);border:1px solid rgba(59,130,246,0.5);color:#3B82F6;cursor:pointer;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.05em">💬 Dúvida</button>' +
          '<button data-act="rejeitar" data-id="' + item.card.id + '" style="padding:7px 15px;border-radius:6px;background:rgba(239,68,68,0.18);border:1px solid rgba(239,68,68,0.5);color:#EF4444;cursor:pointer;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.05em">✕ Rejeitar</button>' +
          '<button data-act="aprovar" data-id="' + item.card.id + '" style="padding:7px 15px;border-radius:6px;background:rgba(16,185,129,0.22);border:1px solid rgba(16,185,129,0.55);color:#10B981;cursor:pointer;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.05em">✓ Aprovar</button>' +
        '</div>';
      body.appendChild(card);
    });
    body.querySelectorAll("button[data-act]").forEach((btn) => {
      btn.onclick = async () => {
        const act = btn.dataset.act;
        const cardId = btn.dataset.id;
        if (act === "ver") {
          const item = pendentesCache.find(p => p.card.id === cardId);
          if (item) renderProposta(item);
          return;
        }
        if (act === "conversa") {
          const item = pendentesCache.find(p => p.card.id === cardId);
          if (window.__pktOpenCardChat) {
            window.__pktOpenCardChat(cardId, (item && item.cliente) || "Card");
          } else {
            alert("Chat indisponível — recarrega a página.");
          }
          return;
        }
        if (act === "duvida") {
          const item = pendentesCache.find(p => p.card.id === cardId);
          await abrirModalComentario({ tipo: "duvida", cardId, item, btn });
          return;
        }
        if (act === "rejeitar") {
          const item = pendentesCache.find(p => p.card.id === cardId);
          await abrirModalComentario({ tipo: "rejeicao", cardId, item, btn });
          return;
        }
        await acaoDecisao(act, cardId, btn);
      };
    });
  }

  function renderProposta(item) {
    const body = document.getElementById("pkt-overlay-body");
    if (!body || !item.proposta_link) return;
    viewState = "proposta";
    propostaAberta = item;

    body.style.padding = "0";
    body.style.maxWidth = "none";
    body.style.gap = "0";

    body.innerHTML =
      '<div style="background:#0A0A0A;border-bottom:1px solid rgba(255,255,255,0.08);padding:10px 18px;display:flex;align-items:center;justify-content:space-between;gap:12px;flex-shrink:0">' +
        '<div style="flex:1;min-width:0"><div style="font-size:14px;font-weight:700;color:#fff;line-height:1.2">' + (item.cliente || "—") + '</div></div>' +
        '<a href="' + item.proposta_link + '" target="_blank" rel="noopener" title="Abrir em nova aba" style="padding:6px 10px;border-radius:6px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.12);color:rgba(255,255,255,0.6);text-decoration:none;font-size:11px;font-weight:700">↗</a>' +
        '<button id="pkt-back-list" title="Voltar à lista" style="padding:6px 10px;border-radius:6px;background:transparent;border:1px solid rgba(255,255,255,0.2);color:#fff;cursor:pointer;font-size:12px;font-weight:700">← Voltar</button>' +
      '</div>' +
      '<iframe src="' + item.proposta_link + '" style="flex:1;width:100%;border:0;background:#fff" title="Proposta"></iframe>' +
      '<div style="background:#0A0A0A;border-top:2px solid rgba(255,255,255,0.1);padding:12px 18px;display:flex;align-items:center;justify-content:space-between;gap:12px;flex-shrink:0;flex-wrap:wrap">' +
        '<div style="flex:1;min-width:200px;font-size:11px;color:rgba(255,255,255,0.65);display:flex;align-items:center;gap:12px;flex-wrap:wrap">' +
          '<span>Vendedor: <b style="color:#fff">' + (item.vendedor || "—") + '</b></span>' +
          '<span style="color:rgba(255,255,255,0.2)">·</span>' +
          '<span>Orçamentista: <b style="color:#fff">' + (item.orcamentista || "—") + '</b></span>' +
          (item.historico && item.historico.length > 0
            ? '<span style="color:rgba(255,255,255,0.2)">·</span><span style="color:#F59E0B;font-weight:600">' + item.historico.length + 'ª análise</span>'
            : '') +
        '</div>' +
        '<div style="display:flex;gap:8px;align-items:center;flex-shrink:0">' +
          '<button data-act="duvida" data-id="' + item.card.id + '" style="padding:8px 18px;border-radius:6px;background:rgba(59,130,246,0.2);border:1px solid rgba(59,130,246,0.55);color:#3B82F6;cursor:pointer;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.05em">💬 Dúvida</button>' +
          '<button data-act="rejeitar" data-id="' + item.card.id + '" style="padding:8px 18px;border-radius:6px;background:rgba(239,68,68,0.2);border:1px solid rgba(239,68,68,0.55);color:#EF4444;cursor:pointer;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.05em">✕ Reprovar</button>' +
          '<button data-act="aprovar" data-id="' + item.card.id + '" style="padding:8px 18px;border-radius:6px;background:rgba(16,185,129,0.25);border:1px solid rgba(16,185,129,0.6);color:#10B981;cursor:pointer;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.05em">✓ Aprovar</button>' +
        '</div>' +
      '</div>';

    document.getElementById("pkt-back-list").onclick = () => {
      body.style.padding = "24px";
      body.style.maxWidth = "1100px";
      body.style.gap = "14px";
      renderLista();
    };
    body.querySelectorAll("button[data-act]").forEach((btn) => {
      btn.onclick = async () => {
        const act = btn.dataset.act;
        if (act === "duvida") {
          await abrirModalComentario({ tipo: "duvida", cardId: btn.dataset.id, item, btn });
          return;
        }
        if (act === "rejeitar") {
          await abrirModalComentario({ tipo: "rejeicao", cardId: btn.dataset.id, item, btn });
          return;
        }
        await acaoDecisao(act, btn.dataset.id, btn);
      };
    });
  }

  // ════════════════════════════════════════════════════════════════════
  // MODAL DE COMENTÁRIO (dúvida ou rejeição)
  // ════════════════════════════════════════════════════════════════════
  function abrirModalComentario({ tipo, cardId, item, btn }) {
    return new Promise((resolve) => {
      const isRejeicao = tipo === "rejeicao";
      const cor = isRejeicao ? "#EF4444" : "#3B82F6";
      const corBg = isRejeicao ? "rgba(239,68,68,0.18)" : "rgba(59,130,246,0.18)";
      const titulo = isRejeicao ? "Justificar Rejeição" : "Tirar Dúvida com Orçamentista";
      const subtitulo = isRejeicao
        ? "Descreva por que essa proposta não foi aprovada — o orçamentista vai ver no chat do card."
        : "Faça uma pergunta ou comente. Vai pro chat do card e o orçamentista vê quando abrir.";
      const placeholder = isRejeicao
        ? "Ex.: Margem muito apertada na linha de instalação. Revisar e refazer."
        : "Ex.: Esse preço de m² está alinhado com o orçamento original?";
      const btnLabel = isRejeicao ? "✕ Confirmar Rejeição" : "💬 Enviar Pergunta";

      const wrap = document.createElement("div");
      wrap.id = "pkt-ceo-coment-modal";
      Object.assign(wrap.style, {
        position: "fixed", inset: "0", background: "rgba(0,0,0,0.85)",
        zIndex: 9999999, display: "flex", alignItems: "center", justifyContent: "center",
        padding: "20px", fontFamily: "system-ui, sans-serif",
      });
      wrap.innerHTML =
        '<div style="background:#0A0A0A;border:1px solid ' + cor + ';border-radius:12px;width:100%;max-width:560px;padding:24px 24px 18px;color:#fff;box-shadow:0 20px 60px rgba(0,0,0,0.7)">' +
          '<div style="font-size:11px;color:' + cor + ';text-transform:uppercase;letter-spacing:0.12em;font-weight:700;margin-bottom:6px">' + (item && item.cliente ? item.cliente : "Card") + '</div>' +
          '<h3 style="margin:0 0 4px;font-size:1.1rem;font-weight:700">' + titulo + '</h3>' +
          '<div style="font-size:12px;color:rgba(255,255,255,0.55);margin-bottom:14px;line-height:1.5">' + subtitulo + '</div>' +
          '<textarea id="pkt-ceo-coment-text" rows="6" placeholder="' + placeholder + '" style="width:100%;background:#000;border:1px solid rgba(255,255,255,0.15);border-radius:8px;padding:12px;color:#fff;font-size:13px;font-family:inherit;resize:vertical;outline:none;box-sizing:border-box"></textarea>' +
          '<div style="display:flex;gap:8px;justify-content:flex-end;margin-top:14px">' +
            '<button id="pkt-ceo-coment-cancel" style="padding:8px 16px;border-radius:6px;background:transparent;border:1px solid rgba(255,255,255,0.2);color:#fff;cursor:pointer;font-size:12px;font-weight:600">Cancelar</button>' +
            '<button id="pkt-ceo-coment-ok" style="padding:8px 18px;border-radius:6px;background:' + corBg + ';border:1px solid ' + cor + ';color:' + cor + ';cursor:pointer;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:0.05em">' + btnLabel + '</button>' +
          '</div>' +
        '</div>';
      document.body.appendChild(wrap);

      const txt = wrap.querySelector("#pkt-ceo-coment-text");
      setTimeout(() => txt.focus(), 100);

      const close = () => { wrap.remove(); resolve(); };
      wrap.querySelector("#pkt-ceo-coment-cancel").onclick = close;
      wrap.onclick = (ev) => { if (ev.target === wrap) close(); };
      wrap.querySelector("#pkt-ceo-coment-ok").onclick = async () => {
        const v = (txt.value || "").trim();
        if (!v) { txt.style.borderColor = "#EF4444"; txt.focus(); return; }
        const okBtn = wrap.querySelector("#pkt-ceo-coment-ok");
        okBtn.disabled = true; okBtn.textContent = "…";
        if (isRejeicao) {
          await acaoDecisao("rejeitar", cardId, btn || okBtn, v);
        } else {
          await postarComentario(cardId, v, "duvida", item);
          // Atualiza contador local + auto-abre o chat pra CEO ver o thread
          chatCountsCache[cardId] = (chatCountsCache[cardId] || 0) + 1;
          setTimeout(() => {
            if (window.__pktOpenCardChat) {
              window.__pktOpenCardChat(cardId, (item && item.cliente) || "Card");
            }
          }, 200);
        }
        close();
      };
    });
  }

  // ════════════════════════════════════════════════════════════════════
  // SALVA COMENTÁRIO/REJEIÇÃO NO CHAT DO CARD
  // ════════════════════════════════════════════════════════════════════
  async function postarComentario(cardId, texto, tipo, item) {
    const email = getUserEmail() || "ceo@parket.works";
    const nome = getUserNome() || "Douglas (CEO)";
    const prefix = tipo === "rejeicao" ? "[REJEIÇÃO CEO]" : "[DÚVIDA CEO]";
    const body = {
      context_id: cardId,
      context_type: "kanban_card",
      topic: item && item.cliente ? String(item.cliente).toLowerCase().trim() : null,
      user_name: "🟡 CEO — " + nome,
      user_email: email,
      avatar: "👑",
      msg: prefix + "\n" + texto,
    };
    try {
      await fetch(`${SB_URL}/rest/v1/card_chat_messages`, {
        method: "POST",
        headers: {
          apikey: SB_KEY,
          Authorization: "Bearer " + SB_KEY,
          "Content-Type": "application/json",
          Prefer: "return=minimal",
        },
        body: JSON.stringify(body),
      });
    } catch (e) {
      console.warn("[ceo postarComentario]", e);
    }
    // Notifica grupo só na dúvida (rejeição já é notificada pelo acaoDecisao)
    if (tipo === "duvida") {
      const cli = (item && item.cliente) || "Cliente";
      const orc = (item && item.orcamentista) || "—";
      const orcPhone = await lookupOrcamentistaPhone(orc);
      try {
        await waNotifyGroup(`💬 *DÚVIDA do CEO* — ${cli}\n\nOrçamentista: ${orc}\n\n*Pergunta:*\n${texto}\n\nResponder pelo chat do card no Space.`, orcPhone);
      } catch(_we) { console.warn("[wa-duvida]", _we); }
    }
    // Marca como lido localmente — CEO acabou de mandar, não badga pra ele
    try { if (window.__pktMarkCardRead) window.__pktMarkCardRead(cardId); } catch(_) {}
  }

  // ════════════════════════════════════════════════════════════════════
  // APROVAR / REJEITAR via API existente
  // ════════════════════════════════════════════════════════════════════
  async function acaoDecisao(act, cardId, btn, motivoOverride) {
    const email = getUserEmail();
    const nome = getUserNome();
    if (!email) { alert("Login não detectado"); return; }
    const reqBody = { email, nome };
    if (act === "rejeitar") {
      const m = motivoOverride && motivoOverride.trim();
      if (!m) {
        // fallback caso alguém chame sem texto (não deveria mais acontecer)
        alert("Justificativa obrigatória.");
        return;
      }
      reqBody.motivo = m;
    } else {
      if (!confirm("Aprovar essa proposta?\n\nO card vai pra Proposta Pronta e o Comercial sobe pra Apresentação/Proposta.")) return;
    }
    btn.disabled = true; const originalTxt = btn.textContent; btn.textContent = "…";
    try {
      const r = await fetch(`${API}/api/orcamento/aprovacao/${cardId}/${act}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(reqBody),
      });
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        alert("Erro: " + (j.detail || r.status));
        btn.disabled = false; btn.textContent = originalTxt;
        return;
      }
      // Se for rejeição, registra também no chat do card como mensagem CEO destacada
      const itemReg = pendentesCache.find(p => p.card.id === cardId);
      if (act === "rejeitar") {
        await postarComentario(cardId, reqBody.motivo, "rejeicao", itemReg);
      }
      // Notifica o grupo Parket — Orçamentos no WhatsApp (com @ no orçamentista)
      try {
        const cli = itemReg && itemReg.cliente ? itemReg.cliente : "Cliente";
        const orc = itemReg && itemReg.orcamentista ? itemReg.orcamentista : "—";
        const vd = itemReg && itemReg.vendedor ? itemReg.vendedor : "—";
        const orcPhone = await lookupOrcamentistaPhone(orc);
        if (act === "aprovar") {
          await waNotifyGroup(`✅ *CEO APROVOU* — ${cli}\n\nOrçamentista: ${orc}\nVendedor: ${vd}\n\nProposta liberada para apresentação.`, orcPhone);
        } else if (act === "rejeitar") {
          await waNotifyGroup(`❌ *CEO REJEITOU* — ${cli}\n\nOrçamentista: ${orc}\nVendedor: ${vd}\n\n*Motivo:*\n${reqBody.motivo}\n\nReabrir a sim e ajustar.`, orcPhone);
        }
      } catch(_we) { console.warn("[wa-decisao]", _we); }
      pendentesCache = pendentesCache.filter((p) => p.card.id !== cardId);
      lastCount = pendentesCache.length;
      ensureTab();
      const body = document.getElementById("pkt-overlay-body");
      if (body) {
        body.style.padding = "24px";
        body.style.maxWidth = "1100px";
        body.style.gap = "14px";
      }
      renderLista();
    } catch (e) {
      alert("Erro: " + e.message);
      btn.disabled = false; btn.textContent = originalTxt;
    }
  }

  setInterval(ensureTab, 1200);
  setInterval(refresh, REFRESH_MS);

  if (document.readyState === "complete" || document.readyState === "interactive") {
    setTimeout(refresh, 400);
  } else {
    document.addEventListener("DOMContentLoaded", () => setTimeout(refresh, 400));
  }
})();
