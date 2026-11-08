// What should "Start" do right now? Reviews that are due first, then new material, then reinforcing your shakiest
// cards, then a preview — so the button always leads somewhere and never says there is nothing to do.
import { clockNow } from './clock.js';
import { K, liveWord, troubleCards, reviewCards, wordsPace, parsePace, dailyPlan, verbBrake, setting, dueCards, dueToday, withMore, moreUnlocked, unlockMore, newToday, parseDueCount, parseNewToday, studiedCount } from './know.js';
import { h, icon } from './util.js';

export const TOPICS = {
  words: { title: 'Vocabulary', page: '#/learn/words', go: '#/learn/daily', reinforce: '#/learn/practice/trouble', review: '#/learn/practice/review', preview: '#/learn/practice/preview', noun: 'words', blurb: 'Learn and review Greek words' },
  parse: { title: 'Parsing', page: '#/parse', go: '#/parse/run/mix/all', reinforce: '#/parse/run/extra/trouble', review: '#/parse/run/extra/review', preview: '#/parse/run/extra/preview', noun: 'forms', blurb: 'Tense, voice, mood, case, number, gender' },
};
const ORDER = ['words', 'parse'];

const parseReady = () => K.settings.level != null || studiedCount('w:') > 0;
/** Vocabulary: what is due in all, and what a session will really hold (new words and spot-checks are counted from the session, not estimated). */
function wordsCounts() {
  const due = dueCards().length, plan = dailyPlan();
  return { due, fresh: plan.fresh, checkins: plan.checkins, sessionDue: plan.due, studied: studiedCount('w:') };
}
/** Cheap counts (no heavy indexing): what's due, how many new are still allowed today, how many cards exist. */
export function counts() {
  return {
    words: wordsCounts(),
    parse: { due: parseDueCount(), fresh: parseReady() ? parsePace().left : 0, studied: studiedCount('f:') },      // nothing to parse until you know some words (a level you chose counts)
  };
}

/** When studied cards come due next (read-only). Per topic and overall: the soonest time, plus counts for later today, tomorrow and the next 7 days. */
export function upcoming(now = clockNow()) {
  const eod = new Date(now); eod.setHours(24, 0, 0, 0); const today = +eod, tomorrow = today + 864e5, week = today + 6 * 864e5;
  const mk = () => ({ next: Infinity, nextCount: 0, today: 0, tomorrow: 0, week: 0, due: 0 });
  const out = { words: mk(), parse: mk(), all: mk() };
  for (const c of K.cards.values()) {
    const t = c.id[0] === 'w' ? 'words' : c.id[0] === 'f' ? 'parse' : null;
    if (!t || c.state === 'new' || c.src === 'probe' || (t === 'words' && !liveWord(c))) continue;
    for (const o of [out[t], out.all]) {
      if (dueToday(c, now)) { o.due++; continue; }
      if (c.due <= now) { o.today++; continue; }               // seen earlier today and due again: waits for "Study more today"
      if (c.due < o.next) { o.next = c.due; o.nextCount = 1; } else if (c.due - o.next < 36e5) o.nextCount++;      // cards due within the hour after the first
      if (c.due < today) o.today++; else if (c.due < tomorrow) o.tomorrow++;
      if (c.due < week) o.week++;
    }
  }
  out.parse.due = parseDueCount(now);              // as a session serves them: one per form, only forms still quizzed (raw due cards can include ones it never shows)
  out.all.due = out.words.due + out.parse.due;
  return out;
}
/** "in 20 min", "in 3 h", "tomorrow", "in 3 days" */
export function whenText(t, now = clockNow()) {
  if (!isFinite(t)) return '';
  const m = Math.round((t - now) / 6e4);
  if (m < 60) return 'in ' + Math.max(1, m) + ' min';
  const sod = (d) => new Date(d).setHours(0, 0, 0, 0), days = Math.round((sod(t) - sod(now)) / 864e5);
  if (days <= 0) return 'in ' + Math.round(m / 60) + ' h';
  return days === 1 ? 'tomorrow' : 'in ' + days + ' days';
}

/** "Next review in 3 h · 4 cards" for when nothing is due right now (null otherwise). */
export function nextLine(u, due) {
  if (due || !isFinite(u.all.next)) return null;
  const when = whenText(u.all.next), n = u.all.nextCount;
  return h('div.next', icon('clock', 16), h('span', h('b', 'Next review ' + when), ' · ' + n + (n === 1 ? ' card' : ' cards'),
    u.all.tomorrow && when !== 'tomorrow' ? h('div.small', 'Then ' + u.all.tomorrow + ' more tomorrow') : null));
}
/** A small box counting what is coming due. */
export function comingUp(u) {
  const rows = [['Later today', u.all.today], ['Tomorrow', u.all.tomorrow], ['Next 7 days', u.all.week]];
  if (!rows.some((r) => r[1])) return null;
  return h('div.card.stack', h('b', 'Coming up'), h('div.sched', rows.map(([k, v]) => h('div', h('span', k), h('b', String(v))))));
}
/** One line per topic tile: "3 due now", "next in 3 h", or nothing yet. */
export function tileNext(u, k) {
  const o = u[k];
  return o.due ? o.due + ' due now' : isFinite(o.next) ? 'Next ' + whenText(o.next) : '';
}

/** What the big button says for a topic's normal session: names the activity instead of just "Start". */
const GO_LABEL = (topic, c) => topic === 'words' ? (c.due ? 'Review words' : 'Learn new words') : 'Practice parsing';

/** Everything a normal session will contain, so the button never promises less than it delivers. Vocabulary sessions also slip in a few check-ins on words you said you already know. */
const work = (c, topic = 'words') => {
  const parts = [topic === 'words' ? (c.sessionDue ? c.sessionDue + ' to review' : '') : (c.due ? c.due + ' to review' : ''), c.fresh ? c.fresh + ' new' : '', c.checkins ? c.checkins + (c.checkins > 1 ? ' check-ins' : ' check-in') : ''];
  if (topic === 'words' && c.fresh && verbBrake().braked) parts[1] += ' (no new verbs)';
  return parts.filter(Boolean).join(' + ');
};

/** The best next step for one topic: { href, label, sub, kind: 'go' | 'reinforce' | 'preview' }. */
export function smart(topic, c = counts()[topic]) {
  const T = TOPICS[topic];
  if (c.due || c.fresh) return { href: T.go, label: GO_LABEL(topic, c), sub: work(c, topic), kind: 'go', topic };
  const prefix = { words: 'w:', parse: 'f:' }[topic];
  if (c.studied && troubleCards(prefix, 1).length) return { href: T.reinforce, label: 'Strengthen weak spots', sub: 'You’re caught up — firm up your shakiest ' + T.noun, kind: 'reinforce', topic };
  if (c.studied) return { href: T.review, label: 'Review what you’ve learned', sub: 'You’re caught up — go over the ' + T.noun + ' you’ve learned', kind: 'review', topic };
  return { href: T.preview, label: 'Look ahead', sub: 'See a few new ' + T.noun, kind: 'preview', topic };
}

/** The best next step overall: due reviews anywhere, then new material, then reinforcing, then a preview. */
export function smartAll() {
  const c = counts();
  const t = ORDER.find((k) => c[k].due) || ORDER.find((k) => c[k].fresh);
  if (t) { const s = smart(t, c[t]); return { ...s, sub: s.sub }; }
  const PFX = { words: 'w:', parse: 'f:' }, r = ORDER.find((k) => c[k].studied && troubleCards(PFX[k], 1).length);
  if (r) { const s = smart(r, c[r]); return { ...s, sub: 'You’re caught up — firm up your shakiest ' + TOPICS[r].noun }; }
  const q = ORDER.find((k) => c[k].studied);
  if (q) { const s = smart(q, c[q]); return { ...s, sub: 'You’re caught up — go over what you’ve learned' }; }
  return smart('words', c.words);
}

/** Short status for a topic card: only says something when there is something to say. */
export function topicNote(topic) { const c = counts()[topic]; return c.due || c.fresh ? work(c, topic) : TOPICS[topic].blurb; }

/** How much extra is ready if the learner asks for more today: reviews that came due again after being seen today, plus another allowance of new items. */
export function moreReady(topic) {
  const count = topic === 'words' ? () => dueCards().length : () => parseDueCount();
  const reviews = moreUnlocked() ? 0 : withMore(count) - count();
  const max = Math.max(0, setting(topic === 'words' ? 'newPerDay' : 'parseNewPerDay'));
  const fresh = setting(topic + 'Pause') || (topic === 'parse' && !parseReady()) ? 0 : max;
  return { reviews, fresh };
}

/** "You're done for today" and, when there is more to do, a button to ask for it. Null unless the topic really is finished for today and has studied items. */
export function doneCards(topic) {
  const c = counts()[topic], T = TOPICS[topic];
  if (c.due || c.fresh || !c.studied) return null;
  const one = T.noun.slice(0, -1), nn = (n) => n + ' more ' + (n === 1 ? one : T.noun), m = moreReady(topic), total = m.reviews + m.fresh;
  const out = [h('div.card.stack', h('b', 'You’re done for today.'), h('div.small.muted', 'Everything that was due today is finished.'), nextLine(upcoming(), 0))];
  if (!total) return out;
  const isAre = (n) => (n === 1 ? ' is' : ' are'), np = m.fresh + ' more new ' + (m.fresh === 1 ? one : T.noun);
  const rev = nn(m.reviews) + isAre(m.reviews) + ' ready to review: ' + T.noun + ' you saw earlier today that are due again.';
  const body = m.reviews && m.fresh ? rev + ' You can also add ' + np + '.' : m.reviews ? rev : np.charAt(0).toUpperCase() + np.slice(1) + isAre(m.fresh) + ' ready to add.';
  out.push(h('div.card.stack', h('b', 'Want to keep going?'), h('div.small.muted', body),
    h('button.btn.primary.block', { onclick: async () => { await unlockMore(); location.hash = T.go; } }, 'Study ' + nn(total))));
  return out;
}
