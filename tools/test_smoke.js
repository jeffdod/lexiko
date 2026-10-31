// Smoke test: node tools/test_smoke.js  (server must be running on :8123)
const { chromium } = require('playwright');
const out = process.env.SHOTS || '/tmp/lexiko-shots';
require('fs').mkdirSync(out, { recursive: true });
const URL = 'http://localhost:8123/lexiko/';
let fails = 0;
const ok = (c, m) => { console.log((c ? '  ok  ' : ' FAIL ') + m); if (!c) fails++; };
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, colorScheme: 'light', isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  const errors = []; page.on('pageerror', (e) => errors.push('pageerror: ' + e.message)); page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  await page.goto(URL); await page.waitForSelector('#loading', { state: 'detached', timeout: 20000 });
  ok(await page.title() === 'lexiko — learn to read the Greek New Testament', 'title');
  ok(/Where are you starting/.test(await page.textContent('#view')), 'home shows level onboarding');
  await page.screenshot({ path: out + '/01-home-light.png' });

  // choose level 100+
  await page.click('.lvl:has-text("100+")');
  await page.waitForFunction(() => !/Where are you starting/.test(document.querySelector('#view').textContent));
  ok(/Today/.test(await page.textContent('#view')), 'home after level');

  // reader
  await page.goto(URL + '#/read/JHN/1'); await page.waitForSelector('.reader .w');
  const nWords = await page.locator('.reader .w').count();
  ok(nWords > 750 && nWords < 950, 'John 1 word count plausible: ' + nWords);
  const first = await page.locator('.reader .w').first().textContent();
  ok(first.replace(/­/g, '') === 'Ἐν', 'first word is Ἐν (got ' + first + ')');
  const shy = await page.evaluate(() => document.querySelector('.reader').textContent.split('­').length - 1);
  ok(shy > 300, 'soft hyphens present: ' + shy);
  const hy = await page.evaluate(() => getComputedStyle(document.querySelector('.reader')).hyphens + '/' + getComputedStyle(document.querySelector('.reader')).textAlign);
  ok(hy === 'manual/justify', 'reader hyphens/justify = ' + hy);
  await page.screenshot({ path: out + '/02-reader.png' });
  await page.locator('.reader .w', { hasText: 'λόγος' }).first().click();
  await page.waitForSelector('#pop:not([hidden])');
  const popText = await page.textContent('#pop');
  ok(/λόγος/.test(popText) && /G3056/.test(popText) && /Noun/.test(popText), 'popup shows lemma, Strong\'s, parse');
  await page.screenshot({ path: out + '/03-popup.png' });
  await page.keyboard.press('Escape');

  // section headings (Kretzmann) in the reader
  ok(await page.locator('.reader h3.peri').count() >= 1 && /The Word Became Flesh/.test(await page.locator('.reader h3.peri').first().textContent()), 'John 1 shows its section heading');
  const pbtn = page.locator('.reader h3.peri button[data-act=pread]').first(); await pbtn.click();
  await page.waitForFunction(() => document.querySelector('.reader h3.peri button[data-act=pread]').getAttribute('aria-pressed') === 'true');
  ok(true, 'section can be marked as read');
  await page.goto(URL + '#/read/MAT/5'); await page.waitForSelector('.reader .w');
  ok(await page.locator('.reader h3.peri').count() >= 4, 'Matthew 5 has several section headings: ' + await page.locator('.reader h3.peri').count());
  // em-dash markers: dash attached to the word, no space after it
  await page.goto(URL + '#/read/MAT/9'); await page.waitForSelector('.reader .w');
  const mt9 = (await page.locator('.reader').textContent()).replace(/\u00ad/g, '');
  ok(/ἁμαρτίας—τότε/.test(mt9) && !/— /.test(mt9), 'em-dash attached, no space after (Matt 9:6)');
  const dashTotal = await page.evaluate(async () => { const d = await import('./js/data.js'); let n = 0; for (const b of Object.values(d.D.text)) for (const [, vl] of b) for (const [, toks] of vl) for (const t of toks) if (t & 8) n++; return n; });
  ok(dashTotal === 135, 'all 135 source dash markers carried through: ' + dashTotal);
  const nPeri = await page.evaluate(async () => { const d = await import('./js/data.js'); return [d.D.periList.length, d.D.periList.filter((p) => p.c2 < p.c1 || (p.c2 === p.c1 && p.v2 < p.v1)).length]; });
  ok(nPeri[0] === 589 && nPeri[1] === 0, 'pericope ranges built: ' + nPeri[0] + ' (invalid ranges: ' + nPeri[1] + ')');
  await page.goto(URL + '#/read/JHN/1'); await page.waitForSelector('.reader .w');

  // gloss mode on
  await page.click('button:has-text("Glosses")'); await page.waitForSelector('.gl');
  const nGl = await page.locator('.gl').count();
  ok(nGl > 5, 'unknown-word glosses shown: ' + nGl);
  await page.screenshot({ path: out + '/04-reader-glosses.png' });

  // learn: passage session
  await page.goto(URL + '#/learn'); await page.waitForSelector('.scope-pick');
  await page.screenshot({ path: out + '/05-learn.png' });
  await page.selectOption('select[aria-label=Book]', 'JHN'); await page.selectOption('select[aria-label=Section]', { index: 1 });
  const href = await page.getAttribute('a.btn.primary', 'href');
  ok(/#\/learn\/passage\/JHN\/1\/1\/1\/18$/.test(href), 'section picker fills the range: ' + href);
  await page.goto(URL + '#/learn/passage/JHN/1/1/1/18'); await page.waitForSelector('.qcard');
  await page.screenshot({ path: out + '/06-quiz-front.png' });
  await page.click('button:has-text("Show answer")'); await page.waitForSelector('.grades');
  await page.screenshot({ path: out + '/07-quiz-answer.png' });
  for (let i = 0; i < 6; i++) { await page.click('.grades .g3'); await page.waitForSelector('.qcard, .kpis'); if (await page.locator('.kpis').count()) break; await page.click('button:has-text("Show answer")'); await page.waitForSelector('.grades'); }
  const cardsAfter = await page.evaluate(async () => { const s = await import('./js/store.js'); return (await s.store.allCards()).length; });
  ok(cardsAfter >= 5, 'cards persisted in IndexedDB: ' + cardsAfter);

  // progress + settings
  await page.goto(URL + '#/progress'); await page.waitForSelector('.kpis'); ok(/sections ready/.test(await page.textContent('.kpis')) && (await page.locator('a.li').count()) >= 3, 'progress shows section stats and suggestions'); await page.screenshot({ path: out + '/08-progress.png', fullPage: true });
  await page.goto(URL + '#/settings'); await page.waitForSelector('.card'); await page.screenshot({ path: out + '/09-settings.png', fullPage: true });

  // backup roundtrip
  const rt = await page.evaluate(async () => {
    const s = await import('./js/store.js'); const b = await s.makeBackup(); const n = b.cards.length;
    await s.store.clearAll(); const zero = (await s.store.allCards()).length;
    await s.importBackup(JSON.parse(JSON.stringify(b)), 'replace'); const back = (await s.store.allCards()).length;
    await s.importBackup(JSON.parse(JSON.stringify(b)), 'merge'); const merged = (await s.store.allCards()).length;
    let bad = null; try { s.validateBackup({ format: 'nope' }); } catch (e) { bad = e.message; }
    return { n, zero, back, merged, bad };
  });
  ok(rt.n > 0 && rt.zero === 0 && rt.back === rt.n && rt.merged === rt.n && /not a lexiko backup/.test(rt.bad), 'backup/restore roundtrip ' + JSON.stringify(rt));
  const persist = await page.evaluate(async () => ({ api: !!(navigator.storage && navigator.storage.persist), p: await navigator.storage.persisted() }));
  console.log('  info persist API present:', persist.api, 'persisted:', persist.p);

  // service worker + offline
  await page.goto(URL); await page.waitForSelector('#loading', { state: 'detached' });
  await page.evaluate(() => navigator.serviceWorker.ready); await page.waitForTimeout(1500);
  const swInfo = await page.evaluate(async () => { const ks = await caches.keys(); const c = await caches.open(ks[0]); return { caches: ks, n: (await c.keys()).length, ctl: !!navigator.serviceWorker.controller }; });
  ok(swInfo.n >= 60, 'precache holds ' + swInfo.n + ' files ' + JSON.stringify(swInfo.caches));
  await page.reload(); await page.waitForSelector('#loading', { state: 'detached' });
  await ctx.setOffline(true);
  await page.goto(URL + '#/read/ROM/8'); await page.reload(); await page.waitForSelector('.reader .w', { timeout: 15000 });
  ok((await page.locator('.reader .w').count()) > 300, 'OFFLINE reload renders Romans 8');
  await page.screenshot({ path: out + '/10-offline.png' });
  await ctx.setOffline(false);

  ok(errors.length === 0, 'no console/page errors' + (errors.length ? ': ' + errors.slice(0, 5).join(' | ') : ''));
  await b.close();

  // dark theme (auto) check
  const b2 = await chromium.launch(); const c2 = await b2.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, colorScheme: 'dark', isMobile: true, hasTouch: true });
  const p2 = await c2.newPage(); await p2.goto(URL + '#/read/JHN/1'); await p2.waitForSelector('.reader .w');
  const bg = await p2.evaluate(() => getComputedStyle(document.body).backgroundColor); ok(bg === 'rgb(18, 22, 27)', 'auto theme follows system dark: ' + bg);
  await p2.screenshot({ path: out + '/11-reader-dark.png' });
  await p2.locator('.reader .w').nth(5).click(); await p2.waitForSelector('#pop:not([hidden])'); await p2.screenshot({ path: out + '/12-popup-dark.png' });
  await p2.evaluate(() => { location.hash = '#/settings'; }); await p2.waitForSelector('.seg'); await p2.click('.seg button:has-text("Light")'); await p2.waitForTimeout(200);
  const bg2 = await p2.evaluate(() => getComputedStyle(document.body).backgroundColor); ok(bg2 === 'rgb(246, 242, 234)', 'manual Light overrides system dark: ' + bg2);
  await b2.close();
  console.log(fails ? '\n' + fails + ' FAILURES' : '\nALL PASSED'); process.exit(fails ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
