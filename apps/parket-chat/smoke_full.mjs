import { chromium } from "playwright";
import fs from "fs";

const session = JSON.parse(fs.readFileSync("/tmp/session_alvaro.json","utf8"));
const results = [];
const log = (name, ok, detail="") => { results.push({ name, ok, detail }); console.log(`[${ok?"OK":"FAIL"}] ${name}${detail?" — "+detail:""}`); };

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport:{width:390,height:844}, deviceScaleFactor:2, isMobile:true, hasTouch:true });
await ctx.addInitScript(sess => localStorage.setItem("parket-fiscal-auth", JSON.stringify(sess)), session);
const page = await ctx.newPage();
const jsErrs = [];
page.on("console", m => { if (m.type()==="error") jsErrs.push(m.text()); });
page.on("dialog", async d => { console.log(`[ALERT] ${d.message()}`); await d.dismiss(); });

// 1) LOGIN via session + HOME
try {
  await page.goto("https://verifica.parket.works/", { waitUntil:"networkidle" });
  await page.waitForTimeout(3000);
  const bodyText = await page.evaluate(() => document.body.innerText);
  log("login+home", bodyText.includes("PENDENTE") || bodyText.includes("PRÓX"), `stats visíveis`);
} catch (e){ log("login+home", false, e.message); }

// 2) STATS: Próx visita / Visitas vencidas / Concluídos labels
try {
  const stats = await page.evaluate(() => {
    return [...document.querySelectorAll(".stats-row .stat")].map(s => ({
      n: s.querySelector(".n")?.textContent?.trim(),
      l: s.querySelector(".l")?.textContent?.trim(),
      goto: s.dataset.goto,
    }));
  });
  const proximas = stats.find(s=>s.goto==="proximas");
  const vencidos = stats.find(s=>s.goto==="vencidos");
  const conc     = stats.find(s=>s.goto==="concluidos");
  log("stat proximas", proximas && /Próx\. visita/.test(proximas.l), `label="${proximas?.l}" n=${proximas?.n}`);
  log("stat vencidos", vencidos && /Visita[s]? vencida/.test(vencidos.l), `label="${vencidos?.l}" n=${vencidos?.n}`);
  log("stat concluidos", conc && /Concluído/.test(conc.l), `label="${conc?.l}" n=${conc?.n}`);
  log("removed pendentes stat", !stats.find(s=>s.goto==="paraFazer"), `paraFazer stat sumiu`);
} catch (e){ log("stats-check", false, e.message); }

// 3) Próxima visita highlight não mostra UUID
try {
  const nv = await page.locator('.next-visit').textContent();
  const uuidRegex = /[0-9a-f]{8}-[0-9a-f]{4}/;
  log("proxima-visita sem UUID", !uuidRegex.test(nv), `texto="${nv?.slice(0,90)}"`);
} catch (e){ log("proxima-visita", false, e.message); }

// 4) Sections lista tem "Visitas vencidas", não "Para fazer"
try {
  const sections = await page.evaluate(() => [...document.querySelectorAll('[data-sect]')].map(s => ({ key: s.dataset.sect, titulo: s.querySelector(".t")?.textContent?.trim() })));
  log("section vencidos", sections.some(s=>s.key==="vencidos"), sections.map(s=>s.titulo).join(" | "));
  log("removed section paraFazer", !sections.some(s=>s.key==="paraFazer"), "");
} catch (e){ log("sections", false, e.message); }

// 5) Click Vencidos → drilldown
try {
  await page.locator('[data-goto="vencidos"]').click();
  await page.waitForTimeout(1500);
  const title = await page.evaluate(() => document.querySelector(".sect-h .t")?.textContent?.trim());
  const clientCount = await page.evaluate(() => document.querySelectorAll(".lcard").length);
  log("drilldown vencidos", /Visita[s]? vencida/.test(title||""), `title="${title}" clientes=${clientCount}`);
} catch (e){ log("drilldown vencidos", false, e.message); }

// 6) Click cliente com >1 vencido → dentro do cliente (nivel 2)
try {
  await page.locator('.lcli:has-text("FELIPE ALMEIDA")').first().click();
  await page.waitForTimeout(1200);
  const items = await page.locator('.lcard').count();
  log("nivel 2 FELIPE ALMEIDA", items >= 1, `${items} agendas vencidas`);
} catch (e){ log("nivel 2", false, e.message); }

// 7) Click vencido → modal Justificar
try {
  await page.locator('.lcard:has(.tag:text-is("vencido"))').first().click();
  await page.waitForTimeout(700);
  const modalOK = await page.evaluate(() => !!document.querySelector('textarea[data-just]'));
  const titulo = await page.evaluate(() => document.querySelector('.h2')?.textContent?.trim());
  const radios = await page.locator('input[name="reag_acao"]').count();
  log("modal justificar", modalOK, `titulo="${titulo}" radios=${radios}`);
} catch (e){ log("modal justificar", false, e.message); }

// 8) Radio "Fazer agora" esconde data picker e troca botão
try {
  await page.locator('input[value="agora"]').click();
  await page.waitForTimeout(300);
  const dataHidden = await page.evaluate(() => getComputedStyle(document.querySelector('[data-nova-wrap]')).display === "none");
  const btnTxt = await page.evaluate(() => document.querySelector('[data-save]')?.textContent?.trim());
  log("toggle fazer agora", dataHidden && /FAZER AGORA/i.test(btnTxt||""), `datePicker.display=${dataHidden?"none":"vis"} btn="${btnTxt}"`);
  // volta pra Reagendar
  await page.locator('input[value="reagendar"]').click();
  await page.waitForTimeout(300);
  const dataVis = await page.evaluate(() => getComputedStyle(document.querySelector('[data-nova-wrap]')).display !== "none");
  const btnTxt2 = await page.evaluate(() => document.querySelector('[data-save]')?.textContent?.trim());
  log("toggle reagendar", dataVis && /REAGENDAR/i.test(btnTxt2||""), `datePicker=${dataVis?"vis":"hidden"} btn="${btnTxt2}"`);
} catch (e){ log("toggle radio", false, e.message); }

// 9) Cancelar modal e voltar Home
try {
  await page.locator('[data-cancel]').click();
  await page.waitForTimeout(400);
  const modalGone = !await page.evaluate(() => !!document.querySelector('textarea[data-just]'));
  log("modal cancelar", modalGone, "");
  // volta home
  await page.evaluate(() => history.back());
  await page.waitForTimeout(600);
  await page.evaluate(() => history.back());
  await page.waitForTimeout(1500);
  const back = await page.evaluate(() => !!document.querySelector('.stats-row'));
  log("voltar home", back, "");
} catch (e){ log("cancelar/back", false, e.message); }

// 10) Click Obras → RODRIGO card (tem em_andamento reparo + concluído → dedup)
try {
  await page.locator('[data-sect="obras"]').click();
  await page.waitForTimeout(1200);
  await page.locator('.lcli:has-text("RODRIGO AZEVEDO JUNQUEIRA")').first().click();
  await page.waitForTimeout(1500);
  const secs = await page.evaluate(() => [...document.querySelectorAll("#root .card .h2")].map(h=>h.textContent.trim()));
  const hasPraFazer = secs.some(s => /Pra fazer/i.test(s));
  const hasFeitos = secs.some(s => /Feitos/i.test(s));
  log("RODRIGO sem pra fazer (dedup)", !hasPraFazer, `secs=${secs.join(", ")}`);
  log("RODRIGO tem Feitos", hasFeitos, "");
} catch (e){ log("RODRIGO detail", false, e.message); }

// 11) Voltar + Home
try {
  await page.evaluate(() => history.back());
  await page.waitForTimeout(600);
  await page.evaluate(() => history.back());
  await page.waitForTimeout(1000);
  const home = await page.evaluate(() => !!document.querySelector('.stats-row'));
  log("voltou home", home, "");
} catch (e){ log("home again", false, e.message); }

// 12) Botão Novo Laudo abre o form
try {
  await page.locator('#_novo').click();
  await page.waitForTimeout(1500);
  const formTitle = await page.evaluate(() => document.body.innerText.slice(0, 300));
  const novoOk = /Cliente|Novo laudo|Selecion/i.test(formTitle);
  log("botão Novo Laudo abre form", novoOk, "");
} catch (e){ log("novo laudo", false, e.message); }

await page.screenshot({ path:"/tmp/full_final.png", fullPage:true });

console.log("\n=== RESUMO ===");
const ok = results.filter(r=>r.ok).length;
const fail = results.filter(r=>!r.ok);
console.log(`Passaram: ${ok}/${results.length}`);
if (fail.length){
  console.log("\nFalhas:");
  fail.forEach(f => console.log(` - ${f.name}: ${f.detail}`));
}
if (jsErrs.length){
  console.log("\nJS errors:");
  jsErrs.slice(0,5).forEach(e => console.log(" -", e.slice(0,120)));
}
await browser.close();
process.exit(fail.length ? 1 : 0);
