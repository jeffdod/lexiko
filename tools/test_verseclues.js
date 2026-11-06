// Find the clues from the reader's word popup (practice only), and the compound-verb split.
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(), p = await b.newPage({ viewport: { width: 390, height: 860 } }); const errs = [];
  p.on('pageerror', (e) => errs.push(String(e)));
  const ok = (c, m) => { if (!c) { console.log('FAIL: ' + m); process.exitCode = 1; } };
  await p.goto('http://localhost:8123/lexiko/#/home'); await p.waitForTimeout(1800);
  await p.evaluate(async () => { const K = await import('/lexiko/js/know.js'), F = await import('/lexiko/js/families.js'); K.K.settings.level = 0; K.K.settings.formLevel = F.NLEVELS; });
  // the compound split
  const sp = await p.evaluate(async () => { const C = await import('/lexiko/js/cluehunt.js'), { ROWS } = await import('/lexiko/js/chartdrill.js'), { D } = await import('/lexiko/js/data.js');
    const row = (k) => ROWS.find((r) => r.key === k), f = (w) => { const i = D.forms.findIndex((x) => x.w.replace(/­/g, '') === w); return i < 0 ? null : D.forms[i]; };
    const t = (w, k) => { const x = f(w); return x ? (C.splitCompound(x.w, x.an[0].s, row(k)) || {}).text || null : 'missing'; };
    return { a: t('προσεκύνει', 'impf-act'), b: t('κατέβη', 'aor2-act'), c: t('ἀπεκρίθη', 'aor1-pas'), d: t('συνήγαγον', 'aor2-act'), plain: t('ἔδωκεν', 'aor1-act'), plain2: t('ἠγάπησεν', 'aor1-act') }; });
  ok(sp.a === 'προσ-ε-κύνει' && sp.b === 'κατ-έ-βη' && sp.c === 'ἀπ-ε-κρίθη' && sp.d === 'συν-ή-γαγον', 'compound verbs split: ' + JSON.stringify(sp));
  ok(sp.plain === null && sp.plain2 === null, 'plain verbs are not split: ' + JSON.stringify(sp));
  // gating: a perfect form is not offered while level 3 is closed
  const g = await p.evaluate(async () => { const K = await import('/lexiko/js/know.js'), F = await import('/lexiko/js/families.js'), P = await import('/lexiko/js/parse.js'), { D } = await import('/lexiko/js/data.js');
    const i = D.forms.findIndex((x) => /^V-R[AM]I/.test(x.an[0].m)), j = D.forms.findIndex((x) => /^V-AAI/.test(x.an[0].m)); const open = [P.clueRowOfForm(i), P.clueRowOfForm(j)];
    K.K.settings.formLevel = 1; const shut = [P.clueRowOfForm(i), P.clueRowOfForm(j)]; K.K.settings.formLevel = F.NLEVELS; return { open, shut }; });
  ok(g.open[0] && g.open[1] && !g.shut[0] && g.shut[1], 'gated like the daily quiz: ' + JSON.stringify(g));
  // in the reader: tap a verb, find the clues, back to the word
  await p.goto('http://localhost:8123/lexiko/#/read/JHN/3'); await p.waitForTimeout(2200);
  const w = p.locator('.w', { hasText: /^ἠγάπησεν$|ἠγά.?πη.?σεν/ }).first(); await w.scrollIntoViewIfNeeded(); await w.click({ force: true }); await p.waitForTimeout(700);
  const btn = p.locator('#pop button', { hasText: 'Find the clues' }); await btn.waitFor({ timeout: 4000 }).catch(() => {});
  ok(await btn.count() === 1, 'the popup of a verb offers "Find the clues"');
  const before = await p.evaluate(async () => (await import('/lexiko/js/know.js')).K.cards.size);
  await btn.click(); await p.waitForTimeout(500);
  for (const step of ['augment or a reduplication', 'Which tense stem', 'Which tense formative', 'Which personal endings', 'Which form is it']) {
    await p.waitForFunction((s) => document.getElementById('pop').innerText.includes(s), step, { timeout: 4000 }).catch(() => ok(false, 'step "' + step + '" shows in the popup'));
    await p.locator('#pop .opt').first().click(); await p.waitForTimeout(1500);
  }
  ok(/Back to the word/.test(await p.locator('#pop').innerText()), 'feedback ends with a way back');
  await p.getByRole('button', { name: 'Back to the word' }).click(); await p.waitForTimeout(400);
  ok(/Occurs/.test(await p.locator('#pop').innerText()), 'back to the word details');
  ok(await p.evaluate(async () => (await import('/lexiko/js/know.js')).K.cards.size) === before, 'practice only: no cards created');
  // a noun gets no button
  await p.evaluate(async () => (await import('/lexiko/js/reader.js')).hidePop()); const n = p.locator('.w', { hasText: /θε.?ὸς/ }).first(); await n.scrollIntoViewIfNeeded(); await n.click({ force: true }); await p.waitForTimeout(900);

  ok(await p.locator('#pop button', { hasText: 'Find the clues' }).count() === 0, 'a noun has no clue button');
  ok(!errs.length, 'page errors: ' + errs.join('|'));
  console.log(process.exitCode ? 'FAILED' : 'ALL OK'); await b.close();
})();
