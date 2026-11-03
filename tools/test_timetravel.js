// Time travel: moves the clock forward, and leaving restores progress exactly. node tools/test_timetravel.js (server on :8123)
const { chromium } = require('playwright');
const URL = 'http://localhost:8123/lexiko/';
let fails = 0; const ok = (c, m, x = '') => { console.log((c ? '  ok  ' : '  FAIL ') + m + (x ? ' ' + x : '')); if (!c) fails++; };
process.on('unhandledRejection', (e) => { console.log('UNHANDLED', e && e.message); process.exit(1); });
(async () => {
  const b = await chromium.launch(); const p = await (await b.newContext({ viewport: { width: 390, height: 844 } })).newPage(); const errs = [];
  p.on('pageerror', (e) => errs.push(e.message));
  const ready = async () => { await p.waitForSelector('#nav a[data-tab]', { timeout: 60000 }); await p.waitForFunction(() => !document.getElementById('loading')); };
  await p.goto(URL); await ready();
  ok(!(await p.$('#ttbar')), 'no time-travel bar for a normal user');
  // some real progress
  const before = await p.evaluate(async () => { const k = await import('./js/know.js'); const { D } = await import('./js/data.js');
    const a = D.lex.filter((L) => L.pos !== 'V')[30].n; await k.rate(a, 3, 'new'); return { a, size: k.K.cards.size, card: JSON.stringify(k.K.cards.get('w:' + a)), due: k.dueCards().length }; });
  ok(before.due === 0, 'a word just studied is not due yet', String(before.due));
  await p.goto(URL + '#/settings/dev'); await p.reload(); await ready();
  await Promise.all([p.waitForEvent('load'), p.click('text=Start time travel')]); await ready();
  ok(!!(await p.$('#ttbar')) && /Pretending it is/.test(await p.textContent('#ttbar')), 'the bar shows while time travel is on');
  await p.goto(URL + '#/settings/dev'); await p.reload(); await ready(); await Promise.all([p.waitForEvent('load'), p.click('text=+1 week')]); await ready();
  const mid = await p.evaluate(async () => { const k = await import('./js/know.js'); const c = await import('./js/clock.js'); const { D } = await import('./js/data.js');
    const due = k.dueCards().length, off = c.clockNow() - Date.now(); const z = D.lex.filter((L) => L.pos !== 'V')[60].n; await k.rate(z, 3, 'new'); return { due, off, z, size: k.K.cards.size }; });
  ok(mid.due >= 1 && Math.abs(mid.off - 7 * 864e5) < 5000, 'a week later the word is due', JSON.stringify(mid));
  await Promise.all([p.waitForEvent('load'), p.click('#ttbar >> text=Exit and restore')]); await ready();
  const after = await p.evaluate(async () => { const k = await import('./js/know.js'); const c = await import('./js/clock.js'); const s = await import('./js/store.js');
    const bk = await s.makeBackup(); return { size: k.K.cards.size, card: JSON.stringify(k.K.cards.get('w:' + (window.__a || 0))), extra: k.K.cards.has('w:' + 0), off: c.clockNow() - Date.now(), tt: await s.store.get('ttBackup'), inBackup: 'ttBackup' in bk.kv, ls: localStorage.getItem('lexiko.timeTravel'), due: k.dueCards().length, z: k.K.cards.has('w:' + 0) }; });
  ok(after.size === before.size, 'progress is back to how it was (card count)', before.size + ' → ' + after.size);
  const restored = await p.evaluate(async (a) => { const k = await import('./js/know.js'); return JSON.stringify(k.K.cards.get('w:' + a)); }, before.a);
  ok(restored === before.card, 'the studied word is exactly as before');
  const gone = await p.evaluate(async (z) => { const k = await import('./js/know.js'); return !k.K.cards.has('w:' + z); }, mid.z);
  ok(gone, 'what was done while time-travelling is gone');
  ok(Math.abs(after.off) < 2000 && after.tt === undefined && !after.inBackup && after.ls === null && !(await p.$('#ttbar')), 'real time is back and the snapshot is cleaned up', JSON.stringify({ off: after.off, ls: after.ls }));
  ok(after.due === 0, 'nothing is due again');
  ok(errs.length === 0, 'no page errors', errs.join('|'));
  await b.close(); console.log(fails ? fails + ' FAILED' : 'ALL OK'); process.exit(fails ? 1 : 0);
})();
