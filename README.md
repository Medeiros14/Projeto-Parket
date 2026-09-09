# Projeto Parket

Sistema operacional interno da **Parket** (empresa de pisos de madeira, deck, forro,
painel e marcenaria fina). Este monorepo agrupa **os aplicativos que eu construi e
mantenho** pra rodar a operacao ponta a ponta: da chegada do lead pelo WhatsApp
ate a entrega da obra no cliente final, passando por orcamento, contrato, fabrica,
logistica, financeiro e pos-venda.

Nao e um projeto isolado. Sao ~40 aplicativos que se conversam entre si por
banco compartilhado, chat interno, webhooks e watchers cron. O README de cada
app explica **o que ele faz** e **como interliga com o resto do ecossistema**.

Se voce e recrutador e quer entender rapido:

- **[ARQUITETURA.md](./ARQUITETURA.md)** — a stack completa (servidor, bancos,
  deploy, integracoes externas, autenticacao, IA)
- **[apps/](./apps/)** — codigo-fonte de cada aplicativo, cada um com README proprio
- **[docs/TEMPLATE_README_APP.md](./docs/TEMPLATE_README_APP.md)** — o template
  que sigo pra documentar cada app

---

## Contexto de negocio

A empresa vende **piso de madeira, deck, forro, painel ripado, revestimento em
madeira e marcenaria fina** pra obras residenciais de alto padrao. O ciclo de
venda comeca no WhatsApp/Instagram (lead), passa por **projeto executivo**,
**orcamento detalhado por ambiente**, **contrato assinado eletronicamente**,
**fabricacao sob medida** e **instalacao supervisionada por fiscal**. Termina
com **assistencia tecnica** e **acompanhamento pos-obra**.

Cada uma dessas etapas ganhou um aplicativo dedicado (ou uma parte de um),
sempre pensando em quem vai usar: vendedor, orcamentista, arquiteta parceira,
fabrica, instalador, fiscal, cliente final.

## O ecossistema em uma imagem

```
                +--------------------+
                | 1. LEAD chega no   |
                |    WhatsApp/Insta  |
                +----------+---------+
                           |
                           v
+-----------+     +--------+--------+     +------------------+
|  parket-  | <-- | 2. parket-      | --> |  parket-teca     |
|  chat     |     |    homebroker   |     |  (IA orcamento)  |
|  (msgs    |     |    (CRM: kanban |     +--------+---------+
|   dentro  |     |    vendas)      |              |
|   do sist)|     +--------+--------+              v
+-----------+              |               +------------------+
     ^                     v               | parket-valoria-  |
     |            +--------+--------+      | teca (proposta   |
     |            | 3. parket-      | <--- | detalhada por    |
     |            |    contratos    |      | ambiente + PDF)  |
     |            |    (DocuSign +  |      +------------------+
     |            |    Itau boleto/ |
     |            |    Pix)         |
     |            +--------+--------+
     |                     |
     |                     v
     |            +--------+--------+     +------------------+
     |            | 4. parket-      | --> | producao-app     |
     |            |    gestao       |     | (PCP fabrica:    |
     |            |    (obras +     |     | OP, materiais)   |
     |            |    equipes +    |     +------------------+
     |            |    projetos)    |
     |            +--------+--------+     +------------------+
     |                     |          --> | compras-app      |
     |                     |              | (fornecedores +  |
     |                     |              | NF-e + estoque)  |
     |                     |              +------------------+
     |                     v
     |            +--------+--------+     +------------------+
     |            | 5. instala-app  | --> | parket-fiscal    |
     |            |    (instalador  | <-- | (fiscal aprova   |
     |            |    no campo:    |     | material +       |
     |            |    fotos, GPS,  |     | vistorias)       |
     |            |    checklist)   |     +------------------+
     |            +--------+--------+
     |                     |
     |                     v
     |            +--------+--------+
     |            | 6. parket-core  | --> parket-nfe (fiscal)
     |            |    (financeiro: |     parket-rh
     |            |    comissoes,   |     parket-mkt (Meta Ads)
     |            |    RT, impostos,|
     |            |    Nubank UX)   |
     |            +--------+--------+
     |                     |
     +---------------------+  <- chat interno percorre TODOS os apps
```

Toda mensagem, comentario, tarefa e alerta cai no **parket-chat** (Slack-like
interno), e cada obra tem um **thread proprio** onde vendedor, orcamentista,
projetista, fiscal e instalador conversam.

---

## Onde eu uso IA (Claude)

- **parket-teca** e **parket-valoria-teca**: assistente conversacional que
  monta orcamento inteiro por linguagem natural (ex: "150m² de piso chevron
  carvalho europeu naturalle, 40m² de deck cumaru, 3 portas camarao MDF"), com
  BOM de insumos por m², dedup de itens identicos, e validacao de matematica.
- **Extracao de PDFs escaneados** (parket-gestao): visao computacional +
  document blocks pra virar 18 PDFs de propostas antigas em linhas estruturadas.
- **Reunioes semanais** (parket-whisper + gestao): audio via faster-whisper
  self-hosted → transcricao → Claude extrai resumo + tarefas por bloco →
  aprovar posta no chat da obra.
- **Qualidade de leads** (parket-homebroker): Claude analisa contexto do
  WhatsApp e prioriza o funil.
- **Detector de crises** (Teca Reuniao): identifica crises por contexto
  conversacional.
- **Insights de saude do setor** (projetos-app): dashboard BI com sugestoes.
- **Descritivo de porta e revestimento**: geracao automatica dos textos
  comerciais com regras de negocio.

Modelos usados: **Claude Opus 4.7** (raciocinio pesado, orcamento),
**Claude Sonnet 4.6** e **Claude Haiku 4.5** (rotinas rapidas e background).

---

## Stack em uma linha

React + Vite (frontends) · FastAPI + Python (backends) · Postgres local +
Supabase Cloud espelho · Docker Swarm + Traefik · Anthropic Claude · faster-whisper
· DocuSign · Itau (Pix Recebimentos + Boleto v3) · Meta Ads/CAPI · WAHA WhatsApp
· Google Drive · Web Push VAPID

Detalhes completos em **[ARQUITETURA.md](./ARQUITETURA.md)**.

---

## Como o repo esta organizado

```
Projeto-Parket/
  README.md              (voce esta aqui)
  ARQUITETURA.md         (stack, deploy, bancos, integracoes)
  .gitignore
  apps/
    parket-gestao/       (core operacional: obras, equipes, projetos)
    parket-core/         (financeiro, comissoes, contas)
    parket-chat/         (Slack interno + widget embutido nos outros apps)
    parket-fiscal/       (fiscal de obra, vistorias, laudos)
    parket-homebroker/   (CRM comercial + kanban vendas)
    parket-teca/         (agente IA de orcamento)
    parket-valoria-teca/ (backend do Teca em FastAPI + Anthropic)
    parket-contratos/    (contratos DocuSign + boleto Itau)
    parket-docusign/     (backend integracao DocuSign + Itau sandbox)
    parket-nfe/          (fiscal.parket.works — XML NF-e do contador)
    parket-whisper/      (faster-whisper self-hosted pra transcricoes)
    parket-rh/           (contratos RH + assinatura)
    parket-space-portal/ (portal intranet: apps por departamento)
    parket-space2/       (workspace de propostas Valoria)
    parket-center/       (Central do Cliente: obra visivel pro cliente final)
    parket-insta/        (feed interno estilo Instagram por obra)
    parket-mkt/          (Meta Ads + CAPI)
    parket-wavoip/       (integracao WhatsApp voice)
    parket-ai-squad/     (multi-agent orchestration)
    parket-2026/         (proposta publica standalone)
    parket-devportal/    (portal de skills e ferramentas dev internas)
    parket-emergency-auth/ (fallback auth quando GoTrue cai)

    Dashboardparketapp/  (dashboard legado — golden protegida, hotpatch only)
    instala-app/         (mobile-first pro instalador no canteiro)
    projetos-app/        (kanban de projetos executivos + fase por Trello)
    producao-app/        (PCP fabrica: kanban de 8 fases, OP, materiais)
    compras-app/         (ERP compras: fornecedores, NF-e, estoque)
    suprimentos-app/     (emprestimo/devolucao de ferramentas)
    expedicao-app/       (logistica: agenda, carta de frete)
    monitor-app/         (status page dos 43 apps, estilo status.claude.com)

    infra/
      parket-api/          (nginx + PostgREST gateway pro Cloud)
      parket-pg-local/     (stack Postgres local + auth + storage)
      parket-supabase-proxy/ (proxy GoTrue local)
      parket-waha/         (WAHA WhatsApp gateway)
      parket-auth-guard/   (OTP WhatsApp de aprovacao)

    legado/
      parket-2026/         (versao antiga da proposta publica)
      parket-app/          (primeira versao do app mobile)
      parket-cs/           (customer success v1)
      parket-devportal/    (v1)
      parket-emergency-auth/ (v1)
      parket-guia/         (guia de instalacao v1)
      parket-proposta-b/   (proposta versao B — experimento standalone)
      parket-rh-api/       (backend RH primeira versao)
      parket-site/         (site marketing antigo)
      parket-skills/       (portal de skills antigo)
      cronograma-app/      (cronograma standalone antes de virar aba do gestao)
  docs/
    TEMPLATE_README_APP.md
```

---

## Sobre mim

Sou **Nathan Medeiros**, desenvolvedor na Parket. Construi esse
ecossistema (backend + frontend + banco + deploy + IA) tocando as decisoes
de produto direto com quem usa cada aplicativo (vendedor, fiscal,
orcamentista, CEO). Nada aqui foi copiado de tutorial — cada coisa nasceu
de uma dor real de negocio que apareceu no chao de fabrica ou na reuniao
semanal.

Se voce quer conversar sobre um dos apps especificamente, cada um tem
README com **decisoes tecnicas que tomei** e **o que aprendi construindo**.

Contato: **nathan.medeiros1404@gmail.com**

---

## Agradecimentos

Um obrigado especial ao **Will**, colega e mentor tecnico, que me ajudou
demais ao longo dessa jornada — desde as primeiras decisoes de
arquitetura ate a resolucao de bugs no dia a dia. Boa parte do que eu
aprendi construindo esse ecossistema veio das conversas com ele.
