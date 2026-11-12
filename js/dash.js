// Home as a dashboard: which sections show and in what order. "Start here" is not a section: it is always first.
// The choice lives in the settings (homeOrder, homeHidden), so it travels with a backup.
import { K, setSetting } from './know.js';
import { h, icon, backHead } from './util.js';

export const SECTIONS = [
  { id: 'continue', name: 'Continue reading', sub: 'Back to where you stopped in the reader' },
  { id: 'goal', name: 'Goal', sub: 'Your goal, its progress and your numbers' },
  { id: 'reads', name: 'Good next reads', sub: 'Sections you could read now' },
  { id: 'growth', name: 'Growth', sub: 'Words you started learning over time (appears after a couple of days)' },
  { id: 'passages', name: 'Passages within reach', sub: 'Every chapter, by book' },
  { id: 'recent', name: 'Recent practice', sub: 'Reviews per day, and goals you have finished' },
  { id: 'votd', name: 'Verse of the day', sub: 'One verse of the Greek text each day, picked for the words you know', optIn: true },      // off until you turn it on
];
const IDS = SECTIONS.map((s) => s.id), OPT_IN = SECTIONS.filter((s) => s.optIn).map((s) => s.id);

/** All sections in the order chosen (new ones go last), and the set that is hidden. */
export function layout() {
  const saved = (K.settings.homeOrder || []).filter((id) => IDS.includes(id));
  const order = [...new Set([...(saved.includes('continue') ? [] : ['continue']), ...saved, ...IDS])];      // Continue reading is first until you move it
  const on = new Set(K.settings.homeOn || []);
  return { order, hidden: new Set([...(K.settings.homeHidden || []).filter((id) => IDS.includes(id)), ...OPT_IN.filter((id) => !on.has(id))]) };      // a section you have to ask for counts as hidden until you do
}

export function renderCustomize(view) {
  const draw = () => {
    const { order, hidden } = layout();
    const save = async (o, hd, on = K.settings.homeOn || []) => { await setSetting('homeOrder', o); await setSetting('homeHidden', [...hd].filter((id) => !OPT_IN.includes(id))); await setSetting('homeOn', on); draw(); };
    const move = (i, d) => { const o = [...order]; [o[i], o[i + d]] = [o[i + d], o[i]]; save(o, hidden); };
    const toggle = (id, on) => {
      if (OPT_IN.includes(id)) { const w = new Set(K.settings.homeOn || []); if (on) w.add(id); else w.delete(id); return save(order, hidden, [...w]); }
      const hd = new Set(hidden); if (on) hd.delete(id); else hd.add(id); save(order, hd);
    };
    const row = (s, i) => h('div.li.cz', h('input', { type: 'checkbox', checked: !hidden.has(s.id), 'aria-label': 'Show ' + s.name, onchange: (e) => toggle(s.id, e.target.checked) }),
      h('span.grow', h('b', s.name), h('div.muted.small', s.sub)),
      h('span.czmove', h('button.btn.ghost.icon.sm', { type: 'button', 'aria-label': 'Move ' + s.name + ' up', disabled: i === 0, onclick: () => move(i, -1) }, icon('chevU', 20)),
        h('button.btn.ghost.icon.sm', { type: 'button', 'aria-label': 'Move ' + s.name + ' down', disabled: i === order.length - 1, onclick: () => move(i, 1) }, icon('chevD', 20))));
    const list = h('div.list', h('div.li.cz', h('span.czlock', { 'aria-hidden': 'true' }, icon('check', 18)), h('span.grow', h('b', 'Start here'), h('div.muted.small', 'For new learners, until the first session is done')), h('span.small.muted', 'Always first')),
      order.map((id, i) => row(SECTIONS.find((s) => s.id === id), i)));
    view.replaceChildren(backHead('Customize Home', '#/home', 'Home'), h('div.stack',
      h('p.muted.small', 'Choose what shows on Home and in what order. Start here is always first. Nothing is deleted: a hidden section can be turned back on here.'),
      list, h('div.row', h('button.btn', { type: 'button', onclick: () => save([], new Set(), []) }, 'Reset to default'))));
  };
  draw();
}
