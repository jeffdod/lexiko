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

  await p.evaluate(async () => { const k = await import('./js/know.js'); await k.setSetting('partsPace', 'fixed'); await k.setSetting('partsVerbsPerDay', 10); });
  // ---- automatic pace for new parts
  const pc = await p.evaluate(async () => { const k = await import('./js/know.js'); const o = {}; const S = k.K.settings; const keep = { ...S };
    S.partsPace = 'auto'; S.partsVerbsPerDay = 3; S.partsPause = false; k.K.partsAcc = []; o.base = k.partsPace().n;
    k.K.partsAcc = Array(20).fill(1); o.good = k.partsPace().n; k.K.partsAcc = Array(20).fill(0).map((_, i) => i % 2); o.weak = k.partsPace().n;
    S.partsVerbsPerDay = 1; k.K.partsAcc = Array(20).fill(1); o.capped = k.partsPace().n; S.partsVerbsPerDay = 3;
    S.partsPause = true; o.paused = k.partsPace().n; S.partsPause = false; S.partsPace = 'fixed'; S.partsVerbsPerDay = 5; o.fixed = k.partsPace().n;
    Object.assign(S, keep); k.K.partsAcc = []; return o; });
  ok(pc.base === 1 && pc.good === 2 && pc.weak === 1 && pc.capped === 1 && pc.paused === 0 && pc.fixed === 5, 'pace: 1 new verb normally, 2 when doing well, 1 when slipping, capped by the setting, paused, fixed', JSON.stringify(pc));
  // ---- per-verb stages: multiple choice until every part is right on two days, then cold; two cold misses send it back
  const vs = await p.evaluate(async () => { const k = await import('./js/know.js'); const o = {}; const n = 2064, slots = [2, 1, 3]; k.K.partsVerbs = {};
    o.start = k.verbStage(n);
    const today = k.todayKey ? k.todayKey() : null;
    for (const sl of slots) await k.noteVerbAnswer(n, sl, true, false, slots);
    o.afterOneDay = k.verbStage(n);
    for (const sl of slots) k.K.partsVerbs[n].days[sl].push('1999-01-01');
    await k.noteVerbAnswer(n, 2, true, false, slots); o.afterTwoDays = k.verbStage(n);
    await k.noteVerbAnswer(n, 2, false, true, slots); o.oneMiss = k.verbStage(n);
    await k.noteVerbAnswer(n, 2, false, true, slots); o.twoMisses = k.verbStage(n);
    k.K.partsVerbs = {}; return o; });
  ok(vs.start === 'learn' && vs.afterOneDay === 'learn' && vs.afterTwoDays === 'cold' && vs.oneMiss === 'cold' && vs.twoMisses === 'learn', 'verb goes cold only after every part is right on two days, and back after two cold misses', JSON.stringify(vs));
  // ---- verb gate: new verbs wait while 3 started verbs are unfinished
  const vg = await p.evaluate(async () => { const k = await import('./js/know.js'); const f = await import('./js/fsrs.js'); const { D } = await import('./js/data.js'); const o = {};
    const saved = new Map(k.K.cards); k.K.settings.level = null;
    const verbs = D.lex.filter((L) => L.pos === 'V').slice(0, 4).map((L) => L.n);
    o.open0 = k.verbSlots();
    for (const n of verbs.slice(0, 3)) { const c = f.review(f.newCard('w:' + n), 3, Date.now() - 864e6, 0.9); c.src = 'new'; c.state = 'review'; k.K.cards.set('w:' + n, c); }
    o.unfinished = k.unfinishedVerbs().length; o.slots = k.verbSlots();
    const next = k.nextByLevel(60).map((x) => x.n); o.verbsInNext = next.filter((n) => D.lexByN.get(n).pos === 'V').length; o.nounsInNext = next.length - o.verbsInNext;
    k.K.cards.clear(); for (const [id, c] of saved) k.K.cards.set(id, c); return o; });
  ok(vg.open0 === 3 && vg.unfinished === 3 && vg.slots === 0 && vg.verbsInNext === 0 && vg.nounsInNext > 30, 'new verbs are held back while 3 started verbs are unfinished, other words continue', JSON.stringify(vg));
  // ---- verbs you said you know: meaning only; they wait, then go first for parts and parsing
  const vq = await p.evaluate(async () => { const k = await import('./js/know.js'); const f = await import('./js/fsrs.js'); const { D } = await import('./js/data.js'); const m = await import('./js/parts.js'); const o = {};
    const saved = new Map(k.K.cards), sp = { ...k.K.partsVerbs }, sv = { ...k.K.verbParse };
    const verbs = D.lex.filter((L) => L.pos === 'V' && m.eligible().has(L.n)).slice(0, 6).map((L) => L.n);
    const mk = (n, src) => { const c = f.review(f.newCard('w:' + n), 3, Date.now() - 864e6, 0.9); c.src = src; c.state = 'review'; k.K.cards.set('w:' + n, c); };
    for (const n of verbs.slice(0, 3)) mk(n, 'new'); for (const n of verbs.slice(3, 5)) mk(n, 'manual');
    o.full = k.unfinishedVerbs().length; o.waiting = k.waitingVerbs().length; o.promotedFull = k.promotedVerbs().size;
    const n0 = verbs[0]; k.K.partsVerbs[n0] = { stage: 'cold', days: {}, miss: 0 }; k.K.verbParse[n0] = Array(20).fill(1);
    o.afterOne = k.unfinishedVerbs().length; o.promoted = k.promotedVerbs().size; o.waitingAfter = k.waitingVerbs().length;
    const first = m.planPartsSession({}).fresh.map((g) => g.n); const prom = k.promotedVerbs(); o.promotedFirst = prom.size > 0 && prom.has(first[0]);
    k.K.cards.clear(); for (const [id, c] of saved) k.K.cards.set(id, c); k.K.partsVerbs = sp; k.K.verbParse = sv; return o; });
  ok(vq.full === 3 && vq.waiting === 2 && vq.promotedFull === 0 && vq.afterOne === 3 && vq.promoted === 1 && vq.waitingAfter === 1 && vq.promotedFirst, 'verbs marked known wait for a free slot, then come first for principal parts', JSON.stringify(vq));
  // ---- tap a part to see its forms (read from the text's own forms)
  const pf = await p.evaluate(async () => { const m = await import('./js/partforms.js'); const { D } = await import('./js/data.js'); const o = {};
    const fut = m.partForms(1510, 1, D.parts.get(1510).parts[1]); const c = fut.groups[0].cell; o.fut = ['1S', '2S', '3S', '1P', '2P', '3P'].map((k) => c[k] && c[k][0][0]).join(' ');
    const all = JSON.stringify([...Array(6).keys()].map((i) => { const e = D.parts.get(3004); return e.parts[i] ? m.partForms(3004, i, e.parts[i]).groups.map((g) => g.cell) : null; }));
    o.noCapsOrGraves = !/[Α-Ω]|[̀ὰὲὴὶὸὺὼ]/.test(all.normalize('NFD').replace(/[^\u0370-\u03ff\u0300-\u036f\u1f00-\u1fff]/g, '')) || !/[ὰὲὴὶὸὺὼ]/.test(all);
    const aorPas = m.partForms(1096, 5, D.parts.get(1096).parts[5]).groups[0].cell; o.passiveOnly = !JSON.stringify(aorPas).includes('ἐγένετο');
    o.pres = m.partForms(1510, 0, 'εἰμί').groups.map((g) => g.label).join('+'); return o; });
  ok(pf.fut === 'ἔσομαι ἔσῃ ἔσται ἐσόμεθα ἔσεσθε ἔσονται' && pf.noCapsOrGraves && pf.passiveOnly && pf.pres === 'Present+Imperfect', 'tapping a part lists the forms that occur, lowercase, acutes only, imperfect under the present', JSON.stringify(pf));
  // ---- parts whose forms the text lists under another dictionary entry (the future of λέγω is under ἐρέω)
  const rel = await p.evaluate(async () => { const m = await import('./js/partforms.js'); const { D } = await import('./js/data.js'); const e = D.parts.get(3004);
    const fut = m.partForms(3004, 1, e.parts[1]), perf = m.partForms(3004, 4, e.parts[4]);
    return { fut: fut.groups.length && Object.keys(fut.groups[0].cell).length, via: fut.via.length, perfPass: perf.groups.length && !!(perf.groups[0].cell['3S']) }; });
  ok(rel.fut >= 5 && rel.via === 1 && rel.perfPass, 'the future and perfect passive of λέγω are found under the entry the text uses', JSON.stringify(rel));
  // ---- shaky words are only ones you have actually struggled with
  const sh = await p.evaluate(async () => { const k = await import('./js/know.js'); const f = await import('./js/fsrs.js'); const { D } = await import('./js/data.js'); const saved = new Map(k.K.cards);
    const ns = D.lex.slice(0, 4).map((L) => L.n); const mk = (n, grades) => { let c = f.newCard('w:' + n); let t = Date.now() - 864e6; for (const g of grades) { c = f.review(c, g, t, 0.9); t += 864e5; } k.K.cards.set('w:' + n, c); };
    mk(ns[0], [3]); mk(ns[1], [4, 3]); mk(ns[2], [1, 3]); mk(ns[3], [3, 1]);
    const ids = k.troubleCards('w:', 50).map((c) => +c.id.slice(2)); k.K.cards.clear(); for (const [id, c] of saved) k.K.cards.set(id, c);
    return { good: ids.includes(ns[0]) || ids.includes(ns[1]), again: ids.includes(ns[2]), lapsed: ids.includes(ns[3]) }; });
  ok(!sh.good && sh.again && sh.lapsed, 'weak spots list only words you have missed or struggled with, not ones you always got right', JSON.stringify(sh));
  // ---- landing + a normal session (multiple choice, both formats) answers and saves cards
  await p.goto(URL + '#/parts'); await p.waitForSelector('.start');
  await p.screenshot({ path: out + '/parts-landing.png', fullPage: true });
  const startText = await p.textContent('.start'); console.log(startText); ok(!/nothing to do/i.test(await p.textContent('#view')), 'no "nothing to do" text on the parts page');
  const snap = () => p.evaluate(async () => { const k = await import('./js/know.js'); return JSON.stringify([...k.K.cards.entries()].sort()); });
  const before = await snap();
  await p.goto(URL + '#/parts/run/mix'); await p.waitForSelector('.qcard');
  let answered = 0, seenRec = false, seenRecall = false, meets = 0;
  for (let i = 0; i < 40 && !(i >= 14 && seenRecall); i++) {
    await p.waitForSelector('.qcard', { timeout: 5000 }).catch(() => {});
    if (await p.$('button:has-text("Start learning this verb")')) { meets++; await p.click('button:has-text("Start learning this verb")'); continue; }
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
  ok(answered >= 10, 'answered parts questions', String(answered)); ok(seenRecall && meets >= 1, 'a new verb is introduced whole, then asked as multiple choice', meets + ' verbs met, recall ' + seenRecall);
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
