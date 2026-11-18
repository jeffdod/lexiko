// Undo last answer after a wrong parsing answer: node tools/test_parseundo.js  (server on :8123)
const { chromium } = require('playwright');
const URL = 'http://localhost:8123/lexiko/';
let fails = 0; const ok = (c, m, x = '') => { console.log((c ? '  ok  ' : '  FAIL ') + m + (x ? ' ' + x : '')); if (!c) fails++; };
(async () => {
  const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 390, height: 900 }, deviceScaleFactor: 1 });
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', (e) => errs.push(e.message)); p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
  await p.goto(URL); await p.waitForSelector('#nav a[data-tab]', { timeout: 60000 });
  const setup = (mode) => p.evaluate(async (mode) => { const k = await import('./js/know.js'); await k.setLevel(100); await k.setSetting('levelAsked', true); await k.setSetting('parseAsked', true); await k.setSetting('gates', k.allGatesOpen()); await k.setSetting('parseMode', mode); }, mode);
  const snap = () => p.evaluate(async () => { const k = await import('./js/know.js'); const s = await k.getParseStats(); const d = k.K.daily[new Date().toISOString().slice(0, 10)] || {}; return { cards: k.K.cards.size, acc: k.K.parseAcc.length, total: s.total || 0, verb: JSON.stringify(s.slots.verb || null) }; });

  // 1) wrong verb in "Which verb is this?"
  await setup('guided');
  await p.goto(URL + '#/parse/run/mix/verb'); await p.reload(); await p.waitForSelector('.vgrid');
  ok(await p.locator('.undorow').count() === 0, 'no undo before answering');
  const before = await snap();
  const a = await p.locator('.vgrid').getAttribute('data-answer'), greek = await p.locator('.qgreek').textContent();
  await p.locator('.vopt:not([data-n="' + a + '"])').first().click(); await p.waitForSelector('.fb.bad');
  ok(await p.locator('.undorow button').count() === 1, 'undo shown after a wrong verb');
  const mid = await snap(); ok(mid.cards === before.cards + 1 && mid.acc === before.acc + 1, 'the miss was recorded', JSON.stringify([before, mid]));
  await p.keyboard.press('u'); await p.waitForSelector('.fb.bad', { state: 'detached' }); await p.waitForSelector('.vgrid');
  const after = await snap();
  ok(after.cards === before.cards && after.acc === before.acc && after.verb === before.verb, 'undo removes the miss as if unanswered', JSON.stringify([before, after]));
  ok(await p.locator('.qgreek').textContent() === greek && await p.locator('.vopt:disabled').count() === 0, 'the same question is back, answerable');
  ok(await p.locator('.qcount').textContent() === '1 / ' + (await p.locator('.qcount').textContent()).split('/')[1].trim(), 'progress count unchanged', await p.locator('.qcount').textContent());

  // 2) right answer: no undo row
  await p.click('.vopt[data-n="' + a + '"]'); await p.waitForSelector('.pslot.cur');
  ok(await p.locator('.undorow').count() === 0, 'no undo while answering correctly');

  // 3) guided: wrong full parse, then undo restores
  const sel = '.pgrid .popt';
  for (let n = 0; n < 12 && await p.locator('.fb').count() === 0; n++) {
    const cont = p.locator('.pq button.primary.block');
    if (await cont.count()) { await cont.click(); await p.waitForTimeout(100); continue; }
    const btn = p.locator('.pgrid .popt:not([disabled])'); if (await btn.count()) { await btn.last().click(); await p.waitForTimeout(450); }
  }
  await p.waitForSelector('.fb', { timeout: 5000 });
  const full = /Correct/.test(await p.locator('.fb b').first().textContent());
  ok(full || await p.locator('.undorow').count() === 1, 'undo offered after a missed parse');
  if (!full) {
    const b1 = await snap(); await p.click('.undorow button'); await p.waitForSelector('.fb', { state: 'detached' });
    await p.waitForTimeout(300); const b2 = await snap(); ok(b2.acc === b1.acc - 1 && b2.cards === b1.cards - 1, 'guided undo restores stats and card', JSON.stringify([b1, b2]));
    ok(await p.locator('.pslot.cur, .vgrid').count() > 0, 'the question starts over');
  }


  // 3b) guided: a wrong tap on one part can be taken back at once, before the parse ends
  await setup('guided');
  await p.goto(URL + '#/parse/run/mix/verb'); await p.reload(); await p.waitForSelector('.vgrid');
  const a3 = await p.locator('.vgrid').getAttribute('data-answer'); await p.click('.vopt[data-n="' + a3 + '"]'); await p.waitForSelector('.pgrid .popt:not([disabled])');
  let slotMiss = false;
  for (let i = 0; i < 6 && !slotMiss; i++) {
    const btns = p.locator('.pgrid .popt:not([disabled])'); const cnt = await btns.count(); if (!cnt) break;
    await btns.nth(cnt - 1).click(); await p.waitForTimeout(450);
    if (await p.locator('.pgrid .popt.wrong').count()) slotMiss = true;
  }
  if (slotMiss) {
    const lab = await p.locator('.pslot.cur').textContent(), cards0 = await snap();
    ok(await p.locator('.pq .undorow button').count() === 1, 'guided: undo offered right after a wrong tap on one part');
    await p.keyboard.press('u'); await p.waitForTimeout(300);
    ok(await p.locator('.pgrid .popt.wrong').count() === 0 && await p.locator('.pgrid .popt:not([disabled])').count() > 0 && await p.locator('.pslot.cur').textContent() === lab, 'the same part is asked again', lab);
    ok(await p.locator('.fb').count() === 0 && (await snap()).cards === cards0.cards, 'nothing was rated by the undo');
  } else console.log('  (no wrong tap happened; per-part undo skipped)');

  // 4) quick mode on nouns
  await setup('quick');
  await p.goto(URL + '#/parse/run/mix/noun'); await p.reload(); await p.waitForSelector('.srow');
  const q0 = await snap();
  for (const row of await p.locator('.srow').all()) await row.locator('button').first().click();
  await p.click('button.primary.block:has-text("Check")'); await p.waitForSelector('.fb');
  if (!/Correct/.test(await p.locator('.fb b').first().textContent())) {
    ok(await p.locator('.undorow').count() === 1, 'quick: undo after a miss');
    await p.click('.undorow button'); await p.waitForSelector('.fb', { state: 'detached' }); await p.waitForTimeout(300);
    const q1 = await snap(); ok(q1.cards === q0.cards && q1.acc === q0.acc, 'quick undo restores', JSON.stringify([q0, q1]));
    ok(await p.locator('.fb').count() === 0, 'question is fresh');
  } else console.log('  (first guess happened to be right; quick path skipped)');
  ok(errs.length === 0, 'no page errors', errs.join(' | ').slice(0, 200));
  await b.close(); console.log(fails ? fails + ' FAILED' : 'all ok'); process.exit(fails ? 1 : 0);
})();
