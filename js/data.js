// Loads the static data (lexicon, word forms, text) and builds lookup indexes.
import { strip, PUNCT } from './util.js';
import { decode } from './morph.js';

const BASE = new URL('../data/', import.meta.url);
const getJSON = async (p) => {
  const r = await fetch(new URL(p, BASE));
  if (!r.ok) throw new Error('Could not load ' + p + ' (' + r.status + ')');
  return r.json();
};

export const D = {
  lex: [], lexByN: new Map(), parts: new Map(), forms: [], books: [], bookByCode: new Map(), text: {},
  chap: new Map(),      // 'JHN:1' -> {book, ch, strongs:Int32Array, verses:n}
  occ: new Map(),       // strongs -> [packed bookIdx*1e5+ch*1e3+vs]
  periList: [], periAt: new Map(),   // sections (pericopes): list, and 'MAT:1:18' -> section starting at that verse
  totalTokens: 0, ready: false,
};

export const pack = (bi, ch, vs) => bi * 100000 + ch * 1000 + vs;
export const unpack = (p) => ({ bi: Math.floor(p / 100000), ch: Math.floor((p % 100000) / 1000), vs: p % 1000 });

/** Compact gloss for inline use: first sense, plus following senses only while it stays short. */
export function shortGloss(b) {
  if (!b) return '';
  const terms = b.split(/;\s*/)[0].split(/,\s*/);
  let s = terms[0];
  for (let i = 1; i < terms.length && s.length + 2 + terms[i].length <= 24; i++) s += ', ' + terms[i];
  return s.length > 34 ? s.slice(0, 31).trimEnd() + '…' : s;
}

export async function loadData(onProgress = () => {}) {
  const [lex, forms, books, peri, parts] = await Promise.all([getJSON('lexicon.json'), getJSON('forms.json'), getJSON('books.json'), getJSON('pericopes.json'), getJSON('parts.json')]);
  onProgress(0.25);
  D.lex = lex.map((r, i) => ({ n: r[0], head: r[1], brief: r[2], full: r[3], freq: r[4], pos: r[5], short: shortGloss(r[2]), senses: r[6] || null }));
  D.lex.sort((a, b) => b.freq - a.freq || a.n - b.n);
  D.lex.forEach((l, i) => { l.rank = i + 1; D.lexByN.set(l.n, l); });
  const senseLex = makeSenses();
  D.forms = forms.map((r) => {
    const an = [];
    for (let i = 2; i < r.length; i += 2) an.push({ s: r[i], m: r[i + 1] });
    return { w: r[0], plain: strip(r[0]), count: r[1], an };
  });
  // principal parts: strongs -> { n, lemma, parts:[present, future, aorist act, perfect act, perfect mid/pas, aorist pas] } (null = not printed)
  D.parts = new Map(parts.map((r) => [r[0], { n: r[0], lemma: r[1], parts: r.slice(2) }]));
  D.books = books; books.forEach((b, i) => { b.i = i; D.bookByCode.set(b.code, b); });
  let done = 0;
  await Promise.all(books.map(async (b) => {
    D.text[b.code] = await getJSON('text/' + b.code + '.json');
    onProgress(0.25 + 0.75 * (++done / books.length));
  }));
  // per-chapter strongs arrays + occurrence index
  for (const b of books) {
    for (const [ch, verses] of D.text[b.code]) {
      const arr = [];
      for (const [vs, toks] of verses) {
        const ns = senseNs(toks).ns;
        for (let k = 0; k < toks.length; k++) {
          const s = ns[k];
          if (s >= SENSE_BASE) D.lexByN.get(s).freq++;
          arr.push(s);
          let o = D.occ.get(s); if (!o) D.occ.set(s, (o = []));
          o.push(pack(b.i, ch, vs));
        }
      }
      D.chap.set(b.code + ':' + ch, { book: b.code, ch, strongs: Int32Array.from(arr), verses: verses.length });
      D.totalTokens += arr.length;
    }
  }
  if (senseLex.length) {                 // a preposition with several cases is reviewed as one word per case
    D.lex = D.lex.filter((l) => !l.senses).concat(senseLex.filter((l) => l.freq > 0));
    D.lex.sort((a, b) => b.freq - a.freq || a.n - b.n); D.lex.forEach((l, i) => { l.rank = i + 1; });
  }
  buildPericopes(peri);
  D.ready = true;
  return D;
}

/** Each heading starts a section that runs to the verse before the next heading (or the end of the book). */
function buildPericopes(raw) {
  for (const b of D.books) {
    const vlist = [];
    for (const [ch, vl] of D.text[b.code]) for (const [vs] of vl) vlist.push([ch, vs]);
    const idx = new Map(vlist.map(([c, v], i) => [c + ':' + v, i]));
    const hs = raw[b.code] || [];
    hs.forEach(([c, v, title], k) => {
      const e = k + 1 < hs.length ? idx.get(hs[k + 1][0] + ':' + hs[k + 1][1]) - 1 : vlist.length - 1;
      const [c2, v2] = vlist[e];
      const p = { id: 'p:' + b.code + ':' + c + ':' + v, code: b.code, bi: b.i, title, c1: c, v1: v, c2, v2 };
      D.periList.push(p); D.periAt.set(b.code + ':' + c + ':' + v, p);
    });
  }
}
export const periScope = (p) => ({ book: p.code, c1: p.c1, v1: p.v1, c2: p.c2, v2: p.v2 });
/** "1:1–18" or "1:18–2:12" */
export const periRange = (p) => p.c1 + ':' + p.v1 + '–' + (p.c1 === p.c2 ? p.v2 : p.c2 + ':' + p.v2);
export const periRef = (p) => D.bookByCode.get(p.code).name + ' ' + periRange(p);
export const periBook = (code) => D.periList.filter((p) => p.code === code);

export const lexeme = (n) => D.lexByN.get(n);
export const tokenForm = (t) => D.forms[t >> 4];
export const tokenPunct = (t) => PUNCT[t & 7];
export const tokenFlag = (t) => (t & 8) !== 0;

export function chapterVerses(code, ch) {
  const c = D.text[code].find((x) => x[0] === ch);
  return c ? c[1] : [];
}
export function bookChapters(code) { return D.bookByCode.get(code).chapters; }   // [[ch, nVerses],...]

/** scope = {book, c1, v1, c2, v2}; v2 may be 999 for "to end of chapter". */
export function scopeVerses(scope) {
  const out = [];
  for (const [ch, verses] of D.text[scope.book]) {
    if (ch < scope.c1 || ch > scope.c2) continue;
    for (const [vs, toks] of verses) {
      if (ch === scope.c1 && vs < (scope.v1 || 1)) continue;
      if (ch === scope.c2 && vs > (scope.v2 || 999)) continue;
      out.push({ ch, vs, toks });
    }
  }
  return out;
}

/** Map(strongs -> count) for primary analyses in scope. */
export function scopeCounts(scope) {
  const m = new Map();
  for (const { toks } of scopeVerses(scope)) { const ns = senseNs(toks).ns; for (let k = 0; k < toks.length; k++) m.set(ns[k], (m.get(ns[k]) || 0) + 1); }
  return m;
}

export function refLabel(bookCode, ch, vs) {
  const b = D.bookByCode.get(bookCode);
  return b.name + ' ' + ch + (vs ? ':' + vs : '');
}
export function scopeLabel(sc) {
  const b = D.bookByCode.get(sc.book); const chs = b.chapters;
  const lastCh = chs[chs.length - 1][0];
  const lastV = (c) => (chs.find((x) => x[0] === c) || [0, 0])[1];
  const wholeFrom = (sc.v1 || 1) <= 1, wholeTo = sc.v2 >= 999 || sc.v2 >= lastV(sc.c2);
  if (sc.c1 === 1 && wholeFrom && sc.c2 === lastCh && wholeTo) return b.name;
  if (wholeFrom && wholeTo) return b.name + ' ' + (sc.c1 === sc.c2 ? sc.c1 : sc.c1 + '–' + sc.c2);
  const to = sc.c1 === sc.c2 ? '–' + (sc.v2 >= 999 ? lastV(sc.c2) : sc.v2) : '–' + sc.c2 + ':' + (sc.v2 >= 999 ? lastV(sc.c2) : sc.v2);
  return b.name + ' ' + sc.c1 + ':' + (sc.v1 || 1) + to;
}

/* ---------- prepositions with several cases: one reviewable "word" per case ---------- */
export const SENSE_BASE = 100000;                                  // sense id = SENSE_BASE * (1 gen, 2 dat, 3 acc) + Strong's number
const CASE_ORDER = { G: 1, D: 2, A: 3 }, CASE_WORD = { G: 'genitive', D: 'dative', A: 'accusative' };

function makeSenses() {
  const out = [];
  for (const L of D.lex) {
    if (!L.senses) continue;
    L.senseNs = [];
    for (const [c, text, lng] of L.senses) {
      const n = SENSE_BASE * CASE_ORDER[c] + L.n;
      const sl = { n, base: L.n, case: c, head: L.head + ' + ' + CASE_WORD[c], brief: text, full: lng || '', freq: 0, pos: L.pos, short: shortGloss(text), rank: 0, senses: null };
      out.push(sl); D.lexByN.set(n, sl); L.senseNs.push(n);
    }
  }
  return out;
}

const caseCache = new Map();                                       // form index -> Set of case letters its readings can have
function formCases(fi) {
  let r = caseCache.get(fi); if (r) return r;
  r = new Set(); let pos = '';
  for (const a of D.forms[fi].an) { const d = decode(a.m); if (d.slots && d.slots.case) r.add(d.slots.case); pos = pos || d.pos; }
  r.pos = D.forms[fi].an.length ? decode(D.forms[fi].an[0].m).pos : '';
  caseCache.set(fi, r); return r;
}

/** Which case does the preposition at toks[i] govern? Looks at the next case-bearing word(s). → { n, sure } */
function pickSense(L, toks, i) {
  const allowed = new Set(L.senses.map((x) => x[0]));
  let cand = null, afterIndecl = false;
  for (let j = i + 1; j < Math.min(toks.length, i + 8); j++) {
    const cs = formCases(toks[j] >> 4);
    if (!cs.size) {
      if (!afterIndecl && ['N', 'A'].includes(cs.pos)) { afterIndecl = true; continue; }          // a name or number with no case ending: look at the word after it
      if (!afterIndecl && ['CONJ', 'PRT', 'ADV', 'COND'].includes(cs.pos)) continue;
      break;
    }
    const hit = [...cs].filter((c) => allowed.has(c) && (cand === null || cand.has(c)));
    if (!hit.length) break;
    cand = new Set(hit);
    if (cand.size === 1) break;
  }
  const order = L.senses.map((x) => x[0]);
  if (cand && cand.size === 1) return { n: SENSE_BASE * CASE_ORDER[[...cand][0]] + L.n, sure: true };
  const first = cand ? order.find((c) => cand.has(c)) : order[0];
  return { n: SENSE_BASE * CASE_ORDER[first] + L.n, sure: false };
}

const senseCache = new WeakMap();
/** For one verse's tokens: the effective Strong's-or-sense id of each token, and whether the case was a guess. */
export function senseNs(toks) {
  let r = senseCache.get(toks); if (r) return r;
  const ns = new Int32Array(toks.length), unsure = new Uint8Array(toks.length);
  for (let k = 0; k < toks.length; k++) {
    const s = D.forms[toks[k] >> 4].an[0].s, L = D.lexByN.get(s);
    if (L && L.senses) { const p = pickSense(L, toks, k); ns[k] = p.n; unsure[k] = p.sure ? 0 : 1; } else ns[k] = s;
  }
  r = { ns, unsure }; senseCache.set(toks, r); return r;
}
