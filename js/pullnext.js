// Pull up at the end of a chapter to open the next one (touch screens only; the Next button stays). A drag that starts while the page
// is already at the very bottom lifts the page and shows a hint; past a set distance the hint says "Release for …" and letting go opens
// the chapter. Letting go early cancels. It never starts from the end of a fast scroll, and not while a dialog or word popup is open.
const THRESHOLD = 90;          // finger travel, in px, that makes the hint say "Release"
const MAX_LIFT = 100;          // how far the page lifts, in px

export function pullNext({ el, label, go, blocked }) {
  const atEnd = () => scrollY + innerHeight >= document.documentElement.scrollHeight - 2;
  const reduce = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
  const word = el.firstElementChild;
  let startY = null, pulling = false, ready = false, lastScroll = 0;
  const reset = () => { startY = null; pulling = false; ready = false; el.classList.remove('live', 'ready'); el.style.height = '0px'; };
  const show = (dy) => {
    ready = dy >= THRESHOLD;
    el.classList.add('live'); el.classList.toggle('ready', ready);
    word.textContent = '↑ ' + (ready ? 'Release for ' : 'Pull up for ') + label;
    el.style.height = (reduce() ? 56 : Math.min(dy * 0.7, MAX_LIFT)) + 'px';
    scrollTo(0, document.documentElement.scrollHeight);                       // keep the hint in view as the page grows
  };
  const onScroll = () => { lastScroll = performance.now(); };
  const start = (e) => {
    startY = null;
    if (e.touches.length !== 1 || !atEnd() || performance.now() - lastScroll < 150 || blocked() || (e.target.closest && e.target.closest('input, select, textarea, dialog, #pop'))) return;
    startY = e.touches[0].clientY; pulling = false; ready = false;
  };
  const move = (e) => {
    if (startY == null) return;
    const dy = startY - e.touches[0].clientY;
    if (!pulling) { if (dy > 10 && atEnd()) pulling = true; else { if (dy < -10) startY = null; return; } }
    if (e.cancelable) e.preventDefault();                                      // no browser bounce while the hint is showing
    if (dy <= 0) { el.style.height = '0px'; ready = false; return; }
    show(dy);
  };
  const end = () => { const open = pulling && ready; reset(); if (open) go(); };
  addEventListener('scroll', onScroll, { passive: true });
  document.addEventListener('touchstart', start, { passive: true });
  document.addEventListener('touchmove', move, { passive: false });
  document.addEventListener('touchend', end); document.addEventListener('touchcancel', reset);
  reset();
  return () => { removeEventListener('scroll', onScroll); document.removeEventListener('touchstart', start); document.removeEventListener('touchmove', move); document.removeEventListener('touchend', end); document.removeEventListener('touchcancel', reset); };
}
