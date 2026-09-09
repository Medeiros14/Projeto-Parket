"""
Cronograma Auto-Inserter
=========================
Roda a cada 5 min. Detecta cards do kanban_cards em
`dept_id=operacional AND column_id=obras-liberadas` que AINDA NÃO têm
linha em `cronograma_obras` (com card_id) e cria automaticamente, preenchendo
os campos derivados de card.details + cronograma_pmo.

Campos auto-preenchidos:
  - nome_obra        ← card.title
  - tipo             ← "obras"
  - categoria        ← "obras_liberadas"
  - card_id          ← card.id
  - fiscal           ← details.fiscal_responsavel (se != "NÃO")
  - localizacao      ← details.endereco_obra || endereco || cidade
  - contrato         ← details.numero_pedido || details.extrecno
  - servico          ← descrito a partir de cronograma_pmo.itens (top 2)
  - data_finalizacao ← previsao_inicio + total_dias_uteis (formato DD/MM/YYYY)
  - observacao       ← cronograma_pmo.observacao
  - posicao          ← 0

Campos deixados em branco (preencher manual):
  - equipe, dias, custos, inicio_dia, termino_dia, dispos

Idempotente: nunca duplica (filtra por card_id já existente).
"""

import httpx
import structlog
from datetime import datetime, timedelta

from app.config import settings
from app.core.supabase_kanban import _headers

logger = structlog.get_logger(__name__)
SB_URL = settings.SUPABASE_URL


def _calc_data_finalizacao(prev_inicio_str, dias_uteis):
    """Soma dias úteis (skip sab/dom) ao previsao_inicio. Retorna DD/MM/YYYY."""
    if not prev_inicio_str or not dias_uteis:
        return ""
    try:
        dt = datetime.fromisoformat(str(prev_inicio_str)[:10])
        adicionados = 0
        while adicionados < int(dias_uteis):
            dt += timedelta(days=1)
            if dt.weekday() < 5:  # 0-4 = seg-sex
                adicionados += 1
        return dt.strftime("%d/%m/%Y")
    except Exception:
        return ""


def _resumir_servicos(cronograma_pmo):
    """Pega categoria + qtd dos top 2 itens do cronograma_pmo."""
    if not cronograma_pmo or not isinstance(cronograma_pmo, dict):
        return ""
    itens = cronograma_pmo.get("itens") or []
    if not itens:
        return ""
    parts = []
    for it in itens[:3]:
        cat = (it.get("categoria") or it.get("servico") or "").upper()
        qtd = it.get("quantidade")
        un = it.get("unidade") or ""
        if qtd:
            parts.append(f"{cat} {qtd}{un}")
        elif cat:
            parts.append(cat)
    return " + ".join(parts)


async def _fetch_card_ids_com_contrato():
    """Set de card_ids que têm pelo menos 1 contrato em projeto_contratos."""
    async with httpx.AsyncClient(timeout=20) as c:
        r = await c.get(
            f"{SB_URL}/rest/v1/projeto_contratos",
            headers=_headers(),
            params={"select": "card_id", "card_id": "not.is.null", "limit": "20000"},
        )
        r.raise_for_status()
        return {row["card_id"] for row in (r.json() or []) if row.get("card_id")}


async def _fetch_obras_liberadas():
    """Cards em operacional/obras-liberadas — APENAS os que têm contrato."""
    async with httpx.AsyncClient(timeout=20) as c:
        r = await c.get(
            f"{SB_URL}/rest/v1/kanban_cards",
            headers=_headers(),
            params={
                "select": "id,title,details",
                "dept_id": "eq.operacional",
                "column_id": "eq.obras-liberadas",
                "limit": "500",
            },
        )
        r.raise_for_status()
        cards = r.json() or []
    com_contrato = await _fetch_card_ids_com_contrato()
    return [c for c in cards if c["id"] in com_contrato]


async def _fetch_card_ids_no_cronograma():
    """Set de card_ids que já existem em cronograma_obras."""
    async with httpx.AsyncClient(timeout=20) as c:
        r = await c.get(
            f"{SB_URL}/rest/v1/cronograma_obras",
            headers=_headers(),
            params={
                "select": "card_id",
                "card_id": "not.is.null",
                "limit": "5000",
            },
        )
        r.raise_for_status()
        rows = r.json() or []
    return {row["card_id"] for row in rows if row.get("card_id")}


def _build_row(card):
    """Monta payload pra INSERT em cronograma_obras."""
    det = card.get("details") or {}
    cron = det.get("cronograma_pmo") or {}
    fiscal = (det.get("fiscal_responsavel") or "").strip()
    if fiscal.upper() in ("NÃO", "NAO", "N/A", "-"):
        fiscal = ""
    localizacao = (
        det.get("endereco_obra")
        or det.get("endereco")
        or det.get("cidade")
        or ""
    )
    contrato = det.get("numero_pedido") or det.get("extrecno") or ""
    servico = _resumir_servicos(cron)
    data_fim = _calc_data_finalizacao(
        cron.get("previsao_inicio"),
        cron.get("total_dias_uteis"),
    )
    obs = (cron.get("observacao") or "").strip()
    return {
        "nome_obra": (card.get("title") or "").strip(),
        "tipo": "obras",
        "categoria": "obras_liberadas",
        "card_id": card["id"],
        "fiscal": fiscal,
        "localizacao": str(localizacao).strip(),
        "contrato": str(contrato).strip() if contrato else None,
        "servico": servico,
        "data_finalizacao": data_fim,
        "observacao": obs or None,
        "equipe": "",
        "dias": "",
        "custos": "",
        "posicao": 0,
    }


# Mapeia column_id do kanban operacional → (categoria, status_obra) no cronograma
_COL_TO_CAT = {
    "obras-liberadas":     ("obras_liberadas",  None),
    "pre-cronograma":      ("cronograma_final", None),
    "cronograma-final":    ("cronograma_final", None),
    "projeto":             ("obras_liberadas",  None),
    "entrega-material":    ("acompanhamento",   None),
    "primeira-vistoria":   ("acompanhamento",   None),
    "segunda-vistoria":    ("acompanhamento",   None),
    "acompanhamento":      ("acompanhamento",   None),
    "pendente":            ("acompanhamento",   None),
    "reparos":             ("acompanhamento",   None),
    "travado":             ("travado",          "travado"),
    "reparos-concluidos":  ("finalizadas",      "finalizado"),
    "obras-finalizadas":   ("finalizadas",      "finalizado"),
}


async def _fetch_cronograma_rows_com_card():
    """Linhas do cronograma vinculadas a algum card."""
    async with httpx.AsyncClient(timeout=20) as c:
        r = await c.get(
            f"{SB_URL}/rest/v1/cronograma_obras",
            headers=_headers(),
            params={
                "select": "id,card_id,categoria,status_obra",
                "card_id": "not.is.null",
                "limit": "5000",
            },
        )
        r.raise_for_status()
        return r.json() or []


async def _fetch_cards_operacional(ids):
    """Fetch kanban_cards operacional por lista de IDs (inclui details pra prestadores)."""
    if not ids:
        return []
    chunks = [list(ids)[i:i+100] for i in range(0, len(ids), 100)]
    out = []
    async with httpx.AsyncClient(timeout=30) as c:
        for chunk in chunks:
            ids_str = ",".join(chunk)
            r = await c.get(
                f"{SB_URL}/rest/v1/kanban_cards",
                headers=_headers(),
                params={
                    "select": "id,column_id,title,details",
                    "dept_id": "eq.operacional",
                    "id": f"in.({ids_str})",
                    "limit": "1000",
                },
            )
            if r.is_success:
                out.extend(r.json() or [])
    return out


async def _fetch_prestadores_por_card(card_ids):
    """Retorna {card_id: [{id, nome}, ...]} consolidando prestador_card + details.prestadores."""
    result = {cid: [] for cid in card_ids}
    if not card_ids:
        return result
    async with httpx.AsyncClient(timeout=30) as c:
        # prestador_card (join table)
        ids_list = list(card_ids)
        for i in range(0, len(ids_list), 100):
            chunk = ids_list[i:i+100]
            ids_str = ",".join(chunk)
            r = await c.get(
                f"{SB_URL}/rest/v1/prestador_card",
                headers=_headers(),
                params={"select": "card_id,prestador_id,prestadores(id,nome)",
                        "card_id": f"in.({ids_str})", "limit": "5000"},
            )
            if r.is_success:
                for row in r.json() or []:
                    p = row.get("prestadores") or {}
                    if p.get("nome"):
                        result.setdefault(row["card_id"], []).append({"id": p["id"], "nome": p["nome"]})
    return result


async def _fetch_cronograma_para_sync_nome():
    """Linhas do cronograma vinculadas a card pra sync de nome_obra."""
    async with httpx.AsyncClient(timeout=20) as c:
        r = await c.get(
            f"{SB_URL}/rest/v1/cronograma_obras",
            headers=_headers(),
            params={"select": "id,card_id,nome_obra", "card_id": "not.is.null", "limit": "5000"},
        )
        r.raise_for_status()
        return r.json() or []


async def sync_cronograma_com_kanban():
    """Sincroniza categoria + status_obra + equipe(prestador) de cada linha
    cronograma_obras com a coluna atual e prestadores vinculados do card."""
    # Re-fetch com equipe incluída
    async with httpx.AsyncClient(timeout=20) as c:
        r = await c.get(
            f"{SB_URL}/rest/v1/cronograma_obras",
            headers=_headers(),
            params={
                "select": "id,card_id,categoria,status_obra,nome_obra,equipe",
                "card_id": "not.is.null",
                "limit": "5000",
            },
        )
        r.raise_for_status()
        cronos = r.json() or []
    if not cronos:
        return {"atualizados": 0, "total": 0}
    card_ids = {c["card_id"] for c in cronos if c.get("card_id")}
    cards = await _fetch_cards_operacional(card_ids)
    cards_by_id = {c["id"]: c for c in cards}
    prest_por_card = await _fetch_prestadores_por_card(card_ids)
    atualizados = 0
    async with httpx.AsyncClient(timeout=30) as cli:
        for crono in cronos:
            card = cards_by_id.get(crono["card_id"])
            if not card:
                continue
            mapping = _COL_TO_CAT.get(card.get("column_id"))
            if not mapping:
                continue
            new_cat, new_status = mapping
            # nome_obra sempre = título do card
            card_title = (card.get("title") or "").strip()
            need_name_sync = card_title and crono.get("nome_obra") != card_title

            # Sincroniza equipe com prestadores do card.
            # Estratégia: pega lista unificada (prestador_card join + details.prestadores).
            # Se equipe atual NÃO está na lista, sobrescreve com o primeiro prestador.
            prest_join = prest_por_card.get(card["id"], [])
            det = card.get("details") or {}
            prest_det = det.get("prestadores") if isinstance(det.get("prestadores"), list) else []
            all_prest_names = set()
            for p in prest_join:
                if p.get("nome"): all_prest_names.add(p["nome"].strip())
            for p in prest_det:
                if isinstance(p, dict) and p.get("nome"):
                    all_prest_names.add(p["nome"].strip())
            equipe_atual = (crono.get("equipe") or "").strip()
            new_equipe = None
            if all_prest_names and equipe_atual not in all_prest_names:
                # primeiro nome (preferindo prest_join que vem do banco)
                first = prest_join[0]["nome"].strip() if prest_join else next(iter(all_prest_names))
                new_equipe = first
            need_equipe_sync = new_equipe is not None and new_equipe != equipe_atual

            if (crono.get("categoria") == new_cat and crono.get("status_obra") == new_status
                    and not need_name_sync and not need_equipe_sync):
                continue
            payload = {"categoria": new_cat, "status_obra": new_status}
            if need_name_sync:
                payload["nome_obra"] = card_title
            if need_equipe_sync:
                payload["equipe"] = new_equipe
            r = await cli.patch(
                f"{SB_URL}/rest/v1/cronograma_obras?id=eq.{crono['id']}",
                headers={**_headers(), "Prefer": "return=minimal"},
                json=payload,
            )
            if r.is_success:
                atualizados += 1
                logger.info(
                    "cronograma_sync",
                    crono_id=crono["id"],
                    card_id=card["id"],
                    column=card.get("column_id"),
                    cat=new_cat,
                    status=new_status,
                )
    logger.info("cronograma_sync_done", atualizados=atualizados, total=len(cronos))
    return {"atualizados": atualizados, "total": len(cronos)}


async def auto_inserir_cronograma():
    """Cron principal — varre obras-liberadas e cria linhas faltantes,
    DEPOIS sincroniza categoria + status_obra das linhas existentes com o kanban."""
    # 1) Sincroniza linhas existentes com a coluna atual do kanban
    sync_result = await sync_cronograma_com_kanban()

    # 2) Insere linhas novas pros cards em obras-liberadas
    cards = await _fetch_obras_liberadas()
    if not cards:
        logger.info("cron_auto_insert_no_cards", sync=sync_result)
        return {"cards": 0, "criados": 0, "ja_existentes": 0, "sync": sync_result}

    ja_existem = await _fetch_card_ids_no_cronograma()
    novos = [c for c in cards if c["id"] not in ja_existem]
    if not novos:
        logger.info("cron_auto_insert_all_present", total=len(cards), sync=sync_result)
        return {"cards": len(cards), "criados": 0, "ja_existentes": len(cards), "sync": sync_result}

    payloads = [_build_row(c) for c in novos]
    async with httpx.AsyncClient(timeout=30) as c:
        r = await c.post(
            f"{SB_URL}/rest/v1/cronograma_obras",
            headers={**_headers(), "Prefer": "return=minimal"},
            json=payloads,
        )
        if not r.is_success:
            logger.error("cron_auto_insert_failed", status=r.status_code, body=r.text[:200])
            return {"cards": len(cards), "criados": 0, "erro": r.text[:200]}

    for n in novos:
        logger.info("cron_auto_insert_criado", card_id=n["id"], title=n.get("title"))
    logger.info(
        "cron_auto_insert_done",
        cards=len(cards),
        criados=len(novos),
        ja_existentes=len(cards) - len(novos),
    )
    return {
        "cards": len(cards),
        "criados": len(novos),
        "ja_existentes": len(cards) - len(novos),
    }
