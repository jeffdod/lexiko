// New words slow down only for reviews carried over from earlier days, not for today's normal reviews.
const { chromium } = require('playwright');
const ok = (c, m) => { console.log((c ? '  ok  ' : '  FAIL ') + m); if (!c) process.exitCode = 1; };
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 390, height: 844 } });
  const errs = []; p.on('pageerror', (e) => errs.push(String(e)));
  await p.goto('http://localhost:8123/lexiko/#/settings'); await p.waitForSelector('#nav a[data-tab]');
  const run = (count, overdue) => p.evaluate(async ([count, overdue]) => { const K = await import('/lexiko/js/know.js'), { D } = await import('/lexiko/js/data.js'), F = await import('/lexiko/js/fsrs.js');
    await K.setLevel(50); await K.setSetting('levelAsked', true); await K.setSetting('parseAsked', true); await K.setSetting('newPerDay', 12); await K.setSetting('wordsPace', 'auto'); await K.setSetting('wordsPause', false);
    for (const [id] of [...K.K.cards]) if (id.startsWith('w:') || id.startsWith('f:')) K.K.cards.delete(id);
    for (const d of Object.values(K.K.daily)) { delete d.wc; delete d.wcm; }
    const start = new Date(); start.setHours(0, 0, 0, 0); const ds = +start, now = Date.now(); let n = 0;
    for (const L of D.lex) { if (n >= count) break; if (L.freq < 100) continue; const id = 'w:' + L.n; K.K.cards.set(id, { ...F.newCard(id), state: 'review', stability: 12, reps: 4, last: ds - 864e5 * 6, due: overdue ? ds - 36e5 : Math.min(now - 1000, ds + 1000) }); n++; }
    const pc = K.wordsPace(); return { n: pc.n, due: pc.due, slow: !!pc.slow, why: pc.why, late: K.overdueWords() }; }, [count, overdue]);
  const a = await run(60, false); ok(a.n === 12 && !a.slow && a.late === 0 && a.due >= 50, '60 reviews due today, none overdue: new words are not slowed: ' + JSON.stringify(a));
  const c = await run(18, true); ok(c.n === 4 && c.slow && /18 words overdue from earlier days/.test(c.why), '18 overdue: slowed to a third: ' + JSON.stringify(c));
  const d = await run(30, true); ok(d.n <= 1 && /\d+ words overdue from earlier days/.test(d.why), '30 overdue (more than a session): new words wait, apart from the one-a-day nudge after a gap: ' + JSON.stringify(d));
  ok(errs.length === 0, 'no page errors: ' + errs.join(' | '));
  await b.close(); console.log(process.exitCode ? 'overdue: FAILED' : 'overdue: ok');
})();
