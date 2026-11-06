// Build the form: practice only. You are told which form of which verb (tense, voice, person, number), and put it together one slot at a time:
// front (augment or reduplication) → stem → tense formative → ending. The forms are real forms from the text, taken apart with the chart's own pieces.
// A form is only offered when it adds up exactly (front + stem + formative + ending is the word, ignoring accents); anything else (vowel-initial
// stems, compound verbs, liquid and other irregular stems) is left out rather than split wrongly. Contract verbs (-άω, -έω, -όω) with a consonant at the front are
// built too: in the present and imperfect the stem vowel contracts with the ending (a Contraction step); elsewhere the stem vowel lengthens (ποιε- → ποιη-).
import { D, notParsed } from './data.js';
import { ROWS, say } from './chartdrill.js';
import { rowPool, moodPool, ptcPool } from './parse.js';
import { PTCB, PTC, split as splitPtc, MORPHEME_MEANING } from './ptcdata.js';
import { compoundOf } from './compound.js';
import { PREPS } from './cluehunt.js';
import { isLiquid } from './ptcdata.js';
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
  'aor-liq-act': { A: 'ε', F: '', E: A_ACT }, 'fut-liq-act': { A: '', F: '', E: ['ω', 'εις', 'ει', 'ουμεν', 'ετε', 'ουσι(ν)'] }, 'fut-liq-mid': { A: '', F: '', E: ['ουμαι', 'η', 'ειται', 'ουμεθα', 'εισθε', 'ουνται'] },
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
const contract = (n) => { const L = D.lexByN.get(n); if (!L) return true; return /μι$/.test(skel(L.head)) || (isCompoundLemma(L.head) && !compoundOf(n) && !/^εγειρ/.test(skel(L.head))); };      // ἐγείρω only looks like ἐγ- + a verb
const isMi = (n) => { const L = D.lexByN.get(n); return !!L && /μι$/.test(skel(L.head)); };
let VIRT = null;          // while a compound verb is taken apart: { n, P, variants } = its simple verb's stem and the written forms of its prefix
const vowelInitial = (n) => { if (VIRT && VIRT.n === n) return VOWEL_START.test(VIRT.P); const L = D.lexByN.get(n); return !!L && VOWEL_START.test(skel(L.head)); };
const liquidHead = (n) => { const L = D.lexByN.get(n); return !!L && isLiquid(L.head); };
/** A printed principal part as plain letters (a compound's without its prefix, while one is being taken apart); `keep` leaves the iota subscript. */
const partOf = (n, i, keep = false) => { const e = D.parts && D.parts.get(n), t = e && e.parts[i] ? (keep ? plainKeep(e.parts[i]) : skel(e.parts[i])) : ''; if (VIRT && VIRT.n === n) { const v = VIRT.variants.find((v) => t.startsWith(v)); return v ? t.slice(v.length) : ''; } return t; };
/** How the first vowel of a vowel-initial stem lengthens for the augment (the same lengthening is the reduplication of the perfect); longest vowel first. A vowel that is already long shows nothing, so those verbs are left out. */
const AUG = [['αι', ['ῃ']], ['ει', ['ῃ']], ['οι', ['ῳ']], ['αυ', ['ηυ']], ['ευ', ['ηυ']], ['α', ['η']], ['ε', ['η', 'ει']], ['ο', ['ω']]];
/** The ways an unaugmented vowel-initial stem can begin once its first vowel lengthens: [{ from, to, pre }] (pre in plain letters). */
/** A vowel-initial verb's second aorist: the stem is the one in the verb's printed principal part (ἔρχομαι: ἦλθον → ἐλθ-), found the same way in the word and in the part, so the augment's lengthening can be undone without guessing. */
function secondStem(n, row, body, P0) {
  const g = AUG.find(([x]) => P0.startsWith(x)); if (!g || !(D.parts && D.parts.get(n))) return null;
  const end = row === 'aor2-act' ? 'ον' : row === 'aor2-mid' ? 'ομην' : row === 'aor2-pas' ? 'ην' : null, pt = partOf(n, row === 'aor2-pas' ? 5 : 2);
  if (!end || !pt.endsWith(end) || (row === 'aor2-pas' && pt.endsWith('θην'))) return null;
  const pbody = pt.slice(0, -end.length);
  for (const to of g[1]) { const t = skel(to); if (body.startsWith(t) && pbody.startsWith(t) && body.slice(t.length) === pbody.slice(t.length)) return { S: g[0] + body.slice(t.length), aug: { from: g[0], to } }; }
  return null;
}
function augmented(S0) { const g = AUG.find(([x]) => S0.startsWith(x)); return g ? g[1].map((to) => ({ from: g[0], to, pre: skel(to) + S0.slice(g[0].length) })) : []; }
const lengthen = (p) => p.slice(0, -1) + ({ 'α': 'η', 'ε': 'η', 'ο': 'ω' }[p.slice(-1)] || p.slice(-1));
/** How a contract verb's stem vowel and the first vowel(s) of an uncontracted ending are written together (the endings are those of λύω). */
const CONTRACTS = { 'α': { ο: 'ω', ω: 'ω', ου: 'ω', ε: 'α', η: 'ᾳ', ει: 'ᾳ' }, 'ε': { ο: 'ου', ω: 'ω', ου: 'ου', ε: 'ει', η: 'ῃ', ει: 'ει' }, 'ο': { ο: 'ου', ω: 'ω', ου: 'ου', ε: 'ου', η: 'οι', ει: 'οι' } };
const INITS = ['ου', 'ει', 'ω', 'ο', 'ε', 'η'], INIT_SHOWN = { 'η': 'ῃ' };
/** The present stem of a verb, from its lexical form (λύω → λυ, ἔρχομαι is left out: its stem is not the present's). */
const presentStem = (n) => { if (VIRT && VIRT.n === n) return VIRT.P; const L = D.lexByN.get(n), s = L ? skel(L.head) : ''; return /(ω|ομαι)$/.test(s) ? s.replace(/(ω|ομαι)$/, '') : null; };      // contract and -μι verbs do not add up to a simple split

/** How a stem ending in a stop or ζ is written with the tense formative that follows (σ, κ, θ, θησ): ψ and ξ absorb the σ, a dental drops before σ and κ and becomes σ before θ, a labial or velar is aspirated before θ.
    Returns { joined, note } (the stem + formative as spelled) or null when nothing special happens; the word itself is always checked against it. */
const LAB = 'πβφ', VEL = 'κγχ', DENT = 'ζδτθ', ASP = { 'π': 'φ', 'β': 'φ', 'φ': 'φ', 'κ': 'χ', 'γ': 'χ', 'χ': 'χ' };
function soundJoin(P, F) {
  if (!P || !F) return null;
  const last = P.slice(-1), head = P.slice(0, -1);
  if (F === 'σ') {
    if (LAB.includes(last)) return { joined: head + 'ψ', merged: true, note: last + ' + σ is written ψ' };
    if (VEL.includes(last)) return { joined: head + 'ξ', merged: true, note: last + ' + σ is written ξ' };
    if (DENT.includes(last)) return { joined: head + 'σ', note: 'the final ' + last + ' of the stem drops before σ' };
  } else if (F === 'κ') {
    if (DENT.includes(last)) return { joined: head + 'κ', note: 'the final ' + last + ' of the stem drops before κ' };
  } else if (F === 'θ' || F === 'θησ') {
    if (LAB.includes(last) || VEL.includes(last)) return { joined: head + ASP[last] + F, note: last + ' becomes ' + ASP[last] + ' before θ' };
    if (DENT.includes(last)) return { joined: head + 'σ' + F, note: 'the final ' + last + ' of the stem becomes σ before θ' };
  }
  return null;
}
/** The stem of a liquid verb's future or aorist, read from the verb's printed principal part (μένω: μενῶ, ἔμεινα → μεν-, μειν-); a vowel-initial verb also gives the lengthening (ἐγείρω: ἤγειρα). */
function liquidStem(n, kind) {
  const P = presentStem(n); if (!(D.parts && D.parts.get(n)) || !P || !liquidHead(n) || contractKind(n)) return null;
  const fut = kind === 'fut', pt = partOf(n, fut ? 1 : 2), end = fut ? ['ουμαι', 'ω'].find((x) => pt.endsWith(x)) : ['αμην', 'α'].find((x) => pt.endsWith(x)); if (!end) return null;
  const body = pt.slice(0, -end.length);
  const liquidEnd = (t) => /[λμνρ]$/.test(t);                                  // φθάνω's ἔφθασα and ἁμαρτάνω's ἁμαρτήσω keep a σ: not liquid futures or aorists
  if (fut) return body.length >= 2 && liquidEnd(body) ? { S: body, aug: null } : null;
  if (vowelInitial(n)) { const c = augmented(P).find((c) => c.pre === body && partOf(n, 2, true).startsWith(plainKeep(c.to))); return c && liquidEnd(P) ? { S: P, aug: { from: c.from, to: c.to } } : null; }     // ἦρα (αἴρω) is not αι → ῃ
  return body[0] === 'ε' && body.length >= 3 && liquidEnd(body) ? { S: body.slice(1), aug: null } : null;
}
/** A liquid verb's future (no σ: μεν + ε + ω is written μενῶ) or 1st aorist (no σ, stem vowel lengthened), taken from the printed stem. */
function decomposeLiquid(id, row, f, a, cell) {
  const T = BUILD[row], ls = liquidStem(a.s, /^aor/.test(row) ? 'aor' : 'fut'); if (!ls) return null;
  const w = skel(f.w), E = T.E[CELLS.indexOf(cell)], P = presentStem(a.s);
  for (const e of variants(E)) {
    const want = ls.aug ? skel(ls.aug.to) + ls.S.slice(ls.aug.from.length) + e : T.A + ls.S + e;
    if (w === want) return { row, cell, A: ls.aug ? '' : T.A, S: ls.S, F: '', E, used: e, word: f.w.replace(/­/g, ''), n: a.s, id, aug: ls.aug, liquid: { from: P } };
  }
  return null;
}
/** A stop or ζ stem meeting a perfect middle/passive ending that begins with μ, σ or τ (γράφω: γέγραμμαι, γέγραψαι, γέγραπται, γέγραφθε), as it is written; null for other stems. */
const PCLS = (c) => (LAB.includes(c) ? 'L' : VEL.includes(c) ? 'V' : DENT.includes(c) ? 'D' : null);
function perfJoin(P, e) {
  const last = P.slice(-1), head = P.slice(0, -1), cls = PCLS(last), c = e[0]; if (!cls || !head) return null;
  const th = e.startsWith('σθ');
  if (c === 'μ') return { joined: head + { L: 'μ', V: 'γ', D: 'σ' }[cls] + e, note: { L: 'π, β, φ + μ is written μμ', V: 'κ, γ, χ + μ is written γμ', D: 'a dental (τ, δ, θ, ζ) before μ is written σ' }[cls] };
  if (th) return { joined: head + { L: 'φ', V: 'χ', D: 'σ' }[cls] + e.slice(1), note: { L: 'π, β, φ become φ before θ', V: 'κ, γ, χ become χ before θ', D: 'a dental before θ becomes σ' }[cls] };
  if (c === 'σ') return { joined: head + { L: 'ψ', V: 'ξ', D: 'σ' }[cls] + e.slice(1), note: { L: 'π, β, φ + σ is written ψ', V: 'κ, γ, χ + σ is written ξ', D: 'a dental drops before σ' }[cls] };
  if (c === 'τ') return { joined: head + { L: 'π', V: 'κ', D: 'σ' }[cls] + e, note: { L: 'β and φ become π before τ', V: 'γ and χ become κ before τ', D: 'a dental before τ is written σ' }[cls] };
  return null;
}
/** The reduplication of a perfect stem, in plain letters: its first consonant (unaspirated) + ε, or just ε for ρ, ζ, ξ, ψ, σ + a stop and other clusters. */
function redOf(P) {
  const a = P[0], b = P[1];
  if (!a || VOWEL_START.test(a) || 'ρζξψ'.includes(a) || (a === 'σ' && b && !VOWEL_START.test(b))) return 'ε';
  if (b && !VOWEL_START.test(b) && !('λρ'.includes(b) && 'πβφκγχτδθ'.includes(a))) return 'ε';
  return ({ 'φ': 'π', 'θ': 'τ', 'χ': 'κ' }[a] || a) + 'ε';
}
/** A perfect middle/passive of a stop or ζ stem: reduplication (or lengthening) + the stem as spelled with the ending. */
function decomposePerfMp(id, row, f, a, cell) {
  const T = BUILD[row], P = presentStem(a.s), w = skel(f.w), E = T.E[CELLS.indexOf(cell)];
  if (!P || contractKind(a.s) || E === 'νται') return null;
  const pj = perfJoin(P, E); if (!pj) return null;
  let A = '', aug = null;
  if (vowelInitial(a.s)) { const c = augmented(P).find((c) => skel(c.to) + pj.joined.slice(c.from.length) === w); if (!c) return null; aug = { from: c.from, to: c.to }; }
  else { A = redOf(P); if (A + pj.joined !== w) return null; }
  return { row, cell, A, S: P, F: '', E, used: E, word: f.w.replace(/­/g, ''), n: a.s, id, aug, perfSound: { joined: pj.joined, note: pj.note, tail: E } };
}
/** -μι verbs (δίδωμι, τίθημι, ἵστημι and their compounds): the future, the κ-aorist (σα for ἵστημι), the perfect and the 1st aorist and future passive are built from the stem and formative printed in the principal parts. */
const MI_PART = { 'fut-act': 1, 'fut-mid': 1, 'fut-pas1': 5, 'aor1-act': 2, 'perf1-act': 3, 'perf-mp': 4, 'aor1-pas': 5 };
const MI_END = { 'fut-act': ['σω'], 'fut-mid': ['σω'], 'fut-pas1': ['θην'], 'aor1-act': ['κα', 'σα'], 'perf1-act': ['κα'], 'perf-mp': ['μαι'], 'aor1-pas': ['θην'] };
function miStem(n, row) {
  const pt = partOf(n, MI_PART[row]), end = pt && MI_END[row].find((x) => pt.endsWith(x)); if (!end) return null;
  const body = pt.slice(0, -end.length), F = { 'σω': 'σ', 'κα': 'κ', 'σα': 'σ', 'θην': row === 'fut-pas1' ? 'θησ' : 'θ', 'μαι': '' }[end];
  if (row === 'fut-act' || row === 'fut-mid') return VOWEL_START.test(body[0] || 'α') || body.length < 2 ? null : { A: '', S: body, F };
  if (row === 'perf1-act' || row === 'perf-mp') { for (const k of [2, 1]) { const S = body.slice(k); if (S.length >= 2 && !VOWEL_START.test(S[0]) && redOf(S) === body.slice(0, k)) return { A: body.slice(0, k), S, F }; } return null; }
  return body[0] === 'ε' && body.length >= 3 && !VOWEL_START.test(body[1]) ? { A: 'ε', S: body.slice(1), F } : null;
}
function decomposeMi(id, row, f, a, cell) {
  const T = BUILD[row], m = miStem(a.s, row); if (!T || !m) return null;
  const E = T.E[CELLS.indexOf(cell)], w = skel(f.w);
  for (const e of variants(E)) if (w === m.A + m.S + m.F + e) return { row, cell, A: m.A, S: m.S, F: m.F, E, used: e, word: f.w.replace(/­/g, ''), n: a.s, id, aug: null, mi: true };
  return null;
}
/** A form taken apart: { row, cell, A, S, F, E, word, n } or null when it does not add up exactly. */
export function decompose(id, row) {
  const f = D.forms[id], a = f.an[0], ci = a && compoundOf(a.s); if (!ci) return decomposeCore(id, row, f);
  const w = skel(f.w);
  for (const v of ci.variants) {
    if (!w.startsWith(v) || w.length - v.length < 3) continue;
    VIRT = { n: a.s, P: ci.stem, variants: ci.variants };
    try { const d = decomposeCore(id, row, { ...f, w: w.slice(v.length) }); if (d) return { ...d, word: f.w.replace(/\u00ad/g, ''), prefix: { shown: v, key: ci.key } }; } finally { VIRT = null; }
  }
  return null;
}
function decomposeCore(id, row, f) {
  const a = f.an[0], T = BUILD[row]; if (!a || !T || notParsed(a)) return null;
  const cell = cellOf(a.m); if (!cell || rowOfTag(a.m, a.s) !== row) return null;
  if (isMi(a.s)) return MI_PART[row] ? decomposeMi(id, row, f, a, cell) : null;
  if (contract(a.s)) return null;
  if (/-liq-|^aor-liq/.test(row)) return decomposeLiquid(id, row, f, a, cell);
  if (row === 'aor1-mid' && liquidHead(a.s) && !contractKind(a.s)) { const d = decomposeLiquid(id, row, f, a, cell); if (d) return d; }
  if (contractKind(a.s) && /^(pres|impf)-/.test(row)) return decomposeContract(id, row, f, a, cell);
  const w = skel(f.w), E = T.E[CELLS.indexOf(cell)], k = contractKind(a.s), P = presentStem(a.s), sj = P && !k && !/^(aor2|perf2)/.test(row) ? soundJoin(P, T.F) : null;
  // the word either ends with formative + ending, or (ψ and ξ) the formative is absorbed into the stem and only the ending follows
  const tries = [];
  for (const e of variants(E)) { const s = T.F + e; if (w.endsWith(s) && w.length - s.length >= 3) tries.push({ body: w.slice(0, w.length - s.length), used: e, merged: false }); }
  if (sj && sj.merged) for (const e of variants(E)) { const stem = w.slice(0, w.length - e.length); if (stem.length >= 3 && /[ψξ]$/.test(stem)) tries.push({ body: stem.slice(0, -1) + P.slice(-1), used: e, merged: true }); }
  // the stems the word may show: the present stem, the present stem with the sound change at the formative, a contract verb's lengthened stem
  const stems = uniq([P, sj && !sj.merged ? sj.joined.slice(0, sj.joined.length - T.F.length) : null, k ? lengthen(P) : null].filter(Boolean));
  for (const { body, used, merged } of tries) {
    let A = '', S = body, aug = null;
    if (T.A !== '' && vowelInitial(a.s)) {           // the augment (or the perfect's reduplication) is the first vowel lengthening: the stem is shown as it is without it
      const P0 = presentStem(a.s); if (!P0 || /^perf2/.test(row)) continue;
      if (/^aor2/.test(row)) { const s2 = secondStem(a.s, row, body, P0); if (s2) { S = s2.S; aug = s2.aug; } }
      else for (const S0 of stems) for (const c of augmented(S0)) if (body === c.pre) { S = S0; aug = { from: c.from, to: c.to }; }
      if (!aug) continue;
    } else if (T.A === 'ε') { if (body[0] !== 'ε' || body.length < 3 || VOWEL_START.test(body[1])) continue; A = 'ε'; S = body.slice(1); }
    else if (T.A === 'RED') { if (body.length < 4 || body[1] !== 'ε' || body[0] !== body[2] || VOWEL_START.test(body[0])) continue; A = body.slice(0, 2); S = body.slice(2); }
    if (S.length < 2) continue;
    // a stem that is only the present stem with sounds dropped or changed would be misleading: those rows show the verb's own present stem and name the change
    // (the second aorist and second perfect are different stems by definition, so they are free)
    if (/^(aor2|perf2)/.test(row)) { if (k) continue; return { row, cell, A, S, F: T.F, E, used, word: f.w.replace(/­/g, ''), n: a.s, id, aug }; }
    if (S === P || (k && S === lengthen(P))) return { row, cell, A, S, F: T.F, E, used, word: f.w.replace(/­/g, ''), n: a.s, id, aug, sound: merged ? sj : null };
    if (sj && !sj.merged && S === sj.joined.slice(0, sj.joined.length - T.F.length)) return { row, cell, A, S: P, F: T.F, E, used, word: f.w.replace(/­/g, ''), n: a.s, id, aug, sound: sj };
  }
  return row === 'perf-mp' ? decomposePerfMp(id, row, f, a, cell) : null;
}
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
  const plain = (x) => (x === '–' ? '' : x), form = d.liquid && r.form[0] === 'σ' ? r.form.slice(1) : d.mi && d.F === 'κ' && /^aor1/.test(d.row) ? 'κα' : r.form, naive = form + V + plain(PE), norm = (x) => skel(x).replace('(ν)', ''), written = d.F + d.E;
  return { F: form, V, PE, naive, written: final(written), changes: norm(naive) !== norm(written) };
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
  return { mood, key: x.key, S: P, F: '', V: u.V, E: nu(u.E), vowelWritten: u.written, word: x.w, n: x.n, id: x.id, who, row: null, kind: MOODS[mood].B.get(x.key), real: P.slice(0, -1) + skel(res) + nu(u.rest),
    contract: { k, init: u.init, initShown: u.init, res, rest: nu(u.rest), head: P.slice(0, -1), ex: u.ex } };
}
/** A subjunctive, imperative or infinitive taken apart: { mood, key, S, F, V, E, written, word, n, id, who }, or null. */
/** Run a decomposer on a compound verb's form without its prefix, and put the prefix back on the result. */
function viaPrefix(x, fn) {
  const ci = compoundOf(x.n); if (!ci) return fn(x);
  const w = skel(x.w);
  for (const v of ci.variants) {
    if (!w.startsWith(v) || w.length - v.length < 3) continue;
    VIRT = { n: x.n, P: ci.stem, variants: ci.variants };
    try { const d = fn({ ...x, w: w.slice(v.length) }); if (d) return { ...d, word: x.w, prefix: { shown: v, key: ci.key } }; } finally { VIRT = null; }
  }
  return null;
}
export const decomposeMood = (mood, x) => viaPrefix(x, (y) => decomposeMoodCore(mood, y));
export const decomposePtc = (x) => viaPrefix(x, decomposePtcCore);
function decomposeMoodCore(mood, x) {
  const M = MOODS[mood], r = M.B.get(x.key); if (!r || /^perf/.test(x.key) || contract(x.n)) return null;
  const k = contractKind(x.n);
  if (k) { if (/^pres/.test(x.key)) return decomposeMoodContract(mood, x); if (/^aor2/.test(x.key)) return null; }
  const sp = M.split(x.w, x.key, !k && liquidHead(x.n) && /^aor1-(act|mid)$/.test(x.key) ? { liquid: true } : undefined); if (!sp) return null;
  let S = sp.stemSkel, liquid = null; const P = presentStem(x.n), F = skel(sp.formative || ''), V = skel(sp.vowel || ''), E0 = skel(sp.ending || ''); let sound = null;
  if (!S || S.length < 2 && !sp.merged) return null;
  if (sp.liquid) { const ls = liquidStem(x.n, 'aor'); if (!ls || ls.S !== S) return null; liquid = { from: P }; }
  else if (!/^aor2/.test(x.key)) {
    if (sp.merged) {                                  // ψ or ξ: the stem as printed lacks the stop (subjunctive) or is the full stem with the σ split off (imperative, infinitive)
      const sj = soundJoin(P, 'σ');
      if (!(sj && sj.merged && (S === P || (P.slice(0, -1) === S && sj.joined === skel(S + sp.formative))))) return null;
      sound = sj; S = P;
    } else if (!(S === P || (k && S === lengthen(P)))) {
      const tail0 = (F + V + E0)[0], sj = soundJoin(P, tail0);
      if (!(sj && !sj.merged && S + tail0 === sj.joined)) return null;
      sound = sj; S = P;
    }
  }
  if (S.length < 2) return null;
  const who = mood === 'inf' ? '' : WHO(x.code); if (mood !== 'inf' && !who) return null;
  const E = E0.replace(/^σι$/, 'σι(ν)').replace(/^σιν$/, 'σι(ν)'), tail = F + V + E, real = sound ? sound.joined + tail.slice(1) : S + tail;
  if (liquid && skel(real.replace('(ν)', '')) !== skel(x.w) && skel(real.replace('(ν)', 'ν')) !== skel(x.w)) return null;
  return { mood, key: x.key, S, F, V, E, vowelWritten: plainKeep(sp.vowel || ''), word: x.w, n: x.n, id: x.id, who, row: null, kind: r, sound, real, liquid };
}
/* ---------- participles: front (perfects) · stem · formative · ending (marker + case ending) ---------- */
const CASE_N = { N: 'nominative', G: 'genitive', D: 'dative', A: 'accusative', V: 'vocative' }, NUM_N = { S: 'singular', P: 'plural' }, GEN_N = { M: 'masculine', F: 'feminine', N: 'neuter' };
const DEASP = { 'φ': 'π', 'θ': 'τ', 'χ': 'κ' };
/** A participle taken apart, or null when it does not add up exactly: contract, liquid, -μι and compound verbs, second perfects and anything whose stem is not the verb's own are left out. */
/** A perfect middle/passive participle of a stop or ζ stem (γεγραμμένος, πεπεισμένος): reduplication + the stem spelled with μενο-. */
function perfMpPtc(x, r, P, sp) {
  const w = skel(x.w), rest = skel(sp.rest || ''), pj = rest.startsWith('μ') ? perfJoin(P, rest) : null; if (!pj) return null;
  let A = '', aug = null;
  if (vowelInitial(x.n)) { const c = augmented(P).find((c) => skel(c.to) + pj.joined.slice(c.from.length) === w); if (!c) return null; aug = { from: c.from, to: c.to }; }
  else { A = redOf(P); if (A + pj.joined !== w) return null; }
  return { mood: 'ptc', key: x.key, S: P, F: '', V: '', E: rest, A, aug, word: x.w, n: x.n, id: x.id, who: null, row: null, kind: r, sound: null, real: w, label: CASE_N[x.case] + ' ' + NUM_N[x.number] + ' ' + GEN_N[x.gender], case: x.case, number: x.number, vowelWritten: '', liquid: null, perfSound: { joined: pj.joined, note: pj.note, tail: rest } };
}
function decomposePtcCore(x) {
  const r = PTCB.get(x.key); if (!r || contract(x.n) || /^perf2/.test(x.key)) return null;
  const k = contractKind(x.n), P = presentStem(x.n); if (!P || P.length < 2) return null;
  if (k && /^pres/.test(x.key)) return decomposePtcContract(x, r, k, P);
  const lq = !k && liquidHead(x.n) && /^aor1-(act|mid)$/.test(x.key), sp = splitPtc(x.w, x.key, { liquid: lq }); if (!sp) return null;
  if (x.key === 'perf-mp' && !k && PCLS(P.slice(-1)) && !/^perf2/.test(x.key)) return perfMpPtc(x, r, P, sp);
  const perf = /^perf/.test(x.key), sec = /^aor2/.test(x.key), vi = vowelInitial(x.n), word = skel(x.w);
  const rest = skel(sp.rest || ''); let F = skel(sp.formative || ''); if (sp.merged) F = 'σ' + F.slice(1);
  let body = sp.stemSkel, A = '', aug = null, S1;
  if (perf) {
    if (vi) { const c = augmented(P).find((c) => c.pre === body); if (!c) return null; aug = { from: c.from, to: c.to }; S1 = P; }
    else { const red = (DEASP[P[0]] || P[0]) + 'ε'; if (VOWEL_START.test(P[0]) || !body.startsWith(red)) return null; A = red; S1 = body.slice(2); }
  } else S1 = body;
  if (S1.length < 2 && !sp.merged) return null;
  let S = null, sound = null;
  let liquid = null;
  if (sp.liquid) { const ls = liquidStem(x.n, 'aor'); if (!ls || ls.S !== S1) return null; liquid = { from: P }; S = S1; }
  else if (k && sec) return null;
  else if (sec) {                                           // the stem is the one in the printed principal part
    if (vi) return null;
    const pt = partOf(x.n, x.key === 'aor2-pas' ? 5 : 2);
    const end = x.key === 'aor2-act' ? 'ον' : x.key === 'aor2-mid' ? 'ομην' : 'ην';
    if (!pt.endsWith(end)) return null; const pb = pt.slice(0, -end.length);
    if (!(pb === S1 || pb === 'ε' + S1)) return null; S = S1;
  } else if (x.key.startsWith('pres')) { if (S1 !== P) return null; S = P; }
  else if (sp.merged) { const sj = soundJoin(P, 'σ'); if (!(sj && sj.merged && S1 === P.slice(0, -1))) return null; sound = sj; S = P; }
  else if (S1 === P || (k && S1 === lengthen(P))) S = S1;
  else { const t0 = (F + rest)[0], sj = F ? soundJoin(P, t0) : null; if (!(sj && !sj.merged && !aug && S1 + t0 === sj.joined)) return null; sound = sj; S = P; }
  const tail = F + rest, real = aug ? augmented(P).find((c) => c.pre === body).pre + tail : A + (sound ? sound.joined + tail.slice(1) : S + tail);
  if (real !== word) return null;
  const who = null, label = CASE_N[x.case] + ' ' + NUM_N[x.number] + ' ' + GEN_N[x.gender];
  return { mood: 'ptc', key: x.key, S, F, V: '', E: rest, A, aug, word: x.w, n: x.n, id: x.id, who, row: null, kind: r, sound, real, label, case: x.case, number: x.number, vowelWritten: '', liquid };
}
/** A present participle of a contract verb: the stem keeps its vowel (ποιε-) and contracts with the formative of the model form (ε + ο → ου: ποιοῦντες). */
function decomposePtcContract(x, r, k, P) {
  if (P.length < 3 || P.slice(-1) !== k || x.case === 'V') return null;
  const gi = 'MFN'.indexOf(x.gender), ci = 'NGDA'.indexOf(x.case); if (gi < 0 || ci < 0) return null;
  const model = r.forms[(x.number === 'P' ? 4 : 0) + ci][gi], sp = splitPtc(model.replace('(ν)', ''), x.key); if (!sp) return null;
  const init = skel(sp.formative), rest = skel(sp.rest), res = CONTRACTS[k][init]; if (!res) return null;
  const w = skel(x.w), head = P.slice(0, -1) + skel(res), used = (rest === 'σι' ? ['σι', 'σιν'] : [rest]).find((e) => w === head + e); if (used === undefined) return null;
  return { mood: 'ptc', key: x.key, S: P, F: init, V: '', E: used, A: '', aug: null, word: x.w, n: x.n, id: x.id, who: null, row: null, kind: r, sound: null, real: head + used, label: CASE_N[x.case] + ' ' + NUM_N[x.number] + ' ' + GEN_N[x.gender], case: x.case, number: x.number, vowelWritten: '',
    contract: { k, init, initShown: init, res, rest: used, head: P.slice(0, -1), ex: model.replace('(ν)', '') } };
}
const ptcRests = (r) => { if (r._rests) return r._rests; const o = new Set(); for (const c of r.forms) for (const f of c) for (const v of (f.includes('(ν)') ? [f.replace('(ν)', ''), f.replace('(ν)', 'ν')] : [f])) { const sp = splitPtc(v, r.key); if (sp) o.add(skel(sp.rest)); } return (r._rests = [...o]); };
function ptcEndingOptions(d) {
  const same = ptcRests(d.kind).filter((e) => e !== d.E), other = uniq(PTC.filter((r) => r.key !== d.key).flatMap(ptcRests)).filter((e) => e !== d.E && !same.includes(e));
  return shuffle(uniq([d.E, ...shuffle(same).slice(0, 2), ...shuffle(other).slice(0, 1), ...shuffle(same).slice(2), ...shuffle(other).slice(1)]).slice(0, 4)).map((e) => [e, e === '' ? 'none' : '-' + final(e)]);
}
const ptcFormativeOptions = (d) => shuffle(uniq([d.F, ...shuffle(['ο', 'ου', 'ω', 'σα', 'α', 'θε', 'ε', 'κ', ''].filter((f) => f !== d.F)).slice(0, 3)])).map((f) => [f, f || 'none']);
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
  const P = contractKind(d.n) ? presentStem(d.n) : null, pool = P ? [d.S, P, lengthen(P), P.slice(0, -1), d.S + 'σ'] : [d.S, ...(d.liquid ? [d.liquid.from] : []), ...(d.sound ? [d.sound.joined, d.sound.joined.slice(0, -1)] : []), d.S.slice(0, -1), d.S + 'σ', d.S + 'θ', d.S + 'κ'];
  return shuffle(uniq(pool.filter((s) => s.length >= 2)).slice(0, 4)).map((s) => [s, s + '-']);
}
const moodFormativeOptions = (d) => { const pool = d.mood === 'imp' ? ['σα', 'θη', 'η', ''] : ['σ', 'θ', 'κ', '']; return shuffle(uniq([d.F, ...pool].slice(0, 4))).map((f) => [f, f || 'none']); };
const moodVowelOptions = (d) => shuffle(uniq([d.V, ...(d.mood === 'sub' ? ['ω', 'η', 'ο', 'ε'] : ['ε', 'ο', 'α', 'η'])]).slice(0, 4)).map((v) => [v, v]);
/** The tiles and steps of a mood form, in order. */
/** The shape of the first screen text, e.g. "1st aorist active subjunctive, 3rd person singular". */
const moodHeading = (d) => d.mood === 'ptc' ? d.kind.name + ' participle, ' + d.label : d.kind.name + ' ' + MOODS[d.mood].name + (d.who ? ', ' + CELL_NAME[d.who] : '');

/* ---------- the pool and the session ---------- */
let byVerb = null;
const formsOfVerb = (n) => { if (!byVerb) { byVerb = new Map(); D.forms.forEach((f, i) => { const a = f.an[0]; if (a && !notParsed(a)) { if (!byVerb.has(a.s)) byVerb.set(a.s, []); byVerb.get(a.s).push(i); } }); } return byVerb.get(n) || []; };
/** Forms of one row that can be built, from verbs you know or any verb; only forms whose level is open (gated like the daily quiz). */
export function buildPool(row, any = false) { return rowPool(row, { gated: true, anyVerb: any }).map((id) => decompose(id, row)).filter(Boolean); }
const dense = (xs) => xs.sort((a, c) => D.forms[c.id].count - D.forms[a.id].count).slice(0, 30);
/** Forms of the other moods (subjunctive, imperative, infinitive), one list per kind. */
export function buildMoodLists(mood, any = false) {
  const by = new Map();
  for (const x of mood === 'ptc' ? ptcPool({ anyVerb: any }) : moodPool(mood, { anyVerb: any })) { const d = mood === 'ptc' ? decomposePtc(x) : decomposeMood(mood, x); if (d) { if (!by.has(x.key)) by.set(x.key, []); by.get(x.key).push(d); } }
  return [...by.values()].map((l) => shuffle(dense(l)));
}
export function buildQueue(any = false, total = 8) {
  const groups = shuffle([shuffle(BUILD_ROWS.map((r) => shuffle(dense(buildPool(r, any)))).filter((l) => l.length)), ...['sub', 'imp', 'inf', 'ptc'].map((m) => buildMoodLists(m, any))].filter((g) => g.length));
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
  const synthetic = uniq((k ? [P, lengthen(P), P.slice(0, -1)] : [...(d.sound ? [d.sound.joined, d.sound.joined.slice(0, -d.F.length)] : []), d.S + 'σ', d.S + 'θ', d.S.slice(0, -1), d.S + 'κ']).filter((s) => s.length >= 2 && s !== d.S));
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
  const { k, init, res } = d.contract, T = d.mood && d.mood !== 'ptc' ? MOOD_CONTRACTS[d.mood] : CONTRACTS, others = uniq([...Object.entries(T[k]).filter(([x]) => x !== init).map(([, r]) => r), ...Object.values(T).map((t) => t[init]), ...(d.mood && d.mood !== 'ptc' ? ['ω', 'ει', 'ου', 'α'] : [])].filter((r) => r && r !== res && skel(r) !== skel(res)));
  return shuffle([res, ...shuffle(others).slice(0, 3)]).map((r) => [r, r]);
}

/* ---------- the screens ---------- */
/** A word shown on its own: an accent that only comes from a following enclitic (πέποιθάς τε) is dropped, so it never shows two accents. */
const isolated = (w) => { const s = w.normalize('NFD'), m = [...s.matchAll(/[\u0300\u0301\u0342]/g)]; if (m.length < 2) return w; const k = m[m.length - 1].index; return (s.slice(0, k) + s.slice(k + 1)).normalize('NFC'); };
const greek = (t, cls = '') => h('span' + cls, { lang: 'grc' }, t);
/** Where two spellings differ: the length of what they share at the start and at the end. */
const sameEnds = (a, b) => { let p = 0; while (p < a.length && p < b.length && a[p] === b[p]) p++; let q = 0; while (q < a.length - p && q < b.length - p && a[a.length - 1 - q] === b[b.length - 1 - q]) q++; return [p, q]; };
/** The word as built so far: the letters already laid down are green, what the last step added or changed is blue. `states[i]` is the word after i steps. */
const wordStrip = (strip, upto, mark) => {
  const { states, titles } = strip, cur = states[upto] || '', prev = upto > 0 ? states[upto - 1] : '';
  const chip = (t, bg, bd) => t ? h('span', { style: { background: bg, border: '2px solid ' + bd, borderRadius: '8px', padding: '.05rem .25rem', margin: '0 .05rem' } }, final(t)) : null;
  let parts;
  if (!cur) parts = [h('span', { style: { color: 'var(--muted)' } }, '· · ·')];
  else if (mark < 0 || upto === 0 || prev === cur) parts = [chip(cur, 'var(--good-soft)', 'var(--good)')];
  else { const [p, q] = sameEnds(prev, cur); parts = [chip(cur.slice(0, p), 'var(--good-soft)', 'var(--good)'), chip(cur.slice(p, cur.length - q), 'var(--accent-soft)', 'var(--accent)'), chip(cur.slice(cur.length - q), 'var(--good-soft)', 'var(--good)')]; }
  return h('div', { style: { textAlign: 'center', margin: '.5rem 0' } },
    h('div', { lang: 'grc', style: { fontFamily: 'var(--greek)', fontSize: '2rem', lineHeight: 1.6 } }, ...parts),
    h('small', { style: { font: '700 .6rem var(--ui)', letterSpacing: '.05em', textTransform: 'uppercase', color: 'var(--muted)' } }, upto === 0 ? 'The word is built here, one piece at a time' : mark < 0 ? 'The finished word' : 'Just laid down: ' + titles[upto - 1]));
};
/** The spellings offered for a Sound step: the right one, the pieces laid side by side unchanged, and look-alikes of the letters that change. */
const CLASSES = ['πβφψ', 'κγχξ', 'τδθζσ'], VOWEL_SET = ['ω', 'ο', 'ου', 'οι', 'η', 'ε', 'ει', 'α'];
function writtenOptions(N, T) {
  const V = /[αεηιουω]/; let [p, q] = sameEnds(N, T);
  if (V.test(T.slice(p, T.length - q))) { while (p > 0 && V.test(T[p - 1])) p--; while (q > 0 && V.test(T[T.length - q])) q--; }      // a changed vowel is swapped as a whole (ου, not just υ)
  const mid = T.slice(p, T.length - q), head = T.slice(0, p), tail = T.slice(T.length - q);
  const vowel = V.test(mid) && !/[^αεηιουω]/.test(mid), pool = vowel ? VOWEL_SET : (CLASSES.find((g) => mid.length === 1 && g.includes(mid)) || CLASSES.join('')).split('');
  return shuffle(uniq([T, N, ...shuffle(pool.filter((x) => x !== mid)).slice(0, 3).map((x) => head + x + tail)]).slice(0, 4)).map((x) => [x, final(x)]);
}

/** After the Stem answer for a contract verb outside the present and imperfect: the stem vowel lengthens (or stays). */
const lengthNote = (d) => { const P = presentStem(d.n);
  return d.S === P ? h('span', 'A contract verb’s last stem vowel usually lengthens before σ, θ and κ (ε → η, α → η, ο → ω). Here it stays ', greek(P + '-'), '.')
    : h('span', 'A contract verb’s last stem vowel lengthens before σ, θ and κ: ', greek(P + '- → ' + d.S + '-'), ' (ε → η, α → η, ο → ω).'); };
/** The Contraction step: options, the answer, the rule shown afterwards and the question; `ex` is the λύω form the uncontracted ending is taken from. */
const contractEntry = (d, ex) => {
  const { k, init, res, rest } = d.contract, si = d.contract.initShown || dispInit(init), U = d.mood === 'ptc' ? d.F + d.E : (d.vowelWritten || d.V || '') + d.E;
  return ['Contraction', contractOptions(d), res, h('span', 'Rule: ', greek(k + ' + ' + si + ' → ' + res), '. So the ending ', greek('-' + shown(U)), ' is written ', greek('-' + final(res + rest)), ' after this stem.'),
    h('span', 'The stem ends in ', greek(k), '. The uncontracted ending is ', greek('-' + shown(U)), ' (as in ', greek(ex.replace(/[()]/g, '')), '). How are the stem vowel ', greek(k), ' and the ending’s ', greek(si), ' written together?')];
};

/** The line shown after the Stem answer: a contract verb's lengthened vowel, or a liquid verb's own future or aorist stem. */
const stemNote = (d) => d.mi ? h('span', 'A -μι verb has stems of its own. Here the stem is the one printed in the principal parts: ', greek(d.S + '-'), '.') : d.liquid ? h('span', 'A liquid verb (stem in λ, μ, ν or ρ) has no σ' + (/^fut/.test(d.row || d.key) ? ' in the future, where ε + the ending contract (μεν + ε + ω is written μενῶ). ' : ' in the 1st aorist, and its stem vowel is usually lengthened. '), d.S === presentStem(d.n) ? 'Here the stem is the present stem ' : 'Here the stem is printed in the principal parts as ', greek(d.S + '-'), '.')
  : contractKind(d.n) && !d.contract ? lengthNote(d) : null;
/** The Prefix step of a compound verb: the preposition as it is written in this form, and the rule when it changed. */
const prefixEntry = (d) => {
  const { shown, key } = d.prefix, forms = Object.entries(PREPS).flatMap(([k, v]) => k === key ? v : []), others = uniq(Object.entries(PREPS).filter(([k]) => k !== key).map(([, v]) => v[0]));
  const options = shuffle(uniq([shown, ...shuffle(forms.filter((x) => x !== shown)).slice(0, 2), ...shuffle(others).slice(0, 2)]).slice(0, 4)).map((x) => [x, x + '-']);
  const note = shown === key ? null : key.startsWith(shown) ? h('span', 'The preposition ', greek(key + '-'), ' loses its final vowel before the augment or a vowel: ', greek(key + ' → ' + shown), '.')
    : h('span', 'The last sound of the preposition ', greek(key + '-'), ' changes to suit what follows: ', greek(key + ' → ' + shown), ' (a rough breathing aspirates π, κ, τ: ', greek('ἀπό → ἀφ'), ', ', greek('ἐκ → ἐξ'), ' before a vowel, ν matches the next consonant).');
  return ['Prefix', options, shown, note, h('span', 'This verb is a preposition ', greek(key + '-'), ' joined to a simple verb. How is the preposition written here?')];
};
/** The Lengthening step of a vowel-initial verb. */
const lengthEntry = (d) => ['Front (lengthening)', lengthenOptions(d), d.aug.to, h('span', 'Rule: ', greek(d.aug.from + ' → ' + d.aug.to), '. The first vowel lengthens like this: ', greek('α → η, ε → η, ο → ω, αι → ῃ, οι → ῳ, αυ → ηυ'), '. A few verbs, such as ', greek('ἔχω'), ', have ', greek('ε → ει'), '.'),
      h('span', 'The stem begins with ', greek(d.aug.from), ', so there is no ', greek('ε-'), ' in front: the first vowel itself lengthens. What does it become?')];

/* ---------- the steps of one form, and the word after each ----------
   Each step is [title, options, right answer, note, prompt, apply]; `apply` turns the word so far into the word after the step, so the pieces combine where they belong:
   the stem first, the front before it (a lengthened vowel replaces the stem's own), a prefix before that, then the formative, vowel and ending after it. */
const ap = (e, f) => { const x = e.slice(); while (x.length < 5) x.push(null); x[5] = f; return x; };
const T_ = (d) => skel(d.word), sameWord = (a, b) => a === b || a + 'ν' === b || a === b + 'ν', tail = (d, c) => (c === '–' ? '' : skel(c).replace('(ν)', T_(d).endsWith('ν') ? 'ν' : ''));
const lengthApply = (d) => (s) => d.aug.to + (s.startsWith(d.aug.from) ? s.slice(d.aug.from.length) : s.slice(1));
const spellNote = (d, junction) => d.sound ? h('span', 'Spelling: ', d.sound.note, ' (', greek(d.S + ' + ' + junction + ' → ' + d.sound.joined), ').') : d.perfSound ? h('span', 'Spelling: ', d.perfSound.note, ' (', greek(d.S + ' + ' + d.perfSound.tail + ' → ' + d.perfSound.joined), ').') : null;
/** The Sound step, when the pieces laid side by side are not yet the word (a stop meets σ, ο + nothing is written ω, σα is written σε). */
const soundEntry = (d, N, note) => ap(['Sound change', writtenOptions(N, T_(d)), T_(d), note, h('span', 'Laid side by side the pieces read ', greek(final(N)), '. That is not how it is written. Which spelling is right?')], () => T_(d));
const runSteps = (seq) => seq.reduce((a, e) => (a.push(e[5](a[a.length - 1])), a), ['']);
/** { seq, parts, extra, sound } for an indicative form. */
export function indicSteps(d) {
  const c = chartPieces(d), seq = [], N = () => runSteps(seq).pop();
  seq.push(ap(['Stem', stemOptions(d), d.S, stemNote(d)], () => skel(d.S)));
  if (d.aug) seq.push(ap(lengthEntry(d), lengthApply(d)));
  else seq.push(ap(['Front', frontOptions(d), frontAnswer(d)], (s) => skel(d.A) + s));
  if (d.prefix) seq.push(ap(prefixEntry(d), (s) => skel(d.prefix.shown) + s));
  seq.push(ap(['Tense formative', formativeOptions(c), c.F], (s) => s + skel(c.F || '')));
  if (c.V) seq.push(ap(['Connecting vowel', vowelOptions(c), c.V], (s) => s + skel(c.V)));
  seq.push(ap(['Personal ending', endingOptions(d, c), c.PE], (s) => s + tail(d, c.PE)));
  const laid = N(), sound = !d.contract && !sameWord(laid, T_(d));
  if (sound) seq.push(soundEntry(d, laid, spellNote(d, d.F) || h('span', 'The pieces run together in the spelling: ', greek(final(c.naive) || '—'), ' is written ', greek(c.written), '.')));
  if (d.contract) seq.push(ap(contractEntry(d, ENDING_TABLE[ROW[d.row].ends][CELLS.indexOf(d.cell)][1]), () => T_(d)));
  const parts = d.contract ? [d.A || null, d.contract.head, '(' + d.contract.k + ' + ' + dispInit(d.contract.init) + ' → ' + d.contract.res + ')', d.contract.rest ? final(d.contract.rest) : null].filter(Boolean)
    : [d.A || null, d.S, c.F || null, c.V || null, c.PE === '–' ? null : c.PE].filter(Boolean);
  if (d.prefix) parts.unshift(d.prefix.shown);
  return { seq, parts, sound, extra: [
    d.aug ? h('p.muted.small', { style: { margin: 0 } }, 'The first vowel lengthens (', greek(d.aug.from + ' → ' + d.aug.to), '), so the word begins with ', greek(d.aug.to), '.', ROW[d.row].aug === 'RED' ? ' In the perfect this lengthening also does the work of the reduplication.' : '') : null,
    sound ? null : spellNote(d, d.F) ? h('p.muted.small', { style: { margin: 0 } }, spellNote(d, d.F)) : null,
    d.mi && d.F === 'κ' && /^aor1/.test(d.row) ? h('p.muted.small', { style: { margin: 0 } }, 'The chart’s 1st aorist has σα. These -μι verbs (δίδωμι, τίθημι) have a κ-aorist: ', greek('κα'), ' in its place.') : null] };
}
/** The same for a subjunctive, imperative, infinitive or participle (stem, [front], [prefix], formative, connecting vowel, ending). */
export function moodSteps(d) {
  const seq = [], N = () => runSteps(seq).pop();
  seq.push(ap(['Stem', moodStemOptions(d), d.S, stemNote(d)], () => skel(d.S)));
  if (d.mood === 'ptc') {
    if (d.aug) seq.push(ap(lengthEntry(d), lengthApply(d)));
    else if (/^perf/.test(d.key)) seq.push(ap(['Front', frontOptions(d), frontAnswer(d)], (s) => skel(d.A) + s));
  }
  if (d.prefix) seq.push(ap(prefixEntry(d), (s) => skel(d.prefix.shown) + s));
  if (d.mood === 'ptc') seq.push(ap(['Tense formative', ptcFormativeOptions(d), d.F], (s) => s + skel(d.F || '')), ap(['Ending', ptcEndingOptions(d), d.E, h('span', 'The ending is the participle marker ', greek('-' + d.kind.morph + '-'), ' and the case ending written together. The marker means: ', MORPHEME_MEANING[d.kind.morph], '.')], (s) => s + tail(d, d.E)));
  else if (d.mood !== 'inf') { seq.push(ap(['Tense formative', moodFormativeOptions(d), d.F], (s) => s + skel(d.F || ''))); if (d.V) seq.push(ap(['Connecting vowel', moodVowelOptions(d), d.V], (s) => s + skel(d.V))); seq.push(ap(['Personal ending', moodEndingOptions(d), d.E], (s) => s + tail(d, d.E))); }
  else seq.push(ap(['Ending', moodEndingOptions(d), d.E], (s) => s + tail(d, d.E)));
  const laid = N(), sound = !d.contract && !sameWord(laid, T_(d)), junction = (d.F + d.V + d.E)[0];
  if (sound) seq.push(soundEntry(d, laid, spellNote(d, junction)));
  if (d.contract) seq.push(ap(contractEntry(d, d.contract.ex), () => T_(d)));
  const parts = d.contract ? [d.contract.head, '(' + d.contract.k + ' + ' + d.contract.initShown + ' → ' + d.contract.res + ')', d.contract.rest ? final(d.contract.rest) : null].filter(Boolean) : d.mood === 'ptc' ? [d.A || null, d.S, d.F || null, d.E ? final(d.E) : null].filter(Boolean) : [d.S, d.F || null, d.V || null, d.E ? final(d.E) : null].filter(Boolean), subscript = !d.contract && /[\u0345]/.test(d.vowelWritten.normalize('NFD'));
  if (d.prefix) parts.unshift(d.prefix.shown);
  return { seq, parts, sound, extra: [
    d.aug ? h('p.muted.small', { style: { margin: 0 } }, 'The first vowel lengthens (', greek(d.aug.from + ' → ' + d.aug.to), '), so the word begins with ', greek(d.aug.to), '. In the perfect this lengthening also does the work of the reduplication.') : null,
    sound ? null : spellNote(d, junction) ? h('p.muted.small', { style: { margin: 0 } }, spellNote(d, junction)) : null,
    subscript ? h('p.muted.small', { style: { margin: 0 } }, 'The vowel ', greek(d.V), ' is written ', greek(d.vowelWritten), ', with an iota subscript, in this form.') : null] };
}

export function renderBuild(view, mode, forced = null) {          // `forced`: a ready queue of decomposed forms (for tests and screenshots)
  const any = mode === 'any', queue = forced || buildQueue(any), back = ['#/parse', 'Back to Parsing'];
  if (!queue.length) { clear(view).append(backHead('Build the form', '#/parse', 'Parsing'), h('div.card.stack', h('p', 'There are no forms to build yet' + (any ? '' : ' in verbs you know') + '. Forms open up as you learn the chart rows and the verbs. Verbs with contracted or irregular stems are left out.'), any ? null : h('a.btn', { href: '#/parse/run/build/any' }, 'Try with any verb'), ...backLinks(...back))); return; }
  const tally = [0, 0], missed = {}; let at = 0, strip = { states: [''], titles: [] };
  const done = () => clear(view).append(backHead('Build the form', '#/parse', 'Parsing'), h('div.card.stack', h('h2', 'Practice complete'), h('p.muted.small', 'Practice only: nothing here changes your review schedule.'),
    h('div.kpis', h('div.kpi', h('b', tally[0] + ' / ' + tally[1]), h('span', 'pieces right'))), Object.keys(missed).length ? h('p', 'You missed the ', h('b', Object.entries(missed).sort((a, b) => b[1] - a[1])[0][0].toLowerCase()), ' most often.') : h('p', 'You got every piece.'),
    h('div.row.wrap', h('button.btn.primary', { onclick: () => renderBuild(view, mode) }, 'Practice more'), ...backLinks(...back))));
  const frame = (d, body, upto, mark) => { const L = D.lexByN.get(d.n), r = d.mood ? null : ROW[d.row]; clear(view).append(backHead('Build the form', '#/parse', 'Parsing'), h('div.stack', h('div.card.stack',
    h('div.row.between', h('b', 'Build the form'), h('span.chip', (at + 1) + ' / ' + queue.length)),
    h('div.card.small', { style: { background: 'var(--accent-soft)', border: 'none' } }, h('b', (d.mood ? moodHeading(d).replace(/^./, (c) => c.toUpperCase()).replace('person ', '') : say(r.name).replace(/^./, (c) => c.toUpperCase()) + ' indicative, ' + CELL_NAME[d.cell].replace('person ', ''))), h('div', { style: { color: 'var(--ink-2)' } }, 'of ', greek(L.head), ' · ', L.brief)),
    wordStrip(strip, upto, mark), ...body))); };
  const chartLine = (d) => d.mood === 'ptc' ? h('div', h('p.muted.small', { style: { margin: '.6rem 0 .2rem' } }, 'From the paradigm (' + d.kind.name.toLowerCase() + ' participle of ' + d.kind.verb + ', ' + CASE_N[d.case] + ' ' + NUM_N[d.number] + '):'), h('p', { lang: 'grc', style: { margin: 0, fontFamily: 'var(--greek)', fontSize: '1.1rem' } }, d.kind.forms[(d.number === 'P' ? 4 : 0) + Math.max(0, 'NGDA'.indexOf(d.case))].join(', '))) : d.mood ? h('div', h('p.muted.small', { style: { margin: '.6rem 0 .2rem' } }, 'From the paradigm:'), h('p', { lang: 'grc', style: { margin: 0, fontFamily: 'var(--greek)', fontSize: '1.1rem' } }, d.kind.forms ? d.kind.forms.join(', ') : d.kind.model + ' (' + d.kind.gloss + ')')) : h('div', h('p.muted.small', { style: { margin: '.6rem 0 .2rem' } }, 'From the master verb chart:'), masterRowTable(d.row));
  const choose = (d, i, title, options, right, onRight, note = null, prompt = null) => {
    const box = h('div.opts.two'); let locked = false;
    for (const [v, label] of options) { const b = h('button.opt', { onclick: () => { if (locked) return; locked = true; const ok = v === right; tally[1]++; if (ok) tally[0]++; else missed[title] = (missed[title] || 0) + 1; b.classList.add(ok ? 'right' : 'wrong'); if (!ok) [...box.children].find((x) => x.dataset.v === String(right))?.classList.add('right'); if (note) { box.after(h('div.card.small.stack', { style: { background: 'var(--accent-soft)', border: 'none' } }, note, h('div', h('button.btn.primary.sm', { onclick: onRight }, 'Continue')))); } else setTimeout(onRight, ok ? 450 : 1300); } }, greek(label)); b.dataset.v = String(v); box.append(b); }
    return [h('p', h('b', title)), prompt ? h('p.muted.small', { style: { margin: 0 } }, prompt) : null, box];
  };
  const walk = (d, seq, parts, extra) => {
    strip = { states: seq.reduce((a, e) => (a.push(e[5](a[a.length - 1])), a), ['']), titles: seq.map((e) => e[0]) };
    const step = (i) => {
      if (i < seq.length) { const [title, opts, right, note, prompt] = seq[i]; frame(d, choose(d, i, title, opts, right, () => step(i + 1), note, prompt), i, i); return; }
      frame(d, [h('div', { lang: 'grc', style: { fontFamily: 'var(--greek)', fontSize: '2.2rem', textAlign: 'center', margin: '.2rem 0' } }, isolated(d.word)),
        h('div.card.small', { style: { background: 'var(--good-soft)', border: 'none' } }, h('b', 'Built: '), greek(parts.join(' + ')), '. ', h('span.muted.small', 'Accents are not part of this exercise.')),
        ...extra,
        h('button.btn.primary', { onclick: () => { at++; at < queue.length ? show() : done(); } }, 'Next'), chartLine(d)], seq.length, -1);
    };
    step(0);
  };
  const show = () => { const d = queue[at], { seq, parts, extra } = d.mood ? moodSteps(d) : indicSteps(d); walk(d, seq, parts, extra); };
  show();
}
