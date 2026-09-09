# Debug WhatsApp — sempre usar número do Will

## Regra

Pra testar **qualquer envio WhatsApp em produção** (Evolution API, Teca V2, Homebroker, qualquer canal automatizado):

**Destinatário obrigatório**: Will → `5511939213329`

**NUNCA** usar número de lead/cliente real pra teste, mesmo que pareça inofensivo.

## Por que

- Cliente recebendo mensagem de teste destrói confiança e SLA do funil comercial
- Mensagem automatizada errada pode iniciar fluxo (Teca responde, Comercial puxa pro Kanban, etc)
- Log fica em `whatsapp_messages` permanente — não dá pra "fingir que não enviou"

## Onde aplicar

| Cenário | Destinatário em teste |
|---|---|
| `evolution.send` em desenvolvimento | `5511939213329` |
| Teca V2 reply em staging | `5511939213329` |
| Webhook recebendo evento simulado | mock JSON, não disparar real |
| Cron de notificação rodando manualmente | `5511939213329` |
| Disparo em massa em teste | `5511939213329` |

## Em produção

Quando o cron real roda em horário real (não disparado por dev), aí sim segue a lista oficial (`TI_OWNER_PHONES`, `PMO_WHATSAPP_GROUP_ID`, etc).

## Tools EAS

- `eas_tools/whatsapp_evolution.py:send` deve verificar `EAS_ENV`:
  - `dev` → força destinatário pra `EAS_WILL_PHONE` (override)
  - `prod` → respeita destinatário passado, mas requer confirmação pra mass-send
