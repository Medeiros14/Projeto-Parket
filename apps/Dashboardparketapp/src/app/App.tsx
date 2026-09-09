import React from "react";
import { RouterProvider } from "react-router";
import { router } from "./routes";
import { AuthProvider } from "./contexts/AuthContext";

/* ─── Detecta falhas de chunk de deploy e recarrega automaticamente ─── */
const RELOAD_KEY = "__chunk_reload__";
function isChunkError(msg: string) {
  return msg.includes("Failed to fetch dynamically imported module") ||
    msg.includes("Importing a module script failed") ||
    msg.includes("ChunkLoadError") ||
    msg.includes("Loading chunk") ||
    msg.includes("Loading CSS chunk");
}
if (typeof window !== "undefined") {
  window.addEventListener("unhandledrejection", (e) => {
    const msg = String(e?.reason?.message ?? e?.reason ?? "");
    if (isChunkError(msg) && !sessionStorage.getItem(RELOAD_KEY)) {
      sessionStorage.setItem(RELOAD_KEY, "1");
      window.location.reload();
    }
  });
}

function Fallback() {
  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: "#0A0A0A" }}>
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 border-2 border-[#B8AA9A]/30 border-t-[#B8AA9A] rounded-full animate-spin" />
        <span style={{ fontSize: "0.65rem", color: "rgba(255,255,255,0.3)", letterSpacing: "0.15em" }}>CARREGANDO…</span>
      </div>
    </div>
  );
}

class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error: Error | null; reloading: boolean }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null, reloading: false };
  }
  static getDerivedStateFromError(error: Error) {
    // Chunk load error após deploy → recarregar uma vez automaticamente
    if (isChunkError(error.message) && !sessionStorage.getItem(RELOAD_KEY)) {
      sessionStorage.setItem(RELOAD_KEY, "1");
      window.location.reload();
      return { hasError: false, error: null, reloading: true };
    }
    return { hasError: true, error, reloading: false };
  }
  render() {
    if (this.state.reloading) return <Fallback />;
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center" style={{ background: "#0A0A0A" }}>
          <div className="flex flex-col items-center gap-4 max-w-md px-6 text-center">
            <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: "rgba(184,170,154,0.15)" }}>
              <span style={{ color: "#B8AA9A", fontSize: "1.2rem" }}>!</span>
            </div>
            <p style={{ color: "rgba(255,255,255,0.6)", fontSize: "0.8rem" }}>
              Ocorreu um erro ao carregar a aplicacao.
            </p>
            <pre style={{ color: "rgba(255,255,255,0.3)", fontSize: "0.6rem", maxWidth: "100%", overflow: "auto", whiteSpace: "pre-wrap" }}>
              {this.state.error?.message}
            </pre>
            <button
              onClick={() => { sessionStorage.removeItem(RELOAD_KEY); window.location.reload(); }}
              style={{
                background: "rgba(184,170,154,0.15)",
                border: "1px solid rgba(184,170,154,0.3)",
                color: "#B8AA9A",
                padding: "6px 16px",
                borderRadius: "6px",
                fontSize: "0.7rem",
                cursor: "pointer",
                letterSpacing: "0.1em",
              }}
            >
              RECARREGAR
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <RouterProvider router={router} fallbackElement={<Fallback />} />
      </AuthProvider>
    </ErrorBoundary>
  );
}
