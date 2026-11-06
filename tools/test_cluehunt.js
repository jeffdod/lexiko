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
