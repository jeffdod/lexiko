// Principal parts + extra practice + charts: node tools/test_parts.js  (server must be running on :8123)
const { chromium } = require('playwright');
const out = process.env.SHOTS || '/tmp/lexiko-shots-parts'; require('fs').mkdirSync(out, { recursive: true });
const URL = 'http://localhost:8123/lexiko/';
let fails = 0; const ok = (c, m, x = '') => { console.log((c ? '  ok  ' : '  FAIL ') + m + (x ? ' ' + x : '')); if (!c) fails++; };
process.on('unhandledRejection', () => {});
(async () => {
  const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, colorScheme: 'dark' });
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', (e) => errs.push(e.message)); p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
  await p.goto(URL); await p.waitForSelector('#nav a[data-tab]', { timeout: 60000 });
  await p.evaluate(async () => { const k = await import('./js/know.js'); await k.setLevel(100); await k.setSetting('levelAsked', true); });

  // ---- data + option generators
  const r = await p.evaluate(async () => {
    const parts = await import('./js/parts.js'), { D } = await import('./js/data.js'), charts = await import('./js/charts.js');
    const el = [...parts.eligible().values()]; let bad = 0, short = 0, verbBad = 0, n = 0;
    for (let i = 0; i < el.length; i += 7) { const e = el[i]; for (let s = 1; s < 6; s++) if (e.parts[s]) { n++;
      const o = parts.recallOptions(e, s); if (new Set(o).size !== o.length || !o.includes(e.parts[s])) bad++; if (o.length < 4) short++; }
      const v = parts.verbOptions(e); if (v.length !== 4 || new Set(v.map((x) => x.n)).size !== 4 || !v.some((x) => x.n === e.n)) verbBad++; }
    const rows = { 'ἐλύθην': charts.chartRowFor(5, 'ἐλύθην'), 'ἐγράφην': charts.chartRowFor(5, 'ἐγράφην'), 'ἔλυσα': charts.chartRowFor(2, 'ἔλυσα'), 'ἔμεινα': charts.chartRowFor(2, 'ἔμεινα'), 'ἔβαλον': charts.chartRowFor(2, 'ἔβαλον'), 'ἐγενόμην': charts.chartRowFor(2, 'ἐγενόμην'), 'λέλυκα': charts.chartRowFor(3, 'λέλυκα'), 'γέγονα': charts.chartRowFor(3, 'γέγονα'), 'μενῶ': charts.chartRowFor(1, 'μενῶ'), 'λύσω': charts.chartRowFor(1, 'λύσω'), 'λύσομαι': charts.chartRowFor(1, 'λύσομαι') };
    return { total: D.parts.size, eligible: el.length, n, bad, short, verbBad, rows };
  });
  console.log(JSON.stringify(r));
  ok(r.total > 1700 && r.eligible > 1000, 'parts data loaded', r.total + '/' + r.eligible);
  ok(r.bad === 0 && r.verbBad === 0, 'answer choices unique and contain the right answer');
  ok(r.short < r.n * 0.02, 'nearly always four form choices', r.short + ' of ' + r.n + ' short');
  ok(r.rows['ἐλύθην'] === 'aor1-pas' && r.rows['ἐγράφην'] === 'aor2-pas' && r.rows['ἔλυσα'] === 'aor1-act' && r.rows['ἔμεινα'] === 'aor-liq-act' && r.rows['ἔβαλον'] === 'aor2-act' && r.rows['ἐγενόμην'] === 'aor2-mid' && r.rows['λέλυκα'] === 'perf1-act' && r.rows['γέγονα'] === 'perf2-act' && r.rows['μενῶ'] === 'fut-liq-act' && r.rows['λύσω'] === 'fut-act', 'chart rows picked correctly');

  // ---- landing + a normal session (multiple choice, both formats) answers and saves cards
  await p.goto(URL + '#/parts'); await p.waitForSelector('.start');
  await p.screenshot({ path: out + '/parts-landing.png', fullPage: true });
  const startText = await p.textContent('.start'); console.log(startText); ok(!/nothing to do/i.test(await p.textContent('#view')), 'no "nothing to do" text on the parts page');
  const snap = () => p.evaluate(async () => { const k = await import('./js/know.js'); return JSON.stringify([...k.K.cards.entries()].sort()); });
  const before = await snap();
  await p.goto(URL + '#/parts/run/mix'); await p.waitForSelector('.qcard');
  let answered = 0, seenRec = false, seenRecall = false;
  for (let i = 0; i < 40 && !(i >= 14 && seenRec && seenRecall); i++) {
    await p.waitForSelector('.qcard', { timeout: 5000 }).catch(() => {});
    if (await p.$('h1:has-text("Session complete")')) break;
    const isRec = await p.$('.qcard .qmeta:has-text("Which verb")');
    if (isRec) { seenRec = true; await p.click('.opts:not(.two) .opt >> nth=0'); await p.waitForTimeout(250); await p.click('.opts.two .opt >> nth=1'); }
    else if (await p.$('.qask') && await p.$('.opts .opt')) { seenRecall = true; await p.click('.opts .opt >> nth=0'); }
    else if (await p.$('button:has-text("Show answer")')) { await p.click('button:has-text("Show answer")'); await p.click('.grades .g3'); answered++; await p.waitForTimeout(300); continue; }
    else break;
    if (i === 1) await p.screenshot({ path: out + '/parts-feedback.png', fullPage: true });
    try { await p.click('.qwrap button.btn.primary.block', { timeout: 4000 }); } catch (e) { console.log('NO CONTINUE', isRec ? 'rec' : 'recall', errs.join(' | ')); console.log((await p.evaluate(() => document.querySelector('.qwrap').innerText)).slice(0, 600)); await p.screenshot({ path: out + '/stuck.png', fullPage: true }); process.exit(1); }
    answered++; await p.waitForTimeout(300);
  }
  const mid = await snap();
  ok(answered >= 10, 'answered parts questions', String(answered)); ok(seenRec && seenRecall, 'both question formats appeared', seenRec + '/' + seenRecall);
  ok(mid !== before && mid.includes('"p:'), 'principal-part cards were created');
  // charts
  await p.goto(URL + '#/parts'); await p.click('button:has-text("Charts")'); await p.waitForSelector('dialog.charts[open] table');
  await p.screenshot({ path: out + '/charts-master.png' });
  await p.click('dialog.charts button:has-text("Personal endings")'); await p.waitForSelector('dialog.charts h3:has-text("Primary endings")'); await p.screenshot({ path: out + '/charts-endings.png' });
  ok(await p.$$eval('dialog.charts tbody tr', (r) => r.length) > 10, 'charts render'); await p.click('dialog.charts button[aria-label="Close charts"]'); await p.waitForTimeout(300); ok(!(await p.$('dialog.charts')), 'charts close');

  // ---- extra practice never writes (seed some studied words and forms first so there are trouble spots)
  await p.evaluate(async () => { const k = await import('./js/know.js'), { D } = await import('./js/data.js'); for (const L of D.lex.slice(0, 20)) await k.rate(L.n, 1, 'new'); for (const f of D.forms.slice(0, 40)) await k.rateParse(k.parseId(f), 1); });
  const stateBefore = await snap();
  for (const url of ['#/parts/run/extra/trouble', '#/parts/run/extra/preview', '#/learn/practice/trouble', '#/learn/practice/preview', '#/parse/run/extra/trouble', '#/parse/run/extra/preview']) {
    await p.goto(URL + url); await p.waitForTimeout(600);
    const has = await p.$('.qcard'); let n = 0;
    for (let i = 0; i < 40 && (await p.$('.qcard')); i++) {
      if (await p.$('button:has-text("Show answer")')) { await p.click('button:has-text("Show answer")'); await p.click('.grades button >> nth=-1'); n++; await p.waitForTimeout(250); continue; }
      const cont = await p.$('.qwrap button.btn.primary.block');
      if (cont && !(await p.$('.pgrid .popt:not([disabled])'))) { await cont.click(); n++; await p.waitForTimeout(250); continue; }
      if (await p.$('.opts.two:not([hidden]) .opt:not([disabled])')) { await p.click('.opts.two .opt:not([disabled]) >> nth=0'); await p.waitForTimeout(150); continue; }
      if (await p.$('.opts:not(.two) .opt:not([disabled])')) { await p.click('.opts:not(.two) .opt:not([disabled]) >> nth=0'); await p.waitForTimeout(150); continue; }
      if (await p.$('.pgrid .popt:not([disabled])')) { await p.click('.pgrid .popt:not([disabled]) >> nth=0'); await p.waitForTimeout(450); continue; }
      if (await p.$('.srows')) { await p.click('button:has-text("I don’t know")'); await p.waitForTimeout(200); continue; }
      await p.waitForTimeout(200);
    }
    console.log('   ', url, 'questions shown:', has ? 'yes' : 'none (empty message)', 'answered', n);
    if (url.includes('practice') || url.includes('extra')) { if (has) await p.screenshot({ path: out + '/' + url.replace(/[#/]/g, '_') + '.png' }); }
  }
  const stateAfter = await snap();
  ok(stateBefore === stateAfter, 'extra practice left every card and counter unchanged');
  await p.goto(URL + '#/learn'); await p.waitForSelector('.start'); await p.screenshot({ path: out + '/learn.png', fullPage: true });
  for (const u of ['#/learn', '#/learn/words', '#/parse', '#/parts', '#/home']) { await p.goto(URL + u); await p.waitForSelector('.start'); ok(!/nothing (to do|is due)/i.test(await p.textContent('#view')), 'no dead-end wording on ' + u); }
  ok(errs.length === 0, 'no console/page errors', errs.slice(0, 3).join(' | '));
  await b.close(); console.log(fails ? 'FAILED ' + fails : 'ALL PASSED'); process.exit(fails ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
