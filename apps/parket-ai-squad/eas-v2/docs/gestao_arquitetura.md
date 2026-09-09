# Arquitetura — gestao.parket.works (Gestão de Projetos Parket)

Documento de referência para o Time Dev Gestão (agentes gestao_pm, gestao_arquiteto, gestao_qa).
Fonte: levantamento do código em /root/parket-gestao (10/07/2026).

## Visão geral

ERP de projetos de instalação de pisos de madeira. Espelha propostas do Space
(simulacao_projetos) num schema Postgres isolado `gestao` quando o contrato é assinado
(DocuSign), e acompanha a obra em 9 etapas + itens granulares, com kanban de 13 colunas,
módulos Fiscal e Obras, e central de Relacionamento (WhatsApp + copiloto IA).

- URL: https://gestao.parket.works (Traefik, TLS Let's Encrypt)
- Stack Swarm: `parket-gestao` — serviços `parket-gestao_api` (FastAPI, :8000) e `parket-gestao_web` (nginx, :80, proxy /api/ → api:8000)
- Fonte: /root/parket-gestao — backend/ (Python 3.12 + FastAPI 0.115 + psycopg 3), frontend/ (React 18.3 + TypeScript strict + Vite 6), sql/ (migrations), deploy/stack.yml, deploy-gestao.sh
- Banco: Postgres local do Swarm (host `postgres`, db `postgres`), schema `gestao`
- Redes: network_public (Traefik) + parket-api_internal (compartilhada)
- Secrets Swarm: parket_pg_local_password, supabase_service_key_hbx, teca_anthropic_oauth
- Deploy: `deploy-gestao.sh` — aplica SQL, builda as 2 imagens, stack deploy, health check /api/health (60s)

## Backend (backend/app/main.py — ~1.8k linhas, 47 endpoints)

- FastAPI + Uvicorn (1 worker), CORS restrito a gestao.parket.works + localhost:5173
- db.py: context manager `conn()` psycopg autocommit; envs GESTAO_PG_HOST/PORT/DB/USER/PASSWORD_FILE
- Sem autenticação própria — confia no proxy; header `x_user_email` só auditado nos eventos

### Endpoints principais

- GET /api/health — check DB
- GET /api/colunas — 13 colunas kanban
- Projetos: GET /api/projetos (filtros status/q/column_id), GET /api/projetos/{pid} (com 9 etapas), POST /api/projetos/{pid}/mover (RPC mover_projeto), PATCH /api/projetos/{pid}
- Itens: GET /api/projetos/{pid}/itens, PATCH /api/itens/{iid} (status/responsavel/datas)
- Etapas: PATCH /api/projetos/{pid}/etapas/{numero}
- Eventos: GET /api/projetos/{pid}/eventos (timeline, limit 100)
- Sync Space: POST /api/sync/from-proposta (chama RPC projetar_de_proposta), GET /api/fonte/propostas (lê Space via Supabase)
- Fiscal: CRUD /api/fiscal/equipe, agenda semanal /api/fiscal/agenda (tipos 1ªvistoria/2ªvistoria/acompanhamento/entrega/reparo), laudos /api/fiscal/laudos (+{lid} com checklists JSONB e fotos), vínculo fiscal↔projeto /api/fiscal/equipe/{fid}/projetos, GET /api/projetos/{pid}/vistorias|laudos|fotos
- Obras: CRUD /api/obras/equipes (prestadores: nome/telefone/categoria), CRUD /api/obras/cronograma (tipos obras|marcenaria|reparos), vínculo /api/projetos/{pid}/prestadores, GET /api/projetos/{pid}/cronograma
- Relacionamento: GET /api/projetos/{pid}/relacionamento (conversa+msgs), POST .../relacionamento/send (Evolution), POST .../relacionamento/vincular (grupo WhatsApp), GET /api/relacionamento/grupos, GET .../relacionamento/copiloto (Teca Copiloto — 3 sugestões IA)

### Integrações externas

1. **Supabase Cloud hbxpilrxmitvzebluoom** — lê whatsapp_messages e escreve gestao_projetos (compartilhado com PWA fiscal verifica.parket.works). httpx + SUPABASE_SERVICE_KEY (main.py ~324-351).
2. **Evolution API (WhatsApp)** — envio de mensagens no Relacionamento (main.py ~1407-1467); recebimento via webhook Evolution → Supabase whatsapp_messages (sem retry/DLQ).
3. **Anthropic Claude OAuth** — Teca Copiloto (main.py ~1468-1690): token sk-ant-oat-* no secret teca_anthropic_oauth (expira ~1h, sem refresh no código — ponto frágil), modelo claude-sonnet-4-5, retorna JSON com 3 sugestões (positiva/neutra/negativa) baseadas em projeto+itens+últimas 15 msgs.
4. **Space (read-only)** — public.simulacao_projetos, simulacao_itens, kanban_cards, contratos_docusign.

## Banco — schema gestao (sql/001..004)

Tabelas:
- **projetos** — id, simulacao_id UNIQUE, card_id, contrato_id, numero_proposta, cliente, cnpj_cpf, endereco, obra_code, vendedor, arquiteto, orcamentista, gestor_email, valor_total, status (novo|em_execucao|pausado|entregue|cancelado), etapa_atual (1..9), assinado_em/iniciado_em/entregue_em, meta jsonb, column_id, ordem_coluna. Trigger _touch() em updated_at.
- **itens** — projeto_id FK, simulacao_item_id, ordem, categoria, descritivo, ambiente, quantidade, unidade, valor_unit/total, status (pendente|preparando|em_execucao|instalado|entregue|com_ressalva|cancelado), responsavel, previsao_inicio/fim, meta jsonb (codigo "N.M", raiz, produto_header, metragem_real, metragem_com_perda, valor_product/insumos/instalacao). **Item = item da proposta, NÃO m².**
- **etapas_catalogo** — 9 etapas globais: 1 Checklist, 2 1ªVistoria, 3 2ªVistoria, 4 Mapeamento, 5 Cronograma, 6 Executivo, 7 Acompanhamento, 8 Termo, 9 Avaliação.
- **projeto_etapas** — 1 linha por projeto×etapa (status pendente|em_andamento|concluida|com_ressalva|na).
- **item_etapa_status** — tracking granular item×etapa (9×n_itens).
- **eventos** — timeline (tipo criado|status_change|foto|observacao|pendencia|conclusao, payload jsonb).
- **documentos** — PDFs por etapa (slug checklist|1-vistoria|2-vistoria|mapeamento|cronograma|projeto|termo).
- **fotos** — registro fotográfico por projeto/item/etapa.
- **colunas_kanban** — 13 colunas: entrada(0), projeto, pendente, primeira-vistoria, pre-cronograma, segunda-vistoria, entrega-material, obras-liberadas, cronograma-final, acompanhamento, travado, reparos, reparos-concluidos, obras-finalizadas.
- View **v_projeto_progresso** — n_entregues/n_total/pct_completo por projeto.

RPCs (PL/pgSQL):
- **gestao.projetar_de_proposta(simulacao_id, contrato_id, gestor_email) → uuid** — idempotente; cria projeto a partir de simulacao_projetos; v2 (sql/004) cria itens hierárquicos agrupados por categoria encoded (PISO||especie||dim) + ambiente, numeração "N.M" em meta.codigo, extrai metragem_real/com_perda via regex do descritivo; cria 9 projeto_etapas + item_etapa_status; evento "Projeto criado a partir da proposta". Chamada pelo trigger **_on_contrato_assinado** em public.contratos_docusign (status assinado/completed/signed/finalizado) e pelo POST /api/sync/from-proposta.
- **gestao.mover_projeto(projeto_id, column_id, autor)** — move no kanban + evento "Coluna: X → Y".

## Frontend (frontend/src/)

- App.tsx: layout + sidebar colapsível (localStorage); theme.tsx: tokens dark/light, Cinzel+Inter
- api.ts (~526 linhas): fetch wrapper tipado, tipos Projeto/Item/Etapa/Evento/Fiscal/Agenda/Laudo/EquipeParket/CronogramaRow/WhatsappMessage/CopilotoResp
- Rotas: `/` Projetos (kanban drag-drop + importar propostas), `/projetos/:id` Projeto (5 abas: detalhes/mapa/laudos/obra/relacionamento — ~2k linhas), `/fiscal/*` (equipes+agenda+laudos, ~1.3k linhas), `/obras/*` (equipes+cronograma, ~1.6k linhas), `/relacionamento` (central CS)
- RelacionamentoTab: poll 3s da conversa, composer (Enter envia), TecaCopilotoPanel (3 cards com botão "usar" que cola na textarea — atendente sempre revisa antes de enviar), VincularGrupoPanel, MsgBubble com mídia

## Ciclo de vida

Proposta (Space) → contrato assinado (DocuSign) → trigger → projetar_de_proposta → projeto novo na coluna "entrada" com 9 etapas pendentes → gestor move no kanban e avança etapas → itens progridem pendente→preparando→em_execucao→instalado→entregue (instalado = feito; entregue = cliente aceitou) → etapa 8 Termo + etapa 9 Avaliação → obras-finalizadas (com desvio por reparos). CS acompanha via Relacionamento/WhatsApp durante toda a obra. Portal cliente = fase 2, não implementado.

## Pontos frágeis conhecidos

1. Acoplamento forte com schema public do Space (trigger + RPC leem contratos_docusign/simulacao_*) — mudança no Space quebra o gestao.
2. Dependência do Supabase Cloud sem fallback local (whatsapp_messages, gestao_projetos do PWA fiscal).
3. Webhook Evolution sem retry — mensagem perdida fica fora de sync.
4. Token OAuth do copiloto (teca_anthropic_oauth) expira ~1h sem refresh automático — copiloto falha até redeploy do secret.
5. Polling 3s no Relacionamento (sem WebSocket/SSE).
6. Sem paginação real (limits fixos 200-300).
7. Memory limits apertados: api 512M, web 128M.
8. Existe backup main.py.pre-cloud.bak no backend (não é código ativo).
