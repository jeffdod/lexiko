// A summary page for one kind of verb form (a row of the master verb chart, or one kind of participle, infinitive, subjunctive or imperative):
// what it is, how it is built, a model verb, real forms from the verbs you know, and where to practice it. One kind per page. Reached from the offer
// ("Yes, add it") and from the name of each kind on the Indicative and kind pages.
import { D } from './data.js';
import { gateOpen, K } from './know.js';
import { ROWS, summary } from './chartdrill.js';
import { paradigm } from './paradigms.js';
import { PTCB, CELL_ROWS, chars, FORMATIVE_MEANING, MORPHEME_MEANING } from './ptcdata.js';
import { INFB } from './infdata.js';
import { SUBB } from './subdata.js';
import { IMPB } from './impdata.js';
import { FAMILY, kindName } from './kinds.js';
import { poolForms } from './gatenote.js';
import { rowPool, trickling, TRICKLE_DAILY } from './parse.js';
import { h, clear, backHead } from './util.js';

const lg = (t, cls = '') => h('span' + cls, { lang: 'grc' }, t);
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1), low = (s) => s.charAt(0).toLowerCase() + s.slice(1);
export const longName = (n) => n.replace('mid/pas', 'middle/passive').replace(/\bfut\b/, 'future').replace(/\bact\b/, 'active').replace(/\bmid\b/, 'middle').replace(/\bpas\b/, 'passive').replace(/^./, (c) => c.toUpperCase());
const SINGULAR = { ptc: 'participle', inf: 'infinitive', sub: 'subjunctive', imp: 'imperative' };
const DATA = { ptc: PTCB, inf: INFB, sub: SUBB, imp: IMPB };

/** What a kind is called: "aorist active", "present active participle". */
export function typeName(key) {
  const [fam, k] = key.split(':');
  if (fam === 'row') { const r = ROWS.find((q) => q.key === k); return low(longName(r ? r.name || r.title || k : k)); }
  return low(kindName(fam, k)) + ' ' + SINGULAR[fam];
}
/** The page of one kind. */
export const typeHref = (key) => '#/parse/type/' + encodeURIComponent(key);
const parseHref = (fam, k) => (fam === 'row' ? '#/parse/run/row/' + k : '#/parse/run/' + fam + '/' + k);
const fullHref = (fam, k) => (fam === 'row' ? '#/learn/charts/paradigm/' + k : fam === 'ptc' ? '#/learn/charts/participle/' + k : fam === 'inf' ? null : '#/learn/charts/' + FAMILY[fam].path + '/' + k);

/** How the kind is built, in a sentence or two. */
function built(fam, k) {
  if (fam === 'row') { const r = ROWS.find((q) => q.key === k); return r ? [summary(r).replace(/^[^:]*: /, '').replace('reduplication: first consonant + ε (reduplication)', 'reduplication (first consonant + ε)').replace(/^./, (c) => c.toUpperCase())] : []; }
  const r = DATA[fam].get(k); if (!r) return [];
  if (fam === 'ptc') return [r.form ? 'Formative: ' + r.form + ' — ' + FORMATIVE_MEANING[r.form] + '.' : 'No formative: the perfect middle/passive reduplicates.', 'Participle marker: ' + r.morph + ' — ' + MORPHEME_MEANING[r.morph] + '.'];
  if (fam === 'inf') return ['The stem and the ending ' + r.ending + '. Model: ' + r.model + ', “' + r.gloss + '”.'];
  return [r.desc];
}
/** The model verb: the six (or four, or twenty-four) forms written out. */
function model(fam, k) {
  if (fam === 'row') {
    const P = paradigm(k); if (!P) return null;
    return h('div.card.stack', ...P.cells.map((c) => h('div.pline', h('span.plab', c.label), h('span.pword', { lang: 'grc' }, h('span.pstem', c.stem), h('b.pend', c.ending)), c.inText ? h('small.muted', { style: { marginLeft: '.6rem' } }, 'in the text') : null)),
      h('p.muted.small', { style: { margin: 0 } }, h('b', 'Verb: '), lg(P.head), ' · ' + P.brief + '.'));
  }
  const r = DATA[fam].get(k); if (!r) return null;
  if (fam === 'ptc') {
    const cell = (f) => { const cs = chars(f.replace('(ν)', '')), nu = f.includes('(ν)'); return h('td', { lang: 'grc' }, cs.slice(0, r.stemLen).join(''), h('b.pend', cs.slice(r.stemLen).join('') + (nu ? '(ν)' : ''))); };
    return h('div.card.stack', h('div.cscroll', h('table.ctable.ptctable', h('thead', h('tr', ['', 'Masc.', 'Fem.', 'Neut.'].map((c) => h('th', c)))),
      h('tbody', r.forms.map((cells, i) => h('tr' + (i === 4 ? '.sep' : ''), h('th', { scope: 'row' }, CELL_ROWS[i]), cells.map(cell)))))), h('p.muted.small', { style: { margin: 0 } }, h('b', 'Verb: '), lg(r.verb)));
  }
  if (fam === 'inf') return h('div.card.stack', h('div.pline', h('span.plab', 'Model'), lg(r.model, '.pword')), h('p.muted.small', { style: { margin: 0 } }, 'to ' + r.gloss.replace(/^to /, '')));
  const labs = fam === 'imp' ? ['2nd sing.', '3rd sing.', '2nd pl.', '3rd pl.'] : ['1st sing.', '2nd sing.', '3rd sing.', '1st pl.', '2nd pl.', '3rd pl.'];
  return h('div.card.stack', ...r.forms.map((f, i) => h('div.pline', h('span.plab', labs[i]), lg(f, '.pword'))), h('p.muted.small', { style: { margin: 0 } }, h('b', 'Verb: '), lg(r.verb)));
}
/** The commonest forms of the kind among the verbs you know. */
function examples(fam, k, n = 4) {
  let list;
  if (fam === 'row') list = rowPool(k, { ignoreLevel: true }).map((id) => { const f = D.forms[id], L = D.lexByN.get(f.an[0].s); return { w: f.w, head: L ? L.head : '', brief: L ? L.brief : '', count: f.count }; });
  else list = poolForms(fam, k);
  return list.sort((a, b) => b.count - a.count).slice(0, n).map((x) => ({ ...x, w: x.w.replace(/[­​]/g, '') }));
}

export function renderTypePage(view, rawKey) {
  const key = rawKey || '', [fam, k] = key.split(':');
  const ok = fam === 'row' ? ROWS.some((r) => r.key === k) : !!(DATA[fam] && DATA[fam].get(k));
  if (!ok) { location.hash = '#/parse'; return; }
  const name = typeName(key), open = fam === 'row' && k === 'pres-act' ? true : gateOpen(key), now = open && trickling(key);
  const status = now ? [h('span.chip.accent', 'Just added'), cap(name) + ' is now part of your daily parsing, with ' + TRICKLE_DAILY + ' new forms a day to begin with.']
    : open ? [h('span.chip.good', 'Open'), cap(name) + ' is part of your daily parsing.']
    : [h('span.chip', 'Not open yet'), cap(name) + ' is not in your daily parsing yet. It opens when lexiko offers it, or you can open it in ', h('a', { href: '#/parse/gates' }, 'Choose forms'), '.'];
  const ex = examples(fam, k), full = fullHref(fam, k), m = model(fam, k);
  clear(view).append(backHead(cap(name), '#/parse', 'Parsing'), h('div.stack',
    h('div.card.stack', { style: { alignItems: 'flex-start' } }, status[0], h('p', { style: { margin: 0 } }, ...status.slice(1))),
    h('div.sec', 'How it is built'), h('div.card.stack', ...built(fam, k).map((t) => h('p.small', { style: { margin: 0 } }, t))),
    m ? h('div.sec', 'A model verb') : null, m,
    h('div.sec', 'From verbs you know'),
    ex.length ? h('div.list', ex.map((x) => h('div.li', h('div.grow', h('div.t', { lang: 'grc' }, x.w), h('div.s', (x.head ? x.head + ' · ' + x.brief + ' · ' : '') + x.count + '× in the text'))))) : h('p.muted.small', 'None of the verbs you know has a form of this kind in the text yet.'),
    h('div.row.wrap', h('a.btn.primary', { href: parseHref(fam, k) }, 'Parse forms like this'),
      h('a.btn', { href: fam === 'row' ? '#/learn/charts/run/' + k : '#/learn/charts/' + FAMILY[fam].path + '/run' + (fam === 'inf' ? '' : '/' + k) }, fam === 'row' ? 'Practice this row' : 'Which kind is it?'),
      full ? h('a.btn.ghost', { href: full }, 'Full paradigm page') : null)));
}
