import { chromium } from '@playwright/test';
const BASE = 'http://127.0.0.1:3999';
const browser = await chromium.launch();
const page = await browser.newPage();
page.on('console', m => console.log('[console]', m.type(), m.text()));
page.on('pageerror', e => console.log('[pageerror]', e.message));
await page.goto(BASE + '/');
await page.fill('input[type=email]', 'ana@parket.com.br');
await page.fill('input[type=password]', 'parket123');
await page.click('button:has-text("Entrar")');
await page.waitForSelector('.ck-side-body');
await page.goto(BASE + '/canal/geral#m5');
await page.waitForSelector('.ck-composer textarea', { timeout: 8000 }).catch(e=>console.log('sem composer', e.message));
await page.waitForTimeout(2000);
const info = await page.evaluate(() => ({
  path: location.pathname, hash: location.hash,
  m5: !!document.getElementById('m5'),
  hl: !!document.querySelector('.ck-msg.hl'),
  nmsgs: document.querySelectorAll('.ck-msg').length,
  ids: [...document.querySelectorAll('.ck-msg')].map(e=>e.id),
}));
console.log(JSON.stringify(info, null, 1));
await browser.close();
