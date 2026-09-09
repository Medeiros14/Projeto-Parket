import { chromium } from "playwright";
import fs from "fs";

const session = JSON.parse(fs.readFileSync("/tmp/session_alvaro.json","utf8"));
const EXPECTED_LAUDO_ID = "706ce55b-83a9-434b-9387-040e2bbe4f78"; // JOSEPH CHEHEBAR 1vistoria pendente

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport:{width:390,height:844}, deviceScaleFactor:2, isMobile:true, hasTouch:true });
await ctx.addInitScript(sess => localStorage.setItem("parket-fiscal-auth", JSON.stringify(sess)), session);
const page = await ctx.newPage();
page.on("dialog", async d => { console.log("[ALERT]", d.message()); await d.dismiss(); });

await page.goto("https://verifica.parket.works/", { waitUntil:"networkidle" });
await page.waitForSelector('[data-goto="vencidos"]', { timeout: 15000 });
await page.locator('[data-goto="vencidos"]').click();
await page.waitForTimeout(1200);
await page.locator('.lcli:has-text("JOSEPH ISAAC CHEHEBAR")').first().click();
await page.waitForTimeout(2000);
// debug: onde estou?
const state = await page.evaluate(() => ({
  h2s: [...document.querySelectorAll(".h2")].map(h=>h.textContent.trim()),
  tags: [...document.querySelectorAll(".tag")].map(t=>t.textContent.trim()),
  lclis: [...document.querySelectorAll(".lcli")].map(l=>l.textContent.trim()).slice(0,5),
  url: location.href,
}));
console.log("STATE após click JOSEPH:", JSON.stringify(state, null, 2));
await page.waitForSelector('.tag:text-is("vencido"), .lcard:has-text("vencido")', { timeout:10000 });
await page.locator('.card:has(.tag:text-is("vencido")), .lcard:has(.tag:text-is("vencido"))').first().click();
await page.waitForTimeout(700);
await page.locator('textarea[data-just]').fill("SMOKE — teste abrir existente");
await page.locator('input[value="agora"]').click();
await page.waitForTimeout(300);
await page.locator('[data-save]').click();
// aguarda navegação pro editor de laudo (renderEditarLaudo)
await page.waitForTimeout(3500);
await page.screenshot({ path:"/tmp/abrir_existente.png", fullPage:true });

// Ver se abriu o laudo EXISTENTE (não novo)
const bodyText = await page.evaluate(() => document.body.innerText.slice(0, 500));
console.log("---VIEW---\n" + bodyText);
console.log("---URL:", page.url());
// checar se o form aberto é do laudo existente
// heurística: procura por "JOSEPH" ou pelo id do laudo em algum lugar
const foundJoseph = bodyText.includes("JOSEPH");
console.log("form mostra JOSEPH:", foundJoseph);

// Rollback: reset da agenda pra ficar vencida de novo pro proximo teste
await browser.close();
