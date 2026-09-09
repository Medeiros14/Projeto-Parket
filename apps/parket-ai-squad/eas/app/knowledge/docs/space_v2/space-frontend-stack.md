# Stack frontend — Dashboard Parket (golden) e Space rebuild

## Repositórios

| Repo | Path | Função |
|---|---|---|
| Dashboardparketapp | `/root/Dashboardparketapp/` | Source do golden em prod (`parket-dashboard:golden-complete`) |
| Patches | `/root/Dashboardparketapp/patches/` | Hotpatches diários — fonte de verdade do que está em prod |
| Space Navona v2 | `/root/space-navona-v2/` | Rebuild paralelo em `/v2/` (Navona theme) |

**Regra:** o **container em produção é a fonte de verdade**. Antes de editar um chunk em `patches/`, SEMPRE `docker cp` do container e diffar (memória `feedback_hotpatch_sync_container.md`).

## Stack

### Linguagem + build
- **TypeScript 5** + **React 18** (próx. migração 19).
- **Vite 6.3** — build rápido, code-split por rota.
- **Tailwind CSS 4** (engine novo, sem PostCSS plugin).
- **react-router 6** com lazy imports.

### UI primitives
- **26 pacotes `@radix-ui/react-*`** instalados — accordion, alert-dialog, aspect-ratio, avatar, checkbox, collapsible, context-menu, dialog, dropdown-menu, hover-card, label, menubar, navigation-menu, popover, progress, etc.
- **Padrão shadcn/ui** por cima dos Radix — wrappers em `src/app/components/ui/`.
- **MUI 7** instalado em paralelo (legacy de algumas páginas) — preferir Radix/shadcn em código novo.

### Estilo
- **Tailwind 4** com tema customizado (cores Parket).
- **Emotion** + **MUI** ainda em uso legacy.
- Animações curtas via Tailwind transitions + Framer Motion onde precisa de orchestration.

### Data + estado
- **TanStack Query** pra fetch + cache.
- **Contexts** (AuthContext, etc.) — sem Redux/Zustand globalizado.
- **Supabase JS client** pra realtime + auth (cuidado: tabela precisa estar em `pg_publication_tables` pra postgres_changes funcionar — ver `feedback_supabase_realtime_publication.md`).

### Estrutura de pastas (`src/app/`)
- `pages/` — uma rota por arquivo (~50 páginas)
- `components/` — UI compartilhada (shadcn wrappers + custom)
- `contexts/` — auth + global state
- `hooks/` — custom hooks (`useKanbanCards`, `useKpis`, `useAlertas`, `useAtividades`, etc.)
- `lib/` — helpers, supabase client, formatters
- `routes.ts` — config das rotas com lazy imports

### Chunks importantes (prod)
Cada `dept-*`, `propostaGenerator-PGSTRUCT*`, `MARCFIX*`, `PGSTRUCT*` vira um chunk com hash no nome (ex: `dept-layout-v2-DWGFIX1.js`, `propostaGenerator-V12FIX.js`). Quando hotpatch:

1. Sync do container pro `patches/`
2. sed no JS minificado
3. Dockerfile `FROM parket-dashboard:golden` + COPY do chunk
4. `/root/deploy-dashboard.sh` faz build + service update

## Servidores web

- **nginx** dentro do container do golden serve `/usr/share/nginx/html/`.
- Em hotpatch, os arquivos vão pra `/usr/share/nginx/html/assets/<chunk>.js`.
- **Headers no-cache** críticos pra hotpatch propagar (memória `feedback_deploy_dashboard_checklist.md`).

## Smoke test obrigatório pós-deploy
Memória `feedback_zero_regressao.md` + `feedback_verificar_deploy_md5.md`:
1. Container Up + healthy (`docker service ps`)
2. CODE_VERSION atualizado em todos chunks que referenciam a feature
3. md5 do arquivo no container == md5 em `patches/`
4. `grep fix_novo` no chunk em prod
5. `node --check` no JS pra garantir sintaxe ok
6. `default.conf` está no Dockerfile (não some)
7. HTTP 200 em `https://space.parket.works`
8. Playwright screenshot da página afetada — visual smoke

Faltar 1 = não posso dizer "deployei".

## Sistema de deploy controlado (#739, #740)
- `staging.space.parket.works` — build livre durante o dia.
- 21h BRT (cron) → pergunta no WhatsApp do Will se promove pro golden.
- "sim <token>" libera; sem confirmação → não promove.
- Poller checa `whatsapp_messages` (não webhook — evita conflito com Teca).
