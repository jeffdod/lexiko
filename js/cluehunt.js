// Clue hunt: practice only. For a verb form from the text you find the clues in order (front of the word, tense stem, tense formative, endings) before naming the form,
// Gated like the daily quiz: only forms whose level is open (and, with “Parse by chart row”, whose chart row you know). And now and then a contrast pair (two forms of one verb that are easy to confuse) asks which is which. The clues come from the master verb chart's rows.
import { D } from './data.js';
import { ROWS, say, summary } from './chartdrill.js';
import { rowPool } from './parse.js';
import { h, clear, shuffle, backHead, backLinks } from './util.js';

const ROW = Object.fromEntries(ROWS.map((r) => [r.key, r]));
const KEYS = ROWS.map((r) => r.key);
const nice = (r) => say(r.name).toLowerCase().replace(/^(\d)/, '$1');
const strongsOf = (id) => { const a = D.forms[id].an[0]; return a ? a.s : null; };

/* ---------- the clues, in order ---------- */
const augKind = (r) => (r.aug === 'RED' ? 'red' : r.aug ? 'aug' : 'none');
const AUG = [['none', 'No augment or reduplication'], ['aug', 'An augment (ε- or η-)'], ['red', 'Reduplication (first consonant + ε)']];
const STEM = [...new Set(ROWS.map((r) => r.stem))];
const FORM = [...new Set(ROWS.map((r) => r.form))];
const ENDS = [...new Set(ROWS.map((r) => r.ends))];
const CLUES = [
  { key: 'aug', name: 'Augment or reduplication', ask: 'Is there an augment or a reduplication?', hint: 'In a compound verb it comes after the preposition, as in κατ-έ-βη.', answer: (r) => augKind(r), options: () => AUG, say: (r) => AUG.find((o) => o[0] === augKind(r))[1].toLowerCase() },
  { key: 'stem', name: 'Tense stem', ask: 'Which tense stem is it built on?', answer: (r) => r.stem, options: () => STEM.map((s) => [s, say(s)]), say: (r) => say(r.stem) + ' stem' },
  { key: 'form', name: 'Tense formative', ask: 'Which tense formative comes after the stem?', answer: (r) => r.form, options: (r) => { const w = shuffle(FORM.filter((f) => f !== r.form)).slice(0, 3); return shuffle([r.form, ...w]).map((f) => [f, f || 'none']); }, say: (r) => (r.form ? 'formative ' + r.form : 'no formative') },
  { key: 'ends', name: 'Endings', ask: 'Which personal endings does it take?', answer: (r) => r.ends, options: () => ENDS.map((e) => [e, say(e)]), say: (r) => say(r.ends) + ' endings' },
];

/** What tells two rows apart, in clue order: the clues where they differ. */
const differ = (a, b) => CLUES.filter((c) => c.answer(a) !== c.answer(b));
/** Choices for naming the form: the row, and three that share the most clues with it. */
function nameOptions(r) {
  const score = (o) => CLUES.filter((c) => c.answer(o) === c.answer(r)).length + (o.name.split(' ')[0] === r.name.split(' ')[0] ? 1 : 0);
  const near = shuffle(ROWS.filter((o) => o.key !== r.key && !/^(fut-liq|aor-liq)/.test(o.key))).sort((a, b) => score(b) - score(a)).slice(0, 5);
  return shuffle([r, ...shuffle(near).slice(0, 3)]);
}

/** Pairs that are easy to confuse. */
const PAIRS = [['pres-act', 'impf-act'], ['pres-mp', 'impf-mp'], ['impf-act', 'aor2-act'], ['pres-act', 'fut-act'], ['aor1-act', 'aor1-mid'], ['aor1-act', 'aor1-pas'], ['aor1-act', 'perf1-act'], ['pres-mp', 'fut-mid'], ['aor2-act', 'aor2-mid'], ['fut-act', 'aor1-act'], ['impf-mp', 'aor2-mid'], ['fut-pas1', 'aor1-pas']];

/** Forms of one verb in each of two rows: [{ a: id, b: id, n }]. */
function pairsFor(keyA, keyB, any, cache) {
  const m = (k) => { const key = k + any; if (!cache.has(key)) { const by = new Map(); for (const id of rowPool(k, { gated: true, anyVerb: any })) { const n = strongsOf(id); if (n != null && !by.has(n)) by.set(n, []); if (n != null) by.get(n).push(id); } cache.set(key, by); } return cache.get(key); };
  const A = m(keyA), B = m(keyB), out = [];
  for (const [n, ids] of A) if (B.has(n)) out.push({ n, a: shuffle(ids.slice().sort((x, y) => D.forms[y].count - D.forms[x].count).slice(0, 5))[0], b: shuffle(B.get(n).slice().sort((x, y) => D.forms[y].count - D.forms[x].count).slice(0, 5))[0] });
  return out;
}

/** The session: forms to hunt clues in, with a contrast pair every third question. */
export function clueQueue(any, total = 10) {
  const cache = new Map(), hunts = [], pairs = [];
  const pools = KEYS.filter((k) => !/-liq-/.test(k)).map((k) => [k, rowPool(k, { gated: true, anyVerb: any })]).filter(([, p]) => p.length);
  const lists = pools.map(([k, p]) => [k, shuffle(p.slice().sort((x, y) => D.forms[y].count - D.forms[x].count).slice(0, 40))]), seen = new Set();
  for (let i = 0; lists.length && hunts.length < total; i++) { const [k, l] = lists[i % lists.length]; const id = l.find((x) => !seen.has(x)); if (id != null) { seen.add(id); hunts.push({ type: 'hunt', id, key: k }); } else if (lists.every(([, q]) => q.every((x) => seen.has(x)))) break; }
  for (const [a, b] of shuffle(PAIRS.slice())) { const f = pairsFor(a, b, any, cache); if (f.length) { const p = shuffle(f)[0]; pairs.push({ type: 'pair', a, b, ida: p.a, idb: p.b, n: p.n }); } if (pairs.length >= Math.floor(total / 3)) break; }
  const out = []; let hi = 0, pi = 0;
  while (out.length < total && (hi < hunts.length || pi < pairs.length)) { if (out.length % 3 === 2 && pi < pairs.length) out.push(pairs[pi++]); else if (hi < hunts.length) out.push(hunts[hi++]); else out.push(pairs[pi++]); }
  return out;
}

/* ---------- the screens ---------- */
const greek = (t, cls = '') => h('span' + cls, { lang: 'grc' }, t);
const bigWord = (w) => h('div', { lang: 'grc', style: { fontFamily: 'var(--greek)', fontSize: '2.4rem', textAlign: 'center', margin: '.3rem 0' } }, w);
const note = (kids, cls = '') => h('div.card.small' + cls, { style: { background: 'var(--accent-soft)', border: 'none' } }, ...kids);

export function renderClues(view, mode) {
  const any = mode === 'any', queue = clueQueue(any), back = ['#/parse', 'Back to Parsing'];
  if (!queue.length) { clear(view).append(backHead('Clue hunt', '#/parse', 'Parsing'), h('div.card.stack', h('p', 'There are no forms to hunt yet' + (any ? '' : ' in verbs you know') + '. Forms open up as you learn the chart rows and the verbs.'), h('a.btn', { href: '#/parse/run/clues/any' }, 'Try with any verb'), ...backLinks(...back))); return; }
  const tally = { clue: [0, 0], name: [0, 0], pair: [0, 0] }, missedClue = {};
  let at = 0;

  const done = () => {
    const worst = Object.entries(missedClue).sort((a, b) => b[1] - a[1])[0];
    clear(view).append(backHead('Clue hunt', '#/parse', 'Parsing'), h('div.card.stack', h('h2', 'Practice complete'), h('p.muted.small', 'Practice only: nothing here changes your review schedule.'),
      h('div.kpis', h('div.kpi', h('b', tally.clue[0] + ' / ' + tally.clue[1]), h('span', 'clues found')), h('div.kpi', h('b', tally.name[0] + ' / ' + tally.name[1]), h('span', 'forms named')), tally.pair[1] ? h('div.kpi', h('b', tally.pair[0] + ' / ' + tally.pair[1]), h('span', 'pairs told apart')) : null),
      worst ? h('p', 'You missed the clue about the ', h('b', worst[0].toLowerCase()), ' most often.') : h('p', 'You found every clue.'),
      h('div.row.wrap', h('button.btn.primary', { onclick: () => renderClues(view, mode) }, 'Practice more'), ...backLinks(...back))));
  };
  const frame = (title, body) => clear(view).append(backHead('Clue hunt', '#/parse', 'Parsing'), h('div.stack', h('div.card.stack', h('div.row.between', h('b', title), h('span.chip', (at + 1) + ' / ' + queue.length)), ...body)));
  const next = (label = 'Next') => h('button.btn.primary', { onclick: () => { at++; at < queue.length ? show() : done(); } }, label);

  /** Multiple choice; `onPick(value)` runs once. */
  const choices = (options, right, onPick, greekLabels = false) => {
    const box = h('div.opts.two'); let locked = false;
    for (const [v, label] of options) {
      const b = h('button.opt', { onclick: () => { if (locked) return; locked = true; const ok = v === right; b.classList.add(ok ? 'right' : 'wrong'); if (!ok) [...box.children].find((x) => x.dataset.v === String(right))?.classList.add('right'); onPick(v, ok); } }, greekLabels ? greek(label) : label);
      b.dataset.v = String(v); box.append(b);
    }
    return box;
  };

  const hunt = (q) => {
    const r = ROW[q.key], w = D.forms[q.id].w, steps = [], res = [];
    const draw = (i, picked) => {
      const doneSteps = CLUES.slice(0, i).map((c, j) => h('div.row', { style: { gap: '.6rem', padding: '.35rem 0', borderTop: '1px solid var(--line)' } }, h('span', { style: { color: res[j] ? 'var(--good)' : 'var(--warn)', fontWeight: 800 } }, res[j] ? '✓' : '•'), h('span', h('b', c.name + ': '), c.say(r))));
      if (i < CLUES.length) {
        const c = CLUES[i];
        frame('Find the clues', [bigWord(w), h('p.muted.small', { style: { margin: 0 } }, 'Look for the clues before you name the form. Practice only.'), ...doneSteps, h('p', { style: { marginBottom: c.hint ? '.2rem' : undefined } }, h('b', c.ask)), c.hint ? h('p.muted.small', { lang: 'en' }, c.hint) : null,
          choices(c.options(r), c.answer(r), (v, ok) => { res[i] = ok; tally.clue[1]++; if (ok) tally.clue[0]++; else missedClue[c.name] = (missedClue[c.name] || 0) + 1; setTimeout(() => draw(i + 1), ok ? 450 : 1300); }, c.key === 'form' || c.key === 'ends' ? false : false)]);
      } else if (i === CLUES.length) {
        frame('Name the form', [bigWord(w), ...doneSteps, h('p', h('b', 'Which form is it?')),
          choices(nameOptions(r).map((o) => [o.key, nice(o)]), r.key, (v, ok) => { tally.name[1]++; if (ok) tally.name[0]++; setTimeout(() => draw(i + 1, v), ok ? 450 : 1300); })]);
      } else {
        const wrong = picked !== r.key ? ROW[picked] : null, why = wrong ? differ(r, wrong) : [];
        const noteKids = wrong ? [h('b', 'It is the ' + nice(r) + '. '), why.length ? 'What distinguishes it from the ' + nice(wrong) + ': ' + why.map((c) => c.name.toLowerCase() + ' (' + c.say(r) + ' here, ' + c.say(wrong) + ' there)').join('; ') + '.' : 'The clues are the same for both; check the tense stem and the voice.'] : [h('b', 'Right: the ' + nice(r) + '. '), 'Clues: ' + CLUES.map((c) => c.say(r)).join(', ') + '.'];
        frame('Clue hunt', [bigWord(w), note(noteKids), h('p.muted.small', { style: { margin: 0 } }, summary(r)), next()]);
      }
    };
    draw(0);
  };

  const pair = (q) => {
    const A = ROW[q.a], B = ROW[q.b], askA = Math.random() < 0.5, target = askA ? A : B, other = askA ? B : A, wa = D.forms[q.ida].w, wb = D.forms[q.idb].w;
    const L = D.lexByN.get(q.n), order = shuffle([['a', wa], ['b', wb]]), right = target === A ? 'a' : 'b';
    frame('What’s the difference?', [h('p.muted.small', { style: { margin: 0 } }, 'Two forms of ', L ? greek(L.head) : 'one verb', '. Practice only.'), h('p', h('b', 'Which one is the ' + nice(target) + '?')),
      choices(order, right, (v, ok) => {
        tally.pair[1]++; if (ok) tally.pair[0]++;
        const why = differ(target, other);
        setTimeout(() => frame('What’s the difference?', [h('div.row', { style: { gap: '.6rem', flexWrap: 'wrap' } }, ...['a', 'b'].map((k) => h('div.card.small', { style: { flex: '1 1 8rem', textAlign: 'center' } }, greek(k === 'a' ? wa : wb, '.big'), h('div.muted.small', nice(k === 'a' ? A : B))))),
          note([h('b', ok ? 'Right. ' : 'Not quite. '), why.length ? 'They differ in the ' + why.map((c) => c.name.toLowerCase() + ' (' + c.say(target) + ' vs. ' + c.say(other) + ')').join(' and the ') + '.' : 'Both have the same augment, formative and endings; the tense stem or the voice tells them apart (' + nice(target) + ' vs. ' + nice(other) + ').']), next()]), ok ? 350 : 900);
      }, true)]);
  };

  const show = () => { const q = queue[at]; q.type === 'pair' ? pair(q) : hunt(q); };
  show();
}
