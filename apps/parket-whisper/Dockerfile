FROM python:3.12-slim

WORKDIR /app

# ffmpeg é obrigatório pro faster-whisper decodificar webm/m4a/mp3/wav
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg curl ca-certificates \
 && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app.py .

# Modelo cacheado num volume; primeiro boot baixa ~460MB (small.pt-BR).
ENV WHISPER_MODEL=small \
    WHISPER_COMPUTE_TYPE=int8 \
    WHISPER_LANGUAGE=pt \
    HF_HOME=/models \
    XDG_CACHE_HOME=/models

EXPOSE 8080
CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8080", "--workers", "1"]
