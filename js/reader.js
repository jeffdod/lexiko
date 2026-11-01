// The reader: Greek text with tap/click word popups, optional glosses for unknown words, readiness per chapter.
import { D, tokenForm, tokenPunct, tokenFlag, chapterVerses, lexeme, senseNs, scopeLabel, periScope, periRange } from './data.js';
import { decode } from './morph.js';
import { K, status, setting, setSetting, markKnown, markLearning, scopeReadiness, readinessLabel, readinessClass, markRead, setReadKey } from './know.js';
import { h, clear, toAcute, pct, toast, icon } from './util.js';

const esc = (s) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const fmt = (n) => n.toLocaleString('en-US');

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

function statusChip(n) {
  const s = status(n), c = K.cards.get('w:' + n);
  if (s === 'known') return h('span.chip.good', c ? '✓ Known' : '✓ Assumed known');
  if (s === 'learning') return h('span.chip.warn', '◐ Learning');
  return h('span.chip.bad', '○ New to you');
}

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
    {
      const act = h('div.row.wrap', { style: { marginTop: '.6rem' } });
      if (status(L.n) !== 'known' || !K.cards.has('w:' + L.n)) {
        act.append(h('button.btn.sm', { onclick: async () => { await markKnown(L.n); toast('Marked as known'); onStatus && onStatus(); } }, '✓ I know this'));
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
  const sc = periScope(p), rd = scopeReadiness(sc), read = !!K.read[p.id];
  return h('h3.peri', { id: 'pe-' + p.c1 + '-' + p.v1 },
    h('span.pt', h('span.pref', periRange(p)), p.title),
    h('span.pm', h('span.rdy.' + readinessClass(rd.known), pct(rd.known)),
      rd.distinctUnknown ? h('a.btn.sm', { href: '#/learn/passage/' + [sc.book, sc.c1, sc.v1, sc.c2, sc.v2].join('/') }, 'Study') : null,
      h('button.btn.sm' + (read ? '.primary' : ''), { dataset: { act: 'pread', pid: p.id }, 'aria-pressed': String(read), title: read ? 'Marked as read' : 'Mark this section as read' }, '✓'))).outerHTML;
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
    clear(meta).append(
      h('span.rdy.' + readinessClass(rd.known), pct(rd.known) + ' known · ' + readinessLabel(rd.known)),
      h('span.row', rd.distinctUnknown ? h('a.btn.sm', { href: '#/learn/passage/' + [book.code, ch, 1, ch, 999].join('/') }, icon('learn', 16), 'Study ' + rd.distinctUnknown + ' words') : h('span.chip.good', 'No new words'),
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
  clear(view).append(bar, meta, body, foot);

  // word interactions (delegated)
  const wordOf = (e) => e.target.closest && e.target.closest('.w');
  const click = async (e) => {
    const act = e.target.closest && e.target.closest('[data-act="pread"]');
    if (act) { const id = act.dataset.pid, on = !K.read[id]; await setReadKey(id, on); toast(on ? 'Section marked as read' : 'Unmarked'); return redraw(); }
    const w = wordOf(e); if (w) { e.preventDefault(); showPop(w, true, redraw); } };
  const redraw = () => { const y = scrollY; draw(); scrollTo(0, y); if (popAnchor) { const el = body.querySelector('.w[data-t="' + popAnchor.dataset.t + '"]'); if (el) showPop(el, true, redraw); } };
  const outside = (e) => { if (pop && !pop.hidden && popPinned && !pop.contains(e.target) && !wordOf(e)) hidePop(); };
  const esc_ = (e) => { if (e.key === 'Escape') hidePop(); };
  body.addEventListener('click', click);
  document.addEventListener('pointerdown', outside); document.addEventListener('keydown', esc_);

  if (vsS) { const v = body.querySelector('#v' + (+vsS)); if (v) { v.classList.add('focus'); requestAnimationFrame(() => v.scrollIntoView({ block: 'center' })); } } else scrollTo(0, 0);
  return () => { hidePop(); document.removeEventListener('pointerdown', outside); document.removeEventListener('keydown', esc_); view.style.removeProperty('--reader-size'); };
}
