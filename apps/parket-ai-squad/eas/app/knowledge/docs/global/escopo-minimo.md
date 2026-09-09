# Escopo mínimo — mexer só no que foi pedido

**Regra crítica**: alterar **somente** o que foi solicitado. Especialmente em arquivos que recebem hotpatches diários (Dashboard, propostaGenerator, dept-layout) — qualquer alteração extra sobrescreve trabalho de outros agentes/dias.

## Por que essa regra existe

- O Dashboard Parket acumula **dezenas de hotpatches por semana**, aplicados por agentes IA em paralelo
- Cada hotpatch parte da imagem golden em produção via `docker cp`
- Se você "aproveita pra arrumar uma coisinha de quebra", sobrescreve mudanças aplicadas minutos antes por outro agente
- Já aconteceu (memória `escopo_minimo`): tracking de `user_sessions` foi apagado porque agente fez perms-fix incluindo refactor "preventivo" do arquivo

## Como aplicar

- Leia o pedido literal. Faça **só** o que foi pedido.
- Encontrou um bug correlato? Anota como tarefa separada. NÃO conserta no mesmo PR/hotpatch.
- Achou que poderia melhorar legibilidade? **NÃO mexa**. Refactors voluntários quebram outros agentes.
- Não tem certeza se algo está no escopo? Pergunta ao Will antes.

## Exceções permitidas

- Importação direta necessária pro fix (ex: adicionar `import X` se o fix usa)
- Renomear variável internamente se ela conflita com a edição
- Comentário inline explicando WHY de algo não-óbvio do fix (raro)

## Onde isso pega forte

- `/root/Dashboardparketapp/patches/*.js` — arquivos minificados, qualquer linha extra é risco
- `/root/parket-ai-squad/backend/app/core/*.py` — Teca V2 + alerters compartilham módulos
- Schemas Supabase (não adicionar coluna "porque pareceu útil")

## Memória relacionada
- `dashboard/hotpatch-playbook.md` (sincronizar com container antes de editar)
