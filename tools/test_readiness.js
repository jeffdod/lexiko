// Readiness colors (chapter tiles, legend, percent badges): five levels that can be told apart by more than color, in both themes.
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const errs = [];
  const ok = (c, m) => { if (!c) { console.log('FAIL: ' + m); process.exitCode = 1; } };
  const U = 'http://localhost:8123/lexiko/';
  for (const theme of ['light', 'dark']) {
    const p = await b.newPage({ viewport: { width: 390, height: 900 }, colorScheme: theme }); p.on('pageerror', (e) => errs.push(String(e)));
    await p.goto(U + '#/home'); await p.waitForSelector('#nav a[data-tab]');
    await p.evaluate(async () => { const K = await import('/lexiko/js/know.js'); await K.setLevel(50); await K.setSetting('levelAsked', true); await K.setSetting('parseAsked', true); });
    await p.goto(U + '#/learn'); await p.waitForTimeout(150); await p.goto(U + '#/progress'); await p.waitForSelector('.legend');
    const r = await p.evaluate(() => {
      const legendEl = [...document.querySelectorAll('.legend')].find((l) => l.querySelector('i.chap'));
      const probe = (cls, el, parent) => { const x = document.createElement(el || 'span'); x.className = cls; x.textContent = '9'; x.style.position = 'absolute'; x.style.left = '-999px'; (parent || document.body).append(x); const cs = getComputedStyle(x), q = getComputedStyle(x, '::before'); const o = { bg: cs.backgroundColor, ink: cs.color, line: cs.borderTopColor, shadow: cs.boxShadow, bar: parseFloat(q.width) || 0, barShown: q.display !== 'none' }; x.remove(); return o; };
      const out = {}; for (const n of ['r0', 'r1', 'r2', 'r3', 'r4']) out[n] = { tile: probe('chap ' + n, 'a'), pill: probe('rdy ' + n), swatch: probe('chap ' + n, 'i', legendEl) };
      const legend = [...document.querySelectorAll('.legend')].find((l) => l.querySelector('i.chap'));
      out.note = /The bar under each number grows/.test(legend.parentElement.textContent);
      out.bg = getComputedStyle(document.body).backgroundColor; return out;
    });
    const num = (s) => (s.match(/[\d.]+/g) || []).slice(0, 3).map(Number), alpha = (s) => { const m = s.match(/[\d.]+/g) || []; return m.length > 3 ? +m[3] : 1; };
    const lin = (v) => { v /= 255; return v > .04045 ? Math.pow((v + .055) / 1.055, 2.4) : v / 12.92; };
    const L = (c) => { const [x, y, z] = c.map(lin); return .2126 * x + .7152 * y + .0722 * z; };
    const contrast = (a, c) => { const [h, l] = [L(a), L(c)].sort((m, n) => n - m); return (h + .05) / (l + .05); };
    const lab = (c) => { const [r, g, bb] = c.map(lin); const X = (r * .4124 + g * .3576 + bb * .1805) / .95047, Y = r * .2126 + g * .7152 + bb * .0722, Z = (r * .0193 + g * .1192 + bb * .9505) / 1.08883; const q = (t) => (t > .008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116); return [116 * q(Y) - 16, 500 * (q(X) - q(Y)), 200 * (q(Y) - q(Z))]; };
    const dE = (a, c) => Math.hypot(...a.map((v, i) => v - c[i]));
    const names = ['r0', 'r1', 'r2', 'r3', 'r4'], bg = num(r.bg);
    const fill = (n) => (alpha(r[n].tile.bg) === 0 ? bg : num(r[n].tile.bg));
    let min = 1e9; for (let i = 0; i < 5; i++) for (let j = i + 1; j < 5; j++) min = Math.min(min, dE(lab(fill(names[i])), lab(fill(names[j]))));
    ok(min >= 20, theme + ': every pair of fills differs clearly (smallest ΔE ' + min.toFixed(0) + ')');
    names.forEach((n) => ok(contrast(num(r[n].tile.ink), fill(n)) >= 4.5, theme + ': ' + n + ' number is readable (' + contrast(num(r[n].tile.ink), fill(n)).toFixed(1) + ':1)'));
    ok(alpha(r.r0.tile.bg) === 0 && alpha(r.r0.tile.line) > 0 && alpha(r.r0.pill.bg) === 0 && /inset/.test(r.r0.pill.shadow), theme + ': "Not yet" is an outlined, empty tile and badge');
    const bars = names.map((n) => r[n].tile.bar);
    ok(bars[0] === 0 && bars[1] > 0 && bars.every((w, i) => i === 0 || w > bars[i - 1]), theme + ': the bar under the number grows with the level: ' + bars.join(', '));
    ok(names.every((n) => !r[n].swatch.barShown), theme + ': the legend swatches carry no bar');
    ok(r.note, theme + ': the legend explains the bar');
    await p.close();
  }
  ok(errs.length === 0, 'no page errors: ' + errs.join(' | '));
  await b.close(); console.log(process.exitCode ? 'readiness: FAILED' : 'readiness: ok');
})();
