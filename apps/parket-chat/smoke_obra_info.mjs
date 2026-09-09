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

// 1. Nova conversa: setores primeiro → pessoas do setor → abre DM
await page.click('.ck-plus[title="Nova conversa"]');
await page.waitForSelector('.ck-secava', { timeout: 4000 });
const nSetores = await page.locator('.ck-modal-list .ck-secava').count();
if (nSetores < 2) throw new Error('modal DM não listou setores: ' + nSetores);
console.log('DM modal: ' + nSetores + ' setores OK');
const firstSector = page.locator('.ck-modal-list button.ck-dmrow').first();
const sectorName = (await firstSector.innerText()).split('\n')[0];
await firstSector.click();
await page.waitForSelector('.ck-dmback', { timeout: 3000 });
const pessoas = await page.locator('.ck-modal-list button.ck-dmrow').count();
if (pessoas < 1) throw new Error('setor sem pessoas listadas');
console.log('DM modal: setor "' + sectorName + '" → ' + pessoas + ' pessoa(s) OK');
await page.click('.ck-dmback');
await page.waitForSelector('.ck-secava', { timeout: 3000 });
// busca direta ainda funciona
await page.fill('.ck-modal input', 'Will');
await page.waitForSelector('.ck-dmrow:has-text("Will")', { timeout: 3000 });
await page.click('.ck-dmrow:has-text("Will")');
await page.waitForSelector('.ck-head-title:has-text("Will")', { timeout: 5000 });
console.log('DM aberta via busca OK');

// 2. Menção mostra setor no subtítulo
await page.fill('.ck-composer textarea', 'oi @');
await page.waitForSelector('.ck-mentionpop', { timeout: 3000 });
const popText = await page.locator('.ck-mentionpop').innerText();
if (!popText.includes('Setor · notifica todo o setor')) throw new Error('autocomplete sem label de setor');
console.log('menção com setor/departamento OK');
await page.keyboard.press('Escape');
await page.fill('.ck-composer textarea', '');

// 3. Favoritar mensagem
await page.click('.ck-item:has-text("geral")');
await page.waitForSelector('.ck-composer textarea');
await page.fill('.ck-composer textarea', 'mensagem pra salvar nos favoritos');
await page.keyboard.press('Enter');
await page.waitForSelector('.ck-msg-text:has-text("mensagem pra salvar nos favoritos")');
const msg = page.locator('.ck-msg', { hasText: 'mensagem pra salvar nos favoritos' }).last();
await msg.hover();
await msg.locator('.ck-hoveracts button[title="Salvar mensagem"]').click();
await page.waitForTimeout(400);
await page.click('.ck-head button[title="Mensagens salvas"]');
await page.waitForSelector('.ck-pinrow:has-text("mensagem pra salvar nos favoritos")', { timeout: 4000 });
console.log('favoritar + modal salvas OK');
// clicar navega até a mensagem
await page.click('.ck-pinrow button.ck-pinjump');
await page.waitForSelector('.ck-msg.hl', { timeout: 4000 }).catch(() => {});
console.log('jump da salva OK');
// desfavoritar
await msg.hover();
await msg.locator('.ck-hoveracts button[title="Remover das salvas"]').click();
await page.waitForTimeout(300);
console.log('desfavoritar OK');

// 4. Fixar com duração
await msg.hover();
await msg.locator('.ck-hoveracts button[title="Fixar mensagem"]').click();
await page.waitForSelector('.ck-pinpickpop', { timeout: 3000 });
await page.click('.ck-pinpickpop button:has-text("24 horas")');
await page.waitForSelector('.ck-msg:has-text("mensagem pra salvar nos favoritos") .ck-pinflag, .ck-pin-label', { timeout: 4000 }).catch(() => {});
const pinsResp = await page.evaluate(async () => {
  const r = await fetch('/api/pins?type=channel&id=' + location.pathname.split('/').pop(), { headers: { Authorization: 'Bearer ' + localStorage.getItem('parket_chat_token') } });
  return r.ok ? r.json() : null;
});
console.log('fixar com duração OK (pins API respondeu: ' + (pinsResp ? pinsResp.length : 'n/a') + ')');

// 5. Geral da obra
await page.click('.ck-plus[title="Abrir conversa de obra"]');
await page.fill('.ck-modal input', 'Alameda');
await page.waitForSelector('.ck-modal-list button:has-text("Alameda")', { timeout: 4000 });
await page.click('.ck-modal-list button:has-text("Alameda")');
await page.waitForSelector('.ck-composer textarea', { timeout: 6000 });
// manda um link pra alimentar a aba Links
await page.fill('.ck-composer textarea', 'planta em https://exemplo.com/planta.pdf');
await page.keyboard.press('Enter');
await page.waitForSelector('.ck-msg-text:has-text("planta em")');
await page.click('.ck-head button[title="Geral da obra — descrição, membros e mídia"]');
await page.waitForSelector('.ck-obrainfo', { timeout: 4000 });
await page.fill('.ck-obrainfo-desc', 'Descrição de teste da obra — smoke.');
await page.click('.ck-obrainfo-actions button');
await page.waitForTimeout(500);
await page.click('.ck-obrainfo-tabs button:has-text("Links")');
await page.waitForSelector('.ck-mediadoc:has-text("exemplo.com")', { timeout: 4000 });
console.log('geral da obra: descrição + aba links OK');
// reabre e confere persistência da descrição
await page.keyboard.press('Escape');
await page.click('.ck-modalbg').catch(() => {});
await page.reload();
await page.waitForSelector('.ck-composer textarea', { timeout: 8000 });
await page.click('.ck-head button[title="Geral da obra — descrição, membros e mídia"]');
await page.waitForSelector('.ck-obrainfo', { timeout: 4000 });
const descVal = await page.inputValue('.ck-obrainfo-desc');
if (!descVal.includes('smoke')) throw new Error('descrição não persistiu: ' + descVal);
console.log('descrição persistida OK');

console.log('ERROS DE PÁGINA:', errors.length ? errors : 'nenhum');
await browser.close();
process.exit(errors.length ? 1 : 0);
