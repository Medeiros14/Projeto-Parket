#!/usr/bin/env python3
"""Migra chaves de meta.definicoes.respostas do formato legado
    "Item X.Y · Ambiente|Pergunta"
para o formato novo por serviço
    "SERVIÇO|Pergunta"  (SERVIÇO ∈ PISO/DECK/FORRO/PAINEL)

Reduz várias respostas de itens do mesmo serviço em uma só (maioria).
Gera relatório CSV dos conflitos (>1 resposta diferente pro mesmo par
serviço|pergunta no mesmo projeto). Rodar dry-run primeiro; usar --apply
pra gravar (mantém as chaves antigas por segurança — o loader do Draw
tem backcompat e prefere a nova).

Uso:
  python3 migrar_definicoes_por_servico.py              # dry-run + CSV
  python3 migrar_definicoes_por_servico.py --apply      # grava
  python3 migrar_definicoes_por_servico.py --pid=UUID   # 1 projeto só
"""
import argparse
import csv
import json
import re
import sys
import unicodedata
from collections import Counter, defaultdict
from datetime import datetime
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from app.db import conn  # type: ignore

SECAO_RE = re.compile(r"^item\s+(?P<numero>\d+(?:\.\d+)*)\s*[·\-]\s*(?P<ambiente>.+)$", re.I)

# mesmo mapeamento serviço → keywords do Draw (anteprojeto_defs.py)
SERVICOS = {
    "PISO":   ("piso", "assoalho"),
    "DECK":   ("deck",),
    "FORRO":  ("forro",),
    "PAINEL": ("painel", "painei"),
}


def _norm(s: str) -> str:
    s = unicodedata.normalize("NFKD", s or "").encode("ascii", "ignore").decode()
    return re.sub(r"\s+", " ", s).strip().lower()


def servico_da_cat(cat: str) -> str | None:
    c = _norm(cat or "")
    for serv, keys in SERVICOS.items():
        if any(k in c for k in keys):
            return serv
    return None


def codigo_item(it: dict) -> str:
    """Espelha frontend/src/components/ItensContratados.tsx:codigoItem."""
    meta = it.get("meta") or {}
    if meta.get("codigo"):
        return meta["codigo"]
    desc = it.get("descritivo") or ""
    m = re.match(r"^(\d+(?:\.\d+)?)", desc)
    if m:
        return m.group(1)
    ordem = it.get("ordem") or 0
    v = ordem / 10 or ordem
    # frontend usa String(int|float) → replica
    return str(int(v)) if isinstance(v, (int,)) or (isinstance(v, float) and v.is_integer()) else str(v)


def carrega_itens_por_projeto(pid: str) -> list[dict]:
    with conn() as c, c.cursor() as cur:
        cur.execute("""
            SELECT id::text, ordem, categoria, descritivo, ambiente, meta, status
              FROM gestao.itens
             WHERE projeto_id::text = %s
        """, (pid,))
        return list(cur.fetchall())


def carrega_projetos_com_definicoes() -> list[dict]:
    with conn() as c, c.cursor() as cur:
        cur.execute("""
            SELECT pe.projeto_id::text AS pid, pe.meta, p.cliente
              FROM gestao.projeto_etapas pe
              JOIN gestao.projetos p ON p.id = pe.projeto_id
             WHERE pe.etapa_numero = 12
               AND pe.meta ? 'definicoes'
        """)
        return list(cur.fetchall())


def migrar_projeto(pid: str, cliente: str, meta: dict,
                   conflitos_csv: list[list], dry: bool) -> tuple[int, int]:
    """Retorna (chaves_migradas, conflitos_no_projeto)."""
    defs = (meta or {}).get("definicoes") or {}
    respostas = defs.get("respostas") or {}
    if not respostas:
        return 0, 0

    itens = carrega_itens_por_projeto(pid)
    # cache item por (codigo, ambiente_norm) → serviço
    item_to_serv: dict[tuple[str, str], str | None] = {}
    for it in itens:
        cod = codigo_item(it)
        amb = _norm(it.get("ambiente") or it.get("categoria") or "")
        raiz = (it.get("meta") or {}).get("categoria_raiz") or it.get("categoria") or ""
        item_to_serv[(cod, amb)] = servico_da_cat(raiz)

    # agrupa: (servico, pergunta) → Counter de respostas
    grupo: dict[tuple[str, str], Counter] = defaultdict(Counter)
    fontes: dict[tuple[str, str], list[str]] = defaultdict(list)
    passa_direto: dict[str, dict] = {}  # chaves que não são "Item X.Y" ficam como estão

    for chave, valor in respostas.items():
        if not isinstance(chave, str) or "|" not in chave:
            passa_direto[chave] = valor
            continue
        secao, _, pergunta = chave.partition("|")
        secao = secao.strip()
        # já é chave por serviço? preserva.
        if secao.upper() in SERVICOS:
            passa_direto[chave] = valor
            continue
        m = SECAO_RE.match(secao)
        if not m:
            passa_direto[chave] = valor
            continue
        numero = m.group("numero")
        ambiente = m.group("ambiente").strip()
        amb_n = _norm(ambiente)
        serv = item_to_serv.get((numero, amb_n)) or item_to_serv.get((numero, ""))
        if not serv:
            # fallback: qq item com esse número
            for (cod, _), s in item_to_serv.items():
                if cod == numero and s:
                    serv = s
                    break
        if not serv:
            # não conseguiu mapear — deixa a chave antiga
            passa_direto[chave] = valor
            continue
        resp_txt = (valor.get("resposta") if isinstance(valor, dict) else valor) or ""
        if not resp_txt:
            continue
        grupo[(serv, pergunta)][resp_txt] += 1
        fontes[(serv, pergunta)].append(chave)

    novas: dict[str, dict] = {}
    conflitos = 0
    for (serv, pergunta), cnt in grupo.items():
        top, top_n = cnt.most_common(1)[0]
        chave_nova = f"{serv}|{pergunta}"
        # se conflito, escolhe a mais frequente + loga
        if len(cnt) > 1:
            conflitos += 1
            for resp, n in cnt.items():
                conflitos_csv.append([pid, cliente, serv, pergunta, resp, n,
                                      "MAJORITARIA" if resp == top else "descartada",
                                      "; ".join(fontes[(serv, pergunta)])])
        # reaproveita metadados da primeira resposta original (por/em)
        original = respostas.get(fontes[(serv, pergunta)][0])
        if isinstance(original, dict):
            novas[chave_nova] = {**original, "resposta": top}
        else:
            novas[chave_nova] = {"resposta": top}

    if not novas:
        return 0, conflitos

    if dry:
        return len(novas), conflitos

    # mescla: novas por serviço + passa_direto (mantém legado por segurança)
    respostas_final = {**passa_direto, **novas}
    defs_novo = {**defs, "respostas": respostas_final,
                 "_migrado_por_servico_em": datetime.utcnow().isoformat() + "Z"}
    meta_novo = {**(meta or {}), "definicoes": defs_novo}

    with conn() as c, c.cursor() as cur:
        cur.execute("""
            UPDATE gestao.projeto_etapas
               SET meta = %s::jsonb, updated_at = now()
             WHERE projeto_id::text = %s AND etapa_numero = 12
        """, (json.dumps(meta_novo), pid))
    return len(novas), conflitos


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--apply", action="store_true",
                    help="Grava as chaves novas (default: dry-run)")
    ap.add_argument("--pid", default=None,
                    help="Migra 1 projeto só (uuid) em vez de varredura")
    ap.add_argument("--csv", default="/root/migrar-defs-conflitos.csv",
                    help="Path do CSV de conflitos")
    args = ap.parse_args()

    if args.pid:
        with conn() as c, c.cursor() as cur:
            cur.execute("""
                SELECT pe.projeto_id::text AS pid, pe.meta, p.cliente
                  FROM gestao.projeto_etapas pe
                  JOIN gestao.projetos p ON p.id = pe.projeto_id
                 WHERE pe.projeto_id::text = %s AND pe.etapa_numero = 12
            """, (args.pid,))
            projs = list(cur.fetchall())
    else:
        projs = carrega_projetos_com_definicoes()

    print(f"[migrar-defs] {len(projs)} projeto(s) com definições · "
          f"{'APLICANDO' if args.apply else 'DRY-RUN'}")

    conflitos_csv: list[list] = [
        ["projeto_id", "cliente", "servico", "pergunta", "resposta",
         "ocorrencias", "decisao", "chaves_origem"]
    ]
    tot_novas = tot_conflitos = tot_projetos = 0
    for p in projs:
        pid = p["pid"]; cliente = p.get("cliente") or ""
        try:
            novas, conflitos = migrar_projeto(pid, cliente, p["meta"] or {},
                                              conflitos_csv, dry=not args.apply)
        except Exception as e:
            print(f"  FALHOU pid={pid} cliente={cliente[:40]}: {e}")
            continue
        if novas > 0 or conflitos > 0:
            tot_projetos += 1
            tot_novas += novas
            tot_conflitos += conflitos
            print(f"  {cliente[:50]:<50} pid={pid[:8]} · {novas} chaves · "
                  f"{conflitos} conflito(s)")

    print(f"\n[migrar-defs] {tot_projetos} projeto(s) mexidos · "
          f"{tot_novas} chaves migradas · {tot_conflitos} conflito(s)")

    if len(conflitos_csv) > 1:
        with open(args.csv, "w", newline="") as f:
            w = csv.writer(f); w.writerows(conflitos_csv)
        print(f"[migrar-defs] Relatório de conflitos: {args.csv}")


if __name__ == "__main__":
    main()
