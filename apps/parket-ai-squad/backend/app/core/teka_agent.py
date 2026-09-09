"""
TEKA — Agente de Atendimento Inicial Parket (WhatsApp DM)

Responsável por:
- Atender clientes que chegam via WhatsApp DM
- Qualificar leads automaticamente
- Criar/atualizar cards no kanban comercial-entrada
- Follow-up automático (30min → 3h → 10min timeout)
- Mover cards entre etapas do funil
- Notificar grupo comercial sobre novas oportunidades
- Classificar sensibilidade do lead (A/B/C/D)

Regras:
- Só responde DMs (conversas individuais), NUNCA grupos
- Para de responder quando card move para "qualificado" ou "em-qualificacao"
- Pode ser desativada por toggle no card
"""
import logging
import re
import json
from datetime import datetime, timedelta
from typing import Optional
from zoneinfo import ZoneInfo
from app.core.sdr_assigner import pick_next_sdr

logger = logging.getLogger("teka")

SP_TZ = ZoneInfo("America/Sao_Paulo")

# Grupo do comercial para notificações
COMERCIAL_GROUP_ID = "120363423690432580@g.us"  # 🏢 Parket — Comercial

# Colunas do funil
COL_LEADS_ENTRADA = "leads-entrada"
COL_TRIAGEM_IA = "triagem-ia"
COL_QUALIFICADO_IA = "qualificado-ia"
COL_NOVAS_OPORTUNIDADES = "qualificado"  # Atualizado: coluna "novas-oportunidades" removida, leads qualificados vão pra "qualificado"
COL_EM_QUALIFICACAO = "em-qualificacao"
COL_LEMBRETES = "follow-up-1"  # Atualizado: coluna "lembretes" removida, fallback pra "nao-qualificado"

# Colunas onde TEKA PARA de responder
TEKA_STOP_COLUMNS = {COL_NOVAS_OPORTUNIDADES, COL_EM_QUALIFICACAO, "contato-inicial", "follow-up-1", "follow-up-2", "follow-up-3", "qualificado", "qualificado-ia", "nao-qualificado", "vendedor", "em-qualificacao-2"}

# Classificação de sensibilidade por m²
def classificar_lead(area_m2: float) -> dict:
    """Classifica lead por potencial baseado em metragem."""
    if area_m2 >= 1000:
        return {"nivel": "A", "label": "Premium", "emoji": "🔥", "cor": "red"}
    elif area_m2 >= 500:
        return {"nivel": "B", "label": "Alto Potencial", "emoji": "⭐", "cor": "orange"}
    elif area_m2 >= 100:
        return {"nivel": "C", "label": "Médio", "emoji": "📊", "cor": "blue"}
    else:
        return {"nivel": "D", "label": "Pequeno", "emoji": "📋", "cor": "gray"}


async def find_or_create_card(phone: str, name: str, supabase_client, source_instance: str = "", ad_referral: dict | None = None) -> dict:
    """Encontra card existente ou cria novo no funil de entrada.

    `source_instance` guarda qual instância Evolution recebeu o lead (ex.:
    "Comercial - Parket") para que follow-ups futuros saiam do mesmo número.
    """
    # Dedup por telefone SERVER-SIDE (via .or_) — antes o dedup buscava todos os
    # cards de comercial-entrada + comercial e filtrava client-side, mas PostgREST
    # corta em 1000 rows por default. Com >4000 cards no funil comercial os antigos
    # escapavam e viravam duplicata (Will 22/07). O trigger prevent_dup_lead_comercial
    # é o disjuntor definitivo (server-side); esta busca prioriza a UX (achar o card
    # certo antes do INSERT pra manter contexto/histórico da conversa).
    def _last11(p) -> str:
        return "".join(c for c in str(p or "") if c.isdigit())[-11:]

    # Variantes BR (com/sem DDI 55, com/sem 9º dígito)
    try:
        from app.core.teca_v2.state import _phone_variants
        variants = _phone_variants(phone) or [phone]
    except Exception:
        variants = [phone]
    variants = [v for v in variants if v]

    existing_card = None
    if variants:
        # OR filter: details->>celular ou details->>telefone bate em qualquer variante
        or_terms = []
        for v in variants:
            or_terms.append(f"details->>celular.eq.{v}")
            or_terms.append(f"details->>telefone.eq.{v}")
        try:
            res = supabase_client.table("kanban_cards") \
                .select("*") \
                .in_("dept_id", ["comercial-entrada", "comercial"]) \
                .or_(",".join(or_terms)) \
                .execute()
            # Prioriza card já em comercial (vendedor assumiu) sobre entrada
            phone_11 = _last11(phone)
            candidates = res.data or []
            def _key(c):
                dept_rank = 0 if c.get("dept_id") == "comercial" else 1
                return (dept_rank, -(c.get("updated_at") or ""))
            candidates.sort(key=_key)
            for card in candidates:
                det = card.get("details", {}) or {}
                cel_11 = _last11(det.get("celular"))
                tel_11 = _last11(det.get("telefone"))
                if phone_11 and (cel_11 == phone_11 or tel_11 == phone_11):
                    existing_card = card
                    break
        except Exception as e:
            logger.warning("teka_dedup_or_filter_failed", err=str(e)[:200])

    if existing_card:
        det = existing_card.get("details", {}) or {}
        # Garante que a instância de origem fica registrada mesmo se o card já existia
        if source_instance and det.get("evo_instance") != source_instance:
            try:
                merged = {**det, "evo_instance": source_instance}
                supabase_client.table("kanban_cards").update({"details": merged}).eq("id", existing_card["id"]).execute()
                existing_card["details"] = merged
            except Exception:
                pass
        return existing_card

    # Fallback por nome no título — busca só quem já está em entrada (fallback pra ingest sem phone)
    if name:
        try:
            res = supabase_client.table("kanban_cards") \
                .select("*") \
                .in_("dept_id", ["comercial-entrada", "comercial"]) \
                .ilike("title", f"%{name}%") \
                .limit(5).execute()
            if res.data:
                return res.data[0]
        except Exception:
            pass

    # Gera código PKT (busca max no banco)
    try:
        max_resp = supabase_client.table("kanban_cards").select("obra").like("obra", "PKT%").order("obra", desc=True).limit(1).execute()
        import re as _re
        max_num = 100000
        if max_resp.data:
            m = _re.search(r"PKT(\d+)", max_resp.data[0].get("obra", ""))
            if m: max_num = max(max_num, int(m.group(1)))
        pkt = f"PKT{max_num + 1:06d}"
    except Exception:
        pkt = f"PKT{datetime.now().strftime('%H%M%S')}"

    # Cria novo card
    _sdr = pick_next_sdr(supabase_client)
    # CTWA (Click-to-WhatsApp de anúncio Meta): grava meta_tracking com fbc
    # derivado do ctwa_clid (formato aceito pelo Meta CAPI) + attribution
    # com URL/título do anúncio. Isso religa a atribuição de campanha pros
    # leads que chegaram direto pelo wa.me do anúncio.
    _tracking_extra = {}
    if ad_referral and (ad_referral.get("ctwa_clid") or ad_referral.get("source_id")):
        import time as _time
        _ts_ms = int(_time.time() * 1000)
        _clid = ad_referral.get("ctwa_clid")
        _tracking_extra["meta_tracking"] = {
            "fbc": f"fb.1.{_ts_ms}.{_clid}" if _clid else None,
            "ctwa_clid": _clid,
            "ctwa_source_url": ad_referral.get("source_url"),
            "ctwa_source_id": ad_referral.get("source_id"),
            "ctwa_source_type": ad_referral.get("source_type"),
            "ctwa_ad_title": ad_referral.get("title"),
            "ctwa_ad_body": ad_referral.get("body"),
            "ctwa_media_type": ad_referral.get("media_type"),
        }
        _tracking_extra["attribution"] = {
            "utm_source": "meta_ctwa",
            "utm_medium": ad_referral.get("source_type") or "ctwa",
            "utm_campaign": (ad_referral.get("title") or "")[:200],
            "referrer": ad_referral.get("source_url") or "",
            "page_url": ad_referral.get("source_url") or "https://wa.me/5511999600222",
        }
    new_card = {
        "dept_id": "comercial-entrada",
        "column_id": COL_LEADS_ENTRADA,
        "title": name or f"Lead WhatsApp {phone[-4:]}",
        "responsavel": _sdr or "TEKA IA",
        "sla": "24h",
        "sla_status": "ok",
        "priority": "media",
        "obra": pkt,
        "details": {
            "celular": phone,
            "nome": name,
            "sdr": _sdr,
            "origem": "whatsapp_dm",
            "evo_instance": source_instance,
            "teka_ativa": True,
            "teka_etapa": "inicio",
            "teka_inicio": datetime.now(SP_TZ).isoformat(),
            "teka_ultima_msg": datetime.now(SP_TZ).isoformat(),
            "teka_followup_count": 0,
            "mensagens_ia": [],
            "qualificacao": {},
            **_tracking_extra,
        },
    }

    result = supabase_client.table("kanban_cards").insert(new_card).execute()
    if result.data:
        logger.info("teka_card_created", phone=phone, name=name, card_id=result.data[0]["id"])
        return result.data[0]
    return new_card


async def update_card_details(card_id: str, details_update: dict, supabase_client):
    """Atualiza details do card preservando dados existentes."""
    existing = supabase_client.table("kanban_cards").select("details").eq("id", card_id).single().execute()
    current = (existing.data or {}).get("details", {}) or {}
    merged = {**current, **details_update}
    supabase_client.table("kanban_cards").update({"details": merged}).eq("id", card_id).execute()


async def move_card(card_id: str, new_column: str, supabase_client):
    """Move card para nova coluna."""
    supabase_client.table("kanban_cards").update({"column_id": new_column}).eq("id", card_id).execute()
    logger.info("teka_card_moved", card_id=card_id, to_column=new_column)


async def is_teka_active(card: dict) -> bool:
    """Verifica se TEKA deve responder para este card."""
    det = card.get("details", {}) or {}
    col = card.get("column_id", "")

    # Toggle manual desativado
    if det.get("teka_ativa") is False:
        return False

    # Card já em etapa onde TEKA para
    if col in TEKA_STOP_COLUMNS:
        return False

    return True


def extract_info_from_messages(messages: list[dict]) -> dict:
    """
    Extrai informações do cliente das mensagens da conversa.
    Retorna dict com campos que mapeiam diretamente para details do card:
      nome, cidade, metragem_estimada, produto_interesse, relacao_obra,
      faixa_investimento, previsao_instalacao, escritorio_empresa, area_m2
    """
    info = {}
    all_text_raw = " ".join(m.get("texto", m.get("text", "")) for m in messages)
    all_text = all_text_raw.lower()

    # Nome — padrões comuns
    nome_patterns = [
        r"(?:meu nome[: é]+|me chamo[: ]+|sou o |sou a |pode me chamar de )([A-ZÁÉÍÓÚÂÊÎÔÛÃÕÇ][a-záéíóúâêîôûãõç]+(?:\s+[A-ZÁÉÍÓÚÂÊÎÔÛÃÕÇ][a-záéíóúâêîôûãõç]+)*)",
    ]
    for p in nome_patterns:
        m = re.search(p, all_text_raw)
        if m:
            info["nome"] = m.group(1).strip()
            break

    # Cidade/Estado — capitais + cidades grandes
    cidades_map = {
        "porto alegre": "Porto Alegre - RS", "curitiba": "Curitiba - PR",
        "são paulo": "São Paulo - SP", "sp": "São Paulo - SP",
        "florianópolis": "Florianópolis - SC", "floripa": "Florianópolis - SC",
        "belo horizonte": "Belo Horizonte - MG", "bh": "Belo Horizonte - MG",
        "rio de janeiro": "Rio de Janeiro - RJ",
        "brasília": "Brasília - DF", "brasilia": "Brasília - DF",
        "campinas": "Campinas - SP", "goiânia": "Goiânia - GO",
        "salvador": "Salvador - BA", "recife": "Recife - PE",
        "fortaleza": "Fortaleza - CE", "manaus": "Manaus - AM",
        "ribeirão preto": "Ribeirão Preto - SP", "sorocaba": "Sorocaba - SP",
        "joinville": "Joinville - SC", "londrina": "Londrina - PR",
        "maringá": "Maringá - PR", "santos": "Santos - SP",
        "alphaville": "Alphaville - SP", "granja viana": "Granja Viana - SP",
    }
    for kw, cidade_full in cidades_map.items():
        if kw in all_text:
            info["cidade"] = cidade_full
            break

    # Se não encontrou na lista, tenta padrão "em CIDADE" ou "cidade: CIDADE"
    if "cidade" not in info:
        m = re.search(r"(?:em |cidade[: ]+|estado[: ]+|projeto.{0,20}em )([A-ZÁÉÍÓÚ][a-záéíóúâêîôûãõç]+(?:[\s-]+[A-ZÁÉÍÓÚ]?[a-záéíóúâêîôûãõç]+)*)", all_text_raw)
        if m and len(m.group(1)) > 3:
            info["cidade"] = m.group(1).strip()

    # Metragem — números seguidos de m², m2, metros quadrados
    m2_match = re.search(r"(\d+(?:[.,]\d+)?)\s*(?:m2|m²|metros?\s*quadrados?|metros)", all_text)
    if m2_match:
        val = float(m2_match.group(1).replace(",", "."))
        info["metragem_estimada"] = f"{val} m²"
        info["area_m2"] = val

    # Tipo de produto
    produtos = {
        "Piso": ["piso", "assoalho", "taco", "piso de madeira", "piso chevron"],
        "Forro": ["forro", "teto de madeira", "forro de madeira"],
        "Deck": ["deck", "pergolado", "deck de madeira"],
        "Painel": ["painel", "revestimento de parede", "painel de madeira"],
        "Porta": ["porta", "pivotante", "porta de madeira"],
        "Piso e Forro": ["piso e forro", "piso, forro"],
        "Marcenaria": ["marcenaria", "móveis", "moveis", "armário"],
    }
    found_products = []
    for tipo, keywords in produtos.items():
        if any(kw in all_text for kw in keywords):
            found_products.append(tipo)
    if found_products:
        info["produto_interesse"] = ", ".join(found_products)

    # Tipo de relação com a obra
    if any(kw in all_text for kw in ["arquiteto", "arquiteta", "escritório de arquitetura", "escritorio de arquitetura"]):
        info["relacao_obra"] = "Arquiteto(a)"
    elif any(kw in all_text for kw in ["designer", "design de interiores"]):
        info["relacao_obra"] = "Designer de Interiores"
    elif any(kw in all_text for kw in ["incorporadora", "construtora", "incorporação"]):
        info["relacao_obra"] = "Incorporadora / Construtora"
    elif any(kw in all_text for kw in ["uso próprio", "próprio", "minha casa", "meu apartamento", "meu ap", "pra mim"]):
        info["relacao_obra"] = "Uso Próprio"

    # Escritório / empresa do arquiteto
    esc_match = re.search(r"(?:escritório|escritorio|empresa)[: ]+([A-ZÁÉÍÓÚ][^\n,.]{3,40})", all_text_raw, re.IGNORECASE)
    if esc_match:
        info["escritorio_empresa"] = esc_match.group(1).strip()

    # Faixa de investimento
    inv_patterns = [
        r"(?:investir|investimento|gastar|budget|verba|orçamento)[^0-9]{0,30}(?:R\$\s*)?(\d[\d.,]*(?:\s*(?:mil|k|reais|R\$))?)",
        r"(?:R\$\s*)(\d[\d.,]*(?:\s*(?:mil|k))?)",
        r"(\d+)\s*(?:mil|k)\s*(?:reais)?",
    ]
    for p in inv_patterns:
        m = re.search(p, all_text, re.IGNORECASE)
        if m:
            raw = m.group(1).replace(".", "").replace(",", ".")
            try:
                val = float(re.search(r"[\d.]+", raw).group())
                if "mil" in all_text[m.start():m.end()+10] or "k" in all_text[m.start():m.end()+5]:
                    val *= 1000
                info["faixa_investimento"] = f"R$ {val:,.0f}".replace(",", ".")
            except Exception:
                info["faixa_investimento"] = m.group(0).strip()
            break

    # Previsão de instalação
    prazo_patterns = [
        r"(?:previsão|previsao|prazo|início|inicio|instalar|instalação)[^.]{0,30}(\d+\s*(?:meses?|semanas?|dias?))",
        r"(?:daqui|em)\s+(\d+\s*(?:meses?|semanas?|dias?))",
        r"(janeiro|fevereiro|março|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro)(?:\s*(?:de\s+)?(\d{4}))?",
    ]
    for p in prazo_patterns:
        m = re.search(p, all_text)
        if m:
            info["previsao_instalacao"] = m.group(0).strip().title()
            break

    # Preferência estética de madeira (Passo 8)
    madeiras = {
        "carvalho": "Carvalho", "cumaru": "Cumaru", "tauari": "Tauari",
        "ipê": "Ipê", "ipe": "Ipê", "jatobá": "Jatobá", "jatoba": "Jatobá",
        "nogueira": "Nogueira", "freijó": "Freijó", "freijo": "Freijó",
        "muiracatiara": "Muiracatiara", "amendoim": "Amendoim",
    }
    tons = {
        "claro": "Tom claro", "escuro": "Tom escuro", "natural": "Tom natural",
        "acinzentado": "Tom acinzentado", "mel": "Tom mel", "dourado": "Tom dourado",
        "avermelhado": "Tom avermelhado", "castanho": "Tom castanho",
    }
    prefs = []
    for kw, label in madeiras.items():
        if kw in all_text:
            prefs.append(label)
    for kw, label in tons.items():
        if kw in all_text:
            prefs.append(label)
    if prefs:
        info["preferencia_madeira"] = ", ".join(prefs)

    # Nome do contato / como prefere ser chamado
    chamado_match = re.search(r"(?:pode me chamar de |meu nome é |me chamo |sou a |sou o )([A-ZÁÉÍÓÚÂÊÎÔÛÃÕÇ][a-záéíóúâêîôûãõç]+(?:\s+[A-ZÁÉÍÓÚÂÊÎÔÛÃÕÇ]?[a-záéíóúâêîôûãõç]+)*)", all_text_raw)
    if chamado_match:
        info["nome"] = chamado_match.group(1).strip()

    # Celular/telefone extra mencionado na conversa
    tel_match = re.search(r"(\(?0?\d{2}\)?\s?\d{4,5}[\s.-]?\d{4})", all_text)
    if tel_match:
        info["telefone_extra"] = tel_match.group(1).strip()

    return info


async def notify_comercial_group(card: dict, tipo: str, evolution_client):
    """Envia notificação para o grupo comercial."""
    det = card.get("details", {}) or {}
    nome = det.get("nome") or card.get("title", "Lead")
    celular = det.get("celular", "")
    cidade = det.get("cidade", "")
    produto = det.get("produto_interesse", "")
    area = det.get("area_m2", 0)
    qualificacao = classificar_lead(area) if area else {"nivel": "?", "label": "Sem info", "emoji": "❓"}
    etapa = det.get("teka_etapa", "")

    if tipo == "nova_oportunidade":
        msg = (
            f"🎯 *NOVA OPORTUNIDADE — TEKA IA*\n\n"
            f"👤 *{nome}*\n"
            f"📱 {celular}\n"
            f"📍 {cidade or 'Não informou'}\n"
            f"🏗 Produto: {produto or 'Não informou'}\n"
            f"📐 Área: {area or '?'} m²\n\n"
            f"{qualificacao['emoji']} *Nível {qualificacao['nivel']}* — {qualificacao['label']}\n\n"
            f"✅ Lead qualificado pela TEKA e pronto para atendimento.\n"
            f"Card movido para *Novas Oportunidades*.\n\n"
            f"📋 O lead agora está com o agente comercial do Parket AI."
        )
    elif tipo == "em_qualificacao":
        msg = (
            f"📋 *LEAD TRANSFERIDO PARA ATENDENTE — TEKA IA*\n\n"
            f"👤 *{nome}*\n"
            f"📱 {celular}\n"
            f"📍 {cidade or 'Não informou'}\n"
            f"🏗 Produto: {produto or 'Não informou'}\n\n"
            f"Etapa: *{etapa}*\n"
            f"Card movido para *Em Qualificação*.\n\n"
            f"⚠️ O lead agora está com o agente comercial do Parket AI.\n"
            f"Um atendente precisa assumir essa conversa."
        )
    else:
        return

    # O grupo comercial vive no WhatsApp da instância padrão (Parket). Forçamos
    # o cliente global aqui porque callers que vêm do funil comercial passam o
    # cliente da instância "Comercial - Parket", que não é membro desse grupo.
    from app.core.evolution_client import evolution_client as _default_client
    try:
        await _default_client.send_text(COMERCIAL_GROUP_ID, msg)
        logger.info("teka_notificou_grupo", tipo=tipo, nome=nome)
    except Exception as e:
        logger.error("teka_notificacao_falhou: %s", str(e))


async def handle_followup_timeout(card_id: str, supabase_client, evolution_client):
    """Chamado pelo scheduler quando follow-up expira sem resposta."""
    card_resp = supabase_client.table("kanban_cards").select("*").eq("id", card_id).single().execute()
    if not card_resp.data:
        return

    card = card_resp.data
    det = card.get("details", {}) or {}
    phone = det.get("celular", "")
    followup_count = det.get("teka_followup_count", 0)

    if not await is_teka_active(card):
        return

    if followup_count == 0:
        # Primeiro follow-up (30 min sem resposta)
        # Agendar próximo para 3h
        await update_card_details(card_id, {
            "teka_followup_count": 1,
            "teka_followup_1": datetime.now(SP_TZ).isoformat(),
        }, supabase_client)
        # Mensagem de follow-up será enviada pelo agente
        return "followup_1"

    elif followup_count == 1:
        # Segundo follow-up (3h sem resposta)
        # Agendar timeout final para 10 min
        await update_card_details(card_id, {
            "teka_followup_count": 2,
            "teka_followup_2": datetime.now(SP_TZ).isoformat(),
        }, supabase_client)
        return "followup_2"

    elif followup_count >= 2:
        # Timeout final (10 min sem resposta após 2º follow-up)
        # Move para Em Qualificação e notifica grupo
        await move_card(card_id, COL_EM_QUALIFICACAO, supabase_client)
        await update_card_details(card_id, {
            "teka_ativa": False,
            "teka_etapa": "timeout_followup",
            "teka_encerrado": datetime.now(SP_TZ).isoformat(),
        }, supabase_client)
        await notify_comercial_group(card, "em_qualificacao", evolution_client)
        return "timeout"


async def escalate_to_human(card_id: str, motivo: str, supabase_client, evolution_client):
    """Escalação de conflito — move card para Em Qualificação e desativa TEKA."""
    card_resp = supabase_client.table("kanban_cards").select("*").eq("id", card_id).single().execute()
    if not card_resp.data:
        return

    card = card_resp.data
    det = card.get("details", {}) or {}

    # Move para Em Qualificação
    await move_card(card_id, COL_EM_QUALIFICACAO, supabase_client)
    await update_card_details(card_id, {
        "teka_ativa": False,
        "teka_followup_count": -1,
        "teka_etapa": "escalado_humano",
        "teka_encerrado": datetime.now(SP_TZ).isoformat(),
        "status_lead": "escalado_atendente",
        "motivo_escalacao": motivo,
    }, supabase_client)

    # Notifica grupo comercial
    nome = det.get("nome") or card.get("title", "Lead")
    celular = det.get("celular", "")
    cidade = det.get("cidade", "")
    msg = (
        f"🚨 *ESCALAÇÃO PARA ATENDENTE — TEKA IA*\n\n"
        f"👤 *{nome}*\n"
        f"📱 {celular}\n"
        f"📍 {cidade or 'Não informou'}\n\n"
        f"⚠️ *Motivo:* {motivo}\n\n"
        f"Card movido para *Em Qualificação*.\n\n"
        f"O lead agora está com o agente comercial do Parket AI.\n"
        f"Um atendente precisa assumir essa conversa."
    )
    # Grupo comercial pertence à instância padrão (Parket) — ver nota em notify_comercial_group.
    from app.core.evolution_client import evolution_client as _default_client
    try:
        await _default_client.send_text(COMERCIAL_GROUP_ID, msg)
        logger.info("teka_escalacao_notificada", nome=nome, motivo=motivo)
    except Exception as e:
        logger.error("teka_escalacao_notificacao_falhou: %s", str(e))


async def qualify_and_move(card_id: str, qualified: bool, supabase_client, evolution_client):
    """Move card baseado na qualificação e notifica grupo."""
    card_resp = supabase_client.table("kanban_cards").select("*").eq("id", card_id).single().execute()
    if not card_resp.data:
        return

    card = card_resp.data

    if qualified:
        # Move pra "Qualificado pela IA" (qualificado-ia) — coluna onde o
        # comercial vê leads prontos pra abordagem humana. A coluna humana
        # "qualificado" fica reservada pra quando o vendedor confirmar.
        await move_card(card_id, COL_QUALIFICADO_IA, supabase_client)
        await update_card_details(card_id, {
            "teka_ativa": False,
            "teka_followup_count": -1,
            "teka_etapa": "qualificado",
            "teka_encerrado": datetime.now(SP_TZ).isoformat(),
            "status_lead": "qualificado_ia",
        }, supabase_client)
        await notify_comercial_group(card, "nova_oportunidade", evolution_client)
    else:
        # Move para Em Qualificação, desativa TEKA e follow-up
        await move_card(card_id, COL_EM_QUALIFICACAO, supabase_client)
        await update_card_details(card_id, {
            "teka_ativa": False,
            "teka_followup_count": -1,
            "teka_etapa": "nao_qualificado",
            "teka_encerrado": datetime.now(SP_TZ).isoformat(),
            "status_lead": "em_qualificacao",
        }, supabase_client)
        await notify_comercial_group(card, "em_qualificacao", evolution_client)


async def notify_lembrete_agendado(card: dict, lembrete_data: str, lembrete_hora: str, evolution_client):
    """Envia notificação ao grupo comercial quando um lembrete é agendado."""
    det = card.get("details", {}) or {}
    nome = det.get("nome") or card.get("title", "Lead")
    celular = det.get("celular", "")
    cidade = det.get("cidade", "")

    msg = (
        f"📅 *LEMBRETE AGENDADO — COMERCIAL*\n\n"
        f"👤 *{nome}*\n"
        f"📱 {celular}\n"
        f"📍 {cidade or 'Não informou'}\n\n"
        f"🗓 *Data:* {lembrete_data}\n"
        f"⏰ *Hora:* {lembrete_hora}\n\n"
        f"Card movido para *Lembretes*.\n"
        f"Você será notificado no dia e hora agendados."
    )
    from app.core.evolution_client import evolution_client as _default_client
    try:
        await _default_client.send_text(COMERCIAL_GROUP_ID, msg)
        logger.info("lembrete_agendado_notificado", nome=nome, data=lembrete_data, hora=lembrete_hora)
    except Exception as e:
        logger.error("lembrete_agendado_notificacao_falhou: %s", str(e))


async def notify_lembrete_vencido(card: dict, evolution_client):
    """Envia alerta ao grupo comercial quando chega a hora do lembrete."""
    det = card.get("details", {}) or {}
    nome = det.get("nome") or card.get("title", "Lead")
    celular = det.get("celular", "")
    cidade = det.get("cidade", "")
    produto = det.get("produto_interesse", "")
    area = det.get("area_m2", 0)
    qualificacao = classificar_lead(area) if area else {"nivel": "?", "label": "Sem info", "emoji": "❓"}
    observacao = det.get("lembrete_observacao", "")

    msg = (
        f"🔔 *ALERTA DE LEMBRETE — HORA DE ENTRAR EM CONTATO!*\n\n"
        f"👤 *{nome}*\n"
        f"📱 {celular}\n"
        f"📍 {cidade or 'Não informou'}\n"
        f"🏗 Produto: {produto or 'Não informou'}\n"
        f"📐 Área: {area or '?'} m²\n"
        f"{qualificacao['emoji']} *Nível {qualificacao['nivel']}* — {qualificacao['label']}\n"
    )
    if observacao:
        msg += f"\n📝 *Obs:* {observacao}\n"
    msg += (
        f"\n⚡ *Entrar em contato AGORA com o cliente!*\n"
        f"O lembrete agendado chegou ao horário."
    )

    from app.core.evolution_client import evolution_client as _default_client
    try:
        await _default_client.send_text(COMERCIAL_GROUP_ID, msg)
        logger.info("lembrete_vencido_notificado", nome=nome)
    except Exception as e:
        logger.error("lembrete_vencido_notificacao_falhou: %s", str(e))
