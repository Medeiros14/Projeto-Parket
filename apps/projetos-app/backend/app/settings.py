import os
from dataclasses import dataclass


@dataclass
class Settings:
    pg_host: str = os.getenv("PROJETOS_PG_HOST", "postgres")
    pg_port: int = int(os.getenv("PROJETOS_PG_PORT", "5432"))
    pg_db:   str = os.getenv("PROJETOS_PG_DB",   "postgres")
    pg_user: str = os.getenv("PROJETOS_PG_USER", "postgres")
    pg_password: str = os.getenv("PROJETOS_PG_PASSWORD", "")
    cors_origins: str = os.getenv("PROJETOS_CORS_ORIGINS", "https://projetos.parket.works")

    trello_key: str = os.getenv("TRELLO_KEY", "")
    trello_token: str = os.getenv("TRELLO_TOKEN", "")
    trello_board: str = os.getenv("TRELLO_BOARD", "CsJmU6DM")

    data_dir: str = os.getenv("PROJETOS_DATA_DIR", "/data")
    sync_interval_s: int = int(os.getenv("PROJETOS_SYNC_INTERVAL", "300"))

    supabase_url: str = os.getenv("SUPABASE_URL", "https://hbxpilrxmitvzebluoom.supabase.co")
    supabase_key: str = os.getenv("SUPABASE_SERVICE_KEY", "")

    # Sessão dos projetistas (cookie assinado).
    # NUNCA usar default em prod — deploy passa via env.
    session_secret: str = os.getenv("PROJETOS_SESSION_SECRET",
                                    "dev-only-change-me-in-prod")
    session_max_age_days: int = int(os.getenv("PROJETOS_SESSION_DAYS", "30"))

    # Mesmo JWT_SECRET do serviço parket-chat_chat: assina o token que o
    # widget do chat lê em sessionStorage["pk-chat-token"]. Vazio = widget
    # fica invisível (ver app/chat_token.py).
    chat_jwt_secret: str = os.getenv("PROJETOS_CHAT_JWT_SECRET", "")

    # Web push (VAPID). Sem valor default — se estiver vazio, push fica off.
    vapid_public_key:  str = os.getenv("VAPID_PUBLIC_KEY",  "")
    vapid_private_key: str = os.getenv("VAPID_PRIVATE_KEY", "")
    vapid_subject:     str = os.getenv("VAPID_SUBJECT",     "mailto:admin@parket.works")
    push_watcher_interval_s: int = int(os.getenv("PUSH_WATCHER_INTERVAL", "60"))


settings = Settings()
