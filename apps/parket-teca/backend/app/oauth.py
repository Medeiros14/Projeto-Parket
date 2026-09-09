"""OAuth Anthropic com refresh automático.

Antes: TECA_ANTHROPIC_OAUTH_TOKEN era o access_token puro (Docker secret) e
expirava em 8h — exigia /login manual periódico.

Agora: tabela public.teca_oauth_tokens guarda access + refresh + expires_at.
Este módulo:
  1. Lê tokens do DB
  2. Se access vai expirar em <5min, troca refresh por novo par (rotate)
  3. Persiste o novo par (Anthropic gira o refresh a cada uso — não persistir queima a conta)
  4. Cache em memória 60s pra evitar hit DB toda call

Bootstrap (primeira execução): se DB vazio, seed inicial deve ser feito com o
refresh_token vindo do /root/.claude/.credentials.json (script seed_oauth_teca.py).
"""
from __future__ import annotations

import asyncio
import json
import time
from datetime import datetime, timezone
from typing import Optional

import httpx
import psycopg
import structlog

from .settings import settings

log = structlog.get_logger()

TOKEN_URL = "https://platform.claude.com/v1/oauth/token"
CLIENT_ID = "9d1c250a-e61b-44d9-88ed-5944d1962f5e"
REFRESH_BUFFER_SEC = 300  # renova quando falta <5min
CACHE_TTL_SEC = 60

_CACHE: dict = {"token": None, "expires_at": 0.0}
_LOCK = asyncio.Lock()


def _dsn() -> str:
    pw = settings.pg_password
    auth = f"{settings.pg_user}:{pw}" if pw else settings.pg_user
    return f"postgresql://{auth}@{settings.pg_host}:{settings.pg_port}/{settings.pg_db}"


def _fetch_row() -> Optional[dict]:
    with psycopg.connect(_dsn(), autocommit=True, connect_timeout=5) as c, c.cursor() as cur:
        cur.execute(
            "SELECT access_token, refresh_token, EXTRACT(EPOCH FROM expires_at) AS exp "
            "FROM public.teca_oauth_tokens WHERE provider='claude'"
        )
        row = cur.fetchone()
        if not row:
            return None
        return {"access": row[0], "refresh": row[1], "exp": float(row[2])}


def _persist(access: str, refresh: str, expires_in: int) -> None:
    with psycopg.connect(_dsn(), autocommit=True, connect_timeout=5) as c, c.cursor() as cur:
        cur.execute(
            """
            INSERT INTO public.teca_oauth_tokens (provider, access_token, refresh_token, expires_at, updated_at)
            VALUES ('claude', %s, %s, now() + (%s || ' seconds')::interval, now())
            ON CONFLICT (provider) DO UPDATE
              SET access_token = EXCLUDED.access_token,
                  refresh_token = EXCLUDED.refresh_token,
                  expires_at = EXCLUDED.expires_at,
                  updated_at = now()
            """,
            (access, refresh, expires_in),
        )


def _refresh_sync(refresh_token: str) -> Optional[dict]:
    try:
        with httpx.Client(timeout=15) as client:
            r = client.post(
                TOKEN_URL,
                json={
                    "grant_type": "refresh_token",
                    "refresh_token": refresh_token,
                    "client_id": CLIENT_ID,
                },
                headers={"Content-Type": "application/json", "User-Agent": "claude-cli/2.1.81"},
            )
        if r.status_code >= 400:
            log.error("teca_oauth_refresh_failed", status=r.status_code, body=r.text[:200])
            return None
        data = r.json()
        access = data.get("access_token")
        new_refresh = data.get("refresh_token", refresh_token)  # às vezes não vem, mantém antigo
        expires_in = int(data.get("expires_in", 28800))
        if not access:
            return None
        return {"access": access, "refresh": new_refresh, "expires_in": expires_in}
    except Exception as exc:
        log.error("teca_oauth_refresh_exception", error=str(exc))
        return None


async def get_token() -> str:
    """Retorna access_token válido. Refresha automaticamente se necessário."""
    now = time.time()

    # Cache warm
    if _CACHE["token"] and _CACHE["expires_at"] - now > REFRESH_BUFFER_SEC:
        return _CACHE["token"]

    async with _LOCK:
        # Re-check dentro do lock (outra call pode ter refreshado enquanto esperávamos)
        now = time.time()
        if _CACHE["token"] and _CACHE["expires_at"] - now > REFRESH_BUFFER_SEC:
            return _CACHE["token"]

        row = await asyncio.to_thread(_fetch_row)
        if not row:
            # Fallback: env var (secret Docker) — modo legacy pra 1º boot antes do seed
            legacy = settings.anthropic_oauth_token
            if legacy:
                log.warning("teca_oauth_using_legacy_env", reason="db_empty")
                _CACHE.update(token=legacy, expires_at=now + CACHE_TTL_SEC)
                return legacy
            raise RuntimeError("teca_oauth_tokens vazio e TECA_ANTHROPIC_OAUTH_TOKEN não setado")

        exp = row["exp"]
        # Ainda válido?
        if exp - now > REFRESH_BUFFER_SEC:
            _CACHE.update(token=row["access"], expires_at=exp)
            return row["access"]

        # Precisa refreshar
        if not row["refresh"]:
            log.warning("teca_oauth_expired_no_refresh")
            _CACHE.update(token=row["access"], expires_at=now + CACHE_TTL_SEC)
            return row["access"]

        new = await asyncio.to_thread(_refresh_sync, row["refresh"])
        if not new:
            # Refresh falhou — devolve access antigo (talvez ainda funcione)
            _CACHE.update(token=row["access"], expires_at=now + 30)
            return row["access"]

        await asyncio.to_thread(_persist, new["access"], new["refresh"], new["expires_in"])
        _CACHE.update(token=new["access"], expires_at=now + new["expires_in"])
        log.info("teca_oauth_refreshed", expires_in=new["expires_in"])
        return new["access"]


async def status() -> dict:
    """Debug: mostra estado atual sem expor token."""
    row = await asyncio.to_thread(_fetch_row)
    if not row:
        return {"ok": False, "error": "teca_oauth_tokens vazio"}
    now = time.time()
    return {
        "ok": True,
        "token_preview": (row["access"] or "")[:30],
        "expires_at_iso": datetime.fromtimestamp(row["exp"], tz=timezone.utc).isoformat(),
        "expires_in_sec": int(row["exp"] - now),
        "has_refresh_token": bool(row["refresh"]),
    }
