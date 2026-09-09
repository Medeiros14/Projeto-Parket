"""
Assinatura interna — geração do PDF final com página de manifesto.

Fluxo (após documento_public_sign no frontend gravar assinatura + selfie_path + doc_path):
  1. Frontend chama POST /documentos/{doc_id}/pdf-final com {token}
  2. Backend valida token, lê o documento, a assinatura JSONB, baixa selfie/doc do Storage
  3. Renderiza o contrato (conteudo_html) em PDF via weasyprint
  4. Renderiza uma página de manifesto (assinatura + thumbs selfie/doc + hash + IP + timestamp real)
  5. Merge com pypdf
  6. Upload no bucket rh-documentos em pdf-final/{doc_id}.pdf
  7. UPDATE documentos_emitidos.storage_path_pdf
  8. Devolve o path
"""
from __future__ import annotations

import base64
import hashlib
import io
import os
from datetime import datetime, timezone, timedelta
from typing import Dict, List, Optional

import httpx
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from pypdf import PdfReader, PdfWriter
from weasyprint import HTML

from app.config import settings

router = APIRouter(prefix="/api/documentos", tags=["assinatura-interna"])

# Reads/writes de REST vão pro gateway local (api.parket.works → parket-pg-local)
# porque é onde o frontend grava a assinatura via anon RPC. Storage segue pro
# Cloud (o gateway proxya /storage pro Cloud). Mesma service key nos dois.
SUPA_REST = os.getenv("SUPABASE_REST_URL", "https://api.parket.works")
SUPA_URL = settings.SUPABASE_URL  # ainda usado pra storage direto (fallback)
SUPA_KEY = settings.SUPABASE_SERVICE_KEY
BUCKET = "rh-documentos"
BR_TZ = timezone(timedelta(hours=-3))

# Números que recebem aviso quando doc externo é assinado (Will pediu — não expor pro cliente).
WA_ADMINS_PARKET = [os.getenv("RH_ADMIN_WHATSAPP", "5511939213329")]  # Will
EVOLUTION_URL = os.getenv("EVOLUTION_URL", "https://conect.parket.works")
EVOLUTION_KEY = os.getenv("EVOLUTION_KEY", "4eab105201410d6865b86dca76ee9fa3")
EVOLUTION_INSTANCE = os.getenv("EVOLUTION_INSTANCE_RH", "Rh - Parket")


def _sb_headers(schema: Optional[str] = None) -> Dict:
    h = {
        "apikey": SUPA_KEY,
        "Authorization": f"Bearer {SUPA_KEY}",
        "Content-Type": "application/json",
    }
    if schema:
        h["Accept-Profile"] = schema
        h["Content-Profile"] = schema
    return h


async def _sb_get_doc(doc_id: str) -> Dict:
    async with httpx.AsyncClient(timeout=30) as c:
        r = await c.get(
            f"{SUPA_REST}/rest/v1/documentos_emitidos",
            headers=_sb_headers(schema="rh"),
            params={"id": f"eq.{doc_id}", "select": "*", "limit": "1"},
        )
    if r.status_code >= 400:
        raise HTTPException(r.status_code, f"Fetch doc: {r.text[:200]}")
    rows = r.json() or []
    if not rows:
        raise HTTPException(404, "Documento não encontrado")
    return rows[0]


async def _sb_patch_doc(doc_id: str, payload: Dict) -> None:
    async with httpx.AsyncClient(timeout=30) as c:
        r = await c.patch(
            f"{SUPA_REST}/rest/v1/documentos_emitidos",
            headers=_sb_headers(schema="rh"),
            params={"id": f"eq.{doc_id}"},
            json=payload,
        )
    if r.status_code >= 400:
        raise HTTPException(r.status_code, f"Patch doc: {r.text[:200]}")


async def _sb_storage_download(path: str) -> Optional[bytes]:
    """Baixa objeto do bucket rh-documentos. path é 'kyc/{token}/selfie.jpg' etc."""
    async with httpx.AsyncClient(timeout=60) as c:
        r = await c.get(
            f"{SUPA_URL}/storage/v1/object/{BUCKET}/{path}",
            headers={"apikey": SUPA_KEY, "Authorization": f"Bearer {SUPA_KEY}"},
        )
    if r.status_code == 404:
        return None
    if r.status_code >= 400:
        raise HTTPException(r.status_code, f"Storage download {path}: {r.text[:200]}")
    return r.content


async def _sb_storage_upload(path: str, content: bytes, content_type: str = "application/pdf") -> str:
    async with httpx.AsyncClient(timeout=60) as c:
        r = await c.post(
            f"{SUPA_URL}/storage/v1/object/{BUCKET}/{path}",
            headers={
                "apikey": SUPA_KEY,
                "Authorization": f"Bearer {SUPA_KEY}",
                "Content-Type": content_type,
                "x-upsert": "true",
            },
            content=content,
        )
    if r.status_code >= 400 and "already exists" not in r.text.lower():
        raise HTTPException(r.status_code, f"Storage upload: {r.text[:200]}")
    return f"{BUCKET}/{path}"


def _wrap_html_para_pdf(titulo: str, corpo_html: str) -> str:
    """Envelopa o conteudo_html do contrato num shell de PDF A4 formatado."""
    return f"""<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>{titulo}</title>
<style>
@page {{ size: A4; margin: 22mm 18mm 22mm 18mm; }}
body {{ font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; font-size: 10.5pt; color: #111; line-height: 1.55; }}
h1 {{ font-size: 14pt; text-transform: uppercase; letter-spacing: .05em; text-align: center; margin: 0 0 18pt 0; }}
h2 {{ font-size: 12pt; margin: 16pt 0 8pt 0; text-transform: uppercase; }}
h3 {{ font-size: 11pt; margin: 14pt 0 6pt 0; color: #222; }}
p {{ margin: 0 0 8pt 0; text-align: justify; }}
ol, ul {{ margin: 0 0 8pt 22pt; }}
li {{ margin-bottom: 5pt; text-align: justify; }}
strong {{ color: #000; }}
</style></head><body>{corpo_html}</body></html>"""


def _pdf_manifesto(
    titulo_doc: str,
    signatario_nome: str,
    signatario_cpf: str,
    empresa_signatario: str,
    empresa_signatario_cnpj: str,
    assinatura_png_data_uri: str,
    selfie_jpg_bytes: Optional[bytes],
    doc_jpg_bytes: Optional[bytes],
    assinado_em_utc: datetime,
    ip_user_agent: str,
    doc_hash: str,
    doc_id: str,
) -> bytes:
    """Gera uma página A4 de manifesto de assinatura eletrônica."""
    ass_em_br = assinado_em_utc.astimezone(BR_TZ).strftime("%d/%m/%Y %H:%M:%S")

    def to_data_uri(jpg: Optional[bytes]) -> str:
        if not jpg:
            return ""
        b64 = base64.b64encode(jpg).decode()
        return f"data:image/jpeg;base64,{b64}"

    selfie_uri = to_data_uri(selfie_jpg_bytes)
    doc_uri = to_data_uri(doc_jpg_bytes)

    linhas_empresa = ""
    if empresa_signatario or empresa_signatario_cnpj:
        linhas_empresa = f"<div><strong>Empresa:</strong> {empresa_signatario or ''}"
        if empresa_signatario_cnpj:
            linhas_empresa += f" — CNPJ {empresa_signatario_cnpj}"
        linhas_empresa += "</div>"

    html = f"""<!DOCTYPE html>
<html><head><meta charset="utf-8">
<style>
@page {{ size: A4; margin: 20mm; }}
body {{ font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; font-size: 10pt; color: #1a1a1a; line-height: 1.5; }}
h1 {{ font-size: 13pt; margin: 0 0 4pt 0; letter-spacing: .04em; text-transform: uppercase; }}
h2 {{ font-size: 10.5pt; margin: 18pt 0 6pt 0; color: #0f172a; border-bottom: 1px solid #cbd5e1; padding-bottom: 3pt; text-transform: uppercase; letter-spacing: .05em; }}
.sub {{ color: #64748b; font-size: 9pt; margin-bottom: 14pt; }}
.grid {{ display: table; width: 100%; table-layout: fixed; border-spacing: 12pt 0; }}
.col {{ display: table-cell; width: 50%; vertical-align: top; }}
.thumb {{ width: 100%; border: 1px solid #cbd5e1; border-radius: 4pt; }}
.thumb-label {{ font-size: 8.5pt; color: #64748b; text-align: center; margin-top: 4pt; text-transform: uppercase; letter-spacing: .05em; }}
.info-row {{ margin-bottom: 6pt; }}
.info-row strong {{ display: inline-block; min-width: 130pt; color: #334155; font-weight: 600; }}
.assinatura-box {{ text-align: center; border: 1px solid #cbd5e1; border-radius: 4pt; padding: 12pt; background: #f8fafc; margin-top: 6pt; }}
.assinatura-box img {{ max-height: 90pt; }}
.hash {{ font-family: 'Courier New', monospace; font-size: 8pt; color: #475569; word-break: break-all; }}
.legal {{ background: #f1f5f9; border-left: 3pt solid #64748b; padding: 8pt 10pt; margin-top: 18pt; font-size: 8.5pt; color: #334155; line-height: 1.45; }}
</style></head><body>
<h1>Manifesto de Assinatura Eletrônica</h1>
<div class="sub">Documento: <strong>{titulo_doc}</strong> · ID interno: {doc_id}</div>

<h2>Signatário</h2>
<div class="info-row"><strong>Nome:</strong> {signatario_nome or '—'}</div>
<div class="info-row"><strong>CPF:</strong> {signatario_cpf or '—'}</div>
{linhas_empresa}

<h2>Identificação (KYC)</h2>
<div class="grid">
  <div class="col">
    {'<img src="' + selfie_uri + '" class="thumb"/>' if selfie_uri else '<div class="thumb-label">Selfie não capturada</div>'}
    <div class="thumb-label">Selfie do signatário</div>
  </div>
  <div class="col">
    {'<img src="' + doc_uri + '" class="thumb"/>' if doc_uri else '<div class="thumb-label">Documento não capturado</div>'}
    <div class="thumb-label">Documento oficial com foto</div>
  </div>
</div>

<h2>Assinatura</h2>
<div class="assinatura-box">
  <img src="{assinatura_png_data_uri}" alt="Assinatura"/>
</div>

<h2>Registro de Auditoria</h2>
<div class="info-row"><strong>Data e hora reais:</strong> {ass_em_br} (horário de Brasília)</div>
<div class="info-row"><strong>Timestamp UTC:</strong> {assinado_em_utc.strftime('%Y-%m-%dT%H:%M:%SZ')}</div>
<div class="info-row"><strong>User-Agent / IP:</strong> {ip_user_agent[:180]}</div>
<div class="info-row"><strong>Hash SHA-256 do documento:</strong></div>
<div class="hash">{doc_hash}</div>

<div class="legal">
Esta assinatura eletrônica é considerada válida nos termos da Medida Provisória
nº 2.200-2/2001, com autenticação por conjunto de evidências digitais
(assinatura manuscrita, selfie, documento oficial com foto, timestamp, IP e
hash do documento). O manifesto acima é parte integrante e inseparável do
documento assinado.
</div>
</body></html>"""
    return HTML(string=html).write_pdf()


class PdfFinalReq(BaseModel):
    token: str


@router.post("/{doc_id}/pdf-final")
async def gerar_pdf_final(doc_id: str, body: PdfFinalReq, request: Request):
    """Gera o PDF final (contrato + manifesto) e sobe pro storage.

    Autorizado pelo par (doc_id, token) — não expõe o serviço pra qualquer um.
    Reentrante: se rodar 2x, gera 2x (upsert sobrescreve).
    """
    doc = await _sb_get_doc(doc_id)
    if doc.get("token") != body.token:
        raise HTTPException(403, "Token não confere com o documento")
    if doc.get("status") != "assinado":
        raise HTTPException(400, f"Documento não assinado (status={doc.get('status')})")

    assinatura = doc.get("assinatura") or {}
    if not assinatura.get("png"):
        raise HTTPException(400, "Assinatura sem PNG registrado")

    # Selfie e foto do doc (podem ser None se o doc não exigiu KYC)
    selfie_bytes = None
    doc_bytes = None
    if assinatura.get("selfie_path"):
        selfie_bytes = await _sb_storage_download(assinatura["selfie_path"])
    if assinatura.get("doc_path"):
        doc_bytes = await _sb_storage_download(assinatura["doc_path"])

    # 1. Substitui placeholders do bloco de assinatura pelos dados reais
    #    [[ASS_CONTRATADA]] → <img> da assinatura desenhada
    #    [[NOME_CONTRATADA]] → nome_informado
    #    [[CPF_CONTRATADA]] → cpf_informado (mascarado)
    corpo_html = doc.get("conteudo_html", "")
    ass_img = f'<img src="{assinatura["png"]}" style="max-height:40pt;vertical-align:middle"/>'
    nome_ctd = (doc.get("nome_informado") or assinatura.get("nome_assinante") or "").strip()
    cpf_raw = (doc.get("cpf_informado") or "").strip()
    # mascara CPF se veio só dígitos
    _d = "".join(c for c in cpf_raw if c.isdigit())
    cpf_ctd = f"{_d[:3]}.{_d[3:6]}.{_d[6:9]}-{_d[9:]}" if len(_d) == 11 else cpf_raw
    corpo_html = (corpo_html
                  .replace("[[ASS_CONTRATADA]]", ass_img)
                  .replace("[[NOME_CONTRATADA]]", nome_ctd)
                  .replace("[[CPF_CONTRATADA]]", cpf_ctd))

    contrato_html = _wrap_html_para_pdf(doc.get("titulo", ""), corpo_html)
    contrato_pdf_bytes = HTML(string=contrato_html).write_pdf()

    # 2. Hash SHA-256 do PDF do contrato — vira parte da prova
    doc_hash = hashlib.sha256(contrato_pdf_bytes).hexdigest()

    # 3. Extrai info do signatário
    signatario_nome = assinatura.get("nome_assinante") or doc.get("nome_informado") or ""
    signatario_cpf = doc.get("cpf_informado") or ""
    # Se veio de colaborador, busca via join simples
    if not signatario_nome and doc.get("colaborador_id"):
        async with httpx.AsyncClient(timeout=15) as c:
            rc = await c.get(
                f"{SUPA_REST}/rest/v1/colaboradores",
                headers=_sb_headers(schema="rh"),
                params={"id": f"eq.{doc['colaborador_id']}", "select": "nome,cpf", "limit": "1"},
            )
        if rc.status_code == 200 and rc.json():
            signatario_nome = rc.json()[0].get("nome") or ""
            signatario_cpf = signatario_cpf or (rc.json()[0].get("cpf") or "")

    # 4. Empresa contratante (Parket)
    empresa_nome = ""
    empresa_cnpj = ""
    if doc.get("empresa_id"):
        async with httpx.AsyncClient(timeout=15) as c:
            re_ = await c.get(
                f"{SUPA_REST}/rest/v1/empresas",
                headers=_sb_headers(schema="core"),
                params={"id": f"eq.{doc['empresa_id']}", "select": "razao_social,nome_fantasia,cnpj", "limit": "1"},
            )
        if re_.status_code == 200 and re_.json():
            e = re_.json()[0]
            empresa_nome = e.get("razao_social") or e.get("nome_fantasia") or ""
            empresa_cnpj = e.get("cnpj") or ""

    # 5. Gera manifesto
    assinado_em_str = assinatura.get("assinado_em") or doc.get("assinado_em")
    try:
        assinado_em_utc = datetime.fromisoformat(assinado_em_str.replace("Z", "+00:00"))
    except Exception:
        assinado_em_utc = datetime.now(timezone.utc)

    manifesto_pdf_bytes = _pdf_manifesto(
        titulo_doc=doc.get("titulo", ""),
        signatario_nome=signatario_nome,
        signatario_cpf=signatario_cpf,
        empresa_signatario=empresa_nome,
        empresa_signatario_cnpj=empresa_cnpj,
        assinatura_png_data_uri=assinatura["png"],
        selfie_jpg_bytes=selfie_bytes,
        doc_jpg_bytes=doc_bytes,
        assinado_em_utc=assinado_em_utc,
        ip_user_agent=assinatura.get("ip_user_agent", ""),
        doc_hash=doc_hash,
        doc_id=doc_id,
    )

    # 6. Merge contrato + manifesto
    writer = PdfWriter()
    for pdf in (contrato_pdf_bytes, manifesto_pdf_bytes):
        reader = PdfReader(io.BytesIO(pdf))
        for page in reader.pages:
            writer.add_page(page)
    out = io.BytesIO()
    writer.write(out)
    final_pdf = out.getvalue()

    # 7. Upload
    storage_path = f"pdf-final/{doc_id}.pdf"
    await _sb_storage_upload(storage_path, final_pdf, "application/pdf")

    # 8. Atualiza row com path
    await _sb_patch_doc(doc_id, {"storage_path_pdf": f"{BUCKET}/{storage_path}"})

    # 9. Avisa admins Parket via WhatsApp — Will pediu ver a assinatura no RH
    try:
        pdf_url_signed = await _gerar_signed_url(storage_path, 7 * 24 * 3600)  # 7 dias
        cpf_masked = f"{signatario_cpf[:3]}.{signatario_cpf[3:6]}.{signatario_cpf[6:9]}-{signatario_cpf[9:]}" if len(signatario_cpf) == 11 else signatario_cpf
        msg = (
            f"✅ *Contrato assinado!*\n\n"
            f"📄 {doc.get('titulo','')}\n"
            f"👤 {signatario_nome}\n"
            f"🆔 CPF {cpf_masked}\n"
            f"🕐 {assinado_em_utc.astimezone(BR_TZ).strftime('%d/%m/%Y %H:%M')}\n\n"
            f"📎 PDF assinado (7 dias): {pdf_url_signed}"
        )
        for phone in WA_ADMINS_PARKET:
            await _wa_send(phone, msg)
    except Exception as e:
        # Aviso é best-effort — se falhar não bloqueia o PDF
        pass

    return {"ok": True, "storage_path": f"{BUCKET}/{storage_path}", "pages": len(PdfReader(io.BytesIO(final_pdf)).pages)}


async def _gerar_signed_url(obj_path: str, ttl_seconds: int) -> str:
    """Gera signed URL do storage pra download temporário."""
    async with httpx.AsyncClient(timeout=15) as c:
        r = await c.post(
            f"{SUPA_URL}/storage/v1/object/sign/{BUCKET}/{obj_path}",
            headers={"apikey": SUPA_KEY, "Authorization": f"Bearer {SUPA_KEY}", "Content-Type": "application/json"},
            json={"expiresIn": ttl_seconds},
        )
    if r.status_code >= 400:
        return ""
    signed = r.json().get("signedURL") or r.json().get("signedUrl") or ""
    if signed.startswith("/"):
        return f"{SUPA_URL}/storage/v1{signed}"
    return signed


async def _wa_send(phone_e164: str, message: str) -> None:
    """Manda WhatsApp via Evolution API — instância RH."""
    if not phone_e164 or len(phone_e164) < 12:
        return
    async with httpx.AsyncClient(timeout=10) as c:
        await c.post(
            f"{EVOLUTION_URL}/message/sendText/{EVOLUTION_INSTANCE}",
            headers={"apikey": EVOLUTION_KEY, "Content-Type": "application/json"},
            json={"number": phone_e164, "text": message},
        )


@router.get("/{doc_id}/pdf-final-url")
async def pdf_final_signed_url(doc_id: str, ttl_seconds: int = 3600):
    """Gera URL assinada pro admin baixar o PDF final. Requer service key."""
    doc = await _sb_get_doc(doc_id)
    path = doc.get("storage_path_pdf")
    if not path:
        raise HTTPException(404, "PDF final não gerado ainda")
    # remove prefixo "rh-documentos/"
    obj_path = path.split("/", 1)[1] if "/" in path else path
    async with httpx.AsyncClient(timeout=15) as c:
        r = await c.post(
            f"{SUPA_URL}/storage/v1/object/sign/{BUCKET}/{obj_path}",
            headers={"apikey": SUPA_KEY, "Authorization": f"Bearer {SUPA_KEY}", "Content-Type": "application/json"},
            json={"expiresIn": ttl_seconds},
        )
    if r.status_code >= 400:
        raise HTTPException(r.status_code, f"Sign URL: {r.text[:200]}")
    signed = r.json().get("signedURL") or r.json().get("signedUrl")
    return {"url": f"{SUPA_URL}/storage/v1{signed}" if signed and signed.startswith("/") else signed}
