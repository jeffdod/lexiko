// Reading options: every label in a choice row keeps room inside its button, at narrow phone widths.
const { chromium } = require('playwright');
let bad = 0; const ok = (c, m) => { console.log((c ? '  ok  ' : '  FAIL ') + m); if (!c) { bad++; process.exitCode = 1; } };
(async () => {
  const b = await chromium.launch(); const errs = [];
  for (const w of [320, 360, 390]) {
    const p = await b.newPage({ viewport: { width: w, height: 800 } }); p.on('pageerror', (e) => errs.push(String(e)));
    const U = 'http://localhost:8123/lexiko/';
    await p.goto(U + '#/settings'); await p.waitForSelector('#nav a[data-tab]');
    await p.evaluate(async () => { const K = await import('/lexiko/js/know.js'); await K.setLevel(50); await K.setSetting('levelAsked', true); });
    await p.goto(U + '#/read/MAT/5'); await p.waitForSelector('.reader .w'); await p.click('button[aria-label="Reading options"]');
    const r = await p.evaluate(() => [...document.querySelectorAll('dialog .seg button')].map((bt) => { const rg = document.createRange(); rg.selectNodeContents(bt); const c = rg.getBoundingClientRect(), x = bt.getBoundingClientRect(); return [bt.textContent, Math.round(Math.min(c.left - x.left, x.right - c.right)), Math.round(x.height)]; }));
    const tight = r.filter(([, gap]) => gap < 6);
    ok(tight.length === 0, w + 'px: every label keeps at least 6px from its button edge (a long one wraps)' + (tight.length ? ' — ' + JSON.stringify(tight) : ''));
    await p.close();
  }
  ok(errs.length === 0, 'no page errors ' + errs.join('; '));
  await b.close(); console.log(bad ? bad + ' FAILED' : 'all passed');
})();
