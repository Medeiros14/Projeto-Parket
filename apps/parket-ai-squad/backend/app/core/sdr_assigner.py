"""
SDR Random Assigner

Distribui leads novos (comercial-entrada) entre SDRs ativos de forma aleatória,
com probabilidade uniforme — tendência a 50/50 com volume.

SDRs ativos definidos em SDR_NAMES. Mudar aqui afeta toda a distribuição.
"""
from __future__ import annotations
import logging
import random

logger = logging.getLogger(__name__)

# ← FONTE DE VERDADE: editar aqui pra mudar SDRs
SDR_NAMES: list[str] = ["Vinicius Arruda", "Rafael Calazans"]


def pick_next_sdr(sb=None) -> str:
    """
    Retorna o nome do SDR que receberá o próximo lead.
    Estratégia: aleatório uniforme entre SDR_NAMES.
    O parâmetro `sb` é mantido por compatibilidade, mas não é usado.
    """
    if not SDR_NAMES:
        return ""
    if len(SDR_NAMES) == 1:
        return SDR_NAMES[0]
    chosen = random.choice(SDR_NAMES)
    logger.info("pick_next_sdr: random -> %s", chosen)
    return chosen
