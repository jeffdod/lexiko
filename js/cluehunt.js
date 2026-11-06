// Clue hunt: practice only. For a verb form from the text you find the clues in order (front of the word, tense stem, tense formative, endings) before naming the form,
// Gated like the daily quiz: only forms whose level is open (and, with “Parse by chart row”, whose chart row you know). And now and then a contrast pair (two forms of one verb that are easy to confuse) asks which is which. The clues come from the master verb chart's rows.
import { D } from './data.js';
import { ROWS, say, summary } from './chartdrill.js';
import { rowPool } from './parse.js';
import { h, clear, shuffle, backHead, backLinks } from './util.js';
import { rowOfTag } from './families.js';
import { getParseStats, K, parseId } from './know.js';
import { clueRef } from './clueref.js';

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

/** How much a form is worth asking: forms you have missed in Parsing, or that are hard for you, come up more often. */
const formWeight = (id) => { const card = K.cards.get(parseId(D.forms[id])); return card ? Math.min(8, 1 + (card.lapses || 0) * 1.5 + ((card.difficulty || 5) >= 6 ? 1.5 : 0)) : 1; };
const missedBefore = (id) => { const card = K.cards.get(parseId(D.forms[id])); return !!card && (card.lapses || 0) > 0; };
/** A random order in which heavier items tend to come first (each item's key is -ln(random) / weight; smallest first). */
const weightedOrder = (ids) => ids.map((id) => [-Math.log(1 - Math.random()) / formWeight(id), id]).sort((a, b) => a[0] - b[0]).map((x) => x[1]);

/** Pairs that are easy to confuse. */
const PAIRS = [['pres-act', 'impf-act'], ['pres-mp', 'impf-mp'], ['impf-act', 'aor2-act'], ['pres-act', 'fut-act'], ['aor1-act', 'aor1-mid'], ['aor1-act', 'aor1-pas'], ['aor1-act', 'perf1-act'], ['pres-mp', 'fut-mid'], ['aor2-act', 'aor2-mid'], ['fut-act', 'aor1-act'], ['impf-mp', 'aor2-mid'], ['fut-pas1', 'aor1-pas'], ['pres-act', 'pres-mp'], ['impf-act', 'impf-mp'], ['fut-act', 'fut-mid'], ['aor1-mid', 'aor1-pas']];

/** The tense and the voice a chart row stands for, to see which Parsing slot a pair tests. */
const tenseOfRow = (k) => (/^(pres|impf|fut|aor|perf)/.exec(k) || [])[1];
const voiceOfRow = (k) => (/-act$/.test(k) ? 'act' : /-mp$/.test(k) ? 'mp' : /-mid$/.test(k) ? 'mid' : 'pas');
/** How weak you are in a Parsing slot, 0 (always right) to 1 (never), from your answers so far; with few answers it stays near the middle. */
const weakness = (st, slot) => { const s = st && st.slots && st.slots[slot]; return s ? 1 - (s[0] + 2) / (s[1] + 4) : 0.5; };
const accuracy = (st, slot) => { const s = st && st.slots && st.slots[slot]; return s && s[1] >= 10 ? s[0] / s[1] : null; };
/** A pair is more likely the weaker you are in the slots it tests (tense, voice); returns its weight and, when you are clearly weak in one, the reason. */
export function pairWeight(a, b, st) {
  const diff = [];
  if (tenseOfRow(a) !== tenseOfRow(b)) diff.push('tense');
  if (voiceOfRow(a) !== voiceOfRow(b)) diff.push('voice');
  const weak = diff.map((s) => [s, weakness(st, s), accuracy(st, s)]).sort((x, y) => y[1] - x[1])[0];
  return { w: 0.1 + diff.reduce((n, s) => n + weakness(st, s), 0), reason: weak && weak[2] != null && weak[2] < 0.85 ? 'You get the ' + weak[0] + ' right ' + Math.round(weak[2] * 100) + '% of the time in Parsing, so here is a pair that differs in the ' + weak[0] + '.' : null };
}

/** Forms of one verb in each of two rows: [{ a: id, b: id, n }]. */
function pairsFor(keyA, keyB, any, cache) {
  const m = (k) => { const key = k + any; if (!cache.has(key)) { const by = new Map(); for (const id of rowPool(k, { gated: true, anyVerb: any })) { const n = strongsOf(id); if (n != null && !by.has(n)) by.set(n, []); if (n != null) by.get(n).push(id); } cache.set(key, by); } return cache.get(key); };
  const A = m(keyA), B = m(keyB), out = [];
  for (const [n, ids] of A) if (B.has(n)) out.push({ n, a: shuffle(ids.slice().sort((x, y) => D.forms[y].count - D.forms[x].count).slice(0, 5))[0], b: shuffle(B.get(n).slice().sort((x, y) => D.forms[y].count - D.forms[x].count).slice(0, 5))[0] });
  return out;
}

/** The session: forms to hunt clues in, with a contrast pair every third question. */
export function clueQueue(any, total = 10, st = null) {
  const cache = new Map(), hunts = [], pairs = [];
  const pools = KEYS.filter((k) => !/-liq-/.test(k)).map((k) => [k, rowPool(k, { gated: true, anyVerb: any })]).filter(([, p]) => p.length);
  const lists = shuffle(pools.map(([k, p]) => [k, weightedOrder(p.slice().sort((x, y) => D.forms[y].count - D.forms[x].count).slice(0, 40))])), seen = new Set();   // rows in a random order, so later rows (aorist, perfect) are not always left out
  for (let i = 0; lists.length && hunts.length < total; i++) { const [k, l] = lists[i % lists.length]; const id = l.find((x) => !seen.has(x)); if (id != null) { seen.add(id); hunts.push({ type: 'hunt', id, key: k, missed: missedBefore(id) }); } else if (lists.every(([, q]) => q.every((x) => seen.has(x)))) break; }
  const avail = PAIRS.map(([a, b]) => ({ a, b, f: pairsFor(a, b, any, cache), ...pairWeight(a, b, st) })).filter((x) => x.f.length);
  while (avail.length && pairs.length < Math.floor(total / 3)) {                  // weighted draw without replacement: weaker slots come up more often
    let r = Math.random() * avail.reduce((n, x) => n + x.w, 0), i = 0; while (i < avail.length - 1 && (r -= avail[i].w) > 0) i++;
    const x = avail.splice(i, 1)[0], p = shuffle(x.f)[0]; pairs.push({ type: 'pair', a: x.a, b: x.b, ida: p.a, idb: p.b, n: p.n, reason: x.reason });
  }
  const out = []; let hi = 0, pi = 0;
  while (out.length < total && (hi < hunts.length || pi < pairs.length)) { if (out.length % 3 === 2 && pi < pairs.length) out.push(pairs[pi++]); else if (hi < hunts.length) out.push(hunts[hi++]); else out.push(pairs[pi++]); }
  return out;
}


/* ---------- compound verbs: the augment (or reduplication) comes after the preposition ---------- */
const PREPS = { ανα: ['ανα', 'αν'], αντι: ['αντι', 'αντ', 'ανθ'], απο: ['απο', 'απ', 'αφ'], αμφι: ['αμφι', 'αμφ'], δια: ['δια', 'δι'], εισ: ['εισ'], εκ: ['εκ', 'εξ'], εν: ['εν', 'εμ', 'εγ'], επι: ['επι', 'επ', 'εφ'], κατα: ['κατα', 'κατ', 'καθ'], μετα: ['μετα', 'μετ', 'μεθ'], παρα: ['παρα', 'παρ'], περι: ['περι'], προσ: ['προσ'], προ: ['προ', 'πρ'], συν: ['συν', 'συμ', 'συγ', 'συλ', 'συ'], υπερ: ['υπερ'], υπο: ['υπο', 'υπ', 'υφ'] };
const PREP_KEYS = Object.keys(PREPS).sort((a, b) => b.length - a.length);
const skeleton = (s) => s.replace(/­/g, '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/ς/g, 'σ');
const letters = (w) => { const out = []; for (const c of w.replace(/­/g, '').normalize('NFD')) { if (/[̀-ͯ]/.test(c) && out.length) out[out.length - 1].text += c; else out.push({ ch: c.toLowerCase().replace('ς', 'σ'), text: c }); } return out; };
/** True when the lexeme begins with a preposition (a compound verb). */
const ELIDED = ['επ', 'απ', 'υπ', 'αν', 'εξ', 'συλ', 'συμ', 'συγ', 'αφ', 'καθ', 'μεθ', 'υφ', 'εμ', 'εγ', 'εφ', 'ανθ'];
export const isCompoundLemma = (head) => { const lem = skeleton(head); return [...PREP_KEYS, ...ELIDED].some((k) => lem.startsWith(k) && lem.length >= k.length + 3); };
/** A compound verb's form in three pieces [preposition, augment or reduplication, the rest], or null. The lexeme must begin with a preposition; the form must show the augment right after it. */
export function splitCompound(word, head, row) {
  if (!row || !(row.aug === 'ε' || row.aug === 'RED')) return null;
  const lem = skeleton(head), u = letters(word), join = (a, b) => u.slice(a, b).map((x) => x.text).join('').normalize('NFC');
  for (const key of PREP_KEYS) {
    if (!lem.startsWith(key) || lem.length < key.length + 3) continue;
    for (const v of PREPS[key]) {
      const n = v.length; if (u.slice(0, n).map((x) => x.ch).join('') !== v) continue;
      const k = u.length - n;
      if (row.aug === 'ε' && k >= 3 && (u[n].ch === 'ε' || u[n].ch === 'η')) return [join(0, n), join(n, n + 1), join(n + 1)];
      if (row.aug === 'RED' && k >= 4 && u[n + 1].ch === 'ε') return [join(0, n), join(n, n + 2), join(n + 2)];
    }
  }
  return null;
}
const splitView = (p) => h('span', { lang: 'grc', style: { fontFamily: 'var(--greek)', fontSize: '1.15rem' } }, p[0], h('span.sep', ' · '), h('b', { style: { color: 'var(--accent)' } }, p[1]), h('span.sep', ' · '), p[2]);

/* ---------- the screens ---------- */
const greek = (t, cls = '') => h('span' + cls, { lang: 'grc' }, t);
const bigWord = (w) => h('div', { lang: 'grc', style: { fontFamily: 'var(--greek)', fontSize: '2.4rem', textAlign: 'center', margin: '.3rem 0' } }, w.replace(/\u00ad/g, ''));
const note = (kids, cls = '') => h('div.card.small' + cls, { style: { background: 'var(--accent-soft)', border: 'none' } }, ...kids);

export async function renderClues(view, mode, single = null) {
  const st = single ? null : await getParseStats().catch(() => null);
  const an = single ? D.forms[single.formIdx].an[single.an] : null, row = an ? rowOfTag(an.m, an.s) : null;
  const any = mode === 'any', queue = single ? (row ? [{ type: 'hunt', id: single.formIdx, key: row, an: single.an }] : []) : clueQueue(any, 10, st);
  const home = single && clueRef.back ? clueRef.back : '#/parse', homeName = single && clueRef.back ? 'Reading' : 'Parsing', back = [home, 'Back to ' + homeName.toLowerCase()];
  if (!queue.length && single) { clear(view).append(backHead('Clue hunt', home, homeName), h('div.card.stack', h('p', 'Clue hunt covers the indicative forms of verbs, the ones on the master verb chart. This form is another mood.'), ...backLinks(...back))); return; }
  if (!queue.length) { clear(view).append(backHead('Clue hunt', home, homeName), h('div.card.stack', h('p', 'There are no forms to hunt yet' + (any ? '' : ' in verbs you know') + '. Forms open up as you learn the chart rows and the verbs.'), h('a.btn', { href: '#/parse/run/clues/any' }, 'Try with any verb'), ...backLinks(...back))); return; }
  const tally = { clue: [0, 0], name: [0, 0], pair: [0, 0] }, missedClue = {};
  let at = 0;

  const done = () => {
    const worst = Object.entries(missedClue).sort((a, b) => b[1] - a[1])[0];
    clear(view).append(backHead('Clue hunt', home, homeName), h('div.card.stack', h('h2', 'Practice complete'), h('p.muted.small', 'Practice only: nothing here changes your review schedule.'),
      h('div.kpis', h('div.kpi', h('b', tally.clue[0] + ' / ' + tally.clue[1]), h('span', 'clues found')), h('div.kpi', h('b', tally.name[0] + ' / ' + tally.name[1]), h('span', 'forms named')), tally.pair[1] ? h('div.kpi', h('b', tally.pair[0] + ' / ' + tally.pair[1]), h('span', 'pairs told apart')) : null),
      worst ? h('p', 'You missed the clue about the ', h('b', worst[0].toLowerCase()), ' most often.') : h('p', 'You found every clue.'),
      h('div.row.wrap', h('button.btn.primary', { onclick: () => renderClues(view, mode) }, 'Practice more'), ...backLinks(...back))));
  };
  const context = (word) => {
    const w = word.replace(/\u00ad/g, '');
    if (!single || !clueRef.verse) return null; const i = clueRef.verse.indexOf(w); if (i < 0) return null;
    return h('p.muted.small', { lang: 'grc', style: { margin: 0, fontFamily: 'var(--greek)', fontSize: '1.05rem', lineHeight: 1.6 } }, clueRef.verse.slice(0, i), h('b', { style: { color: 'var(--accent)' } }, clueRef.verse.slice(i, i + w.length)), clueRef.verse.slice(i + w.length));
  };
  const frame = (title, body) => clear(view).append(backHead('Clue hunt', home, homeName), h('div.stack', h('div.card.stack', h('div.row.between', h('b', title), single ? null : h('span.chip', (at + 1) + ' / ' + queue.length)), context(D.forms[queue[at].id ? queue[at].id : queue[at].ida].w), ...body)));
  const next = (label = 'Next') => h('button.btn.primary', { onclick: () => { at++; at < queue.length ? show() : single ? (location.hash = home) : done(); } }, label);

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
    const r = ROW[q.key], w = D.forms[q.id].w, steps = [], res = [], L0 = D.lexByN.get(D.forms[q.id].an[q.an || 0].s), split = L0 ? splitCompound(w, L0.head, r) : null;
    const draw = (i, picked) => {
      const doneSteps = CLUES.slice(0, i).map((c, j) => h('div.row', { style: { gap: '.6rem', padding: '.35rem 0', borderTop: '1px solid var(--line)' } }, h('span', { style: { color: res[j] ? 'var(--good)' : 'var(--warn)', fontWeight: 800 } }, res[j] ? '✓' : '•'), h('span', h('b', c.name + ': '), c.say(r), j === 0 && split ? [' · ', splitView(split)] : null)));
      if (i < CLUES.length) {
        const c = CLUES[i];
        frame('Find the clues', [bigWord(w), h('p.muted.small', { style: { margin: 0 } }, 'Look for the clues before you name the form. Practice only.' + (q.missed ? ' You have missed this form in Parsing before.' : '')), ...doneSteps, h('p', { style: { marginBottom: c.hint ? '.2rem' : undefined } }, h('b', c.ask)), c.hint ? h('p.muted.small', { lang: 'en' }, c.hint) : null,
          choices(c.options(r), c.answer(r), (v, ok) => { res[i] = ok; tally.clue[1]++; if (ok) tally.clue[0]++; else missedClue[c.name] = (missedClue[c.name] || 0) + 1; setTimeout(() => draw(i + 1), ok ? 450 : 1300); }, c.key === 'form' || c.key === 'ends' ? false : false)]);
      } else if (i === CLUES.length) {
        frame('Name the form', [bigWord(w), ...doneSteps, h('p', h('b', 'Which form is it?')),
          choices(nameOptions(r).map((o) => [o.key, nice(o)]), r.key, (v, ok) => { tally.name[1]++; if (ok) tally.name[0]++; setTimeout(() => draw(i + 1, v), ok ? 450 : 1300); })]);
      } else {
        const wrong = picked !== r.key ? ROW[picked] : null, why = wrong ? differ(r, wrong) : [];
        const noteKids = wrong ? [h('b', 'It is the ' + nice(r) + '. '), why.length ? 'What distinguishes it from the ' + nice(wrong) + ': ' + why.map((c) => c.name.toLowerCase() + ' (' + c.say(r) + ' here, ' + c.say(wrong) + ' there)').join('; ') + '.' : 'The clues are the same for both; check the tense stem and the voice.'] : [h('b', 'Right: the ' + nice(r) + '. '), 'Clues: ' + CLUES.map((c) => c.say(r)).join(', ') + '.'];
        frame('Clue hunt', [bigWord(w), note(noteKids), split ? h('p', { style: { margin: 0 } }, h('b', 'Compound verb: '), splitView(split), h('span.muted.small', ' (preposition · augment or reduplication · the rest)')) : null, h('p.muted.small', { style: { margin: 0 } }, summary(r)), next(single ? 'Back to the reading' : 'Next')]);
      }
    };
    draw(0);
  };

  const pair = (q) => {
    const A = ROW[q.a], B = ROW[q.b], askA = Math.random() < 0.5, target = askA ? A : B, other = askA ? B : A, wa = D.forms[q.ida].w, wb = D.forms[q.idb].w;
    const L = D.lexByN.get(q.n), order = shuffle([['a', wa], ['b', wb]]), right = target === A ? 'a' : 'b';
    frame('What’s the difference?', [h('p.muted.small', { style: { margin: 0 } }, 'Two forms of ', L ? greek(L.head) : 'one verb', '. Practice only.'), q.reason ? h('p.small', { style: { margin: 0, color: 'var(--ink-2)' } }, q.reason) : null, h('p', h('b', 'Which one is the ' + nice(target) + '?')),
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
