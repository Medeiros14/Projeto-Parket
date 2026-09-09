"""Sessão de Aprendizado — histórico do que a Teca aprende sobre cada app.

Cada aprendizado é um registro em teca.aprendizados + espelhado como node
kind='aprendizado' em teca.nodes pra entrar no RAG e no núcleo 3D.
"""
import json
from typing import Any
from .db import conn
from .embeddings import embed_one


APPS_CATALOGO = {
    "valoria":     {"label": "Valoria",     "descricao": "Simulador comercial (valor.parket.works)", "setor": "orçamento"},
    "draw":        {"label": "Draw Studio", "descricao": "CAD interno (draw.parket.works)",           "setor": "desenho"},
    "status":      {"label": "Status",      "descricao": "Mapa + cronograma de obra",                 "setor": "obras"},
    "space":       {"label": "Space",       "descricao": "Dashboard Parket (space.parket.works)",     "setor": "geral"},
    "proposta":    {"label": "Proposta",    "descricao": "Renderer de proposta pública",              "setor": "orçamento"},
    "dashboard":   {"label": "Dashboard",   "descricao": "Dashboard Parket golden",                   "setor": "comercial"},
    "homebroker":  {"label": "Homebroker",  "descricao": "Kanban comercial",                          "setor": "comercial"},
    "teca":        {"label": "Teca",        "descricao": "Este próprio núcleo",                       "setor": "teca"},
    "teca_v2":     {"label": "Teca V2",     "descricao": "Teca no WhatsApp — atendimento comercial (instância Comercial - Parket)", "setor": "comercial"},
    "rh":          {"label": "RH",          "descricao": "rh.parket.works",                           "setor": "rh"},
    "fiscal":      {"label": "Fiscal",      "descricao": "app de vistoria",                           "setor": "obras"},
}

CATEGORIAS = ("erro", "acerto", "melhoria", "automacao", "padrao_repetitivo")
PRIORIDADES = ("baixa", "media", "alta", "critica")
STATUS_VALIDOS = ("aberto", "em_analise", "automatizado", "implementado", "descartado")


def _to_node_id(aid: str) -> str:
    return f"aprendizado:{aid}"


def _sync_to_graph(cur, apr: dict) -> None:
    """Espelha o aprendizado como node kind='aprendizado' no grafo."""
    nid = _to_node_id(str(apr["id"]))
    body = (
        f"App: {apr['app']}\n"
        f"Categoria: {apr['categoria']}\n"
        f"Prioridade: {apr.get('prioridade') or 'media'} · Status: {apr.get('status') or 'aberto'}\n"
        f"Fonte: {apr.get('fonte') or 'user_report'}\n\n"
        f"{apr.get('descricao') or ''}"
    )
    vec = embed_one(f"{apr['titulo']}\n\n{body}")
    setor = APPS_CATALOGO.get(apr["app"], {}).get("setor") or apr["app"]

    cur.execute("""
        INSERT INTO teca.nodes (id, kind, title, body, schema_name, setor, meta, embedding)
        VALUES (%s, 'aprendizado', %s, %s, NULL, %s, %s::jsonb, %s)
        ON CONFLICT (id) DO UPDATE
        SET title=EXCLUDED.title, body=EXCLUDED.body, meta=EXCLUDED.meta,
            setor=EXCLUDED.setor, embedding=EXCLUDED.embedding, updated_at=now()
    """, (
        nid, apr["titulo"], body, setor,
        json.dumps({
            "app": apr["app"],
            "categoria": apr["categoria"],
            "status": apr.get("status"),
            "prioridade": apr.get("prioridade"),
            "tags": apr.get("tags") or [],
        }),
        vec,
    ))

    # Aresta tag→app pra clusterizar no grafo (usa node existente kind=table caso exista;
    # senão cria um "app node" leve)
    app_node = f"app:{apr['app']}"
    cur.execute("""
        INSERT INTO teca.nodes (id, kind, title, body, setor, meta)
        VALUES (%s, 'app', %s, %s, %s, '{}'::jsonb)
        ON CONFLICT (id) DO NOTHING
    """, (
        app_node,
        APPS_CATALOGO.get(apr["app"], {}).get("label", apr["app"].title()),
        APPS_CATALOGO.get(apr["app"], {}).get("descricao", ""),
        APPS_CATALOGO.get(apr["app"], {}).get("setor", apr["app"]),
    ))
    cur.execute("""
        INSERT INTO teca.edges (src_id, dst_id, kind, weight, meta)
        VALUES (%s, %s, 'ref', 1.0, '{}'::jsonb)
        ON CONFLICT (src_id, dst_id, kind) DO NOTHING
    """, (nid, app_node))


def _remove_from_graph(cur, aid: str) -> None:
    cur.execute("DELETE FROM teca.nodes WHERE id = %s", (_to_node_id(aid),))


def list_apps() -> list[dict]:
    """Retorna todos apps do catálogo + counts por categoria/status."""
    with conn() as c, c.cursor() as cur:
        cur.execute("""
            SELECT app, categoria, status, COUNT(*) AS n
            FROM teca.aprendizados
            GROUP BY app, categoria, status
        """)
        rows = cur.fetchall()

    counts: dict[str, dict] = {}
    for r in rows:
        a = r["app"]
        counts.setdefault(a, {"total": 0, "por_categoria": {}, "por_status": {}})
        counts[a]["total"] += r["n"]
        counts[a]["por_categoria"][r["categoria"]] = counts[a]["por_categoria"].get(r["categoria"], 0) + r["n"]
        counts[a]["por_status"][r["status"]] = counts[a]["por_status"].get(r["status"], 0) + r["n"]

    out = []
    seen = set()
    for key, meta in APPS_CATALOGO.items():
        seen.add(key)
        out.append({
            "app": key,
            "label": meta["label"],
            "descricao": meta["descricao"],
            "setor": meta["setor"],
            "counts": counts.get(key, {"total": 0, "por_categoria": {}, "por_status": {}}),
        })
    # apps que apareceram no banco mas não estão no catálogo
    for a, c in counts.items():
        if a in seen:
            continue
        out.append({"app": a, "label": a.title(), "descricao": "", "setor": a, "counts": c})
    return out


def list_aprendizados(app: str | None = None, categoria: str | None = None,
                       status: str | None = None, limit: int = 200) -> list[dict]:
    where = []
    args: list = []
    if app:
        where.append("app = %s"); args.append(app)
    if categoria:
        where.append("categoria = %s"); args.append(categoria)
    if status:
        where.append("status = %s"); args.append(status)
    where_sql = ("WHERE " + " AND ".join(where)) if where else ""
    with conn() as c, c.cursor() as cur:
        cur.execute(f"""
            SELECT id, app, categoria, titulo, descricao, contexto, fonte,
                   prioridade, status, tags, autor_email, created_at, updated_at
            FROM teca.aprendizados
            {where_sql}
            ORDER BY
              CASE prioridade WHEN 'critica' THEN 0 WHEN 'alta' THEN 1 WHEN 'media' THEN 2 ELSE 3 END,
              created_at DESC
            LIMIT %s
        """, (*args, limit))
        return cur.fetchall()


def get(aid: str) -> dict | None:
    with conn() as c, c.cursor() as cur:
        cur.execute("SELECT * FROM teca.aprendizados WHERE id::text = %s", (aid,))
        return cur.fetchone()


def create(app: str, categoria: str, titulo: str,
           descricao: str | None = None, contexto: dict | None = None,
           fonte: str = "user_report", prioridade: str = "media",
           tags: list[str] | None = None, autor_email: str | None = None) -> dict:
    if categoria not in CATEGORIAS:
        raise ValueError(f"categoria inválida: {categoria}")
    if prioridade not in PRIORIDADES:
        raise ValueError(f"prioridade inválida: {prioridade}")
    with conn() as c, c.cursor() as cur:
        cur.execute("""
            INSERT INTO teca.aprendizados (app, categoria, titulo, descricao, contexto,
                                            fonte, prioridade, tags, autor_email)
            VALUES (%s, %s, %s, %s, %s::jsonb, %s, %s, %s, %s)
            RETURNING *
        """, (app, categoria, titulo, descricao, json.dumps(contexto or {}),
              fonte, prioridade, tags or [], autor_email))
        apr = cur.fetchone()
        _sync_to_graph(cur, apr)
        return apr


def update(aid: str, patch: dict) -> dict | None:
    allowed = {"titulo", "descricao", "contexto", "categoria", "prioridade",
               "status", "tags", "app"}
    fields = {k: v for k, v in patch.items() if k in allowed}
    if not fields:
        return get(aid)

    if "categoria" in fields and fields["categoria"] not in CATEGORIAS:
        raise ValueError("categoria inválida")
    if "prioridade" in fields and fields["prioridade"] not in PRIORIDADES:
        raise ValueError("prioridade inválida")
    if "status" in fields and fields["status"] not in STATUS_VALIDOS:
        raise ValueError("status inválido")

    sets = []
    args: list = []
    for k, v in fields.items():
        if k == "contexto":
            sets.append(f"{k} = %s::jsonb"); args.append(json.dumps(v))
        else:
            sets.append(f"{k} = %s"); args.append(v)
    args.append(aid)

    with conn() as c, c.cursor() as cur:
        cur.execute(f"""
            UPDATE teca.aprendizados
               SET {', '.join(sets)}
             WHERE id::text = %s
            RETURNING *
        """, args)
        apr = cur.fetchone()
        if apr:
            _sync_to_graph(cur, apr)
        return apr


def delete(aid: str) -> bool:
    with conn() as c, c.cursor() as cur:
        cur.execute("DELETE FROM teca.aprendizados WHERE id::text = %s RETURNING id", (aid,))
        row = cur.fetchone()
        if row:
            _remove_from_graph(cur, aid)
            return True
        return False


def reindex_all() -> dict:
    """Espelha TODOS os aprendizados no grafo (útil após import ou schema change)."""
    with conn() as c, c.cursor() as cur:
        cur.execute("SELECT * FROM teca.aprendizados")
        total = 0
        for apr in cur.fetchall():
            _sync_to_graph(cur, apr)
            total += 1
    return {"reindexed": total}


# ── Prompt de análise (pra colar no Claude Code) ────────────────
def build_analysis_prompt(aid: str) -> dict | None:
    """Monta um prompt rico pra Douglas colar no Claude Code e avaliar viabilidade.

    Inclui:
      - Identificação do aprendizado
      - Contexto do app (label + descrição)
      - RAG relacionado (top-5 nodes por similaridade)
      - Outros aprendizados do mesmo app (pra dar visão do estado geral)
      - Questões estruturadas pra guiar a análise
    """
    from .embeddings import embed_one

    apr = get(aid)
    if not apr:
        return None

    app_meta = APPS_CATALOGO.get(apr["app"], {"label": apr["app"].title(), "descricao": ""})

    # RAG relacionado (busca por similaridade no núcleo)
    query_text = f"{apr['titulo']}\n{apr.get('descricao') or ''}"
    vec = embed_one(query_text)
    rag_hits: list[dict] = []
    other_apr: list[dict] = []
    with conn() as c, c.cursor() as cur:
        cur.execute("""
            SELECT id, title, kind, setor,
                   1 - (embedding <=> %s::vector) AS score
            FROM teca.nodes
            WHERE embedding IS NOT NULL
              AND id <> %s
            ORDER BY embedding <=> %s::vector
            LIMIT 8
        """, (vec, f"aprendizado:{aid}", vec))
        for r in cur.fetchall():
            if r["score"] >= 0.30:
                rag_hits.append(r)

        cur.execute("""
            SELECT id, categoria, titulo, status, prioridade
            FROM teca.aprendizados
            WHERE app = %s AND id::text <> %s
            ORDER BY
              CASE prioridade WHEN 'critica' THEN 0 WHEN 'alta' THEN 1 WHEN 'media' THEN 2 ELSE 3 END,
              created_at DESC
            LIMIT 10
        """, (apr["app"], aid))
        other_apr = cur.fetchall()

    # Monta o prompt (markdown; user copia direto pro Claude Code)
    lines: list[str] = []
    lines.append(f"# Análise de aprendizado — {app_meta['label']}")
    lines.append("")
    lines.append("Sou o Douglas (Parket). Preciso da sua opinião sincera sobre uma sugestão que a Teca (nossa segunda-mente) levantou. Avalie viabilidade técnica, impacto real e ROI. Se não fizer sentido, seja franco.")
    lines.append("")
    lines.append("## Aprendizado")
    lines.append(f"- **App:** {app_meta['label']} — {app_meta['descricao']}")
    lines.append(f"- **Categoria:** `{apr['categoria']}`")
    lines.append(f"- **Prioridade sugerida:** `{apr['prioridade']}`")
    lines.append(f"- **Status atual:** `{apr['status']}`")
    lines.append(f"- **Fonte:** `{apr['fonte']}`")
    if apr.get("tags"):
        lines.append(f"- **Tags:** {', '.join(apr['tags'])}")
    lines.append("")
    lines.append(f"### Título")
    lines.append(apr["titulo"])
    lines.append("")
    if apr.get("descricao"):
        lines.append("### Descrição")
        lines.append(apr["descricao"])
        lines.append("")
    if apr.get("contexto"):
        import json as _json
        ctx = apr["contexto"]
        if isinstance(ctx, dict) and ctx:
            lines.append("### Contexto adicional (payload)")
            lines.append("```json")
            lines.append(_json.dumps(ctx, ensure_ascii=False, indent=2, default=str))
            lines.append("```")
            lines.append("")

    if rag_hits:
        lines.append("## Contexto relacionado do Núcleo (RAG)")
        lines.append("Nodes que a Teca julgou próximos por embedding:")
        lines.append("")
        for h in rag_hits:
            score = f"{h['score']:.2f}" if h.get("score") else "–"
            lines.append(f"- `{h['id']}` — **{h['title']}** ({h['kind']} · {h['setor']}) — score {score}")
        lines.append("")

    if other_apr:
        lines.append(f"## Outros aprendizados de {app_meta['label']}")
        lines.append("Pra você ter visão do estado geral do app:")
        lines.append("")
        for o in other_apr:
            lines.append(f"- [{o['status']} · {o['prioridade']}] **{o['titulo']}** _({o['categoria']})_")
        lines.append("")

    lines.append("## Pontos que quero você avaliar")
    lines.append("")
    lines.append("1. **Faz sentido tecnicamente?** O que está sendo proposto é a solução certa pro problema descrito, ou existe abordagem mais simples/direta?")
    lines.append("2. **Impacto real** — economia de tempo, redução de erro, ROI. Números aproximados se der.")
    lines.append("3. **Efeitos colaterais** — o que essa mudança pode quebrar? Depende de o quê?")
    lines.append("4. **Alternativas** — 1-2 caminhos diferentes que valeriam considerar.")
    lines.append("5. **Recomendação clara** — implementar, adiar, descartar, ou pivotar? Se implementar, sketch de arquitetura em 5 linhas.")
    lines.append("6. **Próximo passo concreto** — o que eu (ou a Teca) devo fazer HOJE se decidirmos avançar?")
    lines.append("")
    lines.append("Responda em português, tom Parket (direto, calmo). Sem enrolação.")
    lines.append("")
    lines.append(f"---")
    lines.append(f"_Aprendizado id `{aid}` · gerado em {apr['created_at'].strftime('%d/%m/%Y') if apr.get('created_at') else '–'}_")

    return {"id": aid, "app": apr["app"], "prompt": "\n".join(lines)}


# ── Sweep automático (cron 1x/dia) ─────────────────────────────
def _classify_app(pergunta: str) -> str | None:
    """Heurística leve: casa keywords → app. Se ambíguo, retorna None (não classifica)."""
    p = pergunta.lower()
    rules = [
        ("valoria",    ["valoria", "valor.parket", "simulador comercial", "valor.parket.works"]),
        ("draw",       ["draw", "desenho", "cad", "prancha", "layer", "elevação", "planta"]),
        ("status",     ["status", "cronograma", "mapa de obra", "quantitativo"]),
        ("proposta",   ["proposta", "propostagenerator", "renderer", "og preview", "link público"]),
        ("dashboard",  ["dashboard", "space parket", "golden", "hotpatch"]),
        ("teca_v2",    ["teca v2", "teka v2", "teca comercial", "whatsapp comercial", "atendimento comercial", "comercial - parket"]),
        ("homebroker", ["homebroker", "kanban", "lead", "vendedor", "wavoip"]),
        ("rh",         ["rh", "colaborador", "folha", "ponto", "férias", "clicksign"]),
        ("fiscal",     ["fiscal", "vistoria", "obra"]),
        ("teca",       ["teca", "núcleo teca", "pulsar", "sinapse", "aprendizado"]),
    ]
    for app, kws in rules:
        if any(k in p for k in kws):
            return app
    return None


def sweep_from_consultas(horas: int = 6) -> dict:
    """Analisa teca.consultas das últimas N horas e propõe aprendizados automáticos.

    Regras:
      - Perguntas repetidas (mesma pergunta ≥2x em janela) → padrao_repetitivo
      - Consultas sem contexto RAG (context_nodes vazio) → melhoria (indexar mais)
      - Consultas com SQL que deu erro → erro
    Cada aprendizado gerado tem slug estável (não duplica). fonte='observado_ia'.
    """
    horas = max(1, int(horas))
    import hashlib
    generated: list[dict] = []
    with conn() as c, c.cursor() as cur:
        # 1) Perguntas repetidas por app
        cur.execute(f"""
            SELECT pergunta, COUNT(*) AS n, MAX(created_at) AS last, ARRAY_AGG(usuario_email) AS emails
            FROM teca.consultas
            WHERE created_at > now() - interval '{horas} hour'
            GROUP BY pergunta
            HAVING COUNT(*) >= 2
            ORDER BY 2 DESC
            LIMIT 30
        """)
        for row in cur.fetchall():
            app = _classify_app(row["pergunta"])
            if not app:
                continue
            hkey = hashlib.md5(f"repet:{app}:{row['pergunta'][:80]}".encode()).hexdigest()[:12]
            titulo = f"Pergunta recorrente: \"{row['pergunta'][:70]}\""
            emails = [e for e in (row["emails"] or []) if e]
            desc = (
                f"Feita {row['n']}x nas últimas {horas}h por: {', '.join(set(emails)) or 'anônimos'}. "
                f"Última em {row['last'].strftime('%d/%m %H:%M')}. "
                "Candidato a atalho fixo, dashboard ou automação recorrente."
            )
            generated.append({
                "app": app, "categoria": "padrao_repetitivo",
                "titulo": titulo, "descricao": desc,
                "prioridade": "alta" if row["n"] >= 4 else "media",
                "tags": ["pergunta-recorrente", f"count-{row['n']}"],
                "contexto": {"hash": hkey, "sample_pergunta": row["pergunta"], "count": row["n"]},
            })

        # 2) Consultas sem contexto RAG (agrupadas por app inferido)
        cur.execute(f"""
            SELECT pergunta, created_at, usuario_email
            FROM teca.consultas
            WHERE created_at > now() - interval '{horas} hour'
              AND (node_ids IS NULL OR cardinality(node_ids) = 0)
            LIMIT 100
        """)
        por_app: dict[str, list[dict]] = {}
        for r in cur.fetchall():
            app = _classify_app(r["pergunta"])
            if app:
                por_app.setdefault(app, []).append(r)
        for app, rows in por_app.items():
            if len(rows) < 2:
                continue
            hkey = hashlib.md5(f"norag:{app}".encode()).hexdigest()[:12]
            exemplos = "; ".join(f'"{r["pergunta"][:60]}"' for r in rows[:3])
            generated.append({
                "app": app, "categoria": "melhoria",
                "titulo": f"{len(rows)} consulta(s) sem contexto RAG em {app}",
                "descricao": f"Últimas {horas}h, {len(rows)} perguntas responderam sem RAG. Considere indexar novos docs/memórias sobre esta área. Ex: {exemplos}",
                "prioridade": "media",
                "tags": ["rag-gap", "reindex"],
                "contexto": {"hash": hkey, "count": len(rows)},
            })

        # 3) Erros de query (mode 'sql' ou 'mix' com resposta muito curta / falha visível)
        cur.execute(f"""
            SELECT pergunta, resposta, created_at
            FROM teca.consultas
            WHERE created_at > now() - interval '{horas} hour'
              AND (resposta ILIKE '%%erro%%' OR resposta ILIKE '%%falhou%%' OR length(coalesce(resposta,'')) < 40)
              AND modo IN ('sql','mix')
            LIMIT 50
        """)
        por_app_err: dict[str, list[dict]] = {}
        for r in cur.fetchall():
            app = _classify_app(r["pergunta"])
            if app:
                por_app_err.setdefault(app, []).append(r)
        for app, rows in por_app_err.items():
            if len(rows) < 2:
                continue
            hkey = hashlib.md5(f"errsql:{app}".encode()).hexdigest()[:12]
            generated.append({
                "app": app, "categoria": "erro",
                "titulo": f"{len(rows)} consulta(s) SQL falharam ou respostas curtas em {app}",
                "descricao": f"Últimas {horas}h, {len(rows)} perguntas com modo SQL retornaram erro ou resposta <40 chars. Revisar system prompt, sample rows ou permissões teca_reader.",
                "prioridade": "alta",
                "tags": ["sql-error", "quality"],
                "contexto": {"hash": hkey, "count": len(rows)},
            })

    # Persiste — mas evita duplicatas pelo hash do contexto (últimos 30d)
    inserted, skipped = 0, 0
    with conn() as c, c.cursor() as cur:
        for g in generated:
            h = g["contexto"]["hash"]
            cur.execute("""
                SELECT id FROM teca.aprendizados
                WHERE contexto->>'hash' = %s
                  AND created_at > now() - interval '30 day'
                  AND status <> 'descartado'
                LIMIT 1
            """, (h,))
            if cur.fetchone():
                skipped += 1
                continue
            create(
                app=g["app"], categoria=g["categoria"], titulo=g["titulo"],
                descricao=g["descricao"], prioridade=g["prioridade"], tags=g["tags"],
                contexto=g["contexto"], fonte="observado_ia",
            )
            inserted += 1

    return {"generated": len(generated), "inserted": inserted, "skipped_duplicate": skipped, "window_horas": horas}


# ── Sweep Teca V2 (WhatsApp comercial) ─────────────────────────
_V2_INSTANCE = "Comercial - Parket"


def sweep_teca_v2(horas: int = 24) -> dict:
    """Observa mensagens da Teca V2 (WhatsApp instância comercial) e gera aprendizados.

    Regras:
      - Conversas sem resposta em > 30min (bot travou) → erro
      - Threads que passaram >5 mensagens IN sem OUT do bot → padrao_repetitivo
      - Cards sem card_id vinculado com muitas msgs → melhoria (roteamento)
      - Volume alto de mensagens em um dia → acerto (validação)
    Cada aprendizado tem hash estável no contexto pra evitar duplicata.
    """
    import hashlib
    from .db import reader

    horas = max(1, int(horas))
    horas_sql = str(int(horas))  # validado como int → seguro pra literal
    generated: list[dict] = []

    with reader() as c, c.cursor() as cur:
        # 0) Totais gerais como acerto (uma vez por dia por instância)
        cur.execute(
            "SELECT COUNT(*) AS n, COUNT(DISTINCT phone) AS phones, "
            "MAX(timestamp) AS last FROM public.whatsapp_messages "
            "WHERE instance = %s AND timestamp > now() - interval '24 hour'",
            (_V2_INSTANCE,),
        )
        totals = cur.fetchone()
        if totals and totals["n"] and totals["n"] >= 20:
            hkey = hashlib.md5(f"v2:volume:{totals['n']//50}".encode()).hexdigest()[:12]
            generated.append({
                "app": "teca_v2", "categoria": "acerto",
                "titulo": f"Teca V2 processou {totals['n']} mensagens em 24h",
                "descricao": (
                    f"Instância `{_V2_INSTANCE}` recebeu/enviou {totals['n']} msgs "
                    f"de {totals['phones']} contatos únicos nas últimas 24h. "
                    "Volume saudável — mantém acompanhamento."
                ),
                "prioridade": "baixa",
                "tags": ["volume", "kpi"],
                "contexto": {"hash": hkey, "count": totals["n"], "phones": totals["phones"]},
            })

        # 1) Conversas em que o cliente enviou N msgs seguidas sem resposta OUT
        cur.execute(
            f"""
            WITH janela AS (
              SELECT phone, direction, timestamp, card_id
              FROM public.whatsapp_messages
              WHERE instance = %s
                AND timestamp > now() - interval '{horas_sql} hour'
            ),
            silenciosos AS (
              SELECT phone,
                     COUNT(*) FILTER (WHERE direction = 'in')  AS n_in,
                     COUNT(*) FILTER (WHERE direction = 'out') AS n_out,
                     MAX(timestamp) AS last,
                     BOOL_OR(card_id IS NOT NULL) AS tem_card
              FROM janela
              GROUP BY phone
              HAVING COUNT(*) FILTER (WHERE direction = 'in') >= 5
                 AND COUNT(*) FILTER (WHERE direction = 'out') = 0
            )
            SELECT * FROM silenciosos ORDER BY n_in DESC LIMIT 20
            """,
            (_V2_INSTANCE,),
        )
        silenciosos = cur.fetchall()
        if silenciosos:
            hkey = hashlib.md5(f"v2:silent:{len(silenciosos)}:{horas}".encode()).hexdigest()[:12]
            exemplos = ", ".join(f"{r['phone']} ({r['n_in']} msgs)" for r in silenciosos[:5])
            generated.append({
                "app": "teca_v2", "categoria": "erro",
                "titulo": f"{len(silenciosos)} contato(s) sem resposta da Teca V2",
                "descricao": (
                    f"Últimas {horas}h: contatos com ≥5 msgs entrando e ZERO resposta OUT. "
                    f"Possível bot travado ou handoff perdido. Exemplos: {exemplos}."
                ),
                "prioridade": "critica" if len(silenciosos) >= 5 else "alta",
                "tags": ["bot-silencioso", "sla"],
                "contexto": {"hash": hkey, "count": len(silenciosos),
                             "phones": [r["phone"] for r in silenciosos[:20]]},
            })

        # 2) Contatos com muitas msgs mas SEM card_id vinculado
        cur.execute(
            f"""
            SELECT phone, COUNT(*) AS n
            FROM public.whatsapp_messages
            WHERE instance = %s
              AND timestamp > now() - interval '{horas_sql} hour'
              AND card_id IS NULL
            GROUP BY phone
            HAVING COUNT(*) >= 6
            ORDER BY 2 DESC LIMIT 20
            """,
            (_V2_INSTANCE,),
        )
        orfaos = cur.fetchall()
        if orfaos:
            hkey = hashlib.md5(f"v2:orfao:{len(orfaos)}".encode()).hexdigest()[:12]
            generated.append({
                "app": "teca_v2", "categoria": "melhoria",
                "titulo": f"{len(orfaos)} conversa(s) sem card no Kanban",
                "descricao": (
                    f"Últimas {horas}h: contatos com ≥6 msgs mas sem `card_id` vinculado. "
                    "Roteamento pro Homebroker está falhando OU falta criação automática de card. "
                    f"Top phones: {', '.join(r['phone'] for r in orfaos[:5])}"
                ),
                "prioridade": "media",
                "tags": ["roteamento", "kanban-link"],
                "contexto": {"hash": hkey, "count": len(orfaos)},
            })

        # 3) Padrão repetitivo: palavra/frase recorrente do cliente
        cur.execute(
            f"""
            SELECT lower(regexp_replace(message_text, '\\s+', ' ', 'g')) AS msg,
                   COUNT(*) AS n
            FROM public.whatsapp_messages
            WHERE instance = %s
              AND direction = 'in'
              AND timestamp > now() - interval '{horas_sql} hour'
              AND message_text IS NOT NULL
              AND length(message_text) BETWEEN 8 AND 80
            GROUP BY 1
            HAVING COUNT(*) >= 3
            ORDER BY 2 DESC LIMIT 10
            """,
            (_V2_INSTANCE,),
        )
        recorrentes = cur.fetchall()
        for r in recorrentes:
            msg = r["msg"]
            hkey = hashlib.md5(f"v2:recorr:{msg[:60]}".encode()).hexdigest()[:12]
            generated.append({
                "app": "teca_v2", "categoria": "padrao_repetitivo",
                "titulo": f'Mensagem recorrente: "{msg[:60]}"',
                "descricao": (
                    f"Recebida {r['n']}x nas últimas {horas}h por contatos distintos. "
                    "Candidato a resposta pronta / atalho no bot."
                ),
                "prioridade": "media" if r["n"] >= 5 else "baixa",
                "tags": ["frase-recorrente", "template"],
                "contexto": {"hash": hkey, "sample": msg, "count": r["n"]},
            })

    inserted, skipped = 0, 0
    with conn() as c, c.cursor() as cur:
        for g in generated:
            h = g["contexto"]["hash"]
            cur.execute("""
                SELECT id FROM teca.aprendizados
                WHERE contexto->>'hash' = %s
                  AND created_at > now() - interval '14 day'
                  AND status <> 'descartado'
                LIMIT 1
            """, (h,))
            if cur.fetchone():
                skipped += 1
                continue
            create(
                app=g["app"], categoria=g["categoria"], titulo=g["titulo"],
                descricao=g["descricao"], prioridade=g["prioridade"], tags=g["tags"],
                contexto=g["contexto"], fonte="observado_ia",
            )
            inserted += 1

    return {"generated": len(generated), "inserted": inserted,
            "skipped_duplicate": skipped, "window_horas": horas}


def history(app: str | None = None, limit: int = 100) -> list[dict]:
    """Timeline cronológica de aprendizados — todos os apps ou filtrado.

    Retorna ordenado por updated_at DESC pra ver evolução (novos + status changes).
    """
    where = []
    args: list = []
    if app:
        where.append("app = %s"); args.append(app)
    where_sql = ("WHERE " + " AND ".join(where)) if where else ""
    with conn() as c, c.cursor() as cur:
        cur.execute(f"""
            SELECT id, app, categoria, titulo, descricao, status, prioridade,
                   fonte, tags, autor_email, created_at, updated_at,
                   (updated_at > created_at + interval '1 minute') AS foi_atualizado
            FROM teca.aprendizados
            {where_sql}
            ORDER BY updated_at DESC
            LIMIT %s
        """, (*args, limit))
        return cur.fetchall()
