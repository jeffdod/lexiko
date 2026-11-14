// Verb-chart helpers: reads the Robinson-Pierpont tag on a verb form to find its row on the master verb chart.
// Which forms are open in Parsing is decided by the gates (see kinds.js and know.js), not here.
import { D } from './data.js';

const TAG = /^V-([12]?)([PIFARL])([AMPEDONQX]?)([IMSONP])/;
/** Verbs whose stem ends in λ, μ, ν or ρ: their future and aorist have rows of their own on the master chart. */
export const isLiquidVerb = (n) => { const L = D.lexByN.get(n); return !!L && /[λμνρ]ω$/.test(L.head.normalize('NFD').replace(/[\u0300-\u036f]/g, '')); };
export const LIQ_ROW = { 'fut-act': 'fut-liq-act', 'fut-mid': 'fut-liq-mid', 'aor1-act': 'aor-liq-act' };
/** The master-chart row an indicative verb form belongs to, from its RP tag (null for the other moods). With the verb's number, a liquid verb gets the liquid row where the chart has one. */
export function rowOfTag(tag, n) {
  const m = TAG.exec(tag || ''); if (!m || m[4] !== 'I') return null;
  const sec = m[1] === '2', act = 'AQ'.includes(m[3]), pas = 'PO'.includes(m[3]);
  const row = { P: act ? 'pres-act' : 'pres-mp', I: act ? 'impf-act' : 'impf-mp',
    F: pas ? (sec ? 'fut-pas2' : 'fut-pas1') : act ? 'fut-act' : 'fut-mid',
    A: pas ? (sec ? 'aor2-pas' : 'aor1-pas') : act ? (sec ? 'aor2-act' : 'aor1-act') : (sec ? 'aor2-mid' : 'aor1-mid'),
    R: act ? (sec ? 'perf2-act' : 'perf1-act') : 'perf-mp' }[m[2]] || null;
  return row && n != null && isLiquidVerb(n) && LIQ_ROW[row] ? LIQ_ROW[row] : row;
}

/** The master verb chart: its rows, the five things each row teaches, and the old numbered group (1 to 3) each row belongs to. */
export const CHART_ATTRS = ['aug', 'stem', 'form', 'vowel', 'ends'];
export const ROW_LEVEL = {
  'pres-act': 1, 'impf-act': 1, 'fut-act': 1, 'fut-liq-act': 1, 'fut-mid': 1, 'fut-liq-mid': 1, 'aor1-act': 1, 'aor-liq-act': 1, 'aor2-act': 1, 'aor1-mid': 1, 'aor2-mid': 1,
  'pres-mp': 2, 'impf-mp': 2, 'fut-pas1': 2, 'fut-pas2': 2, 'aor1-pas': 2, 'aor2-pas': 2,
  'perf1-act': 3, 'perf2-act': 3, 'perf-mp': 3,
};
