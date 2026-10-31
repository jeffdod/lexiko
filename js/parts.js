// Principal parts: learn the six parts of each verb (present, future, aorist active, perfect active,
// perfect middle/passive, aorist passive). One FSRS card per printed part. Two question styles:
//   recognise — you're shown a part: pick the verb it belongs to, then which part it is
//   recall    — you're shown a verb and a part name: pick the form (multiple choice) or remember it (self-graded)
// "Auto" starts with multiple choice and moves to self-graded flashcards once you're reliable.
import { D, lexeme, scopeCounts, scopeLabel } from './data.js';
import { K, status, setting, setSetting, partsId, partsCardsDue, partsNewToday, rateParts, getPartsStats, savePartsStats, troubleCards, studiedCount } from './know.js';
import * as F from './fsrs.js';
import { decode } from './morph.js';
import { explain } from './stem.js';
import { h, clear, shuffle, pct, icon, fmtInterval, toast, practiceBanner, fold, startButton } from './util.js';
import { smart, TOPICS } from './smart.js';
import { passagePicker } from './learn.js';
import { readHref } from './reader.js';
import { chartsButton, chartRowFor } from './charts.js';

const fmt = (n) => n.toLocaleString('en-US');
export const SLOT_NAMES = ['Present', 'Future', 'Aorist active', 'Perfect active', 'Perfect middle/passive', 'Aorist passive'];
const LEARN_ORDER = [2, 1, 5, 3, 4];                    // the order a verb's parts are introduced (the present is the headword, so it isn't a card)
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
const cardParts = (e) => LEARN_ORDER.filter((s) => e.parts[s]);
const parseCardId = (id) => { const [, n, s] = id.split(':'); return { n: +n, slot: +s }; };

function poolVerbs(scope) {
  const elig = eligible();
  if (scope) return [...scopeCounts(scope)].filter(([n]) => elig.has(n)).map(([n, c]) => ({ n, w: c * 3 + Math.sqrt(lexeme(n).freq) }));
  let out = [...elig.keys()].filter((n) => status(n) !== 'unknown').map((n) => ({ n, w: lexeme(n).freq }));
  if (out.length < 15) out = [...elig.keys()].filter((n) => lexeme(n).rank <= 500).map((n) => ({ n, w: lexeme(n).freq }));      // nothing known yet: the most common verbs
  return out;
}

/** What a session would contain right now: parts due, then new parts (spread across verbs) up to the daily allowance. */
export function planPartsSession({ scope = null, size = setting('sessionSize'), newLimit = null } = {}) {
  const verbs = poolVerbs(scope), inPool = new Map(verbs.map((v) => [v.n, v.w]));
  const due = partsCardsDue().map((c) => ({ c, ...parseCardId(c.id) })).filter((x) => eligible().has(x.n) && eligible().get(x.n).parts[x.slot] && (!scope || inPool.has(x.n)))
    .sort((a, b) => a.c.due - b.c.due);
  const byRank = [];
  for (const { n, w } of verbs) {
    let rank = 0;
    for (const slot of cardParts(eligible().get(n))) {
      const c = K.cards.get(partsId(n, slot)); if (c && c.state !== 'new') continue;
      (byRank[rank] ||= []).push({ n, slot, s: Math.sqrt(w) * (0.6 + Math.random() * 0.8) }); rank++;
    }
  }
  const fresh = byRank.flatMap((r) => (r || []).sort((a, b) => b.s - a.s));
  const limit = newLimit != null ? newLimit : scope ? size : Math.max(0, setting('partsNewPerDay') - partsNewToday());
  return { due, fresh, limit, size };
}
export function buildPartsSession(opts) {
  const { due, fresh, limit, size } = planPartsSession(opts);
  const dueItems = due.slice(0, size).map((x) => ({ n: x.n, slot: x.slot, type: 'review' }));
  const newItems = fresh.slice(0, Math.min(limit, Math.max(0, size - dueItems.length))).map((x) => ({ n: x.n, slot: x.slot, type: 'new' }));
  return shuffle([...dueItems, ...newItems]);
}
/** Extra practice: nothing here is ever scheduled. 'trouble' = your shakiest parts; 'preview' = a few parts you haven't started. */
export function buildPartsExtra(kind, scope = null) {
  if (kind === 'trouble') return troubleCards('p:', 15).map((c) => ({ ...parseCardId(c.id), type: 'practice' })).filter((x) => eligible().get(x.n) && eligible().get(x.n).parts[x.slot]);
  return planPartsSession({ scope, newLimit: 6 }).fresh.slice(0, 6).map((x) => ({ n: x.n, slot: x.slot, type: 'preview' }));
}

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

function notesFor(entry, slot) {
  const form = entry.parts[slot]; if (!form) return [];
  const mid = slot <= 1 ? /μαι$/.test(skel(form)) : slot === 2 ? /μην$/.test(skel(form)) : false;
  let code = ['V-PAI-1S', 'V-FAI-1S', 'V-AAI-1S', 'V-RAI-1S', 'V-RPI-1S', 'V-API-1S'][slot];
  if (mid) code = code.replace(/^(V-.)A/, '$1M');
  try { return explain(lexeme(entry.n).head, form, decode(code)); } catch { return []; }
}

/* ---------- session ---------- */
let keyHandler = null;
const stop = () => { if (keyHandler) { document.removeEventListener('keydown', keyHandler); keyHandler = null; } };
const modeOf = (st) => { const p = setting('partsMode'); return p === 'choice' || p === 'flash' ? p : (st.mode || 'choice'); };

async function recordResult(st, grade) {
  st.recent.push(grade >= 3 ? 1 : 0); if (st.recent.length > 40) st.recent.shift(); st.total = (st.total || 0) + 1;
  if (setting('partsMode') === 'auto') {
    const sum = (a) => a.reduce((x, y) => x + y, 0), r = st.recent, cur = st.mode || 'choice';
    if (cur === 'choice' && r.length >= 20 && sum(r.slice(-20)) / 20 >= 0.85) { st.mode = 'flash'; st.recent = []; toast('Nice — you know these well, so lexiko moved you to self-graded flashcards.', 5000); }
    else if (cur === 'flash' && r.length >= 12 && sum(r.slice(-12)) / 12 < 0.6) { st.mode = 'choice'; st.recent = []; toast('Back to multiple choice for a while.', 4500); }
  }
  await savePartsStats(st);
}

function runSession(view, queue, { scope, restart, practice }) {
  const total = queue.length, S = { done: 0, good: 0, fresh: 0 };
  const added = [];
  let st = null, t0 = 0;

  const finish = () => {
    stop();
    clear(view).append(h('div.pagehead', h('h1', practice ? (S.previewOnly ? 'Preview complete' : 'Practice complete') : 'Session complete')),
      h('div.card.stack',
        practice ? h('p.muted.small', 'Reinforce is practice only — your review schedule is unchanged.') : null,
        h('div.kpis', h('div.kpi', h('b', S.done), h('span', 'parts done')), h('div.kpi', h('b', S.done ? pct(S.good / S.done) : '—'), h('span', 'answered correctly')), practice ? null : h('div.kpi', h('b', S.fresh), h('span', 'new parts started'))),
        h('div.row.wrap', h('button.btn.primary', { onclick: restart }, practice ? 'Another round' : 'Practise more'),
          h('a.btn', { href: '#/parts' }, 'Back to Principal parts'), scope ? h('a.btn', { href: readHref(scope.book, scope.c1, scope.v1 > 1 ? scope.v1 : 0) }, icon('read', 18), 'Read ' + scopeLabel(scope)) : null)));
  };

  const advance = async () => { stop(); const c = queue.shift(); if (!c) return finish(); st = await getPartsStats(); show(c); };

  async function grade(c, g) {
    const first = !c.retry;
    if (first) {
      if (!practice) { await rateParts(partsId(c.n, c.slot), g, Date.now() - t0, { m: c.fmt }); await recordResult(st, g); if (c.type === 'new') S.fresh++; }
      S.done++; if (g >= 3) S.good++;
    }
    if (g < 3) queue.splice(Math.min(queue.length, g === 1 ? 3 : 6), 0, { ...c, retry: true });
    advance();
  }

  function frame(c, entry, inner, ctl) {
    const tag = c.retry ? ['warn', 'Once more'] : c.type === 'new' ? ['accent', 'New'] : c.type === 'practice' ? ['', 'Reinforce'] : c.type === 'preview' ? ['accent', 'Preview'] : ['', 'Review'];
    S.previewOnly = c.type === 'preview';
    clear(view).append(h('div.qwrap',
      h('div.qtop', h('button.btn.ghost.icon.sm', { 'aria-label': 'End session', onclick: () => { if (confirm('End this session? Your answers so far are saved.')) finish(); } }, icon('close', 20)),
        h('div.bar.accent.grow', h('i', { style: { width: (100 * S.done / total) + '%' } })), chartsButton(() => (c.revealed ? chartRowFor(c.slot, entry.parts[c.slot]) : null)), h('span.chip' + (tag[0] ? '.' + tag[0] : ''), tag[1])),
      practice ? practiceBanner(c.type === 'preview') : null, inner, ctl || null));
  }

  /* the verb with all its parts, the tested one marked, and why it looks that way */
  function verbPanel(entry, slot) {
    const L = lexeme(entry.n), notes = notesFor(entry, slot);
    return h('div.fb.ok',
      h('div.row.between', h('b', { lang: 'grc' }, entry.lemma), h('span.small.muted', L.short || L.brief)),
      h('div.partsgrid', SLOT_NAMES.map((name, i) => h('div.pp' + (i === slot ? '.hi' : '') + (entry.parts[i] ? '' : '.none'), h('small', name), h('span', { lang: 'grc' }, entry.parts[i] || '—')))),
      notes.length ? h('details.why', { open: false }, h('summary', 'Why it looks like this'), h('ul', notes.map((n) => h('li', n)))) : null);
  }

  const setKeys = (enter) => {
    stop();
    keyHandler = (e) => {
      if (e.key === 'Enter' && enter && enter()) { e.preventDefault(); return; }
      const n = +e.key; if (!n) return;
      const b = [...view.querySelectorAll('.opt')].filter((x) => !x.disabled)[n - 1]; if (b) b.click();
    };
    document.addEventListener('keydown', keyHandler);
  };

  const optBtn = (label, onclick, greek) => h('button.opt', { onclick }, h('span', greek ? { lang: 'grc' } : {}, label), h('span.mark', ''));
  const settleBtn = (b, right, picked) => { b.disabled = true; b.classList.toggle('right', right); if (picked && !right) b.classList.add('wrong'); b.querySelector('.mark').textContent = right ? '✓' : (picked ? '✗' : ''); };

  function show(c) {
    t0 = Date.now();
    const entry = eligible().get(c.n); if (!entry || !entry.parts[c.slot]) return advance();
    const L = lexeme(c.n), form = entry.parts[c.slot], mode = modeOf(st);
    const gloss = h('div.qmeta', (L.short || L.brief) + ' · G' + c.n);
    const continueBtn = (g, label) => { const b = h('button.btn.primary.block', { onclick: () => grade(c, g) }, label || 'Continue'); setKeys(() => { b.click(); return true; }); return b; };

    /* recognise: form → verb → part */
    if (mode === 'choice' && (c.fmt || (c.fmt = Math.random() < 0.4 ? 'rec' : 'rcl')) === 'rec') {
      let verbOK = null, partOK = null;
      const card = h('div.qcard', h('div.qgreek', { lang: 'grc' }, form), h('div.qmeta', 'Which verb is this a principal part of?'));
      const step1 = h('div.opts', { style: { marginTop: '.8rem' } }), step2 = h('div.opts.two', { hidden: true }), tail2 = h('div');
      const opts = verbOptions(entry);
      opts.forEach((o) => step1.append(optBtn((o.lemma + ' — ' + ((lexeme(o.n).short) || lexeme(o.n).brief)), (ev) => {
        verbOK = o.n === entry.n; [...step1.children].forEach((b, i) => settleBtn(b, opts[i].n === entry.n, b === ev.currentTarget));
        card.append(h('div.qmeta', { style: { marginTop: '.6rem' } }, 'Which part is it?')); step2.hidden = false; setKeys(null);
      })));
      SLOT_NAMES.forEach((name, i) => step2.append(optBtn(name, (ev) => {
        partOK = i === c.slot; [...step2.children].forEach((b, j) => settleBtn(b, j === c.slot, b === ev.currentTarget));
        c.revealed = true; const g = verbOK && partOK ? 3 : verbOK || partOK ? 2 : 1;
        clear(tail2).append(verbPanel(entry, c.slot), continueBtn(g, g === 3 ? 'Continue' : 'Continue (I’ll see this again)'));
        tail2.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      })));
      frame(c, entry, [card, step1, step2], tail2); setKeys(null); return;
    }

    /* recall, multiple choice: verb + part name → form */
    if (mode === 'choice') {
      c.fmt = 'rcl';
      const card = h('div.qcard', h('div.qgreek', { lang: 'grc' }, entry.lemma), gloss, h('div.qask', SLOT_NAMES[c.slot] + '?'));
      const optsEl = h('div.opts'), tail2 = h('div'), choices = recallOptions(entry, c.slot);
      choices.forEach((f) => optsEl.append(optBtn(f, (ev) => {
        const ok = f === form; [...optsEl.children].forEach((b, i) => settleBtn(b, choices[i] === form, b === ev.currentTarget));
        c.revealed = true; clear(tail2).append(verbPanel(entry, c.slot), continueBtn(ok ? 3 : 1, ok ? 'Continue' : 'Continue (I’ll see this again)'));
        tail2.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      }, true)));
      const idk = h('button.btn.ghost.sm', { onclick: () => { [...optsEl.children].forEach((b, i) => settleBtn(b, choices[i] === form, false)); c.revealed = true; clear(tail2).append(verbPanel(entry, c.slot), continueBtn(1, 'Continue (I’ll see this again)')); idk.remove(); } }, 'I don’t know');
      frame(c, entry, [card, optsEl, h('div.row', idk)], tail2); setKeys(null); return;
    }

    /* recall, self-graded flashcard */
    c.fmt = 'flash';
    const card = h('div.qcard', h('div.qgreek', { lang: 'grc' }, entry.lemma), gloss, h('div.qask', SLOT_NAMES[c.slot] + '?'), h('div', { id: 'ans' }));
    const ctl = h('div');
    const showAns = () => {
      c.revealed = true;
      card.querySelector('#ans').append(h('div.qgreek.ans', { lang: 'grc' }, form));
      const pv = F.preview(K.cards.get(partsId(c.n, c.slot)) || F.newCard(partsId(c.n, c.slot)), Date.now(), setting('retention'));
      const buttons = practice ? [[1, 'Again'], [3, 'Got it']] : [[1, 'Again'], [2, 'Hard'], [3, 'Good'], [4, 'Easy']];
      clear(ctl).append(verbPanel(entry, c.slot), h('div.grades' + (practice ? '.two' : ''), buttons.map(([g, name]) => h('button.g' + g, { onclick: () => grade(c, g) }, name, practice ? null : h('small', fmtInterval(pv[g]))))));
      stop();
    };
    clear(ctl).append(h('button.btn.primary.block', { onclick: showAns }, 'Show answer'));
    frame(c, entry, [card], ctl);
    setKeys(() => { if (!c.revealed) { showAns(); return true; } return false; });
  }

  advance();
  return stop;
}

/* ---------- pages ---------- */
export function renderParts(view, params) {
  const [mode, ...rest] = params;
  if (mode === 'run') {
    let scope = null, queue, practice = false;
    if (rest[0] === 'passage') {
      const [, book, c1, v1, c2, v2] = rest; if (!D.bookByCode.has(book)) { location.hash = '#/parts'; return; }
      scope = { book, c1: +c1, v1: +v1 || 1, c2: +c2 || +c1, v2: +v2 || 999 }; queue = buildPartsSession({ scope });
    } else if (rest[0] === 'extra') {
      practice = true; scope = rest[2] === 'goal' && K.goal && K.goal.book ? K.goal : null; queue = buildPartsExtra(rest[1] === 'preview' ? 'preview' : 'trouble', scope);
    } else queue = buildPartsSession({});
    if (!queue.length) {
      if (!scope && !practice) { const alt = smart('parts'); if (alt.kind !== 'go') { location.replace(alt.href); return; } }
      clear(view).append(h('div.pagehead', h('h1', 'Principal parts')), h('div.card.stack',
        h('p', practice ? (rest[1] === 'preview' ? 'You’ve already started every part available right now.' : 'Study a few principal parts first; Reinforce will then pick out your shakiest.')
          : scope ? 'There are no principal parts to learn in ' + scopeLabel(scope) + '.' : 'You’re all caught up. 🎉'), h('a.btn', { href: '#/parts' }, 'Back')));
      return;
    }
    return runSession(view, queue, { scope, practice, restart: () => renderParts(view, params) });
  }
  landing(view);
}

function landing(view) {
  const goal = K.goal && K.goal.book ? K.goal : null;
  const modeSeg = h('div.seg', [['auto', 'Auto'], ['choice', 'Multiple choice'], ['flash', 'Flashcards']].map(([v, t]) => h('button', { 'aria-pressed': String(setting('partsMode') === v), onclick: async (e) => {
    await setSetting('partsMode', v); [...e.currentTarget.parentNode.children].forEach((b) => b.setAttribute('aria-pressed', String(b === e.currentTarget)));
  } }, t)));
  const newSel = h('select', { 'aria-label': 'New parts per day', onchange: async (e) => { await setSetting('partsNewPerDay', +e.target.value); landing(view); } },
    [5, 10, 15, 20, 30].map((n) => h('option', { value: n, selected: n === setting('partsNewPerDay') }, n)));
  clear(view).append(h('div.pagehead', h('h1', 'Principal parts')),
    h('div.stack',
      startButton(smart('parts')),
      h('div.row.wrap', h('a.btn.sm', { href: TOPICS.parts.preview + (goal ? '/goal' : '') }, 'Preview new parts'), chartsButton()),
      fold('Study a passage',
        goal ? h('div.row.between', h('div', h('b', 'Your goal: ' + scopeLabel(goal))), h('a.btn.primary.sm', { href: '#/parts/run/passage/' + [goal.book, goal.c1, goal.v1 || 1, goal.c2, goal.v2 || 999].join('/') }, 'Study')) : null,
        passagePicker(view, goal, {
          title: 'Parts for a passage', blurb: 'The principal parts of the verbs in the text you want to read, the most frequent first.', label: 'Practise these verbs',
          href: (sc) => '#/parts/run/passage/' + [sc.book, sc.c1, sc.v1, sc.c2, sc.v2].join('/'),
          info: (sc) => { let verbs = 0; for (const [v] of scopeCounts(sc)) if (eligible().has(v)) verbs++; return fmt(verbs) + ' verb' + (verbs === 1 ? '' : 's') + ' with principal parts in this passage'; },
        })),
      fold('Options',
        h('div.row.between.wrap', h('div', h('b', 'Style'), h('div.muted.small', 'Multiple choice checks you; flashcards ask you to remember, then rate yourself. Auto moves up when you’re reliable.')), modeSeg),
        h('div.row.between', h('span', 'New parts per day'), newSel))));
}
