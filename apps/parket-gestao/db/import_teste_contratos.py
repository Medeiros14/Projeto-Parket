#!/usr/bin/env python3
"""Popular gestao.parket.works com 5 contratos de teste (CSV do financeiro).

Insere em gestao.projetos + gestao.itens + gestao.projeto_etapas + gestao.item_etapa_status
+ gestao.eventos (evento 'criado' de auditoria).

Todos os projetos ficam com:
- gestor_email = logistica2@parket.com.br (Natalia — Acompanhamento de Obras)
- column_id = 'projeto' (primeira coluna do kanban)
- status = 'novo'
- marca details.meta.seed = 'seed:contratos_v2' pra permitir purge

Como executa: docker exec no container parket-pg-local rodando psql via stdin.
"""
import csv, json, subprocess, sys, re, uuid, os
from decimal import Decimal
from collections import defaultdict

CSV_PATH = "/root/contratos_parket_metragens_v2.csv"
GESTOR_EMAIL = "logistica2@parket.com.br"  # Natalia
COLUMN_ID = "entrada"  # Espelha PMO/Produtividade do Space (dept da Natalia)
SEED_TAG = "seed:contratos_v2"
PG_CONTAINER = subprocess.check_output(
    ["docker", "ps", "-q", "-f", "name=parket-pg-local"], text=True
).strip().split("\n")[0]


def psql(sql: str) -> str:
    """Executa SQL via docker exec + psql -tA. Retorna stdout (linhas TAB-separadas)."""
    r = subprocess.run(
        ["docker", "exec", "-i", PG_CONTAINER, "psql", "-U", "postgres", "-tA", "-F", "\t"],
        input=sql, capture_output=True, text=True,
    )
    if r.returncode != 0:
        print(f"[psql-err] {r.stderr[:500]}", file=sys.stderr)
        print(f"[sql] {sql[:400]}", file=sys.stderr)
        raise SystemExit(1)
    return r.stdout


def q(s):
    """Quote pra SQL literal ('' escape)."""
    if s is None or (isinstance(s, str) and not s.strip()):
        return "NULL"
    return "'" + str(s).replace("'", "''") + "'"


def parse_num(v):
    if not v or not str(v).strip():
        return None
    v = str(v).strip()
    if "," in v:
        v = v.replace(".", "").replace(",", ".")
    try:
        return Decimal(v)
    except Exception:
        return None


def csv_categoria(desc):
    d = (desc or "").upper()
    if "DECK" in d: return "DECK"
    if "ESCADA" in d: return "ESCADA"
    return "PISO"


def load_csv():
    """Agrupa CSV em {(cliente, contrato): {'headers': {raiz: {...}}, 'itens': [...]}}.

    Um contrato pode ter N produtos-pai (ex: G7 = 1 PISO + 2 ESCADA). Cada folha
    carrega o produto_header da sua raiz (código antes do primeiro ponto).
    Aceita folhas sem metragem — quantidade = 0, campos meta.metragem_* = None.
    """
    grupos = defaultdict(lambda: {"headers": {}, "itens": []})
    with open(CSV_PATH, encoding="utf-8-sig") as f:
        for row in csv.DictReader(f):
            cli = row["Cliente"].strip()
            con = row["Contrato/Proposta"].strip()
            item = row["Item"].strip()
            desc_item = row["Descricao_Item"].strip()
            amb = row["Ambiente/Descritivo"].strip()
            m_perda = parse_num(row.get("Metragem_com_perda_m2"))
            m_real = parse_num(row.get("Metragem_real_m2"))
            obs = row.get("Observacao", "").strip() or None
            key = (cli, con)

            # Nível 0 = header do produto — indexado por código raiz ("1", "2", ...)
            if re.fullmatch(r"\d+", item):
                grupos[key]["headers"][item] = {
                    "produto": amb,
                    "categoria": csv_categoria(desc_item),
                    "categoria_csv": desc_item,
                    "metragem_total": m_perda or Decimal("0"),
                    "obs": obs,
                }
                continue

            # Folha = qualquer item com "." no código, mesmo sem metragem preenchida.
            # Ex: G7 item 2.1 "Revestimento de Escada" chega sem m² definido.
            raiz = item.split(".")[0]
            m_folha = m_real if m_real is not None else m_perda
            grupos[key]["itens"].append({
                "codigo": item,
                "raiz": raiz,
                "ambiente": amb,
                "categoria_csv": desc_item,
                "metragem_real": m_real,
                "metragem_com_perda": m_perda,
                "quantidade": m_folha if m_folha is not None else Decimal("0"),
                "obs": obs,
            })
    return grupos


def main():
    grupos = load_csv()
    total_itens = sum(len(g["itens"]) for g in grupos.values())
    print(f"[csv] {len(grupos)} contratos, {total_itens} itens-folha")

    # Purga anteriores
    print("[purge] Removendo projetos de teste anteriores…")
    psql(f"DELETE FROM gestao.projetos WHERE meta->>'seed' = '{SEED_TAG}';")

    n_proj = n_iten = n_iestat = 0

    for (cli, con), g in grupos.items():
        headers = g["headers"]
        itens = g["itens"]
        if not itens:
            print(f"[skip] {cli} · {con}: sem itens")
            continue

        # Header "principal" = raiz "1" ou primeiro disponível (só pra meta do projeto).
        raizes_ord = sorted(headers.keys(), key=lambda x: int(x))
        header_principal = headers[raizes_ord[0]] if raizes_ord else {
            "produto": "", "categoria": "PISO", "categoria_csv": "PISO",
            "metragem_total": Decimal("0"), "obs": None,
        }

        projeto_id = str(uuid.uuid4())
        valor_total = sum(i["quantidade"] for i in itens) * 100  # placeholder R$100/m²

        meta = json.dumps({
            "seed": SEED_TAG,
            "produto_header": header_principal["produto"],
            "produtos_por_raiz": {r: headers[r]["produto"] for r in raizes_ord},
            "categoria_csv": header_principal["categoria_csv"],
            "metragem_com_perda_total": str(header_principal["metragem_total"]),
            "obs_header": header_principal["obs"],
        })

        # 1) Projeto
        psql(f"""
            INSERT INTO gestao.projetos
              (id, cliente, obra_code, numero_proposta, orcamentista, gestor_email,
               valor_total, status, column_id, ordem_coluna, assinado_em, meta)
            VALUES
              ({q(projeto_id)}, {q(cli)}, {q(con)}, {q(con)}, {q('Raniere Brito')}, {q(GESTOR_EMAIL)},
               {float(valor_total)}, 'novo', {q(COLUMN_ID)}, 0, now(), '{meta}'::jsonb);
        """)
        n_proj += 1

        # 2) Etapas do projeto (9)
        psql(f"""
            INSERT INTO gestao.projeto_etapas (projeto_id, etapa_numero, status)
            SELECT {q(projeto_id)}::uuid, numero, 'pendente' FROM gestao.etapas_catalogo
            ON CONFLICT DO NOTHING;
        """)

        # 3) Itens (1:1 com folhas do CSV) + item_etapa_status
        # Batch INSERT pra ser rápido
        values_itens = []
        values_iestat = []
        item_ids = []
        for idx, it in enumerate(itens, start=1):
            item_id = str(uuid.uuid4())
            item_ids.append(item_id)
            # Header do produto correspondente à raiz do item ("2.1" → header "2")
            header_do_item = headers.get(it["raiz"], header_principal)
            categoria_item = header_do_item["categoria"]
            produto_do_item = header_do_item["produto"]
            descritivo = f"{it['codigo']} · {produto_do_item}" if produto_do_item else it['codigo']
            item_meta = {
                "codigo": it["codigo"],
                "raiz": it["raiz"],
                "produto_header": produto_do_item,       # nome do produto (ex "PISO CARVALHO...")
                "categoria_raiz": categoria_item,        # PISO/DECK/ESCADA
                "metragem_real": (str(it["metragem_real"]) if it["metragem_real"] is not None else None),
                "metragem_com_perda": (str(it["metragem_com_perda"]) if it["metragem_com_perda"] is not None else None),
                "categoria_csv": it["categoria_csv"],
                "obs": it["obs"],
            }
            values_itens.append(
                f"({q(item_id)}, {q(projeto_id)}, {idx*10}, {q(categoria_item)}, "
                f"{q(descritivo)}, {q(it['ambiente'])}, {float(it['quantidade'])}, 'm²', 0, 0, "
                f"'pendente', {q(json.dumps(item_meta))}::jsonb)"
            )
            for etapa in range(1, 10):
                values_iestat.append(f"({q(item_id)}, {etapa}, 'pendente')")

        psql(f"""
            INSERT INTO gestao.itens
              (id, projeto_id, ordem, categoria, descritivo, ambiente,
               quantidade, unidade, valor_unit, valor_total, status, meta)
            VALUES {','.join(values_itens)};
        """)
        n_iten += len(itens)

        psql(f"""
            INSERT INTO gestao.item_etapa_status (item_id, etapa_numero, status)
            VALUES {','.join(values_iestat)}
            ON CONFLICT DO NOTHING;
        """)
        n_iestat += len(values_iestat)

        # 4) Evento de auditoria
        psql(f"""
            INSERT INTO gestao.eventos (projeto_id, tipo, titulo, descricao, autor_email, payload)
            VALUES ({q(projeto_id)}, 'criado', 'Projeto seed contratos v2',
                    '{len(itens)} itens importados do CSV do financeiro',
                    {q(GESTOR_EMAIL)},
                    '{json.dumps({"csv": "contratos_parket_metragens_v2.csv", "n_itens": len(itens)})}'::jsonb);
        """)

        print(f"[ok] {cli} · {con}: 1 projeto + {len(itens)} itens + 9 etapas")

    print(f"\n[done] projetos={n_proj} itens={n_iten} item_etapa_status={n_iestat}")


if __name__ == "__main__":
    main()
