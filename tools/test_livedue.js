// The Parsing page redraws within about a second of the next review coming due, not only at the 30-second check.
const { chromium } = require('playwright');
const ok = (c, m) => { console.log((c ? '  ok  ' : '  FAIL ') + m); if (!c) process.exitCode = 1; };
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 390, height: 844 } });
  const errs = []; p.on('pageerror', (e) => errs.push(String(e)));
  const U = 'http://localhost:8123/lexiko/';
  await p.goto(U + '#/settings'); await p.waitForSelector('#nav a[data-tab]');
  await p.evaluate(async () => { const K = await import('/lexiko/js/know.js'), { D } = await import('/lexiko/js/data.js'), F = await import('/lexiko/js/fsrs.js');
    await K.setLevel(50); await K.setSetting('levelAsked', true); await K.setSetting('parseAsked', true); await K.setSetting('gates', K.allGatesOpen());
    const f = D.forms.find((f) => /^N-/.test(f.an[0].m) && K.status(f.an[0].s) === 'known' && !D.lexByN.get(f.an[0].s).name), id = K.parseId(f), now = Date.now();
    K.K.cards.set(id, { ...F.newCard(id), state: 'learning', stability: 0.5, reps: 1, last: now - 60000, due: now + 8000 }); });
  await p.goto(U + '#/learn'); await p.waitForTimeout(200); await p.goto(U + '#/parse'); await p.waitForSelector('#view .btn.primary');
  const start = Date.now(); let saw = null;
  while (Date.now() - start < 14000) { const t = await p.evaluate(() => (document.querySelector('#view .btn.primary') || {}).textContent || ''); if (/1 due|due/.test(t) && /Practice/.test(t)) { saw = Date.now() - start; break; } await p.waitForTimeout(250); }
  ok(saw !== null && saw < 11500, 'the page shows the form as due within about 3 seconds of its time (' + saw + ' ms after it opened; due at 8000)');
  ok(errs.length === 0, 'no page errors: ' + errs.join(' | '));
  await b.close(); console.log(process.exitCode ? 'livedue: FAILED' : 'livedue: ok');
})();
