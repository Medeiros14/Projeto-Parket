# parket-wavoip

> Integracao WhatsApp voice. Aprovacao individual de proposta pelo gestor comercial via mensagem de voz no WhatsApp.

## O que faz

- **gestor comercial aprova/reprova sim** direto por voz no WhatsApp
- **Link estavel** SEMPRE via `propostas.url_publica` (Space renderer)
- **Filtrar por status de analise do gestor** + write-back + ordenacao por orcamentista/data
- **Paralelizar /pendentes** com asyncio.gather
- **Backend com bloco analise_custo** + itens na resposta de aprovacao
- **Dedup sims por numero** + fallback pro workspace de propostas
- **PATCH cards_solicitacao Valoria** + HB mostra orcamento em handoff-com

## Como se interliga com o ecossistema

- **Le de:** `ops.propostas`, `ops.simulacoes`, WAHA WhatsApp
- **Escreve em:** `ops.cards_solicitacao`, decisoes do gestor comercial, `parket-chat`
- **Depende de:** WAHA, api.parket.works

## Stack

FastAPI + Python, integracao WAHA, PG local, deploy stack `parket-wavoip`

## Onde uso IA

Nao usa IA diretamente. E o interface humana do gestor comercial.
