"""Token do chat entre setores (parket-chat) pro widget do projetos.

Por que existe: o widget (`server.parket.works/app.js`) só monta se achar
um token — ele varre o localStorage atrás do access_token do Supabase e,
se não achar, lê `sessionStorage["pk-chat-token"]`. Sem token ele não
renderiza NADA (nem o balão). O projetos.parket.works não usa Supabase:
tem login próprio contra `user_profiles` (dept_permissions._senha), e
guarda o usuário só no state do React. Resultado: o chat nunca aparecia
aqui, ao contrário do valor/compras que têm sessão Supabase.

O que fazemos: assinamos o mesmo JWT HS256 que o parket-chat emite,
payload `{id: <user_profiles.id>}`, com o JWT_SECRET do serviço
`parket-chat_chat`. O chat resolve o usuário com `repository.getUser(id)`
lendo a MESMA `public.user_profiles` do mesmo Postgres (parket-pg-local),
então o id do nosso login bate direto, sem cadastro paralelo.
"""
import base64
import hashlib
import hmac
import json
import time

from .settings import settings


def _b64u(raw: bytes) -> str:
    """base64url sem padding, como manda o JWT."""
    return base64.urlsafe_b64encode(raw).rstrip(b"=").decode()


def _seg(obj: dict) -> str:
    return _b64u(json.dumps(obj, separators=(",", ":")).encode())


def mint(user_id: str, ttl_days: int = 30) -> str:
    """Assina o JWT HS256 do chat pro user_id dado.

    Retorna string vazia quando não há segredo configurado (dev local) ou
    não há usuário — o frontend nesse caso simplesmente não injeta nada e
    o widget continua invisível, sem quebrar o app.
    """
    segredo = settings.chat_jwt_secret
    if not segredo or not user_id:
        return ""
    agora = int(time.time())
    cabecalho = _seg({"alg": "HS256", "typ": "JWT"})
    # `aud`/`role` = "authenticated" imitam o access_token do Supabase; o
    # servidor do chat só olha `id`, mas o widget valida esses campos nos
    # tokens que acha sozinho e assim o formato fica idêntico nos dois casos.
    corpo = _seg({
        "id": str(user_id),
        "sub": str(user_id),
        "aud": "authenticated",
        "role": "authenticated",
        "iat": agora,
        "exp": agora + ttl_days * 86400,
    })
    assinado = f"{cabecalho}.{corpo}".encode()
    assinatura = _b64u(hmac.new(segredo.encode(), assinado, hashlib.sha256).digest())
    return f"{cabecalho}.{corpo}.{assinatura}"
