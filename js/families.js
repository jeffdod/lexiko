// Verb-form levels: which kinds of verb form are open in Parsing yet. Counted from the Greek text's own RP tags.
// Levels 1-3 are the indicative (active and middle, then passive, then perfect). The rest are ordered by how often
// they occur in the text: infinitives, participles, subjunctive, imperative and optative.
import { D } from './data.js';

const TAG = /^V-([12]?)([PIFARL])([AMPEDONQX]?)([IMSONP])/;
export const NLEVELS = 7;
const KEY_NAME = { N: 'Infinitives', P: 'Participles', S: 'Subjunctive', MO: 'Imperative and optative' };
let later = null;
/** The four later families, most frequent in the text first. */
export function laterOrder() {
  if (later) return later;
  const c = { N: 0, P: 0, S: 0, MO: 0 };
  for (const f of D.forms) { const a = f.an[0]; const m = a && TAG.exec(a.m || ''); if (!m) continue; const k = m[4] === 'M' || m[4] === 'O' ? 'MO' : m[4]; if (k in c) c[k] += f.count; }
  return (later = Object.keys(c).sort((a, b) => c[b] - c[a]));
}
/** The level (1..7) a verb form belongs to, from its RP morphology tag. */
export function levelOfTag(tag) {
  const m = TAG.exec(tag || ''); if (!m) return 1;
  const tense = m[2], voice = m[3], mood = m[4];
  if (mood !== 'I') { const i = laterOrder().indexOf(mood === 'M' || mood === 'O' ? 'MO' : mood); return i < 0 ? 1 : 4 + i; }
  if (tense === 'R' || tense === 'L') return 3;
  return voice && 'PEO'.includes(voice) ? 2 : 1;
}
const FIXED = ['Indicative: active and middle', 'Indicative: passive', 'Indicative: perfect'];
/** Verbs whose stem ends in λ, μ, ν or ρ: their future and aorist have rows of their own on the master chart. */
export const isLiquidVerb = (n) => { const L = D.lexByN.get(n); return !!L && /[λμνρ]ω$/.test(L.head.normalize('NFD').replace(/[\u0300-\u036f]/g, '')); };
const LIQ_ROW = { 'fut-act': 'fut-liq-act', 'fut-mid': 'fut-liq-mid', 'aor1-act': 'aor-liq-act' };
/** The master-chart row an indicative verb form belongs to, from its RP tag (null for the other moods). With the verb's number, a liquid verb gets the liquid row where the chart has one. */
export function rowOfTag(tag, n) {
  const m = TAG.exec(tag || ''); if (!m || m[4] !== 'I') return null;
  const sec = m[1] === '2', act = 'AQ'.includes(m[3]), pas = 'PO'.includes(m[3]);
  const row = { P: act ? 'pres-act' : 'pres-mp', I: act ? 'impf-act' : 'impf-mp',
    F: pas ? (sec ? 'fut-pas2' : 'fut-pas1') : act ? 'fut-act' : 'fut-mid',
    A: pas ? (sec ? 'aor2-pas' : 'aor1-pas') : act ? (sec ? 'aor2-act' : 'aor1-act') : (sec ? 'aor2-mid' : 'aor1-mid'),
    R: act ? (sec ? 'perf2-act' : 'perf1-act') : 'perf-mp' }[m[2]] || null;
  return row && n != null && isLiquidVerb(n) && LIQ_ROW[row] ? LIQ_ROW[row] : row;
}
export const levelName = (l) => (l <= 3 ? FIXED[l - 1] : KEY_NAME[laterOrder()[l - 4]] || 'Other forms');

/** The master verb chart: its rows, the five things each row teaches, and the verb-form level each row belongs to. */
export const CHART_ATTRS = ['aug', 'stem', 'form', 'vowel', 'ends'];
export const ROW_LEVEL = {
  'pres-act': 1, 'impf-act': 1, 'fut-act': 1, 'fut-liq-act': 1, 'fut-mid': 1, 'fut-liq-mid': 1, 'aor1-act': 1, 'aor-liq-act': 1, 'aor2-act': 1, 'aor1-mid': 1, 'aor2-mid': 1,
  'pres-mp': 2, 'impf-mp': 2, 'fut-pas1': 2, 'fut-pas2': 2, 'aor1-pas': 2, 'aor2-pas': 2,
  'perf1-act': 3, 'perf2-act': 3, 'perf-mp': 3,
};
