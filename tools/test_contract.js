// Contract verbs (-έω, -άω, -όω): the quizzes include their present forms, split as stem · contracted vowel · ending, with the merge explained.
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(), p = await b.newPage({ viewport: { width: 420, height: 900 } }); let bad = 0; const ok = (c, m, x = '') => { console.log((c ? '  ok  ' : 'FAIL  ') + m + (c ? '' : ' ' + x)); if (!c) bad++; };
  const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  await p.goto('http://localhost:8123/#/learn'); await p.waitForTimeout(1500);
  await p.evaluate(async () => { const k = await import('./js/know.js'), F = await import('./js/families.js'); k.K.settings.level = 0; k.K.settings.gates = k.allGatesOpen(); });
  const u = await p.evaluate(async () => {
    const C = await import('./js/contract.js'), pt = await import('./js/participles.js'), inf = await import('./js/infinitives.js'), sub = await import('./js/subjunctives.js'), imp = await import('./js/imperatives.js'), P = await import('./js/parse.js'), pd = await import('./js/ptcdata.js');
    const known = (w, h, fn, key) => fn({ w, head: h, key });
    const t = { ptc: pt.splitX({ w: 'λαλοῦντες', head: 'λαλέω', key: 'pres-act' }), ptc2: pt.splitX({ w: 'ἀγαπῶντες', head: 'ἀγαπάω', key: 'pres-act' }), ptc3: pt.splitX({ w: 'πληροῦσιν', head: 'πληρόω', key: 'pres-act' }), ptc4: pt.splitX({ w: 'ποιούμενος', head: 'ποιέω', key: 'pres-mp' }),
      inf: inf.splitX({ w: 'ποιεῖν', head: 'ποιέω', key: 'pres-act' }), inf2: inf.splitX({ w: 'ἀγαπᾶσθαι', head: 'ἀγαπάω', key: 'pres-mp' }), inf3: inf.splitX({ w: 'ζῆν', head: 'ζάω', key: 'pres-act' }),
      sub: sub.splitX({ w: 'ποιῇ', head: 'ποιέω', key: 'pres-act' }), sub2: sub.splitX({ w: 'πληροῖ', head: 'πληρόω', key: 'pres-act' }), sub3: sub.splitX({ w: 'ἀγαπῶμεν', head: 'ἀγαπάω', key: 'pres-act' }),
      imp: imp.splitX({ w: 'ποίει', head: 'ποιέω', key: 'pres-act' }), imp2: imp.splitX({ w: 'ἀγαπᾶτε', head: 'ἀγαπάω', key: 'pres-act' }), imp3: imp.splitX({ w: 'πληρούτω', head: 'πληρόω', key: 'pres-act' }), imp4: imp.splitX({ w: 'ποιοῦ', head: 'ποιέω', key: 'pres-mp' }) };
    const real = {}; const kinds = [['ptc', P.participleForms, pt.splitX], ['inf', P.infinitiveForms, inf.splitX], ['sub', P.subjunctiveForms, sub.splitX], ['imp', P.imperativeForms, imp.splitX]];
    for (const [n, forms, fn] of kinds) { let c = 0, none = 0; const badl = []; for (const x of forms(null, { ignoreLevel: true })) { if (!/^pres/.test(x.key) || !C.contractType(x.head)) continue; const s = fn(x); if (!s) { none++; continue; } c++; const w = s.stem + (s.formative || '') + (s.vowel || '') + (s.rest || '') + (s.ending || ''); if (w !== x.w) badl.push(x.w); } real[n] = { c, none, bad: badl.slice(0, 5) }; }
    const queues = {}; for (const [n, m, q] of [['ptc', pt, 'ptcQueue'], ['inf', inf, 'infQueue'], ['sub', sub, 'subQueue'], ['imp', imp, 'impQueue']]) { let k = 0; for (let i = 0; i < 20; i++) k += m[q](null).filter((x) => x.sp && x.sp.contract).length; queues[n] = k; }
    const note = pt.explain({ key: 'pres-act', head: 'λαλέω', w: 'λαλοῦντες', sp: t.ptc }).join(' ');
    return { t, real, queues, note };
  });
  const a = (s, v, e) => s && s.vowel === v && s.ending === e;
  ok(u.t.ptc.formative === 'οῦ' && u.t.ptc.rest === 'ντες' && u.t.ptc.stem === 'λαλ', 'λαλοῦντες = λαλ · οῦ · ντες', JSON.stringify(u.t.ptc));
  ok(u.t.ptc2.formative === 'ῶ' && u.t.ptc3.formative === 'οῦ' && u.t.ptc4.formative === 'ού', 'ἀγαπῶντες, πληροῦσιν, ποιούμενος');
  ok(u.t.inf.ending === 'εῖν' && u.t.inf2.ending === 'ᾶσθαι' && u.t.inf3.ending === 'ῆν', 'ποιεῖν, ἀγαπᾶσθαι, ζῆν', JSON.stringify([u.t.inf, u.t.inf2, u.t.inf3]));
  ok(a(u.t.sub, 'ῇ', '') && a(u.t.sub2, 'οῖ', '') && a(u.t.sub3, 'ῶ', 'μεν'), 'ποιῇ, πληροῖ, ἀγαπῶμεν', JSON.stringify([u.t.sub, u.t.sub2, u.t.sub3]));
  ok(u.t.imp.vowel === 'ει' && u.t.imp.person === 0 && a(u.t.imp2, 'ᾶ', 'τε') && u.t.imp2.person === 2 && a(u.t.imp3, 'ού', 'τω') && u.t.imp3.person === 1 && u.t.imp4.vowel === 'οῦ', 'ποίει, ἀγαπᾶτε, πληρούτω, ποιοῦ', JSON.stringify([u.t.imp, u.t.imp2, u.t.imp3, u.t.imp4]));
  for (const n of ['ptc', 'inf', 'sub', 'imp']) ok(u.real[n].c > 10 && !u.real[n].bad.length, n + ': ' + u.real[n].c + ' real contract present forms split cleanly (' + u.real[n].none + ' left out)', JSON.stringify(u.real[n]));
  ok(Object.values(u.queues).every((k) => k > 0), 'contract forms now appear in all four quizzes', JSON.stringify(u.queues));
  ok(/-έω verb/.test(u.note) && /ε \+ ο contract to ου/.test(u.note) && /λαλεοντεσ/.test(u.note), 'the note explains the merge', u.note);
  ok(!errs.length, 'no page errors ' + errs.join('|'));
  await b.close(); console.log(bad ? 'FAILED' : 'ALL OK'); process.exit(bad ? 1 : 0);
})();
