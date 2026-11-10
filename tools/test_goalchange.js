// A goal you chose is not replaced by one tap on "Make this my goal" in the reader: it asks first, and "Keep my goal" is the default.
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const errs = [];
  const ok = (c, m) => { if (!c) { console.log('FAIL: ' + m); process.exitCode = 1; } else console.log('  ok  ' + m); };
  const U = 'http://localhost:8123/lexiko/';
  const p = await (await b.newContext({ viewport: { width: 390, height: 860 } })).newPage(); p.on('pageerror', (e) => errs.push(String(e)));
  await p.goto(U + '#/home'); await p.waitForSelector('#nav a[data-tab]');
  const set = (g) => p.evaluate(async (g) => { const K = await import('/lexiko/js/know.js'); await K.setLevel(5); await K.setSetting('levelAsked', true); await K.setSetting('parseAsked', true); await K.setGoal(g); }, g);
  const goal = () => p.evaluate(async () => { const K = await import('/lexiko/js/know.js'); return K.K.goal; });
  const open = async () => { await p.goto(U + '#/home'); await p.goto(U + '#/read/JHN/3'); await p.waitForSelector('.reader .w'); await p.waitForSelector('button:has-text("Make this my goal")'); };
  // 1. no goal chosen: one tap sets it, no question
  await set(null); await open(); await p.click('button:has-text("Make this my goal")'); await p.waitForTimeout(400);
  ok(!(await p.locator('dialog.ask').count()) && (await goal())?.kind === 'passage', 'with no goal chosen, one tap sets the chapter as the goal');
  // 2. a chosen goal: asks first
  await set({ kind: 'freq', min: 30 }); await open(); await p.click('button:has-text("Make this my goal")'); await p.waitForSelector('dialog.ask[open]');
  const txt = await p.innerText('dialog.ask');
  ok(/Replace your goal\?/.test(txt) && /Words occurring 30 or more times/.test(txt) && /John 3/.test(txt) && /Your word progress stays/.test(txt), 'the question names the current goal and the new one: ' + txt.replace(/\n+/g, ' | '));
  ok((await goal()).kind === 'freq', 'the goal has not changed while the question is open');
  ok(await p.evaluate(() => document.activeElement.textContent.trim() === 'Keep my goal'), '"Keep my goal" is the focused button');
  await p.click('dialog.ask button:has-text("Keep my goal")'); await p.waitForTimeout(300);
  ok(!(await p.locator('dialog.ask').count()) && (await goal()).kind === 'freq' && (await goal()).min === 30, 'Keep my goal changes nothing');
  await p.click('button:has-text("Make this my goal")'); await p.waitForSelector('dialog.ask[open]'); await p.keyboard.press('Escape'); await p.waitForTimeout(300);
  ok((await goal()).kind === 'freq', 'Escape changes nothing');
  await p.click('button:has-text("Make this my goal")'); await p.waitForSelector('dialog.ask[open]'); await p.click('dialog.ask button:has-text("Replace goal")'); await p.waitForTimeout(400);
  const g = await goal(); ok(g.kind === 'passage' && g.book === 'JHN' && g.c1 === 3, 'Replace goal makes the chapter the goal');
  ok(await p.locator('.chip.good:has-text("Your goal")').count() === 1, 'the chapter now shows "Your goal"');
  // 3. an older saved passage goal (no kind) also asks
  await set({ book: 'MAT', c1: 1, v1: 1, c2: 1, v2: 25 }); await open(); await p.click('button:has-text("Make this my goal")'); await p.waitForSelector('dialog.ask[open]');
  ok(/Matthew 1/.test(await p.innerText('dialog.ask')), 'an older saved goal is named too');
  ok(errs.length === 0, 'no page errors: ' + errs.join(' | '));
  await b.close(); console.log(process.exitCode ? 'goalchange: FAILED' : 'goalchange: ok');
})();
