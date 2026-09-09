"""Resolve persona do usuário via X-User-Email — enriquece prompts do chat."""
from .db import conn


_ROLE_LABEL = {
    "superadmin": "acesso total, decisões estratégicas",
    "admin": "administrador de setor",
    "dept_leader": "líder de setor",
    "projetista": "projetista/arquiteto",
    "viewer": "leitor",
}


def get_persona(email: str | None) -> dict | None:
    if not email:
        return None
    with conn() as c, c.cursor() as cur:
        cur.execute("""
            SELECT full_name, role, funcao_comercial, dept_permissions, ativo
            FROM public.user_profiles
            WHERE lower(email) = lower(%s)
            LIMIT 1
        """, (email,))
        r = cur.fetchone()
    if not r or r.get("ativo") is False:
        return None
    depts = list((r.get("dept_permissions") or {}).keys()) if isinstance(r.get("dept_permissions"), dict) else []
    return {
        "email": email,
        "nome": r["full_name"],
        "role": r["role"],
        "role_label": _ROLE_LABEL.get(r["role"], r["role"]),
        "funcao_comercial": r.get("funcao_comercial"),
        "setores": depts,
    }


def persona_prompt(persona: dict | None) -> str:
    if not persona:
        return "Usuário anônimo (sem persona resolvida)."
    linhas = [
        f"Usuário: {persona['nome']} <{persona['email']}>",
        f"Papel: {persona['role']} ({persona['role_label']})",
    ]
    if persona.get("funcao_comercial"):
        linhas.append(f"Função comercial: {persona['funcao_comercial']}")
    if persona.get("setores"):
        linhas.append(f"Setores com acesso: {', '.join(persona['setores'])}")
    linhas.append("Ajuste tom e recorte às responsabilidades desse usuário — priorize dados dos setores dele.")
    return "\n".join(linhas)
