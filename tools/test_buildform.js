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
  ok(d.compound === null && d.compound2 === null && d.mi === null && d.wrongrow === null, 'compound, -μι and wrong-row forms are left out: ' + JSON.stringify(d));
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
      for (const x of P.moodPool(m, { anyVerb: true })) { const d = B.decomposeMood(m, x); if (!d) continue; ok++; keys.add(x.key); const w = sk(d.word); let a = d.real.replace('(ν)', ''), b2 = d.real.replace('(ν)', 'ν'); if (d.sound) snd++; if (d.contract) { a = d.contract.head + sk(d.contract.res) + d.contract.rest.replace('(ν)', ''); b2 = d.contract.head + sk(d.contract.res) + d.contract.rest.replace('(ν)', 'ν'); con++; } if (sk(a) !== w && sk(b2) !== w) bad++; }
      out[m] = { ok, bad, con, snd, kinds: keys.size }; }
    return out; });
  ok(mo.sub.ok > 100 && mo.imp.ok > 80 && mo.inf.ok > 80 && mo.sub.bad + mo.imp.bad + mo.inf.bad === 0 && mo.sub.kinds >= 6 && mo.inf.kinds >= 6 && mo.sub.con > 10 && mo.imp.con > 10 && mo.inf.con > 10 && mo.sub.snd + mo.imp.snd + mo.inf.snd > 40, 'moods add up: ' + JSON.stringify(mo));
  const gated = await p.evaluate(async () => { const K = await import('/lexiko/js/know.js'), P = await import('/lexiko/js/parse.js'); const was = K.K.settings.formLevel; K.K.settings.formLevel = 1; const n = P.moodPool('sub', { anyVerb: true }).length + P.moodPool('imp', { anyVerb: true }).length + P.moodPool('inf', { anyVerb: true }).length; K.K.settings.formLevel = was; return n; });
  ok(gated === 0, 'moods wait for their level: ' + gated);
  // every form that is offered adds up, and every offered row/cell is consistent
  const all = await p.evaluate(async () => { const B = await import('/lexiko/js/buildform.js'), P = await import('/lexiko/js/parse.js'), { D } = await import('/lexiko/js/data.js'); let n = 0, bad = 0, con = 0, aug = 0, snd = 0; const pairs = new Set(); const rows = new Set();
    const sk = (s) => s.replace(/­/g, '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/ς/g, 'σ');
    for (const row of B.BUILD_ROWS) for (const id of P.rowPool(row, { ignoreLevel: true, anyVerb: true })) { const x = B.decompose(id, row); if (!x) continue; n++; rows.add(row); const core = x.sound ? x.sound.joined : x.S + x.F; const lead = x.aug ? sk(x.aug.to) + core.slice(x.aug.from.length, x.contract ? -1 : undefined) : x.contract ? x.A + x.contract.head : x.A + core; const want = x.contract ? lead + sk(x.contract.res) + x.contract.rest : lead + x.used; if (x.sound) snd++; if (x.aug) { aug++; pairs.add(x.aug.from + '>' + x.aug.to); } if (sk(D.forms[id].w) !== want) { bad++; (globalThis.__bad = globalThis.__bad || []).push(D.forms[id].w + ' ' + row); } if (x.contract) con++; }
    return { snd, n, bad, badlist: (globalThis.__bad || []).slice(0, 5), rows: rows.size, con, aug, pairs: [...pairs].sort().join(' ') }; });
  ok(all.n > 800 && all.bad === 0 && all.rows >= 14 && all.con > 100 && all.aug > 100 && ['α>η', 'ε>η', 'ο>ω', 'αι>ῃ'].every((x) => all.pairs.includes(x)), 'all offered forms add up exactly: ' + JSON.stringify(all));
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
    const indic = seen[0] === 'Front', mood = seen[0] === 'Stem';
    ok(seen.length >= 2 && seen.length <= 8 && (indic ? seen[1] === 'Stem' && (seen.includes('Lengthening') ? seen[2] === 'Lengthening' : seen[2] === 'Tense formative') && ['Personal ending', 'Contraction'].includes(seen[seen.length - 1]) : mood && (seen[1] === 'Ending' ? (seen.length === 2 || (seen.length === 3 && seen[2] === 'Contraction')) : seen[1] === 'Tense formative' && ['Personal ending', 'Contraction'].includes(seen[seen.length - 1]))), 'steps in order: ' + seen.join(','));
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

