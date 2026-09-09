/**
 * Gerar Orçamento de Material — chunk hotpatch Parket (v3)
 *
 * v3 — SEPARAÇÃO TOTAL via reescrita de URL:
 *  - Aba Material → MARCFIX12 acessa schema `orcamento_produtos` (totalmente isolado)
 *  - Aba Completo → MARCFIX12 acessa schema `public` (atual, sem mudanças)
 *  - Schemas têm colunas IDÊNTICAS, MARCFIX nem percebe a troca
 *  - Numeração separada: Completo segue sequência atual; Material usa PMAT-0001+
 *  - Listagens separadas: cada aba lista só as suas
 *
 * Mecânica:
 *  1. window.__pkt_modo_material flag controla qual schema é usado
 *  2. Wrapper de fetch reescreve calls a /rest/v1/simulacao_projetos
 *     → adiciona header Content-Profile/Accept-Profile = 'orcamento_produtos'
 *     → redireciona pra simulacao_produtos (mesmo nome de tabela no schema novo)
 *  3. CSS oculta blocos visuais de INSUMOS/INSTALAÇÃO/MÃO DE OBRA
 *  4. PDF: PGSTRUCT5 já tem patch que pula essas linhas quando flag ativa
 */
(function () {
  if (typeof window === "undefined") return;
  if (window.__pktGerarMaterialLoaded) return;
  window.__pktGerarMaterialLoaded = true;
  window.__pkt_modo_material = false;

  function log() { try { console.log.apply(console, ["[pkt-mat]"].concat([].slice.call(arguments))); } catch {} }

  // ════════════════════════════════════════════════════════════
  // 1. Wrapper de fetch — redireciona schema quando modo material
  // ════════════════════════════════════════════════════════════
  const TABELAS_REDIRECT = {
    "simulacao_projetos": "simulacao_produtos",
    "simulacao_itens": "simulacao_produtos_itens",
  };

  const _origFetch = window.fetch.bind(window);
  window.fetch = function (input, init) {
    if (!window.__pkt_modo_material) {
      return _origFetch(input, init);
    }
    try {
      let url = typeof input === "string" ? input : (input && input.url);
      const isRest = url && /\/rest\/v1\/(simulacao_projetos|simulacao_itens)(\?|$|\/)/.test(url);
      if (!isRest) return _origFetch(input, init);

      // Reescreve URL: troca nome da tabela
      let novaUrl = url;
      for (const [origem, destino] of Object.entries(TABELAS_REDIRECT)) {
        novaUrl = novaUrl.replace(`/rest/v1/${origem}`, `/rest/v1/${destino}`);
      }

      // Reescreve headers com Accept-Profile / Content-Profile
      const headers = new Headers((init && init.headers) || (input && input.headers) || {});
      const method = (init && init.method) || (input && input.method) || "GET";
      if (method === "GET" || method === "HEAD" || method === "DELETE") {
        headers.set("Accept-Profile", "orcamento_produtos");
      } else {
        headers.set("Content-Profile", "orcamento_produtos");
      }

      // Cria novo init mantendo body/method/etc
      const newInit = Object.assign({}, init || {}, { headers });
      // Se input era Request object, precisa propagar method/body manualmente
      if (input instanceof Request && !init) {
        newInit.method = input.method;
        // Body só pode ser propagado via clone (Request body é stream)
        if (input.body && input.method !== "GET" && input.method !== "HEAD") {
          // Não conseguimos pegar body diretamente; vamos usar o Request original mas com URL nova
          const reqClone = new Request(novaUrl, {
            method: input.method,
            headers,
            body: input.body,
            mode: input.mode,
            credentials: input.credentials,
            cache: input.cache,
            redirect: input.redirect,
            referrer: input.referrer,
            integrity: input.integrity,
            duplex: "half",
          });
          return _origFetch(reqClone);
        }
      }

      log("redirect:", url.split("/rest/v1/")[1].split("?")[0], "→ orcamento_produtos");
      return _origFetch(novaUrl, newInit);
    } catch (e) {
      log("erro wrapper:", e);
      return _origFetch(input, init);
    }
  };

  // ════════════════════════════════════════════════════════════
  // 2. Detecção e injeção da tab Material
  // ════════════════════════════════════════════════════════════
  function gerarOrcTab() {
    return Array.from(document.querySelectorAll("button")).find((b) => {
      if (b.getAttribute("data-pkt-mat-tab") === "1") return false;
      const t = (b.textContent || "").trim();
      return t === "Gerar Orçamento" || /^Gerar\s+Or[çc]amento$/i.test(t);
    });
  }
  function tabMaterialExistente() { return document.querySelector("[data-pkt-mat-tab='1']"); }

  function injetarTabMaterial() {
    const ger = gerarOrcTab();
    if (!ger || !ger.parentElement) return;
    if (ger.parentElement.querySelector("[data-pkt-mat-tab]")) return;

    const mat = ger.cloneNode(true);
    mat.setAttribute("data-pkt-mat-tab", "1");
    mat.textContent = "Gerar Orçamento de Material";
    estilizarTab(mat, false);
    mat.addEventListener("click", function (e) {
      e.preventDefault(); e.stopPropagation();
      ativarModoMaterial();
    }, true);

    ger.parentElement.insertBefore(mat, ger.nextSibling);
    log("tab injetada");
  }

  function estilizarTab(matBtn, ativo) {
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
    log("MODO MATERIAL — redirecionando para schema orcamento_produtos");

    // Clica programaticamente na tab "Gerar Orçamento" pra renderizar simulador.
    // Agora as queries do React (via Supabase JS) vão pegar o wrapper de fetch
    // e bater no schema novo.
    const ger = gerarOrcTab();
    if (ger) ger.click();

    setTimeout(() => {
      const mat = tabMaterialExistente();
      if (mat) estilizarTab(mat, true);
      addBadge();
      aplicarOcultacao();
      monitorarOutrasAbas();
    }, 250);

    if (window.__pktMatTimer) clearInterval(window.__pktMatTimer);
    window.__pktMatTimer = setInterval(() => {
      if (!window.__pkt_modo_material) {
        clearInterval(window.__pktMatTimer); window.__pktMatTimer = null; return;
      }
      aplicarOcultacao();
      addBadge();
      const mat = tabMaterialExistente();
      if (mat) estilizarTab(mat, true);
    }, 700);
  }

  function desativarModoMaterial() {
    if (!window.__pkt_modo_material) return;
    window.__pkt_modo_material = false;
    log("modo material desativado — voltando ao schema public");
    removerOcultacao();
    removerBadge();
    const mat = tabMaterialExistente();
    if (mat) estilizarTab(mat, false);
    if (window.__pktMatTimer) { clearInterval(window.__pktMatTimer); window.__pktMatTimer = null; }
  }

  // ════════════════════════════════════════════════════════════
  // 4. CSS: oculta blocos INSUMOS/INSTALAÇÃO/MÃO DE OBRA na UI
  // ════════════════════════════════════════════════════════════
  const TERMOS = [
    "INSUMOS", "INSTALAÇÃO", "INSTALAÇÃO E GESTÃO", "INSTALAÇÃO E GESTÃO DE OBRAS",
    "MÃO DE OBRA", "GESTÃO DE OBRAS", "GESTÃO DE MÃO DE OBRA",
  ];
  function textoBate(t) {
    if (!t) return false;
    const u = t.trim().toUpperCase();
    if (u.length === 0 || u.length > 80) return false;
    return TERMOS.some((termo) => u === termo || u.startsWith(termo + " ") || u.startsWith(termo + ":"));
  }
  function aplicarOcultacao() {
    document.querySelectorAll("h2, h3, h4, h5, h6, label, span, div, p, td, th, strong, b, button")
      .forEach((el) => {
        if (el.getAttribute("data-pkt-mat-hidden")) return;
        if (el.closest && el.closest("[data-pkt-mat-hidden='1']")) return;
        let direct = "";
        for (const node of el.childNodes) if (node.nodeType === 3) direct += node.textContent;
        const t = direct.trim() || (el.children.length === 0 ? (el.textContent || "").trim() : "");
        if (!textoBate(t)) return;
        let target = el;
        for (let i = 0; i < 5; i++) {
          const p = target.parentElement; if (!p) break;
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
      el.style.display = ""; el.removeAttribute("data-pkt-mat-hidden");
    });
  }

  // ════════════════════════════════════════════════════════════
  // 5. Badge
  // ════════════════════════════════════════════════════════════
  function addBadge() {
    if (document.querySelector("[data-pkt-mat-badge]")) return;
    const ger = gerarOrcTab(); if (!ger) return;
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
    b.innerHTML = 'MODO: ORÇAMENTO DE MATERIAL <span style="font-weight:400;opacity:0.85">— fornecimento sem insumos, instalação ou mão de obra</span>';
    Object.assign(b.style, {
      padding: "10px 16px",
      background: "linear-gradient(90deg, #D4A853 0%, #B8923D 100%)",
      color: "#1a1a1a", fontSize: "11px", fontWeight: "700",
      letterSpacing: "0.08em", textAlign: "center",
      borderRadius: "4px", margin: "10px 0",
      boxShadow: "0 1px 3px rgba(212,168,83,0.3)",
    });
    conteudo.prepend(b);
  }
  function removerBadge() { document.querySelectorAll("[data-pkt-mat-badge]").forEach((b) => b.remove()); }

  // ════════════════════════════════════════════════════════════
  // 6. Monitor de outras tabs
  // ════════════════════════════════════════════════════════════
  function monitorarOutrasAbas() {
    document.querySelectorAll("button").forEach((b) => {
      if (b.getAttribute("data-pkt-mat-tab") === "1") return;
      if (b.getAttribute("data-pkt-mat-listener") === "1") return;
      const t = (b.textContent || "").trim();
      if (t.length > 50 || t.length < 3) return;
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
        aplicarOcultacao(); addBadge(); monitorarOutrasAbas();
        const mat = tabMaterialExistente();
        if (mat) estilizarTab(mat, true);
      }
    }, 400);
  }

  if (document.readyState === "complete" || document.readyState === "interactive") {
    setTimeout(injetarTabMaterial, 700);
  } else {
    document.addEventListener("DOMContentLoaded", () => setTimeout(injetarTabMaterial, 700));
  }

  const obs = new MutationObserver(scheduleScan);
  if (document.body) obs.observe(document.body, { childList: true, subtree: true });
  else document.addEventListener("DOMContentLoaded", () => obs.observe(document.body, { childList: true, subtree: true }));

  log("loaded v3 (URL redirect mode)");
})();
