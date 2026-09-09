#!/bin/bash
# Roda 3h da manhã via cron. Faz pg_dump custom format no Local + tarballa.
# Mantém últimos 14 dias.
DIR=/root/backups/pg-local
mkdir -p $DIR
DATA=$(date +%Y%m%d)
LOG=/var/log/parket-backup-pg-local.log

CID=$(docker ps -q --filter ancestor=parket-supabase-pg:local | head -1)
[ -z "$CID" ] && { echo "$(date) backup FAIL: container nao encontrado" >> $LOG; exit 1; }

# pg_dump custom format (compressed)
docker exec $CID pg_dump -U postgres -d postgres \
  --format=custom --no-owner --no-privileges \
  --exclude-schema='pg_temp_*' --exclude-schema='pg_toast_temp_*' \
  --file=/tmp/dump-${DATA}.custom 2>>$LOG

# Move pra dir de backup
docker cp $CID:/tmp/dump-${DATA}.custom ${DIR}/dump-${DATA}.custom
docker exec $CID rm /tmp/dump-${DATA}.custom

# Limpa dumps > 14 dias
find $DIR -name "dump-*.custom" -mtime +14 -delete

SIZE=$(ls -lh ${DIR}/dump-${DATA}.custom 2>/dev/null | awk '{print $5}')
echo "$(date) backup OK: ${DIR}/dump-${DATA}.custom ($SIZE)" >> $LOG
