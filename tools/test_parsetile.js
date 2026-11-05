// The Learn tile's "due now" for parsing must equal what a session serves: a due card for a form that is no longer quizzed is not counted.
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(), p = await b.newPage(); let bad = 0; const ok = (c, m) => { console.log((c ? '  ok  ' : 'FAIL  ') + m); if (!c) bad++; };
  const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  await p.goto('http://localhost:8123/#/learn'); await p.waitForTimeout(1500);
  const r = await p.evaluate(async () => {
    const k = await import('./js/know.js'), s = await import('./js/smart.js'), c = await import('./js/clock.js'), f = await import('./js/parse.js');
    const before = s.upcoming().parse.due;
    k.K.cards.set('f:zzzzz:99999', { id: 'f:zzzzz:99999', state: 'review', due: c.clockNow() - 1000, reps: 3, last: c.clockNow() - 1e6, stability: 1, difficulty: 5 });
    const up = s.upcoming();
    return { before, after: up.parse.due, served: f.parseDueCount(), all: up.all.due, words: up.words.due };
  });
  ok(r.after === r.before, 'a due card for an unquizzed form is not counted: ' + r.before + ' -> ' + r.after);
  ok(r.after === r.served, 'tile count equals the session count: ' + r.after + ' vs ' + r.served);
  ok(r.all === r.words + r.after, 'overall due is words + parsing');
  ok(!errs.length, 'no page errors ' + errs.join('|'));
  await b.close(); console.log(bad ? 'FAILED' : 'ALL OK'); process.exit(bad ? 1 : 0);
})();
