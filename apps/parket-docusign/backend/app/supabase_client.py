"""Cliente Supabase via REST (service_role) — sem dependência do SDK."""
from __future__ import annotations
import httpx
from typing import Any

from .config import get_settings


def _headers() -> dict[str, str]:
    s = get_settings()
    return {
        "apikey": s.supabase_service_key,
        "Authorization": f"Bearer {s.supabase_service_key}",
        "Content-Type": "application/json",
        "Prefer": "return=representation",
    }


async def insert_contrato(card_id: str, signatarios: list[dict],
                          notes: str | None = None,
                          titulo: str | None = None) -> dict[str, Any]:
    """Insere um novo contrato. Se `titulo` é None, calcula automaticamente
    baseado em quantos contratos já existem no card (1º = "Contrato Principal",
    2º = "Aditivo 1", 3º = "Aditivo 2"…)."""
    s = get_settings()
    if titulo is None:
        existing = await get_contratos_by_card(card_id)
        if len(existing) == 0:
            titulo = "Contrato Principal"
        else:
            titulo = f"Aditivo {len(existing)}"
    async with httpx.AsyncClient(timeout=30) as c:
        r = await c.post(
            f"{s.supabase_url}/rest/v1/contratos_docusign",
            headers=_headers(),
            json={
                "card_id": card_id,
                "signatarios": signatarios,
                "notes": notes,
                "titulo": titulo,
                "status": "rascunho",
            },
        )
    if r.status_code >= 400:
        raise RuntimeError(f"Supabase insert failed: {r.status_code} {r.text[:200]}")
    rows = r.json()
    return rows[0] if isinstance(rows, list) else rows


async def update_contrato(contrato_id: str, patch: dict[str, Any]) -> dict[str, Any]:
    s = get_settings()
    async with httpx.AsyncClient(timeout=30) as c:
        r = await c.patch(
            f"{s.supabase_url}/rest/v1/contratos_docusign",
            headers=_headers(),
            params={"id": f"eq.{contrato_id}"},
            json=patch,
        )
    if r.status_code >= 400:
        raise RuntimeError(f"Supabase update failed: {r.status_code} {r.text[:200]}")
    rows = r.json()
    return rows[0] if rows else {}


async def update_contrato_by_envelope(envelope_id: str, patch: dict[str, Any]) -> dict[str, Any]:
    s = get_settings()
    async with httpx.AsyncClient(timeout=30) as c:
        r = await c.patch(
            f"{s.supabase_url}/rest/v1/contratos_docusign",
            headers=_headers(),
            params={"envelope_id": f"eq.{envelope_id}"},
            json=patch,
        )
    if r.status_code >= 400:
        raise RuntimeError(f"Supabase update failed: {r.status_code} {r.text[:200]}")
    rows = r.json()
    return rows[0] if rows else {}


async def get_contratos_by_card_or_envelope(envelope_id: str) -> list[dict]:
    """Busca o contrato dado um envelope_id. Retorna lista (sempre 0 ou 1)."""
    s = get_settings()
    async with httpx.AsyncClient(timeout=30) as c:
        r = await c.get(
            f"{s.supabase_url}/rest/v1/contratos_docusign",
            headers={"apikey": s.supabase_service_key,
                     "Authorization": f"Bearer {s.supabase_service_key}"},
            params={
                "envelope_id": f"eq.{envelope_id}",
                "select": "*",
                "limit": "1",
            },
        )
    if r.status_code >= 400:
        return []
    return r.json() or []


async def get_card(card_id: str) -> dict | None:
    """Busca um kanban_card no local primeiro (fresco), cloud como fallback."""
    s = get_settings()
    for base in ["https://api.parket.works", s.supabase_url]:
        try:
            async with httpx.AsyncClient(timeout=10) as c:
                r = await c.get(
                    f"{base}/rest/v1/kanban_cards",
                    headers=_headers(),
                    params={"id": f"eq.{card_id}",
                            "select": "id,details,column_id,dept_id",
                            "limit": "1"},
                )
                if r.status_code < 400:
                    rows = r.json() or []
                    if rows:
                        return rows[0]
        except Exception:
            pass
    return None


async def update_card_column(card_id: str, column_id: str) -> dict | None:
    """Move o kanban_card pra outra coluna. Usado quando o envelope é enviado
    (→ contrato-enviado) e quando o webhook DocuSign sinaliza assinado
    (→ contrato-assinado). Idempotente.

    O contrato.parket.works e o Homebroker leem do parket-pg-local via
    api.parket.works — se atualizarmos SÓ no Cloud, o card não move na
    hora (só depois que a replicação sincroniza). Por isso atualizamos
    LOCAL diretamente. O JWT secret é o mesmo (setup memória
    'GATEWAY → POSTGREST LOCAL')."""
    s = get_settings()
    urls = ["https://api.parket.works", s.supabase_url]  # local primeiro, cloud como fallback/replicação
    last_ok: dict | None = None
    async with httpx.AsyncClient(timeout=15) as c:
        for base in urls:
            try:
                r = await c.patch(
                    f"{base}/rest/v1/kanban_cards",
                    headers=_headers(),
                    params={"id": f"eq.{card_id}"},
                    json={"column_id": column_id},
                )
                if r.status_code < 400:
                    rows = r.json() or []
                    if rows:
                        last_ok = rows[0]
            except Exception:
                pass
    return last_ok


async def get_stalled_envelopes(hours: int = 48) -> list[dict]:
    """Contratos com status 'enviado' há mais de N horas sem assinatura completa.
    Usado pelo cron de reminder — não repete pra quem já foi lembrado hoje
    (usa notes contains 'reminded:' + hoje). Faz a query no LOCAL (fresco)."""
    from datetime import datetime, timezone, timedelta
    cutoff = (datetime.now(timezone.utc) - timedelta(hours=hours)).isoformat()
    async with httpx.AsyncClient(timeout=15) as c:
        r = await c.get(
            "https://api.parket.works/rest/v1/contratos_docusign",
            headers=_headers(),
            params={
                "status": "eq.enviado",
                "sent_at": f"lt.{cutoff}",
                "select": "id,card_id,envelope_id,titulo,sent_at,notes,signatarios",
                "order": "sent_at.asc",
                "limit": "100",
            },
        )
    if r.status_code >= 400:
        return []
    return r.json() or []


async def append_contrato_note(contrato_id: str, note: str) -> None:
    """Anexa nota ao contrato — usado pra registrar 'reminded:YYYY-MM-DD' etc."""
    async with httpx.AsyncClient(timeout=10) as c:
        # PATCH com notes = notes || '\n' || note não funciona direto no PostgREST;
        # simplifica: read-then-write
        get_r = await c.get(
            "https://api.parket.works/rest/v1/contratos_docusign",
            headers=_headers(),
            params={"id": f"eq.{contrato_id}", "select": "notes"},
        )
        cur = (get_r.json() or [{}])[0].get("notes") or ""
        new = (cur + "\n" + note).strip()
        await c.patch(
            "https://api.parket.works/rest/v1/contratos_docusign",
            headers=_headers(),
            params={"id": f"eq.{contrato_id}"},
            json={"notes": new},
        )


async def create_agenda_tarefa(user_id: str, user_nome: str, titulo: str, descricao: str,
                                card_id: str | None, prioridade: str = "media") -> None:
    """Cria tarefa em agenda_tarefas — usado pelo reminder cron."""
    from datetime import datetime
    async with httpx.AsyncClient(timeout=10) as c:
        await c.post(
            "https://api.parket.works/rest/v1/agenda_tarefas",
            headers=_headers(),
            json={
                "user_id": user_id, "user_nome": user_nome,
                "titulo": titulo, "descricao": descricao,
                "card_id": card_id, "status": "pendente",
                "prioridade": prioridade,
                "data": datetime.now().date().isoformat(),
            },
        )


async def create_notificacao(user_id: str, tipo: str, titulo: str, mensagem: str,
                              referencia_id: str | None) -> None:
    async with httpx.AsyncClient(timeout=10) as c:
        await c.post(
            "https://api.parket.works/rest/v1/notificacoes",
            headers=_headers(),
            json={
                "user_id": user_id, "tipo": tipo,
                "titulo": titulo, "mensagem": mensagem,
                "referencia_id": referencia_id, "referencia_tipo": "kanban_card",
                "lida": False,
            },
        )


async def find_vendedor_by_name(nome: str | None) -> dict | None:
    if not nome: return None
    async with httpx.AsyncClient(timeout=10) as c:
        r = await c.get(
            "https://api.parket.works/rest/v1/user_profiles",
            headers=_headers(),
            params={"full_name": f"eq.{nome.strip()}",
                    "funcao_comercial": "eq.vendedor",
                    "ativo": "eq.true",
                    "order": "role.desc",
                    "select": "id,email,full_name",
                    "limit": "1"},
        )
    if r.status_code >= 400: return None
    rows = r.json() or []
    return rows[0] if rows else None


async def get_contratos_by_card(card_id: str) -> list[dict]:
    s = get_settings()
    async with httpx.AsyncClient(timeout=30) as c:
        r = await c.get(
            f"{s.supabase_url}/rest/v1/contratos_docusign",
            headers={"apikey": s.supabase_service_key,
                     "Authorization": f"Bearer {s.supabase_service_key}"},
            params={
                "card_id": f"eq.{card_id}",
                "select": "*",
                "order": "created_at.desc",
            },
        )
    if r.status_code >= 400:
        raise RuntimeError(f"Supabase select failed: {r.status_code}")
    return r.json() or []


# ============================================================================
# Fechamento automático Valoria (webhook DocuSign assinado → sim fechada)
# ----------------------------------------------------------------------------
# HB grava selected_at em simulacao_projetos + meta.valoria_simulacao_id
# aponta pra sim na Valor (ops.simulacoes). Quando o envelope é assinado,
# resolvemos qual sim virou "fechada", marcamos as outras do mesmo card
# como "perdida" e movemos o card do orçamentista pra proposta-aceita.
# ============================================================================

def _headers_ops() -> dict[str, str]:
    """Mesmos headers, mas mira o schema `ops` (tabelas Valoria)."""
    h = _headers()
    h["Accept-Profile"] = "ops"
    h["Content-Profile"] = "ops"
    return h


async def resolve_valoria_sim_from_comercial(com_card_id: str) -> tuple[str | None, str | None]:
    """A partir do card Comercial (HB), acha a sim Valoria fechada.
    Lê simulacao_projetos WHERE card_comercial_id=X AND selected_at NOT NULL
    (a mais recente) e retorna (valoria_sim_id, valoria_card_id).
    Se meta.valoria_simulacao_id não existir, retorna (None, None)."""
    s = get_settings()
    async with httpx.AsyncClient(timeout=15) as c:
        r = await c.get(
            f"{s.supabase_url}/rest/v1/simulacao_projetos",
            headers=_headers(),
            params={
                "card_comercial_id": f"eq.{com_card_id}",
                "selected_at": "not.is.null",
                "select": "id,meta,selected_at",
                "order": "selected_at.desc",
                "limit": "1",
            },
        )
    if r.status_code >= 400:
        return (None, None)
    rows = r.json() or []
    if not rows:
        return (None, None)
    meta = rows[0].get("meta") or {}
    sim_id = meta.get("valoria_simulacao_id")
    if not sim_id:
        return (None, None)
    # Descobre o card Valor via ops.simulacoes.card_id
    async with httpx.AsyncClient(timeout=15) as c:
        r2 = await c.get(
            f"{s.supabase_url}/rest/v1/simulacoes",
            headers=_headers_ops(),
            params={"id": f"eq.{sim_id}", "select": "card_id", "limit": "1"},
        )
    if r2.status_code >= 400:
        return (sim_id, None)
    rows2 = r2.json() or []
    card_id = rows2[0].get("card_id") if rows2 else None
    return (sim_id, card_id)


async def mark_valoria_sim_fechada(sim_id: str, envelope_id: str | None = None) -> None:
    """Marca a sim Valor como fechada. Grava fechada_em+envelope em meta pra
    trilha."""
    s = get_settings()
    from datetime import datetime, timezone
    async with httpx.AsyncClient(timeout=15) as c:
        # 1) Lê meta atual pra fazer merge (jsonb patch não faz merge sozinho).
        gr = await c.get(
            f"{s.supabase_url}/rest/v1/simulacoes",
            headers=_headers_ops(),
            params={"id": f"eq.{sim_id}", "select": "meta", "limit": "1"},
        )
        meta_atual: dict = {}
        if gr.status_code < 400:
            rows = gr.json() or []
            if rows:
                meta_atual = rows[0].get("meta") or {}
        new_meta = {
            **meta_atual,
            "fechada_em": datetime.now(timezone.utc).isoformat(),
        }
        if envelope_id:
            new_meta["docusign_envelope_id"] = envelope_id
        await c.patch(
            f"{s.supabase_url}/rest/v1/simulacoes",
            headers=_headers_ops(),
            params={"id": f"eq.{sim_id}"},
            json={"status": "fechada", "meta": new_meta},
        )


async def gravar_termo_compensacao(sim_id: str, dados: dict) -> bool:
    """PKT-TERMO-CORE-20260827: grava meta.termo.compensacao DURÁVEL na
    simulacao_projetos quando o webhook do Itaú notifica a baixa do boleto.

    O _PAG_STORE do main.py é memória volátil (some no restart do container e
    quando a página do cliente fecha ninguém mais consulta o GET de status).
    Persistindo aqui, a perna 7 do compras-contratos-watcher enxerga a
    compensação e baixa a parcela CT- no core.lancamentos mesmo dias depois.

    Merge cuidadoso: `compensacao` entra como IRMÃO de `termo.pagamento`
    (read-merge-PATCH), preservando o que o front já gravou. Retorna True se
    persistiu."""
    s = get_settings()
    async with httpx.AsyncClient(timeout=15) as c:
        gr = await c.get(
            f"{s.supabase_url}/rest/v1/simulacao_projetos",
            headers=_headers(),
            params={"id": f"eq.{sim_id}", "select": "meta", "limit": "1"},
        )
        if gr.status_code >= 400:
            return False
        rows = gr.json() or []
        if not rows:
            return False
        meta_atual: dict = rows[0].get("meta") or {}
        termo_atual: dict = meta_atual.get("termo") or {}
        new_meta = {
            **meta_atual,
            "termo": {**termo_atual, "compensacao": dados},
        }
        pr = await c.patch(
            f"{s.supabase_url}/rest/v1/simulacao_projetos",
            headers=_headers(),
            params={"id": f"eq.{sim_id}"},
            json={"meta": new_meta},
        )
        return pr.status_code < 400


async def get_sim_termo(sim_id: str) -> dict | None:
    """Lê a simulacao_projetos do termo (numero, cliente, meta completo).

    QUÊ: usada pelo reenvio de cobrança do Core — precisamos dos dados do
    pagador (meta.termo.dados: nome/cpf/endereço/telefone) e do pagamento
    já emitido (meta.termo.pagamento) pra re-emitir boleto com novo prazo."""
    s = get_settings()
    async with httpx.AsyncClient(timeout=15) as c:
        r = await c.get(
            f"{s.supabase_url}/rest/v1/simulacao_projetos",
            headers=_headers(),
            params={"id": f"eq.{sim_id}", "select": "id,numero,cliente,meta", "limit": "1"},
        )
    if r.status_code >= 400:
        return None
    rows = r.json() or []
    return rows[0] if rows else None


async def gravar_termo_pagamento(sim_id: str, pag: dict) -> bool:
    """Regrava meta.termo.pagamento (merge cuidadoso, irmãos preservados).

    QUÊ: quando o Core re-emite o boleto com novo vencimento, o registro do
    pagamento precisa refletir o boleto NOVO (boleto_id/linha/vencimento).
    POR QUÊ: a perna 7 do compras-contratos-watcher casa por boleto_id
    (core_sync.boleto_anotado != boleto_id) — id novo faz o watcher re-anotar
    a parcela no core.lancamentos com a linha digitável e o vencimento novos.
    core_sync/compensacao ficam intactos (são irmãos dentro de meta.termo)."""
    s = get_settings()
    async with httpx.AsyncClient(timeout=15) as c:
        gr = await c.get(
            f"{s.supabase_url}/rest/v1/simulacao_projetos",
            headers=_headers(),
            params={"id": f"eq.{sim_id}", "select": "meta", "limit": "1"},
        )
        if gr.status_code >= 400:
            return False
        rows = gr.json() or []
        if not rows:
            return False
        meta_atual: dict = rows[0].get("meta") or {}
        termo_atual: dict = meta_atual.get("termo") or {}
        new_meta = {
            **meta_atual,
            "termo": {**termo_atual, "pagamento": pag},
        }
        pr = await c.patch(
            f"{s.supabase_url}/rest/v1/simulacao_projetos",
            headers=_headers(),
            params={"id": f"eq.{sim_id}"},
            json={"meta": new_meta},
        )
        return pr.status_code < 400


async def mark_other_valoria_sims_perdida(card_id: str, except_sim_id: str) -> None:
    """Marca as OUTRAS sims do mesmo card como perdida (menos a fechada).
    Só afeta status não terminais (rascunho, handoff-com, aprovada) —
    sim já 'perdida' fica como está."""
    s = get_settings()
    async with httpx.AsyncClient(timeout=15) as c:
        await c.patch(
            f"{s.supabase_url}/rest/v1/simulacoes",
            headers=_headers_ops(),
            params={
                "card_id": f"eq.{card_id}",
                "id": f"neq.{except_sim_id}",
                "status": "not.in.(fechada,perdida)",
            },
            json={"status": "perdida"},
        )


async def update_valoria_card_column(card_id: str, column_id: str) -> None:
    """Move o card do orçamentista (ops.cards_solicitacao) pra outra coluna.
    Usado quando a sim é fechada — vai pra 'proposta-aceita'."""
    s = get_settings()
    async with httpx.AsyncClient(timeout=15) as c:
        await c.patch(
            f"{s.supabase_url}/rest/v1/cards_solicitacao",
            headers=_headers_ops(),
            params={"id": f"eq.{card_id}"},
            json={"column_id": column_id},
        )
