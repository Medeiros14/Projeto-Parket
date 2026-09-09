"""parket-docusign — backend pra fluxo de assinatura de contratos via DocuSign.

Endpoints:
  POST /api/docusign/envelopes        — cria envelope, envia
  GET  /api/docusign/envelopes/{id}   — status atual (do banco + DocuSign)
  POST /api/docusign/webhook          — callback DocuSign Connect
  GET  /api/docusign/by-card/{cid}    — lista contratos do card
  GET  /healthz
"""
from __future__ import annotations
import base64
import structlog
from fastapi import FastAPI, HTTPException, Request, Depends
from fastapi.responses import Response as FastResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

import httpx as _httpx

from . import docusign_client as ds
from . import supabase_client as sb
from .config import get_settings
from .pdf_render import html_to_pdf
from .boleto_pdf import render_boleto_html, parket_beneficiario

# Endpoint do parket-ai-squad pra notificações WhatsApp no Financeiro.
# Centraliza envio via Evolution através do "agente.parket.works".
AGENTE_NOTIFY_URL = "https://agente.parket.works/api/contracts/docusign-notify"


async def _notify_agente(action: str, card_id: str | None,
                         envelope_id: str | None,
                         signatarios: list | None = None,
                         obra: str | None = None,
                         cliente: str | None = None,
                         extra: str | None = None) -> None:
    """Dispara notificação WhatsApp via agente.parket.works. Best-effort:
    falhas só são logadas, não afetam o fluxo principal de envelope."""
    payload = {
        "action": action,
        "card_id": card_id,
        "envelope_id": envelope_id,
        "obra": obra,
        "cliente": cliente,
        "signatarios": signatarios or [],
        "extra": extra,
    }
    try:
        async with _httpx.AsyncClient(timeout=10) as c:
            r = await c.post(AGENTE_NOTIFY_URL, json=payload)
        if r.status_code >= 400:
            logger.warning("agente_notify_failed",
                           status=r.status_code, body=r.text[:200])
    except Exception as e:
        logger.warning("agente_notify_exception", err=str(e))

logger = structlog.get_logger(__name__)
app = FastAPI(title="parket-docusign", version="0.1.0")

# CORS — frontends podem chamar de space.parket.works, core.parket.works,
# e ambientes de dev locais. Cookies são compartilhados via SameSite=None
# se necessário; auth de fato é via Supabase JWT no header.
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://space.parket.works",
        "https://core.parket.works",
        "https://valor.parket.works",
        "https://proposta.parket.works",
        "http://localhost:5173",
        "http://localhost:5174",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ─── Schemas ───────────────────────────────────────────────────────────

class Signatario(BaseModel):
    nome: str
    email: str
    papel: str  # contratante | contratado | testemunha1 | testemunha2
    anchor: str  # ex: "\\sign_contratante\\"
    # Opcionais — usados só pra testemunhas. Se vier, o DocuSign pré-preenche
    # o textTab com esse valor (a testemunha ainda pode editar). Se vazio,
    # ela preenche do zero no ato da assinatura.
    rg: str | None = None
    cpf: str | None = None


class CriarEnvelopeReq(BaseModel):
    card_id: str = Field(..., description="UUID do kanban_card")
    pdf_base64: str = Field(..., description="PDF do contrato em base64")
    pdf_filename: str = "contrato.pdf"
    email_subject: str = "Contrato Parket — Assinatura"
    email_blurb: str = "Por favor, revise e assine o contrato anexo."
    signatarios: list[Signatario]
    notes: str | None = None
    titulo: str | None = Field(
        None,
        description="Ex: 'Contrato Principal', 'Aditivo 1'. Se None, "
                    "backend calcula baseado no histórico.",
    )


class CriarEnvelopeHtmlReq(BaseModel):
    """Igual ao CriarEnvelopeReq, mas o backend renderiza o PDF a partir do
    HTML — evita o passo manual de 'Abrir e imprimir → Salvar como PDF'."""
    card_id: str
    html_base64: str = Field(..., description="HTML do contrato em base64 UTF-8")
    pdf_filename: str = "contrato.pdf"
    email_subject: str = "Contrato Parket — Assinatura"
    email_blurb: str = "Por favor, revise e assine o contrato anexo."
    signatarios: list[Signatario]
    notes: str | None = None
    titulo: str | None = None


# ─── Helpers ──────────────────────────────────────────────────────────

def _witness_text_tabs(idx: str, s: "Signatario") -> list[dict]:
    """Cria 3 textTabs (Nome, RG, CPF) na área da testemunha. Ancoras invisíveis
    `\\wit{1,2}_nome\\`, `\\wit{1,2}_rg\\`, `\\wit{1,2}_cpf\\` no PDF marcam
    a posição. Se `rg`/`cpf` vieram do frontend, chegam pré-preenchidos —
    caso contrário, a testemunha digita no ato da assinatura."""
    common = {
        "anchorXOffset": "0",
        "anchorYOffset": "-3",   # sobe um cadinho pra alinhar em cima do rótulo "Nome:/RG:/CPF:"
        "anchorUnits": "pixels",
        "anchorIgnoreIfNotPresent": "true",
        "required": "true",
        "width": "180",
        "height": "14",
        "font": "helvetica",
        "fontSize": "size9",
    }
    return [
        {"tabLabel": f"wit{idx}_nome",
         "anchorString": f"\\wit{idx}_nome\\",
         "value": s.nome or "",
         **common},
        {"tabLabel": f"wit{idx}_rg",
         "anchorString": f"\\wit{idx}_rg\\",
         "value": s.rg or "",
         **common},
        {"tabLabel": f"wit{idx}_cpf",
         "anchorString": f"\\wit{idx}_cpf\\",
         "value": s.cpf or "",
         **common},
    ]


def _signers_for_docusign(signs: list[Signatario]) -> list[dict]:
    """Converte signatários do request pro formato DocuSign — todos paralelos
    (routingOrder=1). Cada um ancorado em sua string.

    Testemunhas (papel=testemunha1/testemunha2) recebem 3 textTabs extras
    pra que preencham nome/RG/CPF no ato da assinatura.

    Nota: NÃO setamos `clientUserId` aqui — fica como "remote signing",
    o DocuSign manda email automaticamente. Pra gerar link embedded sob
    demanda (WhatsApp), o endpoint /signing-url adiciona clientUserId
    via PUT no momento do request."""
    out = []
    for i, s in enumerate(signs, start=1):
        tabs: dict = {
            "signHereTabs": [{
                "anchorString": s.anchor,
                "anchorXOffset": "0",
                "anchorYOffset": "0",
                "anchorUnits": "pixels",
                "anchorIgnoreIfNotPresent": "false",
            }],
            "dateSignedTabs": [{
                "anchorString": s.anchor,
                "anchorXOffset": "200",   # data à direita da assinatura
                "anchorYOffset": "0",
                "anchorUnits": "pixels",
                "anchorIgnoreIfNotPresent": "true",
            }],
        }
        if s.papel == "testemunha1":
            tabs["textTabs"] = _witness_text_tabs("1", s)
        elif s.papel == "testemunha2":
            tabs["textTabs"] = _witness_text_tabs("2", s)

        out.append({
            "recipientId": str(i),
            "routingOrder": "1",
            "name": s.nome,
            "email": s.email,
            "roleName": s.papel,
            "tabs": tabs,
        })
    return out


# ─── OTP do termo de contratação (assinatura eletrônica) ─────────────
# Código de 6 dígitos enviado por WhatsApp via Evolution; prova de posse
# do número no aceite do termo (valor.parket.works/termo-v2.html).
# Guarda em memória: serviço roda com 1 réplica; TTL 10min.

import os
import secrets as _secrets
import time as _time

from . import evolution as _evolution

_OTP_STORE: dict[str, dict] = {}
# Instância "Parket" (default do módulo) está desconectada; OTP sai pela CS PARKET.
_OTP_INSTANCE = os.getenv("TERMO_OTP_INSTANCE", "CS PARKET")
_OTP_TTL = 600
_OTP_RESEND_COOLDOWN = 45
_OTP_MAX_TRIES = 5


class TermoOtpIn(BaseModel):
    whatsapp: str


class TermoOtpChecaIn(BaseModel):
    whatsapp: str
    otp: str


def _otp_fone(v: str) -> str:
    return "".join(ch for ch in (v or "") if ch.isdigit())


@app.post("/api/docusign/termo/otp")
async def termo_otp(body: TermoOtpIn):
    fone = _otp_fone(body.whatsapp)
    if len(fone) < 10 or len(fone) > 13:
        return {"ok": False, "error": "Confira o WhatsApp (DDD + número)."}
    now = _time.time()
    reg = _OTP_STORE.get(fone)
    if reg and now - reg["last_sent"] < _OTP_RESEND_COOLDOWN:
        return {"ok": False, "error": "Código já enviado. Aguarde alguns segundos para reenviar."}
    for k in [k for k, r in _OTP_STORE.items() if r["exp"] < now]:
        _OTP_STORE.pop(k, None)
    code = f"{_secrets.randbelow(1_000_000):06d}"
    _OTP_STORE[fone] = {"code": code, "exp": now + _OTP_TTL, "tries": 0, "last_sent": now}
    numero = fone if len(fone) > 11 else "55" + fone
    texto = ("Parket: seu código de assinatura eletrônica é " + code + ".\n"
             "Ele confirma o seu WhatsApp no aceite do termo de contratação e vale por 10 minutos.\n"
             "Se você não estiver assinando agora, ignore esta mensagem.")
    ok = await _evolution.send_text(numero, texto, instance=_OTP_INSTANCE)
    if not ok:
        _OTP_STORE.pop(fone, None)
        return {"ok": False, "error": "Não foi possível enviar agora. Tente novamente em instantes."}
    logger.info("termo_otp_enviado", fone=fone[-4:])
    return {"ok": True}


@app.post("/api/docusign/termo/otp/checa")
async def termo_otp_checa(body: TermoOtpChecaIn, request: Request):
    fone = _otp_fone(body.whatsapp)
    reg = _OTP_STORE.get(fone)
    now = _time.time()
    if not reg or reg["exp"] < now:
        _OTP_STORE.pop(fone, None)
        return {"ok": False, "error": "Código expirado. Toque em reenviar para receber um novo."}
    reg["tries"] += 1
    if reg["tries"] > _OTP_MAX_TRIES:
        _OTP_STORE.pop(fone, None)
        return {"ok": False, "error": "Muitas tentativas. Peça um novo código."}
    if body.otp.strip() != reg["code"]:
        return {"ok": False, "error": "Código não confere. Confira os 6 dígitos e tente de novo."}
    _OTP_STORE.pop(fone, None)
    fwd = request.headers.get("x-forwarded-for", "")
    ip = fwd.split(",")[0].strip() if fwd else (request.client.host if request.client else "")
    logger.info("termo_otp_validado", fone=fone[-4:])
    return {"ok": True, "ip": ip}


# ─── Pagamento da 1ª parcela do termo (Itaú Bolecode) ────────────────
# Uma chamada à API "Boleto com Pix" gera boleto e QR Pix juntos.
# ITAU_ENV=sandbox aponta pro dev.itau.com; sem ITAU_CLIENT_ID o backend
# cai em modo simulado (payloads em formato válido, nada é cobrado).
# Estado guardado em memória (1 réplica, mesmo racional do OTP).
# Confirmação de pagamento: cobrança emitida de verdade no Itaú consulta a
# API Boletos v3 (GET /boletos — única com cenário provisionado no sandbox
# pra nossa credencial, 25/08). Cobrança simulada segue auto-CONCLUIDA por
# tempo (~25s) pra permitir a validação do fluxo.

import datetime as _dt
import re as _re

_PAG_STORE: dict[str, dict] = {}
_PAG_TTL = 3600 * 6
_ITAU_ENV = os.getenv("ITAU_ENV", "sandbox")
_ITAU_CLIENT_ID = os.getenv("ITAU_CLIENT_ID", "")
_ITAU_CLIENT_SECRET = os.getenv("ITAU_CLIENT_SECRET", "")
_ITAU_PIX_KEY = os.getenv("ITAU_PIX_KEY", "")
# Beneficiário Itaú da Parket. Defaults = exemplo do spec sandbox; sobrescrever
# em produção via env do service parket-docusign_api.
_ITAU_BENEFICIARIO_ID = os.getenv("ITAU_BENEFICIARIO_ID", "150000052061")
_ITAU_CODIGO_CARTEIRA = os.getenv("ITAU_CODIGO_CARTEIRA", "109")
_ITAU_CODIGO_ESPECIE = os.getenv("ITAU_CODIGO_ESPECIE", "01")
# "simulacao" valida e devolve os dados sem emitir; "efetivacao" emite de verdade.
_ITAU_ETAPA = os.getenv("ITAU_ETAPA", "simulacao")
if _ITAU_ENV == "sandbox":
    _ITAU_OAUTH_URL = "https://sandbox.devportal.itau.com.br/api/oauth/jwt"
    # Sandbox da Boleto com Pix: host devportal + basePath da API + Authorization
    # Bearer (mesmo header da producao). O gateway `/sandboxapi/` seria pra outras
    # APIs e nao serve pra essa: sempre devolve 401 pq espera x-sandbox-token.
    _ITAU_BOLECODE_BASE = "https://sandbox.devportal.itau.com.br/itau-ep9-api-recebimentos-v1-externo/v1"
    # Consulta Boletos v3: cenario provisionado pra nossa credencial (scope
    # cashmanagement-consultaboletos-v1) — o GET /boletos devolve dados
    # mockados. Usada pra checar "boleto pago".
    _ITAU_BOLETOS_V3_BASE = "https://sandbox.devportal.itau.com.br/itau-ep9-gtw-boletos-boletos-v3-ext-aws/v1"
    # Emissao de boleto SEM Pix (pivô 25/08): Cash Management v2. No sandbox o
    # POST /v2/boletos tem cenario provisionado pra nossa credencial (200 com
    # emissao mock completa), ao contrario do Bolecode que devolve 500
    # "Cenario de teste nao mapeado". E a perna de emissao do rail atual:
    # emitir aqui -> confirmar via webhook/consulta Boletos v3.
    _ITAU_CASHMGMT_BASE = "https://sandbox.devportal.itau.com.br/itau-ep9-gtw-cash-management-ext-v2/v2"
else:
    _ITAU_OAUTH_URL = "https://sts.itau.com.br/as/token.oauth2"
    _ITAU_BOLECODE_BASE = "https://pix-pj.api.itau.com/recebimentos-pix/v1"
    _ITAU_BOLETOS_V3_BASE = "https://api.gateway.itau.com.br/boletos/v3"
    # Base de producao do Cash Management v2 ainda nao confirmada com o Itau;
    # configuravel por env pra nao exigir novo build quando fecharmos o contrato.
    _ITAU_CASHMGMT_BASE = os.getenv(
        "ITAU_CASHMGMT_BASE", "https://api.gateway.itau.com.br/cash_management/v2"
    )

# ---- Pix Recebimentos (regulatorio-pix/v2, padrao Bacen) -------------------
# Fluxo one-shot pro termo: POST /cob emite QR imediato (Itau gera txid), o
# response ja traz `pixCopiaECola` (EMV pronto pra copia-e-cola) e `location`
# (URL do payload). Status via GET /cob/{txid}: ATIVA -> CONCLUIDA quando
# banco confirma. Nao usa webhook por enquanto (exige mTLS + cadastro DICT).
if _ITAU_ENV == "sandbox":
    _ITAU_PIX_BASE = "https://sandbox.devportal.itau.com.br/itau-ep9-api-regulatorio-pix-v2-externo/v2"
else:
    _ITAU_PIX_BASE = os.getenv(
        "ITAU_PIX_BASE", "https://pix-pj.api.itau.com/regulatorio-pix/v2"
    )
# Chave Pix da conta recebedora (contrato Parket -> pamella@parket.com.br).
_ITAU_PIX_CHAVE = os.getenv("ITAU_PIX_CHAVE", "pamella@parket.com.br")
# Token bearer preset (sandbox devportal emite JWT com TTL 5min via UI). Se
# nao setado, cai no _itau_token() (client_credentials). Serve pra testar
# a integracao antes de ter client_id/secret com scope pix-recebimentos.
_ITAU_PIX_TOKEN_OVERRIDE = os.getenv("ITAU_PIX_TOKEN", "")
# Tempo de vida da cobranca em segundos (Itau default = 86400; deixamos 3600
# porque a UI do termo espera pagamento imediato — QR fresco).
_ITAU_PIX_EXPIRACAO_S = int(os.getenv("ITAU_PIX_EXPIRACAO_S", "3600"))

_PAG_SIM_CONFIRMA_S = 25

# ---- Webhook Boletos v3 (notificacao de pagamento) ------------------------
# O Itau autentica NO NOSSO endpoint OAuth (client_credentials com Basic auth)
# e depois POSTa as baixas (BAIXA_EFETIVA/BAIXA_OPERACIONAL) no webhook_url.
# Credenciais que NOS damos ao Itau no cadastro: vem do env; sem env gera um
# par efemero por processo (suficiente pra sandbox, pois o cadastro e refeito
# a cada teste; em producao SEMPRE setar via docker service update --env-add).
_ITAU_WEBHOOK_CLIENT_ID = os.getenv("ITAU_WEBHOOK_CLIENT_ID", "") or ("parket-" + _secrets.token_hex(8))
_ITAU_WEBHOOK_CLIENT_SECRET = os.getenv("ITAU_WEBHOOK_CLIENT_SECRET", "") or _secrets.token_hex(24)
_ITAU_WEBHOOK_URL = os.getenv(
    "ITAU_WEBHOOK_URL",
    "https://core.parket.works/api/docusign/termo/pagamento/itau/webhook",
)
_ITAU_WEBHOOK_OAUTH_URL = _ITAU_WEBHOOK_URL + "/oauth"
# Tokens emitidos pro Itau: token -> epoch de expiracao (TTL 300s, igual ao deles).
_ITAU_WEBHOOK_TOKENS: dict[str, float] = {}
_ITAU_WEBHOOK_TOKEN_TTL = 300


class TermoPagamentoIn(BaseModel):
    valor: float
    nome: str = ""
    cpf: str = ""
    # Prazo do boleto em dias corridos a partir de hoje. Vem do bdias[0] do
    # link do termo (modelo Monofloor: primeiro numero = vencimento da
    # entrada); sem o parametro cai no padrao historico de 5 dias.
    dias_vencimento: int = 5
    # Contexto opcional pra enriquecer o PDF do boleto — o cliente ve tudo
    # explicito (o que esta pagando, referente a que proposta/obra, quanto
    # falta pagar depois). Zero impacto na emissao Itau; so o PDF usa.
    endereco: str = ""
    proposta_numero: str = ""
    obra_ref: str = ""
    valor_total: float | None = None
    entrada_pct: float | None = None
    condicoes_pagamento: str = ""
    # PKT-TERMO-CORE-20260827: id da simulacao_projetos (link do termo). Com
    # ele o webhook de baixa do Itau consegue gravar a compensacao DURAVEL em
    # meta.termo.compensacao da sim — e o watcher (perna 7) baixa a parcela
    # no core.lancamentos mesmo que a pagina do cliente ja tenha fechado.
    sim_id: str = ""


def _itau_tem_credencial() -> bool:
    return bool(_ITAU_CLIENT_ID and _ITAU_CLIENT_SECRET)


def _pag_limpa(now: float) -> None:
    for k in [k for k, r in _PAG_STORE.items() if now - r["criado"] > _PAG_TTL]:
        _PAG_STORE.pop(k, None)


def _emv_campo(tag: str, valor: str) -> str:
    return f"{tag}{len(valor):02d}{valor}"


def _emv_crc16(payload: str) -> str:
    crc = 0xFFFF
    for ch in payload.encode("utf-8"):
        crc ^= ch << 8
        for _ in range(8):
            crc = ((crc << 1) ^ 0x1021) if (crc & 0x8000) else (crc << 1)
            crc &= 0xFFFF
    return f"{crc:04X}"


def _pix_emv(chave: str, valor: float, nome: str, txid: str) -> str:
    mai = _emv_campo("00", "br.gov.bcb.pix") + _emv_campo("01", chave)
    nome_l = (nome or "PARKET")[:25].upper()
    payload = (
        _emv_campo("00", "01")
        + _emv_campo("26", mai)
        + _emv_campo("52", "0000")
        + _emv_campo("53", "986")
        + _emv_campo("54", f"{valor:.2f}")
        + _emv_campo("58", "BR")
        + _emv_campo("59", nome_l)
        + _emv_campo("60", "SAO PAULO")
        + _emv_campo("62", _emv_campo("05", txid[:25]))
        + "6304"
    )
    return payload + _emv_crc16(payload)


def _boleto_mod10(seq: str) -> int:
    total, peso = 0, 2
    for d in reversed(seq):
        p = int(d) * peso
        total += p if p < 10 else p - 9
        peso = 1 if peso == 2 else 2
    return (10 - total % 10) % 10


def _boleto_mod11(seq: str) -> int:
    total, peso = 0, 2
    for d in reversed(seq):
        total += int(d) * peso
        peso = 2 if peso == 9 else peso + 1
    dv = 11 - total % 11
    return 1 if dv in (0, 10, 11) else dv


def _boleto_simulado(valor: float, vencimento: _dt.date) -> str:
    # Fator de vencimento pós-reset de 22/02/2025 (= 1000).
    fator = 1000 + (vencimento - _dt.date(2025, 2, 22)).days
    valor_s = f"{round(valor * 100):010d}"
    livre = f"{_secrets.randbelow(10**25):025d}"
    corpo = f"3419{fator:04d}{valor_s}{livre}"
    dv_geral = _boleto_mod11(corpo)
    barra = f"341{dv_geral}9{fator:04d}{valor_s}{livre}"[:44]
    c1 = f"3419{livre[:5]}"
    c2 = livre[5:15]
    c3 = livre[15:25]
    return (
        f"{c1}{_boleto_mod10(c1)}"
        f"{c2}{_boleto_mod10(c2)}"
        f"{c3}{_boleto_mod10(c3)}"
        f"{dv_geral}"
        f"{fator:04d}{valor_s}"
    )


async def _itau_token() -> str | None:
    try:
        async with _httpx.AsyncClient(timeout=15) as cli:
            r = await cli.post(
                _ITAU_OAUTH_URL,
                data={
                    "grant_type": "client_credentials",
                    "client_id": _ITAU_CLIENT_ID,
                    "client_secret": _ITAU_CLIENT_SECRET,
                },
                headers={"Content-Type": "application/x-www-form-urlencoded"},
            )
            if r.status_code == 200:
                return r.json().get("access_token")
            logger.warning("itau_token_falhou", status=r.status_code, corpo=r.text[:200])
    except Exception as exc:
        logger.warning("itau_token_erro", erro=str(exc))
    return None


def _nosso_numero() -> str:
    # Itaú aceita 8 dígitos; enquanto não temos faixa reservada, derivamos do
    # timestamp em ms para garantir unicidade dentro da instância.
    return f"{int(_time.time() * 1000) % 100000000:08d}"


def _itau_valor(v: float) -> str:
    # Formato da recebimentos v1 (Bolecode): pattern ^\d+\.\d{2}$.
    # R$ 1.199,00 -> "1199.00".
    return f"{int(round(v * 100)) / 100:.2f}"


def _itau_valor17(v: float) -> str:
    # Formato da Cash Management v2: valor em CENTAVOS, zero-padded em 17
    # posicoes (mock oficial: R$ 100,01 -> "00000000000010001"). Diferente da
    # v1 acima; nao reaproveitar.
    return f"{int(round(v * 100)):017d}"


# O schema OpenAPI nome_pessoa exige ^[a-zA-Z\sáàâãéèêíïóôõöúçñÁÀÂÃÉÈÊÍÏÓÔÕÖÚÇÑ]+$:
# so letras (ASCII), espaco, e o conjunto de acentuadas + c/n cedilha. Dígitos,
# hifens, virgulas, apostrofos etc reprovam. Whitelist bate 1:1 com o regex.
_ITAU_TEXTO_OK = _re.compile(r"[^a-zA-Z\sáàâãéèêíïóôõöúçñÁÀÂÃÉÈÊÍÏÓÔÕÖÚÇÑ]")
# Palavras que o Itaú rejeita em qualquer campo texto (docs de integração).
_ITAU_PALAVRAS_PROIBIDAS = _re.compile(r"\b(http|https|javascript|alert)\b", _re.I)
# Colapsar espacos multiplos em um so, pra nao passar "Joao   Silva".
_ESPACOS_MULTIPLOS = _re.compile(r"\s+")


def _itau_texto(s: str, limite: int) -> str:
    if not s:
        return ""
    # 1) remove palavras proibidas pela doc
    limpo = _ITAU_PALAVRAS_PROIBIDAS.sub(" ", s)
    # 2) troca qualquer char fora do whitelist do schema por espaco
    limpo = _ITAU_TEXTO_OK.sub(" ", limpo)
    # 3) colapsa espacos e trim
    limpo = _ESPACOS_MULTIPLOS.sub(" ", limpo).strip()
    return limpo[:limite]


def _pagador_do_body(body: "TermoPagamentoIn") -> dict:
    cpf = _otp_fone(body.cpf)[:11] or "00000000000"
    return {
        "pessoa": {
            "nome_pessoa": _itau_texto(body.nome, 50) or "Cliente Parket",
            "tipo_pessoa": {
                "codigo_tipo_pessoa": "F",
                "numero_cadastro_pessoa_fisica": cpf,
            },
        },
        "endereco": {
            "nome_logradouro": "Nao informado",
            "nome_bairro": "Nao informado",
            "nome_cidade": "Sao Paulo",
            "sigla_UF": "SP",
            "numero_CEP": "01310100",
        },
    }


async def _itau_pix_token() -> str | None:
    """Bearer pra API regulatorio-pix. Prioriza override manual (env
    ITAU_PIX_TOKEN, JWT copiado do devportal) e cai no OAuth compartilhado com
    boleto (client_credentials)."""
    if _ITAU_PIX_TOKEN_OVERRIDE:
        return _ITAU_PIX_TOKEN_OVERRIDE
    return await _itau_token()


def _itau_pix_valor(v: float) -> str:
    # Formato Bacen: ^\d{1,10}\.\d{2}$ (ex: "1234.56"). Sem separador de
    # milhar, ponto como decimal. Bate com o campo valor.original do /cob.
    return f"{int(round(v * 100)) / 100:.2f}"


def _itau_pix_devedor(body: "TermoPagamentoIn") -> dict:
    """Bloco devedor no schema Bacen. Aceita cpf OU cnpj (nao os dois) +
    nome. Se nao tem cpf/cnpj valido, omite (campo e opcional)."""
    doc = _re.sub(r"\D", "", body.cpf or "")
    nome = _itau_texto(body.nome, 200)
    if not nome:
        return {}
    if len(doc) == 11:
        return {"cpf": doc, "nome": nome}
    if len(doc) == 14:
        return {"cnpj": doc, "nome": nome}
    return {}


async def _itau_pix_criar_cob(body: "TermoPagamentoIn") -> dict | None:
    """POST /cob (Itau gera txid). Devolve dict com txid, pixCopiaECola,
    location, status. None em falha (fallback simulado assume)."""
    token = await _itau_pix_token()
    if not token:
        return None
    payload = {
        "calendario": {"expiracao": _ITAU_PIX_EXPIRACAO_S},
        "valor": {"original": _itau_pix_valor(body.valor)},
        "chave": _ITAU_PIX_CHAVE,
    }
    devedor = _itau_pix_devedor(body)
    if devedor:
        payload["devedor"] = devedor
    # solicitacaoPagador aparece pro cliente no app do banco na hora de pagar
    if body.proposta_numero:
        payload["solicitacaoPagador"] = _itau_texto(
            f"Parket - Proposta {body.proposta_numero}", 140
        )
    corr = _secrets.token_hex(4) + "-" + _secrets.token_hex(2) + "-"
    corr += _secrets.token_hex(2) + "-" + _secrets.token_hex(2) + "-" + _secrets.token_hex(6)
    try:
        async with _httpx.AsyncClient(timeout=25) as cli:
            r = await cli.post(
                f"{_ITAU_PIX_BASE}/cob",
                json=payload,
                headers={
                    "Authorization": f"Bearer {token}",
                    "Content-Type": "application/json",
                    "Accept": "application/json",
                    "x-itau-apikey": _ITAU_CLIENT_ID,
                    "x-itau-correlationID": corr,
                    "x-itau-flowID": "termo-pix-cob",
                },
            )
        if r.status_code not in (200, 201):
            logger.warning("itau_pix_cob_falhou", status=r.status_code, corpo=r.text[:400])
            return None
        d = r.json() or {}
        txid = d.get("txid") or ""
        emv = d.get("pixCopiaECola") or ""
        if not txid or not emv:
            logger.warning("itau_pix_cob_resposta_incompleta", txid=bool(txid), emv=bool(emv))
            return None
        return {
            "txid": txid,
            "pix_emv": emv,
            "location": d.get("location", ""),
            "status": d.get("status", "ATIVA"),
        }
    except Exception as exc:
        logger.warning("itau_pix_cob_erro", erro=str(exc))
        return None


async def _itau_pix_consulta_cob(txid: str) -> dict | None:
    """GET /cob/{txid}. Devolve {status, valor_pago} ou None."""
    token = await _itau_pix_token()
    if not token:
        return None
    try:
        async with _httpx.AsyncClient(timeout=15) as cli:
            r = await cli.get(
                f"{_ITAU_PIX_BASE}/cob/{txid}",
                headers={
                    "Authorization": f"Bearer {token}",
                    "Accept": "application/json",
                    "x-itau-apikey": _ITAU_CLIENT_ID,
                },
            )
        if r.status_code != 200:
            logger.warning("itau_pix_consulta_falhou", status=r.status_code, corpo=r.text[:300])
            return None
        d = r.json() or {}
        return {
            "status": d.get("status", ""),
            "valor": (d.get("valor") or {}).get("original", ""),
            "pix": d.get("pix") or [],
            # EMV oficial pra copia-e-cola: o GET /cob devolve o mesmo
            # pixCopiaECola da criação — usado pelo Core pra reenviar
            # a cobrança sem depender do _PAG_STORE em memória.
            "copia_e_cola": d.get("pixCopiaECola", ""),
        }
    except Exception as exc:
        logger.warning("itau_pix_consulta_erro", erro=str(exc))
        return None


async def _itau_bolecode(body: "TermoPagamentoIn", vencimento: _dt.date) -> dict | None:
    """Emite um Bolecode (boleto + Pix na mesma chamada) e devolve os campos
    normalizados. None em qualquer falha."""
    token = await _itau_token()
    if not token:
        return None
    valor = _itau_valor(body.valor)
    dado_boleto = {
        "descricao_instrumento_cobranca": "boleto_pix",
        "tipo_boleto": "a vista",
        "codigo_carteira": _ITAU_CODIGO_CARTEIRA,
        "codigo_especie": _ITAU_CODIGO_ESPECIE,
        "valor_total_titulo": valor,
        "data_emissao": _dt.date.today().isoformat(),
        "pagador": _pagador_do_body(body),
        "dados_individuais_boleto": [
            {
                "numero_nosso_numero": _nosso_numero(),
                "data_vencimento": vencimento.isoformat(),
                "valor_titulo": valor,
            }
        ],
    }
    payload = {
        "etapa_processo_boleto": _ITAU_ETAPA,
        "codigo_canal_operacao": "API",
        "beneficiario": {"id_beneficiario": _ITAU_BENEFICIARIO_ID},
        "dado_boleto": dado_boleto,
    }
    if _ITAU_PIX_KEY:
        payload["dados_qrcode"] = {"chave": _ITAU_PIX_KEY, "tipo_cobranca": "cob"}
    corr = _secrets.token_hex(4) + "-" + _secrets.token_hex(2) + "-"
    corr += _secrets.token_hex(2) + "-" + _secrets.token_hex(2) + "-" + _secrets.token_hex(6)
    # Sandbox e producao usam o mesmo header Authorization Bearer.
    auth_headers = {"Authorization": f"Bearer {token}"}
    try:
        async with _httpx.AsyncClient(timeout=25) as cli:
            r = await cli.post(
                f"{_ITAU_BOLECODE_BASE}/boletos-pix",
                json=payload,
                headers={
                    **auth_headers,
                    "Content-Type": "application/json",
                    "Accept": "application/json",
                    "x-itau-apikey": _ITAU_CLIENT_ID,
                    "x-itau-correlationID": corr,
                    "x-itau-flowID": "termo-primeiro-pagamento",
                },
            )
        if r.status_code not in (200, 201):
            # 202 = registro assíncrono; sem linha digitável na resposta, então cai
            # no modo simulado em vez de devolver um boleto pela metade.
            logger.warning("itau_bolecode_falhou", status=r.status_code, corpo=r.text[:400])
            return None
        d = r.json()
        dado = d.get("dado_boleto") or {}
        indiv = (dado.get("dados_individuais_boleto") or [{}])[0]
        qr = d.get("dados_qrcode") or dado.get("dados_qrcode") or {}
        return {
            "id_boleto_individual": indiv.get("id_boleto_individual", ""),
            "numero_nosso_numero": indiv.get("numero_nosso_numero", ""),
            "linha_digitavel": indiv.get("numero_linha_digitavel", ""),
            "codigo_barras": indiv.get("codigo_barras", ""),
            "data_vencimento": indiv.get("data_vencimento", vencimento.isoformat()),
            "pix_emv": qr.get("emv", ""),
            "pix_base64": qr.get("base64", ""),
            "pix_txid": qr.get("txid", ""),
            "pix_location": qr.get("location", ""),
        }
    except Exception as exc:
        logger.warning("itau_bolecode_erro", erro=str(exc))
        return None


async def _itau_emite_boleto(body: "TermoPagamentoIn", vencimento: _dt.date) -> dict | None:
    """Emite um boleto SEM Pix via Cash Management v2 (POST /boletos) e devolve
    os campos normalizados (mesmo shape do bolecode, sem os pix_*). None em
    qualquer falha, o caller cai no boleto simulado.

    Pivô 25/08: Bolecode ficou pra depois (sandbox sem cenario); o rail do
    boleto puro fecha com emissao aqui + baixa via webhook/consulta v3."""
    token = await _itau_token()
    if not token:
        return None
    valor = _itau_valor17(body.valor)
    nosso_numero = _nosso_numero()
    payload = {
        "etapa_processo_boleto": _ITAU_ETAPA,
        "codigo_canal_operacao": "API",
        "beneficiario": {"id_beneficiario": _ITAU_BENEFICIARIO_ID},
        "dado_boleto": {
            "descricao_instrumento_cobranca": "boleto",
            "forma_envio": "impressao",
            "tipo_boleto": "a vista",
            "codigo_carteira": _ITAU_CODIGO_CARTEIRA,
            "codigo_especie": _ITAU_CODIGO_ESPECIE,
            "valor_total_titulo": valor,
            "data_emissao": _dt.date.today().isoformat(),
            "pagador": _pagador_do_body(body),
            "dados_individuais_boleto": [
                {
                    "numero_nosso_numero": nosso_numero,
                    "data_vencimento": vencimento.isoformat(),
                    "valor_titulo": valor,
                }
            ],
        },
    }
    corr = "-".join(
        _secrets.token_hex(n) for n in (4, 2, 2, 2, 6)
    )  # formato uuid, exigido pelo header de correlacao
    try:
        async with _httpx.AsyncClient(timeout=25) as cli:
            r = await cli.post(
                f"{_ITAU_CASHMGMT_BASE}/boletos",
                json=payload,
                headers={
                    "Authorization": f"Bearer {token}",
                    "Content-Type": "application/json",
                    "Accept": "application/json",
                    "x-itau-apikey": _ITAU_CLIENT_ID,
                    "x-itau-correlationID": corr,
                    "x-itau-flowID": "termo-primeiro-pagamento",
                },
            )
        if r.status_code not in (200, 201):
            logger.warning("itau_emissao_falhou", status=r.status_code, corpo=r.text[:400])
            return None
        d = r.json()
        dado = d.get("dado_boleto") or {}
        indiv = (dado.get("dados_individuais_boleto") or [{}])[0]
        linha = indiv.get("numero_linha_digitavel", "")
        if not linha:
            # Sem linha digitavel nao tem o que mostrar pro cliente; melhor o
            # simulado completo do que uma emissao pela metade.
            logger.warning("itau_emissao_sem_linha", corpo=r.text[:300])
            return None
        return {
            "id_boleto_individual": indiv.get("id_boleto_individual", ""),
            # Nosso numero da RESPOSTA (mock sandbox devolve um canned diferente
            # do enviado); e ele que a consulta v3 e o webhook vao casar.
            "numero_nosso_numero": indiv.get("numero_nosso_numero", nosso_numero),
            "linha_digitavel": linha,
            "codigo_barras": indiv.get("codigo_barras", ""),
            "data_vencimento": indiv.get("data_vencimento", vencimento.isoformat()),
        }
    except Exception as exc:
        logger.warning("itau_emissao_erro", erro=str(exc))
        return None


async def _itau_consulta_boletos(nosso_numero: str = "") -> list[dict] | None:
    """GET /boletos da API Boletos v3 (consulta). Devolve a lista crua data[]
    ou None em qualquer falha (token, HTTP, rede)."""
    token = await _itau_token()
    if not token:
        return None
    params = {"id_beneficiario": _ITAU_BENEFICIARIO_ID}
    if nosso_numero:
        params["nosso_numero"] = nosso_numero
    try:
        async with _httpx.AsyncClient(timeout=20) as cli:
            r = await cli.get(
                f"{_ITAU_BOLETOS_V3_BASE}/boletos",
                params=params,
                headers={
                    "Authorization": f"Bearer {token}",
                    "Accept": "application/json",
                    "x-itau-apikey": _ITAU_CLIENT_ID,
                    "x-itau-flowID": "termo-consulta-pagamento",
                },
            )
        if r.status_code != 200:
            logger.warning("itau_consulta_falhou", status=r.status_code, corpo=r.text[:300])
            return None
        return (r.json() or {}).get("data") or []
    except Exception as exc:
        logger.warning("itau_consulta_erro", erro=str(exc))
        return None


def _itau_boleto_pago(b: dict) -> bool:
    # Pago/baixado = qualquer evidencia de liquidacao na resposta da consulta
    # (pagamento registrado, valor pago, baixa ou situacao terminal).
    sit = ((b.get("situacao_geral_boleto") or {}).get("descricao") or "").strip().lower()
    return bool(
        b.get("data_inclusao_pagamento")
        or b.get("valor_pago_total")
        or b.get("data_baixa")
        or sit in ("paga", "pago", "baixada", "liquidada", "liquidado")
    )


@app.post("/api/docusign/termo/pagamento/pix")
async def termo_pagamento_pix(body: TermoPagamentoIn):
    if body.valor <= 0:
        return {"ok": False, "error": "Valor da parcela inválido."}
    now = _time.time()
    _pag_limpa(now)

    # Perna real: API Pix Recebimentos (regulatorio-pix/v2). O `POST /cob` do
    # Itau gera o txid e devolve o pixCopiaECola (EMV oficial, aceito por
    # qualquer app de banco). Sem token/credencial, cai no simulado abaixo.
    dados = await _itau_pix_criar_cob(body)
    if dados:
        txid = dados["txid"]
        _PAG_STORE[txid] = {
            "criado": now, "modo": "pix", "simulado": False, "valor": body.valor,
            "pix_cob": dados,
            "sim_id": body.sim_id,
        }
        logger.info("termo_pix_criado", txid=txid, ambiente=_ITAU_ENV)
        return {
            "ok": True, "txid": txid, "copia_e_cola": dados["pix_emv"],
            "qr_base64": "", "valor": body.valor,
            "simulado": False, "ambiente": _ITAU_ENV,
        }
    logger.warning("itau_pix_fallback_simulado")

    # Fallback simulado: EMV local pra dev/teste. Nunca vira "CONCLUIDA" por
    # tempo — igual boleto, so muda quando o banco confirmar (que no simulado
    # nunca acontece; e proposital pra evitar falsos positivos).
    txid = "PKTTERMO" + _secrets.token_hex(9).upper()
    copia = _pix_emv(_ITAU_PIX_CHAVE or "pix@parket.com.br", body.valor, "PARKET", txid)
    _PAG_STORE[txid] = {"criado": now, "modo": "pix", "simulado": True, "valor": body.valor,
                        "sim_id": body.sim_id}
    logger.info("termo_pix_criado_simulado", txid=txid)
    return {
        "ok": True, "txid": txid, "copia_e_cola": copia, "qr_base64": "",
        "valor": body.valor, "simulado": True, "ambiente": "simulado",
    }


@app.get("/api/docusign/termo/pagamento/pix/{txid}")
async def termo_pagamento_pix_status(txid: str):
    reg = _PAG_STORE.get(txid)
    if not reg:
        return {"ok": False, "error": "Cobrança não encontrada ou expirada."}
    # Cobranca emitida de verdade: consulta GET /cob/{txid} — status Bacen
    # muda pra CONCLUIDA so quando o banco confirma o Pix recebido. Nunca
    # marca pago por tempo (Will 27/08: so o banco confirma).
    if not reg.get("simulado"):
        cob = await _itau_pix_consulta_cob(txid)
        if cob and cob.get("status"):
            status = cob["status"].upper()
            # Bacen: ATIVA (pendente), CONCLUIDA (pago), REMOVIDO_* (cancelado).
            return {
                "ok": True,
                "status": "CONCLUIDA" if status == "CONCLUIDA" else "ATIVA",
                "simulado": False,
                "fonte": "itau_pix_cob",
                "status_bacen": status,
                "ambiente": _ITAU_ENV,
            }
    # Fallback: sem consulta ou modo simulado, mantem ATIVA (nunca auto-CONCLUIDA).
    return {
        "ok": True,
        "status": "ATIVA",
        "simulado": bool(reg.get("simulado")),
        "fonte": "aguardando_banco",
        "ambiente": _ITAU_ENV if not reg.get("simulado") else "simulado",
    }


@app.get("/api/docusign/termo/pagamento/itau/consulta")
async def termo_pagamento_itau_consulta(nosso_numero: str = ""):
    # Diagnóstico da conexão real com o Itaú (Boletos v3). Só no sandbox:
    # em produção a listagem de boletos não pode ficar exposta sem auth.
    if _ITAU_ENV != "sandbox":
        return {"ok": False, "error": "Disponível apenas em sandbox."}
    if not _itau_tem_credencial():
        return {"ok": False, "error": "Sem credencial Itaú configurada."}
    boletos = await _itau_consulta_boletos(nosso_numero)
    if boletos is None:
        return {"ok": False, "error": "Consulta Itaú falhou (ver logs)."}
    return {"ok": True, "ambiente": "sandbox", "total": len(boletos), "boletos": boletos}


# ---- Webhook Boletos v3: endpoints que o ITAU chama na gente ---------------

def _webhook_credencial_ok(cid: str, csec: str) -> bool:
    # Comparacao em tempo constante pra nao vazar credencial por timing.
    return _secrets.compare_digest(cid, _ITAU_WEBHOOK_CLIENT_ID) and _secrets.compare_digest(
        csec, _ITAU_WEBHOOK_CLIENT_SECRET
    )


@app.post("/api/docusign/termo/pagamento/itau/webhook/oauth")
async def termo_itau_webhook_oauth(request: Request):
    # Endpoint OAuth2 client_credentials exigido pelo contrato do webhook v3:
    # antes de cada notificacao o Itau se autentica AQUI e espera um JSON com
    # access_token. Aceita Basic auth (formato da doc) ou client_id/secret no
    # corpo form-urlencoded (tolerancia, alguns gateways mandam assim).
    cid, csec = "", ""
    auth = request.headers.get("authorization", "")
    if auth.lower().startswith("basic "):
        try:
            dec = base64.b64decode(auth[6:]).decode("utf-8", "replace")
            cid, _, csec = dec.partition(":")
        except Exception:
            pass
    form = {}
    try:
        form = dict(await request.form())
    except Exception:
        pass
    if not cid:
        cid = str(form.get("client_id", ""))
        csec = str(form.get("client_secret", ""))
    grant = str(form.get("grant_type", "client_credentials"))
    if grant != "client_credentials" or not _webhook_credencial_ok(cid, csec):
        logger.warning("itau_webhook_oauth_negado", grant=grant, cid=cid[:12])
        raise HTTPException(status_code=401, detail="invalid_client")
    # Limpa tokens vencidos e emite um novo com TTL de 300s.
    now = _time.time()
    for t in [t for t, exp in _ITAU_WEBHOOK_TOKENS.items() if exp < now]:
        _ITAU_WEBHOOK_TOKENS.pop(t, None)
    token = _secrets.token_urlsafe(32)
    _ITAU_WEBHOOK_TOKENS[token] = now + _ITAU_WEBHOOK_TOKEN_TTL
    logger.info("itau_webhook_oauth_ok")
    return {"access_token": token, "token_type": "Bearer", "expires_in": _ITAU_WEBHOOK_TOKEN_TTL}


@app.post("/api/docusign/termo/pagamento/itau/webhook")
async def termo_itau_webhook(request: Request):
    # Receiver das notificacoes de baixa (tipoLiquidacao 06=liquidacao,
    # 95=baixa operacional). Casa cada boleto notificado com uma cobranca em
    # _PAG_STORE por nosso numero ou txid (bolecode) e marca pago_webhook.
    auth = request.headers.get("authorization", "")
    token = auth[7:] if auth.lower().startswith("bearer ") else ""
    exp = _ITAU_WEBHOOK_TOKENS.get(token, 0)
    if not token or exp < _time.time():
        raise HTTPException(status_code=401, detail="invalid_token")
    try:
        corpo = await request.json()
    except Exception:
        raise HTTPException(status_code=400, detail="json_invalido")
    boletos = (corpo or {}).get("boletos") or []
    processados = 0
    for b in boletos:
        nn = str(b.get("numeroNossoNumero", "") or "")
        txid = str(b.get("txid", "") or "")
        for chave, reg in _PAG_STORE.items():
            bc = reg.get("bolecode") or {}
            em = reg.get("emissao") or {}
            # Casa por nosso numero (bolecode OU emissao cash mgmt v2) ou txid
            # do bolecode; a chave do store tambem conta (cobranca simulada nao
            # tem bolecode/emissao, mas a chave E o txid/bid).
            if (
                (nn and str(bc.get("numero_nosso_numero", "")) == nn)
                or (nn and str(em.get("numero_nosso_numero", "")) == nn)
                or (txid and bc.get("pix_txid") == txid)
                or (txid and chave == txid)
                or (nn and chave == nn)
            ):
                reg["pago_webhook"] = True
                reg["webhook_notif"] = b
                processados += 1
                # PKT-TERMO-CORE-20260827: persiste a compensacao na sim
                # (meta.termo.compensacao) pra sobreviver a restart e pagina
                # fechada — a perna 7 do watcher baixa a parcela CT- no
                # core.lancamentos a partir desse marcador. try/except pra
                # nunca quebrar a resposta 200 do webhook (o Itau re-tenta
                # em caso de erro e nao queremos loop).
                sim_id = str(reg.get("sim_id") or "")
                if sim_id:
                    try:
                        ok = await sb.gravar_termo_compensacao(sim_id, {
                            "em": _dt.datetime.now(_dt.timezone.utc).isoformat(),
                            "chave": chave,
                            "modo": reg.get("modo", ""),
                            "nosso_numero": nn,
                            "txid": txid,
                            "valor_pago": str(b.get("valorPago", "") or b.get("valor", "") or ""),
                            "tipo_liquidacao": str(b.get("tipoLiquidacao", "") or ""),
                            "simulado": bool(reg.get("simulado")),
                        })
                        logger.info("itau_webhook_compensacao_sim",
                                    sim_id=sim_id, chave=chave, persistiu=ok)
                    except Exception as e:
                        logger.warning("itau_webhook_compensacao_erro",
                                       sim_id=sim_id, erro=str(e))
    logger.info("itau_webhook_recebido", boletos=len(boletos), processados=processados)
    return {"ok": True, "recebidos": len(boletos), "processados": processados}


async def _itau_webhook_cadastrar() -> dict:
    """POST /notificacoes_boletos: registra nosso webhook no Itau (formato
    {"data": {...}} da doc oficial). Devolve {status, corpo} cru pro diagnostico."""
    token = await _itau_token()
    if not token:
        return {"status": -1, "corpo": "sem token"}
    payload = {
        "data": {
            "id_beneficiario": _ITAU_BENEFICIARIO_ID,
            "webhook_url": _ITAU_WEBHOOK_URL,
            "webhook_client_id": _ITAU_WEBHOOK_CLIENT_ID,
            "webhook_client_secret": _ITAU_WEBHOOK_CLIENT_SECRET,
            "webhook_oauth_url": _ITAU_WEBHOOK_OAUTH_URL,
            # Notifica qualquer valor; queremos tanto a liquidacao (BAIXA_EFETIVA)
            # quanto a baixa operacional (Pix do bolecode cai como 95).
            "valor_minimo": "0.01",
            "tipos_notificacoes": ["BAIXA_EFETIVA", "BAIXA_OPERACIONAL"],
        }
    }
    try:
        async with _httpx.AsyncClient(timeout=20) as cli:
            r = await cli.post(
                f"{_ITAU_BOLETOS_V3_BASE}/notificacoes_boletos",
                json=payload,
                headers={
                    "Authorization": f"Bearer {token}",
                    "Content-Type": "application/json",
                    "Accept": "application/json",
                    "x-itau-apikey": _ITAU_CLIENT_ID,
                    "x-itau-correlationid": _secrets.token_hex(16),
                },
            )
        try:
            corpo = r.json()
        except Exception:
            corpo = r.text[:500]
        return {"status": r.status_code, "corpo": corpo}
    except Exception as exc:
        return {"status": -1, "corpo": str(exc)}


async def _itau_webhook_consultar() -> dict:
    """GET /notificacoes_boletos: lista os cadastros de webhook do beneficiario."""
    token = await _itau_token()
    if not token:
        return {"status": -1, "corpo": "sem token"}
    try:
        async with _httpx.AsyncClient(timeout=20) as cli:
            r = await cli.get(
                f"{_ITAU_BOLETOS_V3_BASE}/notificacoes_boletos",
                params={"id_beneficiario": _ITAU_BENEFICIARIO_ID},
                headers={
                    "Authorization": f"Bearer {token}",
                    "Accept": "application/json",
                    "x-itau-apikey": _ITAU_CLIENT_ID,
                },
            )
        try:
            corpo = r.json()
        except Exception:
            corpo = r.text[:500]
        return {"status": r.status_code, "corpo": corpo}
    except Exception as exc:
        return {"status": -1, "corpo": str(exc)}


@app.get("/api/docusign/termo/pagamento/itau/webhook/cadastro")
async def termo_itau_webhook_cadastro(registrar: bool = False):
    # Diagnostico do cadastro do webhook no Itau. Só sandbox: em producao o
    # cadastro sera feito uma vez no deploy, nao por endpoint aberto.
    if _ITAU_ENV != "sandbox":
        return {"ok": False, "error": "Disponível apenas em sandbox."}
    if not _itau_tem_credencial():
        return {"ok": False, "error": "Sem credencial Itaú configurada."}
    resultado = {"ok": True, "webhook_url": _ITAU_WEBHOOK_URL, "oauth_url": _ITAU_WEBHOOK_OAUTH_URL}
    if registrar:
        resultado["cadastro"] = await _itau_webhook_cadastrar()
    resultado["consulta"] = await _itau_webhook_consultar()
    return resultado


@app.post("/api/docusign/termo/pagamento/boleto")
async def termo_pagamento_boleto(body: TermoPagamentoIn):
    # Cria o boleto do primeiro pagamento. Pivô 25/08: emissao via Cash
    # Management v2 (boleto puro, sem Pix) no lugar do Bolecode, que segue
    # bloqueado no sandbox. Fallback: boleto simulado (nada e cobrado).
    if body.valor <= 0:
        return {"ok": False, "error": "Valor da parcela inválido."}
    now = _time.time()
    _pag_limpa(now)
    # Vencimento negociado (bdias[0] do link), com clamp 1..180 dias pra
    # nao emitir boleto vencido nem prazo absurdo por parametro malformado.
    try:
        dias = max(1, min(180, int(body.dias_vencimento or 5)))
    except (TypeError, ValueError):
        dias = 5
    vencimento = _dt.date.today() + _dt.timedelta(days=dias)

    if _itau_tem_credencial():
        dados = await _itau_emite_boleto(body, vencimento)
        if dados and dados.get("linha_digitavel"):
            bid = dados.get("id_boleto_individual") or ("PKTBOL" + _secrets.token_hex(6).upper())
            _PAG_STORE[bid] = {
                "criado": now, "modo": "boleto", "simulado": False, "valor": body.valor,
                # Chave "emissao" (nao "bolecode"): o status e o webhook casam
                # pelo nosso numero daqui.
                "emissao": dados,
                "sim_id": body.sim_id,
                # Dados do pagador + contexto do contrato guardados aqui pra
                # o PDF renderizar sem depender de nova chamada.
                "pagador": {"nome": body.nome, "cpf": body.cpf, "endereco": body.endereco},
                "contexto": {
                    "proposta_numero": body.proposta_numero,
                    "obra_ref": body.obra_ref,
                    "valor_total": body.valor_total,
                    "entrada_pct": body.entrada_pct,
                    "condicoes_pagamento": body.condicoes_pagamento,
                },
                "vencimento": dados.get("data_vencimento", vencimento.isoformat()),
            }
            logger.info("termo_boleto_criado", bid=bid, ambiente=_ITAU_ENV)
            return {
                "ok": True, "id": bid,
                "linha_digitavel": dados["linha_digitavel"],
                "codigo_barras": dados.get("codigo_barras", ""),
                "vencimento": dados.get("data_vencimento", vencimento.isoformat()),
                "valor": body.valor, "simulado": False, "ambiente": _ITAU_ENV,
            }
        logger.warning("itau_emissao_boleto_fallback_simulado")

    linha = _boleto_simulado(body.valor, vencimento)
    bid = "PKTBOL" + _secrets.token_hex(6).upper()
    _PAG_STORE[bid] = {
        "criado": now, "modo": "boleto", "simulado": True, "valor": body.valor,
        "linha_digitavel": linha,
        "sim_id": body.sim_id,
        "pagador": {"nome": body.nome, "cpf": body.cpf, "endereco": body.endereco},
        "contexto": {
            "proposta_numero": body.proposta_numero,
            "obra_ref": body.obra_ref,
            "valor_total": body.valor_total,
            "entrada_pct": body.entrada_pct,
            "condicoes_pagamento": body.condicoes_pagamento,
        },
        "vencimento": vencimento.isoformat(),
    }
    logger.info("termo_boleto_criado_simulado", bid=bid)
    return {
        "ok": True, "id": bid, "linha_digitavel": linha, "codigo_barras": "",
        "vencimento": vencimento.isoformat(), "valor": body.valor,
        "simulado": True, "ambiente": "simulado",
    }


@app.get("/api/docusign/termo/pagamento/boleto/{bid}")
async def termo_pagamento_boleto_status(bid: str):
    # Status do boleto (mesma cascata do Pix): 1) webhook de baixa v3 (push,
    # fonte mais confiavel), 2) consulta Boletos v3 pelo nosso numero,
    # 3) confirmacao simulada por tempo (~25s) pra nao travar o fluxo.
    reg = _PAG_STORE.get(bid)
    if not reg:
        return {"ok": False, "error": "Boleto não encontrado ou expirado."}
    if reg.get("pago_webhook"):
        return {
            "ok": True, "status": "CONCLUIDA",
            "simulado": bool(reg.get("simulado")),
            "fonte": "itau_webhook", "ambiente": _ITAU_ENV,
        }
    if not reg.get("simulado") and _itau_tem_credencial():
        nn = (reg.get("emissao") or {}).get("numero_nosso_numero", "")
        boletos = await _itau_consulta_boletos(nn)
        if boletos is not None:
            alvo = next((b for b in boletos if b.get("numero_nosso_numero") == nn), None)
            # Nao usar boletos[0] do mock como fallback — isso confirmava
            # pagamento com dados aleatorios de outros titulos que o sandbox
            # devolve. Sem match do nosso_numero real, fica ATIVA.
            if alvo is not None:
                return {
                    "ok": True,
                    "status": "CONCLUIDA" if _itau_boleto_pago(alvo) else "ATIVA",
                    "simulado": False,
                    "fonte": "itau_boletos_v3",
                    "ambiente": _ITAU_ENV,
                }
    # Sem webhook e sem confirmacao real da consulta v3: fica ATIVA. Nunca
    # marcar CONCLUIDA por tempo — Will 27/08: pagamento so eh confirmado
    # quando o banco confirma. Simulado ou nao, o fluxo do Concluir do termo
    # nao depende disso (btPagConcluir ja fica liberado na emissao).
    return {
        "ok": True,
        "status": "ATIVA",
        "simulado": bool(reg.get("simulado")),
        "fonte": "aguardando_banco",
        "ambiente": _ITAU_ENV if not reg.get("simulado") else "simulado",
    }


@app.get("/api/docusign/termo/pagamento/boleto/{bid}/pdf")
async def termo_pagamento_boleto_pdf(bid: str):
    """PDF do boleto (recibo do pagador + ficha bancária padrão FEBRABAN).
    Renderiza HTML via Playwright a partir dos dados guardados em _PAG_STORE
    no momento da emissão. Não bate no Itau (Cash Management v2 não devolve
    PDF; só linha digitável + código de barras)."""
    from fastapi.responses import Response
    reg = _PAG_STORE.get(bid)
    if not reg or reg.get("modo") != "boleto":
        raise HTTPException(404, "Boleto não encontrado ou expirado.")
    em = reg.get("emissao") or {}
    linha = em.get("linha_digitavel") or reg.get("linha_digitavel", "")
    cod_barras = em.get("codigo_barras", "")
    if not cod_barras and linha:
        # linha digitável 47 dig → código de barras 44 dig (regra CNAB).
        # Só pra simulado: pega os campos e monta o 44 dígitos.
        d = "".join(c for c in linha if c.isdigit())
        if len(d) == 47:
            cod_barras = (d[0:4] + d[32:33] + d[33:47] + d[4:9] + d[10:20] + d[21:31])
    pagador = reg.get("pagador") or {}
    ctx = reg.get("contexto") or {}
    dados = {
        "linha_digitavel": linha,
        "codigo_barras": cod_barras,
        "valor": float(reg.get("valor", 0) or 0),
        "vencimento": reg.get("vencimento", ""),
        "emissao": _dt.date.today().isoformat(),
        "nosso_numero": em.get("numero_nosso_numero", bid),
        "pagador_nome": pagador.get("nome", ""),
        "pagador_cpf": pagador.get("cpf", ""),
        "pagador_endereco": pagador.get("endereco", ""),
        "proposta_numero": ctx.get("proposta_numero", ""),
        "obra_ref": ctx.get("obra_ref", ""),
        "valor_total": ctx.get("valor_total"),
        "entrada_pct": ctx.get("entrada_pct"),
        "condicoes_pagamento": ctx.get("condicoes_pagamento", ""),
        "especie": "R$",
        **parket_beneficiario(),
    }
    html = render_boleto_html(dados)
    pdf = await html_to_pdf(html)
    return Response(content=pdf, media_type="application/pdf",
                    headers={"Content-Disposition": f'inline; filename="boleto-parket-{bid}.pdf"'})


# ─── Reenvio de cobrança (detalhe da parcela no Core) ─────────────────
# Will 28/08: o vendedor abre a parcela no Core e pode (a) reenviar a
# cobrança de verdade pelo WhatsApp (Evolution, não wa.me) e (b) mudar a
# data de vencimento — que pro termo significa EMITIR UM BOLETO NOVO com
# o prazo renegociado. A re-emissão regrava meta.termo.pagamento na sim;
# a perna 7 do watcher vê o boleto_id novo e re-anota a parcela no
# core.lancamentos (linha digitável + vencimento) sozinha.

class TermoCobrancaReenviarIn(BaseModel):
    # id da simulacao_projetos (o TERMO-<sim_id> do lançamento). Obrigatório
    # pra re-emissão; opcional no envio puro (parcela CT-/NF- sem termo).
    sim_id: str = ""
    # Destino WhatsApp (dígitos, DDI 55 opcional). Vazio = não envia.
    telefone: str = ""
    # Texto final da mensagem, montado e conferido pelo operador no Core.
    mensagem: str = ""
    # AAAA-MM-DD. Presente = re-emite o boleto do termo com esse prazo.
    novo_vencimento: str = ""


# Rate limit em memória por número: evita rajada de reenvio pro cliente
# (endpoint é aberto como os demais do termo; o freio fica no servidor).
_COBRANCA_RL: dict[str, float] = {}


@app.post("/api/docusign/termo/cobranca/reenviar")
async def termo_cobranca_reenviar(body: TermoCobrancaReenviarIn):
    boleto_out = None

    # 1) Novo vencimento → boleto novo (nunca mexe em cobrança já paga).
    if body.novo_vencimento:
        if not body.sim_id:
            return {"ok": False, "error": "Sem proposta vinculada: mudar o vencimento do boleto exige o termo."}
        try:
            nova_data = _dt.date.fromisoformat(body.novo_vencimento)
        except ValueError:
            return {"ok": False, "error": "Data de vencimento inválida."}
        dias = (nova_data - _dt.date.today()).days
        if dias < 1 or dias > 180:
            return {"ok": False, "error": "O novo vencimento precisa ficar entre amanhã e 180 dias."}
        sim = await sb.get_sim_termo(body.sim_id)
        if not sim:
            return {"ok": False, "error": "Proposta do termo não encontrada."}
        termo = (sim.get("meta") or {}).get("termo") or {}
        pag = dict(termo.get("pagamento") or {})
        if pag.get("modo") != "boleto" or not pag.get("linha_digitavel"):
            return {"ok": False, "error": "Esta cobrança não tem boleto emitido pelo termo."}
        if pag.get("pago") or termo.get("compensacao"):
            return {"ok": False, "error": "Boleto já compensado: não dá pra mudar o vencimento."}

        # Pagador vem do aceite do termo (meta.termo.dados) — mesma fonte
        # que preencheu o boleto original na página do cliente.
        d = termo.get("dados") or {}
        endereco = ", ".join(x for x in [
            " ".join(p for p in [d.get("rua"), d.get("numero")] if p),
            d.get("complemento"), d.get("bairro"),
            "/".join(p for p in [d.get("cidade"), d.get("uf")] if p),
            d.get("cep"),
        ] if x)
        plano = pag.get("plano") or {}
        emis = await termo_pagamento_boleto(TermoPagamentoIn(
            valor=float(pag.get("valor") or 0),
            nome=d.get("nome") or sim.get("cliente") or "",
            cpf=d.get("cpf_cnpj") or "",
            dias_vencimento=dias,
            endereco=endereco,
            proposta_numero=str(sim.get("numero") or ""),
            obra_ref=" ".join(p for p in [d.get("obra_rua"), d.get("obra_numero")] if p),
            valor_total=float(plano.get("total") or 0) or None,
            entrada_pct=pag.get("entrada_pct"),
            sim_id=body.sim_id,
        ))
        if not emis.get("ok"):
            return {"ok": False, "error": emis.get("error") or "Falha na emissão do boleto novo."}

        # Regrava o pagamento com o boleto NOVO (id novo → watcher re-anota
        # a parcela). Trilha: reemitido_de guarda o boleto substituído.
        pag_novo = {
            **pag,
            "boleto_id": emis["id"],
            "linha_digitavel": emis["linha_digitavel"],
            "vencimento": emis["vencimento"],
            "simulado": bool(emis.get("simulado")),
            "em": _dt.datetime.now(_dt.timezone.utc).isoformat(),
            "reemitido_de": pag.get("boleto_id"),
            "reemitido_via": "core-detalhe-parcela",
        }
        gravado = await sb.gravar_termo_pagamento(body.sim_id, pag_novo)
        logger.info("termo_cobranca_boleto_reemitido", sim_id=body.sim_id,
                    de=pag.get("boleto_id"), para=emis["id"], gravado=gravado)
        boleto_out = {
            "id": emis["id"], "linha_digitavel": emis["linha_digitavel"],
            "vencimento": emis["vencimento"], "simulado": bool(emis.get("simulado")),
        }

    # 2) Envio real pelo WhatsApp (Evolution) — o operador já conferiu o
    # texto no Core; aqui só validamos destino/tamanho e seguramos rajada.
    enviado = False
    if body.mensagem.strip() and body.telefone:
        num = _re.sub(r"\D", "", body.telefone)
        if len(num) < 10 or len(num) > 13:
            return {"ok": False, "boleto": boleto_out, "error": "Telefone inválido."}
        if len(num) <= 11:
            num = "55" + num
        if len(body.mensagem) > 2000:
            return {"ok": False, "boleto": boleto_out, "error": "Mensagem longa demais."}
        now = _time.time()
        if now - _COBRANCA_RL.get(num, 0.0) < 20:
            return {"ok": False, "boleto": boleto_out,
                    "error": "Aguarde alguns segundos antes de reenviar pro mesmo número."}
        _COBRANCA_RL[num] = now
        enviado = await _evolution.send_text(num, body.mensagem.strip())
        if not enviado:
            return {"ok": False, "boleto": boleto_out, "error": "O WhatsApp não confirmou o envio. Tente de novo."}
        logger.info("termo_cobranca_reenviada", to=num, sim_id=body.sim_id or None)

    return {"ok": True, "enviado": enviado, "boleto": boleto_out}


@app.get("/api/docusign/termo/cobranca/pagamento")
async def termo_cobranca_pagamento(sim_id: str = ""):
    """Instrumento de cobrança da parcela pro Core (Will 28/08).

    QUÊ: o gestor financeiro abre a parcela e precisa do que MANDAR pro
    cliente: a linha digitável + PDF do boleto, ou o Pix copia-e-cola.
    Este GET lê meta.termo.pagamento da sim e devolve pronto pra copiar.
    POR QUÊ: o EMV do Pix não fica gravado na parcela (só o txid); aqui a
    gente reconstrói — cobrança real via GET /cob do Itaú (pixCopiaECola
    oficial), simulada regenerando o EMV local (determinístico por
    chave+valor+txid)."""
    if not sim_id:
        return {"ok": False, "error": "sim_id obrigatório."}
    sim = await sb.get_sim_termo(sim_id)
    if not sim:
        return {"ok": False, "error": "Proposta do termo não encontrada."}
    termo = (sim.get("meta") or {}).get("termo") or {}
    pag = termo.get("pagamento") or {}
    pago = bool(pag.get("pago") or termo.get("compensacao"))
    modo = pag.get("modo") or None

    if modo == "boleto":
        return {"ok": True, "modo": "boleto", "pago": pago, "boleto": {
            "id": pag.get("boleto_id"),
            "linha_digitavel": pag.get("linha_digitavel"),
            "vencimento": pag.get("vencimento"),
            "simulado": bool(pag.get("simulado")),
        }}

    if modo == "pix":
        txid = str(pag.get("txid") or "")
        try:
            valor = float(pag.get("valor") or 0)
        except (TypeError, ValueError):
            valor = 0.0
        emv = ""
        # Cobrança real: pixCopiaECola oficial direto do banco.
        if txid and not pag.get("simulado"):
            cob = await _itau_pix_consulta_cob(txid)
            emv = (cob or {}).get("copia_e_cola") or ""
        # Simulado (ou consulta indisponível): regenera o EMV local.
        if not emv and txid and valor > 0:
            emv = _pix_emv(_ITAU_PIX_CHAVE or "pix@parket.com.br", valor, "PARKET", txid)
        return {"ok": True, "modo": "pix", "pago": pago, "pix": {
            "txid": txid, "copia_e_cola": emv, "valor": valor,
        }}

    return {"ok": True, "modo": None, "pago": pago}


# Cache em memória do "Baixar Boleto" do Core: (sim_id, valor, vencimento)
# -> boleto_id já emitido. Evita emitir um boleto NOVO a cada clique do
# gestor na mesma parcela (duplo clique, reabrir o modal). Expira junto
# com o _PAG_STORE (TTL) e com o restart do serviço.
_BOLETO_PARCELA: dict[tuple[str, str, str], str] = {}


@app.get("/api/docusign/termo/cobranca/boleto-pdf")
async def termo_cobranca_boleto_pdf(sim_id: str = "", valor: float = 0.0, vencimento: str = ""):
    """Baixar Boleto do detalhe da parcela no Core (Will 28/08).

    QUÊ: gera o boleto NA HORA pro valor/vencimento da parcela e devolve o
    PDF direto na resposta — o gestor financeiro baixa e reenvia ele mesmo
    pro cliente, sem depender de boleto pré-emitido pela página do termo.
    COMO: emite via termo_pagamento_boleto (Itaú Cash Mgmt v2 real, ou
    simulado sem credencial) com o pagador do aceite (meta.termo.dados) e
    serve o PDF do _PAG_STORE na mesma chamada.
    POR QUÊ NÃO gravar em meta.termo.pagamento: a sim pode estar em modo
    Pix — sobrescrever o pagamento trocaria o instrumento que o CLIENTE vê
    na página do termo. Este boleto é um canal paralelo do gestor; a troca
    oficial de instrumento continua sendo o "Salvar" do vencimento (que
    re-emite e regrava via /cobranca/reenviar)."""
    if not sim_id:
        raise HTTPException(400, "sim_id obrigatório.")
    sim = await sb.get_sim_termo(sim_id)
    if not sim:
        raise HTTPException(404, "Proposta do termo não encontrada.")
    termo = (sim.get("meta") or {}).get("termo") or {}
    pag = termo.get("pagamento") or {}
    if pag.get("pago") or termo.get("compensacao"):
        raise HTTPException(409, "Cobrança já compensada: não faz sentido emitir boleto.")

    # Valor da parcela vem do Core (cada parcela tem o seu); fallback no
    # valor do pagamento do termo (entrada) se o Core não mandar.
    try:
        v = float(valor or 0) or float(pag.get("valor") or 0)
    except (TypeError, ValueError):
        v = 0.0
    if v <= 0:
        raise HTTPException(400, "Valor da parcela inválido.")

    # Vencimento da parcela → dias corridos a partir de hoje (clamp 1..180:
    # parcela já vencida sai com boleto pra amanhã — banco não aceita
    # emissão vencida).
    dias = 5
    if vencimento:
        try:
            dias = ( _dt.date.fromisoformat(vencimento) - _dt.date.today() ).days
        except ValueError:
            dias = 5
    dias = max(1, min(180, dias))

    # Reuso: mesmo sim+valor+vencimento com boleto ainda vivo no store =
    # serve o mesmo PDF (não registra título duplicado no banco).
    chave = (sim_id, f"{v:.2f}", vencimento or "")
    bid = _BOLETO_PARCELA.get(chave)
    if bid and bid in _PAG_STORE:
        return await termo_pagamento_boleto_pdf(bid)

    # Pagador do aceite do termo (meta.termo.dados) — mesma fonte do boleto
    # que o cliente emitiria na página do termo.
    d = termo.get("dados") or {}
    endereco = ", ".join(x for x in [
        " ".join(p for p in [d.get("rua"), d.get("numero")] if p),
        d.get("complemento"), d.get("bairro"),
        "/".join(p for p in [d.get("cidade"), d.get("uf")] if p),
        d.get("cep"),
    ] if x)
    plano = pag.get("plano") or {}
    emis = await termo_pagamento_boleto(TermoPagamentoIn(
        valor=v,
        nome=d.get("nome") or sim.get("cliente") or "",
        cpf=d.get("cpf_cnpj") or "",
        dias_vencimento=dias,
        endereco=endereco,
        proposta_numero=str(sim.get("numero") or ""),
        obra_ref=" ".join(p for p in [d.get("obra_rua"), d.get("obra_numero")] if p),
        valor_total=float(plano.get("total") or 0) or None,
        entrada_pct=pag.get("entrada_pct"),
        sim_id=sim_id,
    ))
    if not emis.get("ok"):
        raise HTTPException(502, emis.get("error") or "Falha na emissão do boleto.")
    _BOLETO_PARCELA[chave] = emis["id"]
    logger.info("termo_cobranca_boleto_na_hora", sim_id=sim_id, bid=emis["id"],
                valor=v, dias=dias, simulado=bool(emis.get("simulado")))
    return await termo_pagamento_boleto_pdf(emis["id"])


# ─── Endpoints ────────────────────────────────────────────────────────

@app.get("/api/docusign/healthz")
async def healthz():
    s = get_settings()
    return {
        "ok": True,
        "docusign_env": s.docusign_environment,
        "has_key": bool(s.docusign_private_key_pem),
        "has_supabase": bool(s.supabase_service_key),
    }


def env_id_short(envelope_id: str | None) -> str:
    return envelope_id[:8] + "…" if envelope_id else "?"


async def _send_pdf_as_envelope(
    *, pdf_bytes: bytes, card_id: str, pdf_filename: str,
    email_subject: str, email_blurb: str,
    signatarios: list[Signatario], notes: str | None, titulo: str | None,
) -> dict:
    """Fluxo comum: persiste rascunho, envia pro DocuSign, atualiza banco,
    notifica agente. Usado pelos dois endpoints (PDF direto e HTML→PDF)."""
    # 1) Persiste rascunho
    contrato = await sb.insert_contrato(
        card_id=card_id,
        signatarios=[s.model_dump() for s in signatarios],
        notes=notes,
        titulo=titulo,
    )

    # 2) Envelope no DocuSign
    payload = {
        "emailSubject": email_subject,
        "emailBlurb": email_blurb,
        "status": "sent",
        "documents": [{
            "documentId": "1",
            "name": pdf_filename,
            "fileExtension": "pdf",
            "documentBase64": base64.b64encode(pdf_bytes).decode(),
        }],
        "recipients": {"signers": _signers_for_docusign(signatarios)},
    }
    try:
        resp = await ds.create_envelope(payload)
    except Exception as e:
        await sb.update_contrato(contrato["id"], {
            "status": "erro",
            "notes": (notes or "") + f"\nErro DocuSign: {str(e)[:300]}",
        })
        raise HTTPException(502, f"DocuSign falhou: {str(e)[:300]}")

    envelope_id = resp.get("envelopeId")
    # Salva SNAPSHOT do PDF na tabela — imutável mesmo se DocuSign sair do ar.
    # PDFs contrato ficam em torno de 100-400KB (base64 ≈ 130-540KB) — Postgres
    # comprime via TOAST.
    pdf_b64_snapshot = base64.b64encode(pdf_bytes).decode()
    contrato = await sb.update_contrato(contrato["id"], {
        "envelope_id": envelope_id,
        "status": "enviado",
        "sent_at": "now()",
        "pdf_snapshot_b64": pdf_b64_snapshot,
    })
    logger.info("envelope_criado", card_id=card_id, envelope_id=envelope_id,
                snapshot_kb=len(pdf_b64_snapshot) // 1024)

    # Move o card no Kanban de Contratos: novo-contrato → contrato-enviado.
    # Best-effort: se falhar (RLS, etc), não bloqueia o envio.
    try:
        await sb.update_card_column(card_id, "contrato-enviado")
    except Exception as e:
        logger.warning("kanban_move_failed", card_id=card_id, err=str(e)[:200])

    # Cria tarefa de acompanhamento pro vendedor. Resolve pelo card do Financeiro
    # (details.vendedor) — se não achar, ignora. O card_id da tarefa aponta pro
    # card do Comercial (comercial_card_id) pra o vendedor abrir no Homebroker.
    try:
        card = await sb.get_card(card_id)
        det = (card or {}).get("details") or {}
        vendedor_nome = det.get("vendedor") or det.get("responsavel")
        vendedor = await sb.find_vendedor_by_name(vendedor_nome)
        if vendedor:
            cliente = det.get("nome_completo") or det.get("contato_principal") or "cliente"
            signatarios_txt = ", ".join([s.nome for s in signatarios[:3]]) if signatarios else ""
            com_card_id = det.get("comercial_card_id") or card_id
            await sb.create_agenda_tarefa(
                user_id=vendedor["id"], user_nome=vendedor["full_name"],
                titulo=f"Acompanhar assinatura — {cliente}",
                descricao=(f"Contrato enviado pra assinatura via DocuSign "
                           f"({env_id_short(envelope_id)}). "
                           f"Signatários: {signatarios_txt}. "
                           f"Cobrar assinatura + reenviar link se necessário."),
                card_id=com_card_id, prioridade="media",
            )
            await sb.create_notificacao(
                user_id=vendedor["id"], tipo="contrato_enviado",
                titulo=f"Contrato enviado — {cliente}",
                mensagem=f"Contrato foi enviado pra assinatura. Acompanhe no Homebroker.",
                referencia_id=com_card_id,
            )
            logger.info("vendedor_task_created",
                        vendedor=vendedor.get("email"), envelope_id=envelope_id)
    except Exception as e:
        logger.warning("vendedor_task_failed", card_id=card_id, err=str(e)[:200])

    await _notify_agente(
        action="enviado",
        card_id=card_id,
        envelope_id=envelope_id,
        signatarios=[s.model_dump() for s in signatarios],
        obra=email_subject.replace("Contrato Parket — ", "").strip(),
    )
    return contrato


@app.post("/api/docusign/envelopes")
async def criar_envelope(req: CriarEnvelopeReq):
    if not req.signatarios:
        raise HTTPException(400, "signatarios vazio")
    try:
        pdf_bytes = base64.b64decode(req.pdf_base64)
    except Exception as e:
        raise HTTPException(400, f"pdf_base64 inválido: {e}")
    if len(pdf_bytes) < 200:
        raise HTTPException(400, "pdf_base64 muito pequeno — provável erro")

    return await _send_pdf_as_envelope(
        pdf_bytes=pdf_bytes, card_id=req.card_id, pdf_filename=req.pdf_filename,
        email_subject=req.email_subject, email_blurb=req.email_blurb,
        signatarios=req.signatarios, notes=req.notes, titulo=req.titulo,
    )


@app.post("/api/docusign/envelopes-from-html")
async def criar_envelope_from_html(req: CriarEnvelopeHtmlReq):
    """Gera o PDF do contrato server-side (Chromium via Playwright) — assim
    o vendedor/Financeiro NÃO precisa 'Abrir e imprimir → Salvar como PDF'
    antes de enviar. O HTML vem do mesmo `gerarHTMLContrato` do frontend."""
    if not req.signatarios:
        raise HTTPException(400, "signatarios vazio")
    try:
        html_bytes = base64.b64decode(req.html_base64)
        html = html_bytes.decode("utf-8")
    except Exception as e:
        raise HTTPException(400, f"html_base64 inválido: {e}")
    if len(html) < 200:
        raise HTTPException(400, "html muito pequeno — provável erro")

    try:
        pdf_bytes = await html_to_pdf(html)
    except Exception as e:
        logger.error("pdf_render_falhou", err=str(e)[:400])
        raise HTTPException(500, f"Falha ao renderizar PDF: {str(e)[:300]}")

    if len(pdf_bytes) < 500:
        raise HTTPException(500, "PDF renderizado veio vazio — verifique o HTML.")

    return await _send_pdf_as_envelope(
        pdf_bytes=pdf_bytes, card_id=req.card_id, pdf_filename=req.pdf_filename,
        email_subject=req.email_subject, email_blurb=req.email_blurb,
        signatarios=req.signatarios, notes=req.notes, titulo=req.titulo,
    )


@app.get("/api/docusign/envelopes/{envelope_id}")
async def get_envelope_status(envelope_id: str):
    try:
        env = await ds.get_envelope(envelope_id)
    except Exception as e:
        raise HTTPException(502, f"DocuSign: {str(e)[:200]}")
    return env


@app.get("/api/docusign/envelopes/{envelope_id}/pdf")
async def get_envelope_pdf(envelope_id: str):
    """PDF combinado do envelope (documentos + certificado). Usado pelos
    docs unificados pra servir o contrato assinado em qualquer setor."""
    try:
        pdf = await ds.get_envelope_combined_pdf(envelope_id)
    except Exception as e:
        raise HTTPException(502, f"DocuSign: {str(e)[:200]}")
    return FastResponse(
        content=pdf,
        media_type="application/pdf",
        headers={"Content-Disposition": f'inline; filename="contrato-{envelope_id[:8]}.pdf"'},
    )


@app.post("/api/docusign/envelopes/{envelope_id}/refresh")
async def refresh_envelope(envelope_id: str):
    """Re-consulta envelope + recipients no DocuSign e atualiza o banco.
    Dispara notificações WhatsApp pra cada mudança detectada (envelope
    completo, signer individual assinou, etc) — assim funciona mesmo sem
    o DocuSign Connect (webhook) configurado."""
    try:
        env = await ds.get_envelope(envelope_id)
        recipients = await ds.get_envelope_recipients(envelope_id)
    except Exception as e:
        raise HTTPException(502, f"DocuSign: {str(e)[:200]}")

    # Lê estado anterior do banco (pra detectar diffs)
    contratos_existentes = await sb.get_contratos_by_card_or_envelope(envelope_id)
    prev = contratos_existentes[0] if contratos_existentes else {}
    prev_status = (prev.get("status") or "")
    prev_signers = (prev.get("last_event") or {}).get("signers") or []
    prev_signer_status = {
        (s.get("email") or "").lower(): (s.get("status") or "").lower()
        for s in prev_signers
    }

    # Status do envelope inteiro
    docusign_status = (env.get("status") or "").lower()
    status_map = {
        "sent": "enviado",
        "delivered": "enviado",
        "completed": "assinado",
        "declined": "recusado",
        "voided": "cancelado",
        "expired": "expirado",
        "created": "rascunho",
    }
    novo_status = status_map.get(docusign_status, "enviado")

    # Status por signer — extrai de recipients.signers
    signers_status = []
    novos_assinaram: list[dict] = []
    novos_recusaram: list[dict] = []
    for s in recipients.get("signers", []):
        email = (s.get("email") or "").lower()
        atual = (s.get("status") or "").lower()
        anterior = prev_signer_status.get(email, "")
        s_entry = {
            "recipient_id": s.get("recipientId"),
            "name": s.get("name"),
            "email": s.get("email"),
            "papel": s.get("roleName"),
            "status": s.get("status"),
            "signed_at": s.get("signedDateTime"),
            "delivered_at": s.get("deliveredDateTime"),
            "declined_at": s.get("declinedDateTime"),
            "decline_reason": s.get("declinedReason"),
        }
        signers_status.append(s_entry)
        # Detecta NOVA assinatura (atual=completed E anterior!=completed)
        if atual in ("completed", "signed") and anterior not in ("completed", "signed"):
            novos_assinaram.append(s_entry)
        if atual == "declined" and anterior != "declined":
            novos_recusaram.append(s_entry)

    patch: dict = {
        "status": novo_status,
        "last_event": {
            "source": "refresh",
            "envelope_status": docusign_status,
            "signers": signers_status,
        },
    }
    if novo_status == "assinado":
        patch["completed_at"] = env.get("completedDateTime") or "now()"

    updated = await sb.update_contrato_by_envelope(envelope_id, patch)

    # ─── Notificações WhatsApp ───
    card_id = (updated or prev or {}).get("card_id")
    titulo = (updated or prev or {}).get("titulo") or "Contrato"
    signatarios_orig = (updated or prev or {}).get("signatarios") or []

    # 1) Cada signatário individual que ASSINOU agora
    for ns in novos_assinaram:
        await _notify_agente(
            action="assinado",
            card_id=card_id,
            envelope_id=envelope_id,
            signatarios=signatarios_orig,
            extra=f"✍️ *{ns['papel']}* assinou: {ns['name']} ({ns['email']}) — documento *{titulo}*",
        )

    # 2) Cada signatário que RECUSOU
    for ns in novos_recusaram:
        await _notify_agente(
            action="recusado",
            card_id=card_id,
            envelope_id=envelope_id,
            signatarios=signatarios_orig,
            extra=f"⛔ *{ns['papel']}* recusou: {ns['name']} — motivo: {ns.get('decline_reason') or 'sem motivo informado'}",
        )

    # 3) Se o envelope INTEIRO virou "assinado" (todos completaram) e o
    #    status anterior era diferente, dispara notif final.
    if novo_status == "assinado" and prev_status != "assinado":
        await _notify_agente(
            action="assinado",
            card_id=card_id,
            envelope_id=envelope_id,
            signatarios=signatarios_orig,
            extra=f"🎉 Documento *{titulo}* totalmente assinado!",
        )

    return {
        "ok": True,
        "envelope_status": docusign_status,
        "novo_status": novo_status,
        "signers": signers_status,
        "novos_assinaram": len(novos_assinaram),
        "novos_recusaram": len(novos_recusaram),
        "contrato": updated,
    }


@app.post("/api/docusign/envelopes/{envelope_id}/signing-url/{recipient_id}")
async def generate_signing_url(envelope_id: str, recipient_id: str, return_url: str | None = None):
    """Gera embedded signing URL pra um signer específico do envelope.

    Como o envelope foi criado sem clientUserId (remote signing), aqui
    fazemos PUT no signer pra adicionar o clientUserId E DEPOIS chamamos
    /views/recipient. resend_envelope=false garante que não dispara email
    novo.

    A URL retornada é de uso único e expira em ~5 minutos. Cliente deve
    abrir IMEDIATAMENTE — não armazenar em DB."""
    try:
        recipients = await ds.get_envelope_recipients(envelope_id)
    except Exception as e:
        raise HTTPException(502, f"DocuSign: {str(e)[:200]}")

    signer = next(
        (s for s in recipients.get("signers", []) if s.get("recipientId") == recipient_id),
        None,
    )
    if not signer:
        raise HTTPException(404, f"Signer {recipient_id} não encontrado")
    if (signer.get("status") or "").lower() in ("completed", "signed", "declined"):
        raise HTTPException(409, f"Signer já finalizou (status={signer.get('status')})")

    # Garante clientUserId (usa o roleName/papel como identificador estável)
    client_user_id = signer.get("clientUserId") or signer.get("roleName") or f"signer-{recipient_id}"
    if not signer.get("clientUserId"):
        try:
            await ds.update_signer_client_user_id(envelope_id, recipient_id, client_user_id)
        except Exception as e:
            raise HTTPException(502, f"DocuSign update signer: {str(e)[:200]}")

    # Gera URL embedded
    return_to = return_url or "https://core.parket.works/contrato/assinado"
    try:
        url = await ds.create_recipient_view(
            envelope_id=envelope_id,
            recipient_id=recipient_id,
            name=signer.get("name") or "Signatário",
            email=signer.get("email") or "noreply@parket.com.br",
            client_user_id=client_user_id,
            return_url=return_to,
        )
    except Exception as e:
        raise HTTPException(502, f"DocuSign view: {str(e)[:200]}")

    return {"ok": True, "url": url, "recipient_id": recipient_id,
            "name": signer.get("name"), "papel": signer.get("roleName")}


@app.post("/api/docusign/envelopes/{envelope_id}/send-links-whatsapp")
async def send_signing_links_via_whatsapp(envelope_id: str):
    """Gera links pra cada signer ativo e envia mensagem formatada no
    grupo 💰 Parket - Financeiro pra teste. Pra MVP — em prod queremos
    enviar pelo número direto do cliente, não pro grupo."""
    try:
        recipients = await ds.get_envelope_recipients(envelope_id)
    except Exception as e:
        raise HTTPException(502, f"DocuSign: {str(e)[:200]}")

    contratos = await sb.get_contratos_by_card_or_envelope(envelope_id)
    contrato = contratos[0] if contratos else {}
    titulo = (contrato or {}).get("titulo") or "Contrato"
    card_id = (contrato or {}).get("card_id")

    links = []
    for s in recipients.get("signers", []):
        rid = s.get("recipientId")
        if (s.get("status") or "").lower() in ("completed", "signed", "declined"):
            continue
        try:
            client_user_id = s.get("clientUserId") or s.get("roleName") or f"signer-{rid}"
            if not s.get("clientUserId"):
                await ds.update_signer_client_user_id(envelope_id, rid, client_user_id)
            url = await ds.create_recipient_view(
                envelope_id=envelope_id, recipient_id=rid,
                name=s.get("name") or "Signatário",
                email=s.get("email") or "noreply@parket.com.br",
                client_user_id=client_user_id,
                return_url="https://core.parket.works/contrato/assinado",
            )
            links.append({
                "papel": s.get("roleName"), "nome": s.get("name"),
                "email": s.get("email"), "url": url,
            })
        except Exception as e:
            logger.warning("link_gen_failed", recipient=rid, err=str(e))

    if not links:
        return {"ok": False, "reason": "Nenhum signer pendente."}

    # Monta mensagem
    msg_lines = [
        f"🔗 *Links de assinatura — {titulo}*",
        "",
        "Cada signatário tem um link único. Encaminhe abaixo pra cada um pelo WhatsApp:",
        "",
    ]
    for L in links:
        msg_lines.append(f"*{L['papel']}* — {L['nome']}")
        msg_lines.append(f"  {L['url']}")
        msg_lines.append("")
    msg_lines.append(f"⚠️ Cada link expira em ~5 min e é de uso único.")
    msg = "\n".join(msg_lines)

    # Envia pro grupo Financeiro via agente.parket.works
    await _notify_agente(
        action="enviado",
        card_id=card_id,
        envelope_id=envelope_id,
        signatarios=[],
        extra=msg,
    )
    return {"ok": True, "links": links, "count": len(links)}


@app.post("/api/docusign/envelopes/{envelope_id}/cancel")
async def cancel_envelope(envelope_id: str, reason: str = "Cancelado pelo usuário"):
    """Cancela (void) envelope no DocuSign + atualiza banco + notifica."""
    try:
        await ds.void_envelope(envelope_id, reason=reason)
    except Exception as e:
        raise HTTPException(502, f"DocuSign falhou: {str(e)[:200]}")

    contrato = await sb.update_contrato_by_envelope(envelope_id, {
        "status": "cancelado",
        "notes": reason[:500],
    })

    # Notifica grupo Financeiro
    await _notify_agente(
        action="cancelado",
        card_id=(contrato or {}).get("card_id"),
        envelope_id=envelope_id,
        signatarios=(contrato or {}).get("signatarios") or [],
        extra=f"Motivo: {reason[:200]}",
    )
    return {"ok": True, "contrato": contrato}


@app.get("/api/docusign/by-card/{card_id}")
async def por_card(card_id: str):
    rows = await sb.get_contratos_by_card(card_id)
    return rows


@app.post("/api/docusign/reminders/sweep")
async def reminders_sweep(hours: int = 48):
    """Cron endpoint: contratos em 'enviado' há > N horas sem assinatura
    completa recebem uma tarefa + notificação pro vendedor pra reforçar
    com o cliente. Idempotente por dia — se já lembrou hoje, pula.

    Retorna { swept: N, reminded: M, skipped: K, errors: [...] }.
    """
    from datetime import datetime, timezone
    today = datetime.now(timezone.utc).date().isoformat()
    marker = f"reminded:{today}"

    envelopes = await sb.get_stalled_envelopes(hours=hours)
    reminded = 0
    skipped = 0
    errors: list[dict] = []

    for env in envelopes:
        try:
            if marker in (env.get("notes") or ""):
                skipped += 1
                continue
            card_id = env.get("card_id")
            if not card_id:
                skipped += 1
                continue
            card = await sb.get_card(card_id)
            if not card:
                errors.append({"envelope_id": env.get("envelope_id"), "err": "card não achado"})
                continue
            det = (card.get("details") or {})
            vendedor_nome = det.get("vendedor")
            vendedor = await sb.find_vendedor_by_name(vendedor_nome)
            if not vendedor:
                errors.append({"envelope_id": env.get("envelope_id"),
                               "err": f"vendedor '{vendedor_nome}' não achado"})
                continue

            # Signatários que ainda não assinaram (pra mensagem)
            faltam = [
                (s.get("nome") or s.get("name") or s.get("email"))
                for s in (env.get("signatarios") or [])
                if (s.get("status") or "").lower() not in ("completed", "signed")
            ]
            faltam_txt = ", ".join(faltam[:3]) if faltam else "signatários"

            sent_ago_h = 0
            try:
                sent_dt = datetime.fromisoformat(env["sent_at"].replace("Z", "+00:00"))
                sent_ago_h = int((datetime.now(timezone.utc) - sent_dt).total_seconds() / 3600)
            except Exception:
                pass

            cliente = det.get("nome_completo") or det.get("contato_principal") or "cliente"
            motivo = (f"Contrato enviado há {sent_ago_h}h sem assinatura completa. "
                      f"Faltam: {faltam_txt}. Reforçar com {cliente} — "
                      f"reenviar link ou WhatsApp.")

            await sb.create_agenda_tarefa(
                user_id=vendedor["id"], user_nome=vendedor["full_name"],
                titulo=f"Reforçar assinatura — {cliente}",
                descricao=motivo, card_id=card_id, prioridade="alta",
            )
            await sb.create_notificacao(
                user_id=vendedor["id"], tipo="contrato_reminder",
                titulo=f"Contrato pendente — {cliente}",
                mensagem=motivo[:220], referencia_id=card_id,
            )
            await sb.append_contrato_note(env["id"], marker)
            reminded += 1
        except Exception as e:
            errors.append({"envelope_id": env.get("envelope_id"), "err": str(e)[:200]})

    return {"swept": len(envelopes), "reminded": reminded, "skipped": skipped, "errors": errors}


@app.post("/api/docusign/webhook")
async def webhook(request: Request):
    """DocuSign Connect callback. Atualiza status no banco baseado no envelope.

    O payload varia por versão do Connect. Aqui usamos a versão mais nova
    (JSON pra envelope events), mas tolerante a campos faltando."""
    try:
        body = await request.json()
    except Exception:
        body = {}
    envelope_id = (
        body.get("envelopeId")
        or body.get("data", {}).get("envelopeId")
        or body.get("envelope", {}).get("envelopeId")
    )
    status = (
        body.get("status")
        or body.get("data", {}).get("envelopeSummary", {}).get("status")
        or body.get("envelope", {}).get("status")
    )
    logger.info("webhook_received", envelope_id=envelope_id, status=status)

    if not envelope_id:
        return {"ok": False, "reason": "no envelope_id"}

    # Mapeia status DocuSign → nosso vocabulário
    status_map = {
        "sent": "enviado",
        "delivered": "enviado",
        "completed": "assinado",
        "declined": "recusado",
        "voided": "cancelado",
        "expired": "expirado",
    }
    novo_status = status_map.get((status or "").lower(), None)
    patch: dict = {"last_event": body}
    if novo_status:
        patch["status"] = novo_status
        if novo_status == "assinado":
            patch["completed_at"] = "now()"

    contrato = await sb.update_contrato_by_envelope(envelope_id, patch)

    # Auto-move do kanban conforme status:
    #   assinado → 'contrato-assinado' (card Financeiro)
    #           → 'ganho' (card Comercial vinculado, via details.comercial_card_id)
    # (o 'contrato-enviado' já foi feito no momento do send;
    # webhooks `sent/delivered` não movem de novo)
    if novo_status == "assinado" and (contrato or {}).get("card_id"):
        fin_card_id = contrato["card_id"]
        try:
            await sb.update_card_column(fin_card_id, "contrato-assinado")
        except Exception as e:
            logger.warning("kanban_move_signed_failed",
                           card_id=fin_card_id, err=str(e)[:200])
        # Move o card do Comercial pra 'ganho' também
        com_card_id: str | None = None
        try:
            fin_card = await sb.get_card(fin_card_id)
            com_card_id = ((fin_card or {}).get("details") or {}).get("comercial_card_id")
            if com_card_id:
                await sb.update_card_column(com_card_id, "ganho")
                logger.info("comercial_card_moved_ganho",
                            fin_card=fin_card_id, com_card=com_card_id)
        except Exception as e:
            logger.warning("comercial_move_failed",
                           card_id=fin_card_id, err=str(e)[:200])

        # Fecha a proposta na Valoria (orçamentista):
        #   - sim assinada vira status='fechada' (verde na sidebar do card)
        #   - outras sims do mesmo card viram 'perdida' (cinza)
        #   - card do orçamentista vai pra coluna 'proposta-aceita'
        # Rota: com_card_id → simulacao_projetos.selected_at →
        #       meta.valoria_simulacao_id → ops.simulacoes(.card_id)
        # Best-effort: se a rota quebrar (proposta não veio do Valor,
        # meta.valoria_simulacao_id ausente etc.), só loga.
        if com_card_id:
            try:
                val_sim_id, val_card_id = await sb.resolve_valoria_sim_from_comercial(com_card_id)
                if val_sim_id:
                    await sb.mark_valoria_sim_fechada(val_sim_id, envelope_id=envelope_id)
                    if val_card_id:
                        await sb.mark_other_valoria_sims_perdida(val_card_id, except_sim_id=val_sim_id)
                        await sb.update_valoria_card_column(val_card_id, "proposta-aceita")
                    logger.info("valoria_sim_fechada",
                                sim_id=val_sim_id, card_id=val_card_id,
                                com_card=com_card_id, envelope_id=envelope_id)
                else:
                    logger.info("valoria_sim_lookup_miss",
                                com_card=com_card_id, envelope_id=envelope_id)
            except Exception as e:
                logger.warning("valoria_close_failed",
                               com_card=com_card_id, err=str(e)[:200])

    # Notifica grupo Financeiro só pra eventos relevantes (não pra cada
    # `sent` que o DocuSign manda — só quando algum signer terminou de
    # assinar ou o envelope inteiro completou/foi recusado/cancelado).
    if novo_status in ("assinado", "recusado", "cancelado", "expirado"):
        await _notify_agente(
            action=novo_status,
            card_id=(contrato or {}).get("card_id"),
            envelope_id=envelope_id,
            signatarios=(contrato or {}).get("signatarios") or [],
        )
    return {"ok": True}
