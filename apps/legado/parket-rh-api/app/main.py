"""parket-rh-api — Backend dedicado do módulo RH.

Atende rh.parket.works/api/* via proxy nginx do parket-rh_web.
Endpoints principais:
  /api/clicksign/*  — integração Clicksign (envio em massa, webhook, status, PDFs)
  /api/healthz      — healthcheck
"""
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings


@asynccontextmanager
async def lifespan(app: FastAPI):
    yield


app = FastAPI(title="Parket RH API", version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS.split(","),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

from app.api import clicksign, holerites, assinatura_interna
app.include_router(clicksign.router)
app.include_router(holerites.router)
app.include_router(assinatura_interna.router)


@app.get("/api/healthz")
async def healthz():
    return {"ok": True, "service": "parket-rh-api"}
