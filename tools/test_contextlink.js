// "Read in context" inside a quiz: a small target (just the words), and it asks before leaving the quiz.
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(), p = await b.newPage({ viewport: { width: 390, height: 860 } }); const errs = [];
  p.on('pageerror', (e) => errs.push(String(e)));
  const ok = (c, m) => { if (!c) { console.log('FAIL: ' + m); process.exitCode = 1; } };
  const U = 'http://localhost:8123/lexiko/'; let ask = null, answer = false;
  p.on('dialog', async (d) => { ask = d.message(); answer ? await d.accept() : await d.dismiss(); });
  await p.goto(U + '#/home'); await p.waitForSelector('#nav a[data-tab]');
  await p.evaluate(async () => { const K = await import('/lexiko/js/know.js'); await K.setLevel(50); await K.setSetting('levelAsked', true); await K.setSetting('gates', K.allGatesOpen()); });
  const go = async (h) => { await p.goto(U + '#/home'); await p.waitForTimeout(150); await p.goto(U + h); await p.waitForTimeout(700); };
  const check = async (what) => {
    const a = p.locator('.qctx .ctxread a'); await a.waitFor({ timeout: 4000 }).catch(() => {});
    ok(await a.count() === 1, what + ': a context link is shown');
    const box = await a.boundingBox(), card = await p.locator('.qctx').boundingBox();
    ok(box && box.width < card.width * 0.6, what + ': the link is only as wide as its words: ' + JSON.stringify([box && Math.round(box.width), Math.round(card.width)]));
    ok(box && box.height >= 24, what + ': tall enough to tap: ' + (box && Math.round(box.height)));
    // a tap beside the link (same line, far right) does nothing
    await p.mouse.click(box.x + box.width + 60, box.y + box.height / 2); await p.waitForTimeout(300);
    ok(!/^#\/read/.test(await p.evaluate(() => location.hash)), what + ': a tap beside the link stays in the quiz');
    // cancel keeps the quiz
    ask = null; answer = false; await a.click(); await p.waitForTimeout(400);
    ok(/Leave this quiz/.test(ask || ''), what + ': asks first: ' + ask);
    ok(!/^#\/read/.test(await p.evaluate(() => location.hash)) && await p.locator('.qwrap').count() === 1, what + ': Cancel stays in the quiz');
    // OK leaves
    answer = true; await a.click(); await p.waitForTimeout(600);
    ok(/^#\/read\//.test(await p.evaluate(() => location.hash)), what + ': OK opens the reader');
  };
  // parsing quiz
  await go('#/parse/run/row/pres-act'); await p.waitForSelector('.qwrap');
  await p.locator('details.ctxfold summary').first().click(); await check('parsing');
  // vocabulary quiz: reveal the answer, which shows the verse
  await go('#/learn/daily'); await p.waitForTimeout(500);
  if (await p.locator('.qwrap').count()) {
    const show = p.locator('button:text-is("Show answer")').first(); if (await show.count()) await show.click();
    await p.waitForTimeout(300);
    if (await p.locator('.qctx .ctxread a').count()) await check('vocabulary'); else ok(false, 'vocabulary: no verse shown after Show answer');
  } else ok(false, 'vocabulary: no round available');
  ok(errs.length === 0, 'no page errors: ' + errs.join(' | '));
  await b.close(); console.log(process.exitCode ? 'contextlink: FAILED' : 'contextlink: ok');
})();
