#!/usr/bin/env python3
# ═══════════════════════════════════════════════════════════════════
# Fold pos-rodada-2: a auditoria (audit_retry.py) achou 5 docs onde o
# Claude criou linha SERVICO separada de FRETE/LOGISTICA, violando o
# modelo hierarquico da Parket (frete/logistica NUNCA e linha; soma
# proporcional nos produtos, igual foi feito na rodada 1).
# QUE FAZ: pra cada out/<id>.json alvo, remove a(s) linha(s) SERVICO
# cujo produto bate em frete/logistica e redistribui o valor
# proporcionalmente nos itens restantes DO MESMO DOC (arredonda 2
# casas, resto vai no ultimo item, entao a soma nao muda).
# Recalcula soma_itens/divergencia e regrava o JSON.
# Idempotente: rodar de novo nao acha mais linha pra dobrar.
# ═══════════════════════════════════════════════════════════════════
import json
import os
import re

BASE = os.path.dirname(os.path.abspath(__file__))
RE_FOLD = re.compile(r"\b(frete|log[ií]stica)\b", re.I)

ALVOS = [
    "681ca3122b5e5803275f676c",  # CASA JAZZ, FRETE 10500
    "68a776858f3747b78daec237",  # FERNANDO BRAVO, LOGISTICA 41549.24
    "691e036cd04245716d6690bd",  # MATHEUS BELEZA, LOGISTICA 24743
    "6978b3cb4acaab2547e155e8",  # GABRIELA GOMES, LOGISTICA 3675.33
    "6a43a9f5b1daef7e4813e54d",  # CONSOLACAO INCORP, LOGISTICA 9068.62
]

for tid in ALVOS:
    path = os.path.join(BASE, "out", f"{tid}.json")
    card = json.load(open(path))
    mudou = False
    for doc in card.get("docs", []):
        if doc.get("status") != "ok":
            continue
        itens = doc.get("itens", [])
        fold = [i for i in itens
                if (i.get("categoria") or "").upper() == "SERVICO"
                and RE_FOLD.search(i.get("produto") or "")]
        if not fold:
            continue
        resto = [i for i in itens if i not in fold]
        extra = sum(i.get("valor_total") or 0 for i in fold)
        base_soma = sum(i.get("valor_total") or 0 for i in resto)
        if not resto or base_soma <= 0:
            print(f"PULA {card['cliente']}: sem base pra ratear")
            continue
        # rateio proporcional, resto do arredondamento no ultimo item
        acc = 0.0
        for i in resto[:-1]:
            add = round(extra * (i["valor_total"] / base_soma), 2)
            i["valor_total"] = round(i["valor_total"] + add, 2)
            acc += add
        resto[-1]["valor_total"] = round(resto[-1]["valor_total"] + extra - acc, 2)
        doc["itens"] = resto
        soma = round(sum(i.get("valor_total") or 0 for i in resto), 2)
        tot = doc.get("total_proposta")
        doc["soma_itens"] = soma
        doc["divergencia"] = None if tot is None else round(abs(soma - tot), 2)
        mudou = True
        print(f"FOLD {card['cliente']}: R${extra} em {len(resto)} itens, "
              f"nova soma={soma} div={doc['divergencia']}")
    if mudou:
        with open(path, "w") as f:
            json.dump(card, f, ensure_ascii=False, indent=1)
    else:
        print(f"nada a dobrar em {card['cliente']}")
