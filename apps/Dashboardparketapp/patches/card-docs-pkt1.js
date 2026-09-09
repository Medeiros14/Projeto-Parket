/**
 * Anexos & Links do card — unificado entre card comercial e editor de orçamento.
 *
 * - Botão flutuante "📎 Anexos" aparece em ambos os contextos (logo acima
 *   do botão de chat).
 * - Lista PDF, DWG, Imagens, Links (URLs externas) em public.card_documentos.
 * - Adiciona link colando URL + nome + tipo.
 * - context_id = mesmo do chat (kanban_cards.id pra comercial,
 *   simulacao.card_comercial_id||simulacao.id pro orçamento).
 *
 * Tabela: card_documentos (context_id, nome, tipo, url, created_at).
 */
(function () {
  if (window.__pktCardDocsLoaded) return;
  window.__pktCardDocsLoaded = true;

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
            return { name: name, email: u.email };
          }
        } catch (e) {}
      }
    } catch (e) {}
    return { name: "Você", email: null };
  }

  var TIPOS = [
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
  function emoji(t) { var f = TIPOS.find(function (x) { return x.v === t; }); return f ? f.emoji : "📎"; }
  function label(t) { var f = TIPOS.find(function (x) { return x.v === t; }); return f ? f.l : t; }

  // Topic = título do card (lowercase trimmed). Unifica chat/anexos entre
  // cards duplicados com mesmo cliente.
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

  function fetchDocs(contextId) {
    return getTopicForCard(contextId).then(function (topic) {
      var url = topic
        ? SUPA_URL + "/rest/v1/card_documentos?or=(context_id.eq." + contextId + ",topic.eq." + encodeURIComponent(topic) + ")&select=*&order=created_at.desc&limit=200"
        : SUPA_URL + "/rest/v1/card_documentos?context_id=eq." + contextId + "&select=*&order=created_at.desc&limit=200";
      return fetch(url, { headers: { apikey: SUPA_KEY, Authorization: "Bearer " + getToken() } })
        .then(function (r) { return r.ok ? r.json() : []; })
        .catch(function () { return []; });
    });
  }

  function addDoc(contextId, nome, tipo, url) {
    var user = getUserInfo();
    return getTopicForCard(contextId).then(function (topic) {
      var body = {
        context_id: contextId,
        topic: topic || null,
        nome: nome,
        tipo: tipo,
        url: url,
        uploaded_by_name: user.name,
        uploaded_by_email: user.email,
      };
      return fetch(SUPA_URL + "/rest/v1/card_documentos", {
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

  function delDoc(id) {
    return fetch(SUPA_URL + "/rest/v1/card_documentos?id=eq." + id, {
      method: "DELETE",
      headers: { apikey: SUPA_KEY, Authorization: "Bearer " + getToken() },
    });
  }

  function escapeHtml(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c];
    });
  }

  function openDocsPanel(contextId, title) {
    var existing = document.getElementById("pkt-docs-overlay");
    if (existing) existing.remove();

    var overlay = document.createElement("div");
    overlay.id = "pkt-docs-overlay";
    overlay.style.cssText = "position:fixed;inset:0;z-index:99997;background:rgba(0,0,0,0.55);display:flex;align-items:stretch;justify-content:flex-end;backdrop-filter:blur(3px);font-family:-apple-system,Segoe UI,system-ui,sans-serif;";
    overlay.onclick = function (e) { if (e.target === overlay) overlay.remove(); };

    var panel = document.createElement("div");
    panel.style.cssText = "background:#0e0e0e;border-left:1px solid #2a2a2a;width:min(480px,100%);height:100vh;display:flex;flex-direction:column;color:#fff;";
    overlay.appendChild(panel);

    var header = document.createElement("div");
    header.style.cssText = "padding:14px 18px;border-bottom:1px solid #2a2a2a;display:flex;align-items:center;justify-content:space-between;flex-shrink:0;";
    header.innerHTML =
      '<div>' +
        '<div style="font-size:10px;color:#B8AA9A;letter-spacing:0.15em;text-transform:uppercase;">Anexos & Links</div>' +
        '<div style="font-size:13px;color:#fff;font-weight:600;margin-top:2px;">' + escapeHtml(title || "Documentos do card") + '</div>' +
        '<div style="font-size:9px;color:#666;margin-top:2px;">📎 PDF · DWG · Imagens · 🔗 URLs externas</div>' +
      '</div>' +
      '<button id="pkt-docs-close" style="background:rgba(255,255,255,0.07);border:none;border-radius:6px;color:#aaa;width:30px;height:30px;cursor:pointer;font-size:18px;">×</button>';
    panel.appendChild(header);

    var addBox = document.createElement("div");
    addBox.style.cssText = "padding:12px 18px;border-bottom:1px solid #2a2a2a;display:flex;flex-direction:column;gap:8px;flex-shrink:0;background:rgba(184,170,154,0.04);";
    addBox.innerHTML =
      '<div style="display:grid;grid-template-columns:1fr 130px;gap:8px;">' +
        '<input id="pkt-docs-nome" placeholder="Nome (ex: Planta baixa final)" style="background:rgba(255,255,255,0.04);border:1px solid #2a2a2a;color:#fff;padding:8px 10px;border-radius:6px;font-size:12px;outline:none;"/>' +
        '<select id="pkt-docs-tipo" style="background:rgba(255,255,255,0.04);border:1px solid #2a2a2a;color:#fff;padding:8px 10px;border-radius:6px;font-size:12px;outline:none;">' +
          TIPOS.map(function (t) { return '<option value="' + t.v + '">' + t.emoji + ' ' + t.l + '</option>'; }).join("") +
        '</select>' +
      '</div>' +
      '<input id="pkt-docs-url" placeholder="URL — Drive, Dropbox, link público, etc." style="background:rgba(255,255,255,0.04);border:1px solid #2a2a2a;color:#fff;padding:8px 10px;border-radius:6px;font-size:12px;outline:none;"/>' +
      '<button id="pkt-docs-add" style="background:#B8AA9A;color:#000;border:none;border-radius:6px;padding:9px 14px;cursor:pointer;font-weight:700;font-size:12px;">+ Adicionar anexo / link</button>';
    panel.appendChild(addBox);

    var list = document.createElement("div");
    list.id = "pkt-docs-list";
    list.style.cssText = "flex:1;overflow-y:auto;padding:12px 18px;display:flex;flex-direction:column;gap:8px;";
    list.innerHTML = '<div style="font-size:11px;color:#666;text-align:center;padding:20px 0;">Carregando…</div>';
    panel.appendChild(list);

    document.body.appendChild(overlay);

    header.querySelector("#pkt-docs-close").onclick = function () { overlay.remove(); };

    function render(docs) {
      if (!docs.length) {
        list.innerHTML = '<div style="font-size:11px;color:#666;text-align:center;padding:30px 0;">Nenhum anexo/link ainda.</div>';
        return;
      }
      list.innerHTML = "";
      docs.forEach(function (d) {
        var row = document.createElement("div");
        row.style.cssText = "display:flex;align-items:center;gap:10px;padding:10px 12px;background:rgba(255,255,255,0.02);border:1px solid #2a2a2a;border-radius:8px;";
        row.innerHTML =
          '<div style="width:32px;height:32px;border-radius:8px;background:rgba(184,170,154,0.12);display:flex;align-items:center;justify-content:center;font-size:16px;flex-shrink:0;">' + emoji(d.tipo) + '</div>' +
          '<div style="flex:1;min-width:0;">' +
            '<div style="font-size:12px;color:#fff;font-weight:600;text-overflow:ellipsis;white-space:nowrap;overflow:hidden;">' + escapeHtml(d.nome) + '</div>' +
            '<div style="font-size:9px;color:#888;margin-top:2px;text-transform:uppercase;letter-spacing:0.08em;">' + label(d.tipo) + (d.uploaded_by_name ? ' · ' + escapeHtml(d.uploaded_by_name) : '') + '</div>' +
          '</div>' +
          (d.tipo === 'link'
            ? '<a href="' + escapeHtml(d.url) + '" target="_blank" rel="noopener" style="background:rgba(184,170,154,0.15);color:#B8AA9A;border:1px solid rgba(184,170,154,0.3);border-radius:6px;padding:5px 10px;font-size:10px;text-decoration:none;white-space:nowrap;">Abrir ↗</a>'
            : '<a href="' + escapeHtml(d.url) + '" download="' + escapeHtml(d.nome) + '" target="_blank" rel="noopener" style="background:rgba(184,170,154,0.08);color:#B8AA9A;border:1px solid rgba(184,170,154,0.2);border-radius:6px;padding:5px 10px;font-size:10px;text-decoration:none;white-space:nowrap;margin-right:4px;">Baixar ⬇</a>'
              + '<a href="' + escapeHtml(d.url) + '" target="_blank" rel="noopener" style="background:rgba(184,170,154,0.15);color:#B8AA9A;border:1px solid rgba(184,170,154,0.3);border-radius:6px;padding:5px 10px;font-size:10px;text-decoration:none;white-space:nowrap;">Abrir ↗</a>'
          ) +
          '<button data-del="' + d.id + '" style="background:transparent;border:none;color:#888;cursor:pointer;font-size:14px;padding:4px;margin-left:4px;">🗑</button>';
        list.appendChild(row);
      });
      list.querySelectorAll("[data-del]").forEach(function (b) {
        b.onclick = function () {
          if (!confirm("Remover este anexo/link?")) return;
          var id = b.getAttribute("data-del");
          delDoc(id).then(function () {
            refresh();
          });
        };
      });
    }

    function refresh() {
      fetchDocs(contextId).then(render);
    }
    refresh();

    var nomeIn = addBox.querySelector("#pkt-docs-nome");
    var tipoIn = addBox.querySelector("#pkt-docs-tipo");
    var urlIn = addBox.querySelector("#pkt-docs-url");
    var addBtn = addBox.querySelector("#pkt-docs-add");
    addBtn.onclick = function () {
      var n = (nomeIn.value || "").trim();
      var u = (urlIn.value || "").trim();
      var t = tipoIn.value;
      if (!n || !u) { alert("Preencha nome e URL"); return; }
      if (!/^https?:\/\//i.test(u)) u = "https://" + u;
      addBtn.disabled = true;
      addBtn.style.opacity = "0.6";
      addDoc(contextId, n, t, u).then(function () {
        nomeIn.value = "";
        urlIn.value = "";
        addBtn.disabled = false;
        addBtn.style.opacity = "1";
        refresh();
      });
    };
    urlIn.onkeydown = function (e) { if (e.key === "Enter") addBtn.click(); };

    setTimeout(function () { nomeIn.focus(); }, 100);
  }

  // ── Botão flutuante ── (acima do botão de chat)
  function injectFloatBtn(contextId, title) {
    var old = document.getElementById("pkt-docs-fab");
    if (old) old.remove();
    var btn = document.createElement("button");
    btn.id = "pkt-docs-fab";
    btn.style.cssText = "position:fixed;right:18px;bottom:64px;z-index:9990;background:#1e1e1e;color:#B8AA9A;border:1px solid #B8AA9A;border-radius:50px;padding:9px 16px;font-weight:700;font-size:12px;cursor:pointer;box-shadow:0 6px 20px rgba(0,0,0,0.5);display:flex;align-items:center;gap:8px;font-family:-apple-system,Segoe UI,system-ui,sans-serif;";
    btn.innerHTML = '<span style="font-size:14px;">📎</span> Anexos';
    btn.onclick = function () { openDocsPanel(contextId, title); };
    document.body.appendChild(btn);
  }

  function removeFloatBtn() {
    var old = document.getElementById("pkt-docs-fab");
    if (old) old.remove();
  }

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

  var lastContext = null;
  function evaluate() {
    // Anexos ficam APENAS inline (aba dentro do modal). Sem FAB nunca.
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
    if (ctx) injectFloatBtn(ctx.contextId, ctx.title);
    else removeFloatBtn();
  }

  setInterval(evaluate, 800);
  evaluate();

  // ── Inline anexos dentro do mount point #pkt-modal-anexos-mount ──
  function renderInlineDocsPanel(mount) {
    if (!mount || mount.__pktDocsMounted) return;
    mount.__pktDocsMounted = true;
    var contextId = mount.getAttribute("data-card-id");
    if (!contextId) return;

    mount.innerHTML = "";
    mount.style.cssText = "display:flex;flex-direction:column;gap:12px;color:#fff;";

    var addBox = document.createElement("div");
    addBox.style.cssText = "background:rgba(184,170,154,0.04);border:1px solid #2a2a2a;border-radius:10px;padding:12px;display:flex;flex-direction:column;gap:8px;";
    addBox.innerHTML =
      '<div style="display:grid;grid-template-columns:1fr 160px;gap:8px;">' +
        '<input id="pkt-inline-doc-nome" placeholder="Nome (ex: Planta baixa final)" style="background:rgba(255,255,255,0.04);border:1px solid #2a2a2a;color:#fff;padding:8px 10px;border-radius:6px;font-size:12px;outline:none;"/>' +
        '<select id="pkt-inline-doc-tipo" style="background:rgba(255,255,255,0.04);border:1px solid #2a2a2a;color:#fff;padding:8px 10px;border-radius:6px;font-size:12px;outline:none;">' +
          TIPOS.map(function (t) { return '<option value="' + t.v + '">' + t.emoji + ' ' + t.l + '</option>'; }).join("") +
        '</select>' +
      '</div>' +
      '<input id="pkt-inline-doc-url" placeholder="URL — Drive, Dropbox, link público, etc." style="background:rgba(255,255,255,0.04);border:1px solid #2a2a2a;color:#fff;padding:8px 10px;border-radius:6px;font-size:12px;outline:none;"/>' +
      '<button id="pkt-inline-doc-add" style="background:#B8AA9A;color:#000;border:none;border-radius:6px;padding:9px 14px;cursor:pointer;font-weight:700;font-size:12px;">+ Adicionar anexo / link</button>';
    mount.appendChild(addBox);

    var list = document.createElement("div");
    list.style.cssText = "display:flex;flex-direction:column;gap:8px;";
    list.innerHTML = '<div style="font-size:11px;color:#666;text-align:center;padding:20px 0;">Carregando…</div>';
    mount.appendChild(list);

    function render(docs) {
      if (!docs.length) {
        list.innerHTML = '<div style="font-size:11px;color:#666;text-align:center;padding:24px 0;font-style:italic;">Nenhum anexo/link ainda.</div>';
        return;
      }
      list.innerHTML = "";
      docs.forEach(function (d) {
        var row = document.createElement("div");
        row.style.cssText = "display:flex;align-items:center;gap:10px;padding:10px 12px;background:rgba(255,255,255,0.02);border:1px solid #2a2a2a;border-radius:8px;";
        row.innerHTML =
          '<div style="width:32px;height:32px;border-radius:8px;background:rgba(184,170,154,0.12);display:flex;align-items:center;justify-content:center;font-size:16px;flex-shrink:0;">' + emoji(d.tipo) + '</div>' +
          '<div style="flex:1;min-width:0;">' +
            '<div style="font-size:12px;color:#fff;font-weight:600;text-overflow:ellipsis;white-space:nowrap;overflow:hidden;">' + escapeHtml(d.nome) + '</div>' +
            '<div style="font-size:9px;color:#888;margin-top:2px;text-transform:uppercase;letter-spacing:0.08em;">' + label(d.tipo) + (d.uploaded_by_name ? ' · ' + escapeHtml(d.uploaded_by_name) : '') + '</div>' +
          '</div>' +
          (d.tipo === 'link'
            ? '<a href="' + escapeHtml(d.url) + '" target="_blank" rel="noopener" style="background:rgba(184,170,154,0.15);color:#B8AA9A;border:1px solid rgba(184,170,154,0.3);border-radius:6px;padding:5px 10px;font-size:10px;text-decoration:none;white-space:nowrap;">Abrir ↗</a>'
            : '<a href="' + escapeHtml(d.url) + '" download="' + escapeHtml(d.nome) + '" target="_blank" rel="noopener" style="background:rgba(184,170,154,0.08);color:#B8AA9A;border:1px solid rgba(184,170,154,0.2);border-radius:6px;padding:5px 10px;font-size:10px;text-decoration:none;white-space:nowrap;margin-right:4px;">Baixar ⬇</a>'
              + '<a href="' + escapeHtml(d.url) + '" target="_blank" rel="noopener" style="background:rgba(184,170,154,0.15);color:#B8AA9A;border:1px solid rgba(184,170,154,0.3);border-radius:6px;padding:5px 10px;font-size:10px;text-decoration:none;white-space:nowrap;">Abrir ↗</a>'
          ) +
          '<button data-del="' + d.id + '" style="background:transparent;border:none;color:#888;cursor:pointer;font-size:14px;padding:4px;margin-left:4px;">🗑</button>';
        list.appendChild(row);
      });
      list.querySelectorAll("[data-del]").forEach(function (b) {
        b.onclick = function () {
          if (!confirm("Remover este anexo/link?")) return;
          delDoc(b.getAttribute("data-del")).then(refresh);
        };
      });
    }

    function refresh() { fetchDocs(contextId).then(render); }
    refresh();

    var nomeIn = addBox.querySelector("#pkt-inline-doc-nome");
    var tipoIn = addBox.querySelector("#pkt-inline-doc-tipo");
    var urlIn = addBox.querySelector("#pkt-inline-doc-url");
    var addBtn = addBox.querySelector("#pkt-inline-doc-add");
    addBtn.onclick = function () {
      var n = (nomeIn.value || "").trim();
      var u = (urlIn.value || "").trim();
      var t = tipoIn.value;
      if (!n || !u) { alert("Preencha nome e URL"); return; }
      if (!/^https?:\/\//i.test(u)) u = "https://" + u;
      addBtn.disabled = true; addBtn.style.opacity = "0.6";
      addDoc(contextId, n, t, u).then(function () {
        nomeIn.value = ""; urlIn.value = "";
        addBtn.disabled = false; addBtn.style.opacity = "1";
        refresh();
      });
    };
    urlIn.onkeydown = function (e) { if (e.key === "Enter") addBtn.click(); };
  }

  setInterval(function () {
    var mount = document.getElementById("pkt-modal-anexos-mount");
    if (mount && !mount.__pktDocsMounted) renderInlineDocsPanel(mount);
  }, 400);

  window.__pktOpenCardDocs = openDocsPanel;
  console.log("[pkt-docs] anexos & links panel loaded");
})();
