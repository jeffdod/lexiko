// Reader: clear labels (Show/Hide meanings, Mark chapter as read / Chapter marked as read) and quiet section headings with a ⋯ menu.
const { chromium } = require('playwright');
let bad = 0; const ok = (c, m) => { console.log((c ? '  ok  ' : '  FAIL ') + m); if (!c) { bad++; process.exitCode = 1; } };
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 390, height: 844 } });
  const errs = []; p.on('pageerror', (e) => errs.push(String(e)));
  const U = 'http://localhost:8123/lexiko/';
  await p.goto(U + '#/settings'); await p.waitForSelector('#nav a[data-tab]');
  await p.evaluate(async () => { const K = await import('/lexiko/js/know.js'); await K.setLevel(50); await K.setSetting('levelAsked', true); await K.setSetting('glossMode', false); });
  await p.goto(U + '#/read/MRK/1'); await p.waitForSelector('h3.peri');
  ok(await p.locator('.reader h3.peri .rdy, .reader h3.peri > .btn').count() === 0, 'section headings carry no badge or button until the ⋯ menu opens');
  ok(await p.locator('.reader h3.peri .pmenu:not([hidden])').count() === 0, 'the section menu starts closed');
  ok(/known/.test(await p.textContent('.reader h3.peri .psub')), 'the heading line shows how much you know as plain text');
  await p.locator('.reader h3.peri .pmore').nth(1).click();
  ok(await p.locator('.reader h3.peri .pmenu:not([hidden])').count() === 1 && await p.getAttribute('.reader h3.peri >> nth=1 >> .pmore', 'aria-expanded') === 'true', 'the ⋯ button opens the menu');
  ok(await p.locator('.reader h3.peri .pmenu:not([hidden]) >> text=Mark section as read').count() === 1, 'the menu offers “Mark section as read”');
  await p.click('.reader h3.peri .pmenu:not([hidden]) button[data-act=pread]'); await p.waitForTimeout(300);
  ok(/Section read/.test(await p.textContent('.reader h3.peri >> nth=1')), 'a marked section says “Section read” in its heading line');
  await p.locator('.reader h3.peri .pmore').nth(1).click();
  ok(await p.locator('.reader h3.peri .pmenu:not([hidden]) button:has-text("✓ Section marked as read")').count() === 1, 'the menu then shows “✓ Section marked as read”');
  const gl = p.locator('.readmeta button:has-text("meanings"), button:has-text("meanings")').first();
  ok(/^Show meanings$/.test((await gl.textContent()).trim()), 'the meanings button says “Show meanings”');
  await gl.click(); await p.waitForTimeout(200);
  ok(/^Hide meanings$/.test((await p.locator('button:has-text("meanings")').first().textContent()).trim()), 'and “Hide meanings” once on');
  const foot = p.locator('.readfoot button').first();
  ok(/^Mark chapter as read$/.test((await foot.textContent()).trim()) && await foot.locator('svg').count() === 0, 'the chapter button says “Mark chapter as read” with no check mark');
  await foot.click(); await p.waitForTimeout(300);
  const f2 = p.locator('.readfoot button').first();
  ok(/Chapter marked as read/.test(await f2.textContent()) && await f2.locator('svg').count() === 1, 'once marked it says “✓ Chapter marked as read”');
  // marking a section does not mark the chapter; unmarking one section leaves its neighbors read
  await p.evaluate(async () => { const K = await import('/lexiko/js/know.js'); await K.markRead('MRK', 1, false); for (const k of Object.keys(K.K.read)) if (k.startsWith('p:MRK:')) delete K.K.read[k]; });
  await p.reload(); await p.waitForSelector('h3.peri');
  await p.locator('.reader h3.peri .pmore').first().click(); await p.click('.reader h3.peri .pmenu:not([hidden]) button[data-act=pread]'); await p.waitForTimeout(300);
  ok(/^Mark chapter as read$/.test((await p.locator('.readfoot button').first().textContent()).trim()), 'marking a section leaves the chapter button on “Mark chapter as read”');
  await p.locator('.readfoot button').first().click(); await p.waitForTimeout(300);
  const secs = () => p.evaluate(async () => { const K = await import('/lexiko/js/know.js'), D = (await import('/lexiko/js/data.js')).D; return D.periList.filter((x) => x.code === 'MRK' && x.c1 <= 1 && x.c2 >= 1).map((x) => K.sectionRead(x)); });
  ok((await secs()).every(Boolean), 'marking the chapter marks all its sections');
  await p.reload(); await p.waitForSelector('h3.peri'); await p.locator('.reader h3.peri .pmore').nth(1).click(); await p.click('.reader h3.peri .pmenu:not([hidden]) button[data-act=pread]'); await p.waitForTimeout(300);
  const after = await secs(); ok(after.filter((x) => !x).length === 1 && after.filter(Boolean).length === after.length - 1, 'unmarking one section leaves the other sections read ' + JSON.stringify(after));
  // a chapter in which every word is known has no meanings button (only the "No new words" chip)
  await p.evaluate(async () => { const K = await import('/lexiko/js/know.js'), D = (await import('/lexiko/js/data.js')).D; for (const l of D.lex) if (!K.K.cards.get('w:' + l.n)) await K.markKnown(l.n); });
  await p.goto(U + '#/read/3JN/1'); await p.waitForSelector('h3.peri, .reader .w'); await p.waitForTimeout(300);
  ok(await p.locator('.chip:has-text("No new words")').count() === 1 && await p.locator('button:has-text("meanings")').count() === 0, 'no unknown words: “No new words” and no meanings button');
  const wide = await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1);
  ok(wide, 'the footer does not stretch the page at phone width');
  ok(errs.length === 0, 'no page errors ' + errs.join('|'));
  await b.close(); console.log(bad ? 'readerlabels: FAILED' : 'readerlabels: ok');
})();
