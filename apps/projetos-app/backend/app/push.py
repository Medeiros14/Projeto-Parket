"""Web Push (VAPID) — subscribe/unsubscribe do browser + watcher que dispara
push quando aparece coisa nova do fiscal ou aditivo desde a última varredura.

Fica no mesmo processo do FastAPI (thread de background). Se não tiver VAPID
configurado, o watcher pula silenciosamente — chips do kanban seguem funcionando."""
from __future__ import annotations
import json
import logging
import threading
import time
from typing import Optional

from datetime import timedelta

import httpx
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from pywebpush import webpush, WebPushException

from .auth import require_user
from .db import conn
from .settings import settings

log = logging.getLogger("projetos.push")
router = APIRouter()


class PushKeys(BaseModel):
    p256dh: str
    auth: str


class PushSubBody(BaseModel):
    endpoint: str
    keys: PushKeys


class PushUnsubBody(BaseModel):
    endpoint: str


@router.get("/api/push/public-key")
def push_public_key():
    """Chave pública VAPID pro browser fazer subscribe."""
    return {"key": settings.vapid_public_key or None}


@router.post("/api/push/subscribe")
def push_subscribe(body: PushSubBody, user: dict = Depends(require_user)):
    if not settings.vapid_private_key:
        raise HTTPException(503, "web-push não configurado")
    with conn() as c, c.cursor() as cur:
        cur.execute("""
            INSERT INTO trello_projetos.push_subs (user_id, endpoint, keys_p256dh, keys_auth)
            VALUES (%s, %s, %s, %s)
            ON CONFLICT (endpoint) DO UPDATE
              SET user_id     = EXCLUDED.user_id,
                  keys_p256dh = EXCLUDED.keys_p256dh,
                  keys_auth   = EXCLUDED.keys_auth,
                  last_seen_at = now()
        """, (user["id"], body.endpoint, body.keys.p256dh, body.keys.auth))
    return {"ok": True}


@router.post("/api/push/unsubscribe")
def push_unsubscribe(body: PushUnsubBody, user: dict = Depends(require_user)):
    with conn() as c, c.cursor() as cur:
        cur.execute("DELETE FROM trello_projetos.push_subs WHERE endpoint = %s AND user_id = %s",
                    (body.endpoint, user["id"]))
    return {"ok": True}


@router.post("/api/push/test")
def push_test(user: dict = Depends(require_user)):
    """Dispara notificação de teste pra todos os endpoints deste user."""
    _send_to_user(user["id"], {
        "title": "Parket Projetos",
        "body": "Notificações estão ativas 🎉",
        "url": "/",
        "tag": "test",
    })
    return {"ok": True}


# ─── envio ────────────────────────────────────────────────────────

def _send_one(row: dict, payload: dict) -> bool:
    """Envia um push. Retorna True se rolou, False se subscription morreu (410/404)."""
    try:
        webpush(
            subscription_info={
                "endpoint": row["endpoint"],
                "keys": {"p256dh": row["keys_p256dh"], "auth": row["keys_auth"]},
            },
            data=json.dumps(payload),
            vapid_private_key=settings.vapid_private_key,
            vapid_claims={"sub": settings.vapid_subject},
            ttl=60 * 60,
        )
        return True
    except WebPushException as e:
        code = getattr(getattr(e, "response", None), "status_code", None)
        if code in (404, 410):
            return False  # subscription morta → apaga
        log.warning("push falhou (%s): %s", code, e)
        return True  # deixa a sub viva (pode ter sido erro temporário)
    except Exception as e:
        log.warning("push exception: %s", e)
        return True


def _send_to_user(user_id: str, payload: dict) -> None:
    with conn() as c, c.cursor() as cur:
        cur.execute("SELECT id, endpoint, keys_p256dh, keys_auth "
                    "FROM trello_projetos.push_subs WHERE user_id = %s", (user_id,))
        subs = cur.fetchall()
        mortos: list[int] = []
        for s in subs:
            if not _send_one(s, payload):
                mortos.append(s["id"])
        if mortos:
            cur.execute("DELETE FROM trello_projetos.push_subs WHERE id = ANY(%s)", (mortos,))


# ─── watcher ─────────────────────────────────────────────────────

_lock = threading.Lock()


def _aditivos_novos_desde(iso_since: str) -> list[dict]:
    """Consulta view aditivos_v no Cloud filtrando por created_at > since."""
    if not settings.supabase_key:
        return []
    try:
        r = httpx.get(
            f"{settings.supabase_url}/rest/v1/aditivos_v",
            params={"select": "id,card_id,numero,cliente,status,created_at",
                    "created_at": f"gt.{iso_since}", "limit": "200",
                    "order": "created_at.asc"},
            headers={"apikey": settings.supabase_key,
                     "Authorization": f"Bearer {settings.supabase_key}"},
            timeout=10,
        )
        r.raise_for_status()
        return r.json() or []
    except Exception as e:
        log.warning("watcher aditivos falhou: %s", e)
        return []


def _fiscal_novos_desde(cur, iso_since: str) -> list[dict]:
    """Laudos+vistorias+fotos+acompanhamento criados/atualizados após `iso_since`.
    Retorna dict {tipo, card_id (space_uuid), quando, resumo}."""
    out: list[dict] = []
    cur.execute("""
        SELECT card_id, tipo, fiscal_nome, created_at
          FROM public.fiscal_laudos
         WHERE created_at > %s
         ORDER BY created_at ASC LIMIT 100
    """, (iso_since,))
    for r in cur.fetchall():
        out.append({"origem": "laudo", "card_id": r["card_id"],
                    "quando": r["created_at"],
                    "resumo": f"Novo laudo {r.get('tipo') or ''} por {r.get('fiscal_nome') or '—'}"})
    cur.execute("""
        SELECT card_id, tipo, created_at
          FROM public.fiscal_agenda
         WHERE created_at > %s
         ORDER BY created_at ASC LIMIT 100
    """, (iso_since,))
    for r in cur.fetchall():
        out.append({"origem": "vistoria", "card_id": r["card_id"],
                    "quando": r["created_at"],
                    "resumo": f"Vistoria {r.get('tipo') or ''} agendada/atualizada"})
    cur.execute("""
        SELECT card_id, ambiente, tipo, created_at
          FROM public.fiscal_fotos
         WHERE created_at > %s
         ORDER BY created_at ASC LIMIT 100
    """, (iso_since,))
    for r in cur.fetchall():
        out.append({"origem": "foto", "card_id": r["card_id"],
                    "quando": r["created_at"],
                    "resumo": f"Nova foto {r.get('ambiente') or ''} {r.get('tipo') or ''}"})
    return out


def _card_meta(cur, space_id: str) -> Optional[dict]:
    """Devolve o card_id local (Trello) + nome + projetista_id a partir do space_id."""
    cur.execute("""
        SELECT id AS trello_id, nome, projetista_id
          FROM trello_projetos.cards
         WHERE space_card_id = %s AND NOT closed
        LIMIT 1
    """, (space_id,))
    return cur.fetchone()


def _users_pra_avisar(cur, card: dict) -> list[str]:
    """Quem recebe o push desse card:
       - projetista delegado (se tiver);
       - todo usuário com push_sub cadastrado (assume: quem ativou o sino
         quer receber tudo — gestora/admin da equipe de projetos).
       Um subscriber que não é o projetista só recebe se não tiver ninguém
       delegado (evita spam pra quem não é dono do card)."""
    ids: set[str] = set()
    delegado = str(card.get("projetista_id") or "")
    if delegado:
        ids.add(delegado)
        return list(ids)
    cur.execute("SELECT DISTINCT user_id FROM trello_projetos.push_subs")
    for r in cur.fetchall():
        ids.add(str(r["user_id"]))
    return list(ids)


def _watch_loop():
    if not (settings.vapid_private_key and settings.vapid_public_key):
        log.info("push watcher desligado (VAPID keys ausentes)")
        return
    log.info("push watcher: ativo (intervalo %ss)", settings.push_watcher_interval_s)
    time.sleep(20)  # evita disparo na hora do boot enquanto a app termina de subir
    while True:
        try:
            with _lock:
                _tick()
        except Exception as e:
            log.exception("push watcher tick falhou: %s", e)
        time.sleep(max(15, settings.push_watcher_interval_s))


def _lembretes_calendar(cur) -> None:
    """Dispara push pra cada evento cujo lembrete cai na janela [agora, agora+70s].
    Idempotente via calendar_reminders_sent (unique por evento/user/offset/ocorrência)."""
    cur.execute("""
        SELECT id, user_id, autor_nome, title, dt_start, cor, convidados,
               tipo, link_chamada, lembretes, local, responsavel_id
          FROM trello_projetos.calendar_events
         WHERE lembretes IS NOT NULL AND jsonb_array_length(lembretes) > 0
           AND dt_start > now() - interval '1 day'
           AND dt_start < now() + interval '2 days'
    """)
    eventos = cur.fetchall()
    if not eventos:
        return
    for ev in eventos:
        try:
            dt_s = ev["dt_start"]
            for offset_min in (ev.get("lembretes") or []):
                if not isinstance(offset_min, (int, float)):
                    continue
                gatilho = dt_s - timedelta(minutes=int(offset_min))
                from datetime import datetime as _dt
                agora = _dt.now(gatilho.tzinfo) if gatilho.tzinfo else _dt.utcnow()
                delta_s = (gatilho - agora).total_seconds()
                if not (-70 <= delta_s <= 70):
                    continue
                # Destinatários: autor + responsável + convidados
                destinatarios: set[str] = {str(ev["user_id"])}
                if ev.get("responsavel_id"):
                    destinatarios.add(str(ev["responsavel_id"]))
                emails = [str(e).lower() for e in (ev.get("convidados") or [])]
                if emails:
                    cur.execute("SELECT id FROM user_profiles "
                                "WHERE lower(email) = ANY(%s) AND ativo = true", (emails,))
                    for r in cur.fetchall():
                        destinatarios.add(str(r["id"]))
                prefix = {"chamada": "◆ Chamada", "tarefa": "◆ Tarefa"}.get(
                    ev.get("tipo") or "evento", "◆ Lembrete")
                mins_txt = "agora" if offset_min <= 0 else \
                    (f"em {int(offset_min)} min" if offset_min < 60 else
                     f"em {int(offset_min)//60}h" if offset_min < 1440 else
                     f"em {int(offset_min)//1440}d")
                corpo = ev["title"]
                if ev.get("local"): corpo += f" — {ev['local']}"
                payload = {
                    "title": f"{prefix} {mins_txt}",
                    "body":  corpo,
                    "url":   ev.get("link_chamada") or f"/#/calendario?ev={ev['id']}",
                    "tag":   f"cal-{ev['id']}-{int(offset_min)}",
                }
                for uid in destinatarios:
                    cur.execute("""
                        INSERT INTO trello_projetos.calendar_reminders_sent
                          (event_id, user_id, offset_min, occurrence)
                        VALUES (%s, %s, %s, %s) ON CONFLICT DO NOTHING
                        RETURNING event_id
                    """, (ev["id"], uid, int(offset_min), dt_s))
                    if cur.fetchone():
                        _send_to_user(uid, payload)
        except Exception as e:
            log.warning("lembrete falhou (ev %s): %s", ev.get("id"), e)


def _tick() -> None:
    with conn() as c, c.cursor() as cur:
        # Lembretes de calendário — checagem por janela, não depende de last_run
        try: _lembretes_calendar(cur)
        except Exception as e: log.warning("lembretes_calendar: %s", e)

        cur.execute("SELECT last_run FROM trello_projetos.notif_watch_state WHERE id = 1")
        row = cur.fetchone()
        last_run = (row or {}).get("last_run")
        if last_run is None:
            cur.execute("UPDATE trello_projetos.notif_watch_state SET last_run = now() WHERE id = 1")
            return
        iso_since = last_run.isoformat()

        # Fiscal
        eventos = _fiscal_novos_desde(cur, iso_since)
        # Aditivo
        for a in _aditivos_novos_desde(iso_since):
            eventos.append({
                "origem": "aditivo",
                "card_id": a.get("card_id"),
                "quando": a.get("created_at"),
                "resumo": f"Novo aditivo #{a.get('numero') or '—'} ({a.get('status') or 'rascunho'})",
            })

        # Agrega por card+origem: evita 10 pushes do mesmo card em 1 tick.
        chave = {}
        for ev in eventos:
            if not ev.get("card_id"):
                continue
            k = (str(ev["card_id"]), ev["origem"])
            chave.setdefault(k, []).append(ev)

        for (space_id, origem), lista in chave.items():
            card = _card_meta(cur, space_id)
            if not card:
                continue
            titulo = "◆ FISCAL NOVO" if origem in ("laudo", "vistoria", "foto") else "◆ NOVO ADITIVO"
            corpo = f"{card['nome']} — {lista[0]['resumo']}"
            if len(lista) > 1:
                corpo += f" (+{len(lista) - 1})"
            payload = {
                "title": titulo,
                "body":  corpo,
                "url":   f"/?card={card['trello_id']}",
                "tag":   f"{origem}-{card['trello_id']}",
            }
            for uid in _users_pra_avisar(cur, card):
                _send_to_user(uid, payload)

        cur.execute("UPDATE trello_projetos.notif_watch_state SET last_run = now() WHERE id = 1")


def start_watcher() -> None:
    threading.Thread(target=_watch_loop, daemon=True, name="push-watcher").start()
