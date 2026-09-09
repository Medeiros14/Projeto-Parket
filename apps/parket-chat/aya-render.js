const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage();
  await p.goto('https://proposta.parket.works/proposta/d6ea9414-c447-4a19-a792-6f9641923de6', {waitUntil:'domcontentloaded', timeout:60000});
  // wait for text to appear
  for (let i=0; i<60; i++) {
    const t = await p.evaluate(() => document.body.innerText.length);
    if (t > 500) { console.log(`ready after ${i}s, len=${t}`); break; }
    await p.waitForTimeout(1000);
  }
  await p.waitForTimeout(3000);
  const html = await p.content();
  require('fs').writeFileSync('/tmp/aya-rendered.html', html);
  const text = await p.evaluate(() => document.body.innerText);
  require('fs').writeFileSync('/tmp/aya-text.txt', text);
  // Screenshot
  await p.screenshot({path:'/tmp/aya.png', fullPage:true});
  console.log('done. HTML:', html.length, 'TXT:', text.length);
  await b.close();
})();
