
  import { createRoot } from "react-dom/client";
  import App from "./app/App.tsx";
  import "./styles/index.css";
  import { initAttributionTracking } from "./app/lib/tracking";

  // Captura UTM + click IDs (fbclid/gclid/ttclid) na primeira pageview
  initAttributionTracking();

  /* ─── Image Protection: block right-click, drag, and save shortcuts ─── */
  document.addEventListener("contextmenu", (e) => {
    const target = e.target as HTMLElement;
    if (target.tagName === "IMG" || target.tagName === "VIDEO" || target.closest("img, video, picture")) {
      e.preventDefault();
    }
  });

  document.addEventListener("dragstart", (e) => {
    const target = e.target as HTMLElement;
    if (target.tagName === "IMG" || target.tagName === "VIDEO") {
      e.preventDefault();
    }
  });

  document.addEventListener("keydown", (e) => {
    // Block Ctrl+S / Cmd+S
    if ((e.ctrlKey || e.metaKey) && e.key === "s") {
      e.preventDefault();
    }
  });

  createRoot(document.getElementById("root")!).render(<App />);
  