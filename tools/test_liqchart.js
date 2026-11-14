// The "Verb chart" button on an answer card highlights the liquid row for a liquid verb (ἀπαγγέλλω, μένω) and the regular row otherwise (λύω).
const { chromium } = require('playwright');
const ok = (c, m) => { console.log((c ? '  ok  ' : '  FAIL ') + m); if (!c) process.exitCode = 1; };
(async () => {
  const b = await chromium.launch(); const p = await b.newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(String(e)));
  await p.goto('http://localhost:8123/lexiko/#/settings'); await p.waitForSelector('#nav a[data-tab]');
  const r = await p.evaluate(async () => { const { chartRowForSlots: f } = await import('/lexiko/js/charts.js'), { D } = await import('/lexiko/js/data.js');
    const n = (head) => { for (const [k, L] of D.lexByN) if (L.head === head) return k; };
    const A = { tense: 'A', voice: 'A', mood: 'I' }, FA = { tense: 'F', voice: 'A', mood: 'I' }, FM = { tense: 'F', voice: 'M', mood: 'I' }, PA = { tense: 'P', voice: 'A', mood: 'I' }, AM = { tense: 'A', voice: 'M', mood: 'I' };
    const apang = n('ἀπαγγέλλω'), menw = n('μένω'), luw = n('λύω');
    return { ids: [apang, menw, luw], a1: f(A, apang), a2: f(A, luw), a3: f(A), f1: f(FA, menw), f2: f(FM, menw), f3: f(FA, luw), p1: f(PA, apang), m1: f(AM, apang) }; });
  ok(r.ids.every((x) => x != null), 'found the three verbs: ' + r.ids);
  ok(r.a1 === 'aor-liq-act', 'ἀπαγγέλλω aorist active -> liquid aorist row: ' + r.a1);
  ok(r.a2 === 'aor1-act' && r.a3 === 'aor1-act', 'λύω, or no verb given, -> 1st aorist row: ' + r.a2 + ', ' + r.a3);
  ok(r.f1 === 'fut-liq-act' && r.f2 === 'fut-liq-mid', 'μένω future active and middle -> liquid future rows: ' + r.f1 + ', ' + r.f2);
  ok(r.f3 === 'fut-act', 'λύω future active -> regular row: ' + r.f3);
  ok(r.p1 === 'pres-act' && r.m1 === 'aor1-mid', 'a liquid verb\'s present and aorist middle keep their regular rows (no liquid row on the chart): ' + r.p1 + ', ' + r.m1);
  ok(errs.length === 0, 'no page errors: ' + errs.join(' | '));
  await b.close(); console.log(process.exitCode ? 'liqchart: FAILED' : 'liqchart: ok');
})();
