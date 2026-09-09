FROM parket-dashboard:golden
COPY propostaGenerator-PGSTRUCT21.js /usr/share/nginx/html/assets/propostaGenerator-PGSTRUCT21.js
COPY propostaGenerator-PGSTRUCT22.js /usr/share/nginx/html/assets/propostaGenerator-PGSTRUCT22.js
COPY propostaGenerator-PGSTRUCT23.js /usr/share/nginx/html/assets/propostaGenerator-PGSTRUCT23.js
RUN sed -i "s|var CODE_VERSION = '[^']*'|var CODE_VERSION = '20260617-pg23-restore'|" /usr/share/nginx/html/index.html
