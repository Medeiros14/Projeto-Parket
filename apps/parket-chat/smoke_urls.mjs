import { chromium } from '@playwright/test';
const BASE = 'http://127.0.0.1:3999';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));

const login = async () => {
  await page.fill('input[type=email]', 'ana@parket.com.br');
  await page.fill('input[type=password]', 'parket123');
  await page.click('button:has-text("Entrar")');
  await page.waitForSelector('.ck-side-body', { timeout: 8000 });
};

await page.goto(BASE + '/');
await login();

// 1. abrir canal muda a URL
await page.click('.ck-item:has-text("geral")');
await page.waitForSelector('.ck-composer textarea');
if (new URL(page.url()).pathname !== '/canal/geral') throw new Error('URL do canal errada: ' + page.url());
console.log('URL /canal/geral OK');

// 2. manda mensagem e copia link dela
await page.fill('.ck-composer textarea', 'mensagem ancorada de teste');
await page.keyboard.press('Enter');
await page.waitForSelector('.ck-msg-text:has-text("mensagem ancorada de teste")');
const msg = page.locator('.ck-msg', { hasText: 'mensagem ancorada de teste' }).last();
const anchorId = await msg.getAttribute('id');
if (!/^m\d+$/.test(anchorId || '')) throw new Error('âncora ausente: ' + anchorId);
await msg.hover();
await msg.locator('.ck-hoveracts button[title="Copiar link da mensagem"]').click();
console.log('botão copiar link OK (âncora ' + anchorId + ')');

// 3. abrir DM muda URL e voltar (back) retorna pro canal
await page.click('.ck-item:has-text("Will")').catch(() => {});
if (!page.url().includes('/dm/')) {
  await page.click('.ck-plus[title="Nova conversa"]');
  await page.click('.ck-modal-list button:has-text("Will")');
  await page.waitForSelector('.ck-head-title:has-text("Will")');
}
if (!new URL(page.url()).pathname.startsWith('/dm/')) throw new Error('URL da DM errada: ' + page.url());
console.log('URL /dm/... OK: ' + new URL(page.url()).pathname);
await page.goBack();
await page.waitForTimeout(400);
if (new URL(page.url()).pathname !== '/canal/geral') throw new Error('back não voltou pro canal: ' + page.url());
await page.waitForSelector('.ck-msg-text:has-text("mensagem ancorada de teste")', { timeout: 4000 });
console.log('voltar do navegador OK');

// 4. abrir link colado /canal/geral#m<id> — reabre canal, destaca e centraliza a mensagem
await page.goto(BASE + '/');
await page.goto(BASE + '/canal/geral#' + anchorId);
await page.waitForSelector('.ck-composer textarea', { timeout: 8000 });
await page.waitForSelector('#' + anchorId + '.hl', { timeout: 5000 });
console.log('deep-link com âncora + highlight OK');

// 5. legado ?conv=channel:… ainda funciona e vira URL bonita
const chanId = await page.evaluate(() => {
  const b = document.querySelector('.ck-item');
  return null;
});
await page.goto(BASE + '/?conv=channel:1');
await page.waitForSelector('.ck-composer textarea', { timeout: 8000 });
await page.waitForTimeout(300);
if (!new URL(page.url()).pathname.startsWith('/canal/')) throw new Error('legado ?conv não canonizou: ' + page.url());
console.log('legado ?conv= OK → ' + new URL(page.url()).pathname);

// 6. rota inexistente cai pra /
await page.goto(BASE + '/canal/nao-existe-xyz');
await page.waitForSelector('.ck-side-body', { timeout: 8000 });
await page.waitForTimeout(300);
if (new URL(page.url()).pathname !== '/') throw new Error('slug inválido não caiu pra /: ' + page.url());
console.log('slug inválido → / OK');

console.log('ERROS DE PÁGINA:', errors.length ? errors : 'nenhum');
await browser.close();
process.exit(errors.length ? 1 : 0);
