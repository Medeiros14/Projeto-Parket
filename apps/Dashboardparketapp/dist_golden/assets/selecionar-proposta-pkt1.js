/**
 * Selecionar Proposta — chunk hotpatch Parket
 *
 * Comportamento simples e robusto:
 *  - Quadradinho ao lado de "Editar" em cada proposta quando há 2+ no mesmo card
 *  - Click otimista: muda visual INSTANTÂNEO (sem esperar backend)
 *  - Click numa: a anterior desmarca sozinha
 *  - Click na verde: desmarca tudo
 *  - Backend roda em background; se falhar, reverte visual
 *
 * Detecção via MutationObserver (não polling) — sem race com click.
 */
(function () {
  if (typeof window === "undefined") return;
  if (window.__pktSelLoaded) return;
  window.__pktSelLoaded = true;

  const SB_URL = "https://hbxpilrxmitvzebluoom.supabase.co";
  const SB_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhieHBpbHJ4bWl0dnplYmx1b29tIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI5NDI1MjcsImV4cCI6MjA4ODUxODUyN30.ciZA1H-UvlYG2OPWqrFChj-_ttiFD5W5BmrST-gUJ-0";
  const API = "https://core.parket.works";

  function log() {
    try { console.log.apply(console, ["[pkt-sel]"].concat([].slice.call(arguments))); } catch {}
  }

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

  // ════ Estado global ═════════════════════════════════════
  // simId → estado visual ("selected" | "unselected")
  // Source of truth LOCAL durante interação. Ignora banco enquanto user mexe.
  const localState = new Map();
  // numero → { sim_id, card_key, selected_at_remote }
  const propCache = new Map();
  // card_key → Array<{box, sim_id, numero}> dos boxes injetados
  const groupBoxes = new Map();
  // simId → timestamp do último click (lockedAt — banco não sobrescreve por 60s)
  const lockedUntil = new Map();

  async function resolveByNumero(numero) {
    if (propCache.has(numero)) return propCache.get(numero);
    try {
      const r = await fetch(`${SB_URL}/rest/v1/simulacao_projetos?select=id,numero,card_id,card_comercial_id,obra_id,selected_at&numero=eq.${numero}&limit=1`, {
        headers: { apikey: SB_KEY },
      });
      const a = await r.json();
      const s = a && a[0];
      if (!s) { propCache.set(numero, null); return null; }
      const ent = {
        sim_id: s.id,
        card_key: s.card_comercial_id || s.card_id || ("obra:" + (s.obra_id || numero)),
        selected_at_remote: s.selected_at,
      };
      propCache.set(numero, ent);
      return ent;
    } catch (e) { propCache.set(numero, null); return null; }
  }

  function paint(box, isSel) {
    box.textContent = isSel ? "✓" : "";
    box.style.background = isSel ? "#10B981" : "rgba(255,255,255,0.06)";
    box.style.borderColor = isSel ? "#10B981" : "rgba(255,255,255,0.32)";
    box.style.color = "#fff";
    box.dataset.sel = isSel ? "1" : "0";
  }

  // === click handler ============================================
  function makeClickHandler(simId, cardKey, email) {
    return async function onClick(ev) {
      ev.preventDefault();
      ev.stopPropagation();
      const me = groupBoxes.get(cardKey);
      if (!me) return;
      const self = me.find(b => b.sim_id === simId);
      if (!self) return;
      if (self.box.dataset.busy === "1") return;

      const wasSel = self.box.dataset.sel === "1";
      const newSel = !wasSel;

      // Trava local: backend é canônico mas só após 60s sem click do user
      const now = Date.now();
      const lockUntil = now + 60_000;
      lockedUntil.set(simId, lockUntil);

      // Update OTIMISTA — instantâneo
      if (newSel) {
        // Eu viro verde, irmãos viram vazio
        me.forEach(b => {
          paint(b.box, b.sim_id === simId);
          localState.set(b.sim_id, b.sim_id === simId ? "selected" : "unselected");
          lockedUntil.set(b.sim_id, lockUntil);
        });
      } else {
        paint(self.box, false);
        localState.set(simId, "unselected");
      }

      self.box.dataset.busy = "1";
      const url = newSel
        ? `${API}/api/orcamento/simulacao/${simId}/selecionar`
        : `${API}/api/orcamento/simulacao/${simId}/desselecionar`;
      log(newSel ? "MARCANDO" : "DESMARCANDO", simId);
      try {
        const r = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email }),
        });
        if (!r.ok) {
          const j = await r.json().catch(() => ({}));
          log("ERRO BACKEND:", r.status, j);
          // Reverte tudo
          me.forEach(b => {
            const old = b.sim_id === simId ? wasSel : (localState.get(b.sim_id) === "selected");
            paint(b.box, old);
            localState.set(b.sim_id, old ? "selected" : "unselected");
          });
          lockedUntil.delete(simId);
          alert("Erro ao salvar: " + (j.detail || r.status));
          return;
        }
        log(newSel ? "✓ MARCADO" : "✓ DESMARCADO", simId);
        propCache.clear();
      } catch (e) {
        log("ERRO REDE:", e.message);
        paint(self.box, wasSel);
        localState.set(simId, wasSel ? "selected" : "unselected");
      } finally {
        self.box.dataset.busy = "0";
      }
    };
  }

  function makeBox(simId, cardKey, email) {
    const box = document.createElement("button");
    box.setAttribute("data-pkt-sel-box", "1");
    box.setAttribute("data-sim-id", simId);
    box.title = "Marcar como proposta principal";
    Object.assign(box.style, {
      marginLeft: "8px",
      width: "24px",
      height: "24px",
      padding: "0",
      borderRadius: "5px",
      cursor: "pointer",
      fontSize: "15px",
      fontWeight: "700",
      lineHeight: "1",
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      verticalAlign: "middle",
      transition: "background 0.12s, border-color 0.12s",
      border: "1.5px solid rgba(255,255,255,0.32)",
      background: "rgba(255,255,255,0.06)",
      color: "#fff",
      boxSizing: "border-box",
    });
    box.onclick = makeClickHandler(simId, cardKey, email);
    return box;
  }

  // === detecção de cards ========================================
  async function processarUmaProposta(cardEl, editBtn, email) {
    // Pega o número (3-6 dígitos puro) num span/div próximo
    const spans = cardEl.querySelectorAll("span,div,h1,h2,h3,h4,p,strong,b,td");
    let numero = null;
    for (const s of spans) {
      const t = (s.textContent || "").trim();
      if (/^\d{3,6}$/.test(t)) { numero = t; break; }
    }
    if (!numero) return null;

    const ent = await resolveByNumero(numero);
    if (!ent) return null;
    return { cardEl, editBtn, numero, ent };
  }

  function acharCardsDeProposta() {
    const results = [];
    // pkt2: usa os data-attrs já injetados pelo simulador-tab (MARCFIX).
    // Cada proposta tem `data-pkt-sim-id` e `data-pkt-sim-card` no DOM.
    const simDivs = document.querySelectorAll("[data-pkt-sim-id]");
    simDivs.forEach(div => {
      const simId = div.getAttribute("data-pkt-sim-id");
      const cardKey = div.getAttribute("data-pkt-sim-card") || ("sim:" + simId);
      if (!simId) return;
      // Acha o botão "Editar" dentro dessa div (text === "Editar", sem ícone)
      const editBtn = Array.from(div.querySelectorAll("button")).find(b => {
        const t = (b.textContent || "").trim();
        return t === "Editar";
      });
      if (!editBtn) return;
      results.push({ cardEl: div, editBtn, simId, cardKey });
    });
    return results;
  }

  async function fetchSelectedFlags(simIds) {
    if (!simIds.length) return {};
    try {
      const url = SB_URL + "/rest/v1/simulacao_projetos?id=in.(" + simIds.join(",") + ")&select=id,selected_at";
      const r = await fetch(url, { headers: { apikey: SB_KEY } });
      const a = await r.json();
      const out = {};
      a.forEach(s => { out[s.id] = s.selected_at; });
      return out;
    } catch (_) { return {}; }
  }

  async function scan() {
    const email = getUserEmail();
    if (!email) return;

    const cards = acharCardsDeProposta();
    if (cards.length === 0) {
      document.querySelectorAll("[data-pkt-sel-box='1']").forEach(b => b.remove());
      groupBoxes.clear();
      return;
    }

    // Agrupa por cardKey (card_comercial_id)
    const grupos = new Map();
    for (const c of cards) {
      const key = c.cardKey;
      if (!grupos.has(key)) grupos.set(key, []);
      grupos.get(key).push(c);
    }

    // Coleta simIds que precisam do flag selected_at (apenas grupos 2+)
    const idsToFetch = [];
    grupos.forEach((items) => {
      if (items.length >= 2) items.forEach(it => idsToFetch.push(it.simId));
    });
    const remoteFlags = await fetchSelectedFlags(idsToFetch);

    grupos.forEach((items, cardKey) => {
      if (items.length < 2) {
        // Grupo de 1: remove qualquer box que tenha ficado pendurada
        items.forEach(i => {
          const existing = i.editBtn.parentElement && i.editBtn.parentElement.querySelector("[data-pkt-sel-box='1']");
          if (existing) existing.remove();
        });
        return;
      }
      const arr = [];
      items.forEach((it) => {
        let box = i_existsForSimId(it.simId);
        if (!box) {
          box = makeBox(it.simId, cardKey, email);
          if (it.editBtn.parentElement) {
            it.editBtn.parentElement.insertBefore(box, it.editBtn.nextSibling);
          }
        } else {
          box.onclick = makeClickHandler(it.simId, cardKey, email);
          // Re-insere caso React tenha movido (volta ao lado do Editar)
          if (it.editBtn.nextSibling !== box && it.editBtn.parentElement) {
            it.editBtn.parentElement.insertBefore(box, it.editBtn.nextSibling);
          }
        }
        const now = Date.now();
        const lock = lockedUntil.get(it.simId) || 0;
        if (lock > now && localState.has(it.simId)) {
          paint(box, localState.get(it.simId) === "selected");
        } else {
          const selRemote = !!remoteFlags[it.simId];
          paint(box, selRemote);
          localState.set(it.simId, selRemote ? "selected" : "unselected");
        }
        arr.push({ box, sim_id: it.simId });
      });
      groupBoxes.set(cardKey, arr);
    });
  }

  function i_existsForSimId(simId) {
    return document.querySelector(`[data-pkt-sel-box="1"][data-sim-id="${simId}"]`);
  }

  // === MutationObserver: roda scan quando o DOM muda ============
  // Mas debounced pra não rodar 100x por segundo.
  let scanTimer = null;
  function scheduleScan() {
    if (scanTimer) return;
    scanTimer = setTimeout(() => { scanTimer = null; scan(); }, 600);
  }

  // Roda scan no load
  if (document.readyState === "complete" || document.readyState === "interactive") {
    setTimeout(scan, 800);
  } else {
    document.addEventListener("DOMContentLoaded", () => setTimeout(scan, 800));
  }

  // Observer no body — quando o React re-renderiza, agenda novo scan
  const obs = new MutationObserver(() => scheduleScan());
  if (document.body) {
    obs.observe(document.body, { childList: true, subtree: true });
  } else {
    document.addEventListener("DOMContentLoaded", () => {
      obs.observe(document.body, { childList: true, subtree: true });
    });
  }

  // Re-scan a cada 15s só pra absorver mudanças do banco de outros users
  setInterval(() => {
    propCache.clear();
    scheduleScan();
  }, 15000);

  log("loaded");
})();
