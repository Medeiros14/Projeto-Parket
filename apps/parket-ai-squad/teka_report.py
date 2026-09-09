#!/usr/bin/env python3
"""
Teka Comercial WhatsApp — relatório de conversas ativas.

Gera um resumo por telefone/card das últimas N horas incluindo:
- Dados do card (coluna, dept, responsável, m²)
- Timeline de mensagens da whatsapp_messages
- Ações da Teka (qualificação, movimentação, pausas)
- Estado atual (ativa, pausada, qualificada, etc.)

Uso:
    python3 teka_report.py              # resumo geral das últimas 12h
    python3 teka_report.py --hours 24   # últimas 24h
    python3 teka_report.py --phone XXXX  # detalhado de um telefone
    python3 teka_report.py --summary     # só linha por linha
"""

import os
import sys
import json
import argparse
import urllib.request
import subprocess
from datetime import datetime, timedelta, timezone

SB_URL = "https://hbxpilrxmitvzebluoom.supabase.co"
SB_KEY_FILE = "/root/Dashboardparketapp/.env"


def sb_key():
    with open(SB_KEY_FILE) as f:
        for line in f:
            if line.startswith("VITE_SUPABASE_SERVICE_KEY="):
                return line.split("=", 1)[1].strip()
    raise RuntimeError("supabase key not found")


def sb_query(sql):
    """Run SQL via Supabase Management API."""
    TOKEN = "SUPABASE_MGMT_TOKEN_REMOVIDO"
    req = urllib.request.Request(
        "https://api.supabase.com/v1/projects/hbxpilrxmitvzebluoom/database/query",
        data=json.dumps({"query": sql}).encode(),
        headers={
            "Authorization": f"Bearer {TOKEN}",
            "Content-Type": "application/json",
            "User-Agent": "teka-report-cli/1.0",
            "Accept": "application/json",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            return json.loads(r.read().decode())
    except urllib.error.HTTPError as e:
        print(f"[sb_query error {e.code}]: {e.read().decode()[:200]}", file=sys.stderr)
        return []


def get_paused_phones():
    """Set of phones currently paused (vendor handling manually)."""
    import subprocess
    out = subprocess.run(
        'docker exec $(docker ps -q -f name=parket-ai-squad_redis | head -1) redis-cli --scan --pattern "teka:paused:*"',
        shell=True, capture_output=True, text=True
    ).stdout
    return {line.replace("teka:paused:", "").strip() for line in out.splitlines() if line.strip()}


def teka_logs(hours=6, phone=None):
    """Grep backend logs for Teka events."""
    cmd = f"docker logs --since {hours}h $(docker ps -q -f name=parket-ai-squad_backend | head -1) 2>&1"
    if phone:
        cmd += f" | grep --line-buffered '{phone}'"
    cmd += " | grep -E 'teka_|agent_dispatching|agent_response_via|whatsapp_message_received|escalate_to_human|anthropic_oauth' | tail -300"
    out = subprocess.run(cmd, shell=True, capture_output=True, text=True).stdout
    return out.splitlines()


def fmt_ts(ts):
    if not ts:
        return "—"
    if isinstance(ts, str):
        try:
            dt = datetime.fromisoformat(ts.replace(" ", "T").replace("+00", "+00:00"))
        except:
            return ts[:19]
    else:
        dt = ts
    return dt.strftime("%d/%m %H:%M")


def summary_table(hours=12):
    """One line per active conversation."""
    rows = sb_query(f"""
      SELECT
        k.id as card_id,
        k.title as cliente,
        k.obra,
        k.column_id,
        k.responsavel,
        k.details->>'phone' as phone_detail,
        k.details->>'metragem' as m2,
        k.details->>'cidade' as cidade,
        k.updated_at
      FROM kanban_cards k
      WHERE k.dept_id = 'comercial-entrada'
        AND k.updated_at > NOW() - INTERVAL '{hours} hours'
      ORDER BY k.updated_at DESC
      LIMIT 50
    """)

    # Enrich with msg count
    phones = set()
    for r in rows:
        p = r.get("phone_detail") or ""
        if p:
            phones.add(p)

    msg_counts = {}
    if phones:
        phones_sql = ",".join(f"'{p}'" for p in phones)
        msgs = sb_query(f"""
          SELECT phone, direction, count(*) as n
          FROM whatsapp_messages
          WHERE phone IN ({phones_sql})
            AND timestamp > NOW() - INTERVAL '{hours} hours'
          GROUP BY phone, direction
        """)
        for m in msgs:
            msg_counts.setdefault(m["phone"], {})[m["direction"]] = m["n"]

    print(f"\n═══ Teka Comercial — últimas {hours}h ═══\n")
    if not rows:
        print("Nenhum card comercial movimentado no período.\n")
        return

    print(f"{'Coluna':<22} {'Cliente':<28} {'Obra':<14} {'Resp':<10} {'M²':<6} {'IN/OUT':<8} {'Atualizado':<14}")
    print("─" * 110)
    for r in rows:
        phone = r.get("phone_detail") or ""
        mc = msg_counts.get(phone, {})
        io = f"{mc.get('in',0)}/{mc.get('out',0)}"
        print(f"{r['column_id']:<22} {(r['cliente'] or '—')[:27]:<28} {(r['obra'] or '—')[:13]:<14} {(r['responsavel'] or '—')[:9]:<10} {(r['m2'] or '—')[:5]:<6} {io:<8} {fmt_ts(r['updated_at']):<14}")
    print()


def conversation_detail(phone, hours=12):
    """Full detail for a specific phone."""
    # Clean phone
    phone = phone.replace("+", "").replace("-", "").replace(" ", "")

    # Card
    cards = sb_query(f"""
      SELECT id, title, obra, column_id, dept_id, responsavel, details, created_at, updated_at
      FROM kanban_cards
      WHERE details->>'phone' = '{phone}'
         OR id IN (
            SELECT card_id FROM (VALUES ('')) t(card_id) WHERE false  -- placeholder
         )
      ORDER BY updated_at DESC LIMIT 5
    """)

    print(f"\n═══ Conversa: {phone} (últimas {hours}h) ═══\n")
    if cards:
        c = cards[0]
        d = c.get("details") or {}
        print(f"  Card:        {c['id']}")
        print(f"  Cliente:     {c['title']}  |  Obra: {c['obra'] or '—'}")
        print(f"  Coluna:      {c['column_id']}  ({c['dept_id']})")
        print(f"  Responsável: {c['responsavel']}")
        print(f"  Cidade:      {d.get('cidade', '—')}")
        print(f"  Metragem:    {d.get('metragem', d.get('area_m2', '—'))}")
        print(f"  Criado:      {fmt_ts(c['created_at'])}")
        print(f"  Atualizado:  {fmt_ts(c['updated_at'])}")
        print()
    else:
        print("  (sem card no kanban pra esse telefone)\n")

    # Messages
    msgs = sb_query(f"""
      SELECT direction, sender_name, message_text, timestamp, message_type
      FROM whatsapp_messages
      WHERE phone = '{phone}'
        AND timestamp > NOW() - INTERVAL '{hours} hours'
      ORDER BY timestamp ASC LIMIT 100
    """)

    if msgs:
        print(f"  Timeline ({len(msgs)} mensagens):\n")
        for m in msgs:
            arrow = "→" if m["direction"] == "out" else "←"
            sender = (m.get("sender_name") or "").strip() or ("Teka/Parket" if m["direction"] == "out" else "Cliente")
            text = (m.get("message_text") or f"[{m.get('message_type', 'media')}]")
            text = text.replace("\n", " ")[:120]
            print(f"  {fmt_ts(m['timestamp'])}  {arrow}  {sender[:20]:<20}  {text}")
    else:
        print("  (sem mensagens persistidas em whatsapp_messages)")

    # Logs
    print()
    log_events = teka_logs(hours=hours, phone=phone)
    if log_events:
        print(f"  Eventos da Teka ({len(log_events)}):")
        for ev in log_events[-20:]:
            # Extract the event name + data
            if "teka_" in ev or "agent_" in ev:
                parts = ev.split(" ")
                ts = " ".join(parts[0:2])[-8:] if len(parts) > 1 else "?"
                event_parts = [p for p in parts[2:] if p.strip()]
                # Find the [info] + event name
                body = " ".join(event_parts)
                print(f"  {ts}  {body[:120]}")
    print()


def list_active_conversations(hours=4):
    """Lista compacta — ideal pra rodar periodicamente no Monitor."""
    rows = sb_query(f"""
      SELECT
        k.column_id,
        count(*) as cards,
        count(DISTINCT k.details->>'phone') as unique_phones
      FROM kanban_cards k
      WHERE k.dept_id = 'comercial-entrada'
        AND k.updated_at > NOW() - INTERVAL '{hours} hours'
      GROUP BY k.column_id
      ORDER BY cards DESC
    """)

    stamp = datetime.now(timezone(timedelta(hours=-3))).strftime("%H:%M")
    total_cards = sum(r["cards"] for r in rows)
    print(f"[{stamp}] TEKA COMERCIAL — {total_cards} cards últ. {hours}h:", end=" ")
    print(" | ".join(f"{r['column_id']}={r['cards']}" for r in rows) or "(vazio)")


if __name__ == "__main__":
    p = argparse.ArgumentParser()
    p.add_argument("--hours", type=int, default=12)
    p.add_argument("--phone", default=None)
    p.add_argument("--summary", action="store_true", help="Só uma linha com totais por coluna")
    args = p.parse_args()

    if args.summary:
        list_active_conversations(hours=args.hours)
    elif args.phone:
        conversation_detail(args.phone, hours=args.hours)
    else:
        summary_table(hours=args.hours)
