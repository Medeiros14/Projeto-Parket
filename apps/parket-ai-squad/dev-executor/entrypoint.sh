#!/bin/bash
# Executor headless — roda 1 briefing num clone isolado do repo.
# Contrato: /repo (ro) = fonte; /workspace (rw) = briefing.md de entrada,
# repo/ (clone), result.json, mudancas.patch, mudancas-stat.txt, RESULTADO.md.
set -u

cd /workspace
echo "started $(date -Iseconds)" > status.txt

if [ ! -f briefing.md ]; then
  echo "erro: /workspace/briefing.md não existe" | tee -a status.txt
  exit 2
fi

# repo do host é root; executor é uid 1000 — sem isso o git recusa o clone
git config --global --add safe.directory '*'

rm -rf repo
if ! git clone -q /repo repo; then
  echo "erro: git clone /repo falhou" | tee -a status.txt
  exit 3
fi
cd repo
git config user.email "dev-executor@parket.com.br"
git config user.name "Dev Executor (Claude Code)"
git checkout -q -b dev-exec

PROMPT="Você é o executor do Time Dev Gestão da Parket, rodando headless num clone isolado do repositório do gestao.parket.works (você está na raiz do repo).

REGRAS:
- Implemente EXATAMENTE o briefing abaixo. Nada além do escopo.
- Só edite arquivos dentro deste repositório. NÃO rode docker, deploys, git push ou comandos de rede além do necessário.
- Valide sintaxe do que editar (python3 -m py_compile pra .py; node --check pra .js quando aplicável).
- Ao final, escreva ../RESULTADO.md com: o que mudou (arquivo a arquivo), como testar, riscos, e o que ficou fora do escopo.

BRIEFING:
$(cat ../briefing.md)"

timeout 2400 claude -p "$PROMPT" \
  --model "${CLAUDE_MODEL:-claude-sonnet-4-6}" \
  --dangerously-skip-permissions \
  --output-format json > ../result.json 2> ../claude-stderr.log
EXIT=$?
echo "claude_exit $EXIT" >> ../status.txt

git add -A
git diff --cached > ../mudancas.patch
git diff --cached --stat > ../mudancas-stat.txt
git commit -q -m "dev-exec: $(head -c 80 ../briefing.md | tr '\n' ' ')" 2>/dev/null || true

echo "finished $(date -Iseconds) exit=$EXIT" >> ../status.txt
exit $EXIT
