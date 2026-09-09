"""hb_drive.py — Drive do cliente pro Homebroker (PKT-HB-DRIVE-20260902B).

Por que existe: TODO documento do HB vai pro Google Drive do cliente, nunca
mais pro Supabase Storage (arquivos de arquitetura passam de 150MB e o bucket
nao aguenta). O navegador do vendedor NAO tem conta Google; quem tem poder de
escrita e o sistemas@parket.com.br, cujo OAuth token so pode viver no servidor.

Como funciona (padrao "sessao resumable assinada"):
  1. o frontend chama /upload-session com o JWT do login do HB;
  2. este backend valida o JWT no GoTrue (api.parket.works), pega o token do
     sistemas@ via Apps Script get_upload_token (secret em docker secret) e
     ABRE a sessao resumable na Drive API v3 encaminhando o header Origin do
     navegador (o Google grava a origem na sessao e libera CORS nos PUTs);
  3. devolve so a URL da sessao: ela e a credencial, escopada aquele unico
     arquivo, e expira em ~1 semana. O token do sistemas@ NUNCA sai daqui;
  4. o navegador faz PUT do arquivo direto pro Google, qualquer tamanho.

Tambem serve list/criar pasta pro modo fallback do painel "Drive do cliente"
(substitui as actions list_folder/create_subfolder do Apps Script v2.2, que
nao precisa mais ser publicado).

Upsert por nome: mesmo comportamento do backfill (scripts/migrar-anexos-
grandes.py do parket-homebroker) — arquivo de mesmo nome normalizado na pasta
vira update (mesmo file_id, o Drive guarda historico de versoes).
"""
import json
import logging
import os
import time
import unicodedata
import urllib.parse

import httpx
from fastapi import APIRouter, Header, HTTPException, Request
from pydantic import BaseModel

log = logging.getLogger("gestao.hb_drive")

router = APIRouter(prefix="/api/hb-drive", tags=["hb-drive"])

# /exec do Apps Script "Parket Drive Bot" (roda como sistemas@; v2.1+).
DRIVE_SCRIPT_URL = (
    "https://script.google.com/macros/s/"
    "AKfycbz07KaMoECR5EemL9UyGT8SZfOpYiJDKir7qQzOyRDPu8XZzvXfBq8ZdSSMMel_qRrg/exec"
)

# GoTrue onde o vendedor do HB loga (gateway local; ver feedback_auth_gotrue).
HB_AUTH_URL = os.getenv("HB_AUTH_URL", "https://api.parket.works")
# Anon key e publica (esta no bundle do HB); serve so de apikey pro GoTrue.
HB_AUTH_ANON = os.getenv("HB_AUTH_ANON", (
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imhi"
    "eHBpbHJ4bWl0dnplYmx1b29tIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI5NDI1MjcsImV4cCI6"
    "MjA4ODUxODUyN30.ciZA1H-UvlYG2OPWqrFChj-_ttiFD5W5BmrST-gUJ-0"
))

# Secret que destrava o get_upload_token no Apps Script (docker secret;
# a copia no host vive em /root/.compras-watcher/drive_token_secret).
TOKEN_SECRET_FILE = os.getenv("DRIVE_TOKEN_SECRET_FILE", "/run/secrets/drive_token_secret")

DRIVE_API = "https://www.googleapis.com/drive/v3"
FOLDER_MIME = "application/vnd.google-apps.folder"


# ── Auth do caller (vendedor logado no HB) ──────────────────────────────
# Cache de JWTs ja validados pra nao bater no GoTrue a cada listagem do
# painel. TTL curto: revogacao de sessao demora no maximo isso pra valer.
_jwt_ok: dict[str, float] = {}
_JWT_TTL = 300  # 5 min


def _exigir_login(authorization: str | None) -> None:
    """Valida o Bearer JWT do HB contra o GoTrue. 401 se invalido/ausente."""
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(401, "sem token de login do HB")
    tok = authorization.split(" ", 1)[1].strip()
    now = time.time()
    if _jwt_ok.get(tok, 0) > now:
        return
    try:
        r = httpx.get(
            f"{HB_AUTH_URL}/auth/v1/user",
            headers={"Authorization": f"Bearer {tok}", "apikey": HB_AUTH_ANON},
            timeout=15,
        )
    except Exception as e:
        raise HTTPException(502, f"GoTrue indisponivel: {e}")
    if r.status_code != 200:
        raise HTTPException(401, "login invalido ou expirado")
    # Limpa entradas velhas junto (dict pequeno, custo zero).
    for k in [k for k, v in _jwt_ok.items() if v <= now]:
        _jwt_ok.pop(k, None)
    _jwt_ok[tok] = now + _JWT_TTL


# ── Token OAuth do sistemas@ (via Apps Script, cache ~45min) ────────────
_tok_cache: dict = {"token": None, "exp": 0.0}


def _drive_post(payload: dict) -> dict:
    """POST text/plain no Apps Script (evita preflight; segue o 302)."""
    r = httpx.post(
        DRIVE_SCRIPT_URL,
        content=json.dumps(payload),
        headers={"Content-Type": "text/plain;charset=utf-8"},
        timeout=60,
        follow_redirects=True,
    )
    r.raise_for_status()
    data = r.json()
    if not data or data.get("success") is not True:
        raise HTTPException(502, f"Apps Script: {data.get('error') if data else 'resposta vazia'}")
    return data


def _drive_token() -> str:
    """Token OAuth do sistemas@ (valido ~1h no Google; cacheado 45min)."""
    now = time.time()
    if _tok_cache["token"] and _tok_cache["exp"] > now:
        return _tok_cache["token"]
    try:
        secret = open(TOKEN_SECRET_FILE).read().strip()
    except OSError:
        raise HTTPException(500, "drive_token_secret nao montado no servico")
    data = _drive_post({"action": "get_upload_token", "secret": secret})
    _tok_cache["token"] = data["token"]
    _tok_cache["exp"] = now + 45 * 60
    return data["token"]


def _gapi(path: str, method: str = "GET", body: dict | None = None,
          extra_headers: dict | None = None) -> httpx.Response:
    """Chamada crua na Drive API v3 com o token do sistemas@."""
    headers = {"Authorization": f"Bearer {_drive_token()}"}
    if extra_headers:
        headers.update(extra_headers)
    r = httpx.request(method, f"{DRIVE_API}/{path}", json=body,
                      headers=headers, timeout=60)
    if r.status_code == 401:
        # Token do cache pode ter morrido antes da hora: renova 1x e repete.
        _tok_cache["exp"] = 0
        headers["Authorization"] = f"Bearer {_drive_token()}"
        r = httpx.request(method, f"{DRIVE_API}/{path}", json=body,
                          headers=headers, timeout=60)
    if r.status_code >= 400:
        raise HTTPException(502, f"Drive API {r.status_code}: {r.text[:300]}")
    return r


def _normalizar(nome: str) -> str:
    """Mesma normalizacao do Apps Script: sem acento, minusculo, 1 espaco."""
    s = unicodedata.normalize("NFD", str(nome or ""))
    s = "".join(ch for ch in s if not unicodedata.combining(ch))
    return " ".join(s.split()).lower()


def _achar_por_nome(folder_id: str, nome: str, so_pasta: bool = False) -> str | None:
    """Procura filho com o mesmo nome normalizado (base do upsert/dedup)."""
    q = urllib.parse.quote(f"'{folder_id}' in parents and trashed=false")
    r = _gapi(f"files?q={q}&fields=files(id,name,mimeType)&pageSize=1000"
              "&supportsAllDrives=true&includeItemsFromAllDrives=true&corpora=allDrives")
    alvo = _normalizar(nome)
    for f in r.json().get("files", []):
        if so_pasta and f.get("mimeType") != FOLDER_MIME:
            continue
        if _normalizar(f["name"]) == alvo:
            return f["id"]
    return None


# ── Endpoints ───────────────────────────────────────────────────────────

class EnsureFolderIn(BaseModel):
    client_name: str


@router.post("/ensure-folder")
def ensure_folder(inp: EnsureFolderIn, authorization: str | None = Header(default=None)):
    """Pasta do cliente em Home Broker/<CLIENTE> (proxy do ensure_hb_folder,
    que ja trata reuso em Projetos e desarquivamento do _Arquivo)."""
    _exigir_login(authorization)
    if not inp.client_name.strip():
        raise HTTPException(422, "client_name vazio")
    d = _drive_post({"action": "ensure_hb_folder", "client_name": inp.client_name.strip()})
    return {"folder_id": d["folder_id"], "folder_url": d.get("folder_url"),
            "origem": d.get("origem")}


@router.get("/list")
def list_folder(folder_id: str, authorization: str | None = Header(default=None)):
    """Lista pastas+arquivos de uma pasta (painel Drive do cliente)."""
    _exigir_login(authorization)
    q = urllib.parse.quote(f"'{folder_id}' in parents and trashed=false")
    r = _gapi(
        f"files?q={q}"
        "&fields=files(id,name,mimeType,size,modifiedTime,webViewLink)"
        "&pageSize=1000&orderBy=folder,name"
        "&supportsAllDrives=true&includeItemsFromAllDrives=true&corpora=allDrives"
    )
    files = [{
        "id": f["id"], "name": f["name"], "mime_type": f.get("mimeType", ""),
        "is_folder": f.get("mimeType") == FOLDER_MIME,
        "size": int(f.get("size") or 0), "modified": f.get("modifiedTime", ""),
        "url": f.get("webViewLink", ""),
    } for f in r.json().get("files", [])]
    return {"files": files}


class FolderIn(BaseModel):
    parent_id: str
    name: str


@router.post("/folder")
def create_folder(inp: FolderIn, authorization: str | None = Header(default=None)):
    """Cria subpasta (ou reusa existente de mesmo nome, dedup)."""
    _exigir_login(authorization)
    nome = inp.name.strip()
    if not nome:
        raise HTTPException(422, "name vazio")
    fid = _achar_por_nome(inp.parent_id, nome, so_pasta=True)
    if not fid:
        r = _gapi("files?supportsAllDrives=true", method="POST", body={
            "name": nome, "parents": [inp.parent_id], "mimeType": FOLDER_MIME,
        })
        fid = r.json()["id"]
    return {"folder_id": fid, "folder_name": nome,
            "folder_url": f"https://drive.google.com/drive/folders/{fid}"}


class SessionIn(BaseModel):
    folder_id: str
    filename: str
    mime_type: str = "application/octet-stream"
    size: int


@router.post("/upload-session")
def upload_session(inp: SessionIn, request: Request,
                   authorization: str | None = Header(default=None)):
    """Abre sessao resumable na Drive API e devolve a URL pro navegador subir
    o arquivo direto (PUT), sem teto de tamanho. Upsert por nome: se ja tem
    arquivo igual na pasta, a sessao atualiza o conteudo (mesmo file_id)."""
    _exigir_login(authorization)
    nome = inp.filename.strip()
    if not nome or not inp.folder_id.strip():
        raise HTTPException(422, "filename/folder_id obrigatorios")

    existente = _achar_por_nome(inp.folder_id, nome)
    if existente:
        url = (f"https://www.googleapis.com/upload/drive/v3/files/{existente}"
               "?uploadType=resumable&supportsAllDrives=true")
        meta, metodo = {}, "PATCH"
    else:
        url = ("https://www.googleapis.com/upload/drive/v3/files"
               "?uploadType=resumable&supportsAllDrives=true")
        meta = {"name": nome, "parents": [inp.folder_id], "mimeType": inp.mime_type}
        metodo = "POST"

    headers = {
        "Authorization": f"Bearer {_drive_token()}",
        "X-Upload-Content-Type": inp.mime_type,
        "X-Upload-Content-Length": str(inp.size),
    }
    # O Google so libera CORS nos PUTs da sessao pra origem gravada na
    # abertura: encaminhar o Origin do navegador e OBRIGATORIO aqui.
    origin = request.headers.get("origin")
    if origin:
        headers["Origin"] = origin

    r = httpx.request(metodo, url, json=meta, headers=headers, timeout=60)
    if r.status_code >= 400:
        raise HTTPException(502, f"sessao resumable {r.status_code}: {r.text[:300]}")
    sessao = r.headers.get("Location")
    if not sessao:
        raise HTTPException(502, "sessao resumable sem header Location")
    return {"session_url": sessao, "updated": bool(existente),
            "file_id": existente}
