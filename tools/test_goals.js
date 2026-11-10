// Goals: node tools/test_goals.js  (server must be running on :8123)
const { chromium } = require('playwright');
const out = process.env.SHOTS || '/tmp/lexiko-shots-goals'; require('fs').mkdirSync(out, { recursive: true });
const URL = 'http://localhost:8123/lexiko/';
let fails = 0; const ok = (c, m, x = '') => { console.log((c ? '  ok  ' : '  FAIL ') + m + (x ? ' ' + x : '')); if (!c) fails++; };
(async () => {
  const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, colorScheme: 'dark' });
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', (e) => errs.push(e.message)); p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
  await p.goto(URL); await p.waitForSelector('#nav a[data-tab]', { timeout: 60000 });
  const r = await p.evaluate(async () => {
    const k = await import('./js/know.js');
    const sg = (l) => k.suggestGoal(l).min;
    const out = { none: sg(null), l50: sg(50), l20: sg(20), l5: sg(5), l100: sg(100), l2: sg(2) };
    await k.setLevel(50); await k.setGoal(null);
    out.cur = k.currentGoal(); const s = k.goalStats(out.cur); out.stats = s;
    out.w50 = k.goalWords({ kind: 'freq', min: 50 }).length; out.w100 = k.goalWords({ kind: 'freq', min: 100 }).length;
    out.label = k.goalLabel({ kind: 'freq', min: 30 });
    await k.setGoal({ book: '1JN', c1: 1, v1: 1, c2: 2, v2: 29 }); out.legacy = k.currentGoal().kind;
    return out;
  });
  console.log(JSON.stringify(r));
  ok(r.none === 50 && r.l50 === 30 && r.l20 === 15 && r.l5 === 3 && r.l100 === 50 && r.l2 === 2, 'suggested goal sits just above the level');
  ok(r.cur.kind === 'freq' && r.cur.min === 30, 'no goal set gives the suggestion for the level');
  ok(r.w100 > 150 && r.w100 < r.w50, 'frequency word sets grow down the ladder', r.w100 + '/' + r.w50);
  ok(r.stats.known === r.stats.total && r.stats.pct === 1 || r.stats.known < r.stats.total, 'stats are consistent', JSON.stringify(r.stats));
  ok(/30 or more/i.test(r.label), 'frequency label', r.label);
  ok(r.legacy === 'passage', 'old passage goals still work');

  // goal-driven new words
  const a = await p.evaluate(async () => {
    const k = await import('./js/know.js'), { D } = await import('./js/data.js');
    await k.setLevel(null); await k.setGoal({ kind: 'freq', min: 50 });
    const f = k.goalNext(undefined, 60).map((x) => D.lexByN.get(x.n).freq);
    const s = k.buildSession({}); const nw = s.filter((x) => x.type === 'new').map((x) => D.lexByN.get(x.n).freq);
    return { sorted: f.every((v, i) => i === 0 || f[i - 1] >= v), minF: Math.min(...f), n: f.length, nwSorted: nw.every((v, i) => i === 0 || nw[i - 1] >= v), nNew: nw.length };
  });
  ok(a.sorted && a.minF >= 50 && a.n > 0, 'frequency goal: most frequent first, none below the cut', JSON.stringify(a));
  ok(a.nNew > 0 && a.nwSorted, 'a session keeps new words in teaching order');
  await p.goto(URL + '#/read'); await p.waitForTimeout(1500);
  const b2 = await p.evaluate(async () => {
    const k = await import('./js/know.js'), { D, scopeVerses, loadBook } = await import('./js/data.js');
    if (loadBook) await loadBook('1JN');
    const g = { kind: 'passage', book: '1JN', c1: 1, v1: 1, c2: 2, v2: 29 };
    await k.setLevel(50); await k.setGoal(g);
    const w = k.goalNext(g, 500).map((x) => x.n), all = k.passageWords(g).map((x) => x.n);
    const s = k.buildSession({}); const nw = s.filter((x) => x.type === 'new').map((x) => x.n);
    const pos = nw.map((n) => w.indexOf(n));
    return { n: w.length, same: all.filter((n) => w.includes(n)).join() === w.join(), inOrder: pos.every((v, i) => v >= 0 && (i === 0 || pos[i - 1] < v)), nNew: nw.length };
  });
  ok(b2.n > 10 && b2.same, 'passage goal: words listed in order of first occurrence', JSON.stringify(b2));
  ok(b2.nNew > 0 && b2.inOrder, 'a session teaches the passage in order');

  // Home goal card
  await p.evaluate(async () => { const k = await import('./js/know.js'); await k.setLevel(50); await k.setSetting('parseAsked', true); await k.setGoal({ kind: 'freq', min: 30 }); });
  await p.goto(URL + '#/'); await p.waitForSelector('.goalnum');
  const hc = await p.locator('.goalnum').textContent();
  ok(/^\d[\d,]* of \d[\d,]* goal words known · \d+%$/.test(hc), 'Home card headline', hc);
  await p.goto(URL + '#/learn/words'); await p.waitForSelector('.finrow');
  const ht = await p.locator('#view').textContent();
  ok(/words? to go · about/.test(ht) && /Goal/.test(ht) && !/goal words known/.test(ht), 'Vocabulary goal card: the goal and the finish estimate only');
  await p.screenshot({ path: out + '/home-freq.png' });
  await p.goto(URL + '#/'); await p.waitForSelector('.goalnum');
  await p.locator('.goalnum').click(); await p.waitForTimeout(400); ok(!p.url().endsWith('#/progress'), 'a tap on the Home goal card does nothing (Progress is in the bottom bar)', p.url());
  await p.goto(URL + '#/'); await p.waitForSelector('.goalnum');
  await p.getByRole('button', { name: /Change/ }).click();
  ok(await p.locator('.goal-picker').isVisible() && p.url().endsWith('#/'), 'Change opens the picker on Home itself');
  await p.screenshot({ path: out + '/home-picker.png' });
  await p.getByRole('button', { name: 'Cancel' }).click();
  ok(await p.locator('.goalnum').isVisible(), 'Cancel returns to the goal card');
  await p.getByRole('button', { name: /Change/ }).click(); await p.locator('.goal-picker .goal-opt:not(.dis)').nth(1).click(); await p.getByRole('button', { name: 'Set as my goal' }).click();
  await p.waitForSelector('.goalnum');
  ok((await p.evaluate(async () => (await import('./js/know.js')).K.goal)).kind === 'freq', 'a goal chosen on Home is saved and the card returns');
  await p.evaluate(async () => { const k = await import('./js/know.js'); await k.setGoal({ kind: 'freq', min: 30 }); }); await p.goto(URL + '#/'); await p.waitForSelector('.goalnum');
  await p.evaluate(async () => { const k = await import('./js/know.js'); await k.setGoal({ kind: 'passage', book: '1JN', c1: 1, v1: 1, c2: 2, v2: 29 }); });
  await p.goto(URL + '#/read'); await p.waitForTimeout(800); await p.goto(URL + '#/learn/words'); await p.waitForSelector('.finrow');
  ok(/words? to go/.test(await p.locator('#view').textContent()) && await p.locator('a:has-text("next word")').count() === 0, 'Vocabulary card for a passage goal: finish estimate, no second learn button');
  await p.screenshot({ path: out + '/home-passage.png' });

  // finish-by control
  await p.evaluate(async () => { const k = await import('./js/know.js'); await k.setSetting('newPerDay', 10); await k.setGoal({ kind: 'freq', min: 30 }); });
  await p.goto(URL + '#/learn/words'); await p.reload(); await p.waitForSelector('.finrow');
  await p.getByRole('button', { name: /Adjust/ }).click();
  ok(await p.locator('.pacectl').isVisible(), 'Adjust opens the finish control');
  await p.getByRole('button', { name: /Close/ }).click(); ok(await p.locator('.pacectl').count() === 0, 'the Adjust button closes the control again');
  await p.getByRole('button', { name: /Adjust/ }).click();
  const t0 = await p.locator('.perday').textContent(); const per0 = +t0.match(/(\d+) new word/)[1];
  await p.getByRole('button', { name: 'More days' }).click();
  const t1 = await p.locator('.perday').textContent(); const per1 = +t1.match(/(\d+) new word/)[1];
  ok(per1 < per0, 'a later finish lowers the daily words', per0 + ' -> ' + per1);
  await p.getByRole('button', { name: 'More weeks' }).click(); await p.getByRole('button', { name: 'Fewer weeks' }).click(); await p.getByRole('button', { name: 'Fewer weeks' }).click();
  const t2 = await p.locator('.perday').textContent(); const per2 = +t2.match(/(\d+) new word/)[1];
  ok(per2 > per1, 'an earlier finish raises it', per1 + ' -> ' + per2);
  await p.screenshot({ path: out + '/home-pace.png' });
  await p.getByRole('button', { name: 'Use this pace' }).click(); await p.waitForSelector('.finrow');
  ok(await p.evaluate(async () => (await import('./js/know.js')).setting('newPerDay')) === per2, 'Use this pace saves the daily new words', String(per2));
  await p.getByRole('button', { name: /Adjust/ }).click();
  for (let i = 0; i < 12 && await p.getByRole('button', { name: 'Fewer days' }).isEnabled(); i++) await p.getByRole('button', { name: 'Fewer days' }).click();
  for (let i = 0; i < 12 && await p.getByRole('button', { name: 'Fewer weeks' }).isEnabled(); i++) await p.getByRole('button', { name: 'Fewer weeks' }).click();
  ok(/^40 new words a day/.test(await p.locator('.perday').textContent()) && await p.locator('.pacewarn').isVisible(), 'the control stops at 40 a day and says so');
  await p.locator('.pacectl').scrollIntoViewIfNeeded(); await p.screenshot({ path: out + '/home-pace-cap.png' });
  await p.getByRole('button', { name: 'Cancel' }).click();
  ok(await p.evaluate(async () => (await import('./js/know.js')).setting('newPerDay')) === per2, 'Cancel changes nothing');
  await p.evaluate(async () => { const k = await import('./js/know.js'); await k.setSetting('newPerDay', 10); });

  // progress card + picker
  await p.evaluate(async () => { const k = await import('./js/know.js'); await k.setGoal(null); });
  await p.goto(URL + '#/progress'); await p.waitForSelector('text=Goal');
  ok(await p.locator('text=goal words known').first().isVisible(), 'goal card shows words known');
  await p.getByRole('button', { name: /Change/ }).click();
  ok(await p.locator('.goal-picker').isVisible(), 'picker opens');
  const rungs = await p.locator('.goal-picker .goal-opt').count();
  ok(rungs >= 3, 'rungs listed', String(rungs));
  await p.locator('.goal-picker .goal-opt:not(.dis)').first().click();
  await p.screenshot({ path: out + '/picker.png' });
  await p.getByRole('button', { name: 'Set as my goal' }).click();
  await p.waitForSelector('text=Change ›');
  const g = await p.evaluate(async () => (await import('./js/know.js')).K.goal);
  ok(g && g.kind === 'freq', 'picked goal is saved', JSON.stringify(g));
  await p.getByRole('button', { name: /Change/ }).click();
  await p.getByRole('button', { name: 'Section' }).click();
  ok(await p.locator('.goal-picker .goal-opt').count() > 0, 'section tab lists sections');
  await p.getByRole('button', { name: 'Passage' }).click();
  ok(await p.locator('.goal-picker select').count() >= 5, 'passage tab has selects');
  // finishing a goal, the reader button and Goals completed
  await p.evaluate(async () => { const k = await import('./js/know.js'); await k.setLevel(50); await k.setGoal({ kind: 'freq', min: 100 }); });
  await p.goto(URL + '#/'); await p.reload(); await p.waitForSelector('text=Goal finished');
  const ft = await p.locator('#view').innerText();
  ok(/All \d[\d,]* goal words known/.test(ft) && /NEXT GOAL, SUGGESTED/.test(ft) && /30 or more times/.test(ft), 'finished goal card suggests the next goal', ft.split('\n').slice(0, 12).join(' | ').slice(0, 200));
  await p.waitForSelector('#loading', { state: 'detached' }).catch(() => {}); await p.waitForTimeout(400); await p.screenshot({ path: out + '/home-finished.png' });
  await p.getByRole('button', { name: 'Start this goal' }).click(); await p.waitForSelector('.goalnum');
  const g5 = await p.evaluate(async () => { const k = await import('./js/know.js'); return { goal: k.K.goal, done: k.K.goalsDone }; });
  ok(g5.goal.kind === 'freq' && g5.goal.min === 30 && g5.done.length === 1 && g5.done[0].goal.min === 100, 'the suggested goal is set and the finished one is recorded', JSON.stringify(g5).slice(0, 160));
  await p.goto(URL + '#/progress'); await p.reload(); await p.waitForSelector('text=Goals completed');
  ok(/Words occurring 100 or more times/.test(await p.locator('#view').innerText()), 'Goals completed lists it');
  await p.waitForSelector('#loading', { state: 'detached' }).catch(() => {}); await p.waitForTimeout(400); await p.screenshot({ path: out + '/progress-done.png' });
  const nx = await p.evaluate(async () => { const k = await import('./js/know.js'); return { a: k.nextGoal({ kind: 'freq', min: 2 }), b: k.nextGoal({ kind: 'passage', book: '1JN', c1: 1, v1: 1, c2: 2, v2: 29 }) }; });
  ok(nx.a === null && nx.b && nx.b.kind === 'pericope' && nx.b.c1 >= 2, 'next goal: none past the last rung; the next section after a passage', JSON.stringify(nx).slice(0, 140));
  const rh = await p.evaluate(async () => (await import('./js/reader.js')).readHref('1JN', 3));
  await p.goto(URL + rh); await p.reload(); await p.waitForSelector('text=Make this my goal');
  await p.waitForSelector('#loading', { state: 'detached' }).catch(() => {}); await p.waitForTimeout(400); await p.screenshot({ path: out + '/reader-goal.png' });
  await p.getByRole('button', { name: 'Make this my goal' }).click(); await p.waitForSelector('text=Your goal');
  const rg = await p.evaluate(async () => (await import('./js/know.js')).K.goal);
  ok(rg.kind === 'passage' && rg.book === '1JN' && rg.c1 === 3 && rg.c2 === 3, 'reader button makes the chapter the goal', JSON.stringify(rg));
  await p.evaluate(async () => { const k = await import('./js/know.js'); await k.setGoal({ kind: 'freq', min: 30 }); });

  // nothing should ever print a stray "null" or "undefined"
  const stray = [];
  for (const [hash, pre] of [['#/', null], ['#/progress', null]]) {
    await p.goto(URL + hash); await p.reload(); await p.waitForTimeout(600);
    stray.push([hash, /(null|undefined)/.test(await p.locator('#view').innerText())]);
  }
  await p.goto(URL + '#/learn/words'); await p.reload(); await p.waitForSelector('.finrow'); await p.getByRole('button', { name: /Adjust/ }).click();
  stray.push(['pace open', /(null|undefined)/.test(await p.locator('#view').innerText())]);
  await p.getByRole('button', { name: 'Cancel' }).click(); await p.goto(URL + '#/'); await p.waitForSelector('.goalnum'); await p.getByRole('button', { name: /Change/ }).click();
  stray.push(['home picker', /(null|undefined)/.test(await p.locator('#view').innerText())]);
  ok(!stray.some((x) => x[1]), 'no stray null or undefined on Home, Progress, pace control or picker', JSON.stringify(stray.filter((x) => x[1])));
  ok(errs.length === 0, 'no page errors', errs.join(' | ').slice(0, 200));
  await b.close(); console.log(fails ? fails + ' FAILED' : 'all ok'); process.exit(fails ? 1 : 0);
})();
