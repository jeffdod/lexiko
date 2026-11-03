// The app's clock. Everything that needs "now" asks this instead of Date.now(), so time can be moved forward for testing
// (Settings › developer page, #/settings/dev). The offset lives in localStorage, outside the progress database, so
// restoring a backup never touches it. For everyone else it is zero and clockNow() is just Date.now().
const KEY = 'lexiko.timeTravel';
let st = { active: false, offset: 0 };
try { const s = JSON.parse(localStorage.getItem(KEY) || 'null'); if (s && s.active) st = { active: true, offset: Math.max(0, +s.offset || 0) }; } catch { /* no storage: real time */ }

export const clockNow = () => Date.now() + st.offset;
export const travelState = () => ({ ...st });
export function setTravel(active, offset = 0) {
  st = { active: !!active, offset: active ? Math.max(0, offset) : 0 };
  try { if (st.active) localStorage.setItem(KEY, JSON.stringify(st)); else localStorage.removeItem(KEY); } catch { /* ignore */ }
}
