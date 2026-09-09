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

await page.click('.ck-item:has-text("geral")');
await page.waitForSelector('.ck-composer textarea');
await page.fill('.ck-composer textarea', 'contexto pra teca resumir');
await page.keyboard.press('Enter');
await page.waitForSelector('.ck-msg-text:has-text("contexto pra teca resumir")');

// 1. abrir painel Teca
await page.click('button[title="Teca — pergunte sobre a conversa"]');
await page.waitForSelector('.ck-teca', { timeout: 4000 });
await page.waitForSelector('.ck-teca-hint');
console.log('painel Teca abre OK');

// 2. perguntar
await page.fill('.ck-teca-form input', 'qual o assunto da conversa?');
await page.click('.ck-teca-form button:has-text("Perguntar")');
await page.waitForSelector('.ck-teca-a:has-text("Resposta mock da Teca")', { timeout: 6000 });
const q = await page.locator('.ck-teca-q').last().innerText();
if (!q.includes('assunto da conversa')) throw new Error('pergunta não renderizou: ' + q);
console.log('pergunta + resposta OK');

// 3. botão Resumir conversa
await page.click('.ck-teca-quick button:has-text("Resumir conversa")');
await page.waitForFunction(() => document.querySelectorAll('.ck-teca-a').length >= 2, null, { timeout: 6000 });
console.log('resumir conversa OK');

// 4. trocar de conversa limpa o histórico do painel
await page.click('.ck-plus[title="Nova conversa"]');
await page.click('.ck-modal-list button:has-text("Will")');
await page.waitForSelector('.ck-head-title:has-text("Will")');
await page.waitForTimeout(300);
const remaining = await page.locator('.ck-teca-qa').count();
if (remaining !== 0) throw new Error('histórico não limpou ao trocar conversa: ' + remaining);
const sub = await page.locator('.ck-teca .ck-head-sub').innerText();
if (!sub.includes('Will')) throw new Error('sub do painel não seguiu a conversa: ' + sub);
console.log('troca de conversa reseta painel OK (' + sub + ')');

// 5. fechar painel
await page.click('.ck-teca .ck-head button.ck-iconbtn');
await page.waitForTimeout(200);
if (await page.locator('.ck-teca').count()) throw new Error('painel não fechou');
console.log('fechar painel OK');

console.log('ERROS DE PÁGINA:', errors.length ? errors : 'nenhum');
await browser.close();
process.exit(errors.length ? 1 : 0);
