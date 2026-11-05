// Participles: the page, ten paradigms, the "which kind is it?" quiz (practice only) and the parsing route.
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(), p = await b.newPage({ viewport: { width: 420, height: 900 } }); let bad = 0; const ok = (c, m, x = '') => { console.log((c ? '  ok  ' : 'FAIL  ') + m + (c ? '' : ' ' + x)); if (!c) bad++; };
  const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  const go = async (h) => { await p.evaluate((x) => { location.hash = x; }, h); await p.waitForTimeout(700); };
  await p.goto('http://localhost:8123/#/learn'); await p.waitForTimeout(1500);
  const d = await p.evaluate(async () => { const m = await import('./js/ptcdata.js'); const bad = []; let n = 0;
    for (const r of m.PTC) { const stem = m.skel(m.chars(r.forms[0][0]).slice(0, r.stemLen).join(''));
      for (const row of r.forms) { if (row.length !== 3) bad.push(r.key + ' row'); for (const f of row) { n++; const s = m.split(f.replace('(ν)', ''), r.key); if (!s || s.stemSkel !== stem || (r.fre && !s.formative)) bad.push(r.key + ':' + f); } } }
    return { n, bad, keys: m.PTC.length }; });
  ok(d.keys === 10 && d.n === 240 && !d.bad.length, 'ten paradigms of 24 forms, each splits into stem, formative and the rest', JSON.stringify(d.bad.slice(0, 5)));
  await p.evaluate(async () => { const k = await import('./js/know.js'), F = await import('./js/families.js'); k.K.settings.level = 0; k.K.settings.formLevel = F.NLEVELS; });
  await go('#/learn/charts'); ok(await p.locator('a.btn:text-is("Open Participles")').count() === 1, 'Charts page links to Participles');
  await go('#/learn/charts/participles');
  ok(await p.locator('.ptcrow').count() === 10, 'the page lists the ten kinds');
  ok((await p.innerText('main, #view')).includes('1 · The morpheme') && (await p.innerText('#view')).includes('2 · The formative'), 'morpheme card first, then formative');
  ok(await p.locator('a.btn.start').count() === 1, '"Which kind is it?" button');
  await p.click('.ptcrow a >> nth=0'); await p.waitForTimeout(500);
  ok(await p.locator('.ptctable tbody tr').count() === 8 && await p.locator('.ptctable tbody tr:first-child td').count() === 3, 'a paradigm is eight rows by three genders');
  ok(await p.locator('a.btn:text-is("Parse forms like this")').count() === 1 && await p.locator('a.btn:text-is("Which kind is it?")').count() === 1, 'paradigm page buttons');
  // real forms from the text: the pieces put back together give the word, and the stem is what comes before the formative
  const real = await p.evaluate(async () => { const P = await import('./js/parse.js'), m = await import('./js/ptcdata.js'); const bad = []; let n = 0, shy = 0;
    for (const x of P.participleForms(null)) { const sp = m.split(x.w, x.key); if (!sp) continue; n++; if (/\u00ad/.test(x.w)) shy++; if (sp.stem + sp.formative + sp.rest !== x.w) bad.push(x.w + ' ' + JSON.stringify(sp)); }
    const t = m.split('ἀκού\u00adου\u00adσιν', 'pres-act'); return { n, shy, bad: bad.slice(0, 5), t }; });
  ok(real.n > 100 && !real.bad.length && real.shy === 0, 'real participles split cleanly: ' + real.n + ' forms, no soft hyphens left', JSON.stringify(real.bad));
  ok(real.t && real.t.stem === 'ἀκού' && real.t.formative === 'ου' && real.t.rest === 'σιν', 'ἀκούουσιν (with soft hyphens) splits as ἀκού · ου · σιν', JSON.stringify(real.t));
  const noContract = await p.evaluate(async () => { const m = await import('./js/participles.js'), pd = await import('./js/ptcdata.js'); const q = []; for (let i = 0; i < 15; i++) q.push(...m.ptcQueue(null)); return q.filter((x) => /^pres/.test(x.key) && /μι$/.test(pd.skel(x.head)) && !(x.sp && x.sp.mi)).length; });
  ok(noContract === 0, '-μι present rows are split by the -μι rules, never by the plain pattern', String(noContract));
  // the quiz
  const before = await p.evaluate(async () => { const k = await import('./js/know.js'); return JSON.stringify([[...k.K.cards.keys()].length, k.K.daily]); });
  await p.evaluate(async () => { const k = await import('./js/know.js'); k.K.settings.formLevel = 1; });
  await go('#/learn/charts/participles/run'); await p.waitForSelector('.qwrap');
  const total = +(await p.innerText('.qcount')).match(/\/\s*(\d+)/)[1]; ok(total >= 6 && total <= 12, 'a round of up to twelve participles: ' + total);
  ok(await p.locator('.opt').count() === 4, 'four choices');
  ok(/from /.test(await p.innerText('.qcard')), 'the verb is shown on the question');
  await p.click('.hintlink'); ok(await p.locator('.hintbox .ptcparts').count() === 1 && await p.locator('.hintbox .ptcparts small').count() === 0, 'first hint shows the split without labels');
  const txt1 = await p.innerText('.hintbox'); ok(!/will count as missed/.test(txt1) && /What the pieces mean/.test(txt1), 'the first hint is free; the second is offered as a miss');
  await p.click('.hintlink:has-text("What the pieces mean")'); ok(/will count as missed/.test(await p.innerText('.hintbox')) && /present|aorist|perfect/.test(await p.innerText('.hintbox')), 'second hint says what the pieces mean and that it will count as missed');
  let sawWrong = false;
  for (let i = 0; i < 24 && !sawWrong; i++) {
    if (!(await p.locator('.qcard').count())) break;
    await p.locator('.opt').nth(i % 4).click(); await p.waitForSelector('.fb');
    if (await p.locator('.fb.bad').count()) { sawWrong = true; ok(await p.locator('.fb .ptcparts small').count() === 3, 'feedback labels stem, formative and morpheme + ending'); break; }
    await p.click('button:text-is("Continue")'); await p.waitForTimeout(150);
  }
  ok(sawWrong, 'a wrong answer was reached and explained');
  if (sawWrong) { await p.click('button:text-is("Continue")'); }
  // finish by answering everything wrong until the retry counter shows
  let sawRetry = false;
  for (let i = 0; i < 40; i++) {
    if (!(await p.locator('.qcard').count())) break;
    if (/↻/.test(await p.innerText('.qcount'))) { sawRetry = true; break; }
    const k = await p.locator('.opt').count(); await p.locator('.opt').nth(i % k).click(); await p.waitForSelector('.fb'); await p.click('button:text-is("Continue")'); await p.waitForTimeout(120);
  }
  ok(sawRetry, 'missed participles come back in a ↻ retry round');
  const after = await p.evaluate(async () => { const k = await import('./js/know.js'); return JSON.stringify([[...k.K.cards.keys()].length, k.K.daily]); });
  ok(before === after, 'practice only: no cards or daily counts changed');
  // look-alike offered
  const la = await p.evaluate(async () => { const m = await import('./js/participles.js'); let n = 0; for (let i = 0; i < 20; i++) if (m.ptcOptions('pres-act').some((r) => r.key === 'aor2-act')) n++; return n; });
  ok(la === 20, 'a present active always has the 2nd aorist active beside it');
  // parsing route
  await p.evaluate(async () => { const k = await import('./js/know.js'), F = await import('./js/families.js'); k.K.settings.formLevel = F.NLEVELS; });
  await go('#/parse/run/ptc/all'); await p.waitForSelector('.qwrap');
  ok(/Chart row/.test(await p.innerText('.practice-note')) && /practice only/.test(await p.innerText('.practice-note')), 'Parse some participles: practice only');
  // empty state
  await p.evaluate(async () => { const k = await import('./js/know.js'); k.K.settings.level = null; });
  await go('#/learn/charts/participles/run'); ok(/no participles to practice yet/.test(await p.innerText('#view')), 'empty state is explained');
  ok(!errs.length, 'no page errors ' + errs.join('|'));
  await b.close(); console.log(bad ? 'FAILED' : 'ALL OK'); process.exit(bad ? 1 : 0);
})();
