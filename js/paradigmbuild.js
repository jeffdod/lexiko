// Build the paradigm: a chart row's six forms (1st, 2nd, 3rd person, singular and plural) with the stem shown; place the ending that completes each.
// Wrong chips are real endings from other rows. Practice only: nothing is scheduled, graded or counted.
import { h, clear, shuffle, backHead } from './util.js';
import { ROWS, say } from './chartdrill.js';
import { paradigm } from './paradigms.js';
import { placeBoard } from './placedrill.js';

const skel = (s) => s.normalize('NFD').replace(/[̀-ͯͅ]/g, '').toLowerCase().replace(/ς/g, 'σ');
/** An ending with accents, the movable ν and the (ν) mark removed, so ουσι(ν) and ουσιν count as one. */
const norm = (e) => skel(e).replace(/\(ν\)/g, '').replace(/([ιε])ν$/, '$1');
const ALTERNATES = new Set(['μι', 'σι', 'ασι', 'σαν']);                 // endings the chart lists as alternates for some rows: never offered as wrong
const cap = (t) => t.charAt(0).toUpperCase() + t.slice(1);
const lower = (t) => t.charAt(0).toLowerCase() + t.slice(1);
const person = (l) => l.replace('sing.', 'singular').replace('pl.', 'plural');
const nameOf = (r) => cap(say(r.name));
const rowsWithParadigm = () => ROWS.filter((r) => paradigm(r.key));

/** Wrong endings for a row: real endings from other rows (the same voice first), never one this row uses. Map: ending -> the row it comes from. */
export function wrongEndings(row, count = 4) {
  const P = paradigm(row.key), right = new Set(P.cells.map((c) => norm(c.ending))), found = new Map(), seen = new Set();
  const act = (k) => /act$/.test(k), others = rowsWithParadigm().filter((r) => r.key !== row.key);
  const ordered = [...shuffle(others.filter((r) => act(r.key) === act(row.key))), ...shuffle(others.filter((r) => act(r.key) !== act(row.key)))];
  for (const r of ordered) {
    for (const c of shuffle(paradigm(r.key).cells.slice())) {
      const n = norm(c.ending);
      if (found.size >= count) return found;
      if (!n || right.has(n) || ALTERNATES.has(n) || seen.has(n)) continue;
      seen.add(n); found.set(c.ending, r);
    }
    if (found.size >= count) break;
  }
  return found;
}

function picker(view) {
  clear(view).append(backHead('Build the paradigm', '#/parse/form', 'Practice by form'), h('div.stack',
    h('div.practice-note', h('b', 'Extra practice'), ' — nothing here is scheduled, graded or counted.'),
    h('p.small.muted', 'Pick a row of the master verb chart. You see its six forms with the stem showing and place the ending that completes each one.'),
    h('div.card', rowsWithParadigm().map((r) => h('a.li', { href: '#/learn/charts/build/' + r.key }, h('div.grow', h('b', nameOf(r)), ' ', h('span.muted.small', { lang: 'grc' }, paradigm(r.key).head)))))));
}

export function renderBuildParadigm(view, key) {
  if (!key) return picker(view);
  const row = ROWS.find((r) => r.key === key), P = row && paradigm(key);
  if (!P) { picker(view); return; }
  const wrong = wrongEndings(row);
  const chips = shuffle([...P.cells.map((c) => c.ending), ...wrong.keys()]);
  const board = placeBoard({
    head: [h('span.chip.accent', nameOf(row)), h('span.pword.vb', { lang: 'grc' }, P.head), h('span.muted.small', (P.brief || '').split(/[,;]/)[0].trim())],
    slots: P.cells.map((c) => ({ label: c.label, stem: c.stem, answer: c.ending })), chips, size: 'end', noun: 'endings', hint: 'Some of these belong to other rows.',
    explain: (chip, slot, b) => {
      const other = b.slots.find((x) => x !== slot && !x.chip && x.answer === chip);
      if (other) return chip + ' is the ending for the ' + person(other.label) + ', not the ' + person(slot.label) + '.';
      const from = wrong.get(chip);
      return chip + (from ? ' is an ending of ' + lower(nameOf(from)) + ', not of ' + lower(nameOf(row)) + '.' : ' does not belong to ' + lower(nameOf(row)) + '.');
    },
    after: () => [h('div.card.stack', h('div.row.wrap', h('button.btn.primary', { onclick: () => renderBuildParadigm(view, key) }, 'Again'), h('a.btn', { href: '#/learn/charts/build' }, 'Another row'), h('a.btn', { href: '#/learn/charts/paradigm/' + key }, 'See the paradigm')))],
  });
  clear(view).append(backHead('Build the paradigm', '#/learn/charts/build', 'Rows'), h('div.stack', h('div.practice-note', h('b', 'Extra practice'), ' — nothing here is scheduled, graded or counted.'),
    board.el));
  return board.destroy;
}
