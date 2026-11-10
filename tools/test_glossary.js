// The Glossary's sort: Word, Count and Status, each ascending or descending, in tap order; the letters filter; search results can be sorted too.
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const errs = [];
  const ok = (c, m) => { if (!c) { console.log('FAIL: ' + m); process.exitCode = 1; } else console.log('  ok  ' + m); };
  const U = 'http://localhost:8123/lexiko/';
  const p = await (await b.newContext({ viewport: { width: 390, height: 860 } })).newPage(); p.on('pageerror', (e) => errs.push(String(e)));
  await p.goto(U + '#/home'); await p.waitForSelector('#nav a[data-tab]');
  await p.evaluate(async () => { const K = await import('/lexiko/js/know.js'); await K.setLevel(50); await K.setSetting('levelAsked', true); await K.setSetting('parseAsked', true); });
  const open = async () => { await p.goto(U + '#/home'); await p.goto(U + '#/search'); await p.waitForSelector('a.li[data-l]'); };
  const btn = (t) => p.locator('.sortrow button.sortbtn:has-text("' + t + '")');
  const rows = (n = 60) => p.evaluate((n) => [...document.querySelectorAll('a.li[data-l]')].slice(0, n).map((r) => ({ head: r.querySelector('b').textContent, n: parseInt(r.children[1].textContent.replace(/[^0-9]/g, ''), 10), st: r.lastElementChild.textContent.trim() })), n);
  await open();
  let r = await rows();
  ok((await p.locator('.sortrow .sortbtn.primary').count()) === 0, 'no sort is highlighted by default');
  const fold = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/ς/g, 'σ');
  ok(r.every((x, i) => i === 0 || fold(r[i - 1].head) <= fold(x.head)), 'by default the list is alphabetical');
  // Count: ascending, then descending, then dropped
  await btn('Count').click(); r = await rows(); ok(/Count1↑/.test((await btn('Count').innerText()).replace(/\s/g, '')) && r.every((x, i) => i === 0 || r[i - 1].n <= x.n) && r[0].n === 1, 'Count once: fewest first, badge "1↑"');
  await btn('Count').click(); r = await rows(); ok(/Count1↓/.test((await btn('Count').innerText()).replace(/\s/g, '')) && r.every((x, i) => i === 0 || r[i - 1].n >= x.n) && r[0].n > 1000, 'Count twice: most first, badge "1↓" (top: ' + r[0].n + '×)');
  await btn('Count').click(); ok((await p.locator('.sortrow .sortbtn.primary').count()) === 0, 'a third tap drops it');
  // Status then Count (twice): new words first, most common first within each status
  await btn('Status').click(); await btn('Count').click(); await btn('Count').click();
  ok(/Status1↑/.test((await btn('Status').innerText()).replace(/\s/g, '')) && /Count2↓/.test((await btn('Count').innerText()).replace(/\s/g, '')), 'the tap order is the priority: Status 1↑, Count 2↓');
  r = await rows(200); const kind = (s) => /New/.test(s) ? 0 : /Learning/.test(s) ? 1 : 2;
  ok(kind(r[0].st) === 0 && r.every((x, i) => i === 0 || kind(r[i - 1].st) < kind(x.st) || (kind(r[i - 1].st) === kind(x.st) && r[i - 1].n >= x.n)), 'new words come first, and within a status the most common come first (top: ' + r[0].head + ' ' + r[0].n + '×)');
  // survives leaving and coming back
  await open(); ok(/Status1↑/.test((await btn('Status').innerText()).replace(/\s/g, '')), 'the sort survives leaving the Glossary and coming back');
  // letter filter
  await p.click('.sortrow button[aria-label="Clear the sort"]'); ok((await p.locator('.sortrow .sortbtn.primary').count()) === 0, 'Clear removes every sort');
  await p.click('button[aria-label="Words starting with β"]'); await p.waitForTimeout(200);
  r = await p.evaluate(() => [...document.querySelectorAll('a.li[data-l]')].map((x) => x.dataset.l)); ok(r.length > 20 && r.every((l) => l === 'β'), 'a letter shows only words starting with it (' + r.length + ' words)');
  ok(/words starting with β/.test(await p.innerText('.muted.small:has-text("words starting")')), 'the line above the list says so');
  await btn('Count').click(); await btn('Count').click(); r = await rows(); ok(r.every((x, i) => i === 0 || r[i - 1].n >= x.n), 'a letter and a sort work together: the most common β words first');
  await p.click('button[aria-label="Words starting with β"]'); await p.waitForTimeout(200);
  ok((await p.locator('a.li[data-l]').count()) > 5000, 'tapping the letter again shows all words');
  // search results can be sorted
  await p.fill('#sq', 'and'); await p.waitForTimeout(400);
  ok((await p.locator('.sortrow').count()) === 1 && (await p.locator('button[aria-label^="Words starting"]').count()) === 0, 'while searching, the sort buttons show and the letters do not');
  r = await rows(100); ok(r.length > 3 && r.every((x, i) => i === 0 || r[i - 1].n >= x.n), 'search results follow the sort (Count, most first)');
  await btn('Count').click(); await btn('Count').click(); await p.click('.sortrow button[aria-label="Clear the sort"]'); ok(/best first/.test(await p.innerText('.muted.small:has-text("match")')), 'with no sort, matches are best first');
  const tie = await p.evaluate(async () => { const S = await import('/lexiko/js/search.js'), D = (await import('/lexiko/js/data.js')).D; const w = D.lex.filter((L) => L.freq === 1).slice(0, 300); const o = S.sortWords(w, [{ key: 'count', dir: 1 }]).map((L) => L.head.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()); return o.every((x, i) => i === 0 || o[i - 1] <= x); });
  ok(tie, 'words that tie fall back to alphabetical order');
  ok(errs.length === 0, 'no page errors: ' + errs.join(' | '));
  await b.close(); console.log(process.exitCode ? 'glossary: FAILED' : 'glossary: ok');
})();
