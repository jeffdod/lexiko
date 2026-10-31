// What should "Start" do right now? Reviews that are due first, then new material, then reinforcing your shakiest
// cards, then a preview — so the button always leads somewhere and never says there is nothing to do.
import { setting, dueCards, newToday, parseCardsDue, parseNewToday, partsCardsDue, partsNewToday, studiedCount } from './know.js';

export const TOPICS = {
  words: { title: 'Vocabulary', page: '#/learn/words', go: '#/learn/daily', reinforce: '#/learn/practice/trouble', preview: '#/learn/practice/preview', noun: 'words', blurb: 'Learn and review Greek words' },
  parse: { title: 'Parsing', page: '#/parse', go: '#/parse/run/mix/all', reinforce: '#/parse/run/extra/trouble', preview: '#/parse/run/extra/preview', noun: 'forms', blurb: 'Tense, voice, mood, case, number, gender' },
  parts: { title: 'Principal parts', page: '#/parts', go: '#/parts/run/mix', reinforce: '#/parts/run/extra/trouble', preview: '#/parts/run/extra/preview', noun: 'parts', blurb: 'The six parts of each verb' },
};
const ORDER = ['words', 'parse', 'parts'];

/** Cheap counts (no heavy indexing): what's due, how many new are still allowed today, how many cards exist. */
export function counts() {
  return {
    words: { due: dueCards().length, fresh: Math.max(0, setting('newPerDay') - newToday()), studied: studiedCount('w:') },
    parse: { due: parseCardsDue().length, fresh: Math.max(0, setting('parseNewPerDay') - parseNewToday()), studied: studiedCount('f:') },
    parts: { due: partsCardsDue().length, fresh: Math.max(0, setting('partsNewPerDay') - partsNewToday()), studied: studiedCount('p:') },
  };
}

const work = (c) => [c.due ? c.due + ' to review' : '', c.fresh ? c.fresh + ' new' : ''].filter(Boolean).join(' + ');

/** The best next step for one topic: { href, label, sub, kind: 'go' | 'reinforce' | 'preview' }. */
export function smart(topic, c = counts()[topic]) {
  const T = TOPICS[topic];
  if (c.due || c.fresh) return { href: T.go, label: 'Start', sub: work(c), kind: 'go', topic };
  if (c.studied) return { href: T.reinforce, label: 'Reinforce', sub: 'You’re caught up — firm up your shakiest ' + T.noun, kind: 'reinforce', topic };
  return { href: T.preview, label: 'Preview', sub: 'See a few new ' + T.noun, kind: 'preview', topic };
}

/** The best next step overall: due reviews anywhere, then new material, then reinforcing, then a preview. */
export function smartAll() {
  const c = counts();
  const t = ORDER.find((k) => c[k].due) || ORDER.find((k) => c[k].fresh);
  if (t) { const s = smart(t, c[t]); return { ...s, sub: TOPICS[t].title + ' · ' + s.sub }; }
  const r = ORDER.find((k) => c[k].studied);
  if (r) { const s = smart(r, c[r]); return { ...s, sub: 'You’re caught up — firm up your shakiest ' + TOPICS[r].noun }; }
  return smart('words', c.words);
}

/** Short status for a topic card: only says something when there is something to say. */
export function topicNote(topic) { const c = counts()[topic]; return c.due ? c.due + ' to review' : TOPICS[topic].blurb; }
