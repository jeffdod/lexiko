// Participles: a page that teaches how to read one, a paradigm page for each of the ten kinds, and a "which kind is it?" quiz
// on real participles from verbs you know. Practice only: nothing here touches the review schedule.
import { D } from './data.js';
import { participleForms } from './parse.js';
import { noteParticiple, ptcDrillStats, ptcDrillKnown, formLevel, ptcLevel } from './know.js';
import { openCharts } from './charts.js';
import { PTC, PTCB, CELL_ROWS, modelForm, split, skel, chars, isLiquid, aoristNotes, FORMATIVE_MEANING, MORPHEME_MEANING, LOOKALIKE } from './ptcdata.js';
import { contractType, contractSplit, pairsFrom, contractNote } from './contract.js';
import { miClass, miSplit, explainMi } from './midata.js';
import { tailsOf } from './ptcdata.js';
import { h, clear, icon, pct, shuffle, missedBlock, backHead, backLinks, toast } from './util.js';

const lg = (t, cls = '') => h('span' + cls, { lang: 'grc' }, t);
const stemOf = (r) => chars(r.forms[0][0]).slice(0, r.stemLen).join('');

/* ---------- the page ---------- */
export function renderParticiples(view) {
  const fam = [];
  let last = null;
  for (const r of PTC) {
    if (r.fam !== last) { last = r.fam; fam.push(h('div.ptcfam', r.fam)); }
    fam.push(h('div.ptcrow', h('a', { href: '#/learn/charts/participle/' + r.key }, h('span', r.name + ' ›'), lg(modelForm(r), '.mf')),
      h('div.ptcchips', lg(r.form || '—'), lg(r.morph))));      // name and model form on the left, the two pieces on the right
  }
  clear(view).append(backHead('Participles', '#/reference', 'Reference'), h('div.stack',
    h('a.btn.sm.practice', { href: '#/learn/charts/participles/run' }, 'Practice this ›'),
    h('div.row.wrap.links', h('a.btn.ghost.sm', { href: '#/parse/run/ptc/all' }, 'Parse some participles'), h('button.btn.ghost.sm', { onclick: () => openCharts({ tab: 'part' }) }, icon('table', 18), ' Look at the chart')),
    h('div.card.stack', h('h2', '1 · The morpheme: voice and endings'),
      h('div.ptcthree', [['ντ', '3-1-3', 'active, and the aorist passive'], ['οτ', '3-1-3', 'perfect active'], ['μενο/η', '2-1-2', 'middle or passive (middle only in the aorists)']]
        .map(([m, p, d]) => h('div', h('i', p), lg(m, '.m'), h('span', d))))),
    h('div.card.stack', h('h2', '2 · The formative: tense'),
      h('div.ptcrows', [['ο', 'present; 2nd aorist active and middle'], ['σα', '1st aorist active and middle'], ['θε', '1st aorist passive'], ['ε', '2nd aorist passive'], ['κ', 'perfect active (a perfect also reduplicates)']]
        .map(([f, u]) => h('div', lg(f, '.g'), h('span', u)))),
      h('p.muted.small', 'Present and 2nd aorist share ο, so for those, compare the stem with the verb’s present stem.')),
    h('div.card.stack', h('h2', 'The ten kinds'), h('p.muted.small', 'Tap one to see its paradigm.'), ...fam),
    h('p.muted.small', 'Model forms are the nominative plural masculine. Future participles are rare: the future stem with the present active’s endings (', lg('λύσων, λύσουσα, λῦσον'), ').')));
}

/* ---------- a paradigm ---------- */
export function renderPtcParadigm(view, key) {
  const r = PTCB.get(key); if (!r) { location.hash = '#/learn/charts/participles'; return; }
  const k = r.stemLen, cell = (f) => {
    const cs = chars(f.replace('(ν)', '')), nu = f.includes('(ν)');
    return h('td', { lang: 'grc' }, cs.slice(0, k).join(''), h('b.pend', cs.slice(k).join('') + (nu ? '(ν)' : '')));
  };
  const L = D.lexByN.get(D.lex && D.lex.find((x) => x.head === r.verb) ? D.lex.find((x) => x.head === r.verb).n : 0);
  clear(view).append(backHead('Paradigm', '#/learn/charts/participles', 'Participles'), h('div.stack',
    h('div.row.wrap', h('span.chip.accent', r.name + ' participle')),
    h('div.card', h('div.cscroll', h('table.ctable.ptctable', h('thead', h('tr', ['', 'Masc.', 'Fem.', 'Neut.'].map((c) => h('th', c)))),
      h('tbody', r.forms.map((cells, i) => h('tr' + (i === 4 ? '.sep' : ''), h('th', { scope: 'row' }, CELL_ROWS[i]), cells.map(cell))))))),
    h('p.muted.small', h('b', 'Verb: '), lg(r.verb), L && L.brief ? ' · ' + L.brief + '. ' : '. ',
      'Stem ', lg(stemOf(r)), r.form ? ', formative ' : ', no formative', r.form ? lg(r.form) : null, ', morpheme ', lg(r.morph), ' (', MORPHEME_MEANING[r.morph].replace(/;.*/, ''), ').'),
    r.key === 'perf-act' ? h('p.muted.small', 'The perfect active is the irregular one: it has κως, κυια, κος in the nominative, and κοτος in the genitive.') : null,
    h('div.row.wrap', h('a.btn.primary', { href: '#/learn/charts/participles/run/' + r.key }, 'Which kind is it?'), h('a.btn', { href: '#/parse/run/ptc/' + r.key }, 'Parse forms like this'),
      h('button.btn', { onclick: () => openCharts({ highlight: { kind: 'part', key: r.key } }) }, icon('table', 18), ' See it in the chart'))));
}

/* ---------- the quiz ---------- */
let keyHandler = null;
const stop = () => { if (keyHandler) { document.removeEventListener('keydown', keyHandler); keyHandler = null; } };
const ROUND = 12;
/** Present-system verbs whose stem vowel merges with the connecting vowel (ποιέω, ἀγαπάω, πληρόω) or that are -μι verbs: their stems can't be read off by the plain pattern, so they stay out of this quiz. */
/** The split of a participle of the text: contract presents through the merge engine, everything else through the kind's own pattern. */
export function splitX(x) {
  if (miClass(x.head) && /^(pres|aor2)-(act|mp|mid)$/.test(x.key)) { const m = miSplit(x.w, x.head, x.key, 'ptc'); return m && { stem: '', formative: '', rest: '', stemSkel: '', ...m }; }
  if (/^pres/.test(x.key) && contractType(x.head)) { const c = contractSplit(x.w, x.head, pairsFrom(tailsOf(PTCB.get(x.key)))); return c && { stem: c.stem, formative: c.vowel, rest: c.ending, stemSkel: c.stemSkel, contract: c.contract }; }
  return split(x.w, x.key, { liquid: isLiquid(x.head) });
}
export const CONTRACT = /(αω|εω|οω|αομαι|εομαι|οομαι|μι)$/;

/** About a dozen participles spread over the kinds, the commonest of each; only forms the splitter understands. */
export function ptcQueue(only = null) {
  const by = new Map();
  for (const x of participleForms(only, { ignoreLevel: true })) { const sp = splitX(x); if (!sp) continue; if (!by.has(x.key)) by.set(x.key, []); by.get(x.key).push({ ...x, sp }); }
  if (!by.size) return [];
  const lists = shuffle([...by.keys()]).map((k) => shuffle(by.get(k).sort((a, b) => b.count - a.count).slice(0, 12)));
  const out = [];
  for (let i = 0; out.length < ROUND && lists.some((l) => l.length > i); i++) for (const l of lists) if (l[i] && out.length < ROUND) out.push(l[i]);
  return shuffle(out);
}
/** Three other kinds to offer: first the look-alike (same formative and morpheme), then ones that share a piece. */
export function ptcOptions(key) {
  const me = PTCB.get(key), score = (r) => (r.key === LOOKALIKE[key] ? 5 : 0) + (r.form === me.form ? 2 : 0) + (r.morph === me.morph ? 1 : 0) + Math.random() * 0.9;
  const others = PTC.filter((r) => r.key !== key).sort((a, b) => score(b) - score(a)).slice(0, 3);
  return shuffle([me, ...others]);
}
const presentStem = (head) => skel(head).replace(/(ομαι|μαι|ω)$/, '');
/** What to say after an answer: the pieces, and the stem comparison when present and 2nd aorist look alike. */
export function explain(x) {
  const r = PTCB.get(x.key), { sp } = x;
  if (sp.mi) return explainMi(sp, r, x.head);
  const bits = [r.name + ': ' + (r.form ? 'formative ' + r.form : 'no formative') + ', morpheme ' + r.morph + '.'];
  if (sp.contract) { bits[0] = r.name + ': the stem, the contracted vowel and the ending.'; bits.push(contractNote(sp, x.head), 'The stem ' + sp.stemSkel + '- is the present stem of ' + x.head + ', so it is a present.'); return bits; }
  if (r.form && r.morph === 'ντ' && skel(sp.formative) !== skel(r.form) && /^(ω|ου)$/.test(skel(sp.formative))) bits[0] += ' In this form the ντ has changed or dropped out, so the ο shows as ' + sp.formative.normalize('NFD').replace(/[̀-ͯ]/g, '').normalize('NFC') + '.';
  if (LOOKALIKE[x.key]) {
    const ps = presentStem(x.head), same = sp.stemSkel === ps || sp.stemSkel.replace(/σσ/g, 'ττ') === ps;
    const pres = x.key.startsWith('pres');
    bits.push(r.form + ' + ' + r.morph + ' fits both a present and a 2nd aorist. The stem decides: here it is ' + sp.stemSkel + '-, and the present stem of ' + x.head + ' is ' + ps + '-'
      + (pres && same ? ', the same, so it is a present.' : !pres && !same ? ', different, so it is a 2nd aorist.' : '.'));
  }
  bits.push(...aoristNotes(sp));
  return bits;
}

/** Where you stand on opening participles in daily parsing. */
function gateLine() {
  if (formLevel() >= ptcLevel()) return h('p.muted.small', 'Participles are open in daily parsing.');
  const s = ptcDrillStats(), need = Math.max(0, 15 - s.n);
  return h('p.small', h('b', 'Opening participles in daily parsing: '), need ? 'answer ' + need + ' more participles here, then lexiko checks whether you are at 85% or better.' : 'you are at ' + pct(s.acc) + ' over your last ' + s.n + ' answers. At 85% or better they open.');
}

export function runPtcDrill(view, only = null) {
  const queue = ptcQueue(only).map((x) => ({ x, tries: 0 }));
  if (!queue.length) {
    clear(view).append(backHead('Which kind is it?', '#/learn/charts/participles', 'Participles'), h('div.card.stack',
      h('p', 'There are no participles to practice yet in verbs you know. They appear as you learn more vocabulary.'), h('a.btn', { href: '#/learn/charts/participles' }, 'Back to Participles')));
    return;
  }
  const total = queue.length, retryQ = [], S = { shown: 0, done: 0, good: 0, missed: [], round: 0, R: 0, rk: 0 };
  const finish = () => {
    stop();
    clear(view).append(h('div.pagehead', h('h1', 'Practice complete')),
      h('div.card.stack', h('p.muted.small', 'Practice only: your review schedule is unchanged.'), gateLine(),
        h('div.kpis', h('div.kpi', h('b', S.done), h('span', 'participles')), h('div.kpi', h('b', S.done ? pct(S.good / S.done) : '—'), h('span', 'right first time'))),
        missedBlock(S.missed.map((x) => ({ word: x.w, greek: true, sub: PTCB.get(x.key).name, why: null })), () => { const again = S.missed.map((x) => ({ x, tries: 1 })); S.missed = []; queue.length = 0; queue.push(...again); S.shown = 0; S.round = 0; next(); }),
        h('div.row.wrap', h('a.btn.primary', { href: only ? '#/learn/charts/participle/' + only : '#/learn/charts/participles' }, only ? 'Back to the paradigm' : 'Back to Participles'), ...backLinks('#/home', 'Back to Home'))));
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
    if (c.tries === 0) {
      S.done++; if (ok) S.good++; else { S.missed.push(c.x); retryQ.push({ x: c.x, tries: 1 }); }
      noteParticiple(ok).then((lv) => { if (lv) toast('Participles are now open in daily parsing.', 8000); });
    }
    next();
  };
  function show(c) {
    const x = c.x, r = PTCB.get(x.key), options = ptcOptions(x.key), opts = h('div.opts'), tail = h('div'), hint = h('div.hintbox');
    const piece = (t, lab) => h('div', lg(t || '·'), lab ? h('small', lab) : null);
    const pieces = (lab) => x.sp.mi ? h('div.ptcparts', piece(x.sp.mi.prefix, lab && 'prefix'), piece(x.sp.mi.redup, lab && 'reduplication'), piece(x.sp.mi.root, lab && 'root'), piece(x.sp.mi.ending, lab && 'ending')) : h('div.ptcparts', piece(x.sp.stem, lab && 'stem'), piece(x.sp.formative || '—', lab && (x.sp.contract ? 'contracted vowel' : 'formative')), piece(x.sp.rest, lab && 'morpheme + ending'));
    const drawHint = () => {
      clear(hint); if (tail.childElementCount) return;
      const lvl = c.peek ? 2 : c.hint1 ? 1 : 0;
      if (!lvl) { hint.append(h('button.hintlink', { onclick: () => { c.hint1 = true; drawHint(); } }, 'Hint ▾')); return; }
      hint.append(h('button.hintlink', { onclick: () => { c.hint1 = false; c.peek = c.peek; drawHint(); }, 'aria-expanded': 'true' }, 'Hint ▴'), pieces(false),
        c.peek ? h('div.small.muted', h('div', lg(r.form || '—', '.hintgrc'), ': ' + FORMATIVE_MEANING[r.form]), h('div', lg(r.morph, '.hintgrc'), ': ' + MORPHEME_MEANING[r.morph].replace(/;.*/, '')), h('div.small.warnline', 'This one will count as missed.'))
          : h('button.hintlink', { onclick: () => { c.peek = true; drawHint(); } }, 'What the pieces mean (counts as a miss)'));
    };
    options.forEach((o) => opts.append(h('button.opt', { onclick: (ev) => {
      clear(hint);
      const right = o.key === x.key; [...opts.children].forEach((b, i) => { b.disabled = true; const isR = options[i].key === x.key; b.classList.toggle('right', isR); if (b === ev.currentTarget && !isR) b.classList.add('wrong'); b.querySelector('.mark').textContent = isR ? '✓' : (b === ev.currentTarget ? '✗' : ''); });
      const btn = h('button.btn.primary.block', { onclick: () => after(c, right) }, 'Continue'), ex = explain(x);
      tail.append(h('div.fb.' + (right ? 'ok' : 'bad'), h('b', right ? 'Right.' : 'Not quite.'), ' ' + (right && c.peek ? 'You looked at what the pieces mean, so this counts as missed. ' : '') + ex[0],
        pieces(true), ex[1] ? h('p.small.muted', ex[1]) : null), btn);
      keyHandler = (e) => { if (e.key === 'Enter') { e.preventDefault(); btn.click(); } }; document.removeEventListener('keydown', keyHandler); document.addEventListener('keydown', keyHandler);
      tail.scrollIntoView({ block: 'nearest' });
    } }, h('span', o.name), h('span.mark', ''))));
    keyHandler = (e) => { const n = +e.key; if (!n) return; const b = [...view.querySelectorAll('.opt')].filter((y) => !y.disabled)[n - 1]; if (b) b.click(); }; document.addEventListener('keydown', keyHandler);
    const card = h('div.qcard', h('div.qmeta', c.tries ? 'Try again' : 'Participles'), h('div.qask', 'Which kind of participle is this?'), h('div.qgreek', { lang: 'grc', style: { fontSize: '1.8rem' } }, x.w),
      h('div.small.muted', { style: { textAlign: 'center' } }, 'from ', lg(x.head), x.brief ? ' · ' + x.brief : ''));
    clear(view).append(h('div.qwrap',
      h('div.qtop', h('button.btn.ghost.icon.sm', { 'aria-label': 'End practice', onclick: finish }, icon('close', 20)), h('div.bar.accent.grow', h('i', { style: { width: (100 * (S.round ? S.rk / S.R : S.shown / total)) + '%' } })),
        h('span.qcount', { 'aria-label': S.round ? 'Retry ' + S.rk + ' of ' + S.R : 'Item ' + S.shown + ' of ' + total }, S.round ? '↻ ' + S.rk + ' / ' + S.R : S.shown + ' / ' + total)),
      card, opts, tail));
    card.append(hint); drawHint();
  }
  next();
}
