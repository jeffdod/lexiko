// Word search: find a word by its Greek form (any accent), by English meaning, or by Strong's number,
// then see its meaning, where it occurs and the forms it takes. All Greek shown comes from the text and lexicon data.
import { D, lexeme, chapterVerses, senseNs, tokenForm, refLabel, unpack } from './data.js';
import { decode } from './morph.js';
import { status, markKnown, markLearning, K } from './know.js';
import { readHref, statusChip } from './reader.js';
import { h, clear, toAcute, toast, icon, fmt, knowButtons, backHead, scrollButton } from './util.js';

const GREEK = /[Ͱ-Ͽἀ-῿]/;
/** Compare Greek without accents, breathings or case; final sigma = sigma. */
const fold = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/ς/g, 'σ');

/** Beta Code (Latin letters, e.g. logos, a)gaph/, lo/gos) -> unaccented Greek, ready to compare with fold(). */
const BETA = { a: 'α', b: 'β', g: 'γ', d: 'δ', e: 'ε', z: 'ζ', h: 'η', q: 'θ', i: 'ι', k: 'κ', l: 'λ', m: 'μ', n: 'ν', c: 'ξ', o: 'ο', p: 'π', r: 'ρ', s: 'σ', t: 'τ', u: 'υ', f: 'φ', x: 'χ', y: 'ψ', w: 'ω' };
const MARKS = { ')': '̓', '(': '̔', '/': '́', '\\': '̀', '=': '͂', '+': '̈', '|': 'ͅ' };
const BETA_MARKS = /[)(/\\=+|*]/;           // anything that can only be Beta Code
const HAS_ACCENT = /[)(/\\=+|]/;            // accents or breathings were typed: match them exactly
/** Beta Code -> Greek with the accents that were typed (e.g. lo/gos), or plain Greek letters when none were. */
function betaToGreek(q) {
  let out = '', cap = false, pend = '';
  for (const c of q.toLowerCase().replace(/[\s-]/g, '')) {
    if (c === '*') { cap = true; continue; }
    if (MARKS[c]) { if (cap) pend += MARKS[c]; else out += MARKS[c]; continue; }
    const g = BETA[c]; if (!g) continue;
    out += (cap ? g.toUpperCase() : g) + pend; cap = false; pend = '';
  }
  return out.normalize('NFC');
}
const betaFold = (q) => fold(betaToGreek(q));
/** Accent-exact key: keeps breathings and accents, treats the grave (a position variant) as the acute, ignores case and final sigma. */
const accKey = (s) => s.normalize('NFD').replace(/̀/g, '́').normalize('NFC').toLowerCase().replace(/ς/g, 'σ');

export const setSearchQuery = (q) => { lastQuery = q; };
let formIndex = null, accIndex = null;           // [{ key, i }] for every distinct word form
let lastQuery = '';

function forms(strict) {
  if (strict) return accIndex || (accIndex = D.forms.map((f, i) => ({ key: accKey(f.plain), i })));
  return formIndex || (formIndex = D.forms.map((f, i) => ({ key: fold(f.plain), i })));
}

/** Up to `limit` lexemes matching the query, best first. */
export function findWords(q, limit = 30) {
  q = q.trim(); if (!q) return [];
  const out = new Map();                                       // n -> rank (lower = better)
  const add = (n, r) => { if (!out.has(n) || out.get(n) > r) out.set(n, r); };
  const num = /^g?\s*(\d{1,5})$/i.exec(q);
  if (num) { const L = lexeme(+num[1]); if (L) add(L.n, 0); }
  // Unaccented input finds every accented and unaccented form; accented input finds only those accents.
  const findGreek = (k, strict, exact, prefix) => {
    if (!k) return;
    const key = strict ? accKey : fold;
    for (const L of D.lex) { const hk = key(L.head); if (hk === k) add(L.n, exact); else if (hk.startsWith(k)) add(L.n, prefix); }
    for (const { key: fk, i } of forms(strict)) {
      if (fk === k) D.forms[i].an.forEach((a) => add(a.s, exact + 1));
      else if (fk.startsWith(k) && k.length >= 3) D.forms[i].an.forEach((a) => add(a.s, prefix + 1));
    }
  };
  if (num) { /* a Strong's number: nothing else to look for */ }
  else if (GREEK.test(q)) { const strict = /[̀-ͯ]/.test(q.normalize('NFD')); findGreek(strict ? accKey(q) : fold(q), strict, 0, 2); }
  else if (/[a-z]/i.test(q)) {
    const beta = BETA_MARKS.test(q);                           // accent marks mean it can only be Beta Code
    if (!beta) {                                               // English meaning
      const re = new RegExp('(^|[^a-z])' + q.toLowerCase().replace(/[^a-z0-9' -]/g, '').replace(/[-\\^$*+?.()|[\]{}]/g, '\\$&'), 'i');
      for (const L of D.lex) { if (re.test(L.brief)) add(L.n, 1); else if (re.test(L.full)) add(L.n, 4); }
    }
    const strict = HAS_ACCENT.test(q);
    findGreek(strict ? accKey(betaToGreek(q)) : betaFold(q), strict, 1.5, 3.5);   // Beta Code, e.g. logos or lo/gos
  }
  // a word that is learned per case is listed once, as its separate case cards
  return [...out.entries()].map(([n, r]) => [lexeme(n), r]).filter(([L]) => L)
    .sort((a, b) => a[1] - b[1] || b[0].freq - a[0].freq).slice(0, limit).map(([L]) => L);
}

/** Show the fuller definition only when it says something the short gloss doesn't. */
const words = (t) => new Set((t.toLowerCase().match(/[a-z]+/g) || []));
function addsInfo(L) { if (!L.full) return false; const b = words(L.brief); return [...words(L.full)].some((w) => !b.has(w)); }

function posOf(L) {
  const base = L.base || L.n;
  for (const f of D.forms) { const a = f.an.find((x) => x.s === base); if (a) return decode(a.m).posName; }
  return '';
}

function versesOf(L, max = 5) {
  const seen = new Set(), res = [];
  for (const p of D.occ.get(L.n) || []) {
    if (seen.has(p)) continue; seen.add(p);
    const { bi, ch, vs } = unpack(p), code = D.books[bi].code;
    const verse = chapterVerses(code, ch).find(([v]) => v === vs); if (!verse) continue;
    const toks = verse[1], ns = senseNs(toks).ns;
    res.push({ code, ch, vs, toks, ns });
    if (res.length >= max) break;
  }
  return res;
}

function detail(view, n, back) {
  const L = lexeme(n);
  const wrap = h('div.stack');
  const draw = () => {
    const base = L.base || L.n;
    clear(wrap).append(
      h('div.pagehead', h('button.btn.ghost.icon.sm', { 'aria-label': 'Back to results', onclick: back }, icon('chevL', 20)), h('h1', { lang: 'grc' }, L.head)),
      h('div.card.stack',
        h('div.row.wrap', h('span.chip', posOf(L) || '—'), h('span.chip.strongs', 'Strong’s ' + base), L.name ? null : statusChip(L.n)),
        h('div.gloss', { style: { fontSize: '1.15rem', fontWeight: 700 } }, L.brief),
        addsInfo(L) ? h('div.muted', L.full) : null,
        h('div.muted.small', 'Occurs ' + fmt(L.freq) + '× in the text · frequency rank ' + fmt(L.rank)),
        L.name ? null : h('div.row.wrap',
          status(L.n) === 'known' ? h('button.btn.sm', { onclick: async () => { await markLearning(L.n); toast('Added to words to review'); draw(); } }, '↺ Review this')
            : h('button.btn.primary.sm', { onclick: async () => { await markLearning(L.n); toast('Added to your learning list'); draw(); } }, '+ Learn this'),
          status(L.n) !== 'known' || !K.cards.has('w:' + L.n) ? h('span.row.wrap', knowButtons(L, markKnown, draw)) : null)));
    const vs = versesOf(L);
    if (vs.length) wrap.append(h('div.card.stack', h('h2', 'Where it appears'), h('div.list', vs.map((v) => {
      const line = h('div', { lang: 'grc', style: { fontSize: '1.15rem', lineHeight: 1.5 } });
      v.toks.forEach((t, k) => { line.append(v.ns[k] === L.n ? h('mark', tokenForm(t).w) : tokenForm(t).w, ' '); });
      return h('a.li', { href: readHref(v.code, v.ch, v.vs), style: { flexDirection: 'column', alignItems: 'flex-start', gap: '.15rem' } }, h('b.small', refLabel(v.code, v.ch, v.vs)), line);
    })), h('div.muted.small', D.occ.get(L.n) && new Set(D.occ.get(L.n)).size > vs.length ? 'First ' + vs.length + ' verses shown.' : '')));
    const fl = D.forms.filter((f) => f.an.some((a) => a.s === base)).sort((a, b) => b.count - a.count);
    if (fl.length && !L.base) {
      const row = (f) => { const a = f.an.find((x) => x.s === base), m = decode(a.m); return h('div.li', { style: { gap: '.6rem' } }, h('b', { lang: 'grc' }, toAcute(f.plain)), h('span.muted.small.grow', m.summary || m.posName), h('span.muted.small', fmt(f.count) + '×')); };
      wrap.append(h('div.card.stack', h('h2', 'Forms in the text'), h('div.list', fl.slice(0, 10).map(row)),
        fl.length > 10 ? h('details', h('summary', 'Show all ' + fl.length), h('div.list', { style: { marginTop: '.5rem' } }, fl.slice(10).map(row))) : null));
    }
  };
  draw();
  clear(view).append(wrap);
}

/** A plain explanation of Beta Code, with the letter table and a live example taken from the lexicon. */
function showBetaHelp() {
  const ex = findWords('logos', 1)[0];
  const rows = Object.entries(BETA).map(([lat, gr]) => h('div.betarow', h('code', lat), h('span', '→'), h('span', { lang: 'grc' }, gr)));
  const dlg = h('dialog.sheet', h('div.row.between', h('h2', 'What is Beta Code?'), h('button.btn.ghost.icon.sm', { 'aria-label': 'Close', onclick: () => dlg.close() }, icon('close', 18))),
    h('p', 'Beta Code is a way of entering Greek text without a Greek keyboard: each Greek letter is typed as a Latin letter. If you leave out the accents, lexiko finds the word with or without its accents, so “logos” is enough.'),
    ex ? h('p', 'For example, typing ', h('code', 'logos'), ' finds ', h('b', { lang: 'grc' }, ex.head), ' (', ex.short, ').') : null,
    h('div.betagrid', rows),
    h('p.small', h('b', 'Accents (optional): '), h('code', ')'), ' smooth breathing, ', h('code', '('), ' rough breathing, ', h('code', '/'), ' acute, ', h('code', '\\'), ' grave, ', h('code', '='), ' circumflex, ', h('code', '|'), ' iota subscript, ', h('code', '*'), ' before a letter for a capital. If you do type accents, lexiko finds only words with exactly those accents.'),
    h('p.muted.small', 'The same applies if you type Greek letters directly: no accents finds both, accents find only those.'),
    h('button.btn.primary.block', { onclick: () => dlg.close() }, 'Got it'));
  dlg.addEventListener('close', () => dlg.remove()); dlg.addEventListener('click', (e) => { if (e.target === dlg) dlg.close(); });
  document.body.append(dlg); dlg.showModal();
}

/* The Glossary's order: any of Word, Count and Status, each ascending or descending, in the order they were tapped (the first decides, the next ones break ties). */
const SORTS = [['word', 'Word'], ['count', 'Count'], ['status', 'Status']];
const SORT_HELP = { word: ['α to ω', 'ω to α'], count: ['fewest first', 'most first'], status: ['new words first', 'known words first'] };
let sorts = [], letter = null;                                   // both survive leaving the Glossary and coming back
const STATUS_RANK = { unknown: 0, learning: 1, known: 2 };
const firstLetter = (L) => fold(L.head).replace(/[^α-ω]/g, '')[0] || '';
/** `list` ordered by the chosen sorts; words that tie on all of them (and the default, no sorts chosen) go alphabetically. */
export function sortWords(list, chosen = sorts) {
  const rows = list.map((L) => ({ L, w: fold(L.head), c: L.freq, s: STATUS_RANK[status(L.n)] ?? 0 }));
  const key = { word: 'w', count: 'c', status: 's' };
  rows.sort((x, y) => { for (const { key: k, dir } of chosen) { const a = x[key[k]], b = y[key[k]]; if (a !== b) return (a < b ? -1 : 1) * dir; } return x.w < y.w ? -1 : x.w > y.w ? 1 : x.L.rank - y.L.rank; });
  return rows.map((r) => r.L);
}

export function renderSearch(view, params = []) {
  if (params[0] === 'w' && lexeme(+params[1])) return detail(view, +params[1], () => { location.hash = '#/search'; });
  const input = h('input', { type: 'search', id: 'sq', value: lastQuery, placeholder: 'Greek (or Beta Code), English meaning, or Strong’s number', autocomplete: 'off', autocapitalize: 'off', 'aria-label': 'Search the glossary', style: { width: '100%', fontSize: '1.1rem' } });
  input.spellcheck = false;
  const out = h('div.list');
  const hint = h('div.muted.small'), controls = h('div.stack');
  const row = (L) => h('a.li', { href: '#/search/w/' + L.n, 'data-l': firstLetter(L), style: { gap: '.7rem' } },
    h('span.grow', h('b', { lang: 'grc', style: { fontSize: '1.15rem' } }, L.head), h('div.muted.small', L.short)),
    h('span.muted.small', fmt(L.freq) + '×'), statusChip(L.n));
  // Tap a sort to add it (ascending), tap again to reverse it, tap a third time to drop it; the tap order is the priority.
  const tapSort = (k) => { const i = sorts.findIndex((x) => x.key === k); if (i < 0) sorts.push({ key: k, dir: 1 }); else if (sorts[i].dir === 1) sorts[i].dir = -1; else sorts.splice(i, 1); draw(); };
  const drawControls = (withLetters) => {
    clear(controls);
    controls.append(h('div.row.sortrow', { role: 'group', 'aria-label': 'Sort the Glossary' }, h('span.muted.small', 'Sort'),
      ...SORTS.map(([k, label]) => {
        const i = sorts.findIndex((x) => x.key === k), on = i >= 0, dir = on ? sorts[i].dir : 0;
        return h('button.btn.sm.sortbtn' + (on ? '.primary' : ''), { 'aria-pressed': String(on),
          'aria-label': on ? 'Sort by ' + label + ', priority ' + (i + 1) + ', ' + SORT_HELP[k][dir > 0 ? 0 : 1] + '. Tap to ' + (dir > 0 ? 'reverse it.' : 'remove it.') : 'Sort by ' + label + ': ' + SORT_HELP[k][0],
          onclick: () => tapSort(k) }, label, on ? h('b', (i + 1) + (dir > 0 ? '↑' : '↓')) : null);
      }),
      sorts.length ? h('button.btn.ghost.icon.sm', { 'aria-label': 'Clear the sort', title: 'Clear the sort', onclick: () => { sorts = []; draw(); } }, icon('close', 18)) : null));
    if (withLetters) {
      const have = new Set(D.lex.map(firstLetter)), ls = 'αβγδεζηθικλμνξοπρστυφχψω'.split('').filter((l) => have.has(l));
      controls.append(h('div.row', { style: { flexWrap: 'nowrap', overflowX: 'auto', gap: '.35rem', paddingBottom: '.2rem' }, role: 'group', 'aria-label': 'Show words starting with a letter' },
        h('button.btn.sm' + (letter ? '' : '.primary'), { 'aria-pressed': String(!letter), style: { flex: 'none' }, onclick: () => { letter = null; draw(); } }, 'All'),
        ls.map((l) => h('button.btn.sm' + (letter === l ? '.primary' : ''), { lang: 'grc', 'aria-pressed': String(letter === l), 'aria-label': 'Words starting with ' + l, style: { minWidth: '2.6rem', padding: '0 .4rem', flex: 'none' }, onclick: () => { letter = letter === l ? null : l; draw(); } }, l))));
    }
  };
  const draw = () => {
    lastQuery = input.value;
    const q = input.value.trim(), res = q ? findWords(input.value) : null;
    clear(out); clear(controls);
    if (!q) {
      drawControls(true);
      const list = sortWords(letter ? D.lex.filter((L) => firstLetter(L) === letter) : D.lex);
      hint.textContent = fmt(list.length) + (letter ? ' words starting with ' + letter : ' words') + ' · tap one to see where it appears. Or type above to search.';
      const frag = document.createDocumentFragment(); list.forEach((L) => frag.append(row(L))); out.append(frag);
      return;
    }
    drawControls(false);
    hint.textContent = res.length ? res.length + (res.length === 1 ? ' match' : ' matches') + (sorts.length ? '' : ', best first') : 'No match. Try fewer letters, or search by the English meaning.';
    (sorts.length ? sortWords(res) : res).forEach((L) => out.append(row(L)));
  };
  input.addEventListener('input', draw);
  clear(view).append(h('div.stack', backHead('Glossary', '#/reference', 'Reference'), input, controls, h('div.row.wrap.between', hint, h('button.btn.ghost.sm', { onclick: showBetaHelp }, 'What is Beta Code?')), out));
  draw();
  return scrollButton();
}
