// One real paradigm for each row of the master verb chart, found in the Greek text itself: the regular verb whose six
// person-and-number forms are best attested. A form that is not in the text for that verb is shown from another regular verb, named.
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
function build() {
  if (data) return data;
  const rows = new Map();                                            // row -> { verbs: Map(strongs -> Map(cell -> {w,count})), total: Map(strongs -> n), cells: Map(cell -> Map(verb -> forms[])) }
  for (const f of D.forms) {
    const a = f.an[0]; if (!a) continue;
    const row = rowOfAnalysis(a, f.w), x = TAG.exec(a.m || ''); if (!row || !x[5]) continue;
    const cell = x[5] + x[6]; let R = rows.get(row); if (!R) rows.set(row, R = { verbs: new Map(), total: new Map(), cells: new Map() });
    let V = R.verbs.get(a.s); if (!V) R.verbs.set(a.s, V = new Map());
    const w = clean(f.w), low = w[0] === w[0].toLowerCase(), cur = V.get(cell);
    if (!cur || (low && !cur.low) || (low === cur.low && f.count > cur.count)) V.set(cell, { w, count: f.count, low });       // a form written with a small first letter is preferred to one that opens a sentence
    R.total.set(a.s, (R.total.get(a.s) || 0) + f.count);
  }
  for (const R of rows.values()) {                                    // the ending the verbs of each cell share: the longest ending that at least half of them have
    R.end = new Map();
    for (const cell of CELLS) {
      const forms = [...R.verbs.values()].map((V) => V.get(cell)).filter(Boolean).map((c) => skel(c.w)); if (!forms.length) continue;
      for (let L = 4; L >= 1; L--) {
        const cnt = new Map(); for (const f of forms) if (f.length > L) { const e = f.slice(-L); cnt.set(e, (cnt.get(e) || 0) + 1); }
        const best = [...cnt.entries()].sort((a, b) => b[1] - a[1])[0];
        if (best && best[1] / forms.length >= 0.5 && best[1] >= Math.min(3, forms.length)) { R.end.set(cell, best[0]); break; }
      }
    }
  }
  return (data = rows);
}

/** Longest shared start of several words, ignoring accents; the number of letters. */
const lcp = (ws) => { const s = ws.map(skel); let k = 0; while (s.every((x) => x.length > k && x[k] === s[0][k])) k++; return k; };

/** { row, n, head, brief, cells: [{ cell, label, have, stem, ending, word, from }], attested } for a chart row, or null if the text has none. */
const cache = new Map();
export function paradigm(row) {
  if (cache.has(row)) return cache.get(row);
  const R = build().get(row); let out = null;
  if (R) {
    const fits = (V, cell) => { const c = V.get(cell), e = R.end.get(cell); return !!c && !!e && skel(c.w).endsWith(e); };
    const rank = [...R.verbs.entries()].filter(([n]) => regularVerb(n)).map(([n, V]) => ({ n, V, fit: CELLS.filter((c) => fits(V, c)).length, have: V.size, small: CELLS.filter((c) => fits(V, c) && V.get(c).low).length, total: R.total.get(n) || 0 }))
      .sort((a, b) => b.small - a.small || b.fit - a.fit || b.have - a.have || b.total - a.total || a.n - b.n);
    const best = rank[0];
    if (best && best.fit) {
      const have = CELLS.filter((c) => fits(best.V, c)), words = have.map((c) => best.V.get(c).w);
      const k = words.length > 1 ? Math.min(lcp(words), Math.min(...words.map((w) => chars(w).length)) - 1) : 0;
      const cells = CELLS.map((cell) => {
        if (have.includes(cell)) { const w = chars(best.V.get(cell).w); return { cell, label: CELL_LABEL[cell], have: true, stem: w.slice(0, k).join(''), ending: w.slice(k).join(''), word: best.V.get(cell).w }; }
        // not in the text for this verb: show the commonest real form of another regular verb in that place, named
        const e = R.end.get(cell), others = [...R.verbs.entries()].filter(([n, V]) => n !== best.n && regularVerb(n) && fits(V, cell)).map(([n, V]) => ({ n, c: V.get(cell) })).sort((x, y) => (y.c.low - x.c.low) || y.c.count - x.c.count)[0];
        return { cell, label: CELL_LABEL[cell], have: false, stem: '', ending: '', word: others ? others.c.w : null, from: others ? D.lexByN.get(others.n).head : null };
      });
      const L = D.lexByN.get(best.n);
      out = { row, n: best.n, head: L.head, brief: L.brief, cells, attested: have.length };
    }
  }
  cache.set(row, out); return out;
}
/** The most frequent form of a chart row in the text (for a one-line example), or null. */
export function exampleForm(row) {
  const R = build().get(row); if (!R) return null; let best = null;
  for (const [n, V] of R.verbs) if (regularVerb(n)) for (const c of V.values()) if (c.low && (!best || c.count > best.count)) best = c;
  return best ? best.w : null;
}
