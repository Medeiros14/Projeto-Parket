"""F1c — Knowledge refresh workflow.

A cada 6h, escaneia os MDs em docs/, detecta mudanças por sha,
loga atividade se houve mudança. Por ora, sem re-embed (não usamos vector DB),
mas o hook fica pronto pra quando trocarmos a estratégia.
"""

from __future__ import annotations

import structlog
from agno.workflow import Step, Workflow

from app.knowledge.loader import list_docs_grouped
from app.tools.handoff import log_atividade

log = structlog.get_logger()

# Sha cache em memória — sobreescrita a cada run.
_LAST_SHAS: dict[str, str] = {}


def _scan_step(step_input):
    grouped = list_docs_grouped()
    total = sum(len(v) for v in grouped.values())
    changed = []
    for squad, docs in grouped.items():
        for line in docs:
            # line format: "name.md  (sha:abcdef...)"
            name, sha_part = line.split("  (sha:")
            sha = sha_part.rstrip(")")
            key = f"{squad}/{name}"
            if _LAST_SHAS.get(key) != sha:
                changed.append(key)
                _LAST_SHAS[key] = sha
    return {"total_docs": total, "changed": changed}


def _log_step(step_input):
    """step_input traz o output do step anterior."""
    prev = step_input.get_last_step_output() if hasattr(step_input, "get_last_step_output") else None
    data = prev if isinstance(prev, dict) else {"total_docs": 0, "changed": []}
    if data.get("changed"):
        log_atividade.entrypoint(
            titulo="EAS — knowledge refresh",
            descricao=f"Knowledge base re-escaneado. {len(data['changed'])} MDs alterados: {', '.join(data['changed'][:10])}",
            setor="Engenharia",
            categoria="config",
        )
    return data


def build_workflow() -> Workflow:
    return Workflow(
        name="knowledge_refresh",
        description="Re-escaneia MDs do KB a cada 6h, detecta mudanças.",
        steps=[
            Step(name="scan", executor=_scan_step),
            Step(name="log", executor=_log_step),
        ],
    )
