// Parsing: a form missed twice (or a bad streak) gets the easier "pick the whole parsing" question. node tools/test_parsetry.js (server on :8123)
const { chromium } = require('playwright');
const URL = 'http://localhost:8123/lexiko/';
let fails = 0; const ok = (c, m, x = '') => { console.log((c ? '  ok  ' : '  FAIL ') + m + (x ? ' ' + x : '')); if (!c) fails++; };
process.on('unhandledRejection', (e) => { console.log('UNHANDLED', e && e.message); process.exit(1); });
(async () => {
  const b = await chromium.launch(); const p = await (await b.newContext({ viewport: { width: 390, height: 844 } })).newPage(); const errs = [];
  p.on('pageerror', (e) => errs.push(e.message));
  const ready = async () => { await p.waitForSelector('#nav a[data-tab]', { timeout: 60000 }); await p.waitForFunction(() => !document.getElementById('loading')); };
  await p.goto(URL); await ready();
  await p.evaluate(async () => { const k = await import('./js/know.js'); await k.setLevel(500); await k.setSetting('levelAsked', true); await k.setSetting('parseAsked', true); await k.setSetting('parseMode', 'guided'); await k.setSetting('sessionSize', 1); await k.setSetting('parseNewPerDay', 5); await k.setSetting('parsePace', 'fixed'); });
  await p.goto(URL + '#/parse/run/noun'); await p.reload(); await ready(); await p.waitForSelector('.pcard');
  const miss = async () => { await p.click('text=I don’t know'); await p.click('.qwrap .btn.primary.block'); await p.waitForTimeout(200); };
  await miss();                                                    // first try: missed
  ok(/Once more/.test(await p.textContent('.qwrap')), 'a first miss gets the usual retry');
  await miss();                                                    // the retry: missed again
  ok(/One more try/.test(await p.textContent('.qwrap')) && (await p.$$('.opts .opt')).length === 4, 'a second miss gets four whole parsings to choose from');
  const labels = await p.$$eval('.opts .opt span:first-child', (e) => e.map((x) => x.textContent));
  ok(new Set(labels).size === 4 && labels.every((l) => l.includes(' · ')), 'four different whole parsings', labels.join(' | '));
  ok(!/when it is due/.test(await p.textContent('.qwrap')), 'no vague "when it is due" wording');
  await p.click('.opts .opt >> nth=0');
  const t = await p.textContent('.rescue-note >> nth=1');
  ok(/That’s enough for this one\. You’ll see this form again in (a minute or so|about)/.test(t), 'after answering it says when the form comes back', t.trim());
  await p.click('.qwrap .btn.primary.block'); await p.waitForTimeout(300);
  ok(!!(await p.$('.pagehead h1:has-text("complete")')) || !(await p.$('.opts .opt')), 'and it stops there: no more questions for that form');
  ok(errs.length === 0, 'no page errors', errs.join('|'));
  await b.close(); console.log(fails ? fails + ' FAILED' : 'ALL OK'); process.exit(fails ? 1 : 0);
})();
