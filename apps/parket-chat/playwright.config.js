const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './tests',
  timeout: 90000,
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:3100',
    browserName: 'chromium',
    headless: true,
  },
  webServer: {
    command: 'rm -f data/chat-test.db* && npm run build && PORT=3100 CHAT_DB_PATH=data/chat-test.db node server/index.js',
    url: 'http://localhost:3100/exemplo-plataforma.html',
    reuseExistingServer: false,
    timeout: 60000,
  },
});
