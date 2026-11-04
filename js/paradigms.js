// One paradigm for each row of the master verb chart, using the verb the chart names for that row. A form is shown whole only when it is written in the text; otherwise just its ending.
import { D } from './data.js';

const TAG = /^V-([12]?)([PIFARL])([AMPEDONQX]?)([IMSONP])(?:-([123])([SP]))?/;
const CELLS = ['1S', '2S', '3S', '1P', '2P', '3P'];
export const CELL_LABEL = { '1S': '1st sing.', '2S': '2nd sing.', '3S': '3rd sing.', '1P': '1st pl.', '2P': '2nd pl.', '3P': '3rd pl.' };
const skel = (s) => s.normalize('NFD').replace(/[̀-ͯ­]/g, '').toLowerCase().replace(/ς/g, 'σ');
const clean = (w) => w.replace(/­/g, '');
const chars = (w) => [...clean(w).normalize('NFC')];
const regularVerb = (n) => /(ω|μαι)$/.test(skel((D.lexByN.get(n) || { head: '' }).head));     // -μι verbs follow their own patterns
const liquid = (n) => /[λμνρ]ω$/.test(skel((D.lexByN.get(n) || { head: '' }).head));

/** The master-chart row a parsed indicative verb form belongs to (the liquid rows are told apart by the verb's stem). */
export function rowOfAnalysis(a, w = '') {
  const x = TAG.exec(a && a.m || ''); if (!x || x[4] !== 'I') return null;
  const [, sec, t, v0] = x, v = v0 || 'X', act = 'AQX'.includes(v), pas = 'PO'.includes(v), s = sec === '2', sk = skel(w), noSigma = (re) => !re.test(sk), liq = liquid(a.s);
  switch (t) {
    case 'P': return act ? 'pres-act' : 'pres-mp';
    case 'I': return act ? 'impf-act' : 'impf-mp';
    case 'F': return pas ? (s ? 'fut-pas2' : 'fut-pas1') : act ? (liq && noSigma(/σ(ω|εισ|ει|ουμεν|ετε|ουσι?ν?)$/) ? 'fut-liq-act' : 'fut-act') : (liq && noSigma(/σ(ομαι|η|εται|ομεθα|εσθε|ονται)$/) ? 'fut-liq-mid' : 'fut-mid');
    case 'A': return pas ? (s ? 'aor2-pas' : 'aor1-pas') : act ? (s ? 'aor2-act' : (liq && noSigma(/σ(α|ασ|εν|αμεν|ατε|αν)$/) ? 'aor-liq-act' : 'aor1-act')) : (s ? 'aor2-mid' : 'aor1-mid');
    case 'R': return act ? (s ? 'perf2-act' : 'perf1-act') : 'perf-mp';
    default: return null;
  }
}

let data = null;
function build() {                                                   // row -> most frequent form (for a one-line example)
  if (data) return data;
  data = new Map();
  for (const f of D.forms) {
    const a = f.an[0]; if (!a) continue;
    const row = rowOfAnalysis(a, f.w); if (!row) continue;
    const w = clean(f.w), low = w[0] === w[0].toLowerCase(), cur = data.get(row);
    if (!cur || (low && !cur.low) || (low === cur.low && f.count > cur.count)) data.set(row, { w, count: f.count, low });
  }
  return data;
}
/** The most frequent form of a chart row in the text (for a one-line example), or null. */
export function exampleForm(row) { const e = build().get(row); return e ? e.w : null; }

/* ---------- the chart's own paradigms ----------
   Each row of the master verb chart names a verb (its "1st sing paradigm" column). These are that verb's six forms for the row,
   written out as in a grammar (authored, like the endings tables). The first form of every row is checked against the chart in the tests. */
const VERBS = { λύω: 3089, μένω: 3306, πορεύομαι: 4198, ἀποστέλλω: 649, λαμβάνω: 2983, γίνομαι: 1096, γράφω: 1125 };
const PARADIGMS = {
  'pres-act': ['λύω', ['λύω', 'λύεις', 'λύει', 'λύομεν', 'λύετε', 'λύουσι(ν)']],
  'pres-mp': ['λύω', ['λύομαι', 'λύῃ', 'λύεται', 'λυόμεθα', 'λύεσθε', 'λύονται']],
  'impf-act': ['λύω', ['ἔλυον', 'ἔλυες', 'ἔλυε(ν)', 'ἐλύομεν', 'ἐλύετε', 'ἔλυον']],
  'impf-mp': ['λύω', ['ἐλυόμην', 'ἐλύου', 'ἐλύετο', 'ἐλυόμεθα', 'ἐλύεσθε', 'ἐλύοντο']],
  'fut-act': ['λύω', ['λύσω', 'λύσεις', 'λύσει', 'λύσομεν', 'λύσετε', 'λύσουσι(ν)']],
  'fut-liq-act': ['μένω', ['μενῶ', 'μενεῖς', 'μενεῖ', 'μενοῦμεν', 'μενεῖτε', 'μενοῦσι(ν)']],
  'fut-mid': ['πορεύομαι', ['πορεύσομαι', 'πορεύσῃ', 'πορεύσεται', 'πορευσόμεθα', 'πορεύσεσθε', 'πορεύσονται']],
  'fut-liq-mid': ['μένω', ['μενοῦμαι', 'μενῇ', 'μενεῖται', 'μενούμεθα', 'μενεῖσθε', 'μενοῦνται']],
  'fut-pas1': ['λύω', ['λυθήσομαι', 'λυθήσῃ', 'λυθήσεται', 'λυθησόμεθα', 'λυθήσεσθε', 'λυθήσονται']],
  'fut-pas2': ['ἀποστέλλω', ['ἀποσταλήσομαι', 'ἀποσταλήσῃ', 'ἀποσταλήσεται', 'ἀποσταλησόμεθα', 'ἀποσταλήσεσθε', 'ἀποσταλήσονται']],
  'aor1-act': ['λύω', ['ἔλυσα', 'ἔλυσας', 'ἔλυσε(ν)', 'ἐλύσαμεν', 'ἐλύσατε', 'ἔλυσαν']],
  'aor-liq-act': ['μένω', ['ἔμεινα', 'ἔμεινας', 'ἔμεινε(ν)', 'ἐμείναμεν', 'ἐμείνατε', 'ἔμειναν']],
  'aor2-act': ['λαμβάνω', ['ἔλαβον', 'ἔλαβες', 'ἔλαβε(ν)', 'ἐλάβομεν', 'ἐλάβετε', 'ἔλαβον']],
  'aor1-mid': ['λύω', ['ἐλυσάμην', 'ἐλύσω', 'ἐλύσατο', 'ἐλυσάμεθα', 'ἐλύσασθε', 'ἐλύσαντο']],
  'aor2-mid': ['γίνομαι', ['ἐγενόμην', 'ἐγένου', 'ἐγένετο', 'ἐγενόμεθα', 'ἐγένεσθε', 'ἐγένοντο']],
  'aor1-pas': ['λύω', ['ἐλύθην', 'ἐλύθης', 'ἐλύθη', 'ἐλύθημεν', 'ἐλύθητε', 'ἐλύθησαν']],
  'aor2-pas': ['γράφω', ['ἐγράφην', 'ἐγράφης', 'ἐγράφη', 'ἐγράφημεν', 'ἐγράφητε', 'ἐγράφησαν']],
  'perf1-act': ['λύω', ['λέλυκα', 'λέλυκας', 'λέλυκε(ν)', 'λελύκαμεν', 'λελύκατε', 'λελύκασι(ν)']],
  'perf2-act': ['γίνομαι', ['γέγονα', 'γέγονας', 'γέγονε(ν)', 'γεγόναμεν', 'γεγόνατε', 'γεγόνασι(ν)']],
  'perf-mp': ['λύω', ['λέλυμαι', 'λέλυσαι', 'λέλυται', 'λελύμεθα', 'λέλυσθε', 'λέλυνται']],
};
export const PARADIGM_ROWS = Object.keys(PARADIGMS);
/** Longest shared start of several words, ignoring accents; the number of letters. */
const lcp = (ws) => { const s = ws.map(skel); let k = 0; while (s.every((x) => x.length > k && x[k] === s[0][k])) k++; return k; };
let exact = null;
const inTheText = (w) => (exact || (exact = new Set(D.forms.map((f) => chars(f.w).join(''))))).has(chars(w).join(''));
/** { row, n, head, brief, cells: [{ cell, label, have, stem, ending, word }], attested } for a chart row.
    A cell is `have` only when the verb's form is written in the text (shown whole). Otherwise only the ending is shown (an authored ending, not a text form). */
const cache = new Map();
export function paradigm(row) {
  if (cache.has(row)) return cache.get(row);
  const P = PARADIGMS[row]; let out = null;
  if (P) {
    const [verb, forms] = P, n = VERBS[verb], L = D.lexByN.get(n);
    const k = Math.min(lcp(forms), Math.min(...forms.map((w) => chars(w).length)) - 1);
    const cells = CELLS.map((cell, i) => {
      const f = forms[i], vs = f.includes('(ν)') ? [f.replace('(ν)', ''), f.replace('(ν)', 'ν')] : [f];
      const hit = vs.find(inTheText), w = chars(hit || vs[0]), split = (x) => ({ stem: x.slice(0, k).join(''), ending: x.slice(k).join('') });
      return hit ? { cell, label: CELL_LABEL[cell], have: true, word: hit, ...split(w) }
        : { cell, label: CELL_LABEL[cell], have: false, word: null, stem: '', ending: chars(f.replace('(ν)', '')).slice(k).join('') };
    });
    out = { row, n, head: L.head, brief: L.brief, cells, attested: cells.filter((c) => c.have).length };
  }
  cache.set(row, out); return out;
}
