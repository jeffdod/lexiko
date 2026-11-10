// "Where did this go wrong?" — the closed fold under a missed verb parsing.
// It explains only the first wrong part: it shows the learner's answer as a real form of the SAME verb (when the text has one),
// the quiz word, the letters that differ, and what to look for. Nothing here is generated: every word comes from the text.
import { D } from './data.js';
import { decode } from './morph.js';
import { slotOrder, labelOf } from './parse-model.js';
import { ROWS, say } from './chartdrill.js';
import { chartRowForSlots } from './charts.js';
import { hintFor } from './verbhints.js';
import { h } from './util.js';

const lc = (s) => s.charAt(0).toLowerCase() + s.slice(1);
const a_ = (s) => (/^[aeiou]/i.test(s) ? 'an ' : 'a ') + lc(s);
const ROW = Object.fromEntries(ROWS.map((r) => [r.key, r]));
const PARSE_KEYS = ['tense', 'voice', 'mood', 'person', 'number', 'case', 'gender'];

/** The slots of the answer the learner gave: the correct parsing with only the first wrong part replaced. */
export function answeredSlots(best, slot, user) {
  const ans = { ...best.slots, [slot]: user };
  const order = slotOrder('V', ans.mood);
  for (const k of PARSE_KEYS) if (!order.includes(k) || (k !== slot && ans[k] === undefined)) { if (k !== slot) delete ans[k]; }
  return ans;
}

/** The most frequent form of this verb whose tag matches the answered parsing (second-tense flag ignored), or null. */
export function findForm(strongs, ans, notPlain) {
  const keys = slotOrder('V', ans.mood).filter((k) => ans[k] != null);
  let top = null;
  for (const f of D.forms) {
    if (f.plain === notPlain) continue;
    for (const a of f.an) {
      if (a.s !== strongs || !a.m.startsWith('V-')) continue;
      const sl = decode(a.m).slots;
      if (sl.voice === 'E' || !keys.every((k) => sl[k] === ans[k])) continue;
      if (!top || f.count > top.f.count) top = { f, tag: a.m, slots: sl };
    }
  }
  return top;
}

/** The two words with their differing letters set apart (common start and end are left plain). */
function diff(a, b) {
  let p = 0; while (p < a.length && p < b.length && a[p] === b[p]) p++;
  let s = 0; while (s < a.length - p && s < b.length - p && a[a.length - 1 - s] === b[b.length - 1 - s]) s++;
  const cut = (w) => [w.slice(0, p), w.slice(p, w.length - s), w.slice(w.length - s)];
  return [cut(a), cut(b)];
}
const word = ([pre, mid, suf]) => h('span.whyword', { lang: 'grc' }, pre, mid ? h('span.dif', mid) : null, suf);

/** What sits in front of the stem, as the one clue the learner should look at. */
const FRONT = { '': 'nothing in front of the stem', 'ε': 'an augment in front (ε, or a lengthened first vowel)', RED: 'reduplication in front (the first consonant doubled with ε)' };
/** Real endings, so the clue can be recognized in the word. */
const ENDEX = { 'prim act': '-ω, -εις, -ει, -ομεν, -ετε, -ουσι', 'sec act': '-ον, -ες, -ε(ν), -ομεν, -ετε, -ον', 'prim mid/pas': '-μαι, -σαι, -ται, -μεθα, -σθε, -νται', 'sec mid/pas': '-μην, -σο, -το, -μεθα, -σθε, -ντο' };
const mark = (r) => (r.form ? 'the tense marker -' + r.form + '-' : 'no tense marker');
const bare = (w) => w.normalize('NFD').replace(/[̀-ͯ]/g, '');
const isContract = (n) => { const L = D.lexByN.get(n); return !!L && /[αεο]ω$/.test(bare(L.head)); };

/**
 * One plain sentence naming the single clue that separates the quiz word's row of the master verb chart from the row the learner named.
 * The clues are taken in a fixed order: the front, then the tense marker, then the ending; if all three match, only the stem differs.
 * Nothing is said where the clue could mislead: a verb whose first vowel is already long shows no visible augment (the real words
 * start alike), and contract verbs blend their vowels in the present and imperfect, so the plain ending list would not match the word.
 */
function rowRule(quizSlots, ansSlots, strongs, quizWord, gotWord) {
  const B = ROW[chartRowForSlots(quizSlots)], A = ROW[chartRowForSlots(ansSlots)];
  if (!A || !B || A.key === B.key) return null;
  const an = a_(say(A.name));
  const alikeStart = gotWord && bare(quizWord).slice(0, 2) === bare(gotWord).slice(0, 2);
  if (A.aug !== B.aug && !alikeStart) return 'Look at the front of the word. This word has ' + FRONT[B.aug] + '; ' + an + ' has ' + FRONT[A.aug] + '.';
  if (A.form !== B.form) return 'Look at what follows the stem. This word has ' + mark(B) + '; ' + an + ' has ' + mark(A) + '.';
  if (A.ends !== B.ends) {
    if (isContract(strongs) && /^(pres|impf)/.test(B.key + A.key)) return null;
    return 'Look at the ending. This word ends in ' + ENDEX[B.ends] + '; ' + an + ' ends in ' + ENDEX[A.ends] + '.';
  }
  return A.aug === B.aug ? 'Only the stem differs. Compare the stems of the two words; the letters that differ are set apart above.' : null;
}

const parsingText = (slots) => slotOrder('V', slots.mood).filter((k) => slots[k] != null).map((k) => labelOf(k, slots[k])).join(' · ');

/** Build the fold, or null when there is nothing accurate to say (a fully right answer, "I don't know", a non-verb). */
export function whyWrong(it, res) {
  if (it.group !== 'V' || res.full) return null;
  const slot = res.wrong[0]; if (!slot) return null;
  const user = res.perSlot[slot].user; if (!user || user === 'E') return null;
  const best = res.best, ans = answeredSlots(best, slot, user), got = findForm(it.strongs, ans, it.form.plain);
  const quiz = it.form.plain;
  let rule = null;
  const hint = hintFor({ strongs: it.strongs, quiz: best.slots, ans, got, slot });   // hand-written hints for easily confused pairs (js/verbhints.js)
  if (['person', 'number', 'case', 'gender'].includes(slot)) rule = 'This is marked in the ending, so compare how the two words end. The letters that differ are set apart above.';
  else if (hint) rule = hint.text;
  if (!hint && (slot === 'tense' || slot === 'voice') && best.slots.mood === 'I' && ans.mood === 'I') rule = rowRule(best.slots, got ? got.slots : ans, it.strongs, quiz, got && got.f.plain);
  // spelled alike: the learner's reading is the same word as the quiz word, so show it once instead of "no form like that"
  const same = !!(hint && hint.same);
  const [gw, qw] = same ? [[quiz, '', ''], [quiz, '', '']] : got ? diff(got.f.plain, quiz) : [null, [quiz, '', '']];
  const block = (label, parsing, body) => h('div.whyblock', h('div.whylabel', label), h('div.whyparse', parsing), body);
  return h('details.whyfold', h('summary', 'Where did this go wrong?'),
    h('div.whybody',
      block('You answered', parsingText(ans), got || same ? word(gw) : h('div.small.muted', 'This verb has no form like that in the Greek text.')),
      block('This word', parsingText(best.slots), word(qw)),
      rule ? h('div.whyblock', h('div.whylabel', 'What to look for'), h('div.whyrule', rule)) : null));
}
