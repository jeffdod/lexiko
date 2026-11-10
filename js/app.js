// lexiko — app shell: loading, routing, navigation, service worker, install prompt.
import { loadData } from './data.js';
import { initKnow, K } from './know.js';
import { requestPersistence } from './store.js';
import { renderHome } from './home.js';
import { upcoming, whenText, counts, smartAll } from './smart.js';
import { renderReader } from './reader.js';
import { renderLearn } from './learn.js';
import { renderProgress } from './progress.js';
import { renderParse } from './parse.js';
import { bootGates } from './know.js';
import { renderParts } from './parts.js';
import { renderReference } from './reference.js';
import { renderSearch } from './search.js';
import { renderHelp } from './help.js';
import { renderSettings, applyTheme } from './settings.js';
import { h, clear, icon, noteRoute, NOT_RESUMABLE } from './util.js';
import { travelBar } from './timetravel.js';
import { startAutoBackup } from './backup.js';

const view = document.getElementById('view');
const navEl = document.getElementById('nav');
const TABS = [['home', 'Home', 'home'], ['read', 'Read', 'read'], ['progress', 'Progress', 'progress'], ['settings', 'Settings', 'settings']];
const routes = { home: renderHome, read: renderReader, learn: renderLearn, progress: renderProgress, settings: renderSettings, parse: renderParse, parts: renderParts, reference: renderReference, search: renderSearch, help: renderHelp };
let cleanup = null;

const lastIn = {};          // the last screen you were on in each tab, so a tab opens where you left it (for this visit only)
const tabRoot = (id) => '#/' + id;
function buildNav() {
  clear(navEl).append(...TABS.map(([id, label, ic]) => h('a', { href: tabRoot(id), dataset: { tab: id },
    onclick: (e) => { e.preventDefault(); const here = navEl.querySelector('a[aria-current]'); location.hash = here && here.dataset.tab === id ? tabRoot(id) : (lastIn[id] || tabRoot(id)); } }, icon(ic, 24), label)));
}
let routed = false;
function route() {
  // The browser's (or the phone's) back and forward buttons must never land in a quiz or exercise: every screen is stamped once it has been shown, so
  // arriving on a stamped one means a trip through history, and a quiz screen reached that way is skipped.
  const stamped = !!(history.state && history.state.lx), viaHistory = routed && stamped;
  routed = true; if (!stamped) { try { history.replaceState({ lx: 1 }, ''); } catch (e) { /* not available: skip nothing */ } }
  if (viaHistory && NOT_RESUMABLE(location.hash) && history.length > 1) { history.back(); return; }
  noteRoute(location.hash);
  const parts = (location.hash.replace(/^#\/?/, '') || 'home').split('/').map(decodeURIComponent);
  const name = routes[parts[0]] ? parts[0] : 'home';
  if (cleanup) { try { cleanup(); } catch (e) { console.error(e); } cleanup = null; }
  const tabName = name === 'parse' || name === 'parts' || name === 'reference' || name === 'learn' || name === 'search' ? 'home' : name === 'help' ? 'settings' : name;
  if (!NOT_RESUMABLE(location.hash)) lastIn[tabName] = location.hash || tabRoot(tabName);
  navEl.querySelectorAll('a[data-tab]').forEach((a) => (a.dataset.tab === tabName ? a.setAttribute('aria-current', 'page') : a.removeAttribute('aria-current')));
  view.scrollTop = 0; window.scrollTo(0, 0);
  try { cleanup = routes[name](view, parts.slice(1)) || null; }
  catch (e) { console.error(e); clear(view).append(h('div.card', h('h2', 'Something went wrong'), h('p.muted', String(e && e.message || e)), h('a.btn', { href: '#/home' }, 'Home'))); }
  view.focus({ preventScroll: true });
}

/* Keep the "next review in…" text and the big button honest while a screen stays open: redraw when something changes. */
const LIVE = new Set(['', '#/home', '#/learn', '#/learn/words', '#/parse', '#/learn/verbs']);
let liveSig = '';
const signature = () => { const u = upcoming(), c = counts(), a = smartAll(); return [u.all.due, whenText(u.all.next), c.words.due, c.parse.due, a.label, a.sub].join('|'); };
function refreshLive() {
  if (document.visibilityState !== 'visible' || !LIVE.has(location.hash.replace(/\/$/, ''))) return;
  try { const sig = signature(); if (liveSig && sig !== liveSig) { const y = window.scrollY; route(); window.scrollTo(0, y); } liveSig = sig; } catch (e) { console.error(e); }
}
document.addEventListener('visibilitychange', refreshLive);
setInterval(refreshLive, 30 * 1000);
window.addEventListener('hashchange', () => { liveSig = ''; setTimeout(() => { try { if (LIVE.has(location.hash)) liveSig = signature(); } catch (e) {} }, 0); });

async function registerSW() {
  if (!('serviceWorker' in navigator)) return;
  const hadController = !!navigator.serviceWorker.controller;   // false on the very first visit
  let wantReload = false;                                       // set when the user taps “Reload”
  try {
    const reg = await navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' });   // always revalidate sw.js and sw-assets.js (GitHub Pages caches 10 min)
    const offer = (worker) => {
      if (document.getElementById('upd')) return;
      document.body.append(h('div#upd.banner.info', { style: { position: 'fixed', left: '1rem', right: '1rem', bottom: 'calc(var(--nav-h) + env(safe-area-inset-bottom) + 1rem)', zIndex: 95 } },
        h('div.grow', h('b', 'Update ready'), h('div.small', 'A new version of lexiko has been downloaded.')),
        h('button.btn.sm.primary', { onclick: () => { wantReload = true; worker.postMessage('SKIP_WAITING'); } }, 'Reload')));
    };
    if (reg.waiting && navigator.serviceWorker.controller) offer(reg.waiting);
    reg.addEventListener('updatefound', () => {
      const w = reg.installing; if (!w) return;
      w.addEventListener('statechange', () => { if (w.state === 'installed' && navigator.serviceWorker.controller) offer(w); });
    });
    // look for a new version when the app comes back to the front and once an hour, not only at launch (an installed app can stay open for days)
    const check = () => { reg.update().catch(() => {}); };
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') check(); });
    setInterval(check, 60 * 60 * 1000);
    let reloaded = false;
    // reload only when an existing worker was replaced (user tapped “Reload”); never on first install
    navigator.serviceWorker.addEventListener('controllerchange', () => { if ((hadController || wantReload) && !reloaded) { reloaded = true; location.reload(); } });
  } catch (e) { console.warn('Service worker not registered:', e); }
}

window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); window.__installEvt = e; });

/* Zoom stays available everywhere, including the installed app, so text can be enlarged for readability.
   Double-tap zoom is off (touch-action: manipulation in the CSS) and inputs are 16px, so the page can't jump in size by itself. */

async function boot() {
  const bar = document.getElementById('loadbar'), msg = document.getElementById('loadmsg');
  try {
    await Promise.all([loadData((p) => { bar.style.width = Math.max(4, p * 100) + '%'; }), initKnow()]);
  } catch (e) {
    console.error(e); msg.textContent = 'Could not load the data: ' + (e.message || e) + '. If you are offline for the first time, reconnect once so lexiko can download itself.';
    return;
  }
  applyTheme(K.settings.theme);
  try { localStorage.setItem('lexiko-theme', K.settings.theme); } catch { /* ignore */ }
  try { await bootGates(); } catch (e) { console.warn('gates:', e); }
  buildNav(); startAutoBackup();
  window.addEventListener('hashchange', route);
  travelBar();
  route();
  // keep the brand screen up long enough to register, not a flash (skipped under test automation)
  bar.style.width = '100%';
  const MIN_MS = navigator.webdriver ? 0 : 1800, wait = MIN_MS - performance.now();
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  document.getElementById('loading').classList.add('done'); setTimeout(() => document.getElementById('loading').remove(), 400);
  registerSW();
  requestPersistence();                                               // ask the OS to keep our storage
  window.addEventListener('pointerdown', () => requestPersistence(), { once: true });   // some browsers only grant after a gesture
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => { if (K.settings.theme === 'auto') applyTheme('auto'); });
}
boot();
