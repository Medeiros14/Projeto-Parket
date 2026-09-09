# Homebroker Parket — Setor Comercial

## O que é

Plataforma do setor Comercial Parket. Hospedada em **homebroker.parket.works**.
Stack frontend Vite + React + TypeScript. Repo: `/root/parket-homebroker/frontend/`.
Service Swarm: `parket-homebroker_web` (image `parket-homebroker:latest`).

## Páginas (frontend/src/components/pages/)

| Página | Função |
|---|---|
| `Funil.tsx` | Kanban com colunas do funil de Entrada Comercial |
| `Book.tsx` | Book de oportunidades qualificadas |
| `CardDetail.tsx` | Painel/modal de detalhe do card — lê `kanban_cards.details` JSONB |
| `Atendimento.tsx` | Interface de chat WhatsApp (integra Teca V2) |
| `Pregao.tsx` | Pregão (venda colaborativa entre vendedores) |
| `Orcamento.tsx` + `OrcamentoAprovacao.tsx` | Fluxo de aprovação de proposta antes do link público |
| `Performance.tsx` | KPIs por SDR/Closer (lead → qualificado → ganho) |
| `Analise.tsx` | Análise de pipeline / forecasting |
| `Auditoria.tsx` | Auditoria de ligações (integra Wavoip) |
| `Scripts.tsx` | Scripts de venda canned |
| `Agendamentos.tsx` | Calendário de follow-up |
| `TecaMonitor.tsx` | Monitor da Teca V2 (status, fila, conversas ativas) |

## Tabelas chave (Supabase Cloud — `hbxpilrxmitvzebluoom`, api.parket.works/rest/v1)

### `public.kanban_cards`
Tabela única que serve **tanto** o board do Dashboard Parket (Space) quanto o
Funil do Homebroker. 28 colunas:

```
id, dept_id, column_id, title, subtitle, obra, responsavel, sla, sla_status,
tags[], progress, value, checklist_done, checklist_total, gate, priority,
parent_card_id, created_by, created_at, updated_at, description, details,
gates_data, checklist_items, handoffs_data, financeiro_data, raci_data,
chat_messages, status_mapa_id
```

`details` (JSONB) é o "campo livre" por dept_id. Para `dept_id=comercial` /
`projetos`, contém os campos da aba **Projeto** do CardDetail:

```json
{
  "produto_interesse": "painéis, pisos",
  "relacao_obra": "Proprietário | Arquiteto | Engenheiro | Construtora",
  "cidade": "Rio de Janeiro, RJ",
  "metragem_estimada": "piso 10m x 6m, painel 4m x 3m",
  "faixa_investimento": "R$ 50k–100k",
  "previsao_instalacao": "Janeiro",
  "escritorio_empresa": "...",
  "preferencia_madeira": "Tom natural, Tom mel",
  "arquitetura": "Studio Débora Aguiar",
  "endereco_obra": "...",
  "valor_orcamento": "...",
  "teka_ativa": true,
  "selected_at": "ISO timestamp",
  "outro_email": "..."
}
```

O botão ✏️ editar grava de volta:
```js
supabase.from('kanban_cards').update({ details: {...} }).eq('id', cardId)
```

### Funil de Entrada Comercial (column_id)
```
comercial-entrada → contato-inicial → em-qualificacao → qualificado → ganho
                                                                    └→ (branches)
                                                                       nao-qualificado
                                                                       perda
```

### `public.whatsapp_messages`
Histórico WhatsApp por card_id. Source-of-truth do chat.

### `public.handoffs`
Transferências entre squads (Comercial → Projetos, etc.).

### `public.notificacoes`
Push por user_id. Realtime via `postgres_changes` filter `user_id=eq.X`.

### `public.claude_atividades`
Log oficial de toda mudança relevante (audit trail). Campos: `titulo`, `descricao`,
`setor`, `categoria` (fix|feature|config|rollback|data|investigacao), `criado_por`.

## Integrações

### Teca V2 (chatbot WhatsApp)
- ATIVA globalmente desde 01/06/2026 (`TECA_V2_FORCE_ALL=1`)
- Guard: só atende card com `teka_ativa=true` no details
- V1 PAUSADA — não reativar
- KB em `public.teca_v2_kb`
- Roda no service `parket-rh-api` (compartilhado)

### Evolution API (WhatsApp envio)
- URL: `https://conect.parket.works`
- Instâncias: **Parket** / **Comercial** / **Secretaria** (segregadas por finalidade)
- API key em env `EVOLUTION_API_KEY`
- Status OK: 200/201
- **Regra OURO de teste em prod**: SEMPRE número do Will `5511939213329`,
  NUNCA lead real (risco de banimento + UX horrível).

### Wavoip (telefonia VoIP)
- Service: `parket-wavoip_api` (image `parket-wavoip-backend:multisim`)
- Source: `/root/parket-wavoip/backend/app/main.py` (FastAPI)
- Integração: botão **Ligar** no chat do Homebroker + lista em `/auditoria`
- Multisim: cada SDR tem chip/instância próprio — NÃO cruzar

### Bridge Valoria → Parket
- RPC `create_proposta_from_valoria` insere em `simulacao_projetos` + `simulacao_itens`
- Link gerado: `proposta.parket.works/proposta/<uuid>`
- Renderer = V12FIX existente — **NUNCA recriar**
- Evolução de UX/cálculo/fluxo mora na Valoria, não no Space

### Site form tracking
- Form em `site.parket.works/_legacy/?embed=1` (iframe + modal)
- Submit insere em `kanban_cards` (dept_id=comercial, column_id=comercial-entrada)
- Lead disparado no **Pixel Meta** do pai via `postMessage`
- Qualificação no Kanban Comercial dispara um SEGUNDO Lead (mais valioso pro ads)
- UTM persistido no `details` do card

## Persistência: Cloud vs Local

| Tabela | Source de leitura | Source de escrita |
|---|---|---|
| `kanban_cards` | Cloud (api.parket.works) | Cloud direto |
| `whatsapp_messages` | Cloud | Cloud |
| `simulacao_projetos` / `itens` | **Local** (parket-pg-local) | **Local** |
| `claude_atividades` | Cloud | Cloud |

Atenção: proposta lê do **Local** via `api.parket.works` (gateway aponta pro
postgrest local). Cloud é só backup leitor pra essa.

## Regras invioláveis

1. **Dashboard golden = produção.** Hotpatch flow obrigatório (`patches/` →
   `docker build` → `/root/deploy-dashboard.sh`). NUNCA `docker build -t parket-dashboard:latest`.
2. **Teste WhatsApp em prod** SEMPRE com número do Will (`5511939213329`).
3. **Teca V1 está PAUSADA** — V2 é a ativa.
4. **Evolução da Valoria** mora na Valoria, NÃO no Space.
5. **Toda mudança relevante** → `log_atividade.entrypoint(...)` em `claude_atividades`.
6. **Pra mudar layout/critério/texto importante** no funil: PERGUNTE o
   comercial_advisor antes (representa Will/Douglas).
7. **Pós-deploy**: smoke test + md5 check (memória ZERO REGRESSÃO).

## Stakeholders

- **Will** (dono) — decisões finais de negócio + UX
- **Douglas** (CEO) — visão estratégica
- **Natália** (Produtividade) — libera pagamento de prestador (NÃO Fiscal)
- **Thayna Rodrigues** / **Thayná Cristina** — orçamentistas (confirmar atribuição com Will)

## Anti-patterns conhecidos

- 'Envio em massa' WhatsApp pra base inativa → banimento de instância
- Template HSM novo sem aprovação Meta → não envia, gera fila
- Mesma instância pra suporte E vendas → derruba ambos quando bana
- Mover card automaticamente sem avisar SDR → SDR perde contexto
- Campo obrigatório no form que SDR não consegue preencher na 1a call → lixo no banco
