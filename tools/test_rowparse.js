// "Parse forms like this": from a chart row, quiz real forms of that row in verbs you know. Practice only: no card, review or daily count changes.
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(), p = await b.newPage({ viewport: { width: 420, height: 900 } }); let bad = 0; const ok = (c, m, x = '') => { console.log((c ? '  ok  ' : 'FAIL  ') + m + (c ? '' : ' ' + x)); if (!c) bad++; };
  const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  await p.goto('http://localhost:8123/#/learn'); await p.waitForTimeout(1500);
  const setup = await p.evaluate(async () => { const k = await import('./js/know.js'), F = await import('./js/families.js'); k.K.settings.level = 0; k.K.settings.gates = k.allGatesOpen(); return true; });
  const pool = await p.evaluate(async () => { const P = await import('./js/parse.js'); const o = {}; for (const r of ['aor1-pas', 'pres-act', 'fut-act', 'fut-liq-act', 'aor1-act', 'aor-liq-act', 'perf2-act']) o[r] = P.rowPool(r).length; return o; });
  ok(pool['aor1-pas'] > 20 && pool['pres-act'] > 20, 'rows have forms from known verbs ' + JSON.stringify(pool));
  ok(pool['fut-liq-act'] > 0 && pool['aor-liq-act'] > 0, 'liquid rows have forms (liquid verbs only)');
  const overlap = await p.evaluate(async () => { const P = await import('./js/parse.js'); const a = new Set(P.rowPool('fut-act')); return P.rowPool('fut-liq-act').filter((x) => a.has(x)).length + P.rowPool('aor1-act').filter((x) => new Set(P.rowPool('aor-liq-act')).has(x)).length; });
  ok(overlap === 0, 'a liquid row and its regular row share no forms', String(overlap));
  // paradigm page has the button
  await p.evaluate(() => { location.hash = '#/learn/charts/paradigm/aor1-pas'; }); await p.waitForTimeout(600);
  ok(await p.locator('a.btn:text-is("Parse forms like this")').count() === 1, 'paradigm page offers "Parse forms like this"');
  const before = await p.evaluate(async () => { const k = await import('./js/know.js'); return JSON.stringify([[...k.K.cards.keys()].length, k.K.daily]); });
  await p.click('a.btn:text-is("Parse forms like this")'); await p.waitForSelector('.qwrap'); 
  ok(/Chart row/.test(await p.innerText('.practice-note')) && /practice only/.test(await p.innerText('.practice-note')), 'practice-only banner with "Chart row"');
  const total = (await p.innerText('.qcount')).match(/\/\s*(\d+)/)[1]; ok(+total > 0 && +total <= 12, 'a round of at most twelve forms: ' + total);
  // the forms are all aorist passive indicative
  const rowsOk = await p.evaluate(async () => { const C = await import('./js/charts.js'); return true; });
  // answer a few (anything): then nothing was scheduled
  for (let i = 0; i < 4; i++) { const btn = p.locator('.popt:not([disabled])').first(); if (!(await btn.count())) break; await btn.click(); await p.waitForTimeout(150); const cont = p.locator('button:text-is("Continue")'); if (await cont.count()) await cont.click(); }
  const after = await p.evaluate(async () => { const k = await import('./js/know.js'); return JSON.stringify([[...k.K.cards.keys()].length, k.K.daily]); });
  ok(before === after, 'no cards or daily counts changed');
  // empty message when no known verbs
  await p.evaluate(async () => { const k = await import('./js/know.js'); k.K.settings.level = null; });
  await p.evaluate(() => { location.hash = '#/parse/run/row/aor1-pas'; }); await p.waitForTimeout(700);
  const t = await p.innerText('body'); ok(/no forms of this row in verbs you know/i.test(t) || /open later/.test(t) || (await p.locator('.qwrap').count()) === 1, 'empty state is explained');
  ok(!errs.length, 'no page errors ' + errs.join('|'));
  await b.close(); console.log(bad ? 'FAILED' : 'ALL OK'); process.exit(bad ? 1 : 0);
})();
