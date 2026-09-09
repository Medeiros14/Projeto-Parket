/**
 * Gerar Orçamento de Material — chunk hotpatch Parket
 *
 * Adiciona uma tab "Gerar Orçamento de Material" ao lado da tab "Gerar Orçamento"
 * no modal do card. Quando ativa:
 *   1. Marca window.__pkt_modo_material = true
 *   2. Clica programaticamente na tab "Gerar Orçamento" (reusa 100% o simulador)
 *   3. Aplica CSS + JS que ocultam visualmente blocos de INSUMOS/INSTALAÇÃO/MÃO DE OBRA
 *   4. Adiciona badge "MODO: ORÇAMENTO DE MATERIAL" no topo
 *   5. Intercepta POST/PATCH em simulacao_projetos pra marcar meta.tipo_orcamento='material'
 *
 * Quando user clica em qualquer outra tab → desliga flag e remove CSS/badge.
 *
 * NÃO patcha o MARCFIX12 internamente. Zero risco para o simulador Completo.
 *
 * O PDF respeita a flag via patch cirúrgico em propostaGenerator-PGSTRUCT35.js.
 */
(function () {
  if (typeof window === "undefined") return;
  if (window.__pktGerarMaterialLoaded) return;
  window.__pktGerarMaterialLoaded = true;
  window.__pkt_modo_material = false;

  function log() { try { console.log.apply(console, ["[pkt-mat-tab]"].concat([].slice.call(arguments))); } catch {} }

  // ════════════════════════════════════════════════════════════
  // 1. Wrapper de fetch — marca meta.tipo_orcamento='material' em saves
  // ════════════════════════════════════════════════════════════
  const _origFetch = window.fetch.bind(window);
  window.fetch = async function (input, init) {
    try {
      if (window.__pkt_modo_material && init && (init.method === "POST" || init.method === "PATCH")) {
        const url = (typeof input === "string" ? input : (input && input.url)) || "";
        if (/\/rest\/v1\/simulacao_projetos(\?|$|\/)/.test(url) && init.body) {
          try {
            const body = typeof init.body === "string" ? JSON.parse(init.body) : init.body;
            const applyMeta = (b) => {
              b.meta = Object.assign({}, b.meta || {}, { tipo_orcamento: "material" });
            };
            if (Array.isArray(body)) body.forEach(applyMeta);
            else if (body && typeof body === "object") applyMeta(body);
            init = Object.assign({}, init, { body: JSON.stringify(body) });
            log("save interceptado → meta.tipo_orcamento=material");
          } catch (e) { /* não-JSON, ignora */ }
        }
      }
    } catch (e) { /* nunca quebra fetch */ }
    return _origFetch(input, init);
  };

  // ════════════════════════════════════════════════════════════
  // 2. Detecção da tab "Gerar Orçamento" + injeção da tab Material
  // ════════════════════════════════════════════════════════════
  function gerarOrcTab() {
    return Array.from(document.querySelectorAll("button")).find((b) => {
      const t = (b.textContent || "").trim();
      return t === "Gerar Orçamento" || /^Gerar\s+Or[çc]amento$/i.test(t);
    });
  }

  function injetarTabMaterial() {
    const ger = gerarOrcTab();
    if (!ger) return;
    const parent = ger.parentElement;
    if (!parent) return;
    if (parent.querySelector("[data-pkt-mat-tab]")) return;

    // Clona o botão pra herdar estilo do React/Tailwind dele
    const mat = ger.cloneNode(true);
    mat.setAttribute("data-pkt-mat-tab", "1");
    mat.textContent = "Gerar Orçamento de Material";
    mat.style.background = "rgba(212,168,83,0.10)";
    mat.style.color = "#D4A853";
    mat.style.fontWeight = "700";
    mat.style.borderColor = "rgba(212,168,83,0.4)";
    mat.addEventListener("click", function (e) {
      e.preventDefault();
      e.stopPropagation();
      ativarModoMaterial(ger);
    }, true);

    parent.insertBefore(mat, ger.nextSibling);
    log("tab material injetada");
  }

  // ════════════════════════════════════════════════════════════
  // 3. Ativar / desativar modo material
  // ════════════════════════════════════════════════════════════
  function ativarModoMaterial(gerBtn) {
    window.__pkt_modo_material = true;
    log("modo material ATIVADO");
    // Clica na tab "Gerar Orçamento" pra renderizar o simulador
    if (gerBtn) gerBtn.click();
    setTimeout(() => {
      addBadge();
      aplicarOcultacao();
      monitorarOutrasAbas();
    }, 200);
    // Reaplica periodicamente pra captar mudanças dinâmicas do React
    if (window.__pktMatReapplyTimer) clearInterval(window.__pktMatReapplyTimer);
    window.__pktMatReapplyTimer = setInterval(() => {
      if (window.__pkt_modo_material) {
        aplicarOcultacao();
        addBadge();
      } else {
        clearInterval(window.__pktMatReapplyTimer);
        window.__pktMatReapplyTimer = null;
      }
    }, 800);
  }

  function desativarModoMaterial() {
    if (!window.__pkt_modo_material) return;
    window.__pkt_modo_material = false;
    log("modo material DESATIVADO");
    removerOcultacao();
    removerBadge();
    if (window.__pktMatReapplyTimer) {
      clearInterval(window.__pktMatReapplyTimer);
      window.__pktMatReapplyTimer = null;
    }
  }

  // ════════════════════════════════════════════════════════════
  // 4. Ocultar visualmente blocos INSUMOS/INSTALAÇÃO/MÃO DE OBRA
  // ════════════════════════════════════════════════════════════
  const TERMOS_OCULTAR = [
    "INSUMOS",
    "INSUMOS DE",
    "INSTALAÇÃO",
    "INSTALAÇÃO E GESTÃO",
    "MÃO DE OBRA",
    "GESTÃO DE OBRAS",
    "GESTÃO DE MÃO DE OBRA",
  ];

  function textoBateTermos(t) {
    if (!t || t.length > 100) return false;
    const u = t.trim().toUpperCase();
    return TERMOS_OCULTAR.some((termo) => u === termo || u.startsWith(termo + " ") || u.startsWith(termo + ":"));
  }

  function aplicarOcultacao() {
    // Procura headers/labels/spans que casem com os termos
    const candidatos = document.querySelectorAll("h2, h3, h4, h5, h6, label, span, div, p, td, th, strong, b");
    candidatos.forEach((el) => {
      if (el.getAttribute("data-pkt-mat-hidden")) return;
      // Pula elementos já dentro de algo escondido
      if (el.closest && el.closest("[data-pkt-mat-hidden='1']")) return;
      const t = (el.textContent || "").trim();
      if (!textoBateTermos(t)) return;
      // Acha o container pai do bloco/seção
      let target = el;
      for (let i = 0; i < 6; i++) {
        if (!target.parentElement) break;
        const p = target.parentElement;
        const cs = window.getComputedStyle(p);
        // Subir até achar bloco visual (display:flex/grid/block, com border ou bg)
        if (p.tagName === "SECTION" || p.tagName === "ARTICLE" || p.tagName === "TR") {
          target = p; break;
        }
        const cls = (p.className || "").toString().toLowerCase();
        if (/(card|panel|section|bloco|secao|wrap|item|row|line)/.test(cls)) {
          target = p; break;
        }
        if (cs.borderTopWidth !== "0px" || cs.borderTopStyle === "solid" || cs.background !== "none") {
          // pode ser o card visual, mas só sobe 1 nível adicional
          target = p;
          if (i >= 1) break;
        } else {
          target = p;
        }
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
  // 5. Badge visual "MODO: ORÇAMENTO DE MATERIAL"
  // ════════════════════════════════════════════════════════════
  function addBadge() {
    if (document.querySelector("[data-pkt-mat-badge]")) return;
    const ger = gerarOrcTab();
    if (!ger || !ger.parentElement) return;
    const conteudo = ger.parentElement.parentElement && ger.parentElement.parentElement.nextElementSibling
      ? ger.parentElement.parentElement.nextElementSibling
      : ger.parentElement.nextElementSibling;
    if (!conteudo) return;

    const b = document.createElement("div");
    b.setAttribute("data-pkt-mat-badge", "1");
    b.innerHTML = "MODO: ORÇAMENTO DE MATERIAL <span style=\"font-weight:400;opacity:0.85\">— sem insumos, instalação ou mão de obra</span>";
    Object.assign(b.style, {
      padding: "9px 16px",
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
  // 6. Detecta clique em outras tabs → desliga modo material
  // ════════════════════════════════════════════════════════════
  function monitorarOutrasAbas() {
    document.querySelectorAll("button").forEach((b) => {
      if (b.getAttribute("data-pkt-mat-tab") === "1") return;
      if (b.getAttribute("data-pkt-mat-listener") === "1") return;
      const t = (b.textContent || "").trim();
      // Só monitora botões que parecem tabs (textos curtos típicos)
      if (t.length > 50 || t.length < 3) return;
      b.setAttribute("data-pkt-mat-listener", "1");
      b.addEventListener("click", function () {
        // Espera um pouco pra ver se outra tab ficou ativa
        setTimeout(desativarModoMaterial, 150);
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

  log("loaded");
})();
