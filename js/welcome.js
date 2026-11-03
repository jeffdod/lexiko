// First run: two plain questions (how much Greek do you know? what first?), then straight into the app.
import { setSetting, setLevel, setGoal, suggestGoal, goalLabel, freqCoverage } from './know.js';
import { goalPicker, previewLine } from './goals.js';
import { levelStats } from './settings.js';
import { h, clear, fmt } from './util.js';

// [level, title, description, how often to spot-check words you say you know]
const LEVEL_CHOICES = [
  [null, 'I’m just starting', 'New to Greek, or still learning the alphabet'],
  [50, 'I’m rusty', 'I know my grammar and once knew these words, but I’m out of practice. lexiko will quiz you on them often', 0.2, 'rusty'],
  [50, 'I know the basics', 'I’ve studied some grammar and know the most common words'],
  [20, 'I can read with a lexicon', 'I read the New Testament, but look up a lot'],
  [5, 'I read Greek regularly', 'Show me mainly the words I don’t know'],
];

/** Shows the first-run flow in `view`; calls done(href|null) when finished or skipped. */
export function renderWelcome(view, done) {
  let level = 50, pick = 'I know the basics';
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
  const step2 = async () => {
    await setLevel(level);                                          // so the goal's counts already know what you know
    let goal = suggestGoal(level), choosing = false;
    const draw = () => {
      const card = h('div.card.stack.goal-pick', h('b', goalLabel(goal)), h('div.muted', previewLine(goal)),
        goal.kind === 'freq' ? h('div.muted', 'When you finish you will recognize ' + Math.round(freqCoverage(goal.min) * 100) + '% of the New Testament.') : null);
      clear(view).append(h('div.welcome.stack',
        h('div.row.between', h('button.btn.ghost.sm', { onclick: step1 }, '‹ Back'), h('span.muted.small', 'Step 2 of 2')),
        h('h1', 'What do you want to work toward?'),
        h('p.muted', level == null ? 'Here is a goal to start with.' : 'You said you know the most common words. Here is a goal to start with.'),
        choosing ? goalPicker({ initial: goal, confirmLabel: 'Start with this goal', onPick: (g) => { goal = g; go(); } }) : card,
        choosing ? null : h('button.btn.block', { onclick: () => { choosing = true; draw(); } }, 'Choose a different goal ›'),
        choosing ? null : h('button.btn.primary.block', { onclick: go }, 'Start with this goal'),
        h('p.muted.small.center', 'You can change your goal at any time.')));
    };
    const go = async () => { await setGoal(goal); finish(null); };
    draw();
  };
  step1();
}
