// Which gate a verb form belongs to. A gate is one kind of verb form that daily parsing can ask about: a row of the master verb chart
// (indicative), or one tense-and-voice kind of participle, infinitive, subjunctive or imperative. Data only: no storage, no DOM.
import { decode } from './morph.js';
import { rowOfTag, ROW_LEVEL } from './families.js';
import { PTC } from './ptcdata.js';
import { INF, infKey } from './infdata.js';
import { SUB, subKey } from './subdata.js';
import { IMP, impKey } from './impdata.js';

/** The tense-and-voice kind of a participle (null for a future participle, which the charts do not cover). */
export function ptcKey(sl) {
  if (!sl || sl.mood !== 'P') return null;
  const act = 'AQ'.includes(sl.voice), pas = 'PO'.includes(sl.voice), sec = !!sl.second;
  return sl.tense === 'P' ? (act ? 'pres-act' : 'pres-mp')
    : sl.tense === 'A' ? 'aor' + (pas ? (sec ? '2-pas' : '1-pas') : act ? (sec ? '2-act' : '1-act') : (sec ? '2-mid' : '1-mid'))
    : sl.tense === 'R' ? (act ? 'perf-act' : 'perf-mp') : null;
}
/** The gate key of one parse: 'row:aor1-act', 'ptc:pres-act', 'inf:…', 'sub:…', 'imp:…', or 'rare' (optative, future participles and infinitives, pluperfect). */
export function gateKey(slots, code, n) {
  if (!slots) return 'rare';
  switch (slots.mood) {
    case 'I': { const r = rowOfTag(code, n); return r ? 'row:' + r : 'rare'; }
    case 'P': { const k = ptcKey(slots); return k ? 'ptc:' + k : 'rare'; }
    case 'N': { const k = infKey(slots); return k ? 'inf:' + k : 'rare'; }
    case 'S': { const k = subKey(slots); return k ? 'sub:' + k : 'rare'; }
    case 'M': { const k = impKey(slots); return k ? 'imp:' + k : 'rare'; }
    default: return 'rare';
  }
}
const keyCache = new Map();
export const gateKeyOfTag = (tag, n) => { const ck = tag + '|' + n; let k = keyCache.get(ck); if (k === undefined) { const d = decode(tag); k = d ? gateKey(d.slots, tag, n) : 'rare'; keyCache.set(ck, k); } return k; };

/** The four families that have kinds, with the path of each one's drill. */
export const FAMILIES = [
  { id: 'ptc', name: 'Participles', kinds: PTC, path: 'participles', study: '#/learn/charts/participles' },
  { id: 'inf', name: 'Infinitives', kinds: INF, path: 'infinitives', study: '#/learn/charts/infinitives' },
  { id: 'sub', name: 'Subjunctive', kinds: SUB, path: 'subjunctive', study: '#/learn/charts/subjunctive' },
  { id: 'imp', name: 'Imperative', kinds: IMP, path: 'imperative', study: '#/learn/charts/imperative' },
];
export const FAMILY = Object.fromEntries(FAMILIES.map((f) => [f.id, f]));
export const kindName = (fam, key) => { const r = FAMILY[fam].kinds.find((k) => k.key === key); return r ? r.name : key; };
/** The indicative rows of the master chart (the rest of the chart besides present active). */
export const ROW_KEYS = Object.keys(ROW_LEVEL);
export const allGateKeys = () => [...ROW_KEYS.map((r) => 'row:' + r), ...FAMILIES.flatMap((f) => f.kinds.map((k) => f.id + ':' + k.key))];
