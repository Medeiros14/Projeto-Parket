"""Rotas admin de toolkits (/toolkits) — consumidas por /painel/toolkits na UI.

Auth própria (Bearer OS_SECURITY_KEY) pra não depender do middleware do AgentOS
cobrir routers custom.
"""

from __future__ import annotations

import logging
import os
import subprocess
from typing import Any, Optional

from fastapi import APIRouter, Header, HTTPException
from pydantic import BaseModel

from app.toolkits_registry import (
    AGENT_IDS,
    BOOT_TS,
    REGISTRY,
    REGISTRY_BY_ID,
    load_state,
    save_state,
    scan_catalog,
)

log = logging.getLogger(__name__)

router = APIRouter(prefix="/toolkits", tags=["Toolkits"])


def _check_auth(authorization: Optional[str]) -> None:
    key = os.environ.get("OS_SECURITY_KEY", "")
    if not key or authorization != f"Bearer {key}":
        raise HTTPException(status_code=401, detail="Authorization header required")


def _serialize(entry: dict[str, Any], row: dict[str, Any] | None) -> dict[str, Any]:
    config = (row or {}).get("config", {})
    return {
        "id": entry["id"],
        "label": entry["label"],
        "description": entry["description"],
        "requires_key": bool(entry["fields"]),
        "fields": [
            {
                "name": f["name"],
                "label": f["label"],
                "secret": bool(f.get("secret")),
                "required": bool(f.get("required")),
                "set": bool((config.get(f["name"]) or "").strip()),
            }
            for f in entry["fields"]
        ],
        "enabled": bool((row or {}).get("enabled")),
        "agents": (row or {}).get("agents", []),
        "last_error": (row or {}).get("last_error"),
    }


@router.get("")
def list_toolkits(authorization: Optional[str] = Header(None)) -> dict[str, Any]:
    _check_auth(authorization)
    state = load_state()
    pending = any(r.get("updated_epoch", 0) > BOOT_TS for r in state.values())
    return {
        "agents": AGENT_IDS,
        "pending_restart": pending,
        "toolkits": [_serialize(e, state.get(e["id"])) for e in REGISTRY],
    }


@router.get("/catalog")
def toolkit_catalog(authorization: Optional[str] = Header(None)) -> dict[str, Any]:
    _check_auth(authorization)
    items = scan_catalog()
    counts: dict[str, int] = {}
    for i in items:
        counts[i["status"]] = counts.get(i["status"], 0) + 1
    return {"total": len(items), "counts": counts, "items": items}


class ToolkitUpdate(BaseModel):
    enabled: Optional[bool] = None
    agents: Optional[list[str]] = None
    config: Optional[dict[str, str]] = None


@router.put("/{toolkit_id}")
def update_toolkit(
    toolkit_id: str,
    body: ToolkitUpdate,
    authorization: Optional[str] = Header(None),
) -> dict[str, Any]:
    _check_auth(authorization)
    entry = REGISTRY_BY_ID.get(toolkit_id)
    if not entry:
        raise HTTPException(status_code=404, detail=f"toolkit desconhecido: {toolkit_id}")

    state = load_state()
    row = state.get(toolkit_id) or {"enabled": False, "agents": ["assistant"], "config": {}}

    enabled = row["enabled"] if body.enabled is None else bool(body.enabled)
    agents = row["agents"] if body.agents is None else [a for a in body.agents if a in AGENT_IDS]
    if enabled and not agents:
        raise HTTPException(status_code=422, detail="selecione pelo menos 1 agent")

    valid_fields = {f["name"] for f in entry["fields"]}
    config = dict(row["config"])
    for k, v in (body.config or {}).items():
        # valor vazio = manter o que já está salvo (UI não reenvia secrets)
        if k in valid_fields and v.strip():
            config[k] = v.strip()

    if enabled:
        missing = [
            f["label"] for f in entry["fields"]
            if f.get("required") and not (config.get(f["name"]) or "").strip()
        ]
        if missing:
            raise HTTPException(
                status_code=422,
                detail=f"preencha antes de ativar: {', '.join(missing)}",
            )

    save_state(toolkit_id, enabled, agents, config)
    log.info("toolkit %s salvo enabled=%s agents=%s", toolkit_id, enabled, agents)
    fresh = load_state().get(toolkit_id)
    return {"ok": True, "toolkit": _serialize(entry, fresh), "pending_restart": True}


@router.post("/apply")
def apply_changes(authorization: Optional[str] = Header(None)) -> dict[str, Any]:
    _check_auth(authorization)
    try:
        subprocess.Popen(
            ["docker", "service", "update", "--detach", "--force", "parket-ai-squad_eas"],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=f"falha ao reiniciar: {exc}")
    return {"ok": True, "message": "Serviço reiniciando — mudanças ativas em ~30s"}
