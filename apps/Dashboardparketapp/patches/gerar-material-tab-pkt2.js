/**
 * Gerar Orçamento de Material — chunk hotpatch Parket (v2)
 *
 * Mudanças v2:
 *  - Visual feedback: tab Material fica destacada quando ativa
 *  - Save robusto: intercepta RESPONSE do POST/PATCH (não o request) e
 *    faz PATCH adicional pra gravar meta.tipo_orcamento='material'.
 *    Mais confiável que mexer no body do request (Supabase-js encapsula
 *    body em Request objects que não dá pra modificar facilmente).
 *  - Periódico re-aplica ocultação CSS em itens INSUMOS/INSTALAÇÃO/MÃO DE OBRA
 */
(function () {
  if (typeof window === "undefined") return;
  if (window.__pktGerarMaterialLoaded) return;
  window.__pktGerarMaterialLoaded = true;
  window.__pkt_modo_material = false;
  window.__pkt_modo_material_sim_ids = new Set(); // sims que foram salvas em modo material

  const REST = "https://api.parket.works/rest/v1";
  const ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhieHBpbHJ4bWl0dnplYmx1b29tIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI5NDI1MjcsImV4cCI6MjA4ODUxODUyN30.ciZA1H-UvlYG2OPWqrFChj-_ttiFD5W5BmrST-gUJ-0";

  function log() { try { console.log.apply(console, ["[pkt-mat]"].concat([].slice.call(arguments))); } catch {} }

  // ════════════════════════════════════════════════════════════
  // 1. Interceptor de fetch (response) — marca meta após save
  // ════════════════════════════════════════════════════════════
  async function marcarSimComoMaterial(simId) {
    if (!simId) return;
    if (window.__pkt_modo_material_sim_ids.has(simId)) return;
    window.__pkt_modo_material_sim_ids.add(simId);
    try {
      // Lê meta atual, mescla e grava
      const r = await fetch(`${REST}/simulacao_projetos?id=eq.${simId}&select=meta`, {
        headers: { apikey: ANON, Authorization: `Bearer ${ANON}` },
      });
      const arr = await r.json();
      const cur = (arr && arr[0] && arr[0].meta) || {};
      const novoMeta = Object.assign({}, cur, { tipo_orcamento: "material" });
      await fetch(`${REST}/simulacao_projetos?id=eq.${simId}`, {
        method: "PATCH",
        headers: { apikey: ANON, Authorization: `Bearer ${ANON}`, "Content-Type": "application/json" },
        body: JSON.stringify({ meta: novoMeta }),
      });
      log("sim", simId, "marcada como material");
    } catch (e) {
      log("falha marcar material:", e);
      window.__pkt_modo_material_sim_ids.delete(simId);
    }
  }

  const _origFetch = window.fetch.bind(window);
  window.fetch = async function (input, init) {
    const url = (typeof input === "string" ? input : (input && input.url)) || "";
    const method = (init && init.method) || (input && input.method) || "GET";
    const isSimCall = /\/rest\/v1\/simulacao_projetos(\?|$|\/)/.test(url);
    const isWriteCall = method === "POST" || method === "PATCH";

    const resp = await _origFetch(input, init);

    // Só intercepta SE flag está ativa E é call que cria/atualiza simulacao_projetos
    if (window.__pkt_modo_material && isSimCall && isWriteCall && resp && resp.ok) {
      try {
        const clone = resp.clone();
        const text = await clone.text();
        if (text) {
          let data;
          try { data = JSON.parse(text); } catch { data = null; }
          const ids = [];
          if (Array.isArray(data)) data.forEach(d => d && d.id && ids.push(d.id));
          else if (data && data.id) ids.push(data.id);
          for (const id of ids) {
            marcarSimComoMaterial(id);  // assíncrono, sem await pra não atrasar response
          }
        }
      } catch (e) { /* nunca quebra */ }
    }
    return resp;
  };

  // ════════════════════════════════════════════════════════════
  // 2. Detecção da tab e injeção da nova
  // ════════════════════════════════════════════════════════════
  function gerarOrcTab() {
    return Array.from(document.querySelectorAll("button")).find((b) => {
      if (b.getAttribute("data-pkt-mat-tab") === "1") return false;
      const t = (b.textContent || "").trim();
      return t === "Gerar Orçamento" || /^Gerar\s+Or[çc]amento$/i.test(t);
    });
  }

  function tabMaterialExistente() {
    return document.querySelector("[data-pkt-mat-tab='1']");
  }

  function injetarTabMaterial() {
    const ger = gerarOrcTab();
    if (!ger || !ger.parentElement) return;
    if (ger.parentElement.querySelector("[data-pkt-mat-tab]")) return;

    const mat = ger.cloneNode(true);
    mat.setAttribute("data-pkt-mat-tab", "1");
    mat.textContent = "Gerar Orçamento de Material";
    estilizarTabMaterial(mat, false);
    mat.addEventListener("click", function (e) {
      e.preventDefault();
      e.stopPropagation();
      ativarModoMaterial();
    }, true);

    ger.parentElement.insertBefore(mat, ger.nextSibling);
    log("tab injetada");
  }

  function estilizarTabMaterial(matBtn, ativo) {
    if (ativo) {
      matBtn.style.background = "linear-gradient(135deg, #D4A853 0%, #B8923D 100%)";
      matBtn.style.color = "#1a1a1a";
      matBtn.style.fontWeight = "800";
      matBtn.style.borderColor = "#D4A853";
      matBtn.style.boxShadow = "0 0 0 2px rgba(212,168,83,0.3)";
    } else {
      matBtn.style.background = "rgba(212,168,83,0.10)";
      matBtn.style.color = "#D4A853";
      matBtn.style.fontWeight = "700";
      matBtn.style.borderColor = "rgba(212,168,83,0.4)";
      matBtn.style.boxShadow = "";
    }
  }

  // ════════════════════════════════════════════════════════════
  // 3. Ativar / desativar modo material
  // ════════════════════════════════════════════════════════════
  function ativarModoMaterial() {
    window.__pkt_modo_material = true;
    log("MODO MATERIAL ATIVADO");

    // Clica programaticamente na tab "Gerar Orçamento" para renderizar simulador
    const ger = gerarOrcTab();
    if (ger) ger.click();

    setTimeout(() => {
      // Visual: destaca tab material
      const mat = tabMaterialExistente();
      if (mat) estilizarTabMaterial(mat, true);
      addBadge();
      aplicarOcultacao();
      monitorarOutrasAbas();
    }, 250);

    // Re-aplica ocultação periodicamente (React re-renderiza)
    if (window.__pktMatTimer) clearInterval(window.__pktMatTimer);
    window.__pktMatTimer = setInterval(() => {
      if (!window.__pkt_modo_material) {
        clearInterval(window.__pktMatTimer);
        window.__pktMatTimer = null;
        return;
      }
      aplicarOcultacao();
      addBadge();
      const mat = tabMaterialExistente();
      if (mat) estilizarTabMaterial(mat, true);
    }, 700);
  }

  function desativarModoMaterial() {
    if (!window.__pkt_modo_material) return;
    window.__pkt_modo_material = false;
    log("modo material desativado");
    removerOcultacao();
    removerBadge();
    const mat = tabMaterialExistente();
    if (mat) estilizarTabMaterial(mat, false);
    if (window.__pktMatTimer) { clearInterval(window.__pktMatTimer); window.__pktMatTimer = null; }
  }

  // ════════════════════════════════════════════════════════════
  // 4. Ocultar blocos INSUMOS/INSTALAÇÃO/MÃO DE OBRA/GESTÃO
  // ════════════════════════════════════════════════════════════
  const TERMOS = [
    "INSUMOS",
    "INSTALAÇÃO",
    "INSTALAÇÃO E GESTÃO",
    "INSTALAÇÃO E GESTÃO DE OBRAS",
    "MÃO DE OBRA",
    "GESTÃO DE OBRAS",
    "GESTÃO DE MÃO DE OBRA",
  ];

  function textoBate(t) {
    if (!t) return false;
    const u = t.trim().toUpperCase();
    if (u.length === 0 || u.length > 80) return false;
    return TERMOS.some((termo) => u === termo || u.startsWith(termo + " ") || u.startsWith(termo + ":"));
  }

  function aplicarOcultacao() {
    const candidatos = document.querySelectorAll("h2, h3, h4, h5, h6, label, span, div, p, td, th, strong, b, button");
    candidatos.forEach((el) => {
      if (el.getAttribute("data-pkt-mat-hidden")) return;
      if (el.closest && el.closest("[data-pkt-mat-hidden='1']")) return;
      // só conta o primeiro nó de texto direto (não desce em filhos)
      let directText = "";
      for (const node of el.childNodes) {
        if (node.nodeType === 3) directText += node.textContent;
      }
      const t = directText.trim() || (el.children.length === 0 ? (el.textContent || "").trim() : "");
      if (!textoBate(t)) return;

      // Sobe até achar o "container do bloco" (parente com classe card/section/etc)
      let target = el;
      for (let i = 0; i < 5; i++) {
        const p = target.parentElement;
        if (!p) break;
        const cls = (p.className || "").toString().toLowerCase();
        if (p.tagName === "SECTION" || p.tagName === "TR" || p.tagName === "ARTICLE") { target = p; break; }
        if (/(card|panel|section|bloco|secao|wrap-|item-|row-)/.test(cls)) { target = p; break; }
        target = p;
      }
      target.setAttribute("data-pkt-mat-hidden", "1");
      target.style.display = "none";
    });
  }

  function removerOcultacao() {
    document.querySelectorAll("[data-pkt-mat-hidden='1']").forEach((el) => {
      el.style.display = "";
      el.removeAttribute("data-pkt-mat-hidden");
    });
  }

  // ════════════════════════════════════════════════════════════
  // 5. Badge visual
  // ════════════════════════════════════════════════════════════
  function addBadge() {
    if (document.querySelector("[data-pkt-mat-badge]")) return;
    const ger = gerarOrcTab();
    if (!ger) return;
    // Acha um container parente que seja o "conteúdo da aba"
    let host = ger.parentElement;
    for (let i = 0; i < 5; i++) {
      if (!host || !host.parentElement) break;
      if (host.scrollHeight > 400) break;
      host = host.parentElement;
    }
    const conteudo = host && host.nextElementSibling;
    if (!conteudo) return;

    const b = document.createElement("div");
    b.setAttribute("data-pkt-mat-badge", "1");
    b.innerHTML = 'MODO: ORÇAMENTO DE MATERIAL <span style="font-weight:400;opacity:0.85">— sem insumos, instalação ou mão de obra</span>';
    Object.assign(b.style, {
      padding: "10px 16px",
      background: "linear-gradient(90deg, #D4A853 0%, #B8923D 100%)",
      color: "#1a1a1a",
      fontSize: "11px",
      fontWeight: "700",
      letterSpacing: "0.08em",
      textAlign: "center",
      borderRadius: "4px",
      margin: "10px 0",
      boxShadow: "0 1px 3px rgba(212,168,83,0.3)",
    });
    conteudo.prepend(b);
  }

  function removerBadge() {
    document.querySelectorAll("[data-pkt-mat-badge]").forEach((b) => b.remove());
  }

  // ════════════════════════════════════════════════════════════
  // 6. Monitor de outras tabs
  // ════════════════════════════════════════════════════════════
  function monitorarOutrasAbas() {
    document.querySelectorAll("button").forEach((b) => {
      if (b.getAttribute("data-pkt-mat-tab") === "1") return;
      if (b.getAttribute("data-pkt-mat-listener") === "1") return;
      const t = (b.textContent || "").trim();
      if (t.length > 50 || t.length < 3) return;
      // Não monitora se for o próprio "Gerar Orçamento" (clicamos nele programaticamente!)
      if (t === "Gerar Orçamento" || /^Gerar\s+Or[çc]amento$/i.test(t)) return;
      b.setAttribute("data-pkt-mat-listener", "1");
      b.addEventListener("click", function () {
        setTimeout(desativarModoMaterial, 200);
      }, true);
    });
  }

  // ════════════════════════════════════════════════════════════
  // 7. Boot + MutationObserver
  // ════════════════════════════════════════════════════════════
  let scanTimer = null;
  function scheduleScan() {
    if (scanTimer) return;
    scanTimer = setTimeout(() => {
      scanTimer = null;
      injetarTabMaterial();
      if (window.__pkt_modo_material) {
        aplicarOcultacao();
        addBadge();
        monitorarOutrasAbas();
        const mat = tabMaterialExistente();
        if (mat) estilizarTabMaterial(mat, true);
      }
    }, 400);
  }

  if (document.readyState === "complete" || document.readyState === "interactive") {
    setTimeout(injetarTabMaterial, 700);
  } else {
    document.addEventListener("DOMContentLoaded", () => setTimeout(injetarTabMaterial, 700));
  }

  const obs = new MutationObserver(scheduleScan);
  if (document.body) {
    obs.observe(document.body, { childList: true, subtree: true });
  } else {
    document.addEventListener("DOMContentLoaded", () => {
      obs.observe(document.body, { childList: true, subtree: true });
    });
  }

  log("loaded v2");
})();
