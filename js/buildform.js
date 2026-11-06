// Build the form: practice only. You are told which form of which verb (tense, voice, person, number), and put it together one slot at a time:
// front (augment or reduplication) → stem → tense formative → ending. The forms are real forms from the text, taken apart with the chart's own pieces.
// A form is only offered when it adds up exactly (front + stem + formative + ending is the word, ignoring accents); anything else (contract verbs, vowel-initial
// stems, compound verbs, liquid and other irregular stems) is left out rather than split wrongly.
import { D, notParsed } from './data.js';
import { ROWS, say } from './chartdrill.js';
import { rowPool } from './parse.js';
import { h, clear, shuffle, backHead, backLinks } from './util.js';
import { rowOfTag } from './families.js';
import { isCompoundLemma } from './cluehunt.js';

const skel = (s) => s.replace(/­/g, '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/ς/g, 'σ');
const final = (s) => s.replace(/σ$/, 'ς');
const ROW = Object.fromEntries(ROWS.map((r) => [r.key, r]));
const CELLS = ['1S', '2S', '3S', '1P', '2P', '3P'], CELL_NAME = { '1S': '1st person singular', '2S': '2nd person singular', '3S': '3rd person singular', '1P': '1st person plural', '2P': '2nd person plural', '3P': '3rd person plural' };

const PRES_ACT = ['ω', 'εις', 'ει', 'ομεν', 'ετε', 'ουσι(ν)'], MP_PRIM = ['ομαι', 'η', 'εται', 'ομεθα', 'εσθε', 'ονται'], SEC_ACT = ['ον', 'ες', 'ε(ν)', 'ομεν', 'ετε', 'ον'], SEC_MP = ['ομην', 'ου', 'ετο', 'ομεθα', 'εσθε', 'οντο'];
const A_ACT = ['α', 'ας', 'ε(ν)', 'αμεν', 'ατε', 'αν'], PAS = ['ην', 'ης', 'η', 'ημεν', 'ητε', 'ησαν'];
/** For each row of the master chart: the front (ε, a reduplication, or nothing), the tense formative letters, and the six realized endings. */
export const BUILD = {
  'pres-act': { A: '', F: '', E: PRES_ACT }, 'pres-mp': { A: '', F: '', E: MP_PRIM },
  'impf-act': { A: 'ε', F: '', E: SEC_ACT }, 'impf-mp': { A: 'ε', F: '', E: SEC_MP },
  'fut-act': { A: '', F: 'σ', E: PRES_ACT }, 'fut-mid': { A: '', F: 'σ', E: MP_PRIM }, 'fut-pas1': { A: '', F: 'θησ', E: MP_PRIM }, 'fut-pas2': { A: '', F: 'ησ', E: MP_PRIM },
  'aor1-act': { A: 'ε', F: 'σ', E: A_ACT }, 'aor2-act': { A: 'ε', F: '', E: SEC_ACT }, 'aor1-mid': { A: 'ε', F: 'σ', E: ['αμην', 'ω', 'ατο', 'αμεθα', 'ασθε', 'αντο'] }, 'aor2-mid': { A: 'ε', F: '', E: SEC_MP },
  'aor1-pas': { A: 'ε', F: 'θ', E: PAS }, 'aor2-pas': { A: 'ε', F: '', E: PAS },
  'perf1-act': { A: 'RED', F: 'κ', E: ['α', 'ας', 'ε(ν)', 'αμεν', 'ατε', 'ασι(ν)'] }, 'perf2-act': { A: 'RED', F: '', E: ['α', 'ας', 'ε(ν)', 'αμεν', 'ατε', 'ασι(ν)'] }, 'perf-mp': { A: 'RED', F: '', E: ['μαι', 'σαι', 'ται', 'μεθα', 'σθε', 'νται'] },
};
for (const T of Object.values(BUILD)) T.E = T.E.map(skel);                 // endings are kept as plain letters (σ everywhere), and shown with ς at the end
export const BUILD_ROWS = Object.keys(BUILD);
const variants = (e) => (e.includes('(ν)') ? [e.replace('(ν)', ''), e.replace('(ν)', 'ν')] : [e]);
const shown = (e) => final(e);
const VOWEL_START = /^[αεηιουω]/;

const TAG = /^V-[12]?[PIFARL][AMPEDONQX]?I-([123])([SP])/;
const cellOf = (m) => { const x = TAG.exec(m || ''); return x ? x[1] + x[2] : null; };
const contract = (n) => { const L = D.lexByN.get(n); return !L || /(αω|εω|οω|μι|αομαι|εομαι|οομαι)$/.test(skel(L.head)) || isCompoundLemma(L.head); };
/** The present stem of a verb, from its lexical form (λύω → λυ, ἔρχομαι is left out: its stem is not the present's). */
const presentStem = (n) => { const L = D.lexByN.get(n), s = L ? skel(L.head) : ''; return /(ω|ομαι)$/.test(s) ? s.replace(/(ω|ομαι)$/, '') : null; };      // contract and -μι verbs do not add up to a simple split

/** A form taken apart: { row, cell, A, S, F, E, word, n } or null when it does not add up exactly. */
export function decompose(id, row) {
  const f = D.forms[id], a = f.an[0], T = BUILD[row]; if (!a || !T || notParsed(a)) return null;
  const cell = cellOf(a.m); if (!cell || contract(a.s) || rowOfTag(a.m, a.s) !== row) return null;
  const w = skel(f.w), end = variants(T.E[CELLS.indexOf(cell)]).map((e) => T.F + e).find((suffix) => w.endsWith(suffix) && w.length - suffix.length >= 3);
  if (end == null) return null;
  const E = T.E[CELLS.indexOf(cell)], body = w.slice(0, w.length - end.length), used = variants(E).find((e) => w.endsWith(T.F + e));
  let A = '', S = body;
  if (T.A === 'ε') { if (body[0] !== 'ε' || body.length < 3 || VOWEL_START.test(body[1])) return null; A = 'ε'; S = body.slice(1); }
  else if (T.A === 'RED') { if (body.length < 4 || body[1] !== 'ε' || body[0] !== body[2] || VOWEL_START.test(body[0])) return null; A = body.slice(0, 2); S = body.slice(2); }
  if (S.length < 2) return null;
  // a stem that is only the present stem with sounds dropped or changed (a stop before σ, a σ before θ) would be misleading: those rows must show the verb's own present stem
  // (the second aorist and second perfect are different stems by definition, so they are free)
  if (!/^(aor2|perf2)/.test(row) && S !== presentStem(a.s)) return null;
  return { row, cell, A, S, F: T.F, E, used, word: f.w.replace(/­/g, ''), n: a.s, id };
}

/* ---------- the pool and the session ---------- */
let byVerb = null;
const formsOfVerb = (n) => { if (!byVerb) { byVerb = new Map(); D.forms.forEach((f, i) => { const a = f.an[0]; if (a && !notParsed(a)) { if (!byVerb.has(a.s)) byVerb.set(a.s, []); byVerb.get(a.s).push(i); } }); } return byVerb.get(n) || []; };
/** Forms of one row that can be built, from verbs you know or any verb; only forms whose level is open (gated like the daily quiz). */
export function buildPool(row, any = false) { return rowPool(row, { gated: true, anyVerb: any }).map((id) => decompose(id, row)).filter(Boolean); }
export function buildQueue(any = false, total = 8) {
  const lists = shuffle(BUILD_ROWS.map((r) => shuffle(buildPool(r, any).sort((a, b) => D.forms[b.id].count - D.forms[a.id].count).slice(0, 30)))).filter((l) => l.length), out = [], seen = new Set();
  for (let i = 0; lists.length && out.length < total; i++) {
    const l = lists[i % lists.length], d = l.find((x) => !seen.has(x.id));
    if (d) { seen.add(d.id); out.push(d); } else if (lists.every((q) => q.every((x) => seen.has(x.id)))) break;
  }
  return out;
}

/* ---------- tile options for each slot ---------- */
const uniq = (xs) => [...new Set(xs)];
function frontOptions(d) {
  const red = d.A.length === 2 ? d.A : d.S[0] + 'ε';
  return [['none', 'no front'], ['ε', 'ε-'], ['red', red + '- (reduplication)']];
}
const frontAnswer = (d) => (d.A === '' ? 'none' : d.A === 'ε' ? 'ε' : 'red');
function stemOptions(d) {
  const others = uniq(formsOfVerb(d.n).flatMap((i) => BUILD_ROWS.map((r) => { const x = D.forms[i].an[0]; return x && cellOf(x.m) ? decompose(i, r) : null; }).filter(Boolean)).map((x) => x.S)).filter((s) => s !== d.S);
  const synthetic = uniq([d.S + 'σ', d.S + 'θ', d.S.slice(0, -1), d.S + 'κ'].filter((s) => s.length >= 2 && s !== d.S));
  return shuffle([d.S, ...shuffle(others).slice(0, 2), ...shuffle(synthetic)].filter((s, i, a) => a.indexOf(s) === i).slice(0, 4)).map((s) => [s, s + '-']);
}
const FORMATIVES = uniq(BUILD_ROWS.map((r) => BUILD[r].F));
function formativeOptions(d) { return shuffle(uniq([d.F, ...shuffle(FORMATIVES.filter((x) => x !== d.F)).slice(0, 3)])).map((f) => [f, f || 'none']); }
function endingOptions(d) {
  const T = BUILD[d.row], same = uniq(T.E.filter((e) => e !== d.E)), cross = uniq(BUILD_ROWS.flatMap((r) => BUILD[r].E[CELLS.indexOf(d.cell)]).filter((e) => e !== d.E && !same.includes(e)));
  return shuffle(uniq([d.E, ...shuffle(same).slice(0, 2), ...shuffle(cross).slice(0, 1), ...shuffle(same).slice(2)]).slice(0, 4)).map((e) => [e, '-' + shown(e)]);
}

/* ---------- the screens ---------- */
const greek = (t, cls = '') => h('span' + cls, { lang: 'grc' }, t);
const pieces = (d, upto, mark) => h('div', { lang: 'grc', style: { display: 'flex', justifyContent: 'center', gap: '.3rem', flexWrap: 'wrap', margin: '.5rem 0' } },
  ...[['Front', d.A === '' ? '—' : d.A + '-', 0], ['Stem', d.S + '-', 1], ['Formative', d.F || '—', 2], ['Ending', '-' + shown(d.E), 3]].map(([label, text, i]) => h('div', { style: { minWidth: '4.3rem', textAlign: 'center', padding: '.35rem .5rem', borderRadius: '12px', border: '2px ' + (i < upto ? 'solid' : 'dashed') + ' ' + (i === mark ? 'var(--accent)' : i < upto ? 'var(--good)' : 'var(--line)'), background: i < upto ? 'var(--good-soft)' : 'var(--surface)' } },
    h('small', { style: { display: 'block', font: '700 .6rem var(--ui)', letterSpacing: '.05em', textTransform: 'uppercase', color: 'var(--muted)' } }, label), h('span', { style: { fontFamily: 'var(--greek)', fontSize: '1.3rem' } }, i < upto ? text : ' '))));

export function renderBuild(view, mode) {
  const any = mode === 'any', queue = buildQueue(any), back = ['#/parse', 'Back to Parsing'];
  if (!queue.length) { clear(view).append(backHead('Build the form', '#/parse', 'Parsing'), h('div.card.stack', h('p', 'There are no forms to build yet' + (any ? '' : ' in verbs you know') + '. Forms open up as you learn the chart rows and the verbs. Verbs with contracted or irregular stems are left out.'), any ? null : h('a.btn', { href: '#/parse/run/build/any' }, 'Try with any verb'), ...backLinks(...back))); return; }
  const tally = [0, 0], missed = {}; let at = 0;
  const done = () => clear(view).append(backHead('Build the form', '#/parse', 'Parsing'), h('div.card.stack', h('h2', 'Practice complete'), h('p.muted.small', 'Practice only: nothing here changes your review schedule.'),
    h('div.kpis', h('div.kpi', h('b', tally[0] + ' / ' + tally[1]), h('span', 'pieces right'))), Object.keys(missed).length ? h('p', 'You missed the ', h('b', Object.entries(missed).sort((a, b) => b[1] - a[1])[0][0].toLowerCase()), ' most often.') : h('p', 'You got every piece.'),
    h('div.row.wrap', h('button.btn.primary', { onclick: () => renderBuild(view, mode) }, 'Practice more'), ...backLinks(...back))));
  const frame = (d, body, upto, mark) => { const L = D.lexByN.get(d.n), r = ROW[d.row]; clear(view).append(backHead('Build the form', '#/parse', 'Parsing'), h('div.stack', h('div.card.stack',
    h('div.row.between', h('b', 'Build the form'), h('span.chip', (at + 1) + ' / ' + queue.length)),
    h('div.card.small', { style: { background: 'var(--accent-soft)', border: 'none' } }, h('b', say(r.name).replace(/^./, (c) => c.toUpperCase()) + ' indicative, ' + CELL_NAME[d.cell].replace('person ', '')), h('div', { style: { color: 'var(--ink-2)' } }, 'of ', greek(L.head), ' · ', L.brief)),
    pieces(d, upto, mark), ...body))); };
  const choose = (d, i, title, options, right, onRight) => {
    const box = h('div.opts.two'); let locked = false;
    for (const [v, label] of options) { const b = h('button.opt', { onclick: () => { if (locked) return; locked = true; const ok = v === right; tally[1]++; if (ok) tally[0]++; else missed[title] = (missed[title] || 0) + 1; b.classList.add(ok ? 'right' : 'wrong'); if (!ok) [...box.children].find((x) => x.dataset.v === String(right))?.classList.add('right'); setTimeout(onRight, ok ? 450 : 1300); } }, greek(label)); b.dataset.v = String(v); box.append(b); }
    return [h('p', h('b', title)), box];
  };
  const show = () => {
    const d = queue[at], step = (i) => {
      if (i === 0) frame(d, choose(d, 0, 'Front', frontOptions(d), frontAnswer(d), () => step(1)), 0, 0);
      else if (i === 1) frame(d, choose(d, 1, 'Stem', stemOptions(d), d.S, () => step(2)), 1, 1);
      else if (i === 2) frame(d, choose(d, 2, 'Tense formative', formativeOptions(d), d.F, () => step(3)), 2, 2);
      else if (i === 3) frame(d, choose(d, 3, 'Ending', endingOptions(d), d.E, () => step(4)), 3, 3);
      else {
        const r = ROW[d.row], chartF = r.form, changed = chartF && chartF !== d.F && /[αη]$/.test(chartF);
        frame(d, [h('div', { lang: 'grc', style: { fontFamily: 'var(--greek)', fontSize: '2.2rem', textAlign: 'center', margin: '.2rem 0' } }, d.word),
          h('div.card.small', { style: { background: 'var(--good-soft)', border: 'none' } }, h('b', 'Built: '), (d.A ? d.A + '- ' : 'no front, ') + d.S + '- + ' + (d.F ? d.F + ' + ' : 'no formative, ') + '-' + shown(d.E) + '.', ' ', h('span.muted.small', 'Accents are not part of this exercise.')),
          changed ? h('p.muted.small', { style: { margin: 0 } }, 'The chart writes this formative as ', greek(chartF), '. Here the final vowel goes with the ending, because it changes: in the 3rd singular, for example, it is ', greek('ε'), '.') : null,
          h('button.btn.primary', { onclick: () => { at++; at < queue.length ? show() : done(); } }, 'Next')], 4, -1);
      }
    };
    step(0);
  };
  show();
}
