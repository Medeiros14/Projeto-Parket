FROM python:3.12-slim

WORKDIR /app

# Dependências de sistema: libffi pra cryptography + libs do Chromium headless.
# Playwright roda Chromium pra converter o HTML do contrato em PDF fiel ao
# preview do frontend (evita anexo manual).
RUN apt-get update && apt-get install -y --no-install-recommends \
    libffi8 ca-certificates \
    libglib2.0-0 libnss3 libnspr4 libatk1.0-0 libatk-bridge2.0-0 \
    libcups2 libdrm2 libxkbcommon0 libatspi2.0-0 libxcomposite1 \
    libxdamage1 libxfixes3 libxrandr2 libgbm1 libpango-1.0-0 libcairo2 \
    libasound2 libxshmfence1 \
    fonts-liberation fonts-dejavu-core \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Chromium do Playwright (WebKit/Firefox não usados).
RUN python -m playwright install chromium

COPY app ./app

EXPOSE 8000

# Single worker — DocuSign não tem volume alto; mantém memória baixa.
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--proxy-headers", "--forwarded-allow-ips", "*"]
