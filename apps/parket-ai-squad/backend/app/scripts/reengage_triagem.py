"""
Re-engaja leads em triagem-ia sem resposta humana.

Para cada card em `comercial-entrada / triagem-ia` atualizado nas últimas 48h:
1. Pega telefone + última mensagem inbound (whatsapp_messages)
2. Limpa pausa no Redis (teka:paused:{phone})
3. Chama agent_squad.dispatch() → gera resposta Claude OAuth
4. Envia via Evolution (instância Comercial)
5. Persiste o outbound em whatsapp_messages
6. Envia feedback da conversa pro grupo Comercial Parket

Uso (dentro do container):
    docker exec $BK python3 -m app.scripts.reengage_triagem [--dry-run] [--hours 48]
"""
from __future__ import annotations
import asyncio
import argparse
import os
import sys
import httpx
import redis as _redis
from datetime import datetime, timedelta, timezone
from supabase import create_client

# ── Config ──
SB_URL = "https://hbxpilrxmitvzebluoom.supabase.co"
SB_KEY = os.environ.get("SUPABASE_SERVICE_KEY") or "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhieHBpbHJ4bWl0dnplYmx1b29tIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3Mjk0MjUyNywiZXhwIjoyMDg4NTE4NTI3fQ.fTovVTCBFcMrrhVCR6TsneALfMRLLLHZdMmSJH16L4A"
GRUPO_COMERCIAL = "120363423690432580@g.us"  # 🏢 Parket — Comercial
REDIS_URL = os.environ.get("REDIS_URL", "redis://redis:6379/0")

sb = create_client(SB_URL, SB_KEY)


async def send_group_feedback(cliente: str, phone: str, last_msg: str, teka_reply: str, coluna: str, card_id: str):
    """Manda resumo da interação pro grupo comercial."""
    try:
        from app.core.evolution_client import evolution_client  # instância Parket (padrão), pra grupos
    except Exception:
        return

    # Trunca textos longos
    last_msg_preview = (last_msg or "—").replace("\n", " ")[:180]
    teka_preview = (teka_reply or "—").replace("\n", " ")[:280]
    coluna_label = coluna.replace("-", " ").title() if coluna else "—"

    msg = (
        f"🤖 *Teka — Re-engajamento automático*\n"
        f"\n"
        f"👤 *{cliente}*  |  📱 `{phone}`\n"
        f"📋 Coluna: {coluna_label}\n"
        f"\n"
        f"📨 *Última msg cliente:*\n_{last_msg_preview}_\n"
        f"\n"
        f"🗨️ *Resposta da Teka:*\n_{teka_preview}_\n"
        f"\n"
        f"🔗 Card: `{card_id[:8]}...`"
    )
    try:
        await evolution_client.send_text(GRUPO_COMERCIAL, msg)
    except Exception as e:
        print(f"[feedback] falhou ao enviar pro grupo: {e}")


def _log(msg):
    print(msg, flush=True)


async def main(hours: int = 48, dry_run: bool = False):
    # Lazy imports para evitar carregar o app inteiro se não necessário
    from app.core.agno_engine import agent_squad
    from app.core.evolution_client import evolution_comercial_client
    from app.database import AsyncSessionLocal

    since = (datetime.now(timezone.utc) - timedelta(hours=hours)).isoformat()

    # Cards em triagem-ia sem resposta humana
    r = sb.table("kanban_cards") \
        .select("id,title,column_id,details,responsavel,updated_at,created_at") \
        .eq("dept_id", "comercial-entrada") \
        .eq("column_id", "triagem-ia") \
        .gte("updated_at", since) \
        .execute()
    cards = r.data or []
    cards = [c for c in cards if (c.get("responsavel") or "").upper() in ("", "TEKA IA")]

    _log(f"[re-engage] encontrados {len(cards)} cards em triagem-ia sem humano (últ. {hours}h)")

    if dry_run:
        for c in cards:
            phone = (c.get("details") or {}).get("celular", "")
            _log(f"  • {c['title']}  phone={phone}  updated={c['updated_at']}")
        return

    red = _redis.from_url(REDIS_URL)
    ok = 0
    err = 0
    skipped = 0

    async with AsyncSessionLocal() as db:
        for c in cards:
            det = c.get("details") or {}
            phone = det.get("celular", "")
            card_id = c["id"]
            cliente = c.get("title") or "—"
            coluna = c.get("column_id") or ""

            if not phone:
                skipped += 1
                _log(f"[skip] sem telefone: {cliente}")
                continue

            # Pega última mensagem inbound do cliente
            # 1º tenta whatsapp_messages (histórico até 22/04)
            last_msg_text = ""
            msg_r = sb.table("whatsapp_messages") \
                .select("message_text,timestamp") \
                .eq("phone", phone) \
                .eq("direction", "in") \
                .order("timestamp", desc=True) \
                .limit(1) \
                .execute()
            msgs = msg_r.data or []
            if msgs:
                last_msg_text = (msgs[0].get("message_text") or "").strip()

            # 2º fallback: details.mensagens_ia[] (formato novo depois de 22/04)
            if not last_msg_text:
                ia_msgs = det.get("mensagens_ia") or []
                # Pega a última mensagem do cliente (de='cliente')
                for m in reversed(ia_msgs):
                    if m.get("de") == "cliente":
                        last_msg_text = (m.get("texto") or "").strip()
                        if last_msg_text:
                            break

            # 3º fallback: nome do produto de interesse (se preenchido)
            if not last_msg_text:
                prod = det.get("produto_interesse") or det.get("qualificacao", {}).get("produto_interesse")
                if prod:
                    last_msg_text = f"Tenho interesse em {prod.lower()}"

            if not last_msg_text:
                skipped += 1
                _log(f"[skip] sem msg inbound (nem em whatsapp_messages nem em details.mensagens_ia): {cliente} ({phone})")
                continue

            # Evita dupla-resposta: se a Teka respondeu nos últ. 30 min, pula
            recent_out = sb.table("whatsapp_messages") \
                .select("timestamp") \
                .eq("phone", phone) \
                .eq("direction", "out") \
                .gte("timestamp", (datetime.now(timezone.utc) - timedelta(minutes=30)).isoformat()) \
                .limit(1) \
                .execute()
            if recent_out.data:
                skipped += 1
                _log(f"[skip] já respondido nos últ. 30min: {cliente} ({phone})")
                continue

            # Limpa pausa Redis pra liberar Teka
            pause_key = f"teka:paused:{phone}"
            red.delete(pause_key)

            # Extrai primeiro nome amigável (ignora username tipo "renatomarinho92")
            nome_amigavel = cliente
            if any(c.isdigit() for c in cliente) or "_" in cliente or cliente.islower():
                # title tem cara de username — tenta pegar de details.nome
                det_nome = det.get("nome") or ""
                if det_nome and not any(c.isdigit() for c in det_nome):
                    nome_amigavel = det_nome

            # Usa apenas o primeiro nome pra saudação curta
            primeiro_nome = nome_amigavel.split(" ")[0] if nome_amigavel else ""

            # Prompt = mensagem original + hint de personalização.
            # Teka vai responder usando o nome. Se msg é genérica, isso garante
            # que cada resposta fique distinta (cada lead recebe saudação própria).
            prompt_user = last_msg_text
            if primeiro_nome and len(primeiro_nome) > 1 and primeiro_nome.lower() not in last_msg_text.lower():
                prompt_user = f"{last_msg_text}\n\n(Contexto: o cliente se chama {primeiro_nome}. Use o nome dele na saudação.)"

            # Use group_id único por call pra forçar o LLM a não reusar cache
            # (variação natural na resposta mesmo pra mesma msg de input).
            import secrets
            group_id = f"teka_dm_{phone}_{card_id[:8]}_{secrets.token_hex(3)}"
            sender_name = nome_amigavel
            try:
                reply = await agent_squad.dispatch(
                    db=db,
                    group_id=group_id,
                    user_message=prompt_user,
                    sender_name=sender_name,
                    sender_phone=phone,
                )
                if not reply:
                    err += 1
                    _log(f"[err] dispatch sem resposta: {cliente} ({phone})")
                    continue

                # Envia via Evolution Comercial
                await evolution_comercial_client.send_text(f"{phone}@s.whatsapp.net", reply)

                # Persiste outbound em whatsapp_messages
                sb.table("whatsapp_messages").insert({
                    "phone": phone,
                    "instance": "Comercial - Parket",
                    "direction": "out",
                    "sender_name": "Teka",
                    "message_text": reply,
                    "message_type": "conversation",
                    "timestamp": datetime.now(timezone.utc).isoformat(),
                }).execute()

                # Feedback no grupo
                await send_group_feedback(cliente, phone, last_msg_text, reply, coluna, card_id)

                ok += 1
                _log(f"[ok] {cliente} ({phone}) — resposta enviada ({len(reply)} chars)")

                # Delay randômico entre 45s e 120s (anti-bloqueio + natural)
                import random
                delay = random.uniform(45, 120)
                _log(f"       aguardando {delay:.1f}s antes do próximo...")
                await asyncio.sleep(delay)
            except Exception as e:
                err += 1
                _log(f"[ERR] {cliente} ({phone}): {e}")
                await asyncio.sleep(1)

    _log(f"\n[re-engage] ok={ok} err={err} skipped={skipped} total={len(cards)}")


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--hours", type=int, default=48, help="Janela em horas (default 48 = ontem+hoje)")
    ap.add_argument("--dry-run", action="store_true", help="Lista os cards sem disparar nada")
    args = ap.parse_args()
    asyncio.run(main(hours=args.hours, dry_run=args.dry_run))
