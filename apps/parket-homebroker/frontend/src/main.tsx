import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import { ErrorBoundary } from "./components/ErrorBoundary";
import "./index.css";

// Captura erros globais não-React pra ajudar diagnóstico
window.addEventListener("error", (e) => console.error("[window.error]", e.message, e.error));
window.addEventListener("unhandledrejection", (e) => console.error("[unhandledrejection]", e.reason));

// PWA — registra service worker pra habilitar instalabilidade no Chrome/Android
// e cache-first dos assets do shell. iOS suporta "Add to Home Screen" mesmo
// sem SW (manifest + meta tags bastam), mas o SW melhora load offline.
if ("serviceWorker" in navigator && window.location.protocol === "https:") {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch((e) => console.warn("[SW] register fail:", e));
  });
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </ErrorBoundary>
  </React.StrictMode>,
);
