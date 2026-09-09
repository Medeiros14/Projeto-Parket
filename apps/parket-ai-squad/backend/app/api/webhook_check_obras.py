"""
Webhook de Check Diário de Obras.
Recebe mensagens da Evolution API quando um prestador responde.
Classifica com Claude, atualiza status, envia resposta automática e notifica grupo.
"""
import asyncio
import time
from fastapi import APIRouter, Request
from app.core.account_pool import account_pool
import httpx
import json
import re
import structlog

logger = structlog.get_logger(__name__)

router = APIRouter(tags=["webhook-check-obras"])

# ── Config ──
SUPABASE_URL = "https://hbxpilrxmitvzebluoom.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhieHBpbHJ4bWl0dnplYmx1b29tIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3Mjk0MjUyNywiZXhwIjoyMDg4NTE4NTI3fQ.fTovVTCBFcMrrhVCR6TsneALfMRLLLHZdMmSJH16L4A"

EVO_URL = "https://conect.parket.works"
EVO_INSTANCE = "Parket"
EVO_KEY = "4eab105201410d6865b86dca76ee9fa3"
# Instância da Secretaria de Obras — usada pra falar com prestadores
# (não com grupos administrativos). Mantém o tráfego isolado do número
# Parket principal (5511971975808).
EVO_SECRETARIA_INSTANCE = "Secretaria - Obras Parket"
EVO_SECRETARIA_KEY = "474070258960-4AF5-8CA8-3A563BCBC52E"

GRUPO_OBRAS_JID = "120363427046305569@g.us"  # 🏗 Parket - Obras
GRUPO_ATENDIMENTO_JID = "120363407367929089@g.us"  # 🎧 Parket - Atendimento
GRUPO_FISCAL_JID = "120363425769227152@g.us"  # 📊 Parket - Fiscal
GRUPO_PMO_JID = "120363405460675664@g.us"  # 📋 Parket - PMO

GRUPOS_NOTIFICAR = [GRUPO_OBRAS_JID, GRUPO_ATENDIMENTO_JID, GRUPO_FISCAL_JID, GRUPO_PMO_JID]

# Debounce: aguarda X segundos após última msg antes de processar (0 = desativado para teste)
DEBOUNCE_SECONDS = 45  # Aguarda 45s após última msg antes de processar

# Timeout sem resposta (minutos) — 3 min para teste, 30 min em produção
TIMEOUT_MINUTOS = 30

_timeout_task: asyncio.Task | None = None


# ── Redis (locks distribuídos entre workers) ──
def _cko_redis():
    """Redis client compartilhado entre workers do uvicorn."""
    import redis as _redis
    from app.config import settings as _s
    return _redis.from_url(_s.REDIS_URL)


def _cko_try_lock(key: str, ttl_seconds: int) -> bool:
    """Tenta adquirir lock distribuído. Retorna True se conseguiu, False se outro worker já tem."""
    try:
        return bool(_cko_redis().set(key, "1", nx=True, ex=ttl_seconds))
    except Exception as e:
        logger.error("redis_lock_error", key=key, error=str(e))
        return True  # fail-open: se Redis falhar, permite rodar (melhor duplicar que travar)


# ── Debounce distribuído via Redis (evita duplicidade entre workers) ──
_CKO_BUF_KEY = "cko:debounce:buf:{phone}"
_CKO_TS_KEY = "cko:debounce:ts:{phone}"
_CKO_CHECK_KEY = "cko:debounce:check:{phone}"
_CKO_LOCK_KEY = "cko:debounce:lock:{phone}"


# ── Claim atômico no Supabase ──
async def sb_update_claim(table: str, match: dict, data: dict) -> list:
    """Update atômico: retorna linhas atualizadas. Se filtro não matchar (ex: status já mudou),
    retorna lista vazia — indicando que outro worker/processo já claimou."""
    async with httpx.AsyncClient(timeout=10) as c:
        r = await c.patch(
            f"{SUPABASE_URL}/rest/v1/{table}",
            params=match,
            json=data,
            headers={
                "apikey": SUPABASE_KEY,
                "Authorization": f"Bearer {SUPABASE_KEY}",
                "Content-Type": "application/json",
                "Prefer": "return=representation",
            },
        )
        if r.is_success:
            try:
                return r.json() or []
            except Exception:
                return []
        return []

# ── Templates de resposta ──
RESPOSTAS_OK = [
    "Que bom {nome}! Ótimo, se precisar de alguma coisa, conta comigo! 👍",
    "Show {nome}! Que bom saber, qualquer coisa estou aqui! 💪",
    "Perfeito {nome}! Fico feliz, se precisar de algo é só chamar!",
    "Excelente {nome}! Ótimo dia de trabalho, conta comigo pro que precisar!",
    "Boa {nome}! Que continue assim, se precisar de alguma coisa me avisa! 👊",
    "Maravilha {nome}! Bom saber, qualquer necessidade conta comigo! ✅",
    "Top {nome}! Se precisar de alguma coisa, estou por aqui!",
    "Ótimo {nome}! Sucesso aí, qualquer coisa pode contar comigo!",
    "Beleza {nome}! Que bom, se precisar de algo é só falar!",
    "Muito bom {nome}! Fico à disposição, qualquer coisa me chama!",
]

RESPOSTAS_OCORRENCIA = [
    "Entendi {nome}, estamos verificando. Já te retorno com uma posição.",
    "Ok {nome}, recebi. Estamos verificando e te atualizo em breve.",
    "Certo {nome}, estamos verificando isso agora. Te dou retorno logo.",
    "{nome}, anotado. Estamos verificando aqui, obrigado por avisar!",
    "Obrigado por informar {nome}! Estamos verificando e já te falo.",
    "Entendi {nome}. Estamos verificando, fica tranquilo que resolvo.",
    "{nome}, recebido. Estamos analisando e te atualizo o mais rápido possível.",
]


async def has_active_check(phone: str) -> bool:
    """Verifica se existe check diário ativo (enviado) para esse telefone hoje.
    Usado pelo webhook principal para evitar que a TEKA responda prestadores."""
    import time as _t
    hoje = _t.strftime("%Y-%m-%d")
    phone_clean = re.sub(r"\D", "", phone)
    variants = [phone_clean]
    if phone_clean.startswith("55"):
        variants.append(phone_clean[2:])
    else:
        variants.append(f"55{phone_clean}")

    rows = await sb_query("obras_check_diario", {
        "data": f"eq.{hoje}",
        "status": "in.(enviado,ok,ocorrencia)",
        "select": "id,prestador_telefone",
    })
    for r in rows:
        tel_digits = re.sub(r"\D", "", r.get("prestador_telefone", ""))
        for pv in variants:
            if tel_digits.endswith(pv[-8:]):
                return True
    return False


# ── Supabase helpers ──
async def sb_query(table: str, params: dict) -> list:
    async with httpx.AsyncClient(timeout=10) as c:
        r = await c.get(f"{SUPABASE_URL}/rest/v1/{table}", params=params,
                        headers={"apikey": SUPABASE_KEY, "Authorization": f"Bearer {SUPABASE_KEY}"})
        return r.json() if r.is_success else []


async def sb_update(table: str, match: dict, data: dict):
    params = {k: v for k, v in match.items()}
    async with httpx.AsyncClient(timeout=10) as c:
        await c.patch(f"{SUPABASE_URL}/rest/v1/{table}", params=params, json=data,
                      headers={"apikey": SUPABASE_KEY, "Authorization": f"Bearer {SUPABASE_KEY}",
                               "Content-Type": "application/json", "Prefer": "return=minimal"})


async def enviar_whatsapp(phone: str, text: str):
    """Resposta automática pro prestador — sai pela Secretaria de Obras."""
    import urllib.parse
    inst = urllib.parse.quote(EVO_SECRETARIA_INSTANCE, safe="")
    async with httpx.AsyncClient(timeout=15) as c:
        await c.post(f"{EVO_URL}/message/sendText/{inst}",
                     json={"number": phone, "text": text},
                     headers={"Content-Type": "application/json", "apikey": EVO_SECRETARIA_KEY})


async def enviar_grupo(text: str):
    """Envia mensagem para todos os grupos configurados (Obras, Atendimento, Fiscal)."""
    async with httpx.AsyncClient(timeout=15) as c:
        for grupo_jid in GRUPOS_NOTIFICAR:
            if not grupo_jid:
                continue
            try:
                await c.post(f"{EVO_URL}/message/sendText/{EVO_INSTANCE}",
                             json={"number": grupo_jid, "text": text},
                             headers={"Content-Type": "application/json", "apikey": EVO_KEY})
            except Exception as e:
                logger.error("enviar_grupo_erro", grupo=grupo_jid, error=str(e))


# ── Classificação com Claude ──
async def classificar_com_claude(texto: str) -> dict:
    """Retorna {"status": "ok"} ou {"status": "ocorrencia", "resumo": "..."}"""
    try:
        from app.database import AsyncSessionLocal

        system = """Você é um assistente que classifica mensagens de prestadores de obras.
O prestador foi perguntado se está tudo bem na obra ou se tem alguma ocorrência.
Classifique como "ok" (tudo bem) ou "ocorrencia" (qualquer problema).
Responda APENAS JSON puro: {"status":"ok"} ou {"status":"ocorrencia","resumo":"descrição breve"}"""

        async with AsyncSessionLocal() as db:
            raw = await account_pool.chat(
                db=db,
                messages=[{"role": "user", "content": f'Resposta: "{texto}"'}],
                system_prompt=system,
            )

        match = re.search(r"\{[^}]+\}", raw)
        if match:
            parsed = json.loads(match.group(0))
            return parsed
    except Exception as e:
        logger.error("claude_classify_error", error=str(e))

    return _fallback_classificar(texto)


def _fallback_classificar(texto: str) -> dict:
    t = texto.lower()
    neg = ["problema", "falta", "parou", "parado", "atraso", "quebr", "erro", "sem material", "urgente", "chuva", "vazamento", "travado", "ajuda", "complicado", "refazer"]
    pos = ["tudo certo", "tudo ok", "tudo bem", "ok", "tranquilo", "beleza", "show", "top", "normal", "sem problema", "otimo", "perfeito"]
    for kw in neg:
        if kw in t:
            return {"status": "ocorrencia", "resumo": texto}
    for kw in pos:
        if kw in t:
            return {"status": "ok"}
    if len(t) < 20:
        return {"status": "ok"}
    return {"status": "ocorrencia", "resumo": texto}


# ── Processar resposta ──
async def processar_resposta(phone: str, texto_completo: str, check: dict):
    """Classifica, atualiza DB, responde ao prestador, notifica grupo."""
    logger.info("check_obras_processando", prestador=check["prestador_nome"], phone=phone)

    # 1. Classifica
    result = await classificar_com_claude(texto_completo)
    status = result.get("status", "ocorrencia")
    resumo = result.get("resumo", texto_completo)

    # 2. Atualiza DB (CLAIM ATÔMICO: só prossegue se status ainda for "enviado")
    from datetime import datetime
    import random
    agora = datetime.utcnow().isoformat() + "Z"
    updates = {
        "status": status,
        "resposta": texto_completo,
        "respondido_em": agora,
    }
    if status == "ocorrencia":
        updates["ocorrencia_texto"] = resumo
        updates["ocorrencia_gravidade"] = "media"

    claimed = await sb_update_claim(
        "obras_check_diario",
        {"id": f"eq.{check['id']}", "status": "eq.enviado"},
        updates,
    )
    if not claimed:
        # Outro worker ou o timeout loop já processou — aborta sem duplicar notificação
        logger.info("check_obras_ja_processado", check_id=check["id"], prestador=check["prestador_nome"])
        return
    logger.info("check_obras_db_atualizado", check_id=check["id"], status=status, resposta=texto_completo[:100])

    # 3. Responde ao prestador
    nome = check["prestador_nome"]
    if status == "ok":
        msg = random.choice(RESPOSTAS_OK).format(nome=nome)
    else:
        msg = random.choice(RESPOSTAS_OCORRENCIA).format(nome=nome)
    await enviar_whatsapp(phone, msg)

    # 4. Notifica grupo se ocorrência
    if status == "ocorrencia" and GRUPO_OBRAS_JID:
        alerta = (
            f"🚨 *ALERTA DE OCORRÊNCIA*\n\n"
            f"📍 *Obra:* {check['obra_titulo']}"
            f"{' (' + check['obra_codigo'] + ')' if check.get('obra_codigo') else ''}\n"
            f"👷 *Prestador:* {nome} — {check.get('prestador_categoria', '')}\n"
            f"📋 *Ocorrência:* {resumo}\n"
            f"📞 *Contato:* {phone}\n"
            f"⏰ *Data:* {agora[:16].replace('T', ' ')}"
        )
        await enviar_grupo(alerta)
    elif status == "ok" and GRUPO_OBRAS_JID:
        # Notifica OK também para manter grupo informado
        await enviar_grupo(
            f"✅ *Check OK* — {check['obra_titulo']}"
            f"{' (' + check.get('obra_codigo','') + ')' if check.get('obra_codigo') else ''}\n"
            f"👷 {nome} — {check.get('prestador_categoria', '')}: Tudo certo"
        )

    # 5. Registra na ficha do cliente (card kanban) — histórico de checks
    try:
        obra_id = check.get("obra_id")
        if obra_id:
            cards = await sb_query("kanban_cards", {"id": f"eq.{obra_id}", "select": "id,details"})
            if cards:
                card = cards[0]
                det = card.get("details") or {}
                historico_checks = det.get("historico_checks", [])
                historico_checks.append({
                    "data": check["data"],
                    "prestador_nome": nome,
                    "prestador_id": check.get("prestador_id"),
                    "prestador_categoria": check.get("prestador_categoria"),
                    "status": status,
                    "resposta": texto_completo[:500],
                    "ocorrencia": resumo if status == "ocorrencia" else None,
                    "timestamp": agora,
                })
                # Manter últimos 100 registros por card
                if len(historico_checks) > 100:
                    historico_checks = historico_checks[-100:]
                det["historico_checks"] = historico_checks
                await sb_update("kanban_cards", {"id": f"eq.{obra_id}"}, {"details": det})
                logger.info("check_obras_card_atualizado", obra_id=obra_id, historico_count=len(historico_checks))
    except Exception as e:
        logger.error("check_obras_card_update_error", error=str(e))

    # 6. Atualiza contadores na tabela equipes_parket
    try:
        await _atualizar_contadores_equipe(check.get("prestador_id"))
    except Exception as e:
        logger.error("check_obras_contadores_error", error=str(e))

    logger.info("check_obras_processado", prestador=nome, status=status)


async def _atualizar_contadores_equipe(prestador_id: str):
    """Recalcula contadores de histórico de um prestador na tabela equipes_parket."""
    if not prestador_id:
        return
    checks = await sb_query("obras_check_diario", {
        "prestador_id": f"eq.{prestador_id}",
        "select": "status,data,obra_id",
    })
    total = len(checks)
    ok = sum(1 for c in checks if c["status"] == "ok")
    oc = sum(1 for c in checks if c["status"] == "ocorrencia")
    sr = sum(1 for c in checks if c["status"] == "sem_resposta")
    dias = len(set(c["data"] for c in checks))
    obras = len(set(c["obra_id"] for c in checks))
    pct = round(100 * ok / total, 1) if total > 0 else 0
    ultimo = max((c["data"] for c in checks), default=None)

    await sb_update("equipes_parket", {"id": f"eq.{prestador_id}"}, {
        "total_checks": total,
        "total_ok": ok,
        "total_ocorrencias": oc,
        "total_sem_resposta": sr,
        "pct_ok": pct,
        "ultimo_check": ultimo,
        "dias_verificados": dias,
        "obras_distintas": obras,
    })


async def _enviar_relatorio_final(checks: list, hoje: str):
    if not GRUPO_OBRAS_JID:
        return
    total = len(checks)
    oks = sum(1 for c in checks if c["status"] == "ok")
    ocorrencias = [c for c in checks if c["status"] == "ocorrencia"]
    sem_resp = sum(1 for c in checks if c["status"] == "sem_resposta")

    msg = f"📊 *RELATÓRIO CHECK DIÁRIO — {hoje}*\n\n"
    msg += f"✅ *{oks}* OK  ·  ⚠️ *{len(ocorrencias)}* Ocorrência(s)  ·  ⏳ *{sem_resp}* Sem resposta\n"
    msg += f"📋 Total: {total} prestadores verificados\n"

    if ocorrencias:
        msg += "\n🚨 *OCORRÊNCIAS:*\n"
        for oc in ocorrencias:
            msg += f"• *{oc['obra_titulo']}* — {oc['prestador_nome']}: {oc.get('ocorrencia_texto', '—')}\n"

    if oks == total:
        msg += "\n🎉 *Todas as obras estão em ordem hoje!*"

    msg += "\n\n_Relatório gerado automaticamente — Parket Obras_"
    await enviar_grupo(msg)


# ── Webhook endpoint ──
@router.post("/webhook/check-obras")
async def webhook_check_obras(request: Request):
    """Recebe mensagens da Evolution API e processa respostas de prestadores."""
    try:
        body = await request.json()
    except Exception:
        return {"ok": True}

    # Evolution API envia diferentes eventos
    event = body.get("event")
    if event not in ("messages.upsert", "MESSAGES_UPSERT"):
        return {"ok": True}

    data = body.get("data", {})
    key = data.get("key", {})

    # Ignora mensagens enviadas por nós
    if key.get("fromMe"):
        return {"ok": True}

    # Extrai telefone e texto
    # Suporta formato antigo (@s.whatsapp.net) e novo (@lid com remoteJidAlt)
    jid = key.get("remoteJid", "")
    jid_alt = key.get("remoteJidAlt", "")

    # Ignora grupos (jid termina com @g.us)
    if jid.endswith("@g.us") or jid_alt.endswith("@g.us"):
        return {"ok": True}

    # Resolve telefone: prefere @s.whatsapp.net, senão usa remoteJidAlt
    if jid.endswith("@s.whatsapp.net"):
        phone = jid.replace("@s.whatsapp.net", "")
    elif jid_alt.endswith("@s.whatsapp.net"):
        phone = jid_alt.replace("@s.whatsapp.net", "")
    else:
        # Não é DM de telefone conhecido (pode ser newsletter, broadcast, etc)
        return {"ok": True}

    message = data.get("message", {})
    texto = message.get("conversation") or message.get("extendedTextMessage", {}).get("text") or ""

    # ── Processamento de mídia (áudio, imagem, documento, vídeo) ──
    MEDIA_TYPES = ["audioMessage", "imageMessage", "documentMessage", "videoMessage"]
    has_media = any(k in message for k in MEDIA_TYPES)

    if has_media:
        try:
            from app.core.media_processor import process_media_message
            media_text = await process_media_message(message, data)
            if media_text:
                texto = (texto + "\n\n" + media_text).strip() if texto else media_text
                logger.info("check_obras_media_processed",
                            phone=phone, media_type=[k for k in MEDIA_TYPES if k in message],
                            text_preview=media_text[:80])
        except Exception as e:
            logger.error("check_obras_media_error", phone=phone, error=str(e))

    if not texto:
        return {"ok": True}

    # Busca check ativo para esse telefone
    # Normaliza: remove 55 do início se tiver
    phone_variants = [phone]
    if phone.startswith("55"):
        phone_variants.append(phone[2:])
    else:
        phone_variants.append(f"55{phone}")

    hoje = time.strftime("%Y-%m-%d")
    checks = []
    for pv in phone_variants:
        # Busca com telefone formatado (com espaços/hifens)
        rows = await sb_query("obras_check_diario", {
            "data": f"eq.{hoje}",
            "status": "eq.enviado",
            "select": "*",
        })
        for r in rows:
            tel_digits = re.sub(r"\D", "", r.get("prestador_telefone", ""))
            if tel_digits.endswith(pv[-8:]):  # compara últimos 8 dígitos
                checks.append(r)
        if checks:
            break

    if not checks:
        return {"ok": True}  # Não é resposta de check

    check = checks[0]

    # Debounce distribuído via Redis (funciona entre múltiplos workers uvicorn)
    if DEBOUNCE_SECONDS > 0:
        await _debounce_redis(phone, texto, check)
    else:
        await processar_resposta(phone, texto, check)

    return {"ok": True}


async def _debounce_redis(phone: str, texto: str, check: dict):
    """Debounce com estado no Redis — acumula mensagens do mesmo prestador.
    Apenas UM worker segura o lock de flush; os demais só empilham texto e retornam.
    Isso evita que o mesmo check seja processado duas vezes quando 2+ mensagens
    chegam em workers diferentes."""
    import json as _json
    import time as _time

    r = _cko_redis()
    buf_key = _CKO_BUF_KEY.format(phone=phone)
    ts_key = _CKO_TS_KEY.format(phone=phone)
    check_key = _CKO_CHECK_KEY.format(phone=phone)
    lock_key = _CKO_LOCK_KEY.format(phone=phone)

    # 1) Acumula texto + timestamp + snapshot do check no Redis
    pipe = r.pipeline()
    pipe.rpush(buf_key, texto)
    pipe.expire(buf_key, 600)
    pipe.set(ts_key, str(_time.time()), ex=600)
    pipe.set(check_key, _json.dumps(check), ex=600)
    pipe.execute()

    # 2) Tenta pegar o lock de flush. Se outro worker já tem, só retorna —
    #    ele vai reler o buffer e processar com as mensagens novas acumuladas.
    if not r.set(lock_key, "1", nx=True, ex=300):
        logger.info("check_obras_debounce_extended", phone=phone, chars=len(texto))
        return

    async def _flush_holder():
        try:
            # Espera dinâmica: enquanto novas mensagens chegarem, estende.
            while True:
                await asyncio.sleep(DEBOUNCE_SECONDS)
                ts_raw = r.get(ts_key)
                if not ts_raw:
                    return
                last_ts = float(ts_raw)
                idle = _time.time() - last_ts
                if idle >= DEBOUNCE_SECONDS - 0.1:
                    break  # Parou de receber — pode flushar
                r.expire(lock_key, 300)  # Mantém lock vivo

            # Pop atômico do buffer
            with r.pipeline() as p:
                p.lrange(buf_key, 0, -1)
                p.delete(buf_key)
                p.get(check_key)
                p.delete(check_key)
                p.delete(ts_key)
                textos, _, check_raw, _, _ = p.execute()

            if not textos:
                return

            textos_decoded = [t.decode() if isinstance(t, bytes) else t for t in textos]
            texto_final = "\n".join(textos_decoded)
            check_data = _json.loads(check_raw.decode() if isinstance(check_raw, bytes) else check_raw) if check_raw else check

            await processar_resposta(phone, texto_final, check_data)
        finally:
            r.delete(lock_key)

    asyncio.create_task(_flush_holder())


# ── Config endpoint ──
@router.post("/check-obras/config")
async def config_check_obras(request: Request):
    """Configura JID do grupo, debounce e timeout."""
    global GRUPO_OBRAS_JID, DEBOUNCE_SECONDS, TIMEOUT_MINUTOS
    body = await request.json()
    if "grupo_jid" in body:
        GRUPO_OBRAS_JID = body["grupo_jid"]
    if "debounce" in body:
        DEBOUNCE_SECONDS = int(body["debounce"])
    if "timeout_minutos" in body:
        TIMEOUT_MINUTOS = int(body["timeout_minutos"])
    return {"grupo_jid": GRUPO_OBRAS_JID, "debounce": DEBOUNCE_SECONDS, "timeout_minutos": TIMEOUT_MINUTOS}


@router.get("/check-obras/config")
async def get_config_check_obras():
    return {"grupo_jid": GRUPO_OBRAS_JID, "debounce": DEBOUNCE_SECONDS, "timeout_minutos": TIMEOUT_MINUTOS}


# ── Timeout automático: verifica checks sem resposta ──
async def _loop_timeout():
    """Roda a cada 60s verificando checks enviados que passaram do timeout."""
    while True:
        await asyncio.sleep(60)
        try:
            from datetime import datetime, timezone
            agora = datetime.now(timezone.utc)
            hoje = agora.strftime("%Y-%m-%d")

            checks = await sb_query("obras_check_diario", {
                "data": f"eq.{hoje}",
                "status": "eq.enviado",
                "select": "*",
            })

            for check in checks:
                enviado_em = check.get("enviado_em")
                if not enviado_em:
                    continue
                # Parse timestamp
                try:
                    ts = datetime.fromisoformat(enviado_em.replace("Z", "+00:00"))
                except:
                    continue

                minutos = (agora - ts).total_seconds() / 60
                if minutos >= TIMEOUT_MINUTOS:
                    # CLAIM ATÔMICO: só marca como sem_resposta se status ainda for "enviado".
                    # Se outro worker ou o processar_resposta() pegou antes, claim retorna vazio
                    # e a notificação é pulada — evita duplicidade.
                    claimed = await sb_update_claim(
                        "obras_check_diario",
                        {"id": f"eq.{check['id']}", "status": "eq.enviado"},
                        {"status": "sem_resposta", "respondido_em": agora.isoformat()},
                    )
                    if not claimed:
                        continue
                    logger.info("check_obras_timeout", prestador=check["prestador_nome"], minutos=round(minutos, 1))

                    # Registra no card
                    try:
                        obra_id = check.get("obra_id")
                        if obra_id:
                            cards = await sb_query("kanban_cards", {"id": f"eq.{obra_id}", "select": "id,details"})
                            if cards:
                                det = cards[0].get("details") or {}
                                hist = det.get("historico_checks", [])
                                hist.append({
                                    "data": check["data"],
                                    "prestador_nome": check["prestador_nome"],
                                    "prestador_id": check.get("prestador_id"),
                                    "prestador_categoria": check.get("prestador_categoria"),
                                    "status": "sem_resposta",
                                    "resposta": None,
                                    "timestamp": agora.isoformat(),
                                })
                                if len(hist) > 100:
                                    hist = hist[-100:]
                                det["historico_checks"] = hist
                                await sb_update("kanban_cards", {"id": f"eq.{obra_id}"}, {"details": det})
                    except Exception as e:
                        logger.error("timeout_card_error", error=str(e))

                    # Notifica grupos
                    nome = check["prestador_nome"]
                    await enviar_grupo(
                        f"⏳ *SEM RESPOSTA* — {check['obra_titulo']}"
                        f"{' (' + check.get('obra_codigo','') + ')' if check.get('obra_codigo') else ''}\n"
                        f"👷 {nome} — {check.get('prestador_categoria', '')}\n"
                        f"⏱ Sem resposta há {round(minutos)} minutos"
                    )

                    # Atualiza contadores da equipe
                    try:
                        await _atualizar_contadores_equipe(check.get("prestador_id"))
                    except:
                        pass

        except Exception as e:
            logger.error("timeout_loop_error", error=str(e))


async def _loop_relatorio_diario():
    """Envia relatório diário fixo às 8:30 BRT (11:30 UTC) para os grupos."""
    _relatorio_enviado_hoje = ""
    while True:
        await asyncio.sleep(60)
        try:
            from datetime import datetime, timezone, timedelta
            brt = timezone(timedelta(hours=-3))
            agora_brt = datetime.now(brt)
            hoje = agora_brt.strftime("%Y-%m-%d")

            # Só envia às 8:30 (entre 8:30 e 8:31) e só uma vez por dia
            if agora_brt.hour == 8 and agora_brt.minute == 30 and _relatorio_enviado_hoje != hoje:
                # LOCK DIÁRIO: só um worker envia o relatório do dia
                if _cko_try_lock(f"cko:relatorio:lock:{hoje}", ttl_seconds=86400):
                    ontem = (agora_brt - timedelta(days=1)).strftime("%Y-%m-%d")
                    checks = await sb_query("obras_check_diario", {"data": f"eq.{ontem}", "select": "*"})
                    if checks:
                        await _enviar_relatorio_final(checks, ontem)
                        logger.info("relatorio_diario_enviado", data=ontem, total=len(checks))
                _relatorio_enviado_hoje = hoje

            # Reset à meia-noite
            if agora_brt.hour == 0 and agora_brt.minute == 0:
                _relatorio_enviado_hoje = ""

        except Exception as e:
            logger.error("relatorio_diario_error", error=str(e))


# ═══ Disparo automático de mensagens ═══

TEMPLATES_BOM_DIA = [
    "Bom dia {nome}! Como está a obra {obra} hoje? Tudo certo ou tem alguma ocorrência?",
    "Olá {nome}, bom dia! Passando pra saber como tá andando a {obra}. Alguma novidade?",
    "E aí {nome}, bom dia! Como tá o andamento da obra {obra}? Tudo tranquilo?",
    "Bom dia {nome}! Tudo bem? Como está o serviço na {obra} hoje?",
    "Oi {nome}! Bom dia. A obra {obra} tá fluindo bem? Precisa de algo?",
    "Bom dia {nome}! Como vai o trabalho na {obra}? Algum problema ou ocorrência?",
    "Olá {nome}! Tudo certo aí na {obra}? Me atualiza por favor 👍",
    "Bom dia {nome}, como está o progresso na obra {obra}? Alguma pendência?",
    "E aí {nome}! Bom dia! A {obra} tá dentro do planejado? Me dá um retorno",
    "Oi {nome}, bom dia! Preciso de uma atualização da {obra}. Como tá?",
    "Bom dia {nome}! Passando aqui pra check diário. A obra {obra} tá ok?",
    "{nome}, bom dia! Me manda um status da {obra} por favor. Tudo certo?",
    "Bom dia! {nome}, como vai aí na {obra}? Material ok? Equipe completa?",
    "Oi {nome}! Começando o dia. Como está a situação na {obra}?",
    "Bom dia {nome}! Fazendo o check do dia. A {obra} está em ordem?",
    "E aí {nome}, tudo bem? Queria saber se a obra {obra} tá andando sem problemas",
    "Bom dia {nome}! Alguma atualização da {obra} pra hoje?",
    "Olá {nome}, bom dia! Check diário: como tá a {obra}? Tudo ok ou tem algo?",
    "Bom dia {nome}! Me dá uma posição da obra {obra}. Tá tudo fluindo?",
    "{nome}! Bom dia. Obra {obra}: alguma ocorrência ou segue tudo bem?",
    "Oi {nome}, bom dia! Rápido check: como tá a {obra} hoje?",
    "Bom dia {nome}! Verificação diária da {obra}. Pode me atualizar?",
    "E aí {nome}! Tudo certo na {obra}? Se precisar de algo avisa",
    "Bom dia {nome}! O serviço na {obra} começou bem hoje?",
    "Olá {nome}! Check da manhã: {obra} tá dentro do esperado?",
]

_last_template: dict[str, int] = {}  # prestador_id -> último template usado

def _pick_template(prestador_id: str) -> int:
    last = _last_template.get(prestador_id, -1)
    import random
    idx = last
    while idx == last:
        idx = random.randint(0, len(TEMPLATES_BOM_DIA) - 1)
    _last_template[prestador_id] = idx
    return idx

def _random_delay() -> float:
    """Delay randômico entre 45s e 150s (anti-bloqueio)."""
    import random
    return 45 + random.random() * 105


async def _disparo_diario():
    """Gera checks e dispara mensagens para todos os prestadores ativos."""
    from datetime import datetime, timezone, timedelta
    brt = timezone(timedelta(hours=-3))
    hoje = datetime.now(brt).strftime("%Y-%m-%d")

    # LOCK DIÁRIO: só UM worker/processo roda o disparo por dia.
    # TTL 24h. Se outro worker tentar em paralelo, aborta.
    if not _cko_try_lock(f"cko:disparo:lock:{hoje}", ttl_seconds=86400):
        logger.info("disparo_diario_ja_rodando", data=hoje)
        return {"disparados": 0, "msg": "Disparo já em execução por outro worker"}

    logger.info("disparo_diario_iniciando", data=hoje)

    # 1. Busca cards de obras ativos com prestadores
    cards = await sb_query("kanban_cards", {
        "dept_id": "eq.obras",
        "select": "id,title,obra,details",
    })

    registros = []
    for card in cards:
        col = card.get("column_id", "")
        if col in ("finalizado", "arquivado", "concluido"):
            continue
        det = card.get("details") or {}
        prestadores = det.get("prestadores") or []
        for p in prestadores:
            if not p.get("telefone"):
                continue
            registros.append({
                "data": hoje,
                "obra_id": card["id"],
                "obra_titulo": card.get("title", ""),
                "obra_codigo": card.get("obra") or None,
                "prestador_id": p["id"],
                "prestador_nome": p["nome"],
                "prestador_telefone": p["telefone"],
                "prestador_categoria": p.get("categoria") or None,
                "status": "pendente",
            })

    if not registros:
        logger.info("disparo_diario_sem_prestadores")
        return {"disparados": 0, "msg": "Nenhum prestador com telefone alocado"}

    # 2. Inserir checks (ignora duplicatas)
    async with httpx.AsyncClient(timeout=10) as c:
        await c.post(f"{SUPABASE_URL}/rest/v1/obras_check_diario",
                     json=registros,
                     headers={"apikey": SUPABASE_KEY, "Authorization": f"Bearer {SUPABASE_KEY}",
                              "Content-Type": "application/json", "Prefer": "resolution=ignore-duplicates"})

    # 3. Disparar mensagens com delay anti-bloqueio
    import asyncio as aio
    enviados = 0
    erros = 0
    for i, reg in enumerate(registros):
        try:
            idx = _pick_template(reg["prestador_id"])
            msg = TEMPLATES_BOM_DIA[idx].format(nome=reg["prestador_nome"], obra=reg["obra_titulo"])
            phone = reg["prestador_telefone"].replace(" ", "").replace("-", "")
            if not phone.startswith("55"):
                phone = "55" + phone

            # CLAIM ATÔMICO: só envia se status ainda for "pendente".
            # Previne envio duplicado caso outro processo também tenha tentado.
            claimed = await sb_update_claim(
                "obras_check_diario",
                {"data": f"eq.{hoje}",
                 "prestador_id": f"eq.{reg['prestador_id']}",
                 "obra_id": f"eq.{reg['obra_id']}",
                 "status": "eq.pendente"},
                {"status": "enviado", "mensagem_enviada": msg, "enviado_em": datetime.now(timezone.utc).isoformat()},
            )
            if not claimed:
                logger.info("disparo_diario_ja_enviado", prestador=reg["prestador_nome"])
                continue
            await enviar_whatsapp(phone, msg)
            enviados += 1
            logger.info("disparo_diario_enviado", prestador=reg["prestador_nome"], obra=reg["obra_titulo"])
        except Exception as e:
            erros += 1
            logger.error("disparo_diario_erro", prestador=reg["prestador_nome"], error=str(e))

        # Delay anti-bloqueio entre envios
        if i < len(registros) - 1:
            delay = _random_delay()
            await aio.sleep(delay)

    logger.info("disparo_diario_concluido", enviados=enviados, erros=erros, total=len(registros))
    return {"disparados": enviados, "erros": erros, "total": len(registros)}


async def _loop_disparo_diario():
    """Roda a cada 60s, dispara checks às 8:00 BRT automaticamente."""
    _disparado_hoje = ""
    while True:
        await asyncio.sleep(60)
        try:
            from datetime import datetime, timezone, timedelta
            brt = timezone(timedelta(hours=-3))
            agora = datetime.now(brt)
            hoje = agora.strftime("%Y-%m-%d")

            # Dispara às 8:00 BRT (entre 8:00 e 8:01), só dias úteis (seg-sex)
            if agora.hour == 8 and agora.minute == 0 and agora.weekday() < 5 and _disparado_hoje != hoje:
                await _disparo_diario()
                _disparado_hoje = hoje

            if agora.hour == 0 and agora.minute == 0:
                _disparado_hoje = ""
        except Exception as e:
            logger.error("loop_disparo_error", error=str(e))


@router.on_event("startup")
async def _start_loops():
    global _timeout_task
    _timeout_task = asyncio.create_task(_loop_timeout())
    asyncio.create_task(_loop_relatorio_diario())
    # _loop_disparo_diario PAUSADO por decisão do gestor — disparo agora
    # é MANUAL via POST /api/check-obras/disparar. Pra reativar, defina
    # env CHECK_DIARIO_AUTO_DISABLED=0 (ou remova a env var).
    import os as _os_chk
    if _os_chk.getenv("CHECK_DIARIO_AUTO_DISABLED", "1") != "1":
        asyncio.create_task(_loop_disparo_diario())
        disparo_modo = "08:00 BRT (auto)"
    else:
        disparo_modo = "MANUAL (cron pausado)"
        logger.warning(
            "loop_disparo_diario_DISABLED_via_env",
            hint="manual only — POST /api/check-obras/disparar",
        )
    logger.info("check_obras_loops_started", timeout_minutos=TIMEOUT_MINUTOS, disparo=disparo_modo, relatorio="08:30 BRT", debounce=DEBOUNCE_SECONDS)


# ── Endpoint para disparo manual ──
@router.post("/check-obras/disparar")
async def disparar_manual():
    """Dispara check diário manualmente (gera checks + envia mensagens)."""
    result = await _disparo_diario()
    return result


@router.post("/check-obras/enviar-relatorio")
async def enviar_relatorio_manual(request: Request):
    """Envia relatório do dia para os grupos manualmente."""
    body = await request.json() if request.headers.get("content-type") == "application/json" else {}
    data = body.get("data") or time.strftime("%Y-%m-%d")
    checks = await sb_query("obras_check_diario", {"data": f"eq.{data}", "select": "*"})
    if not checks:
        return {"ok": False, "msg": f"Sem checks para {data}"}
    await _enviar_relatorio_final(checks, data)
    return {"ok": True, "data": data, "total": len(checks)}


# ═══ API de Relatórios por Prestador ═══

@router.get("/check-obras/relatorio-equipes")
async def relatorio_equipes():
    """Retorna histórico consolidado de cada equipe/prestador."""
    rows = await sb_query("vw_prestador_historico", {"select": "*", "order": "total_checks.desc"})
    return {"equipes": rows}


@router.get("/check-obras/relatorio-equipe/{prestador_id}")
async def relatorio_equipe_detalhe(prestador_id: str):
    """Retorna checks detalhados de um prestador específico."""
    checks = await sb_query("obras_check_diario", {
        "prestador_id": f"eq.{prestador_id}",
        "select": "*",
        "order": "data.desc",
        "limit": "100",
    })
    # Resumo
    total = len(checks)
    ok = sum(1 for c in checks if c["status"] == "ok")
    ocorrencia = sum(1 for c in checks if c["status"] == "ocorrencia")
    sem_resp = sum(1 for c in checks if c["status"] == "sem_resposta")
    dias = len(set(c["data"] for c in checks))
    obras = len(set(c["obra_id"] for c in checks))

    return {
        "prestador_id": prestador_id,
        "prestador_nome": checks[0]["prestador_nome"] if checks else "",
        "prestador_categoria": checks[0].get("prestador_categoria", "") if checks else "",
        "prestador_telefone": checks[0].get("prestador_telefone", "") if checks else "",
        "resumo": {
            "total_checks": total,
            "total_ok": ok,
            "total_ocorrencias": ocorrencia,
            "total_sem_resposta": sem_resp,
            "pct_ok": round(100 * ok / total, 1) if total > 0 else 0,
            "pct_ocorrencia": round(100 * ocorrencia / total, 1) if total > 0 else 0,
            "dias_verificados": dias,
            "obras_distintas": obras,
        },
        "checks": checks,
    }


@router.get("/check-obras/relatorio-obra/{obra_id}")
async def relatorio_obra(obra_id: str):
    """Retorna histórico de checks de uma obra específica (ficha do cliente)."""
    checks = await sb_query("obras_check_diario", {
        "obra_id": f"eq.{obra_id}",
        "select": "*",
        "order": "data.desc,prestador_nome",
        "limit": "200",
    })
    # Agrupar por data
    por_data: dict = {}
    for c in checks:
        d = c["data"]
        if d not in por_data:
            por_data[d] = {"data": d, "checks": [], "total": 0, "ok": 0, "ocorrencia": 0, "sem_resposta": 0}
        por_data[d]["checks"].append(c)
        por_data[d]["total"] += 1
        if c["status"] == "ok":
            por_data[d]["ok"] += 1
        elif c["status"] == "ocorrencia":
            por_data[d]["ocorrencia"] += 1
        elif c["status"] == "sem_resposta":
            por_data[d]["sem_resposta"] += 1

    return {
        "obra_id": obra_id,
        "obra_titulo": checks[0]["obra_titulo"] if checks else "",
        "dias": list(por_data.values()),
        "total_checks": len(checks),
    }


# ═══ Recálculo de produtividade por número de equipes ═══

@router.post("/check-obras/recalcular-cronograma/{card_id}")
async def recalcular_cronograma(card_id: str):
    """Recalcula dias úteis do cronograma baseado no número de equipes alocadas."""
    cards = await sb_query("kanban_cards", {"id": f"eq.{card_id}", "select": "id,details"})
    if not cards:
        return {"error": "Card não encontrado"}
    
    det = cards[0].get("details") or {}
    prestadores = det.get("prestadores", [])
    crono = det.get("cronograma_pmo", {})
    itens = crono.get("itens", [])
    
    if not itens:
        return {"error": "Sem cronograma configurado"}
    
    num_equipes = len(prestadores) if prestadores else 1
    if num_equipes < 1:
        num_equipes = 1
    
    # Recalcula dias úteis de cada item
    total_dias_original = 0
    total_dias_ajustado = 0
    
    for item in itens:
        dias_base = item.get("dias_uteis_base") or item.get("dias_uteis", 0)
        # Salva o base se ainda não existe
        if "dias_uteis_base" not in item:
            item["dias_uteis_base"] = dias_base
        
        # Calcula ajustado
        dias_ajustado = max(1, round(dias_base / num_equipes))
        item["dias_uteis"] = dias_ajustado
        item["equipes_alocadas"] = num_equipes
        
        total_dias_original += dias_base
        total_dias_ajustado += dias_ajustado
    
    # Atualiza total
    crono["itens"] = itens
    crono["total_dias_uteis"] = total_dias_ajustado
    crono["total_dias_uteis_base"] = total_dias_original
    crono["equipes_alocadas"] = num_equipes
    det["cronograma_pmo"] = crono
    
    await sb_update("kanban_cards", {"id": f"eq.{card_id}"}, {"details": det})
    
    return {
        "card_id": card_id,
        "equipes": num_equipes,
        "total_dias_original": total_dias_original,
        "total_dias_ajustado": total_dias_ajustado,
        "reducao_pct": round((1 - total_dias_ajustado / total_dias_original) * 100, 1) if total_dias_original > 0 else 0,
        "itens": len(itens),
    }


@router.post("/check-obras/recalcular-todos")
async def recalcular_todos():
    """Recalcula cronograma de TODOS os cards com prestadores e cronograma."""
    cards = await sb_query("kanban_cards", {
        "dept_id": "in.(obras,produtividade)",
        "select": "id,details",
    })
    
    recalculados = 0
    for card in cards:
        det = card.get("details") or {}
        prestadores = det.get("prestadores", [])
        crono = det.get("cronograma_pmo", {})
        itens = crono.get("itens", [])
        
        if not itens or not prestadores:
            continue
        
        num_equipes = len(prestadores)
        if num_equipes <= 1:
            continue
        
        changed = False
        for item in itens:
            dias_base = item.get("dias_uteis_base") or item.get("dias_uteis", 0)
            if "dias_uteis_base" not in item:
                item["dias_uteis_base"] = dias_base
                changed = True
            
            dias_ajustado = max(1, round(dias_base / num_equipes))
            if item.get("dias_uteis") != dias_ajustado:
                item["dias_uteis"] = dias_ajustado
                item["equipes_alocadas"] = num_equipes
                changed = True
        
        if changed:
            total_base = sum(i.get("dias_uteis_base", 0) for i in itens)
            total_ajustado = sum(i.get("dias_uteis", 0) for i in itens)
            crono["itens"] = itens
            crono["total_dias_uteis"] = total_ajustado
            crono["total_dias_uteis_base"] = total_base
            crono["equipes_alocadas"] = num_equipes
            det["cronograma_pmo"] = crono
            await sb_update("kanban_cards", {"id": f"eq.{card['id']}"}, {"details": det})
            recalculados += 1
    
    return {"recalculados": recalculados, "total_cards": len(cards)}
