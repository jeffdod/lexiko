// Reference charts, shown in a sheet that can be opened from any verb quiz: the master verb chart (indicative)
// and the primary / secondary personal endings. Plain data tables, themed and available offline.
import { h, clear, icon } from './util.js';

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

const TABS = [['master', 'Master verb chart'], ['endings', 'Personal endings']];

/** Open the charts sheet. `highlight` is a master-chart row key (see chartRowFor). */
export function openCharts({ tab = 'master', highlight = null } = {}) {
  const dlg = h('dialog.sheet.charts', { 'aria-label': 'Charts' }), body = h('div.cbody');
  const draw = (t) => {
    clear(body);
    if (t === 'master') body.append(h('p.small.muted', 'Indicative, with λύω as the model. Any verb’s principal part follows one of these rows.'), masterTable(highlight));
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
