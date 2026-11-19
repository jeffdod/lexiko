// What happens to a word you miss during a vocabulary session.
//  First "Again":   it waits for the retry round at the end of the session (the retry round is one stretch with a count).
//  Second "Again":  inside that round, MIN_GAP cards later, it comes back as an easier multiple-choice question (a rescue). If fewer than MIN_GAP other cards are left
//                   it does not come straight back: it is held and returns with the other unsettled words later today.
//  Third "Again":   one more rescue under the same rule.
//  Fourth "Again":  it stops for this session. When the session ends, every word that is still unsettled comes back
//                   together once, later today (see holdToday in know.js).
// "Hard" is not a miss here (the scheduler still treats it as a shaky answer).
export const MAX_MISSES = 4;
export const MIN_GAP = 4;                                   // a word missed again comes back only after at least this many other cards; if fewer are left it is held for later today

/** Returns 'pass' (nothing more now), 'retry' (retry round at the end), 'rescue' (MIN_GAP cards later, same round), 'hold' (too few cards left to leave a gap: later today) or 'stop' (no more tries this session).
 *  `others` is how many other cards are still waiting; leave it out (practice) to always allow the rescue. */
export function missOutcome(item, miss, others = Infinity) {
  if (!miss) return 'pass';
  item.misses = (item.misses || 0) + 1;
  if (item.misses === 1) return 'retry';
  if (item.misses < MAX_MISSES) { if (others < MIN_GAP) return 'hold'; item.rescue = true; return 'rescue'; }
  return 'stop';
}
/** Snapshot and restore for Undo. */
export const snap = (item) => ({ misses: item.misses, rescue: item.rescue });
export const restore = (item, s) => { item.misses = s.misses; item.rescue = s.rescue; };
