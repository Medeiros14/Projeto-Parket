"""
Agente Analisador TEKA — Extração inteligente de dados do card
================================================================
Trabalha em paralelo com a TEKA. Após cada interação com o cliente,
analisa toda a conversa e extrai informações estruturadas para
preencher o card no kanban do comercial.

Usa o LLM para entender contexto, não regex.
"""
import json
import structlog
from app.core.account_pool import account_pool
from app.database import AsyncSessionLocal

logger = structlog.get_logger(__name__)

ANALYZER_PROMPT = """Você é um analisador de conversas comerciais da Parket. Sua função é ler a conversa entre a Teca (atendente) e o cliente, e extrair todas as informações relevantes em formato JSON.

Analise a conversa abaixo e retorne APENAS um JSON válido com os campos preenchidos. Se uma informação não foi mencionada, use null.

Campos para extrair:
- nome: nome do cliente (como ele se apresentou ou nome do WhatsApp)
- produto_interesse: o que busca (piso, forro, deck, painel, porta, escada, fachada). Se mencionou mais de um, separe por vírgula
- relacao_obra: "Uso Próprio", "Arquiteto(a)", "Designer de Interiores", "Incorporadora / Construtora"
- escritorio_empresa: nome do escritório ou empresa (se arquiteto/designer/incorporadora)
- cidade: cidade e estado do projeto
- metragem_estimada: metragem informada (ex: "80 m²", "aproximadamente 120 m²")
- area_m2: valor numérico da metragem (ex: 80, 120). Se não informou, null
- faixa_investimento: faixa de investimento mencionada
- previsao_instalacao: quando pretende instalar
- preferencia_madeira: preferência de tipo ou tom de madeira
- resumo_qualificacao: resumo de 2 frases sobre o perfil do cliente e o que busca
- nivel_lead: classificar como "A" (>=1000m²), "B" (>=500m²), "C" (>=100m²), "D" (<100m²). Se não sabe a metragem, "Sem info"
- etapa_conversa: em qual etapa a conversa está (saudacao, produto, relacao, cidade, metragem, investimento, prazo, preferencia, encerrado)
- status_lead: "em_qualificacao" se ainda conversando, "qualificado" se completou todas as etapas

Retorne SOMENTE o JSON, sem explicação, sem markdown, sem ```json```.
"""


async def analyze_conversation(card_id: str, messages: list[dict], client_name: str, supabase_client):
    """
    Analisa a conversa completa e atualiza o card com dados extraídos pelo LLM.
    Chamado após cada resposta da TEKA.
    """
    if not messages or len(messages) < 2:
        return

    # Monta o texto da conversa para o LLM
    conversa_text = ""
    for m in messages:
        de = m.get("de", "?")
        texto = m.get("texto", "")
        if de == "teka":
            conversa_text += f"Teca: {texto}\n\n"
        else:
            nome = m.get("nome", client_name or "Cliente")
            conversa_text += f"Cliente ({nome}): {texto}\n\n"

    full_prompt = f"{ANALYZER_PROMPT}\n\nCONVERSA:\n{conversa_text}"

    try:
        async with AsyncSessionLocal() as db:
            # Usa o account_pool para chamar o LLM
            response = await account_pool.chat(
                db=db,
                messages=[{"role": "user", "content": full_prompt}],
                system_prompt="Você retorna apenas JSON válido. Sem explicação.",
            )

        if not response:
            logger.warning("teka_analyzer_no_response", card_id=card_id)
            return

        # Parse JSON da resposta
        response = response.strip()
        # Remove markdown code blocks se houver
        if response.startswith("```"):
            response = response.split("\n", 1)[1] if "\n" in response else response[3:]
        if response.endswith("```"):
            response = response[:-3]
        response = response.strip()

        data = json.loads(response)
        logger.info("teka_analyzer_extracted", card_id=card_id, fields=list(data.keys()))

        # Monta update para o card
        update_fields = {}
        FIELD_MAP = {
            "nome": "nome",
            "produto_interesse": "produto_interesse",
            "relacao_obra": "relacao_obra",
            "escritorio_empresa": "escritorio_empresa",
            "cidade": "cidade",
            "metragem_estimada": "metragem_estimada",
            "area_m2": "area_m2",
            "faixa_investimento": "faixa_investimento",
            "previsao_instalacao": "previsao_instalacao",
            "preferencia_madeira": "preferencia_madeira",
            "resumo_qualificacao": "resumo_qualificacao",
            "nivel_lead": "nivel_lead",
            "etapa_conversa": "etapa_conversa",
            "status_lead": "status_lead",
        }

        for src, dest in FIELD_MAP.items():
            val = data.get(src)
            if val is not None:
                update_fields[dest] = val

        if not update_fields:
            return

        # Atualiza o card no Supabase
        # Rejeitar nomes que são a própria empresa / equipe — Claude confundia
        # a assinatura das mensagens do grupo WhatsApp da Parket com o nome
        # do cliente (Will 28/08: 319 cards viraram title='Parket' num batch só).
        _NOME_BLACKLIST = {
            "parket", "parket ia", "parket ai", "parket comercial", "parket sdr",
            "atendimento parket", "comercial parket", "vendedor parket",
            "vinicius", "vinicius arruda", "rafael", "rafael calazans",
            "douglas", "murilo", "cliente", "lead", "contato",
        }
        raw_nome = update_fields.get("nome")
        if raw_nome and (raw_nome.strip().lower() in _NOME_BLACKLIST
                          or "parket" in raw_nome.strip().lower()):
            logger.warning("teka_analyzer_nome_bloqueado", card_id=card_id, nome=raw_nome)
            update_fields.pop("nome", None)

        existing = supabase_client.table("kanban_cards").select("details,title").eq("id", card_id).single().execute()
        current_det = (existing.data or {}).get("details", {}) or {}
        merged = {**current_det, **update_fields}

        card_update = {"details": merged}

        # Atualiza título do card com nome do cliente se descobriu.
        # Só sobrescreve quando o title ainda é um placeholder — nome real
        # digitado por SDR/vendedor NÃO deve ser substituído por LLM.
        nome = update_fields.get("nome")  # já saneado pela blacklist acima
        current_title = (existing.data or {}).get("title", "")
        placeholder = (
            not current_title
            or current_title.startswith("Lead WhatsApp")
            or current_title.startswith("Lead SDR")
            or current_title.startswith("WhatsApp +")
            or current_title == nome
        )
        if nome and placeholder:
            card_update["title"] = nome

        supabase_client.table("kanban_cards").update(card_update).eq("id", card_id).execute()
        logger.info("teka_analyzer_card_updated", card_id=card_id, fields_updated=list(update_fields.keys()))

        # Se o analisador detectou que a conversa encerrou e o lead está qualificado, move o card
        # Mas só se os campos essenciais do formulário da Teka foram preenchidos
        status = data.get("status_lead", "")
        etapa = data.get("etapa_conversa", "")
        REQUIRED_FIELDS = ["nome", "produto_interesse", "cidade", "metragem_estimada"]
        fields_filled = sum(1 for f in REQUIRED_FIELDS if data.get(f) and data.get(f) != "null")
        if fields_filled < len(REQUIRED_FIELDS):
            # Formulário incompleto — forçar status pra em_qualificacao
            if status == "qualificado":
                status = "em_qualificacao"
                logger.info("teka_analyzer_incomplete_form", card_id=card_id,
                            filled=fields_filled, required=len(REQUIRED_FIELDS),
                            missing=[f for f in REQUIRED_FIELDS if not data.get(f) or data.get(f) == "null"])
        if status == "qualificado" or etapa == "encerrado":
            from app.core.teka_agent import (
                COL_NOVAS_OPORTUNIDADES, COL_QUALIFICADO_IA, TEKA_STOP_COLUMNS,
                notify_comercial_group,
            )
            from app.core.evolution_client import evolution_client
            from datetime import datetime
            from zoneinfo import ZoneInfo

            # Verifica coluna atual — só move se ainda está em qualificação IA
            current = supabase_client.table("kanban_cards").select("column_id").eq("id", card_id).single().execute()
            current_col = (current.data or {}).get("column_id", "")
            if current_col not in TEKA_STOP_COLUMNS:
                supabase_client.table("kanban_cards").update({
                    "column_id": COL_QUALIFICADO_IA,
                    "details": {
                        **merged,
                        "teka_ativa": False,
                        "teka_followup_count": -1,
                        "teka_etapa": "qualificado",
                        "teka_encerrado": datetime.now(ZoneInfo("America/Sao_Paulo")).isoformat(),
                        "status_lead": "qualificado_ia",
                    },
                }).eq("id", card_id).execute()

                # Notifica grupo comercial
                card_data = supabase_client.table("kanban_cards").select("*").eq("id", card_id).single().execute()
                if card_data.data:
                    await notify_comercial_group(card_data.data, "nova_oportunidade", evolution_client)

                logger.info("teka_analyzer_qualified_moved", card_id=card_id)

        # Se o analisador detectou status "em_qualificacao" (lead desistiu/não respondeu)
        elif status == "nao_qualificado":
            from app.core.teka_agent import COL_EM_QUALIFICACAO, TEKA_STOP_COLUMNS, notify_comercial_group
            from app.core.evolution_client import evolution_client
            from datetime import datetime
            from zoneinfo import ZoneInfo

            current = supabase_client.table("kanban_cards").select("column_id").eq("id", card_id).single().execute()
            current_col = (current.data or {}).get("column_id", "")
            if current_col not in TEKA_STOP_COLUMNS:
                supabase_client.table("kanban_cards").update({
                    "column_id": COL_EM_QUALIFICACAO,
                    "details": {
                        **merged,
                        "teka_ativa": False,
                        "teka_followup_count": -1,
                        "teka_etapa": "nao_qualificado",
                        "teka_encerrado": datetime.now(ZoneInfo("America/Sao_Paulo")).isoformat(),
                        "status_lead": "em_qualificacao",
                    },
                }).eq("id", card_id).execute()

                card_data = supabase_client.table("kanban_cards").select("*").eq("id", card_id).single().execute()
                if card_data.data:
                    await notify_comercial_group(card_data.data, "em_qualificacao", evolution_client)

                logger.info("teka_analyzer_not_qualified_moved", card_id=card_id)

    except json.JSONDecodeError as e:
        logger.warning("teka_analyzer_json_error", card_id=card_id, error=str(e), response=response[:200])
    except Exception as e:
        logger.error("teka_analyzer_error", card_id=card_id, error=str(e), exc_info=True)
