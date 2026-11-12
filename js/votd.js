// Verse of the day: one verse of the Greek text, picked for the words you know. Reading only: nothing here makes a card, a count or a due item.
// The pick is made once per day and remembered (setting `votd`), so it stays the same all day even as your known words change.
import { D, tokenForm, tokenPunct, tokenFlag, senseNs } from './data.js';
import { K, status, setSetting } from './know.js';
import { todayKey, h, askDialog } from './util.js';
import { keepMyPlace } from './reader.js';

const MIN_WORDS = 8, MAX_WORDS = 22, KNOWN_SHARE = 0.9;            // a verse you can mostly read, long enough to be a real sentence, short enough for a card
const hash = (str) => { let x = 2166136261; for (let i = 0; i < str.length; i++) { x ^= str.charCodeAt(i); x = Math.imul(x, 16777619); } return x >>> 0; };
const strongs = (t) => D.forms[t >> 4].an[0].s;

/** The verse for a day (default today): the candidates are the verses in which at least 90% of the words are known; the date picks one of them.
 *  When there are none (a beginner, nothing known yet), the pool is the shorter verses made of the commonest words. */
export function pickVerse(day = todayKey()) {
  const pool = [], easy = [];
  for (const code of Object.keys(D.text)) for (const [ch, verses] of D.text[code]) for (const [vs, toks] of verses) {
    const n = toks.length; if (n < 5 || n > MAX_WORDS) continue;
    let known = 0, ease = 0;
    for (const t of toks) { if (status(strongs(t)) === 'known') known++; const L = D.lexByN.get(strongs(t)); ease += Math.log(1 + (L ? L.freq : 1)); }
    if (n >= MIN_WORDS && known / n >= KNOWN_SHARE) pool.push([code, ch, vs]);
    else if (n <= 12) easy.push([ease / n + known, code, ch, vs]);
  }
  if (pool.length) { const [code, ch, vs] = pool[hash(day) % pool.length]; return { code, ch, vs }; }
  easy.sort((a, b) => b[0] - a[0]);
  const top = easy.slice(0, 50); if (!top.length) return null;
  const [, code, ch, vs] = top[hash(day) % top.length]; return { code, ch, vs };
}

/** Today's verse, remembered for the day. */
export function verseOfDay() {
  const day = todayKey(), saved = K.settings.votd;
  let v = saved && saved.day === day ? saved : null;
  if (v && !verseToks(v)) v = null;
  if (!v) { const p = pickVerse(day); if (!p) return null; v = { day, ...p }; setSetting('votd', v); }
  return v;
}
const verseToks = (v) => { const c = D.text[v.code] && D.text[v.code].find((x) => x[0] === v.ch), e = c && c[1].find((x) => x[0] === v.vs); return e ? e[1] : null; };

/** The card for Home. The words open the same popup as in the reader. */
export function votdCard() {
  const v = verseOfDay(); if (!v) return null;
  const toks = verseToks(v), sn = senseNs(toks), book = D.bookByCode.get(v.code), line = h('div.votd-text', { lang: 'grc' });
  toks.forEach((t, k) => {
    const dash = tokenFlag(t);
    line.append(h('span.w', { 'data-t': t, 'data-s': sn.ns[k], ...(sn.unsure[k] ? { 'data-u': '1' } : {}) }, tokenForm(t).w), tokenPunct(t) + (dash ? '—' : '') + (dash ? '' : ' '));
  });
  const ref = book.name + ' ' + v.ch + ':' + v.vs, href = '#/read/' + v.code + '/' + v.ch + '/' + v.vs;
  // Opening the reader moves "Continue reading" to the verse. When that would replace a different place, ask first; Escape or a tap outside keeps the place.
  const read = async (e) => {
    const code = K.settings.lastBook, ch = K.settings.lastCh, at = code && D.bookByCode.get(code);
    if (!at || (code === v.code && ch === v.ch)) return;
    e.preventDefault();
    const move = await askDialog({ title: 'Open ' + ref + '?', body: ['Your reading place is ' + at.name + ' ' + (ch || 1) + (K.settings.lastVs ? ':' + K.settings.lastVs : '') + '.'], yes: 'Move my place to ' + ref, no: 'Keep my place' });
    if (!move) keepMyPlace();
    location.hash = href;
  };
  return h('div.card.stack.votd', h('div.row.between', { style: { flexWrap: 'nowrap' } }, h('span.glabel', 'Verse of the day'), h('a.btn.ghost.sm', { style: { flex: 'none' }, href, onclick: read }, 'Read ›')),
    line, h('div.muted.small', ref));
}
