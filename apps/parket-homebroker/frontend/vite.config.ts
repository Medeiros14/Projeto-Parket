import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  resolve: { alias: { "@": path.resolve(__dirname, "./src") } },
  server: { port: 5180 },
  build: {
    // Bundle splitting — separa vendors pesados pra reduzir initial load
    rollupOptions: {
      output: {
        manualChunks: {
          react: ["react", "react-dom", "react-router-dom"],
          supabase: ["@supabase/supabase-js"],
          charts: ["recharts"],
          icons: ["lucide-react"],
        },
      },
    },
    // Aumenta o aviso de chunk grande pra 1MB (avoid warning spam)
    chunkSizeWarningLimit: 1000,
  },
});
