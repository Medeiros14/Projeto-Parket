# Gestão & Obras — gestao.parket.works + setor Obras/Operacional

## Superfícies

| Superfície | URL | Stack/Fonte | Deploy |
|---|---|---|---|
| Gestor de Projetos | gestao.parket.works | /root/parket-gestao/ (FastAPI + Vite/React) | /root/parket-gestao/deploy-gestao.sh |
| Setor Obras | space.parket.works/obras | Dashboard golden (hotpatch) | /root/deploy-dashboard.sh |
| Operacional (agregador) | space.parket.works/operacional | dept-operacional.tsx (iframes Obras+Fiscal+PMO+Atendimento) | hotpatch |
| PMO/Produtividade | space.parket.works/produtividade | Dashboard golden | hotpatch |
| Status (mapa+cronograma) | draw.parket.works/status | vínculo via simulacao_itens.id | — |

## Schema `gestao` (parket-pg-local)

- `gestao.projetos` — 1 linha por proposta assinada (FK simulacao_id)
- `gestao.itens` — cópia de simulacao_itens + execução (ambiente, status, responsavel, previsão, obs)
- `gestao.etapas_catalogo` — 9 etapas: checklist → 1ª/2ª vistoria → mapeamento → cronograma → executivo → execução → termo → avaliação
- `gestao.projeto_etapas` — status de etapa por projeto
- `gestao.item_etapa_status` — matriz item×etapa
- `gestao.eventos` (timeline), `gestao.documentos`, `gestao.fotos`
- `gestao.v_projeto_progresso` — view (pct_completo, n_entregues, n_total)
- RPC `gestao.projetar_de_proposta(simulacao_id, contrato_id, gestor_email)` — idempotente, não reabre itens já criados
- Trigger `trg_gestao_contrato_signed` em public.contratos_docusign (status assinado → RPC via card_id)

## Endpoints parket-gestao

- `GET /api/projetos` (filtros q/status) | `GET /api/projetos/{id}` (projeto + 9 etapas)
- `GET /api/projetos/{id}/itens?ambiente=&status=`
- `PATCH /api/itens/{id}` | `PATCH /api/projetos/{id}/etapas/{numero}` (timeline auto)
- `GET /api/fonte/propostas` | `POST /api/sync/from-proposta`

## Pessoas e gates

- Germano — Obras | Felipe — Fiscal (vistoria, NÃO pagamento) | Douglas — PMO/CEO
- Natália — Produtividade: **único gate que libera pagamento de prestador**
- Will — dono, autoriza produção

## Regras invioláveis

1. **Item = item da proposta.** Nunca agregar por m².
2. **Previsão de entrega é manual** (previsao_entrega_manual). Auto-Calcular desabilitado de propósito — não reverter.
3. **Pagamento**: fluxo instalador → Fiscal vistoria → Produtividade valida → pagamento. Fiscal não libera.
4. Dashboard golden = produção; hotpatch flow obrigatório (patches/ + FROM parket-dashboard:golden).
5. DDL no schema gestao: idempotente, em /root/parket-gestao/sql/, aplicado via deploy-gestao.sh.
6. Após DDL no parket-pg-local: restart parket-pg-rest_rest-local (NOTIFY pgrst não basta).
7. Mudanças em simulacao_* não retropropagam pro gestao — re-sync via RPC (idempotente).
8. /operacional não é setor singular — agrega 4 setores via iframes com ?tab=... (manter query-params).
