#!/usr/bin/env python3
"""
Despause inteligente da Teka.

Política:
- Phone tem flag `teka:paused:<phone>` no Redis E não há mensagem IN do cliente
  no whatsapp_messages → DESPAUSA (vendedor mandou em lead frio, era falso
  positivo). Também reativa teka_ativa=true no card se existir.
- Phone tem inbound histórico → MANTÉM PAUSADO (conversa real em andamento
  conduzida por humano, Teka não deve interferir).

Saída: relatório por categoria + ações tomadas.
"""
import os
import sys
import redis
from supabase import create_client

REDIS_HOST = os.environ.get("REDIS_HOST", "redis")
REDIS_PORT = int(os.environ.get("REDIS_PORT", "6379"))
SUPABASE_URL = os.environ["SUPABASE_URL"]
SUPABASE_SERVICE_KEY = os.environ["SUPABASE_SERVICE_KEY"]
DRY_RUN = "--apply" not in sys.argv

PAUSE_PREFIX = "teka:paused:"


def main():
    r = redis.Redis(host=REDIS_HOST, port=REDIS_PORT, decode_responses=True)
    sb = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)

    paused_keys = list(r.scan_iter(match=f"{PAUSE_PREFIX}*"))
    print(f"Total phones pausados no Redis: {len(paused_keys)}")

    despausados = []
    mantidos = []
    cards_reativados = 0

    for key in paused_keys:
        phone = key.replace(PAUSE_PREFIX, "")
        variants = {phone, phone.lstrip("55"), "55" + phone.lstrip("55")}

        # Tem mensagem IN do cliente?
        res = sb.table("whatsapp_messages") \
            .select("id", count="exact") \
            .in_("phone", list(variants)) \
            .eq("direction", "in") \
            .limit(1).execute()
        has_inbound = bool(res.count and res.count > 0)

        if has_inbound:
            mantidos.append(phone)
        else:
            despausados.append(phone)
            if not DRY_RUN:
                r.delete(key)
                # Reativa card se existir e estiver em coluna inicial/triagem
                try:
                    cards = sb.table("kanban_cards") \
                        .select("id,column_id,details") \
                        .eq("dept_id", "comercial-entrada").execute()
                    for c in (cards.data or []):
                        det = c.get("details", {}) or {}
                        if det.get("celular") == phone or det.get("telefone") == phone:
                            etapa = det.get("teka_etapa", "")
                            # Só reativa se NÃO foi escalado para humano nem qualificado
                            if etapa in ("escalado_humano", "qualificado", "nao_qualificado"):
                                continue
                            det["teka_ativa"] = True
                            det.pop("teka_pause_reason", None)
                            det.pop("teka_pause_ts", None)
                            sb.table("kanban_cards") \
                                .update({"details": det}) \
                                .eq("id", c["id"]).execute()
                            cards_reativados += 1
                            break
                except Exception as e:
                    print(f"  ! erro reativando card {phone}: {e}")

    print(f"\n=== RESULTADO ({'DRY-RUN' if DRY_RUN else 'APLICADO'}) ===")
    print(f"Despausados (sem inbound, falso positivo): {len(despausados)}")
    print(f"Mantidos (com inbound, conversa humana real): {len(mantidos)}")
    print(f"Cards reativados (teka_ativa=true): {cards_reativados}")

    if DRY_RUN:
        print("\nPara aplicar de verdade: python3 teka_despause_inteligente.py --apply")
    else:
        print("\n[OK] Aplicado. Próximas mensagens desses phones acionarão a Teka.")


if __name__ == "__main__":
    main()
