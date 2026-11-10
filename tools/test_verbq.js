// The "which verb?" step in Parsing: node tools/test_verbq.js  (server must be running on :8123)
const { chromium } = require('playwright');
const URL = 'http://localhost:8123/lexiko/';
let fails = 0; const ok = (c, m, x = '') => { console.log((c ? '  ok  ' : '  FAIL ') + m + (x ? ' ' + x : '')); if (!c) fails++; };
(async () => {
  const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, colorScheme: 'dark' });
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', (e) => errs.push(e.message)); p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
  await p.goto(URL); await p.waitForSelector('#nav a[data-tab]', { timeout: 60000 });
  await p.evaluate(async () => { const k = await import('./js/know.js'); await k.setLevel(100); await k.setSetting('levelAsked', true); await k.setSetting('parseAsked', true); await k.setSetting('gates', k.allGatesOpen()); await k.setSetting('parseMode', 'guided'); });

  // choices: always four, unique, the right one among them, all real lexicon verbs
  const c = await p.evaluate(async () => { const v = await import('./js/verbq.js'), { D } = await import('./js/data.js'); let bad = 0, n = 0;
    for (const L of D.lex.filter((x) => x.pos === 'V' && x.freq >= 10).slice(0, 150)) { n++; const o = v.verbChoices(L.n); if (o.length !== 4 || new Set(o.map((x) => x.n)).size !== 4 || !o.some((x) => x.n === L.n) || o.some((x) => x.pos !== 'V')) bad++; }
    return { n, bad }; });
  ok(c.bad === 0, 'verb choices: four different real verbs including the right one', JSON.stringify(c));

  // a right answer leads to the parse
  await p.goto(URL + '#/parse/run/mix/verb'); await p.waitForSelector('.vgrid');
  const q1 = await p.locator('#view').innerText();
  ok(/Which verb is this\?/i.test(q1), 'verb forms start by asking which verb');
  const shown = await p.evaluate(() => document.querySelector('.qmeta') ? document.querySelector('.qmeta').textContent : '');
  ok(shown === '', 'the verb is not shown before you answer');
  ok(await p.locator('.vopt').count() === 4, 'four choices');
  await p.screenshot({ path: '/tmp/lexiko-shots-goals/verbq-ask.png' });
  const a1 = await p.locator('.vgrid').getAttribute('data-answer');
  await p.click('.vopt[data-n="' + a1 + '"]'); await p.waitForSelector('.pslot.cur');
  ok(/Tense\?/.test(await p.textContent('.pslot.cur')) && await p.locator('.qmeta').count() === 1, 'right verb: its meaning appears and the parse begins');
  const s1 = await p.evaluate(async () => (await (await import('./js/know.js')).getParseStats()).slots.verb);
  ok(s1 && s1[0] === 1 && s1[1] === 1, 'the verb answer is counted', JSON.stringify(s1));

  // a wrong answer skips the parse and brings the form back
  await p.goto(URL + '#/parse/run/mix/verb'); await p.reload(); await p.waitForSelector('.vgrid');
  const a2 = await p.locator('.vgrid').getAttribute('data-answer');
  const wrong = await p.locator('.vopt:not([data-n="' + a2 + '"])').first();
  await wrong.click(); await p.waitForSelector('.fb.bad');
  const t2 = await p.locator('#view').innerText();
  ok(/It is /.test(t2) && await p.locator('.pgrid').count() === 0 && await p.locator('.vopt.right').count() === 1 && await p.locator('.vopt.wrong').count() === 1, 'wrong verb: the right one is shown and there is no parse');
  await p.screenshot({ path: '/tmp/lexiko-shots-goals/verbq-wrong.png' });
  const r2 = await p.evaluate(async () => { const k = await import('./js/know.js'); const cs = [...k.K.cards.values()].filter((c) => c.id.startsWith('f:')); return { n: cs.length, mins: cs.map((c) => Math.round((c.due - Date.now()) / 6e4)) }; });
  ok(r2.n >= 1 && r2.mins.some((m) => m <= 15), 'a missed verb is rated as missed and due again soon', JSON.stringify(r2));
  await p.click('button.primary.block'); await p.waitForTimeout(500);
  ok(await p.locator('.vgrid, .pq, .qcard, .qwrap').count() > 0, 'continues to the next card');

  // I don't know behaves the same way
  await p.goto(URL + '#/parse/run/mix/verb'); await p.reload(); await p.waitForSelector('.vgrid');
  await p.click('button:has-text("I don’t know")'); await p.waitForSelector('.fb.bad');
  ok(await p.locator('.pgrid').count() === 0 && await p.locator('.vopt.right').count() === 1, 'I don’t know shows the verb and skips the parse');
  // nouns have no verb step
  await p.evaluate(async () => { const k = await import('./js/know.js'); await k.setSetting('parseMode', 'quick'); });
  await p.goto(URL + '#/parse/run/mix/noun'); await p.reload(); await p.waitForSelector('.srow');
  ok(await p.locator('.vgrid').count() === 0, 'noun forms go straight to the parse');
  ok(errs.length === 0, 'no page errors', errs.join(' | ').slice(0, 200));
  await b.close(); console.log(fails ? fails + ' FAILED' : 'all ok'); process.exit(fails ? 1 : 0);
})();
