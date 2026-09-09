import { defineConfig } from 'vite'
import path from 'path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [
    // The React and Tailwind plugins are both required for Make, even if
    // Tailwind is not being actively used – do not remove them
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      // Alias @ to the src directory
      '@': path.resolve(__dirname, './src'),
    },
  },

  // File types to support raw imports. Never add .css, .tsx, or .ts files to this.
  assetsInclude: ['**/*.svg', '**/*.csv'],

  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          // ── Vendors estáveis ──
          if (id.includes('node_modules')) {
            if (id.includes('react-dom') || id.includes('react-router') || (id.includes('/react/') && !id.includes('react-')))
              return 'vendor-react'
            if (id.includes('@supabase'))
              return 'vendor-supabase'
            if (id.includes('recharts') || id.includes('d3-'))
              return 'vendor-recharts'
            if (id.includes('@radix-ui'))
              return 'vendor-radix'
            if (id.includes('react-dnd'))
              return 'vendor-dnd'
            if (id.includes('lucide-react'))
              return 'vendor-lucide'
          }

          // ── Core compartilhado (muda pouco) ──
          if (id.includes('app/components/dept-layout'))   return 'core-layout'
          if (id.includes('app/components/dept-toolkit'))   return 'core-layout'
          if (id.includes('app/components/sistema-ops-data')) return 'core-data'
          if (id.includes('app/components/sla-rules-panel')) return 'core-layout'
          if (id.includes('app/components/equipes-parket'))  return 'core-layout'
          if (id.includes('app/lib/kanban-handoffs'))        return 'core-layout'

          // ── Hooks compartilhados ──
          if (id.includes('app/hooks/useKanbanCards'))  return 'core-hooks'
          if (id.includes('app/hooks/useHandoffs'))     return 'core-hooks'
          if (id.includes('app/hooks/useKpis'))         return 'core-hooks'
          if (id.includes('app/hooks/useAlertas'))      return 'core-hooks'
          if (id.includes('app/hooks/useAtividades'))   return 'core-hooks'
          if (id.includes('app/hooks/useNotificacoes')) return 'core-hooks'
          if (id.includes('app/hooks/useUsers'))        return 'core-hooks'
          if (id.includes('app/hooks/useTeamMembers'))  return 'core-hooks'
          if (id.includes('app/hooks/useCardMovements'))return 'core-hooks'

          // ── Auth / Supabase client ──
          if (id.includes('app/contexts/'))   return 'core-auth'
          if (id.includes('app/lib/supabase')) return 'core-auth'
          if (id.includes('utils/supabase'))   return 'core-auth'

          // Setores: cada dept-*.tsx vira chunk isolado (Vite já faz via lazy import,
          // mas forçar aqui garante que não sejam agrupados com outros módulos)
        },
      },
    },
  },
})
