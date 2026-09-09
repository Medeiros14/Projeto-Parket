#!/usr/bin/env python3
"""
Re-match: pra cada linha em cronograma_obras com card_id NULL, tenta achar o card
do Operacional via token overlap + Levenshtein. UPDATE só onde encontrar.
"""
import json, urllib.request, unicodedata, re

SBP = "SUPABASE_MGMT_TOKEN_REMOVIDO"
URL = "https://api.supabase.com/v1/projects/hbxpilrxmitvzebluoom/database/query"

def sql(q):
    req = urllib.request.Request(URL,
        data=json.dumps({"query": q}).encode(),
        headers={"Authorization": f"Bearer {SBP}", "Content-Type": "application/json", "User-Agent": "curl/8"},
        method="POST")
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            return json.loads(r.read())
    except urllib.error.HTTPError as e:
        raise RuntimeError(f"HTTP {e.code}: {e.read().decode()}\nQ: {q[:300]}")

def norm(s):
    if not s: return ""
    s = "".join(c for c in unicodedata.normalize("NFD", str(s)) if unicodedata.category(c) != "Mn")
    return re.sub(r"[^A-Z0-9 ]", " ", re.sub(r"\s+", " ", s.strip().upper()))

STOP = {"E","DE","DA","DO","DOS","DAS","O","A","NO","NA","P","COM","PARA"}
def toks(s):
    return [t for t in norm(s).split() if len(t) >= 3 and t not in STOP]

def lev(a, b):
    if a == b: return 0
    if len(a) < len(b): a, b = b, a
    if not b: return len(a)
    prev = list(range(len(b)+1))
    for i, ca in enumerate(a, 1):
        cur = [i]
        for j, cb in enumerate(b, 1):
            cur.append(min(cur[-1]+1, prev[j]+1, prev[j-1]+(ca!=cb)))
        prev = cur
    return prev[-1]

# load cards
cards = sql("select id, title from kanban_cards where dept_id='operacional' and title is not null")
print(f"Cards: {len(cards)}")
card_index = [(c["id"], toks(c["title"]), c["title"]) for c in cards]

def best_match(name):
    nt = toks(name)
    if not nt: return None
    scored = []
    for cid, ct, title in card_index:
        if not ct: continue
        score = 0
        for a in nt:
            for b in ct:
                if a == b or (len(a) >= 4 and len(b) >= 4 and lev(a, b) <= 2):
                    score += 1
                    break
        if score > 0:
            scored.append((score, cid, title))
    if not scored: return None
    scored.sort(key=lambda x: -x[0])
    top = scored[0]
    margin = top[0] - (scored[1][0] if len(scored) > 1 else 0)
    need = min(2, len(nt))
    if top[0] >= need and margin >= 1:
        return top[1], top[2]
    return None

# load unmatched rows
rows = sql("select id, nome_obra from cronograma_obras where card_id is null and nome_obra is not null")
print(f"Linhas sem card: {len(rows)}")

updates = []
preview = []
for r in rows:
    m = best_match(r["nome_obra"])
    if m:
        cid, title = m
        updates.append((r["id"], cid))
        preview.append(f"  '{r['nome_obra']}' → '{title}'")

print(f"Matches encontrados: {len(updates)}")
for p in preview[:40]:
    print(p)

if updates:
    # bulk UPDATE via CASE
    when = " ".join([f"WHEN '{rid}' THEN '{cid}'::uuid" for rid, cid in updates])
    ids = ",".join([f"'{rid}'" for rid, _ in updates])
    q = f"UPDATE cronograma_obras SET card_id = CASE id {when} END WHERE id IN ({ids})"
    sql(q)
    print(f"\nUPDATE feito: {len(updates)} linhas")
