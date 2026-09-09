# parket-contratos

> App de contratos (`contrato.parket.works`) — assinatura eletronica
> via DocuSign + pagamento inicial (Pix ou Boleto Itau) no mesmo fluxo.

## O que faz

Fluxo end-to-end de contrato:

1. **Slide 4 da proposta publica** grava `contrato_cliente` no Valoria
   E no Cloud (via api.parket.works). Redirect Space fica off ate
   cliente preencher.
2. **Editor de contrato** admin (`/admin/contrato`) edita HTML
   versionado em `contrato_clausulas` (parket-pg-local).
3. **Envelope DocuSign** gerado com PDF do contrato + slide de
   pagamento (Pix ou Boleto Itau v3).
4. **Cliente assina** no navegador (DocuSign JS embed).
5. **Webhook DocuSign** → grava compensacao durable → dispara perna 6
   do watcher → cria projeto no `parket-gestao` + parcelas no
   `parket-core`.
6. **Termo pagamento** (backend parket-docusign) baixa parcela ou
   marca boleto pago via webhook Itau.

Regra: **Novo Contrato manual removido.** Entrada so via HB (fonte
unica de card).

## Como se interliga com o ecossistema

- **Le de:** `parket-space2` (sim fechada → contrato), `parket-homebroker`
  (card ganho vira contrato), `contrato_clausulas` (versionadas).
- **Escreve em:** `parket-gestao` (projeto novo via perna 6), 
  `parket-core` (parcelas, comissao, RT, impostos), `parket-docusign`
  (envelope), Itau (Pix/boleto).
- **Depende de:** DocuSign JS embed, Itau API (Pix Recebimentos +
  Boletos v3), api.parket.works.
- **E usado por:** cliente final (assina no navegador),
  equipe comercial (acompanha status).

## Stack

- React + Vite frontend
- Backend leve compartilha `parket-docusign`
- Postgres schemas `contratos.*` e `core.*`
- Deploy stack `parket-contratos`, contrato.parket.works

## Onde uso IA

Nao diretamente. Regras de contrato sao juridicas e deterministicas.
Copy que vende (marketing tone) e reescrita manualmente.

## Como rodar localmente

```bash
cd apps/parket-contratos
cp .env.example .env
npm install && npm run dev
```

## O que aprendi

- **Copy que vende, nao juridica.** Pagina de cliente = mentalidade
  marketing+copy; fato contratual reframado como beneficio, nunca
  tom de alerta.
- **Sem travessao "—" em pagina visivel** e sem jargao juridico na
  camada de leitura (decisao de 21/08).
- **Contrato geral prestador** — F1 schema Cloud + OTP WhatsApp, F2
  termos versionados, F3 onboarding no Instala, F4 ativacao por obra
  no Iniciar com OTP, F5 UI gestao.
- **Chave RSA privada docusign** MORA fora do repo (bind mount).
  Removida do staging antes de subir.
