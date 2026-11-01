// Small DOM + text helpers shared by all views.
/** 1234567 -> "1,234,567" */
export const fmt = (n) => n.toLocaleString('en-US');
export const strip = (s) => s.replace(/­/g, '');
/** Isolated forms are shown with acute, not the running-text grave (καὶ, τὸν -> καί, τόν). */
export const toAcute = (s) => s.normalize('NFD').replace(/̀/g, '́').normalize('NFC');
export const PUNCT = ['', ',', '.', '·', ';'];


/** h('div.card#id', {onclick}, child, 'text', [more]) */
export function h(spec, attrs, ...kids) {
  const m = /^([a-z0-9]+)?((?:[.#][\w-]+)*)$/i.exec(spec) || [];
  const el = document.createElement(m[1] || 'div');
  (m[2] || '').replace(/([.#])([\w-]+)/g, (_, k, v) => { if (k === '.') el.classList.add(v); else el.id = v; });
  if (attrs != null && (typeof attrs !== 'object' || attrs.nodeType || Array.isArray(attrs))) { kids.unshift(attrs); attrs = null; }
  for (const [k, v] of Object.entries(attrs || {})) {
    if (k.startsWith('aria-') && typeof v === 'boolean') { el.setAttribute(k, String(v)); continue; }
    if (v == null || v === false) continue;
    if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
    else if (k === 'class') el.classList.add(...String(v).split(' ').filter(Boolean));
    else if (k === 'dataset') Object.assign(el.dataset, v);
    else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else if (k === 'html') el.innerHTML = v;
    else if (k in el && k !== 'list') { try { el[k] = v; } catch { el.setAttribute(k, v); } }
    else el.setAttribute(k, v === true ? '' : v);
  }
  const add = (k) => {
    if (k == null || k === false) return;
    if (Array.isArray(k)) k.forEach(add);
    else el.append(k.nodeType ? k : document.createTextNode(String(k)));
  };
  kids.forEach(add);
  return el;
}

export function clear(el) { while (el.firstChild) el.removeChild(el.firstChild); return el; }

export function fmtInterval(ms) {
  const m = ms / 60000;
  if (m < 1) return '<1m';
  if (m < 60) return Math.round(m) + 'm';
  const hr = m / 60;
  if (hr < 24) return Math.round(hr) + 'h';
  const d = hr / 24;
  if (d < 30) return Math.round(d) + 'd';
  if (d < 365) return (d / 30).toFixed(d < 90 ? 1 : 0).replace(/\.0$/, '') + 'mo';
  return (d / 365).toFixed(1).replace(/\.0$/, '') + 'y';
}

export const todayKey = (t = Date.now()) => {
  const d = new Date(t);
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
};

export function shuffle(a) {
  for (let i = a.length - 1; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0; [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

export const pct = (x, d = 0) => (x * 100).toFixed(d) + '%';

export function toast(msg, ms = 2600) {
  let host = document.getElementById('toasts');
  if (!host) { host = h('div#toasts', { 'aria-live': 'polite' }); document.body.append(host); }
  const t = h('div.toast', msg); host.append(t);
  setTimeout(() => { t.classList.add('out'); setTimeout(() => t.remove(), 300); }, ms);
}

/** Icons (stroke, currentColor). */
const ICONS = {
  home: 'M3 11l9-8 9 8M5 10v10h5v-6h4v6h5V10',
  read: 'M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2V5zM4 19a2 2 0 0 0 2 2h13',
  learn: 'M12 3l9 4.5-9 4.5-9-4.5L12 3zM7 11v5c0 1.5 2.2 3 5 3s5-1.5 5-3v-5',
  progress: 'M4 20V10M10 20V4M16 20v-7M22 20H2',
  settings: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z',
  chevL: 'M15 18l-6-6 6-6',
  chevR: 'M9 18l6-6-6-6',
  close: 'M6 6l12 12M18 6L6 18',
  search: 'M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM20 20l-4-4',
  check: 'M5 12l5 5L20 7',
  flame: 'M12 3c1 3 4 4.5 4 8.5A4 4 0 0 1 8 12c0-1.5.7-2.5 1.5-3.5C10.5 7.2 11.5 5.5 12 3zM12 21a5 5 0 0 0 5-5',
  target: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM12 12h.01',
  download: 'M12 3v12m0 0l-4-4m4 4l4-4M4 19h16',
  upload: 'M12 15V3m0 0L8 7m4-4l4 4M4 19h16',
  book: 'M4 4h12a3 3 0 0 1 3 3v13H7a3 3 0 0 1-3-3V4z',
  text: 'M4 7V5h16v2M9 19h6M12 5v14',
  table: 'M3 5h18v14H3zM3 10h18M9 5v14',
};
export function icon(name, size = 22) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24'); svg.setAttribute('width', size); svg.setAttribute('height', size);
  svg.setAttribute('fill', 'none'); svg.setAttribute('stroke', 'currentColor'); svg.setAttribute('stroke-width', '1.8');
  svg.setAttribute('stroke-linecap', 'round'); svg.setAttribute('stroke-linejoin', 'round'); svg.setAttribute('aria-hidden', 'true');
  const p = document.createElementNS('http://www.w3.org/2000/svg', 'path'); p.setAttribute('d', ICONS[name] || ''); svg.append(p);
  return svg;
}

/** Shown on Extra practice screens: nothing answered here touches the review schedule. */
export const practiceBanner = (preview) => h('div.practice-note', h('b', preview ? 'Look ahead' : 'Strengthen'), ' — ' + (preview ? 'a look at new material; it won’t change your schedule.' : 'practice only; it won’t change your review schedule.'));

/** A collapsed section: keeps secondary options out of the way until you want them. */
export const fold = (title, ...kids) => h('details.fold', h('summary', title), h('div.stack', kids));
/** The one big button of a page: what to do next, with a line saying what it will give you. */
export const startButton = (s) => h('a.btn.primary.block.start', { href: s.href }, h('b', s.label), s.sub ? h('small', s.sub) : null);
