// Subjunctive: the page, eight paradigms, the "which kind is it?" quiz (practice only) and the parsing route.
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(), p = await b.newPage({ viewport: { width: 420, height: 900 } }); let bad = 0; const ok = (c, m, x = '') => { console.log((c ? '  ok  ' : 'FAIL  ') + m + (c ? '' : ' ' + x)); if (!c) bad++; };
  const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  const go = async (h) => { await p.evaluate((x) => { location.hash = x; }, h); await p.waitForTimeout(700); };
  await p.goto('http://localhost:8123/#/learn'); await p.waitForTimeout(1500);
  const d = await p.evaluate(async () => { const m = await import('./js/subdata.js'); const bad = []; let n = 0;
    for (const r of m.SUB) { if (r.forms.length !== 6) bad.push(r.key + ' count'); for (const f of r.forms) { n++; const w = f.replace('(ν)', ''), s = m.splitSub(w, r.key); if (!s || s.stem + s.formative + s.vowel + s.ending !== w || !/^[ωη]$/.test(m.skel ? '' : '') && false) bad.push(r.key + ':' + f); else if (!/[ωη]/.test(s.vowel.normalize('NFD')[0])) bad.push(r.key + ' vowel ' + f); } }
    return { n, bad, keys: m.SUB.length }; });
  ok(d.keys === 8 && d.n === 48 && !d.bad.length, 'eight paradigms of six forms, each splits into stem, formative, vowel, ending', JSON.stringify(d.bad.slice(0, 5)));
  await p.evaluate(async () => { const k = await import('./js/know.js'), F = await import('./js/families.js'); k.K.settings.level = 0; k.K.settings.formLevel = F.NLEVELS; });
  await go('#/learn/charts'); ok(await p.locator('a.btn:text-is("Open Subjunctive")').count() === 1, 'Charts page links to Subjunctive');
  await go('#/learn/charts/subjunctive');
  ok(await p.locator('.ptcrow').count() === 8 && await p.locator('a.btn.start').count() === 1, 'the page lists the eight kinds; "Which kind is it?" button');
  await p.click('.ptcrow a >> nth=2'); await p.waitForTimeout(500);
  ok(await p.locator('.pcell').count() === 6 && await p.locator('.pcell .pform').count() === 6, 'a paradigm has six forms, each with its formative marked');
  ok(await p.locator('a.btn:text-is("Parse forms like this")').count() === 1 && await p.locator('a.btn:text-is("Which kind is it?")').count() === 1, 'paradigm page buttons');
  const real = await p.evaluate(async () => { const P = await import('./js/parse.js'), m = await import('./js/subdata.js'); const bad = []; let n = 0, shy = 0, none = 0;
    for (const x of P.subjunctiveForms(null, { ignoreLevel: true })) { const sp = m.splitSub(x.w, x.key); if (/­/.test(x.w)) shy++; if (!sp) { none++; continue; } n++; if (sp.stem + sp.formative + sp.vowel + sp.ending !== x.w) bad.push(x.w); }
    return { n, shy, none, bad: bad.slice(0, 5) }; });
  ok(real.n > 30 && !real.bad.length && real.shy === 0, 'real subjunctives split cleanly: ' + real.n + ' (' + real.none + ' not splittable)', JSON.stringify(real));
  const noContract = await p.evaluate(async () => { const m = await import('./js/subjunctives.js'), pd = await import('./js/ptcdata.js'); const q = []; for (let i = 0; i < 15; i++) q.push(...m.subQueue(null)); return q.filter((x) => /μι$/.test(pd.skel(x.head))).length; });
  ok(noContract === 0, 'no -μι verbs in the quiz (yet)');
  const before = await p.evaluate(async () => { const k = await import('./js/know.js'); return JSON.stringify([[...k.K.cards.keys()].length, k.K.daily]); });
  await p.evaluate(async () => { const k = await import('./js/know.js'); k.K.settings.formLevel = 1; });
  await go('#/learn/charts/subjunctive/run'); await p.waitForSelector('.qwrap');
  const total = +(await p.innerText('.qcount')).match(/\/\s*(\d+)/)[1]; ok(total >= 4 && total <= 12, 'a round of up to twelve, even at parsing level 1: ' + total);
  ok(await p.locator('.opt').count() === 4 && /from /.test(await p.innerText('.qcard')), 'four choices; the verb is shown');
  await p.click('.hintlink'); ok(await p.locator('.hintbox .ptcparts').count() === 1 && await p.locator('.hintbox .ptcparts small').count() === 0, 'first hint: the split, unlabeled');
  ok(!/will count as missed/.test(await p.innerText('.hintbox')) && /What the pieces mean/.test(await p.innerText('.hintbox')), 'first hint is free');
  await p.click('.hintlink:has-text("What the pieces mean")'); ok(/will count as missed/.test(await p.innerText('.hintbox')), 'second hint counts as a miss');
  let sawWrong = false;
  for (let i = 0; i < 24 && !sawWrong; i++) {
    if (!(await p.locator('.qcard').count())) break;
    await p.locator('.opt').nth(i % 4).click(); await p.waitForSelector('.fb');
    if (await p.locator('.fb.bad').count()) { sawWrong = true; const n = await p.locator('.fb .ptcparts small').count(); ok(n >= 2 && n <= 4, 'feedback labels the pieces: ' + n); ok(/long vowel/.test(await p.innerText('.fb')), 'feedback names the long vowel'); break; }
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
  const la = await p.evaluate(async () => { const m = await import('./js/subjunctives.js'); let n = 0; for (let i = 0; i < 20; i++) if (m.subOptions('pres-act').some((r) => r.key === 'aor2-act') && m.subOptions('aor2-mid').some((r) => r.key === 'pres-mp')) n++; return n; });
  ok(la === 20, 'look-alike kinds always sit beside each other');
  const ex = await p.evaluate(async () => { const m = await import('./js/subjunctives.js'), s = await import('./js/subdata.js'); const f = (w, key, head) => m.explainSub({ key, head, w, sp: s.splitSub(w, key) }).join(' ');
    return [f('λύσω', 'aor1-act', 'λύω'), f('λύωμεν', 'pres-act', 'λύω'), f('λύῃ', 'pres-mp', 'λύω'), f('ἔλθωμεν', 'aor2-act', 'ἔρχομαι')]; });
  ok(/future indicative/.test(ex[0]) && /short ο/.test(ex[1]) && /same as the present middle\/passive indicative/.test(ex[2]) && /2nd aorist/.test(ex[3]), 'notes: same spelling as the indicative; short vowel; stem comparison', JSON.stringify(ex));
  await p.evaluate(async () => { const k = await import('./js/know.js'), F = await import('./js/families.js'); k.K.settings.formLevel = F.NLEVELS; });
  await go('#/parse/run/sub/all'); await p.waitForSelector('.qwrap');
  ok(/practice only/.test(await p.innerText('.practice-note')), 'Parse some subjunctives: practice only');
  await p.evaluate(async () => { const k = await import('./js/know.js'); k.K.settings.level = null; });
  await go('#/learn/charts/subjunctive/run'); ok(/no subjunctives to practice yet/.test(await p.innerText('#view')), 'empty state is explained');
  ok(!errs.length, 'no page errors ' + errs.join('|'));
  await b.close(); console.log(bad ? 'FAILED' : 'ALL OK'); process.exit(bad ? 1 : 0);
})();
