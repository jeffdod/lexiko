// Parsing: a form missed twice (or a bad streak) gets the easier "pick the whole parsing" question. node tools/test_parsetry.js (server on :8123)
const { chromium } = require('playwright');
const URL = 'http://localhost:8123/lexiko/';
let fails = 0; const ok = (c, m, x = '') => { console.log((c ? '  ok  ' : '  FAIL ') + m + (x ? ' ' + x : '')); if (!c) fails++; };
process.on('unhandledRejection', (e) => { console.log('UNHANDLED', e && e.message); process.exit(1); });
(async () => {
  const b = await chromium.launch(); const p = await (await b.newContext({ viewport: { width: 390, height: 844 } })).newPage(); const errs = [];
  p.on('pageerror', (e) => errs.push(e.message));
  const ready = async () => { await p.waitForSelector('#nav a[data-tab]', { timeout: 60000 }); await p.waitForFunction(() => !document.getElementById('loading')); };
  await p.goto(URL); await ready();
  await p.evaluate(async () => { const k = await import('./js/know.js'); await k.setLevel(500); await k.setSetting('levelAsked', true); await k.setSetting('parseAsked', true); await k.setSetting('parseMode', 'guided'); await k.setSetting('sessionSize', 1); await k.setSetting('parseNewPerDay', 5); await k.setSetting('parsePace', 'fixed'); });
  const miss = async () => { await p.click('text=I don’t know'); await p.click('.qwrap .btn.primary.block'); await p.waitForTimeout(200); };
  // a single form: missed twice, there are no other forms to leave a gap, so it is held: a note, no easy question
  await p.goto(URL + '#/parse/run/noun'); await p.reload(); await ready(); await p.waitForSelector('.pcard');
  await miss();                                                    // first try: missed
  ok(/Once more/.test(await p.textContent('.qwrap')), 'a first miss gets the usual retry');
  await p.click('text=I don’t know');
  ok(/Missed again\. That’s enough for now, so you’ll see this form again later\./.test(await p.textContent('.qwrap')) && (await p.$$('.opts .opt')).length === 0, 'missed twice with nothing else waiting: held, with a note, no easy question');
  await p.click('.qwrap .btn.primary.block'); await p.waitForTimeout(300);
  ok(!!(await p.$('.pagehead h1:has-text("complete")')), 'the session ends instead of repeating it again right away');

  // several forms: a second miss leaves a gap and comes back as the easy question
  await p.evaluate(async () => { const k = await import('./js/know.js'); await k.setSetting('sessionSize', 6); });
  await p.goto(URL + '#/parse/run/noun'); await p.reload(); await ready(); await p.waitForSelector('.pcard');
  const total = +(await p.textContent('.qcount')).split('/')[1];
  for (let i = 0; i < total; i++) await miss();                    // every first try missed
  ok(/Once more/.test(await p.textContent('.qwrap')), 'the retry round begins', 'items ' + total);
  if (total >= 4) {
    await p.click('text=I don’t know');
    ok(!/Missed again/.test(await p.textContent('.qwrap')), 'enough forms waiting: no hold note');
    await p.click('.qwrap .btn.primary.block'); await p.waitForTimeout(200);
    let found = false; for (let i = 0; i < total * 2 && !found; i++) { if (/One more try/.test(await p.textContent('.qwrap')) && (await p.$$('.opts .opt')).length === 4) found = true; else { if (await p.$('.pagehead h1:has-text("complete")')) break; await miss(); } }
    ok(found, 'the second miss comes back later in the round as four whole parsings to choose from');
    if (found) {
      const labels = await p.$$eval('.opts .opt span:first-child', (e) => e.map((x) => x.textContent));
      ok(new Set(labels).size === 4 && labels.every((l) => l.includes(' · ')), 'four different whole parsings', labels.join(' | '));
      await p.click('.opts .opt >> nth=0');
      const t = await p.textContent('.rescue-note >> nth=1');
      ok(/That’s enough for this one\. You’ll see this form again in (a minute or so|about)/.test(t), 'after answering it says when the form comes back', t.trim());
    }
  } else console.log('  (fewer than 4 forms available; rescue case skipped)', total);
  ok(errs.length === 0, 'no page errors', errs.join('|'));
  await b.close(); console.log(fails ? fails + ' FAILED' : 'ALL OK'); process.exit(fails ? 1 : 0);
})();
