// "Study more today" opens a third of a day's new-item allowance per press: node tools/test_morestep.js (server on :8123)
const { chromium } = require('playwright');
const URL = 'http://localhost:8123/lexiko/';
let fails = 0; const ok = (c, m, x = '') => { console.log((c ? '  ok  ' : '  FAIL ') + m + (x ? ' ' + x : '')); if (!c) fails++; };
(async () => {
  const b = await chromium.launch(); const p = await (await b.newContext({ viewport: { width: 390, height: 844 } })).newPage(); const errs = [];
  p.on('pageerror', (e) => errs.push(e.message));
  await p.goto(URL); await p.waitForSelector('#nav a[data-tab]', { timeout: 60000 });
  const r = await p.evaluate(async () => {
    const k = await import('./js/know.js'), { todayKey } = await import('./js/util.js');
    await k.setLevel(100); await k.setSetting('levelAsked', true); await k.setSetting('wordsPace', 'fixed'); await k.setSetting('newPerDay', 22); await k.setSetting('parsePace', 'fixed'); await k.setSetting('parseNewPerDay', 9);
    const d = (k.K.daily[todayKey()] ||= {}); d.n = 22; d.wc = 22; d.wcm = 22;
    const before = k.wordsPace().left; await k.unlockMore('words'); const one = k.wordsPace().left; await k.unlockMore('words'); const two = k.wordsPace().left;
    await k.setSetting('newPerDay', 2); const d2 = (k.K.daily[todayKey()] ||= {}); const step = Math.max(1, Math.round(2 / 3));
    return { before, one, two, share: k.MORE_SHARE, step };
  });
  ok(r.before === 0 && r.one === 7 && r.two === 14, 'words: each press adds a third of 22 (7), and it can be pressed again', JSON.stringify(r));
  const q = await p.evaluate(async () => {
    const k = await import('./js/know.js'); await k.setSetting('parseNewPerDay', 9); await k.setSetting('parsePace', 'fixed');
    const l0 = k.parsePace().left; await k.unlockMore('parse'); const l1 = k.parsePace().left; await k.unlockMore('parse'); const l2 = k.parsePace().left;
    return { added: l1 - l0, again: l2 - l1 };
  });
  ok(q.added === 3 && q.again === 3, 'parsing: a third of 9 per press, repeatable', JSON.stringify(q));
  ok(errs.length === 0, 'no page errors', errs.join('|'));
  await b.close(); console.log(fails ? fails + ' FAILED' : 'ALL OK'); process.exit(fails ? 1 : 0);
})();
