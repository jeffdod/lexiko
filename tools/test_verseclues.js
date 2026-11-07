// Find the clues from the reader's word popup (practice only), and the compound-verb split.
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(), p = await b.newPage({ viewport: { width: 390, height: 860 } }); const errs = [];
  p.on('pageerror', (e) => errs.push(String(e)));
  const ok = (c, m) => { if (!c) { console.log('FAIL: ' + m); process.exitCode = 1; } };
  await p.goto('http://localhost:8123/lexiko/#/home'); await p.waitForTimeout(1800);
  await p.evaluate(async () => { const K = await import('/lexiko/js/know.js'), F = await import('/lexiko/js/families.js'); K.K.settings.level = 0; K.K.settings.gates = K.allGatesOpen(); });
  // the compound split
  const sp = await p.evaluate(async () => { const C = await import('/lexiko/js/cluehunt.js'), { ROWS } = await import('/lexiko/js/chartdrill.js'), { D } = await import('/lexiko/js/data.js');
    const row = (k) => ROWS.find((r) => r.key === k), f = (w) => { const i = D.forms.findIndex((x) => x.w.replace(/­/g, '') === w); return i < 0 ? null : D.forms[i]; };
    const t = (w, k) => { const x = f(w); if (!x) return 'missing'; const s = C.splitCompound(x.w, D.lexByN.get(x.an[0].s).head, row(k)); return s ? s.join('-') : null; };
    return { a: t('προσεκύνει', 'impf-act'), b: t('κατέβη', 'aor2-act'), c: t('ἀπεκρίθη', 'aor1-pas'), d: t('συνήγαγον', 'aor2-act'), plain: t('ἔδωκεν', 'aor1-act'), plain2: t('ἠγάπησεν', 'aor1-act') }; });
  ok(sp.a === 'προσ-ε-κύνει' && sp.b === 'κατ-έ-βη' && sp.c === 'ἀπ-ε-κρίθη' && sp.d === 'συν-ή-γαγον', 'compound verbs split: ' + JSON.stringify(sp));
  ok(sp.plain === null && sp.plain2 === null, 'plain verbs are not split: ' + JSON.stringify(sp));
  // gating: a perfect form is not offered while its row is closed
  const g = await p.evaluate(async () => { const K = await import('/lexiko/js/know.js'), F = await import('/lexiko/js/kinds.js'), { D } = await import('/lexiko/js/data.js');
    const i = D.forms.findIndex((x) => /^V-R[AM]I/.test(x.an[0].m)), j = D.forms.findIndex((x) => /^V-AAI/.test(x.an[0].m)); const isOpen = (id) => K.gateOpen(F.gateKeyOfTag(D.forms[id].an[0].m, D.forms[id].an[0].s));
    const open = [isOpen(i), isOpen(j)]; K.K.settings.gates = { verbs: true, 'row:aor1-act': true }; const shut = [isOpen(i), isOpen(j)]; K.K.settings.gates = K.allGatesOpen(); return { open, shut }; });
  ok(g.open[0] && g.open[1] && !g.shut[0] && g.shut[1], 'gated like the daily quiz: ' + JSON.stringify(g));
  // in the reader: tap a verb, find the clues, back to the word
  await p.goto('http://localhost:8123/lexiko/#/read/JHN/3'); await p.waitForTimeout(2200);
  const w = p.locator('.w', { hasText: /^ἠγάπησεν$|ἠγά.?πη.?σεν/ }).first(); await w.scrollIntoViewIfNeeded(); await w.click({ force: true }); await p.waitForTimeout(700);
  const btn = p.locator('#pop button', { hasText: 'Find the clues' }); await btn.waitFor({ timeout: 4000 }).catch(() => {});
  ok(await btn.count() === 1, 'the popup of a verb offers "Find the clues"');
  const before = await p.evaluate(async () => (await import('/lexiko/js/know.js')).K.cards.size);
  await btn.click(); await p.waitForTimeout(800);
  ok(/#\/parse\/run\/clues\/form\//.test(await p.evaluate(() => location.hash)), 'Find the clues opens the clue hunt for that form');
  for (const step of ['augment or a reduplication', 'Which tense stem', 'Which tense formative', 'Which personal endings', 'Which form is it']) {
    await p.waitForFunction((s) => document.getElementById('view').innerText.includes(s), step, { timeout: 4000 }).catch(() => ok(false, 'step "' + step + '" shows in the popup'));
    await p.locator('#view .opt').first().click(); await p.waitForTimeout(1500);
  }
  ok(/Back to (the )?reading/i.test(await p.locator('#view').innerText()), 'feedback ends with a way back');
  await p.getByText(/Back to (the )?reading/i).first().click(); await p.waitForTimeout(800);
  ok(/#\/read\//.test(await p.evaluate(() => location.hash)), 'back in the reader');
  ok(await p.evaluate(async () => (await import('/lexiko/js/know.js')).K.cards.size) === before, 'practice only: no cards created');
  // a noun gets no button
  await p.evaluate(async () => (await import('/lexiko/js/reader.js')).hidePop()); const n = p.locator('.w', { hasText: /θε.?ὸς/ }).first(); await n.scrollIntoViewIfNeeded(); await n.click({ force: true }); await p.waitForTimeout(900);

  ok(await p.locator('#pop button', { hasText: 'Find the clues' }).count() === 0, 'a noun has no clue button');
  ok(!errs.length, 'page errors: ' + errs.join('|'));
  console.log(process.exitCode ? 'FAILED' : 'ALL OK'); await b.close();
})();
