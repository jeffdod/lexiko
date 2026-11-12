// Charts: cover the answers (master chart, every other tab, a paradigm page), turn squares over one at a time or a row at a time, Show all restores the chart; remembered on the device; not used when the chart is opened as a quiz hint.
const { chromium } = require('playwright');
let bad = 0; const ok = (c, m) => { console.log((c ? '  ok  ' : '  FAIL ') + m); if (!c) { bad++; process.exitCode = 1; } };
const U = 'http://localhost:8123/lexiko/';
(async () => {
  const b = await chromium.launch(); const errs = [];
  const p = await (await b.newContext({ viewport: { width: 390, height: 780 }, reducedMotion: 'reduce' })).newPage(); p.on('pageerror', (e) => errs.push(String(e)));
  await p.goto(U + '#/settings'); await p.waitForSelector('#nav a[data-tab]');
  await p.evaluate(async () => { const k = await import('/lexiko/js/know.js'); await k.setLevel(50); await k.setSetting('levelAsked', true); await k.setSetting('parseAsked', true); localStorage.removeItem('lexiko.chartCover'); });
  const open = async () => { await p.goto(U + '#/settings'); await p.goto(U + '#/learn/charts'); await p.waitForSelector('button:has-text("See the master verb chart")'); await p.click('button:has-text("See the master verb chart")'); await p.waitForSelector('dialog.charts[open] .ctable'); };
  await open();
  const rowsN = await p.locator('dialog.charts tbody tr[data-key]').count();
  const before = await p.evaluate(() => document.querySelector('dialog.charts .ctable').innerText);
  ok(rowsN >= 18 && await p.locator('.mcell').count() === 0, 'opens uncovered, as before (' + rowsN + ' rows)');
  await p.click('dialog.charts button:has-text("Cover all")');
  const st = await p.evaluate(() => { const cs = [...document.querySelectorAll('.mcell')]; return { n: cs.length, cv: cs.filter((c) => c.classList.contains('cv')).length, vis: cs.filter((c) => getComputedStyle(c.querySelector('.ans')).visibility !== 'hidden').length, labels: [...new Set(cs.map((c) => c.getAttribute('aria-label')))], note: !document.querySelector('dialog.charts .cbody > p:nth-of-type(2)').hidden }; });
  ok(st.n === rowsN * 6 && st.cv === st.n && st.vis === 0, 'Cover all: every answer square is blank (' + st.n + ' squares)');
  ok(st.labels.length === 1 && st.labels[0] === 'Show answer' && st.note, 'covered squares are labeled "Show answer", and the hint line appears');
  const tenses = await p.evaluate(() => [...document.querySelectorAll('dialog.charts tbody th')].map((t) => t.innerText));
  ok(tenses[0] === 'Present act' && tenses.every((t) => t), 'tense names stay visible: ' + tenses.slice(0, 3).join(', '));
  // one square
  const first = p.locator('dialog.charts tbody tr[data-key="pres-act"] .mcell');
  await first.nth(1).click(); // tense stem: "pres"
  const one = await p.evaluate(() => { const c = document.querySelectorAll('dialog.charts tr[data-key="pres-act"] .mcell')[1]; return [c.className, c.innerText, c.getAttribute('aria-label')]; });
  ok(/rv/.test(one[0]) && one[1].trim() === 'pres' && one[2] === 'Hide answer', 'tapping a square turns it over: ' + JSON.stringify(one));
  await first.nth(0).click();   // present has no augment: an empty answer
  const none = await p.evaluate(() => { const c = document.querySelectorAll('dialog.charts tr[data-key="pres-act"] .mcell')[0], n = c.querySelector('.none'); return [c.innerText.trim(), n && n.getAttribute('aria-label')]; });
  ok(none[0] === '—' && none[1] === 'none', 'an empty answer shows an em-dash (read as "none"): ' + JSON.stringify(none));
  await first.nth(1).click();
  ok(await p.evaluate(() => document.querySelectorAll('dialog.charts tr[data-key="pres-act"] .mcell')[1].classList.contains('cv')), 'tapping it again covers it');
  // a row at a time
  await p.click('dialog.charts tr[data-key="pres-act"] .mrow');
  ok(await p.evaluate(() => [...document.querySelectorAll('dialog.charts tr[data-key="pres-act"] .mcell')].every((c) => c.classList.contains('rv'))), 'tapping the tense name turns over the whole row (one square was still covered)');
  ok(await p.evaluate(() => [...document.querySelectorAll('dialog.charts tr[data-key="pres-mp"] .mcell')].every((c) => c.classList.contains('cv'))), 'other rows are untouched');
  await p.click('dialog.charts tr[data-key="pres-act"] .mrow');
  ok(await p.evaluate(() => [...document.querySelectorAll('dialog.charts tr[data-key="pres-act"] .mcell')].every((c) => c.classList.contains('cv'))), 'tapping it again covers the row');
  const lab = await p.getAttribute('dialog.charts tr[data-key="pres-act"] .mrow', 'aria-label');
  ok(lab === 'Turn over the Present act row', 'row button label: ' + lab);
  // keyboard
  await first.nth(2).focus(); await p.keyboard.press('Enter');
  ok(await p.evaluate(() => document.querySelectorAll('dialog.charts tr[data-key="pres-act"] .mcell')[2].classList.contains('rv')), 'Enter turns a focused square over');
  // size
  const sz = await p.evaluate(() => Math.min(...[...document.querySelectorAll('.mcell')].map((c) => c.getBoundingClientRect().height)));
  ok(sz >= 43.5, 'squares are at least 44 px tall (' + sz.toFixed(1) + ')');
  // text is centered in the squares, both ways (also the two-line "prim act")
  await p.click('dialog.charts tr[data-key="pres-act"] .mrow');
  const off = await p.evaluate(() => [...document.querySelectorAll('dialog.charts tr[data-key="pres-act"] .mcell')].map((c) => { const r = document.createRange(); r.selectNodeContents(c.querySelector('.ans')); const a = r.getBoundingClientRect(), b = c.getBoundingClientRect(); return [Math.abs((a.left + a.right) / 2 - (b.left + b.right) / 2), Math.abs((a.top + a.bottom) / 2 - (b.top + b.bottom) / 2)]; }));
  ok(off.every(([x, y]) => x < 1.5 && y < 3), 'answers are centered in their squares, across and down: ' + off.map(([x, y]) => x.toFixed(1) + '/' + y.toFixed(1)).join(' '));
  await p.click('dialog.charts tr[data-key="pres-act"] .mrow');
  // remembered on this device
  await p.evaluate(() => document.querySelector('dialog.charts').close()); await open();
  ok(await p.locator('.mcell').count() === rowsN * 6 && await p.locator('.mcell.cv').count() === rowsN * 6, 'reopened: still covered (remembered on this device), all blank again');
  // Show all restores the chart exactly
  await p.click('dialog.charts button:has-text("Show all")');
  const after = await p.evaluate(() => document.querySelector('dialog.charts .ctable').innerText);
  ok(after === before && await p.locator('.mcell, .mrow').count() === 0, 'Show all gives back the chart exactly as it was');
  await p.evaluate(() => document.querySelector('dialog.charts').close()); await open();
  ok(await p.locator('.mcell').count() === 0, 'and the next opening is uncovered');
  // opened as a quiz hint: never covered, no controls
  await p.click('dialog.charts button:has-text("Cover all")'); await p.evaluate(() => document.querySelector('dialog.charts').close());
  await p.evaluate(async () => { (await import('/lexiko/js/charts.js')).openCharts({ highlight: 'pres-act' }); }); await p.waitForSelector('dialog.charts[open] .ctable');
  ok(await p.locator('.mcell').count() === 0 && await p.locator('dialog.charts button:has-text("Cover all")').count() === 0, 'opened from a quiz for a hint: answers in view, no cover controls, even with cover remembered');
  // the other tabs: every one has Cover all / Show all, covers its answers, restores them exactly, and shares the one setting
  await p.evaluate(() => document.querySelector('dialog.charts').close()); await p.evaluate(() => localStorage.removeItem('lexiko.chartCover')); await open();
  const body = () => p.evaluate(() => document.querySelector('dialog.charts .cbody').innerText);
  const widths = () => p.evaluate(() => [...document.querySelectorAll('dialog.charts .ctable')].map((t) => [t.scrollWidth, t.parentElement.clientWidth]));
  for (const [tab, minSquares] of [['Personal endings', 40], ['Noun endings', 40], ['Contractions', 40], ['Participles', 60], ['Infinitives', 10]]) {
    await p.click(`dialog.charts .seg button:has-text("${tab}")`);
    const openText = await body(), openW = await widths();
    ok(await p.locator('dialog.charts button:has-text("Cover all")').count() === 1 && await p.locator('.mcell').count() === 0, tab + ': has Cover all and starts open');
    await p.click('dialog.charts button:has-text("Cover all")');
    const st = await p.evaluate(() => { const cs = [...document.querySelectorAll('dialog.charts .mcell')]; return { n: cs.length, cv: cs.filter((c) => c.classList.contains('cv')).length, vis: cs.filter((c) => getComputedStyle(c.querySelector('.ans')).visibility !== 'hidden').length, rows: document.querySelectorAll('dialog.charts button.mrow').length, h: Math.min(...cs.map((c) => c.getBoundingClientRect().height)), lab: [...new Set(cs.map((c) => c.getAttribute('aria-label')))] }; });
    ok(st.n >= minSquares && st.cv === st.n && st.vis === 0 && st.rows > 0, tab + ': Cover all blanks every answer (' + st.n + ' squares, ' + st.rows + ' row names)');
    ok(st.h >= 43.5 && st.lab.length === 1 && st.lab[0] === 'Show answer', tab + ': squares are at least 44 px tall and labeled "Show answer"');
    const coveredW = await widths();
    ok(coveredW.every(([sw, cw], i) => sw <= Math.max(openW[i][0], cw) + 4), tab + ': covered tables are no wider than open ones ' + JSON.stringify(coveredW));
    if (tab === 'Participles') ok(await p.locator('dialog.charts .ctable:not(.cpart) .mcell').count() === 0, 'Participles: the formative list stays open (it is explanation, not recall)');
    await p.locator('dialog.charts .mcell').first().click();
    ok(await p.locator('dialog.charts .mcell.rv').count() === 1, tab + ': a tap turns one square over');
    await p.locator('dialog.charts button.mrow').first().click();
    ok(await p.locator('dialog.charts .mcell.rv').count() >= 2, tab + ': a row name turns its row over');
    // the one shared setting: the next tab opens covered
    const next = { 'Personal endings': 'Noun endings', 'Noun endings': 'Contractions', Contractions: 'Participles', Participles: 'Infinitives', Infinitives: 'Personal endings' }[tab];
    await p.click(`dialog.charts .seg button:has-text("${next}")`);
    ok(await p.locator('dialog.charts .mcell').count() > 0 && await p.locator('dialog.charts .mcell.rv').count() === 0, tab + ' -> ' + next + ': the setting is shared, the next tab is already covered');
    await p.click('dialog.charts button:has-text("Show all")');
    ok(await p.locator('dialog.charts .mcell, dialog.charts .mrow').count() === 0, next + ': Show all uncovers it');
    await p.click(`dialog.charts .seg button:has-text("${tab}")`);   // setting is now off, so the tab we left is open again, exactly as it was
    ok(await body() === openText, tab + ': text is exactly the original after Show all');
  }
  // a hint opens a tab with the answers showing
  await p.evaluate(() => document.querySelector('dialog.charts').close());
  await p.evaluate(async () => { (await import('/lexiko/js/charts.js')).openCharts({ tab: 'inf', highlight: { kind: 'inf', tense: 'P', voice: 'A' } }); }); await p.waitForSelector('dialog.charts[open] .ctable');
  await p.click('dialog.charts button:has-text("Cover all")').catch(() => {});
  ok(await p.locator('dialog.charts .mcell').count() === 0 && await p.locator('dialog.charts button:has-text("Cover all")').count() === 0, 'a quiz hint on the Infinitives tab: answers in view, no cover controls');
  await p.evaluate(() => document.querySelector('dialog.charts').close());
  // a paradigm page
  await p.goto(U + '#/settings'); await p.goto(U + '#/learn/charts/paradigm/aor1-pas'); await p.waitForSelector('.pline');
  const plain = await p.evaluate(() => [...document.querySelectorAll('.pline .pword')].map((w) => w.innerText));
  ok(plain.length === 6 && await p.locator('button:has-text("Cover all")').count() === 1, 'paradigm page: Cover all is there, six forms');
  await p.click('button:has-text("Cover all")');
  const pc = await p.evaluate(() => { const cs = [...document.querySelectorAll('.pline .mcell')]; return { n: cs.length, cv: cs.filter((c) => c.classList.contains('cv')).length, vis: cs.filter((c) => getComputedStyle(c.querySelector('.ans')).visibility !== 'hidden').length, h: Math.min(...cs.map((c) => c.getBoundingClientRect().height)) }; });
  ok(pc.n === 6 && pc.cv === 6 && pc.vis === 0 && pc.h >= 43.5, 'paradigm page: six blank squares, at least 44 px tall');
  await p.locator('.pline .mcell').nth(1).click();
  ok(await p.evaluate(() => document.querySelectorAll('.pline .mcell.rv').length) === 1 && await p.evaluate(() => document.querySelectorAll('.pline .mcell')[1].innerText.trim()) === plain[1], 'paradigm page: a tap turns one over and shows the same form');
  await p.goto(U + '#/settings'); await p.goto(U + '#/learn/charts/paradigm/aor1-pas'); await p.waitForSelector('.pline');
  ok(await p.locator('.pline .mcell.cv').count() === 6, 'paradigm page: still covered when reopened (shared setting)');
  await p.click('button:has-text("Show all")');
  ok(JSON.stringify(await p.evaluate(() => [...document.querySelectorAll('.pline .pword')].map((w) => w.innerText))) === JSON.stringify(plain) && await p.locator('.mcell').count() === 0, 'paradigm page: Show all gives the forms back exactly');
  ok(errs.length === 0, 'no page errors ' + errs.join('; '));
  await b.close(); console.log(bad ? bad + ' FAILED' : 'all passed');
})();
