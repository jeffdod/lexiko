// Middle and passive spelled alike (present, imperfect, perfect, pluperfect): "Middle or passive" is accepted, the other voice is not.
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(), p = await b.newPage({ viewport: { width: 390, height: 860 } }); const errs = [];
  p.on('pageerror', (e) => errs.push(String(e)));
  const ok = (c, m) => { if (!c) { console.log('FAIL: ' + m); process.exitCode = 1; } };
  const U = 'http://localhost:8123/lexiko/';
  await p.goto(U + '#/home'); await p.waitForSelector('#nav a[data-tab]');
  const r = await p.evaluate(async () => {
    const M = await import('/lexiko/js/parse-model.js'), { D } = await import('/lexiko/js/data.js');
    const idOf = (w, tag) => D.forms.findIndex((f) => f.w.replace(/­/g, '') === w && f.an[0].m === tag);
    const item = (id) => M.buildItem(M.mergeForms(D.forms, [id]));
    const out = {};
    const ans = (o) => ({ tense: 'P', voice: 'P', mood: 'I', person: '3', number: 'S', ...o });
    const e = idOf('ἐγείρεται', 'V-PPI-3S'); const it = item(e);
    out.exact = M.check(it, ans({})).full;
    out.mp = M.check(it, ans({ voice: 'E' }));
    out.mpSoft = out.mp.perSlot.voice.soft; out.mpFull = out.mp.full;
    out.wrongVoice = M.check(it, ans({ voice: 'M' })).full;      // the text says passive, so middle is not accepted
    out.active = M.check(it, ans({ voice: 'A' })).full;
    // a middle-tagged present form: passive is not accepted, "Middle or passive" is
    const mid = D.forms.findIndex((f) => f.an[0].m === 'V-PMI-3S');
    const im = item(mid); out.midExact = M.check(im, ans({ voice: 'M' })).full; out.midE = M.check(im, ans({ voice: 'E' })).full; out.midP = M.check(im, ans({ voice: 'P' })).full;
    // an aorist passive differs from the aorist middle, so "Middle or passive" is NOT accepted
    const ap = D.forms.findIndex((f) => f.an[0].m === 'V-API-3S'); const ia = item(ap);
    out.aorE = M.check(ia, ans({ tense: 'A', voice: 'E' })).full; out.aorP = M.check(ia, ans({ tense: 'A', voice: 'P' })).full;
    // helper
    out.same = [M.sameSpelledMP({ tense: 'P', voice: 'P' }), M.sameSpelledMP({ tense: 'I', voice: 'M' }), M.sameSpelledMP({ tense: 'R', voice: 'P' }), M.sameSpelledMP({ tense: 'L', voice: 'M' }), M.sameSpelledMP({ tense: 'A', voice: 'P' }), M.sameSpelledMP({ tense: 'F', voice: 'M' }), M.sameSpelledMP({ tense: 'P', voice: 'A' })];
    // deponent and RP-"E" behavior is unchanged
    out.dep = [M.voiceOK('M', 'D', 'P'), M.voiceOK('P', 'O', 'P'), M.voiceOK('P', 'E', 'P'), M.voiceOK('A', 'E', 'P'), M.voiceOK('E', 'D', 'P')];
    return out;
  });
  ok(r.exact && r.mpFull && r.mpSoft, 'ἐγείρεται: the text voice and "Middle or passive" are both correct (' + JSON.stringify([r.exact, r.mpFull, r.mpSoft]) + ')');
  ok(!r.wrongVoice && !r.active, 'the other voice and Active are wrong');
  ok(r.midExact && r.midE && !r.midP, 'middle-tagged form: Middle and Middle-or-passive right, Passive wrong ' + JSON.stringify([r.midExact, r.midE, r.midP]));
  ok(!r.aorE && r.aorP, 'aorist passive: "Middle or passive" is not accepted ' + JSON.stringify([r.aorE, r.aorP]));
  ok(JSON.stringify(r.same) === '[true,true,true,true,false,false,false]', 'same-spelling helper: ' + JSON.stringify(r.same));
  ok(JSON.stringify(r.dep) === '[true,true,true,false,false]', 'deponent / RP "E" rules unchanged: ' + JSON.stringify(r.dep));

  // the feedback screen: note, open verse, chip
  await p.evaluate(async () => { const K = await import('/lexiko/js/know.js'); await K.setLevel(50); await K.setSetting('levelAsked', true); await K.setSetting('gates', K.allGatesOpen()); });
  await p.goto(U + '#/home'); await p.waitForTimeout(150); await p.goto(U + '#/parse/run/row/pres-mp'); await p.waitForSelector('.qwrap');
  // walk the quiz: verb questions get any answer; at the voice step of a parse pick "Middle or passive"; then read the feedback
  let saw = false;
  for (let i = 0; i < 150 && !saw; i++) {
    const s = await p.evaluate(() => ({ ask: (document.querySelector('.qask') || {}).textContent, cur: (document.querySelector('.pslot.cur') || {}).textContent, popts: document.querySelectorAll('.popt:not([disabled])').length, fb: (document.querySelector('.fb') || {}).textContent || '', cont: !!document.querySelector('.qwrap button.primary') }));
    if (s.fb && s.ask === 'Parse this word' && !/V-[PIRL][MP][A-Z]-/.test(s.fb)) { await p.locator('.qwrap button.primary').first().click(); await p.waitForTimeout(300); continue; }      // a deponent or other form: next question
    if (s.fb && s.ask === 'Parse this word') { saw = true; ok(/Accepted: middle and passive are spelled the same in the present, imperfect and perfect\. The Greek text marks it (passive|middle) here\. The verse is what tells them apart\./.test(s.fb), 'feedback note: ' + s.fb.slice(0, 300)); ok(await p.locator('details.ctxfold[open]').count() === 1 || !(await p.locator('details.ctxfold').count()), 'the verse is open in the feedback'); ok(/Voice\s*Middle or passive/i.test(s.fb.replace(/\s+/g, ' ')), 'the voice chip shows "Middle or passive"'); break; }
    if (s.popts) { const vs = /Voice/.test(s.cur || ''); await (vs ? p.locator('.popt:has-text("Middle or passive")') : p.locator('.popt:not([disabled])').first()).click(); await p.waitForTimeout(450); }
    else if (s.cont) { await p.locator('.qwrap button.primary').first().click(); await p.waitForTimeout(300); }
    else await p.waitForTimeout(300);
  }
  ok(saw, 'reached a parse feedback screen');
  ok(errs.length === 0, 'no page errors: ' + errs.join(' | '));
  await b.close(); console.log(process.exitCode ? 'samevoice: FAILED' : 'samevoice: ok');
})();
