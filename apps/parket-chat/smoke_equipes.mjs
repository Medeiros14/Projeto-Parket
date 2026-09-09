import { chromium } from "playwright";
import fs from "fs";
const session = JSON.parse(fs.readFileSync("/tmp/session_alvaro.json","utf8"));

const CARDS = [
  { title: "Bruno e Katherline Torezani", expected: 0 },
  { title: "FELIPE ALMEIDA", expected: 1 },
  { title: "FAZENDA SANTA ELIZA", expected: 5 },
];

const browser = await chromium.launch();
for (const t of CARDS){
  const ctx = await browser.newContext({ viewport:{width:390,height:844}, deviceScaleFactor:2, isMobile:true, hasTouch:true });
  await ctx.addInitScript(sess => localStorage.setItem("parket-fiscal-auth", JSON.stringify(sess)), session);
  const page = await ctx.newPage();
  await page.goto("https://verifica.parket.works/", { waitUntil:"networkidle" });
  await page.waitForSelector('.stats-row', { timeout:15000 });
  await page.locator('[data-sect="obras"]').click();
  await page.waitForTimeout(1200);
  const target = page.locator(`.lcli:has-text("${t.title}")`).first();
  await target.scrollIntoViewIfNeeded();
  await target.click();
  await page.waitForTimeout(2500);
  const equipesCard = await page.evaluate(() => {
    const labels = [...document.querySelectorAll(".card .label")].map(l => l.textContent.trim());
    const eqLabel = labels.find(l => /^Equipes? na obra$/i.test(l));
    if (!eqLabel) return { encontrado: false };
    // Pega o box do label
    const card = [...document.querySelectorAll(".card")].find(c => /^Equipes? na obra$/i.test(c.querySelector(".label")?.textContent?.trim() || ""));
    if (!card) return { encontrado: false };
    const rows = [...card.querySelectorAll(":scope > div:not(.label)")].flatMap(d => [...d.children]).map(r => r.textContent.trim());
    return { encontrado: true, label: eqLabel, rows };
  });
  console.log(`\n=== ${t.title} (esperado ${t.expected} equipes) ===`);
  console.log(equipesCard);
  await page.screenshot({ path:`/tmp/equipes_${t.title.replace(/\W+/g,"_")}.png`, fullPage:true });
  await ctx.close();
}
await browser.close();
