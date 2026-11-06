// Build the form: forms are taken apart only when they add up exactly; practice only.
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(), p = await b.newPage({ viewport: { width: 390, height: 860 } }); const errs = [];
  p.on('pageerror', (e) => errs.push(String(e)));
  const ok = (c, m) => { if (!c) { console.log('FAIL: ' + m); process.exitCode = 1; } };
  await p.goto('http://localhost:8123/lexiko/#/parse'); await p.waitForTimeout(1800);
  await p.evaluate(async () => { const K = await import('/lexiko/js/know.js'), F = await import('/lexiko/js/families.js'); K.K.settings.level = 0; K.K.settings.formLevel = F.NLEVELS; });
  ok(await p.locator('.pracgrid a[href="#/parse/run/build/known"]').count() === 1, 'Practice by form links to Build the form');
  const d = await p.evaluate(async () => { const B = await import('/lexiko/js/buildform.js'), { D } = await import('/lexiko/js/data.js');
    const at = (w) => D.forms.findIndex((f) => f.w.replace(/­/g, '') === w), sp = (w, row) => { const i = at(w); if (i < 0) return 'missing'; const x = B.decompose(i, row); return x ? [x.A, x.S, x.F, x.E, x.cell].join('|') : null; };
    return { a: sp('ἐπίστευσαν', 'aor1-act'), b: sp('ἔλαβον', 'aor2-act'), c: sp('πιστεύσει', 'fut-act'), d: sp('ἐπιστεύσαμεν', 'aor1-act'), e: sp('πιστεύει', 'pres-act'), f: sp('ἐπιστεύετε', 'impf-act'),
      contract: sp('ἠγάπησεν', 'aor1-act'), compound: sp('προσεκύνει', 'impf-act'), compound2: sp('ἐκβάλλει', 'pres-act'), mi: sp('ἔδωκεν', 'aor1-act'), vowel: sp('ἦλθον', 'aor2-act'), wrongrow: sp('πιστεύει', 'impf-act') }; });
  ok(d.a === 'ε|πιστευ|σ|αν|3P', 'ἐπίστευσαν: ' + d.a); ok(d.b === 'ε|λαβ||ον|3P' || d.b === 'ε|λαβ||ον|1S', 'ἔλαβον: ' + d.b); ok(d.c === '|πιστευ|σ|ει|3S', 'πιστεύσει: ' + d.c);
  ok(d.d === 'ε|πιστευ|σ|αμεν|1P', 'ἐπιστεύσαμεν: ' + d.d); ok(d.e === '|πιστευ||ει|3S', 'πιστεύει: ' + d.e); ok(d.f === 'ε|πιστευ||ετε|2P', 'ἐπιστεύετε: ' + d.f);
  ok(d.contract === null && d.compound === null && d.compound2 === null && d.mi === null && d.vowel === null && d.wrongrow === null, 'contract, compound, -μι, vowel-initial and wrong-row forms are left out: ' + JSON.stringify(d));
  // every form that is offered adds up, and every offered row/cell is consistent
  const all = await p.evaluate(async () => { const B = await import('/lexiko/js/buildform.js'), P = await import('/lexiko/js/parse.js'), { D } = await import('/lexiko/js/data.js'); let n = 0, bad = 0; const rows = new Set();
    const sk = (s) => s.replace(/­/g, '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/ς/g, 'σ');
    for (const row of B.BUILD_ROWS) for (const id of P.rowPool(row, { ignoreLevel: true, anyVerb: true })) { const x = B.decompose(id, row); if (!x) continue; n++; rows.add(row); if (sk(D.forms[id].w) !== x.A + x.S + x.F + x.used) bad++; }
    return { n, bad, rows: rows.size }; });
  ok(all.n > 500 && all.bad === 0 && all.rows >= 14, 'all offered forms add up exactly: ' + JSON.stringify(all));
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
    for (const step of ['Front', 'Stem', 'Tense formative', 'Ending']) {
      await p.waitForFunction((s) => document.querySelector('#view .opts') && [...document.querySelectorAll('#view p b')].some((b) => b.textContent === s), step, { timeout: 4000 }).catch(() => ok(false, 'step ' + step + ' shows in order'));
      await p.locator('.opt').first().click(); await p.waitForTimeout(1450);
    }
    ok(/Built:/.test(await p.locator('#view').innerText()), 'the built form is shown, question ' + questions);
    await p.getByRole('button', { name: 'Next' }).click(); await p.waitForTimeout(300);
  }
  ok(questions >= 6 && /Practice complete/.test(await p.locator('#view').innerText()), 'a session of ' + questions + ' ends with a summary');
  ok(await p.evaluate(async () => (await import('/lexiko/js/know.js')).K.cards.size) === before, 'practice only: no cards created');
  ok(!errs.length, 'page errors: ' + errs.join('|'));
  console.log(process.exitCode ? 'FAILED' : 'ALL OK'); await b.close();
})();
