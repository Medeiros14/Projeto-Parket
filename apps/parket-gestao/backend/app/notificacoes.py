# notificacoes.py — feed de novidades pros apps de campo (Instala e Verifica).
#
# Will (08/09): "precisa criar tambem as notificacoes quando chega coisa nova
# nos apps, tudo, qualquer que acontecer, obra nova, tanto no do fiscal quanto
# no do instalador". Nada de tabela nova: o feed e DERIVADO das tabelas que ja
# registram os acontecimentos (prestador_card, fiscal_agenda, custo_lancamento,
# instala_material_solicitacoes, instala_ocorrencias, gestao.eventos). O app
# guarda no localStorage o instante da ultima leitura e conta como "nao lida"
# toda novidade com data maior que isso; o backend nao guarda estado de leitura.
#
# Um endpoint so pros dois apps:
#   GET /api/app/notificacoes?prestador_id=...   (Instala, instalador)
#   GET /api/app/notificacoes?fiscal_id=...      (Verifica, fiscal)
#
# Cada item: {id, tipo, titulo, texto, data, tail}
#   tail = pra onde navegar no app ("custos", "agenda", "obra/<card_id>"...).
#   O Instala prefixa o slug do prestador; o Verifica mapeia pro tab.
# Cada fonte roda em try/except proprio: Cloud fora do ar nao derruba o feed.

import logging
import re
from fastapi import APIRouter, HTTPException, Query

from .db import conn
from .custos import _sb, _prestador_do_fiscal

log = logging.getLogger("uvicorn.error")

router = APIRouter(prefix="/api/app", tags=["notificacoes"])

LIMITE_POR_FONTE = 20
LIMITE_TOTAL = 50


def _item(id_, tipo, titulo, texto, data, tail):
    return {"id": str(id_), "tipo": tipo, "titulo": titulo,
            "texto": texto or "", "data": data, "tail": tail}


def _fmt_data_br(iso: str | None) -> str:
    # "2026-09-08" -> "08/09" (so pra compor texto; o app formata o timestamp)
    if not iso:
        return ""
    d = iso[:10].split("-")
    return f"{d[2]}/{d[1]}" if len(d) == 3 else iso[:10]


def _limpa_titulo(t: str | None) -> str:
    # Alguns cards vem com UUID + travessao no title cru ("d7178eb2-... — Fulano");
    # aqui e texto visivel de app, entao sai o UUID e sai o travessao (regra Will).
    t = (t or "-").strip()
    t = re.sub(r"^[0-9a-fA-F]{8}(?:-[0-9a-fA-F]{4}){3}-[0-9a-fA-F]{12}\s*[—–-]?\s*", "", t) or "-"
    return t.replace("—", "-").replace("–", "-")


def _titulos_cards(sb, card_ids: list[str]) -> dict[str, str]:
    """id do kanban_cards -> title (nome do cliente), num lote so."""
    if not card_ids:
        return {}
    ids = ",".join(sorted(set(card_ids)))
    r = sb.get("/kanban_cards", params={"select": "id,title", "id": f"in.({ids})"})
    if r.status_code >= 400:
        return {}
    return {c["id"]: _limpa_titulo(c.get("title")) for c in (r.json() or [])}


# ── Fontes compartilhadas (instalador e fiscal enxergam os proprios custos) ──

def _fonte_custos(pid: str) -> list[dict]:
    """Lancamento aprovado (com ou sem glosa) e pago viram novidade."""
    out = []
    with conn() as c, c.cursor() as cur:
        cur.execute("""
            SELECT l.id::text AS id, l.numero, l.status, l.aprovado_em, l.pago_em,
                   l.total_aprovado_cent, l.total_lancado_cent, pj.cliente,
                   (SELECT count(*) FROM gestao.custo_despesa d
                     WHERE d.lancamento_id = l.id AND d.status='glosado') AS n_glosadas
              FROM gestao.custo_lancamento l
              JOIN gestao.projetos pj ON pj.id = l.projeto_id
             WHERE l.prestador_id::text = %s
               AND l.status IN ('aprovado','pago')
             ORDER BY COALESCE(l.pago_em, l.aprovado_em, l.updated_at) DESC
             LIMIT %s""", (pid, LIMITE_POR_FONTE))
        for l in cur.fetchall():
            valor = (l["total_aprovado_cent"] or 0) / 100
            if l["aprovado_em"]:
                glosa = f", {l['n_glosadas']} item(ns) glosado(s)" if l["n_glosadas"] else ""
                out.append(_item(f"custo-aprov-{l['id']}", "custo",
                                 f"Custos aprovados: {l['numero']}",
                                 f"{l['cliente']}: R$ {valor:,.2f} aprovado{glosa}".replace(",", "X").replace(".", ",").replace("X", "."),
                                 l["aprovado_em"].isoformat(), "custos"))
            if l["status"] == "pago" and l["pago_em"]:
                out.append(_item(f"custo-pago-{l['id']}", "custo",
                                 f"Pagamento feito: {l['numero']}",
                                 f"{l['cliente']}: R$ {valor:,.2f} pago, comprovante no app".replace(",", "X").replace(".", ",").replace("X", "."),
                                 l["pago_em"].isoformat(), "custos"))
    return out


def _fonte_material(sb, filtro: dict, tail: str) -> list[dict]:
    """Solicitacao de material respondida (assumida/atendida) pelo escritorio."""
    out = []
    r = sb.get("/instala_material_solicitacoes", params={
        "select": "id,itens,status,atendida_por,atendida_em,created_at",
        "order": "created_at.desc", "limit": str(LIMITE_POR_FONTE), **filtro})
    if r.status_code >= 400:
        return out
    for m in (r.json() or []):
        if (m.get("status") or "pendente") == "pendente":
            continue
        resumo = (m.get("itens") or "")[:90]
        quem = f" por {m['atendida_por']}" if m.get("atendida_por") else ""
        # Status vem no feminino da tabela (solicitacao atendida); no titulo
        # falamos do PEDIDO, entao mapeia pro masculino conhecido.
        titulo = {"atendida": "Pedido de material atendido",
                  "assumida": "Pedido de material assumido",
                  "recusada": "Pedido de material recusado"}.get(
                      m["status"], f"Pedido de material: {m['status']}")
        out.append(_item(f"mat-{m['id']}", "material", titulo,
                         f"{resumo}{quem}",
                         m.get("atendida_em") or m.get("created_at"), tail))
    return out


def _fonte_ocorrencias_resolvidas(sb, filtro: dict, tail: str) -> list[dict]:
    """Ocorrencia que a gestao resolveu volta como resposta pra quem abriu."""
    out = []
    r = sb.get("/instala_ocorrencias", params={
        "select": "id,descricao,status,resolvida_por,resolvida_em",
        "status": "eq.resolvida", "order": "resolvida_em.desc",
        "limit": str(LIMITE_POR_FONTE), **filtro})
    if r.status_code >= 400:
        return out
    for o in (r.json() or []):
        out.append(_item(f"occ-{o['id']}", "ocorrencia", "Ocorrência resolvida",
                         (o.get("descricao") or "")[:90] +
                         (f" (por {o['resolvida_por']})" if o.get("resolvida_por") else ""),
                         o.get("resolvida_em"), tail))
    return out


# ── Fontes do instalador ──

def _instalador(pid: str) -> list[dict]:
    items: list[dict] = []

    # Obra nova: linha em prestador_card = alguem atribuiu a obra pra ele.
    try:
        with _sb() as sb:
            r = sb.get("/prestador_card", params={
                "select": "id,card_id,created_at,data_entrada",
                "prestador_id": f"eq.{pid}",
                "order": "created_at.desc", "limit": str(LIMITE_POR_FONTE)})
            if r.status_code < 400:
                rows = r.json() or []
                titulos = _titulos_cards(sb, [x["card_id"] for x in rows])
                for pc in rows:
                    entrada = f"Entrada prevista {_fmt_data_br(pc.get('data_entrada'))}. " if pc.get("data_entrada") else ""
                    items.append(_item(f"obra-{pc['id']}", "obra",
                                       f"Obra nova: {titulos.get(pc['card_id'], '-')}",
                                       f"{entrada}Você foi vinculado a esta obra.",
                                       pc["created_at"], f"obra/{pc['card_id']}"))
    except Exception as e:
        log.warning("notificacoes: prestador_card falhou: %s", e)

    # Veredito do fiscal nos envios de progresso da(s) obra(s) dele.
    try:
        with _sb() as sb:
            r = sb.get("/prestador_card", params={
                "select": "card_id", "prestador_id": f"eq.{pid}", "limit": "100"})
            cards = [x["card_id"] for x in (r.json() or [])] if r.status_code < 400 else []
        if cards:
            with conn() as c, c.cursor() as cur:
                cur.execute("""
                    SELECT e.id::text AS id, e.titulo,
                           e.payload->'fiscal'->>'status' AS veredito,
                           e.payload->'fiscal'->>'nome'   AS fiscal_nome,
                           e.payload->'fiscal'->>'motivo' AS motivo,
                           e.payload->'fiscal'->>'em'     AS em,
                           pj.cliente, pj.card_id::text   AS card_id
                      FROM gestao.eventos e
                      JOIN gestao.projetos pj ON pj.id = e.projeto_id
                     WHERE e.tipo = 'instala_progresso'
                       AND e.payload->'fiscal'->>'status' IN ('aprovado','reprovado')
                       AND pj.card_id::text = ANY(%s)
                     ORDER BY e.payload->'fiscal'->>'em' DESC NULLS LAST
                     LIMIT %s""", (cards, LIMITE_POR_FONTE))
                for v in cur.fetchall():
                    ok = v["veredito"] == "aprovado"
                    motivo = f" Motivo: {v['motivo']}" if (not ok and v["motivo"]) else ""
                    items.append(_item(f"valid-{v['id']}", "validacao",
                                       f"Fiscal {'aprovou' if ok else 'reprovou'}: {v['cliente']}",
                                       f"{v['titulo'] or 'Envio de progresso'} ({v['fiscal_nome'] or 'fiscal'}).{motivo}",
                                       v["em"], f"obra/{v['card_id']}"))
    except Exception as e:
        log.warning("notificacoes: validacao falhou: %s", e)

    try:
        with _sb() as sb:
            items += _fonte_material(sb, {"prestador_id": f"eq.{pid}"}, "material")
            items += _fonte_ocorrencias_resolvidas(sb, {"prestador_id": f"eq.{pid}"}, "ocorrencias")
    except Exception as e:
        log.warning("notificacoes: material/ocorrencias falhou: %s", e)

    try:
        items += _fonte_custos(pid)
    except Exception as e:
        log.warning("notificacoes: custos falhou: %s", e)

    return items


# ── Fontes do fiscal ──

def _fiscal(fid: str) -> list[dict]:
    items: list[dict] = []

    # Agendamento novo na agenda dele (vistoria, liberacao...).
    try:
        with _sb() as sb:
            r = sb.get("/fiscal_agenda", params={
                "select": "id,tipo,cliente,obra,data_inicio,online,created_at",
                "fiscal_id": f"eq.{fid}",
                "order": "created_at.desc", "limit": str(LIMITE_POR_FONTE)})
            if r.status_code < 400:
                for a in (r.json() or []):
                    modo = " (online)" if a.get("online") else ""
                    items.append(_item(f"agenda-{a['id']}", "agenda",
                                       f"Novo agendamento: {_limpa_titulo(a.get('cliente') or a.get('obra'))}",
                                       f"{a.get('tipo') or 'visita'}{modo} para {_fmt_data_br(a.get('data_inicio'))}",
                                       a["created_at"], "agenda"))
    except Exception as e:
        log.warning("notificacoes: fiscal_agenda falhou: %s", e)

    # Obra atribuida ao fiscal (details.fiscais[] do card).
    try:
        with _sb() as sb:
            r = sb.get("/kanban_cards", params={
                "select": "id,title,created_at",
                "details": 'cs.{"fiscais":[{"id":"%s"}]}' % fid,
                "order": "created_at.desc", "limit": "10"})
            cards_fiscal = [c["id"] for c in (r.json() or [])] if r.status_code < 400 else []
            if r.status_code < 400:
                for c_ in (r.json() or []):
                    items.append(_item(f"obraf-{c_['id']}", "obra",
                                       f"Obra atribuída: {_limpa_titulo(c_.get('title'))}",
                                       "Você é o fiscal desta obra.",
                                       c_["created_at"], "hoje"))
            # Ocorrencia aberta pelos instaladores nas obras do fiscal:
            # e ele quem resolve, entao chegada de ocorrencia e novidade.
            if cards_fiscal:
                ids = ",".join(cards_fiscal)
                ro = sb.get("/instala_ocorrencias", params={
                    "select": "id,descricao,prestador_nome,fiscal_id,status,created_at",
                    "card_id": f"in.({ids})",
                    "order": "created_at.desc", "limit": str(LIMITE_POR_FONTE)})
                if ro.status_code < 400:
                    for o in (ro.json() or []):
                        if o.get("fiscal_id") == fid:
                            continue  # aberta por ele mesmo, nao e novidade
                        quem = o.get("prestador_nome") or "instalador"
                        items.append(_item(f"occf-{o['id']}", "ocorrencia",
                                           f"Ocorrência na obra ({quem})",
                                           (o.get("descricao") or "")[:90],
                                           o["created_at"], "ocorrencias"))
    except Exception as e:
        log.warning("notificacoes: obras/ocorrencias do fiscal falhou: %s", e)

    # Respostas do que ELE abriu (material e ocorrencia com fiscal_id dele).
    try:
        with _sb() as sb:
            items += _fonte_material(sb, {"fiscal_id": f"eq.{fid}"}, "material")
            items += _fonte_ocorrencias_resolvidas(sb, {"fiscal_id": f"eq.{fid}"}, "ocorrencias")
    except Exception as e:
        log.warning("notificacoes: material/ocorrencias fiscal falhou: %s", e)

    # Custos dele (a ficha de prestador espelho resolve o vinculo).
    try:
        pid = _prestador_do_fiscal(fid)
        if pid:
            items += _fonte_custos(pid)
    except Exception as e:
        log.warning("notificacoes: custos fiscal falhou: %s", e)

    return items


@router.get("/notificacoes")
def notificacoes(prestador_id: str | None = Query(default=None),
                 fiscal_id: str | None = Query(default=None)):
    """Feed unico de novidades, mais novas primeiro. O corte de "lida ou nao"
    e do app (localStorage), aqui vai sempre a janela recente completa."""
    if prestador_id:
        items = _instalador(prestador_id.strip())
    elif fiscal_id:
        items = _fiscal(fiscal_id.strip())
    else:
        raise HTTPException(400, "informe prestador_id ou fiscal_id")
    items = [i for i in items if i.get("data")]
    items.sort(key=lambda i: i["data"], reverse=True)
    return {"items": items[:LIMITE_TOTAL]}
