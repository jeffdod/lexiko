// Verbs in -μι: a reference page, by root class. The infinitive and participle quizzes also take these verbs, splitting them into
// prefix · reduplication · root · ending. Practice only: nothing here touches the review schedule.
import { MI_PAGE } from './midata.js';
import { h, clear, backHead } from './util.js';

const lg = (t, cls = '') => h('span' + cls, { lang: 'grc' }, t);

export function renderMi(view) {
  const cards = MI_PAGE.map((v) => {
    const hasAor = v.rows.some((r) => r[2]);
    return h('div.card.stack', h('div.row.between', h('h2', lg(v.verb), ' · ', v.gloss), h('span.chip', v.cls + (v.root ? ' · ' + v.root : ''))),
      h('div.cscroll', h('table.mitab', h('thead', h('tr', h('th', ''), h('th', 'Present'), hasAor ? h('th', 'Aorist') : null)),
        h('tbody', v.rows.map((r) => h('tr', h('th', { scope: 'row' }, r[0]), h('td', { lang: 'grc' }, r[1] || '—'), hasAor ? h('td', { lang: 'grc' }, r[2] || '—') : null))))),
      v.note ? h('p.muted.small', v.note) : null);
  });
  clear(view).append(backHead('Verbs in -μι', '#/learn/charts', 'Charts'), h('div.stack',
    h('div.card.stack', h('h2', 'Four classes, one pattern each'),
      h('p.small', '-μι verbs are sorted by the vowel their root ends in. Learn the pattern for one verb in a class and the rest follow. Always learn the ', h('b', 'root'), ' with the verb: the aorist and future are built from it, without the reduplication.'),
      h('p.small.muted', 'In the present, the stem is reduplicated with an ', h('b', 'ι'), ' (', lg('δι-δο-'), '); in the perfect it is reduplicated with an ', h('b', 'ε'), ' (', lg('δέ-δω-κα'), '). The indicative aorist uses κα (', lg('ἔδωκα'), '); the infinitive, participle and the other moods use the bare root.')),
    ...cards,
    h('p.muted.small', 'The infinitive and participle quizzes include these verbs and name the reduplication and the root. Their subjunctive and imperative forms are on this page only.')));
}
