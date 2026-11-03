// Principal parts: an exercise, not a quiz. You are given a verb and a part name and choose the form (or check yourself with a flashcard).
// Nothing is scheduled, graded, counted or gated: a wrong answer just shows the right form. It lives on the Verbs page and in each verb's page.
import { D, lexeme } from './data.js';
import { K, setting, startedVerbs } from './know.js';
import { h, clear, shuffle, pct, icon, practiceBanner, missedBlock, backLinks } from './util.js';
import { partsGrid } from './partforms.js';
const SMOOTH = matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth';   // no animated scrolling for people who ask for less motion

export const SLOT_NAMES = ['Present', 'Future', 'Aorist active', 'Perfect active', 'Perfect middle/passive', 'Aorist passive'];
const ORDER = [2, 1, 5, 3, 4];                    // the order a verb's parts are asked (the present is the headword, so it isn't a question)
const skel = (s) => s.normalize('NFD').replace(/[̀-ͯͅ]/g, '').toLowerCase().replace(/ς/g, 'σ');

/* ---------- which verbs / parts exist ---------- */
let eligibleCache = null;
export function eligible() {                           // strongs -> entry, for verbs with at least one part besides the present
  if (!eligibleCache) {
    eligibleCache = new Map();
    for (const e of D.parts.values()) if (D.lexByN.has(e.n) && e.parts.slice(1).some(Boolean)) eligibleCache.set(e.n, e);
  }
  return eligibleCache;
}
const cardParts = (e) => ORDER.filter((s) => e.parts[s]);
const parseCardId = (id) => { const [, n, s] = id.split(':'); return { n: +n, slot: +s }; };

/* ---------- answer choices ---------- */
const commonLen = (a, b) => { let i = 0; while (i < a.length && i < b.length && a[i] === b[i]) i++; return i; };
const tail = (s, k) => s.slice(-k);

function mechanical(form) {                                     // plausible slips: no augment, or another tense's ending
  const out = [], p = form.normalize('NFC');
  if (/^[ἐἠ]/.test(p) && p.length > 4) out.push(p.slice(1));
  const swaps = { 'θην': ['σα', 'ην', 'κα'], 'μην': ['σα', 'ον'], 'μαι': ['κα', 'σομαι'], 'σα': ['κα', 'ον', 'θην'], 'κα': ['σα', 'μαι'], 'ον': ['σα', 'ην'], 'ην': ['θην', 'ον'], 'σω': ['σα', 'ξω']};
  const end = Object.keys(swaps).find((e) => p.endsWith(e));
  if (end) for (const r of shuffle(swaps[end].slice())) out.push(p.slice(0, -end.length) + r);
  return out;
}

/** Four forms for "<verb>, <part>?": the right one, a different part of the same verb, the same part of a look-alike verb, and a slip. */
export function recallOptions(entry, slot) {
  const correct = entry.parts[slot], taken = new Set([correct]), picks = [];
  const add = (f) => { if (f && !taken.has(f) && picks.length < 3) { taken.add(f); picks.push(f); } };
  shuffle(entry.parts.filter((p, i) => i !== slot && p)).slice(0, 1).forEach(add);
  const others = [...eligible().values()].filter((e) => e.n !== entry.n && e.parts[slot]).map((e) => ({ f: e.parts[slot], k: skel(e.parts[slot]) }));
  const c = skel(correct);
  const like = shuffle(others.filter((o) => tail(o.k, 3) === tail(c, 3)));
  add(like[0] && like[0].f);
  mechanical(correct).slice(0, 2).forEach(add);
  shuffle(others.filter((o) => tail(o.k, 2) === tail(c, 2))).forEach((o) => add(o.f));
  shuffle(others).forEach((o) => add(o.f));
  return shuffle([correct, ...picks]);
}

/** Four verbs for "which verb is this part of?": the right one and three that look similar. */
export function verbOptions(entry) {
  const k = skel(entry.lemma);
  const scored = [...eligible().values()].filter((e) => e.n !== entry.n && skel(e.lemma) !== k)
    .map((e) => { const s = skel(e.lemma); return { e, sc: commonLen(s, k) * 2 + (tail(s, 3) === tail(k, 3) ? 2 : 0) + Math.random() * 2 }; })
    .sort((a, b) => b.sc - a.sc).slice(0, 12).map((x) => x.e);
  return shuffle([entry, ...shuffle(scored).slice(0, 3)]);
}

/* ---------- the exercise ---------- */
/** Questions for some verbs: every part each has, in a random order. With no verbs given: the verbs you have been working on, else the commonest ones. */
export function exerciseQueue(ns = null) {
  let verbs = ns ? ns.map((n) => eligible().get(n)).filter(Boolean) : startedVerbs().map((n) => eligible().get(n)).filter(Boolean);
  if (!ns && verbs.length < 5) { const have = new Set(verbs.map((e) => e.n)); verbs = [...verbs, ...[...eligible().values()].filter((e) => !have.has(e.n)).sort((a, b) => lexeme(b.n).freq - lexeme(a.n).freq).slice(0, 8 - verbs.length)]; }
  return shuffle(verbs.slice(0, 12).flatMap((e) => cardParts(e).map((slot) => ({ n: e.n, slot })))).slice(0, 20);
}

let keyHandler = null;
const stop = () => { if (keyHandler) { document.removeEventListener('keydown', keyHandler); keyHandler = null; } };

function runSession(view, queue, { restart, back }) {
  const total = queue.length, S = { shown: 0, done: 0, good: 0, missed: [] };
  const finish = () => {
    stop();
    clear(view).append(h('div.pagehead', h('h1', 'Exercise complete')),
      h('div.card.stack', h('p.muted.small', 'Extra practice: nothing was scheduled or counted.'),
        h('div.kpis', h('div.kpi', h('b', S.done), h('span', 'parts done')), h('div.kpi', h('b', S.done ? pct(S.good / S.done) : '—'), h('span', 'right first time'))),
        missedBlock(S.missed.map((m) => ({ greek: true, word: lexeme(m.n).head, sub: SLOT_NAMES[m.slot] })), () => runSession(view, shuffle(S.missed.map((m) => ({ ...m }))), { restart, back })),
        h('div.row.wrap', h('button.btn' + (S.missed.length ? '' : '.primary'), { onclick: restart }, 'Another round'), ...backLinks(back.href, back.label))));
  };
  const next = () => { stop(); const c = queue.shift(); if (!c) return finish(); S.shown++; show(c); };
  const answer = (c, ok) => { S.done++; if (ok) S.good++; else S.missed.push(c); next(); };

  function frame(inner, ctl) {
    clear(view).append(h('div.qwrap',
      h('div.qtop', h('button.btn.ghost.icon.sm', { 'aria-label': 'End exercise', onclick: finish }, icon('close', 20)),
        h('div.bar.accent.grow', h('i', { style: { width: (100 * S.shown / total) + '%' } })), h('span.qcount', { 'aria-label': 'Question ' + S.shown + ' of ' + total }, S.shown + ' / ' + total)),
      h('div.practice-note', h('b', 'Extra practice'), ' — nothing here is scheduled, graded or counted.'), inner, ctl || null));
  }
  const verbPanel = (entry, slot) => h('div.fb.ok', h('div.row.between', h('b', { lang: 'grc' }, entry.lemma), h('span.small.muted', lexeme(entry.n).short || lexeme(entry.n).brief)), partsGrid(entry.n, entry, SLOT_NAMES, { hi: slot }));
  const setKeys = (enter) => {
    stop();
    keyHandler = (e) => {
      if (e.key === 'Enter' && enter && enter()) { e.preventDefault(); return; }
      const n = +e.key; if (!n) return;
      const b = [...view.querySelectorAll('.opt')].filter((x) => !x.disabled)[n - 1]; if (b) b.click();
    };
    document.addEventListener('keydown', keyHandler);
  };
  const optBtn = (label, onclick) => h('button.opt', { onclick }, h('span', { lang: 'grc' }, label), h('span.mark', ''));
  const settle = (b, right, picked) => { b.disabled = true; b.classList.toggle('right', right); if (picked && !right) b.classList.add('wrong'); b.querySelector('.mark').textContent = right ? '✓' : (picked ? '✗' : ''); };

  function show(c) {
    const entry = eligible().get(c.n); if (!entry || !entry.parts[c.slot]) return next();
    const L = lexeme(c.n), form = entry.parts[c.slot], flash = setting('mode') === 'flash';
    const card = h('div.qcard', h('div.qgreek', { lang: 'grc' }, entry.lemma), h('div.qmeta', (L.short || L.brief) + ' · G' + c.n), h('div.qask', SLOT_NAMES[c.slot] + '?'), h('div', { id: 'ans' }));
    const tail2 = h('div'), continueBtn = (ok, label) => { const b = h('button.btn.primary.block', { onclick: () => answer(c, ok) }, label); setKeys(() => { b.click(); return true; }); return b; };
    if (!flash) {                                                    // multiple choice: the verb and a part name → the form
      const optsEl = h('div.opts'), choices = recallOptions(entry, c.slot);
      choices.forEach((f) => optsEl.append(optBtn(f, (ev) => {
        const ok = f === form; [...optsEl.children].forEach((b, i) => settle(b, choices[i] === form, b === ev.currentTarget));
        clear(tail2).append(verbPanel(entry, c.slot), continueBtn(ok, 'Continue')); tail2.scrollIntoView({ block: 'nearest', behavior: SMOOTH });
      })));
      const idk = h('button.btn.ghost.sm', { onclick: () => { [...optsEl.children].forEach((b, i) => settle(b, choices[i] === form, false)); clear(tail2).append(verbPanel(entry, c.slot), continueBtn(false, 'Continue')); idk.remove(); } }, 'I don’t know');
      frame([card, optsEl, h('div.row', idk)], tail2); setKeys(null); return;
    }
    let shown = false;                                               // flashcard: recall it, then check
    const ctl = h('div'), reveal = () => {
      shown = true; card.querySelector('#ans').append(h('div.qgreek.ans', { lang: 'grc' }, form));
      clear(ctl).append(verbPanel(entry, c.slot), h('div.grades.two', h('button.g1', { onclick: () => answer(c, false) }, 'Again'), h('button.g3', { onclick: () => answer(c, true) }, 'Got it'))); stop();
    };
    clear(ctl).append(h('button.btn.primary.block', { onclick: reveal }, 'Show answer'));
    frame([card], ctl); setKeys(() => { if (!shown) { reveal(); return true; } return false; });
  }
  next();
  return stop;
}

/* ---------- route ---------- */
export function renderParts(view, params) {
  const [mode, rest] = params;
  if (mode !== 'exercise') { location.replace('#/learn/verbs'); return; }
  const n = rest ? +rest : null, e = n ? eligible().get(n) : null, back = n ? { href: '#/learn/verb/' + n, label: 'Back to this verb' } : { href: '#/learn/verbs', label: 'Back to Verbs' };
  const queue = exerciseQueue(n ? [n] : null);
  if (!queue.length) { clear(view).append(h('div.pagehead', h('h1', 'Principal parts')), h('div.card.stack', h('p', n ? 'This verb has no principal parts beyond its first form.' : 'There are no principal parts to practice yet.'), h('a.btn', { href: back.href }, 'Back'))); return; }
  return runSession(view, queue, { restart: () => renderParts(view, params), back });
}
