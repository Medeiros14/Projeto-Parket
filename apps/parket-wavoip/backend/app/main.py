"""parket-wavoip — backend pra receber webhooks Wavoip e listar gravações.

Endpoints:
  POST /api/wavoip/webhook                 — webhook do Wavoip (CALL/RECORD/DEVICE)
  GET  /api/wavoip/calls?card_id={uuid}    — chamadas de um card
  GET  /api/wavoip/calls?setor=comercial   — lista geral por setor
  GET  /api/wavoip/healthz
"""
from __future__ import annotations
import asyncio
import json
import os
import re
from datetime import datetime, timezone
from typing import Any

import httpx
import structlog
from fastapi import FastAPI, HTTPException, Query, Request
from fastapi.middleware.cors import CORSMiddleware

logger = structlog.get_logger(__name__)
app = FastAPI(title="parket-wavoip", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://space.parket.works",
        "https://core.parket.works",
        "https://homebroker.parket.works",
        "https://valor.parket.works",
        "http://localhost:5173",
        "http://localhost:5174",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def _read_secret(name: str) -> str:
    p = f"/run/secrets/{name}"
    if os.path.exists(p):
        return open(p).read().strip()
    return os.getenv(name.upper(), "")


SUPABASE_URL = _read_secret("supabase_url")
SUPABASE_KEY = _read_secret("supabase_service_key")
WAVOIP_DEVICE_TOKEN = _read_secret("wavoip_device_token")


async def _sb(method: str, path: str, **kw) -> httpx.Response:
    """Wrapper Supabase REST com service_role (bypass RLS)."""
    url = f"{SUPABASE_URL}/rest/v1{path}"
    headers = {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}",
        "Content-Type": "application/json",
        "Prefer": "return=representation",
    }
    headers.update(kw.pop("headers", {}))
    async with httpx.AsyncClient(timeout=10) as c:
        return await c.request(method, url, headers=headers, **kw)


def _normalize_phone(p: str | None) -> str | None:
    """Remove +, espaços, hífens. Mantém apenas dígitos.
    Wavoip manda formatos tipo "5511999999999@s.whatsapp.net" ou "5511999999999"."""
    if not p:
        return None
    p = str(p).split("@")[0]
    return "".join(c for c in p if c.isdigit()) or None


async def _find_card_by_phone(phone: str) -> tuple[str | None, str | None]:
    """Procura kanban_card cujo `details.telefone`/celular/whatsapp/phone bate.
    Retorna (card_id, dept_id) ou (None, None). Compara pelos últimos 10 dígitos
    pra ser tolerante a DDI/formatação. A coluna em kanban_cards é `dept_id`,
    não `setor` — frontend filtra por dept_id começando com 'comercial'."""
    phone_norm = _normalize_phone(phone)
    if not phone_norm:
        return None, None
    suffix = phone_norm[-10:]
    # Tenta vários campos do details onde o telefone pode estar
    for field in ("telefone", "celular", "whatsapp", "phone"):
        r = await _sb(
            "GET",
            f"/kanban_cards?select=id,dept_id,details&details->>{field}=like.*{suffix}*",
        )
        if r.status_code == 200:
            rows = r.json()
            if rows:
                c = rows[0]
                return c.get("id"), c.get("dept_id")
    return None, None


# ──────────────────────────────────────────────────────────────────────
# Webhook
# ──────────────────────────────────────────────────────────────────────


@app.post("/api/wavoip/webhook")
async def webhook(req: Request) -> dict:
    """Recebe eventos CALL/RECORD/DEVICE do Wavoip.

    Documentação: https://wavoip.gitbook.io/api/webhook-beta

    Wavoip não usa header de auth — confiamos no PathPrefix do Traefik
    (que só é acessível via HTTPS).
    """
    try:
        body = await req.json()
    except Exception as e:
        raise HTTPException(400, f"Invalid JSON: {e}")

    ev_type = body.get("type")
    # Loga o body COMPLETO pra investigar o que o Wavoip realmente manda.
    # (em produção daria pra reduzir verbosidade depois de validar.)
    logger.info("wavoip_webhook", type=ev_type, action=body.get("action"), body=body)

    if ev_type == "CALL":
        return await _handle_call(body)
    if ev_type == "RECORD":
        return await _handle_record(body)
    if ev_type == "DEVICE":
        return await _handle_device(body)

    logger.warning("wavoip_unknown_event", body=body)
    return {"ok": True, "ignored": True, "type": ev_type}


async def _handle_call(body: dict) -> dict:
    """Cria ou atualiza wavoip_calls. Dedup por whatsapp_call_id."""
    wcid = str(body.get("whatsapp_call_id") or "")
    if not wcid:
        # alguns eventos UPDATE não trazem whatsapp_call_id; usa id_session
        wcid = f"session-{body.get('id_session')}"

    caller = body.get("caller")
    receiver = body.get("receiver")
    direction = body.get("direction")

    # Tenta linkar a um card pelo número "do outro lado".
    # card_setor recebe o dept_id (ex: "comercial", "comercial-entrada"…).
    other = receiver if direction == "OUTCOMING" else caller
    card_id, card_setor = await _find_card_by_phone(other) if other else (None, None)

    status = body.get("status")
    duration = int(body.get("duration") or 0)
    record_status = body.get("record_status")

    # Campos finais conforme status
    finalizada_em = None
    if status in ("ENDED", "REJECTED", "FAILED", "NOT_ANSWERED", "HANDLED_REMOTELY"):
        finalizada_em = datetime.now(timezone.utc).isoformat()

    # Tentativa de upsert: GET por whatsapp_call_id, INSERT ou PATCH
    r = await _sb(
        "GET",
        f"/wavoip_calls?whatsapp_call_id=eq.{wcid}&select=id",
    )
    existing = r.json() if r.status_code == 200 else []

    payload = {
        "whatsapp_call_id": wcid,
        "id_session": body.get("id_session"),
        "device_token": body.get("device_token") or "",
        "caller": _normalize_phone(caller),
        "receiver": _normalize_phone(receiver),
        "direction": direction,
        "status": status,
        "duration": duration,
        "record_status": record_status,
        "card_id": card_id,
        "card_setor": card_setor,
        "finalizada_em": finalizada_em,
        "webhook_raw": body,
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
    # Remove campos None pra não sobrescrever valores existentes em UPDATE
    payload_clean = {k: v for k, v in payload.items() if v is not None}

    if existing:
        r2 = await _sb(
            "PATCH",
            f"/wavoip_calls?id=eq.{existing[0]['id']}",
            json=payload_clean,
        )
        if r2.status_code >= 400:
            logger.error("wavoip_patch_failed",
                         status=r2.status_code, body=r2.text[:300],
                         payload=payload_clean)
    else:
        # Insert precisa de device_token (NOT NULL); default vazio se faltou
        payload_clean.setdefault("device_token", "")
        r2 = await _sb("POST", "/wavoip_calls", json=payload_clean)
        if r2.status_code >= 400:
            logger.error("wavoip_insert_failed",
                         status=r2.status_code, body=r2.text[:300],
                         payload=payload_clean)

    return {"ok": True}


async def _handle_record(body: dict) -> dict:
    """Atualiza record_url quando a gravação fica pronta."""
    wcid = str(body.get("whatsapp_call_id") or "")
    if not wcid:
        return {"ok": True, "ignored": True}

    patch = {
        "record_status": body.get("record_status"),
        "record_url": body.get("record_url"),
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
    patch = {k: v for k, v in patch.items() if v is not None}
    await _sb("PATCH", f"/wavoip_calls?whatsapp_call_id=eq.{wcid}", json=patch)
    return {"ok": True}


async def _handle_device(body: dict) -> dict:
    """Loga mudança de status do device. Se sair de open/connecting, alerta.

    Por enquanto só loga. Próximo passo: notificar via Evolution se status
    virar `close` ou `error` por mais de X minutos.
    """
    logger.info(
        "wavoip_device_status",
        phone=body.get("phone"),
        status=body.get("status"),
    )
    return {"ok": True}


# ──────────────────────────────────────────────────────────────────────
# Listagem
# ──────────────────────────────────────────────────────────────────────


@app.get("/api/wavoip/calls")
async def list_calls(
    card_id: str | None = Query(None),
    setor: str | None = Query(None),
    limit: int = Query(50, ge=1, le=500),
) -> dict:
    """Lista chamadas, filtrando por card_id ou setor."""
    if not card_id and not setor:
        raise HTTPException(400, "Informe card_id ou setor")

    qs = "?select=*&order=iniciada_em.desc&limit=" + str(limit)
    if card_id:
        qs += f"&card_id=eq.{card_id}"
    if setor:
        qs += f"&card_setor=eq.{setor}"

    r = await _sb("GET", f"/wavoip_calls{qs}")
    if r.status_code != 200:
        raise HTTPException(r.status_code, r.text)
    return {"items": r.json()}


@app.get("/api/wavoip/config")
async def wavoip_config() -> dict:
    """Retorna config do widget Wavoip pro frontend (Homebroker).
    O device_token é necessário pra conectar o widget oficial."""
    if not WAVOIP_DEVICE_TOKEN:
        raise HTTPException(503, "wavoip_device_token não configurado")
    return {
        "device_token": WAVOIP_DEVICE_TOKEN,
        # URL do widget oficial Wavoip (popup que faz a ligação)
        "app_url": "https://app.wavoip.com",
    }


@app.get("/api/wavoip/healthz")
async def healthz() -> dict:
    return {
        "ok": True,
        "has_supabase": bool(SUPABASE_URL and SUPABASE_KEY),
        "has_token": bool(WAVOIP_DEVICE_TOKEN),
    }


# ════════════════════════════════════════════════════════════════════════
# Orçamento — Aprovação Douglas
# Tela /orcamento/aprovacao do Homebroker lista cards do setor Orçamento na
# coluna "Análise Douglas" e permite Aprovar (move pra Proposta Pronta + sync
# Comercial pra Apresentação/Proposta) ou Rejeitar (move pra Refazer + grava
# motivo). Notificação manda no grupo "Parket — Orçamentos".
# ════════════════════════════════════════════════════════════════════════

EVOLUTION_URL = "https://conect.parket.works"
# APIKEY da Evolution vem de docker secret (evolution_apikey) ou env EVOLUTION_APIKEY;
# nao pode ficar hardcoded porque o repo sobe pro GitHub (ParketBR)
EVOLUTION_APIKEY = _read_secret("evolution_apikey")
EVOLUTION_INSTANCE_DEFAULT = "Parket"
GRUPO_ORCAMENTOS_JID = "120363425314205066@g.us"
APROVADORES_EMAILS = {"douglas@parket.com.br"}  # admins são checados por papel via role no banco

PUBLIC_SPACE_URL = "https://space.parket.works"

# Valoria (valor.parket.works) — Supabase próprio (skbjmlzgaeupflujomzw), schema `ops`.
# Usamos anon key + Accept-Profile: ops pra ler cards_solicitacao/simulacoes quando
# o espelho no Parket Cloud (simulacao_projetos) tá ausente ou desatualizado.
# Bug 20/07 (Will): 13 dos 18 cards em analise-douglas apareciam com sims=[] porque
# o sync push Valoria→Space não populou selected_at em simulacao_projetos (ou nem
# criou a linha). Fallback: lê direto da fonte da verdade.
VALORIA_URL = "https://skbjmlzgaeupflujomzw.supabase.co"
VALORIA_ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNrYmptbHpnYWV1cGZsdWpvbXp3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE2MjA1NDYsImV4cCI6MjA5NzE5NjU0Nn0.iAPj6bE_Kysd1I_RLWp3gR-J4YFy-Ps71-E-ukjOUGI"
VALORIA_PROPOSTA_URL = "https://proposta.parket.works/v2"

# ── Análise de custo pro Douglas (Will 08/09/2026) ──────────────────────
# Percentuais da visão SIMPLIFICADA de margem exibida na tela de aprovação.
# NÃO é o motor oficial do Core (lá a provisão de impostos é 28% guia única);
# aqui: comissão 5% do bruto, impostos 20% do bruto, RT 10% sobre o líquido
# de impostos (regra Core 17/08) e SÓ quando o card tem arquiteto vinculado.
# Insumos = valor_insumos + valor_instalacao dos itens da sim (única fonte de
# "gasto" persistida hoje; não existe custo real de insumo no catálogo).
ANALISE_COMISSAO_PCT = 0.05
ANALISE_RT_PCT = 0.10
ANALISE_IMPOSTOS_PCT = 0.20

# O que a Parket FABRICA (mesma regra deve_produzir do compras-contratos-watcher,
# Will 04/09): PORTA e MARCENARIA sempre + qualquer categoria com subtipo
# laminado/lâmina (a fábrica produz a lâmina). O resto (régua, ripado, maciço,
# muxarabi, toblerone...) é comprado PRONTO e o custo de compra não existe no
# sistema — a análise precisa separar isso (Will 08/09).
_FAB_CATS = ("porta", "marcenaria")
_FAB_SUBTIPOS = {"lamina", "laminado", "brise_lamina"}


def _eh_fabricado(categoria: str | None, subtipo: str | None) -> bool:
    """Item passa pela fábrica? Espelha deve_produzir() do watcher do PCP."""
    if (categoria or "").strip().lower() in _FAB_CATS:
        return True
    sub = (subtipo or "").strip().lower().replace("â", "a").replace("ã", "a")
    return sub in _FAB_SUBTIPOS


def _detalhe_recortes(it: dict) -> str | None:
    """QUAL recorte é (Will 08/09): item de recortes sai genérico ("FORRO
    RECORTES") e o detalhe vive no descritivo. O wizard grava a 1a linha como
    __RECDATA__:<json> com [{nome, unidade, qtd}] — parseia e devolve ex:
    "Recorte para Luminária (12 UNI), Sanca iluminada (10,86 MTL)". Sem
    RECDATA (recorte antigo/texto livre) cai na 1a linha legível do texto."""
    if "recorte" not in (it.get("subtipo") or "").lower():
        return None
    desc = it.get("descritivo") or ""
    if desc.startswith("__RECDATA__:"):
        try:
            recs = json.loads(desc.split("\n", 1)[0][len("__RECDATA__:"):])
            partes = []
            for r in recs:
                qtd = r.get("qtd")
                # qtd no padrão pt-BR (12 / 10,86), sem zeros à direita
                qtd_s = f"{qtd:g}".replace(".", ",") if isinstance(qtd, (int, float)) else str(qtd or "")
                un = r.get("unidade") or ""
                partes.append(f"{r.get('nome')} ({qtd_s} {un})".replace(" ()", "").strip())
            if partes:
                return ", ".join(partes)
        except Exception:
            pass
    # fallback: primeira linha de texto, trocando travessão por dois-pontos (regra UI)
    linhas = [l.strip() for l in desc.splitlines() if l.strip() and not l.startswith("__RECDATA__:")]
    return linhas[0].replace(" — ", ": ")[:140] if linhas else None


def _detectar_arquiteto(card: dict, card_comercial: dict | None) -> str | None:
    """Nome do arquiteto do card: details.arquitetura/arquiteto (form NovoLead do HB)
    com fallback no sufixo "- Arq X" do title (cards antigos, mesmo regex do
    SolicitarOrcamentoModal.tsx). Olha o card de orçamento E o comercial pai."""
    for c in (card, card_comercial):
        if not c:
            continue
        det = c.get("details") or {}
        nome = det.get("arquitetura") or det.get("arquiteto")
        if nome and str(nome).strip():
            return str(nome).strip()
        m = re.search(r"\s*[—–-]\s*Arq(?:\.|uiteto|uiteta)?\s+(.+)$", c.get("title") or "", re.I)
        if m:
            return m.group(1).strip()
    return None


async def _sb_valoria(method: str, path: str, **kw) -> httpx.Response:
    """Wrapper REST da Valoria (schema ops) via anon+Accept-Profile."""
    url = f"{VALORIA_URL}/rest/v1{path}"
    headers = {
        "apikey": VALORIA_ANON,
        "Authorization": f"Bearer {VALORIA_ANON}",
        "Content-Type": "application/json",
        "Accept-Profile": "ops",
        "Content-Profile": "ops",
    }
    headers.update(kw.pop("headers", {}))
    async with httpx.AsyncClient(timeout=10) as c:
        return await c.request(method, url, headers=headers, **kw)


async def _evolution_send_text(number: str, text: str, instance: str = EVOLUTION_INSTANCE_DEFAULT) -> dict:
    url = f"{EVOLUTION_URL}/message/sendText/{instance}"
    headers = {"apikey": EVOLUTION_APIKEY, "Content-Type": "application/json"}
    async with httpx.AsyncClient(timeout=15) as c:
        r = await c.post(url, json={"number": number, "text": text}, headers=headers)
    return {"status": r.status_code, "ok": 200 <= r.status_code < 300, "body": r.text[:300]}


async def _aprovador_autorizado(email: str | None) -> bool:
    """Douglas + qualquer usuário com role admin/superadmin/dept_leader em user_profiles."""
    if not email:
        return False
    if email.lower() in APROVADORES_EMAILS:
        return True
    r = await _sb("GET", f"/user_profiles?select=role,email&email=eq.{email.lower()}&limit=1")
    if r.status_code == 200:
        rows = r.json()
        if rows and rows[0].get("role") in ("admin", "superadmin", "dept_leader"):
            return True
    return False


async def _carregar_dados_para_aprovacao(card_id: str) -> dict:
    """Junta os dados que o Douglas precisa ver: card orçamento, card comercial
    pai (com nome do vendedor), simulação (com orçamentista), link da proposta."""
    # Card de Orçamento
    r = await _sb("GET", f"/kanban_cards?select=id,title,obra,dept_id,column_id,responsavel,details,created_at,updated_at&id=eq.{card_id}&limit=1")
    if r.status_code != 200 or not r.json():
        raise HTTPException(404, "Card de orçamento não encontrado")
    card = r.json()[0]
    if card.get("dept_id") != "orcamento":
        raise HTTPException(400, "Card não é do setor orçamento")

    parent_id = (card.get("details") or {}).get("parent_card_id")
    card_comercial = None
    vendedor_nome = None
    if parent_id:
        r2 = await _sb("GET", f"/kanban_cards?select=id,title,obra,column_id,responsavel,details&id=eq.{parent_id}&limit=1")
        if r2.status_code == 200 and r2.json():
            card_comercial = r2.json()[0]
            vendedor_nome = card_comercial.get("responsavel") or (card_comercial.get("details") or {}).get("vendedor")

    # Simulações marcadas (selected_at NOT NULL) — pode ter várias, mas SÓ as
    # que o orçamentista explicitamente mandou pra Douglas. Se nenhuma tá marcada,
    # não é pra Douglas ainda (ele não vê rascunho). Regra Will 15/07.
    qs_or = f"or=(card_id.eq.{card_id}"
    if parent_id:
        qs_or += f",card_comercial_id.eq.{parent_id}"
    qs_or += ")"
    # Regra Will 20/07: fila Douglas SÓ mostra sims que foram pedidas via botão
    # "Pedir análise" na Valoria → row em ops.analise_douglas com status=pendente.
    # Sims que só têm selected_at no simulacao_projetos do Cloud (fluxo Space antigo)
    # NÃO entram — Space foi aposentado. Fluxo hoje: valor.parket → analise_douglas → aqui.
    simulacoes: list[dict] = []
    origem_valoria = False
    candidatos = [card_id] + ([parent_id] if parent_id else [])

    # 1) Pega TODAS as sims deste card na Valoria (id-convergente) — em paralelo:
    # 2 candidatos × 2 queries = 4 requests concorrentes (era serial).
    sims_val_por_id: dict[str, dict] = {}
    val_cliente = None; val_orc = None; val_orc_email = None
    async def _q_card(cand):
        try:
            return cand, await _sb_valoria("GET",
                f"/cards_solicitacao?id=eq.{cand}"
                f"&select=cliente,orcamentista,orcamentista_email,orcamentista_id&limit=1")
        except Exception as e:
            logger.warning("valoria_card_fail", card=cand, err=str(e))
            return cand, None
    async def _q_sims(cand):
        try:
            return cand, await _sb_valoria("GET",
                f"/simulacoes?card_id=eq.{cand}&select=id,numero,titulo,card_id,status,created_at,updated_at,"
                # Tudo que compõe o VALOR na proposta (Will 08/09): frete e desconto
                # entram no total; forma de pagamento e considerações mudam a leitura
                # (ex: "Recortes de forro não incluso")
                f"frete_valor,desconto_perc,desconto_valor,forma_pagamento,consideracoes")
        except Exception as e:
            logger.warning("valoria_sims_fail", card=cand, err=str(e))
            return cand, None
    tasks = []
    for cand in candidatos:
        tasks.append(_q_card(cand))
        tasks.append(_q_sims(cand))
    resultados_val = await asyncio.gather(*tasks)
    for i in range(0, len(resultados_val), 2):
        _, r_card = resultados_val[i]
        _, r_sims = resultados_val[i+1]
        if r_card is not None and r_card.status_code == 200 and r_card.json():
            cs = r_card.json()[0]
            val_cliente = val_cliente or cs.get("cliente")
            val_orc = val_orc or cs.get("orcamentista")
            val_orc_email = val_orc_email or cs.get("orcamentista_email")
        if r_sims is not None and r_sims.status_code == 200 and r_sims.json():
            for s in r_sims.json():
                sims_val_por_id[s["id"]] = s

    # 2) Cruza com ops.analise_douglas: SÓ entram as pedidas
    ad_por_sim: dict[str, dict] = {}
    if sims_val_por_id:
        ids_in = ",".join(sims_val_por_id.keys())
        try:
            rv_ad = await _sb_valoria(
                "GET",
                f"/analise_douglas?simulacao_id=in.({ids_in})&status=eq.pendente"
                f"&select=simulacao_id,solicitado_em,observacoes,solicitado_por"
                f"&order=solicitado_em.desc",
            )
            if rv_ad.status_code == 200:
                for a in rv_ad.json():
                    sid = a["simulacao_id"]
                    if sid not in ad_por_sim or (a.get("solicitado_em") or "") > (ad_por_sim[sid].get("solicitado_em") or ""):
                        ad_por_sim[sid] = a
        except Exception as e:
            logger.warning("valoria_analise_douglas_fail", card=card_id, err=str(e))

    # 2b) Self-healing (Will 08/09): arrastar o card direto pra coluna Análise
    #     Douglas no kanban do Valor NÃO cria pedido — o botão "Pedir análise"
    #     (único criador de ops.analise_douglas) só existe dentro do Workspace
    #     da sim na Valoria. Sem pedido, o gate acima filtra tudo e o card fica
    #     invisível na aprovação (caso dos 4 cards órfãos: Bruno e Daniela,
    #     Eduardo Pollis, Gilda e Omar, Renata e Cláudio). Se o card ESTÁ na
    #     coluna, tem sims e nenhuma tem pedido pendente, criamos o pedido aqui
    #     pra toda sim sem NENHUM registro (qualquer status) — sim já decidida
    #     (aprovado/rejeitado) não é reaberta, e sim fechada (vendida) fica fora.
    if (not ad_por_sim and sims_val_por_id
            and card.get("column_id") == "analise-douglas"):
        try:
            ids_in = ",".join(sims_val_por_id.keys())
            # Busca em QUALQUER status: pedido decidido conta como "já tem"
            rv_all = await _sb_valoria(
                "GET", f"/analise_douglas?simulacao_id=in.({ids_in})&select=simulacao_id,status")
            ja_tem = {a["simulacao_id"] for a in rv_all.json()} if rv_all.status_code == 200 else set()
            faltam = [sid for sid, s in sims_val_por_id.items()
                      if sid not in ja_tem and s.get("status") != "fechada"]
            if faltam:
                rv_ins = await _sb_valoria(
                    "POST", "/analise_douglas",
                    json=[{
                        "simulacao_id": sid,
                        "status": "pendente",
                        "solicitado_por": None,  # sem autor: veio do arraste no kanban, não do botão
                        "observacoes": "Pedido criado automaticamente: card movido pra coluna Análise Douglas no kanban",
                    } for sid in faltam],
                    headers={"Prefer": "return=representation"},
                )
                if rv_ins.status_code in (200, 201):
                    for a in rv_ins.json():
                        ad_por_sim[a["simulacao_id"]] = a
                    logger.info("analise_douglas_autocriada", card=card_id, sims=faltam)
                else:
                    logger.warning("analise_douglas_autocreate_fail", card=card_id,
                                   status=rv_ins.status_code, body=rv_ins.text[:200])
        except Exception as e:
            logger.warning("analise_douglas_autocreate_exc", card=card_id, err=str(e))

    # 3) Enrichment de cada sim pedida (metadata do Cloud simulacao_projetos se
    #    existir, pra preservar cliente/vendedor/orcamentista já sincados)
    if ad_por_sim:
        sim_ids_lista = list(ad_por_sim.keys())
        cloud_meta: dict[str, dict] = {}
        try:
            ids_in = ",".join(sim_ids_lista)
            rc = await _sb("GET", f"/simulacao_projetos?id=in.({ids_in})&select=id,numero,cliente,vendedor,orcamentista,vendedor_email,status,created_at,selected_at")
            if rc.status_code == 200:
                for row in rc.json():
                    cloud_meta[row["id"]] = row
        except Exception:
            pass
        for sid, a in sorted(ad_por_sim.items(), key=lambda kv: kv[1].get("solicitado_em") or ""):
            base = sims_val_por_id.get(sid, {"id": sid})
            cm = cloud_meta.get(sid) or {}
            s = {
                "id": sid,
                "numero": base.get("numero") or cm.get("numero"),
                "titulo": base.get("titulo"),
                "cliente": val_cliente or cm.get("cliente") or card.get("title"),
                "vendedor": cm.get("vendedor"),
                "vendedor_email": cm.get("vendedor_email"),
                "orcamentista": val_orc or cm.get("orcamentista"),
                "status": base.get("status") or cm.get("status"),
                "created_at": base.get("created_at") or cm.get("created_at"),
                "selected_at": a.get("solicitado_em"),
                "_origem": "valoria",
                "_analise_douglas_obs": a.get("observacoes"),
                # Campos de valor/condições da proposta (Will 08/09: tudo que está
                # na proposta aparece pro Douglas saber o valor)
                "frete_valor": base.get("frete_valor"),
                "desconto_perc": base.get("desconto_perc"),
                "desconto_valor": base.get("desconto_valor"),
                "forma_pagamento": base.get("forma_pagamento"),
                "consideracoes": base.get("consideracoes"),
            }
            simulacoes.append(s)
        origem_valoria = True

    if val_orc or val_cliente:
        card.setdefault("details", {})
        card["details"] = {**(card.get("details") or {}),
                           "_valoria_orcamentista": val_orc,
                           "_valoria_orcamentista_email": val_orc_email,
                           "_valoria_cliente": val_cliente}

    sim = simulacoes[0] if simulacoes else None  # back-compat

    # Histórico de aprovações deste card (com simulacao_id pra cruzar com simulacoes)
    r4 = await _sb("GET", f"/orcamento_aprovacoes?select=*&card_id=eq.{card_id}&order=decidido_em.desc")
    historico = r4.json() if r4.status_code == 200 else []

    # Quais simulações já têm decisão (uma única decisão por sim — usa a mais recente).
    decisao_por_sim: dict[str, dict] = {}
    for h in historico:
        sid = h.get("simulacao_id")
        if sid and sid not in decisao_por_sim:
            decisao_por_sim[sid] = h
    # Anota cada simulação com sua decisão (None se pendente).
    # Link "Ver proposta" precisa apontar pro proposta.id (rota /v2/:uuid usa
    # ops.propostas.id, não simulacoes.id — Will 20/07: bug "Proposta não encontrada").
    # Busca a proposta mais recente por simulacao_id: usa url_publica se preenchida
    # (renderer oficial), senão /v2/{proposta.id}. Sim sem proposta = link null.
    prop_por_sim: dict[str, dict] = {}
    if simulacoes:
        sids = ",".join(s["id"] for s in simulacoes)
        try:
            rvp = await _sb_valoria(
                "GET",
                f"/propostas?simulacao_id=in.({sids})&select=id,simulacao_id,url_publica,pdf_url,created_at&order=created_at.desc",
            )
            if rvp.status_code == 200:
                for p in rvp.json():
                    sid = p.get("simulacao_id")
                    # mantém só a mais recente por sim
                    if sid and sid not in prop_por_sim:
                        prop_por_sim[sid] = p
        except Exception as e:
            logger.warning("valoria_propostas_lookup_fail", err=str(e))

    # Link "Ver proposta" — regra final (Will 20/07): modelo = /proposta/{cloud_id}
    # do dashboard Space (renderer PGSTRUCT36 golden). Cloud id vem por match de
    # numero em simulacao_projetos (Valoria e Cloud usam mesmo número, ids DIFERENTES).
    # Se não achar Cloud id → fallback /v2/{sim_id} da Valoria (dados ao vivo).
    numeros = [str(s["numero"]) for s in simulacoes if s.get("numero") is not None]
    cloud_por_num: dict[str, str] = {}
    if numeros:
        try:
            nlist = ",".join(numeros)
            rn = await _sb("GET", f"/simulacao_projetos?numero=in.({nlist})&select=id,numero,cliente")
            if rn.status_code == 200:
                # Se >1 pro mesmo numero, prioriza que bate cliente
                cliente_norm = (card.get("title") or "").strip().lower()
                por_num: dict[str, list[dict]] = {}
                for row in rn.json():
                    por_num.setdefault(str(row["numero"]), []).append(row)
                for num, rows in por_num.items():
                    if len(rows) == 1:
                        cloud_por_num[num] = rows[0]["id"]
                    else:
                        match = next((r for r in rows if (r.get("cliente") or "").strip().lower() == cliente_norm), rows[0])
                        cloud_por_num[num] = match["id"]
        except Exception as e:
            logger.warning("cloud_id_lookup_fail", err=str(e))

    for s in simulacoes:
        s["decisao"] = decisao_por_sim.get(s["id"])
        p = prop_por_sim.get(s["id"])
        cloud_id = cloud_por_num.get(str(s.get("numero"))) if s.get("numero") is not None else None
        if cloud_id:
            # Modelo certo (Will): renderer Space /proposta/{cloud_id}
            s["link"] = f"https://proposta.parket.works/proposta/{cloud_id}"
            s["pdf_url"] = f"https://proposta.parket.works/proposta/{cloud_id}?print=1"
        else:
            # Fallback: sim só existe na Valoria (sem espelho Cloud) → renderer Valoria
            s["link"] = f"{VALORIA_PROPOSTA_URL}/{s['id']}"
            s["pdf_url"] = f"{VALORIA_PROPOSTA_URL}/{s['id']}?autoprint=1"
        s["proposta_id"] = p["id"] if p else None
        s["cloud_sim_id"] = cloud_id

    # ── Análise de custo (Will 08/09): itens vendidos + margem estimada ──
    # Busca os itens de TODAS as sims pedidas em 1 query na Valoria e monta,
    # por sim, a lista item a item (valor de venda de cada item) + o resumo:
    # venda total, (-) comissão 5%, (-) RT 10% s/ líquido (se tem arquiteto),
    # (-) impostos 20%, (-) insumos fab+inst, (=) resultado estimado.
    itens_por_sim: dict[str, list[dict]] = {}
    if simulacoes:
        sids = ",".join(s["id"] for s in simulacoes)
        try:
            ri = await _sb_valoria(
                "GET",
                f"/simulacao_itens?simulacao_id=in.({sids})"
                f"&select=simulacao_id,ordem,categoria,subtipo,especie_nome,cor,dimensao_label,"
                f"descritivo,metragem_informada,preco_unitario,override_material,"
                f"valor_material,valor_insumos,valor_instalacao,valor_total"
                f"&order=ordem.asc",
            )
            if ri.status_code == 200:
                for it in ri.json():
                    itens_por_sim.setdefault(it["simulacao_id"], []).append(it)
        except Exception as e:
            logger.warning("valoria_itens_fail", card=card_id, err=str(e))

    arquiteto_nome = _detectar_arquiteto(card, card_comercial)
    for s in simulacoes:
        # Item enxuto pro front: descrição montada (categoria + subtipo + espécie
        # + cor) + metragem + componentes de valor. Tudo float pra JSON limpo.
        s["itens"] = [
            {
                "descricao": " ".join(
                    str(p_).strip() for p_ in (
                        (it.get("categoria") or "").upper(),
                        it.get("subtipo"),
                        it.get("especie_nome"),
                        it.get("cor"),
                    ) if p_ and str(p_).strip()
                ) or "Item",
                "dimensao": it.get("dimensao_label"),
                # Recortes: QUAIS são (nome + qtd + unidade), já que a descrição
                # genérica "FORRO RECORTES" não diz nada pro Douglas
                "detalhe": _detalhe_recortes(it),
                "metragem": float(it.get("metragem_informada") or 0) or None,
                # R$/m2 REALMENTE usado pra montar o orçamento (Will 08/09).
                # Sem ajuste manual = preço de tabela (preco_unitario).
                # Com override_material o orçamentista fechou o material em
                # outro valor: o m2 efetivo vira override / metragem — mostrar
                # a tabela aqui enganaria o Douglas (ex: tabela 1.152,60 mas
                # material fechado a 887,50/m2).
                "preco_m2": (
                    round(float(it["override_material"]) / float(it["metragem_informada"]), 2)
                    if it.get("override_material") is not None and float(it.get("metragem_informada") or 0) > 0
                    else float(it.get("preco_unitario") or 0) or None
                ),
                "material_ajustado": it.get("override_material") is not None,
                # Passa pela fábrica (porta/marcenaria/laminado)? Decide em qual
                # linha da análise os insumos do item entram
                "fabricado": _eh_fabricado(it.get("categoria"), it.get("subtipo")),
                "valor_material": float(it.get("valor_material") or 0),
                "valor_insumos": float(it.get("valor_insumos") or 0),
                "valor_instalacao": float(it.get("valor_instalacao") or 0),
                "valor_total": float(it.get("valor_total") or 0),
            }
            for it in itens_por_sim.get(s["id"], [])
        ]
        venda_total = sum(i["valor_total"] for i in s["itens"])
        # Fabricação e instalação SEPARADOS (Will 08/09) e fabricação SÓ pros
        # itens que passam pela fábrica (porta/marcenaria/laminado, regra do
        # PCP). Nos comprados prontos o valor_insumos é insumo de OBRA (cola,
        # manta...) — linha própria — e o custo de COMPRA do produto não existe
        # no sistema, então a análise avisa em vez de fingir que está na conta.
        insumos_fab = sum(i["valor_insumos"] for i in s["itens"] if i["fabricado"])
        insumos_obra = sum(i["valor_insumos"] for i in s["itens"] if not i["fabricado"])
        instalacao_total = sum(i["valor_instalacao"] for i in s["itens"])
        # Venda de material dos itens comprados prontos (referência do que foi
        # vendido SEM custo de compra registrado)
        material_pronto = sum(i["valor_material"] for i in s["itens"] if not i["fabricado"])
        insumos_total = insumos_fab + insumos_obra + instalacao_total
        # Total DA PROPOSTA = itens + frete - desconto (Will 08/09: o Douglas tem
        # que ver o mesmo valor que o cliente vê). Desconto pode vir em R$ ou %.
        frete = float(s.get("frete_valor") or 0)
        desconto = float(s.get("desconto_valor") or 0) or venda_total * float(s.get("desconto_perc") or 0) / 100
        total_proposta = venda_total + frete - desconto
        comissao = venda_total * ANALISE_COMISSAO_PCT
        impostos = venda_total * ANALISE_IMPOSTOS_PCT
        # RT só quando existe arquiteto no card; base = líquido de impostos (Core 17/08)
        rt = venda_total * (1 - ANALISE_IMPOSTOS_PCT) * ANALISE_RT_PCT if arquiteto_nome else 0.0
        resultado = venda_total - comissao - rt - impostos - insumos_total
        s["analise_custo"] = {
            "venda_total": round(venda_total, 2),
            # Linhas que fecham o valor da proposta pro cliente (frete/desconto
            # ficam FORA do cálculo de margem: frete é repasse, desconto é venda)
            "frete": round(frete, 2),
            "desconto": round(desconto, 2),
            "total_proposta": round(total_proposta, 2),
            "comissao_pct": ANALISE_COMISSAO_PCT,
            "comissao": round(comissao, 2),
            "arquiteto": arquiteto_nome,
            "rt_pct": ANALISE_RT_PCT if arquiteto_nome else 0,
            "rt": round(rt, 2),
            "impostos_pct": ANALISE_IMPOSTOS_PCT,
            "impostos": round(impostos, 2),
            # Linhas separadas (Will 08/09): fabricação só do que é de fábrica,
            # insumos de obra dos comprados prontos, instalação de tudo;
            # "insumos" segue como soma geral pra retrocompat do front
            "insumos_fab": round(insumos_fab, 2),
            "insumos_obra": round(insumos_obra, 2),
            "instalacao": round(instalacao_total, 2),
            # Venda de material comprado pronto — custo de compra NÃO registrado
            "material_pronto_venda": round(material_pronto, 2),
            "insumos": round(insumos_total, 2),
            "resultado": round(resultado, 2),
            "margem_pct": round(resultado / venda_total * 100, 1) if venda_total > 0 else None,
        }

    orcamentista_nome = (
        (sim or {}).get("orcamentista")
        or (card.get("details") or {}).get("_valoria_orcamentista")
        or (card.get("details") or {}).get("orcamentista_nome")
        or (card.get("details") or {}).get("orcamentista")
        or (card.get("details") or {}).get("orcamentista_email")
        or (card.get("details") or {}).get("_valoria_orcamentista_email")
        or card.get("responsavel")
    )
    proposta_link = (sim or {}).get("link") if sim else None

    # Pendentes = total marcadas - já decididas (mas só conta as que ESTÃO nas simulacoes atuais)
    pendentes = [s for s in simulacoes if not s.get("decisao")]

    return {
        "card": card,
        "card_comercial": card_comercial,
        "simulacao": sim,           # back-compat: a 1ª
        "simulacoes": simulacoes,   # NOVO: todas as marcadas (ou só a mais recente como fallback)
        "pendentes_count": len(pendentes),
        "decididas_count": len(simulacoes) - len(pendentes),
        "vendedor": vendedor_nome,
        "orcamentista": orcamentista_nome or "—",
        "cliente": card.get("title"),
        "proposta_link": proposta_link,
        "proposta_pdf_url": (sim or {}).get("pdf_url") if sim else None,
        "historico": historico,
    }


@app.get("/api/orcamento/aprovacao/pendentes")
async def aprovacao_pendentes() -> dict:
    """Lista todos os cards do setor Orçamento parados na coluna Análise Douglas
    QUE TÊM AO MENOS 1 SIMULAÇÃO pedida via "Análise Douglas" (Will 20/07).
    Ordena por orçamentista (A-Z) + data do pedido mais antigo (asc)."""
    r = await _sb(
        "GET",
        "/kanban_cards?select=id,title,obra,column_id,responsavel,details,created_at,updated_at"
        "&dept_id=eq.orcamento&column_id=eq.analise-douglas&order=created_at.asc",
    )
    if r.status_code != 200:
        raise HTTPException(r.status_code, r.text)
    cards = r.json()

    # Paraleliza carregamento — cada card faz ~8 queries (Cloud+Valoria) e antes
    # rodava sequencial (18 × ~8 = ~30s). asyncio.gather roda tudo concorrente,
    # limitado pela query mais lenta (~2-3s).
    async def _safe_load(cid: str):
        try:
            return await _carregar_dados_para_aprovacao(cid)
        except HTTPException:
            return None
        except Exception as e:
            logger.warning("carregar_dados_exc", card=cid, err=str(e))
            return None

    resultados = await asyncio.gather(*[_safe_load(c["id"]) for c in cards])
    enriched = []
    for d in resultados:
        if not d: continue
        if not (d.get("simulacoes") or []): continue
        enriched.append(d)

    def _sort_key(item: dict):
        orc = (item.get("orcamentista") or "z").lower()
        sims = item.get("simulacoes") or []
        # data do pedido = min(selected_at das sims) — mais antiga primeiro
        datas = [s.get("selected_at") or "" for s in sims if s.get("selected_at")]
        primeira = min(datas) if datas else (item.get("card", {}).get("created_at") or "")
        return (orc, primeira)
    enriched.sort(key=_sort_key)

    return {"items": enriched, "total": len(enriched)}


async def _registrar_decisao_e_mover(
    *, card_id: str, decisao: str, motivo: str | None,
    aprovador_email: str, aprovador_nome: str | None,
    sim_id: str | None = None,
) -> dict:
    """Registra decisão (aprovado/rejeitado) pra uma simulação específica.

    Se sim_id=None (legacy), decide a 1ª marcada (back-compat).
    O card só sai da coluna Análise Douglas quando TODAS as simulações marcadas
    tiverem decisão registrada. Resultado final do card:
      - ≥1 aprovada → "proposta-pronta"
      - 0 aprovadas (todas rejeitadas) → "refazer"
    """
    dados = await _carregar_dados_para_aprovacao(card_id)
    simulacoes = dados.get("simulacoes") or []
    card_com = dados.get("card_comercial") or {}

    # Resolve a simulação alvo da decisão.
    if sim_id:
        sim_alvo = next((s for s in simulacoes if s["id"] == sim_id), None)
        if not sim_alvo:
            raise HTTPException(404, f"Simulação {sim_id} não está marcada como proposta deste card")
    else:
        # Legacy: decide a 1ª marcada
        if not simulacoes:
            raise HTTPException(400, "Card não tem simulação")
        sim_alvo = simulacoes[0]
        sim_id = sim_alvo["id"]

    # Pendentes ANTES desta decisão (exclui a sim_alvo que vai ser decidida agora)
    ja_decididas = [s for s in simulacoes if s.get("decisao")]
    aprovadas_antes = [s for s in ja_decididas if (s["decisao"] or {}).get("decisao") == "aprovado"]
    # Will 16/07: decisão é UMA proposta por vez. O card só sai de Análise Douglas
    # quando TODAS as sims marcadas tiverem decisão — aceitar uma não pode levar
    # as outras pendentes da tela junto.
    pendentes_apos = [s for s in simulacoes if not s.get("decisao") and s["id"] != sim_id]
    todas_serao_decididas = len(pendentes_apos) == 0

    # 1) grava a aprovação (sempre)
    # Link "canônico" da proposta pra notificação: prefere url_publica da sim
    # (setado em _carregar_dados_para_aprovacao) — se ausente, /v2/{sim_id} fallback
    proposta_link_sim = (sim_alvo or {}).get("link") or f"{VALORIA_PROPOSTA_URL}/{sim_id}"
    payload = {
        "card_id": card_id,
        "decisao": decisao,
        "motivo": motivo,
        "aprovado_por_email": aprovador_email,
        "aprovado_por_nome": aprovador_nome,
        "simulacao_id": sim_id,
        "card_comercial_id": card_com.get("id"),
        "vendedor": dados.get("vendedor"),
        "orcamentista": dados.get("orcamentista"),
        "cliente": dados.get("cliente"),
        "proposta_link": proposta_link_sim,
    }
    r2 = await _sb("POST", "/orcamento_aprovacoes", json=payload)
    if r2.status_code >= 400:
        logger.warning("aprovacao_insert_fail", status=r2.status_code, body=r2.text[:200])

    # Espelha decisão em ops.analise_douglas da Valoria — regra Will 20/07:
    # orçamentista clica "Pedir análise" na Valoria por proposta (row pendente lá).
    # Douglas decide aqui → precisa fechar essa row (status=aprovado/rejeitado) pra
    # o widget AnaliseDouglas.tsx mostrar decidido em vez de "aguardando".
    try:
        ad_status = "aprovado" if decisao == "aprovado" else "rejeitado"
        ad_body = {
            "status": ad_status,
            "aprovado": (decisao == "aprovado"),
            "respondido_em": datetime.now(timezone.utc).isoformat(),
        }
        rv = await _sb_valoria(
            "PATCH",
            f"/analise_douglas?simulacao_id=eq.{sim_id}&status=eq.pendente",
            json=ad_body,
        )
        if rv.status_code >= 400:
            logger.warning("valoria_analise_douglas_patch_fail",
                           sim=sim_id, status=rv.status_code, body=rv.text[:200])
    except Exception as e:
        logger.warning("valoria_analise_douglas_patch_exc", sim=sim_id, err=str(e))

    # 2) move o card só quando a última pendente for decidida
    # Guarda anti-retrocesso (05/08/2026): só move se o card AINDA está em
    # analise-douglas. Decisão tardia num card já movido manualmente pra
    # handoff-com puxava ele de volta pra proposta-pronta ("andando sozinho").
    novo_col = None
    col_atual_orc = (dados.get("card") or {}).get("column_id")
    if todas_serao_decididas and col_atual_orc == "analise-douglas":
        houve_aprovada = (decisao == "aprovado") or len(aprovadas_antes) > 0
        novo_col = "proposta-pronta" if houve_aprovada else "refazer"
        upd = {"column_id": novo_col, "updated_at": datetime.now(timezone.utc).isoformat()}

        # Pra refazer: persiste motivos das rejeições no details
        if novo_col == "refazer":
            rg = await _sb("GET", f"/kanban_cards?select=details&id=eq.{card_id}&limit=1")
            det_atual = (rg.json()[0] or {}).get("details") if (rg.status_code == 200 and rg.json()) else {}
            det_atual = det_atual or {}
            hist = det_atual.get("rejeicoes") or []
            if not isinstance(hist, list):
                hist = []
            if motivo:
                hist.append({
                    "motivo": motivo,
                    "rejeitado_por": aprovador_nome or aprovador_email,
                    "rejeitado_em": datetime.now(timezone.utc).isoformat(),
                    "simulacao_id": sim_id,
                })
            det_atual["ultima_rejeicao_motivo"] = motivo
            det_atual["ultima_rejeicao_em"] = datetime.now(timezone.utc).isoformat()
            det_atual["ultima_rejeicao_por"] = aprovador_nome or aprovador_email
            det_atual["rejeicoes"] = hist[-5:]
            det_atual.pop("duvida_douglas", None)
            upd["details"] = det_atual
        else:
            # Aprovado: limpa motivos antigos de rejeição e dúvida pendente
            rg = await _sb("GET", f"/kanban_cards?select=details&id=eq.{card_id}&limit=1")
            if rg.status_code == 200 and rg.json():
                det_atual = (rg.json()[0] or {}).get("details") or {}
                if "ultima_rejeicao_motivo" in det_atual or "duvida_douglas" in det_atual:
                    det_atual.pop("ultima_rejeicao_motivo", None)
                    det_atual.pop("ultima_rejeicao_em", None)
                    det_atual.pop("ultima_rejeicao_por", None)
                    det_atual.pop("duvida_douglas", None)
                    upd["details"] = det_atual

        r = await _sb("PATCH", f"/kanban_cards?id=eq.{card_id}", json=upd)
        if r.status_code >= 400:
            raise HTTPException(r.status_code, f"Falha ao mover card: {r.text[:200]}")

        # ESPELHO DIRETO NA VALORIA (Will 20/07): quando Douglas decide, o card
        # tem que ir sozinho pro kanban do orçamentista em "proposta-pronta" ou
        # "refazer". O sync_space_valoria.py está com PAT revogado — não posso
        # depender dele. PATCH direto em ops.cards_solicitacao via anon+profile=ops.
        # id-convergente: kanban_cards.id == cards_solicitacao.id no fluxo Valoria.
        try:
            val_upd = {
                "column_id": novo_col,
                "updated_at": datetime.now(timezone.utc).isoformat(),
                "last_pushed_at": datetime.now(timezone.utc).isoformat(),
            }
            rv_card = await _sb_valoria(
                "PATCH", f"/cards_solicitacao?id=eq.{card_id}",
                json=val_upd,
            )
            if rv_card.status_code >= 400:
                logger.warning("valoria_card_move_fail",
                               card=card_id, status=rv_card.status_code,
                               body=rv_card.text[:200])
        except Exception as e:
            logger.warning("valoria_card_move_exc", card=card_id, err=str(e))

        # ESPELHO NO COMERCIAL (Will 15/07): quando o card do orçamento vai pra
        # "proposta-pronta", o card COMERCIAL (pai) precisa refletir isso pro
        # vendedor ver que dá pra apresentar E o botão "Enviar contrato" ficar
        # visível na tela. Move o comercial pra "apresentacao-proposta" se ainda
        # não passou daí. Se já tá em "em-negociacao"/"ganho", deixa quieto (não
        # anda pra trás). Também grava a proposta aprovada em details pro CardDetail
        # do comercial destacar.
        if novo_col == "proposta-pronta" and card_com and card_com.get("id"):
            comercial_id = card_com["id"]
            ORDEM_COL = ["novas-oportunidades","contato-inicial","criacao-orcamento",
                         "apresentacao-proposta","em-negociacao","ganho","perda"]
            col_atual = card_com.get("column_id") or ""
            idx_atual = ORDEM_COL.index(col_atual) if col_atual in ORDEM_COL else -1
            idx_apresentacao = ORDEM_COL.index("apresentacao-proposta")
            # Puxa details atuais pra merge (não sobrescrever).
            rg2 = await _sb("GET", f"/kanban_cards?select=details&id=eq.{comercial_id}&limit=1")
            det_com = ((rg2.json() or [{}])[0].get("details") or {}) if rg2.status_code == 200 else {}
            # Marca ÚLTIMA proposta aprovada + data (destaca no CardDetail comercial).
            det_com["proposta_aprovada"] = {
                "simulacao_id": sim_id,
                "numero": sim_alvo.get("numero"),
                "aprovado_em": datetime.now(timezone.utc).isoformat(),
                "aprovado_por": aprovador_nome or aprovador_email,
                "proposta_link": proposta_link_sim,
            }
            upd_com = {"details": det_com, "updated_at": datetime.now(timezone.utc).isoformat()}
            if idx_atual < idx_apresentacao:
                upd_com["column_id"] = "apresentacao-proposta"
            rc = await _sb("PATCH", f"/kanban_cards?id=eq.{comercial_id}", json=upd_com)
            if rc.status_code >= 400:
                logger.warning("comercial_espelho_fail", status=rc.status_code, body=rc.text[:200])

            # DEMANDA CONCLUIDA (Will 15/07): orcamento_demandas do card do orçamento
            # (kanban_card_orc_id=card_id) tá travada em "aguarda_aceite" e o card do
            # cliente mostra o badge assim. Depois de Douglas aprovar, marca "concluido"
            # e (se não tinha) aceito_em pra o widget do CardDetail atualizar.
            agora = datetime.now(timezone.utc).isoformat()
            upd_dem: dict = {"status": "concluido", "concluido_em": agora, "updated_at": agora}
            # aceito_em só é preenchido se ainda nulo — orçamentista pode ter aceito antes.
            rgd = await _sb("GET", f"/orcamento_demandas?select=id,aceito_em&kanban_card_orc_id=eq.{card_id}")
            if rgd.status_code == 200:
                for dem in (rgd.json() or []):
                    dem_upd = dict(upd_dem)
                    if not dem.get("aceito_em"):
                        dem_upd["aceito_em"] = agora
                    rd = await _sb("PATCH", f"/orcamento_demandas?id=eq.{dem['id']}", json=dem_upd)
                    if rd.status_code >= 400:
                        logger.warning("demanda_conclui_fail", status=rd.status_code, body=rd.text[:200])

    # 3) notifica grupo Orçamentos — por decisão individual + resumo final
    emoji = "✅" if decisao == "aprovado" else "🚫"
    titulo = "APROVADA" if decisao == "aprovado" else "REPROVADA"
    aprovador = aprovador_nome or aprovador_email
    cliente = dados.get("cliente") or "—"
    vendedor = dados.get("vendedor") or "—"
    orcamentista = dados.get("orcamentista") or "—"
    sim_numero = sim_alvo.get("numero") or "—"
    linhas = [
        f"{emoji} *Proposta #{sim_numero} {titulo}*",
        "",
        f"👤 *Cliente:* {cliente}",
        f"💼 *Vendedor:* {vendedor}",
        f"📝 *Orçamentista:* {orcamentista}",
        f"⚖️ *Avaliado por:* {aprovador}",
    ]
    if decisao == "rejeitado" and motivo:
        linhas.append("")
        linhas.append(f"📋 *MOTIVO:*")
        linhas.append(f"_{motivo}_")
    linhas.append("")
    linhas.append(f"📄 Proposta: {proposta_link_sim}")

    if novo_col:
        # Card MOVEU — adiciona resumo final
        linhas.append("")
        linhas.append("───────────────")
        if novo_col == "proposta-pronta":
            linhas.append(f"➡️ Card movido pra *Proposta Pronta* — Comercial já pode apresentar ao cliente.")
        else:
            linhas.append(f"➡️ Card movido pra *Refazer* — {orcamentista} ajusta e reenvia.")
        # Sumário de todas as decisões
        if len(simulacoes) > 1:
            aprovadas_finais = aprovadas_antes + ([sim_alvo] if decisao == "aprovado" else [])
            linhas.append("")
            linhas.append(f"📊 *Resumo:* {len(aprovadas_finais)}/{len(simulacoes)} propostas aprovadas")
    elif todas_serao_decididas:
        # Todas decididas, mas o card já tinha saído de Análise Douglas
        linhas.append("")
        linhas.append(f"ℹ️ Card já estava em *{col_atual_orc}* — mantido onde está.")
    else:
        # Ainda faltam pendentes
        pendentes_restam = len(simulacoes) - len(ja_decididas) - 1
        linhas.append("")
        linhas.append(f"⏳ Ainda faltam {pendentes_restam} proposta(s) pra decidir neste card.")

    msg = "\n".join(linhas)
    try:
        wa = await _evolution_send_text(GRUPO_ORCAMENTOS_JID, msg)
    except Exception as e:
        wa = {"ok": False, "error": str(e)[:200]}

    return {
        "ok": True,
        "decisao": decisao,
        "simulacao_id": sim_id,
        "card_movido": novo_col is not None,
        "novo_column_id": novo_col,
        "whatsapp": wa,
        "dados": dados,
    }


@app.post("/api/orcamento/aprovacao/{card_id}/aprovar")
async def aprovar(card_id: str, request: Request) -> dict:
    body = await request.json() if (request.headers.get("content-type") or "").startswith("application/json") else {}
    email = (body.get("email") or request.headers.get("x-user-email") or "").lower().strip()
    nome = body.get("nome") or request.headers.get("x-user-name")
    if not await _aprovador_autorizado(email):
        raise HTTPException(403, "Apenas Douglas e admins podem aprovar")
    return await _registrar_decisao_e_mover(
        card_id=card_id, decisao="aprovado", motivo=None,
        aprovador_email=email, aprovador_nome=nome,
    )


@app.get("/api/orcamento/aprovacao/card/{card_id}")
async def aprovacao_card(card_id: str) -> dict:
    """Retorna dados completos de 1 card (cliente, vendedor, orçamentista, proposta_link
    etc.) pra view de detalhes do histórico no homebroker."""
    return await _carregar_dados_para_aprovacao(card_id)


@app.post("/api/orcamento/aprovacao/{card_id}/comentar")
async def comentar_aprovacao(card_id: str, request: Request) -> dict:
    """CEO/admin envia comentário/dúvida no card de aprovação, sem registrar decisão.

    - `texto` (opcional): gravado em details.duvida_douglas → banner amarelo no card
      da Valoria pro orçamentista ver (o chat card_chat_messages fica no Space, que
      o orçamentista não abre).
    - `mover` (default True): move o card pra 'analise-orc' (devolve pro orçamentista).
      Comentário por-proposta manda mover=False pra manter as outras na fila Douglas.
    """
    body = await request.json() if (request.headers.get("content-type") or "").startswith("application/json") else {}
    email = (body.get("email") or request.headers.get("x-user-email") or "").lower().strip()
    if not await _aprovador_autorizado(email):
        raise HTTPException(403, "Apenas Douglas e admins podem comentar")
    texto = (body.get("texto") or "").strip()
    mover = body.get("mover", True)
    agora = datetime.now(timezone.utc).isoformat()
    upd: dict = {"updated_at": agora}
    if texto:
        rg = await _sb("GET", f"/kanban_cards?select=details&id=eq.{card_id}&limit=1")
        det = ((rg.json() or [{}])[0].get("details") or {}) if rg.status_code == 200 else {}
        det["duvida_douglas"] = {
            "texto": texto,
            "por": body.get("nome") or email,
            "em": agora,
            "simulacao_id": body.get("simulacao_id"),
        }
        upd["details"] = det
    if mover:
        upd["column_id"] = "analise-orc"
    r = await _sb("PATCH", f"/kanban_cards?id=eq.{card_id}", json=upd)
    if r.status_code >= 400:
        raise HTTPException(r.status_code, f"Falha ao mover card: {r.text[:200]}")
    return {"ok": True, "novo_column_id": "analise-orc" if mover else None}


@app.post("/api/orcamento/aprovacao/{card_id}/responder-duvida")
async def responder_duvida(card_id: str, request: Request) -> dict:
    """Orçamentista (Valoria) responde a dúvida do Douglas.

    Grava details.duvida_douglas.resposta no kanban_cards (Space) — a fila de
    aprovação do Homebroker mostra a resposta no card — e posta no chat do card
    (card_chat_messages), que acende o alerta 💬 NOVA pro Douglas.
    """
    body = await request.json() if (request.headers.get("content-type") or "").startswith("application/json") else {}
    texto = (body.get("texto") or "").strip()
    if not texto:
        raise HTTPException(400, "texto obrigatório")
    nome = (body.get("nome") or body.get("email") or "Orçamentista").strip()
    agora = datetime.now(timezone.utc).isoformat()
    rg = await _sb("GET", f"/kanban_cards?select=details,title&id=eq.{card_id}&limit=1")
    if rg.status_code != 200 or not rg.json():
        raise HTTPException(404, "Card não encontrado")
    row = rg.json()[0]
    det = row.get("details") or {}
    duv = det.get("duvida_douglas")
    if not isinstance(duv, dict) or not duv.get("texto"):
        raise HTTPException(409, "Card não tem dúvida pendente do Douglas")
    duv["resposta"] = {"texto": texto, "por": nome, "em": agora}
    det["duvida_douglas"] = duv
    r = await _sb("PATCH", f"/kanban_cards?id=eq.{card_id}", json={"details": det, "updated_at": agora})
    if r.status_code >= 400:
        raise HTTPException(r.status_code, f"Falha ao gravar resposta: {r.text[:200]}")
    await _sb("POST", "/card_chat_messages", json={
        "context_id": card_id,
        "context_type": "kanban_card",
        "topic": ((row.get("title") or "").lower().strip() or None),
        "user_name": "📐 Orçamentista — " + nome,
        "user_email": ((body.get("email") or "").lower().strip() or None),
        "avatar": "📐",
        "msg": "[RESPOSTA ORÇAMENTISTA]\n" + texto,
    })
    return {"ok": True}


@app.post("/api/orcamento/simulacao/{sim_id}/desselecionar")
async def desselecionar_simulacao(sim_id: str, request: Request) -> dict:
    """Desmarca uma simulação (selected_at = NULL)."""
    body = await request.json() if (request.headers.get("content-type") or "").startswith("application/json") else {}
    email = (body.get("email") or "").lower().strip()
    if not email:
        raise HTTPException(400, "email obrigatório")
    r = await _sb("PATCH", f"/simulacao_projetos?id=eq.{sim_id}", json={"selected_at": None, "selected_by_email": None})
    if r.status_code >= 400:
        raise HTTPException(r.status_code, r.text[:300])
    return {"ok": True}


@app.post("/api/orcamento/simulacao/{sim_id}/selecionar")
async def selecionar_simulacao(sim_id: str, request: Request) -> dict:
    """Marca uma simulação pra Análise Douglas. Multi-seleção: outras marcadas
    do mesmo card permanecem marcadas. Cada uma vai ser avaliada individualmente."""
    body = await request.json() if (request.headers.get("content-type") or "").startswith("application/json") else {}
    email = (body.get("email") or "").lower().strip()
    if not email:
        raise HTTPException(400, "email do user obrigatório")
    # RPC do banco já cuida de desmarcar as outras
    r = await _sb("POST", "/rpc/selecionar_simulacao", json={"p_sim_id": sim_id, "p_email": email})
    if r.status_code >= 400:
        raise HTTPException(r.status_code, r.text[:300])
    return {"ok": True, "result": r.json()}


@app.get("/api/orcamento/simulacao/{sim_id}/info-selecao")
async def info_selecao(sim_id: str) -> dict:
    """Pra UI: retorna se essa simulação é a marcada e quais outras existem pra mesmo card."""
    r = await _sb("GET", f"/simulacao_projetos?select=id,card_id,card_comercial_id,selected_at,selected_by_email,orcamentista,vendedor_email&id=eq.{sim_id}&limit=1")
    if r.status_code != 200 or not r.json():
        raise HTTPException(404, "Simulação não encontrada")
    s = r.json()[0]
    parent = s.get("card_comercial_id") or s.get("card_id")
    qs = f"or=(card_id.eq.{parent},card_comercial_id.eq.{parent})"
    r2 = await _sb("GET", f"/simulacao_projetos?select=id,numero,cliente,vendedor,orcamentista,status,created_at,selected_at&{qs}&order=created_at.desc")
    irmas = r2.json() if r2.status_code == 200 else []
    return {
        "simulacao": s,
        "irmas": irmas,
        "total": len(irmas),
        "is_selected": bool(s.get("selected_at")),
        "selected_by": s.get("selected_by_email"),
    }


async def _card_id_por_simulacao(sim_id: str) -> str:
    """Resolve card_id (Orçamento em analise-douglas) a partir de simulacao_projetos.id
    OU ops.simulacoes.id da Valoria (id-convergente).

    Aceita: (a) card_id direto do simulacao_projetos, (b) card_comercial_id (procura
    o card de orcamento que tem parent_card_id apontando pro mesmo card comercial),
    (c) fallback Valoria: busca ops.simulacoes.card_id e resolve pelo kanban_cards
    Parket Cloud (usado quando simulacao_projetos não tem espelho da sim)."""
    r = await _sb("GET", f"/simulacao_projetos?select=card_id,card_comercial_id&id=eq.{sim_id}&limit=1")
    cid = None; com = None
    if r.status_code == 200 and r.json():
        s = r.json()[0]
        cid = s.get("card_id")
        com = s.get("card_comercial_id")
    # 1) tenta direto pelo card_id (caso seja do orcamento)
    if cid:
        r1 = await _sb("GET", f"/kanban_cards?select=id,dept_id,column_id&id=eq.{cid}&limit=1")
        if r1.status_code == 200 and r1.json():
            k = r1.json()[0]
            if k.get("dept_id") == "orcamento":
                return k["id"]
    # 2) procura card de orcamento cujo parent_card_id = card_comercial_id (ou = card_id)
    parent = com or cid
    if parent:
        r2 = await _sb("GET", f"/kanban_cards?select=id&dept_id=eq.orcamento&details->>parent_card_id=eq.{parent}&order=created_at.desc&limit=1")
        if r2.status_code == 200 and r2.json():
            return r2.json()[0]["id"]
    # 3) fallback Valoria: sim_id só existe em ops.simulacoes (não veio pro Cloud)
    try:
        rv = await _sb_valoria("GET", f"/simulacoes?id=eq.{sim_id}&select=card_id&limit=1")
    except Exception as e:
        raise HTTPException(500, f"Erro ao consultar Valoria: {e}")
    if rv.status_code == 200 and rv.json():
        cid_val = rv.json()[0].get("card_id")
        if cid_val:
            # Tenta como card_id direto no Cloud
            r3 = await _sb("GET", f"/kanban_cards?select=id,dept_id&id=eq.{cid_val}&limit=1")
            if r3.status_code == 200 and r3.json() and r3.json()[0].get("dept_id") == "orcamento":
                return cid_val
            # Ou como parent (o cards_solicitacao.card_id pode apontar pro card comercial)
            r4 = await _sb("GET", f"/kanban_cards?select=id&dept_id=eq.orcamento&details->>parent_card_id=eq.{cid_val}&order=created_at.desc&limit=1")
            if r4.status_code == 200 and r4.json():
                return r4.json()[0]["id"]
    raise HTTPException(404, f"Não achei card de orçamento pra simulação {sim_id}")


@app.post("/api/orcamento/aprovacao/por-simulacao/{sim_id}/aprovar")
async def aprovar_por_sim(sim_id: str, request: Request) -> dict:
    body = await request.json() if (request.headers.get("content-type") or "").startswith("application/json") else {}
    email = (body.get("email") or "").lower().strip()
    nome = body.get("nome")
    if not await _aprovador_autorizado(email):
        raise HTTPException(403, "Apenas Douglas e admins podem aprovar")
    card_id = await _card_id_por_simulacao(sim_id)
    return await _registrar_decisao_e_mover(
        card_id=card_id, decisao="aprovado", motivo=None,
        aprovador_email=email, aprovador_nome=nome, sim_id=sim_id,
    )


@app.post("/api/orcamento/aprovacao/por-simulacao/{sim_id}/rejeitar")
async def rejeitar_por_sim(sim_id: str, request: Request) -> dict:
    body = await request.json() if (request.headers.get("content-type") or "").startswith("application/json") else {}
    email = (body.get("email") or "").lower().strip()
    nome = body.get("nome")
    motivo = (body.get("motivo") or "").strip()
    if not motivo:
        raise HTTPException(400, "Motivo é obrigatório pra rejeição")
    if not await _aprovador_autorizado(email):
        raise HTTPException(403, "Apenas Douglas e admins podem rejeitar")
    card_id = await _card_id_por_simulacao(sim_id)
    return await _registrar_decisao_e_mover(
        card_id=card_id, decisao="rejeitado", motivo=motivo,
        aprovador_email=email, aprovador_nome=nome, sim_id=sim_id,
    )


@app.post("/api/orcamento/aprovacao/{card_id}/rejeitar")
async def rejeitar(card_id: str, request: Request) -> dict:
    body = await request.json() if (request.headers.get("content-type") or "").startswith("application/json") else {}
    email = (body.get("email") or request.headers.get("x-user-email") or "").lower().strip()
    nome = body.get("nome") or request.headers.get("x-user-name")
    motivo = (body.get("motivo") or "").strip()
    if not motivo:
        raise HTTPException(400, "Motivo é obrigatório pra rejeição")
    if not await _aprovador_autorizado(email):
        raise HTTPException(403, "Apenas Douglas e admins podem rejeitar")
    return await _registrar_decisao_e_mover(
        card_id=card_id, decisao="rejeitado", motivo=motivo,
        aprovador_email=email, aprovador_nome=nome,
    )


# ════════════════════════════════════════════════════════════════════════
# Orçamento de Material (Fornecimento) — Aprovação Douglas
#
# Schema isolado `orcamento_produtos`. Não compartilha tabelas com o fluxo
# Completo. Aprovação gravada em `meta.aprovacao` da própria simulacao_produtos
# pra não acoplar com `orcamento_aprovacoes` do fluxo legacy.
# ════════════════════════════════════════════════════════════════════════


async def _sb_material(method: str, path: str, **kw) -> httpx.Response:
    """Igual a _sb mas aponta pro schema orcamento_produtos via Content/Accept-Profile."""
    headers = kw.pop("headers", {})
    if method.upper() == "GET":
        headers["Accept-Profile"] = "orcamento_produtos"
    else:
        headers["Content-Profile"] = "orcamento_produtos"
    return await _sb(method, path, headers=headers, **kw)


async def _carregar_dados_material(sim_id: str) -> dict:
    """Carrega proposta de material + card comercial vinculado."""
    r = await _sb_material("GET", f"/simulacao_produtos?select=*&id=eq.{sim_id}&limit=1")
    if r.status_code != 200 or not r.json():
        raise HTTPException(404, "Orçamento de material não encontrado")
    sim = r.json()[0]
    card_comercial = None
    parent_card_id = sim.get("card_comercial_id") or sim.get("card_id")
    if parent_card_id:
        r2 = await _sb("GET", f"/kanban_cards?select=id,title,obra,column_id,responsavel,details&id=eq.{parent_card_id}&limit=1")
        if r2.status_code == 200 and r2.json():
            card_comercial = r2.json()[0]
    aprov = (sim.get("meta") or {}).get("aprovacao") or None
    proposta_link = f"{PUBLIC_SPACE_URL}/material/{sim.get('numero') or sim['id']}"
    return {
        "tipo": "material",
        "simulacao": sim,
        "card_comercial": card_comercial,
        "vendedor": sim.get("vendedor") or (card_comercial.get("responsavel") if card_comercial else None),
        "orcamentista": sim.get("orcamentista") or "—",
        "cliente": sim.get("cliente"),
        "proposta_link": proposta_link,
        "proposta_pdf_url": proposta_link,
        "aprovacao": aprov,
        "historico": [aprov] if aprov else [],
    }


@app.get("/api/orcamento/aprovacao/material/pendentes")
async def aprovacao_material_pendentes() -> dict:
    """Lista propostas de material marcadas como principal (selected_at NOT NULL)
    e sem decisão registrada em meta.aprovacao."""
    r = await _sb_material(
        "GET",
        "/simulacao_produtos?select=*"
        "&selected_at=not.is.null"
        "&order=selected_at.desc",
    )
    if r.status_code != 200:
        raise HTTPException(r.status_code, r.text)
    items = []
    for sim in r.json():
        if (sim.get("meta") or {}).get("aprovacao"):
            continue  # já decidida
        try:
            items.append(await _carregar_dados_material(sim["id"]))
        except HTTPException:
            pass
    return {"items": items, "total": len(items)}


async def _registrar_decisao_material(
    *, sim_id: str, decisao: str, motivo: str | None,
    aprovador_email: str, aprovador_nome: str | None,
) -> dict:
    """Grava aprovacao em meta.aprovacao + notifica grupo Comercial."""
    dados = await _carregar_dados_material(sim_id)
    sim = dados["simulacao"]

    decisao_obj = {
        "status": decisao,
        "em": datetime.now(timezone.utc).isoformat(),
        "por_email": aprovador_email,
        "por_nome": aprovador_nome or aprovador_email,
        "motivo": motivo or None,
    }
    new_meta = {**(sim.get("meta") or {}), "aprovacao": decisao_obj}
    r = await _sb_material(
        "PATCH",
        f"/simulacao_produtos?id=eq.{sim_id}",
        json={"meta": new_meta, "status": "aprovado" if decisao == "aprovado" else "rejeitado"},
    )
    if r.status_code >= 400:
        raise HTTPException(r.status_code, r.text[:200])

    # Notifica grupo Comercial (Orçamentos)
    try:
        emoji = "✅" if decisao == "aprovado" else "🚫"
        titulo = "APROVADA" if decisao == "aprovado" else "REPROVADA"
        cliente = sim.get("cliente") or "—"
        numero = sim.get("numero") or sim["id"][:8]
        linhas = [
            f"{emoji} *Orçamento de Material {titulo}*",
            "",
            f"📋 *Proposta:* {numero}",
            f"👤 *Cliente:* {cliente}",
            f"🛠 *Vendedor:* {sim.get('vendedor') or '—'}",
            f"🔗 {dados['proposta_link']}",
        ]
        if decisao == "rejeitado" and motivo:
            linhas.append("")
            linhas.append(f"📋 *MOTIVO DA REPROVAÇÃO:*")
            linhas.append(f"_{motivo}_")
        linhas.append("")
        linhas.append(f"Decidido por *{aprovador_nome or aprovador_email}*")
        msg = "\n".join(linhas)
        await _evolution_send_text(GRUPO_ORCAMENTOS_JID, msg)
    except Exception as e:
        logger.warning("notify_material_grupo_fail", error=str(e))

    return {"ok": True, "decisao": decisao_obj, "proposta_link": dados["proposta_link"]}


@app.post("/api/orcamento/aprovacao/material/{sim_id}/aprovar")
async def aprovar_material(sim_id: str, request: Request) -> dict:
    body = await request.json() if (request.headers.get("content-type") or "").startswith("application/json") else {}
    email = (body.get("email") or request.headers.get("x-user-email") or "").lower().strip()
    nome = body.get("nome") or request.headers.get("x-user-name")
    if not await _aprovador_autorizado(email):
        raise HTTPException(403, "Apenas Douglas e admins podem aprovar")
    return await _registrar_decisao_material(
        sim_id=sim_id, decisao="aprovado", motivo=None,
        aprovador_email=email, aprovador_nome=nome,
    )


@app.post("/api/orcamento/aprovacao/material/{sim_id}/rejeitar")
async def rejeitar_material(sim_id: str, request: Request) -> dict:
    body = await request.json() if (request.headers.get("content-type") or "").startswith("application/json") else {}
    email = (body.get("email") or request.headers.get("x-user-email") or "").lower().strip()
    nome = body.get("nome") or request.headers.get("x-user-name")
    motivo = (body.get("motivo") or "").strip()
    if not motivo:
        raise HTTPException(400, "Motivo é obrigatório pra rejeição")
    if not await _aprovador_autorizado(email):
        raise HTTPException(403, "Apenas Douglas e admins podem rejeitar")
    return await _registrar_decisao_material(
        sim_id=sim_id, decisao="rejeitado", motivo=motivo,
        aprovador_email=email, aprovador_nome=nome,
    )


@app.get("/api/orcamento/aprovacao/todos-pendentes")
async def aprovacao_todos_pendentes() -> dict:
    """Lista UNIFICADA: aprovações pendentes de Completo + Material.

    Frontend (Homebroker /orcamento/aprovacao e CEO Dashboard aba "✓ Aprovação")
    consome este endpoint para exibir os dois tipos numa única lista.
    """
    completo = await aprovacao_pendentes()
    material = await aprovacao_material_pendentes()

    for item in completo.get("items", []):
        item["tipo"] = "completo"
    for item in material.get("items", []):
        item["tipo"] = "material"

    todos = (completo.get("items", []) or []) + (material.get("items", []) or [])
    return {
        "items": todos,
        "total": len(todos),
        "completo_total": completo.get("total", 0),
        "material_total": material.get("total", 0),
    }
