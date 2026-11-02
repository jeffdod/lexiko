// Vocabulary study: scope picker + session runner (flashcard self-rating or multiple choice), FSRS-scheduled.
import { D, lexeme, senseNs, unpack, scopeLabel, tokenForm, chapterVerses, tokenPunct, tokenFlag, periBook, periRange } from './data.js';
import { K, status, setting, setSetting, rate, undoRate, getCard, buildSession, scopeReadiness, nextByLevel, passageWords, readinessLabel, readinessClass, markLearning, troubleCards } from './know.js';
import * as F from './fsrs.js';
import { h, clear, shuffle, fmtInterval, pct, icon, practiceBanner, fold, startButton, toast, fmt, missedBlock } from './util.js';
import { smart, smartAll, TOPICS, topicNote } from './smart.js';
import { readHref } from './reader.js';
import { chartsButton } from './charts.js';

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
  const e = L.pos === 'V' ? D.parts.get(L.n) : null;
  if (!e || !e.parts.slice(1).some(Boolean)) return null;
  return h('div.cardparts', h('div.small.muted', 'Principal parts'),
    h('div.partsgrid', PART_NAMES.map((name, i) => h('div.pp' + (e.parts[i] ? '' : '.none'), h('small', name), h('span', { lang: 'grc' }, e.parts[i] || '—')))));
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
  el.append(h('a.small', { href: readHref(best.code, best.ch, best.vs), style: { display: 'block', fontFamily: 'var(--ui)', marginTop: '.3rem' } }, 'Read in context →'));
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
        missedBlock([...missed].map((m) => { const L = lexeme(m.n); return { greek: true, word: L.head, sub: L.brief }; }),
          () => runSession(view, [...missed].map((m) => ({ ...m, type: 'practice', seen: false, retry: false })), { title, scope, back, practice: true })),
        h('div.row.wrap', addBtn, scope ? h('a.btn.primary', { href: readHref(scope.book, scope.c1, scope.v1 > 1 ? scope.v1 : 0) }, icon('read', 18), 'Read ' + scopeLabel(scope)) : null,
          h('a.btn' + (scope ? '' : '.primary'), { href: '#/learn' }, 'Back to Learn'), h('a.btn', { href: '#/progress' }, 'Progress'))));
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
    Object.assign(stats, u.stats); u.item.seen = u.wasSeen;
    const at = retryQ.indexOf(u.item); if (at >= 0) retryQ.splice(at, 1);
    const aq = queue.indexOf(u.item); if (aq >= 0) queue.splice(aq, 1);          // a missed card that was queued to come back
    if (current) queue.unshift(current);
    current = u.item; show(current); toast('Last answer undone');
  }
  async function grade(item, g) {
    undoState = { item, wasSeen: !!item.seen, stats: { ...stats }, rated: !practice };
    if (!practice) await rate(item.n, g, item.type, Date.now() - t0);
    if (!item.seen) {                       // first time this card is answered in the session
      item.seen = true;
      if (item.type === 'new') stats.fresh++;
      if (item.type === 'probe') { stats.probes++; if (g < 3) stats.probeMiss++; }
    }
    if (g >= 3) { stats.good++; stats.done++; }
    else { stats.again++; missed.add(item); requeue(item); }
    advance();
  }

  function frame(item, inner) {
    const label = item.type === 'new' ? ['accent', 'New'] : item.type === 'probe' ? ['gold', 'Check-in'] : item.type === 'practice' ? ['', 'Strengthen'] : item.type === 'preview' ? ['accent', 'Look ahead'] : ['', 'Review'];
        clear(view).append(h('div.qwrap',
      h('div.qtop', h('button.btn.ghost.icon.sm', { 'aria-label': 'End session', onclick: () => { if (confirm('End this session? Your answers so far are saved.')) finish(); } }, icon('close', 20)),
        h('div.bar.accent.grow', h('i', { style: { width: (100 * (stats.round ? (stats.rk - 1) / stats.R : (stats.shown - 1) / total)) + '%' } })), h('span.qcount', { 'aria-label': stats.round ? 'Retry ' + stats.rk + ' of ' + stats.R : 'Item ' + stats.shown + ' of ' + total }, stats.round ? '↻ ' + stats.rk + ' / ' + stats.R : stats.shown + ' / ' + total), chartsButton(),
        h('span.chip' + (label[0] ? '.' + label[0] : ''), label[1])),
      practice ? practiceBanner(item.type === 'preview') : null, inner,
      undoState ? h('div.undorow', h('button.btn.ghost.sm', { onclick: undo }, '↩ Undo last answer')) : null));
  }

  function show(item) {
    t0 = Date.now();
    const L = lexeme(item.n), flash = setting('mode') !== 'choice';
    const pos = POSNAME[L.pos] || L.pos;
    const head = [h('div.qgreek', { lang: 'grc' }, L.head), h('div.qmeta', pos + ' · G' + (L.base || L.n) + ' · ' + fmt(L.freq) + '×')];
    const reveal = (extra) => {
      const card = getCard(item.n) || F.newCard('w:' + item.n);
      const pv = F.preview(card, Date.now(), setting('retention'));
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
        const g = ok ? (item.type === 'probe' && !item.seen ? 4 : 3) : 1;
        const next = h('button.btn.primary.block', { onclick: () => grade(item, g) }, ok ? 'Continue' : 'Continue (I’ll see this again)');
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
    clear(view).append(h('div.pagehead', h('h1', title || 'Study')), h('div.card.stack', h('p', scope ? 'You already know every word in ' + scopeLabel(scope) + ', and nothing is due. 🎉' : 'You’re all caught up. 🎉'),
      h('div.row.wrap', scope ? h('a.btn.primary', { href: readHref(scope.book, scope.c1) }, 'Read it') : null, h('a.btn', { href: '#/learn' }, 'Back'))));
    return;
  }
  runSession(view, items, { title, scope });
}

export function passagePicker(view, initial, o = {}) {
  const sc = { book: 'JHN', c1: 1, v1: 1, c2: 1, v2: 999, ...(initial || {}) };
  const bookSel = h('select', { 'aria-label': 'Book' }, D.books.map((b) => h('option', { value: b.code, selected: b.code === sc.book }, b.name)));
  const c1 = h('select', { 'aria-label': 'From chapter' }), c2 = h('select', { 'aria-label': 'To chapter' });
  const v1 = h('input', { type: 'number', min: 1, placeholder: 'start', 'aria-label': 'From verse', style: { width: '5.5rem' } });
  const v2 = h('input', { type: 'number', min: 1, placeholder: 'end', 'aria-label': 'To verse', style: { width: '5.5rem' } });
  const sec = h('select', { 'aria-label': 'Section' });
  const info = h('div.muted.small'), go = h('a.btn.primary', o.label || 'Study these words');
  const also = (o.also || []).map((a) => ({ a, el: h('a.btn', a.label) }));            // extra one-click buttons beside the main one, e.g. “Verbs only”
  let applying = false;
  const fillSecs = () => { clear(sec).append(h('option', { value: '' }, 'Custom range…'), ...periBook(bookSel.value).map((p) => h('option', { value: p.id }, periRange(p) + ' · ' + p.title))); };
  const fillChs = () => {
    const b = D.bookByCode.get(bookSel.value);
    [c1, c2].forEach((s, i) => { clear(s).append(...b.chapters.map(([c]) => h('option', { value: c, selected: c === (i ? sc.c2 : sc.c1) }, c))); });
  };
  const read = () => {
    sc.book = bookSel.value; sc.c1 = +c1.value || 1; sc.c2 = Math.max(sc.c1, +c2.value || sc.c1);
    sc.v1 = +v1.value || 1; sc.v2 = +v2.value || 999;
    if (sc.c1 !== sc.c2 || sc.v2 < sc.v1) { if (sc.c1 === sc.c2 && sc.v2 < sc.v1) sc.v2 = 999; }
    const rd = scopeReadiness(sc), words = passageWords(sc);
    also.forEach(({ a, el }) => { el.href = a.href(sc); });
    if (o.info) { clear(info).append(o.info(sc)); go.href = o.href(sc); return; }
    clear(info).append(h('span.rdy.' + readinessClass(rd.known), pct(rd.known) + ' known · ' + readinessLabel(rd.known)), ' ', words.length + ' word' + (words.length === 1 ? '' : 's') + ' to learn · ' + fmt(rd.tokens) + ' words of text');
    go.href = o.href ? o.href(sc) : '#/learn/passage/' + [sc.book, sc.c1, sc.v1, sc.c2, sc.v2].join('/');
    go.classList.toggle('disabled', !words.length); go.toggleAttribute('disabled', !words.length);
  };
  bookSel.addEventListener('change', () => { sc.c1 = sc.c2 = 1; v1.value = v2.value = ''; fillChs(); fillSecs(); read(); });
  sec.addEventListener('change', () => {
    const p = D.periList.find((x) => x.id === sec.value); if (!p) return;
    applying = true; sc.c1 = p.c1; sc.c2 = p.c2; fillChs(); v1.value = p.v1; v2.value = p.v2; read(); applying = false; sec.value = p.id;
  });
  [c1, c2, v1, v2].forEach((e) => e.addEventListener('input', () => { if (!applying) sec.value = ''; }));
  c1.addEventListener('change', () => { if (+c2.value < +c1.value) c2.value = c1.value; read(); });
  [c2, v1, v2].forEach((e) => e.addEventListener('input', read)); [c2, v1, v2].forEach((e) => e.addEventListener('change', read));
  fillChs(); fillSecs(); if (sc.v1 > 1) v1.value = sc.v1; if (sc.v2 < 999) v2.value = sc.v2; read();
  return h('div.card.stack', h('h2', o.title || 'Prepare a passage'), h('p.muted.small', o.blurb || 'Pick the text you want to read. lexiko teaches the words in it that you don’t know yet, most useful first.'),
    h('div.row.wrap', h('label.field', 'Book', bookSel)), h('label.field', 'Section', sec),
    h('div.row.wrap', h('label.field', 'From chapter', c1), h('label.field', 'verse (optional)', v1)),
    h('div.row.wrap', h('label.field', 'To chapter', c2), h('label.field', 'verse (optional)', v2)), info, h('div.row.wrap', go, ...also.map((x) => x.el)));
}

/** A few words you haven't started: from your goal passage if you have one, else the most common you don't know yet. */
function previewWords(goal) {
  const fromGoal = goal ? passageWords(goal).filter((x) => status(x.n) === 'unknown').slice(0, 6).map((x) => x.n) : [];
  return fromGoal.length ? fromGoal : nextByLevel(6).map((x) => x.n);
}

export function renderLearn(view, params) {
  const [mode, ...rest] = params;
  if (mode === 'words') return void wordsPage(view);
  if (mode === 'daily') return void startFrom(view, 'daily', null, 'Today’s session');
  if (mode === 'review') return void startFrom(view, 'review', null, 'Review');
  if (mode === 'set') { const [lo, hi] = rest.map(Number); return void startFrom(view, 'daily', null, bandLabel([lo, hi]), new Set(D.lex.filter((L) => L.freq >= lo && L.freq <= hi).map((L) => L.n))); }
  if (mode === 'practice') {                                   // extra practice: never touches the schedule
    const preview = rest[0] === 'preview';
    const goal = K.goal && K.goal.book ? K.goal : null;
    const items = preview ? previewWords(goal).map((n) => ({ n, type: 'preview' })) : troubleCards('w:', 15).map((c) => ({ n: +c.id.slice(2), type: 'practice' }));
    if (!items.length) { clear(view).append(h('div.pagehead', h('h1', preview ? 'Look ahead at new words' : 'Strengthen weak spots')), h('div.card.stack', h('p', preview ? 'No new words to preview right now.' : 'You haven’t studied any words yet, so there are no trouble spots to practise.'), h('a.btn', { href: '#/learn' }, 'Back'))); return; }
    return void runSession(view, items, { title: 'Strengthen weak spots', practice: true });
  }
  if (mode === 'level') {
    const items = nextByLevel(setting('newPerDay')).map((x) => ({ n: x.n, type: 'new' }));
    return void (items.length ? runSession(view, items, { title: 'New words' }) : startFrom(view, 'review', null));
  }
  if (mode === 'passage') {
    const [book, c1, v1, c2, v2] = rest; const scope = { book, c1: +c1, v1: +v1 || 1, c2: +c2 || +c1, v2: +v2 || 999 };
    if (!D.bookByCode.has(book)) return void (location.hash = '#/learn');
    return void startFrom(view, 'passage', scope, scopeLabel(scope));
  }
  const next = smartAll();
  clear(view).append(
    h('div.pagehead', h('h1', 'Learn')),
    h('div.stack',
      startButton(next),
      h('div.topics', ['words', 'parse', 'parts'].map((k) => h('a.tile', { href: TOPICS[k].page }, h('h3', TOPICS[k].title), h('p', topicNote(k)))))));
}

/* ---------- Vocabulary page ---------- */
/* ---------- study words by how common they are ---------- */
const BANDS = [[1000, 1e9], [500, 999], [250, 499], [100, 249], [50, 99], [30, 49], [20, 29], [10, 19], [5, 9], [2, 4], [1, 1]];
const bandLabel = ([lo, hi]) => hi >= 1e9 ? 'Words used ' + lo.toLocaleString('en-US') + '+ times' : lo === hi ? 'Words used once' : 'Words used ' + lo + '–' + hi + ' times';
function bandsCard() {
  const rows = BANDS.map((b) => {
    const ws = D.lex.filter((L) => L.freq >= b[0] && L.freq <= b[1]);
    const fresh = ws.filter((L) => status(L.n) === 'unknown').length;
    return h('div.li', { style: { gap: '.7rem' } }, h('div.grow', h('b', bandLabel(b)), h('div.muted.small', ws.length.toLocaleString('en-US') + ' words · ' + (fresh ? fresh.toLocaleString('en-US') + ' new to you' : 'you know them all'))),
      fresh ? h('a.btn.sm.primary', { href: '#/learn/set/' + b[0] + '/' + (b[1] >= 1e9 ? 999999 : b[1]) }, 'Study') : h('span.chip.good', '✓'));
  });
  return h('div.list', rows);
}

function wordsPage(view) {
  const goal = K.goal && K.goal.book ? K.goal : null;
  clear(view).append(
    h('div.pagehead', h('h1', 'Vocabulary')),
    h('div.stack',
      startButton(smart('words')),
      h('div.row.wrap', h('a.btn.sm', { href: TOPICS.words.preview }, 'Look ahead at new words')),
      fold('Study a passage',
        goal ? h('div.row.between', h('div', h('b', 'Your goal: ' + scopeLabel(goal))), h('a.btn.primary.sm', { href: '#/learn/passage/' + [goal.book, goal.c1, goal.v1 || 1, goal.c2, goal.v2 || 999].join('/') }, 'Study')) : null,
        passagePicker(view, goal)),
      fold('Study by how common the words are', h('p.muted.small', 'Pick a group of words by how often they occur in the New Testament. lexiko teaches the ones in it you don’t know yet.'), bandsCard()),
      fold('Options',
        h('div.row.between', h('div', h('b', 'Quiz style'), h('div.muted.small', 'How you answer each word.')),
          h('div.seg', [['flash', 'Flashcards'], ['choice', 'Multiple choice']].map(([v, t]) => h('button', { 'aria-pressed': String(setting('mode') === v), onclick: async (e) => { await setSetting('mode', v); [...e.currentTarget.parentNode.children].forEach((b) => b.setAttribute('aria-pressed', String(b === e.currentTarget))); } }, t)))),
        h('div.row.wrap', h('a.btn.sm', { href: '#/learn/review' }, 'Review only'), h('a.btn.sm', { href: '#/learn/level' }, 'Learn the next common words'), h('a.btn.sm', { href: '#/settings' }, 'Change my level')))));
}
