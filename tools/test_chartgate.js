// "Only forms from chart rows I know": rowOfTag, and the daily session leaves out forms whose master-chart row is not learned.
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(), p = await b.newPage(); const errs = [];
  p.on('pageerror', (e) => errs.push(String(e)));
  await p.goto('http://localhost:8123/lexiko/#/learn/parse'); await p.waitForTimeout(1500);
  const r = await p.evaluate(async () => {
    const F = await import('/lexiko/js/families.js'), K = await import('/lexiko/js/know.js'), P = await import('/lexiko/js/parse.js');
    const out = {};
    out.rows = [F.rowOfTag('V-2AAI-3S'), F.rowOfTag('V-1AAI-3S'), F.rowOfTag('V-PMI-1S'), F.rowOfTag('V-2FPI-1S'), F.rowOfTag('V-RAI-3S'), F.rowOfTag('V-PAN'), F.rowOfTag('N-NSM')];
    out.liq = [F.rowOfTag('V-FAI-1S', 'x'), F.rowOfTag('V-FAI-1S')];
    // pick a liquid and a non-liquid verb from the lexicon
    const lex = [...(await import('/lexiko/js/data.js')).D.lexByN.entries()].filter(([, L]) => L.pos === 'V');
    const liq = lex.find(([, L]) => F.isLiquidVerb(L && lex[0] && lex[0][0]) === false && /[λμνρ]ω$/.test(L.head.normalize('NFD').replace(/[̀-ͯ]/g, '')));
    out.liqRow = liq ? F.rowOfTag('V-FAI-1S', liq[0]) : 'none';
    // gate: off allows everything; on allows only learned rows
    K.K.settings.formsByChart = false; out.off = K.chartAllows('V-AAI-3S');
    K.K.settings.formsByChart = true; out.onUnlearned = K.chartAllows('V-1AAI-3S'); out.onSubj = K.chartAllows('V-AAS-3S');
    for (const a of K.CHART_ATTRS || ['aug','stem','form','vowel','ends']) K.K.cards.set('c:aor1-act:' + a, { id: 'c:aor1-act:' + a, state: 'review', stability: 30, reps: 3, due: Date.now() + 1e9 });
    out.onLearned = K.chartAllows('V-1AAI-3S'); out.onOther = K.chartAllows('V-FAI-3S');
    // a whole session: with the gate on and no row learned, no indicative verb form is served; with the aorist row learned, only that row's forms are
    const Dm = (await import('/lexiko/js/data.js')).D, rowsIn = (ids) => ids.map((x) => F.rowOfTag(Dm.forms[x.id].an[0].m)).filter(Boolean);
    K.K.settings.level = 0; K.K.settings.formLevel = F.NLEVELS; K.K.settings.sessionSize = 60; K.K.settings.parseNewPerDay = 60;
    for (const a of ['aug','stem','form','vowel','ends']) K.K.cards.delete('c:aor1-act:' + a);
    K.K.settings.formsByChart = true;
    const none = []; for (let i = 0; i < 6; i++) none.push(...rowsIn(P.buildParseSession({})));
    for (const a of ['aug','stem','form','vowel','ends']) K.K.cards.set('c:aor1-act:' + a, { id: 'c:aor1-act:' + a, state: 'review', stability: 30, reps: 3, due: Date.now() + 1e9 });
    const some = []; for (let i = 0; i < 6; i++) some.push(...rowsIn(P.buildParseSession({})));
    K.K.settings.formsByChart = false;
    const all = []; for (let i = 0; i < 6; i++) all.push(...rowsIn(P.buildParseSession({})));
    out.sess = { none: none.length, some: [...new Set(some)], all: [...new Set(all)].length };
    return out;
  });
  const ok = (c, m) => { if (!c) { console.log('FAIL: ' + m); process.exitCode = 1; } };
  ok(JSON.stringify(r.rows) === JSON.stringify(['aor2-act', 'aor1-act', 'pres-mp', 'fut-pas2', 'perf1-act', null, null]), 'rowOfTag ' + JSON.stringify(r.rows));
  ok(r.liq[0] === 'fut-act' || r.liq[0] === 'fut-liq-act', 'liquid arg tolerated');
  ok(r.liqRow === 'fut-liq-act' || r.liqRow === 'none', 'liquid verb future uses the liquid row: ' + r.liqRow);
  ok(r.off === true, 'off allows everything');
  ok(r.onUnlearned === false, 'on holds back an unlearned row');
  ok(r.onSubj === true, 'on leaves other moods alone');
  ok(r.onLearned === true, 'on allows a learned row');
  ok(r.onOther === false, 'on holds back another unlearned row');
  ok(r.sess.none === 0, 'gate on, no row learned: no indicative verb forms in a session (' + r.sess.none + ')');
  ok(r.sess.some.every((x) => x === 'aor1-act'), 'gate on, aorist row learned: only that row: ' + r.sess.some);
  ok(r.sess.all > 1, 'gate off: several rows come up (' + r.sess.all + ')');
  ok(!errs.length, 'page errors: ' + errs.join('|'));
  console.log(process.exitCode ? 'FAILED' : 'ALL OK'); await b.close();
})();
