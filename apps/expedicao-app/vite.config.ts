import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";

// Shim Convex/Hercules -> Supabase: as páginas portadas do app Hercules importam
// "convex/react" e "@usehercules/auth/*"; os aliases apontam pros shims locais.
export default defineConfig({
  base: "/",
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: [
      { find: "@usehercules/auth/convex-react", replacement: path.resolve(__dirname, "./src/shim/hercules-auth-convex.tsx") },
      { find: "@usehercules/auth/react", replacement: path.resolve(__dirname, "./src/shim/hercules-auth.tsx") },
      { find: "convex/react", replacement: path.resolve(__dirname, "./src/shim/convex-react.tsx") },
      { find: "@", replacement: path.resolve(__dirname, "./src") },
    ],
  },
  server: { port: 5178, host: "0.0.0.0" },
  build: { outDir: "dist", sourcemap: false },
});
