# Parket RH — DDL + Migração

## Estrutura

```
sql/
  001_schema_rh.sql            # Identidade, Org, Colaboradores, Contratos, Admissão
  002_schema_rh_operacao.sql   # Ponto, Banco horas, Férias, Folha, Desligamento, Treinamento, Avaliação, eSocial, Notificações
  003_schema_signer.sql        # Assinatura PAdES + TSA modular
  004_rls_policies.sql         # Row Level Security (admin/rh/gestor/colaborador)

scripts/
  migrate_admissoes.py         # Importa admissoes.xlsx → rh.colaboradores + rh.contratos
```

## Aplicar o schema

```bash
# Schemas + tabelas + triggers
SUPABASE_TOKEN=sbp_xxx
for f in sql/001_schema_rh.sql sql/002_schema_rh_operacao.sql sql/003_schema_signer.sql sql/004_rls_policies.sql; do
  echo ">>> $f"
  curl -s -X POST "https://api.supabase.com/v1/projects/<SUPABASE_PROJECT_REF>/database/query" \
    -H "Authorization: Bearer $SUPABASE_TOKEN" \
    -H "Content-Type: application/json" \
    --data "$(python3 -c "import json; print(json.dumps({'query': open('$f').read()}))")"
  echo
done

# Expor schemas no PostgREST (uma vez só)
curl -X PATCH "https://api.supabase.com/v1/projects/<SUPABASE_PROJECT_REF>/postgrest" \
  -H "Authorization: Bearer $SUPABASE_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"db_schema":"public,graphql_public,core,rh,signer","db_extra_search_path":"public, extensions, core, rh, signer"}'
```

## Importar a base do Convenia

```bash
export SUPABASE_MGMT_TOKEN=sbp_xxx
python3 scripts/migrate_admissoes.py --dry-run        # preview, não escreve
python3 scripts/migrate_admissoes.py                  # executa de fato
```

## Mapa de tabelas (50)

### Schema `rh`
- **Identidade**: `app_users`
- **Catálogos eSocial**: `cbos`, `lotacoes_tributarias`, `rubricas`
- **Organização**: `departamentos`, `times`, `cargos`
- **Pessoa**: `colaboradores`, `dependentes`, `dados_bancarios`, `documentos_pessoais`
- **Vínculos**: `contratos`, `contrato_alteracoes`, `beneficios`
- **Admissão**: `admissoes`, `admissao_documentos`
- **Ponto**: `escalas`, `escala_horarios`, `colaborador_escala`, `batidas_ponto`, `justificativas_ponto`, `banco_horas_movimentos`, `banco_horas_saldos`
- **Férias**: `ferias_periodos_aquisitivos`, `ferias_periodos_concessivos`, `ferias_solicitacoes`
- **Folha**: `competencias`, `folhas_pagamento`, `holerites_lotes`, `holerites`, `holerite_eventos`, `adiantamentos`
- **Desligamento**: `desligamentos`, `checklist_templates`, `checklist_template_itens`, `checklist_execucoes`, `checklist_execucao_itens`, `verbas_rescisorias`
- **Treinamentos**: `treinamentos_catalogo`, `trilhas`, `trilha_treinamentos`, `colaborador_treinamentos`
- **Avaliação**: `ciclos_avaliacao`, `avaliacao_formularios`, `avaliacao_perguntas`, `avaliacoes`, `avaliacao_respostas`
- **eSocial**: `esocial_lotes`, `esocial_eventos`
- **Notificações**: `notificacoes_canal_preferencias`, `notificacoes`

### Schema `signer`
- `documentos`, `signatarios`, `signatario_links`, `otp_codes`, `assinaturas`, `audit_logs`
- `certificados_parket`, `tsa_providers` (Strategy modular), `tsa_carimbos`
