"""Sweep de insights automáticos — popula teca.insights.

Cada sweep gera N insights por slug estável (idempotente via ON CONFLICT-like
por slug+node_ids). Insights que não aparecerem no sweep atual são marcados
como dismissed (auto-cura).
"""
import json
from .db import conn


TERMINAL_COLUMN_SLUGS = (
    "ganho", "perda", "entregue", "encerrado", "rejeitado",
    "concluido", "obras-finalizadas", "projeto-finalizado",
)


# Cada checker retorna list[dict] com {slug, titulo, corpo, severidade, setor, node_ids, payload}
def _propostas_paradas(cur) -> list[dict]:
    cur.execute("""
        SELECT id, numero, cliente, status, created_at,
               EXTRACT(DAY FROM now() - created_at)::int AS dias
        FROM public.simulacao_projetos
        WHERE status IN ('rascunho','enviada')
          AND created_at < now() - interval '7 days'
          AND created_at > now() - interval '90 days'
        ORDER BY created_at ASC
        LIMIT 20
    """)
    out = []
    for r in cur.fetchall():
        out.append({
            "slug": f"proposta-parada:{r['id']}",
            "titulo": f"Proposta {r['numero'] or r['id']} parada há {r['dias']}d",
            "corpo": f"Cliente: {r['cliente'] or 's/ cliente'} — status {r['status']}. Sem movimento desde {r['created_at'].strftime('%d/%m')}.",
            "severidade": "warn" if r["dias"] < 30 else "crit",
            "setor": "orçamento",
            "node_ids": [f"table:public.simulacao_projetos"],
            "payload": {"proposta_id": str(r["id"]), "numero": r["numero"], "dias": r["dias"]},
        })
    return out


def _cards_kanban_parados(cur) -> list[dict]:
    cur.execute("""
        SELECT k.id, k.title, k.responsavel, kc.slug AS col_slug, kc.title AS col_title,
               COALESCE(k.updated_at, k.created_at) AS ts,
               EXTRACT(DAY FROM now() - COALESCE(k.updated_at, k.created_at))::int AS dias
        FROM public.kanban_cards k
        LEFT JOIN public.kanban_columns kc ON kc.id::text = k.column_id
        WHERE COALESCE(k.updated_at, k.created_at) < now() - interval '5 days'
          AND COALESCE(k.updated_at, k.created_at) > now() - interval '120 days'
          AND (kc.slug IS NULL OR kc.slug NOT IN %s)
          AND COALESCE(k.progress, 0) < 100
        ORDER BY ts ASC
        LIMIT 15
    """, (TERMINAL_COLUMN_SLUGS,))
    out = []
    for r in cur.fetchall():
        out.append({
            "slug": f"card-parado:{r['id']}",
            "titulo": f"Card '{(r['title'] or '')[:60]}' parado há {r['dias']}d",
            "corpo": f"Coluna: {r['col_title'] or 's/ coluna'} • Responsável: {r['responsavel'] or 's/ resp'}.",
            "severidade": "warn" if r["dias"] < 20 else "crit",
            "setor": "comercial",
            "node_ids": ["table:public.kanban_cards"],
            "payload": {"card_id": str(r["id"]), "dias": r["dias"], "coluna": r["col_slug"]},
        })
    return out


def _notas_orfas(cur) -> list[dict]:
    cur.execute("""
        SELECT n.slug, n.titulo
        FROM teca.notas n
        WHERE NOT EXISTS (
            SELECT 1 FROM teca.edges e
            WHERE e.kind='wikilink'
              AND (e.src_id = 'note:'||n.slug OR e.dst_id = 'note:'||n.slug)
        )
        ORDER BY n.updated_at DESC
        LIMIT 30
    """)
    orfas = cur.fetchall()
    if not orfas:
        return []
    exemplos = ", ".join(f"[[{r['titulo']}]]" for r in orfas[:5])
    return [{
        "slug": "notas-orfas",
        "titulo": f"{len(orfas)} nota{'s' if len(orfas)>1 else ''} sem conexão",
        "corpo": f"Notas sem wikilinks entrando ou saindo — considere costurar. Ex: {exemplos}",
        "severidade": "info",
        "setor": "notas",
        "node_ids": [f"note:{r['slug']}" for r in orfas[:10]],
        "payload": {"total": len(orfas), "slugs": [r["slug"] for r in orfas]},
    }]


def _tabelas_nao_indexadas(cur) -> list[dict]:
    cur.execute("""
        WITH live AS (
            SELECT n.nspname||'.'||c.relname AS full_name
            FROM pg_class c
            JOIN pg_namespace n ON n.oid=c.relnamespace
            WHERE c.relkind='r'
              AND n.nspname IN ('public','rh','core','erp','orcamento_produtos','teca')
              AND c.relname NOT LIKE '%_bkp_%'
        ),
        indexed AS (
            SELECT REPLACE(id, 'table:', '') AS full_name
            FROM teca.nodes WHERE kind='table'
        )
        SELECT full_name FROM live
        WHERE full_name NOT IN (SELECT full_name FROM indexed)
        ORDER BY 1 LIMIT 30
    """)
    faltando = [r["full_name"] for r in cur.fetchall()]
    if not faltando:
        return []
    return [{
        "slug": "tabelas-nao-indexadas",
        "titulo": f"{len(faltando)} tabela(s) fora do índice",
        "corpo": f"Tabelas presentes no banco mas ausentes do grafo Teca. Rode POST /api/ingest/tables para incluir. Ex: {', '.join(faltando[:5])}.",
        "severidade": "info",
        "setor": "teca",
        "node_ids": [f"table:{f}" for f in faltando[:10]],
        "payload": {"total": len(faltando), "tabelas": faltando},
    }]


def _consultas_sem_contexto(cur) -> list[dict]:
    cur.execute("""
        SELECT COUNT(*) AS n
        FROM teca.consultas
        WHERE created_at > now() - interval '3 days'
          AND (node_ids IS NULL OR cardinality(node_ids)=0)
    """)
    r = cur.fetchone()
    n = r["n"] if r else 0
    if n < 3:
        return []
    return [{
        "slug": "consultas-sem-contexto",
        "titulo": f"{n} consulta(s) sem contexto RAG nos últimos 3d",
        "corpo": "O núcleo respondeu no vazio — pode ser oportunidade de indexar novos docs ou memórias.",
        "severidade": "info",
        "setor": "teca",
        "node_ids": [],
        "payload": {"count": n},
    }]


CHECKERS = [
    _propostas_paradas,
    _cards_kanban_parados,
    _notas_orfas,
    _tabelas_nao_indexadas,
    _consultas_sem_contexto,
]


def sweep() -> dict:
    """Roda todos os checkers, upserta em teca.insights, dismisse insights ausentes."""
    generated: list[dict] = []
    with conn() as c, c.cursor() as cur:
        for check in CHECKERS:
            try:
                generated.extend(check(cur))
            except Exception as e:
                generated.append({
                    "slug": f"checker-erro:{check.__name__}",
                    "titulo": f"Falha no checker {check.__name__}",
                    "corpo": str(e)[:400],
                    "severidade": "warn",
                    "setor": "teca",
                    "node_ids": [],
                    "payload": {"error": str(e)},
                })

        active_slugs = [g["slug"] for g in generated]

        # Auto-dismiss insights que sumiram do sweep atual.
        # Insights manuais (eas:/manual:) não são geridos pelos checkers — preservar.
        cur.execute("""
            UPDATE teca.insights
               SET dismissed_at = now()
             WHERE dismissed_at IS NULL
               AND slug <> ALL(%s)
               AND slug NOT LIKE 'eas:%%'
               AND slug NOT LIKE 'manual:%%'
        """, (active_slugs or [""],))
        auto_dismissed = cur.rowcount

        # Upsert por slug (mantém um insight ativo por slug)
        inserted = 0
        for g in generated:
            cur.execute("""
                UPDATE teca.insights
                   SET titulo=%s, corpo=%s, severidade=%s, setor=%s,
                       node_ids=%s, payload=%s::jsonb
                 WHERE slug=%s AND dismissed_at IS NULL
                RETURNING id
            """, (g["titulo"], g["corpo"], g["severidade"], g["setor"],
                  g["node_ids"], json.dumps(g["payload"]), g["slug"]))
            if cur.fetchone() is None:
                cur.execute("""
                    INSERT INTO teca.insights (slug, titulo, corpo, severidade, setor, node_ids, payload)
                    VALUES (%s, %s, %s, %s, %s, %s, %s::jsonb)
                """, (g["slug"], g["titulo"], g["corpo"], g["severidade"],
                      g["setor"], g["node_ids"], json.dumps(g["payload"])))
                inserted += 1

    return {
        "generated": len(generated),
        "inserted": inserted,
        "updated": len(generated) - inserted,
        "auto_dismissed": auto_dismissed,
    }


def dismiss(insight_id: str) -> bool:
    with conn() as c, c.cursor() as cur:
        cur.execute("""
            UPDATE teca.insights SET dismissed_at = now()
            WHERE id::text = %s AND dismissed_at IS NULL
            RETURNING id
        """, (insight_id,))
        return cur.fetchone() is not None
