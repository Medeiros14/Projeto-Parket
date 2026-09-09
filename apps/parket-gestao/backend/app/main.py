"""parket-gestao — API do Gestor de Projetos.

Espelha simulacao_projetos → gestao.projetos + itens, e serve endpoints
CRUD pro frontend gestao.parket.works.
"""
import base64
import json
import logging
from fastapi import FastAPI, HTTPException, Query, Header, Body, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from .settings import settings
from .db import conn
from .reuniao import router as reuniao_router
from .anteprojeto import router as anteprojeto_router
from .docs_unificados import router as docs_unificados_router
from .fiscal import router as fiscal_router
from .hb_drive import router as hb_drive_router
from .custos import router as custos_router
from .notificacoes import router as notificacoes_router

logging.basicConfig(level=logging.INFO)
log = logging.getLogger("gestao")

app = FastAPI(title="Parket Gestor de Projetos", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in settings.cors_origins.split(",") if o.strip()] + ["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Reunião Semanal do Cronograma — gravação por projeto, transcrição
# Whisper self-hosted, extração via Claude, review humano, publicação
# como obra_tasks no parket-chat.
app.include_router(reuniao_router)

# Anteprojeto (F5) — gerar prancha no Draw + publicar PDF no Center etapa 7
app.include_router(anteprojeto_router)

# Docs unificados — card único: agrega documentos de todos os setores
app.include_router(docs_unificados_router)

# Fiscal NF-e (fiscal.parket.works) — upload de XML de NFe por Ronaldo Fiscal,
# parseia, dedup por chNFe, vincula a gestao.projetos (fila pendentes pra órfãos)
app.include_router(fiscal_router)

# HB Drive — todo documento do Homebroker vai pro Drive do cliente (sessão
# resumable assinada; o token do sistemas@ nunca sai do servidor)
app.include_router(hb_drive_router)

# Custos de Terceiros — gasto do prestador terceirizado que se desloca ate a
# obra, do lancamento pelo secretario ate o pagamento pelo financeiro. Marcar
# pago escreve em core.lancamentos (fonte unica de pagamento do grupo).
app.include_router(custos_router)

# Notificações de campo — feed derivado de novidades (obra nova, agendamento,
# custo aprovado/pago, material respondido, ocorrência, veredito do fiscal)
# pro sino do Instala (prestador_id) e do Verifica (fiscal_id).
app.include_router(notificacoes_router)


@app.get("/api/health")
def health():
    try:
        with conn() as c, c.cursor() as cur:
            cur.execute("SELECT 1 AS ok, current_database() AS db")
            r = cur.fetchone()
        return {"ok": True, "db": r["db"]}
    except Exception as e:
        return {"ok": False, "error": str(e)}


# ── KANBAN COLUNAS ───────────────────────────────────────
@app.get("/api/colunas")
def colunas_list():
    """Colunas do Kanban gestão — mesma estrutura do dept-operacional do Space."""
    with conn() as c, c.cursor() as cur:
        cur.execute("SELECT id, titulo, cor, ordem FROM gestao.colunas_kanban ORDER BY ordem")
        return cur.fetchall()


# ── PROJETOS ─────────────────────────────────────────────
@app.get("/api/projetos")
def projetos_list(
    status: str | None = None,
    column_id: str | None = None,
    q: str | None = Query(default=None, description="busca por cliente/numero_proposta"),
    # 2000: gestao.projetos passou de 500 linhas (554 em 26/08) — 500 cortava
    # projetos da UI e do grupo "Sem cronograma"
    limit: int = 2000,
):
    where, args = [], []
    if status:
        where.append("p.status = %s"); args.append(status)
    if column_id:
        where.append("p.column_id = %s"); args.append(column_id)
    if q:
        where.append("(p.cliente ILIKE %s OR p.numero_proposta ILIKE %s OR p.obra_code ILIKE %s)")
        args.extend([f"%{q}%"] * 3)
    where_sql = ("WHERE " + " AND ".join(where)) if where else ""
    with conn() as c, c.cursor() as cur:
        cur.execute(f"""
            SELECT p.id, p.card_id::text AS card_id,
                   p.numero_proposta, p.cliente, p.cnpj_cpf, p.endereco,
                   p.obra_code, p.vendedor, p.gestor_email, p.valor_total,
                   p.status, p.column_id, p.ordem_coluna,
                   p.etapa_atual, p.assinado_em, p.created_at, p.updated_at,
                   COALESCE(v.n_total, 0) AS n_itens,
                   COALESCE(v.n_entregues, 0) AS n_entregues,
                   COALESCE(v.pct_completo, 0) AS pct_completo
              FROM gestao.projetos p
              LEFT JOIN gestao.v_projeto_progresso v ON v.projeto_id = p.id
              {where_sql}
             ORDER BY p.ordem_coluna, p.updated_at DESC LIMIT %s
        """, (*args, limit))
        return cur.fetchall()


@app.get("/api/jornada")
def jornada_overview():
    """Catálogo de etapas/entregas + status por projeto — alimenta a view Jornada.

    As entregas são o catálogo da Central de Documentos (fases 1-6); uma entrega
    está preenchida quando o projeto tem ao menos um documento daquele item.
    """
    with conn() as c, c.cursor() as cur:
        cur.execute("SELECT numero, slug, categoria, titulo FROM gestao.etapas_catalogo ORDER BY numero")
        catalogo = cur.fetchall()
        cur.execute("SELECT projeto_id::text AS projeto_id, etapa_numero, status FROM gestao.projeto_etapas")
        rows = cur.fetchall()
        cur.execute("""
            SELECT id, fase, fase_titulo, codigo, titulo, etapa_numero, obrigatorio, ordem
              FROM gestao.documentos_catalogo
             WHERE visivel_jornada IS TRUE
             ORDER BY ordem
        """)
        entregas = cur.fetchall()
        cur.execute("""
            SELECT DISTINCT projeto_id::text AS projeto_id, catalogo_id
              FROM gestao.documentos WHERE catalogo_id IS NOT NULL
        """)
        docs = cur.fetchall()
    status: dict = {}
    for r in rows:
        status.setdefault(r["projeto_id"], {})[str(r["etapa_numero"])] = r["status"]
    preenchidos: dict = {}
    for d in docs:
        preenchidos.setdefault(d["projeto_id"], []).append(d["catalogo_id"])
    return {"catalogo": catalogo, "status": status,
            "entregas": entregas, "preenchidos": preenchidos}


@app.get("/api/mapa-print/{card_id}")
def mapa_print_por_card(card_id: str):
    """Mapeamento — fontes possíveis por ordem:
      1. kanban_cards.details.mapa_status.print (formato Status/Draw = paginas de imagem)
      2. kanban_cards.details.mapa_pdf (formato Valoria = PDF único upado no card)
         Retorna em `pdf` pro frontend renderizar como iframe/link.
    """
    print_data = None
    pdf_data = None
    try:
        with _sb_client() as sb:
            r = sb.get("/kanban_cards", params={
                "select": "details",
                "id": f"eq.{card_id}",
                "limit": "1",
            })
            if r.status_code < 400 and r.json():
                det = r.json()[0].get("details") or {}
                ms = det.get("mapa_status") or {}
                print_data = ms.get("print") or None
                mp = det.get("mapa_pdf")
                if mp and isinstance(mp, dict) and mp.get("url"):
                    pdf_data = {
                        "url": mp["url"],
                        "name": mp.get("name") or "Mapeamento da Obra",
                        "size": mp.get("size"),
                        "uploaded_at": mp.get("uploaded_at"),
                    }
    except Exception:
        log.warning("mapa_print_fail card=%s", card_id, exc_info=True)
    return {"print": print_data, "pdf": pdf_data}


class MoverIn(BaseModel):
    column_id: str


@app.post("/api/projetos/{pid}/mover")
def projeto_mover(pid: str, payload: MoverIn, x_user_email: str | None = Header(default=None)):
    with conn() as c, c.cursor() as cur:
        cur.execute(
            "SELECT * FROM gestao.mover_projeto(%s::uuid, %s, %s)",
            (pid, payload.column_id, x_user_email),
        )
        return cur.fetchone()


@app.delete("/api/projetos/{pid}")
def projeto_delete(pid: str, x_user_email: str | None = Header(default=None)):
    """Apaga projeto da gestão (cascade: itens/etapas/eventos/fotos/documentos).
    NÃO apaga o kanban_card do Cloud — cada dept lida com o card por conta própria."""
    with conn() as c, c.cursor() as cur:
        cur.execute("SELECT id, cliente, card_id::text FROM gestao.projetos WHERE id::text = %s", (pid,))
        row = cur.fetchone()
        if not row:
            raise HTTPException(404, "projeto não encontrado")
        cur.execute("DELETE FROM gestao.projetos WHERE id::text = %s", (pid,))
        log.info("projeto_deletado id=%s cliente=%s por=%s", pid, row["cliente"], x_user_email)
        return {"ok": True, "cliente": row["cliente"]}


@app.get("/api/projetos/{pid}")
def projeto_get(pid: str):
    with conn() as c, c.cursor() as cur:
        cur.execute("""
            SELECT p.*,
                   COALESCE(v.n_total, 0) AS n_itens,
                   COALESCE(v.n_entregues, 0) AS n_entregues,
                   COALESCE(v.pct_completo, 0) AS pct_completo
              FROM gestao.projetos p
              LEFT JOIN gestao.v_projeto_progresso v ON v.projeto_id = p.id
             WHERE p.id::text = %s
        """, (pid,))
        p = cur.fetchone()
        if not p:
            raise HTTPException(404, "projeto não encontrado")
        # Etapas com catálogo + status por projeto
        cur.execute("""
            SELECT ec.numero, ec.slug, ec.categoria, ec.titulo, ec.subtitulo, ec.descricao,
                   COALESCE(pe.status, 'pendente')  AS status,
                   pe.responsavel, pe.iniciada_em, pe.concluida_em, pe.observacoes, pe.meta, pe.updated_at
              FROM gestao.etapas_catalogo ec
              LEFT JOIN gestao.projeto_etapas pe
                     ON pe.etapa_numero = ec.numero AND pe.projeto_id = %s
             ORDER BY ec.numero
        """, (pid,))
        etapas = cur.fetchall()
    return {"projeto": p, "etapas": etapas}


class ProjetoPatch(BaseModel):
    gestor_email: str | None = None
    status: str | None = None
    etapa_atual: int | None = None
    iniciado_em: str | None = None
    entregue_em: str | None = None
    meta: dict | None = None
    arquiteto: str | None = None
    orcamentista: str | None = None
    vendedor: str | None = None
    endereco: str | None = None


@app.patch("/api/projetos/{pid}")
def projeto_update(pid: str, patch: ProjetoPatch, x_user_email: str | None = Header(default=None)):
    fields = {k: v for k, v in patch.dict().items() if v is not None}
    if not fields:
        return projeto_get(pid)
    sets = []
    args: list = []
    for k, v in fields.items():
        if k == "meta":
            sets.append(f"{k} = %s::jsonb")
            import json; args.append(json.dumps(v))
        else:
            sets.append(f"{k} = %s"); args.append(v)
    args.append(pid)
    with conn() as c, c.cursor() as cur:
        cur.execute(f"UPDATE gestao.projetos SET {', '.join(sets)} WHERE id::text = %s RETURNING *", args)
        p = cur.fetchone()
        if not p:
            raise HTTPException(404, "projeto não encontrado")
        cur.execute("""
            INSERT INTO gestao.eventos (projeto_id, tipo, titulo, autor_email, payload)
            VALUES (%s, 'status_change',
                    'Projeto atualizado', %s, %s::jsonb)
        """, (pid, x_user_email, __import__("json").dumps(fields, default=str)))
    return p


# ── PASTA DO DRIVE ────────────────────────────────────────
# Mesma pasta da Central do Cliente do Space: kanban_cards.details.drive_folder_id.
# Criação delegada ao mesmo Apps Script que o Space usa (pasta nasce no
# shared drive de clientes), então os dois painéis enxergam a mesma pasta.
DRIVE_SCRIPT_URL = ("https://script.google.com/macros/s/"
                    "AKfycbz07KaMoECR5EemL9UyGT8SZfOpYiJDKir7qQzOyRDPu8XZzvXfBq8ZdSSMMel_qRrg/exec")
DRIVE_ROOT_FOLDER = "0AF-R0Sev8WPcUk9PVA"


def _drive_do_card(card_id: str) -> dict | None:
    # Cards vivem no PG local (mesmo banco do gestao) E no Cloud — ler local
    # primeiro, Cloud como fallback (card pode existir só num deles).
    with conn() as c, c.cursor() as cur:
        cur.execute("SELECT details FROM public.kanban_cards WHERE id::text = %s", (card_id,))
        row = cur.fetchone()
    if row:
        d = row.get("details") or {}
        if d.get("drive_folder_id"):
            return {"folder_id": d["drive_folder_id"],
                    "folder_url": d.get("drive_folder_url"), "fonte": "card"}
    with _sb_client() as sb:
        r = sb.get("/kanban_cards", params={
            "select": "details", "id": f"eq.{card_id}", "limit": "1"})
        if r.status_code < 400 and r.json():
            d = r.json()[0].get("details") or {}
            if d.get("drive_folder_id"):
                return {"folder_id": d["drive_folder_id"],
                        "folder_url": d.get("drive_folder_url"), "fonte": "card"}
    return None


def _drive_salvar_no_card(card_id: str, folder_id: str, folder_url: str | None) -> bool:
    """Grava a pasta em kanban_cards.details (PG local + Cloud, merge).
    Retorna False se o card não existe em nenhum dos dois (órfão)."""
    patch = {"drive_folder_id": folder_id, "drive_folder_url": folder_url}
    salvou = False
    with conn() as c, c.cursor() as cur:
        cur.execute("""
            UPDATE public.kanban_cards
               SET details = COALESCE(details, '{}'::jsonb) || %s::jsonb
             WHERE id::text = %s
        """, (__import__("json").dumps(patch), card_id))
        salvou = cur.rowcount > 0
    try:
        with _sb_client() as sb:
            rc = sb.get("/kanban_cards", params={
                "select": "details", "id": f"eq.{card_id}", "limit": "1"})
            if rc.status_code < 400 and rc.json():
                details = rc.json()[0].get("details") or {}
                details.update(patch)
                sb.patch("/kanban_cards", params={"id": f"eq.{card_id}"},
                         json={"details": details}, headers={"Prefer": "return=minimal"})
                salvou = True
    except Exception:
        log.warning("drive_save_cloud_fail card=%s", card_id, exc_info=True)
    return salvou


@app.get("/api/projetos/{pid}/drive")
def projeto_drive(pid: str):
    with conn() as c, c.cursor() as cur:
        cur.execute("SELECT card_id, cliente, meta FROM gestao.projetos WHERE id::text = %s", (pid,))
        p = cur.fetchone()
    if not p:
        raise HTTPException(404, "projeto não encontrado")
    if p.get("card_id"):
        try:
            info = _drive_do_card(str(p["card_id"]))
            if info:
                return info
        except Exception:
            log.warning("drive_get_card_fail pid=%s", pid, exc_info=True)
    meta = p.get("meta") or {}
    if meta.get("drive_folder_id") or meta.get("drive_folder_url"):
        return {"folder_id": meta.get("drive_folder_id"),
                "folder_url": meta.get("drive_folder_url"), "fonte": "meta"}
    return {"folder_id": None, "folder_url": None, "fonte": None}


@app.post("/api/projetos/{pid}/drive")
def projeto_drive_criar(pid: str, x_user_email: str | None = Header(default=None)):
    """Cria a pasta do cliente no Drive (Apps Script do Space) e grava em
    kanban_cards.details — igual ao fluxo do card 'ganho' no comercial."""
    with conn() as c, c.cursor() as cur:
        cur.execute("SELECT card_id, cliente, meta FROM gestao.projetos WHERE id::text = %s", (pid,))
        p = cur.fetchone()
    if not p:
        raise HTTPException(404, "projeto não encontrado")
    card_id = str(p["card_id"]) if p.get("card_id") else None
    if card_id:
        info = _drive_do_card(card_id)
        if info:
            return info
    r = httpx.post(DRIVE_SCRIPT_URL, content=__import__("json").dumps({
        "client_name": p["cliente"], "root_folder_id": DRIVE_ROOT_FOLDER,
    }), headers={"Content-Type": "text/plain"}, timeout=60.0, follow_redirects=True)
    if r.status_code >= 400:
        raise HTTPException(502, f"Apps Script HTTP {r.status_code}")
    body = r.json()
    if not (body.get("success") and body.get("folder_id")):
        raise HTTPException(502, f"Apps Script: {body.get('error') or 'sem folder_id'}")
    folder_id, folder_url = body["folder_id"], body.get("folder_url")
    salvou_no_card = False
    if card_id:
        try:
            salvou_no_card = _drive_salvar_no_card(card_id, folder_id, folder_url)
        except Exception:
            log.warning("drive_save_card_fail pid=%s", pid, exc_info=True)
    if not salvou_no_card:
        meta = p.get("meta") or {}
        meta["drive_folder_id"] = folder_id
        meta["drive_folder_url"] = folder_url
        with conn() as c, c.cursor() as cur:
            cur.execute("UPDATE gestao.projetos SET meta = %s::jsonb WHERE id::text = %s",
                        (__import__("json").dumps(meta), pid))
    with conn() as c, c.cursor() as cur:
        cur.execute("""
            INSERT INTO gestao.eventos (projeto_id, tipo, titulo, autor_email, payload)
            VALUES (%s, 'documento', 'Pasta do Drive criada', %s, %s::jsonb)
        """, (pid, x_user_email, __import__("json").dumps({"folder_id": folder_id, "folder_url": folder_url})))
    return {"folder_id": folder_id, "folder_url": folder_url, "fonte": "card" if salvou_no_card else "meta"}


# ── ITENS ─────────────────────────────────────────────────
@app.get("/api/projetos/{pid}/itens")
def itens_list(pid: str, ambiente: str | None = None, status: str | None = None):
    where = ["projeto_id::text = %s"]
    args: list = [pid]
    if ambiente:
        where.append("ambiente = %s"); args.append(ambiente)
    if status:
        where.append("status = %s"); args.append(status)
    with conn() as c, c.cursor() as cur:
        cur.execute(f"""
            SELECT id, projeto_id, ordem, categoria, descritivo, ambiente,
                   quantidade, unidade, valor_unit, valor_total, status,
                   responsavel, previsao_inicio, previsao_fim, executado_em,
                   observacoes, meta, created_at, updated_at
              FROM gestao.itens
             WHERE {' AND '.join(where)}
             ORDER BY ordem, categoria
        """, args)
        return cur.fetchall()


class ItemPatch(BaseModel):
    ambiente: str | None = None
    status: str | None = None
    responsavel: str | None = None
    previsao_inicio: str | None = None
    previsao_fim: str | None = None
    executado_em: str | None = None
    observacoes: str | None = None
    quantidade: float | None = None
    unidade: str | None = None
    meta: dict | None = None


@app.patch("/api/itens/{iid}")
def item_update(iid: str, patch: ItemPatch, x_user_email: str | None = Header(default=None)):
    fields = {k: v for k, v in patch.dict().items() if v is not None}
    if not fields:
        with conn() as c, c.cursor() as cur:
            cur.execute("SELECT * FROM gestao.itens WHERE id::text = %s", (iid,))
            return cur.fetchone() or {}
    sets, args = [], []
    for k, v in fields.items():
        if k == "meta":
            # merge raso — chaves enviadas sobrescrevem, o resto do meta fica
            sets.append("meta = COALESCE(meta, '{}'::jsonb) || %s::jsonb")
            args.append(__import__("json").dumps(v))
        else:
            sets.append(f"{k} = %s"); args.append(v)
    args.append(iid)
    with conn() as c, c.cursor() as cur:
        cur.execute(f"UPDATE gestao.itens SET {', '.join(sets)} WHERE id::text = %s RETURNING *", args)
        it = cur.fetchone()
        if not it:
            raise HTTPException(404, "item não encontrado")
        # Timeline
        cur.execute("""
            INSERT INTO gestao.eventos (projeto_id, item_id, tipo, titulo, autor_email, payload)
            VALUES (%s, %s, 'status_change', %s, %s, %s::jsonb)
        """, (str(it["projeto_id"]), iid, f"Item {it['descritivo'][:60]} alterado",
              x_user_email, __import__("json").dumps(fields, default=str)))
    return it


# ── ETAPAS DO PROJETO ────────────────────────────────────
class EtapaPatch(BaseModel):
    status: str | None = None
    responsavel: str | None = None
    iniciada_em: str | None = None
    concluida_em: str | None = None
    observacoes: str | None = None
    meta: dict | None = None


@app.patch("/api/projetos/{pid}/etapas/{numero}")
def etapa_update(pid: str, numero: int, patch: EtapaPatch, x_user_email: str | None = Header(default=None)):
    fields = {k: v for k, v in patch.dict().items() if v is not None}
    if not fields:
        raise HTTPException(400, "nada pra atualizar")
    with conn() as c, c.cursor() as cur:
        # Upsert
        cur.execute("""
            INSERT INTO gestao.projeto_etapas (projeto_id, etapa_numero, status)
            VALUES (%s, %s, %s) ON CONFLICT (projeto_id, etapa_numero) DO NOTHING
        """, (pid, numero, fields.get("status", "pendente")))
        sets, args = [], []
        for k, v in fields.items():
            if k == "meta":
                # merge raso — chaves enviadas sobrescrevem, o resto do meta fica
                sets.append("meta = COALESCE(meta, '{}'::jsonb) || %s::jsonb")
                args.append(__import__("json").dumps(v))
            else:
                sets.append(f"{k} = %s"); args.append(v)
        args += [pid, numero]
        cur.execute(f"""
            UPDATE gestao.projeto_etapas
               SET {', '.join(sets)}
             WHERE projeto_id::text = %s AND etapa_numero = %s
             RETURNING *
        """, args)
        r = cur.fetchone()
        cur.execute("""
            INSERT INTO gestao.eventos (projeto_id, etapa_numero, tipo, titulo, autor_email, payload)
            VALUES (%s, %s, 'status_change', %s, %s, %s::jsonb)
        """, (pid, numero, f"Etapa {numero} atualizada", x_user_email,
              __import__("json").dumps(fields, default=str)))
    return r


# ── CHECKLIST DE INÍCIO DE OBRAS (etapa 3) — form do app fiscal ─────────
# O PWA do fiscal (verifica.parket.works) resolve o projeto pelo card_id do
# kanban e grava as respostas em gestao.projeto_etapas.meta.checklist, que a
# Central do Cliente exibe na etapa 3.
CHECKLIST_CATEGORIA_SERVICO = {
    "PISO": "piso", "DECK": "deck", "FORRO": "forro", "PAINEL": "painel",
    "PORTA": "porta", "ESCADA": "escada", "BANCO": "bancos", "BANCOS": "bancos",
}
CHECKLIST_SERVICO_ORDEM = ["piso", "deck", "forro", "painel", "porta", "escada", "bancos"]


def _checklist_projeto_por_card(cur, card_id: str):
    cur.execute("SELECT id, cliente FROM gestao.projetos WHERE card_id::text = %s", (card_id,))
    return cur.fetchone()


@app.get("/api/fiscal/checklist-obra/{card_id}")
def checklist_obra_get(card_id: str):
    with conn() as c, c.cursor() as cur:
        p = _checklist_projeto_por_card(cur, card_id)
        if not p:
            raise HTTPException(404, "projeto do gestão não encontrado pra esse card")
        cur.execute("""
            SELECT categoria, meta->>'categoria_raiz' AS raiz
              FROM gestao.itens
             WHERE projeto_id = %s AND status != 'cancelado'
        """, (str(p["id"]),))
        vistos = {
            CHECKLIST_CATEGORIA_SERVICO.get(str(r["raiz"] or r["categoria"] or "").upper())
            for r in cur.fetchall()
        }
        servicos = [s for s in CHECKLIST_SERVICO_ORDEM if s in vistos]
        cur.execute("""
            SELECT status, meta FROM gestao.projeto_etapas
             WHERE projeto_id = %s AND etapa_numero = 3
        """, (str(p["id"]),))
        pe = cur.fetchone() or {}
        meta = pe.get("meta") or {}
    return {
        "projeto_id": str(p["id"]), "cliente": p["cliente"], "servicos": servicos,
        "status": pe.get("status") or "pendente",
        "checklist": meta.get("checklist") or {},
        "checklist_por": meta.get("checklist_por"),
        "checklist_em": meta.get("checklist_em"),
    }


class ChecklistObraBody(BaseModel):
    checklist: dict
    checklist_por: str | None = None
    status: str | None = None


@app.post("/api/fiscal/checklist-obra/{card_id}")
def checklist_obra_save(card_id: str, body: ChecklistObraBody):
    import json as _json
    from datetime import datetime as _dt, timezone as _tz
    with conn() as c, c.cursor() as cur:
        p = _checklist_projeto_por_card(cur, card_id)
        if not p:
            raise HTTPException(404, "projeto do gestão não encontrado pra esse card")
        agora = _dt.now(_tz.utc).isoformat()
        meta = {"checklist": body.checklist, "checklist_por": body.checklist_por, "checklist_em": agora}
        status = body.status or "em_andamento"
        cur.execute("""
            INSERT INTO gestao.projeto_etapas (projeto_id, etapa_numero, status, meta)
            VALUES (%s, 3, %s, %s::jsonb)
            ON CONFLICT (projeto_id, etapa_numero)
            DO UPDATE SET status = EXCLUDED.status,
                          meta = COALESCE(gestao.projeto_etapas.meta, '{}'::jsonb) || EXCLUDED.meta
            RETURNING status
        """, (str(p["id"]), status, _json.dumps(meta)))
        r = cur.fetchone()
        cur.execute("""
            INSERT INTO gestao.eventos (projeto_id, etapa_numero, tipo, titulo, autor_email, payload)
            VALUES (%s, 3, 'status_change', %s, %s, %s::jsonb)
        """, (str(p["id"]), "Checklist de início de obras atualizado pelo fiscal",
              body.checklist_por, _json.dumps({"status": status})))
    return {"ok": True, "status": r["status"], "checklist_em": agora}


@app.get("/api/fiscal/obra/{card_id}")
def fiscal_obra_get(card_id: str):
    """Projeto do gestão + itens (modelos) resolvidos pelo card da obra — usado pelo app do fiscal."""
    with conn() as c, c.cursor() as cur:
        cur.execute("""
            SELECT p.id::text, p.cliente, p.obra_code::text, p.endereco, p.numero_proposta, p.status,
                   p.iniciado_em, p.entregue_em,
                   COALESCE(a.inicio_obra::text, p.iniciado_em::date::text) AS inicio_obra,
                   COALESCE(a.previsao_entrega_manual::text, p.entregue_em::date::text) AS previsao_entrega
              FROM gestao.projetos p
              LEFT JOIN gestao.obra_acompanhamento a ON a.projeto_id = p.id
             WHERE p.card_id::text = %s
        """, (card_id,))
        p = cur.fetchone()
        if not p:
            raise HTTPException(404, "projeto do gestão não encontrado pra esse card")
        cur.execute("""
            SELECT i.id::text, i.ordem, i.categoria, i.descritivo, i.ambiente,
                   i.quantidade, i.unidade, i.status, i.meta,
                   i.previsao_inicio::text, i.previsao_fim::text, i.executado_em,
                   i.responsavel, i.observacoes,
                   i.valor_unit, i.valor_total,
                   (SELECT COUNT(*) FROM gestao.fotos f
                     WHERE f.item_id = i.id AND f.origem = 'instala')::int AS midias
              FROM gestao.itens i
             WHERE i.projeto_id::text = %s AND i.status != 'cancelado'
             ORDER BY i.ordem, i.categoria
        """, (p["id"],))
        itens = cur.fetchall()
    return {"projeto": p, "itens": itens}


def _insumo_bloco(cat: str, texto: str, qtd: float) -> str | None:
    """Heurística categoria do item → bloco_id da grade de insumos."""
    t = (texto or "").upper()
    cat = (cat or "").upper()
    if "PISO" in cat:
        import re as _re
        if _re.search(r"CHEVRON|ESPINHA|VERSALHES|ESCAMA|MACIÇO|MACICO", t):
            return "pisos_chevron"
        return "pisos_ate_19"
    if "FORRO" in cat:
        if "AUTOBROCANTE" in t:
            return "forro_autobrocante"
        if "INOX" in t or "PRAIA" in t:
            return "forro_praia_inox"
        return "forro_fincapino" if (qtd or 0) >= 60 else "forro_convencional"
    if "PAINEL" in cat or "BRISE" in cat or "REVESTIMENTO" in cat:
        return "paineis"
    if "DECK" in cat:
        return "deck_bpc_2x15x220cm" if "BPC" in t else "deck_madeira_25x10"
    if "PORTA" in cat:
        if "SS200" in t or "SS 200" in t:
            return "porta_correr_ss200"
        if "CORRER" in t:
            return "porta_correr_dn150"
        fam = "geris" if "GERIS" in t else "cir"
        if "WC" in t or "BANHEIRO" in t:
            return f"porta_{fam}_wc"
        if "EXTERN" in t:
            return f"porta_{fam}_externo"
        return f"porta_{fam}_interno"
    if "MARCENARIA" in cat:
        return "marcenaria"
    if "RODAP" in cat:
        return "rodape_cordao"
    return None


def _insumo_qtd(qtd_por: float, obs: str, descricao: str, m2: float) -> tuple[float, bool]:
    """Interpreta a regra da grade (obs): retorna (qtd, fixo_por_obra)."""
    import re as _re
    o = (obs or "").upper()
    d = (descricao or "").upper()
    m = _re.search(r"(?:A CADA|CADA|PARA|POR)\s*(\d+)\s*M", o)
    if m:
        return qtd_por * m2 / float(m.group(1)), False
    if "POR OBRA" in o or "PANO DE CHAO" in d or "PANO DE CHÃO" in d:
        return qtd_por, True
    return qtd_por * m2, False


@app.get("/api/instala/conferencia-lista/{card_id}")
def instala_conferencia_lista(card_id: str):
    """Lista de conferência da obra: header do projeto + produtos + insumos calculados.
    Usada pelo instala e pelo verifica (fiscal)."""
    import math
    base = fiscal_obra_get(card_id)
    p, itens = base["projeto"], base["itens"]
    with conn() as c, c.cursor() as cur:
        cur.execute("""
            SELECT bloco_id, codigo, descricao, und, qtd_por_unidade, obs
              FROM orcamento_produtos.orcamento_insumos_grade
             WHERE ativo ORDER BY bloco_id, ordem
        """)
        grade = cur.fetchall()
    por_bloco: dict[str, list] = {}
    for g in grade:
        por_bloco.setdefault(g["bloco_id"], []).append(g)
    acc: dict[str, dict] = {}

    def soma(bloco: str, m2: float):
        for g in por_bloco.get(bloco, []):
            qtd, fixo = _insumo_qtd(float(g["qtd_por_unidade"] or 0), g["obs"], g["descricao"], m2)
            if qtd <= 0:
                continue
            k = g["codigo"] or g["descricao"]
            e = acc.setdefault(k, {"codigo": g["codigo"], "descricao": g["descricao"],
                                   "und": g["und"], "qtd": 0.0})
            e["qtd"] = max(e["qtd"], qtd) if fixo else e["qtd"] + qtd

    casou = False
    for it in itens:
        meta = it.get("meta") or {}
        texto = " ".join(str(x) for x in [it.get("descritivo"), meta.get("produto_header"),
                                          meta.get("categoria_raiz"), it.get("categoria")] if x)
        cat = str(meta.get("categoria_raiz") or (it.get("categoria") or "").split("||")[0])
        qtd = float(it.get("quantidade") or 0)
        bloco = _insumo_bloco(cat, texto, qtd)
        if bloco:
            casou = True
            soma(bloco, qtd if qtd > 0 else 1)
    if itens and not casou:
        soma("insumos", 1)  # kit genérico quando nenhum bloco específico casa
    insumos = [{**e, "qtd": math.ceil(e["qtd"] - 1e-9)} for e in acc.values() if e["qtd"] > 0]
    insumos.sort(key=lambda x: x["descricao"] or "")
    num = p["numero_proposta"]
    if num and ("-" in str(num) or len(str(num)) > 12):
        num = None  # projetos importados guardam UUID aqui — não mostrar
    return {"obra": {"cliente": p["cliente"], "obra_code": p["obra_code"],
                     "endereco": p["endereco"], "numero_proposta": num},
            "projeto": p, "itens": itens, "insumos": insumos}


class ObrasNoGestaoIn(BaseModel):
    card_ids: list[str]


@app.post("/api/fiscal/obras-no-gestao")
def obras_no_gestao(payload: ObrasNoGestaoIn):
    """Filtra uma lista de card_ids retornando SÓ os que existem em gestao.projetos.
    Retorna dict {card_id: {projeto_id, numero_proposta, cliente, status}}
    Usado pelo verifica.parket.works pra mostrar só obras que já entraram no gestão.
    """
    # Teto de sanidade: o verifica manda no máximo dezenas de cards; 500+ é abuso/bug.
    ids = [x for x in (payload.card_ids or []) if x][:500]
    if not ids:
        return {}
    with conn() as c, c.cursor() as cur:
        cur.execute("""
            SELECT p.card_id::text AS card_id, p.id::text AS projeto_id,
                   p.cliente, p.numero_proposta, p.status, p.obra_code::text,
                   COALESCE(v.pct_completo, 0) AS pct_completo,
                   COALESCE(v.n_entregues, 0) AS n_entregues,
                   COALESCE(v.n_em_execucao, 0) AS n_em_execucao,
                   COALESCE(v.n_total, 0) AS n_total
              FROM gestao.projetos p
              LEFT JOIN gestao.v_projeto_progresso v ON v.projeto_id = p.id
             WHERE p.card_id::text = ANY(%s)
        """, (ids,))
        rows = cur.fetchall()
    return {r["card_id"]: {
        "projeto_id": r["projeto_id"],
        "numero_proposta": r["numero_proposta"],
        "cliente": r["cliente"],
        "status": r["status"],
        "obra_code": r["obra_code"],
        "pct_completo": float(r["pct_completo"]),
        "n_entregues": r["n_entregues"],
        "n_em_execucao": r["n_em_execucao"],
        "n_total": r["n_total"],
    } for r in rows}


class InstalaProgressoIn(BaseModel):
    prestador_id: str | None = None
    prestador_nome: str | None = None
    qtd_delta: float | None = None
    # Correção ABSOLUTA do instalado (fiscal "atualizar o quanto falta"):
    # quando presente, seta meta.obra.qtd_instalada direto (pode REDUZIR),
    # ignorando qtd_delta. Clamp 0..quantidade vendida. Nunca auto-finaliza:
    # chegar em 100% por correção não vira 'entregue' (isso segue exigindo
    # o finalizado=true com o gate de 3 fotos).
    qtd_total: float | None = None
    finalizado: bool = False
    finalizando: bool = False
    midia_url: str | None = None
    midia_tipo: str | None = None  # foto | video
    client_key: str | None = None
    # QUEM está reportando: 'instala' (default, instalador) ou 'fiscal'
    # (verifica.parket.works). Muda a origem da foto, a legenda e o veredito
    # do evento (envio do próprio fiscal nasce aprovado, não entra na fila dele).
    origem: str | None = None


@app.post("/api/fiscal/obra/{card_id}/itens/{item_id}/progresso")
def fiscal_obra_item_progresso(card_id: str, item_id: str, payload: InstalaProgressoIn):
    """Progresso reportado pelo instalador (instala.parket.works) OU pelo fiscal
    (verifica.parket.works, origem='fiscal'): mídia + qtd/finalização."""
    _json = __import__("json")
    eh_fiscal = payload.origem == "fiscal"
    papel = "Fiscal" if eh_fiscal else "Instalador"
    with conn() as c, c.cursor() as cur:
        # Idempotência da fila offline: retry com o mesmo client_key não re-aplica
        # qtd_delta nem duplica foto — devolve o resultado do primeiro envio.
        if payload.client_key:
            cur.execute("""
                SELECT payload FROM gestao.eventos
                 WHERE item_id::text = %s AND tipo = 'instala_progresso'
                   AND payload->>'client_key' = %s
                 LIMIT 1
            """, (item_id, payload.client_key))
            dup = cur.fetchone()
            if dup:
                cur.execute("SELECT status FROM gestao.itens WHERE id::text = %s", (item_id,))
                st = cur.fetchone()
                return {"item_id": item_id, "status": (st or {}).get("status"),
                        "qtd_instalada": float((dup["payload"] or {}).get("qtd_instalada") or 0),
                        "dedup": True}
        cur.execute("SELECT id::text FROM gestao.projetos WHERE card_id::text = %s", (card_id,))
        p = cur.fetchone()
        if not p:
            raise HTTPException(404, "projeto do gestão não encontrado pra esse card")
        cur.execute("""
            SELECT id::text, projeto_id::text, descritivo, ambiente, quantidade, status, meta
              FROM gestao.itens
             WHERE id::text = %s AND projeto_id::text = %s AND status != 'cancelado'
        """, (item_id, p["id"]))
        it = cur.fetchone()
        if not it:
            raise HTTPException(404, "item não encontrado nessa obra")

        if payload.finalizado:
            # Fiscal finalizando conta as fotos dele E as do instalador (a obra
            # pode já ter registro de campo suficiente); instalador segue só
            # com as próprias, como sempre foi.
            origens = ("instala", "fiscal") if eh_fiscal else ("instala",)
            cur.execute("""
                SELECT COUNT(*)::int AS n FROM gestao.fotos
                 WHERE item_id::text = %s AND origem = ANY(%s)
            """, (item_id, list(origens)))
            midias = cur.fetchone()["n"] + (1 if payload.midia_url else 0)
            if midias < 3:
                falta = 3 - midias
                raise HTTPException(400, f"Envie pelo menos 3 fotos ou vídeos pra finalizar — faltam {falta}.")

        meta_obra = (it.get("meta") or {}).get("obra") or {}
        atual = float(meta_obra.get("qtd_instalada") or 0)
        total = float(it.get("quantidade") or 0)
        if payload.finalizado:
            nova = total if total > 0 else atual
        elif payload.qtd_total is not None:
            # Correção absoluta: aceita reduzir (inclusive zerar) e clampa no
            # total vendido — o fiscal digita o instalado REAL, não o delta.
            nova = max(0.0, min(payload.qtd_total, total) if total > 0 else payload.qtd_total)
        elif payload.qtd_delta and payload.qtd_delta > 0:
            nova = min(atual + payload.qtd_delta, total) if total > 0 else atual + payload.qtd_delta
        else:
            nova = atual
        if payload.finalizado:
            novo_status = "entregue"
        elif payload.qtd_total is not None:
            # Correção mexe no status nos dois sentidos: zerar volta pra
            # 'pendente'; reduzir um item já entregue reabre ('em_execucao');
            # corrigir pro próprio total mantém 'entregue' (no-op de status).
            if nova <= 0:
                novo_status = "pendente"
            elif it["status"] in ("entregue", "concluido"):
                novo_status = it["status"] if (total > 0 and nova >= total) else "em_execucao"
            else:
                novo_status = "em_execucao"
        else:
            novo_status = "em_execucao" if it["status"] == "pendente" else it["status"]

        obra_patch = {
            "qtd_instalada": round(nova, 2),
            "ultimo_prestador": payload.prestador_nome,
            "ultima_origem": "fiscal" if eh_fiscal else "instala",
            "ultima_atualizacao": datetime.now(timezone.utc).isoformat(),
        }
        cur.execute("""
            UPDATE gestao.itens
               SET meta = jsonb_set(COALESCE(meta,'{}'::jsonb), '{obra}',
                                    COALESCE(meta->'obra','{}'::jsonb) || %s::jsonb),
                   status = %s,
                   executado_em = CASE WHEN %s THEN now() ELSE executado_em END
             WHERE id::text = %s
             RETURNING id::text, status, meta
        """, (_json.dumps(obra_patch), novo_status, payload.finalizado, item_id))
        upd = cur.fetchone()

        if payload.midia_url:
            tipo = "video" if payload.midia_tipo == "video" else "foto"
            material = ((it.get("meta") or {}).get("produto_header") or "").strip()
            if not material:
                import re as _re
                material = _re.sub(r"^\s*[\d.]+\s*·\s*", "", (it.get("descritivo") or "")).strip()
            prefixo = " · ".join(s for s in ((it.get("ambiente") or "").strip().upper(), material.upper()) if s)
            legenda = (f"{prefixo} — " if prefixo else "") + f"{papel} {payload.prestador_nome or '—'}" + (
                " — ambiente finalizado" if (payload.finalizado or payload.finalizando) else "")
            # origem='fiscal' cai na aba Fiscal do Registro fotográfico do gestão;
            # 'instala' na aba Instalador. É o mesmo campo que a contagem acima lê.
            cur.execute("""
                INSERT INTO gestao.fotos (projeto_id, item_id, url, legenda, ambiente,
                                          categoria, tipo, origem, autor_email)
                VALUES (%s, %s, %s, %s, %s, NULL, %s, %s, NULL)
            """, (p["id"], item_id, payload.midia_url, legenda, it.get("ambiente"), tipo,
                  "fiscal" if eh_fiscal else "instala"))

        # Título do evento distingue as 3 ações: finalizar, corrigir (absoluto)
        # e registrar (delta) — o histórico da obra mostra o que aconteceu.
        acao = ("finalizou" if payload.finalizado
                else "corrigiu o instalado de" if payload.qtd_total is not None
                else "registrou progresso em")
        titulo = f"{payload.prestador_nome or papel} {acao} {(it['descritivo'] or '')[:60]}"
        cur.execute("""
            INSERT INTO gestao.eventos (projeto_id, item_id, tipo, titulo, autor_email, payload)
            VALUES (%s, %s, 'instala_progresso', %s, NULL, %s::jsonb)
        """, (p["id"], item_id, titulo,
              # fiscal.status nasce 'pendente': todo envio novo do instalador entra na
              # fila de validação do verifica. Eventos antigos (sem a chave) são legado
              # e não ganham chip de pendência (regra: aviso só após o evento existir).
              # Envio do PRÓPRIO fiscal nasce 'aprovado': não faz sentido ele validar
              # o que ele mesmo acabou de registrar.
              _json.dumps(payload.model_dump()
                          | {"qtd_instalada": nova,
                             "fiscal": ({"status": "aprovado", "por": payload.prestador_nome,
                                         "auto": True} if eh_fiscal
                                        else {"status": "pendente"})},
                          default=str)))

        todos_entregues = False
        if payload.finalizado:
            cur.execute("""
                SELECT COUNT(*) FILTER (WHERE status NOT IN ('entregue', 'concluido'))::int AS abertos,
                       COUNT(*)::int AS total
                  FROM gestao.itens
                 WHERE projeto_id::text = %s AND status != 'cancelado'
            """, (p["id"],))
            agg = cur.fetchone()
            todos_entregues = agg["total"] > 0 and agg["abertos"] == 0

    if todos_entregues:
        # Último item da lista entregue → obra concluída em todo lugar sem esperar
        # o fiscal: mesma flag details.obra_concluida que o "Terminou" do verifica
        # (instala e verifica leem ela pra mostrar 100% e descer pra Concluídas).
        try:
            with _sb_client() as sbc:
                r = sbc.get("/kanban_cards", params={"id": f"eq.{card_id}", "select": "details"})
                if r.status_code < 400 and r.json():
                    details = dict(r.json()[0].get("details") or {})
                    if not details.get("obra_concluida"):
                        details["obra_concluida"] = {
                            "por": f"{payload.prestador_nome or papel.lower()} ({papel.lower()})",
                            "em": datetime.now(timezone.utc).isoformat(),
                            "auto": True,
                        }
                        pr = sbc.patch("/kanban_cards", params={"id": f"eq.{card_id}"},
                                       json={"details": details})
                        if pr.status_code >= 400:
                            log.warning("auto_concluir_obra patch fail card=%s status=%s body=%s",
                                        card_id, pr.status_code, pr.text[:300])
        except Exception:
            log.warning("auto_concluir_obra fail card=%s", card_id, exc_info=True)
    return {"item_id": item_id, "status": upd["status"], "qtd_instalada": nova,
            "obra_concluida": todos_entregues}


@app.get("/api/fiscal/obra/{card_id}/progresso-validacao")
def fiscal_obra_progresso_validacao(card_id: str):
    """Fila de validação do fiscal (verifica.parket.works): todos os envios de
    progresso do instalador dessa obra, com o veredito do fiscal em payload->fiscal.
    Eventos legado (anteriores à validação) vêm com fiscal = null."""
    with conn() as c, c.cursor() as cur:
        cur.execute("SELECT id::text FROM gestao.projetos WHERE card_id::text = %s", (card_id,))
        p = cur.fetchone()
        if not p:
            raise HTTPException(404, "projeto do gestão não encontrado pra esse card")
        cur.execute("""
            SELECT e.id::text, e.item_id::text, e.created_at,
                   e.payload->>'prestador_nome'          AS prestador_nome,
                   (e.payload->>'qtd_delta')::float      AS qtd_delta,
                   (e.payload->>'qtd_instalada')::float  AS qtd_instalada,
                   e.payload->>'midia_url'               AS midia_url,
                   e.payload->>'midia_tipo'              AS midia_tipo,
                   COALESCE((e.payload->>'finalizado')::boolean, false) AS finalizado,
                   e.payload->'fiscal'                   AS fiscal,
                   i.descritivo, i.ambiente, i.unidade, i.quantidade
              FROM gestao.eventos e
              JOIN gestao.itens i ON i.id = e.item_id
             WHERE e.projeto_id::text = %s AND e.tipo = 'instala_progresso'
             ORDER BY e.created_at DESC
        """, (p["id"],))
        envios = cur.fetchall()
    pendentes = sum(1 for e in envios if (e.get("fiscal") or {}).get("status") == "pendente")
    return {"envios": envios, "pendentes": pendentes}


class ValidacaoPendenciasIn(BaseModel):
    card_ids: list[str]


@app.post("/api/fiscal/validacao/pendencias")
def fiscal_validacao_pendencias(payload: ValidacaoPendenciasIn):
    """Resumo batch das pendências de validação por obra (verifica.parket.works).
    Uma chamada só pra home do fiscal, em vez de N GETs de progresso-validacao.
    Retorna {card_id: {pendentes, finalizados_pendentes, mais_antigo_em}} — só
    obras com pelo menos 1 envio pendente aparecem no dict."""
    # Teto de sanidade: o verifica manda no máximo dezenas de cards; 500+ é abuso/bug.
    ids = [x for x in (payload.card_ids or []) if x][:500]
    if not ids:
        return {}
    with conn() as c, c.cursor() as cur:
        cur.execute("""
            SELECT p.card_id::text AS card_id,
                   COUNT(*)::int AS pendentes,
                   COUNT(*) FILTER (WHERE COALESCE((e.payload->>'finalizado')::boolean, false))::int
                       AS finalizados_pendentes,
                   MIN(e.created_at) AS mais_antigo_em
              FROM gestao.eventos e
              JOIN gestao.projetos p ON p.id = e.projeto_id
             WHERE p.card_id::text = ANY(%s)
               AND e.tipo = 'instala_progresso'
               AND e.payload->'fiscal'->>'status' = 'pendente'
             GROUP BY p.card_id
        """, (ids,))
        rows = cur.fetchall()
    return {r["card_id"]: {
        "pendentes": r["pendentes"],
        "finalizados_pendentes": r["finalizados_pendentes"],
        "mais_antigo_em": r["mais_antigo_em"].isoformat() if r["mais_antigo_em"] else None,
    } for r in rows}


def _fiscal_escopo_ok(card_id: str, email: str | None) -> bool:
    """Escopo do fiscal nas ações de veredito (validar envio / concluir obra).

    Regra: se a obra TEM fiscais vinculados (kanban_cards.details.fiscais[] e/ou
    gestao.projetos.meta.fiscais[]) e o e-mail pertence a um fiscal de campo
    (fiscal_equipe) que NÃO está nessa lista, bloqueia. E-mail vazio, e-mail de
    fora da equipe (gestão/admin) ou obra sem vínculo definido passam: o objetivo
    é impedir um fiscal agindo na obra de outro, não travar a gestão."""
    email = (email or "").strip()
    if not email:
        return True
    try:
        fiscais: list = []
        with _sb_client() as sbc:
            # ilike sem curinga = igualdade case-insensitive no PostgREST
            rf = sbc.get("/fiscal_equipe", params={"select": "id", "email": f"ilike.{email}", "limit": "1"})
            if rf.status_code != 200 or not rf.json():
                return True  # não é fiscal de campo (gestão/admin) — segue
            fid = rf.json()[0]["id"]
            rc = sbc.get("/kanban_cards", params={"select": "details", "id": f"eq.{card_id}", "limit": "1"})
            if rc.status_code == 200 and rc.json():
                fiscais = (rc.json()[0].get("details") or {}).get("fiscais") or []
        with conn() as c, c.cursor() as cur:
            cur.execute("SELECT COALESCE(meta->'fiscais','[]'::jsonb) AS f FROM gestao.projetos WHERE card_id::text = %s",
                        (card_id,))
            row = cur.fetchone()
            if row:
                fiscais = list(fiscais) + list(row["f"] or [])
    except Exception:
        # Checagem de escopo nunca derruba a ação por falha de infra (Cloud fora etc.)
        log.exception("fiscal_escopo_check card=%s", card_id)
        return True
    ids = {x.get("id") for x in fiscais if isinstance(x, dict) and x.get("id")}
    return (not ids) or (fid in ids)


class ProgressoValidacaoIn(BaseModel):
    aprovado: bool
    motivo: str | None = None      # obrigatório na reprovação (o instalador precisa saber o quê refazer)
    foto_url: str | None = None    # foto do fiscal mostrando o problema (bucket fiscal-midias)
    fiscal_nome: str | None = None
    fiscal_email: str | None = None


@app.post("/api/fiscal/obra/{card_id}/progresso-validacao/{evento_id}")
def fiscal_obra_progresso_validar(card_id: str, evento_id: str, payload: ProgressoValidacaoIn):
    """Fiscal aprova ou reprova um envio de progresso do instalador. O veredito é
    gravado em payload->fiscal do próprio evento e volta pro app do instalador."""
    _json = __import__("json")
    if not payload.aprovado and not (payload.motivo or "").strip():
        raise HTTPException(400, "Pra reprovar, descreva o motivo pro instalador.")
    if not _fiscal_escopo_ok(card_id, payload.fiscal_email):
        raise HTTPException(403, "Essa obra está com outro fiscal. Confira com a gestão antes de validar.")
    veredito = {
        "status": "aprovado" if payload.aprovado else "reprovado",
        "nome": payload.fiscal_nome,
        "motivo": (payload.motivo or "").strip() or None,
        "foto_url": payload.foto_url,
        "em": datetime.now(timezone.utc).isoformat(),
    }
    with conn() as c, c.cursor() as cur:
        cur.execute("SELECT id::text FROM gestao.projetos WHERE card_id::text = %s", (card_id,))
        p = cur.fetchone()
        if not p:
            raise HTTPException(404, "projeto do gestão não encontrado pra esse card")
        cur.execute("""
            UPDATE gestao.eventos
               SET payload = jsonb_set(COALESCE(payload,'{}'::jsonb), '{fiscal}', %s::jsonb)
             WHERE id::text = %s AND projeto_id::text = %s AND tipo = 'instala_progresso'
             RETURNING id::text
        """, (_json.dumps(veredito), evento_id, p["id"]))
        upd = cur.fetchone()
        if not upd:
            raise HTTPException(404, "envio de progresso não encontrado nessa obra")
    return {"evento_id": evento_id, "fiscal": veredito}


class ObraConcluirIn(BaseModel):
    concluir: bool = True
    fiscal_nome: str | None = None


@app.post("/api/fiscal/obra/{card_id}/concluir")
def fiscal_obra_concluir(card_id: str, payload: ObraConcluirIn,
                         x_user_email: str | None = Header(default=None)):
    """Fiscal marca a obra como terminada (ou reabre). Terminar entrega TODOS os
    itens abertos de uma vez, guardando o estado anterior em meta.obra.pre_conclusao
    pra o Reabrir restaurar o progresso real."""
    if not _fiscal_escopo_ok(card_id, x_user_email):
        raise HTTPException(403, "Essa obra está com outro fiscal. Confira com a gestão antes de concluir.")
    n_itens = 0
    with conn() as c, c.cursor() as cur:
        cur.execute("SELECT id::text FROM gestao.projetos WHERE card_id::text = %s", (card_id,))
        p = cur.fetchone()
        # Sem projeto no gestão não há itens pra entregar: 404 explícito em vez de
        # "ok" silencioso (o verifica cai no fallback antigo de flag direto no card).
        if not p:
            raise HTTPException(404, "projeto do gestão não encontrado pra esse card")
        if p:
            if payload.concluir:
                cur.execute("""
                    UPDATE gestao.itens
                       SET meta = jsonb_set(COALESCE(meta,'{}'::jsonb), '{obra}',
                                    COALESCE(meta->'obra','{}'::jsonb) || jsonb_build_object(
                                      'pre_conclusao', jsonb_build_object(
                                          'status', status,
                                          'qtd_instalada', COALESCE((meta->'obra'->>'qtd_instalada')::numeric, 0)),
                                      'qtd_instalada', CASE WHEN COALESCE(quantidade, 0) > 0
                                          THEN quantidade
                                          ELSE COALESCE((meta->'obra'->>'qtd_instalada')::numeric, 0) END)),
                           status = 'entregue',
                           executado_em = COALESCE(executado_em, now())
                     WHERE projeto_id::text = %s AND status NOT IN ('cancelado', 'entregue', 'concluido')
                 RETURNING id
                """, (p["id"],))
            else:
                cur.execute("""
                    UPDATE gestao.itens
                       SET status = COALESCE(meta->'obra'->'pre_conclusao'->>'status', status),
                           executado_em = CASE
                               WHEN COALESCE(meta->'obra'->'pre_conclusao'->>'status', 'entregue') != 'entregue'
                               THEN NULL ELSE executado_em END,
                           meta = jsonb_set(meta, '{obra}',
                                    (COALESCE(meta->'obra','{}'::jsonb) || jsonb_build_object(
                                       'qtd_instalada',
                                       COALESCE((meta->'obra'->'pre_conclusao'->>'qtd_instalada')::numeric,
                                                (meta->'obra'->>'qtd_instalada')::numeric, 0)))
                                    - 'pre_conclusao')
                     WHERE projeto_id::text = %s AND meta->'obra' ? 'pre_conclusao'
                 RETURNING id
                """, (p["id"],))
            n_itens = len(cur.fetchall())
            titulo = (f"{payload.fiscal_nome or 'Fiscal'} "
                      f"{'marcou a obra como terminada' if payload.concluir else 'reabriu a obra'}"
                      f" ({n_itens} itens)")
            cur.execute("""
                INSERT INTO gestao.eventos (projeto_id, item_id, tipo, titulo, autor_email, payload)
                VALUES (%s, NULL, 'obra_concluida', %s, NULL, %s::jsonb)
            """, (p["id"], titulo,
                  __import__("json").dumps({"concluir": payload.concluir,
                                            "fiscal_nome": payload.fiscal_nome, "n_itens": n_itens})))
    with _sb_client() as sbc:
        r = sbc.get("/kanban_cards", params={"id": f"eq.{card_id}", "select": "details"})
        _sb_raise(r, "obra_concluir_get")
        rows = r.json()
        if not rows:
            raise HTTPException(404, "card não encontrado")
        details = dict(rows[0].get("details") or {})
        if payload.concluir:
            details["obra_concluida"] = {
                "por": payload.fiscal_nome or "fiscal",
                "em": datetime.now(timezone.utc).isoformat(),
                "itens_auto": n_itens,
            }
        else:
            details.pop("obra_concluida", None)
        pr = sbc.patch("/kanban_cards", params={"id": f"eq.{card_id}"}, json={"details": details})
        _sb_raise(pr, "obra_concluir_patch")
    return {"ok": True, "concluir": payload.concluir, "n_itens": n_itens}


class InstalaOcorrenciaIn(BaseModel):
    card_id: str
    prestador_id: str | None = None
    prestador_nome: str | None = None
    tipo: str = "outro"
    descricao: str
    foto_url: str | None = None
    origem: str = "instala"
    fiscal_id: str | None = None
    fiscal_nome: str | None = None
    audio_url: str | None = None
    client_key: str | None = None


class InstalaMaterialIn(BaseModel):
    card_id: str
    prestador_id: str | None = None
    prestador_nome: str | None = None
    itens: str
    foto_url: str | None = None
    origem: str = "instala"
    fiscal_id: str | None = None
    fiscal_nome: str | None = None
    audio_url: str | None = None
    client_key: str | None = None


def _instala_dedup(sbc, tabela: str, client_key: str | None):
    """Retry da fila offline não pode duplicar: se o client_key já entrou, devolve a row existente."""
    if not client_key:
        return None
    r = sbc.get(f"/{tabela}", params={"client_key": f"eq.{client_key}", "limit": "1"})
    if r.status_code == 200 and r.json():
        return r.json()[0]
    return None


def _instala_evento_gestao(card_id: str, tipo: str, titulo: str, payload: dict) -> None:
    """Registra o evento na timeline do gestão quando o card já virou projeto."""
    _json = __import__("json")
    with conn() as c, c.cursor() as cur:
        cur.execute("SELECT id::text FROM gestao.projetos WHERE card_id::text = %s", (card_id,))
        p = cur.fetchone()
        if not p:
            return
        cur.execute("""
            INSERT INTO gestao.eventos (projeto_id, tipo, titulo, autor_email, payload)
            VALUES (%s, %s, %s, NULL, %s::jsonb)
        """, (p["id"], tipo, titulo, _json.dumps(payload, default=str)))


@app.post("/api/instala/ocorrencias")
def instala_ocorrencia(payload: InstalaOcorrenciaIn):
    """Ocorrência aberta pelo instalador: grava no Cloud (fiscal vê no verifica) + evento no gestão."""
    if not (payload.descricao or "").strip():
        raise HTTPException(400, "Descreva a ocorrência")
    row = {
        "card_id": payload.card_id,
        "prestador_id": payload.prestador_id,
        "prestador_nome": payload.prestador_nome,
        "tipo": payload.tipo if payload.tipo in ("material", "execucao", "cliente", "seguranca", "outro") else "outro",
        "descricao": payload.descricao.strip(),
        "foto_url": payload.foto_url,
        "origem": payload.origem if payload.origem in ("instala", "fiscal") else "instala",
        "fiscal_id": payload.fiscal_id,
        "fiscal_nome": payload.fiscal_nome,
        "audio_url": payload.audio_url,
        "client_key": payload.client_key,
    }
    with _sb_client() as sbc:
        ja = _instala_dedup(sbc, "instala_ocorrencias", payload.client_key)
        if ja:
            return ja
        r = sbc.post("/instala_ocorrencias", json=row, headers={"Prefer": "return=representation"})
        _sb_raise(r, "instala_ocorrencias")
        created = r.json()[0]
    autor = payload.prestador_nome or payload.fiscal_nome or ("Fiscal" if row["origem"] == "fiscal" else "Instalador")
    titulo = f"⚠ Ocorrência ({row['tipo']}) — {autor}: {row['descricao'][:80]}"
    _instala_evento_gestao(payload.card_id, "instala_ocorrencia", titulo, row | {"ocorrencia_id": created.get("id")})
    return created


@app.post("/api/instala/material")
def instala_material(payload: InstalaMaterialIn):
    """Solicitação de material do instalador: grava no Cloud + evento no gestão."""
    if not (payload.itens or "").strip():
        raise HTTPException(400, "Liste o material que precisa")
    row = {
        "card_id": payload.card_id,
        "prestador_id": payload.prestador_id,
        "prestador_nome": payload.prestador_nome,
        "itens": payload.itens.strip(),
        "foto_url": payload.foto_url,
        "origem": payload.origem if payload.origem in ("instala", "fiscal") else "instala",
        "fiscal_id": payload.fiscal_id,
        "fiscal_nome": payload.fiscal_nome,
        "audio_url": payload.audio_url,
        "client_key": payload.client_key,
    }
    with _sb_client() as sbc:
        ja = _instala_dedup(sbc, "instala_material_solicitacoes", payload.client_key)
        if ja:
            return ja
        r = sbc.post("/instala_material_solicitacoes", json=row, headers={"Prefer": "return=representation"})
        _sb_raise(r, "instala_material_solicitacoes")
        created = r.json()[0]
    autor = payload.prestador_nome or payload.fiscal_nome or ("Fiscal" if row["origem"] == "fiscal" else "Instalador")
    titulo = f"Material solicitado por {autor}: {row['itens'][:80]}"
    _instala_evento_gestao(payload.card_id, "instala_material", titulo, row | {"solicitacao_id": created.get("id")})
    return created


# ── Assumir + converter solicitação de material em solicitação de COMPRAS ──
# Fluxo Will 03/09: pedido de material do time (Instala/Verifica) aparece no
# verifica #material; quem estiver lá ASSUME e cria a solicitação de compras
# direto (cai no painel gestao.parket.works/compras). PKT-MAT-ASSUMIR-20260903.

class InstalaMaterialAssumirIn(BaseModel):
    nome: str  # quem está assumindo (fiscal/gestão logado no verifica)


@app.post("/api/instala/material/{sid}/assumir")
def instala_material_assumir(sid: str, payload: InstalaMaterialAssumirIn):
    """ASSUME a solicitação de material: grava atendida_por sem fechar.
    Status continua 'pendente' até virar solicitação de compras (criar-compra)."""
    nome = (payload.nome or "").strip()
    if not nome:
        raise HTTPException(400, "informe quem está assumindo")
    with _sb_client() as sbc:
        r = sbc.get("/instala_material_solicitacoes",
                    params={"id": f"eq.{sid}", "select": "id,status,atendida_por"})
        _sb_raise(r, "instala_material_get")
        rows = r.json()
        if not rows:
            raise HTTPException(404, "solicitação não encontrada")
        if rows[0].get("status") != "pendente":
            raise HTTPException(409, "solicitação já foi atendida/recusada")
        r = sbc.patch("/instala_material_solicitacoes", params={"id": f"eq.{sid}"},
                      json={"atendida_por": nome},
                      headers={"Prefer": "return=representation"})
        _sb_raise(r, "instala_material_assumir")
        return r.json()[0]


class InstalaConferenciaVolume(BaseModel):
    volume: int
    status: str = "ok"  # ok | avaria | falta
    foto_url: str | None = None
    obs: str | None = None
    item_id: str | None = None
    item_nome: str | None = None


class InstalaConferenciaIn(BaseModel):
    card_id: str
    prestador_id: str | None = None
    prestador_nome: str | None = None
    volumes: list[InstalaConferenciaVolume]
    client_key: str | None = None
    origem: str = "instala"  # instala | fiscal
    fiscal_nome: str | None = None


@app.post("/api/instala/conferencia")
def instala_conferencia(payload: InstalaConferenciaIn):
    """Conferência volume a volume do material recebido. Avaria/falta exige foto e abre ocorrência automática."""
    if not payload.volumes:
        raise HTTPException(400, "Confira ao menos um volume")
    problemas = [v for v in payload.volumes if v.status in ("avaria", "falta")]
    for v in problemas:
        if not v.foto_url:
            rot = v.item_nome or f"Volume {v.volume}"
            raise HTTPException(400, f"{rot}: foto é obrigatória pra avaria/falta")
    with _sb_client() as sbc:
        if payload.client_key:
            r = sbc.get("/instala_conferencias", params={
                "client_key": f"like.{payload.client_key}:*", "limit": "1"})
            if r.status_code == 200 and r.json():
                return {"ok": True, "dedup": True, "volumes": len(payload.volumes), "ocorrencia_id": None}

        ocorrencia_id = None
        if problemas:
            resumo = "; ".join(
                (v.item_nome or f"vol {v.volume}") + f" {v.status}"
                + (f" ({v.obs.strip()})" if (v.obs or "").strip() else "")
                for v in problemas)
            occ = {
                "card_id": payload.card_id,
                "prestador_id": payload.prestador_id,
                "prestador_nome": payload.prestador_nome,
                "tipo": "material",
                "descricao": f"Conferência de material: {resumo}",
                "foto_url": problemas[0].foto_url,
                "origem": payload.origem or "instala",
                "fiscal_nome": payload.fiscal_nome,
                "client_key": f"{payload.client_key}:occ" if payload.client_key else None,
            }
            r = sbc.post("/instala_ocorrencias", json=occ, headers={"Prefer": "return=representation"})
            _sb_raise(r, "instala_ocorrencias")
            ocorrencia_id = r.json()[0].get("id")

        rows = [{
            "card_id": payload.card_id,
            "prestador_id": payload.prestador_id,
            "prestador_nome": payload.prestador_nome,
            "volume": v.volume,
            "status": v.status if v.status in ("ok", "avaria", "falta") else "ok",
            "foto_url": v.foto_url,
            "obs": (v.obs or "").strip() or None,
            "item_id": v.item_id,
            "item_nome": v.item_nome,
            "origem": payload.origem or "instala",
            "fiscal_nome": payload.fiscal_nome,
            "ocorrencia_id": ocorrencia_id if v.status in ("avaria", "falta") else None,
            "client_key": f"{payload.client_key}:{v.volume}" if payload.client_key else None,
        } for v in payload.volumes]
        r = sbc.post("/instala_conferencias", json=rows)
        _sb_raise(r, "instala_conferencias")

    n_ok = len(payload.volumes) - len(problemas)
    quem = payload.fiscal_nome or payload.prestador_nome or "Instalador"
    unid = "itens" if any(v.item_nome for v in payload.volumes) else "volumes"
    titulo = (f"📋 Conferência de material — {quem}: "
              f"{n_ok}/{len(payload.volumes)} {unid} OK"
              + (f", {len(problemas)} com problema" if problemas else ""))
    _instala_evento_gestao(payload.card_id, "instala_conferencia", titulo, {
        "volumes": [v.model_dump() for v in payload.volumes],
        "ocorrencia_id": ocorrencia_id,
        "prestador_nome": payload.prestador_nome,
    })
    return {"ok": True, "volumes": len(payload.volumes), "ocorrencia_id": ocorrencia_id}


class InstalaFazendoHojeIn(BaseModel):
    prestador_id: str | None = None
    prestador_nome: str | None = None
    fazendo: bool = True


@app.post("/api/fiscal/obra/{card_id}/itens/{item_id}/fazendo-hoje")
def fiscal_obra_item_fazendo_hoje(card_id: str, item_id: str, payload: InstalaFazendoHojeIn):
    """Instalador marca o que a equipe está fazendo hoje — pode ser mais de um item por dia."""
    _json = __import__("json")
    from zoneinfo import ZoneInfo
    hoje = datetime.now(ZoneInfo("America/Sao_Paulo")).date().isoformat()
    with conn() as c, c.cursor() as cur:
        cur.execute("SELECT id::text FROM gestao.projetos WHERE card_id::text = %s", (card_id,))
        p = cur.fetchone()
        if not p:
            raise HTTPException(404, "projeto do gestão não encontrado pra esse card")
        cur.execute("""
            SELECT id::text, descritivo, status, meta FROM gestao.itens
             WHERE id::text = %s AND projeto_id::text = %s AND status != 'cancelado'
        """, (item_id, p["id"]))
        it = cur.fetchone()
        if not it:
            raise HTTPException(404, "item não encontrado nessa obra")

        fh = ((it.get("meta") or {}).get("obra") or {}).get("fazendo_hoje") or {}
        prestadores = list(fh.get("prestadores") or []) if fh.get("data") == hoje else []
        nome = (payload.prestador_nome or "").strip() or "Instalador"
        if payload.fazendo:
            if nome not in prestadores:
                prestadores.append(nome)
            novo_fh = {"data": hoje, "prestadores": prestadores}
        else:
            prestadores = [x for x in prestadores if x != nome]
            novo_fh = {"data": hoje, "prestadores": prestadores} if prestadores else None

        novo_status = ("em_execucao"
                       if payload.fazendo and it["status"] == "pendente" else it["status"])
        cur.execute("""
            UPDATE gestao.itens
               SET meta = jsonb_set(COALESCE(meta,'{}'::jsonb), '{obra}',
                                    COALESCE(meta->'obra','{}'::jsonb) || %s::jsonb),
                   status = %s
             WHERE id::text = %s
             RETURNING meta
        """, (_json.dumps({"fazendo_hoje": novo_fh}), novo_status, item_id))
        upd = cur.fetchone()

        titulo = (f"{nome} {'está fazendo hoje' if payload.fazendo else 'desmarcou atividade de hoje'}: "
                  f"{(it['descritivo'] or '')[:60]}")
        cur.execute("""
            INSERT INTO gestao.eventos (projeto_id, item_id, tipo, titulo, autor_email, payload)
            VALUES (%s, %s, 'instala_atividade', %s, NULL, %s::jsonb)
        """, (p["id"], item_id, titulo,
              _json.dumps({"fazendo": payload.fazendo, "data": hoje,
                           "prestador": nome, "prestador_id": payload.prestador_id})))
    return {"item_id": item_id, "status": novo_status,
            "fazendo_hoje": (upd["meta"].get("obra") or {}).get("fazendo_hoje")}


# ── EVENTOS (timeline) ────────────────────────────────────
@app.get("/api/projetos/{pid}/eventos")
def eventos_list(pid: str, limit: int = 100):
    with conn() as c, c.cursor() as cur:
        cur.execute("""
            SELECT id, tipo, titulo, descricao, autor_email, etapa_numero,
                   item_id, payload, created_at
              FROM gestao.eventos
             WHERE projeto_id::text = %s
             ORDER BY created_at DESC LIMIT %s
        """, (pid, limit))
        return cur.fetchall()


# Criação manual de projeto removida 02/09 (decisão Will): projeto novo nasce
# SÓ no Home Broker — o gestão apenas atualiza em cima de projeto existente.
# O endpoint POST /api/projetos (criava gestao.projetos + etapas + itens sem
# proposta vinculada) saiu junto com o CriarProjetoModal do frontend.
# O /api/sync/from-proposta abaixo FICA: é espelho de proposta já criada, não criação.


# ── SYNC (mirror manual) ─────────────────────────────────
class SyncIn(BaseModel):
    simulacao_id: str
    contrato_id: str | None = None
    gestor_email: str | None = None


@app.post("/api/sync/from-proposta")
def sync_from_proposta(payload: SyncIn, x_user_email: str | None = Header(default=None)):
    """Cria projeto a partir de proposta (idempotente). Uso manual — bypass do gatilho."""
    with conn() as c, c.cursor() as cur:
        cur.execute("""
            SELECT gestao.projetar_de_proposta(%s::uuid, %s::uuid, %s) AS projeto_id
        """, (payload.simulacao_id, payload.contrato_id, payload.gestor_email or x_user_email))
        r = cur.fetchone()
        # Todo card nasce com acesso da Central do Cliente (link + login + senha)
        _center_provision(cur, str(r["projeto_id"]))
    return {"projeto_id": str(r["projeto_id"])}


# ── FONTE: propostas candidatas (não têm projeto ainda) ─
@app.get("/api/fonte/propostas")
def fonte_propostas(q: str | None = None, limit: int = 30):
    """Lista propostas 'enviada' que ainda NÃO viraram projeto no gestão."""
    where = ["sp.status IN ('enviada','aprovada','assinada')",
             "NOT EXISTS (SELECT 1 FROM gestao.projetos g WHERE g.simulacao_id = sp.id)"]
    args: list = []
    if q:
        where.append("(sp.cliente ILIKE %s OR sp.numero ILIKE %s)")
        args.extend([f"%{q}%"] * 2)
    with conn() as c, c.cursor() as cur:
        cur.execute(f"""
            SELECT sp.id::text, sp.numero, sp.cliente, sp.endereco, sp.vendedor,
                   sp.status, sp.created_at, sp.selected_at, sp.card_id::text
              FROM public.simulacao_projetos sp
             WHERE {' AND '.join(where)}
             ORDER BY COALESCE(sp.selected_at, sp.created_at) DESC
             LIMIT %s
        """, (*args, limit))
        return cur.fetchall()



# ═══════════════════════════════════════════════════════════════════
# FISCAL — Equipe + Agenda
#
# **INTEGRAÇÃO COM verifica.parket.works**
# O PWA `verifica.parket.works` (parket-fiscal:latest) lê/escreve DIRETO
# no Supabase Cloud (hbxpilrxmitvzebluoom) — não no postgres local do gestao.
# Portanto o backend do gestao aponta as tabelas fiscal_* pra Cloud REST,
# preservando 100% da integração: escrita no gestao → aparece instantâneo
# no PWA dos fiscais em campo e vice-versa.
# ═══════════════════════════════════════════════════════════════════

import os
import httpx

SUPABASE_URL = os.environ.get("SUPABASE_URL", "https://hbxpilrxmitvzebluoom.supabase.co")
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_KEY", "")

def _sb_client() -> httpx.Client:
    """Cliente HTTP pré-configurado pra Supabase PostgREST (schema public)."""
    if not SUPABASE_KEY:
        raise HTTPException(500, "SUPABASE_SERVICE_KEY não configurada no backend do gestao")
    return httpx.Client(
        base_url=f"{SUPABASE_URL}/rest/v1",
        headers={
            "apikey": SUPABASE_KEY,
            "Authorization": f"Bearer {SUPABASE_KEY}",
            "Content-Type": "application/json",
            "User-Agent": "parket-gestao/1.0",
        },
        timeout=15.0,
    )


def _sb_raise(r: httpx.Response, ctx: str) -> None:
    if r.status_code >= 400:
        body = r.text[:500]
        log.warning("supabase_fail %s status=%s body=%s", ctx, r.status_code, body)
        raise HTTPException(r.status_code, f"[supabase:{ctx}] {body}")


# ─── FISCAL · Equipe ─────────────────────────────────────────

class FiscalCreate(BaseModel):
    nome: str
    telefone: str | None = None
    email: str | None = None
    ativo: bool = True
    permissoes: dict | None = None
    whatsapp_group_jid: str | None = None


class FiscalPatch(BaseModel):
    nome: str | None = None
    telefone: str | None = None
    email: str | None = None
    ativo: bool | None = None
    permissoes: dict | None = None
    whatsapp_group_jid: str | None = None


@app.get("/api/fiscal/equipe")
def fiscal_equipe_list(
    q: str | None = Query(default=None),
    ativo: bool | None = None,
    limit: int = 200,
):
    params: dict = {
        "select": "id,nome,telefone,email,ativo,permissoes,whatsapp_group_jid,user_id,created_at,updated_at",
        "order":  "ativo.desc,nome.asc",
        "limit":  str(limit),
    }
    if ativo is not None:
        params["ativo"] = f"eq.{'true' if ativo else 'false'}"
    if q:
        # PostgREST OR filter — busca em nome/email/telefone
        params["or"] = f"(nome.ilike.*{q}*,email.ilike.*{q}*,telefone.ilike.*{q}*)"
    with _sb_client() as sb:
        r = sb.get("/fiscal_equipe", params=params)
        _sb_raise(r, "equipe.list")
        return r.json()


@app.post("/api/fiscal/equipe")
def fiscal_equipe_create(payload: FiscalCreate, x_user_email: str | None = Header(default=None)):
    perms = payload.permissoes or {"laudos": True, "agenda": True, "fotos": True}
    body = {
        "nome": payload.nome.strip(),
        "telefone": payload.telefone,
        "email": payload.email,
        "ativo": payload.ativo,
        "permissoes": perms,
        "whatsapp_group_jid": payload.whatsapp_group_jid,
    }
    with _sb_client() as sb:
        r = sb.post("/fiscal_equipe", json=body, headers={"Prefer": "return=representation"})
        _sb_raise(r, "equipe.create")
        row = r.json()[0]
        log.info("fiscal_created id=%s por=%s", row["id"], x_user_email)
        return row


@app.patch("/api/fiscal/equipe/{fid}")
def fiscal_equipe_patch(fid: str, payload: FiscalPatch, x_user_email: str | None = Header(default=None)):
    fields = {k: v for k, v in payload.dict().items() if v is not None}
    if not fields:
        raise HTTPException(400, "nada pra atualizar")
    with _sb_client() as sb:
        r = sb.patch("/fiscal_equipe", params={"id": f"eq.{fid}"}, json=fields,
                     headers={"Prefer": "return=representation"})
        _sb_raise(r, "equipe.patch")
        rows = r.json()
        if not rows:
            raise HTTPException(404, "fiscal não encontrado")
        log.info("fiscal_patched id=%s campos=%s por=%s", fid, list(fields), x_user_email)
        return rows[0]


@app.delete("/api/fiscal/equipe/{fid}")
def fiscal_equipe_delete(fid: str, x_user_email: str | None = Header(default=None)):
    """Soft-delete: só desativa (ativo=false). Preserva histórico e FKs."""
    with _sb_client() as sb:
        r = sb.patch("/fiscal_equipe", params={"id": f"eq.{fid}"},
                     json={"ativo": False}, headers={"Prefer": "return=representation"})
        _sb_raise(r, "equipe.delete")
        rows = r.json()
        if not rows:
            raise HTTPException(404, "fiscal não encontrado")
        log.info("fiscal_disabled id=%s por=%s", fid, x_user_email)
        return {"ok": True, "id": rows[0]["id"], "nome": rows[0]["nome"]}


# ─── FISCAL · Agenda ─────────────────────────────────────────

class AgendaCreate(BaseModel):
    tipo: str
    data_inicio: str
    data_fim: str | None = None
    fiscal_id: str | None = None
    card_id: str | None = None
    obra: str | None = None
    cliente: str | None = None
    endereco: str | None = None
    notas: str | None = None
    status: str = "agendado"
    online: bool = False
    # online sem no_calendario = coluna Acompanhamento Online; com no_calendario = fica no dia
    no_calendario: bool = False
    tags: list[str] = []
    # Anexos do agendamento (projeto anexado, o que foi vendido…) — lista de
    # {url, nome, content_type, size}; arquivo em si vive no bucket fiscal-anexos
    attachments: list[dict] = []


class AgendaPatch(BaseModel):
    tipo: str | None = None
    data_inicio: str | None = None
    data_fim: str | None = None
    fiscal_id: str | None = None
    obra: str | None = None
    cliente: str | None = None
    endereco: str | None = None
    notas: str | None = None
    status: str | None = None
    online: bool | None = None
    no_calendario: bool | None = None
    tags: list[str] | None = None
    # lista completa substitui a anterior; [] limpa (None = não mexer)
    attachments: list[dict] | None = None


_TIPOS_OK   = {"1vistoria", "2vistoria", "acompanhamento", "entrega", "reparo"}
_STATUS_OK  = {"agendado", "confirmado", "realizado", "cancelado"}


@app.get("/api/fiscal/agenda")
def fiscal_agenda_list(
    from_date: str | None = Query(default=None, alias="from"),
    to_date:   str | None = Query(default=None, alias="to"),
    fiscal_id: str | None = None,
    status:    str | None = None,
    limit: int = 500,
):
    """Kanban semanal + views. JOIN embedded via PostgREST (fiscal_equipe:fiscal_id)
    devolve o nome do fiscal na mesma resposta. `fiscal_id` também vem plano pra
    facilitar filtros no frontend."""
    params: dict = {
        "select": "id,card_id,fiscal_id,tipo,data_inicio,data_fim,obra,cliente,endereco,status,notas,online,no_calendario,tags,attachments,created_at,updated_at,fiscal_equipe(nome)",
        "order":  "data_inicio.asc",
        "limit":  str(limit),
    }
    if from_date:
        params["data_inicio"] = f"gte.{from_date}"
    if to_date:
        # PostgREST não aceita 2 params com mesma key via dict — usar tupla
        params_list = [("select", params.pop("select")), ("order", params.pop("order")), ("limit", params.pop("limit"))]
        for k, v in params.items():
            params_list.append((k, v))
        params_list.append(("data_inicio", f"gte.{from_date}") if from_date else None)  # dead branch já tratado
        # rework: reconstruo manualmente
        pass
    # (rebuild query params — precisa suportar 2 filtros na mesma coluna data_inicio)
    q = []
    q.append(("select", "id,card_id,fiscal_id,tipo,data_inicio,data_fim,obra,cliente,endereco,status,notas,online,no_calendario,tags,attachments,created_at,updated_at,fiscal_equipe(nome)"))
    q.append(("order",  "data_inicio.asc"))
    q.append(("limit",  str(limit)))
    if from_date:
        q.append(("data_inicio", f"gte.{from_date}"))
    if to_date:
        q.append(("data_inicio", f"lt.{to_date}"))
    if fiscal_id:
        q.append(("fiscal_id", f"eq.{fiscal_id}"))
    if status:
        q.append(("status", f"eq.{status}"))
    with _sb_client() as sb:
        r = sb.get("/fiscal_agenda", params=q)
        _sb_raise(r, "agenda.list")
        rows = r.json()
        # Achata fiscal_equipe.nome pra fiscal_nome no topo (o frontend espera assim)
        for row in rows:
            fe = row.pop("fiscal_equipe", None) or {}
            row["fiscal_nome"] = fe.get("nome") if isinstance(fe, dict) else None
        return rows


@app.post("/api/fiscal/agenda")
def fiscal_agenda_create(payload: AgendaCreate, x_user_email: str | None = Header(default=None)):
    if payload.tipo not in _TIPOS_OK:
        raise HTTPException(400, f"tipo inválido — use {sorted(_TIPOS_OK)}")
    if payload.status not in _STATUS_OK:
        raise HTTPException(400, f"status inválido — use {sorted(_STATUS_OK)}")
    body = {
        "tipo": payload.tipo,
        "data_inicio": payload.data_inicio,
        "data_fim": payload.data_fim,
        "fiscal_id": payload.fiscal_id,
        "card_id": payload.card_id,
        "obra": payload.obra,
        "cliente": payload.cliente,
        "endereco": payload.endereco,
        "notas": payload.notas,
        "status": payload.status,
        "online": payload.online,
        "no_calendario": payload.no_calendario,
        "tags": payload.tags,
        "attachments": payload.attachments,
    }
    with _sb_client() as sb:
        r = sb.post("/fiscal_agenda", json=body, headers={"Prefer": "return=representation"})
        _sb_raise(r, "agenda.create")
        row = r.json()[0]
        log.info("agenda_created id=%s tipo=%s por=%s", row["id"], payload.tipo, x_user_email)
        return row


@app.patch("/api/fiscal/agenda/{aid}")
def fiscal_agenda_patch(aid: str, payload: AgendaPatch, x_user_email: str | None = Header(default=None)):
    fields = {k: v for k, v in payload.dict().items() if v is not None}
    if not fields:
        raise HTTPException(400, "nada pra atualizar")
    if "status" in fields and fields["status"] not in _STATUS_OK:
        raise HTTPException(400, "status inválido")
    if "tipo" in fields and fields["tipo"] not in _TIPOS_OK:
        raise HTTPException(400, "tipo inválido")
    with _sb_client() as sb:
        r = sb.patch("/fiscal_agenda", params={"id": f"eq.{aid}"}, json=fields,
                     headers={"Prefer": "return=representation"})
        _sb_raise(r, "agenda.patch")
        rows = r.json()
        if not rows:
            raise HTTPException(404, "agenda não encontrada")
        log.info("agenda_patched id=%s campos=%s por=%s", aid, list(fields), x_user_email)
        return rows[0]


@app.delete("/api/fiscal/agenda/{aid}")
def fiscal_agenda_delete(aid: str, x_user_email: str | None = Header(default=None)):
    with _sb_client() as sb:
        r = sb.delete("/fiscal_agenda", params={"id": f"eq.{aid}"},
                      headers={"Prefer": "return=representation"})
        _sb_raise(r, "agenda.delete")
        rows = r.json()
        if not rows:
            raise HTTPException(404, "agenda não encontrada")
        log.info("agenda_deleted id=%s por=%s", aid, x_user_email)
        return {"ok": True, "id": rows[0]["id"]}


@app.post("/api/fiscal/agenda-anexo")
async def fiscal_agenda_anexo_upload(file: UploadFile = File(...),
                                     x_user_email: str | None = Header(default=None)):
    # QUE FAZ: recebe 1 arquivo multipart (projeto anexado, proposta do que foi
    # vendido…), sobe pro bucket publico fiscal-anexos e devolve o metadado
    # {url, nome, content_type, size} que o frontend guarda na lista
    # fiscal_agenda.attachments (o arquivo em si vive so no Storage).
    import re as _re, uuid as _uuid
    data = await file.read()
    if not data:
        raise HTTPException(400, "arquivo vazio")
    if len(data) > 25 * 1024 * 1024:
        raise HTTPException(413, "arquivo acima de 25MB")
    safe = _re.sub(r"[^A-Za-z0-9._-]+", "_", file.filename or "arquivo")
    path = f"agenda/{_uuid.uuid4().hex[:12]}_{safe}"
    ct = file.content_type or "application/octet-stream"
    url = _upload_supabase_bucket("fiscal-anexos", path, data, ct)
    if not url:
        raise HTTPException(502, "falha no upload pro Storage")
    log.info("agenda_anexo_upload nome=%s size=%s por=%s", safe, len(data), x_user_email)
    return {"url": url, "nome": file.filename or safe, "content_type": ct, "size": len(data)}


# ═══════════════════════════════════════════════════════════════════
# PROJETO · Laudos & Vistorias
# Filtra fiscal_agenda + fiscal_laudos + fiscal_fotos pelo card_id do projeto
# (gestao.projetos.card_id → public.kanban_cards.id ↔ fiscal_*.card_id).
# Fonte de dado: mesmo Cloud usado pelo verifica.parket.works.
# ═══════════════════════════════════════════════════════════════════

def _projeto_card_id(pid: str) -> str | None:
    with conn() as c, c.cursor() as cur:
        cur.execute("SELECT card_id::text FROM gestao.projetos WHERE id::text = %s", (pid,))
        row = cur.fetchone()
    if not row:
        raise HTTPException(404, "projeto não encontrado")
    return row["card_id"]


@app.get("/api/projetos/{pid}/vistorias")
def projeto_vistorias(pid: str):
    """Vistorias (fiscal_agenda) vinculadas ao card_id do projeto."""
    card_id = _projeto_card_id(pid)
    if not card_id:
        return []
    q = [
        ("select", "id,card_id,fiscal_id,tipo,data_inicio,data_fim,obra,cliente,endereco,status,notas,online,no_calendario,tags,attachments,created_at,updated_at,fiscal_equipe(nome)"),
        ("card_id", f"eq.{card_id}"),
        ("order", "data_inicio.desc"),
    ]
    with _sb_client() as sb:
        r = sb.get("/fiscal_agenda", params=q)
        _sb_raise(r, "projeto.vistorias")
        rows = r.json()
        for row in rows:
            fe = row.pop("fiscal_equipe", None) or {}
            row["fiscal_nome"] = fe.get("nome") if isinstance(fe, dict) else None
        return rows


@app.get("/api/projetos/{pid}/laudos")
def projeto_laudos(pid: str):
    """Laudos técnicos (fiscal_laudos) vinculados ao card_id do projeto."""
    card_id = _projeto_card_id(pid)
    if not card_id:
        return []
    q = [
        ("select", "id,card_id,obra,cliente,endereco,tipo,fiscal_id,fiscal_nome,data_vistoria,data_agendamento,status,setor,descritivo_sistema,descritivo_material,servicos_inclusos,observacoes,created_at,updated_at"),
        ("card_id", f"eq.{card_id}"),
        ("order", "data_vistoria.desc.nullslast,created_at.desc"),
    ]
    with _sb_client() as sb:
        r = sb.get("/fiscal_laudos", params=q)
        _sb_raise(r, "projeto.laudos")
        return r.json()


@app.get("/api/projetos/{pid}/fotos")
def projeto_fotos(pid: str, laudo_id: str | None = None, limit: int = 200):
    """Fotos (fiscal_fotos) vinculadas ao card_id do projeto — ou filtradas por laudo_id."""
    card_id = _projeto_card_id(pid)
    if not card_id:
        return []
    q = [
        ("select", "id,laudo_id,card_id,ambiente,url,descricao,servico,tipo,storage_path,created_at"),
        ("card_id", f"eq.{card_id}"),
        ("order", "created_at.desc"),
        ("limit", str(limit)),
    ]
    if laudo_id:
        q.append(("laudo_id", f"eq.{laudo_id}"))
    with _sb_client() as sb:
        r = sb.get("/fiscal_fotos", params=q)
        _sb_raise(r, "projeto.fotos")
        return r.json()


# ═══════════════════════════════════════════════════════════════════
# INSTALA — endpoints por projeto (13/08/2026)
# App instala.parket.works grava direto no Supabase Cloud (instala_*).
# Gestão precisa ler pra mostrar no card do cliente — mesmo padrão do
# fluxo fiscal (leitura por card_id). Espelha projeto_laudos/projeto_fotos.
# ═══════════════════════════════════════════════════════════════════

@app.get("/api/projetos/{pid}/instala-ocorrencias")
def projeto_instala_ocorrencias(pid: str):
    """Ocorrências reportadas pelo instalador (instala_ocorrencias)."""
    card_id = _projeto_card_id(pid)
    if not card_id:
        return []
    q = [
        ("select", "id,card_id,prestador_id,prestador_nome,tipo,descricao,foto_url,audio_url,status,resolvida_por,resolvida_em,fiscal_id,fiscal_nome,created_at"),
        ("card_id", f"eq.{card_id}"),
        ("order", "created_at.desc"),
    ]
    with _sb_client() as sb:
        r = sb.get("/instala_ocorrencias", params=q)
        _sb_raise(r, "projeto.instala_ocorrencias")
        return r.json()


@app.get("/api/projetos/{pid}/instala-checkins")
def projeto_instala_checkins(pid: str, limit: int = 100):
    """Check-ins de presença do instalador (instala_checkins)."""
    card_id = _projeto_card_id(pid)
    if not card_id:
        return []
    q = [
        ("select", "id,prestador_id,card_id,lat,lng,accuracy_m,foto_url,status,observacao,created_at,closed_at"),
        ("card_id", f"eq.{card_id}"),
        ("order", "created_at.desc"),
        ("limit", str(limit)),
    ]
    with _sb_client() as sb:
        r = sb.get("/instala_checkins", params=q)
        _sb_raise(r, "projeto.instala_checkins")
        return r.json()


@app.get("/api/projetos/{pid}/instala-conferencias")
def projeto_instala_conferencias(pid: str, limit: int = 200):
    """Conferências de material do instalador (instala_conferencias)."""
    card_id = _projeto_card_id(pid)
    if not card_id:
        return []
    q = [
        ("select", "*"),
        ("card_id", f"eq.{card_id}"),
        ("order", "created_at.desc"),
        ("limit", str(limit)),
    ]
    with _sb_client() as sb:
        r = sb.get("/instala_conferencias", params=q)
        _sb_raise(r, "projeto.instala_conferencias")
        return r.json()


# ── POST endpoints usados pela fila offline do instala-app ────────────
# instala-app/offline.ts descarrega jobs pendentes em POST /api/instala/...
# Sem esses endpoints a fila offline nunca esvaziava. Upsert por client_key
# garante idempotência (celular sem cobertura reenvia várias vezes).
@app.post("/api/instala/ocorrencias")
async def instala_ocorrencia_post(payload: dict):
    """Registra ocorrência do instalador. Idempotente por client_key."""
    if not payload.get("card_id"):
        raise HTTPException(400, "card_id obrigatório")
    ck = payload.get("client_key")
    with _sb_client() as sb:
        if ck:
            existing = sb.get("/instala_ocorrencias",
                params=[("select","id"), ("client_key", f"eq.{ck}"), ("limit","1")])
            if existing.status_code < 400 and existing.json():
                return {"id": existing.json()[0]["id"], "duplicated": True}
        r = sb.post("/instala_ocorrencias", json=payload,
                    headers={"Prefer": "return=representation"})
        _sb_raise(r, "post.instala_ocorrencia")
        rows = r.json()
        return rows[0] if isinstance(rows, list) and rows else rows


@app.post("/api/instala/conferencia")
async def instala_conferencia_post(payload: dict):
    """Registra conferência de material. Idempotente por client_key."""
    if not payload.get("card_id"):
        raise HTTPException(400, "card_id obrigatório")
    ck = payload.get("client_key")
    with _sb_client() as sb:
        if ck:
            existing = sb.get("/instala_conferencias",
                params=[("select","id"), ("client_key", f"eq.{ck}"), ("limit","1")])
            if existing.status_code < 400 and existing.json():
                return {"id": existing.json()[0]["id"], "duplicated": True}
        r = sb.post("/instala_conferencias", json=payload,
                    headers={"Prefer": "return=representation"})
        _sb_raise(r, "post.instala_conferencia")
        rows = r.json()
        return rows[0] if isinstance(rows, list) and rows else rows


@app.get("/api/instala/conferencia-lista/{card_id}")
async def instala_conferencia_lista(card_id: str):
    """Lista conferências de material de uma obra (pro instala-app)."""
    with _sb_client() as sb:
        r = sb.get("/instala_conferencias", params=[
            ("select", "*"),
            ("card_id", f"eq.{card_id}"),
            ("order", "created_at.desc"),
        ])
        _sb_raise(r, "instala_conferencia_lista")
        return r.json()


# ═══════════════════════════════════════════════════════════════════
# FISCAL · Support endpoints — combobox de projetos + Gestão de Laudos
# ═══════════════════════════════════════════════════════════════════

@app.get("/api/fiscal/projetos-lista")
def fiscal_projetos_lista(q: str | None = None, limit: int = 2000):
    """Lista simplificada de gestao.projetos pra combobox de vistoria.
    Retorna { id, card_id, cliente, obra_code, endereco } — a partir da
    seleção, o form de vistoria preenche cliente + obra + endereço + card_id
    automaticamente, garantindo o vínculo com o Kanban do Space."""
    where, args = ["1=1"], []
    if q:
        where.append("(cliente ILIKE %s OR obra_code ILIKE %s OR numero_proposta ILIKE %s)")
        args.extend([f"%{q}%"] * 3)
    with conn() as c, c.cursor() as cur:
        cur.execute(f"""
            SELECT id::text, card_id::text, cliente,
                   obra_code, endereco, numero_proposta,
                   column_id
              FROM gestao.projetos
             WHERE {' AND '.join(where)}
             ORDER BY cliente
             LIMIT %s
        """, (*args, limit))
        return cur.fetchall()


@app.get("/api/fiscal/laudos")
def fiscal_laudos_all(
    q: str | None = None,
    fiscal_id: str | None = None,
    tipo: str | None = None,
    status: str | None = None,
    limit: int = 500,
):
    """Todos os laudos (fiscal_laudos) — Gestão de Laudos.
    Cross-check com gestao.projetos: devolve `projeto_id` (se existir) pra
    o frontend linkar direto pro card do projeto."""
    q_params = [
        ("select", "id,card_id,obra,cliente,endereco,tipo,fiscal_id,fiscal_nome,data_vistoria,data_agendamento,status,setor,observacoes,created_at,updated_at"),
        ("order", "created_at.desc"),
        ("limit", str(limit)),
    ]
    if fiscal_id: q_params.append(("fiscal_id", f"eq.{fiscal_id}"))
    if tipo:      q_params.append(("tipo",       f"eq.{tipo}"))
    if status:    q_params.append(("status",     f"eq.{status}"))
    if q:
        q_params.append(("or", f"(cliente.ilike.*{q}*,obra.ilike.*{q}*,endereco.ilike.*{q}*)"))
    with _sb_client() as sb:
        r = sb.get("/fiscal_laudos", params=q_params)
        _sb_raise(r, "laudos.all")
        laudos = r.json()

    # Enriquece com projeto_id de gestao.projetos por card_id (batch)
    card_ids = list({(l.get("card_id") or "") for l in laudos if l.get("card_id")})
    proj_by_card: dict[str, str] = {}
    if card_ids:
        with conn() as c, c.cursor() as cur:
            cur.execute("""
                SELECT id::text AS projeto_id, card_id::text AS cid
                  FROM gestao.projetos
                 WHERE card_id = ANY(%s::uuid[])
            """, (card_ids,))
            for row in cur.fetchall():
                proj_by_card[row["cid"]] = row["projeto_id"]
    for l in laudos:
        cid = l.get("card_id") or ""
        l["projeto_id"] = proj_by_card.get(cid)
    return laudos


# ═══════════════════════════════════════════════════════════════════
# FISCAL · Laudo detalhado — checklists completos + fotos
# Consumido pelo modal de "Ver detalhes" na Gestão de Laudos + Card do Projeto.
# PDF: use https://verifica.parket.works/laudo.html?id=<uuid>
# ═══════════════════════════════════════════════════════════════════

@app.get("/api/fiscal/laudos/{lid}")
def fiscal_laudo_detalhe(lid: str):
    """Laudo completo — todos os checklist_* JSONBs + fotos vinculadas.
    Retorna { laudo, fotos } — o frontend renderiza cada checklist como seção."""
    q_l = [
        ("select", "*"),
        ("id", f"eq.{lid}"),
        ("limit", "1"),
    ]
    q_f = [
        ("select", "id,laudo_id,card_id,ambiente,url,descricao,servico,tipo,storage_path,created_at"),
        ("laudo_id", f"eq.{lid}"),
        ("order", "created_at.asc"),
    ]
    with _sb_client() as sb:
        rl = sb.get("/fiscal_laudos", params=q_l)
        _sb_raise(rl, "laudo.detalhe")
        laudos = rl.json()
        if not laudos:
            raise HTTPException(404, "laudo não encontrado")
        laudo = laudos[0]

        rf = sb.get("/fiscal_fotos", params=q_f)
        _sb_raise(rf, "laudo.detalhe.fotos")
        fotos = rf.json()

        # Enriquece com projeto do gestao.projetos (se card_id bate com algum)
        # + itens do projeto (pra pré-preencher a MEDIÇÃO EM OBRA do relatório).
        projeto_id = None
        projeto = None
        itens: list[dict] = []
        cid = laudo.get("card_id")
        if cid:
            with conn() as c, c.cursor() as cur:
                cur.execute("""
                    SELECT id::text, cliente, endereco, vendedor, numero_proposta
                      FROM gestao.projetos WHERE card_id::text = %s LIMIT 1
                """, (cid,))
                row = cur.fetchone()
                if row:
                    projeto_id = row["id"]
                    projeto = dict(row)
                    cur.execute("""
                        SELECT id::text, descritivo, ambiente, quantidade, unidade,
                               meta->>'codigo' AS codigo, meta->>'produto_header' AS produto_header
                          FROM gestao.itens WHERE projeto_id = %s::uuid
                         ORDER BY string_to_array(coalesce(meta->>'codigo', '999'), '.')::int[], descritivo
                    """, (projeto_id,))
                    itens = [dict(r) for r in cur.fetchall()]

    return {"laudo": laudo, "fotos": fotos, "projeto_id": projeto_id,
            "projeto": projeto, "itens": itens}


class LaudoPatch(BaseModel):
    relatorio_dados: dict | None = None
    observacoes: str | None = None
    status: str | None = None
    fiscal_id: str | None = None
    fiscal_nome: str | None = None
    data_vistoria: str | None = None


@app.patch("/api/fiscal/laudos/{lid}")
def fiscal_laudo_patch(lid: str, payload: LaudoPatch, x_user_email: str | None = Header(default=None)):
    """Atualiza os dados de relatório do laudo (relatorio_dados jsonb =
    modelo Parket: vendedor, medição em obra, entradas de relatório, termo)."""
    fields = payload.model_dump(exclude_none=True)
    if not fields:
        raise HTTPException(400, "nada pra atualizar")
    if "status" in fields and fields["status"] not in {"pendente", "agendado", "em_andamento", "concluido", "cancelado"}:
        raise HTTPException(400, f"status inválido: {fields['status']}")
    fields["updated_at"] = datetime.now(timezone.utc).isoformat()
    with _sb_client() as sb:
        if fields.get("fiscal_id") and "fiscal_nome" not in fields:
            fr = sb.get("/fiscal_equipe", params={"id": f"eq.{fields['fiscal_id']}", "select": "nome"})
            _sb_raise(fr, "laudo.patch.fiscal")
            frows = fr.json()
            if not frows:
                raise HTTPException(400, f"fiscal_id não encontrado na equipe: {fields['fiscal_id']}")
            fields["fiscal_nome"] = frows[0]["nome"]
        # relatorio_dados é substituído por inteiro — se o modal foi aberto
        # antes do link de assinatura existir, o estado local não tem o
        # sign_token e salvá-lo mataria o link já enviado ao cliente.
        if "relatorio_dados" in fields and "sign_token" not in fields["relatorio_dados"]:
            cr = sb.get("/fiscal_laudos", params={"id": f"eq.{lid}", "select": "relatorio_dados"})
            _sb_raise(cr, "laudo.patch.current")
            atuais = cr.json()
            tok = ((atuais[0].get("relatorio_dados") or {}).get("sign_token")) if atuais else None
            if tok:
                fields["relatorio_dados"]["sign_token"] = tok
        r = sb.patch("/fiscal_laudos", params={"id": f"eq.{lid}"}, json=fields,
                     headers={"Prefer": "return=representation"})
        _sb_raise(r, "laudo.patch")
        rows = r.json()
        if not rows:
            raise HTTPException(404, "laudo não encontrado")
        log.info("laudo_patched id=%s campos=%s por=%s", lid, list(fields), x_user_email)
        return rows[0]


class LaudoCreate(BaseModel):
    projeto_id: str
    tipo: str
    fiscal_id: str | None = None
    fiscal_nome: str | None = None
    data_vistoria: str | None = None
    servicos_inclusos: list[str] | None = None


LAUDO_TIPOS_VALIDOS = {"1vistoria", "2vistoria", "acompanhamento", "entrega",
                       "reparo", "termo", "fotografico"}


@app.post("/api/fiscal/laudos")
def fiscal_laudo_create(payload: LaudoCreate, x_user_email: str | None = Header(default=None)):
    """Cria um laudo/termo em branco vinculado ao card do projeto — modelos
    da pasta Fase 4 (9.1 vistoria, 9.2 termo, 9.3 fotográfico, 9.4 acompanhamento)."""
    if payload.tipo not in LAUDO_TIPOS_VALIDOS:
        raise HTTPException(400, f"tipo inválido: {payload.tipo}")
    with conn() as c, c.cursor() as cur:
        cur.execute(
            "SELECT card_id::text, cliente, endereco FROM gestao.projetos WHERE id::text = %s",
            (payload.projeto_id,),
        )
        row = cur.fetchone()
    if not row:
        raise HTTPException(404, "projeto não encontrado")
    card_id, cliente, endereco = row["card_id"], row["cliente"], row["endereco"]
    if not card_id:
        raise HTTPException(400, "projeto sem card_id — sem vínculo pro laudo")
    body = {
        "card_id": card_id,
        "obra": (cliente or "").upper(),
        "cliente": (cliente or "").upper(),
        "endereco": endereco or "",
        "tipo": payload.tipo,
        "fiscal_id": payload.fiscal_id,
        "fiscal_nome": payload.fiscal_nome,
        "data_vistoria": payload.data_vistoria or datetime.now(timezone.utc).isoformat(),
        "status": "pendente",
        "relatorio_dados": {},
    }
    # pré-marcação da gestão: o verifica filtra o checklist por esses serviços
    if payload.servicos_inclusos and payload.tipo in ("1vistoria", "2vistoria"):
        body["servicos_inclusos"] = [str(s).lower().strip() for s in payload.servicos_inclusos if str(s).strip()]
    with _sb_client() as sb:
        # fiscal_id sem nome → resolve o nome da equipe (o verifica filtra por
        # fiscal_id; o nome é só display, mas mantém os dois coerentes)
        if payload.fiscal_id and not payload.fiscal_nome:
            fr = sb.get("/fiscal_equipe", params={"id": f"eq.{payload.fiscal_id}", "select": "nome"})
            _sb_raise(fr, "laudo.create.fiscal")
            frows = fr.json()
            if not frows:
                raise HTTPException(400, f"fiscal_id não encontrado na equipe: {payload.fiscal_id}")
            body["fiscal_nome"] = frows[0]["nome"]
        r = sb.post("/fiscal_laudos", json=body, headers={"Prefer": "return=representation"})
        _sb_raise(r, "laudo.create")
        laudo = r.json()[0]
    log.info("laudo_criado id=%s tipo=%s projeto=%s por=%s",
             laudo["id"], payload.tipo, payload.projeto_id, x_user_email)
    return laudo


# ─── Lapidação IA do texto pro cliente (persona engenheiro) ────────
# O texto bruto do fiscal é informação interna e fica intacto. O que o
# cliente lê/assina ganha um resumo técnico lapidado pela IA, salvo em
# relatorio_dados.lapidado (editável no modal antes de gerar o link).

_LAPIDAR_SYSTEM = """Você é engenheiro(a) responsável técnico da Parket (madeira nobre
brasileira — pisos, decks, painéis, forros e marcenaria sob medida).

Sua tarefa: transformar as anotações de campo do fiscal de obras num RESUMO
TÉCNICO elegante que o CLIENTE vai ler e assinar junto do documento.

REGRAS:
- Português brasileiro, tom de engenharia: preciso, seguro, cordial. Nunca robótico.
- Primeiro parágrafo situa o serviço/vistoria (o que foi verificado e onde).
- Destaque condições constatadas, medições e ressalvas com objetividade e clareza.
- NUNCA invente dado que não esteja nas anotações. Se algo está incompleto, omita.
- Não exponha jargão interno, códigos de sistema ou nomes de colaboradores
  (exceto o fiscal responsável, se citado).
- Sem markdown, sem listas: 2 a 5 parágrafos corridos, no máximo ~180 palavras.
- Feche transmitindo confiança no acompanhamento técnico da Parket.

RESPONDA APENAS COM JSON VÁLIDO (sem markdown, sem texto extra):
{ "resumo": "…texto pronto pro cliente…" }"""


@app.post("/api/fiscal/laudos/{lid}/lapidar")
def fiscal_laudo_lapidar(lid: str, x_user_email: str | None = Header(default=None)):
    with _sb_client() as sb:
        r = sb.get("/fiscal_laudos", params={"id": f"eq.{lid}", "select": "*", "limit": "1"})
        _sb_raise(r, "laudo.lapidar.get")
        rows = r.json()
        if not rows:
            raise HTTPException(404, "laudo não encontrado")
        l = rows[0]
    rd = l.get("relatorio_dados") or {}
    # Reusa a mesma serialização do resumo-gestor (inclui checklists preenchidos
    # + entradas timestampadas). Threshold em CHARS de conteúdo útil, pra não
    # falhar quando o laudo tem só ocorrências + checklist mas poucos textões.
    ctx_texto = _laudo_context_texto(l)
    termo_cond = (rd.get("termo") or {}).get("condicao")
    if termo_cond:
        ctx_texto += f"\nCondição do termo: {termo_cond}"
    if len(ctx_texto.strip()) < 60:
        raise HTTPException(400, "laudo ainda sem anotações suficientes pra lapidar")
    ctx = "ANOTAÇÕES DE CAMPO (informação interna — use como fonte, não copie cru):\n" + ctx_texto
    resp = _ask_claude(_LAPIDAR_SYSTEM, ctx, max_tokens=1200)
    data = _extract_json(resp)
    resumo = str(data.get("resumo") or "").strip()[:4000]
    if not resumo:
        raise HTTPException(502, "IA não retornou resumo válido")
    from datetime import datetime as _dt, timezone as _tz
    rd["lapidado"] = {
        "resumo": resumo,
        "em": _dt.now(_tz.utc).isoformat(),
        "por": x_user_email,
        "modelo": os.environ.get("CLAUDE_MODEL", "claude-sonnet-4-5-20250929"),
    }
    with _sb_client() as sb:
        pr = sb.patch("/fiscal_laudos", params={"id": f"eq.{lid}"}, json={"relatorio_dados": rd})
        _sb_raise(pr, "laudo.lapidar.save")
    log.info("laudo_lapidado laudo=%s por=%s chars=%s", lid, x_user_email, len(resumo))
    return {"ok": True, "lapidado": rd["lapidado"]}


# ─── Resumo executivo pro GESTOR (interno) ─────────────────────────
# Diferente do lapidado (público): jargão OK, foco em pendências e riscos.
# Cache em relatorio_dados.resumo_gestor; invalida quando o laudo é editado
# (updated_at > resumo_gestor.em). Modal do gestor puxa no open.

_RESUMO_GESTOR_SYSTEM = """Você é analista sênior de operações da Parket. Sua tarefa é
produzir um BRIEFING EXECUTIVO de laudo fiscal pro gestor de obras — pra ele
entender em 15 segundos o estado da obra sem ler o laudo inteiro.

REGRAS:
- Português brasileiro, tom direto e técnico. Jargão interno OK.
- Estrutura obrigatória em duas partes:
  1) resumo: 2 a 4 frases curtas em UM parágrafo. Estado atual, pontos-chave.
  2) pendencias: lista de bullets objetivos com AÇÕES ou BLOQUEIOS (o que
     falta, o que precisa ser resolvido, riscos identificados). Cada bullet
     começa com verbo/substantivo forte (ex: "Falta forro X", "Atraso instalação Y",
     "Cliente ainda não aprovou Z"). Vazio se não houver.
- Fatos → das anotações; sem inventar. Se algo relevante estiver ausente, omita.
- Não repita o cabeçalho (cliente/data/fiscal já aparecem na UI).

RESPONDA APENAS COM JSON VÁLIDO (sem markdown, sem texto extra):
{ "resumo": "…parágrafo curto…", "pendencias": ["…", "…"] }"""


def _laudo_context_texto(l: dict) -> str:
    """Serializa o laudo em texto legível pra passar como contexto pro Claude."""
    rd = l.get("relatorio_dados") or {}
    campos = {
        "Tipo": l.get("tipo"),
        "Status": l.get("status"),
        "Setor": l.get("setor"),
        "Data da vistoria": l.get("data_vistoria"),
        "Fiscal responsável": l.get("fiscal_nome"),
        "Descritivo do sistema": l.get("descritivo_sistema"),
        "Descritivo do material": l.get("descritivo_material"),
        "Sistema de instalação": l.get("sistema_instalacao"),
        "Serviços inclusos": l.get("servicos_inclusos"),
        "Medição da obra": l.get("medicao_obra"),
        "Metragem por área": l.get("metragem_areas"),
        "Ocorrências": l.get("ocorrencias"),
        "Materiais em falta": l.get("materiais_falta"),
        "Insumos em falta": l.get("insumos_falta"),
        "Tipo de laje": l.get("tipo_laje"),
        "Reforço necessário": l.get("reforco_necessario"),
        "Observação sobre andaime": l.get("obs_andaime"),
        "Insumos necessários": l.get("insumos_necessarios"),
        "Materiais necessários": l.get("materiais_necessarios"),
        "Descritivo do reparo": l.get("descritivo_reparo"),
        "Observação sobre solução": l.get("obs_solucao"),
        "Resultado": l.get("resultado"),
        "Observações do fiscal": l.get("observacoes"),
    }
    linhas = [f"{k}: {v}" for k, v in campos.items() if v not in (None, "", [], {})]
    # Checklists com conteúdo
    for k, v in l.items():
        if k.startswith("checklist_") and isinstance(v, dict) and v:
            linhas.append(f"{k}: {v}")
    # Entradas manuais do relatório
    entradas = rd.get("entradas") or []
    if entradas:
        entr_txt = "\n".join(
            f"  - ({e.get('autor') or 'fiscal'} em {e.get('data') or '?'}) {(e.get('texto') or '').strip()}"
            for e in entradas if (e.get("texto") or "").strip()
        )
        if entr_txt:
            linhas.append(f"Entradas do relatório:\n{entr_txt}")
    return "\n".join(linhas)


@app.post("/api/fiscal/laudos/{lid}/resumo-gestor")
def fiscal_laudo_resumo_gestor(
    lid: str,
    force: bool = False,
    x_user_email: str | None = Header(default=None),
):
    """Gera (ou retorna cacheado) o resumo executivo pro gestor."""
    with _sb_client() as sb:
        r = sb.get("/fiscal_laudos", params={"id": f"eq.{lid}", "select": "*", "limit": "1"})
        _sb_raise(r, "laudo.resumo_gestor.get")
        rows = r.json()
        if not rows:
            raise HTTPException(404, "laudo não encontrado")
        l = rows[0]
    import hashlib as _hl
    rd = l.get("relatorio_dados") or {}
    cached = rd.get("resumo_gestor") or {}
    ctx_texto = _laudo_context_texto(l)
    if not ctx_texto.strip() or len(ctx_texto) < 40:
        raise HTTPException(400, "laudo ainda sem conteúdo suficiente pra resumir")
    content_hash = _hl.sha256(ctx_texto.encode("utf-8")).hexdigest()[:16]
    # Cache válido se: existe E o hash do conteúdo-fonte não mudou desde a geração.
    if not force and cached.get("resumo") and cached.get("content_hash") == content_hash:
        return {"ok": True, "resumo_gestor": cached, "cached": True}
    # Opus 4.7 pra briefing executivo — melhor síntese que Sonnet, custo aceitável
    # dado o cache por content_hash (regera só quando o laudo muda).
    _MODEL_RESUMO_GESTOR = "claude-opus-4-7"
    resp = _ask_claude(_RESUMO_GESTOR_SYSTEM, ctx_texto, max_tokens=1000,
                       model=_MODEL_RESUMO_GESTOR)
    data = _extract_json(resp)
    resumo = str(data.get("resumo") or "").strip()[:2000]
    pendencias = data.get("pendencias") or []
    if not isinstance(pendencias, list):
        pendencias = []
    pendencias = [str(p).strip()[:400] for p in pendencias if str(p).strip()][:15]
    if not resumo:
        raise HTTPException(502, "IA não retornou resumo válido")
    from datetime import datetime as _dt, timezone as _tz
    rg = {
        "resumo": resumo,
        "pendencias": pendencias,
        "em": _dt.now(_tz.utc).isoformat(),
        "por": x_user_email,
        "modelo": _MODEL_RESUMO_GESTOR,
        "content_hash": content_hash,
    }
    rd["resumo_gestor"] = rg
    with _sb_client() as sb:
        pr = sb.patch("/fiscal_laudos", params={"id": f"eq.{lid}"}, json={"relatorio_dados": rd})
        _sb_raise(pr, "laudo.resumo_gestor.save")
    log.info("laudo_resumo_gestor laudo=%s por=%s chars=%s pend=%s",
             lid, x_user_email, len(resumo), len(pendencias))
    return {"ok": True, "resumo_gestor": rg, "cached": False}


# ─── Assinatura pública do cliente (link /assinar/<token>) ─────────
# Token mora em relatorio_dados.sign_token (jsonb — sem DDL na tabela
# compartilhada com o verifica PWA). O link permite UMA assinatura do
# responsável da obra; técnico Parket continua assinando no modal.

@app.post("/api/fiscal/laudos/{lid}/link-assinatura")
def fiscal_laudo_link_assinatura(lid: str, x_user_email: str | None = Header(default=None)):
    """Gera (ou reusa) o link público pro cliente assinar o termo/laudo."""
    with _sb_client() as sb:
        r = sb.get("/fiscal_laudos", params={"id": f"eq.{lid}", "select": "id,relatorio_dados"})
        _sb_raise(r, "laudo.sign_token.get")
        rows = r.json()
        if not rows:
            raise HTTPException(404, "laudo não encontrado")
        rd = rows[0].get("relatorio_dados") or {}
        token = rd.get("sign_token")
        if not token:
            token = secrets.token_urlsafe(24)
            rd["sign_token"] = token
            pr = sb.patch("/fiscal_laudos", params={"id": f"eq.{lid}"}, json={"relatorio_dados": rd})
            _sb_raise(pr, "laudo.sign_token.set")
            log.info("laudo_sign_token_criado laudo=%s por=%s", lid, x_user_email)
    return {"token": token, "url": f"https://gestao.parket.works/assinar/{token}"}


def _laudo_by_sign_token(sb, token: str) -> dict:
    # CENTER_LAUDO_CAMPOS/CHECKLISTS: mesmo conjunto que o center exibe —
    # a página de assinatura mostra o laudo inteiro, igual ao PDF do fiscal.
    base = ["id", "tipo", "card_id", "data_vistoria", "fiscal_nome", "relatorio_dados"]
    campos = base + [c for c in CENTER_LAUDO_CAMPOS if c not in base] + CENTER_LAUDO_CHECKLISTS
    r = sb.get("/fiscal_laudos", params={
        "relatorio_dados->>sign_token": f"eq.{token}",
        "select": ",".join(campos),
        "limit": "1",
    })
    _sb_raise(r, "publico.laudo.get")
    rows = r.json()
    if not rows:
        raise HTTPException(404, "link inválido ou expirado")
    return rows[0]


@app.get("/api/publico/laudo-assinatura/{token}")
def publico_laudo_assinatura(token: str):
    """Dados mínimos pro cliente conferir e assinar — sem expor o resto."""
    with _sb_client() as sb:
        l = _laudo_by_sign_token(sb, token)
        rf = sb.get("/fiscal_fotos", params={
            "laudo_id": f"eq.{l['id']}",
            "select": "url,descricao,ambiente,servico,tipo",
            "order": "created_at.asc",
        })
        _sb_raise(rf, "publico.laudo.fotos")
        fotos = rf.json()
    rd = l.get("relatorio_dados") or {}
    termo = rd.get("termo") or {}
    # Condição referenciada no meio do texto do termo — se o gerador não
    # preencheu o campo específico, usa o que o fiscal escreveu no relatório.
    # Só no tipo termo: nos relatórios técnicos as entradas aparecem à parte.
    condicao = (termo.get("condicao") or "").strip()
    if not condicao and l.get("tipo") == "termo":
        condicao = "\n\n".join(
            (e.get("texto") or "").strip()
            for e in (rd.get("entradas") or []) if (e.get("texto") or "").strip()
        )
    endereco = l.get("endereco") or None
    # Laudos antigos foram criados com endereco vazio — busca do projeto.
    if not endereco and l.get("card_id"):
        with conn() as c, c.cursor() as cur:
            cur.execute("SELECT endereco FROM gestao.projetos WHERE card_id::text = %s LIMIT 1",
                        (l["card_id"],))
            row = cur.fetchone()
            if row:
                endereco = row["endereco"] or None
    # Termo de entrega: a pesquisa de satisfação mora na mesma página —
    # devolve a avaliação já registrada (etapa 10) pra UI não pedir de novo.
    avaliacao = None
    if l.get("tipo") == "entrega" and l.get("card_id"):
        with conn() as c, c.cursor() as cur:
            cur.execute("""
                SELECT pe.meta FROM gestao.projeto_etapas pe
                  JOIN gestao.projetos p ON p.id = pe.projeto_id
                 WHERE p.card_id::text = %s AND pe.etapa_numero = 10
                 LIMIT 1
            """, (l["card_id"],))
            row = cur.fetchone()
            if row:
                avaliacao = (row["meta"] or {}).get("avaliacao")
    return {
        "avaliacao": avaliacao,
        "tipo": l["tipo"],
        "cliente": l.get("cliente"),
        "obra": l.get("obra"),
        "endereco": endereco,
        "data_vistoria": l.get("data_vistoria"),
        "fiscal_nome": l.get("fiscal_nome"),
        "condicao": condicao,
        # Resumo técnico lapidado pela IA (persona engenheiro) — o cliente lê
        # este texto; as anotações brutas do fiscal são informação interna.
        "resumo_engenharia": ((rd.get("lapidado") or {}).get("resumo") or ""),
        "fotos": fotos,
        "assinado": bool(termo.get("resp_ass")),
        "resp_obra": termo.get("resp_obra") or "",
        "assinado_em": termo.get("assinado_em"),
        # Relatório modelo Parket preenchido no gerador — mesmas seções do
        # PDF 9.1 (1ª Vistoria do Fiscal): o cliente confere o que assina.
        "relatorio": {
            "vendedor": rd.get("vendedor") or "",
            "responsavel": rd.get("responsavel") or "",
            "relatorio_numero": rd.get("relatorio_numero"),
            "relatorio_data": rd.get("relatorio_data"),
            "descricao_produto": rd.get("descricao_produto") or "",
            "servico_contratado": rd.get("servico_contratado") or [],
            "medicao_itens": rd.get("medicao_itens") or [],
            "entradas": rd.get("entradas") or [],
            "observacoes": l.get("observacoes") or "",
        },
        # Campos próprios do laudo do fiscal (mesma estrutura do spec-fiscal /
        # PDF 1ª Vistoria): descritivos, metragem, ocorrências, checklists etc.
        "conteudo": {
            **{
                k: l[k]
                for k in CENTER_LAUDO_CAMPOS
                if k not in ("cliente", "obra", "endereco", "observacoes")
                and l.get(k) not in (None, "", [], {})
            },
            **({"checklists": cks} if (cks := {
                k.removeprefix("checklist_"): l[k]
                for k in CENTER_LAUDO_CHECKLISTS
                if l.get(k) not in (None, "", [], {})
            }) else {}),
        },
    }


class AssinaturaPublica(BaseModel):
    nome: str
    cpf: str | None = None
    assinatura: str  # data URI PNG do canvas


@app.post("/api/publico/laudo-assinatura/{token}")
def publico_laudo_assinar(token: str, payload: AssinaturaPublica):
    if not payload.nome.strip():
        raise HTTPException(400, "nome obrigatório")
    if not payload.assinatura.startswith("data:image/"):
        raise HTTPException(400, "assinatura inválida")
    if len(payload.assinatura) > 400_000:
        raise HTTPException(400, "assinatura grande demais")
    with _sb_client() as sb:
        l = _laudo_by_sign_token(sb, token)
        rd = l.get("relatorio_dados") or {}
        termo = rd.get("termo") or {}
        if termo.get("resp_ass"):
            raise HTTPException(409, "documento já assinado")
        agora = datetime.now(timezone(timedelta(hours=-3)))
        termo.update({
            "resp_obra": payload.nome.strip(),
            "resp_cpf": (payload.cpf or termo.get("resp_cpf") or "").strip(),
            "resp_data": agora.strftime("%d/%m/%Y"),
            "resp_ass": payload.assinatura,
            "assinado_em": agora.isoformat(),
        })
        rd["termo"] = termo
        pr = sb.patch("/fiscal_laudos", params={"id": f"eq.{l['id']}"}, json={
            "relatorio_dados": rd,
            "updated_at": datetime.now(timezone.utc).isoformat(),
        })
        _sb_raise(pr, "publico.laudo.assinar")
    log.info("laudo_assinado_publico laudo=%s nome=%s", l["id"], payload.nome)
    return {"ok": True}


# ═══════════════════════════════════════════════════════════════════
# OBRAS — Prestadores (equipes_parket) + Cronograma (cronograma_obras)
#
# Integração com Space (dept-obras) + cronograma.parket.works:
# ambas as tabelas moram em Cloud (hbxpilrxmitvzebluoom). Editar aqui
# reflete no dept-obras e no cronograma.parket.works em tempo real.
#
# Vínculo equipe↔projeto: kanban_cards.details.prestadores (JSONB array).
# Vínculo cronograma↔projeto: cronograma_obras.card_id → kanban_cards.id.
# Ambos compartilham o mesmo card_id que gestao.projetos.card_id.
# ═══════════════════════════════════════════════════════════════════

class EquipeCreate(BaseModel):
    nome: str
    telefone: str | None = None
    categoria: str
    ativo: bool = True
    cnpj_cpf: str | None = None
    endereco: str | None = None
    email: str | None = None
    foto_url: str | None = None


class EquipePatch(BaseModel):
    nome: str | None = None
    telefone: str | None = None
    categoria: str | None = None
    ativo: bool | None = None
    cnpj_cpf: str | None = None
    endereco: str | None = None
    email: str | None = None
    foto_url: str | None = None


@app.get("/api/obras/equipes")
def obras_equipes_list(
    q: str | None = Query(default=None),
    ativo: bool | None = None,
    categoria: str | None = None,
    limit: int = 300,
):
    params: list[tuple[str, str]] = [
        # categorias[] = todas as frentes do instalador (dedup 018). categoria
        # segue sendo a principal, que é o que agrupa a lista na tela.
        ("select", "id,nome,telefone,categoria,categorias,prestador_id,ativo,cnpj_cpf,endereco,email,foto_url,total_checks,total_ok,total_ocorrencias,total_sem_resposta,pct_ok,ultimo_check,dias_verificados,obras_distintas,created_at,updated_at"),
        ("order", "ativo.desc,categoria.asc,nome.asc"),
        ("limit", str(limit)),
    ]
    if ativo is not None:
        params.append(("ativo", f"eq.{'true' if ativo else 'false'}"))
    if categoria:
        params.append(("categoria", f"eq.{categoria}"))
    if q:
        params.append(("or", f"(nome.ilike.*{q}*,telefone.ilike.*{q}*)"))
    with _sb_client() as sb:
        r = sb.get("/equipes_parket", params=params)
        _sb_raise(r, "obras.equipes.list")
        return r.json()


@app.post("/api/obras/equipes")
def obras_equipes_create(payload: EquipeCreate, x_user_email: str | None = Header(default=None)):
    body = payload.model_dump(exclude_none=True)
    with _sb_client() as sb:
        r = sb.post("/equipes_parket", json=body, headers={"Prefer": "return=representation"})
        _sb_raise(r, "obras.equipes.create")
        row = r.json()[0]
        log.info("obras_equipe_created id=%s por=%s", row["id"], x_user_email)
        return row


@app.patch("/api/obras/equipes/{eid}")
def obras_equipes_patch(eid: str, payload: EquipePatch, x_user_email: str | None = Header(default=None)):
    fields = payload.model_dump(exclude_none=True)
    if not fields:
        raise HTTPException(400, "nada pra atualizar")
    with _sb_client() as sb:
        r = sb.patch("/equipes_parket", params={"id": f"eq.{eid}"}, json=fields,
                     headers={"Prefer": "return=representation"})
        _sb_raise(r, "obras.equipes.patch")
        rows = r.json()
        if not rows:
            raise HTTPException(404, "equipe não encontrada")
        log.info("obras_equipe_patched id=%s campos=%s por=%s", eid, list(fields), x_user_email)
        return rows[0]


@app.delete("/api/obras/equipes/{eid}")
def obras_equipes_delete(eid: str, x_user_email: str | None = Header(default=None)):
    # Soft-delete: desativa. Preserva histórico de checks/relatórios.
    with _sb_client() as sb:
        r = sb.patch("/equipes_parket", params={"id": f"eq.{eid}"},
                     json={"ativo": False}, headers={"Prefer": "return=representation"})
        _sb_raise(r, "obras.equipes.delete")
        rows = r.json()
        if not rows:
            raise HTTPException(404, "equipe não encontrada")
        log.info("obras_equipe_disabled id=%s por=%s", eid, x_user_email)
        return {"ok": True, "nome": rows[0]["nome"]}


# Departamentos cujos cards representam obra (mesma regra do admin do instala).
# O card de compras é FILHO do card de obra e o trigger fn_sync_card_details
# copia details entre pai e filho, então ele herda details.prestadores sozinho.
# Sem esse filtro a mesma obra aparece duas vezes e o instalador enxerga o card
# de compras, que não é obra dele.
DEPTS_OBRA = ["operacional", "obras", "projetos"]


@app.get("/api/operacoes/equipes")
def operacoes_equipes_com_obras(ativo: bool = True):
    """Equipes ativas com obras vinculadas (via kanban_cards.details.prestadores[].id).
    Agrupa obra {card_id, cliente, obra_code, column_id, dept_id, projeto_id, sla_status} por equipe."""
    with _sb_client() as sb:
        params_eq = [
            # categorias[] = frentes extras que o instalador atende (dedup 018).
            ("select", "id,nome,telefone,categoria,categorias,ativo,pct_ok,ultimo_check,obras_distintas,total_ocorrencias,bloqueado_em,bloqueado_por,bloqueio_motivo"),
            ("order", "categoria.asc,nome.asc"),
            ("limit", "500"),
        ]
        if ativo:
            params_eq.append(("ativo", "eq.true"))
        r = sb.get("/equipes_parket", params=params_eq)
        _sb_raise(r, "operacoes.equipes.eq")
        equipes = r.json()

        ra = sb.get("/prestador_avaliacoes", params={
            "select": "equipe_id,nota_qualidade,nota_prazo,nota_postura,nota_retrabalho",
            "limit": "10000",
        })
        _sb_raise(ra, "operacoes.equipes.aval")
        aval_por_eq: dict[str, list[float]] = {}
        for a in ra.json():
            m = (a["nota_qualidade"] + a["nota_prazo"] + a["nota_postura"] + a["nota_retrabalho"]) / 4.0
            aval_por_eq.setdefault(a["equipe_id"], []).append(m)

        rv = sb.get("/prestador_eventos", params={
            "select": "equipe_id,tipo,gravidade", "limit": "10000",
        })
        _sb_raise(rv, "operacoes.equipes.evt")
        mancadas_por_eq: dict[str, int] = {}
        for ev in rv.json():
            if ev.get("tipo") == "mancada":
                mancadas_por_eq[ev["equipe_id"]] = mancadas_por_eq.get(ev["equipe_id"], 0) + 1
        by_id = {e["id"]: {**e, "obras": []} for e in equipes}

        rc = sb.get("/kanban_cards", params={
            "select": "id,title,obra,column_id,dept_id,sla_status,details",
            "details->prestadores": "not.is.null",
            "dept_id": f"in.({','.join(DEPTS_OBRA)})",
            "limit": "3000",
        })
        _sb_raise(rc, "operacoes.equipes.cards")
        cards = rc.json()

    # projeto_id por card_id — batch DB
    card_ids = [c["id"] for c in cards]
    proj_by_card: dict[str, str] = {}
    if card_ids:
        with conn() as c, c.cursor() as cur:
            cur.execute(
                "SELECT card_id::text, id::text FROM gestao.projetos WHERE card_id::text = ANY(%s)",
                (card_ids,),
            )
            proj_by_card = {r["card_id"]: r["id"] for r in cur.fetchall()}

    # Índice por nome (uppercase) → lista de equipe_ids (BEDEU aparece em várias categorias)
    idx_por_nome: dict[str, list[str]] = {}
    for eid, eq in by_id.items():
        nome = (eq.get("nome") or "").strip().upper()
        if nome:
            idx_por_nome.setdefault(nome, []).append(eid)

    for card in cards:
        det = card.get("details") or {}
        obra_row = {
            "card_id": card["id"],
            "cliente": card.get("title"),
            "obra_code": card.get("obra"),
            "column_id": card.get("column_id"),
            "dept_id": card.get("dept_id"),
            "sla_status": card.get("sla_status"),
            "projeto_id": proj_by_card.get(card["id"]),
        }
        for p in (det.get("prestadores") or []):
            if not isinstance(p, dict):
                continue
            pid = p.get("id")
            pnome = (p.get("nome") or "").strip().upper()
            # Match por id (vínculo pelo próprio endpoint /api/projetos/:pid/prestadores)
            if pid and pid in by_id:
                if not any(o["card_id"] == card["id"] for o in by_id[pid]["obras"]):
                    by_id[pid]["obras"].append(obra_row)
                continue
            # Fallback por nome (vínculo veio pelo Space/dashboard antigo com id de prestadores)
            if pnome:
                for eid in idx_por_nome.get(pnome, []):
                    if not any(o["card_id"] == card["id"] for o in by_id[eid]["obras"]):
                        by_id[eid]["obras"].append(obra_row)

    # score/tier/status derivados
    for eid, eq in by_id.items():
        notas = aval_por_eq.get(eid, [])
        n = len(notas)
        score = round(sum(notas) / n, 2) if n else None
        eq["aval_n"] = n
        eq["score"] = score
        eq["mancadas"] = mancadas_por_eq.get(eid, 0)
        if score is None:
            eq["tier"] = None
        elif score >= 4.2 and n >= 2:
            eq["tier"] = "A"
        elif score < 3:
            eq["tier"] = "C"
        else:
            eq["tier"] = "B"
        if eq.get("bloqueado_em"):
            eq["status_banco"] = "bloqueado"
        elif eq["obras"]:
            eq["status_banco"] = "em_obra"
        else:
            eq["status_banco"] = "disponivel"

    # agrupa por categoria
    grupos: dict[str, list] = {}
    for eq in by_id.values():
        cat = eq.get("categoria") or "—"
        grupos.setdefault(cat, []).append(eq)
    return {"grupos": [{"categoria": k, "equipes": v} for k, v in sorted(grupos.items())]}


# ─── OPERAÇÕES · Obras x Prestadores (visão por obra) ─────────────────────
# Esta é a tela que antes vivia no admin do instala.parket.works. O vínculo
# obra<->prestador mora em DOIS lugares e os dois têm que bater:
#   - kanban_cards.details.prestadores[]  → o que o gestão lê e escreve
#   - public.prestador_card               → o que o app do instalador lê
# O endpoint abaixo lê a UNIÃO dos dois, então nada fica invisível de um lado
# só, e marca a origem de cada vínculo pra dar pra ver o que está dessincronizado.
# O filtro por DEPTS_OBRA (definido acima) vale pra todos os endpoints daqui.


class PrestadorVinculo(BaseModel):
    equipe_id: str


def _carregar_equipes_indexadas(sb) -> tuple[list[dict], dict, dict, dict]:
    """Lê equipes_parket ativas e devolve (lista, por_equipe_id, por_prestador_id, por_nome).

    por_nome é uma lista por chave: o mesmo instalador tem linhas repetidas em
    equipes_parket (BEDEU aparece 4x), todas apontando pro mesmo prestador.
    """
    r = sb.get("/equipes_parket", params={
        "select": "id,nome,telefone,categoria,prestador_id,ativo",
        "ativo": "eq.true", "order": "nome.asc", "limit": "500",
    })
    _sb_raise(r, "obras.prestadores.equipes")
    equipes = r.json()
    por_eq = {e["id"]: e for e in equipes}
    por_prest: dict[str, dict] = {}
    por_nome: dict[str, list[dict]] = {}
    for e in equipes:
        if e.get("prestador_id") and e["prestador_id"] not in por_prest:
            por_prest[e["prestador_id"]] = e
        nome = (e.get("nome") or "").strip().upper()
        if nome:
            por_nome.setdefault(nome, []).append(e)
    return equipes, por_eq, por_prest, por_nome


@app.get("/api/operacoes/obras-prestadores")
def operacoes_obras_prestadores(limit: int = 3000):
    """Lista as obras com os prestadores vinculados, unindo gestão + instala.

    Retorna também o catálogo de equipes ativas pra a tela montar o seletor
    sem precisar de uma segunda chamada.
    """
    with _sb_client() as sb:
        equipes, por_eq, por_prest, por_nome = _carregar_equipes_indexadas(sb)

        # Cards de obra dos 3 departamentos + qualquer card que já tenha
        # prestador gravado (vínculo antigo pode estar em outro dept).
        rc = sb.get("/kanban_cards", params={
            "select": "id,title,obra,column_id,dept_id,sla_status,details",
            "dept_id": f"in.({','.join(DEPTS_OBRA)})",
            "limit": str(limit),
        })
        _sb_raise(rc, "obras.prestadores.cards")
        cards = {c["id"]: c for c in rc.json()}

        # Antes entrava aqui qualquer card com details.prestadores. Só que o
        # card de compras é filho do card de obra e o trigger fn_sync_card_details
        # copia details entre pai e filho, então todo card de compras herda a
        # lista e a tela mostrava a mesma obra duas vezes. Fica só o dept de obra.

        # Vínculos do lado do instala
        rp = sb.get("/prestador_card", params={
            "select": "id,prestador_id,card_id,status", "limit": "10000",
        })
        _sb_raise(rp, "obras.prestadores.prestador_card")
        pc_por_card: dict[str, list[dict]] = {}
        for row in rp.json():
            pc_por_card.setdefault(str(row["card_id"]), []).append(row)

        # Nome/telefone dos prestadores que não têm linha em equipes_parket
        rpr = sb.get("/prestadores", params={
            "select": "id,nome,telefone,categoria", "limit": "3000",
        })
        _sb_raise(rpr, "obras.prestadores.base")
        prest_base = {p["id"]: p for p in rpr.json()}

    # projeto_id por card — o vincular/desvincular por projeto precisa dele
    proj_by_card: dict[str, str] = {}
    if cards:
        with conn() as c, c.cursor() as cur:
            cur.execute(
                "SELECT card_id::text, id::text FROM gestao.projetos WHERE card_id::text = ANY(%s)",
                (list(cards.keys()),),
            )
            proj_by_card = {r["card_id"]: r["id"] for r in cur.fetchall()}

    obras = []
    for cid, card in cards.items():
        det = card.get("details") or {}
        # chave do vínculo = prestador_id (base do instala), que é o
        # denominador comum entre as duas tabelas
        vinculos: dict[str, dict] = {}

        def _registrar(eq: dict | None, prestador_id: str | None,
                       nome: str | None, telefone, categoria, origem: str):
            pid = prestador_id or (eq or {}).get("prestador_id")
            # sem prestador_id o vínculo ainda existe no gestão; usa o id da
            # equipe como chave provisória pra não sumir da tela
            chave = pid or (eq or {}).get("id") or (nome or "").strip().upper()
            if not chave:
                return
            atual = vinculos.get(chave)
            if atual:
                if atual["origem"] != origem:
                    atual["origem"] = "ambos"
                return
            vinculos[chave] = {
                "equipe_id": (eq or {}).get("id"),
                "prestador_id": pid,
                "nome": (eq or {}).get("nome") or nome,
                "telefone": (eq or {}).get("telefone") or telefone,
                "categoria": (eq or {}).get("categoria") or categoria,
                "origem": origem,
            }

        # Lado gestão: details.prestadores[].id pode ser id de equipes_parket
        # (vínculo novo) ou de prestadores (vínculo antigo do dashboard).
        for p in (det.get("prestadores") or []):
            if not isinstance(p, dict):
                continue
            raw = p.get("id")
            eq = por_eq.get(raw) or por_prest.get(raw)
            if not eq:
                cands = por_nome.get((p.get("nome") or "").strip().upper(), [])
                eq = cands[0] if cands else None
            _registrar(eq, raw if raw in prest_base else None,
                       p.get("nome"), p.get("telefone"), p.get("categoria"), "gestao")

        # Lado instala
        for row in pc_por_card.get(str(cid), []):
            pid = row["prestador_id"]
            base = prest_base.get(pid) or {}
            _registrar(por_prest.get(pid), pid, base.get("nome"),
                       base.get("telefone"), base.get("categoria"), "instala")

        obras.append({
            "card_id": cid,
            "cliente": card.get("title"),
            "obra_code": card.get("obra"),
            "column_id": card.get("column_id"),
            "dept_id": card.get("dept_id"),
            "sla_status": card.get("sla_status"),
            "projeto_id": proj_by_card.get(cid),
            "prestadores": list(vinculos.values()),
        })

    obras.sort(key=lambda o: (o.get("cliente") or "").upper())
    return {"obras": obras, "equipes": equipes}


def _sync_prestador_card(sb, prestador_id: str, card_id: str) -> None:
    """Garante a linha do vínculo no lado do instala (idempotente)."""
    sb.post("/prestador_card", json={"prestador_id": prestador_id, "card_id": card_id},
            headers={"Prefer": "return=minimal,resolution=ignore-duplicates"})


@app.post("/api/obras/{card_id}/prestadores")
def obra_prestador_vincular(card_id: str, payload: PrestadorVinculo,
                             x_user_email: str | None = Header(default=None)):
    """Vincula prestador à obra pelo card. Escreve nos DOIS lados.

    Existe além do /api/projetos/{pid}/prestadores porque nem toda obra do
    kanban tem linha em gestao.projetos, e a tela Obras x Prestadores lista
    o kanban inteiro.
    """
    with _sb_client() as sb:
        re_ = sb.get("/equipes_parket", params={
            "select": "id,nome,telefone,categoria,prestador_id",
            "id": f"eq.{payload.equipe_id}", "limit": "1",
        })
        _sb_raise(re_, "obra.prestador.equipe")
        rows = re_.json()
        if not rows:
            raise HTTPException(404, "equipe não encontrada")
        eq = rows[0]

        rc = sb.get("/kanban_cards", params={"select": "details", "id": f"eq.{card_id}", "limit": "1"})
        _sb_raise(rc, "obra.prestador.card")
        crows = rc.json()
        if not crows:
            raise HTTPException(404, "obra não encontrada")
        details = crows[0].get("details") or {}
        lista = list(details.get("prestadores") or [])

        pid_ext = _resolve_prestador_id(sb, eq)

        # Idempotência: já vinculado pelo id da equipe OU pelo id do prestador
        ja = any(isinstance(p, dict) and p.get("id") in (eq["id"], pid_ext) for p in lista)
        if not ja:
            lista.append({
                "id": eq["id"], "nome": eq["nome"],
                "telefone": eq.get("telefone"), "categoria": eq.get("categoria"),
            })
            details["prestadores"] = lista
            ru = sb.patch("/kanban_cards", params={"id": f"eq.{card_id}"},
                          json={"details": details}, headers={"Prefer": "return=minimal"})
            _sb_raise(ru, "obra.prestador.update")

        if pid_ext:
            _sync_prestador_card(sb, pid_ext, card_id)
        else:
            log.warning("obra.prestador: sem prestador_id pra %s", eq.get("nome"))

    # Termo da obra: mesmo auto-create do vínculo pela página do Projeto,
    # pra fechar o gap da aba (antes o vínculo daqui não gerava termo e o
    # instalador não tinha o que ativar no Instala). Best-effort: falha no
    # termo não desfaz o vínculo; termo=None = card sem projeto no gestão.
    termo = None
    try:
        termo = _auto_criar_termo_por_card(payload.equipe_id, card_id, x_user_email)
        if termo:
            log.info("termo auto-criado (Obras x Prestadores) id=%s equipe=%s card=%s itens=%s",
                     termo.get("id"), payload.equipe_id, card_id, termo.get("itens"))
    except Exception as e:
        log.warning("termo auto-criado (Obras x Prestadores) falhou (best-effort): %s", e)

    log.info("obra_prestador_vinculado card=%s equipe=%s por=%s", card_id, payload.equipe_id, x_user_email)
    return {"ok": True, "already_linked": ja, "prestador_id": pid_ext,
            "prestadores": lista, "termo": termo}


@app.delete("/api/obras/{card_id}/prestadores/{equipe_id}")
def obra_prestador_desvincular(card_id: str, equipe_id: str,
                                x_user_email: str | None = Header(default=None)):
    """Desvincula nos dois lados. equipe_id aceita id de equipes_parket ou de
    prestadores — details.prestadores antigo guarda o segundo."""
    with _sb_client() as sb:
        re_ = sb.get("/equipes_parket", params={
            "select": "id,nome,telefone,categoria,prestador_id",
            "id": f"eq.{equipe_id}", "limit": "1",
        })
        eq = re_.json()[0] if re_.status_code < 400 and re_.json() else None
        pid_ext = _resolve_prestador_id(sb, eq, create_if_missing=False) if eq else equipe_id

        rc = sb.get("/kanban_cards", params={"select": "details", "id": f"eq.{card_id}", "limit": "1"})
        _sb_raise(rc, "obra.prestador.del.card")
        crows = rc.json()
        if not crows:
            raise HTTPException(404, "obra não encontrada")
        details = crows[0].get("details") or {}
        alvos = {equipe_id, pid_ext, (eq or {}).get("id")} - {None}
        lista = [p for p in (details.get("prestadores") or [])
                 if not (isinstance(p, dict) and p.get("id") in alvos)]
        details["prestadores"] = lista
        ru = sb.patch("/kanban_cards", params={"id": f"eq.{card_id}"},
                      json={"details": details}, headers={"Prefer": "return=minimal"})
        _sb_raise(ru, "obra.prestador.del.update")

        if pid_ext:
            sb.delete("/prestador_card", params={"prestador_id": f"eq.{pid_ext}",
                                                 "card_id": f"eq.{card_id}"})

    log.info("obra_prestador_desvinculado card=%s equipe=%s por=%s", card_id, equipe_id, x_user_email)
    return {"ok": True, "prestadores": lista}


class PrestadorPrincipal(BaseModel):
    principal: bool = True


@app.put("/api/obras/{card_id}/prestadores/{equipe_id}/principal")
def obra_prestador_principal(card_id: str, equipe_id: str, payload: PrestadorPrincipal,
                              x_user_email: str | None = Header(default=None)):
    """Marca QUAL prestador é o principal da obra (exclusivo: marcar um
    desmarca os demais). Vive em details.prestadores[].principal porque a
    lista de vínculo já mora ali; principal=false só desmarca o alvo.
    equipe_id aceita id de equipes_parket ou de prestadores (legado)."""
    with _sb_client() as sb:
        re_ = sb.get("/equipes_parket", params={
            "select": "id,nome,telefone,categoria,prestador_id",
            "id": f"eq.{equipe_id}", "limit": "1",
        })
        eq = re_.json()[0] if re_.status_code < 400 and re_.json() else None
        pid_ext = _resolve_prestador_id(sb, eq, create_if_missing=False) if eq else equipe_id

        rc = sb.get("/kanban_cards", params={"select": "details", "id": f"eq.{card_id}", "limit": "1"})
        _sb_raise(rc, "obra.prestador.principal.card")
        crows = rc.json()
        if not crows:
            raise HTTPException(404, "obra não encontrada")
        details = crows[0].get("details") or {}
        lista = list(details.get("prestadores") or [])
        alvos = {equipe_id, pid_ext, (eq or {}).get("id")} - {None}

        achou = False
        for p in lista:
            if not isinstance(p, dict):
                continue
            if p.get("id") in alvos:
                achou = True
                if payload.principal:
                    p["principal"] = True
                else:
                    p.pop("principal", None)
            elif payload.principal:
                # exclusividade: só um principal por obra
                p.pop("principal", None)
        if not achou:
            raise HTTPException(404, "prestador não vinculado a esta obra")

        details["prestadores"] = lista
        ru = sb.patch("/kanban_cards", params={"id": f"eq.{card_id}"},
                      json={"details": details}, headers={"Prefer": "return=minimal"})
        _sb_raise(ru, "obra.prestador.principal.update")

    log.info("obra_prestador_principal card=%s equipe=%s principal=%s por=%s",
             card_id, equipe_id, payload.principal, x_user_email)
    return {"ok": True, "prestadores": lista}


@app.post("/api/operacoes/prestadores/reconciliar")
def operacoes_prestadores_reconciliar(x_user_email: str | None = Header(default=None)):
    """Deixa gestão e instala com exatamente os mesmos vínculos obra<->prestador.

    Nos dois sentidos:
      gestão -> instala: cria a linha que falta em prestador_card
      instala -> gestão: acrescenta a entrada que falta em details.prestadores
    Idempotente: rodar de novo com tudo em dia devolve zeros.

    Só card de obra entra. O card de compras é filho do card de obra e herda
    details.prestadores pelo trigger fn_sync_card_details, então sem esse corte
    o reconcile criava uma linha de prestador_card pra ele e o instalador via o
    card de compras da obra no instala.parket.works. Linha assim que ainda
    exista é apagada aqui (o vínculo continua no card de obra pai).
    """
    with _sb_client() as sb:
        equipes, por_eq, por_prest, por_nome = _carregar_equipes_indexadas(sb)

        rc = sb.get("/kanban_cards", params={
            "select": "id,details", "details->prestadores": "not.is.null",
            "dept_id": f"in.({','.join(DEPTS_OBRA)})", "limit": "5000",
        })
        _sb_raise(rc, "reconciliar.cards")
        cards_gestao = rc.json()

        rp = sb.get("/prestador_card", params={"select": "prestador_id,card_id", "limit": "10000"})
        _sb_raise(rp, "reconciliar.prestador_card")
        pc_rows = rp.json()

        # Separa o que está pendurado em card que não é obra. O card pode nem
        # ter details.prestadores (é justamente o caso que o sentido
        # instala -> gestão conserta), então a checagem é por dept_id.
        pc_cards = sorted({str(r["card_id"]) for r in pc_rows})
        cards_obra: set[str] = set()
        for i in range(0, len(pc_cards), 100):
            lote = pc_cards[i:i + 100]
            rdep = sb.get("/kanban_cards", params={
                "select": "id", "id": f"in.({','.join(lote)})",
                "dept_id": f"in.({','.join(DEPTS_OBRA)})", "limit": "200",
            })
            _sb_raise(rdep, "reconciliar.dept")
            cards_obra.update(str(x["id"]) for x in rdep.json())

        removidos_instala = 0
        for cid in pc_cards:
            if cid not in cards_obra:
                sb.delete("/prestador_card", params={"card_id": f"eq.{cid}"})
                removidos_instala += sum(1 for r in pc_rows if str(r["card_id"]) == cid)
        pc_rows = [r for r in pc_rows if str(r["card_id"]) in cards_obra]
        pc_set = {(str(r["card_id"]), r["prestador_id"]) for r in pc_rows}

        rpr = sb.get("/prestadores", params={"select": "id,nome,telefone,categoria", "limit": "3000"})
        _sb_raise(rpr, "reconciliar.prestadores")
        prest_base = {p["id"]: p for p in rpr.json()}

        # ── gestão -> instala
        criados_instala = 0
        nao_resolvidos = 0
        vinculos_gestao: set[tuple[str, str]] = set()
        for card in cards_gestao:
            cid = str(card["id"])
            for p in ((card.get("details") or {}).get("prestadores") or []):
                if not isinstance(p, dict):
                    continue
                raw = p.get("id")
                eq = por_eq.get(raw) or por_prest.get(raw)
                if not eq:
                    cands = por_nome.get((p.get("nome") or "").strip().upper(), [])
                    eq = cands[0] if cands else None
                pid_ext = _resolve_prestador_id(sb, eq or p, create_if_missing=True)
                if not pid_ext:
                    nao_resolvidos += 1
                    continue
                vinculos_gestao.add((cid, pid_ext))
                if (cid, pid_ext) not in pc_set:
                    _sync_prestador_card(sb, pid_ext, cid)
                    pc_set.add((cid, pid_ext))
                    criados_instala += 1

        # ── instala -> gestão
        # Só os pares que o gestão não conhece. Agrupa por card pra fazer um
        # PATCH por obra em vez de um por vínculo.
        faltando: dict[str, list[str]] = {}
        for r in pc_rows:
            par = (str(r["card_id"]), r["prestador_id"])
            if par not in vinculos_gestao:
                faltando.setdefault(par[0], []).append(par[1])

        criados_gestao = 0
        for cid, pids in faltando.items():
            rcc = sb.get("/kanban_cards", params={"select": "details", "id": f"eq.{cid}", "limit": "1"})
            if rcc.status_code >= 400 or not rcc.json():
                continue
            details = rcc.json()[0].get("details") or {}
            lista = list(details.get("prestadores") or [])
            mudou = False
            for pid in pids:
                eq = por_prest.get(pid)
                base = prest_base.get(pid) or {}
                nome = (eq or {}).get("nome") or base.get("nome")
                if not nome:
                    continue
                novo_id = (eq or {}).get("id") or pid
                if any(isinstance(x, dict) and x.get("id") in (novo_id, pid) for x in lista):
                    continue
                lista.append({
                    "id": novo_id, "nome": nome,
                    "telefone": (eq or {}).get("telefone") or base.get("telefone"),
                    "categoria": (eq or {}).get("categoria") or base.get("categoria"),
                })
                mudou = True
                criados_gestao += 1
            if mudou:
                details["prestadores"] = lista
                sb.patch("/kanban_cards", params={"id": f"eq.{cid}"},
                         json={"details": details}, headers={"Prefer": "return=minimal"})

    log.info("prestadores_reconciliados instala=+%d gestao=+%d removidos=%d por=%s",
             criados_instala, criados_gestao, removidos_instala, x_user_email)
    return {"ok": True, "criados_instala": criados_instala,
            "criados_gestao": criados_gestao, "nao_resolvidos": nao_resolvidos,
            "removidos_instala": removidos_instala}


# ─── OPERAÇÕES · Banco de prestadores: avaliação + mancadas + bloqueio ────
# Avaliadores: fiscal da obra + gestão de produtividade (Nathalia). Histórico
# acumula — nunca sobrescreve.

class AvaliacaoCreate(BaseModel):
    nota_qualidade: int = Field(ge=1, le=5)
    nota_prazo: int = Field(ge=1, le=5)
    nota_postura: int = Field(ge=1, le=5)
    nota_retrabalho: int = Field(ge=1, le=5)
    papel: str = "gestao"  # fiscal | gestao
    card_id: str | None = None
    obra: str | None = None
    comentario: str | None = None
    avaliador_nome: str | None = None


class EventoCreate(BaseModel):
    tipo: str = "mancada"  # mancada | elogio
    gravidade: str | None = None  # leve | media | grave
    descricao: str
    card_id: str | None = None
    obra: str | None = None


class BloqueioBody(BaseModel):
    motivo: str


@app.get("/api/obras/equipes/{eid}/ficha")
def obras_equipe_ficha(eid: str):
    with _sb_client() as sb:
        ra = sb.get("/prestador_avaliacoes", params={
            "select": "*", "equipe_id": f"eq.{eid}",
            "order": "created_at.desc", "limit": "200",
        })
        _sb_raise(ra, "equipe.ficha.aval")
        rv = sb.get("/prestador_eventos", params={
            "select": "*", "equipe_id": f"eq.{eid}",
            "order": "created_at.desc", "limit": "200",
        })
        _sb_raise(rv, "equipe.ficha.evt")
        return {"avaliacoes": ra.json(), "eventos": rv.json()}


@app.post("/api/obras/equipes/{eid}/avaliacoes")
def obras_equipe_avaliar(eid: str, payload: AvaliacaoCreate,
                         x_user_email: str | None = Header(default=None)):
    if payload.papel not in ("fiscal", "gestao"):
        raise HTTPException(400, "papel deve ser fiscal ou gestao")
    body = payload.model_dump(exclude_none=True)
    body["equipe_id"] = eid
    body["avaliador_email"] = x_user_email or "anon@parket.works"
    with _sb_client() as sb:
        r = sb.post("/prestador_avaliacoes", json=body,
                    headers={"Prefer": "return=representation"})
        _sb_raise(r, "equipe.avaliar")
        log.info("prestador_avaliado equipe=%s por=%s", eid, x_user_email)
        return r.json()[0]


@app.post("/api/obras/equipes/{eid}/eventos")
def obras_equipe_evento(eid: str, payload: EventoCreate,
                        x_user_email: str | None = Header(default=None)):
    if payload.tipo not in ("mancada", "elogio"):
        raise HTTPException(400, "tipo deve ser mancada ou elogio")
    if payload.tipo == "mancada" and payload.gravidade not in ("leve", "media", "grave"):
        raise HTTPException(400, "mancada exige gravidade leve/media/grave")
    body = payload.model_dump(exclude_none=True)
    body["equipe_id"] = eid
    body["registrado_por"] = x_user_email
    with _sb_client() as sb:
        r = sb.post("/prestador_eventos", json=body,
                    headers={"Prefer": "return=representation"})
        _sb_raise(r, "equipe.evento")
        log.info("prestador_evento equipe=%s tipo=%s por=%s", eid, payload.tipo, x_user_email)
        return r.json()[0]


@app.post("/api/obras/equipes/{eid}/bloquear")
def obras_equipe_bloquear(eid: str, payload: BloqueioBody,
                          x_user_email: str | None = Header(default=None)):
    if not payload.motivo.strip():
        raise HTTPException(400, "motivo obrigatório")
    with _sb_client() as sb:
        r = sb.patch("/equipes_parket", params={"id": f"eq.{eid}"},
                     json={"bloqueado_em": datetime.now(timezone.utc).isoformat(),
                           "bloqueado_por": x_user_email,
                           "bloqueio_motivo": payload.motivo.strip()},
                     headers={"Prefer": "return=representation"})
        _sb_raise(r, "equipe.bloquear")
        rows = r.json()
        if not rows:
            raise HTTPException(404, "equipe não encontrada")
        log.info("prestador_bloqueado equipe=%s por=%s", eid, x_user_email)
        return rows[0]


@app.post("/api/obras/equipes/{eid}/reativar")
def obras_equipe_reativar(eid: str, x_user_email: str | None = Header(default=None)):
    with _sb_client() as sb:
        r = sb.patch("/equipes_parket", params={"id": f"eq.{eid}"},
                     json={"bloqueado_em": None, "bloqueado_por": None, "bloqueio_motivo": None},
                     headers={"Prefer": "return=representation"})
        _sb_raise(r, "equipe.reativar")
        rows = r.json()
        if not rows:
            raise HTTPException(404, "equipe não encontrada")
        log.info("prestador_reativado equipe=%s por=%s", eid, x_user_email)
        return rows[0]


# ─── OPERAÇÕES · Termo do prestador (aceite + PDF) ────────────────────────

class TermoCreate(BaseModel):
    equipe_id: str
    card_id: str
    itens_ids: list[str]

class TermoAceitar(BaseModel):
    assinatura_b64: str          # PNG base64 do canvas
    foto_b64: str | None = None  # JPEG base64 do rosto do prestador
    dados_prestador: dict | None = None  # override opcional (nome/cnpj/endereco)


def _snapshot_itens(cur, itens_ids: list[str], projeto_id: str | None) -> list[dict]:
    if not itens_ids:
        return []
    cur.execute("""
      SELECT id::text, ambiente, quantidade, unidade, descritivo,
             meta->>'codigo' as codigo,
             meta->>'produto_header' as produto_header,
             meta->>'categoria_raiz' as categoria_raiz,
             categoria
        FROM gestao.itens
       WHERE id::text = ANY(%s)
       ORDER BY ordem
    """, (itens_ids,))
    out = []
    for r in cur.fetchall():
        out.append({
            "id": r["id"],
            "codigo": r.get("codigo") or "",
            "ambiente": r.get("ambiente") or "",
            "quantidade": float(r["quantidade"]) if r.get("quantidade") is not None else None,
            "unidade": r.get("unidade") or "m²",
            "descritivo": r.get("descritivo") or "",
            "categoria_raiz": r.get("categoria_raiz") or r.get("categoria") or "",
            "produto_header": r.get("produto_header") or "",
        })
    return out


def _snapshot_equipe(cur, equipe_id: str) -> dict:
    with _sb_client() as sb:
        r = sb.get("/equipes_parket", params={
            "select": "id,nome,telefone,categoria,cnpj_cpf,endereco,email,foto_url",
            "id": f"eq.{equipe_id}",
            "limit": "1",
        })
        _sb_raise(r, "termo.snap_equipe")
        rows = r.json()
        if not rows:
            raise HTTPException(404, "equipe não encontrada")
        return rows[0]


def _projeto_por_card(cur, card_id: str) -> tuple[str | None, str | None, str | None]:
    cur.execute("""
      SELECT p.id::text as projeto_id, p.cliente, p.endereco
        FROM gestao.projetos p
       WHERE p.card_id::text = %s
       LIMIT 1
    """, (card_id,))
    row = cur.fetchone()
    if not row:
        return None, None, None
    return row["projeto_id"], row.get("cliente"), row.get("endereco")


def _upsert_termo_cloud(equipe_id: str, card_id: str, projeto_id: str | None,
                          itens_ids: list[str], snapshot: list[dict], equipe: dict,
                          criado_por: str | None) -> dict:
    """Insere/atualiza prestador_termos no Cloud Supabase (o Instala lê de lá)."""
    with _sb_client() as sb:
        r = sb.get("/prestador_termos", params={
            "select": "id,status",
            "equipe_id": f"eq.{equipe_id}",
            "card_id": f"eq.{card_id}",
            "status": "in.(pendente,aceito)",
            "limit": "1",
        })
        _sb_raise(r, "termos.upsert.check")
        rows = r.json()
        if rows:
            tid = rows[0]["id"]
            r2 = sb.patch("/prestador_termos", params={"id": f"eq.{tid}"},
                          json={"itens_ids": itens_ids, "itens_snapshot": snapshot},
                          headers={"Prefer": "return=representation"})
            _sb_raise(r2, "termos.upsert.patch")
            return r2.json()[0]
        r3 = sb.post("/prestador_termos", json={
            "equipe_id": equipe_id, "card_id": card_id, "projeto_id": projeto_id,
            "itens_ids": itens_ids, "itens_snapshot": snapshot,
            "dados_prestador": equipe, "criado_por": criado_por,
        }, headers={"Prefer": "return=representation"})
        _sb_raise(r3, "termos.upsert.insert")
        return r3.json()[0]


def _auto_criar_termo_por_card(equipe_id: str, card_id: str,
                                 criado_por: str | None) -> dict | None:
    """Cria/atualiza o termo pendente da obra com TODOS os itens do projeto
    gestão do card. É o passo 6 do vínculo pela página do Projeto, extraído
    pra também rodar no vínculo da aba Obras x Prestadores: prestador
    vinculado por QUALQUER caminho ganha o termo (anexo do contrato geral)
    na hora. Devolve None quando o card não tem projeto no gestão (sem
    itens não há o que assinar); o escopo segue refinável via PUT escopo."""
    with conn() as c, c.cursor() as cur:
        projeto_id, _cli, _end = _projeto_por_card(cur, card_id)
        if not projeto_id:
            return None
        cur.execute("SELECT id::text FROM gestao.itens WHERE projeto_id::text = %s ORDER BY ordem",
                    (projeto_id,))
        itens_ids = [r["id"] for r in cur.fetchall()]
        snapshot = _snapshot_itens(cur, itens_ids, projeto_id) if itens_ids else []
        equipe_snap = _snapshot_equipe(cur, equipe_id)
    tr = _upsert_termo_cloud(equipe_id, card_id, projeto_id,
                             itens_ids, snapshot, equipe_snap, criado_por)
    return {"id": tr.get("id"), "status": tr.get("status"),
            "projeto_id": projeto_id, "itens": len(itens_ids)}


@app.post("/api/operacoes/termos")
def termos_create(payload: TermoCreate, x_user_email: str | None = Header(default=None)):
    """Gestor vincula prestador × obra + escolhe itens. Cria termo PENDENTE no Cloud."""
    with conn() as c, c.cursor() as cur:
        projeto_id, _cli, _end = _projeto_por_card(cur, payload.card_id)
        snapshot = _snapshot_itens(cur, payload.itens_ids, projeto_id)
        if not snapshot and payload.itens_ids:
            raise HTTPException(400, "nenhum item encontrado pelos ids passados")
        equipe = _snapshot_equipe(cur, payload.equipe_id)
    row = _upsert_termo_cloud(payload.equipe_id, payload.card_id, projeto_id,
                                payload.itens_ids, snapshot, equipe, x_user_email)

    # Também espelha o vínculo no kanban_cards.details.prestadores[]
    try:
        with _sb_client() as sb:
            rc = sb.get("/kanban_cards", params={
                "select": "id,details",
                "id": f"eq.{payload.card_id}",
                "limit": "1",
            })
            if rc.status_code < 400 and rc.json():
                card = rc.json()[0]
                det = card.get("details") or {}
                prests = list(det.get("prestadores") or [])
                if not any(isinstance(p, dict) and p.get("id") == payload.equipe_id for p in prests):
                    prests.append({"id": payload.equipe_id, "nome": equipe.get("nome")})
                    det["prestadores"] = prests
                    sb.patch("/kanban_cards", params={"id": f"eq.{payload.card_id}"},
                             json={"details": det})
    except Exception as e:
        log.warning("termo.vincular_card falhou (best-effort): %s", e)

    log.info("termo_criado id=%s equipe=%s card=%s por=%s",
             row["id"], payload.equipe_id, payload.card_id, x_user_email)
    return {"id": row["id"], "status": row["status"], "criado_em": row["criado_em"]}


@app.get("/api/operacoes/termos")
def termos_list(equipe_id: str | None = None, card_id: str | None = None, status: str | None = None):
    params = [
        ("select", "id,equipe_id,card_id,projeto_id,status,criado_em,aceito_em,pdf_url,dados_prestador,itens_snapshot,contrato_aceite_id"),
        ("order", "criado_em.desc"),
        ("limit", "500"),
    ]
    if equipe_id: params.append(("equipe_id", f"eq.{equipe_id}"))
    if card_id:   params.append(("card_id", f"eq.{card_id}"))
    if status:    params.append(("status", f"eq.{status}"))
    with _sb_client() as sb:
        r = sb.get("/prestador_termos", params=params)
        _sb_raise(r, "termos.list")
        raw = r.json()
    rows = []
    for r_ in raw:
        rows.append({
            "id": r_["id"], "equipe_id": r_["equipe_id"], "card_id": r_["card_id"],
            "projeto_id": r_.get("projeto_id"), "status": r_["status"],
            "criado_em": r_["criado_em"], "aceito_em": r_.get("aceito_em"),
            "pdf_url": r_.get("pdf_url"),
            "prestador_nome": (r_.get("dados_prestador") or {}).get("nome"),
            "n_itens": len(r_.get("itens_snapshot") or []),
            # aceito COM contrato_aceite_id = anexo ativado por OTP (fluxo F4);
            # aceito SEM = termo legado re-assinado no fluxo antigo
            "contrato_aceite_id": r_.get("contrato_aceite_id"),
        })
    # Enriquece com título e código da obra (kanban_cards)
    card_ids = list({r["card_id"] for r in rows if r.get("card_id")})
    obra_map: dict[str, dict] = {}
    if card_ids:
        with _sb_client() as sb:
            rc = sb.get("/kanban_cards", params={
                "select": "id,title,obra",
                "id": f"in.({','.join(card_ids)})",
            })
            if rc.status_code < 400:
                for c in rc.json():
                    obra_map[c["id"]] = {"cliente": c.get("title"), "obra_code": c.get("obra")}
    for r in rows:
        info = obra_map.get(r["card_id"]) or {}
        r["cliente"] = info.get("cliente")
        r["obra_code"] = info.get("obra_code")
    return rows


@app.get("/api/operacoes/termos/{tid}")
def termos_get(tid: str):
    with _sb_client() as sb:
        r = sb.get("/prestador_termos", params={
            "select": "*", "id": f"eq.{tid}", "limit": "1",
        })
        _sb_raise(r, "termos.get")
        rows = r.json()
        if not rows:
            raise HTTPException(404, "termo não encontrado")
        return rows[0]


@app.get("/api/instala/termos/{tid}/preview")
def termos_preview(tid: str):
    """PDF preview do termo (sem assinatura/foto) pro prestador ler antes de aceitar.
    Modelo Parket: 14 cláusulas + EPIs + ferramentas (commit 01b516e). Só medidas, sem valores."""
    from fastapi import Response
    from .termo_pdf import gerar_pdf_termo, snapshot_para_secoes
    with _sb_client() as sb:
        r = sb.get("/prestador_termos", params={"select":"*", "id": f"eq.{tid}", "limit":"1"})
        _sb_raise(r, "preview.get")
        rows = r.json()
    if not rows:
        raise HTTPException(404, "termo não encontrado")
    termo = rows[0]
    dados = dict(termo.get("dados_prestador") or {})
    cliente, endereco_obra = None, None
    if termo.get("projeto_id"):
        with conn() as c, c.cursor() as cur:
            cur.execute("SELECT cliente, endereco FROM gestao.projetos WHERE id::text = %s",
                        (str(termo["projeto_id"]),))
            rp = cur.fetchone()
            if rp:
                cliente = rp.get("cliente"); endereco_obra = rp.get("endereco")
    secoes = snapshot_para_secoes(list(termo.get("itens_snapshot") or []))
    pdf_bytes = gerar_pdf_termo(
        dados_prestador=dados,
        cliente_obra=cliente, obra_endereco=endereco_obra,
        secoes=secoes,
        assinatura_b64=None, foto_b64=None,
    )
    return Response(content=pdf_bytes, media_type="application/pdf", headers={
        "Content-Disposition": f'inline; filename="termo-{tid}-preview.pdf"',
        "Cache-Control": "no-store",
    })


@app.post("/api/instala/termos/{tid}/aceitar")
def termos_aceitar(tid: str, payload: TermoAceitar):
    """Prestador confirma no Instala. Gera PDF e persiste URLs no Cloud."""
    from .termo_pdf import gerar_pdf_termo, snapshot_para_secoes
    with _sb_client() as sb:
        r = sb.get("/prestador_termos", params={"select":"*", "id": f"eq.{tid}", "limit":"1"})
        _sb_raise(r, "aceitar.get")
        rows = r.json()
    if True:
        termo = rows[0] if rows else None
        if not termo:
            raise HTTPException(404, "termo não encontrado")
        if termo["status"] == "aceito":
            raise HTTPException(409, "termo já aceito")

        dados = dict(termo.get("dados_prestador") or {})
        if payload.dados_prestador:
            dados.update({k: v for k, v in payload.dados_prestador.items() if v})

        # projeto info (cliente + endereço da obra) do local pg
        cliente, endereco_obra = None, None
        if termo.get("projeto_id"):
            with conn() as c2, c2.cursor() as cur2:
                cur2.execute("SELECT cliente, endereco FROM gestao.projetos WHERE id::text = %s",
                             (str(termo["projeto_id"]),))
                rp = cur2.fetchone()
                if rp:
                    cliente = rp.get("cliente"); endereco_obra = rp.get("endereco")

        secoes = snapshot_para_secoes(list(termo.get("itens_snapshot") or []))
        pdf_bytes = gerar_pdf_termo(
            dados_prestador=dados,
            cliente_obra=cliente, obra_endereco=endereco_obra,
            secoes=secoes,
            assinatura_b64=payload.assinatura_b64,
            foto_b64=payload.foto_b64,
        )

        # Upload no bucket termos-prestador (cria se não existir)
        pdf_url = _upload_supabase_bucket(
            bucket="termos-prestador",
            path=f"{tid}.pdf",
            content=pdf_bytes,
            content_type="application/pdf",
        )
        assin_url = _upload_supabase_bucket(
            bucket="termos-prestador",
            path=f"{tid}-assinatura.png",
            content=base64.b64decode((payload.assinatura_b64.split(',',1)[1]
                                       if payload.assinatura_b64.startswith('data:')
                                       else payload.assinatura_b64)),
            content_type="image/png",
        ) if payload.assinatura_b64 else None
        foto_url = None
        if payload.foto_b64:
            foto_url = _upload_supabase_bucket(
                bucket="termos-prestador",
                path=f"{tid}-foto.jpg",
                content=base64.b64decode(payload.foto_b64.split(',',1)[1]
                                          if payload.foto_b64.startswith('data:')
                                          else payload.foto_b64),
                content_type="image/jpeg",
            )

        from datetime import datetime as _dt2, timezone as _tz2
        with _sb_client() as sb2:
            up = sb2.patch("/prestador_termos", params={"id": f"eq.{tid}"},
                           json={"status": "aceito",
                                  "aceito_em": _dt2.now(_tz2.utc).isoformat(),
                                  "dados_prestador": dados,
                                  "assinatura_url": assin_url,
                                  "foto_url": foto_url,
                                  "pdf_url": pdf_url},
                           headers={"Prefer": "return=representation"})
            _sb_raise(up, "aceitar.patch")
            return up.json()[0]


def _upload_supabase_bucket(bucket: str, path: str, content: bytes, content_type: str) -> str:
    """Faz PUT no Storage. Cria bucket público se não existir. Retorna URL pública."""
    import httpx as _httpx
    url = f"{SUPABASE_URL}/storage/v1/object/{bucket}/{path}"
    hdrs = {
        "Authorization": f"Bearer {SUPABASE_KEY}",
        "Content-Type": content_type,
        "x-upsert": "true",
    }
    with _httpx.Client(timeout=30.0) as cli:
        r = cli.put(url, content=content, headers=hdrs)
        # Bucket inexistente: o Storage responde HTTP 400 com "Bucket not found"
        # no corpo (o 404 fica so no statusCode do JSON), entao checa os dois.
        if r.status_code == 404 or (r.status_code == 400 and "Bucket not found" in r.text):
            # Cria bucket público
            cli.post(f"{SUPABASE_URL}/storage/v1/bucket",
                     json={"id": bucket, "name": bucket, "public": True},
                     headers={"Authorization": f"Bearer {SUPABASE_KEY}"})
            r = cli.put(url, content=content, headers=hdrs)
        if r.status_code >= 400:
            raise HTTPException(500, f"upload {bucket}/{path} falhou: {r.text[:200]}")
    return f"{SUPABASE_URL}/storage/v1/object/public/{bucket}/{path}"


# ─── INSTALA · OTP WhatsApp (contrato geral do prestador, #1985) ─────
# Código de 6 dígitos enviado por WhatsApp (Evolution) pra:
#   onboarding    = aceite do contrato geral no 1o login do Instala
#   ativacao_obra = adesão da obra como anexo no botão Iniciar
# Regra Auth Guard: o código NUNCA aparece em log, chat ou
# whatsapp_messages. Só o hash sha256(otp_id:codigo) é persistido
# (prestador_otp, migração 022) e o código em claro só trafega no
# WhatsApp do prestador.

OTP_TTL_MIN          = 10   # validade do código
OTP_MAX_TENTATIVAS   = 5    # erros de digitação antes de exigir reenvio
OTP_MAX_ENVIOS_15MIN = 3    # anti-abuso: envios por prestador na janela


def _otp_hash(otp_id: str, codigo: str) -> str:
    """sha256(otp_id:codigo) — salgar com o id impede rainbow de 6 dígitos."""
    import hashlib
    return hashlib.sha256(f"{otp_id}:{codigo}".encode()).hexdigest()


def _otp_digits_ddi(telefone: str) -> str:
    """Normaliza pra digits com DDI 55 (padrão Evolution: numero@s.whatsapp.net)."""
    d = "".join(ch for ch in (telefone or "") if ch.isdigit())
    if len(d) in (10, 11):          # DDD+numero sem DDI
        d = "55" + d
    return d


class InstalaOtpEnviar(BaseModel):
    prestador_id: str
    finalidade: str                  # onboarding | ativacao_obra
    card_id: str | None = None       # obra em ativacao_obra (vai no contexto)
    telefone: str | None = None      # se vier, ATUALIZA o WhatsApp do cadastro antes de enviar


@app.post("/api/instala/otp/enviar")
def instala_otp_enviar(payload: InstalaOtpEnviar):
    """Gera código 6 dígitos, grava SÓ o hash e envia por WhatsApp."""
    import secrets as _secrets
    import uuid as _uuid
    from datetime import datetime as _dt, timedelta as _td, timezone as _tz

    if payload.finalidade not in ("onboarding", "ativacao_obra"):
        raise HTTPException(400, "finalidade inválida")

    # telefone do prestador (Cloud Valor)
    with _sb_client() as sb:
        r = sb.get("/prestadores", params={
            "select": "id,nome,telefone,ativo",
            "id": f"eq.{payload.prestador_id}", "limit": "1"})
        _sb_raise(r, "otp.prestador")
        rows = r.json()
    if not rows:
        raise HTTPException(404, "prestador não encontrado")
    prest = rows[0]

    # Numero informado na tela SOBRESCREVE o cadastro (Will 01/09: o wizard tem
    # campo de WhatsApp e o que o prestador digita atualiza o gestao tambem).
    # prestadores.telefone e a mesma fonte lida pelo /equipes do gestao.
    if payload.telefone is not None:
        digits = _otp_digits_ddi(payload.telefone)
        if len(digits) < 12:
            raise HTTPException(422, "número de WhatsApp inválido; informe DDD + número")
        # persiste formatado +55 (DD) XXXXX-XXXX pra ficar legível no gestao
        fmt = f"+{digits[:2]} ({digits[2:4]}) {digits[4:-4]}-{digits[-4:]}"
        with _sb_client() as sb:
            r = sb.patch("/prestadores", params={"id": f"eq.{payload.prestador_id}"},
                         json={"telefone": fmt})
            _sb_raise(r, "otp.telefone_update")
    else:
        digits = _otp_digits_ddi(prest.get("telefone") or "")
        if len(digits) < 12:
            raise HTTPException(422, "prestador sem telefone WhatsApp válido cadastrado")

    now = _dt.now(_tz.utc)

    # rate limit: máx 3 envios por prestador na janela de 15 min
    with _sb_client() as sb:
        r = sb.get("/prestador_otp", params={
            "select": "id",
            "prestador_id": f"eq.{payload.prestador_id}",
            "criado_em": f"gte.{(now - _td(minutes=15)).isoformat()}"})
        _sb_raise(r, "otp.ratelimit")
        if len(r.json()) >= OTP_MAX_ENVIOS_15MIN:
            raise HTTPException(429, "muitos envios; aguarde alguns minutos e tente de novo")

    # id gerado aqui (não pelo banco) porque ele entra no salt do hash
    otp_id = str(_uuid.uuid4())
    codigo = f"{_secrets.randbelow(1000000):06d}"
    expira_em = (now + _td(minutes=OTP_TTL_MIN)).isoformat()

    with _sb_client() as sb:
        r = sb.post("/prestador_otp", json={
            "id": otp_id,
            "prestador_id": payload.prestador_id,
            "telefone": digits,
            "codigo_hash": _otp_hash(otp_id, codigo),
            "finalidade": payload.finalidade,
            "contexto": {"card_id": payload.card_id} if payload.card_id else {},
            "expira_em": expira_em,
        })
        _sb_raise(r, "otp.insert")

    # envio via Evolution (mesmo padrão do chat CS, mas SEM whatsapp_messages)
    texto = (f"Parket: seu codigo de confirmacao e {codigo}. "
             f"Valido por {OTP_TTL_MIN} minutos. Nao compartilhe com ninguem.")
    from urllib.parse import quote
    try:
        with httpx.Client(timeout=20.0) as ev:
            r = ev.post(f"{EVOLUTION_URL}/message/sendText/{quote(CS_INSTANCE_DEFAULT, safe='')}",
                        headers={"apikey": EVOLUTION_APIKEY, "Content-Type": "application/json"},
                        json={"number": f"{digits}@s.whatsapp.net", "text": texto})
            if r.status_code >= 400:
                raise RuntimeError(f"evolution status={r.status_code}")
    except Exception:
        # envio falhou: apaga a row pra não consumir a janela de rate limit
        with _sb_client() as sb:
            sb.delete("/prestador_otp", params={"id": f"eq.{otp_id}"})
        log.warning("otp_send_fail prestador=%s finalidade=%s", payload.prestador_id, payload.finalidade)
        raise HTTPException(502, "falha ao enviar o código pelo WhatsApp; tente de novo")

    # log SEM o código (Auth Guard)
    log.info("otp_enviado prestador=%s finalidade=%s otp=%s", payload.prestador_id, payload.finalidade, otp_id)
    return {"ok": True, "otp_id": otp_id, "expira_em": expira_em,
            "telefone_mascarado": f"(**) *****-{digits[-4:]}"}


class InstalaOtpValidar(BaseModel):
    prestador_id: str
    codigo: str
    finalidade: str
    otp_id: str | None = None        # opcional: valida um envio específico


@app.post("/api/instala/otp/validar")
def instala_otp_validar(payload: InstalaOtpValidar):
    """Confere o código contra o hash do envio mais recente ainda válido."""
    from datetime import datetime as _dt, timezone as _tz
    now = _dt.now(_tz.utc)

    params = {
        "select": "id,codigo_hash,expira_em,tentativas,usado_em,contexto",
        "prestador_id": f"eq.{payload.prestador_id}",
        "finalidade": f"eq.{payload.finalidade}",
        "usado_em": "is.null",
        "order": "criado_em.desc", "limit": "1",
    }
    if payload.otp_id:
        params["id"] = f"eq.{payload.otp_id}"
    with _sb_client() as sb:
        r = sb.get("/prestador_otp", params=params)
        _sb_raise(r, "otp.get")
        rows = r.json()
    if not rows:
        raise HTTPException(404, "nenhum código pendente; peça um novo envio")
    otp = rows[0]

    if _dt.fromisoformat(otp["expira_em"].replace("Z", "+00:00")) < now:
        raise HTTPException(410, "código expirado; peça um novo envio")
    if int(otp.get("tentativas") or 0) >= OTP_MAX_TENTATIVAS:
        raise HTTPException(429, "muitas tentativas; peça um novo envio")

    codigo = "".join(ch for ch in (payload.codigo or "") if ch.isdigit())
    if _otp_hash(otp["id"], codigo) != otp["codigo_hash"]:
        # errou: conta a tentativa e devolve 401
        with _sb_client() as sb:
            sb.patch("/prestador_otp", params={"id": f"eq.{otp['id']}"},
                     json={"tentativas": int(otp.get("tentativas") or 0) + 1})
        raise HTTPException(401, "código incorreto")

    with _sb_client() as sb:
        r = sb.patch("/prestador_otp", params={"id": f"eq.{otp['id']}"},
                     json={"usado_em": now.isoformat()})
        _sb_raise(r, "otp.usar")
    log.info("otp_validado prestador=%s finalidade=%s otp=%s", payload.prestador_id, payload.finalidade, otp["id"])
    return {"ok": True, "otp_id": otp["id"], "contexto": otp.get("contexto") or {}}


# ─── INSTALA · Contrato geral do prestador (F2, #1986) ───────────────
# Catalogo versionado = prestador_contratos (conteudo_md); aceite unico
# por prestador por versao = prestador_contrato_aceites (migracao 022).


def _contrato_vigente_row() -> dict:
    """Versao vigente do catalogo de termos gerais (prestador_contratos)."""
    with _sb_client() as sb:
        r = sb.get("/prestador_contratos", params={
            "select": "id,versao,titulo,conteudo_md",
            "vigente": "eq.true", "order": "versao.desc", "limit": "1"})
        _sb_raise(r, "contrato.vigente")
        rows = r.json()
    if not rows:
        raise HTTPException(500, "nenhuma versão vigente dos termos no catálogo")
    return rows[0]


@app.get("/api/instala/contrato/vigente")
def instala_contrato_vigente(prestador_id: str = Query(...)):
    """Gate do login do Instala: termos vigentes + status do aceite do
    prestador. precisa_aceite=true dispara o wizard de onboarding (F3)."""
    cat = _contrato_vigente_row()
    with _sb_client() as sb:
        r = sb.get("/prestador_contrato_aceites", params={
            "select": "id,status,versao_termos,aceito_em,pdf_url",
            "prestador_id": f"eq.{prestador_id}",
            "versao_termos": f"eq.{cat['versao']}", "limit": "1"})
        _sb_raise(r, "contrato.aceite")
        aceites = r.json()
    aceite = aceites[0] if aceites else None
    return {
        "versao": cat["versao"], "titulo": cat["titulo"], "conteudo_md": cat["conteudo_md"],
        "aceite": aceite,
        "precisa_aceite": not (aceite and aceite.get("status") == "aceito"),
    }


class ContratoAceitar(BaseModel):
    prestador_id: str
    # otp de finalidade onboarding JA VALIDADO via /api/instala/otp/validar
    otp_id: str
    # snapshot das partes preenchido no wizard (nome, cnpj_cpf, endereco)
    dados_prestador: dict = {}
    selfie_b64: str | None = None
    assinatura_b64: str | None = None


@app.post("/api/instala/contrato/aceitar")
def instala_contrato_aceitar(payload: ContratoAceitar,
                             user_agent: str | None = Header(default=None),
                             x_forwarded_for: str | None = Header(default=None)):
    """Fecha o aceite do contrato geral: exige OTP onboarding validado,
    grava selfie com hash SHA-256 + assinatura + trilha IP/UA e gera o PDF
    consolidado a partir do catalogo versionado."""
    import hashlib
    import uuid as _uuid
    from datetime import datetime as _dt, timedelta as _td, timezone as _tz
    from .contrato_geral_pdf import gerar_pdf_contrato_geral

    now = _dt.now(_tz.utc)

    # 1) OTP de onboarding validado ha pouco (prova do WhatsApp)
    with _sb_client() as sb:
        r = sb.get("/prestador_otp", params={
            "select": "id,telefone,finalidade,usado_em",
            "id": f"eq.{payload.otp_id}",
            "prestador_id": f"eq.{payload.prestador_id}", "limit": "1"})
        _sb_raise(r, "aceite.otp")
        otps = r.json()
    otp = otps[0] if otps else None
    if not otp or otp["finalidade"] != "onboarding" or not otp.get("usado_em"):
        raise HTTPException(401, "confirme o código do WhatsApp antes de assinar")
    usado_em = _dt.fromisoformat(otp["usado_em"].replace("Z", "+00:00"))
    if now - usado_em > _td(minutes=30):
        raise HTTPException(410, "validação do WhatsApp expirou; confirme o código de novo")

    cat = _contrato_vigente_row()

    # 2) 1 aceite por versao: linha existente aceita = 409; pendente/revogada = reaproveita
    with _sb_client() as sb:
        r = sb.get("/prestador_contrato_aceites", params={
            "select": "id,status",
            "prestador_id": f"eq.{payload.prestador_id}",
            "versao_termos": f"eq.{cat['versao']}", "limit": "1"})
        _sb_raise(r, "aceite.get")
        existentes = r.json()
    if existentes and existentes[0]["status"] == "aceito":
        raise HTTPException(409, "contrato desta versão já aceito")
    aceite_id = existentes[0]["id"] if existentes else str(_uuid.uuid4())

    # 3) selfie: hash SHA-256 dos bytes (validacao facial nivel A) + upload
    selfie_url = selfie_hash = assinatura_url = None
    if payload.selfie_b64:
        raw = base64.b64decode(payload.selfie_b64.split(",", 1)[1]
                               if payload.selfie_b64.startswith("data:")
                               else payload.selfie_b64)
        selfie_hash = hashlib.sha256(raw).hexdigest()
        selfie_url = _upload_supabase_bucket(
            bucket="contratos-prestador", path=f"{aceite_id}-selfie.jpg",
            content=raw, content_type="image/jpeg")
    if payload.assinatura_b64:
        raw = base64.b64decode(payload.assinatura_b64.split(",", 1)[1]
                               if payload.assinatura_b64.startswith("data:")
                               else payload.assinatura_b64)
        assinatura_url = _upload_supabase_bucket(
            bucket="contratos-prestador", path=f"{aceite_id}-assinatura.png",
            content=raw, content_type="image/png")

    aceite_ip = (x_forwarded_for or "").split(",")[0].strip() or None
    aceito_em = now.isoformat()

    # 4) PDF consolidado (contrato + registro de assinatura eletronica)
    pdf_bytes = gerar_pdf_contrato_geral(
        conteudo_md=cat["conteudo_md"], versao=cat["versao"],
        dados_prestador=payload.dados_prestador or {},
        assinatura_b64=payload.assinatura_b64, selfie_b64=payload.selfie_b64,
        trilha={"aceite_id": aceite_id, "telefone_validado": otp["telefone"],
                "whatsapp_validado_em": otp["usado_em"], "otp_id": otp["id"],
                "selfie_hash": selfie_hash, "aceite_ip": aceite_ip,
                "aceite_user_agent": user_agent, "aceito_em": aceito_em})
    pdf_url = _upload_supabase_bucket(
        bucket="contratos-prestador", path=f"{aceite_id}.pdf",
        content=pdf_bytes, content_type="application/pdf")

    # 5) persiste o aceite (insert novo ou patch da linha pendente/revogada)
    row = {"prestador_id": payload.prestador_id, "versao_termos": cat["versao"],
           "status": "aceito", "telefone_validado": otp["telefone"],
           "whatsapp_validado_em": otp["usado_em"],
           "dados_prestador": payload.dados_prestador or {},
           "selfie_url": selfie_url, "selfie_hash": selfie_hash,
           "assinatura_url": assinatura_url, "pdf_url": pdf_url,
           "aceito_em": aceito_em, "aceite_ip": aceite_ip,
           "aceite_user_agent": user_agent, "updated_at": aceito_em}
    with _sb_client() as sb:
        if existentes:
            r = sb.patch("/prestador_contrato_aceites",
                         params={"id": f"eq.{aceite_id}"}, json=row,
                         headers={"Prefer": "return=representation"})
        else:
            r = sb.post("/prestador_contrato_aceites", json={"id": aceite_id, **row},
                        headers={"Prefer": "return=representation"})
        _sb_raise(r, "aceite.save")
        salvo = r.json()[0]
        # espelho rapido no cadastro do prestador (colunas ja existiam)
        sb.patch("/prestadores", params={"id": f"eq.{payload.prestador_id}"},
                 json={"ultimo_contrato_versao": cat["versao"],
                       "ultimo_contrato_assinado_em": aceito_em})
    log.info("contrato_aceito prestador=%s versao=%s aceite=%s",
             payload.prestador_id, cat["versao"], aceite_id)
    return salvo


# ─── INSTALA · Ativacao de obra por OTP (anexo do contrato geral, F4 #1988) ──
# Substitui a re-assinatura do termo por obra (POST /termos/{tid}/aceitar):
# com o contrato geral ja aceito, cada obra vira ANEXO por adesao, provada
# so pelo codigo WhatsApp (finalidade ativacao_obra, contexto.card_id).
# Pre-ativacao antecipada e permitida (obra futura; OTP exige rede).


class TermoAtivar(BaseModel):
    prestador_id: str
    # otp de finalidade ativacao_obra JA VALIDADO via /api/instala/otp/validar
    otp_id: str


@app.post("/api/instala/termos/{tid}/ativar")
def instala_termo_ativar(tid: str, payload: TermoAtivar,
                         user_agent: str | None = Header(default=None),
                         x_forwarded_for: str | None = Header(default=None)):
    """Ativa a obra como anexo do contrato geral: valida o OTP da obra,
    amarra o termo ao aceite vigente do prestador (contrato_aceite_id),
    gera o PDF do anexo (so itens + metragem) e marca o termo como aceito."""
    from datetime import datetime as _dt, timedelta as _td, timezone as _tz
    from .contrato_geral_pdf import gerar_pdf_anexo_obra

    now = _dt.now(_tz.utc)

    # 1) termo pendente da obra
    with _sb_client() as sb:
        r = sb.get("/prestador_termos", params={"select": "*", "id": f"eq.{tid}", "limit": "1"})
        _sb_raise(r, "ativar.termo")
        rows = r.json()
    termo = rows[0] if rows else None
    if not termo:
        raise HTTPException(404, "termo não encontrado")
    if termo["status"] == "aceito":
        raise HTTPException(409, "obra já ativada")

    # 2) OTP ativacao_obra validado ha pouco E emitido pra ESTA obra
    #    (contexto.card_id gravado no envio; impede reusar codigo de outra obra)
    with _sb_client() as sb:
        r = sb.get("/prestador_otp", params={
            "select": "id,telefone,finalidade,usado_em,contexto",
            "id": f"eq.{payload.otp_id}",
            "prestador_id": f"eq.{payload.prestador_id}", "limit": "1"})
        _sb_raise(r, "ativar.otp")
        otps = r.json()
    otp = otps[0] if otps else None
    if not otp or otp["finalidade"] != "ativacao_obra" or not otp.get("usado_em"):
        raise HTTPException(401, "confirme o código do WhatsApp antes de ativar")
    if (otp.get("contexto") or {}).get("card_id") != termo["card_id"]:
        raise HTTPException(401, "código não corresponde a esta obra; peça um novo envio")
    usado_em = _dt.fromisoformat(otp["usado_em"].replace("Z", "+00:00"))
    if now - usado_em > _td(minutes=30):
        raise HTTPException(410, "validação do WhatsApp expirou; confirme o código de novo")

    # 3) aceite vigente do contrato geral (o anexo fica preso a essa versao).
    #    Sem aceite = 412: o gate F3 do app ja obriga assinar antes, aqui e reforco.
    with _sb_client() as sb:
        r = sb.get("/prestador_contrato_aceites", params={
            "select": "id,versao_termos,aceito_em,dados_prestador,selfie_url,assinatura_url",
            "prestador_id": f"eq.{payload.prestador_id}",
            "status": "eq.aceito",
            "order": "versao_termos.desc", "limit": "1"})
        _sb_raise(r, "ativar.aceite")
        aceites = r.json()
    if not aceites:
        raise HTTPException(412, "assine o contrato geral antes de ativar obras")
    aceite = aceites[0]

    # 4) cliente + endereco da obra (gestao.projetos no PG local)
    cliente, endereco_obra = None, None
    if termo.get("projeto_id"):
        with conn() as c, c.cursor() as cur:
            cur.execute("SELECT cliente, endereco FROM gestao.projetos WHERE id::text = %s",
                        (str(termo["projeto_id"]),))
            rp = cur.fetchone()
            if rp:
                cliente = rp.get("cliente"); endereco_obra = rp.get("endereco")

    # 5) PDF do anexo: identifica a obra + itens/metragem + trilha da adesao
    aceite_ip = (x_forwarded_for or "").split(",")[0].strip() or None
    ativado_em = now.isoformat()
    dados = dict(aceite.get("dados_prestador") or {})
    # fallback: aceites antigos sem snapshot usam o cadastro da equipe do termo
    if not dados.get("nome"):
        dados = dict(termo.get("dados_prestador") or {})

    # Herda selfie + assinatura do aceite do contrato geral (Will 02/09):
    # baixa as imagens do bucket publico contratos-prestador e repassa em b64
    # pro PDF. Fail-soft: se o Storage falhar, o anexo sai sem as imagens
    # (a prova juridica da adesao segue sendo a trilha OTP).
    def _baixar_b64(url: str | None) -> str | None:
        if not url:
            return None
        try:
            rr = httpx.get(url, timeout=10)
            if rr.status_code == 200 and rr.content:
                return base64.b64encode(rr.content).decode()
        except Exception:
            pass
        return None
    assinatura_b64 = _baixar_b64(aceite.get("assinatura_url"))
    selfie_b64 = _baixar_b64(aceite.get("selfie_url"))

    pdf_bytes = gerar_pdf_anexo_obra(
        versao_contrato=aceite["versao_termos"],
        contrato_aceito_em=aceite.get("aceito_em"),
        dados_prestador=dados,
        cliente_obra=cliente, obra_endereco=endereco_obra,
        itens_snapshot=list(termo.get("itens_snapshot") or []),
        trilha={"anexo_id": tid, "contrato_aceite_id": aceite["id"],
                "telefone_validado": otp["telefone"],
                "whatsapp_validado_em": otp["usado_em"], "otp_id": otp["id"],
                "aceite_ip": aceite_ip, "aceite_user_agent": user_agent,
                "ativado_em": ativado_em},
        assinatura_b64=assinatura_b64, selfie_b64=selfie_b64)
    # sufixo -anexo separa do {tid}.pdf dos termos legados re-assinados
    pdf_url = _upload_supabase_bucket(
        bucket="termos-prestador", path=f"{tid}-anexo.pdf",
        content=pdf_bytes, content_type="application/pdf")

    # 6) fecha o termo como anexo aceito (colunas F1: contrato_aceite_id + otp_validado_em)
    with _sb_client() as sb:
        up = sb.patch("/prestador_termos", params={"id": f"eq.{tid}"},
                      json={"status": "aceito",
                            "aceito_em": ativado_em,
                            "contrato_aceite_id": aceite["id"],
                            "otp_validado_em": otp["usado_em"],
                            "pdf_url": pdf_url},
                      headers={"Prefer": "return=representation"})
        _sb_raise(up, "ativar.patch")
        salvo = up.json()[0]
    log.info("obra_ativada termo=%s prestador=%s card=%s aceite=%s otp=%s",
             tid, payload.prestador_id, termo["card_id"], aceite["id"], otp["id"])
    return salvo


@app.get("/api/operacoes/contrato-geral")
def operacoes_contrato_geral():
    """Painel do gestão (/equipes, F5 #1989): status do contrato geral por
    equipe. Junta equipes_parket (prestador_id) com o melhor aceite de cada
    prestador em prestador_contrato_aceites e devolve um mapa por equipe_id,
    pra tela mostrar aceito na vigente / aceite de versão antiga / sem aceite."""
    cat = _contrato_vigente_row()
    with _sb_client() as sb:
        re_ = sb.get("/equipes_parket", params={
            "select": "id,prestador_id", "prestador_id": "not.is.null", "limit": "500"})
        _sb_raise(re_, "contrato_geral.equipes")
        equipes = re_.json()
        ra = sb.get("/prestador_contrato_aceites", params={
            "select": "prestador_id,versao_termos,status,aceito_em,pdf_url,selfie_url,assinatura_url",
            "status": "eq.aceito", "order": "versao_termos.desc", "limit": "1000"})
        _sb_raise(ra, "contrato_geral.aceites")
        aceites = ra.json()
    # melhor aceite por prestador = maior versao (lista ja vem ordenada desc)
    por_prestador: dict[str, dict] = {}
    for a in aceites:
        por_prestador.setdefault(a["prestador_id"], a)
    por_equipe: dict[str, dict] = {}
    for eq in equipes:
        a = por_prestador.get(eq["prestador_id"])
        if a:
            por_equipe[eq["id"]] = {
                "versao_termos": a["versao_termos"], "aceito_em": a["aceito_em"],
                "pdf_url": a.get("pdf_url"),
                # foto + assinatura do aceite (Will 02/09): a tela /equipes
                # mostra a identificacao visual junto do contrato geral
                "selfie_url": a.get("selfie_url"),
                "assinatura_url": a.get("assinatura_url"),
                "vigente": a["versao_termos"] == cat["versao"],
            }
    return {"versao_vigente": cat["versao"], "por_equipe": por_equipe}


# ─── OBRAS · Cronograma ────────────────────────────────────

class CronogramaCreate(BaseModel):
    tipo: str = "obras"                # obras | marcenaria | reparos
    categoria: str = "acompanhamento"  # acompanhamento|cronograma_final|obras_liberadas|travado|finalizadas
    nome_obra: str
    card_id: str | None = None
    equipe: str | None = None
    fiscal: str | None = None
    servico: str | None = None
    dias: str | None = None
    custos: str | None = None
    observacao: str | None = None
    localizacao: str | None = None
    data: str | None = None
    inicio_dia: str | None = None
    termino_dia: str | None = None
    contrato: str | None = None
    dispos: str | None = None
    status_obra: str | None = None
    data_finalizacao: str | None = None


class CronogramaPatch(BaseModel):
    tipo: str | None = None
    categoria: str | None = None
    nome_obra: str | None = None
    card_id: str | None = None
    equipe: str | None = None
    fiscal: str | None = None
    servico: str | None = None
    dias: str | None = None
    custos: str | None = None
    observacao: str | None = None
    localizacao: str | None = None
    data: str | None = None
    inicio_dia: str | None = None
    termino_dia: str | None = None
    contrato: str | None = None
    dispos: str | None = None
    status_obra: str | None = None
    data_finalizacao: str | None = None


@app.get("/api/obras/cronograma")
def obras_cronograma_list(
    q: str | None = None,
    tipo: str | None = None,
    categoria: str | None = None,
    card_id: str | None = None,
    # 2000: backfill 26/08 criou linha de acompanhamento pra todo projeto
    # (632 linhas) — 500 escondia parte do cronograma
    limit: int = 2000,
):
    params: list[tuple[str, str]] = [
        ("select", "id,tipo,categoria,nome_obra,card_id,equipe,fiscal,servico,dias,custos,observacao,localizacao,data,inicio_dia,termino_dia,contrato,dispos,status_obra,data_finalizacao,posicao,created_at,updated_at"),
        ("order", "posicao.asc.nullslast,data.desc.nullslast"),
        ("limit", str(limit)),
    ]
    if tipo:      params.append(("tipo",      f"eq.{tipo}"))
    if categoria: params.append(("categoria", f"eq.{categoria}"))
    if card_id:   params.append(("card_id",   f"eq.{card_id}"))
    if q:
        params.append(("or", f"(nome_obra.ilike.*{q}*,equipe.ilike.*{q}*,fiscal.ilike.*{q}*,servico.ilike.*{q}*,localizacao.ilike.*{q}*)"))
    with _sb_client() as sb:
        r = sb.get("/cronograma_obras", params=params)
        _sb_raise(r, "obras.cronograma.list")
        return r.json()


@app.post("/api/obras/cronograma")
def obras_cronograma_create(payload: CronogramaCreate, x_user_email: str | None = Header(default=None)):
    body = payload.model_dump(exclude_none=True)
    with _sb_client() as sb:
        r = sb.post("/cronograma_obras", json=body, headers={"Prefer": "return=representation"})
        _sb_raise(r, "obras.cronograma.create")
        row = r.json()[0]
        log.info("cronograma_created id=%s obra=%s por=%s", row["id"], row.get("nome_obra"), x_user_email)
        return row


@app.patch("/api/obras/cronograma/{cid}")
def obras_cronograma_patch(cid: str, payload: CronogramaPatch, x_user_email: str | None = Header(default=None)):
    fields = payload.model_dump(exclude_none=True)
    if not fields:
        raise HTTPException(400, "nada pra atualizar")
    with _sb_client() as sb:
        r = sb.patch("/cronograma_obras", params={"id": f"eq.{cid}"}, json=fields,
                     headers={"Prefer": "return=representation"})
        _sb_raise(r, "obras.cronograma.patch")
        rows = r.json()
        if not rows:
            raise HTTPException(404, "linha não encontrada")
        return rows[0]


@app.delete("/api/obras/cronograma/{cid}")
def obras_cronograma_delete(cid: str, x_user_email: str | None = Header(default=None)):
    with _sb_client() as sb:
        r = sb.delete("/cronograma_obras", params={"id": f"eq.{cid}"},
                      headers={"Prefer": "return=representation"})
        _sb_raise(r, "obras.cronograma.delete")
        return {"ok": True}


# ─── CRONOGRAMA v2 · agrega gestao.itens por (projeto, categoria) ──
# Cada card do cronograma = 1 projeto; cada linha = 1 categoria (serviço)
# com equipe (itens.responsavel) e datas (previsao_inicio/fim) agregadas.

@app.get("/api/cronograma-itens")
def cronograma_itens_agregado():
    """1 linha por (projeto, categoria). Categoria = raiz normalizada:
    parte antes do primeiro '||' quando meta.categoria_raiz vem composto
    (formato CATEGORIA||ESPECIE||DIMENSAO em algumas propostas antigas),
    ou i.categoria puro. Unidade: prefere 'm²'/'m2' quando presente."""
    with conn() as c, c.cursor() as cur:
        cur.execute("""
            WITH base AS (
              SELECT i.projeto_id::text  AS projeto_id,
                     UPPER(TRIM(
                       SPLIT_PART(COALESCE(i.meta->>'categoria_raiz',
                                            i.categoria), '||', 1)
                     ))                   AS categoria,
                     i.quantidade, i.unidade, i.ambiente,
                     i.responsavel, i.previsao_inicio, i.previsao_fim
                FROM gestao.itens i
               WHERE COALESCE(i.status,'') <> 'cancelado'
                 AND COALESCE(i.meta->>'categoria_raiz', i.categoria) IS NOT NULL
                 AND TRIM(COALESCE(i.meta->>'categoria_raiz', i.categoria)) <> ''
            )
            SELECT projeto_id, categoria,
                   COUNT(*)                       AS n_itens,
                   COALESCE(SUM(quantidade),0)    AS quantidade_total,
                   -- Unidade: prefere m²/m2 se algum item tiver
                   COALESCE(
                     (SELECT unidade FROM (SELECT DISTINCT unidade FROM base b2
                        WHERE b2.projeto_id = base.projeto_id AND b2.categoria = base.categoria
                          AND (LOWER(b2.unidade) IN ('m²','m2'))) s LIMIT 1),
                     (array_agg(unidade ORDER BY unidade NULLS LAST))[1]
                   )                              AS unidade,
                   CASE WHEN COUNT(DISTINCT responsavel) FILTER (WHERE responsavel IS NOT NULL) = 1
                        THEN (array_agg(responsavel) FILTER (WHERE responsavel IS NOT NULL))[1]
                        ELSE NULL END             AS responsavel,
                   MIN(previsao_inicio)           AS previsao_inicio,
                   MAX(previsao_fim)              AS previsao_fim,
                   COALESCE(
                     array_agg(DISTINCT ambiente) FILTER (WHERE ambiente IS NOT NULL AND ambiente <> ''),
                     ARRAY[]::text[])             AS ambientes
              FROM base
             GROUP BY projeto_id, categoria
             ORDER BY projeto_id, categoria
        """)
        return cur.fetchall()


class CategoriaBulkPatch(BaseModel):
    responsavel: str | None = None
    previsao_inicio: str | None = None
    previsao_fim: str | None = None
    status: str | None = None
    executado_em: str | None = None


@app.patch("/api/projetos/{pid}/itens/categoria/{categoria}")
def projeto_itens_categoria_patch(
    pid: str, categoria: str, patch: CategoriaBulkPatch,
    x_user_email: str | None = Header(default=None),
):
    """Aplica responsavel/datas em TODOS os itens do projeto de uma categoria.
    Casa por UPPER(TRIM(categoria_raiz|categoria))."""
    fields = {k: v for k, v in patch.dict(exclude_unset=True).items()}
    if not fields:
        return {"ok": True, "n": 0}
    sets: list[str] = []
    args: list = []
    for k, v in fields.items():
        sets.append(f"{k} = %s")
        args.append(v if v not in ("", None) else None)
    cat_norm = categoria.strip().upper()
    args.extend([pid, cat_norm])
    with conn() as c, c.cursor() as cur:
        cur.execute(f"""
            UPDATE gestao.itens
               SET {', '.join(sets)}
             WHERE projeto_id::text = %s
               AND UPPER(TRIM(SPLIT_PART(COALESCE(meta->>'categoria_raiz', categoria), '||', 1))) = %s
               AND COALESCE(status,'') <> 'cancelado'
        """, args)
        n = cur.rowcount
    log.info("crono_bulk_patch pid=%s cat=%s campos=%s n=%s por=%s",
             pid, cat_norm, list(fields), n, x_user_email)
    return {"ok": True, "n": n}


# ─── PROJETO · Prestadores + Cronograma vinculados ─────────
# Prestadores moram em kanban_cards.details.prestadores (JSONB array).
# Cronograma → cronograma_obras filtrado por card_id.

@app.get("/api/projetos/{pid}/cronograma")
def projeto_cronograma(pid: str):
    with conn() as c, c.cursor() as cur:
        cur.execute("SELECT card_id::text FROM gestao.projetos WHERE id=%s", (pid,))
        row = cur.fetchone()
        if not row:
            raise HTTPException(404, "projeto não encontrado")
        cid = row["card_id"]
    if not cid:
        return []
    with _sb_client() as sb:
        r = sb.get("/cronograma_obras", params={
            "select": "id,tipo,categoria,nome_obra,card_id,equipe,fiscal,servico,dias,custos,observacao,localizacao,data,inicio_dia,termino_dia,contrato,dispos,status_obra,data_finalizacao,posicao,created_at,updated_at",
            "card_id": f"eq.{cid}",
            "order": "posicao.asc.nullslast,data.asc.nullslast",
        })
        _sb_raise(r, "projeto.cronograma")
        return r.json()


@app.get("/api/projetos/{pid}/prestadores")
def projeto_prestadores(pid: str):
    """Prestadores vinculados a este projeto (via kanban_cards.details.prestadores).
    Enriquece com dados de equipes_parket (categoria, stats) quando encontrado."""
    with conn() as c, c.cursor() as cur:
        cur.execute("SELECT card_id::text FROM gestao.projetos WHERE id=%s", (pid,))
        row = cur.fetchone()
        if not row:
            raise HTTPException(404, "projeto não encontrado")
        cid = row["card_id"]
    if not cid:
        return []
    with _sb_client() as sb:
        rc = sb.get("/kanban_cards", params={
            "select": "id,details",
            "id": f"eq.{cid}",
            "limit": "1",
        })
        _sb_raise(rc, "projeto.prestadores.card")
        rows = rc.json()
        if not rows:
            return []
        details = rows[0].get("details") or {}
        prestadores_ids = []
        prestadores_raw = details.get("prestadores") or []
        for p in prestadores_raw:
            if isinstance(p, dict) and p.get("id"):
                prestadores_ids.append(p["id"])
        if not prestadores_ids:
            return prestadores_raw
        # Enriquece com dados vivos de equipes_parket. O id gravado em
        # details.prestadores vem misturado da importação: às vezes é
        # equipes_parket.id, às vezes prestadores.id. Busca pelos dois.
        lista = ",".join(prestadores_ids)
        rq = sb.get("/equipes_parket", params={
            "select": "id,prestador_id,nome,telefone,categoria,ativo,total_checks,total_ok,total_ocorrencias,pct_ok,ultimo_check,dias_verificados,obras_distintas",
            "or": f"(id.in.({lista}),prestador_id.in.({lista}))",
        })
        _sb_raise(rq, "projeto.prestadores.equipes")
        equipes: dict[str, dict] = {}
        for e in rq.json():
            equipes[e["id"]] = e
            if e.get("prestador_id"):
                equipes.setdefault(e["prestador_id"], e)
        # Devolve merge preservando ordem original
        out = []
        for p in prestadores_raw:
            base = dict(p) if isinstance(p, dict) else {"nome": str(p)}
            if base.get("id") and base["id"] in equipes:
                base = {**equipes[base["id"]], **base}
            out.append(base)
    # Enriquece com escopo_itens_ids do prestador_card (match por telefone->prestador_id).
    # Escopo vazio = obra inteira. Se prestador_card nao existir, escopo vira [].
    try:
        with conn() as c2, c2.cursor() as cur2:
            cur2.execute("""
                SELECT p.nome, p.telefone, pc.escopo_itens_ids
                  FROM public.prestador_card pc
                  JOIN public.prestadores p ON p.id = pc.prestador_id
                 WHERE pc.card_id::text = %s
            """, (cid,))
            rows = cur2.fetchall()
        by_tel = {}
        by_nome = {}
        for r in rows:
            tel_digits = "".join(ch for ch in (r.get("telefone") or "") if ch.isdigit())
            if tel_digits:
                by_tel[tel_digits] = r.get("escopo_itens_ids") or []
            if r.get("nome"):
                by_nome[r["nome"].strip().lower()] = r.get("escopo_itens_ids") or []
        for base in out:
            tel_digits = "".join(ch for ch in (base.get("telefone") or "") if ch.isdigit())
            nome_key = (base.get("nome") or "").strip().lower()
            if tel_digits and tel_digits in by_tel:
                base["escopo_itens_ids"] = by_tel[tel_digits]
            elif nome_key and nome_key in by_nome:
                base["escopo_itens_ids"] = by_nome[nome_key]
            else:
                base["escopo_itens_ids"] = []
    except Exception as e:
        log.warning("projeto.prestadores escopo enrich fail: %s", e)
    return out


def _norm_tel(t: str | None) -> str:
    """Só dígitos — pra match confiável entre bases (formatos diferentes)."""
    return "".join(c for c in (t or "") if c.isdigit())


def _resolve_prestador_id(sb, eq: dict, create_if_missing: bool = True) -> str | None:
    """Resolve equipes_parket → prestadores.id (base do instala/compras).
    Match: (0) vínculo já gravado, (1) telefone só-dígitos, (2) nome exato,
    (3) cria novo se autorizado. Quando resolve por adivinhação, grava o
    resultado em equipes_parket.prestador_id pra não adivinhar de novo.
    """
    nome = (eq.get("nome") or "").strip()
    tel = _norm_tel(eq.get("telefone"))
    # 0) vínculo gravado (SQL 016/017) — caminho normal desde o backfill
    if eq.get("prestador_id"):
        return eq["prestador_id"]
    # 0b) o próprio id JÁ é de prestadores. Acontece nos details.prestadores
    # antigos, gravados pelo dashboard/Space com id da base do instala e não
    # da equipes_parket. Sem esta checagem o resolver caía no match por nome
    # e, quando o nome divergia, criava um prestador duplicado.
    raw_id = eq.get("id")
    if raw_id:
        try:
            r = sb.get("/prestadores", params={"select": "id", "id": f"eq.{raw_id}", "limit": "1"})
            if r.status_code < 400 and r.json():
                return r.json()[0]["id"]
        except Exception:
            pass
    # 1) match por telefone (case-insensitive digits)
    if tel:
        try:
            r = sb.get("/prestadores", params={"select": "id,telefone", "limit": "500"})
            if r.status_code < 400:
                for row in r.json():
                    if _norm_tel(row.get("telefone")) == tel:
                        return row["id"]
        except Exception:
            pass
    # 2) match por nome
    if nome:
        r = sb.get("/prestadores", params={"select": "id", "nome": f"eq.{nome}", "limit": "1"})
        if r.status_code < 400 and r.json():
            return r.json()[0]["id"]
    # 3) cria novo
    if create_if_missing and nome:
        try:
            r = sb.post("/prestadores", json={
                "nome": nome, "telefone": eq.get("telefone"),
                "categoria": eq.get("categoria"), "ativo": True,
            }, headers={"Prefer": "return=representation"})
            if r.status_code < 400 and r.json():
                new_id = r.json()[0]["id"]
                log.info("prestadores auto-created id=%s nome=%s", new_id, nome)
                return new_id
        except Exception as e:
            log.warning("prestadores create fail nome=%s err=%s", nome, e)
    return None


# ─── PRESTADORES · Acessos do instala.parket.works ───────────
# Login e senha que o instalador usa em instala.parket.works.
# Vive em public.prestador_credenciais (Cloud) com RLS fechada: a tabela
# prestadores tem policy aberta pra anon key, entao nao pode guardar senha.
# O gestao le e escreve aqui com a service key.

# Quem enxerga senha de prestador. role 'admin' NAO entra: no gestao ela
# inclui admin de departamento (financeiro, compras, expedicao), que nao
# tem nada a ver com acesso de instalador.
ACESSOS_PRESTADOR_ALLOWLIST = {
    # Natalia Alves Barbosa (planejamento) cuida do acesso dos instaladores
    "planejamento@parket.com.br",
}


def _eh_fiscal_de_campo(email: str) -> bool:
    """E-mail pertence a um fiscal de campo (fiscal_equipe no Cloud)?
    Mesmo lookup do _fiscal_escopo_ok: ilike sem curinga = igualdade
    case-insensitive no PostgREST."""
    try:
        with _sb_client() as sbc:
            rf = sbc.get("/fiscal_equipe", params={
                "select": "id", "email": f"ilike.{email}", "limit": "1"})
            return rf.status_code == 200 and bool(rf.json())
    except Exception as ex:
        log.warning("acessos fiscal lookup fail email=%s err=%s", email, ex)
        return False


def _pode_ver_acessos(email: str | None) -> bool:
    """Gate da lista de acessos: superadmin do gestao, allowlist explicita ou
    fiscal de campo (Will 08/09: fiscal gerencia acesso no Verifica e passa
    login e senha pro instalador na obra)."""
    e = (email or "").strip().lower()
    if not e:
        return False
    if e in ACESSOS_PRESTADOR_ALLOWLIST:
        return True
    try:
        with conn() as c, c.cursor() as cur:
            cur.execute(
                "SELECT role FROM public.user_profiles WHERE lower(email)=%s LIMIT 1", (e,))
            row = cur.fetchone()
        if row and row.get("role") == "superadmin":
            return True
    except Exception as ex:
        log.warning("acessos gate fail email=%s err=%s", e, ex)
    return _eh_fiscal_de_campo(e)


def _acesso_gate(email: str | None) -> str:
    if not _pode_ver_acessos(email):
        raise HTTPException(403, "sem permissão para ver ou gerar acesso de prestador")
    return (email or "").strip().lower()


def _slug_nome(nome: str) -> list[str]:
    """'Ailton Souza' -> ['ailton','souza'] (sem acento, só letras e números)."""
    import unicodedata as _u
    base = _u.normalize("NFKD", nome or "").encode("ascii", "ignore").decode().lower()
    base = "".join(ch if ch.isalnum() else " " for ch in base)
    return [t for t in base.split() if t]


def _acesso_padrao(nome: str, logins_usados: set[str]) -> tuple[str, str]:
    """Monta login e senha padrão. Mesma regra do backfill SQL 017:
    login = <primeiro-nome>.instalador@parket.com.br, senha = <primeiro-nome>@parket2026.
    Primeiro nome repetido gruda o sobrenome seguinte no login."""
    toks = _slug_nome(nome)
    if not toks:
        raise HTTPException(400, "prestador sem nome — não dá pra gerar login")
    senha = f"{toks[0]}@parket2026"
    base = toks[0]
    login = f"{base}.instalador@parket.com.br"
    i = 1
    while login in logins_usados:
        base = base + (toks[i] if i < len(toks) else str(i))
        login = f"{base}.instalador@parket.com.br"
        i += 1
    return login, senha


@app.get("/api/prestadores/acessos")
def prestadores_acessos_list(
    q: str | None = Query(default=None),
    x_user_email: str | None = Header(default=None),
):
    """Lista de acessos: um prestador por linha, com login e senha visíveis."""
    _acesso_gate(x_user_email)
    with _sb_client() as sb:
        rp = sb.get("/prestadores", params={
            "select": "id,nome,telefone,categoria,ativo",
            "order": "nome.asc",
            "limit": "1000",
        })
        _sb_raise(rp, "acessos.prestadores")
        prestadores = rp.json()

        rc = sb.get("/prestador_credenciais", params={
            "select": "prestador_id,login,senha_plain,ativo,atualizado_em,atualizado_por",
            "limit": "2000",
        })
        _sb_raise(rc, "acessos.credenciais")
        creds = {c["prestador_id"]: c for c in rc.json()}

        # Nomes das equipes ligadas ao prestador: a mesma pessoa pode ter mais
        # de uma linha em equipes_parket (duplicatas históricas da tabela)
        req = sb.get("/equipes_parket", params={
            "select": "nome,prestador_id",
            "prestador_id": "not.is.null",
            "limit": "2000",
        })
        _sb_raise(req, "acessos.equipes")
        equipes: dict[str, list[str]] = {}
        for e in req.json():
            equipes.setdefault(e["prestador_id"], []).append(e.get("nome") or "")

    termo = (q or "").strip().lower()
    out = []
    for p in prestadores:
        cred = creds.get(p["id"]) or {}
        linha = {
            "prestador_id": p["id"],
            "nome": p.get("nome"),
            "telefone": p.get("telefone"),
            "categoria": p.get("categoria"),
            "ativo": p.get("ativo"),
            "login": cred.get("login"),
            "senha": cred.get("senha_plain"),
            "tem_acesso": bool(cred),
            "atualizado_em": cred.get("atualizado_em"),
            "atualizado_por": cred.get("atualizado_por"),
            "equipes": equipes.get(p["id"], []),
            "no_gestao": p["id"] in equipes,
        }
        if termo:
            alvo = " ".join(str(v or "") for v in
                            (linha["nome"], linha["telefone"], linha["login"])).lower()
            if termo not in alvo:
                continue
        out.append(linha)
    return out


class AcessoIn(BaseModel):
    login: str | None = None
    senha: str | None = None


@app.post("/api/prestadores/{prestador_id}/acesso")
def prestador_acesso_set(
    prestador_id: str,
    payload: AcessoIn | None = None,
    x_user_email: str | None = Header(default=None),
):
    """Gera o acesso (primeira vez), reseta a senha ou edita login e senha.
    Sem body, usa o padrão (gerar/resetar). Com login e/ou senha no body, é a
    edição manual feita na tela de Acessos do gestão."""
    autor = _acesso_gate(x_user_email)
    body = payload or AcessoIn()
    with _sb_client() as sb:
        rp = sb.get("/prestadores", params={
            "select": "id,nome", "id": f"eq.{prestador_id}", "limit": "1"})
        _sb_raise(rp, "acesso.prestador")
        rows = rp.json()
        if not rows:
            raise HTTPException(404, "prestador não encontrado")
        nome = rows[0].get("nome") or ""

        rc = sb.get("/prestador_credenciais", params={
            "select": "prestador_id,login", "limit": "2000"})
        _sb_raise(rc, "acesso.credenciais")
        atual = None
        usados = set()
        # login (minúsculo) -> dono, pra barrar edição que rouba login de outro
        dono_do_login: dict[str, str] = {}
        for c in rc.json():
            lg = (c.get("login") or "").lower()
            usados.add(lg)
            dono_do_login[lg] = c["prestador_id"]
            if c["prestador_id"] == prestador_id:
                atual = c

        # No reset o login não muda; só a senha é trocada
        if body.login:
            login = body.login.strip().lower()
        elif atual and atual.get("login"):
            login = atual["login"]
        else:
            login, _ = _acesso_padrao(nome, usados)

        # O índice único é sobre lower(login): sem esta checagem o PostgREST
        # devolveria um 409 cru de constraint no meio da edição.
        outro = dono_do_login.get(login.lower())
        if outro and outro != prestador_id:
            raise HTTPException(409, f"o login {login} já é de outro prestador")

        if not login.strip():
            raise HTTPException(400, "login não pode ficar vazio")

        senha = body.senha.strip() if body.senha else _acesso_padrao(nome, set())[1]
        if not senha:
            raise HTTPException(400, "senha não pode ficar vazia")

        r = sb.post("/rpc/fn_prestador_set_senha", json={
            "p_prestador_id": prestador_id,
            "p_login": login,
            "p_senha": senha,
            "p_por": autor,
        })
        _sb_raise(r, "acesso.set")
        data = r.json()
        row = (data[0] if isinstance(data, list) and data else data) or {}
    log.info("prestador_acesso_set id=%s login=%s por=%s", prestador_id, login, autor)
    return {"prestador_id": prestador_id, "nome": nome,
            "login": row.get("login", login), "senha": row.get("senha_plain", senha)}


@app.post("/api/admin/prestador-card/backfill")
def backfill_prestador_card(x_user_email: str | None = Header(default=None)):
    """Sincroniza os details.prestadores dos cards de obra com prestador_card.
    Idempotente. Retorna contagem de sincs efetuados.

    Card de compras fica de fora: ele herda details.prestadores do card de obra
    pai pelo trigger fn_sync_card_details, e prestador_card é o que o app do
    instalador lista. Ver sql/020_prestador_obra_sync.sql."""
    with _sb_client() as sb:
        rc = sb.get("/kanban_cards", params={
            "select": "id,details",
            "details->prestadores": "not.is.null",
            "dept_id": f"in.({','.join(DEPTS_OBRA)})",
            "limit": "5000",
        })
        _sb_raise(rc, "backfill.cards")
        cards = rc.json()
        synced = 0; missing = 0; already = 0
        for c in cards:
            lista = ((c.get("details") or {}).get("prestadores") or [])
            for p in lista:
                if not isinstance(p, dict) or not p.get("id"): continue
                pid_ext = _resolve_prestador_id(sb, p, create_if_missing=True)
                if not pid_ext: missing += 1; continue
                r = sb.post("/prestador_card",
                    json={"prestador_id": pid_ext, "card_id": c["id"]},
                    headers={"Prefer": "return=minimal,resolution=ignore-duplicates"})
                if r.status_code < 400:
                    synced += 1
                else:
                    already += 1
        return {"cards": len(cards), "synced": synced, "missing": missing, "already": already}


@app.post("/api/projetos/{pid}/prestadores")
def projeto_prestador_vincular(pid: str, payload: PrestadorVinculo,
                                x_user_email: str | None = Header(default=None)):
    with conn() as c, c.cursor() as cur:
        cur.execute("SELECT card_id::text FROM gestao.projetos WHERE id=%s", (pid,))
        row = cur.fetchone()
        if not row:
            raise HTTPException(404, "projeto não encontrado")
        cid = row["card_id"]
    if not cid:
        raise HTTPException(400, "projeto sem card_id — não é possível vincular prestador")
    with _sb_client() as sb:
        # 1. Busca dados da equipe
        re = sb.get("/equipes_parket", params={
            "select": "id,nome,telefone,categoria,prestador_id",
            "id": f"eq.{payload.equipe_id}",
            "limit": "1",
        })
        _sb_raise(re, "projeto.prestador.equipe")
        rows = re.json()
        if not rows:
            raise HTTPException(404, "equipe não encontrada")
        eq = rows[0]
        # 2. Lê details atual do card
        rc = sb.get("/kanban_cards", params={"select": "details", "id": f"eq.{cid}", "limit": "1"})
        _sb_raise(rc, "projeto.prestador.card")
        crows = rc.json()
        if not crows:
            raise HTTPException(404, "card não encontrado")
        details = crows[0].get("details") or {}
        lista = list(details.get("prestadores") or [])
        # 3. Idempotência — se já tá vinculado, retorna sem duplicar
        if any(isinstance(p, dict) and p.get("id") == eq["id"] for p in lista):
            return {"ok": True, "prestadores": lista, "already_linked": True}
        lista.append({
            "id": eq["id"], "nome": eq["nome"],
            "telefone": eq.get("telefone"), "categoria": eq.get("categoria"),
        })
        details["prestadores"] = lista
        # 4. Grava details
        ru = sb.patch("/kanban_cards", params={"id": f"eq.{cid}"}, json={"details": details},
                      headers={"Prefer": "return=representation"})
        _sb_raise(ru, "projeto.prestador.update")
        # 5. SYNC pra prestador_card (usado pelo instala.parket.works).
        # equipes_parket (gestão) vs prestadores (instala/compras) — mesmo prestador
        # em 2 tabelas com IDs diferentes. Resolve match por telefone (mais estável
        # que nome), depois por nome exato, depois cria novo em prestadores.
        try:
            pid_ext = _resolve_prestador_id(sb, eq)
            if pid_ext:
                sb.post("/prestador_card", json={"prestador_id": pid_ext, "card_id": cid},
                        headers={"Prefer": "return=minimal,resolution=ignore-duplicates"})
                log.info("prestador_card synced prestador_ext=%s card=%s", pid_ext, cid)
            else:
                log.warning("prestador_card sync: falha ao resolver %s", eq.get('nome'))
        except Exception as e:
            log.warning("prestador_card sync fail: %s", e)

    # 6. Cria termo pendente no CLOUD com TODOS os itens do projeto
    # (mesmo helper usado pelo vínculo da aba Obras x Prestadores).
    try:
        tr = _auto_criar_termo_por_card(payload.equipe_id, cid, x_user_email)
        log.info("termo auto-criado (Visao Geral) id=%s equipe=%s card=%s itens=%s",
                 (tr or {}).get("id"), payload.equipe_id, cid, (tr or {}).get("itens"))
    except Exception as e:
        log.warning("termo auto-criado falhou (best-effort): %s", e)

    return {"ok": True, "prestadores": lista}


@app.delete("/api/projetos/{pid}/prestadores/{equipe_id}")
def projeto_prestador_desvincular(pid: str, equipe_id: str,
                                   x_user_email: str | None = Header(default=None)):
    with conn() as c, c.cursor() as cur:
        cur.execute("SELECT card_id::text FROM gestao.projetos WHERE id=%s", (pid,))
        row = cur.fetchone()
        if not row:
            raise HTTPException(404, "projeto não encontrado")
        cid = row["card_id"]
    if not cid:
        raise HTTPException(400, "projeto sem card_id")
    with _sb_client() as sb:
        rc = sb.get("/kanban_cards", params={"select": "details", "id": f"eq.{cid}", "limit": "1"})
        _sb_raise(rc, "projeto.prestador.card")
        crows = rc.json()
        if not crows:
            raise HTTPException(404, "card não encontrado")
        details = crows[0].get("details") or {}
        lista = [p for p in (details.get("prestadores") or [])
                 if not (isinstance(p, dict) and p.get("id") == equipe_id)]
        details["prestadores"] = lista
        ru = sb.patch("/kanban_cards", params={"id": f"eq.{cid}"}, json={"details": details},
                      headers={"Prefer": "return=representation"})
        _sb_raise(ru, "projeto.prestador.update")
        try:
            re = sb.get("/equipes_parket", params={"select": "nome,telefone,categoria,prestador_id",
                "id": f"eq.{equipe_id}", "limit": "1"})
            if re.status_code < 400 and re.json():
                pid_ext = _resolve_prestador_id(sb, re.json()[0], create_if_missing=False)
                if pid_ext:
                    sb.delete("/prestador_card", params={"prestador_id": f"eq.{pid_ext}",
                        "card_id": f"eq.{cid}"})
                    log.info("prestador_card removed prestador_ext=%s card=%s", pid_ext, cid)
        except Exception as e:
            log.warning("prestador_card unlink sync fail: %s", e)
        log.info("prestador_unlinked projeto=%s equipe=%s por=%s", pid, equipe_id, x_user_email)
        return {"ok": True, "prestadores": lista}


class EscopoItens(BaseModel):
    itens_ids: list[str]


@app.put("/api/projetos/{pid}/prestadores/{equipe_id}/escopo")
def projeto_prestador_escopo(pid: str, equipe_id: str, payload: EscopoItens,
                              x_user_email: str | None = Header(default=None)):
    """Define quais itens do cronograma este prestador executa nesta obra.
    itens_ids vazio = obra inteira (default backwards compat).
    Sem esse escopo o instalador enxerga a obra toda; com escopo, só o subset."""
    with conn() as c, c.cursor() as cur:
        cur.execute("SELECT card_id::text FROM gestao.projetos WHERE id=%s", (pid,))
        row = cur.fetchone()
        if not row:
            raise HTTPException(404, "projeto não encontrado")
        cid = row["card_id"]
    if not cid:
        raise HTTPException(400, "projeto sem card_id")
    with _sb_client() as sb:
        re = sb.get("/equipes_parket", params={"select": "nome,telefone,categoria,prestador_id",
            "id": f"eq.{equipe_id}", "limit": "1"})
        _sb_raise(re, "escopo.equipe")
        if re.json():
            eq = re.json()[0]
            pid_ext = _resolve_prestador_id(sb, eq, create_if_missing=False)
        else:
            # legado: details.prestadores antigo guarda id de prestadores,
            # não de equipes_parket; se o id existir lá, usa direto
            rp = sb.get("/prestadores", params={"select": "id", "id": f"eq.{equipe_id}", "limit": "1"})
            if rp.status_code < 400 and rp.json():
                pid_ext = equipe_id
            else:
                raise HTTPException(404, "equipe não encontrada")
        if not pid_ext:
            raise HTTPException(400, "prestador não vinculado no instala (sem match em prestadores)")
    with conn() as c2, c2.cursor() as cur2:
        cur2.execute("""
            UPDATE public.prestador_card
               SET escopo_itens_ids = %s::jsonb
             WHERE prestador_id = %s AND card_id::text = %s
            RETURNING id, escopo_itens_ids
        """, (json.dumps(payload.itens_ids), pid_ext, cid))
        upd = cur2.fetchone()
        if not upd:
            raise HTTPException(404, "prestador não vinculado a este card")
        c2.commit()
    log.info("prestador_escopo pid=%s equipe=%s prestador_ext=%s itens=%d por=%s",
             pid, equipe_id, pid_ext, len(payload.itens_ids), x_user_email)
    return {"ok": True, "escopo_itens_ids": upd["escopo_itens_ids"]}


# ═══════════════════════════════════════════════════════════════════
# FISCAL · Projetos vinculados
# Mesmo padrão dos prestadores: kanban_cards.details.fiscais[] contém
# {id, nome} do fiscal_equipe. Um projeto pode ter mais de um fiscal;
# um fiscal cobre vários projetos.
# ═══════════════════════════════════════════════════════════════════

@app.get("/api/fiscal/equipe/{fid}/projetos")
def fiscal_projetos(fid: str):
    """Projetos onde este fiscal está vinculado.
    Fonte dupla: kanban_cards.details.fiscais[] (projetos com card — center vê)
    + gestao.projetos.meta.fiscais[] (projetos sem card do Space)."""
    with _sb_client() as sb:
        # PostgREST containment: details->fiscais @> [{"id":"<fid>"}]
        r = sb.get("/kanban_cards", params={
            "select": "id",
            "details->fiscais": f'cs.[{{"id":"{fid}"}}]',
        })
        _sb_raise(r, "fiscal.projetos.cards")
        card_ids = [c["id"] for c in r.json()]
    with conn() as c, c.cursor() as cur:
        cur.execute("""
            SELECT id::text, cliente, obra_code, endereco, numero_proposta,
                   card_id::text, status, column_id::text
              FROM gestao.projetos
             WHERE card_id = ANY(%s::uuid[])
                OR meta->'fiscais' @> %s::jsonb
             ORDER BY cliente ASC
        """, (card_ids or [], json.dumps([{"id": fid}])))
        return cur.fetchall()


class FiscalProjetoLink(BaseModel):
    projeto_id: str


@app.post("/api/fiscal/equipe/{fid}/projetos")
def fiscal_projeto_vincular(fid: str, payload: FiscalProjetoLink,
                             x_user_email: str | None = Header(default=None)):
    with conn() as c, c.cursor() as cur:
        cur.execute("SELECT card_id::text FROM gestao.projetos WHERE id=%s", (payload.projeto_id,))
        row = cur.fetchone()
        if not row:
            raise HTTPException(404, "projeto não encontrado")
        cid = row["card_id"]
    with _sb_client() as sb:
        rf = sb.get("/fiscal_equipe", params={"select": "id,nome", "id": f"eq.{fid}", "limit": "1"})
        _sb_raise(rf, "fiscal.projeto.equipe")
        rows = rf.json()
        if not rows:
            raise HTTPException(404, "fiscal não encontrado")
        fs = rows[0]
    if not cid:
        # Projeto sem card do Space → vínculo em gestao.projetos.meta.fiscais[]
        with conn() as c, c.cursor() as cur:
            cur.execute("SELECT COALESCE(meta, '{}'::jsonb) AS meta FROM gestao.projetos WHERE id=%s", (payload.projeto_id,))
            meta = cur.fetchone()["meta"]
            lista = list(meta.get("fiscais") or [])
            if any(isinstance(x, dict) and x.get("id") == fs["id"] for x in lista):
                return {"ok": True, "fiscais": lista, "already_linked": True}
            lista.append({"id": fs["id"], "nome": fs["nome"]})
            meta["fiscais"] = lista
            cur.execute("UPDATE gestao.projetos SET meta=%s::jsonb WHERE id=%s",
                        (json.dumps(meta), payload.projeto_id))
            c.commit()
        log.info("fiscal_linked_meta fiscal=%s projeto=%s por=%s", fid, payload.projeto_id, x_user_email)
        return {"ok": True, "fiscais": lista}
    with _sb_client() as sb:
        rc = sb.get("/kanban_cards", params={"select": "details", "id": f"eq.{cid}", "limit": "1"})
        _sb_raise(rc, "fiscal.projeto.card")
        crows = rc.json()
        if not crows:
            raise HTTPException(404, "card não encontrado")
        details = crows[0].get("details") or {}
        lista = list(details.get("fiscais") or [])
        if any(isinstance(x, dict) and x.get("id") == fs["id"] for x in lista):
            return {"ok": True, "fiscais": lista, "already_linked": True}
        lista.append({"id": fs["id"], "nome": fs["nome"]})
        details["fiscais"] = lista
        ru = sb.patch("/kanban_cards", params={"id": f"eq.{cid}"}, json={"details": details},
                      headers={"Prefer": "return=representation"})
        _sb_raise(ru, "fiscal.projeto.update")
        log.info("fiscal_linked fiscal=%s projeto=%s por=%s", fid, payload.projeto_id, x_user_email)
        return {"ok": True, "fiscais": lista}


@app.delete("/api/fiscal/equipe/{fid}/projetos/{pid}")
def fiscal_projeto_desvincular(fid: str, pid: str,
                                x_user_email: str | None = Header(default=None)):
    with conn() as c, c.cursor() as cur:
        cur.execute("SELECT card_id::text FROM gestao.projetos WHERE id=%s", (pid,))
        row = cur.fetchone()
        if not row:
            raise HTTPException(404, "projeto não encontrado")
        cid = row["card_id"]
    if not cid:
        with conn() as c, c.cursor() as cur:
            cur.execute("SELECT COALESCE(meta, '{}'::jsonb) AS meta FROM gestao.projetos WHERE id=%s", (pid,))
            meta = cur.fetchone()["meta"]
            lista = [x for x in (meta.get("fiscais") or [])
                     if not (isinstance(x, dict) and x.get("id") == fid)]
            meta["fiscais"] = lista
            cur.execute("UPDATE gestao.projetos SET meta=%s::jsonb WHERE id=%s", (json.dumps(meta), pid))
            c.commit()
        log.info("fiscal_unlinked_meta fiscal=%s projeto=%s por=%s", fid, pid, x_user_email)
        return {"ok": True, "fiscais": lista}
    with _sb_client() as sb:
        rc = sb.get("/kanban_cards", params={"select": "details", "id": f"eq.{cid}", "limit": "1"})
        _sb_raise(rc, "fiscal.projeto.card")
        crows = rc.json()
        if not crows:
            raise HTTPException(404, "card não encontrado")
        details = crows[0].get("details") or {}
        lista = [x for x in (details.get("fiscais") or [])
                 if not (isinstance(x, dict) and x.get("id") == fid)]
        details["fiscais"] = lista
        ru = sb.patch("/kanban_cards", params={"id": f"eq.{cid}"}, json={"details": details},
                      headers={"Prefer": "return=representation"})
        _sb_raise(ru, "fiscal.projeto.update")
        log.info("fiscal_unlinked fiscal=%s projeto=%s por=%s", fid, pid, x_user_email)
        return {"ok": True, "fiscais": lista}


@app.get("/api/projetos/{pid}/fiscais")
def projeto_fiscais(pid: str):
    """Fiscais vinculados a este projeto (kanban_cards.details.fiscais[] ou,
    sem card, gestao.projetos.meta.fiscais[]), enriquecidos com fiscal_equipe."""
    with conn() as c, c.cursor() as cur:
        cur.execute("SELECT card_id::text, COALESCE(meta, '{}'::jsonb) AS meta FROM gestao.projetos WHERE id=%s", (pid,))
        row = cur.fetchone()
        if not row:
            raise HTTPException(404, "projeto não encontrado")
        cid = row["card_id"]
    if not cid:
        lista = [x for x in (row["meta"].get("fiscais") or [])
                 if isinstance(x, dict) and x.get("id")]
        if not lista:
            return []
    else:
        with _sb_client() as sb:
            rc = sb.get("/kanban_cards", params={"select": "details", "id": f"eq.{cid}", "limit": "1"})
            _sb_raise(rc, "projeto.fiscais.card")
            rows = rc.json()
            if not rows:
                return []
            lista = [x for x in ((rows[0].get("details") or {}).get("fiscais") or [])
                     if isinstance(x, dict) and x.get("id")]
            if not lista:
                return []
    with _sb_client() as sb:
        ids = ",".join(x["id"] for x in lista)
        rf = sb.get("/fiscal_equipe", params={
            "select": "id,nome,telefone,email,ativo",
            "id": f"in.({ids})",
        })
        _sb_raise(rf, "projeto.fiscais.equipe")
        vivos = {f["id"]: f for f in rf.json()}
        return [{**x, **vivos.get(x["id"], {})} for x in lista]


# ═══════════════════════════════════════════════════════════════════
# RELACIONAMENTO (Painel CS) — chat WhatsApp do projeto
# Reusa public.whatsapp_messages (autolinked por trigger wm_autolink_card
# a partir de phone → kanban_cards.details.celular). Envia via Evolution
# API em conect.parket.works (mesma que dept-atendimento do Space usa).
# ═══════════════════════════════════════════════════════════════════

EVOLUTION_URL    = os.environ.get("EVOLUTION_URL", "https://conect.parket.works")
EVOLUTION_APIKEY = os.environ.get("EVOLUTION_APIKEY", "4eab105201410d6865b86dca76ee9fa3")
# Instância "CS PARKET" (5511986750529) — Will reconectou o número nela em
# 18/08; a "Relacionamento PARKET" (mesmo número) ficou close desde então.
CS_INSTANCE_DEFAULT = os.environ.get("CS_INSTANCE", "CS PARKET")


def _resolve_projeto_conversa(pid: str):
    """Retorna (card_id, grupo_jid, instance_name). card_id e grupo_jid podem
    ser None se ainda não houver card/conversa registrada — nesse caso a UI
    mostra o painel de vincular grupo."""
    with conn() as c, c.cursor() as cur:
        cur.execute("SELECT card_id::text FROM gestao.projetos WHERE id=%s", (pid,))
        row = cur.fetchone()
        if not row:
            raise HTTPException(404, "projeto não encontrado")
        cid = row["card_id"]
    grupo_jid = None
    instance = CS_INSTANCE_DEFAULT
    if cid:
        with _sb_client() as sb:
            r = sb.get("/atendimento_conversas", params={
                "select": "grupo_jid,instance_name,status,unread_count,last_msg_preview,last_msg_at",
                "card_id": f"eq.{cid}",
                "order": "last_msg_at.desc.nullslast",
                "limit": "1",
            })
            _sb_raise(r, "relacionamento.conversa")
            rows = r.json()
            if rows:
                grupo_jid = rows[0].get("grupo_jid")
                instance = rows[0].get("instance_name") or CS_INSTANCE_DEFAULT
    return cid, grupo_jid, instance


@app.get("/api/projetos/{pid}/relacionamento")
def relacionamento_get(pid: str, limit: int = 100):
    """Retorna { conversa, mensagens }. Conversa vem de atendimento_conversas
    (status/unread), mensagens de whatsapp_messages via card_id (auto-linkado).
    Se o projeto não tem card_id ainda, retorna estado vazio pra a UI mostrar
    o painel de busca/vincular."""
    cid, grupo_jid, instance = _resolve_projeto_conversa(pid)
    conversa = None
    mensagens: list = []
    if cid:
        with _sb_client() as sb:
            rc = sb.get("/atendimento_conversas", params={
                "select": "id,grupo_jid,instance_name,status,prioridade,atribuido_a,tags,last_msg_at,last_msg_preview,last_msg_from_me,unread_count,resolved_at,resolved_by",
                "card_id": f"eq.{cid}",
                "order": "last_msg_at.desc.nullslast",
                "limit": "1",
            })
            _sb_raise(rc, "relacionamento.conversa.full")
            rows = rc.json()
            if rows:
                conversa = rows[0]
            # Mensagens: card_id direto (autolink) OU phone=grupo_jid se o autolink não pegou
            params = [
                ("select", "id,phone,instance,direction,sender_name,message_text,message_type,media_url,timestamp,evolution_msg_id,card_id"),
                ("order", "timestamp.desc"),
                ("limit", str(limit)),
            ]
            if grupo_jid:
                params.append(("or", f"(card_id.eq.{cid},phone.eq.{grupo_jid})"))
            else:
                params.append(("card_id", f"eq.{cid}"))
            rm = sb.get("/whatsapp_messages", params=params)
            _sb_raise(rm, "relacionamento.mensagens")
            mensagens = list(reversed(rm.json()))
    return {
        "conversa": conversa,
        "grupo_jid": grupo_jid,
        "instance": instance,
        "card_id": cid,
        "mensagens": mensagens,
    }


@app.get("/api/relacionamento/grupos")
def relacionamento_grupos(q: str | None = None, limit: int = 40):
    """Busca grupos WhatsApp em atendimento_grupos por subject/cliente/obra_code.
    Usado quando o vínculo automático não localizou o grupo pelo card_id."""
    params: list[tuple[str, str]] = [
        ("select", "id,grupo_jid,instance_name,subject,cliente,obra_code,membros,saude,card_id,updated_at"),
        ("order", "updated_at.desc.nullslast"),
        ("limit", str(limit)),
        # Só grupos WhatsApp (não canais/DM) e com JID válido
        ("grupo_jid", "not.is.null"),
    ]
    if q:
        # Busca ilike em subject/cliente/obra_code
        params.append(("or", f"(subject.ilike.*{q}*,cliente.ilike.*{q}*,obra_code.ilike.*{q}*)"))
    with _sb_client() as sb:
        r = sb.get("/atendimento_grupos", params=params)
        _sb_raise(r, "relacionamento.grupos.list")
        return r.json()


@app.get("/api/relacionamento/conversas")
def relacionamento_conversas(limit: int = 500):
    """Lista consolidada de conversas (grupos @g.us e clientes @s.whatsapp.net)
    pro painel /relacionamento — estilo atendimento do Homebroker. Enriquece
    com subject/cliente de atendimento_grupos e projeto_id de gestao.projetos."""
    with _sb_client() as sb:
        rc = sb.get("/atendimento_conversas", params=[
            ("select", "id,grupo_jid,instance_name,status,prioridade,atribuido_a,tags,"
                       "last_msg_at,last_msg_preview,last_msg_from_me,unread_count,"
                       "resolved_at,card_id"),
            ("order", "last_msg_at.desc.nullslast"),
            ("limit", str(limit)),
        ])
        _sb_raise(rc, "relacionamento.conversas.list")
        convs = rc.json()
        grupos: dict[str, dict] = {}
        jids = sorted({c["grupo_jid"] for c in convs if c.get("grupo_jid")})
        for i in range(0, len(jids), 80):  # in-list em lotes pra não estourar a URL
            rg = sb.get("/atendimento_grupos", params=[
                ("select", "grupo_jid,subject,cliente,obra_code"),
                ("grupo_jid", "in.(" + ",".join(f'"{j}"' for j in jids[i:i + 80]) + ")"),
            ])
            if rg.status_code < 400:
                for g in rg.json():
                    grupos[g["grupo_jid"]] = g
    projetos: dict[str, dict] = {}
    card_ids = [c["card_id"] for c in convs if c.get("card_id")]
    if card_ids:
        with conn() as c, c.cursor() as cur:
            cur.execute("""
                SELECT id::text, card_id::text, cliente, obra_code
                  FROM gestao.projetos WHERE card_id = ANY(%s::uuid[])
            """, (card_ids,))
            for row in cur.fetchall():
                projetos[row["card_id"]] = row
    out = []
    for cv in convs:
        jid = cv.get("grupo_jid") or ""
        g = grupos.get(jid) or {}
        pj = projetos.get(cv.get("card_id") or "") or {}
        out.append({
            **cv,
            "is_grupo": jid.endswith("@g.us"),
            "subject": g.get("subject"),
            "cliente": g.get("cliente") or pj.get("cliente"),
            "obra_code": g.get("obra_code") or pj.get("obra_code"),
            "projeto_id": pj.get("id"),
        })
    return out


@app.get("/api/relacionamento/chat")
def relacionamento_chat(jid: str, card_id: str | None = None, limit: int = 100):
    """Mensagens de qualquer conversa (grupo ou cliente direto), sem depender
    de projeto vinculado. card_id opcional pega também as auto-linkadas."""
    params: list[tuple[str, str]] = [
        ("select", "id,phone,instance,direction,sender_name,message_text,"
                   "message_type,media_url,timestamp,evolution_msg_id,card_id"),
        ("order", "timestamp.desc"),
        ("limit", str(limit)),
    ]
    if card_id:
        params.append(("or", f"(card_id.eq.{card_id},phone.eq.{jid})"))
    else:
        params.append(("phone", f"eq.{jid}"))
    with _sb_client() as sb:
        r = sb.get("/whatsapp_messages", params=params)
        _sb_raise(r, "relacionamento.chat")
        return {"jid": jid, "mensagens": list(reversed(r.json()))}


class RelacionamentoChatSend(BaseModel):
    jid: str
    instance: str | None = None
    card_id: str | None = None
    text: str


@app.post("/api/relacionamento/chat/send")
def relacionamento_chat_send(payload: RelacionamentoChatSend,
                             x_user_email: str | None = Header(default=None)):
    """Envia texto pra qualquer jid (grupo ou cliente) via Evolution."""
    text = (payload.text or "").strip()
    jid = (payload.jid or "").strip()
    if not text or not jid:
        raise HTTPException(400, "jid e texto são obrigatórios")
    instance = (payload.instance or "").strip() or CS_INSTANCE_DEFAULT
    number = jid if "@" in jid else f"{jid}@s.whatsapp.net"
    from urllib.parse import quote
    try:
        with httpx.Client(timeout=20.0) as ev:
            r = ev.post(f"{EVOLUTION_URL}/message/sendText/{quote(instance, safe='')}",
                        headers={"apikey": EVOLUTION_APIKEY, "Content-Type": "application/json"},
                        json={"number": number, "text": text})
            if r.status_code >= 400:
                log.warning("evolution_send_fail status=%s body=%s", r.status_code, r.text[:400])
                raise HTTPException(r.status_code, f"[evolution] {r.text[:300]}")
            resp = r.json()
            msg_id = ((resp.get("key") or {}).get("id")) or resp.get("id")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(502, f"falha ao enviar via Evolution: {e}")
    with _sb_client() as sb:
        try:
            r = sb.post("/whatsapp_messages", json={
                "phone": jid,
                "instance": instance,
                "direction": "out",
                "sender_name": (x_user_email or "gestao").split("@")[0].upper(),
                "message_text": text,
                "message_type": "conversation",
                "timestamp": __import__("datetime").datetime.utcnow().isoformat() + "Z",
                "evolution_msg_id": msg_id,
                "card_id": payload.card_id,
            }, headers={"Prefer": "return=representation"})
            if r.status_code >= 400:
                log.warning("wa_msg_insert_fail status=%s body=%s", r.status_code, r.text[:400])
        except Exception as e:
            log.warning("wa_msg_insert_exc %s", e)
    log.info("cs_chat_send jid=%s por=%s", jid, x_user_email)
    return {"ok": True, "jid": jid, "instance": instance, "evolution_msg_id": msg_id}


class RelacionamentoVincular(BaseModel):
    grupo_jid: str
    instance_name: str


@app.post("/api/projetos/{pid}/relacionamento/vincular")
def relacionamento_vincular(pid: str, payload: RelacionamentoVincular,
                             x_user_email: str | None = Header(default=None)):
    """Cria (ou atualiza) atendimento_conversas com card_id do projeto vinculado
    ao grupo escolhido. Também vincula atendimento_grupos.card_id pra consistência
    com o dept-atendimento do Space.

    Se o projeto não tem card_id ainda, tenta reusar o card_id do próprio grupo
    (se já existir) ou cria um stub em kanban_cards e grava em gestao.projetos.
    """
    with conn() as c, c.cursor() as cur:
        cur.execute("""
            SELECT p.card_id::text AS card_id, p.cliente, p.numero_proposta, p.obra_code
              FROM gestao.projetos p WHERE p.id = %s
        """, (pid,))
        proj = cur.fetchone()
        if not proj:
            raise HTTPException(404, "projeto não encontrado")
    cid = proj["card_id"]
    jid = payload.grupo_jid.strip()
    inst = payload.instance_name.strip()
    if not jid or not inst:
        raise HTTPException(400, "grupo_jid e instance_name são obrigatórios")

    with _sb_client() as sb:
        # 1) Se o projeto não tem card, tenta ancorar em um card já usado pelo grupo
        if not cid:
            rg0 = sb.get("/atendimento_grupos", params={
                "select": "card_id,subject",
                "grupo_jid": f"eq.{jid}",
                "instance_name": f"eq.{inst}",
                "limit": "1",
            })
            _sb_raise(rg0, "vincular.grupo.lookup")
            g0 = (rg0.json() or [None])[0]
            grupo_card = (g0 or {}).get("card_id")
            grupo_subject = (g0 or {}).get("subject") or proj.get("cliente") or "Card CS"
            if grupo_card:
                cid = grupo_card
                log.info("vincular_reuse_card projeto=%s card=%s (do grupo)", pid, cid)
            else:
                # Cria um stub em kanban_cards no dept 'atendimento' pra ancorar a FK.
                # Título usa subject do grupo (ou cliente do projeto) pra facilitar identificar.
                stub_title = grupo_subject[:120]
                rc0 = sb.post("/kanban_cards", json={
                    "dept_id": "atendimento",
                    "column_id": "conversas",
                    "title": stub_title,
                    "obra": proj.get("obra_code"),
                    "subtitle": proj.get("numero_proposta"),
                    "details": {"created_from": "gestao.relacionamento.vincular", "projeto_id": pid},
                }, headers={"Prefer": "return=representation"})
                if rc0.status_code >= 400:
                    log.warning("stub_card_fail status=%s body=%s", rc0.status_code, rc0.text[:400])
                    raise HTTPException(rc0.status_code,
                        f"não foi possível criar card de ancoragem: {rc0.text[:200]}")
                stub = rc0.json()[0]
                cid = stub["id"]
                log.info("vincular_create_stub projeto=%s card=%s title=%r", pid, cid, stub_title)
            # Grava card_id no projeto
            with conn() as c, c.cursor() as cur:
                cur.execute("UPDATE gestao.projetos SET card_id = %s WHERE id = %s", (cid, pid))

        # 2) UPSERT em atendimento_conversas (chave (grupo_jid, instance_name))
        rc = sb.post("/atendimento_conversas",
                     params={"on_conflict": "grupo_jid,instance_name"},
                     json={"grupo_jid": jid, "instance_name": inst, "card_id": cid},
                     headers={"Prefer": "resolution=merge-duplicates,return=representation"})
        _sb_raise(rc, "relacionamento.vincular.conversa")
        conv = (rc.json() or [None])[0]

        # 3) Espelha em atendimento_grupos se existir (não obrigatório)
        sb.patch("/atendimento_grupos",
                 params={"grupo_jid": f"eq.{jid}", "instance_name": f"eq.{inst}"},
                 json={"card_id": cid, "match_status": "manual"})

    log.info("cs_vincular projeto=%s grupo=%s inst=%s card=%s por=%s",
             pid, jid, inst, cid, x_user_email)
    return {"ok": True, "conversa": conv, "card_id": cid, "grupo_jid": jid, "instance_name": inst}


class RelacionamentoSend(BaseModel):
    text: str


@app.post("/api/projetos/{pid}/relacionamento/send")
def relacionamento_send(pid: str, payload: RelacionamentoSend,
                         x_user_email: str | None = Header(default=None)):
    text = (payload.text or "").strip()
    if not text:
        raise HTTPException(400, "texto vazio")
    cid, grupo_jid, instance = _resolve_projeto_conversa(pid)
    if not grupo_jid:
        raise HTTPException(400, "projeto sem grupo WhatsApp registrado — abra uma conversa antes")
    # Evolution accepts number = phone/jid without @c.us/@g.us; para grupo, mandar com @g.us
    number = grupo_jid if "@" in grupo_jid else f"{grupo_jid}@g.us"
    from urllib.parse import quote
    url = f"{EVOLUTION_URL}/message/sendText/{quote(instance, safe='')}"
    try:
        with httpx.Client(timeout=20.0) as ev:
            r = ev.post(url,
                        headers={"apikey": EVOLUTION_APIKEY, "Content-Type": "application/json"},
                        json={"number": number, "text": text})
            if r.status_code >= 400:
                log.warning("evolution_send_fail status=%s body=%s", r.status_code, r.text[:400])
                raise HTTPException(r.status_code, f"[evolution] {r.text[:300]}")
            resp = r.json()
            msg_id = ((resp.get("key") or {}).get("id")) or resp.get("id")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(502, f"falha ao enviar via Evolution: {e}")
    # Insere cache local em whatsapp_messages (o webhook Evolution vai atualizar depois)
    with _sb_client() as sb:
        body = {
            "phone": grupo_jid,
            "instance": instance,
            "direction": "out",
            "sender_name": (x_user_email or "gestao").split("@")[0].upper(),
            "message_text": text,
            "message_type": "conversation",
            "timestamp": __import__("datetime").datetime.utcnow().isoformat() + "Z",
            "evolution_msg_id": msg_id,
            "card_id": cid,
        }
        try:
            r = sb.post("/whatsapp_messages", json=body,
                        headers={"Prefer": "return=representation"})
            if r.status_code >= 400:
                log.warning("wa_msg_insert_fail status=%s body=%s", r.status_code, r.text[:400])
        except Exception as e:
            log.warning("wa_msg_insert_exc %s", e)
    log.info("cs_send projeto=%s grupo=%s por=%s", pid, grupo_jid, x_user_email)
    return {"ok": True, "grupo_jid": grupo_jid, "instance": instance, "evolution_msg_id": msg_id}


# ── TECA COPILOTO — sugere 3 respostas (positiva/neutra/negativa) ─────────
# Reusa o mesmo padrão OAuth do Claude Code que a teca.parket.works usa.
# Consulta projeto (cliente, obra, etapa, itens) + últimas 15 mensagens do
# grupo e pede pra Claude gerar 3 respostas com tons diferentes. Front cola
# a escolhida na caixa de mensagem pra editar antes de enviar.

_ANTHROPIC_OAUTH_BETAS = "claude-code-20250219,oauth-2025-04-20,interleaved-thinking-2025-05-14"
_ANTHROPIC_CC_BILLING = "x-anthropic-billing-header: cc_version=2.1.81; cc_entrypoint=api; cch=00000;"


def _anthropic_token() -> str:
    # 1º ai_accounts do parket-ai-squad (refresh automático); fallback secret estático.
    from .claude_token import get_oauth_token
    tok = get_oauth_token() or os.environ.get("ANTHROPIC_OAUTH_TOKEN") or os.environ.get("ANTHROPIC_API_KEY")
    if not tok:
        raise HTTPException(503, "Anthropic token não configurado no servidor")
    return tok


def _ask_claude(system_prompt: str, user_prompt: str, max_tokens: int = 2048,
                model: str | None = None) -> str:
    """Chama Anthropic Messages API via httpx (sem SDK).
    OAuth Claude Code (sk-ant-oat…) usa auth_token + betas + billing.
    API key normal (sk-ant-api…) usa x-api-key.
    `model` opcional sobrescreve o default (env CLAUDE_MODEL)."""
    tok = _anthropic_token()
    is_oauth = tok.startswith("sk-ant-oat")
    model = model or os.environ.get("CLAUDE_MODEL", "claude-sonnet-4-5-20250929")
    headers = {"anthropic-version": "2023-06-01", "content-type": "application/json"}
    if is_oauth:
        headers["authorization"] = f"Bearer {tok}"
        headers["anthropic-beta"] = _ANTHROPIC_OAUTH_BETAS
        headers["x-app"] = "cli"
        headers["user-agent"] = "claude-cli/2.1.81 (external, cli)"
        headers["anthropic-dangerous-direct-browser-access"] = "true"
        system = [
            {"type": "text", "text": _ANTHROPIC_CC_BILLING},
            {"type": "text", "text": system_prompt},
        ]
    else:
        headers["x-api-key"] = tok
        system = system_prompt
    body = {
        "model": model,
        "max_tokens": max_tokens,
        "system": system,
        "messages": [{"role": "user", "content": user_prompt}],
    }
    try:
        with httpx.Client(timeout=60.0) as h:
            r = h.post("https://api.anthropic.com/v1/messages", headers=headers, json=body)
        if r.status_code >= 400:
            log.warning("anthropic_call_fail status=%s body=%s", r.status_code, r.text[:400])
            raise HTTPException(502, f"Claude: HTTP {r.status_code}")
        data = r.json()
        for block in data.get("content", []):
            if block.get("type") == "text":
                return block.get("text") or ""
        return ""
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(502, f"falha ao chamar Claude: {e}")


def _extract_json(text: str) -> dict:
    """Extrai JSON de resposta que pode vir com markdown/texto extra."""
    import re, json as _json
    if not text:
        raise ValueError("resposta vazia")
    t = text.strip()
    t = re.sub(r"^```(?:json)?\s*", "", t)
    t = re.sub(r"\s*```\s*$", "", t)
    try:
        return _json.loads(t)
    except Exception:
        pass
    # Encontra {...} balanceados
    for start in range(len(t)):
        if t[start] != "{":
            continue
        depth = 0
        in_str = False
        escape = False
        for end in range(start, len(t)):
            ch = t[end]
            if in_str:
                if escape: escape = False
                elif ch == "\\": escape = True
                elif ch == '"': in_str = False
            else:
                if ch == '"': in_str = True
                elif ch == "{": depth += 1
                elif ch == "}":
                    depth -= 1
                    if depth == 0:
                        try:
                            return _json.loads(t[start:end + 1])
                        except Exception:
                            break
    raise ValueError(f"JSON inválido: {text[:200]}")


@app.get("/api/projetos/{pid}/relacionamento/copiloto")
def relacionamento_copiloto(pid: str):
    """Analisa projeto + últimas mensagens do grupo e devolve 3 sugestões de
    resposta (tons positivo/neutro/negativo) pra última mensagem do cliente."""
    # 1) Contexto do projeto
    with conn() as c, c.cursor() as cur:
        cur.execute("""
            SELECT p.id::text, p.cliente, p.numero_proposta, p.obra_code, p.endereco,
                   p.vendedor, p.status, p.etapa_atual,
                   COALESCE(v.n_total, 0) AS n_itens,
                   COALESCE(v.n_entregues, 0) AS n_entregues
              FROM gestao.projetos p
              LEFT JOIN gestao.v_projeto_progresso v ON v.projeto_id = p.id
             WHERE p.id::text = %s
        """, (pid,))
        proj = cur.fetchone()
        if not proj:
            raise HTTPException(404, "projeto não encontrado")
        cur.execute("""
            SELECT categoria, descritivo, ambiente, quantidade, unidade, status,
                   responsavel, previsao_inicio, previsao_fim
              FROM gestao.itens WHERE projeto_id::text = %s
             ORDER BY ordem NULLS LAST, categoria LIMIT 40
        """, (pid,))
        itens = cur.fetchall()

    # 2) Últimas mensagens
    cid, grupo_jid, instance = _resolve_projeto_conversa(pid)
    mensagens: list = []
    if cid:
        with _sb_client() as sb:
            params = [
                ("select", "phone,direction,sender_name,message_text,timestamp"),
                ("order", "timestamp.desc"),
                ("limit", "15"),
            ]
            if grupo_jid:
                params.append(("or", f"(card_id.eq.{cid},phone.eq.{grupo_jid})"))
            else:
                params.append(("card_id", f"eq.{cid}"))
            rm = sb.get("/whatsapp_messages", params=params)
            _sb_raise(rm, "copiloto.mensagens")
            mensagens = list(reversed(rm.json()))

    # 3) Formata prompt
    itens_txt = "\n".join(
        f"  • [{it['categoria'] or '?'}] {it['descritivo'] or ''} — "
        f"{it['quantidade'] or '?'}{it['unidade'] or ''} · status={it['status']}"
        f"{' · resp=' + (it['responsavel'] or '') if it.get('responsavel') else ''}"
        for it in itens
    ) or "  (sem itens cadastrados)"

    if mensagens:
        conv_txt = "\n".join(
            f"  {'CLIENTE' if m.get('direction') == 'in' else 'PARKET'} "
            f"({(m.get('sender_name') or '')[:30]}): "
            f"{(m.get('message_text') or '').strip()[:400]}"
            for m in mensagens
        )
        ultima_inbound = next(
            (m for m in reversed(mensagens) if m.get("direction") == "in"),
            None,
        )
        ultima_txt = (ultima_inbound.get("message_text") or "").strip() if ultima_inbound else ""
    else:
        conv_txt = "  (nenhuma mensagem trocada ainda)"
        ultima_txt = ""

    ctx = f"""
PROJETO:
  Cliente: {proj['cliente']}
  Proposta: {proj.get('numero_proposta') or '?'} · Obra: {proj.get('obra_code') or '?'}
  Endereço: {proj.get('endereco') or '?'}
  Vendedor Parket: {proj.get('vendedor') or '?'}
  Status: {proj.get('status')} · Etapa atual: {proj.get('etapa_atual')}/9
  Progresso: {proj.get('n_entregues')}/{proj.get('n_itens')} itens entregues

ITENS DO PROJETO:
{itens_txt}

HISTÓRICO RECENTE DA CONVERSA (mais antigo → mais recente):
{conv_txt}

ÚLTIMA MENSAGEM DO CLIENTE PRA RESPONDER:
  {ultima_txt or '(sem mensagem do cliente ainda — responda proativo baseado no estado do projeto)'}
""".strip()

    system = """Você é o Teca Copiloto, assistente do time de Customer Success da Parket
(madeira nobre brasileira — pisos, decks, painéis, marcenaria sob medida).

Você ajuda o atendente CS a responder o cliente no WhatsApp do projeto.
NUNCA envia nada sozinho — o atendente escolhe uma sugestão, edita se quiser, e envia.

REGRAS DAS SUGESTÕES:
- Português brasileiro, tom profissional mas humano. Nunca robótico.
- Curtas (1-4 linhas, ~80 palavras). É WhatsApp.
- Personalize com o nome do cliente e reflita o que ele disse.
- Reflita o contexto real do projeto (etapa, itens, status). Nunca invente dado.
- NUNCA comece com "Olá! Tudo bem?" — vá direto ao ponto.
- Termine com pergunta concreta OU próximo passo objetivo.
- Não use emoji, exceto se combinar com o tom.

ENTREGUE EXATAMENTE 3 SUGESTÕES com TONS DIFERENTES:
1. POSITIVA — otimista, celebra progresso, transmite confiança e boas notícias.
   Ideal quando queremos energizar o cliente ou reforçar avanços.
2. NEUTRA — profissional, factual, informativa. Sem carga emocional.
   Ideal quando queremos apenas atualizar/informar/pedir dado.
3. NEGATIVA — cautelosa, ajusta expectativa, admite dificuldade, pede paciência
   ou informa contratempo. NUNCA agressiva ou pessimista — é gestão de expectativa
   consciente. Ideal quando precisamos avisar atraso, ajuste ou limitação.

RESPONDA APENAS COM JSON VÁLIDO (sem markdown, sem texto extra):
{
  "sugestoes": [
    { "tom": "positiva", "titulo": "…curto…", "texto": "…mensagem pronta…" },
    { "tom": "neutra",   "titulo": "…curto…", "texto": "…mensagem pronta…" },
    { "tom": "negativa", "titulo": "…curto…", "texto": "…mensagem pronta…" }
  ]
}"""

    try:
        resp = _ask_claude(system, ctx, max_tokens=1500)
        data = _extract_json(resp)
        raws = data.get("sugestoes") or []
        out: list[dict] = []
        wanted = {"positiva", "neutra", "negativa"}
        for s in raws:
            if not isinstance(s, dict):
                continue
            tom = str(s.get("tom", "")).strip().lower()
            if tom not in wanted:
                continue
            titulo = str(s.get("titulo") or "").strip()[:60]
            texto = str(s.get("texto") or "").strip()[:1500]
            if texto:
                out.append({"tom": tom, "titulo": titulo, "texto": texto})
        if not out:
            raise ValueError("Claude não retornou sugestões válidas")
        # Ordena positiva, neutra, negativa
        order = {"positiva": 0, "neutra": 1, "negativa": 2}
        out.sort(key=lambda x: order.get(x["tom"], 9))
        return {
            "ok": True,
            "sugestoes": out,
            "ultima_mensagem_cliente": ultima_txt,
            "n_mensagens_contexto": len(mensagens),
        }
    except HTTPException:
        raise
    except Exception as e:
        log.error("copiloto_failed pid=%s err=%s", pid, str(e)[:300])
        raise HTTPException(500, f"copiloto falhou: {str(e)[:200]}")


# ═══════════════════════════════════════════════════════════════════
# OBRA · ACOMPANHAMENTO (item-centric) — adaptação do Space /operacional
#
# Cronograma = os próprios gestao.itens (meta.obra: rendimento/dia,
# equipe_id/equipe_nome, qtd_instalada). Dados gerais + previsão de
# entrega MANUAL (sem auto-calcular, decisão herdada do Space) em
# gestao.obra_acompanhamento. Fotos: a gestora de produtividade adota
# da inbox fiscal_fotos (pessoas em campo continuam enviando como hoje)
# ou faz upload direto — bucket obra-media, o mesmo do Space.
# Link público: /obra/<share_token> → GET /api/publico/obra/<token>.
# ═══════════════════════════════════════════════════════════════════
import json
import random
import re
import secrets
import string
import time

from fastapi import UploadFile, File, Form, BackgroundTasks

STORAGE_BUCKET = "obra-media"
_MEDIA_EXT = {"jpg", "jpeg", "png", "webp", "gif", "heic", "mp4", "mov", "webm"}
_VIDEO_EXT = {"mp4", "mov", "webm"}


def _storage_client() -> httpx.Client:
    if not SUPABASE_KEY:
        raise HTTPException(500, "SUPABASE_SERVICE_KEY não configurada no backend do gestao")
    return httpx.Client(
        base_url=f"{SUPABASE_URL}/storage/v1",
        headers={"apikey": SUPABASE_KEY, "Authorization": f"Bearer {SUPABASE_KEY}"},
        timeout=60.0,
    )


class AcompanhamentoPut(BaseModel):
    entrada_obra: str | None = None
    inicio_obra: str | None = None
    previsao_entrega_manual: str | None = None
    descricao_produto: str | None = None
    alertas: list | None = None
    meta: dict | None = None


def _acomp_get(pid: str) -> dict:
    with conn() as c, c.cursor() as cur:
        cur.execute("SELECT * FROM gestao.obra_acompanhamento WHERE projeto_id::text = %s", (pid,))
        row = cur.fetchone()
    return row or {
        "projeto_id": pid, "entrada_obra": None,
        "inicio_obra": None, "previsao_entrega_manual": None,
        "descricao_produto": None, "alertas": [], "share_token": None, "meta": {},
    }


@app.get("/api/projetos/{pid}/acompanhamento")
def acompanhamento_get(pid: str):
    _projeto_card_id(pid)  # 404 se projeto não existe
    return _acomp_get(pid)


@app.put("/api/projetos/{pid}/acompanhamento")
def acompanhamento_put(pid: str, payload: AcompanhamentoPut,
                       x_user_email: str | None = Header(default=None)):
    _projeto_card_id(pid)
    fields = payload.model_dump(exclude_unset=True)
    with conn() as c, c.cursor() as cur:
        cur.execute(
            "INSERT INTO gestao.obra_acompanhamento (projeto_id) VALUES (%s) ON CONFLICT DO NOTHING",
            (pid,))
        if not fields:
            return _acomp_get(pid)
        sets, args = [], []
        for k, v in fields.items():
            if k in ("alertas", "meta"):
                sets.append(f"{k} = %s::jsonb"); args.append(json.dumps(v))
            else:
                sets.append(f"{k} = %s"); args.append(v)
        args.append(pid)
        cur.execute(f"""
            UPDATE gestao.obra_acompanhamento SET {', '.join(sets)}
             WHERE projeto_id::text = %s RETURNING *
        """, args)
        row = cur.fetchone()
        cur.execute("""
            INSERT INTO gestao.eventos (projeto_id, tipo, titulo, autor_email, payload)
            VALUES (%s, 'observacao', 'Acompanhamento de obra atualizado', %s, %s::jsonb)
        """, (pid, x_user_email, json.dumps(fields, default=str)))
    return row


@app.post("/api/projetos/{pid}/acompanhamento/share")
def acompanhamento_share(pid: str, x_user_email: str | None = Header(default=None)):
    _projeto_card_id(pid)
    with conn() as c, c.cursor() as cur:
        cur.execute(
            "INSERT INTO gestao.obra_acompanhamento (projeto_id) VALUES (%s) ON CONFLICT DO NOTHING",
            (pid,))
        cur.execute("SELECT share_token FROM gestao.obra_acompanhamento WHERE projeto_id::text = %s", (pid,))
        tok = (cur.fetchone() or {}).get("share_token")
        if not tok:
            tok = secrets.token_urlsafe(12)
            cur.execute("UPDATE gestao.obra_acompanhamento SET share_token = %s WHERE projeto_id::text = %s",
                        (tok, pid))
            log.info("obra_share_created pid=%s por=%s", pid, x_user_email)
    return {"token": tok, "url": f"https://gestao.parket.works/obra/{tok}"}


@app.delete("/api/projetos/{pid}/acompanhamento/share")
def acompanhamento_share_revoke(pid: str, x_user_email: str | None = Header(default=None)):
    with conn() as c, c.cursor() as cur:
        cur.execute("UPDATE gestao.obra_acompanhamento SET share_token = NULL WHERE projeto_id::text = %s", (pid,))
    log.info("obra_share_revoked pid=%s por=%s", pid, x_user_email)
    return {"ok": True}


# ─── FOTOS DO ACOMPANHAMENTO (gestao.fotos, por item) ─────────

@app.get("/api/projetos/{pid}/fotos-obra")
def fotos_obra_list(pid: str, item_id: str | None = None):
    where, args = ["projeto_id::text = %s"], [pid]
    if item_id:
        where.append("item_id::text = %s"); args.append(item_id)
    with conn() as c, c.cursor() as cur:
        cur.execute(f"""
            SELECT id, projeto_id, item_id, url, legenda, ambiente, categoria,
                   tipo, origem, fonte_id, storage_path, ordem, autor_email, created_at,
                   center_visivel
              FROM gestao.fotos
             WHERE {' AND '.join(where)}
             ORDER BY ordem, created_at
        """, args)
        return cur.fetchall()


def _comprimir_foto_upload(data: bytes) -> bytes | None:
    """Recomprime a foto no ato do upload (JPEG ≤1920px q82). None = manter original
    (formato não suportado pelo Pillow, animação, ou resultado maior que o original)."""
    try:
        import io
        from PIL import Image, ImageOps
        img = Image.open(io.BytesIO(data))
        if getattr(img, "is_animated", False):
            return None
        img = ImageOps.exif_transpose(img)
        if img.mode != "RGB":
            img = img.convert("RGB")
        img.thumbnail((1920, 1920), Image.LANCZOS)
        buf = io.BytesIO()
        img.save(buf, "JPEG", quality=82, optimize=True, progressive=True)
        out = buf.getvalue()
        return out if len(out) < len(data) else None
    except Exception:
        return None


@app.post("/api/projetos/{pid}/fotos-obra")
async def fotos_obra_upload(
    pid: str,
    bg: BackgroundTasks,
    file: UploadFile = File(...),
    item_id: str = Form(default=""),
    legenda: str = Form(default=""),
    ambiente: str = Form(default=""),
    categoria: str = Form(default=""),
    x_user_email: str | None = Header(default=None),
):
    """Upload direto pro bucket obra-media (o mesmo que o Space usa)."""
    _projeto_card_id(pid)
    fname = file.filename or ""
    ext = fname.rsplit(".", 1)[-1].lower() if "." in fname else "jpg"
    if ext not in _MEDIA_EXT:
        raise HTTPException(400, f"extensão .{ext} não suportada — use {sorted(_MEDIA_EXT)}")
    data = await file.read()
    if len(data) > 50 * 1024 * 1024:
        raise HTTPException(400, "arquivo acima de 50MB")
    content_type = file.content_type or "application/octet-stream"
    if ext not in _VIDEO_EXT:
        comp = _comprimir_foto_upload(data)
        if comp:
            data, ext, content_type = comp, "jpg", "image/jpeg"
    rand = "".join(random.choices(string.ascii_lowercase + string.digits, k=6))
    path = f"gestao/{pid}/{int(time.time() * 1000)}_{rand}.{ext}"
    with _storage_client() as st:
        r = st.post(f"/object/{STORAGE_BUCKET}/{path}", content=data,
                    headers={"Content-Type": content_type,
                             "x-upsert": "true"})
        if r.status_code >= 400:
            raise HTTPException(502, f"storage upload falhou: {r.text[:300]}")
    url = f"{SUPABASE_URL}/storage/v1/object/public/{STORAGE_BUCKET}/{path}"
    tipo = "video" if ext in _VIDEO_EXT else "foto"
    with conn() as c, c.cursor() as cur:
        cur.execute("""
            INSERT INTO gestao.fotos (projeto_id, item_id, url, legenda, ambiente,
                                      categoria, tipo, origem, storage_path, autor_email)
            VALUES (%s, %s, %s, %s, %s, %s, %s, 'upload', %s, %s)
            RETURNING *
        """, (pid, item_id or None, url, legenda or None, ambiente or None,
              categoria or None, tipo, path, x_user_email))
        row = cur.fetchone()
        cur.execute("""
            INSERT INTO gestao.eventos (projeto_id, item_id, tipo, titulo, autor_email, payload)
            VALUES (%s, %s, 'foto', %s, %s, %s::jsonb)
        """, (pid, item_id or None, f"Registro fotográfico adicionado ({tipo})",
              x_user_email, json.dumps({"url": url, "legenda": legenda or None})))
    if tipo == "foto":
        bg.add_task(_insta_otimizar_fotos, [str(row["id"])])
    return row


class FotoAdotar(BaseModel):
    fonte_id: str          # fiscal_fotos.id
    url: str
    item_id: str | None = None
    legenda: str | None = None
    ambiente: str | None = None
    tipo: str | None = None


@app.post("/api/projetos/{pid}/fotos-obra/adotar")
def fotos_obra_adotar(pid: str, payload: FotoAdotar,
                      x_user_email: str | None = Header(default=None)):
    """Adota uma foto da inbox (fiscal_fotos, enviada de campo) pro acompanhamento,
    vinculando ao item. Idempotente por (projeto_id, fonte_id)."""
    _projeto_card_id(pid)
    tipo = payload.tipo or ("video" if payload.url.lower().split("?")[0].endswith((".mp4", ".mov", ".webm")) else "foto")
    with conn() as c, c.cursor() as cur:
        cur.execute("""
            INSERT INTO gestao.fotos (projeto_id, item_id, url, legenda, ambiente,
                                      tipo, origem, fonte_id, autor_email)
            VALUES (%s, %s, %s, %s, %s, %s, 'fiscal', %s, %s)
            ON CONFLICT (projeto_id, fonte_id) WHERE fonte_id IS NOT NULL
            DO UPDATE SET item_id = EXCLUDED.item_id,
                          legenda = COALESCE(EXCLUDED.legenda, gestao.fotos.legenda),
                          ambiente = COALESCE(EXCLUDED.ambiente, gestao.fotos.ambiente)
            RETURNING *
        """, (pid, payload.item_id, payload.url, payload.legenda, payload.ambiente,
              tipo, payload.fonte_id, x_user_email))
        row = cur.fetchone()
        cur.execute("""
            INSERT INTO gestao.eventos (projeto_id, item_id, tipo, titulo, autor_email, payload)
            VALUES (%s, %s, 'foto', 'Foto de campo adotada no acompanhamento', %s, %s::jsonb)
        """, (pid, payload.item_id, x_user_email,
              json.dumps({"fonte_id": payload.fonte_id, "url": payload.url})))
    return row


class FotoPatch(BaseModel):
    item_id: str | None = None
    legenda: str | None = None
    ambiente: str | None = None
    categoria: str | None = None
    ordem: int | None = None
    center_visivel: bool | None = None


@app.patch("/api/fotos-obra/{fid}")
def fotos_obra_patch(fid: str, payload: FotoPatch):
    fields = payload.model_dump(exclude_unset=True)
    if not fields:
        raise HTTPException(400, "nada pra atualizar")
    sets = [f"{k} = %s" for k in fields]
    args = list(fields.values()) + [fid]
    with conn() as c, c.cursor() as cur:
        cur.execute(f"UPDATE gestao.fotos SET {', '.join(sets)} WHERE id::text = %s RETURNING *", args)
        row = cur.fetchone()
    if not row:
        raise HTTPException(404, "foto não encontrada")
    return row


@app.delete("/api/fotos-obra/{fid}")
def fotos_obra_delete(fid: str):
    with conn() as c, c.cursor() as cur:
        cur.execute("DELETE FROM gestao.fotos WHERE id::text = %s RETURNING storage_path, origem", (fid,))
        row = cur.fetchone()
    if not row:
        raise HTTPException(404, "foto não encontrada")
    if row.get("origem") == "upload" and row.get("storage_path"):
        try:
            with _storage_client() as st:
                st.delete(f"/object/{STORAGE_BUCKET}/{row['storage_path']}")
        except Exception:
            log.warning("storage_delete_failed path=%s", row.get("storage_path"))
    return {"ok": True}


# ─── DOCUMENTOS DO PROJETO (árvore canônica por fase) ──────────
# Catálogo em gestao.documentos_catalogo (6 fases / passos 0..17.2);
# arquivos no bucket obra-media em gestao/{pid}/docs/{codigo}/…

import unicodedata as _ud

_DOC_MAX_BYTES = 200 * 1024 * 1024


def _rasterizar_pdf(st: httpx.Client, base: str, pdf: bytes) -> list[dict]:
    """Rasteriza o PDF em JPG 200dpi e devolve [{n, url}] pro meta.paginas.

    A Central do Cliente renderiza as paginas como imagem; sem isso o cliente
    so ve o botao de download. Mesmo formato do anteprojeto_publicar.
    """
    import io
    import uuid

    import fitz
    from PIL import Image

    doc_uuid = str(uuid.uuid4())
    paginas: list[dict] = []
    d = fitz.open(stream=pdf, filetype="pdf")
    for i, page in enumerate(d, 1):
        pix = page.get_pixmap(dpi=200)
        img = Image.frombytes("RGB", (pix.width, pix.height), pix.samples)
        buf = io.BytesIO()
        img.save(buf, "JPEG", quality=85, optimize=True)
        path = f"{base}/paginas/{doc_uuid}/page_{i:02d}.jpg"
        r = st.post(f"/object/{STORAGE_BUCKET}/{path}", content=buf.getvalue(),
                    headers={"Content-Type": "image/jpeg", "x-upsert": "true"})
        if r.status_code >= 400:
            raise HTTPException(502, f"storage upload falhou: {r.text[:300]}")
        paginas.append({"n": i, "url": f"{SUPABASE_URL}/storage/v1/object/public/{STORAGE_BUCKET}/{path}"})
    return paginas


def _doc_safe_name(fname: str) -> str:
    base = _ud.normalize("NFKD", fname).encode("ascii", "ignore").decode()
    out = "".join(ch if ch.isalnum() or ch in "._-" else "_" for ch in base)
    return out.strip("._") or "arquivo"


@app.get("/api/documentos-catalogo")
def documentos_catalogo():
    with conn() as c, c.cursor() as cur:
        cur.execute("""
            SELECT id, fase, fase_titulo, codigo, titulo, etapa_numero, obrigatorio, ordem
              FROM gestao.documentos_catalogo ORDER BY ordem
        """)
        return cur.fetchall()


@app.get("/api/projetos/{pid}/documentos")
def documentos_list(pid: str):
    with conn() as c, c.cursor() as cur:
        cur.execute("""
            SELECT d.id, d.projeto_id, d.catalogo_id, d.etapa_numero, d.slug, d.titulo,
                   d.arquivo_url, d.storage_path, d.content_type, d.nome_arquivo,
                   d.tamanho_bytes, d.gerado_por, d.meta, d.created_at,
                   cat.fase, cat.fase_titulo, cat.codigo, cat.titulo AS catalogo_titulo
              FROM gestao.documentos d
              LEFT JOIN gestao.documentos_catalogo cat ON cat.id = d.catalogo_id
             WHERE d.projeto_id::text = %s
             ORDER BY cat.ordem NULLS LAST, d.created_at
        """, (pid,))
        return cur.fetchall()


@app.post("/api/projetos/{pid}/documentos")
async def documentos_upload(
    pid: str,
    file: UploadFile = File(...),
    catalogo_codigo: str = Form(default=""),
    titulo: str = Form(default=""),
    x_user_email: str | None = Header(default=None),
):
    _projeto_card_id(pid)
    cat = None
    if catalogo_codigo:
        with conn() as c, c.cursor() as cur:
            cur.execute("SELECT * FROM gestao.documentos_catalogo WHERE codigo = %s", (catalogo_codigo,))
            cat = cur.fetchone()
        if not cat:
            raise HTTPException(404, f"passo '{catalogo_codigo}' não existe no catálogo")
    fname = file.filename or "arquivo"
    data = await file.read()
    if len(data) > _DOC_MAX_BYTES:
        raise HTTPException(400, "arquivo acima de 200MB")
    rand = "".join(random.choices(string.ascii_lowercase + string.digits, k=6))
    pasta = (cat or {}).get("codigo", "avulso")
    path = f"gestao/{pid}/docs/{pasta}/{int(time.time() * 1000)}_{rand}_{_doc_safe_name(fname)}"
    with _storage_client() as st:
        r = st.post(f"/object/{STORAGE_BUCKET}/{path}", content=data,
                    headers={"Content-Type": file.content_type or "application/octet-stream",
                             "x-upsert": "true"})
        if r.status_code >= 400:
            raise HTTPException(502, f"storage upload falhou: {r.text[:300]}")
    url = f"{SUPABASE_URL}/storage/v1/object/public/{STORAGE_BUCKET}/{path}"

    # PDF de passo com etapa (Anteprojeto, Executivo, Mapeamento...) vai pro Center:
    # rasteriza as paginas pro cliente ver o desenho, nao so o link de download.
    paginas: list[dict] = []
    if (cat or {}).get("etapa_numero") and fname.lower().endswith(".pdf"):
        try:
            with _storage_client() as st:
                paginas = _rasterizar_pdf(st, f"gestao/{pid}/docs/{pasta}", data)
        except Exception:
            log.exception("rasterizacao do documento falhou pid=%s arquivo=%s", pid, fname)

    with conn() as c, c.cursor() as cur:
        cur.execute("""
            INSERT INTO gestao.documentos (projeto_id, catalogo_id, etapa_numero, slug, titulo,
                                           arquivo_url, storage_path, content_type,
                                           nome_arquivo, tamanho_bytes, gerado_por, meta)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, 'upload', %s::jsonb)
            RETURNING *
        """, (pid, (cat or {}).get("id"), (cat or {}).get("etapa_numero"),
              (cat or {}).get("codigo", "avulso"), titulo or fname,
              url, path, file.content_type or "application/octet-stream",
              fname, len(data), json.dumps({"paginas": paginas})))
        row = cur.fetchone()
        cur.execute("""
            INSERT INTO gestao.eventos (projeto_id, tipo, titulo, autor_email, payload)
            VALUES (%s, 'documento', %s, %s, %s::jsonb)
        """, (pid, f"Documento anexado: {titulo or fname}", x_user_email,
              json.dumps({"codigo": (cat or {}).get("codigo"), "url": url})))
    return row


@app.delete("/api/documentos/{did}")
def documentos_delete(did: str):
    with conn() as c, c.cursor() as cur:
        cur.execute("DELETE FROM gestao.documentos WHERE id::text = %s RETURNING storage_path", (did,))
        row = cur.fetchone()
    if not row:
        raise HTTPException(404, "documento não encontrado")
    if row.get("storage_path"):
        try:
            with _storage_client() as st:
                st.delete(f"/object/{STORAGE_BUCKET}/{row['storage_path']}")
        except Exception:
            log.warning("storage_delete_failed path=%s", row.get("storage_path"))
    return {"ok": True}


# ─── SOLICITAÇÃO DE COMPRAS ────────────────────────────────────
# Espelha o fluxo do Space/compras-app (Solicitar.tsx): insere card em
# public.kanban_cards no Cloud → aparece no kanban de compras.parket.works.

from datetime import datetime, timezone, timedelta, date

COMPRAS_DEPT_ROUTING = {
    "marcenaria-ronaldo": {"dept_id": "compras",        "responsavel": "Ronaldo"},
    "lalamove-ronaldo":   {"dept_id": "compras",        "responsavel": "Ronaldo"},
    "instalacao-taiara":  {"dept_id": "compras-taiara", "responsavel": "Taiara"},
    "amostras-marco":     {"dept_id": "compras-marco",  "responsavel": "Marco Antônio"},
}

# Seed idêntico ao form do Space — checklist_total: 8
COMPRAS_CHECKLISTS_SEED = [
    {"name": "Cotação", "items": [
        {"name": "Identificar fornecedores qualificados", "done": False},
        {"name": "Solicitar 03 cotações para comparação", "done": False},
        {"name": "Analisar custo-benefício (preço, prazo, qualidade, condições de pagamento)", "done": False},
        {"name": "Registrar cotações e decisões no sistema", "done": False},
    ]},
    {"name": "Interface Financeira", "items": [
        {"name": "Confirmar Valor", "done": False},
        {"name": "Confirmar prazo de entrega", "done": False},
        {"name": "Informar BF/FÁBRICA", "done": False},
        {"name": "Salvar Comprovante do Pedido", "done": False},
    ]},
]


class MaterialCompra(BaseModel):
    tipo: str
    quantidade: str = ""
    justificativa: str = ""


class SolicitacaoCompraCreate(BaseModel):
    departamento: str            # chave de COMPRAS_DEPT_ROUTING
    materiais: list[MaterialCompra]
    prazo: str                   # YYYY-MM-DD
    solicitante: str
    pedido_por: str = ""         # quem vai usar o material (padrão compras-app)
    setor: str = ""
    obs: str = ""


@app.post("/api/solicitacoes-compras/ferramentas")
def solicitacao_compras_ferramentas(payload: SolicitacaoCompraCreate,
                                     x_user_email: str | None = Header(default=None)):
    """Solicitação de FERRAMENTAS — não pertence a nenhum projeto/obra.
    Vai pro kanban de compras (mesma rota), com tipo_requisicao='ferramentas'."""
    mats = [m.model_dump() for m in payload.materiais if m.tipo.strip()]
    if not mats:
        raise HTTPException(400, "informe ao menos um material")
    # Compras precisa entender o pra quê de cada item — justificativa obrigatória (Will 23/07).
    for idx, m in enumerate(mats, start=1):
        if not (m.get("justificativa") or "").strip():
            raise HTTPException(400, f"informe a justificativa do material {idx} (por que precisa, obra/aplicação)")
    if not payload.prazo:
        raise HTTPException(400, "informe o prazo estimado de entrega")
    if not payload.solicitante.strip():
        raise HTTPException(400, "informe o solicitante")
    rota = COMPRAS_DEPT_ROUTING.get(payload.departamento,
                                      {"dept_id": "compras", "responsavel": "Ronaldo"})
    now = datetime.now(timezone.utc)
    now_iso = now.isoformat().replace("+00:00", "Z")
    hoje = now.strftime("%d/%m/%Y")
    nome = payload.solicitante.strip()
    pedido_por = payload.pedido_por.strip() or nome
    solicitante = pedido_por
    if nome and nome != pedido_por:
        solicitante += f" · {nome}"
    if payload.setor.strip():
        solicitante += f" ({payload.setor.strip()})"
    titulo = f"Ferramentas — {solicitante} — {hoje}"
    card = {
        "dept_id": rota["dept_id"],
        "column_id": "solicitacao" if rota["dept_id"] == "compras-marco" else "entrada",
        "title": titulo,
        "responsavel": rota["responsavel"],
        "sla": "7d", "sla_status": "ok", "priority": "media",
        "checklist_done": 0, "checklist_total": 8,
        "details": {
            "solicitante": solicitante,
            "setor": payload.setor.strip(),
            "pedido_por": pedido_por,
            "departamento_compras": payload.departamento,
            "responsavel_compras": rota["responsavel"],
            "data_solicitacao": now_iso,
            "data_solicitacao_fmt": hoje,
            "data_limite_entrega": payload.prazo,
            "materiais": mats,
            "obs_solicitacao": payload.obs,
            "observacoes": payload.obs,
            "status_solicitacao": "pendente",
            "tipo_requisicao": "ferramentas",
            "itens": [f"{m['quantidade'] + ' — ' if m['quantidade'] else ''}{m['tipo']}" for m in mats],
            "origem": "gestao_ferramentas",
            "projeto_vinculado": None,
            "checklists": COMPRAS_CHECKLISTS_SEED,
        },
    }
    with _sb_client() as sb:
        r = sb.post("/kanban_cards", json=card,
                    headers={"Prefer": "return=representation"})
        _sb_raise(r, "solicitacao_ferramentas_insert")
        novo = r.json()[0]
    log.info("solicitacao_ferramentas criada id=%s dept=%s solicitante=%s por=%s",
             novo["id"], rota["dept_id"], solicitante, x_user_email)
    return {"id": novo["id"], "dept_id": rota["dept_id"],
             "column_id": novo.get("column_id"), "titulo": titulo,
             "solicitante": solicitante, "departamento": payload.departamento,
             "responsavel": rota["responsavel"], "data": now_iso,
             "prazo": payload.prazo, "materiais": mats, "obs": payload.obs,
             "status": "pendente",
             "tipo_requisicao": "ferramentas"}


@app.post("/api/projetos/{pid}/solicitacoes-compras")
def solicitacao_compras_create(pid: str, payload: SolicitacaoCompraCreate,
                               x_user_email: str | None = Header(default=None)):
    with conn() as c, c.cursor() as cur:
        cur.execute("""
            SELECT id::text, cliente, obra_code, card_id::text AS card_id, gestor_email, meta
              FROM gestao.projetos WHERE id::text = %s
        """, (pid,))
        projeto = cur.fetchone()
    if not projeto:
        raise HTTPException(404, "projeto não encontrado")

    mats = [m.model_dump() for m in payload.materiais if m.tipo.strip()]
    if not mats:
        raise HTTPException(400, "informe ao menos um material")
    # Compras precisa entender o pra quê de cada item — justificativa obrigatória (Will 23/07).
    for idx, m in enumerate(mats, start=1):
        if not (m.get("justificativa") or "").strip():
            raise HTTPException(400, f"informe a justificativa do material {idx} (por que precisa, obra/aplicação)")
    if not payload.prazo:
        raise HTTPException(400, "informe o prazo estimado de entrega")
    if not payload.solicitante.strip():
        raise HTTPException(400, "informe o solicitante")

    rota = COMPRAS_DEPT_ROUTING.get(payload.departamento,
                                    {"dept_id": "compras", "responsavel": "Ronaldo"})
    now = datetime.now(timezone.utc)
    now_iso = now.isoformat().replace("+00:00", "Z")
    hoje = now.strftime("%d/%m/%Y")
    # Composição idêntica ao compras-app: "pedidoPor · nome (setor)"
    nome = payload.solicitante.strip()
    pedido_por = payload.pedido_por.strip() or nome
    solicitante = pedido_por
    if nome and nome != pedido_por:
        solicitante += f" · {nome}"
    if payload.setor.strip():
        solicitante += f" ({payload.setor.strip()})"
    projeto_label = f"{projeto['obra_code'] + ' — ' if projeto.get('obra_code') else ''}{projeto.get('cliente') or ''}".strip(" —")
    # PKT-COMPRAS-GESTAO-PROJETO-20260820: alinhado com compras-app/Solicitar.tsx (Will 20/08).
    # Título passa a ser o nome do projeto (não genérico), obra top-level ganha o código
    # e details vira o MESMO shape do PDF (projeto_nome/obra_codigo) — sem isso o PDF
    # do card sai com "Projeto: -" mesmo tendo o projeto vinculado no gestao.projetos.
    titulo = projeto_label or f"Solicitação — {solicitante} — {hoje}"

    card = {
        "dept_id": rota["dept_id"],
        "column_id": "solicitacao" if rota["dept_id"] == "compras-marco" else "entrada",
        "title": titulo,
        "obra": projeto.get("obra_code") or None,
        "responsavel": rota["responsavel"],
        "sla": "7d",
        "sla_status": "ok",
        "priority": "media",
        "checklist_done": 0,
        "checklist_total": 8,
        "details": {
            "solicitante": solicitante,
            "setor": payload.setor.strip(),
            "pedido_por": pedido_por,
            "departamento_compras": payload.departamento,
            "responsavel_compras": rota["responsavel"],
            "data_solicitacao": now_iso,
            "data_solicitacao_fmt": hoje,
            "data_limite_entrega": payload.prazo,
            "materiais": mats,
            "obs_solicitacao": payload.obs,
            "observacoes": payload.obs,
            "status_solicitacao": "pendente",
            "tipo_requisicao": "obra",
            "itens": [f"{m['quantidade'] + ' — ' if m['quantidade'] else ''}{m['tipo']}" for m in mats],
            "origem": "gestao_projeto",
            "gestao_projeto_id": pid,
            "projeto_vinculado": projeto_label or None,
            # Chaves lidas pelo PDF do compras-app (CardModal.tsx:354). Sem elas o PDF
            # sai com "Projeto: -" mesmo o projeto estando corretamente vinculado.
            "projeto_nome": projeto_label or None,
            "obra_codigo": projeto.get("obra_code") or None,
            "cliente": projeto.get("cliente") or None,
            "checklists": COMPRAS_CHECKLISTS_SEED,
        },
    }
    if projeto.get("card_id"):
        card["parent_card_id"] = projeto["card_id"]

    with _sb_client() as sb:
        r = sb.post("/kanban_cards", json=card,
                    headers={"Prefer": "return=representation"})
        _sb_raise(r, "solicitacao_compras_insert")
        novo = r.json()[0]

        # Vínculo reverso no card do Space (details.solicitacoes_compras) — best-effort
        if projeto.get("card_id"):
            try:
                pr = sb.get("/kanban_cards", params={
                    "id": f"eq.{projeto['card_id']}", "select": "details"})
                if pr.status_code < 400 and pr.json():
                    d = pr.json()[0].get("details") or {}
                    arr = d.get("solicitacoes_compras") or []
                    arr.append({"id": novo["id"], "solicitante": solicitante,
                                "data": now_iso, "prazo": payload.prazo,
                                "materiais": mats, "status": "pendente"})
                    sb.patch("/kanban_cards", params={"id": f"eq.{projeto['card_id']}"},
                             json={"details": {**d, "solicitacoes_compras": arr}})
            except Exception:
                log.warning("solicitacao_compras reverse-link space falhou pid=%s", pid)

    entry = {"id": novo["id"], "dept_id": rota["dept_id"],
             "column_id": novo.get("column_id"), "titulo": titulo,
             "solicitante": solicitante, "departamento": payload.departamento,
             "responsavel": rota["responsavel"], "data": now_iso,
             "prazo": payload.prazo, "materiais": mats, "obs": payload.obs,
             "status": "pendente"}

    with conn() as c, c.cursor() as cur:
        cur.execute("""
            UPDATE gestao.projetos
               SET meta = jsonb_set(COALESCE(meta,'{}'::jsonb), '{solicitacoes_compras}',
                                    COALESCE(meta->'solicitacoes_compras','[]'::jsonb) || %s::jsonb)
             WHERE id::text = %s
        """, (json.dumps(entry), pid))
        cur.execute("""
            INSERT INTO gestao.eventos (projeto_id, tipo, titulo, autor_email, payload)
            VALUES (%s, 'compras', %s, %s, %s::jsonb)
        """, (pid, f"Solicitação de compras enviada → {rota['responsavel']}",
              x_user_email, json.dumps({"card_id": novo["id"],
                                        "departamento": payload.departamento,
                                        "materiais": mats, "prazo": payload.prazo})))

    # Notificação WhatsApp do grupo de Compras — best-effort
    try:
        httpx.post("https://agente.parket.works/api/handoffs/nova-solicitacao-compras",
                   json={"titulo": titulo, "solicitante": solicitante,
                         "itens": [f"{m['quantidade'] + ' — ' if m['quantidade'] else ''}{m['tipo']}"
                                   f"{' (' + m['justificativa'] + ')' if m['justificativa'] else ''}" for m in mats],
                         "prazo": payload.prazo,
                         "projeto_vinculado": projeto_label or None,
                         "card_id": novo["id"]},
                   headers={"User-Agent": "parket-gestao/1.0"}, timeout=8.0)
    except Exception:
        log.warning("solicitacao_compras webhook falhou pid=%s", pid)

    return entry


# Segunda parte do fluxo PKT-MAT-ASSUMIR-20260903 (assumir vive perto do
# /api/instala/material): converte a solicitação de material do time na
# solicitação de COMPRAS oficial. Mora aqui embaixo porque precisa de
# SolicitacaoCompraCreate + solicitacao_compras_create já definidos.
class InstalaMaterialCompraIn(SolicitacaoCompraCreate):
    """Payload do modal "Solicitar Compras" do verifica: mesmo do gestão, mais o
    projeto escolhido no seletor e o modo ferramentas (sem projeto vinculado).
    aprovado_por (08/09): nome do FISCAL que aprovou o pedido do instalador na
    análise do verifica; entra como "quem atendeu" na linha de material."""
    projeto_id: str | None = None
    ferramentas: bool = False
    aprovado_por: str | None = None


@app.post("/api/instala/material/{sid}/criar-compra")
def instala_material_criar_compra(sid: str, payload: InstalaMaterialCompraIn,
                                  x_user_email: str | None = Header(default=None)):
    """Converte a solicitação de material em solicitação de COMPRAS oficial.
    Usa o projeto escolhido no modal (ou, sem ele, resolve pelo card_id da obra);
    projeto vinculado é obrigatório fora do modo ferramentas (Will 02/09 #2012).
    Reusa o fluxo oficial e, no fim, marca a solicitação de material como atendida."""
    with _sb_client() as sbc:
        r = sbc.get("/instala_material_solicitacoes", params={"id": f"eq.{sid}", "select": "*"})
        _sb_raise(r, "instala_material_get")
        rows = r.json()
    if not rows:
        raise HTTPException(404, "solicitação não encontrada")
    sol = rows[0]
    if sol.get("status") != "pendente":
        raise HTTPException(409, "solicitação já foi atendida/recusada")
    base = SolicitacaoCompraCreate(**payload.model_dump(
        exclude={"projeto_id", "ferramentas", "aprovado_por"}))
    if payload.ferramentas:
        entry = solicitacao_compras_ferramentas(base, x_user_email)
    else:
        pid = payload.projeto_id
        if not pid:
            with conn() as c, c.cursor() as cur:
                cur.execute("SELECT id::text FROM gestao.projetos WHERE card_id::text = %s",
                            (sol["card_id"],))
                p = cur.fetchone()
            if not p:
                raise HTTPException(409, "obra sem projeto no gestão: escolha o projeto no seletor ou marque Ferramentas")
            pid = p["id"]
        # Reusa o fluxo oficial (card kanban compras + evento + WhatsApp + vínculo projeto)
        entry = solicitacao_compras_create(pid, base, x_user_email)
    # Amarra o card de compras de volta na solicitação de material: é por aqui que
    # o autor do pedido enxerga o status ao vivo (a tabela do Cloud não tem coluna
    # de vínculo, então o ponteiro mora no details do card).
    # Origem preservada no card: o pedido nasceu no campo (fiscal no verifica ou
    # instalador no instala), mesmo o card tendo sido aberto aqui no gestão.
    _compras_marcar_material(entry.get("id"), sid, {
        "origem": "fiscal_verifica" if sol.get("origem") == "fiscal" else "instala_prestador",
        "origem_nome": sol.get("fiscal_nome") or sol.get("prestador_nome") or "",
    })
    # Fecha a solicitação de material apontando quem atendeu e quando. Quando o
    # pedido veio da análise do fiscal (verifica), aprovado_por manda: o
    # solicitante do form é o instalador, mas quem atendeu foi o fiscal.
    quem = ((payload.aprovado_por or "").strip()
            or (payload.solicitante or "").strip()
            or sol.get("atendida_por") or "gestão")
    with _sb_client() as sbc:
        r = sbc.patch("/instala_material_solicitacoes", params={"id": f"eq.{sid}"},
                      json={"status": "atendida", "atendida_por": quem,
                            "atendida_em": datetime.now(timezone.utc).isoformat()},
                      headers={"Prefer": "return=representation"})
        _sb_raise(r, "instala_material_atender")
        rows_upd = r.json() if r.status_code < 400 else []
    return {"compra": entry, "solicitacao": rows_upd[0] if rows_upd else sol}


def _compras_marcar_material(card_id: str | None, sid: str, extra: dict | None = None) -> None:
    """Grava details.material_solicitacao_id no card de compras recém-criado.
    É o único vínculo entre a solicitação de material e o card do kanban.
    `extra` grava chaves adicionais no mesmo details (ex: origem do pedido)."""
    if not card_id:
        return
    try:
        with _sb_client() as sbc:
            r = sbc.get("/kanban_cards", params={"id": f"eq.{card_id}", "select": "details"})
            if r.status_code >= 400 or not r.json():
                return
            det = r.json()[0].get("details") or {}
            det["material_solicitacao_id"] = sid
            if extra:
                det.update(extra)
            sbc.patch("/kanban_cards", params={"id": f"eq.{card_id}"}, json={"details": det})
    except Exception:
        log.warning("compras vinculo material falhou (%s)", card_id)


class InstalaMaterialCompraDiretaIn(InstalaMaterialCompraIn):
    """Pedido de quem está em obra (fiscal no verifica OU prestador no instala):
    vai DIRETO pro setor de compras (Will 03/09), sem passar pelo ASSUMIR.
    Carrega os campos do material só pra manter a linha de histórico em
    instala_material_solicitacoes. prestador_* chegou em 08/09 quando o Instala
    passou a usar a mesma base do modal Solicitar Compras do gestão."""
    card_id: str | None = None
    fiscal_id: str | None = None
    fiscal_nome: str | None = None
    prestador_id: str | None = None
    prestador_nome: str | None = None
    foto_url: str | None = None
    client_key: str | None = None


@app.post("/api/instala/material/compra-direta")
def instala_material_compra_direta(payload: InstalaMaterialCompraDiretaIn,
                                   x_user_email: str | None = Header(default=None)):
    """Fiscal (verifica) ou prestador (instala) preenche o mesmo formulário do
    gestão e o pedido segue direto pro kanban de compras. Cria a solicitação de
    compras oficial e registra a linha de material já 'atendida' (histórico +
    rastreio do status na lista)."""
    base = SolicitacaoCompraCreate(**payload.model_dump(
        exclude={"projeto_id", "ferramentas", "aprovado_por", "card_id",
                 "fiscal_id", "fiscal_nome", "prestador_id", "prestador_nome",
                 "foto_url", "client_key"}))
    if payload.ferramentas:
        entry = solicitacao_compras_ferramentas(base, x_user_email)
        card_obra = payload.card_id
    else:
        pid = payload.projeto_id
        if not pid:
            raise HTTPException(409, "escolha o projeto ou marque Ferramentas")
        entry = solicitacao_compras_create(pid, base, x_user_email)
        with conn() as c, c.cursor() as cur:
            cur.execute("SELECT card_id::text AS card_id FROM gestao.projetos WHERE id::text = %s", (pid,))
            p = cur.fetchone()
        card_obra = (p or {}).get("card_id") or payload.card_id
    # Linha de material espelhando o pedido (o fiscal acompanha por ela no #material)
    itens = "\n".join(
        f"{(m.tipo or '').strip()}"
        + (f" · {m.quantidade}" if (m.quantidade or "").strip() else "")
        + (f" · {m.justificativa}" if (m.justificativa or "").strip() else "")
        for m in payload.materiais if (m.tipo or "").strip()) or "(sem itens)"
    # Quem pediu: prestador (instala) tem prioridade sobre fiscal (verifica)
    # porque os campos nunca vêm preenchidos juntos no mesmo payload.
    eh_prestador = bool(payload.prestador_id or payload.prestador_nome)
    quem = ((payload.solicitante or "").strip() or payload.prestador_nome
            or payload.fiscal_nome or "obra")
    row = {
        "card_id": card_obra,
        "itens": itens,
        "foto_url": payload.foto_url,
        "origem": "instala" if eh_prestador else "fiscal",
        "prestador_id": payload.prestador_id,
        "prestador_nome": payload.prestador_nome,
        "fiscal_id": payload.fiscal_id,
        "fiscal_nome": payload.fiscal_nome,
        "client_key": payload.client_key,
        "status": "atendida",
        "atendida_por": quem,
        "atendida_em": datetime.now(timezone.utc).isoformat(),
    }
    created = None
    try:
        with _sb_client() as sbc:
            ja = _instala_dedup(sbc, "instala_material_solicitacoes", payload.client_key)
            if ja:
                created = ja
            else:
                r = sbc.post("/instala_material_solicitacoes", json=row,
                             headers={"Prefer": "return=representation"})
                _sb_raise(r, "instala_material_compra_direta")
                created = r.json()[0]
    except Exception:
        log.warning("material direta: linha de historico falhou")
    if created and created.get("id"):
        # Origem marcada no card de compras pro gerenciador mostrar que o pedido
        # veio de campo (fiscal no verifica ou prestador no instala) e não do gestão.
        _compras_marcar_material(entry.get("id"), created["id"], {
            "origem": "prestador_instala" if eh_prestador else "fiscal_verifica",
            "origem_nome": payload.prestador_nome or payload.fiscal_nome or quem,
        })
        if card_obra:
            _instala_evento_gestao(card_obra, "instala_material",
                                   f"Material solicitado por {quem}: {itens[:80]}",
                                   row | {"solicitacao_id": created["id"],
                                          "compra_card_id": entry.get("id")})
    return {"compra": entry, "solicitacao": created}


# ── Análise do fiscal (Will 08/09): o pedido do INSTALADOR não vai mais direto
# pro kanban de compras. Vira uma pendência (status=pendente, origem=instala,
# payload=form completo) que o fiscal da obra vê no verifica. Aprovar = o
# verifica chama o /criar-compra acima com o payload pré-preenchido (fluxo
# oficial, com aprovado_por = fiscal); recusar = motivo_recusa volta pro
# instalador via /minhas. O fluxo do FISCAL segue direto (compra-direta). ──

@app.post("/api/instala/material/para-analise")
def instala_material_para_analise(payload: InstalaMaterialCompraDiretaIn):
    """Instalador preenche o form de compras no Instala e o pedido fica
    PENDENTE aguardando o fiscal analisar no verifica. Nada de card de compras
    aqui: o payload inteiro fica guardado pro fiscal aprovar sem redigitar."""
    # Mesmas validações do fluxo oficial: erro claro ANTES de gravar a pendência,
    # senão o fiscal aprovaria um form que o gestão vai rejeitar.
    mats = [m for m in payload.materiais if (m.tipo or "").strip()]
    if not mats:
        raise HTTPException(422, "informe pelo menos um material")
    for m in mats:
        if not (m.justificativa or "").strip():
            raise HTTPException(422, f"justificativa obrigatória: {m.tipo}")
    if not (payload.prazo or "").strip():
        raise HTTPException(422, "informe o prazo")
    if not (payload.solicitante or "").strip():
        raise HTTPException(422, "informe o solicitante")
    # Resolve o card da obra: é por ele que o pedido cai na fila do fiscal certo
    # (details.fiscais do card). Sem projeto e sem ferramentas = 409, igual ao
    # compra-direta. Pedido de ferramentas pode não ter obra: fica visível a
    # qualquer fiscal na fila.
    card_obra = payload.card_id
    if not payload.ferramentas:
        if not payload.projeto_id:
            raise HTTPException(409, "escolha o projeto ou marque Ferramentas")
        if not card_obra:
            with conn() as c, c.cursor() as cur:
                cur.execute("SELECT card_id::text AS card_id FROM gestao.projetos WHERE id::text = %s",
                            (payload.projeto_id,))
                p = cur.fetchone()
            card_obra = (p or {}).get("card_id")
    # Resumo em texto pros lugares que só mostram itens (lista do fiscal e do app)
    itens = "\n".join(
        f"{(m.tipo or '').strip()}"
        + (f" · {m.quantidade}" if (m.quantidade or "").strip() else "")
        + (f" · {m.justificativa}" if (m.justificativa or "").strip() else "")
        for m in mats) or "(sem itens)"
    row = {
        "card_id": card_obra,
        "itens": itens,
        "foto_url": payload.foto_url,
        "origem": "instala",
        "prestador_id": payload.prestador_id,
        "prestador_nome": payload.prestador_nome,
        "client_key": payload.client_key,
        "status": "pendente",
        # Form completo pro fiscal aprovar sem redigitar (abre o modal do
        # verifica pré-preenchido a partir daqui)
        "payload": {
            "departamento": payload.departamento,
            "materiais": [m.model_dump() for m in payload.materiais],
            "prazo": payload.prazo,
            "solicitante": payload.solicitante,
            "pedido_por": payload.pedido_por,
            "setor": payload.setor,
            "obs": payload.obs,
            "ferramentas": payload.ferramentas,
            "projeto_id": payload.projeto_id,
        },
    }
    with _sb_client() as sbc:
        ja = _instala_dedup(sbc, "instala_material_solicitacoes", payload.client_key)
        if ja:
            return {"solicitacao": ja}
        r = sbc.post("/instala_material_solicitacoes", json=row,
                     headers={"Prefer": "return=representation"})
        _sb_raise(r, "instala_material_para_analise")
        created = r.json()[0]
    if card_obra:
        _instala_evento_gestao(card_obra, "instala_material",
                               f"Material pedido por {payload.prestador_nome or payload.solicitante} "
                               f"aguardando análise do fiscal: {itens[:80]}",
                               row | {"solicitacao_id": created["id"]})
    return {"solicitacao": created}


@app.get("/api/instala/material/analise")
def instala_material_analise(fiscal_id: str, limit: int = 60):
    """Fila de análise do fiscal no verifica: pedidos de instalador PENDENTES
    das obras onde ele é o fiscal (kanban_cards.details.fiscais, mesmo vínculo
    da vw_instala_minhas_obras). Pedido sem obra (ferramentas) aparece pra
    qualquer fiscal. Junta título/código da obra pro card da fila."""
    with _sb_client() as sbc:
        r = sbc.get("/instala_material_solicitacoes", params={
            "origem": "eq.instala", "status": "eq.pendente", "select": "*",
            "order": "created_at.desc", "limit": str(max(1, min(limit, 200)))})
        _sb_raise(r, "instala_material_analise")
        sols = r.json()
        card_ids = sorted({s["card_id"] for s in sols if s.get("card_id")})
        cards = {}
        if card_ids:
            rc = sbc.get("/kanban_cards", params={
                "id": f"in.({','.join(card_ids)})",
                "select": "id,title,obra,details"})
            if rc.status_code < 400:
                cards = {c["id"]: c for c in rc.json()}
    out = []
    for s in sols:
        card = cards.get(s.get("card_id"))
        if s.get("card_id") and not card:
            continue  # card sumiu/arquivado: não trava a fila de ninguém
        if card:
            fiscais = (card.get("details") or {}).get("fiscais") or []
            if not any(isinstance(f, dict) and str(f.get("id")) == str(fiscal_id)
                       for f in fiscais):
                continue
            s = s | {"obra_titulo": card.get("title"), "obra_code": card.get("obra")}
        out.append(s)
    return out


class InstalaMaterialRecusarIn(BaseModel):
    """Recusa do fiscal na análise: o motivo aparece na lista do instalador."""
    motivo: str = ""
    fiscal_nome: str = ""


@app.post("/api/instala/material/{sid}/recusar")
def instala_material_recusar(sid: str, payload: InstalaMaterialRecusarIn):
    """Fiscal recusa o pedido do instalador. atendida_por/atendida_em marcam
    quem decidiu e quando, igual à aprovação; motivo_recusa vai pro app."""
    with _sb_client() as sbc:
        r = sbc.get("/instala_material_solicitacoes", params={"id": f"eq.{sid}", "select": "id,status"})
        _sb_raise(r, "instala_material_recusar_get")
        rows = r.json()
        if not rows:
            raise HTTPException(404, "solicitação não encontrada")
        if rows[0].get("status") != "pendente":
            raise HTTPException(409, "solicitação já foi atendida/recusada")
        r = sbc.patch("/instala_material_solicitacoes", params={"id": f"eq.{sid}"},
                      json={"status": "recusada",
                            "motivo_recusa": (payload.motivo or "").strip() or None,
                            "atendida_por": (payload.fiscal_nome or "").strip() or "fiscal",
                            "atendida_em": datetime.now(timezone.utc).isoformat()},
                      headers={"Prefer": "return=representation"})
        _sb_raise(r, "instala_material_recusar")
        rows_upd = r.json()
    return {"solicitacao": rows_upd[0] if rows_upd else None}


@app.get("/api/instala/material/minhas")
def instala_material_minhas(fiscal_id: str | None = None, prestador_id: str | None = None,
                            limit: int = 60):
    """Solicitações de material de quem pediu, com o STATUS AO VIVO do card de
    compras (mesma leitura do painel gestao.parket.works/compras). O verifica não
    lê kanban_cards direto (RLS do anon), então a junção é feita aqui."""
    if not (fiscal_id or prestador_id):
        raise HTTPException(400, "informe fiscal_id ou prestador_id")
    col, val = ("fiscal_id", fiscal_id) if fiscal_id else ("prestador_id", prestador_id)
    with _sb_client() as sbc:
        r = sbc.get("/instala_material_solicitacoes", params={
            col: f"eq.{val}", "select": "*",
            "order": "created_at.desc", "limit": str(max(1, min(limit, 200)))})
        _sb_raise(r, "instala_material_minhas")
        sols = r.json()
        ids = [s["id"] for s in sols]
        cards = []
        if ids:
            rc = sbc.get("/kanban_cards", params={
                "dept_id": "in.(compras,compras-taiara,compras-marco)",
                "details->>material_solicitacao_id": f"in.({','.join(ids)})",
                "select": _COMPRAS_CARD_SELECT})
            if rc.status_code < 400:
                cards = rc.json()
    por_sol = {}
    for c in cards:
        por_sol[(c.get("details") or {}).get("material_solicitacao_id")] = _compras_card_to_sol(c)
    compras = list(por_sol.values())
    if compras:
        _compras_vincular_projetos(compras)
    for s in sols:
        s["compra"] = por_sol.get(s["id"])
    return sols


_COMPRAS_CARD_SELECT = "id,dept_id,column_id,title,parent_card_id,created_at,details"


def _compras_card_to_sol(card: dict) -> dict:
    d = card.get("details") or {}
    mats = d.get("materiais") or []
    if not mats and d.get("itens"):
        mats = [{"tipo": i, "quantidade": "", "justificativa": ""} for i in d["itens"]]
    return {
        "id": card["id"],
        "dept_id": card.get("dept_id"),
        "column_id": card.get("column_id"),
        "titulo": card.get("title"),
        "solicitante": d.get("solicitante") or d.get("pedido_por") or "",
        "departamento": d.get("departamento_compras"),
        "responsavel": d.get("responsavel_compras"),
        "data": d.get("data_solicitacao") or card.get("created_at"),
        "prazo": d.get("data_limite_entrega"),
        "materiais": mats,
        "obs": d.get("obs_solicitacao") or "",
        "status": d.get("status_solicitacao") or "pendente",
        "motivo": d.get("motivo_rejeicao"),
        "origem": d.get("origem"),
        "origem_nome": d.get("origem_nome"),
        "obra": d.get("projeto_vinculado"),
        "parent_card_id": card.get("parent_card_id"),
        "gestao_projeto_id": d.get("gestao_projeto_id"),
    }


def _compras_vincular_projetos(lst: list[dict]) -> None:
    """Preenche projeto_id/cliente/obra_code casando parent_card_id ou
    gestao_projeto_id com gestao.projetos; sem match, 'obra' fica no título do card pai."""
    parents = {s["parent_card_id"] for s in lst if s.get("parent_card_id")}
    pids = {s["gestao_projeto_id"] for s in lst if s.get("gestao_projeto_id")}
    by_card, by_pid = {}, {}
    if parents or pids:
        with conn() as c, c.cursor() as cur:
            cur.execute("""
                SELECT id::text AS id, card_id::text AS card_id, cliente, obra_code
                  FROM gestao.projetos
                 WHERE card_id::text = ANY(%s) OR id::text = ANY(%s)
            """, (list(parents), list(pids)))
            for p in cur.fetchall():
                by_pid[p["id"]] = p
                if p["card_id"]:
                    by_card[p["card_id"]] = p
    # títulos dos cards pai sem projeto no gestao (obra do Space)
    orfaos = {s["parent_card_id"] for s in lst
              if s.get("parent_card_id") and s["parent_card_id"] not in by_card and not s.get("obra")}
    titulos = {}
    if orfaos:
        try:
            with _sb_client() as sb:
                r = sb.get("/kanban_cards", params={
                    "id": f"in.({','.join(orfaos)})", "select": "id,title"})
                if r.status_code < 400:
                    titulos = {c2["id"]: c2.get("title") for c2 in r.json()}
        except Exception:
            log.warning("compras parent titles falhou")
    for s in lst:
        p = by_pid.get(s.get("gestao_projeto_id") or "") or by_card.get(s.get("parent_card_id") or "")
        if p:
            s["projeto_id"] = p["id"]
            s["cliente"] = p["cliente"]
            s["obra_code"] = p["obra_code"]
            s.setdefault("obra", None)
        elif not s.get("obra"):
            s["obra"] = titulos.get(s.get("parent_card_id") or "")
        s.pop("gestao_projeto_id", None)


@app.get("/api/solicitacoes-compras")
def solicitacao_compras_all():
    """Todas as solicitações de compras — lidas ao vivo do kanban do Cloud
    (inclui as criadas pelo Space/acompanhamento, não só as do gestao)."""
    with _sb_client() as sb:
        r = sb.get("/kanban_cards", params={
            "dept_id": "in.(compras,compras-taiara,compras-marco)",
            "select": _COMPRAS_CARD_SELECT,
            "order": "created_at.desc", "limit": "500"})
        _sb_raise(r, "solicitacao_compras_all")
        lst = [_compras_card_to_sol(c) for c in r.json()]
    _compras_vincular_projetos(lst)
    return lst


@app.get("/api/projetos/{pid}/solicitacoes-compras")
def solicitacao_compras_list(pid: str):
    """Solicitações do projeto, lidas ao vivo do kanban do Cloud: cards com
    parent_card_id = card do projeto no Space OU details.gestao_projeto_id = pid."""
    with conn() as c, c.cursor() as cur:
        cur.execute("SELECT card_id::text AS card_id, cliente, obra_code FROM gestao.projetos WHERE id::text = %s", (pid,))
        projeto = cur.fetchone()
    if not projeto:
        raise HTTPException(404, "projeto não encontrado")
    ors = [f"details->>gestao_projeto_id.eq.{pid}"]
    if projeto.get("card_id"):
        ors.append(f"parent_card_id.eq.{projeto['card_id']}")
    with _sb_client() as sb:
        r = sb.get("/kanban_cards", params={
            "dept_id": "in.(compras,compras-taiara,compras-marco)",
            "or": f"({','.join(ors)})",
            "select": _COMPRAS_CARD_SELECT,
            "order": "created_at.desc", "limit": "200"})
        _sb_raise(r, "solicitacao_compras_list")
        lst = [_compras_card_to_sol(c) for c in r.json()]
    for s in lst:
        s["projeto_id"] = pid
        s["cliente"] = projeto["cliente"]
        s["obra_code"] = projeto["obra_code"]
        s.pop("gestao_projeto_id", None)
    return lst


# ─── LINK PÚBLICO (sem auth — token é a credencial) ────────────

@app.get("/api/publico/obra/{token}")
def publico_obra(token: str):
    """Relatório read-only do acompanhamento — consumido por /obra/<token>.
    Não expõe valores financeiros nem o meta bruto dos itens."""
    with conn() as c, c.cursor() as cur:
        cur.execute("SELECT projeto_id::text AS pid FROM gestao.obra_acompanhamento WHERE share_token = %s",
                    (token,))
        row = cur.fetchone()
        if not row:
            raise HTTPException(404, "link não encontrado ou revogado")
        pid = row["pid"]
        cur.execute("""
            SELECT id::text, cliente, endereco, obra_code, numero_proposta,
                   vendedor, gestor_email, status
              FROM gestao.projetos WHERE id::text = %s
        """, (pid,))
        projeto = cur.fetchone()
        cur.execute("""
            SELECT id, ordem, categoria, descritivo, ambiente, quantidade, unidade,
                   status, responsavel, previsao_inicio, previsao_fim,
                   jsonb_build_object('obra', meta->'obra', 'codigo', meta->>'codigo',
                                      'produto_header', meta->>'produto_header',
                                      'categoria_raiz', meta->>'categoria_raiz') AS meta
              FROM gestao.itens WHERE projeto_id::text = %s ORDER BY ordem
        """, (pid,))
        itens = cur.fetchall()
        cur.execute("""
            SELECT id, item_id, url, legenda, ambiente, categoria, tipo, ordem, created_at
              FROM gestao.fotos WHERE projeto_id::text = %s ORDER BY ordem, created_at
        """, (pid,))
        fotos = cur.fetchall()
    acomp = _acomp_get(pid)
    acomp.pop("share_token", None)
    try:
        prestadores = [
            {"nome": p.get("nome"), "telefone": p.get("telefone"), "categoria": p.get("categoria")}
            for p in projeto_prestadores(pid)
        ]
    except Exception:
        prestadores = []
    return {"projeto": projeto, "acompanhamento": acomp, "itens": itens,
            "fotos": fotos, "prestadores": prestadores}


# ═══════════════════════════════════════════════════════════════════
# CENTRAL DO CLIENTE — center.parket.works
# Painel público (token por projeto em projetos.meta.center_token) que
# espelha a jornada do gestão: kanban, 9 etapas, cronograma, documentos,
# laudos (com link de assinatura) e avaliação da experiência.
# ═══════════════════════════════════════════════════════════════════

def _center_user_from_cliente(cliente: str) -> str:
    """Login do cliente = nome e sobrenome (duas primeiras palavras)."""
    palavras = [p for p in (cliente or "").strip().split() if p]
    return " ".join(w.capitalize() for w in palavras[:2]) or "Cliente"


def _center_norm(s: str) -> str:
    """Compara login de forma tolerante: caixa, acento, pontos e espaços."""
    s = _ud.normalize("NFKD", s or "").encode("ascii", "ignore").decode()
    return " ".join(s.lower().replace(".", " ").split())


def _center_provision(cur, pid: str) -> dict:
    """Garante token + usuário da Central em projetos.meta.
    NUNCA gera center_senha — Will 23/07 e 17/08: o link abre direto, sem login."""
    cur.execute("SELECT cliente, meta FROM gestao.projetos WHERE id::text = %s", (pid,))
    row = cur.fetchone()
    if not row:
        raise HTTPException(404, "projeto não encontrado")
    meta = row["meta"] or {}
    novos: dict = {}
    if not (meta.get("center_token") or "").strip():
        novos["center_token"] = secrets.token_urlsafe(18)
    if not (meta.get("center_user") or "").strip():
        novos["center_user"] = _center_user_from_cliente(row["cliente"])
    if novos:
        cur.execute("""
            UPDATE gestao.projetos
               SET meta = COALESCE(meta,'{}'::jsonb) || %s::jsonb, updated_at = now()
             WHERE id::text = %s
        """, (json.dumps(novos), pid))
        meta.update(novos)
    return meta


@app.post("/api/gestao/projetos/{pid}/center-link")
def gestao_center_link(pid: str):
    """Gera (ou reusa) o link do cliente à Central — sem login, abre direto."""
    with conn() as c, c.cursor() as cur:
        meta = _center_provision(cur, pid)
    return {
        "token": meta["center_token"],
        "url": f"https://center.parket.works/{meta['center_token']}",
    }


@app.get("/api/instala/cronograma-link/{card_id}")
def instala_cronograma_link(card_id: str):
    """Cronograma no app de campo (menu do Instala) = a MESMA página que o
    cliente vê na Central (center.parket.works/<token>/cronograma). Resolve o
    projeto do gestão pelo card do Cloud e garante o token via
    _center_provision (gera na primeira vez, sem senha)."""
    with conn() as c, c.cursor() as cur:
        # updated_at DESC: se sobrou duplicata pós-merge, fica com o projeto vivo
        cur.execute("""
            SELECT id::text FROM gestao.projetos
             WHERE card_id::text = %s
             ORDER BY updated_at DESC NULLS LAST
             LIMIT 1
        """, (card_id,))
        row = cur.fetchone()
        if not row:
            raise HTTPException(404, "obra ainda sem projeto no gestão")
        meta = _center_provision(cur, row["id"])
    return {"url": f"https://center.parket.works/{meta['center_token']}/cronograma"}


def _center_projeto(token: str, center_key: str | None = None) -> dict:
    """Token urlsafe(24) é a única chave — nunca exigir senha (Will 23/07 e 17/08).
    center_key é aceito e ignorado (SPAs antigos ainda mandam X-Center-Key)."""
    with conn() as c, c.cursor() as cur:
        cur.execute("""
            SELECT id::text, card_id::text, cliente, endereco, numero_proposta,
                   vendedor, arquiteto, status, etapa_atual, column_id,
                   assinado_em, iniciado_em, entregue_em, updated_at, created_at
              FROM gestao.projetos
             WHERE meta->>'center_token' = %s
             LIMIT 1
        """, (token,))
        row = cur.fetchone()
    if not row:
        raise HTTPException(404, "link não encontrado ou revogado")
    return row


def _center_grupo_link(pid: str, card_id: str | None) -> str | None:
    """Link de convite do grupo WhatsApp do projeto (chat.whatsapp.com/...).
    Cacheado em projetos.meta.grupo_invite por jid — só bate na Evolution
    quando o grupo muda ou ainda não há cache. Falha nunca derruba o center."""
    if not card_id:
        return None
    try:
        grupo_jid = None
        instance = CS_INSTANCE_DEFAULT
        with _sb_client() as sb:
            r = sb.get("/atendimento_conversas", params={
                "select": "grupo_jid,instance_name",
                "card_id": f"eq.{card_id}",
                "order": "last_msg_at.desc.nullslast",
                "limit": "1",
            })
            if r.status_code < 400 and r.json():
                grupo_jid = r.json()[0].get("grupo_jid")
                instance = r.json()[0].get("instance_name") or CS_INSTANCE_DEFAULT
        if not grupo_jid or "@g.us" not in grupo_jid:
            return None

        with conn() as c, c.cursor() as cur:
            cur.execute("SELECT meta->'grupo_invite' AS gi FROM gestao.projetos WHERE id=%s", (pid,))
            row = cur.fetchone()
            gi = (row or {}).get("gi") or {}
            if gi.get("jid") == grupo_jid and gi.get("link"):
                return gi["link"]

        from urllib.parse import quote
        with httpx.Client(timeout=8.0) as ev:
            r = ev.get(f"{EVOLUTION_URL}/group/inviteCode/{quote(instance, safe='')}",
                       params={"groupJid": grupo_jid},
                       headers={"apikey": EVOLUTION_APIKEY})
            if r.status_code >= 400:
                return None
            data = r.json()
        link = data.get("inviteUrl") or (
            f"https://chat.whatsapp.com/{data['inviteCode']}" if data.get("inviteCode") else None)
        if link:
            with conn() as c, c.cursor() as cur:
                cur.execute("""
                    UPDATE gestao.projetos
                       SET meta = COALESCE(meta,'{}'::jsonb) || jsonb_build_object('grupo_invite',
                                  jsonb_build_object('jid', %s::text, 'link', %s::text))
                     WHERE id=%s
                """, (grupo_jid, link, pid))
        return link
    except Exception:
        log.warning("center_grupo_link_fail pid=%s", pid, exc_info=True)
        return None


CENTER_SIGN_TIPOS = {"termo", "entrega", "2vistoria"}

# Campos top-level do fiscal_laudos exibidos no painel do cliente
CENTER_LAUDO_CAMPOS = [
    "cliente", "obra", "endereco",
    "setor", "descritivo_sistema", "descritivo_material", "servicos_inclusos",
    "medicao_obra", "observacoes", "ocorrencias", "materiais_falta",
    "insumos_falta", "metragem_areas", "obs_andaime", "tipo_laje",
    "reforco_necessario", "insumos_necessarios", "sistema_instalacao",
    "materiais_necessarios", "resultado",
]
CENTER_LAUDO_CHECKLISTS = [
    "checklist_piso", "checklist_deck", "checklist_forro", "checklist_painel",
    "checklist_liberacao", "checklist_equipe", "checklist_produtividade",
    "checklist_reparo", "checklist_entrega", "checklist_extra",
    "checklist_escada", "checklist_porta", "checklist_bancos",
]


class CenterLogin(BaseModel):
    usuario: str
    senha: str


@app.post("/api/publico/center/{token}/login")
def publico_center_login(token: str, payload: CenterLogin):
    """Login do cliente na Central: nome e sobrenome + senha única do projeto."""
    with conn() as c, c.cursor() as cur:
        cur.execute("""
            SELECT meta->>'center_user' AS usuario, meta->>'center_senha' AS senha
              FROM gestao.projetos WHERE meta->>'center_token' = %s LIMIT 1
        """, (token,))
        row = cur.fetchone()
    if not row:
        raise HTTPException(404, "link não encontrado ou revogado")
    senha = (row["senha"] or "").strip()
    if not senha:  # projeto antigo sem credenciais — acesso direto
        return {"ok": True, "key": "", "nome": row["usuario"] or ""}
    if (_center_norm(payload.usuario) != _center_norm(row["usuario"] or "")
            or not secrets.compare_digest(senha, payload.senha.strip())):
        raise HTTPException(401, "usuário ou senha inválidos")
    return {"ok": True, "key": senha, "nome": row["usuario"] or ""}


@app.get("/api/publico/center/{token}")
def publico_center(token: str, x_center_key: str | None = Header(default=None)):
    """Payload agregado da Central do Cliente — sem valores financeiros."""
    projeto = _center_projeto(token, x_center_key)
    pid = projeto["id"]
    card_id = projeto.pop("card_id", None)
    projeto["grupo_link"] = _center_grupo_link(pid, card_id)

    with conn() as c, c.cursor() as cur:
        cur.execute("SELECT id, titulo, cor, ordem FROM gestao.colunas_kanban ORDER BY ordem")
        kanban_cols = cur.fetchall()

        cur.execute("""
            SELECT ec.numero, ec.slug, ec.categoria, ec.titulo, ec.subtitulo, ec.descricao,
                   COALESCE(pe.status, 'pendente') AS status,
                   pe.iniciada_em, pe.concluida_em, pe.observacoes, pe.meta
              FROM gestao.etapas_catalogo ec
              LEFT JOIN gestao.projeto_etapas pe
                ON pe.etapa_numero = ec.numero AND pe.projeto_id::text = %s
             ORDER BY ec.numero
        """, (pid,))
        etapas = cur.fetchall()

        cur.execute("""
            SELECT id, ordem, categoria, descritivo, ambiente, quantidade, unidade,
                   status, previsao_inicio, previsao_fim,
                   jsonb_build_object('obra', meta->'obra', 'codigo', meta->>'codigo',
                                      'produto_header', meta->>'produto_header',
                                      'categoria_raiz', meta->>'categoria_raiz',
                                      'descricao_extra', meta->>'descricao_extra') AS meta
              FROM gestao.itens WHERE projeto_id::text = %s ORDER BY ordem
        """, (pid,))
        itens = cur.fetchall()

        cur.execute("""
            SELECT id, etapa_numero, slug, titulo, arquivo_url, content_type,
                   nome_arquivo, created_at,
                   COALESCE(meta->'paginas', '[]'::jsonb) AS paginas
              FROM gestao.documentos
             WHERE projeto_id::text = %s AND arquivo_url IS NOT NULL
             ORDER BY created_at DESC
        """, (pid,))
        documentos = cur.fetchall()

        # Fotos da obra curadas no gestão (fiscal + instalador) pro cliente ver
        cur.execute("""
            SELECT f.id, f.url, f.legenda, f.ambiente, f.tipo, f.origem,
                   f.item_id, f.ordem, f.created_at,
                   i.categoria AS item_categoria, i.descritivo AS item_descritivo,
                   i.ambiente AS item_ambiente, i.meta->>'codigo' AS item_codigo,
                   COALESCE(i.meta->>'produto_header', i.meta->>'categoria_raiz') AS item_produto
              FROM gestao.fotos f
              LEFT JOIN gestao.itens i ON i.id = f.item_id
             WHERE f.projeto_id::text = %s AND f.center_visivel
             ORDER BY f.ordem, f.created_at
        """, (pid,))
        fotos_obra = cur.fetchall()

    laudos: list[dict] = []
    if card_id:
        with _sb_client() as sb:
            r = sb.get("/fiscal_laudos", params=[
                ("select", "id,tipo,status,data_vistoria,fiscal_nome,created_at,relatorio_dados,"
                           + ",".join(CENTER_LAUDO_CAMPOS) + "," + ",".join(CENTER_LAUDO_CHECKLISTS)),
                ("card_id", f"eq.{card_id}"),
                ("order", "data_vistoria.desc.nullslast,created_at.desc"),
            ])
            _sb_raise(r, "center.laudos")
            for l in r.json():
                rd = l.get("relatorio_dados") or {}
                termo = rd.get("termo") or {}
                sign_token = rd.get("sign_token")
                assinado = bool(termo.get("resp_ass"))
                # Laudo que precisa de ciência do cliente ganha link automático
                if not sign_token and not assinado and l.get("tipo") in CENTER_SIGN_TIPOS:
                    try:
                        sign_token = secrets.token_urlsafe(24)
                        rd["sign_token"] = sign_token
                        pr = sb.patch("/fiscal_laudos", params={"id": f"eq.{l['id']}"},
                                      json={"relatorio_dados": rd})
                        _sb_raise(pr, "center.sign_token")
                    except Exception:
                        sign_token = None
                laudos.append({
                    "id": l["id"], "tipo": l.get("tipo"), "status": l.get("status"),
                    "data_vistoria": l.get("data_vistoria"), "fiscal_nome": l.get("fiscal_nome"),
                    "created_at": l.get("created_at"),
                    "condicao": termo.get("condicao") or "",
                    "assinado": assinado,
                    "assinado_por": termo.get("resp_obra") or "",
                    "assinado_em": termo.get("assinado_em"),
                    "assinar_url": f"https://gestao.parket.works/assinar/{sign_token}" if sign_token else None,
                    "pdf_url": f"https://verifica.parket.works/laudo.html?id={l['id']}",
                    # Conteúdo do relatório pra renderizar direto no painel (sem abrir PDF)
                    "conteudo": {
                        **{
                            k: rd[k]
                            for k in ("descricao_produto", "medicao_itens", "servico_contratado",
                                      "entradas", "relatorio_numero", "relatorio_data",
                                      "responsavel", "vendedor")
                            if rd.get(k) not in (None, "", [], {})
                        },
                        **{
                            k: l[k]
                            for k in CENTER_LAUDO_CAMPOS
                            if l.get(k) not in (None, "", [], {})
                        },
                        **({"checklists": cks} if (cks := {
                            k.removeprefix("checklist_"): l[k]
                            for k in CENTER_LAUDO_CHECKLISTS
                            if l.get(k) not in (None, "", [], {})
                        }) else {}),
                    },
                })

            # Fotos dos laudos (mesmo registro fotográfico do PDF)
            if laudos:
                fr = sb.get("/fiscal_fotos", params=[
                    ("select", "laudo_id,tipo,servico,ambiente,descricao,url"),
                    ("laudo_id", f"in.({','.join(str(x['id']) for x in laudos)})"),
                    ("order", "created_at.asc"),
                ])
                _sb_raise(fr, "center.fotos")
                fotos_por_laudo: dict[str, list] = {}
                for f in fr.json():
                    if not f.get("url"):
                        continue
                    fotos_por_laudo.setdefault(str(f["laudo_id"]), []).append({
                        "tipo": f.get("tipo"), "servico": f.get("servico"),
                        "ambiente": f.get("ambiente"), "descricao": f.get("descricao"),
                        "url": f["url"],
                    })
                for x in laudos:
                    x["fotos"] = fotos_por_laudo.get(str(x["id"]), [])

    avaliacao = None
    for e in etapas:
        if e["numero"] == 10 and e.get("meta"):
            avaliacao = (e["meta"] or {}).get("avaliacao")

    # Mapeamento publicado pelo Status (Imprimir → páginas-imagem no card)
    mapa_print = None
    if card_id:
        try:
            with _sb_client() as sb:
                r = sb.get("/kanban_cards", params={
                    "select": "details->mapa_status->print",
                    "id": f"eq.{card_id}",
                    "limit": "1",
                })
                if r.status_code < 400 and r.json():
                    mapa_print = r.json()[0].get("print") or None
        except Exception:
            log.warning("center_mapa_print_fail pid=%s", pid, exc_info=True)

    # ── INSTALADOR — feed + ocorrências + conferências (Cloud) ─────────
    # Fluxo instala.parket.works → center: cliente vê progresso da obra em
    # tempo real (check-in do instalador, ocorrências fotografadas, conferência
    # de material). Sem isso, o center só mostrava dados do fiscal.
    feed_instalador: list[dict] = []
    ocorrencias_instalador: list[dict] = []
    conferencias_instalador: list[dict] = []
    if card_id:
        try:
            with _sb_client() as sb:
                fr = sb.get("/instala_updates_cliente", params=[
                    ("select", "id,kind,titulo,detalhe,foto_url,payload,created_at"),
                    ("card_id", f"eq.{card_id}"),
                    ("order", "created_at.desc"),
                    ("limit", "100"),
                ])
                if fr.status_code < 400:
                    feed_instalador = fr.json()
                orc = sb.get("/instala_ocorrencias", params=[
                    ("select", "id,tipo,descricao,foto_url,audio_url,status,resolvida_em,created_at,prestador_nome"),
                    ("card_id", f"eq.{card_id}"),
                    ("order", "created_at.desc"),
                ])
                if orc.status_code < 400:
                    ocorrencias_instalador = orc.json()
                cnf = sb.get("/instala_conferencias", params=[
                    ("select", "id,item_nome,volume,status,foto_url,obs,created_at,prestador_nome"),
                    ("card_id", f"eq.{card_id}"),
                    ("order", "created_at.desc"),
                    ("limit", "200"),
                ])
                if cnf.status_code < 400:
                    conferencias_instalador = cnf.json()
        except Exception:
            log.warning("center_instala_fail pid=%s", pid, exc_info=True)

    # ── FOTOS DA OBRA — curadas (center_visivel=true) ─────────────────
    # Gestor marca fotos como públicas em gestao.fotos.center_visivel; só
    # essas vão pro cliente. Task #1466: fotos com ambiente+material.
    fotos_obra: list[dict] = []
    with conn() as c, c.cursor() as cur:
        cur.execute("""
            SELECT id, url, legenda, ambiente, categoria, tipo, origem, ordem, created_at
              FROM gestao.fotos
             WHERE projeto_id::text = %s AND center_visivel = true AND url IS NOT NULL
             ORDER BY ordem NULLS LAST, created_at DESC
        """, (pid,))
        fotos_obra = cur.fetchall()

    # ── ANDAMENTO — % agregado (etapas + itens instalados) ─────────────
    # Combina: % etapas concluídas + % itens em status=entregue/instalado.
    # Cliente vê barra única, sem detalhes financeiros.
    pct_etapas = 0
    pct_itens = 0
    if etapas:
        conc = sum(1 for e in etapas if e.get("status") in ("concluida","concluído","concluído","concluido"))
        pct_etapas = int(100 * conc / len(etapas)) if etapas else 0
    if itens:
        instal = sum(1 for i in itens if i.get("status") in ("instalado","entregue","concluido","concluído"))
        pct_itens = int(100 * instal / len(itens)) if itens else 0
    andamento = {
        "pct_etapas": pct_etapas,
        "pct_itens": pct_itens,
        "pct_geral": int((pct_etapas + pct_itens) / 2) if (etapas or itens) else 0,
        "ultima_atividade": feed_instalador[0]["created_at"] if feed_instalador else None,
    }

    return {
        "projeto": projeto,
        "kanban": {"colunas": kanban_cols, "atual": projeto.get("column_id")},
        "etapas": etapas,
        "itens": itens,
        "documentos": documentos,
        "fotos_obra": fotos_obra,
        "laudos": laudos,
        "mapa": mapa_print,
        "avaliacao": avaliacao,
        "feed_instalador": feed_instalador,
        "ocorrencias_instalador": ocorrencias_instalador,
        "conferencias_instalador": conferencias_instalador,
        "fotos_obra": fotos_obra,
        "andamento": andamento,
    }


class CenterAvaliacao(BaseModel):
    notas: dict
    comentario: str | None = None
    nome: str | None = None


def _gravar_avaliacao(projeto_id: str, payload: CenterAvaliacao) -> dict:
    notas = {k: int(v) for k, v in (payload.notas or {}).items()
             if isinstance(v, (int, float)) and 1 <= int(v) <= 5}
    if not notas:
        raise HTTPException(400, "notas obrigatórias (1 a 5)")
    aval = {
        "notas": notas,
        "comentario": (payload.comentario or "").strip()[:2000],
        "nome": (payload.nome or "").strip()[:200],
        "enviada_em": datetime.now(timezone.utc).isoformat(),
    }
    with conn() as c, c.cursor() as cur:
        cur.execute("""
            SELECT meta FROM gestao.projeto_etapas
             WHERE projeto_id::text = %s AND etapa_numero = 10
        """, (projeto_id,))
        row = cur.fetchone()
        if row and (row["meta"] or {}).get("avaliacao"):
            raise HTTPException(409, "avaliação já enviada")
        cur.execute("""
            INSERT INTO gestao.projeto_etapas (projeto_id, etapa_numero, status, concluida_em, meta, updated_at)
            VALUES (%s::uuid, 10, 'concluida', now(), jsonb_build_object('avaliacao', %s::jsonb), now())
            ON CONFLICT (projeto_id, etapa_numero) DO UPDATE
               SET status = 'concluida', concluida_em = now(),
                   meta = jsonb_set(COALESCE(gestao.projeto_etapas.meta,'{}'::jsonb), '{avaliacao}', %s::jsonb),
                   updated_at = now()
        """, (projeto_id, json.dumps(aval), json.dumps(aval)))
    return {"ok": True}


@app.post("/api/publico/center/{token}/avaliacao")
def publico_center_avaliacao(token: str, payload: CenterAvaliacao,
                             x_center_key: str | None = Header(default=None)):
    projeto = _center_projeto(token, x_center_key)
    return _gravar_avaliacao(str(projeto["id"]), payload)


@app.post("/api/publico/laudo-assinatura/{token}/avaliacao")
def publico_laudo_avaliacao(token: str, payload: CenterAvaliacao):
    """Pesquisa de satisfação na página do termo de entrega — o cliente
    assina e avalia no mesmo lugar. Só libera depois da assinatura."""
    with _sb_client() as sb:
        l = _laudo_by_sign_token(sb, token)
    if l.get("tipo") != "entrega":
        raise HTTPException(400, "avaliação disponível apenas no termo de entrega")
    if not ((l.get("relatorio_dados") or {}).get("termo") or {}).get("resp_ass"):
        raise HTTPException(409, "assine o termo antes de avaliar")
    with conn() as c, c.cursor() as cur:
        cur.execute("SELECT id FROM gestao.projetos WHERE card_id::text = %s LIMIT 1",
                    (l.get("card_id"),))
        row = cur.fetchone()
    if not row:
        raise HTTPException(404, "projeto não encontrado")
    return _gravar_avaliacao(str(row["id"]), payload)


# ─── CENTER · Checklist de Início de Obras validado pelo cliente ─────────
# Responsabilidade do cliente (ou engenheiro/arquiteto/gestor da obra):
# cada item exige FOTO comprovando o OK → status vira "revisado". Itens não
# concluídos só podem seguir mediante termo de responsabilidade assinado.
# Estado em gestao.projeto_etapas.meta.checklist_cliente (etapa 3).

CENTER_PAPEIS = {"cliente", "engenheiro", "arquiteto", "gestor"}


def _checklist_cliente_merge(cur, pid: str, mutate) -> dict:
    """Lê meta.checklist_cliente da etapa 3 com lock, aplica mutate(cc) e grava."""
    cur.execute("""
        INSERT INTO gestao.projeto_etapas (projeto_id, etapa_numero, status)
        VALUES (%s::uuid, 3, 'em_andamento')
        ON CONFLICT (projeto_id, etapa_numero) DO NOTHING
    """, (pid,))
    cur.execute("""
        SELECT meta FROM gestao.projeto_etapas
         WHERE projeto_id::text = %s AND etapa_numero = 3 FOR UPDATE
    """, (pid,))
    meta = (cur.fetchone() or {}).get("meta") or {}
    cc = meta.get("checklist_cliente") or {}
    mutate(cc)
    cur.execute("""
        UPDATE gestao.projeto_etapas
           SET meta = jsonb_set(COALESCE(meta,'{}'::jsonb), '{checklist_cliente}', %s::jsonb, true),
               updated_at = now()
         WHERE projeto_id::text = %s AND etapa_numero = 3
    """, (json.dumps(cc), pid))
    return cc


CENTER_CK_STATUS = {"pendente", "em_execucao", "concluido"}


@app.post("/api/publico/center/{token}/checklist/item")
async def publico_center_checklist_item(
    token: str,
    file: UploadFile | None = File(default=None),
    servico: str = Form(...),
    pergunta: str = Form(...),
    nome: str = Form(...),
    papel: str = Form(...),
    status: str = Form(default=""),
    obs: str = Form(default=""),
    previsao: str = Form(default=""),
    x_center_key: str | None = Header(default=None),
):
    """Validação de item pelo cliente: status Pendente/Em execução/Concluído
    (+ data de previsão quando em execução) + observação, foto opcional em
    qualquer status. Merge incremental por item."""
    projeto = _center_projeto(token, x_center_key)
    pid = projeto["id"]
    nome = (nome or "").strip()[:120]
    papel = (papel or "").strip().lower()
    servico = (servico or "").strip()[:40]
    pergunta = (pergunta or "").strip()[:300]
    status = (status or "").strip().lower()
    obs = (obs or "").strip()[:1000]
    previsao = (previsao or "").strip()[:10]
    if not nome or papel not in CENTER_PAPEIS:
        raise HTTPException(400, "identifique-se: nome e papel (cliente, engenheiro, arquiteto ou gestor)")
    if not servico or not pergunta:
        raise HTTPException(400, "servico e pergunta obrigatórios")
    if status and status not in CENTER_CK_STATUS:
        raise HTTPException(400, "status deve ser pendente, em_execucao ou concluido")
    if previsao:
        try:
            date.fromisoformat(previsao)
        except ValueError:
            raise HTTPException(400, "previsao deve ser YYYY-MM-DD")
    if not status and not obs and not previsao and not (file and file.filename):
        raise HTTPException(400, "nada a salvar — envie status, previsão, observação ou foto")

    foto_url = None
    if file and file.filename:
        fname = file.filename or ""
        ext = fname.rsplit(".", 1)[-1].lower() if "." in fname else "jpg"
        if ext in _VIDEO_EXT or ext not in _MEDIA_EXT:
            raise HTTPException(400, "envie uma foto (jpg, png, webp, heic…)")
        data = await file.read()
        if len(data) > 25 * 1024 * 1024:
            raise HTTPException(400, "foto acima de 25MB")
        rand = "".join(random.choices(string.ascii_lowercase + string.digits, k=6))
        path = f"center-checklist/{pid}/{int(time.time() * 1000)}_{rand}.{ext}"
        with _storage_client() as st:
            r = st.post(f"/object/{STORAGE_BUCKET}/{path}", content=data,
                        headers={"Content-Type": file.content_type or "application/octet-stream",
                                 "x-upsert": "true"})
            if r.status_code >= 400:
                log.warning("center_checklist_upload_fail pid=%s %s %s", pid, r.status_code, r.text[:200])
                raise HTTPException(502, "falha ao enviar a foto — tente novamente")
        foto_url = f"{SUPABASE_URL}/storage/v1/object/public/{STORAGE_BUCKET}/{path}"

    chave = f"{servico}|{pergunta}"
    novo = {"por": nome, "papel": papel, "em": datetime.now(timezone.utc).isoformat()}
    if status:
        novo["status"] = status
    if obs:
        novo["obs"] = obs
    if previsao:
        novo["previsao"] = previsao
    if foto_url:
        novo["foto_url"] = foto_url
    merged: dict = {}
    with conn() as c, c.cursor() as cur:
        def mutate(cc: dict):
            entry = cc.setdefault("itens", {}).setdefault(chave, {})
            entry.update(novo)
            # Concluído não carrega previsão — o campo volta a ficar em branco.
            if novo.get("status") == "concluido":
                entry.pop("previsao", None)
            merged.update(entry)
        _checklist_cliente_merge(cur, pid, mutate)
    return {"ok": True, "chave": chave, "item": merged}


class CenterChecklistTermo(BaseModel):
    servico: str
    nome: str
    papel: str
    obs: str = ""
    itens_pendentes: list[str] = []
    aceite: bool = False


@app.post("/api/publico/center/{token}/checklist/termo")
def publico_center_checklist_termo(token: str, payload: CenterChecklistTermo,
                                   x_center_key: str | None = Header(default=None)):
    """Assinatura de conclusão do checklist POR SERVIÇO (piso, forro, deck…),
    gravada em cc.termos[servico]."""
    projeto = _center_projeto(token, x_center_key)
    pid = projeto["id"]
    servico = (payload.servico or "").strip().lower()[:40]
    nome = (payload.nome or "").strip()[:120]
    papel = (payload.papel or "").strip().lower()
    if not payload.aceite:
        raise HTTPException(400, "é necessário aceitar o termo")
    if not servico:
        raise HTTPException(400, "servico obrigatório")
    if not nome or papel not in CENTER_PAPEIS:
        raise HTTPException(400, "identifique-se: nome e papel (cliente, engenheiro, arquiteto ou gestor)")
    termo = {
        "nome": nome, "papel": papel,
        "itens_pendentes": [str(i)[:300] for i in (payload.itens_pendentes or [])][:300],
        "assinado_em": datetime.now(timezone.utc).isoformat(),
    }
    obs = (payload.obs or "").strip()[:1000]
    if obs:
        termo["obs"] = obs
    with conn() as c, c.cursor() as cur:
        def mutate(cc: dict):
            termos = cc.setdefault("termos", {})
            if termos.get(servico):
                raise HTTPException(409, "checklist deste serviço já assinado")
            termos[servico] = termo
        _checklist_cliente_merge(cur, pid, mutate)
        cur.execute("""
            INSERT INTO gestao.eventos (projeto_id, tipo, titulo, autor_email, payload)
            VALUES (%s, 'observacao', %s, %s, %s::jsonb)
        """, (pid, f"Checklist de {servico} assinado pelo cliente",
              f"center:{nome}", json.dumps({**termo, "servico": servico})))
    return {"ok": True, "servico": servico, "termo": termo}


# ── Definições (etapa 12): upload de arquivos pelo cliente ──────────────────

_DEFINICOES_EXT = {"pdf", "jpg", "jpeg", "png", "webp", "heic", "gif",
                   "dwg", "dxf", "skp", "doc", "docx", "xls", "xlsx",
                   "ppt", "pptx", "txt", "zip", "rar"}


@app.post("/api/publico/center/{token}/definicoes/arquivo")
async def publico_center_definicoes_arquivo(
    token: str,
    file: UploadFile = File(...),
    nome: str = Form(default=""),
    x_center_key: str | None = Header(default=None),
):
    """Cliente anexa arquivo na página Definições. Vai pro storage público e
    entra em projeto_etapas etapa 12 meta.definicoes.arquivos."""
    projeto = _center_projeto(token, x_center_key)
    pid = projeto["id"]
    fname = (file.filename or "").strip()
    if not fname:
        raise HTTPException(400, "arquivo obrigatório")
    ext = fname.rsplit(".", 1)[-1].lower() if "." in fname else ""
    if ext not in _DEFINICOES_EXT:
        raise HTTPException(400, f"formato .{ext or '?'} não aceito")
    data = await file.read()
    if len(data) > 50 * 1024 * 1024:
        raise HTTPException(400, "arquivo acima de 50MB")
    rand = "".join(random.choices(string.ascii_lowercase + string.digits, k=6))
    safe = re.sub(r"[^A-Za-z0-9._-]+", "_", fname)[:80]
    path = f"center-definicoes/{pid}/{int(time.time() * 1000)}_{rand}_{safe}"
    with _storage_client() as st:
        r = st.post(f"/object/{STORAGE_BUCKET}/{path}", content=data,
                    headers={"Content-Type": file.content_type or "application/octet-stream",
                             "x-upsert": "true"})
        if r.status_code >= 400:
            log.warning("center_definicoes_upload_fail pid=%s %s %s", pid, r.status_code, r.text[:200])
            raise HTTPException(502, "falha ao enviar o arquivo — tente novamente")
    arquivo = {
        "nome_arquivo": fname[:120],
        "url": f"{SUPABASE_URL}/storage/v1/object/public/{STORAGE_BUCKET}/{path}",
        "content_type": file.content_type or "",
        "por": (nome or "").strip()[:120],
        "em": datetime.now(timezone.utc).isoformat(),
    }
    with conn() as c, c.cursor() as cur:
        def mutate(defs: dict):
            arquivos = defs.get("arquivos") or []
            arquivos.append(arquivo)
            defs["arquivos"] = arquivos[-100:]
        _definicoes_merge(cur, pid, mutate)
    return {"ok": True, "arquivo": arquivo}


def _definicoes_merge(cur, pid: str, mutate) -> dict:
    """Lê meta.definicoes da etapa 12 com lock, aplica mutate(defs) e grava."""
    cur.execute("""
        INSERT INTO gestao.projeto_etapas (projeto_id, etapa_numero, status)
        VALUES (%s, 12, 'pendente') ON CONFLICT (projeto_id, etapa_numero) DO NOTHING
    """, (pid,))
    cur.execute("""
        SELECT meta FROM gestao.projeto_etapas
         WHERE projeto_id::text = %s AND etapa_numero = 12 FOR UPDATE
    """, (pid,))
    meta = (cur.fetchone() or {}).get("meta") or {}
    defs = meta.get("definicoes") or {}
    mutate(defs)
    cur.execute("""
        UPDATE gestao.projeto_etapas
           SET meta = jsonb_set(COALESCE(meta,'{}'::jsonb), '{definicoes}', %s::jsonb, true),
               updated_at = now()
         WHERE projeto_id::text = %s AND etapa_numero = 12
    """, (json.dumps(defs), pid))
    return defs


class CenterDefinicaoResposta(BaseModel):
    secao: str
    pergunta: str
    resposta: str
    nome: str = ""


@app.post("/api/publico/center/{token}/definicoes/resposta")
def publico_center_definicoes_resposta(token: str, payload: CenterDefinicaoResposta,
                                       x_center_key: str | None = Header(default=None)):
    """Cliente responde/edita uma pergunta das Definições. Merge por pergunta
    em meta.definicoes.respostas — o texto original da ata fica preservado."""
    projeto = _center_projeto(token, x_center_key)
    pid = projeto["id"]
    secao = (payload.secao or "").strip()[:120]
    pergunta = (payload.pergunta or "").strip()[:300]
    resposta = (payload.resposta or "").strip()[:2000]
    if not secao or not pergunta:
        raise HTTPException(400, "secao e pergunta obrigatórios")
    chave = f"{secao}|{pergunta}"
    entry = {
        "resposta": resposta,
        "por": (payload.nome or "").strip()[:120],
        "em": datetime.now(timezone.utc).isoformat(),
    }
    with conn() as c, c.cursor() as cur:
        def mutate(defs: dict):
            defs.setdefault("respostas", {})[chave] = entry
        _definicoes_merge(cur, pid, mutate)
    return {"ok": True, "chave": chave, "resposta": entry}


# ═══════════════════════════════════════════════════════════════════
# CENTER FINANCEIRO — aba Financeiro da página Itens Contratados
# QUÊ: o cliente vê o que já pagou e o que falta (parcelas de entrada
# do core.lancamentos, Cloud schema core) e gera o boleto/Pix de cada
# parcela pendente direto na Central — sem depender do gestor.
# COMO: token do center → gestao.projetos → core.obras (meta.core_obra_id
# ou match por nome do cliente); emissão de boleto/Pix é PROXY pro
# backend do termo (parket-docusign em core.parket.works), que fala com
# o Itaú — nenhuma credencial bancária vive aqui.
# POR QUÊ proxy: o endpoint público só expõe parcelas DA obra do token;
# chamar o docusign direto do browser deixaria sim_id/valor livres.
# ═══════════════════════════════════════════════════════════════════

DOCUSIGN_BASE = os.environ.get("DOCUSIGN_BASE_URL", "https://core.parket.works/api/docusign")


def _sb_core() -> httpx.Client:
    """Cliente PostgREST do Cloud apontado pro schema core (financeiro)."""
    cli = _sb_client()
    cli.headers["Accept-Profile"] = "core"
    return cli


def _center_fin_ctx(token: str) -> dict:
    """Resolve token → projeto (com simulacao_id/meta) → obra do Core.

    core.obras não referencia card/projeto do gestão (space_id vem nulo do
    import), então o vínculo é: meta.core_obra_id explícito no projeto, ou
    match único por nome do cliente (sufixo " (SIMULACAO)" removido — o
    clone de simulação enxerga o financeiro REAL da obra de origem). O id
    encontrado é persistido no meta pra não repetir a busca."""
    with conn() as c, c.cursor() as cur:
        cur.execute("""
            SELECT id::text, cliente, numero_proposta, simulacao_id::text,
                   meta->>'core_obra_id' AS core_obra_id
              FROM gestao.projetos
             WHERE meta->>'center_token' = %s
             LIMIT 1
        """, (token,))
        row = cur.fetchone()
    if not row:
        raise HTTPException(404, "link não encontrado ou revogado")

    obra_id = row.get("core_obra_id")
    if not obra_id:
        nome = re.sub(r"\s*\(SIMULACAO\)\s*$", "", (row.get("cliente") or "").strip())
        if nome:
            with _sb_core() as sb:
                r = sb.get("/obras", params={"select": "id,nome", "nome": f"eq.{nome}", "limit": "2"})
                if r.status_code < 400 and len(r.json()) == 1:
                    obra_id = r.json()[0]["id"]
        if obra_id:
            with conn() as c, c.cursor() as cur:
                cur.execute("""
                    UPDATE gestao.projetos
                       SET meta = COALESCE(meta,'{}'::jsonb)
                                  || jsonb_build_object('core_obra_id', %s::text)
                     WHERE id::text = %s
                """, (obra_id, row["id"]))
    row["core_obra_id"] = obra_id
    return row


def _center_fin_sim_id(numero_documento: str | None, ctx: dict) -> str | None:
    """sim da Valoria que emite a cobrança da parcela no docusign.
    TERMO-<sim_id> traz o id embutido; CT-<contrato> cai na sim do projeto
    (o contrato nasceu dela). Sem sim = parcela sem botão de cobrança."""
    nd = (numero_documento or "").strip()
    if nd.startswith("TERMO-"):
        return nd[len("TERMO-"):] or None
    return ctx.get("simulacao_id") or None


def _center_fin_parcelas(ctx: dict) -> tuple[dict | None, list[dict]]:
    """Obra do Core + lançamentos de ENTRADA (parcelas do cliente).
    Saídas (NF de fornecedor, frete etc) NUNCA aparecem pro cliente."""
    obra_id = ctx.get("core_obra_id")
    if not obra_id:
        return None, []
    with _sb_core() as sb:
        ro = sb.get("/obras", params={"select": "id,nome,codigo,valor_venda", "id": f"eq.{obra_id}"})
        _sb_raise(ro, "center.fin.obra")
        obra = (ro.json() or [None])[0]
        rl = sb.get("/lancamentos", params={
            "select": "id,descricao,numero_documento,status,valor,valor_pago,"
                      "data_vencimento,data_pagamento,parcela_atual,parcela_total,"
                      "forma_pagamento,anexos",
            "obra_id": f"eq.{obra_id}",
            "tipo": "eq.entrada",
            "order": "data_vencimento.asc,parcela_atual.asc",
        })
        _sb_raise(rl, "center.fin.lancamentos")
        return obra, rl.json()


def _center_fin_anexos(raw) -> list[dict]:
    """Normaliza anexos (jsonb livre em core.lancamentos) pra {nome,url}.
    Aceita lista de strings (url) ou lista de dicts. Vazio se nada válido."""
    if not raw:
        return []
    if isinstance(raw, dict):
        raw = [raw]
    out: list[dict] = []
    for a in raw:
        if isinstance(a, str) and a.strip().startswith("http"):
            out.append({"nome": a.rsplit("/", 1)[-1] or "comprovante", "url": a.strip()})
        elif isinstance(a, dict):
            url = a.get("url") or a.get("href") or a.get("link")
            nome = a.get("nome") or a.get("name") or a.get("titulo") or (url and url.rsplit("/", 1)[-1]) or "comprovante"
            if url:
                out.append({"nome": nome, "url": url})
    return out


@app.get("/api/publico/center/{token}/financeiro")
def publico_center_financeiro(token: str, x_center_key: str | None = Header(default=None)):
    ctx = _center_fin_ctx(token)
    obra, rows = _center_fin_parcelas(ctx)
    if not obra:
        return {"disponivel": False, "parcelas": [], "totais": None}

    hoje = date.today().isoformat()
    parcelas = []
    for l in rows:
        pago = (l.get("status") == "recebido") or bool(l.get("data_pagamento"))
        venc = l.get("data_vencimento") or ""
        sim_id = _center_fin_sim_id(l.get("numero_documento"), ctx)
        parcelas.append({
            "id": l["id"],
            "descricao": l.get("descricao") or "",
            "numero_documento": l.get("numero_documento") or "",
            "parcela_atual": l.get("parcela_atual") or 1,
            "parcela_total": l.get("parcela_total") or 1,
            "valor": float(l.get("valor") or 0),
            "valor_pago": float(l.get("valor_pago") or 0) if l.get("valor_pago") is not None else None,
            "vencimento": venc or None,
            "pago_em": l.get("data_pagamento"),
            "forma_pagamento": l.get("forma_pagamento") or None,
            "anexos": _center_fin_anexos(l.get("anexos")),
            "status": "pago" if pago else ("vencido" if venc and venc < hoje else "pendente"),
            # Cobrança self-service só com sim vinculada (boleto e Pix saem dela)
            "cobranca_disponivel": bool(sim_id) and not pago,
        })

    pago_total = sum(p["valor_pago"] if p["valor_pago"] is not None else p["valor"]
                     for p in parcelas if p["status"] == "pago")
    contratado = float(obra.get("valor_venda") or 0) or sum(p["valor"] for p in parcelas)
    falta = max(0.0, contratado - pago_total)
    # Próxima parcela = primeira em aberto (pendente ou vencida) na ordem de vencimento.
    proxima = next((p for p in parcelas if p["status"] != "pago"), None)
    return {
        "disponivel": True,
        "parcelas": parcelas,
        "proxima": proxima and {
            "id": proxima["id"], "valor": proxima["valor"],
            "vencimento": proxima["vencimento"], "status": proxima["status"],
            "parcela_atual": proxima["parcela_atual"], "parcela_total": proxima["parcela_total"],
        },
        "totais": {
            "contratado": contratado,
            "pago": pago_total,
            "falta": falta,
            "pct_pago": round(pago_total / contratado * 100, 1) if contratado > 0 else 0.0,
        },
    }


def _center_fin_parcela(token: str, lancamento_id: str) -> tuple[dict, dict]:
    """Carrega a parcela GARANTINDO que pertence à obra do token (o id do
    lançamento nunca autoriza sozinho) e que ainda está em aberto."""
    ctx = _center_fin_ctx(token)
    _, rows = _center_fin_parcelas(ctx)
    parc = next((l for l in rows if str(l.get("id")) == str(lancamento_id)), None)
    if not parc:
        raise HTTPException(404, "parcela não encontrada nesta obra")
    if parc.get("status") == "recebido" or parc.get("data_pagamento"):
        raise HTTPException(409, "parcela já paga")
    return ctx, parc


@app.get("/api/publico/center/{token}/financeiro/{lancamento_id}/boleto")
def publico_center_fin_boleto(token: str, lancamento_id: str,
                              x_center_key: str | None = Header(default=None)):
    """Boleto da parcela na hora (PDF). O docusign deduplica pela chave
    sim+valor+vencimento (_BOLETO_PARCELA), então reabrir/duplo clique não
    registra título novo no banco."""
    from fastapi import Response
    ctx, parc = _center_fin_parcela(token, lancamento_id)
    sim_id = _center_fin_sim_id(parc.get("numero_documento"), ctx)
    if not sim_id:
        raise HTTPException(409, "parcela sem cobrança automática — fale com a equipe Parket")
    r = httpx.get(f"{DOCUSIGN_BASE}/termo/cobranca/boleto-pdf", params={
        "sim_id": sim_id,
        "valor": float(parc.get("valor") or 0),
        "vencimento": parc.get("data_vencimento") or "",
    }, timeout=60)
    if r.status_code >= 400 or "pdf" not in (r.headers.get("content-type") or ""):
        log.warning("center_fin_boleto_fail lanc=%s status=%s body=%s",
                    lancamento_id, r.status_code, r.text[:300])
        raise HTTPException(502, "emissão do boleto indisponível no momento")
    n = parc.get("parcela_atual") or 1
    return Response(content=r.content, media_type="application/pdf", headers={
        "Content-Disposition": f'inline; filename="boleto-parcela-{n}.pdf"',
    })


@app.post("/api/publico/center/{token}/financeiro/{lancamento_id}/pix")
def publico_center_fin_pix(token: str, lancamento_id: str,
                           x_center_key: str | None = Header(default=None)):
    """Cobrança Pix da parcela: devolve o copia-e-cola (EMV) pro cliente
    pagar no app do banco. Status é consultado no GET abaixo — só o banco
    confirma pagamento (nunca marcamos pago por tempo)."""
    ctx, parc = _center_fin_parcela(token, lancamento_id)
    sim_id = _center_fin_sim_id(parc.get("numero_documento"), ctx)
    if not sim_id:
        raise HTTPException(409, "parcela sem cobrança automática — fale com a equipe Parket")
    r = httpx.post(f"{DOCUSIGN_BASE}/termo/pagamento/pix", json={
        "valor": float(parc.get("valor") or 0),
        "nome": ctx.get("cliente") or "",
        "sim_id": sim_id,
    }, timeout=30)
    if r.status_code >= 400:
        raise HTTPException(502, "cobrança Pix indisponível no momento")
    body = r.json()
    if not body.get("ok"):
        raise HTTPException(502, body.get("error") or "cobrança Pix indisponível")
    return {
        "ok": True,
        "txid": body.get("txid"),
        "copia_e_cola": body.get("copia_e_cola"),
        "valor": body.get("valor"),
        "ambiente": body.get("ambiente"),
    }


@app.get("/api/publico/center/{token}/financeiro/pix/{txid}")
def publico_center_fin_pix_status(token: str, txid: str,
                                  x_center_key: str | None = Header(default=None)):
    """Poll do status da cobrança Pix (ATIVA/CONCLUIDA, fonte banco)."""
    _center_projeto(token, x_center_key)  # valida o token; txid é opaco do docusign
    r = httpx.get(f"{DOCUSIGN_BASE}/termo/pagamento/pix/{txid}", timeout=20)
    if r.status_code >= 400:
        raise HTTPException(502, "consulta Pix indisponível")
    body = r.json()
    return {"ok": bool(body.get("ok")), "status": body.get("status") or "ATIVA"}


# ═══════════════════════════════════════════════════════════════════
# INSTAPARKET — insta.parket.works
# Perfil = gestao.projetos (nome do cliente). Fotos/vídeos vêm de
# gestao.fotos; curadoria (Nathalia/produtividade) monta posts em
# insta.posts + insta.post_midias. Cliente acessa pelo center_token
# e vê SÓ o perfil dele. Sem identificação de autor da mídia.
# ═══════════════════════════════════════════════════════════════════

import base64 as _b64
import io as _io

# Moderação (deletar post/comentário alheio, avatar). Postar = qualquer
# usuário logado do gestão (Will 14/08).
INSTA_CURADORES = {"produtividade@parket.com.br", "douglas@parket.com.br"}
CHAT_INTERNAL_URL = os.environ.get("CHAT_INTERNAL_URL", "")
_CHAT_SECRET_FILE = os.environ.get("CHAT_INTERNAL_SECRET_FILE", "/run/secrets/chat_internal_secret")


def _insta_require_curador(email: str | None):
    if (email or "").strip().lower() not in INSTA_CURADORES:
        raise HTTPException(403, "apenas curadoria do InstaParket pode fazer isso")


def _insta_require_gestao(email: str | None):
    if not (email or "").strip().lower():
        raise HTTPException(403, "login do gestão necessário para postar")


def _chat_internal_secret() -> str | None:
    try:
        with open(_CHAT_SECRET_FILE) as f:
            return f.read().strip() or None
    except OSError:
        return os.environ.get("CHAT_INTERNAL_SECRET") or None


def _insta_chat_notify(projeto_id: str, texto: str):
    """Best-effort: avisa no chat da obra (parket-chat) que saiu post/comentário.
    Nunca derruba o request principal."""
    if not CHAT_INTERNAL_URL:
        return
    secret = _chat_internal_secret()
    if not secret:
        return
    try:
        card_id = _projeto_card_id(projeto_id)
        if not card_id:
            return
        httpx.post(f"{CHAT_INTERNAL_URL}/api/internal/obra/{card_id}/mensagem",
                   json={"content": texto},
                   headers={"x-internal-secret": secret}, timeout=8)
    except Exception:
        log.warning("insta_chat_notify_fail pid=%s", projeto_id, exc_info=True)


@app.get("/api/internal/center/{card_id}/definicoes")
def internal_center_definicoes(card_id: str,
                               x_internal_secret: str | None = Header(default=None)):
    """Respostas cruas da etapa 12 (Definições do Center) pro Draw montar o
    Anteprojeto. Consumo interno via rede overlay; o match resposta→catálogo
    fica no consumidor (evita duplicar o definicoesCatalogo aqui)."""
    secret = _chat_internal_secret()
    if not secret or x_internal_secret != secret:
        raise HTTPException(403, "secret inválido")
    with conn() as c, c.cursor() as cur:
        proj = _checklist_projeto_por_card(cur, card_id)
        if not proj:
            raise HTTPException(404, "projeto do gestão não encontrado pra esse card")
        cur.execute("""
            SELECT meta FROM gestao.projeto_etapas
             WHERE projeto_id::text = %s AND etapa_numero = 12
        """, (str(proj["id"]),))
        row = cur.fetchone()
    defs = ((row or {}).get("meta") or {}).get("definicoes") or {}
    respostas = []
    for k, v in (defs.get("respostas") or {}).items():
        secao, _, pergunta = k.partition("|")
        v = v if isinstance(v, dict) else {"resposta": v}
        respostas.append({
            "secao": secao, "pergunta": pergunta,
            "resposta_texto": v.get("resposta"),
            "por": v.get("por"), "em": v.get("em"),
        })
    return {"projeto_id": str(proj["id"]), "cliente": proj.get("cliente"),
            "respostas": respostas, "arquivos": defs.get("arquivos") or []}


@app.get("/api/internal/center/{card_id}/itens")
def internal_center_itens(card_id: str,
                          x_internal_secret: str | None = Header(default=None)):
    """Itens vendidos (gestao.itens) pro Draw pré-preencher as tabelas
    quantitativas do Anteprojeto PG (#1924): metragem vendida na proposta
    por item/ambiente com a unidade certa (m², ml, un). O casamento
    item vendido ↔ detalhe da biblioteca fica no consumidor (Draw)."""
    secret = _chat_internal_secret()
    if not secret or x_internal_secret != secret:
        raise HTTPException(403, "secret inválido")
    with conn() as c, c.cursor() as cur:
        proj = _checklist_projeto_por_card(cur, card_id)
        if not proj:
            raise HTTPException(404, "projeto do gestão não encontrado pra esse card")
        cur.execute("""
            SELECT meta->>'codigo' AS codigo, categoria, ambiente,
                   descritivo, quantidade, unidade
              FROM gestao.itens
             WHERE projeto_id = %s
             ORDER BY ordem
        """, (str(proj["id"]),))
        rows = cur.fetchall()
    itens = [{
        "codigo": r.get("codigo"),
        "categoria": r.get("categoria"),
        "ambiente": r.get("ambiente"),
        "descritivo": r.get("descritivo"),
        "quantidade": float(r["quantidade"]) if r.get("quantidade") is not None else None,
        "unidade": r.get("unidade"),
    } for r in rows]
    return {"projeto_id": str(proj["id"]), "cliente": proj.get("cliente"),
            "itens": itens}


# ── OTIMIZAÇÃO DE IMAGEM (derivado web) ──────────────────────────

def _insta_otimizar_fotos(foto_ids: list[str]):
    """Gera derivado JPEG ≤1280px no Storage e grava gestao.fotos.url_web.
    Roda em background; falha nunca quebra o fluxo (feed cai no original)."""
    for fid in foto_ids:
        try:
            _foto_gerar_url_web(fid)
        except Exception:
            log.warning("insta_otimiza_fail foto=%s", fid, exc_info=True)


def _foto_gerar_url_web(fid: str):
    from PIL import Image, ImageOps
    with conn() as c, c.cursor() as cur:
        cur.execute("SELECT url, tipo, url_web FROM gestao.fotos WHERE id::text = %s", (fid,))
        f = cur.fetchone()
    if not f or (f["tipo"] or "foto") != "foto" or f["url_web"]:
        return
    url = f["url"] or ""
    if url.startswith("data:"):
        raw = _b64.b64decode(url.split(",", 1)[1])
    elif url.startswith("http"):
        r = httpx.get(url, timeout=30.0)
        r.raise_for_status()
        raw = r.content
    else:
        return
    img = ImageOps.exif_transpose(Image.open(_io.BytesIO(raw)))
    if img.mode != "RGB":
        img = img.convert("RGB")
    img.thumbnail((1280, 1280), Image.LANCZOS)
    buf = _io.BytesIO()
    img.save(buf, "JPEG", quality=80, optimize=True, progressive=True)
    path = f"insta/web/{fid}.jpg"
    with _storage_client() as st:
        r = st.post(f"/object/{STORAGE_BUCKET}/{path}", content=buf.getvalue(),
                    headers={"Content-Type": "image/jpeg", "x-upsert": "true"})
        if r.status_code >= 400:
            raise RuntimeError(f"storage upload {r.status_code}: {r.text[:200]}")
    web = f"{SUPABASE_URL}/storage/v1/object/public/{STORAGE_BUCKET}/{path}"
    with conn() as c, c.cursor() as cur:
        cur.execute("UPDATE gestao.fotos SET url_web = %s WHERE id::text = %s", (web, fid))


_INSTA_FEED_SQL = """
    SELECT p.id, p.projeto_id, p.legenda, p.created_at, p.publicado_por,
           pr.cliente, (pr.entregue_em IS NOT NULL) AS concluido,
           COALESCE(m.midias, '[]'::jsonb) AS midias,
           COALESCE(cur.n, 0) AS curtidas,
           COALESCE(com.n, 0) AS comentarios,
           EXISTS (SELECT 1 FROM insta.curtidas cx
                    WHERE cx.post_id = p.id AND cx.autor_tipo = %(vtipo)s
                      AND cx.autor_id = %(vid)s) AS curti
      FROM insta.posts p
      JOIN gestao.projetos pr ON pr.id = p.projeto_id
      LEFT JOIN LATERAL (
            SELECT jsonb_agg(jsonb_build_object(
                       'foto_id', f.id, 'url', COALESCE(f.url_web, f.url), 'tipo', f.tipo,
                       'legenda', f.legenda, 'ambiente', f.ambiente)
                   ORDER BY pm.ordem) AS midias
              FROM insta.post_midias pm
              JOIN gestao.fotos f ON f.id = pm.foto_id
             WHERE pm.post_id = p.id) m ON true
      LEFT JOIN LATERAL (SELECT count(*) n FROM insta.curtidas c
                          WHERE c.post_id = p.id) cur ON true
      LEFT JOIN LATERAL (SELECT count(*) n FROM insta.comentarios c
                          WHERE c.post_id = p.id AND c.deleted_at IS NULL) com ON true
"""


def _insta_avatar_map(cur, projeto_ids: list[str]) -> dict:
    """avatar por projeto: perfil_config.avatar_foto_id, senão 1ª mídia do 1º post."""
    if not projeto_ids:
        return {}
    cur.execute("""
        SELECT pc.projeto_id::text AS pid, COALESCE(f.url_web, f.url) AS url
          FROM insta.perfil_config pc
          JOIN gestao.fotos f ON f.id = pc.avatar_foto_id
         WHERE pc.projeto_id::text = ANY(%s)
    """, (projeto_ids,))
    avatars = {r["pid"]: r["url"] for r in cur.fetchall()}
    faltam = [p for p in projeto_ids if p not in avatars]
    if faltam:
        cur.execute("""
            SELECT DISTINCT ON (p.projeto_id) p.projeto_id::text AS pid,
                   COALESCE(f.url_web, f.url) AS url
              FROM insta.posts p
              JOIN insta.post_midias pm ON pm.post_id = p.id
              JOIN gestao.fotos f ON f.id = pm.foto_id
             WHERE p.projeto_id::text = ANY(%s) AND f.tipo = 'foto'
             ORDER BY p.projeto_id, p.created_at ASC, pm.ordem ASC
        """, (faltam,))
        for r in cur.fetchall():
            avatars.setdefault(r["pid"], r["url"])
    return avatars


# ── FILA DE ACOMPANHAMENTO (curadoria) ────────────────────────────

@app.get("/api/insta/acompanhamento")
def insta_acompanhamento(limit: int = 150, projeto_id: str | None = None,
                         origem: str | None = None):
    """Fila cronológica de mídias de campo (fiscal + instalador + gestão) de
    todos os projetos, com flag `postada`. Fontes Cloud entram mapeadas por
    card_id → projeto; mídia ainda não adotada vem com fonte+fonte_id."""
    limit = min(max(limit, 1), 400)
    itens: list[dict] = []
    with conn() as c, c.cursor() as cur:
        where, args = ["f.url IS NOT NULL"], []
        if projeto_id:
            where.append("f.projeto_id::text = %s"); args.append(projeto_id)
        cur.execute(f"""
            SELECT f.id::text AS foto_id, f.projeto_id::text AS projeto_id,
                   COALESCE(f.url_web, f.url) AS url, f.tipo, f.legenda, f.ambiente, f.origem, f.fonte_id,
                   f.created_at, pr.cliente,
                   EXISTS (SELECT 1 FROM insta.post_midias pm
                            WHERE pm.foto_id = f.id) AS postada
              FROM gestao.fotos f
              JOIN gestao.projetos pr ON pr.id = f.projeto_id
             WHERE {' AND '.join(where)}
             ORDER BY f.created_at DESC LIMIT %s
        """, args + [limit])
        for r in cur.fetchall():
            r["fonte"] = "gestao"
            itens.append(r)

        # mapa card_id → projeto (pra fontes Cloud)
        cur.execute("""
            SELECT card_id::text AS card_id, id::text AS pid, cliente
              FROM gestao.projetos WHERE card_id IS NOT NULL
        """)
        por_card = {r["card_id"]: r for r in cur.fetchall()}

        # fonte_ids já adotados (evita duplicar na fila)
        cur.execute("SELECT fonte_id FROM gestao.fotos WHERE fonte_id IS NOT NULL")
        adotadas = {r["fonte_id"] for r in cur.fetchall()}

    try:
        with _sb_client() as sb:
            fr = sb.get("/fiscal_fotos", params=[
                ("select", "id,card_id,url,descricao,ambiente,tipo,created_at"),
                ("order", "created_at.desc"), ("limit", str(limit)),
            ])
            for f in (fr.json() if fr.status_code < 400 else []):
                pj = por_card.get(str(f.get("card_id") or ""))
                fid = f"fiscal:{f['id']}"
                if not pj or fid in adotadas:
                    continue
                if projeto_id and pj["pid"] != projeto_id:
                    continue
                itens.append({
                    "foto_id": None, "fonte": "fiscal", "fonte_id": fid,
                    "projeto_id": pj["pid"], "cliente": pj["cliente"],
                    "url": f.get("url"), "tipo": f.get("tipo") or "foto",
                    "legenda": f.get("descricao"), "ambiente": f.get("ambiente"),
                    "origem": "fiscal", "created_at": f.get("created_at"),
                    "postada": False,
                })
            ir = sb.get("/instala_updates_cliente", params=[
                ("select", "id,card_id,kind,titulo,detalhe,foto_url,created_at"),
                ("foto_url", "not.is.null"),
                ("order", "created_at.desc"), ("limit", str(limit)),
            ])
            for f in (ir.json() if ir.status_code < 400 else []):
                pj = por_card.get(str(f.get("card_id") or ""))
                fid = f"instala:{f['id']}"
                if not pj or fid in adotadas:
                    continue
                if projeto_id and pj["pid"] != projeto_id:
                    continue
                url = f.get("foto_url") or ""
                tipo = "video" if url.lower().split("?")[0].endswith((".mp4", ".mov", ".webm")) else "foto"
                itens.append({
                    "foto_id": None, "fonte": "instala", "fonte_id": fid,
                    "projeto_id": pj["pid"], "cliente": pj["cliente"],
                    "url": url, "tipo": tipo,
                    "legenda": f.get("titulo") or f.get("detalhe"),
                    "ambiente": None, "origem": "instala",
                    "created_at": f.get("created_at"), "postada": False,
                })
    except Exception:
        log.warning("insta_acompanhamento_cloud_fail", exc_info=True)

    if origem:
        itens = [i for i in itens if i.get("origem") == origem or i.get("fonte") == origem]
    itens.sort(key=lambda i: str(i.get("created_at") or ""), reverse=True)
    return itens[:limit]


# ── POSTS (curadoria) ─────────────────────────────────────────────

class InstaMidia(BaseModel):
    foto_id: str | None = None      # já em gestao.fotos
    fonte: str | None = None        # 'fiscal' | 'instala' (adota na hora)
    fonte_id: str | None = None
    url: str | None = None
    tipo: str | None = None
    legenda: str | None = None
    ambiente: str | None = None


class InstaPostNovo(BaseModel):
    projeto_id: str
    legenda: str | None = None
    midias: list[InstaMidia]


@app.post("/api/insta/posts")
def insta_post_criar(payload: InstaPostNovo, bg: BackgroundTasks,
                     x_user_email: str | None = Header(default=None)):
    """Publica um post (carrossel de fotos/vídeos) no perfil do projeto.
    Mídias de fiscal/instala ainda não adotadas entram em gestao.fotos antes.
    Publicar = no ar na hora (decisão Will 14/08)."""
    _insta_require_gestao(x_user_email)
    if not payload.midias:
        raise HTTPException(400, "post precisa de pelo menos 1 mídia")
    legenda = (payload.legenda or "").strip()[:3000] or None
    with conn() as c, c.cursor() as cur:
        cur.execute("SELECT id::text, cliente FROM gestao.projetos WHERE id::text = %s",
                    (payload.projeto_id,))
        pj = cur.fetchone()
        if not pj:
            raise HTTPException(404, "projeto não encontrado")

        foto_ids: list[str] = []
        for m in payload.midias:
            if m.foto_id:
                foto_ids.append(m.foto_id)
                continue
            if not (m.fonte and m.fonte_id and m.url):
                raise HTTPException(400, "mídia sem foto_id precisa de fonte+fonte_id+url")
            tipo = m.tipo or ("video" if m.url.lower().split("?")[0].endswith((".mp4", ".mov", ".webm")) else "foto")
            cur.execute("""
                INSERT INTO gestao.fotos (projeto_id, url, legenda, ambiente,
                                          tipo, origem, fonte_id, autor_email)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                ON CONFLICT (projeto_id, fonte_id) WHERE fonte_id IS NOT NULL
                DO UPDATE SET url = EXCLUDED.url
                RETURNING id::text
            """, (payload.projeto_id, m.url, m.legenda, m.ambiente,
                  tipo, m.fonte, m.fonte_id, x_user_email))
            foto_ids.append(cur.fetchone()["id"])

        cur.execute("""
            INSERT INTO insta.posts (projeto_id, legenda, publicado_por)
            VALUES (%s, %s, %s) RETURNING id::text, created_at
        """, (payload.projeto_id, legenda, x_user_email or ""))
        post = cur.fetchone()
        for i, fid in enumerate(foto_ids):
            cur.execute("""
                INSERT INTO insta.post_midias (post_id, foto_id, ordem)
                VALUES (%s, %s, %s) ON CONFLICT (post_id, foto_id) DO NOTHING
            """, (post["id"], fid, i))

    bg.add_task(_insta_otimizar_fotos, foto_ids)
    n = len(foto_ids)
    _insta_chat_notify(payload.projeto_id,
                       f"Novo post no InstaParket de *{pj['cliente']}* "
                       f"({n} mídia{'s' if n > 1 else ''})"
                       + (f": {legenda[:140]}" if legenda else ""))
    return {"ok": True, "post_id": post["id"], "midias": n}


@app.delete("/api/insta/posts/{post_id}")
def insta_post_deletar(post_id: str, x_user_email: str | None = Header(default=None)):
    """Curadoria apaga qualquer post; quem publicou apaga o próprio."""
    email = (x_user_email or "").strip().lower()
    with conn() as c, c.cursor() as cur:
        cur.execute("SELECT publicado_por FROM insta.posts WHERE id::text = %s", (post_id,))
        row = cur.fetchone()
        if not row:
            raise HTTPException(404, "post não encontrado")
        dono = email and (row["publicado_por"] or "").strip().lower() == email
        if not dono and email not in INSTA_CURADORES:
            raise HTTPException(403, "sem permissão")
        cur.execute("DELETE FROM insta.posts WHERE id::text = %s", (post_id,))
    return {"ok": True}


# ── FEED + PERFIS (interno, SSO) ─────────────────────────────────

def _insta_viewer(email: str | None) -> tuple[str, str]:
    return ("interno", (email or "anon").strip().lower())


@app.get("/api/insta/feed")
def insta_feed(limit: int = 30, offset: int = 0,
               x_user_email: str | None = Header(default=None)):
    limit = min(max(limit, 1), 100)
    vtipo, vid = _insta_viewer(x_user_email)
    with conn() as c, c.cursor() as cur:
        cur.execute(_INSTA_FEED_SQL + " ORDER BY p.created_at DESC LIMIT %(lim)s OFFSET %(off)s",
                    {"vtipo": vtipo, "vid": vid, "lim": limit, "off": offset})
        posts = cur.fetchall()
        avatars = _insta_avatar_map(cur, list({str(p["projeto_id"]) for p in posts}))
    for p in posts:
        p["avatar_url"] = avatars.get(str(p["projeto_id"]))
    return posts


@app.get("/api/insta/perfis")
def insta_perfis(q: str | None = None):
    with conn() as c, c.cursor() as cur:
        where = "WHERE pr.cliente ILIKE %s" if q else ""
        args = [f"%{q}%"] if q else []
        cur.execute(f"""
            SELECT pr.id::text AS projeto_id, pr.cliente,
                   (pr.entregue_em IS NOT NULL) AS concluido,
                   count(p.id) AS posts, max(p.created_at) AS ultimo_post
              FROM gestao.projetos pr
              JOIN insta.posts p ON p.projeto_id = pr.id
             {where}
             GROUP BY pr.id, pr.cliente, pr.entregue_em
             ORDER BY max(p.created_at) DESC
        """, args)
        perfis = cur.fetchall()
        avatars = _insta_avatar_map(cur, [p["projeto_id"] for p in perfis])
    for p in perfis:
        p["avatar_url"] = avatars.get(p["projeto_id"])
    return perfis


@app.get("/api/insta/perfil/{projeto_id}")
def insta_perfil(projeto_id: str, x_user_email: str | None = Header(default=None)):
    vtipo, vid = _insta_viewer(x_user_email)
    with conn() as c, c.cursor() as cur:
        cur.execute("""
            SELECT id::text AS projeto_id, cliente,
                   (entregue_em IS NOT NULL) AS concluido
              FROM gestao.projetos WHERE id::text = %s
        """, (projeto_id,))
        perfil = cur.fetchone()
        if not perfil:
            raise HTTPException(404, "perfil não encontrado")
        cur.execute(_INSTA_FEED_SQL + " WHERE p.projeto_id::text = %(pid)s ORDER BY p.created_at DESC",
                    {"vtipo": vtipo, "vid": vid, "pid": projeto_id})
        posts = cur.fetchall()
        avatars = _insta_avatar_map(cur, [projeto_id])
    perfil["avatar_url"] = avatars.get(projeto_id)
    perfil["posts"] = posts
    return perfil


class InstaAvatar(BaseModel):
    avatar_foto_id: str


@app.patch("/api/insta/perfil/{projeto_id}")
def insta_perfil_avatar(projeto_id: str, payload: InstaAvatar, bg: BackgroundTasks,
                        x_user_email: str | None = Header(default=None)):
    _insta_require_gestao(x_user_email)
    with conn() as c, c.cursor() as cur:
        cur.execute("""
            INSERT INTO insta.perfil_config (projeto_id, avatar_foto_id, updated_at)
            VALUES (%s, %s, now())
            ON CONFLICT (projeto_id)
            DO UPDATE SET avatar_foto_id = EXCLUDED.avatar_foto_id, updated_at = now()
        """, (projeto_id, payload.avatar_foto_id))
    bg.add_task(_insta_otimizar_fotos, [payload.avatar_foto_id])
    return {"ok": True}


# ── INTERAÇÕES (interno) ─────────────────────────────────────────

def _insta_toggle_curtida(post_id: str, autor_tipo: str, autor_id: str, autor_nome: str):
    with conn() as c, c.cursor() as cur:
        cur.execute("SELECT projeto_id::text FROM insta.posts WHERE id::text = %s", (post_id,))
        post = cur.fetchone()
        if not post:
            raise HTTPException(404, "post não encontrado")
        cur.execute("""
            DELETE FROM insta.curtidas
             WHERE post_id::text = %s AND autor_tipo = %s AND autor_id = %s
             RETURNING id
        """, (post_id, autor_tipo, autor_id))
        if cur.fetchone():
            curtiu = False
        else:
            cur.execute("""
                INSERT INTO insta.curtidas (post_id, autor_tipo, autor_id, autor_nome)
                VALUES (%s, %s, %s, %s)
            """, (post_id, autor_tipo, autor_id, autor_nome))
            curtiu = True
        cur.execute("SELECT count(*) AS n FROM insta.curtidas WHERE post_id::text = %s", (post_id,))
        return {"ok": True, "curtiu": curtiu, "curtidas": cur.fetchone()["n"],
                "projeto_id": post["projeto_id"]}


def _insta_comentar(post_id: str, autor_tipo: str, autor_id: str,
                    autor_nome: str, texto: str) -> dict:
    texto = (texto or "").strip()[:2000]
    if not texto:
        raise HTTPException(400, "comentário vazio")
    with conn() as c, c.cursor() as cur:
        cur.execute("SELECT projeto_id::text FROM insta.posts WHERE id::text = %s", (post_id,))
        post = cur.fetchone()
        if not post:
            raise HTTPException(404, "post não encontrado")
        cur.execute("""
            INSERT INTO insta.comentarios (post_id, autor_tipo, autor_id, autor_nome, texto)
            VALUES (%s, %s, %s, %s, %s)
            RETURNING id::text, autor_tipo, autor_nome, texto, created_at
        """, (post_id, autor_tipo, autor_id, autor_nome, texto))
        row = cur.fetchone()
    row["projeto_id"] = post["projeto_id"]
    return row


class InstaComentario(BaseModel):
    texto: str
    autor_nome: str | None = None


@app.post("/api/insta/posts/{post_id}/curtir")
def insta_curtir(post_id: str, x_user_email: str | None = Header(default=None),
                 x_user_name: str | None = Header(default=None)):
    if not x_user_email:
        raise HTTPException(401, "login necessário")
    vtipo, vid = _insta_viewer(x_user_email)
    return _insta_toggle_curtida(post_id, vtipo, vid, x_user_name or x_user_email)


@app.post("/api/insta/posts/{post_id}/comentar")
def insta_comentar(post_id: str, payload: InstaComentario,
                   x_user_email: str | None = Header(default=None),
                   x_user_name: str | None = Header(default=None)):
    if not x_user_email:
        raise HTTPException(401, "login necessário")
    vtipo, vid = _insta_viewer(x_user_email)
    return _insta_comentar(post_id, vtipo, vid,
                           payload.autor_nome or x_user_name or x_user_email,
                           payload.texto)


@app.get("/api/insta/posts/{post_id}/comentarios")
def insta_comentarios(post_id: str):
    with conn() as c, c.cursor() as cur:
        cur.execute("""
            SELECT id::text, autor_tipo, autor_nome, texto, created_at
              FROM insta.comentarios
             WHERE post_id::text = %s AND deleted_at IS NULL
             ORDER BY created_at
        """, (post_id,))
        return cur.fetchall()


@app.delete("/api/insta/comentarios/{cid}")
def insta_comentario_deletar(cid: str, x_user_email: str | None = Header(default=None)):
    """Curadoria apaga qualquer comentário; autor interno apaga o próprio."""
    email = (x_user_email or "").strip().lower()
    with conn() as c, c.cursor() as cur:
        cur.execute("SELECT autor_tipo, autor_id FROM insta.comentarios WHERE id::text = %s", (cid,))
        row = cur.fetchone()
        if not row:
            raise HTTPException(404, "comentário não encontrado")
        dono = row["autor_tipo"] == "interno" and row["autor_id"] == email
        if not dono and email not in INSTA_CURADORES:
            raise HTTPException(403, "sem permissão")
        cur.execute("UPDATE insta.comentarios SET deleted_at = now() WHERE id::text = %s", (cid,))
    return {"ok": True}


# ── VISÃO DO CLIENTE (center_token, sem senha — regra CENTER SEM SENHA) ──

def _insta_projeto_por_token(token: str) -> dict:
    with conn() as c, c.cursor() as cur:
        cur.execute("""
            SELECT id::text AS projeto_id, cliente,
                   (entregue_em IS NOT NULL) AS concluido
              FROM gestao.projetos
             WHERE meta->>'center_token' = %s LIMIT 1
        """, (token,))
        row = cur.fetchone()
    if not row:
        raise HTTPException(404, "link não encontrado ou revogado")
    return row


def _insta_post_do_projeto(post_id: str, projeto_id: str):
    """Garante que o post pertence ao projeto do token (cliente nunca
    interage com post de outro perfil)."""
    with conn() as c, c.cursor() as cur:
        cur.execute("SELECT 1 FROM insta.posts WHERE id::text = %s AND projeto_id::text = %s",
                    (post_id, projeto_id))
        if not cur.fetchone():
            raise HTTPException(404, "post não encontrado")


@app.get("/api/publico/insta/{token}")
def publico_insta(token: str):
    """Perfil do cliente: só o projeto dele, com posts + interações."""
    pj = _insta_projeto_por_token(token)
    pid = pj["projeto_id"]
    with conn() as c, c.cursor() as cur:
        cur.execute(_INSTA_FEED_SQL + " WHERE p.projeto_id::text = %(pid)s ORDER BY p.created_at DESC",
                    {"vtipo": "cliente", "vid": pid, "pid": pid})
        posts = cur.fetchall()
        avatars = _insta_avatar_map(cur, [pid])
    for p in posts:
        p.pop("publicado_por", None)
    pj["avatar_url"] = avatars.get(pid)
    pj["posts"] = posts
    return pj


class InstaPublicoCurtir(BaseModel):
    post_id: str


@app.post("/api/publico/insta/{token}/curtir")
def publico_insta_curtir(token: str, payload: InstaPublicoCurtir):
    pj = _insta_projeto_por_token(token)
    _insta_post_do_projeto(payload.post_id, pj["projeto_id"])
    return _insta_toggle_curtida(payload.post_id, "cliente", pj["projeto_id"], pj["cliente"])


class InstaPublicoComentar(BaseModel):
    post_id: str
    texto: str


@app.post("/api/publico/insta/{token}/comentar")
def publico_insta_comentar(token: str, payload: InstaPublicoComentar):
    pj = _insta_projeto_por_token(token)
    _insta_post_do_projeto(payload.post_id, pj["projeto_id"])
    row = _insta_comentar(payload.post_id, "cliente", pj["projeto_id"],
                          pj["cliente"], payload.texto)
    _insta_chat_notify(pj["projeto_id"],
                       f"Comentário do cliente *{pj['cliente']}* no InstaParket: "
                       f"{row['texto'][:180]}")
    return row


@app.get("/api/publico/insta/{token}/posts/{post_id}/comentarios")
def publico_insta_comentarios(token: str, post_id: str):
    pj = _insta_projeto_por_token(token)
    _insta_post_do_projeto(post_id, pj["projeto_id"])
    return insta_comentarios(post_id)


# ──────────────────────────────────────────────────────────────────────
# Gestor de Crises — kanban ENTRADA → ANALISANDO → RESOLVENDO → RESOLVIDO
# Projeto que vira problema entra aqui via "Alertar Problema" (kanban,
# Relacionamento ou card do projeto). Histórico permanente: resolvido
# fica na coluna final com a resolução, nunca apaga.
# ──────────────────────────────────────────────────────────────────────

CRISE_COLUNAS = ("entrada", "analisando", "resolvendo", "resolvido")
CRISE_GRAVIDADES = ("leve", "media", "grave")
# Setores que fazem sentido receber crise (labels ficam no frontend).
CRISE_SETORES = (
    "comercial", "atendimento", "projetos", "producao", "obras",
    "operacional", "fiscal", "compras", "prestadores", "logistica",
    "financeiro", "orcamento", "marketing", "rh",
)


def _crise_chat_notify(card_id: str | None, texto: str):
    """Best-effort: posta no chat da obra. @Nome no texto vira menção
    (parseMentions do parket-chat) → adiciona membro + push."""
    if not card_id or not CHAT_INTERNAL_URL:
        return
    secret = _chat_internal_secret()
    if not secret:
        return
    try:
        httpx.post(f"{CHAT_INTERNAL_URL}/api/internal/obra/{card_id}/mensagem",
                   json={"content": texto},
                   headers={"x-internal-secret": secret}, timeout=8)
    except Exception:
        log.warning("crise_chat_notify_fail card=%s", card_id, exc_info=True)


def _crise_chat_alertas(texto: str):
    """Ecoa a mensagem no canal global #alertas do chat, pra toda a operação
    ver os problemas abertos num só lugar (fora da conversa da obra)."""
    if not CHAT_INTERNAL_URL:
        return
    secret = _chat_internal_secret()
    if not secret:
        return
    try:
        httpx.post(f"{CHAT_INTERNAL_URL}/api/internal/channel/alertas/mensagem",
                   json={"content": texto},
                   headers={"x-internal-secret": secret}, timeout=8)
    except Exception:
        log.warning("crise_chat_alertas_fail", exc_info=True)


class CriseNova(BaseModel):
    descricao: str
    gravidade: str = "media"
    origem: str = "manual"
    card_id: str | None = None
    projeto_id: str | None = None
    cliente: str | None = None
    setor_responsavel: str | None = None
    setores_notificar: list[str] = Field(default_factory=list)
    responsavel_email: str | None = None  # opcional pra compat
    responsavel_nome: str | None = None
    notificar: list[dict] = Field(default_factory=list)  # [{nome,email}] opcional
    prazo: str | None = None  # YYYY-MM-DD


class CrisePatch(BaseModel):
    coluna: str | None = None
    gravidade: str | None = None
    descricao: str | None = None
    setor_responsavel: str | None = None
    setores_notificar: list[str] | None = None
    responsavel_email: str | None = None
    responsavel_nome: str | None = None
    notificar: list[dict] | None = None
    prazo: str | None = None
    resolucao: str | None = None


@app.get("/api/crises")
def crises_listar(card_id: str | None = Query(default=None),
                  abertas: bool = Query(default=False)):
    sql = """SELECT c.*, p.cliente AS projeto_nome
             FROM gestao.crises c
             LEFT JOIN gestao.projetos p ON p.id = c.projeto_id
             WHERE 1=1"""
    args: list = []
    if card_id:
        sql += " AND c.card_id = %s"
        args.append(card_id)
    if abertas:
        sql += " AND c.coluna <> 'resolvido'"
    sql += " ORDER BY c.created_at DESC"
    with conn() as c, c.cursor() as cur:
        cur.execute(sql, args)
        return cur.fetchall()


@app.post("/api/crises")
def crise_criar(payload: CriseNova,
                x_user_email: str | None = Header(default=None)):
    if not (payload.descricao or "").strip():
        raise HTTPException(400, "descreva o problema percebido")
    if payload.gravidade not in CRISE_GRAVIDADES:
        raise HTTPException(400, "gravidade inválida")
    if payload.origem not in ("relacionamento", "projeto", "manual", "fiscal"):
        raise HTTPException(400, "origem inválida")
    if payload.setor_responsavel and payload.setor_responsavel not in CRISE_SETORES:
        raise HTTPException(400, f"setor_responsavel inválido: {payload.setor_responsavel}")
    setores_notificar = [s for s in (payload.setores_notificar or []) if s in CRISE_SETORES]

    card_id, projeto_id, cliente = payload.card_id, payload.projeto_id, payload.cliente
    with conn() as c, c.cursor() as cur:
        if projeto_id and not (card_id and cliente):
            cur.execute("SELECT card_id::text AS card_id, cliente FROM gestao.projetos "
                        "WHERE id::text = %s", (projeto_id,))
            row = cur.fetchone()
            if row:
                card_id = card_id or row["card_id"]
                cliente = cliente or row["cliente"]
        elif card_id and not (projeto_id and cliente):
            cur.execute("SELECT id::text AS pid, cliente FROM gestao.projetos "
                        "WHERE card_id::text = %s ORDER BY created_at DESC LIMIT 1", (card_id,))
            row = cur.fetchone()
            if row:
                projeto_id = projeto_id or row["pid"]
                cliente = cliente or row["cliente"]
        cur.execute(
            """INSERT INTO gestao.crises
                 (card_id, projeto_id, cliente, descricao, gravidade, origem,
                  setor_responsavel, setores_notificar,
                  responsavel_email, responsavel_nome, notificar, prazo, criado_por)
               VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s::jsonb,%s,%s)
               RETURNING *""",
            (card_id, projeto_id, cliente, payload.descricao.strip(),
             payload.gravidade, payload.origem,
             payload.setor_responsavel, setores_notificar,
             payload.responsavel_email, payload.responsavel_nome,
             json.dumps(payload.notificar or []), payload.prazo or None,
             (x_user_email or "").strip().lower() or None))
        crise = cur.fetchone()

    grav_label = {"leve": "LEVE", "media": "MÉDIA", "grave": "GRAVE"}[payload.gravidade]
    linhas = [f"*PROBLEMA ALERTADO — GRAVIDADE {grav_label}*",
              payload.descricao.strip()]
    if payload.prazo:
        try:
            d = payload.prazo.split("-")
            linhas.append(f"Prazo pra conclusão: {d[2]}/{d[1]}/{d[0]}")
        except IndexError:
            linhas.append(f"Prazo pra conclusão: {payload.prazo}")
    if payload.setor_responsavel:
        linhas.append(f"Setor responsável: {payload.setor_responsavel.upper()}")
    elif payload.responsavel_nome:
        linhas.append(f"Responsável: @{payload.responsavel_nome}")
    cc_setores = [s.upper() for s in setores_notificar]
    cc_nomes = []
    for pessoa in payload.notificar or []:
        nome = (pessoa.get("nome") or "").strip()
        if nome and f"@{nome}" not in cc_nomes:
            cc_nomes.append(f"@{nome}")
    cc = cc_setores + cc_nomes
    if cc:
        linhas.append("Cc: " + " · ".join(cc))
    if x_user_email:
        linhas.append(f"Aberto por {x_user_email} no Gestor de Crises")
    msg = "\n".join(linhas)
    _crise_chat_notify(card_id, msg)
    _crise_chat_alertas(msg)
    return crise


@app.patch("/api/crises/{crise_id}")
def crise_atualizar(crise_id: str, payload: CrisePatch,
                    x_user_email: str | None = Header(default=None)):
    sets: list[str] = []
    args: list = []
    if payload.coluna is not None:
        if payload.coluna not in CRISE_COLUNAS:
            raise HTTPException(400, "coluna inválida")
        sets.append("coluna = %s")
        args.append(payload.coluna)
        if payload.coluna == "resolvido":
            sets.append("resolvido_em = now()")
        else:
            sets.append("resolvido_em = NULL")
    if payload.gravidade is not None:
        if payload.gravidade not in CRISE_GRAVIDADES:
            raise HTTPException(400, "gravidade inválida")
        sets.append("gravidade = %s")
        args.append(payload.gravidade)
    if payload.descricao is not None:
        if not payload.descricao.strip():
            raise HTTPException(400, "descrição não pode ficar vazia")
        sets.append("descricao = %s")
        args.append(payload.descricao.strip())
    if payload.setor_responsavel is not None:
        sr = payload.setor_responsavel or None
        if sr and sr not in CRISE_SETORES:
            raise HTTPException(400, f"setor_responsavel inválido: {sr}")
        sets.append("setor_responsavel = %s")
        args.append(sr)
    if payload.setores_notificar is not None:
        sn = [s for s in payload.setores_notificar if s in CRISE_SETORES]
        sets.append("setores_notificar = %s")
        args.append(sn)
    if payload.responsavel_email is not None:
        sets.append("responsavel_email = %s")
        args.append(payload.responsavel_email or None)
    if payload.responsavel_nome is not None:
        sets.append("responsavel_nome = %s")
        args.append(payload.responsavel_nome or None)
    if payload.notificar is not None:
        sets.append("notificar = %s::jsonb")
        args.append(json.dumps(payload.notificar))
    if payload.prazo is not None:
        sets.append("prazo = %s")
        args.append(payload.prazo or None)
    if payload.resolucao is not None:
        sets.append("resolucao = %s")
        args.append(payload.resolucao.strip() or None)
    if not sets:
        raise HTTPException(400, "nada pra atualizar")
    args.append(crise_id)
    with conn() as c, c.cursor() as cur:
        cur.execute(f"UPDATE gestao.crises SET {', '.join(sets)} "
                    "WHERE id::text = %s RETURNING *", args)
        crise = cur.fetchone()
    if not crise:
        raise HTTPException(404, "crise não encontrada")

    if payload.coluna == "resolvido":
        linhas = ["*PROBLEMA RESOLVIDO*"]
        if crise.get("cliente"):
            linhas.append(f"Obra: {crise['cliente']}")
        linhas.append((crise.get("descricao") or "")[:200])
        if crise.get("resolucao"):
            linhas.append(f"Como foi resolvido: {crise['resolucao']}")
        if x_user_email:
            linhas.append(f"Resolvido por {x_user_email}")
        msg = "\n".join(linhas)
        if crise.get("card_id"):
            _crise_chat_notify(crise["card_id"], msg)
        _crise_chat_alertas(msg)

    # Auto-registra na timeline (system-generated) o que mudou.
    autor = (x_user_email or "").strip().lower() or None
    with conn() as c, c.cursor() as cur:
        if payload.coluna is not None:
            cur.execute(
                "INSERT INTO gestao.crise_comentario (crise_id, autor_email, texto, tipo) "
                "VALUES (%s, %s, %s, 'mudanca_coluna')",
                (crise_id, autor, f"Movido para {payload.coluna.upper()}"),
            )
        if payload.gravidade is not None:
            cur.execute(
                "INSERT INTO gestao.crise_comentario (crise_id, autor_email, texto, tipo) "
                "VALUES (%s, %s, %s, 'mudanca_gravidade')",
                (crise_id, autor, f"Gravidade alterada para {payload.gravidade.upper()}"),
            )
        if payload.resolucao is not None and payload.coluna == "resolvido":
            cur.execute(
                "INSERT INTO gestao.crise_comentario (crise_id, autor_email, texto, tipo) "
                "VALUES (%s, %s, %s, 'resolucao')",
                (crise_id, autor, payload.resolucao.strip()),
            )
    return crise


class CriseAnexo(BaseModel):
    url: str
    name: str
    mime: str | None = None
    size: int | None = None


class CriseComentarioIn(BaseModel):
    texto: str = ""
    autor_nome: str | None = None
    anexos: list[CriseAnexo] = Field(default_factory=list)
    publicar_chat: bool = True


@app.get("/api/crises/{crise_id}/comentarios")
def crise_comentarios(crise_id: str):
    with conn() as c, c.cursor() as cur:
        cur.execute(
            "SELECT id, autor_email, autor_nome, texto, tipo, meta, anexos, created_at "
            "FROM gestao.crise_comentario WHERE crise_id::text = %s "
            "ORDER BY created_at ASC",
            (crise_id,),
        )
        return cur.fetchall()


@app.post("/api/crises/{crise_id}/anexo")
async def crise_anexo_upload(
    crise_id: str,
    file: UploadFile = File(...),
    x_user_email: str | None = Header(default=None),
):
    """Upload de anexo (qualquer tipo) pra comentário de crise. Devolve
    {url,name,mime,size} pra front anexar ao POST do comentário."""
    with conn() as c, c.cursor() as cur:
        cur.execute("SELECT id FROM gestao.crises WHERE id::text = %s", (crise_id,))
        if not cur.fetchone():
            raise HTTPException(404, "crise não encontrada")
    fname = file.filename or "arquivo"
    data = await file.read()
    if not data:
        raise HTTPException(400, "arquivo vazio")
    if len(data) > 50 * 1024 * 1024:
        raise HTTPException(400, "arquivo acima de 50MB")
    ext = fname.rsplit(".", 1)[-1].lower() if "." in fname else "bin"
    ext = "".join(ch for ch in ext if ch.isalnum())[:8] or "bin"
    safe_name = "".join(ch if ch.isalnum() or ch in "._- " else "_" for ch in fname)[:120]
    rand = "".join(random.choices(string.ascii_lowercase + string.digits, k=8))
    path = f"crises/{crise_id}/{int(time.time() * 1000)}_{rand}.{ext}"
    mime = file.content_type or "application/octet-stream"
    with _storage_client() as st:
        r = st.post(f"/object/{STORAGE_BUCKET}/{path}", content=data,
                    headers={"Content-Type": mime, "x-upsert": "true"})
        if r.status_code >= 400:
            raise HTTPException(502, f"storage upload falhou: {r.text[:300]}")
    url = f"{SUPABASE_URL}/storage/v1/object/public/{STORAGE_BUCKET}/{path}"
    return {"url": url, "name": safe_name, "mime": mime, "size": len(data)}


def _fmt_bytes(n: int | None) -> str:
    if not n:
        return ""
    if n < 1024:
        return f"{n}B"
    if n < 1024 * 1024:
        return f"{n // 1024}KB"
    return f"{n / (1024 * 1024):.1f}MB"


@app.post("/api/crises/{crise_id}/comentarios")
def crise_comentar(crise_id: str, payload: CriseComentarioIn,
                   x_user_email: str | None = Header(default=None)):
    texto = (payload.texto or "").strip()
    anexos = [a.model_dump() for a in (payload.anexos or [])]
    if not texto and not anexos:
        raise HTTPException(400, "comentário vazio")
    autor = (x_user_email or "").strip().lower() or None
    with conn() as c, c.cursor() as cur:
        cur.execute(
            "SELECT c.card_id, c.cliente, p.cliente AS projeto_nome "
            "FROM gestao.crises c "
            "LEFT JOIN gestao.projetos p ON p.id = c.projeto_id "
            "WHERE c.id::text = %s",
            (crise_id,),
        )
        crise = cur.fetchone()
        if not crise:
            raise HTTPException(404, "crise não encontrada")
        cur.execute(
            "INSERT INTO gestao.crise_comentario "
            "(crise_id, autor_email, autor_nome, texto, tipo, anexos) "
            "VALUES (%s, %s, %s, %s, 'comentario', %s::jsonb) RETURNING *",
            (crise_id, autor, payload.autor_nome, texto, json.dumps(anexos)),
        )
        row = cur.fetchone()

    if payload.publicar_chat and crise.get("card_id"):
        who = autor or (payload.autor_nome or "sistema")
        linhas = [f"*Atualização de crise* ({who})"]
        if texto:
            linhas.append(texto)
        for a in anexos:
            nm = a.get("name") or "arquivo"
            sz = _fmt_bytes(a.get("size"))
            linhas.append(f"Anexo: {nm}{f' ({sz})' if sz else ''}\n{a.get('url','')}")
        _crise_chat_notify(crise["card_id"], "\n".join(linhas))
    return row


@app.post("/api/crises/{crise_id}/reabrir")
def crise_reabrir(crise_id: str, x_user_email: str | None = Header(default=None)):
    """Move crise resolvida de volta pra ANALISANDO. Registra na timeline
    e avisa no chat da obra."""
    autor = (x_user_email or "").strip().lower() or None
    with conn() as c, c.cursor() as cur:
        cur.execute("SELECT * FROM gestao.crises WHERE id::text = %s", (crise_id,))
        crise = cur.fetchone()
        if not crise:
            raise HTTPException(404, "crise não encontrada")
        if crise.get("coluna") != "resolvido":
            raise HTTPException(400, "só é possível reabrir crise resolvida")
        cur.execute(
            "UPDATE gestao.crises SET coluna = 'analisando', resolvido_em = NULL "
            "WHERE id::text = %s RETURNING *",
            (crise_id,),
        )
        atualizada = cur.fetchone()
        cur.execute(
            "INSERT INTO gestao.crise_comentario (crise_id, autor_email, texto, tipo) "
            "VALUES (%s, %s, %s, 'mudanca_coluna')",
            (crise_id, autor, f"Crise REABERTA por {autor or 'sistema'}"),
        )
    reabrir_msg = (
        f"*CRISE REABERTA*"
        + (f" — {crise['cliente']}" if crise.get("cliente") else "")
        + f"\n{crise.get('descricao','')[:200]}"
        + f"\nReaberta por {autor or 'sistema'}"
    )
    if crise.get("card_id"):
        _crise_chat_notify(crise["card_id"], reabrir_msg)
    _crise_chat_alertas(reabrir_msg)
    return atualizada


@app.post("/api/crises/{crise_id}/analise-ia")
def crise_analise_ia(crise_id: str, force: bool = Query(default=False)):
    """Puxa a crise + projeto + últimas mensagens do chat da obra e chama
    Claude pra devolver resumo + 3 sugestões de resolução. Salva o resultado
    como comentário tipo 'analise_ia' na timeline pra ficar registrado.
    Se já tem análise e force=false, devolve a última."""
    with conn() as c, c.cursor() as cur:
        cur.execute(
            """SELECT c.*, p.cliente AS projeto_nome, p.status AS projeto_status,
                      p.column_id::text AS projeto_col
                 FROM gestao.crises c
            LEFT JOIN gestao.projetos p ON p.id = c.projeto_id
                WHERE c.id::text = %s""",
            (crise_id,),
        )
        crise = cur.fetchone()
        if not crise:
            raise HTTPException(404, "crise não encontrada")
        if not force:
            cur.execute(
                "SELECT * FROM gestao.crise_comentario "
                "WHERE crise_id::text = %s AND tipo = 'analise_ia' "
                "ORDER BY created_at DESC LIMIT 1",
                (crise_id,),
            )
            existente = cur.fetchone()
            if existente:
                return existente
        cur.execute(
            "SELECT autor_email, texto, tipo, created_at FROM gestao.crise_comentario "
            "WHERE crise_id::text = %s ORDER BY created_at ASC LIMIT 60",
            (crise_id,),
        )
        historico_crise = cur.fetchall()

    # Puxa últimas mensagens do chat da obra (best-effort)
    mensagens = []
    card_id = crise.get("card_id")
    if card_id and CHAT_INTERNAL_URL:
        secret = _chat_internal_secret()
        if secret:
            try:
                r = httpx.get(
                    f"{CHAT_INTERNAL_URL}/api/internal/obra/{card_id}/mensagens",
                    params={"limit": 80},
                    headers={"X-Internal-Secret": secret},
                    timeout=8,
                )
                if r.status_code < 400:
                    mensagens = (r.json() or {}).get("messages") or []
            except Exception:
                log.warning("crise_analise_ia_chat_fail crise=%s", crise_id, exc_info=True)

    def _fmt_dt(v):
        s = str(v or "")
        return s[:16].replace("T", " ")

    linhas_msg = []
    for m in mensagens:
        who = (m.get("sender_name") or "??").strip()
        txt = (m.get("content") or "").strip().replace("\n", " ")
        if not txt:
            continue
        linhas_msg.append(f"[{_fmt_dt(m.get('created_at'))}] {who}: {txt}")
    conversa = "\n".join(linhas_msg[-80:]) or "(sem mensagens no chat da obra)"

    linhas_hist = []
    for h in historico_crise:
        who = (h.get("autor_email") or "sistema").strip()
        tipo = h.get("tipo") or ""
        txt = (h.get("texto") or "").strip().replace("\n", " ")
        linhas_hist.append(f"[{_fmt_dt(h.get('created_at'))}] ({tipo}) {who}: {txt}")
    historico = "\n".join(linhas_hist) or "(sem histórico prévio)"

    from .reuniao import CLAUDE_MODEL, CLAUDE_MAX_TOKENS, CLAUDE_TIMEOUT
    token = _anthropic_token()
    is_oauth = token.startswith("sk-ant-oat")
    headers = {"anthropic-version": "2023-06-01", "content-type": "application/json"}
    if is_oauth:
        headers["authorization"] = f"Bearer {token}"
        headers["anthropic-beta"] = "claude-code-20250219,oauth-2025-04-20,interleaved-thinking-2025-05-14"
        headers["x-app"] = "cli"
        headers["user-agent"] = "claude-cli/2.1.81 (external, cli)"
        headers["anthropic-dangerous-direct-browser-access"] = "true"
    else:
        headers["x-api-key"] = token

    projeto_nome = (crise.get("projeto_nome") or crise.get("cliente") or "obra sem nome").strip()
    setor = (crise.get("setor_responsavel") or "não atribuído").upper()
    gravidade = (crise.get("gravidade") or "media").upper()
    coluna = (crise.get("coluna") or "entrada").upper()

    system_prompt = f"""Você é analista sênior de operações da Parket (marcenaria e piso premium).
Sua função: dado o contexto de uma crise/problema numa obra, entregar UM resumo
claro do que aconteceu e TRÊS sugestões práticas de resolução ordenadas por eficácia.

REGRAS:
• Baseie-se estritamente no que está nos dados fornecidos (contexto + conversa).
• Se a conversa do chat tiver poucas mensagens, use o que tiver e diga que o contexto é limitado.
• Sugestões devem ser AÇÕES executáveis com dono e prazo aproximado.
• Sem floreio, sem "vamos ver", sem repetir a descrição da crise no resumo.
• Se houver risco crítico (perda de cliente, rescisão, ação judicial), a primeira sugestão deve endereçar isso.

RESUMO: 2-4 bullets curtos (máx 20 palavras cada) do que está acontecendo.
SUGESTÕES: 3 objetos, cada um:
  titulo: frase imperativa curta (o que fazer)
  passos: 1-3 passos concretos, com quem faz cada um
  prazo_sugerido: quando isso precisa acontecer (hoje / esta semana / próximos 15 dias)
  quem: setor/pessoa responsável pelo passo principal
"""

    user_prompt = f"""CRISE:
Cliente: {projeto_nome}
Descrição: {crise.get('descricao') or ''}
Gravidade: {gravidade}
Coluna atual do kanban: {coluna}
Setor responsável: {setor}
Prazo alvo: {crise.get('prazo') or 'não definido'}

HISTÓRICO DA CRISE (comentários e mudanças prévias):
{historico}

CONVERSA RECENTE NO CHAT DA OBRA (últimas mensagens):
{conversa}

Analise pela ferramenta analise_crise."""

    tool = {
        "name": "analise_crise",
        "description": "Análise da crise: resumo + 3 sugestões de resolução.",
        "input_schema": {
            "type": "object",
            "properties": {
                "resumo": {"type": "string", "description": "2-4 bullets curtos separados por \\n"},
                "sugestoes": {
                    "type": "array",
                    "minItems": 3, "maxItems": 3,
                    "items": {
                        "type": "object",
                        "properties": {
                            "titulo": {"type": "string"},
                            "passos": {"type": "array", "items": {"type": "string"}},
                            "prazo_sugerido": {"type": "string"},
                            "quem": {"type": "string"},
                        },
                        "required": ["titulo", "quem"],
                    },
                },
            },
            "required": ["resumo", "sugestoes"],
        },
    }
    system_block = system_prompt
    if is_oauth:
        system_block = [
            {"type": "text", "text": "x-anthropic-billing-header: cc_version=2.1.81; cc_entrypoint=api; cch=00000;"},
            {"type": "text", "text": system_prompt},
        ]
    body = {
        "model": CLAUDE_MODEL,
        "max_tokens": CLAUDE_MAX_TOKENS,
        "system": system_block,
        "tools": [tool],
        "tool_choice": {"type": "tool", "name": "analise_crise"},
        "messages": [{"role": "user", "content": user_prompt}],
    }
    try:
        with httpx.Client(timeout=CLAUDE_TIMEOUT) as h:
            r = h.post("https://api.anthropic.com/v1/messages", headers=headers, json=body)
        if r.status_code >= 400:
            log.warning("crise_analise_ia_fail status=%s body=%s", r.status_code, r.text[:400])
            raise HTTPException(502, f"claude HTTP {r.status_code}")
        data = r.json()
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(502, f"claude indisponível: {e}")

    analise = None
    for block in data.get("content", []):
        if block.get("type") == "tool_use" and block.get("name") == "analise_crise":
            analise = block.get("input") or {}
            break
    if not analise:
        raise HTTPException(502, "claude não devolveu análise estruturada")

    # Renderiza como texto legível pra ficar bonito no timeline + guarda o JSON no meta.
    linhas_out = ["Resumo da IA:"]
    linhas_out.append((analise.get("resumo") or "").strip())
    linhas_out.append("")
    linhas_out.append("Sugestões de resolução:")
    for i, s in enumerate(analise.get("sugestoes") or [], 1):
        titulo = (s.get("titulo") or "").strip()
        quem = (s.get("quem") or "").strip()
        prazo = (s.get("prazo_sugerido") or "").strip()
        passos = s.get("passos") or []
        linhas_out.append(f"{i}. {titulo}")
        if quem or prazo:
            linhas_out.append(f"   → {quem}" + (f" · {prazo}" if prazo else ""))
        for p in passos:
            linhas_out.append(f"   • {p}")
    texto_render = "\n".join(l for l in linhas_out if l is not None)

    with conn() as c, c.cursor() as cur:
        cur.execute(
            "INSERT INTO gestao.crise_comentario "
            "(crise_id, autor_email, texto, tipo, meta) "
            "VALUES (%s, %s, %s, 'analise_ia', %s::jsonb) RETURNING *",
            (crise_id, "teca-ia", texto_render,
             json.dumps({"conv_msgs": len(mensagens), "raw": analise})),
        )
        return cur.fetchone()
