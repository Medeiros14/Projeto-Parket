"""parket-whisper — serviço interno de transcrição de áudio.

Self-hosted faster-whisper (CTranslate2). Roda em CPU no Swarm interno.
Somente acessível de dentro da network parket-api_internal — não é exposto
via Traefik.

Endpoints:
  GET  /health         → warmup status
  POST /transcribe     → multipart: file=<audio>, [language=pt], [beam_size=5]
                         retorna {text, language, duration, segments[]}
"""
from __future__ import annotations

import logging
import os
import tempfile
import time
from typing import Optional

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.responses import JSONResponse
from faster_whisper import WhisperModel

log = logging.getLogger("whisper")
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")

MODEL_SIZE = os.environ.get("WHISPER_MODEL", "small")
COMPUTE_TYPE = os.environ.get("WHISPER_COMPUTE_TYPE", "int8")
DEFAULT_LANG = os.environ.get("WHISPER_LANGUAGE", "pt")
CPU_THREADS = int(os.environ.get("WHISPER_CPU_THREADS", "4"))
NUM_WORKERS = int(os.environ.get("WHISPER_NUM_WORKERS", "1"))

app = FastAPI(title="parket-whisper", version="1.0")

_model: Optional[WhisperModel] = None
_model_ready = False
_load_error: Optional[str] = None


def _get_model() -> WhisperModel:
    global _model, _model_ready, _load_error
    if _model is not None:
        return _model
    try:
        log.info("carregando modelo %s (compute=%s, threads=%s)", MODEL_SIZE, COMPUTE_TYPE, CPU_THREADS)
        t0 = time.time()
        _model = WhisperModel(
            MODEL_SIZE,
            device="cpu",
            compute_type=COMPUTE_TYPE,
            cpu_threads=CPU_THREADS,
            num_workers=NUM_WORKERS,
        )
        _model_ready = True
        log.info("modelo pronto em %.1fs", time.time() - t0)
        return _model
    except Exception as e:
        _load_error = str(e)
        log.exception("falha ao carregar modelo")
        raise


@app.on_event("startup")
async def warmup():
    try:
        _get_model()
    except Exception:
        pass  # /health devolve o erro


@app.get("/health")
def health():
    return {
        "ok": _model_ready,
        "model": MODEL_SIZE,
        "compute_type": COMPUTE_TYPE,
        "language": DEFAULT_LANG,
        "error": _load_error,
    }


@app.post("/transcribe")
async def transcribe(
    file: UploadFile = File(...),
    language: Optional[str] = Form(None),
    beam_size: int = Form(5),
    initial_prompt: Optional[str] = Form(None),
    vad_filter: bool = Form(True),
):
    if _model is None or _load_error:
        raise HTTPException(503, detail=f"modelo não pronto: {_load_error or 'carregando'}")

    audio_bytes = await file.read()
    if not audio_bytes:
        raise HTTPException(400, detail="arquivo vazio")

    with tempfile.NamedTemporaryFile(delete=False, suffix=_suffix(file.filename)) as f:
        f.write(audio_bytes)
        tmp_path = f.name

    try:
        t0 = time.time()
        segments, info = _model.transcribe(
            tmp_path,
            language=language or DEFAULT_LANG,
            beam_size=beam_size,
            vad_filter=vad_filter,
            vad_parameters=dict(min_silence_duration_ms=500),
            initial_prompt=initial_prompt,
        )
        segs = []
        text_parts = []
        for s in segments:
            segs.append({
                "id": s.id,
                "start": round(s.start, 2),
                "end": round(s.end, 2),
                "text": s.text.strip(),
            })
            text_parts.append(s.text.strip())
        elapsed = time.time() - t0
        text = " ".join(text_parts).strip()
        log.info(
            "transcribed audio=%s bytes=%d duration=%.1fs elapsed=%.1fs chars=%d",
            file.filename, len(audio_bytes), info.duration, elapsed, len(text),
        )
        return JSONResponse({
            "text": text,
            "language": info.language,
            "language_probability": round(info.language_probability or 0, 3),
            "duration": round(info.duration, 2),
            "elapsed_seconds": round(elapsed, 2),
            "segments": segs,
        })
    finally:
        try:
            os.remove(tmp_path)
        except Exception:
            pass


def _suffix(name: Optional[str]) -> str:
    if not name:
        return ".webm"
    dot = name.rfind(".")
    return name[dot:] if dot > 0 else ".webm"
