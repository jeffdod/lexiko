// A goal whose remaining words are all paused verbs: no words outside the goal are taught in their place, and the Vocabulary page says why.
const { chromium } = require('playwright');
const URL = 'http://localhost:8123/lexiko/';
let bad = 0; const ok = (c, m, x) => { console.log((c ? 'ok   ' : 'FAIL ') + m + (c || x === undefined ? '' : ' ' + JSON.stringify(x))); if (!c) bad++; };
(async () => {
  const b = await chromium.launch(), p = await (await b.newContext({ viewport: { width: 390, height: 844 } })).newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  await p.goto(URL + '#/home'); await p.waitForTimeout(2000);
  const MIN = 100;
  // A profile like the one reported: level 150, goal "100 or more times", every non-verb goal word known, the goal's verbs not started, and more than 5 other verbs still being learned
  const setup = (mode) => p.evaluate(async ([MIN, mode]) => {
    const k = await import('/lexiko/js/know.js'), { D } = await import('/lexiko/js/data.js'), F = await import('/lexiko/js/fsrs.js');
    k.K.cards.clear(); await k.setLevel(150); await k.setSetting('levelAsked', true); await k.setSetting('parseAsked', true); await k.setSetting('gates', { verbs: true });
    await k.setGoal({ kind: 'freq', min: MIN });
    const card = (n) => k.K.cards.set('w:' + n, { ...F.newCard('w:' + n), state: 'review', stability: 30, reps: 5, last: Date.now(), due: Date.now() + 30 * 864e5 });
    const inGoal = D.lex.filter((L) => L.freq >= MIN && L.freq < 150 && !L.name);
    inGoal.filter((L) => !L.verb).forEach((L) => card(L.n));
    if (mode === 'finished') inGoal.filter((L) => L.verb).forEach((L) => card(L.n));
    if (mode !== 'brakeoff') { let c = 0; for (const L of D.lex) { if (L.verb && L.freq >= 150 && c < 8 && k.verbStatus(L.n)) { card(L.n); c++; } } }
    return { verbsInGoal: inGoal.filter((L) => L.verb).length };
  }, [MIN, mode]);
  const probe = () => p.evaluate(async (MIN) => {
    const k = await import('/lexiko/js/know.js'), { D } = await import('/lexiko/js/data.js');
    const g = k.currentGoal(), sess = k.buildSession({}), news = sess.filter((x) => x.type === 'new').map((x) => D.lexByN.get(x.n).freq);
    return { braked: k.verbBrake().braked, goalNext: k.goalNext(g, 50).length, held: k.goalHeld(g), newWords: news, offGoal: news.filter((f) => f < MIN).length, viaHelper: k.newWordsFor(g, 6).length };
  }, MIN);
  const note = async () => { await p.goto(URL + '#/home'); await p.waitForTimeout(200); await p.goto(URL + '#/learn/words'); await p.waitForTimeout(800); return p.locator('#view').innerText(); };

  const s = await setup('held'); const a = await probe();
  ok(s.verbsInGoal > 0 && a.braked && a.goalNext === 0 && a.held > 0, 'the situation: verb brake on, only paused verbs left in the goal', [s, a]);
  ok(a.newWords.length === 0 && a.viaHelper === 0, 'no new words at all, and none from outside the goal', a);
  let t = await note();
  ok(/The rest of your goal \(\d+ words?\) is verbs, so new words wait until these settle/.test(t) && !/Other words keep coming/.test(t), 'the Vocabulary page says why', t.slice(0, 400));

  await setup('finished'); const f = await probe();
  ok(f.goalNext === 0 && f.held === 0, 'a goal with nothing left to start');
  ok(f.viaHelper > 0, 'then the commonest unknown words still carry on (as before)', f);

  await setup('brakeoff'); const o = await probe();
  ok(!o.braked && o.goalNext > 0 && o.newWords.length > 0 && o.offGoal === 0, 'brake off: the goal’s words are taught', o);
  t = await note();
  ok(!/The rest of your goal/.test(t), 'no note when new words are flowing');
  ok(errs.length === 0, 'no page errors', errs);
  await b.close(); process.exit(bad ? 1 : 0);
})();
