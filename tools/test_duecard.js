// Home: a "Due today" card and a count badge on the Study tab, both only while something is due.
const { chromium } = require('playwright');
let bad = 0; const ok = (c, m) => { console.log((c ? '  ok  ' : '  FAIL ') + m); if (!c) { bad++; process.exitCode = 1; } };
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 390, height: 844 } });
  const errs = []; p.on('pageerror', (e) => errs.push(String(e)));
  const U = 'http://localhost:8123/lexiko/';
  await p.goto(U + '#/settings'); await p.waitForSelector('#nav a[data-tab]');
  const setDue = (n) => p.evaluate(async (n) => { const k = await import('/lexiko/js/know.js'), F = await import('/lexiko/js/fsrs.js'); await k.setLevel(50); await k.setSetting('levelAsked', true); await k.setSetting('parseAsked', true);
    const all = [1510, 3004, 1722, 2316, 1063, 3588, 2532]; for (const x of all) k.K.cards.delete('w:' + x);
    const now = Date.now(), ids = all.slice(0, n);
    for (const x of ids) k.K.cards.set('w:' + x, { ...F.newCard('w:' + x), state: 'review', stability: 5, reps: 3, last: now - 3 * 864e5, due: now - 864e5 }); }, n);
  const home = async () => { await p.goto(U + '#/settings'); await p.goto(U + '#/home'); await p.waitForSelector('#view .stack'); await p.waitForTimeout(300); };
  const card = () => p.evaluate(() => { const c = [...document.querySelectorAll('#view .card')].find((x) => /^Due today/.test(x.textContent)); return c ? { t: c.textContent, links: [...c.querySelectorAll('a.btn')].map((a) => [a.textContent, a.getAttribute('href')]) } : null; });
  const badge = () => p.evaluate(() => { const e = document.querySelector('#nav a[data-tab="study"] .navbadge'); return e ? [e.textContent, e.getAttribute('aria-label')] : null; });
  await setDue(0); await home();
  ok(await card() === null && await badge() === null, 'nothing due: no card, no badge');
  await setDue(3); await home();
  let c = await card(), bd = await badge();
  ok(c && /3 words are ready for review/.test(c.t) && c.links[0][0] === 'Review 3 words' && /learn\/daily/.test(c.links[0][1]), 'three words due: the card says so and its button starts the vocabulary session: ' + (c && c.t));
  ok(bd && bd[0] === '3' && bd[1] === '3 reviews due', 'the Study tab shows 3: ' + JSON.stringify(bd));
  await setDue(1); await home(); c = await card();
  ok(c && /1 word is ready for review/.test(c.t) && c.links[0][0] === 'Review 1 word', 'one word reads in the singular: ' + (c && c.t));
  ok((await badge() || [])[1] === '1 review due', 'and the badge label too');
  // the badge also shows on other screens, and the colors are readable
  await p.goto(U + '#/settings'); await p.waitForSelector('#nav .navbadge');
  const col = await p.evaluate(() => { const e = document.querySelector('.navbadge'), s = getComputedStyle(e), r = e.getBoundingClientRect(); return { bg: s.backgroundColor, fg: s.color, w: r.width, h: r.height }; });
  ok(col.bg !== col.fg && col.h >= 18, 'the badge is drawn on every screen: ' + JSON.stringify(col));
  await setDue(0); await home();
  ok(await card() === null && await badge() === null, 'nothing due again: both disappear');
  ok(errs.length === 0, 'no page errors ' + errs.join('; '));
  await b.close(); console.log(bad ? bad + ' FAILED' : 'all passed');
})();
