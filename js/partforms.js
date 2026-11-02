// Tap a principal part to see every form of that part that occurs in the text, by person and number.
// Everything shown is read from the Greek text's own forms and RP morphology tags; nothing is written by hand.
import { D } from './data.js';
import { h, clear, fmt } from './util.js';

const PART_NAMES = ['Present', 'Future', 'Aorist active', 'Perfect active', 'Perfect mid/pas', 'Aorist passive'];
const TENSE = ['P', 'F', 'A', 'R', 'A'];                                       // slot 0..4 → tense letter; slot 5 is the aorist too
const slotTense = (slot) => (slot === 5 ? 'A' : slot === 4 ? 'R' : TENSE[slot]);
const skel = (s) => s.normalize('NFD').replace(/[̀-ͯ­]/g, '').toLowerCase().replace(/ς/g, 'σ');
/** One spelling for display: lower case, no soft hyphens, grave accents turned into acutes. */
export const tidy = (s) => s.replace(/­/g, '').normalize('NFD').replace(/̀/g, '́').normalize('NFC').toLowerCase();

const TAG = /^V-([12]?)([PIFARL])([AMPEDONQX]?)([IMSONP])(?:-([123])([SP]))?/;
let index = null;
/** strongs → every verb form of that word in the text, with its parsed tag. */
function formsOf(n) {
  if (!index) {
    index = new Map();
    for (const f of D.forms) for (const a of f.an) {
      const m = TAG.exec(a.m); if (!m) continue;
      (index.get(a.s) || index.set(a.s, []).get(a.s)).push({ w: f.w, plain: f.plain, count: f.count, tense: m[2], sec: m[1], voice: m[3] || 'X', mood: m[4], person: m[5] || '', number: m[6] || '' });
    }
  }
  return index.get(n) || [];
}

/** Which tenses a part governs: the imperfect belongs to the present stem, the pluperfect to the perfect stem. */
const GROUPS = [[['P', 'Present'], ['I', 'Imperfect']], [['F', 'Future']], [['A', 'Aorist']], [['R', 'Perfect'], ['L', 'Pluperfect']], [['R', 'Perfect'], ['L', 'Pluperfect']], [['A', 'Aorist']]];

/** If the printed form itself doesn't occur, fall back to the voices that belong to that part. */
const DEFAULT_VOICES = [['A', 'D', 'N', 'O', 'X', 'Q'], ['A', 'M', 'D', 'N', 'O', 'X', 'Q'], ['A', 'D', 'N', 'X', 'Q'], ['A', 'X', 'Q'], ['M', 'P', 'E', 'D', 'N', 'O'], ['P', 'O', 'E']];

/** Same word apart from accents counts once: show its commonest spelling and add the counts. */
function merge(list) {
  const by = new Map();
  for (const f of list) { const t = tidy(f.w), k = skel(t), g = by.get(k) || { c: 0, best: t, bc: 0 }; g.c += f.count; if (f.count > g.bc) { g.best = t; g.bc = f.count; } by.set(k, g); }
  return [...by.values()].sort((a, b) => b.c - a.c).map((g) => [g.best, g.c]);
}

/** The forms of one principal part: the same voice as the printed form, in the tenses that part governs. */
export function partForms(n, slot, printed) {
  const k = skel(printed || ''), main = GROUPS[slot][0][0];
  // some parts are listed in the text under another dictionary entry (a supplementing verb): follow the printed form there
  const via = new Set(); for (const f of D.forms) if (f.plain === k) for (const a of f.an) if (a.s !== n && /^V-/.test(a.m)) { const m = TAG.exec(a.m); if (m && m[2] === main) via.add(a.s); }
  const all = [...formsOf(n), ...[...via].flatMap((m) => formsOf(m))];
  const voices = new Set(all.filter((f) => f.tense === main && (skel(f.w) === k || f.plain === k)).map((f) => f.voice + f.sec));   // the voice the printed form has in the text
  const groups = GROUPS[slot].map(([tense, label]) => {
    const use = all.filter((f) => f.tense === tense && (voices.size ? voices.has(f.voice + f.sec) : DEFAULT_VOICES[slot].includes(f.voice)));
    const cell = {}, other = {};
    for (const f of use) (f.mood === 'I' ? (cell[f.person + f.number] ||= []) : (other[f.mood] ||= [])).push(f);
    const fix = (o) => Object.fromEntries(Object.entries(o).map(([key, v]) => [key, merge(v)]));
    return { label, cell: fix(cell), other: fix(other), total: use.length };
  }).filter((g) => g.total);
  const used = groups.length ? [...via].filter((m) => formsOf(m).some((f) => groups.some((g) => g.total) && f.tense === main)) : [];
  return { groups, total: groups.reduce((a, g) => a + g.total, 0), via: used };
}

const MOODS = [['S', 'Subjunctive'], ['M', 'Imperative'], ['O', 'Optative'], ['N', 'Infinitive'], ['P', 'Participle']];
function panel(n, slot, printed) {
  const r = partForms(n, slot, printed);
  if (!r.total) return h('div.fpanel', h('b', PART_NAMES[slot] + ' forms'), h('p.muted.small', 'No forms of this part are listed under this word in the text.'));
  const form = (list) => list.slice(0, 3).map(([w, c], i) => [i ? ' · ' : '', h('span', { lang: 'grc' }, w), h('i', fmt(c) + '×')]);
  const group = (g) => {
    const row = (p, lab) => h('tr', h('td.l', lab), ['S', 'P'].map((num) => (g.cell[p + num] ? h('td', form(g.cell[p + num])) : h('td.no', 'not in the text'))));
    const hasOther = MOODS.some(([m]) => g.other[m]);
    return h('div', { style: { marginTop: '.5rem' } },
      r.groups.length > 1 || g.label !== 'Aorist' && g.label !== 'Future' ? h('div.small', { style: { fontWeight: 700 } }, g.label) : null,
      Object.keys(g.cell).length ? h('table.ftable', h('tr', h('th'), h('th', 'Singular'), h('th', 'Plural')), row('1', '1st'), row('2', '2nd'), row('3', '3rd')) : null,
      hasOther ? h('div.small.muted', { style: { margin: '.5rem 0 .2rem' } }, 'Other ' + g.label.toLowerCase() + ' forms') : null,
      ...MOODS.filter(([m]) => g.other[m]).map(([m, name]) => h('div', { style: { margin: '.15rem 0' } }, h('span.small.muted', name + ': '),
        g.other[m].slice(0, 14).map(([w]) => h('span.fchip', { lang: 'grc' }, w)), g.other[m].length > 14 ? h('span.small.muted', ' …and ' + (g.other[m].length - 14) + ' more') : null)));
  };
  const viaNote = r.via.length ? h('div.small.muted', { style: { marginTop: '.5rem' } }, 'Includes forms the text lists under ' + r.via.map((m) => (D.lexByN.get(m) || {}).head).filter(Boolean).join(', ') + '.') : null;
  return h('div.fpanel', h('b', 'Forms of the ' + PART_NAMES[slot].toLowerCase() + ' part that occur in the text'), r.groups.map(group), viaNote,
    h('div.small.muted', { style: { marginTop: '.6rem' } }, 'Counts are across the whole text. Capitals are lowercased, accent variants of a word are merged, and graves are shown as acutes.'));
}

/** The principal-parts grid with tappable parts. `names` are the labels; parts that are blank stay inert. */
export function partsGrid(n, entry, names = PART_NAMES, { hi = -1, hideBlank = false, style = null } = {}) {
  const out = h('div'), slot = h('div'); let open = -1;
  const grid = h('div.partsgrid', style ? { style } : {}, names.map((name, i) => {
    const f = entry.parts[i];
    if (!f) return hideBlank ? null : h('div.pp.none', h('small', name), h('span', { lang: 'grc' }, '—'));
    const b = h('button.pp.tap' + (i === hi ? '.hi' : ''), { type: 'button', 'aria-pressed': 'false', onclick: () => {
      grid.querySelectorAll('.tap').forEach((x) => x.setAttribute('aria-pressed', 'false'));
      if (open === i) { open = -1; clear(slot); return; }
      open = i; b.setAttribute('aria-pressed', 'true'); clear(slot).append(panel(n, i, f));
    } }, h('small', name), h('span', { lang: 'grc' }, f));
    return b;
  }));
  out.append(grid, slot); return out;
}
