// Nouns, adjectives and pronouns in parsing: always, thinned to a few check-ins a day, or off (daily quiz and free practice alike).
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(), p = await b.newPage({ viewport: { width: 390, height: 860 } }); const errs = [];
  p.on('pageerror', (e) => errs.push(String(e)));
  const ok = (c, m) => { if (!c) { console.log('FAIL: ' + m); process.exitCode = 1; } };
  const U = 'http://localhost:8123/lexiko/';
  await p.goto(U + '#/home'); await p.waitForSelector('#nav a[data-tab]');
  // a learner who knows plenty (level 50) with verbs on; some noun and verb forms already studied
  await p.evaluate(async () => {
    const K = await import('/lexiko/js/know.js'), { D } = await import('/lexiko/js/data.js'), F = await import('/lexiko/js/fsrs.js'), { store } = await import('/lexiko/js/store.js');
    await K.setLevel(50); await K.setSetting('levelAsked', true); await K.setSetting('parseAsked', true); await K.setSetting('gates', K.allGatesOpen());
    // ten noun forms of known words, each with a card that is due
    const out = []; for (const f of D.forms) { if (out.length >= 10) break; const m = f.an[0].m; if (/^N-/.test(m) && f.count > 400 && K.status(f.an[0].s) === 'known' && !D.lexByN.get(f.an[0].s).name) out.push(f); }
    for (const f of out) { const c = F.newCard(K.parseId(f)); const r = F.review(c, 3, Date.now() - 5 * 864e5, 0.9); r.due = Date.now() - 86400000 * (1 + out.indexOf(f)); r.state = 'review'; K.K.cards.set(r.id, r); await store.putCards([r]); }
  });
  await p.goto(U + '#/learn'); await p.waitForTimeout(150); await p.goto(U + '#/home'); await p.waitForTimeout(300);
  const count = (state) => p.evaluate(async (state) => {
    const K = await import('/lexiko/js/know.js'), P = await import('/lexiko/js/parse.js'), { D } = await import('/lexiko/js/data.js');
    if (state === 'off') await K.setNominals(false); else if (state === 'on') await K.setNominals(true); else { await K.setNominals(true); await K.setSetting('nomThin', true); }
    const isNoun = (id) => !D.forms[id].an[0].m.startsWith('V-');
    const plan = P.planParseSession({}), sess = P.buildParseSession({});
    const extra = ['trouble', 'review', 'recent', 'preview'].flatMap((k) => P.buildParseExtra(k));
    return { state: K.nominalState(), due: plan.due.filter((x) => isNoun(x.id)).length, fresh: plan.fresh.filter((x) => isNoun(x.id)).length, sess: sess.filter((x) => isNoun(x.id)).length, extra: extra.filter((x) => isNoun(x.id)).length, verbsSess: sess.filter((x) => !isNoun(x.id)).length };
  }, state);
  const on = await count('on'), thin = await count('thin'), off = await count('off');
  ok(on.state === 'on' && on.due + on.fresh > 3, 'on: nouns are asked as before: ' + JSON.stringify(on));
  ok(thin.state === 'thin' && thin.due + thin.fresh <= 3 && thin.sess <= 3 && thin.due >= 1, 'thin: at most three check-ins a day, the most overdue first: ' + JSON.stringify(thin));
  ok(thin.extra <= 3, 'thin: free practice follows the same check-ins: ' + JSON.stringify(thin));
  ok(off.state === 'off' && off.due === 0 && off.fresh === 0 && off.sess === 0 && off.extra === 0, 'off: nothing in the daily quiz or in free practice: ' + JSON.stringify(off));
  ok(on.verbsSess > 0 && off.verbsSess > 0, 'verbs are asked in every state');
  // the day's check-ins do not change while you answer them
  const stable = await p.evaluate(async () => {
    const K = await import('/lexiko/js/know.js'), P = await import('/lexiko/js/parse.js'), { D } = await import('/lexiko/js/data.js');
    await K.setNominals(true); await K.setSetting('nomThin', true);
    const a = P.planParseSession({}).due.map((x) => x.id).sort().join(','); const picked = K.K.settings.nomPick;
    const c = K.K.cards.get(picked.ids[0]); K.K.cards.set(c.id, { ...c, due: Date.now() + 9 * 864e5 });
    const b = P.planParseSession({}).due.map((x) => x.id).sort().join(',');
    return { same: picked.ids.length > 0 && b.split(',').length <= a.split(',').length, n: picked.ids.length };
  });
  ok(stable.same && stable.n <= 3, 'the check-ins are chosen once a day (' + stable.n + ')');
  // thinning thresholds: 30 reliable answers start it, two misses among the check-ins end it; progress is never deleted
  const th = await p.evaluate(async () => {
    const K = await import('/lexiko/js/know.js'), { D } = await import('/lexiko/js/data.js');
    await K.setNominals(true); const f = D.forms.find((f) => /^N-/.test(f.an[0].m) && K.status(f.an[0].s) === 'known' && !D.lexByN.get(f.an[0].s).name); const id = K.parseId(f);
    const r = { };
    for (let i = 0; i < 29; i++) await K.rateParse(id, 3); r.at29 = K.nominalState();
    await K.rateParse(id, 3); r.at30 = K.nominalState();
    await K.rateParse(id, 1); r.oneMiss = K.nominalState(); await K.rateParse(id, 3); await K.rateParse(id, 1); r.twoMisses = K.nominalState();
    r.card = K.K.cards.has(id);
    await K.setNominals(true); for (let i = 0; i < 20; i++) await K.rateParse(id, 3); for (let i = 0; i < 9; i++) await K.rateParse(id, 1); r.unreliable = K.nominalState();
    await K.setSetting('gates', {}); await K.setNominals(true); for (let i = 0; i < 40; i++) await K.rateParse(id, 3); r.verbsOff = K.nominalState();
    await K.setSetting('gates', K.allGatesOpen()); await K.setNominals(true);
    return r;
  });
  ok(th.at29 === 'on' && th.at30 === 'thin', 'thins after 30 reliable answers (29: ' + th.at29 + ', 30: ' + th.at30 + ')');
  ok(th.oneMiss === 'thin' && th.twoMisses === 'on', 'two missed check-ins bring them back (' + th.oneMiss + ' then ' + th.twoMisses + ')');
  ok(th.card, 'cards are kept');
  ok(th.unreliable === 'on', 'no thinning for someone who is not reliable (' + th.unreliable + ')');
  ok(th.verbsOff === 'on', 'no thinning while verb parsing is off, so a session never runs dry (' + th.verbsOff + ')');
  // levels: the two advanced levels switch them off, the others leave them on
  const lv = await p.evaluate(async () => {
    const K = await import('/lexiko/js/know.js'), r = {};
    for (const key of ['start', 'basics', 'most', 'all']) { await K.setNominals(true); await K.setParseLevel(key); r[key] = K.nominalState(); }
    await K.setNominals(true); await K.setParseLevel('basics', { merge: true }); r.mergeBasics = K.nominalState();
    await K.setParseLevel('most', { merge: true }); r.mergeMost = K.nominalState();
    await K.setNominals(true); await K.setParseLevel('basics'); await K.setSetting('gates', K.allGatesOpen());
    return r;
  });
  ok(lv.start === 'on' && lv.basics === 'on' && lv.most === 'off' && lv.all === 'off', 'levels: ' + JSON.stringify(lv));
  ok(lv.mergeBasics === 'on' && lv.mergeMost === 'off', 'an existing user who picks an advanced level gets them off: ' + JSON.stringify(lv));
  // history for an existing user: 30 reliable answers in the log start thinned, with one note on Parsing
  await p.evaluate(async () => {
    const K = await import('/lexiko/js/know.js'), { D } = await import('/lexiko/js/data.js'), { store } = await import('/lexiko/js/store.js');
    await K.setNominals(true); const f = D.forms.find((f) => /^N-/.test(f.an[0].m) && !D.lexByN.get(f.an[0].s).name); const id = K.parseId(f);
    await store.addLog(Array.from({ length: 35 }, (_, i) => ({ t: Date.now() - 1e6 + i, id, g: 3, k: 'parse' })));
    await store.set('nomAcc', undefined); K.K.nomSeed = true; await K.seedNominals();
  });
  const seeded = await p.evaluate(async () => { const K = await import('/lexiko/js/know.js'); return { st: K.nominalState(), note: K.K.settings.nomNote }; });
  ok(seeded.st === 'thin' && seeded.note === 'thin', 'existing history starts thinned: ' + JSON.stringify(seeded));
  await p.goto(U + '#/learn'); await p.waitForTimeout(150); await p.goto(U + '#/parse'); await p.waitForSelector('.links');
  ok(/Nouns, adjectives and pronouns: check-ins only\. Change/.test(await p.locator('#view').innerText()), 'Parsing says check-ins only, with a way to change it');
  await p.waitForSelector('#toasts .toast, #toasts div', { timeout: 3000 }).catch(() => {});
  ok(/only check them now and then/.test(await p.evaluate(() => (document.getElementById('toasts') || { innerText: '' }).innerText)), 'a one-time note says so');
  ok((await p.evaluate(async () => (await import('/lexiko/js/know.js')).K.settings.nomNote)) === null, 'the note is shown once');
  // Choose forms: the row, its three states, and the switch
  await p.goto(U + '#/learn'); await p.waitForTimeout(150); await p.goto(U + '#/parse/gates'); await p.waitForSelector('.cathead');
  const row = p.locator('label.li', { hasText: 'Nouns, adjectives and pronouns' });
  ok(/Check-ins only: you answer these reliably/.test(await row.innerText()) && await row.locator('input').isChecked(), 'row shows the thinned state, ticked');
  await row.locator('input').uncheck(); await p.waitForTimeout(200);
  ok(/Not asked\. Your progress on these forms is kept\./.test(await p.locator('label.li', { hasText: 'Nouns, adjectives and pronouns' }).innerText()), 'unticked: not asked');
  await p.locator('label.li', { hasText: 'Nouns, adjectives and pronouns' }).locator('input').check(); await p.waitForTimeout(200);
  ok(/Asked once you know the word/.test(await p.locator('label.li', { hasText: 'Nouns, adjectives and pronouns' }).innerText()), 'ticked again: asked in full');
  // Parsing with everything off
  await p.evaluate(async () => { const K = await import('/lexiko/js/know.js'); await K.setNominals(false); await K.setSetting('gates', {}); });
  await p.goto(U + '#/learn'); await p.waitForTimeout(150); await p.goto(U + '#/parse'); await p.waitForTimeout(500);
  const t = await p.locator('#view').innerText();
  ok(/Nouns, adjectives and pronouns: off\. Change/.test(t) && /nothing to ask yet/.test(t), 'verbs and these words both off: Parsing says there is nothing to ask yet');
  ok(errs.length === 0, 'no page errors: ' + errs.join(' | '));
  await b.close(); console.log(process.exitCode ? 'nominals: FAILED' : 'nominals: ok');
})();
