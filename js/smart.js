// What should "Start" do right now? Reviews that are due first, then new material, then reinforcing your shakiest
// cards, then a preview — so the button always leads somewhere and never says there is nothing to do.
import { setting, dueCards, newToday, parseCardsDue, parseNewToday, partsCardsDue, studiedCount } from './know.js';
import { planPartsSession } from './parts.js';

export const TOPICS = {
  words: { title: 'Vocabulary', page: '#/learn/words', go: '#/learn/daily', reinforce: '#/learn/practice/trouble', preview: '#/learn/practice/preview', noun: 'words', blurb: 'Learn and review Greek words' },
  parse: { title: 'Parsing', page: '#/parse', go: '#/parse/run/mix/all', reinforce: '#/parse/run/extra/trouble', preview: '#/parse/run/extra/preview', noun: 'forms', blurb: 'Tense, voice, mood, case, number, gender' },
  parts: { title: 'Principal parts', page: '#/parts', go: '#/parts/run/mix', reinforce: '#/parts/run/extra/trouble', preview: '#/parts/run/extra/preview', noun: 'parts', blurb: 'The six parts of each verb' },
};
const ORDER = ['words', 'parse', 'parts'];

/** New parts a normal session would add: every part of the next verbs, after the reviews that are due. */
const partsFresh = () => { const p = planPartsSession(); let room = Math.max(0, p.size - Math.min(p.due.length, p.size)), items = 0, verbs = 0; for (const g of p.fresh) { if (room <= 0) break; const k = Math.min(room, g.items.length); room -= k; items += k; verbs++; } return { items, verbs }; };

/** Cheap counts (no heavy indexing): what's due, how many new are still allowed today, how many cards exist. */
export function counts() {
  return {
    words: { due: dueCards().length, fresh: Math.max(0, setting('newPerDay') - newToday()), studied: studiedCount('w:') },
    parse: { due: parseCardsDue().length, fresh: Math.max(0, setting('parseNewPerDay') - parseNewToday()), studied: studiedCount('f:') },
    parts: { due: partsCardsDue().length, fresh: partsFresh().items, freshVerbs: partsFresh().verbs, studied: studiedCount('p:') },
  };
}

/** What the big button says for a topic's normal session: names the activity instead of just "Start". */
const GO_LABEL = (topic, c) => topic === 'words' ? (c.due ? 'Review words' : 'Learn new words') : topic === 'parse' ? 'Practise parsing' : 'Practise principal parts';

/** Everything a normal session will contain, so the button never promises less than it delivers. Vocabulary sessions also slip in a few check-ins on words you said you already know. */
const work = (c, topic = 'words') => {
  const parts = [c.due ? c.due + ' to review' : '', topic === 'parts' ? (c.freshVerbs ? c.freshVerbs + ' new verb' + (c.freshVerbs > 1 ? 's' : '') + ' (' + c.fresh + (c.fresh === 1 ? ' part)' : ' parts)') : '') : c.fresh ? c.fresh + ' new' : ''];
  if (topic === 'words' && (c.due || c.fresh) && setting('level') != null) {
    const items = Math.min(c.due, Math.max(setting('sessionSize'), 30)) + c.fresh, rate = setting('probeRate');
    const n = Math.round(items * rate / (1 - rate)) || (items ? 1 : 0);
    if (n) parts.push(n + (n > 1 ? ' check-ins' : ' check-in'));
  }
  return parts.filter(Boolean).join(' + ');
};

/** The best next step for one topic: { href, label, sub, kind: 'go' | 'reinforce' | 'preview' }. */
export function smart(topic, c = counts()[topic]) {
  const T = TOPICS[topic];
  if (c.due || c.fresh) return { href: T.go, label: GO_LABEL(topic, c), sub: work(c, topic), kind: 'go', topic };
  if (c.studied) return { href: T.reinforce, label: 'Strengthen weak spots', sub: 'You’re caught up — firm up your shakiest ' + T.noun, kind: 'reinforce', topic };
  return { href: T.preview, label: 'Look ahead', sub: 'See a few new ' + T.noun, kind: 'preview', topic };
}

/** The best next step overall: due reviews anywhere, then new material, then reinforcing, then a preview. */
export function smartAll() {
  const c = counts();
  const t = ORDER.find((k) => c[k].due) || ORDER.find((k) => c[k].fresh);
  if (t) { const s = smart(t, c[t]); return { ...s, sub: s.sub }; }
  const r = ORDER.find((k) => c[k].studied);
  if (r) { const s = smart(r, c[r]); return { ...s, sub: 'You’re caught up — firm up your shakiest ' + TOPICS[r].noun }; }
  return smart('words', c.words);
}

/** Short status for a topic card: only says something when there is something to say. */
export function topicNote(topic) { const c = counts()[topic]; return c.due || c.fresh ? work(c, topic) : TOPICS[topic].blurb; }
