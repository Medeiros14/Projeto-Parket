#!/usr/bin/env python3
"""Eventos de outros setores -> cards no kanban de Compras (compras.parket.works).

1) Contrato assinado (DocuSign):
   Fabricacao -> dept 'compras' (Ronaldo) | Instalacao -> dept 'compras-taiara' (Taiara).
   Cadeia: contratos_docusign (Cloud) -> simulacao_projetos.meta.valoria_simulacao_id
           -> ops.simulacao_itens (Supabase da Valoria) -> insumos_fabricacao/instalacao.
   Dedup por kanban_cards.details->>'contrato_id'.

2) Amostra aprovada pelo Douglas (Homebroker):
   amostras_solicitacoes (parket-pg-local) status='aprovada' -> dept 'compras-marco'
   (Marco Antonio), coluna 'solicitacao'. Dedup por details->>'amostra_id'.

Watermark local (sem backfill). Cron: */3min. Log: /root/.compras-watcher/watcher.log
"""
import base64, json, math, os, re, subprocess, sys, urllib.request
from datetime import datetime, timezone, timedelta

BASE = "/root/.compras-watcher"
STATE_FILE = f"{BASE}/state.json"
LOG_FILE = f"{BASE}/watcher.log"
CLOUD = "hbxpilrxmitvzebluoom"
VALORIA = "skbjmlzgaeupflujomzw"
CLOUD_URL = f"https://{CLOUD}.supabase.co"
PAT = open(f"{BASE}/mgmt_pat").read().strip()
SERVICE_KEY = open(f"{BASE}/cloud_service_key").read().strip()
NOTIFY_URL = "https://agente.parket.works/api/handoffs/nova-solicitacao-compras"
NOTIFY = os.environ.get("COMPRAS_WATCHER_NOTIFY", "1") == "1"

CHECKLISTS_SEED = [
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


def parse_ts(s):
    # Aceita tanto ISO quanto o formato texto do Postgres
    # ('2026-07-14 00:29:20.38164+00') que o fromisoformat do 3.10 rejeita.
    s = s.strip().replace(" ", "T")
    s = re.sub(r"([+-]\d{2})$", r"\1:00", s)
    m = re.match(r"^(.*\.)(\d+)(\+\d{2}:\d{2}|-\d{2}:\d{2}|Z)?$", s)
    if m and len(m.group(2)) != 6:
        s = m.group(1) + m.group(2).ljust(6, "0")[:6] + (m.group(3) or "")
    return datetime.fromisoformat(s)


def log(msg):
    line = f"[{datetime.now(timezone.utc).astimezone().isoformat(timespec='seconds')}] {msg}"
    print(line)
    with open(LOG_FILE, "a") as f:
        f.write(line + "\n")


def http(url, method="GET", headers=None, body=None, timeout=30):
    h = {"User-Agent": "compras-watcher/1.0 (parket.works)"}
    h.update(headers or {})
    req = urllib.request.Request(url, method=method, headers=h)
    data = json.dumps(body).encode() if body is not None else None
    with urllib.request.urlopen(req, data=data, timeout=timeout) as r:
        return json.loads(r.read().decode() or "null")


def sql(project, query):
    """Management API — só interpolar UUIDs/timestamps (nunca texto livre)."""
    return http(
        f"https://api.supabase.com/v1/projects/{project}/database/query",
        method="POST",
        headers={"Authorization": f"Bearer {PAT}", "Content-Type": "application/json"},
        body={"query": query},
    )


def rest_patch(table, filtro, row):
    return http(
        f"{CLOUD_URL}/rest/v1/{table}?{filtro}",
        method="PATCH",
        headers={
            "apikey": SERVICE_KEY,
            "Authorization": f"Bearer {SERVICE_KEY}",
            "Content-Type": "application/json",
            "Prefer": "return=minimal",
        },
        body=row,
    )


def rest_insert(table, row):
    return http(
        f"{CLOUD_URL}/rest/v1/{table}",
        method="POST",
        headers={
            "apikey": SERVICE_KEY,
            "Authorization": f"Bearer {SERVICE_KEY}",
            "Content-Type": "application/json",
            "Prefer": "return=representation",
        },
        body=row,
    )


def load_state():
    try:
        st = json.load(open(STATE_FILE))
    except Exception:
        st = {}
    # primeira execução: watermark = agora (não backfilla eventos antigos)
    now = datetime.now(timezone.utc).isoformat()
    changed = False
    for k in ("last_ts", "last_amostra_ts"):
        if k not in st:
            st[k] = now
            changed = True
    if changed:
        json.dump(st, open(STATE_FILE, "w"))
        log(f"state inicializado — {st}")
    return st


def local_pg(query):
    """SQL no parket-pg-local (Homebroker). Retorna lista de dicts."""
    cid = subprocess.check_output(
        ["docker", "ps", "-q", "-f", "name=parket-pg-local_postgres"], text=True
    ).strip().splitlines()[0]
    out = subprocess.check_output(
        ["docker", "exec", cid, "psql", "-U", "postgres", "-d", "postgres", "-tA",
         "-c", f"SELECT coalesce(json_agg(t), '[]'::json) FROM ({query}) t;"],
        text=True,
    ).strip()
    return json.loads(out or "[]")


def local_pg_dml(query):
    """INSERT/UPDATE no parket-pg-local. RETURNING opcional → lista de dicts."""
    q = query.strip().rstrip(";")
    if " returning " not in q.lower():
        q += " RETURNING 1 AS ok"
    cid = subprocess.check_output(
        ["docker", "ps", "-q", "-f", "name=parket-pg-local_postgres"], text=True
    ).strip().splitlines()[0]
    out = subprocess.check_output(
        ["docker", "exec", cid, "psql", "-U", "postgres", "-d", "postgres", "-tA",
         "-c", f"WITH _r AS ({q}) SELECT coalesce(json_agg(_r), '[]'::json) FROM _r;"],
        text=True,
    ).strip()
    return json.loads(out or "[]")


def core_sql(query):
    """SQL no Core financeiro VIVO = Supabase Cloud (schema core), via
    Management API. Serve pra SELECT e DML (RETURNING opcional).
    O parket-pg-local tem o core VAZIO — nunca escrever financeiro lá."""
    return sql(CLOUD, query) or []


def mirror_contratos_local(desde):
    """Espelha contratos_docusign do Cloud pro parket-pg-local — o banco que a
    UI do Core lê via api.parket.works/rest. Sem isso a página Contratos
    fechados do Core não enxerga contratos novos/atualizados (só existe sync
    local→cloud; o caminho inverso é este)."""
    try:
        rows = sql(CLOUD, f"""
            SELECT id, card_id, envelope_id, status, signatarios, pdf_storage_path,
                   notes, last_event, created_at, updated_at, sent_at, completed_at,
                   created_by, titulo
              FROM contratos_docusign
             WHERE updated_at > '{desde}'::timestamptz
        """) or []
        if not rows:
            return
        # kanban_cards primeiro (FK NOT NULL card_id no local)
        card_ids = sorted({r["card_id"] for r in rows if r.get("card_id")})
        if card_ids:
            idlist = ",".join(f"'{i}'" for i in card_ids)
            have = {r["id"] for r in local_pg(
                f"SELECT id FROM kanban_cards WHERE id IN ({idlist})")}
            faltam = [i for i in card_ids if i not in have]
            if faltam:
                idlist = ",".join(f"'{i}'" for i in faltam)
                cards = sql(CLOUD, f"SELECT * FROM kanban_cards WHERE id IN ({idlist})") or []
                if cards:
                    j = json.dumps(cards, ensure_ascii=False, default=str).replace("'", "''")
                    local_pg_dml(f"""
                        INSERT INTO kanban_cards
                        SELECT * FROM jsonb_populate_recordset(NULL::kanban_cards, '{j}'::jsonb)
                        ON CONFLICT (id) DO NOTHING
                    """)
        j = json.dumps(rows, ensure_ascii=False, default=str).replace("'", "''")
        local_pg_dml(f"""
            INSERT INTO contratos_docusign (id, card_id, envelope_id, status, signatarios,
                   pdf_storage_path, notes, last_event, created_at, updated_at, sent_at,
                   completed_at, created_by, titulo)
            SELECT id, card_id, envelope_id, status, signatarios, pdf_storage_path,
                   notes, last_event, created_at, updated_at, sent_at, completed_at,
                   created_by, titulo
              FROM jsonb_populate_recordset(NULL::contratos_docusign, '{j}'::jsonb)
            ON CONFLICT (id) DO UPDATE SET
                   status = EXCLUDED.status,
                   signatarios = EXCLUDED.signatarios,
                   pdf_storage_path = COALESCE(EXCLUDED.pdf_storage_path,
                                               contratos_docusign.pdf_storage_path),
                   notes = EXCLUDED.notes,
                   last_event = EXCLUDED.last_event,
                   updated_at = EXCLUDED.updated_at,
                   sent_at = EXCLUDED.sent_at,
                   completed_at = EXCLUDED.completed_at,
                   titulo = EXCLUDED.titulo
        """)
        log(f"mirror contratos→local: {len(rows)} upsert(s)")
    except Exception as e:
        log(f"ERRO mirror contratos→local: {e}")


def produtos_vendidos(itens, campo_insumos="insumos_instalacao"):
    """Lista dos produtos vendidos AGREGADOS por (categoria/subtipo/espécie/cor).
    Cada produto leva:
      - metragem total real (soma metragem_informada dos itens do grupo)
      - portas (se cat=porta): lista de {qtd_folhas, código, tipo, dims, obs, amb}
      - insumos: lista consolidada dos insumos do grupo (nome+unidade agregados) —
        campo_insumos define fonte: insumos_instalacao (Taiara) OU
        insumos_fabricacao (Ronaldo). (Will 23/07)"""
    grupos = {}
    for it in itens:
        m = it.get("metragem_informada") or 0
        try: m = float(m)
        except Exception: m = 0
        meta = it.get("meta") or {}
        if isinstance(meta, str):
            try: meta = json.loads(meta)
            except Exception: meta = {}
        cat = (it.get("categoria") or "").strip() or None
        sub = (it.get("subtipo") or "").strip() or None
        esp = (it.get("especie_nome") or "").strip() or None
        cor = (it.get("cor") or "").strip() or None
        key = "|".join([(cat or "").upper(), (sub or "").upper(), (esp or "").upper(), (cor or "").upper()])
        if key not in grupos:
            grupos[key] = {
                "categoria": cat, "subtipo": sub, "especie": esp, "cor": cor,
                "metragem": 0.0, "portas": [], "insumos_acc": {},
            }
        g = grupos[key]
        g["metragem"] += m
        if (cat or "").lower() == "porta":
            folhas = meta.get("porta_folhas") or 0
            try: folhas = int(folhas)
            except Exception: folhas = 0
            g["portas"].append({
                "qtd_folhas": folhas or None,
                "codigo": (meta.get("codigo_porta") or "").strip() or None,
                "tipo": (meta.get("tipo_porta") or "").strip() or None,
                "largura_cm": meta.get("porta_largura_cm") or None,
                "altura_cm": meta.get("porta_altura_cm") or None,
                "obs": (meta.get("porta_obs") or "").strip() or None,
                "ambiente": (meta.get("porta_ambiente_a") or meta.get("porta_ambiente_b") or "").strip() or None,
                "metragem": m,
            })
        lista = it.get(campo_insumos) or []
        if isinstance(lista, str):
            try: lista = json.loads(lista)
            except Exception: lista = []
        for ins in lista:
            nome = (ins.get("nome") or "").strip()
            if not nome: continue
            un = (ins.get("unidade") or "un").strip()
            k = (nome.upper(), un.upper())
            if k not in g["insumos_acc"]:
                g["insumos_acc"][k] = {"nome": nome, "unidade": un, "qtd": 0.0}
            try: g["insumos_acc"][k]["qtd"] += float(ins.get("qtd") or 0)
            except Exception: pass

    out = []
    for g in grupos.values():
        insumos = []
        for v in g["insumos_acc"].values():
            qtd = round(v["qtd"], 2)
            qtd_str = str(int(qtd)) if qtd == int(qtd) else str(qtd)
            insumos.append({"nome": v["nome"], "unidade": v["unidade"], "qtd": qtd_str})
        item = {
            "categoria": g["categoria"], "subtipo": g["subtipo"],
            "especie": g["especie"], "cor": g["cor"],
            "metragem": round(g["metragem"], 3),
            "insumos": insumos,
        }
        if g["portas"]:
            item["portas"] = g["portas"]
        out.append(item)
    return out


# ───────────────────────── PCP Produção (producao.parket.works) ─────────────────────────
# O que a Parket fabrica (vira OP no PCP). PORTA e MARCENARIA entram sempre.
# Fora isso, só entra o que é LAMINADO, em qualquer categoria (painel, forro,
# revestimento, escada, deck, adega...), porque o que a fábrica produz é a
# lâmina. Régua, ripado, maciço, muxarabi, toblerone, laca e recortes são
# comprados prontos e vão direto pra obra. Will 04/09 (antes disso PAINEL
# inteiro e forro de qualquer subtipo entravam, e painel em régua caía no PCP).
# O dado confirma a regra: BOM de fabricação (insumos_fabricacao) só existe em
# item laminado — nos não laminados é zero em todas as categorias.
CAT_PRODUCAO_SEMPRE = ("porta", "marcenaria")
SUB_LAMINA = {"lamina", "laminado", "brise_lamina"}


def _sub_norm(s):
    return (s or "").strip().lower().replace("â", "a").replace("ã", "a")


def deve_produzir(categoria, subtipo):
    cat = (categoria or "").strip().lower()
    if cat in CAT_PRODUCAO_SEMPRE:
        return True
    return _sub_norm(subtipo) in SUB_LAMINA


# Classificação dos materiais no modelo do Excel de portas (erp.insumos.categoria).
# Na fabricação só existem FERRAGEM e MATERIA_PRIMA — "insumo" é termo da instalação
# em obra, então INSUMO_OBRA do erp colapsa em MATERIA_PRIMA (Will 06/08).
_TIPO_INSUMO_CACHE = None
# Excel "Portas Atualizadas" (08/2026) lista trilhos/borracha vedação/acabamento
# oval na seção FERRAGENS — keyword promove mesmo se o cadastro disser MP.
_KW_FERRAGEM = ("PIVÔ", "PIVO", "FECHADURA", "PUXADOR", "IMÃ", "IMA ", "TRANQUETA",
                "ADAPTADOR", "DOBRADIÇA", "DOBRADICA", "ROLDANA", "KIT ",
                "TRILHO", "BORRACHA VEDAÇÃO", "BORRACHA VEDACAO", "ACABAMENTO OVAL")


def tipo_insumo(nome):
    """FERRAGEM | MATERIA_PRIMA — lookup exato no erp.insumos (Cloud),
    fallback por palavra-chave pra material fora do cadastro."""
    global _TIPO_INSUMO_CACHE
    if _TIPO_INSUMO_CACHE is None:
        try:
            rows = sql(CLOUD, "SELECT upper(trim(descricao)) AS d, categoria FROM erp.insumos") or []
            _TIPO_INSUMO_CACHE = {r["d"]: r["categoria"] for r in rows if r.get("d")}
        except Exception:
            _TIPO_INSUMO_CACHE = {}
    up = (nome or "").strip().upper()
    if _TIPO_INSUMO_CACHE.get(up) == "FERRAGEM" or any(k in up for k in _KW_FERRAGEM):
        return "FERRAGEM"
    return "MATERIA_PRIMA"


def normalizar_insumos(raw):
    """insumos_fabricacao / insumos_instalacao da sim → formato do PCP.
    Descarta custo_unit de propósito: a OP é quantitativa, sem R$ (#1716)."""
    if isinstance(raw, str):
        try: raw = json.loads(raw)
        except Exception: raw = []
    out = []
    for ins in raw if isinstance(raw, list) else []:
        nome = (ins.get("nome") or "").strip() if isinstance(ins, dict) else ""
        if not nome:
            continue
        out.append({"nome": nome,
                    "unidade": (ins.get("unidade") or "un").strip(),
                    "qtd": ins.get("qtd"),
                    "tipo": tipo_insumo(nome)})
    return out


# Imports modo m² não têm porta_folhas no meta — a qtd vive no texto
# ("PM04 - 08 PORTAS PIVOTANTES", "PM14 - 01 PORTA DE CORRER COM 03 FOLHAS").
_RE_QTD_PORTA = re.compile(r"\b(\d{1,2})\s*PORTAS?\b", re.I)
_RE_FOLHAS_TXT = re.compile(r"COM\s*(\d{1,2})\s*FOLHAS?\b", re.I)


def _int0(v):
    try: return int(float(v))
    except Exception: return 0


def qtd_conjuntos_porta(meta, texto=""):
    """Qtd de portas (conjuntos) do orçamento — modelo conjunto × folhas × dims.
    fpc autoritativo; sem folhas no meta parseia "N PORTAS" do texto (Will 06/08);
    fallback heurístico: camarão = 1 conjunto, senão folha = porta."""
    folhas = _int0(meta.get("porta_folhas"))
    fpc = _int0(meta.get("porta_folhas_por_conjunto"))
    if fpc and folhas:
        return max(1, round(folhas / fpc))
    if "camar" in (meta.get("tipo_porta") or "").lower():
        return 1
    if folhas:
        return folhas
    m = _RE_QTD_PORTA.search(texto or "")
    if m:
        return max(1, int(m.group(1)))
    return 1


def _f0(v):
    """float ou 0 — NUNCA usar _int0 em medida de porta: trunca "0,9 m" pra 0."""
    try: return float(v)
    except Exception: return 0.0


def _round_js(v):
    """Math.round do JS (meio pra cima). round() do Python arredonda pro par."""
    return int(math.floor(v + 0.5))


def portas_e_folhas(meta, metragem_informada):
    """(qtd de portas, folhas de cada porta) na leitura exata do propostaGen:
    com meta.porta_folhas_por_conjunto, folhas/porta = fpc e a QTD vem do
    metragem_informada (modo UN guarda contagem, não m2); sem ele cai no
    heurístico legado (folhas > 1 e não camarão = N portas de 1 folha,
    camarão = 1 porta de N folhas)."""
    m = _f0(metragem_informada)
    folhas = max(0, _round_js(_f0(meta.get("porta_folhas"))))
    camarao = "camar" in (meta.get("tipo_porta") or "").lower()
    fpc = _f0(meta.get("porta_folhas_por_conjunto"))
    if fpc > 0:
        return max(1, _round_js(m if m > 0 else 1)), max(1, _round_js(fpc))
    if folhas > 1 and not camarao:
        return folhas, 1
    return 1, (folhas if (camarao and folhas > 1) else 1)


def metragem_porta(meta, metragem_informada):
    """METRAGEM TOTAL da porta EXATAMENTE como sai na proposta
    (propostaGen.ts, PKT-PORTA-METR-DIMS-20260723 + FOLHAS-CONJUNTO-20260728):

        qtd de portas x folhas por porta x largura x altura x 2 faces, ceil.

    Qtd de portas e folhas/porta seguem o propostaGen ao pé da letra: com
    meta.porta_folhas_por_conjunto, folhas/porta = fpc e a QTD vem do
    metragem_informada (modo UN); sem ele, cai no heurístico legado
    (folhas > 1 e não camarão = N portas de 1 folha; camarão = 1 porta de N).

    Por que existe: no modo UN o campo metragem_informada guarda a QUANTIDADE
    de portas (1, 2, 3...), não m2. Copiar esse número pra OP fazia a porta
    "1,58 x 2,50" que a proposta vende como 16,00 m2 chegar na fábrica como
    "2 m2" (Will 04/09). Sem as duas medidas cai no piso histórico de 5 m2 por
    folha, e no modo m2 a metragem já vem em m2 e vale como está."""
    m = _f0(metragem_informada)
    portas, folhas_pp = portas_e_folhas(meta, metragem_informada)
    # Medida vem em cm ou já em m dependendo de quem preencheu (mesma regra do
    # cmToM do renderer): acima de 10 é cm.
    cm_para_m = lambda v: v / 100 if v > 10 else v
    larg = cm_para_m(_f0(meta.get("porta_largura_cm")))
    alt = cm_para_m(_f0(meta.get("porta_altura_cm")))
    if meta.get("porta_modo_m2") is True:
        total = m if m > 0 else portas * folhas_pp * 5
    elif larg > 0 and alt > 0:
        total = portas * folhas_pp * larg * alt * 2
    else:
        total = portas * folhas_pp * 5
    return float(math.ceil(total))


def folhas_porta(meta, texto="", qtd=1, grupo=1):
    """Total de folhas: meta.porta_folhas (× grupo consolidado) ou
    qtd total × "COM N FOLHAS" do texto."""
    folhas = _int0(meta.get("porta_folhas"))
    if folhas:
        return folhas * max(1, grupo)
    m = _RE_FOLHAS_TXT.search(texto or "")
    if m:
        return max(1, qtd) * int(m.group(1))
    return None


_RE_CORRER = re.compile(r"\b(CORRER|DN\s?150|RO\s?82\s?TOP)\b")
_RE_FERRAGEM = re.compile(r"\b(CIR|GERIS|ITALY\s*LINE|DN\s?150|RO\s?82\s?TOP|3D)\b")


def titulo_porta(meta, subtipo, especie, cor):
    """Nome da porta EXATAMENTE como sai vendido na proposta (Will 04/09).

    Por que existe: a OP montava o nome com os campos crus ("PORTA CORRER ·
    regua · Carvalho Europeu · Nevado") enquanto a proposta escreve "CORRER
    EXTERNA CARVALHO EUROPEU NEVADO". Fábrica e cliente liam nomes diferentes
    do mesmo produto. Espelha o bloco PORTA do encodeCategoria
    (valoria-app/src/app/lib/propostaGen.ts) sem a linha de dimensão (a OP já
    mostra medida/dim em campo próprio).
    """
    tipo = str(meta.get("tipo_porta") or "").upper().strip()
    is_correr = bool(_RE_CORRER.search(tipo))
    # Opt-out por item via Teca: tira a ferragem (CIR/GERIS/DN150/...) do nome.
    if meta.get("ocultar_ferragem") is True:
        tipo = re.sub(r"\s{2,}", " ", _RE_FERRAGEM.sub("", tipo)).strip()
    if is_correr and not re.search(r"\bCORRER\b", tipo):
        tipo = f"CORRER {tipo}".strip()
    tipo = re.sub(r"\bINTERNO\b", "INTERNA", tipo)
    tipo = re.sub(r"\bEXTERNO\b", "EXTERNA", tipo)
    if is_correr:
        # Correr sem localização declarada = EXTERNA por padrão (regra Will 20/08).
        resto = _RE_FERRAGEM.sub("", re.sub(r"\bCORRER\b", "", tipo))
        if not re.sub(r"\s+", " ", resto).strip():
            tipo = f"{tipo} EXTERNA".strip()
    if re.search(r"CAMAR[ÃA]O", tipo):
        # Camarão nunca leva contagem de folhas no header.
        tipo = re.sub(r"\s{2,}", " ", re.sub(r"\s*\d+\s*FOLHAS?\b", "", tipo)).strip()

    sub = str(subtipo or "").upper().strip() \
        .replace("LAMINA", "LÂMINA").replace("MACICO", "MACIÇO")
    sub = "" if sub == "REGUA" else sub.replace("MOLDURA_VIDRO", "MOLDURA + VIDRO")

    # Material 1x: espécie que repete o subtipo (porta LACA) e espécie == cor
    # colapsam, senão sairia "PASSAGEM INTERNA LACA LACA LACA".
    esp = str(especie or "").upper().strip()
    cor_u = str(cor or "").upper().strip()
    esp_sig = "" if (esp and esp == sub) else esp
    esp_cor = esp_sig if (esp_sig and cor_u and esp_sig == cor_u) \
        else " ".join(x for x in (esp_sig, cor_u) if x)
    if esp_cor.startswith("PORTA "):
        esp_cor = esp_cor[6:]
    if sub and esp_cor == sub:
        esp_cor = ""
    elif sub and esp_cor.startswith(sub + " "):
        esp_cor = esp_cor[len(sub) + 1:]

    return " ".join(x for x in (tipo, sub, esp_cor) if x) or None


def consolidar_portas(itens):
    """Espelha o consolidarItensIdenticos do propostaGen da Valoria (só porta):
    portas 100% idênticas (mesma chave meta+valor) viram 1 linha na proposta,
    então a OP precisa da MESMA linha (senão a numeração N.M desalinha)."""
    out, buckets = [], {}
    for it in itens:
        if (it.get("categoria") or "").strip().lower() != "porta":
            out.append(it)
            continue
        meta = it.get("meta") or {}
        if isinstance(meta, str):
            try: meta = json.loads(meta)
            except Exception: meta = {}
        tem_ab = (str(meta.get("porta_ambiente_a") or "").strip()
                  or str(meta.get("porta_ambiente_b") or "").strip())
        # Porta "legacy" (import antigo, meta de porta vazio) renderiza só o
        # descritivo: ambiente_id sai da chave e o descritivo entra, senão duas
        # linhas byte-idênticas em ambientes diferentes não consolidam.
        fluxo_novo = bool(tem_ab or str(meta.get("porta_obs") or "").strip()
                          or _f0(meta.get("porta_largura_cm")) or _f0(meta.get("porta_altura_cm"))
                          or str(meta.get("tipo_porta") or "").strip()
                          or _f0(meta.get("porta_folhas"))
                          or str(meta.get("codigo_porta") or "").strip())
        desc_legacy = (it.get("descritivo") or "").strip()
        key = json.dumps([
            "porta",
            "" if (tem_ab or (not fluxo_novo and desc_legacy)) else (it.get("ambiente_id") or ""),
            (it.get("subtipo") or "").lower(),
            (it.get("especie_nome") or "").lower(),
            (it.get("cor") or "").lower(),
            (it.get("dimensao_label") or "").lower(),
            str(meta.get("tipo_porta") or "").lower(),
            str(meta.get("codigo_porta") or "").lower(),
            str(meta.get("porta_ambiente_a") or "").lower(),
            str(meta.get("porta_ambiente_b") or "").lower(),
            str(meta.get("porta_obs") or "").lower(),
            _f0(meta.get("porta_largura_cm")),
            _f0(meta.get("porta_altura_cm")),
            "" if fluxo_novo else desc_legacy.lower(),
            _f0(it.get("valor_total")),
        ])
        if key in buckets:
            grp = buckets[key]
            grp["_grupo"] = grp.get("_grupo", 1) + 1
            try:
                grp["metragem_informada"] = (float(grp.get("metragem_informada") or 0)
                                             + float(it.get("metragem_informada") or 0))
            except Exception:
                pass
            # A proposta multiplica porta_folhas pelo tamanho do grupo — é daí que
            # a METRAGEM TOTAL sai N vezes maior (2 portas 1,58x2,50 = 16 m², não
            # 8). Porta legacy fica com o meta intacto: mexer nele ligaria o fluxo
            # novo no renderer e inventaria texto.
            if grp.get("_fluxo_novo"):
                grp["meta"]["porta_folhas"] = grp["_folhas_base"] * grp["_grupo"]
        else:
            it = dict(it)
            it["meta"] = dict(meta)
            it["_fluxo_novo"] = fluxo_novo
            it["_folhas_base"] = max(0, _round_js(_f0(meta.get("porta_folhas")))) or 1
            buckets[key] = it
            out.append(it)
    return out


# ---------------------------------------------------------------------------
# Numeração N.M: quem manda é o renderer da Valoria.
#
# A OP numerava por ordem de 1ª aparição da categoria crua (piso=1, painel=2,
# marcenaria=3, porta=4), mas o computeNumeracaoProposta ordena as SEÇÕES por
# uma lista fixa (PISO→RODAPÉ→FORRO→PAINEL→DECK→PORTA→ESCADA, desconhecidas
# alfabéticas depois), agrupa toda categoria com PORTA numa seção só e, dentro
# da seção de porta, ordena pelo TÍTULO vendido. Resultado: a porta que a
# proposta vende como 3.1 chegava na fábrica como 4.1 (Will 04/09, sim 10935).
#
# Em vez de reescrever essa regra em Python (encodeCategoria + agrupamento +
# ordenação: divergiria na primeira mudança da proposta), o watcher chama o
# PRÓPRIO código da Valoria pelo node. O bundle é recompilado sozinho quando o
# fonte muda, então numeração da fábrica e numeração do cliente não têm como
# andar separadas.
NUMERACAO_SRC = "/root/valoria-app/src/app/lib"
NUMERACAO_ESBUILD = "/root/valoria-app/node_modules/.bin/esbuild"
NUMERACAO_ENTRY = f"{BASE}/numeracao-entry.mjs"
NUMERACAO_BUNDLE = f"{BASE}/numeracao-bundle.cjs"
NUMERACAO_ENTRY_JS = """// Gerado pelo compras-contratos-watcher.py — não editar na mão.
// stdin: {itens, ambientes, cliente} → stdout: {"<id do item>": "3.1", ...}
import { computeNumeracaoProposta } from "/root/valoria-app/src/app/lib/propostaGen.ts";
let buf = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", (c) => { buf += c; });
process.stdin.on("end", () => {
  const d = JSON.parse(buf);
  const num = computeNumeracaoProposta(d.itens || [], d.ambientes || [], d.cliente || "");
  process.stdout.write(JSON.stringify(num.porItem || {}));
});
"""


def _numeracao_bundle():
    """Compila o bundle quando ele não existe ou está mais velho que o fonte da
    Valoria. Devolve o caminho do .cjs pronto pro node."""
    ult = 0
    for raiz, _dirs, arqs in os.walk(NUMERACAO_SRC):
        for a in arqs:
            try:
                ult = max(ult, os.path.getmtime(os.path.join(raiz, a)))
            except OSError:
                pass
    if os.path.exists(NUMERACAO_BUNDLE) and os.path.getmtime(NUMERACAO_BUNDLE) >= ult:
        return NUMERACAO_BUNDLE
    with open(NUMERACAO_ENTRY, "w") as f:
        f.write(NUMERACAO_ENTRY_JS)
    # propostaGen importa o supabase.ts, que cria os clients no import: sem as
    # VITE_* o createClient estoura antes de a numeração rodar. Aqui ninguém vai
    # à rede (computeNumeracaoProposta é puro), então URL de fachada resolve.
    subprocess.run(
        [NUMERACAO_ESBUILD, NUMERACAO_ENTRY, "--bundle", "--platform=node", "--format=cjs",
         f"--outfile={NUMERACAO_BUNDLE}", "--log-level=error",
         '--define:import.meta.env={}',
         '--define:import.meta.env.VITE_SUPABASE_URL="http://watcher.local"',
         '--define:import.meta.env.VITE_SUPABASE_ANON_KEY="watcher"',
         '--define:import.meta.env.VITE_PARKET_SUPABASE_URL="http://watcher.local"',
         '--define:import.meta.env.VITE_PARKET_ANON_KEY="watcher"'],
        check=True, capture_output=True, text=True, timeout=300)
    log("numeracao: bundle da Valoria recompilado")
    return NUMERACAO_BUNDLE


def numeracao_proposta(itens, ambientes, cliente=""):
    """{id do item da sim: "3.1"} igual ao que o cliente vê na proposta.
    Devolve {} se o node/bundle falhar — aí a lista cai na numeração antiga em
    vez de derrubar a rodada do watcher."""
    if not itens or not ambientes:
        return {}
    try:
        limpos = []
        for it in itens:
            it = dict(it)
            meta = it.get("meta")
            if isinstance(meta, str):
                try:
                    meta = json.loads(meta)
                except Exception:
                    meta = {}
            it["meta"] = meta or {}
            limpos.append(it)
        p = subprocess.run(
            ["node", _numeracao_bundle()],
            input=json.dumps({"itens": limpos, "ambientes": ambientes, "cliente": cliente or ""}),
            capture_output=True, text=True, timeout=180)
        if p.returncode != 0:
            raise RuntimeError((p.stderr or "").strip()[:300])
        return json.loads(p.stdout or "{}") or {}
    except Exception as e:
        log(f"numeracao_proposta falhou (mantendo numeração por categoria): {e}")
        return {}


def sim_itens_e_ambientes(vid):
    """Itens + ambientes da sim, na MESMA ordem do buildPropostaItens da Valoria
    (ambiente.ordem, depois item.ordem). Traz a linha inteira porque a numeração
    roda no código da proposta, que lê campos que a OP nem usa."""
    itens = sql(VALORIA, f"""
        SELECT si.*, a.nome AS ambiente_nome
          FROM ops.simulacao_itens si
          LEFT JOIN ops.ambientes a ON a.id = si.ambiente_id
         WHERE si.simulacao_id = '{vid}'
         ORDER BY COALESCE(a.ordem, 1000000000000), si.ordem NULLS LAST, si.created_at
    """) or []
    ambientes = sql(VALORIA, f"""
        SELECT id, nome, ordem FROM ops.ambientes
         WHERE simulacao_id = '{vid}' ORDER BY COALESCE(ordem, 1000000000000)
    """) or []
    return itens, ambientes


def _ordem_numero(numero):
    """Ordena "3.10" depois de "3.2" (comparação numérica, não de texto), que é a
    ordem em que a proposta lista os itens. Número estranho vai pro fim."""
    partes = []
    for p in (numero or "").split("."):
        try:
            partes.append(int(p.strip()))
        except ValueError:
            return (10 ** 9,)
    return tuple(partes) or (10 ** 9,)


def lista_fabricacao(itens, ambientes=None, cliente="", com_legado=False):
    """Itens de PORTA e MARCENARIA da sim → lista de fabricação da OP do PCP.
    numero = numeração REAL da proposta, calculada pelo próprio renderer da
    Valoria (numeracao_proposta). Sem ambientes (ou com o node fora do ar) cai
    na numeração antiga por ordem de aparição da categoria.

    com_legado=True devolve também o numero_legado (a numeração antiga), que é
    como as OPs já criadas estão gravadas — é por ele que o sync casa o item pra
    corrigir a numeração sem precisar de backfill."""
    itens = consolidar_portas(itens)
    numeros = numeracao_proposta(itens, ambientes or [], cliente)
    out = []
    cat_idx, cat_count = {}, {}
    for it in itens:
        cat = (it.get("categoria") or "").strip().lower() or "geral"
        if cat not in cat_idx:
            cat_idx[cat] = len(cat_idx) + 1
        cat_count[cat] = cat_count.get(cat, 0) + 1
        legado = f"{cat_idx[cat]}.{cat_count[cat]}"
        numero = numeros.get(it.get("id")) or legado
        if not deve_produzir(cat, it.get("subtipo")):
            continue
        meta = it.get("meta") or {}
        if isinstance(meta, str):
            try: meta = json.loads(meta)
            except Exception: meta = {}
        try: m = round(float(it.get("metragem_informada") or 0), 3)
        except Exception: m = 0
        item = {
            "numero": numero,
            "categoria": cat,
            "subtipo": (it.get("subtipo") or "").strip() or None,
            "especie": (it.get("especie_nome") or "").strip() or None,
            "cor": (it.get("cor") or "").strip() or None,
            "dimensao": (it.get("dimensao_label") or "").strip() or None,
            "ambiente": (it.get("ambiente_nome") or "").strip() or None,
            "metragem": m,
            "descritivo": (it.get("descritivo") or "").strip()[:400] or None,
        }
        if com_legado and legado != numero:
            item["numero_legado"] = legado
        # Materiais usados pra fabricar E pra instalar ESTE item (Will 06/08:
        # aparecer na OP; 04/09: instalação também, painel/forro só tem essa).
        insumos = normalizar_insumos(it.get("insumos_fabricacao"))
        insumos_inst = normalizar_insumos(it.get("insumos_instalacao"))
        if insumos:
            item["insumos"] = insumos
        if insumos_inst:
            item["insumos_instalacao"] = insumos_inst
        if cat == "porta":
            grupo = int(it.get("_grupo") or 1)
            fluxo_novo = bool(it.get("_fluxo_novo"))
            texto = (meta.get("porta_obs") or "") + " " + (it.get("descritivo") or "")
            qtd, _folhas_pp = portas_e_folhas(meta, m)
            if not (_f0(meta.get("porta_folhas")) or _f0(meta.get("porta_folhas_por_conjunto"))):
                # Meta sem nenhuma contagem: parseia "N PORTAS" do texto (Will 06/08).
                mt = _RE_QTD_PORTA.search(texto)
                if mt:
                    qtd = max(1, int(mt.group(1)))
            # Multiplicar pelo grupo consolidado so faz sentido quando a contagem
            # NAO veio do metragem_informada (que o consolidar ja somou) e quando o
            # meta nao foi multiplicado: com porta_folhas_por_conjunto a qtd sai do
            # metragem_informada somado, e no fluxo novo o consolidar_portas ja
            # multiplicou porta_folhas pelo grupo (igual proposta). Nos dois casos o
            # x grupo aqui dobrava a conta.
            if not fluxo_novo and not _f0(meta.get("porta_folhas_por_conjunto")):
                qtd *= grupo
            item["qtd"] = qtd
            # No modo UN o metragem_informada guarda a QUANTIDADE de portas, não m2:
            # copiar ele cru mandava pra fábrica "2 m2" numa porta que a proposta
            # vende como 16,00 m2. Recalcula pela fórmula da proposta (Will 04/09).
            item["metragem"] = metragem_porta(meta, m)
            if grupo > 1:
                # Portas idênticas consolidadas em 1 linha: o BOM da sim é de UMA
                # porta, então escala pelas N do grupo (as duas listas).
                for ins in insumos + insumos_inst:
                    try: ins["qtd"] = round(float(ins["qtd"]) * grupo, 3)
                    except Exception: pass
            # Nome vendido na proposta ("CORRER EXTERNA CARVALHO EUROPEU NEVADO"):
            # a OP mostra ele no lugar dos campos crus (Will 04/09).
            item["titulo"] = titulo_porta(meta, item["subtipo"], item["especie"], item["cor"])
            item["porta"] = {
                "codigo": (meta.get("codigo_porta") or "").strip() or None,
                "tipo": (meta.get("tipo_porta") or "").strip() or None,
                "qtd_folhas": folhas_porta(meta, texto, qtd, 1 if fluxo_novo else grupo),
                "largura_cm": meta.get("porta_largura_cm") or None,
                "altura_cm": meta.get("porta_altura_cm") or None,
                "obs": (meta.get("porta_obs") or "").strip() or None,
            }
        out.append(item)
    # Lista sai na ordem da proposta (3.1 antes de 4.1), que é como o cliente e a
    # fábrica leem o mesmo item. A ordem dos itens da sim não serve: ela segue o
    # cadastro, não a numeração.
    out.sort(key=lambda i: _ordem_numero(i.get("numero")))
    return out


ANEXO_KEYS = ("attachments", "anexos", "anexos_origem")


def coletar_anexos_det(det, seen, out):
    """Mesma regra do coletarAnexos do AnexosBox da Valoria (mapa_pdf + 3 chaves)."""
    if not isinstance(det, dict):
        return
    mp = det.get("mapa_pdf") or {}
    if isinstance(mp, dict) and mp.get("url") and mp["url"] not in seen:
        seen.add(mp["url"])
        out.append({"name": f"Mapa da obra — {mp.get('name') or 'PDF'}", "url": mp["url"],
                    "mimeType": mp.get("type") or "application/pdf"})
    for key in ANEXO_KEYS:
        arr = det.get(key)
        if not isinstance(arr, list):
            continue
        for a in arr:
            if not isinstance(a, dict):
                continue
            url = a.get("url") or a.get("webViewLink")
            if not url or url in seen:
                continue
            seen.add(url)
            mime = a.get("mimeType") or a.get("type") or ("link" if a.get("kind") == "link" else None)
            out.append({"name": a.get("name") or url, "url": url, "mimeType": mime})


def anexos_producao(valoria_card_id):
    """Anexos (projeto) pro card do PCP: card da Valoria (ops.cards_solicitacao)
    + card espelho do Cloud (kanban_cards via details.space_card_id)."""
    seen, out = set(), []
    if not valoria_card_id:
        return out
    rows = sql(VALORIA, f"SELECT details FROM ops.cards_solicitacao WHERE id = '{valoria_card_id}'") or []
    det = (rows[0].get("details") if rows else None) or {}
    if isinstance(det, str):
        try: det = json.loads(det)
        except Exception: det = {}
    coletar_anexos_det(det, seen, out)
    space_id = det.get("space_card_id")
    if space_id:
        srows = sql(CLOUD, f"SELECT details FROM kanban_cards WHERE id = '{space_id}'") or []
        sdet = (srows[0].get("details") if srows else None) or {}
        if isinstance(sdet, str):
            try: sdet = json.loads(sdet)
            except Exception: sdet = {}
        coletar_anexos_det(sdet, seen, out)
    return out


def obra_code_limpo(valor, fallback):
    """QUE FAZ: devolve o obra_code pra exibir no campo 'projeto' da OP.
    Se o obra_code for um UUID (poluição de import antigo que gravou card_id
    ali — ~500 sims afetadas), cai pro nome do cliente. Sem isso o card do
    PCP mostrava 'e12237e1-26b8-...' no lugar do nome da obra."""
    v = (valor or "").strip()
    if not v or re.match(r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$", v, re.I):
        return fallback
    return v


def criar_op_producao(contrato, proposta, itens_fab, valoria_card_id, compras_payload=None):
    """OP automática no Kanban PCP (producao_ordens) na assinatura do contrato.
    Entra em '1. VALIDAÇÃO' — o projeto executivo é anexado no card da Valoria e
    o sync_anexos_producao vai puxando pra cá até a OP finalizar.
    compras_payload = card de Fabricação do Ronaldo ADIADO: só vira card em
    compras quando a Produção aprovar a lista (lista_aprovada_at)."""
    ja = sql(CLOUD, f"SELECT 1 FROM producao_ordens WHERE contrato_id = '{contrato['id']}' LIMIT 1") or []
    if ja:
        return None
    # OP antecipada (perna projetos-aprovado, sem contrato) do mesmo card Valoria:
    # adota em vez de duplicar — vira a OP oficial do contrato.
    if valoria_card_id:
        orfa = sql(CLOUD, f"""
            SELECT id FROM producao_ordens
             WHERE origem = 'projetos-aprovado' AND valoria_card_id = '{valoria_card_id}'
             LIMIT 1
        """) or []
        if orfa:
            rest_patch("producao_ordens", f"id=eq.{orfa[0]['id']}", {
                "contrato_id": str(contrato["id"]),
                "origem": "contrato-assinado",
                "solicitante": "Automático · Contrato assinado",
                "compras_payload": compras_payload,
                "updated_at": datetime.now(timezone.utc).isoformat(),
            })
            log(f"OP producao {orfa[0]['id']} adotada pelo contrato {contrato['id']} (era projetos-aprovado)")
            return {"id": orfa[0]["id"]}
    nxt = sql(CLOUD, r"""
        SELECT coalesce(max(nullif(regexp_replace(id, '\D', '', 'g'), '')::int), 0) + 1 AS n
          FROM producao_ordens
    """)[0]["n"]
    hoje = datetime.now(timezone.utc).astimezone()
    cliente = proposta.get("cliente") or "Cliente"
    numero = proposta.get("numero") or ""
    anexos = anexos_producao(valoria_card_id)
    row = {
        "id": "OP-" + str(nxt).zfill(4),
        "cliente_projeto": cliente + (f" · {numero}" if numero else ""),
        "solicitante": "Automático · Contrato assinado",
        "setor": "Marcenaria",
        "etapa": "1. VALIDAÇÃO",
        "prioridade": "Normal",
        "valor": 0,
        "data": hoje.strftime("%Y-%m-%d"),
        "pedido_por": "Contrato",
        "projeto": obra_code_limpo(proposta.get("obra_code"), cliente),
        "prazo_entrega": None,
        "observacoes": f"OP gerada automaticamente na assinatura do contrato \"{contrato.get('titulo') or ''}\". "
                       f"Proposta {numero} — {cliente}.",
        "itens": itens_fab,
        "anexos": anexos,
        "contrato_id": str(contrato["id"]),
        "valoria_simulacao_id": proposta.get("valoria_simulacao_id"),
        "valoria_card_id": valoria_card_id,
        "origem": "contrato-assinado",
        "compras_payload": compras_payload,
    }
    created = rest_insert("producao_ordens", row)
    op = created[0] if isinstance(created, list) else created
    log(f"OP producao criada id={op.get('id')} itens={len(itens_fab)} anexos={len(anexos)} contrato={contrato['id']}")
    return op


def liberar_compras_aprovadas():
    """Produção deu OK na lista de fabricação (lista_aprovada_at) → cria AGORA o
    card de Fabricação do Ronaldo em compras com o payload guardado na OP.
    Dedup pelo kanban_cards.details->>'contrato_id' (mesma chave de sempre)."""
    rows = sql(CLOUD, """
        SELECT po.id, po.contrato_id, po.compras_payload, po.lista_aprovada_por, po.itens, po.edicoes,
               po.estoque_conferencia
          FROM producao_ordens po
         WHERE po.origem = 'contrato-assinado'
           AND po.lista_aprovada_at IS NOT NULL
           AND po.compras_payload IS NOT NULL
           AND NOT EXISTS (SELECT 1 FROM kanban_cards kc
                            WHERE kc.dept_id = 'compras'
                              AND kc.details->>'contrato_id' = po.contrato_id)
    """) or []
    for o in rows:
        try:
            payload = o.get("compras_payload") or {}
            if isinstance(payload, str):
                payload = json.loads(payload)
            c, p = payload.get("contrato") or {}, payload.get("proposta") or {}
            if not c.get("id"):
                continue
            # Materiais saem dos itens ATUAIS da OP (Produção pode ter editado a
            # lista antes do OK) — payload da assinatura é só fallback.
            itens = o.get("itens") or []
            if isinstance(itens, str):
                try: itens = json.loads(itens)
                except Exception: itens = []
            adaptados = [{
                "categoria": it.get("categoria"),
                "especie_nome": it.get("especie"),
                "dimensao_label": it.get("dimensao"),
                "insumos_fabricacao": it.get("insumos") or [],
            } for it in itens]
            materiais = agg_insumos(adaptados, "insumos_fabricacao") or payload.get("materiais") or []
            # Conferência de estoque da Produção (Almoxarifado Curitiba): abate do
            # pedido o que já tem no depósito — card do Ronaldo sai só com o que falta.
            conf = o.get("estoque_conferencia") or {}
            if isinstance(conf, str):
                try: conf = json.loads(conf)
                except Exception: conf = {}
            abat = {}
            for ci in (conf.get("itens") or []):
                try: q = float(ci.get("abatida") or 0)
                except Exception: q = 0.0
                if q > 0:
                    abat[((ci.get("nome") or "").strip().upper(),
                          (ci.get("unidade") or "un").strip().upper())] = q
            abatidos = []
            if abat:
                novos = []
                for m in materiais:
                    k = ((m.get("nome") or "").strip().upper(),
                         (m.get("unidade") or "un").strip().upper())
                    try: qtd_atual = float(m.get("qtd") or 0)
                    except Exception: qtd_atual = 0.0
                    q = min(abat.get(k, 0.0), qtd_atual)  # lista pode ter mudado pós-conferência
                    if q > 0:
                        abatidos.append({"nome": m.get("nome"), "unidade": m.get("unidade"), "abatida": q})
                        resto = round(qtd_atual - q, 3)
                        if resto <= 0:
                            continue
                        m = dict(m, qtd=resto)
                    novos.append(m)
                materiais = novos
            edicoes = o.get("edicoes") or []
            if isinstance(edicoes, str):
                try: edicoes = json.loads(edicoes)
                except Exception: edicoes = []
            extra = {}
            if edicoes:
                extra["edicoes_producao"] = edicoes
            if abatidos:
                extra["estoque_abatido"] = {"deposito": conf.get("deposito"), "at": conf.get("at"),
                                            "por": conf.get("por"), "itens": abatidos}
            card = criar_card("compras", "Fabricação", c, p,
                              materiais, None,
                              produtos=payload.get("produtos"),
                              extra_details=extra or None)
            quem = o.get("lista_aprovada_por") or "Produção"
            log(f"compras liberado pós-OK producao: OP {o['id']} → card {card.get('id')} "
                f"(aprovado por {quem}, {len(abatidos)} materiais abatidos do estoque)")
        except Exception as e:
            log(f"ERRO liberar compras OP {o.get('id')}: {e}")


def sync_anexos_producao():
    """Re-sinca anexos (projeto) do card Valoria pras OPs automáticas não finalizadas —
    o projeto costuma ser anexado DEPOIS da assinatura. Merge tb dos projetos
    executivos publicados na etapa 7 do gestão (perna projetos-aprovado): esse
    merge PRECISA acontecer aqui dentro porque o PATCH substitui a lista."""
    ops_rows = sql(CLOUD, """
        SELECT id, valoria_card_id, contrato_id, cliente_projeto, anexos FROM producao_ordens
         WHERE origem IN ('contrato-assinado', 'projetos-aprovado')
           AND etapa <> '7. FINALIZADO'
    """) or []
    for o in ops_rows:
        try:
            atual = anexos_producao(o.get("valoria_card_id"))
            vistos = {a.get("url") for a in atual}
            cli = (o.get("cliente_projeto") or "").split(" · ")[0].strip()
            for e in executivo_docs_para_op(o.get("contrato_id"), cli):
                if e["url"] not in vistos:
                    vistos.add(e["url"])
                    atual.append(e)
            antigo = o.get("anexos") or []
            if isinstance(antigo, str):
                try: antigo = json.loads(antigo)
                except Exception: antigo = []
            if {a.get("url") for a in atual} == {a.get("url") for a in antigo}:
                continue
            rest_patch("producao_ordens", f"id=eq.{o['id']}",
                       {"anexos": atual, "updated_at": datetime.now(timezone.utc).isoformat()})
            log(f"OP {o['id']}: anexos sincados ({len(antigo)} → {len(atual)})")
        except Exception as e:
            log(f"ERRO sync anexos OP {o.get('id')}: {e}")


LIBERACAO_KEYS = (
    "liberado_projetos", "liberado_projetos_em", "liberado_projetos_por",
    "liberado_para_producao", "liberado_para_producao_em",
    "liberado_para_producao_por", "liberado_para_producao_autor",
    "qtd_liberada_producao", "obs_producao",
)


def _achar_projeto_gestao(op):
    """Acha a linha de gestao.projetos que originou a OP.

    Ordem: gestao_projeto_id (vínculo direto, gravado por sync_criar_op_de_projetos
    e presente em 47 das 49 OPs) → contrato_id → simulacao_id.

    O gestao_projeto_id É a chave boa e tem que vir primeiro: contrato_id costuma
    ser NULL nos dois lados, e a comparação por simulação compara maçã com laranja
    (producao_ordens.valoria_simulacao_id é o id da sim NA VALORIA, enquanto
    gestao.projetos.simulacao_id é o id em simulacao_projetos do Cloud). Sem esse
    primeiro passo a liberação do Projetos nunca chegava no card do PCP."""
    gp = op.get("gestao_projeto_id")
    if gp:
        rows = local_pg(f"SELECT id FROM gestao.projetos WHERE id::text = '{_pg_str(str(gp))}' LIMIT 1")
        if rows:
            return rows[0]
    contrato_id = op.get("contrato_id")
    if contrato_id:
        rows = local_pg(f"SELECT id FROM gestao.projetos WHERE contrato_id::text = '{contrato_id}' LIMIT 1")
        if rows:
            return rows[0]
    vsim = op.get("valoria_simulacao_id")
    if vsim:
        rows = local_pg(f"SELECT id FROM gestao.projetos WHERE simulacao_id::text = '{vsim}' LIMIT 1")
        if rows:
            return rows[0]
    return None


_AMB_NORM_RE = re.compile(r"[^A-Z0-9]+")


def _norm_ambiente(s):
    """Normaliza pra comparar 'BANHO MASTER' == '1º pav — banho master'."""
    s = (s or "").upper()
    s = _AMB_NORM_RE.sub(" ", s).strip()
    return " ".join(s.split())


def sync_liberacao_projetos():
    """Espelha as flags de liberação do projetos-app (gestao.itens.meta.*)
    pros itens correspondentes de producao_ordens.itens[]. O PCP olha esses
    campos pra mostrar o chip "liberado por fulano X/Y" no card e o aviso de
    risco ao mover o card sem tudo aprovado.

    Casamento: (categoria_raiz, ambiente_normalizado) primeiro — é a chave mais
    estável já que watcher e SQL 004 do gestão numeram raízes por critérios
    diferentes (aparição na proposta vs ranking canônico), mas o AMBIENTE é
    idêntico em ambos. Fallback (raiz, sub_M) cobre proposta sem ambiente ou
    itens marcenaria de mesmo ambiente com 2 linhas separadas.

    Merge por item (dict.update) — NUNCA replace da lista, senão atropela
    campos editados manualmente no PCP (status_producao, edicoes...)."""
    # SEM filtro de origem: a maioria das OPs hoje nasce com origem='projetos-auto'
    # (sync_criar_op_de_projetos) e a lista antiga só aceitava contrato-assinado /
    # projetos-aprovado, o que deixava 42 das 49 OPs fora do sync de liberação.
    # Quem decide se há o que espelhar é _achar_projeto_gestao logo abaixo.
    ops = sql(CLOUD, """
        SELECT id, valoria_card_id, contrato_id, valoria_simulacao_id,
               gestao_projeto_id, itens
          FROM producao_ordens
         WHERE etapa <> '7. FINALIZADO'
    """) or []
    for o in ops:
        try:
            projeto = _achar_projeto_gestao(o)
            if not projeto:
                continue
            itens_g = local_pg(f"""
                SELECT meta, quantidade, ambiente FROM gestao.itens
                 WHERE projeto_id = '{projeto['id']}'
            """) or []
            by_amb = {}    # (raiz, ambiente_norm) -> flags
            by_sub = {}    # (raiz, sub_m)         -> flags
            for gi in itens_g:
                meta_gi = gi.get("meta") or {}
                if isinstance(meta_gi, str):
                    try: meta_gi = json.loads(meta_gi)
                    except Exception: meta_gi = {}
                raiz = (meta_gi.get("categoria_raiz") or "").strip().upper()
                if not raiz:
                    continue
                flags = {k: meta_gi.get(k) for k in LIBERACAO_KEYS}
                amb = _norm_ambiente(gi.get("ambiente"))
                if amb:
                    by_amb[(raiz, amb)] = flags
                cod = (meta_gi.get("codigo") or "").strip()
                if "." in cod:
                    by_sub[(raiz, cod.split(".", 1)[1])] = flags
            if not by_amb and not by_sub:
                continue

            atual = o.get("itens") or []
            if isinstance(atual, str):
                try: atual = json.loads(atual)
                except Exception: atual = []

            novos, mudou = [], False
            for it in atual:
                raiz = (it.get("categoria") or "").strip().upper()
                amb = _norm_ambiente(it.get("ambiente"))
                num = (it.get("numero") or "")
                sub = num.split(".", 1)[1] if "." in num else None
                flags = by_amb.get((raiz, amb)) if amb else None
                if flags is None and sub is not None:
                    flags = by_sub.get((raiz, sub))
                novo = dict(it)
                if flags is not None:
                    for k in LIBERACAO_KEYS:
                        v = flags.get(k)
                        if v is None:
                            if k in novo:
                                novo.pop(k, None)
                        else:
                            novo[k] = v
                if novo != it:
                    mudou = True
                novos.append(novo)
            if mudou:
                rest_patch("producao_ordens", f"id=eq.{o['id']}",
                           {"itens": novos,
                            "updated_at": datetime.now(timezone.utc).isoformat()})
                log(f"OP {o['id']}: sync liberação projetos ({len(novos)} itens verificados)")
        except Exception as e:
            log(f"ERRO sync_liberacao_projetos OP {o.get('id')}: {e}")


def _chaves_item_fab(it):
    """Chaves de casamento de um item da OP com o item da sim. Ambiente primeiro
    (mais estável que a numeração, que anda quando some/entra item na proposta),
    numero como fallback pra proposta sem ambiente."""
    cat = (it.get("categoria") or "").strip().upper()
    amb = _norm_ambiente(it.get("ambiente"))
    return ((cat, amb) if amb else None, (cat, (it.get("numero") or "").strip()))


def _casar_item_fab(it, por_amb, por_num):
    """Acha o item da proposta que corresponde ao item da OP, ou None.

    Ambiente primeiro. O número é só reserva, e reserva COM trava: se o item da
    OP tem ambiente e o candidato pelo número aponta pra outro ambiente, não é o
    mesmo item, é a numeração que andou. Sem essa trava a porta PM20 Lavabo 02
    da OP-0050, que saiu da proposta, herdava o título e a metragem da PM15
    Cozinha só por as duas serem "2.16" (Will 04/09, revisão geral das OPs)."""
    k_amb, k_num = _chaves_item_fab(it)
    if k_amb:
        alvo = por_amb.get(k_amb)
        if alvo is not None:
            return alvo
    alvo = por_num.get(k_num)
    if alvo is None:
        return None
    if k_amb:
        amb_alvo = _norm_ambiente(alvo.get("ambiente"))
        if amb_alvo and amb_alvo != k_amb[1]:
            return None
    return alvo


def _mesclar_insumos(antigos, novos):
    """Lista do Valor manda, mas preserva o que é do chão de fábrica:
    o 'conferido' de cada insumo que continua existindo (casa por nome) e os
    insumos adicionados na mão no PCP (manual=true), que não têm par no Valor."""
    conf = {}
    for a in antigos or []:
        nome = str(a.get("nome") or "").strip().upper()
        if nome and a.get("conferido"):
            conf[nome] = a["conferido"]
    out = []
    for n in novos:
        n = dict(n)
        c = conf.get(str(n.get("nome") or "").strip().upper())
        if c:
            n["conferido"] = c
        out.append(n)
    out += [a for a in antigos or [] if a.get("manual")]
    return out


def sync_insumos_valoria():
    """Lista de insumos (fabricação E instalação) da OP acompanha o Valor pra
    sempre (Will 04/09): editou o BOM do item na proposta, o PCP recebe na
    próxima rodada. Antes o BOM era um retrato tirado na criação da OP e nunca
    mais atualizava, e a instalação nem chegava a ser copiada, então painel e
    forro (que só têm insumo de instalação) apareciam com o kit vazio.

    Merge por item (só as duas chaves de insumo) — NUNCA replace da lista de
    itens, senão atropela o que é editado no PCP (status_producao, edicoes,
    flags de liberação). Lista vazia no Valor não apaga a da OP: kit montado na
    mão no chão de fábrica não pode sumir por falta de dado na origem."""
    ops = sql(CLOUD, """
        SELECT id, cliente_projeto, valoria_simulacao_id, itens
          FROM producao_ordens
         WHERE etapa <> '7. FINALIZADO'
           AND valoria_simulacao_id IS NOT NULL
    """) or []
    for o in ops:
        try:
            vid = o["valoria_simulacao_id"]
            sim_itens, ambientes = sim_itens_e_ambientes(vid)
            if not sim_itens:
                continue
            # Índice do esperado. Chave ambígua (2 itens no mesmo ambiente) é
            # descartada: melhor não sincar do que colar o BOM no item errado.
            por_amb, por_num = {}, {}
            for novo in lista_fabricacao(sim_itens, ambientes, o.get("cliente_projeto"),
                                         com_legado=True):
                k_amb, k_num = _chaves_item_fab(novo)
                # A OP já criada está gravada com a numeração antiga, então o
                # item também entra no índice pelo número velho: é assim que a
                # correção da numeração chega nas OPs existentes sem backfill.
                legado = novo.pop("numero_legado", None)
                chaves = [(por_amb, k_amb), (por_num, k_num)]
                if legado:
                    chaves.append((por_num, (k_num[0], legado)))
                for mapa, k in chaves:
                    if not k:
                        continue
                    mapa[k] = None if k in mapa else novo

            atual = o.get("itens") or []
            if isinstance(atual, str):
                try: atual = json.loads(atual)
                except Exception: atual = []

            novos = []
            for it in atual:
                alvo = _casar_item_fab(it, por_amb, por_num)
                novo = dict(it)
                if alvo is not None:
                    for chave in ("insumos", "insumos_instalacao"):
                        do_valor = alvo.get(chave) or []
                        if do_valor:
                            novo[chave] = _mesclar_insumos(it.get(chave), do_valor)
                    # Nome vendido da porta acompanha a proposta na mesma rodada:
                    # renomeou o tipo/espécie lá, a fábrica vê aqui em 3 min
                    # (e as OPs antigas ganham o título sem backfill).
                    if alvo.get("titulo"):
                        novo["titulo"] = alvo["titulo"]
                    # Numeração idem: é por aqui que as OPs gravadas com a
                    # numeração antiga (porta 4.1) passam a mostrar o número que
                    # o cliente tem na proposta (3.1).
                    if alvo.get("numero"):
                        novo["numero"] = alvo["numero"]
                novos.append(novo)
            # A fábrica lê a lista na mesma ordem em que a proposta lista os itens.
            # A OP antiga foi gravada na sequência velha (porta 4.1 no topo), então
            # a reordenação acontece aqui também, não só na criação (Will 04/09).
            novos.sort(key=lambda i: _ordem_numero(i.get("numero")))
            # Compara a lista inteira em vez de item a item: reordenar sem alterar
            # nenhum item também precisa gravar.
            if novos != atual:
                rest_patch("producao_ordens", f"id=eq.{o['id']}",
                           {"itens": novos,
                            "updated_at": datetime.now(timezone.utc).isoformat()})
                log(f"OP {o['id']}: insumos sincados do Valor ({len(novos)} itens)")
        except Exception as e:
            log(f"ERRO sync_insumos_valoria OP {o.get('id')}: {e}")


def lista_fabricacao_gestao(projeto_id):
    """Fallback da lista de fabricação: monta a partir de gestao.itens quando a
    sim da Valoria não está disponível (deletada, sem meta.valoria_simulacao_id
    ou sim fora do Valor). numero = meta.codigo (padrão X.Y da proposta, sempre
    presente). Sem BOM de insumos — só existe na sim; lista fica editável no
    OrdemModal como qualquer outra."""
    rows = local_pg(f"""
        SELECT descritivo, ambiente, quantidade, meta
          FROM gestao.itens
         WHERE projeto_id = '{projeto_id}'
           AND status IS DISTINCT FROM 'cancelado'
         ORDER BY ordem NULLS LAST, created_at
    """) or []
    out = []
    for r in rows:
        meta = r.get('meta') or {}
        if isinstance(meta, str):
            try: meta = json.loads(meta)
            except Exception: meta = {}
        cat = (meta.get('categoria_raiz') or '').strip().lower()
        if not deve_produzir(cat, meta.get('subtipo')):
            continue
        try: m = round(float(r.get('quantidade') or 0), 3)
        except Exception: m = 0
        # Descritivo do gestão embute o prefixo "X.Y · " — tira pra não duplicar
        # com o campo numero da OP.
        desc = re.sub(r'^\d+(\.\d+)*\s*·\s*', '', (r.get('descritivo') or '').strip())
        out.append({
            "numero": (meta.get('codigo') or '').strip() or None,
            "categoria": cat,
            "subtipo": (meta.get('subtipo') or '').strip() or None,
            "especie": (meta.get('especie') or meta.get('especie_nome') or '').strip() or None,
            "cor": (meta.get('cor') or '').strip() or None,
            "dimensao": (meta.get('dimensao_label') or '').strip() or None,
            "ambiente": (r.get('ambiente') or '').strip() or None,
            "metragem": m,
            "descritivo": desc[:400] or None,
        })
    return out


def sync_criar_op_de_projetos():
    """Cria OP no PCP pra qualquer projeto do gestão que vendeu marcenaria /
    porta / painel / forro laminado e ainda não tem OP. Roda todo ciclo — não
    espera assinatura de contrato. Idempotente por contrato_id, simulacao_id
    ou gestao_projeto_id. Origem='projetos-auto' distingue do fluxo antigo de
    assinatura. Lista de fabricação: sim Valoria quando existe; senão fallback
    de gestao.itens (Will 25/08: OP tem que nascer pra TODO fechamento com
    marcenaria/porta/painel/forro laminado, mesmo obra legada sem sim viva)."""
    projs = local_pg("""
        SELECT p.id, p.cliente, p.contrato_id, p.simulacao_id, p.obra_code
          FROM gestao.projetos p
         WHERE p.simulacao_id IS NOT NULL
           AND EXISTS (
                 SELECT 1 FROM gestao.itens i
                  WHERE i.projeto_id = p.id
                    AND i.status IS DISTINCT FROM 'cancelado'
                    AND (i.meta->>'categoria_raiz' IN ('MARCENARIA','PORTA','PAINEL')
                         OR (i.meta->>'categoria_raiz' = 'FORRO'
                             AND lower(coalesce(i.meta->>'subtipo','')) IN
                                 ('ripado','lamina','laminado','toblerone','muxarabi',
                                  'brise','brise_lamina','brise_macico','macico',
                                  'regua','reguas','recortes')))
                )
    """) or []
    if not projs:
        return
    # Dedup: já com OP?
    ids_ct = [p['contrato_id'] for p in projs if p.get('contrato_id')]
    ids_sim = [p['simulacao_id'] for p in projs if p.get('simulacao_id')]
    ops_ct = set()
    ops_sim = set()
    ops_gp = set()
    lst = ",".join(f"'{p['id']}'" for p in projs)
    for r in sql(CLOUD, f"SELECT gestao_projeto_id FROM producao_ordens WHERE gestao_projeto_id IN ({lst})") or []:
        ops_gp.add(r['gestao_projeto_id'])
    if ids_ct:
        lst = ",".join(f"'{x}'" for x in ids_ct)
        for r in sql(CLOUD, f"SELECT contrato_id FROM producao_ordens WHERE contrato_id IN ({lst})") or []:
            ops_ct.add(r['contrato_id'])
    if ids_sim:
        # simulacao_id no gestão = simulacao_projetos.id no Cloud. Pra achar OP correspondente,
        # a OP tem valoria_simulacao_id (a sim VALORIA), então precisamos resolver via meta.
        lst = ",".join(f"'{x}'" for x in ids_sim)
        for r in sql(CLOUD, f"""
            SELECT sp.id AS sim_id, sp.meta->>'valoria_simulacao_id' AS vid
              FROM simulacao_projetos sp WHERE sp.id IN ({lst})
        """) or []:
            if not r.get('vid'):
                continue
            has = sql(CLOUD, f"SELECT 1 FROM producao_ordens WHERE valoria_simulacao_id = '{r['vid']}' LIMIT 1")
            if has:
                ops_sim.add(r['sim_id'])

    for pr in projs:
        try:
            if pr['id'] in ops_gp:
                continue
            if pr.get('contrato_id') and pr['contrato_id'] in ops_ct:
                continue
            if pr.get('simulacao_id') and pr['simulacao_id'] in ops_sim:
                continue

            sim_rows = sql(CLOUD, f"""
                SELECT sp.id, sp.numero, sp.cliente, sp.obra_code, sp.card_id,
                       sp.meta->>'valoria_simulacao_id' AS vid
                  FROM simulacao_projetos sp
                 WHERE sp.id = '{pr['simulacao_id']}'
            """) or []
            sim = sim_rows[0] if sim_rows else {}
            vid = sim.get('vid')
            fab, vcard = [], None
            if vid:
                itens, ambientes = sim_itens_e_ambientes(vid)
                fab = lista_fabricacao(itens, ambientes, sim.get('cliente'))
                if fab:
                    vrows = sql(VALORIA, f"SELECT card_id FROM ops.simulacoes WHERE id='{vid}'") or []
                    vcard = vrows[0].get('card_id') if vrows else None
            if not fab:
                # Sim Valoria indisponível (deletada / sem vínculo / sim fora do
                # Valor): a obra fechada continua precisando de OP — monta do gestão.
                fab = lista_fabricacao_gestao(pr['id'])
            if not fab:
                continue
            cliente = sim.get('cliente') or pr.get('cliente') or "Cliente"
            numero = sim.get('numero') or ""
            nxt = sql(CLOUD, r"""
                SELECT coalesce(max(nullif(regexp_replace(id, '\D', '', 'g'), '')::int), 0) + 1 AS n
                  FROM producao_ordens
            """)[0]['n']
            hoje = datetime.now(timezone.utc).astimezone()
            anexos = anexos_producao(vcard)
            row = {
                "id": "OP-" + str(nxt).zfill(4),
                "cliente_projeto": cliente + (f" · {numero}" if numero else ""),
                "solicitante": "Automático · Projetos",
                "setor": "Marcenaria",
                "etapa": "1. VALIDAÇÃO",
                "prioridade": "Normal",
                "valor": 0,
                "data": hoje.strftime("%Y-%m-%d"),
                "pedido_por": "Projetos",
                "projeto": obra_code_limpo(sim.get('obra_code'), obra_code_limpo(pr.get('obra_code'), cliente)),
                "prazo_entrega": None,
                "observacoes": f"OP criada automaticamente a partir do projeto do gestão. "
                               f"Proposta {numero} — {cliente}.",
                "itens": fab,
                "anexos": anexos,
                "contrato_id": pr.get('contrato_id'),
                "valoria_simulacao_id": vid,
                "valoria_card_id": vcard,
                "gestao_projeto_id": pr['id'],
                "origem": "projetos-auto",
                "compras_payload": None,
            }
            created = rest_insert("producao_ordens", row)
            op = created[0] if isinstance(created, list) else created
            log(f"OP {op.get('id') if op else '?'} criada auto projetos ({len(fab)} itens fab) — {cliente}")
        except Exception as e:
            log(f"ERRO sync_criar_op_de_projetos projeto {pr.get('id')}: {e}")


# Mapa fase Projetos (lista Trello) → etapa PCP (Will 24/08). Só listas que
# representam um estágio operacional específico entram — as demais (CONTRATOS
# NOVOS, MEDIÇÃO, EXECUTIVO etc) mantêm a OP em '1. VALIDAÇÃO' até PRODUÇÃO.
FASE_PROJETOS_PARA_ETAPA_PCP = {
    "PRODUÇÃO":   "3. PRODUÇÃO",
    "ENTREGA":    "5. LOGÍSTICA E TRANSPORTE",
    "INSTALAÇÃO": "6. EM OBRA",
    "FINALIZADO": "7. FINALIZADO",
    "REPARO":     "8. MANUTENÇÃO E REPAROS",
}
# Ordem canônica das etapas do PCP pra aplicar a regra "só avança, nunca recua".
_ETAPA_ORDEM = {
    "1. VALIDAÇÃO": 1, "2. PRENSA E SEPARAÇÃO": 2, "3. PRODUÇÃO": 3,
    "4. CONTROLE DE QUALIDADE E EMBALAGEM": 4, "5. LOGÍSTICA E TRANSPORTE": 5,
    "6. EM OBRA": 6, "7. FINALIZADO": 7, "8. MANUTENÇÃO E REPAROS": 8,
}


def sync_projetos_fase():
    """Espelha a lista atual do card do board projetos (Trello) em
    producao_ordens.projetos_fase pro PCP ver em que etapa Projetos está sem
    sair do card. Vínculo primeiro por projetos_card_id (fixo), depois via
    gestao_projeto_id no desc do card ou nome do cliente.

    Além de gravar a fase, aplica auto-avanço da etapa do PCP (Will 24/08):
    quando a fase do Projetos entra em PRODUÇÃO/ENTREGA/INSTALAÇÃO/FINALIZADO/
    REPARO, a OP passa pra etapa PCP correspondente — só se estiver ATRÁS.
    Nunca recua etapa (proteção contra fase do Projetos voltar). Registra em
    movimentacoes com origem='auto-projetos-fase'."""
    ops = sql(CLOUD, """
        SELECT id, contrato_id, valoria_simulacao_id, cliente_projeto,
               projetos_fase, projetos_card_id, etapa, movimentacoes
          FROM producao_ordens
         WHERE etapa <> '7. FINALIZADO'
    """) or []
    for o in ops:
        try:
            # Cliente da OP: 'CLIENTE · numero' → pega só o cliente
            cliente = (o.get("cliente_projeto") or "").split(" · ")[0].strip()
            projeto = None
            if o.get("contrato_id"):
                projeto = local_pg(f"SELECT id FROM gestao.projetos WHERE contrato_id::text = '{o['contrato_id']}' LIMIT 1")
                projeto = projeto[0] if projeto else None
            if not projeto and o.get("valoria_simulacao_id"):
                projeto = local_pg(f"SELECT id FROM gestao.projetos WHERE simulacao_id::text = '{o['valoria_simulacao_id']}' LIMIT 1")
                projeto = projeto[0] if projeto else None
            if not projeto and cliente:
                projeto = local_pg(f"SELECT id FROM gestao.projetos WHERE upper(btrim(cliente))=upper(btrim('{_pg_str(cliente)}')) LIMIT 1")
                projeto = projeto[0] if projeto else None
            if not projeto:
                continue
            row = None
            if o.get("projetos_card_id"):
                row = local_pg(f"""
                    SELECT c.id AS card_id, l.nome AS lista
                      FROM trello_projetos.cards c
                      JOIN trello_projetos.listas l ON l.id = c.lista_id
                     WHERE c.id = '{_pg_str(o['projetos_card_id'])}' AND NOT c.closed
                     LIMIT 1""")
            if not row:
                row = local_pg(f"""
                    SELECT c.id AS card_id, l.nome AS lista
                      FROM trello_projetos.cards c
                      JOIN trello_projetos.listas l ON l.id = c.lista_id
                     WHERE NOT c.closed
                       AND (c.descricao LIKE '%gestao_projeto_id:{projeto['id']}%'
                            OR upper(btrim(split_part(c.nome, '|', 1)))
                               = upper(btrim('{_pg_str(cliente)}')))
                     ORDER BY (c.descricao LIKE '%gestao_projeto_id:{projeto['id']}%') DESC,
                              c.date_last_activity DESC NULLS LAST
                     LIMIT 1""")
            if not row:
                continue
            fase_nova = row[0]["lista"]
            card_novo = row[0]["card_id"]
            patch = {}
            fase_mudou = (o.get("projetos_fase") != fase_nova
                          or o.get("projetos_card_id") != card_novo)
            if fase_mudou:
                patch["projetos_fase"] = fase_nova
                patch["projetos_card_id"] = card_novo

            # Auto-avanço da etapa: só se a fase Projetos indica etapa PCP
            # à FRENTE da atual. Nunca recua.
            etapa_alvo = FASE_PROJETOS_PARA_ETAPA_PCP.get(fase_nova)
            etapa_atual = o.get("etapa") or "1. VALIDAÇÃO"
            ord_atual = _ETAPA_ORDEM.get(etapa_atual, 0)
            ord_alvo = _ETAPA_ORDEM.get(etapa_alvo or "", 0)
            if etapa_alvo and ord_alvo > ord_atual:
                patch["etapa"] = etapa_alvo
                mv = o.get("movimentacoes") or []
                if isinstance(mv, str):
                    try: mv = json.loads(mv)
                    except Exception: mv = []
                mv.append({
                    "at": datetime.now(timezone.utc).isoformat(),
                    "por": None,
                    "de": etapa_atual,
                    "para": etapa_alvo,
                    "origem": "auto-projetos-fase",
                    "pendencias": [],
                    "observacao": f"Auto-avanço porque fase Projetos entrou em '{fase_nova}'.",
                })
                patch["movimentacoes"] = mv[-100:]  # cap histórico

            if not patch:
                continue
            patch["updated_at"] = datetime.now(timezone.utc).isoformat()
            rest_patch("producao_ordens", f"id=eq.{o['id']}", patch)
            msg = f"OP {o['id']}: fase projetos → '{fase_nova}'"
            if "etapa" in patch:
                msg += f" · etapa PCP {etapa_atual} → {etapa_alvo}"
            log(msg)
        except Exception as e:
            log(f"ERRO sync_projetos_fase OP {o.get('id')}: {e}")


def sync_edicoes_compras():
    """Edições da lista de fabricação (com justificativa) confirmadas na OP →
    espelha em details.edicoes_producao do card de compras do Ronaldo.
    PATCH sempre com details MERGEADO client-side (nunca replace)."""
    rows = sql(CLOUD, """
        SELECT po.id AS op_id, po.edicoes, kc.id AS card_id, kc.details
          FROM producao_ordens po
          JOIN kanban_cards kc
            ON kc.dept_id = 'compras'
           AND kc.details->>'contrato_id' = po.contrato_id
         WHERE po.origem = 'contrato-assinado'
           AND po.lista_aprovada_at IS NOT NULL
           AND po.edicoes IS NOT NULL
           AND po.edicoes <> '[]'::jsonb
    """) or []
    for r in rows:
        try:
            edicoes = r.get("edicoes") or []
            if isinstance(edicoes, str):
                try: edicoes = json.loads(edicoes)
                except Exception: edicoes = []
            det = r.get("details") or {}
            if isinstance(det, str):
                try: det = json.loads(det)
                except Exception: det = {}
            if det.get("edicoes_producao") == edicoes:
                continue
            rest_patch("kanban_cards", f"id=eq.{r['card_id']}",
                       {"details": {**det, "edicoes_producao": edicoes}})
            log(f"OP {r['op_id']}: edicoes_producao sincadas no card compras {r['card_id']} ({len(edicoes)} edições)")
        except Exception as e:
            log(f"ERRO sync edicoes OP {r.get('op_id')}: {e}")


LISTA_APROVADO = "681ca3122b5e5803275f65f9"  # lista APROVADO no board projetos (CsJmU6DM)
PROJETOS_DATA = "/root/projetos-app/data"    # bind mount do parket-projetos_api (/data)
MAX_EXEC_DOCS_RUN = 4  # conversão 200dpi é pesada: drena backlog aos poucos (cron 3min alcança)


def _pg_str(s):
    return (s or "").replace("'", "''")


def storage_obra_media(path, data, content_type):
    """Upload no bucket obra-media do Cloud. Retorna URL público."""
    import urllib.parse
    safe = "/".join(urllib.parse.quote(seg, safe="") for seg in path.split("/"))
    url = f"{CLOUD_URL}/storage/v1/object/obra-media/{safe}"
    req = urllib.request.Request(url, method="POST", headers={
        "apikey": SERVICE_KEY, "Authorization": f"Bearer {SERVICE_KEY}",
        "Content-Type": content_type, "x-upsert": "true",
        "User-Agent": "compras-watcher/1.0"})
    with urllib.request.urlopen(req, data=data, timeout=120) as r:
        r.read()
    return f"{CLOUD_URL}/storage/v1/object/public/obra-media/{safe}"


def publicar_executivo_etapa7(projeto_id, pdf_path, nome_arquivo, anexo_id, trello_card_id):
    """PDF do card APROVADO → gestao.documentos etapa 7 (mesmo formato do
    /root/publica-docs-etapa7.py: PDF + páginas jpg 200dpi no obra-media).
    É daí que a aba Projetos/Executivo do gestão e a Central do cliente leem."""
    import tempfile, uuid as _uuid
    from pdf2image import convert_from_path
    titulo = re.sub(r"\.pdf$", "", nome_arquivo, flags=re.I)
    slugname = re.sub(r"[^a-z0-9]+", "_", titulo.lower()).strip("_") + ".pdf"
    data = open(pdf_path, "rb").read()
    storage_path = f"gestao/{projeto_id}/docs/12/pdf/{slugname}"
    pdf_url = storage_obra_media(storage_path, data, "application/pdf")
    doc_uuid = str(_uuid.uuid4())
    paginas = []
    imgs = convert_from_path(pdf_path, dpi=200, fmt="jpeg")
    with tempfile.TemporaryDirectory() as tmp:
        for i, img in enumerate(imgs, 1):
            p = os.path.join(tmp, f"page_{i:02d}.jpg")
            img.save(p, "JPEG", quality=85, optimize=True)
            url = storage_obra_media(
                f"gestao/{projeto_id}/docs/12/paginas/{doc_uuid}/page_{i:02d}.jpg",
                open(p, "rb").read(), "image/jpeg")
            paginas.append({"n": i, "url": url})
    meta = json.dumps({"paginas": paginas, "trello_anexo_id": anexo_id,
                       "trello_card_id": trello_card_id}).replace("'", "''")
    local_pg_dml(
        "INSERT INTO gestao.documentos (projeto_id, catalogo_id, etapa_numero, slug, titulo, "
        "arquivo_url, storage_path, content_type, nome_arquivo, tamanho_bytes, gerado_por, meta) "
        f"VALUES ('{projeto_id}', 16, 7, '12', '{_pg_str(titulo)}', '{pdf_url}', '{storage_path}', "
        f"'application/pdf', '{_pg_str(nome_arquivo)}', {len(data)}, 'projetos-aprovado', '{meta}'::jsonb)")
    return len(paginas)


def sync_projetos_aprovado():
    """Perna projetos-aprovado (Will 17/08): card na lista APROVADO do board de
    projetos (Trello = fonte do projetos.parket.works) com PDF anexado → publica
    como Projeto Executivo (gestao.documentos etapa 7). Gestão e Central do
    cliente leem direto daí; a OP do PCP recebe via merge no sync_anexos_producao.
    Vínculo: marca gestao_projeto_id no desc (cards do trigger 2) ou nome do
    cliente (parte antes do '|' no título). Dedup por trello_anexo_id + nome."""
    pend = local_pg(f"""
        SELECT c.id AS card_id, c.nome AS card_nome, g.id AS projeto_id,
               a.id AS anexo_id, a.nome AS anexo_nome, a.path_local
          FROM trello_projetos.cards c
          JOIN LATERAL (
                SELECT gp.id FROM gestao.projetos gp
                 WHERE gp.id::text = COALESCE(substring(c.descricao FROM 'gestao_projeto_id:([0-9a-f-]{{36}})'), '')
                    OR upper(btrim(gp.cliente)) = upper(btrim(split_part(c.nome, '|', 1)))
                 ORDER BY (gp.id::text = COALESCE(substring(c.descricao FROM 'gestao_projeto_id:([0-9a-f-]{{36}})'), '')) DESC,
                          gp.created_at
                 LIMIT 1) g ON true
          JOIN trello_projetos.anexos a ON a.card_id = c.id AND a.baixado
         WHERE c.lista_id = '{LISTA_APROVADO}'
           AND NOT c.closed
           AND (a.mime = 'application/pdf' OR a.nome ~* '\\.pdf$')
           AND a.nome !~* 'or[cç]ament|proposta|contrato'
           AND a.path_local IS NOT NULL
           AND NOT EXISTS (
                 SELECT 1 FROM gestao.documentos d
                  WHERE d.projeto_id = g.id AND d.etapa_numero = 7
                    AND (d.meta->>'trello_anexo_id' = a.id
                         OR upper(d.nome_arquivo) = upper(a.nome)))
         ORDER BY a.criado_em
         LIMIT {MAX_EXEC_DOCS_RUN}
    """) or []
    vistos_run = set()  # anexo duplicado no mesmo card entra 2x no batch — publicar 1x só
    for r in pend:
        try:
            chave = (r["projeto_id"], (r["anexo_nome"] or "").upper())
            if chave in vistos_run:
                continue
            vistos_run.add(chave)
            pdf = os.path.join(PROJETOS_DATA, r["path_local"])
            if not os.path.exists(pdf):
                log(f"projetos-aprovado: arquivo local não achado {pdf} (anexo {r['anexo_id']})")
                continue
            n = publicar_executivo_etapa7(r["projeto_id"], pdf, r["anexo_nome"], r["anexo_id"], r["card_id"])
            log(f"projetos-aprovado: '{r['anexo_nome']}' → etapa 7 do projeto {r['projeto_id']} ({n} págs) [{r['card_nome']}]")
        except Exception as e:
            log(f"ERRO projetos-aprovado anexo {r.get('anexo_id')}: {e}")


def executivo_docs_para_op(contrato_id, cliente):
    """Projetos executivos publicados (etapa 7) do projeto do gestão dessa OP,
    no formato de anexo da producao_ordens."""
    cond = []
    if contrato_id:
        cond.append(f"gp.contrato_id = '{contrato_id}'")
    if cliente:
        cond.append(f"upper(btrim(gp.cliente)) = upper(btrim('{_pg_str(cliente)}'))")
    if not cond:
        return []
    rows = local_pg(f"""
        SELECT d.titulo, d.arquivo_url FROM gestao.documentos d
          JOIN gestao.projetos gp ON gp.id = d.projeto_id
         WHERE d.etapa_numero = 7 AND ({' OR '.join(cond)})
         ORDER BY d.created_at
    """) or []
    return [{"name": f"Projeto executivo — {r['titulo']}", "url": r["arquivo_url"],
             "mimeType": "application/pdf"} for r in rows if r.get("arquivo_url")]


def agg_insumos(itens, campo):
    """Agrega insumos de todos os itens da proposta; soma qtd por (nome, unidade)."""
    acc = {}
    for it in itens:
        origem = " · ".join(x for x in [it.get("categoria"), it.get("especie_nome"), it.get("dimensao_label")] if x)
        lista = it.get(campo) or []
        if isinstance(lista, str):
            try:
                lista = json.loads(lista)
            except Exception:
                lista = []
        for ins in lista:
            nome = (ins.get("nome") or "").strip()
            if not nome:
                continue
            un = (ins.get("unidade") or "un").strip()
            k = (nome.upper(), un.upper())
            if k not in acc:
                acc[k] = {"nome": nome, "unidade": un, "qtd": 0.0, "origens": []}
            try:
                acc[k]["qtd"] += float(ins.get("qtd") or 0)
            except Exception:
                pass
            if origem and origem not in acc[k]["origens"]:
                acc[k]["origens"].append(origem)
    out = []
    for v in acc.values():
        qtd = round(v["qtd"], 2)
        qtd_str = str(int(qtd)) if qtd == int(qtd) else str(qtd)
        out.append({
            "tipo": v["nome"],
            "quantidade": f"{qtd_str} {v['unidade']}",
            "justificativa": ", ".join(v["origens"])[:120],
        })
    return out


def ensure_gestao_projeto(contrato, proposta):
    """Cria o projeto no gestão (gestao.projetar_de_proposta, idempotente) e
    provisiona a Central do Cliente. O trigger local trg_gestao_contrato_signed
    nunca dispara porque o DocuSign grava direto no Cloud — este é o elo."""
    r = http("https://gestao.parket.works/api/sync/from-proposta", method="POST",
             headers={"Content-Type": "application/json"},
             body={"simulacao_id": proposta["id"], "contrato_id": contrato["id"]})
    log(f"gestao projeto ok contrato={contrato['id']} projeto={(r or {}).get('projeto_id')}")
    return (r or {}).get("projeto_id")


def ensure_projeto_card(contrato, proposta):
    """Garante card do cliente/obra no dept 'projetos' (Cloud) — é dele que o
    Solicitar do compras-app lê o dropdown "Projeto vinculado". Dedup por
    contrato_id, código de obra ou título igual ao cliente."""
    cliente = (proposta.get("cliente") or "").strip()
    obra = (proposta.get("obra_code") or "").strip().replace("'", "''")
    cl = cliente.replace("'", "''")
    conds = [f"details->>'contrato_id' = '{contrato['id']}'"]
    if obra:
        conds.append(f"obra = '{obra}'")
    if cl:
        conds.append(f"upper(btrim(title)) = upper('{cl}')")
    rows = sql(CLOUD, f"""
        SELECT id FROM kanban_cards
         WHERE dept_id = 'projetos' AND ({' OR '.join(conds)})
         ORDER BY created_at DESC LIMIT 1
    """) or []
    if rows:
        return rows[0]["id"]
    hoje = datetime.now(timezone.utc).astimezone().strftime("%d/%m/%Y")
    row = {
        "dept_id": "projetos",
        "column_id": "contratos-novos",
        "title": cliente or (contrato.get("titulo") or "Contrato assinado"),
        "subtitle": f"Contrato assinado em {hoje}",
        "obra": (proposta.get("obra_code") or "").strip() or None,
        "tags": ["contrato-assinado"],
        "details": {
            "contrato_id": contrato["id"],
            "envelope_id": contrato.get("envelope_id"),
            "proposta_id": proposta.get("id"),
            "origem": "watcher-contrato-assinado",
        },
    }
    created = rest_insert("kanban_cards", row)
    card = created[0] if isinstance(created, list) else created
    log(f"card projeto criado id={card.get('id')} cliente={cliente} obra={row['obra']}")
    return card.get("id")


# ─── Perna 6 (Will 07/08): Core financeiro (core.parket.works) ───────────
# Defaults = mesmos dos lançamentos históricos migrados em 08/06.
CORE_EMPRESA_PISOS = "11111111-1111-1111-1111-111111111111"      # Parket Pisos
CORE_CENTRO_OPERACIONAL = "48836905-4d17-45d5-83b3-915bf8be9da5"  # OPERACIONAL
CORE_CENTRO_COMERCIAL = "a26275fb-c94f-4802-ac2e-802a3f551c73"    # COMERCIAL — comissão vendedor/RT
CORE_PLANO_REC_PISOS = "f4b18ef2-29a5-4184-989c-4706b2ca2eea"     # 9101 REC/PISOS
CORE_PLANO_COMISSAO_VENDEDOR = None  # resolvido runtime (código 3102)
CORE_PLANO_COMISSAO_ARQUITETO = None  # runtime (código 3101)
# Motor comissão/RT/impostos só vale pra contratos assinados a partir daqui —
# obras antigas já foram pagas por fora (Will 17/08). NUNCA gerar retroativo.
CORE_MOTOR_CORTE = "2026-08-18"


def _resolve_plano(codigo):
    """Cache lazy de plano_conta_id por código (evita hardcode de UUID)."""
    r = core_sql(f"SELECT id FROM core.plano_contas WHERE codigo = '{codigo}' LIMIT 1")
    return r[0]["id"] if r else None


def _esc(s):
    return str(s or "").replace("'", "''")


def _parse_parcelas(fp, valor, base_dt):
    """Texto livre de forma_pagamento → [(valor, vencimento, rótulo)].
    Reconhece 'à vista' e 'N% sinal/entrada + saldo 30/60/...'. Sem padrão
    reconhecido → parcela única prevista +30d rotulada 'A combinar' (2º retorno
    False = ajustar manualmente no Core)."""
    fpu = (fp or "").upper()
    if re.search(r"\bVISTA\b", fpu):
        return [(round(valor, 2), base_dt, "À vista")], True
    m = re.search(r"(\d{1,2})\s*%[^%]{0,30}?(SINAL|ENTRADA)", fpu)
    if m:
        entrada = round(valor * int(m.group(1)) / 100.0, 2)
        # só a 1ª linha após SINAL/ENTRADA — obs. abaixo citam itens tipo "9.10"
        resto = fpu.split(m.group(2), 1)[1].split("\n")[0]
        prazos = [int(x) for x in re.findall(r"(?<![\d.,])(\d{2,3})(?!\d)", resto) if 7 <= int(x) <= 240]
        if prazos:
            per = round((valor - entrada) / len(prazos), 2)
            out = [(entrada, base_dt, "Sinal")]
            acc = entrada
            for i, dias in enumerate(prazos):
                v = per if i < len(prazos) - 1 else round(valor - acc, 2)
                out.append((v, base_dt + timedelta(days=dias), f"{dias} dias"))
                acc = round(acc + v, 2)
            return out, True
    return [(round(valor, 2), base_dt + timedelta(days=30), "A combinar")], False


def _pct_faixa(regra_id, volume):
    """% da faixa atingida pelo volume MENSAL do vendedor (% cheio da faixa
    sobre o total do mês, não progressivo — Will 17/08).
    None = nenhuma faixa da regra cobre o volume."""
    fx = core_sql(f"""SELECT percentual FROM core.comissao_faixas
        WHERE ativo AND regra_id = '{regra_id}'
          AND volume_min <= {volume} AND (volume_max IS NULL OR {volume} < volume_max)
        ORDER BY volume_min DESC LIMIT 1""") or []
    pct = float(fx[0]["percentual"] or 0) if fx else 0.0
    return pct if pct > 0 else None


def _obras_fechadas_mes(vendedor_id, comp):
    """Obras do vendedor com contrato CT-* assinado (data_emissao) na
    competência, respeitando o corte do motor (sem retroativo)."""
    return core_sql(f"""
        SELECT DISTINCT o.id, o.valor_venda, o.empresa_id
          FROM core.obras o
          JOIN core.lancamentos l ON l.obra_id = o.id
         WHERE o.vendedor_id = '{vendedor_id}'
           AND COALESCE(o.valor_venda, 0) > 0
           AND l.numero_documento LIKE 'CT-%' AND l.status <> 'cancelado'
           AND l.data_emissao >= '{CORE_MOTOR_CORTE}'
           AND date_trunc('month', l.data_emissao) = '{comp}'""") or []


def _liberar_comissao_fixa(obra, vendedor_id, fixo):
    """Regra tipo 'fixo' (ex. SDR): R$ fixo por fechamento, liberado integral
    quando a obra passa o gate de 50% pago. Dedup por doc COMF-<obra8>."""
    if fixo <= 0:
        return
    obra_id = obra["id"]
    doc = f"COMF-{str(obra_id)[:8]}"
    if core_sql(f"""SELECT 1 FROM core.lancamentos WHERE numero_documento = '{doc}'
                      AND status <> 'cancelado' LIMIT 1"""):
        return
    r = core_sql(f"""SELECT pct_pago, COALESCE(rt_threshold_pct, 50) AS thr, codigo
                       FROM core.obra_resumo WHERE id = '{obra_id}'""") or []
    if not r or float(r[0]["pct_pago"] or 0) <= float(r[0]["thr"]) / 100.0:
        return
    plano = _resolve_plano("3102")  # COMISSAO/VENDEDOR
    if not plano:
        return
    emp = obra.get("empresa_id") or CORE_EMPRESA_PISOS
    hoje = datetime.now(timezone.utc).date()
    core_sql(f"""INSERT INTO core.lancamentos
        (empresa_id, centro_custo_id, obra_id, parceiro_id, plano_conta_id,
         tipo, status, descricao, numero_documento, data_emissao, data_competencia,
         data_vencimento, valor, parcela_atual, parcela_total, observacoes)
        VALUES ('{emp}', '{CORE_CENTRO_COMERCIAL}', '{obra_id}', '{vendedor_id}',
            '{plano}', 'saida', 'previsto',
            'Comissão fixa por fechamento — obra {_esc(r[0].get("codigo") or "")}',
            '{doc}', '{hoje.isoformat()}', '{hoje.isoformat()}',
            '{(hoje + timedelta(days=15)).isoformat()}', {fixo}, 1, 1,
            'Automática — comissão fixa liberada (cliente passou o gate de 50% pago)')""")
    log(f"comissao fixa liberada obra={obra_id} vendedor={vendedor_id} valor={fixo}")


def apurar_comissoes_mes():
    """Apuração MENSAL de comissão por vendedor (regras individuais em
    core.comissao_regras — Will 17/08). Sem retroativo (CORE_MOTOR_CORTE).

    tipo 'faixa': volume = soma dos contratos fechados no mês; % cheio da
      faixa atingida × volume bruto. Grava obras.comissao_pct nas obras da
      competência — a liberação (proporcional ao recebido, gate 50%) fica
      com o motor SQL core.recalcular_liberacoes (trigger + chamada aqui).
    tipo 'fixo': R$ fixo × nº de fechamentos; libera por obra no gate.
    Resumo upsert em core.comissoes (vendedor, competencia)."""
    try:
        regras = core_sql("""SELECT id, vendedor_id, tipo, fixo_valor
                               FROM core.comissao_regras WHERE ativo""") or []
        if not regras:
            return
        comp = datetime.now(timezone.utc).date().replace(day=1).isoformat()
        for rg in regras:
            try:
                obras = _obras_fechadas_mes(rg["vendedor_id"], comp)
                volume = round(sum(float(o["valor_venda"]) for o in obras), 2)
                qtd = len(obras)
                pct, valor = 0.0, 0.0
                if rg["tipo"] == "faixa":
                    pct = _pct_faixa(rg["id"], volume) or 0.0
                    valor = round(volume * pct / 100.0, 2)
                    for o in obras:
                        core_sql(f"""UPDATE core.obras SET comissao_pct = {pct}
                            WHERE id = '{o["id"]}' AND comissao_pct IS DISTINCT FROM {pct}""")
                        core_sql(f"SELECT * FROM core.recalcular_liberacoes('{o['id']}')")
                else:  # fixo
                    fixo = float(rg["fixo_valor"] or 0)
                    valor = round(fixo * qtd, 2)
                    for o in obras:
                        _liberar_comissao_fixa(o, rg["vendedor_id"], fixo)
                if qtd:
                    core_sql(f"""INSERT INTO core.comissoes (vendedor_id, competencia,
                            base_calculo, volume_base, qtd_fechamentos, percentual, valor,
                            status, observacoes)
                        VALUES ('{rg["vendedor_id"]}', '{comp}', {volume}, {volume}, {qtd},
                            {pct}, {valor}, 'a_pagar',
                            'Apuração mensal automática ({rg["tipo"]})')
                        ON CONFLICT (vendedor_id, competencia) WHERE competencia IS NOT NULL
                        DO UPDATE SET base_calculo = EXCLUDED.base_calculo,
                            volume_base = EXCLUDED.volume_base,
                            qtd_fechamentos = EXCLUDED.qtd_fechamentos,
                            percentual = EXCLUDED.percentual,
                            valor = EXCLUDED.valor""")
            except Exception as e:
                log(f"ERRO apuracao vendedor={rg.get('vendedor_id')}: {e}")
    except Exception as e:
        log(f"ERRO apurar_comissoes_mes: {e}")


def _ensure_rt(obra_id):
    """Envelope core.rts pra UI. Base = venda LÍQUIDA de impostos
    (valor_venda × (1 − imposto_pct/100)); % default 10, ajustável por obra.
    Os lançamentos de RT são do motor SQL core.recalcular_liberacoes
    (proporcional ao recebido, gate 50%) — aqui não se cria lançamento."""
    o = core_sql(f"""SELECT arquiteto_id, COALESCE(rt_percentual, 0) AS pct,
                            COALESCE(rt_threshold_pct, 50) AS thr,
                            COALESCE(valor_venda, 0) AS venda,
                            COALESCE(imposto_pct, 28) AS imp
                       FROM core.obras WHERE id = '{obra_id}' LIMIT 1""") or []
    if not o or not o[0].get("arquiteto_id"):
        return
    d = o[0]
    pct, venda = float(d["pct"]), float(d["venda"])
    if pct <= 0 or venda <= 0:
        return
    base = round(venda * (1 - float(d["imp"]) / 100.0), 2)
    core_sql(f"""INSERT INTO core.rts (obra_id, arquiteto_id, base_calculo,
            percentual, threshold_pct, valor_total, status, observacoes)
        VALUES ('{obra_id}', '{d["arquiteto_id"]}', {base}, {pct}, {float(d["thr"])},
            {round(base * pct / 100.0, 2)}, 'aberta',
            'Automática — liberação proporcional ao recebido (gate 50%)')
        ON CONFLICT (obra_id, arquiteto_id) DO UPDATE SET
            base_calculo = EXCLUDED.base_calculo,
            percentual = EXCLUDED.percentual,
            valor_total = EXCLUDED.valor_total""")


def ensure_rts_corte():
    """RT das obras pós-corte com arquiteto: envelope + recálculo de liberação."""
    try:
        rows = core_sql(f"""
            SELECT DISTINCT o.id FROM core.obras o
              JOIN core.lancamentos l ON l.obra_id = o.id
             WHERE o.arquiteto_id IS NOT NULL AND COALESCE(o.rt_percentual, 0) > 0
               AND l.numero_documento LIKE 'CT-%' AND l.status <> 'cancelado'
               AND l.data_emissao >= '{CORE_MOTOR_CORTE}'""") or []
        for r in rows:
            try:
                _ensure_rt(r["id"])
                core_sql(f"SELECT * FROM core.recalcular_liberacoes('{r['id']}')")
            except Exception as e:
                log(f"ERRO ensure_rt obra={r.get('id')}: {e}")
    except Exception as e:
        log(f"ERRO ensure_rts_corte: {e}")


def provisionar_impostos_mes():
    """Impostos: 28% do RECEBIDO no mês, guia ÚNICA por empresa (Will 17/08).
    Upsert em core.impostos (tipo PROVISAO) + lançamento espelho plano 4110;
    valor acompanha o mês enquanto entram baixas. Substituiu as guias
    individuais PIS/COFINS/ISS/... que saíam zeradas."""
    try:
        hoje = datetime.now(timezone.utc).date()
        comp = hoje.replace(day=1)
        prox = (comp + timedelta(days=32)).replace(day=1)
        venc = prox + timedelta(days=19)  # dia 20 do mês seguinte
        rows = core_sql(f"""
            SELECT empresa_id, ROUND(SUM(COALESCE(valor_pago, valor)) * 0.28, 2) AS guia
              FROM core.lancamentos
             WHERE tipo = 'entrada' AND status IN ('pago', 'recebido', 'conciliado')
               AND COALESCE(data_pagamento, data_vencimento) >= '{comp.isoformat()}'
               AND COALESCE(data_pagamento, data_vencimento) < '{prox.isoformat()}'
             GROUP BY empresa_id""") or []
        plano = _resolve_plano("4110")  # IMPOSTOS/GERAL
        for r in rows:
            guia = float(r["guia"] or 0)
            emp = r["empresa_id"]
            if guia <= 0 or not emp:
                continue
            doc = f"IMP-{str(emp)[:8]}-{comp.strftime('%Y%m')}"
            lanc = core_sql(f"""SELECT id, status FROM core.lancamentos
                                 WHERE numero_documento = '{doc}' LIMIT 1""") or []
            lanc_id = None
            if lanc:
                lanc_id = lanc[0]["id"]
                if lanc[0]["status"] == "previsto":
                    core_sql(f"""UPDATE core.lancamentos SET valor = {guia}
                                      WHERE id = '{lanc_id}' AND valor <> {guia}""")
            elif plano:
                lr = core_sql(f"""INSERT INTO core.lancamentos
                    (empresa_id, centro_custo_id, plano_conta_id, tipo, status, descricao,
                     numero_documento, data_emissao, data_competencia, data_vencimento,
                     valor, parcela_atual, parcela_total, observacoes)
                    VALUES ('{emp}', '{CORE_CENTRO_OPERACIONAL}', '{plano}', 'saida', 'previsto',
                        'Impostos — provisão 28% do recebido {comp.strftime('%m/%Y')} (guia única)',
                        '{doc}', '{hoje.isoformat()}', '{comp.isoformat()}', '{venc.isoformat()}',
                        {guia}, 1, 1, 'Automática — provisão mensal de impostos (guia única)')
                    RETURNING id""")
                lanc_id = lr[0]["id"] if lr else None
            core_sql(f"""INSERT INTO core.impostos (empresa_id, tipo, competencia, valor,
                    vencimento, status, lancamento_id, observacoes)
                VALUES ('{emp}', 'PROVISAO', '{comp.isoformat()}', {guia}, '{venc.isoformat()}',
                    'a_pagar', {f"'{lanc_id}'" if lanc_id else 'NULL'},
                    'Guia única — 28% do recebido no mês')
                ON CONFLICT (empresa_id, tipo, competencia) DO UPDATE SET
                    valor = EXCLUDED.valor,
                    lancamento_id = COALESCE(core.impostos.lancamento_id, EXCLUDED.lancamento_id)
                WHERE core.impostos.status = 'a_pagar'""")
    except Exception as e:
        log(f"ERRO provisionar_impostos_mes: {e}")


def motor_core_mensal():
    """Motor financeiro do Core (roda todo ciclo, idempotente):
    comissões mensais por vendedor + RT dos contratos pós-corte + provisão
    de impostos. Nada retroativo — ver CORE_MOTOR_CORTE."""
    apurar_comissoes_mes()
    ensure_rts_corte()
    provisionar_impostos_mes()


def ensure_core_financeiro(contrato, proposta):
    """Contrato assinado → espelho no schema core (core.parket.works):
    cliente em core.parceiros, obra em core.obras, parcelas de contas a
    receber em core.lancamentos e comissão do vendedor (se comissao_padrao).
    Idempotente por lancamentos.numero_documento = 'CT-<contrato_id>'.
    Escreve no Supabase CLOUD (schema core) — o core financeiro vivo mora
    lá desde 07/08 (obras/CT-/CI-). O core do parket-pg-local está VAZIO;
    escrever lá = dado órfão (bug corrigido 18/08)."""
    doc = f"CT-{contrato['id']}"
    if core_sql(f"SELECT 1 FROM core.lancamentos WHERE numero_documento = '{doc}' LIMIT 1"):
        return
    rows = sql(CLOUD, f"""
        SELECT sp.cliente, sp.cnpj_cpf, sp.numero, sp.vendedor, sp.endereco,
               COALESCE(NULLIF(btrim(sp.forma_pagamento),''),
                        sp.meta->'contrato_cliente'->>'forma_pagamento','') AS fp,
               COALESCE(cd.completed_at, cd.updated_at) AS assinado_em,
               sp.desconto_modo, sp.desconto_valor, sp.desconto_perc, sp.frete_valor,
               (SELECT COALESCE(SUM(si.valor),0) FROM simulacao_itens si
                 WHERE si.simulacao_id = sp.id) AS valor_itens
          FROM simulacao_projetos sp, contratos_docusign cd
         WHERE sp.id = '{proposta['id']}' AND cd.id = '{contrato['id']}'
    """) or []
    if not rows:
        return
    d = rows[0]
    valor = float(d["valor_itens"] or 0)
    if (d.get("desconto_modo") or "perc") == "valor":
        valor -= float(d.get("desconto_valor") or 0)
    else:
        valor *= 1 - float(d.get("desconto_perc") or 0) / 100.0
    valor = round(valor + float(d.get("frete_valor") or 0), 2)
    if valor <= 0:
        log(f"core-fin contrato={contrato['id']}: valor <= 0 — pulando")
        return
    cliente = (d.get("cliente") or "Cliente").strip()
    numero = (d.get("numero") or "").strip()
    fp = (d.get("fp") or "").strip()
    cpf = re.sub(r"\D", "", d.get("cnpj_cpf") or "")
    assinado = parse_ts(d["assinado_em"])
    # Sem retroativo (Will 17/08): plataforma zerada — só entra no Core
    # contrato assinado a partir do corte. Antigos foram pagos por fora.
    if assinado.date().isoformat() < CORE_MOTOR_CORTE:
        log(f"core-fin contrato={contrato['id']}: assinado {assinado.date()} < corte {CORE_MOTOR_CORTE} — pulando")
        return

    # 1) cliente em core.parceiros
    cond = f"documento = '{cpf}'" if cpf else f"upper(btrim(nome)) = upper('{_esc(cliente)}')"
    pr = core_sql(f"SELECT id FROM core.parceiros WHERE {cond} ORDER BY created_at LIMIT 1") or []
    if pr:
        cliente_id = pr[0]["id"]
        core_sql(f"UPDATE core.parceiros SET is_cliente = true WHERE id = '{cliente_id}' AND NOT is_cliente")
    else:
        tipo = "PJ" if len(cpf) == 14 else "PF"
        pr = core_sql(f"""INSERT INTO core.parceiros (tipo_pessoa, documento, nome, is_cliente, ativo)
            VALUES ('{tipo}', {("'" + cpf + "'") if cpf else 'NULL'}, '{_esc(cliente)}', true, true)
            RETURNING id""")
        cliente_id = pr[0]["id"]

    # 2) vendedor (match exato ou primeiro+último nome)
    vend = (d.get("vendedor") or "").strip()
    vendedor_id = None
    if vend and vend.lower() not in ("a definir", "administrador"):
        toks = vend.split()
        vr = core_sql(f"""SELECT id FROM core.parceiros
            WHERE is_vendedor AND (upper(btrim(nome)) = upper('{_esc(vend)}')
               OR (nome ILIKE '{_esc(toks[0])}%' AND nome ILIKE '%{_esc(toks[-1])}'))
            ORDER BY created_at LIMIT 1""") or []
        if vr:
            vendedor_id = vr[0]["id"]

    # 3) obra em core.obras
    ob = core_sql(f"""SELECT id FROM core.obras
        WHERE {f"codigo = '{_esc(numero)}' OR " if numero else ""}upper(btrim(nome)) = upper('{_esc(cliente)}')
        ORDER BY created_at DESC LIMIT 1""") or []
    if ob:
        obra_id = ob[0]["id"]
        core_sql(f"""UPDATE core.obras SET valor_venda = {valor}, cliente_id = '{cliente_id}',
            {f"vendedor_id = '{vendedor_id}'," if vendedor_id else ""}
            numero_pedido = COALESCE(numero_pedido, '{_esc(numero)}'),
            condicoes_pagamento = COALESCE(NULLIF(condicoes_pagamento,''), '{_esc(fp)}'),
            status = COALESCE(status, 'contratada')
            WHERE id = '{obra_id}'""")
    else:
        ob = core_sql(f"""INSERT INTO core.obras (empresa_id, centro_custo_id, codigo, nome,
                cliente_id, {"vendedor_id, " if vendedor_id else ""}endereco, data_inicio, status,
                valor_venda, numero_pedido, condicoes_pagamento, observacoes)
            VALUES ('{CORE_EMPRESA_PISOS}', '{CORE_CENTRO_OPERACIONAL}', '{_esc(numero)}', '{_esc(cliente)}',
                '{cliente_id}', {f"'{vendedor_id}', " if vendedor_id else ""}'{_esc(d.get('endereco') or '')}',
                '{assinado.date().isoformat()}', 'contratada', {valor}, '{_esc(numero)}', '{_esc(fp)}',
                'Criada automaticamente na assinatura do contrato (proposta {_esc(numero)})')
            RETURNING id""")
        obra_id = ob[0]["id"]

    # 4) parcelas de contas a receber
    parcelas, reconhecida = _parse_parcelas(fp, valor, assinado)
    obs = f"Contrato assinado {assinado.date().strftime('%d/%m/%Y')} — proposta {numero}."
    if not reconhecida:
        obs += f" Forma de pagamento não estruturada ('{fp or 'não informada'}') — AJUSTAR PARCELAS."
    vals = []
    for i, (v, venc, rotulo) in enumerate(parcelas, 1):
        desc = f"Contrato {numero} — {cliente} — Parcela {i}/{len(parcelas)} ({rotulo})"
        vals.append(
            f"('{CORE_EMPRESA_PISOS}', '{CORE_CENTRO_OPERACIONAL}', '{obra_id}', '{cliente_id}', "
            f"'{CORE_PLANO_REC_PISOS}', 'entrada', 'previsto', '{_esc(desc)}', '{doc}', "
            f"'{assinado.date().isoformat()}', '{assinado.date().isoformat()}', '{venc.date().isoformat()}', "
            f"{v}, '{_esc(fp[:180])}', {i}, {len(parcelas)}, '{_esc(obs)}')")
    core_sql("INSERT INTO core.lancamentos (empresa_id, centro_custo_id, obra_id, parceiro_id, "
               "plano_conta_id, tipo, status, descricao, numero_documento, data_emissao, "
               "data_competencia, data_vencimento, valor, forma_pagamento, parcela_atual, "
               "parcela_total, observacoes) VALUES " + ", ".join(vals))

    # 5) Comissão/RT: apuração MENSAL por vendedor via motor_core_mensal()
    #    (regras individuais em core.comissao_regras; obras.comissao_pct é
    #    escrita lá). Liberação proporcional + gate 50% = motor SQL
    #    core.recalcular_liberacoes (trigger em lancamentos). RT idem.
    log(f"core-fin ok contrato={contrato['id']} obra={obra_id} valor={valor} parcelas={len(parcelas)} fp_ok={reconhecida}")


# ============================================================================
# PERNA 7 — Termo de contratação → baixa financeira no Core
# ----------------------------------------------------------------------------
# PKT-TERMO-CORE-20260827. O termo (termo-v2.html) grava o pagamento do
# cliente em simulacao_projetos.meta.termo do parket-pg-local (o front escreve
# via api.parket.works; o Cloud NÃO recebe meta.termo — verificado 27/08).
# Formatos possíveis de meta.termo.pagamento:
#   pix confirmado .... {modo:'pix', txid, valor, entrada_pct, em, plano, simulado}
#   boleto emitido .... {modo:'boleto', boleto_id, linha_digitavel, vencimento,
#                        valor, entrada_pct, em, plano, simulado}
#   boleto pago (pág. aberta) SOBRESCREVE: {modo:'boleto', boleto_id, pago:true,
#                        valor, entrada_pct, em, simulado}  ← SEM plano!
# meta.termo.compensacao = webhook de baixa do Itaú (parket-docusign) — durável,
# cobre o caso do boleto pago com a página do cliente já fechada.
# O que a perna faz (idempotente via meta.termo.core_sync, IRMÃO de pagamento —
# a sobrescrita do front preserva irmãos):
#   0) PRÉ-CONTRATO (Will 28/08): termo aceito mas contrato ainda não assinado
#      → cria as parcelas do plano em core.lancamentos com numero_documento
#      TERMO-<sim_id>. obra_id: resolvido na hora (card → obras.space_id, senão
#      resolver por nome do cliente — match ÚNICO); clientes com obra já
#      cadastrada (import/planilha) veem o recebível na tela /obras/<id> desde
#      o aceite. Ambíguo/inexistente fica NULL e a perna 8 re-adota depois.
#      Assim o financeiro já acompanha o recebível em /recebimentos desde o
#      aceite. Quando o CT- nasce, os TERMO- são cancelados ("convertidos") e
#      o fluxo CT- abaixo assume — o valor nunca aparece em dobro.
#   1) realinha as parcelas CT- ao plano negociado do termo (só se TODAS ainda
#      'previsto'; cancela as antigas e insere as novas — trilha preservada)
#   2) boleto emitido → anota linha digitável/vencimento na 1ª parcela prevista
#   3) pagamento confirmado (pix, boleto pago ou compensação) → baixa da 1ª
#      parcela: status='recebido' + data_pagamento + valor_pago (o trigger
#      core.recalcular_liberacoes dispara comissão/RT/impostos sozinho)
# Pagamento SIMULADO nunca baixa (dinheiro não entrou) — as parcelas ficam
# 'previsto' com observação SIMULADO e só o core_sync é marcado.
# ============================================================================

def _termo_ts(s):
    """Timestamps do termo vêm do JS toISOString() com sufixo 'Z', que o
    fromisoformat do 3.10 (dentro do parse_ts) rejeita — normaliza antes."""
    return parse_ts(str(s).replace("Z", "+00:00"))


def _termo_core_sync_wb(sim_id, marca):
    """Write-back do marcador em meta.termo.core_sync no parket-pg-local
    (mesma base onde o front grava meta.termo.pagamento)."""
    j = json.dumps(marca, ensure_ascii=False).replace("'", "''")
    local_pg_dml(f"""UPDATE simulacao_projetos
        SET meta = jsonb_set(meta, '{{termo,core_sync}}', '{j}'::jsonb, true)
        WHERE id = '{sim_id}'""")


def _termo_achar_doc(sp):
    """Sim do termo → numero_documento CT- no core.lancamentos.
    Inverso do vínculo da perna 6: o contrato vive no card FINANCEIRO cujo
    details aponta pra sim (simulacao_id / comercial_card_id / card_comercial_id)
    ou cujo id é o próprio sp.card_id. Devolve (doc, contrato_id) ou (None, None)."""
    cards = [c for c in (sp.get("card_id"), sp.get("card_comercial_id")) if c]
    in_cards = ", ".join(f"'{c}'" for c in cards) or "NULL"
    cds = sql(CLOUD, f"""
        SELECT cd.id FROM contratos_docusign cd
         WHERE cd.status = 'assinado' AND cd.card_id IN (
               SELECT id FROM kanban_cards
                WHERE id IN ({in_cards})
                   OR details->>'simulacao_id' = '{sp['id']}'
                   OR NULLIF(details->>'comercial_card_id','') IN ({in_cards})
                   OR NULLIF(details->>'card_comercial_id','') IN ({in_cards}))
         ORDER BY cd.updated_at DESC
    """) or []
    for cd in cds:
        doc = f"CT-{cd['id']}"
        if core_sql(f"SELECT 1 FROM core.lancamentos WHERE numero_documento = '{doc}' LIMIT 1"):
            return doc, cd["id"]
    return None, None


def _termo_realinhar_parcelas(doc, sp, pag, plano):
    """Substitui as parcelas CT- (parse textual da perna 6) pelo plano que o
    cliente ACEITOU no termo (bent/bdias). Só mexe se todas ainda 'previsto'.
    Retorna True se (re)alinhado — inclusive quando já batia sem mudar nada."""
    rows = core_sql(f"""SELECT id, status, valor, data_vencimento, empresa_id,
               centro_custo_id, obra_id, parceiro_id, plano_conta_id,
               data_emissao, data_competencia
          FROM core.lancamentos
         WHERE numero_documento = '{doc}' AND status <> 'cancelado'
         ORDER BY parcela_atual, data_vencimento""") or []
    if not rows:
        return False
    if any(r["status"] != "previsto" for r in rows):
        log(f"termo-core {doc}: parcela já baixada — realinhamento pulado")
        return False
    parcelas = plano.get("parcelas") or []
    if not parcelas:
        return False
    base = _termo_ts(pag.get("em") or datetime.now(timezone.utc).isoformat())
    alvo = [(round(float(p.get("valor") or 0), 2),
             (base + timedelta(days=int(p.get("dias") or 0))).date().isoformat(),
             str(p.get("papel") or "")) for p in parcelas]
    # Já bate (mesma qtd, valores e vencimentos)? Marca alinhado sem tocar.
    if len(alvo) == len(rows) and all(
            abs(a[0] - float(r["valor"] or 0)) <= 0.05 and a[1] == str(r["data_vencimento"])
            for a, r in zip(alvo, rows)):
        return True
    r0 = rows[0]
    numero = (sp.get("numero") or "").strip()
    cliente = (sp.get("cliente") or "Cliente").strip()
    pct = pag.get("entrada_pct")
    obs = (f"Parcelas realinhadas ao plano do termo aceito em {base.date().strftime('%d/%m/%Y')}"
           f"{f' (entrada {pct}%)' if pct is not None else ''} — proposta {numero}.")
    ids = ", ".join(f"'{r['id']}'" for r in rows)
    core_sql(f"""UPDATE core.lancamentos
        SET status = 'cancelado',
            observacoes = COALESCE(observacoes,'') || ' [Substituída pelo plano do termo em {base.date().isoformat()}]'
        WHERE id IN ({ids})""")
    vals = []
    for i, (v, venc, papel) in enumerate(alvo, 1):
        desc = f"Contrato {numero} — {cliente} — Parcela {i}/{len(alvo)} ({papel or ('Entrada' if i == 1 else 'Saldo')})"
        forma = "PIX" if (i == 1 and pag.get("modo") == "pix") else "BOLETO"
        vals.append(
            f"('{r0['empresa_id']}', '{r0['centro_custo_id']}', '{r0['obra_id']}', '{r0['parceiro_id']}', "
            f"'{r0['plano_conta_id']}', 'entrada', 'previsto', '{_esc(desc)}', '{doc}', "
            f"'{r0['data_emissao']}', '{r0['data_competencia']}', '{venc}', "
            f"{v}, '{forma}', {i}, {len(alvo)}, '{_esc(obs)}')")
    core_sql("INSERT INTO core.lancamentos (empresa_id, centro_custo_id, obra_id, parceiro_id, "
             "plano_conta_id, tipo, status, descricao, numero_documento, data_emissao, "
             "data_competencia, data_vencimento, valor, forma_pagamento, parcela_atual, "
             "parcela_total, observacoes) VALUES " + ", ".join(vals))
    log(f"termo-core {doc}: {len(rows)} parcela(s) do parse → {len(alvo)} do plano do termo")
    return True


def _termo_pre_contrato(sp, termo, pag, comp, sync, pago_em, forma, simulado):
    """Estágio 0 da perna 7: termo aceito SEM contrato CT- no Core ainda.
    Cria/atualiza os lançamentos TERMO-<sim_id> pro financeiro acompanhar o
    recebível em /recebimentos desde o aceite. obra_id é resolvido na hora
    (card → obras.space_id, senão nome do cliente com match ÚNICO): normalmente
    a obra ainda não existe (nasce na assinatura, perna 6) e fica NULL, mas em
    clientes com obra já cadastrada o recebível aparece direto em /obras/<id>.
    Espelha as 3 ações do fluxo CT- com marcadores pre_* no
    core_sync: criação do plano, anotação de boleto e baixa (real; SIMULADO
    fica 'previsto' com aviso). Muta `sync` in-place."""
    doc = f"TERMO-{sp['id']}"
    plano = pag.get("plano") or {}
    parcelas = plano.get("parcelas") or []
    numero = (sp.get("numero") or "").strip()
    cliente = (sp.get("cliente") or "Cliente").strip()

    # 0.1) criação das parcelas do plano (uma vez)
    if parcelas and not sync.get("pre_plano_alinhado"):
        if core_sql(f"SELECT 1 FROM core.lancamentos WHERE numero_documento = '{doc}' LIMIT 1"):
            sync["pre_plano_alinhado"] = True  # já criado em ciclo anterior (write-back falhou?)
            sync["pre_doc"] = doc
        else:
            # parceiro: MESMO dedup da perna 6 (documento > nome) pra assinatura
            # reusar o cadastro em vez de duplicar. CPF vem do próprio termo.
            dados = termo.get("dados") or {}
            cpf = re.sub(r"\D", "", dados.get("cpf_cnpj") or "")
            cond = f"documento = '{cpf}'" if cpf else f"upper(btrim(nome)) = upper('{_esc(cliente)}')"
            pr = core_sql(f"SELECT id FROM core.parceiros WHERE {cond} ORDER BY created_at LIMIT 1") or []
            if pr:
                cliente_id = pr[0]["id"]
                core_sql(f"UPDATE core.parceiros SET is_cliente = true WHERE id = '{cliente_id}' AND NOT is_cliente")
            else:
                tipo = "PJ" if len(cpf) == 14 else "PF"
                pr = core_sql(f"""INSERT INTO core.parceiros (tipo_pessoa, documento, nome, is_cliente, ativo)
                    VALUES ('{tipo}', {("'" + cpf + "'") if cpf else 'NULL'}, '{_esc(cliente)}', true, true)
                    RETURNING id""")
                cliente_id = pr[0]["id"]
            # obra: resolve AGORA em vez do NULL fixo de antes (28/08). Sem isso
            # a tela /obras/<id> ficava vazia até a assinatura mesmo com a obra
            # já cadastrada (caso Matheus Costantini). Ordem: card da sim →
            # core.obras.space_id (precisão máxima), senão resolver por nome do
            # cliente (match ÚNICO; ambíguo = NULL — melhor órfão que obra errada,
            # a perna 8 re-adota quando o vínculo aparecer).
            obra_id = None
            for cid in (sp.get("card_id"), sp.get("card_comercial_id")):
                if cid:
                    r = core_sql(f"SELECT id FROM core.obras WHERE space_id = '{cid}' LIMIT 1") or []
                    if r:
                        obra_id = r[0]["id"]
                        break
            if not obra_id:
                r = core_sql("SELECT core.resolver_obra_por_projeto_texto("
                             f"'{_esc(cliente)}') AS id") or []
                obra_id = (r[0] or {}).get("id") if r else None
            obra_sql = f"'{obra_id}'" if obra_id else "NULL"
            base = _termo_ts(pag.get("em") or datetime.now(timezone.utc).isoformat())
            emissao = base.date().isoformat()
            pct = pag.get("entrada_pct")
            obs = (f"Termo de contratação aceito em {base.date().strftime('%d/%m/%Y')}"
                   f"{f' (entrada {pct}%)' if pct is not None else ''} — proposta {numero}."
                   " Aguardando assinatura do contrato (vira CT- e este TERMO- é convertido).")
            if simulado:
                obs += " Pagamento SIMULADO (sandbox Itaú) — NÃO baixar até dinheiro real entrar."
            vals = []
            for i, p in enumerate(parcelas, 1):
                v = round(float(p.get("valor") or 0), 2)
                venc = (base + timedelta(days=int(p.get("dias") or 0))).date().isoformat()
                papel = str(p.get("papel") or "") or ("Entrada" if i == 1 else "Saldo")
                desc = f"Termo {numero} — {cliente} — Parcela {i}/{len(parcelas)} ({papel})"
                fpag = "PIX" if (i == 1 and pag.get("modo") == "pix") else "BOLETO"
                vals.append(
                    f"('{CORE_EMPRESA_PISOS}', '{CORE_CENTRO_OPERACIONAL}', {obra_sql}, '{cliente_id}', "
                    f"'{CORE_PLANO_REC_PISOS}', 'entrada', 'previsto', '{_esc(desc)}', '{doc}', "
                    f"'{emissao}', '{emissao}', '{venc}', "
                    f"{v}, '{fpag}', {i}, {len(parcelas)}, '{_esc(obs)}')")
            core_sql("INSERT INTO core.lancamentos (empresa_id, centro_custo_id, obra_id, parceiro_id, "
                     "plano_conta_id, tipo, status, descricao, numero_documento, data_emissao, "
                     "data_competencia, data_vencimento, valor, forma_pagamento, parcela_atual, "
                     "parcela_total, observacoes) VALUES " + ", ".join(vals))
            sync["pre_plano_alinhado"] = True
            sync["pre_doc"] = doc
            log(f"termo-core {doc}: {len(parcelas)} parcela(s) do plano criadas PRÉ-CONTRATO "
                f"(proposta {numero}{' — SIMULADO' if simulado else ''})")

    # sem TERMO- criado (ex.: boleto pago sobrescreveu meta sem plano e nada
    # foi criado antes) não há onde anotar/baixar — o CT- assume na assinatura.
    if not sync.get("pre_doc"):
        return

    # 0.2) boleto emitido → anotar linha digitável na 1ª parcela prevista
    if (pag.get("modo") == "boleto" and pag.get("linha_digitavel")
            and sync.get("pre_boleto_anotado") != pag.get("boleto_id")):
        nota = (f"Boleto {pag.get('boleto_id')} emitido pelo termo — linha "
                f"{pag.get('linha_digitavel')} venc. {pag.get('vencimento')}.")
        core_sql(f"""UPDATE core.lancamentos
            SET forma_pagamento = 'BOLETO',
                {f"data_vencimento = '{pag['vencimento']}'," if pag.get('vencimento') else ''}
                observacoes = COALESCE(observacoes,'') || ' {_esc(nota)}'
            WHERE id = (SELECT id FROM core.lancamentos
                         WHERE numero_documento = '{doc}' AND status = 'previsto'
                         ORDER BY parcela_atual, data_vencimento LIMIT 1)""")
        sync["pre_boleto_anotado"] = pag.get("boleto_id")
        log(f"termo-core {doc}: boleto {pag.get('boleto_id')} anotado na parcela 1 (pré-contrato)")

    # 0.3) baixa do recebimento real (SIMULADO nunca baixa — só marca visto)
    if pago_em and simulado and not sync.get("pre_simulado_visto"):
        sync["pre_simulado_visto"] = True
        log(f"termo-core {doc}: pagamento SIMULADO ({forma}) — parcelas ficam previstas, sem baixa")
    elif pago_em and not simulado and not sync.get("pre_baixa_em"):
        dt_pago = _termo_ts(pago_em).date().isoformat()
        valor_pago = float(pag.get("valor") or 0) or None
        r = core_sql(f"""UPDATE core.lancamentos
            SET status = 'recebido', data_pagamento = '{dt_pago}',
                valor_pago = {valor_pago if valor_pago else 'valor'},
                forma_pagamento = '{forma}',
                observacoes = COALESCE(observacoes,'') ||
                    ' Baixa automática via termo ({forma}) em {dt_pago} (pré-contrato).'
            WHERE id = (SELECT id FROM core.lancamentos
                         WHERE numero_documento = '{doc}' AND status = 'previsto'
                         ORDER BY parcela_atual, data_vencimento LIMIT 1)
            RETURNING id, parcela_atual""") or []
        if r:
            sync["pre_baixa_em"] = dt_pago
            sync["pre_baixa_lancamento_id"] = r[0]["id"]
            log(f"termo-core {doc}: parcela {r[0].get('parcela_atual')} RECEBIDA pré-contrato ({forma} {valor_pago or ''})")


def sync_termo_pagamentos():
    """Perna 7: pagamentos do termo (meta.termo do parket-pg-local) →
    core.lancamentos no Cloud. Roda todo ciclo, idempotente por core_sync."""
    sims = local_pg("""SELECT id, numero, cliente, card_id, card_comercial_id,
               meta->'termo' AS termo
          FROM simulacao_projetos
         WHERE meta->'termo' ? 'pagamento'""") or []
    for sp in sims:
        try:
            termo = sp.get("termo") or {}
            pag = termo.get("pagamento") or {}
            comp = termo.get("compensacao") or {}
            sync = dict(termo.get("core_sync") or {})
            antes = dict(sync)

            # Evento de pagamento confirmado? (pix fecha o fluxo já pago;
            # boleto só com pago:true da página ou compensação do webhook)
            modo = pag.get("modo") or ""
            pago_em = None
            forma = None
            if modo == "pix":
                pago_em, forma = pag.get("em"), "PIX"
            elif modo == "boleto" and pag.get("pago"):
                pago_em, forma = pag.get("em"), "BOLETO"
            if comp and not pago_em:
                pago_em, forma = comp.get("em"), ("PIX" if comp.get("modo") == "pix" else "BOLETO")
            simulado = bool(pag.get("simulado") or (comp and comp.get("simulado")))

            precisa = ((pag.get("plano") and not sync.get("plano_alinhado"))
                       or (modo == "boleto" and pag.get("linha_digitavel")
                           and sync.get("boleto_anotado") != pag.get("boleto_id"))
                       or (pago_em and not simulado and not sync.get("baixa_em"))
                       or (pago_em and simulado and not sync.get("simulado_visto")))
            if not precisa:
                continue

            doc, contrato_id = _termo_achar_doc(sp)
            if not doc:
                # Contrato ainda não assinado/processado: estágio 0 espelha o
                # plano do termo como TERMO-<sim_id> pro financeiro acompanhar.
                # O gate `precisa` continua aberto (plano_alinhado/baixa_em são
                # do CT-), então seguimos sondando a assinatura a cada ciclo.
                _termo_pre_contrato(sp, termo, pag, comp, sync, pago_em, forma, simulado)
                if sync != antes:
                    sync["em"] = datetime.now(timezone.utc).isoformat()
                    _termo_core_sync_wb(sp["id"], sync)
                continue

            # 0→1) contrato assinado: cancela os TERMO- pré-contrato (o CT-
            # assume o recebível — realinhamento + baixa abaixo recriam o
            # estado; nada fica em dobro).
            if sync.get("pre_doc") and not sync.get("pre_convertido"):
                core_sql(f"""UPDATE core.lancamentos
                    SET status = 'cancelado',
                        observacoes = COALESCE(observacoes,'') || ' [Convertido no contrato {doc} na assinatura]'
                    WHERE numero_documento = '{sync["pre_doc"]}' AND status <> 'cancelado'""")
                sync["pre_convertido"] = True
                log(f"termo-core {sync['pre_doc']}: convertido no {doc} (assinatura)")

            # 1) realinhamento ao plano negociado
            if pag.get("plano") and not sync.get("plano_alinhado"):
                if _termo_realinhar_parcelas(doc, sp, pag, pag["plano"]):
                    sync["plano_alinhado"] = True

            # 2) boleto emitido → anotar na 1ª parcela prevista
            if (modo == "boleto" and pag.get("linha_digitavel")
                    and sync.get("boleto_anotado") != pag.get("boleto_id")):
                nota = (f"Boleto {pag.get('boleto_id')} emitido pelo termo — linha "
                        f"{pag.get('linha_digitavel')} venc. {pag.get('vencimento')}.")
                core_sql(f"""UPDATE core.lancamentos
                    SET forma_pagamento = 'BOLETO',
                        {f"data_vencimento = '{pag['vencimento']}'," if pag.get('vencimento') else ''}
                        observacoes = COALESCE(observacoes,'') || ' {_esc(nota)}'
                    WHERE id = (SELECT id FROM core.lancamentos
                                 WHERE numero_documento = '{doc}' AND status = 'previsto'
                                 ORDER BY parcela_atual, data_vencimento LIMIT 1)""")
                sync["boleto_anotado"] = pag.get("boleto_id")
                log(f"termo-core {doc}: boleto {pag.get('boleto_id')} anotado na parcela 1")

            # 3) baixa do recebimento (nunca em simulado — dinheiro não entrou)
            if pago_em and simulado and not sync.get("simulado_visto"):
                sync["simulado_visto"] = True
                log(f"termo-core {doc}: pagamento SIMULADO ({forma}) — sem baixa")
            elif pago_em and not simulado and not sync.get("baixa_em"):
                dt_pago = _termo_ts(pago_em).date().isoformat()
                valor_pago = float(pag.get("valor") or 0) or None
                r = core_sql(f"""UPDATE core.lancamentos
                    SET status = 'recebido', data_pagamento = '{dt_pago}',
                        valor_pago = {valor_pago if valor_pago else 'valor'},
                        forma_pagamento = '{forma}',
                        observacoes = COALESCE(observacoes,'') ||
                            ' Baixa automática via termo ({forma}) em {dt_pago}.'
                    WHERE id = (SELECT id FROM core.lancamentos
                                 WHERE numero_documento = '{doc}' AND status = 'previsto'
                                 ORDER BY parcela_atual, data_vencimento LIMIT 1)
                    RETURNING id, parcela_atual""") or []
                if r:
                    sync["baixa_em"] = dt_pago
                    sync["baixa_lancamento_id"] = r[0]["id"]
                    log(f"termo-core {doc}: parcela {r[0].get('parcela_atual')} RECEBIDA "
                        f"({forma} {valor_pago or ''}) — trigger recalcula liberações")
                else:
                    log(f"termo-core {doc}: nenhuma parcela 'previsto' pra baixar — conferir no Core")

            if sync != antes:
                sync["doc"] = doc
                sync["contrato_id"] = contrato_id
                sync["em"] = datetime.now(timezone.utc).isoformat()
                _termo_core_sync_wb(sp["id"], sync)
        except Exception as e:
            log(f"ERRO termo-core sim={sp.get('id')}: {e}")


def sync_adotar_orfaos():
    """Perna 8 (PKT-CORE-ORFAOS-20260828): re-adoção de lançamentos órfãos.
    Lançamento criado ANTES da obra existir (NF/frete chegam meses antes da
    assinatura) ou antes do vínculo ser feito (frete vinculado depois na UI da
    Expedição) ficava com obra_id NULL PRA SEMPRE — e a tela /obras/<id> filtra
    por obra_id, então a obra parecia sem movimento. Roda todo ciclo, só faz
    UPDATE quando o vínculo é DETERMINÍSTICO (nunca chute):
      FR-:    expedicao_fretes.obra_id via FKs lancamento_ad1/ad2/saldo
              (vínculo nasce na UI da Expedição — task 1890);
      NF-:    resolver_obra_por_projeto_texto no projeto da nota/conta
              (mesma regra do trigger da migração 024 — só match ÚNICO);
      TERMO-: resolver por nome do parceiro (cliente) — match ÚNICO.
    Ambíguo (ex.: 3 obras homônimas do mesmo pedido) permanece NULL: o certo
    é resolver a duplicidade de obras, não sortear uma."""
    adotados = {}
    r = core_sql("""UPDATE core.lancamentos l SET obra_id = ef.obra_id
        FROM public.expedicao_fretes ef
        WHERE l.obra_id IS NULL AND ef.obra_id IS NOT NULL
          AND l.id IN (ef.lancamento_ad1_id, ef.lancamento_ad2_id, ef.lancamento_saldo_id)
        RETURNING l.id""") or []
    adotados["FR"] = len(r)
    r = core_sql("""UPDATE core.lancamentos l
        SET obra_id = core.resolver_obra_por_projeto_texto(COALESCE(cn.projeto, ccp.projeto))
        FROM public.compras_contas_pagar ccp
        LEFT JOIN public.compras_notas cn ON cn.id = ccp.nota_id
        WHERE ccp.lancamento_id = l.id AND l.obra_id IS NULL
          AND core.resolver_obra_por_projeto_texto(COALESCE(cn.projeto, ccp.projeto)) IS NOT NULL
        RETURNING l.id""") or []
    adotados["NF"] = len(r)
    r = core_sql("""UPDATE core.lancamentos l
        SET obra_id = core.resolver_obra_por_projeto_texto(p.nome)
        FROM core.parceiros p
        WHERE p.id = l.parceiro_id AND l.obra_id IS NULL
          AND l.numero_documento LIKE 'TERMO-%'
          AND core.resolver_obra_por_projeto_texto(p.nome) IS NOT NULL
        RETURNING l.id""") or []
    adotados["TERMO"] = len(r)
    if any(adotados.values()):
        log(f"orfaos-core: adotados {adotados}")


def criar_card(dept, titulo_tipo, contrato, proposta, materiais, projeto_card_id=None, produtos=None, extra_details=None):
    hoje = datetime.now(timezone.utc).astimezone().strftime("%d/%m/%Y")
    cliente = proposta.get("cliente") or "Cliente"
    numero = proposta.get("numero") or ""
    solicitante = f"Automático · Contrato assinado ({cliente})"
    row = {
        "dept_id": dept,
        "column_id": "entrada",
        "title": f"{titulo_tipo} — {cliente}" + (f" · {numero}" if numero else ""),
        "subtitle": f"Contrato assinado em {hoje}",
        "obra": proposta.get("obra_code"),
        "tags": ["contrato-assinado"],
        "checklist_done": 0,
        "checklist_total": sum(len(c["items"]) for c in CHECKLISTS_SEED),
        "details": {
            "solicitante": solicitante,
            "setor": "Financeiro / Contratos",
            "materiais": materiais,
            "checklists": CHECKLISTS_SEED,
            "obs": f"Card gerado automaticamente na assinatura do contrato \"{contrato.get('titulo') or ''}\". "
                   f"Proposta {numero} — {cliente}. Lista de insumos ({titulo_tipo.lower()}) da proposta.",
            "contrato_id": contrato["id"],
            "envelope_id": contrato.get("envelope_id"),
            "proposta_id": proposta.get("id"),
            "valoria_simulacao_id": proposta.get("valoria_simulacao_id"),
            # nº da proposta = core.obras.codigo — resolver_obra_do_card usa
            # pra ligar o custo aprovado à obra certa no Core.
            "obra_codigo": str(numero) if numero else None,
            "origem": "watcher-contrato-assinado",
        },
    }
    if produtos:
        row["details"]["produtos_vendidos"] = produtos
    if extra_details:
        row["details"].update(extra_details)
    if projeto_card_id:
        row["parent_card_id"] = projeto_card_id
        obra = (proposta.get("obra_code") or "").strip()
        row["details"]["projeto_nome"] = f"{obra + ' — ' if obra else ''}{cliente}"
    created = rest_insert("kanban_cards", row)
    card = created[0] if isinstance(created, list) else created
    log(f"card criado dept={dept} id={card.get('id')} materiais={len(materiais)} contrato={contrato['id']}")
    if NOTIFY:
        try:
            http(NOTIFY_URL, method="POST",
                 headers={"Content-Type": "application/json"},
                 body={
                     "titulo": row["title"],
                     "solicitante": solicitante,
                     "itens": [m["tipo"] for m in materiais][:20],
                     "prazo": None,
                     "projeto_vinculado": proposta.get("obra_code") or numero,
                     "card_id": card.get("id"),
                 }, timeout=10)
        except Exception as e:
            log(f"notify falhou (ok, best-effort): {e}")
    return card


def poll_amostras(st):
    desde = (parse_ts(st["last_amostra_ts"]) - timedelta(minutes=10)).isoformat()
    amostras = local_pg(f"""
        SELECT id, card_id, solicitado_por_nome, produto, acabamento, cor_referencia,
               quantidade_pecas, motivo, obs, endereco_entrega, cep,
               aprovado_por, aprovado_at
          FROM amostras_solicitacoes
         WHERE status = 'aprovada' AND aprovado_at > '{desde}'::timestamptz
         ORDER BY aprovado_at
    """)
    if not amostras:
        return
    for a in amostras:
        try:
            ja = sql(CLOUD, f"""
                SELECT 1 FROM kanban_cards
                 WHERE dept_id = 'compras-marco'
                   AND details->>'amostra_id' = '{a['id']}' LIMIT 1
            """) or []
            if ja:
                continue
            cliente, obra = None, None
            if a.get("card_id"):
                cc = sql(CLOUD, f"SELECT title, obra FROM kanban_cards WHERE id = '{a['card_id']}' LIMIT 1") or []
                if cc:
                    cliente, obra = cc[0].get("title"), cc[0].get("obra")
            produto = " · ".join(x for x in [a.get("produto"), a.get("acabamento"), a.get("cor_referencia")] if x)
            qtd = a.get("quantidade_pecas")
            materiais = [{
                "tipo": produto or "Amostra",
                "quantidade": f"{qtd} peça(s)" if qtd else "",
                "justificativa": (a.get("motivo") or "")[:120],
            }]
            hoje = datetime.now(timezone.utc).astimezone().strftime("%d/%m/%Y")
            row = {
                "dept_id": "compras-marco",
                "column_id": "solicitacao",
                "title": f"Amostra — {cliente or produto or 'Solicitação'}",
                "subtitle": f"Aprovada pelo Douglas em {hoje}",
                "obra": obra,
                "tags": ["amostra-aprovada"],
                "details": {
                    "solicitante": f"{a.get('solicitado_por_nome') or 'Vendedor'} · Homebroker",
                    "setor": "Comercial",
                    "materiais": materiais,
                    "obs": " | ".join(x for x in [
                        f"Motivo: {a.get('motivo')}" if a.get("motivo") else None,
                        f"Obs: {a.get('obs')}" if a.get("obs") else None,
                        f"Entrega: {a.get('endereco_entrega')}" if a.get("endereco_entrega") else None,
                        f"CEP: {a.get('cep')}" if a.get("cep") else None,
                        f"Aprovado por: {a.get('aprovado_por')}" if a.get("aprovado_por") else None,
                    ] if x),
                    "amostra_id": a["id"],
                    "card_comercial_id": a.get("card_id"),
                    "origem": "watcher-amostra-aprovada",
                },
            }
            created = rest_insert("kanban_cards", row)
            card = created[0] if isinstance(created, list) else created
            log(f"card amostra criado id={card.get('id')} amostra={a['id']} cliente={cliente}")
            if NOTIFY:
                try:
                    http(NOTIFY_URL, method="POST",
                         headers={"Content-Type": "application/json"},
                         body={
                             "titulo": row["title"],
                             "solicitante": row["details"]["solicitante"],
                             "itens": [materiais[0]["tipo"]],
                             "prazo": None,
                             "projeto_vinculado": obra,
                             "card_id": card.get("id"),
                         }, timeout=10)
                except Exception as e:
                    log(f"notify amostra falhou (ok, best-effort): {e}")
        except Exception as e:
            log(f"ERRO amostra {a.get('id')}: {e}")
            continue
    st["last_amostra_ts"] = max(a["aprovado_at"] for a in amostras)
    json.dump(st, open(STATE_FILE, "w"))


# ── HB DRIVE (PKT-HB-DRIVE-20260901) ────────────────────────────────────
# Anexos do Homebroker migram do Supabase Storage pro Google Drive (decisão
# Will 01/09). Quatro sub-pernas, todas idempotentes e SEM watermark (o estado
# vive em kanban_cards.details, então retry é automático):
#   A) card novo no funil comercial (dept='comercial') ganha pasta
#      "Home Broker/<CLIENTE>" via action ensure_hb_folder (dedup por nome
#      normalizado no próprio Apps Script; lead que voltou é desarquivado);
#   B) card em GANHO: pasta migra pra área de Projetos (shared drive
#      0AF-R0Sev8WPcUk9PVA). Como é OUTRO shared drive, o Apps Script recria
#      a pasta lá e move os arquivos (file_ids mantidos, folder_id NOVO) —
#      por isso a gente atualiza details.drive_folder_id com o retorno;
#   C) card em PERDA há mais de HB_ARQUIVO_DIAS: pasta vai pra
#      "Home Broker/_Arquivo" (NUNCA lixeira — purga em 30d e o cliente
#      pode voltar; delete definitivo é sempre manual);
#   D) ORÇAMENTO no Drive (task #1976): proposta que foi pro comercial
#      (card Valoria em handoff-com/proposta-aceita) vira PDF impresso da
#      página pública (valor.parket.works) via chromium headless e sobe
#      pra pasta do cliente com action upsert_file — nome estável
#      "Orcamento <numero> - <cliente>.pdf", então EDIÇÃO da proposta
#      substitui o conteúdo mantendo file_id (version history do Drive,
#      nunca versão velha como arquivo separado — regra Will 01/09).
# Flags usadas em details: drive_folder_id, drive_folder_url,
# drive_movido_projetos, drive_arquivado, drive_old_folder_id,
# orcamentos_drive (mapa sim_id -> {numero, file_id, updated_at}).
DRIVE_SCRIPT_URL = ("https://script.google.com/macros/s/"
                    "AKfycbz07KaMoECR5EemL9UyGT8SZfOpYiJDKir7qQzOyRDPu8XZzvXfBq8ZdSSMMel_qRrg/exec")
# column_id no PG local é slug na maioria dos cards, mas existem UUIDs
# legados — casar os dois formatos sempre.
HB_GANHO_COLS = "('ganho','3e77d624-cbaa-4d41-8561-837a2d34779e')"
HB_PERDA_COLS = "('perda','01183ac9-ce53-4966-acd4-3e56e8642a3e')"
HB_ARQUIVO_DIAS = 90          # perdido há mais de X dias → _Arquivo
# Só cards criados a partir daqui ganham pasta automática; os antigos COM
# anexo entram pelo script de backfill (parket-homebroker/scripts/).
HB_DRIVE_DESDE = "2026-09-01"


def drive_post(payload):
    """POST text/plain no Apps Script. O Google responde 302 pra uma URL de
    echo e o urllib segue o redirect com GET — o JSON final é o retorno."""
    return http(DRIVE_SCRIPT_URL, method="POST",
                headers={"Content-Type": "text/plain"}, body=payload, timeout=120)


def hb_drive_salvar(card_id, patch):
    """Merge jsonb do patch em kanban_cards.details no PG local E no Cloud
    (espelho). Cloud é best-effort: card pode nem existir lá."""
    j = json.dumps(patch, ensure_ascii=False).replace("'", "''")
    local_pg_dml(
        f"UPDATE kanban_cards SET details = COALESCE(details,'{{}}'::jsonb) "
        f"|| '{j}'::jsonb WHERE id::text = '{card_id}'")
    try:
        sql(CLOUD,
            f"UPDATE kanban_cards SET details = COALESCE(details,'{{}}'::jsonb) "
            f"|| '{j}'::jsonb WHERE id = '{card_id}'")
    except Exception as e:
        log(f"hb-drive: merge Cloud falhou card={card_id} (ok, espelho): {e}")


def sync_hb_drive():
    # A) pasta pra card novo do funil comercial (sem pasta ainda)
    novos = local_pg(f"""
        SELECT id::text AS id, title FROM kanban_cards
         WHERE dept_id = 'comercial'
           AND created_at >= '{HB_DRIVE_DESDE}'::timestamptz
           AND COALESCE(details->>'drive_folder_id','') = ''
           AND COALESCE(title,'') <> ''
         ORDER BY created_at
         LIMIT 20
    """)
    # A2) lead perdido que VOLTOU (saiu de perda com pasta arquivada):
    # ensure_hb_folder desarquiva a pasta automaticamente no Drive.
    voltaram = local_pg(f"""
        SELECT id::text AS id, title FROM kanban_cards
         WHERE dept_id = 'comercial'
           AND details->>'drive_arquivado' = 'true'
           AND column_id NOT IN {HB_PERDA_COLS}
         LIMIT 10
    """)
    for c in novos + voltaram:
        try:
            r = drive_post({"action": "ensure_hb_folder", "client_name": c["title"]})
            if not (r or {}).get("success"):
                log(f"hb-drive pasta FALHOU card={c['id']} '{c['title']}': {r}")
                continue
            hb_drive_salvar(c["id"], {
                "drive_folder_id": r["folder_id"],
                "drive_folder_url": r.get("folder_url"),
                "drive_arquivado": False,
            })
            log(f"hb-drive pasta ok card={c['id']} '{c['title']}' "
                f"folder={r['folder_id']} origem={r.get('origem')}")
        except Exception as e:
            log(f"ERRO hb-drive pasta card={c.get('id')}: {e}")

    # B) GANHO → pasta migra pra área de Projetos (cross shared drive)
    ganhos = local_pg(f"""
        SELECT id::text AS id, title, details->>'drive_folder_id' AS fid
          FROM kanban_cards
         WHERE dept_id = 'comercial'
           AND column_id IN {HB_GANHO_COLS}
           AND COALESCE(details->>'drive_folder_id','') <> ''
           AND COALESCE(details->>'drive_movido_projetos','') <> 'true'
         LIMIT 10
    """)
    for c in ganhos:
        try:
            r = drive_post({"action": "move_folder", "folder_id": c["fid"]})
            if not (r or {}).get("success"):
                log(f"hb-drive move FALHOU card={c['id']} '{c['title']}': {r}")
                continue
            patch = {"drive_movido_projetos": True}
            if r.get("migrated"):
                # pasta foi RECRIADA no drive de Projetos: id novo obrigatório
                patch["drive_folder_id"] = r["folder_id"]
                patch["drive_folder_url"] = r.get("folder_url")
                patch["drive_old_folder_id"] = r.get("old_folder_id")
            hb_drive_salvar(c["id"], patch)
            log(f"hb-drive move ok card={c['id']} '{c['title']}' "
                f"migrated={r.get('migrated')} folder={r.get('folder_id')}")
        except Exception as e:
            log(f"ERRO hb-drive move card={c.get('id')}: {e}")

    # C) PERDA há mais de HB_ARQUIVO_DIAS → arquivar em Home Broker/_Arquivo
    perdidos = local_pg(f"""
        SELECT id::text AS id, title, details->>'drive_folder_id' AS fid
          FROM kanban_cards
         WHERE dept_id = 'comercial'
           AND column_id IN {HB_PERDA_COLS}
           AND updated_at < now() - interval '{HB_ARQUIVO_DIAS} days'
           AND COALESCE(details->>'drive_folder_id','') <> ''
           AND COALESCE(details->>'drive_movido_projetos','') <> 'true'
           AND COALESCE(details->>'drive_arquivado','') <> 'true'
         LIMIT 10
    """)
    for c in perdidos:
        try:
            r = drive_post({"action": "archive_folder", "folder_id": c["fid"]})
            if not (r or {}).get("success"):
                log(f"hb-drive arquivo FALHOU card={c['id']} '{c['title']}': {r}")
                continue
            hb_drive_salvar(c["id"], {"drive_arquivado": True})
            log(f"hb-drive arquivado card={c['id']} '{c['title']}'")
        except Exception as e:
            log(f"ERRO hb-drive arquivo card={c.get('id')}: {e}")

    # D) orçamento (PDF da proposta) na pasta do cliente
    sync_hb_orcamentos()


# Sub-perna D: no máximo N PDFs por ciclo — o chromium leva ~15-20s por
# proposta e o cron roda a cada 3min; o resto fica pro próximo ciclo.
HB_ORC_LIMIT = 3


def hb_orcamento_pdf(sim_id):
    """Imprime a proposta pública (valor.parket.works) em PDF via chromium
    headless (imagem zenika/alpine-chrome, mesma validada no teste manual).
    URL LIMPA, sem preview_pdf: o @media print do renderer faz o layout
    (deck vira bloco vertical, sem banner). Retorna os bytes do PDF."""
    nome = f"hb-orc-{sim_id}.pdf"
    out = f"/tmp/{nome}"
    subprocess.run(
        ["docker", "run", "--rm", "-v", "/tmp:/out", "zenika/alpine-chrome",
         "--headless", "--no-sandbox", "--disable-gpu",
         "--virtual-time-budget=30000", "--no-pdf-header-footer",
         f"--print-to-pdf=/out/{nome}",
         f"https://valor.parket.works/proposta-valor.html?sim_id={sim_id}"],
        check=True, timeout=150, capture_output=True)
    try:
        blob = open(out, "rb").read()
    finally:
        try:
            os.remove(out)
        except OSError:
            pass
    # Guarda: página de erro/branco também "imprime"; PDF real da proposta
    # tem várias páginas e passa fácil de 20KB.
    if not blob.startswith(b"%PDF") or len(blob) < 20 * 1024:
        raise RuntimeError(f"PDF inválido ({len(blob)} bytes)")
    return blob


def sync_hb_orcamentos():
    """Sub-perna D (task #1976): proposta que foi pro comercial vira PDF na
    pasta do cliente no Drive. Nome estável "Orcamento <numero> - <cliente>.pdf"
    + action upsert_file = edição da proposta SUBSTITUI o arquivo mantendo
    file_id (version history do Drive, nunca versão velha separada).
    Estado em details.orcamentos_drive = {sim_id: {numero, file_id, updated_at}};
    regen quando o updated_at da sim avança. Merge jsonb é raso, então o mapa
    é lido inteiro e regravado completo (read-modify-write)."""
    # Sim CORRENTE de cada card Valoria em handoff-com/proposta-aceita com
    # vínculo pro card comercial do HB (mesma regra de "corrente" do renderer:
    # maior versão, desempate por created_at).
    # Gate de publicação por FORA do DISTINCT ON de propósito: se a sim
    # corrente ainda não foi publicada ("Gerar proposta + link" no Valoria,
    # linha em ops.propostas), o card fica de fora — cair numa versão VELHA
    # publicada subiria orçamento desatualizado pro Drive.
    sims = sql(VALORIA, """
        SELECT * FROM (
            SELECT DISTINCT ON (cs.id)
                   cs.space_card_id::text AS hb_id,
                   cs.id::text AS val_card_id,
                   s.id::text AS sim_id, s.numero::text AS numero,
                   COALESCE(s.updated_at, s.created_at)::text AS sim_ts
              FROM ops.cards_solicitacao cs
              JOIN ops.simulacoes s ON s.card_id = cs.id
             WHERE cs.column_id IN ('handoff-com', 'proposta-aceita')
               AND cs.space_card_id IS NOT NULL
             ORDER BY cs.id, s.versao DESC NULLS LAST, s.created_at DESC
        ) corrente
        WHERE EXISTS (SELECT 1 FROM ops.propostas p
                       WHERE p.simulacao_id = corrente.sim_id::uuid)
    """) or []
    if not sims:
        return
    # Segundo gate: o renderer da página pública EXIGE o espelho no Valor
    # (simulacao_projetos com meta.valoria_card_id = card da sim); sem ele a
    # página mostra "não foi publicada" e o PDF sairia vazio. ops.propostas
    # pode existir com espelho órfão/deletado, então checa os dois.
    vids = ",".join("'" + s["val_card_id"] + "'" for s in sims)
    espelhos = {r["vid"] for r in (sql(CLOUD, f"""
        SELECT DISTINCT meta->>'valoria_card_id' AS vid
          FROM simulacao_projetos
         WHERE meta->>'valoria_card_id' IN ({vids})
    """) or [])}
    sims = [s for s in sims if s["val_card_id"] in espelhos]
    if not sims:
        return
    # Cards HB correspondentes. Card COM proposta publicada mas SEM pasta
    # ganha a pasta aqui mesmo (ensure_hb_folder) — cobre os cards antigos
    # de handoff-com que ficariam de fora do gate de data da sub-perna A
    # e do backfill (que só olha quem tem anexo). Ok do Will 01/09.
    ids = ",".join("'" + s["hb_id"].replace("'", "''") + "'" for s in sims)
    cards = {c["id"]: c for c in local_pg(f"""
        SELECT id::text AS id, title,
               COALESCE(details->>'drive_folder_id','') AS fid,
               COALESCE(details->'orcamentos_drive', '{{}}'::jsonb) AS orc
          FROM kanban_cards
         WHERE id::text IN ({ids})
           AND COALESCE(title,'') <> ''
    """)}
    feitos = 0
    for s in sims:
        c = cards.get(s["hb_id"])
        if not c:
            continue  # card não espelhado no local (ou sem título): pula
        estado = (c["orc"] or {}).get(s["sim_id"]) or {}
        # Já subiu e a sim não mudou desde então? Nada a fazer.
        if estado.get("file_id") and estado.get("updated_at") == s["sim_ts"]:
            continue
        if feitos >= HB_ORC_LIMIT:
            break  # respiro do ciclo; o cron de 3min pega o resto
        feitos += 1
        try:
            if not c["fid"]:
                # Pasta do cliente ainda não existe: cria/acha por nome (dedup
                # e desarquivamento são do próprio Apps Script).
                r = drive_post({"action": "ensure_hb_folder",
                                "client_name": c["title"]})
                if not (r or {}).get("success"):
                    raise RuntimeError(f"ensure_hb_folder: {r}")
                c["fid"] = r["folder_id"]
                hb_drive_salvar(c["id"], {
                    "drive_folder_id": r["folder_id"],
                    "drive_folder_url": r.get("folder_url"),
                    "drive_arquivado": False,
                })
                log(f"hb-orcamento pasta criada card={c['id']} '{c['title']}' "
                    f"folder={r['folder_id']} origem={r.get('origem')}")
            blob = hb_orcamento_pdf(s["sim_id"])
            # Nome do arquivo: cliente sem "/" (vira subpasta no Drive não,
            # mas quebra path em outros contextos) e truncado por higiene.
            cliente = (c["title"] or "Cliente").replace("/", "-").strip()[:80]
            r = drive_post({
                "action": "upsert_file",   # substitui pelo nome: mesmo file_id
                "folder_id": c["fid"],
                "filename": f"Orcamento {s['numero']} - {cliente}.pdf",
                "mime_type": "application/pdf",
                "data_base64": base64.b64encode(blob).decode(),
            })
            if not (r or {}).get("success"):
                raise RuntimeError(str(r))
            # Regrava o MAPA inteiro (merge jsonb do salvar é raso).
            orc = dict(c["orc"] or {})
            orc[s["sim_id"]] = {"numero": s["numero"],
                                "file_id": r["file_id"],
                                "updated_at": s["sim_ts"]}
            hb_drive_salvar(c["id"], {"orcamentos_drive": orc})
            log(f"hb-orcamento ok card={c['id']} sim={s['sim_id']} "
                f"n={s['numero']} file={r['file_id']}"
                f"{' (atualizado)' if r.get('updated') else ''}")
        except Exception as e:
            log(f"ERRO hb-orcamento card={c['id']} sim={s['sim_id']}: {e}")


def sync_fechamento_manual():
    """Perna 10 (PKT-HB-FECHADO-MANUAL-20260902): admin do Home Broker deu o
    negocio como FECHADO sem contrato digital (cliente nao usa o sistema).
    O modal do HB marca details.fechado_manual no card FINANCEIRO; aqui a gente
    cria o contratos_docusign status='assinado' (envelope MANUAL-FECHADO-<sim>)
    com service_role - RLS bloqueia insert do frontend de proposito. A partir
    dai a cascata normal do contrato assinado faz gestao/Core/compras/OP,
    incluindo anexos (anexos_producao) e Drive->Projetos (perna 9 no ganho)."""
    # NOT EXISTS de contrato assinado por card = idempotencia (nao re-insere)
    # e tambem pula cards que ja tem contrato REAL assinado (fechamento manual
    # redundante nao deve criar segundo contrato).
    # Guard extra por ENVELOPE: se a MESMA sim foi fechada manual em card
    # financeiro duplicado (ex.: NOVITA cb882d44 x f6b90c3f 02/09), o envelope
    # MANUAL-FECHADO-<sim> ja existe no outro card e o insert bateria no
    # UNIQUE(envelope_id) com 409 a cada ciclo pra sempre. A cascata ja rodou
    # pelo primeiro card, entao o duplicado e so ruido: pula.
    fins = sql(CLOUD, """
        SELECT kc.id, kc.title, kc.details
          FROM kanban_cards kc
         WHERE kc.dept_id = 'financeiro'
           AND kc.details ? 'fechado_manual'
           AND NOT EXISTS (
                 SELECT 1 FROM contratos_docusign cd
                  WHERE cd.card_id = kc.id AND cd.status = 'assinado')
           AND NOT EXISTS (
                 SELECT 1 FROM contratos_docusign cd2
                  WHERE cd2.envelope_id = 'MANUAL-FECHADO-' || COALESCE(
                            kc.details->'fechado_manual'->>'simulacao_id',
                            kc.details->>'simulacao_id'))
         LIMIT 20
    """) or []
    for f in fins:
        try:
            det = f.get("details") or {}
            fm = det.get("fechado_manual") or {}
            sim_id = fm.get("simulacao_id") or det.get("simulacao_id")
            if not sim_id:
                log(f"fechado_manual card={f['id']} SEM simulacao_id - pulando")
                continue
            now = datetime.now(timezone.utc).isoformat()
            rest_insert("contratos_docusign", {
                "card_id": f["id"],
                "envelope_id": f"MANUAL-FECHADO-{sim_id}",
                "status": "assinado",
                "titulo": "Contrato Principal",
                "signatarios": [
                    {"nome": f.get("title") or "Cliente", "papel": "contratante",
                     "email": det.get("email") or "", "anchor": "\\sign_contratante\\"},
                    {"nome": "Clodoaldo Donizete Oliveira", "papel": "contratada",
                     "email": "sistemas@parket.com.br", "anchor": "\\sign_contratada\\"},
                ],
                "sent_at": now, "completed_at": now,
                "notes": (f"Fechamento MANUAL via Home Broker por {fm.get('por','?')} "
                          f"em {fm.get('em','?')} (cliente nao usa o sistema de contratos). "
                          f"Proposta #{fm.get('numero','')}. Sem DocuSign real."),
            })
            log(f"fechado_manual: contrato assinado sintetico criado card={f['id']} sim={sim_id}")
        except Exception as e:
            log(f"ERRO fechado_manual card={f.get('id')}: {e}")


def sync_valoria_sim_fechada():
    """Perna 11 (PKT-VALOR-SIM-FECHADA-20260903): contrato assinado -> a sim
    escolhida vira status 'fechada' no Valor e as irmas do mesmo card viram
    'perdida'. E isso que pinta a proposta de VERDE na lista de Versoes do card
    em valor.parket.works (Workspace.tsx le ops.simulacoes.status).

    QUE: varre TODO contratos_docusign assinado (nao so os novos) e resolve a
    proposta pelo mesmo CTE que a cascata principal usa. Como e state-based e
    idempotente (so mexe em quem ainda nao esta fechada), cobre de uma vez os
    dois caminhos de fechamento e ja faz o backfill do que ficou pra tras:
      - contrato digital assinado no DocuSign;
      - "Dar como fechado" do admin no HB, que a perna 10 transforma em
        contrato sintetico MANUAL-FECHADO-<sim>.

    POR QUE aqui e nao no webhook: o parket-docusign so tem credencial do Cloud,
    e ops.simulacoes vive no projeto da Valoria (skbjmlz...). O PATCH que o
    supabase_client.mark_valoria_sim_fechada manda pro Cloud com Accept-Profile
    ops sempre voltou PGRST106 ("schema must be one of ...") e era descartado
    sem log, entao nenhuma sim jamais foi marcada. O watcher fala com os dois
    projetos, entao e o unico lugar que fecha a cadeia inteira."""
    # Uma linha por contrato assinado, com a proposta escolhida (sp_id) e, quando
    # o Cloud conhece, o id do espelho na Valoria (vid). O que vier sem vid e
    # resolvido logo abaixo pelo vinculo reverso, no outro projeto.
    alvos = sql(CLOUD, """
        WITH assinados AS (
          SELECT cd.id AS contrato_id, cd.card_id, cd.envelope_id
            FROM contratos_docusign cd
           WHERE cd.status = 'assinado'
        ),
        base AS (
          -- No fechamento manual o proprio envelope carrega a proposta que o
          -- admin escolheu (MANUAL-FECHADO-<sp_id>, 'MANUAL-FECHADO-' = 15 chars).
          -- Esse id manda: e a escolha explicita de quem clicou "Dar como fechado".
          SELECT a.contrato_id, a.envelope_id, a.card_id, kc.details AS det,
                 (SELECT sp0.id FROM simulacao_projetos sp0
                   WHERE sp0.id = COALESCE(
                           CASE WHEN a.envelope_id LIKE 'MANUAL-FECHADO-%'
                                THEN NULLIF(substring(a.envelope_id from 16),'')::uuid END,
                           NULLIF(kc.details->'fechado_manual'->>'simulacao_id','')::uuid)
                 ) AS sp_escolhida
            FROM assinados a
            LEFT JOIN kanban_cards kc ON kc.id = a.card_id
        ),
        resolvido AS (
          -- Escolha explicita manda e e terminal: se o admin apontou a proposta,
          -- nunca cair no palpite abaixo, que pintaria de VERDE a proposta ERRADA
          -- do cliente (Flavio Resende: envelope aponta a 10596, palpite dava 1987).
          -- Contrato digital nao carrega id de proposta, entao ai sim cai no
          -- vinculo por card, priorizando quem tem selected_at (aprovada no HB).
          SELECT b.contrato_id, b.envelope_id,
                 COALESCE(b.sp_escolhida,
                   (SELECT sp.id
                      FROM simulacao_projetos sp
                     WHERE sp.card_id = b.card_id
                        OR sp.card_comercial_id = b.card_id
                        OR sp.card_id = NULLIF(b.det->>'comercial_card_id','')::uuid
                        OR sp.card_comercial_id = NULLIF(b.det->>'comercial_card_id','')::uuid
                        OR sp.card_comercial_id = NULLIF(b.det->>'card_comercial_id','')::uuid
                        OR sp.id = NULLIF(b.det->>'simulacao_id','')::uuid
                     ORDER BY sp.selected_at DESC NULLS LAST, sp.created_at DESC
                     LIMIT 1)) AS sp_id
            FROM base b
        )
        SELECT r.contrato_id, r.envelope_id, r.sp_id::text AS sp_id,
               sp.meta->>'valoria_simulacao_id' AS vid,
               COALESCE(NULLIF(sp.meta->>'valoria_card_id','')::uuid, sp.card_id)::text
                 AS valoria_card
          FROM resolvido r
          JOIN simulacao_projetos sp ON sp.id = r.sp_id
    """) or []
    if not alvos:
        return
    # Nem todo sp do Cloud guarda valoria_simulacao_id: esse link so e gravado por
    # quem gera o espelho. Quando falta, o vinculo existe do outro lado, na sim da
    # Valoria (meta.space_proposta_id aponta pro sp). Sem ler os dois sentidos o
    # Flavio Resende ficava sem verde: o admin escolheu o sp 10596 e o espelho dele
    # e a sim 11376, "Importada do Space #10596".
    faltando = {a["sp_id"]: a for a in alvos if not a.get("vid") and a.get("sp_id")}
    if faltando:
        ids = ",".join(f"'{i}'" for i in faltando)
        espelhos = sql(VALORIA, f"""
            SELECT id, card_id::text AS card_id, meta->>'space_proposta_id' AS spid
              FROM ops.simulacoes
             WHERE meta->>'space_proposta_id' IN ({ids})
             ORDER BY created_at
        """) or []
        for sp_id, alvo in faltando.items():
            # O import dedupa por card+proposta, entao a mesma proposta re-importada
            # em outro card tem 2 espelhos. Fica com o do card que o sp aponta;
            # empate remanescente resolve pelo espelho mais recente.
            cands = [e for e in espelhos if e["spid"] == sp_id]
            if not cands:
                continue
            card = alvo.get("valoria_card")
            preferidos = [e for e in cands if card and e["card_id"] == card] or cands
            alvo["vid"] = preferidos[-1]["id"]
    # Dedup pela sim: card financeiro duplicado (ex.: NOVITA) aponta pra mesma
    # proposta e geraria update repetido no mesmo ciclo.
    vistos, unicos = set(), []
    for a in alvos:
        v = a.get("vid")
        if not v or v in vistos:
            continue
        vistos.add(v)
        unicos.append(a)
    if not unicos:
        return
    vids = ",".join(f"'{a['vid']}'" for a in unicos)
    # So as que ainda nao estao fechadas: idempotencia sem watermark.
    # meta.reaberta_manual = trava de reabertura: quando alguem devolve a
    # proposta pra edicao, o contrato assinado continua existindo e este ciclo
    # (roda de 3 em 3 min) refecharia tudo de volta em minutos. A flag e a unica
    # forma de a reabertura sobreviver sem apagar o contrato.
    pend = sql(VALORIA, f"""
        SELECT id, card_id, numero FROM ops.simulacoes
         WHERE id IN ({vids}) AND status IS DISTINCT FROM 'fechada'
           AND COALESCE(meta->>'reaberta_manual','') NOT IN ('true','t','1')
    """) or []
    for s in pend:
        try:
            sql(VALORIA, f"""
                UPDATE ops.simulacoes
                   SET status = 'fechada',
                       meta = COALESCE(meta,'{{}}'::jsonb) || jsonb_build_object(
                                'fechada_em', now()::text,
                                'fechada_origem', 'watcher-contrato-assinado')
                 WHERE id = '{s['id']}'
            """)
            # Irmas do mesmo card viram perdida. Nunca mexe em fechada/perdida
            # (nao reabre o que ja foi resolvido), nem em aditivo (aditivo convive
            # com a proposta pai fechada, marcar como perdida apagaria o verde de
            # um contrato que tambem esta valendo), nem em irma reaberta a mao.
            if s.get("card_id"):
                sql(VALORIA, f"""
                    UPDATE ops.simulacoes
                       SET status = 'perdida'
                     WHERE card_id = '{s['card_id']}'
                       AND id <> '{s['id']}'
                       AND COALESCE(status,'') NOT IN ('fechada','perdida')
                       AND COALESCE(meta->>'eh_aditivo','') NOT IN ('true','t','1')
                       AND COALESCE(meta->>'reaberta_manual','') NOT IN ('true','t','1')
                """)
            log(f"valoria sim fechada: {s['id']} (proposta {s.get('numero')})")
        except Exception as e:
            log(f"ERRO valoria sim fechada {s.get('id')}: {e}")


def main():
    st = load_state()
    poll_amostras(st)
    last_ts = st["last_ts"]
    # overlap de 10min pra não perder evento na fronteira; dedup segura duplicata
    desde = (parse_ts(last_ts) - timedelta(minutes=10)).isoformat()
    mirror_contratos_local(desde)
    motor_core_mensal()
    # Perna 7 (PKT-TERMO-CORE-20260827): pagamentos do termo → Core.
    # Roda todo ciclo (como o motor), NÃO só quando há contrato novo.
    try:
        sync_termo_pagamentos()
    except Exception as e:
        log(f"sync_termo_pagamentos falhou (ok, best-effort): {e}")
    # Perna 8 (PKT-CORE-ORFAOS-20260828): re-adoção de lançamentos órfãos.
    try:
        sync_adotar_orfaos()
    except Exception as e:
        log(f"sync_adotar_orfaos falhou (ok, best-effort): {e}")
    # Perna 9 (PKT-HB-DRIVE-20260901): anexos HB no Google Drive
    # (pasta por cliente + ganho→Projetos + perdido→_Arquivo + orçamento PDF).
    try:
        sync_hb_drive()
    except Exception as e:
        log(f"sync_hb_drive falhou (ok, best-effort): {e}")
    # Perna 10 (PKT-HB-FECHADO-MANUAL-20260902): "Dar como fechado" do HB →
    # contrato assinado sintetico. Roda ANTES da query de contratos pra
    # cascata pegar o contrato novo neste MESMO ciclo (nao esperar +3min).
    try:
        sync_fechamento_manual()
    except Exception as e:
        log(f"sync_fechamento_manual falhou (ok, best-effort): {e}")
    # Perna 11 (PKT-VALOR-SIM-FECHADA-20260903): proposta fechada fica VERDE no
    # card do Valor. Depois da perna 10 pra pegar o fechamento manual do mesmo
    # ciclo; roda todo ciclo (state-based), nao so quando ha contrato novo.
    try:
        sync_valoria_sim_fechada()
    except Exception as e:
        log(f"sync_valoria_sim_fechada falhou (ok, best-effort): {e}")
    contratos = sql(CLOUD, f"""
        SELECT cd.id, cd.card_id, cd.envelope_id, cd.titulo, cd.updated_at
          FROM contratos_docusign cd
         WHERE cd.status = 'assinado'
           AND cd.updated_at > '{desde}'::timestamptz
           AND NOT EXISTS (
                 SELECT 1 FROM kanban_cards kc
                  WHERE kc.dept_id IN ('compras','compras-taiara')
                    AND kc.details->>'contrato_id' = cd.id::text)
         ORDER BY cd.updated_at
    """) or []
    if not contratos:
        return

    for c in contratos:
        try:
            # Contrato vive no card FINANCEIRO; a proposta aponta pro card de
            # orçamento/comercial. Chaves de vínculo (Will 15/07):
            #   1) financeiro.details->>'comercial_card_id' → sp.card_comercial_id
            #   2) financeiro.details->>'simulacao_id' → sp.id (Homebroker seta esse)
            #   3) sp.card_id = card financeiro (raro, mas cobre casos antigos)
            props = sql(CLOUD, f"""
                WITH fin AS (
                  SELECT details FROM kanban_cards WHERE id = '{c['card_id']}'
                ),
                alvo AS (
                  SELECT '{c['card_id']}'::uuid AS id
                  UNION
                  SELECT NULLIF(details->>'comercial_card_id','')::uuid FROM fin
                  UNION
                  SELECT NULLIF(details->>'card_comercial_id','')::uuid FROM fin
                ),
                sim_ids AS (
                  SELECT NULLIF(details->>'simulacao_id','')::uuid AS id FROM fin
                )
                SELECT sp.id, sp.numero, sp.cliente, sp.obra_code,
                       sp.meta->>'valoria_simulacao_id' AS valoria_simulacao_id
                  FROM simulacao_projetos sp
                 WHERE sp.card_id IN (SELECT id FROM alvo WHERE id IS NOT NULL)
                    OR sp.card_comercial_id IN (SELECT id FROM alvo WHERE id IS NOT NULL)
                    OR sp.id IN (SELECT id FROM sim_ids WHERE id IS NOT NULL)
                 ORDER BY sp.selected_at DESC NULLS LAST, sp.created_at DESC
                 LIMIT 1
            """) or []
            if not props:
                log(f"contrato {c['id']}: nenhuma proposta pro card {c['card_id']} — pulando")
                continue
            p = props[0]
            vid = p.get("valoria_simulacao_id")
            itens, ambientes = [], []
            if vid:
                # Mesma ordenação do buildPropostaItens da Valoria (ambiente.ordem,
                # depois item.ordem) — é ela que define a numeração N.M da proposta.
                itens, ambientes = sim_itens_e_ambientes(vid)
            fab = agg_insumos(itens, "insumos_fabricacao")
            inst = agg_insumos(itens, "insumos_instalacao")
            prods_fab = produtos_vendidos(itens, "insumos_fabricacao")
            prods_inst = produtos_vendidos(itens, "insumos_instalacao")
            if not fab and not inst:
                # sem lista de insumos (proposta antiga/Space): cria card genérico pro Ronaldo triar
                fab = [{"tipo": "(sem lista de insumos na proposta — levantar manualmente)",
                        "quantidade": "", "justificativa": f"Proposta {p.get('numero') or p.get('id')}"}]
            # Fluxo Will 15/07 na assinatura do contrato:
            #   1) gestão (central do cliente) — cria projeto+itens em gestao.projetos
            #   2) compras Ronaldo (fabricação) — lista de materiais
            #   3) compras Taiara (instalação) — lista de materiais
            # NÃO cria card em dept=projetos aqui — isso vira o Trigger 2 (quando
            # gestão mover o projeto pra coluna 'projeto' → sobe pra projetos.parket.works).
            try:
                ensure_gestao_projeto(c, p)
            except Exception as e:
                log(f"ensure_gestao_projeto falhou (ok, best-effort): {e}")
            # 6) Core financeiro: cliente + obra + parcelas a receber + comissão.
            try:
                ensure_core_financeiro(c, p)
            except Exception as e:
                log(f"ensure_core_financeiro falhou (ok, best-effort): {e}")
            # 4) PCP Produção: OP automática se a sim tem porta/marcenaria.
            #    Fluxo Will 06/08: com OP, o card do Ronaldo NÃO nasce na assinatura —
            #    fica guardado em compras_payload e só vira card quando a Produção
            #    der OK na lista de fabricação (liberar_compras_aprovadas).
            op_criada = False
            try:
                fab_itens = lista_fabricacao(itens, ambientes, p.get("cliente"))
                if fab_itens:
                    vcard = None
                    if vid:
                        vrows = sql(VALORIA, f"SELECT card_id FROM ops.simulacoes WHERE id = '{vid}'") or []
                        vcard = (vrows[0].get("card_id") if vrows else None)
                    payload = {
                        "materiais": fab,
                        "produtos": prods_fab,
                        "contrato": {"id": str(c["id"]), "titulo": c.get("titulo"),
                                     "envelope_id": c.get("envelope_id"), "card_id": c.get("card_id")},
                        "proposta": {"id": p.get("id"), "numero": p.get("numero"),
                                     "cliente": p.get("cliente"), "obra_code": p.get("obra_code"),
                                     "valoria_simulacao_id": vid},
                    }
                    criar_op_producao(c, p, fab_itens, vcard, compras_payload=payload)
                    op_criada = True
            except Exception as e:
                log(f"criar_op_producao falhou contrato={c.get('id')}: {e}")
            if fab and not op_criada:
                # Ronaldo (fabricação): sem OP no meio, fluxo antigo direto.
                criar_card("compras", "Fabricação", c, p, fab, None, produtos=prods_fab)
            if inst:
                # Taiara (instalação): produtos + insumos_instalacao POR produto.
                criar_card("compras-taiara", "Instalação", c, p, inst, None, produtos=prods_inst)
        except Exception as e:
            log(f"ERRO contrato {c.get('id')}: {e}")
            continue

    st["last_ts"] = max(c["updated_at"] for c in contratos)
    json.dump(st, open(STATE_FILE, "w"))


# Board de Projetos local (Trello desligado 02/09 — Will): as escritas vão
# DIRETO nas tabelas trello_projetos.* do parket-pg-local (fonte da verdade
# do projetos.parket.works). Ids de lista/card seguem o formato 24-hex
# herdado do Trello pra nada a jusante precisar distinguir.
TRELLO_LIST_CONTRATOS_NOVOS = "681ca3122b5e5803275f65fc"  # lista "CONTRATOS NOVOS"


def _sql_txt(s: str) -> str:
    """Escapa aspas simples pra literal SQL — os helpers local_pg* montam a
    query por string e desc de card tem markdown com apóstrofo."""
    return (s or "").replace("'", "''")


def projetos_criar_card(name: str, desc: str, list_id: str = TRELLO_LIST_CONTRATOS_NOVOS,
                        space_card_id: str | None = None) -> dict:
    """Cria card do board Projetos DIRETO no banco local. pos = topo da lista
    (MIN-1024, mesmo hábito do Trello); space_card_id vai na coluna além da
    marca no desc (o app usa a coluna pros vínculos gestão/fiscal)."""
    import uuid as _uuid
    cid = _uuid.uuid4().hex[:24]
    space_sql = f"'{space_card_id}'" if space_card_id else "NULL"
    local_pg_dml(f"""
        INSERT INTO trello_projetos.cards
            (id, lista_id, nome, descricao, pos, space_card_id, date_last_activity)
        VALUES ('{cid}', '{list_id}', '{_sql_txt(name)}', '{_sql_txt(desc)}',
                (SELECT COALESCE(MIN(pos), 65536) - 1024
                   FROM trello_projetos.cards WHERE lista_id = '{list_id}'),
                {space_sql}, now())""")
    # injeta no cache do board: dedup por marca no MESMO ciclo ja enxerga o
    # card recem-criado (sem isso o cache stale deixaria criar duplicata)
    if _BOARD_CACHE["cards"] is not None:
        _BOARD_CACHE["cards"].append({"id": cid, "desc": desc})
    return {"id": cid}


# Cache dos cards (id+desc) pro dedup por marca. QUE FAZ: a perna
# gestao->projetos faz ate 2 buscas x ~420 projetos por ciclo de 3min;
# cada busca via docker exec psql custa ~100ms — 1 SELECT por ciclo
# (TTL 120s) servido da memoria resolve; projetos_criar_card injeta o
# card novo no cache pro dedup intra-ciclo continuar valendo.
_BOARD_CACHE = {"cards": None, "ts": 0.0}

def _trello_board_cards() -> list:
    """Cards (id+desc) do board Projetos LOCAL, incluindo arquivados
    (card arquivado ainda vale pro dedup), cacheados por 120s."""
    import time as _t
    if _BOARD_CACHE["cards"] is None or (_t.time() - _BOARD_CACHE["ts"]) > 120:
        rows = local_pg("SELECT id, descricao FROM trello_projetos.cards")
        _BOARD_CACHE["cards"] = [{"id": r["id"], "desc": r.get("descricao") or ""}
                                 for r in rows]
        _BOARD_CACHE["ts"] = _t.time()
    return _BOARD_CACHE["cards"]


def trello_buscar_card_por_marca(marca: str) -> str | None:
    """Dedup genérico: procura qualquer marca (`gestao_projeto_id:X`,
    `space_card_id:X`, etc) no desc dos cards do board (via cache)."""
    for c in _trello_board_cards():
        if marca in (c.get("desc") or ""):
            return c.get("id")
    return None


def _fmt_qtd(q):
    try:
        f = float(q or 0)
    except (TypeError, ValueError):
        return str(q or "")
    s = f"{f:,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")
    return s[:-3] if s.endswith(",00") else s


def vendido_block(gestao_projeto_id: str) -> str | None:
    """Bloco 'O QUE FOI VENDIDO' pro desc do card de Projetos no Trello —
    Projetos dá o OK pra Produção produzir, então o card precisa mostrar tudo
    que foi vendido (gestao.itens = mesma fonte do cronograma/Central).
    Delimitado por <!-- vendido:<hash> --> ... <!-- /vendido --> pra sync
    idempotente (Will 18/08)."""
    import hashlib
    rows = local_pg(f"""
        SELECT categoria,
               regexp_replace(descritivo, '^[0-9]+(\\.[0-9]+)*\\s*·\\s*', '') AS produto,
               sum(quantidade) AS qtd, max(unidade) AS un, count(*) AS ambientes
          FROM gestao.itens
         WHERE projeto_id = '{gestao_projeto_id}'
         GROUP BY 1, 2 ORDER BY min(ordem)""")
    if not rows:
        return None
    linhas, cat_atual = [], None
    for r in rows[:60]:
        cat = (r.get("categoria") or "OUTROS").upper().strip()
        if cat != cat_atual:
            linhas.append(f"**{cat}**")
            cat_atual = cat
        linha = f"- {(r.get('produto') or '').strip()} — {_fmt_qtd(r.get('qtd'))} {r.get('un') or ''}".rstrip()
        amb = int(r.get("ambientes") or 1)
        if amb > 1:
            linha += f" ({amb} ambientes)"
        linhas.append(linha)
    if len(rows) > 60:
        linhas.append(f"… +{len(rows) - 60} itens (ver Central do cliente)")
    corpo = "\n".join(linhas)
    h = hashlib.md5(corpo.encode()).hexdigest()[:10]
    return f"<!-- vendido:{h} -->\n**O QUE FOI VENDIDO**\n{corpo}\n<!-- /vendido -->"


def sync_vendido_trello():
    """Mantém o bloco VENDIDO no desc dos cards de Projetos (banco local) que
    têm a marca gestao_projeto_id. Idempotente por hash — só faz UPDATE quando
    a lista do gestão mudou."""
    cards = local_pg("SELECT id, descricao FROM trello_projetos.cards "
                     "WHERE NOT closed AND descricao LIKE '%gestao_projeto_id:%'")
    rx_gid = re.compile(r"gestao_projeto_id:([0-9a-f-]{36})")
    rx_bloco = re.compile(r"\n*<!-- vendido:[0-9a-f]+ -->.*?<!-- /vendido -->", re.S)
    n = 0
    for c in cards:
        desc = c.get("descricao") or ""
        m = rx_gid.search(desc)
        if not m:
            continue
        try:
            bloco = vendido_block(m.group(1))
            if not bloco:
                continue
            if bloco.split("\n", 1)[0] in desc:  # hash igual = nada mudou
                continue
            novo = (rx_bloco.sub("", desc).rstrip() + "\n\n" + bloco)[:16000]
            local_pg_dml(f"""
                UPDATE trello_projetos.cards
                   SET descricao = '{_sql_txt(novo)}', sync_at = now()
                 WHERE id = '{c['id']}'""")
            n += 1
        except Exception as e:
            log(f"ERRO vendido card {c.get('id')}: {e}")
    if n:
        log(f"vendido-projetos: {n} card(s) com lista do vendido atualizada")


def gestao_para_projetos_kanban():
    """TRIGGER 2 (Will 15/07): quando gestão MOVE o projeto pra coluna 'projeto'
    (gestao.projetos.column_id='projeto'), cria card no board LOCAL do
    projetos.parket.works na lista "CONTRATOS NOVOS". Dedup por marca
    `gestao_projeto_id:<uuid>` no desc do card."""
    # Lê projetos em gestao.projetos.column_id='projeto' do banco LOCAL (Cloud
    # não tem schema gestao). Filtra em memória contra kanban_cards do CLOUD
    # (que é onde o rest_insert grava). Dedup por details->>'gestao_projeto_id'.
    try:
        rows_str = subprocess.check_output([
            "docker", "exec", "-i",
            subprocess.check_output(
                ["docker", "ps", "--filter", "name=parket-pg-local_postgres", "--format", "{{.ID}}"],
            ).decode().strip().split("\n")[0],
            # \x1f (unit separator): cliente/obra com "|" no nome quebrava o split
            # e abortava o loop inteiro (ERRO trigger2 desde 13/08).
            "psql", "-U", "postgres", "-d", "postgres", "-A", "-t", "-F", "\x1f", "-c",
            """SELECT p.id::text, p.card_id::text, p.contrato_id::text, p.simulacao_id::text,
                      p.cliente, p.obra_code, p.valor_total::text
                 FROM gestao.projetos p
                WHERE p.column_id = 'projeto'""",
        ]).decode().strip().split("\n")
    except Exception as e:
        log(f"gestao_para_projetos read falhou: {e}")
        return

    for row in rows_str:
        row = row.strip()
        if not row: continue
        parts = row.split("\x1f")
        if len(parts) != 7: continue
        gid, card_id, contrato_id, sim_id, cliente, obra, valor = parts
        try:
            if trello_buscar_card_por_marca(f"gestao_projeto_id:{gid}"):
                continue  # dedup canônico: mesmo projeto gestão já tem card
            # Guard extra: mesmo cliente com projetos gestão diferentes MAS
            # apontando pro mesmo Space (aditivo, revisão, etc) não recria.
            if card_id and trello_buscar_card_por_marca(f"space_card_id:{card_id}"):
                log(f"projetos-trello dedup por space_card_id={card_id} — projeto {gid} skipped")
                continue
            name = (cliente or "Projeto").strip()
            valor_fmt = f"R$ {float(valor or 0):,.2f}".replace(",", "X").replace(".", ",").replace("X", ".") if valor else "—"
            desc_linhas = [
                f"**Cliente:** {cliente}",
                f"**Obra:** {obra or '—'}",
                f"**Valor total:** {valor_fmt}",
                f"**Passado pela Gestão em:** {datetime.now(timezone.utc).astimezone().strftime('%d/%m/%Y')}",
                "",
                f"Central do cliente: https://gestao.parket.works/projetos/{gid}",
                "",
                f"---",
                f"<!-- gestao_projeto_id:{gid} -->",
                f"<!-- space_card_id:{card_id or ''} -->",
                f"<!-- contrato_id:{contrato_id or ''} -->",
                f"<!-- simulacao_id:{sim_id or ''} -->",
            ]
            try:
                bloco = vendido_block(gid)
                if bloco:
                    desc_linhas += ["", bloco]
            except Exception as e:
                log(f"vendido_block falhou {gid}: {e}")
            card = projetos_criar_card(name, "\n".join(desc_linhas),
                                       space_card_id=card_id or None)
            log(f"projetos-card criado id={card.get('id')} gestao_projeto={gid} cliente={cliente}")
        except Exception as e:
            log(f"ERRO gestao->projetos {gid}: {e}")


if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        log(f"ERRO fatal: {e}")
    # Projetos APROVADO → executivo na etapa 7 (gestão + Central) — best-effort.
    # Roda ANTES do sync de anexos pra OP já receber o doc na mesma passada.
    try:
        sync_projetos_aprovado()
    except Exception as e:
        log(f"ERRO sync projetos aprovado: {e}")
    # Re-sync de anexos (projeto) pras OPs do PCP — best-effort.
    try:
        sync_anexos_producao()
    except Exception as e:
        log(f"ERRO sync anexos producao: {e}")
    # Cria OP no PCP pra qualquer projeto gestão com fabricação (porta/marc/
    # painel/forro laminado) que ainda não tem OP — não espera assinatura.
    try:
        sync_criar_op_de_projetos()
    except Exception as e:
        log(f"ERRO sync criar OP projetos: {e}")
    # Espelha liberação do projetos-app (per-item + qtd + obs + autor) nos
    # itens da OP do PCP — best-effort.
    try:
        sync_liberacao_projetos()
    except Exception as e:
        log(f"ERRO sync liberação projetos: {e}")
    # Lista de insumos (fabricação + instalação) da OP segue o Valor pra sempre —
    # best-effort.
    try:
        sync_insumos_valoria()
    except Exception as e:
        log(f"ERRO sync insumos valoria: {e}")
    # Espelha em que lista/fase o card está no board projetos (e auto-avança
    # etapa PCP quando a fase Projetos indicar produção/entrega/instalação/
    # finalizado/reparo) — best-effort.
    try:
        sync_projetos_fase()
    except Exception as e:
        log(f"ERRO sync projetos fase: {e}")
    # Libera card do Ronaldo pras OPs com lista de fabricação aprovada — best-effort.
    try:
        liberar_compras_aprovadas()
    except Exception as e:
        log(f"ERRO liberar compras aprovadas: {e}")
    # Espelha edições da lista (justificativa) no card compras existente — best-effort.
    try:
        sync_edicoes_compras()
    except Exception as e:
        log(f"ERRO sync edicoes compras: {e}")
    # Trigger 2 roda depois da main (independente) — best-effort.
    try:
        gestao_para_projetos_kanban()
    except Exception as e:
        log(f"ERRO trigger2: {e}")
        sys.exit(1)
    # Card de Projetos mostra tudo que foi vendido (Will 18/08) — best-effort.
    try:
        sync_vendido_trello()
    except Exception as e:
        log(f"ERRO vendido trello: {e}")
