# compras-app

> ERP de compras (`compras.parket.works`). Fornecedores, XML NF-e,
> estoque real, financeiro (contas a pagar), 2 depositos, relatorios.

## O que faz

- **Cadastros** — Clientes, Produtos, Transportadoras, Projetos
  (fonte obras via `core.obras`), 2 depositos Almoxarifado (Curitiba +
  outro), dedup automatico.
- **Solicitar Compras** — projeto vinculado obrigatorio; gastos
  acumulados do cliente dentro do card da solicitacao; historico
  de compras.
- **Import XML NF-e** — escolher tipo (MP / Ferragens) na hora do
  import; fix re-import apos exclusao (nota orfa bloqueava chave).
- **Estoque real** — saldo + entrada manual + saida + XML NF-e.
- **Financeiro (Contas a Pagar)** — aba Faturamentos com upload de
  boleto por parcela, envio Financeiro com PIX/banco condicional a
  forma de pagamento; boleto NF pelo compras direto.
- **Aba Compras Itens** — status individual + trigger gargalo,
  frete avulso como linha, agenda (comprar_em), orcamentos PDF
  por item.
- **Kanban Compras** — badge 3/5 + andamento misto no card + editor
  de itens + notifier chat (#financeiro aguardando, #compras pago).
- **Modulo Relatorios** — pedidos, entradas, saidas, por projeto.
- **PDF card Compras** — projeto + obra completos + categoria
  EMBALAGEM no Almoxarifado.
- **Categoria EMBALAGEM** no Almoxarifado.
- **Optimizacao mobile** — shell + paginas compactas.

## Como se interliga com o ecossistema

- **Le de:** `core.obras` (projetos), XML NF-e enviado, `producao-app`
  (solicitacao de MP faltante).
- **Escreve em:** `parket-core` (contas a pagar), `parket-chat`
  (notif fluxo compras), `parket-nfe` (NF fiscal), estoque
  Almoxarifado, `producao-app` (baixa quando entra estoque).
- **Depende de:** api.parket.works, parser XML NFe.
- **E usado por:** contador, responsavel de compras, financeiro.

## Stack

- React + Vite + Tailwind
- FastAPI + lxml (parser XML)
- Postgres schema `compras.*` (Cloud) + espelho local
- Deploy stack `compras-app`, compras.parket.works

## Onde uso IA

Nao diretamente.

## Como rodar localmente

```bash
cd apps/compras-app
cp .env.example .env
pip install -r backend/requirements.txt
uvicorn backend.app.main:app --reload
cd frontend && npm install && npm run dev
```

## O que aprendi

- **Solicitacao com projeto obrigatorio.** Sem projeto vinculado,
  compra vira orfa e o core nao consegue atribuir ao custo da obra.
- **Compras guarda pagamento por forma.** Envio Financeiro: PIX/banco
  so se forma != faturado (boleto depois); modal fornecedor nao
  bloqueia sem PIX/banco.
- **Frete avulso sempre visivel** — botao "Lancar frete" cria linha
  FRETE avulsa; frete sempre flui como linha em `compras_itens`.
