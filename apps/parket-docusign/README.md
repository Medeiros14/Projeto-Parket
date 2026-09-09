# parket-docusign

> Backend de assinatura eletronica DocuSign + pagamento (Pix +
> Boleto Itau sandbox e prod). Serve o parket-contratos e
> parket-nfe.

## O que faz

Servico dedicado que orquestra:

- **DocuSign envelope** — cria envelope com PDF + slide pagamento,
  encaminha assinatura, grava webhook.
- **Pix Recebimentos Itau** — cria cobranca instantanea, poll de
  status.
- **Boleto Itau v3** — emite boleto, gera PDF, associa a parcela.
- **Webhook Itau** — recebe baixa e grava compensacao durable no
  Cloud (via parket-core.perna 6 e perna 7 do watcher).
- **Termo pagamento** — endpoint `/pix` e `/boleto` que o termo-v2.html
  chama pos-aceite do cliente.

## Como se interliga com o ecossistema

- **Le de:** `parket-contratos` (contrato assinado gera envelope),
  `parket-space2` (sim fechada), `parket-nfe` (NF gera boleto).
- **Escreve em:** `core.lancamentos` (parcelas, baixa), `parket-gestao`
  (projeto novo pos-assinatura), webhook Itau grava compensacao.
- **Depende de:** DocuSign API + chave RSA privada (bind mount fora
  do repo), Itau API (2 padroes: sandbox antigo + Boleto v3 prod).

## Stack

- FastAPI + Python
- Postgres schema `docusign.*` e `core.*`
- Deploy stack `parket-docusign`

## Onde uso IA

Nao usa.

## Como rodar localmente

```bash
cd apps/parket-docusign
cp .env.example .env  # ITAU_CLIENT_ID/SECRET, DOCUSIGN_INTEGRATION_KEY etc.
pip install -r requirements.txt
uvicorn app.main:app --reload
```

## O que aprendi

- **Itau tem 2 padroes de sandbox.** APIs antigas: `/sandboxapi/` +
  `x-sandbox-token`. Novas (Boleto com Pix): path 1:1 prod +
  `Authorization: Bearer`. Nunca assumir universal.
- **Webhook grava compensacao durable.** Serviro nao pode ficar
  esperando webhook em memoria; se cair, perde. Grava e watcher
  processa depois.
- **Chave RSA privada NUNCA no repo.** Vive em bind mount
  `/etc/parket/docusign-private.key` com chmod 600, montada no
  container so quando faz falta.
