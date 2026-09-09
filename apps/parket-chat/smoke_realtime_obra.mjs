import { chromium } from "playwright";
import fs from "fs";
import { execSync } from "child_process";
const session = JSON.parse(fs.readFileSync("/tmp/session_alvaro.json","utf8"));

const CARD_TITLE = "FAZENDA SANTA ELIZA";
const OBRA_ID = "PKT100409";
const SERVICO_ID = "15677e1f-4cff-4992-bb5c-18622063b821"; // FORRO ESTRUTURA
const NOVO_QTD = 999.99;

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport:{width:390,height:844}, deviceScaleFactor:2, isMobile:true, hasTouch:true });
await ctx.addInitScript(sess => localStorage.setItem("parket-fiscal-auth", JSON.stringify(sess)), session);
const page = await ctx.newPage();
page.on("console", m => { if (m.type()==="error") console.log("[JS]", m.text().slice(0,150)); });

await page.goto("https://verifica.parket.works/", { waitUntil:"networkidle" });
await page.waitForSelector('.stats-row', { timeout:15000 });
await page.locator('[data-sect="obras"]').click();
await page.waitForTimeout(1200);
await page.locator(`.lcli:has-text("${CARD_TITLE}")`).first().click();
await page.waitForTimeout(3000);

// Antes: qual a contrato_qtd renderizada pra FORRO ESTRUTURA?
const antes = await page.evaluate(() => {
  const rows = [...document.querySelectorAll(".card")].filter(c => /FORRO ESTRUTURA/.test(c.textContent || ""));
  return rows.map(r => r.querySelector(".small")?.textContent?.trim()).filter(Boolean).slice(0,3);
});
console.log("ANTES:", antes);

// Backup + muda contrato_qtd no DB
const dsn = "postgresql://postgres:fCrbpU1S5k3NHI8p@db.hbxpilrxmitvzebluoom.supabase.co:5432/postgres";
const oldQtd = execSync(`docker run --rm postgres:15-alpine psql "${dsn}" -tAc "select contrato_qtd from public.prestadores_obra_servicos where id='${SERVICO_ID}';"`).toString().trim();
console.log("contrato_qtd atual no DB:", oldQtd);
execSync(`docker run --rm postgres:15-alpine psql "${dsn}" -c "update public.prestadores_obra_servicos set contrato_qtd=${NOVO_QTD}, updated_at=now() where id='${SERVICO_ID}';"`);
console.log("UPDATE contrato_qtd →", NOVO_QTD);

// Espera realtime + debounce (900ms) + fetch/render (~2s)
await page.waitForTimeout(4500);

const depois = await page.evaluate(() => {
  const rows = [...document.querySelectorAll(".card")].filter(c => /FORRO ESTRUTURA/.test(c.textContent || ""));
  return rows.map(r => r.querySelector(".small")?.textContent?.trim()).filter(Boolean).slice(0,3);
});
console.log("DEPOIS:", depois);
const persistiu = depois.some(s => s.includes("999") || s.includes(String(NOVO_QTD).slice(0,3)));
console.log("Realtime disparou re-render?", persistiu);

// Restaura
execSync(`docker run --rm postgres:15-alpine psql "${dsn}" -c "update public.prestadores_obra_servicos set contrato_qtd=${oldQtd}, updated_at=now() where id='${SERVICO_ID}';"`);
console.log("Restaurado.");

await page.screenshot({ path:"/tmp/realtime_obra.png", fullPage:true });
await browser.close();
