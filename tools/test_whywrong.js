// "Where did this go wrong?" fold: the wrong answer is shown as a real form of the SAME verb, no gloss, only the first wrong part is explained.
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(), p = await b.newPage({ viewport: { width: 390, height: 860 } }); const errs = [];
  p.on('pageerror', (e) => errs.push(String(e)));
  const ok = (c, m) => { if (!c) { console.log('FAIL: ' + m); process.exitCode = 1; } };
  const U = 'http://localhost:8123/lexiko/';
  await p.goto(U + '#/home'); await p.waitForSelector('#nav a[data-tab]');
  const r = await p.evaluate(async () => {
    const M = await import('/lexiko/js/parse-model.js'), { D } = await import('/lexiko/js/data.js'), W = await import('/lexiko/js/whywrong.js');
    const out = { cases: [] };
    // an aorist passive indicative of a verb that also has a present passive form in the text; answer "Imperfect" (tense wrong)
    let n = 0;
    for (let i = 0; i < D.forms.length && n < 40; i++) {
      const f = D.forms[i]; if (f.an[0].m !== 'V-API-3S') continue;
      const it = M.buildItem(M.mergeForms(D.forms, [i])); if (!it) continue;
      const res = M.check(it, { tense: 'I', voice: 'P', mood: 'I', person: '3', number: 'S' });
      const el = W.whyWrong(it, res); n++;
      const got = W.findForm(it.strongs, W.answeredSlots(res.best, 'tense', 'I'), it.form.plain);
      out.cases.push({ quiz: f.plain, shown: !!el, text: el ? el.textContent : '', got: got ? got.f.plain : null, gotTag: got ? got.tag : null, sameVerb: got ? got.f.an.some((a) => a.s === it.strongs) : null, gloss: el ? /[A-Za-z]{4,} [a-z]+ /.test(el.querySelector('.whyword') ? el.querySelector('.whyword').textContent : '') : null });
    }
    const it0 = M.buildItem(M.mergeForms(D.forms, [D.forms.findIndex((f) => f.an[0].m === 'V-API-3S')]));
    out.full = W.whyWrong(it0, M.check(it0, { tense: 'A', voice: 'P', mood: 'I', person: '3', number: 'S' }));      // a right answer: no fold
    out.dk = W.whyWrong(it0, M.check(it0, {}));                                                                      // "I don't know": no fold
    return out;
  });
  const withWord = r.cases.filter((c) => c.got);
  ok(r.cases.length > 5 && withWord.length > 0, 'some missed aorists have a same-verb imperfect to show (' + withWord.length + '/' + r.cases.length + ')');
  ok(withWord.every((c) => c.sameVerb && /^V-I/.test(c.gotTag) && c.got !== c.quiz), 'the shown word is a form of the same verb, tagged imperfect, and differs from the quiz word');
  ok(withWord.every((c) => /You answered/.test(c.text) && /This word/.test(c.text) && /What to look for/.test(c.text) && /; an? imperfect/.test(c.text)), 'three blocks and a rule naming the row they chose');
  ok(r.cases.filter((c) => !c.got).every((c) => /no form like that/.test(c.text)), 'no attested form: says so, shows no word');
  ok(r.full === null && r.dk === null, 'no fold for a right answer or an empty answer');

  // the live feedback screen: closed fold under the chips, opens to three blocks
  await p.evaluate(async () => { const K = await import('/lexiko/js/know.js'); await K.setLevel(50); await K.setSetting('levelAsked', true); await K.setSetting('gates', K.allGatesOpen()); });
  await p.goto(U + '#/home'); await p.waitForTimeout(150); await p.goto(U + '#/parse/run/row/aor1-pas'); await p.waitForSelector('.qwrap');
  let saw = false;
  for (let i = 0; i < 150 && !saw; i++) {
    const s = await p.evaluate(() => ({ fold: !!document.querySelector('details.whyfold'), fb: !!document.querySelector('.fb'), popts: document.querySelectorAll('.popt:not([disabled])').length, opt: document.querySelectorAll('.opt:not([disabled])').length, cont: !!document.querySelector('.qwrap button.primary') }));
    if (s.fold) { saw = true; const d = p.locator('details.whyfold'); ok(!(await d.evaluate((e) => e.open)), 'fold is closed by default'); await d.locator('summary').click();
      const t = await d.innerText(); ok(/You answered/i.test(t) && /This word/i.test(t), 'opens to the blocks: ' + t.slice(0, 80)); await p.screenshot({ path: process.env.SHOT || '/tmp/whywrong.png' }); break; }
    if (s.fb) { await p.locator('.qwrap button.primary').first().click(); await p.waitForTimeout(300); continue; }
    if (s.opt && !s.popts) { await p.locator('.opt:not([disabled])').first().click(); await p.waitForTimeout(400); }
    else if (s.popts) { await p.locator('.popt:not([disabled])').last().click(); await p.waitForTimeout(400); }
    else if (s.cont) { await p.locator('.qwrap button.primary').first().click(); await p.waitForTimeout(300); }
    else await p.waitForTimeout(250);
  }
  if (!saw) console.log((await p.evaluate(() => document.body.innerText)).slice(0, 500));
  ok(saw, 'reached a missed verb feedback with the fold');
  ok(errs.length === 0, 'no page errors: ' + errs.join(' | '));
  await b.close(); console.log(process.exitCode ? 'whywrong: FAILED' : 'whywrong: ok');
})();
