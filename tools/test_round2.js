// Home layout, keyboard shortcuts, study-by-frequency, growth chart, locked backups: node tools/test_round2.js (server on :8123)
const { chromium } = require('playwright');
const URL = 'http://localhost:8123/lexiko/';
let fails = 0;
const ok = (c, m) => { console.log((c ? '  ok  ' : ' FAIL ') + m); if (!c) fails++; };
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1000, height: 800 } });   // wide + mouse: keyboard hints show
  const page = await ctx.newPage();
  const errors = []; page.on('pageerror', (e) => errors.push(e.message)); page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(URL); await page.waitForSelector('#loading', { state: 'detached' });
  await page.click('.choice:has-text("I know the basics")'); await page.click('button:has-text("Continue")'); await page.click('button:has-text("Skip for now")');
  await page.waitForSelector('.hero');
  ok(await page.locator('.hero .start').count() === 1, 'home leads with one main button');
  ok(await page.locator('.kpis').count() === 0, 'home has no row of number boxes');
  ok(/Keep reading/.test(await page.textContent('#view')), 'home offers to keep reading');

  // flashcard keyboard: Space shows the answer, 3 rates Good, session moves on
  await page.goto(URL + '#/learn/daily'); await page.waitForSelector('.qcard');
  ok(await page.locator('.kbhint').first().isVisible(), 'keyboard hint is visible with a mouse and keyboard');
  await page.keyboard.press(' '); await page.waitForSelector('.grades');
  ok(await page.locator('.grades button').count() === 4, 'Space shows the answer and the four ratings');
  const before = await page.textContent('.qcard .qask, .qcard');
  await page.keyboard.press('3'); await page.waitForTimeout(300);
  ok(await page.locator('.qcard').count() === 1 && !(await page.locator('.grades').count()), '3 rates Good and shows the next card');

  // study by how common: Learn > Vocabulary lists groups; a group starts a session of only those words
  await page.goto(URL + '#/learn/words'); await page.waitForSelector('summary:has-text("Study by how common")');
  await page.click('summary:has-text("Study by how common")');
  ok(await page.locator('a[href^="#/learn/set/"]').count() >= 1, 'word groups offer Study links');
  const href = await page.locator('a[href^="#/learn/set/"]').first().getAttribute('href');
  const [lo, hi] = href.split('/').slice(-2).map(Number);
  await page.goto(URL + href); await page.waitForSelector('.qcard');
  const n = +(await page.evaluate(() => (document.querySelector('.qcard') || {}).textContent ? 1 : 0)); ok(n === 1, 'a frequency group starts a session (' + lo + '–' + hi + ')');

  // growth chart: appears after two days of study data
  await page.goto(URL + '#/progress'); await page.waitForSelector('h1');
  ok(/learning curve|words started/.test(await page.textContent('#view')), 'progress shows the learning curve card');
  await page.evaluate(async () => { const m = await import('./js/know.js'); const d = new Date(); for (let i = 0; i < 5; i++) { const k = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); m.K.daily[k] = { ...(m.K.daily[k] || {}), n: 4 }; d.setDate(d.getDate() - 1); } });
  await page.goto(URL + '#/home'); await page.goto(URL + '#/progress'); await page.waitForSelector('svg[role=img]');
  ok(await page.locator('svg[role=img]').count() === 1, 'learning-curve chart is drawn');

  // locked backups: round trip, and a wrong passphrase fails
  const r = await page.evaluate(async () => {
    const s = await import('./js/store.js'); const o = { format: 'lexiko-backup', exported: 'x', kv: {}, cards: [], log: [], hello: 'world' };
    const locked = await s.lockBackup(o, 'correct horse');
    const good = await s.unlockBackup(locked, 'correct horse');
    let bad = 'no error'; try { await s.unlockBackup(locked, 'wrong one'); } catch (e) { bad = e.message; }
    return { fmt: locked.format, leaks: JSON.stringify(locked).includes('world'), back: good.hello, bad };
  });
  ok(r.fmt === 'lexiko-backup-locked' && !r.leaks && r.back === 'world' && r.bad === 'wrong', 'a locked backup hides its contents, opens with the right passphrase and refuses a wrong one');

  // noun and adjective endings chart, counted from the text; help page; settings fold
  await page.goto(URL + '#/parse'); await page.waitForSelector('button:has-text("Charts")'); await page.click('button:has-text("Charts")'); await page.click('button:has-text("Noun endings")');
  ok(await page.locator('dialog.charts .cblock').count() === 4 && await page.locator('dialog.charts .csec').count() === 2, 'noun endings: the two charts, each with first/second and third declension');
  const txt = await page.locator('dialog.charts .cbody').innerText();
  ok(/Master case endings/.test(txt) && /ος/.test(txt) && /ῳ/.test(txt) && /σι\(ν\)/.test(txt) && !/%/.test(txt), 'noun charts show the grammar’s endings');
  await page.click('dialog button:has-text("Contractions")');
  const ct = await page.locator('dialog.charts .cbody').innerText();
  ok(/Single vowels/.test(ct) && /Vowels and diphthongs/.test(ct) && await page.locator('dialog.charts td.hi').count() === 0, 'contractions chart shows both tables, nothing highlighted');
  await page.keyboard.press('Escape');
  // opening the noun chart from parse feedback highlights the case/number row in both charts
  await page.evaluate(async () => { const m = await import('./js/charts.js'); m.openCharts({ tab: 'nouns', highlight: { case: 'G', number: 'P' } }); });
  ok(await page.locator('dialog.charts tr.hi').count() === 4 && /Genitive/.test(await page.locator('dialog.charts tr.hi').first().innerText()), 'noun chart highlights the genitive plural row in each table');
  await page.keyboard.press('Escape');
  // progress milestone appears once some words are known
  await page.evaluate(async () => { const k = await import('./js/know.js'); for (let n = 1; n <= 40; n++) await k.markKnown(n); });
  await page.goto(URL + '#/progress'); await page.waitForSelector('.milestone');
  ok(/You know \d+ words?, which makes up \d+(\.\d+)?% of the New Testament text/.test(await page.textContent('.milestone')), 'progress opens with one calm milestone sentence');
  await page.keyboard.press('Escape');
  await page.goto(URL + '#/help'); await page.waitForSelector('summary:has-text("Reading")'); ok(await page.locator('details').count() >= 5, 'help page has sections');
  await page.goto(URL + '#/settings'); await page.waitForSelector('summary:has-text("Advanced")'); ok(!(await page.locator('text=Memory target').first().isVisible()), 'advanced settings start folded');
  ok(errors.length === 0, 'no console/page errors ' + errors.join('|'));
  await b.close();
  console.log(fails ? '\n' + fails + ' FAILURES' : '\nALL PASSED'); process.exit(fails ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
