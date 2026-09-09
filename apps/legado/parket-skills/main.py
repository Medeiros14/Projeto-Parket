"""Parket Skills — Plataforma de apresentação interativa do Space Parket.

Roteamento:
  /                       → home (hero + grid 11 setores)
  /setor/<slug>           → apresentação do setor
  /admin                  → editor (apenas admins)
  /tutorial/<slug>        → tutorial avulso (compat com URLs antigas)

API:
  GET  /api/setores                     → lista os 11 setores (tipo='setor')
  GET  /api/setor/<slug>                → setor + features filhas
  GET  /api/tutoriais                   → tutoriais avulsos
  GET  /api/item/<id>                   → detalhe (qualquer tipo)
  POST /api/item                        → cria
  PATCH /api/item/<id>                  → atualiza
  DELETE /api/item/<id>                 → remove
  POST /api/upload-screenshot           → upload pra Supabase Storage

Compat com endpoints antigos (mantém URLs já em uso):
  GET  /api/tutorials                   → mesma coisa que /api/tutoriais
  GET  /api/tutorial/<id>               → mesma coisa que /api/item/<id>
"""
from fastapi import FastAPI, Request, UploadFile, File, HTTPException
from fastapi.responses import HTMLResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import httpx, re, unicodedata, os, time

app = FastAPI(title="Parket Skills")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

SB_URL = "https://hbxpilrxmitvzebluoom.supabase.co"
SB_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhieHBpbHJ4bWl0dnplYmx1b29tIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3Mjk0MjUyNywiZXhwIjoyMDg4NTE4NTI3fQ.fTovVTCBFcMrrhVCR6TsneALfMRLLLHZdMmSJH16L4A"
H = {"apikey": SB_KEY, "Authorization": f"Bearer {SB_KEY}", "Content-Type": "application/json"}
STORAGE_BUCKET = "parket-skills-media"


def slugify(t):
    t = unicodedata.normalize("NFKD", t).encode("ascii", "ignore").decode()
    return re.sub(r"[-\s]+", "-", re.sub(r"[^\w\s-]", "", t.lower())).strip("-")


async def sb_get(table, params):
    async with httpx.AsyncClient(timeout=10) as c:
        r = await c.get(f"{SB_URL}/rest/v1/{table}", params=params, headers=H)
        return r.json() if r.is_success else []


async def sb_post(table, data):
    async with httpx.AsyncClient(timeout=10) as c:
        r = await c.post(f"{SB_URL}/rest/v1/{table}", json=data,
                         headers={**H, "Prefer": "return=representation"})
        return r.json() if r.is_success else {"error": r.text[:300]}


async def sb_patch(table, match, data):
    async with httpx.AsyncClient(timeout=10) as c:
        r = await c.patch(f"{SB_URL}/rest/v1/{table}", params=match, json=data,
                          headers={**H, "Prefer": "return=minimal"})
        return r.is_success


async def sb_delete(table, match):
    async with httpx.AsyncClient(timeout=10) as c:
        r = await c.delete(f"{SB_URL}/rest/v1/{table}", params=match, headers=H)
        return r.is_success


# ─── API novos ────────────────────────────────────────────────

@app.get("/api/setores")
async def list_setores():
    return await sb_get("parket_skills", {
        "tipo": "eq.setor", "publicado": "eq.true",
        "order": "ordem.asc",
        "select": "id,slug,titulo,setor,icone,cor,descricao_curta,ordem",
    })


@app.get("/api/setor/{slug}")
async def get_setor(slug: str):
    setor_rows = await sb_get("parket_skills", {
        "tipo": "eq.setor",
        "or": f"(slug.eq.setor-{slug},setor.eq.{slug})",
        "limit": "1",
    })
    if not setor_rows:
        return JSONResponse({"error": "Setor não encontrado"}, 404)
    setor = setor_rows[0]
    setor_id = setor["id"]
    features = await sb_get("parket_skills", {
        "or": f"(parent_id.eq.{setor_id},and(setor.eq.{slug},tipo.in.(feature,texto,video,imagem,misto)))",
        "publicado": "eq.true",
        "order": "ordem.asc,created_at.desc",
    })
    return {"setor": setor, "features": features}


@app.get("/api/tutoriais")
async def list_tutoriais(setor: str = ""):
    p = {
        "tipo": "in.(intro,texto,video,audio,imagem,misto)",
        "publicado": "eq.true",
        "order": "ordem.asc,created_at.desc",
        "select": "id,slug,titulo,setor,tipo,categoria,descricao,thumbnail_url,visualizacoes",
    }
    if setor:
        p["setor"] = f"eq.{setor}"
    return await sb_get("parket_skills", p)


@app.get("/api/item/{item_id}")
async def get_item(item_id: str):
    rows = await sb_get("parket_skills", {"id": f"eq.{item_id}", "select": "*"})
    if not rows:
        return JSONResponse({"error": "Não encontrado"}, 404)
    await sb_patch("parket_skills", {"id": f"eq.{item_id}"},
                   {"visualizacoes": (rows[0].get("visualizacoes") or 0) + 1})
    return rows[0]


@app.post("/api/item")
async def create_item(request: Request):
    body = await request.json()
    if body.get("titulo") and not body.get("slug"):
        body["slug"] = slugify(body["titulo"])
    return await sb_post("parket_skills", body)


@app.patch("/api/item/{item_id}")
async def update_item(item_id: str, request: Request):
    body = await request.json()
    if body.get("titulo") and not body.get("slug"):
        body["slug"] = slugify(body["titulo"])
    ok = await sb_patch("parket_skills", {"id": f"eq.{item_id}"}, body)
    return {"ok": ok}


@app.delete("/api/item/{item_id}")
async def delete_item(item_id: str):
    ok = await sb_delete("parket_skills", {"id": f"eq.{item_id}"})
    return {"ok": ok}


@app.post("/api/upload-screenshot")
async def upload_screenshot(file: UploadFile = File(...)):
    content = await file.read()
    safe_name = re.sub(r"[^A-Za-z0-9._-]", "_", file.filename or "screenshot.png")
    key = f"{int(time.time())}-{safe_name}"
    async with httpx.AsyncClient(timeout=30) as c:
        r = await c.post(
            f"{SB_URL}/storage/v1/object/{STORAGE_BUCKET}/{key}",
            content=content,
            headers={
                "Authorization": f"Bearer {SB_KEY}",
                "Content-Type": file.content_type or "application/octet-stream",
                "x-upsert": "true",
            },
        )
        if r.status_code >= 400:
            raise HTTPException(r.status_code, f"Storage: {r.text[:200]}")
    return {"url": f"{SB_URL}/storage/v1/object/public/{STORAGE_BUCKET}/{key}", "key": key}


# ─── Compat com endpoints antigos ───────────────────────────────
@app.get("/api/tutorials")
async def list_tutorials_compat(setor: str = ""):
    return await list_tutoriais(setor=setor)


@app.get("/api/tutorial/{tid}")
async def get_tutorial_compat(tid: str):
    return await get_item(tid)


@app.get("/api/tutorial-by-slug/{setor}/{slug}")
async def get_by_slug(setor: str, slug: str):
    rows = await sb_get("parket_skills", {
        "setor": f"eq.{setor}", "slug": f"eq.{slug}", "select": "*"})
    if rows:
        await sb_patch("parket_skills", {"id": f"eq.{rows[0]['id']}"},
                       {"visualizacoes": (rows[0].get("visualizacoes") or 0) + 1})
    return rows[0] if rows else {"error": "Não encontrado"}


@app.post("/api/tutorial")
async def create_tutorial_compat(request: Request):
    return await create_item(request)


@app.patch("/api/tutorial/{tid}")
async def update_tutorial_compat(tid: str, request: Request):
    return await update_item(tid, request)


@app.delete("/api/tutorial/{tid}")
async def delete_tutorial_compat(tid: str):
    return await delete_item(tid)


# ─── 404 pra /api/* não casado ──────────────────────────────────
@app.get("/api/{p:path}")
async def api_404(p: str):
    return JSONResponse({"error": "Not found"}, 404)


# ─── Static (fica antes do SPA pra Mount funcionar) ─────────────
static_dir = "/app/static"
if os.path.isdir(static_dir):
    app.mount("/static", StaticFiles(directory=static_dir), name="static")


# ─── SPA serving ────────────────────────────────────────────────
@app.get("/", response_class=HTMLResponse)
@app.get("/{p:path}", response_class=HTMLResponse)
async def spa(p: str = ""):
    return HTMLResponse(HTML)


HTML = open("/app/index.html").read() if os.path.exists("/app/index.html") else "<h1>index.html missing</h1>"

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8080)
