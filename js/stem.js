// Rule-based explanations of why a form looks the way it does (augment, reduplication, tense markers,
// stem changes, endings). No DOM. Input: lemma headword, the form as printed, and a decoded RP analysis.
const VOW = 'αεηιουω';
const isV = (c) => !!c && VOW.includes(c);

/** Letters only: no accents/breathings, iota subscript kept as ι, final sigma → σ. */
export const skel = (s) => s.replace(/­/g, '').normalize('NFD').replace(/ͅ/g, 'ι').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/ς/g, 'σ').replace(/[^α-ω]/g, '');
const cleanLemma = (s) => skel(s.replace(/\(.*?\)/g, '').split(/[,/]/)[0]);

const PREFIXES = ['αποκατα', 'ανα', 'ανθ', 'αντι', 'απο', 'αφ', 'απ', 'αμφι', 'δια', 'εισ', 'εκ', 'εξ', 'εν', 'επι', 'εφ', 'επ', 'κατα', 'καθ', 'κατ', 'μετα', 'μεθ', 'μετ', 'παρα', 'παρ', 'περι', 'προσ', 'προ', 'συν', 'συμ', 'συγ', 'συλ', 'συ', 'υπερ', 'υπο', 'υφ', 'υπ', 'δι'];
const PREF_VARIANTS = { εκ: ['εξ'], εξ: ['εκ'], εν: ['εμ', 'εγ', 'ελ'], συν: ['συμ', 'συγ', 'συλ', 'συ'], συμ: ['συν'], συγ: ['συν'], συλ: ['συν'] };

/** If the lemma is a compound with a preposition, find how the prefix shows up in the form. */
function splitPrefix(L, F) {
  const done = [];
  for (const p of [...PREFIXES].sort((a, b) => b.length - a.length)) {
    if (!L.startsWith(p) || L.length < p.length + 2 || done.includes(p)) continue;
    done.push(p);
    const vars = [p, p.slice(0, -1), ...(PREF_VARIANTS[p] || [])];
    const rest = L.slice(p.length);
    for (const v of vars) {
      if (v && F.startsWith(v) && F.length > v.length + 1) {
        const fr = F.slice(v.length);
        if (fr.startsWith('ε') || fr.startsWith(rest[0]) || isV(fr[0])) return { prefix: p, shown: v, lemmaRest: rest, formRest: fr };
      }
    }
  }
  return null;
}

const AUG = { α: 'η', ε: 'η', ο: 'ω', αι: 'ηι', ει: 'ηι', οι: 'ωι', αυ: 'ηυ', ευ: 'ηυ' };
const DEASP = { φ: 'π', θ: 'τ', χ: 'κ' };
const CLUSTER = /^(ψ|ξ|ζ|στ|σκ|σπ|σφ|σχ|σθ|γν|γλ|κτ|πτ|βλ|μν|ρ)/;

function lemmaParts(L) {
  // → {stem, contract:'α'|'ε'|'ο'|null, type:'ω'|'ομαι'|'μι'|null}
  let m;
  if ((m = /^(.*)(α|ε|ο)ομαι$/.exec(L)) && m[1]) return { stem: m[1], contract: m[2], type: 'ομαι' };
  if ((m = /^(.*)(α|ε|ο)ω$/.exec(L)) && m[1]) return { stem: m[1], contract: m[2], type: 'ω' };
  if ((m = /^(.*)ομαι$/.exec(L))) return { stem: m[1], contract: null, type: 'ομαι' };
  if ((m = /^(.*)μαι$/.exec(L))) return { stem: m[1], contract: null, type: 'μαι' };
  if ((m = /^(.*)μι$/.exec(L))) return { stem: m[1], contract: null, type: 'μι' };
  if ((m = /^(.*)ω$/.exec(L))) return { stem: m[1], contract: null, type: 'ω' };
  return { stem: L, contract: null, type: null };
}
const lastClass = (stem) => {
  if (/(γ|κ|χ|ξ|σσ|ττ)$/.test(stem)) return 'velar';
  if (/(π|β|φ|πτ)$/.test(stem)) return 'labial';
  if (/(τ|δ|θ|ζ)$/.test(stem)) return 'dental';
  if (/(λ|μ|ν|ρ)$/.test(stem)) return 'liquid';
  return 'vowel';
};

// Endings are written "connecting vowel|personal ending". "~x" = one merged piece (the vowel and ending have run together).
// null = the textbook split is not clear-cut, so no breakdown is shown for that person/number.
const PRIM_A = { '1S': '~ω', '2S': '~εισ', '3S': '~ει', '1P': 'ο|μεν', '2P': 'ε|τε', '3P': '~ουσι(ν)' };
const SEC_A = { '1S': 'ο|ν', '2S': 'ε|σ', '3S': 'ε|(ν)', '1P': 'ο|μεν', '2P': 'ε|τε', '3P': 'ο|ν' };
const PRIM_M = { '1S': 'ο|μαι', '2S': '~ηι / ει', '3S': 'ε|ται', '1P': 'ο|μεθα', '2P': 'ε|σθε', '3P': 'ο|νται' };
const SEC_M = { '1S': 'ο|μην', '2S': '~ου', '3S': 'ε|το', '1P': 'ο|μεθα', '2P': 'ε|σθε', '3P': 'ο|ντο' };
const AOR1_A = { '1S': '|', '2S': '|σ', '3S': null, '1P': '|μεν', '2P': '|τε', '3P': '|ν' };
const AOR1_M = { '1S': '|μην', '2S': null, '3S': '|το', '1P': '|μεθα', '2P': '|σθε', '3P': '|ντο' };
const AOR_P = { '1S': '|ν', '2S': '|σ', '3S': '|', '1P': '|μεν', '2P': '|τε', '3P': '|σαν' };
const PERF_A = { '1S': '|', '2S': '|σ', '3S': null, '1P': '|μεν', '2P': '|τε', '3P': '|σι(ν)' };
const PERF_M = { '1S': '|μαι', '2S': '|σαι', '3S': '|ται', '1P': '|μεθα', '2P': '|σθε', '3P': '|νται' };
const PLUP_A = { '1S': '|ν', '2S': '|σ', '3S': '|', '1P': '|μεν', '2P': '|τε', '3P': '|σαν' };
const PLUP_M = { '1S': '|μην', '2S': '|σο', '3S': '|το', '1P': '|μεθα', '2P': '|σθε', '3P': '|ντο' };
const PERS_NAME = { 1: '1st', 2: '2nd', 3: '3rd' }, NUM_NAME = { S: 'singular', P: 'plural' };
const TENSE_NAME = { P: 'present', I: 'imperfect', F: 'future', A: 'aorist', R: 'perfect', L: 'pluperfect' };
const VOICE_NAME = { A: 'active', M: 'middle', P: 'passive', E: 'middle/passive', D: 'middle', O: 'passive', N: 'middle/passive', Q: 'active' };

// Indicative only. mk = tense formatives to try; name = what to call it.
const IND = {
  P: [{ mk: [''], set: PRIM_A, cls: 'a' }, { mk: [''], set: PRIM_M, cls: 'm' }],
  I: [{ mk: [''], set: SEC_A, cls: 'a' }, { mk: [''], set: SEC_M, cls: 'm' }],
  F: [{ mk: ['σ', 'ξ', 'ψ'], set: PRIM_A, cls: 'a', name: 'future' }, { mk: ['σ', 'ξ', 'ψ'], set: PRIM_M, cls: 'm', name: 'future' }, { mk: ['θησ', 'ησ'], set: PRIM_M, cls: 'p', name: 'future passive' }],
  A: [{ mk: ['θη'], set: AOR_P, cls: 'p', name: 'aorist passive' }, { mk: ['η'], set: AOR_P, cls: 'p', name: '2nd aorist passive', second: true },
    { mk: ['σα', 'ξα', 'ψα', 'κα', 'α'], set: AOR1_A, cls: 'a', name: '1st aorist' }, { mk: [''], set: SEC_A, cls: 'a', second: true },
    { mk: ['σα', 'ξα', 'ψα', 'α'], set: AOR1_M, cls: 'm', name: '1st aorist' }, { mk: [''], set: SEC_M, cls: 'm', second: true }],
  R: [{ mk: ['κα', 'α'], set: PERF_A, cls: 'a', name: 'perfect active' }, { mk: [''], set: PERF_M, cls: 'm' }],
  L: [{ mk: ['κει', 'ει'], set: PLUP_A, cls: 'a', name: 'pluperfect' }, { mk: [''], set: PLUP_M, cls: 'm' }],
};
const alts = (e) => e.split(' / ').flatMap((x) => { const m = /^(.*)\((.*)\)(.*)$/.exec(x); return m ? [m[1] + m[2] + m[3], m[1] + m[3]] : [x]; });
const voiceCls = (v) => ('AQ'.includes(v) ? 'a' : 'PO'.includes(v) ? 'p' : 'm');

/** Find formative + connecting vowel + ending at the end of an indicative form. Only clear-cut splits; otherwise null. */
function findTail(sl, F) {
  if (sl.mood !== 'I' || !sl.person) return null;
  const vc = voiceCls(sl.voice), k = sl.person + sl.number; let best = null;
  for (const f of IND[sl.tense] || []) {
    const spec = f.set[k]; if (!spec) continue;
    const merged = spec[0] === '~', body = merged ? spec.slice(1) : spec;
    const [cv, en] = merged ? [body, ''] : body.split('|');
    for (const m of f.mk) for (const c of alts(cv)) for (const e of alts(en)) { const tail = m + c + e;
      if (!F.endsWith(tail) || F.length - tail.length < 1) continue;
      const sc = tail.length + (f.cls === vc ? 0.5 : 0) + (!!f.second === !!sl.second ? 0.25 : 0);
      if (!best || sc > best.sc) best = { sign: m, conn: c, end: e, merged, signName: f.name, sc }; }
  }
  return best;
}

const CONTRACT_LONG = { α: 'η', ε: 'η', ο: 'ω' };
const AUGSHOW = (c) => c;

/**
 * A breakdown of the form being asked about, built from its own letters:
 * { pieces: [{ text, role, kind }], notes: [string] }. Nothing here is a generic rule about other verbs.
 */
export function breakdown(lemmaHead, formText, d) {
  const sl = d.slots || {}, F = skel(formText);
  const out = { pieces: [], notes: [] };
  const Lraw = cleanLemma(lemmaHead);
  if (d.pos !== 'V' || !sl.tense) { if (['N', 'A', 'T'].includes(d.pos)) nominalNotes(Lraw, F, d, out.notes); return out; }
  if (/^(ειμι|οιδα|φημι)$/.test(Lraw)) { out.notes.push(lemmaHead + ' is irregular, so ' + formText + ' is not built from an ordinary stem; learn it as a form of its own.'); return out; }

  // map skeleton letters back to the printed form (with accents)
  const clusters = (formText.replace(/­/g, '').normalize('NFD').match(/[Ͱ-Ͽἀ-῿][̀-ͯ]*/gu) || []).map((c) => c.normalize('NFC'));
  const starts = []; let pos = 0; for (const c of clusters) { starts.push(pos); pos += skel(c).length; }
  const show = (a, b) => clusters.filter((_, i) => starts[i] >= a && starts[i] < b).join('');
  const shown = (a, b) => (pos === F.length ? show(a, b) : F.slice(a, b));

  const t = sl.tense, ind = sl.mood === 'I';
  const tail = findTail(sl, F);
  const sp = splitPrefix(Lraw, F);
  const lr = sp ? sp.lemmaRest : Lraw;
  let at = sp ? sp.shown.length : 0;
  const pieces = [];
  const stemOfLemma = lemmaParts(lr).stem;
  if (sp) pieces.push({ a: 0, b: at, role: 'prefix', kind: 'prefix' });

  // augment / reduplication
  let fr = F.slice(at), augNote = null, temporal = null;
  const c0 = lr[0], two = lr.slice(0, 2);
  if (ind && (t === 'I' || t === 'A' || t === 'L')) {
    if (isV(c0)) {
      const to = AUG[two] || AUG[c0] || c0, from = AUG[two] ? two : c0;
      const seen = fr.startsWith(to) ? to : (fr.startsWith('ει') && c0 === 'ε' ? 'ει' : null);
      if (seen && seen !== from) temporal = { from, to: seen }; else augNote = 'long';
    } else if (fr.startsWith('ε') && !lr.startsWith('ε')) { pieces.push({ a: at, b: at + 1, role: 'augment', kind: 'aug' }); at += 1; fr = F.slice(at); augNote = 'syllabic'; }
    else if (fr.startsWith('ε') && lr.startsWith('ρ')) { pieces.push({ a: at, b: at + 1, role: 'augment', kind: 'aug' }); at += 1; fr = F.slice(at); augNote = 'syllabic'; }
  }
  let redup = null;
  if (t === 'R' || t === 'L') {
    if (isV(c0)) { if (!temporal && ind) { const to = AUG[two] || AUG[c0] || c0, from = AUG[two] ? two : c0; if (fr.startsWith(to) && to !== from) temporal = { from, to }; } else if (!ind && fr.startsWith(AUG[two] || AUG[c0] || '#') && (AUG[two] || AUG[c0]) !== (AUG[two] ? two : c0)) temporal = { from: AUG[two] ? two : c0, to: AUG[two] || AUG[c0] }; }
    else {
      const base = fr, k = DEASP[c0] || c0;
      if (CLUSTER.test(lr) && base.startsWith('ε')) { redup = { len: 1, kind: 'eps' }; }
      else if (base[1] === 'ε' && (base[0] === c0 || base[0] === k)) redup = { len: 2, kind: 'cons', from: c0, to: base[0] };
      else if (augNote === 'syllabic') { /* pluperfect: ε then reduplication handled above only when present */ }
    }
  }
  if (redup) { pieces.push({ a: at, b: at + redup.len, role: redup.kind === 'eps' ? 'stands for reduplication' : 'reduplication', kind: 'aug' }); at += redup.len; }

  // stem + tail
  const tl = tail ? (tail.sign + tail.conn + tail.end).length : 0;
  const stemEnd = F.length - tl;
  const ok = tail && stemEnd > at;
  if (ok) {
    pieces.push({ a: at, b: stemEnd, role: 'stem', kind: 'stem' });
    let x = stemEnd;
    if (tail.sign) { pieces.push({ a: x, b: x + tail.sign.length, role: 'tense formative', kind: 'mark' }); x += tail.sign.length; }
    if (tail.merged) pieces.push({ a: x, b: F.length, role: 'ending (with connecting vowel)', kind: 'end' });
    else {
      if (tail.conn) { pieces.push({ a: x, b: x + tail.conn.length, role: 'connecting vowel', kind: 'conn' }); x += tail.conn.length; }
      if (x < F.length) pieces.push({ a: x, b: F.length, role: 'ending', kind: 'end' });
    }
  } else if (!tail) { out.contractOnly = true; }
  out.pieces = ok ? pieces.map((p) => ({ text: shown(p.a, p.b), role: p.role, kind: p.kind })) : [];

  /* ----- notes: one sentence per piece, using this form's own letters ----- */
  const N = out.notes, S = ok ? shown(at, stemEnd) : '';
  const stemSk = ok ? F.slice(at, stemEnd) : '';
  if (sp) N.push('Prefix ' + shown(0, sp.shown.length) + '-' + (sp.shown !== sp.prefix ? ' (the preposition ' + sp.prefix + ' loses its last vowel before the next vowel)' : ' (the preposition in ' + lemmaHead + ')') + '. The augment, if any, goes after it.');
  if (augNote === 'syllabic') N.push('ε- is the augment: a syllable added in front of the stem' + (S ? ' ' + S + '-' : '') + ' to mark a past tense.');
  if (temporal) N.push('Augment: the stem of ' + lemmaHead + ' begins with ' + temporal.from + ', which lengthens to ' + temporal.to + ' here, marking a past tense' + (t === 'R' ? ' (the perfect lengthens in the same way).' : '.'));
  if (augNote === 'long') N.push('The stem of ' + lemmaHead + ' already begins with a long vowel (' + lr.slice(0, 1) + '), so the augment does not show.');
  if (redup) N.push(redup.kind === 'eps' ? 'The stem begins with a consonant cluster, so ' + shown(at - 1, at) + '- stands in for the reduplication that marks the perfect.' : 'Reduplication ' + shown(at - 2, at) + '-: the stem’s first consonant ' + redup.from + ' is repeated with ε, which marks the ' + (t === 'L' ? 'pluperfect' : 'perfect') + (redup.to !== redup.from ? ' (the aspirate ' + redup.from + ' is replaced by ' + redup.to + ' in the repeat)' : '') + '.');
  if (ok && tail.sign === 'α' && t === 'A' && /(λ|μ|ν|ρ)$/.test(stemOfLemma)) N.push('-α- is the 1st aorist tense formative. The stem of ' + lemmaHead + ' ends in the liquid ' + stemOfLemma.slice(-1) + ', so there is no σ in front of it.');
  else if (ok && tail.sign) N.push('-' + shown(stemEnd, stemEnd + tail.sign.length) + '- is the ' + (tail.signName || TENSE_NAME[t]) + ' tense formative' + signWhy(tail.sign, stemSk, stemOfLemma, lemmaHead) + '.');
  else if (ok && t === 'A' && sl.second && !pass(sl)) N.push('There is no σα formative: ' + formText + ' is a 2nd aorist, built directly on its own stem ' + S + '- with the endings of the imperfect.');
  if (ok) { const en = endingNote(sl, tail, shown(stemEnd + tail.sign.length + (tail.merged ? 0 : tail.conn.length), F.length), shown(stemEnd + tail.sign.length, stemEnd + tail.sign.length + tail.conn.length)); if (en) N.push(en); }
  if (ok) { const sc = stemChange(stemSk, stemOfLemma, temporal, (tail.sign || tail.conn || tail.end)[0], lemmaHead, S, lr, !!tail.sign); if (sc) N.push(sc); }
  if (!ok || out.contractOnly) {
    const P = lemmaParts(lr);
    if (P.contract && (t === 'P' || t === 'I' || t === 'F' || t === 'A' || t === 'R')) N.push(lemmaHead + ' is an ' + P.contract + '-contract verb: its stem vowel ' + P.contract + ' merges with the ending’s vowel, so in ' + formText + ' stem and ending are written as one.');
  }
  else if (ok && lemmaParts(lr).contract && (t === 'P' || t === 'I')) N.push(lemmaHead + ' is an ' + lemmaParts(lr).contract + '-contract verb: its stem vowel merges with the ending’s vowel, which is why the ending of ' + formText + ' looks different from a regular -ω verb.');
  out.notes = N.filter(Boolean);
  return out;
}

const pass = (sl) => sl.voice === 'P' || sl.voice === 'O';
function signWhy(s, stemSk, lemmaStem, head) {
  const c = s[0], gone = lemmaStem.startsWith(stemSk) ? lemmaStem.slice(stemSk.length) : '';
  if ((c === 'ξ' || c === 'ψ') && gone.length === 1) return ': the last letter of the stem of ' + head + ', ' + gone + ', combined with σ to give ' + c;
  if (c === 'σ' && gone.length === 1 && /[τδθζ]/.test(gone)) return ', and the stem’s final ' + gone + ' dropped out before its σ';
  return '';
}
function endingNote(sl, tail, endText, connText) {
  if (!sl.person) return null;
  const who = PERS_NAME[sl.person] + ' person ' + NUM_NAME[sl.number];
  if (tail.merged) return '-' + endText + ' is the ' + who + ' ending, with the connecting vowel run together with it.';
  const out = [];
  if (connText) out.push('-' + connText + '- is the connecting vowel between stem and ending.');
  if (tail.end === 'ν' && tail.conn === 'ε' && sl.person === 3 && sl.number === 'S') out.push('-ν is the movable ν, which may be added to this ending.');
  else if (endText) out.push('-' + endText + ' is the ' + who + ' ending.');
  else out.push('The ' + who + ' has no separate ending here.');
  return out.join(' ');
}
function stemChange(stemSk, lemmaStem, temporal, sign, head, S, lr, hasSign) {
  if (!stemSk || !lemmaStem) return '';
  let exp = lemmaStem;
  if (temporal && exp.startsWith(temporal.from)) exp = temporal.to + exp.slice(temporal.from.length);
  if (stemSk === exp || stemSk === lemmaStem) return '';
  const P = lemmaParts(lr);
  if (P.contract && (stemSk === lemmaStem + CONTRACT_LONG[P.contract] || stemSk === lemmaStem + P.contract)) return 'The stem vowel ' + P.contract + ' of ' + head + ' lengthens to ' + stemSk.slice(-1) + ' before the tense sign.';
  if (stemSk === lemmaStem + P.contract) return '';
  if (hasSign && exp.startsWith(stemSk) && exp.length - stemSk.length <= 2) return '';
  if (stemSk.length === exp.length) {
    const diffs = [...exp].map((c, i) => [c, stemSk[i], i]).filter(([a, b]) => a !== b);
    if (diffs.length === 1) { const [a, b, i] = diffs[0]; if (i === exp.length - 1 && sign === 'μ') return 'The stem’s last consonant ' + a + ' (in ' + head + ') has assimilated to the μ that follows it.'; if (i === exp.length - 1) return 'The stem’s last consonant changes from ' + a + ' (in ' + head + ') to ' + b + (' before ' + sign) + '.'; if (isV(a) && isV(b)) return 'The stem vowel changes from ' + a + ' (in ' + head + ') to ' + b + ' in this form (' + S + ').'; }
  }
  return '';
}

/** Notes only (kept for callers that just want sentences). */
export function explain(lemmaHead, formText, d) { return breakdown(lemmaHead, formText, d).notes; }

/* ---------- nouns, adjectives, article ---------- */
const E2M = { NS: 'ος', GS: 'ου', DS: 'ῳ', AS: 'ον', VS: 'ε', NP: 'οι', GP: 'ων', DP: 'οις', AP: 'ους', VP: 'οι' };
const E2N = { NS: 'ον', GS: 'ου', DS: 'ῳ', AS: 'ον', VS: 'ον', NP: 'α', GP: 'ων', DP: 'οις', AP: 'α', VP: 'α' };
const E1H = { NS: 'η', GS: 'ης', DS: 'ῃ', AS: 'ην', VS: 'η', NP: 'αι', GP: 'ων', DP: 'αις', AP: 'ας', VP: 'αι' };
const E1A = { NS: 'α', GS: 'ας', DS: 'ᾳ', AS: 'αν', VS: 'α', NP: 'αι', GP: 'ων', DP: 'αις', AP: 'ας', VP: 'αι' };
const E1AH = { NS: 'α', GS: 'ης', DS: 'ῃ', AS: 'αν', VS: 'α', NP: 'αι', GP: 'ων', DP: 'αις', AP: 'ας', VP: 'αι' };
const E1MH = { NS: 'ης', GS: 'ου', DS: 'ῃ', AS: 'ην', VS: 'α', NP: 'αι', GP: 'ων', DP: 'αις', AP: 'ας', VP: 'αι' };
const E1MA = { NS: 'ας', GS: 'ου', DS: 'ᾳ', AS: 'αν', VS: 'α', NP: 'αι', GP: 'ων', DP: 'αις', AP: 'ας', VP: 'αι' };
const E3 = { NS: '— / ς', GS: 'ος', DS: 'ι', AS: 'α / ν', VS: '— / stem', NP: 'ες', GP: 'ων', DP: 'σι(ν)', AP: 'ας', VP: 'ες' };
const E3N = { NS: '—', GS: 'ος', DS: 'ι', AS: '—', VS: '—', NP: 'α', GP: 'ων', DP: 'σι(ν)', AP: 'α', VP: 'α' };
const CASE_NAME = { N: 'nominative', G: 'genitive', D: 'dative', A: 'accusative', V: 'vocative' };
const GEN_NAME = { M: 'masculine', F: 'feminine', N: 'neuter' };

function nominalNotes(L, F, d, out) {
  const sl = d.slots; if (!sl.case || !sl.number) return;
  const key = sl.case + sl.number; let tbl, decl;
  const adj = d.pos === 'A';
  const stemOfLemma = L.replace(/(ος|ον|η|α|ης|ας|υς|ευς|ις|ων|ηρ|ωρ|ρ|ς|ν)$/, '');
  if (adj && /(ος)$/.test(L) && sl.gender) {
    if (sl.gender === 'F') { const alpha = /(ε|ι|ρ)$/.test(stemOfLemma); tbl = alpha ? E1A : E1H; decl = '2-1-2 adjective, feminine (1st declension, ' + (alpha ? '-α' : '-η') + ' type)'; }
    else if (sl.gender === 'N') { tbl = E2N; decl = '2-1-2 adjective, neuter (2nd declension -ον)'; } else { tbl = E2M; decl = '2-1-2 adjective, masculine (2nd declension -ος)'; }
  } else if (/ος$/.test(L)) { tbl = sl.gender === 'N' ? E2N : E2M; decl = '2nd declension (-ος' + (sl.gender === 'F' ? ', feminine' : '') + ')'; }
  else if (/ον$/.test(L)) { tbl = E2N; decl = '2nd declension neuter (-ον)'; }
  else if (/ης$/.test(L) && sl.gender === 'M') { tbl = E1MH; decl = '1st declension masculine (-ης)'; }
  else if (/ας$/.test(L) && sl.gender === 'M') { tbl = E1MA; decl = '1st declension masculine (-ας)'; }
  else if (/(εα|ια|ρα)$/.test(L)) { tbl = E1A; decl = '1st declension feminine (-α pure)'; }
  else if (/α$/.test(L) && sl.gender === 'F') { tbl = E1AH; decl = '1st declension feminine (-α impure: -α/-ης)'; }
  else if (/η$/.test(L)) { tbl = E1H; decl = '1st declension feminine (-η)'; }
  else if (d.pos === 'T') return;
  else { tbl = sl.gender === 'N' ? E3N : E3; decl = '3rd declension'; }
  const e = tbl[key]; if (!e) return;
  out.push(decl + ': ' + CASE_NAME[sl.case] + ' ' + NUM_NAME[sl.number] + (sl.gender ? ' ' + GEN_NAME[sl.gender] : '') + (e === '—' ? ' is the bare stem (no ending added).' : ' ends in -' + e.replace(/^-/, '') + '.'));
  if (decl === '3rd declension') {
    out.push('Endings attach to the stem you see in the genitive singular, so the stem can look different from the lemma; before -σι(ν) the stem’s last consonant changes or drops.');
    if (/(ν)$/.test(F) && !/(ν)$/.test(L) && sl.case === 'A') out.push('Accusative singular: -α after a consonant stem, -ν after a vowel stem.');
  }
  if (sl.case === 'V' && sl.number === 'P') out.push('The vocative plural always matches the nominative plural.');
}
