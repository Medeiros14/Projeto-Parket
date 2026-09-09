import os
from dataclasses import dataclass


@dataclass
class Settings:
    pg_host: str = os.getenv("GESTAO_PG_HOST", "postgres")
    pg_port: int = int(os.getenv("GESTAO_PG_PORT", "5432"))
    pg_db:   str = os.getenv("GESTAO_PG_DB",   "postgres")
    pg_user: str = os.getenv("GESTAO_PG_USER", "postgres")
    pg_password: str = os.getenv("GESTAO_PG_PASSWORD", "")
    cors_origins: str = os.getenv("GESTAO_CORS_ORIGINS", "https://gestao.parket.works")


settings = Settings()
