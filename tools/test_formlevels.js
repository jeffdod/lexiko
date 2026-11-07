// Verb-form levels: gating, unlocking, rationing, Show all forms. node tools/test_formlevels.js (server on :8123)
const { chromium } = require('playwright');
const URL = 'http://localhost:8123/lexiko/';
let fails = 0; const ok = (c, m, x = '') => { console.log((c ? '  ok  ' : '  FAIL ') + m + (x ? ' ' + x : '')); if (!c) fails++; };
process.on('unhandledRejection', (e) => { console.log('UNHANDLED', e && e.message); process.exit(1); });
(async () => {
  const b = await chromium.launch(); const p = await (await b.newContext({ viewport: { width: 390, height: 844 } })).newPage(); const errs = [];
  p.on('pageerror', (e) => errs.push(e.message));
  const ready = async () => { await p.waitForSelector('#nav a[data-tab]', { timeout: 60000 }); await p.waitForFunction(() => !document.getElementById('loading')); };
  await p.goto(URL); await ready();
  await p.evaluate(async () => { const k = await import('./js/know.js'); await k.setLevel(100); await k.setSetting('levelAsked', true); });
  const T = await p.evaluate(async () => { const f = await import('./js/families.js'); return { a: f.levelOfTag('V-PAI-3S'), b: f.levelOfTag('V-AMI-1S'), c: f.levelOfTag('V-PPI-3S'), d: f.levelOfTag('V-AOI-3S') === undefined, e: f.levelOfTag('V-RAI-1S'), g: f.levelOfTag('V-2APP-NSM'), later: f.laterOrder(), names: [1, 2, 3, 4, 5, 6, 7].map(f.levelName), d1: f.levelOfTag('V-AAP-NSM'), imp: f.levelOfTag('V-PAM-2S'), sub: f.levelOfTag('V-AAS-3S'), inf: f.levelOfTag('V-PAN'), fut: f.levelOfTag('V-FPI-3S') }; });
  ok(T.a === 1 && T.b === 1 && T.c === 2 && T.e === 3 && T.fut === 2, 'levels: indicative active/middle 1, passive 2, perfect 3', JSON.stringify([T.a, T.b, T.c, T.e, T.fut]));
  ok(T.later.length === 4 && T.d1 >= 4 && T.imp >= 4 && T.sub >= 4 && T.inf >= 4 && new Set([T.d1, T.imp, T.sub, T.inf]).size === 4, 'levels: infinitive, participle, subjunctive, imperative are 4 to 7', JSON.stringify(T.later));
  ok(T.names.every((n) => /\w/.test(n)) && T.names[0].includes('active'), 'level names', T.names.join(' | '));

  // gating of what a session serves
  const g = await p.evaluate(async () => {
    const k = await import('./js/know.js'), P = await import('./js/parse.js'), D = (await import('./js/data.js')).D, F = await import('./js/families.js');
    const lvl = (id) => F.levelOfTag(D.forms[id].an[0].m), verbLv = (id) => { const t = D.forms[id].an[0].m; return /^V-/.test(t) ? lvl(id) : 0; };
    const out = {}; await k.setSetting('formsAll', false); await k.setSetting('formLevel', 1);
    let max = 0, nv = 0; for (let i = 0; i < 30; i++) for (const x of P.planParseSession({}).fresh) { const l = verbLv(x.id); if (l) nv++; max = Math.max(max, l); }
    out.max1 = max; out.nv = nv;
    await k.setSetting('formsAll', true); let max2 = 0; for (let i = 0; i < 30; i++) for (const x of P.planParseSession({}).fresh) max2 = Math.max(max2, verbLv(x.id)); out.maxAll = max2;
    await k.setSetting('formsAll', false);
    // a due card of a locked form is hidden, and the due count agrees
    const FF = await import('./js/fsrs.js'); let lockedId = D.forms.findIndex((f) => f.an[0] && /^V-.APN?/.test(f.an[0].m) && F.levelOfTag(f.an[0].m) === 5 && f.count > 20);
    if (lockedId < 0) lockedId = D.forms.findIndex((f) => f.an[0] && F.levelOfTag(f.an[0].m) >= 4);
    const cid = k.parseId(D.forms[lockedId]); k.K.cards.set(cid, { ...FF.newCard(cid), state: 'review', stability: 1, reps: 3, last: Date.now() - 864e5 * 5, due: Date.now() - 864e5 });
    const before = P.parseDueCount(); const inPlan = P.planParseSession({}).due.some((x) => x.id === D.forms[lockedId].id);
    await k.setSetting('formsAll', true); const after = P.parseDueCount(); await k.setSetting('formsAll', false); k.K.cards.delete(cid);
    out.dueHidden = before === 0 && !inPlan; out.dueShown = after === 1;
    return out; });
  ok(g.nv > 0 && g.max1 === 1, 'new forms: only level 1 verb forms at the start', JSON.stringify([g.max1, g.nv]));
  ok(g.maxAll >= 4, 'Show all forms brings back every level', 'max ' + g.maxAll);
  ok(g.dueHidden && g.dueShown, 'a due card of a locked form is hidden, and the due count agrees; Show all forms restores it');

  // unlocking from accuracy
  const u = await p.evaluate(async () => {
    const k = await import('./js/know.js'); const out = {}; k.K.famAcc = {}; await k.setSetting('formLevel', 1);
    for (let i = 0; i < 14; i++) await k.noteFamily(1, true); out.at14 = k.K.settings.formLevel;
    await k.noteFamily(1, true); out.at15 = k.K.settings.formLevel;
    k.K.famAcc = {}; await k.setSetting('formLevel', 1);
    for (let i = 0; i < 20; i++) await k.noteFamily(1, i % 3 !== 0); out.weak = k.K.settings.formLevel;                 // about 67% right
    await k.openNextLevel(); out.manual = k.K.settings.formLevel;
    k.K.famAcc = {}; await k.setSetting('formLevel', 7); await k.openNextLevel(); out.cap = k.K.settings.formLevel; await k.setSetting('formLevel', 1); k.K.famAcc = {};
    return out; });
  ok(u.at14 === 1 && u.at15 === 2, 'opens the next level after 15 answers at 85% or better', JSON.stringify(u));
  ok(u.weak === 1, 'stays closed at about 67%'); ok(u.manual === 2 && u.cap === 7, 'Open it now opens the next level, never past the last');

  // a verb's learned status ignores forms of locked levels
  const v = await p.evaluate(async () => {
    const k = await import('./js/know.js'), S = await import('./js/stems.js'), D = (await import('./js/data.js')).D, F = await import('./js/families.js');
    await k.setSetting('formsAll', false); await k.setSetting('formLevel', 1);
    let found = null; for (const L of D.lex.filter((l) => l.pos === 'V').slice(0, 300)) { const rs = S.requiredStems(L.n); if (!rs) continue; const hi = rs.stems.flatMap((s) => s.forms).some((f) => F.levelOfTag(D.forms[f.rows[0]].an[0].m) > 1); if (hi) { found = L.n; break; } }
    const a = k.verbStatus(found).total; await k.setSetting('formsAll', true); const bAll = k.verbStatus(found).total; await k.setSetting('formsAll', false);
    return { found, a, bAll }; });
  ok(v.found && v.a < v.bAll, 'a verb needs fewer forms until higher levels open', JSON.stringify(v));

  // bootstrap from the review log
  const bt = await p.evaluate(async () => {
    const k = await import('./js/know.js'), P = await import('./js/parse.js'), S = await import('./js/store.js'), D = (await import('./js/data.js')).D, F = await import('./js/families.js');
    const ids = []; for (const f of D.forms) { if (f.an[0] && /^V-/.test(f.an[0].m) && F.levelOfTag(f.an[0].m) === 1 && f.count > 5) ids.push(k.parseId(f)); if (ids.length >= 20) break; }
    await S.store.addLog(ids.map((id, i) => ({ t: Date.now() - 1e6 + i, id, g: 3, k: 'parse', ms: 1 })));
    k.K.famAcc = {}; await k.setSetting('formLevel', 1); await S.store.set('famInit', undefined); await P.bootFamilies();
    return { level: k.K.settings.formLevel, n: (k.K.famAcc[1] || []).length }; });
  ok(bt.level >= 2 && bt.n >= 15, 'boot: past answers in the log count toward unlocking', JSON.stringify(bt));

  // the page
  await p.evaluate(async () => { const k = await import('./js/know.js'); k.K.famAcc = {}; await k.setSetting('formLevel', 1); await k.setSetting('formsAll', false); });
  await p.goto(URL + '#/settings'); await p.goto(URL + '#/parse'); await p.reload(); await ready(); await p.waitForSelector('summary:has-text("Forms you are working on")'); await p.click('summary:has-text("Forms you are working on")');
  ok(await p.locator('.chip.accent').count() === 1 && /Next:/.test(await p.textContent('#view')), 'Parsing page lists open kinds and the next one', (await p.locator('.chip.accent').allTextContents()).join(','));
  await p.click('button:text-is("Open it now")'); await p.waitForTimeout(300);
  ok(await p.locator('.chip.accent').count() === 2, 'Open it now adds the next kind');
  await p.goto(URL + '#/settings'); await p.waitForSelector('b:text-is("Show all forms")'); await p.locator('div:has(> div > b:text-is("Show all forms")) button:text-is("On")').click(); await p.waitForTimeout(250);
  ok(await p.evaluate(async () => (await import('./js/know.js')).K.settings.formsAll) === true, 'Settings: Show all forms switches on');
  await p.goto(URL + '#/parse'); await p.waitForTimeout(500); await p.click('summary:has-text("Forms you are working on")'); ok(/Show all forms is on/.test(await p.textContent('#view')), 'Parsing page says everything is open');
  ok(!/(null|undefined)/.test(await p.textContent('#view')), 'no stray null/undefined');
  ok(errs.length === 0, 'no page errors', errs.join('|'));
  await b.close(); console.log(fails ? fails + ' FAILED' : 'ALL OK'); process.exit(fails ? 1 : 0);
})();
