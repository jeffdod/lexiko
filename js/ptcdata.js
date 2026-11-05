// Participles: the ten kinds in the grammar chart, each with a model paradigm (written out here, not taken from the text),
// and a way to split a participle from the text into stem · formative · morpheme + ending.

export const skel = (s) => s.normalize('NFD').replace(/[̀-ͯͅ­]/g, '').toLowerCase().replace(/ς/g, 'σ');
export const chars = (w) => [...w.replace(/[\u00ad\u200b]/g, '').normalize('NFC')];      // the text marks syllables with soft hyphens: drop them, or letters and positions drift apart
const sk1 = (w) => chars(w).map(skel);                    // one skeleton letter per written letter, so positions line up

/** Rows of a paradigm, in this order; each cell is masculine, feminine, neuter. */
export const CELL_ROWS = ['Nom. sg.', 'Gen. sg.', 'Dat. sg.', 'Acc. sg.', 'Nom. pl.', 'Gen. pl.', 'Dat. pl.', 'Acc. pl.'];

const row = (key, name, fam, verb, stemLen, form, morph, fre, rows) => ({ key, name, fam, verb, stemLen, form, morph, fre, forms: rows.map((r) => r.split(' ')) });

export const PTC = [
  row('pres-act', 'Present active', 'Present', 'λύω', 2, 'ο', 'ντ', /^(ου|ω|ο)/, [
    'λύων λύουσα λῦον', 'λύοντος λυούσης λύοντος', 'λύοντι λυούσῃ λύοντι', 'λύοντα λύουσαν λῦον',
    'λύοντες λύουσαι λύοντα', 'λυόντων λυουσῶν λυόντων', 'λύουσι(ν) λυούσαις λύουσι(ν)', 'λύοντας λυούσας λύοντα']),
  row('pres-mp', 'Present middle/passive', 'Present', 'λύω', 2, 'ο', 'μενο', /^ο/, [
    'λυόμενος λυομένη λυόμενον', 'λυομένου λυομένης λυομένου', 'λυομένῳ λυομένῃ λυομένῳ', 'λυόμενον λυομένην λυόμενον',
    'λυόμενοι λυόμεναι λυόμενα', 'λυομένων λυομένων λυομένων', 'λυομένοις λυομέναις λυομένοις', 'λυομένους λυομένας λυόμενα']),
  row('aor1-act', '1st aorist active', 'First aorist', 'λύω', 2, 'σα', 'ντ', /^σα/, [
    'λύσας λύσασα λῦσαν', 'λύσαντος λυσάσης λύσαντος', 'λύσαντι λυσάσῃ λύσαντι', 'λύσαντα λύσασαν λῦσαν',
    'λύσαντες λύσασαι λύσαντα', 'λυσάντων λυσασῶν λυσάντων', 'λύσασι(ν) λυσάσαις λύσασι(ν)', 'λύσαντας λυσάσας λύσαντα']),
  row('aor1-mid', '1st aorist middle', 'First aorist', 'λύω', 2, 'σα', 'μενο', /^σα/, [
    'λυσάμενος λυσαμένη λυσάμενον', 'λυσαμένου λυσαμένης λυσαμένου', 'λυσαμένῳ λυσαμένῃ λυσαμένῳ', 'λυσάμενον λυσαμένην λυσάμενον',
    'λυσάμενοι λυσάμεναι λυσάμενα', 'λυσαμένων λυσαμένων λυσαμένων', 'λυσαμένοις λυσαμέναις λυσαμένοις', 'λυσαμένους λυσαμένας λυσάμενα']),
  row('aor1-pas', '1st aorist passive', 'First aorist', 'λύω', 2, 'θε', 'ντ', /^θε/, [
    'λυθείς λυθεῖσα λυθέν', 'λυθέντος λυθείσης λυθέντος', 'λυθέντι λυθείσῃ λυθέντι', 'λυθέντα λυθεῖσαν λυθέν',
    'λυθέντες λυθεῖσαι λυθέντα', 'λυθέντων λυθεισῶν λυθέντων', 'λυθεῖσι(ν) λυθείσαις λυθεῖσι(ν)', 'λυθέντας λυθείσας λυθέντα']),
  row('aor2-act', '2nd aorist active', 'Second aorist', 'βάλλω', 3, 'ο', 'ντ', /^(ου|ω|ο)/, [
    'βαλών βαλοῦσα βαλόν', 'βαλόντος βαλούσης βαλόντος', 'βαλόντι βαλούσῃ βαλόντι', 'βαλόντα βαλοῦσαν βαλόν',
    'βαλόντες βαλοῦσαι βαλόντα', 'βαλόντων βαλουσῶν βαλόντων', 'βαλοῦσι(ν) βαλούσαις βαλοῦσι(ν)', 'βαλόντας βαλούσας βαλόντα']),
  row('aor2-mid', '2nd aorist middle', 'Second aorist', 'γίνομαι', 3, 'ο', 'μενο', /^ο/, [
    'γενόμενος γενομένη γενόμενον', 'γενομένου γενομένης γενομένου', 'γενομένῳ γενομένῃ γενομένῳ', 'γενόμενον γενομένην γενόμενον',
    'γενόμενοι γενόμεναι γενόμενα', 'γενομένων γενομένων γενομένων', 'γενομένοις γενομέναις γενομένοις', 'γενομένους γενομένας γενόμενα']),
  row('aor2-pas', '2nd aorist passive', 'Second aorist', 'γράφω', 4, 'ε', 'ντ', /^ε/, [
    'γραφείς γραφεῖσα γραφέν', 'γραφέντος γραφείσης γραφέντος', 'γραφέντι γραφείσῃ γραφέντι', 'γραφέντα γραφεῖσαν γραφέν',
    'γραφέντες γραφεῖσαι γραφέντα', 'γραφέντων γραφεισῶν γραφέντων', 'γραφεῖσι(ν) γραφείσαις γραφεῖσι(ν)', 'γραφέντας γραφείσας γραφέντα']),
  row('perf-act', 'Perfect active', 'Perfect', 'λύω', 4, 'κ', 'οτ', /^κ/, [
    'λελυκώς λελυκυῖα λελυκός', 'λελυκότος λελυκυίας λελυκότος', 'λελυκότι λελυκυίᾳ λελυκότι', 'λελυκότα λελυκυῖαν λελυκός',
    'λελυκότες λελυκυῖαι λελυκότα', 'λελυκότων λελυκυιῶν λελυκότων', 'λελυκόσι(ν) λελυκυίαις λελυκόσι(ν)', 'λελυκότας λελυκυίας λελυκότα']),
  row('perf-mp', 'Perfect middle/passive', 'Perfect', 'λύω', 4, '', 'μενο', null, [
    'λελυμένος λελυμένη λελυμένον', 'λελυμένου λελυμένης λελυμένου', 'λελυμένῳ λελυμένῃ λελυμένῳ', 'λελυμένον λελυμένην λελυμένον',
    'λελυμένοι λελυμέναι λελυμένα', 'λελυμένων λελυμένων λελυμένων', 'λελυμένοις λελυμέναις λελυμένοις', 'λελυμένους λελυμένας λελυμένα']),
];
export const PTCB = new Map(PTC.map((r) => [r.key, r]));
/** The model form to remember: nominative plural masculine. */
export const modelForm = (r) => r.forms[4][0];

/** Every ending of a row, as skeletons without the stem (a movable ν is allowed). */
const tailsOf = (r) => {
  if (r._tails) return r._tails;
  const out = new Set();
  for (const cell of r.forms) for (const f of cell) {
    const vs = f.includes('(ν)') ? [f.replace('(ν)', ''), f.replace('(ν)', 'ν')] : [f];
    for (const v of vs) out.add(sk1(v).slice(r.stemLen).join(''));
  }
  return (r._tails = [...out].sort((a, b) => b.length - a.length));
};

/**
 * Split a written participle of a kind into { stem, formative, rest }, where rest is the morpheme and the case ending together.
 * Null when it doesn't fit the kind's pattern (liquid and contract verbs, second perfects, the verb "to be", ...).
 */
export function split(word, key) {
  const r = PTCB.get(key); if (!r) return null;
  const cs = chars(word), s = cs.map(skel).join('');
  const tail = tailsOf(r).find((t) => s.endsWith(t) && s.length - t.length >= 1);
  if (!tail) return null;
  const k = cs.length - tail.length;
  let fl = 0;
  if (r.fre) { const m = r.fre.exec(tail); if (!m) return null; fl = m[0].length; }
  return { stem: cs.slice(0, k).join(''), formative: cs.slice(k, k + fl).join(''), rest: cs.slice(k + fl).join(''), stemSkel: s.slice(0, k) };
}

export const FORMATIVE_MEANING = { 'ο': 'present, or 2nd aorist active and middle', 'σα': '1st aorist active and middle', 'θε': '1st aorist passive', 'ε': '2nd aorist passive', 'κ': 'perfect active (a perfect also reduplicates)', '': 'perfect middle/passive: no formative (it reduplicates)' };
export const MORPHEME_MEANING = { 'ντ': 'active, and the aorist passive; endings 3-1-3', 'οτ': 'perfect active; endings 3-1-3', 'μενο': 'middle or passive (middle only in the aorists); endings 2-1-2' };
/** Rows that look the same apart from the stem. */
export const LOOKALIKE = { 'pres-act': 'aor2-act', 'aor2-act': 'pres-act', 'pres-mp': 'aor2-mid', 'aor2-mid': 'pres-mp' };
