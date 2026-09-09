"""RH — Holerites.

Fluxo:
  1. RH faz upload de PDF lote (1 holerite por página) + competencia (ex: '2026-05')
  2. Backend salva PDF lote no bucket rh-holerites/lotes/
  3. Backend extrai texto de cada página, busca CPF via regex
  4. Pra cada página identificada: separa PDF dessa página, salva no bucket,
     cria registro em rh.holerites vinculado ao contrato ativo do colaborador
  5. Páginas não identificadas viram log em rh.holerites_lotes.log_processamento

Endpoints:
  POST /api/holerites/upload-lote     — upload PDF lote + competência
  GET  /api/holerites/lotes           — lista lotes processados
  GET  /api/holerites/lotes/{id}      — detalhe + log
  GET  /api/holerites/colaborador/{id}— lista do colaborador
  GET  /api/holerites/{id}/pdf        — proxy seguro pro PDF individual
"""
from __future__ import annotations

import io
import re
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

import httpx
from fastapi import APIRouter, File, Form, HTTPException, Query, UploadFile
from fastapi.responses import Response
from pypdf import PdfReader, PdfWriter

from app.config import settings


router = APIRouter(prefix="/api/holerites", tags=["rh-holerites"])

SUPA_URL = settings.SUPABASE_URL
SUPA_KEY = settings.SUPABASE_SERVICE_KEY
BUCKET = "rh-holerites"


# ─────────────── Supabase helpers (mesmo padrão clicksign) ───────────────

def _h(extra: Optional[Dict] = None, schema: Optional[str] = None) -> Dict:
    h = {"apikey": SUPA_KEY, "Authorization": f"Bearer {SUPA_KEY}", "Content-Type": "application/json"}
    if schema:
        h["Accept-Profile"] = schema
        h["Content-Profile"] = schema
    if extra:
        h.update(extra)
    return h


async def _sb_get(table: str, params: Dict, schema: str = "public") -> List[Dict]:
    async with httpx.AsyncClient(timeout=30) as c:
        r = await c.get(f"{SUPA_URL}/rest/v1/{table}", headers=_h(schema=schema), params=params)
    if r.status_code >= 400:
        raise HTTPException(r.status_code, f"Supabase GET {table}: {r.text[:300]}")
    return r.json() or []


async def _sb_insert(table: str, payload: Any, schema: str = "public") -> List[Dict]:
    async with httpx.AsyncClient(timeout=30) as c:
        r = await c.post(f"{SUPA_URL}/rest/v1/{table}",
                          headers=_h({"Prefer": "return=representation"}, schema=schema),
                          json=payload)
    if r.status_code >= 400:
        raise HTTPException(r.status_code, f"Supabase INSERT {table}: {r.text[:300]}")
    return r.json() or []


async def _sb_patch(table: str, params: Dict, payload: Dict, schema: str = "public") -> List[Dict]:
    async with httpx.AsyncClient(timeout=30) as c:
        r = await c.patch(f"{SUPA_URL}/rest/v1/{table}",
                           headers=_h({"Prefer": "return=representation"}, schema=schema),
                           params=params, json=payload)
    if r.status_code >= 400:
        raise HTTPException(r.status_code, f"Supabase PATCH {table}: {r.text[:300]}")
    return r.json() or []


async def _sb_storage_upload(path: str, content: bytes, content_type: str = "application/pdf") -> str:
    async with httpx.AsyncClient(timeout=60) as c:
        r = await c.post(f"{SUPA_URL}/storage/v1/object/{BUCKET}/{path}",
                          headers={"apikey": SUPA_KEY, "Authorization": f"Bearer {SUPA_KEY}",
                                   "Content-Type": content_type, "x-upsert": "true"},
                          content=content)
    if r.status_code >= 400 and "already exists" not in r.text.lower():
        raise HTTPException(r.status_code, f"Storage: {r.text[:200]}")
    return f"{BUCKET}/{path}"


# ─────────────── Utils ───────────────

_CPF_RE = re.compile(r"(\d{3})[.\s]?(\d{3})[.\s]?(\d{3})[\-\s]?(\d{2})")
_MATRICULA_RE = re.compile(r"(?:matr[ií]cula|mat\.?)\s*[:\-]?\s*(\d{1,8})", re.I)


def _clean_cpf(s: str) -> str:
    return re.sub(r"\D", "", s or "")


def _extract_cpfs(text: str) -> List[str]:
    """Retorna lista de CPFs encontrados no texto (já validados em 11 dígitos)."""
    out = []
    for m in _CPF_RE.finditer(text):
        cpf = m.group(1) + m.group(2) + m.group(3) + m.group(4)
        if cpf not in out and len(cpf) == 11:
            out.append(cpf)
    return out


def _competencia_partes(comp: str) -> tuple[int, int]:
    """'2026-05' → (2026, 5)"""
    m = re.match(r"(\d{4})[-/](\d{1,2})", comp.strip())
    if not m:
        raise ValueError(f"competência inválida: {comp}. Use AAAA-MM")
    return int(m.group(1)), int(m.group(2))


# ─────────────── Endpoints ───────────────

@router.post("/upload-lote")
async def upload_lote(
    pdf: UploadFile = File(...),
    competencia: str = Form(...),
    tipo: str = Form("mensal"),
    empresa_id: Optional[str] = Form(None),
    titulo: Optional[str] = Form(None),
):
    """
    Upload de PDF lote (1 holerite por página).
    Splita por página, extrai CPF, gera 1 holerite por página identificada.
    """
    if not pdf.content_type or "pdf" not in pdf.content_type.lower():
        raise HTTPException(400, "Arquivo precisa ser PDF")
    pdf_bytes = await pdf.read()
    if len(pdf_bytes) > 50 * 1024 * 1024:
        raise HTTPException(400, "PDF excede 50MB")
    try:
        ano, mes = _competencia_partes(competencia)
    except ValueError as e:
        raise HTTPException(400, str(e))

    # 1. Pega/cria competencia
    comp_params = {"competencia": f"eq.{competencia}", "tipo": f"eq.{tipo}", "select": "id,empresa_id"}
    if empresa_id:
        comp_params["empresa_id"] = f"eq.{empresa_id}"
    comps = await _sb_get("competencias", comp_params, schema="rh")
    if not comps:
        comp_payload = {"competencia": competencia, "tipo": tipo, "status": "aberta"}
        if empresa_id:
            comp_payload["empresa_id"] = empresa_id
        comps = await _sb_insert("competencias", comp_payload, schema="rh")
    competencia_id = comps[0]["id"]

    # 2. Salva PDF lote inteiro no bucket
    lote_id = str(uuid.uuid4())
    lote_path = f"lotes/{ano}/{mes:02d}/{lote_id}.pdf"
    await _sb_storage_upload(lote_path, pdf_bytes)

    # 3. Cria registro do lote (status: processando)
    lote_payload = {
        "id": lote_id,
        "competencia_id": competencia_id,
        "storage_path": lote_path,
        "status": "processando",
        "total_paginas": 0,
        "total_distribuidos": 0,
        "total_falha": 0,
    }
    await _sb_insert("holerites_lotes", lote_payload, schema="rh")

    # 4. Splita PDF em páginas, extrai CPF, processa
    reader = PdfReader(io.BytesIO(pdf_bytes))
    total_pag = len(reader.pages)
    distribuidos = 0
    falhas = []
    sucessos = []

    for idx, pagina in enumerate(reader.pages, start=1):
        try:
            texto = pagina.extract_text() or ""
        except Exception:
            texto = ""

        cpfs = _extract_cpfs(texto)
        if not cpfs:
            falhas.append({"pagina": idx, "motivo": "CPF não encontrado no texto"})
            continue

        cpf = cpfs[0]
        # Busca colaborador pelo CPF
        colabs_q = {
            "cpf": f"eq.{cpf}",
            "deleted_at": "is.null",
            "select": "id,nome",
            "limit": "1",
        }
        colabs = await _sb_get("colaboradores", colabs_q, schema="rh")
        if not colabs:
            # CPF pode estar formatado diferente no banco — tenta sem máscara
            colabs_alt = await _sb_get("colaboradores", {
                "cpf": f"in.({cpf},{cpf[:3]}.{cpf[3:6]}.{cpf[6:9]}-{cpf[9:]})",
                "deleted_at": "is.null", "select": "id,nome", "limit": "1",
            }, schema="rh")
            colabs = colabs_alt

        if not colabs:
            falhas.append({"pagina": idx, "motivo": f"CPF {cpf} não bate com colaborador"})
            continue

        colab = colabs[0]
        # Busca contrato ativo do colaborador
        contr_q = {
            "colaborador_id": f"eq.{colab['id']}",
            "deleted_at": "is.null",
            "select": "id,empresa_id",
            "order": "data_admissao.desc",
            "limit": "1",
        }
        contratos = await _sb_get("contratos", contr_q, schema="rh")
        if not contratos:
            falhas.append({"pagina": idx, "motivo": f"{colab['nome']} (CPF {cpf}) sem contrato"})
            continue
        contrato_id = contratos[0]["id"]

        # Splita a página em PDF isolado
        writer = PdfWriter()
        writer.add_page(pagina)
        buf = io.BytesIO()
        writer.write(buf)
        pdf_pagina_bytes = buf.getvalue()

        # Path: ANO/MES/contrato/uuid.pdf
        page_uuid = str(uuid.uuid4())
        pag_path = f"{ano}/{mes:02d}/{contrato_id}/{page_uuid}.pdf"
        await _sb_storage_upload(pag_path, pdf_pagina_bytes)

        # Cria registro holerite
        h_payload = {
            "contrato_id": contrato_id,
            "competencia_id": competencia_id,
            "lote_id": lote_id,
            "storage_path": pag_path,
            "pagina_no_lote": idx,
            "cpf_match": cpf,
        }
        try:
            await _sb_insert("holerites", h_payload, schema="rh")
            sucessos.append({"pagina": idx, "colab_id": colab["id"], "nome": colab["nome"], "cpf": cpf})
            distribuidos += 1
        except HTTPException as e:
            falhas.append({"pagina": idx, "motivo": f"DB error: {str(e.detail)[:100]}"})

    # 5. Atualiza lote com resultado
    await _sb_patch("holerites_lotes", {"id": f"eq.{lote_id}"}, {
        "total_paginas": total_pag,
        "total_distribuidos": distribuidos,
        "total_falha": len(falhas),
        "status": "concluido" if distribuidos > 0 else "falhou",
        "log_processamento": {
            "sucessos": sucessos,
            "falhas": falhas,
            "titulo": titulo or f"Holerites {competencia}",
            "processado_em": datetime.now(timezone.utc).isoformat(),
        },
    }, schema="rh")

    return {
        "ok": True,
        "lote_id": lote_id,
        "competencia_id": competencia_id,
        "total_paginas": total_pag,
        "distribuidos": distribuidos,
        "falhas": len(falhas),
        "sucessos": sucessos[:10],  # amostra
        "falhas_detalhe": falhas[:20],
    }


@router.get("/lotes")
async def listar_lotes(limit: int = Query(50, le=200)):
    rows = await _sb_get("holerites_lotes", {
        "select": "id,competencia_id,storage_path,total_paginas,total_distribuidos,total_falha,status,created_at,log_processamento",
        "order": "created_at.desc",
        "limit": str(limit),
    }, schema="rh")
    return {"items": rows}


@router.get("/lotes/{lote_id}")
async def detalhe_lote(lote_id: str):
    rows = await _sb_get("holerites_lotes", {
        "id": f"eq.{lote_id}",
        "select": "*",
    }, schema="rh")
    if not rows:
        raise HTTPException(404, "Lote não encontrado")
    return rows[0]


@router.get("/colaborador/{colab_id}")
async def por_colaborador(colab_id: str):
    """Lista holerites do colaborador (via contratos)."""
    contratos = await _sb_get("contratos", {
        "colaborador_id": f"eq.{colab_id}",
        "deleted_at": "is.null",
        "select": "id",
    }, schema="rh")
    if not contratos:
        return {"items": []}
    cids = ",".join(c["id"] for c in contratos)
    holerites = await _sb_get("holerites", {
        "contrato_id": f"in.({cids})",
        "select": "id,storage_path,pagina_no_lote,cpf_match,liquido,total_proventos,total_descontos,visualizado_em,created_at,competencia_id,lote_id",
        "order": "created_at.desc",
    }, schema="rh")
    # Resolve competencias
    if holerites:
        comp_ids = list({h["competencia_id"] for h in holerites if h.get("competencia_id")})
        if comp_ids:
            comps = await _sb_get("competencias", {
                "id": f"in.({','.join(comp_ids)})",
                "select": "id,competencia,tipo,status",
            }, schema="rh")
            cmap = {c["id"]: c for c in comps}
            for h in holerites:
                h["competencia"] = cmap.get(h.get("competencia_id"), {})
    return {"items": holerites}


@router.get("/{holerite_id}/pdf")
async def baixar_holerite(holerite_id: str):
    rows = await _sb_get("holerites", {
        "id": f"eq.{holerite_id}",
        "select": "storage_path",
    }, schema="rh")
    if not rows:
        raise HTTPException(404, "Holerite não encontrado")
    path = rows[0].get("storage_path")
    if not path:
        raise HTTPException(404, "Arquivo não disponível")

    async with httpx.AsyncClient(timeout=60) as c:
        r = await c.get(f"{SUPA_URL}/storage/v1/object/{BUCKET}/{path}",
                         headers={"apikey": SUPA_KEY, "Authorization": f"Bearer {SUPA_KEY}"})
    if r.status_code >= 400:
        raise HTTPException(500, f"Storage: {r.text[:200]}")

    # Marca visualizado
    try:
        await _sb_patch("holerites", {"id": f"eq.{holerite_id}"},
                         {"visualizado_em": datetime.now(timezone.utc).isoformat()}, schema="rh")
    except Exception:
        pass

    return Response(content=r.content, media_type="application/pdf",
                     headers={"Content-Disposition": f'inline; filename="holerite-{holerite_id[:8]}.pdf"'})
