#!/usr/bin/env python3
"""
Cria cards de reativação no kanban comercial-entrada / coluna "leads-entrada".

Universo: phones que receberam OUT do comercial nos últimos 90 dias e nunca
mandaram IN, e que ainda NÃO têm card associado pelo celular/telefone.

NÃO dispara mensagem (apenas cria card). Disparo é etapa separada.
"""
import os
import re
import sys
from datetime import datetime
from zoneinfo import ZoneInfo
from supabase import create_client

SUPABASE_URL = os.environ["SUPABASE_URL"]
SUPABASE_SERVICE_KEY = os.environ["SUPABASE_SERVICE_KEY"]
DRY_RUN = "--apply" not in sys.argv
SP_TZ = ZoneInfo("America/Sao_Paulo")

NOME_REGEX = re.compile(
    r'^(?:Oi|Olá|Boa tarde|Bom dia|Boa noite),?\s+'
    r'([A-ZÁÉÍÓÚÂÊÔÃÕÇ][a-záéíóúâêôãõç]+(?:\s+[A-ZÁÉÍÓÚÂÊÔÃÕÇ][a-záéíóúâêôãõç]+)?)',
)


def fmt_phone(p: str) -> str:
    # 13 digits 55DDNNNNNNNNN  →  +55 (DD) NNNNN-NNNN
    if len(p) == 13 and p.startswith("55"):
        return f"+55 ({p[2:4]}) {p[4:9]}-{p[9:]}"
    if len(p) == 11:
        return f"({p[:2]}) {p[2:7]}-{p[7:]}"
    return p


def short_mask(p: str) -> str:
    return f"••••{p[-4:]}"


def main():
    sb = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)

    # 1) Leads frios candidatos (RPC ou SQL via REST não permite — usa supabase-py com filtros)
    # Faz via raw SQL através do PostgREST? PostgREST não roda SQL livre.
    # Solução: usa Management API do user pra rodar a SELECT (mesmo padrão dos outros scripts dele).
    import httpx
    SBKEY_MGMT = os.environ.get("SBKEY_MGMT", "sbp_01ac2cd076c0a0f6f21eaa4404bc0af1c2ddbe63")
    PROJ_REF = os.environ.get("PROJ_REF", "hbxpilrxmitvzebluoom")

    sql = """
    WITH leads_frios AS (
      SELECT DISTINCT regexp_replace(phone, '@s\\.whatsapp\\.net$', '') AS phone
      FROM whatsapp_messages
      WHERE direction='out' AND instance='Comercial - Parket'
        AND created_at > now() - interval '90 days'
    ),
    tem_in AS (SELECT DISTINCT regexp_replace(phone, '@s\\.whatsapp\\.net$', '') AS phone FROM whatsapp_messages WHERE direction='in'),
    candidatos AS (
      SELECT phone FROM leads_frios
      WHERE phone NOT IN (SELECT phone FROM tem_in)
        AND phone ~ '^[0-9]+$' AND length(phone) BETWEEN 10 AND 13
    ),
    cards_e AS (
      SELECT DISTINCT regexp_replace(coalesce(details->>'celular', details->>'telefone',''), '[^0-9]','','g') AS p
      FROM kanban_cards WHERE dept_id='comercial-entrada'
    )
    SELECT phone FROM candidatos
    WHERE regexp_replace(phone, '[^0-9]','','g') NOT IN (SELECT p FROM cards_e WHERE p <> '')
    ORDER BY phone;
    """
    resp = httpx.post(
        f"https://api.supabase.com/v1/projects/{PROJ_REF}/database/query",
        headers={"Authorization": f"Bearer {SBKEY_MGMT}", "Content-Type": "application/json"},
        json={"query": sql}, timeout=30,
    )
    resp.raise_for_status()
    rows = resp.json()
    phones = [r["phone"] for r in rows]
    print(f"Total candidatos a criar: {len(phones)}")

    # 2) Pega nome do histórico (1 query por phone OU em batch)
    nome_sql = """
    SELECT regexp_replace(phone, '@s\\.whatsapp\\.net$','') AS phone,
      array_agg(message_text ORDER BY created_at ASC) AS msgs
    FROM whatsapp_messages
    WHERE direction='out' AND instance='Comercial - Parket'
      AND regexp_replace(phone, '@s\\.whatsapp\\.net$','') = ANY(%s)
    GROUP BY 1
    """
    # PostgREST não suporta ANY direto — vou usar Management API
    # Faz em chunks de 50
    nomes = {}
    for i in range(0, len(phones), 50):
        chunk = phones[i:i+50]
        chunk_list = "{" + ",".join(f'"{p}"' for p in chunk) + "}"
        chunk_sql = f"""
        SELECT regexp_replace(phone, '@s\\.whatsapp\\.net$','') AS phone, message_text
        FROM whatsapp_messages
        WHERE direction='out' AND instance='Comercial - Parket'
          AND regexp_replace(phone, '@s\\.whatsapp\\.net$','') = ANY('{chunk_list}'::text[])
          AND message_text ~ '^(Oi|Olá|Boa tarde|Bom dia|Boa noite),'
        ORDER BY created_at ASC
        """
        r = httpx.post(
            f"https://api.supabase.com/v1/projects/{PROJ_REF}/database/query",
            headers={"Authorization": f"Bearer {SBKEY_MGMT}", "Content-Type": "application/json"},
            json={"query": chunk_sql}, timeout=30,
        )
        r.raise_for_status()
        for row in r.json():
            ph = row["phone"]
            if ph in nomes:
                continue
            m = NOME_REGEX.match(row["message_text"] or "")
            if m:
                nomes[ph] = m.group(1).strip()

    # 3) Próximo PKT
    obra_resp = sb.table("kanban_cards") \
        .select("obra") \
        .eq("dept_id", "comercial-entrada") \
        .like("obra", "PKT%") \
        .order("obra", desc=True) \
        .limit(1).execute()
    next_n = 100000
    if obra_resp.data:
        m = re.search(r"PKT(\d+)", obra_resp.data[0]["obra"])
        if m:
            next_n = max(next_n, int(m.group(1)))
    print(f"Próximo PKT base: {next_n + 1}")

    # 4) Cria cards
    criados = 0
    falhas = 0
    com_nome_count = sum(1 for p in phones if p in nomes)
    print(f"Com nome extraído: {com_nome_count} | Sem nome: {len(phones) - com_nome_count}")

    if DRY_RUN:
        print("\n=== DRY-RUN — amostra de 5 cards que SERIAM criados ===")
        for p in phones[:5]:
            nome = nomes.get(p)
            title = nome or f"Lead WhatsApp {short_mask(p)}"
            print(f"  - phone={p} title='{title}' subtitle='{fmt_phone(p)}'")
        print("\nPara aplicar: python3 criar_cards_reativacao.py --apply")
        return

    now_iso = datetime.now(SP_TZ).isoformat()
    for idx, p in enumerate(phones):
        nome = nomes.get(p)
        title = nome or f"Lead WhatsApp {short_mask(p)}"
        next_n += 1
        card = {
            "dept_id": "comercial-entrada",
            "column_id": "leads-entrada",
            "title": title,
            "subtitle": fmt_phone(p),
            "responsavel": "TEKA IA",
            "sla": "24h",
            "sla_status": "ok",
            "priority": "media",
            "obra": f"PKT{next_n:06d}",
            "tags": ["reativacao-2026-05", "lead-frio"],
            "details": {
                "celular": p,
                "nome": nome or "",
                "origem": "reativacao_leads_frios_2026-05",
                "teka_ativa": True,
                "teka_etapa": "reativacao_pendente",
                "teka_inicio": now_iso,
                "teka_ultima_msg": now_iso,
                "teka_followup_count": 0,
                "mensagens_ia": [],
                "qualificacao": {},
            },
        }
        try:
            sb.table("kanban_cards").insert(card).execute()
            criados += 1
            if criados % 25 == 0:
                print(f"  ... {criados}/{len(phones)}")
        except Exception as e:
            falhas += 1
            print(f"  [FAIL] phone={p}: {e}")

    print(f"\n=== RESULTADO ===")
    print(f"Criados: {criados}")
    print(f"Falhas: {falhas}")


if __name__ == "__main__":
    main()
