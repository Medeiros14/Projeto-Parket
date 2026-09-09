"""Ponte projetos-app ↔ gestao.itens.

O card do projetos-app espelha um Trello card. Cada Trello card com
`space_card_id` set aponta pro card_id da gestao.projetos — que agrupa
os itens vendidos do orçamento em `gestao.itens`.

O setor de Projetos usa a aba Produtos pra:
  • listar os produtos do card (itens de gestao)
  • liberar cada item (ok'ando pro próximo setor)
  • liberar item de marcenaria pra produção (chip pro PCP)
  • corrigir ambiente in-loco (dado do orçamento vem esparso)
  • anexar a medição fina do PROJETO (nível card, não item — pode
    ter 1+ docs) — projeto executivo cobre toda a marcenaria da obra
  • ver automaticamente as capturas do fiscal/instala do mesmo item

Flags de liberação em `gestao.itens.meta` (sem migration):
  • liberado_projetos           bool
  • liberado_projetos_em        ISO ts
  • liberado_projetos_por       email
  • liberado_para_producao      bool   (subset: só marcenaria/porta vão)
  • liberado_para_producao_em   ISO ts
  • liberado_para_producao_por  email do login que clicou
  • liberado_para_producao_autor nome de QUEM autorizou (obrigatório, Will 25/08)

Anexos em `gestao.fotos`:
  • item_id IS NULL + tipo='medicao_fina_card' + origem='projetos'
      → medição fina do PROJETO (novo, nível card)
  • item_id = X + origem='fiscal'|'instala'
      → capturas em obra que o fiscal/instala subiu, mostradas
        na linha do item correspondente
"""
import json
import os
import re
import time
import uuid
from pathlib import Path

from fastapi import APIRouter, Depends, File, Form, Header, HTTPException, UploadFile
from pydantic import BaseModel

from .auth import require_user
from .db import conn
from .settings import settings

router = APIRouter()


ANEXOS_ITEM_DIR    = Path(settings.data_dir) / "anexos" / "item"
ANEXOS_MEDICAO_DIR = Path(settings.data_dir) / "anexos" / "medicao"
MAX_ANEXO_BYTES = 100 * 1024 * 1024

# Categorias em que Projetos precisa liberar pra Produção Parket
# (marcenaria + porta são as fabricadas na fábrica).
PRODUCAO_RAIZ = {"MARCENARIA", "PORTA"}


# ─── helpers ─────────────────────────────────────────────────────────

def _projeto_do_card(cur, card_id: str) -> dict | None:
    """Vínculo trello_projetos.cards.space_card_id (uuid) =
    gestao.projetos.card_id (uuid). None se card sem projeto.

    QUÊ: tenta primeiro o vínculo direto (space_card_id); se o projeto
    da gestão vive num card IRMÃO de outro dept (mesma obra, padrão dos
    contadores/aba Fiscal, main.py usa [sid, *irmaos]), cai pro
    space_card_ids_obra. Sem o fallback, 76 cards abertos ficavam com a
    aba Produtos vazia mesmo com itens na gestão (auditoria 02/09)."""
    cur.execute("""
        SELECT p.id, p.cliente
          FROM trello_projetos.cards k
          JOIN gestao.projetos p ON p.card_id = k.space_card_id
         WHERE k.id = %s
    """, (card_id,))
    row = cur.fetchone()
    if row:
        return row
    cur.execute("""
        SELECT p.id, p.cliente
          FROM trello_projetos.cards k
          JOIN gestao.projetos p
            ON p.card_id::text IN (
                 SELECT jsonb_array_elements_text(
                          COALESCE(k.space_card_ids_obra, '[]'::jsonb)))
         WHERE k.id = %s
         -- se a obra tem mais de um projeto gestão, prioriza o que tem itens
         ORDER BY EXISTS (SELECT 1 FROM gestao.itens i
                           WHERE i.projeto_id = p.id) DESC,
                  p.created_at DESC NULLS LAST
         LIMIT 1
    """, (card_id,))
    return cur.fetchone()


def _categoria_raiz(row: dict) -> str:
    meta = row.get("meta") or {}
    raiz = (meta.get("categoria_raiz") or "").strip().upper()
    if not raiz:
        raiz = (row.get("categoria") or "").split("|", 1)[0].strip().upper()
    blob = " ".join([
        (row.get("categoria") or ""), (row.get("descritivo") or ""),
        str((meta.get("subtipo") or "")), str((meta.get("especie") or "")),
    ]).upper()
    # FORRO LAMINADO é fabricado igual marcenaria (Thainara aprova pra produção).
    if raiz == "FORRO" and "LAMINAD" in blob:
        return "MARCENARIA"
    # CORTINEIRO e ALÇAPÃO são recortes que a fábrica faz — cai em MARCENARIA.
    if ("CORTINEIR" in blob) or ("ALCAPA" in blob) or ("ALÇAPA" in blob) or ("ALÇAPÃO" in blob):
        return "MARCENARIA"
    return raiz


def _pode_producao(raiz: str) -> bool:
    return raiz in PRODUCAO_RAIZ


def _codigo_do_item(row: dict) -> str:
    """Código canônico 1.1, 1.2, 6.3… que segue entre setores
    (orçamento → projetos → produção → instala). Fallback quando
    meta.codigo não veio do import: deriva do `ordem`:
      • ordem < 1000  → 1-a-1 direto ("1", "2"…)
      • ordem >= 1000 → grupo.item ("4001" → "4.1", "1002" → "1.2")
    Match do esquema histórico onde ordem = grupo_raiz*1000 + subitem."""
    meta = row.get("meta") or {}
    cod = (meta.get("codigo") or "").strip()
    if cod:
        return cod
    # Tenta puxar do prefixo do descritivo — imports mais novos gravam
    # "1.1 · ..." ou "5.2 · ..." no início.
    desc = (row.get("descritivo") or "").lstrip()
    import re as _re
    m = _re.match(r"^(\d+(?:\.\d+){1,2})\s*[·\-–]\s*", desc)
    if m:
        return m.group(1)
    ordem = int(row.get("ordem") or 0)
    if ordem <= 0:
        return ""
    if ordem >= 1000:
        return f"{ordem // 1000}.{ordem % 1000}"
    return str(ordem)


def _serializar_foto(r: dict) -> dict:
    return {
        "id": str(r["id"]),
        "url": r.get("url_web") or r["url"],
        "nome": r.get("legenda") or Path(r.get("storage_path") or r["url"]).name,
        "tipo": r.get("tipo") or "foto",
        "origem": r.get("origem") or "upload",
        "por": r.get("autor_email"),
        "criado_em": r["created_at"].isoformat() if r.get("created_at") else None,
    }


def _capturas_do_item(cur, item_id: str) -> list[dict]:
    """Fotos que fiscal/instala subiram DO item (item_id casa).
    Projetos-app não sobe mais por item — só pra card (item_id NULL)."""
    cur.execute("""
        SELECT id, url, url_web, storage_path, legenda, tipo, origem,
               autor_email, created_at
          FROM gestao.fotos
         WHERE item_id = %s
         ORDER BY created_at DESC
    """, (item_id,))
    return [_serializar_foto(r) for r in cur.fetchall()]


def _medicao_fina_do_projeto(cur, projeto_id: str) -> list[dict]:
    """Docs da medição fina — nível projeto/card, item_id NULL.
    Marcados com tipo='medicao_fina_card' pra não misturar com
    outras fotos do projeto que também tenham item_id NULL."""
    cur.execute("""
        SELECT id, url, url_web, storage_path, legenda, tipo, origem,
               autor_email, created_at
          FROM gestao.fotos
         WHERE projeto_id = %s
           AND item_id IS NULL
           AND tipo = 'medicao_fina_card'
           AND origem = 'projetos'
         ORDER BY created_at DESC
    """, (projeto_id,))
    return [_serializar_foto(r) for r in cur.fetchall()]


def _serializar_item(row: dict, capturas: list[dict]) -> dict:
    meta = row.get("meta") or {}
    raiz = _categoria_raiz(row)
    return {
        "id": str(row["id"]),
        "ordem": row.get("ordem") or 0,
        "categoria": row.get("categoria") or "",
        "categoria_raiz": raiz,
        "descritivo": row.get("descritivo") or "",
        "ambiente": row.get("ambiente") or "",
        "quantidade": float(row["quantidade"]) if row.get("quantidade") is not None else 0.0,
        "unidade": row.get("unidade") or "un",
        "status": row.get("status") or "pendente",
        "codigo": _codigo_do_item(row),
        "produto_header": meta.get("produto_header") or "",
        "pavimento": meta.get("pavimento") or "",
        "pode_producao": _pode_producao(raiz),
        "liberado_projetos": bool(meta.get("liberado_projetos")),
        "liberado_projetos_em": meta.get("liberado_projetos_em"),
        "liberado_projetos_por": meta.get("liberado_projetos_por"),
        "liberado_para_producao": bool(meta.get("liberado_para_producao")),
        "liberado_para_producao_em": meta.get("liberado_para_producao_em"),
        "liberado_para_producao_por": meta.get("liberado_para_producao_por"),
        # Nome de quem AUTORIZOU (digitado no modal), distinto do _por (login).
        "liberado_para_producao_autor": meta.get("liberado_para_producao_autor"),
        "qtd_liberada_producao": meta.get("qtd_liberada_producao"),
        "obs_producao": meta.get("obs_producao") or "",
        "liberacoes_log": meta.get("liberacoes_log") or [],
        "capturas_campo": capturas,
    }


# ─── endpoints ───────────────────────────────────────────────────────

@router.get("/api/cards/{card_id}/itens")
def listar_itens_do_card(card_id: str, _user: dict = Depends(require_user)):
    """Lista itens do projeto vinculado ao card + medição fina do
    projeto (nível card). Vazio (não 404) quando o card não tem
    projeto — UI mostra placeholder."""
    with conn() as c, c.cursor() as cur:
        proj = _projeto_do_card(cur, card_id)
        if not proj:
            return {"projeto": None, "itens": [], "medicao_fina": []}
        cur.execute("""
            SELECT id, ordem, categoria, descritivo, ambiente,
                   quantidade, unidade, status, meta
              FROM gestao.itens
             WHERE projeto_id = %s
             ORDER BY ordem, categoria
        """, (proj["id"],))
        rows = cur.fetchall()
        itens = [_serializar_item(r, _capturas_do_item(cur, str(r["id"]))) for r in rows]
        medicao = _medicao_fina_do_projeto(cur, str(proj["id"]))
    return {
        "projeto": {"id": str(proj["id"]), "cliente": proj["cliente"]},
        "itens": itens,
        "medicao_fina": medicao,
    }


class LiberarBody(BaseModel):
    para_producao: bool = False
    desfazer: bool = False   # True zera as duas flags
    # Liberação parcial pra produção: quantas unidades já podem ser
    # fabricadas (ex.: 18 de 20 portas). None = quantidade total.
    qtd_liberada: float | None = None
    # Observação do projetista que viaja junto pro card do PCP.
    obs_producao: str | None = None
    # QUEM está autorizando a liberação pra produção (nome, obrigatório
    # quando para_producao=True). Pode ser diferente do login: a Thainara
    # libera em nome do chefe que mandou começar (Will 25/08).
    autor_liberacao: str | None = None


class AmbientePatch(BaseModel):
    ambiente: str


def _log_liberacao(meta: dict, em: str, por: str | None, acao: str, **extra) -> None:
    log = meta.get("liberacoes_log")
    if not isinstance(log, list):
        log = []
    entry = {"em": em, "por": por, "acao": acao}
    entry.update({k: v for k, v in extra.items() if v is not None})
    log.append(entry)
    meta["liberacoes_log"] = log[-50:]


def _get_item(cur, item_id: str) -> dict | None:
    cur.execute("SELECT id, projeto_id, meta, categoria, descritivo, quantidade "
                "FROM gestao.itens WHERE id = %s",
                (item_id,))
    return cur.fetchone()


@router.post("/api/itens/{item_id}/liberar")
def liberar_item(item_id: str, body: LiberarBody,
                 user: dict = Depends(require_user)):
    x_user_email = user["email"]
    """Marca (ou desfaz) liberação do item pelo setor de Projetos.
    Idempotente. `para_producao=True` exige categoria compatível."""
    from datetime import datetime, timezone
    now = datetime.now(timezone.utc).isoformat()
    with conn() as c, c.cursor() as cur:
        row = _get_item(cur, item_id)
        if not row:
            raise HTTPException(404, "item não encontrado")
        meta = row.get("meta") or {}
        raiz = _categoria_raiz(row)

        qtd_total = float(row.get("quantidade") or 0)

        if body.desfazer:
            for k in ("liberado_projetos", "liberado_projetos_em", "liberado_projetos_por",
                      "liberado_para_producao", "liberado_para_producao_em",
                      "liberado_para_producao_por", "liberado_para_producao_autor",
                      "qtd_liberada_producao", "obs_producao"):
                meta.pop(k, None)
            _log_liberacao(meta, now, x_user_email, acao="desfazer")
        else:
            if body.para_producao and not _pode_producao(raiz):
                raise HTTPException(400,
                    f"categoria {raiz or '(vazia)'} não vai pra produção Parket "
                    f"(só MARCENARIA/PORTA)")
            meta["liberado_projetos"] = True
            meta["liberado_projetos_em"] = now
            if x_user_email:
                meta["liberado_projetos_por"] = x_user_email
            if body.para_producao:
                # Quem AUTORIZOU é obrigatório (Will 25/08): a liberação pode
                # vir de ordem de chefia, então o nome não é sempre o do login.
                autor = (body.autor_liberacao or "").strip()
                if not autor:
                    raise HTTPException(400,
                        "informe quem está autorizando a liberação pra produção")
                qtd = body.qtd_liberada if body.qtd_liberada is not None else qtd_total
                qtd = max(0.0, min(float(qtd), qtd_total) if qtd_total > 0 else float(qtd))
                meta["liberado_para_producao"] = True
                meta["liberado_para_producao_em"] = now
                if x_user_email:
                    meta["liberado_para_producao_por"] = x_user_email
                meta["liberado_para_producao_autor"] = autor[:120]
                meta["qtd_liberada_producao"] = qtd
                obs = (body.obs_producao or "").strip()
                if obs:
                    meta["obs_producao"] = obs
                elif body.obs_producao is not None:
                    meta.pop("obs_producao", None)
                _log_liberacao(meta, now, x_user_email, acao="liberar_producao",
                               qtd=qtd, qtd_total=qtd_total, obs=obs or None,
                               autor=autor[:120])
            else:
                meta.pop("liberado_para_producao", None)
                meta.pop("liberado_para_producao_em", None)
                meta.pop("liberado_para_producao_por", None)
                meta.pop("liberado_para_producao_autor", None)
                meta.pop("qtd_liberada_producao", None)
                _log_liberacao(meta, now, x_user_email, acao="liberar_projetos")

        cur.execute("UPDATE gestao.itens SET meta = %s WHERE id = %s RETURNING id",
                    (json.dumps(meta), item_id))
        if not cur.fetchone():
            raise HTTPException(500, "falha ao atualizar item")
    return {"ok": True}


@router.patch("/api/itens/{item_id}/ambiente")
def editar_ambiente(item_id: str, body: AmbientePatch,
                    _user: dict = Depends(require_user)):
    """Corrige o ambiente do item inline. Muitos itens chegam sem
    ambiente do orçamento (ex.: "RECORTES - DIVERSOS 28 un" sem
    detalhamento por sala) — projetos preenche em obra."""
    novo = (body.ambiente or "").strip()
    with conn() as c, c.cursor() as cur:
        cur.execute(
            "UPDATE gestao.itens SET ambiente = %s WHERE id = %s RETURNING id",
            (novo or None, item_id))
        if not cur.fetchone():
            raise HTTPException(404, "item não encontrado")
    return {"ok": True, "ambiente": novo}


_SANE_RE = re.compile(r"[^A-Za-z0-9._\-]+")

def _sanitize_name(name: str) -> str:
    base = os.path.basename(name or "arquivo").strip() or "arquivo"
    return _SANE_RE.sub("_", base)[:120]


_IMG_EXT = {".png", ".jpg", ".jpeg", ".gif", ".webp", ".bmp", ".svg", ".avif"}

def _tipo_por_ext(fname: str) -> str:
    ext = Path(fname).suffix.lower()
    if ext in _IMG_EXT:                          return "foto"
    if ext == ".pdf":                            return "projeto_pdf"
    if ext in {".dwg", ".dxf"}:                  return "projeto_cad"
    return "arquivo"


@router.post("/api/cards/{card_id}/medicao-anexo")
async def anexar_medicao_do_card(card_id: str,
                                 arquivo: UploadFile = File(...),
                                 legenda: str = Form(""),
                                 user: dict = Depends(require_user)):
    x_user_email = user["email"]
    """Sobe um doc de medição fina do PROJETO inteiro (nível card).
    Aceita múltiplos — cada upload cria uma linha nova, não substitui
    (Will 19/08: pode ser 1 ou mais docs).

    Grava em `gestao.fotos` com item_id NULL, tipo='medicao_fina_card',
    origem='projetos' — fica visível também no gestão."""
    content = await arquivo.read()
    if not content:
        raise HTTPException(400, "arquivo vazio")
    if len(content) > MAX_ANEXO_BYTES:
        raise HTTPException(413, "arquivo acima de 100 MB")

    with conn() as c, c.cursor() as cur:
        proj = _projeto_do_card(cur, card_id)
        if not proj:
            raise HTTPException(404,
                "card sem projeto vinculado no gestão — vendido não chegou ainda")

        nome_seguro = _sanitize_name(arquivo.filename or "arquivo")
        prefixo = f"{int(time.time())}_{uuid.uuid4().hex[:6]}"
        dir_proj = ANEXOS_MEDICAO_DIR / str(proj["id"])
        dir_proj.mkdir(parents=True, exist_ok=True)
        arq_path = dir_proj / f"{prefixo}_{nome_seguro}"
        arq_path.write_bytes(content)

        url_rel = f"/anexos/medicao/{proj['id']}/{arq_path.name}"
        cur.execute("""
            INSERT INTO gestao.fotos
              (projeto_id, item_id, url, url_web, storage_path,
               legenda, autor_email, tipo, origem)
            VALUES (%s, NULL, %s, %s, %s, %s, %s, 'medicao_fina_card', 'projetos')
            RETURNING id
        """, (proj["id"], url_rel, url_rel, str(arq_path),
              (legenda or nome_seguro).strip(),
              x_user_email))
        foto_id = cur.fetchone()["id"]

    return {"ok": True, "id": str(foto_id), "url": url_rel}


@router.delete("/api/cards/{card_id}/medicao-anexo/{foto_id}")
def remover_medicao_do_card(card_id: str, foto_id: str,
                            _user: dict = Depends(require_user)):
    """Apaga um doc da medição fina do card. Só permite se de fato
    for uma linha nível-card (item_id NULL + tipo/origem corretos)
    pra evitar apagar por engano captura de fiscal/instala."""
    with conn() as c, c.cursor() as cur:
        proj = _projeto_do_card(cur, card_id)
        if not proj:
            raise HTTPException(404, "card sem projeto")
        cur.execute("""
            SELECT id, storage_path
              FROM gestao.fotos
             WHERE id = %s
               AND projeto_id = %s
               AND item_id IS NULL
               AND tipo = 'medicao_fina_card'
               AND origem = 'projetos'
        """, (foto_id, proj["id"]))
        row = cur.fetchone()
        if not row:
            raise HTTPException(404, "medição não encontrada")
        cur.execute("DELETE FROM gestao.fotos WHERE id = %s", (foto_id,))
        sp = row.get("storage_path")
        if sp and sp.startswith(str(ANEXOS_MEDICAO_DIR)):
            try: os.unlink(sp)
            except FileNotFoundError: pass
    return {"ok": True}
