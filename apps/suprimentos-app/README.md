# suprimentos-app

> Emprestimo/devolucao de ferramentas (`suprimentos.parket.works`). Termos em PDF, controle incremental.

## O que faz

- **Termos de emprestimo/devolucao** em PDF assinaveis
- **Devolucao gera novo Nº CONTROLE** incremental (referencia termo original)
- **Migracao dados Apps Script** feita
- **Tabelas suprimentos_*** no Supabase Cloud

## Como se interliga com o ecossistema

- **Le de:** funcionarios (`user_profiles`), ferramentas (`suprimentos.*`)
- **Escreve em:** `suprimentos.termos`, PDFs
- **E usado por:** almoxarifado, coordenadores

## Stack

React + Vite (clonando compras-app), FastAPI backend, PG Cloud schema `suprimentos.*`, deploy `suprimentos-app`

## Onde uso IA

Nao usa IA.
