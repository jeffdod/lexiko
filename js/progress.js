// Progress: word knowledge, which parts of the NT are within reach, goals, recent activity.
import { D, scopeLabel, periScope, periRange, periRef } from './data.js';
import { K, status, counts, chapterReadiness, scopeReadiness, readinessClass, readinessLabel, setGoal, streak, setting } from './know.js';
import { h, clear, pct, icon, todayKey } from './util.js';
import { readHref } from './reader.js';
import { growthCard } from './growth.js';

const fmt = (n) => n.toLocaleString('en-US');

/** Readiness for every chapter, computed once per render. */
export function allChapters() {
  const out = [];
  for (const b of D.books) for (const [ch] of b.chapters) {
    const r = chapterReadiness(b.code, ch); out.push({ book: b, ch, ...r, read: !!K.read[b.code + ':' + ch] });
  }
  return out;
}
/** Readiness of every section (pericope). */
export function periRows() {
  return D.periList.map((p) => ({ p, ...scopeReadiness(periScope(p)) }));
}
/** Sections worth reading next: unread, mostly familiar, nearest the ~97% comfort zone. */
export function suggestions(n = 3, rows = periRows()) {
  const score = (r) => Math.abs(r.known - 0.97) - (r.known >= 0.9 ? 0.02 : 0);
  return rows.filter((r) => !K.read[r.p.id] && r.tokens >= 40 && r.known >= 0.85 && r.known < 0.995)
    .sort((a, b) => score(a) - score(b) || a.p.bi - b.p.bi || a.p.c1 - b.p.c1 || a.p.v1 - b.p.v1).slice(0, n);
}
export const suggestionItem = (r, withChip = true) => h('a.li', { href: readHref(r.p.code, r.p.c1, r.p.v1) },
  h('div.grow', h('div.t', r.p.title), h('div.s', periRef(r.p) + (r.distinctUnknown ? ' · ' + r.distinctUnknown + ' new word' + (r.distinctUnknown === 1 ? '' : 's') : ' · all familiar'))),
  withChip ? h('span.rdy.' + readinessClass(r.known), pct(r.known)) : null);

export function renderProgress(view) {
  const chs = allChapters();
  const rows = periRows(), rowOf = new Map(rows.map((r) => [r.p.id, r]));
  const secReady = rows.filter((r) => r.known >= 0.98).length, secRead = rows.filter((r) => K.read[r.p.id]).length;
  const wc = counts(D.lex.map((l) => l.n));
  let kTok = 0, lTok = 0, tot = 0;
  for (const c of chs) { kTok += c.known * c.tokens; lTok += c.learning * c.tokens; tot += c.tokens; }
  const readChaps = chs.filter((c) => c.read).length;

  const legend = h('div.legend', [['r4', '≥98% Ready'], ['r3', '95–98% Comfortable'], ['r2', '90–95% Stretch'], ['r1', '80–90% Challenging'], ['r0', '<80% Not yet']].map(([c, t]) =>
    h('span', h('i.chap.' + c, { style: { width: '.8rem', height: '.8rem', display: 'inline-block' } }), t)));

  const books = D.books.map((b) => {
    const list = chs.filter((c) => c.book === b);
    const tk = list.reduce((a, c) => a + c.tokens, 0), kn = list.reduce((a, c) => a + c.known * c.tokens, 0), ln = list.reduce((a, c) => a + c.learning * c.tokens, 0);
    const d = h('details', { open: b.code === K.settings.lastBook || (K.goal && K.goal.book === b.code) },
      h('summary', { style: { display: 'flex', alignItems: 'center', gap: '.7rem', cursor: 'pointer', padding: '.55rem 0' } },
        h('b', { style: { minWidth: '8.5rem' } }, b.name), h('div.bar.grow', h('i.k', { style: { width: pct(kn / tk) } }), h('i.l', { style: { width: pct(ln / tk) } })), h('span.small.muted', { style: { minWidth: '2.6rem', textAlign: 'right' } }, pct(kn / tk))),
      h('div.chaps', list.map((c) => h('a.chap.' + readinessClass(c.known) + (c.read ? '.done' : ''), { href: readHref(b.code, c.ch), title: b.name + ' ' + c.ch + ' — ' + pct(c.known) + ' known (' + readinessLabel(c.known) + ')' }, c.ch))),
      h('details', { style: { marginTop: '.7rem' } }, h('summary', { style: { cursor: 'pointer', fontWeight: 700, fontSize: '.9rem' } }, 'Sections (' + D.periList.filter((p) => p.code === b.code).length + ')'),
        h('div.list', { style: { marginTop: '.5rem' } }, D.periList.filter((p) => p.code === b.code).map((p) => { const r = rowOf.get(p.id);
          return h('a.li', { href: readHref(b.code, p.c1, p.v1) }, h('div.grow', h('div.t', (K.read[p.id] ? '✓ ' : '') + p.title), h('div.s', periRange(p) + ' · ' + r.tokens + ' words')), h('span.rdy.' + readinessClass(r.known), pct(r.known))); }))));
    return d;
  });

  // goal
  const goal = K.goal && K.goal.book ? K.goal : null;
  const goalCard = h('div.card.stack', h('h2', icon('target', 20), ' Goal'));
  const bookSel = h('select', { 'aria-label': 'Book' }, D.books.map((b) => h('option', { value: b.code, selected: goal ? goal.book === b.code : b.code === 'JHN' }, b.name)));
  const c1 = h('select', { 'aria-label': 'From chapter' }), c2 = h('select', { 'aria-label': 'To chapter' });
  const fill = () => { const b = D.bookByCode.get(bookSel.value); [c1, c2].forEach((s, i) => { clear(s).append(...b.chapters.map(([c]) => h('option', { value: c, selected: goal && goal.book === b.code ? c === (i ? goal.c2 : goal.c1) : (i ? c === b.chapters[b.chapters.length - 1][0] : c === 1) }, c))); }); };
  fill(); bookSel.addEventListener('change', () => { fill(); });
  if (goal) {
    const rd = chs.filter((c) => c.book.code === goal.book && c.ch >= goal.c1 && c.ch <= goal.c2);
    const tk = rd.reduce((a, c) => a + c.tokens, 0), kn = rd.reduce((a, c) => a + c.known * c.tokens, 0);
    const done = rd.filter((c) => c.read).length;
    goalCard.append(h('div', h('div.row.between', h('b', 'Read ' + scopeLabel(goal)), h('span.rdy.' + readinessClass(kn / tk), pct(kn / tk) + ' known')),
      h('div.bar', { style: { margin: '.5rem 0' } }, h('i.k', { style: { width: pct(kn / tk) } })), h('div.muted.small', done + ' of ' + rd.length + ' chapters read')),
      h('div.row.wrap', h('a.btn.primary.sm', { href: '#/learn/passage/' + [goal.book, goal.c1, 1, goal.c2, 999].join('/') }, 'Study its words'), h('a.btn.sm', { href: readHref(goal.book, goal.c1) }, 'Read'),
        h('button.btn.ghost.sm', { onclick: async () => { await setGoal(null); renderProgress(view); } }, 'Clear')));
  } else goalCard.append(h('p.muted.small', 'Choose a passage you want to be able to read. Lexiko will steer your study towards it.'));
  goalCard.append(h('div.row.wrap', bookSel, c1, h('span.muted', 'to'), c2, h('button.btn.sm', { onclick: async () => { const a = +c1.value, b = Math.max(a, +c2.value); await setGoal({ book: bookSel.value, c1: a, v1: 1, c2: b, v2: 999 }); renderProgress(view); } }, goal ? 'Change goal' : 'Set goal')));

  // activity
  const days = []; for (let i = 13; i >= 0; i--) { const d = new Date(); d.setDate(d.getDate() - i); days.push({ k: todayKey(d), d, r: (K.daily[todayKey(d)] || {}).r || 0 }); }
  const mx = Math.max(10, ...days.map((d) => d.r));
  const act = h('div', { style: { display: 'flex', alignItems: 'flex-end', gap: '4px', height: '4.5rem' }, role: 'img', 'aria-label': 'Reviews per day over the last two weeks' },
    days.map((d) => h('div', { title: d.k + ': ' + d.r + ' reviews', style: { flex: 1, height: Math.max(3, 100 * d.r / mx) + '%', background: d.r ? 'var(--accent)' : 'var(--surface-2)', borderRadius: '4px' } })));

  const sug = suggestions(5, rows);
  clear(view).append(h('div.pagehead', h('h1', 'Progress')), h('div.stack',
    h('div.kpis',
      h('div.kpi', h('b', pct(kTok / tot)), h('span', 'of NT words you can read')),
      h('div.kpi', h('b', fmt(wc.known)), h('span', 'of ' + fmt(wc.total) + ' words known')),
      h('div.kpi', h('b', secReady + '/' + rows.length), h('span', 'sections ready (98%+)')),
      h('div.kpi', h('b', secRead), h('span', 'sections read')),
      h('div.kpi', h('b', streak()), h('span', 'day streak'))),
    h('div.card', h('div.bar', h('i.k', { style: { width: pct(kTok / tot) } }), h('i.l', { style: { width: pct(lTok / tot) } })),
      h('div.legend', { style: { marginTop: '.5rem' } }, h('span', h('i', { style: { background: 'var(--good)' } }), 'known'), h('span', h('i', { style: { background: 'var(--warn)' } }), 'learning'), h('span', h('i', { style: { background: 'var(--bad)', opacity: .55 } }), 'new to you'))),
    growthCard(),
    goalCard,
    sug.length ? h('div.card.stack', h('h2', 'Good next reads'), h('p.muted.small', 'Sections where you already know most of the words — the sweet spot for reading with a few lookups.'), h('div.list', sug.map((r) => suggestionItem(r)))) : null,
    h('div.card', h('h2', 'Passages within reach'), legend, h('div', { style: { marginTop: '.4rem' } }, books)),
    h('div.card', h('h2', 'Recent practice'), act, h('div.muted.small', { style: { marginTop: '.4rem' } }, 'Reviews per day, last 14 days.')),
  ));
}
