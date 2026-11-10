// English translation in the reader: off by default, per-verse text, italics for bracketed words, curly apostrophes,
// stacked on a phone and side by side on a wide screen, readable contrast in both themes, loaded per book.
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const errs = [];
  const ok = (c, m) => { if (!c) { console.log('FAIL: ' + m); process.exitCode = 1; } };
  const open = async (w, scheme) => {
    const ctx = await b.newContext({ viewport: { width: w, height: 860 }, colorScheme: scheme || 'light' }); const p = await ctx.newPage();
    p.on('pageerror', (e) => errs.push(String(e)));
    await p.goto('http://localhost:8123/lexiko/#/home'); await p.waitForSelector('#nav a[data-tab]', { timeout: 8000 });
    await p.evaluate(async () => { const K = await import('/lexiko/js/know.js'); await K.setLevel(50); await K.setSetting('levelAsked', true); await K.setSetting('parseAsked', true); });
    return p;
  };
  const go = async (p, hash) => { await p.goto('http://localhost:8123/lexiko/#/home'); await p.waitForTimeout(200); await p.goto('http://localhost:8123/lexiko/' + hash); await p.waitForSelector('.reader .verse', { timeout: 8000 }); };
  const on = async (p, v) => { await p.evaluate(async (v) => { await (await import('/lexiko/js/know.js')).setSetting('english', v); }, v); };

  // off by default
  let p = await open(390);
  await go(p, '#/read/JHN/1');
  ok(await p.locator('.reader .en').count() === 0, 'English is off by default');
  ok(await p.evaluate(() => !document.querySelector('.reader.par')), 'no two-column class when off');
  ok(await p.evaluate(async () => !Object.keys((await import('/lexiko/js/data.js')).D.english).length), 'no English loaded when off');

  // on: every verse with Greek has English; the text is exact
  await on(p, true); await go(p, '#/read/JHN/2'); await p.waitForSelector('.reader .en', { timeout: 8000 });
  const info = await p.evaluate(() => ({ verses: document.querySelectorAll('.reader .verse').length, en: document.querySelectorAll('.reader .verse > .en').length,
    lang: document.querySelector('.reader .en').getAttribute('lang'), par: !!document.querySelector('.reader.par'), v1: document.querySelector('#v1 .en').textContent }));
  ok(info.verses === info.en && info.en > 0, 'English under every verse of John 2: ' + JSON.stringify(info));
  ok(info.lang === 'en' && info.par, 'lang="en" and par class');
  const exp = await p.evaluate(async () => { const r = await (await fetch('/lexiko/data/english/JHN.json')).json(); return r.find((c) => c[0] === 2)[1][0][1].replace(/[\[\]]/g, ''); });
  ok(info.v1 === exp, 'John 2:1 text matches the data: ' + info.v1);

  // italics for bracketed words, no brackets on screen, curly apostrophes
  const all = await p.evaluate(() => [...document.querySelectorAll('.reader .en')].map((e) => ({ t: e.textContent, i: e.querySelectorAll('i').length })));
  ok(all.every((x) => !/[\[\]]/.test(x.t)), 'no square brackets on screen');
  ok(all.every((x) => !x.t.includes("'")), 'no straight apostrophes');
  ok(all.some((x) => x.i > 0), 'bracketed words show in <i> (John 2 has some)');

  // the Greek still works: tapping a word opens the popup
  await p.locator('.reader .w').first().click({ force: true }); await p.waitForTimeout(400);
  ok(await p.locator('#pop').count() > 0, 'tapping a Greek word still opens the popup');

  // empty verses have no English; Romans 14:24-26 doxology present, 16:25-27 none
  await go(p, '#/read/ROM/16'); await p.waitForSelector('.reader .en');
  ok(await p.locator('#v25 .en, #v26 .en, #v27 .en').count() === 0, 'Romans 16:25-27 has no English (the verses are empty in RP)');
  await go(p, '#/read/ROM/14'); await p.waitForSelector('.reader .en');
  ok(await p.locator('#v24 .en').count() === 1 && await p.locator('#v26 .en').count() === 1, 'Romans 14:24-26 has English');

  // layout: stacked at 390
  await go(p, '#/read/JHN/1'); await p.waitForSelector('.reader .en');
  const st = await p.evaluate(() => { const g = document.querySelector('#v1 .gk').getBoundingClientRect(), e = document.querySelector('#v1 .en').getBoundingClientRect(); return { gb: g.bottom, et: e.top, gl: g.left, el: e.left }; });
  ok(st.et >= st.gb - 1 && Math.abs(st.gl - st.el) < 4, 'phone: English under the Greek ' + JSON.stringify(st));
  // contrast, light
  const ratio = (p0) => p0.evaluate(() => {
    const lum = (c) => { const [r, g, b] = c.match(/[\d.]+/g).slice(0, 3).map(Number).map((v) => { v /= 255; return v <= .03928 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4); }); return .2126 * r + .7152 * g + .0722 * b; };
    const e = document.querySelector('.reader .en'); let bg = e; let c; while (bg) { c = getComputedStyle(bg).backgroundColor; if (!/rgba\(0, 0, 0, 0\)|transparent/.test(c)) break; bg = bg.parentElement; }
    const a = lum(getComputedStyle(e).color), z = lum(c || 'rgb(255,255,255)'); return (Math.max(a, z) + .05) / (Math.min(a, z) + .05); });
  ok(await ratio(p) >= 4.5, 'English contrast in light theme: ' + await ratio(p));
  await p.context().close();

  // wide: side by side; dark contrast
  p = await open(1100, 'dark'); await on(p, true); await go(p, '#/read/JHN/1'); await p.waitForSelector('.reader .en');
  const wd = await p.evaluate(() => { const g = document.querySelector('#v1 .gk').getBoundingClientRect(), e = document.querySelector('#v1 .en').getBoundingClientRect(); return { gr: g.right, el: e.left, gt: g.top, et: e.top }; });
  ok(wd.el >= wd.gr - 1 && Math.abs(wd.gt - wd.et) < 20, 'wide: English beside the Greek ' + JSON.stringify(wd));
  ok(await ratio(p) >= 4.5, 'English contrast in dark theme: ' + await ratio(p));

  // the switch in the reading options turns it off again and loads other books on demand
  await on(p, false); await go(p, '#/read/JHN/1');
  ok(await p.locator('.reader .en').count() === 0, 'off again');
  await p.locator('button[aria-label*="eading options"], button:has-text("Aa")').first().click().catch(() => {});
  await p.waitForTimeout(300);
  const sw = p.locator('label.switch', { hasText: 'English translation' });
  ok(await sw.count() === 1, 'the reading options have an "English translation" switch');
  if (await sw.count()) { await sw.locator('input').check(); await p.waitForSelector('.reader .en', { timeout: 6000 }).catch(() => ok(false, 'turning the switch on shows English')); }
  ok(await p.evaluate(async () => Object.keys((await import('/lexiko/js/data.js')).D.english).join()) === 'JHN', 'only the open book was loaded');
  ok(errs.length === 0, 'no page errors: ' + errs.join(' | '));
  await b.close(); console.log(process.exitCode ? 'english: FAILED' : 'english: ok');
})();
