"""
Extrai investimento pretendido do cliente a partir das mensagens do WhatsApp
para os leads qualificados nos últimos N dias.

Roda 100% do host: usa `docker exec` no container Postgres pra queries e
urllib pra bater na API do Claude. Sem dependência externa.

Fluxo:
  1) Puxa card_ids únicos que passaram por slug='qualificado' no período
     (via card_movements).
  2) Para cada card, monta transcript das últimas ~40 mensagens
     (in e out pra contexto).
  3) Chama Claude Sonnet: "extraia investimento pretendido do cliente,
     em R$, ou null" com evidência textual.
  4) Grava em kanban_cards.details.investimento_extraido (número em R$)
     + details.investimento_extraido_meta (evidência, timestamp, quote).

Uso:
  python3 extract_investimento.py --dias 30 [--limit 5] [--force]

  --limit N   : processa só N cards (piloto/teste)
  --force     : re-processa cards que já têm details.investimento_extraido_meta
"""
import argparse
import json
import os
import re
import subprocess
import sys
import time
from datetime import datetime
from urllib.request import Request, urlopen
from urllib.error import HTTPError

# --- Config -------------------------------------------------------------
def _discover_pg_container():
    env = os.environ.get("PG_CONTAINER")
    if env:
        return env
    out = subprocess.run(
        ["docker", "ps", "--format", "{{.Names}}", "--filter", "name=parket-pg-local_postgres"],
        capture_output=True, text=True, timeout=10,
    )
    for name in out.stdout.strip().splitlines():
        if name.startswith("parket-pg-local_postgres"):
            return name
    raise RuntimeError("Container postgres nao encontrado")

PG_CONTAINER = _discover_pg_container()
OAUTH_PATH = "/root/.anthropic_oat"
MODEL = "claude-sonnet-4-5"
MAX_MSGS_PER_CARD = 40
MIN_SANE = 5_000
MAX_SANE = 20_000_000

PROMPT = """Você é um analista de vendas do setor de pisos de madeira premium (Parket). Vou te dar a transcrição parcial de uma conversa entre o SDR/vendedor e um cliente potencial via WhatsApp. Sua tarefa: extrair o VALOR TOTAL de investimento pretendido pelo CLIENTE para o projeto de piso/marcenaria/etc.

REGRAS DURAS:
- Interessa APENAS o valor total do projeto pretendido pelo CLIENTE.
- IGNORE preços unitários (R$/m², R$/metro, "a partir de R$X") — esses são do vendedor.
- Se o cliente dá uma faixa ("uns 100 a 200 mil"), use o PONTO MÉDIO.
- Se o cliente diz "não sei", "não faço ideia", "quero saber quanto sai" — retorne null.
- Se só o vendedor menciona valores, retorne null.
- Se o cliente cita valor mas está claramente perguntando ("é uns 100 mil?") — retorne null.
- Valor precisa ser em R$ concreto: "50 mil" = 50000, "1.2 milhão" = 1200000.

RESPONDA em JSON puro (nada mais):
{
  "valor_reais": <number ou null>,
  "confianca": "alta" | "media" | "baixa",
  "evidencia": "<trecho curto exato da mensagem do cliente, ou null>"
}

Transcrição:
"""

# --- Anthropic --------------------------------------------------------
def carregar_token():
    with open(OAUTH_PATH) as f:
        return f.read().strip()

def anthropic_call(prompt: str, token: str) -> dict:
    body = json.dumps({
        "model": MODEL,
        "max_tokens": 400,
        "messages": [{"role": "user", "content": prompt}],
    }).encode("utf-8")
    req = Request(
        "https://api.anthropic.com/v1/messages",
        data=body,
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {token}",
            "anthropic-version": "2023-06-01",
            "anthropic-beta": "oauth-2025-04-20",
        },
    )
    with urlopen(req, timeout=45) as resp:
        payload = json.loads(resp.read())
    text = "".join(b.get("text", "") for b in payload.get("content", []))
    m = re.search(r"\{.*\}", text, re.S)
    if not m:
        raise ValueError(f"Sem JSON na resposta: {text[:200]}")
    return json.loads(m.group(0))

# --- PG helper: roda SQL dentro do container, saida JSON --------------
def psql_json(sql: str) -> list:
    """
    Envolve o SQL em to_jsonb pra pegar 1 array JSON de linhas.
    """
    wrapped = (
        "SELECT COALESCE(jsonb_agg(row_to_json(t)), '[]'::jsonb) "
        f"FROM ({sql}) t;"
    )
    proc = subprocess.run(
        ["docker", "exec", "-i", PG_CONTAINER,
         "psql", "-U", "postgres", "-d", "postgres", "-t", "-A"],
        input=wrapped.encode("utf-8"),
        capture_output=True,
        timeout=30,
    )
    if proc.returncode != 0:
        raise RuntimeError(f"psql erro: {proc.stderr.decode()[:200]}")
    raw = proc.stdout.decode().strip()
    if not raw:
        return []
    return json.loads(raw)

def psql_exec(sql: str, params: dict):
    """UPDATE parametrizado — usa psql com prepared statement via json param."""
    # Reescreve params inline com quote proprio pra evitar libs. Só string/number.
    def q(v):
        if v is None:
            return "NULL"
        if isinstance(v, (int, float)):
            return str(v)
        s = str(v).replace("'", "''")
        return f"'{s}'"
    resolved = sql
    for k, v in params.items():
        resolved = resolved.replace(f":{k}", q(v))
    proc = subprocess.run(
        ["docker", "exec", "-i", PG_CONTAINER,
         "psql", "-U", "postgres", "-d", "postgres", "-q"],
        input=resolved.encode("utf-8"),
        capture_output=True,
        timeout=30,
    )
    if proc.returncode != 0:
        raise RuntimeError(f"psql erro: {proc.stderr.decode()[:200]}")

# --- Data ------------------------------------------------------------
def puxar_qualificados(dias: int) -> list:
    rows = psql_json(f"""
        SELECT DISTINCT card_id::text AS id
        FROM card_movements
        WHERE moved_at >= (CURRENT_DATE - {dias}::int)
          AND to_column = 'qualificado'
    """)
    return [r["id"] for r in rows]

def ja_processado(card_id: str) -> bool:
    rows = psql_json(f"""
        SELECT (details->'investimento_extraido_meta'->>'ts') IS NOT NULL AS done
        FROM kanban_cards WHERE id = '{card_id}'::uuid
    """)
    return bool(rows and rows[0]["done"])

def puxar_transcript(card_id: str) -> str:
    rows = psql_json(f"""
        SELECT direction, message_text, timestamp
        FROM whatsapp_messages
        WHERE card_id = '{card_id}'::uuid
          AND COALESCE(message_text, '') <> ''
        ORDER BY timestamp ASC
        LIMIT {MAX_MSGS_PER_CARD}
    """)
    lines = []
    for r in rows:
        text = re.sub(r"\s+", " ", (r.get("message_text") or "")).strip()
        if not text:
            continue
        who = "CLIENTE" if r["direction"] == "in" else "PARKET"
        lines.append(f"[{who}] {text}")
    return "\n".join(lines)

def gravar_resultado(card_id: str, extracted: dict, prompt_len: int):
    meta = {
        "ts": datetime.utcnow().isoformat() + "Z",
        "model": MODEL,
        "confianca": extracted.get("confianca"),
        "evidencia": extracted.get("evidencia"),
        "prompt_chars": prompt_len,
    }
    valor = extracted.get("valor_reais")
    if valor is not None:
        try:
            valor = float(valor)
        except (TypeError, ValueError):
            valor = None
        if valor is not None and (valor < MIN_SANE or valor > MAX_SANE):
            meta["descartado"] = f"fora de faixa ({valor})"
            valor = None

    patch = {"investimento_extraido_meta": meta, "investimento_extraido": valor}
    patch_json = json.dumps(patch).replace("'", "''")
    sql = f"""
        UPDATE kanban_cards
        SET details = COALESCE(details, '{{}}'::jsonb) || '{patch_json}'::jsonb,
            updated_at = NOW()
        WHERE id = '{card_id}'::uuid
    """
    psql_exec(sql, {})

# --- CLI --------------------------------------------------------------
def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--dias", type=int, default=30)
    ap.add_argument("--limit", type=int, default=0)
    ap.add_argument("--force", action="store_true")
    args = ap.parse_args()

    token = carregar_token()
    cards = puxar_qualificados(args.dias)
    print(f"qualificados {args.dias}d: {len(cards)}")
    if args.limit:
        cards = cards[: args.limit]

    ok = skip = erro = com_valor = 0
    for i, cid in enumerate(cards, 1):
        if not args.force and ja_processado(cid):
            skip += 1
            continue
        transcript = puxar_transcript(cid)
        if not transcript:
            skip += 1
            continue
        prompt = PROMPT + transcript[:12000]
        try:
            result = anthropic_call(prompt, token)
        except HTTPError as e:
            print(f"[{i}/{len(cards)}] {cid} HTTP {e.code}: {e.read()[:160]}")
            erro += 1
            time.sleep(2)
            continue
        except Exception as e:
            print(f"[{i}/{len(cards)}] {cid} ERR {e}")
            erro += 1
            continue
        try:
            gravar_resultado(cid, result, len(prompt))
        except Exception as e:
            print(f"[{i}/{len(cards)}] {cid} DB-ERR {e}")
            erro += 1
            continue
        valor = result.get("valor_reais")
        conf = result.get("confianca")
        if valor is not None:
            com_valor += 1
        ok += 1
        ev = (result.get("evidencia") or "")[:60]
        print(f"[{i}/{len(cards)}] {cid} -> R${valor} conf={conf}  ev='{ev}'")
        time.sleep(0.3)
    print(f"\nresumo: ok={ok} com_valor={com_valor} skip={skip} erro={erro}")

if __name__ == "__main__":
    main()
