// The back arrow never points at the screen you are on: node tools/test_backdup.js (server on :8123)
const { chromium } = require('playwright');
const URL = 'http://localhost:8123/lexiko/';
let fails = 0; const ok = (c, m, x = '') => { console.log((c ? '  ok  ' : '  FAIL ') + m + (x ? ' ' + x : '')); if (!c) fails++; };
(async () => {
  const b = await chromium.launch(); const p = await (await b.newContext({ viewport: { width: 390, height: 844 } })).newPage(); const errs = [];
  p.on('pageerror', (e) => errs.push(e.message));
  await p.goto(URL); await p.waitForSelector('#nav a[data-tab]', { timeout: 60000 });
  // 1) the trail: Study > Parsing > a quiz that has nothing to ask and sends you back to Parsing
  const r = await p.evaluate(async () => {
    const u = await import('./js/util.js?fresh=1');
    u.noteRoute('#/study'); u.noteRoute('#/parse'); u.noteRoute('#/parse/run/mix/all'); u.redirect('#/parse'); u.noteRoute('#/parse');
    return { target: u.backTarget() };
  });
  ok(r.target === '#/study', 'after a quiz redirects back to Parsing the arrow still goes to Study', JSON.stringify(r));
  // 2) in the real app: the Parsing arrow always leads somewhere else
  await p.goto(URL + '#/home'); await p.goto(URL + '#/study'); await p.goto(URL + '#/parse'); await p.waitForSelector('.pagehead a');
  const before = await p.evaluate(() => location.hash); await p.click('.pagehead a'); await p.waitForTimeout(400);
  ok(await p.evaluate(() => location.hash) !== before, 'tapping the arrow on Parsing leaves the page', before + ' -> ' + await p.evaluate(() => location.hash));
  ok(errs.length === 0, 'no page errors', errs.join('|'));
  await b.close(); console.log(fails ? fails + ' FAILED' : 'ALL OK'); process.exit(fails ? 1 : 0);
})();
