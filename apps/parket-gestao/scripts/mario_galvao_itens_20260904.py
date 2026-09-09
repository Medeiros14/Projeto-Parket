"""Monta gestao.itens do MARIO DE QUEIROZ GALVAO NETO a partir da proposta Valoria.

O projeto estava com 13 linhas agregadas vindas do PDF do contrato Trello OS 2208
(origem=contrato_trello_os2208), sem ambiente e com quantidade zerada em metade
delas, o que deixava a Central sem cronograma util.

Fonte correta: sim 10890 (ops.simulacoes a1398ab2 no Supabase da Valoria), que e a
consolidacao da proposta original (sim 10643) com o aditivo REV02 (sim 10689):
os 13 codigos PM sao os mesmos da 10643 e os PL13-PL17 + closet laca + revestimento
dos 04 pilares + piso rouparia + forro hall sao os mesmos do 10689.

As dimensoes de cada porta so existem no nome do ambiente das sims 10643/10689,
entao elas sao cruzadas pelo codigo (PM03, PL13...) para enriquecer o descritivo.

Uso: python3 mario_galvao_itens_20260904.py > mario_galvao_itens_20260904.sql
"""
from __future__ import annotations

import json
import re
import sys
import urllib.request

SUPA_URL = "https://skbjmlzgaeupflujomzw.supabase.co"
PROJETO_ID = "58f5812d-f594-45e1-8001-41586598c988"

SIM_CONSOLIDADA = "a1398ab2-af83-45f4-98fd-ae2e6d142673"  # 10890
SIM_ORIGINAL = "be51c8d9-2f94-467f-a1b9-8bdd0ebec01a"     # 10643
SIM_ADITIVO = "ac8bfdcf-a4f9-4a72-a911-1cc82e4bb8c1"      # 10689

# ordem dos blocos na Central: 1 PAINEL, 2 PORTA, 3 PISO, 4 FORRO, 5 REVESTIMENTO
BLOCOS = ["PAINEL", "PORTA", "PISO", "FORRO", "REVESTIMENTO", "MARCENARIA"]


def api(key: str, path: str):
    req = urllib.request.Request(
        f"{SUPA_URL}/rest/v1/{path}",
        headers={"apikey": key, "Authorization": f"Bearer {key}",
                 "Accept-Profile": "ops"})
    return json.load(urllib.request.urlopen(req))


def sql_str(v) -> str:
    if v is None:
        return "NULL"
    return "'" + str(v).replace("'", "''") + "'"


def num(v) -> str:
    return "0" if v is None else str(v)


DIM_RE = re.compile(r"(\d+[,.]\d+\s*x\s*\d+[,.]\d+)", re.I)
COD_RE = re.compile(r"\b(P[ML]\d{2})\b")


def dims_por_codigo(key: str) -> dict[str, str]:
    """PM03 -> "0,90x2,70": a medida so aparece no nome do ambiente das sims antigas."""
    out: dict[str, str] = {}
    for sid in (SIM_ORIGINAL, SIM_ADITIVO):
        for amb in api(key, f"ambientes?simulacao_id=eq.{sid}&select=nome"):
            nome = amb.get("nome") or ""
            cod = COD_RE.search(nome)
            dims = DIM_RE.findall(nome)
            if cod and dims:
                out[cod.group(1)] = " + ".join(d.replace(" ", "") for d in dims)
    return out


def produto(it: dict) -> str:
    """Cabecalho do produto: subtipo + especie + cor, sem repetir termo."""
    partes = []
    for p in (it.get("subtipo"), it.get("especie_nome"), it.get("cor")):
        p = (p or "").strip().upper()
        if p == "LAMINA":
            p = "LÂMINA"
        if p and p not in partes:
            partes.append(p)
    return " ".join(partes)


def linha_porta(it: dict, dims: dict[str, str]) -> tuple[str, str, str]:
    """(header, descricao_extra, descritivo_original) da porta a partir do texto livre."""
    txt = (it.get("descritivo") or "").strip()
    cod_m = COD_RE.search(txt)
    cod = cod_m.group(1) if cod_m else ""
    tipo = txt.split(" - ", 1)[1] if " - " in txt else txt
    tipo = re.sub(r"^porta\s+", "", tipo, flags=re.I).strip().upper()
    dim = dims.get(cod, "")
    header = " · ".join(x for x in (cod, tipo or "PORTA", produto(it)) if x)
    return header, dim, txt


def main() -> None:
    key = open("/tmp/vk.txt").read().strip()
    dims = dims_por_codigo(key)
    ambientes = {a["id"]: a for a in
                 api(key, f"ambientes?simulacao_id=eq.{SIM_CONSOLIDADA}&select=*")}
    itens = api(key, f"simulacao_itens?simulacao_id=eq.{SIM_CONSOLIDADA}&select=*&order=ordem")

    linhas = []
    for it in itens:
        cat = (it.get("categoria") or "").upper()
        amb = (ambientes.get(it.get("ambiente_id")) or {}).get("nome") or ""
        desc_extra = ""
        original = it.get("descritivo") or ""

        if cat == "PORTA":
            header, desc_extra, original = linha_porta(it, dims)
            qtd, uni = 1, "un"
        elif (it.get("subtipo") or "") == "recortes":
            # descritivo vem como __RECDATA__:[{nome, qtd, unidade, preco_unit}]
            recs = json.loads(original.split("__RECDATA__:", 1)[1]) if "__RECDATA__:" in original else []
            header = "RECORTES · " + ", ".join(f"{r['qtd']}x {r['nome']}" for r in recs)
            original = header
            qtd = sum(int(r.get("qtd") or 0) for r in recs) or 1
            uni = "un"
        else:
            header = produto(it)
            qtd, uni = it.get("metragem_informada") or 0, "m²"

        linhas.append({"cat": cat, "amb": amb, "header": header, "qtd": qtd,
                       "uni": uni, "desc_extra": desc_extra, "original": original,
                       "it": it})

    linhas.sort(key=lambda l: (BLOCOS.index(l["cat"]) if l["cat"] in BLOCOS else 99,
                               l["it"].get("ordem") or 0))

    print("BEGIN;")
    # as 13 linhas antigas vieram em duas levas do mesmo PDF: contrato + cronograma
    print(f"DELETE FROM gestao.itens WHERE projeto_id = '{PROJETO_ID}'")
    print("   AND meta->>'origem' IN ('contrato_trello_os2208', 'cronograma_pdf');")
    print()

    bloco, seq, total = 0, 0, 0.0
    cat_atual = None
    for l in linhas:
        if l["cat"] != cat_atual:
            cat_atual, bloco, seq = l["cat"], bloco + 1, 0
        seq += 1
        codigo = f"{bloco}.{seq}"
        it = l["it"]
        vt = float(it.get("valor_total") or 0)
        total += vt
        descritivo = f"{codigo} · {l['cat']} {l['header']}".strip()
        meta = {
            "codigo": codigo,
            "raiz": str(bloco),
            "categoria_raiz": l["cat"],
            "produto_header": l["header"],
            "descricao_extra": l["desc_extra"] or None,
            "descritivo_original": l["original"] or None,
            "metragem_real": it.get("metragem_informada"),
            "perda_pct": it.get("perda_pct"),
            "so_material": not float(it.get("valor_instalacao") or 0),
            "valor_produto": it.get("valor_material"),
            "valor_insumos": it.get("valor_insumos"),
            "valor_instalacao": it.get("valor_instalacao"),
            "origem": "valoria_sim_10890",
            "valoria_simulacao_id": SIM_CONSOLIDADA,
            "obra": {"qtd_instalada": 0,
                     "pre_conclusao": {"status": "pendente", "qtd_instalada": 0}},
        }
        print("INSERT INTO gestao.itens (projeto_id, simulacao_item_id, ordem, categoria,"
              " descritivo, ambiente, quantidade, unidade, valor_unit, valor_total,"
              " status, meta) VALUES (")
        print(f"  '{PROJETO_ID}', '{it['id']}', {bloco * 100 + seq}, {sql_str(l['cat'])},")
        print(f"  {sql_str(descritivo)}, {sql_str(l['amb'] or None)},"
              f" {num(l['qtd'])}, {sql_str(l['uni'])},")
        print(f"  {num(it.get('preco_unitario'))}, {vt},"
              f" 'pendente', {sql_str(json.dumps(meta, ensure_ascii=False))}::jsonb);")

    print()
    print(f"-- {len(linhas)} itens, soma R$ {total:,.2f}")
    print("COMMIT;")


if __name__ == "__main__":
    main()
