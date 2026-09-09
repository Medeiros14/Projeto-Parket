/**
 * Proposta fallback — chunk hotpatch Parket
 *
 * Quando a página pública /proposta/{uuid} carrega e o app React faz
 * GET /rest/v1/simulacao_projetos?id=eq.{uuid} retornando 406 (sim não
 * achada no schema public), tenta DE NOVO no schema orcamento_produtos
 * (simulações de Material). Devolve o response como se fosse do public,
 * pra o app React renderizar normalmente — sem mexer no router React.
 *
 * Sem efeito em propostas Completo (que estão no public e retornam 200).
 */
(function () {
  if (typeof window === "undefined") return;
  if (window.__pktPropostaFallbackLoaded) return;
  window.__pktPropostaFallbackLoaded = true;

  const REST_PATTERN = /\/rest\/v1\/simulacao_projetos(\?|$)/;
  const ITENS_PATTERN = /\/rest\/v1\/simulacao_itens(\?|$)/;

  // Mapa de IDs descobertos como "material" → pra próximas chamadas
  // (itens, updates etc) já irem direto pro schema novo
  const idsMaterial = new Set();

  function log() { try { console.log.apply(console, ["[pkt-prop-fb]"].concat([].slice.call(arguments))); } catch {} }

  function urlDoSchemaNovo(url) {
    return url
      .replace("/rest/v1/simulacao_projetos", "/rest/v1/simulacao_produtos")
      .replace("/rest/v1/simulacao_itens", "/rest/v1/simulacao_produtos_itens");
  }

  function extrairUuid(url) {
    const m = url.match(/id=eq\.([a-f0-9-]{36})/i) || url.match(/simulacao_id=eq\.([a-f0-9-]{36})/i);
    return m ? m[1] : null;
  }

  const _origFetch = window.fetch.bind(window);
  window.fetch = async function (input, init) {
    const url = typeof input === "string" ? input : (input && input.url);
    if (!url || !/\/rest\/v1\//.test(url)) return _origFetch(input, init);

    const ehSim = REST_PATTERN.test(url);
    const ehItens = ITENS_PATTERN.test(url);
    if (!ehSim && !ehItens) return _origFetch(input, init);

    const uuid = extrairUuid(url);
    const method = (init && init.method) || (input && input.method) || "GET";

    // Se já sabemos que esse ID é material, vai direto pro schema novo
    if (uuid && idsMaterial.has(uuid)) {
      const novaUrl = urlDoSchemaNovo(url);
      const headers = new Headers((init && init.headers) || (input && input.headers) || {});
      if (/^(GET|HEAD|DELETE)$/i.test(method)) headers.set("Accept-Profile", "orcamento_produtos");
      else headers.set("Content-Profile", "orcamento_produtos");
      log("já-conhecido material:", uuid.slice(0, 8), "→ schema novo");
      const newInit = Object.assign({}, init || {}, { headers });
      return _origFetch(novaUrl, newInit);
    }

    // Tenta primeiro no public (comportamento normal)
    const resp = await _origFetch(input, init);

    // Faz fallback quando:
    //  (a) status 406 → PostgREST .single() não achou linha no public
    //  (b) GET retorna [] vazio (caso típico de itens com simulacao_id que não existe)
    // E só pra GETs em simulacao_projetos|simulacao_itens com uuid no filtro
    if (method === "GET" && uuid && (ehSim || ehItens)) {
      let vazio = resp.status === 406;
      if (!vazio && resp.ok) {
        try {
          const txt = await resp.clone().text();
          vazio = txt === "[]" || txt === "null" || txt === "";
        } catch {}
      }
      if (vazio) {
        log("fallback:", uuid.slice(0, 8), (ehSim ? "sim" : "itens"), "vazio em public → schema novo");
        const novaUrl = urlDoSchemaNovo(url);
        const headers = new Headers((init && init.headers) || (input && input.headers) || {});
        headers.set("Accept-Profile", "orcamento_produtos");
        const newInit = Object.assign({}, init || {}, { headers, method });
        const respNovo = await _origFetch(novaUrl, newInit);
        if (respNovo.ok) {
          try {
            const txt = await respNovo.clone().text();
            if (txt && txt !== "[]" && txt !== "null") {
              idsMaterial.add(uuid);
              log("achou no schema novo, marcando", uuid.slice(0, 8));
              return respNovo;
            }
          } catch {}
        }
      }
    }
    return resp;
  };

  log("loaded");
})();
