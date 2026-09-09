FROM node:22-slim

WORKDIR /app
ENV NODE_ENV=production

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# esbuild é devDependency; o bundle já vem pronto em public/app.js
COPY server ./server
COPY public ./public

EXPOSE 3000
CMD ["node", "server/index.js"]
