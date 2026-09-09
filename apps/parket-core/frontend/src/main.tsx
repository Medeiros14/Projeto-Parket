import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import "./index.css";
import { ensureThemeInitialized } from "./lib/theme";

// Aplica tema salvo (ou prefers-color-scheme) ANTES do React montar — sem flash
ensureThemeInitialized();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>,
);
