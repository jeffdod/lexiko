// Reader: meanings are turned on and off by the Show/Hide meanings button only; Reading options keeps just "Repeat meanings".
const { chromium } = require('playwright');
let bad = 0; const ok = (c, m) => { console.log((c ? '  ok  ' : '  FAIL ') + m); if (!c) { bad++; process.exitCode = 1; } };
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 390, height: 844 } });
  const errs = []; p.on('pageerror', (e) => errs.push(String(e)));
  const U = 'http://localhost:8123/lexiko/';
  await p.goto(U + '#/settings'); await p.waitForSelector('#nav a[data-tab]');
  await p.evaluate(async () => { const K = await import('/lexiko/js/know.js'); await K.setLevel(50); await K.setSetting('levelAsked', true); await K.setSetting('glossMode', false); });
  await p.goto(U + '#/read/MAT/5'); await p.waitForSelector('.reader .w');
  await p.click('button[aria-label="Reading options"]');
  const labels = await p.evaluate(() => [...document.querySelectorAll('dialog label.switch .t')].map((x) => x.textContent));
  ok(!labels.includes('Meanings for unknown words'), 'no meanings switch in Reading options: ' + labels.join(' | '));
  ok(labels.includes('Repeat meanings'), 'Repeat meanings is still there');
  await p.keyboard.press('Escape');
  await p.click('button:has-text("Show meanings")'); await p.waitForSelector('.reader .gl');
  ok(await p.locator('button:has-text("Hide meanings")').count() === 1, 'the button turns meanings on and becomes Hide meanings');
  ok(errs.length === 0, 'no page errors ' + errs.join('; '));
  await b.close(); console.log(bad ? bad + ' FAILED' : 'all passed');
})();
