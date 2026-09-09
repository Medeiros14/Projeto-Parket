# parket-homebroker

> CRM comercial da Parket. Kanban de vendas do funil inteiro, das novas
> oportunidades ate o contrato assinado. Fonte unica de criacao de
> cards no ecossistema.

## O que faz

- **Kanban de vendas** por setor (SDR, Comercial, Sucesso do Cliente)
  com etapas: Novas Oportunidades → Qualificado → Handoff → Analise
  do Gestor → Handoff-Com → Ganho.
- **CardDetail** com edicao de vendedor + orcamentista (admin), aba
  Amostras, aba Sucesso do Cliente, chip PDF proposta Valoria embutido.
- **Solicitar Orcamento** com metragem por produto — dispara demanda
  em `ops.cards_solicitacao` que o Valoria consome.
- **Handoff-com** ja mostra a proposta gerada (sem esperar aceite formal).
- **HB Drive** — pasta Google Drive por cliente, upload de anexo do
  vendedor vai direto pro Drive (nao pro Supabase), orcamento (PDF) sobe
  automaticamente. Card ganho move pasta de "Home Broker" pra "Projetos".
  Cron limpa perdidos >90d pra "_Arquivo" (nunca trash).
- **Analise de Custo** (frontend HB): painel na OrcamentoAprovacao.
- **Marketing HB**: sync Meta Ads insights, CAC por etapa, dashboard
  vendedor.
- **Social Selling** — 3 abas kanban dos pipelines de arquitetos.
- **Contatos e Relacionamento** no estilo atendimento (contadores +
  filtro grupos/clientes).
- **HB Raport** — dashboard vendedor com CAC por etapa.

Regra dura: **card novo nasce SO no homebroker.** Todos os outros
apps consomem via sync, mas nenhum cria card por conta propria
(evita orfaos).

## Como se interliga com o ecossistema

- **Le de:** WhatsApp (novos leads via WAHA), Meta Ads (marketing_ads_insights),
  planilha Google (arquitetos).
- **Escreve em:** `ops.cards_solicitacao` (demanda pro Valoria),
  `kanban_cards` (fonte de verdade de card), Meta CAPI (Qualificado →
  Purchase), Google Ads (Click Conversion), Google Drive (pasta cliente).
- **Depende de:** `parket-pg-local`, api.parket.works, WAHA, Meta APIs,
  Google Drive Apps Script v2.2.
- **E usado por:** vendedores, SDR, gestores comerciais.

## Stack

- **Frontend:** React + Vite + Tailwind
- **Backend:** FastAPI Python
- **Banco:** Postgres local schemas `ops.*` e `kanban.*`
- **Deploy:** stack `parket-homebroker`, hb.parket.works
- **Bibliotecas:** anthropic (analise de leads), google-api-python-client,
  requests (Meta APIs)

## Onde uso IA (Claude)

- **Analise IA da qualidade dos leads** (chegando + agendando):
  Claude classifica prioridade e sugere proxima acao.
- **Teca Blacklist:** LLM confundia assinatura da equipe com nome do
  cliente (319 cards viraram "Parket" em 28/08). Blacklist + placeholder
  guard resolveram.

## Como rodar localmente

```bash
cd apps/parket-homebroker
cp backend/.env.example backend/.env
cd backend && pip install -r requirements.txt && uvicorn app.main:app --reload
cd ../frontend && npm install && npm run dev
```

## O que aprendi construindo isso

- **Atribuicao Meta rejeita event_time > 7d.** Backfill retroativo (40
  leads qualificados 111→152 em 29/08) tem gate rigido. Pixel e sempre
  producao — mesmo em teste local.
- **Contratos fake RANIERE-BULK-*:** envelope forcava card comercial
  pra ganho a cada 3min. So Casa Miragem era erro — os outros 8 sao
  fechamentos reais.
- **HB Drive: sessao resumable > direct upload.** Anexo >35MB
  quebrava direct upload; fluxo com sessao resumable resolveu (sem
  limite, sem Supabase intermediario).
