// The goal estimate follows how you have actually been going, not just the daily limit.
const { chromium } = require('playwright');
const ok = (c, m) => { console.log((c ? '  ok  ' : '  FAIL ') + m); if (!c) process.exitCode = 1; };
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 390, height: 844 } });
  const errs = []; p.on('pageerror', (e) => errs.push(String(e)));
  const U = 'http://localhost:8123/lexiko/';
  await p.goto(U + '#/settings'); await p.waitForSelector('#nav a[data-tab]');
  const run = (hist, overload) => p.evaluate(async ([hist, overload]) => { const K = await import('/lexiko/js/know.js'), { D } = await import('/lexiko/js/data.js'), F = await import('/lexiko/js/fsrs.js');
    await K.setLevel(50); await K.setSetting('levelAsked', true); await K.setSetting('parseAsked', true); await K.setSetting('newPerDay', 20); await K.setGoal({ kind: 'freq', min: 10 });
    for (const k of Object.keys(K.K.daily)) delete K.K.daily[k];
    const day = (back) => { const d = new Date(); d.setDate(d.getDate() - back); return d.toLocaleDateString('en-CA'); };
    for (let i = 1; i <= hist; i++) K.K.daily[day(i)] = { n: 6, r: 20 };
    for (const k of [...K.K.cards.keys()]) if (k.startsWith('w:') && K.K.cards.get(k).state !== 'new' && k.startsWith('w:') && K.K.cards.get(k).src === 'test') K.K.cards.delete(k);
    if (overload) { const now = Date.now(); let n = 0; for (const L of D.lex) { if (n >= 140) break; const id = 'w:' + L.n; if (K.K.cards.has(id)) continue; K.K.cards.set(id, { ...F.newCard(id), state: 'review', stability: 12, reps: 4, last: now - 864e5 * 6, due: now - 36e5, src: 'test' }); n++; } }
    delete K.K.daily[new Date().toLocaleDateString('en-CA')];
    return K.goalEta(60); }, [hist, overload]);
  const a = await run(5, false); ok(a.kind === 'pace' && a.per === 6 && a.days === 10, 'five study days of 6 new words: pace 6 a day, 10 days for 60 words: ' + JSON.stringify(a));
  const c = await run(2, false); ok(c.kind === 'limit' && c.per === 20 && c.days === 3, 'under 3 days of history: the daily limit: ' + JSON.stringify(c));
  const o = await run(5, true); ok(o.kind === 'waiting', 'new words waiting on reviews: no estimate: ' + JSON.stringify(o));
  await run(5, false); await p.goto(U + '#/learn'); await p.waitForTimeout(200); await p.goto(U + '#/learn/words'); await p.waitForTimeout(1200);
  const t = await p.evaluate(() => document.querySelector('#view').innerText);
  ok(/words? to go · about \d+ days at your recent pace of 6 a day/.test(t), 'Vocabulary goal card shows the recent pace: ' + (t.match(/\d+ words? to go[^\n]*/) || [''])[0]);
  ok(errs.length === 0, 'no page errors: ' + errs.join(' | '));
  await b.close(); console.log(process.exitCode ? 'goaleta: FAILED' : 'goaleta: ok');
})();
