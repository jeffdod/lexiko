// -qh- aorists of deponent verbs are passive deponent (V-AOI), like e)poreu/qh; true middle aorists (A)PEKRI/NATO) stay middle deponent.
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(), p = await b.newPage({ viewport: { width: 390, height: 860 } }); const errs = [];
  p.on('pageerror', (e) => errs.push(String(e)));
  const ok = (c, m) => { if (!c) { console.log('FAIL: ' + m); process.exitCode = 1; } };
  await p.goto('http://localhost:8123/lexiko/#/home'); await p.waitForTimeout(1500);
  const r = await p.evaluate(async () => {
    const { D } = await import('/lexiko/js/data.js'), M = await import('/lexiko/js/morph.js'), PM = await import('/lexiko/js/parse-model.js');
    const tag = (w) => { const f = D.forms.find((x) => x.w.replace(/­/g, '') === w); return f ? f.an[0].m : 'missing'; };
    const t = {}; for (const w of ['Ἀπεκρίθη', 'ἀπεκρίθη', 'Ἀπεκρίθησαν', 'ἀπεκρίθησαν', 'ἀπεκρίθην', 'ἀπεκρίθης', 'ἀπεκρίθησάν', 'ἐσεβάσθησαν', 'ἀπεκρίνατο', 'ἐπορεύθη']) t[w] = tag(w);
    return { t, voice: M.decode('V-AOI-3S').voice || null, passOK: PM.voiceOK('P', 'O', 'A'), midOK: PM.voiceOK('M', 'D', 'A'), pasForD: PM.voiceOK('P', 'D', 'A') };
  });
  for (const w of ['Ἀπεκρίθη', 'ἀπεκρίθη']) ok(r.t[w] === 'V-AOI-3S', w + ' is ' + r.t[w]);
  for (const w of ['Ἀπεκρίθησαν', 'ἀπεκρίθησαν', 'ἀπεκρίθησάν', 'ἐσεβάσθησαν']) ok(r.t[w] === 'V-AOI-3P', w + ' is ' + r.t[w]);
  ok(r.t['ἀπεκρίθην'] === 'V-AOI-1S' && r.t['ἀπεκρίθης'] === 'V-AOI-2S', 'ἀπεκρίθην / ἀπεκρίθης: ' + r.t['ἀπεκρίθην'] + ' ' + r.t['ἀπεκρίθης']);
  ok(r.t['ἀπεκρίνατο'] === 'V-ADI-3S', 'true middle aorist stays middle deponent: ' + r.t['ἀπεκρίνατο']);
  ok(r.t['ἐπορεύθη'] === 'V-AOI-3S', 'ἐπορεύθη unchanged: ' + r.t['ἐπορεύθη']);
  ok(r.passOK === true && r.midOK === true && r.pasForD === false, 'voice answers: ' + JSON.stringify(r));
  ok(errs.length === 0, 'page errors: ' + errs.join(' | '));
  console.log(process.exitCode ? 'FAILED' : 'ok test_deponent', JSON.stringify(r.t));
  await b.close();
})();
