// Proper names are never quizzed: a capitalized noun in the lexicon is a name (except group names), it counts as known, and the reader popup has no learn buttons for it.
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(), p = await b.newPage({ viewport: { width: 390, height: 860 } }); const errs = [];
  p.on('pageerror', (e) => errs.push(String(e)));
  const ok = (c, m) => { if (!c) { console.log('FAIL: ' + m); process.exitCode = 1; } else console.log('  ok  ' + m); };
  const U = 'http://localhost:8123/lexiko/';
  await p.goto(U + '#/home'); await p.waitForSelector('#nav a[data-tab]');
  await p.evaluate(async () => { const K = await import('/lexiko/js/know.js'); await K.setLevel(50); await K.setSetting('levelAsked', true); await K.setSetting('parseAsked', true); });
  const r = await p.evaluate(async () => {
    const k = await import('/lexiko/js/know.js'), d = await import('/lexiko/js/data.js');
    const by = (head) => d.D.lex.find((L) => L.head.startsWith(head));
    const names = d.D.lex.filter((L) => L.name), out = {};
    out.count = names.length;
    out.flags = Object.fromEntries(['Ἰησοῦς', 'Πέτρος', 'Ἱερουσαλήμ', 'Σατανᾶς', 'Ἠλί', 'Φαρισαῖος', 'Ἕλλην', 'Σαμαρείτης', 'Ἰουδαῖος', 'Ῥωμαῖος', 'Ὦ', 'λόγος'].map((h) => [h, !!by(h).name]));
    // a name never counts as unknown, whatever the level, and never appears in a session
    await k.setLevel(null); const jes = by('Ἰησοῦς'); out.statusNoLevel = k.status(jes.n);
    await k.setLevel(50);
    const ses = [...k.buildSession({ kind: 'daily', newLimit: 400 }), ...k.buildSession({ kind: 'daily' })].map((x) => x.n);
    out.nameInSession = ses.filter((n) => d.isName(n)).length;
    out.probes = k.probeCandidates(500).filter((x) => d.isName(x.n)).length;
    // a name that already has a due card is not served
    const c = { ...(await import('/lexiko/js/fsrs.js')).newCard('w:' + jes.n), state: 'review', stability: 9, reps: 3, last: Date.now() - 864e5 * 10, due: Date.now() - 864e5 };
    k.K.cards.set(c.id, c); out.dueName = k.dueCards().filter((x) => x.id === c.id).length; k.K.cards.delete(c.id);
    const unknownNames = d.D.lex.filter((L) => L.name && k.status(L.n) !== 'known').length; out.unknownNames = unknownNames;
    return out;
  });
  ok(r.count > 450 && r.count < 560, 'about 500 names in the lexicon: ' + r.count);
  const want = { 'Ἰησοῦς': true, 'Πέτρος': true, 'Ἱερουσαλήμ': true, 'Σατανᾶς': true, 'Ἠλί': true, 'Φαρισαῖος': false, 'Ἕλλην': false, 'Σαμαρείτης': false, 'Ἰουδαῖος': false, 'Ῥωμαῖος': false, 'Ὦ': false, 'λόγος': false };
  for (const [h, v] of Object.entries(want)) ok(r.flags[h] === v, h + (v ? ' is a name' : ' is a quiz word'));
  ok(r.statusNoLevel === 'known', 'a name is known even with no level');
  ok(r.nameInSession === 0, 'no name in a vocabulary session');
  ok(r.probes === 0, 'no name as a spot-check');
  ok(r.dueName === 0, 'a name with a card due is not served');
  ok(r.unknownNames === 0, 'no name counts as unknown');
  // reader: a name has no underline, and its popup has no learn buttons or status chip
  await p.evaluate(async () => { const K = await import('/lexiko/js/know.js'); await K.setLevel(null); await K.setSetting('levelAsked', true); await K.setSetting('parseAsked', true); });
  await p.goto(U + '#/home'); await p.goto(U + '#/read/MAT/1'); await p.waitForSelector('.reader .w'); await p.waitForTimeout(300);
  await p.evaluate(async () => { window.__d = await import('/lexiko/js/data.js'); });
  const under = await p.evaluate(() => { const out = []; document.querySelectorAll('.reader .w').forEach((w) => { if (window.__d.isName(+w.dataset.s)) out.push(w.className); }); return out; });
  ok(under.length > 20 && under.every((c) => !/\b(u|l)\b/.test(c)), 'names in Matthew 1 are not underlined as unknown (' + under.length + ' checked)');
  await p.evaluate(() => [...document.querySelectorAll('.reader .w')].find((w) => window.__d.isName(+w.dataset.s) && /Abraham/i.test(window.__d.D.lexByN.get(+w.dataset.s).brief)).click()); await p.waitForSelector('#pop:not([hidden])'); await p.waitForTimeout(200);
  const pop = await p.evaluate(() => document.querySelector('#pop').innerText);
  ok(/Abraham/i.test(pop) && /Strong’s/.test(pop), 'the popup for a name shows the word and its Strong’s number: ' + pop.split('\n').slice(0, 3).join(' | '));
  ok(!/I know this|Learn this|Review this|New to you|Assumed known|Learning/.test(pop), 'the popup for a name has no learn buttons or status chip');
  const rd = await p.evaluate(async () => { const k = await import('/lexiko/js/know.js'); return k.scopeReadiness({ book: 'MAT', c1: 1, v1: 1, c2: 1, v2: 999 }).known; });
  ok(rd > 0.18, 'Matthew 1 readiness counts names as known for a beginner: ' + Math.round(rd * 100) + '%');
  ok(errs.length === 0, 'no page errors: ' + errs.join(' | '));
  await b.close(); console.log(process.exitCode ? 'names: FAILED' : 'names: ok');
})();
