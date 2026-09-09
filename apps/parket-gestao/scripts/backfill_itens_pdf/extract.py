#!/usr/bin/env python3
# ═══════════════════════════════════════════════════════════════════
# Backfill itens do gestao a partir dos PDFs de proposta anexados no
# Trello (02/09/2026, Will: "nao tem nem em anexos as propostas?" +
# "pode fazer tudo preciso disso no sistemas e depois atualizar no
# gestao os card la pra poder fazer a central do cliente bem feito").
# QUE FAZ: 158 cards abertos do board de projetos tem projeto gestao
# com ZERO itens e nenhuma sim no Valor (propostas da era pre-Valor,
# numeradas por OS). Os PDFs estao baixados em
# /root/projetos-app/data/anexos. Este script:
#   1. le worklist.json (gerado por SQL, 1 PDF por OS por card);
#   2. extrai o texto com pdftotext -layout;
#   3. manda pro Claude estruturar os itens no MODELO CERTO do gestao
#      (padrao hierarquico: 1 item por ambiente/produto agregando
#      produto+insumos+instalacao, NUNCA linha separada de insumo ou
#      instalacao; quantidade = metragem real; ambiente quando houver);
#   4. valida soma dos itens == total da proposta (tolerancia R$1)
#      e grava out/<trello_id>.json pra auditoria e pro apply.py.
# Token Anthropic: mesmo OAuth do gestao API (via /proc/1/environ do
# container, secret nao aparece em docker exec env normal).
# Idempotente: pula card que ja tem out/<id>.json com status ok.
# ═══════════════════════════════════════════════════════════════════
import json
import os
import re
import subprocess
import sys
import time
from concurrent.futures import ThreadPoolExecutor

import httpx

BASE = os.path.dirname(os.path.abspath(__file__))
ANEXOS_DIR = "/root/projetos-app/data/anexos"
OUT = os.path.join(BASE, "out")
MODEL = "claude-sonnet-4-6"
BETAS = "claude-code-20250219,oauth-2025-04-20,interleaved-thinking-2025-05-14"
BILLING = "x-anthropic-billing-header: cc_version=2.1.81; cc_entrypoint=api; cch=00000;"

SYSTEM = """Voce extrai itens de propostas comerciais antigas da Parket (pisos e marcenaria de madeira) a partir do texto de um PDF.

REGRAS DO MODELO (obrigatorias):
- 1 item por linha de produto da tabela de valores. Se a proposta separa ambientes, 1 item por ambiente.
- NUNCA crie item separado para insumos, instalacao, mao de obra ou frete: some esses valores na linha do produto correspondente (padrao da Parket: item agrega produto+insumos+instalacao).
- quantidade = metragem REAL em m2 (sem perda) quando o texto distinguir area real de area com perda; senao use a quantidade da tabela.
- Ignore linhas de total/subtotal e condicoes de pagamento.
- "somente material" => so_material true.

Responda SOMENTE com JSON valido neste formato:
{
  "total_proposta": 153720.00,
  "itens": [
    {
      "ambiente": "SALA" ou null,
      "categoria": "PISO" | "DECK" | "FORRO" | "PAINEL" | "PORTA" | "MARCENARIA" | "REVESTIMENTO" | "ESCADA" | "RODAPE" | "SERVICO" | "OUTRO",
      "produto": "header do produto em CAIXA ALTA, formato ESPECIE · DIMENSAO quando identificavel, ex: ASSOALHO CARVALHO EUROPEU NATURALLE",
      "descritivo": "texto original resumido da linha do produto",
      "quantidade": 308,
      "unidade": "m²" | "un" | "ml" | "vb",
      "valor_total": 138600.00,
      "so_material": false
    }
  ]
}
- total_proposta = total geral declarado no PDF (null se nao houver).
- A soma dos valor_total dos itens DEVE bater com total_proposta (distribua frete/descontos proporcionalmente nos itens se preciso).
- Numeros com ponto decimal, sem separador de milhar."""


def token() -> str:
    # token vivo do ai_accounts (EAS refresca); o secret do env fica vencido
    cid = subprocess.check_output(
        ["docker", "ps", "-q", "-f", "name=parket-ai-squad_postgres"], text=True
    ).split()[0]
    tok = subprocess.check_output(
        ["docker", "exec", cid, "psql", "-U", "parket", "-d", "parket_ai", "-tAc",
         "SELECT session_token FROM public.ai_accounts WHERE provider='claude' "
         "AND is_active AND is_healthy AND extra->>'auth_type'='oauth' "
         "ORDER BY last_used DESC NULLS LAST, updated_at DESC LIMIT 1"],
        text=True,
    ).strip()
    if not tok:
        raise SystemExit("token nao encontrado em ai_accounts")
    return tok


TOKEN = token()


def ask(text: str) -> dict:
    headers = {
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
        "authorization": f"Bearer {TOKEN}",
        "anthropic-beta": BETAS,
        "x-app": "cli",
        "user-agent": "claude-cli/2.1.81 (external, cli)",
        "anthropic-dangerous-direct-browser-access": "true",
    }
    body = {
        "model": MODEL,
        "max_tokens": 8192,  # proposta grande estourava 4096 e truncava o JSON
        "system": [{"type": "text", "text": BILLING}, {"type": "text", "text": SYSTEM}],
        "messages": [{"role": "user", "content": text}],
    }
    for tent in range(3):
        try:
            with httpx.Client(timeout=120.0) as h:
                r = h.post("https://api.anthropic.com/v1/messages", headers=headers, json=body)
            if r.status_code == 429 or r.status_code >= 500:
                time.sleep(15 * (tent + 1))
                continue
            r.raise_for_status()
            out = "".join(b.get("text", "") for b in r.json()["content"] if b.get("type") == "text")
            m = re.search(r"\{.*\}", out, re.S)
            return json.loads(m.group(0))
        except (json.JSONDecodeError, AttributeError):
            if tent == 2:
                raise
            time.sleep(5)
    raise RuntimeError("esgotou tentativas")


def pdf_text(path: str) -> str:
    full = os.path.join(ANEXOS_DIR, re.sub(r"^anexos/", "", path))
    txt = subprocess.run(
        ["pdftotext", "-layout", full, "-"], capture_output=True, text=True
    ).stdout
    return txt[:15000]


def processa(card: dict) -> dict:
    dst = os.path.join(OUT, f"{card['trello_id']}.json")
    if os.path.exists(dst):
        with open(dst) as f:
            if json.load(f).get("status") == "ok":
                return {"trello_id": card["trello_id"], "status": "skip"}
    docs, status, erro = [], "ok", None
    try:
        for ax in card["anexos"]:
            txt = pdf_text(ax["path"])
            if len(txt.strip()) < 100:
                docs.append({"os": ax["os"], "nome": ax["nome"], "status": "sem_texto"})
                continue
            data = ask(f"Proposta OS {ax['os']} do cliente {card['cliente']}:\n\n{txt}")
            soma = round(sum(i.get("valor_total") or 0 for i in data.get("itens", [])), 2)
            tot = data.get("total_proposta")
            div = None if tot is None else round(abs(soma - tot), 2)
            docs.append({
                "os": ax["os"], "nome": ax["nome"], "anexo_id": ax["anexo_id"],
                "status": "ok" if (div is None or div <= 1.0) and data.get("itens") else "revisar",
                "divergencia": div, "soma_itens": soma, **data,
            })
        if not any(d["status"] == "ok" for d in docs):
            status = "revisar"
    except Exception as e:  # card individual nao derruba o lote
        status, erro = "erro", str(e)
    res = {**card, "docs": docs, "status": status, "erro": erro}
    with open(dst, "w") as f:
        json.dump(res, f, ensure_ascii=False, indent=1)
    return {"trello_id": card["trello_id"], "status": status}


def main():
    with open(os.path.join(BASE, "worklist.json")) as f:
        cards = json.load(f)
    limite = int(sys.argv[1]) if len(sys.argv) > 1 else len(cards)
    # dedup por projeto (2 cards Trello podem resolver pro mesmo projeto gestao)
    vistos, fila = set(), []
    for c in cards:
        if c["projeto_id"] in vistos:
            continue
        vistos.add(c["projeto_id"])
        fila.append(c)
    fila = fila[:limite]
    print(f"{len(fila)} cards na fila")
    with ThreadPoolExecutor(max_workers=4) as ex:
        for i, r in enumerate(ex.map(processa, fila), 1):
            print(f"[{i}/{len(fila)}] {r['trello_id']} {r['status']}", flush=True)


if __name__ == "__main__":
    main()
