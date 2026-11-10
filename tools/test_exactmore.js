// The "Study more" offer is counted by previewing the unlock, so its total always matches the session the button starts,
// including after the learner has already asked for more once (more learned today than the original allowance).
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(), p = await b.newPage({ viewport: { width: 390, height: 860 } }); const errs = [];
  p.on('pageerror', (e) => errs.push(String(e)));
  const ok = (c, m) => { if (!c) { console.log('FAIL: ' + m); process.exitCode = 1; } };
  const U = 'http://localhost:8123/lexiko/';
  await p.goto(U + '#/home'); await p.waitForSelector('#nav a[data-tab]');
  await p.evaluate(async () => { const K = await import('/lexiko/js/know.js'); await K.setLevel(50); await K.setSetting('levelAsked', true); await K.setSetting('parseAsked', true); await K.setSetting('gates', K.allGatesOpen()); await K.setSetting('wordsPace', 'fixed'); });
  const r = await p.evaluate(async () => {
    const k = await import('/lexiko/js/know.js'), S = await import('/lexiko/js/smart.js'), { todayKey } = await import('/lexiko/js/util.js'), out = [];
    const d = (k.K.daily[todayKey()] ||= {});
    for (const today of [10, 24, 44]) {                         // allowance used up; learned more than the allowance (asked for more earlier); asked twice
      d.n = today; delete d.wc; delete d.wcm; delete d.more; delete d.mw; delete d.mp; delete d.pc; delete d.pcm;
      const offer = S.moreReady('words');
      await k.unlockMore();
      const items = k.buildSession({ kind: 'daily' }), c = (t) => items.filter((x) => x.type === t).length;
      out.push({ today, offer, real: { reviews: c('review'), fresh: c('new'), checkins: c('probe') } });
      delete d.more; delete d.mw; delete d.mp; delete d.pc; delete d.pcm; delete d.wc; delete d.wcm;
    }
    d.n = 0; return out;
  });
  for (const x of r) { ok(JSON.stringify(x.offer) === JSON.stringify(x.real), 'offer equals the session it starts (learned today ' + x.today + '): ' + JSON.stringify([x.offer, x.real])); ok(x.offer.fresh > 0, 'a full allowance of new words is on offer (learned today ' + x.today + ')'); }
  ok(errs.length === 0, 'no page errors: ' + errs.join(' | '));
  await b.close(); console.log(process.exitCode ? 'exactmore: FAILED' : 'exactmore: ok');
})();
