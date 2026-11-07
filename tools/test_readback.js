// The reader has a way back when opened from search. node tools/test_readback.js (server on :8123)
const { chromium } = require('playwright');
const URL = 'http://localhost:8123/lexiko/';
let fails = 0; const ok = (c, m, x = '') => { console.log((c ? '  ok  ' : '  FAIL ') + m + (x ? ' ' + x : '')); if (!c) fails++; };
process.on('unhandledRejection', (e) => { console.log('UNHANDLED', e && e.message); process.exit(1); });
(async () => {
  const b = await chromium.launch(); const p = await (await b.newContext({ viewport: { width: 390, height: 844 } })).newPage(); const errs = [];
  p.on('pageerror', (e) => errs.push(e.message));
  await p.goto(URL); await p.waitForSelector('#nav a[data-tab]', { timeout: 60000 });
  await p.evaluate(() => { location.hash = '#/search'; }); await p.waitForSelector('#sq');
  ok(!(await p.$('.readback')), 'search itself has no reader back link');
  await p.evaluate(() => { location.hash = '#/read/JHN/3/16'; }); await p.waitForSelector('.reader');
  const t = await p.textContent('.readback');
  ok(/Back to Glossary/.test(t) && !/(null|undefined)/.test(await p.textContent('#view')), 'reader opened from search offers Back to Glossary', t.trim());
  await p.click('a[aria-label="Next chapter"]'); await p.waitForSelector('.reader');
  ok(!!(await p.$('.readback')), 'still there after changing chapter');
  await p.click('.readback a'); await p.waitForSelector('#sq');
  ok(/#\/search/.test(p.url()), 'it returns to search');
  await p.evaluate(() => { location.hash = '#/home'; }); await p.waitForTimeout(200);
  await p.evaluate(() => { location.hash = '#/read/JHN/1'; }); await p.waitForSelector('.reader');
  ok(!(await p.$('.readback')), 'no back link when the reader is opened from Home');
  ok(errs.length === 0, 'no page errors', errs.join('|'));
  await b.close(); console.log(fails ? fails + ' FAILED' : 'ALL OK'); process.exit(fails ? 1 : 0);
})();
