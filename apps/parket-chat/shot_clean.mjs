import { chromium } from '@playwright/test';

const BASE = 'http://localhost:3999';

const run = async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  page.on('pageerror', (e) => console.log('PAGEERROR:', e.message));

  await page.goto(BASE);
  await page.fill('input[type="email"]', 'ana@parket.com.br');
  await page.fill('input[type="password"]', 'parket123');
  await page.click('button[type="submit"]');
  await page.waitForSelector('.ck-side', { timeout: 10000 });
  await page.waitForTimeout(1200);
  await page.screenshot({ path: '/tmp/chat-clean-desktop.png' });

  // abre um canal e manda uma msg pra ver conversa preenchida
  const first = page.locator('.ck-item').first();
  await first.click();
  await page.waitForTimeout(400);
  await page.fill('.ck-composer textarea', 'mensagem de teste no canal');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(600);
  await page.screenshot({ path: '/tmp/chat-clean-channel.png' });

  // mobile fresh page (sem drawer aberto)
  const mp = await browser.newPage({ viewport: { width: 390, height: 800 } });
  await mp.goto(BASE);
  await mp.waitForTimeout(1000);
  const needLogin = await mp.locator('input[type="email"]').count();
  if (needLogin) {
    await mp.fill('input[type="email"]', 'ana@parket.com.br');
    await mp.fill('input[type="password"]', 'parket123');
    await mp.click('button[type="submit"]');
  }
  await mp.waitForSelector('.ck-main', { timeout: 10000 });
  await mp.waitForTimeout(1000);
  await mp.screenshot({ path: '/tmp/chat-clean-mobile.png' });
  // drawer aberto
  await mp.click('.ck-burger');
  await mp.waitForTimeout(500);
  await mp.screenshot({ path: '/tmp/chat-clean-mobile-drawer.png' });

  await browser.close();
  console.log('done');
};
run().catch((e) => { console.error(e); process.exit(1); });
