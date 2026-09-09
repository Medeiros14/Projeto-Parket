# Migra os dados extraidos do ERP legado (/tmp/erp_data/*.json) pras tabelas
# compras_* no Supabase Cloud. Idempotente: dedup por codigo/cnpj/conteudo.
# Kanban fica de fora (decisao do Will, 04/08).
import json, os, re, sys
import psycopg2
import psycopg2.extras

DB = os.environ["DB"]
D = "/tmp/erp_data"

def carrega(nome):
    with open(f"{D}/{nome}.json") as f:
        l = json.load(f)["linhas"]
    return l[1:] if l else []

def s(v):
    if v is None: return None
    v = str(v).strip()
    return v or None

def dig(v):
    return re.sub(r"\D", "", str(v or ""))

def fmt_cnpj(v):
    d = dig(v)
    if len(d) == 13: d = "0" + d
    if len(d) == 14:
        return f"{d[:2]}.{d[2:5]}.{d[5:8]}/{d[8:12]}-{d[12:]}"
    if len(d) == 11:
        return f"{d[:3]}.{d[3:6]}.{d[6:9]}-{d[9:]}"
    return s(v)

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
    except Exception:
        try: return float(str(v).replace(".", "").replace(",", "."))
        except Exception: return None

con = psycopg2.connect(DB)
cur = con.cursor()

# ---------- CLIENTES ----------
cur.execute("select codigo from compras_clientes")
ja = {r[0] for r in cur.fetchall()}
rows = []
for r in carrega("clientes"):
    r += [""] * (8 - len(r))
    cod = s(r[0])
    if not cod or cod in ja: continue
    ja.add(cod)
    nome = s(r[1])
    if not nome: continue
    mun, uf = s(r[5]), s(r[6])
    cidade = f"{mun}/{uf}" if mun and uf else (mun or uf)
    obs = " · ".join(x for x in [
        f"CNPJ/CPF: {fmt_cnpj(r[2])}" if s(r[2]) else None,
        f"IE: {s(r[4])}" if s(r[4]) else None] if x)
    rows.append((cod, nome, None, cidade, s(r[3]), s(r[7]), obs or None, True))
if rows:
    psycopg2.extras.execute_values(cur,
        "insert into compras_clientes (codigo,nome,endereco,cidade,telefone,email,obs,ativo) values %s",
        rows)
print("clientes inseridos:", len(rows))

# ---------- FORNECEDORES ----------
cur.execute("select coalesce(cnpj,''), lower(nome) from compras_fornecedores")
ja_cnpj = {dig(r[0]) for r in cur.fetchall() if dig(r[0])}
cur.execute("select lower(nome) from compras_fornecedores")
ja_nome = {r[0] for r in cur.fetchall()}
rows = []
for r in carrega("fornecedores"):
    r += [""] * (6 - len(r))
    cnpj_d = dig(r[0])
    if len(cnpj_d) == 13: cnpj_d = "0" + cnpj_d
    razao, fant = s(r[1]), s(r[2])
    nome = fant or razao
    if not nome: continue
    if cnpj_d and cnpj_d in ja_cnpj: continue
    if not cnpj_d and nome.lower() in ja_nome: continue
    if cnpj_d: ja_cnpj.add(cnpj_d)
    ja_nome.add(nome.lower())
    obs = " · ".join(x for x in [
        f"IE: {s(r[3])}" if s(r[3]) else None,
        f"End: {s(r[4])}" if s(r[4]) else None] if x)
    rows.append((nome, razao, fmt_cnpj(r[0]), s(r[5]), obs or None,
                 "Geral", "geral", 0, 0, 0, 0, True))
if rows:
    psycopg2.extras.execute_values(cur,
        """insert into compras_fornecedores
           (nome,razao_social,cnpj,telefone,obs,categoria,tipo,avaliacao,entregas,atrasos,valor_k,ativo)
           values %s""", rows, page_size=500)
print("fornecedores inseridos:", len(rows))

# ---------- FINANCEIRO (contas a pagar) ----------
cur.execute("select coalesce(fornecedor,''),coalesce(documento,''),coalesce(parcela,0),valor from compras_contas_pagar")
ja_fin = {(r[0], r[1], r[2], float(r[3] or 0)) for r in cur.fetchall()}
por_doc = {}
rows = []
for r in carrega("financeiro"):
    r += [""] * (9 - len(r))
    forn, doc = s(r[1]) or "", s(r[2]) or ""
    valor = num(r[5])
    if valor is None: continue
    parc = por_doc[(forn, doc)] = por_doc.get((forn, doc), 0) + 1
    chave = (forn, doc, parc, valor)
    if chave in ja_fin: continue
    ja_fin.add(chave)
    status_leg = (s(r[6]) or "").lower()
    status = "pago" if "pago" in status_leg else "pendente"
    emissao = data_iso(r[3])
    obs = " · ".join(x for x in [
        s(r[8]),
        f"Emissão: {emissao}" if emissao else None,
        f"CNPJ: {fmt_cnpj(r[0])}" if s(r[0]) else None] if x)
    rows.append((forn or None, doc or None, parc, data_iso(r[4]), valor,
                 status, s(r[7]), obs or None))
if rows:
    psycopg2.extras.execute_values(cur,
        """insert into compras_contas_pagar
           (fornecedor,documento,parcela,data_vencimento,valor,status,projeto,obs)
           values %s""", rows)
print("contas a pagar inseridas:", len(rows))

# ---------- ESTOQUE (movimentos) + PRODUTOS ----------
cur.execute("select coalesce(produto_codigo,''),data,tipo,quantidade,coalesce(documento,'') from compras_estoque_mov")
ja_mov = {(r[0], str(r[1]), r[2], float(r[3] or 0), r[4]) for r in cur.fetchall()}
cur.execute("select codigo from compras_produtos")
ja_prod = {r[0] for r in cur.fetchall()}
movs, prods = [], []
for r in carrega("estoque-manual"):
    r += [""] * (10 - len(r))
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
                 doc or None, s(r[8]), s(r[9])))
    if cod and cod not in ja_prod:
        ja_prod.add(cod)
        prods.append((cod, desc.upper(), "UN", True))
if prods:
    psycopg2.extras.execute_values(cur,
        "insert into compras_produtos (codigo,descricao,unidade,ativo) values %s", prods)
if movs:
    psycopg2.extras.execute_values(cur,
        """insert into compras_estoque_mov
           (data,produto_codigo,descricao,tipo,quantidade,unidade,valor_unitario,valor_total,documento,fornecedor,projeto)
           values %s""", movs)
print("produtos inseridos:", len(prods))
print("movimentos de estoque inseridos:", len(movs))

con.commit()
cur.execute("""select 'clientes',count(*) from compras_clientes
union all select 'fornecedores',count(*) from compras_fornecedores
union all select 'contas_pagar',count(*) from compras_contas_pagar
union all select 'estoque_mov',count(*) from compras_estoque_mov
union all select 'produtos',count(*) from compras_produtos""")
for t, n in cur.fetchall():
    print(f"TOTAL {t}: {n}")
