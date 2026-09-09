# OpenCode Server Container
# --------------------------
# Runs opencode in headless server mode.
# Accounts must be authenticated manually on first run:
#   docker exec -it <container> opencode auth browser setup
#
# After authentication, tokens are persisted in the /home/opencode/.opencode volume.
# The container supports automatic token refresh and multi-account rotation.

FROM node:20-slim

# Install required dependencies for headless browser
RUN apt-get update && apt-get install -y --no-install-recommends \
    chromium \
    fonts-noto-color-emoji \
    fonts-symbola \
    ca-certificates \
    curl \
    git \
    && rm -rf /var/lib/apt/lists/*

# Set Puppeteer/Playwright to use installed Chromium
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

# Install OpenCode globally
RUN npm install -g opencode-ai@latest

# Create non-root user
RUN useradd -m -u 1001 opencode
USER opencode
WORKDIR /home/opencode

# OpenCode config directory (mount as volume for persistence)
RUN mkdir -p /home/opencode/.opencode

# Copy config
COPY --chown=opencode:opencode config.json /home/opencode/.opencode/config.json

EXPOSE 4096

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
  CMD curl -f http://localhost:4096/api/v1/health || exit 1

CMD ["opencode", "serve", "--port", "4096"]
