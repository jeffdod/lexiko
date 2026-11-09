// "How lexiko works": plain-language help for newcomers, in short folds so an expert can skip it.
import { h, clear, fold } from './util.js';

export function renderHelp(view) {
  const p = (t) => h('p', t);
  clear(view).append(h('div.pagehead', h('h1', 'How lexiko works')), h('div.stack',
    h('p.muted', 'lexiko helps you build your Greek vocabulary and read the Greek New Testament with confidence. It doesn’t teach grammar; it gives you the words and the practice.'),
    fold('Reading',
      p('Open Read, choose a book and chapter, and tap any word to see what it means and what form it is. Words you haven’t learned yet are underlined; words you’re still learning are underlined differently. You can turn on short glosses for new words in the reading options (the Aa button). The same options can show the English translation with each verse (beside the Greek on a wide screen, under it on a phone).'),
      p('Tap “I know this” on a word you’re sure of, or “Learn this” to add it to your reviews. The percentage at the top of a chapter is how many of its words you know, and the label next to it says how comfortable it will be to read.')),
    fold('Known, learning and new',
      p('Known: you’ve reviewed the word enough that you’re likely to remember it, or you’ve said your level covers it. Learning: you’ve started it but it isn’t secure yet. New to you: you haven’t met it.'),
      p('Your level (in Settings) says “I already know every word that occurs at least this many times.” lexiko believes you, but quizzes you now and then on those words, and moves any you’ve forgotten back to learning.')),
    fold('Reviews',
      p('Each word has a review schedule. After you see the answer, rate yourself: Again (forgot it), Hard, Good or Easy. Words you find easy come back after a longer wait; words you miss come back soon. This is spaced repetition, using the open FSRS method.'),
      p('Missed words: at the end of a session, the words you missed come back in one retry round, and the screen counts how many are left. A word you miss again in that round comes back a few cards later as an easier multiple-choice question. Words that still are not settled when you finish come back together, once, about 10 minutes later the same day. If you miss them again then, they are due on your next study day.'),
      p('Tapped the wrong rating? “Undo last answer” under the card (or the U key) takes it back. The big button on the Vocabulary page always chooses the most useful thing to do next: reviews that are due, then new words, then extra practice when you’re caught up. Each day’s reviews and new words are fixed when the day starts, so when the page says you’re done for today, you’re done. If you want more, The badge on the Vocabulary tile on Home is the total number of words in today’s session. The button on the Vocabulary page shows the same total with its parts underneath: words that are due, new words, and check-ins, which are quick spot-checks of words you said you already know. “Study more today” adds the words you saw earlier today that are due again, plus another day’s worth of new words.')),
    fold('Installing and using it offline',
      p('lexiko works fully offline once it has loaded, and it can live on your home screen like any app. On an iPhone or iPad, open it in Safari, tap the Share button, then “Add to Home Screen”. On Android, open the browser menu and choose “Install app” or “Add to Home screen”. On a computer, Chrome and Edge show an install icon in the address bar. Settings also has an Install button where your browser allows it.'),
      p('When a new version is available, a small “Update ready” bar appears; tap Reload to switch to it.')),
    fold('Strengthen weak spots and Look ahead',
      p('Strengthen weak spots practices the cards you miss most. Look ahead shows a few new words without starting them. Neither changes your review schedule.')),
    fold('Parsing and reference',
      p('Parsing asks you to name the parts of a word form, such as tense, voice and mood for a verb, or case, number and gender for a noun. For verbs, lexiko picks the few forms worth learning (the ones that cover most of a verb’s uses) and teaches those; “Your verbs” on the Parsing page shows them. Principal parts practice is optional extra practice: nothing in it is scheduled or counted.'),
      p('New users start with vocabulary only. Once you have met a verb, lexiko asks whether you want to practice parsing verbs too; say yes and present active forms start coming up. Other types of verb forms open as you earn them. Learn a row of the master verb chart, or pass the “Which kind is it?” drill for a type of participle, infinitive, subjunctive or imperative. Under “What’s open” on the Parsing page you can see every kind and tick or untick any by hand. Nouns, adjectives and pronouns need no unlocking: they are asked once you know the word.'),
      p('Reference holds things to look up and study, with no scoring: the verb charts, the kinds of participle, infinitive, subjunctive and imperative, verbs in -μι, noun and adjective endings, contractions, and a read-only list of every verb’s principal parts. Each study page has a “Practice this” link that opens its exercise in Parsing.')),
    fold('Glossary',
      p('The Glossary, under Reference, lists every word in the text, in alphabetical order (alpha to omega, or reversed) or by how common it is. Type in its box to search instead: it finds a word by its Greek form, with or without accents, by Beta Code (a way of entering Greek without a Greek keyboard), by its English meaning, or by its Strong’s number. Without accents it finds every accented form; with accents it finds only those.')),
    fold('Your progress and backups',
      p('Everything is saved on this device only: there is no account and no server. Back up now and then in Settings, and you can restore on any device. A backup can also be locked with a passphrase.')),
    h('a.btn', { href: '#/home' }, 'Back to Home')));
}
