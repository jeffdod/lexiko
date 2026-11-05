// The reader: Greek text with tap/click word popups, optional glosses for unknown words, readiness per chapter.
import { D, tokenForm, tokenPunct, tokenFlag, chapterVerses, lexeme, senseNs, periScope, periRange } from './data.js';
import { decode } from './morph.js';
import { K, status, setting, setSetting, markKnown, markLearning, scopeReadiness, passageStudy, waitNote, readinessLabel, readinessClass, markRead, setReadKey, sectionRead, unmarkSection, setGoal, currentGoal } from './know.js';
import { partsGrid } from './partforms.js';
import { barTracker } from './readbars.js';
import { h, clear, toAcute, pct, toast, icon, fmt, knowButtons, readBack } from './util.js';

const esc = (s) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export const readHref = (code, ch, vs) => '#/read/' + code + '/' + ch + (vs ? '/' + vs : '');

/* ---------------- word popup (bottom sheet on phones, floating card on larger screens) ---------------- */
let pop = null, popAnchor = null, popPinned = false, hideTimer = 0, onChange = () => {};

function ensurePop() {
  if (pop) return pop;
  pop = h('div#pop', { role: 'dialog', 'aria-label': 'Word details', hidden: true });
  pop.addEventListener('pointerenter', () => clearTimeout(hideTimer));
  pop.addEventListener('pointerleave', (e) => { if (!popPinned && e.pointerType === 'mouse') scheduleHide(); });
  document.body.append(pop);
  return pop;
}
export function hidePop() {
  if (!pop) return;
  pop.hidden = true; popPinned = false;
  if (popAnchor) popAnchor.classList.remove('sel'); popAnchor = null;
}
function scheduleHide() { clearTimeout(hideTimer); hideTimer = setTimeout(() => { if (!popPinned) hidePop(); }, 280); }

export function statusChip(n) {
  const s = status(n), c = K.cards.get('w:' + n);
  if (s === 'known') return h('span.chip.good', c ? '✓ Known' : '✓ Assumed known');
  if (s === 'learning') return h('span.chip.warn', '◐ Learning');
  return h('span.chip.bad', '○ New to you');
}

const PART_NAMES = ['Present', 'Future', 'Aorist active', 'Perfect active', 'Perfect mid/pas', 'Aorist passive'];

export function popupBody(token, { onStatus, eff = 0, unsure = false } = {}) {
  const f = tokenForm(token);
  const wrap = h('div', h('div.form', { lang: 'grc' }, toAcute(f.plain)));
  // a preposition that is learned per case shows the sense for the case it governs here (or every sense when that is unclear)
  const entries = [];
  f.an.forEach((a, i) => {
    const L0 = lexeme(a.s);
    if (i === 0 && L0.senses && eff) { (unsure ? L0.senseNs : [eff]).forEach((n) => entries.push({ L: lexeme(n), a, sense: true })); } else entries.push({ L: L0, a });
  });
  entries.forEach(({ L, a }, i) => {
    const m = decode(a.m);
    const block = h('div', { style: i ? { marginTop: '.8rem', paddingTop: '.7rem', borderTop: '1px dashed var(--line)' } : {} });
    if (i) block.append(h('div.muted.small', { style: { marginBottom: '.2rem', fontWeight: 700 } }, 'Also possible'));
    block.append(
      h('div.row.wrap', h('span.head', { lang: 'grc' }, L.head), h('span.chip.accent', 'G' + (L.base || L.n)), statusChip(L.n)),
      h('div.gloss', L.brief),
      h('div.parse', h('b', m.posName), m.summary ? ' · ' + m.summary : '', h('div', h('code', m.code))),
      h('div.muted.small', 'Occurs ' + fmt(L.freq) + '× in the text · frequency rank ' + fmt(L.rank)),
    );
    if (L.full) block.append(h('details', h('summary', 'Fuller definition'), h('div', L.full)));
    const pe = L.pos === 'V' ? D.parts.get(L.n) : null;
    if (pe && pe.parts.slice(1).some(Boolean)) {
      block.append(h('details.pparts', h('summary', 'Principal parts'), partsGrid(L.n, pe, PART_NAMES)));
    } else if (L.pos === 'V') block.append(h('div.muted.small', 'This verb doesn’t have principal parts.'));
    {
      const act = h('div.row.wrap', { style: { marginTop: '.6rem' } });
      if (status(L.n) !== 'known' || !K.cards.has('w:' + L.n)) {
        act.append(...knowButtons(L, markKnown, onStatus));
      }
      if (status(L.n) === 'known') act.append(h('button.btn.sm', { onclick: async () => { await markLearning(L.n); toast('Added to words to review'); onStatus && onStatus(); } }, '↺ Review this'));
      else act.append(h('button.btn.sm', { onclick: async () => { await markLearning(L.n); toast('Added to your learning list'); onStatus && onStatus(); } }, '+ Learn this'));
      block.append(act);
    }
    wrap.append(block);
  });
  return wrap;
}

function showPop(el, pinned, rerender) {
  ensurePop();
  clearTimeout(hideTimer);
  if (popAnchor && popAnchor !== el) popAnchor.classList.remove('sel');
  popAnchor = el; popPinned = pinned; el.classList.add('sel');
  clear(pop);
  pop.append(h('button.btn.ghost.icon.sm.x', { 'aria-label': 'Close', onclick: hidePop }, icon('close', 18)), popupBody(+el.dataset.t, { eff: +el.dataset.s, unsure: el.dataset.u === '1', onStatus: () => { hidePop(); rerender(); } }));
  pop.hidden = false;
  if (matchMedia('(min-width: 700px)').matches) {
    const r = el.getBoundingClientRect(), pw = pop.offsetWidth, ph = pop.offsetHeight;
    let top = r.bottom + 8; if (top + ph > innerHeight - 8) top = Math.max(8, r.top - ph - 8);
    pop.style.top = top + 'px'; pop.style.left = Math.min(Math.max(8, r.left - 16), innerWidth - pw - 8) + 'px';
  } else { pop.style.top = pop.style.left = ''; }
}

/* ---------------- text rendering ---------------- */
function verseHTML(vs, toks, seenGloss, opts) {
  let out = '<span class="verse" id="v' + vs + '">';
  if (opts.verseNums) out += '<span class="vn">' + vs + '</span>';
  const sn = senseNs(toks);
  for (let k = 0; k < toks.length; k++) {
    const t = toks[k];
    const f = tokenForm(t), s = sn.ns[k], st = status(s);
    const cls = 'w' + (st === 'unknown' ? ' u' : st === 'learning' ? ' l' : '');
    const dash = tokenFlag(t);                         // source marker: an em-dash follows, with no space after it
    out += '<span class="' + cls + '" data-t="' + t + '" data-s="' + s + '"' + (sn.unsure[k] ? ' data-u="1"' : '') + '>' + esc(f.w) + '</span>' + tokenPunct(t) + (dash ? '\u2014' : '');
    let glossed = false;
    if (opts.gloss && st !== 'known' && (opts.glossRepeat || !seenGloss.has(s))) {
      seenGloss.add(s); glossed = true; out += ' <span class="gl">(' + esc(lexeme(s).short) + ')</span>';
    }
    out += dash && !glossed ? '' : ' ';
  }
  return out + '</span> ';
}

/** Section heading with its readiness, a study shortcut and a read toggle. */
function headingHTML(p) {
  const sc = periScope(p), rd = scopeReadiness(sc), read = sectionRead(p);
  return h('h3.peri', { id: 'pe-' + p.c1 + '-' + p.v1 },
    h('span.pt', h('span.pref', periRange(p)), p.title),
    h('span.pm', h('span.rdy.' + readinessClass(rd.known), pct(rd.known)),
      rd.distinctUnknown ? h('a.btn.sm', { href: '#/learn/passage/' + [sc.book, sc.c1, sc.v1, sc.c2, sc.v2].join('/') }, 'Study') : null,
      h('button.btn.sm' + (read ? '.primary' : ''), { dataset: { act: 'pread', pid: p.id, pspan: p.c1 + '-' + p.c2 }, 'aria-pressed': String(read), title: read ? 'Marked as read' : 'Mark this section as read' }, '✓'))).outerHTML;
}

/* ---------------- view ---------------- */
export function renderReader(view, params) {
  const [code = K.settings.lastBook || 'JHN', chS, vsS] = params;
  const book = D.bookByCode.get(code) || D.bookByCode.get('JHN');
  const chs = book.chapters.map((c) => c[0]);
  let ch = +chS || (K.settings.lastBook === book.code && K.settings.lastCh) || 1;
  if (!chs.includes(ch)) ch = chs[0];
  setSetting('lastBook', book.code); setSetting('lastCh', ch);
  const idx = chs.indexOf(ch);
  const nav = (dir) => {
    let bi = book.i, ci = idx + dir;
    if (ci < 0) { bi = (bi + D.books.length - 1) % D.books.length; const b = D.books[bi]; return readHref(b.code, b.chapters[b.chapters.length - 1][0]); }
    if (ci >= chs.length) { bi = (bi + 1) % D.books.length; return readHref(D.books[bi].code, D.books[bi].chapters[0][0]); }
    return readHref(book.code, chs[ci]);
  };

  const body = h('div.reader', { lang: 'grc' });
  const meta = h('div.row.wrap.between', { style: { margin: '.2rem 0 .6rem' } });
  const foot = h('div');
  const draw = () => {
    const opts = { verseNums: setting('verseNums'), gloss: setting('glossMode'), glossRepeat: setting('glossRepeat') };
    view.style.setProperty('--reader-size', setting('readerSize') + 'rem');
    body.classList.toggle('hl', !!setting('highlight'));
    const seen = new Set(); let html = '', open = false;
    for (const [vs, toks] of chapterVerses(book.code, ch)) {
      const sec = D.periAt.get(book.code + ':' + ch + ':' + vs);
      if (sec) { if (open) html += '</p>'; html += headingHTML(sec); html += '<p>'; open = true; }
      else if (!open) { html += '<p>'; open = true; }
      html += verseHTML(vs, toks, seen, opts);
    }
    body.innerHTML = html + (open ? '</p>' : '');
    // readiness
    const sc = { book: book.code, c1: ch, v1: 1, c2: ch, v2: 999 }, rd = scopeReadiness(sc);
    const cg = currentGoal(), isGoal = cg.kind === 'passage' && cg.book === book.code && cg.c1 === ch && cg.c2 === ch && (cg.v1 || 1) === 1 && cg.v2 >= (book.chapters.find((c) => c[0] === ch) || [0, 999])[1];
    clear(meta).append(
      h('span.rdy.' + readinessClass(rd.known), pct(rd.known) + ' known · ' + readinessLabel(rd.known)),
      h('span.row', rd.distinctUnknown ? (isGoal ? h('span.chip.good', 'Your goal') : h('button.btn.sm', { onclick: async () => { await setGoal({ kind: 'passage', book: book.code, c1: ch, v1: 1, c2: ch, v2: 999 }); toast('This chapter is now your goal'); draw(); } }, icon('target', 16), 'Make this my goal')) : h('span.chip.good', 'No new words'),
        h('button.btn.sm' + (setting('glossMode') ? '.primary' : ''), { 'aria-pressed': !!setting('glossMode'), onclick: async () => { await setSetting('glossMode', !setting('glossMode')); draw(); } }, 'Glosses')),
    );
    const read = !!K.read[book.code + ':' + ch];
    clear(foot).append(
      h('div.readfoot', h('a.btn', { href: nav(-1) }, icon('chevL', 18), 'Previous'),
        h('button.btn' + (read ? '.primary' : ''), { onclick: async () => { await markRead(book.code, ch, !read); toast(read ? 'Unmarked' : 'Marked as read'); draw(); } }, icon('check', 18), read ? 'Read' : 'Mark as read'),
        h('a.btn', { href: nav(1) }, 'Next', icon('chevR', 18))));
  };
  draw();

  // book / chapter picker
  const pick = () => {
    const dlg = h('dialog');
    let selBook = book;
    const render = () => {
      clear(dlg);
      const chapters = h('div.chaps', { style: { gridTemplateColumns: 'repeat(auto-fill,minmax(2.6rem,1fr))' } },
        selBook.chapters.map(([c]) => h('a.chap.r0', { href: readHref(selBook.code, c), onclick: () => dlg.close() }, c)));
      dlg.append(h('div.row.between', h('h2', 'Go to…'), h('button.btn.ghost.icon.sm', { 'aria-label': 'Close', onclick: () => dlg.close() }, icon('close', 18))),
        h('div.bookgrid', D.books.map((b) => h('button', { 'aria-pressed': b === selBook, onclick: () => { selBook = b; render(); } }, b.name))),
        h('h3', { style: { marginTop: '.8rem' } }, selBook.name), chapters);
    };
    render(); document.body.append(dlg); dlg.addEventListener('close', () => dlg.remove()); dlg.showModal();
  };
  const options = () => {
    const dlg = h('dialog');
    const sw = (label, desc, key) => h('label.switch', h('span', h('div.t', label), h('div.d', desc)),
      h('input', { type: 'checkbox', checked: !!setting(key), onchange: async (e) => { await setSetting(key, e.target.checked); draw(); } }));
    dlg.append(h('div.row.between', h('h2', 'Reading options'), h('button.btn.ghost.icon.sm', { 'aria-label': 'Close', onclick: () => dlg.close() }, icon('close', 18))),
      sw('Glosses for unknown words', 'Show a short gloss in parentheses after words you don’t know yet.', 'glossMode'),
      sw('Repeat glosses', 'Show the gloss on every occurrence, not just the first in the chapter.', 'glossRepeat'),
      sw('Underline unknown words', 'Dotted = new to you, dashed = still learning.', 'highlight'),
      sw('Verse numbers', '', 'verseNums'),
      sw('Bar diagnostics', 'Shows a strip at the top that says what hides and shows the bars. For troubleshooting.', 'barsDebug'),
      h('div.row.between', { style: { padding: '.7rem 0', borderTop: '1px solid var(--line)' } }, h('span.t', { style: { fontWeight: 600 } }, 'Text size'),
        h('span.row', h('button.btn.sm', { onclick: async () => { await setSetting('readerSize', Math.max(0.95, +(setting('readerSize') - 0.1).toFixed(2))); draw(); } }, 'A−'),
          h('button.btn.sm', { onclick: async () => { await setSetting('readerSize', Math.min(2.4, +(setting('readerSize') + 0.1).toFixed(2))); draw(); } }, 'A+'))));
    document.body.append(dlg); dlg.addEventListener('close', () => dlg.remove()); dlg.showModal();
  };

  const bar = h('div.readbar',
    h('div.row', h('a.btn.ghost.icon.sm', { href: nav(-1), 'aria-label': 'Previous chapter' }, icon('chevL', 20)),
      h('button.title.grow', { onclick: pick, 'aria-label': 'Choose book and chapter' }, book.name + ' ' + ch, h('span.muted', '▾')),
      h('button.btn.ghost.sm', { onclick: options, 'aria-label': 'Reading options' }, 'Aa'),
      h('a.btn.ghost.icon.sm', { href: nav(1), 'aria-label': 'Next chapter' }, icon('chevR', 20))));
  clear(view).append(...[readBack(), bar, meta, body, foot].filter(Boolean));      // readBack() is null unless the reader was opened from search or a Learn page

  // word interactions (delegated)
  const wordOf = (e) => e.target.closest && e.target.closest('.w');
  let calm = 0;
  const click = async (e) => {
    const act = e.target.closest && e.target.closest('[data-act="pread"]');
    if (act) { const id = act.dataset.pid, [c1, c2] = act.dataset.pspan.split('-').map(Number), sec = { id, code: id.split(':')[1], c1, c2 }, on = !sectionRead(sec); if (on) await setReadKey(id, true); else await unmarkSection(sec); toast(on ? 'Section marked as read' : 'Unmarked'); return redraw(); }
    const w = wordOf(e); if (w) { e.preventDefault(); showPop(w, true, redraw); } };
  const redraw = () => { const y = scrollY; calm = performance.now() + 500; draw(); scrollTo(0, y); if (popAnchor) { const el = body.querySelector('.w[data-t="' + popAnchor.dataset.t + '"]'); if (el) showPop(el, true, redraw); } };
  const outside = (e) => { if (pop && !pop.hidden && popPinned && !pop.contains(e.target) && !wordOf(e)) hidePop(); };
  const esc_ = (e) => { if (e.key === 'Escape') hidePop(); };
  body.addEventListener('click', click);
  document.addEventListener('pointerdown', outside); document.addEventListener('keydown', esc_);

  // On a phone the top bar and the bottom navigation slide away while you read down the page, and come back when you scroll up,
  // tap a blank spot, press a key, or reach the top. Tapping a word leaves them as they are. (CSS only applies it on a narrow screen.)
  // Optional diagnostics (Aa > Bar diagnostics): a strip listing each hide/show and what caused it, plus any change to the page's class from elsewhere.
  const dbg = setting('barsDebug') ? h('div#bardbg', { 'aria-hidden': 'true' }) : null, lines = [];
  const note = (t) => { if (!dbg) return; const d = new Date(); lines.push(String(d.getMinutes()).padStart(2, '0') + ':' + String(d.getSeconds()).padStart(2, '0') + ' ' + t); if (lines.length > 7) lines.shift(); dbg.textContent = lines.join('\n'); };
  if (dbg) { document.body.append(dbg); note('on, y=' + Math.round(scrollY) + ', width ' + innerWidth); }
  const tr = barTracker(), bars = (on, why) => { document.body.classList.toggle('rd-hide', !on); tr.set(on, scrollY); note((on ? 'SHOW ' : 'HIDE ') + (why || '?') + ' y=' + Math.round(scrollY)); };
  const watch = dbg && new MutationObserver(() => note('class now ' + (document.body.classList.contains('rd-hide') ? 'hidden' : 'shown'))); if (watch) watch.observe(document.body, { attributes: true, attributeFilter: ['class'] });
  calm = performance.now() + 700;
  const onScroll = () => {
    const y = scrollY;
    if (y < 80 || document.querySelector('dialog[open]')) return document.body.classList.contains('rd-hide') ? bars(true, y < 80 ? 'top' : 'dialog') : tr.set(true, y);
    if (performance.now() < calm) return tr.set(!document.body.classList.contains('rd-hide'), y);      // the page's own jump (opening at a verse, redrawing) is not reading; a fast flick is
    const r = tr.feed(y); if (r !== null) bars(r, r ? 'scrolled up' : 'scrolled down');
  };
  const blankTap = (e) => { note('tap ' + (e.target.closest('.w') ? 'on a word' : e.target.tagName.toLowerCase() + (e.target.className ? '.' + e.target.className : ''))); if (!e.target.closest('.w, a, button, input, select, textarea, #pop, dialog')) bars(true, 'blank tap'); };
  const anyKey = (e) => bars(true, 'key ' + e.key);
  addEventListener('scroll', onScroll, { passive: true }); view.addEventListener('click', blankTap); document.addEventListener('keydown', anyKey);

  if (vsS) { const v = body.querySelector('#v' + (+vsS)); if (v) { v.classList.add('focus'); requestAnimationFrame(() => v.scrollIntoView({ block: 'center' })); } } else scrollTo(0, 0);
  return () => { hidePop(); bars(true, 'leaving'); if (watch) watch.disconnect(); if (dbg) dbg.remove(); removeEventListener('scroll', onScroll); view.removeEventListener('click', blankTap); document.removeEventListener('keydown', anyKey); document.removeEventListener('pointerdown', outside); document.removeEventListener('keydown', esc_); view.style.removeProperty('--reader-size'); };
}
