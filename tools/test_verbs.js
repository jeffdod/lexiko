// Verbs page, learned rule, new-verb brake, principal-parts exercise: node tools/test_verbs.js  (server must be running on :8123)
const { chromium } = require('playwright');
const out = process.env.SHOTS || '/tmp/lexiko-shots-verbs'; require('fs').mkdirSync(out, { recursive: true });
const URL = 'http://localhost:8123/lexiko/';
let fails = 0; const ok = (c, m, x = '') => { console.log((c ? '  ok  ' : '  FAIL ') + m + (x ? ' ' + x : '')); if (!c) fails++; };
process.on('unhandledRejection', (e) => { console.log('UNHANDLED', e && e.message); process.exit(1); });
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
  const sh = await p.evaluate(async () => { const k = await import('./js/know.js'); const f = await import('./js/fsrs.js'); const { D } = await import('./js/data.js'); const saved = new Map(k.K.cards);
    const ns = D.lex.slice(0, 4).map((L) => L.n); const mk = (n, grades) => { let c = f.newCard('w:' + n); let t = Date.now() - 864e6; for (const g of grades) { c = f.review(c, g, t, 0.9); t += 864e5; } k.K.cards.set('w:' + n, c); };
    mk(ns[0], [3]); mk(ns[1], [4, 3]); mk(ns[2], [1, 3]); mk(ns[3], [3, 1]);
    const ids = k.troubleCards('w:', 50).map((c) => +c.id.slice(2)); k.K.cards.clear(); for (const [id, c] of saved) k.K.cards.set(id, c);
    return { good: ids.includes(ns[0]) || ids.includes(ns[1]), again: ids.includes(ns[2]), lapsed: ids.includes(ns[3]) }; });
  ok(!sh.good && sh.again && sh.lapsed, 'weak spots list only words you have missed or struggled with, not ones you always got right', JSON.stringify(sh));
  // ---- automatic pace for new words and new forms, and the overload rule
  const np = await p.evaluate(async () => { const k = await import('./js/know.js'); const f = await import('./js/fsrs.js'); const o = {}; const S = k.K.settings, keep = { ...S }, kc = new Map(k.K.cards);
    S.wordsPace = 'auto'; S.parsePace = 'auto'; S.wordsPause = false; S.parsePause = false; S.newPerDay = 10; S.parseNewPerDay = 10; k.K.wordsAcc = []; k.K.parseAcc = [];
    o.base = [k.wordsPace().n, k.parsePace().n];
    k.K.wordsAcc = Array(20).fill(0).map((_, i) => i % 2); o.weak = k.wordsPace().n; k.K.wordsAcc = [];
    const mk = (pre, i) => { const c = f.review(f.newCard(pre + i), 3, Date.now() - 864e6, 0.9); c.due = 1; k.K.cards.set(c.id, c); };
    for (let i = 0; i < 30; i++) mk('w:9', 100 + i); o.due30 = k.wordsPace().n;                        // more than a session due
    { const { D } = await import('./js/data.js'); await import('./js/parse.js'); D.forms.filter((x) => x.an[0] && /^N-[NGDA][SP][MFN]$/.test(x.an[0].m) && x.count > 20).slice(0, 25).forEach((x) => mk(k.parseId(x), '')); } o.overload = [k.wordsPace().n, k.parsePace().n, !!k.wordsPace().overload];
    S.wordsPace = 'fixed'; o.fixed = k.wordsPace().n; S.wordsPace = 'auto'; S.wordsPause = true; o.paused = k.wordsPace().n;
    k.K.cards.clear(); for (const [id, c] of kc) k.K.cards.set(id, c); Object.assign(S, keep); return o; });
  ok(np.base[0] === 10 && np.base[1] === 10 && np.weak < 10 && np.weak >= 1 && np.due30 <= 1 && np.overload[0] === 0 && np.overload[1] === 0 && np.overload[2] && np.fixed === 10 && np.paused === 0, 'new words and forms slow when reviews pile up or accuracy slips, stop at overload, and honor Fixed and Pause', JSON.stringify(np));
  // ---- review what I just learned: words started in the last few days, not older ones
  const rw = await p.evaluate(async () => { const k = await import('./js/know.js'); const f = await import('./js/fsrs.js'); const saved = new Map(k.K.cards);
    const mk = (n, born) => { const c = f.review(f.newCard('w:' + n), 3, Date.now(), 0.9); c.src = 'new'; c.born = born; k.K.cards.set('w:' + n, c); };
    mk(9101, Date.now() - 864e5); mk(9102, Date.now() - 20 * 864e5); const r = k.recentWords(); k.K.cards.clear(); for (const [id, c] of saved) k.K.cards.set(id, c); return { r: r.includes(9101), old: r.includes(9102) }; });
  ok(rw.r && !rw.old, 'recent words include ones started yesterday and exclude ones from weeks ago', JSON.stringify(rw));
  // ---- learned rule, brake, intake
  const vr = await p.evaluate(async () => { const k = await import('./js/know.js'); const st = await import('./js/stems.js'); const { D } = await import('./js/data.js');
    const saved = new Map(k.K.cards), acc = k.K.verbAcc.slice(), va = JSON.parse(JSON.stringify(k.K.verbParse)); const o = {};
    const verbs = D.lex.filter((L) => L.pos === 'V' && L.freq >= 50 && st.requiredStems(L.n)).slice(0, 8).map((L) => L.n);
    o.status = verbs.map((n) => { const v = k.verbStatus(n); return !!v && v.total >= 2 && v.known === 0 && !v.learned; }).every(Boolean);
    const n = verbs[0], v0 = k.verbStatus(n); const f = await import('./js/fsrs.js');
    for (const s of v0.stems) for (const fm of s.forms) for (const i of fm.rows) { const fo = D.forms[i], id = 'f:' + fo.plain + ':' + n; let c = f.newCard(id); c = f.review(c, 3, Date.now() - 9e8, 0.9); c = f.review(c, 3, Date.now() - 5e8, 0.9); c.src = 'new'; k.K.cards.set(id, c); }
    k.K.verbParse[n] = Array(10).fill(1); o.learned = k.verbStatus(n).learned; k.K.verbParse[n] = [1,1,1,1,1,1,1,0,0,0]; o.notLearned = !k.verbStatus(n).learned; k.K.verbParse[n] = Array(10).fill(1);
    o.started = k.startedVerbs().includes(n);
    k.K.verbAcc = Array(20).fill(0).map((_, i) => i % 2); o.braked = k.verbBrake().braked; k.K.verbAcc = Array(20).fill(1); o.free = !k.verbBrake().braked && k.unlearnedVerbs().length <= 5;
    const mix = D.lex.filter((L) => L.freq < 5000).slice(0, 60).map((L) => L.n); const nv = (a) => a.filter((m) => D.lexByN.get(m).pos === 'V').length;
    k.K.verbAcc = Array(20).fill(1); o.quota = nv(k.admitVerbs(mix)) <= Math.floor(60 / 4) + 1;
    k.K.verbAcc = Array(20).fill(0); o.noneWhenBraked = nv(k.admitVerbs(mix)) === 0 && k.admitVerbs(mix).length === mix.length - nv(mix);
    k.K.cards.clear(); for (const [id, c] of saved) k.K.cards.set(id, c); k.K.verbAcc = acc; k.K.verbParse = va; return o; });
  ok(vr.status && vr.learned && vr.notLearned && vr.started, 'learned needs every chosen form known and 90% of the last 10 answers', JSON.stringify(vr));
  ok(vr.braked && vr.free, 'the brake comes on under 75% right and is off when answers are good', JSON.stringify(vr));
  ok(vr.quota && vr.noneWhenBraked, 'about one new verb per four other words, none while braked', JSON.stringify(vr));
  // ---- ἰδού and ἴδε are tagged as verbs but are interjections: vocabulary only
  const idou = await p.evaluate(async () => { const st = await import('./js/stems.js'), pm = await import('./js/parse-model.js'), k = await import('./js/know.js'), { D } = await import('./js/data.js');
    const rows = D.forms.filter((f) => f.an[0] && (f.an[0].s === 2400 || f.an[0].s === 2396));
    return { rows: rows.length, stems: st.requiredStems(2400) === null && st.requiredStems(2396) === null, items: rows.every((f) => pm.buildItem(f) === null), word: !!D.lexByN.get(2400), other: !!pm.buildItem(D.forms.find((f) => f.an[0] && f.an[0].m.startsWith('V-PAI') && f.an[0].s !== 2400)) }; });
  ok(idou.rows >= 4 && idou.stems && idou.items && idou.word && idou.other, 'ἰδού and ἴδε are never parsing items or verb stems, but stay vocabulary words', JSON.stringify(idou));
  // ---- old principal-part cards are purged on load
  await p.evaluate(async () => { const { store: s } = await import('./js/store.js'); await s.putCards([{ id: 'p:1:2', state: 'review', due: 1 }]); });
  await p.reload(); await p.waitForSelector('#nav a[data-tab]', { timeout: 60000 });
  ok(await p.evaluate(async () => { const k = await import('./js/know.js'); return ![...k.K.cards.keys()].some((id) => id.startsWith('p:')); }), 'old principal-part cards are gone after loading');
  // ---- pages
  for (const [u, t] of [['#/learn', /Verbs/], ['#/learn/verbs', /Verbs/], ['#/parts', /Verbs/]]) { await p.goto(URL + u); await p.reload(); await p.waitForSelector('#view h1, #view h2, #view .pagehead'); ok(t.test(await p.textContent('#view')) && !/(null|undefined)/.test(await p.textContent('#view')), u + ' shows Verbs', ''); }
  ok(!/Principal parts/.test(await (async () => { await p.goto(URL + '#/learn'); await p.reload(); await p.waitForSelector('.topics'); return p.textContent('.topics'); })()), 'Learn has no Principal parts topic');
  const n0 = await p.evaluate(async () => { const k = await import('./js/know.js'); const { D } = await import('./js/data.js'); const L = D.lex.filter((x) => x.pos === 'V' && k.verbStatus(x.n))[0]; await k.rate(L.n, 3, 'new'); return L.n; });
  await p.goto(URL + '#/learn/verbs'); await p.reload(); await p.waitForSelector('.verbrow');
  await p.screenshot({ path: out + '/verbs.png', fullPage: true });
  ok(/Practice these verbs/.test(await p.textContent('#view')) && /Nothing is scheduled/.test(await p.textContent('#view')), 'Verbs page offers both practice buttons');
  await p.goto(URL + '#/learn/verb/' + n0); await p.reload(); await p.waitForSelector('.chip');
  await p.screenshot({ path: out + '/verb.png', fullPage: true });
  const vt = await p.textContent('#view'); ok(/of its uses/.test(vt) && /Together these stems cover/.test(vt) && /Practice this verb/.test(vt) && /Practice these forms/.test(vt) && /Principal parts chart/.test(vt), 'verb page shows stems, coverage, buttons and chart');
  ok(await p.$$eval('#view .btn', (bs) => bs.every((b) => getComputedStyle(b).alignItems === 'center' && getComputedStyle(b).display.includes('flex'))), 'button text is vertically centred');
  // ---- exercise writes nothing, in both quiz styles
  for (const mode of ['choice', 'flash']) {
    await p.evaluate(async (m) => { const k = await import('./js/know.js'); await k.setSetting('mode', m); }, mode);
    const before = await p.evaluate(async () => { const k = await import('./js/know.js'); return JSON.stringify([[...k.K.cards.entries()], k.K.verbAcc, k.K.verbParse]); });
    await p.goto(URL + '#/parts/exercise/' + n0); await p.reload(); await p.waitForSelector('.qcard');
    ok(/Extra practice/.test(await p.textContent('#view')), mode + ': exercise is labelled extra practice');
    for (let i = 0; i < 3; i++) {
      if (mode === 'choice') { await p.click('.opt >> nth=0'); } else { await p.click('text=Show answer'); }
      await p.click(mode === 'choice' ? 'text=Continue' : 'text=Got it');
      if (!(await p.$('.qcard'))) break;
    }
    const after = await p.evaluate(async () => { const k = await import('./js/know.js'); return JSON.stringify([[...k.K.cards.entries()], k.K.verbAcc, k.K.verbParse]); });
    ok(before === after, mode + ': the exercise changed no cards or counters');
  }
  await p.goto(URL + '#/parse/run/verbs'); await p.reload(); await p.waitForTimeout(800);
  ok(!/(null|undefined)/.test(await p.textContent('#view')), 'practicing verb forms opens without errors');
  for (const u of ['#/learn', '#/learn/words', '#/parse', '#/home', '#/progress']) { await p.goto(URL + u); await p.reload(); await p.waitForSelector('#view *'); ok(!/(null|undefined)/.test(await p.textContent('#view')), u + ' has no stray null/undefined'); }
  ok(errs.length === 0, 'no console/page errors', errs.slice(0, 3).join(' | '));
  await b.close(); console.log(fails ? fails + ' FAILED' : 'ALL OK'); process.exit(fails ? 1 : 0);
})();
