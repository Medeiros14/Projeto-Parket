# parket-valoria-teca

> Backend FastAPI + Anthropic SDK que roda dentro do Valoria (Space2)
> como servico dedicado. Extraido do parket-teca pra ficar
> independente do agente conversacional generico.

## O que faz

Endpoints internos pro Valoria falar com Claude sem passar pelo Teca
generico:

- `POST /valoria/montar_orcamento` — recebe descricao livre + sim_id
  existente e retorna itens estruturados
- `POST /valoria/audit` — audit da proposta (detecta divergencia de
  matematica + alerta)
- `POST /valoria/descritivo` — geracao de descritivo de porta,
  revestimento, painel
- `POST /valoria/fechar_total` — fechar proposta no valor exato pedido

Mesmo modelo Anthropic (Claude Opus 4.7 default), mas prompts
especificos do dominio Valoria.

## Como se interliga com o ecossistema

- **Le de:** `orcamento_tabela_precos`, sim ativa do Valoria.
- **Escreve em:** `simulacao_itens`, `teca.audit`.
- **Depende de:** Anthropic API, PG local, `parket-teca` (compartilha
  algumas regras).
- **E usado por:** Valoria (parket-space2) via HTTP interno.

## Stack

- FastAPI + Python 3.11
- Anthropic SDK (claude-opus-4-7)
- Docker Swarm stack proprio

## Onde uso IA (Claude)

Igual `parket-teca` mas dedicado ao dominio Valoria. Prompts sao
especificos: por exemplo, `montar_orcamento` do Valoria sabe sobre
Versailles (aba fixa), Paginacao Exclusiva, Porta Exclusiva,
Adega (categoria propria com own catalog), regra ALL-IN da
marcenaria (sem perda, sem insumos, sem MO).

## Como rodar localmente

```bash
cd apps/parket-valoria-teca
cp .env.example .env
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8010
```
