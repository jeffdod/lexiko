// Home: where you are, what to do today, what to read next.
import { clockNow } from './clock.js';
import { D } from './data.js';
import { K, setting, newToday, streak, scopeReadiness, passageStudy, waitNote, studiedCount, currentGoal, setGoal, setSetting, wordsPace, goalFinished, noteGoalDone, nextGoal, goalStats, ntShareKnown, freqCoverage } from './know.js';
import { goalLabel } from './know.js';
import { goalPicker, previewLine } from './goals.js';
import { h, clear, add, pct, fmt, icon, startButton, fold } from './util.js';
import { growthCard } from './growth.js';
import { backupDue, runBackup, snoozeBackupReminder } from './backup.js';
import { smartAll, counts, upcoming, nextLine } from './smart.js';
import { renderWelcome } from './welcome.js';
import { suggestions, suggestionItem } from './progress.js';
import { readHref } from './reader.js';

const DAY = 86400000;
export const MAX_PER_DAY = 40;

/** A finished goal: what you did, and the next goal already chosen for you (you can pick another). */
function finishedCard(view) {
  const g = currentGoal(), gs = goalStats(g), e = noteGoalDone(K.goal), nxt = nextGoal(g), box = h('div.stack');
  const date = new Date(e.finished).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
  let choosing = false;
  const draw = () => {
    clear(box);
    if (choosing) return add(box, h('div.card.stack', h('div.row.between', h('b', icon('target', 18), ' Choose a goal'), h('button.btn.ghost.sm', { onclick: () => { choosing = false; draw(); } }, 'Cancel')),
      goalPicker({ initial: nxt || g, onPick: async (ng) => { await setGoal(ng); renderHome(view); } })));
    add(box, h('div.card.stack', h('b', icon('target', 18), ' Goal finished'), h('div.goalnum', goalLabel(g)), h('div.bar', h('i.k', { style: { width: '100%' } })),
      h('div.muted', 'All ' + fmt(gs.total) + ' goal words known · finished ' + date + (e.days ? ', after ' + e.days + (e.days === 1 ? ' day.' : ' days.') : '.')),
      g.kind === 'freq' ? h('div.muted', 'You now recognize ' + pct(ntShareKnown()) + ' of the words in the New Testament.') : h('div.row.wrap', h('a.btn.primary.sm', { href: readHref(g.book, g.c1) }, 'Read it'))),
      nxt ? h('div.card.stack.gnext', h('div.muted.small', h('b', 'NEXT GOAL, SUGGESTED')), h('b', goalLabel(nxt)), h('div.muted.small', previewLine(nxt) + (nxt.kind === 'freq' ? ' · reaches ' + pct(freqCoverage(nxt.min)) + ' of the NT' : ''))) : h('div.card', 'You know every word that occurs twice or more. Choose any passage or section as your next goal.'),
      nxt ? h('button.btn.primary.block', { onclick: async () => { await setGoal(nxt); renderHome(view); } }, 'Start this goal') : null,
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

export function renderHome(view) {
  const lvl = setting('level');
  if (lvl == null && !K.settings.levelAsked && !studiedCount('w:')) return renderWelcome(view, (href) => { if (href) location.hash = href; else renderHome(view); });
  const cnt = counts(), due = cnt.words.due + cnt.parse.due;
  const studied = studiedCount('w:');
  const newLeft = Math.max(0, setting('newPerDay') - newToday());
  const needsBackup = backupDue(studied);

  const stack = h('div.stack');
  stack.append(h('div.row.between', { style: { flexWrap: 'nowrap' } },
    h('div', h('h1', { style: { fontSize: '2rem' } }, h('span', { style: { color: 'var(--accent)' } }, 'λ'), 'exiko'), h('div.muted', 'Build your Greek vocabulary. Read the Greek New Testament better.')),
    h('a.btn.icon', { href: '#/search', 'aria-label': 'Search words', style: { flex: 'none' } }, icon('search', 20))));

  if (needsBackup) { const last = K.settings.lastBackup, days = last ? Math.floor((clockNow() - last) / DAY) : 0;
    stack.append(h('div.banner', icon('download', 22), h('div.grow', h('b', 'Back up your progress'), h('div.small', (last ? 'Your last backup was ' + days + ' days ago. ' : 'You have not made a backup yet. ') + 'Your progress is stored only on this device.'),
      h('div.row.wrap', { style: { marginTop: '.6rem' } }, h('button.btn.primary.sm', { onclick: async () => { if (await runBackup()) renderHome(view); } }, 'Back up now'), h('button.btn.sm', { onclick: async () => { await snoozeBackupReminder(); renderHome(view); } }, 'Not now'))))); }

  // 1. the one thing to do now
  const next = smartAll();
  const parts = [due ? due + ' due' : '', newLeft ? newLeft + ' new today' : ''].filter(Boolean);
  stack.append(h('div.card.stack.hero',
    startButton(next),
    h('div.row.wrap', next.kind === 'review' ? null : h('a.btn.sm', { href: '#/learn/practice/review' }, 'Review what I’ve learned'), h('a.btn.sm', { href: '#/learn/practice/preview' }, 'Look ahead at new words')),
    nextLine(upcoming(), due),
    (parts.length || streak()) ? h('div.row.between.muted.small', h('span', parts.join(' · ')), streak() ? h('span.chip.gold', icon('flame', 14), streak() + '-day streak') : null) : null));

  // 2. reading: your goal, or where you left off
  const book = D.bookByCode.get(K.settings.lastBook || 'JHN') || D.bookByCode.get('JHN'), ch = K.settings.lastCh || 1;
  if (K.goal && goalFinished(currentGoal())) {
    stack.append(finishedCard(view));
  } else if (K.goal) {
    const g = currentGoal(), gs = goalStats(g), per = Math.max(1, setting('newPerDay') || 10), days = Math.ceil(gs.left / per);
    const isFreq = g.kind === 'freq', rd = isFreq ? null : scopeReadiness(g), ps = isFreq ? null : passageStudy(g);
    const under = isFreq ? 'You recognize ' + pct(ntShareKnown()) + ' of the words in the New Testament today.' : 'You can read ' + pct(rd.known) + ' of this passage today.';
    const finish = gs.left ? gs.left + ' word' + (gs.left === 1 ? '' : 's') + ' to go · ' + (days <= 1 ? 'about a day' : 'about ' + days + ' days') + ' at ' + per + ' a day.' + (isFreq ? ' Finishing reaches ' + pct(freqCoverage(g.min)) + '.' : '') : 'You know every word in this goal.';
    const fresh = ps ? Math.min(ps.fresh, per) : 0;
    let pacing = false; const wp = wordsPace(), pace = (on) => { pacing = on; pick(false); };
    const box = h('div.card.stack'), pick = (open) => { clear(box); if (open) return add(box, h('div.row.between', h('b', icon('target', 18), ' Choose a goal'), h('button.btn.ghost.sm', { onclick: () => pick(false) }, 'Cancel')), goalPicker({ initial: g, onPick: async (ng) => { await setGoal(ng); renderHome(view); } })); add(box, 
      h('div.row.between', h('b', icon('target', 18), ' ' + goalLabel(g)), h('button.btn.ghost.sm', { onclick: () => pick(true) }, 'Change ›')),
      h('div.goalnum', fmt(gs.known) + ' of ' + fmt(gs.total) + ' goal words known · ' + pct(gs.pct)),
      h('div.bar', h('i.k', { style: { width: pct(gs.pct) } })),
      h('div.muted', under), h('div.finrow', h('div.muted.small', finish + (ps && !ps.ready && gs.left ? ' ' + waitNote(ps) : '') + (wp.slow || wp.paused ? ' ' + wp.why : '')), gs.left ? h('button.btn.ghost.sm', { 'aria-expanded': String(pacing), onclick: () => pace(!pacing) }, pacing ? 'Close ⌃' : 'Adjust ⌄') : null),
      pacing ? paceControl(gs.left, per, () => pace(false), async (n) => { await setSetting('newPerDay', n); renderHome(view); }) : null,
      isFreq ? null : h('div.row.wrap', h('a.btn.primary.sm', { href: '#/learn/passage/' + [g.book, g.c1, g.v1 || 1, g.c2, g.v2 || 999].join('/') }, fresh ? 'Learn its ' + fresh + ' next word' + (fresh === 1 ? '' : 's') : ps.due ? 'Review ' + ps.due + ' due word' + (ps.due === 1 ? '' : 's') : 'Study its words'), h('a.btn.sm', { href: readHref(g.book, g.c1) }, 'Read'))); };
    pick(false); stack.append(box);
  } else {
    const box = h('div.card.stack'), g = currentGoal(), draw = (open) => { clear(box); if (open) return add(box, h('div.row.between', h('b', icon('target', 18), ' Choose a goal'), h('button.btn.ghost.sm', { onclick: () => draw(false) }, 'Cancel')), goalPicker({ initial: g, onPick: async (ng) => { await setGoal(ng); renderHome(view); } })); add(box, h('div.row.between', h('div', h('b', 'Keep reading'), h('div.muted.small', book.name + ' ' + ch)), h('a.btn.primary.sm', { href: readHref(book.code, ch) }, icon('read', 16), 'Read')), h('button.btn.ghost.sm', { onclick: () => draw(true) }, 'Choose a goal ›')); };
    draw(false); stack.append(box);
  }

  // 3. how you're growing
  if (studied) stack.append(growthCard({ compact: true }));

  // 4. everything else stays one tap away, out of the way
  const sug = suggestions(3);
  if (sug.length) stack.append(fold('Good next reads', h('div.list', sug.map((r) => suggestionItem(r)))));
  stack.append(h('a.small.center', { href: '#/help', style: { textAlign: 'center' } }, 'How lexiko works ›'));
  clear(view).append(stack);
}
