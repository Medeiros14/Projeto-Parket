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

// abre uma obra sugerida
await page.click('.ck-plus[title="Abrir conversa de obra"]');
await page.waitForSelector('.ck-modal', { timeout: 4000 });
await page.fill('.ck-modal input', 'Alameda');
await page.waitForTimeout(600);
await page.click('.ck-modal-list button');
await page.waitForSelector('.ck-composer textarea', { timeout: 6000 });
console.log('obra aberta OK');

// abre o modal Geral e adiciona tag preset
await page.click('.ck-head button[title="Geral da obra — descrição, membros e mídia"]');
await page.waitForSelector('.ck-modal', { timeout: 4000 });
await page.waitForSelector('.ck-tagadd', { timeout: 4000 });
await page.click('.ck-tagadd:has-text("EM ANDAMENTO")');
await page.waitForSelector('.ck-modal .ck-tag:has-text("EM ANDAMENTO")', { timeout: 4000 });
console.log('tag preset adicionada OK');

// tag custom via input + Enter
await page.fill('.ck-tagnew input', 'medição fina');
await page.keyboard.press('Enter');
await page.waitForSelector('.ck-modal .ck-tag:has-text("MEDIÇÃO FINA")', { timeout: 4000 });
console.log('tag custom (uppercase) OK');

// fecha o modal
await page.click('.ck-modalbg', { position: { x: 10, y: 10 } });
await page.waitForTimeout(400);

// header da conversa mostra as tags
const headTags = await page.locator('.ck-head-title .ck-tag').allInnerTexts();
if (!headTags.some((t) => t.includes('EM ANDAMENTO'))) throw new Error('header sem tag: ' + JSON.stringify(headTags));
console.log('tags no header OK');

// sidebar mostra chips na linha da obra
const sideTags = await page.locator('.ck-side .ck-item .ck-tagrow.sm .ck-tag').allInnerTexts();
if (!sideTags.length) throw new Error('sidebar sem chips de tag');
console.log('chips na sidebar OK:', sideTags.join(', '));

// filtro por tag: digitar "andamento" mantém a obra na lista
await page.fill('.ck-side-search input', 'andamento');
await page.waitForTimeout(400);
const found = await page.locator('.ck-side .ck-item:has(.ck-tag)').count();
if (!found) throw new Error('filtro por tag não achou a obra');
console.log('filtro por tag OK');
// filtro que não bate esconde
await page.fill('.ck-side-search input', 'zzzznada');
await page.waitForTimeout(400);
if (await page.locator('.ck-side .ck-item:has(.ck-tagrow)').count()) throw new Error('filtro negativo não escondeu');
await page.fill('.ck-side-search input', '');
console.log('filtro negativo OK');

// remover tag pelo X do chip no modal
await page.click('.ck-head button[title="Geral da obra — descrição, membros e mídia"]');
await page.waitForSelector('.ck-modal .ck-tag', { timeout: 4000 });
await page.click('.ck-modal .ck-tag:has-text("MEDIÇÃO FINA") button[title="Remover tag"]');
await page.waitForTimeout(500);
if (await page.locator('.ck-modal .ck-tag:has-text("MEDIÇÃO FINA")').count()) throw new Error('remoção não sumiu do modal');
await page.click('.ck-modalbg', { position: { x: 10, y: 10 } });
console.log('remover tag OK');

// persistência: reload mantém tag no header e sidebar
await page.reload();
await page.waitForSelector('.ck-side-body', { timeout: 8000 });
await page.waitForSelector('.ck-side .ck-item .ck-tagrow.sm .ck-tag', { timeout: 6000 });
const afterReload = await page.locator('.ck-side .ck-item .ck-tagrow.sm .ck-tag').allInnerTexts();
if (!afterReload.some((t) => t.includes('EM ANDAMENTO'))) throw new Error('tag não persistiu: ' + JSON.stringify(afterReload));
console.log('persistência após reload OK');

console.log('ERROS DE PÁGINA:', errors.length ? errors : 'nenhum');
await browser.close();
process.exit(errors.length ? 1 : 0);
