// Imperative: the eight kinds (present, 1st and 2nd aorist; the perfect is very rare), a paradigm for each, and a way to split a real
// imperative from the text into stem · formative or vowel · ending. Three of the four forms share endings in every tense; the 2nd singular is learned per tense.
import { skel, chars, unmerge, AOR1 } from './ptcdata.js';

// inner = what comes between the stem and the shared ending; kind = 'formative' or 'vowel'; s2 = the 2nd singular's own ending (or the bare vowel ε)
const k = (key, name, fam, verb, forms, mid, inner, kind, s2, s2vowel, desc) => ({ key, name, fam, verb, forms, mid, inner, kind, s2, s2vowel, desc });
export const IMP = [
  k('pres-act', 'Present active', 'Present', 'λύω', ['λῦε', 'λυέτω', 'λύετε', 'λυέτωσαν'], false, 'ε', 'vowel', 'ε', true, 'The stem and the connecting vowel ε; the 2nd singular is just that, with no ending.'),
  k('pres-mp', 'Present middle/passive', 'Present', 'λύω', ['λύου', 'λυέσθω', 'λύεσθε', 'λυέσθωσαν'], true, 'ε', 'vowel', 'ου', false, 'The stem and the connecting vowel ε, then the middle/passive endings.'),
  k('aor1-act', '1st aorist active', 'First aorist', 'λύω', ['λῦσον', 'λυσάτω', 'λύσατε', 'λυσάτωσαν'], false, 'σα', 'formative', 'σον', false, 'The formative σα marks the 1st aorist, then the active endings.'),
  k('aor1-mid', '1st aorist middle', 'First aorist', 'λύω', ['λῦσαι', 'λυσάσθω', 'λύσασθε', 'λυσάσθωσαν'], true, 'σα', 'formative', 'σαι', false, 'The formative σα marks the 1st aorist, then the middle endings.'),
  k('aor1-pas', '1st aorist passive', 'First aorist', 'λύω', ['λύθητι', 'λυθήτω', 'λύθητε', 'λυθήτωσαν'], false, 'θη', 'formative', 'θητι', false, 'The formative θη marks the passive, then the active endings.'),
  k('aor2-act', '2nd aorist active', 'Second aorist', 'λαμβάνω', ['λάβε', 'λαβέτω', 'λάβετε', 'λαβέτωσαν'], false, 'ε', 'vowel', 'ε', true, 'The 2nd aorist stem and the connecting vowel ε; the 2nd singular is just that, with no ending.'),
  k('aor2-mid', '2nd aorist middle', 'Second aorist', 'γίνομαι', ['γενοῦ', 'γενέσθω', 'γένεσθε', 'γενέσθωσαν'], true, 'ε', 'vowel', 'ου', false, 'The 2nd aorist stem and the connecting vowel ε, then the middle endings.'),
  k('aor2-pas', '2nd aorist passive', 'Second aorist', 'γράφω', ['γράφηθι', 'γραφήτω', 'γράφητε', 'γραφήτωσαν'], false, 'η', 'formative', 'ηθι', false, 'The formative η marks the passive (no θ), then the active endings.'),
];
export const IMPB = new Map(IMP.map((r) => [r.key, r]));
export const PERSONS = ['2nd person singular', '3rd person singular', '2nd person plural', '3rd person plural'];
export const IMP_LOOKALIKE = { 'pres-act': 'aor2-act', 'aor2-act': 'pres-act', 'pres-mp': 'aor2-mid', 'aor2-mid': 'pres-mp' };
export const IMP_MP = new Set(['pres-mp']);
const PERSON_OF = { τωσαν: 3, τω: 1, τε: 2, σθωσαν: 3, σθω: 1, σθε: 2 };

/** The kind an imperative belongs to, from the voice and tense of its RP tag (null for the very rare perfect). */
export function impKey(sl) {
  if (!sl || sl.mood !== 'M') return null;
  const act = 'AQ'.includes(sl.voice), pas = 'PO'.includes(sl.voice), sec = !!sl.second;
  if (sl.tense === 'P') return act ? 'pres-act' : 'pres-mp';
  if (sl.tense === 'A') return 'aor' + (pas ? (sec ? '2-pas' : '1-pas') : act ? (sec ? '2-act' : '1-act') : (sec ? '2-mid' : '1-mid'));
  return null;
}

/** Split a written imperative of a kind into { stem, formative, vowel, ending, person }; null when it doesn't have the plain shape. Liquid and ψ/ξ 1st aorists are understood too. */
export function splitImp(word, key, opts = {}) {
  const r0 = IMPB.get(key); if (!r0) return null;
  const cs = chars(word), s0 = cs.map(skel).join(''), n = cs.length;
  const one = (s, r, extra) => {
    for (const e of r.mid ? ['σθωσαν', 'σθω', 'σθε'] : ['τωσαν', 'τω', 'τε']) {
      const tail = r.inner + e;
      if (s.endsWith(tail) && n - tail.length >= 1) {
        const a = n - tail.length, b = a + r.inner.length;
        return { stem: cs.slice(0, a).join(''), formative: r.kind === 'formative' ? cs.slice(a, b).join('') : '', vowel: r.kind === 'vowel' ? cs.slice(a, b).join('') : '', ending: cs.slice(b).join(''), person: PERSON_OF[e], stemSkel: s.slice(0, a), ...extra };
      }
    }
    if (s.endsWith(r.s2) && n - r.s2.length >= 1) {                                    // the 2nd singular
      const a = n - r.s2.length;
      return { stem: cs.slice(0, a).join(''), formative: '', vowel: r.s2vowel ? cs.slice(a).join('') : '', ending: r.s2vowel ? '' : cs.slice(a).join(''), person: 0, stemSkel: s.slice(0, a), ...extra };
    }
    return null;
  };
  const plain = one(s0, r0, {}); if (plain) return plain;
  if (!AOR1.has(key)) return null;
  const um = unmerge(s0), merged = um && one(um, r0, { merged: true }); if (merged) return merged;
  const lq = opts.liquid ? one(s0, { ...r0, inner: 'α', s2: r0.mid ? 'αι' : 'ον' }, { liquid: true }) : null;
  return lq && /[λμνρ]$/.test(lq.stemSkel) ? lq : null;
}
