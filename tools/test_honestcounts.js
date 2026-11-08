// Home badges and the Start button tell the whole truth: due, new and check-ins are counted from the session itself.
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(), p = await b.newPage({ viewport: { width: 390, height: 860 } }); const errs = [];
  p.on('pageerror', (e) => errs.push(String(e)));
  const ok = (c, m) => { if (!c) { console.log('FAIL: ' + m); process.exitCode = 1; } };
  const U = 'http://localhost:8123/lexiko/';
  await p.goto(U + '#/home'); await p.waitForSelector('#nav a[data-tab]');
  await p.evaluate(async () => { const K = await import('/lexiko/js/know.js'); await K.setLevel(50); await K.setSetting('levelAsked', true); await K.setSetting('gates', K.allGatesOpen()); });
  const r = await p.evaluate(async () => {
    const k = await import('/lexiko/js/know.js'), F = await import('/lexiko/js/fsrs.js'), S = await import('/lexiko/js/smart.js'), now = Date.now(), DAY = 864e5;
    for (const n of [1510, 3004, 2316]) k.K.cards.set('w:' + n, { ...F.newCard('w:' + n), state: 'review', stability: 5, reps: 3, last: now - 3 * DAY, due: now - DAY });
    const c = S.counts().words, items = k.buildSession({ kind: 'daily' }), n = (t) => items.filter((x) => x.type === t).length;
    return { c, real: { due: n('review'), fresh: n('new'), checkins: n('probe') }, label: S.smart('words').sub, total: items.length };
  });
  ok(r.c.sessionDue === 3 && r.c.fresh === r.real.fresh && r.c.checkins === r.real.checkins && r.c.checkins > 0, 'counts match the real session ' + JSON.stringify([r.c, r.real]));
  ok(r.label === '3 due + ' + r.c.fresh + ' new + ' + r.c.checkins + (r.c.checkins === 1 ? ' check-in' : ' check-ins'), 'button line lists all three parts: ' + r.label);
  const sum = (r.label.match(/\d+/g) || []).reduce((a, x) => a + +x, 0); ok(sum === r.total, 'the numbers add up to the cards in the session (' + sum + ' vs ' + r.total + ')');
  await p.goto(U + '#/learn'); await p.waitForTimeout(150); await p.goto(U + '#/home'); await p.waitForSelector('a.area');
  const badges = await p.locator('a.area').nth(0).locator('.badges em').allInnerTexts();
  ok(JSON.stringify(badges) === JSON.stringify(['3 due', r.c.fresh + ' new', r.c.checkins + (r.c.checkins === 1 ? ' check-in' : ' check-ins')]), 'Vocabulary tile has a badge per part: ' + JSON.stringify(badges));
  const pb = await p.locator('a.area').nth(1).locator('.badges em').allInnerTexts(); ok(pb.every((t) => /^\d+ (due|new)$/.test(t)), 'Parsing tile badges: ' + JSON.stringify(pb));
  await p.goto(U + '#/learn/words'); await p.waitForSelector('.start');
  ok(/Check-ins are quick spot-checks of words you said you already know\./.test(await p.locator('body').innerText()), 'check-ins are explained on the Vocabulary page');
  await p.goto(U + '#/home'); await p.waitForSelector('a.area');
  const centered = await p.locator('a.area').nth(0).locator('.badges em').evaluateAll((es) => es.map((e) => { const r = document.createRange(); r.selectNodeContents(e); const a = r.getBoundingClientRect(), c = e.getBoundingClientRect(); return Math.abs((a.top + a.bottom) / 2 - (c.top + c.bottom) / 2) <= 2 && Math.abs((a.left + a.right) / 2 - (c.left + c.right) / 2) <= 2; }));
  ok(centered.every(Boolean), 'badge text is centered ' + JSON.stringify(centered));
  ok(errs.length === 0, 'no page errors: ' + errs.join(' | '));
  await b.close(); console.log(process.exitCode ? 'honestcounts: FAILED' : 'honestcounts: ok');
})();
