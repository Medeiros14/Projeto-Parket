"""Workflow resumo-orcamentos — piloto Workflows + Schedules.

Pipeline determinístico: coleta o kanban de orçamento (PostgREST) → agente
redige análise executiva → envia DM WhatsApp via Evolution. Disparo pelo
schedule (POST /workflows/resumo-orcamentos/runs) ou manual.

Envio SÓ pra DM: grupos (@g.us) estão sob kill switch desde 30/06.
"""

from __future__ import annotations

import json
import logging
import os
from collections import Counter
from datetime import datetime
from zoneinfo import ZoneInfo

import requests
from urllib.parse import quote

from agno.agent import Agent
from agno.workflow import Step, Workflow
from agno.workflow.types import StepInput, StepOutput

from app.claude_oauth import ClaudeOAuth

log = logging.getLogger(__name__)

TZ = ZoneInfo("America/Sao_Paulo")

# mapeamentos idênticos ao relatorio-orcamento-diario.sh (fonte: kanban_cards)
BUCKETS = {
    "proposta-pronta": "pronta", "0b42aa6f-a57c-4849-a1ab-60575c8370ef": "pronta",
    "proposta-aceita": "aceita", "ab2db441-d797-424d-bfb2-061c95725d5c": "aceita",
    "analise-douglas": "douglas", "0611d39f-8406-4c45-922b-f702e852ce71": "douglas",
    "refazer": "refazer", "0ca10e14-2170-466e-90df-786d866b793e": "refazer",
    "handoff-com": "comercial", "565e4d85-ca2a-4f94-b424-ea645d1f02ca": "comercial",
    "em-progresso": "progresso", "6ecf80dc-a11b-49a8-af58-8a691de89700": "progresso",
    "analise-orc": "analise", "6209d128-64fe-4715-8a27-36efa3200be4": "analise",
    "solicitacao": "solicitacao", "0ebd8644-ad72-4bae-9b44-c37cf04def89": "solicitacao",
    "projetos-rani": "projetos", "e1df6c42-0164-4a7f-b197-aca5f25c5abf": "projetos",
}
BUCKET_LABEL = {
    "solicitacao": "Solicitação", "analise": "Análise Orç.", "progresso": "Em progresso",
    "douglas": "Análise Douglas", "refazer": "Refazer", "pronta": "Proposta pronta",
    "comercial": "Handoff comercial", "aceita": "Aceita", "projetos": "Projetos", "outras": "Outras",
}
INATIVOS = {"aceita", "projetos"}


def coletar_kanban(step_input: StepInput) -> StepOutput:
    url = os.environ["SUPABASE_URL"]
    key = os.environ["SUPABASE_SERVICE_KEY"]
    r = requests.get(
        f"{url}/rest/v1/kanban_cards",
        params={
            "dept_id": "eq.orcamento",
            "select": "title,responsavel,column_id,sla_status,updated_at",
            "limit": "500",
        },
        headers={"apikey": key, "Authorization": f"Bearer {key}"},
        timeout=30,
    )
    r.raise_for_status()
    cards = r.json()

    hoje = datetime.now(TZ).date()
    por_bucket: Counter[str] = Counter()
    por_resp: dict[str, Counter] = {}
    atrasados: list[dict] = []
    prontas_hoje: list[str] = []

    for c in cards:
        bucket = BUCKETS.get(c.get("column_id") or "", "outras")
        por_bucket[bucket] += 1
        ativo = bucket not in INATIVOS

        resp = (c.get("responsavel") or "sem responsável").strip()
        if ativo:
            por_resp.setdefault(resp, Counter())["ativos"] += 1
            por_resp[resp][bucket] += 1

        sla = (c.get("sla_status") or "").lower()
        if ativo and any(k in sla for k in ("atras", "estour", "late")):
            atrasados.append({"cliente": c["title"], "responsavel": resp,
                              "etapa": BUCKET_LABEL[bucket]})
            por_resp.setdefault(resp, Counter())["atrasados"] += 1

        upd = c.get("updated_at")
        if bucket == "pronta" and upd:
            when = datetime.fromisoformat(upd).astimezone(TZ).date()
            if when == hoje:
                prontas_hoje.append(c["title"])

    payload = {
        "data": hoje.strftime("%d/%m/%Y"),
        "total_cards": len(cards),
        "por_etapa": {BUCKET_LABEL[b]: n for b, n in por_bucket.most_common()},
        "prontas_hoje": prontas_hoje,
        "atrasados": atrasados[:30],
        "por_responsavel": {r_: dict(cnt) for r_, cnt in sorted(por_resp.items())},
        "link_relatorio": f"https://space.parket.works/relatorio-orcamento.html?d={hoje.isoformat()}",
    }
    return StepOutput(content=json.dumps(payload, ensure_ascii=False))


def enviar_dm(step_input: StepInput) -> StepOutput:
    numero = os.environ.get("EAS_DM_NUMBER", "5511939213329").strip()
    if "@g.us" in numero:
        return StepOutput(content="bloqueado: envio pra grupo está sob kill switch",
                          success=False, error="grupo não permitido")
    msg = str(step_input.previous_step_content or "").strip()
    if not msg:
        return StepOutput(content="mensagem vazia — nada enviado",
                          success=False, error="conteúdo vazio")

    evo_url = os.environ.get("EVOLUTION_API_URL", "https://conect.parket.works")
    evo_key = os.environ["EVOLUTION_API_KEY"]
    instance = os.environ.get("EVOLUTION_INSTANCE", "Parket")

    def _send(inst: str) -> requests.Response:
        return requests.post(
            f"{evo_url}/message/sendText/{quote(inst)}",
            headers={"apikey": evo_key},
            json={"number": numero, "text": msg},
            timeout=30,
        )

    r = _send(instance)
    ok = r.ok and '"id"' in r.text
    if not ok:
        # instância preferida fora do ar (ex. Parket desconectada) → tenta
        # a primeira instância conectada pra não falhar silenciosamente
        log.warning("resumo-orcamentos: instância %s falhou (%s), tentando fallback",
                    instance, r.status_code)
        try:
            insts = requests.get(f"{evo_url}/instance/fetchInstances",
                                 headers={"apikey": evo_key}, timeout=15).json()
        except Exception:  # noqa: BLE001
            insts = []
        for i in insts:
            d = i.get("instance", i)
            name = d.get("instanceName") or d.get("name") or ""
            status = d.get("connectionStatus") or d.get("status")
            if status == "open" and name and name != instance:
                r = _send(name)
                ok = r.ok and '"id"' in r.text
                if ok:
                    instance = name
                    break

    log.info("resumo-orcamentos: envio DM %s via %s → %s", numero, instance, r.status_code)
    return StepOutput(
        content=f"DM {'enviada' if ok else 'FALHOU'} pra {numero} via {instance} (HTTP {r.status_code})",
        success=ok,
        error=None if ok else r.text[:300],
    )


def build_workflows(db) -> list[Workflow]:
    redator = Agent(
        id="redator-resumo-orcamentos",
        name="Redator Resumo Orçamentos",
        model=ClaudeOAuth(id=os.environ.get("MODEL_DEFAULT", "claude-sonnet-4-6"),
                          max_tokens=2048),
        instructions=(
            "Você recebe um JSON com o estado do kanban de orçamentos da Parket. "
            "Escreva UMA mensagem de WhatsApp em português: análise executiva do dia. "
            "Formato WhatsApp: *negrito*, _itálico_, bullets com •. Sem cabeçalhos #. "
            "Estrutura: título '*🤖 Análise Diária — Orçamento*' + data; 3 a 5 bullets "
            "com leitura executiva (propostas prontas hoje, gargalos por etapa, "
            "atrasos citando cliente e responsável, destaques por responsável); "
            "feche com o link do relatório. Máximo ~1200 caracteres. "
            "Responda SOMENTE com a mensagem final, sem preâmbulo."
        ),
        markdown=False,
        telemetry=False,
    )

    resumo_orcamentos = Workflow(
        id="resumo-orcamentos",
        name="Resumo de Orçamentos (DM)",
        description=(
            "Coleta o kanban de orçamento, redige análise executiva com IA e "
            "envia por DM WhatsApp. Disparado pelo schedule diário."
        ),
        db=db,
        steps=[
            Step(name="coletar", executor=coletar_kanban),
            Step(name="redigir", agent=redator),
            Step(name="enviar", executor=enviar_dm),
        ],
    )
    return [resumo_orcamentos]
