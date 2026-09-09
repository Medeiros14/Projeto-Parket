FROM node:20-alpine AS build
WORKDIR /app
# Chave pública VAPID pro subscribe do browser — pode ficar em bundle (é public).
ARG VITE_VAPID_PUBLIC_KEY="BNowERKP7ZIYDf3bz0CLYZHb7uurOH2dj_xLi3bYyUXf0Ri5jSsS-4sEjNWWXGvRP84_5kfggh6n68LB7S_5c9Y"
ENV VITE_VAPID_PUBLIC_KEY=${VITE_VAPID_PUBLIC_KEY}
COPY package.json ./
RUN npm install --silent --no-audit --no-fund
COPY tsconfig.json vite.config.ts index.html ./
COPY src ./src
COPY public ./public
RUN npm run build

FROM nginx:1.27-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
