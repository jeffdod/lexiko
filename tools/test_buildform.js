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
  // the chart's own pieces: formative κα / σα / θη, connecting vowel only on thematic rows, personal ending
  const cp = await p.evaluate(async () => { const B = await import('/lexiko/js/buildform.js'), { D } = await import('/lexiko/js/data.js');
    const at = (w) => D.forms.findIndex((f) => f.w.replace(/­/g, '') === w), cp = (w, row) => { const i = at(w); if (i < 0) return 'missing'; const x = B.decompose(i, row); if (!x) return null; const c = B.chartPieces(x); return [c.F, c.V, c.PE, c.changes].join('|'); };
    return { perf: cp('πεπιστεύκατε', 'perf1-act'), aor: cp('ἐπιστεύσαμεν', 'aor1-act'), aor3: cp('ἐπίστευσεν', 'aor1-act'), pres3p: cp('πιστεύουσιν', 'pres-act'), pres: cp('πιστεύει', 'pres-act') }; });
  ok(d.d && cp.perf === 'κα||τε|false', 'πεπιστεύκατε: κα + τε, ' + cp.perf); ok(cp.aor === 'σα||μεν|false', 'ἐπιστεύσαμεν: σα + μεν, ' + cp.aor);
  ok(cp.aor3 === 'σα||–|true', 'ἐπίστευσεν: σα written σε, ' + cp.aor3); ok(cp.pres3p === '|ο|νσι(ν)|true', 'πιστεύουσιν: ο + νσι(ν) runs together, ' + cp.pres3p); ok(cp.pres === '|ε|ι|false', 'πιστεύει: ε + ι, ' + cp.pres);
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
    const seen = [];
    for (let s = 0; s < 6; s++) {
      await p.waitForTimeout(250); if (/Built:/.test(await p.locator('#view').innerText())) break;
      await p.waitForFunction(() => document.querySelector('#view .opts'), null, { timeout: 4000 }).catch(() => ok(false, 'a step shows'));
      seen.push(await p.locator('#view p b').first().innerText()); await p.locator('.opt').first().click(); await p.waitForTimeout(1450);
    }
    ok(seen.length >= 4 && seen[0] === 'Front' && seen[1] === 'Stem' && seen[2] === 'Tense formative' && seen[seen.length - 1] === 'Personal ending' && (seen.length === 5) === seen.includes('Connecting vowel'), 'steps in order: ' + seen.join(','));
    ok(/Built:/.test(await p.locator('#view').innerText()), 'the built form is shown, question ' + questions);
    ok(await p.locator('#view table.ctable tbody tr.hi').count() === 1, 'the master chart row is shown at the end, question ' + questions);
    if (questions === 1) await p.screenshot({ path: '/tmp/claude-0/-home-claude/b1495004-32ad-55d3-a59f-a67ee65f4e2d/scratchpad/bf3.png' });
    await p.getByRole('button', { name: 'Next' }).click(); await p.waitForTimeout(300);
  }
  ok(questions >= 6 && /Practice complete/.test(await p.locator('#view').innerText()), 'a session of ' + questions + ' ends with a summary');
  ok(await p.evaluate(async () => (await import('/lexiko/js/know.js')).K.cards.size) === before, 'practice only: no cards created');
  ok(!errs.length, 'page errors: ' + errs.join('|'));
  console.log(process.exitCode ? 'FAILED' : 'ALL OK'); await b.close();
})();
