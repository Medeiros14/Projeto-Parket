"""
Supabase Context Injector para o path OAuth
============================================
Como o path primário usa OAuth (sem tool calling), este módulo injeta
dados do Supabase diretamente no system prompt antes de chamar o LLM.

Cada agente pode definir em sua config:
  supabase_context: ["orcamento_tabela_precos", "alertas", ...]

Além disso, há contextos automáticos por dept_id.
"""

import httpx
import json
import structlog

from app.config import settings

logger = structlog.get_logger(__name__)

SUPABASE_URL = settings.SUPABASE_URL.rstrip("/")
SUPABASE_KEY = settings.SUPABASE_SERVICE_KEY or settings.SUPABASE_ANON_KEY
HEADERS = {
    "apikey": SUPABASE_KEY,
    "Authorization": f"Bearer {SUPABASE_KEY}",
}


async def _query(table: str, params: dict, limit: int = 100) -> list:
    params.setdefault("select", "*")
    params.setdefault("limit", str(limit))
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(
                f"{SUPABASE_URL}/rest/v1/{table}",
                headers=HEADERS,
                params=params,
            )
            if resp.status_code == 200:
                return resp.json()
    except Exception as e:
        logger.warning("supabase_context_query_error", table=table, error=str(e))
    return []


_precos_cache: dict = {"data": None, "ts": 0.0}
CACHE_TTL = 300  # 5 minutos


async def fetch_orcamento_precos() -> str:
    """
    Carrega tabela de preços completa em formato ultra-compacto (CSV-like).
    Usa cache de 5 minutos. Sempre retorna todos os produtos ativos.
    """
    import time
    global _precos_cache

    now = time.time()
    if _precos_cache["data"] is None or (now - _precos_cache["ts"]) > CACHE_TTL:
        rows = await _query(
            "orcamento_tabela_precos",
            {"ativo": "eq.true", "order": "categoria.asc,ordem.asc"},
            limit=200,
        )
        _precos_cache["data"] = rows
        _precos_cache["ts"] = now
    else:
        rows = _precos_cache["data"]

    if not rows:
        return ""

    # Formato ultra-compacto: categoria|especie|subtipo|dimensao|preco
    lines = ["TABELA DE PREÇOS PARKET (categoria|produto|dimensão|R$/m²):"]
    for r in rows:
        cat   = r.get("categoria", "")
        esp   = r.get("especie_nome") or r.get("especie_id", "")
        sub   = r.get("subtipo", "")
        orig  = r.get("origem", "")
        dim   = r.get("dimensao_label", "")
        preco = float(r.get("preco", 0))
        nome  = esp
        if sub and sub.lower() not in esp.lower(): nome += f" {sub}"
        if orig and orig.lower() not in esp.lower(): nome += f" [{orig}]"
        linha = f"{cat}|{nome}|{dim}|R${preco:.0f}"
        lines.append(linha)

    return "\n".join(lines)


async def fetch_context_for_agent(db_agent, user_message: str = "") -> str:
    """
    Busca contexto Supabase relevante para o agente e retorna como string compacta.
    Para o agente orçamentista: sempre injeta tabela completa de preços.
    Outros agentes: usa config.supabase_context para tabelas extras.
    """
    config = db_agent.config or {}
    dept_id = config.get("dept_id", "")
    agent_name = (db_agent.name or "").lower()
    supabase_ctx = config.get("supabase_context", [])

    parts = []

    # Orçamento: sempre injeta tabela de preços completa (necessária para calcular)
    # Normaliza nome para comparação sem acentos
    import unicodedata
    def _norm(s: str) -> str:
        return unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode().lower()

    agent_name_norm = _norm(agent_name)
    is_orcamento = (
        "orcament" in agent_name_norm
        or dept_id == "comercial"
        or "orcamento_tabela_precos" in supabase_ctx
    )
    if is_orcamento:
        try:
            precos = await fetch_orcamento_precos()
            if precos:
                parts.append(precos)
                logger.info("supabase_context_injected", agent=db_agent.name,
                            table="orcamento_tabela_precos", chars=len(precos))
        except Exception as e:
            logger.warning("supabase_context_orcamento_error", error=str(e))

    # Tabelas extras configuradas no agente
    for table in supabase_ctx:
        if table == "orcamento_tabela_precos":
            continue
        try:
            rows = await _query(table, {}, limit=30)
            if rows:
                snippet = json.dumps(rows, ensure_ascii=False, default=str)[:2000]
                parts.append(f"[{table.upper()}]\n{snippet}")
        except Exception as e:
            logger.warning("supabase_context_table_error", table=table, error=str(e))

    return "\n\n".join(parts)
