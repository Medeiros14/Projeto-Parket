# parket-core

> Financeiro da Parket: comissoes, RT, impostos, aprovacoes cross-plataforma,
> contas a pagar/receber, com UX inspirada no Nubank.

## O que faz

O **coracao financeiro da operacao**:

- **/aprovacoes** — fila unificada de aprovacoes (Contas a Receber,
  Prestadores, Compras, Terceiros). Fluxo cross-plataforma: quem pede
  fica no app de origem, quem aprova ve tudo aqui.
- **/pagamentos** — Atrasados / Hoje / Futuros, aba Terceiros pra
  pagar com comprovante, integracao boleto NF via Compras.
- **/recebimentos** — parcelas contrato, boleto/Pix, dar baixa, alterar
  vencimento, reenviar boleto.
- **/comissoes** — regras por vendedor (faixas por volume × RT), gate
  50% (sem retroativo), 28% guia unica de impostos.
- **/contratos** — contratos fechados, custos por obra, subida de compras/NF/frete.
- **/obras** — visao 360 do custo por obra (compras + NF + prestadores + comissao).

Foi um dos apps mais dificeis de construir porque envolve **regras de
negocio muito especificas da Parket** (comissao com gate, retencao
tecnica de 10% no liquido, impostos consolidados) e **integra 6+ outros
apps** via write-back (nao duplica workflow — le cross-schema e
escreve de volta na origem).

## Como se interliga com o ecossistema

- **Le de:** `parket-contratos` (contratos assinados → parcelas),
  `compras-app` (compras aprovadas → aparecem na obra),
  `parket-nfe` (NF-e → contas a pagar),
  `parket-gestao` (obras, prestadores, custos terceiros).
- **Escreve em:** `parket-chat` (notif de aprovacao pendente),
  tabelas de origem (aprovacao dispara update no schema origem, nao aqui).
- **Depende de:** `parket-pg-local` schema `core.*`, Docusign webhook
  → perna 6 do watcher.
- **E usado por:** financeiro (contas), CEO (aprovacoes), vendedores
  (comissoes acumuladas).

## Stack

- **Frontend:** React + Vite + Tailwind, identidade visual padrao Parket
  (SO Parket) — mesmo look-and-feel do gestao
- **Backend:** compartilha o backend do parket-gestao (namespace `/core`)
- **Banco:** Postgres local schema `core.*` (lancamentos, aprovacoes_notif_log,
  comissoes, regras, retencoes, impostos)
- **Deploy:** Docker Swarm stack `parket-core`
- **Bibliotecas:** react-hook-form, decimal.js (calculos financeiros
  sem erro de float), tanstack table

## Onde uso IA

Nao usa IA diretamente. Regras de negocio sao deterministicas
(comissao com gate, RT 10%, 28% impostos) — nao ha valor em jogar
Claude aqui.

## Como rodar localmente

```bash
cd apps/parket-core
cp .env.example .env
npm install
npm run dev  # frontend
# backend roda dentro do parket-gestao/backend, namespace /api/core
```

## O que aprendi construindo isso

- **Espelho + write-back, nao duplicacao.** Core nao replica o workflow
  de outros apps: le cross-schema e aprovacao escreve de volta na tabela
  origem. Isso mantem 1 fonte de verdade por dominio.
- **`sql STABLE + SECURITY DEFINER` sao inlineadas pelo Postgres.**
  `current_user` vaza do caller. Usar VOLATILE ou PL/pgSQL em checks
  de role. Aprendi debugando permissao "invisivel".
- **`psql -tAc` imprime command tag no stdout.** `INSERT 0 0` conta como
  linha mesmo com 0 rows afetados. Contar `stdout | wc -l` cru = falso
  positivo. Sempre filtrar por padrao.
- **Chat notif de aprovacoes:** poll 60s + bot user + dedup em
  `core.aprovacoes_notif_log`. Sem pg_net (que exige extension nao
  disponivel no Cloud). Escala trocando o callback.
