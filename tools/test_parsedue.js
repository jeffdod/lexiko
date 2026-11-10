// The "due" count on the Parsing screen must match what a session serves. node tools/test_parsedue.js (server on :8123)
const { chromium } = require('playwright');
const URL = 'http://localhost:8123/lexiko/';
let fails = 0; const ok = (c, m, x = '') => { console.log((c ? '  ok  ' : '  FAIL ') + m + (x ? ' ' + x : '')); if (!c) fails++; };
process.on('unhandledRejection', (e) => { console.log('UNHANDLED', e && e.message); process.exit(1); });
(async () => {
  const b = await chromium.launch(); const p = await (await b.newContext({ viewport: { width: 390, height: 844 } })).newPage(); const errs = [];
  p.on('pageerror', (e) => errs.push(e.message));
  const ready = async () => { await p.waitForSelector('#nav a[data-tab]', { timeout: 60000 }); await p.waitForFunction(() => !document.getElementById('loading')); };
  await p.goto(URL); await ready();
  const mk = async () => p.evaluate(async () => { const k = await import('./js/know.js'), f = await import('./js/fsrs.js'), { D } = await import('./js/data.js'), { store } = await import('./js/store.js');
    const due = (id) => { let c = f.review(f.newCard(id), 3, Date.now() - 9e8, 0.9); c.due = Date.now() - 1000; c.src = 'new'; return c; };
    const real = D.forms.find((x) => x.an[0] && /^N-/.test(x.an[0].m) && x.count > 200 && !(D.lexByN.get(x.an[0].s) || {}).name), idou = D.forms.find((x) => x.an[0] && x.an[0].s === 2400);
    const cards = [due(k.parseId(real)), due(k.parseId(idou)), due('f:zzzz:5')];
    for (const c of cards) { k.K.cards.set(c.id, c); } await store.putCards(cards);
    const sm = await import('./js/smart.js'), pa = await import('./js/parse.js');
    return { shown: sm.counts().parse.due, served: pa.planParseSession({}).due.length, ids: cards.map((c) => c.id) }; });
  const r = await mk();
  ok(r.shown === 1 && r.served === 1, 'a form that is no longer quizzed, and an orphan card, are not counted as due', JSON.stringify({ shown: r.shown, served: r.served }));
  await p.reload(); await ready();
  const gone = await p.evaluate(async (ids) => { const k = await import('./js/know.js'); return ids.map((id) => k.K.cards.has(id)); }, r.ids);
  ok(gone[0] === true && gone[1] === false, 'the real card stays; the ἰδού card is removed on load', JSON.stringify(gone));
  await p.goto(URL + '#/parse'); await p.reload(); await ready();
  ok(!/(null|undefined)/.test(await p.textContent('#view')), 'Parsing screen renders');
  ok(errs.length === 0, 'no page errors', errs.join('|'));
  await b.close(); console.log(fails ? fails + ' FAILED' : 'ALL OK'); process.exit(fails ? 1 : 0);
})();
