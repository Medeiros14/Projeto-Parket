"""Documentos unificados — o card é ÚNICO em todos os setores.

Agrega AO VIVO (padrão Core: ler cross-fonte, nunca espelhar) os documentos
do cliente independente de onde foram anexados:

  - Valor (ops.cards_solicitacao.details): anexos do orçamento, mapa (PDF e
    print do Status), link da proposta
  - Contrato assinado (contratos_docusign, espelho no PG local)
  - Projetos (trello_projetos.anexos, servidos em projetos.parket.works/anexos/)
  - Projeto executivo + docs do gestão (gestao.documentos)
  - Produção (producao_ordens.anexos — cobre anexo manual feito na OP)
  - Pasta do Drive do cliente (kanban_cards.details.drive_folder_id)

Aceita QUALQUER id da cadeia: gestao.projetos.id, kanban_cards.id (Cloud),
card Valor (ops.cards_solicitacao.id), OP do PCP ("OP-xxxx") ou card Trello.
A visibilidade por etapa do kanban (fase 2) entra depois por cima deste payload.
"""
import json
import logging
import os
import re

import httpx
from fastapi import APIRouter, File, Form, HTTPException, UploadFile

from .db import conn

log = logging.getLogger("gestao.docs")
router = APIRouter()

VALORIA_PROJECT = "skbjmlzgaeupflujomzw"
SUPABASE_URL = os.environ.get("SUPABASE_URL", "https://hbxpilrxmitvzebluoom.supabase.co")
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_KEY", "")
_MGMT_PAT_FILE = os.environ.get("SUPABASE_MGMT_PAT_FILE", "/run/secrets/supabase_mgmt_pat")

PROPOSTA_BASE = "https://valor.parket.works/proposta"
DRAW_MAPA_BASE = "https://draw.parket.works/status/mapa-valoria"
PROJETOS_ANEXOS_BASE = "https://projetos.parket.works/anexos"
DOCUSIGN_PDF_BASE = "https://core.parket.works/api/docusign/envelopes"


def _mgmt_pat() -> str | None:
    try:
        with open(_MGMT_PAT_FILE) as f:
            return f.read().strip()
    except Exception:
        return None


def _valoria_sql(query: str) -> list[dict]:
    """SQL read-only no Supabase da Valoria via Management API (mesma via do
    compras-contratos-watcher). Só interpolar UUIDs — nunca texto livre."""
    pat = _mgmt_pat()
    if not pat:
        return []
    try:
        r = httpx.post(
            f"https://api.supabase.com/v1/projects/{VALORIA_PROJECT}/database/query",
            headers={"Authorization": f"Bearer {pat}", "Content-Type": "application/json"},
            json={"query": query}, timeout=20.0,
        )
        if r.status_code >= 400:
            log.warning("valoria_sql %s: %s", r.status_code, r.text[:200])
            return []
        return r.json() or []
    except Exception:
        log.warning("valoria_sql_fail", exc_info=True)
        return []


def _cloud_get(table: str, params: dict) -> list[dict]:
    if not SUPABASE_KEY:
        return []
    try:
        r = httpx.get(f"{SUPABASE_URL}/rest/v1/{table}", params=params, headers={
            "apikey": SUPABASE_KEY, "Authorization": f"Bearer {SUPABASE_KEY}",
        }, timeout=15.0)
        if r.status_code >= 400:
            return []
        return r.json() or []
    except Exception:
        return []


_UUID_RE = __import__("re").compile(r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$")


def _is_uuid(s: str) -> bool:
    return bool(_UUID_RE.match((s or "").lower()))


def _jsonb(v):
    if isinstance(v, str):
        try:
            return json.loads(v)
        except Exception:
            return {}
    return v or {}


# nomes de arquivo que carregam preço e por isso não podem ir pro campo
RE_DOC_VALOR = re.compile(r"(proposta|contrato|or[çc]amento)", re.I)


def _doc_tem_valor(nome: str | None) -> bool:
    return bool(RE_DOC_VALOR.search(nome or ""))


# ── coleta de anexos de um details (mesma regra do AnexosBox/watcher) ────────

def _coletar_anexos_det(det: dict, seen: set, out: list, origem: str):
    mp = det.get("mapa_pdf")
    listas = []
    if isinstance(mp, dict) and mp.get("url"):
        listas.append([{**mp, "name": mp.get("name") or "Mapa da obra — PDF"}])
    for k in ("attachments", "anexos", "anexos_origem"):
        v = det.get(k)
        if isinstance(v, list):
            listas.append(v)
    for lista in listas:
        for a in lista:
            if not isinstance(a, dict):
                continue
            url = a.get("url") or a.get("webViewLink")
            if not url or url in seen:
                continue
            seen.add(url)
            mime = a.get("mimeType") or a.get("type") or ("link" if a.get("kind") == "link" else None)
            out.append({"name": a.get("name") or url, "url": url, "mime": mime,
                        "uploaded_at": a.get("uploadedAt") or a.get("uploaded_at"), "origem": origem})


# ── resolução de identidade ──────────────────────────────────────────────────

def _resolver(any_id: str) -> dict:
    """Monta o contexto {projeto_id, card_id, valoria_card_id, valoria_sim_id,
    contrato_id, trello_card_id, cliente} a partir de qualquer id da cadeia."""
    ctx = {"projeto_id": None, "card_id": None, "valoria_card_id": None,
           "valoria_sim_id": None, "contrato_id": None, "trello_card_id": None,
           "cliente": None, "op_id": None}

    with conn() as c, c.cursor() as cur:
        if _is_uuid(any_id):
            cur.execute("""
                SELECT id::text, card_id::text, simulacao_id::text, contrato_id::text, cliente
                  FROM gestao.projetos WHERE id::text = %s OR card_id::text = %s
                 ORDER BY (id::text = %s) DESC LIMIT 1
            """, (any_id, any_id, any_id))
            p = cur.fetchone()
            if p:
                ctx.update(projeto_id=p["id"], card_id=p["card_id"],
                           contrato_id=p["contrato_id"], cliente=p["cliente"])
                if p["simulacao_id"]:
                    cur.execute("SELECT meta->>'valoria_simulacao_id' AS v FROM simulacao_projetos WHERE id::text = %s",
                                (p["simulacao_id"],))
                    row = cur.fetchone()
                    if row and row.get("v"):
                        ctx["valoria_sim_id"] = row["v"]
            if not ctx["card_id"]:
                cur.execute("SELECT id::text, title FROM public.kanban_cards WHERE id::text = %s", (any_id,))
                k = cur.fetchone()
                if k:
                    ctx["card_id"] = k["id"]
                    ctx["cliente"] = ctx["cliente"] or k.get("title")
        elif any_id.upper().startswith("OP-"):
            ctx["op_id"] = any_id.upper()
        else:
            # id de card do Trello (24 hex) ou short_link
            cur.execute("""
                SELECT id, nome, space_card_id::text
                  FROM trello_projetos.cards WHERE id = %s OR short_link = %s LIMIT 1
            """, (any_id, any_id))
            t = cur.fetchone()
            if t:
                ctx["trello_card_id"] = t["id"]
                ctx["cliente"] = (t["nome"] or "").split("|")[0].strip()
                ctx["card_id"] = t.get("space_card_id")

    # OP do PCP → ids da cadeia direto da ordem (Cloud)
    if ctx["op_id"]:
        ops = _cloud_get("producao_ordens", {
            "select": "id,cliente_projeto,valoria_card_id,valoria_simulacao_id,contrato_id",
            "id": f"eq.{ctx['op_id']}", "limit": "1"})
        if ops:
            o = ops[0]
            ctx.update(valoria_card_id=o.get("valoria_card_id"),
                       valoria_sim_id=o.get("valoria_simulacao_id"),
                       contrato_id=ctx["contrato_id"] or o.get("contrato_id"),
                       cliente=(o.get("cliente_projeto") or "").split(" · ")[0].strip() or ctx["cliente"])

    # projeto do gestão via contrato (perna OP) ou cliente (perna Trello)
    if not ctx["projeto_id"] and (ctx["contrato_id"] or ctx["cliente"]):
        with conn() as c, c.cursor() as cur:
            cur.execute("""
                SELECT id::text, card_id::text, simulacao_id::text, contrato_id::text, cliente
                  FROM gestao.projetos
                 WHERE (contrato_id::text = %s AND %s::text IS NOT NULL)
                    OR upper(btrim(cliente)) = upper(btrim(%s))
                 ORDER BY (contrato_id::text = %s) DESC, created_at LIMIT 1
            """, (ctx["contrato_id"], ctx["contrato_id"], ctx["cliente"] or "", ctx["contrato_id"]))
            p = cur.fetchone()
            if p:
                ctx.update(projeto_id=p["id"], card_id=ctx["card_id"] or p["card_id"],
                           contrato_id=ctx["contrato_id"] or p["contrato_id"],
                           cliente=ctx["cliente"] or p["cliente"])

    # card Valor: id direto (pode ser o mesmo do kanban) ou espelho via space_card_id
    if not ctx["valoria_card_id"]:
        cand = ctx["card_id"] or (any_id if _is_uuid(any_id) else None)
        if cand and _is_uuid(cand):
            rows = _valoria_sql(f"""
                SELECT id FROM ops.cards_solicitacao
                 WHERE id = '{cand}' OR details->>'space_card_id' = '{cand}'
                 ORDER BY (id = '{cand}') DESC LIMIT 1""")
            if rows:
                ctx["valoria_card_id"] = rows[0]["id"]

    # card do Trello via card do Cloud ou cliente
    if not ctx["trello_card_id"]:
        with conn() as c, c.cursor() as cur:
            # Casa pelo espelho do card ou pelo título. O título compara sem
            # pontuação/espaço porque o card irmão de outro dept costuma variar a
            # separação ("ANVIVA OPERACIONAL - ANDREA" x "ANVIVA OPERACIONAL ANDREA")
            # e assim o projeto executivo não chegava no campo. (Will 31/08/2026)
            cur.execute("""
                SELECT id FROM trello_projetos.cards
                 WHERE NOT closed AND (space_card_id::text = %s
                    OR (nullif(btrim(%s), '') IS NOT NULL
                        AND regexp_replace(upper(split_part(nome, '|', 1)), '[^A-Z0-9]+', '', 'g')
                          = regexp_replace(upper(%s), '[^A-Z0-9]+', '', 'g')))
                 ORDER BY (space_card_id::text = %s) DESC, date_last_activity DESC NULLS LAST
                 LIMIT 1
            """, (ctx["card_id"] or "", ctx["cliente"] or "", ctx["cliente"] or "", ctx["card_id"] or ""))
            t = cur.fetchone()
            if t:
                ctx["trello_card_id"] = t["id"]

    # contrato via card do kanban (quando o projeto ainda não linkou)
    if not ctx["contrato_id"] and ctx["card_id"]:
        with conn() as c, c.cursor() as cur:
            cur.execute("""
                SELECT id::text FROM contratos_docusign
                 WHERE card_id::text = %s ORDER BY completed_at DESC NULLS LAST, updated_at DESC LIMIT 1
            """, (ctx["card_id"],))
            r = cur.fetchone()
            if r:
                ctx["contrato_id"] = r["id"]

    return ctx


# ── endpoint ─────────────────────────────────────────────────────────────────

@router.get("/api/docs-unificados/{any_id}")
def docs_unificados(any_id: str, vista: str = "interno"):
    any_id = any_id.strip()
    if not any_id or len(any_id) > 64:
        raise HTTPException(400, "id inválido")
    ctx = _resolver(any_id)
    if not any([ctx["projeto_id"], ctx["card_id"], ctx["valoria_card_id"],
                ctx["trello_card_id"], ctx["op_id"]]):
        raise HTTPException(404, "nenhum vínculo encontrado pra esse id")

    seen: set = set()
    grupos: list[dict] = []
    mapa = {"print": None, "pdf": None, "draw_url": None}
    contrato = None
    proposta = None
    drive = None

    # ── Valor: details do card (anexos + mapa) ───────────────────────────────
    valor_docs: list = []
    det_valoria: dict = {}
    if ctx["valoria_card_id"]:
        rows = _valoria_sql(
            f"SELECT details FROM ops.cards_solicitacao WHERE id = '{ctx['valoria_card_id']}'")
        det_valoria = _jsonb(rows[0].get("details")) if rows else {}
        _coletar_anexos_det(det_valoria, seen, valor_docs, "valor")
        if det_valoria.get("draw_mapa_id"):
            mapa["draw_url"] = f"{DRAW_MAPA_BASE}/{ctx['valoria_card_id']}"
        mp = det_valoria.get("mapa_pdf")
        if isinstance(mp, dict) and mp.get("url"):
            mapa["pdf"] = {"url": mp["url"], "name": mp.get("name") or "Mapeamento da Obra",
                           "uploaded_at": mp.get("uploaded_at")}

    # ── card do kanban (Cloud/local): mapa do Status + anexos + drive ────────
    det_card: dict = {}
    if ctx["card_id"]:
        with conn() as c, c.cursor() as cur:
            cur.execute("SELECT details FROM public.kanban_cards WHERE id::text = %s", (ctx["card_id"],))
            row = cur.fetchone()
        det_card = _jsonb(row.get("details")) if row else {}
        if not det_card:
            rows = _cloud_get("kanban_cards", {"select": "details", "id": f"eq.{ctx['card_id']}", "limit": "1"})
            det_card = _jsonb(rows[0].get("details")) if rows else {}
        _coletar_anexos_det(det_card, seen, valor_docs, "valor")
        ms = det_card.get("mapa_status") or {}
        if ms.get("print"):
            mapa["print"] = ms["print"]
        if not mapa["pdf"]:
            mp = det_card.get("mapa_pdf")
            if isinstance(mp, dict) and mp.get("url"):
                mapa["pdf"] = {"url": mp["url"], "name": mp.get("name") or "Mapeamento da Obra",
                               "uploaded_at": mp.get("uploaded_at")}
        if det_card.get("drive_folder_id"):
            drive = {"folder_id": det_card["drive_folder_id"],
                     "folder_url": det_card.get("drive_folder_url")}
    if valor_docs:
        grupos.append({"origem": "valor", "titulo": "Orçamento (Valor)", "docs": valor_docs})

    # ── proposta ─────────────────────────────────────────────────────────────
    sim_id = ctx["valoria_sim_id"]
    if not sim_id and ctx["valoria_card_id"]:
        rows = _valoria_sql(f"""
            SELECT id FROM ops.simulacoes WHERE card_id = '{ctx['valoria_card_id']}'
             ORDER BY selected_at DESC NULLS LAST, updated_at DESC LIMIT 1""")
        if rows:
            sim_id = rows[0]["id"]
    if sim_id and _is_uuid(str(sim_id)):
        rows = _valoria_sql(f"""
            SELECT s.numero, p.url_publica
              FROM ops.simulacoes s
              LEFT JOIN ops.propostas p ON p.simulacao_id = s.id
             WHERE s.id = '{sim_id}'
             ORDER BY p.created_at DESC LIMIT 1""")
        numero = rows[0].get("numero") if rows else None
        publica = rows[0].get("url_publica") if rows else None
        url = publica or f"{PROPOSTA_BASE}/{sim_id}"
        proposta = {"sim_id": sim_id, "numero": numero, "url": url, "publicada": bool(publica)}
        seen.add(url)

    # ── contrato ─────────────────────────────────────────────────────────────
    if ctx["contrato_id"]:
        with conn() as c, c.cursor() as cur:
            cur.execute("""
                SELECT id::text, titulo, status, envelope_id, completed_at
                  FROM contratos_docusign WHERE id::text = %s
            """, (ctx["contrato_id"],))
            ct = cur.fetchone()
        if ct:
            assinado = (ct.get("status") or "").lower() in ("assinado", "completed")
            # Envelope real do DocuSign = UUID puro. Bulk do Raniere gravou
            # ids sintéticos ("RANIERE-BULK-…") sem PDF pra baixar.
            env = ct.get("envelope_id") or ""
            env_real = bool(re.fullmatch(r"[0-9a-fA-F-]{36}", env))
            pdf_url = (f"{DOCUSIGN_PDF_BASE}/{env}/pdf"
                       if assinado and env_real else None)
            contrato = {"id": ct["id"], "titulo": ct.get("titulo"), "status": ct.get("status"),
                        "assinado": assinado, "completed_at": str(ct.get("completed_at") or "") or None,
                        "pdf_url": pdf_url}
            if pdf_url:
                seen.add(pdf_url)

    # ── Projetos (Trello) ────────────────────────────────────────────────────
    if ctx["trello_card_id"]:
        with conn() as c, c.cursor() as cur:
            cur.execute("""
                SELECT nome, mime, url_trello, path_local, baixado, criado_em
                  FROM trello_projetos.anexos WHERE card_id = %s ORDER BY criado_em DESC
            """, (ctx["trello_card_id"],))
            rows = cur.fetchall()
        docs = []
        for a in rows:
            if a.get("baixado") and a.get("path_local"):
                url = f"{PROJETOS_ANEXOS_BASE}/{a['path_local'].removeprefix('anexos/')}"
            else:
                url = a.get("url_trello")
            if not url or url in seen:
                continue
            seen.add(url)
            docs.append({"name": a.get("nome") or url, "url": url, "mime": a.get("mime"),
                         "uploaded_at": str(a.get("criado_em") or "") or None, "origem": "projetos"})
        if docs:
            grupos.append({"origem": "projetos", "titulo": "Projetos", "docs": docs})

    # ── Executivo (etapa 7) + demais docs do gestão ──────────────────────────
    if ctx["projeto_id"]:
        with conn() as c, c.cursor() as cur:
            cur.execute("""
                SELECT id::text, slug, titulo, arquivo_url, content_type, nome_arquivo,
                       etapa_numero, gerado_por, meta, created_at
                  FROM gestao.documentos WHERE projeto_id::text = %s ORDER BY created_at
            """, (ctx["projeto_id"],))
            rows = cur.fetchall()
        execs, outros, fiscais = [], [], []
        for d in rows:
            url = d.get("arquivo_url")
            if not url or url in seen:
                continue
            seen.add(url)
            doc = {"name": d.get("titulo") or d.get("nome_arquivo") or url, "url": url,
                   "mime": d.get("content_type"),
                   "uploaded_at": str(d.get("created_at") or "") or None, "origem": "gestao"}
            # Documento subido pelo fiscal no app de campo (Verifica): grupo
            # próprio, com id + autor pro fiscal poder remover o que ele mesmo
            # enviou. (Will 08/09/2026: medição etc entra pelo próprio fiscal)
            if d.get("slug") == "fiscal":
                doc["origem"] = "fiscal"
                doc["id"] = d.get("id")
                doc["autor"] = (_jsonb(d.get("meta")) or {}).get("autor")
                fiscais.append(doc)
            elif d.get("etapa_numero") == 7:
                execs.append(doc)
            else:
                outros.append(doc)
        if execs:
            for e in execs:
                e["origem"] = "executivo"
            grupos.append({"origem": "executivo", "titulo": "Projeto Executivo", "docs": execs})
        if outros:
            grupos.append({"origem": "gestao", "titulo": "Gestão", "docs": outros})
        if fiscais:
            grupos.append({"origem": "fiscal", "titulo": "Fiscal (campo)", "docs": fiscais})

    # ── Produção (anexos manuais na OP) ──────────────────────────────────────
    filtro = None
    if ctx["op_id"]:
        filtro = {"id": f"eq.{ctx['op_id']}"}
    elif ctx["valoria_card_id"]:
        filtro = {"valoria_card_id": f"eq.{ctx['valoria_card_id']}"}
    elif ctx["contrato_id"]:
        filtro = {"contrato_id": f"eq.{ctx['contrato_id']}"}
    if filtro:
        ops = _cloud_get("producao_ordens", {"select": "id,anexos", **filtro, "limit": "3"})
        docs = []
        for o in ops:
            for a in _jsonb(o.get("anexos")) if isinstance(o.get("anexos"), (list, str)) else []:
                if not isinstance(a, dict):
                    continue
                url = a.get("url")
                if not url or url in seen:
                    continue
                seen.add(url)
                docs.append({"name": a.get("name") or url, "url": url,
                             "mime": a.get("mimeType") or a.get("mime"), "origem": "producao"})
        if docs:
            grupos.append({"origem": "producao", "titulo": "Produção", "docs": docs})

    # ── Fase 2: logística de visibilidade por vista (Will 18/08/2026) ────────
    # cliente = Central: SÓ o pacote do cliente (proposta, mapa, contrato,
    #           executivo); proposta/mapa a partir do envio da proposta.
    # campo   = Instala/Verifica: nunca proposta/contrato (têm R$); docs de
    #           obra (executivo/projetos/gestão/produção) só com contrato
    #           assinado; anexos do orçamento e mapa sempre.
    # interno = demais setores: tudo, sempre (default).
    assinado = bool(contrato and contrato.get("assinado"))
    if vista == "cliente":
        enviada = assinado or bool(proposta and proposta.get("publicada"))
        if not enviada:
            proposta = None
            mapa = {"print": None, "pdf": None, "draw_url": None}
        grupos = [g for g in grupos if g["origem"] == "executivo"]
        drive = None
    elif vista == "campo":
        proposta = None
        contrato = {"assinado": assinado} if contrato else None
        if not assinado:
            # Obra antiga em execução costuma estar sem contrato vinculado. Mapa e
            # projeto executivo (incluindo os anexos do board Projetos) precisam
            # chegar no instalador/fiscal de qualquer jeito; só Gestão e Produção
            # continuam presos ao aceite. (Will 31/08/2026)
            # "fiscal" sempre passa: foi o próprio fiscal que subiu no campo.
            grupos = [g for g in grupos if g["origem"] in ("valor", "executivo", "projetos", "fiscal")]
        # O board Projetos guarda o PDF da proposta e do contrato junto do
        # executivo. Campo não pode ver R$, então derruba pelo nome do arquivo.
        # Docs do grupo fiscal ficam de fora do corte: o autor é o próprio campo
        # e o filtro por nome sumiria com um "medicao proposta.pdf" legítimo.
        grupos = [g if g["origem"] == "fiscal" else
                  {**g, "docs": [d for d in g["docs"] if not _doc_tem_valor(d.get("name"))]}
                  for g in grupos]
        grupos = [g for g in grupos if g["docs"]]
        drive = None

    return {"vinculos": ctx, "cliente": ctx["cliente"], "mapa": mapa,
            "contrato": contrato, "proposta": proposta, "drive": drive, "grupos": grupos}


# ── upload de documento pelo fiscal (Verifica) ──────────────────────────────
# O app de campo só conhece o card_id do kanban, então o upload entra pelo
# mesmo resolvedor do agregador: qualquer id da cadeia chega no projeto do
# gestão. O arquivo vira gestao.documentos com slug='fiscal' e aparece no
# grupo "Fiscal (campo)" em todas as vistas internas + campo.
# (Will 08/09/2026: "o proprio fiscal adicionar tambem PDF, por exemplo medicao")

_FISCAL_DOC_MAX = 100 * 1024 * 1024  # 100MB cobre PDF de medição escaneado
_FISCAL_DOC_MIMES = ("application/pdf", "image/")


def _fiscal_safe_name(fname: str) -> str:
    """Nome ASCII seguro pro path do storage (mesma regra do upload do gestão)."""
    import unicodedata
    base = unicodedata.normalize("NFKD", fname).encode("ascii", "ignore").decode()
    out = "".join(ch if ch.isalnum() or ch in "._-" else "_" for ch in base)
    return out.strip("._") or "arquivo"


@router.post("/api/docs-unificados/{any_id}/fiscal-doc")
async def fiscal_doc_upload(
    any_id: str,
    file: UploadFile = File(...),
    titulo: str = Form(default=""),
    autor: str = Form(default=""),
):
    import random
    import string
    import time

    any_id = any_id.strip()
    if not any_id or len(any_id) > 64:
        raise HTTPException(400, "id inválido")
    ctx = _resolver(any_id)
    if not ctx["projeto_id"]:
        raise HTTPException(404, "obra sem projeto no gestão; o documento não tem onde morar")

    fname = file.filename or "arquivo"
    ctype = file.content_type or "application/octet-stream"
    # Campo só sobe PDF e imagem: qualquer outra coisa é quase sempre engano
    # (o input do app já restringe, aqui é a guarda do boundary).
    if not any(ctype.startswith(m) for m in _FISCAL_DOC_MIMES):
        raise HTTPException(400, "só PDF ou imagem")
    data = await file.read()
    if not data:
        raise HTTPException(400, "arquivo vazio")
    if len(data) > _FISCAL_DOC_MAX:
        raise HTTPException(400, "arquivo acima de 100MB")

    if not SUPABASE_KEY:
        raise HTTPException(500, "SUPABASE_SERVICE_KEY não configurada")
    rand = "".join(random.choices(string.ascii_lowercase + string.digits, k=6))
    path = (f"gestao/{ctx['projeto_id']}/docs/fiscal/"
            f"{int(time.time() * 1000)}_{rand}_{_fiscal_safe_name(fname)}")
    try:
        r = httpx.post(
            f"{SUPABASE_URL}/storage/v1/object/obra-media/{path}", content=data,
            headers={"apikey": SUPABASE_KEY, "Authorization": f"Bearer {SUPABASE_KEY}",
                     "Content-Type": ctype, "x-upsert": "true"}, timeout=60.0)
        if r.status_code >= 400:
            raise HTTPException(502, f"storage upload falhou: {r.text[:300]}")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(502, f"storage indisponível: {e}")
    url = f"{SUPABASE_URL}/storage/v1/object/public/obra-media/{path}"

    with conn() as c, c.cursor() as cur:
        cur.execute("""
            INSERT INTO gestao.documentos (projeto_id, etapa_numero, slug, titulo,
                                           arquivo_url, storage_path, content_type,
                                           nome_arquivo, tamanho_bytes, gerado_por, meta)
            VALUES (%s, NULL, 'fiscal', %s, %s, %s, %s, %s, %s, 'fiscal', %s::jsonb)
            RETURNING id::text, titulo, arquivo_url, content_type, created_at
        """, (ctx["projeto_id"], (titulo or fname).strip()[:200], url, path, ctype,
              fname, len(data), json.dumps({"autor": autor or None, "card_id": ctx["card_id"]})))
        row = cur.fetchone()
        # Evento no histórico do projeto: o gestão vê quem subiu o quê do campo.
        cur.execute("""
            INSERT INTO gestao.eventos (projeto_id, tipo, titulo, autor_email, payload)
            VALUES (%s, 'documento', %s, %s, %s::jsonb)
        """, (ctx["projeto_id"], f"Documento do fiscal: {(titulo or fname).strip()[:150]}",
              autor or None, json.dumps({"origem": "fiscal", "url": url})))
    return {"ok": True, "doc": {"id": row["id"], "name": row["titulo"],
                                "url": row["arquivo_url"], "mime": row["content_type"],
                                "uploaded_at": str(row["created_at"] or "") or None,
                                "origem": "fiscal", "autor": autor or None}}


@router.delete("/api/docs-unificados/fiscal-doc/{did}")
def fiscal_doc_delete(did: str):
    """Remoção restrita a slug='fiscal': o fiscal só apaga o que o campo subiu,
    nunca executivo/gestão (o DELETE genérico /api/documentos é do gestão)."""
    if not _is_uuid(did):
        raise HTTPException(400, "id inválido")
    with conn() as c, c.cursor() as cur:
        cur.execute("""
            DELETE FROM gestao.documentos WHERE id::text = %s AND slug = 'fiscal'
            RETURNING storage_path
        """, (did,))
        row = cur.fetchone()
    if not row:
        raise HTTPException(404, "documento do fiscal não encontrado")
    if row.get("storage_path") and SUPABASE_KEY:
        try:
            httpx.delete(
                f"{SUPABASE_URL}/storage/v1/object/obra-media/{row['storage_path']}",
                headers={"apikey": SUPABASE_KEY, "Authorization": f"Bearer {SUPABASE_KEY}"},
                timeout=30.0)
        except Exception:
            log.warning("fiscal_doc_delete storage falhou path=%s", row.get("storage_path"))
    return {"ok": True}
