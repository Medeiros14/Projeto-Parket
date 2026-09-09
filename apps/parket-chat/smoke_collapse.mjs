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
// abre uma obra pra existir item na lista
await page.click('.ck-plus[title="Abrir conversa de obra"]');
await page.fill('.ck-modal input', 'Alameda');
await page.waitForSelector('.ck-modal-list button:has-text("Alameda")', { timeout: 4000 });
await page.click('.ck-modal-list button:has-text("Alameda")');
await page.waitForSelector('.ck-composer textarea', { timeout: 6000 });
// volta pro canal pra obra não ficar "ativa"
await page.click('.ck-item:has-text("geral")');
await page.waitForSelector('.ck-composer textarea');
const antes = await page.locator('.ck-side-body .ck-item:has(svg path[d^="m3 10"])').count();
if (antes < 1) throw new Error('nenhuma obra na sidebar');
// colapsa
await page.click('.ck-secbtn');
await page.waitForTimeout(200);
const depois = await page.locator('.ck-side-body .ck-item:has(svg path[d^="m3 10"])').count();
if (depois !== 0) throw new Error('obras não sumiram ao colapsar: ' + depois);
const header = await page.locator('.ck-secbtn').innerText();
if (!/\(\d+\)/.test(header)) throw new Error('contador ausente no header colapsado: ' + header);
console.log('colapso OK (' + antes + ' → 0, header "' + header.trim() + '")');
// persiste após reload
await page.reload();
await page.waitForSelector('.ck-side-body', { timeout: 8000 });
await page.waitForTimeout(400);
const posReload = await page.locator('.ck-side-body .ck-item:has(svg path[d^="m3 10"])').count();
if (posReload !== 0) throw new Error('colapso não persistiu no reload');
console.log('persistência OK');
// expande de volta
await page.click('.ck-secbtn');
await page.waitForTimeout(200);
const reaberto = await page.locator('.ck-side-body .ck-item:has(svg path[d^="m3 10"])').count();
if (reaberto < 1) throw new Error('não expandiu de volta');
console.log('expandir OK (' + reaberto + ' obras)');
console.log('ERROS:', errors.length ? errors : 'nenhum');
await browser.close();
process.exit(errors.length ? 1 : 0);
