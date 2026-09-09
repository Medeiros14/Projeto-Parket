"""LISTEN/NOTIFY worker — escuta teca_graph_change e invalida cache do grafo.

Roda como task asyncio no lifespan do FastAPI. Reconecta em caso de queda.
"""
import asyncio
import json
import logging
import psycopg

from .settings import settings

log = logging.getLogger("teca.listener")

CHANNEL = "teca_graph_change"


def _dsn() -> str:
    auth = f"{settings.pg_user}:{settings.pg_password}" if settings.pg_password else settings.pg_user
    return f"postgresql://{auth}@{settings.pg_host}:{settings.pg_port}/{settings.pg_db}"


async def listen(on_change) -> None:
    """Loop persistente que reconecta com backoff exponencial."""
    delay = 1.0
    while True:
        try:
            async with await psycopg.AsyncConnection.connect(_dsn(), autocommit=True) as aconn:
                async with aconn.cursor() as cur:
                    await cur.execute(f"LISTEN {CHANNEL}")
                log.info("[teca.listener] LISTEN %s ativo", CHANNEL)
                delay = 1.0
                async for notify in aconn.notifies():
                    try:
                        payload = json.loads(notify.payload) if notify.payload else {}
                    except Exception:
                        payload = {"raw": notify.payload}
                    try:
                        on_change(payload)
                    except Exception as e:
                        log.warning("[teca.listener] on_change falhou: %s", e)
        except Exception as e:
            log.warning("[teca.listener] conexão caiu (%s), reconectando em %.1fs", e, delay)
            await asyncio.sleep(delay)
            delay = min(delay * 2, 30.0)
