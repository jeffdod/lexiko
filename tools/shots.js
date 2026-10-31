// Visual review helper: node tools/shots.js OUTDIR   (server on :8123). Level pre-set to 100+ with a few studied words.
const { chromium } = require('playwright'); const fs = require('fs');
const out = process.argv[2]; fs.mkdirSync(out, { recursive: true });
const U = 'http://localhost:8123/lexiko/';
async function seed(page) {
  await page.goto(U); await page.waitForSelector('#loading', { state: 'detached' });
  await page.evaluate(async () => {
    const k = await import('./js/know.js');
    await k.setLevel(100); await k.setSetting('levelAsked', true);
    for (const n of [3056, 2316, 5457, 746, 2222]) await k.rate(n, 3, 'new');
    await k.rate(4151, 1, 'new'); await k.markRead('JHN', 1, true);
    await k.setGoal({ book: 'JHN', c1: 1, v1: 1, c2: 4, v2: 999 });
  });
}
(async () => {
  const b = await chromium.launch();
  for (const [name, w, h, scheme] of [['m-light', 390, 844, 'light'], ['m-dark', 390, 844, 'dark'], ['d-light', 1280, 860, 'light']]) {
    const ctx = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2, colorScheme: scheme, isMobile: w < 600, hasTouch: w < 600 });
    const page = await ctx.newPage(); await seed(page);
    for (const [tag, hash, full] of [['home', '#/home', true], ['reader-gloss', '#/read/JHN/1', false], ['learn', '#/learn', true], ['progress', '#/progress', true], ['settings', '#/settings', true]]) {
      await page.evaluate((hh) => { location.hash = hh; }, hash); await page.waitForTimeout(250);
      if (tag === 'reader-gloss') { await page.evaluate(async () => { const k = await import('./js/know.js'); await k.setSetting('glossMode', true); }); await page.evaluate(() => { location.hash = '#/read/JHN/2'; }); await page.waitForTimeout(200); await page.evaluate(() => { location.hash = '#/read/JHN/1'; }); await page.waitForSelector('.gl'); }
      await page.screenshot({ path: out + '/' + name + '-' + tag + '.png', fullPage: full });
    }
    await ctx.close();
  }
  await b.close();
})();
