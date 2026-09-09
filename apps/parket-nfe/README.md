# parket-nfe

> App fiscal (`fiscal.parket.works`) pro responsavel fiscal subir XML NF-e da
> Parket. NAO confundir com `parket-fiscal` (fiscal de obra em
> verifica.parket.works).

## O que faz

Interface simples pra sobra fiscal manual do ERP:

- **Etapa 1** — responsavel fiscal sobe XML NFe
- **Etapa 2** — parser XML valida chave, extrai dados, vincula obra
- **Etapa 3** — aba NFe aparece na obra do parket-core (contas a
  pagar/comissao) 
- **Etapa 4** — NFe visivel na Central do Cliente (parket-center)

## Como se interliga com o ecossistema

- **Le de:** XML enviado pelo responsavel fiscal, obras do `parket-core`
- **Escreve em:** `nfe.notas`, `core.lancamentos` (contas a pagar
  categoria NF-), `center.docs_fiscais`
- **Depende de:** api.parket.works, parser XML nfe brasileiro
- **E usado por:** responsavel fiscal

## Stack

- FastAPI (Python), lxml, xmltodict
- React + Vite frontend
- Postgres schema `nfe.*`
- Deploy stack `parket-nfe`, dominio `fiscal.parket.works`

## Onde uso IA

Nao usa. Parser XML e deterministico.

## Como rodar localmente

```bash
cd apps/parket-nfe
cp .env.example .env
pip install -r requirements.txt && uvicorn app.main:app --reload
```
