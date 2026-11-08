// Imperative: a page on how to read one, a paradigm for each of the eight kinds, and a "which kind is it?" quiz on real
// imperatives from verbs you know. Practice only: nothing here touches the review schedule.
import { D } from './data.js';
import { imperativeForms } from './parse.js';
import { openCharts } from './charts.js';
import { IMP, IMPB, IMP_LOOKALIKE, IMP_MP, PERSONS, splitImp } from './impdata.js';
import { skel, chars, isLiquid, aoristNotes } from './ptcdata.js';
import { contractType, contractSplit, contractNote } from './contract.js';
import { noteKind, kindLine } from './gatenote.js';
import { verbsOn } from './know.js';
import { h, clear, icon, pct, shuffle, missedBlock, backHead, backLinks, startedFromKinds } from './util.js';

const lg = (t, cls = '') => h('span' + cls, { lang: 'grc' }, t);

/* ---------- the page ---------- */
const chipOf = (r) => (r.kind === 'formative' ? r.inner : 'ε');
export function renderImperative(view) {
  const rows = []; let last = null;
  for (const r of IMP) {
    if (r.fam !== last) { last = r.fam; rows.push(h('div.ptcfam', r.fam)); }
    rows.push(h('div.ptcrow', h('a', { href: '#/learn/charts/imperative/' + r.key }, h('span', r.name + ' ›'), lg(r.forms.slice(0, 3).join(', ') + '…', '.mf')),
      h('div.ptcchips', lg(chipOf(r)))));
  }
  clear(view).append(backHead('Imperative', '#/reference', 'Reference'), h('div.stack',
    h('a.btn.sm.practice', { href: '#/learn/charts/imperative/run' }, 'Practice this ›'),
    h('div.row.wrap.links', h('a.btn.ghost.sm', { href: '#/parse/run/imp/all' }, 'Parse some imperatives'), h('button.btn.ghost.sm', { onclick: () => openCharts({ tab: 'endings' }) }, icon('table', 18), ' Look at the endings')),
    h('div.card.stack', h('h2', 'How to read one'),
      h('p.small', 'An imperative is a command, so it has only the 2nd and 3rd person. Three of its four forms take the same endings in every tense:'),
      h('div.subcmp', ...[['τω / σθω', '3rd singular: “let him…”'], ['τε / σθε', '2nd plural: “you (all)…”'], ['τωσαν / σθωσαν', '3rd plural: “let them…”']].map(([e, m]) => h('div.subpair', lg(e, '.g'), h('small', m)))),
      h('p.small.muted', 'The 2nd singular is the one to learn for each tense: ', lg('λῦε'), ', ', lg('λῦσον'), ', ', lg('λῦσαι'), ', ', lg('λύθητι'), '…'),
      h('p.small.muted', 'Present and 2nd aorist share endings, so for those, compare the stem with the verb’s present stem.')),
    h('div.card.stack', h('h2', 'The eight kinds'), h('p.muted.small', 'Tap one to see its paradigm.'), ...rows),
    h('p.muted.small', 'The perfect imperative is very rare (', lg('ἔρρωσθε'), '), and there is no future imperative.')));
}

/* ---------- a paradigm ---------- */
export function renderImpParadigm(view, key) {
  const r = IMPB.get(key); if (!r) { location.hash = '#/learn/charts/imperative'; return; }
  const L = D.lex && D.lex.find((x) => x.head === r.verb);
  const cell = (f, i) => {
    const sp = splitImp(f, key);
    return h('div.pcell' + (i === 0 ? '.pone' : ''), h('div.small.muted.plabel', PERSONS[i].replace(' person', '') + (i === 0 ? ' · learn this one' : '')),
      h('span.pword', { lang: 'grc' }, sp ? [h('span.pstem', sp.stem), sp.formative ? h('span.pform', sp.formative) : null, sp.vowel ? h('b.pvow', sp.vowel) : null, sp.ending ? h('span.pend', sp.ending) : null] : f));
  };
  clear(view).append(backHead('Paradigm', '#/learn/charts/imperative', 'Imperative'), h('div.stack',
    h('div.row.wrap', h('span.chip.accent', r.name + ' imperative')),
    h('div.card.stack', h('div.row.wrap.small.muted', h('span', 'stem'), r.kind === 'formative' ? h('span.pform', 'formative') : h('b.pvow', 'connecting vowel'), h('span.pend', 'ending')),
      h('div.pgrid.ppara', { style: { gridTemplateRows: 'repeat(2, auto)' } }, r.forms.map(cell))),
    h('p.muted.small', h('b', 'Verb: '), lg(r.verb), L && L.brief ? ' · ' + L.brief + '. ' : '. ', r.desc),
    h('p.small', 'The 2nd singular has its own ending in each tense. The other three take the endings shared by every tense.'),
    r.key === 'aor1-mid' ? h('p.small', 'The 2nd singular ', lg('λῦσαι'), ' is spelled like the aorist active infinitive; the context shows which it is.') : null,
    h('div.row.wrap', h('a.btn.primary', { href: '#/learn/charts/imperative/run/' + r.key }, 'Which kind is it?'), h('a.btn', { href: '#/parse/run/imp/' + r.key }, 'Parse forms like this'))));
}

/* ---------- the quiz ---------- */
let keyHandler = null;
const stop = () => { if (keyHandler) { document.removeEventListener('keydown', keyHandler); keyHandler = null; } };
const ROUND = 12;

/** The split of an imperative of the text: contract presents through the merge engine, everything else through the kind's pattern. */
export function splitX(x) {
  if (/^pres/.test(x.key) && contractType(x.head)) {
    const mp = x.key === 'pres-mp', tails = mp ? [['ε', 'σθωσαν', 3], ['ε', 'σθω', 1], ['ε', 'σθε', 2], ['ου', '', 0]] : [['ε', 'τωσαν', 3], ['ε', 'τω', 1], ['ε', 'τε', 2], ['ε', '', 0]];
    const c = contractSplit(x.w, x.head, tails);
    return c && { stem: c.stem, formative: '', vowel: c.vowel, ending: c.ending, person: c.extra, stemSkel: c.stemSkel, contract: c.contract };
  }
  return splitImp(x.w, x.key, { liquid: isLiquid(x.head) });
}
/** About a dozen imperatives spread over the kinds, the commonest of each; only forms the splitter understands. */
export function impQueue(only = null) {
  const by = new Map();
  for (const x of imperativeForms(only, { ignoreLevel: true })) {
    if (/μι$/.test(skel(x.head))) continue;                                     // -μι verbs have their own pattern
    const sp = splitX(x); if (!sp) continue;
    if (!by.has(x.key)) by.set(x.key, []); by.get(x.key).push({ ...x, sp });
  }
  if (!by.size) return [];
  const lists = shuffle([...by.keys()]).map((k) => shuffle(by.get(k).sort((a, b) => b.count - a.count).slice(0, 12)));
  const out = [];
  for (let i = 0; out.length < ROUND && lists.some((l) => l.length > i); i++) for (const l of lists) if (l[i] && out.length < ROUND) out.push(l[i]);
  return shuffle(out);
}
/** Three other kinds to offer: first the look-alike, then ones that share the tense or the voice. */
export function impOptions(key) {
  const me = IMPB.get(key), word = (r, w) => r.name.toLowerCase().includes(w);
  const score = (r) => (r.key === IMP_LOOKALIKE[key] ? 5 : 0) + (r.fam === me.fam ? 1 : 0) + (['active', 'middle', 'passive'].some((w) => word(r, w) && word(me, w)) ? 2 : 0) + Math.random() * 0.9;
  const others = IMP.filter((r) => r.key !== key).sort((a, b) => score(b) - score(a)).slice(0, 3);
  return shuffle([me, ...others]);
}
const presentStem = (head) => skel(head).replace(/(ομαι|μαι|ω)$/, '');
/** What to say after an answer: the pieces, which person it is, the look-alike stem comparison and the notes. */
export function explainImp(x) {
  const r = IMPB.get(x.key), sp = x.sp, e = sp.ending;
  const pieces = [r.kind === 'formative' ? 'formative ' + r.inner : 'connecting vowel ' + r.inner, e && sp.person ? 'ending ' + e : null].filter(Boolean);
  const bits = [r.name + ', ' + PERSONS[sp.person] + (sp.person ? ': ' + pieces.join(', then the ') + '.' : ': ' + (r.s2vowel ? 'just the stem and ε, with no ending.' : 'the ending ' + r.s2 + '.'))];
  if (sp.contract) { bits[0] = r.name + ', ' + PERSONS[sp.person] + ': the stem, the contracted vowel' + (e ? ' and the ending ' + e : '') + '.'; bits.splice(1); bits.push(contractNote(sp, x.head), 'The stem ' + sp.stemSkel + '- is the present stem of ' + x.head + ', so it is a present.'); if (IMP_MP.has(x.key)) bits.push('Middle and passive look the same here; the context decides.'); return bits; }
  bits.push(sp.person ? 'The ending ' + e + ' is the ' + PERSONS[sp.person] + ' in every tense.' : 'The 2nd singular has its own form in each tense, so it is the one to learn.');
  if (x.key === 'aor1-mid' && !sp.person) bits.push('It is spelled the same as the aorist active infinitive; the context shows it is a command.');
  if (IMP_LOOKALIKE[x.key]) {
    const ps = presentStem(x.head), same = sp.stemSkel === ps, pres = x.key.startsWith('pres');
    bits.push('Present and 2nd aorist look alike, so the stem decides. ' + (pres ? (same ? 'The stem here is ' + sp.stemSkel + '-, the same as the present stem of ' + x.head + ', so it is a present.' : 'The stem here is ' + sp.stemSkel + '-.')
      : (same ? 'The stem here is ' + sp.stemSkel + '-.' : 'The stem here is ' + sp.stemSkel + '-, not the present stem ' + ps + '- of ' + x.head + ', so it is a 2nd aorist.')));
  }
  bits.push(...aoristNotes(sp));
  if (IMP_MP.has(x.key)) bits.push('Middle and passive look the same here; the context decides.');
  return bits;
}

export function runImpDrill(view, only = null) {
  const back = only && IMPB.get(only) ? '#/learn/charts/imperative/' + only : '#/learn/charts/imperative';
  const queue = impQueue(IMPB.has(only) ? only : null).map((x) => ({ x, tries: 0 }));
  if (!queue.length) {
    clear(view).append(backHead('Which kind is it?', back, 'Imperative'), h('div.card.stack',
      h('p', 'There are no imperatives to practice yet in verbs you know. They appear as you learn more vocabulary.'), h('a.btn', { href: back }, 'Back to Imperative')));
    return;
  }
  const total = queue.length, retryQ = [], S = { shown: 0, done: 0, good: 0, missed: [], round: 0, R: 0, rk: 0 };
  const finish = () => {
    stop();
    clear(view).append(h('div.pagehead', h('h1', 'Practice complete')),
      h('div.card.stack', h('p.muted.small', 'Practice only: your review schedule is unchanged.'), verbsOn() && S.kinds ? h('div.muted.small', [...S.kinds].map((k) => h('div', kindLine('imp', k)))) : null,
        h('div.kpis', h('div.kpi', h('b', S.done), h('span', 'imperatives')), h('div.kpi', h('b', S.done ? pct(S.good / S.done) : '—'), h('span', 'right first time'))),
        missedBlock(S.missed.map((x) => ({ word: x.w, greek: true, sub: IMPB.get(x.key).name, why: null })), () => { const again = S.missed.map((x) => ({ x, tries: 1 })); S.missed = []; queue.length = 0; queue.push(...again); S.shown = 0; S.round = 0; next(); }),
        h('div.row.wrap', startedFromKinds() ? h('a.btn' + (S.missed.length ? '' : '.primary'), { href: '#/parse/run/imp/' + (only || 'all') }, 'Parse some imperatives') : h('a.btn.primary', { href: '#/learn/charts/imperative' }, 'Back to Imperative'), ...backLinks('#/home', 'Back to Home'))));
  };
  const next = () => {
    stop(); let c = queue.shift();
    if (!c && retryQ.length) { queue.push(...retryQ.splice(0)); S.round = 1; S.R = queue.length; S.rk = 0; c = queue.shift(); }
    if (!c) return finish();
    if (S.round) S.rk++; else S.shown++;
    show(c);
  };
  const after = (c, right) => {
    const ok = right && !c.peek;                                      // the second hint counts as a miss
    if (c.tries === 0) { S.done++; (S.kinds ||= new Set()).add(c.x.key); noteKind('imp', c.x.key, ok); if (ok) S.good++; else { S.missed.push(c.x); retryQ.push({ x: c.x, tries: 1 }); } }
    next();
  };
  function show(c) {
    const x = c.x, r = IMPB.get(x.key), options = impOptions(x.key), opts = h('div.opts'), tail = h('div'), hint = h('div.hintbox');
    const piece = (t, lab, cls = '') => t ? h('div', lg(t, cls), lab ? h('small', lab) : null) : null;
    const pieces = (lab) => h('div.ptcparts', piece(x.sp.stem, lab && 'stem'), piece(x.sp.formative, lab && 'formative'), piece(x.sp.vowel, lab && (x.sp.contract ? 'contracted vowel' : 'connecting vowel'), '.pvow'), piece(x.sp.ending, lab && 'ending'));
    const drawHint = () => {
      clear(hint); if (tail.childElementCount) return;
      const lvl = c.peek ? 2 : c.hint1 ? 1 : 0;
      if (!lvl) { hint.append(h('button.hintlink', { onclick: () => { c.hint1 = true; drawHint(); } }, 'Hint ▾')); return; }
      hint.append(h('button.hintlink', { onclick: () => { c.hint1 = false; drawHint(); }, 'aria-expanded': 'true' }, 'Hint ▴'), pieces(false),
        c.peek ? h('div.small.muted', h('div', r.desc), IMP_LOOKALIKE[x.key] ? h('div', 'It could also be a ' + IMPB.get(IMP_LOOKALIKE[x.key]).name.toLowerCase() + ': check the stem.') : null, h('div.small.warnline', 'This one will count as missed.'))
          : h('button.hintlink', { onclick: () => { c.peek = true; drawHint(); } }, 'What the pieces mean (counts as a miss)'));
    };
    options.forEach((o) => opts.append(h('button.opt', { onclick: (ev) => {
      clear(hint);
      const right = o.key === x.key; [...opts.children].forEach((b, i) => { b.disabled = true; const isR = options[i].key === x.key; b.classList.toggle('right', isR); if (b === ev.currentTarget && !isR) b.classList.add('wrong'); b.querySelector('.mark').textContent = isR ? '✓' : (b === ev.currentTarget ? '✗' : ''); });
      const btn = h('button.btn.primary.block', { onclick: () => after(c, right) }, 'Continue'), ex = explainImp(x);
      tail.append(h('div.fb.' + (right ? 'ok' : 'bad'), h('b', right ? 'Right.' : 'Not quite.'), ' ' + (right && c.peek ? 'You looked at what the pieces mean, so this counts as missed. ' : '') + ex[0],
        pieces(true), ...ex.slice(1).map((t) => h('p.small.muted', t))), btn);
      keyHandler = (e) => { if (e.key === 'Enter') { e.preventDefault(); btn.click(); } }; document.removeEventListener('keydown', keyHandler); document.addEventListener('keydown', keyHandler);
      tail.scrollIntoView({ block: 'nearest' });
    } }, h('span', o.name), h('span.mark', ''))));
    keyHandler = (e) => { const n = +e.key; if (!n) return; const b = [...view.querySelectorAll('.opt')].filter((y) => !y.disabled)[n - 1]; if (b) b.click(); }; document.addEventListener('keydown', keyHandler);
    const card = h('div.qcard', h('div.qmeta', c.tries ? 'Try again' : 'Imperative'), h('div.qask', 'Which kind of imperative is this?'), h('div.qgreek', { lang: 'grc', style: { fontSize: '1.8rem' } }, x.w),
      h('div.small.muted', { style: { textAlign: 'center' } }, 'from ', lg(x.head), x.brief ? ' · ' + x.brief : ''));
    clear(view).append(h('div.qwrap',
      h('div.qtop', h('button.btn.ghost.icon.sm', { 'aria-label': 'End practice', onclick: finish }, icon('close', 20)), h('div.bar.accent.grow', h('i', { style: { width: (100 * (S.round ? S.rk / S.R : S.shown / total)) + '%' } })),
        h('span.qcount', { 'aria-label': S.round ? 'Retry ' + S.rk + ' of ' + S.R : 'Item ' + S.shown + ' of ' + total }, S.round ? '↻ ' + S.rk + ' / ' + S.R : S.shown + ' / ' + total)),
      card, opts, tail));
    card.append(hint); drawHint();
  }
  next();
}
