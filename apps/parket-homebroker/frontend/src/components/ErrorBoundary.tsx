import { Component, type ReactNode, type ErrorInfo } from "react";

type Props = { children: ReactNode };
type State = { error: Error | null; info: ErrorInfo | null };

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null, info: null };

  static getDerivedStateFromError(error: Error): State {
    return { error, info: null };
  }
  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[ErrorBoundary] erro capturado:", error, info);
    this.setState({ error, info });
  }

  render() {
    if (this.state.error) {
      const e = this.state.error;
      return (
        <div className="min-h-screen flex items-center justify-center bg-hb-bg p-6">
          <div className="max-w-2xl w-full bg-hb-panel border border-hb-red/40 rounded-lg p-6 space-y-3">
            <div className="text-hb-red text-base font-bold">Erro inesperado no Home Broker</div>
            <div className="text-xs text-hb-text bg-hb-bg/50 border border-hb-border rounded p-3 font-mono whitespace-pre-wrap break-words">
              {e.name}: {e.message}
            </div>
            {e.stack && (
              <details className="text-[10px] text-hb-textDim">
                <summary className="cursor-pointer hover:text-hb-text">Stack trace</summary>
                <pre className="mt-2 bg-hb-bg/50 border border-hb-border rounded p-2 overflow-auto max-h-64 whitespace-pre-wrap">{e.stack}</pre>
              </details>
            )}
            <div className="flex gap-2">
              <button onClick={() => window.location.reload()}
                className="bg-hb-accent text-hb-bg font-semibold rounded px-3 py-1.5 text-xs hover:bg-hb-gold">
                Recarregar
              </button>
              <button onClick={() => {
                  try {
                    for (let i = localStorage.length - 1; i >= 0; i--) {
                      const k = localStorage.key(i);
                      if (k && (k.startsWith("sb-") || k.includes("supabase") || k.includes("parket-homebroker") || k.startsWith("hb-"))) localStorage.removeItem(k);
                    }
                    sessionStorage.clear();
                  } catch {}
                  window.location.href = "/?_=" + Date.now();
                }}
                className="bg-hb-red/15 border border-hb-red/40 text-hb-red font-semibold rounded px-3 py-1.5 text-xs hover:bg-hb-red/25">
                Limpar cache e recarregar
              </button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
