// Compound verbs (preposition + a simple verb): which lexicon verbs really are one, and the written forms of their prefix.
// A lemma is split only when what is left is a verb of its own: a lexicon verb, or one that several different prepositions share (βαίνω is not in the text
// alone, but ἀναβαίνω, καταβαίνω and μεταβαίνω all have it). So ἐγείρω, καθαρίζω and ἐγγίζω, which only begin like compounds, are never split.
import { D } from './data.js';
import { PREPS } from './cluehunt.js';

const sk = (s) => s.replace(/­/g, '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/ς/g, 'σ');
const KEYS = Object.keys(PREPS).sort((a, b) => b.length - a.length);
const isVerb = (h) => /(ω|ομαι|μι)$/.test(h);
let INFO = null;

const EXTRA = ['κυνεω', 'κτεινω', 'οιγω'];                // genuine simple verbs that are not in the text alone
const BAD_START = /^(γγ|γκ|γχ|γξ)/;                          // not a Greek word beginning: παραγγέλλω is παρ + ἀγγέλλω
function build() {
  INFO = new Map();
  const heads = new Set(EXTRA), cands = new Map(), byRest = new Map(), numOf = new Map();
  for (const [n, L] of D.lexByN) if (L.pos === 'V') { heads.add(sk(L.head)); numOf.set(sk(L.head), n); }
  for (const [n, L] of D.lexByN) {
    const h = sk(L.head); if (L.pos !== 'V' || !isVerb(h)) continue;
    const list = [];
    for (const key of KEYS) for (const v of [...PREPS[key]].sort((a, b) => b.length - a.length)) if (h.startsWith(v) && h.length - v.length >= 3 && !BAD_START.test(h.slice(v.length))) list.push({ key, v, rest: h.slice(v.length) });
    cands.set(n, list);
    for (const c of list) { if (!byRest.has(c.rest)) byRest.set(c.rest, new Set()); byRest.get(c.rest).add(c.key); }
  }
  for (const [n, list] of cands) {
    const pick = list.find((c) => isVerb(c.rest) && heads.has(c.rest)) || list.find((c) => isVerb(c.rest) && byRest.get(c.rest).size >= 2);
    if (pick) INFO.set(n, { key: pick.key, base: pick.v, rest: pick.rest, stem: pick.rest.replace(/(ω|ομαι)$/, ''), variants: [...PREPS[pick.key]].sort((a, b) => b.length - a.length) });
  }
  for (const [n, i] of [...INFO]) { const rn = numOf.get(i.rest); if (rn != null && INFO.has(rn)) INFO.delete(n); }      // double prefixes (ἐξαποστέλλω) are left out
}
/** { key, base, rest, stem, variants } for a verified compound verb, else null. `stem` is the simple verb's present stem. */
export function compoundOf(n) { if (!INFO) build(); return INFO.get(n) || null; }
