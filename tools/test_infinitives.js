// Infinitives: the page, the "which kind is it?" quiz (practice only) and the parsing route.
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(), p = await b.newPage({ viewport: { width: 420, height: 900 } }); let bad = 0; const ok = (c, m, x = '') => { console.log((c ? '  ok  ' : 'FAIL  ') + m + (c ? '' : ' ' + x)); if (!c) bad++; };
  const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  const go = async (h) => { await p.evaluate((x) => { location.hash = x; }, h); await p.waitForTimeout(700); };
  await p.goto('http://localhost:8123/#/learn'); await p.waitForTimeout(1500);
  const d = await p.evaluate(async () => { const m = await import('./js/infdata.js'); const bad = [];
    for (const r of m.INF) { const s = m.splitInf(r.model, r.key); if (!s || !s.stem) bad.push(r.key); }
    return { bad, n: m.INF.length }; });
  ok(d.n === 10 && !d.bad.length, 'each of the ten model forms splits into stem and ending', JSON.stringify(d.bad));
  await p.evaluate(async () => { const k = await import('./js/know.js'), F = await import('./js/families.js'); k.K.settings.level = 0; k.K.settings.formLevel = F.NLEVELS; });
  await go('#/learn/charts'); ok(await p.locator('a.btn:text-is("Open Infinitives")').count() === 1, 'Charts page links to Infinitives');
  await go('#/learn/charts/infinitives');
  ok(await p.locator('.ptcrow').count() === 10, 'the page lists the ten kinds');
  ok(/to be loosed/.test(await p.innerText('#view')) && await p.locator('a.btn.start').count() === 1, 'meanings shown; "Which kind is it?" button');
  const real = await p.evaluate(async () => { const P = await import('./js/parse.js'), m = await import('./js/infdata.js'); const bad = []; let n = 0, shy = 0, none = 0;
    for (const x of P.infinitiveForms(null)) { const sp = m.splitInf(x.w, x.key); if (/­/.test(x.w)) shy++; if (!sp) { none++; continue; } n++; if (sp.stem + sp.ending !== x.w) bad.push(x.w); }
    return { n, shy, none, bad: bad.slice(0, 5) }; });
  ok(real.n > 30 && !real.bad.length && real.shy === 0, 'real infinitives split cleanly: ' + real.n + ' (' + real.none + ' not splittable)', JSON.stringify(real));
  const noContract = await p.evaluate(async () => { const m = await import('./js/infinitives.js'), pd = await import('./js/ptcdata.js'); const q = []; for (let i = 0; i < 15; i++) q.push(...m.infQueue(null)); return q.filter((x) => /^pres/.test(x.key) && /μι$/.test(pd.skel(x.head)) && !(x.sp && x.sp.mi)).length; });
  ok(noContract === 0, '-μι present rows are split by the -μι rules, never by the plain pattern');
  const before = await p.evaluate(async () => { const k = await import('./js/know.js'); return JSON.stringify([[...k.K.cards.keys()].length, k.K.daily]); });
  await p.evaluate(async () => { const k = await import('./js/know.js'); k.K.settings.formLevel = 1; });
  await go('#/learn/charts/infinitives/run'); await p.waitForSelector('.qwrap');
  ok(true, 'the quiz works even with the parsing level set to 1');
  const total = +(await p.innerText('.qcount')).match(/\/\s*(\d+)/)[1]; ok(total >= 4 && total <= 12, 'a round of up to twelve: ' + total);
  ok(await p.locator('.opt').count() === 4 && /from /.test(await p.innerText('.qcard')), 'four choices; the verb is shown');
  await p.click('.hintlink'); ok(await p.locator('.hintbox .ptcparts').count() === 1 && await p.locator('.hintbox .ptcparts small').count() === 0, 'first hint: the split, unlabeled');
  ok(!/will count as missed/.test(await p.innerText('.hintbox')) && /What the ending means/.test(await p.innerText('.hintbox')), 'first hint is free');
  await p.click('.hintlink:has-text("What the ending means")'); ok(/will count as missed/.test(await p.innerText('.hintbox')), 'second hint counts as a miss');
  let sawWrong = false;
  for (let i = 0; i < 24 && !sawWrong; i++) {
    if (!(await p.locator('.qcard').count())) break;
    await p.locator('.opt').nth(i % 4).click(); await p.waitForSelector('.fb');
    if (await p.locator('.fb.bad').count()) { sawWrong = true; ok(await p.locator('.fb .ptcparts small').count() === 2, 'feedback labels stem and ending'); break; }
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
  const la = await p.evaluate(async () => { const m = await import('./js/infinitives.js'); let n = 0; for (let i = 0; i < 20; i++) if (m.infOptions('pres-act').some((r) => r.key === 'aor2-act') && m.infOptions('aor2-mid').some((r) => r.key === 'pres-mp')) n++; return n; });
  ok(la === 20, 'look-alike kinds always sit beside each other');
  const ex = await p.evaluate(async () => { const m = await import('./js/infinitives.js'); const x = { key: 'perf-mp', head: 'λύω', sp: { stemSkel: 'λελυ' } }; return m.explainInf(x).join(' '); });
  ok(/Middle and passive look the same/.test(ex), 'middle/passive note on the perfect');
  await p.evaluate(async () => { const k = await import('./js/know.js'), F = await import('./js/families.js'); k.K.settings.formLevel = F.NLEVELS; });
  await go('#/parse/run/inf/all'); await p.waitForSelector('.qwrap');
  ok(/practice only/.test(await p.innerText('.practice-note')), 'Parse some infinitives: practice only');
  await p.evaluate(async () => { const k = await import('./js/know.js'); k.K.settings.level = null; });
  await go('#/learn/charts/infinitives/run'); ok(/no infinitives to practice yet/.test(await p.innerText('#view')), 'empty state is explained');
  ok(!errs.length, 'no page errors ' + errs.join('|'));
  await b.close(); console.log(bad ? 'FAILED' : 'ALL OK'); process.exit(bad ? 1 : 0);
})();
