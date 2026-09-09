import { chromium } from "playwright";
import fs from "fs";

const session = JSON.parse(fs.readFileSync("/tmp/session_alvaro.json","utf8"));
const LAUDO_ID = "706ce55b-83a9-434b-9387-040e2bbe4f78"; // JOSEPH ISAAC CHEHEBAR pendente
const TESTE_TXT = "AUTOSAVE TEST " + Date.now();

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport:{width:390,height:844}, deviceScaleFactor:2, isMobile:true, hasTouch:true });
await ctx.addInitScript(sess => localStorage.setItem("parket-fiscal-auth", JSON.stringify(sess)), session);
const page = await ctx.newPage();
page.on("dialog", async d => { console.log("[ALERT]", d.message()); await d.dismiss(); });
page.on("console", m => { const t = m.text(); if (t.includes("AUTOSAVE") || m.type()==="error") console.log("["+m.type()+"]", t); });

// Abre a home, clica em Obras/JOSEPH, entra no laudo pendente
await page.goto("https://verifica.parket.works/", { waitUntil:"networkidle" });
await page.waitForSelector('.stats-row', { timeout:15000 });
await page.locator('[data-sect="obras"]').click();
await page.waitForTimeout(1200);
await page.locator('.lcli:has-text("JOSEPH ISAAC CHEHEBAR")').first().click();
await page.waitForTimeout(2000);
// Dentro do card: clica no laudo pendente (tag pendente)
await page.locator('.card:has(.tag:text-is("pendente"))').first().click();
await page.waitForTimeout(2500);
// Log estado
console.log("URL:", page.url());
console.log("H2/textareas:", await page.evaluate(() => ({
  h1: [...document.querySelectorAll(".h1")].map(h => h.textContent.trim()),
  textareas: document.querySelectorAll("textarea").length,
})));
// Encontra o textarea de "Observação geral" (label associado)
const label = page.locator('.label:has-text("Observação geral")').first();
const hasLabel = await label.count();
console.log("Achou label 'Observação geral':", hasLabel);
const textarea = page.locator('textarea').last();
await textarea.scrollIntoViewIfNeeded();
await textarea.fill(TESTE_TXT);
// Dispatch explícito input event pra garantir handler execute
await page.evaluate((t) => {
  const tx = [...document.querySelectorAll("textarea")].pop();
  if (tx){
    tx.value = t;
    tx.dispatchEvent(new Event("input", { bubbles:true }));
  }
}, TESTE_TXT);
console.log("Digitou:", TESTE_TXT);
// Espera 2.5s pro debounce+save
await page.waitForTimeout(2500);
await page.screenshot({ path:"/tmp/autosave_after.png", fullPage:true });

// Consulta o banco via API pública pra ver se persistiu
const check = await page.evaluate(async (id) => {
  const url = "https://hbxpilrxmitvzebluoom.supabase.co/rest/v1/fiscal_laudos?id=eq." + id + "&select=observacoes,updated_at";
  const key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhieHBpbHJ4bWl0dnplYmx1b29tIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI5NDI1MjcsImV4cCI6MjA4ODUxODUyN30.ciZA1H-UvlYG2OPWqrFChj-_ttiFD5W5BmrST-gUJ-0";
  const r = await fetch(url, { headers: { apikey: key, Authorization: "Bearer " + key }});
  return await r.json();
}, LAUDO_ID);
console.log("DB observacoes:", check[0]?.observacoes?.slice(0,80));
console.log("Persistiu autosave:", check[0]?.observacoes?.includes(TESTE_TXT));

// Também reload e vê se restaura na tela
await page.reload({ waitUntil:"networkidle" });
await page.waitForTimeout(3500);
// Vai de novo pelo caminho até o laudo
await page.locator('.stats-row', { timeout:15000 }).waitFor().catch(()=>{});
console.log("Após reload URL:", page.url());
await browser.close();
