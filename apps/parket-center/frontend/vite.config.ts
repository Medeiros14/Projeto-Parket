import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      "/api": { target: "https://gestao.parket.works", changeOrigin: true },
      // Editor de cotas (etapa 12) fala com o backend do Draw em dev
      "/draw-api": {
        target: "https://draw.parket.works",
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/draw-api/, "/api"),
      },
    },
  },
});
