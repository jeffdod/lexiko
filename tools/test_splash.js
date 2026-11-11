// First run opens with a one-screen hello: logo, lexiko, the promise, the verse set apart from it, one button. Not a numbered step; gone once the flow is done.
const { chromium } = require('playwright');
let bad = 0; const ok = (c, m) => { console.log((c ? '  ok  ' : '  FAIL ') + m); if (!c) { bad++; process.exitCode = 1; } };
(async () => {
  const b = await chromium.launch(); const errs = [];
  const p = await (await b.newContext({ viewport: { width: 390, height: 780 } })).newPage(); p.on('pageerror', (e) => errs.push(String(e)));
  await p.goto('http://localhost:8123/lexiko/'); await p.waitForSelector('.splash');
  const t = await p.innerText('.splash');
  ok(/lexiko/.test(t) && /no sign-up. no cost. no ads./.test(t), 'shows the name and the promise: ' + JSON.stringify(t.slice(0, 90)));
  const q = await p.evaluate(() => { const bq = document.querySelector('.splash-quote'), pr = document.querySelector('.splash-promise'); return { quote: bq.innerText.replace(/\n+/g, ' | '), gap: bq.getBoundingClientRect().top - pr.getBoundingClientRect().bottom, align: getComputedStyle(bq).textAlign, inside: bq.contains(pr), img: document.querySelector('.splash-logo').naturalWidth }; });
  ok(q.quote === 'freely ye received, | freely give. | Matthew 10:8b · ASV Byzantine Text', 'the verse is two lines with its reference: ' + q.quote);
  ok(q.gap >= 16 && !q.inside, 'the promise is set apart from the verse (gap ' + Math.round(q.gap) + ' px)');
  ok(q.align === 'center' && q.img > 0, 'centered, and the logo loads');
  const bt = await p.evaluate(() => { const e = document.querySelector('.splash .btn'), r = document.createRange(); r.selectNodeContents(e); const a = r.getBoundingClientRect(), c = e.getBoundingClientRect(); return [Math.abs((a.left + a.right) / 2 - (c.left + c.right) / 2), Math.abs((a.top + a.bottom) / 2 - (c.top + c.bottom) / 2)]; });
  ok(bt[0] < 1 && bt[1] < 2, 'button text is centered ' + bt.map((x) => x.toFixed(1)));
  ok(!/Step \d/.test(t), 'it is not a numbered step');
  await p.click('button:has-text("Get started")'); await p.waitForSelector('.choice');
  ok(/Step 1 of 3/.test(await p.innerText('.welcome')), 'Get started leads to Step 1 of 3');
  await p.evaluate(async () => { const k = await import('/lexiko/js/know.js'); await k.setLevel(50); await k.setSetting('levelAsked', true); });
  await p.goto('http://localhost:8123/lexiko/#/settings'); await p.goto('http://localhost:8123/lexiko/#/home'); await p.waitForTimeout(400);
  ok(!(await p.$('.splash')), 'it does not come back once the questions are answered');
  ok(errs.length === 0, 'no page errors ' + errs.join('; '));
  await b.close(); console.log(bad ? bad + ' FAILED' : 'all passed');
})();
