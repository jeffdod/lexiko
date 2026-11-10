// Offering the next kind of verb form: when your verb parsing is going well, lexiko suggests the most common kind you have not opened yet.
// Logic only (the card is in gatesui.js). Accepting opens the kind and lets it in slowly (see applyTrickle in parse.js).
import { clockNow } from './clock.js';
import { K, setSetting, setGate, verbsOn, gateOpen, FAM_WINDOW, FAM_MIN, FAM_ACC } from './know.js';
import { allGateKeys } from './kinds.js';
import { poolForms } from './gatenote.js';
import { rowPool, trickleActive } from './parse.js';
import { D } from './data.js';

export const SNOOZE_DAYS = 7;
/** How often the forms of a kind occur in the text, among the verbs you know. */
function weightOf(key) {
  if (key.startsWith('row:')) return rowPool(key.slice(4), { ignoreLevel: true }).reduce((a, id) => a + D.forms[id].count, 0);
  const [fam, kind] = key.split(':'); return poolForms(fam, kind).reduce((a, f) => a + (f.count || 0), 0);
}
let memo = null;
/** The one kind to offer now, or null: verbs are on, the last answers on verb forms are at least FAM_ACC right (FAM_MIN or more of them), no offer was put off in the last week,
 *  and no kind you just added is still easing in. It is the unopened kind that occurs most among the verbs you know. */
export function gateOffer(now = clockNow()) {
  if (!verbsOn() || now < (K.settings.gateOffer || 0)) return null;
  const a = K.verbAcc.slice(-FAM_WINDOW); if (a.length < FAM_MIN) return null;
  const acc = a.reduce((x, y) => x + y, 0) / a.length; if (acc < FAM_ACC) return null;
  const sig = [K.cards.size, K.settings.level, JSON.stringify(K.settings.gates || null), JSON.stringify(K.settings.gateTrickle || null), Math.floor(now / 60000)].join('|');
  if (!memo || memo.sig !== sig) {
    let best = null;
    if (!trickleActive()) for (const key of allGateKeys()) { if (gateOpen(key)) continue; const w = weightOf(key); if (w > 0 && (!best || w > best.w)) best = { key, w }; }
    memo = { sig, best };
  }
  return memo.best ? { key: memo.best.key, acc, n: a.length } : null;
}
/** Yes: open the kind and start it slowly. */
export async function acceptOffer(key) {
  await setGate(key, true); await setSetting('gateTrickle', { ...(K.settings.gateTrickle || {}), [key]: clockNow() }); memo = null;
}
/** Not yet: no offer for a week. */
export async function putOffOffer() { await setSetting('gateOffer', clockNow() + SNOOZE_DAYS * 864e5); memo = null; }
