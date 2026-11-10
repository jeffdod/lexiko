// Principal parts data and answer choices, and that the practice pages open: node tools/test_parts.js  (server must be running on :8123)
const { chromium } = require('playwright');
const out = process.env.SHOTS || '/tmp/lexiko-shots-parts'; require('fs').mkdirSync(out, { recursive: true });
const URL = 'http://localhost:8123/lexiko/';
let fails = 0; const ok = (c, m, x = '') => { console.log((c ? '  ok  ' : '  FAIL ') + m + (x ? ' ' + x : '')); if (!c) fails++; };
process.on('unhandledRejection', () => {});
(async () => {
  const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, colorScheme: 'dark' });
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', (e) => errs.push(e.message)); p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
  await p.goto(URL); await p.waitForSelector('#nav a[data-tab]', { timeout: 60000 });
  await p.evaluate(async () => { const k = await import('./js/know.js'); await k.setLevel(100); await k.setSetting('levelAsked', true); await k.setSetting('parseAsked', true); });

  // ---- data + option generators
  const r = await p.evaluate(async () => {
    const parts = await import('./js/parts.js'), { D } = await import('./js/data.js'), charts = await import('./js/charts.js');
    const el = [...parts.eligible().values()]; let bad = 0, short = 0, verbBad = 0, n = 0;
    for (let i = 0; i < el.length; i += 7) { const e = el[i]; for (let s = 1; s < 6; s++) if (e.parts[s]) { n++;
      const o = parts.recallOptions(e, s); if (new Set(o).size !== o.length || !o.includes(e.parts[s])) bad++; if (o.length < 4) short++; }
      const v = parts.verbOptions(e); if (v.length !== 4 || new Set(v.map((x) => x.n)).size !== 4 || !v.some((x) => x.n === e.n)) verbBad++; }
    const rows = { 'ἐλύθην': charts.chartRowFor(5, 'ἐλύθην'), 'ἐγράφην': charts.chartRowFor(5, 'ἐγράφην'), 'ἔλυσα': charts.chartRowFor(2, 'ἔλυσα'), 'ἔμεινα': charts.chartRowFor(2, 'ἔμεινα'), 'ἔβαλον': charts.chartRowFor(2, 'ἔβαλον'), 'ἐγενόμην': charts.chartRowFor(2, 'ἐγενόμην'), 'λέλυκα': charts.chartRowFor(3, 'λέλυκα'), 'γέγονα': charts.chartRowFor(3, 'γέγονα'), 'μενῶ': charts.chartRowFor(1, 'μενῶ'), 'λύσω': charts.chartRowFor(1, 'λύσω'), 'λύσομαι': charts.chartRowFor(1, 'λύσομαι') };
    return { total: D.parts.size, eligible: el.length, n, bad, short, verbBad, rows };
  });
  console.log(JSON.stringify(r));
  ok(r.total > 1700 && r.eligible > 1000, 'parts data loaded', r.total + '/' + r.eligible);
  ok(r.bad === 0 && r.verbBad === 0, 'answer choices unique and contain the right answer');
  ok(r.short < r.n * 0.02, 'nearly always four form choices', r.short + ' of ' + r.n + ' short');
  ok(r.rows['ἐλύθην'] === 'aor1-pas' && r.rows['ἐγράφην'] === 'aor2-pas' && r.rows['ἔλυσα'] === 'aor1-act' && r.rows['ἔμεινα'] === 'aor-liq-act' && r.rows['ἔβαλον'] === 'aor2-act' && r.rows['ἐγενόμην'] === 'aor2-mid' && r.rows['λέλυκα'] === 'perf1-act' && r.rows['γέγονα'] === 'perf2-act' && r.rows['μενῶ'] === 'fut-liq-act' && r.rows['λύσω'] === 'fut-act', 'chart rows picked correctly');
  for (const u of ['#/parts', '#/parse', '#/home']) { await p.goto(URL + u); await p.waitForTimeout(600); }
  ok(errs.length === 0, 'no console/page errors', errs.slice(0, 3).join(' | '));
  await b.close(); console.log(fails ? 'FAILED ' + fails : 'ALL PASSED'); process.exit(fails ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
