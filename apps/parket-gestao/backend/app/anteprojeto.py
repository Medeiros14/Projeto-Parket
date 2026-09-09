"""Anteprojeto (F5) — ponte gestão ↔ Draw + publicação no Center.

Fluxo na sub-aba Projetos › Anteprojeto:
  1) GET  /api/projetos/{pid}/anteprojeto/pranchas → pranchas ANTEPROJETO
     já geradas no Draw pro card do projeto (links de PDF + editor)
  2) POST /api/projetos/{pid}/anteprojeto/gerar    → Draw gera a prancha A1
  3) POST /api/projetos/{pid}/anteprojeto/publicar → baixa o PDF do Draw,
     rasteriza páginas em JPG 200dpi, sobe pro bucket obra-media e insere
     gestao.documentos (codigo 10) — aparece na sub-aba E no Center, na aba
     Anteprojeto (etapa_numero vem do catalogo; hoje 11).
"""
from __future__ import annotations

import io
import json
import logging
import os
import time
import uuid

import httpx
from fastapi import APIRouter, Header, HTTPException
from pydantic import BaseModel

from .db import conn

log = logging.getLogger("gestao.anteprojeto")

router = APIRouter(prefix="/api/projetos", tags=["anteprojeto"])

DRAW_API = os.environ.get("DRAW_API_URL", "https://draw.parket.works")
SUPABASE_URL = os.environ.get("SUPABASE_URL", "https://hbxpilrxmitvzebluoom.supabase.co")
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_KEY", "")
BUCKET = "obra-media"
CODIGO_ANTEPROJETO = "10"
# etapa do Center vem do catalogo (passo 10 = Anteprojeto = etapa 11 desde a
# migracao 007); fixar 7 aqui jogava o anteprojeto na aba Projeto Executivo.
ETAPA_CENTER_FALLBACK = 11


def _projeto(pid: str) -> dict:
    with conn() as c, c.cursor() as cur:
        cur.execute(
            "SELECT id::text AS id, card_id::text AS card_id, cliente "
            "FROM gestao.projetos WHERE id::text = %s", (pid,))
        row = cur.fetchone()
    if not row:
        raise HTTPException(404, "projeto não encontrado")
    return row


def _links(item: dict) -> dict:
    item["pdf_url"] = f"{DRAW_API}/api/wood/pranchas/{item['id']}/render_pdf"
    item["editor_url"] = f"{DRAW_API}/wood/projeto/{item['project_id']}"
    return item


@router.get("/{pid}/anteprojeto/pranchas")
async def anteprojeto_pranchas(pid: str):
    proj = _projeto(pid)
    if not proj.get("card_id"):
        return {"card_id": None, "items": []}
    async with httpx.AsyncClient(timeout=30.0) as cli:
        r = await cli.get(f"{DRAW_API}/api/wood/anteprojeto/pranchas/{proj['card_id']}")
    if r.status_code >= 400:
        raise HTTPException(502, f"Draw: {r.text[:300]}")
    return {"card_id": proj["card_id"],
            "items": [_links(i) for i in r.json().get("items") or []]}


@router.post("/{pid}/anteprojeto/gerar")
async def anteprojeto_gerar(pid: str, x_user_email: str | None = Header(default=None)):
    proj = _projeto(pid)
    if not proj.get("card_id"):
        raise HTTPException(409, "Projeto sem card vinculado (gestao.projetos.card_id)")
    async with httpx.AsyncClient(timeout=240.0) as cli:
        r = await cli.post(f"{DRAW_API}/api/wood/anteprojeto/from-card/{proj['card_id']}")
    if r.status_code >= 400:
        raise HTTPException(502, f"Draw: {r.text[:300]}")
    out = r.json()
    out["pdf_url"] = f"{DRAW_API}/api/wood/pranchas/{out['prancha_id']}/render_pdf"
    out["editor_url"] = f"{DRAW_API}/wood/projeto/{out['project_id']}/pranchas"
    for p in out.get("pranchas") or []:
        p["pdf_url"] = f"{DRAW_API}/api/wood/pranchas/{p['prancha_id']}/render_pdf"
        p["editor_url"] = out["editor_url"]
    with conn() as c, c.cursor() as cur:
        cur.execute("""
            INSERT INTO gestao.eventos (projeto_id, tipo, titulo, autor_email, payload)
            VALUES (%s, 'documento', 'Anteprojeto gerado no Draw', %s, %s::jsonb)
        """, (pid, x_user_email, json.dumps({"prancha_id": out.get("prancha_id"),
                                             "servicos": out.get("servicos"),
                                             "itens": out.get("itens")})))
    return out


@router.delete("/{pid}/anteprojeto/pranchas/{prancha_id}")
async def anteprojeto_excluir(pid: str, prancha_id: str,
                              x_user_email: str | None = Header(default=None)):
    proj = _projeto(pid)
    async with httpx.AsyncClient(timeout=30.0) as cli:
        r = await cli.delete(f"{DRAW_API}/api/wood/pranchas/{prancha_id}")
    if r.status_code >= 400:
        raise HTTPException(502, f"Draw: {r.text[:300]}")
    with conn() as c, c.cursor() as cur:
        cur.execute("""
            INSERT INTO gestao.eventos (projeto_id, tipo, titulo, autor_email, payload)
            VALUES (%s, 'documento', 'Anteprojeto excluído no Draw', %s, %s::jsonb)
        """, (pid, x_user_email, json.dumps({"prancha_id": prancha_id,
                                             "card_id": proj.get("card_id")})))
    return {"ok": True}


class PublicarBody(BaseModel):
    prancha_id: str
    titulo: str | None = None


def _upload(cli: httpx.Client, path: str, data: bytes, content_type: str) -> str:
    r = cli.post(f"{SUPABASE_URL}/storage/v1/object/{BUCKET}/{path}",
                 content=data,
                 headers={"apikey": SUPABASE_KEY,
                          "Authorization": f"Bearer {SUPABASE_KEY}",
                          "Content-Type": content_type, "x-upsert": "true"})
    if r.status_code >= 400:
        raise HTTPException(502, f"storage upload falhou: {r.text[:300]}")
    return f"{SUPABASE_URL}/storage/v1/object/public/{BUCKET}/{path}"


@router.post("/{pid}/anteprojeto/publicar")
async def anteprojeto_publicar(pid: str, body: PublicarBody,
                               x_user_email: str | None = Header(default=None)):
    if not SUPABASE_KEY:
        raise HTTPException(500, "SUPABASE_SERVICE_KEY não configurada")
    proj = _projeto(pid)
    servico = ""
    async with httpx.AsyncClient(timeout=300.0) as cli:
        if proj.get("card_id"):
            try:
                rl = await cli.get(
                    f"{DRAW_API}/api/wood/anteprojeto/pranchas/{proj['card_id']}")
                pr = next((i for i in (rl.json().get("items") or [])
                           if i.get("id") == body.prancha_id), None)
                servico = ((pr or {}).get("meta") or {}).get("disciplina") or ""
            except Exception:
                servico = ""
        r = await cli.get(f"{DRAW_API}/api/wood/pranchas/{body.prancha_id}/render_pdf")
    if r.status_code >= 400:
        raise HTTPException(502, f"Draw render_pdf: {r.text[:300]}")
    pdf = r.content

    import fitz
    from PIL import Image
    doc_uuid = str(uuid.uuid4())
    sufixo = f"_{servico.upper().replace('-', ' ')}" if servico else ""
    titulo = (body.titulo
              or f"{proj.get('cliente') or 'PROJETO'}_ANTEPROJETO{sufixo}").strip()
    slugname = "".join(ch if ch.isalnum() else "_" for ch in titulo.lower()).strip("_")
    base = f"gestao/{pid}/docs/{CODIGO_ANTEPROJETO}"

    paginas = []
    with httpx.Client(timeout=120.0) as st:
        pdf_path = f"{base}/pdf/{int(time.time() * 1000)}_{slugname}.pdf"
        pdf_url = _upload(st, pdf_path, pdf, "application/pdf")
        d = fitz.open(stream=pdf, filetype="pdf")
        for i, page in enumerate(d, 1):
            pix = page.get_pixmap(dpi=200)
            img = Image.frombytes("RGB", (pix.width, pix.height), pix.samples)
            buf = io.BytesIO()
            img.save(buf, "JPEG", quality=85, optimize=True)
            url = _upload(st, f"{base}/paginas/{doc_uuid}/page_{i:02d}.jpg",
                          buf.getvalue(), "image/jpeg")
            paginas.append({"n": i, "url": url})

    with conn() as c, c.cursor() as cur:
        cur.execute("SELECT id, etapa_numero FROM gestao.documentos_catalogo "
                    "WHERE codigo = %s", (CODIGO_ANTEPROJETO,))
        cat = cur.fetchone() or {}
        etapa = cat.get("etapa_numero") or ETAPA_CENTER_FALLBACK
        cur.execute("""
            INSERT INTO gestao.documentos (projeto_id, catalogo_id, etapa_numero, slug,
                                           titulo, arquivo_url, storage_path, content_type,
                                           nome_arquivo, tamanho_bytes, gerado_por, meta)
            VALUES (%s, %s, %s, %s, %s, %s, %s, 'application/pdf', %s, %s, 'anteprojeto', %s::jsonb)
            RETURNING *
        """, (pid, cat.get("id"), etapa, CODIGO_ANTEPROJETO, titulo,
              pdf_url, pdf_path, f"{slugname}.pdf", len(pdf),
              json.dumps({"paginas": paginas, "prancha_id": body.prancha_id,
                          "card_id": proj.get("card_id")})))
        row = cur.fetchone()
        cur.execute("""
            INSERT INTO gestao.eventos (projeto_id, tipo, titulo, autor_email, payload)
            VALUES (%s, 'documento', %s, %s, %s::jsonb)
        """, (pid, f"Anteprojeto publicado no Center: {titulo}", x_user_email,
              json.dumps({"prancha_id": body.prancha_id, "url": pdf_url,
                          "paginas": len(paginas)})))
    log.info("anteprojeto_publicado pid=%s prancha=%s paginas=%d por=%s",
             pid, body.prancha_id, len(paginas), x_user_email)
    return row
