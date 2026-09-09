"""parket-nfe · endpoints do setor Fiscal (fiscal.parket.works).

Fluxo do Ronaldo Fiscal:
  1. Emite NFe no Cigam (ERP externo, fora do escopo daqui)
  2. Baixa o XML autorizado (cStat=100)
  3. Sobe na plataforma via POST /api/fiscal/upload
  4. Sistema parseia, valida, cria fiscal.notas com obra vinculada
     (obra obrigatória por default; exceção "salvar como pendente" pra casos extremos)

Regra de vínculo (batida na tabela via CHECK):
  status_vinculo='vinculado' ⇒ obra_projeto_id NOT NULL
  status_vinculo='pendente'  ⇒ pode ser NULL (fila /pendentes pra resolver depois)

Parser: xml.etree.ElementTree (stdlib), sem dependência extra. NFe 4.00 SEFAZ.
"""
import json
import logging
import re
import xml.etree.ElementTree as ET
from datetime import datetime
from typing import Any

from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from pydantic import BaseModel

from .db import conn

log = logging.getLogger("gestao.fiscal")
router = APIRouter(prefix="/api/fiscal", tags=["fiscal"])

# Namespace da NFe 4.00 (portalfiscal.inf.br)
NS = {"n": "http://www.portalfiscal.inf.br/nfe"}


# ═══════════════════════════════════════════════════════════════════════
# PARSER DE XML NFe 4.00
# ═══════════════════════════════════════════════════════════════════════

def _txt(el, path: str, default: str | None = None) -> str | None:
    """Busca texto de um elemento XML por XPath relativo. Retorna default se ausente."""
    if el is None:
        return default
    node = el.find(path, NS)
    if node is None or node.text is None:
        return default
    return node.text.strip()


def _num(el, path: str, default: float = 0.0) -> float:
    """Busca número (NFe usa ponto decimal). Retorna default se ausente ou vazio."""
    v = _txt(el, path)
    if v is None or v == "":
        return default
    try:
        return float(v)
    except (ValueError, TypeError):
        return default


def parse_nfe(xml_bytes: bytes) -> dict[str, Any]:
    """Parseia um XML de NFe 4.00 autorizado (nfeProc) e retorna dict com todos
    os campos que o schema fiscal.notas precisa + itens + duplicatas.

    Erros comuns:
      - XML mal formado → HTTPException 400
      - Não é NFe modelo 55 → HTTPException 400
      - Não está autorizada (cStat != 100) → HTTPException 400
    """
    try:
        root = ET.fromstring(xml_bytes)
    except ET.ParseError as e:
        raise HTTPException(status_code=400, detail=f"XML inválido: {e}")

    # Aceita tanto <nfeProc> (com protocolo) quanto <NFe> puro (sem protocolo,
    # não deveria acontecer mas é mais defensivo)
    inf_nfe = root.find(".//n:infNFe", NS)
    if inf_nfe is None:
        raise HTTPException(status_code=400, detail="XML não contém infNFe (não é NFe SEFAZ)")

    # chNFe = attribute Id sem o prefixo "NFe"
    ch_nfe = (inf_nfe.get("Id") or "").replace("NFe", "").strip()
    if not re.fullmatch(r"\d{44}", ch_nfe):
        raise HTTPException(status_code=400, detail="chNFe inválido (esperado 44 dígitos)")

    ide  = inf_nfe.find("n:ide",  NS)
    emit = inf_nfe.find("n:emit", NS)
    dest = inf_nfe.find("n:dest", NS)
    total_icms = inf_nfe.find("n:total/n:ICMSTot", NS)
    prot = root.find(".//n:protNFe/n:infProt", NS)

    # Modelo: só aceitamos NFe (55). NFC-e (65) e outros ficam fora do v1.
    modelo = _txt(ide, "n:mod", "55")
    if modelo != "55":
        raise HTTPException(status_code=400, detail=f"Modelo {modelo} não suportado (apenas NFe 55)")

    # Status SEFAZ: 100 = autorizada. Qualquer outro rejeita.
    c_stat = int(_txt(prot, "n:cStat", "0") or 0) if prot is not None else 0
    if c_stat != 100:
        motivo = _txt(prot, "n:xMotivo", "sem protocolo") if prot is not None else "sem protocolo"
        raise HTTPException(status_code=400, detail=f"NFe não autorizada (cStat={c_stat}: {motivo})")

    # Data emissão em ISO com timezone (formato SEFAZ: 2026-08-19T13:22:14-03:00)
    dh_emi_raw = _txt(ide, "n:dhEmi")

    # Itens (bloco det[nItem])
    itens = []
    for det in inf_nfe.findall("n:det", NS):
        n_item = int(det.get("nItem") or 0)
        prod = det.find("n:prod", NS)
        itens.append({
            "n_item":   n_item,
            "c_prod":   _txt(prod, "n:cProd"),
            "x_prod":   _txt(prod, "n:xProd"),
            "ncm":      _txt(prod, "n:NCM"),
            "cfop":     _txt(prod, "n:CFOP"),
            "u_com":    _txt(prod, "n:uCom"),
            "q_com":    _num(prod, "n:qCom"),
            "v_un_com": _num(prod, "n:vUnCom"),
            "v_prod":   _num(prod, "n:vProd"),
        })

    # Duplicatas (bloco cobr/dup) — parcelas de cobrança
    duplicatas = []
    for dup in inf_nfe.findall("n:cobr/n:dup", NS):
        duplicatas.append({
            "n_dup":   _txt(dup, "n:nDup", "01"),
            "dh_venc": _txt(dup, "n:dVenc"),
            "valor":   _num(dup, "n:vDup"),
        })

    # DIFAL: se veio ICMSUFDest no total, soma. Pode vir em cada item também;
    # aqui uso só o total consolidado (mais confiável).
    valor_difal = 0.0
    if total_icms is not None:
        try:
            valor_difal = float(_txt(total_icms, "n:vICMSUFDest", "0") or 0)
        except (ValueError, TypeError):
            pass

    # Destinatário: pode ser CNPJ (14) ou CPF (11) — schema aceita ambos como text
    dest_cnpj = _txt(dest, "n:CNPJ") or _txt(dest, "n:CPF") or ""

    return {
        "ch_nfe":            ch_nfe,
        "numero":            int(_txt(ide, "n:nNF", "0") or 0),
        "serie":             int(_txt(ide, "n:serie", "1") or 1),
        "modelo":            modelo,
        "dh_emissao":        dh_emi_raw,
        "natureza_op":       _txt(ide, "n:natOp"),
        "tp_nf":             int(_txt(ide, "n:tpNF", "1") or 1),

        "emit_cnpj":         _txt(emit, "n:CNPJ") or "",
        "emit_nome":         _txt(emit, "n:xNome") or "",

        "dest_cnpj_cpf":     dest_cnpj,
        "dest_nome":         _txt(dest, "n:xNome") or "",
        "dest_uf":           _txt(dest, "n:enderDest/n:UF"),

        "valor_produtos":    _num(total_icms, "n:vProd"),
        "valor_desc":        _num(total_icms, "n:vDesc"),
        "valor_nf":          _num(total_icms, "n:vNF"),
        "valor_difal":       valor_difal,

        "n_protocolo":       _txt(prot, "n:nProt"),
        "dh_recbto":         _txt(prot, "n:dhRecbto"),
        "c_stat":            c_stat,

        "info_complementar": _txt(inf_nfe, "n:infAdic/n:infCpl"),

        "itens":             itens,
        "duplicatas":        duplicatas,
    }


# ═══════════════════════════════════════════════════════════════════════
# ENDPOINTS
# ═══════════════════════════════════════════════════════════════════════

@router.get("/health")
def fiscal_health():
    """Smoke test: conta emitentes e notas. Se emitentes=0 é sinal de que seed não rodou."""
    with conn() as c, c.cursor() as cur:
        cur.execute("SELECT (SELECT count(*) FROM fiscal.emitentes) emit, (SELECT count(*) FROM fiscal.notas) notas")
        r = cur.fetchone()
    return {"ok": True, **r}


@router.get("/projetos")
def fiscal_projetos():
    """Lista projetos de gestao.projetos agrupados por cliente pra montar o
    dropdown do upload. Retorna [{cliente, projetos: [{id, endereco, status, valor_total}]}].

    Ordenação: cliente A-Z; dentro do cliente, projetos por valor DESC.
    Filtro: só projetos com cliente não vazio (ruído). Status não filtra —
    o Ronaldo pode receber NF de obra em qualquer fase.
    """
    with conn() as c, c.cursor() as cur:
        cur.execute("""
            SELECT id, cliente, endereco, status, valor_total, cnpj_cpf, obra_code
              FROM gestao.projetos
             WHERE cliente IS NOT NULL AND cliente <> ''
             ORDER BY cliente ASC, valor_total DESC NULLS LAST
        """)
        rows = cur.fetchall()

    # Agrupa por cliente (preserva a ordem alfabética que o SQL já entregou)
    grupos: dict[str, dict[str, Any]] = {}
    for r in rows:
        cli = r["cliente"]
        if cli not in grupos:
            grupos[cli] = {"cliente": cli, "cnpj_cpf": r["cnpj_cpf"], "projetos": []}
        grupos[cli]["projetos"].append({
            "id":          str(r["id"]),
            "endereco":    r["endereco"],
            "status":      r["status"],
            "valor_total": float(r["valor_total"] or 0),
            "obra_code":   r["obra_code"],
        })
    return {"clientes": list(grupos.values())}


class UploadResp(BaseModel):
    ch_nfe: str
    status: str                  # "criado" | "duplicado" | "erro"
    numero: int | None = None
    serie: int | None = None
    dest_nome: str | None = None
    valor_nf: float | None = None
    obra_projeto_id: str | None = None
    status_vinculo: str | None = None
    sugestao_projeto: dict | None = None      # match auto por nome
    erro: str | None = None


def _sugerir_projeto(cur, dest_nome: str) -> dict | None:
    """Match fuzzy por nome. Como gestao.projetos.cnpj_cpf está vazio pra todos,
    caímos em ILIKE sobre gestao.projetos.cliente. Retorna o mais próximo ou None.

    Heurística: normaliza tudo pra minúsculas, tira pontuação, pega o primeiro
    "termo forte" (ex: "COLLA CONST LTDA" → "colla") e busca ILIKE %colla%.
    Se achar 1 único match, retorna. Se achar 0 ou vários, não sugere (fiscal escolhe).
    """
    if not dest_nome:
        return None
    # Primeiro termo significativo (3+ chars, sem "CIA/LTDA/EIRELI/ME")
    tokens = re.findall(r"[A-Za-zÀ-ú]{3,}", dest_nome)
    STOP = {"cia", "ltda", "eireli", "me", "sa", "sociedade", "empresa", "cons",
            "const", "constr", "engenharia"}
    termo = next((t for t in tokens if t.lower() not in STOP), None)
    if not termo:
        return None
    cur.execute(
        "SELECT id, cliente, endereco FROM gestao.projetos "
        "WHERE cliente ILIKE %s ORDER BY updated_at DESC LIMIT 2",
        (f"%{termo}%",),
    )
    matches = cur.fetchall()
    if len(matches) != 1:
        return None
    m = matches[0]
    return {"id": str(m["id"]), "cliente": m["cliente"], "endereco": m["endereco"]}


@router.post("/upload")
async def fiscal_upload(
    files: list[UploadFile] = File(...),
    uploaded_by: str = Form(..., description="Email do fiscal que fez o upload"),
) -> list[UploadResp]:
    """Recebe N XMLs de NFe autorizada e cria linhas em fiscal.notas com
    status_vinculo='pendente' (obra vazia). Auto-sugere obra por nome do dest.

    Retorna 1 UploadResp por arquivo. Erros individuais não abortam o lote
    (permite subir 10 XMLs de uma vez e resolver os problemáticos depois).

    Emitente novo (CNPJ não seedado em fiscal.emitentes): auto-registra com
    dados do próprio XML (nome_curto = primeiros 20 chars do xNome).
    """
    results: list[UploadResp] = []

    with conn() as c, c.cursor() as cur:
        for f in files:
            try:
                raw = await f.read()
                # Teto de tamanho: um XML de NFe tem poucos KB; 50MB+ é arquivo errado
                # (ou abuso) e estouraria memória no parse.
                if len(raw) > 50 * 1024 * 1024:
                    results.append(UploadResp(ch_nfe="?", status="erro",
                                              erro="Arquivo acima de 50MB. Um XML de NFe tem poucos KB, confira o arquivo."))
                    continue
                parsed = parse_nfe(raw)
            except HTTPException as e:
                results.append(UploadResp(ch_nfe="?", status="erro", erro=str(e.detail)))
                continue
            except Exception as e:
                log.exception("parse failed for %s", f.filename)
                results.append(UploadResp(ch_nfe="?", status="erro", erro=f"Falha: {e}"))
                continue

            ch = parsed["ch_nfe"]

            # Dedup por chNFe — se já existe, retorna "duplicado" (não sobrescreve)
            cur.execute("SELECT status_vinculo, obra_projeto_id FROM fiscal.notas WHERE ch_nfe = %s", (ch,))
            existente = cur.fetchone()
            if existente:
                results.append(UploadResp(
                    ch_nfe=ch, status="duplicado",
                    numero=parsed["numero"], serie=parsed["serie"],
                    dest_nome=parsed["dest_nome"], valor_nf=parsed["valor_nf"],
                    obra_projeto_id=str(existente["obra_projeto_id"]) if existente["obra_projeto_id"] else None,
                    status_vinculo=existente["status_vinculo"],
                ))
                continue

            # Auto-registra emitente se CNPJ não estiver seedado
            cur.execute("SELECT 1 FROM fiscal.emitentes WHERE cnpj = %s", (parsed["emit_cnpj"],))
            if not cur.fetchone():
                cur.execute(
                    "INSERT INTO fiscal.emitentes (cnpj, nome_curto, nome_razao, uf) VALUES (%s, %s, %s, %s)",
                    (parsed["emit_cnpj"], parsed["emit_nome"][:20], parsed["emit_nome"], parsed.get("dest_uf") or "??"),
                )

            # Match automático por nome (só sugere, não força)
            sugestao = _sugerir_projeto(cur, parsed["dest_nome"])

            # Insere a nota como PENDENTE (obra vazia). Fiscal vincula na UI.
            cur.execute("""
                INSERT INTO fiscal.notas (
                    ch_nfe, numero, serie, modelo, dh_emissao, natureza_op, tp_nf,
                    emit_cnpj, emit_nome, dest_cnpj_cpf, dest_nome, dest_uf,
                    valor_produtos, valor_desc, valor_nf, valor_difal,
                    n_protocolo, dh_recbto, c_stat,
                    info_complementar, xml_raw,
                    uploaded_by, status_vinculo, obra_projeto_id
                ) VALUES (
                    %(ch_nfe)s, %(numero)s, %(serie)s, %(modelo)s, %(dh_emissao)s, %(natureza_op)s, %(tp_nf)s,
                    %(emit_cnpj)s, %(emit_nome)s, %(dest_cnpj_cpf)s, %(dest_nome)s, %(dest_uf)s,
                    %(valor_produtos)s, %(valor_desc)s, %(valor_nf)s, %(valor_difal)s,
                    %(n_protocolo)s, %(dh_recbto)s, %(c_stat)s,
                    %(info_complementar)s, %(xml_raw)s,
                    %(uploaded_by)s, 'pendente', NULL
                )
            """, {**parsed, "xml_raw": raw.decode("utf-8", errors="replace"), "uploaded_by": uploaded_by})

            # Itens
            for it in parsed["itens"]:
                cur.execute("""
                    INSERT INTO fiscal.notas_itens (ch_nfe, n_item, c_prod, x_prod, ncm, cfop, u_com, q_com, v_un_com, v_prod)
                    VALUES (%(ch_nfe)s, %(n_item)s, %(c_prod)s, %(x_prod)s, %(ncm)s, %(cfop)s, %(u_com)s, %(q_com)s, %(v_un_com)s, %(v_prod)s)
                """, {**it, "ch_nfe": ch})

            # Duplicatas
            for d in parsed["duplicatas"]:
                cur.execute("""
                    INSERT INTO fiscal.notas_duplicatas (ch_nfe, n_dup, dh_venc, valor)
                    VALUES (%(ch_nfe)s, %(n_dup)s, %(dh_venc)s, %(valor)s)
                """, {**d, "ch_nfe": ch})

            # Auditoria — json.dumps garante JSON válido (repr() gera aspas simples inválidas)
            cur.execute(
                "INSERT INTO fiscal.notas_eventos (ch_nfe, tipo, ator, dados) VALUES (%s, 'upload', %s, %s::jsonb)",
                (ch, uploaded_by, json.dumps({"filename": f.filename or ""})),
            )

            results.append(UploadResp(
                ch_nfe=ch, status="criado",
                numero=parsed["numero"], serie=parsed["serie"],
                dest_nome=parsed["dest_nome"], valor_nf=parsed["valor_nf"],
                obra_projeto_id=None, status_vinculo="pendente",
                sugestao_projeto=sugestao,
            ))

    return results


class VincularReq(BaseModel):
    obra_projeto_id: str        # UUID do gestao.projetos
    ator: str                    # email do fiscal


@router.post("/notas/{ch_nfe}/vincular")
def fiscal_vincular(ch_nfe: str, req: VincularReq):
    """Vincula uma NF (pendente ou já vinculada) a um projeto do gestão."""
    if not re.fullmatch(r"\d{44}", ch_nfe):
        raise HTTPException(status_code=400, detail="ch_nfe deve ter 44 dígitos")

    with conn() as c, c.cursor() as cur:
        # Valida projeto existe
        cur.execute("SELECT id, cliente FROM gestao.projetos WHERE id = %s", (req.obra_projeto_id,))
        projeto = cur.fetchone()
        if not projeto:
            raise HTTPException(status_code=404, detail="Projeto não encontrado em gestao.projetos")

        # Detecta se é revínculo (obra já era outra) pra logar no evento
        cur.execute("SELECT obra_projeto_id, status_vinculo FROM fiscal.notas WHERE ch_nfe = %s", (ch_nfe,))
        atual = cur.fetchone()
        if not atual:
            raise HTTPException(status_code=404, detail="NF não encontrada")
        tipo_evento = "revincular" if atual["obra_projeto_id"] and str(atual["obra_projeto_id"]) != req.obra_projeto_id else "vincular"

        cur.execute("""
            UPDATE fiscal.notas
               SET obra_projeto_id = %s, status_vinculo = 'vinculado',
                   vinculado_por = %s, vinculado_em = NOW()
             WHERE ch_nfe = %s
        """, (req.obra_projeto_id, req.ator, ch_nfe))

        cur.execute(
            "INSERT INTO fiscal.notas_eventos (ch_nfe, tipo, ator, dados) VALUES (%s, %s, %s, %s::jsonb)",
            (ch_nfe, tipo_evento, req.ator,
             json.dumps({"obra_projeto_id": req.obra_projeto_id, "cliente": projeto["cliente"]})),
        )

    return {"ok": True, "ch_nfe": ch_nfe, "obra_projeto_id": req.obra_projeto_id, "cliente": projeto["cliente"]}


@router.get("/notas")
def fiscal_notas(
    status: str | None = None,          # 'vinculado' | 'pendente' | None (todos)
    obra_projeto_id: str | None = None,
    limit: int = 200,
):
    """Lista notas com filtros. Sidebar da UI usa status='pendente' pro badge de contador."""
    where = []
    params: list[Any] = []
    if status in ("vinculado", "pendente"):
        where.append("n.status_vinculo = %s")
        params.append(status)
    if obra_projeto_id:
        where.append("n.obra_projeto_id = %s")
        params.append(obra_projeto_id)
    where_sql = ("WHERE " + " AND ".join(where)) if where else ""

    with conn() as c, c.cursor() as cur:
        cur.execute(f"""
            SELECT n.ch_nfe, n.numero, n.serie, n.dh_emissao, n.dest_nome, n.dest_cnpj_cpf,
                   n.valor_nf, n.status_vinculo, n.obra_projeto_id,
                   p.cliente AS projeto_cliente, p.endereco AS projeto_endereco,
                   n.emit_nome, n.uploaded_at, n.uploaded_by
              FROM fiscal.notas n
              LEFT JOIN gestao.projetos p ON p.id = n.obra_projeto_id
              {where_sql}
             ORDER BY n.uploaded_at DESC
             LIMIT %s
        """, [*params, limit])
        rows = cur.fetchall()

    # Serializa datas e UUIDs
    for r in rows:
        for k in ("dh_emissao", "uploaded_at"):
            if r.get(k):
                r[k] = r[k].isoformat()
        if r.get("obra_projeto_id"):
            r["obra_projeto_id"] = str(r["obra_projeto_id"])
        if r.get("valor_nf") is not None:
            r["valor_nf"] = float(r["valor_nf"])
    return {"notas": rows}


@router.get("/notas-por-core-obra/{core_obra_id}")
def fiscal_notas_por_core_obra(core_obra_id: str):
    """Resolve core.obras.id → gestao.projetos.id → fiscal.notas.

    Vínculo entre schemas segue o padrão do _center_fin_ctx (linha ~6020 do main.py):
      1. Preferência: gestao.projetos.meta->>'core_obra_id' == core_obra_id
      2. Fallback: match único por nome do cliente entre gestao.projetos.cliente
         e o nome da obra no Cloud (via _sb_core Management/PostgREST client)
    Se nenhum casa, retorna lista vazia (não é erro — obra pode não ter NF ainda).

    Usado pela aba "NF-e" do ObraDetalhe do Core (parket-core frontend).
    Retorna também o resumo agregado (qtd, valor total) pra badge.
    """
    if not re.fullmatch(r"[0-9a-f-]{36}", core_obra_id):
        raise HTTPException(status_code=400, detail="core_obra_id deve ser UUID")

    with conn() as c, c.cursor() as cur:
        # Tenta match direto por meta.core_obra_id
        cur.execute(
            "SELECT id FROM gestao.projetos WHERE meta->>'core_obra_id' = %s LIMIT 1",
            (core_obra_id,),
        )
        row = cur.fetchone()
        projeto_id = row["id"] if row else None

        # Fallback: pega nome da obra no Cloud e faz match único em gestao.projetos.cliente
        if not projeto_id:
            try:
                from .main import _sb_core  # helper existente pra consultar core.* na Cloud
                with _sb_core() as sb:
                    r = sb.get("/obras", params={"select": "nome", "id": f"eq.{core_obra_id}", "limit": "1"})
                    if r.status_code < 400 and r.json():
                        nome = re.sub(r"\s*\(SIMULACAO\)\s*$", "", (r.json()[0].get("nome") or "").strip())
                        if nome:
                            cur.execute(
                                "SELECT id FROM gestao.projetos WHERE cliente = %s LIMIT 2",
                                (nome,),
                            )
                            matches = cur.fetchall()
                            if len(matches) == 1:
                                projeto_id = matches[0]["id"]
            except Exception as e:
                log.warning("fallback core obra name lookup falhou: %s", e)

        if not projeto_id:
            return {"projeto_id": None, "notas": [], "total_valor": 0.0, "total_qtd": 0}

        cur.execute("""
            SELECT ch_nfe, numero, serie, dh_emissao, dest_nome, dest_cnpj_cpf,
                   valor_nf, status_vinculo, emit_nome, uploaded_at
              FROM fiscal.notas
             WHERE obra_projeto_id = %s
             ORDER BY dh_emissao DESC
        """, (projeto_id,))
        rows = cur.fetchall()

    # Serialização
    total_valor = 0.0
    for r in rows:
        for k in ("dh_emissao", "uploaded_at"):
            if r.get(k):
                r[k] = r[k].isoformat()
        if r.get("valor_nf") is not None:
            r["valor_nf"] = float(r["valor_nf"])
            total_valor += r["valor_nf"]
    return {
        "projeto_id": str(projeto_id),
        "notas": rows,
        "total_valor": total_valor,
        "total_qtd": len(rows),
    }


@router.get("/center/{token}/notas")
def fiscal_center_notas(token: str):
    """Endpoint PÚBLICO (por token) usado pela Central do Cliente.

    Reusa _center_fin_ctx do main.py — mesmo helper que resolve o token do
    center pra gestao.projetos + core.obras — pra listar as NFs vinculadas
    ao projeto do cliente. Só retorna vinculadas (não pendentes) porque o
    cliente não precisa ver o inventário interno do Fiscal.

    Sem auth extra: o próprio token do center já é o segredo (link mailer).
    Retorna 404 se token inválido/revogado (via _center_fin_ctx).
    """
    from .main import _center_fin_ctx
    ctx = _center_fin_ctx(token)
    projeto_id = ctx["id"]

    with conn() as c, c.cursor() as cur:
        cur.execute("""
            SELECT ch_nfe, numero, serie, dh_emissao, natureza_op,
                   valor_nf, emit_nome
              FROM fiscal.notas
             WHERE obra_projeto_id = %s AND status_vinculo = 'vinculado'
             ORDER BY dh_emissao DESC
        """, (projeto_id,))
        rows = cur.fetchall()

    total_valor = 0.0
    for r in rows:
        if r.get("dh_emissao"):
            r["dh_emissao"] = r["dh_emissao"].isoformat()
        if r.get("valor_nf") is not None:
            r["valor_nf"] = float(r["valor_nf"])
            total_valor += r["valor_nf"]
    return {
        "projeto_id": str(projeto_id),
        "cliente": ctx["cliente"],
        "notas": rows,
        "total_valor": total_valor,
        "total_qtd": len(rows),
    }


@router.get("/notas/{ch_nfe}/xml")
def fiscal_xml(ch_nfe: str):
    """Retorna o XML íntegro pra baixar (fiscal reenvia pro cliente)."""
    from fastapi.responses import Response
    with conn() as c, c.cursor() as cur:
        cur.execute("SELECT xml_raw FROM fiscal.notas WHERE ch_nfe = %s", (ch_nfe,))
        r = cur.fetchone()
    if not r:
        raise HTTPException(status_code=404, detail="NF não encontrada")
    return Response(
        content=r["xml_raw"],
        media_type="application/xml",
        headers={"Content-Disposition": f'attachment; filename="{ch_nfe}.xml"'},
    )


@router.get("/notas/{ch_nfe}/pdf")
def fiscal_pdf(ch_nfe: str):
    """Gera DANFE (PDF padrão SEFAZ) a partir do xml_raw armazenado.

    Usa brazilfiscalreport (fpdf2 por trás) — mesma biblioteca do padrão da NFe.
    Renderização é rápida (~5KB PDF em <100ms) então gera on-demand em vez de
    cachear em Storage. Se performance virar problema com escala, cachear.
    """
    from fastapi.responses import Response
    from brazilfiscalreport.danfe import Danfe

    with conn() as c, c.cursor() as cur:
        cur.execute("SELECT xml_raw, numero, serie FROM fiscal.notas WHERE ch_nfe = %s", (ch_nfe,))
        r = cur.fetchone()
    if not r:
        raise HTTPException(status_code=404, detail="NF não encontrada")

    try:
        danfe = Danfe(r["xml_raw"].encode("utf-8"))
        # brazilfiscalreport 1.0.x: .output() sem args retorna bytearray
        pdf_bytes = bytes(danfe.output())
    except Exception as e:
        log.exception("falha gerando DANFE pra %s", ch_nfe)
        raise HTTPException(status_code=500, detail=f"Falha ao gerar DANFE: {e}")

    filename = f"NFe-{r['numero']}-serie{r['serie']}.pdf"
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
