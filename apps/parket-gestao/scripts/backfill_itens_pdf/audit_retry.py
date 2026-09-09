#!/usr/bin/env python3
# ═══════════════════════════════════════════════════════════════════
# Auditoria de qualidade da rodada 2 (02/09/2026, Will: "fecho tem
# que ser bem feito as lista de item com metragem ambiente material
# bem feito como no sistema").
# QUE FAZ: pra cada out/<id>.json que a rodada 2 tocou (docs ok),
# imprime a lista completa de itens (ambiente, categoria, produto,
# qtd+unidade, valor) e aponta red flags ANTES do apply:
#   - item sem ambiente quando outros do mesmo doc tem;
#   - quantidade 0 ou nula em item de m2/ml;
#   - produto vazio, generico (so a categoria) ou sem especie;
#   - linha que parece insumo/instalacao/frete (viola o modelo);
#   - divergencia soma != total ainda aberta.
# Nao escreve nada: e leitura pra decidir o que entra no apply.
# ═══════════════════════════════════════════════════════════════════
import glob
import json
import os
import re
import sys

BASE = os.path.dirname(os.path.abspath(__file__))
RE_PROIBIDO = re.compile(r"\b(insumos?|instala[cç][aã]o|m[aã]o de obra|frete|log[ií]stica)\b", re.I)

ids = sys.argv[1:]  # opcional: restringir a trello_ids
flags_total = 0
for f in sorted(glob.glob(os.path.join(BASE, "out", "*.json"))):
    card = json.load(open(f))
    if ids and card["trello_id"] not in ids:
        continue
    if card.get("status") != "ok":
        continue
    docs_ok = [d for d in card.get("docs", []) if d.get("status") == "ok"]
    if not docs_ok:
        continue
    print(f"\n=== {card['cliente']} ({card['trello_id']})")
    for d in docs_ok:
        itens = d.get("itens", [])
        tem_amb = sum(1 for i in itens if i.get("ambiente"))
        print(f"  doc OS {d.get('os')} total={d.get('total_proposta')} "
              f"soma={d.get('soma_itens')} div={d.get('divergencia')} "
              f"itens={len(itens)} com_ambiente={tem_amb}")
        for i in itens:
            flags = []
            un = i.get("unidade") or "un"
            if not i.get("ambiente") and tem_amb:
                flags.append("SEM_AMBIENTE")
            if un in ("m²", "ml") and not i.get("quantidade"):
                flags.append("QTD_ZERO")
            prod = (i.get("produto") or "").strip()
            if not prod or prod.upper() == (i.get("categoria") or "").upper():
                flags.append("PRODUTO_GENERICO")
            if RE_PROIBIDO.search(prod) or RE_PROIBIDO.search(i.get("descritivo") or ""):
                flags.append("LINHA_PROIBIDA")
            flags_total += len(flags)
            fl = (" <<< " + ",".join(flags)) if flags else ""
            print(f"    [{i.get('categoria')}] {i.get('ambiente') or '-':22.22} "
                  f"{prod[:44]:46} {i.get('quantidade')} {un} R${i.get('valor_total')}{fl}")
print(f"\nred flags: {flags_total}")
