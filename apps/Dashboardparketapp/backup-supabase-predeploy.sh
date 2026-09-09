#!/bin/bash
set -e

# ═══ Backup Supabase Pre-Deploy ═══
# Salva kanban_columns + kanban_cards antes de deploy.
# Restaura com: ./backup-supabase-predeploy.sh restore <timestamp>

SUPABASE_API="https://api.supabase.com/v1/projects/hbxpilrxmitvzebluoom/database/query"
SUPABASE_TOKEN="sbp_01ac2cd076c0a0f6f21eaa4404bc0af1c2ddbe63"
BACKUP_DIR="/root/.supabase-backups"
mkdir -p "$BACKUP_DIR"

run_sql() {
  curl -s -X POST "$SUPABASE_API" \
    -H "Authorization: Bearer $SUPABASE_TOKEN" \
    -H "Content-Type: application/json" \
    -d "$(jq -Rsn --arg q "$1" '{query:$q}')"
}

case "${1:-backup}" in
  backup)
    TS=$(date +%Y%m%d-%H%M%S)
    echo "Backup $TS..."

    echo "  kanban_columns..."
    run_sql "SELECT * FROM public.kanban_columns ORDER BY dept_id, position;" > "$BACKUP_DIR/columns-$TS.json"
    COL_COUNT=$(python3 -c "import json; print(len(json.load(open('$BACKUP_DIR/columns-$TS.json'))))")

    echo "  kanban_cards (id, dept_id, column_id, title, obra)..."
    run_sql "SELECT id, dept_id, column_id, title, obra, responsavel, sla_status, priority FROM public.kanban_cards ORDER BY dept_id, column_id;" > "$BACKUP_DIR/cards-$TS.json"
    CARD_COUNT=$(python3 -c "import json; print(len(json.load(open('$BACKUP_DIR/cards-$TS.json'))))")

    echo "  OK: $COL_COUNT colunas, $CARD_COUNT cards"
    echo "  Salvo em: $BACKUP_DIR/*-$TS.json"
    echo "$TS" > "$BACKUP_DIR/latest"
    ;;

  restore)
    TS="${2:-$(cat "$BACKUP_DIR/latest" 2>/dev/null)}"
    if [ -z "$TS" ] || [ ! -f "$BACKUP_DIR/columns-$TS.json" ]; then
      echo "Uso: $0 restore <timestamp>"
      echo "Backups disponiveis:"
      ls "$BACKUP_DIR"/columns-*.json 2>/dev/null | sed 's|.*columns-||;s|\.json||'
      exit 1
    fi

    echo "Restaurando colunas do backup $TS..."

    # Gerar SQL de restore das colunas
    python3 -c "
import json, sys

cols = json.load(open('$BACKUP_DIR/columns-$TS.json'))
if not cols:
    print('Backup vazio!', file=sys.stderr)
    sys.exit(1)

# Agrupar por dept_id
depts = set(c['dept_id'] for c in cols)
lines = []
for d in sorted(depts):
    lines.append(f\"DELETE FROM public.kanban_columns WHERE dept_id = '{d}';\")

for c in cols:
    slug = c['slug'].replace(\"'\", \"''\")
    title = c['title'].replace(\"'\", \"''\")
    color = c.get('color', '#6B7280').replace(\"'\", \"''\")
    pos = c.get('position', c.get('seq', 0))
    sla = c.get('sla_label') or ''
    sla_part = f\", '{sla.replace(chr(39), chr(39)+chr(39))}')\" if sla else ', NULL)'
    lines.append(f\"INSERT INTO public.kanban_columns (dept_id, slug, title, color, position, sla_label) VALUES ('{c['dept_id']}', '{slug}', '{title}', '{color}', {pos}{sla_part};\")

print('\n'.join(lines))
" > /tmp/restore-columns.sql

    SQL=$(cat /tmp/restore-columns.sql)
    echo "  Executando $(echo "$SQL" | wc -l) statements..."
    run_sql "$SQL" > /dev/null
    echo "  Colunas restauradas de $TS"
    ;;

  list)
    echo "Backups disponiveis:"
    for f in "$BACKUP_DIR"/columns-*.json; do
      ts=$(basename "$f" | sed 's/columns-//;s/.json//')
      cols=$(python3 -c "import json; print(len(json.load(open('$f'))))" 2>/dev/null || echo "?")
      cards_f="$BACKUP_DIR/cards-$ts.json"
      cards=$(python3 -c "import json; print(len(json.load(open('$cards_f'))))" 2>/dev/null || echo "?")
      echo "  $ts — $cols colunas, $cards cards"
    done
    ;;

  *)
    echo "Uso: $0 [backup|restore <ts>|list]"
    ;;
esac
