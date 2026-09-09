import { chromium } from '@playwright/test';
const BASE = 'http://127.0.0.1:3999';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
// headless shell não tem device de áudio — stub getUserMedia com stream de oscilador
await page.addInitScript(() => {
  navigator.mediaDevices.getUserMedia = async () => {
    const ctx = new AudioContext();
    const dst = ctx.createMediaStreamDestination();
    const osc = ctx.createOscillator();
    osc.connect(dst); osc.start();
    return dst.stream;
  };
  // stub da Web Speech: entrega um segmento final ~300ms após o start
  class FakeSR {
    start() {
      this._t = setTimeout(() => {
        const seg = [{ transcript: 'transcricao fake de teste' }];
        seg.isFinal = true;
        this.onresult && this.onresult({ resultIndex: 0, results: [seg] });
      }, 300);
    }
    stop() { clearTimeout(this._t); this.onend && this.onend(); }
  }
  window.SpeechRecognition = FakeSR;
});
const errors = [];
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));

await page.goto(BASE + '/');
await page.fill('input[type=email]', 'ana@parket.com.br');
await page.fill('input[type=password]', 'parket123');
await page.click('button:has-text("Entrar")');
await page.waitForSelector('.ck-side-body', { timeout: 8000 });

await page.click('.ck-item:has-text("geral")');
await page.waitForSelector('.ck-composer textarea');

// 1. gravar
await page.click('button[title="Gravar áudio"]');
await page.waitForSelector('.ck-recdot', { timeout: 4000 });
await page.waitForSelector('.ck-rectime');
console.log('gravação iniciada OK (dot + timer)');
await page.waitForTimeout(1500);

// 2. enviar
await page.click('button:has-text("Enviar áudio")');
await page.waitForSelector('.ck-audio', { timeout: 8000 });
const src = await page.locator('.ck-audio audio').last().getAttribute('src');
if (!/^\/uploads\//.test(src || '')) throw new Error('src do áudio errado: ' + src);
console.log('áudio enviado e player renderizado OK: ' + src);

// 2a. transcrição vira texto da mensagem
await page.waitForSelector('.ck-msg-text:has-text("transcricao fake de teste")', { timeout: 4000 });
console.log('transcrição no corpo da mensagem OK');

// 2b. player custom: play/pause + tempo
await page.locator('.ck-audio-btn').last().click();
await page.waitForSelector('.ck-audio-btn[title="Pausar"]', { timeout: 4000 });
await page.waitForTimeout(700);
await page.locator('.ck-audio-btn').last().click();
const t = await page.locator('.ck-audio-time').last().innerText();
if (!/^\d+:\d{2}$/.test(t)) throw new Error('tempo do player inválido: ' + t);
console.log('player custom play/pause + tempo OK (' + t + ')');

// 3. cancelar não envia
const countBefore = await page.locator('.ck-audio').count();
await page.click('button[title="Gravar áudio"]');
await page.waitForSelector('.ck-recdot');
await page.waitForTimeout(600);
await page.click('button[title="Cancelar gravação"]');
await page.waitForTimeout(800);
const countAfter = await page.locator('.ck-audio').count();
if (countAfter !== countBefore) throw new Error('cancelar enviou áudio! ' + countBefore + '→' + countAfter);
if (await page.locator('.ck-recdot').count()) throw new Error('recdot ainda visível após cancelar');
console.log('cancelar gravação OK (nada enviado)');

console.log('ERROS DE PÁGINA:', errors.length ? errors : 'nenhum');
await browser.close();
process.exit(errors.length ? 1 : 0);
