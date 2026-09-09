"""Calendário interno estilo Google Calendar (v2).

Recursos:
  - Tipos: evento | chamada | tarefa
  - Local (texto livre)
  - Videochamada com link auto-gerado (Jitsi público — sem cadastro)
  - Lembretes múltiplos (minutos antes → dispara push)
  - Recorrência RRULE simplificada (DAILY/WEEKLY/MONTHLY + COUNT/UNTIL)
  - Convites internos por email + RSVP (sim/não/talvez)
"""
from __future__ import annotations
import json
import re
import uuid
from typing import Optional, Literal
from datetime import datetime, timedelta, timezone
from calendar import monthrange

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from .auth import require_user
from .db import conn
from . import push as push_mod

router = APIRouter()

TipoEvento = Literal["evento", "chamada", "tarefa"]
RSVPStatus = Literal["sim", "nao", "talvez"]


class EventoIn(BaseModel):
    title:           str
    descr:           Optional[str] = ""
    dt_start:        str                             # ISO-8601
    dt_end:          Optional[str] = None
    all_day:         bool = False
    cor:             str = "#3B82F6"
    convidados:      list[str] = Field(default_factory=list)  # emails
    card_id:         Optional[str] = None
    local:           Optional[str] = ""
    tipo:            TipoEvento = "evento"
    link_chamada:    Optional[str] = None
    lembretes:       list[int] = Field(default_factory=lambda: [10])   # min antes
    rrule:           Optional[str] = None
    responsavel_id:  Optional[str] = None   # uuid do projetista (só gestora seta)


class EventoPatch(BaseModel):
    title:           Optional[str] = None
    descr:           Optional[str] = None
    dt_start:        Optional[str] = None
    dt_end:          Optional[str] = None
    all_day:         Optional[bool] = None
    cor:             Optional[str] = None
    convidados:      Optional[list[str]] = None
    card_id:         Optional[str] = None
    local:           Optional[str] = None
    tipo:            Optional[TipoEvento] = None
    link_chamada:    Optional[str] = None
    lembretes:       Optional[list[int]] = None
    rrule:           Optional[str] = None
    responsavel_id:  Optional[str] = None


class RSVPIn(BaseModel):
    status: RSVPStatus


def _ser(r: dict, ocorrencia: Optional[datetime] = None) -> dict:
    """Serializa evento. Se `ocorrencia` for passada, sobrescreve dt_start/dt_end
    pra devolver a instância expandida da recorrência."""
    dt_s = r["dt_start"]
    dt_e = r.get("dt_end")
    if ocorrencia is not None and r.get("dt_start"):
        delta = (dt_e - dt_s) if dt_e else None
        dt_s = ocorrencia
        dt_e = (ocorrencia + delta) if delta else None
    return {
        "id":               r["id"],
        "user_id":          str(r["user_id"]),
        "autor_nome":       r["autor_nome"],
        "autor_email":      r.get("autor_email"),
        "title":            r["title"],
        "descr":            r.get("descr"),
        "dt_start":         dt_s.isoformat() if dt_s else None,
        "dt_end":           dt_e.isoformat() if dt_e else None,
        "all_day":          bool(r.get("all_day")),
        "cor":              r["cor"],
        "convidados":       r.get("convidados") or [],
        "card_id":          r.get("card_id"),
        "local":            r.get("local"),
        "tipo":             r.get("tipo") or "evento",
        "link_chamada":     r.get("link_chamada"),
        "lembretes":        r.get("lembretes") or [],
        "rrule":            r.get("rrule"),
        "rsvp":             r.get("rsvp") or {},
        "responsavel_id":   str(r["responsavel_id"]) if r.get("responsavel_id") else None,
        "responsavel_nome": r.get("responsavel_nome"),
        "recorrente":       bool(r.get("rrule")),
        "created_at":       r["created_at"].isoformat() if r.get("created_at") else None,
        "updated_at":       r["updated_at"].isoformat() if r.get("updated_at") else None,
    }


def _parse_rrule(rr: str) -> dict:
    """RRULE minúscula: 'FREQ=WEEKLY;COUNT=10' ou 'FREQ=DAILY;UNTIL=20260101'."""
    out: dict = {}
    for part in (rr or "").split(";"):
        if "=" in part:
            k, v = part.split("=", 1)
            out[k.strip().upper()] = v.strip()
    return out


def _add_recorrencia(base: datetime, freq: str, n: int) -> datetime:
    if freq == "DAILY":
        return base + timedelta(days=n)
    if freq == "WEEKLY":
        return base + timedelta(weeks=n)
    if freq == "MONTHLY":
        # Soma n meses preservando o dia (clampa no último dia do mês).
        m0 = base.month - 1 + n
        y = base.year + m0 // 12
        m = m0 % 12 + 1
        d = min(base.day, monthrange(y, m)[1])
        return base.replace(year=y, month=m, day=d)
    if freq == "YEARLY":
        try:
            return base.replace(year=base.year + n)
        except ValueError:      # 29/fev em ano não-bissexto
            return base.replace(year=base.year + n, day=28)
    return base


def _expand(r: dict, ini: datetime, fim: datetime) -> list[dict]:
    """Expande um evento (possivelmente recorrente) nas ocorrências dentro
    de [ini, fim]. Sem RRULE = devolve 1 ocorrência (a base)."""
    if not r.get("rrule"):
        return [_ser(r)]
    rr = _parse_rrule(r["rrule"])
    freq = rr.get("FREQ", "").upper()
    if freq not in ("DAILY", "WEEKLY", "MONTHLY", "YEARLY"):
        return [_ser(r)]
    count = int(rr["COUNT"]) if rr.get("COUNT", "").isdigit() else None
    until: Optional[datetime] = None
    if rr.get("UNTIL"):
        try:
            u = rr["UNTIL"]
            until = datetime.fromisoformat(u.replace("Z", "+00:00")) if "T" in u \
                else datetime.strptime(u, "%Y%m%d").replace(tzinfo=timezone.utc)
        except Exception:
            until = None
    out: list[dict] = []
    base: datetime = r["dt_start"]
    n = 0
    hard_limit = 500
    while n < hard_limit:
        oc = _add_recorrencia(base, freq, n)
        if count is not None and n >= count:
            break
        if until is not None and oc > until:
            break
        if oc > fim:
            break
        if oc >= ini or (r.get("dt_end") and (oc + (r["dt_end"] - base)) >= ini):
            out.append(_ser(r, ocorrencia=oc))
        n += 1
    return out


def _uids_por_emails(cur, emails: list[str]) -> list[str]:
    if not emails:
        return []
    cur.execute("SELECT id FROM user_profiles WHERE lower(email) = ANY(%s) AND ativo = true",
                ([e.lower() for e in emails],))
    return [str(r["id"]) for r in cur.fetchall()]


def _push_convite(cur, evento: dict, remetente_nome: str) -> None:
    emails = evento.get("convidados") or []
    if not emails:
        return
    quando = evento["dt_start"][:16].replace("T", " ") if evento.get("dt_start") else ""
    prefix = {"chamada": "◆ Chamada", "tarefa": "◆ Tarefa"}.get(
        evento.get("tipo") or "evento", "◆ Convite")
    payload = {
        "title": f"{prefix}: {evento['title']}",
        "body":  f"{remetente_nome} te convidou pra {quando}",
        "url":   f"/#/calendario?ev={evento['id']}",
        "tag":   f"convite-{evento['id']}",
    }
    for uid in _uids_por_emails(cur, emails):
        push_mod._send_to_user(uid, payload)


def _autolink_chamada(body_tipo: str, atual: Optional[str]) -> Optional[str]:
    """Placeholder: não gera link automático. Usuário abre Google Meet manualmente
    (botão no modal), cria a sala e cola o link — se quiser."""
    return atual


def _resolve_responsavel(cur, uid: Optional[str]) -> tuple[Optional[str], Optional[str]]:
    """UUID → (uuid, nome). Retorna (None, None) se vazio/invalido."""
    if not uid or not str(uid).strip():
        return (None, None)
    try:
        cur.execute("SELECT id, full_name FROM user_profiles "
                    "WHERE id = %s::uuid AND ativo = true", (str(uid).strip(),))
    except Exception:
        return (None, None)
    r = cur.fetchone()
    if not r:
        return (None, None)
    return (str(r["id"]), r.get("full_name"))


def _push_delegacao(ev: dict, remetente_nome: str) -> None:
    """Avisa o responsável que foi delegado."""
    resp_uid = ev.get("responsavel_id")
    if not resp_uid:
        return
    quando = ev["dt_start"][:16].replace("T", " ") if ev.get("dt_start") else ""
    prefix = {"chamada": "◆ Chamada", "tarefa": "◆ Tarefa delegada"}.get(
        ev.get("tipo") or "evento", "◆ Delegado")
    payload = {
        "title": f"{prefix}: {ev['title']}",
        "body":  f"{remetente_nome} delegou pra você — {quando}",
        "url":   f"/#/calendario?ev={ev['id']}",
        "tag":   f"delegado-{ev['id']}",
    }
    push_mod._send_to_user(resp_uid, payload)


@router.get("/api/calendar/events")
def listar(from_: Optional[str] = None, to: Optional[str] = None,
           q: Optional[str] = None,
           user: dict = Depends(require_user)):
    """Eventos entre `from` e `to` (ISO). Filtro `q` busca em title/descr/local.
    Retorna eventos criados pelo user OU onde ele foi convidado; expandindo
    recorrências dentro da janela."""
    with conn() as c, c.cursor() as cur:
        # Gestora/admin vê a agenda de todo mundo. Projetista comum só o que lhe diz respeito.
        if user["is_gestora"]:
            sql = "SELECT * FROM trello_projetos.calendar_events WHERE TRUE"
        else:
            sql = """
                SELECT * FROM trello_projetos.calendar_events
                 WHERE (user_id = %(uid)s
                        OR responsavel_id = %(uid)s
                        OR (convidados)::jsonb ? %(email)s)
            """
        args: dict = {"uid": user["id"], "email": user["email"]}
        # Nota: eventos recorrentes ficam com dt_start no início — pega tudo com rrule
        # OU dentro da janela. A expansão descarta os que caem fora.
        if from_ and to:
            # Aceita se o início OU o fim caem na janela (defende contra dt_end < dt_start)
            sql += (" AND (rrule IS NOT NULL"
                    " OR (dt_start >= %(fro)s AND dt_start < %(to)s)"
                    " OR (dt_end   >= %(fro)s AND dt_end   < %(to)s))")
            args["fro"], args["to"] = from_, to
        if q:
            sql += " AND (lower(title) LIKE %(q)s OR lower(coalesce(descr,'')) LIKE %(q)s OR lower(coalesce(local,'')) LIKE %(q)s)"
            args["q"] = f"%{q.lower()}%"
        sql += " ORDER BY dt_start ASC LIMIT 500"
        cur.execute(sql, args)
        rows = cur.fetchall()

    if not (from_ and to):
        return {"eventos": [_ser(r) for r in rows]}

    try:
        ini = datetime.fromisoformat(from_.replace("Z", "+00:00"))
        fim = datetime.fromisoformat(to.replace("Z", "+00:00"))
    except Exception:
        return {"eventos": [_ser(r) for r in rows]}
    out: list[dict] = []
    for r in rows:
        out.extend(_expand(r, ini, fim))
    out.sort(key=lambda e: e.get("dt_start") or "")
    return {"eventos": out}


@router.post("/api/calendar/events")
def criar(body: EventoIn, user: dict = Depends(require_user)):
    if not body.title.strip():
        raise HTTPException(400, "título obrigatório")
    try:
        dt_s = datetime.fromisoformat(body.dt_start.replace("Z", "+00:00"))
    except Exception:
        raise HTTPException(400, "dt_start inválido (use ISO-8601)")
    # dt_end inválido/anterior ao início vira NULL
    if body.dt_end:
        try:
            dt_e = datetime.fromisoformat(body.dt_end.replace("Z", "+00:00"))
            if dt_e <= dt_s:
                body.dt_end = None
        except Exception:
            body.dt_end = None
    link = _autolink_chamada(body.tipo, body.link_chamada)
    # Só gestora/admin pode delegar pra terceiros. Projetista comum ignora o campo.
    resp_id_pedido = body.responsavel_id
    if resp_id_pedido and not user["is_gestora"] and resp_id_pedido != user["id"]:
        resp_id_pedido = None
    with conn() as c, c.cursor() as cur:
        resp_id, resp_nome = _resolve_responsavel(cur, resp_id_pedido)
        cur.execute("""
            INSERT INTO trello_projetos.calendar_events
              (user_id, autor_nome, autor_email, title, descr,
               dt_start, dt_end, all_day, cor, convidados, card_id,
               local, tipo, link_chamada, lembretes, rrule,
               responsavel_id, responsavel_nome)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s::jsonb, %s,
                    %s, %s, %s, %s::jsonb, %s, %s, %s)
            RETURNING *
        """, (user["id"], user.get("nome") or user.get("email") or "?",
              user.get("email"), body.title.strip(), (body.descr or "").strip(),
              body.dt_start, body.dt_end, body.all_day, body.cor,
              json.dumps(body.convidados or []), body.card_id,
              (body.local or "").strip() or None, body.tipo, link,
              json.dumps(sorted(set(body.lembretes or []))), body.rrule,
              resp_id, resp_nome))
        r = cur.fetchone()
        ev = _ser(r)
        try: _push_convite(cur, ev, user.get("nome") or user.get("email") or "?")
        except Exception: pass
        try:
            if resp_id and resp_id != user["id"]:
                _push_delegacao(ev, user.get("nome") or user.get("email") or "?")
        except Exception: pass
    return ev


@router.patch("/api/calendar/events/{ev_id}")
def editar(ev_id: int, body: EventoPatch, user: dict = Depends(require_user)):
    with conn() as c, c.cursor() as cur:
        cur.execute("SELECT * FROM trello_projetos.calendar_events WHERE id = %s", (ev_id,))
        cur_row = cur.fetchone()
        if not cur_row:
            raise HTTPException(404, "evento não encontrado")
        if not user["is_gestora"] and str(cur_row["user_id"]) != user["id"]:
            raise HTTPException(403, "só o autor ou admin edita")
        patch = body.model_dump(exclude_unset=True)
        # Auto-link se virou chamada e ainda sem link
        if patch.get("tipo") == "chamada" and not patch.get("link_chamada") \
                and not cur_row.get("link_chamada"):
            patch["link_chamada"] = _autolink_chamada("chamada", None)
        # dt_end antes de dt_start vira NULL
        if "dt_end" in patch and patch["dt_end"]:
            try:
                ds_str = patch.get("dt_start") or (cur_row["dt_start"].isoformat() if cur_row.get("dt_start") else None)
                if ds_str:
                    if datetime.fromisoformat(patch["dt_end"].replace("Z", "+00:00")) <= \
                       datetime.fromisoformat(ds_str.replace("Z", "+00:00")):
                        patch["dt_end"] = None
            except Exception:
                patch["dt_end"] = None
        # Gate delegação: só gestora atribui pra terceiros
        if "responsavel_id" in patch:
            novo = patch["responsavel_id"]
            if novo and not user["is_gestora"] and novo != user["id"]:
                patch.pop("responsavel_id")
            else:
                resp_id, resp_nome = _resolve_responsavel(cur, novo)
                patch["responsavel_id"] = resp_id
                patch["responsavel_nome"] = resp_nome
        campos, vals = [], []
        for k, v in patch.items():
            if k in ("convidados", "lembretes") and v is not None:
                campos.append(f"{k} = %s::jsonb"); vals.append(json.dumps(v))
            else:
                campos.append(f"{k} = %s"); vals.append(v)
        if not campos:
            return _ser(cur_row)
        campos.append("updated_at = now()")
        vals.append(ev_id)
        cur.execute(f"""UPDATE trello_projetos.calendar_events
                          SET {', '.join(campos)}
                        WHERE id = %s RETURNING *""", tuple(vals))
        r = cur.fetchone()
        ev = _ser(r)
        if body.convidados is not None:
            antigos = set(cur_row.get("convidados") or [])
            novos = set(body.convidados) - antigos
            if novos:
                try:
                    _push_convite(cur, {**ev, "convidados": list(novos)},
                                  user.get("nome") or user.get("email") or "?")
                except Exception: pass
        # Push delegação se responsável mudou
        try:
            resp_novo = ev.get("responsavel_id")
            resp_antigo = str(cur_row["responsavel_id"]) if cur_row.get("responsavel_id") else None
            if resp_novo and resp_novo != resp_antigo and resp_novo != user["id"]:
                _push_delegacao(ev, user.get("nome") or user.get("email") or "?")
        except Exception: pass
    return ev


@router.delete("/api/calendar/events/{ev_id}")
def deletar(ev_id: int, user: dict = Depends(require_user)):
    with conn() as c, c.cursor() as cur:
        cur.execute("SELECT user_id FROM trello_projetos.calendar_events WHERE id = %s", (ev_id,))
        row = cur.fetchone()
        if not row:
            raise HTTPException(404, "evento não encontrado")
        if not user["is_gestora"] and str(row["user_id"]) != user["id"]:
            raise HTTPException(403, "só o autor ou admin apaga")
        cur.execute("DELETE FROM trello_projetos.calendar_events WHERE id = %s", (ev_id,))
    return {"ok": True}


@router.post("/api/calendar/events/{ev_id}/rsvp")
def rsvp(ev_id: int, body: RSVPIn, user: dict = Depends(require_user)):
    """Convidado responde sim/não/talvez. Autor/gestora não usam isso."""
    email = (user.get("email") or "").lower()
    if not email:
        raise HTTPException(400, "sem email")
    with conn() as c, c.cursor() as cur:
        cur.execute("SELECT id, convidados, rsvp FROM trello_projetos.calendar_events WHERE id = %s",
                    (ev_id,))
        row = cur.fetchone()
        if not row:
            raise HTTPException(404, "evento não encontrado")
        convidados = [str(e).lower() for e in (row.get("convidados") or [])]
        if email not in convidados:
            raise HTTPException(403, "você não foi convidado")
        rsvp_map = dict(row.get("rsvp") or {})
        rsvp_map[email] = body.status
        cur.execute("UPDATE trello_projetos.calendar_events "
                    "SET rsvp = %s::jsonb, updated_at = now() WHERE id = %s "
                    "RETURNING *", (json.dumps(rsvp_map), ev_id))
        return _ser(cur.fetchone())
