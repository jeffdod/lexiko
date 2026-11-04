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
export const levelName = (l) => (l <= 3 ? FIXED[l - 1] : KEY_NAME[laterOrder()[l - 4]] || 'Other forms');

/** The master verb chart: its rows, the five things each row teaches, and the verb-form level each row belongs to. */
export const CHART_ATTRS = ['aug', 'stem', 'form', 'vowel', 'ends'];
export const ROW_LEVEL = {
  'pres-act': 1, 'impf-act': 1, 'fut-act': 1, 'fut-liq-act': 1, 'fut-mid': 1, 'fut-liq-mid': 1, 'aor1-act': 1, 'aor-liq-act': 1, 'aor2-act': 1, 'aor1-mid': 1, 'aor2-mid': 1,
  'pres-mp': 2, 'impf-mp': 2, 'fut-pas1': 2, 'fut-pas2': 2, 'aor1-pas': 2, 'aor2-pas': 2,
  'perf1-act': 3, 'perf2-act': 3, 'perf-mp': 3,
};
