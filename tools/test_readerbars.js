// Reader: the top bar and bottom navigation slide away while reading down, and return on scroll up, a blank tap, a key, or the top; a word tap leaves them alone.
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const errs = [];
  const ok = (c, m) => { if (!c) { console.log('FAIL: ' + m); process.exitCode = 1; } };
  const state = (p) => p.evaluate(() => { const vis = (el) => !el || getComputedStyle(el).visibility !== 'hidden';
    return { hidden: document.body.classList.contains('rd-hide'), nav: vis(document.getElementById('nav')), bar: vis(document.querySelector('.readbar')) }; });
  const wheel = async (p, dy, n = 6) => { for (let i = 0; i < n; i++) { await p.mouse.wheel(0, dy); await p.waitForTimeout(60); } await p.waitForTimeout(450); };

  const p = await b.newPage({ viewport: { width: 390, height: 780 } }); p.on('pageerror', (e) => errs.push(String(e)));
  await p.goto('http://localhost:8123/lexiko/#/read/JHN/1'); await p.waitForTimeout(2000);
  let s = await state(p); ok(!s.hidden && s.nav && s.bar, 'bars shown when the chapter opens');
  await p.mouse.move(200, 400); await wheel(p, 120, 8);
  s = await state(p); ok(s.hidden && !s.nav && !s.bar, 'bars hidden after scrolling down: ' + JSON.stringify(s));
  await wheel(p, 40, 3); s = await state(p); ok(s.hidden, 'small further scrolling keeps them hidden');
  // a word tap: popup opens, bars stay hidden
  s = await state(p); const before = s.hidden;
  const pt = await p.evaluate(() => { const w = [...document.querySelectorAll('#view .w')].find((e) => { const r = e.getBoundingClientRect(); return r.top > 150 && r.bottom < 450; }); const r = w.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; });
  await p.mouse.click(pt[0], pt[1]); await p.waitForTimeout(500);
  s = await state(p); ok(await p.locator('#pop').isVisible(), 'the word popup opened');
  ok(s.hidden === before && before === true && !s.nav, 'a word tap leaves the bars hidden: ' + JSON.stringify(s));
  // scroll up brings them back
  await p.keyboard.press('Escape'); await wheel(p, -120, 3); s = await state(p); ok(!s.hidden && s.nav && s.bar, 'scrolling up brings them back: ' + JSON.stringify(s));
  // hide again, then a blank tap brings them back
  await wheel(p, 120, 6); s = await state(p); ok(s.hidden, 'hidden again');
  await p.mouse.click(8, 400); await p.waitForTimeout(400); s = await state(p); ok(!s.hidden, 'a tap on a blank spot brings them back');
  // a key brings them back
  await wheel(p, 120, 6); s = await state(p); ok(s.hidden, 'hidden a third time');
  await p.keyboard.press('Tab'); await p.waitForTimeout(400); s = await state(p); ok(!s.hidden, 'a key press brings them back');
  // the top of the chapter
  await wheel(p, 120, 6); await p.evaluate(() => scrollTo(0, 0)); await p.waitForTimeout(500); s = await state(p); ok(!s.hidden, 'bars are shown at the top');
  // leaving the reader clears it
  await wheel(p, 120, 8); s = await state(p); ok(s.hidden, 'hidden before leaving');
  await p.evaluate(() => { location.hash = '#/learn'; }); await p.waitForTimeout(800); s = await state(p); ok(!s.hidden && s.nav, 'leaving the reader shows the navigation');
  // a wide screen keeps the rail
  const q = await b.newPage({ viewport: { width: 1100, height: 780 } });
  await q.goto('http://localhost:8123/lexiko/#/read/JHN/1'); await q.waitForTimeout(2000);
  await q.mouse.move(600, 400); await wheel(q, 150, 8); s = await state(q); ok(s.nav, 'on a wide screen the rail stays: ' + JSON.stringify(s));
  ok(!errs.length, 'page errors: ' + errs.join('|'));
  console.log(process.exitCode ? 'FAILED' : 'ALL OK'); await b.close();
})();
