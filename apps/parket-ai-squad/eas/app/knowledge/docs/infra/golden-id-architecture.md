# Arquitetura do golden-id

O arquivo `/root/.golden-id` é a **única fonte de verdade** sobre qual imagem está rodando como produção do Dashboard Parket.

## Conteúdo

ID curto (12 chars) da imagem Docker que **deve estar rodando** como `parket-dashboard_dashboard`:

```
$ cat /root/.golden-id
31e8840b936ce
```

## Quem lê

- `protect-dashboard.sh` (roda a cada 30s) — verifica se o container correto está rodando, alerta se não
- `backup-dashboard.sh` (roda a cada 2h) — monitora e alerta, mas NUNCA restaura sozinho
- `deploy-dashboard.sh` — atualiza esse ID depois de cada deploy bem-sucedido
- `dev-sector.sh` — referência pra preview e merge

## Quem escreve

- `/root/deploy-dashboard.sh` (legítimo, único caminho normal)
- Squash da golden (caso excepcional, ver `dashboard/squash-procedure.md`)

## Backups

- `/root/.docker-golden-backups/golden-<ID>.tar.gz` — backup por versão (nunca sobrescreve)
- `/root/parket-dashboard-golden.tar.gz` — cópia do backup mais recente
- `/root/parket-dashboard-GOLDEN-20abr-SAFE.tar.gz` — backup seguro manual de referência

## Rollback de emergência

```bash
# 1. Ver backups disponíveis
ls -lt /root/.docker-golden-backups/golden-*.tar.gz | head -5

# 2. Carregar o backup desejado
docker load < /root/.docker-golden-backups/golden-<ID>.tar.gz

# 3. Retagear e atualizar golden-id
docker tag parket-dashboard:golden-complete parket-dashboard:golden-complete
NEW_ID=$(docker inspect parket-dashboard:golden-complete --format '{{.Id}}' | cut -c8-20)
echo "$NEW_ID" > /root/.golden-id

# 4. Forçar update
docker service update --image parket-dashboard:golden-complete --force parket-dashboard_dashboard
```

## Regras invioláveis

- **NUNCA** alterar `/root/.golden-id` manualmente fora dos casos acima
- **NUNCA** alterar `/usr/local/bin/protect-dashboard.sh` manualmente
- Backups são por ID — não sobrescrever versões antigas
