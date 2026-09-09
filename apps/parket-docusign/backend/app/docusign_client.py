"""Cliente leve do DocuSign — JWT auth + chamadas REST diretas via httpx.

Evita o SDK oficial (docusign-esign) porque ele é pesado e o que precisamos
é só JWT + 3 endpoints REST: criar envelope, ler status, download. httpx
nativo é simples e mantém o container pequeno."""
from __future__ import annotations
import time
import httpx
import jwt
import structlog
from typing import Any

from .config import get_settings

log = structlog.get_logger(__name__)

_token_cache: dict = {"token": None, "exp": 0, "base_uri": None}


async def _get_token() -> tuple[str, str]:
    """Retorna (access_token, base_uri) — cacheado por ~55 min."""
    s = get_settings()
    now = int(time.time())
    if _token_cache["token"] and _token_cache["exp"] > now + 60:
        return _token_cache["token"], _token_cache["base_uri"]

    if not s.docusign_private_key_pem:
        raise RuntimeError("DocuSign private key não configurada")

    assertion = jwt.encode(
        {
            "iss": s.docusign_integration_key,
            "sub": s.docusign_user_id,
            "aud": s.oauth_base.replace("https://", ""),
            "iat": now,
            "exp": now + 3600,
            "scope": "signature impersonation",
        },
        s.docusign_private_key_pem,
        algorithm="RS256",
    )

    async with httpx.AsyncClient(timeout=30) as c:
        r = await c.post(
            f"{s.oauth_base}/oauth/token",
            data={
                "grant_type": "urn:ietf:params:oauth:grant-type:jwt-bearer",
                "assertion": assertion,
            },
        )
        if r.status_code != 200:
            log.error("docusign_jwt_failed", status=r.status_code, body=r.text[:400])
            raise RuntimeError(f"DocuSign JWT auth falhou: HTTP {r.status_code}")
        data = r.json()
        token = data["access_token"]
        expires_in = int(data.get("expires_in", 3600))

        # Pega base_uri via userinfo
        ui = await c.get(
            f"{s.oauth_base}/oauth/userinfo",
            headers={"Authorization": f"Bearer {token}"},
        )
        base_uri = s.api_base
        if ui.status_code == 200:
            accounts = ui.json().get("accounts", [])
            for acc in accounts:
                if acc.get("account_id") == s.docusign_api_account_id:
                    base_uri = f"{acc['base_uri']}/restapi"
                    break

    _token_cache["token"] = token
    _token_cache["exp"] = now + expires_in
    _token_cache["base_uri"] = base_uri
    log.info("docusign_token_refreshed", base_uri=base_uri, expires_in=expires_in)
    return token, base_uri


async def _api_url(path: str) -> str:
    _, base = await _get_token()
    s = get_settings()
    return f"{base}/v2.1/accounts/{s.docusign_api_account_id}{path}"


async def create_envelope(payload: dict[str, Any]) -> dict[str, Any]:
    token, _ = await _get_token()
    url = await _api_url("/envelopes")
    async with httpx.AsyncClient(timeout=60) as c:
        r = await c.post(
            url,
            headers={
                "Authorization": f"Bearer {token}",
                "Content-Type": "application/json",
            },
            json=payload,
        )
    if r.status_code >= 400:
        log.error("docusign_create_envelope_failed",
                  status=r.status_code, body=r.text[:600])
        raise RuntimeError(f"DocuSign HTTP {r.status_code}: {r.text[:200]}")
    return r.json()


async def get_envelope(envelope_id: str) -> dict[str, Any]:
    token, _ = await _get_token()
    url = await _api_url(f"/envelopes/{envelope_id}")
    async with httpx.AsyncClient(timeout=30) as c:
        r = await c.get(url, headers={"Authorization": f"Bearer {token}"})
    if r.status_code >= 400:
        raise RuntimeError(f"DocuSign HTTP {r.status_code}: {r.text[:200]}")
    return r.json()


async def get_envelope_recipients(envelope_id: str) -> dict[str, Any]:
    token, _ = await _get_token()
    url = await _api_url(f"/envelopes/{envelope_id}/recipients")
    async with httpx.AsyncClient(timeout=30) as c:
        r = await c.get(url, headers={"Authorization": f"Bearer {token}"})
    if r.status_code >= 400:
        raise RuntimeError(f"DocuSign HTTP {r.status_code}: {r.text[:200]}")
    return r.json()


async def get_envelope_combined_pdf(envelope_id: str) -> bytes:
    """Baixa o PDF combinado (todos os documentos + certificado de assinatura)."""
    token, _ = await _get_token()
    url = await _api_url(f"/envelopes/{envelope_id}/documents/combined")
    async with httpx.AsyncClient(timeout=120) as c:
        r = await c.get(url, headers={"Authorization": f"Bearer {token}"})
    if r.status_code >= 400:
        raise RuntimeError(f"DocuSign HTTP {r.status_code}: {r.text[:200]}")
    return r.content


async def update_signer_client_user_id(envelope_id: str, recipient_id: str, client_user_id: str) -> dict[str, Any]:
    """Adiciona/atualiza clientUserId no signer — necessário pra gerar
    embedded signing URL via /views/recipient."""
    token, _ = await _get_token()
    url = await _api_url(f"/envelopes/{envelope_id}/recipients")
    payload = {
        "signers": [{
            "recipientId": recipient_id,
            "clientUserId": client_user_id,
        }],
    }
    async with httpx.AsyncClient(timeout=30) as c:
        # resend_envelope=false pra NÃO redisparar email
        r = await c.put(url + "?resend_envelope=false", headers={
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
        }, json=payload)
    if r.status_code >= 400:
        raise RuntimeError(f"DocuSign update signer HTTP {r.status_code}: {r.text[:200]}")
    return r.json() if r.text else {}


async def create_recipient_view(envelope_id: str, recipient_id: str,
                                 name: str, email: str, client_user_id: str,
                                 return_url: str) -> str:
    """Gera URL embedded pro signer assinar via web. URL válida ~5 min, uso único."""
    token, _ = await _get_token()
    url = await _api_url(f"/envelopes/{envelope_id}/views/recipient")
    payload = {
        "returnUrl": return_url,
        "authenticationMethod": "none",
        "email": email,
        "userName": name,
        "recipientId": recipient_id,
        "clientUserId": client_user_id,
    }
    async with httpx.AsyncClient(timeout=30) as c:
        r = await c.post(url, headers={
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
        }, json=payload)
    if r.status_code >= 400:
        raise RuntimeError(f"DocuSign recipient view HTTP {r.status_code}: {r.text[:300]}")
    return r.json().get("url", "")


async def void_envelope(envelope_id: str, reason: str = "Cancelado pelo Space") -> dict[str, Any]:
    token, _ = await _get_token()
    url = await _api_url(f"/envelopes/{envelope_id}")
    async with httpx.AsyncClient(timeout=30) as c:
        r = await c.put(
            url,
            headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
            json={"status": "voided", "voidedReason": reason[:200]},
        )
    if r.status_code >= 400:
        raise RuntimeError(f"DocuSign HTTP {r.status_code}: {r.text[:200]}")
    return r.json() if r.text else {}
