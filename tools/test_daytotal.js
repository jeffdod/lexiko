// "N of M due done today": the day's total stays put while the done count rises: node tools/test_daytotal.js (server on :8123)
const { chromium } = require('playwright');
const URL = 'http://localhost:8123/lexiko/';
let fails = 0; const ok = (c, m, x = '') => { console.log((c ? '  ok  ' : '  FAIL ') + m + (x ? ' ' + x : '')); if (!c) fails++; };
(async () => {
  const b = await chromium.launch(); const p = await (await b.newContext({ viewport: { width: 390, height: 844 } })).newPage(); const errs = [];
  p.on('pageerror', (e) => errs.push(e.message));
  await p.goto(URL); await p.waitForSelector('#nav a[data-tab]', { timeout: 60000 });
  await p.evaluate(async () => {
    const k = await import('./js/know.js'), F = await import('./js/fsrs.js'), { clockNow } = await import('./js/clock.js');
    await k.setLevel(100); await k.setSetting('levelAsked', true); await k.setSetting('sessionSize', 25); await k.setSetting('wordsPace', 'fixed'); await k.setSetting('newPerDay', 0);
    const now = clockNow(), ids = [...k.D ? [] : []];
    const { D } = await import('./js/data.js'); const ns = D.lex.slice(0, 100).map((L) => L.n);
    for (const n of ns) { const c = { ...F.newCard('w:' + n), state: 'review', stability: 20, reps: 3, last: now - 5 * 864e5, due: now - 3600e3 }; k.K.cards.set(c.id, c); }
    window.__ns = k.dueCards().map((c) => +c.id.slice(2)).slice(0, 40);
  });
  const prog = () => p.evaluate(async () => (await import('./js/know.js')).wordsDayProgress());
  const line = async () => { await p.goto(URL + '#/home'); await p.goto(URL + '#/learn/words'); await p.waitForTimeout(500); return p.evaluate(() => (document.querySelector('.startmore') || {}).textContent || ''); };
  let T = 0;
  const p0 = await prog(); ok((T = p0.total) > 30 && p0.done === 0, 'start: more than one round due, none done', JSON.stringify(p0));
  ok(await line() === '0 of ' + T + ' due done today', 'the line says so when more is due than one round holds', await line());
  await p.evaluate(async () => { const k = await import('./js/know.js'); for (const n of window.__ns.slice(0, 30)) await k.rate(n, 3, 'review'); });
  const p1 = await prog(); ok(p1.total === T && p1.done === 30, 'after a round of 30 the total is unchanged and 30 are done', JSON.stringify(p1));
  ok(await line() === '30 of ' + T + ' due done today', 'the line follows', await line());
  await p.evaluate(async () => { const k = await import('./js/know.js'); await k.undoRate(); });
  const p2 = await prog(); ok(p2.total === T && p2.done === 29, 'undo takes one back', JSON.stringify(p2));
  await p.evaluate(async () => { const k = await import('./js/know.js'); await k.rate(window.__ns[30], 1, 'review'); });
  const p3 = await prog(); ok(p3.total === T, 'a missed word (back in a minute) does not change the total', JSON.stringify(p3));
  await p.evaluate(async () => { const k = await import('./js/know.js'); for (const c of k.dueCards()) await k.rate(+c.id.slice(2), 3, 'review'); });
  const l = await line(); ok(l === '', 'no line once one round holds what is left', JSON.stringify(l));
  ok(errs.length === 0, 'no page errors', errs.join('|'));
  await b.close(); console.log(fails ? fails + ' FAILED' : 'ALL OK'); process.exit(fails ? 1 : 0);
})();
