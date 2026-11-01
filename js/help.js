// "How lexiko works": plain-language help for newcomers, in short folds so an expert can skip it.
import { h, clear, fold } from './util.js';

export function renderHelp(view) {
  const p = (t) => h('p', t);
  clear(view).append(h('div.pagehead', h('h1', 'How lexiko works')), h('div.stack',
    h('p.muted', 'lexiko helps you build your Greek vocabulary and read the Greek New Testament better. It doesn’t teach grammar; it gives you the words and the practice.'),
    fold('Reading',
      p('Open Read, choose a book and chapter, and tap any word to see what it means and what form it is. Words you haven’t learned yet are underlined; words you’re still learning are underlined differently. You can turn on short glosses for new words in the reading options (the Aa button).'),
      p('Tap “I know this” on a word you’re sure of, or “Learn this” to add it to your reviews. The percentage at the top of a chapter is how many of its words you know, and the label next to it says how comfortable it will be to read.')),
    fold('Known, learning and new',
      p('Known: you’ve reviewed the word enough that you’re likely to remember it, or you’ve said your level covers it. Learning: you’ve started it but it isn’t secure yet. New to you: you haven’t met it.'),
      p('Your level (in Settings) says “I already know every word that occurs at least this many times.” lexiko believes you, but quizzes you now and then on those words, and moves any you’ve forgotten back to learning.')),
    fold('Reviews',
      p('Each word has a review schedule. After you see the answer, rate yourself: Again (forgot it), Hard, Good or Easy. Words you find easy come back after a longer wait; words you miss come back soon. This is spaced repetition, using the open FSRS method.'),
      p('The big button on Home always chooses the most useful thing to do next: reviews that are due, then new words, then extra practice when you’re caught up.')),
    fold('Strengthen weak spots and Look ahead',
      p('Strengthen weak spots practises the cards you miss most. Look ahead shows a few new words without starting them. Neither changes your review schedule.')),
    fold('Word forms, principal parts and charts',
      p('Parsing practice asks you to name the parts of a word form, such as tense, voice and mood for a verb, or case, number and gender for a noun. Principal parts practice drills the six forms each verb comes in. The Charts button in these quizzes opens the verb charts and a chart of noun and adjective endings counted from the text.')),
    fold('Search',
      p('The magnifier on Home finds a word by its Greek form, with or without accents, or by Beta Code (a way of entering Greek without a Greek keyboard), by its English meaning, or by its Strong’s number. Without accents it finds every accented form; with accents it finds only those.')),
    fold('Your progress and backups',
      p('Everything is saved on this device only: there is no account and no server. Back up now and then in Settings, and you can restore on any device. A backup can also be locked with a passphrase.')),
    h('a.btn', { href: '#/home' }, 'Back to Home')));
}
