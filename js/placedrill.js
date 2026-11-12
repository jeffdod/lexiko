// "Place the chips": slots to fill and a tray of chips, some right and some wrong. Tap a chip then a slot, or drag it there.
// Practice only: nothing here reads or writes a card, a counter or a setting. Used by the principal parts row and the paradigm builder.
import { h, clear } from './util.js';

const DRAG_PX = 6, HOLD_MS = 260;                                   // a mouse drags after 6 px; a finger drags after a short press (a quick swipe still scrolls the tray)

/**
 * @param {object} o
 * @param {Node[]} o.head          what goes at the top left (the verb or the row); the count of wrong tries sits at the top right
 * @param {{label:string, stem?:string, answer:string, given?:string}[]} o.slots  `given`: a slot that is already filled (a part the verb does not have shows a dash)
 * @param {string[]} o.chips        the tray: every right chip (once per slot that wants it) and the wrong ones
 * @param {(chip:string, slot:object, board:object) => string} o.explain  what to tell the learner when a chip goes in the wrong slot
 * @param {string} o.hint          the line the message box shows when there is nothing to say (what the wrong chips are)
 * @param {'form'|'end'} o.size     'form': slots hold whole words; 'end': slots follow a stem and hold an ending
 * @param {string} o.noun           what the chips are called in "6 parts left" ("parts", "endings")
 * @param {() => Node[]} o.after    what to show once every slot is filled (buttons)
 * @returns {{ el: Element, wrong: () => number, destroy: () => void }}
 */
export function placeBoard({ head = [], slots, chips, explain, hint = '', size = 'form', noun = 'chips', after = () => [] }) {
  const S = slots.map((s, i) => ({ ...s, i, chip: null, el: null }));
  const C = chips.map((text, i) => ({ id: i, text, used: false, el: null }));
  let sel = null, wrong = 0, drag = null, suppress = false;
  const msg = h('div.pmsg', { role: 'status' });
  const count = h('div.tl');
  const open = () => S.filter((s) => !s.chip && s.given == null);
  const left = () => C.filter((c) => !c.used);
  const say = (text, bad) => { msg.textContent = text || hint; msg.classList.toggle('bad', !!bad); msg.classList.toggle('hint', !text); };      // the message box always keeps its room, so nothing jumps while you drag
  const refresh = () => {
    C.forEach((c) => { c.el.classList.toggle('sel', sel === c); c.el.setAttribute('aria-pressed', String(sel === c)); c.el.hidden = c.used; });
    S.forEach((s) => {
      const empty = !s.chip && s.given == null;
      s.el.classList.toggle('ready', empty && !!sel);
      s.el.disabled = !empty;
      s.el.setAttribute('aria-label', s.label + (s.chip ? ': ' + s.chip.text : s.given != null ? ': ' + (s.given || 'none') : ': empty'));
    });
    count.textContent = left().length + ' ' + noun + ' left · tap one, then its place' + (left().length > 3 ? ', or drag' : '');
  };
  const finish = () => {
    tray.hidden = true; sel = null; refresh(); say('');
    clear(done).append(h('div.pfinal', { role: 'status' }, wrong ? 'All placed. ' + wrong + (wrong === 1 ? ' wrong try.' : ' wrong tries.') : 'All placed, with no wrong tries.'), ...after());
    done.scrollIntoView({ block: 'nearest' });
  };
  const place = (c, s) => {
    if (c.used || s.chip || s.given != null) return;
    if (c.text === s.answer) {
      c.used = true; s.chip = c; sel = null;
      s.el.classList.remove('bad'); s.el.classList.add('ok');
      clear(s.fill).append(h('span', { lang: 'grc' }, c.text));
      say('');
      refresh();
      if (!open().length) finish();
    } else {
      wrong++; badge.textContent = wrong + ' wrong'; badge.hidden = false;
      C.forEach((x) => x.el.classList.remove('bad')); c.el.classList.add('bad'); sel = null;
      say(explain(c.text, s, { slots: S }), true);
      refresh();
    }
  };
  const pick = (c) => { sel = sel === c ? null : c; C.forEach((x) => x.el.classList.remove('bad')); say(sel ? 'Now tap the place for ' + sel.text + '.' : ''); refresh(); };

  /* ---------- the drag: mouse and pen by pointer events, a finger by a short press ---------- */
  const slotAt = (x, y) => { const e = document.elementFromPoint(x, y), b = e && e.closest('.pslot'); return b ? S.find((s) => s.el === b) : null; };
  const ghostFor = (c) => { const g = h('div.pchip.ghost', { 'aria-hidden': 'true' }, h('span', { lang: 'grc' }, c.text)); document.body.append(g); return g; };
  const moveGhost = (x, y) => { drag.g.style.left = x + 'px'; drag.g.style.top = y + 'px'; const s = slotAt(x, y); S.forEach((t) => t.el.classList.toggle('over', t === s && !t.chip && t.given == null)); };
  const beginDrag = (c, x, y) => { drag = { c, g: ghostFor(c) }; c.el.classList.add('lifted'); sel = null; refresh(); moveGhost(x, y); };
  const endDrag = (x, y, drop, clicks) => {
    if (!drag) return;
    const { c, g } = drag; drag = null; g.remove(); c.el.classList.remove('lifted'); S.forEach((t) => t.el.classList.remove('over'));
    if (clicks) { suppress = true; setTimeout(() => { suppress = false; }, 400); }          // the mouse click that follows a drag is not a tap (that click, or 0.4 s, ends this)
    const s = drop ? slotAt(x, y) : null; if (s) place(c, s);
  };
  C.forEach((c) => {
    c.el = h('button.pchip', { type: 'button', 'aria-pressed': 'false', onclick: () => { if (suppress) { suppress = false; return; } pick(c); } }, h('span', { lang: 'grc' }, c.text));
    let down = null, timer = null;
    c.el.addEventListener('pointerdown', (e) => { if (e.pointerType === 'touch' || e.button !== 0) return; down = { x: e.clientX, y: e.clientY, id: e.pointerId }; });
    c.el.addEventListener('pointermove', (e) => {
      if (!down || e.pointerType === 'touch') return;
      if (!drag && Math.hypot(e.clientX - down.x, e.clientY - down.y) > DRAG_PX) { try { c.el.setPointerCapture(down.id); } catch (err) { /* fine */ } beginDrag(c, e.clientX, e.clientY); }
      if (drag) moveGhost(e.clientX, e.clientY);
    });
    const up = (e) => { if (!down || e.pointerType === 'touch') return; down = null; if (drag) endDrag(e.clientX, e.clientY, e.type === 'pointerup', true); };
    c.el.addEventListener('pointerup', up); c.el.addEventListener('pointercancel', up);
    c.el.addEventListener('touchstart', (e) => {
      const t = e.touches[0]; down = { x: t.clientX, y: t.clientY };
      clearTimeout(timer); timer = setTimeout(() => { if (down) beginDrag(c, down.x, down.y); }, HOLD_MS);
    }, { passive: true });
    c.el.addEventListener('touchmove', (e) => {
      const t = e.touches[0]; if (!down) return;
      if (drag) { e.preventDefault(); down = { x: t.clientX, y: t.clientY }; moveGhost(t.clientX, t.clientY); return; }
      if (Math.hypot(t.clientX - down.x, t.clientY - down.y) > DRAG_PX) { clearTimeout(timer); down = null; }          // a swipe: let the tray scroll
    }, { passive: false });
    const tend = (e) => { clearTimeout(timer); if (drag) { e.preventDefault(); const t = e.changedTouches[0]; endDrag(t.clientX, t.clientY, e.type === 'touchend', false); } down = null; };
    c.el.addEventListener('touchend', tend); c.el.addEventListener('touchcancel', tend);
    c.el.addEventListener('contextmenu', (e) => e.preventDefault());
  });

  S.forEach((s) => {
    s.fill = h('span.pfill', s.given != null ? (s.given ? h('span', { lang: 'grc' }, s.given) : h('span.none', '—')) : null);
    s.el = h('button.pslot' + (size === 'end' ? '.pend' : '.pform') + (s.given != null ? '.locked' : ''), { type: 'button', onclick: () => { if (sel) place(sel, s); else say('Pick a ' + noun.replace(/s$/, '') + ' below first, then tap its place.'); } }, s.fill);
  });
  const rows = S.map((s) => h('div.pline', h('span.plab', s.label), h('span.pbox', s.stem ? h('span.pstem', { lang: 'grc' }, s.stem) : null, s.el)));
  const badge = h('span.chip.bad', { hidden: true }), done = h('div.stack');
  const tray = h('div.ptray', count, msg, h('div.trow', C.map((c) => c.el)));
  const el = h('div.pboard', h('div.row.between', h('div.row.wrap', ...head), badge), h('div.card.stack', ...rows), done, tray);
  say(''); refresh();
  if (!open().length) finish();
  return { el, wrong: () => wrong, destroy: () => { if (drag) { drag.g.remove(); drag = null; } } };
}
