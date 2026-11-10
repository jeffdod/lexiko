// The parsing level: the first-run question, what each answer opens, the article skip, and the Choose forms page (row, group boxes, Select all / Clear all).
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const errs = [];
  const ok = (c, m) => { if (!c) { console.log('FAIL: ' + m); process.exitCode = 1; } else console.log('  ok  ' + m); };
  const U = 'http://localhost:8123/lexiko/';
  const fresh = async () => { const p = await (await b.newContext({ viewport: { width: 390, height: 860 } })).newPage(); p.on('pageerror', (e) => errs.push(String(e))); await p.goto(U); await p.waitForSelector('.welcome'); return p; };
  const level = async (p, title) => { await p.click('.choice:has-text("' + title + '")'); await p.click('button:has-text("Continue")'); };
  // 1. a beginner skips the question
  let p = await fresh();
  await level(p, 'I’m just starting'); await p.waitForSelector('h1:has-text("What do you want to work toward")');
  ok(/Step 2 of 2/.test(await p.innerText('.welcome')), 'a beginner has two steps and no parsing question');
  await p.click('button:has-text("Start with this goal")'); await p.waitForSelector('#nav a[data-tab]'); await p.waitForTimeout(500);
  let s = await p.evaluate(async () => { const K = await import('/lexiko/js/know.js'); return { pl: K.K.settings.parseLevel, v: K.verbsOn(), art: K.skipsArticle() }; });
  ok(s.pl === 'start' && !s.v && !s.art, 'beginner: parseLevel start, verbs off, article still asked ' + JSON.stringify(s));
  // 2. "I read Greek regularly" preselects "I know most forms"; each answer sets the gates
  p = await fresh();
  await level(p, 'I read Greek regularly'); await p.waitForSelector('h1:has-text("How well do you parse")');
  ok(/Step 2 of 3/.test(await p.innerText('.welcome')), 'the parsing question is step 2 of 3');
  ok((await p.getAttribute('.choice:has-text("I know most forms")', 'aria-pressed')) === 'true', '"I read Greek regularly" preselects "I know most forms"');
  await p.click('button:has-text("Continue")'); await p.waitForSelector('h1:has-text("What do you want")'); await p.click('button:has-text("‹ Back")'); await p.waitForSelector('h1:has-text("How well do you parse")');
  ok(true, 'Back from the goal step returns to the parsing question');
  await p.click('.choice:has-text("I know most forms")'); await p.click('button:has-text("Continue")'); await p.click('button:has-text("Start with this goal")'); await p.waitForSelector('#nav a[data-tab]'); await p.waitForTimeout(500);
  s = await p.evaluate(async () => { const K = await import('/lexiko/js/know.js'); return { pl: K.K.settings.parseLevel, v: K.verbsOn(), art: K.skipsArticle(), mi: K.gateOpen('mi'), rare: K.gateOpen('rare'), ptc: K.gateOpen('ptc:pres-act'), sub: K.gateOpen('sub:aor1-act'), perf: K.gateOpen('row:perf1-act') }; });
  ok(s.pl === 'most' && s.v && s.art && !s.mi && !s.rare && s.ptc && s.sub && s.perf, 'most: everything open except -μι and rare ' + JSON.stringify(s));
  p = await fresh(); await level(p, 'I know the basics'); await p.click('.choice:has-text("I know the basics")'); await p.click('button:has-text("Continue")'); await p.click('button:has-text("Start with this goal")'); await p.waitForSelector('#nav a[data-tab]'); await p.waitForTimeout(500);
  s = await p.evaluate(async () => { const K = await import('/lexiko/js/know.js'); return { pl: K.K.settings.parseLevel, v: K.verbsOn(), art: K.skipsArticle(), aor: K.gateOpen('row:aor1-mid'), fut: K.gateOpen('row:fut-act'), pas: K.gateOpen('row:aor1-pas'), perf: K.gateOpen('row:perf1-act'), ptc: K.gateOpen('ptc:pres-act'), mi: K.gateOpen('mi') }; });
  ok(s.pl === 'basics' && s.v && s.art && s.aor && s.fut && !s.pas && !s.perf && !s.ptc && !s.mi, 'basics: active and middle rows open, passives, perfects and the other families locked ' + JSON.stringify(s));
  // 3. the article is skipped unless "just starting"
  s = await p.evaluate(async () => {
    const K = await import('/lexiko/js/know.js'), P = await import('/lexiko/js/parse.js'), D = (await import('/lexiko/js/data.js')).D;
    await K.setLevel(5); const asks = () => { let n = 0; for (const sc of ['JHN', 'MAT', 'ROM']) { const bk = D.books.find((x) => x.code === sc); const ids = P.buildParseSession({ scope: { book: sc, c1: 1, v1: 1, c2: 3, v2: 999 }, kind: 'all', size: 200, newLimit: 200 }).map((x) => x.id); n += ids.filter((i) => D.forms[i].an.some((a) => a.s === 3588)).length; } return n; };
    const out = { basics: asks() }; await K.setParseLevel('start'); out.start = asks(); await K.setParseLevel('most'); out.most = asks(); return out; });
  ok(s.start > 0 && s.basics === 0 && s.most === 0, 'the article is asked only for "just starting" ' + JSON.stringify(s));
  // 4. the Choose forms row and page
  await p.evaluate(async () => { const K = await import('/lexiko/js/know.js'); await K.setParseLevel('basics'); });
  await p.goto(U + '#/home'); await p.goto(U + '#/parse'); await p.waitForSelector('a.li:has-text("Choose forms")');
  ok(/Tick or untick any type of verb form/.test(await p.innerText('a.li:has-text("Choose forms")')), 'Parsing has a "Choose forms" row in the Unlock list');
  await p.click('a.li:has-text("Choose forms")'); await p.waitForSelector('h2.cathead');
  const cat = async (t) => p.evaluate((t) => { const c = [...document.querySelectorAll('h2.cathead')].find((h) => h.textContent.trim() === t).querySelector('input'); return { c: c.checked, i: c.indeterminate }; }, t);
  let c = await cat('Indicative rows'); ok(!c.c && c.i, 'Indicative rows shows the partly ticked state under "basics"');
  c = await cat('Participles'); ok(!c.c && !c.i, 'Participles is unticked');
  await p.click('h2.cathead:has-text("Participles") input'); await p.waitForTimeout(300);
  c = await cat('Participles'); ok(c.c && !c.i, 'ticking the Participles box opens the whole group');
  ok(await p.evaluate(async () => (await import('/lexiko/js/know.js')).gateOpen('ptc:aor1-pas')), 'a participle kind is open');
  await p.click('button:has-text("Select all")'); await p.waitForTimeout(300);
  ok(await p.evaluate(async () => { const K = await import('/lexiko/js/know.js'); return K.gateOpen('mi') && K.gateOpen('rare') && K.gateOpen('imp:aor1-act') && K.gateOpen('row:perf-mp'); }), 'Select all opens every kind, -μι and rare');
  await p.click('button:has-text("Clear all")'); await p.waitForTimeout(300);
  ok(await p.evaluate(async () => { const K = await import('/lexiko/js/know.js'); return !K.gateOpen('mi') && !K.gateOpen('ptc:pres-act') && !K.gateOpen('row:aor1-act') && K.gateOpen('row:pres-act') && K.verbsOn(); }), 'Clear all closes every kind but leaves verb parsing on and present active open');
  // 5. an existing user (a level, never asked) gets the question alone, defaulting to "Leave things as they are"
  const exist = async (setup) => { const q = await (await b.newContext({ viewport: { width: 390, height: 860 } })).newPage(); q.on('pageerror', (e) => errs.push(String(e))); await q.goto(U + '#/progress'); await q.waitForSelector('#nav a[data-tab]');
    await q.evaluate(async (setup) => { const K = await import('/lexiko/js/know.js'); await K.setLevel(50); await K.setSetting('levelAsked', true); if (setup) { await K.setGate('verbs', true); await K.setGate('ptc:pres-act', true); } }, setup);
    await q.goto(U + '#/home'); await q.waitForSelector('h1:has-text("How well do you parse")'); return q; };
  let q = await exist(true);
  ok(!/Step \d/.test(await q.innerText('.welcome')) && (await q.getAttribute('.choice:has-text("Leave things as they are")', 'aria-pressed')) === 'true', 'an existing user sees the question alone, with "Leave things as they are" selected');
  ok(/Choosing anything except/.test(await q.innerText('.welcome')), 'the article note is shown');
  await q.click('button:has-text("Continue")'); await q.waitForSelector('.area'); await q.waitForTimeout(300);
  s = await q.evaluate(async () => { const K = await import('/lexiko/js/know.js'); return { pl: K.K.settings.parseLevel, asked: K.K.settings.parseAsked, v: K.verbsOn(), ptc: K.gateOpen('ptc:pres-act'), art: K.skipsArticle() }; });
  ok(s.pl == null && s.asked && s.v && s.ptc && !s.art, '"Leave things as they are" changes nothing and is remembered ' + JSON.stringify(s));
  await q.goto(U + '#/progress'); await q.goto(U + '#/home'); await q.waitForSelector('.area'); ok(true, 'the question does not come back');
  q = await exist(true);
  await q.click('.choice:has-text("I know the basics")'); await q.click('button:has-text("Continue")'); await q.waitForSelector('.area'); await q.waitForTimeout(300);
  s = await q.evaluate(async () => { const K = await import('/lexiko/js/know.js'); return { pl: K.K.settings.parseLevel, ptc: K.gateOpen('ptc:pres-act'), aor: K.gateOpen('row:aor1-act'), art: K.skipsArticle() }; });
  ok(s.pl === 'basics' && s.ptc && s.aor && s.art, 'a level only opens more: the participle gate they had stays open ' + JSON.stringify(s));
  q = await exist(false); await q.click('.choice:has-text("I’m just starting")'); await q.click('button:has-text("Continue")'); await q.waitForSelector('.area');
  ok(await q.evaluate(async () => { const K = await import('/lexiko/js/know.js'); return K.K.settings.parseLevel === 'start' && !K.skipsArticle() && K.verbAskDue(); }), '"just starting" keeps the article and the later verb question');
  q = await exist(false); await q.click('.choice:has-text("I know most forms")'); await q.click('button:has-text("Continue")'); await q.waitForSelector('.area');
  ok(await q.evaluate(async () => { const K = await import('/lexiko/js/know.js'); return K.verbsOn() && !K.verbAskDue(); }), 'a level above "just starting" turns verbs on and the "Want to practice parsing verbs?" question never appears');
  ok(errs.length === 0, 'no page errors: ' + errs.join(' | '));
  await b.close(); console.log(process.exitCode ? 'parselevel: FAILED' : 'parselevel: ok');
})();
