/**
 * Botão "Adicionar Ferragens / MDFs / Compensados" no simulador de Marcenaria.
 * Detecta o flow de Marcenaria via MutationObserver e injeta um botão dourado
 * que abre o modal `window.__pktAskMarcInsumos` (do chunk marc-insumos-modal-pkt1.js).
 */
(function () {
  if (typeof window === "undefined") return;
  if (window.__pktMarcFerBtn) return;
  window.__pktMarcFerBtn = true;

  function log() { try { console.log.apply(console, ["[pkt-marc-fer]"].concat([].slice.call(arguments))); } catch {} }

  function inMarcenaria() {
    // Acha o cabeçalho "Marcenaria" ou label "Tipo Marcenaria" no simulador
    return Array.from(document.querySelectorAll("button, h2, h3, h4, span, label")).some((el) => {
      const t = (el.textContent || "").trim();
      return /^(Marcenaria|Tipo Marcenaria|Categoria Marcenaria)$/i.test(t);
    });
  }

  function jaInjetado() { return document.querySelector("[data-pkt-marc-fer-btn]"); }

  function criarBotao() {
    const btn = document.createElement("button");
    btn.setAttribute("data-pkt-marc-fer-btn", "1");
    btn.type = "button";
    btn.textContent = "+ Adicionar Ferragens / MDFs / Compensados";
    Object.assign(btn.style, {
      background: "linear-gradient(135deg, #D4A853 0%, #B8923D 100%)",
      color: "#1a1a1a",
      border: "none",
      padding: "10px 18px",
      borderRadius: "6px",
      fontSize: "12px",
      fontWeight: "700",
      letterSpacing: "0.03em",
      cursor: "pointer",
      marginTop: "10px",
      marginBottom: "10px",
      boxShadow: "0 1px 3px rgba(212,168,83,0.3)",
      width: "100%",
    });
    btn.addEventListener("click", async (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (typeof window.__pktAskMarcInsumos !== "function") {
        alert("Modal de insumos não está carregado. Recarregue a página.");
        return;
      }
      try {
        const r = await window.__pktAskMarcInsumos();
        if (r && r.descricao) {
          log("insumos confirmados", r);
          // Coloca em window pra MARCFIX poder ler no save
          window.__pktMarcInsumosPendente = r;
          // Notifica visualmente
          btn.textContent = "✓ Ferragens/MDFs (R$ " + (r.total || 0).toFixed(2).replace(".", ",") + ") — clique pra editar";
        }
      } catch (err) {
        log("erro modal", err);
      }
    });
    return btn;
  }

  function scan() {
    if (!inMarcenaria()) {
      // Remove botão se não está mais em marcenaria
      const existing = jaInjetado();
      if (existing) existing.remove();
      return;
    }
    if (jaInjetado()) return;
    // Acha anchor: botão "Adicionar este ambiente" ou input de Acabamento
    const anchor = Array.from(document.querySelectorAll("button"))
      .find((b) => /Adicionar este ambiente/i.test((b.textContent || "").trim()));
    if (!anchor || !anchor.parentElement) return;
    const btn = criarBotao();
    anchor.parentElement.insertBefore(btn, anchor);
    log("botão injetado");
  }

  let scanTimer = null;
  function scheduleScan() {
    if (scanTimer) return;
    scanTimer = setTimeout(() => { scanTimer = null; scan(); }, 400);
  }

  if (document.readyState === "complete" || document.readyState === "interactive") {
    setTimeout(scan, 700);
  } else {
    document.addEventListener("DOMContentLoaded", () => setTimeout(scan, 700));
  }

  const obs = new MutationObserver(scheduleScan);
  if (document.body) obs.observe(document.body, { childList: true, subtree: true });
  else document.addEventListener("DOMContentLoaded", () => obs.observe(document.body, { childList: true, subtree: true }));

  log("loaded");
})();
