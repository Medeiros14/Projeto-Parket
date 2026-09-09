FROM nginx:1.27-alpine

# Remove conf default
RUN rm -f /etc/nginx/conf.d/default.conf

# nginx config
COPY nginx.conf /etc/nginx/conf.d/default.conf

# App files
COPY frontend/ /usr/share/nginx/html/

# APK fica numa subpasta /app/
RUN mkdir -p /usr/share/nginx/html/app
# (parket-fiscal.apk será gerado depois via bubblewrap e copiado aqui)

EXPOSE 80
