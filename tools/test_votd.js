// Verse of the day: off by default, a section at the bottom of Home you can turn on, tuned to the words you know, stable all day, the reader's popup on tap, reading only.
const { chromium } = require('playwright');
const URL = 'http://localhost:8123/lexiko/';
let bad = 0; const ok = (c, m, x) => { console.log((c ? 'ok   ' : 'FAIL ') + m + (c || x === undefined ? '' : ' ' + JSON.stringify(x))); if (!c) bad++; };
(async () => {
  const b = await chromium.launch(), p = await (await b.newContext({ viewport: { width: 390, height: 844 } })).newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  await p.goto(URL + '#/home'); await p.waitForTimeout(2000);
  const setup = (lvl) => p.evaluate(async (lvl) => { const k = await import('/lexiko/js/know.js'); await k.setLevel(lvl); await k.setSetting('levelAsked', true); await k.setSetting('parseAsked', true); await k.setSetting('votd', null); }, lvl);
  const home = async () => { await p.goto(URL + '#/read'); await p.waitForTimeout(300); await p.goto(URL + '#/home'); await p.waitForTimeout(1200); };
  await setup(50); await home();
  ok(await p.locator('.votd').count() === 0, 'off by default: no card on Home');
  await p.goto(URL + '#/home/customize'); await p.waitForSelector('.li.cz');
  const rows = await p.locator('.li.cz b').allInnerTexts();
  const box = p.locator('.li.cz:has-text("Verse of the day") input');
  ok(rows[rows.length - 1] === 'Verse of the day' && !(await box.isChecked()), 'Customize: last in the list, unchecked', rows);
  ok(await p.locator('.li.cz:has-text("Verse of the day") [aria-label$="down"]').isDisabled(), 'it is last, so it cannot move down');
  await box.check(); await p.waitForTimeout(300);
  await home();
  ok(await p.locator('.votd').count() === 1, 'turned on: the card shows');
  const last = await p.evaluate(() => { const c = [...document.querySelectorAll('#view .stack > *')].filter((e) => e.classList.contains('card') || e.tagName === 'DETAILS'); return c[c.length - 1].classList.contains('votd'); });
  ok(last, 'the card is at the bottom of Home');
  const info = await p.evaluate(async () => {
    const el = document.querySelector('.votd'), words = [...el.querySelectorAll('.w')];
    const { D } = await import('/lexiko/js/data.js'), k = await import('/lexiko/js/know.js');
    const known = words.filter((w) => k.status(D.forms[+w.dataset.t >> 4].an[0].s) === 'known').length;
    return { n: words.length, share: known / words.length, ref: el.querySelector('.muted').textContent, href: el.querySelector('a').getAttribute('href'), lang: el.querySelector('.votd-text').lang, hyph: getComputedStyle(el.querySelector('.votd-text')).hyphens, text: el.querySelector('.votd-text').textContent, english: /[A-Za-z]{4}/.test(el.querySelector('.votd-text').textContent) };
  });
  ok(info.n >= 8 && info.share >= 0.9, 'tuned: 8+ words, at least 90% known', info);
  ok(info.lang === 'grc' && info.hyph === 'none' && !info.english, 'Greek only, no hyphenation, never English');
  ok(/^#\/read\/[A-Z0-9]+\/\d+\/\d+$/.test(info.href) && info.ref.includes(info.href.split('/').slice(-2).join(':')), 'Read link opens the verse', [info.href, info.ref]);
  const cards0 = await p.evaluate(async () => (await import('/lexiko/js/know.js')).K.cards.size);
  // stable all day, even if what you know changes
  await p.evaluate(async () => { const k = await import('/lexiko/js/know.js'); await k.setLevel(500); });
  await home();
  ok((await p.locator('.votd-text').textContent()) === info.text, 'the same verse all day, even after your level changes');
  // the reader's popup
  await p.locator('.votd .w').nth(2).click(); await p.waitForTimeout(400);
  ok(await p.locator('#pop:not([hidden])').count() === 1 && (await p.locator('#pop').innerText()).includes('Strong'), 'tapping a word opens the word popup');
  await p.keyboard.press('Escape'); await p.waitForTimeout(200);
  ok(await p.locator('#pop:not([hidden])').count() === 0, 'Escape closes it');
  await p.locator('.votd .w').nth(1).click(); await p.waitForTimeout(300); await p.goto(URL + '#/learn'); await p.waitForTimeout(500);
  ok(await p.locator('#pop:not([hidden])').count() === 0, 'leaving Home closes the popup');
  // reading only
  const cards1 = await p.evaluate(async () => (await import('/lexiko/js/know.js')).K.cards.size);
  ok(cards0 === cards1, 'no card was made: reading only');
  // the pick: deterministic per date, different on another date
  const days = await p.evaluate(async () => { const v = await import('/lexiko/js/votd.js'); const a = v.pickVerse('2026-11-12'), b = v.pickVerse('2026-11-12'), c = v.pickVerse('2026-11-13'), d = v.pickVerse('2026-11-14'); return { same: JSON.stringify(a) === JSON.stringify(b), diff: new Set([JSON.stringify(a), JSON.stringify(c), JSON.stringify(d)]).size }; });
  ok(days.same && days.diff >= 2, 'the date decides the verse', days);
  // a beginner: a short verse of common words
  await setup(null); await p.evaluate(async () => { const k = await import('/lexiko/js/know.js'); await k.setSetting('homeOn', ['votd']); }); await home();
  const beg = await p.evaluate(() => document.querySelectorAll('.votd .w').length);
  ok(beg >= 5 && beg <= 12, 'a beginner gets a short verse', beg);
  // reset to default turns it off
  await p.goto(URL + '#/home/customize'); await p.waitForSelector('.li.cz'); await p.click('button:has-text("Reset to default")'); await p.waitForTimeout(300);
  ok(!(await p.locator('.li.cz:has-text("Verse of the day") input').isChecked()), 'Reset to default turns it off');
  // the Read link and your reading place
  await setup(50); await p.evaluate(async () => { const k = await import('/lexiko/js/know.js'); await k.setSetting('homeOn', ['votd']); });
  const place = (code, ch, vs) => p.evaluate(async ([c, h, v]) => { const k = await import('/lexiko/js/know.js'); await k.setSetting('lastBook', c); await k.setSetting('lastCh', h); await k.setSetting('lastVs', v); }, [code, ch, vs]);
  const saved = () => p.evaluate(async () => { const k = (await import('/lexiko/js/know.js')).K.settings; return [k.lastBook, k.lastCh, k.lastVs].join(':'); });
  await home();
  const href = await p.locator('.votd a').getAttribute('href'), [, , vc, vch, vvs] = href.split('/'), other = vc === 'ROM' ? 'REV' : 'ROM';
  await home(); await place(null, 0, 0); await p.click('.votd a'); await p.waitForSelector('.reader .w');
  ok(await p.locator('dialog.ask[open]').count() === 0 && (await saved()).startsWith(vc + ':' + vch + ':'), 'no saved place: Read just opens the verse and sets the place', await saved());
  await home(); await place(vc, +vch, 0); await p.click('.votd a'); await p.waitForSelector('.reader .w');
  ok(await p.locator('dialog.ask[open]').count() === 0, 'a saved place in the same chapter: no question');
  await home(); await place(other, 8, 1); await p.click('.votd a'); await p.waitForSelector('dialog.ask[open]');
  const dtext = await p.locator('dialog.ask').innerText();
  ok(dtext.includes('Your reading place is') && dtext.includes('Keep my place') && dtext.includes('Move my place to'), 'a different saved place: it asks', dtext);
  ok(await p.evaluate(() => document.activeElement.textContent) === 'Keep my place', 'Keep my place is the focused button');
  const bt = await p.locator('dialog.ask button').evaluateAll((bs) => bs.map((el) => { const r = document.createRange(); r.selectNodeContents(el); const t = r.getBoundingClientRect(), e = el.getBoundingClientRect(); return Math.abs((t.left + t.width / 2) - (e.left + e.width / 2)) < 1.5 && Math.abs((t.top + t.height / 2) - (e.top + e.height / 2)) < 2; }));
  ok(bt.every(Boolean), 'button text is centered', bt);
  await p.click('dialog.ask button:has-text("Keep my place")'); await p.waitForSelector('.reader .w'); await p.waitForTimeout(400);
  ok(p.url().includes('/read/' + vc + '/' + vch + '/' + vvs) && (await saved()) === other + ':8:1', 'Keep: the verse opens and the place is untouched', await saved());
  await p.evaluate(() => scrollTo(0, 1500)); await p.waitForTimeout(800);
  ok((await saved()) === other + ':8:1', 'Keep: scrolling does not move it', await saved());
  await p.goto(URL + '#/read/' + vc + '/' + (+vch === 1 ? 2 : 1)); await p.waitForSelector('.reader .w'); await p.waitForTimeout(500);
  ok((await saved()) === other + ':8:1', 'Keep: changing chapter does not move it either', await saved());
  await p.click('nav a[data-tab="home"]'); await p.waitForTimeout(500); await p.click('nav a[data-tab="read"]'); await p.waitForSelector('.reader .w'); await p.waitForTimeout(400);
  ok(/#\/read\/?$/.test(p.url()) && (await saved()) === other + ':8:1', 'Keep: the Read tab opens the saved place, not the verse: ' + p.url(), await saved());
  await p.goto(URL + '#/home'); await p.waitForTimeout(800); await p.goto(URL + '#/read/MAT/2'); await p.waitForSelector('.reader .w'); await p.waitForTimeout(300);
  ok((await saved()).startsWith('MAT:2'), 'after leaving the reader, the next visit saves the place again', await saved());
  await home(); await place(other, 8, 1); await p.click('.votd a'); await p.waitForSelector('dialog.ask[open]');
  await p.click('dialog.ask button:has-text("Move my place")'); await p.waitForSelector('.reader .w'); await p.waitForTimeout(400);
  ok((await saved()).startsWith(vc + ':' + vch + ':'), 'Move: the place becomes the verse\u2019s book and chapter (the reader saves the verse at the top of the screen)', [await saved(), [vc, vch, vvs].join(':'), await p.url()]);
  await home(); await place(other, 8, 1); await p.click('.votd a'); await p.waitForSelector('dialog.ask[open]');
  await p.keyboard.press('Escape'); await p.waitForSelector('.reader .w'); await p.waitForTimeout(400);
  ok((await saved()) === other + ':8:1', 'Escape keeps the place', await saved());
  // centered link text
  ok(errs.length === 0, 'no page errors', errs);
  await b.close(); process.exit(bad ? 1 : 0);
})();
