// "Which verb is this?": the right verb and three look-alikes, all real headwords from the lexicon.
import { D } from './data.js';
import { shuffle } from './util.js';

const skel = (s) => s.normalize('NFD').replace(/[̀-ͯͅ­]/g, '').toLowerCase().replace(/ς/g, 'σ');
const commonLen = (a, b) => { let i = 0; while (i < a.length && i < b.length && a[i] === b[i]) i++; return i; };
let pool = null;
const verbs = () => pool || (pool = D.lex.filter((L) => L.verb && !L.senses && L.freq >= 3).map((L) => ({ L, k: skel(L.head) })));

/** Four lexicon entries for a verb question: the verb itself and three that look like it (same opening letters or ending), leaning to verbs you might really meet. */
export function verbChoices(n) {
  const right = D.lexByN.get(n), k = skel(right.head);
  const scored = verbs().filter((v) => v.L.n !== n && v.k !== k)
    .map((v) => ({ L: v.L, sc: commonLen(v.k, k) * 2 + (v.k.slice(-3) === k.slice(-3) ? 2 : 0) + Math.min(2, Math.log10(v.L.freq + 1) / 1.5) + Math.random() * 2 }))
    .sort((a, b) => b.sc - a.sc).slice(0, 12).map((x) => x.L);
  return shuffle([right, ...shuffle(scored).slice(0, 3)]);
}
