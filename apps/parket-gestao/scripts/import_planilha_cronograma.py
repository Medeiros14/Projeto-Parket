"""Import Fase 1 · projetos da planilha do Will → gestao.projetos + itens.

Fluxo:
  1. baixa CSV da planilha do Will (68 linhas ativas)
  2. pra cada nome_obra, tenta casar com kanban_cards.title do dept=operacional
  3. se match único: upsert gestao.projetos + wipe+insert gestao.itens (do details.cronograma_pmo)
  4. aplica planilha por cima: responsavel (=EQUIPE da planilha) + previsao_fim (=DATA DE FINALIZAÇÃO)
  5. reporta: aplicados / ambíguos / sem_match / sem_cronograma_pmo

Uso:
  # dry-run (padrão): só imprime relatório, nada é escrito
  python3 import_planilha_cronograma.py

  # execução real:
  python3 import_planilha_cronograma.py --apply
"""
from __future__ import annotations
import argparse, csv, io, json, os, re, sys, unicodedata
from datetime import date, timedelta
from urllib.request import urlopen, Request

# ── Parse do padrão "DIAS" da planilha em dias-da-semana (0=seg .. 6=dom) ──
_DIA_TOKEN = {
    "SEG": 0, "SEGUNDA": 0, "TER": 1, "TERCA": 1, "QUA": 2, "QUARTA": 2,
    "QUI": 3, "QUINTA": 3, "SEX": 4, "SEXTA": 4, "SAB": 5, "SABADO": 5,
    "DOM": 6, "DOMINGO": 6,
}
_ORDER = [0, 1, 2, 3, 4, 5, 6]


def parse_dias_semana(pat: str) -> set[int]:
    """"SEG A SEX" → {0..4} · "SEG E SEX" → {0,4} · "SEQUENCIA"/"" → {0..6}."""
    p = norm(pat)
    if not p or "SEQUENC" in p or "DEFINIR" in p or "NAO LIB" in p or "TRAVAD" in p:
        return set(_ORDER)
    # tokeniza SEG/TER/QUA/QUI/SEX/SAB/DOM em ordem, guarda os separadores entre eles
    toks: list[int] = []
    pos: list[int] = []
    for m in re.finditer(r"\b(SEG(?:UNDA)?|TER(?:CA)?|QUA(?:RTA)?|QUI(?:NTA)?|SEX(?:TA)?|SAB(?:ADO)?|DOM(?:INGO)?)\b", p):
        toks.append(_DIA_TOKEN[m.group(1)[:3]])
        pos.append(m.start())
    if not toks:
        return set(_ORDER)
    if len(toks) == 1:
        return {toks[0]}
    # se aparece " A " entre 2 dias → intervalo circular; senão, conjunto discreto
    joiners_A = " A " in f" {p} " or re.search(r" A(SEX| SEX| QUA| TER| DOM| SAB| SEG| QUI)", p)
    if joiners_A:
        i0, i1 = toks[0], toks[-1]
        out, d = set(), i0
        for _ in range(8):
            out.add(d)
            if d == i1:
                break
            d = (d + 1) % 7
        return out
    return set(toks)


def sub_business_days(fim: date, n: int, dias_semana: set[int]) -> date:
    """Volta n dias no calendário considerando só dias em dias_semana."""
    if n <= 0 or not dias_semana:
        return fim
    d = fim
    contados = 0
    # inclui o próprio dia final se ele é dia útil da equipe
    if d.weekday() in dias_semana:
        contados = 1
    while contados < n:
        d = d - timedelta(days=1)
        if d.weekday() in dias_semana:
            contados += 1
    return d

SHEET_ID   = "1PjgQTnFfziw4HRLFi_xhwIiT-OzJHcd-oU5_-e8lzII"
# 3 abas: OBRAS/INSTALAÇÃO (gid=0), MARCENARIA (gid=527900047), REPAROS (gid=1680010483)
SHEETS = [
    ("obras",      0,          "obras"),   # aba OBRAS → linhas em cronograma_obras.tipo=obras
    ("marcenaria", 527900047,  "marcenaria"),
    ("reparos",    1680010483, "reparos"),
]
def sheet_url(gid: int) -> str:
    return f"https://docs.google.com/spreadsheets/d/{SHEET_ID}/export?format=csv&gid={gid}"
SUPA_URL   = "https://hbxpilrxmitvzebluoom.supabase.co"
SUPA_KEY   = os.environ.get("SUPA_KEY") or ""

PG_HOST    = os.environ.get("GESTAO_PG_HOST", "parket-pg-local_postgres")
PG_USER    = os.environ.get("GESTAO_PG_USER", "postgres")
PG_DB      = os.environ.get("GESTAO_PG_DB",   "postgres")
PG_PASS    = os.environ.get("GESTAO_PG_PASS", "")


def norm(s: str) -> str:
    s = (s or "").strip()
    s = unicodedata.normalize("NFD", s).encode("ascii", "ignore").decode()
    s = re.sub(r"[^A-Z0-9]+", " ", s.upper()).strip()
    s = re.sub(r"\s+", " ", s)
    return s


def parse_dt(s: str) -> str | None:
    """'24.7.2026' | '05.08.2026' | 'TRAVADO' | '' → 'YYYY-MM-DD' | None"""
    s = (s or "").strip()
    if not s or "TRAVAD" in s.upper():
        return None
    m = re.match(r"^(\d{1,2})[.\-/](\d{1,2})[.\-/](\d{4})$", s)
    if not m:
        return None
    d, mo, y = int(m.group(1)), int(m.group(2)), int(m.group(3))
    try:
        return date(y, mo, d).isoformat()
    except Exception:
        return None


def sb_get(path: str, params: dict | None = None) -> list:
    """GET no PostgREST do Supabase (Cloud) — kanban_cards mora lá."""
    from urllib.parse import urlencode
    q = urlencode(params or {}, doseq=True)
    url = f"{SUPA_URL}/rest/v1/{path}" + (f"?{q}" if q else "")
    req = Request(url, headers={"apikey": SUPA_KEY, "Authorization": f"Bearer {SUPA_KEY}"})
    with urlopen(req, timeout=30) as r:
        return json.loads(r.read().decode())


def sb_req(method: str, path: str, params: dict | None = None, body: dict | None = None) -> list | dict:
    """POST/PATCH no PostgREST (Prefer: return=representation)."""
    from urllib.parse import urlencode
    from urllib.error import HTTPError
    q = urlencode(params or {}, doseq=True)
    url = f"{SUPA_URL}/rest/v1/{path}" + (f"?{q}" if q else "")
    data = json.dumps(body or {}).encode()
    req = Request(url, data=data, method=method, headers={
        "apikey": SUPA_KEY, "Authorization": f"Bearer {SUPA_KEY}",
        "Content-Type": "application/json",
        "Prefer": "return=representation",
    })
    try:
        with urlopen(req, timeout=30) as r:
            b = r.read().decode()
            return json.loads(b) if b else {}
    except HTTPError as e:
        err_body = e.read().decode()[:300]
        raise RuntimeError(f"sb {method} {path} {e.code}: {err_body} | body={json.dumps(body)[:200]}")


# ── Mapa column_id do kanban → categoria do cronograma_obras (CATS_CRONO) ──
_MAPA_COLUNA_CAT = {
    "acompanhamento":    "acompanhamento",
    "obras-liberadas":   "obras_liberadas",
    "cronograma-final":  "cronograma_final",
    "pre-cronograma":    "cronograma_final",
    "travado":           "travado",
    "obras-finalizadas": "finalizadas",
    "reparos-concluidos":"finalizadas",
}


def cat_do_kanban(column_id: str) -> str:
    return _MAPA_COLUNA_CAT.get(column_id or "", "acompanhamento")


def casar_fiscal(fiscal_planilha: str, fiscais_ativos: list[dict]) -> str | None:
    """Casa nome da planilha (DAVI, ALVARO, etc) com fiscais ativos (por prefix)."""
    key = norm(fiscal_planilha).split()[0] if fiscal_planilha else ""
    if not key:
        return None
    for f in fiscais_ativos:
        nk = norm(f.get("nome") or "")
        if nk.startswith(key) or key.startswith(nk):
            return f.get("nome").strip()
    return None


def _fetch_csv(gid: int) -> list[list[str]]:
    req = Request(sheet_url(gid), headers={"User-Agent": "curl/8"})
    with urlopen(req, timeout=30) as r:
        body = r.read().decode("utf-8", "replace")
    return list(csv.reader(io.StringIO(body)))


def _detect_cols(header: list[str]) -> dict:
    """Descobre índice de cada coluna via nome no header (case-insensitive, sem acento)."""
    idx = {}
    for i, h in enumerate(header):
        k = norm(h)
        if not k: continue
        if k.startswith("EQUIPE") or k.startswith("EOUIPE"): idx.setdefault("equipe", i)
        elif k == "DIAS":                                     idx.setdefault("dias_pat", i)
        elif k.startswith("NOME"):                            idx.setdefault("nome", i)
        elif k.startswith("SERV"):                            idx.setdefault("servico", i)
        elif k.startswith("FISCAL"):                          idx.setdefault("fiscal", i)
        elif "DATA DE FINALIZ" in k or "DATA FINAL" in k:     idx.setdefault("data_fim", i)
        elif k.startswith("OBS") or k.startswith("OBSERVAC"): idx.setdefault("obs", i)
        elif k.startswith("LOCAL"):                           idx.setdefault("local", i)
        elif k == "INICIO":                                   idx.setdefault("inicio", i)
        elif k == "TERMINO":                                  idx.setdefault("termino", i)
    return idx


def _linha_from_cols(row: list[str], cols: dict, is_marcenaria: bool) -> dict:
    def g(k, dflt=""):
        i = cols.get(k)
        return (row[i] if i is not None and len(row) > i else dflt).strip()
    if is_marcenaria:
        dias_pat = (g("inicio") + " " + g("termino")).strip()
    else:
        dias_pat = g("dias_pat")
    return {
        "equipe": g("equipe"), "dias_pat": dias_pat,
        "nome": g("nome"),     "servico":  g("servico"),
        "fiscal": g("fiscal"), "data_fim": g("data_fim"),
        "obs": g("obs"),       "local":    g("local"),
    }


def load_planilha() -> list[dict]:
    """Baixa as 3 abas (OBRAS/MARCENARIA/REPAROS) e devolve todas as linhas ativas."""
    out = []
    for nome_aba, gid, tipo_crono in SHEETS:
        rows = _fetch_csv(gid)
        # detecta linha do header (contém EQUIPE + NOME, ou INICIO + TERMINO)
        header_i, header_row = None, None
        for i, r in enumerate(rows[:10]):
            joined = " ".join(norm(c) for c in r)
            if ("EQUIPE" in joined or "EOUIPE" in joined) and "NOME" in joined:
                header_i, header_row = i, r; break
        if header_row is None:
            continue
        cols = _detect_cols(header_row)
        is_marcenaria = (nome_aba == "marcenaria")
        for i, row in enumerate(rows[header_i + 1:], start=header_i + 2):
            if not any((c or "").strip() for c in row):
                continue
            L = _linha_from_cols(row, cols, is_marcenaria)
            if not L["nome"] or not L["equipe"]:
                continue  # notas soltas
            out.append({
                "aba":         nome_aba,
                "tipo_crono":  tipo_crono,
                "linha":       i, "nome_obra": L["nome"], "equipe": L["equipe"],
                "servico":     L["servico"], "fiscal": L["fiscal"],
                "data_fim_str": L["data_fim"], "data_fim": parse_dt(L["data_fim"]),
                "dias_pat":    L["dias_pat"], "dias_semana": parse_dias_semana(L["dias_pat"]),
                "observacao":  L["obs"], "localizacao": L["local"],
            })
    return out


def match_card(nome_obra: str, cards_norm: dict[str, list[dict]]) -> tuple[str, list[dict]]:
    """Retorna (status, [cards]) onde status ∈ 'exact'|'prefix'|'ambiguous'|'none'."""
    key = norm(nome_obra)
    if not key:
        return ("none", [])
    if key in cards_norm:
        cands = cards_norm[key]
        return ("exact" if len(cands) == 1 else "ambiguous", cands)
    # prefix/substring: planilha em title OU title em planilha
    hits = []
    for k, arr in cards_norm.items():
        if k.startswith(key) or key.startswith(k) or (len(key) >= 6 and key in k) or (len(k) >= 6 and k in key):
            hits.extend(arr)
    hits = list({c["id"]: c for c in hits}.values())  # dedup
    if not hits:
        return ("none", [])
    if len(hits) == 1:
        return ("prefix", hits)
    return ("ambiguous", hits)


# ── Serviço da planilha → categoria do item (pra atribuir equipe correta) ──
# Categorias dos itens do cronograma_pmo: Forro, Piso, Painel, Deck, Marcenaria, Outro
_MAPA_SVC = [
    ("FACHADA",       "Forro"),
    ("BEIRAL",        "Forro"),
    ("TABEIRA",       "Forro"),
    ("CORTINEIRO",    "Forro"),
    ("FORRO",         "Forro"),
    ("CHEVRON",       "Piso"),
    ("ESPINHA",       "Piso"),
    ("TACO",          "Piso"),
    ("RASPAGEM",      "Piso"),
    ("SINTECO",       "Piso"),
    ("REVITALIZ",     "Piso"),
    ("CALAFETO",      "Piso"),
    ("REVISAO",       "Piso"),
    ("PISO",          "Piso"),
    ("DECK",          "Deck"),
    ("PAINEL",        "Painel"),
    ("ESCADA",        "Marcenaria"),
    ("BANCO",         "Marcenaria"),
    ("PORTA",         "Marcenaria"),
    ("MARCENARIA",    "Marcenaria"),
    ("REPARO",        "Outro"),
    ("ACABAMENTO",    "Outro"),
    ("SAUNA",         "Outro"),
]


def servico_para_categoria(servico: str) -> str | None:
    s = norm(servico)
    for tok, cat in _MAPA_SVC:
        if tok in s:
            return cat
    return None


def cronograma_pmo_itens(card: dict) -> list[dict]:
    det = card.get("details") or {}
    cp  = det.get("cronograma_pmo") or {}
    return cp.get("itens") or []


def upsert_cronograma_obras(card: dict, planilha_rows: list[dict], fiscais: list[dict]) -> dict:
    """POST ou PATCH em cronograma_obras (Cloud/Supabase).
    Consolida linhas planilha do mesmo card em 1 linha do cronograma_obras."""
    equipes = [p["equipe"] for p in planilha_rows if p.get("equipe")]
    fiscais_pl = [p["fiscal"] for p in planilha_rows if p.get("fiscal")]
    servicos = [p["servico"] for p in planilha_rows if p.get("servico")]
    localiz = next((p["localizacao"] for p in planilha_rows if p.get("localizacao")), "")
    # data_fim = max; data_ini = min (do calc backwards que já fizemos)
    with_date = [p for p in planilha_rows if p.get("data_fim")]
    termino = max((p["data_fim"] for p in with_date), default=None)
    # fiscal casado com nossa lista (primeiro fiscal_planilha que casar)
    fiscal_final = None
    for f_pl in fiscais_pl:
        cand = casar_fiscal(f_pl, fiscais)
        if cand:
            fiscal_final = cand
            break
    if not fiscal_final and fiscais_pl:
        fiscal_final = fiscais_pl[0]  # sem match → mantém string livre

    body = {
        "tipo":       "obras",
        "categoria":  cat_do_kanban(card.get("column_id") or ""),
        "nome_obra":  card.get("title") or "",
        "card_id":    card.get("id"),
        "equipe":     equipes[0] if equipes else None,
        "fiscal":     fiscal_final,
        "servico":    " / ".join(dict.fromkeys(servicos)) if servicos else None,
        "localizacao":localiz or None,
        "termino_dia": termino,
    }
    # existe?
    exist = sb_get("cronograma_obras", {
        "select": "id", "card_id": f"eq.{card['id']}", "limit": "1",
    })
    if exist:
        cid = exist[0]["id"]
        sb_req("PATCH", "cronograma_obras", {"id": f"eq.{cid}"}, body)
        return {"action": "update", "id": cid}
    else:
        r = sb_req("POST", "cronograma_obras", None, body)
        rid = r[0]["id"] if isinstance(r, list) and r else None
        return {"action": "insert", "id": rid}


def apply_project(pg, card: dict, planilha_rows: list[dict], dry: bool, fiscais: list[dict]) -> dict:
    """Upsert projeto + wipe/insert itens. Consolida MÚLTIPLAS linhas planilha do
       mesmo card: cada linha atribui equipe/fiscal aos itens da categoria casada."""
    det = card.get("details") or {}
    # consolidação: data_fim = MAX das datas; dias_semana da linha com data_fim mais tarde
    with_date = [p for p in planilha_rows if p.get("data_fim")]
    if with_date:
        winner = max(with_date, key=lambda p: p["data_fim"])
        data_fim_iso = winner["data_fim"]
        dias_semana  = winner["dias_semana"] or set(range(7))
    else:
        data_fim_iso = None
        dias_semana  = set(range(7))
    meta = {
        "area_m2":          det.get("area_m2"),
        "prazo_inicio":     det.get("prazo_inicio"),
        "prazo_fim":        det.get("prazo_fim"),
        "equipe_nome":      det.get("equipe_nome"),
        "equipe_lider":     det.get("equipe_lider"),
        "descricao_produto":det.get("descricao_produto"),
        "planilha_linhas": [
            {"linha": p["linha"], "equipe": p["equipe"], "servico": p["servico"],
             "fiscal": p["fiscal"], "data_fim": p["data_fim_str"],
             "dias_pat": p["dias_pat"], "categoria_alvo": servico_para_categoria(p["servico"]),
             "observacao": p["observacao"], "localizacao": p["localizacao"]}
            for p in planilha_rows
        ],
    }
    itens = cronograma_pmo_itens(card)
    if dry:
        return {"itens": len(itens), "would_upsert": True}
    cur = pg.cursor()
    cur.execute("SELECT id FROM gestao.projetos WHERE card_id::text = %s LIMIT 1", (card["id"],))
    row = cur.fetchone()
    if row:
        pid = row[0]
        cur.execute("""
          UPDATE gestao.projetos SET
            cliente=%s, numero_proposta=%s, endereco=%s, column_id=%s,
            meta = meta || %s::jsonb,
            updated_at=now()
          WHERE id=%s
        """, (
            card.get("title"), card.get("obra"), det.get("endereco"), card.get("column_id"),
            json.dumps(meta), pid,
        ))
    else:
        cur.execute("""
          INSERT INTO gestao.projetos
            (cliente, numero_proposta, endereco, orcamentista, card_id, column_id, meta)
          VALUES (%s, %s, %s, %s, %s, %s, %s::jsonb)
          RETURNING id
        """, (
            card.get("title"), card.get("obra"), det.get("endereco"),
            card.get("responsavel"), card.get("id"), card.get("column_id"),
            json.dumps(meta),
        ))
        pid = cur.fetchone()[0]
    # wipe itens vindos do cronograma_pmo pra reimportar limpo
    cur.execute("DELETE FROM gestao.itens WHERE projeto_id=%s AND (meta->>'fonte')='cronograma_pmo'", (pid,))
    ins = 0
    for i, it in enumerate(itens):
        cat_raiz = (it.get("categoria") or "Outro").strip().upper()
        item_meta = {
            "fonte": "cronograma_pmo",
            "categoria_raiz": cat_raiz,
            "servico_id":    it.get("servico_id"),
            "dias_uteis":    it.get("dias_uteis"),
            "rendimento":    it.get("rendimento"),
            "prestadores_ids": it.get("prestadores_ids") or [],
            "obra": {
                "qtd_instalada": it.get("instalado") or 0,
                "status_pmo":    it.get("status"),
            },
        }
        # aplica planilha por cima só quando não colide (planilha define equipe/fiscal do PROJETO, não do item)
        # datas do item: fim = data_fim; início = fim - dias_uteis (backwards nos dias trabalhados)
        prev_ini, prev_fim = None, None
        if data_fim_iso:
            fim_d = date.fromisoformat(data_fim_iso)
            prev_fim = data_fim_iso
            du = int(it.get("dias_uteis") or 0)
            if du > 0:
                prev_ini = sub_business_days(fim_d, du, dias_semana).isoformat()
        cur.execute("""
          INSERT INTO gestao.itens
            (projeto_id, ordem, categoria, descritivo, ambiente, quantidade, unidade,
             valor_unit, valor_total, status, previsao_inicio, previsao_fim, meta)
          VALUES (%s, %s, %s, %s, NULL, %s, %s, %s, %s, %s, %s, %s, %s::jsonb)
        """, (
            pid, i, it.get("categoria") or "Outro", it.get("servico") or "—",
            it.get("quantidade") or 0, it.get("unidade") or None,
            float(it.get("valor_unitario") or 0), float(it.get("total") or 0),
            (it.get("status") or "pendente"),
            prev_ini, prev_fim,
            json.dumps(item_meta),
        ))
        ins += 1
    # aplica planilha por cima no NÍVEL do projeto:
    #   - responsavel dos itens em lote (todos que ainda não têm)
    #   - previsao_fim se a planilha tem data
    # Aplica equipe por categoria via mapa serviço-planilha → categoria-item
    for p in planilha_rows:
        if not p["equipe"]:
            continue
        cat_alvo = servico_para_categoria(p["servico"])
        if not cat_alvo:
            continue  # não sabemos onde colocar; deixa auto-fill do painel decidir
        cur.execute("""
          UPDATE gestao.itens SET responsavel = %s
           WHERE projeto_id=%s
             AND UPPER(TRIM(SPLIT_PART(COALESCE(meta->>'categoria_raiz', categoria), '||', 1)))
                 = UPPER(%s)
        """, (p["equipe"], pid, cat_alvo))
    # cria/atualiza cronograma_obras (aparece na tabela do view Cronograma)
    upsert_cronograma_obras(card, planilha_rows, fiscais)
    return {"projeto_id": str(pid), "itens": ins}


def create_shell_projeto(pg, planilha_rows: list[dict], fiscais: list[dict]) -> dict:
    """Sem-match: cria projeto 'shell' em gestao.projetos (sem card_id) + cronograma_obras
    pra a obra aparecer na tabela Cronograma sem depender de card operacional."""
    nome = planilha_rows[0]["nome_obra"]
    # se já existe projeto com esse cliente (case-insensitive), reusa
    cur = pg.cursor()
    cur.execute("SELECT id FROM gestao.projetos WHERE UPPER(cliente)=UPPER(%s) LIMIT 1", (nome,))
    row = cur.fetchone()
    if row:
        pid = row[0]
    else:
        localiz = next((p["localizacao"] for p in planilha_rows if p.get("localizacao")), "")
        meta = {
            "origem": "planilha_shell",
            "aba":    planilha_rows[0].get("aba"),
            "planilha_linhas": [{"linha": p["linha"], "equipe": p["equipe"], "servico": p["servico"],
                                 "fiscal": p["fiscal"], "data_fim": p["data_fim_str"],
                                 "dias_pat": p["dias_pat"], "observacao": p["observacao"],
                                 "localizacao": p["localizacao"]}
                                for p in planilha_rows],
        }
        cur.execute("""
          INSERT INTO gestao.projetos (cliente, column_id, endereco, meta)
          VALUES (%s, %s, %s, %s::jsonb)
          RETURNING id
        """, (nome, "acompanhamento", localiz or None, json.dumps(meta)))
        pid = cur.fetchone()[0]
    # cronograma_obras — usa card fake (title/coluna) pra reaproveitar upsert_cronograma_obras
    fake_card = {"id": None, "title": nome, "column_id": "acompanhamento",
                 "obra": None, "responsavel": None}
    # como não tem card_id, cria diretamente (sem checar existência por card_id)
    equipes = [p["equipe"] for p in planilha_rows if p.get("equipe")]
    fiscais_pl = [p["fiscal"] for p in planilha_rows if p.get("fiscal")]
    servicos = [p["servico"] for p in planilha_rows if p.get("servico")]
    localiz = next((p["localizacao"] for p in planilha_rows if p.get("localizacao")), "")
    with_date = [p for p in planilha_rows if p.get("data_fim")]
    termino = max((p["data_fim"] for p in with_date), default=None)
    fiscal_final = None
    for f_pl in fiscais_pl:
        cand = casar_fiscal(f_pl, fiscais)
        if cand: fiscal_final = cand; break
    if not fiscal_final and fiscais_pl:
        fiscal_final = fiscais_pl[0]
    tipo = planilha_rows[0].get("tipo_crono") or "obras"
    body = {
        "tipo": tipo, "categoria": "acompanhamento",
        "nome_obra": nome, "card_id": None,
        "equipe": equipes[0] if equipes else None,
        "fiscal": fiscal_final,
        "servico": " / ".join(dict.fromkeys(servicos)) if servicos else None,
        "localizacao": localiz or None,
        "termino_dia": termino,
    }
    # idempotente: se já existe cronograma_obras sem card_id + mesmo nome_obra + tipo, PATCH
    exist = sb_get("cronograma_obras", {
        "select": "id",
        "nome_obra": f"eq.{nome}", "tipo": f"eq.{tipo}", "card_id": "is.null",
        "limit": "1",
    })
    if exist:
        sb_req("PATCH", "cronograma_obras", {"id": f"eq.{exist[0]['id']}"}, body)
    else:
        sb_req("POST", "cronograma_obras", None, body)
    _ = fake_card
    return {"projeto_id": str(pid)}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--apply", action="store_true", help="grava no banco (padrão = dry-run)")
    args = ap.parse_args()

    if not SUPA_KEY:
        sys.exit("SUPA_KEY env não setada. Ex: SUPA_KEY=<...> python3 script.py")

    print(f"→ baixando planilha (3 abas)…")
    planilha = load_planilha()
    from collections import Counter
    c = Counter(p["aba"] for p in planilha)
    print(f"  {len(planilha)} linhas ativas · " + " · ".join(f"{k}={v}" for k, v in c.items()))

    print(f"→ buscando cards dept=operacional…")
    cards = sb_get("kanban_cards", {
        "select": "id,title,column_id,obra,responsavel,details",
        "dept_id": "eq.operacional",
        "limit": 500,
    })
    print(f"  {len(cards)} cards")

    print(f"→ buscando fiscais ativos…")
    try:
        fiscais = json.loads(urlopen(Request(
            "https://gestao.parket.works/api/fiscal/equipe?ativo=true",
            headers={"User-Agent": "curl/8"}), timeout=15).read())
    except Exception:
        fiscais = []
    print(f"  {len(fiscais)} fiscais ativos")

    cards_norm: dict[str, list[dict]] = {}
    for c in cards:
        k = norm(c.get("title") or "")
        if not k:
            continue
        cards_norm.setdefault(k, []).append(c)

    # match — cada linha da planilha; depois consolida por card_id
    linhas_matched, ambiguous, no_match, no_crono = [], [], [], []
    for p in planilha:
        status, cands = match_card(p["nome_obra"], cards_norm)
        if status in ("exact", "prefix"):
            card = cands[0]
            itens = cronograma_pmo_itens(card)
            if not itens:
                no_crono.append({**p, "card_id": card["id"], "card_title": card["title"]})
            else:
                linhas_matched.append({**p, "card_id": card["id"], "card_title": card["title"],
                                       "column_id": card.get("column_id"), "n_itens": len(itens)})
        elif status == "ambiguous":
            ambiguous.append({**p, "candidatos": [(c["id"], c["title"], c.get("column_id")) for c in cands[:5]]})
        else:
            no_match.append(p)

    # consolida linhas → cards (múltiplas linhas planilha do mesmo cliente)
    por_card: dict[str, list[dict]] = {}
    for l in linhas_matched:
        por_card.setdefault(l["card_id"], []).append(l)
    aplicados = list(por_card.items())  # [(card_id, [linhas])]

    # relatório
    print()
    print("═══ RELATÓRIO ═══")
    print(f"linhas planilha matched:                       {len(linhas_matched)}")
    print(f"→ consolidadas em CARDS únicos:                {len(aplicados)}")
    print(f"sem cronograma_pmo (match ok, details vazio):  {len(no_crono)}")
    print(f"ambíguos (múltiplos matches):                  {len(ambiguous)}")
    print(f"sem match:                                     {len(no_match)}")
    print()
    if aplicados:
        print("─ Cards a importar:")
        for card_id, linhas in aplicados[:30]:
            with_date = [x for x in linhas if x["data_fim"]]
            data_fim  = max((x["data_fim"] for x in with_date), default=None) or "—"
            ttl       = linhas[0]["card_title"]
            col       = linhas[0]["column_id"]
            nit       = linhas[0]["n_itens"]
            eq_str    = "; ".join(f"{p['equipe']}({p['servico'] or '?'})" for p in linhas)
            print(f"  {ttl[:34]:<34}  col={col:<20}  itens={nit:>2}  data_fim={data_fim}")
            print(f"    linhas planilha: {eq_str[:200]}")
    if no_crono:
        print()
        print("─ Match sem cronograma_pmo:")
        for a in no_crono[:15]:
            print(f"  L{a['linha']:>3}  {a['nome_obra']:<25} → {a['card_title']}")
    if ambiguous:
        print()
        print("─ Ambíguos:")
        for a in ambiguous[:15]:
            print(f"  L{a['linha']:>3}  {a['nome_obra']}")
            for cid, ct, cc in a["candidatos"]:
                print(f"           - {cid[:8]}  col={cc:<20} {ct}")
    if no_match:
        print()
        print("─ Sem match:")
        for a in no_match:
            print(f"  L{a['linha']:>3}  {a['nome_obra']:<28} equipe={a['equipe']:<20} loc={a['localizacao']}")

    if not args.apply:
        print()
        print("DRY-RUN concluído. Rode com --apply pra gravar.")
        return

    # exec real
    try:
        import psycopg
    except ImportError:
        sys.exit("psycopg não disponível. Roda dentro do container parket-gestao_api.")

    print()
    print(f"→ gravando {len(aplicados)} cards casados…")
    dsn = f"host={PG_HOST} user={PG_USER} dbname={PG_DB} password={PG_PASS}"
    keys_pl = ("aba","tipo_crono","linha","nome_obra","equipe","servico","fiscal",
               "data_fim_str","data_fim","dias_pat","dias_semana",
               "observacao","localizacao")
    with psycopg.connect(dsn, autocommit=False) as pg:
        for card_id, linhas in aplicados:
            card = next(c for c in cards if c["id"] == card_id)
            planilha_rows = [{k: p.get(k) for k in keys_pl} for p in linhas]
            try:
                out = apply_project(pg, card, planilha_rows, dry=False, fiscais=fiscais)
                pg.commit()
                print(f"  OK  {card['title'][:32]:<32}  itens={out['itens']}")
            except Exception as e:
                pg.rollback()
                print(f"  ERR {card['title'][:32]:<32}  {e}")

        # Sem match / sem cronograma_pmo: cria projeto shell + cronograma_obras
        pendentes = list(no_match) + [{k: v for k, v in a.items() if k not in ("card_id","card_title")} for a in no_crono]
        # agrupa por nome_obra
        agrup: dict[str, list[dict]] = {}
        for p in pendentes:
            key = norm(p["nome_obra"])
            if not key: continue
            agrup.setdefault(key, []).append(p)
        print()
        print(f"→ criando {len(agrup)} projetos shell (sem match no operacional)…")
        for key, linhas in agrup.items():
            planilha_rows = [{k: p.get(k) for k in keys_pl} for p in linhas]
            try:
                out = create_shell_projeto(pg, planilha_rows, fiscais)
                pg.commit()
                print(f"  OK  {linhas[0]['nome_obra'][:32]:<32}  aba={linhas[0].get('aba')}")
            except Exception as e:
                pg.rollback()
                print(f"  ERR {linhas[0]['nome_obra'][:32]:<32}  {e}")


if __name__ == "__main__":
    main()
