"""
Tools the Cortex can invoke. Each tool has a JSON schema (declared in prompts.py)
and an executor function that runs the actual side-effect.

The orchestrator's loop is:
  1. Cortex returns analysis + tool_calls
  2. We execute each tool_call sequentially
  3. We feed results back into Conversational so it knows what happened
"""
from __future__ import annotations

import logging
import datetime
import re
from typing import Any
from zoneinfo import ZoneInfo

import structlog
from sqlalchemy.orm import Session
from app.config import settings
from . import state as state_mod
from . import state_machine

logger = logging.getLogger(__name__)
# structlog é o único logger capturado no `docker service logs`
slog = structlog.get_logger("teca_v2.tools")
TZ_BR = ZoneInfo("America/Sao_Paulo")


# ─────────────────────────────────────────────────────────────────────────
# Helpers — supabase REST shortcuts via httpx
# ─────────────────────────────────────────────────────────────────────────
async def _supabase_rest(method: str, path: str, body: dict | list | None = None, params: dict | None = None) -> Any:
    import httpx
    url = f"{settings.SUPABASE_URL}/rest/v1/{path.lstrip('/')}"
    headers = {
        "apikey": settings.SUPABASE_SERVICE_KEY,
        "Authorization": f"Bearer {settings.SUPABASE_SERVICE_KEY}",
        "Content-Type": "application/json",
        "Prefer": "return=representation",
    }
    async with httpx.AsyncClient(timeout=20) as cli:
        r = await cli.request(method, url, json=body, params=params, headers=headers)
        if r.status_code >= 400:
            raise RuntimeError(f"supabase {method} {path} → {r.status_code} {r.text[:300]}")
        if r.status_code == 204 or not r.text:
            return None
        return r.json()


# ─────────────────────────────────────────────────────────────────────────
# Tool: listar_vendedores
# Lê os vendedores ativos do Space (kanban_cards do dept comercial com responsavel
# distinto) + cruza com a tabela do Homebroker agendamento_disponibilidade.
# Resultado é cacheado em memória por 5 min.
# ─────────────────────────────────────────────────────────────────────────
_VENDEDORES_CACHE: dict[str, Any] = {"ts": 0, "data": []}


async def listar_vendedores() -> list[dict]:
    import time
    if time.time() - _VENDEDORES_CACHE["ts"] < 300 and _VENDEDORES_CACHE["data"]:
        return _VENDEDORES_CACHE["data"]

    # Vendedores que aparecem no formulário do Homebroker (também salvos em agendamento_disponibilidade)
    rows = await _supabase_rest("GET", "agendamento_disponibilidade",
                                 params={"select": "vendedor", "vendedor": "not.is.null"})
    nomes = sorted({(r.get("vendedor") or "").strip() for r in (rows or []) if r.get("vendedor")})
    out = [{"nome": n} for n in nomes if n]
    _VENDEDORES_CACHE["ts"] = time.time()
    _VENDEDORES_CACHE["data"] = out
    return out


DEFAULT_SLOTS_BR = [
    ("09:00", "10:00"), ("10:00", "11:00"), ("11:00", "12:00"),
    ("14:00", "15:00"), ("15:00", "16:00"), ("16:00", "17:00"), ("17:00", "18:00"),
]


# ─────────────────────────────────────────────────────────────────────────
# Tool: verificar_disponibilidade
# Retorna slots livres do(s) vendedor(es) entre uma data inicial e final.
# Considera (a) agendamento_disponibilidade do vendedor (se houver) e (b) agendamentos já criados.
# Se NÃO houver linhas em agendamento_disponibilidade pra um vendedor, assume horário padrão
# (seg-sex 9h-12h e 14h-18h) — todos os vendedores ATIVOS são considerados disponíveis por default.
# ─────────────────────────────────────────────────────────────────────────
def _easter_date(year: int) -> datetime.date:
    """Algoritmo Gregoriano Anônimo — Páscoa católica."""
    a = year % 19
    b = year // 100
    c = year % 100
    d_ = b // 4
    e = b % 4
    f = (b + 8) // 25
    g = (b - f + 1) // 3
    h = (19 * a + b - d_ - g + 15) % 30
    i = c // 4
    k = c % 4
    l = (32 + 2 * e + 2 * i - h - k) % 7
    m = (a + 11 * h + 22 * l) // 451
    month = (h + l - 7 * m + 114) // 31
    day = ((h + l - 7 * m + 114) % 31) + 1
    return datetime.date(year, month, day)

def _feriados_br(year: int) -> set[datetime.date]:
    """Feriados nacionais brasileiros (fixos + móveis baseados na Páscoa)."""
    easter = _easter_date(year)
    return {
        datetime.date(year, 1, 1),    # Confraternização Universal
        easter - datetime.timedelta(days=48),  # Carnaval (segunda)
        easter - datetime.timedelta(days=47),  # Carnaval (terça)
        easter - datetime.timedelta(days=2),   # Sexta-feira Santa
        datetime.date(year, 4, 21),   # Tiradentes
        datetime.date(year, 5, 1),    # Dia do Trabalho
        easter + datetime.timedelta(days=60),  # Corpus Christi
        datetime.date(year, 9, 7),    # Independência
        datetime.date(year, 10, 12),  # N. Sra. Aparecida
        datetime.date(year, 11, 2),   # Finados
        datetime.date(year, 11, 15),  # Proclamação da República
        datetime.date(year, 12, 25),  # Natal
    }

def _is_dia_util(d: datetime.date) -> bool:
    """True se NÃO é sábado/domingo e NÃO é feriado nacional BR."""
    if d.weekday() >= 5:
        return False
    if d in _feriados_br(d.year):
        return False
    return True

def _proximo_dia_util(ref: datetime.date) -> datetime.date:
    """Retorna o próximo dia útil ESTRITAMENTE depois de `ref`.

    Regra Teca: se HOJE é sábado ou domingo, pula a segunda e começa de terça.
    (Não dá tempo de o time comercial preparar atendimento na segunda quando
    o agendamento veio no fim de semana — sempre terça+.)
    De sexta, segunda é permitida normalmente.
    """
    today = datetime.datetime.now(TZ_BR).date()
    pular_segunda = today.weekday() in (5, 6)  # sábado/domingo
    d = ref + datetime.timedelta(days=1)
    while not _is_dia_util(d) or (pular_segunda and d.weekday() == 0):
        d += datetime.timedelta(days=1)
    return d

def _parse_data(d: str | datetime.date | None) -> datetime.date:
    """Aceita ISO (YYYY-MM-DD), 'amanhã', 'hoje', 'dd/mm', 'dd/mm/yyyy'.

    REGRA Teca: nunca retorna o dia corrente. Se o input resolver pra hoje ou
    passado, ou cair em fim de semana/feriado, devolve o próximo dia útil.
    """
    today = datetime.datetime.now(TZ_BR).date()
    min_data = _proximo_dia_util(today)

    if isinstance(d, datetime.date):
        return d if d >= min_data and _is_dia_util(d) else max(min_data, _proximo_dia_util(d - datetime.timedelta(days=1)))
    if not d or not isinstance(d, str):
        return min_data
    s = d.strip().lower()

    def _clamp(dt: datetime.date) -> datetime.date:
        """Garante: >= próximo dia útil, e o próprio dt deve ser dia útil."""
        if dt < min_data:
            return min_data
        if not _is_dia_util(dt):
            return _proximo_dia_util(dt - datetime.timedelta(days=1))
        return dt

    if s in ("hoje", "today"):
        return min_data  # nunca permitir hoje
    if s in ("amanhã", "amanha", "tomorrow"):
        return _clamp(today + datetime.timedelta(days=1))
    if s in ("depois de amanhã", "depois de amanha"):
        return _clamp(today + datetime.timedelta(days=2))
    if s in ("próximo dia útil", "proximo dia util", "próxima segunda", "proxima segunda"):
        return min_data
    # Try ISO
    try:
        return _clamp(datetime.date.fromisoformat(s[:10]))
    except Exception:
        pass
    # Try dd/mm/yyyy or dd/mm
    try:
        parts = s.split("/")
        if len(parts) == 3:
            return _clamp(datetime.date(int(parts[2]), int(parts[1]), int(parts[0])))
        if len(parts) == 2:
            return _clamp(datetime.date(today.year, int(parts[1]), int(parts[0])))
    except Exception:
        pass
    # Fallback: próximo dia útil
    return min_data


async def verificar_disponibilidade(vendedor: str | None = None, data_de: str = None, data_ate: str = None) -> list[dict]:
    """
    Retorna lista de slots disponíveis: [{vendedor, data, hora_inicio, hora_fim, modalidade?}].
    Se vendedor=None, considera todos. Aceita datas em vários formatos (ISO, 'amanhã', dd/mm/yyyy).
    """
    de = _parse_data(data_de)
    ate = _parse_data(data_ate) if data_ate else de + datetime.timedelta(days=7)
    if ate < de:
        ate = de

    # 1. Disponibilidade base (recorrente por dia_semana)
    disp_params = {"select": "*"}
    if vendedor:
        disp_params["vendedor"] = f"eq.{vendedor}"
    disp = await _supabase_rest("GET", "agendamento_disponibilidade", params=disp_params) or []

    # 2. Agendamentos já existentes no range
    ag_params = {
        "select": "vendedor,data,hora_inicio,hora_fim,status",
        "data": f"gte.{de.isoformat()}",
        "and": f"(data.lte.{ate.isoformat()})",
        "status": "neq.cancelado",
    }
    if vendedor:
        ag_params["vendedor"] = f"eq.{vendedor}"
    ocupados = await _supabase_rest("GET", "agendamentos", params=ag_params) or []

    # 3. Lista de vendedores: se vendedor explícito, só ele; senão todos os ativos
    if vendedor:
        vendedores_alvo = [vendedor]
    else:
        all_vend = await listar_vendedores()
        vendedores_alvo = [v.get("nome") for v in all_vend if v.get("nome")]
        if not vendedores_alvo:
            vendedores_alvo = ["Marina Torino", "Davi Baptista", "Raphael Camargo"]

    def _slots_dia(vend: str, dia: datetime.date) -> list[tuple[str, str]]:
        dow_supa = (dia.weekday() + 1) % 7
        custom = [s for s in disp if s.get("vendedor") == vend and int(s.get("dia_semana", -1)) == dow_supa]
        if custom:
            return [(s.get("hora_inicio") or "09:00", s.get("hora_fim") or "10:00") for s in custom]
        if dia.weekday() >= 5:
            return []
        return list(DEFAULT_SLOTS_BR)

    slots = []
    d = de
    while d <= ate:
        for vend in vendedores_alvo:
            for hi, hf in _slots_dia(vend, d):
            # Pula se já tem agendamento conflitando
                conflito = any(
                    (o.get("vendedor") == vend and o.get("data") == d.isoformat()
                     and (o.get("hora_inicio") or "") < hf and (o.get("hora_fim") or "") > hi)
                    for o in ocupados
                )
                if conflito:
                    continue
                slots.append({
                    "vendedor": vend,
                    "data": d.isoformat(),
                    "hora_inicio": hi,
                    "hora_fim": hf,
                })
        d += datetime.timedelta(days=1)

    return slots


# ─────────────────────────────────────────────────────────────────────────
# Tool: vendedores_livres_em — quais vendedores estão livres num slot específico
# Útil quando o lead já escolheu uma data/horário e queremos rotear pra um vendor livre.
# ─────────────────────────────────────────────────────────────────────────
async def vendedores_livres_em(data: str, hora_inicio: str = "14:00", hora_fim: str = "15:00") -> list[dict]:
    dia = _parse_data(data)
    todos = await listar_vendedores()
    nomes = [v.get("nome") for v in todos if v.get("nome")]
    if not nomes:
        nomes = ["Marina Torino", "Davi Baptista", "Raphael Camargo"]
    ag_params = {
        "select": "vendedor,hora_inicio,hora_fim,status",
        "data": f"eq.{dia.isoformat()}",
        "status": "neq.cancelado",
    }
    ocupados = await _supabase_rest("GET", "agendamentos", params=ag_params) or []
    livres = []
    for vend in nomes:
        conflito = any(
            (o.get("vendedor") == vend
             and (o.get("hora_inicio") or "") < hora_fim
             and (o.get("hora_fim") or "") > hora_inicio)
            for o in ocupados
        )
        if not conflito:
            livres.append({"vendedor": vend, "data": dia.isoformat(),
                           "hora_inicio": hora_inicio, "hora_fim": hora_fim})
    return livres


# ─────────────────────────────────────────────────────────────────────────
# Tool: criar_agendamento
# ─────────────────────────────────────────────────────────────────────────
async def criar_agendamento(
    card_id: str | None,
    cliente_nome: str,
    data: str,             # YYYY-MM-DD ou 'amanhã', dd/mm/yyyy etc
    hora_inicio: str,      # HH:MM
    hora_fim: str,         # HH:MM
    vendedor: str | None = None,      # opcional — None vira "A definir"
    modalidade: str = "presencial",   # presencial|meet
    endereco: str | None = None,
    meet_link: str | None = None,
    observacoes: str | None = None,
    phone: str | None = None,         # injetado pelo execute_tool (fonte de metragem no Redis state)
    area_m2: Any = None,              # metragem explícita, se a Cortex mandar
    metragem: Any = None,             # alias de area_m2
) -> dict:
    # ─── REGRA DE METRAGEM ───
    # Só agenda se a metragem foi informada E é >= 50m².
    #   • Sem metragem → NÃO agenda (Teca precisa coletar antes)
    #   • Metragem < 50m² → análise interna do time comercial
    #   • Metragem ≥ 50m² → agenda normal
    #
    # A metragem é resolvida de 3 fontes, a PRIMEIRA com valor vence:
    #   1. arg explícito da Cortex (area_m2 / metragem)
    #   2. Redis state (state_mod) — `atualizar_dados_lead` grava aqui SEMPRE,
    #      então sobrevive mesmo se o blob `details` for sobrescrito pela gravação
    #      do histórico. Era a causa do skip silencioso: o lead dava a metragem,
    #      ficava só no state, e o portão lia só o `details` (vazio) → não agendava.
    #   3. card.details.area_m2 / metragem_estimada / metragem
    def _num(v):
        digits = re.sub(r"[^\d.,]", "", str(v or "")).replace(",", ".")
        try:
            return float(digits) if digits else None
        except Exception:
            return None

    metragem_n = _num(area_m2) or _num(metragem)
    if not metragem_n and phone:
        try:
            st = await state_mod.get_state(phone) or {}
            metragem_n = _num(st.get("area_m2")) or _num(st.get("metragem"))
        except Exception:
            pass
    details = {}
    if card_id:
        try:
            card_rows = await _supabase_rest("GET", "kanban_cards",
                params={"id": f"eq.{card_id}", "select": "details", "limit": "1"})
            details = ((card_rows or [{}])[0] or {}).get("details") or {}
            if not metragem_n:
                metragem_n = _num(details.get("area_m2") or details.get("metragem_estimada")
                                  or details.get("metragem"))
        except Exception:
            details = {}

    # 1. Sem metragem em NENHUMA fonte → coleta primeiro
    if not metragem_n or metragem_n <= 0:
        return {
            "ok": False,
            "skip_motivo": "metragem_ausente",
            "metragem": None,
            "mensagem_pro_lead": (
                "Antes de marcar a reunião, preciso saber a metragem aproximada do "
                "seu projeto (em m²). Pode me passar? Mesmo um número estimado já ajuda."
            ),
        }

    # 2. Metragem informada mas < 50m² → análise interna
    if metragem_n < 50:
        if card_id:
            try:
                await _supabase_rest("PATCH", "kanban_cards",
                    params={"id": f"eq.{card_id}"},
                    body={"details": {**details,
                                      "status_lead": "analise_interna",
                                      "motivo_nao_agendou": f"projeto pequeno ({metragem_n:.0f}m²) — abaixo de 50m²"}})
            except Exception:
                pass
        return {
            "ok": False,
            "skip_motivo": "metragem_baixa",
            "metragem": metragem_n,
            "mensagem_pro_lead": (
                f"Como seu projeto é de {metragem_n:.0f}m², vamos analisar internamente "
                "com o time comercial antes de marcar a reunião — em breve um(a) "
                "especialista entra em contato com a melhor solução pra você. Obrigada!"
            ),
        }
    # else: metragem >= 50 → segue fluxo normal

    # 3. Conversa rolando depois das 17h → manhã do dia seguinte fica bloqueada
    # (Will 17/08/2026: sem tempo hábil do time confirmar/preparar de manhã cedo)
    agora = datetime.datetime.now(TZ_BR)
    data_dt = _parse_data(data)
    hora_ini_n = _num(str(hora_inicio or "").replace(":", "."))
    if (agora.hour >= 17 and data_dt == agora.date() + datetime.timedelta(days=1)
            and hora_ini_n is not None and hora_ini_n < 12):
        return {
            "ok": False,
            "skip_motivo": "manha_seguinte_bloqueada",
            "mensagem_pro_cortex": (
                "Já passou das 17h: agendamento pro dia seguinte só a partir das 12:00. "
                "Proponha ao lead um horário à tarde amanhã ou a manhã de outro dia."
            ),
            "mensagem_pro_lead": (
                "Pra amanhã consigo horários a partir do início da tarde. "
                "Prefere amanhã à tarde ou a manhã de outro dia?"
            ),
        }

    # Normaliza data pra ISO antes de inserir
    data_iso = data_dt.isoformat()
    # Sentinela quando Teca não escolhe especialista (regra: time interno atribui depois)
    vendedor_final = (vendedor or "").strip() or "A definir"

    # ─── ANTI-DUPLICATA ───
    # Se o card já tem um agendamento ATIVO ("agendado"), NÃO cria um segundo.
    # A Teca deve usar `atualizar_agendamento` pra mudar data/hora/modalidade.
    # Sem isso a Teca cria 2 registros (um inicial errado + um após o cliente
    # confirmar) e o time comercial fica confuso.
    if card_id:
        try:
            existentes = await _supabase_rest(
                "GET", "agendamentos",
                params={
                    "select": "id,data,hora_inicio,hora_fim,modalidade,vendedor,status",
                    "card_id": f"eq.{card_id}",
                    "status": "eq.agendado",
                    "order": "created_at.desc",
                    "limit": "1",
                },
            )
            if existentes and isinstance(existentes, list) and len(existentes) > 0:
                ag = existentes[0]
                return {
                    "ok": False,
                    "skip_motivo": "agendamento_ja_existe",
                    "agendamento_existente": ag,
                    "mensagem_pro_cortex": (
                        f"Esse card já tem um agendamento ativo (id={ag.get('id')}, "
                        f"{ag.get('data')} {str(ag.get('hora_inicio') or '')[:5]}). "
                        "Se o lead pediu mudança, chame `atualizar_agendamento` com "
                        "os campos novos. NÃO crie outro registro."
                    ),
                }
        except Exception as _e:
            logger.warning("teca_v2 criar_agendamento check duplicata falhou: %s", _e)

    body = {
        "card_id": card_id,
        "vendedor": vendedor_final,
        "cliente_nome": cliente_nome,
        "data": data_iso,
        "hora_inicio": hora_inicio,
        "hora_fim": hora_fim,
        # duracao_min é coluna GERADA pelo Postgres — não passar
        "modalidade": modalidade,
        "status": "agendado",
        "endereco": endereco or ("Showroom Parket — Rua Circular do Bosque, 628 - Casa Millan, Jardim Guedala, São Paulo - SP, CEP 05604-010" if modalidade == "presencial" else None),
        "meet_link": meet_link,
        "observacoes": observacoes or "Agendado pela Teca IA",
        "created_by": "teca-v2",
    }
    res = await _supabase_rest("POST", "agendamentos", body=body)
    rec = (res[0] if isinstance(res, list) else res) or {}

    # Notifica o grupo comercial sobre o novo agendamento
    try:
        from app.core.evolution_client import evolution_client
        COMERCIAL_GROUP = "120363423690432580@g.us"

        # Busca detalhes do card pra preencher template completo
        card_details: dict = {}
        if card_id:
            try:
                card_resp = await _supabase_rest(
                    "GET", "kanban_cards",
                    params={"select": "details", "id": f"eq.{card_id}"},
                )
                if card_resp and isinstance(card_resp, list):
                    card_details = (card_resp[0] or {}).get("details") or {}
            except Exception as _e:
                logger.warning("teca_v2 fetch card details falhou: %s", _e)

        def _val(*keys, default="Não informado"):
            for k in keys:
                v = card_details.get(k)
                if v not in (None, "", []):
                    return str(v).strip()
            return default

        # Texto bruto da qualificação/análise — usado pra extrair campos que
        # a Teca não persistiu como colunas separadas mas mencionou na análise.
        # Inclui também o `observacoes` que a Teca passou DIRETO na chamada da tool
        # (é onde a Teca tipicamente joga TUDO sem persistir nos campos).
        obs_raw_parts = [
            str(card_details.get(k) or "") for k in
            ("qualificacao_inicial", "ia_analise", "resumo_qualificacao", "observacao", "observacao_lead")
        ]
        if observacoes:
            obs_raw_parts.append(str(observacoes))
        obs_raw = " ".join(p for p in obs_raw_parts if p).strip()

        def _extract_from_obs(patterns: list[str]) -> str:
            """Tenta achar valor pelos padrões regex no texto da qualificação."""
            if not obs_raw:
                return ""
            for p in patterns:
                m = re.search(p, obs_raw, re.I)
                if m:
                    v = (m.group(1) if m.lastindex else m.group(0)).strip(" ,.;:-")
                    if v:
                        return v
            return ""

        nome      = _val("nome", default=cliente_nome or "Não informado")
        identif   = _val("relacao_obra", "perfil", "tipo_cliente",
                          default=_extract_from_obs([
                              r"cliente final",
                              r"\barquiteto[a]?\b",
                              r"\bdesigner\b",
                              r"\bconstrutora\b",
                              r"\binvestidor[a]?\b",
                              r"\b(consumidor final|usuário final)\b",
                          ]) or "Não informado")

        cidade    = _val("cidade",
                          default=_extract_from_obs([
                              # "Goiás-GO", "Goiânia-GO", "São Paulo - SP"
                              r"([A-ZÁÊÇÕÉÍÚÓ][a-záêçõéíúó]+(?:\s+[A-ZÁÊÇÕÉÍÚÓ][a-záêçõéíúó]+)*\s*[-/–]\s*[A-Z]{2})",
                              r"em\s+([A-ZÁÊÇÕÉÍÚÓ][a-záêçõéíúó]+(?:\s+[a-záêçõéíúó]+){0,2})",
                          ]) or "Não informado")

        invest    = _val("investimento", "orcamento_estimado", "valor_obra", "ticket",
                          default=_extract_from_obs([
                              r"R\$\s?[\d\.,]+(?:\s?mil|\s?k|\s?milhões)?",
                              r"orçamento[^\d]+(R\$\s?[\d\.,]+(?:\s?mil)?)",
                          ]) or "Não informado")

        # Metragem: agora considera area_m2 (campo que a Teca de fato grava)
        qtd_raw   = _val("area_m2", "metragem_estimada", "metragem", "m2", "quantidade", default="")
        if not qtd_raw:
            qtd_raw = _extract_from_obs([
                r"(\d{1,4}[\.,]?\d*)\s*m[²2]\b",
                r"piso\s+(\d+)\s*m",
            ])
        if qtd_raw:
            qtd_str = str(qtd_raw).strip()
            if not qtd_str.endswith(("m²", "m2", "mtl", "un")):
                quantidade = f"{qtd_str}m²"
            else:
                quantidade = qtd_str
        else:
            quantidade = "Não informado"

        produto   = _val("produto_interesse", "produto", "interesse",
                          default=_extract_from_obs([
                              r"\b(piso|deck|forro|painel|revestimento|porta|escada|marcenaria|sauna)[^\.]{0,60}",
                              r"projeto:\s*([^\.]{3,80})",
                              r"interesse[^:]*:\s*([^\.]{3,80})",
                          ]) or "Não informado")

        canal     = _val("platform_label", "origem_lead", "platform", "origem", default="WhatsApp")
        # Contato: fallback pra phone da conversa (sempre tem)
        contato   = _val("celular", "telefone_comercial", "telefone", "phone",
                          default=(card_details.get("phone")
                                    or card_details.get("evo_phone")
                                    or "") or "Não informado")
        sdr       = _val("sdr", "created_by", default="Teca IA")
        obs_lead  = obs_raw or "Não informado"

        # Data formatada dd/MM
        try:
            from datetime import date as _date
            _d = _date.fromisoformat(data_iso)
            data_fmt = f"{_d.day:02d}/{_d.month:02d}"
        except Exception:
            data_fmt = data_iso

        # Hora formatada HH:MMh (sem segundos)
        def _hfmt(h: str) -> str:
            return (h or "")[:5]
        hora_fmt = f"{_hfmt(hora_inicio)}h"

        # Linha de especialista (mantém aviso quando não atribuído)
        sem_especialista = vendedor_final == "A definir"
        especialista_linha = (
            "⚠️ ESPECIALISTA: aguardando atribuição"
            if sem_especialista
            else f"• ESPECIALISTA: {vendedor_final}"
        )

        # Observação: prioriza obs do agendamento, fallback pra qualificação do lead
        obs_final = (observacoes or "").strip() or obs_lead

        linhas = [
            "📍 *NOVO AGENDAMENTO*",
            "",
            f"• NOME: {nome}",
            f"• IDENTIFICADO COMO: {identif}",
            f"• CIDADE: {cidade}",
            f"• INVESTIMENTO: {invest}",
            f"• QUANTIDADE: {quantidade}",
            f"• PRODUTO: {produto}",
            f"• CANAL: {canal}",
            f"• CONTATO: {contato}",
            f"• SDR: {sdr}",
            especialista_linha,
            f"* Agendado: {data_fmt} às {hora_fmt}",
        ]
        if obs_final:
            linhas.append("")
            linhas.append(f"Observação: {obs_final}")

        msg = "\n".join(linhas)
        await evolution_client.send_text(COMERCIAL_GROUP, msg)
    except Exception as e:
        logger.warning("teca_v2 notify grupo comercial falhou: %s", e)

    # Endereço do showroom é interno — nunca pode chegar ao lead via LLM
    rec.pop("endereco", None)
    return rec


# ─────────────────────────────────────────────────────────────────────────
# Tool: atualizar_agendamento
# Atualiza o último agendamento ATIVO ("agendado") do card_id.
# Usada quando o lead pediu mudança de data/hora/modalidade depois de
# `criar_agendamento` ter rodado. Evita criar registro duplicado.
# ─────────────────────────────────────────────────────────────────────────
async def atualizar_agendamento(
    card_id: str | None,
    agendamento_id: str | None = None,
    data: str | None = None,
    hora_inicio: str | None = None,
    hora_fim: str | None = None,
    modalidade: str | None = None,
    meet_link: str | None = None,
    endereco: str | None = None,
    observacoes: str | None = None,
) -> dict:
    # Acha o agendamento alvo: prioridade pro id explícito; senão, o último ativo do card
    target_id = agendamento_id
    if not target_id:
        if not card_id:
            return {"ok": False, "error": "Sem card_id nem agendamento_id — não dá pra localizar."}
        try:
            rows = await _supabase_rest(
                "GET", "agendamentos",
                params={
                    "select": "id,data,hora_inicio,hora_fim,modalidade,status,vendedor",
                    "card_id": f"eq.{card_id}",
                    "status": "eq.agendado",
                    "order": "created_at.desc",
                    "limit": "1",
                },
            )
            if not rows or not isinstance(rows, list) or len(rows) == 0:
                return {
                    "ok": False,
                    "skip_motivo": "sem_agendamento_ativo",
                    "mensagem_pro_cortex": (
                        "Não há agendamento ativo nesse card. Se o lead acabou de "
                        "confirmar data+hora, chame `criar_agendamento` em vez disso."
                    ),
                }
            target_id = rows[0]["id"]
        except Exception as e:
            return {"ok": False, "error": f"falha ao localizar agendamento: {e}"}

    # Monta o patch só com campos não-vazios
    patch: dict = {"updated_at": datetime.datetime.now(datetime.timezone.utc).isoformat()}
    if data:
        try:
            patch["data"] = _parse_data(data).isoformat()
        except Exception:
            return {"ok": False, "error": f"data inválida: {data}"}
    if hora_inicio:
        patch["hora_inicio"] = hora_inicio
    if hora_fim:
        patch["hora_fim"] = hora_fim
    if modalidade:
        if modalidade not in ("presencial", "meet"):
            return {"ok": False, "error": "modalidade deve ser 'presencial' ou 'meet'"}
        patch["modalidade"] = modalidade
        # Ajusta endereco/meet_link conforme nova modalidade se não vieram explícitos
        if modalidade == "presencial" and endereco is None:
            patch["endereco"] = (
                "Showroom Parket — Rua Circular do Bosque, 628 - Casa Millan, "
                "Jardim Guedala, São Paulo - SP, CEP 05604-010"
            )
            patch["meet_link"] = None
        elif modalidade == "meet" and meet_link is None:
            patch["endereco"] = None
    if meet_link is not None:
        patch["meet_link"] = meet_link
    if endereco is not None:
        patch["endereco"] = endereco
    if observacoes is not None:
        patch["observacoes"] = observacoes

    if len(patch) <= 1:  # só updated_at
        return {"ok": False, "error": "nada pra atualizar — passe pelo menos um campo"}

    try:
        res = await _supabase_rest(
            "PATCH", "agendamentos",
            body=patch,
            params={"id": f"eq.{target_id}"},
        )
        rec = (res[0] if isinstance(res, list) and res else res) or {}
        # Notifica grupo comercial sobre mudança
        try:
            from app.core.evolution_client import evolution_client
            COMERCIAL_GROUP = "120363423690432580@g.us"
            d_fmt = rec.get("data") or patch.get("data") or "?"
            h_fmt = str(rec.get("hora_inicio") or patch.get("hora_inicio") or "")[:5]
            m_fmt = rec.get("modalidade") or patch.get("modalidade") or "?"
            cliente = rec.get("cliente_nome") or "?"
            msg = (
                "✏️ *AGENDAMENTO ATUALIZADO*\n\n"
                f"• Cliente: {cliente}\n"
                f"• Nova data: {d_fmt} às {h_fmt}\n"
                f"• Modalidade: {m_fmt}"
            )
            await evolution_client.send_text(COMERCIAL_GROUP, msg)
        except Exception as e:
            logger.warning("teca_v2 notify grupo comercial (update) falhou: %s", e)
        rec.pop("endereco", None)
        return {"ok": True, "agendamento": rec, "campos_atualizados": list(patch.keys())}
    except Exception as e:
        return {"ok": False, "error": str(e)}


# ─────────────────────────────────────────────────────────────────────────
# Tool: pausar_teca_sinalizar_sdr
# Marca Redis pause flag + posta uma mensagem no card pra SDR.
# ─────────────────────────────────────────────────────────────────────────
async def pausar_teca_sinalizar_sdr(phone: str, card_id: str | None, motivo: str) -> dict:
    await state_mod.set_paused(phone, motivo=motivo)

    # Marca o card pra SDR ver no painel
    if card_id:
        try:
            await _supabase_rest("PATCH", f"kanban_cards", body={
                "details": {"teca_ativa": False, "teca_etapa": "escalado_humano", "teca_motivo_escalacao": motivo}
            }, params={"id": f"eq.{card_id}"})
        except Exception as e:
            logger.warning("teca_v2 escalar_humano patch falhou: %s", e)

    # Notifica grupo SDR via evolution
    try:
        from app.core.evolution_client import evolution_client
        sdr_group = "120363405979905444@g.us"   # grupo 🤖 Parket IA — pode mudar depois
        await evolution_client.send_text(
            sdr_group,
            f"🚨 *Teca pausou conversa* — lead precisa de humano.\n"
            f"Telefone: +{phone}\n"
            f"Motivo: {motivo}\n"
            f"Card: {card_id or '(sem card)'}"
        )
    except Exception as e:
        logger.warning("teca_v2 sinalizar SDR falhou: %s", e)

    return {"paused": True, "motivo": motivo}


# ─────────────────────────────────────────────────────────────────────────
# Tool: atualizar_dados_lead
# Salva campos coletados durante a conversa direto em kanban_cards.details + Redis state.
# Usado pelo Cortex sempre que o lead fornece info nova (cidade, área, produtos, perfil etc).
# ─────────────────────────────────────────────────────────────────────────
ALLOWED_LEAD_FIELDS = {
    "nome", "email", "cidade", "estado", "endereco_obra", "area_m2", "metragem",
    "produto_interesse", "produtos", "perfil", "tipo_cliente", "atendimento",
    "modalidade_atendimento", "etapa_obra", "prazo_estimado", "ja_tem_arquiteto",
    "tem_projeto", "orcamento_estimado", "como_conheceu", "observacao_lead",
}


async def atualizar_dados_lead(phone: str, card_id: str | None, campos: dict) -> dict:
    """Persiste campos coletados no card.details + Redis state. Filtra campos permitidos."""
    if not isinstance(campos, dict) or not campos:
        return {"updated": False, "reason": "sem campos"}
    safe = {k: v for k, v in campos.items() if k in ALLOWED_LEAD_FIELDS and v not in (None, "")}
    if not safe:
        return {"updated": False, "reason": "nenhum campo válido"}

    # Redis state (cache rápido)
    await state_mod.update_state(phone, safe)

    # kanban_cards.details (persistência durável) — fetch + merge + write back pra não sobrescrever
    if card_id:
        try:
            current_rows = await _supabase_rest(
                "GET", "kanban_cards",
                params={"select": "details", "id": f"eq.{card_id}", "limit": 1},
            )
            current = (current_rows[0].get("details") if current_rows else None) or {}
            merged = {**current, **safe}
            await _supabase_rest(
                "PATCH", "kanban_cards",
                body={"details": merged},
                params={"id": f"eq.{card_id}"},
            )
        except Exception as e:
            logger.warning("teca_v2 atualizar_dados_lead patch falhou: %s", e)
            return {"updated": False, "error": str(e)}
    return {"updated": True, "campos": list(safe.keys()), "valores": safe}


# ─────────────────────────────────────────────────────────────────────────
# Tool: consultar_dados_lead
# Retorna TUDO que está no card.details + Redis state — útil pro Cortex saber
# de cara o que já foi coletado antes de perguntar.
# ─────────────────────────────────────────────────────────────────────────
async def consultar_dados_lead(phone: str, card_id: str | None) -> dict:
    out = {"redis_state": {}, "card_details": {}}
    try:
        out["redis_state"] = await state_mod.get_state(phone)
    except Exception:
        pass
    if card_id:
        try:
            rows = await _supabase_rest(
                "GET", "kanban_cards",
                params={"select": "id,title,details,column_id,obra,responsavel", "id": f"eq.{card_id}", "limit": 1},
            )
            if rows:
                out["card_details"] = rows[0].get("details") or {}
                out["card_title"] = rows[0].get("title")
                out["card_column"] = rows[0].get("column_id")
        except Exception as e:
            out["error"] = str(e)
    return out


# ─────────────────────────────────────────────────────────────────────────
# Tool: marcar_etapa
# Valida a transição na máquina de estados e, se ok, atualiza
# details.teca_etapa do card e o Redis state.
# ─────────────────────────────────────────────────────────────────────────
async def aplicar_etapa(phone: str, card_id: str | None, etapa: str,
                        extras: dict | None = None,
                        details: dict | None = None) -> dict:
    """Grava a etapa SEM validar (uso interno: transições implícitas e
    pós-validação do marcar_etapa). details, se fornecido, evita re-fetch."""
    patch = {"etapa": etapa}
    if extras:
        patch.update(extras)
    await state_mod.update_state(phone, patch)

    if card_id:
        try:
            if details is None:
                try:
                    rows = await _supabase_rest("GET", "kanban_cards",
                        params={"select": "details", "id": f"eq.{card_id}", "limit": "1"})
                    details = ((rows or [{}])[0] or {}).get("details") or {}
                except Exception:
                    details = {}
            await _supabase_rest("PATCH", "kanban_cards", body={
                "details": {**details, "teca_etapa": etapa, **(extras or {})}
            }, params={"id": f"eq.{card_id}"})
        except Exception as e:
            logger.warning("teca_v2 marcar_etapa patch falhou: %s", e)
    return {"ok": True, "etapa": etapa}


async def marcar_etapa(phone: str, card_id: str | None, etapa: str,
                       extras: dict | None = None,
                       tool_results: list[dict] | None = None) -> dict:
    st: dict = {}
    try:
        st = await state_mod.get_state(phone) or {}
    except Exception:
        pass
    atual = st.get("etapa") or state_machine.ETAPA_INICIAL

    details: dict = {}
    if card_id:
        try:
            rows = await _supabase_rest("GET", "kanban_cards",
                params={"select": "details", "id": f"eq.{card_id}", "limit": "1"})
            details = ((rows or [{}])[0] or {}).get("details") or {}
        except Exception:
            details = {}

    ver = state_machine.validar_transicao(atual, etapa, {
        "phone": phone, "state": st, "details": details,
        "tool_results": tool_results or [],
    })
    slog.info("teca_v2_transicao", phone=phone, de=atual, para=etapa,
              ok=ver["ok"], motivo=ver.get("motivo") or "explicita")
    if not ver["ok"]:
        return {
            "ok": False,
            "etapa_atual": atual,
            "etapa_pedida": etapa,
            "motivo": ver.get("motivo"),
            "dados_faltantes": ver.get("dados_faltantes") or [],
            "mensagem_pro_cortex": ver.get("mensagem_pro_cortex") or "",
        }

    return await aplicar_etapa(phone, card_id, etapa, extras=extras, details=details)


# ─────────────────────────────────────────────────────────────────────────
# Tool: enviar_catalogo
# Retorna o link da pasta no Google Drive com os catálogos PDF da Parket.
# A Conversational coloca o link na mensagem ao lead quando ele pede catálogo.
# ─────────────────────────────────────────────────────────────────────────
CATALOGOS = {
    "geral":    "https://drive.google.com/file/d/1v_H3LW6NnLoMYo3DURcnKreBGp-of0Hj/view",
    "piso":     "https://drive.google.com/file/d/1v_H3LW6NnLoMYo3DURcnKreBGp-of0Hj/view",
    "porta":    "https://drive.google.com/file/d/1T4AJ9n9C7TaYPqBDdndvvkoX0y3m741y/view",
    "painel":   "https://drive.google.com/file/d/1H_mEiCK0LCXxbyofI0dzbxT-4-Bc26BU/view",
    "forro":    "https://drive.google.com/file/d/1Wkat-NoHjF_44HHyoXvHWSIKg80bS29H/view",
    "fachada":  "https://drive.google.com/file/d/1xvfmhF9bKyTJyKK5Hs17qrPG2GXKSypJ/view",
    "escada":   "https://drive.google.com/file/d/1_A3_yWmDSgJaJzd5QHh_n6JtuGcrc9xK/view",
    "deck":     "https://drive.google.com/file/d/14uxXscR0lIQbBGSUUPOr9jPDtce2-PY4/view",
}

# Sinônimos pra robustez ao input do Cortex
_CATALOGO_ALIAS = {
    "pisos": "piso", "assoalho": "piso", "carvalho": "piso",
    "portas": "porta",
    "paineis": "painel", "painéis": "painel", "painel decorativo": "painel",
    "forros": "forro", "muxarabi": "forro",
    "fachadas": "fachada",
    "escadas": "escada",
    "decks": "deck",
    "todos": "geral", "tudo": "geral", "completo": "geral",
}


async def enviar_catalogo(tipos: list[str] | str | None = None) -> dict:
    """
    Retorna URLs do(s) catálogo(s) PDF.
    Aceita uma string ('piso') ou lista (['piso', 'deck']). Se vazio, retorna o geral.
    """
    if isinstance(tipos, str):
        # pode vir como "piso, deck, painel" ou só "piso"
        tipos = [t.strip() for t in tipos.replace(";", ",").split(",") if t.strip()]
    if not tipos:
        tipos = ["geral"]

    out = []
    vistos = set()
    for raw in tipos:
        key = (raw or "").strip().lower()
        key = _CATALOGO_ALIAS.get(key, key)
        url = CATALOGOS.get(key)
        if url and url not in vistos:
            out.append({"tipo": key, "url": url})
            vistos.add(url)

    if not out:
        out = [{"tipo": "geral", "url": CATALOGOS["geral"]}]
    return {"catalogos": out, "qty": len(out)}


# ─────────────────────────────────────────────────────────────────────────
# Tool: consultar_kb_site
# RAG sobre site.parket.works. Implementado em Fase 2 — por enquanto retorna stub.
# ─────────────────────────────────────────────────────────────────────────
async def consultar_kb_site(query: str) -> list[dict]:
    # Placeholder. Fase 2 vai usar pgvector com chunks ingeridos do site.
    try:
        from app.core.teca_v2 import kb_site  # type: ignore
        return await kb_site.search(query)
    except Exception:
        return []


# ─────────────────────────────────────────────────────────────────────────
# Tool registry — used by orchestrator to dispatch
# ─────────────────────────────────────────────────────────────────────────
TOOL_FUNCTIONS = {
    "listar_vendedores": listar_vendedores,
    "verificar_disponibilidade": verificar_disponibilidade,
    "vendedores_livres_em": vendedores_livres_em,
    "criar_agendamento": criar_agendamento,
    "atualizar_agendamento": atualizar_agendamento,
    "pausar_teca_sinalizar_sdr": pausar_teca_sinalizar_sdr,
    "marcar_etapa": marcar_etapa,
    "atualizar_dados_lead": atualizar_dados_lead,
    "consultar_dados_lead": consultar_dados_lead,
    "enviar_catalogo": enviar_catalogo,
    "consultar_kb_site": consultar_kb_site,
}


async def execute_tool(name: str, args: dict, *, phone: str, card_id: str | None,
                       tool_results: list[dict] | None = None) -> Any:
    """Dispatcher with phone/card_id injection where needed.

    tool_results: resultados já executados na rodada — a máquina de estados
    usa pra validar a transição 'agendado' (exige criar_agendamento ok).
    """
    fn = TOOL_FUNCTIONS.get(name)
    if not fn:
        return {"error": f"unknown tool: {name}"}

    # Inject contextual args
    if name == "pausar_teca_sinalizar_sdr":
        args = {**args, "phone": phone, "card_id": card_id}
    elif name == "marcar_etapa":
        args = {**args, "phone": phone, "card_id": card_id, "tool_results": tool_results}
    elif name == "criar_agendamento":
        args = {**args, "card_id": args.get("card_id") or card_id, "phone": phone}
    elif name == "atualizar_agendamento":
        args = {**args, "card_id": args.get("card_id") or card_id}
    elif name in ("atualizar_dados_lead", "consultar_dados_lead"):
        args = {**args, "phone": phone, "card_id": card_id}

    try:
        return await fn(**args)
    except Exception as e:
        logger.exception("teca_v2 tool %s failed", name)
        return {"error": str(e)}
