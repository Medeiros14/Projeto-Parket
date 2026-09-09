# Restaura SÓ o estoque do Ronaldo (zerado por engano 04/08) a partir de
# /tmp/erp_data/estoque-manual.json. Idempotente. Deposito: marcenaria (default da coluna).
import json, os, re
import psycopg2, psycopg2.extras

DB = os.environ["DB"]

def s(v):
    if v is None: return None
    v = str(v).strip()
    return v or None

def data_iso(v):
    v = s(v)
    if not v: return None
    m = re.match(r"(\d{4}-\d{2}-\d{2})", v)
    if m: return m.group(1)
    m = re.match(r"(\d{2})/(\d{2})/(\d{4})", v)
    if m: return f"{m.group(3)}-{m.group(2)}-{m.group(1)}"
    return None

def num(v):
    if v is None or v == "": return None
    try: return float(v)
    except Exception: return None

with open("/tmp/erp_data/estoque-manual.json") as f:
    linhas = json.load(f)["linhas"][1:]

con = psycopg2.connect(DB)
cur = con.cursor()
cur.execute("select coalesce(produto_codigo,''),data,tipo,quantidade,coalesce(documento,'') from compras_estoque_mov")
ja_mov = {(r[0], str(r[1]), r[2], float(r[3] or 0), r[4]) for r in cur.fetchall()}
cur.execute("select codigo from compras_produtos")
ja_prod = {r[0] for r in cur.fetchall()}

movs, prods = [], []
for r in linhas:
    r = list(r) + [""] * (10 - len(r))
    data = data_iso(r[0])
    cod, desc = s(r[1]), s(r[2])
    tipo = s(r[3]) or "Entrada"
    qtd = num(r[4])
    if not data or not desc or qtd is None: continue
    doc = s(r[7]) or ""
    chave = (cod or "", data, tipo, qtd, doc)
    if chave in ja_mov: continue
    ja_mov.add(chave)
    movs.append((data, cod, desc, tipo, qtd, "UN", num(r[5]), num(r[6]),
                 doc or None, s(r[8]), s(r[9]), "marcenaria"))
    if cod and cod not in ja_prod:
        ja_prod.add(cod)
        prods.append((cod, desc.upper(), "UN", True))

if prods:
    psycopg2.extras.execute_values(cur,
        "insert into compras_produtos (codigo,descricao,unidade,ativo) values %s", prods)
if movs:
    psycopg2.extras.execute_values(cur,
        """insert into compras_estoque_mov
           (data,produto_codigo,descricao,tipo,quantidade,unidade,valor_unitario,valor_total,documento,fornecedor,projeto,deposito)
           values %s""", movs)
con.commit()
print("produtos restaurados:", len(prods))
print("movimentos restaurados:", len(movs))
cur.execute("select count(*), count(distinct produto_codigo) from compras_estoque_mov where deposito='marcenaria'")
print("total mov marcenaria / produtos distintos:", cur.fetchone())
