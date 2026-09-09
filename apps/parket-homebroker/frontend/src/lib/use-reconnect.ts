/**
 * Hook de reconexão pra componentes com realtime/fetch contínuo.
 *
 * Resolve o problema clássico: quando a aba do navegador fica em background
 * (user trocou de aba, minimizou, celular bloqueou), o browser SUSPENDE timers
 * e o WebSocket pode cair sem aviso. Quando o user volta, fica "parado" sem
 * realtime e os dados ficam stale.
 *
 * Esse hook escuta `visibilitychange`, `online` e `focus` — sempre que
 * detecta retorno à aba ativa, chama o callback (que tipicamente refaz fetch
 * e força reconexão dos canais).
 */
import { useEffect, useRef } from "react";
import { supabase } from "./supabase";

export function useReconnect(onReconnect: () => void, opts: { debounceMs?: number } = {}) {
  const cbRef = useRef(onReconnect);
  cbRef.current = onReconnect;
  const lastFireRef = useRef(0);
  const debounce = opts.debounceMs ?? 1500;

  useEffect(() => {
    const fire = () => {
      const now = Date.now();
      if (now - lastFireRef.current < debounce) return;
      lastFireRef.current = now;
      try { cbRef.current(); } catch (e) { console.error("[useReconnect]", e); }
    };

    const onVis = () => { if (document.visibilityState === "visible") fire(); };
    const onOnline = () => fire();
    const onFocus = () => fire();

    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("online", onOnline);
    window.addEventListener("focus", onFocus);

    return () => {
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("online", onOnline);
      window.removeEventListener("focus", onFocus);
    };
  }, [debounce]);
}

/** Força reconnect explícito do socket realtime do supabase.
 *  Útil quando o socket caiu sem disparar evento (ex: network change).
 *  Não desinscreve canais — eles reapegam ao novo socket automaticamente. */
export function forceRealtimeReconnect() {
  try {
    const sock: any = (supabase as any).realtime;
    if (sock && typeof sock.disconnect === "function") {
      sock.disconnect(1000, "client-reconnect");
      // Próximo subscribe ou ping vai reabrir o socket
      setTimeout(() => {
        if (typeof sock.connect === "function") sock.connect();
      }, 100);
    }
  } catch (e) {
    console.warn("[forceRealtimeReconnect]", e);
  }
}
