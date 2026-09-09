"""parket-projetos — board do setor de Projetos (fonte da verdade LOCAL).

Serve o kanban (listas + cards com capa) e o detalhe de cada card
(descrição, checklists, anexos, comentários) pro frontend
projetos.parket.works. Desde 02/09 o board vive 100% no banco local
(schema trello_projetos, nome herdado): o vínculo com o Trello foi
cortado (Will) e todas as escritas vão direto no banco via board_local.
"""
import datetime
import json
import logging
import re
import time
import uuid
from pathlib import Path

import httpx
from fastapi import Depends, FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from .db import conn
from .settings import settings
from . import board_local
from . import push as push_mod
from . import calendar as calendar_mod
from .itens import router as itens_router, _categoria_raiz
from .relatorio import router as relatorio_router
from .auth import (
    router as auth_router,
    require_user, require_gestora, current_user_optional,
)

logging.basicConfig(level=logging.INFO)
log = logging.getLogger("projetos")

app = FastAPI(title="Parket Setor de Projetos", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in settings.cors_origins.split(",") if o.strip()]
    + ["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


app.include_router(auth_router)
app.include_router(itens_router)
app.include_router(push_mod.router)
app.include_router(calendar_mod.router)
app.include_router(relatorio_router)


def _aditivos_por_card() -> dict[str, str]:
    """{space_card_id → ISO timestamp da sim aditiva mais recente}.
    Fonte: view public.aditivos_v do Cloud. Falha silenciosa (dict vazio)
    se o REST estiver fora — o kanban continua funcionando."""
    if not settings.supabase_key:
        return {}
    try:
        r = httpx.get(
            f"{settings.supabase_url}/rest/v1/aditivos_v",
            params={"select": "card_id,created_at", "limit": "5000",
                    "order": "created_at.desc"},
            headers={"apikey": settings.supabase_key,
                     "Authorization": f"Bearer {settings.supabase_key}"},
            timeout=8,
        )
        r.raise_for_status()
        out: dict[str, str] = {}
        for row in r.json():
            cid = row.get("card_id")
            ts = row.get("created_at")
            if not cid or not ts:
                continue
            # já vem ordenado desc; só grava a primeira ocorrência por card_id
            if cid not in out:
                out[cid] = ts
        return out
    except Exception as e:
        log.warning("aditivos_v falhou: %s", e)
        return {}


def _fiscais_por_card() -> dict[str, list[str]]:
    """{cloud kanban_cards.id → [nomes de fiscais]}.
    Fonte: kanban_cards.details.fiscais[] no Cloud. Gestora atribui fiscal no
    verifica.parket.works/gestao; queremos que apareça na descrição do card
    do projetos-app assim que ela grava, sem precisar mexer no board.
    Pagina em 1000 (limite implícito do PostgREST) até acabar."""
    if not settings.supabase_key:
        return {}
    out: dict[str, list[str]] = {}
    offset = 0
    page_size = 1000
    try:
        while True:
            r = httpx.get(
                f"{settings.supabase_url}/rest/v1/kanban_cards",
                params={"select": "id,details->fiscais",
                        "details->fiscais": "not.is.null",
                        "order": "id.asc",
                        "limit": str(page_size),
                        "offset": str(offset)},
                headers={"apikey": settings.supabase_key,
                         "Authorization": f"Bearer {settings.supabase_key}"},
                timeout=15,
            )
            r.raise_for_status()
            batch = r.json() or []
            for row in batch:
                cid = row.get("id")
                fis = row.get("fiscais") or []
                if not cid or not isinstance(fis, list):
                    continue
                nomes = []
                for f in fis:
                    if isinstance(f, dict) and f.get("nome"):
                        nomes.append(str(f["nome"]).strip())
                if nomes:
                    out[cid] = nomes
            if len(batch) < page_size:
                break
            offset += page_size
            if offset > 50_000:
                break
    except Exception as e:
        log.warning("fiscais_por_card falhou: %s", e)
    return out


# Visões do kanban por grupo de produto (Will 01/09): separar cards de
# REVESTIMENTO dos de MARCENARIA. Decisão do Will: Brise e Ripado são
# marcenaria; Outro, Mão de Obra e Rodapé são revestimento, ou seja,
# tudo que não está no set abaixo cai em REVESTIMENTO (default/catch-all).
MARCENARIA_RAIZ = {"MARCENARIA", "PAINEL", "PORTA", "SAUNA", "ESCADA", "BRISE", "RIPADO"}


def _grupos_por_card() -> dict[str, list[str]]:
    """{gestao.projetos.card_id → ["REVESTIMENTO"] | ["MARCENARIA"] | ambos}.
    Classifica TODOS os gestao.itens de uma vez (1 query, ~1300 linhas) via
    _categoria_raiz (mesma régua do resto do app: FORRO LAMINADO e
    CORTINEIRO/ALÇAPÃO viram MARCENARIA). Card sem itens fica fora do dict
    e a UI mostra só na visão "Todos". Falha silenciosa: kanban continua."""
    out: dict[str, set[str]] = {}
    try:
        with conn() as c, c.cursor() as cur:
            cur.execute("""
                SELECT p.card_id, i.categoria, i.descritivo, i.meta
                  FROM gestao.itens i
                  JOIN gestao.projetos p ON p.id = i.projeto_id
                 WHERE p.card_id IS NOT NULL
            """)
            for row in cur.fetchall():
                cid = str(row["card_id"])
                raiz = _categoria_raiz(row)
                grupo = "MARCENARIA" if raiz in MARCENARIA_RAIZ else "REVESTIMENTO"
                out.setdefault(cid, set()).add(grupo)
    except Exception as e:
        log.warning("grupos_por_card falhou: %s", e)
    # sorted() pra resposta estável (MARCENARIA antes de REVESTIMENTO)
    return {k: sorted(v) for k, v in out.items()}


# Multi-responsáveis por card (Will 26/08): a mesma obra pode ter Vinicius
# fazendo Piso e Suelen fazendo Marcenaria ao mesmo tempo. Modelo n:n em
# trello_projetos.card_projetistas — cada linha carrega tipos/tamanho/prioridade/
# prazo/etapa_projetista da PESSOA (não do card).
def _user_pode_ver_card(cur, card_id: str, user: dict) -> bool:
    """Gestora vê tudo; projetista comum vê se está em card_projetistas."""
    if user.get("is_gestora"):
        return True
    cur.execute("""
        SELECT 1 FROM trello_projetos.card_projetistas
         WHERE card_id = %s AND projetista_id = %s
    """, (card_id, user["id"]))
    return bool(cur.fetchone())


@app.on_event("startup")
def _start_watchers():
    # Sync Trello removido 02/09 — o board local É a fonte; só o watcher
    # de push notifications continua.
    push_mod.start_watcher()


@app.get("/api/health")
def health():
    try:
        with conn() as c, c.cursor() as cur:
            cur.execute("SELECT count(*) AS n FROM trello_projetos.cards WHERE NOT closed")
            n = cur.fetchone()["n"]
        return {"ok": True, "cards": n}
    except Exception as e:
        return {"ok": False, "error": str(e)}


@app.get("/api/board")
def board(user: dict = Depends(require_user)):
    """Kanban completo. Gestora vê tudo; projetista comum só vê os
    cards em que aparece como responsável (card_projetistas). Cards ainda
    não delegados são visíveis SÓ pra gestora (fila de delegação).

    Um card pode ter N responsáveis (Will 26/08). Cada um com seu próprio
    tipo/tamanho/prioridade/prazo/etapa_projetista. Retornamos a lista
    completa em `responsaveis`, e mantemos os campos "primeiro responsável"
    no topo do card pra backcompat com a UI antiga."""
    with conn() as c, c.cursor() as cur:
        cur.execute("SELECT id, nome, pos FROM trello_projetos.listas WHERE NOT closed ORDER BY pos")
        listas = cur.fetchall()
        # ordem dos %s no SQL abaixo: sf.user_id, sa.user_id, (opcional) projetista_id
        params: list = [user["id"], user["id"]]
        filtro_sql = ""
        if not user["is_gestora"]:
            # Filtro multi: card visível se ELE está em card_projetistas.
            filtro_sql = (" AND EXISTS (SELECT 1 FROM trello_projetos.card_projetistas cp "
                          "WHERE cp.card_id = k.id AND cp.projetista_id = %s)")
            params.append(user["id"])
        cur.execute(f"""
            SELECT k.id, k.lista_id, k.nome, k.descricao, k.pos, k.due, k.due_complete,
                   k.labels, k.membros, k.short_link, k.space_card_id, k.space_card_ids_obra,
                   k.date_last_activity,
                   k.projetista_id, k.tipos, k.tamanho, k.prioridade, k.prazo,
                   k.etapa_projetista, k.etapa_projetista_em,
                   capa.path_local AS capa,
                   (SELECT count(*) FROM trello_projetos.anexos a
                     WHERE a.card_id = k.id AND a.is_upload)            AS n_anexos,
                   (SELECT count(*) FROM trello_projetos.comentarios m
                     WHERE m.card_id = k.id)                            AS n_comentarios,
                   (SELECT count(*) FROM jsonb_path_query(k.checklists, '$[*].itens[*]') i) AS chk_total,
                   (SELECT count(*) FROM jsonb_path_query(k.checklists,
                        '$[*].itens[*] ? (@.done == true)') i)          AS chk_done,
                   COALESCE((
                       SELECT count(*)::int FROM gestao.itens i
                        JOIN gestao.projetos p ON p.id = i.projeto_id
                       WHERE p.card_id = k.space_card_id
                         AND COALESCE((i.meta->>'liberado_projetos')::boolean, false) = false
                   ), 0)                                                AS pendentes_projetos,
                   COALESCE(ov.cliente,  proj.cliente)  AS cliente,
                   COALESCE(ov.endereco, proj.endereco) AS endereco,
                   COALESCE(ov.cnpj_cpf, proj.cnpj_cpf) AS cnpj_cpf,
                   fiscal.fiscal_ultima,
                   sf.seen_at AS fiscal_seen_at,
                   sa.seen_at AS aditivo_seen_at,
                   -- Lista completa de responsáveis (multi por card).
                   -- Ordena por delegado_em ASC pra o "primeiro" ser estável.
                   COALESCE((
                       SELECT jsonb_agg(jsonb_build_object(
                           'projetista_id', cp.projetista_id,
                           'nome',          up.full_name,
                           'avatar_color',  up.avatar_color,
                           'tipos',         cp.tipos,
                           'tamanho',       cp.tamanho,
                           'prioridade',    cp.prioridade,
                           'prazo',         cp.prazo,
                           'etapa_projetista',    cp.etapa_projetista,
                           'etapa_projetista_em', cp.etapa_projetista_em
                       ) ORDER BY cp.delegado_em ASC)
                         FROM trello_projetos.card_projetistas cp
                         LEFT JOIN public.user_profiles up ON up.id = cp.projetista_id
                        WHERE cp.card_id = k.id
                   ), '[]'::jsonb) AS responsaveis
            FROM trello_projetos.cards k
            LEFT JOIN LATERAL (
                SELECT p.cliente, p.endereco, p.cnpj_cpf
                  FROM gestao.projetos p
                 WHERE p.card_id = k.space_card_id
                 ORDER BY p.created_at DESC NULLS LAST
                 LIMIT 1
            ) proj ON true
            LEFT JOIN trello_projetos.card_override_dados ov ON ov.card_id = k.id
            LEFT JOIN LATERAL (
                -- IDs de TODOS os cards Cloud dessa obra (dept projetos + irmãos).
                -- Fiscal registra no dept operacional; sem essa expansão a query
                -- não achava o laudo mais recente pra chamar de "novo".
                SELECT array_remove(array(
                    SELECT DISTINCT s::uuid FROM (
                        SELECT jsonb_array_elements_text(
                            COALESCE(k.space_card_ids_obra, '[]'::jsonb)
                        ) AS s
                        UNION ALL
                        SELECT k.space_card_id::text AS s
                    ) t
                    WHERE s IS NOT NULL AND s <> ''
                ), NULL) AS ids
            ) fids ON true
            LEFT JOIN LATERAL (
                SELECT GREATEST(
                    (SELECT MAX(created_at) FROM public.fiscal_laudos  WHERE card_id = ANY(fids.ids)),
                    (SELECT MAX(created_at) FROM public.fiscal_agenda  WHERE card_id = ANY(fids.ids)),
                    (SELECT MAX(created_at) FROM public.fiscal_fotos   WHERE card_id = ANY(fids.ids)),
                    (SELECT MAX(oa.updated_at) FROM gestao.obra_acompanhamento oa
                       JOIN gestao.projetos p2 ON p2.id = oa.projeto_id
                      WHERE p2.card_id = k.space_card_id)
                ) AS fiscal_ultima
            ) fiscal ON true
            LEFT JOIN trello_projetos.notif_seen sf
              ON sf.user_id = %s AND sf.card_id = k.id AND sf.tipo = 'fiscal'
            LEFT JOIN trello_projetos.notif_seen sa
              ON sa.user_id = %s AND sa.card_id = k.id AND sa.tipo = 'aditivo'
            LEFT JOIN LATERAL (
                SELECT a.path_local FROM trello_projetos.anexos a
                WHERE a.card_id = k.id AND a.baixado AND a.is_imagem
                ORDER BY (a.id = k.capa_anexo_id) DESC, a.criado_em DESC
                LIMIT 1
            ) capa ON true
            WHERE NOT k.closed{filtro_sql}
            ORDER BY k.pos
        """, params)
        cards = cur.fetchall()
    # Aditivos: dict {space_card_id → ISO created_at do mais recente}.
    adit_map = _aditivos_por_card()
    fisc_map = _fiscais_por_card()
    # Grupos de produto (REVESTIMENTO/MARCENARIA) por card: alimenta o
    # seletor de visões do kanban no frontend.
    grupos_map = _grupos_por_card()
    for card in cards:
        sid = str(card.get("space_card_id") or "")
        card["grupos_produto"] = grupos_map.get(sid, [])
        adit_ts = adit_map.get(sid)
        card["tem_aditivo"] = bool(adit_ts)
        # Nomes de fiscais atribuídos pela gestora — pega do card do dept
        # projetos + irmãos (fiscal fica no card do dept operacional geralmente).
        nomes: list[str] = []
        vistos: set[str] = set()
        candidatos = [sid, *[str(x) for x in (card.get("space_card_ids_obra") or [])]]
        for cid in candidatos:
            for nome in fisc_map.get(cid, []) or []:
                key = nome.strip().lower()
                if key and key not in vistos:
                    vistos.add(key)
                    nomes.append(nome)
        card["fiscais_nomes"] = nomes
        # Fiscal novo: última movimentação > última vez que este user viu essa aba.
        fu = card.pop("fiscal_ultima", None)
        fs = card.pop("fiscal_seen_at", None)
        card["fiscal_novo"] = bool(fu and (fs is None or fu > fs))
        # Aditivo novo: análogo, comparando com seen_at do user.
        asa = card.pop("aditivo_seen_at", None)
        if adit_ts:
            card["aditivo_novo"] = (asa is None) or (adit_ts > asa.isoformat() if hasattr(asa, "isoformat") else str(asa))
        else:
            card["aditivo_novo"] = False
    return {"listas": listas, "cards": cards}


@app.get("/api/cards/{card_id}")
def card_detalhe(card_id: str, user: dict = Depends(require_user)):
    with conn() as c, c.cursor() as cur:
        cur.execute("""
            SELECT k.*, l.nome AS lista_nome,
                   COALESCE(ov.cliente,  proj.cliente)  AS cliente,
                   COALESCE(ov.endereco, proj.endereco) AS endereco,
                   COALESCE(ov.cnpj_cpf, proj.cnpj_cpf) AS cnpj_cpf,
                   proj.numero_proposta, proj.obra_code,
                   -- Lista completa de responsáveis (mesma do /api/board). Sem
                   -- isso o modal só via k.projetista_id (o primeiro) e escondia
                   -- o segundo responsável da obra.
                   COALESCE((
                       SELECT jsonb_agg(jsonb_build_object(
                           'projetista_id', cp.projetista_id,
                           'nome',          up.full_name,
                           'avatar_color',  up.avatar_color,
                           'tipos',         cp.tipos,
                           'tamanho',       cp.tamanho,
                           'prioridade',    cp.prioridade,
                           'prazo',         cp.prazo,
                           'etapa_projetista',    cp.etapa_projetista,
                           'etapa_projetista_em', cp.etapa_projetista_em
                       ) ORDER BY cp.delegado_em ASC)
                         FROM trello_projetos.card_projetistas cp
                         LEFT JOIN public.user_profiles up ON up.id = cp.projetista_id
                        WHERE cp.card_id = k.id
                   ), '[]'::jsonb) AS responsaveis
              FROM trello_projetos.cards k
              LEFT JOIN trello_projetos.listas l ON l.id = k.lista_id
              LEFT JOIN LATERAL (
                  SELECT p.cliente, p.endereco, p.cnpj_cpf, p.numero_proposta, p.obra_code
                    FROM gestao.projetos p
                   WHERE p.card_id = k.space_card_id
                   ORDER BY p.created_at DESC NULLS LAST
                   LIMIT 1
              ) proj ON true
              LEFT JOIN trello_projetos.card_override_dados ov ON ov.card_id = k.id
             WHERE k.id = %s
        """, (card_id,))
        card = cur.fetchone()
        if not card:
            raise HTTPException(404, "card não encontrado")
        # Projetista comum só enxerga cards em que é responsável.
        if not _user_pode_ver_card(cur, card_id, user):
            raise HTTPException(403, "esse card não foi delegado pra você")
        cur.execute("""
            SELECT id, nome, mime, bytes, url_trello, path_local, is_imagem, is_upload,
                   baixado, criado_em
            FROM trello_projetos.anexos WHERE card_id = %s ORDER BY criado_em DESC
        """, (card_id,))
        anexos = cur.fetchall()
        # Comentários históricos do Trello (feed antigo, autor sempre "Will Tape
        # Souza" porque era postado via token do setor). Mantém pra não perder o
        # histórico — a UI mostra separado dos comentários locais (novos).
        cur.execute("""
            SELECT id, autor, texto, data FROM trello_projetos.comentarios
            WHERE card_id = %s ORDER BY data DESC
        """, (card_id,))
        comentarios = cur.fetchall()
        # Comentários locais — nome real do login Space, com edit+delete.
        cur.execute("""
            SELECT id, user_id, autor_nome, autor_email, texto,
                   anexo_url, anexo_nome, anexo_mime, anexo_bytes,
                   created_at, edited_at
              FROM trello_projetos.comentarios_locais
             WHERE card_id = %s AND deleted_at IS NULL
             ORDER BY created_at DESC
             LIMIT 500
        """, (card_id,))
        comentarios_locais = [_ser_coment_local(r) for r in cur.fetchall()]
    # Nomes dos fiscais atribuídos no Cloud — mesmo merge do /api/board
    # (card do dept projetos + irmãos da obra). Sem isso o modal mostrava
    # a linha "Fiscal:" da descrição sempre em branco.
    fisc_map = _fiscais_por_card()
    nomes: list[str] = []
    vistos: set[str] = set()
    candidatos = [str(card.get("space_card_id") or ""),
                  *[str(x) for x in (card.get("space_card_ids_obra") or [])]]
    for cid in candidatos:
        for nome in fisc_map.get(cid, []) or []:
            key = nome.strip().lower()
            if key and key not in vistos:
                vistos.add(key)
                nomes.append(nome)
    card["fiscais_nomes"] = nomes
    return {**card, "anexos": anexos, "comentarios": comentarios,
            "comentarios_locais": comentarios_locais}


@app.get("/api/cards/{card_id}/aditivos")
def listar_aditivos(card_id: str, user: dict = Depends(require_user)):
    """Simulações aditivas vinculadas ao card (via space_card_id).
    Lê view public.aditivos_v do Cloud (Valor grava meta.eh_aditivo=true)."""
    with conn() as c, c.cursor() as cur:
        cur.execute("SELECT space_card_id, projetista_id FROM trello_projetos.cards WHERE id = %s",
                    (card_id,))
        row = cur.fetchone()
    if not row:
        raise HTTPException(404, "card não encontrado")
    if not _user_pode_ver_card(cur, card_id, user):
        raise HTTPException(403, "esse card não foi delegado pra você")
    space_id = row.get("space_card_id")
    if not space_id or not settings.supabase_key:
        return {"aditivos": []}
    try:
        r = httpx.get(
            f"{settings.supabase_url}/rest/v1/aditivos_v",
            params={
                "select": "id,numero,status,cliente,created_at,orcamentista,vendedor,pai_sim_id,meta",
                "card_id": f"eq.{space_id}",
                "order": "created_at.desc",
            },
            headers={"apikey": settings.supabase_key,
                     "Authorization": f"Bearer {settings.supabase_key}"},
            timeout=10,
        )
        r.raise_for_status()
        return {"aditivos": r.json()}
    except httpx.HTTPError as e:
        raise HTTPException(502, f"Cloud indisponível: {e}")


def _cloud_get(path: str, params: dict) -> list:
    """GET no REST do Cloud (Supabase) usando a service key.
    Retorna [] silenciosamente se o Cloud estiver fora — evita quebrar a UI.
    """
    if not settings.supabase_key:
        return []
    r = httpx.get(
        f"{settings.supabase_url}/rest/v1/{path}",
        params=params,
        headers={"apikey": settings.supabase_key,
                 "Authorization": f"Bearer {settings.supabase_key}"},
        timeout=15,
    )
    r.raise_for_status()
    return r.json() or []


@app.get("/api/cards/{card_id}/fiscal")
def listar_fiscal(card_id: str, user: dict = Depends(require_user)):
    """Tudo que o fiscal registrou no app dele (verifica/instala) — 1:1
    com a aba Fiscal do gestão. Puxa DIRETO do Cloud (Supabase REST): as
    tabelas fiscal_* no PG local ficam defasadas porque não há watcher que
    replique elas, então usar o mirror local mostrava só dado velho.
    """
    with conn() as c, c.cursor() as cur:
        cur.execute("""
            SELECT space_card_id, projetista_id, space_card_ids_obra
              FROM trello_projetos.cards WHERE id = %s
        """, (card_id,))
        row = cur.fetchone()
        if not row:
            raise HTTPException(404, "card não encontrado")
        if not _user_pode_ver_card(cur, card_id, user):
            raise HTTPException(403, "esse card não foi delegado pra você")
        space_id = row.get("space_card_id")
        vazio = {"laudos": [], "vistorias": [], "fotos": [],
                 "acompanhamento": None, "ocorrencias": []}
        if not space_id:
            return vazio
        # Irmãos = cards do Cloud pra mesma obra em depts diferentes (comercial,
        # orçamento, operacional, financeiro). Fiscal registra no OPERACIONAL,
        # então a query precisa ver todos, não só o card do dept projetos.
        irmaos = row.get("space_card_ids_obra") or []
        if not isinstance(irmaos, list):
            irmaos = []
        ids_obra = list({str(space_id), *[str(x) for x in irmaos]})
        cur.execute("SELECT id AS projeto_id, obra_code FROM gestao.projetos WHERE card_id = %s LIMIT 1",
                    (space_id,))
        p = cur.fetchone() or {}
        projeto_id = p.get("projeto_id")

    # Filtro "in.(uuid1,uuid2,…)" do PostgREST — cobre todos os irmãos.
    ids_filter = f"in.({','.join(ids_obra)})"
    try:
        laudos = _cloud_get("fiscal_laudos", {
            "select": "id,tipo,fiscal_nome,data_vistoria,data_agendamento,status,"
                      "observacoes,resultado,ocorrencias,created_at",
            "card_id": ids_filter,
            "order": "created_at.desc",
            "limit": "200",
        })
        vistorias = _cloud_get("fiscal_agenda", {
            "select": "id,tipo,obra,status,data_inicio,data_fim,notas,created_at",
            "card_id": ids_filter,
            "order": "created_at.desc",
            "limit": "100",
        })
        fotos = _cloud_get("fiscal_fotos", {
            "select": "id,laudo_id,ambiente,tipo,servico,descricao,url,created_at",
            "card_id": ids_filter,
            "order": "created_at.desc",
            "limit": "300",
        })
    except httpx.HTTPError as e:
        raise HTTPException(502, f"Cloud indisponível: {e}")
    # Renomeia observacoes -> descricao pra bater com o contrato antigo da aba.
    for lu in laudos:
        if "observacoes" in lu:
            lu["descricao"] = lu.pop("observacoes")

    acompanhamento = None
    if projeto_id:
        with conn() as c, c.cursor() as cur:
            cur.execute("""
                SELECT projeto_id, inicio_obra, previsao_entrega_manual,
                       descricao_produto, alertas, meta, updated_at
                  FROM gestao.obra_acompanhamento
                 WHERE projeto_id = %s
            """, (projeto_id,))
            acompanhamento = cur.fetchone()

    # Ocorrências vêm dos próprios laudos (campo texto).
    ocorrencias: list = []
    for lu in laudos:
        oc = lu.get("ocorrencias")
        if isinstance(oc, str) and oc.strip():
            ocorrencias.append({
                "id": f"{lu['id']}-oc",
                "titulo": f"Ocorrência ({lu.get('tipo') or 'laudo'})",
                "descricao": oc.strip(),
                "autor_email": lu.get("fiscal_nome"),
                "created_at": lu.get("created_at"),
            })

    def _ser(r):
        d = dict(r)
        for k, v in list(d.items()):
            if hasattr(v, "isoformat"):
                d[k] = v.isoformat()
        return d
    return {
        "laudos": laudos,
        "vistorias": vistorias,
        "fotos": fotos,
        "acompanhamento": _ser(acompanhamento) if acompanhamento else None,
        "ocorrencias": ocorrencias,
    }


ANEXOS_ADITIVO_DIR = Path(settings.data_dir) / "anexos" / "aditivo"
MAX_ANEXO_ADITIVO = 50 * 1024 * 1024  # 50 MB


def _sanitize_filename(nome: str) -> str:
    nome = (nome or "arquivo").strip().replace(" ", "_")
    return re.sub(r"[^A-Za-z0-9._-]", "", nome)[:120] or "arquivo"


def _ser_coment(r: dict) -> dict:
    return {
        "id": r["id"], "autor_nome": r["autor_nome"], "autor_email": r.get("autor_email"),
        "texto": r["texto"],
        "anexo_url":   r.get("anexo_url"),
        "anexo_nome":  r.get("anexo_nome"),
        "anexo_mime":  r.get("anexo_mime"),
        "anexo_bytes": r.get("anexo_bytes"),
        "created_at": r["created_at"].isoformat() if r.get("created_at") else None,
    }


@app.get("/api/cards/{card_id}/aditivo-comentarios")
def listar_aditivo_com(card_id: str, user: dict = Depends(require_user)):
    with conn() as c, c.cursor() as cur:
        cur.execute("SELECT projetista_id FROM trello_projetos.cards WHERE id = %s", (card_id,))
        row = cur.fetchone()
        if not row:
            raise HTTPException(404, "card não encontrado")
        if not _user_pode_ver_card(cur, card_id, user):
            raise HTTPException(403, "esse card não foi delegado pra você")
        cur.execute("""
            SELECT id, autor_nome, autor_email, texto, created_at,
                   anexo_url, anexo_nome, anexo_mime, anexo_bytes
              FROM trello_projetos.aditivo_comentarios
             WHERE card_id = %s
             ORDER BY created_at DESC
             LIMIT 200
        """, (card_id,))
        rows = cur.fetchall()
    return {"comentarios": [_ser_coment(r) for r in rows]}


@app.post("/api/cards/{card_id}/aditivo-comentarios")
async def criar_aditivo_com(
    card_id: str,
    texto: str = Form(""),
    arquivo: UploadFile | None = File(None),
    user: dict = Depends(require_user),
):
    texto = (texto or "").strip()
    if not texto and not arquivo:
        raise HTTPException(400, "informe texto ou anexo")
    if len(texto) > 4000:
        raise HTTPException(400, "texto muito longo")

    anexo_url = anexo_nome = anexo_mime = None
    anexo_bytes = None
    if arquivo is not None and arquivo.filename:
        content = await arquivo.read()
        if len(content) > MAX_ANEXO_ADITIVO:
            raise HTTPException(413, "anexo acima de 50 MB")
        nome_seguro = _sanitize_filename(arquivo.filename)
        prefixo = f"{int(time.time())}_{uuid.uuid4().hex[:6]}"
        dir_card = ANEXOS_ADITIVO_DIR / card_id
        dir_card.mkdir(parents=True, exist_ok=True)
        arq_path = dir_card / f"{prefixo}_{nome_seguro}"
        arq_path.write_bytes(content)
        anexo_url  = f"/anexos/aditivo/{card_id}/{arq_path.name}"
        anexo_nome = arquivo.filename
        anexo_mime = arquivo.content_type
        anexo_bytes = len(content)

    with conn() as c, c.cursor() as cur:
        cur.execute("SELECT projetista_id FROM trello_projetos.cards WHERE id = %s", (card_id,))
        row = cur.fetchone()
        if not row:
            raise HTTPException(404, "card não encontrado")
        if not _user_pode_ver_card(cur, card_id, user):
            raise HTTPException(403, "esse card não foi delegado pra você")
        cur.execute("""
            INSERT INTO trello_projetos.aditivo_comentarios
                (card_id, user_id, autor_nome, autor_email, texto,
                 anexo_url, anexo_nome, anexo_mime, anexo_bytes)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
            RETURNING id, autor_nome, autor_email, texto, created_at,
                      anexo_url, anexo_nome, anexo_mime, anexo_bytes
        """, (card_id, user["id"], user.get("nome") or user.get("email") or "?",
              user.get("email"), texto or "(anexo)",
              anexo_url, anexo_nome, anexo_mime, anexo_bytes))
        r = cur.fetchone()
    return _ser_coment(r)


"""─── Comentários locais do card (substituem os do Trello desde 25/08) ───

Motivação: até então o app postava via API do Trello com o token do setor
(conta do Will), então TODO comentário aparecia com autor "Will". Agora vai
com nome/email do login Space, e cada autor pode editar/apagar o próprio
(gestora pode qualquer um). Anexos usam a mesma pasta do aditivo pra reaproveitar
o servidor estático.
"""


ANEXOS_COMENT_DIR = Path(settings.data_dir) / "anexos" / "coment"


def _ser_coment_local(r: dict) -> dict:
    return {
        "id": r["id"], "autor_nome": r["autor_nome"], "autor_email": r.get("autor_email"),
        "user_id": str(r["user_id"]) if r.get("user_id") else None,
        "texto": r["texto"],
        "anexo_url":   r.get("anexo_url"),
        "anexo_nome":  r.get("anexo_nome"),
        "anexo_mime":  r.get("anexo_mime"),
        "anexo_bytes": r.get("anexo_bytes"),
        "created_at": r["created_at"].isoformat() if r.get("created_at") else None,
        "edited_at": r["edited_at"].isoformat() if r.get("edited_at") else None,
    }


def _guard_ver_card(cur, card_id: str, user: dict) -> dict:
    """404 se card não existir, 403 se projetista comum e o card não é dele.
    Retorna a row do card pra reuso."""
    cur.execute("SELECT projetista_id FROM trello_projetos.cards WHERE id = %s", (card_id,))
    row = cur.fetchone()
    if not row:
        raise HTTPException(404, "card não encontrado")
    if not _user_pode_ver_card(cur, card_id, user):
        raise HTTPException(403, "esse card não foi delegado pra você")
    return row


@app.get("/api/cards/{card_id}/comentarios-locais")
def listar_coment_locais(card_id: str, user: dict = Depends(require_user)):
    with conn() as c, c.cursor() as cur:
        _guard_ver_card(cur, card_id, user)
        cur.execute("""
            SELECT id, user_id, autor_nome, autor_email, texto,
                   anexo_url, anexo_nome, anexo_mime, anexo_bytes,
                   created_at, edited_at
              FROM trello_projetos.comentarios_locais
             WHERE card_id = %s AND deleted_at IS NULL
             ORDER BY created_at DESC
             LIMIT 500
        """, (card_id,))
        rows = cur.fetchall()
    return {"comentarios": [_ser_coment_local(r) for r in rows]}


@app.post("/api/cards/{card_id}/comentarios-locais")
async def criar_coment_local(
    card_id: str,
    texto: str = Form(""),
    arquivo: UploadFile | None = File(None),
    user: dict = Depends(require_user),
):
    texto = (texto or "").strip()
    if not texto and not arquivo:
        raise HTTPException(400, "informe texto ou anexo")
    if len(texto) > 4000:
        raise HTTPException(400, "texto muito longo")

    anexo_url = anexo_nome = anexo_mime = None
    anexo_bytes = None
    if arquivo is not None and arquivo.filename:
        content = await arquivo.read()
        if len(content) > MAX_ANEXO_ADITIVO:
            raise HTTPException(413, "anexo acima de 50 MB")
        nome_seguro = _sanitize_filename(arquivo.filename)
        prefixo = f"{int(time.time())}_{uuid.uuid4().hex[:6]}"
        dir_card = ANEXOS_COMENT_DIR / card_id
        dir_card.mkdir(parents=True, exist_ok=True)
        arq_path = dir_card / f"{prefixo}_{nome_seguro}"
        arq_path.write_bytes(content)
        anexo_url  = f"/anexos/coment/{card_id}/{arq_path.name}"
        anexo_nome = arquivo.filename
        anexo_mime = arquivo.content_type
        anexo_bytes = len(content)

    with conn() as c, c.cursor() as cur:
        _guard_ver_card(cur, card_id, user)
        cur.execute("""
            INSERT INTO trello_projetos.comentarios_locais
                (card_id, user_id, autor_nome, autor_email, texto,
                 anexo_url, anexo_nome, anexo_mime, anexo_bytes)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
            RETURNING id, user_id, autor_nome, autor_email, texto, created_at, edited_at,
                      anexo_url, anexo_nome, anexo_mime, anexo_bytes
        """, (card_id, user["id"], user.get("nome") or user.get("email") or "?",
              user.get("email"), texto or "(anexo)",
              anexo_url, anexo_nome, anexo_mime, anexo_bytes))
        r = cur.fetchone()
    return _ser_coment_local(r)


class ComentLocalPatch(BaseModel):
    texto: str


@app.patch("/api/cards/{card_id}/comentarios-locais/{coment_id}")
def editar_coment_local(card_id: str, coment_id: int, body: ComentLocalPatch,
                        user: dict = Depends(require_user)):
    texto = (body.texto or "").strip()
    if not texto:
        raise HTTPException(400, "texto vazio")
    if len(texto) > 4000:
        raise HTTPException(400, "texto muito longo")
    with conn() as c, c.cursor() as cur:
        _guard_ver_card(cur, card_id, user)
        # Só o autor edita o próprio comentário (gestora não edita alheio pra
        # não parecer que "reescreveu" o que alguém disse — só apaga).
        cur.execute("""
            SELECT user_id FROM trello_projetos.comentarios_locais
             WHERE id = %s AND card_id = %s AND deleted_at IS NULL
        """, (coment_id, card_id))
        row = cur.fetchone()
        if not row:
            raise HTTPException(404, "comentário não encontrado")
        if str(row["user_id"]) != user["id"]:
            raise HTTPException(403, "só o autor pode editar")
        cur.execute("""
            UPDATE trello_projetos.comentarios_locais
               SET texto = %s, edited_at = now()
             WHERE id = %s
         RETURNING id, user_id, autor_nome, autor_email, texto, created_at, edited_at,
                   anexo_url, anexo_nome, anexo_mime, anexo_bytes
        """, (texto, coment_id))
        r = cur.fetchone()
    return _ser_coment_local(r)


@app.delete("/api/cards/{card_id}/comentarios-locais/{coment_id}")
def apagar_coment_local(card_id: str, coment_id: int, user: dict = Depends(require_user)):
    with conn() as c, c.cursor() as cur:
        _guard_ver_card(cur, card_id, user)
        cur.execute("""
            SELECT user_id FROM trello_projetos.comentarios_locais
             WHERE id = %s AND card_id = %s AND deleted_at IS NULL
        """, (coment_id, card_id))
        row = cur.fetchone()
        if not row:
            raise HTTPException(404, "comentário não encontrado")
        # Autor apaga o próprio; gestora apaga qualquer um.
        if not user["is_gestora"] and str(row["user_id"]) != user["id"]:
            raise HTTPException(403, "só o autor ou a gestora podem apagar")
        cur.execute("""
            UPDATE trello_projetos.comentarios_locais
               SET deleted_at = now()
             WHERE id = %s
        """, (coment_id,))
    return {"ok": True}


@app.delete("/api/cards/{card_id}")
def arquivar_card_endpoint(card_id: str, user: dict = Depends(require_gestora)):
    """Arquiva card (closed=true) — só gestora. Card some do kanban imediato
    (query filtra NOT closed) mas fica no banco; reabrir = UPDATE closed=false."""
    _board_write(board_local.arquivar_card, card_id)
    return {"ok": True, "arquivado": card_id}


@app.get("/api/duplicados")
def listar_duplicados(user: dict = Depends(require_gestora)):
    """Lista cards com título duplicado (norm=lower+trim). Só gestora."""
    with conn() as c, c.cursor() as cur:
        cur.execute("""
            WITH norm AS (
                SELECT k.id, k.nome, k.space_card_id::text AS space_id,
                       COALESCE(k.projetista_id::text,'') AS proj_id,
                       k.lista_id, k.date_last_activity, l.nome AS lista_nome,
                       LOWER(TRIM(k.nome)) AS n_norm
                  FROM trello_projetos.cards k
                  LEFT JOIN trello_projetos.listas l ON l.id = k.lista_id
                 WHERE NOT k.closed
            ),
            dup AS (
                SELECT n_norm FROM norm GROUP BY n_norm HAVING COUNT(*) > 1
            )
            SELECT n.id, n.nome, n.space_id, n.proj_id, n.lista_nome, n.date_last_activity
              FROM norm n
              JOIN dup d ON d.n_norm = n.n_norm
             ORDER BY n.n_norm, n.date_last_activity DESC NULLS LAST
        """)
        rows = cur.fetchall()
    grupos: dict[str, list] = {}
    for r in rows:
        k = r["nome"].strip().lower()
        grupos.setdefault(k, []).append({
            "id": r["id"], "nome": r["nome"], "lista": r["lista_nome"],
            "space_card_id": r["space_id"], "projetista_id": r["proj_id"] or None,
            "date_last_activity": r["date_last_activity"].isoformat() if r["date_last_activity"] else None,
        })
    return {"grupos": [{"nome": v[0]["nome"], "cards": v} for v in grupos.values()]}


@app.post("/api/cards/{card_id}/notif-seen/{tipo}")
def marcar_notif_seen(card_id: str, tipo: str, user: dict = Depends(require_user)):
    """Registra que o usuário abriu a aba `tipo` (fiscal|aditivo) deste card
    agora — apaga o chip 'NOVO' correspondente no kanban."""
    if tipo not in ("fiscal", "aditivo"):
        raise HTTPException(400, "tipo inválido")
    with conn() as c, c.cursor() as cur:
        cur.execute("SELECT 1 FROM trello_projetos.cards WHERE id = %s", (card_id,))
        if not cur.fetchone():
            raise HTTPException(404, "card não encontrado")
        cur.execute("""
            INSERT INTO trello_projetos.notif_seen (user_id, card_id, tipo, seen_at)
            VALUES (%s, %s, %s, now())
            ON CONFLICT (user_id, card_id, tipo)
            DO UPDATE SET seen_at = EXCLUDED.seen_at
        """, (user["id"], card_id, tipo))
    return {"ok": True}


"""─── Edição (escreve direto no banco local via board_local) ───"""


class CardPatch(BaseModel):
    nome: str | None = None
    descricao: str | None = None
    due: str | None = None          # "" limpa o prazo
    due_complete: bool | None = None
    lista_id: str | None = None


class CardDadosPatch(BaseModel):
    cliente:  str | None = None
    endereco: str | None = None
    cnpj_cpf: str | None = None


class CheckItemBody(BaseModel):
    done: bool


class CheckItemNovo(BaseModel):
    nome: str


def _board_write(fn, *args):
    """Converte ValueError do board_local (card/checklist/label inexistente)
    em 404 — mesma ergonomia do wrapper antigo do Trello."""
    try:
        return fn(*args)
    except ValueError as e:
        raise HTTPException(404, str(e))


@app.get("/api/board/meta")
def board_meta():
    return board_local.board_meta()


# Criação de card removida 02/09 (decisão Will): card/projeto novo nasce SÓ no
# Home Broker — os outros sistemas apenas atualizam em cima de card existente.
# O endpoint POST /api/cards (criava card no Trello + espelho local) saiu junto
# com o botão "+ Novo Card" do frontend.

TIPOS_DELEGACAO = ["Piso", "Forro", "Deck", "Marcenaria", "Escada", "Paineis", "Outros"]


TAMANHOS_DELEGACAO = ["pequeno", "medio", "grande"]
PRIORIDADES_DELEGACAO = ["normal", "urgente", "baixa"]


class ResponsavelIn(BaseModel):
    """Uma linha de card_projetistas — cada responsável tem SEUS PRÓPRIOS
    tipos/tamanho/prioridade/prazo (a mesma obra pode ter Vinicius fazendo
    Piso pra sexta e Suelen fazendo Marcenaria pra segunda)."""
    projetista_id: str
    tipos: list[str] = []
    tamanho: str | None = None
    prioridade: str = "normal"
    prazo: str | None = None


class DelegarBody(BaseModel):
    # ── Formato novo (Will 26/08) ─────────────────────────────────────
    # Lista completa de responsáveis. Substitui TUDO que estava atribuído
    # (adiciona novos, remove ausentes, atualiza mantidos). [] = tira todos.
    responsaveis: list[ResponsavelIn] | None = None
    # ── Formato legado (1 responsável único) ──────────────────────────
    # Mantido pro CardModal do card + integrações antigas. Se
    # `responsaveis` não veio, mas veio `projetista_id`, faz upsert dessa
    # única pessoa (SUBSTITUI a lista — comportamento igual ao antigo).
    projetista_id: str | None = None
    tipos: list[str] | None = None
    tamanho: str | None = None
    prioridade: str | None = None
    prazo: str | None = None           # YYYY-MM-DD


def _valida_responsavel(cur, r: ResponsavelIn) -> None:
    """Sanity: pessoa existe, tá ativa e tem acesso ao setor Projetos."""
    cur.execute("""
        SELECT id, dept_permissions
          FROM public.user_profiles
         WHERE id = %s AND ativo = true
    """, (r.projetista_id,))
    row = cur.fetchone()
    if not row:
        raise HTTPException(404, f"projetista {r.projetista_id} não encontrada/ativa")
    dp = row["dept_permissions"] or {}
    if isinstance(dp, list):
        dp = next((x for x in dp if isinstance(x, dict)), {})
    perm = dp.get("projetos") if isinstance(dp, dict) else None
    if not perm:
        raise HTTPException(400,
            f"pessoa {r.projetista_id} não tem acesso ao setor Projetos no Space")
    invalidos = [t for t in (r.tipos or []) if t not in TIPOS_DELEGACAO]
    if invalidos:
        raise HTTPException(400, f"tipos inválidos: {invalidos}")
    if r.tamanho and r.tamanho not in TAMANHOS_DELEGACAO:
        raise HTTPException(400, f"tamanho inválido: {r.tamanho}")
    if r.prioridade and r.prioridade not in PRIORIDADES_DELEGACAO:
        raise HTTPException(400, f"prioridade inválida: {r.prioridade}")
    if r.prazo:
        try:
            datetime.date.fromisoformat(r.prazo)
        except ValueError:
            raise HTTPException(400, f"prazo inválido: {r.prazo}")


def _aplicar_responsaveis(cur, card_id: str, lista: list[ResponsavelIn],
                          delegado_por: str) -> None:
    """Faz a lista de card_projetistas ficar exatamente igual a `lista`:
    - Remove quem sumiu
    - Insere quem entrou (etapa_projetista = 'a_iniciar')
    - Atualiza tipos/tamanho/prioridade/prazo de quem continuou (preserva
      etapa_projetista atual daquela pessoa — não quer resetar fase se só
      trocou prazo)."""
    ids_novos = {r.projetista_id for r in lista}
    cur.execute("""
        SELECT projetista_id FROM trello_projetos.card_projetistas
         WHERE card_id = %s
    """, (card_id,))
    ids_antigos = {str(x["projetista_id"]) for x in cur.fetchall()}
    # DELETE dos que sumiram
    remover = ids_antigos - ids_novos
    if remover:
        cur.execute("""
            DELETE FROM trello_projetos.card_projetistas
             WHERE card_id = %s AND projetista_id = ANY(%s::uuid[])
        """, (card_id, list(remover)))
    # UPSERT dos que ficaram/entraram
    for r in lista:
        cur.execute("""
            INSERT INTO trello_projetos.card_projetistas
                (card_id, projetista_id, tipos, tamanho, prioridade, prazo,
                 delegado_em, delegado_por)
            VALUES (%s, %s, %s::jsonb, %s, %s, %s, now(), %s)
            ON CONFLICT (card_id, projetista_id) DO UPDATE SET
                tipos      = EXCLUDED.tipos,
                tamanho    = EXCLUDED.tamanho,
                prioridade = EXCLUDED.prioridade,
                prazo      = EXCLUDED.prazo
        """, (card_id, r.projetista_id, json.dumps(r.tipos or []),
              r.tamanho or None, r.prioridade or "normal",
              r.prazo or None, delegado_por))


@app.patch("/api/cards/{card_id}/projetista")
def delegar_card(card_id: str, body: DelegarBody,
                 user: dict = Depends(require_gestora)):
    """Só a gestora delega/edita responsáveis de um card. Um card pode ter
    N responsáveis (Will 26/08). Cada um com tipos/tamanho/prioridade/prazo
    próprio.

    Formato novo: `{responsaveis: [{projetista_id, tipos, tamanho, ...}, ...]}`
    Substitui a lista inteira ([] = tira todos).

    Formato legado: `{projetista_id, tipos?, tamanho?, ...}` — mantido pra
    quem só sabe atribuir 1 pessoa (CardModal do card, integrações antigas).
    Comportamento: substitui a lista inteira por essa única pessoa."""
    with conn() as c, c.cursor() as cur:
        cur.execute("SELECT id FROM trello_projetos.cards WHERE id = %s", (card_id,))
        if not cur.fetchone():
            raise HTTPException(404, "card não encontrado")

        # Normaliza os 2 formatos numa única lista.
        if body.responsaveis is not None:
            lista = body.responsaveis
        elif body.projetista_id:
            lista = [ResponsavelIn(
                projetista_id=body.projetista_id,
                tipos=body.tipos or [],
                tamanho=body.tamanho or None,
                prioridade=body.prioridade or "normal",
                prazo=body.prazo or None,
            )]
        else:
            # projetista_id=None + responsaveis=None = tirar todo mundo
            lista = []

        for r in lista:
            _valida_responsavel(cur, r)

        _aplicar_responsaveis(cur, card_id, lista,
                              user.get("nome") or user.get("email") or "?")

    # Retorna estado atual pra o frontend atualizar.
    with conn() as c, c.cursor() as cur:
        cur.execute("""
            SELECT cp.projetista_id, cp.tipos, cp.tamanho, cp.prioridade, cp.prazo,
                   cp.etapa_projetista, cp.etapa_projetista_em,
                   up.full_name AS nome, up.avatar_color
              FROM trello_projetos.card_projetistas cp
              LEFT JOIN public.user_profiles up ON up.id = cp.projetista_id
             WHERE cp.card_id = %s
             ORDER BY cp.delegado_em ASC
        """, (card_id,))
        responsaveis = [dict(x) for x in cur.fetchall()]
    # Backcompat: também devolve projetista_id/tipos do "primeiro" pra o
    # CardModal legado atualizar sem quebrar.
    primeiro = responsaveis[0] if responsaveis else None
    return {"ok": True,
            "responsaveis": responsaveis,
            "projetista_id": (primeiro or {}).get("projetista_id"),
            "tipos": (primeiro or {}).get("tipos")}


# Fases do kanban interno do projetista, na ordem das colunas da UI.
# São PARALELAS às listas do board principal: mover aqui não move o kanban.
ETAPAS_PROJETISTA = ["a_iniciar", "em_andamento", "revisao", "enviado", "aprovado"]


class EtapaProjetistaBody(BaseModel):
    etapa: str   # uma das ETAPAS_PROJETISTA
    # Multi-responsáveis (Will 26/08): cada pessoa tem SUA fase.
    # Se omitido, gestora precisa dizer qual pessoa mover; projetista
    # comum move a fase DELE (user.id).
    projetista_id: str | None = None


@app.patch("/api/cards/{card_id}/etapa-projetista")
def mover_etapa_projetista(card_id: str, body: EtapaProjetistaBody,
                           user: dict = Depends(require_user)):
    """Move o card entre as fases internas do projetista (A Iniciar ...
    Aprovado). NÃO mexe na lista do board nem no kanban principal; é
    estado exclusivo do app (Will 25/08: "o que eles fazem nao move o
    card do kanban principal"). Cada responsável tem SUA fase (Will 26/08).

    Regras de alvo:
      - projetista comum: move só a fase DELE (ignora body.projetista_id)
      - gestora + projetista_id: move a fase dessa pessoa específica
      - gestora sem projetista_id: move a fase de TODOS os responsáveis do
        card em bloco (comportamento antigo — kanban da gestora arrasta o
        card inteiro)."""
    if body.etapa not in ETAPAS_PROJETISTA:
        raise HTTPException(400, f"etapa inválida: {body.etapa}")
    with conn() as c, c.cursor() as cur:
        cur.execute("SELECT id FROM trello_projetos.cards WHERE id = %s", (card_id,))
        if not cur.fetchone():
            raise HTTPException(404, "card não encontrado")
        autor = user.get("nome") or user.get("email") or "?"
        if not user["is_gestora"]:
            # Projetista comum: só a fase dele.
            cur.execute("""
                UPDATE trello_projetos.card_projetistas
                   SET etapa_projetista     = %s,
                       etapa_projetista_em  = now(),
                       etapa_projetista_por = %s
                 WHERE card_id = %s AND projetista_id = %s
             RETURNING projetista_id
            """, (body.etapa, autor, card_id, user["id"]))
            if not cur.fetchone():
                raise HTTPException(403,
                    "esse card não foi delegado pra você")
            return {"ok": True, "etapa": body.etapa,
                    "projetista_id": user["id"]}
        # Gestora
        if body.projetista_id:
            cur.execute("""
                UPDATE trello_projetos.card_projetistas
                   SET etapa_projetista     = %s,
                       etapa_projetista_em  = now(),
                       etapa_projetista_por = %s
                 WHERE card_id = %s AND projetista_id = %s
             RETURNING projetista_id
            """, (body.etapa, autor, card_id, body.projetista_id))
            if not cur.fetchone():
                raise HTTPException(404,
                    "essa pessoa não é responsável por este card")
        else:
            # Move todos os responsáveis do card em bloco.
            cur.execute("""
                UPDATE trello_projetos.card_projetistas
                   SET etapa_projetista     = %s,
                       etapa_projetista_em  = now(),
                       etapa_projetista_por = %s
                 WHERE card_id = %s
             RETURNING projetista_id
            """, (body.etapa, autor, card_id))
            if not cur.fetchone():
                raise HTTPException(400,
                    "esse card ainda não tem responsável — atribua alguém antes")
    return {"ok": True, "etapa": body.etapa,
            "projetista_id": body.projetista_id}


@app.patch("/api/cards/{card_id}")
def editar_card(card_id: str, p: CardPatch):
    params = {}
    if p.nome is not None:
        params["name"] = p.nome
    if p.descricao is not None:
        params["desc"] = p.descricao
    if p.due is not None:
        params["due"] = p.due or "null"
    if p.due_complete is not None:
        params["dueComplete"] = "true" if p.due_complete else "false"
    if p.lista_id is not None:
        params["idList"] = p.lista_id
    if not params:
        raise HTTPException(400, "nada pra editar")
    _board_write(board_local.escrever_card, card_id, params)
    return {"ok": True}


@app.patch("/api/cards/{card_id}/dados")
def editar_card_dados(card_id: str, p: CardDadosPatch, user: dict = Depends(require_user)):
    """Sobrepõe cliente/endereco/CNPJ do card. Só gestora edita — projetista
    comum vê mas não muda. String vazia limpa o override (volta pro dado do Space)."""
    if not user["is_gestora"]:
        raise HTTPException(403, "só a gestora edita dados do cliente")
    with conn() as c, c.cursor() as cur:
        cur.execute("SELECT id FROM trello_projetos.cards WHERE id = %s", (card_id,))
        if not cur.fetchone():
            raise HTTPException(404, "card não encontrado")
        norm = lambda v: (v.strip() or None) if isinstance(v, str) else v
        cli, end, cnpj = norm(p.cliente), norm(p.endereco), norm(p.cnpj_cpf)
        cur.execute("""
            INSERT INTO trello_projetos.card_override_dados
                (card_id, cliente, endereco, cnpj_cpf, updated_at, updated_by)
            VALUES (%s, %s, %s, %s, now(), %s)
            ON CONFLICT (card_id) DO UPDATE SET
              cliente    = EXCLUDED.cliente,
              endereco   = EXCLUDED.endereco,
              cnpj_cpf   = EXCLUDED.cnpj_cpf,
              updated_at = now(),
              updated_by = EXCLUDED.updated_by
        """, (card_id, cli, end, cnpj, user["id"]))
    return {"ok": True, "cliente": cli, "endereco": end, "cnpj_cpf": cnpj}


@app.put("/api/cards/{card_id}/checkitem/{item_id}")
def marcar_checkitem(card_id: str, item_id: str, b: CheckItemBody):
    _board_write(board_local.marcar_checkitem, card_id, item_id, b.done)
    return {"ok": True}


@app.post("/api/cards/{card_id}/checklists/{checklist_id}/itens")
def add_checkitem(card_id: str, checklist_id: str, b: CheckItemNovo):
    nome = b.nome.strip()
    if not nome:
        raise HTTPException(400, "item vazio")
    _board_write(board_local.add_checkitem, card_id, checklist_id, nome)
    return {"ok": True}


class ChecklistNovo(BaseModel):
    nome: str


@app.post("/api/cards/{card_id}/checklists")
def add_checklist(card_id: str, b: ChecklistNovo):
    nome = b.nome.strip()
    if not nome:
        raise HTTPException(400, "nome vazio")
    res = _board_write(board_local.add_checklist, card_id, nome)
    return {"ok": True, "id": res.get("id"), "nome": res.get("name") or nome}


@app.delete("/api/cards/{card_id}/checklists/{checklist_id}")
def rm_checklist(card_id: str, checklist_id: str):
    _board_write(board_local.remover_checklist, card_id, checklist_id)
    return {"ok": True}


@app.delete("/api/cards/{card_id}/checklists/{checklist_id}/itens/{item_id}")
def rm_checkitem(card_id: str, checklist_id: str, item_id: str):
    _board_write(board_local.remover_checkitem, card_id, checklist_id, item_id)
    return {"ok": True}


@app.post("/api/cards/{card_id}/anexos")
async def anexar(card_id: str, arquivo: UploadFile = File(...)):
    content = await arquivo.read()
    if not content:
        raise HTTPException(400, "arquivo vazio")
    if len(content) > 100 * 1024 * 1024:
        raise HTTPException(413, "arquivo acima de 100 MB")
    nome = arquivo.filename or "arquivo"
    res = _board_write(board_local.anexar_arquivo, card_id, nome, content, arquivo.content_type)
    return {"ok": True, **res}


@app.delete("/api/cards/{card_id}/anexos/{anexo_id}")
def rm_anexo(card_id: str, anexo_id: str):
    _board_write(board_local.remover_anexo, card_id, anexo_id)
    return {"ok": True}


# POST /api/cards/{id}/comentarios (Trello) removido 02/09 — comentário novo
# vai SÓ pelos comentarios-locais (nome real do login). O feed antigo do
# Trello segue visível como histórico no detalhe do card.


@app.post("/api/cards/{card_id}/labels/{label_id}")
def add_label(card_id: str, label_id: str):
    _board_write(board_local.toggle_label, card_id, label_id, True)
    return {"ok": True}


@app.delete("/api/cards/{card_id}/labels/{label_id}")
def rm_label(card_id: str, label_id: str):
    _board_write(board_local.toggle_label, card_id, label_id, False)
    return {"ok": True}


@app.post("/api/cards/{card_id}/membros/{membro_id}")
def add_membro(card_id: str, membro_id: str):
    _board_write(board_local.toggle_membro, card_id, membro_id, True)
    return {"ok": True}


@app.delete("/api/cards/{card_id}/membros/{membro_id}")
def rm_membro(card_id: str, membro_id: str):
    _board_write(board_local.toggle_membro, card_id, membro_id, False)
    return {"ok": True}
