// Recognizing a verb form: four rules that let you read a form from the outside in (prefix, endings, formative, connecting vowel),
// a short lesson for each, and a guided drill that asks the questions in that order. Tier 1 uses the regular forms of the master
// verb chart; Tier 2 adds the disguises (a preposition before the augment, a lengthened vowel, contraction). The forms are the
// chart's own paradigms plus a few well-known examples, not forms from the text, because the point is the rules.
import { paradigm } from './paradigms.js';
import { MASTER, PRIMARY_ACT, PRIMARY_MP, SECOND_ACT, SECOND_MP, openCharts } from './charts.js';
import { K, noteRec, recForm, recT2Open, openRecT2, recGate } from './know.js';
import { h, clear, icon, pct, shuffle, backHead, backLinks } from './util.js';

/* ---------- what each row of the chart looks like ---------- */
const SETS = { 'prim act': 'prim-act', 'prim mid/pas': 'prim-mp', 'sec act': 'sec-act', 'sec mid/pas': 'sec-mp' };
const TABLE = { 'prim-act': PRIMARY_ACT, 'prim-mp': PRIMARY_MP, 'sec-act': SECOND_ACT, 'sec-mp': SECOND_MP };
const FM = { 'pres-act': 'none', 'pres-mp': 'none', 'impf-act': 'none', 'impf-mp': 'none', 'fut-act': 's', 'fut-mid': 's', 'fut-pas1': 'ths', 'fut-pas2': 'ths', 'aor1-act': 'a', 'aor-liq-act': 'a', 'aor2-act': 'none',
  'aor1-mid': 'a', 'aor2-mid': 'none', 'aor1-pas': 'th', 'aor2-pas': 'th', 'perf1-act': 'k', 'perf2-act': 'k', 'perf-mp': 'none' };
const RES = { 'pres-act': 'present active', 'pres-mp': 'present middle/passive', 'impf-act': 'imperfect active', 'impf-mp': 'imperfect middle/passive', 'fut-act': 'future active', 'fut-mid': 'future middle',
  'fut-pas1': 'future passive', 'fut-pas2': 'future passive', 'aor1-act': 'aorist active', 'aor-liq-act': 'aorist active', 'aor2-act': 'aorist active', 'aor1-mid': 'aorist middle', 'aor2-mid': 'aorist middle',
  'aor1-pas': 'aorist passive', 'aor2-pas': 'aorist passive', 'perf1-act': 'perfect active', 'perf2-act': 'perfect active', 'perf-mp': 'perfect middle/passive', 'fut-liq-act': 'future active', 'fut-liq-mid': 'future middle' };
const NAMES = [...new Set(Object.values(RES))];
const TIER2_ROWS = new Set(['fut-liq-act', 'fut-liq-mid', 'fut-pas2']);          // contraction and a preposition: Tier 2

export const tier1 = () => {
  const out = [];
  for (const r of MASTER.filter(Boolean)) {
    const [key, , aug, , , vowel, ends] = r; if (TIER2_ROWS.has(key)) continue;
    const P = paradigm(key); if (!P) continue; const set = SETS[ends], pre = /^perf/.test(key) ? 'red' : aug === 'ε' ? 'aug' : 'none';
    P.cells.forEach((c, i) => out.push({ key, w: c.word, pre, set, fm: FM[key], v: vowel === 'ο/ε' ? TABLE[set][i][2] : 'none', res: RES[key] }));
  }
  return out;
};

/** Tier 2: forms that disguise a piece. Each carries a note saying how. */
const TIER2 = [
  { w: 'ἀπέλυσα', pre: 'aug', set: 'sec-act', fm: 'a', v: 'none', res: 'aorist active', note: 'The augment ε sits between the preposition ἀπο- and the stem, and the ο of the preposition drops.' },
  { w: 'ἀπέστειλα', pre: 'aug', set: 'sec-act', fm: 'a', v: 'none', res: 'aorist active', note: 'The augment sits after the preposition ἀπο- (its ο drops). The liquid stem also changes (ε becomes ει), and the formative is α with no σ.' },
  { w: 'ἐξέβαλον', pre: 'aug', set: 'sec-act', fm: 'none', v: 'ο', res: 'aorist active', note: 'The augment sits after the preposition ἐκ-, which becomes ἐξ- before a vowel. There is no formative: a 2nd aorist.' },
  { w: 'ἀπεκρίθην', pre: 'aug', set: 'sec-act', fm: 'th', v: 'none', res: 'aorist passive', note: 'The augment sits after the preposition ἀπο- (its ο drops).' },
  { w: 'ἤκουσα', pre: 'aug', set: 'sec-act', fm: 'a', v: 'none', res: 'aorist active', note: 'The stem begins with a vowel, so the augment lengthens it: α becomes η.' },
  { w: 'ἤκουον', pre: 'aug', set: 'sec-act', fm: 'none', v: 'ο', res: 'imperfect active', note: 'The stem begins with a vowel, so the augment lengthens it: α becomes η.' },
  { w: 'ἀγαπᾷς', pre: 'none', set: 'prim-act', fm: 'none', v: 'contr', res: 'present active', note: 'ἀγαπάω is a contract verb: the α at the end of the stem merges with the connecting vowel (α + ε becomes ᾳ).' },
  { w: 'ἀγαπῶμεν', pre: 'none', set: 'prim-act', fm: 'none', v: 'contr', res: 'present active', note: 'The α at the end of the stem merges with the connecting vowel (α + ο becomes ω).' },
  { w: 'ἠγάπων', pre: 'aug', set: 'sec-act', fm: 'none', v: 'contr', res: 'imperfect active', note: 'Two disguises: the augment lengthens the initial α to η, and the stem’s α merges with the connecting vowel (α + ο becomes ω).' },
  { w: 'ποιεῖς', pre: 'none', set: 'prim-act', fm: 'none', v: 'contr', res: 'present active', note: 'ποιέω is a contract verb: the ε at the end of the stem merges with the connecting vowel (ε + ει becomes ει).' },
  { w: 'ποιοῦμεν', pre: 'none', set: 'prim-act', fm: 'none', v: 'contr', res: 'present active', note: 'The ε at the end of the stem merges with the connecting vowel (ε + ο becomes ου).' },
  { w: 'ἐποίουν', pre: 'aug', set: 'sec-act', fm: 'none', v: 'contr', res: 'imperfect active', note: 'The augment ε is in front, and the stem’s ε merges with the connecting vowel (ε + ο becomes ου).' },
  { w: 'πληροῦτε', pre: 'none', set: 'prim-act', fm: 'none', v: 'contr', res: 'present active', note: 'πληρόω is a contract verb: the ο at the end of the stem merges with the connecting vowel (ο + ε becomes ου).' },
  { w: 'μενεῖς', pre: 'none', set: 'prim-act', fm: 's', v: 'contr', res: 'future active', note: 'A liquid future: its formative εσ contracts with the connecting vowel, so no σ is visible.' },
  { w: 'μενεῖται', pre: 'none', set: 'prim-mp', fm: 's', v: 'contr', res: 'future middle', note: 'A liquid future: its formative εσ contracts with the connecting vowel, so no σ is visible.' },
  { w: 'ἀποσταλήσομαι', pre: 'none', set: 'prim-mp', fm: 'ths', v: 'ο', res: 'future passive', note: 'ἀπο- is a preposition that belongs to the verb, not an augment. A future has no prefix.' },
];

/* ---------- the questions, in order ---------- */
const OPT = {
  prefix: [['none', 'Nothing'], ['aug', 'ε (augment)'], ['red', 'Reduplication (consonant + ε)']],
  endings: [['prim-act', 'Primary active'], ['prim-mp', 'Primary middle/passive'], ['sec-act', 'Secondary active'], ['sec-mp', 'Secondary middle/passive']],
  formative: [['none', 'Nothing (just a connecting vowel)'], ['s', 'σ'], ['a', 'σα or α'], ['th', 'θη or η'], ['ths', 'θησ or ησ'], ['k', 'κα or α']],
  vowel: [['ο', 'ο'], ['ε', 'ε'], ['none', 'None']],
};
const WHY = {
  prefix: { none: 'No prefix: a present or a future.', aug: 'An ε augment: a past tense, imperfect or aorist.', red: 'A reduplication (consonant + ε): a perfect.' },
  endings: { 'prim-act': 'Primary endings carry an ι or αι. These are active (-ω, -εις, -ει, -ουσι).', 'prim-mp': 'Primary endings carry an ι or αι. These are middle/passive (-μαι, -σαι, -ται, -νται).',
    'sec-act': 'Secondary endings have no ι or αι. These are active (-ν, -ς, nothing, -μεν, -τε).', 'sec-mp': 'Secondary endings have no ι or αι. These are middle/passive (-μην, -σο, -το, -ντο).' },
  formative: { none: 'Nothing sits between the stem and the ending but a connecting vowel.', s: 'σ marks a future (with no augment).', a: 'σα (or α) marks an aorist active or middle, with an augment in front.',
    th: 'θη (or η) marks an aorist passive, with an augment in front.', ths: 'θησ (or ησ) marks a future passive, with no augment.', k: 'κα (or α) marks a perfect active, with a reduplication in front.' },
  vowel: { 'ο': 'ο before μ or ν.', 'ε': 'ε everywhere else.', none: 'No connecting vowel: the formative stands in its place (or the form has none).', contr: 'The connecting vowel merged with the last vowel of the stem (see Contractions).' },
};
export const STEPS = [
  { id: 'prefix', n: 1, title: 'Prefix', ask: 'What comes before the stem?', pick: (it) => it.pre },
  { id: 'endings', n: 2, title: 'Endings', ask: 'Which set of personal endings?', pick: (it) => it.set },
  { id: 'formative', n: 3, title: 'Formative', ask: 'What sits between the stem and the ending?', pick: (it) => it.fm },
  { id: 'vowel', n: 4, title: 'Connecting vowel', ask: 'Which connecting vowel?', pick: (it) => it.v },
  { id: 'name', n: 5, title: 'Name it', ask: 'What is it?', pick: (it) => it.res },
];
const optionsFor = (st, it, tier) => {
  if (st.id === 'name') { const wrong = shuffle(NAMES.filter((n) => n !== it.res)).slice(0, 3); return shuffle([it.res, ...wrong]).map((n) => [n, n.replace(/^./, (c) => c.toUpperCase())]); }
  const base = OPT[st.id]; return st.id === 'vowel' && tier === 2 ? [...base, ['contr', 'Merged with the stem’s last vowel']] : base;
};
const explain = (st, it, ans) => st.id === 'name' ? 'Put together: ' + it.res + '.' : WHY[st.id][ans];
const label = (st, ans) => st.id === 'name' ? ans : (OPT[st.id].find((o) => o[0] === ans) || [0, ans === 'contr' ? 'Merged' : ans])[1];

/* ---------- the lessons ---------- */
const lg = (t) => h('span', { lang: 'grc' }, t);
export const RULES = [
  { id: 'prefix', title: 'The prefix', lead: 'Look before the stem. The prefix tells you the time of the action.',
    rows: [['No prefix', 'present or future'], ['ε (augment)', 'past: imperfect or aorist'], ['Consonant + ε (reduplication)', 'perfect']], ex: [['λύω', 'present'], ['ἔλυον', 'imperfect'], ['λέλυκα', 'perfect']],
    link: 'An augment goes with secondary endings, which have no ι or αι. The perfect is the exception: it has a prefix but takes primary endings.' },
  { id: 'endings', title: 'The personal endings', lead: 'Primary endings carry an ι or αι. Secondary endings do not.',
    rows: [['Primary', 'present, future, perfect: -ω, -εις, -ει · -μαι, -σαι, -ται'], ['Secondary', 'imperfect, aorist: -ν, -ς, nothing · -μην, -σο, -το']], ex: [['λύεις', 'primary active'], ['ἔλυες', 'secondary active'], ['λύεται', 'primary middle/passive'], ['ἐλύετο', 'secondary middle/passive']],
    link: 'Active or middle/passive? In the plural, a θ marks the middle/passive (-μεθα, -σθε), where the active has -μεν and -τε. In the singular and the 3rd plural, the middle/passive endings are -μαι/-μην, -σαι/-σο, -ται/-το, -νται/-ντο.' },
  { id: 'formative', title: 'The tense formative', lead: 'Look between the stem and the ending. The formative names the tense and voice.',
    rows: [['σ', 'future (no augment)'], ['σα or α', 'aorist active/middle (with an augment)'], ['θη or η', 'aorist passive (with an augment)'], ['θησ or ησ', 'future passive (no augment)'], ['κα or α', 'perfect active (with a reduplication)'], ['nothing', 'present, imperfect, 2nd aorist, perfect middle/passive']],
    ex: [['λύσω', 'future'], ['ἔλυσα', 'aorist'], ['ἐλύθην', 'aorist passive'], ['λυθήσομαι', 'future passive'], ['λέλυκα', 'perfect']],
    link: 'The prefix and the formative together name nearly every tense and voice.' },
  { id: 'vowel', title: 'The connecting vowel', lead: 'Where there is one, it is ο before μ or ν, and ε everywhere else.',
    rows: [['Present, imperfect, future, 2nd aorist', 'have a connecting vowel'], ['1st aorist', 'α in the formative takes its place'], ['Passive aorists and the perfect', 'have none']], ex: [['λύομεν', 'ο before μ'], ['λύετε', 'ε elsewhere'], ['λύουσι', 'ο before ν']],
    link: 'This rule confirms the others. It matters most for the present, imperfect, future and 2nd aorist.' },
];
export const TIER2_RULE = { id: 'disguise', title: 'Disguised forms', lead: 'The same rules apply, but a piece can be hidden.',
  rows: [['A preposition before the augment', 'the augment sits between the preposition and the stem (ἀπο- + ε + stem), and the preposition’s final vowel may drop'], ['A vowel-initial stem', 'the augment lengthens the first vowel (α becomes η, ε becomes η, ο becomes ω)'], ['Contraction', 'the connecting vowel merges with the last vowel of the stem in contract verbs, and in the liquid future']],
  ex: [['ἀπέλυσα', 'augment after a preposition'], ['ἤκουσα', 'lengthened augment'], ['ποιοῦμεν', 'contracted']], link: 'The Contractions tab in the charts shows what merges with what.' };

const lessonCard = (r) => h('div.card.stack',
  h('p', { style: { fontSize: '1.05rem' } }, h('b', r.lead.split('. ')[0] + '. '), r.lead.split('. ').slice(1).join('. ')),
  h('div.stack', { style: { gap: '.5rem' } }, ...r.rows.map(([a, b]) => h('div.row', { style: { justifyContent: 'space-between', gap: '1rem', alignItems: 'flex-start' } }, h('span', h('b', { lang: /[α-ω]/.test(a) ? 'grc' : 'en' }, a)), h('span.muted', { style: { textAlign: 'right' } }, b)))),
  r.ex ? h('div.small.muted', 'Examples: ', ...r.ex.flatMap(([w, d], i) => [i ? ' · ' : '', lg(w), ' (' + d + ')'])) : null,
  h('div.fb', { style: { borderColor: 'var(--accent)' } }, h('b', r.id === 'disguise' ? 'Tip' : 'Link to the next rule'), h('div.small', r.link)));

/** The list of lessons, or one lesson. */
export function renderRules(view, which = null) {
  const open = recT2Open();
  if (which) {
    const r = which === 'disguise' ? TIER2_RULE : RULES.find((x) => x.id === which); if (!r) { location.hash = '#/learn/charts/rules'; return; }
    const i = RULES.indexOf(r), t2 = r === TIER2_RULE, next = t2 ? null : RULES[i + 1] || TIER2_RULE;
    clear(view).append(backHead(t2 ? 'Tier 2 · ' + r.title : 'Rule ' + (i + 1) + ' · ' + r.title, '#/learn/charts/rules', 'Rules'), h('div.stack', lessonCard(r),
      h('div.row.wrap', t2 ? (open ? h('a.btn.primary', { href: '#/learn/charts/recognize/2' }, 'Practice Tier 2') : h('a.btn', { href: '#/learn/charts/rules' }, 'Tier 2 opens after Tier 1'))
        : h('a.btn.primary', { href: '#/learn/charts/recognize/rule/' + r.id }, 'Practice this rule'), next ? h('a.btn', { href: '#/learn/charts/rules/' + next.id }, 'Next: ' + next.title) : null)));
    return;
  }
  clear(view).append(backHead('Recognize a verb form', '#/learn/charts', 'Charts'), h('div.stack',
    h('p.muted', 'Four rules let you read a verb form from the outside in. Learn them one at a time, then practice with all four together.'),
    h('div.card.stack', ...RULES.map((r, i) => h('a.row.between', { href: '#/learn/charts/rules/' + r.id, style: { textDecoration: 'none', color: 'inherit', padding: '.3rem 0', gap: '1rem' } }, h('span', h('b', 'Rule ' + (i + 1) + ' · '), r.title), h('span.muted', '›'))),
      h('a.btn.primary.block', { href: '#/learn/charts/recognize' }, 'Practice all four rules')),
    h('div.card.stack', h('div.row.between', h('h3', { style: { margin: 0 } }, 'Tier 2 · ' + TIER2_RULE.title), h('span.chip', open ? 'Open' : 'Locked')), h('div.small.muted', TIER2_RULE.lead + ' Opens when Tier 1 is solid (about 85% over your last 20 steps).'),
      h('div.row.wrap', h('a.btn', { href: '#/learn/charts/rules/disguise' }, 'Read the rule'), open ? h('a.btn.primary', { href: '#/learn/charts/recognize/2' }, 'Practice Tier 2') : h('button.btn', { onclick: async () => { await openRecT2(); renderRules(view); } }, 'Open it now'))),
    h('div.row.wrap', h('button.btn.ghost.sm', { onclick: () => openCharts({ tab: 'contr' }) }, icon('table', 18), ' Contractions chart'))));
}

/* ---------- the drill ---------- */
const ROUND = 8, ONLY = 12;
let keyHandler = null;
const stop = () => { if (keyHandler) { document.removeEventListener('keydown', keyHandler); keyHandler = null; } };
const chip = (k, v) => h('span.chip', { style: { margin: '.15rem .2rem 0 0' } }, h('span.muted', { style: { marginRight: '.3rem' } }, k), h('b', v));
export function runRecognize(view, { tier = 1, only = null } = {}) {
  if (tier === 2 && !recT2Open()) { location.hash = '#/learn/charts/rules'; return; }
  const pool = tier === 2 ? TIER2 : tier1();
  const pick = () => {
    if (tier === 2) return shuffle(pool).slice(0, ROUND);
    const byRow = new Map(); for (const it of pool) (byRow.get(it.key) || byRow.set(it.key, []).get(it.key)).push(it);
    return shuffle([...byRow.keys()]).slice(0, only ? ONLY : ROUND).map((k) => { const a = byRow.get(k); return a[Math.floor(Math.random() * a.length)]; });
  };
  const steps = only ? STEPS.filter((s) => s.id === only) : STEPS, queue = pick().map((it) => ({ it, retry: false })), total = queue.length, retryQ = [];
  const S = { shown: 0, round: 0, R: 0, rk: 0, by: Object.fromEntries(STEPS.map((s) => [s.id, [0, 0]])), formsRight: 0, forms: 0 };
  const finish = async () => {
    stop(); const all = Object.values(S.by).reduce((a, [r, n]) => [a[0] + r, a[1] + n], [0, 0]), weak = STEPS.filter((s) => S.by[s.id][1]).sort((a, b) => S.by[a.id][0] / S.by[a.id][1] - S.by[b.id][0] / S.by[b.id][1])[0];
    const bars = STEPS.filter((s) => S.by[s.id][1]).map((s) => { const [r, n] = S.by[s.id], p = Math.round(100 * r / n); return h('div', { style: { display: 'grid', gridTemplateColumns: '8.5rem 1fr 3rem', gap: '.6rem', alignItems: 'center', margin: '.4rem 0' } }, h('span', s.n + ' · ' + s.title), h('div.bar', h('i', { style: { width: p + '%', background: p < 70 ? 'var(--warn)' : 'var(--accent)' } })), h('b', { style: { textAlign: 'right' } }, p + '%')); });
    const open = recT2Open(), g = recGate();
    clear(view).append(h('div.pagehead', h('h1', 'Recognize a verb form')), h('div.stack',
      h('div.card.stack', h('div.kpis', h('div.kpi', h('b', S.forms), h('span', 'forms')), h('div.kpi', h('b', all[1] ? pct(all[0] / all[1]) : '—'), h('span', 'steps right'))),
        bars.length ? h('h3', { style: { margin: '.2rem 0 0' } }, only ? 'This rule' : 'By rule') : null, ...bars,
        weak && !only && weak.id !== 'name' && S.by[weak.id][0] < S.by[weak.id][1] ? h('div.small.muted', 'Weakest: ', h('b', 'Rule ' + weak.n + ' · ' + weak.title), '. ', h('a', { href: '#/learn/charts/rules/' + weak.id, style: { color: 'var(--accent)' } }, 'Review the rule')) : null),
      tier === 1 && !only ? h('div.card.stack', h('div.row.between', h('h3', { style: { margin: 0 } }, 'Tier 2 · Disguised forms'), h('span.chip', open ? 'Open' : 'Locked')),
        h('div.small.muted', 'A preposition before the augment, lengthened vowels, contractions. ' + (open ? 'It is open.' : g.ok ? 'Tier 1 is solid, so it is open now.' : 'Opens when Tier 1 is solid (about 85% over 20 steps; yours is ' + (g.n >= 5 ? pct(g.acc) + ' over ' + g.n : 'too new to tell') + ').')),
        open || g.ok ? h('a.btn.primary.block', { href: '#/learn/charts/recognize/2' }, 'Practice Tier 2') : h('button.btn.block', { onclick: async () => { await openRecT2(); location.hash = '#/learn/charts/recognize/2'; } }, 'Open it now')) : null,
      h('div.row.wrap', h('button.btn.primary', { onclick: () => runRecognize(view, { tier, only }) }, 'Practice again'), h('a.btn', { href: '#/learn/charts' }, 'Back to Charts'), ...backLinks('#/learn', 'Back to Learn'))));
    if (tier === 1 && !only && g.ok && !recT2Open()) await openRecT2();
  };
  const next = () => {
    stop(); let c = queue.shift();
    if (!c && retryQ.length) { queue.push(...retryQ.splice(0)); S.round = 1; S.R = queue.length; S.rk = 0; c = queue.shift(); }
    if (!c) return finish();
    if (S.round) S.rk++; else S.shown++;
    showForm(c);
  };
  function showForm(c) {
    const it = c.it, done = []; let si = 0, missed = false;
    const render = () => {
      const st = steps[si], right = st.pick(it), choices = optionsFor(st, it, tier), opts = h('div.opts'), tail = h('div'), chips = h('div', { style: { marginBottom: '.4rem' } }, ...done.map(([k, v]) => chip(k, v)));
      const card = h('div.qcard', h('div.qmeta', (c.retry ? 'Try again · ' : '') + (tier === 2 ? 'Tier 2 · ' : '') + 'Recognize a verb form'), chips, h('div.qgreek', { lang: 'grc', style: { fontSize: '2.2rem', letterSpacing: '.02em' } }, it.w),
        h('div.qask', 'Step ' + (only ? '' : st.n + ' · ') + st.title), h('div.qask', { style: { fontSize: '1rem' } }, st.ask));
      choices.forEach(([v, text]) => opts.append(h('button.opt', { 'data-v': v, onclick: async (ev) => {
        const ok = v === right; [...opts.children].forEach((b) => { b.disabled = true; }); const mine = ev.currentTarget; [...opts.children].forEach((b) => { const isR = b.dataset.v === right; b.classList.toggle('right', isR); if (b === mine && !isR) b.classList.add('wrong'); });
        if (!c.retry) { S.by[st.id][1]++; if (ok) S.by[st.id][0]++; await noteRec(st.id, ok, tier); } if (!ok) missed = true;
        const last = si === steps.length - 1, btn = h('button.btn.primary.block', { onclick: () => { stop(); if (last) end(); else { done.push([st.title, label(st, right)]); si++; render(); } } }, last ? 'Continue' : 'Next step');
        tail.append(h('div.fb.' + (ok ? 'ok' : 'bad'), h('b', ok ? 'Right.' : 'Not quite.'), ' ' + explain(st, it, right), it.note && (last || st.id !== 'name') && (!ok || last) ? h('div.small', { style: { marginTop: '.4rem' } }, it.note) : null,
          last ? h('div', { style: { marginTop: '.3rem' } }, ...done.map(([k, v]) => chip(k, v)), chip(st.title, label(st, right))) : null), btn);
        keyHandler = (e) => { if (e.key === 'Enter') { e.preventDefault(); btn.click(); } }; document.addEventListener('keydown', keyHandler); tail.scrollIntoView({ block: 'nearest' });
      } }, h('span', { lang: /[α-ω]/.test(text) ? 'grc' : 'en' }, text), h('span.mark', ''))));
      keyHandler = (e) => { const n = +e.key; if (!n) return; const b = [...view.querySelectorAll('.opt')].filter((x) => !x.disabled)[n - 1]; if (b) b.click(); }; document.addEventListener('keydown', keyHandler);
      clear(view).append(h('div.qwrap', h('div.qtop', h('button.btn.ghost.icon.sm', { 'aria-label': 'End practice', onclick: finish }, icon('close', 20)),
        h('div.bar.accent.grow', h('i', { style: { width: (100 * (S.round ? S.rk / S.R : (S.shown - 1 + (si + 1) / steps.length) / total)) + '%' } })),
        h('span.qcount', { 'aria-label': S.round ? 'Retry ' + S.rk + ' of ' + S.R : 'Form ' + S.shown + ' of ' + total }, S.round ? '↻ ' + S.rk + ' / ' + S.R : S.shown + ' / ' + total)), card, opts, tail));
    };
    const end = async () => { if (!c.retry) { S.forms++; if (!missed) S.formsRight++; await recForm(); } if (missed && !c.retry && !only) retryQ.push({ it, retry: true }); next(); };
    render();
  }
  next();
  return stop;
}
