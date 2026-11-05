// A paradigm grid lists the singular forms down the left column and the plural forms down the right.
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(), p = await b.newPage({ viewport: { width: 420, height: 900 } }); let bad = 0; const ok = (c, m) => { console.log((c ? '  ok  ' : 'FAIL  ') + m); if (!c) bad++; };
  const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  await p.goto('http://localhost:8123/#/learn/charts/run/aor2-pas'); await p.waitForSelector('.qcard');
  for (let i = 0; i < 12; i++) { if (!(await p.locator('.qcard').count())) break; const k = await p.locator('.opt').count(); await p.locator('.opt').nth(i % k).click(); await p.waitForSelector('.fb');
    if (await p.locator('.fb.bad').count()) break; await p.click('button:text-is("Continue")'); await p.waitForTimeout(150); }
  const r = await p.evaluate(() => [...document.querySelectorAll('.pgrid.ppara .pcell')].map((c) => { const q = c.getBoundingClientRect(); return { l: c.querySelector('.plabel').textContent.replace(/ · .*/, ''), x: Math.round(q.left), y: Math.round(q.top) }; }));
  ok(r.length === 6, 'six forms');
  const left = r.filter((c) => /sing/.test(c.l)), right = r.filter((c) => /pl\./.test(c.l)), sing = r.filter((c) => /sing/.test(c.l));
  ok(left.length === 3 && new Set(left.map((c) => c.x)).size === 1, 'the three singular forms share the left column');
  ok(right.length === 3 && new Set(right.map((c) => c.x)).size === 1 && right[0].x > left[0].x, 'the three plural forms share the right column');
  ok(left.map((c) => c.l).join() === '1st sing.,2nd sing.,3rd sing.' && left[0].y < left[1].y && left[1].y < left[2].y, 'singular reads 1st, 2nd, 3rd downward');
  ok(right.map((c) => c.l).join() === '1st pl.,2nd pl.,3rd pl.' && right[0].y < right[1].y && right[1].y < right[2].y, 'plural reads 1st, 2nd, 3rd downward');
  ok(!errs.length, 'no page errors ' + errs.join('|'));
  await b.close(); console.log(bad ? 'FAILED' : 'ALL OK'); process.exit(bad ? 1 : 0);
})();
