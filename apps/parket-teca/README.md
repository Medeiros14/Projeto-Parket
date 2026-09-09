# parket-teca

> Agente IA (Claude) que monta orcamento inteiro por linguagem natural.
> Backend em FastAPI + Anthropic SDK. Substituiu `valoria_assistant`
> mobile (EAS) por uma solucao mais controlavel.

## O que faz

Voce fala com a Teca em portugues normal:

> "Preciso de 150m² de piso chevron carvalho europeu naturalle, 40m²
> de deck cumaru pro varandao, 3 portas camarao MDF pra suite. Cliente
> Bruno Colodetti, obra em Campinas."

E ela monta o orcamento completo com:

- Itens estruturados por ambiente
- BOM de insumos por m² (regra Excel base 5m² pra portas, escala por
  m²/porta, laminas 2.8/m² ou 1.2 pra laca)
- Dedup de portas identicas (consolida em linha "N PORTAS")
- Descritivos comerciais em CAPS por categoria
- Validacao de matematica (3 linhas somam ao valor_total do item)
- Preco por m² com regra da Parket (perda, RT, comissao)
- **Sem inventar dado**: se falta cor ou espécie, ela pergunta.

Tem uma state machine (`state_machine.py`) que garante ordem correta
das acoes: `pedir_dados_faltantes` → `montar_orcamento` → `revisar` →
`fechar_total`. Sem regex fallbacks (removidos na Teca 2.0), so
LLM decidindo com prompt bem escrito.

## Como se interliga com o ecossistema

- **Le de:** `teca.aprendizados` (memoria de decisoes anteriores),
  `orcamento_tabela_precos` (catalogo mestre no PG local), sim do
  Valoria em andamento.
- **Escreve em:** simulacao do Valoria (nova sim ou continuacao),
  `teca.audit` (log de decisoes pra revisao humana), chat da obra
  (posta rascunho pro time revisar).
- **Depende de:** Anthropic API (Claude Opus 4.7 ou Sonnet 4.6),
  `parket-whisper` (audio → texto quando Teca e chamada por audio),
  catalogo Cloud (PG local espelhado).
- **E usado por:** orcamentistas, gestor comercial, Teca
  Reuniao (extracao de tarefas), Teca Copiloto no chat.

## Stack

- **Backend:** FastAPI + Anthropic SDK (`anthropic==0.34+`)
- **Modelo:** Claude Opus 4.7 (`claude-opus-4-7`) como default;
  Sonnet 4.6 pra bulk; Haiku 4.5 pra background.
- **Banco:** Postgres local schema `teca.*`
- **Deploy:** stack `parket-teca`

## Onde uso IA (Claude)

E o app inteiro. Padroes que evolui:

- **Prompt Cortex + Conversational** (Teca 2.0): 2 personas
  distintas — Cortex resolve tarefa, Conversational conversa com
  usuario. Ambas leem `teca.aprendizados`.
- **Regra ambiguidade catalogo**: se 2+ produtos batem a descricao
  do cliente, Teca pergunta (nunca chuta).
- **buildAgentContext**: lista subtipo/cor quando NAO estao embutidos
  na especie + tags `[dim oculta]` `[metragem oculta]`. Sem isso a
  Teca perdia item TOBLERONE Tauari.
- **fable-5 → opus-4-7** (17/07 e depois 24/07 no assistente mobile):
  ganho notavel em decisao complexa.
- **Bulk approve/discard** na tela IA Review — humano corrige em lote.
- **Funcao "desfazer"** na conversa: usuario pode reverter proximo
  passo com 1 clique.

## Como rodar localmente

```bash
cd apps/parket-teca
cp .env.example .env  # preencher ANTHROPIC_API_KEY
pip install -r requirements.txt
uvicorn app.main:app --reload
```

## O que aprendi construindo isso

- **Teca nao calcula valor, executor recalcula sempre.** LLM tem risco
  de erro de ponto flutuante em campo financeiro; toda soma passa
  por Python.
- **Cor RAW stale:** encodeCategoria reusava `meta.space_categoria_raw`
  sem checar cor atual → cor velha (Naturalle) reaparecia mesmo com
  cor="Mont Blanc" no banco. Fix: invalidar cache no update_item ao
  mudar subtipo/especie/cor/dim.
- **Perda=0 ponto final:** proposta emite "Metragem real Xm²." com
  ponto quando `p=0`. Sem isso a regex force-perda quebrava.
- **[CONTINUA] multi-turno**: lista grande por SERVICO precisa
  continuar em varios turnos — prompt explicito no fim se detectar
  truncamento.
- **Descritivo dos itens caia em silencio** (marcenaria/porta vazias):
  fix em `montar_orcamento` com validacao explicita.
