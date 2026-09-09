import { chromium } from "playwright";
import fs from "fs";
const session = JSON.parse(fs.readFileSync("/tmp/session_alvaro.json","utf8"));
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport:{width:390,height:844}, deviceScaleFactor:2, isMobile:true, hasTouch:true });
await ctx.addInitScript(sess => localStorage.setItem("parket-fiscal-auth", JSON.stringify(sess)), session);
const page = await ctx.newPage();
page.on("console", m => { if (m.type()==="error") console.log("[ERR]", m.text()); });
await page.goto("https://verifica.parket.works/", { waitUntil:"networkidle" });
await page.waitForTimeout(3000);
await page.screenshot({ path:"/tmp/home_new.png", fullPage:true });
console.log("home shot: /tmp/home_new.png");
// Também abre a lista Vencidos
const vencidos = page.locator('[data-sect="vencidos"]');
if (await vencidos.count()) {
  await vencidos.click();
  await page.waitForTimeout(1500);
  await page.screenshot({ path:"/tmp/vencidos_list.png", fullPage:true });
  console.log("vencidos list: /tmp/vencidos_list.png");
}
await browser.close();
