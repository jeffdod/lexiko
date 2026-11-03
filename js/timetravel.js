// Time travel for testing. Starting takes a full snapshot of your progress; leaving puts that snapshot back, so nothing you do
// while pretending it is later affects your real progress. The clock only moves forward.
import { store, makeBackup, importBackup } from './store.js';
import { setTravel, travelState, clockNow } from './clock.js';
import { h, clear, backHead } from './util.js';

export const HOUR = 36e5, DAY = 24 * HOUR;
export async function startTravel() {
  if (travelState().active) return;
  const snap = await makeBackup();                                    // makeBackup leaves out any earlier snapshot
  await store.set('ttBackup', snap);
  setTravel(true, 0);
}
export function advanceTravel(ms) {
  const s = travelState(); if (!s.active) return;
  setTravel(true, s.offset + ms);
}
/** Puts the snapshot back and returns to real time. Reloads the page. */
export async function exitTravel() {
  const snap = await store.get('ttBackup');
  if (!snap) { setTravel(false); location.reload(); return; }
  await importBackup(snap, 'replace');                               // also clears the stored snapshot
  setTravel(false);
  location.reload();
}
export const travelText = () => 'Pretending it is ' + new Date(clockNow()).toLocaleString(undefined, { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });

/** The bar shown on every screen while time travel is on. */
export function travelBar() {
  const el = document.getElementById('ttbar'); if (el) el.remove();
  document.body.classList.toggle('tt', travelState().active);
  if (!travelState().active) return;
  const bar = h('div#ttbar', { role: 'status' }, h('span', travelText()),
    h('button.btn.sm', { onclick: () => { advanceTravel(DAY); location.reload(); } }, '+1 day'),
    h('button.btn.sm.primary', { onclick: async (e) => { e.currentTarget.disabled = true; await exitTravel(); } }, 'Exit and restore'));
  document.body.append(bar);
}

/** The developer page: #/settings/dev */
export function renderDev(view) {
  const on = travelState().active;
  const go = (ms) => () => { advanceTravel(ms); location.reload(); };
  clear(view).append(backHead('Time travel', '#/settings', 'Settings'),
    h('div.stack',
      h('div.card.stack',
        h('p', 'For testing. Starting saves a snapshot of your progress, then lets you move the clock forward so reviews come due. Nothing you do while time-travelling is kept: Exit and restore puts your real progress back exactly as it was.'),
        on ? h('div.stack', h('b', travelText()),
          h('div.row.wrap', h('button.btn', { onclick: go(HOUR) }, '+1 hour'), h('button.btn', { onclick: go(DAY) }, '+1 day'), h('button.btn', { onclick: go(7 * DAY) }, '+1 week')),
          h('button.btn.primary', { onclick: async (e) => { e.currentTarget.disabled = true; await exitTravel(); } }, 'Exit and restore my progress'))
        : h('button.btn.primary', { onclick: async (e) => { e.currentTarget.disabled = true; await startTravel(); location.reload(); } }, 'Start time travel')),
      h('p.muted.small', 'The clock only moves forward. A bar at the top of every screen shows when time travel is on. If something goes wrong, Exit and restore is always there.')));
}
