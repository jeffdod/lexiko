// Shared pieces for the automatic pace of new words and new forms.
import { setting, setSetting } from './know.js';
import { h } from './util.js';

/** A line saying why new items are slowed, paused or waiting; nothing when all is normal. */
export function paceNote(p, noun) {
  if (p.paused) return h('div.card.small', h('b', 'New ' + noun + ' are paused.'), ' Turn this off in Settings when you want more.');
  if (p.auto && p.why) return h('div.card.small', h('b', p.slow ? 'New ' + noun + ' are slowed. ' : ''), p.why);
  return null;
}

/** Options: automatic or fixed, and a pause switch. `prefix` is 'words' or 'parse'. */
export function paceOptions(prefix, noun, redraw) {
  const auto = setting(prefix + 'Pace') !== 'fixed';
  const seg = (key, items) => h('div.seg', items.map(([v, t]) => h('button', { 'aria-pressed': String(String(setting(key)) === String(v)), onclick: async () => { await setSetting(key, v); redraw(); } }, t)));
  return [
    h('div.stack', h('b', 'New ' + noun), seg(prefix + 'Pace', [['auto', 'Automatic'], ['fixed', 'Fixed number']]),
      h('div.muted.small', auto ? 'Automatic pace slows new ' + noun + ' when reviews pile up or you’re below about 75% correct, and holds them all back when more than about 40 reviews are waiting across vocabulary, parsing and principal parts. Your daily number is the most it will ever start.' : 'Exactly your daily number every day.')),
    h('div.row.between', h('div', h('b', 'Pause new ' + noun), h('div.muted.small', 'Review only, until you turn it off.')), seg(prefix + 'Pause', [[false, 'Off'], [true, 'On']])),
  ];
}
