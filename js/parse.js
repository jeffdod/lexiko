// Parsing practice: pick the parts of a form in a fixed order (guided one-at-a-time, or quick all-at-once),
// scored per part, every valid parsing accepted, FSRS-scheduled per form, with stem-change explanations.
import { D, scopeVerses, scopeLabel, tokenPunct, tokenFlag, chapterVerses } from './data.js';
import { K, status, setting, setSetting, parseId, parseCardsDue, parseNewToday, rateParse, getParseStats, saveParseStats } from './know.js';
import { buildItem, check, gradeOf, slotOrder, slotOK, OPTIONS, SLOT_TITLE, labelOf, describe } from './parse-model.js';
import { explain } from './stem.js';
import { h, clear, shuffle, pct, icon, fmtInterval, toast } from './util.js';
import { passagePicker } from './learn.js';
import { readHref } from './reader.js';

const fmt = (n) => n.toLocaleString('en-US');
const KINDS = { all: ['verb', 'nominal'], verb: ['verb'], noun: ['nominal'] };
const KIND_TITLE = { all: 'Mixed practice', verb: 'Verbs', noun: 'Nouns, adjectives & pronouns' };

/* ---------- indexes (built once, on first use) ---------- */
const items = new Map();       // form id -> parse item | null
let keyMap = null;             // 'f:form:strongs' -> form id
let samples = null;            // form id -> [[book, ch, vs], ...]
function ensureIndex() {
  if (keyMap) return;
  keyMap = new Map();
  D.forms.forEach((f, i) => { f.id = i; keyMap.set(parseId(f), i); });
  samples = new Map();
  for (const b of D.books) for (const [ch, verses] of D.text[b.code]) for (const [vs, toks] of verses) for (const t of toks) {
    const id = t >> 4; let a = samples.get(id); if (!a) samples.set(id, (a = []));
    if (a.length < 8 && !a.some((x) => x[2] === vs && x[1] === ch && x[0] === b.code)) a.push([b.code, ch, vs]);
  }
}
const itemOf = (id) => { if (!items.has(id)) items.set(id, buildItem(D.forms[id])); return items.get(id); };
const groupOfItem = (it) => (it.kind === 'verb' ? 'verb' : 'other');

/* ---------- context sentence with the form highlighted ---------- */
function formContext(id) {
  const refs = samples.get(id) || []; if (!refs.length) return null;
  let best = null, bs = 1e9;
  for (const [code, ch, vs] of refs) {
    const v = chapterVerses(code, ch).find((x) => x[0] === vs); if (!v) continue;
    const s = Math.abs(v[1].length - 11); if (s < bs) { bs = s; best = { code, ch, vs, toks: v[1] }; }
  }
  if (!best) return null;
  const el = h('div.qctx', { lang: 'grc' }, h('span.ref', D.bookByCode.get(best.code).name + ' ' + best.ch + ':' + best.vs));
  best.toks.forEach((t) => { const f = D.forms[t >> 4]; el.append((t >> 4) === id ? h('mark', f.w) : f.w, tokenPunct(t) + (tokenFlag(t) ? '—' : ' ')); });
  el.append(h('a.small', { href: readHref(best.code, best.ch, best.vs), style: { display: 'block', fontFamily: 'var(--ui)', marginTop: '.3rem' } }, 'Read in context →'));
  return el;
}

/* ---------- which forms to practise ---------- */
function candidatePool(scope, kinds) {
  const ok = new Set(kinds), out = [];
  if (scope) {
    const counts = new Map();
    for (const { toks } of scopeVerses(scope)) for (const t of toks) counts.set(t >> 4, (counts.get(t >> 4) || 0) + 1);
    for (const [id, n] of counts) { const it = itemOf(id); if (it && ok.has(it.kind)) out.push({ id, w: n * 3 + Math.sqrt(D.forms[id].count) }); }
    return out;
  }
  const take = (pred) => { for (let id = 0; id < D.forms.length; id++) { const f = D.forms[id]; const it = itemOf(id); if (it && ok.has(it.kind) && pred(f)) out.push({ id, w: f.count }); } };
  take((f) => status(f.an[0].s) !== 'unknown');
  if (out.length < 40) { out.length = 0; take((f) => (D.lexByN.get(f.an[0].s) || { rank: 1e9 }).rank <= 400); }   // nothing known yet: start with the most common words
  return out;
}

export function buildParseSession({ scope = null, kind = 'all', size = setting('sessionSize'), newLimit = null }) {
  ensureIndex();
  const kinds = KINDS[kind] || KINDS.all, now = Date.now();
  const pool = candidatePool(scope, kinds), inPool = new Set(pool.map((x) => x.id));
  const due = parseCardsDue(now).map((c) => ({ c, id: keyMap.get(c.id) }))
    .filter((x) => x.id != null && itemOf(x.id) && kinds.includes(itemOf(x.id).kind) && (!scope || inPool.has(x.id)))
    .sort((a, b) => a.c.due - b.c.due).slice(0, size).map((x) => ({ id: x.id, type: 'due' }));
  const limit = newLimit != null ? newLimit : scope ? size : Math.max(0, setting('parseNewPerDay') - parseNewToday());
  const fresh = pool.filter((x) => { const c = K.cards.get(parseId(D.forms[x.id])); return !c || c.state === 'new'; })
    .map((x) => ({ x, s: Math.sqrt(x.w) * (0.6 + Math.random() * 0.8) })).sort((a, b) => b.s - a.s)
    .slice(0, Math.min(limit, Math.max(0, size - due.length))).map((o) => ({ id: o.x.id, type: 'new' }));
  return shuffle([...due, ...fresh]);
}

/* ---------- adaptive mode: guided until you're reliable, then quick ---------- */
const effectiveMode = (group, st) => { const pref = setting('parseMode'); return pref === 'guided' || pref === 'quick' ? pref : (st.mode[group] || 'guided'); };

async function recordResult(st, it, res) {
  const g = groupOfItem(it);
  for (const [k, v] of Object.entries(res.perSlot)) { const s = (st.slots[k] ||= [0, 0]); s[1]++; if (v.ok) s[0]++; }
  const rec = (st.recent[g] ||= []); rec.push(res.full ? 1 : 0); if (rec.length > 40) rec.shift();
  st.total = (st.total || 0) + 1;
  if (setting('parseMode') === 'auto') {
    const cur = st.mode[g] || 'guided', sum = (a) => a.reduce((x, y) => x + y, 0), label = g === 'verb' ? 'verbs' : 'nouns, adjectives and pronouns';
    if (cur === 'guided' && rec.length >= 20 && sum(rec.slice(-20)) / 20 >= 0.85) { st.mode[g] = 'quick'; st.recent[g] = []; toast('Nice — you parse ' + label + ' reliably, so lexiko moved you to Quick mode.', 5000); }
    else if (cur === 'quick' && rec.length >= 12 && sum(rec.slice(-12)) / 12 < 0.6) { st.mode[g] = 'guided'; st.recent[g] = []; toast('Back to Guided mode for ' + label + ' for a bit.', 4500); }
  }
  await saveParseStats(st);
}

/* ---------- session ---------- */
let keyHandler = null;
const stop = () => { if (keyHandler) { document.removeEventListener('keydown', keyHandler); keyHandler = null; } };

function runSession(view, queue, { title, scope, restart }) {
  const total = queue.length;
  const S = { done: 0, full: 0, fresh: 0, slots: {} };
  let st = null, cur = null;

  const finish = () => {
    stop();
    const weakest = Object.entries(S.slots).filter(([, v]) => v[1] >= 3).map(([k, v]) => [k, v[0] / v[1]]).sort((a, b) => a[1] - b[1])[0];
    clear(view).append(
      h('div.pagehead', h('h1', 'Session complete')),
      h('div.card.stack',
        h('div.kpis', h('div.kpi', h('b', S.done), h('span', 'forms parsed')), h('div.kpi', h('b', S.done ? pct(S.full / S.done) : '—'), h('span', 'fully correct')), h('div.kpi', h('b', S.fresh), h('span', 'new forms'))),
        Object.keys(S.slots).length ? h('div', h('b', 'Accuracy by part'), slotBars(S.slots)) : null,
        weakest && weakest[1] < 0.8 ? h('p.muted', 'Most slips this time: ' + SLOT_TITLE[weakest[0]].toLowerCase() + '. It will keep coming back until it sticks.') : null,
        h('div.row.wrap', h('button.btn.primary', { onclick: restart }, 'Practise more'),
          h('a.btn', { href: '#/parse' }, 'Back to Parsing'), scope ? h('a.btn', { href: readHref(scope.book, scope.c1, scope.v1 > 1 ? scope.v1 : 0) }, icon('read', 18), 'Read ' + scopeLabel(scope)) : null)));
  };

  const advance = async () => { stop(); cur = queue.shift(); if (!cur) return finish(); st = await getParseStats(); show(cur); };

  function frame(c, inner) {
    const tag = c.retry ? ['warn', 'Once more'] : c.type === 'new' ? ['accent', 'New'] : ['', 'Review'];
    clear(view).append(h('div.qwrap',
      h('div.qtop', h('button.btn.ghost.icon.sm', { 'aria-label': 'End session', onclick: () => { if (confirm('End this session? Your answers so far are saved.')) finish(); } }, icon('close', 20)),
        h('div.bar.accent.grow', h('i', { style: { width: (100 * S.done / total) + '%' } })), h('span.chip.' + tag[0], tag[1])),
      inner));
  }

  function prompt(c, it) {
    const f = it.form, L = D.lexByN.get(it.strongs);
    return h('div.qcard.pcard', h('div.qgreek', { lang: 'grc' }, f.plain), h('div.qmeta', L.head + ' · ' + L.brief), formContext(c.id));
  }

  /* feedback shared by both modes */
  async function feedback(c, it, res, { ms, aided, mode }) {
    stop();
    const first = !c.retry;
    const grade = gradeOf(res, { ms, aided });
    let next = null;
    if (first) {
      next = await rateParse(parseId(it.form), grade, ms, { m: mode, w: res.wrong.join('') });
      S.done++; if (res.full) S.full++; if (c.type === 'new') S.fresh++;
      for (const [k, v] of Object.entries(res.perSlot)) { const s = (S.slots[k] ||= [0, 0]); s[1]++; if (v.ok) s[0]++; }
      await recordResult(st, it, res);
    }
    if (!res.full && first) queue.splice(Math.min(queue.length, 4), 0, { ...c, retry: true });
    const L = D.lexByN.get(it.strongs), best = res.best;
    const notes = explain(L.head, it.form.plain, best.d);
    const others = it.valid.filter((v) => v !== best);
    const soft = Object.entries(res.perSlot).filter(([, v]) => v.soft);
    const head = res.full ? ['ok', 'Correct'] : res.wrong.length === 1 && res.total >= 3 ? ['mid', 'Almost — one part off'] : ['bad', 'Not quite'];
    const chips = Object.entries(res.perSlot).map(([k, v]) => h('span.pslot.' + (v.ok ? 'ok' : 'bad'), h('small', SLOT_TITLE[k]), v.ok ? labelOf(k, v.expected) : (v.user ? labelOf(k, v.user) + ' → ' : '') + labelOf(k, v.expected), v.ok ? ' ✓' : ''));
    const fb = h('div.fb.' + head[0],
      h('div.row.between', h('b', head[1]), first && next ? h('span.small.muted', 'next review in ' + fmtInterval(next.due - Date.now())) : h('span.small.muted', 'practice only')),
      h('div.parsed', describe(best), ' ', h('span.chip', best.code)),
      others.length ? h('div.small.muted', 'Also valid: ' + others.map((o) => describe(o) + ' (' + o.code + ')').join(' · ')) : null,
      h('div.pslots', chips),
      soft.length ? h('div.small.muted', 'Accepted: the Robinson–Pierpont code marks this as ' + labelOf('voice', best.slots.voice).toLowerCase() + ' — a middle/passive form that may be read either way.') : null,
      notes.length ? h('details.why', { open: !res.full }, h('summary', 'Why it looks like this'), h('ul', notes.map((n) => h('li', n)))) : null);
    const go = h('button.btn.primary.block', { onclick: advance }, queue.length ? 'Continue' : 'Finish');
    (view.querySelector('.qwrap') || view).append(fb, go);
    go.focus({ preventScroll: true });
    keyHandler = (e) => { if (e.key === 'Enter') { e.preventDefault(); advance(); } };
    document.addEventListener('keydown', keyHandler);
    window.scrollTo({ top: fb.offsetTop - 80, behavior: 'smooth' });
  }

  function show(c) {
    const it = itemOf(c.id), mode = effectiveMode(groupOfItem(it), st), t0 = Date.now();
    (mode === 'quick' ? quick : guided)(c, it, t0);
  }

  /* ----- guided: one part at a time, immediate feedback ----- */
  function guided(c, it, t0) {
    const answers = {}; let cands = it.valid.slice(), aided = false, gaveUp = false;
    const L = D.lexByN.get(it.strongs);
    const area = h('div.pq'), hintBox = h('div');
    const nextSlot = () => cands[0].keys.find((k) => !(k in answers));
    const draw = () => {
      const slot = nextSlot();
      if (!slot) return end();
      const done = cands[0].keys.filter((k) => k in answers);
      const opts = OPTIONS[slot];
      clear(area).append(
        h('div.pslots', done.map((k) => h('span.pslot.' + (answers[k + '_ok'] ? 'ok' : 'bad'), h('small', SLOT_TITLE[k]), labelOf(k, answers[k]))), h('span.pslot.cur', SLOT_TITLE[slot] + '?')),
        h('div.pgrid', opts.map(([code, label], i) => h('button.popt', { dataset: { code }, onclick: (e) => pick(slot, code, e.currentTarget) }, h('kbd', i + 1), label))),
        h('div.row.between', h('button.btn.ghost.sm', { onclick: () => { aided = true; hintBox.replaceChildren(h('div.hint', 'Hint: ' + (explain(L.head, it.form.plain, cands[0].d)[0] || 'Look at the ending first — it carries most of the information.'))); } }, 'Hint'),
          h('button.btn.ghost.sm', { onclick: () => { gaveUp = true; cands[0].keys.forEach((k) => { if (!(k in answers)) answers[k] = undefined; }); end(); } }, 'I don’t know')), hintBox);
    };
    const pick = (slot, code, btn) => {
      const grid = btn.parentNode, matching = cands.filter((cd) => slotOK(slot, code, cd)), ok = matching.length > 0;
      answers[slot] = code; answers[slot + '_ok'] = ok;
      grid.querySelectorAll('button').forEach((b) => { b.disabled = true; });
      btn.classList.add(ok ? 'right' : 'wrong');
      const expected = (ok ? matching : cands)[0].slots[slot];
      if (!ok) grid.querySelector('[data-code="' + expected + '"]')?.classList.add('right');
      if (ok) { cands = matching; setTimeout(draw, 320); }
      else {
        const cont = h('button.btn.primary.block', { onclick: () => { cont.remove(); draw(); } }, 'Continue');
        area.append(cont); cont.focus({ preventScroll: true });
        keys(() => cont.click());
      }
    };
    const keys = (enter) => {
      stop();
      keyHandler = (e) => {
        if (e.key === 'Enter' && enter) { e.preventDefault(); enter(); return; }
        const n = +e.key; if (!n) return; const b = area.querySelectorAll('.popt')[n - 1]; if (b && !b.disabled) b.click();
      };
      document.addEventListener('keydown', keyHandler);
    };
    const end = () => {
      const clean = {}; for (const k of Object.keys(answers)) if (!k.endsWith('_ok')) clean[k] = answers[k];
      const res = check(it, clean);
      area.remove(); feedback(c, it, res, { ms: Date.now() - t0, aided, mode: 'g' });
    };
    frame(c, [prompt(c, it), area]); draw(); keys(null);
  }

  /* ----- quick: every part at once, then check ----- */
  function quick(c, it, t0) {
    const answers = {}; let locked = false;
    const rows = h('div.srows'), checkBtn = h('button.btn.primary.block', 'Check');
    const shownSlots = () => {
      if (it.group === 'V') return slotOrder('V', answers.mood);
      return slotOrder(it.group).filter((k) => it.valid[0].keys.includes(k));      // ἐγώ/σύ have no gender, so it isn't asked
    };
    const draw = () => {
      const slots = shownSlots();
      clear(rows).append(...slots.map((slot) => h('div.srow', h('div.lab', SLOT_TITLE[slot]),
        h('div.seg.wide', OPTIONS[slot].map(([code, label]) => h('button', { 'aria-pressed': String(answers[slot] === code), disabled: locked, onclick: () => { answers[slot] = code; draw(); } }, label))))));
      checkBtn.disabled = !slots.every((k) => answers[k]);
    };
    const run = (giveUp) => {
      if (locked) return; locked = true;
      const res = check(it, giveUp ? {} : answers);
      draw(); checkBtn.remove(); skip.remove();
      rows.querySelectorAll('.srow').forEach((r, i) => { const slot = shownSlots()[i], v = res.perSlot[slot]; if (v) r.classList.add(v.ok ? 'ok' : 'bad'); });
      feedback(c, it, res, { ms: Date.now() - t0, aided: false, mode: 'q' });
    };
    checkBtn.onclick = () => run(false);
    const skip = h('button.btn.ghost.sm', { onclick: () => run(true) }, 'I don’t know');
    frame(c, [prompt(c, it), rows, checkBtn, h('div.row', skip)]); draw();
    stop();
  }

  advance();
  return stop;
}

function slotBars(slots) {
  const order = ['tense', 'voice', 'mood', 'person', 'number', 'case', 'gender', 'possessorNumber'];
  return h('div.pbars', order.filter((k) => slots[k] && slots[k][1]).map((k) => {
    const [ok, n] = slots[k], p = ok / n;
    return h('div.pbar', h('span', SLOT_TITLE[k]), h('div.bar', h('i', { style: { width: (p * 100) + '%', background: p >= 0.9 ? 'var(--good)' : p >= 0.7 ? 'var(--warn)' : 'var(--bad)' } })), h('b', pct(p)), h('small', n + '×'));
  }));
}

/* ---------- Parsing tab ---------- */
export function renderParse(view, params) {
  const [mode, ...rest] = params;
  if (mode === 'run') {
    ensureIndex();
    let scope = null, kind = 'all';
    if (rest[0] === 'passage') {
      const [, book, c1, v1, c2, v2, k] = rest; if (!D.bookByCode.has(book)) { location.hash = '#/parse'; return; }
      scope = { book, c1: +c1, v1: +v1 || 1, c2: +c2 || +c1, v2: +v2 || 999 }; kind = k || 'all';
    } else kind = rest[1] || 'all';
    const q = buildParseSession({ scope, kind });
    if (!q.length) {
      clear(view).append(h('div.pagehead', h('h1', 'Parsing')), h('div.card.stack',
        h('p', scope ? 'There is nothing to parse in ' + scopeLabel(scope) + ' for this selection.' : 'Nothing is due, and you have reached today’s new-form limit. 🎉'),
        h('p.small.muted', 'You can raise the daily limit on the Parsing page, or practise a passage — passages ignore the daily limit.'), h('a.btn', { href: '#/parse' }, 'Back')));
      return;
    }
    return runSession(view, q, { title: scope ? scopeLabel(scope) : KIND_TITLE[kind], scope, restart: () => renderParse(view, params) });
  }
  landing(view);
}

async function landing(view) {
  ensureIndex();
  const st = await getParseStats();
  const dueBy = { all: 0, verb: 0, noun: 0 };
  for (const c of parseCardsDue()) { const id = keyMap.get(c.id); const it = id != null && itemOf(id); if (!it) continue; dueBy.all++; if (it.kind === 'verb') dueBy.verb++; else if (it.kind === 'nominal') dueBy.noun++; }
  const left = Math.max(0, setting('parseNewPerDay') - parseNewToday());
  const modeNote = () => setting('parseMode') === 'auto' ? 'Automatic: verbs ' + (st.mode.verb || 'guided') + ', nouns, adjectives & pronouns ' + (st.mode.other || 'guided') + '.' : '';
  const note = h('div.muted.small', modeNote());
  const modeSeg = h('div.seg', [['auto', 'Auto'], ['guided', 'Guided'], ['quick', 'Quick']].map(([v, t]) => h('button', { 'aria-pressed': String(setting('parseMode') === v), onclick: async (e) => {
    await setSetting('parseMode', v); [...e.currentTarget.parentNode.children].forEach((b) => b.setAttribute('aria-pressed', String(b === e.currentTarget))); note.textContent = modeNote();
  } }, t)));
  const newSel = h('select', { 'aria-label': 'New forms per day', onchange: (e) => setSetting('parseNewPerDay', +e.target.value) }, [5, 10, 15, 20, 30].map((n) => h('option', { value: n, selected: n === setting('parseNewPerDay') }, n)));
  const weak = Object.entries(st.slots).filter(([, v]) => v[1] >= 8).map(([k, v]) => [k, v[0] / v[1]]).sort((a, b) => a[1] - b[1])[0];
  clear(view).append(
    h('div.pagehead', h('h1', 'Parsing')),
    h('div.stack',
      h('div.card.stack',
        h('p', 'Name the parts of a form in a fixed order — verbs: tense → voice → mood → person → number (participles: case → number → gender); everything else: case → number → gender. Every valid parsing is accepted, each part is scored on its own, and slips come back later.'),
        h('div.row.between.wrap', h('div', h('b', 'Style'), h('div.muted.small', 'Guided asks one part at a time with instant feedback. Quick shows all parts at once. Auto starts guided and moves up when you’re reliable.')), modeSeg), note,
        h('div.row.between', h('span.small.muted', 'New forms per day'), newSel)),
      h('div.scope-pick',
        ['all', 'verb', 'noun'].map((k) => h('a.tile', { href: '#/parse/run/mix/' + k }, h('h3', KIND_TITLE[k]), h('p', dueBy[k] + ' due' + (k === 'all' ? ' · ' + left + ' new left today' : '')))),
      ),
      passagePicker(view, K.goal && K.goal.book ? K.goal : null, {
        title: 'Parse a passage', blurb: 'Practise the forms that occur in the text you want to read, most frequent first.', label: 'Practise these forms',
        href: (sc) => '#/parse/run/passage/' + [sc.book, sc.c1, sc.v1, sc.c2, sc.v2].join('/') + '/all',
        info: (sc) => { const ids = new Set(); let n = 0; for (const { toks } of scopeVerses(sc)) for (const t of toks) { n++; if (itemOf(t >> 4)) ids.add(t >> 4); } return fmt(ids.size) + ' distinct forms to parse in ' + fmt(n) + ' words of text'; },
      }),
      h('div.card', h('h3', 'Your accuracy by part'), Object.keys(st.slots).length ? [slotBars(st.slots), weak && weak[1] < 0.85 ? h('p.small.muted', 'Weakest so far: ' + SLOT_TITLE[weak[0]].toLowerCase() + '.') : null] : h('p.muted.small', 'It will appear here after your first session.'))));
}
