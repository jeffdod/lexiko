// Study: the three places to practice and look things up. (Home is the dashboard.)
import { counts } from './smart.js';
import { h, clear, icon } from './util.js';

const area = (href, ic, title, sub, badges = []) => { const bs = badges.filter(Boolean); return h('a.area', { href }, icon(ic, 30), h('div', h('b', title), h('span', sub)), bs.length ? h('div.badges', bs.map((t) => h('em.due', t))) : null); };

export function renderStudy(view) {
  const cnt = counts();
  const nothingYet = !cnt.words.studied && !cnt.parse.due && !cnt.parse.fresh;
  clear(view).append(h('div.pagehead', h('h1', 'Study')), h('div.stack',
    area('#/learn/words', 'learn', 'Vocabulary', 'Learn, review, look ahead', [cnt.words.total ? cnt.words.total + (cnt.words.total === 1 ? ' word' : ' words') : '']),      // one total, always the same as the count inside the session
    area('#/parse', 'text', 'Parsing', nothingYet ? 'Opens as you learn words' : 'Practice forms and unlock verb types', [cnt.parse.total ? cnt.parse.total + (cnt.parse.total === 1 ? ' form' : ' forms') : '']),
    area('#/reference', 'table', 'Reference', 'Glossary, charts and paradigms'),
    h('a.small.center', { href: '#/help', style: { textAlign: 'center' } }, 'How lexiko works ›')));
}
