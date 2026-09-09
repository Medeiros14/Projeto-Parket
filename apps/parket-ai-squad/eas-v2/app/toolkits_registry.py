"""Registry curado de toolkits do Agno ativáveis pela UI (/painel/toolkits).

Config fica em agno.toolkit_config; os agents montam as tools no boot.
Mudanças só valem após restart do serviço (POST /toolkits/apply).
"""

from __future__ import annotations

import json
import logging
import os
import time
from typing import Any

import psycopg

log = logging.getLogger(__name__)

BOOT_TS = time.time()

AGENT_IDS = ["assistant", "valoria_assistant"]

# Cada entrada: como importar/instanciar + quais campos de config a UI mostra.
# secret=True → valor nunca volta na API (só "configurada: sim/não").
REGISTRY: list[dict[str, Any]] = [
    {
        "id": "websearch",
        "label": "Busca Web",
        "description": "Pesquisa na web e notícias (Bing/Brave/Google — escolhe o que responder). Sem API key.",
        "module": "agno.tools.websearch",
        "cls": "WebSearchTools",
        # backend "auto": google/duckduckgo bloqueiam o IP do servidor (testado 09/07)
        "kwargs": {"backend": "auto", "region": "br-pt"},
        "fields": [],
    },
    {
        "id": "wikipedia",
        "label": "Wikipedia",
        "description": "Busca artigos da Wikipedia. Sem API key.",
        "module": "agno.tools.wikipedia",
        "cls": "WikipediaTools",
        "kwargs": {},
        "fields": [],
    },
    {
        "id": "website",
        "label": "Leitura de Páginas",
        "description": "Lê o conteúdo de uma URL (útil junto com a busca). Sem API key.",
        "module": "agno.tools.website",
        "cls": "WebsiteTools",
        "kwargs": {},
        "fields": [],
    },
    {
        "id": "youtube",
        "label": "YouTube",
        "description": "Extrai legendas/transcrição e metadados de vídeos. Sem API key.",
        "module": "agno.tools.youtube",
        "cls": "YouTubeTools",
        "kwargs": {},
        "fields": [],
    },
    {
        "id": "calculator",
        "label": "Calculadora",
        "description": "Operações matemáticas exatas (evita erro de conta do modelo). Sem API key.",
        "module": "agno.tools.calculator",
        "cls": "CalculatorTools",
        "kwargs": {},
        "fields": [],
    },
    {
        "id": "yfinance",
        "label": "Cotações (Yahoo Finance)",
        "description": "Cotações de moedas/ações e dados financeiros. Sem API key.",
        "module": "agno.tools.yfinance",
        "cls": "YFinanceTools",
        "kwargs": {},
        "fields": [],
    },
    {
        "id": "serper",
        "label": "Google via API (Serper)",
        "description": "Resultados reais do Google via serper.dev — robusto pra schedules. Precisa de API key.",
        "module": "agno.tools.serper",
        "cls": "SerperTools",
        "kwargs": {"location": "br", "language": "pt-br"},
        "fields": [
            {"name": "api_key", "label": "Serper API Key", "secret": True, "required": True}
        ],
    },
    {
        "id": "tavily",
        "label": "Busca Tavily",
        "description": "Busca via API otimizada pra agents (respostas resumidas). Precisa de API key.",
        "module": "agno.tools.tavily",
        "cls": "TavilyTools",
        "kwargs": {},
        "fields": [
            {"name": "api_key", "label": "Tavily API Key", "secret": True, "required": True}
        ],
    },
    {
        "id": "exa",
        "label": "Busca Exa (semântica)",
        "description": "Busca semântica + conteúdo de páginas via exa.ai. Precisa de API key.",
        "module": "agno.tools.exa",
        "cls": "ExaTools",
        "kwargs": {},
        "fields": [
            {"name": "api_key", "label": "Exa API Key", "secret": True, "required": True}
        ],
    },
    {
        "id": "firecrawl",
        "label": "Crawler Firecrawl",
        "description": "Scraping/crawling robusto de sites inteiros. Precisa de API key.",
        "module": "agno.tools.firecrawl",
        "cls": "FirecrawlTools",
        "kwargs": {},
        "fields": [
            {"name": "api_key", "label": "Firecrawl API Key", "secret": True, "required": True}
        ],
    },
    {
        "id": "openweather",
        "label": "Clima (OpenWeather)",
        "description": "Clima atual e previsão por cidade — útil pra agenda de obras. Precisa de API key.",
        "module": "agno.tools.openweather",
        "cls": "OpenWeatherTools",
        "kwargs": {"units": "metric"},
        "fields": [
            {"name": "api_key", "label": "OpenWeather API Key", "secret": True, "required": True}
        ],
    },
]

REGISTRY_BY_ID = {t["id"]: t for t in REGISTRY}

_CATALOG_CACHE: list[dict[str, Any]] | None = None


def scan_catalog() -> list[dict[str, Any]]:
    """Varre agno.tools por introspecção (137 módulos). Cache em memória —
    o scan importa todos os módulos e leva alguns segundos na 1ª chamada."""
    global _CATALOG_CACHE
    if _CATALOG_CACHE is not None:
        return _CATALOG_CACHE

    import importlib
    import inspect
    import pkgutil

    import agno.tools as pkg
    from agno.tools import Toolkit

    curated = {t["module"]: t["id"] for t in REGISTRY}
    items: list[dict[str, Any]] = []
    for m in pkgutil.iter_modules(pkg.__path__):
        if m.ispkg or m.name.startswith("_"):
            continue
        modname = f"agno.tools.{m.name}"
        item: dict[str, Any] = {
            "module": m.name,
            "classes": [],
            "description": "",
            "curated_id": curated.get(modname),
            "error": None,
        }
        try:
            mod = importlib.import_module(modname)
            classes = [
                (n, c)
                for n, c in inspect.getmembers(mod, inspect.isclass)
                if issubclass(c, Toolkit) and c is not Toolkit and c.__module__ == mod.__name__
            ]
            if not classes:
                continue
            item["classes"] = sorted(n for n, _ in classes)
            doc = ""
            for _, c in classes:
                d = inspect.getdoc(c)
                if d:
                    doc = d.strip().splitlines()[0]
                    break
            if not doc and (mod.__doc__ or "").strip():
                doc = mod.__doc__.strip().splitlines()[0]
            item["description"] = doc[:200]
            item["status"] = "curado" if item["curated_id"] else "disponivel"
        except Exception as exc:  # noqa: BLE001
            item["status"] = "requer_dependencia"
            item["error"] = str(exc)[:200]
        items.append(item)

    order = {"curado": 0, "disponivel": 1, "requer_dependencia": 2}
    items.sort(key=lambda i: (order[i["status"]], i["module"]))
    _CATALOG_CACHE = items
    return items


def _dsn() -> str:
    return os.environ["DATABASE_URL"].replace("postgresql+psycopg://", "postgresql://")


def _connect():
    return psycopg.connect(_dsn(), autocommit=True)


def ensure_table() -> None:
    with _connect() as conn:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS agno.toolkit_config (
                toolkit_id text PRIMARY KEY,
                enabled boolean NOT NULL DEFAULT false,
                agents text[] NOT NULL DEFAULT '{assistant}',
                config jsonb NOT NULL DEFAULT '{}'::jsonb,
                last_error text,
                updated_at timestamptz NOT NULL DEFAULT now()
            )
            """
        )


def load_state() -> dict[str, dict[str, Any]]:
    ensure_table()
    state: dict[str, dict[str, Any]] = {}
    with _connect() as conn:
        rows = conn.execute(
            "SELECT toolkit_id, enabled, agents, config, last_error, "
            "extract(epoch from updated_at) FROM agno.toolkit_config"
        ).fetchall()
    for tid, enabled, agents, config, last_error, updated_epoch in rows:
        state[tid] = {
            "enabled": enabled,
            "agents": list(agents or []),
            "config": config or {},
            "last_error": last_error,
            "updated_epoch": float(updated_epoch or 0),
        }
    return state


def save_state(
    toolkit_id: str,
    enabled: bool,
    agents: list[str],
    config: dict[str, Any],
) -> None:
    with _connect() as conn:
        conn.execute(
            """
            INSERT INTO agno.toolkit_config (toolkit_id, enabled, agents, config, last_error, updated_at)
            VALUES (%s, %s, %s, %s::jsonb, NULL, now())
            ON CONFLICT (toolkit_id) DO UPDATE
            SET enabled = EXCLUDED.enabled, agents = EXCLUDED.agents,
                config = EXCLUDED.config, last_error = NULL, updated_at = now()
            """,
            (toolkit_id, enabled, agents, json.dumps(config)),
        )


def _record_error(toolkit_id: str, error: str) -> None:
    try:
        with _connect() as conn:
            conn.execute(
                "UPDATE agno.toolkit_config SET last_error = %s WHERE toolkit_id = %s",
                (error[:500], toolkit_id),
            )
    except Exception:  # noqa: BLE001
        pass


def build_agent_tools() -> dict[str, list[Any]]:
    """Instancia os toolkits habilitados. Falha de 1 toolkit não derruba o boot."""
    tools: dict[str, list[Any]] = {aid: [] for aid in AGENT_IDS}
    try:
        state = load_state()
    except Exception as exc:  # noqa: BLE001
        log.error("toolkit_config indisponível, subindo sem toolkits extras: %s", exc)
        return tools

    for entry in REGISTRY:
        row = state.get(entry["id"])
        if not row or not row["enabled"]:
            continue
        missing = [
            f["name"] for f in entry["fields"]
            if f.get("required") and not (row["config"].get(f["name"]) or "").strip()
        ]
        if missing:
            _record_error(entry["id"], f"campos obrigatórios faltando: {', '.join(missing)}")
            continue
        try:
            module = __import__(entry["module"], fromlist=[entry["cls"]])
            cls = getattr(module, entry["cls"])
            kwargs = dict(entry["kwargs"])
            for f in entry["fields"]:
                val = (row["config"].get(f["name"]) or "").strip()
                if val:
                    kwargs[f["name"]] = val
            instance = cls(**kwargs)
        except Exception as exc:  # noqa: BLE001
            log.error("toolkit %s falhou ao instanciar: %s", entry["id"], exc)
            _record_error(entry["id"], str(exc))
            continue
        for aid in row["agents"]:
            if aid in tools:
                tools[aid].append(instance)
        log.info("toolkit %s ativo em %s", entry["id"], row["agents"])
    return tools
