"""
Captura de leads do site público (parket.com.br / site.parket.works).

Recebe o submit do formulário multi-step com user data + Meta tracking,
cria card no CRM (comercial-entrada/leads-entrada) e dispara o evento
`Lead` no Meta CAPI (deduplicado via event_id com o Pixel JS do navegador).

POST /api/leads/capture
  body: {
    name, email, phone,                   # contato (passo 6)
    area_m2, region, cityFree,            # passo 1
    products: ["piso", "deck", ...],      # passo 2
    profile: "arquiteto"|"cliente_final", # passo 3
    interest: "completa"|"material",      # passo 4
    description,                          # passo 5

    # Meta CAPI tracking (capturado no submit do form):
    fbp, fbc, fbclid, event_id, page_url,
    user_agent, ip   # ip preenchido server-side se não vier
  }
  → 200 { ok, card_id, wa_url, event_id }
"""
from __future__ import annotations
import hashlib
import random
import re
import uuid
from datetime import datetime, timezone
from typing import Optional, Literal
import httpx
import structlog
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel

from app.config import settings

logger = structlog.get_logger(__name__)
router = APIRouter(prefix="/api/leads", tags=["leads"])

SB_URL = settings.SUPABASE_URL
SB_SK = settings.SUPABASE_SERVICE_KEY
SB_HEAD = {"apikey": SB_SK, "Authorization": f"Bearer {SB_SK}",
           "Content-Type": "application/json", "Prefer": "return=representation"}

# Meta Pixel + CAPI — Pixel ID já no site, Token via env (opcional).
# Sem token, o card é criado e o WhatsApp abre normal — só não dispara CAPI server-side.
META_PIXEL_ID = "1264030965924694"
META_CAPI_TOKEN = (getattr(settings, "META_CAPI_TOKEN", "") or "").strip()
META_TEST_EVENT_CODE = (getattr(settings, "META_TEST_EVENT_CODE", "") or "").strip()
META_GRAPH_VER = "v21.0"

WHATSAPP_NUMBER = "5511999600222"

# SDRs que recebem leads do site (atribuição random alternada).
SDRS_SITE = ["Vinicius Arruda", "Rafael Calazans"]


def _pick_sdr() -> str:
    return random.choice(SDRS_SITE)


def _h(v: Optional[str]) -> Optional[str]:
    """SHA256 hash pra Meta CAPI (lowercase + trim)."""
    if not v: return None
    return hashlib.sha256(v.strip().lower().encode()).hexdigest()


def _digits(v: Optional[str]) -> str:
    return re.sub(r"\D", "", v or "")


def _phone_for_meta(v: Optional[str]) -> Optional[str]:
    """Telefone E.164 sem '+', com DDI 55 se faltar."""
    d = _digits(v)
    if not d: return None
    if not d.startswith("55"): d = "55" + d
    return d


class LeadCaptureInput(BaseModel):
    name: str
    email: str
    phone: str

    # Form steps
    area_m2: Optional[int] = None
    region: Optional[str] = None
    cityFree: Optional[str] = None
    products: list[str] = []
    profile: Optional[Literal["arquiteto", "cliente_final"]] = None
    interest: Optional[Literal["completa", "material"]] = None
    description: Optional[str] = None

    # Meta tracking (browser-side)
    fbp: Optional[str] = None
    fbc: Optional[str] = None
    fbclid: Optional[str] = None
    event_id: Optional[str] = None
    page_url: Optional[str] = None
    landing_url: Optional[str] = None
    referrer: Optional[str] = None
    user_agent: Optional[str] = None

    # UTM
    utm_source: Optional[str] = None
    utm_medium: Optional[str] = None
    utm_campaign: Optional[str] = None
    utm_term: Optional[str] = None
    utm_content: Optional[str] = None

    # Outros click IDs. Google Ads moderno pode entregar gclid, gbraid (iOS
    # app→web) ou wbraid (web→app iOS) dependendo da campanha/consentimento.
    # Precisamos aceitar os 3 pra não perder atribuição.
    gclid: Optional[str] = None
    gbraid: Optional[str] = None
    wbraid: Optional[str] = None
    ttclid: Optional[str] = None

    # GA
    ga_client_id: Optional[str] = None
    ga_session_id: Optional[str] = None


@router.post("/capture")
async def capture_lead(body: LeadCaptureInput, request: Request):
    name = body.name.strip()[:120]
    email = str(body.email or "").strip().lower()
    if "@" not in email or "." not in email.split("@")[-1]:
        raise HTTPException(400, "email inválido")
    phone_d = _digits(body.phone)
    if len(phone_d) < 10:
        raise HTTPException(400, "telefone inválido")

    # IP do cliente. Atrás de Cloudflare + Traefik, o IP REAL vem em CF-Connecting-IP.
    # X-Forwarded-For nesse cenário traz o IP do servidor Cloudflare (104.x/172.x),
    # que o Meta descarta como inválido. Fallback: XFF, depois request.client.
    ip = (
        request.headers.get("cf-connecting-ip")
        or (request.headers.get("x-forwarded-for") or "").split(",")[0].strip()
        or (request.client.host if request.client else "")
        or ""
    ).strip()
    ua = body.user_agent or request.headers.get("user-agent", "")
    event_id = body.event_id or str(uuid.uuid4())
    event_time = int(datetime.now(timezone.utc).timestamp())

    cidade_label = ""
    if body.region and body.region.lower() == "outros" and body.cityFree:
        cidade_label = body.cityFree.strip()
    elif body.region:
        cidade_label = body.region.strip()

    produto_interesse = ", ".join(body.products) if body.products else ""

    interest_label = {"completa": "Material + Instalação", "material": "Só material"}.get(body.interest or "", "")
    profile_label = {"arquiteto": "Arquiteto", "cliente_final": "Cliente final"}.get(body.profile or "", "")

    # 1. Cria card no CRM — campos alinhados com outras fontes (Forms Meta etc.)
    now_iso = datetime.now(timezone.utc).isoformat()
    sdr = _pick_sdr()
    details = {
        "sdr": sdr,
        # Aba Lead
        "nome": name,
        "status_lead": "novo",
        "nivel_lead": "",
        "criado_por": "Form Site Parket",
        "data_criada": now_iso,
        "lead_captured_at": now_iso,

        # Aba Contato
        "email": email,
        "email_pessoal": email,
        "celular": phone_d,
        "telefone_comercial": "",

        # Aba Projeto
        "cidade": cidade_label,
        "metragem_estimada": body.area_m2,
        "area_m2": body.area_m2,
        "produto_interesse": produto_interesse,
        "relacao_obra": profile_label,                  # Arquiteto / Cliente final
        "tipo_interesse": interest_label,               # Material+Instalação / Só material

        # Aba Qualificação
        "perfil": profile_label,
        "interesse": interest_label,
        "descricao_lead": body.description or "",
        "resumo_qualificacao": body.description or "",
        "qualificacao_inicial": (
            f"Lead via site (form multistep). Perfil: {profile_label or '—'}. "
            f"Interesse: {interest_label or '—'}. "
            f"Produtos: {produto_interesse or '—'}. Cidade: {cidade_label or '—'}. "
            f"Área: {body.area_m2 or '—'} m²."
        ),

        # Origem
        "origem": "site",
        "origem_lead": "Site Parket",
        "origem_detalhe": "form_site_multistep",
        "platform": "site",
        "platform_label": "Site Parket",

        # TECA V2 ATIVA desde 2026-06-01 — novos leads do site são atendidos pela
        # Teca V2 (multi-agente Cortex+Conversational). V1 (teka_agent.py) segue desligada.
        "teka_ativa": True,
        "evo_instance": "Comercial - Parket",

        # Atribuição de campanha (UTM + click IDs)
        "attribution": {
            "utm_source": body.utm_source, "utm_medium": body.utm_medium,
            "utm_campaign": body.utm_campaign, "utm_term": body.utm_term,
            "utm_content": body.utm_content,
            "fbclid": body.fbclid, "gclid": body.gclid,
            "gbraid": body.gbraid, "wbraid": body.wbraid,
            "ttclid": body.ttclid,
            "landing_url": body.landing_url, "referrer": body.referrer,
            "page_url": body.page_url,
        },

        # Google Analytics
        "ga": {"client_id": body.ga_client_id, "session_id": body.ga_session_id},

        # Meta Pixel/CAPI tracking
        "meta_tracking": {
            "pixel_id": META_PIXEL_ID, "event_id": event_id, "event_name": "Lead",
            "fbp": body.fbp, "fbc": body.fbc, "fbclid": body.fbclid,
            "page_url": body.page_url, "ip": ip, "user_agent": ua,
        },
    }
    card_payload = {
        "dept_id": "comercial-entrada", "column_id": "leads-entrada",
        "title": name or email, "subtitle": cidade_label,
        "responsavel": sdr, "priority": "normal",
        "tags": ["site", "Form Site", f"sdr:{sdr.split()[0].lower()}"]
                + ([f"produto:{p}" for p in body.products[:3]]),
        "details": details,
    }
    card_id = None
    try:
        async with httpx.AsyncClient(timeout=15) as cli:
            r = await cli.post(f"{SB_URL}/rest/v1/kanban_cards", headers=SB_HEAD, json=card_payload)
            if r.status_code in (200, 201) and r.json():
                card_id = r.json()[0]["id"]
            else:
                logger.warning("lead_card_create_failed", status=r.status_code, body=r.text[:200])
    except Exception as e:
        logger.error("lead_card_create_exception", error=str(e))

    # 2. Dispara Meta CAPI (event_id = mesmo do Pixel JS → deduplicação)
    capi_status = "skipped_no_token"
    if META_CAPI_TOKEN:
        try:
            user_data = {
                "em": [_h(email)] if email else [],
                "ph": [_h(_phone_for_meta(phone_d))] if phone_d else [],
                "fn": [_h(name.split()[0])] if name else [],
                "ln": [_h(" ".join(name.split()[1:]))] if (name and len(name.split()) > 1) else [],
                "ct": [_h(cidade_label)] if cidade_label else [],
                "country": [_h("br")],
                "client_ip_address": ip or None,
                "client_user_agent": ua or None,
                "fbp": body.fbp or None,
                "fbc": body.fbc or None,
            }
            user_data = {k: v for k, v in user_data.items() if v}
            custom_data = {
                "content_name": "Lead Site Multistep",
                "content_category": produto_interesse or "Madeira Nobre",
                "currency": "BRL",
            }
            # Adiciona UTM/click IDs como custom_data (opcional pra Meta, mas útil pra reports)
            for k in ("utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content", "gclid", "ttclid"):
                v = getattr(body, k, None)
                if v: custom_data[k] = v
            event = {
                "event_name": "Lead", "event_time": event_time, "event_id": event_id,
                "action_source": "website", "event_source_url": body.page_url or "https://parket.com.br",
                "user_data": user_data,
                "custom_data": custom_data,
            }
            payload = {"data": [event]}
            if META_TEST_EVENT_CODE:
                payload["test_event_code"] = META_TEST_EVENT_CODE
            url = f"https://graph.facebook.com/{META_GRAPH_VER}/{META_PIXEL_ID}/events?access_token={META_CAPI_TOKEN}"
            async with httpx.AsyncClient(timeout=10) as cli:
                rc = await cli.post(url, json=payload)
                capi_status = f"{rc.status_code}"
                if rc.status_code >= 400:
                    logger.warning("meta_capi_fail", status=rc.status_code, body=rc.text[:300])
                else:
                    logger.info("meta_capi_lead_sent", event_id=event_id, status=rc.status_code)
        except Exception as e:
            capi_status = f"err:{str(e)[:60]}"
            logger.warning("meta_capi_exception", error=str(e))

    # 3. Monta link do WhatsApp pra o frontend abrir
    parts = [f"Olá! Meu nome é {name}."]
    if email: parts.append(f"E-mail: {email}")
    if phone_d: parts.append(f"Telefone: {phone_d}")
    if cidade_label: parts.append(f"Cidade: {cidade_label}")
    if body.area_m2: parts.append(f"Área: {body.area_m2} m²")
    if produto_interesse: parts.append(f"Produtos: {produto_interesse}")
    if interest_label: parts.append(f"Atendimento: {interest_label}")
    if profile_label: parts.append(f"Perfil: {profile_label}")
    if body.description: parts.append(f"\n{body.description.strip()[:600]}")
    parts.append("\nVim pelo formulário do site da Parket.")
    msg = "\n".join(parts)
    from urllib.parse import quote
    wa_url = f"https://wa.me/{WHATSAPP_NUMBER}?text={quote(msg)}"

    return {
        "ok": True, "card_id": card_id, "event_id": event_id,
        "wa_url": wa_url, "capi_status": capi_status,
    }


# ════════════════════════════════════════════════════════════════════════
# Qualificação: chamado pelo dashboard quando o card vai pra "qualificado".
# Dispara evento `Lead` (subtipo qualified) no Meta CAPI pra otimização.
# Idempotente: cada card só dispara 1×.
# ════════════════════════════════════════════════════════════════════════
class QualifyInput(BaseModel):
    card_id: str
    column_destino: Optional[str] = None   # ex: "qualificado", "qualificado-ia"
    qualified_by: Optional[str] = None     # nome do SDR/atendente que qualificou
    event_time: Optional[int] = None       # unix timestamp p/ backfill histórico
    event_id_suffix: Optional[str] = None  # sufixo p/ event_id (quebra idempotência)


@router.post("/qualify")
async def qualify_lead(body: QualifyInput, request: Request):
    # 1. Busca card e tracking
    async with httpx.AsyncClient(timeout=15) as cli:
        r = await cli.get(f"{SB_URL}/rest/v1/kanban_cards?id=eq.{body.card_id}&select=*",
                          headers=SB_HEAD)
        if r.status_code >= 400 or not r.json():
            raise HTTPException(404, "card não encontrado")
        card = r.json()[0]

    det = card.get("details") or {}
    meta = det.get("meta_tracking") or {}
    attrib = det.get("attribution") or {}

    # Idempotência: se já disparou QualifiedLead pra esse card, retorna OK e sai
    # (skipada quando event_id_suffix vier — backfill histórico gera novo event_id)
    if det.get("qualified_event_sent") and not body.event_id_suffix:
        return {"ok": True, "skipped": "already_sent",
                "event_id": det.get("qualified_event_id")}

    event_id = f"qual-{body.event_id_suffix}-{body.card_id}" if body.event_id_suffix else f"qual-{body.card_id}"
    event_time = body.event_time or int(datetime.now(timezone.utc).timestamp())

    capi_status = "skipped_no_token"
    if META_CAPI_TOKEN:
        email = (det.get("email") or det.get("email_pessoal") or "").strip().lower()
        phone_d = _digits(det.get("celular"))
        name = (det.get("nome") or card.get("title") or "").strip()
        cidade = (det.get("cidade") or "").strip()
        produto = (det.get("produto_interesse") or "").strip()

        # Meta Lead Ads: meta_lead_id vem como "l:1234567890" — Meta espera só
        # o número no user_data.lead_id. Isso conecta o evento ao lead do Lead
        # Ads diretamente pra atribuição de campanha (fallback do fbp/fbc quando
        # o lead veio de anúncio in-app sem passar pelo site).
        meta_lead_id = (det.get("meta_lead_id") or "").strip()
        lead_id_num = meta_lead_id[2:] if meta_lead_id.startswith("l:") else meta_lead_id

        user_data = {
            "em": [_h(email)] if email else [],
            "ph": [_h(_phone_for_meta(phone_d))] if phone_d else [],
            "fn": [_h(name.split()[0])] if name else [],
            "ln": [_h(" ".join(name.split()[1:]))] if (name and len(name.split()) > 1) else [],
            "ct": [_h(cidade)] if cidade else [],
            "country": [_h("br")],
            "client_ip_address": meta.get("ip") or None,
            "client_user_agent": meta.get("user_agent") or None,
            "fbp": meta.get("fbp") or None,
            "fbc": meta.get("fbc") or None,
            "lead_id": lead_id_num or None,
        }
        user_data = {k: v for k, v in user_data.items() if v}

        custom_data = {
            "content_name": "Qualified Lead",
            "content_category": produto or "Madeira Nobre",
            "currency": "BRL",
            "lead_event_source": "crm_qualified",
            "qualified_by": body.qualified_by or det.get("sdr") or "",
        }
        for k in ("utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content", "gclid", "ttclid"):
            v = attrib.get(k)
            if v: custom_data[k] = v
        # Meta Lead Ads metadata (webhook /meta-lead grava direto no details raiz).
        # Passa como custom_data pra reports internos + reforço de atribuição.
        for k in ("ad_id", "ad_name", "adset_id", "adset_name",
                  "campaign_id", "campaign_name", "form_id", "form_name", "platform"):
            v = det.get(k)
            if v: custom_data[k] = v

        event = {
            # Custom event: separar visualmente nos relatórios de quem só preencheu
            # o formulário (event_name=Lead) de quem foi qualificado pelo CRM.
            "event_name": "LeadQualificado",
            "event_time": event_time, "event_id": event_id,
            "action_source": "system_generated",
            "event_source_url": attrib.get("page_url") or "https://parket.com.br",
            "user_data": user_data,
            "custom_data": custom_data,
        }
        payload = {"data": [event]}
        if META_TEST_EVENT_CODE:
            payload["test_event_code"] = META_TEST_EVENT_CODE
        url = f"https://graph.facebook.com/{META_GRAPH_VER}/{META_PIXEL_ID}/events?access_token={META_CAPI_TOKEN}"
        try:
            async with httpx.AsyncClient(timeout=10) as cli:
                rc = await cli.post(url, json=payload)
                capi_status = str(rc.status_code)
                if rc.status_code >= 400:
                    logger.warning("meta_capi_qualify_fail", status=rc.status_code, body=rc.text[:300])
                else:
                    logger.info("meta_capi_qualified_sent", event_id=event_id, card_id=body.card_id)
        except Exception as e:
            capi_status = f"err:{str(e)[:60]}"
            logger.warning("meta_capi_qualify_exception", error=str(e))

    # 2. Marca o card como qualificado (idempotência + auditoria)
    # qualified_event_sent só vira True quando o CAPI confirmou (HTTP 2xx) —
    # se está skipped_no_token ou erro, deixa False pra permitir retentativa
    # depois que o token for configurado.
    capi_ok = capi_status.isdigit() and 200 <= int(capi_status) < 300
    qualified_at = datetime.now(timezone.utc).isoformat()
    new_det = {
        **det,
        "qualified_event_sent": capi_ok,
        "qualified_event_id": event_id,
        "qualified_at": qualified_at,
        "qualified_by": body.qualified_by or det.get("sdr") or "",
        "qualified_capi_status": capi_status,
        "status_lead": "qualificado",
    }
    try:
        async with httpx.AsyncClient(timeout=10) as cli:
            await cli.patch(f"{SB_URL}/rest/v1/kanban_cards?id=eq.{body.card_id}",
                            headers=SB_HEAD, json={"details": new_det})
    except Exception as e:
        logger.warning("qualify_patch_card_fail", error=str(e))

    return {
        "ok": True, "card_id": body.card_id, "event_id": event_id,
        "capi_status": capi_status, "qualified_at": qualified_at,
    }


# ════════════════════════════════════════════════════════════════════════
# Fechamento (Ganho): chamado pelo dashboard quando o card vai pra "ganho".
# Dispara evento `Fechado` (custom event) no Meta CAPI pra reporting de
# negócios fechados. Idempotente: cada card só dispara 1×.
# ════════════════════════════════════════════════════════════════════════
class ClosedInput(BaseModel):
    card_id: str
    closed_by: Optional[str] = None
    event_time: Optional[int] = None
    event_id_suffix: Optional[str] = None


@router.post("/closed")
async def closed_lead(body: ClosedInput, request: Request):
    async with httpx.AsyncClient(timeout=15) as cli:
        r = await cli.get(f"{SB_URL}/rest/v1/kanban_cards?id=eq.{body.card_id}&select=*",
                          headers=SB_HEAD)
        if r.status_code >= 400 or not r.json():
            raise HTTPException(404, "card não encontrado")
        card = r.json()[0]

    det = card.get("details") or {}
    meta = det.get("meta_tracking") or {}
    attrib = det.get("attribution") or {}

    if det.get("closed_event_sent") and not body.event_id_suffix:
        return {"ok": True, "skipped": "already_sent",
                "event_id": det.get("closed_event_id")}

    event_id = f"closed-{body.event_id_suffix}-{body.card_id}" if body.event_id_suffix else f"closed-{body.card_id}"
    event_time = body.event_time or int(datetime.now(timezone.utc).timestamp())

    capi_status = "skipped_no_token"
    if META_CAPI_TOKEN:
        email = (det.get("email") or det.get("email_pessoal") or "").strip().lower()
        phone_d = _digits(det.get("celular"))
        name = (det.get("nome") or card.get("title") or "").strip()
        cidade = (det.get("cidade") or "").strip()
        produto = (det.get("produto_interesse") or "").strip()

        meta_lead_id = (det.get("meta_lead_id") or "").strip()
        lead_id_num = meta_lead_id[2:] if meta_lead_id.startswith("l:") else meta_lead_id

        user_data = {
            "em": [_h(email)] if email else [],
            "ph": [_h(_phone_for_meta(phone_d))] if phone_d else [],
            "fn": [_h(name.split()[0])] if name else [],
            "ln": [_h(" ".join(name.split()[1:]))] if (name and len(name.split()) > 1) else [],
            "ct": [_h(cidade)] if cidade else [],
            "country": [_h("br")],
            "client_ip_address": meta.get("ip") or None,
            "client_user_agent": meta.get("user_agent") or None,
            "fbp": meta.get("fbp") or None,
            "fbc": meta.get("fbc") or None,
            "lead_id": lead_id_num or None,
        }
        user_data = {k: v for k, v in user_data.items() if v}

        # Parse valor do orçamento (formato "R$ 312.350,00" → 312350.00)
        def _parse_brl(s):
            if not s: return None
            try:
                t = re.sub(r"[^\d,.\-]", "", str(s)).replace(".", "").replace(",", ".")
                v = float(t)
                return v if v > 0 else None
            except Exception:
                return None
        value_brl = (
            _parse_brl(det.get("valor_orcamento_enviado"))
            or _parse_brl(det.get("orc_valor_total"))
            or _parse_brl(det.get("valor_fechamento"))
        )

        custom_data = {
            "content_name": "Negócio Fechado — Parket",
            "content_category": produto or "Madeira Nobre",
            "content_ids": [str(body.card_id)],
            "num_items": 1,
            "currency": "BRL",
            "lead_event_source": "crm_closed",
            "closed_by": body.closed_by or det.get("sdr") or "",
        }
        # Purchase exige "value" — Meta rejeita 400 sem ele. Fallback 1.0 quando
        # o card não tem valor de orçamento nos details (não impacta ROAS agregado).
        custom_data["value"] = round(value_brl, 2) if value_brl else 1.0
        for k in ("utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content", "gclid", "ttclid"):
            v = attrib.get(k)
            if v: custom_data[k] = v
        # Meta Lead Ads metadata (webhook /meta-lead).
        for k in ("ad_id", "ad_name", "adset_id", "adset_name",
                  "campaign_id", "campaign_name", "form_id", "form_name", "platform"):
            v = det.get(k)
            if v: custom_data[k] = v

        event = {
            # Standard event Purchase: Meta otimiza por valor (R$) — ROAS.
            # Diferenciação interna via content_name + lead_event_source.
            "event_name": "Purchase",
            "event_time": event_time, "event_id": event_id,
            "action_source": "system_generated",
            "event_source_url": attrib.get("page_url") or "https://parket.com.br",
            "user_data": user_data,
            "custom_data": custom_data,
        }
        payload = {"data": [event]}
        if META_TEST_EVENT_CODE:
            payload["test_event_code"] = META_TEST_EVENT_CODE
        url = f"https://graph.facebook.com/{META_GRAPH_VER}/{META_PIXEL_ID}/events?access_token={META_CAPI_TOKEN}"
        try:
            async with httpx.AsyncClient(timeout=10) as cli:
                rc = await cli.post(url, json=payload)
                capi_status = str(rc.status_code)
                if rc.status_code >= 400:
                    logger.warning("meta_capi_closed_fail", status=rc.status_code, body=rc.text[:300])
                else:
                    logger.info("meta_capi_closed_sent", event_id=event_id, card_id=body.card_id)
        except Exception as e:
            capi_status = f"err:{str(e)[:60]}"
            logger.warning("meta_capi_closed_exception", error=str(e))

    capi_ok = capi_status.isdigit() and 200 <= int(capi_status) < 300
    closed_at = datetime.now(timezone.utc).isoformat()
    new_det = {
        **det,
        "closed_event_sent": capi_ok,
        "closed_event_id": event_id,
        "closed_at": closed_at,
        "closed_by": body.closed_by or det.get("sdr") or "",
        "closed_capi_status": capi_status,
        "status_lead": "ganho",
    }
    try:
        async with httpx.AsyncClient(timeout=10) as cli:
            await cli.patch(f"{SB_URL}/rest/v1/kanban_cards?id=eq.{body.card_id}",
                            headers=SB_HEAD, json={"details": new_det})
    except Exception as e:
        logger.warning("closed_patch_card_fail", error=str(e))

    return {
        "ok": True, "card_id": body.card_id, "event_id": event_id,
        "capi_status": capi_status, "closed_at": closed_at,
    }
