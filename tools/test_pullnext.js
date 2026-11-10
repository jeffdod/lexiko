// Pull up at the end of a chapter opens the next one (touch only): not from mid-page, not when released early, yes when pulled far enough.
const { chromium } = require('playwright');
let bad = 0; const ok = (c, m) => { console.log((c ? '  ok  ' : '  FAIL ') + m); if (!c) { bad++; process.exitCode = 1; } };
(async () => {
  const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 390, height: 800 }, hasTouch: true, isMobile: true }); const p = await ctx.newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(String(e)));
  const U = 'http://localhost:8123/lexiko/'; const cdp = await ctx.newCDPSession(p);
  const touch = (type, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x: 200, y }] });
  const drag = async (fromY, toY) => { await touch('touchStart', fromY); for (let i = 1; i <= 8; i++) { await touch('touchMove', fromY + (toY - fromY) * i / 8); await p.waitForTimeout(16); } };
  const hash = () => p.evaluate(() => location.hash);
  await p.goto(U + '#/settings'); await p.waitForSelector('#nav a[data-tab]');
  await p.evaluate(async () => { const K = await import('/lexiko/js/know.js'); await K.setLevel(50); await K.setSetting('levelAsked', true); });
  await p.goto(U + '#/read/1JN/2'); await p.waitForSelector('.readfoot'); await p.waitForTimeout(400);
  // mid-page: nothing
  await p.evaluate(() => window.scrollTo(0, 300)); await p.waitForTimeout(400);
  await drag(600, 300); await touch('touchEnd'); await p.waitForTimeout(200);
  ok((await hash()).includes('1JN/2') && await p.locator('.pullhint.live').count() === 0, 'mid-page: a drag up scrolls, no hint, no navigation');
  // at the bottom: a short pull shows the hint, releasing early cancels
  await p.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight)); await p.waitForTimeout(500);
  await drag(700, 660); await p.waitForTimeout(100);
  const mid = await p.evaluate(() => ({ live: document.querySelector('.pullhint').classList.contains('live'), ready: document.querySelector('.pullhint').classList.contains('ready'), t: document.querySelector('.pullhint').textContent }));
  ok(mid.live && !mid.ready && /Pull up for 1 John 3/.test(mid.t), 'a short pull shows “Pull up for 1 John 3” ' + JSON.stringify(mid));
  await touch('touchEnd'); await p.waitForTimeout(300);
  ok((await hash()).includes('1JN/2'), 'releasing early cancels');
  // a long pull: Release for…, and letting go opens the next chapter
  await p.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight)); await p.waitForTimeout(500);
  await drag(740, 560); await p.waitForTimeout(100);
  const far = await p.evaluate(() => ({ ready: document.querySelector('.pullhint').classList.contains('ready'), t: document.querySelector('.pullhint').textContent }));
  ok(far.ready && /Release for 1 John 3/.test(far.t), 'far enough: “Release for 1 John 3” ' + JSON.stringify(far));
  await touch('touchEnd'); await p.waitForTimeout(600);
  ok((await hash()).includes('1JN/3'), 'letting go opens the next chapter: ' + await hash());
  ok(await p.locator('.pullhint.live').count() === 0, 'the hint is gone on the new chapter');
  ok(errs.length === 0, 'no page errors ' + errs.join('|'));
  await b.close(); console.log(bad ? 'pullnext: FAILED' : 'pullnext: ok');
})();
