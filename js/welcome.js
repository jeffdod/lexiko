// First run: two plain questions (how much Greek do you know? what first?), then straight into the app.
import { setSetting, setLevel } from './know.js';
import { levelStats } from './settings.js';
import { h, clear } from './util.js';

const fmt = (n) => n.toLocaleString('en-US');
// [level, title, description, how often to spot-check words you say you know]
const LEVEL_CHOICES = [
  [null, 'I’m just starting', 'New to Greek, or still learning the alphabet'],
  [50, 'I’m rusty', 'I know my grammar and once knew these words, but I’m out of practice. lexiko will quiz you on them often', 0.2, 'rusty'],
  [50, 'I know the basics', 'I’ve studied some grammar and know the most common words'],
  [20, 'I can read with a lexicon', 'I read the New Testament, but look up a lot'],
  [5, 'I read Greek regularly', 'Show me mainly the words I don’t know'],
];
const GOAL_CHOICES = [
  ['read', 'Read the Greek New Testament', 'Tap any word for its meaning. lexiko points out the words worth learning.', '#/read/JHN/1'],
  ['words', 'Build my vocabulary', 'Short daily reviews, most common words first.', '#/learn/daily'],
  ['forms', 'Practise word forms', 'Recognise tense, case, person and number, with charts to help.', '#/parse'],
];

/** Shows the first-run flow in `view`; calls done(href|null) when finished or skipped. */
export function renderWelcome(view, done) {
  let level = 50, goal = 'read', pick = 'I know the basics';
  const finish = async (href) => { await setLevel(level); await setSetting('probeRate', pick === 'rusty' ? 0.2 : 0.12); await setSetting('levelAsked', true); done(href); };
  const choice = (title, sub, on, onclick) => h('button.choice', { 'aria-pressed': String(on), onclick }, h('b', title), h('span', sub));
  const step1 = () => {
    const list = h('div.choices');
    const drawList = () => clear(list).append(...LEVEL_CHOICES.map(([lv, t, s, , key = t]) => {
      const st = levelStats(lv), extra = lv == null ? '' : ' (about ' + fmt(st.words) + ' words)';
      return choice(t, s + extra, pick === key, () => { level = lv; pick = key; drawList(); });
    }));
    drawList();
    clear(view).append(h('div.welcome.stack',
      h('div.row.between', h('div.brand-word', 'lexiko'), h('span.muted.small', 'Step 1 of 2')),
      h('h1', 'How much Greek do you know?'),
      h('p.muted', 'There’s no wrong answer. lexiko uses this to choose your first words, and you can change it any time in Settings.'),
      list,
      h('button.btn.primary.block', { onclick: step2 }, 'Continue'),
      h('p.muted.small.center', 'Free. No sign-up. Your progress stays on this device.')));
  };
  const step2 = () => {
    const list = h('div.choices');
    const drawList = () => clear(list).append(...GOAL_CHOICES.map(([g, t, s]) => choice(t, s, goal === g, () => { goal = g; drawList(); })));
    drawList();
    clear(view).append(h('div.welcome.stack',
      h('div.row.between', h('button.btn.ghost.sm', { onclick: step1 }, '‹ Back'), h('span.muted.small', 'Step 2 of 2')),
      h('h1', 'What would you like to do first?'),
      h('p.muted', 'Pick one to start. Everything else is still one tap away.'),
      list,
      h('button.btn.primary.block', { onclick: () => finish(GOAL_CHOICES.find((c) => c[0] === goal)[3]) }, 'Start'),
      h('button.btn.ghost.block', { onclick: () => finish(null) }, 'Skip for now')));
  };
  step1();
}
