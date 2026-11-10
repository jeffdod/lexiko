// Reader: the bottom Previous / Next buttons name the chapter they open, on one line, at a narrow phone width.
const { chromium } = require('playwright');
let bad = 0; const ok = (c, m) => { console.log((c ? '  ok  ' : '  FAIL ') + m); if (!c) { bad++; process.exitCode = 1; } };
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 360, height: 800 } });
  const errs = []; p.on('pageerror', (e) => errs.push(String(e)));
  const U = 'http://localhost:8123/lexiko/';
  await p.goto(U + '#/settings'); await p.waitForSelector('#nav a[data-tab]');
  await p.evaluate(async () => { const K = await import('/lexiko/js/know.js'); await K.setLevel(50); await K.setSetting('levelAsked', true); });
  await p.goto(U + '#/read/1JN/2'); await p.waitForSelector('.readfoot');
  const txt = async () => p.evaluate(() => { const [a, , c] = [...document.querySelectorAll('.readfoot > *')]; return [a.textContent.trim(), c.textContent.trim(), a.getAttribute('aria-label'), c.getAttribute('aria-label')]; });
  let t = await txt(); ok(t[0] === '1 John 1' && t[1] === '1 John 3', 'names the chapters: ' + t.slice(0, 2).join(' / '));
  ok(t[2] === 'Previous chapter: 1 John 1' && t[3] === 'Next chapter: 1 John 3', 'screen readers hear “Previous chapter: …”: ' + t.slice(2).join(' / '));
  const top = await p.evaluate(() => [...document.querySelectorAll('.readbar .navpair a')].map((a) => [a.textContent.trim(), a.getAttribute('aria-label'), a.className]));
  const bot = await p.evaluate(() => [...document.querySelectorAll('.readfoot a')].map((a) => [a.textContent.trim(), a.getAttribute('aria-label'), a.className]));
  ok(top.length === 2 && JSON.stringify(top) === JSON.stringify(bot), 'the top buttons are exactly the bottom buttons ' + JSON.stringify(top));
  ok(await p.locator('.readbar .btn.icon').count() === 0, 'the top bar no longer has the bare arrows');
  await p.click('.readfoot a >> nth=1'); await p.waitForSelector('.readfoot'); await p.waitForTimeout(200);
  ok((await p.evaluate(() => location.hash)).includes('1JN/3'), 'Next opens the chapter it names');
  // every book's first and last chapter: both labels stay on one line (button no taller than a single-line button)
  const codes = await p.evaluate(async () => { const { D } = await import('/lexiko/js/data.js'); return D.books.flatMap((x) => [[x.code, x.chapters[0][0]], [x.code, x.chapters[x.chapters.length - 1][0]]]); });
  let tall = [];
  for (const [code, ch] of codes) {
    await p.goto(U + '#/read/' + code + '/' + ch); await p.waitForSelector('.readfoot'); await p.waitForTimeout(60);
    const r = await p.evaluate(() => [...document.querySelectorAll('.readfoot a, .readbar .navpair a')].map((a) => { const rg = document.createRange(); rg.selectNodeContents(a); const c = rg.getBoundingClientRect(), box = a.getBoundingClientRect(); return [a.textContent.trim(), Math.round(box.height), c.left >= box.left + 4 && c.right <= box.right - 4]; }));
    for (const [l, h, fits] of r) if (h > 50 || !fits) tall.push(code + ' ' + ch + ': ' + l + ' (' + h + 'px' + (fits ? '' : ', overflows') + ')');
  }
  ok(tall.length === 0, 'no label wraps at 360px across all books ' + tall.join('; '));
  await p.goto(U + '#/read/2TH/2'); await p.waitForSelector('.readfoot'); t = await txt();
  ok(t[0] === '2 Thess 1' && t[1] === '2 Thess 3' && /2 Thessalonians 1/.test(t[2]), 'long names are shortened on the button, in full for screen readers: ' + t.join(' / '));
  ok(errs.length === 0, 'no page errors ' + errs.join('|'));
  await b.close(); console.log(bad ? 'readernav: FAILED' : 'readernav: ok');
})();
