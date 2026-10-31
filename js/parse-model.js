// Parsing model (no DOM): which slots to ask for each kind of word, and how an answer is checked.
// Slots are always asked in a fixed order. Verbs: tense → voice → mood → person → number
// (infinitive stops after mood; participles continue with case → number → gender).
// Everything else: case → number → gender (personal/reflexive/possessive pronouns add person first).
import { decode, CASE, NUM, GEN, TENSE, MOOD } from './morph.js';

export const SLOT_TITLE = { tense: 'Tense', voice: 'Voice', mood: 'Mood', person: 'Person', number: 'Number', case: 'Case', gender: 'Gender', possessorNumber: 'Possessor number' };

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

/**
 * What a word is asked for follows its Robinson–Pierpont code exactly:
 *   V  verbs                   tense, voice, mood, then person+number (finite) / case+number+gender (participle) / nothing (infinitive)
 *   P  1st/2nd-person pronoun  person, case, number              (P-1NS, P-2GP — RP gives no gender)
 *   F  reflexive pronoun       person, case, number, gender      (F-3ASM)
 *   S  possessive pronoun      possessor person, possessor number, case, number, gender   (S-1SNSM)
 *   N  everything else         case, number, gender              (nouns, adjectives, article, 3rd-person personal pronouns P-GSM,
 *                                                                 relative, demonstrative, interrogative, indefinite, … pronouns)
 */
export function groupOf(d) {
  const s = d.slots;
  if (d.pos === 'V') return s.mood && s.tense && s.voice ? 'V' : null;
  if (d.pos === 'P' && /^P-[123]/.test(d.code)) return s.person && s.case && s.number ? 'P' : null;
  if (d.pos === 'F') return s.person && s.case && s.number && s.gender ? 'F' : null;
  if (d.pos === 'S') return s.person && s.possessorNumber && s.case && s.number && s.gender ? 'S' : null;
  return s.case && s.number && s.gender ? 'N' : null;
}

/** Slot order for a group; for verbs it depends on the mood chosen so far. */
export function slotOrder(group, mood) {
  switch (group) {
    case 'V': return ['tense', 'voice', 'mood', ...(!mood ? [] : mood === 'N' ? [] : mood === 'P' ? ['case', 'number', 'gender'] : ['person', 'number'])];
    case 'P': return ['person', 'case', 'number'];
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
 * The data stores each reading of a written form as its own row (τὰ is one row as T-NPN and another as T-APN).
 * Group the rows that are the same written form of the same word, so every reading counts as correct.
 * Returns canon[i] = index of the most frequent row of row i's group, and members: canonical index -> all rows in the group.
 */
export function groupForms(forms) {
  const by = new Map(), canon = new Array(forms.length), members = new Map();
  forms.forEach((f, i) => { const k = f.w.replace(/\u00ad/g, '') + '|' + (f.an[0] && f.an[0].s); (by.get(k) || by.set(k, []).get(k)).push(i); });
  for (const ids of by.values()) {
    ids.sort((a, b) => forms[b].count - forms[a].count || a - b);
    for (const i of ids) canon[i] = ids[0];
    members.set(ids[0], ids);
  }
  return { canon, members };
}

/** One form carrying every reading of its group (most frequent first), for buildItem. */
export function mergeForms(forms, ids) {
  const an = [], seen = new Set();
  for (const i of ids) for (const a of forms[i].an) { const k = a.s + ':' + a.m; if (!seen.has(k)) { seen.add(k); an.push(a); } }
  return { ...forms[ids[0]], count: ids.reduce((n, i) => n + forms[i].count, 0), an };
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
  return { form, strongs: first.s, group, valid, kind: d0.pos === 'V' ? 'verb' : 'nominal' };
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
export function describe(cand) {
  const d = cand.d, sl = cand.slots; if (d.pos === 'V') return d.summary;
  const L = (k) => labelOf(k, sl[k]), tail = (d.notes.length ? ' (' + d.notes.join(', ') + ')' : '');
  const cng = ['case', 'number', 'gender'].filter((k) => sl[k] != null).map(L).join(' ');
  if (d.pos === 'S') return L('person') + ' person ' + L('possessorNumber').toLowerCase() + ' possessor, ' + cng + tail;
  if (sl.person != null && (d.pos === 'F' || cand.code.startsWith('P-1') || cand.code.startsWith('P-2'))) return L('person') + ' person ' + cng + tail;
  return cng + tail;
}
