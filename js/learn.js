// Vocabulary study: scope picker + session runner (flashcard self-rating or multiple choice), FSRS-scheduled.
import { D, lexeme, unpack, scopeLabel, tokenForm, chapterVerses, tokenPunct, tokenFlag, periBook, periRange } from './data.js';
import { K, status, setting, setSetting, rate, getCard, dueCards, buildSession, scopeReadiness, newToday, nextByLevel, passageWords, readinessLabel, readinessClass } from './know.js';
import * as F from './fsrs.js';
import { decode } from './morph.js';
import { h, clear, shuffle, fmtInterval, pct, icon, toAcute } from './util.js';
import { readHref } from './reader.js';

const fmt = (n) => n.toLocaleString('en-US');
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
  const score = (o) => { const len = o.toks.length; const known = o.toks.filter((t) => status(tokenForm(t).an[0].s) === 'known').length / len; return Math.abs(len - 11) * 0.12 - known * 2; };
  sample.sort((a, b) => score(a) - score(b));
  const best = sample[0];
  const el = h('div.qctx', { lang: 'grc' }, h('span.ref', D.bookByCode.get(best.code).name + ' ' + best.ch + ':' + best.vs));
  best.toks.forEach((t) => {
    const f = tokenForm(t), w = f.w, hit = f.an[0].s === n;
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
function runSession(view, items, { title, scope, back }) {
  const queue = items.map((i) => ({ ...i }));
  const total = queue.length;
  const stats = { done: 0, good: 0, again: 0, fresh: 0, probes: 0, probeMiss: 0 };
  let current = null, t0 = 0;

  const finish = () => {
    clear(view).append(
      h('div.pagehead', h('h1', 'Session complete')),
      h('div.card.stack', h('div.kpis',
        h('div.kpi', h('b', stats.done), h('span', 'cards done')),
        h('div.kpi', h('b', stats.done ? pct(stats.good / (stats.good + stats.again || 1)) : '—'), h('span', 'answered correctly')),
        h('div.kpi', h('b', stats.fresh), h('span', 'new words started')),
        stats.probes ? h('div.kpi', h('b', stats.probes - stats.probeMiss + '/' + stats.probes), h('span', 'check-ins held')) : null),
        stats.probeMiss ? h('p.muted', stats.probeMiss + ' word' + (stats.probeMiss > 1 ? 's' : '') + ' you’d assumed you knew slipped; they’re back in your review pile.') : null,
        h('div.row.wrap', scope ? h('a.btn.primary', { href: readHref(scope.book, scope.c1, scope.v1 > 1 ? scope.v1 : 0) }, icon('read', 18), 'Read ' + scopeLabel(scope)) : null,
          h('a.btn' + (scope ? '' : '.primary'), { href: '#/learn' }, 'Back to Learn'), h('a.btn', { href: '#/progress' }, 'Progress'))));
  };

  const advance = () => { current = queue.shift(); if (!current) return finish(); show(current); };
  const requeue = (item, gap) => queue.splice(Math.min(queue.length, gap), 0, item);

  async function grade(item, g) {
    await rate(item.n, g, item.type, Date.now() - t0);
    if (!item.seen) {                       // first time this card is answered in the session
      item.seen = true;
      if (item.type === 'new') stats.fresh++;
      if (item.type === 'probe') { stats.probes++; if (g < 3) stats.probeMiss++; }
    }
    if (g >= 3) { stats.good++; stats.done++; }
    else { stats.again++; requeue(item, g === 1 ? 3 : 7); }
    advance();
  }

  function frame(item, inner) {
    const label = item.type === 'new' ? ['accent', 'New'] : item.type === 'probe' ? ['gold', 'Check-in'] : ['', 'Review'];
        clear(view).append(h('div.qwrap',
      h('div.qtop', h('button.btn.ghost.icon.sm', { 'aria-label': 'End session', onclick: () => { if (confirm('End this session? Your answers so far are saved.')) finish(); } }, icon('close', 20)),
        h('div.bar.accent.grow', h('i', { style: { width: (100 * stats.done / total) + '%' } })),
        h('span.chip.' + label[0], label[1])),
      inner));
  }

  function show(item) {
    t0 = Date.now();
    const L = lexeme(item.n), flash = setting('mode') !== 'choice';
    const pos = POSNAME[L.pos] || L.pos;
    const head = [h('div.qgreek', { lang: 'grc' }, L.head), h('div.qmeta', pos + ' · G' + L.n + ' · ' + fmt(L.freq) + '×')];
    const reveal = (extra) => {
      const card = getCard(item.n) || F.newCard('w:' + item.n);
      const pv = F.preview(card, Date.now(), setting('retention'));
      const answer = [h('div.qgloss', L.brief), L.full ? h('div.qdef', L.full) : null, contextFor(L.n, scope)];
      const grades = h('div.grades',
        [[1, 'Again'], [2, 'Hard'], [3, 'Good'], [4, 'Easy']].map(([g, name]) => h('button.g' + g, { onclick: () => grade(item, g) }, name, h('small', fmtInterval(pv[g])))));
      return { answer, grades };
    };
    if (flash) {
      const card = h('div.qcard', ...head, h('div', { id: 'ans' }));
      const ctl = h('div', h('button.btn.primary.block', { onclick: () => {
        const r = reveal(); card.querySelector('#ans').append(...r.answer.filter(Boolean)); clear(ctl).append(r.grades);
      } }, 'Show answer'));
      frame(item, [card, ctl]);
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
        clear(ctl).append(h('button.btn.primary.block', { onclick: () => grade(item, g) }, ok ? 'Continue' : 'Continue (I’ll see this again)'));
      };
      opts.forEach((o) => optsEl.append(h('button.opt', { dataset: { n: o.n }, onclick: () => settle(o.n) }, h('span', o.brief), h('span.mark', ''))));
      frame(item, [card, h('div.row.between', h('button.btn.ghost.sm', { onclick: () => settle(-1) }, 'I don’t know'), h('span')), ctl]);
    }
  }
  advance();
}

/* ---------- Learn tab ---------- */
function startFrom(view, kind, scope, title) {
  const items = buildSession({ scope, kind });
  if (!items.length) {
    clear(view).append(h('div.pagehead', h('h1', title || 'Study')), h('div.card.stack', h('p', scope ? 'You already know every word in ' + scopeLabel(scope) + ', and nothing is due. 🎉' : 'Nothing is due right now.'),
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
    h('div.row.wrap', h('label.field', 'To chapter', c2), h('label.field', 'verse (optional)', v2)), info, go);
}

export function renderLearn(view, params) {
  const [mode, ...rest] = params;
  if (mode === 'daily') return void startFrom(view, 'daily', null, 'Today’s session');
  if (mode === 'review') return void startFrom(view, 'review', null, 'Review');
  if (mode === 'level') {
    const items = nextByLevel(setting('newPerDay')).map((x) => ({ n: x.n, type: 'new' }));
    return void (items.length ? runSession(view, items, { title: 'New words' }) : startFrom(view, 'review', null));
  }
  if (mode === 'passage') {
    const [book, c1, v1, c2, v2] = rest; const scope = { book, c1: +c1, v1: +v1 || 1, c2: +c2 || +c1, v2: +v2 || 999 };
    if (!D.bookByCode.has(book)) return void (location.hash = '#/learn');
    return void startFrom(view, 'passage', scope, scopeLabel(scope));
  }
  const due = dueCards().length;
  const lvl = K.settings.level;
  const goal = K.goal && K.goal.book ? K.goal : null;
  clear(view).append(
    h('div.pagehead', h('h1', 'Learn')),
    h('div.stack',
      h('div.scope-pick',
        h('a.tile', { href: '#/learn/daily' }, h('h3', 'Today’s session'), h('p', due + ' due · ' + Math.max(0, setting('newPerDay') - newToday()) + ' new available' + (lvl != null ? ' · check-ins' : ''))),
        h('a.tile', { href: '#/learn/review' }, h('h3', 'Review only'), h('p', due ? due + ' card' + (due === 1 ? '' : 's') + ' due' : 'Nothing due')),
        h('a.tile', { href: '#/learn/level' }, h('h3', 'Next words'), h('p', 'The ' + setting('newPerDay') + ' most common words you don’t know yet')),
        h('a.tile', { href: '#/parse' }, h('h3', 'Parsing'), h('p', 'Tense, voice, mood, case… one part at a time'))),
      goal ? h('div.card', h('div.row.between', h('div', h('h3', 'Your goal: ' + scopeLabel(goal)), h('div.muted.small', 'Learn the words, then read it.')),
        h('a.btn.primary.sm', { href: '#/learn/passage/' + [goal.book, goal.c1, goal.v1 || 1, goal.c2, goal.v2 || 999].join('/') }, 'Study'))) : null,
      passagePicker(view, goal),
      h('div.card.flat', h('div.row.between', h('div', h('b', 'Quiz style'), h('div.muted.small', 'How you answer each word.')),
        h('div.seg', [['flash', 'Flashcards'], ['choice', 'Multiple choice']].map(([v, t]) => h('button', { 'aria-pressed': setting('mode') === v, onclick: async (e) => { await setSetting('mode', v); [...e.target.parentNode.children].forEach((b) => b.setAttribute('aria-pressed', b === e.target)); } }, t)))))));
}
