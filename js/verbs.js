// The Verbs page (verbs you are working on) and each verb's own page: which stems and forms are worth learning, and how far along you are.
import { D, lexeme } from './data.js';
import { verbStatus, startedVerbs, verbBrake } from './know.js';
import { h, clear, pct, fold, backHead } from './util.js';
import { partsGrid } from './partforms.js';
import { eligible, SLOT_NAMES } from './parts.js';

const pctOf = (x) => Math.round(100 * x) + '%';
const chip = (v) => h('span.chip' + (v.learned ? '.good' : ''), v.learned ? 'Learned' : 'Learning');
const stemLine = (v) => v.stems.map((s) => s.name + ' · ' + s.known + ' of ' + s.total).join('  ·  ');
const btn = (cls, href, text) => h('a.btn' + cls, { href }, text);

/** Number of verbs worth showing as "in progress" on the Learn hub. */
export const verbsInProgress = () => startedVerbs().filter((n) => verbStatus(n)).length;

export function verbsNote() {
  const b = verbBrake();
  return b.braked ? b.why : 'New verbs arrive about one for every four other new words.';
}

export function renderVerbsPage(view) {
  const ns = startedVerbs().filter((n) => verbStatus(n)), brake = verbBrake();
  clear(view).append(backHead('Verbs', '#/home', 'Home'),
    h('div.stack',
      h('div.card.small', h('b', brake.braked ? 'New verbs are paused.' : 'New verbs are arriving.'), ' ', brake.braked ? brake.why : 'About one for every four other new words.'),
      ns.length
        ? h('div.card', ns.map((n) => { const v = verbStatus(n), L = lexeme(n); return h('a.li.verbrow', { href: '#/learn/verb/' + n, style: { gap: '.7rem' } },
            h('div.grow', h('b', { lang: 'grc' }, L.head), ' ', h('span.muted.small', L.brief), h('div.muted.small', stemLine(v))), chip(v)); }))
        : h('div.card', h('p', 'No verbs yet. Verbs join your lessons as you learn new words.')),
      ns.length ? h('div.row.wrap', btn('.primary', '#/parse/run/verbs', 'Practice these verbs’ forms'), btn('', '#/parts/exercise', 'Practice principal parts')) : null,
      ns.length ? h('p.muted.small', 'Principal parts is extra practice. Nothing is scheduled, graded or counted.') : null,
      h('p.muted.small', 'A verb’s forms count as learned when you know each form we chose for it and get at least 90% of your last 10 answers on them right.')));
}

export function renderVerbPage(view, n) {
  const L = D.lexByN.get(+n), v = L && verbStatus(+n);
  if (!v) { location.replace('#/learn/verbs'); return; }
  const e = eligible().get(v.n);
  clear(view).append(backHead(L.head, '#/learn/verbs', 'Verbs'),
    h('div.stack',
      h('div.card.stack', h('div.row.between', h('div', h('b.qgreek', { lang: 'grc' }, L.head), h('div.muted', L.brief)), chip(v)),
        h('p.muted.small', 'Used ' + v.uses.toLocaleString('en-US') + ' times in the New Testament.')),
      v.stems.map((s) => h('div.card.stack', h('div.row.between', h('b', s.name), h('span.muted.small', pctOf(s.share) + ' of its uses')),
        h('div', s.forms.map((f) => h('span.chip' + (f.known ? '.good' : ''), { lang: 'grc', style: { margin: '.15rem .3rem .15rem 0' } }, (f.known ? '✓ ' : '') + f.w, h('span.muted.small', ' ' + f.count + '×')))))),
      h('p.muted.small', 'Together these stems cover ' + pctOf(v.share) + ' of its uses. The rest are rarer forms you can read from context.'),
      h('div.row.wrap', btn('.primary', '#/parse/run/verbs/' + v.n, 'Practice these forms'), e ? btn('', '#/parts/exercise/' + v.n, 'Practice this verb') : null),
      e ? fold('Principal parts chart', partsGrid(v.n, e, SLOT_NAMES)) : null));
}
