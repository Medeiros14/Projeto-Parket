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
await page.locator('[data-goto="vencidos"]').click();
await page.waitForTimeout(1200);
await page.locator('.lcli:has-text("RAFAEL BARONESI")').first().click();
await page.waitForTimeout(1200);
await page.locator('.lcard:has(.tag:text-is("vencido"))').first().click();
await page.waitForTimeout(700);
// Preenche justificativa e nova data
await page.locator('textarea[data-just]').fill("SMOKE-TEST — reagendamento automático via Playwright");
await page.locator('input[data-nova]').fill("2026-08-15T09:00");
await page.locator('button[data-save]').click();
await page.waitForTimeout(3500);
await page.screenshot({ path:"/tmp/reagendar_result.png", fullPage:true });
console.log("shot: /tmp/reagendar_result.png");
await browser.close();
