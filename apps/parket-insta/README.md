# parket-insta

> InstaParket: feed interno estilo Instagram por obra. Time de Sucesso do Cliente posta na hora, o cliente ve carrossel+video via link, com notificacao no chat.

## O que faz

- **Feed interno** (`insta.parket.works`) com perfil por cliente
- **Cliente ve so o dele** via link com `center_token`
- **Curadoria do time de Sucesso do Cliente** — aba Acompanhamento no `gestao.parket.works`
- **Notificacoes** — post/comentario → chat da obra (parket-chat)
- **Posts** com carrossel + video, curtir, comentar
- **Endpoints** `/api/insta/*` no gestao API

## Como se interliga com o ecossistema

- **Le de:** `insta.posts`, `insta.midias`, `kanban_cards` pra vincular cliente
- **Escreve em:** `parket-chat` (notificacoes)
- **Depende de:** api.parket.works, Supabase Storage (midia)

## Stack

React + Vite (mobile-first), backend no gestao API, schema `insta.*` no PG local, deploy stack `parket-insta`

## Onde uso IA

Nao usa IA. Curadoria e humana.
