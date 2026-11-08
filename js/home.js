// Home: where you are, what to do today, what to read next.
import { clockNow } from './clock.js';
import { D } from './data.js';
import { K, setting, newToday, streak, scopeReadiness, passageStudy, waitNote, studiedCount, currentGoal, setGoal, setSetting, wordsPace, goalFinished, noteGoalDone, nextGoal, goalStats, ntShareKnown, freqCoverage } from './know.js';
import { goalLabel } from './know.js';
import { goalPicker, previewLine, miniGoalCard } from './goals.js';
import { h, clear, add, pct, fmt, icon } from './util.js';
import { backupDue, runBackup, snoozeBackupReminder } from './backup.js';
import { counts, smart } from './smart.js';
import { renderWelcome } from './welcome.js';
import { readHref } from './reader.js';

const DAY = 86400000;
export const MAX_PER_DAY = 40;

/** A finished goal: what you did, and the next goal already chosen for you (you can pick another). */
function finishedCard(redraw) {
  const g = currentGoal(), gs = goalStats(g), e = noteGoalDone(K.goal), nxt = nextGoal(g), box = h('div.stack');
  const date = new Date(e.finished).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
  let choosing = false;
  const draw = () => {
    clear(box);
    if (choosing) return add(box, h('div.card.stack', h('div.row.between', h('b', icon('target', 18), ' Choose a goal'), h('button.btn.ghost.sm', { onclick: () => { choosing = false; draw(); } }, 'Cancel')),
      goalPicker({ initial: nxt || g, onPick: async (ng) => { await setGoal(ng); redraw(); } })));
    add(box, h('div.card.stack', h('b', icon('target', 18), ' Goal finished'), h('div.goalnum', goalLabel(g)), h('div.bar', h('i.k', { style: { width: '100%' } })),
      h('div.muted', 'All ' + fmt(gs.total) + ' goal words known · finished ' + date + (e.days ? ', after ' + e.days + (e.days === 1 ? ' day.' : ' days.') : '.')),
      g.kind === 'freq' ? h('div.muted', 'You now recognize ' + pct(ntShareKnown()) + ' of the words in the New Testament.') : h('div.row.wrap', h('a.btn.primary.sm', { href: readHref(g.book, g.c1) }, 'Read it'))),
      nxt ? h('div.card.stack.gnext', h('div.muted.small', h('b', 'NEXT GOAL, SUGGESTED')), h('b', goalLabel(nxt)), h('div.muted.small', previewLine(nxt) + (nxt.kind === 'freq' ? ' · reaches ' + pct(freqCoverage(nxt.min)) + ' of the NT' : ''))) : h('div.card', 'You know every word that occurs twice or more. Choose any passage or section as your next goal.'),
      nxt ? h('button.btn.primary.block', { onclick: async () => { await setGoal(nxt); redraw(); } }, 'Start this goal') : null,
      h('button.btn.block', { onclick: () => { choosing = true; draw(); } }, 'Choose a different goal ›'));
  };
  draw(); return box;
}

/** The finish-by control: move the finish time up or down by weeks and days; the daily new words follow (words left ÷ days, rounded up, at most 40). */
function paceControl(left, per, cancel, save) {
  const perFor = (d) => Math.max(1, Math.min(MAX_PER_DAY, Math.ceil(left / d)));
  const maxDays = Math.min(left, 365);
  const daysFor = (n) => Math.ceil(left / n);
  let cur = Math.max(1, Math.min(MAX_PER_DAY, per));
  const box = h('div.pacectl');
  const move = (delta) => {                                       // keep stepping until the daily number actually changes
    if (delta < 0 && cur >= MAX_PER_DAY) return;
    let d = daysFor(cur);
    for (let i = 0; i < 400; i++) { d += delta; if (d < 1 || d > maxDays) return; const n = perFor(d); if (n !== cur) { cur = n; return; } }
  };
  const draw = () => {
    const d = daysFor(cur), w = Math.floor(d / 7), r = d % 7, date = new Date(clockNow() + d * DAY).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
    const st = (n, unit, delta, key = unit) => h('div.pst', h('button.pacebtn', { 'aria-label': 'Fewer ' + key, disabled: cur >= MAX_PER_DAY || daysFor(cur) - delta < 1, onclick: () => { move(-delta); draw(); } }, '−'),
      h('div', h('b', String(n)), h('span.u', unit)), h('button.pacebtn', { 'aria-label': 'More ' + key, disabled: daysFor(cur) + delta > maxDays, onclick: () => { move(delta); draw(); } }, '+'));
    add(clear(box), h('b', 'Finish in'), h('div.pacesteps', st(w, w === 1 ? 'week' : 'weeks', 7, 'weeks'), st(r, r === 1 ? 'day' : 'days', 1, 'days')),
      h('div.paceres', h('div', d + (d === 1 ? ' day' : ' days') + ' · around ' + date), h('div.perday', cur + ' new word' + (cur === 1 ? '' : 's') + ' a day')),
      cur >= MAX_PER_DAY ? h('div.pacewarn', MAX_PER_DAY + ' a day is the most lexiko will set. For a quicker finish, choose a smaller goal.') : null,
      h('div.muted.small', 'Words you’ve just learned still come back for review. If reviews pile up, new words slow down on their own.'),
      h('div.row.wrap', h('button.btn.primary.sm', { onclick: () => save(cur) }, 'Use this pace'), h('button.btn.sm', { onclick: cancel }, 'Cancel')));
  };
  draw(); return box;
}

/** The goal card for the Vocabulary page: just what you act on. Which goal, how much is left, and the pace control. (The numbers and Change › live on Home and Progress.) */
export function goalDetailCard(redraw) {
  if (!K.goal) return miniGoalCard(redraw);
  if (goalFinished(currentGoal())) return finishedCard(redraw);
  const g = currentGoal(), gs = goalStats(g), per = Math.max(1, setting('newPerDay') || 10), days = Math.ceil(gs.left / per);
  const ps = g.kind === 'freq' ? null : passageStudy(g), wp = wordsPace();
  const finish = gs.left ? gs.left + ' word' + (gs.left === 1 ? '' : 's') + ' to go · ' + (days <= 1 ? 'about a day' : 'about ' + days + ' days') + ' at ' + per + ' a day' : 'You know every word in this goal.';
  const box = h('div.card.stack'); let pacing = false;
  const draw = () => {
    clear(box);
    add(box, h('div', h('span.glabel', icon('target', 16), 'Goal')), h('b', goalLabel(g)),
      h('div.finrow', h('div.muted.small', finish + (ps && !ps.ready && gs.left ? ' ' + waitNote(ps) : '') + (wp.slow || wp.paused ? ' ' + wp.why : '')), gs.left ? h('button.btn.ghost.sm', { 'aria-expanded': String(pacing), onclick: () => { pacing = !pacing; draw(); } }, pacing ? 'Close ⌃' : 'Adjust ⌄') : null),
      pacing ? paceControl(gs.left, per, () => { pacing = false; draw(); }, async (n) => { await setSetting('newPerDay', n); redraw(); }) : null);
  };
  draw(); return box;
}

/** The goal on Home: a short summary. A tap opens Progress; Change › opens the picker in place. */
/** For a new person, until the first session is finished: one clear next step. */
const startHere = (n, ci = 0) => h('div.card.stack', h('b', { style: { fontSize: '1.05rem' } }, 'Start here'),
  h('p.muted.small', { style: { margin: 0 } }, (ci ? fmt(n + ci) + ' words are ready (' + fmt(n) + ' new · ' + fmt(ci) + (ci === 1 ? ' check-in' : ' check-ins') + ')' : n ? fmt(n) + ' new ' + (n === 1 ? 'word is' : 'words are') + ' ready' : 'Today’s new words are ready') + '. Start with a short session.'),
  h('div.row', h('a.btn.primary', { href: smart('words').href }, 'Start with today’s new words')));
function goalSummary(view) {
  if (K.goal && goalFinished(currentGoal())) return finishedCard(() => renderHome(view));
  const box = h('div.card.stack'), g = currentGoal();
  const draw = (open) => {
    clear(box);
    if (open) return add(box, h('div.row.between', h('b', icon('target', 18), ' Choose a goal'), h('button.btn.ghost.sm', { onclick: (e) => { e.stopPropagation(); draw(false); } }, 'Cancel')), goalPicker({ initial: g, onPick: async (ng) => { await setGoal(ng); renderHome(view); } }));
    if (!K.goal) return add(box, h('b', icon('target', 18), ' Set a goal'), h('div.muted.small', 'Pick the words you want to know, by how common they are or by the passage you want to read.'), h('button.btn.primary', { onclick: () => draw(true) }, 'Choose a goal ›'));
    const gs = goalStats(g), per = Math.max(1, setting('newPerDay') || 10), days = Math.ceil(gs.left / per);
    add(box, h('div.row.between', { style: { flexWrap: 'nowrap' } }, h('span.glabel', icon('target', 16), 'Goal'), h('button.btn.ghost.sm', { style: { flex: 'none' }, onclick: (e) => { e.stopPropagation(); draw(true); } }, 'Change ›')), h('b', goalLabel(g)),
      h('div.goalnum', fmt(gs.known) + ' of ' + fmt(gs.total) + ' goal words known · ' + pct(gs.pct)),
      h('div.bar', h('i.k', { style: { width: pct(gs.pct) } })),
      h('div.muted.small', gs.left ? gs.left + ' word' + (gs.left === 1 ? '' : 's') + ' to go · ' + (days <= 1 ? 'about a day' : 'about ' + days + ' days') + ' at ' + per + ' a day' : 'You know every word in this goal.'));
  };
  draw(false); return box;
}

export function renderHome(view) {
  const lvl = setting('level');
  if (lvl == null && !K.settings.levelAsked && !studiedCount('w:')) return renderWelcome(view, (href) => { if (href) location.hash = href; else renderHome(view); });
  const cnt = counts();
  const studied = studiedCount('w:');
  const needsBackup = backupDue(studied);

  const stack = h('div.stack');
  stack.append(h('div.row.between', { style: { flexWrap: 'nowrap' } },
    h('h1', { style: { fontSize: '1.7rem', margin: 0 } }, h('span', { style: { color: 'var(--accent)' } }, 'λ'), 'exiko')));

  if (needsBackup) { const last = K.settings.lastBackup, days = last ? Math.floor((clockNow() - last) / DAY) : 0;
    stack.append(h('div.banner', icon('download', 22), h('div.grow', h('b', 'Back up your progress'), h('div.small', (last ? 'Your last backup was ' + days + ' days ago. ' : 'You have not made a backup yet. ') + 'Your progress is stored only on this device.'),
      h('div.row.wrap', { style: { marginTop: '.6rem' } }, h('button.btn.primary.sm', { onclick: async () => { if (await runBackup()) renderHome(view); } }, 'Back up now'), h('button.btn.sm', { onclick: async () => { await snoozeBackupReminder(); renderHome(view); } }, 'Not now'))))); }

  // 1. the goal: a summary, and a tap opens Progress
  if (!cnt.words.studied && !cnt.words.due) stack.append(startHere(cnt.words.fresh, cnt.words.checkins));
  stack.append(goalSummary(view));

  // 2. the areas
  const area = (href, ic, title, sub, badges = []) => { const bs = badges.filter(Boolean); return h('a.area', { href }, icon(ic, 30), h('div', h('b', title), h('span', sub)), bs.length ? h('div.badges', bs.map((t) => h('em.due', t))) : null); };
  const wordsBadges = [cnt.words.total ? cnt.words.total + (cnt.words.total === 1 ? ' word' : ' words') : ''];      // one total, always the same as the count inside the session
  const nothingYet = !cnt.words.studied && !cnt.parse.due && !cnt.parse.fresh;
  stack.append(area('#/learn/words', 'learn', 'Vocabulary', 'Learn, review, look ahead', wordsBadges),
    area('#/parse', 'text', 'Parsing', nothingYet ? 'Opens as you learn words' : 'Practice forms and unlock verb types', [cnt.parse.total ? cnt.parse.total + (cnt.parse.total === 1 ? ' form' : ' forms') : '']),
    area('#/reference', 'table', 'Reference', 'Glossary, charts and paradigms'));
  stack.append(h('a.small.center', { href: '#/help', style: { textAlign: 'center' } }, 'How lexiko works ›'));
  clear(view).append(stack);
}
