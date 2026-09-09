#!/bin/bash
# Roda a cada 5 min via cron. Alerta se lag > 30s ou subscription caiu.
PROJ_REF=hbxpilrxmitvzebluoom
PWD='fCrbpU1S5k3NHI8p'
URL_CLOUD="postgres://postgres:${PWD}@db.${PROJ_REF}.supabase.co:5432/postgres"
LOG=/var/log/parket-replication.log
mkdir -p $(dirname $LOG)

CID=$(docker ps -q --filter ancestor=parket-supabase-pg:local | head -1)
[ -z "$CID" ] && { echo "$(date) ALERT pg-local container nao encontrado" >> $LOG; exit 1; }

# Lag em bytes no slot (medido do Cloud)
LAG=$(docker run --rm postgres:17-alpine psql "$URL_CLOUD" -tA -c \
  "SELECT pg_wal_lsn_diff(pg_current_wal_lsn(), confirmed_flush_lsn) FROM pg_replication_slots WHERE slot_name='parket_local_subscriber';" 2>/dev/null | tr -d ' ')

# Subscription ativa
ACTIVE=$(docker exec $CID psql -U postgres -d postgres -tA -c \
  "SELECT subenabled FROM pg_subscription WHERE subname='parket_de_cloud';" 2>/dev/null | tr -d ' ')

# Alerta se subscription caiu ou lag > 30 MB
if [ "$ACTIVE" != "t" ]; then
  echo "$(date) ALERT subscription parket_de_cloud nao esta ativa" >> $LOG
elif [ "${LAG:-0}" -gt 31457280 ]; then
  echo "$(date) ALERT lag alto: ${LAG} bytes" >> $LOG
else
  echo "$(date) OK lag=${LAG}B active=$ACTIVE" >> $LOG
fi
