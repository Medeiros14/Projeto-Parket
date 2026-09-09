#!/usr/bin/env python3
"""
Importa CRONOGRAMA DE OBRAS.xlsx → cronograma_obras (Supabase).
Match de NOME DA OBRA contra kanban_cards do dept_id=operacional (normalizado).
Sem match → card_id null, nome_obra preserva o texto do xlsx.
"""
import openpyxl, unicodedata, re, json, urllib.request, datetime as dt

SBP = "SUPABASE_MGMT_TOKEN_REMOVIDO"
PROJECT = "hbxpilrxmitvzebluoom"
QUERY_URL = f"https://api.supabase.com/v1/projects/{PROJECT}/database/query"

def sql(query: str):
    req = urllib.request.Request(QUERY_URL,
        data=json.dumps({"query": query}).encode(),
        headers={"Authorization": f"Bearer {SBP}", "Content-Type": "application/json", "User-Agent": "curl/8"},
        method="POST")
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            return json.loads(r.read())
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8", "replace")
        raise RuntimeError(f"HTTP {e.code}: {body}\nQUERY (first 500): {query[:500]}")

def norm(s):
    if not s: return ""
    s = str(s).strip()
    s = "".join(c for c in unicodedata.normalize("NFD", s) if unicodedata.category(c) != "Mn")
    s = re.sub(r"\s+", " ", s).upper()
    return s

# ---- 1. fetch cards ----
print("Carregando cards do Operacional…")
cards = sql("select id, title from kanban_cards where dept_id='operacional'")
print(f"  {len(cards)} cards")

by_exact = {}
by_token = []  # list of (norm_title, id) for fuzzy
for c in cards:
    n = norm(c["title"])
    if not n: continue
    by_exact.setdefault(n, c["id"])
    by_token.append((n, c["id"]))

def match_card(name):
    n = norm(name)
    if not n: return None
    if n in by_exact: return by_exact[n]
    # try first significant token (first 2 words)
    parts = n.split()
    if len(parts) >= 1 and len(parts[0]) >= 4:
        prefix = " ".join(parts[:2]) if len(parts) >= 2 else parts[0]
        hits = [cid for nt, cid in by_token if nt.startswith(prefix)]
        if len(hits) == 1: return hits[0]
    # fallback: contains
    if len(n) >= 5:
        hits = [cid for nt, cid in by_token if n in nt or nt in n]
        if len(hits) == 1: return hits[0]
    return None

# ---- 2. parse xlsx ----
wb = openpyxl.load_workbook("/root/CRONOGRAMA DE OBRAS.xlsx", data_only=True)

def cell_text(v):
    if v is None: return None
    if isinstance(v, dt.datetime): return v.strftime("%d/%m/%Y")
    s = str(v).strip()
    return s if s else None

def cell_iso(v):
    if v is None: return None
    if isinstance(v, dt.datetime): return v.strftime("%Y-%m-%d")
    return None

rows = []
matched = 0
unmatched_samples = []

# OBRAS — header row 3 (1-indexed): EQUIPE, DIAS, CUSTOS, NOME DA OBRA, SERVIÇO, FISCAL, DATA DE FINALIZAÇÃO, OBSERVAÇÃO, LOCALIZAÇÃO
ws = wb["OBRAS"]
pos = 0
for r in ws.iter_rows(min_row=4, values_only=True):
    equipe, dias, custos, nome, servico, fiscal, datafin, obs, loc = r[:9]
    nome_t = cell_text(nome)
    if not nome_t: continue  # nome_obra é NOT NULL — sem nome de cliente, pulamos
    cid = match_card(nome_t) if nome_t else None
    if cid: matched += 1
    elif nome_t and len(unmatched_samples) < 25: unmatched_samples.append(("obras", nome_t))
    pos += 10
    rows.append({
        "tipo": "obras",
        "card_id": cid,
        "nome_obra": nome_t,
        "equipe": cell_text(equipe),
        "dias": cell_text(dias),
        "custos": cell_text(custos),
        "servico": cell_text(servico),
        "fiscal": cell_text(fiscal),
        "data_finalizacao": cell_text(datafin),
        "observacao": cell_text(obs),
        "localizacao": cell_text(loc),
        "posicao": pos,
    })

# MARCENARIA — header row 3: DATA, INICIO, TERMINO, CONTRATO, EQUIPE, DISPOS, NOME DA OBRA, SERVIÇO, OBS, FISCAL, DATA FINALIZAÇÃO, LOCALIZAÇÃO
ws = wb["MARCENARIA"]
pos = 0
for r in ws.iter_rows(min_row=4, values_only=True):
    data, ini, term, contrato, equipe, dispos, nome, servico, obs, fiscal, datafin, loc = r[:12]
    nome_t = cell_text(nome)
    if not nome_t: continue
    cid = match_card(nome_t) if nome_t else None
    if cid: matched += 1
    elif nome_t and len(unmatched_samples) < 50: unmatched_samples.append(("marc", nome_t))
    pos += 10
    rows.append({
        "tipo": "marcenaria",
        "card_id": cid,
        "nome_obra": nome_t,
        "data": cell_iso(data),
        "inicio_dia": cell_text(ini),
        "termino_dia": cell_text(term),
        "contrato": cell_text(contrato),
        "equipe": cell_text(equipe),
        "dispos": cell_text(dispos),
        "servico": cell_text(servico),
        "observacao": cell_text(obs),
        "fiscal": cell_text(fiscal),
        "data_finalizacao": cell_text(datafin),
        "localizacao": cell_text(loc),
        "posicao": pos,
    })

# REPAROS — header row 3, col 2..10
ws = wb["REPAROS"]
pos = 0
for r in ws.iter_rows(min_row=4, values_only=True):
    _, equipe, dias, custos, nome, servico, fiscal, datafin, obs, loc = r[:10]
    nome_t = cell_text(nome)
    if not nome_t: continue
    cid = match_card(nome_t) if nome_t else None
    if cid: matched += 1
    elif nome_t and len(unmatched_samples) < 75: unmatched_samples.append(("rep", nome_t))
    pos += 10
    rows.append({
        "tipo": "reparos",
        "card_id": cid,
        "nome_obra": nome_t,
        "equipe": cell_text(equipe),
        "dias": cell_text(dias),
        "custos": cell_text(custos),
        "servico": cell_text(servico),
        "fiscal": cell_text(fiscal),
        "data_finalizacao": cell_text(datafin),
        "observacao": cell_text(obs),
        "localizacao": cell_text(loc),
        "posicao": pos,
    })

with_nome = sum(1 for r in rows if r.get("nome_obra"))
print(f"\nLinhas extraídas: {len(rows)}")
print(f"  Com nome_obra: {with_nome}")
print(f"  Com card_id (match): {matched}")
print(f"  Sem match (amostra):")
for tipo, nm in unmatched_samples[:30]:
    print(f"    [{tipo}] {nm}")

# ---- 3. emit SQL bulk insert ----
def lit(v):
    if v is None: return "NULL"
    if isinstance(v, (int, float)): return str(v)
    s = str(v).replace("'", "''")
    return f"'{s}'"

cols = ["tipo","card_id","nome_obra","equipe","fiscal","servico",
        "data_finalizacao","observacao","localizacao","custos","dias",
        "data","inicio_dia","termino_dia","contrato","dispos","posicao"]

# write SQL to file & insert in batches via management API
BATCH = 200
inserted = 0
for i in range(0, len(rows), BATCH):
    chunk = rows[i:i+BATCH]
    values = []
    for r in chunk:
        vals = [lit(r.get(c)) for c in cols]
        values.append("(" + ",".join(vals) + ")")
    q = f"INSERT INTO cronograma_obras ({','.join(cols)}) VALUES {','.join(values)}"
    resp = sql(q)
    inserted += len(chunk)
    print(f"  inserido {inserted}/{len(rows)}")

print(f"\nDONE — {inserted} linhas em cronograma_obras")
