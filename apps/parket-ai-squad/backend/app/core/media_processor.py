"""
Media Processor — Parket AI Squad
===================================
Pipeline para processar todos os tipos de mídia recebidos via WhatsApp:
  - Áudio  → transcrição via Whisper (OpenAI)
  - Imagem → descrição via Claude Vision
  - Documento (PDF/DOCX) → extração de texto
  - Vídeo  → extrai áudio e transcreve
  - Sticker → identificado como figurinha

Fluxo:
  1. Evolution API envia webhook com metadados da mídia
  2. download_media() baixa o arquivo via API
  3. Handler específico processa o arquivo
  4. Retorna texto que é injetado na mensagem para o agente
"""

import base64
import io
import os
import tempfile
import structlog
import httpx

from app.config import settings

logger = structlog.get_logger(__name__)

EVOLUTION_BASE = settings.EVOLUTION_API_URL.rstrip("/")
EVOLUTION_INSTANCE = settings.EVOLUTION_INSTANCE
EVOLUTION_HEADERS = {"apikey": settings.EVOLUTION_API_KEY}


def _instance_creds(source_instance: str) -> tuple[str, dict]:
    """getBase64FromMediaMessage só funciona na instância que RECEBEU a mensagem.
    Leads chegam pela Comercial; usar a instância default 'Parket' falha o download."""
    if source_instance and source_instance == settings.EVOLUTION_COMERCIAL_INSTANCE:
        return (settings.EVOLUTION_COMERCIAL_INSTANCE,
                {"apikey": settings.EVOLUTION_COMERCIAL_API_KEY})
    if source_instance and source_instance == settings.EVOLUTION_SECRETARIA_INSTANCE:
        return (settings.EVOLUTION_SECRETARIA_INSTANCE,
                {"apikey": settings.EVOLUTION_SECRETARIA_API_KEY})
    return EVOLUTION_INSTANCE, EVOLUTION_HEADERS


# ─── DOWNLOAD DE MÍDIA ────────────────────────────────────────────────────────

async def download_media(message_obj: dict, message_data: dict | None = None,
                         source_instance: str = "") -> bytes | None:
    """
    Baixa o arquivo de mídia via Evolution API getBase64FromMediaMessage.
    message_data: o objeto data completo do webhook (contém key com remoteJid e id).
    source_instance: instância Evolution que recebeu a mensagem (payload._source_instance).
    """
    instance, headers = _instance_creds(source_instance)
    # Tentativa 1: Evolution API getBase64FromMediaMessage com payload correto
    try:
        async with httpx.AsyncClient(timeout=60.0) as client:
            # Payload com a estrutura completa da mensagem (key + message)
            if message_data:
                payload = {"message": message_data, "convertToMp4": False}
            else:
                payload = {"message": {"key": {}, "message": message_obj}, "convertToMp4": False}

            resp = await client.post(
                f"{EVOLUTION_BASE}/chat/getBase64FromMediaMessage/{instance}",
                headers={**headers, "Content-Type": "application/json"},
                json=payload,
            )
            logger.info("media_download_api_response", status=resp.status_code,
                        instance=instance, body_preview=resp.text[:200])
            if resp.status_code < 300:
                data = resp.json()
                b64 = data.get("base64") or data.get("data", "")
                if b64:
                    if "," in b64:
                        b64 = b64.split(",", 1)[1]
                    decoded = base64.b64decode(b64)
                    logger.info("media_download_ok", bytes_size=len(decoded))
                    return decoded
    except Exception as e:
        logger.warning("media_download_base64_failed", error=str(e))

    # Tentativa 2: download direto da URL pública (CDN WhatsApp — pode ser criptografada)
    try:
        for key in ["audioMessage", "imageMessage", "documentMessage", "videoMessage"]:
            if key in message_obj:
                url = message_obj[key].get("url", "")
                if url and url.startswith("http"):
                    async with httpx.AsyncClient(timeout=60.0) as client:
                        resp = await client.get(url, headers=headers)
                        if resp.status_code == 200:
                            logger.info("media_download_direct_ok", bytes_size=len(resp.content))
                            return resp.content
    except Exception as e:
        logger.warning("media_download_direct_failed", error=str(e))

    return None


# ─── TRANSCRIÇÃO DE ÁUDIO ────────────────────────────────────────────────────

def _normalize_mime(mime_type: str) -> str:
    """Extrai o tipo base do mime, ignorando parâmetros como '; codecs=opus'."""
    return mime_type.split(";")[0].strip().lower()


def _convert_to_wav(src_path: str) -> str | None:
    """
    Converte áudio para WAV usando ffmpeg.
    Retorna caminho do arquivo WAV temporário ou None se falhar.
    Groq Whisper não aceita OGG/Opus — precisa de conversão.
    """
    import subprocess
    wav_path = src_path + ".wav"
    try:
        result = subprocess.run(
            ["ffmpeg", "-y", "-i", src_path, "-ar", "16000", "-ac", "1", "-f", "wav", wav_path],
            capture_output=True, timeout=30,
        )
        if result.returncode == 0:
            return wav_path
        logger.warning("ffmpeg_convert_failed", stderr=result.stderr.decode()[:200])
    except Exception as e:
        logger.warning("ffmpeg_not_available", error=str(e))
    return None


async def transcribe_audio(audio_bytes: bytes, mime_type: str = "audio/ogg") -> str:
    """
    Transcreve áudio.
    Prioridade: parket-whisper self-hosted → Groq Whisper → Gemini 2.5 Flash → OpenAI Whisper
    """
    base_mime = _normalize_mime(mime_type)

    whisper_url = (getattr(settings, "WHISPER_URL", "") or "").rstrip("/")
    groq_key   = getattr(settings, "GROQ_API_KEY", "")   or os.environ.get("GROQ_API_KEY", "")
    gemini_key = getattr(settings, "GEMINI_API_KEY", "") or os.environ.get("GEMINI_API_KEY", "")
    openai_key = getattr(settings, "OPENAI_API_KEY", "") or os.environ.get("OPENAI_API_KEY", "")

    ext_map = {
        "audio/ogg": "ogg", "audio/mpeg": "mp3", "audio/mp4": "mp4",
        "audio/wav": "wav", "audio/x-m4a": "m4a", "audio/webm": "webm",
        "video/mp4": "mp4",
    }
    ext = ext_map.get(base_mime, "ogg")

    # parket-whisper self-hosted — primário (sem custo por request)
    if whisper_url:
        try:
            logger.info("whisper_local_send", bytes_size=len(audio_bytes), mime=base_mime)
            files = {"file": (f"audio.{ext}", audio_bytes, base_mime or "audio/ogg")}
            async with httpx.AsyncClient(timeout=60.0) as client:
                resp = await client.post(
                    f"{whisper_url}/transcribe",
                    files=files, data={"language": "pt"},
                )
            if resp.status_code < 300:
                text = (resp.json().get("text") or "").strip()
                if text:
                    logger.info("audio_transcribed_whisper_local", chars=len(text))
                    return f"[Áudio transcrito]: {text}"
                logger.warning("whisper_local_empty")
            else:
                logger.warning("whisper_local_failed", status=resp.status_code, body=resp.text[:200])
        except Exception as e:
            logger.warning("whisper_local_failed", error=str(e))

    # Groq Whisper — fallback 1 (rápido + barato, aceita opus/ogg nativos)
    if groq_key:
        try:
            logger.info("groq_audio_send", bytes_size=len(audio_bytes), mime=base_mime)
            files = {"file": (f"audio.{ext}", audio_bytes, base_mime or "audio/ogg")}
            data = {"model": "whisper-large-v3-turbo", "language": "pt", "response_format": "text"}
            async with httpx.AsyncClient(timeout=60.0) as client:
                resp = await client.post(
                    "https://api.groq.com/openai/v1/audio/transcriptions",
                    headers={"Authorization": f"Bearer {groq_key}"},
                    files=files, data=data,
                )
            if resp.status_code < 300:
                text = resp.text.strip()
                if text:
                    logger.info("audio_transcribed_groq", chars=len(text))
                    return f"[Áudio transcrito]: {text}"
                logger.warning("groq_transcription_empty")
            else:
                logger.warning("groq_transcription_failed", status=resp.status_code, body=resp.text[:200])
        except Exception as e:
            logger.warning("groq_transcription_failed", error=str(e))

    # Gemini — envia OGG/Opus diretamente (suporte nativo)
    if gemini_key:
        try:
            from google import genai as google_genai
            from google.genai import types as genai_types

            client = google_genai.Client(api_key=gemini_key)
            send_mime = base_mime or "audio/ogg"
            logger.info("gemini_audio_send", bytes_size=len(audio_bytes), mime=send_mime)
            audio_part = genai_types.Part(
                inline_data=genai_types.Blob(mime_type=send_mime, data=audio_bytes)
            )
            text_part = genai_types.Part(text="Transcreva o áudio a seguir em português brasileiro. Retorne apenas o texto transcrito, sem introduções ou comentários.")
            response = client.models.generate_content(
                model="gemini-2.5-flash",
                contents=[genai_types.Content(parts=[audio_part, text_part], role="user")],
            )
            text = (response.text or "").strip()
            if text:
                logger.info("audio_transcribed_gemini", chars=len(text))
                return f"[Áudio transcrito]: {text}"
            logger.warning("gemini_transcription_empty")
        except Exception as e:
            logger.warning("gemini_transcription_failed", error=str(e))

    # OpenAI Whisper — fallback
    if openai_key:
        with tempfile.NamedTemporaryFile(suffix=f".{ext}", delete=False) as tmp:
            tmp.write(audio_bytes)
            tmp_path = tmp.name
        try:
            from openai import AsyncOpenAI
            client = AsyncOpenAI(api_key=openai_key)
            with open(tmp_path, "rb") as f:
                transcript = await client.audio.transcriptions.create(
                    model="whisper-1", file=f, language="pt", response_format="text",
                )
            text = transcript.strip() if isinstance(transcript, str) else str(transcript)
            logger.info("audio_transcribed_openai", chars=len(text))
            return f"[Áudio transcrito]: {text}"
        except Exception as e:
            logger.warning("openai_whisper_failed", error=str(e))
        finally:
            try:
                os.unlink(tmp_path)
            except Exception:
                pass

    logger.warning("audio_transcription_no_key")
    return "[Áudio recebido — transcrição não disponível]"


# ─── ANÁLISE DE IMAGEM ───────────────────────────────────────────────────────

async def describe_image(image_bytes: bytes, caption: str = "", mime_type: str = "image/jpeg") -> str:
    """
    Descreve o conteúdo de uma imagem usando Claude Vision via account_pool (OAuth).
    Não requer ANTHROPIC_API_KEY — usa as contas OAuth já configuradas no sistema.
    """
    try:
        from app.database import AsyncSessionLocal
        from app.core.account_pool import account_pool

        b64_image = base64.b64encode(image_bytes).decode("utf-8")
        media_type = mime_type if mime_type.startswith("image/") else "image/jpeg"

        prompt_text = "Descreva o conteúdo desta imagem em detalhes, de forma objetiva e completa. Responda em português."
        if caption:
            prompt_text += f" O usuário adicionou a legenda: '{caption}'."

        # Mensagem com conteúdo multimodal (texto + imagem)
        messages = [{
            "role": "user",
            "content": [
                {"type": "image", "source": {"type": "base64", "media_type": media_type, "data": b64_image}},
                {"type": "text", "text": prompt_text},
            ],
        }]

        async with AsyncSessionLocal() as db:
            desc = await account_pool.chat(db=db, messages=messages, system_prompt="Você é um assistente especialista em análise de imagens.")

        logger.info("image_described", chars=len(desc))
        result = f"[Imagem analisada]: {desc}"
        if caption:
            result = f"[Legenda da imagem]: {caption}\n{result}"
        return result

    except Exception as e:
        logger.error("image_description_failed", error=str(e))
        if caption:
            return f"[Imagem recebida com legenda]: {caption}"
        return "[Imagem recebida — não foi possível analisar]"


# ─── EXTRAÇÃO DE DOCUMENTO ───────────────────────────────────────────────────

async def extract_document_text(doc_bytes: bytes, file_name: str = "", mime_type: str = "", caption: str = "") -> str:
    """
    Extrai texto de documentos: PDF, DOCX, TXT, CSV.
    Para PDFs com imagens, tenta OCR via Claude Vision.
    """
    name_lower = (file_name or "").lower()
    text = ""

    try:
        # PDF
        if mime_type == "application/pdf" or name_lower.endswith(".pdf"):
            import PyPDF2
            reader = PyPDF2.PdfReader(io.BytesIO(doc_bytes))
            pages = []
            for page in reader.pages:
                t = page.extract_text()
                if t:
                    pages.append(t.strip())
            text = "\n\n".join(pages)

            # Se PDF scaneado (sem texto extraível), tenta Vision
            if not text.strip() and len(doc_bytes) > 5000:
                text = await _pdf_vision_fallback(doc_bytes, caption)

        # DOCX
        elif mime_type == "application/vnd.openxmlformats-officedocument.wordprocessingml.document" or name_lower.endswith(".docx"):
            import docx
            doc = docx.Document(io.BytesIO(doc_bytes))
            text = "\n".join(p.text for p in doc.paragraphs if p.text.strip())

        # TXT / CSV / JSON
        elif name_lower.endswith((".txt", ".csv", ".json", ".md")):
            text = doc_bytes.decode("utf-8", errors="ignore")

        # XLSX
        elif name_lower.endswith(".xlsx"):
            try:
                import openpyxl
                wb = openpyxl.load_workbook(io.BytesIO(doc_bytes))
                rows = []
                for sheet in wb.worksheets:
                    for row in sheet.iter_rows(values_only=True):
                        line = " | ".join(str(c) for c in row if c is not None)
                        if line.strip():
                            rows.append(line)
                text = "\n".join(rows[:200])  # max 200 linhas
            except Exception:
                text = ""

        else:
            # Tenta decodificar como texto
            try:
                text = doc_bytes.decode("utf-8", errors="ignore")
            except Exception:
                pass

    except Exception as e:
        logger.error("document_extraction_failed", file=file_name, error=str(e))

    if not text.strip():
        result = "[Documento recebido"
        if file_name:
            result += f" ({file_name})"
        result += " — não foi possível extrair o texto]"
        if caption:
            result = f"[Legenda do documento]: {caption}\n{result}"
        return result

    # Trunca se muito longo (WhatsApp + LLM têm limites)
    max_chars = 8000
    if len(text) > max_chars:
        text = text[:max_chars] + f"\n\n[... documento truncado — {len(text)} chars no total]"

    result = f"[Documento recebido"
    if file_name:
        result += f" — {file_name}"
    result += f"]:\n{text}"
    if caption:
        result = f"[Legenda]: {caption}\n{result}"

    logger.info("document_extracted", file=file_name, chars=len(text))
    return result


async def _pdf_vision_fallback(pdf_bytes: bytes, caption: str = "") -> str:
    """Para PDFs escaneados sem texto extraível, usa Claude Vision via account_pool."""
    try:
        from app.database import AsyncSessionLocal
        from app.core.account_pool import account_pool

        b64_pdf = base64.b64encode(pdf_bytes).decode("utf-8")
        messages = [{
            "role": "user",
            "content": [
                {"type": "document", "source": {"type": "base64", "media_type": "application/pdf", "data": b64_pdf}},
                {"type": "text", "text": "Extraia todo o texto deste PDF. Preserve tabelas e estrutura. Responda apenas com o conteúdo extraído."},
            ],
        }]
        async with AsyncSessionLocal() as db:
            return await account_pool.chat(db=db, messages=messages, system_prompt="Você é um extrator de texto de documentos.")
    except Exception as e:
        logger.warning("pdf_vision_fallback_failed", error=str(e))
        return ""


# ─── DISPATCHER PRINCIPAL ────────────────────────────────────────────────────

async def process_media_message(message_obj: dict, message_data: dict | None = None,
                                source_instance: str = "") -> str | None:
    """
    Entry point principal. Identifica o tipo de mídia, baixa e processa.
    message_data: data completo do webhook (com key), necessário para download correto.
    source_instance: instância Evolution que recebeu (payload._source_instance).
    Retorna string de texto para ser injetada na mensagem do agente.
    """
    # Identifica tipo
    if "audioMessage" in message_obj:
        mime = message_obj["audioMessage"].get("mimetype", "audio/ogg")
        logger.info("media_detected", type="audio", mime=mime)
        audio_bytes = await download_media(message_obj, message_data, source_instance)
        logger.info("audio_download_result", bytes_size=len(audio_bytes) if audio_bytes else 0, is_none=audio_bytes is None)
        if audio_bytes:
            return await transcribe_audio(audio_bytes, mime)
        return "[Áudio recebido — erro ao baixar o arquivo]"

    if "imageMessage" in message_obj:
        caption = message_obj["imageMessage"].get("caption", "")
        mime = message_obj["imageMessage"].get("mimetype", "image/jpeg")
        logger.info("media_detected", type="image", has_caption=bool(caption))
        image_bytes = await download_media(message_obj, message_data, source_instance)
        if image_bytes:
            return await describe_image(image_bytes, caption, mime)
        # Mesmo sem download, retorna a caption se houver
        if caption:
            return f"[Imagem recebida com legenda]: {caption}"
        return "[Imagem recebida — erro ao baixar]"

    if "documentMessage" in message_obj:
        doc_obj = message_obj["documentMessage"]
        file_name = doc_obj.get("fileName", "")
        caption = doc_obj.get("caption", "")
        mime = doc_obj.get("mimetype", "")
        logger.info("media_detected", type="document", file=file_name)
        doc_bytes = await download_media(message_obj, message_data, source_instance)
        if doc_bytes:
            return await extract_document_text(doc_bytes, file_name, mime, caption)
        if caption:
            return f"[Documento recebido ({file_name}) com legenda]: {caption}"
        return f"[Documento recebido ({file_name}) — erro ao baixar]"

    if "videoMessage" in message_obj:
        caption = message_obj["videoMessage"].get("caption", "")
        mime = message_obj["videoMessage"].get("mimetype", "video/mp4")
        logger.info("media_detected", type="video")
        # Tenta baixar e transcrever o áudio do vídeo
        video_bytes = await download_media(message_obj, message_data, source_instance)
        if video_bytes:
            # Vídeo do WhatsApp pode conter áudio — tenta transcrever direto
            result = await transcribe_audio(video_bytes, mime)
            if caption:
                result = f"[Vídeo com legenda]: {caption}\n{result}"
            return result
        if caption:
            return f"[Vídeo recebido com legenda]: {caption}"
        return "[Vídeo recebido — erro ao processar]"

    if "stickerMessage" in message_obj:
        return "[Figurinha/Sticker recebido]"

    if "locationMessage" in message_obj:
        loc = message_obj["locationMessage"]
        lat = loc.get("degreesLatitude", "")
        lng = loc.get("degreesLongitude", "")
        name = loc.get("name", "")
        return f"[Localização compartilhada]: {name or f'Lat {lat}, Lng {lng}'} — https://maps.google.com/?q={lat},{lng}"

    if "contactMessage" in message_obj:
        contact = message_obj["contactMessage"]
        return f"[Contato compartilhado]: {contact.get('displayName', 'Contato')}"

    return None
