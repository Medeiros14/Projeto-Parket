#!/usr/bin/env python3
# ═══════════════════════════════════════════════════════════════════
# Aplica no gestao os itens extraidos dos PDFs pelo extract.py
# (02/09/2026, Will: "pode fazer tudo preciso disso no sistemas e
# depois atualizar no gestao os card la pra poder fazer a central do
# cliente bem feito" + "sabendo que a tem que sair no modelo certo").
# QUE FAZ: le out/<trello_id>.json (so cards status ok), monta os
# itens no MODELO HIERARQUICO do gestao (referencia:
# scripts/neymar_itens_ambientes_20260902.sql + sql/004):
#   - blocos numerados por categoria na ordem de aparicao (raiz 1..N);
#   - meta.codigo "raiz.seq", ordem = raiz*100+seq;
#   - descritivo "X.Y · PRODUTO_HEADER", coluna ambiente preenchida;
#   - quantidade = metragem real, valor_unit 0, valor_total do rateio
#     que o Claude ja validou (soma == total_proposta, tol R$1);
#   - meta: raiz/codigo/categoria_raiz/produto_header/so_material/
#     descritivo_original/origem=pdf_anexo_os/os/anexo_id;
#   - item_etapa_status pendente de gestao.etapas_catalogo;
#   - evento em gestao.eventos + projetos.valor_total se NULL/0.
# Cards com 2+ docs ok: TODOS os docs entram (cada OS = venda), e o
# card vai listado no relatorio pro Will conferir duplicidade.
# Idempotente/seguro: DO block por projeto (atomico) que ABORTA em
# NOTICE se o projeto ja tiver qualquer item (so preenche vazio).
# Dados viajam como jsonb dollar-quoted ($pkjson$) pro psql do
# container parket-pg-local_postgres via docker exec -i.
# Uso: python3 apply.py [--dry] [limite]
# ═══════════════════════════════════════════════════════════════════
import glob
import json
import os
import subprocess
import sys

BASE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(BASE, "out")
AUTOR = "will.tape@gmail.com"


def cid() -> str:
    return subprocess.check_output(
        ["docker", "ps", "-q", "-f", "name=parket-pg-local_postgres"], text=True
    ).split()[0]


def monta_itens(card: dict) -> tuple[list, float]:
    # numeracao hierarquica: bloco (raiz) por categoria na ordem de aparicao
    raizes: dict[str, int] = {}
    seq: dict[str, int] = {}
    itens, total_docs = [], 0.0
    for doc in card["docs"]:
        if doc["status"] != "ok":
            continue
        total_docs += doc.get("total_proposta") or doc.get("soma_itens") or 0
        for it in doc.get("itens", []):
            cat = (it.get("categoria") or "OUTRO").upper()
            if cat not in raizes:
                raizes[cat] = len(raizes) + 1
                seq[cat] = 0
            seq[cat] += 1
            raiz, n = raizes[cat], seq[cat]
            codigo = f"{raiz}.{n}"
            un = it.get("unidade") or "un"
            qtd = it.get("quantidade")
            if qtd is None:
                qtd = 1 if un in ("un", "vb") else 0
            meta = {
                "raiz": str(raiz),
                "codigo": codigo,
                "categoria_raiz": cat,
                "produto_header": it.get("produto") or cat,
                "so_material": bool(it.get("so_material")),
                "descritivo_original": it.get("descritivo") or "",
                "origem": "pdf_anexo_os",
                "os": str(doc.get("os") or ""),
                "anexo_id": doc.get("anexo_id"),
            }
            itens.append({
                "ordem": raiz * 100 + n,
                "categoria": cat,
                "descritivo": f"{codigo} · {meta['produto_header']}",
                "ambiente": (it.get("ambiente") or None),
                "quantidade": round(float(qtd), 3),
                "unidade": un,
                "valor_total": round(float(it.get("valor_total") or 0), 2),
                "meta": meta,
            })
    return itens, round(total_docs, 2)


SQL = """DO $$
DECLARE
  v_projeto uuid := %(projeto)L;
  v_total numeric := %(total)s;
  dados jsonb := $pkjson$%(json)s$pkjson$::jsonb;
  it jsonb;
  v_id uuid;
BEGIN
  -- so preenche projeto VAZIO: se ja tem item, nao mexe (idempotencia)
  IF EXISTS (SELECT 1 FROM gestao.itens WHERE projeto_id = v_projeto) THEN
    RAISE NOTICE 'SKIP % ja tem itens', v_projeto;
    RETURN;
  END IF;
  FOR it IN SELECT * FROM jsonb_array_elements(dados) LOOP
    INSERT INTO gestao.itens (
      projeto_id, simulacao_item_id, ordem, categoria, descritivo, ambiente,
      quantidade, unidade, valor_unit, valor_total, meta
    ) VALUES (
      v_projeto, NULL,
      (it->>'ordem')::int,
      it->>'categoria',
      it->>'descritivo',
      it->>'ambiente',
      (it->>'quantidade')::numeric,
      it->>'unidade',
      0.00,
      (it->>'valor_total')::numeric,
      it->'meta'
    ) RETURNING id INTO v_id;
    INSERT INTO gestao.item_etapa_status (item_id, etapa_numero, status)
    SELECT v_id, numero, 'pendente' FROM gestao.etapas_catalogo;
  END LOOP;
  UPDATE gestao.projetos SET valor_total = v_total
   WHERE id = v_projeto AND COALESCE(valor_total, 0) = 0 AND v_total > 0;
  INSERT INTO gestao.eventos (projeto_id, tipo, titulo, descricao, autor_email, payload)
  VALUES (v_projeto, 'criado', 'Itens importados da proposta em PDF',
          %(desc)L, %(autor)L,
          jsonb_build_object('backfill', 'itens-pdf-anexo-02-09',
                             'trello_id', %(trello)L,
                             'total_docs', v_total));
END $$;
"""


def qlit(s: str) -> str:
    # literal SQL com aspas simples escapadas (uso controlado, ids/uuids/textos curtos)
    return "'" + str(s).replace("'", "''") + "'"


def main():
    dry = "--dry" in sys.argv
    args = [a for a in sys.argv[1:] if a != "--dry"]
    limite = int(args[0]) if args else 10**9
    container = cid()
    fila = []
    for f in sorted(glob.glob(os.path.join(OUT, "*.json"))):
        with open(f) as fh:
            card = json.load(fh)
        if card.get("status") != "ok":
            continue
        itens, total = monta_itens(card)
        if not itens:
            continue
        fila.append((card, itens, total))
    fila = fila[:limite]
    multi = [c["cliente"] for c, _, _ in fila
             if sum(1 for d in c["docs"] if d["status"] == "ok") > 1]
    print(f"{len(fila)} projetos a aplicar; {len(multi)} com 2+ docs ok: {multi}")
    if dry:
        for card, itens, total in fila:
            print(f"- {card['cliente'][:45]}: {len(itens)} itens R${total}")
        return
    ok = err = 0
    for card, itens, total in fila:
        payload = json.dumps(itens, ensure_ascii=False)
        if "$pkjson$" in payload:
            print(f"ERRO {card['trello_id']}: payload contem tag dollar-quote")
            err += 1
            continue
        # so numera OS de verdade na descricao; PDF sem numero fica de fora
        oss = sorted({i["meta"]["os"] for i in itens if i["meta"]["os"].isdigit()})
        desc = (f"{len(itens)} itens extraidos do PDF da proposta anexada no Trello"
                + (f" (OS {', '.join(oss)})" if oss else ""))
        sql = SQL.replace("%(projeto)L", qlit(card["projeto_id"])) \
                 .replace("%(total)s", str(total)) \
                 .replace("%(json)s", payload) \
                 .replace("%(desc)L", qlit(desc)) \
                 .replace("%(autor)L", qlit(AUTOR)) \
                 .replace("%(trello)L", qlit(card["trello_id"]))
        r = subprocess.run(
            ["docker", "exec", "-i", container, "psql", "-U", "postgres",
             "-v", "ON_ERROR_STOP=1", "-q"],
            input=sql, capture_output=True, text=True,
        )
        skip = "SKIP" in (r.stderr or "")
        if r.returncode == 0:
            ok += 1
            print(f"{'skip' if skip else 'ok  '} {card['cliente'][:45]} "
                  f"{len(itens)} itens R${total}")
        else:
            err += 1
            print(f"ERRO {card['cliente'][:45]}: {r.stderr.strip()[:200]}")
    print(f"\naplicados/skip: {ok}, erros: {err}")


if __name__ == "__main__":
    main()
