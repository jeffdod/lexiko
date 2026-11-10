// A word is tinted on hover only on devices that can hover (not on touch screens, where the last touched word would stay tinted).
const { chromium } = require('playwright');
let bad = 0; const ok = (c, m) => { console.log((c ? '  ok  ' : '  FAIL ') + m); if (!c) { bad++; process.exitCode = 1; } };
(async () => {
  const b = await chromium.launch();
  for (const [name, opts, expectTint] of [['touch phone', { viewport: { width: 390, height: 800 }, hasTouch: true, isMobile: true }, false], ['desktop mouse', { viewport: { width: 1000, height: 800 } }, true]]) {
    const ctx = await b.newContext(opts); const p = await ctx.newPage(); const errs = []; p.on('pageerror', (e) => errs.push(String(e)));
    await p.goto('http://localhost:8123/lexiko/#/settings'); await p.waitForSelector('#nav a[data-tab]');
    await p.evaluate(async () => { const K = await import('/lexiko/js/know.js'); await K.setLevel(50); await K.setSetting('levelAsked', true); });
    await p.goto('http://localhost:8123/lexiko/#/read/1JN/1'); await p.waitForSelector('.reader .w');
    const w = p.locator('.reader .w').nth(5); const bg = (l) => l.evaluate((e) => getComputedStyle(e).backgroundColor);
    const before = await bg(w); await w.hover(); await p.waitForTimeout(250); const after = await bg(w);
    ok((after !== before) === expectTint, name + ': hover ' + (expectTint ? 'tints' : 'does not tint') + ' the word (' + before + ' → ' + after + ')');
    ok(errs.length === 0, name + ': no page errors'); await ctx.close();
  }
  await b.close(); console.log(bad ? 'stickyhover: FAILED' : 'stickyhover: ok');
})();
