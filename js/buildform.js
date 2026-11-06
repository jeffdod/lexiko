// Build the form: practice only. You are told which form of which verb (tense, voice, person, number), and put it together one slot at a time:
// front (augment or reduplication) → stem → tense formative → ending. The forms are real forms from the text, taken apart with the chart's own pieces.
// A form is only offered when it adds up exactly (front + stem + formative + ending is the word, ignoring accents); anything else (vowel-initial
// stems, compound verbs, liquid and other irregular stems) is left out rather than split wrongly. Contract verbs (-άω, -έω, -όω) with a consonant at the front are
// built too: in the present and imperfect the stem vowel contracts with the ending (a Contraction step); elsewhere the stem vowel lengthens (ποιε- → ποιη-).
import { D, notParsed } from './data.js';
import { ROWS, say } from './chartdrill.js';
import { rowPool, moodPool } from './parse.js';
import { SUBB, splitSub } from './subdata.js';
import { IMPB, splitImp } from './impdata.js';
import { INFB, INF, splitInf } from './infdata.js';
import { h, clear, shuffle, backHead, backLinks } from './util.js';
import { rowOfTag } from './families.js';
import { isCompoundLemma } from './cluehunt.js';
import { PRIMARY_ACT, PRIMARY_MP, SECOND_ACT, SECOND_MP, masterRowTable } from './charts.js';

const skel = (s) => s.replace(/­/g, '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/ς/g, 'σ');
const final = (s) => s.replace(/σ$/, 'ς');
const ROW = Object.fromEntries(ROWS.map((r) => [r.key, r]));
const CELLS = ['1S', '2S', '3S', '1P', '2P', '3P'], CELL_NAME = { '1S': '1st person singular', '2S': '2nd person singular', '3S': '3rd person singular', '1P': '1st person plural', '2P': '2nd person plural', '3P': '3rd person plural' };

const PRES_ACT = ['ω', 'εις', 'ει', 'ομεν', 'ετε', 'ουσι(ν)'], MP_PRIM = ['ομαι', 'η', 'εται', 'ομεθα', 'εσθε', 'ονται'], SEC_ACT = ['ον', 'ες', 'ε(ν)', 'ομεν', 'ετε', 'ον'], SEC_MP = ['ομην', 'ου', 'ετο', 'ομεθα', 'εσθε', 'οντο'];
const A_ACT = ['α', 'ας', 'ε(ν)', 'αμεν', 'ατε', 'αν'], PAS = ['ην', 'ης', 'η', 'ημεν', 'ητε', 'ησαν'];
/** For each row of the master chart: the front (ε, a reduplication, or nothing), the tense formative letters, and the six realized endings. */
export const BUILD = {
  'pres-act': { A: '', F: '', E: PRES_ACT }, 'pres-mp': { A: '', F: '', E: MP_PRIM },
  'impf-act': { A: 'ε', F: '', E: SEC_ACT }, 'impf-mp': { A: 'ε', F: '', E: SEC_MP },
  'fut-act': { A: '', F: 'σ', E: PRES_ACT }, 'fut-mid': { A: '', F: 'σ', E: MP_PRIM }, 'fut-pas1': { A: '', F: 'θησ', E: MP_PRIM }, 'fut-pas2': { A: '', F: 'ησ', E: MP_PRIM },
  'aor1-act': { A: 'ε', F: 'σ', E: A_ACT }, 'aor2-act': { A: 'ε', F: '', E: SEC_ACT }, 'aor1-mid': { A: 'ε', F: 'σ', E: ['αμην', 'ω', 'ατο', 'αμεθα', 'ασθε', 'αντο'] }, 'aor2-mid': { A: 'ε', F: '', E: SEC_MP },
  'aor1-pas': { A: 'ε', F: 'θ', E: PAS }, 'aor2-pas': { A: 'ε', F: '', E: PAS },
  'perf1-act': { A: 'RED', F: 'κ', E: ['α', 'ας', 'ε(ν)', 'αμεν', 'ατε', 'ασι(ν)'] }, 'perf2-act': { A: 'RED', F: '', E: ['α', 'ας', 'ε(ν)', 'αμεν', 'ατε', 'ασι(ν)'] }, 'perf-mp': { A: 'RED', F: '', E: ['μαι', 'σαι', 'ται', 'μεθα', 'σθε', 'νται'] },
};
for (const T of Object.values(BUILD)) T.E = T.E.map(skel);                 // endings are kept as plain letters (σ everywhere), and shown with ς at the end
export const BUILD_ROWS = Object.keys(BUILD);
const variants = (e) => (e.includes('(ν)') ? [e.replace('(ν)', ''), e.replace('(ν)', 'ν')] : [e]);
const shown = (e) => final(e);
const VOWEL_START = /^[αεηιουω]/;

const TAG = /^V-[12]?[PIFARL][AMPEDONQX]?I-([123])([SP])/;
const cellOf = (m) => { const x = TAG.exec(m || ''); return x ? x[1] + x[2] : null; };
/** The stem vowel of a contract verb (α, ε or ο), or null. */
const contractKind = (n) => { const L = D.lexByN.get(n), m = L ? /([αεο])(ω|ομαι)$/.exec(skel(L.head)) : null; return m ? m[1] : null; };
/** Verbs left out: unknown, -μι and compound verbs. */
const contract = (n) => { const L = D.lexByN.get(n); if (!L) return true; return /μι$/.test(skel(L.head)) || isCompoundLemma(L.head); };
const vowelInitial = (n) => { const L = D.lexByN.get(n); return !!L && VOWEL_START.test(skel(L.head)); };
/** How the first vowel of a vowel-initial stem lengthens for the augment (the same lengthening is the reduplication of the perfect); longest vowel first. A vowel that is already long shows nothing, so those verbs are left out. */
const AUG = [['αι', ['ῃ']], ['ει', ['ῃ']], ['οι', ['ῳ']], ['αυ', ['ηυ']], ['ευ', ['ηυ']], ['α', ['η']], ['ε', ['η', 'ει']], ['ο', ['ω']]];
/** The ways an unaugmented vowel-initial stem can begin once its first vowel lengthens: [{ from, to, pre }] (pre in plain letters). */
function augmented(S0) { const g = AUG.find(([x]) => S0.startsWith(x)); return g ? g[1].map((to) => ({ from: g[0], to, pre: skel(to) + S0.slice(g[0].length) })) : []; }
const lengthen = (p) => p.slice(0, -1) + ({ 'α': 'η', 'ε': 'η', 'ο': 'ω' }[p.slice(-1)] || p.slice(-1));
/** How a contract verb's stem vowel and the first vowel(s) of an uncontracted ending are written together (the endings are those of λύω). */
const CONTRACTS = { 'α': { ο: 'ω', ω: 'ω', ου: 'ω', ε: 'α', η: 'ᾳ', ει: 'ᾳ' }, 'ε': { ο: 'ου', ω: 'ω', ου: 'ου', ε: 'ει', η: 'ῃ', ει: 'ει' }, 'ο': { ο: 'ου', ω: 'ω', ου: 'ου', ε: 'ου', η: 'οι', ει: 'οι' } };
const INITS = ['ου', 'ει', 'ω', 'ο', 'ε', 'η'], INIT_SHOWN = { 'η': 'ῃ' };
/** The present stem of a verb, from its lexical form (λύω → λυ, ἔρχομαι is left out: its stem is not the present's). */
const presentStem = (n) => { const L = D.lexByN.get(n), s = L ? skel(L.head) : ''; return /(ω|ομαι)$/.test(s) ? s.replace(/(ω|ομαι)$/, '') : null; };      // contract and -μι verbs do not add up to a simple split

/** A form taken apart: { row, cell, A, S, F, E, word, n } or null when it does not add up exactly. */
export function decompose(id, row) {
  const f = D.forms[id], a = f.an[0], T = BUILD[row]; if (!a || !T || notParsed(a)) return null;
  const cell = cellOf(a.m); if (!cell || contract(a.s) || rowOfTag(a.m, a.s) !== row) return null;
  if (contractKind(a.s) && /^(pres|impf)-/.test(row)) return decomposeContract(id, row, f, a, cell);
  const w = skel(f.w), end = variants(T.E[CELLS.indexOf(cell)]).map((e) => T.F + e).find((suffix) => w.endsWith(suffix) && w.length - suffix.length >= 3);
  if (end == null) return null;
  const E = T.E[CELLS.indexOf(cell)], body = w.slice(0, w.length - end.length), used = variants(E).find((e) => w.endsWith(T.F + e));
  let A = '', S = body, aug = null;
  if (T.A !== '' && vowelInitial(a.s)) {           // the augment (or the perfect's reduplication) is the first vowel lengthening: the stem is shown as it is without it
    const P0 = presentStem(a.s); if (!P0 || /^(aor2|perf2)/.test(row)) return null;
    for (const S0 of uniq([P0, contractKind(a.s) ? lengthen(P0) : P0])) for (const c of augmented(S0)) if (body === c.pre) { S = S0; aug = { from: c.from, to: c.to }; }
    if (!aug) return null;
  } else if (T.A === 'ε') { if (body[0] !== 'ε' || body.length < 3 || VOWEL_START.test(body[1])) return null; A = 'ε'; S = body.slice(1); }
  else if (T.A === 'RED') { if (body.length < 4 || body[1] !== 'ε' || body[0] !== body[2] || VOWEL_START.test(body[0])) return null; A = body.slice(0, 2); S = body.slice(2); }
  if (S.length < 2) return null;
  // a stem that is only the present stem with sounds dropped or changed (a stop before σ, a σ before θ) would be misleading: those rows must show the verb's own present stem
  // (the second aorist and second perfect are different stems by definition, so they are free)
  const k = contractKind(a.s), P = presentStem(a.s);
  if (/^(aor2|perf2)/.test(row)) { if (k) return null; } else if (!(S === P || (k && S === lengthen(P)))) return null;
  return { row, cell, A, S, F: T.F, E, used, word: f.w.replace(/­/g, ''), n: a.s, id, aug };
}

/** A present or imperfect form of a contract verb: the stem keeps its vowel (ποιε-) and that vowel contracts with the ending: { ..., contract: { k, init, res, rest, head } }. */
function decomposeContract(id, row, f, a, cell) {
  const T = BUILD[row], k = contractKind(a.s), P = presentStem(a.s), w = skel(f.w), U = T.E[CELLS.indexOf(cell)];
  if (!P || P.length < 3 || P.slice(-1) !== k) return null;
  const cands = T.A === 'ε' && vowelInitial(a.s) ? augmented(P).filter((c) => P.length > c.from.length).map((c) => ({ A: '', aug: { from: c.from, to: c.to }, head: skel(c.to) + P.slice(c.from.length, -1) }))
    : [{ A: T.A === 'ε' ? 'ε' : '', aug: null, head: (T.A === 'ε' ? 'ε' : '') + P.slice(0, -1) }];
  for (const u of variants(U)) {
    const init = INITS.find((x) => u.startsWith(x)), res = init && CONTRACTS[k][init]; if (!res) continue;
    const rest = u.slice(init.length);
    for (const c of cands) if (w === c.head + skel(res) + rest) return { row, cell, A: c.A, S: P, F: '', E: U, used: u, word: f.w.replace(/­/g, ''), n: a.s, id, aug: c.aug, contract: { k, init, res, rest, head: P.slice(0, -1) } };
  }
  return null;
}

/* ---------- the chart's own pieces ----------
   The master chart's columns are: augment, tense stem, tense formative (σα, κα, θη, ...), connecting vowel, personal ending. Those are the pieces you build with.
   The word as spelled is the realized form checked above; where the pieces run together in the spelling (ο + – is written ω, σα is written σε in the 3rd singular) the feedback says so. */
const ENDING_TABLE = { 'prim act': PRIMARY_ACT, 'prim mid/pas': PRIMARY_MP, 'sec act': SECOND_ACT, 'sec mid/pas': SECOND_MP };
/** { F, V, PE, naive, written, changes } for a decomposed form: the chart's formative, connecting vowel and personal ending for its cell. */
export function chartPieces(d) {
  const r = ROW[d.row], i = CELLS.indexOf(d.cell), t = ENDING_TABLE[r.ends][i];
  const V = r.vowel ? t[2] : '';
  let PE = t[3];
  if (!r.vowel && r.ends === 'prim act' && i === 5) PE = 'σι(ν)';                      // λελύκασι(ν): κα + σι(ν)
  if (!r.vowel && r.ends === 'sec act' && i === 5 && /pas$/.test(d.row)) PE = 'σαν';    // ἐλύθησαν: θη + σαν
  if (!r.vowel && r.ends === 'sec act' && i === 0 && !/pas$/.test(d.row)) PE = '–';    // ἔλυσα: σα + nothing
  const plain = (x) => (x === '–' ? '' : x), naive = r.form + V + plain(PE), norm = (x) => skel(x).replace('(ν)', ''), written = d.F + d.E;
  return { F: r.form, V, PE, naive, written: final(written), changes: norm(naive) !== norm(written) };
}

/* ---------- the other moods: subjunctive, imperative, infinitive ----------
   They have no augment, so there is no Front step. The pieces are the ones each kind's chart uses: stem, formative (σ, θ, σα, θη, η), connecting vowel (the long ω/η of the subjunctive, the ε of the imperative) and ending.
   A form is only offered when the split is plain (no contract, liquid, ψ/ξ-merged or perfect forms) and the stem is the verb's own present stem (second aorists are free). */
const MOODS = { sub: { name: 'subjunctive', B: SUBB, split: splitSub }, imp: { name: 'imperative', B: IMPB, split: splitImp }, inf: { name: 'infinitive', B: INFB, split: splitInf } };
const plainKeep = (s) => s.replace(/­/g, '').normalize('NFD').replace(/[\u0300-\u0344\u0346-\u036f]/g, '').normalize('NFC').toLowerCase();
const WHO = (code) => { const m = /^V-[12]?[PIFARL][AMPEDONQX]?[ISMNP]-([123])([SP])/.exec(code || ''); return m ? m[1] + m[2] : null; };
/** How a contract verb's stem vowel and the first vowel of the uncontracted ending are written together, per mood. The subjunctive's long vowel is ω, η or ῃ (with iota subscript);
    the infinitive's -ειν is a "spurious" ει (ἀγαπᾶν), unlike the genuine ει of the indicative (ἀγαπᾷ); the imperative's ε and the middle 2nd singular's ου. */
const MOOD_CONTRACTS = {
  sub: { 'α': { 'ω': 'ω', 'η': 'α', 'ῃ': 'ᾳ' }, 'ε': { 'ω': 'ω', 'η': 'η', 'ῃ': 'ῃ' }, 'ο': { 'ω': 'ω', 'η': 'ω', 'ῃ': 'οι' } },
  imp: { 'α': { 'ε': 'α', 'ου': 'ω' }, 'ε': { 'ε': 'ει', 'ου': 'ου' }, 'ο': { 'ε': 'ου', 'ου': 'ου' } },
  inf: { 'α': { 'ει': 'α', 'ε': 'α' }, 'ε': { 'ει': 'ει', 'ε': 'ει' }, 'ο': { 'ει': 'ου', 'ε': 'ου' } },
};
/** The uncontracted form of a present subjunctive, imperative or infinitive (the λύω paradigm's): the vowel the stem vowel meets, the rest of the ending, and an example. */
function uncontracted(mood, key, who) {
  const r = MOODS[mood].B.get(key); if (!r) return null;
  if (mood === 'inf') return r.ending === 'ειν' ? { init: 'ει', rest: 'ν', V: '', E: 'ειν', written: '', ex: r.model } : r.ending === 'εσθαι' ? { init: 'ε', rest: 'σθαι', V: '', E: 'εσθαι', written: '', ex: r.model } : null;
  const f = r.forms[mood === 'sub' ? CELLS.indexOf(who) : ['2S', '3S', '2P', '3P'].indexOf(who)]; if (!f) return null;
  const sp = MOODS[mood].split(f.replace('(ν)', ''), key); if (!sp) return null;
  const V = skel(sp.vowel || ''), E = skel(sp.ending || ''), written = plainKeep(sp.vowel || ''), ex = f.replace('(ν)', '');
  if (mood === 'sub') return { init: written, rest: E, V, E, written, ex };
  return V ? { init: V, rest: E, V, E, written, ex } : /^ου/.test(E) ? { init: 'ου', rest: E.slice(2), V: '', E, written: '', ex } : null;
}
/** A present subjunctive, imperative or infinitive of a contract verb: the stem keeps its vowel (ποιε-) and contracts with the ending. */
function decomposeMoodContract(mood, x) {
  const k = contractKind(x.n), P = presentStem(x.n); if (!P || P.length < 3 || P.slice(-1) !== k) return null;
  const who = mood === 'inf' ? '' : WHO(x.code); if (mood !== 'inf' && !who) return null;
  const u = uncontracted(mood, x.key, who), res = u && MOOD_CONTRACTS[mood][k][u.init]; if (!res) return null;
  const w = skel(x.w), head = P.slice(0, -1) + skel(res), nu = (e) => (e === 'σι' ? 'σι(ν)' : e);
  if (!(u.rest === 'σι' ? ['σι', 'σιν'] : [u.rest]).some((r) => w === head + r)) return null;
  return { mood, key: x.key, S: P, F: '', V: u.V, E: nu(u.E), vowelWritten: u.written, word: x.w, n: x.n, id: x.id, who, row: null, kind: MOODS[mood].B.get(x.key),
    contract: { k, init: u.init, initShown: u.init, res, rest: nu(u.rest), head: P.slice(0, -1), ex: u.ex } };
}
/** A subjunctive, imperative or infinitive taken apart: { mood, key, S, F, V, E, written, word, n, id, who }, or null. */
export function decomposeMood(mood, x) {
  const M = MOODS[mood], r = M.B.get(x.key); if (!r || /^perf/.test(x.key) || contract(x.n)) return null;
  const k = contractKind(x.n);
  if (k) { if (/^pres/.test(x.key)) return decomposeMoodContract(mood, x); if (/^aor2/.test(x.key)) return null; }
  const sp = M.split(x.w, x.key); if (!sp || sp.merged || sp.liquid) return null;
  const S = sp.stemSkel, P = presentStem(x.n);
  if (!S || S.length < 2 || (!/^aor2/.test(x.key) && !(S === P || (k && S === lengthen(P))))) return null;
  const who = mood === 'inf' ? '' : WHO(x.code); if (mood !== 'inf' && !who) return null;
  const E = skel(sp.ending || '').replace(/^σι$/, 'σι(ν)').replace(/^σιν$/, 'σι(ν)');
  return { mood, key: x.key, S, F: skel(sp.formative || ''), V: skel(sp.vowel || ''), E, vowelWritten: plainKeep(sp.vowel || ''), word: x.w, n: x.n, id: x.id, who, row: null, kind: r };
}
const MOOD_KEYS = { sub: [...SUBB.keys()], imp: [...IMPB.keys()], inf: INF.map((r) => r.key).filter((k) => !/^perf/.test(k)) };
const endingPool = (d) => { const { mood, key } = d, split = MOODS[mood].split, B = MOODS[mood].B;
  if (mood === 'inf') return uniq(INF.filter((r) => !/^perf/.test(r.key)).map((r) => r.ending));
  const of = (k) => B.get(k).forms.map((f) => { const sp = split(f.replace('(ν)', ''), k); return sp ? skel(sp.ending || '').replace(/^σι$/, 'σι(ν)') : null; }).filter((e) => e !== null);
  return { own: uniq(of(key)), cross: uniq(MOOD_KEYS[mood].filter((k) => k !== key).flatMap(of)) }; };
function moodEndingOptions(d) {
  const pool = endingPool(d), own = Array.isArray(pool) ? pool : pool.own, cross = Array.isArray(pool) ? [] : pool.cross;
  const same = own.filter((e) => e !== d.E), other = cross.filter((e) => e !== d.E && !same.includes(e));
  return shuffle(uniq([d.E, ...shuffle(same).slice(0, 2), ...shuffle(other).slice(0, 1), ...shuffle(same).slice(2), ...shuffle(other).slice(1)]).slice(0, 4)).map((e) => [e, e === '' ? 'none' : '-' + shown(e)]);
}
function moodStemOptions(d) {
  const P = contractKind(d.n) ? presentStem(d.n) : null, pool = P ? [d.S, P, lengthen(P), P.slice(0, -1), d.S + 'σ'] : [d.S, d.S.slice(0, -1), d.S + 'σ', d.S + 'θ', d.S + 'κ'];
  return shuffle(uniq(pool.filter((s) => s.length >= 2)).slice(0, 4)).map((s) => [s, s + '-']);
}
const moodFormativeOptions = (d) => { const pool = d.mood === 'imp' ? ['σα', 'θη', 'η', ''] : ['σ', 'θ', 'κ', '']; return shuffle(uniq([d.F, ...pool].slice(0, 4))).map((f) => [f, f || 'none']); };
const moodVowelOptions = (d) => shuffle(uniq([d.V, ...(d.mood === 'sub' ? ['ω', 'η', 'ο', 'ε'] : ['ε', 'ο', 'α', 'η'])]).slice(0, 4)).map((v) => [v, v]);
/** The tiles and steps of a mood form, in order. */
function moodTiles(d) {
  const t = [['Stem', d.S + '-']];
  if (d.mood !== 'inf') { t.push(['Formative', d.F || '—']); if (d.V) t.push(['Vowel', d.V]); t.push(['Ending', d.E ? '-' + final(d.E) : '—']); } else t.push(['Ending', '-' + shown(d.E)]);
  if (d.contract) t.push(['Contract', d.contract.res]);
  return t;
}
/** The shape of the first screen text, e.g. "1st aorist active subjunctive, 3rd person singular". */
const moodHeading = (d) => d.kind.name + ' ' + MOODS[d.mood].name + (d.who ? ', ' + CELL_NAME[d.who] : '');

/* ---------- the pool and the session ---------- */
let byVerb = null;
const formsOfVerb = (n) => { if (!byVerb) { byVerb = new Map(); D.forms.forEach((f, i) => { const a = f.an[0]; if (a && !notParsed(a)) { if (!byVerb.has(a.s)) byVerb.set(a.s, []); byVerb.get(a.s).push(i); } }); } return byVerb.get(n) || []; };
/** Forms of one row that can be built, from verbs you know or any verb; only forms whose level is open (gated like the daily quiz). */
export function buildPool(row, any = false) { return rowPool(row, { gated: true, anyVerb: any }).map((id) => decompose(id, row)).filter(Boolean); }
const dense = (xs) => xs.sort((a, c) => D.forms[c.id].count - D.forms[a.id].count).slice(0, 30);
/** Forms of the other moods (subjunctive, imperative, infinitive), one list per kind. */
export function buildMoodLists(mood, any = false) {
  const by = new Map();
  for (const x of moodPool(mood, { anyVerb: any })) { const d = decomposeMood(mood, x); if (d) { if (!by.has(x.key)) by.set(x.key, []); by.get(x.key).push(d); } }
  return [...by.values()].map((l) => shuffle(dense(l)));
}
export function buildQueue(any = false, total = 8) {
  const groups = shuffle([BUILD_ROWS.map((r) => shuffle(dense(buildPool(r, any)))).filter((l) => l.length), ...['sub', 'imp', 'inf'].map((m) => buildMoodLists(m, any))].filter((g) => g.length));
  const at = groups.map(() => 0), out = [], seen = new Set();
  for (let step = 0; groups.length && out.length < total && step < 500; step++) {
    const gi = step % groups.length, g = groups[gi];
    for (let t = 0; t < g.length; t++) { const d = g[at[gi]++ % g.length].find((x) => !seen.has(x.id)); if (d) { seen.add(d.id); out.push(d); break; } }
  }
  return out;
}

/* ---------- tile options for each slot ---------- */
const uniq = (xs) => [...new Set(xs)];
function frontOptions(d) {
  const red = d.A.length === 2 ? d.A + '- (reduplication)' : VOWEL_START.test(d.S) ? 'reduplication' : d.S[0] + 'ε- (reduplication)';
  return [['none', 'no front'], ['ε', 'ε-'], ['red', red], ['lengthen', 'first vowel lengthens']];
}
const frontAnswer = (d) => (d.aug ? 'lengthen' : d.A === '' ? 'none' : d.A === 'ε' ? 'ε' : 'red');
const LENGTHENED = uniq(AUG.flatMap(([, t]) => t));
const lengthenOptions = (d) => shuffle([d.aug.to, ...shuffle(LENGTHENED.filter((x) => x !== d.aug.to)).slice(0, 3)]).map((x) => [x, x]);
function stemOptions(d) {
  const others = uniq(formsOfVerb(d.n).flatMap((i) => BUILD_ROWS.map((r) => { const x = D.forms[i].an[0]; return x && cellOf(x.m) ? decompose(i, r) : null; }).filter(Boolean)).map((x) => x.S)).filter((s) => s !== d.S);
  const k = contractKind(d.n), P = k ? presentStem(d.n) : null;
  const synthetic = uniq((k ? [P, lengthen(P), P.slice(0, -1)] : [d.S + 'σ', d.S + 'θ', d.S.slice(0, -1), d.S + 'κ']).filter((s) => s.length >= 2 && s !== d.S));
  return shuffle([d.S, ...shuffle(others).slice(0, 2), ...shuffle(synthetic)].filter((s, i, a) => a.indexOf(s) === i).slice(0, 4)).map((s) => [s, s + '-']);
}
const FORMATIVES = uniq(BUILD_ROWS.map((r) => ROW[r].form));
const peLabel = (e) => (e === '–' ? 'none' : '-' + e);
function formativeOptions(c) { return shuffle(uniq([c.F, ...shuffle(FORMATIVES.filter((x) => x !== c.F)).slice(0, 3)])).map((f) => [f, f || 'none']); }
const vowelOptions = (c) => ['ο', 'ε', 'α', 'η'].map((v) => [v, v]);
function endingOptions(d, c) {
  const r = ROW[d.row], i = CELLS.indexOf(d.cell), tab = ENDING_TABLE[r.ends], same = uniq(tab.map((t) => t[3]).filter((e) => e !== c.PE)),
    cross = uniq(Object.values(ENDING_TABLE).flatMap((t) => t[i][3]).filter((e) => e !== c.PE && !same.includes(e)));
  return shuffle(uniq([c.PE, ...shuffle(same).slice(0, 2), ...shuffle(cross).slice(0, 1), ...shuffle(same).slice(2)]).slice(0, 4)).map((e) => [e, peLabel(e)]);
}

const dispInit = (x) => INIT_SHOWN[x] || x;
function contractOptions(d) {
  const { k, init, res } = d.contract, T = d.mood ? MOOD_CONTRACTS[d.mood] : CONTRACTS, others = uniq([...Object.entries(T[k]).filter(([x]) => x !== init).map(([, r]) => r), ...Object.values(T).map((t) => t[init]), ...(d.mood ? ['ω', 'ει', 'ου', 'α'] : [])].filter((r) => r && r !== res && skel(r) !== skel(res)));
  return shuffle([res, ...shuffle(others).slice(0, 3)]).map((r) => [r, r]);
}

/* ---------- the screens ---------- */
/** A word shown on its own: an accent that only comes from a following enclitic (πέποιθάς τε) is dropped, so it never shows two accents. */
const isolated = (w) => { const s = w.normalize('NFD'), m = [...s.matchAll(/[\u0300\u0301\u0342]/g)]; if (m.length < 2) return w; const k = m[m.length - 1].index; return (s.slice(0, k) + s.slice(k + 1)).normalize('NFC'); };
const greek = (t, cls = '') => h('span' + cls, { lang: 'grc' }, t);
const pieces = (d, c, upto, mark) => {
  const tiles = d.mood ? moodTiles(d) : [['Front', d.aug ? d.aug.from + ' →' : d.A === '' ? '—' : d.A + '-'], ['Stem', d.S + '-']];
  if (!d.mood) {
    if (d.aug) tiles.push(['Lengthen', d.aug.to]);
    tiles.push(['Formative', c.F || '—']);
    if (c.V) tiles.push(['Vowel', c.V]);
    tiles.push(['Ending', c.PE === '–' ? '—' : '-' + c.PE]);
    if (d.contract) tiles.push(['Contract', d.contract.res]);
  }
  return h('div', { lang: 'grc', style: { display: 'flex', justifyContent: 'center', gap: '.3rem', flexWrap: 'wrap', margin: '.5rem 0' } },
    ...tiles.map(([label, text], i) => h('div', { style: { minWidth: '3.6rem', textAlign: 'center', padding: '.35rem .45rem', borderRadius: '12px', border: '2px ' + (i < upto ? 'solid' : 'dashed') + ' ' + (i === mark ? 'var(--accent)' : i < upto ? 'var(--good)' : 'var(--line)'), background: i < upto ? 'var(--good-soft)' : 'var(--surface)' } },
      h('small', { style: { display: 'block', font: '700 .6rem var(--ui)', letterSpacing: '.05em', textTransform: 'uppercase', color: 'var(--muted)' } }, label), h('span', { style: { fontFamily: 'var(--greek)', fontSize: '1.3rem' } }, i < upto ? text : ' '))));
};

/** After the Stem answer for a contract verb outside the present and imperfect: the stem vowel lengthens (or stays). */
const lengthNote = (d) => { const P = presentStem(d.n);
  return d.S === P ? h('span', 'A contract verb’s last stem vowel usually lengthens before σ, θ and κ (ε → η, α → η, ο → ω). Here it stays ', greek(P + '-'), '.')
    : h('span', 'A contract verb’s last stem vowel lengthens before σ, θ and κ: ', greek(P + '- → ' + d.S + '-'), ' (ε → η, α → η, ο → ω).'); };
/** The Contraction step: options, the answer, the rule shown afterwards and the question; `ex` is the λύω form the uncontracted ending is taken from. */
const contractEntry = (d, ex) => {
  const { k, init, res, rest } = d.contract, si = d.contract.initShown || dispInit(init), U = (d.vowelWritten || d.V || '') + d.E;
  return ['Contraction', contractOptions(d), res, h('span', 'Rule: ', greek(k + ' + ' + si + ' → ' + res), '. So the ending ', greek('-' + shown(U)), ' is written ', greek('-' + final(res + rest)), ' after this stem.'),
    h('span', 'The stem ends in ', greek(k), '. The uncontracted ending is ', greek('-' + shown(U)), ' (as in ', greek(ex.replace(/[()]/g, '')), '). How are the stem vowel ', greek(k), ' and the ending’s ', greek(si), ' written together?')];
};

export function renderBuild(view, mode) {
  const any = mode === 'any', queue = buildQueue(any), back = ['#/parse', 'Back to Parsing'];
  if (!queue.length) { clear(view).append(backHead('Build the form', '#/parse', 'Parsing'), h('div.card.stack', h('p', 'There are no forms to build yet' + (any ? '' : ' in verbs you know') + '. Forms open up as you learn the chart rows and the verbs. Verbs with contracted or irregular stems are left out.'), any ? null : h('a.btn', { href: '#/parse/run/build/any' }, 'Try with any verb'), ...backLinks(...back))); return; }
  const tally = [0, 0], missed = {}; let at = 0;
  const done = () => clear(view).append(backHead('Build the form', '#/parse', 'Parsing'), h('div.card.stack', h('h2', 'Practice complete'), h('p.muted.small', 'Practice only: nothing here changes your review schedule.'),
    h('div.kpis', h('div.kpi', h('b', tally[0] + ' / ' + tally[1]), h('span', 'pieces right'))), Object.keys(missed).length ? h('p', 'You missed the ', h('b', Object.entries(missed).sort((a, b) => b[1] - a[1])[0][0].toLowerCase()), ' most often.') : h('p', 'You got every piece.'),
    h('div.row.wrap', h('button.btn.primary', { onclick: () => renderBuild(view, mode) }, 'Practice more'), ...backLinks(...back))));
  const frame = (d, body, upto, mark) => { const L = D.lexByN.get(d.n), r = d.mood ? null : ROW[d.row]; clear(view).append(backHead('Build the form', '#/parse', 'Parsing'), h('div.stack', h('div.card.stack',
    h('div.row.between', h('b', 'Build the form'), h('span.chip', (at + 1) + ' / ' + queue.length)),
    h('div.card.small', { style: { background: 'var(--accent-soft)', border: 'none' } }, h('b', (d.mood ? moodHeading(d).replace(/^./, (c) => c.toUpperCase()).replace('person ', '') : say(r.name).replace(/^./, (c) => c.toUpperCase()) + ' indicative, ' + CELL_NAME[d.cell].replace('person ', ''))), h('div', { style: { color: 'var(--ink-2)' } }, 'of ', greek(L.head), ' · ', L.brief)),
    pieces(d, d.mood ? null : chartPieces(d), upto, mark), ...body))); };
  const chartLine = (d) => d.mood ? h('div', h('p.muted.small', { style: { margin: '.6rem 0 .2rem' } }, 'From the paradigm:'), h('p', { lang: 'grc', style: { margin: 0, fontFamily: 'var(--greek)', fontSize: '1.1rem' } }, d.kind.forms ? d.kind.forms.join(', ') : d.kind.model + ' (' + d.kind.gloss + ')')) : h('div', h('p.muted.small', { style: { margin: '.6rem 0 .2rem' } }, 'From the master verb chart:'), masterRowTable(d.row));
  const choose = (d, i, title, options, right, onRight, note = null, prompt = null) => {
    const box = h('div.opts.two'); let locked = false;
    for (const [v, label] of options) { const b = h('button.opt', { onclick: () => { if (locked) return; locked = true; const ok = v === right; tally[1]++; if (ok) tally[0]++; else missed[title] = (missed[title] || 0) + 1; b.classList.add(ok ? 'right' : 'wrong'); if (!ok) [...box.children].find((x) => x.dataset.v === String(right))?.classList.add('right'); if (note) { box.after(h('div.card.small.stack', { style: { background: 'var(--accent-soft)', border: 'none' } }, note, h('div', h('button.btn.primary.sm', { onclick: onRight }, 'Continue')))); } else setTimeout(onRight, ok ? 450 : 1300); } }, greek(label)); b.dataset.v = String(v); box.append(b); }
    return [h('p', h('b', title)), prompt ? h('p.muted.small', { style: { margin: 0 } }, prompt) : null, box];
  };
  const show = () => {
    const d = queue[at];
    if (d.mood) return showMood(d);
    const c = chartPieces(d), k = contractKind(d.n), seq = [];
    seq.push(['Front', frontOptions(d), frontAnswer(d)]);
    seq.push(['Stem', stemOptions(d), d.S, k && !d.contract ? lengthNote(d) : null]);
    if (d.aug) seq.push(['Lengthening', lengthenOptions(d), d.aug.to, h('span', 'Rule: ', greek(d.aug.from + ' → ' + d.aug.to), '. The first vowel lengthens like this: ', greek('α → η, ε → η, ο → ω, αι → ῃ, οι → ῳ, αυ → ηυ'), '. A few verbs, such as ', greek('ἔχω'), ', have ', greek('ε → ει'), '.'),
      h('span', 'The stem begins with ', greek(d.aug.from), '. What does the first vowel become?')]);
    seq.push(['Tense formative', formativeOptions(c), c.F]);
    if (c.V) seq.push(['Connecting vowel', vowelOptions(c), c.V]);
    seq.push(['Personal ending', endingOptions(d, c), c.PE]);
    if (d.contract) seq.push(contractEntry(d, ENDING_TABLE[ROW[d.row].ends][CELLS.indexOf(d.cell)][1]));
    const step = (i) => {
      if (i < seq.length) { const [title, opts, right, note, prompt] = seq[i]; frame(d, choose(d, i, title, opts, right, () => step(i + 1), note, prompt), i, i); return; }
      const parts = d.contract ? [d.A || null, d.contract.head, '(' + d.contract.k + ' + ' + dispInit(d.contract.init) + ' → ' + d.contract.res + ')', d.contract.rest ? final(d.contract.rest) : null].filter(Boolean)
        : [d.A || null, d.S, c.F || null, c.V || null, c.PE === '–' ? null : c.PE].filter(Boolean);
      frame(d, [h('div', { lang: 'grc', style: { fontFamily: 'var(--greek)', fontSize: '2.2rem', textAlign: 'center', margin: '.2rem 0' } }, isolated(d.word)),
        h('div.card.small', { style: { background: 'var(--good-soft)', border: 'none' } }, h('b', 'Built: '), greek(parts.join(' + ')), '. ', h('span.muted.small', 'Accents are not part of this exercise.')),
        d.aug ? h('p.muted.small', { style: { margin: 0 } }, 'The first vowel lengthens (', greek(d.aug.from + ' → ' + d.aug.to), '), so the word begins with ', greek(d.aug.to), '.', ROW[d.row].aug === 'RED' ? ' In the perfect this lengthening also does the work of the reduplication.' : '') : null,
        c.changes && !d.contract ? h('p.muted.small', { style: { margin: 0 } }, 'The pieces run together in the spelling: ', greek(final(c.naive) || '—'), ' is written ', greek(c.written), '.') : null,
        h('button.btn.primary', { onclick: () => { at++; at < queue.length ? show() : done(); } }, 'Next'), chartLine(d)], seq.length, -1);
    };
    step(0);
  };
  // a subjunctive, imperative or infinitive: stem, formative, connecting vowel, ending (an infinitive: stem and ending)
  const showMood = (d) => {
    const seq = [['Stem', moodStemOptions(d), d.S, contractKind(d.n) && !d.contract ? lengthNote(d) : null]];
    if (d.mood !== 'inf') { seq.push(['Tense formative', moodFormativeOptions(d), d.F]); if (d.V) seq.push(['Connecting vowel', moodVowelOptions(d), d.V]); seq.push(['Personal ending', moodEndingOptions(d), d.E]); }
    else seq.push(['Ending', moodEndingOptions(d), d.E]);
    if (d.contract) seq.push(contractEntry(d, d.contract.ex));
    const step = (i) => {
      if (i < seq.length) { const [title, opts, right, note, prompt] = seq[i]; frame(d, choose(d, i, title, opts, right, () => step(i + 1), note, prompt), i, i); return; }
      const parts = d.contract ? [d.contract.head, '(' + d.contract.k + ' + ' + d.contract.initShown + ' → ' + d.contract.res + ')', d.contract.rest ? final(d.contract.rest) : null].filter(Boolean) : [d.S, d.F || null, d.V || null, d.E ? final(d.E) : null].filter(Boolean), subscript = !d.contract && /[\u0345]/.test(d.vowelWritten.normalize('NFD'));
      frame(d, [h('div', { lang: 'grc', style: { fontFamily: 'var(--greek)', fontSize: '2.2rem', textAlign: 'center', margin: '.2rem 0' } }, isolated(d.word)),
        h('div.card.small', { style: { background: 'var(--good-soft)', border: 'none' } }, h('b', 'Built: '), greek(parts.join(' + ')), '. ', h('span.muted.small', 'Accents are not part of this exercise.')),
        subscript ? h('p.muted.small', { style: { margin: 0 } }, 'The vowel ', greek(d.V), ' is written ', greek(d.vowelWritten), ', with an iota subscript, in this form.') : null,
        h('button.btn.primary', { onclick: () => { at++; at < queue.length ? show() : done(); } }, 'Next'), chartLine(d)], seq.length, -1);
    };
    step(0);
  };
  show();
}
