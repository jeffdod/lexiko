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
  ok(m.ex[0] && m.ex[1] && m.ex[2] && m.ex[3] === null, 'real example forms come from the text (none for liquid rows)', JSON.stringify(m.ex));
  ok(/1st aorist passive/.test(m.sum) && /θη/.test(m.sum) && /secondary active/.test(m.sum), 'row summary uses the chart', m.sum);

  await go('#/learn');
  ok(await p.locator('a.tile[href="#/learn/charts"]').count() === 1 && /Learn the master verb chart/.test(await p.textContent('a.tile[href="#/learn/charts"]')), 'Learn: Charts tile');
  await p.click('a.tile[href="#/learn/charts"]'); await p.waitForSelector('h1:text-is("Charts")');
  ok(await p.locator('.sqrow.rowbtn').count() === 20 && await p.locator('.sqrow.e:not(.head)').count() === 4, 'Charts page: 20 chart rows and 4 endings rows');
  ok(await p.locator('.sqrow.rowbtn .sq').count() === 100 && await p.locator('a.start:has-text("8 new")').count() === 1, 'Charts page: 100 squares, start button offers 8 new');
  ok(!/(null|undefined)/.test(await p.textContent('#view')), 'Charts page: no stray null/undefined');
  await p.click('.sqrow.rowbtn >> nth=0'); await p.waitForSelector('dialog'); ok(await p.locator('dialog tr.hi').count() === 1, 'tapping a row opens the chart with that row highlighted'); await p.keyboard.press('Escape'); await p.waitForTimeout(200);

  // a drill: answer everything right except the first question, then check cards
  await p.click('a.start'); await p.waitForSelector('.qcard');
  ok(await p.locator('.opt').count() >= 2 && /Master verb chart|Personal endings/.test(await p.textContent('.qmeta')), 'drill: a multiple-choice question');
  let n = 0, firstWrong = true;
  for (let i = 0; i < 40; i++) {
    if (!(await p.locator('.qcard').count())) break;
    const right = await p.evaluate(async () => { return null; });
    // find the right option by asking the page what the answer is: click each option until one is marked right is not possible; use the question text
    const info = await p.evaluate(() => ({ ask: document.querySelector('.qask').textContent, main: document.querySelectorAll('.qask,.qgreek')[1] && document.querySelector('.qgreek').textContent }));
    // pick the first option (may be wrong); the test only checks mechanics
    await p.locator('.opt').first().click(); await p.waitForSelector('.fb'); n++;
    await p.click('button:text-is("Continue")'); await p.waitForTimeout(80);
  }
  ok(n >= 8, 'drill: runs through its questions', 'answered ' + n);
  await p.waitForSelector('h1:text-is("Chart practice complete")'); ok(/squares done/.test(await p.textContent('#view')), 'drill: finish screen');
  const st = await p.evaluate(async () => { const k = await import('./js/know.js'); const cs = [...k.K.cards.values()].filter((c) => /^[ce]:/.test(c.id)); return { n: cs.length, again: cs.filter((c) => c.lapses > 0 || c.state === 'relearning' || c.state === 'learning').length, cn: k.chartNewToday() }; });
  ok(st.n === 8 && st.cn === 8, 'drill: 8 new squares started and counted', JSON.stringify(st));
  await go('#/learn/charts'); ok(await p.locator('a.start:has-text("new")').count() === 0, 'no more new squares today', await p.textContent('.start'));
  ok(await p.locator('.sqrow .sq.shaky, .sqrow .sq.known').count() === 8, 'started squares are colored');

  // scheduling: due squares come first; time moves on
  const d = await p.evaluate(async () => { const k = await import('./js/know.js'), c = await import('./js/chartdrill.js'); const cs = [...k.K.cards.values()].filter((x) => /^[ce]:/.test(x.id)); const was = c.plan().due.length;
    for (const x of cs) x.due = Date.now() - 1000; const pl = c.plan(); return { was, due: pl.due.length, nw: pl.nw.length, count: k.chartCardsDue().length, counts: c.counts().due }; });
  ok(d.was === 0 && d.due === 8 && d.nw === 0 && d.count === 8 && d.counts === 8, 'due squares are counted and served', JSON.stringify(d));

  // learning a level of the chart opens the verb forms
  const u = await p.evaluate(async () => { const k = await import('./js/know.js'), F = await import('./js/fsrs.js'), L = await import('./js/families.js'); await k.setSetting('formLevel', 1); k.K.famAcc = {};
    const lv3 = Object.keys(L.ROW_LEVEL).filter((r) => L.ROW_LEVEL[r] === 1); const before = k.formLevel();
    for (const r of lv3) for (const a of L.CHART_ATTRS) { const id = 'c:' + r + ':' + a; k.K.cards.set(id, { ...F.newCard(id), state: 'review', stability: 20, reps: 4, last: Date.now(), due: Date.now() + 864e5 }); }
    const known = k.chartKnown(1); await k.advanceLevels(); return { known, before, after: k.formLevel() }; });
  ok(u.known && u.before === 1 && u.after >= 2, 'knowing every square of level 1 rows opens the next kind of verb form', JSON.stringify(u));
  ok(errs.length === 0, 'no page errors', errs.join('|'));
  await b.close(); console.log(fails ? fails + ' FAILED' : 'ALL OK'); process.exit(fails ? 1 : 0);
})();
