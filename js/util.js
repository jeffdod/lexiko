// Small DOM + text helpers shared by all views.
import { clockNow } from './clock.js';
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

/** Append children, skipping null and false (DOM append() would print them as text). */
export function add(el, ...kids) { el.append(...kids.filter((k) => k != null && k !== false)); return el; }
export function clear(el) { while (el.firstChild) el.removeChild(el.firstChild); return el; }

/** "in a minute or so" / "in about 3d": for telling someone when a card will come back. */
export const soonText = (ms) => ms < 120000 ? 'in a minute or so' : 'in about ' + fmtInterval(ms);

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

export const todayKey = (t = clockNow()) => {
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

/** A small yes/no question in a dialog. Resolves true for the main button and false for the other, Escape or a tap outside; "No" is the focused one, so a stray tap changes nothing. */
export function askDialog({ title, body, yes, no }) {
  return new Promise((resolve) => {
    let answer = false;
    const end = (v) => () => { answer = v; dlg.close(); };
    const dlg = h('dialog.ask', { 'aria-label': title }, h('div.stack', h('h2', title), ...body.map((t) => h('p', t)),
      h('div.row.wrap.end', h('button.btn', { autofocus: true, onclick: end(false) }, no), h('button.btn.primary', { onclick: end(true) }, yes))));
    dlg.addEventListener('close', () => { dlg.remove(); resolve(answer); });
    dlg.addEventListener('click', (e) => { if (e.target === dlg) dlg.close(); });
    document.body.append(dlg); dlg.showModal();
  });
}

/** Icons (stroke, currentColor). */
const ICONS = {
  home: 'M3 11l9-8 9 8M5 10v10h5v-6h4v6h5V10',
  read: 'M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2V5zM4 19a2 2 0 0 0 2 2h13',
  learn: 'M12 3l9 4.5-9 4.5-9-4.5L12 3zM7 11v5c0 1.5 2.2 3 5 3s5-1.5 5-3v-5',
  progress: 'M4 20V10M10 20V4M16 20v-7M22 20H2',
  settings: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z',
  clock: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 7v5l3 2',
  chevL: 'M15 18l-6-6 6-6', chevU: 'M6 15l6-6 6 6', chevD: 'M6 9l6 6 6-6',
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

/** "Read in context →" under a verse in a quiz. It leaves the quiz, so it is a small target (the words only) and asks first. */
export const readInContext = (href) => h('div.ctxread', h('a.small', { href, onclick: (e) => { if (!confirm('Leave this quiz to read in context? You won’t come back to this round.')) e.preventDefault(); } }, 'Read in context →'));

/** Shown on Extra practice screens: nothing answered here touches the review schedule. */
export const practiceBanner = (preview, recent = false, row = false) => h('div.practice-note', h('b', preview ? 'Look ahead' : recent ? 'Refresher' : row ? 'Chart practice' : 'Strengthen'), ' — ' + (preview ? 'a look at new material; it won’t change your schedule.' : row ? 'real forms from the text, in verbs you know; practice only, so it won’t change your review schedule.' : recent ? 'words you started recently; practice only, so it won’t change your review schedule.' : 'practice only; it won’t change your review schedule.'));

/** A collapsed section: keeps secondary options out of the way until you want them. */
/** A big tappable card: icon, title, one line saying what it is, an optional example line, an optional count badge and a chevron. */
export const areaCard = ({ href, ic, title, sub, ex, badge, chevron = true }) => h('a.area', { href }, icon(ic, 28), h('div.grow', h('b', title), sub ? h('span', sub) : null, ex ? h('div.ex', ex) : null), badge ? h('em.due', badge) : null, chevron ? h('span.chev', icon('chevR', 18)) : null);
export const fold = (title, ...kids) => h('details.fold', h('summary', title), h('div.stack', kids));
/** The one big button of a page: what to do next, with a line saying what it will give you. */
export const startButton = (s) => h('a.btn.primary.block.start', { href: s.href }, h('b', s.label), s.sub ? h('small', s.sub) : null);

/** "You missed N" list for a finished session, with a button that practices just those. rows: [{ word, sub, why, greek }] */
export function missedBlock(rows, onPractice) {
  if (!rows.length) return null;
  return h('div.missed', h('h3', 'You missed ' + rows.length),
    rows.map((r) => h('div.miss', h('span' + (r.greek ? '.g' : '.w'), r.greek ? { lang: 'grc' } : {}, r.word), r.sub ? h('small', r.sub) : null, r.why ? h('small.wrong', r.why) : null)),
    h('div.row.wrap', h('button.btn.primary', { onclick: onPractice }, 'Practice these ' + rows.length)));
}

/* ---------- "Back to …" after a quiz: offer the place the quiz was started from ---------- */
export const origin = { href: null, prev: null, readFrom: null };
export const QUIZ = /^#\/(learn\/(daily|review|set|practice|level|passage|charts\/run|charts\/participles\/run|charts\/infinitives\/run|charts\/subjunctive\/run|charts\/imperative\/run)|parse\/run|parts\/exercise)/;
/** Called on every route change: remembers where a quiz was launched from (not from another quiz). */
/* ---------- Back: the screens visited, so the arrow at the top of a page can behave like the browser's back button ---------- */
const trail = []; let replacing = false;
/** Screens you must never be sent back to or restored: a quiz or practice session (it would start again), the one-time how-to, and the redirecting Learn hub. */
export const NOT_RESUMABLE = (hash) => QUIZ.test(hash || '') || /^#\/(parse\/(form|howto)|learn$)/.test(hash || '');
/** Go to another screen in place of this one (a redirect), so it never counts as a screen you can go back to. */
export const redirect = (hash) => { replacing = true; location.replace(hash); };
const noteTrail = (cur) => {
  if (replacing) { replacing = false; if (trail.length) trail[trail.length - 1] = cur; else trail.push(cur); }
  else if (trail[trail.length - 1] === cur) { /* same screen again */ }
  else if (trail.length >= 2 && trail[trail.length - 2] === cur) trail.pop();                // the browser's back button (or ours)
  else { trail.push(cur); if (trail.length > 60) trail.shift(); }
};
/** The screen before this one, when going back to it makes sense; otherwise null (the page's own fixed destination is used). */
export const backTarget = () => { const p = trail[trail.length - 2]; return p && !NOT_RESUMABLE(p) ? p : null; };
export function noteRoute(hash) {
  const cur = hash || '#/';
  noteTrail(cur);
  if (QUIZ.test(cur) && !QUIZ.test(origin.prev || '')) origin.href = origin.prev == null ? null : origin.prev || '#/';
  if (cur.startsWith('#/read') && !(origin.prev || '').startsWith('#/read')) origin.readFrom = origin.prev || null;      // where the reader was entered from
  origin.prev = cur;
}
const ORIGIN_LABEL = [[/^#\/(home)?$/, 'Back to Home'], [/^#\/read/, 'Back to reading'], [/^#\/progress/, 'Back to Progress'], [/^#\/learn\/words/, 'Back to Vocabulary'], [/^#\/learn$/, 'Back to Home'],
  [/^#\/parse(\/(form|chart))?$/, 'Back to Parsing'], [/^#\/reference/, 'Back to Reference'], [/^#\/learn\/verbs?(\/|$)/, 'Back to Verbs'], [/^#\/settings/, 'Back to Settings'], [/^#\/search/, 'Back to Glossary'],
  [/^#\/parse\/kinds\/ind/, 'Back to Indicative'], [/^#\/parse\/kinds\/ptc/, 'Back to Participles'], [/^#\/parse\/kinds\/inf/, 'Back to Infinitives'], [/^#\/parse\/kinds\/sub/, 'Back to Subjunctive'], [/^#\/parse\/kinds\/imp/, 'Back to Imperative']];
/** True when the drill that just ended was started from one of the "Unlock verb forms" pages (Indicative, Participles, ...). */
export const startedFromKinds = () => /^#\/parse\/kinds\//.test(origin.href || '');
/** The usual "Back to <topic page>" button, preceded by one to wherever the quiz was started from when that is somewhere else. */
export function backLinks(defaultHref, defaultLabel, primary = false) {
  const o = origin.href, hit = o && o !== defaultHref && ORIGIN_LABEL.find(([re]) => re.test(o));
  const main = h('a.btn' + (primary && !hit ? '.primary' : ''), { href: defaultHref }, defaultLabel);
  return hit ? [h('a.btn' + (primary ? '.primary' : ''), { href: o }, hit[1]), main] : [main];
}

/** "I know this" buttons: one for most words; for verbs, the meaning alone, or the meaning and the parsing too. */
export function knowButtons(L, markKnown, after) {
  const go = (full, msg) => async () => { await markKnown(L.n, full); toast(msg); after && after(); };
  if (!L.verb) return [h('button.btn.sm', { onclick: go(false, 'Marked as known') }, '✓ I know this')];
  return [h('button.btn.sm', { onclick: go(false, 'Marked: you know the meaning. Its forms are still to learn.') }, '✓ I know the meaning'),
    h('button.btn.sm', { onclick: go(true, 'Marked as known, meaning and parsing') }, '✓ I know the meaning and parsing')];
}

/** A "‹ Back to …" link for the reader when it was opened from search or a Learn page (an installed app has no browser back button). Null otherwise. */
export function readBack() {
  const o = origin.readFrom, hit = o && /^#\/(search|learn\/(words|verbs?)|learn$|parse$)/.test(o) && ORIGIN_LABEL.find(([re]) => re.test(o));
  return hit ? h('div.readback', h('a.btn.ghost.sm', { href: o }, icon('chevL', 18), hit[1])) : null;
}

/** A page heading with a visible way back, for when there is no browser back button (installed app). */
export function backHead(title, href, label) {
  const p = backTarget(), hit = p && ORIGIN_LABEL.find(([re]) => re.test(p)), name = p ? (hit ? hit[1] : 'Back') : 'Back to ' + label;      // like the browser's back button when there is a screen to go back to
  return h('div.pagehead', h('a.btn.ghost.icon.sm', { href: p || href, 'aria-label': name, title: name }, icon('chevL', 22)), h('h1', title));
}

/** A round button at the lower right of a long page: the arrow points the way you last scrolled, a tap jumps to the top or bottom,
 *  and it fades away when you stop scrolling. Returns a function that removes it (hand that back as the route's cleanup). */
export function scrollButton() {
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const doc = document.documentElement, b = h('button.scrollfab', { type: 'button' });
  let dir = 'down', last = scrollY, timer = 0;
  const atTop = () => scrollY < 40, atEnd = () => scrollY + innerHeight >= doc.scrollHeight - 40, tall = () => doc.scrollHeight > innerHeight * 1.6;
  const paint = () => { clear(b).append(icon(dir === 'up' ? 'chevU' : 'chevD', 24)); b.setAttribute('aria-label', dir === 'up' ? 'Jump to top' : 'Jump to bottom'); };
  const hide = () => { b.classList.remove('on'); };
  const wake = (ms = 2200) => { if (!tall()) return hide(); b.classList.add('on'); clearTimeout(timer); timer = setTimeout(() => { if (!b.matches(':focus-visible')) hide(); }, ms); };
  const onScroll = () => {
    const dy = scrollY - last; if (Math.abs(dy) < 4) return; last = scrollY;
    dir = dy > 0 ? 'down' : 'up'; if (atTop()) dir = 'down'; if (atEnd()) dir = 'up';
    paint(); wake();
  };
  b.addEventListener('click', () => { scrollTo({ top: dir === 'up' ? 0 : doc.scrollHeight, behavior: reduce ? 'auto' : 'smooth' }); });
  b.addEventListener('focus', () => wake(4000));
  paint(); document.body.append(b); addEventListener('scroll', onScroll, { passive: true });
  return () => { clearTimeout(timer); removeEventListener('scroll', onScroll); b.remove(); };
}
