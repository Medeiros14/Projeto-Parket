FROM python:3.12-slim

# docker-cli (não docker.io): no Debian 13 o docker.io só traz o daemon —
# sem o CLI, tools de catálogo (docker exec psql) e /toolkits/apply quebram.
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl docker-cli \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /srv

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Modelo de embeddings local baked na imagem (senão baixa a cada restart)
ENV FASTEMBED_CACHE_PATH=/srv/.fastembed
RUN python -c "from fastembed import TextEmbedding; TextEmbedding('sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2')"

COPY app/ app/

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s \
    CMD curl -fsS http://localhost:8000/health || exit 1

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "1"]
