import React from "react";

// Error boundary global — evita "tela branca" quando um componente descendente
// lança. Padrão copiado do parket-homebroker.
type State = { hasError: boolean; error: Error | null };

export class ErrorBoundary extends React.Component<{ children: React.ReactNode }, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("[ErrorBoundary]", error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-hb-bg text-hb-text flex items-center justify-center p-6">
          <div className="max-w-md w-full bg-hb-panel border border-hb-border rounded-lg p-6 text-center">
            <div className="text-hb-red text-sm font-semibold mb-2 uppercase tracking-wider">Erro inesperado</div>
            <div className="text-xs text-hb-textDim mb-4">{this.state.error?.message || "Falha ao renderizar"}</div>
            <button
              onClick={() => window.location.reload()}
              className="text-xs px-4 py-2 bg-hb-accent/20 border border-hb-accent/40 text-hb-accent uppercase tracking-wider hover:bg-hb-accent/30"
            >
              Recarregar
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
