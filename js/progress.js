// The progress sections of Home: numbers, good next reads, passages within reach, growth, recent practice. (There is no Progress tab any more.)
import { clockNow } from './clock.js';
import { D, periScope, periRange, periRef } from './data.js';
import { K, sectionRead, counts, chapterReadiness, scopeReadiness, readinessClass, readinessLabel, streak, goalLabel, noteGoalDone } from './know.js';
import { h, clear, add, pct, todayKey, fmt, fold } from './util.js';
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

/**
 * The sections Home is built from. Each entry draws its own piece and returns null when it has nothing to show; the numbers behind them
 * are worked out once, the first time one is needed.
 */
export function homeSections() {
  const memo = {};
  const chs = () => memo.chs || (memo.chs = allChapters());
  const rows = () => memo.rows || (memo.rows = periRows());
  const totals = () => {
    if (!memo.t) { let k = 0, l = 0, t = 0; for (const c of chs()) { k += c.known * c.tokens; l += c.learning * c.tokens; t += c.tokens; } memo.t = { k, l, t }; }
    return memo.t;
  };

  /** One quiet line inside the goal card: how much of the NT you can read, words known, streak; and the next round number. Null for a brand-new learner. */
  const stats = () => {
    const wc = counts(D.lex.map((l) => l.n)), st = streak();
    if (!wc.known && !st) return null;
    const t = totals(), next = MILESTONES.find((m) => m > wc.known);
    return h('div.statline', h('div', pct(t.k / t.t) + ' readable · ' + fmt(wc.known) + ' words known · ' + st + '-day streak'),
      next ? h('div.muted', fmt(next - wc.known) + ' more word' + (next - wc.known === 1 ? '' : 's') + ' to reach ' + fmt(next)) : null);
  };

  /** Good next reads: two rows, and More › opens up to five in place. */
  const reads = () => {
    const sug = suggestions(5, rows()); if (!sug.length) return null;
    const card = h('div.card.stack.reads'); let all = false;
    const draw = () => {
      card.classList.toggle('open', all);
      add(clear(card), h('div.row.between', h('h2', 'Good next reads'), sug.length > 2 ? h('button.btn.ghost.sm', { 'aria-expanded': String(all), onclick: () => { all = !all; draw(); } }, all ? 'Fewer ⌃' : 'More ›') : null),
        h('div.list', sug.slice(0, all ? 5 : 2).map((r) => suggestionItem(r))));
    };
    draw(); return card;
  };

  const growth = () => { const g = growthCard({ hideEmpty: true }); return g ? fold('Growth', g) : null; };

  /** Passages within reach: every chapter by book, with the known / learning / new bar and the readiness legend. */
  const passages = () => {
    const rs = rows(), rowOf = new Map(rs.map((r) => [r.p.id, r])), t = totals();
    const secReady = rs.filter((r) => r.known >= 0.98).length, secRead = rs.filter((r) => sectionRead(r.p)).length;
    const legend = h('div.legend', [['r4', '≥98% Ready'], ['r3', '95–98% Comfortable'], ['r2', '90–95% Stretch'], ['r1', '80–90% Challenging'], ['r0', '<80% Not yet']].map(([c, tx]) =>
      h('span', h('i.chap.' + c, { style: { width: '.8rem', height: '.8rem', display: 'inline-block' } }), tx)));
    const books = D.books.map((b) => {
      const list = chs().filter((c) => c.book === b);
      const tk = list.reduce((a, c) => a + c.tokens, 0), kn = list.reduce((a, c) => a + c.known * c.tokens, 0), ln = list.reduce((a, c) => a + c.learning * c.tokens, 0);
      return h('details', { open: b.code === K.settings.lastBook || (K.goal && K.goal.book === b.code) },
        h('summary', { style: { display: 'flex', alignItems: 'center', gap: '.7rem', cursor: 'pointer', padding: '.55rem 0' } },
          h('b', { style: { minWidth: '8.5rem' } }, b.name), h('div.bar.grow', h('i.k', { style: { width: pct(kn / tk) } }), h('i.l', { style: { width: pct(ln / tk) } })), h('span.small.muted', { style: { minWidth: '2.6rem', textAlign: 'right' } }, pct(kn / tk))),
        h('div.chaps', list.map((c) => h('a.chap.' + readinessClass(c.known) + (c.read ? '.done' : ''), { href: readHref(b.code, c.ch), title: b.name + ' ' + c.ch + ' — ' + pct(c.known) + ' known (' + readinessLabel(c.known) + ')' }, c.ch))),
        h('details', { style: { marginTop: '.7rem' } }, h('summary', { style: { cursor: 'pointer', fontWeight: 700, fontSize: '.9rem' } }, 'Sections (' + D.periList.filter((p) => p.code === b.code).length + ')'),
          h('div.list', { style: { marginTop: '.5rem' } }, D.periList.filter((p) => p.code === b.code).map((p) => { const r = rowOf.get(p.id);
            return h('a.li', { href: readHref(b.code, p.c1, p.v1) }, h('div.grow', h('div.t', (sectionRead(p) ? '✓ ' : '') + p.title), h('div.s', periRange(p) + ' · ' + r.tokens + ' words')), h('span.rdy.' + readinessClass(r.known), pct(r.known))); }))));
    });
    return fold('Passages within reach · By book',
      h('p.muted.small', secReady + ' of ' + rs.length + ' sections ready · ' + secRead + ' read. Open a book to see every chapter.'),
      h('div', h('div.bar', h('i.k', { style: { width: pct(t.k / t.t) } }), h('i.l', { style: { width: pct(t.l / t.t) } })),
        h('div.legend', { style: { marginTop: '.5rem' } }, h('span', h('i', { style: { background: 'var(--good)' } }), 'known'), h('span', h('i', { style: { background: 'var(--warn)' } }), 'learning'), h('span', h('i', { style: { background: 'var(--bad)', opacity: .55 } }), 'new to you'))),
      legend, h('div.small.muted', 'The bar under each number grows as the chapter gets easier.'), h('div', books));
  };

  /** Recent practice (reviews per day) and, when there are any, the goals you have finished. */
  const recent = () => {
    const days = []; for (let i = 13; i >= 0; i--) { const d = new Date(clockNow()); d.setDate(d.getDate() - i); days.push({ k: todayKey(d), d, r: (K.daily[todayKey(d)] || {}).r || 0 }); }
    const mx = Math.max(10, ...days.map((d) => d.r));
    const act = h('div', { style: { display: 'flex', alignItems: 'flex-end', gap: '4px', height: '4.5rem' }, role: 'img', 'aria-label': 'Reviews per day over the last two weeks' },
      days.map((d) => h('div', { title: d.k + ': ' + d.r + ' reviews', style: { flex: 1, height: Math.max(3, 100 * d.r / mx) + '%', background: d.r ? 'var(--accent)' : 'var(--surface-2)', borderRadius: '4px' } })));
    noteGoalDone();
    const when = (t) => new Date(t).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
    const done = K.goalsDone.length ? fold('Goals completed', h('div.list', [...K.goalsDone].reverse().map((e) => h('div.li', h('div.grow', h('div.t', goalLabel(e.goal)), h('div.s', fmt(e.words) + ' words')), h('span.muted.small', when(e.finished) + (e.days ? ' · ' + e.days + (e.days === 1 ? ' day' : ' days') : ''))))),
      h('p.muted.small', 'A record of what you have finished. Nothing here is graded or timed.')) : null;
    return h('div.stack', fold('Recent practice', act, h('div.muted.small', 'Reviews per day, last 14 days.')), done);
  };

  return { stats, reads, growth, passages, recent };
}
