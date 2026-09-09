# Squash da golden — quando "mount options is too long"

Se `docker build` do `parket-dashboard:staging` falha com `mount options is too long` (mesmo com COPY simples de poucos KB), é porque `parket-dashboard:golden` acumulou camadas demais. O overlayfs do kernel tem limite no tamanho do parâmetro `mount` de cada camada (já chegou a 352 camadas).

## Why
Cada `/root/deploy-dashboard.sh` adiciona +1 camada via COPY hotpatch. Sem squash periódico, acumula até falhar.

## Procedure

```bash
# 1. tag de backup pré-squash
docker tag parket-dashboard:golden parket-dashboard:golden-pre-squash-$(date +%H%M)

# 2. export + import (achatamento)
docker create --name tmp_squash parket-dashboard:golden
docker export tmp_squash | docker import - parket-dashboard:golden-base
docker rm tmp_squash

# 3. Reaplicar config (CMD/WORKDIR/EXPOSE/STOPSIGNAL — perdidos no export)
cat > /tmp/golden-rewrap.dockerfile << 'DOCKEREOF'
FROM parket-dashboard:golden-base
WORKDIR /usr/share/nginx/html
EXPOSE 80
STOPSIGNAL SIGQUIT
CMD ["nginx", "-g", "daemon off;"]
DOCKEREOF
docker build -t parket-dashboard:golden-flat -f /tmp/golden-rewrap.dockerfile .
docker tag parket-dashboard:golden-flat parket-dashboard:golden

# 4. Atualizar .golden-id (source of truth)
docker image inspect parket-dashboard:golden --format '{{.Id}}' | cut -d: -f2 | cut -c1-13 > /root/.golden-id
```

Depois disso, `docker build -t parket-dashboard:staging . && /root/deploy-dashboard.sh parket-dashboard:staging` volta a funcionar (golden vira 1-2 camadas em vez de centenas).

## Prevenção

Squashar a golden a cada ~50 hotpatches. Monitorar com:

```bash
docker history parket-dashboard:golden --format '{{.ID}}' | wc -l
```

## Aviso

`/root/.golden-id` é normalmente alterado **só** pelo `deploy-dashboard.sh`. Squash é a única exceção. Fazer **manualmente** essa mudança fora do script é violação de procedimento.
