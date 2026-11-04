// The master verb chart as something to learn: every square of the chart (what each row takes: augment, tense stem, tense formative,
// connecting vowel, endings) and every personal ending is a small scheduled card. Questions are multiple choice, in your chart's own words.
import { clockNow } from './clock.js';
import { D } from './data.js';
import { K, formLevel, rateChart, chartNewToday, chartCardsDue } from './know.js';
import { CHART_ATTRS, levelName } from './families.js';
import { MASTER, PRIMARY_ACT, PRIMARY_MP, SECOND_ACT, SECOND_MP, openCharts } from './charts.js';
import { h, clear, icon, pct, shuffle, toast, missedBlock, backHead, backLinks } from './util.js';

export const ROWS = MASTER.filter(Boolean).map(([key, name, aug, stem, form, vowel, ends, para]) => ({ key, name, aug, stem, form, vowel, ends, para }));
const ENDSETS = [['prim-act', 'primary active', PRIMARY_ACT], ['prim-mp', 'primary middle/passive', PRIMARY_MP], ['sec-act', 'secondary active', SECOND_ACT], ['sec-mp', 'secondary middle/passive', SECOND_MP]];
const PERSON = { '1 sg': '1st person singular', '2 sg': '2nd person singular', '3 sg': '3rd person singular', '1 pl': '1st person plural', '2 pl': '2nd person plural', '3 pl': '3rd person plural' };
const ATTR_LABEL = { aug: 'Aug.', stem: 'Stem', form: 'Form.', vowel: 'Vowel', ends: 'Ends' };

/** Chart words in plain English: "aor act" → "aorist active". */
const SAY = { pres: 'present', fut: 'future', aor: 'aorist', perf: 'perfect', impf: 'imperfect', act: 'active', pas: 'passive', 'mid/pas': 'middle/passive', mid: 'middle', prim: 'primary', sec: 'secondary' };
export const say = (t) => t.replace(/\b(mid\/pas|pres|fut|aor|perf|impf|act|pas|mid|prim|sec)\b/g, (m) => SAY[m]);
const nice = (name) => { const t = say(name); return /^\d/.test(t) ? t : t.charAt(0).toLowerCase() + t.slice(1); };
const none = (v) => (v === '' || v === '–' ? 'none' : v);

/* ---------- the items ---------- */
export const squareId = (row, attr) => 'c:' + row + ':' + attr;
export const endingId = (set, person) => 'e:' + set + ':' + person.replace(' ', '');
const POOL = Object.fromEntries(CHART_ATTRS.map((a) => [a, [...new Set(ROWS.map((r) => r[a]))].map((v) => ({ v, label: a === 'ends' || a === 'stem' ? say(v) : none(v) }))]));
const ALL_ENDINGS = [...new Set(ENDSETS.flatMap(([, , t]) => t.map((r) => r[3])))];
/** Every item in the order they are introduced: a chart row at a time, then the personal endings. */
export const ITEMS = [
  ...ROWS.flatMap((r) => CHART_ATTRS.map((a) => ({ id: squareId(r.key, a), kind: 'square', row: r, attr: a }))),
  ...ENDSETS.flatMap(([set, title, table]) => table.map((p) => ({ id: endingId(set, p[0]), kind: 'ending', set, title, person: p[0], answer: p[3] }))),
];
const byId = new Map(ITEMS.map((i) => [i.id, i]));
export const stateOf = (id) => { const c = K.cards.get(id); return !c || c.state === 'new' ? 'new' : (c.state === 'review' && ((c.stability || 0) >= 7 || (c.reps || 0) >= 2) ? 'known' : 'shaky'); };

/* ---------- questions ---------- */
function question(it) {
  if (it.kind === 'ending') {
    const same = shuffle(ENDSETS.find(([s]) => s === it.set)[2].map((r) => r[3]).filter((e) => e !== it.answer));
    const others = shuffle(ALL_ENDINGS.filter((e) => e !== it.answer && !same.includes(e)));
    const wrong = [...new Set([...same, ...others])].slice(0, 3);
    return { ask: 'Which ending goes with', main: PERSON[it.person], sub: 'in the ' + it.title + ' endings?', right: it.answer, options: shuffle([it.answer, ...wrong]).map((v) => ({ v, label: none(v) })), greek: true,
      explain: 'The ' + it.title + ' endings: ' + PERSON[it.person] + ' takes ' + none(it.answer) + '.' };
  }
  const r = it.row, right = r[it.attr], pool = POOL[it.attr];
  const ask = { aug: 'What goes on the front (augment or reduplication) of the', stem: 'Which tense stem does the', form: 'Which tense formative does the', vowel: 'Which connecting vowel does the', ends: 'Which personal endings does the' }[it.attr];
  const wrong = shuffle(pool.filter((o) => o.v !== right)).slice(0, 3), mine = pool.find((o) => o.v === right);
  return { ask, main: nice(r.name), sub: it.attr === 'aug' ? '?' : it.attr === 'ends' ? 'take?' : 'use?', right, options: shuffle([mine, ...wrong]), greek: it.attr !== 'ends' && it.attr !== 'stem',
    explain: summary(r) };
}
/** One line saying everything the chart says about a row. */
export const summary = (r) => say(r.name).replace(/^./, (c) => c.toUpperCase()) + ': ' + (r.aug ? 'augment ' + r.aug : 'no augment') + ', ' + say(r.stem) + ' stem, ' + (r.form ? 'formative ' + r.form : 'no formative') + ', ' + (r.vowel ? 'connecting vowel ' + r.vowel : 'no connecting vowel') + ', ' + say(r.ends) + ' endings.';

/* ---------- a real example from the text ---------- */
const TAG = /^V-([12]?)([PIFARL])([AMPEDONQX]?)([IMSONP])(?:-([123])([SP]))?/;
const rowOfTag = (m) => {
  const x = TAG.exec(m || ''); if (!x || x[4] !== 'I') return null;
  const [, sec, t, v0] = x, v = v0 || 'X', act = 'AQX'.includes(v), s = sec === '2';
  switch (t) {
    case 'P': return act ? 'pres-act' : 'pres-mp';
    case 'I': return act ? 'impf-act' : 'impf-mp';
    case 'F': return 'PO'.includes(v) ? (s ? 'fut-pas2' : 'fut-pas1') : act ? 'fut-act' : 'fut-mid';
    case 'A': return 'PO'.includes(v) ? (s ? 'aor2-pas' : 'aor1-pas') : act ? (s ? 'aor2-act' : 'aor1-act') : (s ? 'aor2-mid' : 'aor1-mid');
    case 'R': return act ? (s ? 'perf2-act' : 'perf1-act') : 'perf-mp';
    default: return null;
  }
};
let examples = null;
/** The most frequent form of a chart row in the text (null for the liquid rows, which the morphology tags do not separate). */
export function exampleFor(key) {
  if (!examples) {
    examples = new Map();
    for (const f of D.forms) { const a = f.an[0]; const k = a && rowOfTag(a.m); if (!k) continue; const cur = examples.get(k); if (!cur || f.count > cur.count) examples.set(k, { w: f.w.replace(/­/g, ''), count: f.count }); }
  }
  const e = examples.get(key); return e ? e.w : null;
}

/* ---------- what to practice now ---------- */
export const NEW_PER_DAY = 8, SESSION = 20;
export function plan(now = clockNow()) {
  const due = chartCardsDue(now).filter((c) => byId.has(c.id)).sort((a, b) => a.due - b.due).map((c) => byId.get(c.id)).slice(0, SESSION);
  const fresh = ITEMS.filter((i) => stateOf(i.id) === 'new' && !K.cards.has(i.id));
  const left = K.cards.size && chartCardsDue(now).length > SESSION ? 0 : Math.max(0, NEW_PER_DAY - chartNewToday());
  const nw = fresh.slice(0, Math.min(left, Math.max(0, SESSION - due.length)));
  return { due, nw, fresh: fresh.length };
}
export const counts = () => { let known = 0, started = 0; for (const i of ITEMS) { const s = stateOf(i.id); if (s === 'known') known++; if (s !== 'new') started++; } return { known, started, total: ITEMS.length, due: chartCardsDue().filter((c) => byId.has(c.id)).length }; };

/* ---------- the session ---------- */
let keyHandler = null;
const stop = () => { if (keyHandler) { document.removeEventListener('keydown', keyHandler); keyHandler = null; } };
export function runDrill(view) {
  const { due, nw } = plan(), queue = shuffle([...due, ...nw].map((it) => ({ it, tries: 0 })));
  if (!queue.length) return renderChartsPage(view);
  const total = queue.length, S = { shown: 0, done: 0, good: 0, missed: [] };
  const finish = () => {
    stop();
    clear(view).append(h('div.pagehead', h('h1', 'Chart practice complete')),
      h('div.card.stack', h('div.kpis', h('div.kpi', h('b', S.done), h('span', 'squares done')), h('div.kpi', h('b', S.done ? pct(S.good / S.done) : '—'), h('span', 'right first time'))),
        missedBlock(S.missed.map((it) => { const q = question(it); return { word: q.main + ' ' + q.sub.replace('?', ''), greek: false, sub: it.kind === 'square' ? ATTR_LABEL[it.attr] : 'ending', why: null }; }), () => { const again = S.missed.map((it) => ({ it, tries: 1 })); S.missed = []; runList(again); }),
        h('div.row.wrap', h('a.btn.primary', { href: '#/learn/charts' }, 'Back to Charts'), ...backLinks('#/learn', 'Back to Learn'))));
  };
  const runList = (list) => { queue.length = 0; queue.push(...list); S.shown = 0; next(); };
  const next = () => { stop(); const c = queue.shift(); if (!c) return finish(); S.shown++; show(c); };
  const after = async (c, ok) => {
    if (c.tries === 0) {                                              // only the first try is recorded
      const lv = formLevel(); await rateChart(c.it.id, ok ? 3 : 1); S.done++; if (ok) S.good++; else S.missed.push(c.it);
      if (formLevel() > lv) toast('New kind of verb form open: ' + levelName(formLevel()) + '. Learning the chart opened it.', 10000);
    }
    if (!ok && c.tries === 0) queue.push({ it: c.it, tries: 1 });       // a first miss gets one more try before the end
    next();
  };
  function show(c) {
    const q = question(c.it), opts = h('div.opts'), tail = h('div');
    const card = h('div.qcard', h('div.qmeta', c.tries ? 'Try again' : (c.it.kind === 'square' ? 'Master verb chart' : 'Personal endings')), h('div.qask', q.ask), h('div.qgreek', { style: { fontSize: '1.5rem' } }, q.main), h('div.qask', q.sub));
    q.options.forEach((o) => opts.append(h('button.opt', { onclick: (ev) => {
      const right = o.v === q.right; [...opts.children].forEach((b, i) => { b.disabled = true; const isR = q.options[i].v === q.right; b.classList.toggle('right', isR); if (b === ev.currentTarget && !isR) b.classList.add('wrong'); b.querySelector('.mark').textContent = isR ? '✓' : (b === ev.currentTarget ? '✗' : ''); });
      const ex = c.it.kind === 'square' ? exampleFor(c.it.row.key) : null;
      const btn = h('button.btn.primary.block', { onclick: () => after(c, right) }, 'Continue');
      tail.append(h('div.fb.' + (right ? 'ok' : 'bad'), h('b', right ? 'Right.' : 'Not quite.'), ' ' + q.explain, ex ? h('div.small', { style: { marginTop: '.4rem' } }, 'Example from your text: ', h('span', { lang: 'grc' }, ex)) : null), btn);
      keyHandler = (e) => { if (e.key === 'Enter') { e.preventDefault(); btn.click(); } }; document.removeEventListener('keydown', keyHandler); document.addEventListener('keydown', keyHandler);
      tail.scrollIntoView({ block: 'nearest' });
    } }, h('span', q.greek ? { lang: 'grc' } : {}, o.label), h('span.mark', ''))));
    keyHandler = (e) => { const n = +e.key; if (!n) return; const b = [...view.querySelectorAll('.opt')].filter((x) => !x.disabled)[n - 1]; if (b) b.click(); }; document.addEventListener('keydown', keyHandler);
    clear(view).append(h('div.qwrap',
      h('div.qtop', h('button.btn.ghost.icon.sm', { 'aria-label': 'End practice', onclick: finish }, icon('close', 20)), h('div.bar.accent.grow', h('i', { style: { width: (100 * S.shown / total) + '%' } })), h('span.qcount', S.shown + ' / ' + total)),
      card, opts, tail));
  }
  next();
  return stop;
}

/* ---------- the page ---------- */
const square = (id, label) => h('i.sq.' + stateOf(id), { title: label });
export function renderChartsPage(view) {
  const c = counts(), p = plan();
  const sub = p.due.length || p.nw.length ? [p.due.length ? p.due.length + ' due' : null, p.nw.length ? p.nw.length + ' new' : null].filter(Boolean).join(' + ') : p.fresh ? 'Done for today' : 'All caught up';
  const start = p.due.length || p.nw.length ? h('a.btn.primary.block.start', { href: '#/learn/charts/run' }, h('b', 'Practice the verb chart'), h('small', sub)) : h('div.btn.block.start.done', h('b', 'Practice the verb chart'), h('small', sub));
  const head = h('div.sqrow.head', h('span'), CHART_ATTRS.map((a) => h('span', ATTR_LABEL[a])));
  const rows = [];
  for (const r of ROWS) rows.push(h('button.sqrow.rowbtn', { onclick: () => openCharts({ highlight: r.key }), 'aria-label': r.name + ': open the chart' }, h('span.rn', r.name), CHART_ATTRS.map((a) => square(squareId(r.key, a), r.name + ', ' + ATTR_LABEL[a]))));
  const ends = ENDSETS.map(([set, title, table]) => h('div.sqrow.e', h('span.rn', title.replace('middle/passive', 'mid/pas')), table.map((pp) => square(endingId(set, pp[0]), title + ', ' + pp[0]))));
  const gaps = [4, 10, 17]; gaps.reverse().forEach((i) => rows.splice(i, 0, h('div', { style: { height: '.35rem' } })));
  clear(view).append(backHead('Charts', '#/learn', 'Learn'), h('div.stack',
    start,
    h('div.row.wrap.links', h('button.btn.ghost.sm', { onclick: () => openCharts() }, icon('table', 18), ' Look at the chart'), h('button.btn.ghost.sm', { onclick: () => openCharts({ tab: 'part' }) }, 'Participle chart')),
    h('div.card.stack', h('div.row.between', h('h2', 'Master verb chart'), h('span.chip', c.known + ' of ' + c.total + ' known')),
      h('p.muted.small', 'Each square is one thing the chart says about a row. Tap a row to see the chart.'), head, ...rows,
      h('div.legend', h('span', h('i.sq.known', { style: { display: 'inline-block', width: '.8rem', height: '.8rem' } }), 'known'), h('span', h('i.sq.shaky', { style: { display: 'inline-block', width: '.8rem', height: '.8rem' } }), 'shaky'), h('span', h('i.sq.new', { style: { display: 'inline-block', width: '.8rem', height: '.8rem' } }), 'new'))),
    h('div.card.stack', h('h2', 'Personal endings'), h('p.muted.small', 'One square for each person, in each set of endings.'),
      h('div.sqrow.head.e', h('span'), ['1s', '2s', '3s', '1p', '2p', '3p'].map((t) => h('span', t))), ...ends),
    h('p.muted.small', 'Learning the chart also opens the matching kinds of verb form in Parsing.')));
}
