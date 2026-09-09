# parket-auth-guard

> OTP WhatsApp de aprovacao. Codigo de 6 digitos pra aprovacoes financeiras sensiveis.

## O que faz

- Gera codigo OTP
- Envia via WhatsApp (WAHA)
- Valida no backend do app que pede aprovacao
- **NUNCA** expor codigo no chat interno (regra rigida — quebra seguranca)

## Como se interliga com o ecossistema

- **Le de:** app que pede aprovacao (compras acima de X, aditivos)
- **Escreve em:** log de aprovacoes
- **E usado por:** `parket-core`, `compras-app`, `parket-contratos` (prestador OTP)

## Stack

Node/Express, WhatsApp via WAHA, Docker Swarm stack `parket-auth-guard`

## Onde uso IA

Nao aplica.
