#!/usr/bin/env python3
"""
Roda diariamente via cron. Lê próximos 3 dias de eventos (avisos + aniversários)
e envia mensagem WhatsApp pro grupo "👥 Parket - RH" via Evolution API.

Cron: 0 8 * * * /root/parket-rh/scripts/notificar_proximos_eventos.py
"""
import json
import sys
import urllib.request
from datetime import date, timedelta

SUPABASE_TOKEN = "SUPABASE_MGMT_TOKEN_REMOVIDO"
SUPABASE_PROJECT = "hbxpilrxmitvzebluoom"
EVOLUTION_BASE = "https://conect.parket.works"
EVOLUTION_APIKEY = "4eab105201410d6865b86dca76ee9fa3"
EVOLUTION_INSTANCE = "Parket"
GRUPO_RH = "120363405634674702@g.us"
DIAS_ANTECEDENCIA = 3


UA = "ParketRHCron/1.0"


def run_sql(query: str) -> list:
    """Executa SQL via Management API e devolve linhas como list[dict].
    User-Agent customizado é necessário — Cloudflare bloqueia o default
    `Python-urllib/x.y` (erro 1010)."""
    req = urllib.request.Request(
        f"https://api.supabase.com/v1/projects/{SUPABASE_PROJECT}/database/query",
        data=json.dumps({"query": query}).encode(),
        headers={
            "Authorization": f"Bearer {SUPABASE_TOKEN}",
            "Content-Type": "application/json",
            "User-Agent": UA,
        },
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.loads(r.read().decode())


def send_whatsapp(text: str) -> None:
    """Envia texto pro grupo RH via Evolution API."""
    req = urllib.request.Request(
        f"{EVOLUTION_BASE}/message/sendText/{EVOLUTION_INSTANCE}",
        data=json.dumps({"number": GRUPO_RH, "text": text}).encode(),
        headers={"apikey": EVOLUTION_APIKEY, "Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=30) as r:
        body = r.read().decode()
        if r.status >= 400:
            raise RuntimeError(f"Evolution HTTP {r.status}: {body}")


def fmt_data(d: date) -> str:
    """Formata date pra '18/05 (segunda)'."""
    dias = ["segunda", "terça", "quarta", "quinta", "sexta", "sábado", "domingo"]
    return f"{d.day:02d}/{d.month:02d} ({dias[d.weekday()]})"


def label_dias(n: int) -> str:
    if n == 0:
        return "HOJE"
    if n == 1:
        return "amanhã"
    return f"daqui a {n} dias"


def main():
    hoje = date.today()
    limite = hoje + timedelta(days=DIAS_ANTECEDENCIA)

    # Avisos no range
    avisos = run_sql(f"""
        SELECT data_inicio, titulo, tipo, descricao
        FROM rh.avisos
        WHERE data_inicio BETWEEN '{hoje.isoformat()}' AND '{limite.isoformat()}'
        ORDER BY data_inicio, titulo;
    """)

    # Aniversariantes (compara MM-DD pra ignorar ano)
    aniv_rows = run_sql(f"""
        SELECT nome, data_nascimento
        FROM rh.colaboradores
        WHERE data_nascimento IS NOT NULL
          AND TO_CHAR(data_nascimento, 'MM-DD') BETWEEN
              TO_CHAR(DATE '{hoje.isoformat()}', 'MM-DD') AND
              TO_CHAR(DATE '{limite.isoformat()}', 'MM-DD')
        ORDER BY TO_CHAR(data_nascimento, 'MM-DD'), nome;
    """)

    # Agrupa por dia
    by_day: dict[date, list[str]] = {}
    tipo_emoji = {"feriado": "🇧🇷", "reuniao": "📅", "evento": "🎉", "aviso": "📌"}

    for a in avisos:
        d = date.fromisoformat(a["data_inicio"])
        emoji = tipo_emoji.get(a["tipo"], "📌")
        by_day.setdefault(d, []).append(f"{emoji} *{a['titulo']}*")

    for p in aniv_rows:
        nasc = date.fromisoformat(p["data_nascimento"])
        # Aniversário deste ano
        d = date(hoje.year, nasc.month, nasc.day)
        if d < hoje:
            d = date(hoje.year + 1, nasc.month, nasc.day)
        idade = d.year - nasc.year
        by_day.setdefault(d, []).append(f"🎂 *{p['nome'].title()}* (faz {idade} anos)")

    if not by_day:
        print(f"[{hoje}] Sem eventos nos próximos {DIAS_ANTECEDENCIA} dias. Nada a notificar.")
        return

    # Monta mensagem
    linhas = [f"🔔 *Próximos {DIAS_ANTECEDENCIA} dias — RH Parket*", ""]
    for d in sorted(by_day.keys()):
        diff = (d - hoje).days
        linhas.append(f"📆 *{fmt_data(d)}* — {label_dias(diff).upper()}")
        for item in by_day[d]:
            linhas.append(f"   {item}")
        linhas.append("")
    linhas.append("_Veja tudo em rh.parket.works/calendario_")

    text = "\n".join(linhas).strip()
    print(text)
    print("---")
    send_whatsapp(text)
    print(f"[{hoje}] OK — enviado pro grupo Parket - RH ({len(by_day)} dia(s) com eventos).")


if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        print(f"ERRO: {e}", file=sys.stderr)
        sys.exit(1)
