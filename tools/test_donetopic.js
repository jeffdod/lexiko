// "Almost done" counts only the page's own cards: node tools/test_donetopic.js (server on :8123)
const { chromium } = require('playwright');
const URL = 'http://localhost:8123/lexiko/';
let fails = 0; const ok = (c, m, x = '') => { console.log((c ? '  ok  ' : '  FAIL ') + m + (x ? ' ' + x : '')); if (!c) fails++; };
(async () => {
  const b = await chromium.launch(); const p = await (await b.newContext({ viewport: { width: 390, height: 844 } })).newPage(); const errs = [];
  p.on('pageerror', (e) => errs.push(e.message));
  await p.goto(URL); await p.waitForSelector('#nav a[data-tab]', { timeout: 60000 });
  const setup = (wordsAt, formAt) => p.evaluate(async ([wordsAt, formAt]) => {
    const k = await import('./js/know.js'), F = await import('./js/fsrs.js'), { clockNow } = await import('./js/clock.js'), { D } = await import('./js/data.js');
    await k.setLevel(100); await k.setSetting('levelAsked', true); await k.setSetting('newPerDay', 0); await k.setSetting('parseNewPerDay', 0);
    for (const id of [...k.K.cards.keys()]) k.K.cards.delete(id);
    const now = clockNow(), eod = new Date(now).setHours(24, 0, 0, 0);
    const at = (h) => (h === 'tomorrow' ? eod + 36e5 : now + h * 36e5);
    const mk = (id, due) => k.K.cards.set(id, { ...F.newCard(id), state: 'review', stability: 20, reps: 3, last: now - 36e5, due });
    const live = D.lex.find((L) => k.liveWord({ id: 'w:' + L.n }));
    mk('w:' + live.n, at(wordsAt)); if (formAt != null) mk(k.parseId(D.forms[0]), at(formAt));
    return { word: live.n };
  }, [wordsAt, formAt]);
  const page = async (hash) => { await p.goto(URL + '#/home'); await p.goto(URL + hash); await p.waitForTimeout(500); return p.evaluate(() => document.querySelector('#view').innerText); };
  // words come back tomorrow, a form comes back later today: Vocabulary must say done, not "almost"
  await setup('tomorrow', 1);
  let t = await page('#/learn/words');
  ok(/done for today/.test(t) && !/Almost done/.test(t), 'a form due later today does not make Vocabulary say "Almost done"', t.split('\n').slice(0, 4).join(' | '));
  // a word comes back later today: "Almost done" and the next-review line agree
  await setup(1, 'tomorrow');
  t = await page('#/learn/words');
  ok(/Almost done/.test(t) && /Next review in/.test(t), 'a word due later today: "Almost done" with a next-review time in hours', t.split('\n').slice(0, 5).join(' | '));
  ok(errs.length === 0, 'no page errors', errs.join('|'));
  await b.close(); console.log(fails ? fails + ' FAILED' : 'ALL OK'); process.exit(fails ? 1 : 0);
})();
