"""parket-gestao — Custos de Terceiros.

O QUE FAZ:
  Controla o gasto de um prestador terceirizado (instalador, montador,
  tecnico) que se desloca ate uma obra, do lancamento pelo secretario ate
  o pagamento pelo financeiro.

  rascunho -> enviado -> em_analise -> aprovado -> pago
                  \\-> devolvido -> enviado

TABELAS (schema gestao, Postgres LOCAL, migracao 026):
  custo_politica    politica de reembolso versionada por vigencia
  custo_lancamento  cabecalho: obra + prestador + status + totais
  custo_despesa     item a item, com anexo, alertas e glosa
  custo_historico   trilha de status, append-only (trigger bloqueia UPDATE)

O TERCEIRO NAO TEM TABELA PROPRIA. E public.prestadores no Supabase Cloud
(migracao 027 completou o cadastro com tipo_pessoa/cnpj/dados bancarios).
Duplicar viraria dois cadastros do mesmo sujeito divergindo em telefone e
pix. Por isso prestador_id aqui e uuid solto, sem FK: e outro banco.

DINHEIRO EM CENTAVOS (int) do banco ate a resposta HTTP. O frontend
formata; nunca calcula. Toda conta de despesa mora em _calcular().

PERMISSAO (nao ha role "financeiro" em user_profiles, o papel vem do
dept_permissions):
  admin       role in (superadmin, admin)          -> politica, ve tudo
  financeiro  dept_permissions.financeiro=manage   -> aprova, glosa, paga
  secretario  qualquer login do gestao             -> lanca nas obras dele

ISOLAMENTO: modulo com router e cliente HTTP proprios, sem importar
main.py (import circular). Mesmo padrao de fiscal.py e anteprojeto.py.
"""
import csv
import io
import json
import logging
import os
import re
import unicodedata
from datetime import date, datetime, timedelta
from decimal import Decimal, ROUND_HALF_UP

import httpx
from fastapi import APIRouter, File, Header, HTTPException, Query, UploadFile
from fastapi.responses import Response
from pydantic import BaseModel, Field

from .db import conn

log = logging.getLogger("gestao.custos")

router = APIRouter(prefix="/api/custos", tags=["custos"])

SUPABASE_URL = os.environ.get("SUPABASE_URL", "https://hbxpilrxmitvzebluoom.supabase.co")
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_KEY", "")
BUCKET = "obra-media"

# Empresa unica do grupo no Core (todo core.lancamentos existente usa esta).
CORE_EMPRESA_ID = "11111111-1111-1111-1111-111111111111"
# Plano de contas do write-back. Reembolso puro de viagem cai em CUSTO DE
# VIAGEM; se o lancamento tem NF ou RPA, o repasse e servico de terceiro.
PLANO_CUSTO_VIAGEM = "329eb4c0-241b-4e53-ad77-e00a9a16afbe"   # 1020
PLANO_SERVICOS_TERCEIROS = "aa1bdb69-f67c-4183-ac26-7946aac68a03"  # 1016


# ═══════════════════════════════════════════════════════════════════
# Dominio
# ═══════════════════════════════════════════════════════════════════

# A categoria e derivada da subcategoria no backend: o front nao consegue
# mandar um par incoerente (ex: hospedagem/deslocamento).
SUBCAT_CATEGORIA = {
    "combustivel_km": "deslocamento",
    "reembolso_km": "deslocamento",
    "abastecimento": "deslocamento",
    "pedagio": "deslocamento",
    "passagem": "deslocamento",
    "aluguel_carro": "deslocamento",
    "uber": "deslocamento",
    "taxi": "deslocamento",
    "estacionamento": "deslocamento",
    "hospedagem": "estadia",
    "alimentacao": "estadia",
    "diaria_fechada": "estadia",
    "nf": "documentacao",
    "rpa": "documentacao",
}

# Transicoes validas + quem pode disparar cada uma.
#   dono       = quem criou o lancamento (ou gestor da obra), e o admin
#   financeiro = dept_permissions.financeiro = manage, e o admin
TRANSICOES = {
    ("rascunho", "enviado"): "dono",
    ("devolvido", "enviado"): "dono",
    ("enviado", "em_analise"): "financeiro",
    ("enviado", "devolvido"): "financeiro",
    ("em_analise", "aprovado"): "financeiro",
    ("em_analise", "devolvido"): "financeiro",
    ("aprovado", "pago"): "financeiro",
}

# Depois de enviado o secretario nao mexe mais no conteudo.
STATUS_EDITAVEIS = ("rascunho", "devolvido")


# ═══════════════════════════════════════════════════════════════════
# Identidade e papel
# ═══════════════════════════════════════════════════════════════════

def _norm_email(x: str | None) -> str | None:
    """X-User-Email chega do fetch wrapper do frontend (api.ts)."""
    e = (x or "").strip().lower()
    return e or None


def _perfil(x_user_email: str | None) -> dict:
    """Resolve quem esta chamando e o que ele pode fazer.

    role e dept_permissions vivem no Postgres LOCAL (public.user_profiles),
    mesma fonte que o gate de acessos do main.py usa."""
    email = _norm_email(x_user_email)
    if not email:
        raise HTTPException(401, "identifique-se para usar Custos de Terceiros")
    with conn() as c, c.cursor() as cur:
        cur.execute(
            "SELECT email, full_name, role, dept_permissions "
            "FROM public.user_profiles WHERE lower(email)=%s LIMIT 1", (email,))
        row = cur.fetchone()
    perms = (row or {}).get("dept_permissions")
    # dept_permissions e jsonb e ja veio como dict/list; so o dict interessa.
    perms = perms if isinstance(perms, dict) else {}
    role = (row or {}).get("role") or "viewer"
    return {
        "email": email,
        "nome": (row or {}).get("full_name") or email,
        "role": role,
        "admin": role in ("superadmin", "admin"),
        # manage aprova e paga; view so enxerga a fila.
        "financeiro": role in ("superadmin", "admin") or perms.get("financeiro") == "manage",
        "financeiro_ve": role in ("superadmin", "admin") or perms.get("financeiro") in ("view", "manage"),
    }


def _so_admin(p: dict) -> None:
    if not p["admin"]:
        raise HTTPException(403, "so o admin edita a politica de reembolso")


def _so_financeiro(p: dict) -> None:
    if not p["financeiro"]:
        raise HTTPException(403, "acao exclusiva do financeiro")


# ═══════════════════════════════════════════════════════════════════
# Cloud (PostgREST + Storage)
# ═══════════════════════════════════════════════════════════════════

def _sb(schema: str = "public") -> httpx.Client:
    """Cliente PostgREST do Cloud. schema='core' pro financeiro."""
    if not SUPABASE_KEY:
        raise HTTPException(500, "SUPABASE_SERVICE_KEY nao configurada no backend do gestao")
    h = {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}",
        "Content-Type": "application/json",
        "User-Agent": "parket-gestao/1.0",
    }
    if schema != "public":
        h["Accept-Profile"] = schema
        h["Content-Profile"] = schema
    return httpx.Client(base_url=f"{SUPABASE_URL}/rest/v1", headers=h, timeout=20.0)


def _sb_ok(r: httpx.Response, ctx: str) -> None:
    if r.status_code >= 400:
        log.error("custos %s: %s %s", ctx, r.status_code, r.text[:400])
        raise HTTPException(502, f"Cloud ({ctx}): {r.text[:300]}")


def _slug(nome: str) -> str:
    """Nome de arquivo seguro pro path do Storage."""
    s = unicodedata.normalize("NFKD", nome or "anexo").encode("ascii", "ignore").decode()
    s = re.sub(r"[^A-Za-z0-9._-]+", "-", s).strip("-")
    return (s or "anexo")[:80]


async def _upload(path: str, data: bytes, content_type: str) -> str:
    async with httpx.AsyncClient(timeout=60.0) as cli:
        r = await cli.post(
            f"{SUPABASE_URL}/storage/v1/object/{BUCKET}/{path}",
            content=data,
            headers={"apikey": SUPABASE_KEY,
                     "Authorization": f"Bearer {SUPABASE_KEY}",
                     "Content-Type": content_type or "application/octet-stream",
                     "x-upsert": "true"})
    if r.status_code >= 400:
        raise HTTPException(502, f"upload falhou: {r.text[:300]}")
    return f"{SUPABASE_URL}/storage/v1/object/public/{BUCKET}/{path}"


# ═══════════════════════════════════════════════════════════════════
# Calculo (centavos, tudo aqui; o front so exibe)
# ═══════════════════════════════════════════════════════════════════

def _dec(v) -> Decimal:
    try:
        return Decimal(str(v if v is not None else 0))
    except Exception:
        return Decimal(0)


def _cent(v: Decimal) -> int:
    """Fecha em centavo inteiro. HALF_UP porque e dinheiro, nao estatistica."""
    return int(v.quantize(Decimal("1"), rounding=ROUND_HALF_UP))


def _dias(a, b) -> int | None:
    """Diferenca em dias entre duas datas ISO; None se alguma faltar."""
    try:
        d1 = date.fromisoformat(str(a)[:10])
        d2 = date.fromisoformat(str(b)[:10])
    except Exception:
        return None
    return (d2 - d1).days


def _calcular(sub: str, campos: dict, quantidade, valor_unitario_cent, pol: dict) -> tuple:
    """Devolve (quantidade, valor_unitario_cent, valor_total_cent).

    Tres subcategorias derivam a quantidade dos campos especificos; o resto
    e quantidade x valor unitario direto."""
    campos = campos or {}
    qtd = _dec(quantidade if quantidade is not None else 1)
    vu = int(valor_unitario_cent or 0)

    if sub == "combustivel_km":
        # (ida + volta) / consumo = litros; litros x preco do litro.
        km = _dec(campos.get("km_ida")) + _dec(campos.get("km_volta"))
        consumo = _dec(campos.get("consumo_km_l"))
        if consumo <= 0:
            raise HTTPException(400, "combustivel por km exige consumo_km_l maior que zero")
        vu = int(campos.get("preco_litro_cent") or 0)
        if vu <= 0:
            raise HTTPException(400, "combustivel por km exige preco_litro_cent")
        # 3 casas: e o que custo_despesa.quantidade numeric(12,3) guarda.
        qtd = (km / consumo).quantize(Decimal("0.001"), rounding=ROUND_HALF_UP)
        return qtd, vu, _cent(qtd * _dec(vu))

    if sub == "reembolso_km":
        # Valor por km sai da politica vigente, nao do que o usuario digitar.
        km = _dec(campos.get("km_ida")) + _dec(campos.get("km_volta"))
        if km <= 0:
            raise HTTPException(400, "reembolso por km exige km_ida ou km_volta")
        vu = int(pol.get("km_valor_cent") or 0)
        qtd = km.quantize(Decimal("0.001"), rounding=ROUND_HALF_UP)
        return qtd, vu, _cent(qtd * _dec(vu))

    if sub == "hospedagem":
        # Noites = check_out - check_in. Diaria digitada e o unitario.
        n = _dias(campos.get("check_in"), campos.get("check_out"))
        if n is None:
            raise HTTPException(400, "hospedagem exige check_in e check_out")
        if n <= 0:
            raise HTTPException(400, "check_out precisa ser depois do check_in")
        qtd = Decimal(n)
        return qtd, vu, _cent(qtd * _dec(vu))

    if qtd <= 0:
        raise HTTPException(400, "quantidade precisa ser maior que zero")
    return qtd, vu, _cent(qtd * _dec(vu))


# ═══════════════════════════════════════════════════════════════════
# Alertas — sinalizam, NUNCA bloqueiam
# ═══════════════════════════════════════════════════════════════════

def _alertas(d: dict, lanc: dict, pol: dict, irmas: list) -> list:
    a = []
    total = int(d.get("valor_total_cent") or 0)
    vu = int(d.get("valor_unitario_cent") or 0)
    sub = d.get("subcategoria")

    teto = None
    if sub == "hospedagem":
        teto = int(pol.get("hospedagem_teto_noite_cent") or 0)
        base, unidade = vu, "a noite"
    elif sub == "alimentacao":
        teto = int(pol.get("refeicao_teto_cent") or 0)
        base, unidade = vu, "por refeicao"
    elif sub == "diaria_fechada":
        teto = int(pol.get("diaria_fechada_cent") or 0)
        base, unidade = vu, "por dia"
    if teto and teto > 0 and base > teto:
        a.append({"codigo": "acima_teto", "nivel": "atencao",
                  "mensagem": f"R$ {base/100:.2f} {unidade} passa do teto de R$ {teto/100:.2f} da politica"})

    minimo = int(pol.get("anexo_obrigatorio_acima_cent") or 0)
    if minimo > 0 and total >= minimo and not d.get("anexo_url"):
        a.append({"codigo": "sem_anexo", "nivel": "atencao",
                  "mensagem": f"acima de R$ {minimo/100:.2f} a politica pede comprovante anexado"})

    dt = d.get("data")
    ini, fim = lanc.get("data_ida"), lanc.get("data_volta")
    if dt and ((ini and str(dt)[:10] < str(ini)[:10]) or (fim and str(dt)[:10] > str(fim)[:10])):
        a.append({"codigo": "data_fora_periodo", "nivel": "atencao",
                  "mensagem": "data da despesa fora do periodo do lancamento"})

    # Mesmo valor + mesma data + mesma subcategoria em outra linha do mesmo
    # lancamento: quase sempre foto lancada duas vezes.
    for o in irmas:
        if str(o.get("id")) == str(d.get("id")):
            continue
        if (o.get("subcategoria") == sub
                and str(o.get("data") or "")[:10] == str(dt or "")[:10]
                and int(o.get("valor_total_cent") or 0) == total and total > 0):
            a.append({"codigo": "possivel_duplicidade", "nivel": "atencao",
                      "mensagem": "ja existe outra despesa igual (mesma data, categoria e valor)"})
            break
    return a


def _reavaliar(cur, lid: str) -> None:
    """Recalcula alertas de TODAS as despesas do lancamento e materializa os
    totais do cabecalho. Roda a cada gravacao porque alerta de duplicidade e
    de periodo dependem das linhas vizinhas e das datas do cabecalho."""
    cur.execute("SELECT id::text AS id, data_ida::text AS data_ida, data_volta::text AS data_volta, "
                "adiantamento_cent FROM gestao.custo_lancamento WHERE id::text=%s", (lid,))
    lanc = cur.fetchone()
    if not lanc:
        return

    cur.execute("""SELECT d.id::text AS id, d.subcategoria, d.data::text AS data,
                          d.valor_unitario_cent, d.valor_total_cent, d.anexo_url,
                          d.status, d.politica_id::text AS politica_id
                     FROM gestao.custo_despesa d WHERE d.lancamento_id::text=%s
                    ORDER BY d.created_at""", (lid,))
    despesas = cur.fetchall()

    # Cada despesa usa a versao de politica que ela congelou; o cache evita
    # reler a mesma versao N vezes.
    cache: dict = {}
    for d in despesas:
        pid = d.get("politica_id")
        if pid not in cache:
            cur.execute("SELECT * FROM gestao.custo_politica WHERE id::text=%s", (pid,))
            cache[pid] = cur.fetchone() or {}
        al = _alertas(d, lanc, cache[pid], despesas)
        cur.execute("UPDATE gestao.custo_despesa SET alertas=%s WHERE id::text=%s",
                    (json.dumps(al), d["id"]))

    lancado = sum(int(d.get("valor_total_cent") or 0) for d in despesas)
    aprovado = sum(int(d.get("valor_total_cent") or 0) for d in despesas if d.get("status") == "aprovado")
    adiant = int(lanc.get("adiantamento_cent") or 0)
    cur.execute("""UPDATE gestao.custo_lancamento
                      SET total_lancado_cent=%s, total_aprovado_cent=%s, saldo_cent=%s
                    WHERE id::text=%s""",
                (lancado, aprovado, max(0, aprovado - adiant), lid))


def _checar_diaria(cur, lid: str) -> None:
    """UNICA regra que bloqueia de fato: diaria fechada ja embute alimentacao,
    entao as duas juntas no mesmo lancamento seriam pagamento em dobro."""
    cur.execute("""SELECT count(*) FILTER (WHERE subcategoria='diaria_fechada') AS d,
                          count(*) FILTER (WHERE subcategoria='alimentacao')   AS a
                     FROM gestao.custo_despesa WHERE lancamento_id::text=%s""", (lid,))
    r = cur.fetchone() or {}
    if int(r.get("d") or 0) > 0 and int(r.get("a") or 0) > 0:
        raise HTTPException(409, "diaria fechada ja cobre alimentacao: nao lance as duas "
                                 "no mesmo lancamento, escolha uma das formas")


# ═══════════════════════════════════════════════════════════════════
# Leitura de apoio
# ═══════════════════════════════════════════════════════════════════

def _politica_vigente(cur) -> dict:
    cur.execute("SELECT * FROM gestao.custo_politica WHERE vigencia_fim IS NULL "
                "ORDER BY vigencia_inicio DESC LIMIT 1")
    p = cur.fetchone()
    if not p:
        raise HTTPException(500, "nenhuma politica de reembolso em vigencia")
    return p


def _lancamento(cur, lid: str) -> dict:
    cur.execute("""SELECT l.*, l.id::text AS id, l.projeto_id::text AS projeto_id,
                          l.prestador_id::text AS prestador_id,
                          l.politica_id::text AS politica_id,
                          p.cliente, p.endereco, p.numero_proposta,
                          p.card_id::text AS card_id, p.gestor_email
                     FROM gestao.custo_lancamento l
                     JOIN gestao.projetos p ON p.id = l.projeto_id
                    WHERE l.id::text = %s""", (lid,))
    row = cur.fetchone()
    if not row:
        raise HTTPException(404, "lancamento nao encontrado")
    return row


def _pode_ver(p: dict, lanc: dict) -> bool:
    if p["admin"] or p["financeiro_ve"]:
        return True
    return p["email"] in (
        (lanc.get("criado_por") or "").lower(),
        (lanc.get("gestor_email") or "").lower(),
    )


def _e_dono(p: dict, lanc: dict) -> bool:
    if p["admin"]:
        return True
    return p["email"] in (
        (lanc.get("criado_por") or "").lower(),
        (lanc.get("gestor_email") or "").lower(),
    )


def _hist(cur, lid: str, de: str | None, para: str, p: dict, obs: str | None) -> None:
    cur.execute("""INSERT INTO gestao.custo_historico
                     (lancamento_id, de, para, usuario_email, usuario_nome, observacao)
                   VALUES (%s,%s,%s,%s,%s,%s)""",
                (lid, de, para, p["email"], p["nome"], obs))


def _resolver_core(card_id: str | None) -> dict:
    """Snapshot do Core pela obra. O vinculo e gestao.projetos.card_id =
    core.obras.space_id. Falha silenciosa: sem centro de custo o lancamento
    nasce igual, a pendencia aparece na tela e so trava na hora de pagar."""
    if not card_id:
        return {}
    try:
        with _sb("core") as sb:
            r = sb.get("/obras", params={"select": "id,centro_custo_id,nome",
                                         "space_id": f"eq.{card_id}", "limit": "1"})
            if r.status_code >= 400:
                return {}
            obras = r.json() or []
            if not obras:
                return {}
            o = obras[0]
            nome = None
            if o.get("centro_custo_id"):
                rc = sb.get("/centros_custo", params={"select": "nome",
                                                      "id": f"eq.{o['centro_custo_id']}", "limit": "1"})
                if rc.status_code < 400 and (rc.json() or []):
                    nome = (rc.json()[0] or {}).get("nome")
            return {"core_obra_id": o.get("id"),
                    "centro_custo_id": o.get("centro_custo_id"),
                    "centro_custo_nome": nome}
    except Exception as e:
        log.warning("custos: core nao resolvido pro card %s: %s", card_id, e)
        return {}


def _prestador(pid: str) -> dict:
    with _sb() as sb:
        r = sb.get("/prestadores", params={
            "select": "id,nome,telefone,email,categoria,cpf,cnpj,tipo_pessoa,pix_chave,"
                      "banco,agencia,conta,conta_tipo,titular,titular_documento,ativo",
            "id": f"eq.{pid}", "limit": "1"})
    _sb_ok(r, "prestadores")
    itens = r.json() or []
    if not itens:
        raise HTTPException(404, "prestador nao encontrado no cadastro")
    return itens[0]


def _pendencias_prestador(pr: dict) -> list:
    """Ficha incompleta e PENDENCIA VISIVEL, nao erro: hoje nenhum dos 118
    prestadores tem documento cadastrado (ver 027). Travar o envio pararia o
    processo antes de comecar; o financeiro cobra na hora de pagar."""
    # Fiscal e CLT: o reembolso dele sai pela folha/RH, nao existe ficha
    # PF/PJ/MEI nem pix a cobrar. Nunca gerar pendencia de pagamento.
    if (pr.get("categoria") or "").strip().lower() == "fiscal":
        return []
    falta = []
    if not (pr.get("tipo_pessoa") or "").strip():
        falta.append("tipo de pessoa (PF, PJ ou MEI)")
    if not ((pr.get("cpf") or "").strip() or (pr.get("cnpj") or "").strip()):
        falta.append("CPF ou CNPJ")
    if not ((pr.get("pix_chave") or "").strip()
            or ((pr.get("banco") or "").strip() and (pr.get("conta") or "").strip())):
        falta.append("chave PIX ou dados bancarios")
    return falta


# ═══════════════════════════════════════════════════════════════════
# Politica de reembolso
# ═══════════════════════════════════════════════════════════════════

class PoliticaIn(BaseModel):
    vigencia_inicio: str | None = None
    km_valor_cent: int = 0
    hospedagem_teto_noite_cent: int = 0
    refeicao_teto_cent: int = 0
    diaria_fechada_cent: int = 0
    anexo_obrigatorio_acima_cent: int = 0
    observacao: str | None = None


@router.get("/politica")
def politica_vigente(x_user_email: str | None = Header(default=None)):
    p = _perfil(x_user_email)
    with conn() as c, c.cursor() as cur:
        pol = _politica_vigente(cur)
    pol["pode_editar"] = p["admin"]
    return pol


@router.get("/politica/historico")
def politica_historico(x_user_email: str | None = Header(default=None)):
    _perfil(x_user_email)
    with conn() as c, c.cursor() as cur:
        cur.execute("SELECT * FROM gestao.custo_politica ORDER BY vigencia_inicio DESC")
        return {"items": cur.fetchall()}


@router.post("/politica")
def politica_nova(body: PoliticaIn, x_user_email: str | None = Header(default=None)):
    """Reajuste = fechar a vigencia atual e abrir a proxima. Nunca UPDATE na
    politica corrente: as despesas ja lancadas apontam pra versao delas e o
    historico nao pode mudar de valor retroativamente."""
    p = _perfil(x_user_email)
    _so_admin(p)
    inicio = (body.vigencia_inicio or date.today().isoformat())[:10]
    try:
        d_inicio = date.fromisoformat(inicio)
    except Exception:
        raise HTTPException(400, "vigencia_inicio invalida")

    with conn() as c:
        with c.transaction(), c.cursor() as cur:
            atual = _politica_vigente(cur)
            if d_inicio <= date.fromisoformat(str(atual["vigencia_inicio"])[:10]):
                raise HTTPException(400, "a nova vigencia precisa comecar depois da atual")
            # O indice parcial so aceita uma vigencia aberta: fecha antes de abrir.
            cur.execute("UPDATE gestao.custo_politica SET vigencia_fim=%s WHERE id=%s",
                        (d_inicio - timedelta(days=1), atual["id"]))
            cur.execute("""INSERT INTO gestao.custo_politica
                             (vigencia_inicio, km_valor_cent, hospedagem_teto_noite_cent,
                              refeicao_teto_cent, diaria_fechada_cent,
                              anexo_obrigatorio_acima_cent, observacao, criado_por)
                           VALUES (%s,%s,%s,%s,%s,%s,%s,%s) RETURNING *""",
                        (d_inicio, body.km_valor_cent, body.hospedagem_teto_noite_cent,
                         body.refeicao_teto_cent, body.diaria_fechada_cent,
                         body.anexo_obrigatorio_acima_cent, body.observacao, p["email"]))
            nova = cur.fetchone()
    return nova


# ═══════════════════════════════════════════════════════════════════
# Memoria de lancamento
#
# A cada lancamento o sistema "aprende" os valores que se repetem (hotel,
# km, preco do litro...) e devolve como sugestao pro proximo. Nao existe
# cadastro novo: a fonte e o proprio historico de gestao.custo_despesa.
#
# Cada campo tem um ESCOPO, que diz de onde a memoria pode vir:
#   obra     = distancia/hotel sao propriedade do destino (mesma obra)
#   terceiro = consumo do carro e diaria negociada sao da pessoa
#   geral    = preco de mercado (litro da gasolina) vale de qualquer lugar
# A cadeia e percorrida na ordem: acha no escopo mais especifico, para.
# Campos de evento (datas, check-in/out, numero de NF, refeicao) NUNCA
# entram na memoria: mudam a cada lancamento.
# ═══════════════════════════════════════════════════════════════════

_MEMORIA_SPEC: dict[str, dict[str, list[str]]] = {
    "combustivel_km": {
        "campos.km_ida":          ["obra"],
        "campos.km_volta":        ["obra"],
        "campos.consumo_km_l":    ["terceiro", "geral"],
        "campos.preco_litro_cent": ["geral"],
    },
    "reembolso_km": {
        "campos.km_ida":   ["obra"],
        "campos.km_volta": ["obra"],
    },
    "abastecimento":  {"valor_unitario_cent": ["obra", "geral"]},
    # qtd de pracas de pedagio e propriedade da rota ate a obra
    "pedagio":        {"quantidade": ["obra"], "valor_unitario_cent": ["obra", "geral"]},
    "passagem":       {"campos.trecho": ["obra"], "valor_unitario_cent": ["obra", "geral"]},
    "aluguel_carro":  {"valor_unitario_cent": ["terceiro", "geral"]},
    "uber":           {"valor_unitario_cent": ["obra", "geral"]},
    "taxi":           {"valor_unitario_cent": ["obra", "geral"]},
    "estacionamento": {"valor_unitario_cent": ["obra", "geral"]},
    # descricao da hospedagem = nome do hotel, que e da regiao da obra
    "hospedagem":     {"descricao": ["obra"], "valor_unitario_cent": ["obra", "geral"]},
    "alimentacao":    {"valor_unitario_cent": ["geral"]},
    "diaria_fechada": {"valor_unitario_cent": ["terceiro", "obra", "geral"]},
}


def _memoria_valor(row: dict, chave: str):
    """Extrai o valor de uma chave da spec numa despesa. Vazio/zero = None
    (nao vira sugestao)."""
    if chave.startswith("campos."):
        v = (row.get("campos") or {}).get(chave[len("campos."):])
    elif chave == "quantidade":
        q = float(row.get("quantidade") or 0)
        v = q if q > 0 else None
    else:
        v = row.get(chave)
    if v in (None, "", 0):
        return None
    return v


@router.get("/memoria")
def memoria(projeto_id: str | None = Query(default=None),
            prestador_id: str | None = Query(default=None),
            x_user_email: str | None = Header(default=None)):
    """Sugestoes de preenchimento por subcategoria, aprendidas dos
    lancamentos anteriores. Glosado fica de fora: valor recusado pelo
    financeiro nao pode virar sugestao."""
    _perfil(x_user_email)
    with conn() as c, c.cursor() as cur:
        cur.execute("""
            SELECT d.subcategoria, d.descricao, d.quantidade,
                   d.valor_unitario_cent, d.campos,
                   l.projeto_id::text AS projeto_id,
                   l.prestador_id::text AS prestador_id
              FROM gestao.custo_despesa d
              JOIN gestao.custo_lancamento l ON l.id = d.lancamento_id
             WHERE d.status <> 'glosado'
             ORDER BY d.created_at DESC
             LIMIT 800
        """)
        rows = cur.fetchall()

    # rows vem do mais novo pro mais velho: o primeiro achado em cada
    # (subcategoria, campo, escopo) e a memoria mais fresca daquele escopo.
    achado: dict[tuple, object] = {}
    for r in rows:
        spec = _MEMORIA_SPEC.get(r["subcategoria"])
        if not spec:
            continue
        for chave, escopos in spec.items():
            v = _memoria_valor(r, chave)
            if v is None:
                continue
            for esc in escopos:
                if esc == "obra" and not (projeto_id and r["projeto_id"] == projeto_id):
                    continue
                if esc == "terceiro" and not (prestador_id and r["prestador_id"] == prestador_id):
                    continue
                achado.setdefault((r["subcategoria"], chave, esc), v)

    # Resolve a cadeia de escopos na ordem declarada na spec
    sugestoes: dict[str, dict] = {}
    for sub, spec in _MEMORIA_SPEC.items():
        s: dict = {}
        for chave, escopos in spec.items():
            for esc in escopos:
                v = achado.get((sub, chave, esc))
                if v is None:
                    continue
                if chave.startswith("campos."):
                    s.setdefault("campos", {})[chave[len("campos."):]] = v
                else:
                    s[chave] = v
                break
        if s:
            sugestoes[sub] = s
    return {"sugestoes": sugestoes}


# ═══════════════════════════════════════════════════════════════════
# Prestadores (cadastro no Cloud)
# ═══════════════════════════════════════════════════════════════════

def _sync_fiscais_como_prestadores(itens: list) -> list:
    """Fiscal tambem viaja e gera custo. O cadastro dele vive em
    public.fiscal_equipe, que NAO tem campos de pagamento; a ficha que o
    financeiro usa e a de public.prestadores (categoria Fiscal). Aqui todo
    fiscal ativo sem ficha ganha uma automaticamente, casando por nome
    normalizado. So roda na listagem completa (sem busca), senao um fiscal
    fora do filtro pareceria ausente e seria recriado duplicado."""
    try:
        with _sb() as sb:
            rf = sb.get("/fiscal_equipe", params={
                "select": "id,nome,telefone,email", "ativo": "eq.true"})
        if rf.status_code >= 400:
            return itens
        existentes = {(it.get("nome") or "").strip().lower() for it in itens}
        novos = []
        for f in rf.json() or []:
            nome = (f.get("nome") or "").strip()
            if nome and nome.lower() not in existentes:
                novos.append({"nome": nome, "telefone": f.get("telefone"),
                              "email": f.get("email"), "categoria": "Fiscal",
                              "ativo": True})
        if novos:
            with _sb() as sb:
                rn = sb.post("/prestadores", json=novos,
                             headers={"Prefer": "return=representation"})
            if rn.status_code < 400:
                itens = itens + (rn.json() or [])
                itens.sort(key=lambda x: (x.get("nome") or "").lower())
                log.info("custos: %d fiscal(is) ganharam ficha em prestadores",
                         len(novos))
    except Exception as e:
        log.warning("custos: sync fiscais->prestadores falhou: %s", e)
    return itens


@router.get("/prestadores")
def prestadores(busca: str | None = Query(default=None),
                x_user_email: str | None = Header(default=None)):
    _perfil(x_user_email)
    params = {"select": "id,nome,telefone,categoria,cpf,cnpj,tipo_pessoa,pix_chave,"
                        "banco,agencia,conta,conta_tipo,titular,ativo",
              "ativo": "eq.true", "order": "nome.asc", "limit": "300"}
    if busca:
        params["nome"] = f"ilike.*{busca}*"
    with _sb() as sb:
        r = sb.get("/prestadores", params=params)
    _sb_ok(r, "prestadores")
    itens = r.json() or []
    if not busca:
        itens = _sync_fiscais_como_prestadores(itens)
    for it in itens:
        it["pendencias"] = _pendencias_prestador(it)
    return {"items": itens}


@router.get("/prestadores/{pid}")
def prestador_detalhe(pid: str, x_user_email: str | None = Header(default=None)):
    _perfil(x_user_email)
    pr = _prestador(pid)
    pr["pendencias"] = _pendencias_prestador(pr)
    return pr


class PrestadorPatch(BaseModel):
    """Dados de pagamento da ficha do terceiro. Todos opcionais: o modal do
    lancamento manda so o que o secretario preencheu."""
    tipo_pessoa: str | None = None
    cpf: str | None = None
    cnpj: str | None = None
    pix_chave: str | None = None
    banco: str | None = None
    agencia: str | None = None
    conta: str | None = None
    conta_tipo: str | None = None
    titular: str | None = None
    titular_documento: str | None = None
    telefone: str | None = None


@router.patch("/prestadores/{pid}")
def prestador_patch(pid: str, body: PrestadorPatch,
                    x_user_email: str | None = Header(default=None)):
    """Grava dados de pagamento em public.prestadores no Cloud. E o mesmo
    cadastro que o /equipes usa: preencher aqui resolve a pendencia pra
    qualquer lancamento futuro do mesmo terceiro."""
    _perfil(x_user_email)
    # exclude_unset: campo ausente no JSON nao mexe no que ja esta no cadastro
    dados = {k: (v.strip() or None if isinstance(v, str) else v)
             for k, v in body.model_dump(exclude_unset=True).items()}
    if not dados:
        raise HTTPException(400, "nada pra atualizar")
    with _sb() as sb:
        r = sb.patch("/prestadores", params={"id": f"eq.{pid}"}, json=dados,
                     headers={"Prefer": "return=representation"})
    _sb_ok(r, "prestadores patch")
    if not (r.json() or []):
        raise HTTPException(404, "prestador nao encontrado no cadastro")
    pr = _prestador(pid)
    pr["pendencias"] = _pendencias_prestador(pr)
    return pr


# ═══════════════════════════════════════════════════════════════════
# Lancamentos
# ═══════════════════════════════════════════════════════════════════

class LancamentoIn(BaseModel):
    projeto_id: str
    prestador_id: str
    data_ida: str | None = None
    data_volta: str | None = None
    motivo: str | None = None
    adiantamento_cent: int = 0


class LancamentoPatch(BaseModel):
    data_ida: str | None = None
    data_volta: str | None = None
    motivo: str | None = None
    adiantamento_cent: int | None = None


class StatusIn(BaseModel):
    para: str
    observacao: str | None = None
    plano_conta_id: str | None = None  # so no pago; default sai da composicao


@router.get("/lancamentos")
def listar(status: str | None = Query(default=None),
           projeto_id: str | None = Query(default=None),
           prestador_id: str | None = Query(default=None),
           fila: bool = Query(default=False),
           x_user_email: str | None = Header(default=None)):
    """fila=true e a visao do financeiro: enviados e em analise, mais antigos
    primeiro (bate com o indice parcial idx_custo_lanc_fila)."""
    p = _perfil(x_user_email)
    where, args = ["1=1"], []
    if status:
        where.append("l.status = ANY(%s)")
        args.append([s.strip() for s in status.split(",") if s.strip()])
    if projeto_id:
        where.append("l.projeto_id::text = %s")
        args.append(projeto_id)
    if prestador_id:
        where.append("l.prestador_id::text = %s")
        args.append(prestador_id)
    if fila:
        where.append("l.status IN ('enviado','em_analise')")
    # Quem nao e admin nem financeiro so ve o que criou ou a obra que gerencia.
    if not (p["admin"] or p["financeiro_ve"]):
        where.append("(lower(l.criado_por)=%s OR lower(pj.gestor_email)=%s)")
        args += [p["email"], p["email"]]

    ordem = "l.created_at ASC" if fila else "l.created_at DESC"
    with conn() as c, c.cursor() as cur:
        cur.execute(f"""
            SELECT l.id::text AS id, l.numero, l.status, l.motivo,
                   l.data_ida::text AS data_ida, l.data_volta::text AS data_volta,
                   l.prestador_id::text AS prestador_id, l.prestador_nome,
                   l.total_lancado_cent, l.total_aprovado_cent,
                   l.adiantamento_cent, l.saldo_cent,
                   l.centro_custo_nome, l.criado_por, l.created_at,
                   l.projeto_id::text AS projeto_id,
                   pj.cliente, pj.endereco, pj.numero_proposta,
                   (SELECT count(*) FROM gestao.custo_despesa d
                     WHERE d.lancamento_id = l.id) AS n_despesas,
                   (SELECT count(*) FROM gestao.custo_despesa d
                     WHERE d.lancamento_id = l.id
                       AND jsonb_array_length(d.alertas) > 0) AS n_alertas,
                   (SELECT count(*) FROM gestao.custo_despesa d
                     WHERE d.lancamento_id = l.id AND d.status='pendente') AS n_pendentes
              FROM gestao.custo_lancamento l
              JOIN gestao.projetos pj ON pj.id = l.projeto_id
             WHERE {' AND '.join(where)}
             ORDER BY {ordem}
             LIMIT 500""", args)
        return {"items": cur.fetchall(), "papel": {k: p[k] for k in ("admin", "financeiro", "financeiro_ve")}}


@router.post("/lancamentos")
def criar(body: LancamentoIn, x_user_email: str | None = Header(default=None)):
    p = _perfil(x_user_email)
    pr = _prestador(body.prestador_id)

    with conn() as c, c.cursor() as cur:
        cur.execute("SELECT id::text AS id, cliente, card_id::text AS card_id "
                    "FROM gestao.projetos WHERE id::text=%s", (body.projeto_id,))
        proj = cur.fetchone()
        if not proj:
            raise HTTPException(404, "obra nao encontrada")
        pol = _politica_vigente(cur)
        core = _resolver_core(proj.get("card_id"))

        cur.execute("""INSERT INTO gestao.custo_lancamento
                         (projeto_id, prestador_id, prestador_nome, politica_id,
                          core_obra_id, centro_custo_id, centro_custo_nome,
                          data_ida, data_volta, motivo, adiantamento_cent, criado_por)
                       VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
                       RETURNING id::text AS id, numero""",
                    (body.projeto_id, body.prestador_id, pr.get("nome"), pol["id"],
                     core.get("core_obra_id"), core.get("centro_custo_id"),
                     core.get("centro_custo_nome"),
                     body.data_ida or None, body.data_volta or None, body.motivo,
                     max(0, int(body.adiantamento_cent or 0)), p["email"]))
        novo = cur.fetchone()
        _hist(cur, novo["id"], None, "rascunho", p, "lancamento aberto")
        _reavaliar(cur, novo["id"])
        return detalhe_row(cur, novo["id"], p)


@router.get("/lancamentos/{lid}")
def detalhe(lid: str, x_user_email: str | None = Header(default=None)):
    p = _perfil(x_user_email)
    with conn() as c, c.cursor() as cur:
        return detalhe_row(cur, lid, p)


def detalhe_row(cur, lid: str, p: dict) -> dict:
    lanc = _lancamento(cur, lid)
    if not _pode_ver(p, lanc):
        raise HTTPException(403, "este lancamento nao e seu")

    cur.execute("""SELECT id::text AS id, categoria, subcategoria, descricao,
                          data::text AS data, quantidade, valor_unitario_cent,
                          valor_total_cent, campos, alertas, anexo_url, anexo_nome,
                          anexo_content_type, status, glosa_motivo, decidido_por,
                          decidido_em, created_at
                     FROM gestao.custo_despesa
                    WHERE lancamento_id::text=%s ORDER BY data NULLS LAST, created_at""", (lid,))
    despesas = cur.fetchall()

    cur.execute("""SELECT de, para, usuario_email, usuario_nome, observacao, created_at
                     FROM gestao.custo_historico
                    WHERE lancamento_id::text=%s ORDER BY created_at""", (lid,))
    historico = cur.fetchall()

    cur.execute("SELECT * FROM gestao.custo_politica WHERE id=%s", (lanc["politica_id"],))
    pol = cur.fetchone() or {}

    pend = []
    if not lanc.get("centro_custo_id"):
        pend.append("centro de custo da obra nao encontrado no financeiro")
    try:
        pend += _pendencias_prestador(_prestador(lanc["prestador_id"]))
    except HTTPException:
        pend.append("prestador nao encontrado no cadastro")

    proximos = [d for (o, d) in TRANSICOES
                if o == lanc["status"] and _pode_transicionar(p, lanc, o, d)]

    lanc.pop("meta", None)
    return {
        "lancamento": lanc,
        "despesas": despesas,
        "historico": historico,
        "politica": pol,
        "pendencias": pend,
        "proximos_status": proximos,
        "pode_editar": lanc["status"] in STATUS_EDITAVEIS and _e_dono(p, lanc),
        "pode_decidir": p["financeiro"] and lanc["status"] in ("enviado", "em_analise"),
        "papel": {k: p[k] for k in ("admin", "financeiro", "financeiro_ve")},
    }


def _pode_transicionar(p: dict, lanc: dict, de: str, para: str) -> bool:
    quem = TRANSICOES.get((de, para))
    if quem == "dono":
        return _e_dono(p, lanc)
    if quem == "financeiro":
        return p["financeiro"]
    return False


@router.patch("/lancamentos/{lid}")
def editar(lid: str, body: LancamentoPatch, x_user_email: str | None = Header(default=None)):
    p = _perfil(x_user_email)
    with conn() as c, c.cursor() as cur:
        lanc = _lancamento(cur, lid)
        if lanc["status"] not in STATUS_EDITAVEIS:
            raise HTTPException(409, f"lancamento {lanc['status']} nao pode mais ser editado")
        if not _e_dono(p, lanc):
            raise HTTPException(403, "este lancamento nao e seu")

        sets, args = [], []
        for campo in ("data_ida", "data_volta", "motivo"):
            v = getattr(body, campo)
            if v is not None:
                sets.append(f"{campo}=%s")
                args.append(v or None)
        if body.adiantamento_cent is not None:
            sets.append("adiantamento_cent=%s")
            args.append(max(0, int(body.adiantamento_cent)))
        if sets:
            args.append(lid)
            cur.execute(f"UPDATE gestao.custo_lancamento SET {', '.join(sets)} WHERE id::text=%s", args)
        # Data do cabecalho mudou: o alerta data_fora_periodo precisa refazer.
        _reavaliar(cur, lid)
        return detalhe_row(cur, lid, p)


@router.delete("/lancamentos/{lid}")
def apagar(lid: str, x_user_email: str | None = Header(default=None)):
    p = _perfil(x_user_email)
    with conn() as c, c.cursor() as cur:
        lanc = _lancamento(cur, lid)
        if lanc["status"] != "rascunho":
            raise HTTPException(409, "so rascunho pode ser apagado; depois de enviado, devolva ou glose")
        if not _e_dono(p, lanc):
            raise HTTPException(403, "este lancamento nao e seu")
        # ON DELETE CASCADE leva despesas e historico junto.
        cur.execute("DELETE FROM gestao.custo_lancamento WHERE id::text=%s", (lid,))
    return {"ok": True}


@router.post("/lancamentos/{lid}/status")
def mudar_status(lid: str, body: StatusIn, x_user_email: str | None = Header(default=None)):
    p = _perfil(x_user_email)
    with conn() as c, c.cursor() as cur:
        lanc = _lancamento(cur, lid)
        de, para = lanc["status"], body.para
        if (de, para) not in TRANSICOES:
            raise HTTPException(409, f"nao da pra ir de {de} para {para}")
        if not _pode_transicionar(p, lanc, de, para):
            raise HTTPException(403, "voce nao pode fazer essa transicao")

        if para == "devolvido" and not (body.observacao or "").strip():
            raise HTTPException(400, "devolver exige dizer o que precisa corrigir")

        # Autocommit: a troca de status sao varios UPDATEs mais o historico.
        # Ou entra tudo, ou nada, senao o lancamento fica num meio termo
        # (status novo sem trilha, ou aprovado_por sem aprovado).
        with c.transaction():
            if para == "enviado":
                cur.execute("SELECT count(*) AS n FROM gestao.custo_despesa WHERE lancamento_id::text=%s", (lid,))
                if int((cur.fetchone() or {}).get("n") or 0) == 0:
                    raise HTTPException(400, "lance ao menos uma despesa antes de enviar")
                _checar_diaria(cur, lid)
                # Centro de custo pode ter sido cadastrado no Core depois da
                # abertura; reresolve aqui, que e barato e uma vez so.
                if not lanc.get("centro_custo_id"):
                    core = _resolver_core(lanc.get("card_id"))
                    if core.get("centro_custo_id"):
                        cur.execute("""UPDATE gestao.custo_lancamento
                                          SET core_obra_id=%s, centro_custo_id=%s, centro_custo_nome=%s
                                        WHERE id::text=%s""",
                                    (core.get("core_obra_id"), core.get("centro_custo_id"),
                                     core.get("centro_custo_nome"), lid))

            if para == "aprovado":
                cur.execute("SELECT count(*) AS n FROM gestao.custo_despesa "
                            "WHERE lancamento_id::text=%s AND status='pendente'", (lid,))
                n = int((cur.fetchone() or {}).get("n") or 0)
                if n:
                    raise HTTPException(409, f"ainda ha {n} despesa(s) sem decisao; aprove ou glose cada uma")
                cur.execute("UPDATE gestao.custo_lancamento SET aprovado_por=%s, aprovado_em=now() "
                            "WHERE id::text=%s", (p["email"], lid))

            if para == "pago":
                _pagar(cur, lid, p, body.plano_conta_id)

            cur.execute("UPDATE gestao.custo_lancamento SET status=%s WHERE id::text=%s", (para, lid))
            _hist(cur, lid, de, para, p, body.observacao)
            _reavaliar(cur, lid)
        return detalhe_row(cur, lid, p)


def _pagar(cur, lid: str, p: dict, plano_conta_id: str | None) -> None:
    """Write-back no Core: o pagamento do terceiro vira linha em
    core.lancamentos, que e a fonte unica de pagamento do grupo. Sem isso o
    custo da obra ficaria so aqui dentro e nunca chegaria no custo_realizado."""
    lanc = _lancamento(cur, lid)
    if not lanc.get("centro_custo_id"):
        raise HTTPException(409, "sem centro de custo da obra nao da pra gerar o pagamento; "
                                 "cadastre a obra no financeiro e reenvie")
    saldo = int(lanc.get("saldo_cent") or 0)
    if saldo <= 0:
        raise HTTPException(409, "saldo a pagar zerado (adiantamento ja cobre o aprovado)")
    if lanc.get("core_lancamento_id"):
        raise HTTPException(409, "este lancamento ja gerou pagamento no financeiro")

    # NF ou RPA no meio = repasse de servico; o resto e reembolso de viagem.
    cur.execute("SELECT count(*) AS n FROM gestao.custo_despesa "
                "WHERE lancamento_id::text=%s AND categoria='documentacao' AND status='aprovado'", (lid,))
    tem_doc = int((cur.fetchone() or {}).get("n") or 0) > 0
    plano = plano_conta_id or (PLANO_SERVICOS_TERCEIROS if tem_doc else PLANO_CUSTO_VIAGEM)

    hoje = date.today().isoformat()
    with _sb("core") as sb:
        # O prestador precisa existir como parceiro pro financeiro saber pra
        # quem pagou. space_prestador_id e a ponte com public.prestadores.
        parceiro_id = None
        rp = sb.get("/parceiros", params={"select": "id",
                                          "space_prestador_id": f"eq.{lanc['prestador_id']}",
                                          "limit": "1"})
        if rp.status_code < 400 and (rp.json() or []):
            parceiro_id = rp.json()[0]["id"]
        else:
            pr = _prestador(lanc["prestador_id"])
            rc = sb.post("/parceiros", headers={"Prefer": "return=representation"}, json={
                "tipo_pessoa": (pr.get("tipo_pessoa") or "PF")[:2].upper() if pr.get("tipo_pessoa") != "MEI" else "PJ",
                "documento": pr.get("cnpj") or pr.get("cpf"),
                "nome": pr.get("nome") or lanc.get("prestador_nome") or "PRESTADOR",
                "is_cliente": False, "is_fornecedor": True, "is_vendedor": False,
                "email": pr.get("email"), "telefone": pr.get("telefone"),
                "ativo": True, "space_prestador_id": lanc["prestador_id"],
            })
            _sb_ok(rc, "parceiros.insert")
            parceiro_id = (rc.json() or [{}])[0].get("id")

        r = sb.post("/lancamentos", headers={"Prefer": "return=representation"}, json={
            "empresa_id": CORE_EMPRESA_ID,
            "centro_custo_id": lanc["centro_custo_id"],
            "obra_id": lanc.get("core_obra_id"),
            "parceiro_id": parceiro_id,
            "plano_conta_id": plano,
            "tipo": "saida",
            "status": "pago",
            "descricao": f"{lanc['numero']} custos de terceiro - "
                         f"{lanc.get('prestador_nome') or ''} - {lanc.get('cliente') or ''}".strip(" -"),
            "numero_documento": lanc["numero"],
            "data_competencia": hoje,
            "data_vencimento": hoje,
            "data_pagamento": hoje,
            # core.lancamentos.valor e numeric em reais; aqui e a unica
            # fronteira onde o centavo vira decimal.
            "valor": float(Decimal(saldo) / 100),
            "valor_pago": float(Decimal(saldo) / 100),
            "observacoes": f"Ordem de pagamento de terceiro {lanc['numero']} "
                           f"(gestao.custo_lancamento {lid})",
        })
    _sb_ok(r, "core.lancamentos")
    core_id = (r.json() or [{}])[0].get("id")
    cur.execute("""UPDATE gestao.custo_lancamento
                      SET core_lancamento_id=%s, pago_por=%s, pago_em=now()
                    WHERE id::text=%s""", (core_id, p["email"], lid))


# ═══════════════════════════════════════════════════════════════════
# Despesas
# ═══════════════════════════════════════════════════════════════════

class DespesaIn(BaseModel):
    subcategoria: str
    descricao: str | None = None
    data: str | None = None
    quantidade: float | None = 1
    valor_unitario_cent: int = 0
    campos: dict = Field(default_factory=dict)


class DespesaPatch(BaseModel):
    subcategoria: str | None = None
    descricao: str | None = None
    data: str | None = None
    quantidade: float | None = None
    valor_unitario_cent: int | None = None
    campos: dict | None = None


class DecisaoIn(BaseModel):
    decisao: str            # aprovado | glosado | pendente
    glosa_motivo: str | None = None


def _despesa(cur, did: str) -> dict:
    cur.execute("""SELECT d.*, d.id::text AS id, d.lancamento_id::text AS lancamento_id,
                          d.politica_id::text AS politica_id
                     FROM gestao.custo_despesa d WHERE d.id::text=%s""", (did,))
    row = cur.fetchone()
    if not row:
        raise HTTPException(404, "despesa nao encontrada")
    return row


@router.post("/lancamentos/{lid}/despesas")
def despesa_criar(lid: str, body: DespesaIn, x_user_email: str | None = Header(default=None)):
    p = _perfil(x_user_email)
    with conn() as c, c.cursor() as cur:
        lanc = _lancamento(cur, lid)
        if lanc["status"] not in STATUS_EDITAVEIS:
            raise HTTPException(409, f"lancamento {lanc['status']} nao aceita despesa nova")
        if not _e_dono(p, lanc):
            raise HTTPException(403, "este lancamento nao e seu")

        cat = SUBCAT_CATEGORIA.get(body.subcategoria)
        if not cat:
            raise HTTPException(400, f"subcategoria desconhecida: {body.subcategoria}")

        # A despesa congela a politica vigente AGORA, nao a da abertura: um
        # reajuste no meio da viagem vale pro que for lancado depois dele.
        pol = _politica_vigente(cur)
        qtd, vu, total = _calcular(body.subcategoria, body.campos, body.quantidade,
                                   body.valor_unitario_cent, pol)

        # conn() e autocommit. Sem transacao explicita a linha ja estaria gravada
        # quando _checar_diaria levantasse o 409, e a despesa recusada envenenaria
        # o lancamento pra sempre: o mesmo 409 voltaria em todo envio seguinte.
        with c.transaction():
            cur.execute("""INSERT INTO gestao.custo_despesa
                             (lancamento_id, categoria, subcategoria, descricao, data,
                              quantidade, valor_unitario_cent, valor_total_cent,
                              campos, politica_id)
                           VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
                           RETURNING id::text AS id""",
                        (lid, cat, body.subcategoria, body.descricao, body.data or None,
                         qtd, vu, total, json.dumps(body.campos or {}), pol["id"]))
            did = cur.fetchone()["id"]
            _checar_diaria(cur, lid)
            _reavaliar(cur, lid)
        return _despesa(cur, did)


@router.patch("/despesas/{did}")
def despesa_editar(did: str, body: DespesaPatch, x_user_email: str | None = Header(default=None)):
    p = _perfil(x_user_email)
    with conn() as c, c.cursor() as cur:
        d = _despesa(cur, did)
        lanc = _lancamento(cur, d["lancamento_id"])
        if lanc["status"] not in STATUS_EDITAVEIS:
            raise HTTPException(409, f"lancamento {lanc['status']} nao pode mais ser editado")
        if not _e_dono(p, lanc):
            raise HTTPException(403, "este lancamento nao e seu")

        sub = body.subcategoria or d["subcategoria"]
        cat = SUBCAT_CATEGORIA.get(sub)
        if not cat:
            raise HTTPException(400, f"subcategoria desconhecida: {sub}")
        campos = body.campos if body.campos is not None else (d.get("campos") or {})
        qtd_in = body.quantidade if body.quantidade is not None else d.get("quantidade")
        vu_in = body.valor_unitario_cent if body.valor_unitario_cent is not None \
            else d.get("valor_unitario_cent")

        cur.execute("SELECT * FROM gestao.custo_politica WHERE id=%s", (d["politica_id"],))
        pol = cur.fetchone() or {}
        qtd, vu, total = _calcular(sub, campos, qtd_in, vu_in, pol)

        # Mesma razao do insert: a edicao recusada precisa voltar atras inteira.
        with c.transaction():
            cur.execute("""UPDATE gestao.custo_despesa
                              SET categoria=%s, subcategoria=%s, descricao=%s, data=%s,
                                  quantidade=%s, valor_unitario_cent=%s, valor_total_cent=%s,
                                  campos=%s, status='pendente', glosa_motivo=NULL,
                                  decidido_por=NULL, decidido_em=NULL
                            WHERE id::text=%s""",
                        (cat, sub,
                         body.descricao if body.descricao is not None else d.get("descricao"),
                         (body.data if body.data is not None else d.get("data")) or None,
                         qtd, vu, total, json.dumps(campos), did))
            _checar_diaria(cur, d["lancamento_id"])
            _reavaliar(cur, d["lancamento_id"])
        return _despesa(cur, did)


@router.delete("/despesas/{did}")
def despesa_apagar(did: str, x_user_email: str | None = Header(default=None)):
    p = _perfil(x_user_email)
    with conn() as c, c.cursor() as cur:
        d = _despesa(cur, did)
        lanc = _lancamento(cur, d["lancamento_id"])
        if lanc["status"] not in STATUS_EDITAVEIS:
            raise HTTPException(409, f"lancamento {lanc['status']} nao pode mais ser editado")
        if not _e_dono(p, lanc):
            raise HTTPException(403, "este lancamento nao e seu")
        cur.execute("DELETE FROM gestao.custo_despesa WHERE id::text=%s", (did,))
        _reavaliar(cur, d["lancamento_id"])
    return {"ok": True}


@router.post("/despesas/{did}/decisao")
def despesa_decisao(did: str, body: DecisaoIn, x_user_email: str | None = Header(default=None)):
    """Aprovar ou glosar item a item. Glosa exige justificativa: o secretario
    tem que saber o que corrigir quando o lancamento voltar."""
    p = _perfil(x_user_email)
    _so_financeiro(p)
    if body.decisao not in ("aprovado", "glosado", "pendente"):
        raise HTTPException(400, "decisao precisa ser aprovado, glosado ou pendente")
    if body.decisao == "glosado" and not (body.glosa_motivo or "").strip():
        raise HTTPException(400, "glosar exige o motivo")

    with conn() as c, c.cursor() as cur:
        d = _despesa(cur, did)
        lanc = _lancamento(cur, d["lancamento_id"])
        if lanc["status"] not in ("enviado", "em_analise"):
            raise HTTPException(409, f"lancamento {lanc['status']} nao esta em analise")
        cur.execute("""UPDATE gestao.custo_despesa
                          SET status=%s, glosa_motivo=%s, decidido_por=%s, decidido_em=now()
                        WHERE id::text=%s""",
                    (body.decisao, body.glosa_motivo if body.decisao == "glosado" else None,
                     p["email"], did))
        # Primeira decisao puxa o lancamento pra em_analise sozinha: o
        # financeiro nao precisa lembrar de "assumir" antes de conferir.
        if lanc["status"] == "enviado":
            cur.execute("UPDATE gestao.custo_lancamento SET status='em_analise' WHERE id::text=%s",
                        (lanc["id"],))
            _hist(cur, lanc["id"], "enviado", "em_analise", p, "analise iniciada")
        _reavaliar(cur, d["lancamento_id"])
        return _despesa(cur, did)


@router.post("/despesas/{did}/anexo")
async def despesa_anexo(did: str, file: UploadFile = File(...),
                        x_user_email: str | None = Header(default=None)):
    """Foto do comprovante. O cliente ja manda comprimida; aqui so sobe."""
    p = _perfil(x_user_email)
    with conn() as c, c.cursor() as cur:
        d = _despesa(cur, did)
        lanc = _lancamento(cur, d["lancamento_id"])
        if lanc["status"] not in STATUS_EDITAVEIS:
            raise HTTPException(409, f"lancamento {lanc['status']} nao aceita anexo novo")
        if not _e_dono(p, lanc):
            raise HTTPException(403, "este lancamento nao e seu")

    data = await file.read()
    if not data:
        raise HTTPException(400, "arquivo vazio")
    nome = _slug(file.filename or "comprovante")
    url = await _upload(f"custos/{d['lancamento_id']}/{did}-{nome}", data, file.content_type)

    with conn() as c, c.cursor() as cur:
        cur.execute("""UPDATE gestao.custo_despesa
                          SET anexo_url=%s, anexo_nome=%s, anexo_content_type=%s
                        WHERE id::text=%s""", (url, file.filename, file.content_type, did))
        # Anexo derruba o alerta sem_anexo.
        _reavaliar(cur, d["lancamento_id"])
        return _despesa(cur, did)


@router.post("/lancamentos/{lid}/comprovante")
async def comprovante(lid: str, file: UploadFile = File(...),
                      x_user_email: str | None = Header(default=None)):
    """Comprovante da transferencia, anexado pelo financeiro depois de quitar."""
    p = _perfil(x_user_email)
    _so_financeiro(p)
    with conn() as c, c.cursor() as cur:
        lanc = _lancamento(cur, lid)
        if lanc["status"] != "pago":
            raise HTTPException(409, "o comprovante entra depois de marcar como pago")

    data = await file.read()
    if not data:
        raise HTTPException(400, "arquivo vazio")
    nome = _slug(file.filename or "comprovante")
    url = await _upload(f"custos/{lid}/comprovante-{nome}", data, file.content_type)

    with conn() as c, c.cursor() as cur:
        cur.execute("UPDATE gestao.custo_lancamento SET comprovante_url=%s, comprovante_nome=%s "
                    "WHERE id::text=%s", (url, file.filename, lid))
        return detalhe_row(cur, lid, p)


# ═══════════════════════════════════════════════════════════════════
# Ordem de pagamento em PDF
# ═══════════════════════════════════════════════════════════════════

@router.get("/lancamentos/{lid}/op.pdf")
def op_pdf(lid: str, x_user_email: str | None = Header(default=None)):
    """PDF da ordem de pagamento (OPT-XXXX) pra o financeiro anexar no
    processo. Sai em qualquer status (rascunho vira previa), mas o layout
    marca o status no cabecalho pra ninguem pagar por engano uma OP que
    ainda nao foi aprovada."""
    from .custos_pdf import gerar_op_pdf
    p = _perfil(x_user_email)
    with conn() as c, c.cursor() as cur:
        lanc = _lancamento(cur, lid)
        if not _pode_ver(p, lanc):
            raise HTTPException(403, "este lancamento nao e seu")
        cur.execute("""SELECT categoria, subcategoria, descricao, data,
                              quantidade, valor_unitario_cent, valor_total_cent,
                              status, glosa_motivo
                         FROM gestao.custo_despesa
                        WHERE lancamento_id::text=%s
                        ORDER BY categoria, data NULLS LAST, created_at""", (lid,))
        despesas = cur.fetchall()

    # Ficha do terceiro (Cloud). Sem ela o PDF sai mesmo assim, com a
    # pendencia impressa: o financeiro precisa do papel pra cobrar o cadastro.
    pend = []
    try:
        prest = _prestador(lanc["prestador_id"])
        pend = _pendencias_prestador(prest)
    except HTTPException:
        prest = {}
        pend = ["prestador nao encontrado no cadastro"]
    if not lanc.get("centro_custo_id"):
        pend.append("centro de custo da obra nao encontrado no financeiro")

    pdf = gerar_op_pdf(lanc, despesas, prest, pend)
    return Response(
        content=pdf, media_type="application/pdf",
        headers={"Content-Disposition":
                 f'inline; filename="{lanc.get("numero") or "op"}.pdf"'})


# ═══════════════════════════════════════════════════════════════════
# Relatorio
# ═══════════════════════════════════════════════════════════════════

@router.get("/relatorio")
def relatorio(de: str | None = Query(default=None),
              ate: str | None = Query(default=None),
              projeto_id: str | None = Query(default=None),
              prestador_id: str | None = Query(default=None),
              categoria: str | None = Query(default=None),
              status: str | None = Query(default="aprovado,pago"),
              formato: str = Query(default="json"),
              x_user_email: str | None = Header(default=None)):
    """Linha a linha por obra, terceiro, categoria e mes. CSV so no formato
    csv: XLSX exigiria dependencia nova, que o Will pediu pra nao entrar sem
    perguntar."""
    p = _perfil(x_user_email)
    where, args = ["1=1"], []
    if de:
        where.append("coalesce(d.data, l.created_at::date) >= %s")
        args.append(de)
    if ate:
        where.append("coalesce(d.data, l.created_at::date) <= %s")
        args.append(ate)
    if projeto_id:
        where.append("l.projeto_id::text = %s")
        args.append(projeto_id)
    if prestador_id:
        where.append("l.prestador_id::text = %s")
        args.append(prestador_id)
    if categoria:
        where.append("d.categoria = ANY(%s)")
        args.append([x.strip() for x in categoria.split(",") if x.strip()])
    if status:
        where.append("l.status = ANY(%s)")
        args.append([x.strip() for x in status.split(",") if x.strip()])
    if not (p["admin"] or p["financeiro_ve"]):
        where.append("(lower(l.criado_por)=%s OR lower(pj.gestor_email)=%s)")
        args += [p["email"], p["email"]]

    sql = f"""
        SELECT to_char(coalesce(d.data, l.created_at::date), 'YYYY-MM') AS mes,
               pj.cliente AS obra, l.numero, l.status,
               l.prestador_nome AS terceiro, l.centro_custo_nome AS centro_custo,
               d.categoria, d.subcategoria, d.status AS status_despesa,
               d.data::text AS data, d.descricao,
               d.quantidade, d.valor_unitario_cent, d.valor_total_cent
          FROM gestao.custo_despesa d
          JOIN gestao.custo_lancamento l ON l.id = d.lancamento_id
          JOIN gestao.projetos pj ON pj.id = l.projeto_id
         WHERE {' AND '.join(where)}
         ORDER BY mes DESC, obra, l.numero, d.categoria, d.data"""
    with conn() as c, c.cursor() as cur:
        cur.execute(sql, args)
        linhas = cur.fetchall()

    if formato == "csv":
        buf = io.StringIO()
        cols = ["mes", "obra", "numero", "status", "terceiro", "centro_custo", "categoria",
                "subcategoria", "status_despesa", "data", "descricao", "quantidade",
                "valor_unitario", "valor_total"]
        w = csv.writer(buf, delimiter=";")
        w.writerow(cols)
        for l in linhas:
            w.writerow([
                l["mes"], l["obra"], l["numero"], l["status"], l["terceiro"],
                l["centro_custo"], l["categoria"], l["subcategoria"], l["status_despesa"],
                l["data"], l["descricao"], l["quantidade"],
                # Planilha brasileira le virgula decimal.
                f"{int(l['valor_unitario_cent'] or 0)/100:.2f}".replace(".", ","),
                f"{int(l['valor_total_cent'] or 0)/100:.2f}".replace(".", ","),
            ])
        stamp = datetime.now().strftime("%Y%m%d")
        return Response(
            # BOM pro Excel abrir acentuacao certa.
            content="﻿" + buf.getvalue(),
            media_type="text/csv; charset=utf-8",
            headers={"Content-Disposition": f'attachment; filename="custos-terceiros-{stamp}.csv"'})

    # Glosada aparece na lista (o financeiro precisa ver o que cortou) mas fica
    # fora do total e dos eixos: glosa nao e custo da obra. Somar as duas coisas
    # daria um numero que nao bate com nada no financeiro.
    resumo: dict = {}
    for l in linhas:
        if l["status_despesa"] == "glosado":
            continue
        for eixo, chave in (("obra", l["obra"]), ("terceiro", l["terceiro"]),
                            ("categoria", l["categoria"]), ("mes", l["mes"])):
            resumo.setdefault(eixo, {})
            resumo[eixo][chave or "(sem)"] = resumo[eixo].get(chave or "(sem)", 0) \
                + int(l["valor_total_cent"] or 0)
    return {"items": linhas,
            "total_cent": sum(int(l["valor_total_cent"] or 0) for l in linhas
                              if l["status_despesa"] != "glosado"),
            "glosado_cent": sum(int(l["valor_total_cent"] or 0) for l in linhas
                                if l["status_despesa"] == "glosado"),
            "resumo": resumo}


# ═══════════════════════════════════════════════════════════════════
# Aba dentro da obra
# ═══════════════════════════════════════════════════════════════════

@router.get("/projetos/{pid}/resumo")
def resumo_obra(pid: str, x_user_email: str | None = Header(default=None)):
    """Alimenta a aba Custos de Terceiros dentro do projeto."""
    _perfil(x_user_email)
    with conn() as c, c.cursor() as cur:
        cur.execute("""SELECT count(*) AS n,
                              coalesce(sum(total_lancado_cent),0)  AS lancado_cent,
                              coalesce(sum(total_aprovado_cent),0) AS aprovado_cent,
                              coalesce(sum(saldo_cent) FILTER (WHERE status='aprovado'),0) AS a_pagar_cent,
                              coalesce(sum(total_aprovado_cent) FILTER (WHERE status='pago'),0) AS pago_cent
                         FROM gestao.custo_lancamento WHERE projeto_id::text=%s""", (pid,))
        return cur.fetchone()


# ═══════════════════════════════════════════════════════════════════
# Apps de campo (Instala e Verifica): o terceiro acompanha os proprios
# lancamentos
#
# O instalador e o fiscal NAO tem login em public.user_profiles, entao
# nao passam pelo _perfil. A chave e o proprio UUID do prestador (ou do
# fiscal), mesmo padrao dos endpoints /api/instala: leitura restrita ao
# dono do id, sem escrita nenhuma por aqui.
# ═══════════════════════════════════════════════════════════════════

def _prestador_do_fiscal(fiscal_id: str) -> str | None:
    """Resolve public.fiscal_equipe.id -> public.prestadores.id.

    O fiscal loga no Verifica com a conta de fiscal_equipe, mas o custo e
    lancado contra a ficha espelho dele em prestadores (categoria Fiscal),
    casada por nome normalizado: exatamente a mesma regra do
    _sync_fiscais_como_prestadores. Se a ficha ainda nao existe (fiscal
    novo que nunca apareceu na listagem), cria aqui na hora."""
    try:
        with _sb() as sb:
            rf = sb.get("/fiscal_equipe", params={
                "select": "id,nome,telefone,email", "id": f"eq.{fiscal_id}", "limit": "1"})
            if rf.status_code >= 400 or not (rf.json() or []):
                return None
            f = rf.json()[0]
            nome = (f.get("nome") or "").strip()
            if not nome:
                return None
            # ilike sem curinga = igualdade case-insensitive no PostgREST.
            rp = sb.get("/prestadores", params={
                "select": "id,nome", "nome": f"ilike.{nome}",
                "ativo": "eq.true", "limit": "1"})
            if rp.status_code < 400 and (rp.json() or []):
                return rp.json()[0]["id"]
            rn = sb.post("/prestadores", headers={"Prefer": "return=representation"},
                         json={"nome": nome, "telefone": f.get("telefone"),
                               "email": f.get("email"), "categoria": "Fiscal",
                               "ativo": True})
            if rn.status_code < 400 and (rn.json() or []):
                log.info("custos: ficha espelho criada pro fiscal %s", nome)
                return rn.json()[0]["id"]
    except Exception as e:
        log.warning("custos: resolver fiscal %s falhou: %s", fiscal_id, e)
    return None


def _app_resolver_prestador(prestador_id: str | None, fiscal_id: str | None) -> str:
    """Instala manda prestador_id direto (vem do login); Verifica manda
    fiscal_id e a ponte pra ficha e resolvida aqui."""
    pid = (prestador_id or "").strip()
    if not pid and fiscal_id:
        pid = _prestador_do_fiscal(fiscal_id.strip()) or ""
    if not pid:
        raise HTTPException(400, "informe prestador_id ou fiscal_id")
    return pid


@router.get("/app/lancamentos")
def app_lancamentos(prestador_id: str | None = Query(default=None),
                    fiscal_id: str | None = Query(default=None)):
    """Lista dos lancamentos do proprio terceiro, mais novos primeiro.
    E o que alimenta a aba Meus custos do Instala e do Verifica."""
    pid = _app_resolver_prestador(prestador_id, fiscal_id)
    with conn() as c, c.cursor() as cur:
        cur.execute("""
            SELECT l.id::text AS id, l.numero, l.status, l.motivo,
                   l.data_ida::text AS data_ida, l.data_volta::text AS data_volta,
                   l.total_lancado_cent, l.total_aprovado_cent,
                   l.adiantamento_cent, l.saldo_cent,
                   l.comprovante_url, l.comprovante_nome,
                   l.pago_em, l.created_at,
                   pj.cliente, pj.endereco,
                   (SELECT count(*) FROM gestao.custo_despesa d
                     WHERE d.lancamento_id = l.id) AS n_despesas,
                   (SELECT count(*) FROM gestao.custo_despesa d
                     WHERE d.lancamento_id = l.id AND d.status='glosado') AS n_glosadas
              FROM gestao.custo_lancamento l
              JOIN gestao.projetos pj ON pj.id = l.projeto_id
             WHERE l.prestador_id::text=%s
             ORDER BY l.created_at DESC
             LIMIT 200""", (pid,))
        return {"items": cur.fetchall(), "prestador_id": pid}


@router.get("/app/lancamentos/{lid}")
def app_lancamento_detalhe(lid: str,
                           prestador_id: str | None = Query(default=None),
                           fiscal_id: str | None = Query(default=None)):
    """Detalhe de um lancamento do proprio terceiro: despesas item a item
    (com glosa e motivo) e a trilha de status. So enxerga o que e dele:
    lancamento de outro prestador devolve 404, nao 403, pra nao vazar
    nem a existencia do id."""
    pid = _app_resolver_prestador(prestador_id, fiscal_id)
    with conn() as c, c.cursor() as cur:
        lanc = _lancamento(cur, lid)
        if (lanc.get("prestador_id") or "") != pid:
            raise HTTPException(404, "lancamento nao encontrado")

        cur.execute("""SELECT d.id::text AS id, d.categoria, d.subcategoria,
                              d.descricao, d.data::text AS data,
                              d.quantidade, d.valor_unitario_cent, d.valor_total_cent,
                              d.status, d.glosa_motivo, d.anexo_url, d.anexo_nome,
                              d.campos
                         FROM gestao.custo_despesa d
                        WHERE d.lancamento_id::text=%s
                        ORDER BY d.data NULLS LAST, d.created_at""", (lid,))
        despesas = cur.fetchall()
        cur.execute("""SELECT de, para, usuario_nome, observacao, created_at
                         FROM gestao.custo_historico
                        WHERE lancamento_id::text=%s ORDER BY created_at""", (lid,))
        historico = cur.fetchall()

    campos = ("id", "numero", "status", "motivo", "data_ida", "data_volta",
              "total_lancado_cent", "total_aprovado_cent", "adiantamento_cent",
              "saldo_cent", "comprovante_url", "comprovante_nome", "pago_em",
              "created_at", "cliente", "endereco")
    return {"lancamento": {k: lanc.get(k) for k in campos},
            "despesas": despesas, "historico": historico}
