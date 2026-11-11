// Home: the "Add lexiko to your Home Screen" nudge. After 15 words, below Ready today, one nudge at a time, "Not now" asks twice in all, installing ends it.
const { chromium } = require('playwright');
let bad = 0; const ok = (c, m) => { console.log((c ? '  ok  ' : '  FAIL ') + m); if (!c) { bad++; process.exitCode = 1; } };
const U = 'http://localhost:8123/lexiko/';
(async () => {
  const b = await chromium.launch(); const errs = [];
  const mk = async (opts = {}, init) => { const ctx = await b.newContext({ viewport: { width: 390, height: 780 }, ...opts }); if (init) await ctx.addInitScript(init);
    const p = await ctx.newPage(); p.on('pageerror', (e) => errs.push(String(e))); await p.goto(U + '#/settings'); await p.waitForSelector('#nav a[data-tab]'); return p; };
  const setup = (p, n, extra = {}) => p.evaluate(async ([n, extra]) => { const k = await import('/lexiko/js/know.js'), F = await import('/lexiko/js/fsrs.js'), { D } = await import('/lexiko/js/data.js');
    await k.setLevel(50); await k.setSetting('levelAsked', true); await k.setSetting('parseAsked', true); await k.setSetting('lastBackup', Date.now()); await k.setSetting('installAsks', 0); await k.setSetting('installSnooze', 0);
    for (const x of [...k.K.cards.keys()]) k.K.cards.delete(x); const now = Date.now();
    D.lex.slice(0, n).forEach((l, i) => k.K.cards.set('w:' + l.n, { ...F.newCard('w:' + l.n), state: 'review', stability: 5, reps: 3, last: now - 3 * 864e5, due: i < 3 ? now - 864e5 : now + 20 * 864e5 }));
    for (const [a, v] of Object.entries(extra)) await k.setSetting(a, v); }, [n, extra]);
  const home = async (p) => { await p.goto(U + '#/settings'); await p.goto(U + '#/home'); await p.waitForSelector('#view .stack'); await p.waitForTimeout(400); };
  const ban = (p) => p.evaluate(() => { const e = [...document.querySelectorAll('#view .banner')].find((x) => /Home Screen|Install lexiko/.test(x.textContent)); if (!e) return null;
    const cards = [...document.querySelector('#view > .stack').children], i = cards.indexOf(e), r = cards.findIndex((x) => /^Ready today/.test(x.textContent));
    return { t: e.innerText.replace(/\n+/g, ' | '), btns: [...e.querySelectorAll('button')].map((x) => [x.textContent, x.className]), afterReady: r >= 0 && i === r + 1 }; });
  const fake = () => { window.__installEvt = { prompt() {}, userChoice: Promise.resolve({ outcome: 'dismissed' }) }; };

  // Chrome-style: the browser has offered the install prompt
  let p = await mk({}, "window.addEventListener('DOMContentLoaded',()=>{});(" + fake.toString() + ")()");
  await setup(p, 10); await home(p); ok(await ban(p) === null, 'under 15 studied words: no nudge');
  await setup(p, 15); await home(p); let t = await ban(p);
  ok(t && /^Install lexiko \| It opens full screen and works offline\. \| Install \| Not now$/.test(t.t), 'after 15 words: ' + (t && t.t));
  ok(t && t.afterReady, 'it sits right below Ready today');
  ok(t && t.btns.every((x) => !/primary/.test(x[1])), 'both buttons are outlined (Study stays the one solid button)');
  await p.click('#view .banner button:has-text("Not now")'); await p.waitForTimeout(400);
  ok(await ban(p) === null, 'Not now hides it'); let s = await p.evaluate(async () => { const K = (await import('/lexiko/js/know.js')).K; return [K.settings.installAsks, K.settings.installSnooze > Date.now() + 13 * 864e5]; });
  ok(s[0] === 1 && s[1], 'it asks again in about two weeks: ' + JSON.stringify(s));
  await p.evaluate(async () => { (await import('/lexiko/js/know.js')).K.settings.installSnooze = Date.now() - 1000; }); await home(p);
  ok(await ban(p) !== null, 'two weeks later it is back');
  await p.click('#view .banner button:has-text("Not now")'); await p.waitForTimeout(400); await p.evaluate(async () => { (await import('/lexiko/js/know.js')).K.settings.installSnooze = Date.now() - 1000; }); await home(p);
  ok(await ban(p) === null, 'after the second Not now it never comes back');
  // installing ends it for good
  await setup(p, 15); await p.evaluate((src) => { window.__installEvt = { prompt() {}, userChoice: Promise.resolve({ outcome: 'accepted' }) }; }, 0); await p.evaluate(() => { location.hash = '#/settings'; }); await p.waitForTimeout(100);
  await p.evaluate(() => { window.__installEvt = { prompt() {}, userChoice: Promise.resolve({ outcome: 'accepted' }) }; location.hash = '#/home'; }); await p.waitForSelector('#view .banner'); await p.click('#view .banner button:has-text("Install")'); await p.waitForTimeout(500);
  ok(await p.evaluate(async () => (await import('/lexiko/js/know.js')).K.settings.installAsks) === 2 && await ban(p) === null, 'accepting the install prompt ends it for good');
  // one nudge at a time: a due backup reminder goes first
  await setup(p, 15, { lastBackup: 0, backupSnooze: 0, backupReminder: true }); await p.evaluate(() => { window.__installEvt = { prompt() {}, userChoice: Promise.resolve({ outcome: 'dismissed' }) }; }); await home(p);
  const both = await p.evaluate(() => [...document.querySelectorAll('#view .banner')].map((e) => e.querySelector('b').textContent));
  ok(both.length === 1 && /Back up/.test(both[0]), 'with a backup due, only the backup reminder shows: ' + both.join(' / '));
  await p.close();

  // other browsers with no install prompt: no nudge
  p = await mk(); await setup(p, 15); await home(p); ok(await ban(p) === null, 'no install prompt offered by the browser: no nudge');
  await p.close();
  // iPhone
  p = await mk({ userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1', hasTouch: true, isMobile: true });
  await setup(p, 15); await home(p); t = await ban(p);
  ok(t && /^Add lexiko to your Home Screen \| It opens full screen and works offline\. Your progress is also safer from being cleared by Safari\. \| Show me how \| Not now$/.test(t.t), 'iPhone wording: ' + (t && t.t));
  await p.click('#view .banner button:has-text("Show me how")'); await p.waitForSelector('dialog.ask[open]');
  ok(/Share button in Safari, then “Add to Home Screen”/.test(await p.innerText('dialog.ask')), 'Show me how explains the steps');
  await p.click('dialog.ask button:has-text("Got it")'); await p.waitForTimeout(300);
  ok(await ban(p) !== null, 'closing the steps leaves the nudge for later (not counted as Not now)');
  await p.close();
  // already installed: no nudge
  p = await mk({ userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Version/17.0 Mobile/15E148 Safari/604.1' }, "Object.defineProperty(navigator,'standalone',{value:true})");
  await setup(p, 15); await home(p); ok(await ban(p) === null, 'already running as an installed app: no nudge');
  ok(errs.length === 0, 'no page errors ' + errs.join('; '));
  await b.close(); console.log(bad ? bad + ' FAILED' : 'all passed');
})();
