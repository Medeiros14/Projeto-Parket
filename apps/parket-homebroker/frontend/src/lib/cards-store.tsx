/**
 * Cards store compartilhado — carrega os cards comerciais UMA vez e disponibiliza
 * pro Layout, Pregão, Books, Performance, Análise etc.
 * Evita 3-4 chamadas paralelas da mesma query.
 */
import { createContext, useContext, useEffect, useState, useRef, type ReactNode } from "react";
import { api, subscribeCards, type KanbanCard } from "./api";
import { useReconnect, forceRealtimeReconnect } from "./use-reconnect";

type Ctx = {
  cards: KanbanCard[];
  loading: boolean;
  error: string | null;
  reload: () => void;
};

const CardsCtx = createContext<Ctx | null>(null);

export function CardsProvider({ children, limit = 600 }: { children: ReactNode; limit?: number }) {
  const [cards, setCards] = useState<KanbanCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const lastReloadRef = useRef(0);
  const hasLoadedOnceRef = useRef(false);

  useEffect(() => {
    let alive = true;
    // Loading visível SÓ no primeiro fetch. Reloads subsequentes (realtime, focus,
    // reload manual) são silenciosos — substituem os dados em background sem mostrar
    // tela em branco. Caso contrário, qualquer click do user que cause um reload
    // mostra "Carregando book…" por segundos e atrapalha a navegação.
    if (!hasLoadedOnceRef.current) setLoading(true);
    const timeout = setTimeout(() => {
      if (alive && !hasLoadedOnceRef.current) {
        setError("Tempo esgotado carregando cards. Toque em reload pra tentar.");
        setLoading(false);
      }
    }, 30000);

    api.cards(limit)
      .then((data) => {
        if (!alive) return;
        clearTimeout(timeout);
        setCards(data || []);
        setLoading(false);
        setError(null);
        hasLoadedOnceRef.current = true;
      })
      .catch((e) => {
        if (!alive) return;
        clearTimeout(timeout);
        // Erro só "rompe a tela" se ainda não temos dados — senão mantém os antigos
        if (!hasLoadedOnceRef.current) {
          setError(e?.message || "Erro");
          setLoading(false);
        } else {
          console.warn("[cards-store] reload silencioso falhou (mantém dados antigos):", e);
        }
      });
    return () => { alive = false; clearTimeout(timeout); };
  }, [reloadKey, limit]);

  // Helper: pausa o reload se o usuário está digitando em qualquer form aberto.
  // Re-renderizar enquanto preenche modal (ex: SolicitarOrcamento) faz o user
  // perder o input/focus. Se há campo focado, agenda pra próxima janela.
  const isUserTyping = (): boolean => {
    const el = document.activeElement as HTMLElement | null;
    if (!el) return false;
    const tag = el.tagName;
    if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
    if (el.isContentEditable) return true;
    // Também respeita qualquer dialog/modal aberto explicitamente
    if (document.querySelector('[role="dialog"], [data-modal-open="true"]')) return true;
    return false;
  };

  // Realtime — throttle agressivo (max 1 reload a cada 30s, antes 15s) + pausa se digitando
  useEffect(() => {
    let pendingReload: number | null = null;
    const THROTTLE_MS = 30000;
    const tryReload = () => {
      if (isUserTyping()) {
        // Re-agenda pra +5s — espera o user parar de digitar
        pendingReload = window.setTimeout(tryReload, 5000);
        return;
      }
      lastReloadRef.current = Date.now();
      pendingReload = null;
      setReloadKey((k) => k + 1);
    };
    const unsub = subscribeCards(() => {
      const now = Date.now();
      const since = now - lastReloadRef.current;
      if (since >= THROTTLE_MS && !pendingReload) {
        if (isUserTyping()) {
          pendingReload = window.setTimeout(tryReload, 5000);
        } else {
          lastReloadRef.current = now;
          setReloadKey((k) => k + 1);
        }
      } else if (!pendingReload) {
        pendingReload = window.setTimeout(tryReload, THROTTLE_MS - since);
      }
    });
    return () => { unsub(); if (pendingReload) clearTimeout(pendingReload); };
  }, []);

  // Reconnect — quando a aba volta a ficar visível (após background) ou volta
  // a internet, força reconexão do socket realtime e refaz fetch.
  // Pausa se houver form aberto (não perde dados do user).
  useReconnect(() => {
    forceRealtimeReconnect();
    if (!isUserTyping()) setReloadKey((k) => k + 1);
  });

  return (
    <CardsCtx.Provider value={{
      cards, loading, error,
      reload: () => setReloadKey((k) => k + 1),
    }}>
      {children}
    </CardsCtx.Provider>
  );
}

export function useCards() {
  const v = useContext(CardsCtx);
  if (!v) throw new Error("useCards precisa do CardsProvider acima na árvore");
  return v;
}
