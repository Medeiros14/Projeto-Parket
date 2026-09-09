# Swarm zumbi = CPU spike — troubleshoot

## Sintoma

CPU do servidor explode (>80% sustentado), aparentemente sem motivo. `top` mostra `dockerd` ou `containerd` consumindo. `docker service ls` pode mostrar serviço em loop crash.

## Causa raiz

Serviço Swarm com `replicas > 0` e **imagem inacessível** (deletada, registry off, tag inválida) trava o leader Swarm em loop infinito tentando criar a task. Cada tentativa gasta CPU + alloca network/storage + falha + reagenda.

## Diagnóstico

```bash
# 1. Listar services com tasks em estado de erro
docker service ls --filter "mode=replicated" --format '{{.Name}} {{.Replicas}}'

# 2. Olhar serviços com replicas pendentes (0/N)
docker service ls | awk '$4 ~ /\/[0-9]+/ && $4 !~ /^[1-9][0-9]*\/[1-9][0-9]*$/'

# 3. Detalhar o serviço suspeito
docker service ps <nome> --no-trunc --format '{{.Name}} {{.CurrentState}} {{.Error}}'
```

Erros típicos de imagem zumbi:
- `image <tag> could not be accessed on a registry`
- `No such image`
- `pull access denied`

## Resolução

```bash
# Opção 1 — escalar pra 0 se o serviço não é mais necessário
docker service scale <nome>=0

# Opção 2 — remover serviço
docker service rm <nome>

# Opção 3 — apontar pra imagem válida
docker service update --image <imagem-correta> <nome>
```

## Prevenção

- Antes de remover imagens (`docker rmi`, `docker image prune`), checar se algum serviço referencia
- Tags de imagem em `stack.yml` sempre devem existir antes do deploy
- Em squashes/migrations, garantir que a tag antiga persiste até o serviço apontar pra nova

## Checklist rápido em alerta de CPU

1. `docker service ls` — algum 0/N?
2. `docker service ps <nome>` — Error mostra "could not be accessed"?
3. Se sim: scale=0 → CPU cai imediatamente
