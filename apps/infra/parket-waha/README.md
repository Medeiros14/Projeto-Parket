# parket-waha

> Gateway WhatsApp official API via WAHA (WhatsApp HTTP API). Serve como fonte de eventos pro homebroker (lead novo, mensagem).

## O que faz

- WAHA instance rodando
- Webhook pra parket-homebroker (novo lead cai em Novas Oportunidades)
- Rodando em instancia dedicada da Evolution API pra atendimento comercial
- Repointar numero move grupos + conversas juntos (FK composta em 2 bancos)

## Como se interliga com o ecossistema

- **Le de:** WhatsApp (API official via WAHA)
- **Escreve em:** `parket-homebroker` (lead novo), `parket-chat` (notif Atendimento)
- **E usado por:** SDR, Sucesso do Cliente

## Stack

WAHA container Docker (upstream), Docker Swarm stack `parket-waha`

## Onde uso IA

Nao aplica. WAHA e proxy transparente.
