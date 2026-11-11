// Home: a "Ready today" card and a count badge on the Study tab. Their numbers are the Study tile numbers (the whole session), and they vanish when the session is empty.
const { chromium } = require('playwright');
let bad = 0; const ok = (c, m) => { console.log((c ? '  ok  ' : '  FAIL ') + m); if (!c) { bad++; process.exitCode = 1; } };
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 390, height: 844 } });
  const errs = []; p.on('pageerror', (e) => errs.push(String(e)));
  const U = 'http://localhost:8123/lexiko/';
  await p.goto(U + '#/settings'); await p.waitForSelector('#nav a[data-tab]');
  const setDue = (n) => p.evaluate(async (n) => { const k = await import('/lexiko/js/know.js'), F = await import('/lexiko/js/fsrs.js'); await k.setLevel(50); await k.setSetting('levelAsked', true); await k.setSetting('parseAsked', true);
    const all = [1510, 3004, 1722, 2316, 1063, 3588, 2532]; for (const x of all) k.K.cards.delete('w:' + x);
    const now = Date.now(); for (const x of all.slice(0, n)) k.K.cards.set('w:' + x, { ...F.newCard('w:' + x), state: 'review', stability: 5, reps: 3, last: now - 3 * 864e5, due: now - 864e5 }); }, n);
  const home = async () => { await p.goto(U + '#/settings'); await p.goto(U + '#/home'); await p.waitForSelector('#view .stack'); await p.waitForTimeout(300); };
  const card = () => p.evaluate(() => { const c = [...document.querySelectorAll('#view .card')].find((x) => /^Ready today/.test(x.textContent)); return c ? { t: c.textContent, links: [...c.querySelectorAll('a.btn')].map((a) => [a.textContent, a.getAttribute('href')]) } : null; });
  const badge = () => p.evaluate(() => { const e = document.querySelector('#nav a[data-tab="study"] .navbadge'); return e ? [e.textContent, e.getAttribute('aria-label')] : null; });
  const tiles = async () => { await p.goto(U + '#/settings'); await p.goto(U + '#/study'); await p.waitForSelector('a.area'); return p.evaluate(() => { const f = (t) => { const a = [...document.querySelectorAll('a.area')].find((x) => x.querySelector('b').textContent === t); const m = a && /(\d+)/.exec((a.querySelector('.badges') || {}).textContent || ''); return m ? +m[1] : 0; }; return { words: f('Vocabulary'), forms: f('Parsing') }; }); };
  await setDue(3); await home();
  const t = await tiles(); await home();
  const c = await card(), bd = await badge();
  ok(t.words >= 3, 'Vocabulary tile counts the session: ' + JSON.stringify(t));
  const w = c && /(\d+) words? (?:is|are|and)/.exec(c.t), f = c && /(\d+) forms? (?:is|are)/.exec(c.t);
  ok(c && (t.words ? +w[1] === t.words : true) && (t.forms ? +f[1] === t.forms : true), 'the card shows the same numbers as the Study tiles: ' + (c && c.t));
  ok(c && c.links[0][0] === 'Study ' + t.words + ' words' && /learn\/daily/.test(c.links[0][1]), 'its button reads like the session button and starts the vocabulary session: ' + (c && c.links[0][0]));
  ok(bd && +bd[0] === t.words + t.forms && bd[1] === (t.words + t.forms) + ' ready today', 'the Study tab badge is the two tile numbers added: ' + JSON.stringify(bd));
  await p.goto(U + '#/settings'); await p.waitForSelector('#nav .navbadge');
  const col = await p.evaluate(() => { const e = document.querySelector('.navbadge'), s = getComputedStyle(e), r = e.getBoundingClientRect(); return { bg: s.backgroundColor, fg: s.color, h: r.height }; });
  ok(col.bg !== col.fg && col.h >= 18, 'the badge is drawn on every screen: ' + JSON.stringify(col));
  // a brand-new learner has Start here instead
  await p.evaluate(async () => { const k = await import('/lexiko/js/know.js'); for (const x of [1510, 3004, 1722]) k.K.cards.delete('w:' + x); await k.setSetting('level', null); });
  await p.evaluate(async () => { const k = await import('/lexiko/js/know.js'); k.K.settings.level = null; });
  await p.goto(U + '#/settings'); await p.goto(U + '#/home'); await p.waitForTimeout(400);
  ok(await badge() === null, 'a new learner (nothing studied, no level) gets no badge');
  ok(errs.length === 0, 'no page errors ' + errs.join('; '));
  await b.close(); console.log(bad ? bad + ' FAILED' : 'all passed');
})();
