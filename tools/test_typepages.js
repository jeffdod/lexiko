// A summary page for every kind of verb form: each one renders, says what it is, and is linked from its row; "Yes, add it" opens the page of that kind.
const { chromium } = require('playwright');
let bad = 0; const ok = (c, m) => { console.log((c ? '  ok  ' : '  FAIL ') + m); if (!c) { bad++; process.exitCode = 1; } };
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 390, height: 844 } });
  const errs = []; p.on('pageerror', (e) => errs.push(String(e)));
  const U = 'http://localhost:8123/lexiko/';
  await p.goto(U + '#/settings'); await p.waitForSelector('#nav a[data-tab]');
  await p.evaluate(async () => { const K = await import('/lexiko/js/know.js'); await K.setLevel(500); await K.setSetting('levelAsked', true); await K.setSetting('gates', { verbs: true }); await K.setSetting('gateTrickle', {}); await K.setSetting('gateOffer', 0); });
  const keys = await p.evaluate(async () => { const { allGateKeys } = await import('/lexiko/js/kinds.js'); return ['row:pres-act', ...allGateKeys()]; });
  ok(keys.length > 40, keys.length + ' kinds');
  const empty = [], noHead = [];
  for (const key of keys) {
    await p.goto(U + '#/settings'); await p.goto(U + '#/parse/type/' + encodeURIComponent(key)); await p.waitForSelector('#view h1, #view .stack', { timeout: 5000 }); await p.waitForTimeout(60);
    const r = await p.evaluate(() => ({ title: (document.querySelector('#view h1, #view h2') || {}).textContent || '', secs: [...document.querySelectorAll('#view .sec')].map((x) => x.textContent), card: (document.querySelector('#view .card') || {}).textContent || '', parse: !!document.querySelector('#view a.btn.primary'), hash: location.hash }));
    if (!r.title || !r.parse || !r.secs.includes('How it is built') || !r.secs.includes('From verbs you know') || !r.card) noHead.push(key + ' ' + JSON.stringify(r).slice(0, 120));
    if (!/^#\/parse\/type\//.test(r.hash)) empty.push(key + ' redirected');
  }
  ok(noHead.length === 0, 'every kind has a title, "How it is built", "From verbs you know" and a Parse button' + (noHead.length ? ': ' + noHead.slice(0, 3).join(' | ') : ''));
  ok(empty.length === 0, 'none redirects away' + (empty.length ? ': ' + empty.join(', ') : ''));
  // wording and states
  await p.goto(U + '#/settings'); await p.goto(U + '#/parse/type/row%3Aaor1-act'); await p.waitForSelector('.pline');
  let txt = await p.evaluate(() => document.getElementById('view').textContent);
  ok(/Not open yet/.test(txt) && /Choose forms/.test(txt), 'a closed kind says it is not open yet');
  await p.evaluate(async () => { const K = await import('/lexiko/js/know.js'); await K.setSetting('gates', { verbs: true, 'row:aor1-act': true }); await K.setSetting('gateTrickle', { 'row:aor1-act': Date.now() }); });
  await p.goto(U + '#/settings'); await p.goto(U + '#/parse/type/row%3Aaor1-act'); await p.waitForSelector('.pline');
  txt = await p.evaluate(() => document.getElementById('view').textContent);
  ok(/Just added/.test(txt) && /2 new forms a day to begin with/.test(txt), 'a kind that is easing in says "Just added … 2 new forms a day"');
  await p.evaluate(async () => { const K = await import('/lexiko/js/know.js'); await K.setSetting('gateTrickle', {}); });
  await p.goto(U + '#/settings'); await p.goto(U + '#/parse/type/row%3Aaor1-act'); await p.waitForSelector('.pline');
  txt = await p.evaluate(() => document.getElementById('view').textContent);
  ok(/Open/.test(txt) && /part of your daily parsing\./.test(txt) && !/Just added/.test(txt), 'an open kind says it is part of daily parsing');
  // links from the rows
  await p.goto(U + '#/settings'); await p.goto(U + '#/parse/kinds/ind'); await p.waitForSelector('.tlink');
  ok(await p.locator('#view .li a.tlink').count() >= 10 && /\/parse\/type\//.test(await p.locator('#view .li a.tlink').first().getAttribute('href')), 'each Indicative row links to its page');
  await p.goto(U + '#/settings'); await p.goto(U + '#/parse/kinds/ptc'); await p.waitForSelector('.tlink');
  await p.locator('#view .li a.tlink').first().click(); await p.waitForSelector('#view table.ptctable');
  ok(/#\/parse\/type\/ptc/.test(await p.evaluate(() => location.hash)), 'each participle kind links to its page, which shows its paradigm');
  // Yes opens the page of the kind
  await p.evaluate(async () => { const K = await import('/lexiko/js/know.js'); await K.setLevel(500); await K.setSetting('gates', { verbs: true }); await K.setSetting('gateTrickle', {}); await K.setSetting('gateOffer', 0); K.K.verbAcc.length = 0; for (let i = 0; i < 20; i++) K.K.verbAcc.push(1); });
  await p.goto(U + '#/settings'); await p.goto(U + '#/parse'); await p.waitForSelector('.list');
  const name = await p.evaluate(() => { const c = [...document.querySelectorAll('#view .card')].find((x) => /^Ready for the/.test(x.textContent)); return c && c.querySelector('b').textContent.replace(/^Ready for the | ?\?$/g, ''); });
  await p.click('#view .card button:has-text("Yes, add it")'); await p.waitForTimeout(600);
  const after = await p.evaluate(() => ({ hash: location.hash, h: (document.querySelector('#view h1, #view h2') || {}).textContent, t: document.getElementById('view').textContent }));
  ok(/#\/parse\/type\//.test(after.hash) && after.h && after.h.toLowerCase() === name.toLowerCase() && /Just added/.test(after.t), 'Yes, add it opens the page of ' + name + ': "' + after.h + '"');
  ok(errs.length === 0, 'no page errors ' + errs.join('; '));
  await b.close(); console.log(bad ? bad + ' FAILED' : 'all passed');
})();
