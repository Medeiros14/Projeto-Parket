FROM parket-dashboard:golden
COPY default.conf /etc/nginx/conf.d/default.conf
RUN sed -i "s|var CODE_VERSION = '[^']*'|var CODE_VERSION = '20260617-nocache-critical'|" /usr/share/nginx/html/index.html
