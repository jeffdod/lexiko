// Home dashboard: Study tab, customizing Home (show/hide/reorder, saved, reset), Progress redirect.
const { chromium } = require('playwright');
let bad = 0; const ok = (c, m) => { console.log((c ? '  ok  ' : '  FAIL ') + m); if (!c) { bad++; process.exitCode = 1; } };
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 390, height: 860 } });
  const errs = []; p.on('pageerror', (e) => errs.push(String(e)));
  const U = 'http://localhost:8123/lexiko/';
  await p.goto(U + '#/settings'); await p.waitForSelector('#nav a[data-tab]');
  await p.evaluate(async () => { const K = await import('/lexiko/js/know.js'); await K.setLevel(50); await K.setSetting('levelAsked', true); await K.setSetting('parseAsked', true); await K.setGoal({ kind: 'freq', min: 30 }); });
  await p.goto(U + '#/home'); await p.waitForSelector('.goalnum');
  ok((await p.$$eval('#nav a', (a) => a.map((x) => x.textContent.trim()))).join() === 'Home,Study,Read,Settings', 'the bar is Home, Study, Read, Settings');
  const heads = () => p.evaluate(() => [...document.querySelectorAll('#view .stack > *')].map((e) => (e.querySelector('summary') ? e.querySelector('summary').textContent : e.querySelector('h2, .glabel, b') ? (e.querySelector('h2, .glabel, b').textContent) : '').trim()).filter(Boolean));
  const h0 = await heads();
  ok(h0.indexOf('Start here') === 0 && /GOAL|Goal/.test(h0[1]) && h0.includes('Good next reads') && h0.includes('Passages within reach · By book') && h0.includes('Recent practice'), 'Home: Start here, Goal, Good next reads, then the folds ' + JSON.stringify(h0));
  ok(await p.locator('.statline').count() === 1 && await p.locator('.kpi').count() === 0, 'the numbers are one line inside the goal card');
  ok(await p.locator('.reads .li').count() === 2, 'Good next reads shows two rows');
  await p.click('.reads button:has-text("More")'); ok(await p.locator('.reads .li').count() > 2, 'More › opens the rest in place');
  // customize: move Goal down, hide Recent practice
  await p.click('a[aria-label="Customize Home"]'); await p.waitForSelector('h1:has-text("Customize Home")');
  ok(await p.locator('.cz input[type=checkbox]').count() === 7, 'seven sections can be shown or hidden (Verse of the day is the one that starts off); Start here has no checkbox');
  await p.click('button[aria-label="Move Goal down"]'); await p.click('input[aria-label="Show Recent practice"]');
  await p.click('#nav a[data-tab=home]'); await p.waitForSelector('.reads');
  const h1 = await heads();
  ok(h1.indexOf('Good next reads') < h1.findIndex((x) => /GOAL|Goal/.test(x)) && !h1.includes('Recent practice'), 'Home follows the choice: Goal moved down, Recent practice hidden ' + JSON.stringify(h1));
  await p.reload(); await p.waitForSelector('.reads');
  ok(!(await heads()).includes('Recent practice'), 'the choice survives a reload');
  const saved = await p.evaluate(async () => { const K = await import('/lexiko/js/know.js'); return [K.K.settings.homeOrder.join(), K.K.settings.homeHidden.join()]; });
  ok(saved[0].startsWith('continue,reads,goal') && saved[1] === 'recent', 'saved in the settings ' + JSON.stringify(saved));
  await p.goto(U + '#/home/customize'); await p.waitForSelector('.cz'); await p.click('button:has-text("Reset to default")'); await p.waitForTimeout(200);
  ok(await p.locator('.cz input:checked').count() === 6 && (await p.locator('.cz b').allInnerTexts()).join() === 'Start here,Continue reading,Goal,Good next reads,Growth,Passages within reach,Recent practice,Verse of the day', 'Reset to default restores every section (Verse of the day stays off) and the order');
  // Study and the old Progress route
  await p.goto(U + '#/study'); await p.waitForSelector('.area'); ok(await p.locator('a.area').count() === 4 && /Study/.test(await p.textContent('h1')), 'Study has Vocabulary, Parsing, Reference and Glossary');
  ok((await p.locator('a.area').last().textContent()).startsWith('Glossary'), 'Glossary is the bottom tile');
  await p.click('a.area[href="#/search"]'); await p.waitForSelector('#sq'); ok((await p.getAttribute('.pagehead a.btn.ghost', 'href')) === '#/study', 'the Glossary arrow goes back to Study');
  await p.goto(U + '#/study'); await p.click('a.area[href="#/reference"]'); await p.waitForSelector('a.area[href="#/learn/charts"]'); ok(await p.locator('a[href="#/search"], input[type=search]').count() === 0, 'Reference has no Glossary row or search box (one way in)');
  ok(await p.getAttribute('#nav a[data-tab=study]', 'aria-current') === 'page', 'Study is the current tab');
  await p.goto(U + '#/parse'); await p.waitForSelector('.pagehead'); ok(await p.getAttribute('#nav a[data-tab=study]', 'aria-current') === 'page', 'Parsing sits under the Study tab');
  await p.goto(U + '#/home'); await p.goto(U + '#/progress'); await p.waitForSelector('.goalnum'); ok((await p.evaluate(() => location.hash)) === '#/home', '#/progress opens Home');
  ok(errs.length === 0, 'no page errors ' + errs.join('|'));
  await b.close(); console.log(bad ? 'dashboard: FAILED' : 'dashboard: ok');
})();
