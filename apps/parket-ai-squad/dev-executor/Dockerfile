# Executor headless do Time Dev Gestão — Claude Code em sandbox:
# sem docker socket, user não-root, repo clonado (nunca o original).
FROM node:20-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
      git python3 curl ca-certificates ripgrep procps \
    && rm -rf /var/lib/apt/lists/* \
    && npm install -g @anthropic-ai/claude-code

RUN useradd -m -u 1000 -o -s /bin/bash exec 2>/dev/null || usermod -l exec -d /home/exec -m node

COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh && mkdir -p /workspace && chown 1000 /workspace

USER 1000
ENV HOME=/home/exec \
    CLAUDE_CONFIG_DIR=/home/exec/.claude \
    IS_SANDBOX=1

WORKDIR /workspace
ENTRYPOINT ["/entrypoint.sh"]
