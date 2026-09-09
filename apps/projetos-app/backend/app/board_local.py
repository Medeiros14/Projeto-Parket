"""Writes do board DIRETO no banco local (trello_projetos.*).

QUE FAZ: implementa tudo que antes ia pra API do Trello (editar card,
checklists, anexos, labels, membros, arquivar) gravando direto nas tabelas
locais. O banco local passou a ser a FONTE DA VERDADE do setor de Projetos.
POR QUE: Will 02/09 mandou tirar o vínculo com o Trello — o time usa só o
projetos.parket.works; as mesmas funcionalidades (negrito na descrição,
checklist, etiqueta, capa, anexo) continuam, sem depender de serviço externo.

O schema segue chamado trello_projetos por herança (rename mexeria em
watcher + push + relatório + calendar); as tabelas labels e membros foram
seedadas com o snapshot final do board em 02/09/2026.
"""
import json
import os
import re
import unicodedata
import uuid

from .db import conn
from .settings import settings

MAX_ANEXO_BYTES = 100 * 1024 * 1024

IMG_EXT = (".png", ".jpg", ".jpeg", ".gif", ".webp", ".bmp", ".svg", ".avif")
# Só o que o navegador renderiza — mime começando com image/ não basta
# (.dwg vem como image/vnd.dwg e .heic como image/heic → capa quebrada).
IMG_MIME = {"image/png", "image/jpeg", "image/gif", "image/webp",
            "image/bmp", "image/svg+xml", "image/avif"}


def _novo_id() -> str:
    """Id de 24 hex, mesmo formato dos ids herdados do Trello — assim nada
    a jusante (watcher, push, URLs de anexo) precisa distinguir card velho
    de card novo."""
    return uuid.uuid4().hex[:24]


def _safe_name(nome: str, max_len: int = 80) -> str:
    nome = unicodedata.normalize("NFKD", nome or "").encode("ascii", "ignore").decode()
    nome = re.sub(r"[^A-Za-z0-9._-]+", "_", nome).strip("_")
    return nome[-max_len:] or "arquivo"


def _is_imagem(mime: str | None, nome: str | None) -> bool:
    if mime and mime.lower() in IMG_MIME:
        return True
    return bool(nome) and nome.lower().endswith(IMG_EXT)


def _touch(cur, card_id: str) -> None:
    """Toda escrita marca atividade — o kanban ordena/realça por isso."""
    cur.execute("UPDATE trello_projetos.cards SET date_last_activity = now(), "
                "sync_at = now() WHERE id = %s", (card_id,))


def _card_existe(cur, card_id: str) -> None:
    cur.execute("SELECT 1 FROM trello_projetos.cards WHERE id = %s", (card_id,))
    if not cur.fetchone():
        raise ValueError(f"card {card_id} não existe")


"""─── Card (nome / descrição / prazo / lista) ───"""


def escrever_card(card_id: str, params: dict) -> None:
    """Aceita as MESMAS chaves que o PUT do Trello aceitava (name, desc, due,
    dueComplete, idList) pra não mexer no contrato do endpoint."""
    sets, vals = [], []
    if "name" in params:
        sets.append("nome = %s"); vals.append(params["name"])
    if "desc" in params:
        sets.append("descricao = %s"); vals.append(params["desc"])
    if "due" in params:
        # "null"/"" limpa o prazo (convenção herdada do endpoint antigo)
        due = params["due"]
        sets.append("due = %s"); vals.append(None if due in ("null", "", None) else due)
    if "dueComplete" in params:
        sets.append("due_complete = %s")
        vals.append(str(params["dueComplete"]).lower() == "true")
    if "idList" in params:
        sets.append("lista_id = %s"); vals.append(params["idList"])
        # Trello punha o card movido no topo da lista nova; mantém o hábito.
        sets.append("pos = (SELECT COALESCE(MIN(pos), 65536) - 1024 "
                    "FROM trello_projetos.cards WHERE lista_id = %s)")
        vals.append(params["idList"])
    if not sets:
        return
    with conn() as c, c.cursor() as cur:
        _card_existe(cur, card_id)
        cur.execute(f"UPDATE trello_projetos.cards SET {', '.join(sets)}, "
                    "date_last_activity = now(), sync_at = now() WHERE id = %s",
                    (*vals, card_id))


def arquivar_card(card_id: str) -> None:
    """closed=true — card some do kanban (query filtra NOT closed) mas fica
    no banco; reabrir = UPDATE closed=false direto no banco."""
    with conn() as c, c.cursor() as cur:
        _card_existe(cur, card_id)
        cur.execute("UPDATE trello_projetos.cards SET closed = true, sync_at = now() "
                    "WHERE id = %s", (card_id,))


"""─── Checklists (JSONB cards.checklists, formato herdado do sync) ───"""


def _com_checklists(cur, card_id: str) -> list:
    cur.execute("SELECT checklists FROM trello_projetos.cards WHERE id = %s", (card_id,))
    row = cur.fetchone()
    if not row:
        raise ValueError(f"card {card_id} não existe")
    return row["checklists"] or []


def _salvar_checklists(cur, card_id: str, chs: list) -> None:
    cur.execute("UPDATE trello_projetos.cards SET checklists = %s::jsonb WHERE id = %s",
                (json.dumps(chs), card_id))
    _touch(cur, card_id)


def add_checklist(card_id: str, nome: str) -> dict:
    with conn() as c, c.cursor() as cur:
        chs = _com_checklists(cur, card_id)
        novo = {"id": _novo_id(), "nome": nome,
                "pos": (max((ch.get("pos") or 0) for ch in chs) + 1024) if chs else 1024,
                "itens": []}
        chs.append(novo)
        _salvar_checklists(cur, card_id, chs)
    # name na resposta = compat com o retorno da API antiga
    return {"id": novo["id"], "name": nome}


def remover_checklist(card_id: str, checklist_id: str) -> None:
    with conn() as c, c.cursor() as cur:
        chs = _com_checklists(cur, card_id)
        _salvar_checklists(cur, card_id, [ch for ch in chs if ch.get("id") != checklist_id])


def add_checkitem(card_id: str, checklist_id: str, nome: str) -> None:
    with conn() as c, c.cursor() as cur:
        chs = _com_checklists(cur, card_id)
        for ch in chs:
            if ch.get("id") == checklist_id:
                ch.setdefault("itens", []).append(
                    {"id": _novo_id(), "nome": nome, "done": False})
                break
        else:
            raise ValueError(f"checklist {checklist_id} não existe no card")
        _salvar_checklists(cur, card_id, chs)


def remover_checkitem(card_id: str, checklist_id: str, item_id: str) -> None:
    with conn() as c, c.cursor() as cur:
        chs = _com_checklists(cur, card_id)
        for ch in chs:
            if ch.get("id") == checklist_id:
                ch["itens"] = [i for i in (ch.get("itens") or []) if i.get("id") != item_id]
        _salvar_checklists(cur, card_id, chs)


def marcar_checkitem(card_id: str, item_id: str, done: bool) -> None:
    with conn() as c, c.cursor() as cur:
        chs = _com_checklists(cur, card_id)
        for ch in chs:
            for i in ch.get("itens") or []:
                if i.get("id") == item_id:
                    i["done"] = done
        _salvar_checklists(cur, card_id, chs)


"""─── Anexos (disco local em data_dir/anexos/<card>/ + row no banco) ───"""


def anexar_arquivo(card_id: str, nome: str, content: bytes, mime: str | None) -> dict:
    aid = _novo_id()
    rel = f"anexos/{card_id}/{aid}_{_safe_name(nome)}"
    dest = os.path.join(settings.data_dir, rel)
    os.makedirs(os.path.dirname(dest), exist_ok=True)
    with open(dest, "wb") as f:
        f.write(content)
    with conn() as c, c.cursor() as cur:
        _card_existe(cur, card_id)
        cur.execute("""
            INSERT INTO trello_projetos.anexos
                (id, card_id, nome, mime, bytes, path_local, is_imagem,
                 is_upload, baixado, criado_em)
            VALUES (%s,%s,%s,%s,%s,%s,%s,true,true,now())
        """, (aid, card_id, nome, mime, len(content), rel,
              _is_imagem(mime, nome)))
        _touch(cur, card_id)
    return {"id": aid, "nome": nome, "path_local": rel}


def remover_anexo(card_id: str, anexo_id: str) -> None:
    with conn() as c, c.cursor() as cur:
        cur.execute("SELECT path_local FROM trello_projetos.anexos WHERE id = %s", (anexo_id,))
        row = cur.fetchone()
        cur.execute("DELETE FROM trello_projetos.anexos WHERE id = %s", (anexo_id,))
        _touch(cur, card_id)
    if row and row.get("path_local"):
        try:
            os.remove(os.path.join(settings.data_dir, row["path_local"]))
        except OSError:
            pass


"""─── Labels e membros (catálogo local seedado do snapshot do board) ───"""


def toggle_label(card_id: str, label_id: str, on: bool) -> None:
    with conn() as c, c.cursor() as cur:
        cur.execute("SELECT labels FROM trello_projetos.cards WHERE id = %s", (card_id,))
        row = cur.fetchone()
        if not row:
            raise ValueError(f"card {card_id} não existe")
        labels = [l for l in (row["labels"] or []) if l.get("id") != label_id]
        if on:
            cur.execute("SELECT id, nome, cor FROM trello_projetos.labels WHERE id = %s",
                        (label_id,))
            cat = cur.fetchone()
            if not cat:
                raise ValueError(f"label {label_id} não existe no catálogo")
            labels.append({"id": cat["id"], "nome": cat["nome"], "cor": cat["cor"]})
        cur.execute("UPDATE trello_projetos.cards SET labels = %s::jsonb WHERE id = %s",
                    (json.dumps(labels), card_id))
        _touch(cur, card_id)


def toggle_membro(card_id: str, membro_id: str, on: bool) -> None:
    with conn() as c, c.cursor() as cur:
        cur.execute("SELECT membros FROM trello_projetos.cards WHERE id = %s", (card_id,))
        row = cur.fetchone()
        if not row:
            raise ValueError(f"card {card_id} não existe")
        membros = [m for m in (row["membros"] or []) if m.get("id") != membro_id]
        if on:
            cur.execute("SELECT id, nome, iniciais FROM trello_projetos.membros WHERE id = %s",
                        (membro_id,))
            cat = cur.fetchone()
            if not cat:
                raise ValueError(f"membro {membro_id} não existe no catálogo")
            membros.append({"id": cat["id"], "nome": cat["nome"],
                            "iniciais": cat["iniciais"]})
        cur.execute("UPDATE trello_projetos.cards SET membros = %s::jsonb WHERE id = %s",
                    (json.dumps(membros), card_id))
        _touch(cur, card_id)


def board_meta() -> dict:
    """Etiquetas, membros e listas pros pickers de edição — tudo local."""
    with conn() as c, c.cursor() as cur:
        cur.execute("SELECT id, nome, cor FROM trello_projetos.labels ORDER BY nome")
        labels = cur.fetchall()
        cur.execute("SELECT id, nome, iniciais FROM trello_projetos.membros ORDER BY nome")
        membros = cur.fetchall()
        cur.execute("SELECT id, nome, pos FROM trello_projetos.listas "
                    "WHERE NOT closed ORDER BY pos")
        listas = cur.fetchall()
    return {"labels": labels, "membros": membros, "listas": listas}
