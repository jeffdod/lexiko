// When the reader's bars should hide or return, from the scroll position alone.
// Distance is measured from the last turning point, not summed event by event, so the tiny back-and-forth of a slow thumb drag
// (0px and 1px-backwards events) does not start the count over. Hiding needs a little downward travel, returning a little more upward.
export function barTracker(down = 16, up = 24) {
  let shown = true, low = 0, high = 0;
  return {
    /** Tell it where things stand (after the bars were shown or hidden some other way, or while a scroll should not count). */
    set(isShown, y) { shown = isShown; low = y; high = y; },
    /** The new scroll position: true = show the bars, false = hide them, null = leave them. */
    feed(y) {
      if (shown) { if (y < low) low = y; if (y - low > down) { shown = false; high = y; return false; } }
      else { if (y > high) high = y; if (high - y > up) { shown = true; low = y; return true; } }
      return null;
    },
  };
}
