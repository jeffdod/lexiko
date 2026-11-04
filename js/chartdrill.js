// The master verb chart as something to learn: every square of the chart (what each row takes: augment, tense stem, tense formative,
// connecting vowel, endings) and every personal ending is a small scheduled card. Questions are multiple choice, in your chart's own words.
import { clockNow } from './clock.js';
import { D } from './data.js';
import { K, formLevel, rateChart, chartCardsDue } from './know.js';
import { CHART_ATTRS, levelName } from './families.js';
import { exampleForm, paradigm } from './paradigms.js';
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
/** The chart writes the reduplication for its model verb (λε- for λύω); in a real verb it is the verb's own first consonant + ε. */
const augLabel = (v) => (v === 'λε' ? 'first consonant + ε (reduplication)' : v);
const none = (v, word = 'none') => (v === '' || v === '–' ? word : v);      // 'nothing' answers "what goes on the front"

/* ---------- the items ---------- */
export const squareId = (row, attr) => 'c:' + row + ':' + attr;
export const endingId = (set, person) => 'e:' + set + ':' + person.replace(' ', '');
const POOL = Object.fromEntries(CHART_ATTRS.map((a) => [a, [...new Set(ROWS.map((r) => r[a]))].map((v) => ({ v, label: a === 'ends' || a === 'stem' ? say(v) : none(a === 'aug' ? augLabel(v) : v, a === 'aug' ? 'nothing' : 'none') }))]));
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
export const summary = (r) => say(r.name).replace(/^./, (c) => c.toUpperCase()) + ': ' + (r.aug === 'λε' ? 'reduplication: ' + augLabel(r.aug) : r.aug ? 'augment ' + r.aug : 'no augment') + ', ' + say(r.stem) + ' stem, ' + (r.form ? 'formative ' + r.form : 'no formative') + ', ' + (r.vowel ? 'connecting vowel ' + r.vowel : 'no connecting vowel') + ', ' + say(r.ends) + ' endings.';

/* ---------- a real example from the text ---------- */
export const exampleFor = exampleForm;

/* ---------- what to practice now ---------- */
export const SESSION = 20;
/** What a round holds: squares that are due first, then new ones to fill it. No daily limit and no pacing: practice as much as you like. */
export function plan(now = clockNow()) {
  const due = chartCardsDue(now).filter((c) => byId.has(c.id)).sort((a, b) => a.due - b.due).map((c) => byId.get(c.id)).slice(0, SESSION);
  const fresh = ITEMS.filter((i) => stateOf(i.id) === 'new' && !K.cards.has(i.id));
  return { due, nw: fresh.slice(0, Math.max(0, SESSION - due.length)), fresh: fresh.length };
}
export const counts = () => { let known = 0, started = 0; for (const i of ITEMS) { const s = stateOf(i.id); if (s === 'known') known++; if (s !== 'new') started++; } return { known, started, total: ITEMS.length, due: chartCardsDue().filter((c) => byId.has(c.id)).length }; };

/* ---------- the session ---------- */
let keyHandler = null;
const stop = () => { if (keyHandler) { document.removeEventListener('keydown', keyHandler); keyHandler = null; } };
export function runDrill(view, rowKey = null) {
  const { due, nw } = plan(), picks = rowKey ? ITEMS.filter((i) => i.kind === 'square' && i.row.key === rowKey) : [...due, ...nw];      // one row: all five of its squares
  const queue = shuffle(picks.map((it) => ({ it, tries: 0 })));
  if (!queue.length) return renderChartsPage(view);
  const total = queue.length, retryQ = [], S = { shown: 0, done: 0, good: 0, missed: [], round: 0, R: 0, rk: 0 };
  const finish = () => {
    stop();
    clear(view).append(h('div.pagehead', h('h1', 'Chart practice complete')),
      h('div.card.stack', h('div.kpis', h('div.kpi', h('b', S.done), h('span', 'squares done')), h('div.kpi', h('b', S.done ? pct(S.good / S.done) : '—'), h('span', 'right first time'))),
        missedBlock(S.missed.map((it) => { const q = question(it); return { word: q.main + ' ' + q.sub.replace('?', ''), greek: false, sub: it.kind === 'square' ? ATTR_LABEL[it.attr] : 'ending', why: null }; }), () => { const again = S.missed.map((it) => ({ it, tries: 1 })); S.missed = []; runList(again); }),
        h('div.row.wrap', h('a.btn.primary', { href: rowKey ? '#/learn/charts/paradigm/' + rowKey : '#/learn/charts' }, rowKey ? 'Back to the paradigm' : 'Back to Charts'), ...backLinks('#/learn', 'Back to Learn'))));
  };
  const runList = (list) => { queue.length = 0; queue.push(...list); S.shown = 0; S.round = 0; next(); };
  const next = () => {
    stop(); let c = queue.shift();
    if (!c && retryQ.length) { queue.push(...retryQ.splice(0)); S.round = 1; S.R = queue.length; S.rk = 0; c = queue.shift(); }   // missed squares come back in a retry round
    if (!c) return finish();
    if (S.round) S.rk++; else S.shown++;
    show(c);
  };
  const after = async (c, ok) => {
    if (c.tries === 0) {                                              // only the first try is recorded
      const lv = formLevel(); await rateChart(c.it.id, ok ? 3 : 1); S.done++; if (ok) S.good++; else S.missed.push(c.it);
      if (formLevel() > lv) toast('New kind of verb form open: ' + levelName(formLevel()) + '. Learning the chart opened it.', 10000);
    }
    if (!ok && c.tries === 0) retryQ.push({ it: c.it, tries: 1 });       // a first miss gets one more try, in a retry round after the last card
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
      h('div.qtop', h('button.btn.ghost.icon.sm', { 'aria-label': 'End practice', onclick: finish }, icon('close', 20)), h('div.bar.accent.grow', h('i', { style: { width: (100 * (S.round ? S.rk / S.R : S.shown / total)) + '%' } })), h('span.qcount', { 'aria-label': S.round ? 'Retry ' + S.rk + ' of ' + S.R : 'Card ' + S.shown + ' of ' + total }, S.round ? '↻ ' + S.rk + ' / ' + S.R : S.shown + ' / ' + total)),
      card, opts, tail));
  }
  next();
  return stop;
}

/* ---------- a paradigm for one row ---------- */
export function renderParadigm(view, key) {
  const r = ROWS.find((x) => x.key === key); if (!r) { location.hash = '#/learn/charts'; return; }
  const P = paradigm(key);
  const lines = P ? P.cells.map((c) => h('div.pline', h('span.plab', c.label),
    h('span.pword', { lang: 'grc' }, h('span.pstem', c.stem), h('b.pend', c.ending)), c.inText ? h('small.muted', { style: { marginLeft: '.6rem' } }, 'in the text') : null)) : [];
  clear(view).append(backHead('Paradigm', '#/learn/charts', 'Charts'), h('div.stack',
    h('div.row.wrap', h('span.chip.accent', say(r.name).replace(/^./, (c) => c.toUpperCase()) + ' indicative')),
    P ? h('div.card.stack', ...lines) : h('div.card', h('p', 'The text has no clear example of this row.')),
    P ? h('p.muted.small', h('b', 'Verb: '), h('span', { lang: 'grc' }, P.head), ' · ' + P.brief + '. ' + (P.attested === 6 ? 'All six forms occur in the text.' : P.attested + ' of 6 forms occur in the text; the rest are written out as the chart builds them.')) : null,
    h('p.small', summary(r)),
    h('div.row.wrap', h('a.btn.primary', { href: '#/learn/charts/run/' + key }, 'Practice this row'), h('button.btn', { onclick: () => openCharts({ highlight: key }) }, icon('table', 18), ' See it in the chart'))));
}

/* ---------- the page ---------- */
const square = (id, label) => h('i.sq.' + stateOf(id), { title: label });
export function renderChartsPage(view) {
  const c = counts(), p = plan();
  const sub = p.due.length || p.nw.length ? [p.due.length ? p.due.length + ' due' : null, p.nw.length ? p.nw.length + ' new' : null].filter(Boolean).join(' + ') : 'All caught up';
  const start = p.due.length || p.nw.length ? h('a.btn.primary.block.start', { href: '#/learn/charts/run' }, h('b', 'Practice the verb chart'), h('small', sub)) : h('div.btn.block.start.done', h('b', 'Practice the verb chart'), h('small', sub));
  const head = h('div.sqrow.head', h('span'), CHART_ATTRS.map((a) => h('span', ATTR_LABEL[a])));
  const rows = [];
  for (const r of ROWS) rows.push(h('div.sqrow', h('a.rn.rowlink', { href: '#/learn/charts/paradigm/' + r.key, 'aria-label': r.name + ': see its paradigm' }, r.name + ' ›'), CHART_ATTRS.map((a) => square(squareId(r.key, a), r.name + ', ' + ATTR_LABEL[a]))));
  const ends = ENDSETS.map(([set, title, table]) => h('div.sqrow.e', h('span.rn', title.replace('middle/passive', 'mid/pas')), table.map((pp) => square(endingId(set, pp[0]), title + ', ' + pp[0]))));
  const gaps = [4, 10, 17]; gaps.reverse().forEach((i) => rows.splice(i, 0, h('div', { style: { height: '.35rem' } })));
  clear(view).append(backHead('Charts', '#/learn', 'Learn'), h('div.stack',
    start,
    h('div.row.wrap.links', h('button.btn.ghost.sm', { onclick: () => openCharts() }, icon('table', 18), ' Look at the chart'), h('button.btn.ghost.sm', { onclick: () => openCharts({ tab: 'part' }) }, 'Participle chart')),
    h('div.card.stack', h('div.row.between', h('h2', 'Master verb chart'), h('span.chip', c.known + ' of ' + c.total + ' known')),
      h('p.muted.small', 'Each square is one thing the chart says about a row. Tap a row name to see its paradigm.'), head, ...rows,
      h('div.legend', h('span', h('i.sq.known', { style: { display: 'inline-block', width: '.8rem', height: '.8rem' } }), 'known'), h('span', h('i.sq.shaky', { style: { display: 'inline-block', width: '.8rem', height: '.8rem' } }), 'shaky'), h('span', h('i.sq.new', { style: { display: 'inline-block', width: '.8rem', height: '.8rem' } }), 'new'))),
    h('div.card.stack', h('h2', 'Personal endings'), h('p.muted.small', 'One square for each person, in each set of endings.'),
      h('div.sqrow.head.e', h('span'), ['1s', '2s', '3s', '1p', '2p', '3p'].map((t) => h('span', t))), ...ends),
    h('p.muted.small', 'Learning the chart also opens the matching kinds of verb form in Parsing.')));
}
