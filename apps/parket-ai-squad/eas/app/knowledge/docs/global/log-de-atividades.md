# Log de atividades em `claude_atividades`

**Regra**: toda mudança relevante feita por agente IA (ou claude code) DEVE ser registrada em `public.claude_atividades` no Supabase principal (`hbxpilrxmitvzebluoom`). Sem pedir permissão, só registrar.

## Schema

Tabela `public.claude_atividades`:

| Coluna | Tipo | Obrigatório |
|---|---|---|
| `id` | uuid (default gen) | – |
| `created_at` | timestamptz (default now) | – |
| `titulo` | text | **sim** |
| `descricao` | text | **sim** |
| `setor` | text | **sim** |
| `categoria` | text | **sim** |
| `tags` | text[] | não |
| `feita_por` | text | não (default `claude`) |

## `categoria` (CHECK constraint)

Valores permitidos:

- `fix` — correção de bug
- `feature` — nova funcionalidade
- `config` — mudança de configuração/infra
- `rollback` — reversão
- `data` — operação em dados (backfill, migration, restore)
- `investigacao` — análise sem mudança

⚠️ Qualquer outro valor viola o constraint `claude_atividades_categoria_check` e falha o INSERT.

## Setores típicos

- `Engenharia`, `Orçamentos`, `Comercial`, `RH`, `Fiscal`, `Atendimento`, `PMO`, `Financeiro`, `Marcenaria`, `Suprimentos`, `Produtividade`

## Como inserir (via Supabase Management API)

```bash
SQL="INSERT INTO public.claude_atividades (titulo, descricao, setor, categoria) VALUES ('...', '...', 'Engenharia', 'fix');"
curl -s -X POST "https://api.supabase.com/v1/projects/hbxpilrxmitvzebluoom/database/query" \
  -H "Authorization: Bearer sbp_01ac2cd076c0a0f6f21eaa4404bc0af1c2ddbe63" \
  -H "Content-Type: application/json" \
  --data-raw "$(jq -Rsn --arg q "$SQL" '{query:$q}')"
```

Resposta `[]` = sucesso.

## Boas práticas

- **título**: curto, com prefixo "Fix:", "Feat:", "Config:" — facilita filtro
- **descrição**: o que foi feito + por que + como verificar (1 parágrafo, sem markdown agressivo)
- **tags**: opcional, mas útil pra agrupar (ex: `['dashboard','hotpatch','proposta']`)
- Logar **depois** da mudança aplicada e validada, nunca antes
