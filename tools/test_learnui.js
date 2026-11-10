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
  await p.evaluate(async () => { const k = await import('./js/know.js'); await k.setLevel(300); await k.setSetting('levelAsked', true); await k.setSetting('parseAsked', true); });
  const go = async (h) => { await p.goto(URL + h); await p.reload(); await ready(); await p.waitForTimeout(300); };
  await go('#/learn');
  await p.waitForTimeout(300); ok(await p.locator('a.area').count() === 3, 'Learn opens Study with three areas');
  await go('#/learn/words'); ok(await p.locator('.start').count() === 1 && await p.locator('button:has-text("Change ›")').count() === 1, 'Vocabulary: one start button and a goal card with Change › (no goal chosen yet)');
  await p.click('button:has-text("Change ›")'); await p.waitForSelector('.goal-picker'); ok(true, 'Change › opens the picker in place');
  await p.click('button:has-text("Cancel")'); ok(await p.locator('.goal-picker').count() === 0, 'Cancel closes it');
  await go('#/learn/words');
  const v = await p.textContent('#view');
  ok(/Look ahead at new words/.test(v) && /Review what I’ve learned|Learn new words|Review words/.test(v) && /Strengthen weak spots/.test(v) && !/Study a passage|Study by how common|Options/.test(v), 'Vocabulary: start button, three links, no extra sections');
  await go('#/parse');
  const pv = await p.textContent('#view');
  ok(/Look ahead at new forms/.test(pv) && /Strengthen weak spots/.test(pv) && /Turn on verb parsing/.test(pv) && !/Study a passage|Options/.test(pv), 'Parsing: start button, links, Charts, no extra sections');
  await go('#/settings');
  const sv = await p.textContent('#view');
  ok(/Quiz style/.test(sv) && /New words per day/.test(sv) && /Pause new words/.test(sv) && /Parsing/.test(sv) && /Guided/.test(sv) && /New forms per day/.test(sv) && /Pause new forms/.test(sv), 'Settings holds pace, quiz style and Parsing style');
  await p.click('#view button:text-is("Quick")'); await p.waitForTimeout(200);
  ok(await p.evaluate(async () => (await import('./js/know.js')).setting('parseMode')) === 'quick', 'changing Parsing style in Settings is saved');
  // Settings / Progress simplification
  await go('#/settings');
  { const heads = await p.locator('#view h2, #view summary').allTextContents(); const ix = (t) => heads.findIndex((x) => x.includes(t));
    ok(ix('Your data') >= 0 && ix('Your data') < ix('Appearance') && ix('Appearance') < ix('Your level'), 'Settings: backup sits near the top', heads.join('|'));
    ok(ix('About lexiko') > ix('Install') && !(await p.locator('#view .levels').count()), 'Settings: About is a fold and the level picker starts closed'); }
  ok(/I know words used|Just starting/.test(await p.textContent('#lvl-line')), 'Settings: level shown as one line');
  await p.click('#view button:has-text("Change")'); ok(await p.locator('#view .lvl').count() > 5, 'Settings: Change opens the level picker');
  await p.evaluate(() => [...document.querySelectorAll('#view .lvl')].find((b) => b.firstChild.textContent === '100+').click()); await p.waitForTimeout(300); ok(/100\+ times/.test(await p.textContent('#lvl-line')), 'Settings: summary follows the new level', await p.textContent('#lvl-line'));
  ok(await p.locator('#view h2:text-is("Install")').count() === 1, 'Settings: Install card shown in a browser');
  { const ctx2 = await b.newContext({ viewport: { width: 420, height: 900 } }); const q = await ctx2.newPage(); await q.addInitScript(() => { Object.defineProperty(navigator, 'standalone', { get: () => true }); });
    await q.goto(URL + '#/settings'); await q.waitForSelector('#view h2'); ok(await q.locator('#view h2:text-is("Install")').count() === 0, 'Settings: Install card hidden in the installed app'); await ctx2.close(); }
  await go('#/home');
  ok(await p.locator('.kpi').count() === 0 && await p.locator('.statline').count() === 1, 'Home: the numbers are one line inside the goal card');
  ok(await p.locator('#view details.fold:not([open]) > summary:has-text("Passages within reach")').count() === 1 && await p.locator('#view details.fold:not([open]) > summary:has-text("Recent practice")').count() === 1, 'Home: By book and Recent practice start collapsed');
  ok(!/Your learning curve/.test(await p.textContent('#view')), 'Home: no empty learning-curve card');
  for (const h of ['#/learn', '#/learn/words', '#/parse', '#/settings', '#/home']) { await go(h); ok(!/(null|undefined)/.test(await p.textContent('#view')), h + ' has no stray null/undefined'); }
  { const ctx3 = await b.newContext({ viewport: { width: 420, height: 900 } }); const q = await ctx3.newPage(); await q.addInitScript(() => { Object.defineProperty(navigator, 'standalone', { get: () => true }); });
    await q.goto(URL + '#/settings'); await q.waitForSelector('#view h2');
    const vp = await q.getAttribute('meta[name=viewport]', 'content'), ta = await q.evaluate(() => getComputedStyle(document.documentElement).touchAction);
    ok(!/user-scalable=no|maximum-scale/.test(vp), 'Zoom allowed in the installed app', vp); ok(/manipulation/.test(ta), 'Double-tap zoom stays off', ta);
    const small = await q.evaluate(() => [...document.querySelectorAll('input:not([type=file]), select, textarea')].filter((e) => parseFloat(getComputedStyle(e).fontSize) < 16).length);
    ok(small === 0, 'Form fields are 16px or larger, so phones do not zoom in on focus'); await ctx3.close(); }
  ok(errs.length === 0, 'no page errors', errs.join('|'));
  await b.close(); console.log(fails ? fails + ' FAILED' : 'ALL OK'); process.exit(fails ? 1 : 0);
})();
