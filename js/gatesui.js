// The screens of the gating: the Unlock list on Parsing, a page per kind of form, the "Choose forms" checklist, the how-to screen, and the verb question.
import { K, setGate, setGates, gateOpen, verbsOn, openGateKeys, chartRowKnown, chartRowSquares, gateStats, passNeed, verbAskDue, noteVerbAsk, FAM_ACC, nominalState, setNominals } from './know.js';
import { CHART_ATTRS } from './families.js';
import { ROWS, plan as chartPlan } from './chartdrill.js';
import { FAMILIES, FAMILY, ROW_KEYS, kindName, allGateKeys } from './kinds.js';
import { poolOf } from './gatenote.js';
import { h, clear, icon, fold, backHead, toast } from './util.js';
import { setSetting } from './know.js';

const rowName = (r) => { const x = ROWS.find((q) => q.key === r); return x ? x.name || x.title || r : r; };
const chip = (on) => h(on ? 'span.chip.good' : 'span.chip', on ? 'Open' : 'Locked');
const sq = (n) => n + (n === 1 ? ' square' : ' squares');
const nOpen = (f) => f.kinds.filter((k) => gateOpen(f.id + ':' + k.key)).length;

export async function turnOnVerbs() { await setGate('verbs', true); }
async function turnOn(go = true) { await turnOnVerbs(); if (go) location.hash = '#/parse/howto'; }

/** On the Parsing page: the "Turn on verb parsing" card while verbs are off, otherwise the unlock list. */
export function unlockSection() {
  if (!verbsOn()) return h('div.card.stack', h('h2', 'Verb parsing'),
    h('p.muted.small', nominalState() === 'off' ? 'Daily parsing has nothing to ask yet: nouns, adjectives and pronouns are off. Turn on verbs when you are ready to parse them. Present active comes first.' : 'Daily parsing now asks about nouns, adjectives and other words you know. Turn on verbs when you are ready to parse them too. Present active comes first.'),
    h('div.row', h('button.btn.primary', { onclick: () => turnOn() }, 'Turn on verb parsing')));
  const p = chartPlan(), n = p.due.length + p.nw.length, rows = ROW_KEYS.filter((r) => gateOpen('row:' + r)).length;
  const row = (href, t, sub) => h('a.li', { href, style: { gap: '.7rem' } }, h('span.grow', h('b', t), h('div.muted.small', sub)), icon('chevR', 18));
  return h('div.stack',
    h('div.sec', 'Unlock verb forms'),
    h('p.muted.small', 'Present active is already on. Pass a drill to start getting that type of verb form in your daily parsing.'),
    h('div.list',
      row('#/parse/kinds/ind', 'Indicative', rows + ' of ' + ROW_KEYS.length + ' rows open' + (n ? ', ' + (p.due.length ? sq(p.due.length) + ' to review' : sq(p.nw.length) + ' new') : '')),
      ...FAMILIES.map((f) => row('#/parse/kinds/' + f.id, f.name, nOpen(f) + ' of ' + f.kinds.length + ' kinds open')),
      row('#/parse/gates', 'Choose forms', 'Tick or untick any type of verb form, or whole groups at once')));
}

const longName = (n) => n.replace('mid/pas', 'middle/passive').replace(/\bfut\b/, 'future').replace(/\bact\b/, 'active').replace(/\bmid\b/, 'middle').replace(/\bpas\b/, 'passive').replace(/^./, (c) => c.toUpperCase());
const TENSES = [['pres', 'Present'], ['impf', 'Imperfect'], ['fut', 'Future'], ['aor', 'Aorist'], ['perf', 'Perfect']];
/** The indicative: the rows of the master verb chart, grouped by tense; a row opens when its squares are learned. */
export function renderRows(view) {
  const p = chartPlan(), due = p.due.length;
  clear(view).append(backHead('Indicative', '#/parse', 'Parsing'), h('div.stack',
    h('p.muted.small', 'A row opens in daily parsing when you have learned its squares on the master verb chart. Present active is always open.'),
    h('div.row.wrap', h('a.btn.primary', { href: '#/learn/charts/run' }, 'Drill all rows' + (due ? ' (' + sq(due) + ' to review)' : '')), h('a.btn', { href: '#/parse/run/open/ind' }, 'Parse open rows'), h('a.btn.ghost', { href: '#/learn/charts' }, 'Study the chart')),
    ...TENSES.flatMap(([pre, title]) => {
      const rs = ROWS.filter((r) => r.key.startsWith(pre));
      return rs.length ? [h('div.sec', title), h('div.list', rs.map((r) => {
        const on = gateOpen('row:' + r.key), got = chartRowSquares(r.key);
        return h('div.li', { style: { gap: '.7rem' } }, h('span.grow', h('b', longName(r.name)), h('div.muted.small', on ? 'Open in daily parsing' : got + ' of ' + CHART_ATTRS.length + ' learned')),
          chip(on), h('a.btn.sm', { href: '#/learn/charts/run/' + r.key }, 'Drill'), h('a.btn.sm', { href: '#/parse/run/row/' + r.key }, 'Parse'));
      }))] : [];
    })));
}

/** One family: its kinds, each open or locked, with a drill. */
export function renderKinds(view, id) {
  const f = FAMILY[id]; if (!f) { location.hash = '#/parse'; return; }
  const base = '#/learn/charts/' + f.path + '/run';
  clear(view).append(backHead(f.name, '#/parse', 'Parsing'), h('div.stack',
    h('p.muted.small', 'A kind opens in daily parsing when you pass its “Which kind is it?” drill: about ' + Math.round(FAM_ACC * 100) + '% right over your last 20 answers.'),
    h('div.row.wrap', h('a.btn.primary', { href: base }, 'Drill all kinds'), h('a.btn', { href: '#/parse/run/' + f.id + '/all' }, 'Parse open kinds'), h('a.btn.ghost', { href: f.study }, 'Study ' + f.name.toLowerCase())),
    h('div.list', f.kinds.map((k) => {
      const key = f.id + ':' + k.key, on = gateOpen(key), s = gateStats(key), need = passNeed(poolOf(f.id, k.key));
      return h('div.li', { style: { gap: '.7rem' } }, h('span.grow', h('b', k.name), h('div.muted.small', on ? 'Open in daily parsing' : s.n >= need ? 'Not quite yet: ' + Math.round(s.acc * 100) + '%' : s.n + ' of ' + need + ' answers')),
        chip(on), f.id === 'inf' ? null : h('a.btn.sm', { href: base + '/' + k.key }, 'Drill'));
    }))));
}

const NOM_SUB = { on: 'Asked once you know the word', thin: 'Check-ins only: you answer these reliably', off: 'Not asked. Your progress on these forms is kept.' };
/** The row that switches nouns, adjectives and pronouns on or off in parsing. Unticking stops them in the daily quiz and in free practice. */
function nominalsRow(redraw) {
  const st = nominalState(), cb = h('input', { type: 'checkbox', checked: st !== 'off', onchange: async () => { await setNominals(cb.checked); redraw(); } });
  return h('label.li', { style: { gap: '.7rem', cursor: 'pointer' } }, cb, h('span.grow', h('span', 'Nouns, adjectives and pronouns'), h('div.muted.small', NOM_SUB[st])));
}

/** The advanced checklist. Ticking opens a gate without a drill; unticking closes it. Progress is kept either way. */
export function renderGates(view) {
  const draw = () => {
    const box = (key, label, sub) => {
      const on = gateOpen(key), cb = h('input', { type: 'checkbox', checked: on, disabled: !verbsOn() || key === 'row:pres-act', onchange: async () => { await setGate(key, cb.checked); draw(); } });
      return h('label.li', { style: { gap: '.7rem', cursor: 'pointer' } }, cb, h('span.grow', h('span', label), sub ? h('div.muted.small', sub) : null));
    };
    const verbs = h('label.li', { style: { gap: '.7rem' } }, h('input', { type: 'checkbox', checked: verbsOn(), onchange: async (e) => { await setGate('verbs', e.target.checked); draw(); } }), h('span.grow', h('b', 'Verb parsing'), h('div.muted.small', 'Off: daily parsing asks about nouns, adjectives and other words only.')));
    // A heading with a box that ticks or unticks the whole group (partly ticked when only some are open).
    const group = (title, keys) => {
      const fixed = (k) => k === 'row:pres-act', free = keys.filter((k) => !fixed(k)), on = keys.filter(gateOpen).length;
      const cb = h('input', { type: 'checkbox', 'aria-label': title + ': tick or untick all', checked: on === keys.length, disabled: !verbsOn(), onchange: async () => { await setGates(free, cb.checked); draw(); } });
      cb.indeterminate = on > 0 && on < keys.length;
      return h('h2.cathead', cb, title);
    };
    const everyKey = [...allGateKeys(), 'mi', 'rare'].filter((k) => k !== 'row:pres-act');
    const all = (on) => h('button.btn.sm', { disabled: !verbsOn(), onclick: async () => { await setGates(everyKey, on); draw(); } }, on ? 'Select all' : 'Clear all');
    clear(view).append(backHead('Choose forms', '#/parse', 'Parsing'), h('div.stack',
      h('p.muted.small', 'These decide which forms daily parsing may ask. Passing drills opens verb forms for you; here you can tick or untick any by hand, or a whole group at once. Words you have studied keep their progress.'),
      h('div.row', all(true), all(false)),
      h('h2.cathead', 'Other words'),
      h('div.list', nominalsRow(draw)),
      h('div.list', verbs),
      group('Indicative rows', ROW_KEYS.map((r) => 'row:' + r)), h('div.list', ROW_KEYS.map((r) => box('row:' + r, rowName(r), r === 'pres-act' ? 'Always open once verbs are on' : chartRowKnown(r) ? 'Learned on the chart' : null))),
      ...FAMILIES.flatMap((f) => [group(f.name, f.kinds.map((k) => f.id + ':' + k.key)), h('div.list', f.kinds.map((k) => box(f.id + ':' + k.key, k.name)))]),
      group('More', ['mi', 'rare']), h('div.list', box('mi', 'Verbs in -μι', 'Kept out of daily parsing until ticked'), box('rare', 'Rare forms', 'Optative, future participles and infinitives, pluperfect'))));
  };
  draw();
}

/** After "Yes": what comes next. */
export function renderHowto(view) {
  clear(view).append(backHead('Verb parsing is on', '#/parse', 'Parsing'), h('div.card.stack',
    h('p', 'Present active forms will now appear in daily parsing.'),
    h('p', 'Other types of verb forms open as you earn them. Learn a row of the master verb chart, or pass the “Which kind is it?” drill for a type of participle, infinitive, subjunctive or imperative. You will find them under Unlock verb forms on the Parsing page.'),
    h('div.row.wrap', h('a.btn.primary', { href: '#/parse' }, 'Go to Parsing'), h('a.btn.ghost', { href: '#/home' }, 'Home'))));
}

/** The question at the end of a session in which a verb came up. Returns a card, or null when it is not due. */
export function verbQuestion(onDone) {
  if (!verbAskDue()) return null;
  const card = h('div.card.stack', h('h2', 'Want to practice parsing verbs too?'),
    h('p.muted.small', 'You have been learning verbs as part of your vocabulary. Parsing breaks down a verb into its grammatical parts: tense, voice, mood, person and number.'),
    h('div.row.wrap',
      h('button.btn.primary', { onclick: async () => { await noteVerbAsk(); await turnOnVerbs(); location.hash = '#/parse/howto'; onDone && onDone(); } }, 'Yes'),
      h('button.btn', { onclick: async () => { await noteVerbAsk(); card.remove(); toast('You can turn it on any time from Parsing.'); onDone && onDone(); } }, 'Not yet')));
  return card;
}
