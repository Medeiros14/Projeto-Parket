# Guia de Deploy - Parket Website

Este documento descreve como fazer o deploy do site Parket em diferentes plataformas.

## 📋 Pré-requisitos

Antes de fazer o deploy, certifique-se de:

1. ✅ Código está atualizado no repositório Git
2. ✅ Build local funciona sem erros (`npm run build`)
3. ✅ Todas as variáveis de ambiente estão configuradas
4. ✅ Imagens e assets estão otimizados

## 🚀 Deploy em Vercel (Recomendado)

Vercel é a plataforma recomendada para este projeto por oferecer:
- Deploy automático via Git
- Preview deploys para cada PR
- Edge functions
- Analytics integrado
- SSL automático

### Passo a Passo

1. **Criar conta na Vercel**
   - Acesse [vercel.com](https://vercel.com)
   - Faça login com GitHub

2. **Importar projeto**
   ```bash
   # Via CLI (recomendado)
   npm install -g vercel
   vercel login
   vercel
   ```

3. **Configurar variáveis de ambiente**
   - No dashboard da Vercel, vá em Settings → Environment Variables
   - Adicione as variáveis do arquivo `.env.example`

4. **Deploy automático**
   - Cada push na branch `main` faz deploy em produção
   - PRs criam preview deploys automáticos

### Configuração do vercel.json

```json
{
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "framework": "vite",
  "rewrites": [
    { "source": "/(.*)", "destination": "/index.html" }
  ]
}
```

## 🌐 Deploy em Netlify

Netlify é outra excelente opção com recursos similares.

### Passo a Passo

1. **Conectar repositório**
   - Acesse [netlify.com](https://netlify.com)
   - New site from Git → GitHub
   - Selecione o repositório

2. **Configurações de build**
   - Build command: `npm run build`
   - Publish directory: `dist`
   - Node version: `18`

3. **Configurar redirects**

Crie um arquivo `netlify.toml`:

```toml
[build]
  command = "npm run build"
  publish = "dist"

[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200

[build.environment]
  NODE_VERSION = "18"
```

4. **Deploy**
   - Deploys automáticos a cada push
   - Preview deploys para PRs

## ☁️ Deploy em AWS S3 + CloudFront

Para máximo controle e escalabilidade.

### Passo a Passo

1. **Build de produção**
   ```bash
   npm run build
   ```

2. **Criar bucket S3**
   ```bash
   aws s3 mb s3://parket-website
   aws s3 website s3://parket-website --index-document index.html
   ```

3. **Upload dos arquivos**
   ```bash
   aws s3 sync dist/ s3://parket-website --delete
   ```

4. **Configurar CloudFront**
   - Criar distribuição CloudFront
   - Origin: Seu bucket S3
   - Default Root Object: `index.html`
   - SSL Certificate: AWS Certificate Manager

5. **Configurar Route 53**
   - Criar hosted zone
   - Adicionar registros A/AAAA apontando para CloudFront

## 🐳 Deploy com Docker

Para ambientes containerizados.

### Dockerfile

```dockerfile
FROM node:18-alpine AS builder

WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

### nginx.conf

```nginx
server {
    listen 80;
    server_name localhost;
    root /usr/share/nginx/html;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript;
}
```

### Build e Run

```bash
# Build
docker build -t parket-website .

# Run
docker run -p 8080:80 parket-website
```

## 🔧 Otimizações Pré-Deploy

### 1. Otimizar Imagens

```bash
# Instalar sharp
npm install -D sharp

# Comprimir imagens
npx @squoosh/cli --webp auto public/images/*.jpg
```

### 2. Análise de Bundle

```bash
npm run build -- --mode analyze
```

### 3. Lighthouse Score

Garanta que o site tenha scores altos:
- Performance: > 90
- Accessibility: > 95
- Best Practices: > 95
- SEO: > 95

## 🔐 Segurança

### Headers de Segurança

Adicione no seu servidor/plataforma:

```
X-Frame-Options: SAMEORIGIN
X-Content-Type-Options: nosniff
X-XSS-Protection: 1; mode=block
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: geolocation=(), microphone=(), camera=()
```

### HTTPS

- ✅ Sempre use HTTPS em produção
- ✅ Redirecione HTTP para HTTPS
- ✅ Use HSTS header

## 📊 Monitoramento

### Analytics

Adicione Google Analytics 4:

```typescript
// src/app/App.tsx
useEffect(() => {
  if (import.meta.env.PROD) {
    window.gtag('config', import.meta.env.VITE_GA_MEASUREMENT_ID);
  }
}, []);
```

### Error Tracking

Considere usar:
- Sentry
- LogRocket
- Bugsnag

## 🔄 CI/CD

### GitHub Actions

Crie `.github/workflows/deploy.yml`:

```yaml
name: Deploy

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm ci
      - run: npm run build
      - run: npm run test
      # Deploy steps aqui
```

## 📝 Checklist Pré-Deploy

- [ ] Testes passando
- [ ] Build sem erros
- [ ] Variáveis de ambiente configuradas
- [ ] Meta tags SEO verificadas
- [ ] Imagens otimizadas
- [ ] Performance testada
- [ ] Responsividade testada
- [ ] Navegadores testados (Chrome, Safari, Firefox, Edge)
- [ ] SSL configurado
- [ ] Analytics configurado
- [ ] Redirects configurados
- [ ] 404 page funciona
- [ ] Sitemap.xml gerado
- [ ] robots.txt configurado

## 🆘 Troubleshooting

### Build falha

```bash
# Limpar cache
rm -rf node_modules dist
npm install
npm run build
```

### Rotas 404 em produção

- Configurar rewrites/redirects para SPA
- Todas as rotas devem retornar `index.html`

### Imagens não carregam

- Verificar paths relativos vs absolutos
- Verificar CORS se usando CDN

## 📞 Suporte

Para problemas de deploy, contate:
- Email: dev@parket.com.br
- Slack: #dev-parket

---

Última atualização: Março 2026
