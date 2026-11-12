// Verbs are taught like any other word: nothing about verb forms or Parsing holds them back, and there is no one-in-four quota.
const { chromium } = require('playwright');
const URL = 'http://localhost:8123/lexiko/';
let bad = 0; const ok = (c, m, x) => { console.log((c ? 'ok   ' : 'FAIL ') + m + (c || x === undefined ? '' : ' ' + JSON.stringify(x))); if (!c) bad++; };
(async () => {
  const b = await chromium.launch(), p = await (await b.newContext({ viewport: { width: 390, height: 844 } })).newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  await p.goto(URL + '#/home'); await p.waitForTimeout(2000);
  const MIN = 100;
  // A profile like the reported one: level 150, goal "100 or more times", every non-verb goal word known, the goal's verbs not started,
  // eight other verbs already begun with none of their forms learned, and poor recent verb-form answers
  const s = await p.evaluate(async (MIN) => {
    const k = await import('/lexiko/js/know.js'), { D } = await import('/lexiko/js/data.js'), F = await import('/lexiko/js/fsrs.js');
    k.K.cards.clear(); await k.setLevel(150); await k.setSetting('levelAsked', true); await k.setSetting('parseAsked', true); await k.setSetting('gates', { verbs: true }); await k.setSetting('newPerDay', 30);
    await k.setGoal({ kind: 'freq', min: MIN });
    const card = (n) => k.K.cards.set('w:' + n, { ...F.newCard('w:' + n), state: 'review', stability: 30, reps: 5, last: Date.now(), due: Date.now() + 30 * 864e5 });
    const inGoal = D.lex.filter((L) => L.freq >= MIN && L.freq < 150 && !L.name);
    inGoal.filter((L) => !L.verb).forEach((L) => card(L.n));
    let c = 0; for (const L of D.lex) { if (L.verb && L.freq >= 150 && c < 8 && k.verbStatus(L.n)) { card(L.n); c++; } }
    k.K.verbAcc = Array(20).fill(0);
    const unlearned = k.startedVerbs().filter((n) => { const v = k.verbStatus(n); return v && !v.learned; }).length;
    const sess = k.buildSession({}), news = sess.filter((x) => x.type === 'new').map((x) => D.lexByN.get(x.n));
    return { goalVerbs: inGoal.filter((L) => L.verb).length, unlearned, next: k.goalNext(k.currentGoal(), 50).length, news: news.length, newVerbs: news.filter((L) => L.verb).length, offGoal: news.filter((L) => L.freq < MIN).length,
      gone: ['verbBrake', 'admitVerbs', 'unlearnedVerbs', 'goalHeld'].filter((f) => typeof k[f] !== 'undefined') };
  }, MIN);
  ok(s.unlearned > 5 && s.goalVerbs > 3, 'the situation: more than 5 verbs unlearned, poor verb-form answers, only verbs left in the goal', s);
  ok(s.next > 3 && s.newVerbs > 1, 'verbs are taught anyway, and more than one a day (no quota)', s);
  ok(s.news > 0 && s.offGoal === 0, 'every new word is from the goal', s);
  ok(s.gone.length === 0, 'the brake, the quota and the hold code are gone', s.gone);
  await p.goto(URL + '#/learn/words'); await p.waitForTimeout(800);
  let t = await p.locator('#view').innerText();
  ok(!/paused|so new words wait|Other words keep coming/.test(t), 'the Vocabulary page has no pause note', t.slice(0, 300));
  await p.goto(URL + '#/learn/verbs'); await p.waitForTimeout(800);
  t = await p.locator('#view').innerText();
  ok(/Verbs are taught like any other word/.test(t) && !/paused/.test(t), 'the Verbs page says verbs are taught like any other word', t.slice(0, 300));
  // a goal with nothing left to start still carries on with the commonest unknown words
  const f = await p.evaluate(async (MIN) => { const k = await import('/lexiko/js/know.js'), { D } = await import('/lexiko/js/data.js'), F = await import('/lexiko/js/fsrs.js');
    for (const L of D.lex) if (L.freq >= MIN && L.freq < 150 && L.verb) k.K.cards.set('w:' + L.n, { ...F.newCard('w:' + L.n), state: 'review', stability: 30, reps: 5, last: Date.now(), due: Date.now() + 30 * 864e5 });
    return { next: k.goalNext(k.currentGoal(), 50).length, fallback: k.newWordsFor(k.currentGoal(), 6).length }; }, MIN);
  ok(f.next === 0 && f.fallback > 0, 'a finished goal still carries on with the commonest unknown words', f);
  ok(errs.length === 0, 'no page errors', errs);
  await b.close(); process.exit(bad ? 1 : 0);
})();
