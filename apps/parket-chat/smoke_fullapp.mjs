import { chromium } from '@playwright/test';
const BASE = 'http://127.0.0.1:3999';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });

await page.goto(BASE + '/');
// login
await page.fill('input[type=email]', 'ana@parket.com.br');
await page.fill('input[type=password]', 'parket123');
await page.click('button:has-text("Entrar")');
await page.waitForSelector('.ck-side-body', { timeout: 8000 });
console.log('login OK, sidebar carregada');

// abre canal geral e manda mensagem
await page.click('.ck-item:has-text("geral")');
await page.waitForSelector('.ck-composer textarea');
await page.fill('.ck-composer textarea', 'mensagem de teste do smoke E2E');
await page.keyboard.press('Enter');
await page.waitForSelector('.ck-msg-text:has-text("mensagem de teste do smoke E2E")', { timeout: 5000 });
console.log('mensagem enviada e renderizada');

// reaction via hover
const msg = page.locator('.ck-msg', { hasText: 'mensagem de teste do smoke E2E' }).last();
await msg.hover();
await msg.locator('.ck-hoveracts button[title="Reagir"]').click();
await page.click('.ck-emojipick button:has-text("👍")');
await page.waitForSelector('.ck-react:has-text("👍")', { timeout: 5000 });
console.log('reaction OK');

// thread
await msg.hover();
await msg.locator('.ck-hoveracts button[title="Responder em thread"]').click();
await page.waitForSelector('.ck-thread');
await page.fill('.ck-thread .ck-composer textarea', 'resposta na thread pelo browser');
await page.keyboard.press('Enter');
await page.waitForSelector('.ck-thread .ck-msg-text:has-text("resposta na thread pelo browser")', { timeout: 5000 });
console.log('thread reply OK');
await page.click('.ck-thread .ck-head button.ck-iconbtn');
await page.waitForSelector('.ck-threadlink:has-text("1 resposta")', { timeout: 5000 });
console.log('contador de thread no painel principal OK');

// busca global
await page.click('.ck-main .ck-iconbtn[title="Buscar mensagens"]');
await page.fill('.ck-modal input', 'smoke');
await page.waitForSelector('.ck-modal-list button', { timeout: 5000 });
console.log('busca global OK');
await page.keyboard.press('Escape');

// DM picker
await page.click('.ck-plus[title="Nova conversa"]');
await page.click('.ck-modal-list button:has-text("Will")');
await page.waitForSelector('.ck-head-title:has-text("Will")', { timeout: 5000 });
await page.fill('.ck-composer textarea', 'oi Will, DM de teste');
await page.keyboard.press('Enter');
await page.waitForSelector('.ck-msg-text:has-text("oi Will, DM de teste")');
console.log('DM OK');

// manifest + sw acessíveis
for (const p of ['/manifest.webmanifest', '/sw.js', '/icons/icon-192.png', '/icons/icon-512.png']) {
  const r = await page.request.get(BASE + p);
  if (!r.ok()) throw new Error('PWA asset falhou: ' + p + ' ' + r.status());
}
console.log('PWA assets OK');

// mobile viewport
await page.setViewportSize({ width: 390, height: 800 });
await page.waitForTimeout(300);
await page.click('.ck-burger');
await page.waitForSelector('.ck-side.open', { timeout: 3000 });
console.log('mobile drawer OK');
await page.screenshot({ path: '/tmp/chatapp-mobile.png' });
await page.setViewportSize({ width: 1440, height: 900 });
await page.screenshot({ path: '/tmp/chatapp-desktop.png' });

console.log('ERROS DE PÁGINA:', errors.length ? errors : 'nenhum');
await browser.close();
process.exit(errors.length ? 1 : 0);
