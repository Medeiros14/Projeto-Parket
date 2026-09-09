FROM nginx:1.27-alpine

# Remove conf default
RUN rm -f /etc/nginx/conf.d/default.conf

# nginx config
COPY nginx.conf /etc/nginx/conf.d/default.conf

# App files
COPY frontend/ /usr/share/nginx/html/

EXPOSE 80
