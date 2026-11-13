// A participle's other cases, genders and numbers join the new forms only after its nominative masculine singular is known.
const { chromium } = require('playwright');
const ok = (c, m) => { console.log((c ? '  ok  ' : '  FAIL ') + m); if (!c) process.exitCode = 1; };
(async () => {
  const b = await chromium.launch(); const p = await b.newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(String(e)));
  await p.goto('http://localhost:8123/lexiko/#/settings'); await p.waitForSelector('#nav a[data-tab]');
  const sim = (extra) => p.evaluate(async (extra) => {
    const K = await import('/lexiko/js/know.js'), { D } = await import('/lexiko/js/data.js'), pa = await import('/lexiko/js/parse.js'), F = await import('/lexiko/js/fsrs.js');
    await K.setLevel(500); await K.setSetting('levelAsked', true); await K.setSetting('parseAsked', true); await K.setSetting('gates', K.allGatesOpen());
    const part = (f) => { const t = (f.an[0].m || '').split('-'); return t[0] === 'V' && /P$/.test(t[1] || '') && /^[NGDAV][SP][MFN]$/.test(t[2] || '') ? t[2] : null; };
    if (extra) { const now = Date.now(); for (const f of D.forms) if (part(f) === 'NSM') { const id = K.parseId(f); K.K.cards.set(id, { ...F.newCard(id), state: 'review', stability: 30, reps: 5, last: now - 864e5 * 3, due: now + 864e5 * 20 }); } }
    const seen = {}; for (let i = 0; i < 120; i++) for (const it of pa.buildParseSession({ kind: 'all', size: 40, newLimit: 40 })) { const q = it.type === 'new' ? part(D.forms[it.id]) : null; if (q) seen[q] = (seen[q] || 0) + 1; }
    return seen; }, extra);
  const before = await sim(false);
  const keys = Object.keys(before);
  ok(keys.length > 0 && keys.every((q) => q === 'NSM' || q === 'NPM'), 'before: only nominative masculine participles are new: ' + JSON.stringify(before));
  const after = await sim(true);
  const other = Object.keys(after).filter((q) => !/^N[SP]M$/.test(q));
  ok(other.length >= 2 && other.some((q) => q[0] !== 'N'), 'after the nominative masculine singular is known, other cases appear: ' + JSON.stringify(after));
  ok(errs.length === 0, 'no page errors: ' + errs.join(' | '));
  await b.close(); console.log(process.exitCode ? 'ptccases: FAILED' : 'ptccases: ok');
})();
