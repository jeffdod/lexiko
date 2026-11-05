// "Hold back verbs in -μι": the daily session leaves out their forms, and they are not required of you; practice and other verbs are unaffected.
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(), p = await b.newPage(); const errs = [];
  p.on('pageerror', (e) => errs.push(String(e)));
  await p.goto('http://localhost:8123/lexiko/#/learn/parse'); await p.waitForTimeout(1500);
  const r = await p.evaluate(async () => {
    const K = await import('/lexiko/js/know.js'), P = await import('/lexiko/js/parse.js'), F = await import('/lexiko/js/families.js'), Dm = (await import('/lexiko/js/data.js')).D;
    const heads = ['δίδωμι', 'τίθημι', 'ἵστημι', 'ἀφίημι', 'δείκνυμι', 'λύω', 'λέγω', 'εἰμί'];
    const byHead = (h) => [...Dm.lexByN.entries()].find(([, L]) => L.head === h);
    const out = { is: {} };
    for (const h of heads) { const e = byHead(h); out.is[h] = e ? K.isMiVerb(e[0]) : 'missing'; }
    K.K.settings.level = 0; K.K.settings.formLevel = F.NLEVELS; K.K.settings.sessionSize = 60; K.K.settings.parseNewPerDay = 60; K.K.settings.formsByChart = false;
    const miOf = (ids) => ids.filter((x) => K.isMiVerb(Dm.forms[x.id].an[0].s)).length;
    K.K.settings.holdMi = false; let off = 0, offAll = 0; for (let i = 0; i < 8; i++) { const s = P.buildParseSession({}); off += miOf(s); offAll += s.length; }
    K.K.settings.holdMi = true; let on = 0, onAll = 0; for (let i = 0; i < 8; i++) { const s = P.buildParseSession({}); on += miOf(s); onAll += s.length; }
    const d = byHead('δίδωμι'); out.status = d ? [K.verbStatus(d[0]) === null] : null;
    K.K.settings.holdMi = false; out.statusOff = d ? K.verbStatus(d[0]) !== null : null;
    out.n = { off, offAll, on, onAll };
    return out;
  });
  const ok = (c, m) => { if (!c) { console.log('FAIL: ' + m); process.exitCode = 1; } };
  for (const h of ['δίδωμι', 'τίθημι', 'ἵστημι', 'ἀφίημι', 'δείκνυμι']) ok(r.is[h] === true, h + ' is a -μι verb: ' + r.is[h]);
  for (const h of ['λύω', 'λέγω', 'εἰμί']) ok(r.is[h] === false, h + ' is not held as -μι: ' + r.is[h]);
  ok(r.n.off > 0, 'with the setting off, -μι forms do come up (' + r.n.off + ')');
  ok(r.n.on === 0, 'with it on, none do (' + r.n.on + ')');
  ok(r.n.onAll > 0, 'with it on, sessions are still served (' + r.n.onAll + ')');
  ok(r.status && r.status[0], 'a held -μι verb is not required of you');
  ok(r.statusOff, 'off: it is required again');
  ok(!errs.length, 'page errors: ' + errs.join('|'));
  console.log(process.exitCode ? 'FAILED' : 'ALL OK'); await b.close();
})();
