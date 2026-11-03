// What happens to a card you miss during a session (shared by vocabulary and parsing).
//  First "Again":   one retry later in the same session.
//  Second "Again":  its next appearance is a rescue: an easier, multiple-choice style question.
//  After the rescue: it stops for this session, whatever you answered; the scheduler brings it back when it is due.
// "Hard" is not a miss here (the scheduler still treats it as a shaky answer).
/** Returns 'pass' (nothing more now), 'retry', 'rescue' (requeue it as a rescue) or 'stop' (a rescue was answered; never requeue). */
export function missOutcome(item, miss) {
  if (item.rescue) return miss ? 'stop' : 'pass';
  if (!miss) return 'pass';
  item.misses = (item.misses || 0) + 1;
  if (item.misses === 1) return 'retry';
  item.rescue = true;
  return 'rescue';
}
/** Snapshot and restore for Undo. */
export const snap = (item) => ({ misses: item.misses, rescue: item.rescue });
export const restore = (item, s) => { item.misses = s.misses; item.rescue = s.rescue; };
