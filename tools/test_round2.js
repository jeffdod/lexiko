// Home layout, keyboard shortcuts, study-by-frequency, growth chart, locked backups: node tools/test_round2.js (server on :8123)
const { chromium } = require('playwright');
const URL = 'http://localhost:8123/lexiko/';
let fails = 0;
const ok = (c, m) => { console.log((c ? '  ok  ' : ' FAIL ') + m); if (!c) fails++; };
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1000, height: 800 } });   // wide + mouse: keyboard hints show
  const page = await ctx.newPage();
  const errors = []; page.on('pageerror', (e) => errors.push(e.message)); page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(URL); await page.waitForSelector('#loading', { state: 'detached' });
  await page.click('.choice:has-text("I know the basics")'); await page.click('button:has-text("Continue")'); await page.click('button:has-text("Skip for now")');
  await page.waitForSelector('.hero');
  ok(await page.locator('.hero .start').count() === 1, 'home leads with one main button');
  ok(await page.locator('.kpis').count() === 0, 'home has no row of number boxes');
  ok(/Keep reading/.test(await page.textContent('#view')), 'home offers to keep reading');

  // flashcard keyboard: Space shows the answer, 3 rates Good, session moves on
  await page.goto(URL + '#/learn/daily'); await page.waitForSelector('.qcard');
  ok(await page.locator('.kbhint').first().isVisible(), 'keyboard hint is visible with a mouse and keyboard');
  await page.keyboard.press(' '); await page.waitForSelector('.grades');
  ok(await page.locator('.grades button').count() === 4, 'Space shows the answer and the four ratings');
  const before = await page.textContent('.qcard .qask, .qcard');
  await page.keyboard.press('3'); await page.waitForTimeout(300);
  ok(await page.locator('.qcard').count() === 1 && !(await page.locator('.grades').count()), '3 rates Good and shows the next card');

  // undo: taking back the last answer restores the card, the counts and the previous question
  { const snap = () => page.evaluate(async () => { const k = await import('./js/know.js'); const st = await import('./js/store.js'); return { cards: k.K.cards.size, log: (await st.store.allLog()).length, r: (k.K.daily[Object.keys(k.K.daily).pop()] || {}).r || 0 }; });
    await page.goto(URL + '#/home'); await page.waitForSelector('.hero'); await page.goto(URL + '#/learn/daily'); await page.waitForSelector('.qcard');
    ok(await page.locator('.undorow').count() === 0, 'no Undo before the first answer');
    const before = await snap(), firstWord = await page.textContent('.qgreek');
    await page.keyboard.press(' '); await page.waitForSelector('.grades'); await page.keyboard.press('3'); await page.waitForSelector('.undorow');
    const mid = await snap(); ok(mid.log === before.log + 1, 'rating writes one log entry');
    await page.keyboard.press('u'); await page.waitForSelector('.qcard');
    const after = await snap();
    ok(await page.textContent('.qgreek') === firstWord && after.log === before.log && after.cards === before.cards && after.r === before.r, 'Undo brings back the same card and restores the log, cards and daily counts ' + JSON.stringify({ before, mid, after }));
    ok(await page.locator('.undorow').count() === 0, 'Undo is used up after one press'); }
  // prepositions whose case was settled by hand: none are left unsure, and an adverbial one shows its plain entry
  { const left = await page.evaluate(async () => { const { D, senseNs } = await import('./js/data.js'); let u = 0; for (const bk of D.books) for (const [, vs] of D.text[bk.code]) for (const [, toks] of vs) u += senseNs(toks).unsure.reduce((a, b) => a + b, 0); return u; });
    ok(left === 0, 'no preposition is left with an unsure case (' + left + ')');
    await page.goto(URL + '#/read/MAT/2'); await page.waitForSelector('[data-t]'); await page.locator('[data-t]', { hasText: /^κατ’$/ }).first().click();
    ok(/\+ accusative/.test(await page.locator('#pop').innerText()), 'κατ’ ὄναρ shows the accusative sense'); await page.keyboard.press('Escape'); }
  // parsing a passage: one click for everything, one click for verbs only
  await page.goto(URL + '#/parse'); await page.waitForSelector('summary:has-text("Study a passage")'); await page.click('summary:has-text("Study a passage")');
  { const all = await page.locator('details a:has-text("Practise these forms")').getAttribute('href'), vb = await page.locator('details a.btn:has-text("Verbs only")').first().getAttribute('href');
    ok(/\/all$/.test(all) && /\/verb$/.test(vb) && all.replace(/all$/, '') === vb.replace(/verb$/, ''), 'passage parsing offers all forms and verbs only for the same text: ' + all + ' | ' + vb);
    await page.goto(URL + vb); await page.waitForSelector('.qcard'); ok(/Tense/.test(await page.textContent('#view')), 'verbs-only passage session asks about verbs (tense first)'); }
  // parsing: when the answer is wrong, the right button is lit even for a voice that has no button of its own (middle or passive deponent)
  { const tgt = await page.evaluate(async () => { const { D } = await import('./js/data.js'); const { decode } = await import('./js/morph.js'); const k = await import('./js/know.js'); await k.setSetting('parseMode', 'guided');
      for (const bk of D.books) for (const [ch, vs] of D.text[bk.code]) for (const [v, toks] of vs) for (const t of toks) { const f = D.forms[t >> 4]; if (f.an.length !== 1) continue; const d = decode(f.an[0].m);
        if (d.pos === 'V' && d.slots.voice === 'N' && d.slots.tense && d.slots.mood) return { book: bk.code, ch, v, w: f.plain.replace(/\u00ad/g, ''), tense: d.slots.tense }; } return null; });
    ok(!!tgt, 'found a verb whose voice is middle or passive deponent: ' + (tgt && tgt.w));
    if (tgt) {
      await page.goto(URL + '#/home'); await page.waitForSelector('.hero');
      await page.goto(URL + ['#/parse/run/passage', tgt.book, tgt.ch, tgt.v, tgt.ch, tgt.v, 'verb'].join('/')); await page.waitForSelector('.qcard');
      let lit = null; const seen = [];
      for (let i = 0; i < 15 && lit === null; i++) {
        if (!(await page.locator('.qcard').count())) break;
        const word = (await page.textContent('.qgreek')).replace(/\u00ad/g, ''); seen.push(word);
        if (word !== tgt.w) { await page.click('button:has-text("I don’t know")'); await page.waitForSelector('.fb'); await page.click('button.primary.block'); await page.waitForTimeout(250); continue; }
        await page.click('.popt[data-code="' + tgt.tense + '"]'); await page.waitForSelector('.popt[data-code="E"]:not([disabled])'); await page.waitForTimeout(100);
        await page.click('.popt[data-code="A"]'); await page.waitForSelector('.popt.right');
        lit = (await page.locator('.popt.right').first().innerText()).replace(/\d/g, '').trim();
      }
      ok(lit === 'Middle or passive', 'a wrong voice answer lights "Middle or passive" as the right one (lit: ' + lit + '; saw ' + seen.join(',') + ')');
    } }
  // parsing a passage: each verbal form once, even when it is capitalised or accented differently, and old progress on a variant counts
  { const r = await page.evaluate(async () => {
      const { D } = await import('./js/data.js'); const pm = await import('./js/parse-model.js'); const pa = await import('./js/parse.js'); const k = await import('./js/know.js');
      const bare = (w) => w.replace(/\u00ad/g, '').normalize('NFD').replace(/[\u0300\u0301\u0342]/g, '').normalize('NFC').toLowerCase();
      const out = {};
      for (const sc of [{ book: 'JHN', c1: 1, v1: 1, c2: 1, v2: 999 }, { book: 'MRK', c1: 1, v1: 1, c2: 1, v2: 999 }]) {
        const ids = pa.buildParseSession({ scope: sc, kind: 'verb', size: 80, newLimit: 80 }).map((x) => x.id);
        const keys = ids.map((i) => bare(D.forms[i].w) + '|' + D.forms[i].an[0].s + '|' + D.forms[i].an.map((a) => a.m).sort().join(','));
        out[sc.book] = { n: ids.length, uniq: new Set(keys).size, ids: new Set(ids).size }; }
      // progress on a non-main variant (made before variants were merged) still counts
      const { canon, members } = pm.groupForms(D.forms); let main = -1, variant = -1;
      for (const [c, ids] of members) if (ids.length > 1 && D.forms[c].an[0] && D.forms[c].an[0].s) { main = c; variant = ids[1]; break; }
      let where = null; for (const bk of D.books) { for (const [ch, vs] of D.text[bk.code]) { for (const [v, toks] of vs) if (toks.some((t) => canon[t >> 4] === main)) { where = { book: bk.code, c1: ch, v1: v, c2: ch, v2: v }; break; } if (where) break; } if (where) break; }
      const before = pa.planParseSession({ scope: where, kind: 'all', size: 50, newLimit: 50 }).fresh.some((x) => x.id === main);
      await k.rateParse(k.parseId(D.forms[variant]), 3);
      const after = pa.planParseSession({ scope: where, kind: 'all', size: 50, newLimit: 50 }).fresh.some((x) => x.id === main);
      out.variant = { before, after }; return out; });
    ok(r.JHN.uniq === r.JHN.n && r.MRK.uniq === r.MRK.n && r.JHN.ids === r.JHN.n, 'a passage session never repeats a form ' + JSON.stringify(r));
    ok(r.variant.before === true && r.variant.after === false, 'progress on a capitalised or differently accented variant counts for the merged form ' + JSON.stringify(r.variant)); }
  // study by how common: Learn > Vocabulary lists groups; a group starts a session of only those words
  await page.goto(URL + '#/learn/words'); await page.waitForSelector('summary:has-text("Study by how common")');
  await page.click('summary:has-text("Study by how common")');
  ok(await page.locator('a[href^="#/learn/set/"]').count() >= 1, 'word groups offer Study links');
  const href = await page.locator('a[href^="#/learn/set/"]').first().getAttribute('href');
  const [lo, hi] = href.split('/').slice(-2).map(Number);
  await page.goto(URL + href); await page.waitForSelector('.qcard');
  const n = +(await page.evaluate(() => (document.querySelector('.qcard') || {}).textContent ? 1 : 0)); ok(n === 1, 'a frequency group starts a session (' + lo + '–' + hi + ')');

  // growth chart: appears after two days of study data
  await page.goto(URL + '#/progress'); await page.waitForSelector('h1');
  ok(/learning curve|words started/.test(await page.textContent('#view')), 'progress shows the learning curve card');
  await page.evaluate(async () => { const m = await import('./js/know.js'); const d = new Date(); for (let i = 0; i < 5; i++) { const k = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); m.K.daily[k] = { ...(m.K.daily[k] || {}), n: 4 }; d.setDate(d.getDate() - 1); } });
  await page.goto(URL + '#/home'); await page.goto(URL + '#/progress'); await page.waitForSelector('svg[role=img]');
  ok(await page.locator('svg[role=img]').count() === 1, 'learning-curve chart is drawn');

  // locked backups: round trip, and a wrong passphrase fails
  const r = await page.evaluate(async () => {
    const s = await import('./js/store.js'); const o = { format: 'lexiko-backup', exported: 'x', kv: {}, cards: [], log: [], hello: 'world' };
    const locked = await s.lockBackup(o, 'correct horse');
    const good = await s.unlockBackup(locked, 'correct horse');
    let bad = 'no error'; try { await s.unlockBackup(locked, 'wrong one'); } catch (e) { bad = e.message; }
    return { fmt: locked.format, leaks: JSON.stringify(locked).includes('world'), back: good.hello, bad };
  });
  ok(r.fmt === 'lexiko-backup-locked' && !r.leaks && r.back === 'world' && r.bad === 'wrong', 'a locked backup hides its contents, opens with the right passphrase and refuses a wrong one');

  // noun and adjective endings chart, counted from the text; help page; settings fold
  await page.goto(URL + '#/parse'); await page.waitForSelector('button:has-text("Charts")'); await page.click('button:has-text("Charts")'); await page.click('button:has-text("Noun endings")');
  ok(await page.locator('dialog.charts .cblock').count() === 4 && await page.locator('dialog.charts .csec').count() === 2, 'noun endings: the two charts, each with first/second and third declension');
  const txt = await page.locator('dialog.charts .cbody').innerText();
  ok(/Master case endings/.test(txt) && /ος/.test(txt) && /ῳ/.test(txt) && /σι\(ν\)/.test(txt) && !/%/.test(txt), 'noun charts show the grammar’s endings');
  await page.click('dialog button:has-text("Contractions")');
  const ct = await page.locator('dialog.charts .cbody').innerText();
  ok(/Single vowels/.test(ct) && /Vowels and diphthongs/.test(ct) && await page.locator('dialog.charts td.hi').count() === 0, 'contractions chart shows both tables, nothing highlighted');
  await page.keyboard.press('Escape');
  // opening the noun chart from parse feedback highlights the case/number row in both charts
  await page.evaluate(async () => { const m = await import('./js/charts.js'); m.openCharts({ tab: 'nouns', highlight: { case: 'G', number: 'P' } }); });
  ok(await page.locator('dialog.charts tr.hi').count() === 4 && /Genitive/.test(await page.locator('dialog.charts tr.hi').first().innerText()), 'noun chart highlights the genitive plural row in each table');
  await page.keyboard.press('Escape');
  // progress milestone appears once some words are known
  await page.evaluate(async () => { const k = await import('./js/know.js'); for (let n = 1; n <= 40; n++) await k.markKnown(n); });
  await page.goto(URL + '#/progress'); await page.waitForSelector('.milestone');
  ok(/You know \d+ words?, which makes up \d+(\.\d+)?% of the New Testament text/.test(await page.textContent('.milestone')), 'progress opens with one calm milestone sentence');
  await page.keyboard.press('Escape');
  await page.goto(URL + '#/help'); await page.waitForSelector('summary:has-text("Reading")'); ok(await page.locator('details').count() >= 5, 'help page has sections');
  await page.goto(URL + '#/settings'); await page.waitForSelector('summary:has-text("Advanced")'); ok(!(await page.locator('text=Memory target').first().isVisible()), 'advanced settings start folded');
  // phone width: the reader (with its Previous / Mark as read / Next footer) must not stretch the page
  { const pctx = await b.newContext({ viewport: { width: 320, height: 700 }, isMobile: true, hasTouch: true }); const pp = await pctx.newPage();
    await pp.goto(URL); await pp.waitForSelector('#loading', { state: 'detached' });
    await pp.click('.choice:has-text("I know the basics")'); await pp.click('button:has-text("Continue")'); await pp.click('button:has-text("Skip for now")'); await pp.waitForSelector('.hero');
    await pp.goto(URL + '#/read/JHN/1'); await pp.waitForSelector('[data-t]');
    const o = await pp.evaluate(() => ({ cw: document.documentElement.clientWidth, sw: document.documentElement.scrollWidth }));
    ok(o.sw <= o.cw + 1, 'reader fits a 320px phone without sideways scrolling ' + JSON.stringify(o)); await pctx.close(); }
  ok(errors.length === 0, 'no console/page errors ' + errors.join('|'));
  await b.close();
  console.log(fails ? '\n' + fails + ' FAILURES' : '\nALL PASSED'); process.exit(fails ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
