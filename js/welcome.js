// First run: a one-screen hello (free, no sign-up, no ads), then plain questions (how much Greek do you know? how well do you parse it? what first?), then straight into the app.
import { setSetting, setLevel, setGoal, suggestGoal, goalLabel, freqCoverage, setParseLevel, PARSE_LEVELS } from './know.js';
import { goalPicker, previewLine } from './goals.js';
import { levelStats } from './settings.js';
import { h, clear, fmt } from './util.js';

// [level, title, description, how often to spot-check words you say you know]
const LEVEL_CHOICES = [
  [null, 'I’m just starting', 'New to Greek, or still learning the alphabet'],
  [50, 'I’m rusty', 'I know my grammar and once knew the most common words, but I’m out of practice. lexiko will quiz you on them often', 0.2, 'rusty'],
  [50, 'I know the basics', 'I’ve studied some grammar and know the most common words'],
  [20, 'I can read with a lexicon', 'I read the New Testament, but look up a lot'],
  [5, 'I read Greek regularly', 'Show me mainly the words I don’t know'],
];

/** The parsing question on its own, for someone who already uses the app but has never been asked it. "Leave things as they are" changes nothing. */
export function renderParseWelcome(view, done) {
  let pick = 'keep';
  const list = h('div.choices');
  const drawList = () => clear(list).append(...[...PARSE_LEVELS, ['keep', 'Leave things as they are', 'Keep the verb forms and settings you have now. Nothing changes.']].map(([key, t, s]) =>
    h('button.choice', { 'aria-pressed': String(pick === key), onclick: () => { pick = key; drawList(); } }, h('b', t), h('span', s))));
  drawList();
  const go = async () => { if (pick === 'keep') await setSetting('parseAsked', true); else await setParseLevel(pick, { merge: true }); done(); };
  clear(view).append(h('div.welcome.stack',
    h('div.brand-word', 'lexiko'),
    h('h1', 'How well do you parse Greek?'),
    h('p.muted', 'lexiko now asks how well you parse Greek, so it can ask about the right forms. You can change this any time in Parsing.'),
    list,
    h('button.btn.primary.block', { onclick: go }, 'Continue'),
    h('p.muted.small.center', 'Choosing anything except “I’m just starting” also stops lexiko from asking about the definite article.')));
}

/** Shows the first-run flow in `view`; calls done(href|null) when finished or skipped. */
export function renderWelcome(view, done) {
  let level = 50, pick = 'I know the basics', parse = 'basics';
  const steps = () => (level == null ? 2 : 3);                       // a beginner skips the parsing question: verbs stay off
  const finish = async (href) => { await setLevel(level); await setParseLevel(level == null ? 'start' : parse); await setSetting('probeRate', pick === 'rusty' ? 0.2 : 0.12); await setSetting('levelAsked', true); done(href); };
  const choice = (title, sub, on, onclick) => h('button.choice', { 'aria-pressed': String(on), onclick }, h('b', title), h('span', sub));
  // The very first screen: what lexiko is and what it costs. It is not a numbered step.
  const splash = () => clear(view).append(h('div.welcome.splash',
    h('img.splash-logo', { src: 'icons/icon-192.png', alt: '', width: 96, height: 96 }),
    h('div.brand-word', 'lexiko'),
    h('p.muted.splash-intro', 'learn Greek vocabulary.', h('br'), 'read the Greek New Testament.'),
    h('p.splash-promise', 'no sign-up. no cost. no ads.'),
    h('blockquote.splash-quote', h('p', 'freely ye received,', h('br'), 'freely give.'), h('cite.muted.small', 'Matthew 10:8b · ASV Byzantine Text')),
    h('button.btn.primary.block', { onclick: step1 }, 'Get started')));
  const step1 = () => {
    const list = h('div.choices');
    const drawList = () => clear(list).append(...LEVEL_CHOICES.map(([lv, t, s, , key = t]) => {
      const st = levelStats(lv), extra = lv == null ? '' : ' (about ' + fmt(st.words) + ' words)';
      return choice(t, s + extra, pick === key, () => { level = lv; pick = key; drawList(); });
    }));
    drawList();
    clear(view).append(h('div.welcome.stack',
      h('div.row.between', h('div.brand-word', 'lexiko'), h('span.muted.small', 'Step 1 of ' + steps())),
      h('h1', 'How much Greek do you know?'),
      h('p.muted', 'There’s no wrong answer. lexiko uses this to choose your first words, and you can change it any time in Settings.'),
      list,
      h('button.btn.primary.block', { onclick: () => { if (level == null) { stepGoal(); } else { parse = level <= 5 ? 'most' : 'basics'; stepParse(); } } }, 'Continue'),
      h('p.muted.small.center', 'Free. No sign-up. Your progress stays on this device.'),
      h('p.muted.small.center', 'Greek text: Robinson–Pierpont Byzantine Textform, 2026, as presented in The Greek New Testament According to the Byzantine Text, ed. J. Jeffrey Dodson and Dwayne Green (Guardian Press, 2026).')));
  };
  const stepParse = () => {
    const list = h('div.choices');
    const drawList = () => clear(list).append(...PARSE_LEVELS.map(([key, t, s]) => choice(t, s, parse === key, () => { parse = key; drawList(); })));
    drawList();
    clear(view).append(h('div.welcome.stack',
      h('div.row.between', h('button.btn.ghost.sm', { onclick: step1 }, '‹ Back'), h('span.muted.small', 'Step 2 of 3')),
      h('h1', 'How well do you parse Greek?'),
      h('p.muted', 'There’s no wrong answer. lexiko uses this to choose which forms to ask about, and you can fine-tune it any time in Parsing.'),
      list,
      h('button.btn.primary.block', { onclick: stepGoal }, 'Continue')));
  };
  const stepGoal = async () => {
    await setLevel(level);                                          // so the goal's counts already know what you know
    let goal = suggestGoal(level), choosing = false;
    const draw = () => {
      const card = h('div.card.stack.goal-pick', h('b', goalLabel(goal)), h('div.muted', previewLine(goal)),
        goal.kind === 'freq' ? h('div.muted', 'When you finish you will recognize ' + Math.round(freqCoverage(goal.min) * 100) + '% of the New Testament.') : null);
      clear(view).append(h('div.welcome.stack',
        h('div.row.between', h('button.btn.ghost.sm', { onclick: level == null ? step1 : stepParse }, '‹ Back'), h('span.muted.small', 'Step ' + steps() + ' of ' + steps())),
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
  splash();
}
