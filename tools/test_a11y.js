// Accessibility checks on the main screens (phone size, light and dark): node tools/test_a11y.js (server on :8123)
//  - every button, link and field has a name   - tap targets are at least 40px   - text contrast is at least 4.5:1 (3:1 for large text)
const { chromium } = require('playwright');
const URL = 'http://localhost:8123/lexiko/';
const ROUTES = ['#/home', '#/read/JHN/1', '#/learn', '#/learn/words', '#/parse', '#/parts', '#/progress', '#/settings', '#/search', '#/help'];
let fails = 0;
const ok = (c, m) => { console.log((c ? '  ok  ' : ' FAIL ') + m); if (!c) fails++; };

const AUDIT = () => {
  const lum = (c) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]); };
  const parse = (s) => { const m = /rgba?\(([^)]+)\)/.exec(s); if (!m) return null; const p = m[1].split(/[ ,\/]+/).filter(Boolean).map(Number); return { c: p.slice(0, 3), a: p.length > 3 ? p[3] : 1 }; };
  const bgOf = (el) => { let stack = []; for (let e = el; e; e = e.parentElement) { const b = parse(getComputedStyle(e).backgroundColor); if (b && b.a > 0) { stack.push(b); if (b.a >= 1) break; } } let base = [255, 255, 255]; for (const b of stack.reverse()) base = base.map((v, i) => Math.round(b.c[i] * b.a + v * (1 - b.a))); return base; };
  const vis = (e) => { const r = e.getBoundingClientRect(); const cs = getComputedStyle(e); return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none' && !e.closest('[hidden]') && !e.closest('#loading'); };
  const name = (e) => (e.getAttribute('aria-label') || e.getAttribute('aria-labelledby') || e.getAttribute('title') || e.textContent || (e.labels && e.labels.length ? 'label' : '') || e.getAttribute('placeholder') || '').trim();
  const out = { noName: [], small: [], contrast: [] };
  const desc = (e) => e.tagName.toLowerCase() + (e.className && typeof e.className === 'string' ? '.' + e.className.split(' ').join('.') : '') + ' "' + (e.textContent || '').trim().slice(0, 30) + '"';
  document.querySelectorAll('button, a[href], input, select, textarea, summary').forEach((e) => {
    if (!vis(e) || e.type === 'hidden') return;
    if (!name(e) && !e.querySelector('svg[aria-label]')) out.noName.push(desc(e));
    const r = e.getBoundingClientRect(), inline = e.tagName === 'A' && getComputedStyle(e).display === 'inline';
    if (!inline && (r.height < 40 || r.width < 40) && !e.closest('.reader') && e.tagName !== 'INPUT') out.small.push(desc(e) + ' ' + Math.round(r.width) + 'x' + Math.round(r.height));
  });
  const seen = new Set();
  document.querySelectorAll('body *').forEach((e) => {
    if (!vis(e) || ![...e.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())) return;
    const cs = getComputedStyle(e), fg = parse(cs.color); if (!fg) return;
    const bg = bgOf(e), fgc = fg.c.map((v, i) => Math.round(v * fg.a + bg[i] * (1 - fg.a)));
    const l1 = lum(fgc), l2 = lum(bg), ratio = (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
    const px = parseFloat(cs.fontSize), large = px >= 24 || (px >= 18.66 && +cs.fontWeight >= 700);
    const dis = e.closest('[disabled], .disabled, [aria-disabled=true]');
    if (!dis && ratio < (large ? 3 : 4.5)) { const k = desc(e) + cs.color + cs.backgroundColor; if (!seen.has(k)) { seen.add(k); out.contrast.push(ratio.toFixed(2) + ' ' + desc(e)); } }
  });
  return out;
};

(async () => {
  const b = await chromium.launch();
  for (const scheme of ['light', 'dark']) {
    const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, colorScheme: scheme, isMobile: true, hasTouch: true });
    const page = await ctx.newPage();
    await page.goto(URL); await page.waitForSelector('#loading', { state: 'detached' });
    await page.click('.choice >> nth=2'); await page.click('button:has-text("Continue")'); await page.click('button:has-text("Skip for now")'); await page.waitForSelector('.hero');
    await page.evaluate(async () => { const m = await import('./js/know.js'); await m.markLearning(3056); });
    for (const r of ROUTES) {
      await page.goto(URL + r); await page.waitForTimeout(450);
      const o = await page.evaluate(AUDIT);
      ok(!o.noName.length, scheme + ' ' + r + ' controls have names' + (o.noName.length ? ': ' + o.noName.slice(0, 4).join(' | ') : ''));
      ok(!o.small.length, scheme + ' ' + r + ' tap targets >= 40px' + (o.small.length ? ': ' + o.small.slice(0, 5).join(' | ') : ''));
      ok(!o.contrast.length, scheme + ' ' + r + ' text contrast' + (o.contrast.length ? ': ' + o.contrast.slice(0, 5).join(' | ') : ''));
    }
    await ctx.close();
  }
  await b.close();
  console.log(fails ? '\n' + fails + ' FAILURES' : '\nALL PASSED'); process.exit(fails ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
