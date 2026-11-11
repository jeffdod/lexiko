// Home "Continue reading": appears once the reader has been opened, remembers the verse, opens there; can be hidden in Customize Home; new learners with nothing read see none.
const { chromium } = require('playwright');
let bad = 0; const ok = (c, m) => { console.log((c ? '  ok  ' : '  FAIL ') + m); if (!c) { bad++; process.exitCode = 1; } };
(async () => {
  const b = await chromium.launch(); const errs = [];
  const p = await (await b.newContext({ viewport: { width: 390, height: 780 } })).newPage(); p.on('pageerror', (e) => errs.push(String(e)));
  const U = 'http://localhost:8123/lexiko/';
  await p.goto(U + '#/settings'); await p.waitForSelector('#nav a[data-tab]');
  await p.evaluate(async () => { const k = await import('/lexiko/js/know.js'); await k.setLevel(50); await k.setSetting('levelAsked', true); await k.setSetting('parseAsked', true); await k.setSetting('lastBook', null); await k.setSetting('lastVs', 0); });
  const card = () => p.evaluate(() => { const c = [...document.querySelectorAll('#view .card')].find((x) => /^Continue reading/.test(x.textContent)); return c ? { t: c.innerText.replace(/\n+/g, ' | '), a: c.querySelector('a.btn') && [c.querySelector('a.btn').textContent, c.querySelector('a.btn').getAttribute('href'), c.querySelector('a.btn').className] } : null; });
  const home = async () => { await p.goto(U + '#/settings'); await p.goto(U + '#/home'); await p.waitForSelector('#view .stack'); await p.waitForTimeout(400); };
  await home(); ok(await card() === null, 'no card before the reader has ever been opened');
  await p.goto(U + '#/read/MAT/5'); await p.waitForSelector('.reader [data-t]'); await p.waitForTimeout(400);
  await home(); let c = await card();
  ok(c && /Matthew 5 \| The Beatitudes|Matthew 5 \| /.test(c.t) && c.a[1] === '#/read/MAT/5', 'after opening a chapter: chapter only, section named, opens the chapter: ' + (c && c.t));
  ok(c && c.a[0] === 'Continue' && !/primary/.test(c.a[2]), 'its button is outlined, not primary: ' + (c && c.a.join(' ')));
  // scroll down in the reader: the verse at the top is remembered
  await p.goto(U + '#/read/MAT/5'); await p.waitForSelector('.reader [data-t]'); await p.waitForTimeout(400);
  await p.evaluate(() => window.scrollTo(0, 1600)); await p.waitForTimeout(900);
  const vs = await p.evaluate(async () => (await import('/lexiko/js/know.js')).K.settings.lastVs);
  const topVs = await p.evaluate(() => { for (const v of document.querySelectorAll('.verse[data-vs]')) if (v.getBoundingClientRect().bottom > 60) return +v.dataset.vs; return 0; });
  ok(vs > 1 && vs === topVs, 'the verse at the top of the screen is saved: ' + vs);
  await home(); c = await card();
  ok(c && new RegExp('Matthew 5:' + vs).test(c.t) && c.a[1] === '#/read/MAT/5/' + vs, 'Home shows and links to that verse: ' + (c && c.t));
  await p.click('a.btn:has-text("Continue")'); await p.waitForSelector('.reader [data-t]'); await p.waitForTimeout(700);
  const near = await p.evaluate((vs) => { const v = document.querySelector('.verse[data-vs="' + vs + '"]'), r = v.getBoundingClientRect(); return r.bottom > 0 && r.top < innerHeight; }, vs);
  ok(near, 'Continue opens the reader with that verse on screen');
  // scrolling back to the top clears the verse
  await p.evaluate(() => window.scrollTo(0, 0)); await p.waitForTimeout(900);
  ok(await p.evaluate(async () => (await import('/lexiko/js/know.js')).K.settings.lastVs) === 0, 'back at the top: no verse saved');
  // a different chapter resets it
  await p.goto(U + '#/read/JHN/3'); await p.waitForSelector('.reader [data-t]'); await p.waitForTimeout(400);
  await home(); c = await card(); ok(c && /^Continue reading \| John 3( \||$)/.test(c.t) && c.a[1] === '#/read/JHN/3', 'a different chapter replaces it: ' + (c && c.t));
  // Customize Home: listed, on by default, first, can be hidden
  await p.goto(U + '#/home/customize'); await p.waitForSelector('.cz');
  const names = await p.evaluate(() => [...document.querySelectorAll('.cz b')].map((e) => e.textContent));
  ok(names[1] === 'Continue reading', 'Customize Home lists it first after Start here: ' + names.join(' / '));
  await p.click('.cz input[aria-label="Show Continue reading"]'); await p.waitForTimeout(300); await home();
  ok(await card() === null, 'hidden when turned off in Customize Home');
  ok(errs.length === 0, 'no page errors ' + errs.join('; '));
  await b.close(); console.log(bad ? bad + ' FAILED' : 'all passed');
})();
