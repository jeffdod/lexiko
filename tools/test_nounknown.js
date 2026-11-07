// A noun, adjective or pronoun form is asked in parsing only once you know the word. node tools/test_nounknown.js (server on :8123)
const { chromium } = require('playwright');
const URL = 'http://localhost:8123/lexiko/';
let fails = 0; const ok = (c, m, x = '') => { console.log((c ? '  ok  ' : '  FAIL ') + m + (x ? ' ' + x : '')); if (!c) fails++; };
process.on('unhandledRejection', (e) => { console.log('UNHANDLED', e && e.message); process.exit(1); });
(async () => {
  const b = await chromium.launch(); const p = await (await b.newContext({ viewport: { width: 390, height: 844 } })).newPage(); const errs = [];
  p.on('pageerror', (e) => errs.push(e.message));
  await p.goto(URL + '#/reference'); await p.waitForSelector('a.area', { timeout: 60000 });
  const r = await p.evaluate(async () => {
    const k = await import('./js/know.js'), pm = await import('./js/parse.js'), { D } = await import('./js/data.js');
    await k.setSetting('level', 400);                                              // words rarer than rank 400 are not assumed known
    const plan = () => pm.planParseSession({ kind: 'noun', newLimit: 500 }).fresh.map((x) => D.forms[x.id].an[0].s);
    const before = plan(), n = before.find((x) => !D.lexByN.get(x).verb);
    // the same word, now only just started (a card that is not yet "known"): its forms drop out
    k.K.cards.set('w:' + n, { id: 'w:' + n, state: 'learning', reps: 1, stability: 1, due: Date.now() + 864e5 });
    const during = plan(), st = k.status(n);
    k.K.cards.delete('w:' + n);
    return { n: before.length, had: before.includes(n), st, gone: !during.includes(n), allKnown: before.every((x) => k.status(x) === 'known') };
  });
  ok(r.had && r.st === 'learning' && r.gone, 'a word you have only just started supplies no forms', JSON.stringify(r));
  ok(r.allKnown, 'every new noun-type form comes from a known word', String(r.n));
  ok(errs.length === 0, 'no page errors', errs.join('|'));
  await b.close(); console.log(fails ? fails + ' FAILED' : 'ALL OK'); process.exit(fails ? 1 : 0);
})();
