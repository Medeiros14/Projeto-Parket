// Shim de compatibilidade "convex/react" -> Supabase.
// useQuery: fetch + polling 15s + invalidação global após qualquer mutation.
import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { getAuthState, subscribeAuth } from "./auth-store";

type AnyFn = (args?: Record<string, unknown>) => Promise<unknown>;

let version = 0;
const listeners = new Set<() => void>();
export function invalidateQueries() {
  version++;
  listeners.forEach((l) => l());
}
const subscribeInvalidation = (l: () => void) => {
  listeners.add(l);
  return () => { listeners.delete(l); };
};
const getVersion = () => version;

const POLL_MS = 15000;

export function useQuery(fn: AnyFn, args?: Record<string, unknown> | "skip"): unknown {
  const skip = args === "skip";
  const key = skip ? "skip" : JSON.stringify(args ?? {});
  const v = useSyncExternalStore(subscribeInvalidation, getVersion);
  const [state, setState] = useState<{ key: string; data: unknown } | undefined>(undefined);

  useEffect(() => {
    if (skip) return;
    let alive = true;
    const run = () => {
      fn(key === "{}" ? {} : (JSON.parse(key) as Record<string, unknown>))
        .then((r) => { if (alive) setState({ key, data: r ?? null }); })
        .catch((e) => { console.error("[shim useQuery]", e); });
    };
    run();
    const t = setInterval(run, POLL_MS);
    return () => { alive = false; clearInterval(t); };
  }, [fn, key, skip, v]);

  if (skip) return undefined;
  return state && state.key === key ? state.data : undefined;
}

export function useMutation(fn: AnyFn) {
  return useCallback(
    async (args?: Record<string, unknown>) => {
      const r = await fn(args ?? {});
      invalidateQueries();
      return r;
    },
    [fn]
  );
}

export const useAction = useMutation;

interface PaginationResult {
  page: unknown[];
  isDone: boolean;
  continueCursor: string | null;
}

export function usePaginatedQuery(
  fn: AnyFn,
  args: Record<string, unknown> | "skip",
  opts: { initialNumItems: number }
) {
  const skip = args === "skip";
  const key = skip ? "skip" : JSON.stringify(args ?? {});
  const [numItems, setNumItems] = useState(opts.initialNumItems);
  const [loadingMore, setLoadingMore] = useState(false);
  const v = useSyncExternalStore(subscribeInvalidation, getVersion);
  const [state, setState] = useState<{ key: string; data: PaginationResult } | undefined>(undefined);

  useEffect(() => { setNumItems(opts.initialNumItems); }, [key]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (skip) return;
    let alive = true;
    const run = () => {
      const parsed = key === "{}" ? {} : (JSON.parse(key) as Record<string, unknown>);
      fn({ ...parsed, paginationOpts: { numItems, cursor: null } })
        .then((r) => {
          if (alive) {
            setState({ key, data: r as PaginationResult });
            setLoadingMore(false);
          }
        })
        .catch((e) => { console.error("[shim usePaginatedQuery]", e); });
    };
    run();
    const t = setInterval(run, POLL_MS);
    return () => { alive = false; clearInterval(t); };
  }, [fn, key, skip, numItems, v]);

  const current = !skip && state && state.key === key ? state.data : undefined;
  const status: "LoadingFirstPage" | "LoadingMore" | "CanLoadMore" | "Exhausted" =
    current === undefined
      ? "LoadingFirstPage"
      : loadingMore
        ? "LoadingMore"
        : current.isDone
          ? "Exhausted"
          : "CanLoadMore";

  const loadMore = useCallback((n: number) => {
    setLoadingMore(true);
    setNumItems((x) => x + n);
  }, []);

  return { results: current?.page ?? [], status, loadMore, isLoading: current === undefined };
}

export function useConvexAuth() {
  const s = useSyncExternalStore(subscribeAuth, getAuthState);
  return { isAuthenticated: !!s.session, isLoading: s.loading };
}

export function Authenticated({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useConvexAuth();
  if (isLoading || !isAuthenticated) return null;
  return <>{children}</>;
}

export function Unauthenticated({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useConvexAuth();
  if (isLoading || isAuthenticated) return null;
  return <>{children}</>;
}

export function AuthLoading({ children }: { children: React.ReactNode }) {
  const { isLoading } = useConvexAuth();
  if (!isLoading) return null;
  return <>{children}</>;
}

export class ConvexReactClient {
  constructor(_url?: string) {}
}
