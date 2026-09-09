FROM parket-dashboard:golden
COPY orcamento-simulador-tab-MARCFIX38.js /usr/share/nginx/html/assets/orcamento-simulador-tab-MARCFIX38.js
COPY propostaGenerator-PGSTRUCT21.js /usr/share/nginx/html/assets/propostaGenerator-PGSTRUCT21.js
COPY propostaGenerator-PGSTRUCT22.js /usr/share/nginx/html/assets/propostaGenerator-PGSTRUCT22.js
COPY propostaGenerator-PGSTRUCT23.js /usr/share/nginx/html/assets/propostaGenerator-PGSTRUCT23.js
COPY dept-layout-BtZpIBbo.js /usr/share/nginx/html/assets/dept-layout-BtZpIBbo.js
COPY dept-layout-v2-BtZpIBbo.js /usr/share/nginx/html/assets/dept-layout-v2-BtZpIBbo.js
COPY dept-layout-v2-DWGFIX1.js /usr/share/nginx/html/assets/dept-layout-v2-DWGFIX1.js
RUN sed -i "s|var CODE_VERSION = '[^']*'|var CODE_VERSION = '20260617-mf38-consolida'|" /usr/share/nginx/html/index.html
