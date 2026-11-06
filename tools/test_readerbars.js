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
  // the rule itself, fed the jitter of a slow thumb drag (steps of 0, +1, -1 and +2) and a few other paths
  const rule = await p.evaluate(async () => {
    const { barTracker } = await import('/lexiko/js/readbars.js'), run = (ys, shown = true, y0 = 400) => { const t = barTracker(); t.set(shown, y0); let last = null; for (const y of ys) { const r = t.feed(y); if (r !== null) last = r; } return last; };
    const jitter = (from, n, to) => { const ys = []; let y = from, i = 0; while (y < to && i++ < 5000) { y += [1, 0, 1, -1, 2, 0][i % 6]; ys.push(y); } return ys; };
    const down = (a, b) => { const ys = []; for (let y = a; y <= b; y += 1) ys.push(y); return ys; };
    return { slowDown: run(jitter(400, 0, 440)), shortDrag: run(down(400, 420)), tooShort: run(down(400, 410)),
      slowUp: run(jitter(900, 0, 940).map((y) => 1840 - y), false, 940),   // falling positions, with the same jitter
      back: run([...down(400, 460), ...down(460, 450).slice(1)]), flick: run([400, 1900]) };
  });
  ok(rule.slowDown === false, 'a slow, jittery 40px drag down hides the bars: ' + rule.slowDown);
  ok(rule.shortDrag === false, 'a short (20px) drag down hides them: ' + rule.shortDrag);
  ok(rule.tooShort === null, 'a 10px nudge does nothing: ' + rule.tooShort);
  ok(rule.slowUp === true, 'a slow, jittery scroll up brings them back: ' + rule.slowUp);
  ok(rule.back === false, 'a small slip back (10px) does not bring them back: ' + rule.back);
  ok(rule.flick === false, 'one big jump hides them: ' + rule.flick);
  // one fast flick arrives as a single big scroll event and still counts as reading
  await p.evaluate(() => scrollTo(0, 0)); await p.waitForTimeout(500); s = await state(p); ok(!s.hidden, 'shown again at the top');
  await p.evaluate(() => scrollBy(0, 1500)); await p.waitForTimeout(500); s = await state(p); ok(s.hidden, 'a single fast flick hides the bars: ' + JSON.stringify(s));
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
  // after scrolling up the bars slide away again a moment after you stop; not while focus is in a bar, and not at the top
  await p.evaluate(() => scrollTo(0, 1500)); await p.waitForTimeout(500); await wheel(p, -120, 3); s = await state(p); ok(!s.hidden, 'shown while scrolling up');
  await p.waitForTimeout(2200); s = await state(p); ok(s.hidden, 'they slide away again after you stop: ' + JSON.stringify(s));
  await wheel(p, -120, 3); await p.keyboard.press('Tab'); await p.waitForTimeout(4600); s = await state(p); ok(!s.hidden, 'they stay while keyboard focus is in a bar: ' + JSON.stringify(s));
  await p.evaluate(() => document.activeElement.blur()); await p.evaluate(() => scrollTo(0, 0)); await p.waitForTimeout(2300); s = await state(p); ok(!s.hidden, 'at the top they stay');
  // pointer focus left on a bar button (as after closing the Aa dialog) does not keep them up
  await p.evaluate(() => scrollTo(0, 1500)); await p.waitForTimeout(300); await wheel(p, 120, 4); await wheel(p, -120, 3);
  await p.evaluate(() => document.querySelector('.readbar .btn.ghost.sm:not(.icon)').focus({ focusVisible: false })); await p.waitForTimeout(2300); s = await state(p); ok(s.hidden, 'a pointer-focused bar button does not keep the bars up: ' + JSON.stringify(s));
  // the bottom of the chapter keeps them up too
  await p.evaluate(() => scrollTo(0, 1500)); await p.waitForTimeout(300); await wheel(p, 120, 4); s = await state(p); ok(s.hidden, 'hidden mid-chapter before heading to the end');
  await p.evaluate(() => scrollTo(0, document.documentElement.scrollHeight)); await p.waitForTimeout(2300); s = await state(p); ok(!s.hidden, 'at the bottom they come up and stay: ' + JSON.stringify(s));
  // leaving the reader clears it
  await p.evaluate(() => scrollTo(0, 1500)); await p.waitForTimeout(300); await wheel(p, 120, 8); s = await state(p); ok(s.hidden, 'hidden before leaving');
  await p.evaluate(() => { location.hash = '#/learn'; }); await p.waitForTimeout(800); s = await state(p); ok(!s.hidden && s.nav, 'leaving the reader shows the navigation');
  // a wide screen keeps the rail
  const q = await b.newPage({ viewport: { width: 1100, height: 780 } });
  await q.goto('http://localhost:8123/lexiko/#/read/JHN/1'); await q.waitForTimeout(2000);
  await q.mouse.move(600, 400); await wheel(q, 150, 8); s = await state(q); ok(s.nav, 'on a wide screen the rail stays: ' + JSON.stringify(s));
  ok(!errs.length, 'page errors: ' + errs.join('|'));
  console.log(process.exitCode ? 'FAILED' : 'ALL OK'); await b.close();
})();
