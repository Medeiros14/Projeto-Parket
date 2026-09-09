#!/usr/bin/env python3
"""Casa gestao.projetos.cliente com a planilha de enderecos de referencia.

A planilha usa nome curto ("ALAN BISSOLE") e o banco guarda o nome completo do
card ("ALAN ANDREAS FARIA BARBOSA COSTA E SILVA"), entao o casamento e por
token: todo token do nome da planilha tem que aparecer no nome do projeto.
Roda em dry-run por padrao; --apply escreve (com backup em gestao.projetos_endereco_backup).
"""
import difflib, json, re, subprocess, sys, unicodedata

REF = "/root/parket-gestao/scripts/enderecos_ref.txt"
CONTAINER = subprocess.run(
    ["docker", "ps", "-q", "-f", "name=parket-pg-local_postgres"],
    capture_output=True, text=True).stdout.strip()

# palavras que nao ajudam a identificar o cliente (prefixo de amostra, tipo societario)
STOP = {"AMOSTRA", "LTDA", "ME", "EIRELI", "SA", "S", "A", "E", "DE", "DA", "DO",
        "DOS", "DAS", "ID", "OBRA", "PROJETO", "INSTALACAO", "APTO", "APT", "AP"}


def norm(s: str) -> str:
    s = unicodedata.normalize("NFKD", s or "")
    s = "".join(c for c in s if not unicodedata.combining(c))
    s = re.sub(r"[^A-Za-z0-9]+", " ", s.upper())
    return re.sub(r"\s+", " ", s).strip()


def toks(s: str) -> set:
    return {t for t in norm(s).split() if t not in STOP and not t.isdigit()}


def sql(q: str):
    r = subprocess.run(
        ["docker", "exec", "-i", CONTAINER, "psql", "-U", "postgres", "-d", "postgres",
         "-t", "-A", "-c", q],
        capture_output=True, text=True)
    if r.returncode:
        sys.exit("psql: " + r.stderr)
    return r.stdout


def sql_json(q: str):
    """psql cospe json_agg pra nao quebrar em cliente com quebra de linha."""
    out = sql(f"select coalesce(json_agg(t)::text,'[]') from ({q}) t").strip()
    return json.loads(out)


# ── 1. carrega a planilha; nome repetido com endereco diferente vira conflito ──
refs = {}
conflitantes = set()
for linha in open(REF, encoding="utf-8"):
    linha = linha.rstrip("\n")
    if not linha.strip():
        continue
    nome, _, end = linha.partition("|")
    nome, end = nome.strip(), end.strip()
    if nome in refs and refs[nome] != end:
        conflitantes.add(nome)
    refs[nome] = end

# ── 2. projetos do banco ──
projetos = [(r["id"], r["cliente"], r["endereco"]) for r in sql_json("""
  select id::text as id,
         regexp_replace(coalesce(cliente,''), '[\\r\\n]+', ' ', 'g') as cliente,
         coalesce(endereco,'') as endereco
  from gestao.projetos order by cliente
""")]

# ── 3. casamento ──
def quase(a: str, b: str) -> bool:
    """Token com erro de digitacao: BISSOLI/BISSOLE, FLOARES/FLORAIS."""
    return a == b or (min(len(a), len(b)) >= 5
                      and difflib.SequenceMatcher(None, a, b).ratio() >= 0.80)


matches, ambiguos, sem_match, fuzzy = [], [], [], []
for pid, cliente, atual in projetos:
    pt = toks(cliente)
    npj = norm(cliente)
    cands = []
    for nome, end in refs.items():
        rt, nrf = toks(nome), norm(nome)
        if not rt:
            continue
        if npj == nrf:
            cands.append((100 + len(rt), nome, end)); continue
        if rt <= pt:
            # token unico curto (JAN, SD, EXP) so casa por igualdade exata
            if len(rt) == 1 and len(next(iter(rt))) < 5:
                continue
            cands.append((80 + len(rt), nome, end)); continue
        if pt and pt <= rt and len(pt) >= 2:
            cands.append((70 + len(pt), nome, end))
    if not cands:
        # nivel fuzzy: todo token da ref tem que "quase" bater com algum do projeto
        # (erro de digitacao no banco: BISSOLI/BISSOLE, FLOARES/FLORAIS)
        fz = []
        for nome, end in refs.items():
            rt = toks(nome)
            if len(rt) < 2 or not pt:
                continue
            if all(any(quase(r, p) for p in pt) for r in rt):
                fz.append((nome, end))
        if fz:
            fuzzy.append((pid, cliente, atual, fz))
        else:
            sem_match.append((pid, cliente, atual))
        continue
    cands.sort(reverse=True)
    topo = cands[0][0]
    empatados = {c[2] for c in cands if c[0] == topo}   # enderecos distintos no topo
    nomes_topo = [c[1] for c in cands if c[0] == topo]
    if len(empatados) > 1 or any(n in conflitantes for n in nomes_topo):
        ambiguos.append((pid, cliente, atual, nomes_topo,
                         sorted(empatados))); continue
    matches.append((pid, cliente, atual, cands[0][1], cands[0][2], topo))


# --incluir-quase promove os fuzzy de candidato unico pra fila de escrita
# (revisados um a um: sao erro de digitacao do mesmo nome, nao cliente diferente)
if "--incluir-quase" in sys.argv:
    for pid, cliente, atual, fz in fuzzy:
        if len(fz) == 1:
            matches.append((pid, cliente, atual, fz[0][0], fz[0][1], 60))

mudam = [m for m in matches if m[2].strip() != m[4]]
usados = {m[3] for m in matches}
print(f"projetos: {len(projetos)}   refs: {len(refs)}")
print(f"casados: {len(matches)}  (mudam endereco: {len(mudam)})")
print(f"ambiguos: {len(ambiguos)}   quase certos: {len(fuzzy)}   sem match: {len(sem_match)}")
print(f"refs da planilha nao usadas: {len(set(refs) - usados)}")

with open("/tmp/enderecos_relatorio.txt", "w", encoding="utf-8") as f:
    f.write("=== CASADOS QUE MUDAM ===\n")
    for pid, cli, atual, ref, end, sc in sorted(mudam, key=lambda x: x[1]):
        f.write(f"[{sc}] {cli}\n   ref  : {ref}\n   de   : {atual or '(vazio)'}\n   para : {end}\n")
    f.write("\n=== AMBIGUOS (nao aplicados) ===\n")
    for pid, cli, atual, nomes, ends in sorted(ambiguos, key=lambda x: x[1]):
        f.write(f"{cli}\n   refs : {nomes}\n   atual: {atual or '(vazio)'}\n")
        for e in ends:
            f.write(f"   opcao: {e}\n")
    f.write("\n=== QUASE CERTOS (revisar, nao aplicados) ===\n")
    for pid, cli, atual, fz in sorted(fuzzy, key=lambda x: x[1]):
        f.write(f"{cli}\n   atual: {atual or '(vazio)'}\n")
        for nome, end in fz:
            f.write(f"   ref  : {nome}\n   para : {end}\n")
    f.write("\n=== SEM MATCH ===\n")
    for pid, cli, atual in sorted(sem_match, key=lambda x: x[1]):
        f.write(f"{cli}   |   {atual or '(vazio)'}\n")
    f.write("\n=== REFS NAO USADAS ===\n")
    for n in sorted(set(refs) - usados):
        f.write(f"{n}\n")
print("relatorio: /tmp/enderecos_relatorio.txt")

if "--apply" not in sys.argv:
    sys.exit(0)

# ── 4. aplica (backup antes, pra dar pra voltar atras) ──
sql("""
create table if not exists gestao.projetos_endereco_backup(
  projeto_id uuid, cliente text, endereco_antigo text, endereco_novo text,
  ref_planilha text, aplicado_em timestamptz default now())
""")
vals, ups = [], []
for pid, cli, atual, ref, end, sc in mudam:
    q = lambda s: "'" + s.replace("'", "''") + "'"
    vals.append(f"({q(pid)}::uuid, {q(cli)}, {q(atual)}, {q(end)}, {q(ref)})")
    ups.append(f"({q(pid)}::uuid, {q(end)})")
for i in range(0, len(vals), 100):
    sql("insert into gestao.projetos_endereco_backup"
        "(projeto_id, cliente, endereco_antigo, endereco_novo, ref_planilha) values "
        + ",".join(vals[i:i+100]))
    sql("update gestao.projetos p set endereco = v.endereco, updated_at = now() "
        "from (values " + ",".join(ups[i:i+100]) + ") as v(id, endereco) where p.id = v.id")
print(f"aplicado em {len(mudam)} projetos (backup em gestao.projetos_endereco_backup)")
