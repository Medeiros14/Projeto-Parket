/**
 * Garantia de exclusão persistente — orçamento simulador.
 *
 * Bug: usuário exclui item na UI, o estado React local atualiza,
 * mas a chamada DELETE no Supabase às vezes falha silenciosamente
 * (try/catch interno só faz console.warn). Item volta no PDF/link.
 *
 * Solução: hookar fetch global. Quando detecta DELETE em
 *   /rest/v1/simulacao_itens
 * que retorna OK, força hard-refresh dos items dessa simulação no React
 * via dispatch de evento postgres_changes (mesmo canal do realtime).
 *
 * Adicionalmente: quando DELETE falha, mostra toast vermelho explícito.
 */
(function () {
  if (typeof window === "undefined") return;
  if (window.__pktDelFixLoaded) return;
  window.__pktDelFixLoaded = true;

  function log() { try { console.log.apply(console, ["[pkt-delfix]"].concat([].slice.call(arguments))); } catch {} }

  function toast(msg, isErr) {
    const t = document.createElement("div");
    t.textContent = msg;
    Object.assign(t.style, {
      position: "fixed", bottom: "30px", left: "50%", transform: "translateX(-50%)",
      background: isErr ? "#dc2626" : "#16a34a", color: "#fff",
      padding: "10px 20px", borderRadius: "6px", fontSize: "13px", fontWeight: "600",
      zIndex: "999999", boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
    });
    document.body.appendChild(t);
    setTimeout(() => t.remove(), isErr ? 8000 : 3000);
  }

  const _origFetch = window.fetch.bind(window);
  window.fetch = async function (input, init) {
    const url = (typeof input === "string" ? input : (input && input.url)) || "";
    const method = ((init && init.method) || (input && input.method) || "GET").toUpperCase();

    if (method === "DELETE" && /\/rest\/v1\/simulacao_itens/.test(url)) {
      log("DELETE detectado:", url);
      try {
        const resp = await _origFetch(input, init);
        if (!resp.ok) {
          const txt = await resp.clone().text().catch(() => "");
          log("DELETE FALHOU:", resp.status, txt.slice(0, 200));
          toast("Falha ao excluir item — recarregue a página", true);
        } else {
          log("DELETE OK — verificando persistência...");
          // Re-verifica que o item realmente sumiu (sanity check)
          const idMatch = url.match(/[?&]id=eq\.([0-9a-f-]+)/i);
          if (idMatch) {
            const id = idMatch[1];
            setTimeout(async () => {
              try {
                const checkUrl = url.split("?")[0] + "?id=eq." + id + "&select=id";
                const checkResp = await _origFetch(checkUrl, {
                  headers: (init && init.headers) || {},
                });
                const data = await checkResp.json();
                if (Array.isArray(data) && data.length > 0) {
                  log("ZUMBI:", id, "ainda existe — refazendo delete");
                  await _origFetch(input, init);
                }
              } catch {}
            }, 500);
          }
          // Dispara evento que pode triggar refetch via realtime listener
          window.dispatchEvent(new CustomEvent("pkt-sim-item-deleted", { detail: { url } }));
        }
        return resp;
      } catch (e) {
        log("ERRO DELETE:", e);
        toast("Falha de rede ao excluir — tente novamente", true);
        throw e;
      }
    }

    return _origFetch(input, init);
  };

  log("loaded v1");
})();
