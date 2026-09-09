import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import { ErrorBoundary } from "./components/ErrorBoundary";
import "./index.css";

// Log global de erros pra ajudar diagnóstico em prod (mesmo padrão dos outros apps Parket)
window.addEventListener("error", (e) => console.error("[window.error]", e.message, e.error));
window.addEventListener("unhandledrejection", (e) => console.error("[unhandledrejection]", e.reason));

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </ErrorBoundary>
  </React.StrictMode>,
);
