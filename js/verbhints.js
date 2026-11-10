// Plain-language hints for easily confused verb forms, shown under "What to look for" in the "Where did this go wrong?" fold
// (js/whywrong.js). Each hint is written by hand and only appears when the learner's answer and the quiz word really are that pair.
// A hint is a short rule about what to look at in the word; nothing here is generated from the text.
import { sameSpelledMP, labelOf } from './parse-model.js';
import { isLiquidVerb } from './families.js';
import { D } from './data.js';

export const HINTS = {
  stem2Ind: 'A 2nd aorist uses a different stem from the present. The imperfect keeps the present stem. Both have the augment and the same endings, so the stem is the only clue.',
  stem2: 'Outside the indicative there is no augment, and a 2nd aorist takes the same endings as the present. The stem is the only clue: a 2nd aorist uses a different stem from the present.',
  aor1: 'A 1st aorist has the tense marker -σ- (-σα- in most forms), and the passive has -θη-. The present has no such marker. Neither has an augment outside the indicative.',
  aorPerf: 'The perfect keeps its reduplication in every mood. The aorist has no augment outside the indicative.',
  presPerf: 'Look at the front of the word: the perfect has reduplication (or a lengthened first vowel), and the present does not.',
  aorMP: 'The aorist passive has -θη- (-η- in the 2nd aorist) and takes active-looking endings. The aorist middle has the middle endings.',
  ptcVoice: 'A middle or passive participle ends in -μενος, -μενη, -μενον. An active participle does not.',
  ptcVoiceAorPas: 'A middle or passive participle ends in -μενος, -μενη, -μενον. An active participle does not. The aorist passive is the exception: it ends in -θεις, -θεισα, -θεν but is passive.',
  infVoice: 'A middle or passive infinitive ends in -σθαι. Active infinitives end in -ειν, -σαι or -ναι. The aorist passive is the exception: it ends in -θηναι but is passive.',
  subInd: 'The subjunctive has long vowels in its endings (ω, η, ῃ, ωμεν, ητε, ωσιν) where the indicative has short ones (ο, ε). The aorist subjunctive also has no augment.',
  imp: 'Imperatives are the only forms with endings like -τω, -τωσαν, -σθω. In the 2nd person, look for -ε (present) or -σον (aorist).',
  ptc: 'A participle is the only verb form that declines. It has case, number and gender endings.',
  inf: 'An infinitive has no person, number, case or gender. Look at the ending: -ειν, -σαι, -ναι or -σθαι (contract verbs: -ᾶν, -εῖν, -οῦν).',
  subVoice: 'Look at the ending. Middle and passive subjunctives end in -μαι, -ται, -νται (also -μεθα, -σθε). Active subjunctives end in -ω, -ῃς, -ῃ, -ωμεν, -ητε, -ωσι. The aorist passive is the exception: it has -θ- and takes the active endings.',
  impVoice: 'Look at the ending. Middle and passive imperatives have -σθ- (-σθω, -σθε, -σθωσαν) or end in -ου or -σαι in the 2nd person singular. Active imperatives end in -τω, -τε, -τωσαν. The aorist passive is the exception: it has -θη- and takes the active endings.',
  same: 'These two forms look exactly the same. Only the context decides.',
};

const headOf = (n) => { const L = D.lexByN.get(n); return L ? L.head.normalize('NFD').replace(/[̀-ͯ]/g, '') : ''; };
/** Verbs whose 1st aorist has no -σ-: liquid verbs (-λω, -μω, -νω, -ρω) and verbs in -μι (κ-aorists). */
const noSigma = (n) => isLiquidVerb(n) || /μι$/.test(headOf(n));

const pair = (a, b, x, y) => (a === x && b === y) || (a === y && b === x);

/**
 * The hint for a missed verb, or null. quiz = slots of the quiz word, ans = slots of the learner's answer (first wrong part only),
 * got = the real form of this verb that matches the answer (or null), slot = the part that was wrong.
 * Returns { text, same } where `same` means the two readings are spelled alike (so the word itself is the answer's word too).
 */
export function hintFor({ strongs, quiz, ans, got, slot }) {
  if (!quiz || !ans) return null;
  const mood = quiz.mood;
  if (slot === 'tense' && ans.mood === mood) {
    const [tq, ta] = [quiz.tense, ans.tense];
    // the 2nd flag of the aorist side: the quiz word's own tag, or the attested form shown as the answer
    const aorSecond = tq === 'A' ? !!quiz.second : ta === 'A' ? (got ? !!got.slots.second : null) : null;
    const aorVoice = tq === 'A' ? quiz.voice : ans.voice;
    if (mood === 'I') {
      if (pair(tq, ta, 'I', 'A') && aorSecond && aorVoice !== 'P') return { text: HINTS.stem2Ind };
      return null;                                         // the other indicative pairs are covered by the chart-row rule in whywrong.js
    }
    if (!'SMNP'.includes(mood)) return null;
    if (pair(tq, ta, 'P', 'A')) {
      if (aorSecond === null) return null;
      if (aorSecond) return aorVoice === 'P' ? null : { text: HINTS.stem2 };
      return noSigma(strongs) ? null : { text: HINTS.aor1 };
    }
    if (pair(tq, ta, 'A', 'R')) return { text: HINTS.aorPerf };
    if (pair(tq, ta, 'P', 'R')) return { text: HINTS.presPerf };
    return null;
  }
  if (slot === 'voice' && ans.mood === mood) {
    const [vq, va] = [quiz.voice, ans.voice];
    if (pair(vq, va, 'M', 'P')) {
      if (sameSpelledMP(quiz) && sameSpelledMP(ans)) return { text: HINTS.same + ' Choose “' + labelOf('voice', 'E') + '” when you cannot tell.', same: true };
      if (quiz.tense === 'A' && ans.tense === 'A' && mood !== 'I') return { text: HINTS.aorMP };
      return null;
    }
    const act = vq === 'A' ? ans : va === 'A' ? quiz : null;     // the middle/passive side of an active vs middle/passive pair
    if (act && 'MP'.includes(act.voice)) {
      const aorPas = act.tense === 'A' && act.voice === 'P';
      if (mood === 'P') return { text: aorPas ? HINTS.ptcVoiceAorPas : HINTS.ptcVoice };
      if (mood === 'N') return { text: HINTS.infVoice };
      if (mood === 'S') return { text: HINTS.subVoice };
      if (mood === 'M') return { text: HINTS.impVoice };
    }
    return null;
  }
  if (slot === 'mood') {
    const [mq, ma] = [quiz.mood, ans.mood];
    // forms that are spelled alike in both moods: 1st singular present active (indicative or subjunctive), 2nd plural present (indicative or imperative)
    if (quiz.tense === 'P' && pair(mq, ma, 'I', 'S') && quiz.voice === 'A' && quiz.person === '1' && quiz.number === 'S') return { text: HINTS.same, same: true };
    if (quiz.tense === 'P' && pair(mq, ma, 'I', 'M') && quiz.person === '2' && quiz.number === 'P') return { text: HINTS.same, same: true };
    if (pair(mq, ma, 'I', 'S')) return { text: HINTS.subInd };
    if ((mq === 'N' && 'ISM'.includes(ma)) || (ma === 'N' && 'ISM'.includes(mq))) return { text: mq === 'M' || ma === 'M' ? HINTS.imp : HINTS.inf };
    if (mq === 'M' || ma === 'M') return 'ISNP'.includes(mq === 'M' ? ma : mq) ? { text: HINTS.imp } : null;
    if (mq === 'P' || ma === 'P') return 'ISN'.includes(mq === 'P' ? ma : mq) ? { text: HINTS.ptc } : null;
  }
  return null;
}
