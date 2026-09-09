#!/usr/bin/env python3
# ═══════════════════════════════════════════════════════════════════
# Rodada 2 do backfill: reprocessa os cards que ficaram revisar/erro
# na extracao por texto (02/09/2026, Will: "esses que faltou nao
# consegue fazer?").
# QUE FAZ: pega todo out/<id>.json com status != ok e re-extrai
# mandando o PDF INTEIRO base64 como document block (vision) pro
# Claude, em vez de pdftotext. Isso cobre os 3 grupos de falha:
#   - 18 PDFs escaneados sem camada de texto (vision le o scan);
#   - 2 JSONs truncados (max_tokens 16384 aqui vs 8192 na rodada 1);
#   - 12 docs com soma != total: o prompt ganha um aviso com a
#     divergencia da rodada 1 pra procurar desconto/linha faltante.
# Mesmo formato de saida da rodada 1 (sobrescreve out/<id>.json),
# entao o apply.py roda em cima sem mudanca. Todos os PDFs alvo tem
# <= 12 paginas e <= 3.3MB, dentro do limite da API.
# Reusa token()/SYSTEM/BILLING/BETAS do extract.py.
# ═══════════════════════════════════════════════════════════════════
import base64
import glob
import json
import os
import re
import time
from concurrent.futures import ThreadPoolExecutor

import httpx

import extract  # SYSTEM, BILLING, BETAS, TOKEN, ANEXOS_DIR

BASE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(BASE, "out")
MODEL = extract.MODEL


def ask_pdf(pdf_path: str, prompt: str) -> dict:
    # manda o PDF como document block; vision cobre paginas escaneadas
    with open(pdf_path, "rb") as f:
        b64 = base64.b64encode(f.read()).decode()
    headers = {
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
        "authorization": f"Bearer {extract.TOKEN}",
        "anthropic-beta": extract.BETAS + ",pdfs-2024-09-25",
        "x-app": "cli",
        "user-agent": "claude-cli/2.1.81 (external, cli)",
        "anthropic-dangerous-direct-browser-access": "true",
    }
    body = {
        "model": MODEL,
        "max_tokens": 16384,  # CASA JAZZ/SAMBA truncavam em 8192
        "system": [{"type": "text", "text": extract.BILLING},
                   {"type": "text", "text": extract.SYSTEM}],
        "messages": [{"role": "user", "content": [
            {"type": "document",
             "source": {"type": "base64", "media_type": "application/pdf", "data": b64}},
            {"type": "text", "text": prompt},
        ]}],
    }
    for tent in range(3):
        try:
            with httpx.Client(timeout=300.0) as h:
                r = h.post("https://api.anthropic.com/v1/messages", headers=headers, json=body)
            if r.status_code == 429 or r.status_code >= 500:
                time.sleep(20 * (tent + 1))
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


def processa(card: dict) -> dict:
    # card = worklist + divergencias da rodada 1 (em card['_prev'])
    docs, status, erro = [], "ok", None
    try:
        for ax in card["anexos"]:
            full = os.path.join(extract.ANEXOS_DIR, re.sub(r"^anexos/", "", ax["path"]))
            prompt = f"Proposta OS {ax['os']} do cliente {card['cliente']}. Extraia os itens do PDF anexo."
            prev = card["_prev"].get(str(ax["os"]))
            if prev and prev.get("divergencia"):
                prompt += (f"\nATENCAO: uma extracao anterior somou R${prev['soma_itens']} mas o "
                           f"total declarado era R${prev.get('total_proposta')} (diferenca "
                           f"R${prev['divergencia']}). Procure com cuidado descontos, frete, "
                           "linhas esquecidas ou total de outra pagina; a soma DEVE bater.")
            data = ask_pdf(full, prompt)
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
    res = {k: v for k, v in card.items() if k != "_prev"}
    res.update({"docs": docs, "status": status, "erro": erro})
    with open(os.path.join(OUT, f"{card['trello_id']}.json"), "w") as f:
        json.dump(res, f, ensure_ascii=False, indent=1)
    return {"cliente": card["cliente"], "status": status,
            "docs": [(d["status"], d.get("divergencia")) for d in docs]}


def main():
    wl = {c["trello_id"]: c for c in json.load(open(os.path.join(BASE, "worklist.json")))}
    fila = []
    for f in sorted(glob.glob(os.path.join(OUT, "*.json"))):
        with open(f) as fh:
            old = json.load(fh)
        if old.get("status") == "ok":
            continue
        card = dict(wl[old["trello_id"]])
        card["_prev"] = {str(d.get("os")): d for d in old.get("docs", [])}
        fila.append(card)
    print(f"{len(fila)} cards na rodada 2 (vision)")
    with ThreadPoolExecutor(max_workers=3) as ex:
        for i, r in enumerate(ex.map(processa, fila), 1):
            print(f"[{i}/{len(fila)}] {r['cliente'][:40]:42} {r['status']} {r['docs']}", flush=True)


if __name__ == "__main__":
    main()
