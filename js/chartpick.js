// "Parse from the chart": choose rows of the master verb chart, then parse real verbs of those forms. Practice only: nothing here is scored.
import { ROWS } from './chartdrill.js';
import { rowPool, rowsPools, rowsLength } from './parse.js';
import { h, clear, backHead } from './util.js';

const GROUPS = [['Present and imperfect', /^(pres|impf)/], ['Future', /^fut/], ['Aorist', /^aor/], ['Perfect', /^perf/]];

export function renderPick(view) {
  const sel = new Set(); let any = false; const cache = {};      // pools per mode: the lists of forms available for each row
  const pools = () => cache[any] || (cache[any] = Object.fromEntries(ROWS.map((r) => [r.key, rowPool(r.key, { ignoreLevel: true, anyVerb: any })])));
  const boxes = new Map(), chips = new Map(), labels = new Map(), alls = [];
  const keysOn = () => ROWS.map((r) => r.key).filter((k) => sel.has(k));
  const avail = (k) => pools()[k].length;
  const go = h('a.btn.primary.block.pickgo', { href: '#' });
  const goOff = h('div.btn.block.pickgo.done', 'Choose at least one row');
  const goBox = h('div.pickbar');
  const total = (keys) => { const ids = new Set(); for (const k of keys) for (const id of pools()[k]) ids.add(id); return Math.min(rowsLength(keys.length), ids.size); };
  const refresh = () => {
    for (const r of ROWS) { const n = avail(r.key), off = n === 0; if (off) sel.delete(r.key);
      const b = boxes.get(r.key); b.checked = sel.has(r.key); b.disabled = off; labels.get(r.key).classList.toggle('off', off); chips.get(r.key).textContent = off ? 'none' : n; }
    for (const a of alls) { const ks = a.keys.filter((k) => avail(k) > 0); a.btn.disabled = !ks.length; a.btn.textContent = ks.length && ks.every((k) => sel.has(k)) ? 'Clear' : 'Select all'; }
    const keys = keysOn(), n = total(keys);
    goBox.replaceChildren(keys.length ? Object.assign(go, { href: '#/parse/run/rows/' + keys.join(',') + '/' + (any ? 'any' : 'known'), textContent: 'Parse ' + n + ' form' + (n === 1 ? '' : 's') + ' · ' + keys.length + ' row' + (keys.length === 1 ? '' : 's') }) : goOff);
  };
  const row = (r) => { const b = h('input', { type: 'checkbox', onchange: (e) => { e.target.checked ? sel.add(r.key) : sel.delete(r.key); refresh(); } }), chip = h('span.chip'), l = h('label.pickrow', b, h('span.pn', r.name), chip);
    boxes.set(r.key, b); chips.set(r.key, chip); labels.set(r.key, l); return l; };
  const groups = GROUPS.map(([title, re]) => { const rs = ROWS.filter((r) => re.test(r.key)); const btn = h('button.btn.ghost.sm', { type: 'button' }, 'Select all');
    const a = { keys: rs.map((r) => r.key), btn }; btn.onclick = () => { const ks = a.keys.filter((k) => avail(k) > 0), all = ks.every((k) => sel.has(k)); for (const k of ks) all ? sel.delete(k) : sel.add(k); refresh(); }; alls.push(a);
    return h('div.pickgroup', h('div.row.between', h('h3', title), btn), ...rs.map(row)); });
  const seg = h('span.seg', { role: 'group', 'aria-label': 'Verbs to use' },
    ...[['Ones I know', false], ['Any verb', true]].map(([t, v]) => h('button', { type: 'button', 'aria-pressed': String(any === v), onclick: (e) => { any = v; for (const b of e.currentTarget.parentNode.children) b.setAttribute('aria-pressed', String(b === e.currentTarget)); refresh(); } }, t)));
  clear(view).append(backHead('Parse from the chart', '#/learn/charts', 'Charts'), h('div.stack',
    h('div.card.stack', h('p.muted.small', 'Pick the rows to practice. You get real verbs of those forms to parse. Practice only: nothing here changes your progress.'), ...groups),
    h('div.card.stack', h('div.row.between.wrap', h('b', 'Verbs'), seg), h('p.muted.small', '“Any verb” also uses verbs you haven’t learned yet.')),
    goBox));
  refresh();
}
