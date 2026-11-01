// Knowledge model: which words does the learner know? Combines the level they declared with SRS cards.
import { D, scopeCounts, scopeVerses } from './data.js';
import { store } from './store.js';
import * as F from './fsrs.js';
import { todayKey, shuffle } from './util.js';

export const DEFAULTS = {
  theme: 'auto', level: null, mode: 'flash', newPerDay: 10, probeRate: 0.12, retention: 0.9,
  readerSize: 1.35, verseNums: true, glossMode: false, glossRepeat: false, highlight: true, sessionSize: 25, parseMode: 'auto', parseNewPerDay: 10, partsMode: 'auto', partsNewPerDay: 10,
};
export const K = { settings: { ...DEFAULTS }, cards: new Map(), daily: {}, read: {}, goal: null, ready: false };

export async function initKnow() {
  const s = (await store.get('settings')) || {};
  K.settings = { ...DEFAULTS, ...s };
  K.cards = new Map((await store.allCards()).map((c) => [c.id, c]));
  K.daily = (await store.get('daily')) || {};
  K.read = (await store.get('read')) || {};
  K.goal = (await store.get('goal')) || null;
  K.ready = true;
}

export const setting = (k) => K.settings[k];
export async function setSetting(k, v) {
  K.settings[k] = v; await store.set('settings', K.settings);
  try { if (k === 'theme') localStorage.setItem('lexiko-theme', v); } catch { /* storage may be blocked */ }
}
export async function setGoal(g) { K.goal = g; await store.set('goal', g); }
export async function setReadKey(key, on) {          // key: 'JHN:1' (chapter) or 'p:JHN:1:1' (section)
  if (on) K.read[key] = Date.now(); else delete K.read[key];
  await store.set('read', K.read);
}
export const markRead = (code, ch, on) => setReadKey(code + ':' + ch, on);

export const cardId = (n) => 'w:' + n;
export const getCard = (n) => K.cards.get(cardId(n));

/** 'known' | 'learning' | 'unknown' — drives the reader, readiness and queues. */
export function status(n) {
  const c = K.cards.get('w:' + n);
  if (c) return c.state === 'review' ? 'known' : 'learning';
  const L = D.lexByN.get(n);
  return K.settings.level != null && L && L.freq >= K.settings.level ? 'known' : 'unknown';
}
export const assumed = (n) => !K.cards.has('w:' + n) && status(n) === 'known';

async function saveCard(c) { K.cards.set(c.id, c); await store.putCards([c]); }

function bumpDaily(field) {
  const d = (K.daily[todayKey()] ||= {}); d[field] = (d[field] || 0) + 1;
}

/** Record a review. kind: 'new' | 'review' | 'probe'. */
export async function rate(n, grade, kind = 'review', ms = 0) {
  const now = Date.now();
  const prev = K.cards.get('w:' + n) || F.newCard('w:' + n);
  const next = F.review(prev, grade, now, K.settings.retention);
  next.src = prev.src || kind;
  await saveCard(next);
  bumpDaily('r'); if (prev.state === 'new') bumpDaily('n'); if (grade >= 3) bumpDaily('c');
  await store.set('daily', K.daily);
  await store.addLog([{ t: now, id: 'w:' + n, g: grade, k: kind, ms }]);
  return next;
}

/** "I already know this" — create a stable card without a quiz. */
export async function markKnown(n) {
  const c = F.review(F.newCard('w:' + n), 4, Date.now(), K.settings.retention); c.src = 'manual';
  await saveCard(c); return c;
}
/** "I don't know this" — put it in the learning pile, due now. */
export async function markLearning(n) {
  const c = F.review(F.newCard('w:' + n), 1, Date.now(), K.settings.retention); c.due = Date.now(); c.src = 'manual';
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
const liveWord = (c) => { if (!c.id.startsWith('w:')) return false; const L = D.lexByN.get(+c.id.slice(2)); return !L || !L.senses; };
export function dueCards(now = Date.now()) {
  const out = [];
  for (const c of K.cards.values()) if (liveWord(c) && c.state !== 'new' && c.due <= now) out.push(c);
  return out.sort((a, b) => a.due - b.due);
}
export function dueSoonCount(hours = 24) {
  const lim = Date.now() + hours * 3600000; let n = 0;
  for (const c of K.cards.values()) if (liveWord(c) && c.due <= lim && c.state !== 'new') n++;
  return n;
}
export function newToday() { return (K.daily[todayKey()] || {}).n || 0; }

export function streak() {
  let s = 0; const d = new Date();
  if (!((K.daily[todayKey(d)] || {}).r)) d.setDate(d.getDate() - 1);   // today not done yet doesn't break the streak
  while ((K.daily[todayKey(d)] || {}).r) { s++; d.setDate(d.getDate() - 1); }
  return s;
}

/* ---------- queue building ---------- */
/** Words to study for a passage: not yet known, most useful first. */
export function passageWords(scope) {
  const m = scopeCounts(scope);
  return [...m.entries()].filter(([n]) => status(n) !== 'known')
    .sort((a, b) => b[1] - a[1] || D.lexByN.get(b[0]).freq - D.lexByN.get(a[0]).freq).map(([n, c]) => ({ n, c }));
}
/** Next most-frequent words the learner doesn't know yet (level builder). */
export function nextByLevel(limit) {
  const out = [];
  for (const L of D.lex) { if (status(L.n) === 'unknown') { out.push({ n: L.n, c: L.freq }); if (out.length >= limit) break; } }
  return out;
}
/** Assumed-known words (no card yet) to spot-check, weighted toward the edge of the declared level. */
export function probeCandidates(limit, exclude = new Set()) {
  if (K.settings.level == null) return [];
  const pool = D.lex.filter((L) => L.freq >= K.settings.level && !K.cards.has('w:' + L.n) && !exclude.has(L.n));
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
export function buildSession({ scope = null, kind = 'daily', size = K.settings.sessionSize, newLimit = null }) {
  const items = []; const seen = new Set();
  const push = (n, type) => { if (!seen.has(n)) { seen.add(n); items.push({ n, type }); } };
  const due = dueCards().map((c) => +c.id.slice(2));
  const inScope = scope ? new Set(scopeCounts(scope).keys()) : null;
  const dueList = inScope ? due.filter((n) => inScope.has(n)) : due;
  let fresh;
  if (kind === 'review') fresh = [];
  else if (scope) fresh = passageWords(scope).filter((x) => !K.cards.has('w:' + x.n) || getCard(x.n).state === 'new').map((x) => x.n);
  else fresh = nextByLevel(200).map((x) => x.n);
  const cap = newLimit != null ? newLimit : Math.max(0, K.settings.newPerDay - (scope ? 0 : newToday()));
  dueList.slice(0, Math.max(size, 30)).forEach((n) => push(n, 'review'));
  fresh.slice(0, cap).forEach((n) => push(n, 'new'));
  if (kind !== 'review' && K.settings.level != null) {
    const nProbe = Math.round(items.length * K.settings.probeRate / (1 - K.settings.probeRate)) || (items.length ? 1 : 0);
    probeCandidates(nProbe, seen).forEach((x) => push(x.n, 'probe'));
  }
  return shuffle(items).slice(0, scope ? 400 : Math.max(size, 40));
}
/* ---------- parsing practice: form-level cards ('f:<form>:<strongs>') ---------- */
export const parseId = (form) => 'f:' + form.plain + ':' + form.an[0].s;
export const parseCardsDue = (now = Date.now()) => [...K.cards.values()].filter((c) => c.id.startsWith('f:') && c.state !== 'new' && c.due <= now);
export const parseNewToday = () => (K.daily[todayKey()] || {}).pn || 0;
export async function rateParse(id, grade, ms = 0, meta = {}) {
  const now = Date.now();
  const prev = K.cards.get(id) || F.newCard(id);
  const next = F.review(prev, grade, now, K.settings.retention);
  await saveCard(next);
  const d = (K.daily[todayKey()] ||= {}); d.pr = (d.pr || 0) + 1; if (prev.state === 'new') d.pn = (d.pn || 0) + 1;
  await store.set('daily', K.daily);
  await store.addLog([{ t: now, id, g: grade, k: 'parse', ms, ...meta }]);
  return next;
}
export const PARSE_DEFAULT = { slots: {}, recent: { verb: [], other: [] }, mode: { verb: 'guided', other: 'guided' }, total: 0 };
export async function getParseStats() { return { ...PARSE_DEFAULT, ...((await store.get('parseStats')) || {}) }; }
export const saveParseStats = (st) => store.set('parseStats', st);

/* ---------- principal parts: one card per printed part ('p:<strongs>:<slot>') ---------- */
export const partsId = (n, slot) => 'p:' + n + ':' + slot;
export const partsCardsDue = (now = Date.now()) => [...K.cards.values()].filter((c) => c.id.startsWith('p:') && c.state !== 'new' && c.due <= now);
export const partsNewToday = () => (K.daily[todayKey()] || {}).ppn || 0;
export async function rateParts(id, grade, ms = 0, meta = {}) {
  const now = Date.now();
  const prev = K.cards.get(id) || F.newCard(id);
  const next = F.review(prev, grade, now, K.settings.retention);
  await saveCard(next);
  const d = (K.daily[todayKey()] ||= {}); d.ppr = (d.ppr || 0) + 1; if (prev.state === 'new') d.ppn = (d.ppn || 0) + 1;
  await store.set('daily', K.daily);
  await store.addLog([{ t: now, id, g: grade, k: 'parts', ms, ...meta }]);
  return next;
}
export const PARTS_DEFAULT = { recent: [], mode: 'choice', total: 0 };
export async function getPartsStats() { return { ...PARTS_DEFAULT, ...((await store.get('partsStats')) || {}) }; }
export const savePartsStats = (st) => store.set('partsStats', st);

/* ---------- extra practice: which studied cards give you the most trouble (never writes anything) ---------- */
export function troubleScore(c, now = Date.now()) { return (c.lapses || 0) * 2 + ((c.difficulty || 5) - 5) / 2 + (1 - F.retrievability(c, now)) * 3; }
export function troubleCards(prefix, limit = 15) {
  const now = Date.now();
  return [...K.cards.values()].filter((c) => c.id.startsWith(prefix) && c.state !== 'new' && (prefix !== 'w:' || liveWord(c))).map((c) => ({ c, s: troubleScore(c, now) }))
    .sort((a, b) => b.s - a.s).slice(0, limit).map((x) => x.c);
}
export const studiedCount = (prefix) => { let n = 0; for (const c of K.cards.values()) if (c.id.startsWith(prefix) && c.state !== 'new' && (prefix !== 'w:' || liveWord(c))) n++; return n; };

export { scopeVerses };
