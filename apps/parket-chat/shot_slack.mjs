import { chromium } from 'playwright';

const BASE = 'http://localhost:3999';

async function login(page, email) {
  await page.goto(BASE);
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', 'parket123');
  await page.click('button[type="submit"]');
  await page.waitForSelector('.ck-main', { timeout: 10000 });
}

const run = async () => {
  const browser = await chromium.launch();
  const ctxA = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const ctxB = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const ana = await ctxA.newPage();
  const bruno = await ctxB.newPage();
  ana.on('pageerror', (e) => console.log('PAGEERROR-ana:', e.message));
  bruno.on('pageerror', (e) => console.log('PAGEERROR-bruno:', e.message));

  await login(ana, 'ana@parket.com.br');
  await login(bruno, 'bruno@parket.com.br');

  // ambos no #geral
  for (const p of [ana, bruno]) {
    await p.click('.ck-item:has-text("geral")');
    await p.waitForSelector('.ck-composer textarea');
  }

  // 1. formatação
  const ta = ana.locator('.ck-composer textarea').first();
  await ta.fill('Teste *negrito* e _italico_ e ~riscado~ e `codigo inline` https://parket.works');
  await ta.press('Enter');
  await ana.waitForTimeout(300);
  await ta.fill('Bloco:\n```\nSELECT * FROM obras;\n```\nfim');
  await ta.press('Enter');
  await ana.waitForTimeout(500);

  console.log('bold ok:', await ana.locator('.ck-msg-text b:has-text("negrito")').count());
  console.log('italic ok:', await ana.locator('.ck-msg-text i:has-text("italico")').count());
  console.log('strike ok:', await ana.locator('.ck-msg-text del:has-text("riscado")').count());
  console.log('code ok:', await ana.locator('.ck-msg-text code:has-text("codigo inline")').count());
  console.log('pre ok:', await ana.locator('.ck-pre:has-text("SELECT")').count());
  console.log('bruno vê bold:', await bruno.locator('.ck-msg-text b:has-text("negrito")').count());

  // 2. typing — bruno digita, ana deve ver
  await bruno.locator('.ck-composer textarea').first().pressSequentially('escrevendo algo', { delay: 40 });
  await ana.waitForTimeout(600);
  const typing = await ana.locator('.ck-typing').textContent().catch(() => null);
  console.log('typing na tela da ana:', typing);

  // 3. editar (mensagem da ana)
  const firstMsg = ana.locator('.ck-msg', { hasText: 'negrito' }).first();
  await firstMsg.hover();
  await firstMsg.locator('.ck-hoveracts button[title="Editar"]').click();
  const edit = ana.locator('.ck-editwrap textarea');
  await edit.fill('Editada: *negrito v2* fica assim');
  await edit.press('Enter');
  await ana.waitForTimeout(500);
  console.log('editado label:', await ana.locator('.ck-edited').count());
  console.log('bruno vê edicao:', await bruno.locator('.ck-msg-text b:has-text("negrito v2")').count());

  // 4. fixar
  const msg2 = ana.locator('.ck-msg', { hasText: 'negrito v2' }).first();
  await msg2.hover();
  await msg2.locator('.ck-hoveracts button[title="Fixar mensagem"]').click();
  await ana.waitForTimeout(400);
  console.log('pinnedtag:', await ana.locator('.ck-pinnedtag').count(), '| bruno pinnedtag:', await bruno.locator('.ck-pinnedtag').count());
  await ana.locator('.ck-head button[title="Mensagens fixadas"]').click();
  await ana.waitForTimeout(400);
  console.log('pin no modal:', await ana.locator('.ck-pinrow').count());
  await ana.screenshot({ path: '/tmp/chat-v3-pins.png' });
  await ana.keyboard.press('Escape');
  await ana.locator('.ck-modalbg').click({ position: { x: 5, y: 5 } }).catch(() => {});
  await ana.waitForTimeout(300);

  // 5. excluir — bruno manda uma msg e exclui
  const tb = bruno.locator('.ck-composer textarea').first();
  await tb.fill('');
  await tb.fill('mensagem que vou excluir');
  await tb.press('Enter');
  await bruno.waitForTimeout(400);
  bruno.on('dialog', (d) => d.accept());
  const delMsgEl = bruno.locator('.ck-msg', { hasText: 'vou excluir' }).first();
  await delMsgEl.hover();
  await delMsgEl.locator('.ck-hoveracts button[title="Excluir"]').click();
  await bruno.waitForTimeout(500);
  console.log('excluída (bruno):', await bruno.locator('.ck-deleted').count(), '| ana vê excluída:', await ana.locator('.ck-deleted').count());

  await ana.screenshot({ path: '/tmp/chat-v3-main.png' });
  await browser.close();
  console.log('done');
};
run().catch((e) => { console.error(e); process.exit(1); });
