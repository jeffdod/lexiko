// Choosing a goal: the set of words you are working toward — by word frequency, by passage, or by section (pericope).
import { D, scopeCounts, periScope, periRange, periBook } from './data.js';
import { K, setting, status, scopeReadiness, FREQ_LADDER, freqCoverage, goalStats, goalLabel } from './know.js';
import { h, clear, pct, fmt } from './util.js';

const perDay = () => Math.max(1, setting('newPerDay') || 10);
const daysFor = (left) => Math.max(1, Math.ceil(left / perDay()));
const plural = (n, w) => fmt(n) + ' ' + w + (n === 1 ? '' : 's');

/** What a goal would ask of you right now: { total, left, days, read?, cover? }. */
export function goalPreview(g) {
  const s = goalStats(g), out = { total: s.total, left: s.left, days: s.left ? daysFor(s.left) : 0 };
  if (g.kind === 'freq') out.cover = freqCoverage(g.min); else out.read = scopeReadiness(g).known;
  return out;
}
const dayText = (n) => n === 1 ? 'about a day' : 'about ' + n + ' days';
/** One line describing a goal's size and what finishing it gives you. */
export function previewLine(g) {
  const p = goalPreview(g);
  if (!p.left) return 'You already know every word in this goal.';
  return plural(p.left, 'new word') + ' · ' + dayText(p.days) + ' at ' + perDay() + ' a day';
}

/** The picker. opts: { initial, onPick(goal), confirmLabel }. Returns an element. */
export function goalPicker({ initial = null, onPick, confirmLabel = 'Set as my goal' }) {
  let tab = initial && (initial.kind === 'passage' || initial.kind === 'pericope') ? (initial.kind === 'passage' ? 'passage' : 'section') : 'freq';
  let sel = initial && initial.kind === 'freq' ? initial : null;       // the goal that Set would save
  let book = initial && initial.book ? initial.book : (K.settings.lastBook || 'JHN');
  let metRung = null;                                                  // a rung you already meet, when you tapped one
  const root = h('div.stack.goal-picker');

  const tabs = () => h('div.seg', [['freq', 'Frequency'], ['passage', 'Passage'], ['section', 'Section']].map(([k, t]) =>
    h('button', { 'aria-pressed': String(tab === k), onclick: () => { tab = k; sel = null; metRung = null; draw(); } }, t)));
  const bookSelect = () => h('label.row.between.gsel', h('span.muted', 'Book'),
    h('select', { 'aria-label': 'Book', onchange: (e) => { book = e.target.value; sel = null; draw(); } }, D.books.map((b) => h('option', { value: b.code, selected: b.code === book }, b.name))));
  const confirm = (enabled) => h('button.btn.primary.block', { disabled: !enabled, onclick: () => sel && onPick(sel) }, confirmLabel);
  const option = (on, disabled, head, body, onclick) => h('button.goal-opt' + (on ? '.on' : '') + (disabled ? '.dis' : ''), { 'aria-pressed': String(on), onclick },
    h('span.grow', h('b', head), body), h('span.rad' + (on ? '.on' : '')));

  /* ---- frequency ---- */
  function freqTab() {
    const rows = FREQ_LADDER.map((t) => { const g = { kind: 'freq', min: t }, p = goalPreview(g); return { t, g, p }; });
    const mk = ({ t, g, p }) => {
      const on = sel && sel.kind === 'freq' && sel.min === t, met = !p.left;
      if (met) return h('button.goal-opt.dis', { onclick: () => { metRung = t; sel = null; draw(); } }, h('span.grow', h('b', t + ' or more times')), h('span.gpill', 'Already yours'));
      return option(on, false, t + ' or more times', h('div.muted.small', plural(p.left, 'new word') + ' · ~' + p.days + ' days · reads ' + pct(p.cover) + ' of the NT'), () => { sel = g; metRung = null; draw(); });
    };
    const shown = rows.slice(0, 5), rest = rows.slice(5);
    const next = metRung != null ? rows.filter((r) => r.t < metRung && r.p.left)[0] : null;
    return [
      h('p.muted.small', 'Learn the words that occur at least this often. Counts are for you: words you already know are left out.'),
      metRung != null ? h('div.card.stack.gnote',
        h('b', 'You already know all ' + fmt(goalStats({ kind: 'freq', min: metRung }).total) + ' words that occur ' + metRung + ' or more times.'),
        next ? h('p.muted.small', 'That goal is complete, so it wouldn’t teach you anything new. The next step up is:') : h('p.muted.small', 'There is no larger step after this one.'),
        next ? h('div.card', h('b', next.t + ' or more times'), h('div.muted.small', plural(next.p.left, 'new word') + ' · ~' + next.p.days + ' days · reads ' + pct(next.p.cover) + ' of the NT')) : null,
        next ? h('button.btn.primary.block', { onclick: () => { sel = next.g; metRung = null; draw(); } }, 'Choose this one') : null,
        h('button.btn.block', { onclick: () => { metRung = null; draw(); } }, 'Pick something else')) : null,
      h('div.stack', shown.map(mk)),
      rest.length ? h('details', h('summary.muted.small', rest.map((r) => r.t).join(', ') + ' or more'), h('div.stack', { style: { marginTop: '.5rem' } }, rest.map(mk))) : null,
      confirm(!!sel)];
  }

  /* ---- passage ---- */
  let ps = null;                                                       // { c1, v1, c2, v2 }
  function passageTab() {
    const b = D.bookByCode.get(book), last = b.chapters[b.chapters.length - 1];
    if (!ps || ps.book !== book) ps = initial && initial.kind === 'passage' && initial.book === book ? { book, c1: initial.c1, v1: initial.v1 || 1, c2: initial.c2, v2: initial.v2 >= 999 ? (b.chapters.find((c) => c[0] === initial.c2) || last)[1] : initial.v2 } : { book, c1: b.chapters[0][0], v1: 1, c2: b.chapters[0][0], v2: b.chapters[0][1] };
    const nv = (c) => (b.chapters.find((x) => x[0] === c) || [c, 1])[1];
    const chSel = (key, label) => h('select', { 'aria-label': label, onchange: (e) => { ps[key] = +e.target.value; if (key === 'c1') ps.v1 = 1; if (key === 'c2') ps.v2 = nv(ps.c2); fix(); draw(); } }, b.chapters.map(([c]) => h('option', { value: c, selected: c === ps[key] }, c)));
    const vsSel = (key, c, label) => h('select', { 'aria-label': label, onchange: (e) => { ps[key] = +e.target.value; fix(); draw(); } }, Array.from({ length: nv(c) }, (_, i) => h('option', { value: i + 1, selected: i + 1 === ps[key] }, i + 1)));
    const fix = () => { if (ps.c2 < ps.c1 || (ps.c2 === ps.c1 && ps.v2 < ps.v1)) { ps.c2 = ps.c1; ps.v2 = Math.max(ps.v1, 1); } ps.v1 = Math.min(ps.v1, nv(ps.c1)); ps.v2 = Math.min(ps.v2, nv(ps.c2)); };
    fix();
    const g = { kind: 'passage', book, c1: ps.c1, v1: ps.v1, c2: ps.c2, v2: ps.v2 };
    const m = scopeCounts(g); let left = 0; for (const n of m.keys()) if (status(n) !== 'known') left++;
    const read = scopeReadiness(g).known;
    sel = left ? g : null;
    return [
      h('p.muted.small', 'Learn every word in a stretch of text, in the order you meet them.'),
      bookSelect(),
      h('div.row.between.gsel', h('span.muted', 'From'), h('span.row', chSel('c1', 'From chapter'), ':', vsSel('v1', ps.c1, 'From verse'))),
      h('div.row.between.gsel', h('span.muted', 'To'), h('span.row', chSel('c2', 'To chapter'), ':', vsSel('v2', ps.c2, 'To verse'))),
      h('div.card.stack.gnote', h('b', goalLabel(g).replace('–', ' – ')),
        h('div.muted.small', plural(m.size, 'different word') + ' · ' + (left ? left + ' ' + (left === 1 ? 'is' : 'are') + ' new to you' : 'none are new to you')),
        h('div.muted.small', 'You know ' + pct(read) + ' of its running words today.'),
        left ? h('div.muted.small', dayText(daysFor(left)).replace(/^./, (c) => c.toUpperCase()) + ' at ' + perDay() + ' a day.') : h('div.muted.small', 'You already know every word here, so pick a different stretch.')),
      confirm(!!sel)];
  }

  /* ---- section (pericope) ---- */
  let showAll = false;
  function sectionTab() {
    const list = periBook(book);
    const cur = sel && sel.kind === 'pericope' ? sel.id : (initial && initial.kind === 'pericope' && initial.book === book ? initial.id : null);
    const rows = list.map((p) => { const g = { kind: 'pericope', ...periScope(p), title: p.title, id: p.id }; let left = 0; for (const n of scopeCounts(g).keys()) if (status(n) !== 'known') left++; return { p, g, left, read: scopeReadiness(g).known }; });
    if (cur && !sel) { const r = rows.find((x) => x.p.id === cur); if (r && r.left) sel = r.g; }
    const shown = showAll ? rows : rows.slice(0, 6);
    return [
      h('p.muted.small', 'Sections use the English headings. Pick one to learn its words in order.'),
      bookSelect(),
      h('div.stack', shown.map((r) => r.left
        ? option(sel && sel.id === r.p.id, false, periRange(r.p) + ' ' + r.p.title, h('div.muted.small', plural(r.left, 'new word') + ' · you know ' + pct(r.read) + ' of it'), () => { sel = r.g; draw(); })
        : h('button.goal-opt.dis', h('span.grow', h('b', periRange(r.p) + ' ' + r.p.title)), h('span.gpill', 'Already yours')))),
      !showAll && rows.length > 6 ? h('button.btn.ghost.sm', { onclick: () => { showAll = true; draw(); } }, 'and ' + (rows.length - 6) + ' more ⌄') : null,
      rows.length ? null : h('p.muted', 'This book has no section headings.'),
      confirm(!!sel)];
  }

  function draw() {
    clear(root).append(tabs(), ...(tab === 'freq' ? freqTab() : tab === 'passage' ? passageTab() : sectionTab()).filter(Boolean));
  }
  draw();
  return root;
}
