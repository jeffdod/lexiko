// Missed words: a retry round, then up to two multiple-choice rescues a few cards later in the same round, then stop. node tools/test_retry.js (server on :8123)
const { chromium } = require('playwright');
const URL = 'http://localhost:8123/lexiko/';
let fails = 0; const ok = (c, m, x = '') => { console.log((c ? '  ok  ' : '  FAIL ') + m + (x ? ' ' + x : '')); if (!c) fails++; };
process.on('unhandledRejection', (e) => { console.log('UNHANDLED', e && e.message); process.exit(1); });
(async () => {
  const b = await chromium.launch(); const p = await (await b.newContext({ viewport: { width: 390, height: 844 } })).newPage(); const errs = [];
  p.on('pageerror', (e) => errs.push(e.message));
  await p.goto(URL); await p.waitForSelector('#nav a[data-tab]', { timeout: 60000 });
  // the rule itself
  const r = await p.evaluate(async () => { const { missOutcome } = await import('./js/retry.js'); const a = {}, o = [];
    o.push(missOutcome(a, false), missOutcome(a, true), missOutcome(a, true), missOutcome(a, true), missOutcome(a, true), missOutcome(a, false));
    const b2 = {}; o.push(missOutcome(b2, true), missOutcome(b2, false)); return o; });
  ok(JSON.stringify(r) === JSON.stringify(['pass', 'retry', 'rescue', 'rescue', 'stop', 'pass', 'retry', 'pass']), 'first Again retries, the next two are rescues, the fourth stops; Hard/Good pass', JSON.stringify(r));
  // a vocabulary session: always answering Again
  await p.evaluate(async () => { const k = await import('./js/know.js'); const { D } = await import('./js/data.js'); await k.setSetting('mode', 'flash');
    const ns = D.lex.filter((L) => L.pos !== 'V').slice(20, 22).map((L) => L.n); for (const n of ns) await k.rate(n, 3, 'new'); });
  await p.goto(URL + '#/learn/practice/recent'); await p.reload(); await p.waitForSelector('.qcard');
  let steps = 0, rescues = 0, flashAfter = 0;
  while (steps < 16 && !(await p.$('.pagehead h1:has-text("complete")'))) {
    steps++;
    if (await p.$('.rescue-note')) { rescues++; ok(!!(await p.$('.opts .opt')), 'a rescue is multiple choice'); await p.click('text=I don’t know'); await p.click('text=Continue'); }
    else { await p.click('text=Show answer'); await p.click('.grades .g1'); }
    await p.waitForTimeout(150);
  }
  ok(await p.$('.pagehead h1:has-text("complete")') != null, 'the session ends instead of looping', steps + ' answers');
  ok(rescues === 4 && steps === 8, 'two words, each missed 4 times: a retry, then two rescues in the same round (8 answers, 4 of them rescues)', rescues + '/' + steps);
  ok(errs.length === 0, 'no page errors', errs.join('|'));
  await b.close(); console.log(fails ? fails + ' FAILED' : 'ALL OK'); process.exit(fails ? 1 : 0);
})();
