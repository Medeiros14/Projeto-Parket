/**
 * CEO Aprovações — chunk hotpatch Parket
 * No /ceo-dashboard, injeta uma ABA nova "✓ Aprovação (N)" no menu de abas,
 * posicionada logo após "📊 Projetos". Click → abre overlay com a fila de
 * propostas pendentes, com botões Aprovar/Rejeitar funcionando direto via API.
 */
(function () {
  if (typeof window === "undefined") return;
  if (window.__pktCeoAprovLoaded) return;
  window.__pktCeoAprovLoaded = true;

  const SB_URL = "https://hbxpilrxmitvzebluoom.supabase.co";
  const SB_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhieHBpbHJ4bWl0dnplYmx1b29tIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI5NDI1MjcsImV4cCI6MjA4ODUxODUyN30.ciZA1H-UvlYG2OPWqrFChj-_ttiFD5W5BmrST-gUJ-0";
  const API = "https://core.parket.works";
  const REFRESH_MS = 60_000;

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

  // Acha a barra de abas — procura pelo botão com texto "📊 Projetos"
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
    // Copia classes/estilos do botão Projetos pra ficar idêntico
    if (refBtn) {
      tab.className = refBtn.className || "";
      const inline = refBtn.getAttribute("style") || "";
      tab.setAttribute("style", inline);
      // Garante que NUNCA fique com o estado ativo do "Projetos"
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
    if (!found) return;  // tabbar ainda não renderizada
    const existing = document.getElementById("pkt-ceo-aprov-tab");
    if (existing) {
      // só atualiza contador
      existing.innerHTML =
        '<span style="display:inline-flex;align-items:center;gap:6px">✓ Aprovação' +
        (lastCount > 0 ? ' <span style="background:' + (lastCount >= 5 ? '#EF4444' : '#D4A853') + ';color:#000;font-size:10px;font-weight:800;padding:1px 7px;border-radius:10px;line-height:1.3">' + lastCount + '</span>' : '') +
        '</span>';
      // Reposiciona caso o React tenha re-renderizado os botões
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

  // ════════════════════════════════════════════════════════════════════
  // OVERLAY com a fila de aprovação (abre DENTRO do CEO Dashboard)
  // ════════════════════════════════════════════════════════════════════
  let pendentesCache = null;

  async function fetchPendentes() {
    try {
      const r = await fetch(`${API}/api/orcamento/aprovacao/pendentes`);
      return r.ok ? await r.json() : { items: [] };
    } catch { return { items: [] }; }
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
    renderLista();
  }

  // Estado da view: "lista" ou "proposta" (ver proposta dentro do overlay)
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
          '<div style="flex:1"></div>' +
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
        await acaoDecisao(act, cardId, btn);
      };
    });
  }

  // View "proposta" — igual ao homebroker: topo com cliente+fechar, iframe
  // no meio com a proposta inteira, rodapé com info + Reprovar/Aprovar
  function renderProposta(item) {
    const body = document.getElementById("pkt-overlay-body");
    if (!body || !item.proposta_link) return;
    viewState = "proposta";
    propostaAberta = item;

    // Sair do mode "padded body" — vai ocupar tudo
    body.style.padding = "0";
    body.style.maxWidth = "none";
    body.style.gap = "0";

    body.innerHTML =
      // Topo: cliente + voltar
      '<div style="background:#0A0A0A;border-bottom:1px solid rgba(255,255,255,0.08);padding:10px 18px;display:flex;align-items:center;justify-content:space-between;gap:12px;flex-shrink:0">' +
        '<div style="flex:1;min-width:0"><div style="font-size:14px;font-weight:700;color:#fff;line-height:1.2">' + (item.cliente || "—") + '</div></div>' +
        '<a href="' + item.proposta_link + '" target="_blank" rel="noopener" title="Abrir em nova aba" style="padding:6px 10px;border-radius:6px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.12);color:rgba(255,255,255,0.6);text-decoration:none;font-size:11px;font-weight:700">↗</a>' +
        '<button id="pkt-back-list" title="Voltar à lista" style="padding:6px 10px;border-radius:6px;background:transparent;border:1px solid rgba(255,255,255,0.2);color:#fff;cursor:pointer;font-size:12px;font-weight:700">← Voltar</button>' +
      '</div>' +
      // Iframe
      '<iframe src="' + item.proposta_link + '" style="flex:1;width:100%;border:0;background:#fff" title="Proposta"></iframe>' +
      // Rodapé: info + ações
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
          '<button data-act="rejeitar" data-id="' + item.card.id + '" style="padding:8px 18px;border-radius:6px;background:rgba(239,68,68,0.2);border:1px solid rgba(239,68,68,0.55);color:#EF4444;cursor:pointer;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.05em">✕ Reprovar</button>' +
          '<button data-act="aprovar" data-id="' + item.card.id + '" style="padding:8px 18px;border-radius:6px;background:rgba(16,185,129,0.25);border:1px solid rgba(16,185,129,0.6);color:#10B981;cursor:pointer;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.05em">✓ Aprovar</button>' +
        '</div>' +
      '</div>';

    document.getElementById("pkt-back-list").onclick = () => {
      // restaura layout padded
      body.style.padding = "24px";
      body.style.maxWidth = "1100px";
      body.style.gap = "14px";
      renderLista();
    };
    body.querySelectorAll("button[data-act]").forEach((btn) => {
      btn.onclick = async () => {
        await acaoDecisao(btn.dataset.act, btn.dataset.id, btn);
      };
    });
  }

  async function acaoDecisao(act, cardId, btn) {
    const email = getUserEmail();
    const nome = getUserNome();
    if (!email) { alert("Login não detectado"); return; }
    const reqBody = { email, nome };
    if (act === "rejeitar") {
      const m = prompt("Motivo da rejeição (obrigatório):");
      if (!m || !m.trim()) return;
      reqBody.motivo = m.trim();
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
      pendentesCache = pendentesCache.filter((p) => p.card.id !== cardId);
      lastCount = pendentesCache.length;
      ensureTab();
      // Volta pra lista
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
