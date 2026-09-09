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
    overlay.style.cssText = "position:fixed;inset:0;z-index:99998;background:rgba(0,0,0,0.55);display:flex;align-items:stretch;justify-content:flex-end;backdrop-filter:blur(3px);font-family:-apple-system,Segoe UI,system-ui,sans-serif;";
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
        var row = document.createElement("div");
        row.style.cssText = "display:flex;gap:8px;" + (mine ? "flex-direction:row-reverse;" : "");
        var av = document.createElement("div");
        av.style.cssText = "width:28px;height:28px;border-radius:50%;background:rgba(184,170,154,0.2);color:#B8AA9A;font-weight:700;font-size:10px;display:flex;align-items:center;justify-content:center;flex-shrink:0;";
        av.textContent = m.avatar || "?";
        var bubble = document.createElement("div");
        bubble.style.cssText = "max-width:78%;padding:8px 12px;border-radius:10px;" +
          (mine
            ? "background:rgba(184,170,154,0.18);border:1px solid rgba(184,170,154,0.35);border-top-right-radius:3px;"
            : "background:rgba(255,255,255,0.04);border:1px solid #2a2a2a;border-top-left-radius:3px;");
        bubble.innerHTML =
          '<div style="display:flex;gap:8px;align-items:baseline;margin-bottom:3px;">' +
            '<span style="font-size:10px;color:#B8AA9A;font-weight:600;">' + escapeHtml(m.user_name || "—") + '</span>' +
            '<span style="font-size:9px;color:#666;">' + fmtTime(m.created_at) + '</span>' +
          '</div>' +
          '<div style="font-size:12px;color:#ddd;line-height:1.5;white-space:pre-wrap;">' + escapeHtml(m.msg) + '</div>';
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

  // DESATIVADO a pedido do Will (2026-06-09): botão flutuante "💬 Chat" não aparece mais.
  // Overlay openChatPanel() permanece disponível pra chamadas explícitas (window.__pktOpenChat).
  // setInterval(evaluate, 800);
  // evaluate();

  // ── Botões inline (Chat / Anexos) em cards da lista — DESATIVADO ──
  function decorateSimCards() { return; }
  function _decorateSimCardsDisabled_legacy() {
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
  // setInterval(decorateSimCards, 600);  // desativado
  // decorateSimCards();                    // desativado

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
