from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    # Postgres (parket-pg-local, alias 'postgres' na rede parket-api_internal)
    pg_host: str = "postgres"
    pg_port: int = 5432
    pg_db: str = "postgres"
    pg_user: str = "postgres"
    pg_password: str = ""
    pg_reader_user: str = "teca_reader"

    # Anthropic — OAuth token (sk-ant-oat…) vindo do /root/.claude/.credentials.json
    anthropic_oauth_token: str = ""
    anthropic_api_key: str = ""      # opcional (fallback)
    claude_model: str = "claude-sonnet-4-5-20250929"

    # GoTrue (opcional — sem quebra se vazio)
    gotrue_jwt_secret: str = ""

    # Ingest paths
    memory_dir: str = "/data/memory"
    docs_dirs: str = "/data/docs"    # csv de paths

    # CORS
    cors_origins: str = "https://teca.parket.works"

    model_config = SettingsConfigDict(env_prefix="TECA_", env_file=None, extra="ignore")


settings = Settings()
