// Home: where you are, what to do today, what to read next.
import { D, scopeLabel } from './data.js';
import { K, setSetting, setting, dueCards, newToday, streak, scopeReadiness, readinessClass, readinessLabel, studiedCount } from './know.js';
import { h, clear, pct, icon, startButton, fold } from './util.js';
import { growthCard } from './growth.js';
import { smartAll, counts } from './smart.js';
import { renderWelcome } from './welcome.js';
import { suggestions, suggestionItem } from './progress.js';
import { readHref } from './reader.js';

const DAY = 86400000;

export function renderHome(view) {
  const lvl = setting('level');
  if (lvl == null && !K.settings.levelAsked && !studiedCount('w:')) return renderWelcome(view, (href) => { if (href) location.hash = href; else renderHome(view); });
  const cnt = counts(), due = cnt.words.due + cnt.parse.due + cnt.parts.due;
  const studied = studiedCount('w:');
  const newLeft = Math.max(0, setting('newPerDay') - newToday());
  const goal = K.goal && K.goal.book ? K.goal : null;
  const lastBackup = K.settings.lastBackup;
  const needsBackup = studied >= 15 && (!lastBackup || Date.now() - lastBackup > 14 * DAY);

  const stack = h('div.stack');
  stack.append(h('div.row.between', { style: { flexWrap: 'nowrap' } },
    h('div', h('h1', { style: { fontSize: '2rem' } }, h('span', { style: { color: 'var(--accent)' } }, 'λ'), 'exiko'), h('div.muted', 'Build your Greek vocabulary. Read the Greek New Testament better.')),
    h('a.btn.icon', { href: '#/search', 'aria-label': 'Search words', style: { flex: 'none' } }, icon('search', 20))));

  if (needsBackup) stack.append(h('div.banner', icon('download', 22), h('div.grow', h('b', 'Back up your progress'), h('div.small', 'It lives only on this device. A backup takes two seconds.')), h('a.btn.sm', { href: '#/settings' }, 'Back up')));

  // 1. the one thing to do now
  const parts = [due ? due + ' due' : '', newLeft ? newLeft + ' new today' : ''].filter(Boolean);
  stack.append(h('div.card.stack.hero',
    startButton(smartAll()),
    (parts.length || streak()) ? h('div.row.between.muted.small', h('span', parts.join(' · ')), streak() ? h('span.chip.gold', icon('flame', 14), streak() + '-day streak') : null) : null));

  // 2. reading: your goal, or where you left off
  const book = D.bookByCode.get(K.settings.lastBook || 'JHN') || D.bookByCode.get('JHN'), ch = K.settings.lastCh || 1;
  if (goal) {
    const rd = scopeReadiness(goal);
    stack.append(h('div.card.stack', h('div.row.between', h('b', icon('target', 18), ' ' + scopeLabel(goal)), h('span.rdy.' + readinessClass(rd.known), pct(rd.known) + ' · ' + readinessLabel(rd.known))),
      h('div.bar', h('i.k', { style: { width: pct(rd.known) } }), h('i.l', { style: { width: pct(rd.learning) } })),
      h('div.muted.small', rd.distinctUnknown ? rd.distinctUnknown + ' words still to learn before this reads comfortably.' : 'You know every word. Go read it!'),
      h('div.row.wrap', h('a.btn.primary.sm', { href: '#/learn/passage/' + [goal.book, goal.c1, goal.v1 || 1, goal.c2, goal.v2 || 999].join('/') }, rd.distinctUnknown ? 'Learn the ' + rd.distinctUnknown + ' new words' : 'Study its words'), h('a.btn.sm', { href: readHref(goal.book, goal.c1) }, 'Read'))));
  } else {
    stack.append(h('div.card.stack', h('div.row.between', h('div', h('b', 'Keep reading'), h('div.muted.small', book.name + ' ' + ch)), h('a.btn.primary.sm', { href: readHref(book.code, ch) }, icon('read', 16), 'Read')),
      h('a.small', { href: '#/progress' }, 'Set a reading goal ›')));
  }

  // 3. how you're growing
  if (studied) stack.append(growthCard({ compact: true }));

  // 4. everything else stays one tap away, out of the way
  const sug = suggestions(3);
  if (sug.length) stack.append(fold('Good next reads', h('div.list', sug.map((r) => suggestionItem(r)))));
  clear(view).append(stack);
}
