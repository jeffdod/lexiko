// "Parse from the chart": pick rows of the master verb chart, then parse real verbs of those forms (practice only).
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(), p = await b.newPage({ viewport: { width: 390, height: 860 } }); const errs = [];
  p.on('pageerror', (e) => errs.push(String(e)));
  const ok = (c, m) => { if (!c) { console.log('FAIL: ' + m); process.exitCode = 1; } };
  const know = (lvl) => p.evaluate(async (lvl) => { const K = await import('/lexiko/js/know.js'), F = await import('/lexiko/js/families.js'); K.K.settings.level = lvl; K.K.settings.formLevel = F.NLEVELS; }, lvl);
  await p.goto('http://localhost:8123/lexiko/#/learn/charts'); await p.waitForTimeout(1800); await know(0);
  // the entry point, inside the Master verb chart card
  ok(await p.locator('.card:has(h2:text("Master verb chart")) a[href="#/learn/charts/pick"]').count() === 1, 'the Master verb chart card has a "Parse from this chart" button');
  await p.locator('a[href="#/learn/charts/pick"]').click(); await p.waitForTimeout(800);
  ok(/Choose at least one row/.test(await p.locator('.pickbar').innerText()), 'nothing chosen: the start button says to choose a row');
  const chip = async (name) => (await p.locator('.pickrow', { hasText: name }).first().locator('.chip').innerText()).trim();
  ok(+(await chip('Present act')) > 100, 'rows show how many forms are available: ' + await chip('Present act'));
  await p.locator('.pickrow', { hasText: 'Present act' }).locator('input').check();
  ok(/^Parse 8 forms · 1 row$/.test((await p.locator('.pickbar').innerText()).trim()), 'one row: at least 8 forms: ' + (await p.locator('.pickbar').innerText()).trim());
  for (const n of ['Imperfect act', 'Future act', '1st aorist act']) await p.locator('.pickrow', { hasText: n }).locator('input').check();
  ok(/^Parse 8 forms · 4 rows$/.test((await p.locator('.pickbar').innerText()).trim()), 'four rows: still 8 forms');
  // a whole group at once, then clearing it
  await p.locator('.pickgroup', { hasText: 'Aorist' }).getByRole('button', { name: 'Select all' }).click();
  const aor = await p.locator('.pickgroup', { hasText: 'Aorist' }).locator('input:checked').count();
  ok(aor >= 6, 'Select all ticks the group: ' + aor);
  await p.locator('.pickgroup', { hasText: 'Aorist' }).getByRole('button', { name: 'Clear' }).click();
  ok(await p.locator('.pickgroup', { hasText: 'Aorist' }).locator('input:checked').count() === 0, 'Clear unticks the group');
  // the queue: at least 8 and at least one per row; no more than one per form; with many rows, one or more per row
  const q = await p.evaluate(async () => { const P = await import('/lexiko/js/parse.js'), { D } = await import('/lexiko/js/data.js'), C = await import('/lexiko/js/chartdrill.js');
    const keys = ['pres-act', 'aor1-act'], two = P.rowsQueue(keys), all = C.ROWS.map((r) => r.key).filter((k) => P.rowPool(k, { ignoreLevel: true }).length), many = P.rowsQueue(all);
    const rowsOf = (queue, ks) => ks.map((k) => queue.some((x) => P.rowPool(k, { ignoreLevel: true }).includes(x.id)));
    const few = P.rowsQueue(['fut-pas2']);
    return { two: two.length, twoDup: new Set(two.map((x) => x.id)).size === two.length, twoRows: rowsOf(two, keys), many: many.length, nAll: all.length, manyRows: rowsOf(many, all).every(Boolean), few: few.length, types: [...new Set(two.map((x) => x.type))] }; });
  ok(q.two === 8 && q.twoDup && q.twoRows.every(Boolean), 'two rows: 8 different forms, both rows represented: ' + JSON.stringify(q));
  ok(q.many === Math.max(8, q.nAll) && q.manyRows, 'every row picked is represented: ' + JSON.stringify(q));
  // start: a practice session opens
  await p.locator('.pickrow', { hasText: 'Present act' }).locator('input').check();
  const href = await p.locator('.pickbar a').getAttribute('href'); ok(/^#\/parse\/run\/rows\/[^/]+\/known$/.test(href), 'start link: ' + href);
  const before = await p.evaluate(async () => { const K = await import('/lexiko/js/know.js'); return K.K.cards.size; });
  await p.locator('.pickbar a').click(); await p.waitForTimeout(1200);
  ok(/\d+ \/ \d+/.test(await p.locator('#view').innerText()), 'a parsing question is showing');
  ok(await p.evaluate(async () => (await import('/lexiko/js/know.js')).K.cards.size) === before, 'starting the quiz creates no cards');
  // any verb: with no verbs known, "Ones I know" has nothing, "Any verb" has forms
  await know(null); await p.evaluate(() => { location.hash = '#/learn/charts/pick'; }); await p.waitForTimeout(800);
  ok(/Choose at least one row/.test(await p.locator('.pickbar').innerText()) && await p.locator('.pickrow input:disabled').count() >= 18, 'no verbs known: the rows are greyed out');
  await p.getByRole('button', { name: 'Any verb' }).click();
  ok(+(await chip('Present act')) > 100 && await p.locator('.pickrow input:disabled').count() === 0, '"Any verb" brings the rows back');
  await p.locator('.pickrow', { hasText: 'Present act' }).locator('input').check(); await p.locator('.pickbar a').click(); await p.waitForTimeout(1200);
  ok(p.url().endsWith('/any') && /\d+ \/ \d+/.test(await p.locator('#view').innerText()), 'a quiz from any verb starts: ' + p.url());
  ok(!errs.length, 'page errors: ' + errs.join('|'));
  console.log(process.exitCode ? 'FAILED' : 'ALL OK'); await b.close();
})();
