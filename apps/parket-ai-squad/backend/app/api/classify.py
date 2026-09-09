"""
Endpoint de classificação de texto via Claude (OAuth).
Usado pelo Dashboard para classificar respostas de prestadores no check diário de obras.
"""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from app.core.account_pool import account_pool
from app.database import AsyncSessionLocal

router = APIRouter(tags=["classify"])


class ClassifyRequest(BaseModel):
    texto: str
    contexto: str = "O prestador de obras foi perguntado se está tudo bem na obra ou se tem alguma ocorrência."


class ClassifyResponse(BaseModel):
    status: str  # "ok" ou "ocorrencia"
    resumo: str | None = None


@router.post("/classify/check-obra", response_model=ClassifyResponse)
async def classify_check_obra(req: ClassifyRequest):
    """Classifica a resposta de um prestador como OK ou Ocorrência usando Claude."""
    system_prompt = """Você é um assistente que classifica mensagens de prestadores de obras de construção.
O contexto: o prestador foi perguntado se está tudo bem na obra ou se tem alguma ocorrência.

Regras de classificação:
- "ok" = tudo normal, sem problemas, obra fluindo bem
- "ocorrencia" = qualquer problema, falta de material, atraso, defeito, reclamação, dificuldade, situação anormal

Responda APENAS com JSON puro (sem markdown), no formato:
{"status": "ok"} ou {"status": "ocorrencia", "resumo": "breve descrição do problema"}"""

    messages = [{"role": "user", "content": f"Resposta do prestador: \"{req.texto}\""}]

    try:
        async with AsyncSessionLocal() as db:
            raw = await account_pool.chat(
                db=db,
                messages=messages,
                system_prompt=system_prompt,
            )
        # Extrai JSON
        import json, re
        match = re.search(r"\{[^}]+\}", raw)
        if match:
            parsed = json.loads(match.group(0))
            return ClassifyResponse(
                status=parsed.get("status", "ocorrencia"),
                resumo=parsed.get("resumo"),
            )
        # Se não encontrou JSON, analisa o texto
        if "ok" in raw.lower() and "ocorrencia" not in raw.lower():
            return ClassifyResponse(status="ok")
        return ClassifyResponse(status="ocorrencia", resumo=raw[:200])
    except Exception as e:
        raise HTTPException(500, f"Erro ao classificar: {str(e)[:200]}")
