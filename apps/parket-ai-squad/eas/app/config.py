"""EAS — configuração centralizada via env vars."""

from typing import Literal
from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="EAS_", extra="ignore")

    # Ambiente
    env: Literal["dev", "prod"] = Field(default="dev")

    # Postgres compartilhado (mesmo do parket-ai-squad, schema isolado eas)
    db_host: str = Field(default="postgres")
    db_port: int = Field(default=5432)
    db_name: str = Field(default="parket_ai")
    db_user: str = Field(default="parket")
    db_password: str = Field(default="")
    db_schema: str = Field(default="eas")

    # Modelos default — alinhados com teca_v2 já em produção
    model_default: str = Field(default="claude-sonnet-4-6")
    model_tech_lead: str = Field(default="claude-opus-4-7")

    # Anthropic
    anthropic_api_key: str = Field(default="")

    # WhatsApp Will (confirmação humana)
    will_phone: str = Field(default="5511939213329")
    evolution_url: str = Field(default="https://conect.parket.works")
    evolution_api_key: str = Field(default="")
    evolution_instance: str = Field(default="Parket")
    # Backlog Parket — grupo de notificações de execução (fire-and-forget)
    backlog_group_jid: str = Field(default="120363427142145139@g.us")

    # OpenCode sandbox (executor de edição de código)
    opencode_url: str = Field(default="http://opencode:4096")
    opencode_user: str = Field(default="opencode")
    opencode_password: str = Field(default="")

    # MCP Supabase (tools)
    supabase_mcp_url: str = Field(default="http://supabase-mcp:8001")

    # Supabase principal (claude_atividades, kanban)
    supabase_url: str = Field(default="https://api.parket.works")
    supabase_service_key: str = Field(default="")

    @property
    def db_url(self) -> str:
        return (
            f"postgresql+psycopg://{self.db_user}:{self.db_password}"
            f"@{self.db_host}:{self.db_port}/{self.db_name}"
        )

    @property
    def is_prod(self) -> bool:
        return self.env == "prod"


settings = Settings()
