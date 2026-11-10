// "Parse open rows" / "Parse open kinds": real forms mixed from everything that is open. Practice only.
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(), p = await b.newPage({ viewport: { width: 390, height: 860 } }); const errs = [];
  p.on('pageerror', (e) => errs.push(String(e)));
  const ok = (c, m) => { if (!c) { console.log('FAIL: ' + m); process.exitCode = 1; } };
  const U = 'http://localhost:8123/lexiko/';
  const go = async (hash) => { await p.goto(U + '#/home'); await p.waitForTimeout(150); await p.goto(U + hash); await p.waitForTimeout(600); };
  await p.goto(U + '#/home'); await p.waitForSelector('#nav a[data-tab]');
  const set = (gates, lvl = 50) => p.evaluate(async ([g, l]) => { const K = await import('/lexiko/js/know.js'); await K.setLevel(l); await K.setSetting('levelAsked', true); await K.setSetting('parseAsked', true); await K.setSetting('gates', g === 'all' ? K.allGatesOpen() : g); }, [gates, lvl]);
  const txt = () => p.locator('#view').innerText();

  // the buttons
  await set({ verbs: true }); await go('#/parse/kinds/ind');
  ok(await p.locator('#view a.btn:text-is("Parse open rows")').getAttribute('href') === '#/parse/run/open/ind', 'Indicative page: Parse open rows');
  for (const f of ['ptc', 'inf', 'sub', 'imp']) { await go('#/parse/kinds/' + f); ok(await p.locator('#view a.btn:text-is("Parse open kinds")').getAttribute('href') === '#/parse/run/' + f + '/all', f + ': Parse open kinds'); }

  // open rows only: with two extra rows open, every form of the round belongs to an open row
  await set({ verbs: true, 'row:aor1-act': true, 'row:impf-act': true }); await go('#/parse/run/open/ind');
  ok(await p.locator('.qwrap').count() === 1, 'a round starts');
  const total = +(await p.innerText('.qcount')).match(/\/\s*(\d+)/)[1]; ok(total > 0 && total <= 12, 'at most twelve forms: ' + total);
  ok(/Chart practice/.test(await p.innerText('.practice-note')), 'practice-only banner');
  const bad = await p.evaluate(async () => { const P = await import('/lexiko/js/parse.js'), K = await import('/lexiko/js/know.js'), C = await import('/lexiko/js/chartdrill.js');
    const open = C.ROWS.filter((r) => K.gateOpen('row:' + r.key)).map((r) => r.key); const union = new Set(open.flatMap((k) => P.rowPool(k, { ignoreLevel: true })));
    const q = P.rowsQueue(open, false, undefined, 12); return { open: open.join(), n: q.length, outside: q.filter((x) => !union.has(x.id)).length }; });
  ok(bad.open === 'pres-act,impf-act,aor1-act' || bad.open.split(',').length === 3, 'three rows open: ' + bad.open);
  ok(bad.n > 0 && bad.outside === 0, 'every form is from an open row: ' + JSON.stringify(bad));
  // a row that is locked never appears: only present active open -> only present active forms
  await set({ verbs: true });
  const only = await p.evaluate(async () => { const P = await import('/lexiko/js/parse.js'); const pa = new Set(P.rowPool('pres-act', { ignoreLevel: true })); const q = P.rowsQueue(['pres-act'], false, undefined, 12); return q.length > 0 && q.every((x) => pa.has(x.id)); });
  ok(only, 'one open row: its forms only');
  await go('#/parse/run/open/ind'); ok(await p.locator('.qwrap').count() === 1, 'present active alone gives a round');

  // nothing open (verbs off): explained, no crash
  await set({}); await go('#/parse/run/open/ind');
  ok(/No rows are open yet/.test(await txt()), 'verbs off: "No rows are open yet"');
  // no known verbs: explanation, then "Try with any verb"
  await set({ verbs: true }, null); await go('#/parse/run/open/ind');
  ok(/no forms of the open rows in verbs you know/i.test(await txt()), 'no known verbs: explained');
  await p.locator('a.btn:text-is("Try with any verb")').click(); await p.waitForTimeout(600);
  ok(await p.locator('.qwrap').count() === 1, '"Try with any verb" gives a round');

  // families (verb parsing off, so nothing is open): explained (and no stale "parsing levels"); everything open -> a round
  await set({}); await go('#/parse/run/ptc/all');
  ok(/No kinds are open yet/.test(await txt()) && !/parsing levels/.test(await txt()), 'participles, none open: explained');
  await go('#/parse/run/sub/pres-act'); ok(!/parsing levels/.test(await txt()), 'a single locked kind: current wording');
  await set('all'); 
  for (const f of ['ptc', 'inf', 'sub', 'imp']) { await go('#/parse/run/' + f + '/all'); ok(await p.locator('.qwrap').count() === 1, f + ': round from open kinds'); }
  await set({ verbs: true, 'ptc:pres-act': true });
  const pk = await p.evaluate(async () => { const P = await import('/lexiko/js/parse.js'); const all = P.participleForms(null), shut = P.participleForms(null, { ignoreLevel: true }); return { open: all.length, every: shut.length, kinds: [...new Set(all.map((x) => x.key))].join() }; });
  ok(pk.open > 0 && pk.open < pk.every && pk.kinds === 'pres-act', 'open kinds only: ' + JSON.stringify(pk));

  ok(errs.length === 0, 'no page errors: ' + errs.join(' | '));
  await b.close(); console.log(process.exitCode ? 'parseopen: FAILED' : 'parseopen: ok');
})();
