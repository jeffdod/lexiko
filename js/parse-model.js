// Parsing model (no DOM): which slots to ask for each kind of word, and how an answer is checked.
// Slots are always asked in a fixed order. Verbs: tense → voice → mood → person → number
// (infinitive stops after mood; participles continue with case → number → gender).
// Everything else: case → number → gender (personal/reflexive/possessive pronouns add person first).
import { decode, CASE, NUM, GEN, TENSE, MOOD } from './morph.js';

export const SLOT_TITLE = { tense: 'Tense', voice: 'Voice', mood: 'Mood', person: 'Person', number: 'Number', case: 'Case', gender: 'Gender', possessorNumber: 'Possessor' };

const VOICE_OPTS = { A: 'Active', M: 'Middle', P: 'Passive', E: 'Middle or passive', D: 'Middle deponent', O: 'Passive deponent' };
const PERSON_OPTS = { 1: '1st', 2: '2nd', 3: '3rd' };
const POSS_OPTS = { S: 'Singular', P: 'Plural' };
const SHORT = { Nominative: 'Nom', Genitive: 'Gen', Dative: 'Dat', Accusative: 'Acc', Vocative: 'Voc' };

/** Option lists, in display order: [[code, label], ...]. */
export const OPTIONS = {
  tense: Object.entries(TENSE),
  voice: Object.entries(VOICE_OPTS),
  mood: Object.entries(MOOD),
  person: Object.entries(PERSON_OPTS),
  number: Object.entries(NUM),
  case: Object.entries(CASE),
  gender: Object.entries(GEN),
  possessorNumber: Object.entries(POSS_OPTS),
};
export const shortCase = (c) => SHORT[CASE[c]] || c;

const LABELS = {
  tense: TENSE, mood: MOOD, number: NUM, case: CASE, gender: GEN, person: PERSON_OPTS, possessorNumber: POSS_OPTS,
  voice: { ...VOICE_OPTS, N: 'Middle or passive deponent', Q: 'Impersonal active', X: 'No voice' },
};
export const labelOf = (slot, code) => (LABELS[slot] && LABELS[slot][code]) || code;

/** Word group decides the slot sequence: 'V' (verb), 'P' (personal), 'F' (reflexive), 'S' (possessive), 'N' (case/number/gender). */
export function groupOf(d) {
  const s = d.slots;
  if (d.pos === 'V') return s.mood && s.tense && s.voice ? 'V' : null;
  if (d.pos === 'P') return s.person && s.case && s.number ? 'P' : null;
  if (d.pos === 'F') return s.person && s.case ? 'F' : null;
  if (d.pos === 'S') return s.person && s.case ? 'S' : null;
  return s.case && s.number && s.gender ? 'N' : null;
}

/** Slot order for a group; for verbs it depends on the mood chosen so far. */
export function slotOrder(group, mood) {
  switch (group) {
    case 'V': return ['tense', 'voice', 'mood', ...(!mood ? [] : mood === 'N' ? [] : mood === 'P' ? ['case', 'number', 'gender'] : ['person', 'number'])];
    case 'P': return ['person', 'case', 'number', 'gender'];   // gender only asked when the answer has one (3rd person)
    case 'F': return ['person', 'case', 'number', 'gender'];
    case 'S': return ['person', 'possessorNumber', 'case', 'number', 'gender'];
    default: return ['case', 'number', 'gender'];
  }
}

/** The slots that actually have an answer in this analysis (e.g. a 1st-person pronoun has no gender). */
export function keySlots(d) {
  const g = groupOf(d);
  return slotOrder(g, d.slots.mood).filter((k) => d.slots[k] != null);
}

/**
 * Everything needed to quiz one word form: the lemma to show and every analysis that counts as correct.
 * A form can have alternate parsings (e.g. N-NSF and N-VSF); all with the same lexeme and shape are accepted.
 */
export function buildItem(form) {
  const first = form.an[0]; if (!first) return null;
  const d0 = decode(first.m), group = groupOf(d0);
  if (!group) return null;
  const valid = [];
  for (const a of form.an) {
    if (a.s !== first.s) continue;
    const d = decode(a.m);
    if (groupOf(d) !== group) continue;
    valid.push({ code: a.m, d, slots: d.slots, keys: keySlots(d) });
  }
  return { form, strongs: first.s, group, valid, kind: d0.pos === 'V' ? 'verb' : group === 'N' ? 'nominal' : 'pronoun' };
}

/** Is this voice answer acceptable for the RP voice code? (Deponents and "middle or passive" forms accept their plain equivalents.) */
export function voiceOK(user, key) {
  switch (key) {
    case 'E': return 'EMP'.includes(user);
    case 'D': return user === 'D' || user === 'M';
    case 'O': return user === 'O' || user === 'P';
    case 'N': return 'EDOMP'.includes(user);
    case 'Q': return user === 'A' || user === 'Q';
    case 'X': return true;
    default: return user === key;
  }
}

export function slotOK(slot, user, cand) {
  const key = cand.slots[slot];
  if (user === key) return true;
  if (user == null) return false;
  if (slot === 'voice') return voiceOK(user, key);
  if (slot === 'case' && cand.slots.number === 'P') return (user === 'N' && key === 'V') || (user === 'V' && key === 'N');   // plural vocative = nominative
  return false;
}

/**
 * Score an answer ({tense:'A', voice:'P', ...}) against all valid parsings.
 * Returns {perSlot:{slot:{ok,expected,user,soft}}, full, best, accepted:[codes], wrong:[slots]}.
 */
export function check(item, answer) {
  let best = null;
  for (const cand of item.valid) {
    const per = {}; let hits = 0;
    for (const k of cand.keys) {
      const ok = slotOK(k, answer[k], cand);
      per[k] = { ok, expected: cand.slots[k], user: answer[k], soft: ok && answer[k] !== cand.slots[k] };
      if (ok) hits++;
    }
    const full = hits === cand.keys.length;
    if (!best || (full && !best.full) || (full === best.full && hits > best.hits)) best = { cand, per, hits, full };
  }
  return {
    perSlot: best.per, full: best.full, best: best.cand, hits: best.hits, total: best.cand.keys.length,
    accepted: item.valid.map((v) => v.code), wrong: Object.keys(best.per).filter((k) => !best.per[k].ok),
  };
}

/** FSRS grade from a result: all right → Good (Easy if quick and unaided), one slip → Hard, otherwise Again. */
export function gradeOf(res, { ms = 0, aided = false } = {}) {
  if (res.full) return aided ? 2 : ms && ms < 4500 + 1500 * res.total ? 4 : 3;
  return res.total >= 3 && res.wrong.length === 1 ? 2 : 1;
}

/** Plain-English one-liner for a parsing, e.g. "Aorist Passive Indicative 3rd person Singular". */
export const describe = (cand) => cand.d.summary;
