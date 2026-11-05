// Subjunctive: the eight kinds (present, 1st and 2nd aorist; the perfect is rare), a paradigm for each, and a way to split a real
// subjunctive from the text into stem · formative · connecting vowel · ending.
import { skel, chars, AOR1 } from './ptcdata.js';

const ACT = ['ωσιν', 'ωσι', 'ωμεν', 'ητε', 'ησ', 'ω', 'η'];            // connecting vowel + ending, longest first
const MID = ['ωμεθα', 'ησθε', 'ωνται', 'ωμαι', 'ηται', 'η'];
const k = (key, name, fam, verb, forms, formative, set, desc) => ({ key, name, fam, verb, forms, formative, set, desc });
export const SUB = [
  k('pres-act', 'Present active', 'Present', 'λύω', ['λύω', 'λύῃς', 'λύῃ', 'λύωμεν', 'λύητε', 'λύωσι(ν)'], '', ACT, 'No formative: the long vowel comes straight after the present stem.'),
  k('pres-mp', 'Present middle/passive', 'Present', 'λύω', ['λύωμαι', 'λύῃ', 'λύηται', 'λυώμεθα', 'λύησθε', 'λύωνται'], '', MID, 'No formative: the long vowel comes straight after the present stem, then the middle/passive endings.'),
  k('aor1-act', '1st aorist active', 'First aorist', 'λύω', ['λύσω', 'λύσῃς', 'λύσῃ', 'λύσωμεν', 'λύσητε', 'λύσωσι(ν)'], 'σ', ACT, 'The formative σ marks the 1st aorist, then the long vowel and the active endings.'),
  k('aor1-mid', '1st aorist middle', 'First aorist', 'λύω', ['λύσωμαι', 'λύσῃ', 'λύσηται', 'λυσώμεθα', 'λύσησθε', 'λύσωνται'], 'σ', MID, 'The formative σ marks the 1st aorist, then the long vowel and the middle endings.'),
  k('aor1-pas', '1st aorist passive', 'First aorist', 'λύω', ['λυθῶ', 'λυθῇς', 'λυθῇ', 'λυθῶμεν', 'λυθῆτε', 'λυθῶσι(ν)'], 'θ', ACT, 'The formative θ marks the passive, then the long vowel and the active endings.'),
  k('aor2-act', '2nd aorist active', 'Second aorist', 'βάλλω', ['βάλω', 'βάλῃς', 'βάλῃ', 'βάλωμεν', 'βάλητε', 'βάλωσι(ν)'], '', ACT, 'No formative: the long vowel follows the 2nd aorist stem.'),
  k('aor2-mid', '2nd aorist middle', 'Second aorist', 'γίνομαι', ['γένωμαι', 'γένῃ', 'γένηται', 'γενώμεθα', 'γένησθε', 'γένωνται'], '', MID, 'No formative: the long vowel follows the 2nd aorist stem, then the middle endings.'),
  k('aor2-pas', '2nd aorist passive', 'Second aorist', 'γράφω', ['γραφῶ', 'γραφῇς', 'γραφῇ', 'γραφῶμεν', 'γραφῆτε', 'γραφῶσι(ν)'], '', ACT, 'No θ: the long vowel follows the passive stem, then the active endings.'),
];
export const SUBB = new Map(SUB.map((r) => [r.key, r]));
/** Kinds that look the same apart from the stem. */
export const SUB_LOOKALIKE = { 'pres-act': 'aor2-act', 'aor2-act': 'pres-act', 'pres-mp': 'aor2-mid', 'aor2-mid': 'pres-mp' };
export const SUB_MP = new Set(['pres-mp']);

/** The kind a subjunctive belongs to, from the voice and tense of its RP tag (null for the rare perfect). */
export function subKey(sl) {
  if (!sl || sl.mood !== 'S') return null;
  const act = 'AQ'.includes(sl.voice), pas = 'PO'.includes(sl.voice), sec = !!sl.second;
  if (sl.tense === 'P') return act ? 'pres-act' : 'pres-mp';
  if (sl.tense === 'A') return 'aor' + (pas ? (sec ? '2-pas' : '1-pas') : act ? (sec ? '2-act' : '1-act') : (sec ? '2-mid' : '1-mid'));
  return null;
}

/** Split a written subjunctive of a kind into { stem, formative, vowel, ending }; null when it doesn't have the plain shape (-μι verbs, ...). Liquid and ψ/ξ 1st aorists are understood too. */
export function splitSub(word, key, opts = {}) {
  const r = SUBB.get(key); if (!r) return null;
  const cs = chars(word), s = cs.map(skel).join('');
  const end = r.set.find((e) => s.endsWith(e)); if (!end) return null;
  let n = cs.length - end.length;
  const f = r.formative, i = cs.length - end.length;
  let merged = false, liquid = false;
  if (f) {
    if (n >= 2 && s[n - 1] === f && !(f === 'θ' && /[φχ]/.test(s[n - 2]))) n -= 1;
    else if (AOR1.has(key) && n >= 2 && /[ψξ]/.test(s[n - 1])) { n -= 1; merged = true; }
    else if (AOR1.has(key) && opts.liquid && n >= 1 && /[λμνρ]/.test(s[n - 1])) { liquid = true; }
    else return null;
  }
  if (n < 1) return null;
  return { stem: cs.slice(0, n).join(''), formative: f && !liquid ? cs[n] : '', vowel: cs[i], ending: cs.slice(i + 1).join(''), stemSkel: s.slice(0, n), ...(merged ? { merged } : {}), ...(liquid ? { liquid } : {}) };
}
