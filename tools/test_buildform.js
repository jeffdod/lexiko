// Build the form: forms are taken apart only when they add up exactly; practice only.
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(), p = await b.newPage({ viewport: { width: 390, height: 860 } }); const errs = [];
  p.on('pageerror', (e) => errs.push(String(e)));
  const ok = (c, m) => { if (!c) { console.log('FAIL: ' + m); process.exitCode = 1; } };
  await p.goto('http://localhost:8123/lexiko/#/parse'); await p.waitForTimeout(1800);
  await p.evaluate(async () => { const K = await import('/lexiko/js/know.js'), F = await import('/lexiko/js/families.js'); K.K.settings.level = 0; K.K.settings.gates = K.allGatesOpen(); });
  await p.goto('http://localhost:8123/lexiko/#/parse/form'); await p.waitForTimeout(800);
  ok(await p.locator('a[href="#/parse/run/build/known"]').count() === 1, 'Practice by form page links to Build the form');
  const d = await p.evaluate(async () => { const B = await import('/lexiko/js/buildform.js'), { D } = await import('/lexiko/js/data.js');
    const at = (w) => D.forms.findIndex((f) => f.w.replace(/­/g, '') === w), sp = (w, row) => { const i = at(w); if (i < 0) return 'missing'; const x = B.decompose(i, row); return x ? [x.A, x.S, x.F, x.E, x.cell].join('|') : null; };
    return { a: sp('ἐπίστευσαν', 'aor1-act'), b: sp('ἔλαβον', 'aor2-act'), c: sp('πιστεύσει', 'fut-act'), d: sp('ἐπιστεύσαμεν', 'aor1-act'), e: sp('πιστεύει', 'pres-act'), f: sp('ἐπιστεύετε', 'impf-act'),
      contract: sp('ἠγάπησεν', 'aor1-act'), compound: sp('προσεκύνει', 'impf-act'), compound2: sp('ἐκβάλλει', 'pres-act'), mi: sp('ἔδωκεν', 'aor1-act'), vowel: sp('ἦλθον', 'aor2-act'), wrongrow: sp('πιστεύει', 'impf-act') }; });
  ok(d.a === 'ε|πιστευ|σ|αν|3P', 'ἐπίστευσαν: ' + d.a); ok(d.b === 'ε|λαβ||ον|3P' || d.b === 'ε|λαβ||ον|1S', 'ἔλαβον: ' + d.b); ok(d.c === '|πιστευ|σ|ει|3S', 'πιστεύσει: ' + d.c);
  ok(d.d === 'ε|πιστευ|σ|αμεν|1P', 'ἐπιστεύσαμεν: ' + d.d); ok(d.e === '|πιστευ||ει|3S', 'πιστεύει: ' + d.e); ok(d.f === 'ε|πιστευ||ετε|2P', 'ἐπιστεύετε: ' + d.f);
  ok(d.compound === 'ε|κυνε||ε(ν)|3S' && d.compound2 === '|βαλλ||ει|3S' && d.mi === 'ε|δω|κ|ε(ν)|3S' && d.wrongrow === null, 'compound verbs are built without their prefix; -μι verbs use their printed stems; wrong-row forms are left out: ' + JSON.stringify(d));
  const cpd = await p.evaluate(async () => { const B = await import('/lexiko/js/buildform.js'), { D } = await import('/lexiko/js/data.js'); const f = (w, row) => { const i = D.forms.findIndex((x) => x.w.replace(/­/g, '') === w); const x = i < 0 ? 'missing' : B.decompose(i, row); return x ? (x.prefix ? x.prefix.shown : '-') + '|' + x.A + '|' + x.S + '|' + x.word : null; };
    return { a: f('ἐκβάλλει', 'pres-act'), b: f('ἀπέστειλεν', 'aor-liq-act'), c: f('ἐξῆλθεν', 'aor2-act'), d: f('καθαρίζει', 'pres-act'), e: f('ἐγείρει', 'pres-act') }; });
  ok(cpd.a === 'εκ||βαλλ|ἐκβάλλει' && cpd.b === 'απ|ε|στειλ|ἀπέστειλεν' && cpd.c === 'εξ||ελθ|ἐξῆλθεν' && cpd.e === '-||εγειρ|ἐγείρει' && cpd.d === null, 'compound verbs: ' + JSON.stringify(cpd));
  const mi = await p.evaluate(async () => { const B = await import('/lexiko/js/buildform.js'), P = await import('/lexiko/js/parse.js'), { D } = await import('/lexiko/js/data.js'); const f = (w, row) => { const i = D.forms.findIndex((x) => x.w.replace(/­/g, '') === w); const x = i < 0 ? 'missing' : B.decompose(i, row); return x ? (x.prefix ? x.prefix.shown + '+' : '') + [x.A, x.S, x.F, x.E].join('|') : null; };
    let n = 0; for (const row of ['fut-act', 'fut-mid', 'fut-pas1', 'aor1-act', 'perf1-act', 'perf-mp', 'aor1-pas']) for (const id of P.rowPool(row, { ignoreLevel: true, anyVerb: true })) if (/μι$/.test(D.lexByN.get(D.forms[id].an[0].s).head.normalize('NFD').replace(/[\u0300-\u036f]/g, '')) && B.decompose(id, row)) n++;
    return { n, a: f('θήσω', 'fut-act'), b: f('παρέδωκεν', 'aor1-act'), c: f('ἔδωκας', 'aor1-act'), d: f('ἀφῆκεν', 'aor1-act') }; });
  ok(mi.n > 60 && mi.a === '|θη|σ|ω' && mi.b === 'παρ+ε|δω|κ|ε(ν)' && mi.c === 'ε|δω|κ|ασ' && mi.d === null, '-μι verbs: ' + JSON.stringify(mi));
  // the chart's own pieces: formative κα / σα / θη, connecting vowel only on thematic rows, personal ending
  const cp = await p.evaluate(async () => { const B = await import('/lexiko/js/buildform.js'), { D } = await import('/lexiko/js/data.js');
    const at = (w) => D.forms.findIndex((f) => f.w.replace(/­/g, '') === w), cp = (w, row) => { const i = at(w); if (i < 0) return 'missing'; const x = B.decompose(i, row); if (!x) return null; const c = B.chartPieces(x); return [c.F, c.V, c.PE, c.changes].join('|'); };
    return { perf: cp('πεπιστεύκατε', 'perf1-act'), aor: cp('ἐπιστεύσαμεν', 'aor1-act'), aor3: cp('ἐπίστευσεν', 'aor1-act'), pres3p: cp('πιστεύουσιν', 'pres-act'), pres: cp('πιστεύει', 'pres-act') }; });
  ok(d.d && cp.perf === 'κα||τε|false', 'πεπιστεύκατε: κα + τε, ' + cp.perf); ok(cp.aor === 'σα||μεν|false', 'ἐπιστεύσαμεν: σα + μεν, ' + cp.aor);
  ok(cp.aor3 === 'σα||–|true', 'ἐπίστευσεν: σα written σε, ' + cp.aor3); ok(cp.pres3p === '|ο|νσι(ν)|true', 'πιστεύουσιν: ο + νσι(ν) runs together, ' + cp.pres3p); ok(cp.pres === '|ε|ι|false', 'πιστεύει: ε + ι, ' + cp.pres);
  // contract verbs: the present and imperfect contract; elsewhere the stem vowel lengthens (or stays); irregular and vowel-initial ones are left out
  const cv = await p.evaluate(async () => { const B = await import('/lexiko/js/buildform.js'), { D } = await import('/lexiko/js/data.js');
    const at = (w) => D.forms.findIndex((f) => f.w.replace(/­/g, '') === w), sp = (w, row) => { const i = at(w); if (i < 0) return 'missing'; const x = B.decompose(i, row); return x ? [x.A, x.S, x.contract ? x.contract.k + '+' + x.contract.init + '=' + x.contract.res : x.F, x.E].join('|') : null; };
    return { a: sp('ποιεῖ', 'pres-act'), b: sp('ποιοῦσιν', 'pres-act'), c: sp('ἐποίησεν', 'aor1-act'), d: sp('ἐκάλεσεν', 'aor1-act'), e: sp('ἐπληρώθη', 'aor1-pas'), f: sp('ἐκλήθη', 'aor1-pas'), g: sp('ἀγαπᾷ', 'pres-act'), h: sp('ἐποίει', 'impf-act'), i: sp('πεπλήρωκεν', 'perf1-act'), j: sp('ἠγάπησεν', 'aor1-act') }; });
  ok(cv.a === '|ποιε|ε+ει=ει|ει', 'ποιεῖ contracts: ' + cv.a); ok(cv.b === '|ποιε|ε+ου=ου|ουσι(ν)', 'ποιοῦσιν: ' + cv.b); ok(cv.c === 'ε|ποιη|σ|ε(ν)'.replace('ε(ν)', cv.c.split('|')[3]) && cv.c.startsWith('ε|ποιη|σ|'), 'ἐποίησεν has the lengthened stem: ' + cv.c);
  ok(cv.d && cv.d.startsWith('ε|καλε|σ|'), 'ἐκάλεσεν keeps the short stem: ' + cv.d); ok(cv.e && cv.e.startsWith('ε|πληρω|θ|'), 'ἐπληρώθη: ' + cv.e); ok(cv.f === null, 'ἐκλήθη (irregular stem) is left out: ' + cv.f);
  ok(cv.g && cv.g.startsWith('|αγαπα|α+ει=ᾳ'), 'ἀγαπᾷ (vowel-initial, no augment): ' + cv.g); ok(cv.h && cv.h.startsWith('ε|ποιε|ε+ε=ει'), 'ἐποίει: ' + cv.h); ok(cv.i && cv.i.startsWith('πε|πληρω|κ|'), 'πεπλήρωκεν: ' + cv.i); ok(cv.j && cv.j.startsWith('|αγαπη|σ|'), 'ἠγάπησεν: ' + cv.j);
  // vowel-initial verbs: the first vowel lengthens (the stem is shown without the augment); second aorists and long vowels are left out
  const av = await p.evaluate(async () => { const B = await import('/lexiko/js/buildform.js'), { D } = await import('/lexiko/js/data.js');
    const at = (w) => D.forms.findIndex((f) => f.w.replace(/­/g, '') === w), sp = (w, row) => { const i = at(w); if (i < 0) return 'missing'; const x = B.decompose(i, row); return x ? (x.aug ? x.aug.from + '>' + x.aug.to : '-') + ' ' + x.S : null; };
    return { a: sp('ἠγάπησεν', 'aor1-act'), b: sp('ἤκουσεν', 'aor1-act'), c: sp('εἶχον', 'impf-act'), d: sp('ἤρχοντο', 'impf-mp'), e: sp('ἦλθον', 'aor2-act'), f: sp('ἠγάπων', 'impf-act'), g: sp('ᾐτήσατο', 'aor1-mid'), i: sp('ἤγαγον', 'aor2-act'), h: sp('ἤλπισεν', 'aor1-act') }; });
  ok(av.a === 'α>η αγαπη', 'ἠγάπησεν: ' + av.a); ok(av.b === 'α>η ακου', 'ἤκουσεν: ' + av.b); ok(av.c === 'missing' || av.c === 'ε>ει εχ', 'εἶχον: ' + av.c); ok(av.d === 'missing' || av.d === 'ε>η ερχ', 'ἤρχοντο: ' + av.d);
  ok(av.e === 'missing' || av.e === 'ε>η ελθ', 'ἦλθον: the stem from the printed part: ' + av.e); ok(av.i === 'missing' || av.i === 'α>η αγαγ', 'ἤγαγον: ' + av.i); ok(av.f === 'missing' || av.f === 'α>η αγαπα', 'ἠγάπων: ' + av.f); ok(av.g === 'missing' || av.g === 'αι>ῃ αιτη', 'ᾐτήσατο: ' + av.g); ok(av.h === 'missing' || av.h === null, 'ἤλπισεν (dental stem) stays out: ' + av.h);
  // the other moods: subjunctive, imperative, infinitive (no front; plain splits only), gated like the indicative
  const mo = await p.evaluate(async () => { const B = await import('/lexiko/js/buildform.js'), P = await import('/lexiko/js/parse.js'), { D } = await import('/lexiko/js/data.js');
    const sk = (s) => s.replace(/­/g, '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/ς/g, 'σ'); const out = {};
    for (const m of ['sub', 'imp', 'inf']) { let ok = 0, bad = 0, con = 0, snd = 0; const keys = new Set();
      for (const x of P.moodPool(m, { anyVerb: true })) { const d = B.decomposeMood(m, x); if (!d) continue; ok++; keys.add(x.key); const w = sk(d.word); const pf = d.prefix ? d.prefix.shown : ''; let a = pf + d.real.replace('(ν)', ''), b2 = pf + d.real.replace('(ν)', 'ν'); if (d.sound) snd++; if (d.contract) { a = pf + d.contract.head + sk(d.contract.res) + d.contract.rest.replace('(ν)', ''); b2 = pf + d.contract.head + sk(d.contract.res) + d.contract.rest.replace('(ν)', 'ν'); con++; } if (sk(a) !== w && sk(b2) !== w) bad++; }
      out[m] = { ok, bad, con, snd, kinds: keys.size }; }
    return out; });
  ok(mo.sub.ok > 100 && mo.imp.ok > 80 && mo.inf.ok > 80 && mo.sub.bad + mo.imp.bad + mo.inf.bad === 0 && mo.sub.kinds >= 6 && mo.inf.kinds >= 6 && mo.sub.con > 10 && mo.imp.con > 10 && mo.inf.con > 10 && mo.sub.snd + mo.imp.snd + mo.inf.snd > 40, 'moods add up: ' + JSON.stringify(mo));
  const gated = await p.evaluate(async () => { const K = await import('/lexiko/js/know.js'), P = await import('/lexiko/js/parse.js'); const was = K.K.settings.gates; K.K.settings.gates = { verbs: true }; const n = P.moodPool('sub', { anyVerb: true }).length + P.moodPool('imp', { anyVerb: true }).length + P.moodPool('inf', { anyVerb: true }).length; K.K.settings.gates = was; return n; });
  ok(gated === 0, 'moods wait for their level: ' + gated);
  // participles: stem · formative · ending (marker + case ending); perfects also show the reduplication
  const pt = await p.evaluate(async () => { const B = await import('/lexiko/js/buildform.js'), P = await import('/lexiko/js/parse.js'), K = await import('/lexiko/js/know.js');
    const sk = (s) => s.replace(/­/g, '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/ς/g, 'σ'); const out = { ok: 0, bad: 0, red: 0, snd: 0, aug: 0, con: 0, liq: 0, pre: 0, ps: 0, keys: new Set() };
    for (const x of P.ptcPool({ anyVerb: true })) { const d = B.decomposePtc(x); if (!d) continue; out.ok++; out.keys.add(d.key); if (d.A) out.red++; if (d.sound) out.snd++; if (d.aug) out.aug++;
      const core = d.sound ? d.sound.joined + (d.F + d.E).slice(1) : d.S + d.F + d.E; const pf = d.prefix ? d.prefix.shown : ''; if (d.prefix) out.pre++; if (d.contract) { out.con++; if (sk(pf + d.contract.head + d.contract.res + d.contract.rest) !== sk(d.word)) out.bad++; } else if (d.perfSound) { if (!d.aug && sk(pf + d.A + d.perfSound.joined) !== sk(d.word)) out.bad++; out.ps++; } else if (!d.aug && sk(pf + d.A + core) !== sk(d.word)) out.bad++; if (d.liquid) out.liq++; }
    const was = K.K.settings.gates; K.K.settings.gates = { verbs: true }; const gated = P.ptcPool({ anyVerb: true }).length; K.K.settings.gates = was;
    return { ok: out.ok, bad: out.bad, red: out.red, snd: out.snd, keys: out.keys.size, aug: out.aug, con: out.con, liq: out.liq, pre: out.pre, ps: out.ps, gated }; });
  ok(pt.ok > 100 && pt.bad === 0 && pt.keys >= 8 && pt.con > 200 && pt.liq > 3 && pt.pre > 200 && pt.ps > 30 && pt.red > 2 && pt.snd > 5 && pt.gated === 0, 'participles add up: ' + JSON.stringify(pt));
  // liquid verbs: the future and aorist have no σ; the stem is the verb's printed one (μένω: ἔμεινα, μενῶ); φθάνω and ἁμαρτάνω keep a σ and are left out
  const lq = await p.evaluate(async () => { const B = await import('/lexiko/js/buildform.js'), P = await import('/lexiko/js/parse.js'), { D } = await import('/lexiko/js/data.js');
    const at = (w) => D.forms.findIndex((f) => f.w.replace(/­/g, '') === w), sp = (w, row) => { const i = at(w); if (i < 0) return 'missing'; const x = B.decompose(i, row); return x ? [x.A, x.S, x.F, x.E].join('|') : null; };
    const n = {}; for (const row of ['aor-liq-act', 'fut-liq-act', 'fut-liq-mid']) { n[row] = 0; for (const id of P.rowPool(row, { ignoreLevel: true, anyVerb: true })) if (B.decompose(id, row)) n[row]++; }
    return { n, a: sp('ἔμεινεν', 'aor-liq-act'), b: sp('ἔσπειρεν', 'aor-liq-act'), c: sp('κρινεῖ', 'fut-liq-act'), d: sp('κρινῶ', 'fut-liq-act'), e: sp('ἔφθασεν', 'aor-liq-act'), g: sp('ἤγειραν', 'aor-liq-act') }; });
  ok(lq.a === 'ε|μειν||ε(ν)' && lq.b === 'ε|σπειρ||ε(ν)' && lq.c === '|κριν||ει' && lq.d === '|κριν||ω' && lq.e === null && lq.g === '|εγειρ||αν' && lq.n['aor-liq-act'] > 15 && lq.n['fut-liq-act'] > 8, 'liquid verbs: ' + JSON.stringify(lq));
  // a contract participle, a liquid aorist and a perfect participle walk through every step to "Built:" (forced queues, no random picking)
  for (const spec of [{ w: 'ποιοῦντες' }, { w: 'ἔμειναν', row: 'aor-liq-act' }, { w: 'λελυμένον' }, { w: 'ἔγραψα', row: 'aor1-act' }, { w: 'ἤκουσαν', row: 'aor1-act' }]) {
    const found = await p.evaluate(async (spec) => { const B = await import('/lexiko/js/buildform.js'), P = await import('/lexiko/js/parse.js'), { D } = await import('/lexiko/js/data.js'); let d = null;
      if (spec.row) { for (const id of P.rowPool(spec.row, { ignoreLevel: true, anyVerb: true })) if (D.forms[id].w.replace(/­/g, '') === spec.w) d = B.decompose(id, spec.row); } else for (const x of P.ptcPool({ anyVerb: true })) if (x.w === spec.w) { d = B.decomposePtc(x); if (d) break; }
      if (d) B.renderBuild(document.querySelector('#view'), 'any', [d]); return !!d; }, spec);
    ok(found, 'forced form is buildable: ' + spec.w); if (!found) continue;
    let reached = false; for (let st = 0; st < 8 && !reached; st++) { await p.waitForTimeout(250); if (/Built:/.test(await p.locator('#view').innerText())) { reached = true; break; }
      await p.waitForFunction(() => document.querySelector('#view .opts'), null, { timeout: 4000 }).catch(() => {}); await p.locator('.opt').first().click(); await p.waitForTimeout(1450); const c = p.getByRole('button', { name: 'Continue' }); if (await c.count()) { await c.click(); await p.waitForTimeout(200); } }
    ok(reached || /Built:/.test(await p.locator('#view').innerText()), 'steps run through to Built for ' + spec.w);
  }
  // every form that is offered adds up, and every offered row/cell is consistent
  const all = await p.evaluate(async () => { const B = await import('/lexiko/js/buildform.js'), P = await import('/lexiko/js/parse.js'), { D } = await import('/lexiko/js/data.js'); let n = 0, bad = 0, con = 0, aug = 0, snd = 0, ps = 0; const pairs = new Set(); const rows = new Set();
    const sk = (s) => s.replace(/­/g, '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/ς/g, 'σ');
    for (const row of B.BUILD_ROWS) for (const id of P.rowPool(row, { ignoreLevel: true, anyVerb: true })) { const x = B.decompose(id, row); if (!x) continue; n++; rows.add(row); const core = x.sound ? x.sound.joined : x.S + x.F; const pre = x.prefix ? x.prefix.shown : '', lead = pre + (x.aug ? sk(x.aug.to) + core.slice(x.aug.from.length, x.contract ? -1 : undefined) : x.contract ? x.A + x.contract.head : x.A + core); const want = x.perfSound ? pre + (x.aug ? sk(x.aug.to) + x.perfSound.joined.slice(x.aug.from.length) : x.A + x.perfSound.joined) : x.contract ? lead + sk(x.contract.res) + x.contract.rest : lead + x.used; if (x.perfSound) ps++; if (x.sound) snd++; if (x.aug) { aug++; pairs.add(x.aug.from + '>' + x.aug.to); } if (sk(D.forms[id].w) !== want) { bad++; (globalThis.__bad = globalThis.__bad || []).push(D.forms[id].w + ' ' + row); } if (x.contract) con++; }
    return { ps, snd, n, bad, badlist: (globalThis.__bad || []).slice(0, 5), rows: rows.size, con, aug, pairs: [...pairs].sort().join(' ') }; });
  ok(all.n > 800 && all.ps >= 10 && all.bad === 0 && all.rows >= 14 && all.con > 100 && all.aug > 100 && ['α>η', 'ε>η', 'ο>ω', 'αι>ῃ'].every((x) => all.pairs.includes(x)), 'all offered forms add up exactly: ' + JSON.stringify(all));
  // the word built in place: after the last step the word so far is exactly the word, and a Sound step is offered where the pieces side by side are not
  const inplace = await p.evaluate(async () => { const B = await import('/lexiko/js/buildform.js'), P = await import('/lexiko/js/parse.js'); const sk = (s) => s.replace(/­/g, '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/ς/g, 'σ').normalize('NFC'); const out = { n: 0, bad: [], sound: 0, order: 0 };
    const rank = { Stem: 0, Front: 1, 'Front (lengthening)': 1, Prefix: 2, 'Tense formative': 3, 'Connecting vowel': 4, 'Personal ending': 5, Ending: 5, 'Sound change': 6, Contraction: 7 };
    const run = (d) => { const s = d.mood ? B.moodSteps(d) : B.indicSteps(d); out.n++; let st = ''; for (const e of s.seq) st = e[5](st); const T = sk(d.word); if (!(st === T || st + 'ν' === T || st === T + 'ν')) out.bad.push(d.word + ' ' + st); if (s.seq.some((e) => e[0] === 'Sound change')) out.sound++; if (s.seq.every((e, k) => k === 0 ? e[0] === 'Stem' : rank[e[0]] > rank[s.seq[k - 1][0]])) out.order++;
      const sc = s.seq.find((e) => e[0] === 'Sound change'); if (sc && (sc[1].length < 3 || !sc[1].some((o) => o[0] === sc[2]))) out.bad.push('options ' + d.word); };
    for (const row of B.BUILD_ROWS) for (const id of P.rowPool(row, { ignoreLevel: true, anyVerb: true })) { const d = B.decompose(id, row); if (d) run(d); }
    for (const m of ['sub', 'imp', 'inf']) for (const x of P.moodPool(m, { anyVerb: true })) { const d = B.decomposeMood(m, x); if (d) run(d); }
    for (const x of P.ptcPool({ anyVerb: true })) { const d = B.decomposePtc(x); if (d) run(d); }
    return out; });
  ok(inplace.n > 2000 && inplace.bad.length === 0 && inplace.sound > 300 && inplace.order === inplace.n, 'the word is built in place for every form: ' + JSON.stringify(inplace).slice(0, 400));
  // the model paradigms: the table reproduces the six forms of λύω in each of its rows
  const para = await p.evaluate(async () => { const B = await import('/lexiko/js/buildform.js'), PD = await import('/lexiko/js/paradigms.js'); const sk = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/ς/g, 'σ'); const bad = [];
    for (const row of B.BUILD_ROWS) { const pr = PD.paradigm(row); if (!pr || pr.head !== 'λύω') continue; const T = B.BUILD[row];
      pr.cells.forEach((c, i) => { const w = sk(c.word).replace('(ν)', ''); const A = T.A === 'ε' ? 'ε' : T.A === 'RED' ? 'λε' : ''; const need = A + 'λυ' + T.F; const ends = T.E[i].includes('(ν)') ? [T.E[i].replace('(ν)', ''), T.E[i].replace('(ν)', 'ν')] : [T.E[i]]; if (!ends.some((e) => w === need + e)) bad.push(row + ' ' + c.cell + ' ' + w + ' vs ' + need + T.E[i]); }); }
    return bad; });
  ok(para.length === 0, 'the table matches λύω: ' + para.join('; '));
  // the session
  const before = await p.evaluate(async () => (await import('/lexiko/js/know.js')).K.cards.size);
  await p.evaluate(() => { location.hash = '#/parse/run/build/any'; }); await p.waitForTimeout(900);
  let questions = 0;
  for (let i = 0; i < 12; i++) {
    let text = await p.locator('#view').innerText(); if (/Practice complete/.test(text)) break; questions++;
    const seen = [];
    for (let s = 0; s < 6; s++) {
      await p.waitForTimeout(250); if (/Built:/.test(await p.locator('#view').innerText())) break;
      await p.waitForFunction(() => document.querySelector('#view .opts'), null, { timeout: 4000 }).catch(() => ok(false, 'a step shows'));
      seen.push(await p.locator('#view p b').first().innerText()); await p.locator('.opt').first().click(); await p.waitForTimeout(1450); const cont = p.getByRole('button', { name: 'Continue' }); if (await cont.count()) { seen.noted = (seen.noted || 0) + 1; await cont.click(); await p.waitForTimeout(200); }
    }
    const RANK = { 'Stem': 0, 'Front': 1, 'Front (lengthening)': 1, 'Prefix': 2, 'Tense formative': 3, 'Connecting vowel': 4, 'Personal ending': 5, 'Ending': 5, 'Sound change': 6, 'Contraction': 7 };
    ok(seen[0] === 'Stem' && seen.length >= 2 && seen.length <= 9 && seen.every((t, k) => t in RANK && (k === 0 || RANK[t] > RANK[seen[k - 1]])), 'steps in word order, stem first: ' + seen.join(','));
    ok(/Built:/.test(await p.locator('#view').innerText()), 'the built form is shown, question ' + questions);
    ok(await p.locator('#view table.ctable tbody tr.hi').count() === 1 || /From the paradigm/.test(await p.locator('#view').innerText()), 'the chart row or paradigm is shown at the end, question ' + questions);
    if (questions === 1) await p.screenshot({ path: '/tmp/claude-0/-home-claude/b1495004-32ad-55d3-a59f-a67ee65f4e2d/scratchpad/bf3.png' });
    await p.getByRole('button', { name: 'Next' }).click(); await p.waitForTimeout(300);
  }
  ok(questions >= 6 && /Practice complete/.test(await p.locator('#view').innerText()), 'a session of ' + questions + ' ends with a summary');
  ok(await p.evaluate(async () => (await import('/lexiko/js/know.js')).K.cards.size) === before, 'practice only: no cards created');
  ok(!errs.length, 'page errors: ' + errs.join('|'));
  console.log(process.exitCode ? 'FAILED' : 'ALL OK'); await b.close();
})();

