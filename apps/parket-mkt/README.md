# parket-mkt

> Marketing: pipeline Meta Ads + Google Ads + CAPI + analise IA de qualidade de leads.

## O que faz

- **Sync Meta Ads insights** (gasto por campanha/dia)
- **CAPI Qualificado → Meta** com backfill retroativo (gate 7 dias)
- **CAPI Ganho → Purchase** com backfill 90d
- **Google Ads Click Conversion** (HTTPS pull)
- **CAPI CTWA** com backfill historico + metadata
- **Analise IA da qualidade dos leads** (chegando + agendando)
- **HB Raport** — dashboard vendedor + CAC por etapa

## Como se interliga com o ecossistema

- **Le de:** Meta Graph API, Google Ads API, WhatsApp CTWA referrals
- **Escreve em:** `marketing_ads_insights` no PG local, evento pixel Meta CAPI
- **Depende de:** `parket-homebroker` (funil), Anthropic (analise qualidade)

## Stack

Python (scripts + FastAPI), Postgres schema `mkt.*`, deploy stack `parket-mkt`

## Onde uso IA

Claude Sonnet 4.6 pra analisar contexto do WhatsApp e classificar prioridade do lead.

## Notas

CAC por campanha depende de ter campaign_id no card (#1655).
