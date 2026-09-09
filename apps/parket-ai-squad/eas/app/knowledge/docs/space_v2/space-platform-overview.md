# Plataformas do ecossistema Space — overview

O **Space** é o nome guarda-chuva pro ecossistema de produtos da Parket. São ~10 superfícies que compartilham linguagem visual, padrões de UX, design tokens e (parcialmente) componentes. Cada uma tem domínio próprio mas a coerência cross-app é uma meta — o usuário precisa sentir que é "o mesmo produto".

## Plataforma principal

### `space.parket.works` — Dashboard Parket (golden)
- **Imagem em prod:** `parket-dashboard:golden-complete` (cuidado: golden é produção, alteração SÓ via hotpatch — ver `dashboard/hotpatch-playbook.md`).
- **Source:** `/root/Dashboardparketapp/` (Vite 6 + React 18 + Tailwind 4 + ~26 Radix primitives).
- **Páginas:** ~50 sob `src/app/pages/` (dashboard, dept-*, ceo-dashboard, command-center, central-do-cliente, brand-manual, cost-workbook, etc.).
- **Roteamento:** `react-router` v6, lazy imports por rota com fallback de chunk reload.
- **Estado:** TanStack Query + contexts (AuthContext, etc.).
- **Tema:** dark mode default, palette dourada Parket (#D4A853 dourado, #B8AA9A taupe, #0A0A0A bg).

### `space.parket.works/v2/` — Rebuild Navona (em construção)
- **Imagem:** `parket-dashboard:navona-v2`. Stack `parket-space-v2`.
- **Source:** `/root/space-navona-v2/` (Vite + React + Tailwind, theme Navona).
- **Status:** Phase 1 ✅ (UI Figma + mock deploy), Phase 2 ✅ (hooks reais: useKanbanCards, useKpis, useAlertas), Phase 3 pendente (portar simulador, PDF, WhatsApp, ClickSign), Phase 4 cutover.

## Plataformas adjacentes

### `draw.parket.works` — Draw Studio
- CAD frontend (canvas 2D), Status (mapas + cronograma), Woodplanner Pro handoff via `/api/wood/projects/from-draw`.
- Persistência em Supabase próprio `kstldkfhoiqepmuqmcmq`.
- Disciplinas: piso, forro, deck, painel, revestimento, brise, ripado, muxarabi, escada, porta.

### `proposta.parket.works` — Proposta pública
- Renderer V12FIX (`propostaGenerator-PGSTRUCT*`), cliente abre no celular maioria das vezes.
- OG preview no WhatsApp depende de `&v=<timestamp>` no link.
- PDF print stylesheet importante.

### `valoria.parket.works` — Simulador/admin Valoria
- Theme Navona, bridge para Parket via RPC `create_proposta_from_valoria`.
- F0–F10 entregues. Catálogo editável + integrações WhatsApp + público formulário.

### `agente.parket.works` — Parket AI Squad UI
- UI do `parket-ai-squad` (Teca V2, OAuth providers, contas).

### Setor apps (frontend separado, padrão visual compartilhado)
- `cs.parket.works` — Central do Cliente.
- `rh.parket.works` — schema `rh` (não public). Calendário + WhatsApp 08h.
- `fiscal.parket.works` — vistorias (cuidado: fiscal NÃO libera pagamento; Produtividade/Natália libera).
- `instala.parket.works` — app prestadores/instaladores (em construção, task #753).
- `cronograma.parket.works` — App Cronograma.
- `conferir.parket.works` / `draw.parket.works/status` — Status / Conferir v2.

## Pontos críticos cross-app

- **Hotpatch flow é lei** no `space.parket.works` (golden). Nada de `npm run build` no source + dist/ → patches/. Ler `dashboard/hotpatch-playbook.md` antes.
- **OAuth Claude compartilhado** (tabela `public.ai_accounts` em `parket-ai-squad_postgres`) entre EAS, Teca V2 e crons.
- **Linguagem visual única** (ver `space-ux-conventions.md`).
- **Sistema de deploy controlado** (#739, #740) com staging em `staging.space.parket.works` e aprovação Will via WhatsApp pra promover.
- **Penpot local** (`penpot.parket.works`) — alternativa open-source ao Figma. Migrar designs futuros pra lá quando possível.
