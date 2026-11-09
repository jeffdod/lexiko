// Words still unsettled at the end of a session come back together once, 10 minutes later; held a second time they wait for the next study day.
// node tools/test_hold.js (server on :8123)
const { chromium } = require('playwright');
const URL = 'http://localhost:8123/lexiko/';
let fails = 0; const ok = (c, m, x = '') => { console.log((c ? '  ok  ' : '  FAIL ') + m + (x ? ' ' + x : '')); if (!c) fails++; };
process.on('unhandledRejection', (e) => { console.log('UNHANDLED', e && e.message); process.exit(1); });
(async () => {
  const b = await chromium.launch(); const p = await (await b.newContext({ viewport: { width: 390, height: 844 } })).newPage(); const errs = [];
  p.on('pageerror', (e) => errs.push(e.message));
  await p.goto(URL + '#/home'); await p.waitForSelector('#nav a[data-tab]', { timeout: 60000 });
  // the rule, on cards made by hand
  const r = await p.evaluate(async () => {
    const K = await import('./js/know.js'), C = await import('./js/clock.js'); await K.setLevel(50); K.setSetting('levelAsked', true);
    const ns = [2316, 3056, 1161, 2424]; const gr = [1, 2, 3, 4];
    for (let i = 0; i < 4; i++) await K.rate(ns[i], gr[i], 'new', 3000);          // Again, Hard, Good, Easy on first sight
    const now = C.clockNow(); const h1 = await K.holdToday(ns, now);
    const due = (n) => K.K.cards.get('w:' + n).due - now;
    const first = { h1, due: ns.map(due), dfr: ns.map((n) => K.K.cards.get('w:' + n).dfr || null) };
    const dueIn = (min) => K.dueCards(now + min * 60000).map((c) => c.id).filter((i) => ns.map((n) => 'w:' + n).includes(i));
    first.in5 = dueIn(5); first.in11 = dueIn(11);
    const h2 = await K.holdToday(ns, now + 11 * 60000);            // still unsettled on the second visit
    return { first, h2, due2: ns.map((n) => K.K.cards.get('w:' + n).due - (now + 11 * 60000)), hold: K.HOLD_MIN };
  });
  ok(r.first.h1.later === 2 && r.first.h1.tomorrow === 0, 'the two unsettled words (Again, Hard) are held; Good and Easy are left alone', JSON.stringify(r.first.h1));
  ok(r.first.due[0] === r.first.due[1] && r.first.due[0] === r.hold * 60000, 'they come back together, ' + r.hold + ' minutes later', JSON.stringify(r.first.due));
  ok(r.first.in5.length === 0 && r.first.in11.length === 2, 'not due after 5 minutes, both due after 11', JSON.stringify([r.first.in5, r.first.in11]));
  ok(r.first.dfr[2] === null && r.first.dfr[3] === null, 'settled words are not marked');
  ok(r.h2.later === 0 && r.h2.tomorrow === 2 && r.due2[0] > 5 * 3600 * 1000, 'held a second time today: due on the next study day, not minutes', JSON.stringify([r.h2, r.due2[0]]));
  // a real session, always answering Again: one set of unsettled words and a card that says so
  await p.evaluate(async () => { const K = await import('./js/know.js'); await K.setSetting('mode', 'flash'); });
  await p.goto(URL + '#/learn/daily'); await p.reload(); await p.waitForSelector('.qcard');
  let steps = 0, sawRetry = false, sawLeft = false;
  while (steps < 120 && !(await p.$('.pagehead h1:has-text("complete")'))) {
    steps++;
    if (await p.$('.rescue-note')) { await p.click('text=I don’t know'); await p.click('text=Continue'); }
    else { if ((await p.textContent('.qtop .chip')).trim() === 'Retry') sawRetry = true; if (/\d+ left/.test(await p.textContent('.qcount'))) sawLeft = true; await p.click('text=Show answer'); await p.click('.grades .g1'); }
    await p.waitForTimeout(60);
  }
  ok(await p.$('.pagehead h1:has-text("complete")') != null, 'the session ends', steps + ' answers');
  ok(sawRetry && sawLeft, 'the retry round shows a Retry chip and an "N left" counter');
  const txt = await p.textContent('.card');
  ok(/words? come(s)? back in about 10 minutes/.test(txt), 'the end card says how many come back and when', txt.replace(/\s+/g, ' ').slice(0, 160));
  const dues = await p.evaluate(async () => { const K = await import('./js/know.js'), C = await import('./js/clock.js'); return [...K.K.cards.values()].filter((c) => c.dfr && c.due < C.clockNow() + 3600000).map((c) => c.due); });
  ok(dues.length > 3 &&  new Set(dues).size === 1, 'every held word comes back at the same moment', dues.length + ' words, ' + new Set(dues).size + ' time(s)');
  ok(errs.length === 0, 'no page errors', errs.join('|'));
  await b.close(); console.log(fails ? fails + ' FAILED' : 'ALL OK'); process.exit(fails ? 1 : 0);
})();
