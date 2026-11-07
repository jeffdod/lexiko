// Verbs in -μι: the reference page, and the infinitive and participle quizzes splitting them into prefix · reduplication · root · ending.
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(), p = await b.newPage({ viewport: { width: 420, height: 900 } }); let bad = 0; const ok = (c, m, x = '') => { console.log((c ? '  ok  ' : 'FAIL  ') + m + (c ? '' : ' ' + x)); if (!c) bad++; };
  const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  const go = async (h) => { await p.evaluate((x) => { location.hash = x; }, h); await p.waitForTimeout(700); };
  await p.goto('http://localhost:8123/#/learn'); await p.waitForTimeout(1500);
  await p.evaluate(async () => { const k = await import('./js/know.js'), F = await import('./js/families.js'); k.K.settings.level = 0; k.K.settings.gates = k.allGatesOpen(); });
  await go('#/learn/charts'); ok(await p.locator('a.btn:text-is("Open Verbs in -μι")').count() === 1, 'Charts page links to Verbs in -μι');
  await go('#/learn/charts/mi');
  ok(await p.locator('.mitab').count() === 6, 'six cards: δίδωμι, τίθημι, ἵστημι, ἀφίημι, δείκνυμι, εἰμί');
  ok(/διδόναι/.test(await p.innerText('#view')) && /δοῦναι/.test(await p.innerText('#view')) && /στῆναι/.test(await p.innerText('#view')), 'forms are shown');
  const u = await p.evaluate(async () => { const M = await import('./js/midata.js'); const f = (w, h, k, s) => { const r = M.miSplit(w, h, k, s); return r && [r.mi.prefix, r.mi.redup, r.mi.root, r.mi.ending].join('|'); };
    return [f('διδόναι', 'δίδωμι', 'pres-act', 'inf'), f('δοῦναι', 'δίδωμι', 'aor2-act', 'inf'), f('διδούς', 'δίδωμι', 'pres-act', 'ptc'), f('δούς', 'δίδωμι', 'aor2-act', 'ptc'), f('παραδιδόντες', 'παραδίδωμι', 'pres-act', 'ptc'),
      f('τιθείς', 'τίθημι', 'pres-act', 'ptc'), f('ἀναστάς', 'ἀνίστημι', 'aor2-act', 'ptc'), f('ἀνίστασθαι', 'ἀνίστημι', 'pres-mp', 'inf'), f('ἀφεῖναι', 'ἀφίημι', 'aor2-act', 'inf'), f('δεικνύναι', 'δείκνυμι', 'pres-act', 'inf'), f('διδόμενος', 'δίδωμι', 'pres-mp', 'ptc'), f('δοθείς', 'δίδωμι', 'aor1-pas', 'ptc')]; });
  const want = ['|δι|δό|ναι', '||δοῦ|ναι', '|δι|δού|ς', '||δού|ς', 'παρα|δι|δό|ντες', '|τι|θεί|ς', 'ἀνα||στά|ς', 'ἀν|ί|στα|σθαι', 'ἀφ||εῖ|ναι', '||δεικνύ|ναι', '|δι|δό|μενος', null];
  ok(JSON.stringify(u) === JSON.stringify(want), 'model splits: prefix | reduplication | root | ending', JSON.stringify(u));
  const real = await p.evaluate(async () => { const M = await import('./js/midata.js'), P = await import('./js/parse.js'), pt = await import('./js/participles.js'), inf = await import('./js/infinitives.js'); const o = {};
    for (const [n, forms, fn] of [['ptc', P.participleForms, pt.splitX], ['inf', P.infinitiveForms, inf.splitX]]) { let c = 0, bad = []; for (const x of forms(null, { ignoreLevel: true })) { if (!M.miClass(x.head) || !/^(pres|aor2)-(act|mp|mid)$/.test(x.key)) continue; const s = fn(x); if (!s) continue; c++; const m = s.mi; if ([m.prefix, m.redup, m.root, m.ending].join('') !== x.w) bad.push(x.w); if (x.key.startsWith('pres') && m.cls.redup && !m.redup) bad.push('r ' + x.w); if (!x.key.startsWith('pres') && m.redup) bad.push('a ' + x.w); } o[n] = { c, bad: bad.slice(0, 5) }; }
    let q = 0; for (let i = 0; i < 25; i++) q += pt.ptcQueue(null).concat(inf.infQueue(null)).filter((x) => x.sp && x.sp.mi).length; o.q = q;
    const e = pt.explain({ key: 'pres-act', head: 'δίδωμι', w: 'διδούς', sp: pt.splitX({ key: 'pres-act', head: 'δίδωμι', w: 'διδούς' }) }).join(' '); o.e = e; return o; });
  ok(real.ptc.c > 30 && !real.ptc.bad.length && real.inf.c > 15 && !real.inf.bad.length, 'real forms: ' + real.ptc.c + ' participles and ' + real.inf.c + ' infinitives split cleanly', JSON.stringify(real));
  ok(real.q > 0, '-μι forms reach the quizzes: ' + real.q);
  ok(/reduplication δι/.test(real.e) && /ι-reduplication δι- marks the present/.test(real.e), 'feedback names the reduplication', real.e);
  ok(!errs.length, 'no page errors ' + errs.join('|'));
  await b.close(); console.log(bad ? 'FAILED' : 'ALL OK'); process.exit(bad ? 1 : 0);
})();
