// Vocabulary study: scope picker + session runner (flashcard self-rating or multiple choice), FSRS-scheduled.
import { clockNow } from './clock.js';
import { D, lexeme, senseNs, unpack, scopeLabel, tokenForm, chapterVerses, tokenPunct, tokenFlag, periBook, periRange } from './data.js';
import { K, passageStudy, waitNote, status, setting, setSetting, rate, undoRate, getCard, buildSession, scopeReadiness, nextByLevel, goalNext, currentGoal, passageWords, readinessLabel, readinessClass, markLearning, troubleCards, reviewCards, wordsPace, recentWords } from './know.js';
import * as F from './fsrs.js';
import { partsGrid } from './partforms.js';
import { paceNote } from './pace.js';
import { verbBrake } from './know.js';
import { renderVerbsPage, renderVerbPage, verbsInProgress } from './verbs.js';
import { goalDetailCard } from './home.js';
import { missOutcome, snap, restore } from './retry.js';
import { h, clear, readInContext, shuffle, fmtInterval, soonText, pct, icon, practiceBanner, fold, startButton, toast, fmt, missedBlock, backLinks, backHead } from './util.js';
import { verbQuestion } from './gatesui.js';
import { smart, smartAll, TOPICS, topicNote, upcoming, nextLine, comingUp, tileNext, doneCards, newLimitNote, counts as sessionCounts } from './smart.js';
import { readHref } from './reader.js';
import { chartsButton } from './charts.js';
import { runDrill, renderChartsPage, renderParadigm, counts as chartCounts } from './chartdrill.js';
import { renderInfinitives, runInfDrill } from './infinitives.js';
import { renderMi } from './mi.js';
import { renderPick } from './chartpick.js';
import { renderImperative, renderImpParadigm, runImpDrill } from './imperatives.js';
import { renderSubjunctive, renderSubParadigm, runSubDrill } from './subjunctives.js';
import { renderParticiples, renderPtcParadigm, runPtcDrill } from './participles.js';

/** The long definition, only when it adds something to the short gloss: shown outright when short, otherwise behind a "More" tap. */
const FILLER = new Set(['a', 'an', 'the', 'of', 'to', 'in', 'and', 'or', 'for', 'is', 'as', 'i', 'definite', 'article', 'particle', 'pronoun', 'preposition', 'conjunction', 'adverb', 'indeclinable']);
const wordsOf = (t) => (t.toLowerCase().match(/[a-z']+/g) || []).filter((w) => !FILLER.has(w));
function longDef(L) {
  if (!L.full) return null;
  const have = new Set(wordsOf(L.brief));
  if (!wordsOf(L.full).some((w) => !have.has(w))) return null;                    // nothing new
  return L.full.length <= 100 ? h('div.qdef', L.full) : h('details.more', h('summary', 'More'), h('div.qdef', L.full));
}

/** A verb's principal parts as a small grid, shown with the answer (only when the verb has parts beyond the present). */
const PART_NAMES = ['Present', 'Future', 'Aorist active', 'Perfect active', 'Perfect mid/pas', 'Aorist passive'];
function partsBlock(L) {
  if (!L.verb) return null;
  const e = D.parts.get(L.n);
  if (!e || !e.parts.slice(1).some(Boolean)) return h('div.cardparts', h('div.small.muted', 'This verb doesn’t have principal parts.'));
  return h('div.cardparts', h('div.small.muted', 'Principal parts — tap one to see its forms'), partsGrid(L.n, e, PART_NAMES));
}

const POSNAME = { N: 'noun', V: 'verb', A: 'adjective', T: 'article', P: 'pronoun', R: 'pronoun', D: 'pronoun', X: 'pronoun', I: 'pronoun', F: 'pronoun', S: 'pronoun', C: 'pronoun', K: 'pronoun', Q: 'pronoun', ADV: 'adverb', CONJ: 'conjunction', PREP: 'preposition', PRT: 'particle', COND: 'conditional', INJ: 'interjection', HEB: 'Hebrew', ARAM: 'Aramaic' };

/* ---------- context sentence ---------- */
export function contextFor(n, scope) {
  const occ = D.occ.get(n) || []; if (!occ.length) return null;
  let cand = occ.map(unpack);
  if (scope) {
    const b = D.bookByCode.get(scope.book);
    const inS = cand.filter((o) => o.bi === b.i && (o.ch > scope.c1 || (o.ch === scope.c1 && o.vs >= (scope.v1 || 1))) && (o.ch < scope.c2 || (o.ch === scope.c2 && o.vs <= (scope.v2 || 999))));
    if (inS.length) cand = inS;
  }
  const sample = cand.slice(0, 40).map((o) => {
    const code = D.books[o.bi].code, v = chapterVerses(code, o.ch).find((x) => x[0] === o.vs);
    return { ...o, code, toks: v ? v[1] : [] };
  }).filter((o) => o.toks.length);
  if (!sample.length) return null;
  // prefer a compact verse (6–16 words) made mostly of words the learner already knows
  const score = (o) => { const len = o.toks.length; const known = [...senseNs(o.toks).ns].filter((s) => status(s) === 'known').length / len; return Math.abs(len - 11) * 0.12 - known * 2; };
  sample.sort((a, b) => score(a) - score(b));
  const best = sample[0];
  const el = h('div.qctx', { lang: 'grc' }, h('span.ref', D.bookByCode.get(best.code).name + ' ' + best.ch + ':' + best.vs));
  const ens = senseNs(best.toks).ns;
  best.toks.forEach((t, k) => {
    const f = tokenForm(t), w = f.w, hit = ens[k] === n;
    el.append(hit ? h('mark', w) : w, tokenPunct(t) + (tokenFlag(t) ? '\u2014' : ' '));
  });
  el.append(readInContext(readHref(best.code, best.ch, best.vs)));
  return el;
}

/* ---------- multiple-choice distractors ---------- */
function distractors(L, k = 3) {
  const pool = D.lex.filter((x) => x.n !== L.n && x.pos === L.pos && Math.abs(x.rank - L.rank) < 250 && x.brief !== L.brief);
  const wide = pool.length >= k ? pool : D.lex.filter((x) => x.n !== L.n && x.brief !== L.brief && Math.abs(x.rank - L.rank) < 600);
  const out = [], seen = new Set([L.brief.toLowerCase()]);
  for (const x of shuffle(wide.slice())) { const g = x.brief.toLowerCase(); if (!seen.has(g)) { seen.add(g); out.push(x); if (out.length === k) break; } }
  return out;
}

/* ---------- session runner ---------- */
function runSession(view, items, { title, scope, back, practice = false }) {
  const queue = items.map((i) => ({ ...i }));
  const total = queue.length;
  const missed = new Set();
  const stats = { shown: 0, round: 0, rk: 0, R: 0, done: 0, good: 0, again: 0, fresh: 0, probes: 0, probeMiss: 0 };
  let current = null, t0 = 0;
  /* keyboard: Space/Enter shows the answer or continues, 1–4 choose or rate. Skipped when a button has focus or a dialog is open. */
  const sid = Math.random().toString(36).slice(2); view.dataset.sess = sid;
  let keyAct = null;
  const onKey = (e) => {
    if (view.dataset.sess !== sid) { document.removeEventListener('keydown', onKey); return; }
    if (e.ctrlKey || e.metaKey || e.altKey || document.querySelector('dialog[open]') || /INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return;
    if ((e.key === 'u' || e.key === 'U') && undoState) { e.preventDefault(); undo(); return; }
    const go = e.key === ' ' || e.key === 'Enter';
    if (go && e.target.closest && e.target.closest('button,a')) return;            // let the focused button do its own thing
    if (keyAct && keyAct(e, go)) e.preventDefault();
  };
  document.addEventListener('keydown', onKey);
  const kbHint = (t) => h('div.kbhint.muted.small', t);

  const finish = () => {
    const previewed = items.filter((i) => i.type === 'preview').map((i) => i.n);
    const addBtn = previewed.length ? h('button.btn.primary', { onclick: async (e) => { e.currentTarget.disabled = true; for (const n of previewed) if (!getCard(n)) await markLearning(n); e.currentTarget.textContent = '✓ Added to your review pile'; } }, 'Add these ' + previewed.length + ' words to my review pile') : null;
    clear(view).append(
      h('div.pagehead', h('h1', previewed.length ? 'Look-ahead complete' : practice ? 'Practice complete' : 'Session complete')),
      h('div.card.stack', practice ? h('p.muted.small', 'Strengthening is practice only — your review schedule is unchanged.') : null, h('div.kpis',
        h('div.kpi', h('b', stats.done), h('span', 'cards done')),
        h('div.kpi', h('b', stats.done ? pct(stats.good / (stats.good + stats.again || 1)) : '—'), h('span', 'answered correctly')),
        practice ? null : h('div.kpi', h('b', stats.fresh), h('span', 'new words started')),
        stats.probes ? h('div.kpi', h('b', stats.probes - stats.probeMiss + '/' + stats.probes), h('span', 'check-ins held')) : null),
        stats.probeMiss ? h('p.muted', stats.probeMiss + ' word' + (stats.probeMiss > 1 ? 's' : '') + ' you’d assumed you knew slipped; they’re back in your review pile.') : null,
        !practice && items.some((i) => { const L = lexeme(i.n); return L && L.verb; }) ? verbQuestion() : null,
        missedBlock([...missed].map((m) => { const L = lexeme(m.n); return { greek: true, word: L.head, sub: L.brief }; }),
          () => runSession(view, [...missed].map((m) => ({ ...m, type: 'practice', seen: false, retry: false })), { title, scope, back, practice: true })),
        h('div.row.wrap', addBtn, scope ? h('a.btn.primary', { href: readHref(scope.book, scope.c1, scope.v1 > 1 ? scope.v1 : 0) }, icon('read', 18), 'Read ' + scopeLabel(scope)) : null,
          ...backLinks('#/home', 'Back to Home', !scope), h('a.btn', { href: '#/progress' }, 'Progress'))));
  };

  const retryQ = [];                                      // missed cards wait here and come back after the last card, in a retry round
  const advance = () => {
    current = queue.shift();
    if (!current && retryQ.length) { queue.push(...retryQ.splice(0)); stats.round = 1; stats.R = queue.length; stats.rk = 0; current = queue.shift(); }
    if (!current) return finish();
    if (stats.round) stats.rk++; else stats.shown++;
    show(current);
  };
  const requeue = (item) => retryQ.push(item);

  let undoState = null;                                   // the one answer that can be taken back
  async function undo() {
    const u = undoState; if (!u) return; undoState = null;
    if (u.rated) await undoRate();
    Object.assign(stats, u.stats); u.item.seen = u.wasSeen; restore(u.item, u.rescue);
    const at = retryQ.indexOf(u.item); if (at >= 0) retryQ.splice(at, 1);
    const aq = queue.indexOf(u.item); if (aq >= 0) queue.splice(aq, 1);          // a missed card that was queued to come back
    if (current) queue.unshift(current);
    current = u.item; show(current); toast('Last answer undone');
  }
  async function grade(item, g) {
    undoState = { item, wasSeen: !!item.seen, stats: { ...stats }, rated: !practice, rescue: snap(item) };
    if (!practice) await rate(item.n, g, item.type, clockNow() - t0);
    if (!item.seen) {                       // first time this card is answered in the session
      item.seen = true;
      if (item.type === 'new') stats.fresh++;
      if (item.type === 'probe') { stats.probes++; if (g < 3) stats.probeMiss++; }
    }
    const out = missOutcome(item, g === 1);                 // only Again is a miss; Hard is not retried
    if (g >= 2 && out !== 'stop') { stats.good++; stats.done++; }
    else { stats.again++; missed.add(item); if (out === 'retry' || out === 'rescue') requeue(item); }
    advance();
  }

  function frame(item, inner) {
    const label = item.type === 'new' ? ['accent', 'New'] : item.type === 'probe' ? ['gold', 'Check-in'] : item.type === 'recent' ? ['', 'Refresher'] : item.type === 'practice' ? ['', 'Strengthen'] : item.type === 'preview' ? ['accent', 'Look ahead'] : ['', 'Review'];
        clear(view).append(h('div.qwrap',
      h('div.qtop', h('button.btn.ghost.icon.sm', { 'aria-label': 'End session', onclick: () => { if (confirm('End this session? Your answers so far are saved.')) finish(); } }, icon('close', 20)),
        h('div.bar.accent.grow', h('i', { style: { width: (100 * (stats.round ? stats.rk / stats.R : stats.shown / total)) + '%' } })), h('span.qcount', { 'aria-label': stats.round ? 'Retry ' + stats.rk + ' of ' + stats.R : 'Item ' + stats.shown + ' of ' + total }, stats.round ? '↻ ' + stats.rk + ' / ' + stats.R : stats.shown + ' / ' + total), chartsButton(),
        h('span.chip' + (item.rescue ? '.gold' : label[0] ? '.' + label[0] : ''), item.rescue ? 'One more try' : label[1])),
      item.rescue ? h('div.rescue-note', 'You’ve missed this twice. Pick the meaning.') : null,
      practice ? practiceBanner(item.type === 'preview', item.type === 'recent') : null, inner,
      undoState ? h('div.undorow', h('button.btn.ghost.sm', { onclick: undo }, '↩ Undo last answer')) : null));
  }

  function show(item) {
    t0 = clockNow();
    const L = lexeme(item.n), flash = setting('mode') !== 'choice' && !item.rescue;
    const pos = POSNAME[L.pos] || L.pos;
    const head = [h('div.qgreek', { lang: 'grc' }, L.head), h('div.qmeta', pos + ' · G' + (L.base || L.n) + ' · ' + fmt(L.freq) + '×')];
    const reveal = (extra) => {
      const card = getCard(item.n) || F.newCard('w:' + item.n);
      const pv = F.preview(card, clockNow(), setting('retention'));
      const answer = [h('div.qgloss', L.brief), longDef(L), partsBlock(L), contextFor(L.n, scope)];
      const grades = h('div.grades' + (practice ? '.two' : ''),
        (practice ? [[1, 'Again'], [3, 'Got it']] : [[1, 'Again'], [2, 'Hard'], [3, 'Good'], [4, 'Easy']]).map(([g, name]) => h('button.g' + g, { onclick: () => grade(item, g) }, name, practice ? null : h('small', fmtInterval(pv[g])))));
      return { answer, grades };
    };
    if (flash) {
      const card = h('div.qcard', ...head, h('div', { id: 'ans' }));
      const showBtn = h('button.btn.primary.block', { onclick: () => {
        const r = reveal(); card.querySelector('#ans').append(...r.answer.filter(Boolean)); clear(ctl).append(r.grades);
        keyAct = (e, go) => { const bs = [...ctl.querySelectorAll('.grades button')], k = +e.key; if (k >= 1 && k <= bs.length) { bs[k - 1].click(); return true; } if (go) { bs[practice ? 1 : 2].click(); return true; } return false; };
      } }, 'Show answer');
      const ctl = h('div', showBtn);
      keyAct = (e, go) => { if (go) { showBtn.click(); return true; } return false; };
      frame(item, [card, ctl, kbHint(practice ? 'Space shows the answer · 1 Again · 2 Got it' : 'Space shows the answer · 1 Again · 2 Hard · 3 Good · 4 Easy')]);
    } else {
      const opts = shuffle([L, ...distractors(L)]);
      const card = h('div.qcard', ...head, h('div.opts', { id: 'opts', style: { marginTop: '.8rem' } }));
      const ctl = h('div');
      const optsEl = card.querySelector('#opts');
      const settle = (pickedN) => {
        optsEl.querySelectorAll('button').forEach((b) => { b.disabled = true; const right = +b.dataset.n === L.n; b.classList.toggle('right', right); if (+b.dataset.n === pickedN && !right) b.classList.add('wrong'); const m = b.querySelector('.mark'); m.textContent = right ? '✓' : (+b.dataset.n === pickedN ? '✗' : ''); });
        const ok = pickedN === L.n;
        const r = reveal(); card.append(...r.answer.filter(Boolean));
        const g = item.rescue ? (ok ? 2 : 1) : ok ? (item.type === 'probe' && !item.seen ? 4 : 3) : 1;      // a rescue answered right counts as Hard: it was only recognized with help
        const next = h('button.btn.primary.block', { onclick: () => grade(item, g) }, ok || item.rescue ? 'Continue' : 'Continue (I’ll see this again)');
        if (item.rescue) card.append(h('div.rescue-note', 'That’s enough for now.' + (practice ? '' : ' You’ll see this word again ' + soonText(F.preview(getCard(item.n) || F.newCard('w:' + item.n), clockNow(), setting('retention'))[g]) + '.')));
        clear(ctl).append(next);
        keyAct = (e, go) => { if (go) { next.click(); return true; } return false; };
      };
      opts.forEach((o) => optsEl.append(h('button.opt', { dataset: { n: o.n }, onclick: () => settle(o.n) }, h('span', o.brief), h('span.mark', ''))));
      keyAct = (e) => { const b = [...optsEl.querySelectorAll('button:not([disabled])')][+e.key - 1]; if (b && +e.key >= 1) { b.click(); return true; } return false; };
      frame(item, [card, h('div.row.between', h('button.btn.ghost.sm', { onclick: () => settle(-1) }, 'I don’t know'), h('span')), ctl, kbHint('Press 1–4 to choose · Space continues')]);
    }
  }
  advance();
}

/* ---------- Learn tab ---------- */
function startFrom(view, kind, scope, title, only = null) {
  const items = buildSession({ scope, only, kind });
  if (!items.length) {
    if (!scope) { const alt = smart('words'); if (alt.kind !== 'go') { location.replace(alt.href); return; } }       // caught up: go to something useful instead
    clear(view).append(h('div.pagehead', h('h1', title || 'Study')), h('div.card.stack', h('p', scope ? (passageStudy(scope).held + passageStudy(scope).started ? waitNote(passageStudy(scope)) : 'You already know every word in ' + scopeLabel(scope) + ', and nothing is due. 🎉') : 'You’re all caught up. 🎉'),
      h('div.row.wrap', scope ? h('a.btn.primary', { href: readHref(scope.book, scope.c1) }, 'Read it') : null, h('a.btn', { href: '#/home' }, 'Back'))));
    return;
  }
  runSession(view, items, { title, scope });
}

/** A few words you haven't started: from your goal passage if you have one, else the most common you don't know yet. */
function previewWords(goal) {
  const fromGoal = goalNext(currentGoal(), 6).map((x) => x.n);
  return fromGoal.length ? fromGoal : nextByLevel(6).map((x) => x.n);
}

export function renderLearn(view, params) {
  const [mode, ...rest] = params;
  if (mode === 'words') return void wordsPage(view);
  if (mode === 'verbs') return void renderVerbsPage(view);
  if (mode === 'charts') return void (rest[0] === 'pick' ? renderPick(view) : rest[0] === 'mi' ? renderMi(view) : rest[0] === 'imperative' ? (rest[1] === 'run' ? runImpDrill(view, rest[2] || null) : rest[1] ? renderImpParadigm(view, rest[1]) : renderImperative(view)) : rest[0] === 'subjunctive' ? (rest[1] === 'run' ? runSubDrill(view, rest[2] || null) : rest[1] ? renderSubParadigm(view, rest[1]) : renderSubjunctive(view)) : rest[0] === 'infinitives' ? (rest[1] === 'run' ? runInfDrill(view) : renderInfinitives(view)) : rest[0] === 'participles' ? (rest[1] === 'run' ? runPtcDrill(view, rest[2] || null) : renderParticiples(view)) : rest[0] === 'participle' ? renderPtcParadigm(view, rest[1]) : rest[0] === 'run' ? runDrill(view, rest[1] || null) : rest[0] === 'paradigm' ? renderParadigm(view, rest[1]) : renderChartsPage(view));
  if (mode === 'verb') return void renderVerbPage(view, rest[0]);
  if (mode === 'daily') return void startFrom(view, 'daily', null, 'Today’s session');
  if (mode === 'review') return void startFrom(view, 'review', null, 'Review');
  if (mode === 'set') { const [lo, hi] = rest.map(Number); return void startFrom(view, 'daily', null, bandLabel([lo, hi]), new Set(D.lex.filter((L) => L.freq >= lo && L.freq <= hi).map((L) => L.n))); }
  if (mode === 'practice') {                                   // extra practice: never touches the schedule
    const preview = rest[0] === 'preview';
    const goal = K.goal && K.goal.book ? K.goal : null;
    if (rest[0] === 'review') {
      const cs = reviewCards('w:', 15);
      if (!cs.length) { clear(view).append(backHead('Review', '#/learn/words', 'Vocabulary'), h('div.card.stack', h('p', 'You haven’t studied any words yet.'), ...backLinks('#/learn/words', 'Back to Vocabulary'))); return; }
      return void runSession(view, shuffle(cs.map((c) => ({ n: +c.id.slice(2), type: 'recent' }))), { title: 'Review what you’ve learned', practice: true });
    }
    if (rest[0] === 'recent') {
      const ns = recentWords().slice(0, 30);
      if (!ns.length) { clear(view).append(backHead('Review what I just learned', '#/learn/words', 'Vocabulary'), h('div.card.stack', h('p', 'You haven’t started any words in the last few days.'), ...backLinks('#/learn/words', 'Back to Vocabulary'))); return; }
      return void runSession(view, shuffle(ns.map((n) => ({ n, type: 'recent' }))), { title: 'Review what I just learned', practice: true });
    }
    const items = shuffle(preview ? previewWords(goal).map((n) => ({ n, type: 'preview' })) : troubleCards('w:', 15).map((c) => ({ n: +c.id.slice(2), type: 'practice' })));      // shuffled: the worst card shouldn't always come first
    if (!items.length) { clear(view).append(h('div.pagehead', h('h1', preview ? 'Look ahead at new words' : 'Strengthen weak spots')), h('div.card.stack', h('p', preview ? 'No new words to preview right now.' : 'Nothing is shaky right now: you haven’t missed or struggled with any of the words you’ve studied.'), h('a.btn', { href: '#/home' }, 'Back'))); return; }
    return void runSession(view, items, { title: 'Strengthen weak spots', practice: true });
  }
  if (mode === 'level') {
    const items = (goalNext(currentGoal(), setting('newPerDay')).length ? goalNext(currentGoal(), setting('newPerDay')) : nextByLevel(setting('newPerDay'))).map((x) => ({ n: x.n, type: 'new' }));
    return void (items.length ? runSession(view, items, { title: 'New words' }) : startFrom(view, 'review', null));
  }
  if (mode === 'passage') {
    const [book, c1, v1, c2, v2] = rest; const scope = { book, c1: +c1, v1: +v1 || 1, c2: +c2 || +c1, v2: +v2 || 999 };
    if (!D.bookByCode.has(book)) return void (location.hash = '#/home');
    return void startFrom(view, 'passage', scope, scopeLabel(scope));
  }
  location.replace('#/home');                                   // the Learn hub is gone: Home opens the areas
}

/* ---------- Vocabulary page ---------- */
/* ---------- study words by how common they are ---------- */
const bandLabel = ([lo, hi]) => hi >= 1e9 ? 'Words used ' + lo.toLocaleString('en-US') + '+ times' : lo === hi ? 'Words used once' : 'Words used ' + lo + '–' + hi + ' times';
/** Shown on the Vocabulary page when the verb brake is on. */
function verbHold() {
  const b = verbBrake(); if (!b.braked) return null;
  return h('div.card.small', h('b', b.why), ' Other words keep coming.', h('div', { style: { marginTop: '.3rem' } }, h('a', { href: '#/learn/verbs' }, 'See your verbs →')));
}

/** One plain sentence on what a check-in is, shown only when today's session has some. */
const checkinNote = () => (smart('words').kind === 'go' && sessionCounts().words.checkins ? h('div.small.muted', 'Check-ins are quick spot-checks of words you said you already know.') : null);

function wordsPage(view) {
  const sm = smart('words');
  clear(view).append(
    backHead('Vocabulary', '#/home', 'Home'),
    h('div.stack',
      ...(doneCards('words') || [startButton(sm)]),
      checkinNote(),
      newLimitNote('words') ? h('div.small.muted', newLimitNote('words')) : null,
      paceNote(wordsPace(), 'words'),
      verbHold(),
      goalDetailCard(() => wordsPage(view)),
      h('div.sec', 'More practice'),
      sm.kind === 'review' ? null : h('a.tile', { href: TOPICS.words.review }, h('h3', 'Review what I’ve learned'), h('p', 'Go back over words you already know')),
      h('a.tile', { href: TOPICS.words.preview }, h('h3', 'Look ahead at new words'), h('p', 'A preview of what is coming')),
      h('a.tile', { href: TOPICS.words.reinforce }, h('h3', 'Strengthen weak spots'), h('p', 'Words you have missed or find hard'))));
}
