// Clue hunt: clues in order, then name the form; contrast pairs; practice only.
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(), p = await b.newPage({ viewport: { width: 390, height: 860 } }); const errs = [];
  p.on('pageerror', (e) => errs.push(String(e)));
  const ok = (c, m) => { if (!c) { console.log('FAIL: ' + m); process.exitCode = 1; } };
  await p.goto('http://localhost:8123/lexiko/#/parse'); await p.waitForTimeout(1800);
  await p.evaluate(async () => { const K = await import('/lexiko/js/know.js'), F = await import('/lexiko/js/families.js'); K.K.settings.level = 0; K.K.settings.formLevel = F.NLEVELS; });
  ok(await p.locator('.pracgrid a[href="#/parse/run/clues/known"]').count() === 1, 'Practice by form links to Clue hunt');
  // queue shape: 10 items, a pair every third, both forms of a pair belong to one verb
  const q = await p.evaluate(async () => { const C = await import('/lexiko/js/cluehunt.js'), { D } = await import('/lexiko/js/data.js'); const out = C.clueQueue(true, 10);
    const pairs = out.filter((x) => x.type === 'pair'); return { n: out.length, pairs: pairs.length, at: out.map((x, i) => x.type === 'pair' ? i : -1).filter((i) => i >= 0), same: pairs.every((x) => D.forms[x.ida].an[0].s === D.forms[x.idb].an[0].s && x.ida !== x.idb), dup: new Set(out.filter((x) => x.type === 'hunt').map((x) => x.id)).size === out.filter((x) => x.type === 'hunt').length }; });
  ok(q.n === 10 && q.pairs >= 2 && q.same && q.dup && q.at.every((i) => i % 3 === 2), 'queue shape: ' + JSON.stringify(q));
  // gating: with only level 1 open, no form from a later level turns up (perfect rows are level 3, passives level 2)
  const g = await p.evaluate(async () => { const K = await import('/lexiko/js/know.js'), F = await import('/lexiko/js/families.js'), C = await import('/lexiko/js/cluehunt.js'), { D } = await import('/lexiko/js/data.js');
    K.K.settings.formLevel = 1; const out = []; for (let i = 0; i < 6; i++) out.push(...C.clueQueue(true, 12)); K.K.settings.formLevel = F.NLEVELS;
    const lv = (id) => Math.max(...D.forms[id].an.slice(0, 1).map((a) => F.levelOfTag(a.m))); return { n: out.length, bad: out.filter((x) => x.type === 'hunt' && lv(x.id) > 1).length + out.filter((x) => x.type === 'pair' && (lv(x.ida) > 1 || lv(x.idb) > 1)).length }; });
  ok(g.n > 0 && g.bad === 0, 'gated: nothing from a level that is not open yet: ' + JSON.stringify(g));
  // weak spots: when tense is the weak slot, pairs that differ in the tense come up more often than pairs that differ only in the voice, and the reason is shown
  const w = await p.evaluate(async () => { const C = await import('/lexiko/js/cluehunt.js'); const run = (st) => { let tense = 0, voice = 0, reasons = 0; for (let i = 0; i < 80; i++) for (const x of C.clueQueue(true, 10, st).filter((y) => y.type === 'pair')) { const t = x.a.split('-')[0].replace(/\d/, '') !== x.b.split('-')[0].replace(/\d/, ''); t ? tense++ : voice++; if (x.reason) reasons++; } return { tense, voice, reasons }; };
    return { none: run(null), weakTense: run({ slots: { tense: [30, 100], voice: [98, 100] } }), weakVoice: run({ slots: { tense: [98, 100], voice: [30, 100] } }), pw: C.pairWeight('pres-act', 'impf-act', { slots: { tense: [30, 100] } }) }; });
  ok(w.weakTense.tense / (w.weakTense.tense + w.weakTense.voice) > w.none.tense / (w.none.tense + w.none.voice) + 0.1, 'weak tense: more tense pairs: ' + JSON.stringify(w));
  ok(w.weakVoice.voice / (w.weakVoice.tense + w.weakVoice.voice) > w.none.voice / (w.none.tense + w.none.voice) + 0.1, 'weak voice: more voice pairs: ' + JSON.stringify(w));
  ok(w.weakTense.reasons > 0 && w.none.reasons === 0 && /30%/.test(w.pw.reason || ''), 'a reason is given only when you are clearly weak: ' + JSON.stringify(w.pw));
  // every row can turn up: over many sessions the later rows (perfect, aorist passive) appear too
  const rows = await p.evaluate(async () => { const C = await import('/lexiko/js/cluehunt.js'); const s = new Set(); for (let i = 0; i < 60; i++) for (const x of C.clueQueue(true, 10)) if (x.type === 'hunt') s.add(x.key); return [...s]; });
  ok(rows.includes('perf1-act') && rows.includes('perf-mp') && rows.includes('aor1-pas') && rows.length >= 15, 'all rows come up over time: ' + rows.length + ' rows');
  // missed forms come up more often: give one form of a row a history of lapses and it should be asked far more often than its row-mates
  const m = await p.evaluate(async () => { const C = await import('/lexiko/js/cluehunt.js'), K = await import('/lexiko/js/know.js'), P = await import('/lexiko/js/parse.js'), { D } = await import('/lexiko/js/data.js');
    const pool = P.rowPool('aor1-act', { gated: true, anyVerb: true }).sort((a, b) => D.forms[b].count - D.forms[a].count).slice(0, 40), target = pool[pool.length - 1];
    const count = () => { let n = 0, missed = 0; for (let i = 0; i < 150; i++) for (const x of C.clueQueue(true, 10).filter((y) => y.type === 'hunt')) if (x.id === target) { n++; if (x.missed) missed++; } return { n, missed }; };
    const before = count(); K.K.cards.set(K.parseId(D.forms[target]), { lapses: 4, difficulty: 8, state: 'review' }); const after = count(); K.K.cards.delete(K.parseId(D.forms[target])); return { before, after, pool: pool.length }; });
  ok(m.after.n > m.before.n * 2 && m.after.missed === m.after.n && m.before.missed === 0, 'a missed form comes up more often and says so: ' + JSON.stringify(m));
  const before = await p.evaluate(async () => (await import('/lexiko/js/know.js')).K.cards.size);
  await p.evaluate(() => { location.hash = '#/parse/run/clues/any'; }); await p.waitForTimeout(900);
  let hunts = 0, pairs = 0, text = '';
  for (let i = 0; i < 10; i++) {
    text = await p.locator('#view').innerText();
    if (/Which one is the/.test(text)) { pairs++; await p.locator('.opt').first().click(); await p.waitForTimeout(1300); }
    else {
      hunts++;
      for (const step of ['augment or a reduplication', 'Which tense stem', 'Which tense formative', 'Which personal endings', 'Which form is it']) {
        await p.waitForFunction((s) => document.getElementById('view').innerText.includes(s), step, { timeout: 4000 }).catch(() => ok(false, 'step "' + step + '" shows in order'));
        await p.locator('.opt').first().click(); await p.waitForTimeout(1500);
      }
    }
    ok(/Next/.test(await p.locator('#view').innerText()), 'feedback screen with Next, question ' + (i + 1));
    await p.getByRole('button', { name: 'Next' }).click(); await p.waitForTimeout(300);
  }
  ok(hunts >= 6 && pairs >= 2, 'a mix of hunts and pairs: ' + hunts + '/' + pairs);
  ok(/Practice complete/.test(await p.locator('#view').innerText()), 'finishes with a summary');
  ok(await p.evaluate(async () => (await import('/lexiko/js/know.js')).K.cards.size) === before, 'practice only: no cards created');
  ok(!errs.length, 'page errors: ' + errs.join('|'));
  console.log(process.exitCode ? 'FAILED' : 'ALL OK'); await b.close();
})();
