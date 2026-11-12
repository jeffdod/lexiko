// The arrow on a screen a bottom-bar tab reopened (Study opening Vocabulary) goes to that tab's own first screen, not to the tab you came from.
const { chromium } = require('playwright');
const URL = 'http://localhost:8123/lexiko/';
let bad = 0; const ok = (c, m, x) => { console.log((c ? 'ok   ' : 'FAIL ') + m + (c || x === undefined ? '' : ' ' + JSON.stringify(x))); if (!c) bad++; };
(async () => {
  const b = await chromium.launch(), p = await (await b.newContext({ viewport: { width: 390, height: 844 } })).newPage();
  p.setDefaultTimeout(8000); const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  const fresh = async () => { await p.goto(URL + '#/home'); await p.reload(); await p.waitForTimeout(2200);
    await p.evaluate(async () => { const k = await import('/lexiko/js/know.js'); await k.setLevel(50); await k.setSetting('levelAsked', true); await k.setSetting('parseAsked', true); }); await p.goto(URL + '#/read'); await p.waitForTimeout(300); await p.goto(URL + '#/home'); await p.waitForTimeout(600); };
  const tab = async (n) => { await p.click(`a[data-tab="${n}"]`); await p.waitForTimeout(450); };
  const hash = () => p.evaluate(() => location.hash), back = () => p.locator('.pagehead a').first().getAttribute('href').catch(() => null);
  const vocab = async () => { await p.click('#view a:has-text("Vocabulary")'); await p.waitForTimeout(450); };

  await fresh(); await tab('study'); await vocab(); await tab('home'); await tab('study');
  ok((await hash()) === '#/learn/words' && (await back()) === '#/study', 'the steps as reported: Study tab reopens Vocabulary, its arrow goes to Study', [await hash(), await back()]);
  await fresh(); await tab('study'); await vocab(); await tab('settings'); await tab('home'); await tab('study');
  ok((await hash()) === '#/learn/words' && (await back()) === '#/study', 'one more tab in between (Settings): the arrow still goes to Study', [await hash(), await back()]);
  await p.click('.pagehead a'); await p.waitForTimeout(450);
  ok((await hash()) === '#/study' && (await p.locator('h1').first().innerText()) === 'Study', 'and the arrow opens the Study screen with its tiles');
  await fresh(); await tab('study'); await vocab(); await tab('read'); await tab('home'); await tab('study');
  ok((await hash()) === '#/learn/words' && (await back()) === '#/study', 'with Read in between: the arrow goes to Study', [await hash(), await back()]);
  await tab('study');
  ok((await hash()) === '#/study', 'tapping Study again on a Study screen still opens the Study screen');
  // a screen reached from Home by a link: the arrow still goes back to Home
  await fresh(); await p.evaluate(() => { location.hash = '#/learn/words'; }); await p.waitForTimeout(500);
  ok((await back()) === '#/home', 'Vocabulary opened from Home (not by the tab): the arrow goes back to Home', await back());
  // Parsing and the other Study screens
  await fresh(); await tab('study'); await p.click('#view a:has-text("Parsing")'); await p.waitForTimeout(500); await tab('settings'); await tab('home'); await tab('study');
  ok((await hash()).startsWith('#/parse') && (await back()) === '#/study', 'Parsing reopened by the tab: the arrow goes to Study', [await hash(), await back()]);
  // Home and Customize
  await fresh(); await p.evaluate(() => { location.hash = '#/home/customize'; }); await p.waitForTimeout(500); await tab('study'); await tab('home');
  ok((await hash()) === '#/home/customize' && (await back()) === '#/home', 'Customize Home reopened by the Home tab: the arrow goes to Home', [await hash(), await back()]);
  // the Read tab keeps working
  await fresh(); await p.goto(URL + '#/read/JHN/3'); await p.waitForSelector('.reader .w'); await tab('study'); await tab('read');
  ok((await hash()).startsWith('#/read/JHN/3') && (await p.locator('.reader .w').count()) > 0, 'the Read tab still reopens the chapter you were in');
  ok(errs.length === 0, 'no page errors', errs);
  await b.close(); process.exit(bad ? 1 : 0);
})();
