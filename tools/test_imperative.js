// Imperative: the page, eight paradigms, the "which kind is it?" quiz (practice only) and the parsing route.
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(), p = await b.newPage({ viewport: { width: 420, height: 900 } }); let bad = 0; const ok = (c, m, x = '') => { console.log((c ? '  ok  ' : 'FAIL  ') + m + (c ? '' : ' ' + x)); if (!c) bad++; };
  const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  const go = async (h) => { await p.evaluate((x) => { location.hash = x; }, h); await p.waitForTimeout(700); };
  await p.goto('http://localhost:8123/#/learn'); await p.waitForTimeout(1500);
  const d = await p.evaluate(async () => { const m = await import('./js/impdata.js'); const bad = []; let n = 0;
    for (const r of m.IMP) { if (r.forms.length !== 4) bad.push(r.key + ' count'); r.forms.forEach((w, j) => { n++; const s = m.splitImp(w, r.key); if (!s || s.stem + s.formative + s.vowel + s.ending !== w || s.person !== j) bad.push(r.key + ':' + w); }); }
    return { n, bad, keys: m.IMP.length }; });
  ok(d.keys === 8 && d.n === 32 && !d.bad.length, 'eight paradigms of four forms, each splits into pieces and the right person', JSON.stringify(d.bad.slice(0, 5)));
  await p.evaluate(async () => { const k = await import('./js/know.js'), F = await import('./js/families.js'); k.K.settings.level = 0; k.K.settings.gates = k.allGatesOpen(); });
  await go('#/learn/charts'); ok(await p.locator('a.btn:text-is("Open Imperative")').count() === 1, 'Charts page links to Imperative');
  await go('#/learn/charts/imperative');
  ok(await p.locator('.ptcrow').count() === 8 && await p.locator('a.practice').count() === 1, 'the page lists the eight kinds; Practice this link');
  await p.click('.ptcrow a >> nth=2'); await p.waitForTimeout(500);
  ok(await p.locator('.pcell').count() === 4 && await p.locator('.pcell.pone').count() === 1, 'a paradigm has four forms, the 2nd singular marked');
  ok(await p.locator('a.btn:text-is("Parse forms like this")').count() === 1 && await p.locator('a.btn:text-is("Which kind is it?")').count() === 1, 'paradigm page buttons');
  const real = await p.evaluate(async () => { const P = await import('./js/parse.js'), m = await import('./js/impdata.js'); const bad = []; let n = 0, shy = 0, none = 0;
    for (const x of P.imperativeForms(null, { ignoreLevel: true })) { const sp = m.splitImp(x.w, x.key); if (/­/.test(x.w)) shy++; if (!sp) { none++; continue; } n++; if (sp.stem + sp.formative + sp.vowel + sp.ending !== x.w) bad.push(x.w); }
    return { n, shy, none, bad: bad.slice(0, 5) }; });
  ok(real.n > 30 && !real.bad.length && real.shy === 0, 'real imperatives split cleanly: ' + real.n + ' (' + real.none + ' not splittable)', JSON.stringify(real));
  const noContract = await p.evaluate(async () => { const m = await import('./js/imperatives.js'), pd = await import('./js/ptcdata.js'); const q = []; for (let i = 0; i < 15; i++) q.push(...m.impQueue(null)); return q.filter((x) => /μι$/.test(pd.skel(x.head))).length; });
  ok(noContract === 0, 'no -μι verbs in the quiz (yet)');
  const before = await p.evaluate(async () => { const k = await import('./js/know.js'); return JSON.stringify([[...k.K.cards.keys()].length, k.K.daily]); });
  await p.evaluate(async () => { const k = await import('./js/know.js'); k.K.settings.gates = { verbs: true }; });
  await go('#/learn/charts/imperative/run'); await p.waitForSelector('.qwrap');
  const total = +(await p.innerText('.qcount')).match(/\/\s*(\d+)/)[1]; ok(total >= 4 && total <= 12, 'a round of up to twelve, even at parsing level 1: ' + total);
  ok(await p.locator('.opt').count() === 4 && /from /.test(await p.innerText('.qcard')), 'four choices; the verb is shown');
  await p.click('.hintlink'); ok(await p.locator('.hintbox .ptcparts').count() === 1 && await p.locator('.hintbox .ptcparts small').count() === 0, 'first hint: the split, unlabeled');
  ok(!/will count as missed/.test(await p.innerText('.hintbox')) && /What the pieces mean/.test(await p.innerText('.hintbox')), 'first hint is free');
  await p.click('.hintlink:has-text("What the pieces mean")'); ok(/will count as missed/.test(await p.innerText('.hintbox')), 'second hint counts as a miss');
  let sawWrong = false;
  for (let i = 0; i < 24 && !sawWrong; i++) {
    if (!(await p.locator('.qcard').count())) break;
    await p.locator('.opt').nth(i % 4).click(); await p.waitForSelector('.fb');
    if (await p.locator('.fb.bad').count()) { sawWrong = true; const n = await p.locator('.fb .ptcparts small').count(); ok(n >= 2 && n <= 4, 'feedback labels the pieces: ' + n); ok(/person (singular|plural)/.test(await p.innerText('.fb')), 'feedback names the person and number'); break; }
    await p.click('button:text-is("Continue")'); await p.waitForTimeout(150);
  }
  ok(sawWrong, 'a wrong answer was reached and explained');
  if (sawWrong) await p.click('button:text-is("Continue")');
  let sawRetry = false;
  for (let i = 0; i < 40; i++) {
    if (!(await p.locator('.qcard').count())) break;
    if (/↻/.test(await p.innerText('.qcount'))) { sawRetry = true; break; }
    const k = await p.locator('.opt').count(); await p.locator('.opt').nth(i % k).click(); await p.waitForSelector('.fb'); await p.click('button:text-is("Continue")'); await p.waitForTimeout(120);
  }
  ok(sawRetry, 'missed ones come back in a ↻ retry round');
  const after = await p.evaluate(async () => { const k = await import('./js/know.js'); return JSON.stringify([[...k.K.cards.keys()].length, k.K.daily]); });
  ok(before === after, 'practice only: no cards or daily counts changed');
  const la = await p.evaluate(async () => { const m = await import('./js/imperatives.js'); let n = 0; for (let i = 0; i < 20; i++) if (m.impOptions('pres-act').some((r) => r.key === 'aor2-act') && m.impOptions('aor2-mid').some((r) => r.key === 'pres-mp')) n++; return n; });
  ok(la === 20, 'look-alike kinds always sit beside each other');
  const ex = await p.evaluate(async () => { const m = await import('./js/imperatives.js'), s = await import('./js/impdata.js'); const f = (w, key, head) => m.explainImp({ key, head, w, sp: s.splitImp(w, key) }).join(' ');
    return [f('λῦσαι', 'aor1-mid', 'λύω'), f('λαβέτω', 'aor2-act', 'λαμβάνω'), f('λῦε', 'pres-act', 'λύω'), f('λυέτωσαν', 'pres-act', 'λύω')]; });
  ok(/aorist active infinitive/.test(ex[0]) && /2nd aorist/.test(ex[1]) && /no ending/.test(ex[2]) && /3rd person plural/.test(ex[3]), 'notes: infinitive look-alike; stem comparison; no ending; person', JSON.stringify(ex));
  await p.evaluate(async () => { const k = await import('./js/know.js'), F = await import('./js/families.js'); k.K.settings.gates = k.allGatesOpen(); });
  await go('#/parse/run/imp/all'); await p.waitForSelector('.qwrap');
  ok(/practice only/.test(await p.innerText('.practice-note')), 'Parse some imperatives: practice only');
  await p.evaluate(async () => { const k = await import('./js/know.js'); k.K.settings.level = null; });
  await go('#/learn/charts/imperative/run'); ok(/no imperatives to practice yet/.test(await p.innerText('#view')), 'empty state is explained');
  ok(!errs.length, 'no page errors ' + errs.join('|'));
  await b.close(); console.log(bad ? 'FAILED' : 'ALL OK'); process.exit(bad ? 1 : 0);
})();
