"""FastAPI do Valoria Teca — endpoint mínimo com dois modos.

Rotas:
  GET  /health       — liveness (público)
  GET  /debug/oauth  — status do OAuth Anthropic (público, sem token)
  POST /runs         — SSE (multipart/form-data compat com o EAS antigo)

Frontend Valoria (agentApi.ts) monta FormData com { message, stream, session_id, files }.
Streaming SSE em formato Agno-compat pro frontend continuar zero-touch.
Arquitetura interna: multi-agent (router + specialists) via orchestrator.py.
"""
from __future__ import annotations

import asyncio
import base64
import binascii
import json
from typing import Optional

import structlog
from fastapi import FastAPI, Form, Header, HTTPException, Request, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, StreamingResponse

from app import oauth
from app.orchestrator import run_orchestrated
from app.settings import BASIC_PASS, BASIC_USER, MODEL_ID

log = structlog.get_logger()
app = FastAPI(title="Valoria Teca", version="0.2.0")

# CORS: permite qualquer subdomínio parket.works (valor, gestao, homebroker,
# teca, verifica, instala, contrato, draw, proposta, staging.*).
app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=r"https://([a-z0-9-]+\.)*parket\.works",
    allow_credentials=True,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["*"],
    expose_headers=["*"],
    max_age=3600,
)


def _check_basic_auth(auth_header: Optional[str]) -> None:
    if not BASIC_USER:
        return
    if not auth_header or not auth_header.lower().startswith("basic "):
        raise HTTPException(status_code=401, detail="basic auth required")
    try:
        decoded = base64.b64decode(auth_header.split(" ", 1)[1]).decode()
    except (binascii.Error, UnicodeDecodeError):
        raise HTTPException(status_code=401, detail="invalid basic auth")
    if decoded != f"{BASIC_USER}:{BASIC_PASS}":
        raise HTTPException(status_code=401, detail="bad credentials")


@app.get("/health")
async def health():
    return {"status": "ok", "model": MODEL_ID, "architecture": "multi-agent"}


@app.get("/debug/oauth")
async def debug_oauth():
    return oauth.status()


@app.post("/runs")
async def runs(
    request: Request,
    message: str = Form(...),
    stream: str = Form("true"),
    session_id: Optional[str] = Form(None),
    context: Optional[str] = Form(None),
    files: Optional[list[UploadFile]] = None,
    authorization: Optional[str] = Header(None),
):
    _check_basic_auth(authorization)

    file_blocks: list[tuple[str, str, bytes]] = []
    for f in files or []:
        data = await f.read()
        mime = f.content_type or "application/octet-stream"
        file_blocks.append((f.filename or "arquivo", mime, data))
        log.info("file_received", name=f.filename, mime=mime, size=len(data))

    if stream.lower() == "true":
        return StreamingResponse(
            run_orchestrated(message, session_id, context, file_blocks),
            media_type="text/event-stream",
            headers={
                "Cache-Control": "no-cache",
                "X-Accel-Buffering": "no",
                "Connection": "keep-alive",
            },
        )

    # non-stream: consome o gerador e monta payload JSON compat com o cliente antigo
    async def collect() -> dict:
        full_parts: list[str] = []
        sid_out: Optional[str] = None
        status_line: Optional[str] = None
        async for chunk in run_orchestrated(message, session_id, context, file_blocks):
            for line in chunk.decode().splitlines():
                if not line.startswith("data:"):
                    continue
                payload = line[5:].strip()
                if not payload or payload == "[DONE]":
                    continue
                try:
                    evt = json.loads(payload)
                except json.JSONDecodeError:
                    continue
                if not sid_out and evt.get("session_id"):
                    sid_out = evt["session_id"]
                if evt.get("event") == "RunContent":
                    full_parts.append(evt.get("content", ""))
                elif evt.get("event") == "RunError":
                    status_line = evt.get("content")
        return {
            "session_id": sid_out,
            "content": "".join(full_parts),
            "status": status_line or "ok",
        }

    return JSONResponse(await collect())
