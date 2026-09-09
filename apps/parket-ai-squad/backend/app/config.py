from pydantic_settings import BaseSettings
from typing import List


class Settings(BaseSettings):
    # Database
    POSTGRES_HOST: str = "postgres"
    POSTGRES_PORT: int = 5432
    POSTGRES_DB: str = "parket_ai"
    POSTGRES_USER: str = "parket"
    POSTGRES_PASSWORD: str = "changeme"

    # Redis
    REDIS_URL: str = "redis://redis:6379/0"

    # Evolution API
    EVOLUTION_API_URL: str = "https://conect.parket.works"
    EVOLUTION_API_KEY: str = ""
    EVOLUTION_INSTANCE: str = "Parket"
    # Instância dedicada ao funil comercial de entrada (leads via DM)
    EVOLUTION_COMERCIAL_API_KEY: str = ""
    EVOLUTION_COMERCIAL_INSTANCE: str = "Comercial - Parket"
    # Instância dedicada ao Check Diário / disparos para prestadores de obras
    EVOLUTION_SECRETARIA_API_KEY: str = "474070258960-4AF5-8CA8-3A563BCBC52E"
    EVOLUTION_SECRETARIA_INSTANCE: str = "Secretaria - Obras Parket"
    WEBHOOK_SECRET: str = ""

    # OpenCode
    OPENCODE_URL: str = "http://opencode:4096"
    OPENCODE_PASSWORD: str = "parket-opencode-secret"
    OPENCODE_USERNAME: str = "opencode"

    # Google OAuth2 (for Gemini)
    GOOGLE_CLIENT_ID: str = ""
    GOOGLE_CLIENT_SECRET: str = ""

    # App
    SECRET_KEY: str = "changeme-secret"
    BACKEND_CORS_ORIGINS: str = "http://localhost:3000"
    API_URL: str = "https://agente.parket.works"

    # Meta Pixel + Conversions API (tracking de Lead + Qualified Lead)
    META_PIXEL_ID: str = ""
    META_CAPI_TOKEN: str = ""
    META_TEST_EVENT_CODE: str = ""
    META_GRAPH_VER: str = "v21.0"

    # Google Ads Data Manager HTTPS pull (Offline Conversion Import via gclid).
    # Endpoint /api/gads/conversions.csv exige Basic Auth com estes valores.
    GADS_BASIC_USER: str = ""
    GADS_BASIC_PASS: str = ""
    # Nome da Conversion Action criada no painel Google Ads (case-sensitive).
    GADS_CONV_ACTION_QUALIFIED: str = "Lead Qualificado"

    # Admin credentials
    ADMIN_USERNAME: str = "admin"
    ADMIN_PASSWORD: str = "admin"

    # Embeddings
    EMBEDDING_MODEL: str = "paraphrase-multilingual-MiniLM-L12-v2"
    EMBEDDING_DIMENSION: int = 384

    # Supabase
    SUPABASE_URL: str = "https://trobwhdbcsckpdhufzzt.supabase.co"
    SUPABASE_ANON_KEY: str = ""
    SUPABASE_SERVICE_KEY: str = ""

    # PMO Alerter
    PMO_WHATSAPP_GROUP_ID: str = ""  # JID do grupo WhatsApp de Produtividade

    # Financeiro Squad
    FINANCEIRO_WHATSAPP_GROUP_ID: str = ""  # JID do grupo WhatsApp Financeiro

    # Squad Parket IA (antigo TI)
    TI_WHATSAPP_GROUP_ID: str = ""      # JID do grupo WhatsApp do Squad Parket IA
    TI_OWNER_PHONES: str = ""           # Números autorizados a executar comandos (vírgula-separados)

    # Claude Code Runner (host-side HTTP service)
    CLAUDE_RUNNER_URL: str = "http://172.18.0.1:9191"  # Host gateway IP acessível dos containers Docker
    CLAUDE_RUNNER_SECRET: str = "ti-runner-secret-parket"

    # Media Processing
    WHISPER_URL: str = ""             # parket-whisper self-hosted (ex: http://parket-whisper_api:8080); vazio = pula
    OPENAI_API_KEY: str = ""          # Whisper speech-to-text para áudio
    GEMINI_API_KEY: str = ""          # Gemini transcrição de áudio (aceita OGG/Opus nativo, sem ffmpeg)
    GROQ_API_KEY: str = ""            # Groq Whisper (whisper-large-v3-turbo) — primário rápido e barato
    ANTHROPIC_API_KEY: str = ""       # Claude Vision para imagens (fallback se OAuth indisponível)
    MEDIA_MAX_SIZE_MB: int = 25       # Tamanho máximo de arquivo para download (MB)

    @property
    def DATABASE_URL(self) -> str:
        return (
            f"postgresql+asyncpg://{self.POSTGRES_USER}:{self.POSTGRES_PASSWORD}"
            f"@{self.POSTGRES_HOST}:{self.POSTGRES_PORT}/{self.POSTGRES_DB}"
        )

    @property
    def SYNC_DATABASE_URL(self) -> str:
        return (
            f"postgresql://{self.POSTGRES_USER}:{self.POSTGRES_PASSWORD}"
            f"@{self.POSTGRES_HOST}:{self.POSTGRES_PORT}/{self.POSTGRES_DB}"
        )

    @property
    def CORS_ORIGINS(self) -> List[str]:
        return [s.strip() for s in self.BACKEND_CORS_ORIGINS.split(",") if s.strip()]

    class Config:
        env_file = ".env"
        case_sensitive = True


settings = Settings()
