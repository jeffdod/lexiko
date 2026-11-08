// Parsing practice: pick the parts of a form in a fixed order (guided one-at-a-time, or quick all-at-once),
// scored per part, every valid parsing accepted, FSRS-scheduled per form, with stem-change explanations.
import { clockNow } from './clock.js';
import { D, scopeVerses, scopeLabel, tokenPunct, tokenFlag, chapterVerses } from './data.js';
import { K, status, setting, setSetting, parseId, parseCardsDue, setParseDueCounter, parseNewToday, rateParse, reviewCards, recentWords, parsePace, startedVerbs, getParseStats, saveParseStats, troubleCards } from './know.js';
import { buildItem, groupForms, mergeForms, check, gradeOf, slotOrder, slotOK, OPTIONS, SLOT_TITLE, labelOf, describe } from './parse-model.js';
import { h, clear, shuffle, pct, icon, fmtInterval, soonText, toast, practiceBanner, fold, startButton, fmt, missedBlock, backLinks, backHead, areaCard } from './util.js';
import { ROWS, say, plan as chartPlan } from './chartdrill.js';
import { verbsInProgress } from './verbs.js';
import { PTCB } from './ptcdata.js';
import { INFB, infKey } from './infdata.js';
import { SUBB, subKey } from './subdata.js';
import { IMPB, impKey } from './impdata.js';
import { chartsButton, openCharts, chartRowForSlots, participleHighlight, infinitiveHighlight } from './charts.js';
import { smart, TOPICS } from './smart.js';
import { miniGoalCard } from './goals.js';
import { paceNote } from './pace.js';
import { readHref } from './reader.js';
import { verbChoices } from './verbq.js';
import { requiredStems } from './stems.js';
import { currentGoal, goalWords, formOpen, gateOpen } from './know.js';
import { isLiquidVerb } from './families.js';
import { gateKey } from './kinds.js';
import { unlockSection, renderKinds, renderRows, renderGates, renderHowto } from './gatesui.js';
import { store } from './store.js';
import { renderClues } from './cluehunt.js';
import { renderBuild } from './buildform.js';
const SMOOTH = matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth';   // no animated scrolling for people who ask for less motion

/** Answer codes that have no button of their own, and the button that stands for them. */
const NEAREST = { voice: { N: 'E', Q: 'A' } };
const KINDS = { all: ['verb', 'nominal'], verb: ['verb'], noun: ['nominal'] };
const KIND_TITLE = { all: 'Mixed practice', verb: 'Verbs', noun: 'Nouns, adjectives & pronouns' };

/* ---------- indexes (built once, on first use) ---------- */
const items = new Map();       // form id -> parse item | null
let keyMap = null, canon = null, members = null;             // 'f:form:strongs' -> form id
let samples = null;            // form id -> [[book, ch, vs], ...]
function ensureIndex() {
  if (keyMap) return;
  keyMap = new Map();
  ({ canon, members } = groupForms(D.forms));                        // rows that are the same written form share one item
  D.forms.forEach((f, i) => { f.id = i; });
  for (const [c, ids] of members) for (const i of ids) keyMap.set(parseId(D.forms[i]), c);        // a card made for any variant of a form finds the form
  samples = new Map();
  for (const b of D.books) for (const [ch, verses] of D.text[b.code]) for (const [vs, toks] of verses) for (const t of toks) {
    const id = canon[t >> 4]; let a = samples.get(id); if (!a) samples.set(id, (a = []));
    if (a.length < 8 && !a.some((x) => x[2] === vs && x[1] === ch && x[0] === b.code)) a.push([b.code, ch, vs]);
  }
}
/** The card that holds this form's progress: the variant already practiced the most (cards made before variants were merged), else the main one. */
const cardIdFor = (id) => {
  let best = parseId(D.forms[id]), bc = K.cards.get(best);
  for (const r of members.get(id) || []) { const k = parseId(D.forms[r]), c = K.cards.get(k); if (c && (!bc || c.reps > bc.reps)) { best = k; bc = c; } }
  return best;
};
const isFresh = (id) => { const c = K.cards.get(cardIdFor(id)); return !c || c.state === 'new'; };
const rawItem = (id) => { if (!items.has(id)) items.set(id, buildItem(mergeForms(D.forms, members.get(canon[id]) || [id]))); return items.get(id); };
/** A verb form whose gate is not open (or while verb parsing is off) is treated as if it were not there: not due, not new, not counted. */
const itemOf = (id) => { const it = rawItem(id); return it && it.group === 'V' && !formOpen(it.valid.map((v) => v.code), it.strongs) ? null : it; };
/** The forms a verb requires (its chosen forms in each required stem), as form ids; cached per verb. */
const reqCache = new Map();
const requiredFormIds = (n) => {
  let r = reqCache.get(n);
  if (!r) { r = new Set(); const rs = requiredStems(n); if (rs) for (const s of rs.stems) for (const f of s.forms) for (const row of f.rows) r.add(canon[row]); reqCache.set(n, r); }
  return r;
};
/** What the daily sessions may serve (the same as itemOf: gates decide). */
const autoItemOf = itemOf;
const isVerbForm = (id) => { const it = itemOf(id); return !!it && it.group === 'V'; };
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
  best.toks.forEach((t) => { const f = D.forms[t >> 4]; el.append(canon[t >> 4] === id ? h('mark', f.w) : f.w, tokenPunct(t) + (tokenFlag(t) ? '—' : ' ')); });
  el.append(h('a.small', { href: readHref(best.code, best.ch, best.vs), style: { display: 'block', fontFamily: 'var(--ui)', marginTop: '.3rem' } }, 'Read in context →'));
  return el;
}

/* ---------- which forms to practice ---------- */
function candidatePool(scope, kinds) {
  const ok = new Set(kinds), out = [];
  if (scope) {
    const counts = new Map();
    for (const { toks } of scopeVerses(scope)) for (const t of toks) counts.set(canon[t >> 4], (counts.get(canon[t >> 4]) || 0) + 1);
    for (const [id, n] of counts) { const it = autoItemOf(id); if (it && ok.has(it.kind)) out.push({ id, w: n * 3 + Math.sqrt(D.forms[id].count) }); }
    return out;
  }
  const take = (pred) => { for (const id of members.keys()) { const it = autoItemOf(id); if (it && ok.has(it.kind) && pred(D.forms[id])) out.push({ id, w: it.form.count }); } };
  const mine = (f) => !isVerbForm(f.id) || requiredFormIds(f.an[0].s).has(canon[f.id]);        // a verb comes in through the forms it requires; its other forms are practiced, never required
  take((f) => (isVerbForm(f.id) ? status(f.an[0].s) !== 'unknown' : status(f.an[0].s) === 'known') && mine(f));        // a noun, adjective or pronoun form is asked only once you know the word's meaning
  return out;
}

/** How many forms are due, counted exactly as a session serves them: one per form, and only forms that are still quizzed. */
export function parseDueCount(now = clockNow()) {
  ensureIndex();
  const seen = new Set();
  for (const c of parseCardsDue(now)) { const id = keyMap.get(c.id); if (id != null && autoItemOf(id)) seen.add(id); }
  return seen.size;
}
setParseDueCounter(parseDueCount);

/** What a session would contain right now: the due forms, then new ones up to the daily allowance. */
export function planParseSession({ scope = null, kind = 'all', size = setting('sessionSize'), newLimit = null }) {
  ensureIndex();
  const kinds = KINDS[kind] || KINDS.all, now = clockNow();
  const pool = candidatePool(scope, kinds), inPool = new Set(pool.map((x) => x.id));
  const due = parseCardsDue(now).map((c) => ({ c, id: keyMap.get(c.id) }))
    .filter((x) => x.id != null && autoItemOf(x.id) && kinds.includes(itemOf(x.id).kind) && (!scope || inPool.has(x.id)))
    .sort((a, b) => a.c.due - b.c.due).filter((x, i, a) => a.findIndex((y) => y.id === x.id) === i);       // one entry per form
  const limit = newLimit != null ? newLimit : scope ? size : parsePace().left;
  const fresh = pool.filter((x) => isFresh(x.id));
  return { due, fresh, limit, size };
}

export function buildParseSession(opts) {
  const { due, fresh, limit, size } = planParseSession(opts);
  const dueIds = due.slice(0, size).map((x) => ({ id: x.id, type: 'due' }));
  const want = Math.min(limit, Math.max(0, size - dueIds.length));
  const goal = new Set(goalWords(currentGoal())), steer = (id) => (goal.has(D.forms[id].an[0].s) ? 1.6 : 1);          // the forms of your goal's words come first
  const ranked = fresh.map((x) => ({ x, s: Math.sqrt(x.w) * steer(x.id) * (0.6 + Math.random() * 0.8) })).sort((a, b) => b.s - a.s);
  // variety: no single word (εἰμί, λέγω, the article…) fills the session; take at most a few forms of each, then relax if there aren't enough words
  // verb forms are reserved up to 40% of the new slots, so the many noun forms do not crowd them out
  const cap = size > 20 ? 3 : 2, per = new Map(), lex = (id) => D.forms[id].an[0].s, picked = [], rest = [];
  let verbRoom = Math.round(want * 0.4), otherRoom = want - verbRoom;
  const nVerbs = ranked.filter((o) => isVerbForm(o.x.id)).length; if (nVerbs < verbRoom) { otherRoom += verbRoom - nVerbs; verbRoom = nVerbs; }
  for (const o of ranked) {
    const k = lex(o.x.id), n = per.get(k) || 0, v = isVerbForm(o.x.id);
    if (picked.length < want && n < cap && (v ? verbRoom : otherRoom) > 0 ) { picked.push(o); per.set(k, n + 1); if (v) verbRoom--; else otherRoom--; } else rest.push(o);
  }
  const rest2 = [];
  for (const o of rest) { const k = lex(o.x.id), n = per.get(k) || 0; if (picked.length < want && n < cap) { picked.push(o); per.set(k, n + 1); } else rest2.push(o); }      // a share that nobody fills goes to whoever is left, still a few per word
  for (const o of rest2) { if (picked.length >= want) break; picked.push(o); }
  const newIds = picked.map((o) => ({ id: o.x.id, type: 'new' }));
  return shuffle([...dueIds, ...newIds]);
}

/** Forms of one chart row, from verbs you know: the pool for "Parse forms like this". The liquid rows are the regular row's forms from liquid verbs (λ, μ, ν, ρ), and the regular rows leave those out. */
const LIQ_PARENT = { 'fut-liq-act': 'fut-act', 'fut-liq-mid': 'fut-mid', 'aor-liq-act': 'aor1-act' };
const HAS_LIQ = new Set(['fut-act', 'fut-mid', 'aor1-act']);
export function rowPool(key, { ignoreLevel = false, anyVerb = false, gated = false } = {}) {
  ensureIndex();
  const want = LIQ_PARENT[key] || key, liqRow = key in LIQ_PARENT, out = [];
  for (const id of members.keys()) {
    const it = gated ? autoItemOf(id) : ignoreLevel ? rawItem(id) : itemOf(id);
    if (!it || it.group !== 'V' || (!anyVerb && status(it.strongs) !== 'known')) continue;
    if (!it.valid.some((v) => chartRowForSlots(v.slots) === want)) continue;
    const liq = isLiquidVerb(it.strongs);
    if (liqRow ? !liq : HAS_LIQ.has(key) && liq) continue;
    out.push(id);
  }
  return out;
}
/** Participles of verbs you know, with the kind (chart row key) each is, for the participle pages. `key` limits it to one kind. */
export function participleForms(key = null, { ignoreLevel = false } = {}) {
  ensureIndex();
  const out = [];
  for (const id of members.keys()) {
    const it = ignoreLevel ? rawItem(id) : itemOf(id);
    if (!it || it.group !== 'V' || status(it.strongs) !== 'known') continue;
    let k = null; for (const v of it.valid) { const hl = participleHighlight(v.slots); if (hl && hl.key) { k = hl.key; break; } }
    if (!k || (key && k !== key)) continue;
    const L = D.lexByN.get(it.strongs);
    out.push({ id, key: k, w: D.forms[id].w.replace(/[\u00ad\u200b]/g, ''), n: it.strongs, head: L ? L.head : '', brief: L ? L.brief : '', count: D.forms[id].count });
  }
  return out;
}
/** Infinitives of verbs you know, with the kind (chart row key) each is, for the infinitive pages. */
export function infinitiveForms(key = null, { ignoreLevel = false } = {}) {
  ensureIndex();
  const out = [];
  for (const id of members.keys()) {
    const it = ignoreLevel ? rawItem(id) : itemOf(id);
    if (!it || it.group !== 'V' || status(it.strongs) !== 'known') continue;
    let k = null; for (const v of it.valid) { k = infKey(v.slots); if (k) break; }
    if (!k || (key && k !== key)) continue;
    const L = D.lexByN.get(it.strongs);
    out.push({ id, key: k, w: D.forms[id].w.replace(/[\u00ad\u200b]/g, ''), n: it.strongs, head: L ? L.head : '', brief: L ? L.brief : '', count: D.forms[id].count });
  }
  return out;
}
/** Subjunctives of verbs you know, with the kind (chart row key) each is, for the subjunctive pages. */
export function subjunctiveForms(key = null, { ignoreLevel = false } = {}) {
  ensureIndex();
  const out = [];
  for (const id of members.keys()) {
    const it = ignoreLevel ? rawItem(id) : itemOf(id);
    if (!it || it.group !== 'V' || status(it.strongs) !== 'known') continue;
    let k = null; for (const v of it.valid) { k = subKey(v.slots); if (k) break; }
    if (!k || (key && k !== key)) continue;
    const L = D.lexByN.get(it.strongs);
    out.push({ id, key: k, w: D.forms[id].w.replace(/[\u00ad\u200b]/g, ''), n: it.strongs, head: L ? L.head : '', brief: L ? L.brief : '', count: D.forms[id].count });
  }
  return out;
}
/** Imperatives of verbs you know, with the kind (chart row key) each is, for the imperative pages. */
export function imperativeForms(key = null, { ignoreLevel = false } = {}) {
  ensureIndex();
  const out = [];
  for (const id of members.keys()) {
    const it = ignoreLevel ? rawItem(id) : itemOf(id);
    if (!it || it.group !== 'V' || status(it.strongs) !== 'known') continue;
    let k = null; for (const v of it.valid) { k = impKey(v.slots); if (k) break; }
    if (!k || (key && k !== key)) continue;
    const L = D.lexByN.get(it.strongs);
    out.push({ id, key: k, w: D.forms[id].w.replace(/[\u00ad\u200b]/g, ''), n: it.strongs, head: L ? L.head : '', brief: L ? L.brief : '', count: D.forms[id].count });
  }
  return out;
}
/** Subjunctives, imperatives or infinitives ('sub' | 'imp' | 'inf') for Build the form: { id, key, code, w, n, head, count }, gated like the indicative (the form level), from verbs you know or any verb. */
export function moodPool(mood, { anyVerb = false } = {}) {
  ensureIndex();
  const keyOf = { sub: subKey, imp: impKey, inf: infKey }[mood], out = [];
  for (const id of members.keys()) {
    const it = autoItemOf(id); if (!it || it.group !== 'V' || (!anyVerb && status(it.strongs) !== 'known')) continue;
    let k = null, code = ''; for (const v of it.valid) { const kk = keyOf(v.slots); if (kk && gateOpen(gateKey(v.slots, v.code, it.strongs))) { k = kk; code = v.code; break; } }      // the mood's own level must be open, even when the same word is also an open indicative form
    if (!k) continue;
    const L = D.lexByN.get(it.strongs);
    out.push({ id, key: k, code, w: D.forms[id].w.replace(/[\u00ad\u200b]/g, ''), n: it.strongs, head: L ? L.head : '', count: D.forms[id].count });
  }
  return out;
}
/** Participles for Build the form: the kind (chart row key) and the case, number and gender of each, only where the participle level is open. */
export function ptcPool({ anyVerb = false } = {}) {
  ensureIndex();
  const out = [];
  for (const id of members.keys()) {
    const it = autoItemOf(id); if (!it || it.group !== 'V' || (!anyVerb && status(it.strongs) !== 'known')) continue;
    let hl = null; for (const v of it.valid) { const x = participleHighlight(v.slots); if (x && x.key && gateOpen(gateKey(v.slots, v.code, it.strongs))) { hl = x; break; } }
    if (!hl) continue;
    const L = D.lexByN.get(it.strongs);
    out.push({ id, key: hl.key, case: hl.case, number: hl.number, gender: hl.gender, w: D.forms[id].w.replace(/[\u00ad\u200b]/g, ''), n: it.strongs, head: L ? L.head : '', count: D.forms[id].count });
  }
  return out;
}
/** A round of about a dozen forms of the row, leaning on the commonest. */
/** Several chart rows at once, for "Parse from the chart": forms of verbs you know (or of any verb), whatever the parsing level. */
export const rowsLength = (n) => Math.max(8, n);
export function rowsPools(keys, anyVerb = false) { return keys.map((k) => rowPool(k, { ignoreLevel: true, anyVerb })); }
/** At least 8 forms, and at least one per row you picked: rows are dealt from in turn so each is represented, with no form twice, and no more than there are. */
export function rowsQueue(keys, anyVerb = false, pools = rowsPools(keys, anyVerb)) {
  const lists = pools.map((p) => shuffle(p.slice().sort((a, b) => D.forms[b].count - D.forms[a].count).slice(0, 40))), at = lists.map(() => 0), seen = new Set(), out = [], total = rowsLength(keys.length);
  for (let live = true; live && out.length < total;) {
    live = false;
    for (let j = 0; j < lists.length && out.length < total; j++) {
      while (at[j] < lists[j].length && seen.has(lists[j][at[j]])) at[j]++;
      if (at[j] < lists[j].length) { const id = lists[j][at[j]++]; seen.add(id); out.push(id); live = true; }
    }
  }
  return shuffle(out).map((id) => ({ id, type: 'row' }));
}
/** One row's practice round. Practice only, so a row that is still locked can be practiced too; any = verbs you don't know yet count. */
const rowQueue = (key, any = false) => shuffle(rowPool(key, { ignoreLevel: true, anyVerb: any }).sort((a, b) => D.forms[b].count - D.forms[a].count).slice(0, 30)).slice(0, 12).map((id) => ({ id, type: 'row' }));

/** Extra practice: never scheduled. 'trouble' = your shakiest forms; 'preview' = a few frequent forms you haven't started. */
export function buildParseExtra(kind) {
  ensureIndex();
  if (kind === 'trouble') return shuffle(troubleCards('f:', 15).map((c) => ({ id: keyMap.get(c.id), type: 'practice' })).filter((x) => x.id != null && itemOf(x.id)).filter((x, i, a) => a.findIndex((y) => y.id === x.id) === i));
  if (kind === 'review') return shuffle(reviewCards('f:', 15).map((c) => ({ id: keyMap.get(c.id), type: 'recent' })).filter((x) => x.id != null && itemOf(x.id)).filter((x, i, a) => a.findIndex((y) => y.id === x.id) === i));
  if (kind === 'recent') {                                      // forms of the words you started in the last few days, a few of each
    const ws = new Set(recentWords()), per = new Map(), out = [];
    const cand = [...members.keys()].filter((id) => itemOf(id) && ws.has(D.forms[id].an[0].s)).map((id) => ({ id, s: Math.sqrt(D.forms[id].count) * (0.6 + Math.random() * 0.8) })).sort((a, b) => b.s - a.s);
    for (const o of cand) { const k = D.forms[o.id].an[0].s, n = per.get(k) || 0; if (n < 3 && out.length < 20) { out.push({ id: o.id, type: 'recent' }); per.set(k, n + 1); } }
    return shuffle(out);
  }
  const fresh = candidatePool(null, KINDS.all).filter((x) => isFresh(x.id));
  return shuffle(fresh.map((x) => ({ x, s: Math.sqrt(x.w) * (0.6 + Math.random() * 0.8) })).sort((a, b) => b.s - a.s).slice(0, 6).map((o) => ({ id: o.x.id, type: 'preview' })));
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
    if (cur === 'guided' && rec.length >= 20 && sum(rec.slice(-20)) / 20 >= 0.85) { st.mode[g] = 'quick'; st.recent[g] = []; toast('Nice — you parse ' + label + ' reliably, so lexiko moved you to Quick mode. You can change this under Style.', 10000); }
    else if (cur === 'quick' && rec.length >= 12 && sum(rec.slice(-12)) / 12 < 0.6) { st.mode[g] = 'guided'; st.recent[g] = []; toast('Back to Guided mode for ' + label + ' for a bit. You can change this under Style.', 10000); }
  }
  await saveParseStats(st);
}

/* ---------- session ---------- */
let keyHandler = null;
const stop = () => { if (keyHandler) { document.removeEventListener('keydown', keyHandler); keyHandler = null; } };

function runSession(view, queue, { title, scope, restart, practice = false, back = ['#/parse', 'Back to Parsing'] }) {
  const total = queue.length;
  const S = { missed: [], shown: 0, round: 0, rk: 0, R: 0, done: 0, full: 0, fresh: 0, slots: {}, hist: [] };
  let st = null, cur = null;
  const itemFor = (id) => (practice ? rawItem(id) : itemOf(id));      // practice is never scheduled, so a form whose gate is still closed can be asked

  const finish = () => {
    stop();
    const weakest = Object.entries(S.slots).filter(([, v]) => v[1] >= 3).map(([k, v]) => [k, v[0] / v[1]]).sort((a, b) => a[1] - b[1])[0];
    clear(view).append(
      h('div.pagehead', h('h1', practice ? 'Practice complete' : 'Session complete')),
      h('div.card.stack', practice ? h('p.muted.small', 'Strengthening is practice only — your review schedule is unchanged.') : null,
        h('div.kpis', h('div.kpi', h('b', S.done), h('span', 'forms parsed')), h('div.kpi', h('b', S.done ? pct(S.full / S.done) : '—'), h('span', 'fully correct')), practice ? null : h('div.kpi', h('b', S.fresh), h('span', 'new forms'))),
        Object.keys(S.slots).length ? h('div', h('b', 'Accuracy by part'), slotBars(S.slots)) : null,
        weakest && weakest[1] < 0.8 ? h('p.muted', 'Most slips this time: ' + SLOT_TITLE[weakest[0]].toLowerCase() + '. It will keep coming back until it sticks.') : null,
        missedBlock(S.missed.map((m) => { const it = itemFor(m.id), L = it && D.lexByN.get(it.strongs); return { greek: true, word: D.forms[m.id].plain, sub: L ? L.head + ' · ' + L.brief : '', why: m.wrong.length ? 'Missed: ' + m.wrong.map((k) => (SLOT_TITLE[k] || k).toLowerCase()).join(', ') : '' }; }),
          () => runSession(view, S.missed.map((m) => ({ id: m.id, type: 'practice' })), { title, scope, restart, practice: true, back })),
        h('div.row.wrap', h('button.btn' + (S.missed.length ? '' : '.primary'), { onclick: restart }, 'Practice more'),
          ...backLinks(back[0], back[1]), scope ? h('a.btn', { href: readHref(scope.book, scope.c1, scope.v1 > 1 ? scope.v1 : 0) }, icon('read', 18), 'Read ' + scopeLabel(scope)) : null)));
  };

  const retryQ = [];                                      // missed forms wait here and come back after the last one, in a retry round
  const advance = async () => {
    stop(); cur = queue.shift();
    if (!cur && retryQ.length) { queue.push(...retryQ.splice(0)); S.round = 1; S.R = queue.length; S.rk = 0; cur = queue.shift(); }
    if (!cur) return finish();
    if (S.round) S.rk++; else S.shown++;
    st = await getParseStats(); show(cur);
  };

  function frame(c, inner) {
    const tag = c.rescue ? ['gold', 'One more try'] : c.retry ? ['warn', 'Once more'] : c.type === 'new' ? ['accent', 'New'] : c.type === 'recent' ? ['', 'Refresher'] : c.type === 'row' ? ['', 'Chart row'] : c.type === 'practice' ? ['', 'Strengthen'] : c.type === 'preview' ? ['accent', 'Look ahead'] : ['', 'Review'];
    clear(view).append(h('div.qwrap',
      h('div.qtop', h('button.btn.ghost.icon.sm', { 'aria-label': 'End session', onclick: () => { if (confirm('End this session? Your answers so far are saved.')) finish(); } }, icon('close', 20)),
        h('div.bar.accent.grow', h('i', { style: { width: (100 * (S.round ? S.rk / S.R : S.shown / total)) + '%' } })), h('span.qcount', { 'aria-label': S.round ? 'Retry ' + S.rk + ' of ' + S.R : 'Item ' + S.shown + ' of ' + total }, S.round ? '↻ ' + S.rk + ' / ' + S.R : S.shown + ' / ' + total), chartsButton(), h('span.chip' + (tag[0] ? '.' + tag[0] : ''), tag[1])),
      practice ? practiceBanner(c.type === 'preview', c.type === 'recent', c.type === 'row') : null, inner));
  }

  function prompt(c, it, { ask = 'Parse this word', hideVerb = false } = {}) {
    const f = it.form, L = D.lexByN.get(it.strongs), ctx = formContext(c.id);
    return h('div.qcard.pcard', h('div.qask', ask), h('div.qgreek', { lang: 'grc' }, f.plain), hideVerb ? null : h('div.qmeta', L.head + ' · ' + L.brief),
      ctx ? h('details.ctxfold', h('summary', 'See it in a verse'), ctx) : null);
  }
  const chartLink = (it, d) => (it.group === 'V' && d.slots.mood === 'P' ? h('button.btn.sm', { onclick: () => openCharts({ tab: 'part', highlight: participleHighlight(d.slots) }) }, icon('table', 18), 'Participle chart')
    : it.group === 'V' && d.slots.mood === 'N' ? h('button.btn.sm', { onclick: () => openCharts({ tab: 'inf', highlight: infinitiveHighlight(d.slots) }) }, icon('table', 18), 'Infinitive chart')
    : it.group === 'V' ? h('button.btn.sm', { onclick: () => openCharts({ highlight: chartRowForSlots(d.slots) }) }, icon('table', 18), 'Verb chart')
    : it.group === 'N' && (d.pos === 'N' || d.pos === 'A') && d.slots.case && d.slots.number ? h('button.btn.sm', { onclick: () => openCharts({ tab: 'nouns', highlight: { case: d.slots.case, number: d.slots.number } }) }, icon('table', 18), 'Noun chart') : null);

  /* feedback shared by both modes */
  async function feedback(c, it, res, { ms, aided, mode }) {
    stop();
    const first = !c.retry;
    const grade = gradeOf(res, { ms, aided });
    let next = null;
    if (first) {
      if (!practice) next = await rateParse(cardIdFor(c.id), grade, ms, { m: mode, w: res.wrong.join('') });
      if (!res.full) S.missed.push({ id: c.id, wrong: res.wrong });
      S.done++; if (res.full) S.full++; if (c.type === 'new') S.fresh++; S.hist.push(!!res.full);
      for (const [k, v] of Object.entries(res.perSlot)) { const s = (S.slots[k] ||= [0, 0]); s[1]++; if (v.ok) s[0]++; }
      if (!practice) await recordResult(st, it, res);
    }
    if (!res.full && first) retryQ.push({ ...c, retry: true });
    else if (!res.full && c.retry && !c.rescue) retryQ.push({ ...c, rescue: 'twice' });          // missed again on the retry: its next appearance is the easier question
    const L = D.lexByN.get(it.strongs), best = res.best;
        const others = it.valid.filter((v) => v !== best);
    const soft = Object.entries(res.perSlot).filter(([, v]) => v.soft);
    const head = res.full ? ['ok', 'Correct'] : res.wrong.length === 1 && res.total >= 3 ? ['mid', 'Almost — one part off'] : ['bad', 'Not quite'];
    const chips = Object.entries(res.perSlot).map(([k, v]) => h('span.pslot.' + (v.ok ? 'ok' : 'bad'), h('small', SLOT_TITLE[k]), v.ok ? labelOf(k, v.expected) : (v.user ? labelOf(k, v.user) + ' → ' : '') + labelOf(k, v.expected), v.ok ? ' ✓' : ''));
    const fb = h('div.fb.' + head[0],
      h('div.row.between', h('b', head[1]), first && next ? h('span.small.muted', 'next review in ' + fmtInterval(next.due - clockNow())) : h('span.small.muted', 'practice only')),
      h('div.parsed', describe(best), ' ', h('span.chip', best.code)),
      others.length ? h('div.small.muted', 'Also valid: ' + others.map((o) => describe(o) + ' (' + o.code + ')').join(' · ')) : null,
      h('div.pslots', chips),
      soft.length ? h('div.small.muted', 'Accepted: the Robinson–Pierpont code marks this as ' + labelOf('voice', best.slots.voice).toLowerCase() + ' — a middle/passive form that may be read either way.') : null,
      chartLink(it, best.d));
    const go = h('button.btn.primary.block', { onclick: advance }, queue.length || retryQ.length ? 'Continue' : 'Finish');
    (view.querySelector('.qwrap') || view).append(fb, go);
    go.focus({ preventScroll: true });
    keyHandler = (e) => { if (e.key === 'Enter') { e.preventDefault(); advance(); } };
    document.addEventListener('keydown', keyHandler);
    window.scrollTo({ top: fb.offsetTop - 80, behavior: SMOOTH });
  }

  /* ----- the easier question: pick the whole parsing from four ----- */
  const fullLabel = (keys, slots) => keys.map((k) => labelOf(k, slots[k])).join(' · ');
  function parsingChoices(it) {
    const best = it.valid[0], keys = best.keys, seen = new Set(it.valid.map((v) => fullLabel(keys, v.slots))), out = [{ label: fullLabel(keys, best.slots), ok: true }];
    const swap = (sl) => { const s = { ...sl }, k = shuffle(keys.filter((x) => x !== 'mood' && OPTIONS[x] && OPTIONS[x].length > 1))[0]; if (!k) return null; const alt = shuffle(OPTIONS[k].filter(([code]) => code !== sl[k]))[0]; if (!alt) return null; s[k] = alt[0]; return s; };
    for (let i = 0; i < 60 && out.length < 4; i++) { let s = swap(best.slots); if (s && i > 20) s = swap(s); if (!s) continue; const label = fullLabel(keys, s); if (!seen.has(label)) { seen.add(label); out.push({ label, ok: false }); } }
    return shuffle(out);
  }
  function rescueStep(c, it) {
    const L = D.lexByN.get(it.strongs), t0 = clockNow(), choices = parsingChoices(it), first = !c.retry;
    const optsEl = h('div.opts'), tail = h('div');
    let done = false;
    const answer = async (pickedIdx) => {
      if (done) return; done = true; stop();
      const ok = pickedIdx >= 0 && choices[pickedIdx].ok, ms = clockNow() - t0; let next = null;
      [...optsEl.children].forEach((b, i) => { b.disabled = true; b.classList.toggle('right', choices[i].ok); if (i === pickedIdx && !choices[i].ok) b.classList.add('wrong'); b.querySelector('.mark').textContent = choices[i].ok ? '✓' : (i === pickedIdx ? '✗' : ''); });
      if (!practice) next = await rateParse(cardIdFor(c.id), ok ? 2 : 1, ms, { m: 'c', w: ok ? '' : 'rescue' });             // right = Hard (recognized with help), wrong = Again
      if (first) { S.done++; if (c.type === 'new') S.fresh++; if (!ok) S.missed.push({ id: c.id, wrong: ['parsing'] }); }
      const go = h('button.btn.primary.block', { onclick: advance }, queue.length || retryQ.length ? 'Continue' : 'Finish');
      clear(tail).append(h('div.rescue-note', 'That’s enough for this one.' + (next ? ' You’ll see this form again ' + soonText(next.due - clockNow()) + '.' : '')), chartLink(it, it.valid[0].d), go);
      go.focus({ preventScroll: true });
      keyHandler = (e) => { if (e.key === 'Enter') { e.preventDefault(); advance(); } };
      document.addEventListener('keydown', keyHandler);
    };
    choices.forEach((o, i) => optsEl.append(h('button.opt', { onclick: () => answer(i) }, h('span', o.label), h('span.mark', ''))));
    keyHandler = (e) => { const n = +e.key; if (n >= 1 && n <= choices.length) { e.preventDefault(); answer(n - 1); } };
    document.addEventListener('keydown', keyHandler);
    const note = c.rescue === 'streak' ? 'A few misses in a row, so here is an easier question. Pick its parsing.' : 'You’ve missed this form twice. Pick its parsing.';
    frame(c, [h('div.qcard.pcard', h('div.qask', 'Which parsing is this?'), h('div.qgreek', { lang: 'grc' }, it.form.plain), h('div.qmeta', L.head + ' · ' + L.brief)),
      h('div.rescue-note', note), optsEl, h('div.row', h('button.btn.ghost.sm', { onclick: () => answer(-1) }, 'I don’t know')), tail]);
  }
  const badStreak = () => S.hist.length >= 6 && S.hist.slice(-6).filter((x) => !x).length >= 5;      // five of the last six first tries fully missed

  function show(c) {
    if (!c.rescue && !c.retry && !practice && badStreak()) { c = { ...c, rescue: 'streak' }; S.hist = []; }
    const it = itemFor(c.id);
    if (c.rescue) return rescueStep(c, it);
    const mode = effectiveMode(groupOfItem(it), st);

    const parse = (aided = false, verbOk = false) => (mode === 'quick' ? quick : guided)(c, it, clockNow(), aided);
    if (it.group === 'V') verbStep(c, it, parse); else parse();
  }

  /* ----- first step for a verb form: which verb is it? (a wrong answer skips the parse and brings the form back) ----- */
  function verbStep(c, it, parse) {
    const L = D.lexByN.get(it.strongs), t0 = clockNow(), opts = verbChoices(it.strongs); let aided = false, locked = false;
    const area = h('div.pq'), hintBox = h('div');
    const tally = (ok) => { if (c.retry) return; for (const o of [S.slots, st.slots]) { const s = (o.verb ||= [0, 0]); s[1]++; if (ok) s[0]++; } };
    const miss = async () => {                                   // the verb was not known: no parse; the form is rated as missed and comes round again
      tally(false); stop();
      const ms = clockNow() - t0; let next = null;
      if (!c.retry) {
        if (!practice) next = await rateParse(cardIdFor(c.id), 1, ms, { m: 'v', w: 'verb' });
        S.missed.push({ id: c.id, wrong: ['verb'] }); S.done++; if (c.type === 'new') S.fresh++;
        retryQ.push({ ...c, retry: true }); S.hist.push(false);
        if (!practice) await saveParseStats(st);
      } else if (!c.rescue) retryQ.push({ ...c, rescue: 'twice' });
      const go = h('button.btn.primary.block', { onclick: advance }, queue.length || retryQ.length ? 'Continue' : 'Finish');
      area.append(h('div.fb.bad', h('div.row.between', h('b', 'It is ' + L.head), c.retry || !next ? h('span.small.muted', 'practice only') : h('span.small.muted', 'next review in ' + fmtInterval(next.due - clockNow()))), h('div.small', L.head + ' · ' + L.brief + '. You’ll see this form again soon; parsing waits until you know the verb.')), go);
      go.focus({ preventScroll: true });
      keyHandler = (e) => { if (e.key === 'Enter') { e.preventDefault(); advance(); } };
      document.addEventListener('keydown', keyHandler);
    };
    const pick = (o, btn) => {
      if (locked) return; locked = true;
      const grid = area.querySelector('.vgrid'); grid.querySelectorAll('button').forEach((b) => { b.disabled = true; });
      if (o.n === it.strongs) { btn.classList.add('right'); tally(true); stop(); setTimeout(() => parse(aided), 420); return; }
      btn.classList.add('wrong'); grid.querySelector('[data-n="' + it.strongs + '"]').classList.add('right');
      hintBox.remove(); area.querySelector('.vrow')?.remove(); miss();
    };
    clear(area).append(
      h('div.vgrid', { dataset: { answer: it.strongs } }, opts.map((o, i) => h('button.popt.vopt', { dataset: { n: o.n }, onclick: (e) => pick(o, e.currentTarget) }, h('kbd', i + 1), h('b', { lang: 'grc' }, o.head), h('span.vgl', o.brief)))),
      h('div.row.between.vrow', h('button.btn.ghost.sm', { onclick: () => { aided = true; hintBox.replaceChildren(h('div.hint', 'Hint: look past any ending, and any prefix added at the front, to the part that stays the same.')); } }, 'Hint'),
        h('button.btn.ghost.sm', { onclick: () => { if (locked) return; locked = true; area.querySelector('.vgrid').querySelectorAll('button').forEach((b) => { b.disabled = true; }); area.querySelector('[data-n="' + it.strongs + '"]').classList.add('right'); area.querySelector('.vrow').remove(); hintBox.remove(); miss(); } }, 'I don’t know')), hintBox);
    frame(c, [prompt(c, it, { ask: 'Which verb is this?', hideVerb: true }), area]);
    stop();
    keyHandler = (e) => { const n = +e.key; if (!n) return; const b = area.querySelectorAll('.vopt')[n - 1]; if (b && !b.disabled) b.click(); };
    document.addEventListener('keydown', keyHandler);
  }

  /* ----- guided: one part at a time, immediate feedback ----- */
  function guided(c, it, t0, aided0 = false) {
    const answers = {}; let cands = it.valid.slice(), aided = aided0, gaveUp = false;
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
        h('div.row.between', h('button.btn.ghost.sm', { onclick: () => { aided = true; hintBox.replaceChildren(h('div.hint', 'Hint: look at the ending of ' + it.form.plain + ' first — it carries most of the information.')); } }, 'Hint'),
          h('button.btn.ghost.sm', { onclick: () => { gaveUp = true; cands[0].keys.forEach((k) => { if (!(k in answers)) answers[k] = undefined; }); end(); } }, 'I don’t know')), hintBox);
    };
    const pick = (slot, code, btn) => {
      const grid = btn.parentNode, matching = cands.filter((cd) => slotOK(slot, code, cd)), ok = matching.length > 0;
      answers[slot] = code; answers[slot + '_ok'] = ok;
      grid.querySelectorAll('button').forEach((b) => { b.disabled = true; });
      btn.classList.add(ok ? 'right' : 'wrong');
      const expected = (ok ? matching : cands)[0].slots[slot];
      if (!ok) {                                       // light up the right answer; a code with no button of its own (middle or passive deponent) lights its nearest button
        const show = grid.querySelector('[data-code="' + expected + '"]') || grid.querySelector('[data-code="' + (NEAREST[slot] || {})[expected] + '"]');
        show?.classList.add('right');
      }
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
      area.remove(); feedback(c, it, res, { ms: clockNow() - t0, aided, mode: 'g' });
    };
    frame(c, [prompt(c, it), area]); draw(); keys(null);
  }

  /* ----- quick: every part at once, then check ----- */
  function quick(c, it, t0, aided0 = false) {
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
      feedback(c, it, res, { ms: clockNow() - t0, aided: aided0, mode: 'q' });
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
  const order = ['verb', 'tense', 'voice', 'mood', 'person', 'number', 'case', 'gender', 'possessorNumber'];
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
    if (rest[0] === 'extra') {
      const q = buildParseExtra(rest[1] === 'preview' ? 'preview' : rest[1] === 'recent' ? 'recent' : rest[1] === 'review' ? 'review' : 'trouble');
      if (!q.length) { clear(view).append(h('div.pagehead', h('h1', 'Parsing')), h('div.card.stack', h('p', rest[1] === 'preview' ? 'No new forms to preview right now.' : rest[1] === 'recent' ? 'You haven’t started any words in the last few days, so there are no forms to practice yet.' : rest[1] === 'review' ? 'You haven’t studied any forms yet.' : 'Nothing is shaky right now: you haven’t missed or struggled with any of the forms you’ve studied.'), ...backLinks('#/parse', 'Back'))); return; }
      return runSession(view, q, { title: 'Strengthen weak spots', practice: true, restart: () => renderParse(view, params) });
    }
    if (rest[0] === 'build') return renderBuild(view, rest[1] === 'any' ? 'any' : 'known');
    if (rest[0] === 'clues') return rest[1] === 'form' ? renderClues(view, 'known', { formIdx: +rest[2], an: +rest[3] || 0 }) : renderClues(view, rest[1] === 'any' ? 'any' : 'known');
    if (rest[0] === 'rows') {                                     // from the chart picker: forms of several rows, practice only
      const keys = (rest[1] || '').split(',').filter((k) => ROWS.some((x) => x.key === k)), any = rest[2] === 'any';
      if (!keys.length) { location.hash = '#/learn/charts/pick'; return; }
      const q = rowsQueue(keys, any);
      if (!q.length) { clear(view).append(backHead('Parse from the chart', '#/learn/charts/pick', 'Back'), h('div.card.stack', h('p', 'There are no forms of these rows in ' + (any ? 'the text' : 'verbs you know yet') + '.'), h('a.btn', { href: '#/learn/charts/pick' }, 'Back to the picker'))); return; }
      return runSession(view, q, { title: 'Parse from the chart', practice: true, back: ['#/learn/charts/pick', 'Back to the picker'], restart: () => renderParse(view, params) });
    }
    if (rest[0] === 'row') {                                      // from the charts: forms of one row, practice only
      const r = ROWS.find((x) => x.key === rest[1]); if (!r) { location.hash = '#/learn/charts'; return; }
      const title = say(r.name).replace(/^./, (c) => c.toUpperCase()), any = rest[2] === 'any', q = rowQueue(r.key, any);
      if (!q.length) {
        clear(view).append(backHead(title, '#/learn/charts/paradigm/' + r.key, 'Paradigm'), h('div.card.stack',
          h('p', any ? 'There are no forms of this row in the text.' : 'There are no forms of this row in verbs you know yet. They appear as you learn more vocabulary.'),
          any ? null : h('a.btn', { href: '#/parse/run/row/' + r.key + '/any' }, 'Try with any verb'),
          h('a.btn', { href: '#/learn/charts/paradigm/' + r.key }, 'Back to the paradigm')));
        return;
      }
      return runSession(view, q, { title, practice: true, back: ['#/learn/charts/paradigm/' + r.key, 'Back to the paradigm'], restart: () => renderParse(view, params) });
    }
    if (rest[0] === 'ptc') {                                      // from the participle pages: participles of one kind (or any), practice only
      const key = rest[1] === 'all' ? null : rest[1], r = key ? PTCB.get(key) : null; if (key && !r) { location.hash = '#/learn/charts/participles'; return; }
      const title = r ? r.name + ' participles' : 'Participles', back = r ? '#/learn/charts/participle/' + r.key : '#/learn/charts/participles';
      const q = shuffle(participleForms(key).sort((a, b) => b.count - a.count).slice(0, 30)).slice(0, 12).map((x) => ({ id: x.id, type: 'row' }));
      if (!q.length) {
        const locked = participleForms(key, { ignoreLevel: true }).length > 0;
        clear(view).append(backHead(title, back, 'Participles'), h('div.card.stack',
          h('p', locked ? 'These forms open later, as you move through the parsing levels.' : 'There are no participles of this kind in verbs you know yet. They appear as you learn more vocabulary.'),
          h('a.btn', { href: back }, 'Back')));
        return;
      }
      return runSession(view, q, { title, practice: true, back: [back, 'Back to participles'], restart: () => renderParse(view, params) });
    }
    if (rest[0] === 'inf') {                                      // from the infinitive page: infinitives of one kind (or any), practice only
      const key = rest[1] === 'all' ? null : rest[1], r = key ? INFB.get(key) : null; if (key && !r) { location.hash = '#/learn/charts/infinitives'; return; }
      const title = r ? r.name + ' infinitives' : 'Infinitives', back = '#/learn/charts/infinitives';
      const q = shuffle(infinitiveForms(key).sort((a, b) => b.count - a.count).slice(0, 30)).slice(0, 12).map((x) => ({ id: x.id, type: 'row' }));
      if (!q.length) {
        const locked = infinitiveForms(key, { ignoreLevel: true }).length > 0;
        clear(view).append(backHead(title, back, 'Infinitives'), h('div.card.stack',
          h('p', locked ? 'These forms open later, as you move through the parsing levels.' : 'There are no infinitives of this kind in verbs you know yet. They appear as you learn more vocabulary.'),
          h('a.btn', { href: back }, 'Back')));
        return;
      }
      return runSession(view, q, { title, practice: true, back: [back, 'Back to infinitives'], restart: () => renderParse(view, params) });
    }
    if (rest[0] === 'sub') {                                      // from the subjunctive page: subjunctives of one kind (or any), practice only
      const key = rest[1] === 'all' ? null : rest[1], r = key ? SUBB.get(key) : null; if (key && !r) { location.hash = '#/learn/charts/subjunctive'; return; }
      const title = r ? r.name + ' subjunctives' : 'Subjunctive', back = r ? '#/learn/charts/subjunctive/' + r.key : '#/learn/charts/subjunctive';
      const q = shuffle(subjunctiveForms(key).sort((a, b) => b.count - a.count).slice(0, 30)).slice(0, 12).map((x) => ({ id: x.id, type: 'row' }));
      if (!q.length) {
        const locked = subjunctiveForms(key, { ignoreLevel: true }).length > 0;
        clear(view).append(backHead(title, back, 'Subjunctive'), h('div.card.stack',
          h('p', locked ? 'These forms open later, as you move through the parsing levels.' : 'There are no subjunctives of this kind in verbs you know yet. They appear as you learn more vocabulary.'),
          h('a.btn', { href: back }, 'Back')));
        return;
      }
      return runSession(view, q, { title, practice: true, back: [back, 'Back to subjunctive'], restart: () => renderParse(view, params) });
    }
    if (rest[0] === 'imp') {                                      // from the imperative page: imperatives of one kind (or any), practice only
      const key = rest[1] === 'all' ? null : rest[1], r = key ? IMPB.get(key) : null; if (key && !r) { location.hash = '#/learn/charts/imperative'; return; }
      const title = r ? r.name + ' imperatives' : 'Imperative', back = r ? '#/learn/charts/imperative/' + r.key : '#/learn/charts/imperative';
      const q = shuffle(imperativeForms(key).sort((a, b) => b.count - a.count).slice(0, 30)).slice(0, 12).map((x) => ({ id: x.id, type: 'row' }));
      if (!q.length) {
        const locked = imperativeForms(key, { ignoreLevel: true }).length > 0;
        clear(view).append(backHead(title, back, 'Imperative'), h('div.card.stack',
          h('p', locked ? 'These forms open later, as you move through the parsing levels.' : 'There are no imperatives of this kind in verbs you know yet. They appear as you learn more vocabulary.'),
          h('a.btn', { href: back }, 'Back')));
        return;
      }
      return runSession(view, q, { title, practice: true, back: [back, 'Back to imperative'], restart: () => renderParse(view, params) });
    }
    if (rest[0] === 'verbs') {                                    // the required forms of the verbs you are working on (or one verb)
      const ns = rest[1] ? [+rest[1]] : startedVerbs(), ids = [...new Set(ns.flatMap((n) => [...requiredFormIds(n)]))].filter((id) => itemOf(id));
      const due = new Set(parseCardsDue().map((c) => keyMap.get(c.id)));
      const dueQ = ids.filter((id) => due.has(id) && !isFresh(id)).map((id) => ({ id, type: 'due' })), newQ = shuffle(ids.filter((id) => isFresh(id))).slice(0, Math.max(5, setting('sessionSize') - dueQ.length)).map((id) => ({ id, type: 'new' }));
      let q = shuffle([...dueQ, ...newQ]), practice = false;
      if (!q.length) { q = shuffle(ids.map((id) => ({ id, type: 'practice' }))); practice = true; }
      if (!q.length) { clear(view).append(h('div.pagehead', h('h1', 'Verb forms')), h('div.card.stack', h('p', 'There are no forms to practice yet. Verbs come in with your vocabulary.'), ...backLinks('#/learn/verbs', 'Back to Verbs'))); return; }
      return runSession(view, q, { title: 'Verb forms', practice, restart: () => renderParse(view, params) });
    }
    if (rest[0] === 'passage') {
      const [, book, c1, v1, c2, v2, k] = rest; if (!D.bookByCode.has(book)) { location.hash = '#/parse'; return; }
      scope = { book, c1: +c1, v1: +v1 || 1, c2: +c2 || +c1, v2: +v2 || 999 }; kind = k || 'all';
    } else kind = rest[1] || 'all';
    const q = buildParseSession({ scope, kind });
    if (!q.length) {
      if (!scope) { const alt = smart('parse'); if (alt.kind !== 'go') { location.replace(alt.href); return; } }
      clear(view).append(h('div.pagehead', h('h1', 'Parsing')), h('div.card.stack',
        h('p', scope ? 'There is nothing to parse in ' + scopeLabel(scope) + ' for this selection.' : 'You’re all caught up. 🎉'), ...backLinks('#/parse', 'Back')));
      return;
    }
    return runSession(view, q, { title: scope ? scopeLabel(scope) : KIND_TITLE[kind], scope, restart: () => renderParse(view, params) });
  }
  if (mode === 'form') return practiceForm(view);
  if (mode === 'kinds') return rest[0] === 'ind' ? renderRows(view) : renderKinds(view, rest[0]);
  if (mode === 'gates') return renderGates(view);
  if (mode === 'howto') return renderHowto(view);
  landing(view);
}

const gk = (t) => h('span', { lang: 'grc' }, t);
async function landing(view) {
  ensureIndex();
  const st = await getParseStats();
  const weak = Object.entries(st.slots).filter(([, v]) => v[1] >= 8).map(([k, v]) => [k, v[0] / v[1]]).sort((a, b) => a[1] - b[1])[0];
  const sm = smart('parse'), nv = verbsInProgress();
  clear(view).append(
    backHead('Parsing', '#/home', 'Home'),
    h('div.stack',
      startButton(sm),
      paceNote(parsePace(), 'forms'),
      h('div.row.wrap.links', h('a.btn.sm', { href: TOPICS.parse.preview }, 'Look ahead at new forms'), sm.kind === 'review' ? null : h('a.btn.sm', { href: TOPICS.parse.review }, 'Review forms I’ve learned'), h('a.btn.sm', { href: TOPICS.parse.reinforce }, 'Strengthen weak spots')),
      unlockSection(),
      h('div.sec', 'Free practice'),
      areaCard({ href: '#/parse/form', ic: 'text', title: 'Practice by form', sub: 'Take real forms apart or put them together', ex: 'Clue hunt · Build the form · Parse from the chart' }),
      areaCard({ href: '#/parts/exercise', ic: 'book', title: 'Principal parts practice', sub: 'Know the principal parts each verb is built from' }),
      areaCard({ href: '#/learn/verbs', ic: 'learn', title: 'Your verbs', sub: 'See how each verb you are learning is going', ex: nv ? nv + (nv === 1 ? ' verb' : ' verbs') + ' in progress' : null }),
      Object.keys(st.slots).length ? fold('How you’re doing', slotBars(st.slots), weak && weak[1] < 0.85 ? h('p.small.muted', 'Weakest so far: ' + SLOT_TITLE[weak[0]].toLowerCase() + '.') : null) : null));
}
/** Practice by form: three ways to work on real forms. Practice only. */
function practiceForm(view) {
  clear(view).append(backHead('Practice by form', '#/parse', 'Parsing'), h('div.stack',
    h('p.muted.small', { style: { margin: 0 } }, 'Real forms from the text. Practice only: nothing here changes your review schedule.'),
    areaCard({ href: '#/parse/run/clues/known', ic: 'text', title: 'Clue hunt', sub: 'Name the form by finding its clues, one at a time', ex: h('span', 'You see ', gk('ἐπίστευσαν'), ' and pick the augment, stem, formative and ending.') }),
    areaCard({ href: '#/parse/run/build/known', ic: 'learn', title: 'Build the form', sub: 'Put a form together from its pieces', ex: h('span', 'You are told “aorist active, 3rd plural of ', gk('πιστεύω'), '” and build it step by step.') }),
    areaCard({ href: '#/learn/charts/pick', ic: 'table', title: 'Parse from the chart', sub: 'Practice the chart rows you choose', ex: 'Pick rows, such as the imperfect, then parse real forms from them.' })));
}
