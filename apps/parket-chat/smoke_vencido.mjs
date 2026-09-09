import { chromium } from "playwright";
import fs from "fs";

const session = JSON.parse(fs.readFileSync("/tmp/session_alvaro.json","utf8"));
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport:{width:390,height:844}, deviceScaleFactor:2, isMobile:true, hasTouch:true });
await ctx.addInitScript(sess => localStorage.setItem("parket-fiscal-auth", JSON.stringify(sess)), session);
const page = await ctx.newPage();
page.on("console", m => { if (m.type()==="error") console.log("[ERR]", m.text()); });
page.on("dialog", async d => { console.log("[ALERT]", d.message()); await d.dismiss(); });

await page.goto("https://verifica.parket.works/", { waitUntil:"networkidle" });
await page.waitForTimeout(3000);
// clica no stat Vencidos
await page.locator('[data-goto="vencidos"]').click();
await page.waitForTimeout(1500);
// clica em RAFAEL BARONESI
await page.locator('.lcli:has-text("FELIPE ALMEIDA")').first().click();
await page.waitForTimeout(1500);
// vai pra dentro do cliente (nível 2 do byCliente) — clica no item vencido
const item = page.locator('.lcard:has(.tag:text-is("vencido"))').first();
if (await item.count()){
  await item.click();
  await page.waitForTimeout(1000);
}
await page.screenshot({ path:"/tmp/vencido_click.png", fullPage:true });
// toggle "Fazer agora"
await page.locator('input[value="agora"]').click();
await page.waitForTimeout(400);
await page.screenshot({ path:"/tmp/vencido_agora.png", fullPage:true });
console.log("agora shot: /tmp/vencido_agora.png");
const dataVis = await page.evaluate(() => {
  const w = document.querySelector('[data-nova-wrap]');
  return w ? getComputedStyle(w).display : "?";
});
console.log("data picker display:", dataVis);
const btnTxt = await page.evaluate(() => document.querySelector('[data-save]')?.textContent?.trim());
console.log("botão texto:", btnTxt);
const modal = await page.evaluate(() => !!document.querySelector('textarea[data-just]'));
console.log("modal reagendar aberto:", modal);
await browser.close();
