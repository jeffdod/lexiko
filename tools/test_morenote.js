// When more is due than one round holds, the Vocabulary page and Home say so up front ("0 of N due done today" on the Vocabulary page; Home says "N more words are due after this round").
const { chromium } = require('playwright');
const ok = (c, m) => { console.log((c ? '  ok  ' : '  FAIL ') + m); if (!c) process.exitCode = 1; };
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 390, height: 844 } });
  const errs = []; p.on('pageerror', (e) => errs.push(String(e)));
  const U = 'http://localhost:8123/lexiko/';
  await p.goto(U + '#/settings'); await p.waitForSelector('#nav a[data-tab]');
  const info = await p.evaluate(async () => { const K = await import('/lexiko/js/know.js'), { D } = await import('/lexiko/js/data.js'), F = await import('/lexiko/js/fsrs.js'), S = await import('/lexiko/js/smart.js');
    await K.setLevel(50); await K.setSetting('levelAsked', true); await K.setSetting('parseAsked', true); await K.setSetting('newPerDay', 0);
    const now = Date.now(); let n = 0; for (const L of D.lex) { if (n >= 45) break; if (L.verb) continue; const id = 'w:' + L.n; if (K.K.cards.has(id)) continue; K.K.cards.set(id, { ...F.newCard(id), state: 'review', stability: 12, reps: 4, last: now - 864e5 * 6, due: now - 36e5 }); n++; }
    const c = S.counts().words; return { due: c.due, sessionDue: c.sessionDue, more: c.more, total: c.total }; });
  ok(info.due > 30 && info.sessionDue <= 30 && info.more === info.due - info.sessionDue && info.more > 0, 'counts: ' + JSON.stringify(info));
  await p.goto(U + '#/learn'); await p.waitForTimeout(200); await p.goto(U + '#/learn/words'); await p.waitForSelector('#view a.btn.start');
  const v = await p.evaluate(() => ({ btn: document.querySelector('#view a.btn.start').textContent, more: (document.querySelector('#view .startmore') || {}).textContent || '' }));
  ok(/^0 of \d+ due done today$/.test(v.more) && +v.more.split(' ')[2] === info.sessionDue + info.more && v.btn.includes(info.sessionDue + ' due'), 'Vocabulary page: ' + v.btn + ' | ' + v.more);
  await p.goto(U + '#/settings'); await p.waitForTimeout(200); await p.goto(U + '#/home'); await p.waitForTimeout(1200);
  const hm = await p.evaluate(() => document.querySelector('#view').innerText);
  ok(new RegExp(info.more + ' more words are due after this round').test(hm), 'Home says it too: ' + hm.replace(/\n/g, '|').slice(0, 300));
  ok(errs.length === 0, 'no page errors: ' + errs.join(' | '));
  await b.close(); console.log(process.exitCode ? 'morenote: FAILED' : 'morenote: ok');
})();
