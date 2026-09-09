/**
 * Gerar Orçamento de Material — chunk hotpatch Parket (v4)
 *
 * v4 — Tab nativa no React (via patch dept-layout):
 *  - dept-layout-BtZpIBbo.js adiciona tab "Gerar Orçamento de Material"
 *  - Quando tab é selecionada, dept-layout seta window.__pkt_modo_material=true
 *    e remonta o componente S1 com key="gerar-material" (state independente)
 *  - Este chunk apenas:
 *      a) intercepta fetch e redireciona /rest/v1/simulacao_projetos →
 *         /rest/v1/simulacao_produtos (schema orcamento_produtos)
 *      b) injeta CSS que oculta blocos INSUMOS/INSTALAÇÃO/MÃO DE OBRA na UI
 *      c) adiciona badge visual "MODO MATERIAL" no topo
 */
(function () {
  if (typeof window === "undefined") return;
  if (window.__pktGerarMaterialLoaded) return;
  window.__pktGerarMaterialLoaded = true;
  if (typeof window.__pkt_modo_material === "undefined") window.__pkt_modo_material = false;

  function log() { try { console.log.apply(console, ["[pkt-mat]"].concat([].slice.call(arguments))); } catch {} }

  // ════════════════════════════════════════════════════════════
  // 1. Wrapper de fetch — redireciona simulacao_projetos|itens
  //    pro schema orcamento_produtos quando modo material ativo
  // ════════════════════════════════════════════════════════════
  const TAB_MAP = {
    simulacao_projetos: "simulacao_produtos",
    simulacao_itens: "simulacao_produtos_itens",
  };

  // Detecta linha de item auxiliar (INSUMOS / INSTALAÇÃO / MÃO DE OBRA / GESTÃO)
  function ehItemAux(item) {
    if (!item || typeof item !== "object") return false;
    const h = ((item.descritivo || "").split("\n")[0] || "").trim().toUpperCase();
    return /^(INSUMOS|INSTALA|GEST|M[ÃA]O\s+DE\s+OBRA)/.test(h);
  }

  // Lê body de Request|init e devolve {bodyParsed, isJson}
  async function lerBody(input, init) {
    let raw = (init && init.body) || null;
    if (!raw && input instanceof Request) {
      try { raw = await input.clone().text(); } catch { raw = null; }
    }
    if (raw == null) return { parsed: null, isJson: false };
    if (typeof raw === "string") {
      try { return { parsed: JSON.parse(raw), isJson: true }; } catch { return { parsed: raw, isJson: false }; }
    }
    return { parsed: raw, isJson: false };
  }

  const _origFetch = window.fetch.bind(window);
  window.fetch = async function (input, init) {
    if (!window.__pkt_modo_material) return _origFetch(input, init);
    try {
      const url = typeof input === "string" ? input : (input && input.url);
      if (!url) return _origFetch(input, init);

      // Log TUDO que vai pro REST em modo material — pra debug
      if (/\/rest\/v1\//.test(url)) {
        const method = (init && init.method) || (input && input.method) || "GET";
        const tabela = (url.split("/rest/v1/")[1] || "").split("?")[0];
        log("REST", method, tabela);
      }

      if (!/\/rest\/v1\/(simulacao_projetos|simulacao_itens)(\?|$|\/)/.test(url)) {
        return _origFetch(input, init);
      }

      let novaUrl = url;
      for (const [src, dst] of Object.entries(TAB_MAP)) {
        novaUrl = novaUrl.replace(`/rest/v1/${src}`, `/rest/v1/${dst}`);
      }

      const headers = new Headers((init && init.headers) || (input && input.headers) || {});
      const method = (init && init.method) || (input && input.method) || "GET";
      if (/^(GET|HEAD|DELETE)$/i.test(method)) headers.set("Accept-Profile", "orcamento_produtos");
      else headers.set("Content-Profile", "orcamento_produtos");

      // Filtro de items aux DESABILITADO temporariamente — pode estar quebrando flow
      // do MARCFIX12 que espera receber response com IDs. Itens INSUMOS/INSTALA
      // serão filtrados depois no PDF gerador.

      // Se input é Request, reconstrói pra mudar URL
      if (input instanceof Request && !init) {
        const ri = {
          method: input.method, headers,
          mode: input.mode, credentials: input.credentials,
          cache: input.cache, redirect: input.redirect,
          referrer: input.referrer, integrity: input.integrity,
        };
        if (input.body && !/^(GET|HEAD)$/i.test(input.method)) {
          ri.body = input.body;
          ri.duplex = "half";
        }
        log("redirect (req):", url.split("/rest/v1/")[1].split("?")[0], "→ orcamento_produtos");
        const r = await _origFetch(new Request(novaUrl, ri));
        if (!r.ok) {
          try {
            const txt = await r.clone().text();
            log("ERR", r.status, r.url, "→", txt.slice(0, 250));
          } catch {}
        }
        return r;
      }

      const newInit = Object.assign({}, init || {}, { headers });
      log("redirect:", url.split("/rest/v1/")[1].split("?")[0], "→ orcamento_produtos");
      const r = await _origFetch(novaUrl, newInit);
      if (!r.ok) {
        try {
          const txt = await r.clone().text();
          log("ERR", r.status, r.url, "→", txt.slice(0, 250));
        } catch {}
      }
      return r;
    } catch (e) {
      log("wrapper err:", e);
      return _origFetch(input, init);
    }
  };

  // ════════════════════════════════════════════════════════════
  // 2. CSS: oculta blocos INSUMOS/INSTALAÇÃO/MÃO DE OBRA na UI
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
    // DESABILITADO temporariamente — pode estar subindo demais e ocultando o próprio
    // modal de criação de simulação. Reativar quando identificarmos uma estratégia
    // mais cirúrgica (ex: data-attr específico no MARCFIX12).
    return;
  }
  function removerOcultacao() {
    document.querySelectorAll("[data-pkt-mat-hidden='1']").forEach((el) => {
      el.style.display = ""; el.removeAttribute("data-pkt-mat-hidden");
    });
  }

  // ════════════════════════════════════════════════════════════
  // 3. Badge visual "MODO MATERIAL"
  // ════════════════════════════════════════════════════════════
  function addBadge() {
    if (document.querySelector("[data-pkt-mat-badge]")) return;
    // Acha algum container do simulador ativo. Usa o primeiro botão "Nova Simulação"
    // como anchor — sobe até achar o "contêiner do simulador".
    const novaBtn = Array.from(document.querySelectorAll("button")).find(b => /\bNova\s+Simula/i.test((b.textContent||"").trim()));
    if (!novaBtn) return;
    let host = novaBtn.parentElement;
    for (let i = 0; i < 4; i++) {
      if (!host || !host.parentElement) break;
      if (host.scrollHeight > 300) break;
      host = host.parentElement;
    }
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
    host.prepend(b);
  }
  function removerBadge() { document.querySelectorAll("[data-pkt-mat-badge]").forEach((b) => b.remove()); }

  // ════════════════════════════════════════════════════════════
  // 4. Sync com a flag — quando modo muda, aplica/remove UI
  // ════════════════════════════════════════════════════════════
  let lastFlag = false;
  function syncModo() {
    const cur = !!window.__pkt_modo_material;
    if (cur !== lastFlag) {
      log("flag mudou:", lastFlag, "→", cur);
      lastFlag = cur;
      if (!cur) {
        removerOcultacao();
        removerBadge();
      }
    }
    if (cur) {
      aplicarOcultacao();
      addBadge();
    }
  }

  setInterval(syncModo, 600);
  // Roda já no boot
  setTimeout(syncModo, 800);

  log("loaded v4 (React tab nativo + URL redirect)");
  // NOTA: NÃO reescreve URL do clipboard. O link copiado pelo usuário continua
  // sendo /proposta/{uuid} — visual e fluxo IDÊNTICOS ao Completo.
  // O chunk `proposta-fallback-pkt1.js` cuida da parte do schema: quando o app
  // React busca a sim e ela está em orcamento_produtos, ele intercepta o 406 e
  // refaz a chamada no schema novo, devolvendo os dados pro React renderizar.
})();
