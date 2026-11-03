// FSRS-4.5 spaced-repetition scheduler (public algorithm; default parameters).
// R(t,S) = (1 + 19/81 * t/S)^-0.5.  Grades: 1 Again, 2 Hard, 3 Good, 4 Easy.
import { clockNow } from './clock.js';
const W = [0.4872, 1.4003, 3.7145, 13.8206, 5.1618, 1.2298, 0.8975, 0.031, 1.6474, 0.1367, 1.0461, 2.1072, 0.0793, 0.3246, 1.587, 0.2272, 2.8755];
const DECAY = -0.5, FACTOR = 19 / 81, DAY = 86400000, MIN = 60000;

const clampD = (d) => Math.min(10, Math.max(1, d));
const initS = (g) => Math.max(0.1, W[g - 1]);
const initD = (g) => clampD(W[4] - W[5] * (g - 3));
const nextD = (d, g) => clampD(W[7] * initD(3) + (1 - W[7]) * (d - W[6] * (g - 3)));
const recallS = (d, s, r, g) => s * (1 + Math.exp(W[8]) * (11 - d) * Math.pow(s, -W[9]) * (Math.exp((1 - r) * W[10]) - 1) * (g === 2 ? W[15] : 1) * (g === 4 ? W[16] : 1));
const forgetS = (d, s, r) => Math.min(s, W[11] * Math.pow(d, -W[12]) * (Math.pow(s + 1, W[13]) - 1) * Math.exp((1 - r) * W[14]));

export const newCard = (id) => ({ id, state: 'new', due: 0, stability: 0, difficulty: 0, reps: 0, lapses: 0, last: 0 });

export function retrievability(c, now = clockNow()) {
  if (!c.stability || !c.last) return 0;
  return Math.pow(1 + FACTOR * Math.max(0, (now - c.last) / DAY) / c.stability, DECAY);
}
/** Days until retrievability decays to `r`. */
export const intervalDays = (s, r = 0.9) => Math.max(1, Math.round((s / FACTOR) * (Math.pow(r, 1 / DECAY) - 1)));

/** Spread long intervals a little so cards learned together don't all come due together (about ±15% under a week, ±10% under 3 weeks, ±5% beyond). */
const fuzzDays = (d) => d < 3 ? d : Math.max(1, Math.round(d * (1 + (Math.random() * 2 - 1) * (d < 7 ? 0.15 : d < 20 ? 0.1 : 0.05))));
/** A card due in `days` days comes due when that study day starts (4 am), not at the same clock time, so an evening learner sees it that evening. */
export function dueAfterDays(days, now) {
  const x = new Date(now + days * DAY);
  if (x.getHours() < 4) x.setDate(x.getDate() - 1);
  x.setHours(4, 0, 0, 0);
  return Math.max(x.getTime(), now + 6 * 60 * MIN);
}
/** Returns the updated card (does not mutate). fuzz: false gives the exact interval (for button labels). */
export function review(card, g, now = clockNow(), retention = 0.9, fuzz = true) {
  const days = (s) => dueAfterDays(fuzz ? fuzzDays(intervalDays(s, retention)) : intervalDays(s, retention), now);
  const c = { ...card };
  if (c.state === 'new') {
    c.stability = initS(g); c.difficulty = initD(g); c.reps = 1; c.last = now;
    if (g === 1) { c.state = 'learning'; c.due = now + MIN; }
    else if (g === 2) { c.state = 'learning'; c.due = now + 6 * MIN; }
    else { c.state = 'review'; c.due = days(c.stability); }
    return c;
  }
  const r = retrievability(c, now) || 1;
  const wasReview = c.state === 'review';
  c.reps++;
  if (g === 1) {
    if (wasReview) c.lapses++;
    c.stability = forgetS(c.difficulty, c.stability, r);
    c.difficulty = nextD(c.difficulty, g);
    c.state = wasReview ? 'relearning' : c.state;
    c.due = now + (wasReview ? 10 * MIN : MIN);
  } else {
    c.stability = recallS(c.difficulty, c.stability, r, g);
    c.difficulty = nextD(c.difficulty, g);
    if (!wasReview && g === 2) { c.due = now + 6 * MIN; }
    else { c.state = 'review'; c.due = days(c.stability); }
  }
  c.last = now;
  return c;
}

/** ms until due for each grade, for button labels. */
export function preview(card, now = clockNow(), retention = 0.9) {
  const out = {};
  for (const g of [1, 2, 3, 4]) out[g] = review(card, g, now, retention, false).due - now;
  return out;
}
