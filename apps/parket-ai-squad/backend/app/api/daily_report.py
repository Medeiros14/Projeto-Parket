"""
Endpoints para registro e consulta de atividades diárias.
"""
from fastapi import APIRouter
from pydantic import BaseModel
from app.core.daily_report import (
    registrar_atividade, get_atividades_hoje, get_atividades_semana,
    formatar_relatorio_diario, enviar_relatorio_diario,
)

router = APIRouter(prefix="/daily-report", tags=["daily-report"])


class AtividadeInput(BaseModel):
    descricao: str
    categoria: str = "geral"
    detalhes: str = ""


@router.post("/registrar")
async def registrar(body: AtividadeInput):
    registrar_atividade(body.descricao, body.categoria, body.detalhes)
    return {"ok": True}


@router.get("/hoje")
async def hoje():
    return {"atividades": get_atividades_hoje()}


@router.get("/semana")
async def semana():
    return {"atividades": get_atividades_semana()}


@router.get("/preview")
async def preview():
    return {"relatorio": formatar_relatorio_diario()}


@router.post("/enviar-agora")
async def enviar_agora():
    await enviar_relatorio_diario()
    return {"ok": True, "msg": "Relatório enviado ao grupo TI"}
