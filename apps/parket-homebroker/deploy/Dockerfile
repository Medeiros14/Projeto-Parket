FROM node:20-alpine AS build
WORKDIR /app
COPY frontend/package.json frontend/package-lock.json* ./
RUN npm install --no-audit --no-fund
COPY frontend/ ./
# OAuth Google Calendar/Meet — Vite só expõe vars com prefixo VITE_, e precisa
# estar setada no momento do `npm run build` (não em runtime do nginx).
# Default fixo: builds de 15-16/07 sem --build-arg quebraram o botão Gerar Meet.
ARG VITE_GOOGLE_CLIENT_ID="768306132819-7l4enmfutc8brk12msqi0kohdf65550s.apps.googleusercontent.com"
ENV VITE_GOOGLE_CLIENT_ID=$VITE_GOOGLE_CLIENT_ID
RUN npm run build

FROM nginx:1.27-alpine
COPY deploy/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist/ /usr/share/nginx/html/
EXPOSE 80
HEALTHCHECK --interval=30s --timeout=3s --retries=3 \
  CMD wget -qO- http://127.0.0.1/healthz >/dev/null 2>&1 || exit 1
