// Back and the tabs: the arrow at the top of a page goes back like the browser's back button, tabs reopen where you left them, and a quiz is never gone back to or restored.
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const errs = [];
  const ok = (c, m) => { if (!c) { console.log('FAIL: ' + m); process.exitCode = 1; } else console.log('  ok  ' + m); };
  const U = 'http://localhost:8123/lexiko/';
  const p = await (await b.newContext({ viewport: { width: 390, height: 860 } })).newPage(); p.on('pageerror', (e) => errs.push(String(e)));
  await p.goto(U + '#/home'); await p.waitForSelector('#nav a[data-tab]');
  await p.evaluate(async () => { const K = await import('/lexiko/js/know.js'); await K.setLevel(50); await K.setSetting('levelAsked', true); await K.setSetting('parseAsked', true); });
  const hash = () => p.evaluate(() => location.hash);
  const tab = async (t) => { await p.click('#nav a[data-tab="' + t + '"]'); await p.waitForTimeout(350); };
  const back = async () => { await p.click('.pagehead a.btn.ghost'); await p.waitForTimeout(350); };
  // 1. Reader -> Settings -> back arrow returns to the Reader
  await p.goto(U + '#/home'); await p.goto(U + '#/read/JHN/3'); await p.waitForSelector('.reader .w'); await tab('settings'); await p.waitForSelector('.pagehead');
  ok((await hash()) === '#/settings', 'the Settings tab opens Settings');
  ok(/Back to reading/.test(await p.getAttribute('.pagehead a.btn.ghost', 'aria-label')), 'the arrow says where it goes: ' + await p.getAttribute('.pagehead a.btn.ghost', 'aria-label'));
  await back(); ok((await hash()) === '#/read/JHN/3', 'the back arrow on Settings returns to the chapter you were reading: ' + await hash());
  // 2. a tab opens where you left it; tapping it again goes to its first screen
  await p.goto(U + '#/home'); await p.goto(U + '#/learn/words'); await p.waitForTimeout(300); await tab('settings'); await tab('study');
  ok((await hash()) === '#/learn/words', 'the Study tab reopens Vocabulary, where you left it: ' + await hash());
  await tab('study'); ok((await hash()) === '#/study', 'tapping Study again goes to the Study screen');
  // 3. a chain of back arrows follows the screens in order
  await p.goto(U + '#/home'); await p.goto(U + '#/learn/words'); await p.waitForTimeout(300); await tab('settings'); await p.waitForSelector('.pagehead');
  await back(); ok((await hash()) === '#/learn/words', 'back from Settings returns to Vocabulary');
  await back(); ok((await hash()) === '#/home', 'back from Vocabulary returns to Home');
  // 4. a screen opened directly goes to its fixed place
  await p.goto(U + '#/home'); await p.goto(U + '#/settings'); await p.waitForSelector('.pagehead'); await p.goto(U + '#/home');
  const pr = await p.evaluate(() => location.hash); await tab('settings'); await p.waitForSelector('.pagehead'); await back();
  ok((await hash()) === pr, 'from Home, Settings and back returns to Home');
  // 5. a quiz is never gone back to or restored
  const bad = await p.evaluate(async () => { const U = await import('/lexiko/js/util.js'); return ['#/learn/review', '#/learn/daily', '#/parse/run', '#/parse/form', '#/parts/exercise', '#/learn', '#/parse/howto'].map(U.NOT_RESUMABLE).concat(['#/home', '#/learn/words', '#/parse', '#/read/JHN/3', '#/settings', '#/parse/kinds/ptc', '#/search'].map(U.NOT_RESUMABLE)); });
  ok(bad.slice(0, 7).every(Boolean) && bad.slice(7).every((x) => !x), 'quizzes, practice, the how-to and the Learn hub are not resumable; ordinary screens are ' + JSON.stringify(bad));
  await p.goto(U + '#/study'); await p.waitForSelector('.area'); await p.goto(U + '#/learn/review'); await p.waitForTimeout(600);
  const quizHash = await hash();
  await tab('settings'); await p.waitForSelector('.pagehead');
  const href = await p.getAttribute('.pagehead a.btn.ghost', 'href'); ok(!/^#\/(learn\/(review|daily)|parse\/run)/.test(href), 'the back arrow after a quiz does not point at the quiz: ' + href + ' (quiz was ' + quizHash + ')');
  await tab('home'); ok(!/^#\/(learn\/(review|daily)|parse\/run)/.test(await hash()), 'the Home tab does not reopen a quiz: ' + await hash());
  // 6. a redirect is not a screen to go back to
  await p.goto(U + '#/home'); await p.goto(U + '#/learn'); await p.waitForTimeout(400); ok((await hash()) === '#/study', 'the Learn hub redirects to Study');
  await tab('settings'); await p.waitForSelector('.pagehead'); await back(); ok((await hash()) === '#/study', 'back after a redirect does not return to the hub: ' + await hash());
  // 7. after a quiz, "Back to Parsing" and then the arrow go to Home, not back into the finished quiz
  await p.evaluate(async () => { const K = await import('/lexiko/js/know.js'); await K.setGate('verbs', true); });
  await p.goto(U + '#/study'); await p.waitForSelector('.area'); await p.goto(U + '#/parse'); await p.waitForTimeout(500);
  await p.evaluate(() => { location.hash = '#/parse/run'; }); await p.waitForTimeout(800);
  await p.evaluate(() => { location.hash = '#/parse'; }); await p.waitForTimeout(600);
  await back(); ok((await hash()) === '#/study', 'the arrow on Parsing after a quiz goes to Study, not back into the quiz: ' + await hash());
  await p.goto(U + '#/home'); await p.goto(U + '#/learn/words'); await p.waitForTimeout(300);
  await p.evaluate(() => { location.hash = '#/learn/review'; }); await p.waitForTimeout(800);
  await p.evaluate(() => { location.hash = '#/learn/words'; }); await p.waitForTimeout(500);
  await back(); ok(!/^#\/(learn\/(review|daily)|parse\/run)/.test(await hash()), 'the arrow on Vocabulary after a quiz does not go back into it: ' + await hash());
  // 8. the browser's own back and forward buttons skip a finished quiz too
  await p.goto(U + '#/study'); await p.waitForSelector('.area'); await p.goto(U + '#/parse'); await p.waitForTimeout(500);
  await p.evaluate(() => { location.hash = '#/parse/run'; }); await p.waitForTimeout(800);
  await p.evaluate(() => { location.hash = '#/parse'; }); await p.waitForTimeout(600);
  await p.goBack(); await p.waitForTimeout(900); ok(!/^#\/parse\/run/.test(await hash()), 'the browser back button does not land in the finished quiz: ' + await hash());
  await p.goForward(); await p.waitForTimeout(900); ok(!/^#\/parse\/run/.test(await hash()), 'the browser forward button does not land in it either: ' + await hash());
  await p.evaluate(() => { location.hash = '#/learn/review'; }); await p.waitForTimeout(800); const live = await hash();
  await p.reload(); await p.waitForTimeout(1200); ok((await hash()) === live, 'reloading on a screen keeps you on it: ' + await hash());
  ok(errs.length === 0, 'no page errors: ' + errs.join(' | '));
  await b.close(); console.log(process.exitCode ? 'backnav: FAILED' : 'backnav: ok');
})();
