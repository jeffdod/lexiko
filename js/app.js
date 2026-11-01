// lexiko — app shell: loading, routing, navigation, service worker, install prompt.
import { loadData } from './data.js';
import { initKnow, K } from './know.js';
import { requestPersistence } from './store.js';
import { renderHome } from './home.js';
import { renderReader } from './reader.js';
import { renderLearn } from './learn.js';
import { renderProgress } from './progress.js';
import { renderParse } from './parse.js';
import { renderParts } from './parts.js';
import { renderSearch } from './search.js';
import { renderHelp } from './help.js';
import { renderSettings, applyTheme } from './settings.js';
import { h, clear, icon, toast } from './util.js';

const view = document.getElementById('view');
const navEl = document.getElementById('nav');
const TABS = [['home', 'Home', 'home'], ['read', 'Read', 'read'], ['learn', 'Learn', 'learn'], ['progress', 'Progress', 'progress'], ['settings', 'Settings', 'settings']];
const routes = { home: renderHome, read: renderReader, learn: renderLearn, progress: renderProgress, settings: renderSettings, parse: renderParse, parts: renderParts, search: renderSearch, help: renderHelp };
let cleanup = null;

function buildNav() {
  clear(navEl).append(h('a.brand', { href: '#/home', 'aria-label': 'lexiko home' }, 'λ'),
    ...TABS.map(([id, label, ic]) => h('a', { href: id === 'read' ? '#/read' : '#/' + id, dataset: { tab: id } }, icon(ic, 24), label)));
}
function route() {
  const parts = (location.hash.replace(/^#\/?/, '') || 'home').split('/').map(decodeURIComponent);
  const name = routes[parts[0]] ? parts[0] : 'home';
  if (cleanup) { try { cleanup(); } catch (e) { console.error(e); } cleanup = null; }
  const tabName = name === 'parse' || name === 'parts' ? 'learn' : name === 'search' ? 'home' : name === 'help' ? 'settings' : name;
  navEl.querySelectorAll('a[data-tab]').forEach((a) => (a.dataset.tab === tabName ? a.setAttribute('aria-current', 'page') : a.removeAttribute('aria-current')));
  view.scrollTop = 0; window.scrollTo(0, 0);
  try { cleanup = routes[name](view, parts.slice(1)) || null; }
  catch (e) { console.error(e); clear(view).append(h('div.card', h('h2', 'Something went wrong'), h('p.muted', String(e && e.message || e)), h('a.btn', { href: '#/home' }, 'Home'))); }
  view.focus({ preventScroll: true });
}

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

/* Installed (home-screen) app: no pinch or double-tap zoom, so the layout can't be knocked out of size by accident.
   In an ordinary browser tab zoom stays available. */
if (matchMedia('(display-mode: standalone)').matches || navigator.standalone) {
  document.querySelector('meta[name=viewport]')?.setAttribute('content', 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover');
  for (const ev of ['gesturestart', 'gesturechange', 'gestureend']) document.addEventListener(ev, (e) => e.preventDefault());
}

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
  buildNav();
  window.addEventListener('hashchange', route);
  route();
  document.getElementById('loading').classList.add('done'); setTimeout(() => document.getElementById('loading').remove(), 400);
  registerSW();
  requestPersistence();                                               // ask the OS to keep our storage
  window.addEventListener('pointerdown', () => requestPersistence(), { once: true });   // some browsers only grant after a gesture
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => { if (K.settings.theme === 'auto') applyTheme('auto'); });
}
boot();
