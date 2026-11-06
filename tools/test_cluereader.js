// Find the clues from the reader: a verb's popup opens a Clue hunt on that form, shows its verse, and returns to the reading; compound verbs are split.
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(), p = await b.newPage({ viewport: { width: 390, height: 860 } }); const errs = [];
  p.on('pageerror', (e) => errs.push(String(e)));
  const ok = (c, m) => { if (!c) { console.log('FAIL: ' + m); process.exitCode = 1; } };
  await p.goto('http://localhost:8123/lexiko/#/home'); await p.waitForTimeout(1800);
  // the splitter, on known compounds and on look-alikes that must not split
  const sp = await p.evaluate(async () => { const C = await import('/lexiko/js/cluehunt.js'), { ROWS } = await import('/lexiko/js/chartdrill.js'), R = (k) => ROWS.find((r) => r.key === k);
    const t = (w, head, k) => { const s = C.splitCompound(w, head, R(k)); return s ? s.join('|') : null; };
    return [t('προσεκύνει', 'προσκυνέω', 'impf-act'), t('κατέβη', 'καταβαίνω', 'aor2-act'), t('ἀπεκρίθη', 'ἀποκρίνομαι', 'aor1-pas'), t('εἰσῆλθον', 'εἰσέρχομαι', 'aor2-act'), t('ἐξέβαλον', 'ἐκβάλλω', 'aor2-act'),
      t('ἔλυσα', 'λύω', 'aor1-act'), t('ἐπίστευσεν', 'πιστεύω', 'aor1-act'), t('ἠγάπησεν', 'ἀγαπάω', 'aor1-act'), t('προσκυνεῖ', 'προσκυνέω', 'pres-act')]; });
  ok(sp[0] === 'προσ|ε|κύνει', 'προσεκύνει: ' + sp[0]); ok(sp[1] === 'κατ|έ|βη', 'κατέβη: ' + sp[1]); ok(sp[2] === 'ἀπ|ε|κρίθη', 'ἀπεκρίθη: ' + sp[2]);
  ok(/^εἰσ\|ῆ\|λθον$/.test(sp[3] || ''), 'εἰσῆλθον: ' + sp[3]); ok(sp[4] === 'ἐξ|έ|βαλον', 'ἐξέβαλον: ' + sp[4]);
  ok(sp[5] === null && sp[6] === null && sp[7] === null && sp[8] === null, 'plain verbs and a present form are not split: ' + JSON.stringify(sp.slice(5)));
  // the reader: tap a verb in John 3:16
  await p.goto('http://localhost:8123/lexiko/#/read/JHN/3'); await p.waitForTimeout(2200);
  const w = p.locator('#v16 .w', { hasText: /^ἠγά/ }).first(); await w.scrollIntoViewIfNeeded(); await w.click(); await p.waitForTimeout(500);
  ok(await p.locator('#pop button', { hasText: 'Find the clues' }).count() >= 1, 'a verb popup has "Find the clues"');
  const nounPop = await p.locator('#v16 .w').nth(6); await nounPop.click(); await p.waitForTimeout(400);
  ok(await p.locator('#pop button', { hasText: 'Find the clues' }).count() === 0, 'a noun popup does not');
  await p.locator('#v16 .w', { hasText: /^ἠγά/ }).first().click(); await p.waitForTimeout(400);
  await p.locator('#pop button', { hasText: 'Find the clues' }).first().click(); await p.waitForTimeout(900);
  const txt = await p.locator('#view').innerText();
  ok(/#\/parse\/run\/clues\/form\//.test(p.url()), 'goes to the clue hunt: ' + p.url());
  ok(/ἠγάπησεν/.test(txt) && /θεὸς/.test(txt), 'the verse is shown with the verb: ' + txt.slice(0, 160).replace(/\n/g, ' '));
  ok(/augment or a reduplication/.test(txt), 'the first clue is asked');
  ok(await p.locator('#view b', { hasText: /^ἠγάπησεν$/ }).count() >= 1, 'only the verb is highlighted in its verse');
  for (const step of ['augment or a reduplication', 'Which tense stem', 'Which tense formative', 'Which personal endings', 'Which form is it']) {
    await p.waitForFunction((s) => document.getElementById('view').innerText.includes(s), step, { timeout: 4000 }).catch(() => ok(false, 'step ' + step));
    await p.locator('.opt').first().click(); await p.waitForTimeout(1500);
  }
  ok(await p.getByRole('button', { name: 'Back to the reading' }).count() === 1, 'the last screen returns to the reading');
  await p.getByRole('button', { name: 'Back to the reading' }).click(); await p.waitForTimeout(900);
  ok(/#\/read\/JHN\/3/.test(p.url()), 'back in the reading: ' + p.url());
  // a participle is another mood: the button is not offered
  await p.locator('#v16 .w').nth(17).click(); await p.waitForTimeout(400);
  ok(await p.locator('#pop button', { hasText: 'Find the clues' }).count() === 0, 'a participle has no clue hunt');
  // a compound verb in the hunt: the split is shown
  const idx = await p.evaluate(async () => { const { D } = await import('/lexiko/js/data.js'); return D.forms.findIndex((f) => f.w.replace(/\u00ad/g, '') === 'προσεκύνει'); });
  ok(idx >= 0, 'προσεκύνει is in the text');
  await p.evaluate((i) => { location.hash = '#/parse/run/clues/form/' + i + '/0'; }, idx); await p.waitForTimeout(900);
  for (let i = 0; i < 5; i++) { await p.locator('.opt').first().click(); await p.waitForTimeout(1500); }
  const end = await p.locator('#view').innerText();
  ok(/Compound verb:\s*προσ\s*·\s*ε\s*·\s*κύνει/.test(end), 'the split is shown: ' + end.slice(0, 260).replace(/\n/g, ' '));
  ok(!errs.length, 'page errors: ' + errs.join('|'));
  console.log(process.exitCode ? 'FAILED' : 'ALL OK'); await b.close();
})();
