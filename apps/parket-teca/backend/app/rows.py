"""Registros (linhas) das tabelas — listagem paginada e busca por nome.

Deixa o Núcleo navegar pra dentro de uma tabela (ex: clientes) e ver os
itens de verdade, além do grafo de metadados.
"""
import re
from .db import reader


_IDENT = re.compile(r"^[a-z_][a-z0-9_]*$")

# Ordem de preferência pra escolher a coluna que representa o "nome" da linha
_TITLE_PRIORITY = [
    "cliente", "nome", "titulo", "title", "full_name", "name",
    "email", "numero", "codigo", "descricao",
]

# Tipos considerados "texto" pra busca ILIKE
_TEXT_TYPES = {
    "character varying", "varchar", "text", "citext", "character", "uuid",
    "name",
}

# Colunas que preferimos NÃO mostrar por padrão (payloads pesados)
_HIDE_COLS = {"embedding", "vector", "state", "geojson", "raw_json"}


def _quote(s: str) -> str:
    if not _IDENT.match(s):
        raise ValueError(f"identificador inválido: {s}")
    return f'"{s}"'


def _list_cols(cur, schema: str, table: str) -> list[dict]:
    cur.execute(
        """
        SELECT column_name, data_type
        FROM information_schema.columns
        WHERE table_schema = %s AND table_name = %s
        ORDER BY ordinal_position
        """,
        (schema, table),
    )
    return cur.fetchall()


def _pick_title_col(cols: list[dict]) -> str | None:
    lower = {c["column_name"].lower(): c["column_name"] for c in cols}
    for name in _TITLE_PRIORITY:
        if name in lower:
            return lower[name]
    for c in cols:
        if c["data_type"] in _TEXT_TYPES and c["column_name"].lower() != "id":
            return c["column_name"]
    return None


def _pk_col(cols: list[dict]) -> str:
    names = [c["column_name"] for c in cols]
    return "id" if "id" in names else (names[0] if names else "?")


def _text_cols(cols: list[dict]) -> list[str]:
    return [
        c["column_name"] for c in cols
        if c["data_type"] in _TEXT_TYPES and c["column_name"] not in _HIDE_COLS
    ]


def list_rows(schema: str, table: str, q: str | None = None, limit: int = 50) -> dict:
    """Lista linhas de uma tabela, com busca opcional em colunas de texto."""
    if not _IDENT.match(schema) or not _IDENT.match(table):
        return {"error": "identificador inválido"}
    limit = max(1, min(int(limit or 50), 200))
    with reader() as c, c.cursor() as cur:
        cols = _list_cols(cur, schema, table)
        if not cols:
            return {"error": "tabela não encontrada ou sem colunas"}
        title_col = _pick_title_col(cols)
        pk = _pk_col(cols)
        text_cols = _text_cols(cols)

        select_cols: list[str] = []
        if pk not in select_cols:
            select_cols.append(pk)
        if title_col and title_col not in select_cols:
            select_cols.append(title_col)
        for c_ in cols:
            n = c_["column_name"]
            if n in select_cols or n in _HIDE_COLS:
                continue
            if len(select_cols) >= 6:
                break
            select_cols.append(n)

        select_sql = ", ".join(_quote(c) for c in select_cols)
        base = f"SELECT {select_sql} FROM {_quote(schema)}.{_quote(table)}"
        params: list = []
        if q and q.strip() and text_cols:
            ors = " OR ".join(f"{_quote(c)}::text ILIKE %s" for c in text_cols)
            base += f" WHERE {ors}"
            params.extend([f"%{q.strip()}%"] * len(text_cols))
        base += f" ORDER BY {_quote(pk)} DESC NULLS LAST LIMIT %s"
        params.append(limit)

        try:
            cur.execute(base, params)
            rows = cur.fetchall()
        except Exception as e:
            return {"error": str(e)}

    return {
        "schema": schema,
        "table": table,
        "pk": pk,
        "title_col": title_col,
        "columns": select_cols,
        "rows": rows,
    }


def get_row(schema: str, table: str, pk_value: str) -> dict:
    """Retorna a linha inteira (todas as colunas exceto payloads pesados)."""
    if not _IDENT.match(schema) or not _IDENT.match(table):
        return {"error": "identificador inválido"}
    with reader() as c, c.cursor() as cur:
        cols = _list_cols(cur, schema, table)
        if not cols:
            return {"error": "tabela não encontrada"}
        pk = _pk_col(cols)
        visible = [c_["column_name"] for c_ in cols if c_["column_name"] not in _HIDE_COLS]
        select_sql = ", ".join(_quote(c) for c in visible)
        sql = (
            f"SELECT {select_sql} FROM {_quote(schema)}.{_quote(table)} "
            f"WHERE {_quote(pk)}::text = %s LIMIT 1"
        )
        try:
            cur.execute(sql, (str(pk_value),))
            r = cur.fetchone()
        except Exception as e:
            return {"error": str(e)}
    if not r:
        return {"error": "linha não encontrada"}
    return {"schema": schema, "table": table, "pk": pk, "row": r}


# Tabelas onde faz sentido pesquisar por "nome" globalmente.
# Formato: (schema, tabela, coluna_titulo, coluna_subtitulo_opcional)
_ENTITY_TABLES: list[tuple[str, str, str, str | None]] = [
    ("public", "simulacao_projetos", "cliente", "numero"),
    ("public", "kanban_cards", "title", "responsavel"),
    ("public", "user_profiles", "full_name", "email"),
    ("rh",     "colaboradores",     "nome", "email_profissional"),
]


def _fetch_all(cur, sql: str, params: tuple) -> list[dict]:
    try:
        cur.execute(sql, params)
        return cur.fetchall()
    except Exception:
        return []


def client_dossier(nome: str, limit: int = 8) -> dict:
    """Ficha completa do cliente: propostas + cards + msgs whatsapp + notas.

    Recebe nome livre e agrega tudo que a Parket sabe sobre o cliente pelas várias
    tabelas espalhadas. Ideal pra popular painel do Núcleo quando busca por nome.
    """
    if not nome or len(nome.strip()) < 2:
        return {"error": "nome muito curto"}
    like = f"%{nome.strip()}%"
    out: dict = {"nome_busca": nome.strip()}
    with reader() as c, c.cursor() as cur:
        propostas = _fetch_all(cur, """
            SELECT id::text, numero, cliente, cnpj_cpf, endereco, obra_code, obra_id,
                   vendedor, vendedor_email, arquiteto, orcamentista, status,
                   created_at, selected_at, card_id::text, card_comercial_id::text
            FROM public.simulacao_projetos
            WHERE cliente ILIKE %s
            ORDER BY created_at DESC LIMIT %s
        """, (like, limit))
        out["propostas"] = propostas

        # Colaboradores/vendedores com esse nome
        colaboradores = _fetch_all(cur, """
            SELECT id::text, nome, email_profissional, telefone, setor, cargo
            FROM rh.colaboradores
            WHERE nome ILIKE %s
            ORDER BY nome LIMIT %s
        """, (like, limit))
        out["colaboradores"] = colaboradores

        # Cards do Kanban com título/obra parecidos
        cards = _fetch_all(cur, """
            SELECT id::text, dept_id, column_id, title, subtitle, obra, responsavel,
                   priority, sla_status, updated_at
            FROM public.kanban_cards
            WHERE title ILIKE %s OR obra ILIKE %s OR subtitle ILIKE %s
            ORDER BY updated_at DESC LIMIT %s
        """, (like, like, like, limit))
        out["cards"] = cards

        # Telefones dos propostas → mensagens de WhatsApp associadas
        card_ids = [p["card_id"] for p in propostas if p.get("card_id")] + \
                   [c["id"] for c in cards[:limit]]
        msgs: list[dict] = []
        if card_ids:
            msgs = _fetch_all(cur, """
                SELECT phone, direction, sender_name, message_text, timestamp, instance, card_id::text
                FROM public.whatsapp_messages
                WHERE card_id = ANY(%s::uuid[])
                ORDER BY timestamp DESC LIMIT 30
            """, (card_ids,))
        # Fallback: também tenta sender_name por nome
        if not msgs:
            msgs = _fetch_all(cur, """
                SELECT phone, direction, sender_name, message_text, timestamp, instance, card_id::text
                FROM public.whatsapp_messages
                WHERE sender_name ILIKE %s
                ORDER BY timestamp DESC LIMIT 15
            """, (like,))
        out["mensagens"] = msgs

        # Notas no Teca que citem o nome
        notas = _fetch_all(cur, """
            SELECT slug, titulo, updated_at
            FROM teca.notas
            WHERE titulo ILIKE %s OR conteudo_md ILIKE %s
            ORDER BY updated_at DESC LIMIT %s
        """, (like, like, limit))
        out["notas"] = notas

    out["counts"] = {
        "propostas":     len(out["propostas"]),
        "cards":         len(out["cards"]),
        "colaboradores": len(out["colaboradores"]),
        "mensagens":     len(out["mensagens"]),
        "notas":         len(out["notas"]),
    }
    return out


def search_rows(q: str, limit_per: int = 5) -> list[dict]:
    """Busca textual global em tabelas-entidade (clientes, cards, colaboradores…)."""
    if not q or not q.strip():
        return []
    like = f"%{q.strip()}%"
    out: list[dict] = []
    with reader() as c, c.cursor() as cur:
        for schema, table, title, sub in _ENTITY_TABLES:
            try:
                extra = f", {_quote(sub)}::text AS sub" if sub else ", NULL::text AS sub"
                sql = (
                    f"SELECT id::text AS id, {_quote(title)}::text AS title{extra} "
                    f"FROM {_quote(schema)}.{_quote(table)} "
                    f"WHERE {_quote(title)}::text ILIKE %s "
                    f"ORDER BY {_quote(title)} LIMIT %s"
                )
                cur.execute(sql, (like, int(limit_per)))
                rs = cur.fetchall()
            except Exception:
                continue
            for r in rs:
                if not r.get("title"):
                    continue
                out.append({
                    "id":       r["id"],
                    "title":    r["title"],
                    "sub":      r.get("sub"),
                    "table_id": f"table:{schema}.{table}",
                    "schema":   schema,
                    "table":    table,
                    "kind":     "row",
                })
    return out
