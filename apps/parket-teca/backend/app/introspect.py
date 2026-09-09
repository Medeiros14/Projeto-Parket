"""Introspecção do parket-pg-local → grafo de entidades Parket."""
from .db import conn


# Schemas de sistema ignorados
_IGNORE_SCHEMAS = {
    "pg_catalog", "information_schema", "pg_toast", "pgbouncer",
    "extensions", "graphql", "graphql_public", "net", "cron",
    "realtime", "_realtime", "vault", "storage", "auth", "gotrue_local",
    "supabase_functions", "supabase_migrations", "pgsodium", "pgsodium_masks",
}

# Mapa schema → setor (heurística)
SCHEMA_TO_SETOR = {
    "public": "geral",
    "rh": "rh",
    "core": "core",
    "erp": "erp",
    "orcamento_produtos": "orçamento",
    "teca": "teca",
    "cloud_ro": "cloud",         # fonte fresca via FDW
    "cloud_remote": "sync",
    "recovery_15jun": "backup",
    "signer": "financeiro",
}

# Palavras-chave pra classificar tabelas em setores dentro do public
_KEYWORD_TO_SETOR = [
    (["kanban", "card", "lead", "comercial", "atendimento"], "comercial"),
    (["obra", "instala", "cronograma", "fiscal"], "obras"),
    (["proposta", "simulacao", "orcamento", "orçamento", "preco"], "orçamento"),
    (["desenho", "draw", "prancha", "svg", "canvas"], "desenho"),
    (["produto", "insumo", "catalog"], "catalogo"),
    (["whatsapp", "evolution", "message", "mensagem"], "mensageria"),
    (["contrato", "docusign", "assinatura", "clicksign"], "financeiro"),
    (["rh_", "colaborador", "ponto", "ferias"], "rh"),
    (["user_", "auth_", "profile", "sessao", "sessions"], "identidade"),
    (["ai_", "eas_", "agent", "run", "team"], "ia"),
]


def _guess_setor(schema: str, table: str) -> str:
    if schema in SCHEMA_TO_SETOR:
        base = SCHEMA_TO_SETOR[schema]
        if base != "geral":
            return base
    t = table.lower()
    for keywords, setor in _KEYWORD_TO_SETOR:
        if any(k in t for k in keywords):
            return setor
    return "geral"


def list_tables() -> list[dict]:
    # relkind 'r' = tabela normal, 'f' = foreign (FDW → cloud_ro)
    q = """
    SELECT
        n.nspname AS schema_name,
        c.relname AS table_name,
        obj_description(c.oid, 'pg_class') AS comment,
        c.reltuples::bigint AS approx_rows,
        c.relkind AS kind
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relkind IN ('r','f')
      AND n.nspname <> ALL(%s)
      AND n.nspname NOT LIKE 'pg_%%'
    ORDER BY n.nspname, c.relname
    """
    with conn() as c, c.cursor() as cur:
        cur.execute(q, (list(_IGNORE_SCHEMAS),))
        return cur.fetchall()


def list_fks() -> list[dict]:
    q = """
    SELECT
        n1.nspname AS src_schema, c1.relname AS src_table,
        n2.nspname AS dst_schema, c2.relname AS dst_table,
        con.conname AS name
    FROM pg_constraint con
    JOIN pg_class c1  ON c1.oid = con.conrelid
    JOIN pg_class c2  ON c2.oid = con.confrelid
    JOIN pg_namespace n1 ON n1.oid = c1.relnamespace
    JOIN pg_namespace n2 ON n2.oid = c2.relnamespace
    WHERE con.contype = 'f'
      AND n1.nspname <> ALL(%s)
      AND n2.nspname <> ALL(%s)
    """
    with conn() as c, c.cursor() as cur:
        cur.execute(q, (list(_IGNORE_SCHEMAS), list(_IGNORE_SCHEMAS)))
        return cur.fetchall()


def table_columns(schema: str, table: str) -> list[dict]:
    q = """
    SELECT column_name, data_type, is_nullable
    FROM information_schema.columns
    WHERE table_schema = %s AND table_name = %s
    ORDER BY ordinal_position
    """
    with conn() as c, c.cursor() as cur:
        cur.execute(q, (schema, table))
        return cur.fetchall()


def build_graph() -> dict:
    """Retorna { nodes: [...], edges: [...], stats: {...} } pra render 3D.
    Inclui tabelas (live) + nodes persistidos em teca.nodes (notas, docs, memórias, insights)
    e arestas FK + wikilink + tag."""
    tables = list_tables()
    fks = list_fks()

    nodes = []
    node_ids = set()
    setor_counts: dict[str, int] = {}

    for t in tables:
        schema, name = t["schema_name"], t["table_name"]
        nid = f"table:{schema}.{name}"
        setor = _guess_setor(schema, name)
        setor_counts[setor] = setor_counts.get(setor, 0) + 1
        nodes.append({
            "id": nid,
            "kind": "table",
            "title": name,
            "schema": schema,
            "setor": setor,
            "rows": int(t["approx_rows"] or 0),
            "comment": t["comment"],
        })
        node_ids.add(nid)

    edges = []
    for f in fks:
        s = f"table:{f['src_schema']}.{f['src_table']}"
        d = f"table:{f['dst_schema']}.{f['dst_table']}"
        if s in node_ids and d in node_ids and s != d:
            edges.append({"src": s, "dst": d, "kind": "fk"})

    # Adiciona nodes persistidos que NÃO são tables (notes, docs, memory, insights)
    with conn() as c, c.cursor() as cur:
        cur.execute("""
            SELECT id, kind, title, setor
            FROM teca.nodes
            WHERE kind IN ('note','doc','memory','insight')
        """)
        for r in cur.fetchall():
            if r["id"] in node_ids:
                continue
            setor = r["setor"] or r["kind"]
            setor_counts[setor] = setor_counts.get(setor, 0) + 1
            nodes.append({
                "id": r["id"],
                "kind": r["kind"],
                "title": r["title"],
                "schema": None,
                "setor": setor,
                "rows": 0,
                "comment": None,
            })
            node_ids.add(r["id"])

        # Arestas wikilink e semantic salvas
        cur.execute("SELECT src_id, dst_id, kind FROM teca.edges WHERE kind IN ('wikilink','semantic','tag')")
        for r in cur.fetchall():
            if r["src_id"] in node_ids and r["dst_id"] in node_ids:
                edges.append({"src": r["src_id"], "dst": r["dst_id"], "kind": r["kind"]})

    return {
        "nodes": nodes,
        "edges": edges,
        "stats": {
            "tables": sum(1 for n in nodes if n["kind"] == "table"),
            "notes": sum(1 for n in nodes if n["kind"] == "note"),
            "docs": sum(1 for n in nodes if n["kind"] in ("doc","memory")),
            "fks": sum(1 for e in edges if e["kind"] == "fk"),
            "wikilinks": sum(1 for e in edges if e["kind"] == "wikilink"),
            "setores": setor_counts,
        },
    }
