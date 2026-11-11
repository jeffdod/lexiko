// The "Add lexiko to your Home Screen" nudge on Home. Shown after 15 studied words, only where installing is possible and only when the app is not already installed.
// "Not now" asks once more about two weeks later, then never; installing ends it for good. (Settings keeps its Install card.)
import { K, setSetting } from './know.js';
import { clockNow } from './clock.js';

const DAY = 864e5, SNOOZE_DAYS = 14, MAX_ASKS = 2, MIN_WORDS = 15;
export const isStandalone = () => matchMedia('(display-mode: standalone)').matches || !!navigator.standalone;
export const isIOS = () => /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

/** Is it time to offer? iPhone and iPad can always add it by hand; other browsers only when they have offered the install prompt. */
export function installDue(studiedWords) {
  const s = K.settings, now = clockNow();
  if (isStandalone() || studiedWords < MIN_WORDS) return false;
  if ((s.installAsks || 0) >= MAX_ASKS || (s.installSnooze && now < s.installSnooze)) return false;
  return isIOS() || !!window.__installEvt;
}
export const installNotNow = () => setSetting('installAsks', (K.settings.installAsks || 0) + 1).then(() => setSetting('installSnooze', clockNow() + SNOOZE_DAYS * DAY));
export const installDone = () => setSetting('installAsks', MAX_ASKS);
window.addEventListener('appinstalled', () => { installDone(); });
