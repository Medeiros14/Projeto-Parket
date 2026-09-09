# parket-center

> Central do Cliente. Cliente final ve sua obra: cronograma, itens contratados, definicoes tecnicas, docs, fotos, financeiro.

## O que faz

- **Cronograma+lista** com numeracao 1.1 igual PDF orcamento
- **Itens contratados** com aba Financeiro (parcelas, boleto, pix via docusign)
- **Definicoes tecnicas** por servico (Porsche-style responsivo mobile)
- **Documentos** agregado (docs-unificados: mapa + executivo + docs)
- **Fotos** selecionadas com ambiente + material
- **Mapa da obra** visivel pro cliente
- **URL por center_token** — cliente abre sem login pelo link

## Como se interliga com o ecossistema

- **Le de:** `gestao.itens` (deriva sempre, nunca hardcodar CRONOGRAMA_OVERRIDE), `center.docs_fiscais`, propostas Valoria, `compras` (financeiro)
- **Escreve em:** center.definicoes, feedback do cliente
- **E usado por:** cliente final via link publico com token

## Stack

React + Vite + Tailwind (mobile-first), FastAPI backend, PG local schemas `center.*` e `gestao.*`, deploy stack `parket-center`

## Onde uso IA

Nao usa IA diretamente. Definicoes tecnicas puxam de catalogo automatico.

## Notas

- Layout tec do Catalogo-parket com paginas sequenciais por item
- Financeiro = ABA do card 01 CONTRATO, nao card separado
- Editor de contrato admin (`/admin/contrato`) gera clausulas versionadas
