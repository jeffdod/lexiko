// Place the chips: the principal parts row (#/parts/build) and the paradigm builder (#/learn/charts/build). Tap, drag (mouse and a finger), keyboard, wrong chips, practice only.
const { chromium } = require('playwright');
let bad = 0; const ok = (c, m) => { console.log((c ? '  ok  ' : '  FAIL ') + m); if (!c) { bad++; process.exitCode = 1; } };
const U = 'http://localhost:8123/lexiko/';
(async () => {
  const b = await chromium.launch(); const errs = [];
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
  const p = await ctx.newPage(); p.on('pageerror', (e) => errs.push(String(e)));
  await p.goto(U + '#/settings'); await p.waitForSelector('#nav a[data-tab]');
  await p.evaluate(async () => { const k = await import('/lexiko/js/know.js'); await k.setLevel(50); await k.setSetting('levelAsked', true); await k.setSetting('parseAsked', true); });
  const go = async (hash) => { await p.goto(U + '#/settings'); await p.goto(U + hash); await p.waitForSelector('.pboard, .pagehead'); await p.waitForTimeout(150); };
  const cardsBefore = await p.evaluate(async () => { const k = await import('/lexiko/js/know.js'); return [k.K.cards.size, JSON.stringify(k.K.settings || {})]; });
  const chip = (t) => p.locator('.pchip:not(.ghost)').filter({ has: p.locator('span:text-is("' + t + '")') }).first();
  const slot = (label) => p.locator('.pslot[aria-label^="' + label + ':"]');
  const msg = () => p.locator('.ptray .pmsg').innerText();
  const fin = () => p.locator('.pfinal').innerText();
  const wrongN = async () => (await p.locator('.pboard .chip.bad').innerText().catch(() => '0')).replace(/\D/g, '') || '0';

  /* ---------- the principal parts row, γράφω (1125) ---------- */
  await go('#/parts/build/1125');
  const info = await p.evaluate(async () => { const P = await import('/lexiko/js/parts.js'); const e = P.eligible().get(1125); return { parts: e.parts, lemma: e.lemma }; });
  const P = info.parts;
  ok(await p.locator('.pslot').count() === 6 && await p.locator('.pslot.locked').count() === 1, 'row: six slots, the present is given');
  const nChips = await p.locator('.pchip:not(.ghost)').count();
  ok(nChips === 5 + 4, 'row: five right parts and four wrong ones in the tray (' + nChips + ')');
  const texts = await p.locator('.pchip:not(.ghost)').allInnerTexts();
  const wrongOnes = texts.filter((t) => !P.includes(t));
  ok(wrongOnes.length === 4 && new Set(texts).size === texts.length, 'row: the four wrong chips are none of the verb’s own parts, and no chip repeats: ' + wrongOnes.join(' '));
  ok(await slot('Aorist active').count() === 1, 'row: slots are labeled for screen readers');
  // layout: tray in view, slot text at the left, chips centered and 44 px tall
  const lay = await p.evaluate(() => {
    const tr = document.querySelector('.ptray').getBoundingClientRect(), lastSlot = [...document.querySelectorAll('.pslot')].pop().getBoundingClientRect();
    const sl = document.querySelector('.pslot.locked'), r = document.createRange(); r.selectNodeContents(sl.querySelector('span')); const t = r.getBoundingClientRect(), s = sl.getBoundingClientRect();
    const cs = [...document.querySelectorAll('.pchip:not(.ghost)')].map((c) => { const rr = document.createRange(); rr.selectNodeContents(c.querySelector('span')); const a = rr.getBoundingClientRect(), bb = c.getBoundingClientRect(); return { h: bb.height, dx: Math.abs((a.left + a.right) / 2 - (bb.left + bb.right) / 2), dy: Math.abs((a.top + a.bottom) / 2 - (bb.top + bb.bottom) / 2) }; });
    return { trayBottom: tr.bottom, vh: innerHeight, slotsAbove: lastSlot.bottom <= tr.top + 1, leftGap: t.left - s.left, minH: Math.min(...cs.map((x) => x.h)), dx: Math.max(...cs.map((x) => x.dx)), dy: Math.max(...cs.map((x) => x.dy)) };
  });
  ok(lay.trayBottom <= lay.vh && lay.slotsAbove, 'row: the tray and all six slots are in view on a phone');
  ok(lay.leftGap >= 0 && lay.leftGap < 14, 'row: the text in a slot is left-aligned (gap ' + lay.leftGap.toFixed(1) + ' px)');
  ok(lay.minH >= 43.5 && lay.dx < 1.5 && lay.dy < 3, 'row: chips are 44 px tall with their text centered (' + lay.dx.toFixed(1) + '/' + lay.dy.toFixed(1) + ')');
  // a wrong chip from another verb
  await chip(wrongOnes[0]).click(); ok(await p.locator('.pchip.sel').count() === 1 && await p.locator('.pslot.ready').count() === 5, 'row: tapping a chip selects it and lights the open slots');
  await slot('Aorist active').click();
  ok((await msg()).includes('is not a principal part of ' + info.lemma) && await wrongN() === '1' && await slot('Aorist active').getAttribute('aria-label') === 'Aorist active: empty', 'row: a wrong chip bounces back and says why: ' + (await msg()));
  // a part of the same verb in the wrong place
  await chip(P[3]).click(); await slot('Aorist active').click();
  ok((await msg()) === P[3] + ' is the perfect active of ' + info.lemma + ', not the aorist active.' && await wrongN() === '2', 'row: a part in the wrong slot says which slot it belongs to: ' + (await msg()));
  // right, by tapping
  await chip(P[2]).click(); await slot('Aorist active').click();
  ok(await p.locator('.pslot.ok').count() === 1 && (await slot('Aorist active').innerText()) === P[2] && await p.locator('.pchip:not(.ghost):visible').count() === nChips - 1, 'row: the right chip sticks in its slot and leaves the tray');
  // drag with the mouse, to the wrong slot and then the right one
  const center = async (loc) => { const r = await loc.boundingBox(); return [r.x + r.width / 2, r.y + r.height / 2]; };
  const drag = async (from, to) => { await from.scrollIntoViewIfNeeded(); const [fx, fy] = await center(from), [tx, ty] = await center(to); await p.mouse.move(fx, fy); await p.mouse.down(); await p.mouse.move(fx + 12, fy - 12, { steps: 3 }); await p.mouse.move(tx, ty, { steps: 6 }); const ghost = await p.locator('.pchip.ghost').count(); await p.mouse.up(); return ghost; };
  let g = await drag(chip(P[5]), slot('Perfect active'));
  ok(g === 1 && await wrongN() === '3' && await slot('Perfect active').getAttribute('aria-label') === 'Perfect active: empty', 'row: dragging shows the chip under the pointer; dropping it on the wrong slot is a wrong try ' + JSON.stringify([g, await wrongN(), await slot('Perfect active').getAttribute('aria-label'), await msg()]));
  g = await drag(chip(P[3]), slot('Perfect active'));
  ok(await slot('Perfect active').innerText() === P[3] && await p.locator('.pchip.ghost').count() === 0, 'row: dragging to the right slot places it, and the ghost is gone');
  // keyboard
  await chip(P[1]).focus(); await p.keyboard.press('Enter'); await slot('Future').focus(); await p.keyboard.press('Enter');
  ok(await slot('Future').innerText() === P[1], 'row: the keyboard works (Enter on a chip, then Enter on a slot) ' + JSON.stringify([await slot('Future').getAttribute('aria-label'), await p.locator('.pchip.sel').count(), await msg(), await p.evaluate(() => document.activeElement.className + ' ' + document.activeElement.innerText)]));
  // a drop that misses every slot changes nothing
  const w3 = await wrongN(); g = await drag(chip(P[4]), p.locator('.pmsg')); ok(await wrongN() === w3 && await p.locator('.pchip:not(.ghost):visible span:text-is("' + P[4] + '")').count() === 1, 'row: dropping on nothing puts the chip back, no wrong try');
  // a finger: a short press, then drag (touch events)
  const tctx = await b.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, reducedMotion: 'reduce' }); const tp = await tctx.newPage(); tp.on('pageerror', (e) => errs.push(String(e)));
  await tp.goto(U + '#/settings'); await tp.waitForSelector('#nav a[data-tab]');
  await tp.evaluate(async () => { const k = await import('/lexiko/js/know.js'); await k.setLevel(50); await k.setSetting('levelAsked', true); await k.setSetting('parseAsked', true); });
  await tp.goto(U + '#/settings'); await tp.goto(U + '#/parts/build/1125'); await tp.waitForSelector('.pboard'); await tp.waitForTimeout(150);
  const touchDrag = (text, label, hold) => tp.evaluate(async ({ text, label, hold }) => {
    const c = [...document.querySelectorAll('.pchip:not(.ghost)')].find((x) => x.innerText === text), s = document.querySelector('.pslot[aria-label^="' + label + ':"]');
    const pt = (el) => { const r = el.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; };
    const mk = (type, el, [x, y]) => { const t = new Touch({ identifier: 1, target: c, clientX: x, clientY: y }); return new TouchEvent(type, { touches: type === 'touchend' ? [] : [t], targetTouches: type === 'touchend' ? [] : [t], changedTouches: [t], bubbles: true, cancelable: true }); };
    const [cx, cy] = pt(c), [sx, sy] = pt(s);
    c.dispatchEvent(mk('touchstart', c, [cx, cy])); await new Promise((r) => setTimeout(r, hold));
    const lifted = document.querySelector('.pchip.ghost') !== null;
    c.dispatchEvent(mk('touchmove', c, [sx, sy])); const ev = mk('touchend', c, [sx, sy]); c.dispatchEvent(ev);
    return { lifted, prevented: ev.defaultPrevented };
  }, { text, label, hold });
  let td = await touchDrag(P[2], 'Aorist active', 120);
  ok(td.lifted === false && await tp.locator('.pslot.ok').count() === 0, 'touch: a quick touch is not a drag (the tray can scroll)');
  td = await touchDrag(P[2], 'Aorist active', 380);
  ok(td.lifted && td.prevented && await tp.locator('.pslot.ok').count() === 1, 'touch: a press and hold lifts the chip, and dropping it on its slot places it');
  await tctx.close();
  // finish the row by tapping the rest
  for (const [i, lab] of [[4, 'Perfect middle/passive'], [5, 'Aorist passive']]) { await chip(P[i]).click(); await slot(lab).click(); }
  ok(await p.locator('.ptray').isHidden() && (await fin()).startsWith('All placed. 3 wrong tries.') && await p.locator('button:has-text("Again")').count() === 1, 'row: when every slot is filled the tray goes and the count of wrong tries shows: ' + (await fin()));
  await p.click('button:has-text("Again")'); await p.waitForSelector('.pboard .pslot');
  ok(await p.locator('.pslot').count() === 6 && (await msg()) === 'Some of these belong to other verbs.', 'row: Again starts a fresh board');

  /* ---------- a verb that lacks some parts ---------- */
  const few = await p.evaluate(async () => { const P = await import('/lexiko/js/parts.js'); const v = P.rowVerbs().find((e) => e.parts.filter(Boolean).length === 4); const low = [...P.eligible().values()].find((e) => e.parts.filter(Boolean).length < 4); return { n: v && v.n, have: v && v.parts.filter(Boolean).length, low: low && low.n }; });
  await go('#/parts/build/' + few.n);
  ok(await p.locator('.pslot.locked').count() === 6 - few.have + 1, 'row: a part the verb does not have is a locked dash, not something to hunt for (' + (6 - few.have) + ' missing)');
  await go('#/parts/build/' + few.low);
  ok(await p.locator('.pboard').count() === 0 && (await p.locator('.card').first().innerText()).includes('too few'), 'row: a verb with too few parts says so');

  /* ---------- the paradigm builder ---------- */
  await go('#/learn/charts/build');
  const nrows = await p.locator('a.li').count();
  ok(nrows >= 18, 'paradigm: the picker lists the chart rows (' + nrows + ')');
  const all = await p.evaluate(async () => { const B = await import('/lexiko/js/paradigmbuild.js'), C = await import('/lexiko/js/chartdrill.js'), G = await import('/lexiko/js/paradigms.js'); const norm = (e) => e.normalize('NFD').replace(/[̀-ͯͅ]/g, '').toLowerCase().replace(/ς/g, 'σ').replace(/\(ν\)/g, '').replace(/([ιε])ν$/, '$1'); const out = []; for (const r of C.ROWS) { const P = G.paradigm(r.key); if (!P) continue; const w = B.wrongEndings(r), right = new Set(P.cells.map((c) => norm(c.ending))); out.push([r.key, w.size, [...w.keys()].filter((e) => right.has(norm(e))).length]); } return out; });
  ok(all.length >= 18 && all.every(([, n, clash]) => n === 4 && clash === 0), 'paradigm: every row gets four wrong endings, none of which is one of its own: ' + all.filter(([, n, c]) => n !== 4 || c).join(' | '));
  await go('#/learn/charts/build/aor1-act');
  const pd = await p.evaluate(async () => { const G = await import('/lexiko/js/paradigms.js'); const P = G.paradigm('aor1-act'); return P.cells.map((c) => [c.stem, c.ending]); });
  ok(await p.locator('.pslot').count() === 6 && await p.locator('.pstem').allInnerTexts().then((t) => JSON.stringify(t) === JSON.stringify(pd.map((x) => x[0]))), 'paradigm: six slots, each after its stem');
  ok(await p.locator('.pchip:not(.ghost)').count() === 10, 'paradigm: six right endings and four wrong ones');
  const lay2 = await p.evaluate(() => { const tr = document.querySelector('.ptray').getBoundingClientRect(), last = [...document.querySelectorAll('.pslot')].pop().getBoundingClientRect(); const s = document.querySelector('.pslot'), st = document.querySelector('.pstem').getBoundingClientRect(); return { fits: tr.bottom <= innerHeight && last.bottom <= tr.top + 1, gap: s.getBoundingClientRect().left - st.right }; });
  ok(lay2.fits && lay2.gap >= -0.5 && lay2.gap < 2, 'paradigm: the tray and six slots fit one phone screen, and each slot sits right against its stem (gap ' + lay2.gap.toFixed(1) + ' px)');
  const have = (await p.locator('.pchip:not(.ghost)').allInnerTexts()), endings = pd.map((x) => x[1]), wr = have.find((t) => !endings.includes(t));
  await chip(wr).click(); await slot('1st sing.').click();
  ok(/is an ending of .* not of first aorist active\.$/i.test(await msg()) || /not of .*aorist/i.test(await msg()), 'paradigm: a wrong ending says which row it belongs to: ' + (await msg()));
  const other = pd[1][1]; await chip(other).click(); await slot('1st sing.').click();
  ok((await msg()) === other + ' is the ending for the 2nd singular, not the 1st singular.', 'paradigm: an ending from another person says which: ' + (await msg()));
  // drag one with the mouse, tap the rest
  g = await drag(chip(pd[0][1]), slot('1st sing.')); ok(await slot('1st sing.').innerText() === pd[0][1], 'paradigm: drag an ending into its slot');
  const labels = ['2nd sing.', '3rd sing.', '1st pl.', '2nd pl.', '3rd pl.'];
  for (let i = 1; i < 6; i++) { await chip(pd[i][1]).click(); await slot(labels[i - 1]).click(); }
  ok(await p.locator('.ptray').isHidden() && (await fin()).startsWith('All placed. 2 wrong tries.') && await p.locator('a:has-text("See the paradigm")').count() === 1, 'paradigm: finished: ' + (await fin()));
  // rows with the same ending twice (1st singular and 3rd plural are both ον): either chip goes in either slot
  await go('#/learn/charts/build/impf-act');
  const dup = await p.evaluate(async () => { const G = await import('/lexiko/js/paradigms.js'); return G.paradigm('impf-act').cells.map((c) => c.ending); });
  ok(dup[0] === dup[5] && await p.locator('.pchip:not(.ghost) span:text-is("' + dup[0] + '")').count() === 2, 'paradigm: an ending used twice is in the tray twice (' + dup[0] + ')');

  /* ---------- the doors in ---------- */
  await go('#/parse/form'); await p.waitForSelector('a.area');
  const cards = await p.locator('a.area b').allInnerTexts();
  ok(cards.includes('Build the paradigm') && cards.includes('Build the row'), 'Practice by form has both new cards: ' + cards.join(' | '));
  await go('#/learn/charts/paradigm/aor1-pas');
  ok(await p.locator('a.btn:has-text("Build it yourself")').getAttribute('href') === '#/learn/charts/build/aor1-pas', 'a paradigm page has “Build it yourself”');

  /* ---------- practice only ---------- */
  const cardsAfter = await p.evaluate(async () => { const k = await import('/lexiko/js/know.js'); return [k.K.cards.size, JSON.stringify(k.K.settings || {})]; });
  ok(cardsAfter[0] === cardsBefore[0] && cardsAfter[1] === cardsBefore[1], 'practice only: no card and no setting changed (' + cardsBefore[0] + ' cards before and after)');
  ok(errs.length === 0, 'no page errors ' + errs.join('; '));
  await b.close(); console.log(bad ? bad + ' FAILED' : 'all passed');
})();
