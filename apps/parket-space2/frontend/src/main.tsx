import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import "./index.css";

// Aplica tema persistido antes do React montar (evita flicker)
const saved = localStorage.getItem("pk-theme") as "dark" | "light" | null;
if (saved === "light") document.documentElement.classList.add("light");

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
);
