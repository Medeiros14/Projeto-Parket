"""Session auth — cookie HttpOnly assinado.

Substitui o basic auth Traefik. Suporta também basic auth como fallback
(via header Authorization) pra CLI/curl.
"""

from __future__ import annotations

import base64
import hashlib
import hmac
import os
import time
from typing import Optional

import structlog

log = structlog.get_logger()

# Credenciais — vêm de env. Mantemos compatíveis com a senha basic auth existente.
USER = os.environ.get("EAS_AUTH_USER", "will")
# Default: a mesma senha do basic auth (não-hash; vamos comparar com constant-time)
PASSWORD = os.environ.get("EAS_AUTH_PASSWORD", "si3QFmepJS9qlCnDrFyW")


def _load_users() -> dict[str, str]:
    """Lê EAS_USERS no formato `user1:pass1,user2:pass2,...`. Sempre inclui o user legado."""
    users = {USER: PASSWORD}
    raw = os.environ.get("EAS_USERS", "")
    for entry in raw.split(","):
        entry = entry.strip()
        if not entry or ":" not in entry:
            continue
        u, p = entry.split(":", 1)
        u, p = u.strip(), p.strip()
        if u and p:
            users[u] = p
    return users


USERS = _load_users()

# Chave de assinatura HMAC pra cookies. Fallback DETERMINÍSTICO (derivado da senha):
# chave aleatória por boot invalidava toda sessão a cada restart/deploy do serviço.
SIGNING_KEY = (
    os.environ.get("EAS_SESSION_SIGNING_KEY")
    or hashlib.sha256(f"eas-session-v1:{PASSWORD}".encode()).hexdigest()
)
COOKIE_NAME = "eas_session"
COOKIE_MAX_AGE = 7 * 24 * 3600  # 7 dias


def _sign(payload: bytes) -> str:
    sig = hmac.new(SIGNING_KEY.encode(), payload, hashlib.sha256).digest()
    return base64.urlsafe_b64encode(sig).decode().rstrip("=")


def issue_token(user: str) -> str:
    """Gera token assinado: user|exp|sig (base64url-safe)."""
    exp = int(time.time()) + COOKIE_MAX_AGE
    payload = f"{user}|{exp}".encode()
    body = base64.urlsafe_b64encode(payload).decode().rstrip("=")
    sig = _sign(payload)
    return f"{body}.{sig}"


def verify_token(token: str) -> Optional[str]:
    """Retorna user se token válido (assinatura OK e não expirado), senão None."""
    if not token or "." not in token:
        return None
    body, sig = token.split(".", 1)
    try:
        # Restaura padding
        pad = (-len(body)) % 4
        payload = base64.urlsafe_b64decode(body + ("=" * pad))
    except Exception:
        return None
    expected = _sign(payload)
    if not hmac.compare_digest(expected, sig):
        return None
    try:
        user, exp_str = payload.decode().split("|", 1)
        exp = int(exp_str)
    except Exception:
        return None
    if time.time() > exp:
        return None
    return user


def check_credentials(user: str, password: str) -> bool:
    """Verificação constant-time multi-user."""
    if not user or not password:
        return False
    expected = USERS.get(user)
    if not expected:
        # Comparação dummy pra constant-time mesmo em user inexistente
        hmac.compare_digest(password.encode(), PASSWORD.encode())
        return False
    return hmac.compare_digest(password.encode(), expected.encode())


def parse_basic_auth(header_value: str) -> Optional[tuple[str, str]]:
    """Decoda 'Basic <b64>' → (user, password) ou None."""
    if not header_value or not header_value.startswith("Basic "):
        return None
    try:
        raw = base64.b64decode(header_value[6:].strip()).decode()
        if ":" not in raw:
            return None
        u, p = raw.split(":", 1)
        return u, p
    except Exception:
        return None
