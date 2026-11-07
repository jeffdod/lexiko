// Participles open only once the participle drill shows you know them. node tools/test_ptcgate.js (server on :8123)
const { chromium } = require('playwright');
const URL = 'http://localhost:8123/lexiko/';
let fails = 0; const ok = (c, m, x = '') => { console.log((c ? '  ok  ' : '  FAIL ') + m + (x ? ' ' + x : '')); if (!c) fails++; };
process.on('unhandledRejection', (e) => { console.log('UNHANDLED', e && e.message); process.exit(1); });
(async () => {
  const b = await chromium.launch(); const p = await (await b.newContext({ viewport: { width: 390, height: 844 } })).newPage(); const errs = [];
  p.on('pageerror', (e) => errs.push(e.message));
  await p.goto(URL); await p.waitForSelector('#nav a[data-tab]', { timeout: 60000 });
  const r = await p.evaluate(async () => {
    const k = await import('./js/know.js'), { store } = await import('./js/store.js'), out = {};
    out.pl = k.ptcLevel();
    await k.setSetting('formsAll', false); await k.setSetting('formLevel', 3); k.K.ptcAcc = []; k.K.famAcc = { 3: Array(20).fill(1) };
    await k.advanceLevels(); out.afterGood = k.formLevel();                              // perfect level answered well: participles still wait
    for (let i = 0; i < 14; i++) await k.noteParticiple(true); out.at14 = k.formLevel();
    const lv = await k.noteParticiple(true); out.at15 = k.formLevel(); out.opened = lv;
    // a weak drill does not open them
    await k.setSetting('formLevel', 3); k.K.ptcAcc = [];
    for (let i = 0; i < 20; i++) await k.noteParticiple(i % 2 === 0); out.weak = k.formLevel();
    // "Open it now" still works
    await k.openNextLevel(); out.manual = k.formLevel();
    // migration: open participles without drill mastery -> closed once; later opening is left alone
    k.K.ptcAcc = []; await k.setSetting('formLevel', out.pl + 1); await store.set('ptcGate', false); await k.bootParticipleGate(); out.migrated = k.formLevel();
    await k.setSetting('formLevel', out.pl); await k.bootParticipleGate(); out.second = k.formLevel();
    // show all forms is left alone
    await k.setSetting('formLevel', 1); await k.setSetting('formsAll', true); await store.set('ptcGate', false); await k.bootParticipleGate(); out.all = k.K.settings.formLevel;
    await k.setSetting('formsAll', false); await k.setSetting('formLevel', 1);
    return out;
  });
  ok(r.pl === 4, 'participles are level 4', String(r.pl));
  ok(r.afterGood === 3, 'a good perfect level alone does not open participles', String(r.afterGood));
  ok(r.at14 === 3, 'not at 14 drill answers', String(r.at14));
  ok(r.at15 === 4 && r.opened === 4, 'opens at 15 good drill answers', r.at15 + '/' + r.opened);
  ok(r.weak === 3, 'a 50% drill does not open them', String(r.weak));
  ok(r.manual === 4, 'Open it now still works', String(r.manual));
  ok(r.migrated === 3, 'old open participles are closed once', String(r.migrated));
  ok(r.second === 4, 'and only once', String(r.second));
  ok(r.all === 1, 'Show all forms is left alone', String(r.all));
  await p.evaluate(async () => { const k = await import('./js/know.js'); await k.setSetting('formLevel', 3); k.K.ptcAcc = []; });
  await p.evaluate(() => { location.hash = '#/parse'; }); await p.waitForSelector('.area, .card'); await p.waitForTimeout(500);
  await p.evaluate(() => { for (const s of document.querySelectorAll('summary')) if (/Forms you are working on/.test(s.textContent)) s.click(); }); await p.waitForTimeout(300);
  const t = await p.textContent('#view');
  ok(/Participles/.test(t) && /participle drill/.test(t), 'the card explains the participle gate');
  ok(!!(await p.$('a[href="#/learn/charts/participles/run"].btn.primary')), 'and links to the drill');
  ok(errs.length === 0, 'no page errors', errs.join('|'));
  await b.close(); console.log(fails ? fails + ' FAILED' : 'ALL OK'); process.exit(fails ? 1 : 0);
})();
