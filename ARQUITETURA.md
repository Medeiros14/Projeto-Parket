# Arquitetura do Projeto Parket

Este documento explica **como os apps rodam de verdade** em producao:
servidor, bancos de dados, deploy, autenticacao, integracoes externas,
tempo real e IA. E o mapa que uso pra pensar o sistema.

Se voce quer entender **o que cada app faz**, comeca pelo [README.md](./README.md).
Aqui e sobre **infraestrutura**.

---

## Servidor e Deploy

### Docker Swarm + Traefik

Todo o sistema roda em um **cluster Docker Swarm**, com **Traefik** como
reverse proxy. Cada aplicativo e um **stack Swarm** proprio (`docker stack deploy`),
publicado num subdominio `*.parket.works`:

- `gestao.parket.works` → parket-gestao (frontend + backend juntos)
- `hb.parket.works` → parket-homebroker
- `valor.parket.works` → parket-space2 (workspace de propostas)
- `chat.parket.works` + `server.parket.works` → parket-chat (mesmo servico,
  Traefik `Host||Host`)
- `producao.parket.works`, `compras.parket.works`, `suprimentos.parket.works`,
  `expedicao.parket.works`, `instala.parket.works`, `verifica.parket.works`,
  `insta.parket.works`, `fiscal.parket.works`, `monitor.parket.works`,
  `contrato.parket.works`, `rh.parket.works`, `space.parket.works`,
  `draw.parket.works`, `nfe.parket.works`, e por ai vai.

Traefik faz roteamento + TLS automatico (Let's Encrypt). DNS aponta o
wildcard `*.parket.works` pro IP do servidor. Cada stack declara suas
labels Traefik.

### Padrao de deploy

Sem `:latest`. **Sempre tag datada** (`parket-app:20260908-1445`), com
`service update --force` no fim pra garantir troca do container. Motivo:
`docker stack deploy` com `:latest` **nao troca** o container se a tag
nao mudou (aprendi na marra — [feedback_docker_stack_deploy_latest](
./apps/parket-chat)).

Scripts de deploy por app em `/root/deploy-*.sh`. Alguns apps sensiveis
(Dashboardparketapp) tem **golden protection**: existe uma imagem
`parket-dashboard:golden-complete` validada e nenhum comando pode
sobrescreve-la (regra explicita em `CLAUDE.md`).

### CI/CD

Nao uso GitHub Actions em massa. Deploy e **manual via SSH + script**,
com commit + push. Motivo: agilidade em corrigir bug critico em minutos,
sem esperar pipeline. Trade-off aceitavel pro tamanho da equipe.

---

## Bancos de Dados

O ponto mais importante da arquitetura: **duas fontes de verdade
espelhadas**.

### 1. Postgres local (`parket-pg-local`)

Roda no proprio servidor, dentro do Swarm. E a **fonte de verdade
operacional**:

- Schemas por dominio: `gestao.*`, `ops.*`, `core.*`, `producao.*`,
  `compras.*`, `expedicao.*`, `insta.*`, `monitor.*`, `teca.*`, e por ai.
- `orcamento_tabela_precos`: catalogo mestre de todos os produtos e
  precos. **A fonte unica** — Cloud e espelho e apaga orfaos em 5s.
- Trigger prevent_dup + reconcile continuo pra manter consistencia.
- Backup diario + logs de replicacao.

### 2. Supabase Cloud (instancia dedicada)

E um **espelho** do Postgres local. Serve pra:

- **Autenticacao** (GoTrue) — todo login passa por aqui.
- **Tempo real** (Realtime) — cards do kanban movendo ao vivo.
- **Storage** — anexos, PDFs, fotos.
- **PostgREST** — API auto-gerada consumida pelos frontends.

Sync via **watcher cron** (a cada 3-5 min) escrito em Python. Mantem
consistencia bi-direcional com regras de precedencia claras.

### Por que essa arquitetura?

- **Latencia zero interna:** consultas complexas rodam local, sem
  round-trip pro Cloud.
- **Cloud e o entry point publico:** frontends consomem PostgREST
  do Cloud, sem exposer o Postgres local.
- **Sobrevive a incidentes:** ja passamos por episodios do Cloud fora
  do ar (PostgREST 522) e a operacao interna seguiu funcionando no
  local, com o sync retomando quando o Cloud voltou.

---

## Autenticacao

### GoTrue (Supabase Auth) — canal principal

- Todos os apps logam via `api.parket.works` (que e um **nginx + PostgREST
  gateway** pro Cloud).
- Perfis em `user_profiles` com departamento (comercial, orcamento,
  operacoes, financeiro, fabrica, campo, admin).
- Portal de apps por departamento em `parket-space-portal`.
- Cada app checa dept + overrides individuais pra liberar acesso.
- Um mesmo usuario ganha token diferente por app (RLS por schema).

### Auth Guard (OTP WhatsApp)

Aprovacoes financeiras sensiveis (compras acima de um valor limite,
aditivos) exigem codigo de 6 digitos enviado pelo WhatsApp via
`parket-auth-guard`. Codigo NUNCA aparece no chat interno (regra
rigida: o canal out-of-band e o WhatsApp, expor no chat quebra a
seguranca do fluxo OTP).

### Emergency Auth

Se GoTrue cai, `parket-emergency-auth` deixa admins entrarem por
canal alternativo pra investigar o incidente.

---

## Chat Interno e Tempo Real

`parket-chat` e um Slack-like proprio:

- **SPA fullpage** em `chat.parket.works` (3 colunas: sidebar + lista +
  conversa)
- **Widget FAB** embutido em TODOS os outros apps (menos hub `space` e
  Draw/Wood Planner). O widget desliza sozinho pra nao cobrir botoes.
- **1 thread por obra** (dedup por canonicalObraName, nao por card_id).
- **Push notifications via VAPID** (web-push). Chaves geradas uma vez
  e mantidas em env vars — regerar invalida todas as subscriptions
  existentes do browser dos usuarios.
- **DMs, mencoes @, tarefas de obra, quote-reply estilo WhatsApp,
  formatacao Slack (bold/italic/code), pins com validade, gravacao de
  audio no composer, transcricao pt-BR automatica (Web Speech).**
- **Search** via FTS5.
- Copiloto **Teca** na sidebar direita pra perguntar sobre a conversa.

### Widget = mesmo servico, mesma imagem

Widget e SPA sao **o mesmo container** (`parket-chat_chat`). Traefik
roteia pelo Host. Ambos leem o mesmo Postgres.

---

## Integracoes Externas

### DocuSign (contratos)

`parket-docusign` e o backend de assinatura eletronica. Padrao:

1. Cliente aceita proposta no Valoria
2. Backend gera envelope DocuSign com PDF do contrato + slide de
   pagamento (Pix ou Boleto Itau)
3. Webhook DocuSign entra em `parket-docusign` → grava compensacao
   no Cloud → dispara perna 6 do watcher → cria projeto no
   `parket-gestao` + parcelas no `parket-core`

### Itau (Pix + Boleto)

Duas APIs distintas do Itau (aprendi que **nao existe padrao universal**):

- **APIs antigas** (`/sandboxapi/*` + `x-sandbox-token`) — sandbox
  incompativel com prod
- **APIs novas** (Boleto com Pix v3) — path igual prod +
  `Authorization: Bearer`

Sandbox → prod exige mudanca de codigo, nao so URL.

### Meta Ads / CAPI

`parket-mkt` sync do gasto por campanha diario. `parket-homebroker`
dispara evento **Qualificado → Meta CAPI** e **Ganho → Purchase**
quando o lead avanca. Backfill retroativo tem gate de 7 dias (Meta
rejeita `event_time > 7d`).

### WhatsApp (WAHA + wavoip)

`parket-waha` = gateway WhatsApp Business API. `parket-wavoip` = chamadas
de voz. Roda em uma instancia dedicada da Evolution API pro atendimento
comercial.

Repointar o numero move grupos + conversas juntos (FK composta em 2 bancos).

### Google Drive

`parket-homebroker` cria 1 pasta/cliente automaticamente. Ao fechar
o negocio, pasta e movida de "Comercial/Home Broker" pra "Projetos".
Pasta arquivada vai pra "_Arquivo" (nunca trash). Upload via Apps
Script v2.2.

---

## IA (Anthropic Claude)

### Modelos

- **Claude Opus 4.7** (`claude-opus-4-7`) — Teca (montagem de orcamento),
  extracao pesada de PDFs, decisoes complexas
- **Claude Sonnet 4.6** (`claude-sonnet-4-6`) — rotinas de qualificacao
  de leads, dedup semantico
- **Claude Haiku 4.5** (`claude-haiku-4-5-20251001`) — background,
  batch, revisao rapida

### Onde entra

- **parket-teca** + **parket-valoria-teca** (FastAPI + Anthropic SDK):
  agente conversacional que monta orcamento inteiro por linguagem natural.
  Ferramentas: `montar_orcamento`, `fechar_total`, `marcar_etapa`, com
  state machine em `state_machine.py`.
- **parket-whisper** (self-hosted faster-whisper): transcreve reunioes
  semanais gravadas → Claude extrai resumo + tarefas por bloco →
  aprovar posta no chat da obra.
- **Extracao PDF vision** (parket-gestao): 18 PDFs escaneados viraram
  linhas estruturadas via document blocks. 148 projetos flat migrados
  pro modelo hierarquico com ajuda de Claude.
- **Qualidade de leads** (parket-homebroker): Claude analisa contexto
  do WhatsApp e prioriza funil.
- **Detector de crises** (Teca Reuniao): identifica crises por contexto
  conversacional.
- **Insights** (projetos-app): BI de saude do setor.
- **Descritivo comercial** (Valoria): geracao automatica de textos
  de porta, revestimento, painel, com regras de negocio (caps por
  categoria, ambient split, strip de metragem).

### Roteador multi-agente

`parket-ai-squad` orquestra agentes especialistas (router + specialists)
pra tarefas que exigem passos coordenados.

---

## Monitoramento

`monitor-app` = status page dos 43 dominios `parket.works`. Backend Node
checker a cada 60s + API + static SPA no estilo `status.claude.com`.
Editar `monitor.apps` no PG local muda a pagina sem redeploy.

Logs: cada stack loga em `journald` do Docker. Log rotation configurada
no daemon Docker (50 MB por arquivo, 3 arquivos rotativos) pra nao
lotar o disco.

---

## Padroes de sincronizacao (cross-app)

Regra unica que aparece em varios apps:

> **Card novo nasce sempre no `parket-homebroker`.** Outros apps
> consomem via sync/espelho, mas nao criam cards sozinhos (evita
> orfaos e mantem uma fonte unica de verdade pra vida do lead).

Exemplo: `projetos-app` nao tem botao "Novo Card"; `parket-gestao` nao
tem "Novo Projeto Manual". Se voce quer criar uma obra, comeca no CRM.

Watchers cron rodando a cada 3-5 minutos:

- contrato assinado → cria parceiro + obra + parcelas + comissao
- termo de pagamento → baixa parcelas e recebimentos correspondentes
- fecha proposta automaticamente pos-assinatura
- kanban do PCP espelha a fase do board de Projetos
- sync de dados legados do Apps Script
- reconcile bi-direcional entre Postgres local e Supabase Cloud

---

## Trade-offs assumidos

- **Sem microservicos puros**: cada app e um stack Docker, mas
  compartilham Postgres. Reduz complexidade, aumenta acoplamento por
  schema. Aceitavel pro tamanho da equipe.
- **Frontend + backend juntos em muitos apps**: parket-gestao tem
  FastAPI + React no mesmo repo. Facilita deploy sincronizado,
  dificulta reuso.
- **Sem GraphQL**: PostgREST + REST simples resolvem >90% dos casos.
- **Comentarios no codigo**: sim, sempre (WHAT + WHY). Contra o padrao
  moderno de "codigo se explica", mas ajuda o proprio Nathan
  6 meses depois em codebase dessa escala.

Detalhes por app nos READMEs de `apps/*/README.md`.
