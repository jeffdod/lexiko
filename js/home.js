// Home: where you are, what to do today, what to read next.
import { D, scopeLabel } from './data.js';
import { K, setSetting, setting, dueCards, newToday, streak, scopeReadiness, readinessClass, readinessLabel } from './know.js';
import { h, clear, pct, icon, startButton } from './util.js';
import { smartAll, counts } from './smart.js';
import { levelPicker } from './settings.js';
import { suggestions, suggestionItem } from './progress.js';
import { readHref } from './reader.js';

const DAY = 86400000;

export function renderHome(view) {
  const lvl = setting('level');
  const cnt = counts(), due = cnt.words.due + cnt.parse.due + cnt.parts.due;
  const studied = [...K.cards.keys()].filter((k) => k.startsWith('w:')).length;
  const newLeft = Math.max(0, setting('newPerDay') - newToday());
  const goal = K.goal && K.goal.book ? K.goal : null;
  const lastBackup = K.settings.lastBackup;
  const needsBackup = studied >= 15 && (!lastBackup || Date.now() - lastBackup > 14 * DAY);

  const stack = h('div.stack');
  stack.append(h('div', h('h1', { style: { fontSize: '2rem' } }, h('span', { style: { color: 'var(--accent)' } }, 'λ'), 'exiko'), h('div.muted', 'Learn to read the Greek New Testament.')));

  if (lvl == null && !K.settings.levelAsked) {
    stack.append(h('div.card.stack', h('h2', 'Where are you starting?'),
      h('p.muted.small', 'Choose the most frequent words you already know — e.g. “100+” means every word that occurs 100 or more times. You can change it any time, and lexiko will occasionally spot-check you.'),
      levelPicker(async () => { await setSetting('levelAsked', true); renderHome(view); })));
  }
  if (needsBackup) stack.append(h('div.banner', icon('download', 22), h('div.grow', h('b', 'Back up your progress'), h('div.small', 'It lives only on this device. A backup takes two seconds.')), h('a.btn.sm', { href: '#/settings' }, 'Back up')));

  stack.append(h('div.card.stack',
    h('div.row.between', h('h2', 'Today'), streak() ? h('span.chip.gold', icon('flame', 14), streak() + '-day streak') : null),
    h('div.kpis', h('div.kpi', h('b', due), h('span', 'due for review')), h('div.kpi', h('b', newLeft), h('span', 'new words left today')), h('div.kpi', h('b', studied), h('span', 'words studied'))),
    startButton(smartAll())));

  if (goal) {
    const rd = scopeReadiness(goal);
    stack.append(h('div.card.stack', h('div.row.between', h('h2', icon('target', 20), ' ' + scopeLabel(goal)), h('span.rdy.' + readinessClass(rd.known), pct(rd.known) + ' · ' + readinessLabel(rd.known))),
      h('div.bar', h('i.k', { style: { width: pct(rd.known) } }), h('i.l', { style: { width: pct(rd.learning) } })),
      h('div.muted.small', rd.distinctUnknown ? rd.distinctUnknown + ' words still to learn before this reads comfortably.' : 'You know every word. Go read it!'),
      h('div.row.wrap', h('a.btn.primary.sm', { href: '#/learn/passage/' + [goal.book, goal.c1, goal.v1 || 1, goal.c2, goal.v2 || 999].join('/') }, 'Study its words'), h('a.btn.sm', { href: readHref(goal.book, goal.c1) }, 'Read'))));
  } else {
    stack.append(h('div.card.flat.row.between', h('div', h('b', 'Set a reading goal'), h('div.muted.small', 'Pick a passage and lexiko will aim your study at it.')), h('a.btn.sm', { href: '#/progress' }, 'Choose')));
  }

  const sug = suggestions(3);
  if (sug.length) stack.append(h('div.card.stack', h('h2', 'Good next reads'), h('div.list', sug.map((r) => suggestionItem(r)))));
  else if (lvl != null || studied) stack.append(h('div.card.flat', h('b', 'Keep going'), h('div.muted.small', 'As you learn more words, passages within your reach will appear here.')));

  stack.append(h('div.row.wrap', h('a.btn', { href: '#/read/' + (K.settings.lastBook || 'JHN') + '/' + (K.settings.lastCh || 1) }, icon('read', 18), 'Continue reading')));
  clear(view).append(stack);
}
