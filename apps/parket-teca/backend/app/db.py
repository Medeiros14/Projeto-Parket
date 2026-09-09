import psycopg
from psycopg.rows import dict_row
from contextlib import contextmanager
from .settings import settings


def _dsn(role: str | None = None) -> str:
    user = role or settings.pg_user
    pw = settings.pg_password if user == settings.pg_user else ""
    auth = f"{user}:{pw}" if pw else user
    return f"postgresql://{auth}@{settings.pg_host}:{settings.pg_port}/{settings.pg_db}"


@contextmanager
def conn(role: str | None = None):
    with psycopg.connect(_dsn(role), row_factory=dict_row, autocommit=True) as c:
        yield c


@contextmanager
def reader():
    """Sandbox read-only via SET ROLE teca_reader — a conexão continua sendo
    do superuser mas com privilégios rebaixados até RESET ROLE."""
    with psycopg.connect(_dsn(), row_factory=dict_row, autocommit=True) as c:
        with c.cursor() as cur:
            cur.execute("SET ROLE teca_reader")
            cur.execute("SET statement_timeout = '15s'")   # cloud_ro (FDW) precisa de mais folga
            cur.execute("SET idle_in_transaction_session_timeout = '18s'")
        try:
            yield c
        finally:
            with c.cursor() as cur:
                cur.execute("RESET ROLE")
