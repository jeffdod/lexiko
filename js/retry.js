// What happens to a word you miss during a vocabulary session.
//  First "Again":   it waits for the retry round at the end of the session (the retry round is one stretch with a count).
//  Second "Again":  inside that round, a few cards later, it comes back as an easier multiple-choice question (a rescue).
//  Third "Again":   one more rescue, a few cards later in the same round.
//  Fourth "Again":  it stops for this session. When the session ends, every word that is still unsettled comes back
//                   together once, later today (see holdToday in know.js).
// "Hard" is not a miss here (the scheduler still treats it as a shaky answer).
export const MAX_MISSES = 4;
/** Returns 'pass' (nothing more now), 'retry' (retry round at the end), 'rescue' (a few cards later, same round) or 'stop' (no more tries this session). */
export function missOutcome(item, miss) {
  if (!miss) return 'pass';
  item.misses = (item.misses || 0) + 1;
  if (item.misses === 1) return 'retry';
  if (item.misses < MAX_MISSES) { item.rescue = true; return 'rescue'; }
  return 'stop';
}
/** Snapshot and restore for Undo. */
export const snap = (item) => ({ misses: item.misses, rescue: item.rescue });
export const restore = (item, s) => { item.misses = s.misses; item.rescue = s.rescue; };
