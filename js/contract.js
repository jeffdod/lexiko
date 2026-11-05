// Contract verbs (-έω, -άω, -όω): in the present system the stem vowel merges with the vowel after it. The quizzes work out the
// uncontracted form from the dictionary form, find the merge, and show stem · contracted vowel · ending. Practice only; nothing here is scheduled.
import { skel, chars } from './ptcdata.js';

/** 'ε', 'α' or 'ο' for a contract verb's dictionary form, else null. */
export const contractType = (head) => { const m = /(ε|α|ο)(ω|ομαι)$/.exec(skel(head)); return m ? m[1] : null; };
const contractStem = (head) => skel(head).replace(/(ε|α|ο)(ω|ομαι)$/, '');
/** What a stem vowel and the vowel after it become (skeletons: iota subscripts are not told apart, so ο+η gives ω or οι). */
const MERGE = {
  ε: { ε: ['ει'], ει: ['ει'], η: ['η'], ο: ['ου'], ου: ['ου'], ω: ['ω'], οι: ['οι'] },
  α: { ε: ['α'], ει: ['α'], η: ['α'], ο: ['ω'], ου: ['ω'], ω: ['ω'], οι: ['ω'] },
  ο: { ε: ['ου'], ει: ['οι'], η: ['ω', 'οι'], ο: ['ου'], ου: ['ου'], ω: ['ω'], οι: ['οι'] },
};
const ETA_VERBS = new Set(['ζ', 'πειν', 'διψ', 'χρ']);        // ζῆν, πεινῆν, διψῆν, χρῆσθαι: α + ε gives η
const LEAD = /^[ουωαεηι]+/;
/** Match a word against a kind's uncontracted pieces [lead vowel(s), rest, extra]; returns the split, or null. */
export function contractSplit(word, head, pairs) {
  const t = contractType(head); if (!t) return null;
  const ps = contractStem(head), cs = chars(word), s = cs.map(skel).join('');
  if (!ps || !s.startsWith(ps)) return null;
  const rem = s.slice(ps.length);
  for (const [lead, rest, extra] of pairs) {
    const results = (MERGE[t][lead] || []).concat(t === 'α' && lead === 'ε' && ETA_VERBS.has(ps) ? ['η'] : []);
    for (const c of results) for (const r of rest.endsWith('σιν') ? [rest, rest.slice(0, -1)] : [rest]) {
      if (rem === c + r) {
        const a = ps.length, b = a + c.length;
        return { stem: cs.slice(0, a).join(''), vowel: cs.slice(a, b).join(''), ending: cs.slice(b).join(''), stemSkel: ps, contract: { type: t, lead, result: c, plain: ps + t + lead + r }, extra };
      }
    }
  }
  return null;
}
/** The pieces of the uncontracted endings of a kind, as [lead, rest, extra] — built from the kinds' own data. */
export function pairsFrom(strings, extraOf) {
  const out = [];
  for (const [i, t] of strings.entries()) { const m = LEAD.exec(t); if (m) out.push([m[0], t.slice(m[0].length), extraOf ? extraOf(i, t) : undefined]); }
  return out;
}
/** The note for the feedback: how the uncontracted form merges. */
export function contractNote(sp, head) {
  const c = sp.contract, label = { ε: '-έω', α: '-άω', ο: '-όω' }[c.type];
  return head + ' is an ' + label + ' verb, so the uncontracted form is ' + c.plain + ' (without accents), and ' + c.type + ' + ' + c.lead + ' contract to ' + c.result + '.';
}
