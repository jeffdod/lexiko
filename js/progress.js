// Progress: word knowledge, which parts of the NT are within reach, goals, recent activity.
import { D, scopeLabel, periScope, periRange, periRef } from './data.js';
import { K, sectionRead, counts, chapterReadiness, scopeReadiness, readinessClass, readinessLabel, setGoal, streak, currentGoal, goalStats, goalLabel, noteGoalDone } from './know.js';
import { goalPicker } from './goals.js';
import { h, clear, add, pct, icon, todayKey, fmt } from './util.js';
import { readHref } from './reader.js';
import { growthCard } from './growth.js';


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
  return rows.filter((r) => !sectionRead(r.p) && r.tokens >= 40 && r.known >= 0.85 && r.known < 0.995)
    .sort((a, b) => score(a) - score(b) || a.p.bi - b.p.bi || a.p.c1 - b.p.c1 || a.p.v1 - b.p.v1).slice(0, n);
}
export const suggestionItem = (r, withChip = true) => h('a.li', { href: readHref(r.p.code, r.p.c1, r.p.v1) },
  h('div.grow', h('div.t', r.p.title), h('div.s', periRef(r.p) + (r.distinctUnknown ? ' · ' + r.distinctUnknown + ' new word' + (r.distinctUnknown === 1 ? '' : 's') : ' · all familiar'))),
  withChip ? h('span.rdy.' + readinessClass(r.known), pct(r.known)) : null);

const MILESTONES = [50, 100, 250, 500, 750, 1000, 1500, 2000, 2500, 3000, 4000, 5000];
/** One calm sentence about where the person stands: their goal passage if they have one, else the whole text. */
function milestone(goal, known, ratio) {
  if (!known) return null;
  const next = MILESTONES.find((m) => m > known);
  const nextLine = next ? ' ' + fmt(next - known) + ' more word' + (next - known === 1 ? '' : 's') + ' to reach ' + fmt(next) + '.' : '';
  if (goal) {
    const rd = scopeReadiness(goal), lab = scopeLabel(goal);
    return rd.known >= 0.98 ? 'You’re ready to read ' + lab + ': you know ' + pct(rd.known) + ' of its words.'
      : 'You know ' + pct(rd.known) + ' of the words in ' + lab + '.' + (rd.distinctUnknown ? ' ' + fmt(rd.distinctUnknown) + ' word' + (rd.distinctUnknown === 1 ? '' : 's') + ' still to learn.' : '');
  }
  return 'You know ' + fmt(known) + ' word' + (known === 1 ? '' : 's') + ', which makes up ' + pct(ratio) + ' of the New Testament text.' + nextLine;
}

export function renderProgress(view) {
  const chs = allChapters();
  const rows = periRows(), rowOf = new Map(rows.map((r) => [r.p.id, r]));
  const secReady = rows.filter((r) => r.known >= 0.98).length, secRead = rows.filter((r) => sectionRead(r.p)).length;
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
          return h('a.li', { href: readHref(b.code, p.c1, p.v1) }, h('div.grow', h('div.t', (sectionRead(p) ? '✓ ' : '') + p.title), h('div.s', periRange(p) + ' · ' + r.tokens + ' words')), h('span.rdy.' + readinessClass(r.known), pct(r.known))); }))));
    return d;
  });

  // goal: one set of words you are working toward (frequency, passage or section)
  const goal = currentGoal(), gs = goalStats(goal), book = goal.book ? goal : null;
  const goalCard = h('div.card.stack');
  const drawGoal = (changing = false) => {
    add(clear(goalCard), h('div.row.between', h('h2', icon('target', 20), ' Goal'), h('button.btn.ghost.sm', { onclick: () => drawGoal(!changing) }, changing ? 'Cancel' : 'Change ›')));
    if (changing) { add(goalCard, goalPicker({ initial: goal, onPick: async (g) => { await setGoal(g); renderProgress(view); } })); return; }
    add(goalCard, h('b', goalLabel(goal)), h('div.bar', h('i.k', { style: { width: pct(gs.pct) } })),
      h('div.row.between', h('b', fmt(gs.known) + ' of ' + fmt(gs.total) + ' goal words known'), h('b', pct(gs.pct))),
      book ? h('div.row.wrap', h('a.btn.primary.sm', { href: '#/learn/passage/' + [book.book, book.c1, book.v1 || 1, book.c2, book.v2 || 999].join('/') }, 'Study its words'), h('a.btn.sm', { href: readHref(book.book, book.c1) }, 'Read')) : null);
  };
  drawGoal();

  // goals completed: a plain record, nothing graded
  noteGoalDone();
  const when = (t) => new Date(t).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
  const doneCard = K.goalsDone.length ? h('div.card.stack', h('h2', 'Goals completed'),
    h('div.list', [...K.goalsDone].reverse().map((e) => h('div.li', h('div.grow', h('div.t', goalLabel(e.goal)), h('div.s', fmt(e.words) + ' words')), h('span.muted.small', when(e.finished) + (e.days ? ' · ' + e.days + (e.days === 1 ? ' day' : ' days') : ''))))),
    h('p.muted.small', 'A record of what you have finished. Nothing here is graded or timed.')) : null;

  // activity
  const days = []; for (let i = 13; i >= 0; i--) { const d = new Date(); d.setDate(d.getDate() - i); days.push({ k: todayKey(d), d, r: (K.daily[todayKey(d)] || {}).r || 0 }); }
  const mx = Math.max(10, ...days.map((d) => d.r));
  const act = h('div', { style: { display: 'flex', alignItems: 'flex-end', gap: '4px', height: '4.5rem' }, role: 'img', 'aria-label': 'Reviews per day over the last two weeks' },
    days.map((d) => h('div', { title: d.k + ': ' + d.r + ' reviews', style: { flex: 1, height: Math.max(3, 100 * d.r / mx) + '%', background: d.r ? 'var(--accent)' : 'var(--surface-2)', borderRadius: '4px' } })));

  const sug = suggestions(5, rows);
  const mile = milestone(K.goal && K.goal.book ? K.goal : null, wc.known, kTok / tot);
  clear(view).append(h('div.pagehead', h('h1', 'Progress')), h('div.stack',
    mile ? h('p.milestone', mile) : null,
    h('div.kpis',
      h('div.kpi', h('b', pct(kTok / tot)), h('span', 'of NT words you can read')),
      h('div.kpi', h('b', fmt(wc.known)), h('span', 'of ' + fmt(wc.total) + ' New Testament words known')),
      h('div.kpi', h('b', secReady + '/' + rows.length), h('span', 'sections ready (98%+)')),
      h('div.kpi', h('b', secRead), h('span', 'sections read')),
      h('div.kpi', h('b', streak()), h('span', 'day streak'))),
    h('div.card', h('div.bar', h('i.k', { style: { width: pct(kTok / tot) } }), h('i.l', { style: { width: pct(lTok / tot) } })),
      h('div.legend', { style: { marginTop: '.5rem' } }, h('span', h('i', { style: { background: 'var(--good)' } }), 'known'), h('span', h('i', { style: { background: 'var(--warn)' } }), 'learning'), h('span', h('i', { style: { background: 'var(--bad)', opacity: .55 } }), 'new to you'))),
    growthCard(),
    goalCard,
    doneCard,
    sug.length ? h('div.card.stack', h('h2', 'Good next reads'), h('p.muted.small', 'Sections where you already know most of the words — the sweet spot for reading with a few lookups.'), h('div.list', sug.map((r) => suggestionItem(r)))) : null,
    h('div.card', h('h2', 'Passages within reach'), legend, h('div', { style: { marginTop: '.4rem' } }, books)),
    h('div.card', h('h2', 'Recent practice'), act, h('div.muted.small', { style: { marginTop: '.4rem' } }, 'Reviews per day, last 14 days.')),
  ));
}
