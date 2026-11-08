// The "Study more" offer and the new-word counts are exact, and a short note says why new words fall below the daily limit.
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(), p = await b.newPage({ viewport: { width: 390, height: 860 } }); const errs = [];
  p.on('pageerror', (e) => errs.push(String(e)));
  const ok = (c, m) => { if (!c) { console.log('FAIL: ' + m); process.exitCode = 1; } };
  const U = 'http://localhost:8123/lexiko/';
  await p.goto(U + '#/home'); await p.waitForSelector('#nav a[data-tab]');
  await p.evaluate(async () => { const K = await import('/lexiko/js/know.js'); await K.setLevel(50); await K.setSetting('levelAsked', true); await K.setSetting('gates', K.allGatesOpen()); await K.setSetting('wordsPace', 'fixed'); });
  const r = await p.evaluate(async () => {
    const k = await import('/lexiko/js/know.js'), S = await import('/lexiko/js/smart.js'), { todayKey } = await import('/lexiko/js/util.js'), out = {};
    const d = (k.K.daily[todayKey()] ||= {}); delete d.wc; delete d.wcm; delete d.more;
    // 2 already learned today: 8 left of 10, and the note says so
    d.n = 2; out.c = S.counts().words; out.note = S.newLimitNote('words');
    // limit used up: no note
    d.n = 10; out.used = S.newLimitNote('words');
    // the offer matches what a session would really teach
    out.more = S.moreReady('words'); const real = k.buildSession({ kind: 'daily', newLimit: 10 }).filter((x) => x.type === 'new').length; out.real = real;
    d.n = 0; return out;
  });
  ok(r.c.fresh === 8 && /^Today’s limit is 10 new words: 2 already learned today\.$/.test(r.note || ''), 'note explains a count below the limit: ' + JSON.stringify([r.c.fresh, r.note]));
  ok(r.used === null, 'no note when the limit is used up');
  ok(r.more.fresh === r.real, 'the offer counts what could really be taught: ' + JSON.stringify([r.more, r.real]));
  await p.goto(U + '#/home'); await p.waitForTimeout(150); await p.goto(U + '#/learn/words'); await p.waitForSelector('.start');
  ok(!/New verbs are paused\. New verbs are paused/.test(await p.locator('body').innerText()), 'no repeated sentence on the verbs card');
  ok(errs.length === 0, 'no page errors: ' + errs.join(' | '));
  await b.close(); console.log(process.exitCode ? 'exactmore: FAILED' : 'exactmore: ok');
})();
