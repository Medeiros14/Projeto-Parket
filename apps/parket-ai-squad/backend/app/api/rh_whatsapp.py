"""
RH WhatsApp Sender — endpoint pra Parket RH disparar mensagens
via Evolution API (instância "Parket") sem expor a API key no frontend.

POST /api/rh-whatsapp/send
  body: {
    telefone: "11999998888",   # com ou sem DDI 55
    mensagem: "...",
    colaborador_id?: "uuid",   # opcional, pra log
    documento_id?: "uuid",     # opcional, pra log
    instance?: "Parket"        # default "Parket"
  }
  resp: { ok: bool, message_id?: string, telefone_normalizado: string, error?: string }
"""
from __future__ import annotations

import asyncio
import random
import re
from datetime import datetime, timezone
from typing import Optional

import httpx
import structlog
from fastapi import APIRouter, BackgroundTasks, HTTPException
from pydantic import BaseModel

from app.core.evolution_client import EvolutionAPIClient
from app.config import settings

logger = structlog.get_logger(__name__)
router = APIRouter(prefix="/api/rh-whatsapp", tags=["rh-whatsapp"])

DEFAULT_INSTANCE = "Rh - Parket"  # número do RH: 41 99858-0250


class SendInput(BaseModel):
    telefone: str
    mensagem: str
    colaborador_id: Optional[str] = None
    documento_id: Optional[str] = None
    instance: Optional[str] = None


def _normalize_phone(raw: str) -> str | None:
    digits = re.sub(r"\D", "", raw or "")
    if len(digits) < 10:
        return None
    if not digits.startswith("55"):
        digits = "55" + digits
    return digits


async def _log_rh_whatsapp(payload: dict, status: str, response: dict | None, error: str | None):
    """Grava em rh.whatsapp_logs no Supabase (best-effort, não bloqueia)."""
    if not settings.SUPABASE_URL or not settings.SUPABASE_SERVICE_KEY:
        return
    body = {
        "telefone": payload.get("telefone_normalizado"),
        "mensagem": (payload.get("mensagem") or "")[:4000],
        "colaborador_id": payload.get("colaborador_id"),
        "documento_id": payload.get("documento_id"),
        "instance": payload.get("instance"),
        "status": status,
        "response": response or {},
        "error": (error or "")[:1000] if error else None,
        "sent_at": datetime.now(timezone.utc).isoformat(),
    }
    try:
        async with httpx.AsyncClient(timeout=10.0) as c:
            await c.post(
                f"{settings.SUPABASE_URL}/rest/v1/whatsapp_logs",
                headers={
                    "apikey": settings.SUPABASE_SERVICE_KEY,
                    "Authorization": f"Bearer {settings.SUPABASE_SERVICE_KEY}",
                    "Content-Type": "application/json",
                    "Content-Profile": "rh",
                },
                json=body,
            )
    except Exception as e:
        logger.warning("rh_whatsapp_log_failed", error=str(e)[:200])


@router.post("/send")
async def send_whatsapp(payload: SendInput):
    """Manda 1 mensagem de WhatsApp via Evolution API."""
    phone = _normalize_phone(payload.telefone)
    if not phone:
        raise HTTPException(400, "Telefone inválido (mínimo 10 dígitos com DDD)")
    if not (payload.mensagem or "").strip():
        raise HTTPException(400, "Mensagem vazia")

    instance = payload.instance or DEFAULT_INSTANCE
    client = EvolutionAPIClient(instance=instance)

    log_payload = {
        "telefone_normalizado": phone,
        "mensagem": payload.mensagem,
        "colaborador_id": payload.colaborador_id,
        "documento_id": payload.documento_id,
        "instance": instance,
    }

    try:
        result = await client.send_text(group_id=phone, text=payload.mensagem)
        message_id = (result or {}).get("key", {}).get("id") if isinstance(result, dict) else None
        await _log_rh_whatsapp(log_payload, "sent", result, None)
        return {"ok": True, "message_id": message_id, "telefone_normalizado": phone}
    except httpx.HTTPStatusError as e:
        body = ""
        try: body = e.response.text[:300]
        except Exception: pass
        err = f"Evolution {e.response.status_code}: {body}"
        await _log_rh_whatsapp(log_payload, "failed", None, err)
        logger.error("rh_whatsapp_http_error", status=e.response.status_code, body=body[:200])
        raise HTTPException(502, err)
    except Exception as e:
        err = str(e)[:300]
        await _log_rh_whatsapp(log_payload, "failed", None, err)
        logger.error("rh_whatsapp_failed", error=err)
        raise HTTPException(500, err)


# ─── Mural RH ─────────────────────────────────────────────────────────
# Grupo destino quando colaborador entra no mural com Nome+CPF, e também
# quando dispara em massa pelos admins.
GRUPO_RH_JID = "120363405634674702@g.us"  # 👥 Parket - RH


class MuralEntradaInput(BaseModel):
    mural_slug: str
    mural_titulo: Optional[str] = None
    nome: str
    cpf: str
    # "assinado" (default agora) = colaborador concluiu a assinatura.
    # "entrada" (legado) = só identificou-se sem assinar. Não disparar mais.
    evento: str = "assinado"


def _mask_cpf(cpf: str) -> str:
    d = re.sub(r"\D", "", cpf or "")
    if len(d) == 11:
        return f"{d[:3]}.{d[3:6]}.{d[6:9]}-{d[9:]}"
    return cpf


@router.post("/mural-entrada")
async def mural_entrada(payload: MuralEntradaInput):
    """Avisa o grupo 👥 Parket - RH quando colaborador entra no mural.
    Tenta enriquecer com cargo via JOIN com admissoes/cargos pelo CPF."""
    cpf_clean = re.sub(r"\D", "", payload.cpf or "")
    cargo = ""

    # Busca cargo ativo via admissoes → cargos (best-effort)
    if cpf_clean and settings.SUPABASE_URL and settings.SUPABASE_SERVICE_KEY:
        try:
            async with httpx.AsyncClient(timeout=8.0) as c:
                # Busca colaborador
                rc = await c.get(
                    f"{settings.SUPABASE_URL}/rest/v1/colaboradores",
                    headers={
                        "apikey": settings.SUPABASE_SERVICE_KEY,
                        "Authorization": f"Bearer {settings.SUPABASE_SERVICE_KEY}",
                        "Accept-Profile": "rh",
                    },
                    params={"cpf": f"eq.{cpf_clean}", "select": "id", "limit": "1"},
                )
                colab_id = (rc.json()[0]["id"]
                            if rc.status_code == 200 and rc.json() else None)
                if colab_id:
                    ra = await c.get(
                        f"{settings.SUPABASE_URL}/rest/v1/admissoes",
                        headers={
                            "apikey": settings.SUPABASE_SERVICE_KEY,
                            "Authorization": f"Bearer {settings.SUPABASE_SERVICE_KEY}",
                            "Accept-Profile": "rh",
                        },
                        params={
                            "colaborador_id": f"eq.{colab_id}",
                            "select": "cargos(nome)",
                            "order": "data_admissao.desc",
                            "limit": "1",
                        },
                    )
                    if ra.status_code == 200 and ra.json():
                        cargo = (ra.json()[0].get("cargos") or {}).get("nome") or ""
        except Exception as e:
            logger.warning("mural_entrada_cargo_lookup_failed", error=str(e)[:120])

    titulo = payload.mural_titulo or payload.mural_slug
    if payload.evento == "assinado":
        header = "✅ *Documento ASSINADO*"
    else:
        # Compatibilidade: se algum cliente antigo ainda mandar sem evento
        # ou com "entrada", silenciamos (não notificamos só por entrada).
        logger.info("mural_entrada_ignored_non_signed",
                    mural=payload.mural_slug, evento=payload.evento)
        return {"ok": True, "ignored": True, "reason": "evento != assinado"}
    msg_lines = [
        header,
        f"📄 {titulo}",
        "",
        f"👤 *Nome:* {payload.nome}",
    ]
    if cargo:
        msg_lines.append(f"💼 *Cargo:* {cargo}")
    msg_lines.append(f"🪪 *CPF:* {_mask_cpf(payload.cpf)}")
    msg = "\n".join(msg_lines)

    try:
        client = EvolutionAPIClient(instance=DEFAULT_INSTANCE)
        await client.send_text(group_id=GRUPO_RH_JID, text=msg)
        logger.info("mural_entrada_notificada", mural=payload.mural_slug, cargo_found=bool(cargo))
        return {"ok": True, "cargo": cargo or None}
    except Exception as e:
        logger.warning("mural_entrada_send_failed", error=str(e)[:200])
        # Best-effort — não bloqueia o fluxo do mural se WhatsApp falhar.
        return {"ok": False, "error": str(e)[:200]}


class MuralBroadcastInput(BaseModel):
    mural_slug: str
    mural_titulo: str
    mensagem: str  # corpo da mensagem; o link é anexado no fim
    colaborador_ids: list[str]
    # Envio gradual pra evitar bloqueio do WhatsApp (anti-spam heuristics).
    # Defaults conservadores: 12-30s entre mensagens (vira ~3 msgs/min).
    delay_min_s: int = 12
    delay_max_s: int = 30
    personalizar: bool = True  # prefixa "Olá, <PrimeiroNome>!" na mensagem
    simular_digitacao: bool = True  # envia presenceUpdate antes (typing)


class MuralOpenedInput(BaseModel):
    mural_slug: str
    colaborador_id: str


@router.post("/mural-opened")
async def mural_opened(payload: MuralOpenedInput):
    """Marca opened_at quando o colaborador ABRE o link (antes mesmo de
    preencher Nome+CPF). Idempotente — só seta se ainda for NULL.
    Usado pelo MuralPublico assim que o link `?c=<colab_id>` é carregado."""
    if not settings.SUPABASE_URL or not settings.SUPABASE_SERVICE_KEY:
        raise HTTPException(500, "Supabase não configurado")
    now_iso = datetime.now(timezone.utc).isoformat()
    headers = {
        "apikey": settings.SUPABASE_SERVICE_KEY,
        "Authorization": f"Bearer {settings.SUPABASE_SERVICE_KEY}",
        "Content-Type": "application/json",
        "Content-Profile": "rh",
    }
    try:
        async with httpx.AsyncClient(timeout=8.0) as c:
            # 1) Tenta UPDATE direto — funciona se o registro já existe
            #    (caso comum: foi enviado pelo broadcast antes).
            r = await c.patch(
                f"{settings.SUPABASE_URL}/rest/v1/mural_envios",
                headers={**headers, "Prefer": "return=representation"},
                params={
                    "mural_slug": f"eq.{payload.mural_slug}",
                    "colaborador_id": f"eq.{payload.colaborador_id}",
                    "opened_at": "is.null",  # só atualiza se ainda for NULL
                },
                json={"opened_at": now_iso},
            )
            updated = r.json() if r.status_code < 300 else []
            if updated:
                return {"ok": True, "action": "updated"}

            # 2) Se não atualizou (registro não existe OU já tinha opened_at),
            #    tenta INSERT. Erro de duplicata é ignorado (já marcou antes).
            r2 = await c.post(
                f"{settings.SUPABASE_URL}/rest/v1/mural_envios",
                headers={**headers, "Prefer": "return=minimal"},
                json={
                    "mural_slug": payload.mural_slug,
                    "colaborador_id": payload.colaborador_id,
                    "opened_at": now_iso,
                },
            )
            if r2.status_code < 300:
                return {"ok": True, "action": "inserted"}
            # 409 = UNIQUE violation = registro já existe e já tinha opened_at
            if r2.status_code == 409:
                return {"ok": True, "action": "already_opened"}
            logger.warning("mural_opened_insert_failed",
                           status=r2.status_code, body=r2.text[:200])
            return {"ok": False, "error": f"HTTP {r2.status_code}"}
    except Exception as e:
        logger.warning("mural_opened_failed", error=str(e)[:200])
        return {"ok": False, "error": str(e)[:200]}


@router.get("/mural-status/{mural_slug}")
async def mural_status(mural_slug: str):
    """Lista colaboradores que receberam o mural e status (abriu/assinou).
    Usa service_role pra bypassar RLS."""
    if not settings.SUPABASE_URL or not settings.SUPABASE_SERVICE_KEY:
        raise HTTPException(500, "Supabase não configurado")
    headers = {
        "apikey": settings.SUPABASE_SERVICE_KEY,
        "Authorization": f"Bearer {settings.SUPABASE_SERVICE_KEY}",
        "Accept-Profile": "rh",
    }
    async with httpx.AsyncClient(timeout=15.0) as c:
        r = await c.get(
            f"{settings.SUPABASE_URL}/rest/v1/mural_envios",
            headers=headers,
            params={
                "select": "colaborador_id,sent_at,opened_at,signed_at,colaboradores(nome,celular)",
                "mural_slug": f"eq.{mural_slug}",
                "order": "sent_at.desc",
            },
        )
        if r.status_code >= 400:
            raise HTTPException(502, f"Supabase: {r.status_code} {r.text[:200]}")
        envios = r.json() or []

    nao_abriram = []
    abriram_nao_assinaram = []
    assinaram = []
    for e in envios:
        item = {
            "colaborador_id": e["colaborador_id"],
            "nome": (e.get("colaboradores") or {}).get("nome"),
            "celular": (e.get("colaboradores") or {}).get("celular"),
            "sent_at": e.get("sent_at"),
            "opened_at": e.get("opened_at"),
            "signed_at": e.get("signed_at"),
        }
        if e.get("signed_at"):
            assinaram.append(item)
        elif e.get("opened_at"):
            abriram_nao_assinaram.append(item)
        else:
            nao_abriram.append(item)
    return {
        "total_enviados": len(envios),
        "nao_abriram": nao_abriram,
        "abriram_nao_assinaram": abriram_nao_assinaram,
        "assinaram": assinaram,
    }


@router.get("/monitor")
async def monitor_whatsapp(fonte: str = "mural"):
    """Lista envios + status pra dashboard de monitoramento.

    Query param `fonte`:
      - "mural" (default): rh.mural_envios (avisos/comunicados via WhatsApp)
      - "documentos": rh.documentos_emitidos (docs ClickSign)
      - "tudo": mescla os dois, cada item ganha campo `fonte`

    Usa service_role pra bypassar RLS."""
    if not settings.SUPABASE_URL or not settings.SUPABASE_SERVICE_KEY:
        raise HTTPException(500, "Supabase não configurado")
    f = (fonte or "mural").lower().strip()
    if f == "documentos":
        return await _monitor_documentos()
    if f == "tudo":
        m = await _monitor_mural()
        d = await _monitor_documentos()
        for bucket in ("pendentes_sem_celular", "nao_abriram", "abriram_nao_assinaram", "assinaram"):
            for it in m[bucket]: it["fonte"] = "mural"
            for it in d[bucket]: it["fonte"] = "documento"
        return {
            "total_envios": m["total_envios"] + d["total_envios"],
            "pendentes_sem_celular": m["pendentes_sem_celular"] + d["pendentes_sem_celular"],
            "nao_abriram": m["nao_abriram"] + d["nao_abriram"],
            "abriram_nao_assinaram": m["abriram_nao_assinaram"] + d["abriram_nao_assinaram"],
            "assinaram": m["assinaram"] + d["assinaram"],
        }
    return await _monitor_mural()


async def _monitor_mural():
    headers = {
        "apikey": settings.SUPABASE_SERVICE_KEY,
        "Authorization": f"Bearer {settings.SUPABASE_SERVICE_KEY}",
        "Accept-Profile": "rh",
    }
    async with httpx.AsyncClient(timeout=15.0) as c:
        envs_r = await c.get(
            f"{settings.SUPABASE_URL}/rest/v1/mural_envios",
            headers=headers,
            params={
                "select": "id,mural_slug,colaborador_id,sent_at,opened_at,signed_at,colaboradores(nome,celular)",
                "order": "sent_at.desc",
            },
        )
        if envs_r.status_code >= 400:
            raise HTTPException(502, f"Supabase envios: {envs_r.status_code}")
        envios = envs_r.json() or []

        pend_r = await c.get(
            f"{settings.SUPABASE_URL}/rest/v1/mural_pendencias",
            headers=headers,
            params={
                "select": "id,mural_slug,colaborador_id,created_at,resolvido,resolved_at,colaboradores(nome,celular)",
                "resolvido": "eq.false",
                "order": "created_at.desc",
            },
        )
        if pend_r.status_code >= 400:
            raise HTTPException(502, f"Supabase pendências: {pend_r.status_code}")
        pendencias = pend_r.json() or []

        murs_r = await c.get(
            f"{settings.SUPABASE_URL}/rest/v1/murais",
            headers=headers,
            params={"select": "slug,titulo"},
        )
        slug_to_titulo: dict[str, str] = {}
        if murs_r.status_code == 200:
            for m in murs_r.json() or []:
                slug_to_titulo[m["slug"]] = m["titulo"]

    def _item(row: dict) -> dict:
        col = row.get("colaboradores") or {}
        return {
            "id": row["id"],
            "mural_slug": row.get("mural_slug"),
            "mural_titulo": slug_to_titulo.get(row.get("mural_slug"), row.get("mural_slug")),
            "colaborador_id": row["colaborador_id"],
            "nome": col.get("nome"),
            "celular": col.get("celular"),
            "sent_at": row.get("sent_at"),
            "opened_at": row.get("opened_at"),
            "signed_at": row.get("signed_at"),
        }

    nao_abriram = []
    abriram_nao_assinaram = []
    assinaram = []
    for r in envios:
        if r.get("signed_at"):
            assinaram.append(_item(r))
        elif r.get("opened_at"):
            abriram_nao_assinaram.append(_item(r))
        else:
            nao_abriram.append(_item(r))

    pendentes = []
    for p in pendencias:
        col = p.get("colaboradores") or {}
        pendentes.append({
            "id": p["id"],
            "mural_slug": p.get("mural_slug"),
            "mural_titulo": slug_to_titulo.get(p.get("mural_slug"), p.get("mural_slug")),
            "colaborador_id": p["colaborador_id"],
            "nome": col.get("nome"),
            "celular": col.get("celular"),
            "created_at": p.get("created_at"),
        })

    return {
        "total_envios": len(envios),
        "pendentes_sem_celular": pendentes,
        "nao_abriram": nao_abriram,
        "abriram_nao_assinaram": abriram_nao_assinaram,
        "assinaram": assinaram,
    }


async def _monitor_documentos():
    """Lê rh.documentos_emitidos (ClickSign). Buckets baseados em clicksign_* timestamps."""
    headers = {
        "apikey": settings.SUPABASE_SERVICE_KEY,
        "Authorization": f"Bearer {settings.SUPABASE_SERVICE_KEY}",
        "Accept-Profile": "rh",
    }
    async with httpx.AsyncClient(timeout=15.0) as c:
        docs_r = await c.get(
            f"{settings.SUPABASE_URL}/rest/v1/documentos_emitidos",
            headers=headers,
            params={
                "select": "id,titulo,colaborador_id,nome_informado,canal_assinatura,status,clicksign_status,enviado_em,clicksign_enviado_em,clicksign_visualizado_em,clicksign_assinado_em,assinado_em,clicksign_signer_url,clicksign_envelope_id,colaboradores(nome,celular)",
                "or": "(clicksign_envelope_id.not.is.null,canal_assinatura.eq.clicksign)",
                "order": "created_at.desc",
                "limit": "1000",
            },
        )
        if docs_r.status_code >= 400:
            raise HTTPException(502, f"Supabase documentos_emitidos: {docs_r.status_code} {docs_r.text[:200]}")
        docs = docs_r.json() or []

    def _item(row: dict) -> dict:
        col = row.get("colaboradores") or {}
        return {
            "id": row["id"],
            "mural_slug": None,
            "mural_titulo": row.get("titulo") or "(documento)",
            "colaborador_id": row.get("colaborador_id"),
            "nome": col.get("nome") or row.get("nome_informado"),
            "celular": col.get("celular"),
            "sent_at": row.get("clicksign_enviado_em") or row.get("enviado_em"),
            "opened_at": row.get("clicksign_visualizado_em"),
            "signed_at": row.get("clicksign_assinado_em") or row.get("assinado_em"),
            "clicksign_signer_url": row.get("clicksign_signer_url"),
            "clicksign_envelope_id": row.get("clicksign_envelope_id"),
            "status": row.get("status"),
            "clicksign_status": row.get("clicksign_status"),
        }

    nao_abriram = []
    abriram_nao_assinaram = []
    assinaram = []
    pendentes_sem_celular = []

    for r in docs:
        it = _item(r)
        # status "cancelado", "recusado", "expirado": pula (não vai pra nenhum bucket ativo)
        if (r.get("status") or "") in ("cancelado", "recusado", "expirado"):
            continue
        if it["signed_at"]:
            assinaram.append(it)
        elif it["opened_at"]:
            abriram_nao_assinaram.append(it)
        elif it["sent_at"]:
            # Foi enviado mas não abriu. Se colab não tem celular cadastrado, vai pra sem_celular
            if not it["celular"]:
                pendentes_sem_celular.append({**it, "created_at": it["sent_at"]})
            else:
                nao_abriram.append(it)
        # ignora docs sem sent_at (rascunhos)

    return {
        "total_envios": len(nao_abriram) + len(abriram_nao_assinaram) + len(assinaram) + len(pendentes_sem_celular),
        "pendentes_sem_celular": pendentes_sem_celular,
        "nao_abriram": nao_abriram,
        "abriram_nao_assinaram": abriram_nao_assinaram,
        "assinaram": assinaram,
    }


@router.get("/colaboradores-broadcast")
async def colaboradores_broadcast():
    """Lista colaboradores com vínculo ativo (empresa + departamento + celular)
    pro modal de broadcast do mural. Usa service_role pra bypassar RLS."""
    if not settings.SUPABASE_URL or not settings.SUPABASE_SERVICE_KEY:
        raise HTTPException(500, "Supabase não configurado")

    headers = {
        "apikey": settings.SUPABASE_SERVICE_KEY,
        "Authorization": f"Bearer {settings.SUPABASE_SERVICE_KEY}",
        "Accept-Profile": "rh",
    }
    async with httpx.AsyncClient(timeout=15.0) as c:
        # Colaboradores + contratos (FK desambiguada)
        r = await c.get(
            f"{settings.SUPABASE_URL}/rest/v1/colaboradores",
            headers=headers,
            params={
                "select": "id,nome,celular,contratos!contratos_colaborador_id_fkey(empresa_id,departamento_id,status)",
                "order": "nome.asc",
            },
        )
        if r.status_code >= 400:
            raise HTTPException(502, f"Supabase: {r.status_code} {r.text[:200]}")
        colabs_raw = r.json() or []

        # Empresas + departamentos
        emp_r = await c.get(
            f"{settings.SUPABASE_URL}/rest/v1/empresas",
            headers=headers,
            params={"select": "id,razao_social", "order": "razao_social.asc"},
        )
        dep_r = await c.get(
            f"{settings.SUPABASE_URL}/rest/v1/departamentos",
            headers=headers,
            params={"select": "id,nome", "order": "nome.asc"},
        )

    # Reduz contratos pro contrato ativo
    colabs = []
    for c_raw in colabs_raw:
        contratos = c_raw.get("contratos") or []
        ativo = next((ct for ct in contratos if ct.get("status") == "ativo"), None) or (contratos[0] if contratos else {})
        colabs.append({
            "id": c_raw["id"],
            "nome": c_raw["nome"],
            "celular": c_raw.get("celular"),
            "empresa_id": ativo.get("empresa_id"),
            "departamento_id": ativo.get("departamento_id"),
        })

    return {
        "colaboradores": colabs,
        "empresas": emp_r.json() if emp_r.status_code == 200 else [],
        "departamentos": dep_r.json() if dep_r.status_code == 200 else [],
    }


async def _save_pendencia_sem_celular(mural_slug: str, colab_id: str):
    """Marca colaborador como pendente de celular pra esse mural.
    UNIQUE(mural_slug, colaborador_id) → idempotente."""
    if not settings.SUPABASE_URL or not settings.SUPABASE_SERVICE_KEY:
        return
    try:
        async with httpx.AsyncClient(timeout=8.0) as c2:
            await c2.post(
                f"{settings.SUPABASE_URL}/rest/v1/mural_pendencias",
                headers={
                    "apikey": settings.SUPABASE_SERVICE_KEY,
                    "Authorization": f"Bearer {settings.SUPABASE_SERVICE_KEY}",
                    "Content-Type": "application/json",
                    "Content-Profile": "rh",
                    "Prefer": "resolution=merge-duplicates,return=minimal",
                },
                json={
                    "mural_slug": mural_slug, "colaborador_id": colab_id,
                    "motivo": "sem_celular", "resolvido": False,
                },
            )
    except Exception as e:
        logger.warning("mural_pendencia_save_failed", error=str(e)[:200])


async def _save_mural_envio(mural_slug: str, colab_id: str):
    try:
        async with httpx.AsyncClient(timeout=8.0) as c2:
            await c2.post(
                f"{settings.SUPABASE_URL}/rest/v1/mural_envios",
                headers={
                    "apikey": settings.SUPABASE_SERVICE_KEY,
                    "Authorization": f"Bearer {settings.SUPABASE_SERVICE_KEY}",
                    "Content-Type": "application/json",
                    "Content-Profile": "rh",
                    "Prefer": "resolution=merge-duplicates,return=minimal",
                },
                json={"mural_slug": mural_slug, "colaborador_id": colab_id},
            )
    except Exception as ex2:
        logger.warning("mural_envio_save_failed", error=str(ex2)[:200])


async def _run_broadcast_background(payload: MuralBroadcastInput, colabs: list[dict]):
    """Roda o envio em background com delay aleatório entre mensagens pra
    evitar bloqueio do WhatsApp por flood. Personaliza o nome quando possível.
    Progresso fica visível em mural_envios (dashboard /documentosPendentes)."""
    base_link = f"https://rh.parket.works/mural/{payload.mural_slug}"
    client = EvolutionAPIClient(instance=DEFAULT_INSTANCE)

    # Embaralha pra não enviar sempre na mesma ordem alfabética → menos padrão
    candidates = [c for c in colabs if (c.get("celular") or "").strip()]
    random.shuffle(candidates)

    # Quem não tem celular: já registra pendência logo
    for colab in colabs:
        if not (colab.get("celular") or "").strip():
            await _save_pendencia_sem_celular(payload.mural_slug, colab["id"])

    d_min = max(2, int(payload.delay_min_s))
    d_max = max(d_min, int(payload.delay_max_s))

    sent_count = fail_count = 0
    for i, colab in enumerate(candidates):
        # Espera aleatória ANTES de cada envio (o primeiro também espera um pouco
        # pra dar tempo do request HTTP do admin já ter retornado).
        wait = random.uniform(d_min, d_max) if i > 0 else random.uniform(2, 5)
        await asyncio.sleep(wait)

        celular = (colab.get("celular") or "").strip()
        phone = _normalize_phone(celular)
        if not phone:
            continue

        # Personalização: prefixa "Olá, <PrimeiroNome>!\n\n" se ainda não houver
        primeiro = (colab.get("nome") or "").strip().split()[0].title() if colab.get("nome") else ""
        body = payload.mensagem.strip()
        if payload.personalizar and primeiro and not body.lower().startswith(("olá", "ola")):
            body = f"Olá, {primeiro}! 👋\n\n{body}"

        # Link com colaborador_id pra rastrear abertura imediata (?c=<id>)
        link = f"{base_link}?c={colab['id']}"
        text = f"{body}\n\n🔗 {link}"
        log_payload = {
            "telefone_normalizado": phone, "mensagem": text,
            "colaborador_id": colab["id"], "documento_id": None,
            "instance": DEFAULT_INSTANCE,
        }
        try:
            # "Digitando…" antes — mais natural, reduz flag de spam
            if payload.simular_digitacao:
                try:
                    await client.send_typing(group_id=phone, duration_ms=random.randint(1500, 3500))
                    await asyncio.sleep(random.uniform(1.5, 3.0))
                except Exception:
                    pass
            await client.send_text(group_id=phone, text=text)
            await _log_rh_whatsapp(log_payload, "sent", None, None)
            await _save_mural_envio(payload.mural_slug, colab["id"])
            sent_count += 1
            logger.info("mural_broadcast_progress",
                        mural=payload.mural_slug,
                        sent=sent_count, total=len(candidates),
                        colab=colab.get("nome"))
        except Exception as e:
            err = str(e)[:200]
            await _log_rh_whatsapp(log_payload, "failed", None, err)
            fail_count += 1
            logger.warning("mural_broadcast_send_failed",
                           colab=colab.get("nome"), error=err)

    logger.info("mural_broadcast_done",
                mural=payload.mural_slug,
                enviados=sent_count, falhas=fail_count,
                total_candidatos=len(candidates))


@router.post("/mural-broadcast")
async def mural_broadcast(payload: MuralBroadcastInput, background_tasks: BackgroundTasks):
    """Agenda envio gradual em background pra evitar bloqueio do WhatsApp.
    Retorna imediatamente com estimativa. Acompanhe progresso em /documentosPendentes."""
    if not payload.colaborador_ids:
        raise HTTPException(400, "colaborador_ids vazio")
    if not settings.SUPABASE_URL or not settings.SUPABASE_SERVICE_KEY:
        raise HTTPException(500, "Supabase não configurado")

    # Busca colaboradores selecionados
    async with httpx.AsyncClient(timeout=15.0) as c:
        ids_filter = ",".join(payload.colaborador_ids)
        r = await c.get(
            f"{settings.SUPABASE_URL}/rest/v1/colaboradores",
            headers={
                "apikey": settings.SUPABASE_SERVICE_KEY,
                "Authorization": f"Bearer {settings.SUPABASE_SERVICE_KEY}",
                "Accept-Profile": "rh",
            },
            params={
                "id": f"in.({ids_filter})",
                "select": "id,nome,celular",
            },
        )
        if r.status_code >= 400:
            raise HTTPException(502, f"Supabase: {r.status_code} {r.text[:200]}")
        colabs = r.json() or []

    com_celular = [c for c in colabs if (c.get("celular") or "").strip()]
    sem_celular = [c for c in colabs if not (c.get("celular") or "").strip()]

    # Estimativa de tempo total (média do delay × nº de mensagens)
    media = (max(2, payload.delay_min_s) + max(payload.delay_min_s, payload.delay_max_s)) / 2
    duracao_s = int(media * max(0, len(com_celular) - 1))
    duracao_min = max(1, round(duracao_s / 60))

    # Dispara em background — retorna imediatamente
    background_tasks.add_task(_run_broadcast_background, payload, colabs)

    return {
        "ok": True,
        "queued": True,
        "total_selecionados": len(payload.colaborador_ids),
        "encontrados": len(colabs),
        "com_celular": len(com_celular),
        "sem_celular_count": len(sem_celular),
        "estimativa_minutos": duracao_min,
        "delay_min_s": payload.delay_min_s,
        "delay_max_s": payload.delay_max_s,
        # Compat com frontend antigo: lista vazia (envios estão em andamento)
        "enviados": [],
        "sem_telefone": [{"id": c["id"], "nome": c.get("nome")} for c in sem_celular],
        "falhas": [],
    }
