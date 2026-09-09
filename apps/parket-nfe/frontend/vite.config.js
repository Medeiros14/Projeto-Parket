import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
// Porta 5185 pra não colidir com outros vites locais (homebroker=5180,
// valoria=5181, chat=5182 etc). fiscal.parket.works em prod usa nginx:80.
export default defineConfig({
    plugins: [react()],
    resolve: { alias: { "@": path.resolve(__dirname, "./src") } },
    server: { port: 5185 },
    build: {
        rollupOptions: {
            output: {
                manualChunks: {
                    react: ["react", "react-dom", "react-router-dom"],
                    supabase: ["@supabase/supabase-js"],
                    icons: ["lucide-react"],
                },
            },
        },
        chunkSizeWarningLimit: 1000,
    },
});
