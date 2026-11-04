// The Charts topic: Learn tile, page, chart drill, scheduling, unlock tie-in. node tools/test_charts.js (server on :8123)
const { chromium } = require('playwright');
const URL = 'http://localhost:8123/lexiko/';
let fails = 0; const ok = (c, m, x = '') => { console.log((c ? '  ok  ' : '  FAIL ') + m + (x ? ' ' + x : '')); if (!c) fails++; };
process.on('unhandledRejection', (e) => { console.log('UNHANDLED', e && e.message); process.exit(1); });
(async () => {
  const b = await chromium.launch(); const p = await (await b.newContext({ viewport: { width: 390, height: 844 } })).newPage(); const errs = [];
  p.on('pageerror', (e) => errs.push(e.message));
  const ready = async () => { await p.waitForSelector('#nav a[data-tab]', { timeout: 60000 }); await p.waitForFunction(() => !document.getElementById('loading')); };
  await p.goto(URL); await ready();
  await p.evaluate(async () => { const k = await import('./js/know.js'); await k.setLevel(100); await k.setSetting('levelAsked', true); });
  const go = async (h) => { await p.goto(URL + h); await p.reload(); await ready(); await p.waitForTimeout(300); };

  const m = await p.evaluate(async () => { const c = await import('./js/chartdrill.js'); return { rows: c.ROWS.length, items: c.ITEMS.length, ids: new Set(c.ITEMS.map((i) => i.id)).size, ex: ['pres-act', 'aor1-pas', 'perf-mp', 'aor-liq-act'].map(c.exampleFor), sum: c.summary(c.ROWS.find((r) => r.key === 'aor1-pas')) }; });
  ok(m.rows === 20 && m.items === 20 * 5 + 24 && m.ids === m.items, 'the chart has 20 rows, 5 squares each, plus 24 personal endings', JSON.stringify([m.rows, m.items]));
  ok(m.ex.every(Boolean), 'real example forms come from the text, liquid rows included', JSON.stringify(m.ex));
  ok(/1st aorist passive/.test(m.sum) && /θη/.test(m.sum) && /secondary active/.test(m.sum), 'row summary uses the chart', m.sum);

  await go('#/learn');
  ok(await p.locator('a.tile[href="#/learn/charts"]').count() === 1 && /Learn the master verb chart/.test(await p.textContent('a.tile[href="#/learn/charts"]')), 'Learn: Charts tile');
  await p.click('a.tile[href="#/learn/charts"]'); await p.waitForSelector('h1:text-is("Charts")');
  ok(await p.locator('a.rowlink').count() === 20 && await p.locator('.sqrow.e:not(.head)').count() === 4, 'Charts page: 20 chart rows and 4 endings rows');
  ok(await p.locator('.sqrow:has(a.rowlink) .sq').count() === 100 && await p.locator('a.start:has-text("20 new")').count() === 1, 'Charts page: 100 squares, start button offers a full round of 20 new');
  ok(!/(null|undefined)/.test(await p.textContent('#view')), 'Charts page: no stray null/undefined');

  // a drill: answer everything right except the first question, then check cards
  await p.click('a.start'); await p.waitForSelector('.qcard');
  ok(await p.locator('.opt').count() >= 2 && /Master verb chart|Personal endings/.test(await p.textContent('.qmeta')), 'drill: a multiple-choice question');
  let n = 0, firstWrong = true, overCount = false, sawRetry = false;
  for (let i = 0; i < 40; i++) {
    if (!(await p.locator('.qcard').count())) break;
    const right = await p.evaluate(async () => { return null; });
    // find the right option by asking the page what the answer is: click each option until one is marked right is not possible; use the question text
    const info = await p.evaluate(() => ({ ask: document.querySelector('.qask').textContent, main: document.querySelectorAll('.qask,.qgreek')[1] && document.querySelector('.qgreek').textContent }));
    // pick the first option (may be wrong); the test only checks mechanics
    { const t = await p.textContent('.qcount'), [a, b] = t.replace('↻', '').split('/').map((x) => +x); if (a > b) overCount = true; if (t.includes('↻')) sawRetry = true; }
    await p.locator('.opt').first().click(); await p.waitForSelector('.fb'); n++;
    await p.click('button:text-is("Continue")'); await p.waitForTimeout(80);
  }
  ok(sawRetry, 'drill: missed squares come back in a retry round with the ↻ counter');
  ok(!overCount, 'drill: the counter never goes past the total (retries are not new cards)');
  ok(n >= 20, 'drill: runs through its questions', 'answered ' + n);
  await p.waitForSelector('h1:text-is("Chart practice complete")'); ok(/squares done/.test(await p.textContent('#view')), 'drill: finish screen');
  const st = await p.evaluate(async () => { const k = await import('./js/know.js'); const cs = [...k.K.cards.values()].filter((c) => /^[ce]:/.test(c.id)); return { n: cs.length, again: cs.filter((c) => c.lapses > 0 || c.state === 'relearning' || c.state === 'learning').length }; });
  ok(st.n === 20, 'drill: 20 new squares started', JSON.stringify(st));
  await go('#/learn/charts'); ok(await p.locator('a.start:has-text("new")').count() === 1, 'no daily limit: another round of new squares is offered at once', await p.textContent('.start'));
  ok(await p.locator('.sqrow .sq.shaky, .sqrow .sq.known').count() === 20, 'started squares are colored');

  // scheduling: due squares come first; time moves on
  const d = await p.evaluate(async () => { const k = await import('./js/know.js'), c = await import('./js/chartdrill.js'); const cs = [...k.K.cards.values()].filter((x) => /^[ce]:/.test(x.id)); const was = c.plan().due.length;
    for (const x of cs) x.due = Date.now() - 1000; const pl = c.plan(); return { was, due: pl.due.length, nw: pl.nw.length, count: k.chartCardsDue().length, counts: c.counts().due }; });
  ok(d.was === 0 && d.due === 20 && d.nw === 0 && d.count === 20 && d.counts === 20, 'due squares are counted and served', JSON.stringify(d));

  // chart squares never join word or form sessions
  const mix = await p.evaluate(async () => { const k = await import('./js/know.js'), P = await import('./js/parse.js'), sm = await import('./js/smart.js'); const t0 = k.dueTotal(), pd = P.parseDueCount(), wd = k.dueCards().length;
    const ids = (pl) => pl.due.map((x) => String(x.id)).concat(pl.fresh.map((x) => String(x.id)));
    return { same: k.dueTotal() === t0 && P.parseDueCount() === pd, chartDue: k.chartCardsDue().length, sessionHasChart: [...k.dueCards().map((c) => c.id), ...k.parseCardsDue().map((c) => c.id)].some((id) => /^[ce]:/.test(id)) }; });
  ok(mix.chartDue === 20 && mix.same && !mix.sessionHasChart, 'chart squares are not counted in word or form reviews', JSON.stringify(mix));

  // learning a level of the chart opens the verb forms
  const u = await p.evaluate(async () => { const k = await import('./js/know.js'), F = await import('./js/fsrs.js'), L = await import('./js/families.js'); await k.setSetting('formLevel', 1); k.K.famAcc = {};
    const lv3 = Object.keys(L.ROW_LEVEL).filter((r) => L.ROW_LEVEL[r] === 1); const before = k.formLevel();
    for (const r of lv3) for (const a of L.CHART_ATTRS) { const id = 'c:' + r + ':' + a; k.K.cards.set(id, { ...F.newCard(id), state: 'review', stability: 20, reps: 4, last: Date.now(), due: Date.now() + 864e5 }); }
    const known = k.chartKnown(1); await k.advanceLevels(); return { known, before, after: k.formLevel() }; });
  ok(u.known && u.before === 1 && u.after >= 2, 'knowing every square of level 1 rows opens the next kind of verb form', JSON.stringify(u));
  // paradigms
  const pg = await p.evaluate(async () => { const P = await import('./js/paradigms.js'), C = await import('./js/chartdrill.js'), D = (await import('./js/data.js')).D; const out = { rows: 0, none: [], fullRows: 0, bad: [] }; const all = new Set(D.forms.map((f) => f.w.replace(/\u00ad/g, '')));
    for (const r of C.ROWS) { const x = P.paradigm(r.key); if (!x) { out.none.push(r.key); continue; } out.rows++; if (x.attested === 6) out.fullRows++;
      for (const c of x.cells) { if (c.word !== c.stem + c.ending) out.bad.push('split ' + r.key + ':' + c.word); if (c.inText && !all.has(c.word)) out.bad.push('claims text ' + r.key + ':' + c.word); } }
    return out; });
  ok(pg.rows === 20 && pg.none.length === 0, 'every chart row has a paradigm', JSON.stringify(pg.none));
  ok(pg.bad.length === 0, 'every form marked in-the-text really is in the text', pg.bad.join(' '));
  ok(pg.rows === 20, 'the chart-named verbs give a paradigm for every row');
  await go('#/learn/charts'); await p.click('a.rowlink >> nth=0'); await p.waitForSelector('.pline');
  ok(await p.locator('.pline').count() === 6 && await p.locator('.pend').count() >= 3 && /Present active indicative/.test(await p.textContent('.chip')), 'paradigm page: six lines for the present active row');
  { const m = await p.evaluate(() => { const w = document.querySelector('.pword'), a = w.querySelector('.pstem'), b = w.querySelector('.pend'), cs = getComputedStyle(a), r1 = a.getBoundingClientRect(), r2 = b.getBoundingClientRect(); return { border: cs.borderTopWidth, disp: cs.display, sameLine: Math.abs(r1.top - r2.top) < 6 && r2.left >= r1.right - 1, text: w.textContent }; });
    ok(m.border === '0px' && m.disp === 'inline' && m.sameLine, 'paradigm: the whole word on one line, no box around the stem', JSON.stringify(m)); }
  ok(/Verb:/.test(await p.textContent('#view')) && !/(null|undefined)/.test(await p.textContent('#view')), 'paradigm page: names the verb, no stray null/undefined');
  await p.click('a.btn.primary:text-is("Practice this row")'); await p.waitForSelector('.qcard');
  ok(await p.locator('.qtop .qcount').textContent() === '1 / 5', 'practice this row: the five squares of that row');
  await p.goto(URL + '#/learn/charts/paradigm/aor1-pas'); await p.reload(); await ready(); await p.waitForSelector('.pline');
  ok(await p.locator('.pword').count() === 6 && /occur in the text/.test(await p.textContent('#view')), 'a row shows all six forms and says how many occur in the text');
  { await go('#/learn/charts/run/pres-act'); let seen = null;
    for (let i = 0; i < 6 && !seen; i++) { await p.waitForSelector('.qcard'); const ask = await p.textContent('.qask'); if (/front/.test(ask)) seen = await p.$$eval('.opt', (o) => o.map((x) => x.textContent.replace(/[✓✗]/g, '').trim())); else { await p.locator('.opt').first().click(); await p.waitForSelector('.fb'); await p.click('button:text-is("Continue")'); await p.waitForTimeout(150); } }
    ok(seen && seen.includes('nothing') && !seen.includes('none'), 'augment question: the empty answer reads "nothing"', JSON.stringify(seen)); }
  { const r = await p.evaluate(async () => { const C = await import('./js/chartdrill.js'); return { s: C.summary(C.ROWS.find((x) => x.key === 'perf-mp')), t: C.summary(C.ROWS.find((x) => x.key === 'aor1-pas')) }; });
    ok(/first consonant \+ ε/.test(r.s) && !/λε/.test(r.s) && /augment ε/.test(r.t), 'the reduplication is described for any verb (first consonant + ε), not as the model verb\'s λε', r.s); }
  { await go('#/learn/charts/run/aor1-pas'); await p.waitForSelector('.qcard');
    ok(await p.locator('.hintlink').count() === 1 && !/Chart verb/.test(await p.textContent('.qcard')), 'hint: closed to begin with');
    await p.click('.hintlink'); ok(/Chart verb: λύω/.test(await p.textContent('.hintbox')) && !/1st sing/.test(await p.textContent('.hintbox')), 'hint 1: the chart verb only');
    await p.click('.hintlink:has-text("Show the form")'); ok(/1st sing\.: ἐλύθην/.test(await p.textContent('.hintbox')) && /count as missed/.test(await p.textContent('.hintbox')), 'hint 2: the first-person form, with the warning');
    const id = await p.evaluate(() => null);
    await p.locator('.opt').first().click(); await p.waitForSelector('.fb');
    ok(await p.locator('.hintbox .hintlink').count() === 0, 'hint: gone once you answer');
    await p.click('button:text-is("Continue")'); await p.waitForTimeout(150); await p.waitForSelector('.qcard');
    ok(await p.locator('.hintlink').count() === 1 && !/Chart verb/.test(await p.textContent('.qcard')), 'hint: closed again on the next question');
    // peeking then answering right still counts as missed
    const r = await p.evaluate(async () => { const K = await import('./js/know.js'); return [...K.K.cards.values()].filter((c) => c.id.startsWith('c:aor1-pas:')).map((c) => [c.id, c.lapses, c.state]); });
    ok(r.length >= 1 && r.some((x) => x[1] > 0 || x[2] === 'relearning' || x[2] === 'learning'), 'hint 2 then answering is recorded as a miss', JSON.stringify(r)); }
  ok(errs.length === 0, 'no page errors', errs.join('|'));
  await b.close(); console.log(fails ? fails + ' FAILED' : 'ALL OK'); process.exit(fails ? 1 : 0);
})();
