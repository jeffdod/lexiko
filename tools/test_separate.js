// "Study more today" is a separate unlock for words and for parsing: pressing one never opens the other.
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(), p = await b.newPage({ viewport: { width: 390, height: 860 } }); const errs = [];
  p.on('pageerror', (e) => errs.push(String(e)));
  const ok = (c, m) => { if (!c) { console.log('FAIL: ' + m); process.exitCode = 1; } };
  await p.goto('http://localhost:8123/lexiko/#/home'); await p.waitForSelector('#nav a[data-tab]');
  await p.evaluate(async () => { const K = await import('/lexiko/js/know.js'); await K.setLevel(50); await K.setSetting('levelAsked', true); await K.setSetting('parseAsked', true); await K.setSetting('gates', K.allGatesOpen()); });
  const r = await p.evaluate(async () => {
    const k = await import('/lexiko/js/know.js'), { todayKey } = await import('/lexiko/js/util.js');
    const d = (k.K.daily[todayKey()] ||= {}), clean = () => { for (const f of ['more', 'mw', 'mp', 'wc', 'wcm', 'pc', 'pcm']) delete d[f]; };
    const snap = () => ({ w: k.wordsPace().left, p: k.parsePace().left, mw: k.moreUnlocked('words'), mp: k.moreUnlocked('parse') });
    clean(); const base = snap();
    await k.unlockMore('parse'); const afterP = snap(); clean();
    await k.unlockMore('words'); const afterW = snap(); clean();
    return { base, afterP, afterW };
  });
  ok(r.afterP.mp && !r.afterP.mw, 'parse unlock flags only parsing: ' + JSON.stringify(r.afterP));
  ok(r.afterP.w === r.base.w, 'parse unlock leaves the new-word allowance alone: ' + JSON.stringify(r));
  ok(r.afterP.p > r.base.p, 'parse unlock adds new forms: ' + JSON.stringify(r));
  ok(r.afterW.mw && !r.afterW.mp, 'words unlock flags only words: ' + JSON.stringify(r.afterW));
  ok(r.afterW.p === r.base.p, 'words unlock leaves the new-form allowance alone: ' + JSON.stringify(r));
  ok(r.afterW.w > r.base.w, 'words unlock adds new words: ' + JSON.stringify(r));
  ok(errs.length === 0, 'no page errors: ' + errs.join(' | '));
  await b.close(); console.log(process.exitCode ? 'separate: FAILED' : 'separate: ok');
})();
