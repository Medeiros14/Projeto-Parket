# parket-fiscal

> App do fiscal de obra (`verifica.parket.works`). O fiscal aprova
> material, faz vistorias, tira fotos, resolve ocorrencias e valida
> instaladores.

## O que faz

Interface mobile-first pro fiscal Parket que visita as obras:

- **Home / Hoje** — obras em Acompanhamento hoje (coluna, nao funil
  inteiro), obras online no calendario, ordenacao inteligente.
- **Card da obra** — abas: Documentos (visor in-app), Fiscal (laudos +
  vistorias + ocorrencias), Prestadores, Validacao, Historico.
- **Validacao fiscal** — Instala manda pedido de material → Verifica
  aprova/reprova → volta pro instalador com feedback do fiscal.
- **Laudos** — multiplos por obra (Parket + Cliente/aditivo), campo
  livre pra distinguir reparos.
- **Ocorrencias** — historico + resolver do Instala. Fiscal cria
  crise so pelo alerta (Ocorrencias virou historico).
- **Camera in-app** — visor fullscreen com lista, contador, arraste,
  compressao. Nunca abre aba de navegador.
- **Ditado por voz** em todos os campos de texto.
- **Fila offline** com IndexedDB pros envios (backoff + badge +
  atencao).
- **Meus custos** — lancamentos do fiscal (hotel, km, litro), memoria
  de valores por lancamento.
- **HIST** — laudos concluidos + abrir PDF.
- **Chip endereco** — Maps, Waze (`navigate=yes`), Copiar (sem
  WhatsApp, decisao de 04/09).

## Como se interliga com o ecossistema

- **Le de:** `parket-gestao` (agendamento, obras, laudos, prestadores),
  `parket-pg-local` schema `fiscal.*`.
- **Escreve em:** `gestao.eventos` (payload fiscal), `parket-chat`
  (notif de crise ou ocorrencia), `parket-instala` (feedback do
  fiscal pro instalador).
- **Depende de:** api.parket.works (auth), Web Speech (ditado),
  MediaDevices.getUserMedia (camera).
- **E usado por:** equipe de fiscais de obra.

## Stack

- **Frontend:** React + Vite + Tailwind, PWA
- **Backend:** compartilha `parket-gestao/backend` (namespace `/fiscal`)
- **Banco:** Postgres local schemas `fiscal.*` e `gestao.*`
- **Deploy:** stack `parket-fiscal` (verifica.parket.works)
- **Bibliotecas:** IndexedDB (fila offline), radix-ui, react-router,
  browser-image-compression

## Onde uso IA

- **Ditado por voz pt-BR** via Web Speech API (browser-side).
- **Analise de fotos** — nao usa Claude ainda; historico versionado
  das anotacoes (feito em 27/08).

## Como rodar localmente

```bash
cd apps/parket-fiscal
cp .env.example .env
npm install
npm run dev
```

## O que aprendi construindo isso

- **App de campo nao abre aba.** Documento tem que abrir num visor
  fullscreen dentro do proprio app, com lista/contador/arraste.
  Abrir aba nova em mobile perde o contexto e o fiscal desiste.
- **Zoom `--pkz` vs 100vh:** `body{zoom}` + Chrome sem compensar `vh`
  = tela corta no meio e vao vazio embaixo. Nunca `100vh` cru.
- **Fetch com timeout+retry e erro com proximo passo.** Fiscal em obra
  tem rede ruim; falha silenciosa deixa ele perdido. Toda chamada
  fala o que aconteceu e o que fazer.
- **Fiscal ve todas as obras dele** (ramo `details.fiscais` na
  `vw_instala_minhas_obras`), nao so as suas atribuidas manualmente.
- **Aviso de pendencia so apos o evento.** Chip "nao foi feito" so
  aparece depois que o fluxo rodou 1x; nunca default da lista.
