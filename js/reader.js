// The reader: Greek text with tap/click word popups, optional glosses for unknown words, readiness per chapter.
import { D, tokenForm, tokenPunct, tokenFlag, chapterVerses, lexeme, senseNs, periScope, periRange, loadEnglish, englishVerse } from './data.js';
import { decode } from './morph.js';
import { K, status, setting, setSetting, markKnown, markLearning, scopeReadiness, passageStudy, waitNote, readinessLabel, readinessClass, markRead, setReadKey, sectionRead, unmarkSection, setGoal, currentGoal, goalLabel } from './know.js';
import { partsGrid } from './partforms.js';
import { barTracker } from './readbars.js';
import { clueRef } from './clueref.js';
import { rowOfTag } from './families.js';
import { h, clear, toAcute, pct, toast, icon, fmt, knowButtons, readBack, askDialog } from './util.js';

const esc = (s) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
/** A verse's English as HTML. [Bracketed] words are words the translators supplied; they show in italics, without the brackets. */
const englishHTML = (t) => esc(t).replace(/\[([^\]]*)\]/g, '<i>$1</i>');

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
      h('div.row.wrap', h('span.head', { lang: 'grc' }, L.head), h('span.chip.strongs', 'Strong’s ' + (L.base || L.n)), L.name ? null : statusChip(L.n)),
      h('div.gloss', L.brief),
      h('div.parse', h('b', m.posName), m.summary ? ' · ' + m.summary : '', h('div', h('code', m.code))),
      h('div.muted.small', 'Occurs ' + fmt(L.freq) + '× in the text · frequency rank ' + fmt(L.rank)),
    );
    if (L.full) block.append(h('details', h('summary', 'Fuller definition'), h('div', L.full)));
    const pe = L.verb ? D.parts.get(L.n) : null;
    if (pe && pe.parts.slice(1).some(Boolean)) {
      block.append(h('details.pparts', h('summary', 'Principal parts'), partsGrid(L.n, pe, PART_NAMES)));
    } else if (L.verb) block.append(h('div.muted.small', 'This verb doesn’t have principal parts.'));
    {
      const act = h('div.row.wrap', { style: { marginTop: '.6rem' } });
      if (!L.name && (status(L.n) !== 'known' || !K.cards.has('w:' + L.n))) {
        act.append(...knowButtons(L, markKnown, onStatus));
      }
      if (L.verb && rowOfTag(a.m, a.s)) act.append(h('button.btn.sm', { onclick: () => {
        const vs = popAnchor && popAnchor.isConnected ? popAnchor.closest('.verse') : null;
        clueRef.back = location.hash; clueRef.verse = null;
        if (vs) {                                                 // a verse split by a paragraph break is in two parts; join them
          const parts = vs.dataset.vs ? [...document.querySelectorAll('.verse[data-vs="' + vs.dataset.vs + '"]')] : [vs], txt = [];
          for (const part of parts) { const c = part.cloneNode(true); c.querySelectorAll('.vn, .gl, .en').forEach((e) => e.remove()); txt.push(c.textContent); }
          clueRef.verse = txt.join(' ').replace(/\u00ad/g, '').replace(/\s+/g, ' ').trim();
        }
        location.hash = '#/parse/run/clues/form/' + (token >> 4) + '/' + f.an.indexOf(a);
      } }, 'Find the clues'));
      if (L.name) { /* a name is never quizzed, so there is nothing to add */ }
      else if (status(L.n) === 'known') act.append(h('button.btn.sm', { onclick: async () => { await markLearning(L.n); toast('Added to words to review'); onStatus && onStatus(); } }, '↺ Review this'));
      else act.append(h('button.btn.sm', { onclick: async () => { await markLearning(L.n); toast('Added to your learning list'); onStatus && onStatus(); } }, '+ Learn this'));
      if (act.children.length) block.append(act);
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
  let out = '<span class="verse" id="v' + vs + '" data-vs="' + vs + '">';
  if (opts.english) out += '<span class="gk">';           // the Greek in one piece, so the English can sit under it (or beside it on a wide screen)
  if (opts.lead != null) out += opts.lead;                  // plain run-in number (and ¶) of verse by verse and of the English layout
  else if (opts.verseNums) out += '<span class="vn">' + vs + '</span>';
  const sn = senseNs(toks);
  for (let k = 0; k < toks.length; k++) {
    const t = toks[k];
    if (k && opts.breaks && opts.breaks.includes(k + 1)) out += opts.pilcrow ? '<span class="pil" aria-hidden="true">\u00b6</span> ' : '</span></p><p><span class="verse" data-vs="' + vs + '">';          // a paragraph begins in the middle of this verse (verse by verse: a ¶ marks it)
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
  if (opts.english) {
    out += '</span>';
    const en = opts.english(vs);
    if (en) out += '<span class="en" lang="en">' + englishHTML(en) + '</span>';
  }
  return out + '</span> ';
}

/** The plain verse number that opens a verse in verse by verse and beside the English, with a ¶ before it when a paragraph begins at the verse. */
function runIn(vs, marks, nums) {
  const pil = marks && marks[0] === 1 ? '<span class="pil" aria-hidden="true">\u00b6</span>' : '';
  return pil || nums ? '<span class="vh">' + pil + (nums ? '<span class="nm">' + vs + '</span>' : '') + '</span>' : '';
}

/** A book name for a small button: Corinthians and Thessalonians are shortened, the rest stay as they are. */
export const shortBook = (name) => name.replace('Corinthians', 'Cor').replace('Thessalonians', 'Thess');

/** Section heading with its readiness; a study shortcut and a read toggle open from the ⋯ button. */
function headingHTML(p) {
  const sc = periScope(p), rd = scopeReadiness(sc), read = sectionRead(p);
  // a quiet heading: the title, then one muted line (range, how much you know, section read); Study and the read mark are behind the ⋯ button
  return h('h3.peri', { id: 'pe-' + p.c1 + '-' + p.v1 },
    h('span.pt', p.title),
    h('span.psub', h('span', periRange(p) + ' · ' + pct(rd.known) + ' known' + (read ? ' · Section read' : '')),
      h('button.pmore', { type: 'button', dataset: { act: 'pmenu' }, 'aria-expanded': 'false', 'aria-label': 'Section options', title: 'Section options' }, '⋯')),
    h('span.pmenu', { hidden: true },
      rd.distinctUnknown ? h('a.btn.sm', { href: '#/learn/passage/' + [sc.book, sc.c1, sc.v1, sc.c2, sc.v2].join('/') }, 'Study these words') : null,
      h('button.btn.sm' + (read ? '.primary' : ''), { dataset: { act: 'pread', pid: p.id, pspan: p.c1 + '-' + p.c2 }, 'aria-pressed': String(read) }, read ? '✓ Section marked as read' : 'Mark section as read'))).outerHTML;
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
  const target = (dir) => {                                       // the chapter before or after this one (the Bible wraps around at its ends)
    let bi = book.i, ci = idx + dir;
    if (ci < 0) { bi = (bi + D.books.length - 1) % D.books.length; const b = D.books[bi]; return { b, ch: b.chapters[b.chapters.length - 1][0] }; }
    if (ci >= chs.length) { bi = (bi + 1) % D.books.length; return { b: D.books[bi], ch: D.books[bi].chapters[0][0] }; }
    return { b: book, ch: chs[ci] };
  };
  const nav = (dir) => { const t = target(dir); return readHref(t.b.code, t.ch); };
  /** Where a bottom button goes, in a few words: "1 John 3". The two longest book names are shortened so the label stays on one line. */
  const navLabel = (dir) => { const t = target(dir); return shortBook(t.b.name) + ' ' + t.ch; };
  /** The Previous (-1) or Next (1) button. The top bar and the foot of the chapter both use this, so they always match. */
  const navBtn = (dir) => h('a.btn.navbtn', { href: nav(dir), 'aria-label': (dir < 0 ? 'Previous chapter: ' : 'Next chapter: ') + target(dir).b.name + ' ' + target(dir).ch },
    ...(dir < 0 ? [icon('chevL', 18), navLabel(dir)] : [navLabel(dir), icon('chevR', 18)]));

  const body = h('div.reader', { lang: 'grc' });
  const meta = h('div.row.wrap.between', { style: { margin: '.2rem 0 .6rem' } });
  const foot = h('div');
  const draw = () => {
    const eng = setting('english') && D.english[book.code];            // this book's English, once it has loaded
    const opts = { verseNums: setting('verseNums'), gloss: setting('glossMode'), glossRepeat: setting('glossRepeat'), english: eng ? (vs) => englishVerse(book.code, ch, vs) : null };
    view.style.setProperty('--reader-size', setting('readerSize') + 'rem');
    body.classList.toggle('hl', !!setting('highlight'));
    body.classList.toggle('par', !!eng);
    // paragraphs: only where the marks exist for this book, and not beside the English (that layout is one verse at a time)
    const paras = D.parasBooks.has(book.code) && !eng;
    const vmode = setting('paraStyle') === 'verse' && !eng;      // verse by verse: one verse to a line block, ¶ where a paragraph begins (no ¶ in a book without marks)
    body.classList.toggle('pv', vmode);
    body.classList.toggle('nonum', vmode && !opts.verseNums);
    body.classList.toggle('pi', paras && !vmode && setting('paraStyle') !== 'block');
    body.classList.toggle('pb', paras && !vmode && setting('paraStyle') === 'block');
    body.classList.toggle('rag', setting('lineEnds') === 'ragged');
    body.dataset.lh = setting('lineSpacing');
    const heads = setting('sectionHeads') !== false;           // off: no headings, and a section no longer breaks the paragraph
    const seen = new Set(); let html = '', open = false;
    for (const [vs, toks] of chapterVerses(book.code, ch)) {
      const sec = D.periAt.get(book.code + ':' + ch + ':' + vs);
      const marks = paras ? D.paras.get(book.code + ':' + ch + ':' + vs) : null;
      if (vmode) {
        if (sec && heads) html += headingHTML(sec);
        html += '<p class="vv">' + verseHTML(vs, toks, seen, { ...opts, verseNums: false, pilcrow: true, breaks: marks && marks.filter((m) => m > 1), lead: runIn(vs, marks, opts.verseNums) }) + '</p>';
        continue;
      }
      if (sec && heads) { if (open) html += '</p>'; html += headingHTML(sec); html += '<p>'; open = true; }       // a section heading starts a new paragraph
      else if (!open) { html += '<p>'; open = true; }
      else if (marks && marks[0] === 1) html += '</p><p>';
      if (eng) {                                                 // beside the English: the same plain number and ¶ as verse by verse, and a ¶ for a break inside the verse
        const pm = D.parasBooks.has(book.code) ? D.paras.get(book.code + ':' + ch + ':' + vs) : null;
        html += verseHTML(vs, toks, seen, { ...opts, verseNums: false, pilcrow: true, breaks: pm && pm.filter((m) => m > 1), lead: runIn(vs, pm, opts.verseNums) });
        continue;
      }
      html += verseHTML(vs, toks, seen, marks ? { ...opts, breaks: marks } : opts);
    }
    body.innerHTML = html + (open && !vmode ? '</p>' : '');
    // readiness
    const sc = { book: book.code, c1: ch, v1: 1, c2: ch, v2: 999 }, rd = scopeReadiness(sc);
    const cg = currentGoal(), isGoal = cg.kind === 'passage' && cg.book === book.code && cg.c1 === ch && cg.c2 === ch && (cg.v1 || 1) === 1 && cg.v2 >= (book.chapters.find((c) => c[0] === ch) || [0, 999])[1];
    clear(meta).append(
      h('span.rdy.' + readinessClass(rd.known), pct(rd.known) + ' known · ' + readinessLabel(rd.known)),
      h('span.row', rd.distinctUnknown ? (isGoal ? h('span.chip.good', 'Your goal') : h('button.btn.sm', { onclick: async () => { const ng = { kind: 'passage', book: book.code, c1: ch, v1: 1, c2: ch, v2: 999 };
          if (K.goal && !(await askDialog({ title: 'Replace your goal?', body: ['Your goal is “' + goalLabel(cg) + '”. Make ' + goalLabel(ng) + ' your goal instead?', 'Your word progress stays as it is. Only the target changes.'], yes: 'Replace goal', no: 'Keep my goal' }))) return;      // a goal you chose is not swapped by one stray tap
          await setGoal(ng); toast('This chapter is now your goal'); draw(); } }, icon('target', 16), 'Make this my goal')) : h('span.chip.good', 'No new words'),
        rd.distinctUnknown ? h('button.btn.sm' + (setting('glossMode') ? '.primary' : ''), { 'aria-pressed': !!setting('glossMode'), onclick: async () => { await setSetting('glossMode', !setting('glossMode')); draw(); } }, setting('glossMode') ? 'Hide meanings' : 'Show meanings') : null),      // meanings are for words you do not know yet: with none, there is nothing to show
    );
    const read = !!K.read[book.code + ':' + ch];
    clear(foot).append(
      h('div.readfoot', navBtn(-1),
        h('button.btn' + (read ? '.primary' : ''), { onclick: async () => { await markRead(book.code, ch, !read); toast(read ? 'Chapter unmarked' : 'Chapter marked as read'); draw(); } }, read ? [icon('check', 18), 'Chapter marked as read'] : 'Mark chapter as read'),
        navBtn(1)));
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
    const sw = (label, desc, key, before) => h('label.switch', h('span', h('div.t', label), h('div.d', desc)),
      h('input', { type: 'checkbox', checked: !!setting(key), onchange: async (e) => { await setSetting(key, e.target.checked); if (before) await before(e.target.checked); draw(); } }));
    const choice = (label, desc, key, opts) => {
      const seg = h('div.seg.fit', { role: 'group', 'aria-label': label }, opts.map(([v, t]) => h('button', { 'aria-pressed': String(setting(key) === v), onclick: async () => { await setSetting(key, v); [...seg.children].forEach((b, i) => b.setAttribute('aria-pressed', String(opts[i][0] === v))); draw(); } }, t)));
      return h('div', { style: { padding: '.7rem 0', borderTop: '1px solid var(--line)' } }, h('div.t', { style: { fontWeight: 600 } }, label), desc ? h('div.d.muted.small', { style: { marginBottom: '.4rem' } }, desc) : null, seg);
    };
    dlg.append(h('div.row.between', h('h2', 'Reading options'), h('button.btn.ghost.icon.sm', { 'aria-label': 'Close', onclick: () => dlg.close() }, icon('close', 18))),
      sw('Repeat meanings', 'When meanings are showing, show one on every occurrence, not just the first in the chapter.', 'glossRepeat'),
      sw('Highlight unknown words', 'Blue = new to you, gold = still learning.', 'highlight'),
      sw('Section headings', 'Show the section titles, with each section’s progress and a ⋯ menu for Study and the read mark.', 'sectionHeads'),
      sw('Verse numbers', '', 'verseNums'),
      sw('English translation', 'Show the American Standard Version Byzantine Text with each verse.', 'english', async (on) => {
        if (on && !D.english[book.code]) { try { await loadEnglish(book.code); } catch { toast('The English translation could not be loaded'); } }
      }),
      choice('Paragraphs', 'Verse by verse puts each verse on its own, with a ¶ where a paragraph begins. Not used while the English translation is on, which is already one verse at a time.', 'paraStyle', [['indent', 'Indented'], ['block', 'Block'], ['verse', 'Verse by verse']]),
      choice('Line ends', '', 'lineEnds', [['justify', 'Justified, hyphenated'], ['ragged', 'Left, ragged right']]),
      choice('Line spacing', '', 'lineSpacing', [['tight', 'Tight'], ['normal', 'Normal'], ['roomy', 'Roomy'], ['extra', 'Extra']]),
      h('div.row.between', { style: { padding: '.7rem 0', borderTop: '1px solid var(--line)' } }, h('span.t', { style: { fontWeight: 600 } }, 'Text size'),
        h('span.row', h('button.btn.sm', { onclick: async () => { await setSetting('readerSize', Math.max(0.95, +(setting('readerSize') - 0.1).toFixed(2))); draw(); } }, 'A−'),
          h('button.btn.sm', { onclick: async () => { await setSetting('readerSize', Math.min(2.4, +(setting('readerSize') + 0.1).toFixed(2))); draw(); } }, 'A+'))));
    document.body.append(dlg); dlg.addEventListener('close', () => dlg.remove()); dlg.showModal();
  };

  const bar = h('div.readbar',
    h('div.row', h('button.title.grow', { onclick: pick, 'aria-label': 'Choose book and chapter' }, book.name + ' ' + ch, h('span.muted', '▾')),
      h('button.btn.ghost.sm', { onclick: options, 'aria-label': 'Reading options' }, 'Aa')),
    h('div.navpair', navBtn(-1), navBtn(1)));
  clear(view).append(...[readBack(), bar, meta, body, foot].filter(Boolean));      // readBack() is null unless the reader was opened from search or a Learn page

  // word interactions (delegated)
  const wordOf = (e) => e.target.closest && e.target.closest('.w');
  let calm = 0;
  const click = async (e) => {
    const mb = e.target.closest && e.target.closest('[data-act="pmenu"]');
    if (mb) { const m = mb.closest('.peri').querySelector('.pmenu'); m.hidden = !m.hidden; mb.setAttribute('aria-expanded', String(!m.hidden)); return; }
    const act = e.target.closest && e.target.closest('[data-act="pread"]');
    if (act) { const id = act.dataset.pid, [c1, c2] = act.dataset.pspan.split('-').map(Number), sec = { id, code: id.split(':')[1], c1, c2 }, on = !sectionRead(sec); if (on) await setReadKey(id, true); else await unmarkSection(sec); toast(on ? 'Section marked as read' : 'Section unmarked'); return redraw(); }
    const w = wordOf(e); if (w) { e.preventDefault(); showPop(w, true, redraw); } };
  const redraw = () => { const y = scrollY; calm = performance.now() + 500; draw(); scrollTo(0, y); if (popAnchor) { const el = body.querySelector('.w[data-t="' + popAnchor.dataset.t + '"]'); if (el) showPop(el, true, redraw); } };
  const outside = (e) => { if (pop && !pop.hidden && popPinned && !pop.contains(e.target) && !wordOf(e)) hidePop(); };
  const esc_ = (e) => { if (e.key === 'Escape') hidePop(); };
  body.addEventListener('click', click);
  document.addEventListener('pointerdown', outside); document.addEventListener('keydown', esc_);

  // On a phone the top bar and the bottom navigation slide away while you read down the page, and come back when you scroll up,
  // tap a blank spot, press a key, or reach the top. Tapping a word leaves them as they are. (CSS only applies it on a narrow screen.)
  const tr = barTracker(), bars = (on, why) => { document.body.classList.toggle('rd-hide', !on); tr.set(on, scrollY); };
  // Shown by scrolling up, a tap or a key, the bars slide away again a moment after you stop. A check every 300ms does it, so it holds
  // however the bars came up. They wait while you are at the top or bottom of the chapter, a dialog is open, or keyboard focus is in a bar.
  let holdUntil = performance.now() + 3000, lastWhy = '';
  const hold = (ms) => { holdUntil = performance.now() + ms; };
  const atEnd = () => scrollY + innerHeight > document.documentElement.scrollHeight - 80;
  const waitsFor = () => {
    if (scrollY < 80) return 'at the top'; if (atEnd()) return 'at the bottom'; if (document.querySelector('dialog[open]')) return 'a dialog is open';
    const f = document.activeElement; if (f && f.closest && f.closest('.readbar, #nav') && f.matches(':focus-visible')) return 'keyboard focus is in a bar';
    return '';
  };
  const beat = setInterval(() => {
    if (document.body.classList.contains('rd-hide')) { lastWhy = ''; return; }
    if (performance.now() < holdUntil) return;
    const why = waitsFor(); if (why) { lastWhy = why; return; }
    lastWhy = ''; bars(false, 'idle');
  }, 300);
  calm = performance.now() + 700;
  const onScroll = () => {
    const y = scrollY; hold(1500);        // any scrolling keeps the bars up until it has stopped for a moment
    if (y < 80 || atEnd() || document.querySelector('dialog[open]')) return document.body.classList.contains('rd-hide') ? bars(true, y < 80 ? 'top' : atEnd() ? 'bottom' : 'dialog') : tr.set(true, y);
    if (performance.now() < calm) return tr.set(!document.body.classList.contains('rd-hide'), y);      // the page's own jump (opening at a verse, redrawing) is not reading; a fast flick is
    const r = tr.feed(y); if (r !== null) bars(r, r ? 'scrolled up' : 'scrolled down');
  };
  const blankTap = (e) => { if (!e.target.closest('.w, a, button, input, select, textarea, #pop, dialog')) { bars(true, 'blank tap'); hold(3500); } };
  const anyKey = (e) => { bars(true, 'key ' + e.key); hold(4000); };
  const barTouch = (e) => { if (e.target.closest('.readbar, #nav')) hold(4000); };
  addEventListener('scroll', onScroll, { passive: true }); view.addEventListener('click', blankTap); document.addEventListener('keydown', anyKey); document.addEventListener('pointerdown', barTouch);

  const placeVerse = () => { const vv = [...body.querySelectorAll('.verse[data-vs="' + (+vsS) + '"]')]; if (vv.length) { vv.forEach((v) => v.classList.add('focus')); requestAnimationFrame(() => vv[0].scrollIntoView({ block: 'center' })); } };
  if (vsS) placeVerse(); else scrollTo(0, 0);
  // The route renderer is synchronous, so the Greek shows first and this book's English folds in when it has loaded.
  let alive = true;
  if (setting('english') && !D.english[book.code]) {
    loadEnglish(book.code).then(() => {
      if (!alive) return;
      calm = performance.now() + 500;
      const y = scrollY; draw();
      if (vsS && y < 80) placeVerse(); else scrollTo(0, y);
    }).catch(() => toast('The English translation could not be loaded'));
  }
  return () => { alive = false; hidePop(); clearInterval(beat); bars(true, 'leaving'); document.removeEventListener('pointerdown', barTouch); removeEventListener('scroll', onScroll); view.removeEventListener('click', blankTap); document.removeEventListener('keydown', anyKey); document.removeEventListener('pointerdown', outside); document.removeEventListener('keydown', esc_); view.style.removeProperty('--reader-size'); };
}
