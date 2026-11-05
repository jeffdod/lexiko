// Verbs in -μι: four classes by the vowel their root ends in (δίδωμι *δο, τίθημι *θε, ἵστημι *στα, δείκνυμι *δεικνυ, plus ἀφίημι *ἑ).
// Authored forms for the reference page (written out as in a grammar, not taken from the text), and a splitter for the infinitives and
// participles in the text: prefix · reduplication · root · ending.
import { skel, chars, tailsOf, PTCB } from './ptcdata.js';

export const MI_CLASSES = [
  { key: 'o', verb: 'δίδωμι', suffix: 'διδωμι', redup: 'δι', short: 'δο', long: 'δου', aorInf: 'δου', root: '*δο', cls: 'o-class' },
  { key: 'e', verb: 'τίθημι', suffix: 'τιθημι', redup: 'τι', short: 'θε', long: 'θει', aorInf: 'θει', root: '*θε', cls: 'ε-class' },
  { key: 'a', verb: 'ἵστημι', suffix: 'ιστημι', redup: 'ι', short: 'στα', long: 'στα', aorInf: 'στη', root: '*στα', cls: 'α-class' },
  { key: 'ie', verb: 'ἀφίημι', suffix: 'ιημι', redup: 'ι', short: 'ε', long: 'ει', aorInf: 'ει', root: '*ἑ', cls: 'ε-class' },
  { key: 'u', verb: 'δείκνυμι', suffix: 'δεικνυμι', redup: '', short: 'δεικνυ', long: 'δεικνυ', aorInf: null, root: '*δεικνυ', cls: 'υ-class' },
];
const classOf = (head) => { const h = skel(head); return MI_CLASSES.find((c) => h.endsWith(c.suffix)) || null; };
export const miClass = classOf;

// endings after the root, as skeletons, taken from the thematic participle tails (the -μι participles take the same endings on the root)
let sets = null;
function endingSets() {
  if (sets) return sets;
  const act = tailsOf(PTCB.get('aor2-act')), mp = tailsOf(PTCB.get('pres-mp'));
  return (sets = {
    shortAct: act.filter((t) => t.startsWith('ον')).map((t) => t.slice(1)),
    longAct: [...act.filter((t) => t.startsWith('ου')).map((t) => t.slice(2)), 'σ'],
    mp: mp.filter((t) => t.startsWith('ο')).map((t) => t.slice(1)),
  });
}

// the prefix of an α-class compound loses its elision in the aorist (no reduplication to absorb it): ἀνίστημι, but ἀναστάς
const AOR_PREFIX = { αν: 'ανα', αφ: 'απο', εφ: 'επι', ανθ: 'αντι', καθ: 'κατα', μεθ: 'μετα', δι: 'δια', παρ: 'παρα', περ: 'περι', υφ: 'υπο' };
/** Split an infinitive ('inf') or participle ('ptc') of a -μι verb into { prefix, redup, root, ending }; null when the verb or form isn't understood. */
export function miSplit(word, head, key, sys) {
  const cl = classOf(head); if (!cl) return null;
  const pres = key.startsWith('pres'), act = key.endsWith('act'), mid = key.endsWith('mp') || key.endsWith('mid');
  if (cl.key === 'u' && !pres) return null;
  if (!(act || mid)) return null;
  const hs = skel(head), pre0 = hs.slice(0, hs.length - cl.suffix.length), cs = chars(word), s = cs.map(skel).join('');
  const pre = !pres && cl.key === 'a' && AOR_PREFIX[pre0] && s.startsWith(AOR_PREFIX[pre0]) ? AOR_PREFIX[pre0] : pre0;
  if (!s.startsWith(pre)) return null;
  let i = pre.length;
  const red = pres ? cl.redup : '';
  if (red) { if (!s.startsWith(red, i)) return null; }
  const rem = s.slice(i + red.length), E = endingSets();
  const options = sys === 'inf'
    ? (act ? [[pres ? cl.short : cl.aorInf, ['ναι']]] : [[cl.short, ['σθαι']]])
    : (act ? [[cl.short, E.shortAct], [cl.long, E.longAct]] : [[cl.short, E.mp]]);
  for (const [root, ends] of options) {
    if (!root || !rem.startsWith(root)) continue;
    const end = rem.slice(root.length);
    if (ends.includes(end)) {
      const a = pre.length, b = a + red.length, c = b + root.length;
      return { mi: { cls: cl, prefix: cs.slice(0, a).join(''), redup: cs.slice(a, b).join(''), root: cs.slice(b, c).join(''), ending: cs.slice(c).join('') } };
    }
  }
  return null;
}

/** The reference page: for each class, the present and aorist infinitive, participle, subjunctive and imperative. */
export const MI_PAGE = [
  { key: 'o', verb: 'δίδωμι', gloss: 'I give', root: '*δο', cls: 'o-class', rows: [
    ['Infinitive', 'διδόναι', 'δοῦναι'], ['Participle', 'διδούς, διδοῦσα, διδόν', 'δούς, δοῦσα, δόν'],
    ['Subjunctive', 'διδῶ, διδῷς, διδῷ, διδῶμεν, διδῶτε, διδῶσι(ν)', 'δῶ, δῷς, δῷ, δῶμεν, δῶτε, δῶσι(ν)'], ['Imperative', 'δίδου, διδότω, δίδοτε, διδότωσαν', 'δός, δότω, δότε, δότωσαν']] },
  { key: 'e', verb: 'τίθημι', gloss: 'I put', root: '*θε', cls: 'ε-class', rows: [
    ['Infinitive', 'τιθέναι', 'θεῖναι'], ['Participle', 'τιθείς, τιθεῖσα, τιθέν', 'θείς, θεῖσα, θέν'],
    ['Subjunctive', 'τιθῶ, τιθῇς, τιθῇ, τιθῶμεν, τιθῆτε, τιθῶσι(ν)', 'θῶ, θῇς, θῇ, θῶμεν, θῆτε, θῶσι(ν)'], ['Imperative', 'τίθει, τιθέτω, τίθετε, τιθέτωσαν', 'θές, θέτω, θέτε, θέτωσαν']] },
  { key: 'a', verb: 'ἵστημι', gloss: 'I set', root: '*στα', cls: 'α-class', rows: [
    ['Infinitive', 'ἱστάναι', 'στῆναι'], ['Participle', 'ἱστάς, ἱστᾶσα, ἱστάν', 'στάς, στᾶσα, στάν'],
    ['Subjunctive', 'ἱστῶ, ἱστῇς, ἱστῇ, ἱστῶμεν, ἱστῆτε, ἱστῶσι(ν)', 'στῶ, στῇς, στῇ, στῶμεν, στῆτε, στῶσι(ν)'], ['Imperative', 'ἵστη, ἱστάτω, ἵστατε, ἱστάτωσαν', 'στῆθι, στήτω, στῆτε, στήτωσαν']] },
  { key: 'ie', verb: 'ἀφίημι', gloss: 'I send away, forgive', root: '*ἑ', cls: 'ε-class', rows: [
    ['Infinitive', 'ἀφιέναι', 'ἀφεῖναι'], ['Participle', 'ἀφιείς, ἀφιεῖσα, ἀφιέν', 'ἀφείς, ἀφεῖσα, ἀφέν'],
    ['Subjunctive', '', 'ἀφῶ, ἀφῇς, ἀφῇ, ἀφῶμεν, ἀφῆτε, ἀφῶσι(ν)'], ['Imperative', '', 'ἄφες, ἀφέτω, ἄφετε, ἀφέτωσαν']] },
  { key: 'u', verb: 'δείκνυμι', gloss: 'I show', root: '*δεικνυ', cls: 'υ-class', rows: [
    ['Infinitive', 'δεικνύναι', ''], ['Participle', 'δεικνύς, δεικνῦσα, δεικνύν', ''], ['Imperative', 'δείκνυ, δεικνύτω, δείκνυτε, δεικνύτωσαν', '']], note: 'Only the present system is -μι. The aorist is regular: ἔδειξα, δεῖξαι, δείξας.' },
  { key: 'eimi', verb: 'εἰμί', gloss: 'I am', root: '', cls: 'its own pattern', rows: [
    ['Infinitive', 'εἶναι', ''], ['Participle', 'ὤν, οὖσα, ὄν', ''], ['Subjunctive', 'ὦ, ᾖς, ᾖ, ὦμεν, ἦτε, ὦσι(ν)', ''], ['Imperative', 'ἴσθι, ἔστω, ἔστε, ἔστωσαν', '']], note: 'εἰμί has no aorist; these are its present forms.' },
];

/** What to say after an answer about a -μι infinitive or participle. */
export function explainMi(sp, r, head) {
  const m = sp.mi, c = m.cls, pres = r.key.startsWith('pres');
  const bits = [r.name + ': ' + [m.prefix ? 'prefix ' + m.prefix : null, m.redup ? 'reduplication ' + m.redup : null, 'root ' + m.root, 'ending ' + m.ending].filter(Boolean).join(', ') + '.'];
  bits.push(head + ' is a -μι verb of the ' + c.cls + (c.root ? ' (root ' + c.root + ')' : '') + '.');
  if (c.key === 'u') bits.push('Only the present system of δείκνυμι is -μι: the stem δεικνυ- takes the endings directly, with no reduplication.');
  else if (pres) bits.push('The ι-reduplication ' + m.redup + '- marks the present. The 2nd aorist uses the bare root, and the perfect reduplicates with ε.');
  else bits.push('There is no reduplication, so this is the 2nd aorist, which uses the bare root. The present reduplicates the stem with ι.');
  if (r.key.endsWith('mp')) bits.push('Middle and passive look the same here; the context decides.');
  return bits;
}
