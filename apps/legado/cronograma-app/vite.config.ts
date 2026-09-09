import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  // Assets cross-origin friendly: prefixo absoluto pro próprio host.
  // Igual ao padrão Valor — o app fica isolado mas com bundle confiável.
  base: "https://cronograma.parket.works/",
  plugins: [react()],
  server: { port: 5176, host: "0.0.0.0" },
  build: { outDir: "dist", sourcemap: false },
});
