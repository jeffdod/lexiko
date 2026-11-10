// Reader: verse-by-verse paragraphs (hanging plain numbers, ¶ at paragraph starts, same spacing as Block, follows Line ends).
const { chromium } = require('playwright');
let bad = 0; const ok = (c, m) => { console.log((c ? '  ok  ' : '  FAIL ') + m); if (!c) { bad++; process.exitCode = 1; } };
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 390, height: 844 } });
  const errs = []; p.on('pageerror', (e) => errs.push(String(e)));
  const U = 'http://localhost:8123/lexiko/';
  await p.goto(U + '#/settings'); await p.waitForSelector('#nav a[data-tab]');
  const set = (k, v) => p.evaluate(async ([k, v]) => { const K = await import('/lexiko/js/know.js'); await K.setSetting(k, v); }, [k, v]);
  await p.evaluate(async () => { const K = await import('/lexiko/js/know.js'); await K.setLevel(50); await K.setSetting('levelAsked', true); });
  await set('paraStyle', 'block'); await set('sectionHeads', true); await set('verseNums', true); await set('english', false);
  await p.goto(U + '#/read/MAT/5'); await p.waitForSelector('.reader .w');
  const blockGap = await p.evaluate(() => parseFloat(getComputedStyle(document.querySelector('.reader p')).marginBottom));
  await set('paraStyle', 'verse'); await p.goto(U + '#/read/MAT/6'); await p.waitForSelector('.reader.pv .w'); await p.goto(U + '#/read/MAT/5'); await p.waitForSelector('.reader.pv .w');
  const info = await p.evaluate(() => {
    const ps = [...document.querySelectorAll('.reader p.vv')], r = document.querySelector('.reader');
    const first = ps.find((x) => x.querySelector('.nm').textContent === '13');
    return { n: ps.length, nums: ps.slice(0, 3).map((x) => x.querySelector('.nm').textContent), gap: parseFloat(getComputedStyle(ps[0]).marginBottom), indent: getComputedStyle(ps[0]).textIndent,
      vnRaised: document.querySelectorAll('.reader .vn').length, firstPil: first.querySelector('.vh .pil') ? first.querySelector('.vh').textContent : null, justify: getComputedStyle(r).textAlign,
      oneVerse: ps.every((x) => x.querySelectorAll(':scope > .verse').length === 1), pilBeforeNum: first.querySelector('.vh').firstElementChild.className };
  });
  ok(info.n > 20 && info.nums[0] === '1', 'each verse is its own block: ' + info.n + ' blocks, numbers ' + info.nums);
  ok(info.oneVerse && info.vnRaised === 0, 'one verse per block, and no raised numbers');
  ok(info.indent === '0px', 'no indentation');
  const flush = await p.evaluate(() => { const q = document.querySelector('.reader p.vv'), r = document.createRange(); r.selectNodeContents(q); const lines = [...r.getClientRects()].map((x) => Math.round(x.left)); return [Math.min(...lines), Math.round(q.getBoundingClientRect().left), getComputedStyle(q).display]; });
  ok(flush[0] === flush[1] && flush[2] === 'block', 'every line starts at the left edge (no hanging column): ' + flush);
  ok(Math.abs(info.gap - blockGap) < 0.5, 'verse spacing equals Block paragraph spacing: ' + info.gap + ' vs ' + blockGap);
  ok(info.justify === 'justify', 'justified by default');
  ok(/¶/.test(info.firstPil || '') && info.pilBeforeNum === 'pil', 'a paragraph at the start of 5:13 (right after a heading) has ¶ before the number: ' + info.firstPil);
  // an interior break gets an inline ¶ inside the verse
  const inner = await p.evaluate(async () => { const { D } = await import('/lexiko/js/data.js'); for (const [k, m] of D.paras) { if (m.some((x) => x > 1) && k.startsWith('MAT:')) return k; } return null; });
  if (inner) { const [bk, ch, vs] = inner.split(':'); await p.goto(U + '#/read/' + bk + '/' + ch); await p.waitForSelector('.reader.pv .w');
    ok(await p.evaluate((vs) => !!document.querySelector('.reader .verse[data-vs="' + vs + '"] .pil'), vs), 'an interior paragraph break shows an inline ¶ (' + inner + ')'); }
  await set('lineEnds', 'ragged'); await p.goto(U + '#/read/MAT/6'); await p.waitForSelector('.reader.pv .w');
  ok(await p.evaluate(() => getComputedStyle(document.querySelector('.reader')).textAlign) === 'left', 'Line ends: ragged still applies');
  await set('lineEnds', 'justify');
  await set('verseNums', false); await p.goto(U + '#/read/MAT/5'); await p.waitForSelector('.reader.pv .w');
  ok(await p.evaluate(() => !document.querySelector('.reader .nm') && document.querySelector('.reader.pv.nonum') !== null), 'Verse numbers off hides the numbers but keeps the layout');
  await set('verseNums', true);
  await p.goto(U + '#/read/JAS/1'); await p.waitForSelector('.reader .w');
  const jas = await p.evaluate(() => ({ pv: !!document.querySelector('.reader.pv p.vv'), pil: document.querySelectorAll('.reader .pil').length }));
  ok(jas.pv, 'works in any book (James 1): pil count ' + jas.pil);
  await set('english', true); await p.goto(U + '#/read/MRK/1'); await p.waitForSelector('.reader .w');
  ok(await p.evaluate(() => !document.querySelector('.reader.pv')), 'with English on, the English layout is used');
  await set('english', false); await set('paraStyle', 'indent');
  await p.goto(U + '#/read/MRK/2'); await p.waitForSelector('.reader.pi .w');
  ok(await p.evaluate(() => !document.querySelector('.reader.pv') && !!document.querySelector('.reader .vn')), 'Indented still has raised numbers');
  ok(errs.length === 0, 'no page errors ' + errs.join('; '));
  await b.close(); console.log(bad ? bad + ' FAILED' : 'all passed');
})();
