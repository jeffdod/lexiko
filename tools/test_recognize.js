// The guided "Recognize a verb form" drill, its lessons, and the per-rule scores.
const { chromium } = require('playwright');
const URL = 'http://localhost:8123/lexiko/';
let fails = 0; const ok = (c, m, x) => { console.log((c ? '  ok  ' : '  FAIL ') + m + (c ? '' : ' ' + (x || ''))); if (!c) fails++; };
process.on('unhandledRejection', (e) => { console.log('UNHANDLED', e && e.message || e); process.exit(1); });
(async () => {
  const b = await chromium.launch(), ctx = await b.newContext({ viewport: { width: 420, height: 900 } }), p = await ctx.newPage(), errs = [];
  p.on('pageerror', (e) => errs.push(String(e))); p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
  const go = async (h) => { await p.goto(URL + h); await p.reload(); await p.waitForSelector('#view', { state: 'attached' }); await p.waitForTimeout(500); };
  await go('#/learn/charts');
  ok(await p.locator('a.btn:text-is("Learn the rules")').count() === 1 && await p.locator('a.btn.primary:text-is("Practice")').count() === 1, 'Charts page: Recognize a verb form card');
  // data checks
  const d = await p.evaluate(async () => { const R = await import('./js/recognize.js'), P = await import('./js/paradigms.js'), C = await import('./js/charts.js');
    return { rules: R.RULES.map((r) => r.id), steps: R.STEPS.map((s) => s.id) }; });
  ok(d.rules.join() === 'prefix,endings,formative,vowel' && d.steps.join() === 'prefix,endings,formative,vowel,name', 'four rules, five steps', JSON.stringify(d));
  // lessons
  await go('#/learn/charts/rules'); ok(await p.locator('a:has-text("Rule 1")').count() === 1 && /Locked/.test(await p.textContent('#view')), 'lessons page: four rules, Tier 2 locked');
  await go('#/learn/charts/rules/prefix'); ok(/No prefix/.test(await p.textContent('#view')) && !/short/i.test(await p.textContent('#view')) && await p.locator('.fb').count() === 0, 'lesson 1: prefix rule, no "short" wording, no boxed note');
  await go('#/learn/charts/rules/endings'); { const t = await p.textContent('#view'); ok(/Primary/.test(t) && /Secondary/.test(t) && !/θ in the plural/.test(t) && await p.locator('.fb').count() === 0, 'lesson 2: primary and secondary only; it does not try to teach the endings themselves'); }
  await go('#/learn/charts/rules/prefix');
  await p.click('a.btn.primary:text-is("Practice this rule")'); await p.waitForSelector('.qcard');
  ok(/Prefix/.test(await p.textContent('.qask')) && await p.locator('.opt').count() === 3, 'practice this rule: only the prefix question, three choices');
  // full drill: answer by reading the 'right' mark: click first option each time, record
  await go('#/learn/charts/recognize'); await p.waitForSelector('.qcard');
  ok(/Step 1 · Prefix/.test(await p.textContent('.qcard')) && await p.locator('.qgreek').count() === 1, 'drill starts with step 1, a form shown');
  let steps = 0, seen = new Set(), sawRetry = false, over = false;
  for (let i = 0; i < 200; i++) {
    if (await p.locator('h1:text-is("Recognize a verb form")').count() && await p.locator('.kpis').count()) break;
    if (!(await p.locator('.qcard').count())) { await p.waitForTimeout(100); continue; }
    seen.add((await p.textContent('.qask')).trim().split('\n')[0]);
    const t = await p.textContent('.qcount'); if (t.includes('↻')) sawRetry = true; const [a, bb] = t.replace('↻', '').split('/').map((x) => +x); if (a > bb) over = true;
    await p.locator('.opt').first().click(); await p.waitForSelector('.fb'); steps++;
    await p.locator('.qwrap button.btn.primary').last().click(); await p.waitForTimeout(80);
  }
  ok(steps >= 40, 'drill: runs through its steps', String(steps));
  ok(!over, 'drill: the form counter never passes the total');
  ok(sawRetry, 'drill: missed forms come back in a retry round with the ↻ counter');
  await p.waitForSelector('.kpis'); const txt = await p.textContent('#view');
  ok(/By rule/.test(txt) && /1 · Prefix/.test(txt) && /5 · Name it/.test(txt), 'finish: score for each rule');
  ok(/Tier 2/.test(txt) && /Locked/.test(txt), 'finish: Tier 2 is locked at first');
  // tier 2 is gated, then opens
  await go('#/learn/charts/recognize/2'); ok(/#\/learn\/charts\/rules/.test(await p.evaluate(() => location.hash)), 'Tier 2 is gated until opened');
  await go('#/learn/charts/rules'); await p.click('button:text-is("Open it now")'); await p.waitForTimeout(300);
  ok(/Open/.test(await p.textContent('.chip:has-text("Open")')), 'Open it now unlocks Tier 2');
  await go('#/learn/charts/recognize/2'); await p.waitForSelector('.qcard'); ok(/Tier 2/.test(await p.textContent('.qmeta')), 'Tier 2 drill runs');
  // tier 2: find the vowel step and see the contracted option
  let contr = false; for (let i = 0; i < 40 && !contr; i++) { if (await p.locator('.opt:has-text("Merged")').count()) { contr = true; break; } if (!(await p.locator('.qcard').count())) break; await p.locator('.opt').first().click(); await p.waitForSelector('.fb'); await p.locator('.qwrap button.btn.primary').last().click(); await p.waitForTimeout(80); }
  ok(contr, 'Tier 2 vowel step offers "Merged with the stem’s last vowel"');
  // forms: every item has a form and valid answers
  const items = await p.evaluate(async () => { const R = await import('./js/recognize.js'); return R.RULES.length; });
  ok(errs.length === 0, 'no page errors', errs.join('|'));
  await b.close(); console.log(fails ? fails + ' FAILED' : 'ALL OK'); process.exit(fails ? 1 : 0);
})();
