// Principal parts: learn the six parts of each verb (present, future, aorist active, perfect active,
// perfect middle/passive, aorist passive). One FSRS card per printed part. Two question styles:
//   recognise — you're shown a part: pick the verb it belongs to, then which part it is
//   recall    — you're shown a verb and a part name: pick the form (multiple choice) or remember it (self-graded)
// "Auto" starts with multiple choice and moves to self-graded flashcards once you're reliable.
import { D, lexeme, scopeCounts, scopeLabel } from './data.js';
import { K, status, setting, setSetting, partsId, partsCardsDue, partsPace, partsVerbStarted, promotedVerbs, verbStage, noteVerbAnswer, rateParts, getPartsStats, savePartsStats, troubleCards } from './know.js';
import * as F from './fsrs.js';
import { todayKey, h, clear, shuffle, pct, icon, fmtInterval, toast, practiceBanner, fold, startButton, fmt, missedBlock, backLinks, backHead } from './util.js';
import { smart, TOPICS } from './smart.js';
import { passagePicker } from './learn.js';
import { partsGrid } from './partforms.js';
import { readHref } from './reader.js';
import { chartsButton, chartRowFor } from './charts.js';
const SMOOTH = matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth';   // no animated scrolling for people who ask for less motion

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

/** What a session would contain right now: parts due, then whole new verbs (every part of each) up to the daily allowance of verbs. */
export function planPartsSession({ scope = null, size = setting('sessionSize'), newLimit = null } = {}) {
  const prom = promotedVerbs(), verbs = poolVerbs(scope).sort((a, b) => (prom.has(b.n) - prom.has(a.n)) || b.w - a.w), inPool = new Set(verbs.map((v) => v.n));
  const due = partsCardsDue().map((c) => ({ c, ...parseCardId(c.id) })).filter((x) => eligible().has(x.n) && eligible().get(x.n).parts[x.slot] && (!scope || inPool.has(x.n)))
    .sort((a, b) => a.c.due - b.c.due);
  const unstarted = (n) => cardParts(eligible().get(n)).filter((slot) => { const c = K.cards.get(partsId(n, slot)); return !c || c.state === 'new'; });
  const limit = newLimit != null ? newLimit : scope ? size : partsPace().left;
  const fresh = [], seen = new Set();                    // fresh: one group per verb, [{ n, slot }] in teaching order
  let added = 0;
  for (const { n } of verbs) {                          // verbs already begun: finish them first; ones begun today are always finished, older ones use up the daily verb allowance
    if (!partsVerbStarted(n)) continue;
    const slots = unstarted(n); if (!slots.length) continue;
    const today = (K.partsVerbs[n] || {}).began === todayKey();
    if (!today) { if (added >= limit) continue; added++; }
    fresh.push({ n, started: true, items: slots.map((slot) => ({ n, slot })) }); seen.add(n);
  }
  for (const { n } of verbs) {
    if (added >= limit) break; if (seen.has(n) || partsVerbStarted(n)) continue;
    const slots = unstarted(n); if (!slots.length) continue;
    fresh.push({ n, started: false, items: slots.map((slot) => ({ n, slot })) }); added++;
  }
  return { due, fresh, limit, size };
}
export function buildPartsSession(opts) {
  const { due, fresh, size } = planPartsSession(opts);
  const dueItems = shuffle(due.slice(0, size).map((x) => ({ n: x.n, slot: x.slot, type: 'review' })));
  let room = Math.max(0, size - dueItems.length); const out = [...dueItems];
  for (const g of fresh) {
    if (room <= 0) break; const items = g.items.slice(0, room); room -= items.length;
    const block = items.map((x, i) => ({ ...x, type: 'new', meet: i === 0 && !g.started }));
    out.splice(Math.floor(Math.random() * (out.length + 1)), 0, ...block);
  }
  return out;
}
/** Extra practice: nothing here is ever scheduled. 'trouble' = your shakiest parts; 'preview' = a few parts you haven't started. */
export function buildPartsExtra(kind, scope = null) {
  if (kind === 'trouble') return shuffle(troubleCards('p:', 15).map((c) => ({ ...parseCardId(c.id), type: 'practice' })).filter((x) => eligible().get(x.n) && eligible().get(x.n).parts[x.slot]));
  return shuffle(planPartsSession({ scope, newLimit: 3 }).fresh.flatMap((g) => g.items).slice(0, 6).map((x) => ({ n: x.n, slot: x.slot, type: 'preview' })));
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

/* ---------- session ---------- */
let keyHandler = null;
const stop = () => { if (keyHandler) { document.removeEventListener('keydown', keyHandler); keyHandler = null; } };
const modeOf = (n) => (verbStage(n) === 'cold' ? 'flash' : 'choice');       // each verb decides for itself: multiple choice while learning, cold self-graded cards once known

async function recordResult(st, grade) {
  st.recent.push(grade >= 3 ? 1 : 0); if (st.recent.length > 40) st.recent.shift(); st.total = (st.total || 0) + 1;
  await savePartsStats(st);
}

function runSession(view, queue, { scope, restart, practice }) {
  const itemTotal = queue.length, total = new Set(queue.map((x) => x.n)).size, seenVerbs = new Set(), S = { missed: new Map(), shown: 0, items: 0, round: 0, rk: 0, R: 0, done: 0, good: 0, fresh: 0 };
  const added = [];
  let st = null, t0 = 0;

  const finish = () => {
    stop();
    clear(view).append(h('div.pagehead', h('h1', practice ? (S.previewOnly ? 'Look-ahead complete' : 'Practice complete') : 'Session complete')),
      h('div.card.stack',
        practice ? h('p.muted.small', 'Strengthening is practice only — your review schedule is unchanged.') : null,
        h('div.kpis', h('div.kpi', h('b', S.done), h('span', 'parts done')), h('div.kpi', h('b', S.done ? pct(S.good / S.done) : '—'), h('span', 'answered correctly')), practice ? null : h('div.kpi', h('b', S.fresh), h('span', 'new parts started'))),
        missedBlock([...S.missed.values()].map((m) => { const L = lexeme(m.n); return { greek: true, word: L.head, sub: SLOT_NAMES[m.slot] }; }),
          () => runSession(view, [...S.missed.values()].map((m) => ({ ...m, type: 'practice', retry: false })), { scope, restart, practice: true })),
        h('div.row.wrap', h('button.btn' + (S.missed.size ? '' : '.primary'), { onclick: restart }, practice ? 'Another round' : 'Practise more'),
          ...backLinks('#/parts', 'Back to Principal parts'), scope ? h('a.btn', { href: readHref(scope.book, scope.c1, scope.v1 > 1 ? scope.v1 : 0) }, icon('read', 18), 'Read ' + scopeLabel(scope)) : null)));
  };

  const retryQ = [];                                      // missed parts wait here and come back after the last one, in a retry round
  const advance = async () => {
    stop(); let c = queue.shift();
    if (!c && retryQ.length) { queue.push(...retryQ.splice(0)); S.round = 1; S.R = queue.length; S.rk = 0; c = queue.shift(); }
    if (!c) return finish();
    if (S.round) S.rk++; else { seenVerbs.add(c.n); S.shown = seenVerbs.size; S.items++; }
    st = await getPartsStats(); show(c);
  };

  async function grade(c, g) {
    const first = !c.retry;
    if (first) {
      if (!practice) { await rateParts(partsId(c.n, c.slot), g, Date.now() - t0, { m: c.fmt }); await recordResult(st, g);
        await noteVerbAnswer(c.n, c.slot, g >= 3, c.fmt === 'flash', cardParts(eligible().get(c.n))); if (c.type === 'new') S.fresh++; }
      S.done++; if (g >= 3) S.good++;
    }
    if (g < 3) S.missed.set(c.n + ':' + c.slot, c);
    if (g < 3) retryQ.push({ ...c, retry: true });
    advance();
  }

  function frame(c, entry, inner, ctl) {
    const tag = c.retry ? ['warn', 'Once more'] : c.type === 'new' ? ['accent', 'New'] : c.type === 'practice' ? ['', 'Strengthen'] : c.type === 'preview' ? ['accent', 'Look ahead'] : ['', 'Review'];
    S.previewOnly = c.type === 'preview';
    clear(view).append(h('div.qwrap',
      h('div.qtop', h('button.btn.ghost.icon.sm', { 'aria-label': 'End session', onclick: () => { if (confirm('End this session? Your answers so far are saved.')) finish(); } }, icon('close', 20)),
        h('div.bar.accent.grow', h('i', { style: { width: (100 * (S.round ? S.rk / S.R : S.items / itemTotal)) + '%' } })), h('span.qcount', { 'aria-label': S.round ? 'Retry ' + S.rk + ' of ' + S.R : 'Verb ' + S.shown + ' of ' + total }, S.round ? '↻ ' + S.rk + ' / ' + S.R : S.shown + ' / ' + total + (total === 1 ? ' verb' : ' verbs')), chartsButton(() => (c.revealed ? chartRowFor(c.slot, entry.parts[c.slot]) : null)), h('span.chip' + (tag[0] ? '.' + tag[0] : ''), tag[1])),
      practice || c.retry ? null : h('div.muted.small', { style: { margin: '-.2rem 0 .5rem' } }, verbStage(c.n) === 'cold' ? 'Cold question — you know this verb' : 'Learning this verb — multiple choice'),
      practice ? practiceBanner(c.type === 'preview') : null, inner, ctl || null));
  }

  /* the verb with all its parts, the tested one marked, and why it looks that way */
  function verbPanel(entry, slot) {
    const L = lexeme(entry.n);
    return h('div.fb.ok',
      h('div.row.between', h('b', { lang: 'grc' }, entry.lemma), h('span.small.muted', L.short || L.brief)),
      partsGrid(entry.n, entry, SLOT_NAMES, { hi: slot }));
  }

  /* the first time you meet a verb: all its parts together, before any question */
  function meetVerb(c, entry) {
    const L = lexeme(c.n), slots = cardParts(entry), btn = h('button.btn.primary.block', { onclick: () => { stop(); show(c); } }, 'Start learning this verb');
    clear(view).append(h('div.qwrap',
      h('div.qtop', h('button.btn.ghost.icon.sm', { 'aria-label': 'End session', onclick: () => { if (confirm('End this session? Your answers so far are saved.')) finish(); } }, icon('close', 20)), h('span.chip.accent', 'New verb')),
      h('div.qcard', h('div.qgreek', { lang: 'grc' }, entry.lemma), h('div.qmeta', (L.short || L.brief) + ' · G' + c.n),
        partsGrid(c.n, entry, SLOT_NAMES, { hideBlank: true, style: { textAlign: 'left', marginTop: '.7rem' } }),
        h('p.muted.small', { style: { margin: '.7rem 0 0' } }, 'This verb has ' + slots.length + ' principal part' + (slots.length === 1 ? '' : 's') + ' to learn. You’ll be asked each one, with choices to help.')), btn));
    setKeys(() => { btn.click(); return true; });
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
    const L = lexeme(c.n), form = entry.parts[c.slot], mode = modeOf(c.n);
    if (c.meet) { c.meet = false; return meetVerb(c, entry); }
    const gloss = h('div.qmeta', (L.short || L.brief) + ' · G' + c.n);
    const continueBtn = (g, label) => { const b = h('button.btn.primary.block', { onclick: () => grade(c, g) }, label || 'Continue'); setKeys(() => { b.click(); return true; }); return b; };

    /* recognise: form → verb → part */
    if (mode === 'choice' && (c.fmt || (c.fmt = c.type !== 'new' && !c.retry && Math.random() < 0.35 ? 'rec' : 'rcl')) === 'rec') {
      let verbOK = null, partOK = null;
      const card = h('div.qcard', h('div.qgreek', { lang: 'grc' }, form), h('div.qmeta', 'Which verb is this a principal part of?'));
      const step1 = h('div.opts', { style: { marginTop: '.8rem' } }), step2 = h('div.opts.two', { hidden: true }), tail2 = h('div');
      const opts = verbOptions(entry);
      opts.forEach((o) => step1.append(optBtn((o.lemma + ' — ' + ((lexeme(o.n).short) || lexeme(o.n).brief)), (ev) => {
        verbOK = o.n === entry.n; [...step1.children].forEach((b, i) => { settleBtn(b, opts[i].n === entry.n, b === ev.currentTarget); b.hidden = !(b === ev.currentTarget || opts[i].n === entry.n); });   // keep only the picked and the correct verb
        card.append(h('div.qmeta', { style: { marginTop: '.6rem' } }, 'Which part is it?')); step2.hidden = false; setKeys(null);
      })));
      SLOT_NAMES.forEach((name, i) => step2.append(optBtn(name, (ev) => {
        partOK = i === c.slot; [...step2.children].forEach((b, j) => settleBtn(b, j === c.slot, b === ev.currentTarget));
        c.revealed = true; const g = verbOK && partOK ? 3 : verbOK || partOK ? 2 : 1;
        clear(tail2).append(verbPanel(entry, c.slot), continueBtn(g, g === 3 ? 'Continue' : 'Continue (I’ll see this again)'));
        tail2.scrollIntoView({ block: 'nearest', behavior: SMOOTH });
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
        tail2.scrollIntoView({ block: 'nearest', behavior: SMOOTH });
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
        h('p', practice ? (rest[1] === 'preview' ? 'You’ve already started every part available right now.' : 'Nothing is shaky right now: you haven’t missed or struggled with any of the parts you’ve studied.')
          : scope ? 'There are no principal parts to learn in ' + scopeLabel(scope) + '.' : 'You’re all caught up. 🎉'), h('a.btn', { href: '#/parts' }, 'Back')));
      return;
    }
    return runSession(view, queue, { scope, practice, restart: () => renderParts(view, params) });
  }
  landing(view);
}

function landing(view) {
  const goal = K.goal && K.goal.book ? K.goal : null;
  const newSel = h('select', { 'aria-label': 'Most new verbs per day', onchange: async (e) => { await setSetting('partsVerbsPerDay', +e.target.value); landing(view); } },
    [1, 2, 3].map((n) => h('option', { value: n, selected: n === setting('partsVerbsPerDay') }, n)));
  const auto = setting('partsPace') !== 'fixed', pace = partsPace();
  const seg2 = (key, items, after) => h('div.seg', items.map(([v, t]) => h('button', { 'aria-pressed': String(String(setting(key)) === String(v)), onclick: async () => { await setSetting(key, v); landing(view); } }, t)));
  const paceNote = pace.paused ? h('div.card.small', h('b', 'New verbs are paused.'), ' Turn this off in Options when you want more.')
    : auto && pace.why ? h('div.card.small', h('b', pace.slow ? 'New verbs are slowed. ' : 'Pace: ' + pace.n + ' new verb' + (pace.n === 1 ? '' : 's') + ' a day. '), pace.why) : null;
  clear(view).append(backHead('Principal parts', '#/learn', 'Learn'),
    h('div.stack',
      startButton(smart('parts')), paceNote,
      h('div.row.wrap', h('a.btn.sm', { href: TOPICS.parts.preview + (goal ? '/goal' : '') }, 'Look ahead at new parts'), chartsButton()),
      fold('Study a passage',
        goal ? h('div.row.between', h('div', h('b', 'Your goal: ' + scopeLabel(goal))), h('a.btn.primary.sm', { href: '#/parts/run/passage/' + [goal.book, goal.c1, goal.v1 || 1, goal.c2, goal.v2 || 999].join('/') }, 'Study')) : null,
        passagePicker(view, goal, {
          title: 'Parts for a passage', blurb: 'The principal parts of the verbs in the text you want to read, the most frequent first.', label: 'Practise these verbs',
          href: (sc) => '#/parts/run/passage/' + [sc.book, sc.c1, sc.v1, sc.c2, sc.v2].join('/'),
          info: (sc) => { let verbs = 0; for (const [v] of scopeCounts(sc)) if (eligible().has(v)) verbs++; return fmt(verbs) + ' verb' + (verbs === 1 ? '' : 's') + ' with principal parts in this passage'; },
        })),
      fold('Options',
        h('div.stack', h('b', 'New verbs'), seg2('partsPace', [['auto', 'Automatic'], ['fixed', 'Fixed number']]),
          h('div.muted.small', auto ? 'Automatic pace looks at how many reviews are waiting and how you answered your last 40 parts. It slows down when reviews pile up or you’re below about 75% correct, and adds a verb when you’re above 90% with little waiting. It never stays at zero for more than a few days.' : 'Exactly this many new verbs every day.')),
        h('div.row.between', h('span', auto ? 'Most new verbs per day' : 'New verbs per day'), newSel),
        h('div.row.between', h('div', h('b', 'Pause new verbs'), h('div.muted.small', 'Review only, until you turn it off.')), seg2('partsPause', [[false, 'Off'], [true, 'On']]))),
      verbsFold()));
}

/** Where each verb you've started stands: still learning (with how many parts are secure) or known well enough for cold questions. */
function verbsFold() {
  const rows = [...eligible().values()].filter((e) => partsVerbStarted(e.n)).map((e) => {
    const slots = cardParts(e), v = K.partsVerbs[e.n] || {}, cold = verbStage(e.n) === 'cold';
    const secure = slots.filter((sl) => ((v.days || {})[sl] || []).length >= 2).length;
    return { e, cold, secure, total: slots.length, w: lexeme(e.n).freq };
  }).sort((a, b) => b.w - a.w);
  return fold('Your verbs (' + rows.length + ')', rows.length ? h('div.stack', rows.slice(0, 60).map((r) => h('div.row.between', h('span', h('b', { lang: 'grc' }, r.e.lemma), ' ', h('span.muted.small', lexeme(r.e.n).short || lexeme(r.e.n).brief)),
    h('span.chip' + (r.cold ? '' : '.accent'), r.cold ? 'Cold' : 'Learning · ' + r.secure + ' of ' + r.total + ' parts'))), rows.length > 60 ? h('div.muted.small', '…and ' + (rows.length - 60) + ' more.') : null,
    h('div.muted.small', 'A verb goes cold after every part is right in multiple choice on two different days. Two cold misses in a row send it back to multiple choice.')) : h('p.muted.small', 'Verbs you start will appear here.'));
}
