import { chromium } from '@playwright/test';
const BASE = 'http://127.0.0.1:3999';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));

await page.goto(BASE + '/');
await page.fill('input[type=email]', 'ana@parket.com.br');
await page.fill('input[type=password]', 'parket123');
await page.click('button:has-text("Entrar")');
await page.waitForSelector('.ck-side-body', { timeout: 8000 });

// abre canal e manda a mensagem original
await page.click('.ck-item:has-text("geral")');
await page.waitForSelector('.ck-composer textarea');
await page.fill('.ck-composer textarea', 'mensagem original pra citar');
await page.keyboard.press('Enter');
await page.waitForSelector('.ck-msg-text:has-text("mensagem original pra citar")');
console.log('mensagem original enviada OK');

// hover → botão Responder → barra de citação no composer
const orig = page.locator('.ck-msg', { hasText: 'mensagem original pra citar' }).last();
await orig.hover();
await orig.locator('.ck-hoveracts button[title="Responder"]').click();
await page.waitForSelector('.ck-replybar', { timeout: 3000 });
const barText = await page.locator('.ck-replybar').innerText();
if (!barText.includes('mensagem original pra citar')) throw new Error('replybar sem preview: ' + barText);
console.log('barra de resposta OK');

// envia a resposta
await page.fill('.ck-composer textarea', 'esta é a resposta citando');
await page.keyboard.press('Enter');
await page.waitForSelector('.ck-msg-quote', { timeout: 4000 });
const quote = page.locator('.ck-msg-quote').last();
const qText = await quote.innerText();
if (!qText.includes('mensagem original pra citar')) throw new Error('quote errado: ' + qText);
// barra deve sumir depois do envio
if (await page.locator('.ck-replybar').count()) throw new Error('replybar não sumiu após enviar');
console.log('mensagem com citação renderizada OK');

// clicar na citação destaca a original
await quote.click();
await page.waitForSelector('.ck-msg.hl', { timeout: 3000 });
console.log('jump pra original OK');

// Escape cancela a resposta
await orig.hover();
await orig.locator('.ck-hoveracts button[title="Responder"]').click();
await page.waitForSelector('.ck-replybar', { timeout: 3000 });
await page.keyboard.press('Escape');
await page.waitForTimeout(300);
if (await page.locator('.ck-replybar').count()) throw new Error('Escape não cancelou a resposta');
console.log('cancelar com Escape OK');

// persistência: reload e a citação continua
await page.reload();
await page.waitForSelector('.ck-msg-quote', { timeout: 8000 });
console.log('citação persiste após reload OK');

console.log('ERROS DE PÁGINA:', errors.length ? errors : 'nenhum');
await browser.close();
process.exit(errors.length ? 1 : 0);
