"""
Máquina de estados do funil da Teca V2.

Funções puras (sem Redis/Supabase/LLM) — a plugagem fica em tools.marcar_etapa
(transições explícitas) e no orchestrator (transições implícitas pós-tools).

Regras de negócio preservadas (Will 17/08/2026):
  - metragem <50m² → análise interna, nunca agendamento
  - DDD 11-19 / SP → showroom primeiro; fora de SP → Meet
  - "agendado" só existe após criar/atualizar_agendamento com sucesso
  - "escalado_humano" só via pausar_teca_sinalizar_sdr
"""
from __future__ import annotations

import re
from typing import Any

from .ddd_locator import is_sp_ddd

ETAPA_INICIAL = "inicio"

# Etapas que o funil percorre normalmente (re-entráveis)
_FUNIL = {
    "inicio",
    "descobrindo_cidade",
    "oferecendo_showroom",
    "oferecendo_meet",
    "escolhendo_horario",
    "duvida_produto",
}

# Etapas que NUNCA entram via marcar_etapa — só por transição implícita de tool
ETAPAS_IMPLICITAS = {"agendado", "escalado_humano"}

ETAPAS = _FUNIL | ETAPAS_IMPLICITAS | {"desinteressado_acompanhar"}

TRANSITIONS: dict[str, set[str]] = {
    "inicio": {"descobrindo_cidade", "duvida_produto", "desinteressado_acompanhar"},
    "descobrindo_cidade": {"oferecendo_showroom", "oferecendo_meet", "duvida_produto",
                           "desinteressado_acompanhar"},
    "oferecendo_showroom": {"oferecendo_meet", "escolhendo_horario", "duvida_produto",
                            "desinteressado_acompanhar"},
    "oferecendo_meet": {"oferecendo_showroom", "escolhendo_horario", "duvida_produto",
                        "desinteressado_acompanhar"},
    "escolhendo_horario": {"agendado", "oferecendo_showroom", "oferecendo_meet",
                           "duvida_produto", "desinteressado_acompanhar"},
    # Lateral: de dúvida volta pra qualquer ponto do funil
    "duvida_produto": (_FUNIL - {"duvida_produto"}) | {"desinteressado_acompanhar"},
    "agendado": {"escolhendo_horario", "desinteressado_acompanhar"},
    # Lead voltou a conversar
    "desinteressado_acompanhar": set(_FUNIL),
    # Terminal — sai só via clear_paused manual do SDR
    "escalado_humano": set(),
}


def _num(v: Any) -> float | None:
    digits = re.sub(r"[^\d.,]", "", str(v or "")).replace(",", ".")
    try:
        return float(digits) if digits else None
    except Exception:
        return None


def _eh_sp(phone: str, state: dict, details: dict) -> bool:
    estado = str(state.get("estado") or details.get("estado") or "").strip().lower()
    if estado in ("sp", "sao paulo", "são paulo"):
        return True
    cidade = str(state.get("cidade") or details.get("cidade") or "").strip().lower()
    if cidade in ("sao paulo", "são paulo", "sp"):
        return True
    if estado or (cidade and not estado):
        # Lead informou localização explícita fora de SP — vence o DDD
        if estado and estado not in ("sp", "sao paulo", "são paulo"):
            return False
    return is_sp_ddd(phone)


def _tem_agendamento_ok(tool_results: list[dict] | None) -> bool:
    for r in tool_results or []:
        if r.get("name") not in ("criar_agendamento", "atualizar_agendamento"):
            continue
        res = r.get("result")
        if isinstance(res, dict) and (res.get("id") or res.get("ok") is True):
            return True
    return False


def validar_transicao(atual: str, nova: str, ctx: dict) -> dict:
    """
    ctx = {"phone": str, "state": dict (Redis), "details": dict (card.details),
           "tool_results": list[dict] da rodada}
    Retorna {"ok": bool, "motivo": str, "dados_faltantes": [...],
             "mensagem_pro_cortex": str}.
    """
    state = ctx.get("state") or {}
    details = ctx.get("details") or {}
    phone = ctx.get("phone") or ""

    atual = atual if atual in ETAPAS else ETAPA_INICIAL

    if nova not in ETAPAS:
        return {
            "ok": False, "motivo": "etapa_desconhecida", "dados_faltantes": [],
            "mensagem_pro_cortex": (
                f"Etapa '{nova}' não existe. Etapas válidas: {', '.join(sorted(ETAPAS))}."
            ),
        }

    if nova == atual:
        return {"ok": True, "motivo": "sem_mudanca", "dados_faltantes": [],
                "mensagem_pro_cortex": ""}

    if nova == "escalado_humano":
        return {
            "ok": False, "motivo": "use_pausar_teca", "dados_faltantes": [],
            "mensagem_pro_cortex": (
                "Nunca marque 'escalado_humano' direto. Chame a tool "
                "pausar_teca_sinalizar_sdr — a etapa muda automaticamente."
            ),
        }

    if nova == "agendado" and not _tem_agendamento_ok(ctx.get("tool_results")):
        return {
            "ok": False, "motivo": "agendamento_nao_criado", "dados_faltantes": [],
            "mensagem_pro_cortex": (
                "Transição pra 'agendado' rejeitada: nenhum criar_agendamento/"
                "atualizar_agendamento com sucesso nesta rodada. Confirme data E hora "
                "com o lead, chame criar_agendamento e a etapa muda sozinha. "
                "NUNCA diga ao lead que está agendado antes disso."
            ),
        }

    if nova not in TRANSITIONS.get(atual, set()):
        permitidas = sorted(TRANSITIONS.get(atual, set()) - ETAPAS_IMPLICITAS)
        return {
            "ok": False, "motivo": "transicao_invalida", "dados_faltantes": [],
            "mensagem_pro_cortex": (
                f"Transição '{atual}' → '{nova}' não é permitida. A partir de "
                f"'{atual}' você pode ir para: {', '.join(permitidas) or '(nenhuma)'}. "
                "Se precisar avançar mais de uma etapa, chame marcar_etapa em "
                "sequência na MESMA rodada (uma chamada por etapa)."
            ),
        }

    # ── Gates de dados (só o que muda roteamento) ──
    faltantes: list[str] = []

    def val(k: str):
        return state.get(k) or details.get(k)

    if nova in ("oferecendo_showroom", "oferecendo_meet", "escolhendo_horario"):
        if not (val("cidade") or val("estado")):
            faltantes.append("cidade")

    if nova == "oferecendo_showroom" and not faltantes and not _eh_sp(phone, state, details):
        return {
            "ok": False, "motivo": "regiao_fora_sp", "dados_faltantes": [],
            "mensagem_pro_cortex": (
                "Lead fora de SP (DDD/cidade): showroom presencial não se aplica. "
                "Ofereça reunião por Meet (marcar_etapa 'oferecendo_meet')."
            ),
        }

    if nova == "escolhendo_horario" and "cidade" not in faltantes:
        m = _num(val("area_m2")) or _num(val("metragem")) or _num(details.get("metragem_estimada"))
        if m is None:
            faltantes.append("area_m2")
        elif m < 50:
            return {
                "ok": False, "motivo": "metragem_baixa", "dados_faltantes": [],
                "mensagem_pro_cortex": (
                    f"Metragem {m:.0f}m² é abaixo de 50m²: projeto vai pra análise "
                    "interna do time comercial, NÃO ofereça horário nem agende. "
                    "Explique isso ao lead com gentileza."
                ),
            }

    if faltantes:
        return {
            "ok": False, "motivo": "dados_faltantes", "dados_faltantes": faltantes,
            "mensagem_pro_cortex": (
                f"Transição pra '{nova}' rejeitada: falta coletar "
                f"{', '.join(faltantes)}. Pergunte ao lead e grave com "
                f"atualizar_dados_lead antes de avançar. Etapa continua '{atual}'."
            ),
        }

    return {"ok": True, "motivo": "", "dados_faltantes": [], "mensagem_pro_cortex": ""}


def transicao_implicita(tool_name: str, result: Any) -> str | None:
    """Etapa que uma tool bem-sucedida dispara automaticamente, ou None."""
    if not isinstance(result, dict):
        return None
    if tool_name in ("criar_agendamento", "atualizar_agendamento"):
        if result.get("id") or result.get("ok") is True:
            return "agendado"
        return None
    if tool_name == "pausar_teca_sinalizar_sdr" and result.get("paused"):
        return "escalado_humano"
    return None


def descrever_funil_para_prompt() -> str:
    """Bloco do funil pro CORTEX_SYSTEM — gerado daqui pra nunca divergir do código."""
    linhas = []
    for etapa in ("inicio", "descobrindo_cidade", "oferecendo_showroom", "oferecendo_meet",
                  "escolhendo_horario", "duvida_produto", "agendado",
                  "desinteressado_acompanhar", "escalado_humano"):
        destinos = sorted(TRANSITIONS.get(etapa, set()) - ETAPAS_IMPLICITAS)
        alvo = ", ".join(destinos) if destinos else "(terminal — só o SDR reativa)"
        linhas.append(f"- {etapa} → {alvo}")
    return (
        "ETAPAS DO FUNIL (transições permitidas via marcar_etapa):\n"
        + "\n".join(linhas)
        + "\n\nTransições AUTOMÁTICAS (nunca chame marcar_etapa com elas):\n"
        "- agendado: acontece sozinha quando criar_agendamento/atualizar_agendamento tem sucesso\n"
        "- escalado_humano: acontece sozinha quando você chama pausar_teca_sinalizar_sdr\n\n"
        "GATES (o backend REJEITA a transição se faltar dado):\n"
        "- oferecendo_showroom: exige cidade conhecida E lead em SP (DDD 11-19 ou cidade/estado SP)\n"
        "- oferecendo_meet: exige cidade conhecida\n"
        "- escolhendo_horario: exige cidade E metragem informada E metragem ≥ 50m²\n"
        "  (abaixo de 50m² = análise interna, sem agendamento)\n\n"
        "Se marcar_etapa retornar ok=false, leia mensagem_pro_cortex, corrija o plano "
        "(colete o dado que falta ou escolha outra etapa) e NÃO repita a mesma transição. "
        "Pra avançar mais de uma etapa de uma vez, chame marcar_etapa em sequência na mesma rodada."
    )


__all__ = [
    "ETAPAS", "ETAPAS_IMPLICITAS", "ETAPA_INICIAL", "TRANSITIONS",
    "validar_transicao", "transicao_implicita", "descrever_funil_para_prompt",
]
