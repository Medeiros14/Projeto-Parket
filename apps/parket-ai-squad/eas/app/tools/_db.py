"""Helpers de DB pra os módulos de tools. Conexão psycopg sync (simples e robusta)."""

from contextlib import contextmanager

import psycopg
from psycopg.rows import dict_row

from app.config import settings


def conn_url() -> str:
    return (
        f"postgresql://{settings.db_user}:{settings.db_password}"
        f"@{settings.db_host}:{settings.db_port}/{settings.db_name}"
    )


@contextmanager
def conn(autocommit: bool = True):
    with psycopg.connect(conn_url(), autocommit=autocommit) as c:
        c.execute(f"SET search_path TO {settings.db_schema}, public")
        yield c


def fetch_one(sql: str, params: tuple = ()) -> dict | None:
    with conn() as c, c.cursor(row_factory=dict_row) as cur:
        cur.execute(sql, params)
        return cur.fetchone()


def fetch_all(sql: str, params: tuple = ()) -> list[dict]:
    with conn() as c, c.cursor(row_factory=dict_row) as cur:
        cur.execute(sql, params)
        return cur.fetchall()


def execute(sql: str, params: tuple = ()) -> int:
    with conn() as c, c.cursor() as cur:
        cur.execute(sql, params)
        return cur.rowcount
