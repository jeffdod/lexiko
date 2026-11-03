// Which stems of a verb you need to know, and which forms stand for each stem.
// Everything here is counted from the Greek text's own forms and RP morphology tags; nothing is written by hand.
import { D } from './data.js';

/** The six stems of a verb, in principal-part order. */
export const STEMS = ['Present', 'Future', 'Aorist active/middle', 'Perfect active', 'Perfect middle/passive', 'Aorist passive'];
export const COVER = 0.85;          // a verb's required stems must cover at least this share of its occurrences
export const FORMS_MIN = 2, FORMS_MAX = 3, FORMS_SHARE = 0.75;   // forms per stem: the commonest, at least 2, at most 3, stopping once they cover 75% of the stem

const TAG = /^V-([12]?)([PIFARL])([AMPEDONQX]?)([IMSONP])/;
const PASSIVE = new Set(['P', 'E', 'O']);        // the -θη- stem: aorist passive, and the passive future built on it
/** Which stem a verb form is built on (0..5, an index into STEMS), from its RP morphology tag; null if it is not a verb form. */
export function stemOf(tag) {
  const m = TAG.exec(tag || ''); if (!m) return null;
  const tense = m[2], voice = m[3] || 'X';
  if (tense === 'P' || tense === 'I') return 0;
  if (tense === 'F') return PASSIVE.has(voice) ? 5 : 1;
  if (tense === 'A') return PASSIVE.has(voice) ? 5 : 2;
  return voice === 'A' || voice === 'X' || voice === 'Q' ? 3 : 4;      // perfect and pluperfect
}

const skel = (s) => s.normalize('NFD').replace(/[̀-ͯ­]/g, '').toLowerCase().replace(/ς/g, 'σ');
const tidy = (s) => s.replace(/­/g, '').normalize('NFD').replace(/̀/g, '́').normalize('NFC').toLowerCase();

let byVerb = null;
/** strongs → { total, stems: [ Map(skeleton → { w, count, best }) × 6 ] }, over every occurrence in the text (first analysis of each token). */
function tally() {
  if (byVerb) return byVerb;
  byVerb = new Map();
  D.forms.forEach((f, i) => {
    const a = f.an[0]; if (!a) return;
    const s = stemOf(a.m); if (s == null) return;
    let v = byVerb.get(a.s); if (!v) byVerb.set(a.s, v = { total: 0, stems: [0, 1, 2, 3, 4, 5].map(() => new Map()) });
    v.total += f.count;
    const k = skel(f.w), m = v.stems[s], e = m.get(k) || { w: tidy(f.w), count: 0, best: 0, rows: [] };
    e.rows.push(i); e.count += f.count; if (f.count > e.best) { e.best = f.count; e.w = tidy(f.w); } m.set(k, e);
  });
  return byVerb;
}

const cache = new Map();
/** What to learn for a verb: the fewest stems that cover at least 85% of its occurrences, and for each the 2–3 commonest forms.
 *  Returns { total, covered, share, stems: [{ slot, name, count, share, forms: [{ w, count, rows }] }] } (stems most frequent first), or null for a word with no verb forms. */
export function requiredStems(n) {
  if (cache.has(n)) return cache.get(n);
  const v = tally().get(n); let out = null;
  if (v && v.total) {
    const all = v.stems.map((m, slot) => ({ slot, count: [...m.values()].reduce((a, e) => a + e.count, 0), m })).filter((x) => x.count).sort((a, b) => b.count - a.count || a.slot - b.slot);
    const stems = []; let covered = 0;
    for (const x of all) {
      if (covered / v.total >= COVER) break;
      const forms = [...x.m.values()].sort((a, b) => b.count - a.count || (a.w < b.w ? -1 : 1)); let got = 0; const pick = [];
      for (const f of forms) { if (pick.length >= FORMS_MAX || (pick.length >= FORMS_MIN && got / x.count >= FORMS_SHARE)) break; pick.push({ w: f.w, count: f.count, rows: f.rows }); got += f.count; }
      stems.push({ slot: x.slot, name: STEMS[x.slot], count: x.count, share: x.count / v.total, forms: pick }); covered += x.count;
    }
    out = { total: v.total, covered, share: covered / v.total, stems };
  }
  cache.set(n, out); return out;
}
/** Every occurrence of a verb by stem, for charts and checks: [{ slot, name, count }] most frequent first. */
export function stemCounts(n) { const v = tally().get(n); return v ? v.stems.map((m, slot) => ({ slot, name: STEMS[slot], count: [...m.values()].reduce((a, e) => a + e.count, 0) })).filter((x) => x.count).sort((a, b) => b.count - a.count) : []; }
