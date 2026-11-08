// "Done for today": the day's due set and new-word allowance are fixed; extra work is something the learner asks for with a button.
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(), p = await b.newPage({ viewport: { width: 390, height: 860 } }); const errs = [];
  p.on('pageerror', (e) => errs.push(String(e)));
  const ok = (c, m) => { if (!c) { console.log('FAIL: ' + m); process.exitCode = 1; } };
  const U = 'http://localhost:8123/lexiko/';
  await p.goto(U + '#/home'); await p.waitForSelector('#nav a[data-tab]');
  await p.evaluate(async () => { const K = await import('/lexiko/js/know.js'); await K.setLevel(50); await K.setSetting('levelAsked', true); });
  const r = await p.evaluate(async () => {
    const k = await import('/lexiko/js/know.js'), F = await import('/lexiko/js/fsrs.js'), S = await import('/lexiko/js/smart.js'), { todayKey } = await import('/lexiko/js/util.js');
    const out = {}, now = Date.now(), DAY = 864e5, mk = (n, o) => { const c = { ...F.newCard('w:' + n), state: 'review', stability: 5, reps: 3, ...o }; k.K.cards.set(c.id, c); return c; };
    const d = (k.K.daily[todayKey()] ||= {}); delete d.wc; delete d.wcm; delete d.more; d.n = 0;
    // two words due since yesterday (not yet reviewed today); two words seen earlier today and due again in a minute; one due tomorrow
    mk(1510, { last: now - 3 * DAY, due: now - DAY }); mk(3004, { last: now - 3 * DAY, due: now - DAY });
    mk(2316, { last: now - 1000, due: now - 1000 }); mk(1722, { last: now - 2000, due: now - 500 }); mk(1063, { last: now - 1000, due: now + DAY });
    out.due = k.dueCards().map((c) => c.id).sort();
    out.more = S.moreReady('words');
    // the allowance is fixed for the day: first look pins it; finishing reviews does not raise it
    k.K.wordsAcc = Array(20).fill(0).map((_, i) => i % 2);       // 50% right: new words slowed
    delete d.wc; const slow = k.wordsPace().n; k.K.wordsAcc = []; out.pin = [slow, k.wordsPace().n];
    // asking for more opens everything due now and another daily allowance
    const before = k.wordsPace().left; await k.unlockMore();
    out.after = { due: k.dueCards().map((c) => c.id).sort(), gain: k.wordsPace().left - before, unlocked: k.moreUnlocked() };
    for (const id of ['w:1510', 'w:3004', 'w:2316', 'w:1722', 'w:1063']) k.K.cards.delete(id);
    delete d.more; delete d.wc; delete d.wcm; d.n = 0;
    return out;
  });
  ok(JSON.stringify(r.due) === '["w:1510","w:3004"]', 'only words not yet reviewed today count as due: ' + JSON.stringify(r.due));
  ok(r.more.reviews === 2 && r.more.fresh === 10, 'extra ready = the two seen-today words + a daily allowance of new words: ' + JSON.stringify(r.more));
  ok(r.pin[0] < 10 && r.pin[1] === r.pin[0], 'the allowance stays pinned for the day: ' + JSON.stringify(r.pin));
  ok(r.after.unlocked && r.after.due.length === 4 && r.after.gain === 10, 'Study more today: everything due now counts and 10 more new words open: ' + JSON.stringify(r.after));

  // the page: nothing due, today's new words used up -> done card + button that starts a session
  await p.evaluate(async () => {
    const k = await import('/lexiko/js/know.js'), F = await import('/lexiko/js/fsrs.js'), { todayKey } = await import('/lexiko/js/util.js'), now = Date.now();
    await k.setSetting('wordsPace', 'fixed'); const d = (k.K.daily[todayKey()] ||= {}); d.n = 10; delete d.more; delete d.wc; delete d.wcm;
    const c = { ...F.newCard('w:2316'), state: 'review', stability: 5, reps: 3, last: now - 1000, due: now - 1000 }; k.K.cards.set(c.id, c);
    await k.store?.set?.('daily', k.K.daily);
  });
  await p.goto(U + '#/home'); await p.waitForTimeout(150); await p.goto(U + '#/learn/words'); await p.waitForSelector('h1,.pagehead');
  const t = await p.locator('body').innerText();
  ok(/You’re done for today\./.test(t) && /Want to keep going\?/.test(t), 'the Vocabulary page shows the done card and the offer: ' + t.slice(0, 200).replace(/\n/g, '|'));
  ok(/1 more word is ready to review: words you saw earlier today that are due again\. You can also add 10 more new words\./.test(t), 'exact wording with one word: ' + t.slice(0, 400).replace(/\n/g, '|'));
  const btn = p.locator('button.btn.primary.block:has-text("Study 11 more words")');
  ok(await btn.count() === 1, 'one button with the total'); await p.screenshot({ path: process.env.SHOT || '/tmp/donetoday.png' });
  const box = await btn.evaluate((e) => { const r = document.createRange(); r.selectNodeContents(e); const a = r.getBoundingClientRect(), c = e.getBoundingClientRect(); return [(a.top + a.bottom) / 2 - (c.top + c.bottom) / 2, (a.left + a.right) / 2 - (c.left + c.right) / 2]; });
  ok(Math.abs(box[0]) <= 2 && Math.abs(box[1]) <= 2, 'button text is centered ' + JSON.stringify(box));
  await btn.click(); await p.waitForSelector('.qcard', { timeout: 8000 }); ok(/#\/learn\/daily/.test(p.url()), 'the button starts the daily session');
  ok(errs.length === 0, 'no page errors: ' + errs.join(' | '));
  await b.close(); console.log(process.exitCode ? 'donetoday: FAILED' : 'donetoday: ok');
})();
