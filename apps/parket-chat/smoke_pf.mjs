import { chromium } from "playwright";
import fs from "fs";

const CARD = "0465b8fc-c108-42bd-8a18-580e714d2c88"; // ELSOM (agenda vencida real)
const SEARCH_TXT = "ELSOM";
const session = JSON.parse(fs.readFileSync("/tmp/session_alvaro.json","utf8"));

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport:{width:390,height:844}, deviceScaleFactor:2, isMobile:true, hasTouch:true });
await ctx.addInitScript(sess => {
  // Chave que o parket-fiscal usa (storageKey: parket-fiscal-auth)
  localStorage.setItem("parket-fiscal-auth", JSON.stringify(sess));
}, session);
const page = await ctx.newPage();
page.on("console", m => { if (m.type()==="error") console.log("[JS ERR]", m.text()); });

await page.goto("https://verifica.parket.works/", { waitUntil:"networkidle" });
await page.waitForTimeout(2500);

// Clica na seção "Obras" (lista completa) → depois em RODRIGO
await page.locator('[data-sect="obras"]').first().click();
await page.waitForTimeout(1500);
// Busca item RODRIGO (com scroll)
const alvo = page.locator(`.lcli:has-text("${SEARCH_TXT}")`).first();
await alvo.scrollIntoViewIfNeeded();
await alvo.click();
await page.waitForTimeout(2500);

const secs = await page.evaluate(() => {
  const out = [];
  document.querySelectorAll("#root .card").forEach(c => {
    const h2 = c.querySelector(".h2")?.textContent?.trim();
    const lbl = c.querySelector(".label")?.textContent?.trim();
    const smalls = [...c.querySelectorAll(".small")].map(s=>s.textContent.trim()).slice(0,3);
    const tags = [...c.querySelectorAll(".tag")].map(t=>t.textContent.trim()).slice(0,3);
    const title = [...c.querySelectorAll("div")].map(d=>d.textContent.trim()).find(t=>t.length>3 && t.length<80);
    if (h2 || lbl || tags.length) out.push({ h2, lbl, first: title, smalls, tags });
  });
  return out;
});
console.log(JSON.stringify(secs, null, 2));

await page.screenshot({ path:"/tmp/pf_rodrigo.png", fullPage:true });
console.log("shot: /tmp/pf_rodrigo.png");

// Testa modal: clica no card vencido
await page.locator('.card:has(.tag:text-is("vencido"))').first().click();
await page.waitForTimeout(600);
await page.screenshot({ path:"/tmp/pf_modal.png", fullPage:true });
console.log("modal shot: /tmp/pf_modal.png");

const modalVis = await page.evaluate(() => !!document.querySelector('textarea[data-just]'));
console.log("modal aberto:", modalVis);
await browser.close();
