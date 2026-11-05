// Infinitives: a page on how to read one, and a "which kind is it?" quiz on real infinitives from verbs you know.
// Practice only: nothing here touches the review schedule.
import { infinitiveForms } from './parse.js';
import { openCharts } from './charts.js';
import { INF, INFB, INF_LOOKALIKE, INF_MP, splitInf } from './infdata.js';
import { skel, isLiquid, aoristNotes } from './ptcdata.js';
import { contractType, contractSplit, contractNote } from './contract.js';
import { miClass, miSplit, explainMi } from './midata.js';
import { h, clear, icon, pct, shuffle, missedBlock, backHead, backLinks } from './util.js';

const lg = (t, cls = '') => h('span' + cls, { lang: 'grc' }, t);

/* ---------- the page ---------- */
export function renderInfinitives(view) {
  const rows = []; let last = null;
  for (const r of INF) {
    if (r.fam !== last) { last = r.fam; rows.push(h('div.ptcfam', r.fam)); }
    rows.push(h('div.ptcrow', h('div.infname', h('span', r.name), h('span.mf', { lang: 'grc' }, r.model), h('span.mf.en', r.gloss)), h('div.ptcchips', lg(r.ending))));
  }
  clear(view).append(backHead('Infinitives', '#/learn/charts', 'Charts'), h('div.stack',
    h('a.btn.primary.block.start', { href: '#/learn/charts/infinitives/run' }, h('b', 'Which kind is it?'), h('small', 'Practice recognizing infinitives')),
    h('div.row.wrap.links', h('a.btn.ghost.sm', { href: '#/parse/run/inf/all' }, 'Parse some infinitives'), h('button.btn.ghost.sm', { onclick: () => openCharts({ tab: 'inf' }) }, icon('table', 18), ' Look at the chart')),
    h('div.card.stack', h('h2', 'How to read one'),
      h('p.small', 'An infinitive is a stem plus one ending, and the ending tells you the tense and voice. It has no person, number, case or gender.'),
      h('p.small.muted', 'Present and 2nd aorist share endings (', lg('-ειν'), ', ', lg('-εσθαι'), '), so for those, compare the stem with the verb’s present stem.')),
    h('div.card.stack', h('h2', 'The ten kinds'), h('p.muted.small', 'The ending to remember, and a model form with its meaning.'), ...rows),
    h('p.muted.small', 'Future infinitives are rare: the future stem with the present endings (', lg('λύσειν, λύσεσθαι, λυθήσεσθαι'), ').')));
}

/* ---------- the quiz ---------- */
let keyHandler = null;
const stop = () => { if (keyHandler) { document.removeEventListener('keydown', keyHandler); keyHandler = null; } };
const ROUND = 12;

/** The split of an infinitive of the text: contract presents through the merge engine, everything else through the kind's ending. */
export function splitX(x) {
  if (miClass(x.head) && /^(pres|aor2)-(act|mp|mid)$/.test(x.key)) { const m = miSplit(x.w, x.head, x.key, 'inf'); return m && { stem: '', ending: '', stemSkel: '', ...m }; }
  if (/^pres/.test(x.key) && contractType(x.head)) {
    const c = contractSplit(x.w, x.head, [['ε', x.key === 'pres-act' ? 'ν' : 'σθαι']]);
    return c && { stem: c.stem, ending: c.vowel + c.ending, stemSkel: c.stemSkel, contract: c.contract };
  }
  return splitInf(x.w, x.key, { liquid: isLiquid(x.head) });
}
/** About a dozen infinitives spread over the kinds, the commonest of each; only forms the splitter understands. */
export function infQueue(only = null) {
  const by = new Map();
  for (const x of infinitiveForms(only, { ignoreLevel: true })) {      // practice only, so any verb you know counts, whatever parsing level you are on
    const sp = splitX(x); if (!sp) continue;
    if (!by.has(x.key)) by.set(x.key, []); by.get(x.key).push({ ...x, sp });
  }
  if (!by.size) return [];
  const lists = shuffle([...by.keys()]).map((k) => shuffle(by.get(k).sort((a, b) => b.count - a.count).slice(0, 12)));
  const out = [];
  for (let i = 0; out.length < ROUND && lists.some((l) => l.length > i); i++) for (const l of lists) if (l[i] && out.length < ROUND) out.push(l[i]);
  return shuffle(out);
}
/** Three other kinds to offer: first the look-alike (same ending), then ones that share the tense or the voice. */
export function infOptions(key) {
  const me = INFB.get(key), word = (r, w) => r.name.toLowerCase().includes(w);
  const score = (r) => (r.key === INF_LOOKALIKE[key] ? 5 : 0) + (r.fam === me.fam ? 1 : 0) + (['active', 'middle', 'passive'].some((w) => word(r, w) && word(me, w)) ? 2 : 0) + Math.random() * 0.9;
  const others = INF.filter((r) => r.key !== key).sort((a, b) => score(b) - score(a)).slice(0, 3);
  return shuffle([me, ...others]);
}
const presentStem = (head) => skel(head).replace(/(ομαι|μαι|ω)$/, '');
/** What to say after an answer: the ending, the stem comparison where present and 2nd aorist look alike, and the middle/passive note. */
export function explainInf(x) {
  const r = INFB.get(x.key);
  if (x.sp.mi) return explainMi(x.sp, r, x.head);
  const bits = [r.name + ': ending ' + r.ending + '.'];
  if (x.sp.contract) { bits[0] = r.name + ': the stem and the contracted ending.'; bits.push(contractNote(x.sp, x.head), 'The stem ' + x.sp.stemSkel + '- is the present stem of ' + x.head + ', so it is a present.'); if (INF_MP.has(x.key)) bits.push('Middle and passive look the same here; the context decides.'); return bits; }
  if (INF_LOOKALIKE[x.key]) {
    const ps = presentStem(x.head), same = x.sp.stemSkel === ps, pres = x.key.startsWith('pres');
    bits.push(r.ending + ' fits both a present and a 2nd aorist, so the stem decides. '
      + (pres ? (same ? 'The stem here is ' + x.sp.stemSkel + '-, the same as the present stem of ' + x.head + ', so it is a present.' : 'The stem here is ' + x.sp.stemSkel + '-.')
        : (same ? 'The stem here is ' + x.sp.stemSkel + '-.' : 'The stem here is ' + x.sp.stemSkel + '-, not the present stem ' + ps + '- of ' + x.head + ', so it is a 2nd aorist.')));
  }
  bits.push(...aoristNotes(x.sp));
  if (INF_MP.has(x.key)) bits.push('Middle and passive look the same here; the context decides.');
  return bits;
}

export function runInfDrill(view, only = null) {
  const queue = infQueue(only).map((x) => ({ x, tries: 0 }));
  if (!queue.length) {
    clear(view).append(backHead('Which kind is it?', '#/learn/charts/infinitives', 'Infinitives'), h('div.card.stack',
      h('p', 'There are no infinitives to practice yet in verbs you know. They appear as you learn more vocabulary.'), h('a.btn', { href: '#/learn/charts/infinitives' }, 'Back to Infinitives')));
    return;
  }
  const total = queue.length, retryQ = [], S = { shown: 0, done: 0, good: 0, missed: [], round: 0, R: 0, rk: 0 };
  const finish = () => {
    stop();
    clear(view).append(h('div.pagehead', h('h1', 'Practice complete')),
      h('div.card.stack', h('p.muted.small', 'Practice only: your review schedule is unchanged.'),
        h('div.kpis', h('div.kpi', h('b', S.done), h('span', 'infinitives')), h('div.kpi', h('b', S.done ? pct(S.good / S.done) : '—'), h('span', 'right first time'))),
        missedBlock(S.missed.map((x) => ({ word: x.w, greek: true, sub: INFB.get(x.key).name, why: null })), () => { const again = S.missed.map((x) => ({ x, tries: 1 })); S.missed = []; queue.length = 0; queue.push(...again); S.shown = 0; S.round = 0; next(); }),
        h('div.row.wrap', h('a.btn.primary', { href: '#/learn/charts/infinitives' }, 'Back to Infinitives'), ...backLinks('#/learn', 'Back to Learn'))));
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
    if (c.tries === 0) { S.done++; if (ok) S.good++; else { S.missed.push(c.x); retryQ.push({ x: c.x, tries: 1 }); } }
    next();
  };
  function show(c) {
    const x = c.x, r = INFB.get(x.key), options = infOptions(x.key), opts = h('div.opts'), tail = h('div'), hint = h('div.hintbox');
    const piece = (t, lab) => h('div', lg(t), lab ? h('small', lab) : null);
    const pieces = (lab) => x.sp.mi ? h('div.ptcparts', piece(x.sp.mi.prefix, lab && 'prefix'), piece(x.sp.mi.redup, lab && 'reduplication'), piece(x.sp.mi.root, lab && 'root'), piece(x.sp.mi.ending, lab && 'ending')) : h('div.ptcparts', piece(x.sp.stem, lab && 'stem'), piece(x.sp.ending, lab && 'ending'));
    const drawHint = () => {
      clear(hint); if (tail.childElementCount) return;
      const lvl = c.peek ? 2 : c.hint1 ? 1 : 0;
      if (!lvl) { hint.append(h('button.hintlink', { onclick: () => { c.hint1 = true; drawHint(); } }, 'Hint ▾')); return; }
      hint.append(h('button.hintlink', { onclick: () => { c.hint1 = false; drawHint(); }, 'aria-expanded': 'true' }, 'Hint ▴'), pieces(false),
        c.peek ? h('div.small.muted', h('div', lg(r.ending, '.hintgrc'), ': ' + r.name.toLowerCase() + (INF_LOOKALIKE[x.key] ? ', or ' + INFB.get(INF_LOOKALIKE[x.key]).name.toLowerCase() : '')), h('div.small.warnline', 'This one will count as missed.'))
          : h('button.hintlink', { onclick: () => { c.peek = true; drawHint(); } }, 'What the ending means (counts as a miss)'));
    };
    options.forEach((o) => opts.append(h('button.opt', { onclick: (ev) => {
      clear(hint);
      const right = o.key === x.key; [...opts.children].forEach((b, i) => { b.disabled = true; const isR = options[i].key === x.key; b.classList.toggle('right', isR); if (b === ev.currentTarget && !isR) b.classList.add('wrong'); b.querySelector('.mark').textContent = isR ? '✓' : (b === ev.currentTarget ? '✗' : ''); });
      const btn = h('button.btn.primary.block', { onclick: () => after(c, right) }, 'Continue'), ex = explainInf(x);
      tail.append(h('div.fb.' + (right ? 'ok' : 'bad'), h('b', right ? 'Right.' : 'Not quite.'), ' ' + (right && c.peek ? 'You looked at what the ending means, so this counts as missed. ' : '') + ex[0],
        pieces(true), ...ex.slice(1).map((t) => h('p.small.muted', t))), btn);
      keyHandler = (e) => { if (e.key === 'Enter') { e.preventDefault(); btn.click(); } }; document.removeEventListener('keydown', keyHandler); document.addEventListener('keydown', keyHandler);
      tail.scrollIntoView({ block: 'nearest' });
    } }, h('span', o.name), h('span.mark', ''))));
    keyHandler = (e) => { const n = +e.key; if (!n) return; const b = [...view.querySelectorAll('.opt')].filter((y) => !y.disabled)[n - 1]; if (b) b.click(); }; document.addEventListener('keydown', keyHandler);
    const card = h('div.qcard', h('div.qmeta', c.tries ? 'Try again' : 'Infinitives'), h('div.qask', 'Which kind of infinitive is this?'), h('div.qgreek', { lang: 'grc', style: { fontSize: '1.8rem' } }, x.w),
      h('div.small.muted', { style: { textAlign: 'center' } }, 'from ', lg(x.head), x.brief ? ' · ' + x.brief : ''));
    clear(view).append(h('div.qwrap',
      h('div.qtop', h('button.btn.ghost.icon.sm', { 'aria-label': 'End practice', onclick: finish }, icon('close', 20)), h('div.bar.accent.grow', h('i', { style: { width: (100 * (S.round ? S.rk / S.R : S.shown / total)) + '%' } })),
        h('span.qcount', { 'aria-label': S.round ? 'Retry ' + S.rk + ' of ' + S.R : 'Item ' + S.shown + ' of ' + total }, S.round ? '↻ ' + S.rk + ' / ' + S.R : S.shown + ' / ' + total)),
      card, opts, tail));
    card.append(hint); drawHint();
  }
  next();
}
