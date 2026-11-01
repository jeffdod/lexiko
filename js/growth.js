// "Words you've started learning" over time, drawn from the per-day counts lexiko already keeps.
import { K } from './know.js';
import { h } from './util.js';

const NS = 'http://www.w3.org/2000/svg';
const el = (tag, attrs) => { const e = document.createElementNS(NS, tag); for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v); return e; };
const key = (d) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');

/** Cumulative words started, one point per day over the last `days` days. */
export function growthSeries(days = 84) {
  const keys = Object.keys(K.daily).filter((k) => (K.daily[k].n || 0) > 0).sort();
  let total = keys.reduce((a, k) => a + K.daily[k].n, 0);
  const pts = []; const d = new Date(); d.setHours(12, 0, 0, 0);
  for (let i = 0; i < days; i++) { pts.unshift({ date: new Date(d), total }); total -= (K.daily[key(d)] || {}).n || 0; d.setDate(d.getDate() - 1); }
  return { pts, started: pts[pts.length - 1].total, weekAgo: pts[Math.max(0, pts.length - 8)].total, firstDay: keys[0] };
}

/** A small card: the number, the change this week, and a line over time. compact = a short chart for Home. */
export function growthCard({ compact = false } = {}) {
  const { pts, started, weekAgo, firstDay } = growthSeries();
  const gained = started - weekAgo;
  if (!firstDay || pts.filter((p) => p.total > 0).length < 2) {
    return h('div.card.flat', h('b', 'Your learning curve'), h('div.muted.small', 'After a couple of days of study, a chart of the words you’ve started learning will appear here.'));
  }
  const W = 300, H = compact ? 64 : 110, pad = 4, max = Math.max(1, started);
  const x = (i) => pad + (W - 2 * pad) * i / (pts.length - 1), y = (v) => H - pad - (H - 2 * pad) * v / max;
  const line = pts.map((p, i) => (i ? 'L' : 'M') + x(i).toFixed(1) + ' ' + y(p.total).toFixed(1)).join(' ');
  const svg = el('svg', { viewBox: '0 0 ' + W + ' ' + H, width: '100%', height: H, role: 'img', 'aria-label': 'Words started learning over the last twelve weeks: ' + started + ' in total, ' + gained + ' in the last week.', preserveAspectRatio: 'none' });
  svg.append(el('path', { d: line + ' L' + x(pts.length - 1).toFixed(1) + ' ' + (H - pad) + ' L' + x(0).toFixed(1) + ' ' + (H - pad) + ' Z', fill: 'var(--accent-soft)' }),
    el('path', { d: line, fill: 'none', stroke: 'var(--accent)', 'stroke-width': 2, 'stroke-linejoin': 'round', 'stroke-linecap': 'round', 'vector-effect': 'non-scaling-stroke' }));
  return h('div.card.stack',
    h('div.row.between', h('div', h('b', { style: { fontSize: '1.4rem' } }, started.toLocaleString('en-US')), h('span.muted.small', ' words started')), gained ? h('span.chip.good', '+' + gained + ' this week') : h('span.chip', 'none this week')),
    svg, h('div.row.between.muted.small', h('span', 'Last 12 weeks'), h('span', 'Today')));
}
