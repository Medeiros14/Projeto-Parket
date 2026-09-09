/**
 * Chat realtime do card — unificado entre setores.
 *
 * - No modal/página do CARD COMERCIAL (/projeto/:id): substitui o painel
 *   "Chat Interno da Equipe" por uma versão realtime (lê de
 *   card_chat_messages, escreve, e assina postgres_changes).
 *   Também adiciona botão flutuante "💬 Chat" pra abrir overlay
 *   independente da aba.
 *
 * - No EDITOR DE SIMULAÇÃO (orçamento): injeta botão flutuante
 *   "💬 Chat" que abre o mesmo overlay. context_id = card_comercial_id
 *   da simulação (ou simulacao.id se for standalone).
 *
 * Tabela: card_chat_messages (context_id UUID, user_name, avatar,
 *   user_email, msg, created_at).
 *
 * Realtime: postgres_changes INSERT em card_chat_messages
 *   filtrado por context_id.
 *
 * Migração: 2110 mensagens antigas de kanban_cards.chat_messages já
 *   foram copiadas pra card_chat_messages com context_type='kanban_card'.
 *   O painel novo lê delas direto — usuário não perde histórico.
 */
(function () {
  if (window.__pktCardChatLoaded) return;
  window.__pktCardChatLoaded = true;

  var SUPA_URL = "https://hbxpilrxmitvzebluoom.supabase.co";
  var SUPA_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhieHBpbHJ4bWl0dnplYmx1b29tIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI5NDI1MjcsImV4cCI6MjA4ODUxODUyN30.ciZA1H-UvlYG2OPWqrFChj-_ttiFD5W5BmrST-gUJ-0";

  function getToken() {
    try {
      for (var i = 0; i < localStorage.length; i++) {
        var k = localStorage.key(i);
        var raw = k && localStorage.getItem(k);
        if (!raw || (raw[0] !== "{" && raw[0] !== "[")) continue;
        try {
          var p = JSON.parse(raw);
          var t = (p && p.access_token) || (p && p.currentSession && p.currentSession.access_token) || null;
          if (t && t.length > 40) return t;
        } catch (e) {}
      }
    } catch (e) {}
    return SUPA_KEY;
  }

  function getUserInfo() {
    try {
      for (var i = 0; i < localStorage.length; i++) {
        var k = localStorage.key(i);
        var raw = k && localStorage.getItem(k);
        if (!raw || raw[0] !== "{") continue;
        try {
          var p = JSON.parse(raw);
          var u = (p && p.user) || (p && p.currentSession && p.currentSession.user) || null;
          if (u && u.email) {
            var name = (u.user_metadata && (u.user_metadata.name || u.user_metadata.full_name)) || u.email.split("@")[0];
            var avatar = name.split(/\s+/).map(function (s) { return s[0]; }).join("").slice(0, 2).toUpperCase();
            return { name: name, email: u.email, avatar: avatar };
          }
        } catch (e) {}
      }
    } catch (e) {}
    return { name: "Você", email: null, avatar: "VC" };
  }

  // Lookup do título do card pra normalizar como topic (chat por cliente).
  // Múltiplos kanban_cards com mesmo título compartilham o chat — isso é
  // intencional já que esse projeto cria cards duplicados durante handoff
  // entre setores sem linkar formalmente.
  var _topicCache = {};
  function getTopicForCard(contextId) {
    if (!contextId) return Promise.resolve(null);
    if (_topicCache[contextId] !== undefined) return Promise.resolve(_topicCache[contextId]);
    return fetch(SUPA_URL + "/rest/v1/kanban_cards?id=eq." + contextId + "&select=title", {
      headers: { apikey: SUPA_KEY, Authorization: "Bearer " + getToken() },
    }).then(function (r) { return r.ok ? r.json() : []; })
      .then(function (rows) {
        var t = rows && rows[0] && rows[0].title ? String(rows[0].title).trim().toLowerCase() : null;
        _topicCache[contextId] = t;
        return t;
      }).catch(function () { return null; });
  }

  function fetchMessages(contextId) {
    return getTopicForCard(contextId).then(function (topic) {
      var url;
      if (topic) {
        url = SUPA_URL + "/rest/v1/card_chat_messages?or=(context_id.eq." + contextId + ",topic.eq." + encodeURIComponent(topic) + ")&select=*&order=created_at.asc&limit=500";
      } else {
        url = SUPA_URL + "/rest/v1/card_chat_messages?context_id=eq." + contextId + "&select=*&order=created_at.asc&limit=500";
      }
      return fetch(url, { headers: { apikey: SUPA_KEY, Authorization: "Bearer " + getToken() } })
        .then(function (r) { return r.ok ? r.json() : []; })
        .catch(function () { return []; });
    });
  }

  function sendMessage(contextId, msg) {
    var user = getUserInfo();
    return getTopicForCard(contextId).then(function (topic) {
      var body = {
        context_id: contextId,
        context_type: "kanban_card",
        topic: topic || null,
        user_name: user.name,
        user_email: user.email,
        avatar: user.avatar,
        msg: msg,
      };
      return fetch(SUPA_URL + "/rest/v1/card_chat_messages", {
        method: "POST",
        headers: {
          apikey: SUPA_KEY,
          Authorization: "Bearer " + getToken(),
          "Content-Type": "application/json",
          Prefer: "return=representation",
        },
        body: JSON.stringify(body),
      }).then(function (r) { return r.ok ? r.json() : null; });
    });
  }

  function fmtTime(iso) {
    try {
      var d = new Date(iso);
      var today = new Date();
      var sameDay = d.toDateString() === today.toDateString();
      return sameDay
        ? d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
        : d.toLocaleDateString("pt-BR") + " " + d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
    } catch (e) { return iso; }
  }

  // ── Realtime via Supabase Realtime WebSocket ──
  // Filtra por topic (cliente) — todas as mensagens com o mesmo topic
  // chegam pra todos os cards "Vittorio Danesi" abertos. Fallback: filter
  // por context_id quando topic é null.
  // pkt4: realtime global SEM filtro — pega todo INSERT em card_chat_messages
  function openGlobalChatRealtime(onInsert) {
    var ws = null;
    var alive = true;
    var ref = 1;
    function nextRef() { return String(ref++); }
    function connect() {
      if (!alive) return;
      var token = getToken();
      var url = SUPA_URL.replace(/^http/, "ws") + "/realtime/v1/websocket?apikey=" + SUPA_KEY + "&vsn=1.0.0";
      try { ws = new WebSocket(url); } catch (e) { setTimeout(connect, 2000); return; }
      ws.onopen = function () {
        ws.send(JSON.stringify({
          topic: "realtime:public:card_chat_messages",
          event: "phx_join",
          payload: {
            config: {
              postgres_changes: [{ event: "INSERT", schema: "public", table: "card_chat_messages" }],
              broadcast: { ack: false, self: false },
              presence: { key: "" },
            },
            access_token: token,
          },
          ref: nextRef(),
        }));
        if (window.__pktGlobalChatHB) clearInterval(window.__pktGlobalChatHB);
        window.__pktGlobalChatHB = setInterval(function () {
          if (ws && ws.readyState === 1) {
            ws.send(JSON.stringify({ topic: "phoenix", event: "heartbeat", payload: {}, ref: nextRef() }));
          }
        }, 25000);
      };
      ws.onmessage = function (ev) {
        try {
          var data = JSON.parse(ev.data);
          if (data.event === "postgres_changes" && data.payload && data.payload.data) {
            var rec = data.payload.data.record;
            if (rec) onInsert(rec);
          }
        } catch (e) {}
      };
      ws.onclose = function () { if (alive) setTimeout(connect, 2000); };
      ws.onerror = function () { try { ws.close(); } catch (e) {} };
    }
    connect();
    return function close() { alive = false; if (window.__pktGlobalChatHB) clearInterval(window.__pktGlobalChatHB); try { ws && ws.close(); } catch (e) {} };
  }

  function openRealtime(contextId, topicVal, onInsert) {
    var ws = null;
    var alive = true;
    var filter = topicVal ? ("topic=eq." + topicVal) : ("context_id=eq." + contextId);
    var wsTopic = "realtime:public:card_chat_messages:" + filter;
    var ref = 1;

    function nextRef() { return String(ref++); }

    function connect() {
      if (!alive) return;
      var token = getToken();
      var url = SUPA_URL.replace(/^http/, "ws") + "/realtime/v1/websocket?apikey=" + SUPA_KEY + "&vsn=1.0.0";
      try { ws = new WebSocket(url); } catch (e) { setTimeout(connect, 2000); return; }

      ws.onopen = function () {
        ws.send(JSON.stringify({
          topic: wsTopic,
          event: "phx_join",
          payload: {
            config: {
              postgres_changes: [{ event: "INSERT", schema: "public", table: "card_chat_messages", filter: filter }],
              broadcast: { ack: false, self: false },
              presence: { key: "" },
            },
            access_token: token,
          },
          ref: nextRef(),
        }));
        if (window.__pktChatHB) clearInterval(window.__pktChatHB);
        window.__pktChatHB = setInterval(function () {
          if (ws && ws.readyState === 1) {
            ws.send(JSON.stringify({ topic: "phoenix", event: "heartbeat", payload: {}, ref: nextRef() }));
          }
        }, 25000);
      };

      ws.onmessage = function (ev) {
        try {
          var data = JSON.parse(ev.data);
          if (data.event === "postgres_changes" && data.payload && data.payload.data) {
            var rec = data.payload.data.record;
            if (rec) onInsert(rec);
          }
        } catch (e) {}
      };

      ws.onclose = function () { if (alive) setTimeout(connect, 2000); };
      ws.onerror = function () { try { ws.close(); } catch (e) {} };
    }

    connect();

    return function close() {
      alive = false;
      if (window.__pktChatHB) { clearInterval(window.__pktChatHB); window.__pktChatHB = null; }
      try { ws && ws.close(); } catch (e) {}
    };
  }

  // ── Painel overlay ──
  function openChatPanel(contextId, title) {
    var existing = document.getElementById("pkt-chat-overlay");
    if (existing) existing.remove();

    var me = getUserInfo();

    var overlay = document.createElement("div");
    overlay.id = "pkt-chat-overlay";
    overlay.style.cssText = "position:fixed;inset:0;z-index:9999999;background:rgba(0,0,0,0.55);display:flex;align-items:stretch;justify-content:flex-end;backdrop-filter:blur(3px);font-family:-apple-system,Segoe UI,system-ui,sans-serif;";
    overlay.onclick = function (e) { if (e.target === overlay) close(); };

    var panel = document.createElement("div");
    panel.style.cssText = "background:#0e0e0e;border-left:1px solid #2a2a2a;width:min(440px,100%);height:100vh;display:flex;flex-direction:column;color:#fff;";
    overlay.appendChild(panel);

    var header = document.createElement("div");
    header.style.cssText = "padding:14px 18px;border-bottom:1px solid #2a2a2a;display:flex;align-items:center;justify-content:space-between;flex-shrink:0;";
    header.innerHTML =
      '<div>' +
        '<div style="font-size:10px;color:#B8AA9A;letter-spacing:0.15em;text-transform:uppercase;">Chat do Card</div>' +
        '<div style="font-size:13px;color:#fff;font-weight:600;margin-top:2px;">' + (title || "Conversa entre setores") + '</div>' +
        '<div style="font-size:9px;color:#666;margin-top:2px;">🟢 Realtime · Todos os setores veem ao vivo</div>' +
      '</div>' +
      '<button id="pkt-chat-close" style="background:rgba(255,255,255,0.07);border:none;border-radius:6px;color:#aaa;width:30px;height:30px;cursor:pointer;font-size:18px;">×</button>';
    panel.appendChild(header);

    var list = document.createElement("div");
    list.id = "pkt-chat-list";
    list.style.cssText = "flex:1;overflow-y:auto;padding:14px 18px;display:flex;flex-direction:column;gap:10px;";
    list.innerHTML = '<div style="font-size:11px;color:#666;text-align:center;padding:20px 0;">Carregando…</div>';
    panel.appendChild(list);

    var footer = document.createElement("div");
    footer.style.cssText = "padding:12px 18px;border-top:1px solid #2a2a2a;display:flex;gap:8px;flex-shrink:0;";
    footer.innerHTML =
      '<input id="pkt-chat-input" placeholder="Mensagem pra equipe…" style="flex:1;background:rgba(255,255,255,0.04);border:1px solid #2a2a2a;color:#fff;padding:9px 12px;border-radius:8px;font-size:12px;outline:none;"/>' +
      '<button id="pkt-chat-send" style="background:#B8AA9A;color:#000;border:none;border-radius:8px;padding:9px 16px;cursor:pointer;font-weight:700;font-size:12px;">Enviar</button>';
    panel.appendChild(footer);

    document.body.appendChild(overlay);

    var closeRT = null;
    function close() {
      try { closeRT && closeRT(); } catch (e) {}
      overlay.remove();
    }
    header.querySelector("#pkt-chat-close").onclick = close;

    function render(messages) {
      if (!messages.length) {
        list.innerHTML = '<div style="font-size:11px;color:#666;text-align:center;padding:30px 0;">Sem mensagens ainda. Inicie a conversa entre setores.</div>';
        return;
      }
      list.innerHTML = "";
      var lastDate = "";
      messages.forEach(function (m) {
        var d = new Date(m.created_at);
        var dateLabel = d.toLocaleDateString("pt-BR");
        if (dateLabel !== lastDate) {
          var sep = document.createElement("div");
          sep.style.cssText = "text-align:center;font-size:9px;color:#666;letter-spacing:0.1em;text-transform:uppercase;margin:6px 0;";
          sep.textContent = dateLabel;
          list.appendChild(sep);
          lastDate = dateLabel;
        }
        var mine = me.email && m.user_email === me.email;
        var isCEO = /^\s*\[(REJEI[ÇC][AÃ]O|D[ÚU]VIDA) CEO\]/i.test(m.msg || "") || /^🟡 CEO/.test(m.user_name || "");
        var isRej = isCEO && /^\s*\[REJEI[ÇC][AÃ]O CEO\]/i.test(m.msg || "");
        var row = document.createElement("div");
        row.style.cssText = "display:flex;gap:8px;" + (mine ? "flex-direction:row-reverse;" : "");
        var av = document.createElement("div");
        av.style.cssText = "width:28px;height:28px;border-radius:50%;font-weight:700;font-size:10px;display:flex;align-items:center;justify-content:center;flex-shrink:0;" +
          (isCEO
            ? (isRej ? "background:rgba(239,68,68,0.25);color:#EF4444;" : "background:rgba(212,168,83,0.3);color:#D4A853;")
            : "background:rgba(184,170,154,0.2);color:#B8AA9A;");
        av.textContent = m.avatar || (isCEO ? "👑" : "?");
        var bubble = document.createElement("div");
        bubble.style.cssText = "max-width:78%;padding:8px 12px;border-radius:10px;" +
          (isCEO
            ? (isRej
                ? "background:rgba(239,68,68,0.12);border:1.5px solid rgba(239,68,68,0.6);border-top-left-radius:3px;box-shadow:0 0 0 1px rgba(239,68,68,0.15);"
                : "background:rgba(212,168,83,0.1);border:1.5px solid rgba(212,168,83,0.6);border-top-left-radius:3px;box-shadow:0 0 0 1px rgba(212,168,83,0.18);")
            : (mine
              ? "background:rgba(184,170,154,0.18);border:1px solid rgba(184,170,154,0.35);border-top-right-radius:3px;"
              : "background:rgba(255,255,255,0.04);border:1px solid #2a2a2a;border-top-left-radius:3px;"));
        var nameColor = isCEO ? (isRej ? "#EF4444" : "#D4A853") : "#B8AA9A";
        bubble.innerHTML =
          '<div style="display:flex;gap:8px;align-items:baseline;margin-bottom:3px;">' +
            '<span style="font-size:10px;color:' + nameColor + ';font-weight:700;">' + escapeHtml(m.user_name || "—") + '</span>' +
            '<span style="font-size:9px;color:#666;">' + fmtTime(m.created_at) + '</span>' +
          '</div>' +
          '<div style="font-size:12px;color:' + (isCEO ? "#fff" : "#ddd") + ';line-height:1.5;white-space:pre-wrap;' + (isCEO ? "font-weight:500;" : "") + '">' + escapeHtml(m.msg) + '</div>';
        row.appendChild(av);
        row.appendChild(bubble);
        list.appendChild(row);
      });
      list.scrollTop = list.scrollHeight;
    }

    function escapeHtml(s) {
      return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
        return ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c];
      });
    }

    var localMessages = [];
    fetchMessages(contextId).then(function (msgs) {
      localMessages = msgs || [];
      render(localMessages);
    });

    getTopicForCard(contextId).then(function (topicVal) {
      closeRT = openRealtime(contextId, topicVal, function (rec) {
        if (localMessages.some(function (m) { return m.id === rec.id; })) return;
        localMessages.push(rec);
        localMessages.sort(function (a, b) { return new Date(a.created_at) - new Date(b.created_at); });
        render(localMessages);
      });
    });

    var input = footer.querySelector("#pkt-chat-input");
    var sendBtn = footer.querySelector("#pkt-chat-send");

    function doSend() {
      var v = (input.value || "").trim();
      if (!v) return;
      input.value = "";
      sendBtn.disabled = true;
      sendBtn.style.opacity = "0.6";
      sendMessage(contextId, v).then(function (rows) {
        sendBtn.disabled = false;
        sendBtn.style.opacity = "1";
        input.focus();
        if (rows && rows[0]) {
          if (!localMessages.some(function (m) { return m.id === rows[0].id; })) {
            localMessages.push(rows[0]);
            render(localMessages);
          }
        }
      });
    }

    sendBtn.onclick = doSend;
    input.onkeydown = function (e) { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); doSend(); } };
    setTimeout(function () { input.focus(); }, 100);
  }

  // ── Botão flutuante ──
  function injectFloatBtn(contextId, title) {
    var old = document.getElementById("pkt-chat-fab");
    if (old) old.remove();
    var btn = document.createElement("button");
    btn.id = "pkt-chat-fab";
    btn.style.cssText = "position:fixed;right:18px;bottom:18px;z-index:9990;background:#B8AA9A;color:#000;border:none;border-radius:50px;padding:11px 18px;font-weight:700;font-size:12px;cursor:pointer;box-shadow:0 6px 20px rgba(0,0,0,0.5);display:flex;align-items:center;gap:8px;font-family:-apple-system,Segoe UI,system-ui,sans-serif;";
    btn.innerHTML = '<span style="font-size:16px;">💬</span> Chat do card';
    btn.onclick = function () { openChatPanel(contextId, title); };
    document.body.appendChild(btn);
    // pkt2: detecta msg do CEO e troca o botão pra dourado/vermelho destacado
    try {
      fetchMessages(contextId).then(function (msgs) {
        if (!Array.isArray(msgs) || !msgs.length) return;
        var hasRej = msgs.some(function (m) { return /^\s*\[REJEI[ÇC][AÃ]O CEO\]/i.test(m.msg || ""); });
        var hasDuv = msgs.some(function (m) { return /^\s*\[D[ÚU]VIDA CEO\]/i.test(m.msg || ""); });
        if (!hasRej && !hasDuv) return;
        var cur = document.getElementById("pkt-chat-fab");
        if (!cur) return;
        var corBg = hasRej ? "#EF4444" : "#D4A853";
        var corTxt = hasRej ? "#fff" : "#000";
        var label = hasRej ? "Rejeição CEO" : "Dúvida CEO";
        cur.style.background = corBg;
        cur.style.color = corTxt;
        cur.style.boxShadow = "0 6px 20px " + corBg + "70, 0 0 0 3px " + corBg + "30";
        cur.innerHTML = '<span style="font-size:16px;">👑</span> ' + label;
      });
    } catch (e) { console.warn("[chat-fab ceo badge]", e); }
  }

  function removeFloatBtn() {
    var old = document.getElementById("pkt-chat-fab");
    if (old) old.remove();
  }

  // ── Detecção de contexto ──
  function getComercialCardId() {
    var m = location.pathname.match(/^\/projeto\/([^\/?#]+)/);
    return m ? m[1] : null;
  }

  function getSimulacaoContext() {
    var sim = window.__pktCurrentSim;
    if (!sim || !sim.id) return null;
    var contextId = sim.card_comercial_id || sim.id;
    var title = (sim.cliente || "") + (sim.obra_code ? " · " + sim.obra_code : "");
    return { contextId: contextId, title: title.trim() || "Simulação " + (sim.numero || "") };
  }

  // ── Watchdog: revisa contexto a cada 800ms ──
  var lastContext = null;

  function evaluate() {
    // Chat fica APENAS inline (aba dentro do modal). Sem FAB nunca.
    removeFloatBtn();
    lastContext = "inline-only";
    return;
    /* eslint-disable */
    var ctx = null;
    var cardId = getComercialCardId();
    if (cardId) {
      ctx = { contextId: cardId, title: "Card Comercial", source: "comercial" };
    } else {
      var sc = getSimulacaoContext();
      if (sc) ctx = { contextId: sc.contextId, title: sc.title, source: "orcamento" };
    }

    var key = ctx ? ctx.source + ":" + ctx.contextId : null;
    if (key === lastContext) return;
    lastContext = key;

    if (ctx) {
      injectFloatBtn(ctx.contextId, ctx.title);
    } else {
      removeFloatBtn();
    }
  }


  // ════════════════════════════════════════════════════════════════════
  // pkt3: NOTIFICAÇÃO GLOBAL — toast + badge nos cards da kanban quando
  // chega mensagem nova em QUALQUER card. Polling de 12s (simples e robusto).
  // ════════════════════════════════════════════════════════════════════
  function escapeHtmlGlobal(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c];
    });
  }
  function ckUserEmail() {
    try { var u = getUserInfo(); return u && u.email ? u.email.toLowerCase() : null; } catch (_) { return null; }
  }
  function loadLastSeen() {
    try { return JSON.parse(localStorage.getItem("__pkt_chat_last_seen") || "{}"); } catch (_) { return {}; }
  }
  function saveLastSeen(obj) {
    try { localStorage.setItem("__pkt_chat_last_seen", JSON.stringify(obj)); } catch (_) {}
  }
  function markCardRead(contextId) {
    var s = loadLastSeen();
    s[contextId] = new Date().toISOString();
    saveLastSeen(s);
    if (unreadByContext[contextId]) {
      var topic = unreadByContext[contextId].topic;
      if (topic && unreadByTopic[topic]) unreadByTopic[topic] = Math.max(0, unreadByTopic[topic] - unreadByContext[contextId].count);
      delete unreadByContext[contextId];
    }
    setTimeout(refreshKanbanBadges, 50);
  }

  function showToast(msg, contextId) {
    try {
      var c = document.getElementById("__pkt_toast_container");
      if (!c) {
        c = document.createElement("div");
        c.id = "__pkt_toast_container";
        c.style.cssText = "position:fixed;top:80px;right:18px;z-index:999998;display:flex;flex-direction:column;gap:8px;font-family:-apple-system,Segoe UI,system-ui,sans-serif;pointer-events:none;max-width:340px;";
        document.body.appendChild(c);
      }
      var t = document.createElement("div");
      var isCEO = /^🟡 CEO/.test(msg.user_name || "") || /^\s*\[(REJEI[ÇC][AÃ]O|D[ÚU]VIDA) CEO\]/i.test(msg.msg || "");
      var bg = isCEO ? "linear-gradient(135deg,#1a1414,#0d0a08)" : "linear-gradient(135deg,#0d1117,#0a0f15)";
      var bd = isCEO ? "#D4A853" : "#3B82F6";
      t.style.cssText = "background:" + bg + ";border:1.5px solid " + bd + ";border-radius:10px;padding:11px 14px;color:#fff;font-size:12px;cursor:pointer;pointer-events:auto;box-shadow:0 6px 22px rgba(0,0,0,0.6);transition:opacity 0.3s,transform 0.3s;transform:translateX(20px);opacity:0;";
      var preview = (msg.msg || "").replace(/^\s*\[[^\]]+\]\s*/, "").slice(0, 90);
      if ((msg.msg || "").length > 90) preview += "…";
      t.innerHTML =
        '<div style="font-size:10px;color:' + bd + ';font-weight:700;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:3px">💬 ' + (isCEO ? "Mensagem do CEO" : "Nova mensagem") + '</div>' +
        '<div style="font-size:11px;color:rgba(255,255,255,0.7);margin-bottom:2px">' + escapeHtmlGlobal(msg.user_name || "—") + (msg.topic ? ' · ' + escapeHtmlGlobal(msg.topic) : "") + '</div>' +
        '<div style="font-size:12px;color:#fff;line-height:1.4">' + escapeHtmlGlobal(preview) + '</div>';
      t.onclick = function () {
        if (window.__pktOpenCardChat) window.__pktOpenCardChat(contextId, msg.topic || "Card");
        t.remove();
      };
      c.appendChild(t);
      requestAnimationFrame(function () { t.style.transform = "translateX(0)"; t.style.opacity = "1"; });
      setTimeout(function () { t.style.opacity = "0"; t.style.transform = "translateX(20px)"; setTimeout(function(){t.remove();}, 350); }, 7000);
    } catch (e) { console.warn("[toast]", e); }
  }

  var unreadByTopic = {};
  var unreadByContext = {};

  // pkt4: matching mais robusto. Usa TreeWalker pra achar QUALQUER text node que
  // contenha o topic, depois sobe a árvore até achar um ancestor que pareça um card
  // (clicável OU classe contém 'card'/'item', tamanho razoável). Marca esse ancestor.
  function findCardAncestor(node) {
    var cur = node;
    var candidate = null;
    for (var d = 0; d < 10; d++) {
      if (!cur || cur === document.body || !cur.getBoundingClientRect) break;
      try {
        var rect = cur.getBoundingClientRect();
        // critério 1: clicável c/ tamanho de card
        if (rect.height >= 30 && rect.height <= 400 && rect.width >= 80 && rect.width <= 700) {
          var cs = getComputedStyle(cur);
          var clickable = cs.cursor === "pointer" || cur.onclick || cur.getAttribute("role") === "button" ||
                          /card|item|tile|tarefa|board/i.test((cur.className || "") + " " + (cur.id || ""));
          if (clickable) return cur;
          if (!candidate && rect.height >= 50 && rect.height <= 280) candidate = cur;
        }
      } catch (_) {}
      cur = cur.parentElement;
    }
    return candidate; // fallback: maior elemento "card-shaped" sem clickable
  }

  function refreshKanbanBadges() {
    document.querySelectorAll(".__pkt-chat-badge").forEach(function (n) { n.remove(); });
    var topics = Object.keys(unreadByTopic).filter(function (t) { return unreadByTopic[t] > 0 && t.length >= 3; });
    if (!topics.length) return;
    var topicSet = topics.map(function (t) { return { t: t, low: t.toLowerCase() }; });
    var seen = new WeakSet();
    var w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
      acceptNode: function (n) {
        var v = (n.nodeValue || "").trim();
        if (v.length < 3 || v.length > 200) return NodeFilter.FILTER_REJECT;
        var low = v.toLowerCase();
        for (var i = 0; i < topicSet.length; i++) {
          if (low.indexOf(topicSet[i].low) !== -1) return NodeFilter.FILTER_ACCEPT;
        }
        return NodeFilter.FILTER_REJECT;
      }
    });
    var hits = [];
    var n;
    while ((n = w.nextNode())) hits.push(n);
    hits.forEach(function (textNode) {
      var parent = textNode.parentElement;
      if (!parent) return;
      var v = (textNode.nodeValue || "").toLowerCase();
      var matchedTopic = null;
      for (var i = 0; i < topicSet.length; i++) {
        if (v.indexOf(topicSet[i].low) !== -1) { matchedTopic = topicSet[i].t; break; }
      }
      if (!matchedTopic) return;
      var card = findCardAncestor(parent);
      if (!card || seen.has(card)) return;
      if (card.querySelector(".__pkt-chat-badge")) { seen.add(card); return; }
      if (getComputedStyle(card).position === "static") card.style.position = "relative";
      var b = document.createElement("div");
      b.className = "__pkt-chat-badge";
      b.title = "Nova mensagem no chat — clique no card pra abrir";
      b.style.cssText = "position:absolute;top:6px;right:6px;background:#EF4444;color:#fff;font-size:10px;font-weight:800;padding:2px 7px;border-radius:10px;line-height:1.3;box-shadow:0 2px 8px rgba(239,68,68,0.6);z-index:50;pointer-events:none;display:flex;align-items:center;gap:3px;animation:__pktBadgePulse 2s ease-in-out infinite;";
      b.innerHTML = '<span style="font-size:9px">💬</span>' + unreadByTopic[matchedTopic];
      card.appendChild(b);
      seen.add(card);
    });
  }

  // CSS pulse pro badge piscar
  (function injectPulseCSS() {
    if (document.getElementById("__pkt_chat_badge_css")) return;
    var s = document.createElement("style");
    s.id = "__pkt_chat_badge_css";
    s.textContent = "@keyframes __pktBadgePulse{0%,100%{transform:scale(1);box-shadow:0 2px 8px rgba(239,68,68,0.6)}50%{transform:scale(1.12);box-shadow:0 2px 14px rgba(239,68,68,0.9)}}";
    (document.head || document.body).appendChild(s);
  })();

  var _lastPollTs = null;
  async function pollNewMessages() {
    var since = _lastPollTs || new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();
    try {
      var url = SUPA_URL + "/rest/v1/card_chat_messages?created_at=gt." + encodeURIComponent(since) +
                "&select=*&order=created_at.asc&limit=200";
      var r = await fetch(url, { headers: { apikey: SUPA_KEY, Authorization: "Bearer " + SUPA_KEY } });
      if (!r.ok) return;
      var rows = await r.json();
      _lastPollTs = new Date().toISOString();
      if (!Array.isArray(rows) || !rows.length) return;
      var seen = loadLastSeen();
      var sawAny = false;
      rows.forEach(function (m) {
        var cid = m.context_id;
        if (!cid) return;
        var lastReadIso = seen[cid] || "1970-01-01T00:00:00Z";
        if (new Date(m.created_at) <= new Date(lastReadIso)) return;
        sawAny = true;
        var topicNorm = m.topic ? String(m.topic).toLowerCase().trim() : null;
        if (!unreadByContext[cid]) {
          // não mostra toast no polling inicial (só no realtime depois)
          unreadByContext[cid] = { count: 1, topic: topicNorm, lastMsg: m };
        } else {
          unreadByContext[cid].count++;
          unreadByContext[cid].lastMsg = m;
        }
        if (topicNorm) unreadByTopic[topicNorm] = (unreadByTopic[topicNorm] || 0) + 1;
      });
      if (sawAny) refreshKanbanBadges();
      console.log("[pkt-chat-poll] processados:", rows.length, "rows; unreadByTopic:", unreadByTopic);
    } catch (e) { console.warn("[poll-msgs]", e); }
  }

  // Hook into openChatPanel to mark-read
  var _origOpenChat = openChatPanel;
  openChatPanel = function (contextId, title) {
    markCardRead(contextId);
    return _origOpenChat(contextId, title);
  };
  window.__pktOpenCardChat = openChatPanel;
  window.__pktMarkCardRead = markCardRead;

  // pkt5: realtime global SEM self-filter (mostra badge até pra próprias mensagens
  // exceto se o chat panel daquele card foi aberto recentemente, via lastSeen).
  try {
    openGlobalChatRealtime(function (rec) {
      console.log("[pkt-chat-rt]", rec && rec.user_name, "→", rec && rec.context_id, "topic:", rec && rec.topic);
      var cid = rec && rec.context_id;
      if (!cid) return;
      var seen = loadLastSeen();
      var lastReadIso = seen[cid] || "1970-01-01T00:00:00Z";
      if (new Date(rec.created_at) <= new Date(lastReadIso)) return;
      var topicNorm = rec.topic ? String(rec.topic).toLowerCase().trim() : null;
      if (!unreadByContext[cid]) {
        showToast(rec, cid);
        unreadByContext[cid] = { count: 1, topic: topicNorm, lastMsg: rec };
      } else {
        unreadByContext[cid].count++;
        unreadByContext[cid].lastMsg = rec;
      }
      if (topicNorm) unreadByTopic[topicNorm] = (unreadByTopic[topicNorm] || 0) + 1;
      setTimeout(refreshKanbanBadges, 100);
    });
  } catch (e) { console.warn("[global-chat-rt]", e); }

  // Polling 60s como fallback
  setInterval(pollNewMessages, 60000);
  setInterval(refreshKanbanBadges, 1800);
  setTimeout(pollNewMessages, 1500);

  // Debug helper — chama no console pra ver estado
  window.__pktChatStatus = function () {
    console.log("[chat-status] unreadByTopic:", unreadByTopic);
    console.log("[chat-status] unreadByContext:", unreadByContext);
    console.log("[chat-status] lastSeen:", loadLastSeen());
    return { unreadByTopic: unreadByTopic, unreadByContext: unreadByContext };
  };
  window.__pktClearChatRead = function () {
    localStorage.removeItem("__pkt_chat_last_seen");
    unreadByTopic = {};
    unreadByContext = {};
    _lastPollTs = null;
    console.log("[chat] cache de leitura limpo. Rodando poll agora…");
    pollNewMessages();
    return "OK — cache limpo. Badges aparecem em ~2s.";
  };
  window.__pktForceBadgeRefresh = function () {
    refreshKanbanBadges();
    return "Badges renderizados. Tópicos: " + Object.keys(unreadByTopic).join(", ");
  };

  setInterval(evaluate, 800);
  evaluate();

  // ── Botões inline em cards da lista de orçamento ──
  function decorateSimCards() {
    var cards = document.querySelectorAll("[data-pkt-sim-id]");
    cards.forEach(function (el) {
      if (el.querySelector(":scope > .pkt-card-actions")) return;
      var simId = el.getAttribute("data-pkt-sim-id");
      var cardId = el.getAttribute("data-pkt-sim-card") || simId;
      var title = el.getAttribute("data-pkt-sim-title") || "Card";
      var actions = document.createElement("div");
      actions.className = "pkt-card-actions";
      actions.style.cssText = "position:absolute;top:8px;right:8px;display:flex;gap:6px;z-index:5;";
      actions.innerHTML =
        '<button data-pkt-chat-btn style="background:#B8AA9A;color:#000;border:none;border-radius:50px;padding:5px 10px;font-weight:700;font-size:10px;cursor:pointer;display:flex;align-items:center;gap:4px;font-family:-apple-system,Segoe UI,system-ui,sans-serif;">💬 Chat</button>' +
        '<button data-pkt-docs-btn style="background:#1e1e1e;color:#B8AA9A;border:1px solid #B8AA9A;border-radius:50px;padding:5px 10px;font-weight:700;font-size:10px;cursor:pointer;display:flex;align-items:center;gap:4px;font-family:-apple-system,Segoe UI,system-ui,sans-serif;">📎 Anexos</button>';
      if (getComputedStyle(el).position === "static") el.style.position = "relative";
      el.appendChild(actions);
      actions.querySelector("[data-pkt-chat-btn]").onclick = function (e) {
        e.stopPropagation();
        openChatPanel(cardId, title);
      };
      actions.querySelector("[data-pkt-docs-btn]").onclick = function (e) {
        e.stopPropagation();
        if (window.__pktOpenCardDocs) window.__pktOpenCardDocs(cardId, title);
      };
    });
  }
  setInterval(decorateSimCards, 600);
  decorateSimCards();

  // ── Inline chat panel dentro do mount point #pkt-modal-chat-mount ──
  // Patch no dept-layout-v2 injeta esse div quando aba "💬 Chat" tá ativa.
  function renderInlineChatPanel(mount) {
    if (!mount || mount.__pktChatMounted) return;
    mount.__pktChatMounted = true;
    var contextId = mount.getAttribute("data-card-id");
    console.log("[pkt-chat] inline mount detected, context_id=", contextId);
    if (!contextId) {
      mount.innerHTML = '<div style="color:#F87171;font-size:11px;padding:20px;text-align:center;">⚠️ Sem data-card-id no mount point. Reporta esse erro.</div>';
      return;
    }

    var me = getUserInfo();
    mount.innerHTML = "";
    mount.style.cssText = "display:flex;flex-direction:column;gap:8px;height:60vh;color:#fff;";

    var hdr = document.createElement("div");
    hdr.style.cssText = "font-size:9px;color:#10B981;text-transform:uppercase;letter-spacing:0.15em;flex-shrink:0;";
    hdr.textContent = "🟢 Realtime · Todos os setores veem ao vivo";
    mount.appendChild(hdr);

    var list = document.createElement("div");
    list.style.cssText = "flex:1;overflow-y:auto;display:flex;flex-direction:column;gap:8px;padding-right:4px;";
    list.innerHTML = '<div style="font-size:11px;color:#666;text-align:center;padding:20px 0;">Carregando…</div>';
    mount.appendChild(list);

    var footer = document.createElement("div");
    footer.style.cssText = "display:flex;gap:6px;flex-shrink:0;";
    footer.innerHTML =
      '<input id="pkt-inline-chat-input" placeholder="Mensagem pra equipe…" style="flex:1;background:rgba(255,255,255,0.04);border:1px solid #2a2a2a;color:#fff;padding:9px 12px;border-radius:8px;font-size:12px;outline:none;"/>' +
      '<button id="pkt-inline-chat-send" style="background:#B8AA9A;color:#000;border:none;border-radius:8px;padding:9px 18px;cursor:pointer;font-weight:700;font-size:12px;">Enviar</button>';
    mount.appendChild(footer);

    function escapeHtml(s) {
      return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
        return ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c];
      });
    }

    var localMessages = [];
    function render() {
      if (!localMessages.length) {
        list.innerHTML = '<div style="font-size:11px;color:#666;text-align:center;padding:30px 0;">Sem mensagens. Inicie a conversa entre setores.</div>';
        return;
      }
      list.innerHTML = "";
      var lastDate = "";
      localMessages.forEach(function (m) {
        var d = new Date(m.created_at);
        var dateLabel = d.toLocaleDateString("pt-BR");
        if (dateLabel !== lastDate) {
          var sep = document.createElement("div");
          sep.style.cssText = "text-align:center;font-size:9px;color:#666;letter-spacing:0.1em;text-transform:uppercase;margin:6px 0;";
          sep.textContent = dateLabel;
          list.appendChild(sep);
          lastDate = dateLabel;
        }
        var mine = me.email && m.user_email === me.email;
        var row = document.createElement("div");
        row.style.cssText = "display:flex;gap:8px;" + (mine ? "flex-direction:row-reverse;" : "");
        row.innerHTML =
          '<div style="width:28px;height:28px;border-radius:50%;background:rgba(184,170,154,0.2);color:#B8AA9A;font-weight:700;font-size:10px;display:flex;align-items:center;justify-content:center;flex-shrink:0;">' + escapeHtml(m.avatar || "?") + '</div>' +
          '<div style="max-width:78%;padding:8px 12px;border-radius:10px;' +
            (mine ? 'background:rgba(184,170,154,0.18);border:1px solid rgba(184,170,154,0.35);border-top-right-radius:3px;' : 'background:rgba(255,255,255,0.04);border:1px solid #2a2a2a;border-top-left-radius:3px;') + '">' +
            '<div style="display:flex;gap:8px;align-items:baseline;margin-bottom:3px;">' +
              '<span style="font-size:10px;color:#B8AA9A;font-weight:600;">' + escapeHtml(m.user_name || "—") + '</span>' +
              '<span style="font-size:9px;color:#666;">' + fmtTime(m.created_at) + '</span>' +
            '</div>' +
            '<div style="font-size:12px;color:#ddd;line-height:1.5;white-space:pre-wrap;">' + escapeHtml(m.msg) + '</div>' +
          '</div>';
        list.appendChild(row);
      });
      list.scrollTop = list.scrollHeight;
    }

    fetchMessages(contextId).then(function (msgs) {
      console.log("[pkt-chat] fetched", (msgs||[]).length, "messages for", contextId);
      localMessages = msgs || [];
      render();
    });

    var closeRT = null;
    getTopicForCard(contextId).then(function (topicVal) {
      closeRT = openRealtime(contextId, topicVal, function (rec) {
        if (localMessages.some(function (m) { return m.id === rec.id; })) return;
        localMessages.push(rec);
        localMessages.sort(function (a, b) { return new Date(a.created_at) - new Date(b.created_at); });
        render();
      });
    });

    // Cleanup quando o mount sai do DOM
    var obs = new MutationObserver(function () {
      if (!document.body.contains(mount)) {
        try { closeRT && closeRT(); } catch (e) {}
        obs.disconnect();
      }
    });
    obs.observe(document.body, { childList: true, subtree: true });

    var input = footer.querySelector("#pkt-inline-chat-input");
    var btn = footer.querySelector("#pkt-inline-chat-send");
    function doSend() {
      var v = (input.value || "").trim();
      if (!v) return;
      input.value = "";
      btn.disabled = true; btn.style.opacity = "0.6";
      sendMessage(contextId, v).then(function (rows) {
        btn.disabled = false; btn.style.opacity = "1";
        input.focus();
        if (rows && rows[0] && !localMessages.some(function (m) { return m.id === rows[0].id; })) {
          localMessages.push(rows[0]); render();
        }
      });
    }
    btn.onclick = doSend;
    input.onkeydown = function (e) { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); doSend(); } };
    setTimeout(function () { input.focus(); }, 100);
  }

  // Polling do mount point (reaparece toda vez que usuário clica na aba)
  setInterval(function () {
    var mount = document.getElementById("pkt-modal-chat-mount");
    if (mount && !mount.__pktChatMounted) renderInlineChatPanel(mount);
  }, 400);

  // ── API global pra abrir manualmente via console ──
  window.__pktOpenCardChat = openChatPanel;

  console.log("[pkt-chat] realtime chat panel loaded");
})();
