"""
Evolution API Webhook Handler
==============================
Receives WhatsApp events and dispatches them to the appropriate agent.
"""

import asyncio
from fastapi import APIRouter, Request, BackgroundTasks, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
import structlog

from app.database import AsyncSessionLocal
import re
import json as _json
from datetime import datetime
from app.core.agno_engine import agent_squad
from app.core.evolution_client import evolution_client, evolution_comercial_client, get_client_for_instance
from app.core.sdr_assigner import pick_next_sdr, SDR_NAMES

logger = structlog.get_logger(__name__)
router = APIRouter(prefix="/webhook", tags=["webhook"])


@router.post("/teka/reset/{phone}")
async def reset_teka_conversation(phone: str):
    """
    Reset completo da conversa TEKA para um número.
    Limpa: card no Supabase, histórico no Redis, cache do agente.
    """
    from supabase import create_client
    from app.config import settings
    import redis

    sb = create_client(settings.SUPABASE_URL, settings.SUPABASE_SERVICE_KEY)
    cleaned = []

    # 1. Delete card(s) do Supabase by celular in details JSONB
    result = sb.table("kanban_cards").delete().eq("details->>celular", phone).execute()
    deleted_cards = len(result.data or [])
    if deleted_cards:
        cleaned.append(f"Cards por celular: {deleted_cards}")
    # Also delete by phone in details as telefone
    result2 = sb.table("kanban_cards").delete().eq("details->>telefone", phone).execute()
    deleted_cards += len(result2.data or [])
    if result2.data:
        cleaned.append(f"Cards por telefone: {len(result2.data)}")

    # 2. Limpar Redis
    try:
        r = redis.from_url(settings.REDIS_URL)
        keys_deleted = 0
        for key in r.scan_iter(f"*{phone}*"):
            r.delete(key)
            keys_deleted += 1
        # Also delete by teka_dm pattern
        for key in r.scan_iter(f"*teka_dm*{phone}*"):
            r.delete(key)
            keys_deleted += 1
        # Flush conv_history for this phone
        r.delete(f"conv_history:wa_teka_dm_{phone}")
        keys_deleted += 1
        cleaned.append(f"Redis: {keys_deleted} keys")
    except Exception as e:
        cleaned.append(f"Redis error: {str(e)}")

    # 3. Limpar debounce buffers no Redis (compartilhado entre workers)
    try:
        rr = _teka_redis()
        for k in (
            _TEKA_BUF_KEY.format(phone=phone),
            _TEKA_META_KEY.format(phone=phone),
            _TEKA_TS_KEY.format(phone=phone),
            _TEKA_LOCK_KEY.format(phone=phone),
        ):
            rr.delete(k)
        cleaned.append("Debounce buffer limpo")
    except Exception as e:
        cleaned.append(f"Debounce clean error: {str(e)}")

    # 4. Invalida cache do agente
    from app.core.agno_engine import agent_squad
    agent_squad.invalidate_cache(f"teka_dm_{phone}")
    cleaned.append("Agent cache invalidado")

    return {"ok": True, "phone": phone, "cleaned": cleaned, "cards_deleted": deleted_cards}


def extract_message_data(payload: dict) -> dict | None:
    """
    Extract relevant message data from Evolution API webhook payload.
    Returns None if the message should be ignored.
    """
    event = payload.get("event", "")

    if event.upper().replace(".", "_") != "MESSAGES_UPSERT":
        return None

    data = payload.get("data", {})

    # Evolution API v2 with webhookBase64=true encodes data as base64 string
    if isinstance(data, str):
        import base64, json as _json
        try:
            data = _json.loads(base64.b64decode(data))
        except Exception:
            return None

    # Mensagens enviadas por nós (vendedor humano ou bot)
    key = data.get("key", {})
    is_from_me = bool(key.get("fromMe"))

    remote_jid = key.get("remoteJid", "")
    is_group = remote_jid.endswith("@g.us")
    is_dm = remote_jid.endswith("@s.whatsapp.net")

    # fromMe em grupo é sempre eco do bot — descarta
    # fromMe em DM pode ser vendedor humano enviando pro cliente — propagamos
    # como evento "_outbound" pra pausar a Teka naquela conversa.
    if is_from_me and not is_dm:
        return None

    # Skip if not a group or DM
    if not is_group and not is_dm:
        return None

    # Extract message content
    message_obj = data.get("message", {})

    # Tipos de mídia suportados
    MEDIA_TYPES = [
        "audioMessage", "imageMessage", "documentMessage",
        "videoMessage", "stickerMessage", "locationMessage", "contactMessage",
    ]
    has_media = any(k in message_obj for k in MEDIA_TYPES)

    # Texto puro (sem mídia)
    text_content = (
        message_obj.get("conversation")
        or message_obj.get("extendedTextMessage", {}).get("text")
        or ""
    )

    # Outbound DM sem texto e sem mídia (ex: ack, reaction) — não interessa
    if is_from_me and is_dm and not text_content.strip() and not has_media:
        return None

    # Inbound: ignora só se não tem texto nem mídia reconhecida
    if not is_from_me and not text_content.strip() and not has_media:
        return None

    push_name = data.get("pushName", "Usuário")
    participant = key.get("participant", "")
    sender_phone = participant.replace("@s.whatsapp.net", "").replace("@c.us", "").replace("@lid", "")
    message_id = key.get("id", "")

    # Extract mentions from message
    mentioned_jids = []
    ext_text = message_obj.get("extendedTextMessage", {})
    if ext_text:
        ctx = ext_text.get("contextInfo", {})
        mentioned_jids = ctx.get("mentionedJid", []) or []

    # Click-to-WhatsApp (CTWA): quando a DM veio de um anúncio Meta, a mensagem
    # inicial carrega `contextInfo.externalAdReply` com o clid + metadata do
    # anúncio. Extraímos aqui pra gravar no card (attribution) e mandar como
    # `fbc` no CAPI (fb.1.{ts}.{ctwa_clid} é aceito pelo Meta).
    ad_referral = None
    try:
        ctx_full = (ext_text.get("contextInfo") if ext_text else None) or {}
        ext_ad = ctx_full.get("externalAdReply") or {}
        ctwa_clid = ext_ad.get("ctwaClid") or ctx_full.get("ctwaClid")
        if ext_ad or ctwa_clid:
            ad_referral = {
                "ctwa_clid": ctwa_clid,
                "source_id": ext_ad.get("sourceId"),
                "source_url": ext_ad.get("sourceUrl"),
                "source_type": ext_ad.get("sourceType"),
                "title": ext_ad.get("title"),
                "body": ext_ad.get("body"),
                "media_type": ext_ad.get("mediaType"),
                "thumbnail_url": ext_ad.get("thumbnailUrl"),
            }
    except Exception:
        ad_referral = None

    return {
        "group_id": remote_jid,
        "text": text_content.strip(),
        "message_obj": message_obj,
        "message_data": data,
        "has_media": has_media,
        "sender_name": push_name,
        "sender_phone": sender_phone if is_group else remote_jid.replace("@s.whatsapp.net", ""),
        "message_id": message_id,
        "is_dm": is_dm,
        "mentioned_jids": mentioned_jids,
        "_outbound": is_from_me,
        "ad_referral": ad_referral,
    }



async def extract_and_save_task(db, group_id: str, response: str) -> str:
    """
    Detects [AGENDAR:{...}] in the agent response, creates the task in DB,
    and removes the block from the text sent to WhatsApp.
    """
    pattern = r'\[AGENDAR:(\{.*?\})\]'
    match = re.search(pattern, response, re.DOTALL)
    if not match:
        return response

    try:
        raw = match.group(1)
        data = _json.loads(raw)

        # Parse date — AI outputs São Paulo local time (as instructed in prompt).
        # We store it as-is (naive São Paulo time); the scheduler also compares
        # against São Paulo "now" so everything stays consistent and readable.
        import pytz
        from datetime import timedelta
        tz_br = pytz.timezone("America/Sao_Paulo")
        due_at = datetime.strptime(data["data"], "%Y-%m-%d %H:%M")

        # Sanity check against São Paulo now (not UTC)
        now_br = datetime.now(tz_br).replace(tzinfo=None)
        if due_at < now_br - timedelta(minutes=5) or due_at > now_br + timedelta(days=365 * 5):
            logger.warning("task_date_invalid_using_fallback",
                           original=str(due_at), now_br=str(now_br))
            # Try to extract relative time from title/description to recalculate
            titulo = data.get("titulo", "") + " " + data.get("descricao", "")
            import re as _re
            m_min = _re.search(r'(\d+)\s*(?:min|minuto)', titulo, _re.IGNORECASE)
            m_hora = _re.search(r'(\d+)\s*(?:hora|h\b)', titulo, _re.IGNORECASE)
            m_dia = _re.search(r'(\d+)\s*dia', titulo, _re.IGNORECASE)
            if m_min:
                due_at = now_br + timedelta(minutes=int(m_min.group(1)))
            elif m_hora:
                due_at = now_br + timedelta(hours=int(m_hora.group(1)))
            elif m_dia:
                due_at = now_br + timedelta(days=int(m_dia.group(1)))
            else:
                due_at = now_br + timedelta(minutes=10)  # generic fallback

        # Find agent for this group
        from app.models.agent import Agent
        from sqlalchemy import select
        agent_result = await db.execute(
            select(Agent).where(Agent.group_id == group_id).where(Agent.is_active == True)
        )
        agent = agent_result.scalar_one_or_none()
        if not agent:
            return response.replace(match.group(0), "").strip()

        action_type = data.get("tipo", "reminder")
        action_config = {}
        if action_type == "webhook":
            action_config = {
                "url": data.get("webhook_url", ""),
                "method": data.get("webhook_metodo", "POST"),
                "body": data.get("webhook_corpo", "{}"),
            }

        from app.models.task import ScheduledTask
        task = ScheduledTask(
            agent_id=agent.id,
            group_id=group_id,
            title=data.get("titulo", "Tarefa agendada"),
            description=data.get("descricao", ""),
            due_at=due_at,
            action_type="reminder" if action_type == "lembrete" else action_type,
            action_config=action_config,
            recurrence=data.get("recorrencia", "none"),
        )
        db.add(task)
        await db.commit()
        logger.info("task_created_from_agent", title=task.title, due_at=str(due_at))

    except Exception as e:
        logger.warning("task_extraction_failed", error=str(e))

    # Remove the [AGENDAR:...] block from the response text
    return response.replace(match.group(0), "").strip()


async def extract_and_run_claude_code(response: str, sender_phone: str) -> str:
    """
    Detects [CLAUDE_CODE:{...}] in the agent response, validates the sender's
    phone against the TI_OWNER_PHONES whitelist, and delegates execution to
    the Claude Code Runner (host-side HTTP service at 172.18.0.1:9191).
    The runner executes `claude -p "..."` on the host and returns the output.
    """
    import re as _re, asyncio as _asyncio
    from app.config import settings

    pattern = r'\[CLAUDE_CODE:(\{.*?\})\]'
    match = _re.search(pattern, response, _re.DOTALL)
    if not match:
        return response

    # Remove the [CLAUDE_CODE:...] block from the visible response
    clean_response = response.replace(match.group(0), "").strip()

    # Validate sender is an authorised TI owner
    owner_phones = [p.strip() for p in settings.TI_OWNER_PHONES.split(",") if p.strip()]
    if owner_phones and sender_phone not in owner_phones:
        logger.warning("ti_claude_code_blocked_unauthorized", sender_phone=sender_phone)
        return clean_response + "\n\n⛔ Execução bloqueada: você não está na lista de operadores TI."

    try:
        data = _json.loads(match.group(1))
        prompt = data.get("prompt", "").strip()
        cwd = data.get("cwd", "/root")
        timeout = min(int(data.get("timeout", 120)), 600)  # max 10 min

        if not prompt:
            return clean_response

        logger.info("ti_claude_code_executing", prompt_preview=prompt[:120], cwd=cwd, sender=sender_phone)

        # Call the host-side Claude Code Runner via HTTP
        # Runner is a Python HTTP service on the host at 172.18.0.1:9191
        import aiohttp as _aiohttp
        runner_url = settings.CLAUDE_RUNNER_URL
        runner_secret = settings.CLAUDE_RUNNER_SECRET

        async with _aiohttp.ClientSession() as session:
            try:
                async with session.post(
                    f"{runner_url}/run",
                    json={"prompt": prompt, "cwd": cwd, "timeout": timeout},
                    headers={"Authorization": f"Bearer {runner_secret}"},
                    timeout=_aiohttp.ClientTimeout(total=timeout + 10),
                ) as resp:
                    result = await resp.json()
                    output = result.get("output", "").strip()
                    exit_code = result.get("exit_code", -1)
            except _aiohttp.ClientConnectorError as e:
                logger.error("ti_claude_runner_unreachable", error=str(e))
                return clean_response + f"\n\n❌ Claude Code Runner não acessível ({runner_url}). Verifique se o serviço está rodando no host."

        # Truncate very long outputs to fit WhatsApp limits
        if len(output) > 3500:
            output = output[-3500:]
            output = "[... saída truncada ...]\n" + output

        status_icon = "✅" if exit_code == 0 else "❌"
        result_block = (
            f"\n\n{status_icon} Claude Code executou (exit {exit_code}):\n"
            f"─────────────────\n"
            f"{output if output else '(sem saída)'}"
        )
        logger.info("ti_claude_code_done", exit_code=exit_code, output_len=len(output))
        return clean_response + result_block

    except Exception as e:
        logger.error("ti_claude_code_error", error=str(e), exc_info=True)
        return clean_response + f"\n\n❌ Erro ao chamar Claude Code: {e}"


# UX group ID — mensagens aqui vão direto pro runner sem depender do LLM gerar [CLAUDE_CODE]
UX_GROUP_ID = "120363426906654777@g.us"
UX_PROJECT_CWD = "/root/parket-lp"
UX_PROJECT_URL = "https://lp.parket.works"

# Injex IA Dev Squad — grupo dedicado a edições no app Injexia
INJEXIA_GROUP_ID = "120363423419485190@g.us"
INJEXIA_PROJECT_CWD = "/root/injex-ia"
INJEXIA_PROJECT_URL = "https://injexia.parket.works"

# Parket WoodPlanner Squad — grupo dedicado a edições no WoodPlanner Pro
# (módulo /marcenaria do parket-draw). O agente só toca arquivos dentro
# de /root/parket-draw e só pode rebuildar/redeployar parket-draw_*.
WOODPLANNER_GROUP_ID = "120363406875159606@g.us"
WOODPLANNER_PROJECT_CWD = "/root/parket-draw"
WOODPLANNER_PROJECT_URL = "https://draw.parket.works/marcenaria"


async def run_ux_command(user_message: str, sender_name: str) -> str:
    """
    Para o grupo UX: executa o pedido diretamente via Claude Code Runner,
    sem depender do LLM principal gerar blocos [CLAUDE_CODE].
    Claude Code recebe contexto completo e faz tudo: ler arquivos, editar, buildar, deployar.
    """
    import aiohttp as _aiohttp
    from app.config import settings

    prompt = (
        f"Você é um especialista em UX/frontend trabalhando no site da Parket em /root/parket-lp.\n"
        f"O site usa Vite + React + Tailwind e está em produção em {UX_PROJECT_URL}.\n\n"
        f"Pedido de '{sender_name}': {user_message}\n\n"
        f"Execute TUDO em sequência:\n"
        f"1. Leia o CHANGELOG.md em /root/parket-lp para pegar o número da próxima versão (v1 se não existir)\n"
        f"2. Encontre os arquivos relevantes em /root/parket-lp/src/ usando Glob e Read\n"
        f"3. Faça as alterações solicitadas usando Edit ou Write\n"
        f"4. Atualize o CHANGELOG.md adicionando no TOPO: número da versão, data/hora atual, descrição da mudança, arquivos editados\n"
        f"5. Execute o build e deploy:\n"
        f"   docker build -t parket-lp:latest /root/parket-lp && docker service update --force --image parket-lp:latest parket-lp_lp\n"
        f"6. Após o deploy concluir, atualize o CHANGELOG.md marcando a versão como DEPLOYED com timestamp\n"
        f"7. Retorne um resumo claro: qual versão foi salva, quais arquivos foram editados, o que mudou visivelmente no site"
    )

    runner_url = settings.CLAUDE_RUNNER_URL
    runner_secret = settings.CLAUDE_RUNNER_SECRET

    logger.info("ux_runner_executing", sender=sender_name, request_preview=user_message[:100])

    async with _aiohttp.ClientSession() as session:
        try:
            async with session.post(
                f"{runner_url}/run",
                json={"prompt": prompt, "cwd": UX_PROJECT_CWD, "timeout": 480},
                headers={"Authorization": f"Bearer {runner_secret}"},
                timeout=_aiohttp.ClientTimeout(total=500),
            ) as resp:
                result = await resp.json()
                output = result.get("output", "").strip()
                exit_code = result.get("exit_code", -1)
        except _aiohttp.ClientConnectorError as e:
            logger.error("ux_runner_unreachable", error=str(e))
            return f"❌ Não consegui conectar ao servidor para executar a alteração. Tente novamente em instantes."

    logger.info("ux_runner_done", exit_code=exit_code, output_len=len(output))

    if exit_code != 0:
        summary = output[-2000:] if len(output) > 2000 else output
        return f"❌ Ocorreu um erro ao aplicar a alteração:\n\n{summary}"

    # Extrai o resumo do output (últimas linhas mais relevantes)
    if len(output) > 1500:
        output = output[-1500:]

    return (
        f"✅ Alteração aplicada!\n\n"
        f"{output}\n\n"
        f"🌐 Confere no site: {UX_PROJECT_URL}"
    )


# Memória multi-turn do grupo Injex IA — guarda últimas N trocas em Redis,
# compartilhada entre workers/réplicas. TTL de 24h por turno.
INJEXIA_MEMORY_KEY = "injexia:group:history"
INJEXIA_MEMORY_MAX_TURNS = 8
INJEXIA_MEMORY_TTL = 24 * 60 * 60


def _injexia_history_load() -> list[dict]:
    import redis as _redis
    import json as _json
    try:
        r = _redis.from_url(settings.REDIS_URL)
        items = r.lrange(INJEXIA_MEMORY_KEY, 0, INJEXIA_MEMORY_MAX_TURNS - 1) or []
        return [_json.loads(it) for it in items][::-1]  # ordem cronológica
    except Exception as e:
        logger.warning("injexia_memory_load_failed", error=str(e))
        return []


def _injexia_history_append(turn: dict) -> None:
    import redis as _redis
    import json as _json
    try:
        r = _redis.from_url(settings.REDIS_URL)
        r.lpush(INJEXIA_MEMORY_KEY, _json.dumps(turn))
        r.ltrim(INJEXIA_MEMORY_KEY, 0, INJEXIA_MEMORY_MAX_TURNS - 1)
        r.expire(INJEXIA_MEMORY_KEY, INJEXIA_MEMORY_TTL)
    except Exception as e:
        logger.warning("injexia_memory_append_failed", error=str(e))


def _injexia_history_clear() -> None:
    import redis as _redis
    try:
        _redis.from_url(settings.REDIS_URL).delete(INJEXIA_MEMORY_KEY)
    except Exception:
        pass


async def run_injexia_command(user_message: str, sender_name: str) -> str:
    """
    Para o grupo Injex IA Dev Squad: executa o pedido diretamente no app
    Injexia (React/Vite + Supabase + Gemini) via Claude Code Runner.
    Mantém memória multi-turn em Redis: as últimas trocas do grupo são
    injetadas no prompt para manter contexto entre pedidos encadeados.
    Comando especial: "/reset" limpa o histórico do grupo.
    """
    import aiohttp as _aiohttp
    from app.config import settings
    from datetime import datetime as _dt

    # Comando administrativo: zerar memória
    if user_message.strip().lower() in ("/reset", "/limpar", "/clear"):
        _injexia_history_clear()
        return "🧹 Memória do grupo limpa. Próximo pedido começa do zero."

    history = _injexia_history_load()
    history_block = ""
    if history:
        lines = []
        for t in history:
            who = t.get("sender", "?")
            msg = t.get("message", "")
            ans = (t.get("answer", "") or "").strip()
            lines.append(f"[{who}] {msg}")
            if ans:
                lines.append(f"[engenheiro] {ans[:400]}")
        history_block = (
            "\n\nHISTÓRICO RECENTE DO GRUPO (use como contexto, NÃO repita ações já feitas):\n"
            + "\n".join(lines)
            + "\n"
        )

    prompt = (
        f"Você é o engenheiro responsável pelo app Injexia em /root/injex-ia.\n"
        f"O app é um Vite + React + TypeScript + Tailwind, em produção em {INJEXIA_PROJECT_URL}.\n"
        f"Backend: Supabase project hbxpilrxmitvzebluoom (tabelas prefixadas injexia_*).\n"
        f"Auth real via Supabase Auth (mailer_autoconfirm habilitado).\n"
        f"IA: Gemini 2.5 Flash (chave em VITE_GEMINI_API_KEY).\n"
        f"Audit log na tabela injexia_events visível em /observador.\n\n"
        f"O app é focado em emagrecimento via análogos GLP-1 (Semaglutida, Tirzepatida, Retatrutida).\n"
        f"Telas principais: Onboarding multi-step, Protocolo (home — engloba Full), Movimento, Progresso, Nova Refeição (alimentação).\n"
        f"Bottom nav: Protocolo · Movimento · FAB(+) · Progresso. O FAB abre um sheet com Registrar Aplicação, Iniciar Sessão, Nova Medição, Registrar Refeição.\n"
        f"{history_block}\n"
        f"Pedido atual de '{sender_name}': {user_message}\n\n"
        f"Execute TUDO em sequência:\n"
        f"1. Use Glob/Read para encontrar os arquivos relevantes em /root/injex-ia/src/\n"
        f"2. Faça as alterações solicitadas usando Edit ou Write\n"
        f"3. Se precisar de mudança de schema Supabase, crie migration em supabase/migrations/NNN_xxx.sql e aplique via:\n"
        f"   curl -s -X POST 'https://api.supabase.com/v1/projects/hbxpilrxmitvzebluoom/database/query' \\\n"
        f"     -H 'Authorization: Bearer sbp_01ac2cd076c0a0f6f21eaa4404bc0af1c2ddbe63' \\\n"
        f"     -H 'Content-Type: application/json' \\\n"
        f"     -d \"$(jq -Rsn --arg q \"$SQL\" '{{query:$q}}')\"\n"
        f"4. Build do frontend: cd /root/injex-ia && npm run build\n"
        f"5. Build da imagem Docker e redeploy:\n"
        f"   docker build \\\n"
        f"     --build-arg VITE_SUPABASE_URL=https://hbxpilrxmitvzebluoom.supabase.co \\\n"
        f"     --build-arg VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhieHBpbHJ4bWl0dnplYmx1b29tIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI5NDI1MjcsImV4cCI6MjA4ODUxODUyN30.ciZA1H-UvlYG2OPWqrFChj-_ttiFD5W5BmrST-gUJ-0 \\\n"
        f"     --build-arg VITE_GEMINI_API_KEY=AIzaSyDRPfNlSRP2K18aQsTLm1lqjCKHB45SniI \\\n"
        f"     -t injex-ia:latest /root/injex-ia\n"
        f"   docker service update --force --image injex-ia:latest injex-ia_app\n"
        f"6. Retorne um resumo claro: o que foi alterado, quais arquivos, qual rota afetada"
    )

    runner_url = settings.CLAUDE_RUNNER_URL
    runner_secret = settings.CLAUDE_RUNNER_SECRET

    logger.info("injexia_runner_executing", sender=sender_name, history_turns=len(history), request_preview=user_message[:100])

    async with _aiohttp.ClientSession() as session:
        try:
            async with session.post(
                f"{runner_url}/run",
                json={"prompt": prompt, "cwd": INJEXIA_PROJECT_CWD, "timeout": 600},
                headers={"Authorization": f"Bearer {runner_secret}"},
                timeout=_aiohttp.ClientTimeout(total=620),
            ) as resp:
                result = await resp.json()
                output = result.get("output", "").strip()
                exit_code = result.get("exit_code", -1)
        except _aiohttp.ClientConnectorError as e:
            logger.error("injexia_runner_unreachable", error=str(e))
            return "❌ Não consegui conectar ao runner do Claude Code. Tente novamente."

    logger.info("injexia_runner_done", exit_code=exit_code, output_len=len(output))

    if exit_code != 0:
        summary = output[-2000:] if len(output) > 2000 else output
        # Salva também as falhas pra evitar repetir o mesmo erro nas próximas tentativas
        _injexia_history_append({
            "ts": _dt.now().isoformat(),
            "sender": sender_name,
            "message": user_message,
            "answer": f"FALHOU: {summary[:300]}",
            "ok": False,
        })
        return f"❌ Erro ao aplicar a alteração:\n\n{summary}"

    if len(output) > 1500:
        output = output[-1500:]

    _injexia_history_append({
        "ts": _dt.now().isoformat(),
        "sender": sender_name,
        "message": user_message,
        "answer": output,
        "ok": True,
    })

    return (
        f"✅ Alteração aplicada no Injexia!\n\n"
        f"{output}\n\n"
        f"🌐 Confere em: {INJEXIA_PROJECT_URL}"
    )


# ─── Memória multi-turn do grupo Parket WoodPlanner ──────────────────
# Mesma estratégia do Injex Dev Squad: últimas 8 trocas em Redis (24h TTL).
WOODPLANNER_MEMORY_KEY = "woodplanner:group:history"
WOODPLANNER_MEMORY_MAX_TURNS = 8
WOODPLANNER_MEMORY_TTL = 24 * 60 * 60

# Plano pendente aguardando aprovação. Cada grupo só tem um por vez.
WOODPLANNER_PENDING_KEY = "woodplanner:pending:plan"
WOODPLANNER_PENDING_TTL = 60 * 60  # 1h pra aprovar

# Palavras-chave de aprovação/rejeição (lower-case, comparação exata)
## Palavras curtas/expressões de aprovação. Evite palavras polissêmicas
## sozinhas (ex: "isso") — só formas multi-palavra como "isso mesmo".
WOODPLANNER_APPROVE_WORDS = {
    "ok", "okay", "k", "sim", "s", "manda", "manda ver", "manda bala",
    "pode", "pode mandar", "pode ir", "pode executar", "pode rodar",
    "vai", "vai la", "vai lá", "executa", "executar", "executar agora",
    "aprovado", "aprovar", "aprovo", "go", "yes", "y", "confirmado",
    "confirmar", "confirma", "confirmo", "fechado", "beleza",
    "blz", "isso mesmo", "perfeito", "fechou",
}
WOODPLANNER_REJECT_WORDS = {
    "cancela", "cancelar", "cancelado", "nao", "não", "no", "n",
    "para", "pare", "parar", "abortar", "aborta", "abortado",
    "esquece", "esquecer", "deixa", "deixa pra la", "deixa pra lá",
}


def _woodplanner_pending_set(data: dict) -> None:
    import redis as _redis
    import json as _json
    from app.config import settings as _s
    try:
        r = _redis.from_url(_s.REDIS_URL)
        r.set(WOODPLANNER_PENDING_KEY, _json.dumps(data), ex=WOODPLANNER_PENDING_TTL)
    except Exception as e:
        logger.warning("woodplanner_pending_set_failed", error=str(e))


def _woodplanner_pending_get() -> dict | None:
    import redis as _redis
    import json as _json
    from app.config import settings as _s
    try:
        r = _redis.from_url(_s.REDIS_URL)
        raw = r.get(WOODPLANNER_PENDING_KEY)
        return _json.loads(raw) if raw else None
    except Exception as e:
        logger.warning("woodplanner_pending_get_failed", error=str(e))
        return None


def _woodplanner_pending_clear() -> None:
    import redis as _redis
    from app.config import settings as _s
    try:
        _redis.from_url(_s.REDIS_URL).delete(WOODPLANNER_PENDING_KEY)
    except Exception:
        pass


def _woodplanner_history_load() -> list[dict]:
    import redis as _redis
    import json as _json
    from app.config import settings as _s
    try:
        r = _redis.from_url(_s.REDIS_URL)
        items = r.lrange(WOODPLANNER_MEMORY_KEY, 0, WOODPLANNER_MEMORY_MAX_TURNS - 1) or []
        return [_json.loads(it) for it in items][::-1]
    except Exception as e:
        logger.warning("woodplanner_memory_load_failed", error=str(e))
        return []


def _woodplanner_history_append(turn: dict) -> None:
    import redis as _redis
    import json as _json
    from app.config import settings as _s
    try:
        r = _redis.from_url(_s.REDIS_URL)
        r.lpush(WOODPLANNER_MEMORY_KEY, _json.dumps(turn))
        r.ltrim(WOODPLANNER_MEMORY_KEY, 0, WOODPLANNER_MEMORY_MAX_TURNS - 1)
        r.expire(WOODPLANNER_MEMORY_KEY, WOODPLANNER_MEMORY_TTL)
    except Exception as e:
        logger.warning("woodplanner_memory_append_failed", error=str(e))


def _woodplanner_history_clear() -> None:
    import redis as _redis
    from app.config import settings as _s
    try:
        _redis.from_url(_s.REDIS_URL).delete(WOODPLANNER_MEMORY_KEY)
    except Exception:
        pass


def _woodplanner_arch_block() -> str:
    """Bloco de arquitetura compartilhado entre prompts de plano e execução."""
    return (
        "ARQUITETURA (fixa, NÃO discuta — apenas siga):\n"
        "  • Frontend: Vite + React 19 + TS + Fabric.js + react-router 7\n"
        "    Arquivos do módulo: /root/parket-draw/frontend/src/wood/\n"
        "      - WoodApp.tsx (shell com sidebar)\n"
        "      - api.ts (cliente fetch tipado pra /api/wood/*)\n"
        "      - theme.ts (paleta — ACCENT #B8AA9A, BG #0A0A0A)\n"
        "      - pages/ (Dashboard, Clients, Catalog, Settings, Editor, Executive)\n"
        "    Roteamento em /root/parket-draw/frontend/src/main.tsx\n"
        "  • Backend: FastAPI Python\n"
        "    Routers em /root/parket-draw/backend/app/api/wood_*.py\n"
        "      - wood_clients, wood_projects, wood_parts, wood_settings, wood_executive\n"
        "    Core em /root/parket-draw/backend/app/core/wood_*.py\n"
        "      - wood_supabase, wood_engine, wood_nesting, wood_pdf\n"
        "    Registrado em /root/parket-draw/backend/app/main.py\n"
        "  • Banco: Supabase Draw kstldkfhoiqepmuqmcmq, tabelas wood_*\n"
        "    Bucket de storage: wood-files\n"
        "    Service key já está injetada como DRAW_SUPABASE_SERVICE_KEY no backend\n"
        "  • Stack: docker swarm parket-draw (services: parket-draw_frontend, parket-draw_backend)\n"
        "  • Domínio: draw.parket.works (Traefik), módulo wood em /marcenaria\n\n"
        "REGRAS RÍGIDAS:\n"
        "  1. Você só pode mexer em /root/parket-draw. NUNCA em /root/Dashboardparketapp,\n"
        "     /root/parket-ai-squad, /root/parket-lp, /root/injex-ia, ou outros projetos.\n"
        "  2. Você só pode rebuildar/redeployar parket-draw_frontend e parket-draw_backend.\n"
        "  3. Migrations do Supabase do Draw vão via Management API:\n"
        "       curl -s -X POST 'https://api.supabase.com/v1/projects/kstldkfhoiqepmuqmcmq/database/query' \\\n"
        "         -H 'Authorization: Bearer sbp_01ac2cd076c0a0f6f21eaa4404bc0af1c2ddbe63' \\\n"
        "         -H 'Content-Type: application/json' \\\n"
        "         -d \"$(jq -Rsn --arg q \"$SQL\" '{query:$q}')\"\n"
        "     Sempre prefixe novas tabelas com wood_.\n"
        "  4. Mexer em código do mlightcad/CAD (App.tsx fora de /wood/) só se o pedido\n"
        "     for explicitamente sobre o editor CAD principal.\n"
        "  5. Pedidos fora do escopo de marcenaria devem ser RECUSADOS.\n"
    )


async def _woodplanner_call_runner(prompt: str, timeout: int = 1500) -> tuple[int, str]:
    """Helper que dispara o Claude Code Runner e devolve (exit_code, output)."""
    import aiohttp as _aiohttp
    from app.config import settings as _s

    runner_url = _s.CLAUDE_RUNNER_URL
    runner_secret = _s.CLAUDE_RUNNER_SECRET

    async with _aiohttp.ClientSession() as session:
        try:
            async with session.post(
                f"{runner_url}/run",
                json={"prompt": prompt, "cwd": WOODPLANNER_PROJECT_CWD, "timeout": timeout},
                headers={"Authorization": f"Bearer {runner_secret}"},
                timeout=_aiohttp.ClientTimeout(total=timeout + 60),
            ) as resp:
                result = await resp.json()
                return result.get("exit_code", -1), (result.get("output", "") or "").strip()
        except _aiohttp.ClientConnectorError as e:
            logger.error("woodplanner_runner_unreachable", error=str(e))
            return -1, f"runner inacessível: {e}"
        except _aiohttp.ServerTimeoutError as e:
            logger.error("woodplanner_runner_timeout", error=str(e))
            return -1, f"runner timeout: {e}"


async def run_woodplanner_command(user_message: str, sender_name: str) -> str:
    """
    Para o grupo Parket WoodPlanner: fluxo plan → aprovação → execução.

      1. Mensagem normal → roda Claude em modo PLANO (só Glob/Read, sem Edit/Write/Bash
         pra build), salva o plano em Redis e devolve pedindo aprovação.
      2. "ok"/"manda"/etc → carrega o plano salvo e roda em modo EXECUÇÃO.
      3. "cancela"/"não" → descarta o plano pendente.

    Comandos especiais:
      /reset  → limpa histórico + plano pendente
      /status → mostra plano pendente atual (se houver)
    """
    from datetime import datetime as _dt

    text = user_message.strip()
    lower = text.lower()
    # Normaliza pra match de aprovação/rejeição: tira pontuação do início/fim e
    # colapsa whitespace. "Ok.", " ok! ", "Ok 👍" → "ok"
    import re as _re_loc
    lower_norm = _re_loc.sub(r"^[\W_]+|[\W_]+$", "", lower).strip()
    # Para `lower_first` só consideramos frases CURTAS (até 2 palavras) — assim
    # "ok manda" continua sendo aprovação mas "isso não está funcionando" não é.
    _lower_words = lower_norm.split()
    lower_first = _lower_words[0] if _lower_words and len(_lower_words) <= 2 else ""

    # ── comandos administrativos ─────────────────────────────────
    if lower in ("/reset", "/limpar", "/clear"):
        _woodplanner_history_clear()
        _woodplanner_pending_clear()
        return "🧹 Memória e plano pendente limpos. Próximo pedido começa do zero."

    if lower in ("/status", "/pendente", "/plano"):
        pending = _woodplanner_pending_get()
        if not pending:
            return "📭 Nenhum plano aguardando aprovação."
        return (
            f"📋 Plano pendente (de {pending.get('sender')}):\n\n"
            f"📥 Pedido: {pending.get('request')}\n\n"
            f"{pending.get('plan')}\n\n"
            f"Responda *ok* pra executar ou *cancela* pra descartar."
        )

    # ── aprovação de plano pendente ──────────────────────────────
    if lower in WOODPLANNER_APPROVE_WORDS or lower_norm in WOODPLANNER_APPROVE_WORDS or lower_first in WOODPLANNER_APPROVE_WORDS:
        pending = _woodplanner_pending_get()
        if not pending:
            return "📭 Nenhum plano pendente pra aprovar. Mande primeiro o que você quer alterar."

        plan_text = pending.get("plan", "")
        original_request = pending.get("request", "")
        original_sender = pending.get("sender", sender_name)

        logger.info("woodplanner_executing_approved_plan", sender=sender_name, original_sender=original_sender, request_preview=original_request[:100])

        exec_prompt = (
            f"Você é o engenheiro do Parket WoodPlanner Pro. Em produção em {WOODPLANNER_PROJECT_URL}.\n\n"
            f"{_woodplanner_arch_block()}\n"
            f"Pedido original de '{original_sender}':\n{original_request}\n\n"
            f"PLANO JÁ APROVADO (siga este plano à risca, ele foi validado pelo operador):\n"
            f"{plan_text}\n\n"
            f"Agora EXECUTE o plano completo:\n"
            f"  1. Faça as edições com Edit/Write\n"
            f"  2. Se houver migration de schema, aplique via Management API (curl no bloco acima)\n"
            f"  3. Se mexeu no backend Python:\n"
            f"       cd /root/parket-draw && docker build -t parket-draw-backend:latest backend/ \\\n"
            f"         && docker service update --image parket-draw-backend:latest --force parket-draw_backend\n"
            f"  4. Se mexeu no frontend:\n"
            f"       cd /root/parket-draw && docker build -t parket-draw-frontend:latest frontend/ \\\n"
            f"         && docker service update --image parket-draw-frontend:latest --force parket-draw_frontend\n"
            f"  5. Faça smoke test rápido nos endpoints/rotas afetados\n"
            f"  6. Retorne um resumo breve: o que foi alterado, quais arquivos, o que muda em /marcenaria"
        )

        exit_code, output = await _woodplanner_call_runner(exec_prompt, timeout=1500)
        logger.info("woodplanner_runner_done", phase="execute", exit_code=exit_code, output_len=len(output))

        if exit_code != 0:
            summary = output[-2000:] if len(output) > 2000 else output
            _woodplanner_history_append({
                "ts": _dt.now().isoformat(),
                "sender": original_sender,
                "message": original_request,
                "answer": f"FALHOU: {summary[:300]}",
                "ok": False,
            })
            _woodplanner_pending_clear()
            return f"❌ Erro ao executar o plano:\n\n{summary}"

        if len(output) > 1500:
            output = output[-1500:]

        _woodplanner_history_append({
            "ts": _dt.now().isoformat(),
            "sender": original_sender,
            "message": original_request,
            "answer": output,
            "ok": True,
        })
        _woodplanner_pending_clear()

        return (
            f"✅ Executado com sucesso!\n\n"
            f"{output}\n\n"
            f"🌐 Confere em: {WOODPLANNER_PROJECT_URL}"
        )

    # ── rejeição de plano pendente ───────────────────────────────
    if lower in WOODPLANNER_REJECT_WORDS or lower_norm in WOODPLANNER_REJECT_WORDS or lower_first in WOODPLANNER_REJECT_WORDS:
        pending = _woodplanner_pending_get()
        if not pending:
            return "📭 Não havia nada pendente."
        _woodplanner_pending_clear()
        return f"🚫 Plano descartado. O pedido era: {pending.get('request', '')[:200]}"

    # ── novo pedido → modo PLANO ─────────────────────────────────
    history = _woodplanner_history_load()
    history_block = ""
    if history:
        lines = []
        for t in history:
            who = t.get("sender", "?")
            msg = t.get("message", "")
            ans = (t.get("answer", "") or "").strip()
            lines.append(f"[{who}] {msg}")
            if ans:
                lines.append(f"[engenheiro] {ans[:300]}")
        history_block = (
            "\n\nHISTÓRICO RECENTE DO GRUPO (contexto, NÃO repita ações já concluídas):\n"
            + "\n".join(lines)
            + "\n"
        )

    plan_prompt = (
        f"Você é o engenheiro do Parket WoodPlanner Pro. Em produção em {WOODPLANNER_PROJECT_URL}.\n\n"
        f"{_woodplanner_arch_block()}\n"
        f"{history_block}\n"
        f"Pedido atual de '{sender_name}': {text}\n\n"
        f"⚠️ MODO PLANO — VOCÊ NÃO VAI EXECUTAR NADA AGORA.\n\n"
        f"Sua tarefa é APENAS produzir um plano detalhado pra ser validado pelo operador.\n"
        f"  • PODE: Glob, Read e Grep pra entender o código antes de propor mudanças\n"
        f"  • NÃO PODE: Edit, Write, Bash de build/deploy, curl de mutação no Supabase, ou qualquer\n"
        f"    ação que altere arquivos/imagens/banco. Apenas leitura e análise.\n\n"
        f"Responda em português, formato curto e numerado:\n\n"
        f"📋 PLANO\n\n"
        f"1. <ação concreta — ex: editar src/wood/pages/Dashboard.tsx pra adicionar X>\n"
        f"2. <próxima ação>\n"
        f"3. ...\n\n"
        f"📦 Arquivos afetados:\n"
        f"  - /root/parket-draw/...\n"
        f"  - /root/parket-draw/...\n\n"
        f"🗄️ Schema/banco: <sim/não — se sim, descreva a migration>\n\n"
        f"🚀 Build/deploy: <frontend/backend/ambos>\n\n"
        f"⚠️ Riscos ou pontos de atenção: <ou \"nenhum\">\n\n"
        f"⏱️ Estimativa: <baixa/média/alta complexidade>\n\n"
        f"Termine OBRIGATORIAMENTE com a linha exata:\n"
        f"Aguardando *ok* pra executar.\n\n"
        f"Se o pedido for fora do escopo do WoodPlanner, RECUSE explicando o motivo (não gere plano)."
    )

    logger.info("woodplanner_runner_executing", phase="plan", sender=sender_name, request_preview=text[:100])

    exit_code, output = await _woodplanner_call_runner(plan_prompt, timeout=600)
    logger.info("woodplanner_runner_done", phase="plan", exit_code=exit_code, output_len=len(output))

    if exit_code != 0:
        summary = output[-1500:] if len(output) > 1500 else output
        return f"❌ Não consegui montar o plano:\n\n{summary}"

    if len(output) > 1500:
        output = output[-1500:]

    # Se a resposta não contém nenhum sinal de plano (ex: recusa), não salva como pendente
    looks_like_plan = "📋" in output or "PLANO" in output.upper() or "Aguardando" in output
    if not looks_like_plan:
        return output  # provavelmente é uma recusa de escopo

    _woodplanner_pending_set({
        "ts": _dt.now().isoformat(),
        "sender": sender_name,
        "request": text,
        "plan": output,
    })

    return output


## TEKA em produção: set() vazio = atende todos os números.
## Para reativar modo beta, listar phones explicitamente.
## Para desligar a Teka completamente, usar None.
TEKA_TEST_PHONES: set[str] | None = None  # PAUSADA 2026-05-29 — Will pediu pra Teka Comercial parar de responder leads. Setar set() pra reativar.

## Debounce TEKA: acumula mensagens por TEKA_DEBOUNCE_SECONDS antes de processar
TEKA_DEBOUNCE_SECONDS = 40  # Produção: 40s — captura bursts longos do WhatsApp (lead manda 4-8 msgs em até 3 min); ajuste 2026-06-09 após caso Eduardo Rodrigues


def _sanitize_teka(text: str) -> str:
    """Sanitiza resposta da Teca: corrige grafia, remove travessões, formaliza português."""
    import re as _re
    text = text.replace("\u2014", ",").replace("\u2013", ",")
    # Corrige nome da empresa
    text = _re.sub(r'(?i)\bparqu[eêé]\b', 'Parket', text)
    # Português formal: corrige abreviações coloquiais
    text = _re.sub(r'\bpra\b', 'para', text)
    text = _re.sub(r'\bpro\b', 'para o', text)
    text = _re.sub(r'\bpros\b', 'para os', text)
    text = _re.sub(r'\bpras\b', 'para as', text)
    text = _re.sub(r'\btá\b', 'está', text)
    text = _re.sub(r'\btô\b', 'estou', text)
    text = _re.sub(r'\bta\b(?=\s+[a-z])', 'está', text)
    text = _re.sub(r'\bto\b(?=\s+[a-z])', 'estou', text)
    text = _re.sub(r'\bvc\b', 'você', text)
    text = _re.sub(r'\btbm\b', 'também', text)
    text = _re.sub(r'\bné\b', 'não é', text)
    text = _re.sub(r'\bqdo\b', 'quando', text)

    # Remove qualquer código/formatação que a IA possa ter gerado
    text = _re.sub(r'```[\s\S]*?```', '', text)       # Blocos de código markdown
    text = _re.sub(r'`[^`]+`', '', text)               # Código inline
    text = _re.sub(r'<[^>]+>', '', text)                # Tags HTML/XML
    text = _re.sub(r'\{[^}]*[":][^}]*\}', '', text)    # JSON/objetos
    text = _re.sub(r'(?m)^(import |from |def |class |function |const |let |var |if \(|for \(|while \().*$', '', text)
    text = _re.sub(r'\[SISTEMA:[^\]]*\]', '', text)     # Tags internas
    text = _re.sub(r'\[\{.*?\}\]', '', text)             # Arrays
    # Remove caracteres soltos de formatação
    text = _re.sub(r'(?m)^>\s?', '', text)              # Citações markdown "> texto"
    text = text.replace('**', '')                        # Negrito markdown
    text = text.replace('__', '')                        # Sublinhado markdown
    text = _re.sub(r'(?m)^#{1,6}\s', '', text)          # Headers markdown
    text = _re.sub(r'(?m)^[-*]\s', '', text)            # Listas markdown
    text = text.replace('>', '')                         # Qualquer > restante
    text = text.replace('<', '')                         # Qualquer < restante
    # Limpa linhas vazias extras
    text = _re.sub(r'\n{3,}', '\n\n', text)

    return text.strip()
# Estado do debounce TEKA persistido em Redis para coerência entre workers/réplicas.
# Cada chamada armazena a última mensagem em uma lista por telefone, atualiza um
# carimbo "última vez que este telefone falou" e tenta adquirir um lock global.
# Quem pegar o lock dorme TEKA_DEBOUNCE_SECONDS, confere se o carimbo foi atualizado
# nesse intervalo (sinal de que o usuário continuou digitando) e estende o sleep até
# que ele fique parado por TEKA_DEBOUNCE_SECONDS seguidos. Aí flusha o buffer inteiro
# e processa uma única vez.

_TEKA_BUF_KEY = "teka:debounce:buf:{phone}"        # JSON list[str]
_TEKA_META_KEY = "teka:debounce:meta:{phone}"      # JSON dict (último msg_data)
_TEKA_TS_KEY = "teka:debounce:ts:{phone}"          # epoch da última mensagem
_TEKA_LOCK_KEY = "teka:debounce:lock:{phone}"      # lock que segura o flush


def _teka_redis():
    import redis as _redis
    from app.config import settings as _s
    return _redis.from_url(_s.REDIS_URL)


async def _teka_debounce(msg_data: dict, text: str):
    """Acumula mensagens do mesmo número por TEKA_DEBOUNCE_SECONDS antes de processar.

    Estado em Redis para funcionar com múltiplos workers uvicorn / réplicas.
    """
    import asyncio as _aio
    import json as _json
    import time as _time

    phone = msg_data["sender_phone"]
    r = _teka_redis()
    buf_key = _TEKA_BUF_KEY.format(phone=phone)
    meta_key = _TEKA_META_KEY.format(phone=phone)
    ts_key = _TEKA_TS_KEY.format(phone=phone)
    lock_key = _TEKA_LOCK_KEY.format(phone=phone)

    # 1) Acumula texto + atualiza carimbo + meta. TTL generoso para não perder buffer
    #    se o lock holder demorar (IA + envio leva ~10s).
    pipe = r.pipeline()
    pipe.rpush(buf_key, text)
    pipe.expire(buf_key, 600)
    pipe.set(meta_key, _json.dumps(msg_data), ex=600)
    pipe.set(ts_key, str(_time.time()), ex=600)
    pipe.execute()

    # 2) Tenta pegar o lock. Se já existe outro flush em andamento para esse phone,
    #    apenas saímos — quem está segurando o lock vai pegar a nova mensagem antes
    #    de flushar (porque relê o buffer e o ts depois do sleep).
    if not r.set(lock_key, "1", nx=True, ex=180):
        logger.info("teka_debounce_extended", phone=phone, chars=len(text))
        return

    async def _flush_holder():
        try:
            # Espera dinâmica: enquanto novas mensagens chegarem, estende o sleep
            # até completar TEKA_DEBOUNCE_SECONDS sem nada novo.
            while True:
                await _aio.sleep(TEKA_DEBOUNCE_SECONDS)
                ts_raw = r.get(ts_key)
                if not ts_raw:
                    break
                last_ts = float(ts_raw)
                idle = _time.time() - last_ts
                if idle >= TEKA_DEBOUNCE_SECONDS - 0.1:
                    break  # parou de digitar — pode flushar
                # Mantém o lock vivo e dorme o que falta
                r.expire(lock_key, 180)

            # Pop atômico de tudo que está no buffer
            with r.pipeline() as p:
                p.lrange(buf_key, 0, -1)
                p.delete(buf_key)
                p.get(meta_key)
                p.delete(meta_key)
                p.delete(ts_key)
                lrange_res, _, meta_raw, _, _ = p.execute()

            texts = [t.decode() if isinstance(t, (bytes, bytearray)) else t for t in (lrange_res or [])]
            try:
                meta = _json.loads(meta_raw) if meta_raw else msg_data
            except Exception:
                meta = msg_data

            if texts:
                combined = "\n".join(texts)
                logger.info("teka_debounce_flush", phone=phone, msgs=len(texts), chars=len(combined))
                await process_teka_dm(meta, combined)
        except Exception as e:
            logger.error("teka_debounce_holder_error", phone=phone, error=str(e), exc_info=True)
        finally:
            try:
                r.delete(lock_key)
            except Exception:
                pass

    _aio.create_task(_flush_holder())

## Flag Redis: indica que um humano (vendedor) já enviou DM pra esse phone.
## A Teka deve respeitar essa pausa mesmo que o card ainda não exista no banco
## (caso o vendedor tenha iniciado a conversa antes do cliente).
_TEKA_PAUSE_KEY = "teka:paused:{phone}"
_TEKA_PAUSE_TTL = 60 * 60 * 24 * 30  # 30 dias


def _teka_is_paused(phone: str) -> bool:
    try:
        return bool(_teka_redis().get(_TEKA_PAUSE_KEY.format(phone=phone)))
    except Exception:
        return False


def _teka_mark_paused(phone: str, reason: str = "vendedor"):
    try:
        _teka_redis().set(_TEKA_PAUSE_KEY.format(phone=phone), reason, ex=_TEKA_PAUSE_TTL)
    except Exception as e:
        logger.warning("teka_pause_flag_failed", phone=phone, error=str(e))


# Registro de message_ids enviados PELA própria Teka — usado pra distinguir
# eco do bot (fromMe=true vindo de send_text) vs vendedor humano enviando
# pelo WhatsApp Web. Sem isso, a Teka pausava a si mesma a cada resposta.
_TEKA_SENT_KEY = "teka:sent_id:{msg_id}"
_TEKA_SENT_TTL = 60 * 30  # 30 min cobre eco tardio do webhook


def _teka_mark_sent_id(msg_id: str):
    if not msg_id: return
    try:
        _teka_redis().set(_TEKA_SENT_KEY.format(msg_id=msg_id), "1", ex=_TEKA_SENT_TTL)
    except Exception as e:
        logger.warning("teka_sent_id_mark_failed", msg_id=msg_id, error=str(e))


def _teka_was_sent_by_us(msg_id: str) -> bool:
    if not msg_id: return False
    try:
        return bool(_teka_redis().get(_TEKA_SENT_KEY.format(msg_id=msg_id)))
    except Exception:
        return False


async def handle_outbound_dm(msg_data: dict):
    """
    Vendedor humano enviou uma mensagem DM pra um cliente.
    Pausa Teka pra esse phone. O gate antigo de inbound foi removido — eco da
    própria Teka agora é distinguido via _teka_was_sent_by_us (message_id),
    então qualquer fromMe que chegue aqui é humano de verdade.
    """
    from supabase import create_client
    from app.config import settings
    from app.core.teka_agent import COL_EM_QUALIFICACAO, move_card as teka_move
    from datetime import datetime
    from zoneinfo import ZoneInfo

    SP_TZ = ZoneInfo("America/Sao_Paulo")
    phone = msg_data["sender_phone"]  # em DM, é o telefone do cliente do outro lado

    _teka_mark_paused(phone, reason="vendedor_enviou_dm")
    logger.info("teka_paused_outbound", phone=phone)

    # Limpa qualquer buffer de debounce em andamento pra esse phone
    try:
        r = _teka_redis()
        r.delete(_TEKA_BUF_KEY.format(phone=phone))
        r.delete(_TEKA_META_KEY.format(phone=phone))
        r.delete(_TEKA_TS_KEY.format(phone=phone))
    except Exception:
        pass

    # Procura card existente — não cria se não existe (vendedor iniciando frio)
    try:
        sb = create_client(settings.SUPABASE_URL, settings.SUPABASE_SERVICE_KEY)
        rows = sb.table("kanban_cards") \
            .select("id,column_id,details") \
            .eq("dept_id", "comercial-entrada") \
            .execute()
        target = None
        for c in (rows.data or []):
            det = c.get("details", {}) or {}
            if det.get("celular") == phone or det.get("telefone") == phone:
                target = c
                break
        if not target:
            return  # nada a atualizar; flag Redis cuida do futuro

        det = target.get("details", {}) or {}
        det.update({
            "teka_ativa": False,
            "teka_pause_reason": "vendedor enviou mensagem",
            "teka_pause_ts": datetime.now(SP_TZ).isoformat(),
        })
        sb.table("kanban_cards").update({"details": det}).eq("id", target["id"]).execute()

        if target.get("column_id") != COL_EM_QUALIFICACAO:
            await teka_move(target["id"], COL_EM_QUALIFICACAO, sb)
        logger.info("teka_card_paused_by_vendedor", card_id=target["id"], phone=phone)
    except Exception as e:
        logger.error("handle_outbound_dm_failed", phone=phone, error=str(e), exc_info=True)


async def process_teka_dm(msg_data: dict, text: str):
    """
    Processa mensagem DM via TEKA — Agente de Atendimento Inicial.
    Cria/atualiza card no kanban comercial-entrada e responde via IA.
    """
    from supabase import create_client
    from app.config import settings
    from app.core.teka_agent import (
        find_or_create_card, update_card_details, is_teka_active,
        extract_info_from_messages, classificar_lead,
    )
    from datetime import datetime
    from zoneinfo import ZoneInfo

    SP_TZ = ZoneInfo("America/Sao_Paulo")
    phone = msg_data["sender_phone"]
    name = msg_data.get("sender_name", "")
    # Seleciona cliente Evolution conforme instância de origem: leads que entram
    # via "Comercial - Parket" são respondidos pelo número comercial; qualquer
    # outra DM segue no número padrão (Parket).
    # Teka SEMPRE responde leads pelo número comercial (5511999600222),
    # nunca pelo Parket interno (5511971975808). O gate de source_instance
    # em process_whatsapp_message já garante que a DM veio da instância
    # comercial — aqui só reforça pra evitar fallback acidental.
    client = evolution_comercial_client

    # ═════════════════════════════════════════════════════════════════
    # TECA V2 — checa ANTES dos gates da V1 (V2 tem seu próprio sandbox + pause)
    # ═════════════════════════════════════════════════════════════════
    try:
        from app.core.teca_v2 import is_v2_enabled_for_phone, handle_message_v2
        if is_v2_enabled_for_phone(phone):
            sb_v2 = create_client(settings.SUPABASE_URL, settings.SUPABASE_SERVICE_KEY)
            jid_v2 = msg_data["group_id"]
            try:
                card_v2 = await find_or_create_card(phone, name, sb_v2, source_instance=msg_data.get("_source_instance", ""), ad_referral=msg_data.get("ad_referral"))
            except Exception as ce:
                logger.warning("teca_v2_card_lookup_failed phone=%s err=%s", phone, ce)
                card_v2 = {}
            # Guarda: se vendedor/SDR já assumiu (teka_ativa=False), V2 não interfere.
            # Cards novos (find_or_create_card cria com teka_ativa=True) passam normal.
            det_v2 = (card_v2 or {}).get("details") or {}
            if det_v2.get("teka_ativa") is False:
                logger.info("teca_v2_skip_teka_inativa phone=%s reason=%s", phone, det_v2.get("teka_pause_reason"))
                return
            logger.info("teca_v2_routing phone=%s", phone)
            reply_v2 = await handle_message_v2(phone=phone, incoming_message=text, card=card_v2 or {})
            if reply_v2:
                # Quebra a resposta em mensagens separadas: cada linha vira uma msg.
                # Linhas em branco apenas atuam como pausa visual (skip).
                import asyncio as _aio
                import random as _rnd
                # Saneamento: remove travessão (—) e en-dash (–) — Teca não pode usar.
                clean_v2 = reply_v2.replace("—", ",").replace("–", ",")
                # Se vier tudo grudado em uma linha só, divide por sentenças (.! ?).
                if "\n" not in clean_v2 and len(clean_v2) > 180:
                    import re as _re
                    sentences = _re.split(r'(?<=[\.\!\?])\s+(?=[A-ZÁÉÍÓÚÂÊÔÃÕÇ])', clean_v2)
                    if len(sentences) > 1:
                        clean_v2 = "\n".join(s.strip() for s in sentences if s.strip())
                v2_lines = [ln.strip() for ln in clean_v2.split("\n") if ln.strip()]
                # Cap defensivo (2026-06-15): se o LLM ignorar a regra do prompt
                # e mandar 3+ linhas, junta o excedente na última mensagem pra
                # não bombardear o lead com várias notificações seguidas.
                MAX_MSGS = 2
                if len(v2_lines) > MAX_MSGS:
                    head = v2_lines[:MAX_MSGS - 1]
                    tail = " ".join(v2_lines[MAX_MSGS - 1:])
                    v2_lines = head + [tail]
                for idx, ln in enumerate(v2_lines):
                    if idx == 0:
                        await _aio.sleep(_rnd.uniform(1.5, 3.5))  # pequena espera antes da 1ª
                    else:
                        await _aio.sleep(_rnd.uniform(2.5, 5.0))  # pausa natural entre mensagens
                    try:
                        await client.send_typing(jid_v2, duration_ms=int(min(len(ln) * 60, 4000)))
                    except Exception:
                        pass
                    try:
                        await client.send_text(jid_v2, ln)
                    except Exception as se:
                        logger.warning("teca_v2_send_failed phone=%s err=%s", phone, se)
                logger.info("teca_v2_replied phone=%s msgs=%d chars=%d", phone, len(v2_lines), len(reply_v2))

            # ── Atualiza teka_ultima_msg / mensagens_ia / reseta contador ──
            # FIX 2026-06-15 (loop Maria Paula): V2 retornava sem atualizar esses
            # campos, então o scheduler do follow-up via teka_ultima_msg parada
            # em 12:52 (criação do card) e disparava teka_followup_1 a cada
            # minuto. Agora gravamos:
            #   - teka_ultima_msg = agora (cliente acabou de falar)
            #   - mensagens_ia += {cliente: text} + {teka: reply}
            #   - teka_followup_count = 0 (cliente respondeu, ciclo zera)
            #   - teka_followup_1_at = None (idempotency reset; próximo ciclo
            #     de 30min de silêncio terá followup_1 de novo)
            try:
                from datetime import datetime as _dt
                from app.config import settings as _settings
                _now_iso = _dt.now(SP_TZ).isoformat()
                _msgs_ia = list((det_v2 or {}).get("mensagens_ia", []))
                _msgs_ia.append({"de": "cliente", "texto": text, "ts": _now_iso, "nome": name})
                if reply_v2:
                    _msgs_ia.append({"de": "teka", "texto": reply_v2, "ts": _now_iso})
                _upd = {
                    "teka_ultima_msg": _now_iso,
                    "teka_followup_count": 0,
                    "teka_followup_1_at": None,
                    "teka_followup_2_at": None,
                    "mensagens_ia": _msgs_ia[-50:],  # cap histórico
                }
                # Merge no details via PATCH idempotente
                _cur = sb_v2.table("kanban_cards").select("details").eq("id", card_v2.get("id", "")).single().execute()
                _det_cur = ((_cur.data or {}) .get("details") or {})
                _det_cur.update(_upd)
                sb_v2.table("kanban_cards").update({"details": _det_cur}).eq("id", card_v2.get("id", "")).execute()
            except Exception as _e:
                logger.warning("teca_v2_card_state_update_failed phone=%s err=%s", phone, _e)
            return  # V2 cuidou — pula V1
    except Exception as e:
        logger.exception("teca_v2 routing crashed, falling back to V1: %s", e)

    # ── Modo teste V1: None = desativada, set com phones = só esses ──
    if TEKA_TEST_PHONES is None:
        logger.debug("teka_disabled", phone=phone)
        return
    if len(TEKA_TEST_PHONES) > 0 and phone not in TEKA_TEST_PHONES:
        logger.debug("teka_dm_ignored_test_mode", phone=phone)
        return

    # Pausa global por phone: vendedor humano já interagiu com esse cliente.
    # Mesmo que ainda não exista card, a Teka deve ficar fora.
    if _teka_is_paused(phone):
        logger.info("teka_skipped_human_paused", phone=phone)
        return

    # Prestador com check diário ativo: não é lead, é notificação de obra.
    # Não ativar fluxo comercial da Teka.
    try:
        from app.api.webhook_check_obras import has_active_check
        if await has_active_check(phone):
            logger.info("teka_skipped_prestador_check_ativo", phone=phone)
            return
    except Exception as e:
        logger.warning("teka_check_obras_lookup_failed", phone=phone, error=str(e))

    jid = msg_data["group_id"]  # For DMs this is phone@s.whatsapp.net

    sb = create_client(settings.SUPABASE_URL, settings.SUPABASE_SERVICE_KEY)

    try:
        # Encontra ou cria card
        card = await find_or_create_card(phone, name, sb, source_instance=msg_data.get("_source_instance", ""), ad_referral=msg_data.get("ad_referral"))
        card_id = card.get("id")
        if not card_id:
            logger.error("teka_no_card_id", phone=phone)
            return

        # Verifica se TEKA está ativa
        if not await is_teka_active(card):
            logger.info("teka_inativa", card_id=card_id, phone=phone)
            return

        # Move para "Triagem IA" se ainda está em "Leads de Entrada"
        from app.core.teka_agent import COL_LEADS_ENTRADA, COL_TRIAGEM_IA, move_card as teka_move
        if card.get("column_id") == COL_LEADS_ENTRADA:
            await teka_move(card_id, COL_TRIAGEM_IA, sb)
            logger.info("teka_card_moved_to_triagem_ia", card_id=card_id)

        # Atualiza timestamp de última mensagem e salva mensagem
        det = card.get("details", {}) or {}
        msgs_ia = det.get("mensagens_ia", [])
        msgs_ia.append({
            "de": "cliente",
            "texto": text,
            "ts": datetime.now(SP_TZ).isoformat(),
            "nome": name,
        })

        # Extrai info do cliente de TODAS as mensagens acumuladas
        extracted = extract_info_from_messages(msgs_ia)

        # Preenche TODOS os campos diretamente no details do card
        update_data = {
            "teka_ultima_msg": datetime.now(SP_TZ).isoformat(),
            "teka_followup_count": 0,
            "mensagens_ia": msgs_ia,
        }

        # Campos do card que a Teca preenche automaticamente
        FIELD_MAP = {
            "nome": "nome",
            "cidade": "cidade",
            "produto_interesse": "produto_interesse",
            "relacao_obra": "relacao_obra",
            "metragem_estimada": "metragem_estimada",
            "area_m2": "area_m2",
            "faixa_investimento": "faixa_investimento",
            "previsao_instalacao": "previsao_instalacao",
            "escritorio_empresa": "escritorio_empresa",
            "preferencia_madeira": "preferencia_madeira",
            "telefone_extra": "telefone_extra",
        }
        for src_key, det_key in FIELD_MAP.items():
            if extracted.get(src_key):
                update_data[det_key] = extracted[src_key]

        # Qualificação cumulativa
        qualificacao = det.get("qualificacao", {})
        qualificacao.update(extracted)
        update_data["qualificacao"] = qualificacao

        # Classificação do lead se tiver metragem
        if extracted.get("area_m2"):
            classificacao = classificar_lead(extracted["area_m2"])
            update_data["nivel_lead"] = classificacao["nivel"]
            update_data["nivel_label"] = classificacao["label"]

        await update_card_details(card_id, update_data, sb)

        # Atualiza título do card com nome se descobriu
        if extracted.get("nome") and card.get("title", "").startswith("Lead WhatsApp"):
            await sb.table("kanban_cards").update({"title": extracted["nome"]}).eq("id", card_id).execute()

        # Detecta pedido direto de atendente humano na mensagem do cliente
        _lower = text.lower()
        _escalation_phrases = [
            "quero falar com atendente", "falar com um atendente", "falar com uma pessoa",
            "quero um atendente", "quero falar com alguem", "falar com alguém",
            "atendente humano", "pessoa real", "falar com humano",
            "quero falar com gente", "passar para atendente", "transferir para atendente",
            "nao quero falar com robo", "não quero falar com robô", "nao quero falar com bot",
            "quero atendimento humano", "me passa pra alguem", "me passa pra alguém",
            "falar com atendente", "chamar atendente", "chama atendente",
            "quero falar com vendedor", "falar com vendedor", "quero um vendedor",
            "me transfere", "transfere pra alguem", "pode me transferir",
            "falar com alguem de verdade", "quero pessoa de verdade",
            "falar com responsavel", "falar com responsável",
        ]
        if any(phrase in _lower for phrase in _escalation_phrases):
            # Envia mensagem de encaminhamento e escala
            escalation_msg = "Entendido. Estou encaminhando para um dos nossos atendentes. Por favor, aguarde um momento."
            await client.send_text(jid, escalation_msg)
            msgs_ia.append({"de": "teka", "texto": escalation_msg, "ts": datetime.now(SP_TZ).isoformat()})
            await update_card_details(card_id, {"mensagens_ia": msgs_ia}, sb)
            from app.core.teka_agent import escalate_to_human
            await escalate_to_human(card_id, "Cliente solicitou atendente humano", sb, client)
            logger.info("teka_escalacao_direta", phone=phone)
            return

        # Typing indicator
        await client.send_typing(jid, duration_ms=5000)

        # Despacha para agente IA (usa o agent_squad com session especial para TEKA)
        # Se é a primeira mensagem (card recém-criado), instrui que é conversa nova
        is_first_msg = len(msgs_ia) <= 1
        dispatch_text = text
        if is_first_msg:
            dispatch_text = f"[SISTEMA: Esta é uma conversa NOVA. Trate como primeiro contato. Siga o Passo 1 do roteiro.]\n\n{text}"

        # Session ID inclui card_id para garantir reset quando card é novo
        session_group = f"teka_dm_{phone}_{card_id[:8]}"
        async with AsyncSessionLocal() as db:
            response = await agent_squad.dispatch(
                db=db,
                group_id=session_group,
                user_message=dispatch_text,
                sender_name=name or phone,
                sender_phone=phone,
            )

        if response:
            # Detecta comandos de qualificação e conflito na resposta
            qualified = "[QUALIFICADO]" in response
            not_qualified = "[NAO_QUALIFICADO]" in response
            conflito = "[CONFLITO]" in response

            # Remove tags de controle da mensagem visível
            clean_response = (response
                .replace("[QUALIFICADO]", "")
                .replace("[NAO_QUALIFICADO]", "")
                .replace("[CONFLITO]", "")
                .strip())

            # Salva resposta da IA no card
            msgs_ia.append({
                "de": "teka",
                "texto": clean_response,
                "ts": datetime.now(SP_TZ).isoformat(),
            })
            await update_card_details(card_id, {"mensagens_ia": msgs_ia}, sb)

            # Envia resposta: cada parágrafo como mensagem separada, com jitter
            # humano-like (15-160s) antes da PRIMEIRA mensagem e 4-12s entre
            # parágrafos. Why: respostas instantâneas e em rajada são marcador
            # de bot — WhatsApp pode aplicar throttling/bloqueio na instância.
            # Typing indicator é mantido durante a espera para sinalizar atividade.
            if clean_response:
                import asyncio as _aio
                import random as _rnd

                paragraphs = [p.strip() for p in clean_response.split("\n\n") if p.strip()]
                if not paragraphs:
                    paragraphs = [clean_response.strip()]

                async def _human_delay(seconds: float):
                    # Mantém typing aceso enquanto espera (max ~25s por send_typing).
                    remaining = seconds
                    while remaining > 0:
                        chunk = min(remaining, 22.0)
                        try:
                            await client.send_typing(jid, duration_ms=int(chunk * 1000) + 1000)
                        except Exception:
                            pass
                        await _aio.sleep(chunk)
                        remaining -= chunk

                sent = 0
                for i, para in enumerate(paragraphs):
                    para = _sanitize_teka(para)
                    if not para or len(para) < 2:
                        continue
                    if i == 0:
                        # Primeira mensagem: jitter 15-160s
                        delay = _rnd.uniform(15.0, 160.0)
                        logger.info("teka_jitter_first", phone=phone, delay_s=round(delay, 1))
                        await _human_delay(delay)
                    else:
                        # Entre parágrafos: leitura+digitação simulada
                        delay = _rnd.uniform(4.0, 12.0)
                        await _human_delay(delay)
                    try:
                        resp = await client.send_text(jid, para)
                        try:
                            sent_id = (resp or {}).get("key", {}).get("id")
                            if sent_id: _teka_mark_sent_id(sent_id)
                        except Exception:
                            pass
                        sent += 1
                    except Exception as send_err:
                        logger.warning("teka_send_failed", para_len=len(para), error=str(send_err)[:100])
                logger.info("teka_response_sent", phone=phone, msgs=sent, chars=len(clean_response))

            # Move card se conflito — prioridade absoluta, sem rodar analyzer
            if conflito:
                from app.core.teka_agent import escalate_to_human
                await escalate_to_human(card_id, "Conflito detectado ou cliente solicitou atendente", sb, client)
                logger.info("teka_escalacao_conflito", phone=phone)
            else:
                # Só roda analyzer se não foi conflito
                try:
                    from app.core.teka_analyzer import analyze_conversation
                    await analyze_conversation(card_id, msgs_ia, name, sb)
                except Exception as e:
                    logger.warning("teka_analyzer_failed", error=str(e))

                if qualified or not_qualified:
                    from app.core.teka_agent import qualify_and_move
                    await qualify_and_move(card_id, qualified, sb, client)
                    logger.info("teka_qualification_done", phone=phone, qualified=qualified)
                else:
                    # Agenda follow-up (30 min)
                    from app.core.scheduler import schedule_teka_followup
                    await schedule_teka_followup(card_id, phone, delay_minutes=30)

    except Exception as e:
        logger.error("teka_dm_error", phone=phone, error=str(e), exc_info=True)


async def process_whatsapp_message(payload: dict):
    """
    Background task: process message and send agent response.
    Suporta todos os formatos de entrada: texto, áudio, imagem, documento, vídeo.
    Creates its own DB session (the request session is closed by the time
    background tasks run).
    """
    from app.core.media_processor import process_media_message

    msg_data = extract_message_data(payload)
    if not msg_data:
        return

    group_id = msg_data["group_id"]
    text = msg_data["text"]

    # ── Processamento de mídia ──────────────────────────────────────────────
    # Se há mídia, processa e converte para texto antes de despachar ao agente
    if msg_data.get("has_media"):
        try:
            media_text = await process_media_message(
                msg_data["message_obj"], msg_data.get("message_data", {}),
                source_instance=payload.get("_source_instance", ""))
            if media_text:
                # Combina: texto da mensagem (se houver) + conteúdo da mídia
                text = (text + "\n\n" + media_text).strip() if text else media_text
                logger.info("media_processed", group_id=group_id, media_chars=len(media_text))
        except Exception as e:
            logger.error("media_processing_error", error=str(e), exc_info=True)
            # Continua com texto vazio/parcial — não descarta a mensagem

    # Se após todo o processamento ainda não há conteúdo, descarta
    if not text:
        return

    is_dm = msg_data.get("is_dm", False)
    source_instance = payload.get("_source_instance", "")

    logger.info(
        "whatsapp_message_received",
        group_id=group_id,
        sender=msg_data.get("sender_name"),
        has_media=msg_data.get("has_media"),
        is_dm=is_dm,
        source_instance=source_instance,
        text_preview=text[:80],
    )

    # ── DM: Roteamento para TEKA com debounce de 20s ────────────────────
    if is_dm:
        # DM enviado por nós (vendedor humano) — pausa Teka pra esse cliente.
        # Mas: fromMe vindo do próprio send_text da Teka NÃO conta como humano,
        # senão ela pausava a si mesma. Cruzamos o message_id contra o set Redis
        # dos IDs que registramos no envio.
        if msg_data.get("_outbound"):
            msg_id = msg_data.get("message_id", "")
            if _teka_was_sent_by_us(msg_id):
                logger.info("teka_outbound_self_echo_ignored",
                            phone=msg_data.get("sender_phone"), msg_id=msg_id)
                return
            await handle_outbound_dm(msg_data)
            return
        # TEKA só responde DMs vindas da instância comercial dedicada.
        # DMs no número geral (Parket / ai-squad) são notificações, não leads.
        from app.config import settings as _cfg
        if source_instance.strip() != _cfg.EVOLUTION_COMERCIAL_INSTANCE.strip():
            logger.info("teka_skipped_non_comercial_instance", phone=msg_data.get("sender_phone"), instance=source_instance)
            return
        msg_data["_source_instance"] = source_instance
        await _teka_debounce(msg_data, text)
        return

    async with AsyncSessionLocal() as db:
        try:
            # Show typing indicator while processing
            await evolution_client.send_typing(group_id, duration_ms=8000)

            # Grupo UX: executa direto via runner, sem passar pelo LLM para gerar [CLAUDE_CODE]
            if group_id == UX_GROUP_ID:
                response = await run_ux_command(text, msg_data["sender_name"])
                await evolution_client.send_long_text(group_id, response)
                logger.info("ux_response_sent", group_id=group_id, chars=len(response))
                return

            # Grupo Injex IA Dev Squad: executa edições no app injex-ia
            if group_id == INJEXIA_GROUP_ID:
                response = await run_injexia_command(text, msg_data["sender_name"])
                await evolution_client.send_long_text(group_id, response)
                logger.info("injexia_response_sent", group_id=group_id, chars=len(response))
                return

            # Grupo Parket WoodPlanner: executa edições no módulo /marcenaria do parket-draw
            if group_id == WOODPLANNER_GROUP_ID:
                response = await run_woodplanner_command(text, msg_data["sender_name"])
                await evolution_client.send_long_text(group_id, response)
                logger.info("woodplanner_response_sent", group_id=group_id, chars=len(response))
                return

            # Check if agent requires mention to respond
            BOT_JIDS = {
                "5511971975808@s.whatsapp.net",
                "5511971975808@lid",
                "173787714732087@lid",  # LID format usado em alguns grupos
            }
            db_agent = await agent_squad.get_db_agent_for_group(db, group_id)
            if db_agent and db_agent.reply_only_mentions:
                mentioned = msg_data.get("mentioned_jids", [])
                # Check if any of the bot's JIDs were mentioned
                bot_mentioned = any(jid in BOT_JIDS or jid.replace("@s.whatsapp.net", "") == "5511971975808" or "173787714732087" in jid for jid in mentioned)
                # Also check if the mention appears in the text itself (@ followed by bot number or LID)
                text_has_mention = "5511971975808" in text or "173787714732087" in text or "@parket" in text.lower()
                if not bot_mentioned and not text_has_mention:
                    logger.info("agent_mention_required_skipped", group_id=group_id, sender=msg_data["sender_name"], mentioned=mentioned)
                    return
                else:
                    logger.info("agent_mention_detected", group_id=group_id, sender=msg_data["sender_name"], mentioned=mentioned)

            # Dispatch to agent squad
            response = await agent_squad.dispatch(
                db=db,
                group_id=group_id,
                user_message=text,
                sender_name=msg_data["sender_name"],
                sender_phone=msg_data["sender_phone"],
                whatsapp_message_id=msg_data["message_id"],
            )

            if response:
                # Extract and save any scheduled task from the response
                response = await extract_and_save_task(db, group_id, response)
                # Delegate to Claude Code CLI if the TI agent embedded a [CLAUDE_CODE:{...}] block
                response = await extract_and_run_claude_code(response, msg_data["sender_phone"])
                await evolution_client.send_long_text(group_id, response)
                logger.info("agent_response_sent", group_id=group_id, chars=len(response))
            else:
                logger.info("no_agent_assigned", group_id=group_id)

        except Exception as e:
            logger.error(
                "message_processing_failed",
                group_id=group_id,
                error=str(e),
                exc_info=True,
            )


@router.post("/evolution")
async def evolution_webhook(
    request: Request,
    background_tasks: BackgroundTasks,
):
    """Main Evolution API webhook endpoint."""
    try:
        payload = await request.json()
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid JSON payload")

    event = payload.get("event", "")
    data_type = type(payload.get("data")).__name__
    logger.info("webhook_received", wh_event=event, data_type=data_type)

    # Evolution API v1 sends "MESSAGES_UPSERT", v2 sends "messages.upsert"
    if event.upper().replace(".", "_") == "MESSAGES_UPSERT":
        # `instance` no payload indica de qual conta Evolution veio a mensagem;
        # é usado para escolher o cliente certo ao responder (Parket vs Comercial - Parket).
        payload["_source_instance"] = payload.get("instance") or payload.get("instanceName") or ""
        background_tasks.add_task(process_whatsapp_message, payload)

        # Fan-out: repassar para check-obras, dev portal e fiscal-laudo
        background_tasks.add_task(forward_to_check_obras, payload)
        background_tasks.add_task(forward_to_devportal, payload)
        background_tasks.add_task(forward_to_fiscal_laudo, payload)

        # Persiste em whatsapp_messages pra alimentar o /comercial/conversas
        # do Dashboard (o webhook desta instância NÃO bate direto no Edge Function
        # do Supabase, então temos que fazer aqui ou senão o histórico fica preso).
        background_tasks.add_task(persist_whatsapp_history, payload)

    return {"status": "received", "event": event}


async def _archive_whatsapp_media(instance: str, msg_id: str, msg_type: str, supa_url: str, supa_key: str) -> str | None:
    """Baixa mídia via Evolution getBase64 e sobe no bucket whatsapp-media
    do Supabase Storage. Retorna URL pública permanente (não expira). None se
    qualquer etapa falhar — fluxo continua normal, frontend tenta decifrar.

    Por que: URLs de mídia do WhatsApp (.enc) expiram em ~14 dias e a Evolution
    não as renova. Pra preservar áudios/docs históricos pros cards, arquivamos
    no momento da recepção (URL ainda válida).
    """
    import base64
    import os
    import httpx as _httpx
    EVO_API = os.environ.get("EVOLUTION_API_URL") or "https://conect.parket.works"
    EVO_KEY = os.environ.get("EVOLUTION_API_KEY") or "4eab105201410d6865b86dca76ee9fa3"
    try:
        async with _httpx.AsyncClient(timeout=30) as c:
            r = await c.post(
                f"{EVO_API}/chat/getBase64FromMediaMessage/{instance}",
                headers={"apikey": EVO_KEY, "Content-Type": "application/json"},
                json={"message": {"key": {"id": msg_id}}, "convertToMp4": False},
            )
            if r.status_code >= 400: return None
            j = r.json()
            b64 = j.get("base64")
            if not b64: return None
            mime = j.get("mimetype", "application/octet-stream").split(";")[0].strip()
            fname = j.get("fileName") or f"{msg_id}"
            ext = fname.rsplit(".", 1)[-1] if "." in fname else (
                "ogg" if "audio" in mime else
                "jpg" if "image" in mime else
                "mp4" if "video" in mime else
                "bin"
            )
            ext = ext.lower()[:6]
            data_bytes = base64.b64decode(b64)
            # Path: {instance}/{msg_id}.{ext} — instance limitada a safe chars
            safe_inst = "".join(ch if ch.isalnum() or ch in "-_" else "_" for ch in instance)[:60]
            storage_path = f"{safe_inst}/{msg_id}.{ext}"
            up = await c.post(
                f"{supa_url}/storage/v1/object/whatsapp-media/{storage_path}",
                headers={
                    "Authorization": f"Bearer {supa_key}",
                    "apikey": supa_key,
                    "Content-Type": mime,
                    "x-upsert": "true",
                },
                content=data_bytes,
            )
            if up.status_code in (200, 201):
                return f"{supa_url}/storage/v1/object/public/whatsapp-media/{storage_path}"
            logger.warning("archive_upload_failed", status=up.status_code, body=up.text[:200])
    except Exception as e:
        logger.warning("archive_media_failed", error=str(e), msg_id=msg_id)
    return None


async def persist_whatsapp_history(payload: dict):
    """Grava mensagens recebidas via webhook Evolution em whatsapp_messages
    do Supabase do Dashboard. Idempotente — usa evolution_msg_id como chave
    natural de dedup (Prefer: resolution=ignore-duplicates).

    Roda como background task pra não bloquear o caminho da Teka.
    """
    import os
    import httpx as _httpx
    from datetime import datetime, timezone

    SUPA_URL = (os.environ.get("SUPABASE_DASHBOARD_URL")
                or os.environ.get("SUPABASE_URL")
                or "https://hbxpilrxmitvzebluoom.supabase.co")
    SUPA_KEY = (os.environ.get("SUPABASE_DASHBOARD_KEY")
                or os.environ.get("SUPABASE_SERVICE_KEY")
                or os.environ.get("SUPABASE_KEY")
                or "")
    if not SUPA_KEY:
        logger.warning("persist_wa_history_no_key")
        return

    try:
        instance = payload.get("instance") or payload.get("instanceName") or payload.get("_source_instance") or ""
        data = payload.get("data") or {}
        # Evolution v1: data é dict único; v2 também — em ambos, key + message + messageTimestamp
        msgs = data if isinstance(data, list) else [data]

        # Pré-carrega cards comerciais pra resolver card_id por phone
        # (assim o frontend filtra por dept_id corretamente nas tabs)
        # Indexa em MÚLTIPLAS variações: digits crus, últimos 11, últimos 10.
        # Motivo: card pode ter "11977357085" (sem 55) e webhook traz "5511977357085".
        # Comparar pelos últimos 10/11 dígitos garante match independente do prefixo país.
        cards_by_phone: dict = {}
        try:
            async with _httpx.AsyncClient(timeout=10) as c:
                rc = await c.get(
                    f"{SUPA_URL}/rest/v1/kanban_cards?select=id,dept_id,details&dept_id=in.(comercial,comercial-entrada)",
                    headers={"apikey": SUPA_KEY, "Authorization": f"Bearer {SUPA_KEY}"},
                )
                if rc.status_code == 200:
                    for cd in rc.json():
                        det = cd.get("details") or {}
                        phone_candidates = [det.get(k) for k in ("celular","telefone","phone","whatsapp")]
                        for p in phone_candidates:
                            if not p: continue
                            digits = "".join(ch for ch in str(p) if ch.isdigit())
                            if not digits: continue
                            # Indexa pelas formas mais comuns pra garantir match
                            cards_by_phone.setdefault(digits, cd["id"])
                            if len(digits) >= 10:
                                cards_by_phone.setdefault(digits[-10:], cd["id"])
                            if len(digits) >= 11:
                                cards_by_phone.setdefault(digits[-11:], cd["id"])
        except Exception:
            pass  # se falhar, segue sem card_id

        rows = []
        for m in msgs:
            if not isinstance(m, dict): continue
            key = m.get("key") or {}
            evo_id = key.get("id") or m.get("id")
            if not evo_id: continue
            remote = key.get("remoteJid") or key.get("remoteJidAlt") or ""
            phone = remote.split("@")[0] if "@" in remote else remote
            from_me = bool(key.get("fromMe"))
            ts_unix = m.get("messageTimestamp") or 0
            if isinstance(ts_unix, str): ts_unix = int(ts_unix)
            iso_ts = datetime.fromtimestamp(ts_unix, tz=timezone.utc).isoformat() if ts_unix else None
            if not iso_ts: continue
            mm = m.get("message") or {}
            text = (mm.get("conversation")
                    or (mm.get("extendedTextMessage") or {}).get("text")
                    or (mm.get("imageMessage") or {}).get("caption")
                    or (mm.get("videoMessage") or {}).get("caption")
                    or "")
            msg_type = m.get("messageType") or "conversation"
            media_url = (
                (mm.get("imageMessage") or {}).get("url")
                or (mm.get("videoMessage") or {}).get("url")
                or (mm.get("audioMessage") or {}).get("url")
                or (mm.get("documentMessage") or {}).get("url")
                or (mm.get("stickerMessage") or {}).get("url")
                or (mm.get("pttMessage") or {}).get("url")
            )
            # Arquiva a mídia no Supabase Storage AGORA enquanto a URL ainda
            # tá válida (WhatsApp expira em ~14 dias). Substitui media_url pelo
            # link permanente do Storage. Se o download/upload falhar, mantém
            # a URL original (frontend tenta decifrar via Evolution).
            if media_url and msg_type in {"audioMessage","imageMessage","documentMessage","videoMessage","stickerMessage","pttMessage"}:
                archived = await _archive_whatsapp_media(instance, evo_id, msg_type, SUPA_URL, SUPA_KEY)
                if archived:
                    media_url = archived
            # Tenta resolver card_id pelo phone (sem @suffix).
            # Faz lookup em cascata: digits crus → últimos 11 → últimos 10.
            # Cobre cards salvos sem código país (ex: card "11977357085",
            # webhook traz "5511977357085" — bate pelos últimos 11).
            digits = "".join(ch for ch in phone if ch.isdigit())
            resolved_card_id = (
                cards_by_phone.get(digits)
                or (cards_by_phone.get(digits[-11:]) if len(digits) >= 11 else None)
                or (cards_by_phone.get(digits[-10:]) if len(digits) >= 10 else None)
            )
            rows.append({
                "phone": phone,
                "instance": instance,
                "direction": "out" if from_me else "in",
                "sender_name": m.get("pushName") or "",
                "message_text": text or "",
                "message_type": msg_type,
                "media_url": media_url,
                "timestamp": iso_ts,
                "evolution_msg_id": evo_id,
                "card_id": resolved_card_id,
                "metadata": {"source": "webhook", "remoteJid": remote},
            })
        if not rows: return
        async with _httpx.AsyncClient(timeout=15) as c:
            # UPSERT por (evolution_msg_id, instance) — outras instâncias podem
            # ter Edge Function gravando em paralelo (ex: Secretaria), aí ignora
            # silenciosamente conflitos via Prefer + on_conflict query string.
            r = await c.post(
                f"{SUPA_URL}/rest/v1/whatsapp_messages?on_conflict=evolution_msg_id,instance",
                headers={
                    "apikey": SUPA_KEY,
                    "Authorization": f"Bearer {SUPA_KEY}",
                    "Content-Type": "application/json",
                    "Prefer": "resolution=ignore-duplicates,return=minimal",
                },
                json=rows,
            )
            # 409 == duplicata esperada (outra rota gravou primeiro). Não loga.
            if r.status_code >= 400 and r.status_code != 409:
                logger.warning("persist_wa_history_http_error", status=r.status_code, body=r.text[:200])
    except Exception as e:
        logger.warning("persist_wa_history_failed", error=str(e))


async def forward_to_check_obras(payload: dict):
    """Repassa webhook internamente para check-obras."""
    import httpx as _httpx
    try:
        async with _httpx.AsyncClient(timeout=10) as c:
            await c.post("https://agente.parket.works/api/webhook/check-obras", json=payload)
    except Exception as e:
        logger.warning("check_obras_forward_failed", error=str(e))


async def forward_to_fiscal_laudo(payload: dict):
    """Repassa webhook internamente pro handler de mensagens em grupos de fiscais."""
    import httpx as _httpx
    try:
        async with _httpx.AsyncClient(timeout=10) as c:
            await c.post("https://agente.parket.works/api/webhook/fiscal-laudo", json=payload)
    except Exception as e:
        logger.warning("fiscal_laudo_forward_failed", error=str(e))


async def forward_to_devportal(payload: dict):
    """Repassa webhook para dev.parket.works para processar aprovações."""
    import httpx as _httpx
    try:
        async with _httpx.AsyncClient(timeout=5) as c:
            await c.post("https://dev.parket.works/api/webhook/devportal", json=payload)
    except Exception as e:
        logger.warning("devportal_forward_failed", error=str(e))


@router.post("/meta-lead")
async def meta_lead_webhook(payload: dict, request: Request):
    """
    Webhook pra leads do Meta Lead Ads (Facebook/Instagram).

    Disparado pelo Apps Script do Google Sheets quando uma nova linha
    é adicionada na planilha de leads do Meta. Cria card em
    `dept_id="comercial-entrada"`, `column_id="leads-entrada"`.

    Idempotente por meta_lead_id (campo `id`) ou telefone — não duplica
    se reprocessado.

    Auth: header `X-Sheets-Secret` deve bater com env META_LEAD_SECRET.
    Body esperado:
      { "id": "l:1234", "nome_completo": "Joao", "telefone": "p:+551199...",
        "email": "x@y.com", "ad_name": "ad02", "campaign_name": "...",
        "form_name": "...", "platform": "ig",
        "qual_o_momento_atual_da_sua_obra?": "...", "created_time": "..." }
    """
    import os
    import re
    from supabase import create_client
    from app.config import settings

    expected = os.environ.get("META_LEAD_SECRET", "parket-meta-lead-2026")
    got = request.headers.get("x-sheets-secret") or request.headers.get("X-Sheets-Secret")
    if got != expected:
        raise HTTPException(401, "secret inválido")

    # Normaliza telefone (Meta vem com prefixo "p:" e/ou "+")
    raw_tel = (payload.get("telefone") or "").strip()
    raw_tel = re.sub(r"^p:", "", raw_tel).strip()
    digits = re.sub(r"\D", "", raw_tel)
    if digits and not digits.startswith("55") and len(digits) >= 10:
        digits = "55" + digits  # assume BR
    phone = digits or None

    name = (payload.get("nome_completo") or "").strip() or None
    email = (payload.get("email") or "").strip() or None
    meta_lead_id = (payload.get("id") or "").strip() or None

    # rejeita test leads
    if re.search(r"<test lead", str(payload), re.I):
        return {"ok": True, "skipped": "test_lead"}
    if not phone and not email:
        raise HTTPException(400, "telefone ou email obrigatório")

    sb = create_client(settings.SUPABASE_URL, settings.SUPABASE_SERVICE_KEY)

    # Idempotência por meta_lead_id ou phone
    existing = None
    if meta_lead_id:
        try:
            r = sb.table("kanban_cards") \
                .select("id,details") \
                .eq("dept_id", "comercial-entrada") \
                .filter("details->>meta_lead_id", "eq", meta_lead_id) \
                .limit(1).execute()
            if r.data: existing = r.data[0]
        except Exception:
            pass
    if not existing and phone:
        # Dedup por variantes BR (com/sem DDI 55, com/sem 9º dígito) — antes usava
        # eq exato só em comercial-entrada, então o mesmo número em formato diferente
        # OU um card já pego pelo vendedor (dept=comercial) escapava (Will 22/07).
        try:
            from app.core.teca_v2.state import _phone_variants
            variants = _phone_variants(phone) or [phone]
        except Exception:
            variants = [phone]
        variants = [v for v in variants if v]
        if variants:
            or_terms = []
            for v in variants:
                or_terms.append(f"details->>celular.eq.{v}")
                or_terms.append(f"details->>telefone.eq.{v}")
            try:
                r = sb.table("kanban_cards") \
                    .select("id,details,dept_id,updated_at") \
                    .in_("dept_id", ["comercial-entrada", "comercial"]) \
                    .or_(",".join(or_terms)) \
                    .execute()
                cands = r.data or []
                cands.sort(key=lambda c: (0 if c.get("dept_id") == "comercial" else 1, -((c.get("updated_at") or ""))))  # type: ignore
                if cands:
                    existing = cands[0]
            except Exception:
                pass

    qualif = payload.get("qual_o_momento_atual_da_sua_obra?") \
             or payload.get("qual_o_momento_atual_da_sua_obra") or ""

    # Mapeia plataforma do Meta pra label legível
    platform = (payload.get("platform") or "").lower()
    plat_label = {"ig": "Instagram", "fb": "Facebook", "an": "Audience Network"}.get(platform, platform or "Meta")

    _meta_sdr = pick_next_sdr(sb)
    base_details = {
        # ── Contato ──
        "nome": name,
        "contato_principal": name,
        "celular": phone,
        "telefone": phone,
        "email": email,
        # ── Projeto / qualificação ──
        "produto_interesse": qualif,
        "qualificacao_inicial": qualif,
        "resumo_qualificacao": qualif,
        # ── Funil ──
        "status_lead": "Novo",
        "funil_vendas": "Lead — Forms Meta",
        "vendedor": "",                  # aguarda atribuição
        "sdr": _meta_sdr,
        # ── Origem / atribuição (Meta Ads) ──
        "origem": "meta_lead_ads",
        "origem_lead": f"Forms Meta ({plat_label})",
        "fonte": "google_sheets_webhook",
        "meta_lead_id": meta_lead_id,
        "platform": platform or None,
        "platform_label": plat_label,
        "ad_id": payload.get("ad_id"),
        "ad_name": payload.get("ad_name"),
        "adset_id": payload.get("adset_id"),
        "adset_name": payload.get("adset_name"),
        "campaign_id": payload.get("campaign_id"),
        "campaign_name": payload.get("campaign_name"),
        "form_id": payload.get("form_id"),
        "form_name": payload.get("form_name"),
        "is_organic": str(payload.get("is_organic", "")).lower() == "true",
        "lead_status_meta": payload.get("lead_status"),
        "created_time_meta": payload.get("created_time"),
        # ── Auditoria ──
        "criado_por": "Forms Meta (auto)",
        "data_criada": datetime.utcnow().isoformat() + "Z",
    }
    base_tags = ["Forms Meta"]

    if existing:
        # Preserva fields custom já preenchidos; atualiza só atribuição do Meta
        merged = {**base_details, **(existing.get("details") or {})}
        for k in ("meta_lead_id", "lead_status_meta", "platform", "ad_name",
                  "campaign_name", "origem_lead"):
            if base_details.get(k) is not None:
                merged[k] = base_details[k]
        # Garante a tag "Forms Meta" sem duplicar
        existing_full = sb.table("kanban_cards").select("tags").eq("id", existing["id"]).single().execute()
        cur_tags = (existing_full.data.get("tags") if existing_full.data else None) or []
        if "Forms Meta" not in cur_tags:
            cur_tags = list(cur_tags) + ["Forms Meta"]
        sb.table("kanban_cards").update({
            "details": merged,
            "tags": cur_tags,
        }).eq("id", existing["id"]).execute()
        logger.info("meta_lead_card_updated", card_id=existing["id"], phone=phone)
        return {"ok": True, "action": "updated", "card_id": existing["id"]}

    new_card = {
        "dept_id": "comercial-entrada",
        "column_id": "leads-entrada",
        "title": name or (f"Lead Meta {phone[-4:]}" if phone else "Lead Meta"),
        "responsavel": _meta_sdr or "A definir",
        "sla": "24h",
        "sla_status": "ok",
        "priority": "media",
        "tags": base_tags,
        "details": base_details,
    }
    res = sb.table("kanban_cards").insert(new_card).execute()
    card_id = res.data[0]["id"] if res.data else None
    logger.info("meta_lead_card_created", card_id=card_id, phone=phone, name=name,
                campaign=payload.get("campaign_name"))
    return {"ok": True, "action": "created", "card_id": card_id}


@router.get("/status")
async def webhook_status():
    """Check webhook endpoint health and current Evolution API webhook config."""
    try:
        wh = await evolution_client.get_webhook()
    except Exception as e:
        wh = {"error": str(e)}
    try:
        conn = await evolution_client.check_connection()
    except Exception as e:
        conn = {"error": str(e)}
    return {
        "status": "ok",
        "instance": evolution_client.instance,
        "webhook": wh,
        "connection": conn,
    }
