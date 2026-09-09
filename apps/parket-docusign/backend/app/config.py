"""Config carrega secrets dos Docker Secrets ou env vars."""
from __future__ import annotations
import os
from functools import lru_cache
from pathlib import Path


def _read_secret(name: str, env_fallback: str | None = None) -> str:
    """Lê env var (prioridade — permite override), depois cai pro secret file.
    Retorna '' se nem um nem outro."""
    env_val = os.getenv(env_fallback or name.upper(), "").strip()
    if env_val:
        return env_val
    p = Path(f"/run/secrets/{name}")
    if p.exists():
        return p.read_text().strip()
    return ""


class Settings:
    # DocuSign
    docusign_integration_key: str = ""
    docusign_user_id: str = ""
    docusign_api_account_id: str = ""
    docusign_environment: str = "sandbox"
    docusign_private_key_pem: str = ""
    docusign_webhook_secret: str = ""

    # Supabase (service_role pra escrever em contratos_docusign)
    supabase_url: str = ""
    supabase_service_key: str = ""

    @property
    def oauth_base(self) -> str:
        return "https://account-d.docusign.com" if self.docusign_environment == "sandbox" \
            else "https://account.docusign.com"

    @property
    def api_base(self) -> str:
        # Em prod o base_uri vem do userinfo. Pra sandbox é sempre demo.docusign.net.
        if self.docusign_environment == "sandbox":
            return "https://demo.docusign.net/restapi"
        # Pra prod, o real base_uri é descoberto via userinfo no DocusignClient.
        # Fallback aponta pra na4 (região da conta Parket).
        return os.getenv("DOCUSIGN_API_BASE", "https://na4.docusign.net/restapi")


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    s = Settings()
    s.docusign_integration_key = _read_secret("docusign_integration_key", "DOCUSIGN_INTEGRATION_KEY")
    s.docusign_user_id = _read_secret("docusign_user_id", "DOCUSIGN_USER_ID")
    s.docusign_api_account_id = _read_secret("docusign_api_account_id", "DOCUSIGN_API_ACCOUNT_ID")
    s.docusign_environment = _read_secret("docusign_environment", "DOCUSIGN_ENVIRONMENT") or "sandbox"
    s.docusign_private_key_pem = _read_secret("docusign_private_key", "DOCUSIGN_PRIVATE_KEY_PEM")
    s.docusign_webhook_secret = _read_secret("docusign_webhook_secret", "DOCUSIGN_WEBHOOK_SECRET")
    s.supabase_url = _read_secret("supabase_url", "SUPABASE_URL")
    s.supabase_service_key = _read_secret("supabase_service_key", "SUPABASE_SERVICE_KEY")
    return s
