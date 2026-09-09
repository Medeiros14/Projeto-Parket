import { chromium } from "playwright";
import fs from "fs";
const session = JSON.parse(fs.readFileSync("/tmp/session_alvaro.json","utf8"));

const TESTS = [
  { sect: "obras",      go: '[data-sect="obras"]',      titulo: "obras",              termo: "FELIPE", esperado: /FELIPE/i },
  { sect: "proximas",   go: '[data-goto="proximas"]',   titulo: "próximas",           termo: "BRUNO",  esperado: /BRUNO/i },
  { sect: "vencidos",   go: '[data-goto="vencidos"]',   titulo: "vencidas",           termo: "FELIPE", esperado: /FELIPE/i },
  { sect: "concluidos", go: '[data-goto="concluidos"]', titulo: "concluídos",         termo: "BRUNO",  esperado: /BRUNO/i },
];

const browser = await chromium.launch();
for (const t of TESTS){
  const ctx = await browser.newContext({ viewport:{width:390,height:844}, deviceScaleFactor:2, isMobile:true, hasTouch:true });
  await ctx.addInitScript(sess => localStorage.setItem("parket-fiscal-auth", JSON.stringify(sess)), session);
  const page = await ctx.newPage();
  await page.goto("https://verifica.parket.works/", { waitUntil:"networkidle" });
  await page.waitForSelector('.stats-row', { timeout:15000 });
  await page.locator(t.go).click();
  await page.waitForTimeout(1500);
  // Deve haver o input
  const searchExists = await page.locator('#_list_search').count();
  const totalAntes = await page.locator('.lcard').count();
  await page.locator('#_list_search').fill(t.termo);
  await page.waitForTimeout(400);
  const visiveis = await page.evaluate(() => {
    return [...document.querySelectorAll('.lcard')].filter(c => c.offsetParent !== null).map(c => c.querySelector('.lcli')?.textContent?.trim()).slice(0,8);
  });
  const hit = visiveis.some(v => t.esperado.test(v || ""));
  const hidden = totalAntes - visiveis.length;
  console.log(`[${t.sect}] search_exists=${searchExists} termo="${t.termo}" antes=${totalAntes} visíveis=${visiveis.length} match=${hit} — ${visiveis.slice(0,3).join(" | ")}`);
  await ctx.close();
}
await browser.close();
