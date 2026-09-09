# =====================================================================
# MONITOR PARKET: imagem unica (API + checker + frontend buildado)
# Build: docker build -t parket-monitor:latest /root/monitor-app
# O frontend (web/dist) e buildado FORA da imagem (npm run build no host)
# seguindo o padrao dos outros apps Parket.
# =====================================================================
FROM node:20-alpine

WORKDIR /app

# Dependencias do server primeiro (cache de layer)
COPY server/package.json server/package-lock.json* ./server/
RUN cd server && npm install --omit=dev --no-audit --no-fund

# Codigo do server + frontend buildado
COPY server/index.js ./server/
COPY web/dist ./web/dist

EXPOSE 3000
CMD ["node", "server/index.js"]
