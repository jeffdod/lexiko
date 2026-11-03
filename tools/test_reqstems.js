// Required stems: node tools/test_reqstems.js  (server must be running on :8123)
const { chromium } = require('playwright');
const URL = 'http://localhost:8123/lexiko/';
let fails = 0; const ok = (c, m, x = '') => { console.log((c ? '  ok  ' : '  FAIL ') + m + (x ? ' ' + x : '')); if (!c) fails++; };
(async () => {
  const b = await chromium.launch(); const p = await (await b.newContext()).newPage(); const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  await p.goto(URL); await p.waitForSelector('#nav a[data-tab]', { timeout: 60000 });
  const r = await p.evaluate(async () => {
    const s = await import('./js/stems.js'), { D } = await import('./js/data.js');
    const tags = { P: s.stemOf('V-PAI-3S'), I: s.stemOf('V-IAI-3S'), F: s.stemOf('V-FAI-3S'), Fp: s.stemOf('V-FPI-3S'), A: s.stemOf('V-AAI-3S'), Am: s.stemOf('V-AMI-3S'), Ap: s.stemOf('V-API-3S'), Ao: s.stemOf('V-AOI-3S'), R: s.stemOf('V-RAI-3S'), Rp: s.stemOf('V-RPI-3S'), L: s.stemOf('V-LAI-3S'), n: s.stemOf('N-NSM') };
    const verbs = D.lex.filter((L) => L.pos === 'V'); let withReq = 0, bad = 0, lowCover = 0, dist = {}, tot = 0, covTot = 0, mostForms = 0, noForms = 0, minimal = 0;
    for (const L of verbs) {
      const q = s.requiredStems(L.n); if (!q) continue; withReq++;
      if (q.share < 0.85) lowCover++;
      dist[q.stems.length] = (dist[q.stems.length] || 0) + 1; tot += q.total; covTot += q.covered;
      const sorted = q.stems.every((x, i) => i === 0 || q.stems[i - 1].count >= x.count);
      // fewest: dropping the last stem must go under 85% (else a smaller set would do)
      const last = q.stems[q.stems.length - 1]; if (q.stems.length > 1 && (q.covered - last.count) / q.total >= 0.85) minimal++;
      if (!sorted) bad++;
      for (const x of q.stems) { if (!x.forms.length) noForms++; if (x.forms.length > 3) mostForms++; }
    }
    return { tags, verbs: verbs.length, withReq, bad, lowCover, minimal, dist, share: covTot / tot, noForms, mostForms, ex: ['3056', '1510', '2316'].map(() => null) };
  });
  console.log(JSON.stringify(r));
  ok(r.tags.P === 0 && r.tags.I === 0 && r.tags.F === 1 && r.tags.Fp === 5 && r.tags.A === 2 && r.tags.Am === 2 && r.tags.Ap === 5 && r.tags.Ao === 5 && r.tags.R === 3 && r.tags.Rp === 4 && r.tags.L === 3 && r.tags.n === null, 'tags map to the right stem');
  ok(r.withReq > 1700, 'nearly every verb has required stems', r.withReq + ' of ' + r.verbs);
  ok(r.lowCover === 0, 'each verb\'s required stems cover at least 85%');
  ok(r.minimal === 0 && r.bad === 0, 'the fewest stems, most frequent first');
  ok(r.noForms === 0 && r.mostForms === 0, 'every required stem has 1–3 forms');
  ok(errs.length === 0, 'no page errors', errs.join(' | ').slice(0, 160));
  await b.close(); console.log(fails ? fails + ' FAILED' : 'all ok'); process.exit(fails ? 1 : 0);
})();
