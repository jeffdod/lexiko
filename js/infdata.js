// Infinitives: the ten kinds in the grammar chart, with the ending to remember, a model form and its meaning, and a way to split
// a real infinitive from the text into stem · ending. Middle and passive share an ending in the present and the perfect.
import { skel, chars, unmerge, AOR1 } from './ptcdata.js';

const k = (key, name, fam, ending, model, gloss) => ({ key, name, fam, ending, model, gloss });
export const INF = [
  k('pres-act', 'Present active', 'Present', 'ειν', 'λύειν', 'to loose'),
  k('pres-mp', 'Present middle/passive', 'Present', 'εσθαι', 'λύεσθαι', 'to loose, or to be loosed'),
  k('aor1-act', '1st aorist active', 'First aorist', 'σαι', 'λῦσαι', 'to loose'),
  k('aor1-mid', '1st aorist middle', 'First aorist', 'σασθαι', 'λύσασθαι', 'to loose'),
  k('aor1-pas', '1st aorist passive', 'First aorist', 'θηναι', 'λυθῆναι', 'to be loosed'),
  k('aor2-act', '2nd aorist active', 'Second aorist', 'ειν', 'λαβεῖν', 'to receive'),
  k('aor2-mid', '2nd aorist middle', 'Second aorist', 'εσθαι', 'γενέσθαι', 'to become'),
  k('aor2-pas', '2nd aorist passive', 'Second aorist', 'ηναι', 'γραφῆναι', 'to be written'),
  k('perf-act', 'Perfect active', 'Perfect', 'κεναι', 'λελυκέναι', 'to have loosed'),
  k('perf-mp', 'Perfect middle/passive', 'Perfect', 'σθαι', 'λελύσθαι', 'to have been loosed'),
];
export const INFB = new Map(INF.map((r) => [r.key, r]));
/** Kinds that look the same apart from the stem. */
export const INF_LOOKALIKE = { 'pres-act': 'aor2-act', 'aor2-act': 'pres-act', 'pres-mp': 'aor2-mid', 'aor2-mid': 'pres-mp' };
/** The two kinds whose middle and passive are one form. */
export const INF_MP = new Set(['pres-mp', 'perf-mp']);

/** The chart row an infinitive belongs to, from the voice and tense of its RP tag (null for futures). */
export function infKey(sl) {
  if (!sl || sl.mood !== 'N') return null;
  const act = 'AQ'.includes(sl.voice), pas = 'PO'.includes(sl.voice), sec = !!sl.second;
  if (sl.tense === 'P') return act ? 'pres-act' : 'pres-mp';
  if (sl.tense === 'A') return 'aor' + (pas ? (sec ? '2-pas' : '1-pas') : act ? (sec ? '2-act' : '1-act') : (sec ? '2-mid' : '1-mid'));
  if (sl.tense === 'R') return act ? 'perf-act' : 'perf-mp';
  return null;
}

/** Split a written infinitive of a kind into { stem, ending }; null when it doesn't end as the kind does ("to be", -μι verbs, ...). Liquid and ψ/ξ 1st aorists are understood too. */
export function splitInf(word, key, opts = {}) {
  const r = INFB.get(key); if (!r) return null;
  const cs = chars(word), s0 = cs.map(skel).join('');
  const one = (s, ending, extra) => {
    if (!s.endsWith(ending) || s.length - ending.length < 1) return null;
    const n = cs.length - ending.length;
    return { stem: cs.slice(0, n).join(''), ending: cs.slice(n).join(''), stemSkel: s.slice(0, n), ...extra };
  };
  const plain = one(s0, r.ending, {}); if (plain) return plain;
  if (!AOR1.has(key)) return null;
  const um = unmerge(s0), merged = um && one(um, r.ending, { merged: true }); if (merged) return merged;
  const lq = opts.liquid ? one(s0, r.ending.replace('σ', ''), { liquid: true }) : null;
  return lq && /[λμνρ]$/.test(lq.stemSkel) ? lq : null;
}
