// Reference: things to look up and study (word search, the verb charts, the kinds of form). No exercises here: those live in Parsing.
import { h, clear, backHead, areaCard, icon } from './util.js';
import { setSearchQuery } from './search.js';
import { chartsButton } from './charts.js';
import { D } from './data.js';
import { eligible, SLOT_NAMES } from './parts.js';
import { partsGrid } from './partforms.js';

/** Read-only list of the principal parts of every verb that has them: type to filter, tap a verb to open its parts. */
function partsList(view) {
  const rows = [...eligible().values()].map((e) => D.lexByN.get(e.n)).sort((a, b) => b.freq - a.freq);
  const input = h('input', { type: 'search', placeholder: 'Filter verbs (Greek or English)', autocomplete: 'off', autocapitalize: 'off', 'aria-label': 'Filter verbs', style: { width: '100%' } });
  input.spellcheck = false;
  const list = h('div.card'), draw = () => {
    const q = input.value.trim().toLowerCase();
    clear(list); let n = 0;
    for (const L of rows) {
      if (q && !(L.head.toLowerCase().includes(q) || (L.brief || '').toLowerCase().includes(q))) continue;
      if (++n > 60) break;
      const d = h('details.pparts', h('summary', h('b', { lang: 'grc' }, L.head), ' ', h('span.muted.small', L.brief || '')));
      d.addEventListener('toggle', () => { if (d.open && !d.querySelector('.cardparts, table, .pgrid')) d.append(partsGrid(L.n, eligible().get(L.n), SLOT_NAMES)); });
      list.append(d);
    }
    if (!n) list.append(h('p.muted', 'No verbs match.'));
  };
  input.addEventListener('input', draw); draw();
  clear(view).append(backHead('Principal parts', '#/reference', 'Reference'), h('div.stack', input, list,
    h('p.muted.small', 'The most common verbs come first. This is a list to look things up in; to practice, open Parsing.')));
}

export function renderReference(view, params = []) {
  if (params[0] === 'parts') return partsList(view);
  const input = h('input', { type: 'search', placeholder: 'Search Greek, Beta Code, English or a Strong’s number', autocomplete: 'off', autocapitalize: 'off', 'aria-label': 'Search words', style: { flex: 1, minWidth: 0 } });
  input.spellcheck = false;
  const go = (e) => { e.preventDefault(); setSearchQuery(input.value); location.hash = '#/search'; };
  clear(view).append(backHead('Reference', '#/home', 'Home'), h('div.stack',
    h('form.row', { style: { flexWrap: 'nowrap', gap: '.5rem' }, onsubmit: go }, input, h('button.btn.icon', { type: 'submit', 'aria-label': 'Search' }, icon('search', 20))),
    areaCard({ href: '#/search', ic: 'search', title: 'Glossary', sub: 'Every word in the text, α to ω or by how common' }),
    h('div.sec', 'Quick charts'),
    h('div.row.wrap', chartsButton(), h('span.muted.small', 'Verb and noun endings, contractions')),
    h('div.sec', 'Verb charts'),
    areaCard({ href: '#/learn/charts', ic: 'table', title: 'Master verb chart', sub: 'Tenses, voices and endings in one chart, with a page for each row' }),
    areaCard({ href: '#/reference/parts', ic: 'book', title: 'Principal parts', sub: 'Look up the principal parts of any verb' }),
    h('div.sec', 'Kinds of form'),
    areaCard({ href: '#/learn/charts/participles', ic: 'text', title: 'Participles', sub: 'The ten kinds' }),
    areaCard({ href: '#/learn/charts/infinitives', ic: 'text', title: 'Infinitives', sub: 'The ten kinds' }),
    areaCard({ href: '#/learn/charts/subjunctive', ic: 'text', title: 'Subjunctive', sub: 'The eight kinds' }),
    areaCard({ href: '#/learn/charts/imperative', ic: 'text', title: 'Imperative', sub: 'The eight kinds' }),
    areaCard({ href: '#/learn/charts/mi', ic: 'text', title: 'Verbs in -μι', sub: 'Roots and reduplication' }),
    h('p.muted.small', 'Each of these pages has a “Practice this” link that opens its exercise in Parsing.')));
}
