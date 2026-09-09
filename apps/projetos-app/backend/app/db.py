import psycopg
from psycopg.rows import dict_row
from contextlib import contextmanager
from .settings import settings


def _dsn() -> str:
    pw = settings.pg_password
    auth = f"{settings.pg_user}:{pw}" if pw else settings.pg_user
    return f"postgresql://{auth}@{settings.pg_host}:{settings.pg_port}/{settings.pg_db}"


@contextmanager
def conn():
    with psycopg.connect(_dsn(), row_factory=dict_row, autocommit=True) as c:
        yield c
