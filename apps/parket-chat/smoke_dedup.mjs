import { chromium } from "playwright";
import fs from "fs";

const session = JSON.parse(fs.readFileSync("/tmp/session_alvaro.json", "utf8"));
const CARD_RODRIGO = "efbfb1fc-b1b9-4b21-b13c-fd5f5f0a2eec"; // tem rascunho + concluído do mesmo tipo (reparo)
const CARD_BRUNO = "d7178eb2-140f-4c4e-b934-99ed03508bbd"; // só tem rascunho 1ª vistoria — não deve deduplicar

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
const page = await ctx.newPage();
page.on("console", m => { if (m.type() === "error") console.log("[console.err]", m.text().slice(0, 200)); });

await page.goto("https://verifica.parket.works/", { waitUntil: "domcontentloaded" });
await page.evaluate((s) => { localStorage.setItem("parket-fiscal-auth", JSON.stringify(s)); }, session);
await page.goto("https://verifica.parket.works/", { waitUntil: "networkidle" });
await page.waitForTimeout(2500);
if ((await page.locator("text=Failed to fetch").count()) > 0) { await page.reload({ waitUntil: "networkidle" }); await page.waitForTimeout(2500); }

// ── Home: contadores
const homeBody = await page.evaluate(() => document.body.innerText);
const homePend = (homeBody.match(/(\d+)\s*\n?Pendentes/i) || [])[1];
console.log("home pendentes stat:", homePend);
await page.screenshot({ path: "/tmp/smoke_dedup_home.png" });

// Navega direto ao card do RODRIGO via hash (renderObraDetail via popstate/dispatchView)
await page.evaluate((id) => { location.hash = "obra"; history.replaceState({ view: "obra", params: { id } }, "", "#obra"); dispatchEvent(new PopStateEvent("popstate", { state: { view: "obra", params: { id } } })); }, CARD_RODRIGO);
// Fallback direto: usa hashchange não funciona — vou clicar no card via a Home
// Volta pra home e usa a busca por texto do card
await page.goto("https://verifica.parket.works/", { waitUntil: "networkidle" });
await page.waitForTimeout(2500);
// clica no stat Pendentes se tiver algo, senão vai por Minhas obras
const obrasStat = page.locator(".stat", { hasText: /Minhas obras|Obras/i }).first();
if (await obrasStat.count()) { await obrasStat.click(); await page.waitForTimeout(1500); }
// procura RODRIGO
const rodrigo = page.locator("text=RODRIGO AZEVEDO JUNQUEIRA").first();
if (await rodrigo.count()) {
  await rodrigo.click();
  await page.waitForTimeout(2500);
  const b = await page.evaluate(() => document.body.innerText);
  const temPraFazer = /Pra fazer/i.test(b);
  const temFeitos = /Feitos/i.test(b);
  const temAgendamento = /Agendamentos/i.test(b);
  console.log("RODRIGO — Pra fazer:", temPraFazer ? "APARECE (FAIL)" : "sumiu (PASS)");
  console.log("RODRIGO — Feitos:", temFeitos ? "PASS" : "FAIL");
  console.log("RODRIGO — Agendamentos:", temAgendamento ? "APARECE" : "sumiu");
  await page.screenshot({ path: "/tmp/smoke_dedup_rodrigo.png", fullPage: true });
} else {
  console.log("FAIL — RODRIGO não encontrado na lista");
}

// Volta e testa BRUNO (não deve deduplicar — só tem rascunho, sem concluído)
await page.goto("https://verifica.parket.works/", { waitUntil: "networkidle" });
await page.waitForTimeout(2500);
const obrasStat2 = page.locator(".stat", { hasText: /Minhas obras|Obras/i }).first();
if (await obrasStat2.count()) { await obrasStat2.click(); await page.waitForTimeout(1500); }
const bruno = page.locator("text=Bruno Colodetti").first();
if (await bruno.count()) {
  await bruno.click();
  await page.waitForTimeout(2500);
  const b = await page.evaluate(() => document.body.innerText);
  const temPraFazer = /Pra fazer/i.test(b);
  console.log("BRUNO — Pra fazer:", temPraFazer ? "PASS (mantém)" : "FAIL (sumiu)");
  await page.screenshot({ path: "/tmp/smoke_dedup_bruno.png", fullPage: true });
} else {
  console.log("FAIL — Bruno não encontrado");
}

await browser.close();
