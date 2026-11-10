// Knowledge model: which words does the learner know? Combines the level they declared with SRS cards.
import { clockNow } from './clock.js';
import { requiredStems } from './stems.js';
import { D, isName, NOT_PARSED, scopeCounts, scopeVerses, scopeLabel, periScope, periBook } from './data.js';
import { store } from './store.js';
import * as F from './fsrs.js';
import { todayKey, shuffle } from './util.js';
import { CHART_ATTRS, ROW_LEVEL, rowOfTag } from './families.js';
import { gateKeyOfTag, allGateKeys } from './kinds.js';
import { miClass } from './midata.js';

export const DEFAULTS = {
  theme: 'auto', level: null, parseLevel: null, parseAsked: false, mode: 'flash', newPerDay: 10, probeRate: 0.12, retention: 0.9,
  readerSize: 1.35, paraStyle: 'indent', lineEnds: 'justify', lineSpacing: 'normal', sectionHeads: true, verseNums: true, english: false, glossMode: false, glossRepeat: false, highlight: true, sessionSize: 25, parseMode: 'auto', parseNewPerDay: 10, wordsPace: 'auto', wordsPause: false, parsePace: 'auto', parsePause: false, backupReminder: true, autoBackup: false, gates: {}, verbAsk: { n: 0, t: 0 }, barsDebug: false,
};
export const K = { settings: { ...DEFAULTS }, cards: new Map(), daily: {}, read: {}, goal: null, wordsAcc: [], parseAcc: [], verbAcc: [], verbParse: {}, gateAcc: {}, ready: false };

export async function initKnow() {
  const s = (await store.get('settings')) || {};
  K.settings = { ...DEFAULTS, ...s };
  K.cards = new Map((await store.allCards()).map((c) => [c.id, c]));
  for (const id of [...K.cards.keys()]) if (id.startsWith('p:')) { K.cards.delete(id); await store.deleteCard(id); }      // principal parts are no longer scheduled: drop their old cards and stage data
  for (const id of [...K.cards.keys()]) if (id.startsWith('f:') && NOT_PARSED.has(+id.split(':').pop())) { K.cards.delete(id); await store.deleteCard(id); }      // forms of words that are no longer parsed (ἰδού, ἴδε) leave the schedule
  for (const k of ['partsVerbs', 'partsAcc', 'partsStats']) if ((await store.get(k)) !== undefined) await store.set(k, undefined);
  K.daily = (await store.get('daily')) || {};
  K.read = (await store.get('read')) || {};
  K.goal = (await store.get('goal')) || null;
  K.goalsDone = (await store.get('goalsDone')) || [];
  K.verbAcc = (await store.get('verbAcc')) || [];
  K.wordsAcc = (await store.get('wordsAcc')) || [];
  K.parseAcc = (await store.get('parseAcc')) || [];
  K.verbParse = (await store.get('verbParse')) || {};
  K.gateAcc = (await store.get('gateAcc')) || {};
  K.ready = true;
}

export const setting = (k) => K.settings[k];
export async function setSetting(k, v) {
  K.settings[k] = v; await store.set('settings', K.settings);
  try { if (k === 'theme') localStorage.setItem('lexiko-theme', v); } catch { /* storage may be blocked */ }
}
export async function setGoal(g) { K.goal = g ? { ...g, since: g.since || clockNow() } : null; await store.set('goal', K.goal); }

/* ---------- goals: one set of words you are working toward (a word-frequency band, a passage, or a section) ---------- */
export const FREQ_LADDER = [100, 50, 30, 20, 15, 10, 7, 5, 3, 2];
/** The goal in force: the one you chose, else a frequency goal one rung above what you said you know. Passage goals saved before kinds existed count as passages. */
export function currentGoal() {
  const g = K.goal;
  if (g && g.kind) return g;
  if (g && g.book) return { kind: 'passage', ...g };
  return suggestGoal(K.settings.level);
}
/** The first goal to offer: just above the words you already know ("just starting" gets 50 or more). */
export function suggestGoal(level) {
  if (level == null) return { kind: 'freq', min: 50 };
  return { kind: 'freq', min: FREQ_LADDER.find((t) => t < level) || FREQ_LADDER[FREQ_LADDER.length - 1] };
}
/** The words in a goal, as lexicon numbers (a preposition counts once per case, like in reviews). */
export function goalWords(g) {
  if (!g) return [];
  if (g.kind === 'freq') return D.lex.filter((L) => L.freq >= g.min).map((L) => L.n);
  return [...scopeCounts(g).keys()];
}
/** How far along a goal is, counting a word as known the way it is known everywhere else. */
export function goalStats(g) {
  const ws = goalWords(g); let known = 0;
  for (const n of ws) if (status(n) === 'known') known++;
  return { total: ws.length, known, left: ws.length - known, pct: ws.length ? known / ws.length : 1 };
}
/** Share of the New Testament's running words that the words occurring `min` or more times make up. */
/** How much of the New Testament's running text you recognize today (words you know, weighted by how often they occur). */
export function ntShareKnown() {
  let all = 0, part = 0;
  for (const L of D.lex) { all += L.freq; if (status(L.n) === 'known') part += L.freq; }
  return all ? part / all : 0;
}

/* ---------- finishing goals ---------- */
/** True when every word in the goal is known. */
export function goalFinished(g = currentGoal()) { const s = goalStats(g); return s.total > 0 && s.left === 0; }
const goalId = (g) => (g.kind === 'freq' ? 'f' + g.min : [g.book, g.c1, g.v1 || 1, g.c2, g.v2 || 999].join(':')) + '@' + (g.since || 0);
/** Writes a finished goal into the history, once. Returns the entry. */
export function noteGoalDone(g = K.goal) {
  if (!g || !goalFinished(g)) return null;
  const id = goalId(g); let e = K.goalsDone.find((x) => x.id === id);
  if (!e) {
    e = { id, goal: { ...g }, words: goalStats(g).total, finished: clockNow(), days: g.since ? Math.max(1, Math.round((clockNow() - g.since) / 864e5)) : null };
    K.goalsDone.push(e); store.set('goalsDone', K.goalsDone);
  }
  return e;
}
/** The goal to suggest after finishing this one: the next rung up the ladder, or the next section in the book; always one with words still to learn. */
export function nextGoal(g) {
  const open = (x) => goalStats(x).left > 0;
  if (g.kind !== 'freq' && g.book) {
    const endC = g.c2, endV = g.v2 >= 999 ? 999 : g.v2;
    for (const p of periBook(g.book)) {
      if (!(p.c1 > endC || (p.c1 === endC && p.v1 > endV))) continue;               // only sections that start after this goal ends
      const x = { kind: 'pericope', ...periScope(p), title: p.title, id: p.id };
      if (open(x)) return x;
    }
  }
  const from = g.kind === 'freq' ? g.min : Infinity;
  const t = FREQ_LADDER.find((t) => t < from && open({ kind: 'freq', min: t }));
  return t ? { kind: 'freq', min: t } : null;
}
export const freqCoverage = (min) => {
  let all = 0, part = 0;
  for (const L of D.lex) { all += L.freq; if (L.freq >= min) part += L.freq; }
  return all ? part / all : 0;
};
export function goalLabel(g) {
  if (!g) return '';
  if (g.kind === 'freq') return 'Words occurring ' + g.min + ' or more times';
  return g.kind === 'pericope' && g.title ? g.title + ' (' + scopeLabel(g) + ')' : scopeLabel(g);
}
export async function setReadKey(key, on) {          // key: 'JHN:1' (chapter) or 'p:JHN:1:1' (section)
  if (on) K.read[key] = clockNow(); else delete K.read[key];
  await store.set('read', K.read);
}
export const markRead = (code, ch, on) => setReadKey(code + ':' + ch, on);
/** A section counts as read when you marked it, or when every chapter it lies in is marked read. */
export function sectionRead(p) {
  if (K.read[p.id]) return true;
  for (let ch = p.c1; ch <= p.c2; ch++) if (!K.read[p.code + ':' + ch]) return false;
  return true;
}
/** Unmark a section, including the chapter marks that made it count as read. */
export async function unmarkSection(p) {
  if (K.read[p.id]) delete K.read[p.id];
  for (let ch = p.c1; ch <= p.c2; ch++) delete K.read[p.code + ':' + ch];
  await store.set('read', K.read);
}

export const cardId = (n) => 'w:' + n;
export const getCard = (n) => K.cards.get(cardId(n));

/** 'known' | 'learning' | 'unknown' — drives the reader, readiness and queues. */
export function status(n) {
  if (isName(n)) return 'known';                       // a proper name is never quizzed and never counts as a word you don't know
  const c = K.cards.get('w:' + n);
  if (c) return c.state === 'review' && ((c.stability || 0) >= 7 || (c.reps || 0) >= 2) ? 'known' : 'learning';      // one right answer isn't knowing a word yet
  const L = D.lexByN.get(n);
  return K.settings.level != null && L && L.freq >= K.settings.level ? 'known' : 'unknown';
}
export const assumed = (n) => !K.cards.has('w:' + n) && status(n) === 'known';

async function saveCard(c) { K.cards.set(c.id, c); await store.putCards([c]); }

function bumpDaily(field) {
  const d = (K.daily[todayKey()] ||= {}); d[field] = (d[field] || 0) + 1;
}

/** Record a review. kind: 'new' | 'review' | 'probe'. */
let lastRate = null;
/** Take back the most recent word rating: the card, today's counts and the review log go back to how they were. */
export async function undoRate() {
  const u = lastRate; if (!u) return false; lastRate = null;
  if (u.before) await saveCard(u.before); else { K.cards.delete(u.id); await store.deleteCard(u.id); }
  const d = K.daily[u.day]; if (d) { d.r = Math.max(0, (d.r || 0) - 1); if (u.wasNew) d.n = Math.max(0, (d.n || 0) - 1); if (u.grade >= 3) d.c = Math.max(0, (d.c || 0) - 1); await store.set('daily', K.daily); }
  if (u.acc) { K.wordsAcc = u.acc; await store.set('wordsAcc', K.wordsAcc); }
  await store.dropLastLog();
  return true;
}

export async function rate(n, grade, kind = 'review', ms = 0) {
  const now = clockNow();
  const prev = K.cards.get('w:' + n) || F.newCard('w:' + n);
  lastRate = { acc: K.wordsAcc.slice(), id: 'w:' + n, before: K.cards.has('w:' + n) ? { ...K.cards.get('w:' + n) } : null, grade, wasNew: prev.state === 'new', day: todayKey() };
  const next = F.review(prev, grade, now, K.settings.retention);
  next.src = prev.src === 'probe' && grade < 3 ? 'review' : (prev.src || kind); if (prev.state === 'new') next.born = now;
  await saveCard(next);
  bumpDaily('r'); if (prev.state === 'new') bumpDaily('n'); if (grade >= 3) bumpDaily('c');
  await store.set('daily', K.daily);
  K.wordsAcc.push(grade >= 3 ? 1 : 0); if (K.wordsAcc.length > 40) K.wordsAcc.shift(); await store.set('wordsAcc', K.wordsAcc);
  await store.addLog([{ t: now, id: 'w:' + n, g: grade, k: kind, ms }]);
  return next;
}

/** Words that are still unsettled when a session ends (still learning or relearning) come back together, once, HOLD_MIN minutes later.
 *  A word already held once today (card.dfr is today) that is still unsettled comes back on the next study day instead.
 *  Returns { later, tomorrow, due } (counts, and the time the first group comes back). Practice sessions never call this. */
export const HOLD_MIN = 10;
export async function holdToday(ns, now = clockNow()) {
  const out = { later: 0, tomorrow: 0, due: 0, nextDay: 0 }, day = todayKey(), back = now + HOLD_MIN * 60000;
  const next = F.dueAfterDays(1, now);
  for (const n of ns) {
    const c = K.cards.get('w:' + n);
    if (!c || (c.state !== 'learning' && c.state !== 'relearning')) continue;
    const again = c.dfr === day;
    const nc = { ...c, dfr: day, due: again ? next : back };
    await saveCard(nc);
    if (again) { out.tomorrow++; out.nextDay = next; } else { out.later++; out.due = back; }
  }
  return out;
}

/** "I already know this" — create a stable card without a quiz. */
export async function markKnown(n, full = false) {      // full: a verb whose parsing you know too (otherwise its parts and parsing are still to learn)
  const c = F.review(F.newCard('w:' + n), 4, clockNow(), K.settings.retention); c.src = full ? 'full' : 'manual';
  await saveCard(c); return c;
}
/** "I don't know this" — put it in the learning pile, due now. */
export async function markLearning(n) {
  const c = F.review(F.newCard('w:' + n), 1, clockNow(), K.settings.retention); c.due = clockNow(); c.src = 'manual';
  await saveCard(c); return c;
}
export async function setLevel(level) { await setSetting('level', level); }

/* ---------- aggregates ---------- */
export function counts(strongsIter) {
  const r = { known: 0, learning: 0, unknown: 0, total: 0 };
  for (const n of strongsIter) { r[status(n)]++; r.total++; }
  return r;
}
export function chapterReadiness(code, ch) {
  const c = D.chap.get(code + ':' + ch); if (!c) return null;
  const r = counts(c.strongs);
  return { known: r.known / r.total, learning: r.learning / r.total, unknown: r.unknown / r.total, tokens: r.total, nKnown: r.known, nLearning: r.learning, nUnknown: r.unknown };
}
export function scopeReadiness(scope) {
  const m = scopeCounts(scope); let known = 0, learning = 0, unknown = 0, total = 0, distinctUnknown = 0;
  for (const [n, c] of m) {
    const s = status(n); total += c;
    if (s === 'known') known += c; else if (s === 'learning') learning += c; else { unknown += c; }
    if (s !== 'known') distinctUnknown++;
  }
  return { known: total ? known / total : 1, learning: total ? learning / total : 0, unknown: total ? unknown / total : 0, tokens: total, distinctUnknown };
}
export const readinessLabel = (p) => (p >= 0.98 ? 'Ready' : p >= 0.95 ? 'Comfortable' : p >= 0.9 ? 'Stretch' : p >= 0.8 ? 'Challenging' : 'Not yet');
export const readinessClass = (p) => (p >= 0.98 ? 'r4' : p >= 0.95 ? 'r3' : p >= 0.9 ? 'r2' : p >= 0.8 ? 'r1' : 'r0');

/** A word card that is still in use (a preposition that is now reviewed per case no longer uses its old single card). */
export const liveWord = (c) => { if (!c.id.startsWith('w:')) return false; const L = D.lexByN.get(+c.id.slice(2)); return !L || (!L.senses && !L.name); };
/* ---------- "done for today": the day's work is fixed, extra work is something the learner asks for ---------- */
const dayStart = (now) => { const d = new Date(now); d.setHours(0, 0, 0, 0); return +d; };
const dayEnd = (now) => { const d = new Date(now); d.setHours(24, 0, 0, 0); return +d; };
let forceMore = false;
/** True once the learner has pressed "Study more today" for a topic ('words' or 'parse'): from then on everything of that topic that is due right now counts.
 *  Each topic has its own unlock (mw, mp in today's record), so asking for more forms never opens more words, and the other way round.
 *  No topic: true if either is unlocked. A record from before the split carries a single `more` flag, which counts for both. */
export const moreUnlocked = (topic) => {
  const d = K.daily[todayKey()] || {};
  return forceMore || !!(d.more || (topic === 'words' ? d.mw : topic === 'parse' ? d.mp : d.mw || d.mp));
};
/** Is this studied card part of today's work? Due before midnight and not already reviewed today, or a word still being learned (it comes back within minutes,
 *  and the done card says so while it waits). A word already reviewed today and scheduled for later is not new work. */
export function dueToday(c, now = clockNow()) {
  if (c.state === 'new') return false;
  if (moreUnlocked(c.id.startsWith('w:') ? 'words' : 'parse')) return c.due <= now;
  if (c.state === 'learning' || c.state === 'relearning') return c.due <= now;      // words just missed or found hard come back within minutes: part of today's work once their time comes
  return c.due < dayEnd(now) && (c.last || 0) < dayStart(now);
}
/** Run a count as if "more" were unlocked (to say how much extra is ready). */
export const withMore = (fn) => { const was = forceMore; forceMore = true; try { return fn(); } finally { forceMore = was; } };
export function dueCards(now = clockNow()) {
  const out = [];
  for (const c of K.cards.values()) if (liveWord(c) && dueToday(c, now)) out.push(c);
  return out.sort((a, b) => a.due - b.due);
}
export function newToday() { return (K.daily[todayKey()] || {}).n || 0; }

export function streak() {
  let s = 0; const d = new Date(clockNow());
  const did = (k) => { const x = K.daily[todayKey(k)] || {}; return x.r || x.pr || x.cr; };      // any studying counts: words or parsing
  if (!did(d)) d.setDate(d.getDate() - 1);   // today not done yet doesn't break the streak
  while (did(d)) { s++; d.setDate(d.getDate() - 1); }
  return s;
}

/* ---------- queue building ---------- */
/** Words to study for a passage: not yet known, in the order they first occur (so studying feels like working through the text). */
export function passageWords(scope) {
  const m = scopeCounts(scope);                                          // a Map keeps first-occurrence order
  return [...m.entries()].filter(([n]) => status(n) !== 'known').map(([n, c]) => ({ n, c }));
}
/** New words for a goal, in teaching order: passages and sections by first occurrence, frequency goals most frequent first.
 *  Words you have started or already know are left out, and new verbs are let in only as the verb gate allows. */
export function goalNext(g = currentGoal(), limit = 200) {
  const fresh = (n) => { const c = K.cards.get('w:' + n); return (!c || c.state === 'new') && status(n) !== 'known'; };
  let ns;
  if (g && g.kind === 'freq') ns = D.lex.filter((L) => L.freq >= g.min && fresh(L.n)).sort((a, b) => b.freq - a.freq).map((L) => L.n);
  else ns = passageWords(g).map((x) => x.n).filter(fresh);
  return admitVerbs(ns).slice(0, limit).map((n) => ({ n, c: D.lexByN.get(n).freq }));
}
/** Plain-words reason a passage has nothing to study right now. */
export function waitNote(ps, now = clockNow()) {
  const bits = [];
  if (ps.held) bits.push(ps.held + (ps.held === 1 ? ' verb is' : ' verbs are') + ' paused for now (see Verbs)');
  if (ps.started) bits.push(ps.started + (ps.started === 1 ? ' word you’ve started comes' : ' words you’ve started come') + ' back ' + (isFinite(ps.soonest) ? whenIn(ps.soonest, now) : 'on schedule'));
  return bits.length ? 'Nothing to study right now: ' + bits.join('; ') + '.' : '';
}
const whenIn = (t, now) => { const m = Math.round((t - now) / 6e4); return m < 60 ? 'in ' + Math.max(1, m) + ' min' : m < 1440 ? 'in ' + Math.round(m / 60) + ' h' : 'in ' + Math.round(m / 1440) + ' days'; };
/** What studying a passage can actually deliver right now, and why the rest can't be studied yet (read-only). */
export function passageStudy(scope, now = clockNow()) {
  const dueSet = new Set(withMore(() => dueCards()).map((c) => +c.id.slice(2)));
  let fresh = [], due = 0, started = 0, soonest = Infinity;
  for (const { n } of passageWords(scope)) {
    const c = K.cards.get('w:' + n);
    if (!c || c.state === 'new') fresh.push(n);
    else if (dueSet.has(n)) due++;
    else { started++; if (c.due < soonest) soonest = c.due; }          // already begun; comes back on its own schedule
  }
  const open = admitVerbs(fresh);
  return { fresh: open.length, held: fresh.length - open.length, due, started, soonest, ready: open.length + due };
}
/** Next most-frequent words the learner doesn't know yet (level builder). */
export function nextByLevel(limit) {
  const out = [];
  for (const L of D.lex) { if (status(L.n) === 'unknown') { out.push(L.n); if (out.length >= limit * 3) break; } }
  return admitVerbs(out).slice(0, limit).map((n) => ({ n, c: D.lexByN.get(n).freq }));
}
/** Assumed-known words (no card yet) to spot-check, weighted toward the edge of the declared level. */
export function probeCandidates(limit, exclude = new Set()) {
  if (K.settings.level == null) return [];
  const pool = D.lex.filter((L) => L.freq >= K.settings.level && !L.name && !K.cards.has('w:' + L.n) && !exclude.has(L.n));
  if (!pool.length) return [];
  const w = pool.map((L) => 1 / Math.sqrt(L.freq)); const out = [];
  const used = new Set();
  for (let k = 0; k < limit && used.size < pool.length; k++) {
    const sum = w.reduce((a, x, i) => a + (used.has(i) ? 0 : x), 0); let r = Math.random() * sum, pick = -1;
    for (let i = 0; i < pool.length; i++) { if (used.has(i)) continue; r -= w[i]; if (r <= 0) { pick = i; break; } }
    if (pick < 0) break; used.add(pick); out.push({ n: pool[pick].n, c: pool[pick].freq });
  }
  return out;
}

/** Build a session: due reviews + new words + probes, interleaved. */
export function buildSession({ scope = null, only = null, kind = 'daily', size = K.settings.sessionSize, newLimit = null }) {
  const items = []; const seen = new Set();
  const push = (n, type) => { if (!seen.has(n)) { seen.add(n); items.push({ n, type }); } };
  const due = (scope || only ? withMore(() => dueCards()) : dueCards()).map((c) => +c.id.slice(2));      // a passage or group the learner picked by hand takes everything due right now
  const inScope = scope ? new Set(scopeCounts(scope).keys()) : null;
  const dueList = inScope ? due.filter((n) => inScope.has(n)) : only ? due.filter((n) => only.has(n)) : due;
  let fresh;
  if (kind === 'review') fresh = [];
  else if (only) fresh = D.lex.filter((L) => only.has(L.n) && (!K.cards.has('w:' + L.n) || getCard(L.n).state === 'new') && status(L.n) === 'unknown').map((L) => L.n);
  else if (scope) fresh = passageWords(scope).filter((x) => !K.cards.has('w:' + x.n) || getCard(x.n).state === 'new').map((x) => x.n);
  else { fresh = goalNext(currentGoal(), 200).map((x) => x.n); if (!fresh.length) fresh = nextByLevel(200).map((x) => x.n); }      // goal finished: carry on with the commonest unknown words
  if (kind !== 'review' && (only || scope)) fresh = admitVerbs(fresh);
  const cap = newLimit != null ? newLimit : scope || only ? K.settings.newPerDay : wordsPace().left;
  dueList.slice(0, Math.max(size, 30)).forEach((n) => push(n, 'review'));
  fresh.slice(0, cap).forEach((n) => push(n, 'new'));
  if (kind !== 'review' && !only && K.settings.level != null) {
    const nProbe = Math.round(items.length * K.settings.probeRate / (1 - K.settings.probeRate)) || (items.length ? 1 : 0);
    probeCandidates(nProbe, seen).forEach((x) => push(x.n, 'probe'));
  }
  const order = items.filter((x) => x.type === 'new'), mixed = shuffle(items);
  const newSlots = mixed.map((x, i) => x.type === 'new' ? i : -1).filter((i) => i >= 0);
  newSlots.forEach((i, k) => { mixed[i] = order[k]; });                  // new words keep their teaching order; reviews and probes are mixed in around them
  return mixed.slice(0, scope || only ? 400 : Math.max(size, 40));
}

/** What the normal Vocabulary session will actually contain, counted from the session itself (reviews, new words, spot-checks), so a summary never promises less than it delivers.
 *  Cached for a few seconds and re-worked whenever anything that shapes a session changes. */
let planMemo = null;
export function dailyPlan() {
  const key = [dueCards().length, wordsPace().left, K.cards.size, K.settings.level, K.settings.newPerDay, K.settings.sessionSize, K.settings.probeRate, JSON.stringify(K.goal || null), Math.floor(clockNow() / 3000)].join('|');
  if (planMemo && planMemo.key === key) return planMemo.plan;
  const items = buildSession({ kind: 'daily' }), n = (t) => items.filter((x) => x.type === t).length;
  const plan = { due: n('review'), fresh: n('new'), checkins: n('probe') };
  planMemo = { key, plan };
  return plan;
}

/* ---------- verbs: what you must know, when the forms are learned, and how new verbs arrive ---------- */
export const LEARNED_ACC = 0.9, LEARNED_WINDOW = 10;          // a verb's forms are learned at 90% right over your last 10 answers (and each chosen form known)
export const BRAKE_ACC = 0.75, BRAKE_WINDOW = 20, BRAKE_MIN = 15, UNLEARNED_MAX = 5;   // new verbs pause under 75% right over the last 20 verb-form answers, or when more than 5 verbs are unlearned
export const VERB_SHARE = 4;                                  // about one new verb for every four other new words
const isVerb = (n) => { const L = D.lexByN.get(n); return !!L && L.verb; };
const cardKnown = (c) => !!c && c.state === 'review' && ((c.stability || 0) >= 7 || (c.reps || 0) >= 2);       // the word-card rule
const formKnown = (rows) => rows.some((i) => cardKnown(K.cards.get(parseId(D.forms[i]))));
const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length;
/** δίδωμι, τίθημι, ἵστημι, ἀφίημι, δείκνυμι and their compounds. */
export const isMiVerb = (n) => { const L = D.lexByN.get(n); return !!L && !!miClass(L.head); };
/** Verbs in -μι stay out of daily practice (and are not required of you) until you tick them in Choose forms. */
export const miHeld = (n) => isMiVerb(n) && !(K.settings.gates || {}).mi;
/** Where one verb stands: its required stems and chosen forms (known or not), and whether its forms are learned. Null for a word with no verb forms. */
export function verbStatus(n) {
  if (!verbsOn() || miHeld(n)) return null;
  const rs = requiredStems(n); if (!rs) return null;
  const inPlay = (f) => gateOpen(gateKeyOfTag(D.forms[f.rows[0]].an[0].m, n));       // forms of kinds you have not opened yet are not required
  const stems = rs.stems.map((s) => { const forms = s.forms.filter(inPlay).map((f) => ({ w: f.w, count: f.count, rows: f.rows, known: formKnown(f.rows) })); return { slot: s.slot, name: s.name, share: s.share, forms, known: forms.filter((f) => f.known).length, total: forms.length }; }).filter((s) => s.total > 0);
  const total = stems.reduce((x, s) => x + s.total, 0), known = stems.reduce((x, s) => x + s.known, 0);
  const a = (K.verbParse[n] || []).slice(-LEARNED_WINDOW), acc = a.length ? mean(a) : null;
  return { n, uses: rs.total, share: rs.share, stems, total, known, acc, answers: a.length, learned: total > 0 && known === total && acc != null && acc >= LEARNED_ACC };
}
/** Verbs you have begun: a word card for the verb (not a spot-check), or any of its forms started in Parsing. */
export function startedVerbs() {
  const out = new Set();
  for (const [id, c] of K.cards) {
    if (c.state === 'new' || c.src === 'probe') continue;
    if (id.startsWith('w:')) { const n = +id.slice(2); if (isVerb(n)) out.add(n); }
    else if (id.startsWith('f:')) { const n = +id.split(':')[2]; if (isVerb(n)) out.add(n); }
  }
  return [...out].sort((a, b) => D.lexByN.get(b).freq - D.lexByN.get(a).freq);
}
/** Begun verbs whose forms are not yet learned. */
export const unlearnedVerbs = () => startedVerbs().filter((n) => { const v = verbStatus(n); return v && !v.learned; });
/** The soft brake on new verbs: pause when recent verb-form answers are under 75% right, or when more than five verbs are still unlearned. */
export function verbBrake() {
  const open = unlearnedVerbs().length, a = K.verbAcc.slice(-BRAKE_WINDOW), acc = a.length >= BRAKE_MIN ? mean(a) : null;
  if (open > UNLEARNED_MAX) return { braked: true, open, acc, why: 'New verbs are paused while you finish the ' + open + ' you are learning.' };
  if (acc != null && acc < BRAKE_ACC) return { braked: true, open, acc, why: 'You are answering ' + Math.round(acc * 100) + '% of verb forms correctly, so new verbs are paused while these settle.' };
  return { braked: false, open, acc, why: '' };
}
/** Keeps every other word, and lets verbs in at about one for every four others, unless the brake is on. */
export function admitVerbs(ns) {
  const brake = verbBrake().braked; let verbs = 0, others = 0;
  return ns.filter((n) => {
    if (!isVerb(n)) { others++; return true; }
    if (brake || verbs > Math.floor(others / VERB_SHARE)) return false;
    verbs++; return true;
  });
}
/** Words you started learning in the last few days (for a quick refresher; never touches the schedule). */
export function recentWords(days = 3, now = clockNow()) {
  const since = now - days * 864e5, out = [];
  for (const c of K.cards.values()) {
    if (!c.id.startsWith('w:') || c.state === 'new' || c.src === 'probe' || liveWord(c) === false) continue;
    const t = c.born || (c.reps <= 3 ? c.last : 0);                       // cards from before first-seen dates were kept: judge by the last review of a young card
    if (t >= since) out.push({ n: +c.id.slice(2), t });
  }
  return out.sort((a, b) => b.t - a.t).map((x) => x.n);
}
/* ---------- parsing practice: form-level cards ('f:<form>:<strongs>') ---------- */
export const parseId = (form) => 'f:' + form.plain + ':' + form.an[0].s;
/** Parsing forms due now, counted the way a session serves them (one per form, only forms that are still quizzed). parse.js registers the real counter. */
let dueCounter = null;
export const setParseDueCounter = (fn) => { dueCounter = fn; };
export const parseDueCount = (now = clockNow()) => dueCounter ? dueCounter(now) : parseCardsDue(now).length;
export const parseCardsDue = (now = clockNow()) => [...K.cards.values()].filter((c) => c.id.startsWith('f:') && dueToday(c, now));
/** How many new forms could be taught right now (the Parsing pool, after gates and known words). parse.js registers the real counter. */
let freshCounter = null;
export const setParseFreshCounter = (fn) => { freshCounter = fn; };
export const parseFreshCount = () => (freshCounter ? freshCounter() : Infinity);
export const parseNewToday = () => (K.daily[todayKey()] || {}).pn || 0;
export async function rateParse(id, grade, ms = 0, meta = {}) {
  const now = clockNow();
  const prev = K.cards.get(id) || F.newCard(id);
  const next = F.review(prev, grade, now, K.settings.retention);
  await saveCard(next);
  const d = (K.daily[todayKey()] ||= {}); d.pr = (d.pr || 0) + 1; if (prev.state === 'new') d.pn = (d.pn || 0) + 1;
  await store.set('daily', K.daily);
  K.parseAcc.push(grade >= 3 ? 1 : 0); if (K.parseAcc.length > 40) K.parseAcc.shift(); await store.set('parseAcc', K.parseAcc);
  const sn = id.split(':')[2]; if (sn && isVerb(+sn)) { K.verbAcc.push(grade >= 3 ? 1 : 0); if (K.verbAcc.length > 40) K.verbAcc.shift(); await store.set('verbAcc', K.verbAcc); }
  if (sn) { const a = (K.verbParse[sn] ||= []); a.push(grade >= 3 ? 1 : 0); if (a.length > 20) a.shift(); await store.set('verbParse', K.verbParse); }
  await store.addLog([{ t: now, id, g: grade, k: 'parse', ms, ...meta }]);
  return next;
}
/* ---------- gates: which kinds of verb form daily parsing may ask ---------- */
// Nouns, adjectives, pronouns and articles are never gated: they come with the word. Verbs are held back until you say yes ('verbs'); then present active is on, and every other
// kind is a gate of its own: a row of the master verb chart (opens when you have learned its squares), or one kind of participle, infinitive, subjunctive or imperative (opens when you
// pass that kind's drill). You can also tick or untick any gate by hand. 'mi' (verbs in -μι) and 'rare' (optative, future participles and infinitives, pluperfect) are by hand only.
export const FAM_WINDOW = 20, FAM_MIN = 15, FAM_ACC = 0.85;
const gateMap = () => K.settings.gates || {};
export const verbsOn = () => !!gateMap().verbs;
/** A square of the chart row is learned when its card is known; a row opens by itself once all of its squares are. */
export const chartRowSquares = (r) => CHART_ATTRS.filter((a) => cardKnown(K.cards.get('c:' + r + ':' + a))).length;       // how many of a row's squares are learned
export const chartRowKnown = (r) => chartRowSquares(r) === CHART_ATTRS.length;
export function gateOpen(key) {
  const g = gateMap(); if (!g.verbs) return false;
  if (key === 'row:pres-act') return true;
  if (key.startsWith('row:')) return key in g ? !!g[key] : chartRowKnown(key.slice(4));
  return !!g[key];
}
/** Can a form with these parses (RP tags) be asked? Some parse must be in an open gate, and a -μι verb needs its gate too. */
export const formOpen = (tags, n) => verbsOn() && !miHeld(n) && tags.some((t) => gateOpen(gateKeyOfTag(t, n)));
export const openGateKeys = () => allGateKeys().filter(gateOpen);
export async function setGate(key, on) { await setSetting('gates', { ...gateMap(), [key]: !!on }); }
/** Set many gates at once (a whole category, or every kind): `keys` is a list of gate keys. */
export async function setGates(keys, on) { const g = { ...gateMap() }; for (const k of keys) g[k] = !!on; await setSetting('gates', g); }
/** The answers to "How well do you parse Greek?" (first-run step). Each one sets the gates; 'start' leaves verb parsing off. */
export const PARSE_LEVELS = [
  ['start', 'I’m just starting', 'Verbs stay off for now. You’ll be asked about nouns, adjectives and other words you know, and can turn verbs on later.'],
  ['basics', 'I know the basics', 'I know the present, imperfect, future and aorist active and middle. Participles, infinitives, subjunctive and imperative unlock as you learn them.'],
  ['most', 'I know most forms', 'I can parse nearly everything except verbs in -μι and rare forms like the optative.'],
  ['all', 'I parse everything', 'Ask me about every form, including -μι and the rare ones.'],
];
export async function setParseLevel(key, { merge = false } = {}) {          // merge: an existing user's answer only opens more, it never closes what they have earned
  let g = {};
  if (key === 'basics') { g.verbs = true; for (const r of Object.keys(ROW_LEVEL)) if (ROW_LEVEL[r] === 1) g['row:' + r] = true; }
  else if (key === 'most') g = { ...allGatesOpen(), mi: false, rare: false };
  else if (key === 'all') g = allGatesOpen();
  if (merge) g = { ...gateMap(), ...Object.fromEntries(Object.entries(g).filter(([, v]) => v)) };
  await setSetting('parseLevel', key); await setSetting('parseAsked', true); await setSetting('gates', g);
}
/** The definite article is too simple to ask about once someone has said they know more than the start. */
/** An existing user (a level chosen) who has never been asked how well they parse Greek: they get that question once, on their own. */
export const parseAskDue = () => K.settings.level != null && !K.settings.parseAsked && !K.settings.parseLevel;
export const skipsArticle = () => !!K.settings.parseLevel && K.settings.parseLevel !== 'start';
/** Gate keys that opened between two calls of openGateKeys(): for a message. */
export const newlyOpen = (before) => openGateKeys().filter((k) => !before.includes(k));
/** How a kind's drill is going: answers in the last FAM_WINDOW, and the share right. */
export function gateStats(key) { const a = (K.gateAcc[key] || []).slice(-FAM_WINDOW); return { n: a.length, acc: a.length ? mean(a) : null }; }
/** Answers needed to pass: FAM_MIN, or fewer (but at least 5) for a kind with only a few forms among the verbs you know, so it cannot get stuck. */
export const passNeed = (pool) => Math.min(FAM_MIN, Math.max(5, pool == null ? FAM_MIN : pool));
export const gatePassed = (key, pool) => { const s = gateStats(key); return s.n >= passNeed(pool) && s.acc >= FAM_ACC; };
/** One first-try answer in a kind's drill. Returns true when that opened the kind. */
export async function noteDrill(key, ok, pool) {
  const a = (K.gateAcc[key] ||= []); a.push(ok ? 1 : 0); if (a.length > FAM_WINDOW * 2) a.shift();
  await store.set('gateAcc', K.gateAcc);
  if (!gateOpen(key) && gatePassed(key, pool)) { await setGate(key, true); return true; }
  return false;
}
/** Once: everyone starts with verb parsing off and every gate closed (progress already made is kept). */
export async function bootGates() {
  if (await store.get('gatesInit')) return;
  await setSetting('gates', {}); await setSetting('verbAsk', { n: 0, t: 0 }); await store.set('gatesInit', true);
}
/** The question after a quiz: ask once, once more after a week, then never (the Parsing page keeps a button). */
export function verbAskDue(now = clockNow()) { const a = K.settings.verbAsk || { n: 0, t: 0 }; return !verbsOn() && !(K.settings.parseLevel && K.settings.parseLevel !== 'start') && (a.n === 0 || (a.n === 1 && now - a.t >= 7 * 864e5)); }
export const noteVerbAsk = (now = clockNow()) => setSetting('verbAsk', { n: ((K.settings.verbAsk || {}).n || 0) + 1, t: now });
/** A square of the master verb chart (c:row:part) or a personal ending (e:set:person): scheduled like any card, never mixed into word or form sessions. */
export async function rateChart(id, grade) {
  const now = clockNow(), prev = K.cards.get(id) || F.newCard(id);
  const next = F.review(prev, grade, now, K.settings.retention);
  await saveCard(next);
  const d = (K.daily[todayKey()] ||= {}); d.cr = (d.cr || 0) + 1;
  await store.set('daily', K.daily);
  await store.addLog([{ t: now, id, g: grade, k: 'chart' }]);
  return next;
}
export const chartCardsDue = (now = clockNow()) => [...K.cards.values()].filter((c) => (c.id.startsWith('c:') || c.id.startsWith('e:')) && c.state !== 'new' && c.due <= now);
export const PARSE_DEFAULT = { slots: {}, recent: { verb: [], other: [] }, mode: { verb: 'guided', other: 'guided' }, total: 0 };
export async function getParseStats() { return { ...PARSE_DEFAULT, ...((await store.get('parseStats')) || {}) }; }
export const saveParseStats = (st) => store.set('parseStats', st);

/* ---------- how many new items to start today (vocabulary and parsing): automatic pace ---------- */
export const OVERLOAD = 40;                                   // reviews due across both topics before no new items start anywhere
export const dueTotal = (now = clockNow()) => dueCards(now).length + parseDueCount(now);
const meanOf = (a) => (a.length >= 15 ? a.reduce((x, y) => x + y, 0) / a.length : null);
/** The day's new-item allowance is worked out once, the first time it is asked for, so finishing reviews never raises it. It is re-worked only if the learner changes the daily limit. */
function itemPace(topic, now = clockNow()) {
  const r = paceNow(topic, now), words = topic === 'words', f = words ? 'wc' : 'pc', d = (K.daily[todayKey(now)] ||= {});
  const max = Math.max(0, setting(words ? 'newPerDay' : 'parseNewPerDay'));
  if (r.paused) return r;                                                    // pausing always takes effect at once
  if (d[f] == null || d[f + 'm'] !== max) { d[f] = r.n; d[f + 'm'] = max; store.set('daily', K.daily); }
  return { ...r, n: d[f], left: Math.max(0, d[f] - (words ? newToday() : parseNewToday())) };
}
/** What "Study more today" does to today's record for one topic: everything of that topic due now counts, and a fresh daily allowance of its new items opens on top of whatever was already learned today. The other topic is not touched. */
function applyUnlock(d, now, topic) {
  if (topic === 'parse') {
    d.mp = true;
    if (!parsePace(now).paused) d.pc = Math.max(d.pc || 0, parseNewToday()) + Math.max(0, setting('parseNewPerDay'));
  } else {
    d.mw = true;
    if (!wordsPace(now).paused) d.wc = Math.max(d.wc || 0, newToday()) + Math.max(0, setting('newPerDay'));
  }
}
/** Press "Study more today" for a topic ('words' or 'parse'). */
export async function unlockMore(topic = 'words') {
  const now = clockNow(), d = (K.daily[todayKey(now)] ||= {});
  applyUnlock(d, now, topic);
  await store.set('daily', K.daily);
}
/** Run fn as if "Study more today" had been pressed, then put today's record back exactly as it was. The offer is counted this way, so it cannot disagree with the session the button starts. */
export function previewUnlock(fn, topic = 'words') {
  const now = clockNow(), d = (K.daily[todayKey(now)] ||= {}), keys = ['more', 'mw', 'mp', 'wc', 'wcm', 'pc', 'pcm'], keep = Object.fromEntries(keys.map((k) => [k, d[k]]));
  try { applyUnlock(d, now, topic); return fn(); }
  finally { for (const k of keys) { if (keep[k] === undefined) delete d[k]; else d[k] = keep[k]; } }
}
function paceNow(topic, now = clockNow()) {
  const words = topic === 'words', noun = words ? 'words' : 'forms', pre = topic;
  const max = Math.max(0, setting(words ? 'newPerDay' : 'parseNewPerDay')), today = words ? newToday() : parseNewToday(), due = words ? dueCards(now).length : parseDueCount(now);
  const out = (n, why, extra = {}) => ({ n, left: Math.max(0, n - today), due, why, auto: setting(pre + 'Pace') !== 'fixed', ...extra });
  if (setting(pre + 'Pause')) return out(0, 'New ' + noun + ' are paused.', { paused: true });
  if (setting(pre + 'Pace') === 'fixed') return out(max, '');
  const total = dueTotal(now);
  if (total > OVERLOAD) return out(0, 'You have ' + total + ' reviews waiting across vocabulary and parsing, so new ' + noun + ' wait until you catch up.', { slow: true, overload: true });
  const cap = Math.max(10, setting('sessionSize') || 25), acc = meanOf(words ? K.wordsAcc : K.parseAcc), field = words ? 'n' : 'pn';
  const last = Object.keys(K.daily).filter((k) => (K.daily[k][field] || 0) > 0).sort().pop();
  const gap = last ? (new Date(todayKey()) - new Date(last)) / 864e5 : 99;
  let n = max, why = '', slow = false;
  if (due > cap) { n = 0; slow = true; why = 'You have ' + due + ' ' + noun + ' due, so new ' + noun + ' wait until you catch up.'; }
  else if (due > cap / 2) { n = Math.max(1, Math.round(max / 3)); slow = true; why = 'You have ' + due + ' ' + noun + ' due, so new ' + noun + ' are slowed until you catch up.'; }
  else if (acc != null && acc < 0.75) { n = Math.max(1, Math.round(max / 3)); slow = true; why = 'You’re answering ' + Math.round(acc * 100) + '% correctly, so new ' + noun + ' are slowed while these settle.'; }
  if (n === 0 && today === 0 && gap >= 3 && max > 0) { n = 1; why = 'It’s been a few days, so one new ' + noun.slice(0, -1) + ' keeps things moving. ' + why; }
  return out(Math.min(n, max), why, { acc, slow });
}
export const wordsPace = (now) => itemPace('words', now);
export const parsePace = (now) => itemPace('parse', now);

/* ---------- extra practice: which studied cards give you the most trouble (never writes anything) ---------- */
export function troubleScore(c, now = clockNow()) { return (c.lapses || 0) * 2 + ((c.difficulty || 5) - 5) / 2 + (1 - F.retrievability(c, now)) * 3; }
/** A card is shaky only if you have actually struggled with it: it lapsed, or it was rated Again/Hard so its difficulty rose. Never-missed cards are not. */
/** Studied cards you are least likely to remember right now, for a plain review when nothing is due. Never writes anything. */
export function reviewCards(prefix, limit = 15) {
  const now = clockNow(), fresh = new Set(recentWords(3, now));
  const strongs = (id) => +(prefix === 'p:' ? id.split(':')[1] : id.split(':').pop());   // words you just learned come first
  return [...K.cards.values()].filter((c) => c.id.startsWith(prefix) && c.state !== 'new' && c.src !== 'probe' && (prefix !== 'w:' || liveWord(c)))
    .sort((a, b) => (fresh.has(strongs(b.id)) - fresh.has(strongs(a.id))) || F.retrievability(a, now) - F.retrievability(b, now)).slice(0, limit);
}
export const isShaky = (c) => (c.lapses || 0) > 0 || (c.difficulty || 5) >= 6;
export function troubleCards(prefix, limit = 15) {
  const now = clockNow();
  return [...K.cards.values()].filter((c) => c.id.startsWith(prefix) && c.state !== 'new' && isShaky(c) && (prefix !== 'w:' || liveWord(c))).map((c) => ({ c, s: troubleScore(c, now) }))
    .sort((a, b) => ((b.c.lapses || 0) > 0) - ((a.c.lapses || 0) > 0) || b.s - a.s).slice(0, limit).map((x) => x.c);        // cards you have actually missed come first
}
export const studiedCount = (prefix) => { let n = 0; for (const c of K.cards.values()) if (c.id.startsWith(prefix) && c.state !== 'new' && (prefix !== 'w:' || liveWord(c))) n++; return n; };

export { scopeVerses };
/** Every gate open (verbs on, -μι and rare forms included): used by tests, and handy for a developer. */
export const allGatesOpen = () => Object.fromEntries([...allGateKeys(), 'verbs', 'mi', 'rare'].map((k) => [k, true]));
