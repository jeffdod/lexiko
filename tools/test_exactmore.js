// The "Study more" offer is counted from the session it starts, so its total always matches.
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
    const d = (k.K.daily[todayKey()] ||= {}); delete d.wc; delete d.wcm; delete d.more; d.n = 10;       // today's allowance used up
    out.done = S.counts().words; out.more = S.moreReady('words');
    await k.unlockMore();                                                                           // press "Study more today"
    const items = k.buildSession({ kind: 'daily' }); out.after = { review: items.filter((x) => x.type === 'review').length, fresh: items.filter((x) => x.type === 'new').length, checkins: items.filter((x) => x.type === 'probe').length };
    out.counts = S.counts().words; delete d.more; delete d.wc; delete d.wcm; d.n = 0; return out;
  });
  ok(r.done.fresh === 0 && r.more.fresh > 0, 'done today, but more is available: ' + JSON.stringify([r.done, r.more]));
  ok(r.more.reviews === r.after.review && r.more.fresh === r.after.fresh && r.more.checkins === r.after.checkins, 'the offer matches the session it starts: ' + JSON.stringify([r.more, r.after]));
  ok(r.counts.total === r.after.review + r.after.fresh + r.after.checkins, 'the Home total matches after asking for more: ' + JSON.stringify(r.counts));
  ok(errs.length === 0, 'no page errors: ' + errs.join(' | '));
  await b.close(); console.log(process.exitCode ? 'exactmore: FAILED' : 'exactmore: ok');
})();
