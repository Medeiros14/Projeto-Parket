"""Auth do projetos.parket.works.

Users vêm do Space (`public.user_profiles`) — quem cria/gerencia é o
admin do Space, aqui só validamos. Padrão da casa: senha em texto
plano em `dept_permissions._senha` (mesmo esquema usado nos outros
apps Parket — center, homebroker, etc).

Sessão via cookie httpOnly assinado (itsdangerous). Duração default
30 dias — projetistas ficam logados na estação e voltam sem re-login.

Gates:
  • gestora  = dept_permissions.projetos == 'manage'   OU role
               'admin' / 'superadmin'  (vê tudo, delega)
  • projetista = dept_permissions.projetos in {'edit', 'view'}
                 (vê só seus cards)
  • outros: 403 (não tem permissão no setor Projetos)

Especialidade (usada no dropdown de delegar pra filtrar quem faz o quê):
  dept_permissions.projetos_especialidade in {'marcenaria',
  'instalacao', 'ambos'}. Fallback: 'ambos'.
"""
import json

from fastapi import APIRouter, Depends, HTTPException, Request, Response
from itsdangerous import BadSignature, URLSafeTimedSerializer
from pydantic import BaseModel

from . import chat_token
from .db import conn
from .settings import settings

router = APIRouter()

COOKIE_NAME = "projetos_session"
_serializer = URLSafeTimedSerializer(settings.session_secret, salt="projetos.session")
_max_age_s = settings.session_max_age_days * 24 * 3600


# ─── helpers ─────────────────────────────────────────────────────────

def _parse_dp(dp) -> dict:
    """dept_permissions vem em 3 formatos históricos:
      • dict simples                          → uso direto
      • string JSON                           → parse
      • array legado ["str", {...}, {...}]    → merge TODOS os dicts
        (linhas antigas do gestão têm senha/permissões espalhadas
        em dicts diferentes do array — ex.: parketpisosbrazil)."""
    if dp is None:
        return {}
    if isinstance(dp, str):
        try: dp = json.loads(dp)
        except Exception: return {}
    if isinstance(dp, list):
        merged: dict = {}
        for x in dp:
            if isinstance(x, str):
                try: x = json.loads(x)
                except Exception: continue
            if isinstance(x, dict):
                merged.update(x)
        return merged
    if isinstance(dp, dict):
        return dp
    return {}


def _perm_flag(dp: dict, key: str) -> str:
    """dept_permissions[key] pode ser string ('edit'|'manage'|'view')
    OU dict ({'edit': true, ...}). Retorna string canônica."""
    v = dp.get(key)
    if isinstance(v, str):
        return v.lower()
    if isinstance(v, dict):
        if v.get("manage"): return "manage"
        if v.get("edit"):   return "edit"
        if v.get("view"):   return "view"
    return ""


def _perfil_projetos(row: dict) -> dict:
    """Monta o perfil que o frontend consome. is_gestora sai daqui."""
    dp = _parse_dp(row.get("dept_permissions"))
    role = (row.get("role") or "").lower()
    proj = _perm_flag(dp, "projetos")
    is_admin = role in ("admin", "superadmin")
    is_gestora = is_admin or proj == "manage"
    can_view = is_gestora or proj in ("edit", "view")
    especialidade = (dp.get("projetos_especialidade") or "ambos").lower()
    if especialidade not in ("marcenaria", "instalacao", "ambos"):
        especialidade = "ambos"
    return {
        "id": str(row["id"]),
        "email": row.get("email") or "",
        "nome": row.get("full_name") or "",
        "role": role,
        "avatar_color": row.get("avatar_color") or "#D4A853",
        "ativo": row.get("ativo") is not False,
        "papel": "gestora" if is_gestora else ("projetista" if proj else ""),
        "is_gestora": is_gestora,
        "especialidade": especialidade,
        "can_view": can_view,
    }


def _load_user(cur, user_id: str) -> dict | None:
    cur.execute("""
        SELECT id, email, full_name, role, dept_permissions, avatar_color, ativo
          FROM public.user_profiles
         WHERE id = %s
    """, (user_id,))
    r = cur.fetchone()
    return _perfil_projetos(r) if r else None


def _load_user_by_email(cur, email: str) -> dict | None:
    cur.execute("""
        SELECT id, email, full_name, role, dept_permissions, avatar_color, ativo
          FROM public.user_profiles
         WHERE lower(email) = lower(%s)
         LIMIT 1
    """, (email,))
    r = cur.fetchone()
    if not r:
        return None
    dp = _parse_dp(r.get("dept_permissions"))
    perfil = _perfil_projetos(r)
    perfil["_senha_esperada"] = dp.get("_senha") or ""
    return perfil


# ─── dependency (proteção de rota) ────────────────────────────────────

def _cookie_user_id(request: Request) -> str | None:
    tok = request.cookies.get(COOKIE_NAME)
    if not tok:
        return None
    try:
        data = _serializer.loads(tok, max_age=_max_age_s)
        return data.get("uid")
    except BadSignature:
        return None
    except Exception:
        return None


def require_user(request: Request) -> dict:
    uid = _cookie_user_id(request)
    if not uid:
        raise HTTPException(401, "não autenticado")
    with conn() as c, c.cursor() as cur:
        u = _load_user(cur, uid)
    if not u or not u["ativo"]:
        raise HTTPException(401, "sessão inválida ou usuário desativado")
    if not u["can_view"]:
        raise HTTPException(403,
            "sem permissão no setor Projetos (dept_permissions.projetos ausente)")
    return u


def require_gestora(request: Request) -> dict:
    u = require_user(request)
    if not u["is_gestora"]:
        raise HTTPException(403, "só a gestora do setor pode fazer isso")
    return u


def current_user_optional(request: Request) -> dict | None:
    """Não falha se não autenticado — só retorna None. Usado no
    /api/board pra decidir filtro sem exigir login em ambientes de
    dev (mas em prod o require_user está antes)."""
    try:
        return require_user(request)
    except HTTPException:
        return None


# ─── endpoints ───────────────────────────────────────────────────────

class LoginBody(BaseModel):
    email: str
    senha: str


@router.post("/api/auth/login")
def login(body: LoginBody, response: Response):
    """Valida email+senha contra user_profiles. Cria cookie de sessão."""
    email = (body.email or "").strip()
    senha = (body.senha or "")
    if not email or not senha:
        raise HTTPException(400, "email e senha obrigatórios")

    with conn() as c, c.cursor() as cur:
        u = _load_user_by_email(cur, email)

    if not u:
        raise HTTPException(401, "email não cadastrado")
    if not u["ativo"]:
        raise HTTPException(401, "usuário desativado — contate o admin do Space")
    if not u["can_view"]:
        raise HTTPException(403,
            "sem acesso ao setor Projetos — peça pro admin liberar "
            "dept_permissions.projetos")

    esperada = (u.get("_senha_esperada") or "").strip()
    if not esperada:
        raise HTTPException(401,
            "senha não configurada no perfil — peça pro admin definir "
            "dept_permissions._senha")
    if senha != esperada:
        raise HTTPException(401, "senha incorreta")

    tok = _serializer.dumps({"uid": u["id"]})
    response.set_cookie(
        COOKIE_NAME, tok,
        max_age=_max_age_s, httponly=True, secure=True, samesite="lax",
        path="/",
    )
    u.pop("_senha_esperada", None)
    # chat_token: credencial do widget do chat entre setores. Vai junto do
    # login porque o projetos não tem sessão Supabase pro widget achar sozinho.
    u["chat_token"] = chat_token.mint(u["id"])
    return {"ok": True, "usuario": u}


@router.post("/api/auth/logout")
def logout(response: Response):
    response.delete_cookie(COOKIE_NAME, path="/")
    return {"ok": True}


@router.get("/api/auth/me")
def me(user: dict = Depends(require_user)):
    # Reemite o chat_token a cada retomada de sessão (o cookie dura 30 dias e
    # o sessionStorage do widget morre ao fechar a aba).
    return {**user, "chat_token": chat_token.mint(user["id"])}


# ─── lista de projetistas (pro dropdown de Delegar) ──────────────────

@router.get("/api/projetistas")
def listar_projetistas(user: dict = Depends(require_user)):
    """Lista os projetistas do setor Projetos (dept_permissions.projetos
    setado). Exclui role admin/superadmin — essas contas veem tudo pelo
    role, mas NÃO aparecem no dropdown de Delegar (admin = conta do dev,
    não é projetista)."""
    with conn() as c, c.cursor() as cur:
        cur.execute("""
            SELECT id, email, full_name, role, dept_permissions,
                   avatar_color, ativo
              FROM public.user_profiles
             WHERE ativo = true
               AND (dept_permissions ->> 'projetos') IS NOT NULL
               AND role NOT IN ('admin','superadmin')
             ORDER BY full_name
        """)
        rows = cur.fetchall()
    out = []
    for r in rows:
        p = _perfil_projetos(r)
        if p["can_view"]:
            out.append({
                "id": p["id"], "email": p["email"], "nome": p["nome"],
                "avatar_color": p["avatar_color"], "papel": p["papel"],
                "especialidade": p["especialidade"],
            })
    return {"projetistas": out}
