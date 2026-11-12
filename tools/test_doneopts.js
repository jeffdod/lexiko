// Reading options: no X, a Done button that closes the popup, and the options still apply as you change them.
const { chromium } = require('playwright');
const URL = 'http://localhost:8123/lexiko/';
let bad = 0; const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) bad++; };
(async () => {
  const b = await chromium.launch(), p = await (await b.newContext({ viewport: { width: 390, height: 700 } })).newPage();
  await p.goto(URL + '#/home');
  await p.evaluate(async () => { const k = await import('/lexiko/js/know.js'); await k.setLevel(50); await k.setSetting('levelAsked', true); });
  await p.goto(URL + '#/read/JHN/1'); await p.waitForSelector('.reader .w');
  await p.click('button[aria-label="Reading options"]'); await p.waitForSelector('dialog[open]');
  ok(await p.locator('dialog[open] [aria-label="Close"]').count() === 0, 'no X in Reading options');
  const done = p.locator('dialog[open] button:has-text("Done")');
  ok(await done.count() === 1 && /saved as you go/.test(await p.locator('dialog[open] .dfoot').innerText()), 'Done button and the saved-as-you-go note');
  const box = await done.boundingBox(), vp = p.viewportSize();
  ok(box && box.y + box.height <= vp.height, 'Done is in view without scrolling the options');
  const d = await done.evaluate((el) => { const r = document.createRange(); r.selectNodeContents(el); const t = r.getBoundingClientRect(), e = el.getBoundingClientRect(); return [Math.abs((t.left + t.width / 2) - (e.left + e.width / 2)), Math.abs((t.top + t.height / 2) - (e.top + e.height / 2))]; });
  ok(d[0] < 1.5 && d[1] < 2, 'Done text is centered ' + d.map((x) => x.toFixed(1)));
  const before = await p.evaluate(async () => (await import('/lexiko/js/know.js')).setting('verseNums'));
  await p.locator('dialog[open] label.switch:has-text("Verse numbers") input').evaluate((el) => el.click());
  const after = await p.evaluate(async () => (await import('/lexiko/js/know.js')).setting('verseNums'));
  ok(before !== after, 'a switch applies at once, before Done');
  await done.click(); await p.waitForTimeout(200);
  ok(await p.locator('dialog[open]').count() === 0, 'Done closes the popup');
  ok(await p.evaluate(async () => (await import('/lexiko/js/know.js')).setting('verseNums')) === after, 'the change is kept after Done');
  await p.click('button[aria-label="Reading options"]'); await p.waitForSelector('dialog[open]'); await p.keyboard.press('Escape'); await p.waitForTimeout(200);
  ok(await p.locator('dialog[open]').count() === 0, 'Escape still closes it');
  await b.close(); process.exit(bad ? 1 : 0);
})();
