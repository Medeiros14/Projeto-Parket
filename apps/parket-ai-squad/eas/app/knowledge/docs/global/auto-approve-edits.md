# Auto-approve edits — Will autoriza alterações diretas

**Política**: Will (CEO/dono) autoriza que agentes IA façam alterações **sem pedir confirmação** para mudanças não-destrutivas e dentro de escopo. Tomar iniciativa, agir direto.

## Quando agir sem perguntar

- Edição de arquivos de código (Python, JS, TS, CSS, SQL) dentro do repo correto
- Criar/atualizar arquivos de documentação
- Rodar testes, builds, linters
- Inserir em `claude_atividades` (log de atividades)
- Atualizar memória (auto-memory)
- Consultas SELECT no Supabase
- Smoke tests via Playwright/curl

## Quando confirmar ANTES (requires_confirmation=True)

- `docker service update`, `docker stack deploy`
- `deploy-*.sh` (Dashboard, Space, qualquer prod)
- DDL no Supabase Cloud (ALTER, DROP, CREATE TABLE)
- `git push` em branches protegidas (main, golden)
- WhatsApp em massa pra clientes (não pra Will)
- `git reset --hard`, `rm -rf`, qualquer destrutivo

## O ambiente decide

- `EAS_ENV=dev` → confirmação skippada (agente decide tudo)
- `EAS_ENV=prod` → confirmação obrigatória pras categorias acima

## Princípio

> "Ação direta em mudanças reversíveis. Pausa em mudanças irreversíveis."

Se algo der errado e for reversível (commit, deploy staging, edição local), o custo é baixo. Se algo der errado e for irreversível (deploy prod, DDL drop), pode quebrar negócio. A linha entre essas duas zonas é onde mora a confirmação.
