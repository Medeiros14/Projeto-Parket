/**
 * Kanban History Panel — patch chunk Parket
 * Observa abertura de modais de card no kanban (comercial/orçamento/etc.) e
 * injeta um botão "📜 Histórico" no header. Ao clicar, abre um painel
 * lateral com toda a movimentação registrada em kanban_card_history
 * (quem moveu, de qual coluna pra qual, quando).
 *
 * O carimbo "quem moveu" vem do trigger SQL que captura auth.uid()/email
 * do usuário logado a cada UPDATE de column_id em kanban_cards.
 */
(function(){
  if (window.__pktHistoryPatchLoaded) return;
  window.__pktHistoryPatchLoaded = true;

  var SUPA_URL = "https://hbxpilrxmitvzebluoom.supabase.co";
  var SUPA_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhieHBpbHJ4bWl0dnplYmx1b29tIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI5NDI1MjcsImV4cCI6MjA4ODUxODUyN30.ciZA1H-UvlYG2OPWqrFChj-_ttiFD5W5BmrST-gUJ-0";

  // Token do usuário logado (RLS)
  function getToken(){
    try {
      for (var i = 0; i < localStorage.length; i++) {
        var k = localStorage.key(i);
        var raw = k && localStorage.getItem(k);
        if (!raw || (raw[0] !== "{" && raw[0] !== "[")) continue;
        try {
          var p = JSON.parse(raw);
          var t = (p && p.access_token) || (p && p.currentSession && p.currentSession.access_token) || null;
          if (t && t.length > 40) return t;
        } catch(e) {}
      }
    } catch(e) {}
    return SUPA_KEY;
  }

  function fetchHistory(cardId){
    var url = SUPA_URL + "/rest/v1/kanban_card_history?card_id=eq." + cardId + "&select=*&order=moved_at.desc&limit=50";
    return fetch(url, {
      headers: { apikey: SUPA_KEY, Authorization: "Bearer " + getToken() }
    }).then(function(r){
      if (!r.ok) throw new Error("HTTP " + r.status);
      return r.json();
    });
  }

  // Labels amigáveis das colunas (alguns slugs comuns)
  var COL_LABELS = {
    "novo": "Novo", "qualificado": "Qualificado", "morno": "Morno", "quente": "Quente", "frio": "Frio",
    "apresentacao": "Apresentação", "apresentacao-proposta": "Apresentação Proposta",
    "negociacao": "Negociação", "ganho": "Ganho", "perda": "Perda", "perdido": "Perdido",
    "solicitacao": "Solicitação", "em-progresso": "Em Progresso", "analise-orc": "Em Análise",
    "analise-douglas": "Análise Douglas", "refazer": "Refazer", "proposta-pronta": "Proposta Pronta", "handoff-com": "Enviada Comercial",
    "proposta-aceita": "Aprovado", "encerrado": "Encerrado",
  };
  function colLabel(slug){ return COL_LABELS[slug] || (slug || "—"); }

  function fmtDateTime(iso){
    try {
      var d = new Date(iso);
      return d.toLocaleDateString("pt-BR") + " " + d.toLocaleTimeString("pt-BR", {hour:"2-digit",minute:"2-digit"});
    } catch(e) { return iso; }
  }

  function whoLabel(row){
    var name = (row.moved_by_name || "").trim();
    var email = (row.moved_by_email || "").trim();
    if (name) return name + (email ? " (" + email + ")" : "");
    if (email) return email;
    if (row.moved_by_uid) return "uid " + row.moved_by_uid.slice(0,8);
    return "Sistema/anônimo";
  }

  // ── Painel flutuante de histórico ──
  function openHistoryPanel(cardId, cardTitle){
    var existing = document.getElementById("pkt-hist-overlay");
    if (existing) existing.remove();

    var overlay = document.createElement("div");
    overlay.id = "pkt-hist-overlay";
    overlay.style.cssText = "position:fixed;inset:0;z-index:9998;background:rgba(0,0,0,0.55);display:flex;align-items:center;justify-content:center;padding:20px;backdrop-filter:blur(4px);";
    overlay.onclick = function(e){ if (e.target === overlay) overlay.remove(); };

    var panel = document.createElement("div");
    panel.style.cssText = "background:#141414;border:1px solid #2a2a2a;border-radius:10px;width:min(560px,100%);max-height:80vh;display:flex;flex-direction:column;overflow:hidden;box-shadow:0 12px 48px rgba(0,0,0,0.4);";
    panel.innerHTML =
      '<div style="padding:14px 18px;border-bottom:1px solid #222;display:flex;justify-content:space-between;align-items:center;background:linear-gradient(180deg,#1a1a1a,#111)">' +
        '<div>' +
          '<div style="font-size:9px;color:#888;letter-spacing:0.08em;text-transform:uppercase;font-weight:700">HISTÓRICO DE MOVIMENTAÇÃO</div>' +
          '<div style="font-size:13px;color:#fff;font-weight:600;margin-top:2px">' + (cardTitle || "Card") + '</div>' +
        '</div>' +
        '<button id="pkt-hist-close" style="background:transparent;color:#888;border:1px solid #333;padding:4px 9px;border-radius:4px;cursor:pointer;font-size:13px">✕</button>' +
      '</div>' +
      '<div id="pkt-hist-body" style="padding:14px 16px;overflow-y:auto;color:#ccc;font-size:12px;line-height:1.5">Carregando…</div>';
    overlay.appendChild(panel);
    document.body.appendChild(overlay);
    document.getElementById("pkt-hist-close").onclick = function(){ overlay.remove(); };

    fetchHistory(cardId).then(function(rows){
      var body = document.getElementById("pkt-hist-body");
      if (!body) return;
      if (!rows || rows.length === 0){
        body.innerHTML = '<div style="text-align:center;color:#888;padding:30px 0">Sem movimentações registradas para este card ainda.<br><small style="color:#666">O tracking começou a registrar a partir de 01/06/2026.</small></div>';
        return;
      }
      var html = '<div style="display:flex;flex-direction:column;gap:8px">';
      rows.forEach(function(r){
        var moved = fmtDateTime(r.moved_at);
        var who = whoLabel(r);
        html += '<div style="padding:10px 12px;background:#0f0f0f;border:1px solid #222;border-radius:6px;border-left:3px solid #B8AA9A">' +
          '<div style="display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap;margin-bottom:4px">' +
            '<span style="color:#fff;font-weight:600">' + who + '</span>' +
            '<span style="color:#888;font-size:11px">' + moved + '</span>' +
          '</div>' +
          '<div style="color:#888">' +
            '<span style="color:#aaa">' + colLabel(r.from_column) + '</span>' +
            ' <span style="color:#B8AA9A">→</span> ' +
            '<span style="color:#fff;font-weight:600">' + colLabel(r.to_column) + '</span>' +
          '</div>' +
        '</div>';
      });
      html += '</div>';
      body.innerHTML = html;
    }).catch(function(err){
      var body = document.getElementById("pkt-hist-body");
      if (body) body.innerHTML = '<div style="color:#F87171;text-align:center;padding:20px">Erro ao buscar histórico: ' + err.message + '</div>';
    });
  }
  // Expõe pra debug e pra outros patches chamarem direto
  window.__pktOpenCardHistory = openHistoryPanel;

  // ── Observa modais de card abrindo e injeta botão "📜 Histórico" ──
  // Heurística: procura por divs que pareçam ser modal de card (têm campo descrição/título grande)
  function tryInjectButton(){
    // Padrões comuns: dialog, modal, classes contendo "card", header com botão de fechar
    var headers = document.querySelectorAll('[role="dialog"] header, [role="dialog"] > div:first-child, .modal-header, [class*="ModalHeader"]');
    headers.forEach(function(h){
      if (h.querySelector('.pkt-hist-btn')) return; // já injetado
      // tenta achar o card-id mais próximo via dataset ou URL
      var modal = h.closest('[role="dialog"], .modal, [class*="Modal"]');
      if (!modal) return;
      // procura por links ou data attrs com UUID
      var cardId = modal.getAttribute('data-card-id') || (function(){
        var ds = modal.querySelector('[data-card-id]'); return ds ? ds.getAttribute('data-card-id') : null;
      })();
      // fallback: pega da URL se rota tem /:id
      if (!cardId) {
        var m = window.location.pathname.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
        cardId = m ? m[0] : null;
      }
      if (!cardId) return;
      var btn = document.createElement("button");
      btn.className = "pkt-hist-btn";
      btn.textContent = "📜 Histórico";
      btn.style.cssText = "background:rgba(184,170,154,0.15);color:#B8AA9A;border:1px solid #B8AA9A55;padding:5px 10px;border-radius:4px;cursor:pointer;font-size:11px;font-weight:600;margin-right:8px;";
      btn.onclick = function(){
        var titleEl = modal.querySelector('h1, h2, h3, [class*="title"], [class*="Title"]');
        openHistoryPanel(cardId, titleEl ? titleEl.textContent.trim() : "Card");
      };
      h.appendChild(btn);
    });
  }

  // Observer global pra detectar modais abrindo
  var obs = new MutationObserver(function(){ tryInjectButton(); });
  obs.observe(document.body, { childList: true, subtree: true });
  tryInjectButton();
})();
