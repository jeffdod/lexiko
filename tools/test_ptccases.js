// A participle's other cases, genders and numbers join the new forms only after its nominative masculine singular is known.
const { chromium } = require('playwright');
const ok = (c, m) => { console.log((c ? '  ok  ' : '  FAIL ') + m); if (!c) process.exitCode = 1; };
(async () => {
  const b = await chromium.launch(); const p = await b.newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(String(e)));
  await p.goto('http://localhost:8123/lexiko/#/settings'); await p.waitForSelector('#nav a[data-tab]');
  const sim = (extra, rounds = 1) => p.evaluate(async ([extra, rounds]) => {
    const K = await import('/lexiko/js/know.js'), { D } = await import('/lexiko/js/data.js'), pa = await import('/lexiko/js/parse.js'), F = await import('/lexiko/js/fsrs.js');
    await K.setLevel(500); await K.setSetting('levelAsked', true); await K.setSetting('parseAsked', true); await K.setSetting('gates', K.allGatesOpen());
    const part = (f) => { const t = (f.an[0].m || '').split('-'); return t[0] === 'V' && /P$/.test(t[1] || '') && /^[NGDAV][SP][MFN]$/.test(t[2] || '') ? t[2] : null; };
    if (extra) { const now = Date.now(); for (const f of D.forms) if (part(f) === 'NSM') { const id = K.parseId(f); K.K.cards.set(id, { ...F.newCard(id), state: 'review', stability: 30, reps: 5, last: now - 864e5 * 3, due: now + 864e5 * 20 }); } }
    const seen = {};
    for (let r = 0; r < rounds; r++) { const got = [];      // each round: serve some sessions, then treat what was served as met, as a learner answering them would
      for (let i = 0; i < 30; i++) for (const it of pa.buildParseSession({ kind: 'all', size: 40, newLimit: 40 })) { const q = it.type === 'new' ? part(D.forms[it.id]) : null; if (q) { seen[q] = (seen[q] || 0) + 1; got.push(it.id); } }
      const now = Date.now(); for (const id of new Set(got)) { const cid = K.parseId(D.forms[id]); K.K.cards.set(cid, { ...F.newCard(cid), state: 'review', stability: 30, reps: 5, last: now - 864e5, due: now + 864e5 * 20 }); } }
    return seen; }, [extra, rounds]);
  const before = await sim(false);
  const beforeCells = Object.keys(before).length;
  const keys = Object.keys(before);
  ok(keys.length > 0 && keys.length <= 3, 'before: only a few participle forms are new (required forms only): ' + JSON.stringify(before));
  const after = await sim(true, 12);
  const other = Object.keys(after).filter((q) => !/^N[SP]M$/.test(q));
  ok(other.length >= 2 && other.some((q) => q[0] !== 'N'), 'after the nominative masculine singular is known, other cases appear: ' + JSON.stringify(after));
  const cells = Object.keys(after), fem = cells.filter((q) => q[2] === 'F').length, neu = cells.filter((q) => q[2] === 'N').length;
  ok(cells.length >= 8 && fem >= 2 && neu >= 2, 'the new participles cover many cells, feminine and neuter included: ' + cells.length + ' cells, ' + fem + ' feminine, ' + neu + ' neuter');
  ok(errs.length === 0, 'no page errors: ' + errs.join(' | '));
  await b.close(); console.log(process.exitCode ? 'ptccases: FAILED' : 'ptccases: ok');
})();
