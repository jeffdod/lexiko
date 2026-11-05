// 1st aorists with a changed σ (ψ, ξ, liquid verbs): every non-indicative splitter understands them, and the notes say so.
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(), p = await b.newPage({ viewport: { width: 420, height: 900 } }); let bad = 0; const ok = (c, m, x = '') => { console.log((c ? '  ok  ' : 'FAIL  ') + m + (c ? '' : ' ' + x)); if (!c) bad++; };
  const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  await p.goto('http://localhost:8123/#/learn'); await p.waitForTimeout(1500);
  await p.evaluate(async () => { const k = await import('./js/know.js'), F = await import('./js/families.js'); k.K.settings.level = 0; k.K.settings.formLevel = F.NLEVELS; });
  const r = await p.evaluate(async () => {
    const pd = await import('./js/ptcdata.js'), id = await import('./js/infdata.js'), sd = await import('./js/subdata.js'), md = await import('./js/impdata.js'), P = await import('./js/parse.js');
    const out = {}; const kinds = [['ptc', P.participleForms, (w, k, o) => pd.split(w, k, o), (s) => s.stem + s.formative + s.rest], ['inf', P.infinitiveForms, id.splitInf, (s) => s.stem + s.ending],
      ['sub', P.subjunctiveForms, sd.splitSub, (s) => s.stem + s.formative + s.vowel + s.ending], ['imp', P.imperativeForms, md.splitImp, (s) => s.stem + s.formative + s.vowel + s.ending]];
    for (const [n, forms, sp, join] of kinds) { const o = { merged: 0, liquid: 0, bad: [] };
      for (const x of forms(null, { ignoreLevel: true })) { if (!/^aor1-(act|mid)$/.test(x.key)) continue; const s = sp(x.w, x.key, { liquid: pd.isLiquid(x.head) }); if (!s) continue;
        if (join(s) !== x.w) o.bad.push(x.w); if (s.merged) { o.merged++; if (!/[ψξ]/.test(x.w)) o.bad.push('m ' + x.w); } if (s.liquid) { o.liquid++; if (!/[λμνρ]$/.test(pd.skel(s.stem))) o.bad.push('l ' + x.w); } }
      out[n] = o; }
    out.notes = [pd.aoristNotes({ stem: 'γρά', formative: 'ψα', rest: 'ς', merged: true }).join(' '), pd.aoristNotes({ stem: 'ἀγγείλ', formative: 'α', rest: 'ς', liquid: true }).join(' ')];
    return out; });
  for (const n of ['ptc', 'inf', 'sub', 'imp']) ok(r[n].merged > 5 && r[n].liquid > 3 && !r[n].bad.length, n + ': ψ/ξ ' + r[n].merged + ' and liquid ' + r[n].liquid + ' forms split cleanly', JSON.stringify(r[n].bad.slice(0, 5)));
  ok(/ψ is the σ merged/.test(r.notes[0]) && /liquid verb/.test(r.notes[1]), 'the notes explain both', JSON.stringify(r.notes));
  ok(!errs.length, 'no page errors ' + errs.join('|'));
  await b.close(); console.log(bad ? 'FAILED' : 'ALL OK'); process.exit(bad ? 1 : 0);
})();
