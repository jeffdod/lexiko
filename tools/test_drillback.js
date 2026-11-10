// Drills started from the "Unlock verb forms" pages: the end screen goes back to that page and offers real words to parse.
// Also: a Parse button on each Indicative row, and a locked row can be practiced.
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(), p = await b.newPage({ viewport: { width: 390, height: 860 } }); const errs = [];
  p.on('pageerror', (e) => errs.push(String(e)));
  const ok = (c, m) => { if (!c) { console.log('FAIL: ' + m); process.exitCode = 1; } };
  const U = 'http://localhost:8123/lexiko/';
  const go = async (hash) => { await p.goto(U + '#/home'); await p.waitForTimeout(150); await p.goto(U + hash); await p.waitForTimeout(500); };
  await p.goto(U + '#/home'); await p.waitForSelector('#nav a[data-tab]');
  const set = (lvl) => p.evaluate(async (l) => { const K = await import('/lexiko/js/know.js'); await K.setLevel(l); await K.setSetting('levelAsked', true); await K.setSetting('parseAsked', true); await K.setSetting('gates', { verbs: true }); }, lvl);
  await set(50);
  const txt = () => p.locator('#view').innerText();
  const btns = async () => (await p.locator('#view .row a.btn').allInnerTexts()).map((s) => s.trim());
  const endNow = async () => { await p.locator('button[aria-label="End practice"]').click(); await p.waitForSelector('text=practice complete', { timeout: 4000 }).catch(() => {}); await p.waitForTimeout(200); };

  // the Indicative list
  await go('#/parse/kinds/ind');
  const rows = await p.locator('#view .li').count();
  ok(rows >= 10, 'rows listed: ' + rows);
  ok(await p.locator('#view .li a.btn.sm:text-is("Parse")').count() === rows && await p.locator('#view .li a.btn.sm:text-is("Drill")').count() === rows, 'every row has Drill and Parse');
  ok(/\d of 5 learned/.test(await txt()) && !/squares learned/.test(await txt()), 'short caption "N of 5 learned"');
  ok(await p.locator('#view .li').nth(2).locator('a:text-is("Parse")').getAttribute('href').then((h) => /^#\/parse\/run\/row\/[a-z0-9-]+$/.test(h)), 'Parse points to that row');

  // a locked row can be practiced (practice only)
  await go('#/parse/run/row/aor1-act');
  ok(await p.locator('.qwrap').count() === 1, 'a locked row gives a practice round');
  // with no known verbs: an explanation and "Try with any verb"
  await set(null); await go('#/parse/run/row/aor1-act');
  ok(/no forms of this row in verbs you know/i.test(await txt()) && !/parsing levels/.test(await txt()), 'empty state has current wording');
  await p.locator('a.btn:text-is("Try with any verb")').click(); await p.waitForTimeout(600);
  ok(await p.locator('.qwrap').count() === 1, '"Try with any verb" gives a round');
  await set(50);

  // drill started from Indicative -> end screen
  await go('#/parse/kinds/ind');
  await p.locator('#view .li').nth(2).locator('a:text-is("Drill")').click(); await p.waitForSelector('.qwrap'); await endNow();
  let t = await btns();
  ok(t[0] === 'Parse real words from this row', 'first button: Parse real words (' + t.join(' | ') + ')');
  ok(t.includes('Back to Indicative') && t.includes('Back to Home') && !t.includes('Back to the paradigm'), 'from Indicative: Back to Indicative and Home, no paradigm');
  ok(await p.locator('#view a.btn.primary').count() === 1 && /Parse real words/.test(await p.locator('#view a.btn.primary').innerText()), 'Parse is the one primary button');
  await p.locator('a.btn:text-is("Back to Indicative")').click(); await p.waitForTimeout(400);
  ok(await p.evaluate(() => location.hash) === '#/parse/kinds/ind', 'Back to Indicative returns to the list');

  // "Drill all rows" from Indicative
  await p.locator('a.btn:text-is("Drill all rows")').click(); await p.waitForSelector('.qwrap'); await endNow();
  t = await btns(); ok(t[0] === 'Parse real words from open rows' && t.includes('Back to Indicative') && !t.includes('Back to Charts'), 'drill all rows: (' + t.join(' | ') + ')');

  // from the paradigm page: unchanged, plus Parse
  await go('#/learn/charts/paradigm/aor1-act');
  await p.locator('a.btn:text-is("Practice this row")').click(); await p.waitForSelector('.qwrap'); await endNow();
  t = await btns(); ok(t[0] === 'Parse real words from this row' && t.includes('Back to the paradigm') && !t.includes('Back to Indicative'), 'from the paradigm: (' + t.join(' | ') + ')');

  // a family page
  await go('#/parse/kinds/ptc');
  await p.locator('#view .li a:text-is("Drill")').first().click(); await p.waitForSelector('.qwrap'); await endNow();
  t = await btns(); ok(!t.some((x) => /^Parse/.test(x)) && t.includes('Back to Participles') && t.filter((x) => x === 'Back to Participles').length === 1 && !t.includes('Back to the paradigm'), 'participles, kind still locked: no Parse button (' + t.join(' | ') + ')');
  await p.locator('a.btn:text-is("Back to Participles")').click(); await p.waitForTimeout(300);
  ok(await p.evaluate(() => location.hash) === '#/parse/kinds/ptc', 'Back to Participles returns to the kinds page');
  await p.locator('a.btn:text-is("Drill all kinds")').click(); await p.waitForSelector('.qwrap'); await endNow();
  t = await btns(); ok(t[0] === 'Parse real words from open kinds', 'drill all kinds: ' + t.join(' | '));
  for (const [fam, word, label] of [['sub', 'subjunctives', 'Back to Subjunctive'], ['imp', 'imperatives', 'Back to Imperative']]) {
    await go('#/parse/kinds/' + fam); await p.locator('#view .li a:text-is("Drill")').first().click(); await p.waitForSelector('.qwrap'); await endNow();
    t = await btns(); ok(t.includes(label) && !t.some((x) => /^Parse/.test(x)), fam + ' (locked kind): (' + t.join(' | ') + ')');
  }
  await go('#/parse/kinds/inf'); await p.locator('a.btn:text-is("Drill all kinds")').click(); await p.waitForSelector('.qwrap'); await endNow();
  t = await btns(); ok(t[0] === 'Parse real words from open kinds' && t.includes('Back to Infinitives'), 'infinitives: (' + t.join(' | ') + ')');
  // a kind that is open offers "Parse some ..."
  await p.evaluate(async () => { const K = await import('/lexiko/js/know.js'); await K.setSetting('gates', K.allGatesOpen()); });
  await go('#/parse/kinds/ptc'); await p.locator('#view .li a:text-is("Drill")').first().click(); await p.waitForSelector('.qwrap'); await endNow();
  t = await btns(); ok(t[0] === 'Parse some participles', 'participles, kind open: (' + t.join(' | ') + ')');

  ok(errs.length === 0, 'no page errors: ' + errs.join(' | '));
  await b.close(); console.log(process.exitCode ? 'drillback: FAILED' : 'drillback: ok');
})();
