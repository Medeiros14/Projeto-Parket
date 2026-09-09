import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";

export default defineConfig({
  // Assets servidos com URL absoluta — necessário porque o app roda em 2 hosts:
  //   - valor.parket.works/* (admin app)
  //   - proposta.parket.works/v2/* (proposta pública, via Traefik PathPrefix)
  // Sem isso, o /v2/<uuid> tenta carregar /assets/... no proposta.parket.works
  // (que vai pro parket-dashboard via Traefik default) e dá 404.
  base: "/",
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
  server: { port: 5174, host: "0.0.0.0" },
  build: { outDir: "dist", sourcemap: false },
});
