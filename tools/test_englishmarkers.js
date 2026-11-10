// Reader: beside the English the Greek uses the same plain run-in numbers and ¶ as verse by verse.
const { chromium } = require('playwright');
let bad = 0; const ok = (c, m) => { console.log((c ? '  ok  ' : '  FAIL ') + m); if (!c) { bad++; process.exitCode = 1; } };
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 390, height: 844 } });
  const errs = []; p.on('pageerror', (e) => errs.push(String(e)));
  const U = 'http://localhost:8123/lexiko/';
  await p.goto(U + '#/settings'); await p.waitForSelector('#nav a[data-tab]');
  const set = (k, v) => p.evaluate(async ([k, v]) => { const K = await import('/lexiko/js/know.js'); await K.setSetting(k, v); }, [k, v]);
  await p.evaluate(async () => { const K = await import('/lexiko/js/know.js'); await K.setLevel(50); await K.setSetting('levelAsked', true); });
  await set('english', true); await set('verseNums', true); await set('sectionHeads', true);
  await p.goto(U + '#/read/MAT/5'); await p.waitForSelector('.reader.par .en');
  const r = await p.evaluate(() => { const v13 = document.querySelector('.reader .verse[data-vs="13"]');
    return { raised: document.querySelectorAll('.reader .vn').length, nm13: v13.querySelector('.gk .vh').textContent, pilFirst: v13.querySelector('.gk .vh').firstElementChild.className, en: !!v13.querySelector('.en'), plainNum: getComputedStyle(v13.querySelector('.nm')).verticalAlign };
  });
  ok(r.raised === 0, 'no raised numbers beside the English');
  ok(/¶\s*13/.test(r.nm13) && r.pilFirst === 'pil', 'a paragraph at 5:13 has ¶ before the number: ' + r.nm13);
  ok(r.en && r.plainNum === 'baseline', 'English still under the verse, number not raised');
  const inner = await p.evaluate(async () => { const { D } = await import('/lexiko/js/data.js'); for (const [k, m] of D.paras) if (m.some((x) => x > 1) && k.startsWith('MAT:1:')) return k; return null; });
  if (inner) { const [bk, ch, vs] = inner.split(':'); await p.goto(U + '#/read/' + bk + '/' + ch); await p.waitForSelector('.reader.par .en');
    ok(await p.evaluate((vs) => !!document.querySelector('.reader .verse[data-vs="' + vs + '"] .gk .pil'), vs), 'an interior break shows an inline ¶ (' + inner + ')'); }
  await set('verseNums', false); await p.goto(U + '#/read/MAT/5'); await p.waitForSelector('.reader.par .en');
  ok(await p.evaluate(() => !document.querySelector('.reader .nm') && !!document.querySelector('.reader .vh .pil')), 'Verse numbers off hides the numbers; ¶ remain');
  await set('verseNums', true);
  await p.setViewportSize({ width: 1000, height: 800 }); await p.goto(U + '#/read/MAT/6'); await p.waitForSelector('.reader.par .en');
  ok(await p.evaluate(() => getComputedStyle(document.querySelector('.reader .verse')).display === 'grid' && !!document.querySelector('.reader .gk .vh')), 'wide screen: two columns kept, number in the Greek column');
  await set('english', false);
  ok(errs.length === 0, 'no page errors ' + errs.join('; '));
  await b.close(); console.log(bad ? bad + ' FAILED' : 'all passed');
})();
