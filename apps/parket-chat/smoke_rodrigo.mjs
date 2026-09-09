import { chromium } from "playwright";
import fs from "fs";

const CARD = "efbfb1fc-b1b9-4b21-b13c-fd5f5f0a2eec"; // RODRIGO projetos
const session = JSON.parse(fs.readFileSync("/tmp/session_alvaro.json","utf8"));

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport:{width:390,height:844}, deviceScaleFactor:2, isMobile:true, hasTouch:true });
await ctx.addInitScript(sess => {
  for (const [k,v] of Object.entries(sess)) localStorage.setItem(k, v);
}, session);
const page = await ctx.newPage();
page.on("console", msg => { if (msg.type()==="error") console.log("[JS ERR]", msg.text()); });

await page.goto(`https://verifica.parket.works/#obra=${CARD}`, { waitUntil:"networkidle" });
await page.waitForTimeout(2000);

// Coletar h2 e labels de status renderizados
const cards = await page.evaluate(() => {
  const secs = [];
  document.querySelectorAll("#root .card").forEach(c => {
    const h2 = c.querySelector(".h2");
    const label = c.querySelector(".label");
    const title = h2?.textContent?.trim();
    const lbl = label?.textContent?.trim();
    const smalls = [...c.querySelectorAll(".small")].map(s => s.textContent.trim());
    const tags = [...c.querySelectorAll(".tag")].map(s => s.textContent.trim());
    secs.push({ title, lbl, smalls, tags });
  });
  return secs;
});
console.log(JSON.stringify(cards, null, 2));

await page.screenshot({ path:"/tmp/rodrigo_dedup.png", fullPage:true });
console.log("screenshot: /tmp/rodrigo_dedup.png");
await browser.close();
