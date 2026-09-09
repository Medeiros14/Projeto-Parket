# ╔══════════════════════════════════════════════════════════════╗
# ║  NÃO BUILDAR DIRETAMENTE COMO :latest                       ║
# ║  Use: ./deploy-dashboard.sh <imagem:tag>                    ║
# ║  Ou: docker build -t parket-dashboard:staging .              ║
# ║  NUNCA: docker build -t parket-dashboard:latest .            ║
# ╚══════════════════════════════════════════════════════════════╝

FROM node:20-alpine AS builder
RUN npm install -g pnpm@9
WORKDIR /app
COPY package.json ./
RUN pnpm add react@18.3.1 react-dom@18.3.1 --save-peer || true
RUN pnpm install --no-frozen-lockfile
COPY . .
RUN pnpm build

FROM nginx:1.27-alpine
# 1. Copiar GOLDEN inteira como base (mantém /assets/index-DZtetJYP.js no caminho correto,
#    para que hotpatches que importam de "./index-DZtetJYP.js" continuem funcionando após
#    o build fresco). CORREÇÃO 2026-06-15: antes copiava pra /assets/ (criava nesting bug).
COPY dist_golden/ /usr/share/nginx/html/
# 2. Build fresco sobrescreve onde houver mesmo nome (index.html novo, novos chunks).
#    Chunks antigos com nomes diferentes ficam intactos — hotpatches preservados.
COPY --from=builder /app/dist/ /usr/share/nginx/html/
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
