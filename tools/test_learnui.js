// The simplified Learn path. node tools/test_learnui.js (server on :8123)
const { chromium } = require('playwright');
const URL = 'http://localhost:8123/lexiko/';
let fails = 0; const ok = (c, m, x = '') => { console.log((c ? '  ok  ' : '  FAIL ') + m + (x ? ' ' + x : '')); if (!c) fails++; };
process.on('unhandledRejection', (e) => { console.log('UNHANDLED', e && e.message); process.exit(1); });
(async () => {
  const b = await chromium.launch(); const p = await (await b.newContext({ viewport: { width: 390, height: 844 } })).newPage(); const errs = [];
  p.on('pageerror', (e) => errs.push(e.message));
  const ready = async () => { await p.waitForSelector('#nav a[data-tab]', { timeout: 60000 }); await p.waitForFunction(() => !document.getElementById('loading')); };
  await p.goto(URL); await ready();
  await p.evaluate(async () => { const k = await import('./js/know.js'); await k.setLevel(300); await k.setSetting('levelAsked', true); });
  const go = async (h) => { await p.goto(URL + h); await p.reload(); await ready(); await p.waitForTimeout(300); };
  await go('#/learn');
  ok(await p.locator('.start').count() === 1 && await p.locator('.topics .tile').count() === 2 && await p.locator('a.tile[href="#/learn/verbs"]').count() === 1, 'Learn: one start button, two topics, a Verbs tile');
  ok(/Your goal/.test(await p.textContent('#view')) && await p.locator('button:has-text("Change ›")').count() === 1, 'Learn: a goal card with Change ›');
  await p.click('button:has-text("Change ›")'); await p.waitForSelector('.goal-picker'); ok(true, 'Change › opens the picker in place');
  await p.click('button:has-text("Cancel")'); ok(await p.locator('.goal-picker').count() === 0, 'Cancel closes it');
  await go('#/learn/words');
  const v = await p.textContent('#view');
  ok(/Look ahead at new words/.test(v) && /Review what I’ve learned|Learn new words|Review words/.test(v) && /Strengthen weak spots/.test(v) && !/Study a passage|Study by how common|Options/.test(v), 'Vocabulary: start button, three links, no extra sections');
  await go('#/parse');
  const pv = await p.textContent('#view');
  ok(/Look ahead at new forms/.test(pv) && /Strengthen weak spots/.test(pv) && /Charts/.test(pv) && !/Study a passage|Options/.test(pv), 'Parsing: start button, links, Charts, no extra sections');
  await go('#/settings');
  const sv = await p.textContent('#view');
  ok(/Quiz style/.test(sv) && /New words per day/.test(sv) && /Pause new words/.test(sv) && /Parsing/.test(sv) && /Guided/.test(sv) && /New forms per day/.test(sv) && /Pause new forms/.test(sv), 'Settings holds pace, quiz style and Parsing style');
  await p.click('#view button:text-is("Quick")'); await p.waitForTimeout(200);
  ok(await p.evaluate(async () => (await import('./js/know.js')).setting('parseMode')) === 'quick', 'changing Parsing style in Settings is saved');
  for (const h of ['#/learn', '#/learn/words', '#/parse', '#/settings']) { await go(h); ok(!/(null|undefined)/.test(await p.textContent('#view')), h + ' has no stray null/undefined'); }
  ok(errs.length === 0, 'no page errors', errs.join('|'));
  await b.close(); console.log(fails ? fails + ' FAILED' : 'ALL OK'); process.exit(fails ? 1 : 0);
})();
