"""Chat router LLM — decide entre SQL sandbox, RAG semântico ou mix."""
import json
import re
import sqlparse
from .db import conn, reader
from .embeddings import embed_one
from . import claude_client


SYSTEM_BASE = """Você é o Núcleo Teca da Parket — segunda mente da empresa.
Tem acesso ao banco (parket-pg-local, schemas: public, rh, core, erp, orcamento_produtos, signer, teca, cloud_ro) e à memória indexada (docs, memórias do Douglas, briefings).

FONTES DE DADOS:
- **schemas public/rh/core/erp/orcamento_produtos** — cópia LOCAL do Supabase Parket. Rápido, mas pode estar 6-24h atrás.
- **schema cloud_ro** — foreign tables (postgres_fdw) apontando pro Supabase Cloud AO VIVO. Fresco, mas cada query dá ~200-800ms overhead. Espelha ~30 tabelas críticas: simulacao_projetos, simulacao_itens, kanban_cards, kanban_card_messages, card_events, orcamento_tabela_precos, user_profiles, whatsapp_messages, colaboradores, contratos, lancamentos, financeiro_contas_receber/pagar, etc.
- **Regra**: se a pergunta é sobre HOJE ou "agora"/último dia → use cloud_ro. Se é agregado histórico → use schema local (mais rápido). Se em dúvida, use local e mencione a defasagem.

TABELAS-CHAVE (não confunda):
- **public.simulacao_projetos** (~660 rows) / **cloud_ro.simulacao_projetos** (~676 rows) — PROPOSTAS ativas do simulador. Campos: id, numero, cliente, status ('rascunho'|'enviada'), created_at, vendedor, card_id, card_comercial_id.
- **public.simulacao_itens** / **cloud_ro.simulacao_itens** — itens de cada proposta (produtos, m², preço). FK: proposta_id.
- **public.orcamento_propostas** (0 rows) — tabela antiga/vazia, NÃO usar.
- **public.kanban_cards** / **cloud_ro.kanban_cards** (~6k rows) — cards Comercial/Obras. Campos: id, title, dept_id, column_id, responsavel, updated_at, progress.
- **public.kanban_columns** — colunas do Kanban (id é uuid, kanban_cards.column_id é text — comparar com CAST).
- **public.user_profiles** / **cloud_ro.user_profiles** — vendedores/usuários (email, full_name, role, funcao_comercial, dept_permissions).
- **public.whatsapp_messages** / **cloud_ro.whatsapp_messages** (~128k rows) — histórico WhatsApp dos cards comerciais.
- **rh.colaboradores** / **cloud_ro.colaboradores** (~160 rows) — folha/CLT.
- **orcamento_produtos.*** — schema novo do módulo "Material/Fornecimento", ainda não consolidado.
- **teca.aprendizados** — histórico do que a Teca aprende sobre cada app (Valoria, Draw, Status, etc). Campos: app, categoria (erro|acerto|melhoria|automacao|padrao_repetitivo), titulo, descricao, prioridade, status, tags. Consulte quando o usuário perguntar "o que vc já aprendeu sobre X?", "quais melhorias pendentes na Y?", ou "o que dá pra automatizar em Z?".

REGRAS ABSOLUTAS DE FORMATO:
- **NUNCA** escreva frases de intenção como "vou verificar", "vou buscar", "aguarde", "deixa eu consultar", "um momento", "vou executar", "vou analisar", "vou rodar", "primeiro vou…". Não anuncie o que vai fazer — simplesmente FAÇA.
- Quando precisar de SQL, emita `<sql>…</sql>` SEM texto antes. O backend executa e você responde no próximo turno já com o resultado em mãos.
- Sua resposta final ao usuário DEVE ser a resposta em si — nunca um pedido pra aguardar.
- Não descreva seu raciocínio interno. Não fale "primeiro consultei X, depois cruzei com Y" — dê a resposta e cite fontes no fim se relevante.

REGRAS GERAIS:
- Responda em português do Brasil, direto, sem enrolação, com tom Parket (calmo, seguro).
- Cite fontes com [nome_do_node] quando usar RAG.
- Se precisar de dado do banco, gere UMA query SELECT read-only dentro de <sql>…</sql> — o backend executa e devolve o resultado.
- Nunca gere UPDATE/DELETE/INSERT/DROP/ALTER/GRANT/CREATE.
- Limite queries a 200 linhas com LIMIT explícito.
- Prefira JOINs simples e legíveis.
- Antes de fazer discovery em information_schema, olhe o contexto RAG: os nodes de tabela trazem colunas + sample rows.
- Se a pergunta for exploratória/de opinião, use apenas contexto RAG.
"""


# ─── SQL sandbox ───────────────────────────────────────────────
_FORBIDDEN = re.compile(r"\b(insert|update|delete|drop|alter|grant|revoke|truncate|create|comment|do|call|copy)\b", re.I)


def is_safe_select(sql: str) -> tuple[bool, str]:
    s = sql.strip().rstrip(";")
    if not s:
        return False, "vazio"
    parsed = sqlparse.parse(s)
    if len(parsed) != 1:
        return False, "múltiplos statements"
    stmt = parsed[0]
    kw = stmt.get_type()
    if kw != "SELECT":
        return False, f"tipo {kw} não permitido"
    if _FORBIDDEN.search(s):
        return False, "keyword proibida detectada"
    return True, ""


def run_sql(sql: str, max_rows: int = 200) -> dict:
    ok, reason = is_safe_select(sql)
    if not ok:
        return {"error": reason}
    s = sql.strip().rstrip(";")
    if "limit" not in s.lower():
        s = f"{s} LIMIT {max_rows}"
    try:
        with reader() as c, c.cursor() as cur:
            cur.execute(s)
            rows = cur.fetchall()
            cols = [d[0] for d in cur.description] if cur.description else []
            return {"columns": cols, "rows": rows[:max_rows], "count": len(rows)}
    except Exception as e:
        return {"error": str(e)}


# ─── RAG ──────────────────────────────────────────────────────
def semantic_search(query: str, k: int = 8) -> list[dict]:
    v = embed_one(query)
    with conn() as c, c.cursor() as cur:
        cur.execute("""
            SELECT id, kind, title, body, schema_name, setor, meta,
                   1 - (embedding <=> %s::vector) AS score
            FROM teca.nodes
            WHERE embedding IS NOT NULL
            ORDER BY embedding <=> %s::vector
            LIMIT %s
        """, (v, v, k))
        return cur.fetchall()


# ─── Router principal ─────────────────────────────────────────
async def answer(pergunta: str, usuario_email: str | None = None, persona: dict | None = None) -> dict:
    from .persona import persona_prompt

    hits = semantic_search(pergunta, k=6)

    ctx = "\n\n".join([
        f"### [{h['id']}] {h['title']} (setor={h['setor']}, score={h['score']:.2f})\n{(h['body'] or '')[:900]}"
        for h in hits
    ]) or "(sem contexto relevante indexado)"

    persona_block = persona_prompt(persona) if persona else (
        f"Usuário anônimo (email={usuario_email or 'não informado'})."
    )

    prompt = f"""## Persona
{persona_block}

## Contexto recuperado (RAG)
{ctx}

## Pergunta
{pergunta}

Se precisar de dados do banco, emita <sql>SELECT …</sql>. Caso contrário, responda direto.
"""
    convo = [{"role": "user", "content": prompt}]
    modo = "rag"
    last_sql: str | None = None
    last_sql_result: dict | None = None

    # Loop: até 5 iterações — permite discovery + refinamento + resposta final
    MAX_ITERS = 5
    final = ""
    for it in range(MAX_ITERS):
        text = await claude_client.chat(convo, system_prompt=SYSTEM_BASE, max_tokens=2000)
        convo.append({"role": "assistant", "content": text})

        m = re.search(r"<sql>(.+?)</sql>", text, re.DOTALL | re.IGNORECASE)
        if not m:
            final = text
            break

        sql = m.group(1).strip()
        result = run_sql(sql)
        last_sql = sql
        last_sql_result = result
        modo = "mix" if hits else "sql"

        if "error" in result and it < MAX_ITERS - 1:
            convo.append({"role": "user", "content":
                f"Erro na query:\n{result['error']}\n\nCorrija e emita <sql>SELECT novo</sql>."})
            continue

        payload_txt = json.dumps(result, default=str, ensure_ascii=False)[:6000]
        # Permite mais uma rodada de SQL se o LLM quiser refinar, exceto na última iteração
        allow_more = it < MAX_ITERS - 2
        followup = (
            f"Resultado da query ({result.get('count', 0)} linhas):\n{payload_txt}\n\n"
            + ("Se precisar de mais um SELECT pra refinar, emita <sql>…</sql>. "
               if allow_more else
               "Agora responda ao usuário em prosa, SEM mais <sql>. ")
            + "Cite fontes RAG com [id] quando relevante."
        )
        convo.append({"role": "user", "content": followup})
        if not allow_more:
            final = await claude_client.chat(convo, system_prompt=SYSTEM_BASE, max_tokens=2500)
            break

    # Sanitiza tags <sql> residuais no texto final (proteção pra frontend)
    final_clean = re.sub(r"<sql>.*?</sql>", "", final, flags=re.DOTALL | re.IGNORECASE).strip()

    node_ids = [h["id"] for h in hits]
    cited = sorted(set(re.findall(r"\[([a-z]+:[^\]]+)\]", final_clean)))

    return {
        "resposta": final_clean or final,
        "modo": modo,
        "sql": last_sql,
        "sql_result": last_sql_result,
        "citations": cited or node_ids[:4],
        "context_nodes": node_ids,
    }
