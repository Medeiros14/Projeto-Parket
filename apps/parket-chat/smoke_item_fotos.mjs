import { chromium } from "playwright";
import fs from "fs";
const session = JSON.parse(fs.readFileSync("/tmp/session_alvaro.json","utf8"));

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport:{width:390,height:844}, deviceScaleFactor:2, isMobile:true, hasTouch:true });
await ctx.addInitScript(sess => localStorage.setItem("parket-fiscal-auth", JSON.stringify(sess)), session);
const page = await ctx.newPage();
page.on("console", m => { if (m.type()==="error") console.log("[JS]", m.text().slice(0,150)); });

await page.goto("https://verifica.parket.works/", { waitUntil:"networkidle" });
await page.waitForSelector('.stats-row', { timeout:15000 });
await page.locator('[data-goto="proximas"]').click();
await page.waitForTimeout(1200);
await page.locator('.lcli:has-text("Bruno Colodetti")').first().click();
await page.waitForTimeout(3500);

// Clica em um item da Modelos da obra
const item = page.locator('[data-item]').first();
const cnt = await item.count();
console.log("Itens clicáveis:", cnt);
if (cnt > 0){
  await item.scrollIntoViewIfNeeded();
  await item.click();
  await page.waitForTimeout(1500);
  const modalTxt = await page.evaluate(() => {
    const m = document.querySelector('[data-role="fotos-body"]');
    return m ? m.innerText.trim().slice(0,200) : "SEM MODAL";
  });
  console.log("Modal:", modalTxt);
}
await page.screenshot({ path:"/tmp/item_fotos.png", fullPage:true });
await browser.close();
