FROM parket-dashboard:golden
COPY orcamento-simulador-tab-MARCFIX38.js /usr/share/nginx/html/assets/orcamento-simulador-tab-MARCFIX38.js
RUN find /usr/share/nginx/html -type f \( -name "*.html" -o -name "*.js" \) -exec sed -i 's|orcamento-simulador-tab-MARCFIX37\.js|orcamento-simulador-tab-MARCFIX38.js|g' {} +
RUN sed -i "s|'/assets/orcamento-simulador-tab-MARCFIX37.js'|'/assets/orcamento-simulador-tab-MARCFIX38.js'|g" /usr/share/nginx/html/index.html
RUN sed -i "s|var CODE_VERSION = '[^']*'|var CODE_VERSION = '20260617-mf38-desconto-race'|" /usr/share/nginx/html/index.html
