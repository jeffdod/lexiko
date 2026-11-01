// Reference charts, shown in a sheet that can be opened from any verb quiz: the master verb chart (indicative)
// and the primary / secondary personal endings. Plain data tables, themed and available offline.
import { h, clear, icon } from './util.js';
import { D } from './data.js';
import { decode, CASE } from './morph.js';

/* tense | augment/reduplication | tense stem | tense formative | connecting vowel | personal endings | 1st singular */
const MASTER = [
  ['pres-act', 'Present act', '', 'pres', '', 'ο/ε', 'prim act', 'λύω'],
  ['pres-mp', 'Present mid/pas', '', 'pres', '', 'ο/ε', 'prim mid/pas', 'λύομαι'],
  ['impf-act', 'Imperfect act', 'ε', 'pres', '', 'ο/ε', 'sec act', 'ἔλυον'],
  ['impf-mp', 'Imperfect mid/pas', 'ε', 'pres', '', 'ο/ε', 'sec mid/pas', 'ἐλυόμην'],
  null,
  ['fut-act', 'Future act', '', 'fut act', 'σ', 'ο/ε', 'prim act', 'λύσω'],
  ['fut-liq-act', 'Liquid fut act', '', 'fut act', 'εσ', 'ο/ε', 'prim act', 'μενῶ'],
  ['fut-mid', 'Future mid', '', 'fut act', 'σ', 'ο/ε', 'prim mid/pas', 'πορεύσομαι'],
  ['fut-liq-mid', 'Liquid fut mid', '', 'fut act', 'εσ', 'ο/ε', 'prim mid/pas', 'μενοῦμαι'],
  ['fut-pas1', '1st future pas', '', 'aor pas', 'θησ', 'ο/ε', 'prim mid/pas', 'λυθήσομαι'],
  ['fut-pas2', '2nd future pas', '', 'aor pas', 'ησ', 'ο/ε', 'prim mid/pas', 'ἀποσταλήσομαι'],
  null,
  ['aor1-act', '1st aorist act', 'ε', 'aor act', 'σα', '', 'sec act', 'ἔλυσα'],
  ['aor-liq-act', 'Liquid aorist act', 'ε', 'aor act', 'α', '', 'sec act', 'ἔμεινα'],
  ['aor2-act', '2nd aorist act', 'ε', 'aor act', '', 'ο/ε', 'sec act', 'ἔλαβον'],
  ['aor1-mid', '1st aorist mid', 'ε', 'aor act', 'σα', '', 'sec mid/pas', 'ἐλυσάμην'],
  ['aor2-mid', '2nd aorist mid', 'ε', 'aor act', '', 'ο/ε', 'sec mid/pas', 'ἐγενόμην'],
  ['aor1-pas', '1st aorist pas', 'ε', 'aor pas', 'θη', '', 'sec act', 'ἐλύθην'],
  ['aor2-pas', '2nd aorist pas', 'ε', 'aor pas', 'η', '', 'sec act', 'ἐγράφην'],
  null,
  ['perf1-act', '1st perfect act', 'λε', 'perf act', 'κα', '', 'prim act', 'λέλυκα'],
  ['perf2-act', '2nd perfect act', 'λε', 'perf act', 'α', '', 'prim act', 'γέγονα'],
  ['perf-mp', 'Perfect mid/pas', 'λε', 'perf pas', '', '', 'prim mid/pas', 'λέλυμαι'],
];
const MASTER_HEAD = ['Tense', 'Aug / redup', 'Tense stem', 'Tense form.', 'Conn. vowel', 'Personal endings', '1st sing paradigm'];

/* person | regular form | vowel + ending | alternate */
const PRIMARY_ACT = [['1 sg', 'λύω', 'ο', '–', 'μι'], ['2 sg', 'λύεις', 'ε', 'ς', ''], ['3 sg', 'λύει', 'ε', 'ι', 'σι(ν)'], ['1 pl', 'λύομεν', 'ο', 'μεν', ''], ['2 pl', 'λύετε', 'ε', 'τε', ''], ['3 pl', 'λύουσι(ν)', 'ο', 'νσι(ν)', 'ασι(ν)']];
const PRIMARY_MP = [['1 sg', 'λύομαι', 'ο', 'μαι'], ['2 sg', 'λύῃ', 'ε', 'σαι'], ['3 sg', 'λύεται', 'ε', 'ται'], ['1 pl', 'λυόμεθα', 'ο', 'μεθα'], ['2 pl', 'λύεσθε', 'ε', 'σθε'], ['3 pl', 'λύονται', 'ο', 'νται']];
const SECOND_ACT = [['1 sg', 'ἔλυον', 'ο', 'ν', ''], ['2 sg', 'ἔλυες', 'ε', 'ς', ''], ['3 sg', 'ἔλυε(ν)', 'ε', '–', ''], ['1 pl', 'ἐλύομεν', 'ο', 'μεν', ''], ['2 pl', 'ἐλύετε', 'ε', 'τε', ''], ['3 pl', 'ἔλυον', 'ο', 'ν', 'σαν']];
const SECOND_MP = [['1 sg', 'ἐλυόμην', 'ο', 'μην'], ['2 sg', 'ἐλύου', 'ε', 'σο'], ['3 sg', 'ἐλύετο', 'ε', 'το'], ['1 pl', 'ἐλυόμεθα', 'ο', 'μεθα'], ['2 pl', 'ἐλύεσθε', 'ε', 'σθε'], ['3 pl', 'ἐλύοντο', 'ο', 'ντο']];

const grc = (t) => h('span', { lang: 'grc' }, t);

function masterTable(hi) {
  const body = h('tbody');
  MASTER.forEach((r) => {
    if (!r) { body.append(h('tr.gap', h('td', { colSpan: 7 }))); return; }
    const [key, ...cells] = r;
    body.append(h('tr' + (key === hi ? '.hi' : ''), { dataset: { key } }, h('th', { scope: 'row' }, cells[0]), ...cells.slice(1).map((c, i) => h('td', i === 5 ? grc(c) : i === 0 || i === 2 || i === 3 ? grc(c) : c))));
  });
  return h('div.cscroll', h('table.ctable', h('thead', h('tr', MASTER_HEAD.map((t) => h('th', t)))), body));
}

function endingsTable(title, act, mp, alt) {
  const rows = (list, withAlt) => list.map(([p, form, v, e, a]) => h('tr', h('th', { scope: 'row' }, p), h('td', grc(form)), h('td.c', grc(v)), h('td.c', grc(e)), withAlt ? h('td.c', grc(a || '')) : null));
  const head = (withAlt) => h('thead', h('tr', h('th', ''), h('th', 'Regular'), h('th.c', 'Vowel'), h('th.c', 'Ending'), withAlt ? h('th.c', 'Alternate') : null));
  return h('div.cblock', h('h3', title),
    h('div.clabel', 'Active'), h('div.cscroll', h('table.ctable', head(alt), h('tbody', rows(act, alt)))),
    h('div.clabel', 'Middle / passive'), h('div.cscroll', h('table.ctable', head(false), h('tbody', rows(mp, false)))));
}

/* ---------- noun and adjective endings, counted from the text itself ---------- */
const END_RE = /(αι|ει|οι|υι|ου|[αεηιουωᾳῃῳ])([νς])?$/;
/** The ending of a form: its last vowel (or diphthong) and a following ν/ς; accents and breathings dropped, iota subscript kept. */
function endingOf(w) {
  const t = w.normalize('NFD').replace(/[\u0300-\u0344\u0346-\u036f]/g, '').normalize('NFC').toLowerCase().replace(/σ$/, 'ς');
  const m = END_RE.exec(t); return m ? m[0] : null;
}
const strip = (w) => w.normalize('NFD').replace(/[̀-̈́͆-ͯ]/g, '').normalize('NFC').toLowerCase().replace(/σ$/, 'ς');
const ART = { 'ὁ': 'M', 'ἡ': 'F', 'τό': 'N' };
/** Which pattern a noun follows, read from its dictionary entry (nominative, genitive, article): [group order, title, gender]. */
function patternOf(head) {
  const parts = head.split(',').map((x) => x.trim()), nom = strip(parts[0]), gen = strip(parts[1] || ''), art = parts.slice(2).filter((x) => ART[x]);
  if (art.length !== 1) return null;                              // common-gender and unusual entries are left out
  const g = ART[art[0]], ne = (/(ας|ης|α|η)$/.exec(nom) || /(ος|ον)$/.exec(nom) || [])[0];
  if (/^(ας|ης|ου)$/.test(gen) && /(ας|ης|α|η)$/.test(nom)) return ['1', 'First declension', g, '-' + ne + ', -' + gen];
  if (gen === 'ου' && /(ος|ον)$/.test(nom)) return ['2', 'Second declension', g, '-' + ne + ', -ου'];
  return ['3', 'Third declension', g, ''];
}
let nounCache = null;
function nounEndings() {
  if (nounCache) return nounCache;
  const groups = {};                                             // key -> {order, title, gender, sub, cells}
  const memo = new Map();
  for (const f of D.forms) {
    const a = f.an[0]; if (!a) continue;
    const d = decode(a.m); if (d.pos !== 'N' || !d.slots.case || !d.slots.number) continue;
    const L = D.lexByN.get(a.s); if (!L) continue;
    if (!memo.has(L.head)) memo.set(L.head, patternOf(L.head));
    const pat = memo.get(L.head); if (!pat) continue;
    const e = endingOf(f.plain); if (!e) continue;
    const key = pat[0] + pat[2] + pat[3];
    const g = (groups[key] ||= { order: pat[0], title: pat[1], gender: pat[2], sub: pat[3], cells: {}, words: new Set() });
    g.words.add(L.head);
    const m = (g.cells[d.slots.case + d.slots.number] ||= new Map());
    m.set(e, (m.get(e) || 0) + f.count);
  }
  return (nounCache = Object.values(groups).filter((g) => g.words.size >= 3));
}
function nounEndingsTables() {
  const GN = { M: 'masculine', F: 'feminine', N: 'neuter' }, ORD = { M: 0, F: 1, N: 2 };
  const groups = nounEndings().sort((x, y) => x.order.localeCompare(y.order) || ORD[x.gender] - ORD[y.gender] || x.sub.localeCompare(y.sub));
  const cell = (m) => {
    if (!m) return '–';
    const tot = [...m.values()].reduce((x, y) => x + y, 0);
    const keep = [...m.entries()].filter(([, n]) => n >= 2 && n / tot >= 0.15).map(([e]) => e).sort((x, y) => x.localeCompare(y, 'el'));
    return keep.length ? h('span', { lang: 'grc' }, keep.map((e) => '-' + e).join(', ')) : '–';
  };
  const out = [h('p.small.muted', 'Counted from every noun in the text and grouped by declension and gender. Each table shows the endings that really occur for nouns of that pattern, so it can differ a little from a grammar’s ideal paradigm. Nouns with two genders and some irregular ones are left out.')];
  let last = '';
  for (const g of groups) {
    if (g.order !== last) { out.push(h('h2.csec', g.title)); last = g.order; }
    const label = GN[g.gender][0].toUpperCase() + GN[g.gender].slice(1) + (g.sub ? ' · ' + g.sub : '');
    out.push(h('div.cblock', h('h3', label), h('div.cscroll', h('table.ctable',
      h('thead', h('tr', h('th', ''), h('th', 'Singular'), h('th', 'Plural'))),
      h('tbody', ['N', 'G', 'D', 'A', 'V'].map((c) => h('tr', h('th', { scope: 'row' }, CASE[c]), h('td', cell(g.cells[c + 'S'])), h('td', cell(g.cells[c + 'P'])))))))));
  }
  return out;
}

const TABS = [['master', 'Master verb chart'], ['endings', 'Personal endings'], ['nouns', 'Noun endings']];

/** Open the charts sheet. `highlight` is a master-chart row key (see chartRowFor). */
export function openCharts({ tab = 'master', highlight = null } = {}) {
  const dlg = h('dialog.sheet.charts', { 'aria-label': 'Charts' }), body = h('div.cbody');
  const draw = (t) => {
    clear(body);
    if (t === 'master') body.append(h('p.small.muted', 'Indicative, with λύω as the model. Any verb’s principal part follows one of these rows.'), masterTable(highlight));
    else if (t === 'nouns') body.append(...nounEndingsTables());
    else body.append(endingsTable('Primary endings', PRIMARY_ACT, PRIMARY_MP, true), endingsTable('Secondary endings', SECOND_ACT, SECOND_MP, true));
    const row = body.querySelector('tr.hi'); if (row) requestAnimationFrame(() => row.scrollIntoView({ block: 'center' }));
  };
  const tabs = h('div.seg', TABS.map(([id, label]) => h('button', { 'aria-pressed': String(id === tab), onclick: (e) => { [...tabs.children].forEach((b) => b.setAttribute('aria-pressed', String(b === e.currentTarget))); draw(id); } }, label)));
  dlg.append(h('div.row.between', h('h2', 'Charts'), h('button.btn.ghost.icon.sm', { 'aria-label': 'Close charts', onclick: () => dlg.close() }, icon('close', 20))), tabs, body);
  document.body.append(dlg); dlg.addEventListener('close', () => dlg.remove()); dlg.showModal(); draw(tab);
}

/** A "Charts" button for a quiz's top bar; `getHighlight()` is asked for the row to light up when it is pressed. */
export const chartsButton = (getHighlight) => h('button.btn.sm', { 'aria-label': 'Open charts', onclick: () => openCharts({ highlight: getHighlight ? getHighlight() : null }) }, icon('table', 18), 'Charts');

/**
 * Which master-chart row builds a principal part (0 present, 1 future, 2 aorist, 3 perfect active, 4 perfect mid/pas, 5 aorist passive)?
 * Judged from the written form, so it's only a guide.
 */
export function chartRowFor(slot, form) {
  if (!form) return null;
  const f = form.normalize('NFD'), plain = f.replace(/[̀-ͅ]/g, '').toLowerCase().replace(/ς$/, 'σ');
  switch (slot) {
    case 0: return /μαι$/.test(plain) ? 'pres-mp' : 'pres-act';
    case 1: return /μαι$/.test(plain) ? (/ῦμαι$/.test(f) ? 'fut-liq-mid' : 'fut-mid') : (/ῶ$/.test(f) ? 'fut-liq-act' : 'fut-act');
    case 2:
      if (/μην$/.test(plain)) return /σαμην$/.test(plain) ? 'aor1-mid' : 'aor2-mid';
      if (/(ον|ην|ων)$/.test(plain)) return 'aor2-act';
      return /σα$/.test(plain) ? 'aor1-act' : /κα$/.test(plain) ? 'aor1-act' : 'aor-liq-act';
    case 3: return /κα$/.test(plain) ? 'perf1-act' : 'perf2-act';
    case 4: return 'perf-mp';
    case 5: return /θην$/.test(plain) ? 'aor1-pas' : 'aor2-pas';
    default: return null;
  }
}

/** Master-chart row for a parsed indicative verb (RP slots), or null when the chart has no row for it. */
export function chartRowForSlots(sl) {
  if (!sl || !sl.tense || sl.mood !== 'I') return null;
  const act = 'AQ'.includes(sl.voice), pas = 'PO'.includes(sl.voice), sec = !!sl.second;
  switch (sl.tense) {
    case 'P': return act ? 'pres-act' : 'pres-mp';
    case 'I': return act ? 'impf-act' : 'impf-mp';
    case 'F': return pas ? (sec ? 'fut-pas2' : 'fut-pas1') : act ? 'fut-act' : 'fut-mid';
    case 'A': return pas ? (sec ? 'aor2-pas' : 'aor1-pas') : act ? (sec ? 'aor2-act' : 'aor1-act') : (sec ? 'aor2-mid' : 'aor1-mid');
    case 'R': return act ? (sec ? 'perf2-act' : 'perf1-act') : 'perf-mp';
    default: return null;
  }
}
