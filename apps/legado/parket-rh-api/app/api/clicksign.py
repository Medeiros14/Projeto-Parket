"""RH — Integração Clicksign.

Endpoints:
  POST /api/rh/clicksign/enviar        — envia em massa (multi modelo × multi colab)
  POST /api/rh/clicksign/webhook       — recebe eventos do Clicksign
  GET  /api/rh/clicksign/envios        — lista emitidos via Clicksign + status
  GET  /api/rh/clicksign/envios/{id}/pdf-assinado
  GET  /api/rh/clicksign/healthcheck   — testa conexão

Fluxo de envio (por combinação modelo × colaborador):
  1. Renderiza HTML do modelo com {{nome}}/{{cpf}}/etc
  2. Gera PDF via WeasyPrint
  3. Cria registro em rh.documentos_emitidos (status=enviando_clicksign)
  4. Cria envelope no Clicksign + sobe PDF + adiciona signer (CPF+email+celular)
  5. Vincula requirements (agree + auth e-mail) ao signer
  6. Ativa envelope (status=running) → Clicksign dispara e-mail/WA pro colaborador
  7. Atualiza documentos_emitidos com clicksign_envelope_id + signer_url + status=aguardando_assinatura
"""
from __future__ import annotations

import asyncio
import base64
import json
import os
import re
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional

import httpx
from fastapi import APIRouter, Header, HTTPException, Query, Request
from fastapi.responses import Response
from jinja2 import Template
from pydantic import BaseModel
from weasyprint import HTML

from app.config import settings


router = APIRouter(prefix="/api/clicksign", tags=["rh-clicksign"])

SUPA_URL = settings.SUPABASE_URL
SUPA_KEY = settings.SUPABASE_SERVICE_KEY
BUCKET_SIGNED = "rh-clicksign-signed"

CLICKSIGN_TOKEN = os.getenv("CLICKSIGN_TOKEN", "2f3488f6-3ca9-46bd-88a9-fb9f1ec0dc30")
CLICKSIGN_API = "https://app.clicksign.com/api/v3"

# Cache em memória do mapa empresa_id → token Clicksign.
# Reload manual via GET /api/clicksign/recarregar-contas (ou TTL automático).
_TOKEN_CACHE: Dict[str, str] = {}
_TOKEN_CACHE_TS: float = 0.0
_TOKEN_CACHE_TTL = 60  # segundos

# Evolution API — WhatsApp do RH (+55 41 98580250)
EVOLUTION_URL = os.getenv("EVOLUTION_URL", "https://conect.parket.works")
EVOLUTION_KEY = os.getenv("EVOLUTION_KEY", "4eab105201410d6865b86dca76ee9fa3")
EVOLUTION_INSTANCE_RH = os.getenv("EVOLUTION_INSTANCE_RH", "Rh - Parket")
EVOLUTION_INSTANCE_DEFAULT = os.getenv("EVOLUTION_INSTANCE_DEFAULT", "Parket")
RH_WHATSAPP_GROUP_JID = os.getenv("RH_WHATSAPP_GROUP_JID", "120363405634674702@g.us")


# ============== SUPABASE HELPERS ==============

def _sb_headers(extra: Optional[Dict] = None, schema: Optional[str] = None) -> Dict:
    if not SUPA_URL or not SUPA_KEY:
        raise HTTPException(500, "Supabase não configurado")
    h = {
        "apikey": SUPA_KEY,
        "Authorization": f"Bearer {SUPA_KEY}",
        "Content-Type": "application/json",
    }
    if schema:
        h["Accept-Profile"] = schema
        h["Content-Profile"] = schema
    if extra:
        h.update(extra)
    return h


async def _sb_get(table: str, params: Dict, schema: str = "public") -> List[Dict]:
    async with httpx.AsyncClient(timeout=30) as c:
        r = await c.get(f"{SUPA_URL}/rest/v1/{table}", headers=_sb_headers(schema=schema), params=params)
    if r.status_code >= 400:
        raise HTTPException(r.status_code, f"Supabase GET {table}: {r.text[:400]}")
    return r.json() or []


async def _sb_insert(table: str, payload: Any, schema: str = "public") -> List[Dict]:
    async with httpx.AsyncClient(timeout=30) as c:
        r = await c.post(
            f"{SUPA_URL}/rest/v1/{table}",
            headers=_sb_headers({"Prefer": "return=representation"}, schema=schema),
            json=payload,
        )
    if r.status_code >= 400:
        raise HTTPException(r.status_code, f"Supabase INSERT {table}: {r.text[:400]}")
    return r.json() or []


async def _sb_patch(table: str, params: Dict, payload: Dict, schema: str = "public") -> List[Dict]:
    async with httpx.AsyncClient(timeout=30) as c:
        r = await c.patch(
            f"{SUPA_URL}/rest/v1/{table}",
            headers=_sb_headers({"Prefer": "return=representation"}, schema=schema),
            params=params, json=payload,
        )
    if r.status_code >= 400:
        raise HTTPException(r.status_code, f"Supabase PATCH {table}: {r.text[:400]}")
    return r.json() or []


async def _sb_storage_upload(bucket: str, path: str, content: bytes, content_type: str) -> str:
    async with httpx.AsyncClient(timeout=60) as c:
        r = await c.post(
            f"{SUPA_URL}/storage/v1/object/{bucket}/{path}",
            headers={"apikey": SUPA_KEY, "Authorization": f"Bearer {SUPA_KEY}", "Content-Type": content_type},
            content=content,
        )
    # ignora "already exists"
    if r.status_code >= 400 and "already exists" not in r.text.lower():
        raise HTTPException(r.status_code, f"Storage upload: {r.text[:200]}")
    return f"{bucket}/{path}"


# ============== UTILS ==============

def _clean_cpf(cpf: Optional[str]) -> str:
    return re.sub(r"\D", "", cpf or "")


def _fmt_cpf(cpf: str) -> str:
    n = _clean_cpf(cpf)
    if len(n) != 11:
        return cpf or ""
    return f"{n[:3]}.{n[3:6]}.{n[6:9]}-{n[9:]}"


def _clean_phone(phone: Optional[str]) -> str:
    n = re.sub(r"\D", "", phone or "")
    # Garantir DDI Brasil pra WhatsApp
    if n and not n.startswith("55") and len(n) in (10, 11):
        n = "55" + n
    return n


def _render_html(modelo_html: str, modelo_titulo: str, dados: Dict[str, Any]) -> str:
    tpl = Template(modelo_html)
    body = tpl.render(**dados)
    return f"""<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>{modelo_titulo}</title>
<style>
@page {{ size: A4; margin: 22mm 18mm 22mm 18mm; }}
body {{ font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; font-size: 10.5pt; color: #111; line-height: 1.55; }}
h1 {{ font-size: 14pt; text-transform: uppercase; letter-spacing: .05em; text-align: center; margin: 0 0 18pt 0; }}
h3 {{ font-size: 11pt; margin: 14pt 0 6pt 0; color: #222; }}
p {{ margin: 0 0 8pt 0; text-align: justify; }}
ol, ul {{ margin: 0 0 8pt 22pt; }}
li {{ margin-bottom: 5pt; text-align: justify; }}
table {{ width: 100%; border-collapse: collapse; margin-top: 14pt; }}
table td {{ padding: 8pt; vertical-align: top; }}
strong {{ color: #000; }}
</style></head><body>{body}</body></html>"""


def _html_to_pdf(html: str) -> bytes:
    return HTML(string=html).write_pdf()


async def _wa_send(phone_e164: str, message: str) -> Dict:
    """Envia WhatsApp via Evolution API (instância RH). phone_e164 sem '+', com DDI."""
    if not phone_e164 or len(phone_e164) < 12:
        return {"ok": False, "skip": True, "reason": "phone vazio/inválido"}
    instance = EVOLUTION_INSTANCE_RH
    url = f"{EVOLUTION_URL}/message/sendText/{instance}"
    payload = {"number": phone_e164, "text": message}
    try:
        async with httpx.AsyncClient(timeout=15) as c:
            r = await c.post(url, headers={"apikey": EVOLUTION_KEY, "Content-Type": "application/json"}, json=payload)
        if r.status_code >= 400:
            return {"ok": False, "status": r.status_code, "error": r.text[:200]}
        return {"ok": True, "status": r.status_code}
    except Exception as e:
        return {"ok": False, "error": str(e)[:200]}


async def _wa_send_rh_group(message: str) -> Dict:
    """Envia mensagem pro grupo 👥 Parket - RH via instância default."""
    url = f"{EVOLUTION_URL}/message/sendText/{EVOLUTION_INSTANCE_DEFAULT}"
    payload = {"number": RH_WHATSAPP_GROUP_JID, "text": message}
    try:
        async with httpx.AsyncClient(timeout=15) as c:
            r = await c.post(url, headers={"apikey": EVOLUTION_KEY, "Content-Type": "application/json"}, json=payload)
        return {"ok": r.status_code < 400, "status": r.status_code, "body": r.text[:200] if r.status_code >= 400 else None}
    except Exception as e:
        return {"ok": False, "error": str(e)[:200]}


async def _resolver_token_empresa(empresa_id: Optional[str]) -> str:
    """Retorna o token Clicksign cadastrado pra essa empresa (fallback: token default)."""
    global _TOKEN_CACHE, _TOKEN_CACHE_TS
    import time as _t
    if _t.time() - _TOKEN_CACHE_TS > _TOKEN_CACHE_TTL:
        try:
            contas = await _sb_get("clicksign_contas",
                {"select": "empresa_id,api_token", "ativo": "eq.true"}, schema="rh")
            _TOKEN_CACHE = {c["empresa_id"]: c["api_token"] for c in contas if c.get("empresa_id")}
            _TOKEN_CACHE_TS = _t.time()
        except Exception:
            pass
    if empresa_id and empresa_id in _TOKEN_CACHE:
        return _TOKEN_CACHE[empresa_id]
    return CLICKSIGN_TOKEN


async def _clicksign(method: str, path: str, json_body: Optional[Dict] = None,
                      token: Optional[str] = None) -> Dict:
    async with httpx.AsyncClient(timeout=60) as c:
        r = await c.request(
            method,
            f"{CLICKSIGN_API}{path}",
            headers={
                "Authorization": token or CLICKSIGN_TOKEN,
                "Content-Type": "application/vnd.api+json",
                "Accept": "application/vnd.api+json",
            },
            json=json_body,
        )
    if r.status_code >= 400:
        import json as _j, logging as _l
        try:
            _body = _j.dumps(json_body, ensure_ascii=False)[:1500] if json_body else "(no body)"
        except Exception:
            _body = "(unserializable)"
        _l.getLogger("clicksign").error(
            "Clicksign %s %s → HTTP %s | REQ: %s | RES: %s",
            method, path, r.status_code, _body, r.text[:2000]
        )
        raise HTTPException(502, f"Clicksign {method} {path}: HTTP {r.status_code} {r.text[:2000]}")
    if r.status_code == 204 or not r.content:
        return {}
    return r.json()


# ─────────────────────────────────────────────────────────────────────────
# TESTEMUNHA — padrão Talicia Camargo (RH). Clicksign v3 trata testemunha
# via `role="witness"` no requirement `agree`. O Clicksign só notifica a
# testemunha DEPOIS do signatário principal assinar (comportamento default
# do envelope quando há múltiplos roles).
# ─────────────────────────────────────────────────────────────────────────
TESTEMUNHA_PADRAO = {
    "nome": "TALICIA CAMARGO DA SILVA ARAUJO",
    "email": "rh.01@parket.com.br",
    "cpf": "42497392870",   # só dígitos
    "phone": "5511980133348",
}


async def _adicionar_testemunha_no_envelope(
    envelope_id: str,
    document_ids: List[str],
    token: str,
    testemunha: Optional[Dict] = None,
) -> Dict:
    """Cria 1 signer testemunha no envelope e gera os requirements
    (agree role=witness + provide_evidence auth=email) pra cada documento.
    Retorna dict com signer_id + dados pra gravar no documentos_emitidos."""
    t = testemunha or TESTEMUNHA_PADRAO
    nome = t.get("nome") or "Testemunha"
    email = t.get("email")
    cpf = _clean_cpf(t.get("cpf"))
    phone = _clean_phone(t.get("phone"))

    signer_attrs = {
        "name": nome,
        "email": email,
        "has_documentation": bool(cpf),
        "communicate_events": {
            "document_signed": "email",
            "signature_request": "email",
            "signature_reminder": "email",
        },
    }
    if cpf:
        signer_attrs["documentation"] = _fmt_cpf(cpf)
    if phone and len(phone) >= 12:
        signer_attrs["phone_number"] = phone

    signer_resp = await _clicksign("POST", f"/envelopes/{envelope_id}/signers", {
        "data": {"type": "signers", "attributes": signer_attrs}
    }, token=token)
    signer_id = signer_resp["data"]["id"]

    # Requirements pra cada documento do envelope
    for document_id in document_ids:
        # 1× agree role=witness
        await _clicksign("POST", f"/envelopes/{envelope_id}/requirements", {
            "data": {
                "type": "requirements",
                "attributes": {"action": "agree", "role": "witness"},
                "relationships": {
                    "document": {"data": {"type": "documents", "id": document_id}},
                    "signer": {"data": {"type": "signers", "id": signer_id}},
                }
            }
        }, token=token)
        # 1× provide_evidence auth=email (testemunha só precisa de email)
        try:
            await _clicksign("POST", f"/envelopes/{envelope_id}/requirements", {
                "data": {
                    "type": "requirements",
                    "attributes": {"action": "provide_evidence", "auth": "email"},
                    "relationships": {
                        "document": {"data": {"type": "documents", "id": document_id}},
                        "signer": {"data": {"type": "signers", "id": signer_id}},
                    }
                }
            }, token=token)
        except HTTPException:
            pass

    signer_url = f"https://app.clicksign.com/notarial/widget/signatures/{signer_id}/redirect"
    return {
        "signer_id": signer_id,
        "nome": nome,
        "email": email,
        "cpf": cpf,
        "signer_url": signer_url,
        "role": "witness",
    }


# ============== ENVIAR ==============

class EnviarBody(BaseModel):
    modelo_ids: List[str]
    colaborador_ids: List[str]
    campos_extras: Dict[str, Any] = {}
    auto_close: bool = True
    deadline_dias: int = 30
    remind_interval: int = 3  # dias entre lembretes
    enviar_whatsapp: bool = True  # também notifica via WhatsApp do RH
    mensagem_whatsapp: Optional[str] = None  # template, suporta {nome}/{titulo}/{link}
    # Métodos de autenticação que o signatário precisa cumprir.
    # Suporta: email, sms, whatsapp, selfie, handwritten, official_document, liveness, pix
    auth_methods: List[str] = ["email"]
    lote_titulo: Optional[str] = None  # título amigável do lote (mostrado na UI agrupada)
    # Se True, adiciona a Talicia (RH) como testemunha — recebe email depois que
    # o colaborador assina e referenda a assinatura como prova.
    incluir_testemunha: bool = True


@router.post("/enviar")
async def enviar(body: EnviarBody):
    if not body.modelo_ids:
        raise HTTPException(400, "modelo_ids vazio")
    if not body.colaborador_ids:
        raise HTTPException(400, "colaborador_ids vazio")

    # gera lote_id único pra todo o envio
    import uuid as _uuid
    lote_id = str(_uuid.uuid4())
    # título do lote: se não veio, gera baseado nos modelos + qtd colab
    lote_titulo = body.lote_titulo

    modelos = await _sb_get(
        "modelos_documento",
        {"id": f"in.({','.join(body.modelo_ids)})", "select": "*"},
        schema="rh",
    )
    if len(modelos) < len(set(body.modelo_ids)):
        raise HTTPException(404, "Algum modelo não foi encontrado")

    colabs = await _sb_get(
        "colaboradores",
        {"id": f"in.({','.join(body.colaborador_ids)})", "select": "*"},
        schema="rh",
    )
    if not colabs:
        raise HTTPException(404, "Nenhum colaborador encontrado")

    # gera título padrão se não veio
    if not lote_titulo:
        if len(modelos) == 1:
            lote_titulo = f"{modelos[0]['titulo']} ({len(colabs)} colab)"
        else:
            lote_titulo = f"{len(modelos)} documentos × {len(colabs)} colaboradores"

    resultados = []
    erros = []

    # NOVO: 1 envelope por colaborador com TODOS os modelos dentro.
    # Colaborador recebe 1 e-mail + 1 WA com 1 link só, assina tudo de uma vez.
    for colab in colabs:
        try:
            r = await _processar_envio_colab(
                modelos, colab, body.campos_extras, body.auto_close,
                body.deadline_dias, body.remind_interval,
                body.enviar_whatsapp, body.mensagem_whatsapp,
                body.auth_methods, lote_id, lote_titulo,
                incluir_testemunha=body.incluir_testemunha,
            )
            resultados.append(r)
        except HTTPException as e:
            erros.append({
                "colaborador_id": colab["id"],
                "colaborador_nome": colab.get("nome"),
                "modelo_ids": [m["id"] for m in modelos],
                "erro": e.detail if isinstance(e.detail, str) else str(e.detail),
            })
        except Exception as e:
            erros.append({
                "colaborador_id": colab["id"],
                "colaborador_nome": colab.get("nome"),
                "modelo_ids": [m["id"] for m in modelos],
                "erro": str(e)[:300],
            })

    return {
        "ok": True,
        "lote_id": lote_id,
        "lote_titulo": lote_titulo,
        "total_enviados": len(resultados),
        "total_erros": len(erros),
        "resultados": resultados,
        "erros": erros,
    }


async def _resolver_dados_colab(colab: Dict, campos_extras: Dict) -> Dict:
    """Resolve empresa real + cargo do colaborador via contrato ativo."""
    empresa_nome = campos_extras.get("empresa") or ""
    empresa_cnpj = campos_extras.get("cnpj") or ""
    empresa_endereco = campos_extras.get("empresa_endereco") or ""
    cargo_real = colab.get("cargo") or campos_extras.get("cargo") or ""
    try:
        contratos = await _sb_get(
            "contratos",
            {
                "colaborador_id": f"eq.{colab['id']}",
                "deleted_at": "is.null",
                "select": "empresa_id,cargo_id,salario_base,status,data_admissao",
                "order": "data_admissao.desc",
                "limit": "1",
            },
            schema="rh",
        )
        if contratos:
            contr = contratos[0]
            cid = contr.get("cargo_id")
            if cid and not cargo_real:
                cargos = await _sb_get("cargos", {"id": f"eq.{cid}", "select": "nome"}, schema="rh")
                if cargos:
                    cargo_real = cargos[0].get("nome") or cargo_real
            emp_id = contr.get("empresa_id")
            if emp_id and (not empresa_nome or not empresa_cnpj):
                emps = await _sb_get("empresas",
                    {"id": f"eq.{emp_id}", "select": "razao_social,nome_fantasia,cnpj,endereco,cidade,uf,cep"},
                    schema="core")
                if emps:
                    e = emps[0]
                    if not empresa_nome:
                        empresa_nome = e.get("razao_social") or e.get("nome_fantasia") or ""
                    if not empresa_cnpj:
                        empresa_cnpj = e.get("cnpj") or ""
                    if not empresa_endereco:
                        partes = [e.get("endereco"), e.get("cidade"), e.get("uf"), e.get("cep")]
                        empresa_endereco = ", ".join([p for p in partes if p])
    except Exception:
        pass

    dados = {
        "nome": colab.get("nome") or "",
        "cpf": _fmt_cpf(_clean_cpf(colab.get("cpf"))),
        "empresa": empresa_nome or "PKT | Parket",
        "cnpj": empresa_cnpj or "22.951.220/0001-33",
        "empresa_endereco": empresa_endereco,
        "cargo": cargo_real,
        "cidade": campos_extras.get("cidade") or "São Paulo",
        "data": campos_extras.get("data") or datetime.now().strftime("%d/%m/%Y"),
    }
    dados.update({k: v for k, v in campos_extras.items() if k not in dados})
    return dados


async def _processar_envio_colab(
    modelos: List[Dict], colab: Dict, campos_extras: Dict,
    auto_close: bool, deadline_dias: int, remind_interval: int,
    enviar_whatsapp: bool = True,
    mensagem_whatsapp: Optional[str] = None,
    auth_methods: Optional[List[str]] = None,
    lote_id: Optional[str] = None,
    lote_titulo: Optional[str] = None,
    incluir_testemunha: bool = True,
) -> Dict:
    """Cria 1 envelope Clicksign por colaborador com TODOS os modelos como documentos.
    Colaborador recebe 1 email/WA com 1 link só que cobre todas as assinaturas."""
    auth_methods = auth_methods or ["email"]
    if not modelos:
        raise HTTPException(400, "Sem modelos pra enviar")

    cpf = _clean_cpf(colab.get("cpf"))
    if len(cpf) != 11:
        raise HTTPException(400, f"CPF inválido para {colab.get('nome')}: '{colab.get('cpf')}'")
    email = colab.get("email_pessoal") or colab.get("email_profissional")
    if not email:
        raise HTTPException(400, f"{colab.get('nome')} sem email cadastrado")
    phone = _clean_phone(colab.get("celular"))

    # Resolve dados do colaborador uma vez (compartilhado entre todos os modelos)
    dados = await _resolver_dados_colab(colab, campos_extras)

    # Resolve empresa_id do contrato pra escolher o token Clicksign certo
    empresa_id_colab: Optional[str] = None
    try:
        contrs = await _sb_get("contratos", {
            "colaborador_id": f"eq.{colab['id']}", "deleted_at": "is.null",
            "select": "empresa_id", "order": "data_admissao.desc", "limit": "1",
        }, schema="rh")
        if contrs:
            empresa_id_colab = contrs[0].get("empresa_id")
    except Exception:
        pass
    token = await _resolver_token_empresa(empresa_id_colab)

    # 1. Criar envelope com nome resumido (Nome - X documentos)
    primeiro = colab["nome"].split()[0].title()
    if len(modelos) == 1:
        env_name = f"{modelos[0]['titulo']} — {colab['nome']}"[:200]
    else:
        env_name = f"Documentos RH ({len(modelos)}) — {colab['nome']}"[:200]
    deadline_dt = (datetime.now(timezone.utc) + timedelta(days=deadline_dias)).replace(microsecond=0)
    env_resp = await _clicksign("POST", "/envelopes", {
        "data": {"type": "envelopes", "attributes": {
            "name": env_name,
            "locale": "pt-BR",
            "auto_close": auto_close,
            "remind_interval": remind_interval,
            "block_after_refusal": True,
            "deadline_at": deadline_dt.isoformat().replace("+00:00", "Z"),
            "default_subject": (f"Assinatura: {modelos[0]['titulo']}" if len(modelos) == 1
                                else f"Documentos para sua assinatura ({len(modelos)})"),
        }}
    }, token=token)
    envelope_id = env_resp["data"]["id"]

    # 2. Criar signer (1 só pro envelope inteiro)
    comm_channel = "whatsapp" if "whatsapp" in auth_methods else ("sms" if "sms" in auth_methods else "email")
    signer_attrs = {
        "name": colab["nome"],
        "email": email,
        "has_documentation": True,
        "documentation": _fmt_cpf(cpf),
        "communicate_events": {
            "document_signed": comm_channel,
            "signature_request": comm_channel,
            "signature_reminder": comm_channel,
        },
    }
    if phone and len(phone) >= 12:
        signer_attrs["phone_number"] = phone
    if colab.get("data_nascimento"):
        signer_attrs["birthday"] = colab["data_nascimento"]
    signer_resp = await _clicksign("POST", f"/envelopes/{envelope_id}/signers", {
        "data": {"type": "signers", "attributes": signer_attrs}
    }, token=token)
    signer_id = signer_resp["data"]["id"]

    # API v3: TODOS os métodos auth (token, imagem, certificado) são requirements
    # do tipo provide_evidence com a string auth=<método>. Não existem flags
    # como "selfie_enabled" no signer — isso era erro nosso anterior.
    ALL_AUTH = ("email", "sms", "whatsapp", "pix", "icp_brasil",
                "handwritten", "selfie", "official_document", "liveness",
                "facial_biometrics", "biometric", "address_proof", "documentscopy")
    auth_evidencia = [m for m in auth_methods if m in ALL_AUTH]
    if not auth_evidencia:
        auth_evidencia = ["email"]

    # 3. Pra cada modelo: render HTML → PDF → upload doc → requirements → grava documento_emitido
    docs_criados = []
    now_iso = datetime.now(timezone.utc).isoformat()
    for modelo in modelos:
        html = _render_html(modelo["conteudo_html"], modelo["titulo"], dados)
        pdf_bytes = _html_to_pdf(html)

        # Insere documento_emitido
        titulo_doc = f"{modelo['titulo']} — {colab['nome']}"[:255]
        doc_payload = {
            "modelo_id": modelo["id"],
            "colaborador_id": colab["id"],
            "titulo": titulo_doc,
            "status": "enviando_clicksign",
            "canal_assinatura": "clicksign",
            "conteudo_html": modelo["conteudo_html"],
            "campos_valores": dados,
            "nome_informado": colab["nome"],
            "cpf_informado": cpf,
            "auth_methods": auth_methods,
            "lote_id": lote_id,
            "lote_titulo": lote_titulo,
        }
        rows = await _sb_insert("documentos_emitidos", doc_payload, schema="rh")
        doc_id = rows[0]["id"]

        # Upload PDF
        pdf_b64 = base64.b64encode(pdf_bytes).decode("ascii")
        safe_name = re.sub(r"[^A-Za-z0-9_\-]", "_", modelo["titulo"])[:50] or "documento"
        doc_resp = await _clicksign("POST", f"/envelopes/{envelope_id}/documents", {
            "data": {
                "type": "documents",
                "attributes": {
                    "filename": f"{safe_name}.pdf",
                    "content_base64": f"data:application/pdf;base64,{pdf_b64}",
                }
            }
        }, token=token)
        document_id = doc_resp["data"]["id"]

        # Requirements pro documento: 1 agree + 1 provide_evidence por método
        await _clicksign("POST", f"/envelopes/{envelope_id}/requirements", {
            "data": {
                "type": "requirements",
                "attributes": {"action": "agree", "role": "sign"},
                "relationships": {
                    "document": {"data": {"type": "documents", "id": document_id}},
                    "signer": {"data": {"type": "signers", "id": signer_id}},
                }
            }
        }, token=token)
        for m in auth_evidencia:
            try:
                await _clicksign("POST", f"/envelopes/{envelope_id}/requirements", {
                    "data": {
                        "type": "requirements",
                        "attributes": {"action": "provide_evidence", "auth": m},
                        "relationships": {
                            "document": {"data": {"type": "documents", "id": document_id}},
                            "signer": {"data": {"type": "signers", "id": signer_id}},
                        }
                    }
                }, token=token)
            except HTTPException:
                # Se um método auth não está habilitado na conta (ex: facial_biometrics
                # sem plano premium), Clicksign retorna 400. Pulamos e seguimos com os demais
                # — assinatura ainda vai funcionar com os métodos que passaram.
                continue

        # Atualiza com IDs Clicksign (mesmo envelope, document e signer pra cada doc do colab)
        await _sb_patch("documentos_emitidos", {"id": f"eq.{doc_id}"}, {
            "status": "aguardando_assinatura",
            "clicksign_envelope_id": envelope_id,
            "clicksign_document_id": document_id,
            "clicksign_signer_id": signer_id,
            "clicksign_status": "running",
            "clicksign_enviado_em": now_iso,
            "enviado_em": now_iso,
        }, schema="rh")
        docs_criados.append({
            "documento_emitido_id": doc_id,
            "document_id": document_id,
            "modelo_id": modelo["id"],
            "modelo_titulo": modelo["titulo"],
        })

    # 4. Testemunha (antes de ativar — assim o envelope já entra running com tudo)
    testemunha_info = None
    if incluir_testemunha:
        try:
            doc_ids_clicksign = [d["document_id"] for d in docs_criados]
            testemunha_info = await _adicionar_testemunha_no_envelope(
                envelope_id, doc_ids_clicksign, token=token,
            )
            # Grava testemunha em todos os documentos_emitidos do envelope
            payload_test = [{
                "signer_id": testemunha_info["signer_id"],
                "nome": testemunha_info["nome"],
                "email": testemunha_info["email"],
                "cpf": testemunha_info["cpf"],
                "role": "witness",
            }]
            for d in docs_criados:
                await _sb_patch("documentos_emitidos", {"id": f"eq.{d['documento_emitido_id']}"},
                                 {"testemunhas": payload_test}, schema="rh")
        except Exception as e:
            # Não bloqueia o envio se testemunha falhar — só loga
            print(f"[clicksign] testemunha falhou env={envelope_id}: {e}")

    # 5. Ativar envelope
    await _clicksign("PATCH", f"/envelopes/{envelope_id}", {
        "data": {"type": "envelopes", "id": envelope_id,
                 "attributes": {"status": "running"}}
    }, token=token)

    # 6. URL de assinatura (única pro signer, cobre todos os docs do envelope)
    signer_url = f"https://app.clicksign.com/notarial/widget/signatures/{signer_id}/redirect"
    try:
        sd = await _clicksign("GET", f"/envelopes/{envelope_id}/signers/{signer_id}", token=token)
        api_url = sd.get("data", {}).get("attributes", {}).get("sign_url", "") or ""
        if api_url:
            signer_url = api_url
    except Exception:
        pass

    # Salva signer_url em todos os docs do envelope
    for d in docs_criados:
        await _sb_patch("documentos_emitidos", {"id": f"eq.{d['documento_emitido_id']}"},
                         {"clicksign_signer_url": signer_url}, schema="rh")

    # 6. Notificação Clicksign (email)
    if len(modelos) == 1:
        msg_email = f"Olá {primeiro}, segue documento para sua assinatura."
    else:
        msg_email = f"Olá {primeiro}, seguem {len(modelos)} documentos para sua assinatura."
    try:
        await _clicksign("POST", f"/envelopes/{envelope_id}/notifications", {
            "data": {"type": "notifications", "attributes": {"message": msg_email}}
        }, token=token)
    except Exception:
        pass

    # 7. WhatsApp único pelo número RH (1 link, lista de docs)
    wa_result = None
    if enviar_whatsapp and phone and len(phone) >= 12:
        # Resolve a empresa do colab via contrato ativo (fallback: "Parket")
        empresa_nome = "Parket"
        try:
            contratos_ativos = await _sb_get(
                "contratos",
                {"colaborador_id": f"eq.{colab['id']}", "status": "eq.ativo",
                 "select": "empresa_id", "limit": "1"},
                schema="rh",
            )
            if contratos_ativos and contratos_ativos[0].get("empresa_id"):
                emp_rows = await _sb_get(
                    "empresas",
                    {"id": f"eq.{contratos_ativos[0]['empresa_id']}", "select": "razao_social"},
                    schema="rh",
                )
                if emp_rows and emp_rows[0].get("razao_social"):
                    empresa_nome = emp_rows[0]["razao_social"]
        except Exception:
            pass

        # Filtrar NRs da LISTA (mas mantém na CONTAGEM): NRs vão no envelope
        # mas o nome delas não aparece no WhatsApp por pedido do RH.
        def _eh_nr(t: str) -> bool:
            t = (t or "").strip().upper()
            return t.startswith("NR ") or t.startswith("NR-") or t.startswith("NR0") \
                or any(t.startswith(f"NR{n}") or t.startswith(f"NR-{n}") for n in range(1, 40))
        modelos_visiveis = [m for m in modelos if not _eh_nr(m['titulo'])]
        total = len(modelos)
        if total == 1:
            corpo = f"o documento *{modelos[0]['titulo']}*"
        else:
            if modelos_visiveis:
                lista = "\n".join(f"  • {m['titulo']}" for m in modelos_visiveis)
                corpo = f"*{total} documentos* para sua assinatura:\n{lista}"
            else:
                corpo = f"*{total} documentos* para sua assinatura"
        if mensagem_whatsapp:
            msg = (mensagem_whatsapp
                   .replace("{nome}", primeiro)
                   .replace("{empresa}", empresa_nome)
                   .replace("{titulo}", corpo)
                   .replace("{link}", signer_url or ""))
        else:
            msg = (f"Olá {primeiro}, aqui é da {empresa_nome}.\n\n"
                   f"Enviamos {corpo}\n\n"
                   f"Você pode assinar pelo seu e-mail ({email}) ou diretamente neste link:\n"
                   f"{signer_url}\n\n"
                   f"Qualquer dúvida, responda esta mensagem.\n"
                   f"Obrigado!")
        wa_result = await _wa_send(phone, msg)

    return {
        "envelope_id": envelope_id,
        "signer_id": signer_id,
        "colaborador_id": colab["id"],
        "colaborador_nome": colab["nome"],
        "documentos": docs_criados,
        "total_documentos": len(docs_criados),
        "signer_url": signer_url,
        "whatsapp": wa_result,
        "testemunha": testemunha_info,
    }


# ─── função antiga mantida pra compat se chamada de outro lugar ───
async def _processar_envio(
    modelo: Dict, colab: Dict, campos_extras: Dict,
    auto_close: bool, deadline_dias: int, remind_interval: int,
    enviar_whatsapp: bool = True,
    mensagem_whatsapp: Optional[str] = None,
    auth_methods: Optional[List[str]] = None,
    lote_id: Optional[str] = None,
    lote_titulo: Optional[str] = None,
) -> Dict:
    """Wrapper retrocompat: 1 modelo → chama _processar_envio_colab com lista de 1."""
    r = await _processar_envio_colab(
        [modelo], colab, campos_extras, auto_close, deadline_dias, remind_interval,
        enviar_whatsapp, mensagem_whatsapp, auth_methods, lote_id, lote_titulo,
    )
    # Achata pra formato antigo (pega 1º documento)
    d0 = r["documentos"][0] if r["documentos"] else {}
    return {
        "documento_emitido_id": d0.get("documento_emitido_id"),
        "envelope_id": r["envelope_id"],
        "signer_id": r["signer_id"],
        "colaborador_id": r["colaborador_id"],
        "colaborador_nome": r["colaborador_nome"],
        "modelo_id": d0.get("modelo_id"),
        "modelo_titulo": d0.get("modelo_titulo"),
        "signer_url": r["signer_url"],
        "whatsapp": r["whatsapp"],
    }


# === LEGADO REMOVIDO — _processar_envio_legacy abaixo está comentado ===
async def _processar_envio_legacy(
    modelo: Dict, colab: Dict, campos_extras: Dict,
    auto_close: bool, deadline_dias: int, remind_interval: int,
    enviar_whatsapp: bool = True,
    mensagem_whatsapp: Optional[str] = None,
    auth_methods: Optional[List[str]] = None,
    lote_id: Optional[str] = None,
    lote_titulo: Optional[str] = None,
) -> Dict:
    auth_methods = auth_methods or ["email"]
    cpf = _clean_cpf(colab.get("cpf"))
    if len(cpf) != 11:
        raise HTTPException(400, f"CPF inválido para {colab.get('nome')}: '{colab.get('cpf')}'")
    email = colab.get("email_pessoal") or colab.get("email_profissional")
    if not email:
        raise HTTPException(400, f"{colab.get('nome')} sem email cadastrado")
    phone = _clean_phone(colab.get("celular"))

    # 1. Buscar empresa REAL do colaborador (contrato ativo → empresa)
    empresa_nome = campos_extras.get("empresa") or ""
    empresa_cnpj = campos_extras.get("cnpj") or ""
    empresa_endereco = campos_extras.get("empresa_endereco") or ""
    cargo_real = colab.get("cargo") or campos_extras.get("cargo") or ""
    try:
        contratos = await _sb_get(
            "contratos",
            {
                "colaborador_id": f"eq.{colab['id']}",
                "deleted_at": "is.null",
                "select": "empresa_id,cargo_id,salario_base,status,data_admissao",
                "order": "data_admissao.desc",
                "limit": "1",
            },
            schema="rh",
        )
        if contratos:
            contr = contratos[0]
            # cargo: JOIN com rh.cargos
            cid = contr.get("cargo_id")
            if cid and not cargo_real:
                cargos = await _sb_get(
                    "cargos", {"id": f"eq.{cid}", "select": "nome"}, schema="rh",
                )
                if cargos:
                    cargo_real = cargos[0].get("nome") or cargo_real
            emp_id = contr.get("empresa_id")
            if emp_id and (not empresa_nome or not empresa_cnpj):
                emps = await _sb_get(
                    "empresas",
                    {"id": f"eq.{emp_id}",
                     "select": "razao_social,nome_fantasia,cnpj,endereco,cidade,uf,cep"},
                    schema="core",
                )
                if emps:
                    e = emps[0]
                    if not empresa_nome:
                        empresa_nome = e.get("razao_social") or e.get("nome_fantasia") or ""
                    if not empresa_cnpj:
                        empresa_cnpj = e.get("cnpj") or ""
                    if not empresa_endereco:
                        partes = [e.get("endereco"), e.get("cidade"), e.get("uf"), e.get("cep")]
                        empresa_endereco = ", ".join([p for p in partes if p])
    except Exception:
        pass

    dados = {
        "nome": colab.get("nome") or "",
        "cpf": _fmt_cpf(cpf),
        "empresa": empresa_nome or "PKT | Parket",
        "cnpj": empresa_cnpj or "22.951.220/0001-33",
        "empresa_endereco": empresa_endereco,
        "cargo": cargo_real,
        "cidade": campos_extras.get("cidade") or "São Paulo",
        "data": campos_extras.get("data") or datetime.now().strftime("%d/%m/%Y"),
    }
    dados.update({k: v for k, v in campos_extras.items() if k not in dados})

    html = _render_html(modelo["conteudo_html"], modelo["titulo"], dados)
    pdf_bytes = _html_to_pdf(html)

    # 2. Insere documento_emitido (status=enviando_clicksign)
    titulo_doc = f"{modelo['titulo']} — {colab['nome']}"[:255]
    doc_payload = {
        "modelo_id": modelo["id"],
        "colaborador_id": colab["id"],
        "titulo": titulo_doc,
        "status": "enviando_clicksign",
        "canal_assinatura": "clicksign",
        "conteudo_html": modelo["conteudo_html"],
        "campos_valores": dados,
        "nome_informado": colab["nome"],
        "cpf_informado": cpf,
        "auth_methods": auth_methods,
        "lote_id": lote_id,
        "lote_titulo": lote_titulo,
    }
    rows = await _sb_insert("documentos_emitidos", doc_payload, schema="rh")
    doc_id = rows[0]["id"]

    # 3. Criar envelope
    deadline_dt = (datetime.now(timezone.utc) + timedelta(days=deadline_dias)).replace(microsecond=0)
    env_attrs = {
        "name": titulo_doc[:200],
        "locale": "pt-BR",
        "auto_close": auto_close,
        "remind_interval": remind_interval,
        "block_after_refusal": True,
        "deadline_at": deadline_dt.isoformat().replace("+00:00", "Z"),
        "default_subject": f"Assinatura: {modelo['titulo']}",
    }
    env_resp = await _clicksign("POST", "/envelopes", {
        "data": {"type": "envelopes", "attributes": env_attrs}
    })
    envelope_id = env_resp["data"]["id"]

    # 4. Upload do PDF
    pdf_b64 = base64.b64encode(pdf_bytes).decode("ascii")
    safe_name = re.sub(r"[^A-Za-z0-9_\-]", "_", modelo["titulo"])[:50] or "documento"
    doc_resp = await _clicksign("POST", f"/envelopes/{envelope_id}/documents", {
        "data": {
            "type": "documents",
            "attributes": {
                "filename": f"{safe_name}.pdf",
                "content_base64": f"data:application/pdf;base64,{pdf_b64}",
            }
        }
    })
    document_id = doc_resp["data"]["id"]

    # 5. Signer — habilita flags conforme auth_methods escolhidos
    comm_channel = "whatsapp" if "whatsapp" in auth_methods else ("sms" if "sms" in auth_methods else "email")
    signer_attrs = {
        "name": colab["nome"],
        "email": email,
        "has_documentation": True,
        "documentation": _fmt_cpf(cpf),
        "communicate_events": {
            "document_signed": comm_channel,
            "signature_request": comm_channel,
            "signature_reminder": comm_channel,
        },
    }
    # Adiciona flags premium SOMENTE se selecionados (a conta pode não ter o plano e a API rejeita)
    if "selfie" in auth_methods:
        signer_attrs["selfie_enabled"] = True
    if "handwritten" in auth_methods:
        signer_attrs["handwritten_enabled"] = True
    if "official_document" in auth_methods:
        signer_attrs["official_document_enabled"] = True
    if "liveness" in auth_methods:
        signer_attrs["liveness_enabled"] = True
    if "facial_biometrics" in auth_methods:
        signer_attrs["facial_biometrics_enabled"] = True
    if phone and len(phone) >= 12:
        signer_attrs["phone_number"] = phone
    if colab.get("data_nascimento"):
        signer_attrs["birthday"] = colab["data_nascimento"]
    signer_resp = await _clicksign("POST", f"/envelopes/{envelope_id}/signers", {
        "data": {"type": "signers", "attributes": signer_attrs}
    })
    signer_id = signer_resp["data"]["id"]

    # 6. Requirements:
    #   - 1× agree (concordância textual)
    #   - 1× provide_evidence por método auth real (email/sms/whatsapp/pix/icp_brasil)
    auth_evidencia = [m for m in auth_methods if m in ("email", "sms", "whatsapp", "pix", "icp_brasil")]
    if not auth_evidencia:
        auth_evidencia = ["email"]
    await _clicksign("POST", f"/envelopes/{envelope_id}/requirements", {
        "data": {
            "type": "requirements",
            "attributes": {"action": "agree", "role": "sign"},
            "relationships": {
                "document": {"data": {"type": "documents", "id": document_id}},
                "signer": {"data": {"type": "signers", "id": signer_id}},
            }
        }
    })
    for m in auth_evidencia:
        await _clicksign("POST", f"/envelopes/{envelope_id}/requirements", {
            "data": {
                "type": "requirements",
                "attributes": {"action": "provide_evidence", "auth": m},
                "relationships": {
                    "document": {"data": {"type": "documents", "id": document_id}},
                    "signer": {"data": {"type": "signers", "id": signer_id}},
                }
            }
        })

    # 7. Ativar envelope
    await _clicksign("PATCH", f"/envelopes/{envelope_id}", {
        "data": {"type": "envelopes", "id": envelope_id,
                 "attributes": {"status": "running"}}
    })

    # 8. Disparar notificação (Clicksign não envia email automaticamente após running)
    msg = (campos_extras.get("mensagem_assinatura") or
           f"Olá {colab['nome'].split()[0]}, segue documento para sua assinatura.")
    try:
        await _clicksign("POST", f"/envelopes/{envelope_id}/notifications", {
            "data": {"type": "notifications", "attributes": {"message": msg}}
        })
    except Exception:
        pass  # não falha o envio se notificação falhar

    # 9. URL de assinatura do signer. Clicksign v3 nem sempre retorna sign_url no GET
    # signer, mas o link funcional é sempre o widget URL canônico.
    signer_url = f"https://app.clicksign.com/notarial/widget/signatures/{signer_id}/redirect"
    try:
        sd = await _clicksign("GET", f"/envelopes/{envelope_id}/signers/{signer_id}")
        api_url = sd.get("data", {}).get("attributes", {}).get("sign_url", "") or ""
        if api_url:
            signer_url = api_url
    except Exception:
        pass

    # 9. Atualiza registro
    now_iso = datetime.now(timezone.utc).isoformat()
    await _sb_patch("documentos_emitidos", {"id": f"eq.{doc_id}"}, {
        "status": "aguardando_assinatura",
        "clicksign_envelope_id": envelope_id,
        "clicksign_document_id": document_id,
        "clicksign_signer_id": signer_id,
        "clicksign_status": "running",
        "clicksign_signer_url": signer_url,
        "clicksign_enviado_em": now_iso,
        "enviado_em": now_iso,
    }, schema="rh")

    # 10. WhatsApp via Evolution (instância Rh - Parket)
    wa_result = None
    if enviar_whatsapp and phone and len(phone) >= 12:
        primeiro = colab["nome"].split()[0].title()
        link_txt = f"\n\nLink direto: {signer_url}" if signer_url else ""
        if mensagem_whatsapp:
            msg = (mensagem_whatsapp
                   .replace("{nome}", primeiro)
                   .replace("{titulo}", modelo["titulo"])
                   .replace("{link}", signer_url or ""))
        else:
            msg = (f"Olá {primeiro}, tudo bem? Aqui é da Parket. \n\n"
                   f"Enviamos o *{modelo['titulo']}* para sua assinatura. \n\n"
                   f"Você pode assinar pelo seu e-mail ({email}) ou diretamente neste link:\n"
                   f"{signer_url}\n\n"
                   f"Qualquer dúvida, responda esta mensagem. \n"
                   f"Obrigado!")
        wa_result = await _wa_send(phone, msg)

    return {
        "documento_emitido_id": doc_id,
        "envelope_id": envelope_id,
        "signer_id": signer_id,
        "colaborador_id": colab["id"],
        "colaborador_nome": colab["nome"],
        "modelo_id": modelo["id"],
        "modelo_titulo": modelo["titulo"],
        "signer_url": signer_url,
        "whatsapp": wa_result,
    }


# ============== ENVIAR PDF AVULSO (sem template) ==============
# Pra docs externos que vêm prontos do sistema de folha (TRCT, Ficha Registro,
# Holerites, Termos avulsos): RH faz upload do PDF e manda direto pra assinar.

from fastapi import UploadFile, File, Form


@router.post("/enviar-pdf")
async def enviar_pdf(
    pdf: UploadFile = File(...),
    colaborador_id: str = Form(...),
    titulo: Optional[str] = Form(None),
    auth_methods: str = Form("email"),  # csv: "email,selfie,handwritten"
    enviar_whatsapp: bool = Form(True),
    deadline_dias: int = Form(30),
    mensagem_whatsapp: Optional[str] = Form(None),
    incluir_testemunha: bool = Form(True),
):
    """Cria 1 envelope no Clicksign com 1 PDF avulso (upload direto, sem template HTML)."""
    if not pdf.content_type or "pdf" not in pdf.content_type.lower():
        raise HTTPException(400, "Arquivo precisa ser PDF")
    pdf_bytes = await pdf.read()
    if len(pdf_bytes) > 50 * 1024 * 1024:
        raise HTTPException(400, "PDF excede 50MB")

    colabs = await _sb_get("colaboradores",
        {"id": f"eq.{colaborador_id}", "select": "*"}, schema="rh")
    if not colabs:
        raise HTTPException(404, "Colaborador não encontrado")
    colab = colabs[0]

    cpf = _clean_cpf(colab.get("cpf"))
    if len(cpf) != 11:
        raise HTTPException(400, f"CPF inválido pra {colab.get('nome')}")
    email = colab.get("email_pessoal") or colab.get("email_profissional")
    if not email:
        raise HTTPException(400, f"{colab.get('nome')} sem email")
    phone = _clean_phone(colab.get("celular"))

    auth_list = [a.strip() for a in auth_methods.split(",") if a.strip()] or ["email"]
    nome_doc = titulo or (pdf.filename or "Documento").replace(".pdf", "").replace(".PDF", "")
    primeiro = colab["nome"].split()[0].title()

    # 1. Criar envelope
    deadline_dt = (datetime.now(timezone.utc) + timedelta(days=deadline_dias)).replace(microsecond=0)
    env_resp = await _clicksign("POST", "/envelopes", {
        "data": {"type": "envelopes", "attributes": {
            "name": f"{nome_doc} — {colab['nome']}"[:200],
            "locale": "pt-BR",
            "auto_close": True,
            "remind_interval": 3,
            "block_after_refusal": True,
            "deadline_at": deadline_dt.isoformat().replace("+00:00", "Z"),
        }}
    })
    envelope_id = env_resp["data"]["id"]

    # 2. Upload do PDF
    pdf_b64 = base64.b64encode(pdf_bytes).decode("ascii")
    safe_name = re.sub(r"[^A-Za-z0-9_\-]", "_", nome_doc)[:60] or "documento"
    doc_resp = await _clicksign("POST", f"/envelopes/{envelope_id}/documents", {
        "data": {"type": "documents", "attributes": {
            "filename": f"{safe_name}.pdf",
            "content_base64": f"data:application/pdf;base64,{pdf_b64}",
        }}
    })
    document_id = doc_resp["data"]["id"]

    # 3. Signer
    comm_channel = "whatsapp" if "whatsapp" in auth_list else ("sms" if "sms" in auth_list else "email")
    signer_attrs = {
        "name": colab["nome"], "email": email,
        "has_documentation": True, "documentation": _fmt_cpf(cpf),
        "communicate_events": {
            "document_signed": comm_channel,
            "signature_request": comm_channel,
            "signature_reminder": comm_channel,
        },
    }
    if phone and len(phone) >= 12:
        signer_attrs["phone_number"] = phone
    if colab.get("data_nascimento"):
        signer_attrs["birthday"] = colab["data_nascimento"]
    signer_resp = await _clicksign("POST", f"/envelopes/{envelope_id}/signers", {
        "data": {"type": "signers", "attributes": signer_attrs}
    })
    signer_id = signer_resp["data"]["id"]

    # 4. Requirements
    await _clicksign("POST", f"/envelopes/{envelope_id}/requirements", {
        "data": {"type": "requirements",
                 "attributes": {"action": "agree", "role": "sign"},
                 "relationships": {
                     "document": {"data": {"type": "documents", "id": document_id}},
                     "signer": {"data": {"type": "signers", "id": signer_id}},
                 }}
    })
    for m in auth_list:
        try:
            await _clicksign("POST", f"/envelopes/{envelope_id}/requirements", {
                "data": {"type": "requirements",
                         "attributes": {"action": "provide_evidence", "auth": m},
                         "relationships": {
                             "document": {"data": {"type": "documents", "id": document_id}},
                             "signer": {"data": {"type": "signers", "id": signer_id}},
                         }}
            })
        except HTTPException:
            continue

    # 5. Testemunha (antes de ativar)
    testemunha_info = None
    if incluir_testemunha:
        try:
            testemunha_info = await _adicionar_testemunha_no_envelope(
                envelope_id, [document_id], token=CLICKSIGN_TOKEN,
            )
        except Exception as e:
            print(f"[clicksign] testemunha falhou (PDF avulso) env={envelope_id}: {e}")

    # 6. Insere documento_emitido
    import uuid as _uuid
    lote_id = str(_uuid.uuid4())
    now_iso = datetime.now(timezone.utc).isoformat()
    testemunhas_payload = ([{
        "signer_id": testemunha_info["signer_id"],
        "nome": testemunha_info["nome"],
        "email": testemunha_info["email"],
        "cpf": testemunha_info["cpf"],
        "role": "witness",
    }] if testemunha_info else None)
    doc_payload = {
        "colaborador_id": colab["id"],
        "titulo": f"{nome_doc} — {colab['nome']}"[:255],
        "status": "enviando_clicksign",
        "canal_assinatura": "clicksign",
        "conteudo_html": f"<!-- PDF avulso: {pdf.filename or 'documento.pdf'} -->",
        "campos_valores": {"upload": True, "filename": pdf.filename},
        "nome_informado": colab["nome"],
        "cpf_informado": cpf,
        "auth_methods": auth_list,
        "lote_id": lote_id,
        "lote_titulo": f"{nome_doc} (avulso)",
        "clicksign_envelope_id": envelope_id,
        "clicksign_document_id": document_id,
        "clicksign_signer_id": signer_id,
        "clicksign_status": "draft",
        "testemunhas": testemunhas_payload,
    }
    rows = await _sb_insert("documentos_emitidos", doc_payload, schema="rh")
    doc_id = rows[0]["id"]

    # 7. Ativar envelope
    await _clicksign("PATCH", f"/envelopes/{envelope_id}", {
        "data": {"type": "envelopes", "id": envelope_id,
                 "attributes": {"status": "running"}}
    })

    # 7. URL e atualiza
    signer_url = f"https://app.clicksign.com/notarial/widget/signatures/{signer_id}/redirect"
    await _sb_patch("documentos_emitidos", {"id": f"eq.{doc_id}"}, {
        "status": "aguardando_assinatura",
        "clicksign_status": "running",
        "clicksign_signer_url": signer_url,
        "clicksign_enviado_em": now_iso,
        "enviado_em": now_iso,
    }, schema="rh")

    # 8. Notificação email
    try:
        await _clicksign("POST", f"/envelopes/{envelope_id}/notifications", {
            "data": {"type": "notifications", "attributes": {
                "message": f"Olá {primeiro}, segue {nome_doc} para sua assinatura."
            }}
        })
    except Exception:
        pass

    # 9. WhatsApp
    wa_result = None
    if enviar_whatsapp and phone and len(phone) >= 12:
        msg = mensagem_whatsapp or (
            f"Olá {primeiro}, aqui é da Parket. \n\n"
            f"Enviamos o documento *{nome_doc}* para sua assinatura.\n\n"
            f"Link direto: {signer_url}\n\n"
            f"Qualquer dúvida, responda esta mensagem. \nObrigado!"
        )
        wa_result = await _wa_send(phone, msg)

    return {
        "ok": True,
        "documento_emitido_id": doc_id,
        "envelope_id": envelope_id,
        "signer_id": signer_id,
        "colaborador_nome": colab["nome"],
        "titulo": nome_doc,
        "signer_url": signer_url,
        "whatsapp": wa_result,
        "lote_id": lote_id,
        "testemunha": testemunha_info,
    }


# ============== WEBHOOK ==============

@router.get("/webhook")
async def webhook_get():
    """Clicksign valida endpoint via GET antes de salvar — responde 200."""
    return {"ok": True, "endpoint": "clicksign-webhook", "method": "POST esperado"}


@router.post("/webhook")
async def webhook(request: Request,
                  content_hmac: Optional[str] = Header(None, alias="Content-Hmac")):
    raw = await request.body()
    try:
        payload = json.loads(raw)
    except Exception:
        raise HTTPException(400, "JSON inválido")

    event = payload.get("event") or {}
    event_name = event.get("name") or payload.get("event_name") or "unknown"

    # Localizar envelope/signer/document
    envelope_id = None
    document_id = None
    signer_id = None

    data_block = event.get("data") if isinstance(event, dict) else None
    if isinstance(data_block, dict):
        envelope = data_block.get("envelope") or data_block.get("data") or {}
        if isinstance(envelope, dict):
            envelope_id = envelope.get("id")
        doc_b = data_block.get("document")
        if isinstance(doc_b, dict):
            document_id = doc_b.get("id")
        sig_b = data_block.get("signer")
        if isinstance(sig_b, dict):
            signer_id = sig_b.get("id")

    if not envelope_id:
        envelope_id = (payload.get("envelope") or {}).get("id") or \
                      (payload.get("document") or {}).get("envelope_id")
    if not document_id:
        document_id = (payload.get("document") or {}).get("key") or \
                      (payload.get("document") or {}).get("id")

    doc_emit_id = None
    if envelope_id:
        existing = await _sb_get(
            "documentos_emitidos",
            {"clicksign_envelope_id": f"eq.{envelope_id}", "select": "id"},
            schema="rh",
        )
        if existing:
            doc_emit_id = existing[0]["id"]

    # Fallback: webhook do Clicksign v3 NÃO traz envelope.id no payload — só
    # `document.key`. Buscar via clicksign_document_id e recuperar o envelope_id
    # do registro encontrado.
    if not doc_emit_id and document_id:
        existing = await _sb_get(
            "documentos_emitidos",
            {"clicksign_document_id": f"eq.{document_id}", "select": "id,clicksign_envelope_id"},
            schema="rh",
        )
        if existing:
            doc_emit_id = existing[0]["id"]
            if not envelope_id:
                envelope_id = existing[0].get("clicksign_envelope_id")

    # Log do evento
    try:
        await _sb_insert("clicksign_eventos", {
            "documento_emitido_id": doc_emit_id,
            "envelope_id": envelope_id,
            "document_id": document_id,
            "signer_id": signer_id,
            "evento": event_name,
            "payload": payload,
            "processado": doc_emit_id is not None,
        }, schema="rh")
    except Exception:
        pass

    if not doc_emit_id:
        return {"ok": True, "warning": "envelope_id não localizado", "envelope_id": envelope_id}

    # Mapear evento -> status
    status_map = {
        "auto_close": "assinado",
        "close": "assinado",
        "sign": "assinado",
        "view": "visualizado",
        "refuse": "recusado",
        "cancel": "cancelado",
        "deadline": "expirado",
        "update_deadline": None,  # só log
        "add_signer": None,
        "upload": None,
    }
    novo_status = status_map.get(event_name)
    update: Dict[str, Any] = {"clicksign_status": event_name}
    if novo_status:
        update["status"] = novo_status

    now_iso = datetime.now(timezone.utc).isoformat()
    if event_name == "view":
        update["clicksign_visualizado_em"] = now_iso
    elif event_name in ("close", "auto_close", "sign"):
        update["clicksign_assinado_em"] = now_iso
        update["assinado_em"] = now_iso
        # Tentar baixar PDF assinado. Só "close"/"auto_close" garantem PDF disponível;
        # "sign" pode vir antes do PDF ficar pronto (especialmente com testemunha pendente).
        # Em qualquer falha, deixa SEM gravar erro — o endpoint baixar_pdf faz fallback
        # on-demand quando o user clicar pra baixar.
        try:
            signed_path = await _baixar_pdf_assinado(doc_emit_id, envelope_id)
            update["clicksign_signed_pdf_url"] = signed_path
        except Exception:
            pass  # endpoint /pdf-assinado tenta de novo on-demand

    await _sb_patch("documentos_emitidos", {"id": f"eq.{doc_emit_id}"}, update, schema="rh")

    # Notifica grupo RH — agrupado por envelope pra não bombardear.
    # - `sign` individual: NÃO notifica (cada doc individual gera 1 sign;
    #    se um envelope tem 12 docs, seriam 12 msgs). Espera o auto_close.
    # - `auto_close`/`close`: 1 msg com summary do envelope (todos docs assinados)
    # - `refuse`: notifica imediato — é importante saber
    notify_event = None
    if event_name in ("close", "auto_close"):
        notify_event = "assinou"
    elif event_name == "refuse":
        notify_event = "recusou"
    if notify_event and envelope_id:
        try:
            # Pega TODOS os docs do envelope pra montar o summary
            envelope_docs = await _sb_get(
                "documentos_emitidos",
                {"clicksign_envelope_id": f"eq.{envelope_id}",
                 "select": "titulo,nome_informado,colaborador_id"},
                schema="rh",
            ) or [doc_data[0] if (doc_data := await _sb_get(
                "documentos_emitidos",
                {"id": f"eq.{doc_emit_id}", "select": "titulo,nome_informado,colaborador_id"},
                schema="rh",
            )) else {}]
            if envelope_docs:
                # Nome do colab (pega do primeiro doc)
                d0 = envelope_docs[0]
                nome = d0.get("nome_informado") or ""
                if not nome and d0.get("colaborador_id"):
                    col = await _sb_get(
                        "colaboradores",
                        {"id": f"eq.{d0['colaborador_id']}", "select": "nome_completo,nome"},
                        schema="rh",
                    )
                    if col:
                        nome = col[0].get("nome_completo") or col[0].get("nome") or ""
                nome = nome or "Colaborador"
                if notify_event == "assinou":
                    # Anti-duplicação: só envia se ainda não foi notificado pro envelope
                    flag = await _sb_get(
                        "documentos_emitidos",
                        {"clicksign_envelope_id": f"eq.{envelope_id}",
                         "rh_grupo_notificado": "eq.true", "select": "id", "limit": "1"},
                        schema="rh",
                    )
                    if not flag:
                        n = len(envelope_docs)
                        msg = f"✅ *{nome}* assinou {n} documento{'s' if n != 1 else ''}"
                        await _wa_send_rh_group(msg)
                        # Marca todos como notificados
                        await _sb_patch(
                            "documentos_emitidos",
                            {"clicksign_envelope_id": f"eq.{envelope_id}"},
                            {"rh_grupo_notificado": True},
                            schema="rh",
                        )
                else:  # recusou
                    titulo = d0.get("titulo") or "(documento)"
                    msg = f"⛔ *{nome}* recusou: _{titulo}_"
                    await _wa_send_rh_group(msg)
        except Exception:
            pass

    return {"ok": True, "event": event_name, "documento_emitido_id": doc_emit_id}


async def _baixar_pdf_assinado(doc_emit_id: str, envelope_id: str, token: Optional[str] = None) -> str:
    """Baixa PDF assinado do Clicksign e arquiva no bucket. Retorna path do storage.
    Resolve token automaticamente pela empresa do colaborador se não vier."""
    if not token:
        try:
            rows = await _sb_get(
                "documentos_emitidos",
                {"id": f"eq.{doc_emit_id}", "select": "colaborador_id"},
                schema="rh",
            )
            colab_id = (rows or [{}])[0].get("colaborador_id")
            empresa_id = None
            if colab_id:
                contrs = await _sb_get(
                    "contratos",
                    {"colaborador_id": f"eq.{colab_id}", "deleted_at": "is.null",
                     "select": "empresa_id", "order": "data_admissao.desc", "limit": "1"},
                    schema="rh",
                )
                if contrs:
                    empresa_id = contrs[0].get("empresa_id")
            token = await _resolver_token_empresa(empresa_id)
        except Exception:
            token = CLICKSIGN_TOKEN

    docs_resp = await _clicksign("GET", f"/envelopes/{envelope_id}/documents", token=token)
    docs = docs_resp.get("data", []) or []
    if not docs:
        raise RuntimeError("envelope sem documents")
    doc = docs[0]
    # API v3: URLs estão em data.links.files.{original,signed,ziped}
    files = ((doc.get("links") or {}).get("files") or {})
    signed_url = files.get("signed") or files.get("original")
    if not signed_url:
        raise RuntimeError("links.files.signed ausente")

    async with httpx.AsyncClient(timeout=60, follow_redirects=True) as c:
        pdf = await c.get(signed_url)
    if pdf.status_code >= 400:
        raise RuntimeError(f"download {pdf.status_code}")

    storage_path = f"{datetime.now().strftime('%Y/%m')}/{doc_emit_id}.pdf"
    await _sb_storage_upload(BUCKET_SIGNED, storage_path, pdf.content, "application/pdf")
    return f"{BUCKET_SIGNED}/{storage_path}"


# ============== LISTAR / BAIXAR ==============

@router.get("/envios")
async def listar_envios(
    limit: int = Query(100, le=500),
    offset: int = 0,
    status: Optional[str] = None,
    colaborador_id: Optional[str] = None,
):
    params = {
        "select": ("id,titulo,status,clicksign_status,clicksign_envelope_id,"
                   "clicksign_enviado_em,clicksign_visualizado_em,clicksign_assinado_em,"
                   "colaborador_id,modelo_id,created_at,nome_informado,cpf_informado,"
                   "clicksign_signer_url,clicksign_signed_pdf_url"),
        "canal_assinatura": "eq.clicksign",
        "order": "created_at.desc",
        "limit": str(limit),
        "offset": str(offset),
    }
    if status:
        params["status"] = f"eq.{status}"
    if colaborador_id:
        params["colaborador_id"] = f"eq.{colaborador_id}"
    rows = await _sb_get("documentos_emitidos", params, schema="rh")
    return {"items": rows, "count": len(rows)}


def _gerar_pdf_interno(doc: Dict) -> bytes:
    """Gera PDF on-demand para documentos assinados via canal interno
    (token + canvas). Embute a assinatura PNG e metadados de auditoria no fim
    do HTML do documento e converte com WeasyPrint."""
    titulo = doc.get("titulo") or "Documento"
    html = doc.get("conteudo_html") or f"<h1>{titulo}</h1>"
    assinatura = doc.get("assinatura") or {}
    png_b64 = assinatura.get("png") or ""
    nome_ass = assinatura.get("nome_assinante") or doc.get("nome_informado") or "—"
    assinado_em = assinatura.get("assinado_em") or doc.get("assinado_em") or ""
    ip_ua = assinatura.get("ip_user_agent") or ""

    # Render principal
    rendered = _render_html(html, titulo, doc.get("campos_valores") or {})

    # Bloco de assinatura
    img_src = png_b64 if png_b64.startswith("data:") else (f"data:image/png;base64,{png_b64}" if png_b64 else "")
    img_html = f'<img src="{img_src}" style="max-width:380px;max-height:140px;border:1px solid #ddd;padding:8px;background:#fff" />' if img_src else "<em>(sem imagem da assinatura)</em>"
    bloco = f"""
    <div style="margin-top:40px;padding-top:20px;border-top:2px solid #333;page-break-inside:avoid">
      <h3 style="margin:0 0 12px 0;font-size:14px">Assinatura digital</h3>
      {img_html}
      <table style="margin-top:12px;font-size:11px;color:#444">
        <tr><td style="padding:2px 12px 2px 0"><b>Assinado por</b></td><td>{nome_ass}</td></tr>
        <tr><td style="padding:2px 12px 2px 0"><b>Data/hora</b></td><td>{assinado_em}</td></tr>
        <tr><td style="padding:2px 12px 2px 0"><b>Auditoria</b></td><td style="font-family:monospace;font-size:9px">{ip_ua[:200]}</td></tr>
        <tr><td style="padding:2px 12px 2px 0"><b>Documento ID</b></td><td style="font-family:monospace">{doc.get('id') or ''}</td></tr>
      </table>
    </div>
    """

    # Injeta antes do </body> se existir, senão concatena
    if "</body>" in rendered.lower():
        idx = rendered.lower().rindex("</body>")
        rendered = rendered[:idx] + bloco + rendered[idx:]
    else:
        rendered = rendered + bloco

    return _html_to_pdf(rendered)


@router.get("/envios/{envio_id}/pdf-assinado")
async def baixar_pdf(envio_id: str):
    rows = await _sb_get(
        "documentos_emitidos",
        {"id": f"eq.{envio_id}",
         "select": "id,clicksign_signed_pdf_url,clicksign_envelope_id,storage_path_pdf,canal_assinatura,status,titulo,conteudo_html,campos_valores,assinatura,nome_informado,assinado_em"},
        schema="rh",
    )
    if not rows:
        raise HTTPException(404, "Envio não encontrado")
    doc = rows[0]
    canal = doc.get("canal_assinatura") or "clicksign"
    # `path` é o caminho no bucket: clicksign usa coluna clicksign_signed_pdf_url,
    # interna usa storage_path_pdf (gerado on-demand abaixo).
    path = (doc.get("clicksign_signed_pdf_url") if canal == "clicksign"
            else doc.get("storage_path_pdf"))

    if doc.get("status") != "assinado":
        raise HTTPException(404, "Documento ainda não foi assinado")

    # ── Caminho Clicksign ───────────────────────────────────────────────
    if canal == "clicksign":
        # Fallback on-demand: webhook pode ter falhado em baixar
        if not path or path.startswith("erro:"):
            envelope_id = doc.get("clicksign_envelope_id")
            if envelope_id:
                try:
                    path = await _baixar_pdf_assinado(envio_id, envelope_id)
                    await _sb_patch("documentos_emitidos", {"id": f"eq.{envio_id}"},
                                     {"clicksign_signed_pdf_url": path}, schema="rh")
                except Exception as e:
                    raise HTTPException(404, f"PDF assinado indisponível: {e}")
        if not path or path.startswith("erro:"):
            raise HTTPException(404, "PDF assinado ainda não disponível")

    # ── Caminho interno (assinatura por token + canvas) ─────────────────
    else:
        if not path:
            # Gera PDF on-demand, salva no bucket, grava storage_path_pdf
            try:
                pdf_bytes = _gerar_pdf_interno(doc)
                storage_path = f"interna/{datetime.now().strftime('%Y/%m')}/{envio_id}.pdf"
                await _sb_storage_upload(BUCKET_SIGNED, storage_path, pdf_bytes, "application/pdf")
                path = f"{BUCKET_SIGNED}/{storage_path}"
                await _sb_patch("documentos_emitidos", {"id": f"eq.{envio_id}"},
                                 {"storage_path_pdf": path}, schema="rh")
            except Exception as e:
                raise HTTPException(500, f"Falha gerando PDF: {e}")

    parts = path.split("/", 1)
    bucket, key = parts[0], parts[1]
    async with httpx.AsyncClient(timeout=60) as c:
        r = await c.get(
            f"{SUPA_URL}/storage/v1/object/{bucket}/{key}",
            headers={"apikey": SUPA_KEY, "Authorization": f"Bearer {SUPA_KEY}"},
        )
    if r.status_code >= 400:
        raise HTTPException(500, f"Storage: {r.text[:200]}")
    titulo = doc.get("titulo", "documento")
    # ASCII-safe filename (HTTP headers são latin-1; emdash/acentos quebram).
    # RFC 6266 + 5987: filename= pra fallback ASCII, filename*= pra UTF-8.
    import urllib.parse as _up
    ascii_name = titulo.encode("ascii", errors="replace").decode("ascii").replace("?", "_")
    utf8_name = _up.quote(titulo + ".pdf", safe="")
    return Response(
        content=r.content,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f"inline; filename=\"{ascii_name}.pdf\"; filename*=UTF-8''{utf8_name}",
        },
    )


@router.post("/sync-all")
async def sync_all(delay_ms: int = 250):
    """Varre todos envelopes pendentes e sincroniza status com o Clicksign (compensa falta de webhook).

    Deduplica por envelope_id (um envelope cobre N docs do mesmo colaborador) pra
    evitar 429 Too many requests. `_sync_um` em qualquer doc do envelope dispara
    o `auto_close` lógico e o PATCH cobre todos os irmãos via `clicksign_envelope_id`.
    """
    pendentes = await _sb_get(
        "documentos_emitidos",
        {
            "select": "id,clicksign_envelope_id,clicksign_signer_id,status,clicksign_status",
            "canal_assinatura": "eq.clicksign",
            "status": "in.(aguardando_assinatura,enviando_clicksign,visualizado,assinando)",
            "clicksign_envelope_id": "not.is.null",
            "limit": "1000",
        },
        schema="rh",
    )
    por_envelope: Dict[str, Dict] = {}
    for row in pendentes:
        env = row.get("clicksign_envelope_id")
        if env and env not in por_envelope:
            por_envelope[env] = row

    updated, errors = 0, []
    for env, row in por_envelope.items():
        try:
            r = await _sync_um(row["id"], env, row.get("clicksign_signer_id"))
            if r.get("changed"):
                updated += 1
                novo_status = r.get("status")
                if novo_status:
                    extra: Dict[str, Any] = {"status": novo_status,
                                             "clicksign_status": r.get("envelope_status")}
                    if novo_status == "assinado":
                        now_iso = datetime.now(timezone.utc).isoformat()
                        extra["assinado_em"] = now_iso
                        extra["clicksign_assinado_em"] = now_iso
                    await _sb_patch(
                        "documentos_emitidos",
                        {"clicksign_envelope_id": f"eq.{env}",
                         "status": "in.(aguardando_assinatura,enviando_clicksign,visualizado,assinando)"},
                        extra,
                        schema="rh",
                    )
        except Exception as e:
            errors.append({"envelope": env, "erro": str(e)[:200]})
        if delay_ms > 0:
            await asyncio.sleep(delay_ms / 1000)
    return {"ok": True, "total_docs_pendentes": len(pendentes),
            "envelopes_unicos": len(por_envelope),
            "envelopes_atualizados": updated,
            "atualizados": updated,
            "erros": errors}


@router.post("/envios/{envio_id}/sync")
async def sync_um_endpoint(envio_id: str):
    """Sincroniza UM envelope específico."""
    rows = await _sb_get(
        "documentos_emitidos",
        {"id": f"eq.{envio_id}",
         "select": "id,clicksign_envelope_id,clicksign_signer_id,status,clicksign_status"},
        schema="rh",
    )
    if not rows:
        raise HTTPException(404, "Envio não encontrado")
    row = rows[0]
    if not row.get("clicksign_envelope_id"):
        raise HTTPException(400, "Envio não tem envelope Clicksign vinculado")
    r = await _sync_um(row["id"], row["clicksign_envelope_id"], row.get("clicksign_signer_id"))
    return r


async def _resolver_token_por_doc(doc_id: str) -> str:
    """Resolve token Clicksign pelo doc_emit → colab → contrato.empresa → clicksign_contas."""
    try:
        rows = await _sb_get(
            "documentos_emitidos",
            {"id": f"eq.{doc_id}", "select": "colaborador_id"},
            schema="rh",
        )
        colab_id = (rows or [{}])[0].get("colaborador_id")
        if not colab_id:
            return CLICKSIGN_TOKEN
        contrs = await _sb_get(
            "contratos",
            {"colaborador_id": f"eq.{colab_id}", "deleted_at": "is.null",
             "select": "empresa_id", "order": "data_admissao.desc", "limit": "1"},
            schema="rh",
        )
        empresa_id = (contrs or [{}])[0].get("empresa_id") if contrs else None
        return await _resolver_token_empresa(empresa_id)
    except Exception:
        return CLICKSIGN_TOKEN


async def _sync_um(doc_id: str, envelope_id: str, signer_id: Optional[str]) -> Dict:
    """Consulta Clicksign e atualiza status do envio local. Retorna changed=True se mudou."""
    token = await _resolver_token_por_doc(doc_id)
    env = await _clicksign("GET", f"/envelopes/{envelope_id}?include=signers", token=token)
    env_data = env.get("data", {}).get("attributes", {})
    env_status = env_data.get("status")  # draft/running/closed/canceled
    signers = [i for i in env.get("included", []) if i.get("type") == "signers"]
    me = next((s for s in signers if s["id"] == signer_id), signers[0] if signers else None)

    # determinar novo status
    update: Dict[str, Any] = {"clicksign_status": env_status}
    novo_status = None
    now_iso = datetime.now(timezone.utc).isoformat()

    if me:
        attrs = me.get("attributes", {}) or {}
        if attrs.get("sign_url") and not row_sign_url(doc_id, attrs.get("sign_url")):
            update["clicksign_signer_url"] = attrs.get("sign_url")
        signed_at = attrs.get("signed_at") or attrs.get("signed_at_iso")
        viewed_at = attrs.get("viewed_at") or attrs.get("requested_signature_at")
        if signed_at:
            update["clicksign_assinado_em"] = signed_at if "T" in str(signed_at) else now_iso
            novo_status = "assinado"
            update["assinado_em"] = update["clicksign_assinado_em"]
        elif viewed_at and env_status == "running":
            update["clicksign_visualizado_em"] = viewed_at if "T" in str(viewed_at) else now_iso
            novo_status = "visualizado"

    if env_status == "closed" and not novo_status:
        novo_status = "assinado"
        update["clicksign_assinado_em"] = now_iso
        update["assinado_em"] = now_iso
    elif env_status == "canceled":
        novo_status = "cancelado"

    if novo_status:
        update["status"] = novo_status

    # Se assinado, baixar PDF + arquivar
    if novo_status == "assinado":
        try:
            signed_path = await _baixar_pdf_assinado(doc_id, envelope_id, token=token)
            update["clicksign_signed_pdf_url"] = signed_path
        except Exception as e:
            update["clicksign_signed_pdf_url"] = f"erro:{str(e)[:120]}"

    await _sb_patch("documentos_emitidos", {"id": f"eq.{doc_id}"}, update, schema="rh")
    return {"ok": True, "changed": novo_status is not None,
            "envelope_status": env_status, "status": novo_status}


def row_sign_url(_doc_id: str, _url: Optional[str]) -> bool:
    # helper trivial pra evitar update inútil; sempre faz update por simplicidade
    return False


@router.get("/envios/{envio_id}/eventos")
async def listar_eventos(envio_id: str):
    rows = await _sb_get(
        "clicksign_eventos",
        {"documento_emitido_id": f"eq.{envio_id}", "order": "recebido_em.desc",
         "select": "id,evento,payload,recebido_em,processado,erro"},
        schema="rh",
    )
    return {"items": rows}


# ============== HEALTHCHECK ==============

@router.get("/healthcheck")
async def healthcheck():
    try:
        resp = await _clicksign("GET", "/envelopes?page%5Bsize%5D=1")
        return {
            "ok": True,
            "clicksign_api": "v3",
            "supabase": "ok" if SUPA_URL else "no-config",
            "envelopes_visiveis_amostra": len(resp.get("data", []) or []),
            "webhook_url": "https://rh.parket.works/api/clicksign/webhook",
        }
    except HTTPException as e:
        raise e


# ─────────────────────────────────────────────────────────────────────
# COBRANÇA WHATSAPP — chamado por cron diário (8h da manhã via crontab).
# Pra cada envelope com algum doc `aguardando_assinatura` cuja
# `rh_proxima_cobranca_em` já passou (ou é null), manda 1 mensagem WA
# pra pessoa lembrando de assinar. Reagenda próxima cobrança pra +24h.
# Endpoint público pra ser disparado pelo cron host.
# ─────────────────────────────────────────────────────────────────────
@router.post("/cobrar-pendentes-wa")
async def cobrar_pendentes_wa(intervalo_horas: int = 24, max_envios: int = 200):
    now = datetime.now(timezone.utc)
    # Busca docs aguardando, agrupa por envelope (1 pessoa = 1 envelope)
    pendentes = await _sb_get(
        "documentos_emitidos",
        {"status": "eq.aguardando_assinatura",
         "clicksign_envelope_id": "not.is.null",
         "select": "id,clicksign_envelope_id,clicksign_signer_url,colaborador_id,"
                   "rh_proxima_cobranca_em,rh_cobrancas_enviadas,titulo,nome_informado,created_at",
         "limit": str(max_envios * 20)},
        schema="rh",
    )
    # Agrupa por envelope_id — pega o "primeiro" doc representativo
    por_envelope: Dict[str, Dict] = {}
    for d in (pendentes or []):
        env = d.get("clicksign_envelope_id")
        if not env:
            continue
        if env not in por_envelope:
            por_envelope[env] = d

    enviados = 0
    skipped = 0
    erros = 0
    for env, doc in por_envelope.items():
        if enviados >= max_envios:
            break
        prox = doc.get("rh_proxima_cobranca_em")
        if prox:
            try:
                prox_dt = datetime.fromisoformat(prox.replace("Z", "+00:00"))
                if prox_dt > now:
                    skipped += 1
                    continue
            except Exception:
                pass

        try:
            # Pega phone do colab
            colab_id = doc.get("colaborador_id")
            if not colab_id:
                skipped += 1
                continue
            colabs = await _sb_get(
                "colaboradores",
                {"id": f"eq.{colab_id}",
                 "select": "nome,nome_completo,celular,email_profissional"},
                schema="rh",
            )
            if not colabs:
                skipped += 1
                continue
            colab = colabs[0]
            phone = (colab.get("celular") or "").replace(" ", "").replace("-", "")\
                       .replace("(", "").replace(")", "")
            if phone and not phone.startswith("55"):
                phone = "55" + phone
            if not phone or len(phone) < 12:
                skipped += 1
                continue

            nome_full = colab.get("nome_completo") or colab.get("nome") or "Colaborador"
            primeiro = nome_full.split()[0].capitalize()
            signer_url = doc.get("clicksign_signer_url") or ""
            cobr_count = (doc.get("rh_cobrancas_enviadas") or 0) + 1

            # Empresa via contrato ativo (igual no envio inicial)
            empresa_nome = "Parket"
            try:
                ctr = await _sb_get(
                    "contratos",
                    {"colaborador_id": f"eq.{colab_id}", "status": "eq.ativo",
                     "select": "empresa_id", "limit": "1"},
                    schema="rh",
                )
                if ctr and ctr[0].get("empresa_id"):
                    emp = await _sb_get(
                        "empresas",
                        {"id": f"eq.{ctr[0]['empresa_id']}", "select": "razao_social"},
                        schema="rh",
                    )
                    if emp and emp[0].get("razao_social"):
                        empresa_nome = emp[0]["razao_social"]
            except Exception:
                pass

            msg = (f"Olá {primeiro}, aqui é da {empresa_nome}.\n\n"
                   f"Lembramos que você ainda tem documentos pendentes para assinar.\n\n"
                   f"Link para assinatura:\n{signer_url}\n\n"
                   f"Por favor, finalize a assinatura o quanto antes.\n"
                   f"Qualquer dúvida, responda esta mensagem.\n"
                   f"Obrigado!")
            await _wa_send(phone, msg)

            # Atualiza TODOS os docs daquele envelope: incrementa cobranças + reagenda
            prox_iso = (now + timedelta(hours=intervalo_horas)).isoformat()
            await _sb_patch(
                "documentos_emitidos",
                {"clicksign_envelope_id": f"eq.{env}",
                 "status": "eq.aguardando_assinatura"},
                {"rh_cobrancas_enviadas": cobr_count,
                 "rh_proxima_cobranca_em": prox_iso},
                schema="rh",
            )
            enviados += 1
        except Exception as e:
            erros += 1
            print(f"[cobrar-pendentes] erro env={env}: {e}")

    return {
        "ok": True,
        "envelopes_pendentes": len(por_envelope),
        "wa_enviados": enviados,
        "skipped_recentes": skipped,
        "erros": erros,
    }
