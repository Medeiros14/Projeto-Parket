FROM parket-dashboard:golden
COPY dept-layout-BtZpIBbo.js /usr/share/nginx/html/assets/dept-layout-BtZpIBbo.js
COPY dept-layout-v2-BtZpIBbo.js /usr/share/nginx/html/assets/dept-layout-v2-BtZpIBbo.js
COPY dept-layout-v2-DWGFIX1.js /usr/share/nginx/html/assets/dept-layout-v2-DWGFIX1.js
RUN sed -i "s|var CODE_VERSION = '[^']*'|var CODE_VERSION = '20260617-dl-mf38'|" /usr/share/nginx/html/index.html
