// Subjunctive: a page on how to read one, a paradigm for each of the eight kinds, and a "which kind is it?" quiz on real
// subjunctives from verbs you know. Practice only: nothing here touches the review schedule.
import { D } from './data.js';
import { subjunctiveForms } from './parse.js';
import { openCharts } from './charts.js';
import { SUB, SUBB, SUB_LOOKALIKE, SUB_MP, splitSub } from './subdata.js';
import { skel, chars, isLiquid, aoristNotes } from './ptcdata.js';
import { contractType, contractSplit, pairsFrom, contractNote } from './contract.js';
import { h, clear, icon, pct, shuffle, missedBlock, backHead, backLinks } from './util.js';

const lg = (t, cls = '') => h('span' + cls, { lang: 'grc' }, t);

/* ---------- the page ---------- */
export function renderSubjunctive(view) {
  const rows = []; let last = null;
  for (const r of SUB) {
    if (r.fam !== last) { last = r.fam; rows.push(h('div.ptcfam', r.fam)); }
    rows.push(h('div.ptcrow', h('a', { href: '#/learn/charts/subjunctive/' + r.key }, h('span', r.name + ' ›'), lg(r.forms.slice(0, 3).join(', ') + '…', '.mf')),
      h('div.ptcchips', ...(r.formative ? [lg(r.formative)] : []), lg('ω/η'))));
  }
  const pair = (lab, a, b) => h('div.subpair', h('small', lab), lg(a, '.g'));
  clear(view).append(backHead('Subjunctive', '#/learn/charts', 'Charts'), h('div.stack',
    h('a.btn.primary.block.start', { href: '#/learn/charts/subjunctive/run' }, h('b', 'Which kind is it?'), h('small', 'Practice recognizing subjunctives')),
    h('div.row.wrap.links', h('a.btn.ghost.sm', { href: '#/parse/run/sub/all' }, 'Parse some subjunctives'), h('button.btn.ghost.sm', { onclick: () => openCharts({ tab: 'endings' }) }, icon('table', 18), ' Look at the endings')),
    h('div.card.stack', h('h2', 'How to read one'),
      h('p.small', 'A subjunctive is the stem, then (in the aorist) a formative, then a ', h('b', 'long'), ' connecting vowel, ', lg('ω'), ' or ', lg('η'), ', then the primary personal endings.'),
      h('div.subcmp', pair('Indicative', 'λύομεν'), pair('Subjunctive', 'λύωμεν'), pair('Indicative', 'λύετε'), pair('Subjunctive', 'λύητε')),
      h('p.small.muted', 'The long vowel is the giveaway. It also separates the 1st aorist subjunctive from the future indicative, which has a short vowel: ', lg('λύσωμεν'), ' and ', lg('λύσομεν'), '.'),
      h('p.small.muted', 'Present and 2nd aorist share the same shape, so for those, compare the stem with the verb’s present stem.')),
    h('div.card.stack', h('h2', 'The eight kinds'), h('p.muted.small', 'Tap one to see its paradigm.'), ...rows),
    h('p.muted.small', 'The perfect subjunctive is rare (', lg('εἰδῶ'), ' and a few others), and there is no future subjunctive.')));
}

/* ---------- a paradigm ---------- */
export function renderSubParadigm(view, key) {
  const r = SUBB.get(key); if (!r) { location.hash = '#/learn/charts/subjunctive'; return; }
  const L = D.lex && D.lex.find((x) => x.head === r.verb);
  const cell = (f, lab) => {
    const nu = f.includes('(ν)'), w = f.replace('(ν)', ''), sp = splitSub(w, key);
    return h('div.pcell', h('div.small.muted.plabel', lab), h('span.pword', { lang: 'grc' }, sp ? [h('span.pstem', sp.stem), sp.formative ? h('span.pform', sp.formative) : null, h('b.pvow', sp.vowel), h('span.pend', sp.ending + (nu ? '(ν)' : ''))] : w));
  };
  const labs = ['1st sing.', '2nd sing.', '3rd sing.', '1st pl.', '2nd pl.', '3rd pl.'];
  clear(view).append(backHead('Paradigm', '#/learn/charts/subjunctive', 'Subjunctive'), h('div.stack',
    h('div.row.wrap', h('span.chip.accent', r.name + ' subjunctive')),
    h('div.card.stack', h('div.row.wrap.small.muted', h('span', 'stem'), r.formative ? h('span.pform', 'formative') : null, h('b.pvow', 'connecting vowel'), h('span.pend', 'ending')),
      h('div.pgrid.ppara', r.forms.map((f, i) => cell(f, labs[i])))),
    h('p.muted.small', h('b', 'Verb: '), lg(r.verb), L && L.brief ? ' · ' + L.brief + '. ' : '. ', r.desc),
    r.key === 'aor1-act' ? h('p.small', 'Compare the future indicative: ', lg('λύσω, λύσεις, λύσει, λύσομεν, λύσετε, λύσουσι(ν)'), '.') : null,
    h('div.row.wrap', h('a.btn.primary', { href: '#/learn/charts/subjunctive/run/' + r.key }, 'Which kind is it?'), h('a.btn', { href: '#/parse/run/sub/' + r.key }, 'Parse forms like this'))));
}

/* ---------- the quiz ---------- */
let keyHandler = null;
const stop = () => { if (keyHandler) { document.removeEventListener('keydown', keyHandler); keyHandler = null; } };
const ROUND = 12;

/** The split of a subjunctive of the text: contract presents through the merge engine, everything else through the kind's pattern. */
export function splitX(x) {
  if (/^pres/.test(x.key) && contractType(x.head)) { const c = contractSplit(x.w, x.head, pairsFrom(SUBB.get(x.key).set)); return c && { stem: c.stem, formative: '', vowel: c.vowel, ending: c.ending, stemSkel: c.stemSkel, contract: c.contract }; }
  return splitSub(x.w, x.key, { liquid: isLiquid(x.head) });
}
/** About a dozen subjunctives spread over the kinds, the commonest of each; only forms the splitter understands. */
export function subQueue(only = null) {
  const by = new Map();
  for (const x of subjunctiveForms(only, { ignoreLevel: true })) {
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
export function subOptions(key) {
  const me = SUBB.get(key), word = (r, w) => r.name.toLowerCase().includes(w);
  const score = (r) => (r.key === SUB_LOOKALIKE[key] ? 5 : 0) + (r.fam === me.fam ? 1 : 0) + (['active', 'middle', 'passive'].some((w) => word(r, w) && word(me, w)) ? 2 : 0) + Math.random() * 0.9;
  const others = SUB.filter((r) => r.key !== key).sort((a, b) => score(b) - score(a)).slice(0, 3);
  return shuffle([me, ...others]);
}
const presentStem = (head) => skel(head).replace(/(ομαι|μαι|ω)$/, '');
/** The form that is spelled the same in the indicative, if there is one. */
function sameAs(x) {
  const v = skel(x.sp.vowel), none = !x.sp.ending;
  if (x.key === 'pres-act' && v === 'ω' && none) return 'the present indicative';
  if (x.key === 'aor1-act' && v === 'ω' && none) return 'the future indicative';
  if (x.key === 'pres-mp' && v === 'η' && none) return 'the present middle/passive indicative';
  if (x.key === 'aor1-mid' && v === 'η' && none) return 'the future middle indicative';
  return null;
}
/** What to say after an answer: what marks the kind, the long vowel, the look-alike stem comparison and the notes. */
export function explainSub(x) {
  const r = SUBB.get(x.key), sp = x.sp, bits = [r.name + ': ' + (r.formative ? 'formative ' + r.formative + ', then ' : '') + 'the long vowel ' + skel(sp.vowel) + (sp.ending ? ' and the ending ' + sp.ending : '') + '.'];
  if (sp.contract) { bits[0] = r.name + ': the stem, the contracted vowel and the ending.'; bits.push('The long vowel is part of the contraction, so look for it in the merged vowel.', contractNote(sp, x.head), 'The stem ' + sp.stemSkel + '- is the present stem of ' + x.head + ', so it is a present.'); if (SUB_MP.has(x.key)) bits.push('Middle and passive look the same here; the context decides.'); return bits; }
  const sa = sameAs(x);
  bits.push(sa ? 'This form is spelled the same as ' + sa + '; the context (often a ἵνα, ἐάν or ὅταν clause) shows it is a subjunctive.'
    : 'The long vowel makes it a subjunctive' + (x.key.endsWith('pas') ? '.' : ' (the indicative has a short ' + (skel(sp.vowel) === 'ω' ? 'ο' : 'ε') + ' here).') + (r.formative ? ' The ' + r.formative + ' before it marks the ' + (r.formative === 'σ' ? '1st aorist.' : 'passive.') : ''));
  if (SUB_LOOKALIKE[x.key]) {
    const ps = presentStem(x.head), same = sp.stemSkel === ps, pres = x.key.startsWith('pres');
    bits.push('Present and 2nd aorist look alike, so the stem decides. ' + (pres ? (same ? 'The stem here is ' + sp.stemSkel + '-, the same as the present stem of ' + x.head + ', so it is a present.' : 'The stem here is ' + sp.stemSkel + '-.')
      : (same ? 'The stem here is ' + sp.stemSkel + '-.' : 'The stem here is ' + sp.stemSkel + '-, not the present stem ' + ps + '- of ' + x.head + ', so it is a 2nd aorist.')));
  }
  bits.push(...aoristNotes(sp));
  if (SUB_MP.has(x.key)) bits.push('Middle and passive look the same here; the context decides.');
  return bits;
}

export function runSubDrill(view, only = null) {
  const back = only && SUBB.get(only) ? '#/learn/charts/subjunctive/' + only : '#/learn/charts/subjunctive';
  const queue = subQueue(SUBB.has(only) ? only : null).map((x) => ({ x, tries: 0 }));
  if (!queue.length) {
    clear(view).append(backHead('Which kind is it?', back, 'Subjunctive'), h('div.card.stack',
      h('p', 'There are no subjunctives to practice yet in verbs you know. They appear as you learn more vocabulary.'), h('a.btn', { href: back }, 'Back to Subjunctive')));
    return;
  }
  const total = queue.length, retryQ = [], S = { shown: 0, done: 0, good: 0, missed: [], round: 0, R: 0, rk: 0 };
  const finish = () => {
    stop();
    clear(view).append(h('div.pagehead', h('h1', 'Practice complete')),
      h('div.card.stack', h('p.muted.small', 'Practice only: your review schedule is unchanged.'),
        h('div.kpis', h('div.kpi', h('b', S.done), h('span', 'subjunctives')), h('div.kpi', h('b', S.done ? pct(S.good / S.done) : '—'), h('span', 'right first time'))),
        missedBlock(S.missed.map((x) => ({ word: x.w, greek: true, sub: SUBB.get(x.key).name, why: null })), () => { const again = S.missed.map((x) => ({ x, tries: 1 })); S.missed = []; queue.length = 0; queue.push(...again); S.shown = 0; S.round = 0; next(); }),
        h('div.row.wrap', h('a.btn.primary', { href: '#/learn/charts/subjunctive' }, 'Back to Subjunctive'), ...backLinks('#/learn', 'Back to Learn'))));
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
    const x = c.x, r = SUBB.get(x.key), options = subOptions(x.key), opts = h('div.opts'), tail = h('div'), hint = h('div.hintbox');
    const piece = (t, lab, cls = '') => t ? h('div', lg(t, cls), lab ? h('small', lab) : null) : null;
    const pieces = (lab) => h('div.ptcparts', piece(x.sp.stem, lab && 'stem'), piece(x.sp.formative, lab && 'formative'), piece(x.sp.vowel, lab && (x.sp.contract ? 'contracted vowel' : 'connecting vowel'), '.pvow'), piece(x.sp.ending, lab && 'ending'));
    const drawHint = () => {
      clear(hint); if (tail.childElementCount) return;
      const lvl = c.peek ? 2 : c.hint1 ? 1 : 0;
      if (!lvl) { hint.append(h('button.hintlink', { onclick: () => { c.hint1 = true; drawHint(); } }, 'Hint ▾')); return; }
      hint.append(h('button.hintlink', { onclick: () => { c.hint1 = false; drawHint(); }, 'aria-expanded': 'true' }, 'Hint ▴'), pieces(false),
        c.peek ? h('div.small.muted', h('div', r.desc), SUB_LOOKALIKE[x.key] ? h('div', 'It could also be a ' + SUBB.get(SUB_LOOKALIKE[x.key]).name.toLowerCase() + ': check the stem.') : null, h('div.small.warnline', 'This one will count as missed.'))
          : h('button.hintlink', { onclick: () => { c.peek = true; drawHint(); } }, 'What the pieces mean (counts as a miss)'));
    };
    options.forEach((o) => opts.append(h('button.opt', { onclick: (ev) => {
      clear(hint);
      const right = o.key === x.key; [...opts.children].forEach((b, i) => { b.disabled = true; const isR = options[i].key === x.key; b.classList.toggle('right', isR); if (b === ev.currentTarget && !isR) b.classList.add('wrong'); b.querySelector('.mark').textContent = isR ? '✓' : (b === ev.currentTarget ? '✗' : ''); });
      const btn = h('button.btn.primary.block', { onclick: () => after(c, right) }, 'Continue'), ex = explainSub(x);
      tail.append(h('div.fb.' + (right ? 'ok' : 'bad'), h('b', right ? 'Right.' : 'Not quite.'), ' ' + (right && c.peek ? 'You looked at what the pieces mean, so this counts as missed. ' : '') + ex[0],
        pieces(true), ...ex.slice(1).map((t) => h('p.small.muted', t))), btn);
      keyHandler = (e) => { if (e.key === 'Enter') { e.preventDefault(); btn.click(); } }; document.removeEventListener('keydown', keyHandler); document.addEventListener('keydown', keyHandler);
      tail.scrollIntoView({ block: 'nearest' });
    } }, h('span', o.name), h('span.mark', ''))));
    keyHandler = (e) => { const n = +e.key; if (!n) return; const b = [...view.querySelectorAll('.opt')].filter((y) => !y.disabled)[n - 1]; if (b) b.click(); }; document.addEventListener('keydown', keyHandler);
    const card = h('div.qcard', h('div.qmeta', c.tries ? 'Try again' : 'Subjunctive'), h('div.qask', 'Which kind of subjunctive is this?'), h('div.qgreek', { lang: 'grc', style: { fontSize: '1.8rem' } }, x.w),
      h('div.small.muted', { style: { textAlign: 'center' } }, 'from ', lg(x.head), x.brief ? ' · ' + x.brief : ''));
    clear(view).append(h('div.qwrap',
      h('div.qtop', h('button.btn.ghost.icon.sm', { 'aria-label': 'End practice', onclick: finish }, icon('close', 20)), h('div.bar.accent.grow', h('i', { style: { width: (100 * (S.round ? S.rk / S.R : S.shown / total)) + '%' } })),
        h('span.qcount', { 'aria-label': S.round ? 'Retry ' + S.rk + ' of ' + S.R : 'Item ' + S.shown + ' of ' + total }, S.round ? '↻ ' + S.rk + ' / ' + S.R : S.shown + ' / ' + total)),
      card, opts, tail));
    card.append(hint); drawHint();
  }
  next();
}
