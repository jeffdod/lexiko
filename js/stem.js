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

const PRIMARY_A = { '1S': 'ω', '2S': 'εισ', '3S': 'ει', '1P': 'ομεν', '2P': 'ετε', '3P': 'ουσι(ν)' };
const SECOND_A = { '1S': 'ον', '2S': 'εσ', '3S': 'ε(ν)', '1P': 'ομεν', '2P': 'ετε', '3P': 'ον' };
const FIRST_AOR = { '1S': 'α', '2S': 'ασ', '3S': 'ε(ν)', '1P': 'αμεν', '2P': 'ατε', '3P': 'αν' };
const PERFECT_A = { '1S': 'α', '2S': 'ασ', '3S': 'ε(ν)', '1P': 'αμεν', '2P': 'ατε', '3P': 'ασι(ν)' };
const PRIMARY_M = { '1S': 'ομαι', '2S': 'ηι / ει', '3S': 'εται', '1P': 'ομεθα', '2P': 'εσθε', '3P': 'ονται' };
const SECOND_M = { '1S': 'ομην', '2S': 'ου', '3S': 'ετο', '1P': 'ομεθα', '2P': 'εσθε', '3P': 'οντο' };
const FIRST_AOR_M = { '1S': 'αμην', '2S': 'ω', '3S': 'ατο', '1P': 'αμεθα', '2P': 'ασθε', '3P': 'αντο' };
const AOR_PASS = { '1S': 'ην', '2S': 'ησ', '3S': 'η', '1P': 'ημεν', '2P': 'ητε', '3P': 'ησαν' };
const PERF_M = { '1S': 'μαι', '2S': 'σαι', '3S': 'ται', '1P': 'μεθα', '2P': 'σθε', '3P': 'νται' };
const PLUP_A = { '1S': 'ειν', '2S': 'εισ', '3S': 'ει(ν)', '1P': 'εμεν', '2P': 'ετε', '3P': 'εσαν' };
const PLUP_M = { '1S': 'μην', '2S': 'σο', '3S': 'το', '1P': 'μεθα', '2P': 'σθε', '3P': 'ντο' };
const PERS_NAME = { 1: '1st', 2: '2nd', 3: '3rd' }, NUM_NAME = { S: 'singular', P: 'plural' };
const TENSE_NAME = { P: 'present', I: 'imperfect', F: 'future', A: 'aorist', R: 'perfect', L: 'pluperfect' };
const VOICE_NAME = { A: 'active', M: 'middle', P: 'passive', E: 'middle/passive', D: 'middle', O: 'passive', N: 'middle/passive', Q: 'active' };
const MOOD_NAME = { I: 'indicative', S: 'subjunctive', O: 'optative', M: 'imperative', N: 'infinitive', P: 'participle' };

/** "ουσι(ν)" → ["ουσιν","ουσι"]; "ηι / ει" → ["ηι","ει"] */
const alts = (e) => e.split(' / ').flatMap((x) => { const m = /^(.*)\((.*)\)$/.exec(x); return m ? [m[1] + m[2], m[1]] : [x]; });

// Families of tails (tense sign + ending) for the indicative. cls: which voice class the family belongs to.
const IND = {
  P: [{ mk: [''], set: PRIMARY_A, cls: 'a' }, { mk: [''], set: PRIMARY_M, cls: 'm' }],
  I: [{ mk: [''], set: SECOND_A, cls: 'a' }, { mk: [''], set: SECOND_M, cls: 'm' }],
  F: [{ mk: ['σ', 'ξ', 'ψ'], set: PRIMARY_A, cls: 'a' }, { mk: ['σ', 'ξ', 'ψ'], set: PRIMARY_M, cls: 'm' }, { mk: ['θησ'], set: PRIMARY_M, cls: 'p', sign: 'future passive' }, { mk: ['ησ'], set: PRIMARY_M, cls: 'p', sign: 'future passive' }],
  A: [{ mk: ['θ'], set: AOR_PASS, cls: 'p', sign: 'aorist passive' }, { mk: [''], set: AOR_PASS, cls: 'p', second: true }, { mk: ['σ', 'ξ', 'ψ', 'κ', ''], set: FIRST_AOR, cls: 'a' }, { mk: [''], set: SECOND_A, cls: 'a', second: true },
    { mk: ['σ', 'ξ', 'ψ', ''], set: FIRST_AOR_M, cls: 'm' }, { mk: [''], set: SECOND_M, cls: 'm', second: true }],
  R: [{ mk: ['κ'], set: PERFECT_A, cls: 'a' }, { mk: [''], set: PERFECT_A, cls: 'a', second: true }, { mk: [''], set: PERF_M, cls: 'm' }],
  L: [{ mk: ['κ', ''], set: PLUP_A, cls: 'a' }, { mk: [''], set: PLUP_M, cls: 'm' }],
};
// Non-indicative tails: [sign, ending, voice class]. Only the letters at the very end of the form are matched.
const INF_T = {
  P: [['', 'ειν', 'a'], ['', 'εσθαι', 'm'], ['', 'ναι', 'a']], F: [['σ', 'ειν', 'a'], ['σ', 'εσθαι', 'm'], ['θησ', 'εσθαι', 'p']],
  A: [['σ', 'αι', 'a'], ['ξ', 'αι', 'a'], ['ψ', 'αι', 'a'], ['', 'αι', 'a'], ['', 'ειν', 'a'], ['σ', 'ασθαι', 'm'], ['ξ', 'ασθαι', 'm'], ['ψ', 'ασθαι', 'm'], ['', 'εσθαι', 'm'], ['θ', 'ηναι', 'p'], ['', 'ηναι', 'p']],
  R: [['κ', 'εναι', 'a'], ['', 'εναι', 'a'], ['', 'σθαι', 'm']],
};
const SUBJ_T = { a: ['ω', 'ηισ', 'ηι', 'ωμεν', 'ητε', 'ωσι(ν)'], m: ['ωμαι', 'ηι', 'ηται', 'ωμεθα', 'ησθε', 'ωνται'] };
const IMPV_T = { '2S': [['', 'ε', 'a'], ['σ', 'ον', 'a'], ['ξ', 'ον', 'a'], ['ψ', 'ον', 'a'], ['θ', 'ητι', 'p'], ['', 'ου', 'm'], ['σ', 'αι', 'm']], '3S': [['', 'ετω', 'a'], ['σ', 'ατω', 'a'], ['θ', 'ητω', 'p'], ['', 'εσθω', 'm'], ['σ', 'ασθω', 'm']],
  '2P': [['', 'ετε', 'a'], ['σ', 'ατε', 'a'], ['θ', 'ητε', 'p'], ['', 'εσθε', 'm'], ['σ', 'ασθε', 'm']], '3P': [['', 'ετωσαν', 'a'], ['σ', 'ατωσαν', 'a'], ['θ', 'ητωσαν', 'p'], ['', 'εσθωσαν', 'm']] };
const PTC_RX = { P: /(ομεν|οντ|ουσ|ων|ον|μεν)/, I: null, F: /(σομεν|σοντ|σουσ|σων|σον)/, A: /(θεντ|θεισ|θεν|σαμεν|ξαμεν|ψαμεν|σαντ|σασ|σαν|ξαντ|ξασ|ξαν|ψαντ|ψασ|ψαν|ομεν|οντ|ουσ|ων|ον|εντ|εισ|εν)/, R: /(κοτ|κυι|κωσ|κοσ|κος|μεν|οτ|υι|ωσ)/ };

const voiceCls = (v) => ('AQ'.includes(v) ? 'a' : 'PO'.includes(v) ? 'p' : 'm');

/** Find the sign + ending at the end of the form. → { sign, end, rest } (rest = what remains in front) or null. */
function findTail(sl, F) {
  const vc = voiceCls(sl.voice), t = sl.tense, k = sl.person + sl.number;
  let best = null;
  const consider = (sign, ends, cls, extra = {}) => {
    for (const e of ends) { const tail = sign + e; if (!F.endsWith(tail) || F.length - tail.length < 1) continue;
      const sc = tail.length + (cls === vc ? 0.5 : 0) + (extra.second === !!sl.second ? 0.25 : 0);
      if (!best || sc > best.sc) best = { sign, end: e, sc, ...extra }; }
  };
  if (sl.mood === 'I' && sl.person) { for (const f of IND[t] || []) for (const m of f.mk) consider(m, alts(f.set[k] || '~'), f.cls, { signName: f.sign, second: f.second }); }
  else if (sl.mood === 'N') for (const [s, e, c] of INF_T[t] || []) consider(s, [e], c, { second: undefined });
  else if (sl.mood === 'S' && sl.person) { for (const c of ['a', 'm']) for (const s of ['', 'σ', 'ξ', 'ψ']) consider(s, alts(SUBJ_T[c][{ '1S': 0, '2S': 1, '3S': 2, '1P': 3, '2P': 4, '3P': 5 }[k]] || '~'), c); consider('θ', alts(SUBJ_T.a[{ '1S': 0, '2S': 1, '3S': 2, '1P': 3, '2P': 4, '3P': 5 }[k]] || '~'), 'p', { signName: 'aorist passive' }); }
  else if (sl.mood === 'M' && sl.person) for (const [s, e, c] of IMPV_T[k] || []) consider(s, [e], c);
  else if (sl.mood === 'P' && PTC_RX[t]) { const m = PTC_RX[t].exec(F); if (m && m.index > 0) { best = { sign: '', end: F.slice(m.index), sc: 1, ptc: true }; } }
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
  const tl = tail ? (tail.sign + tail.end).length : 0;
  const stemEnd = F.length - tl;
  const ok = tail && stemEnd > at;
  if (ok) {
    if (tail.ptc) pieces.push({ a: at, b: stemEnd, role: 'stem', kind: 'stem' }, { a: stemEnd, b: F.length, role: 'participle ending', kind: 'end' });
    else {
      pieces.push({ a: at, b: stemEnd, role: 'stem', kind: 'stem' });
      if (tail.sign) pieces.push({ a: stemEnd, b: stemEnd + tail.sign.length, role: (tail.signName || signName(t, tail.sign, sl)) + ' sign', kind: 'mark' });
      pieces.push({ a: stemEnd + tail.sign.length, b: F.length, role: endRole(sl, tail), kind: 'end' });
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
  if (ok && tail.sign) N.push('-' + tail.sign + '- is the ' + (tail.signName || signName(t, tail.sign, sl)) + ' sign' + signWhy(tail.sign, t, stemSk, stemOfLemma, lemmaHead) + '.');
  else if (ok && !tail.ptc && t === 'A' && !pass(sl) && tail.sign === '' && sl.second) N.push('No σ before the ending: ' + formText + ' is a 2nd aorist, built on its own stem ' + S + '- with the endings of the imperfect.');
  else if (ok && !tail.ptc && t === 'A' && !pass(sl) && tail.sign === '' && /(λ|μ|ν|ρ)$/.test(stemOfLemma)) N.push('The stem of ' + lemmaHead + ' ends in ' + stemOfLemma.slice(-1) + ', a liquid, so the 1st aorist takes its endings with no σ.');
  if (ok && !tail.ptc) { const es = endingNote(sl, tail, shown(stemEnd + tail.sign.length, F.length)); if (es) N.push(es); }
  if (ok && tail.ptc) N.push('-' + shown(stemEnd, F.length) + ' is the ' + TENSE_NAME[t] + ' ' + VOICE_NAME[sl.voice].toLowerCase() + ' participle ending.');
  if (ok) { const sc = stemChange(stemSk, stemOfLemma, temporal, tail.sign || tail.end[0], lemmaHead, S, lr, !!tail.sign); if (sc) N.push(sc); }
  if (!ok || out.contractOnly) {
    const P = lemmaParts(lr);
    if (P.contract && (t === 'P' || t === 'I' || t === 'F' || t === 'A' || t === 'R')) N.push(lemmaHead + ' is an ' + P.contract + '-contract verb: its stem vowel ' + P.contract + ' merges with the ending’s vowel, so in ' + formText + ' stem and ending are written as one.');
  }
  else if (ok && lemmaParts(lr).contract && (t === 'P' || t === 'I')) N.push(lemmaHead + ' is an ' + lemmaParts(lr).contract + '-contract verb: its stem vowel merges with the ending’s vowel, which is why the ending of ' + formText + ' looks different from a regular -ω verb.');
  out.notes = N.filter(Boolean);
  return out;
}

const pass = (sl) => sl.voice === 'P' || sl.voice === 'O';
function signName(t, s, sl) {
  if (t === 'F') return s === 'θησ' || s === 'ησ' ? 'future passive' : 'future';
  if (t === 'A') return s === 'θ' ? 'aorist passive' : s === 'κ' ? 'κ-aorist' : '1st aorist';
  if (t === 'R') return 'perfect active';
  if (t === 'L') return 'pluperfect';
  return TENSE_NAME[t];
}
function signWhy(s, t, stemSk, lemmaStem, head) {
  if (s === 'ξ' || s === 'ψ') { const gone = lemmaStem.slice(stemSk.length); if (lemmaStem.startsWith(stemSk) && gone.length === 1) return ': the last letter of the stem of ' + head + ', ' + gone + ', combined with σ to give ' + s; return ': σ joined with the stem’s last consonant'; }
  if (s === 'σ' && lemmaStem.startsWith(stemSk) && lemmaStem.length - stemSk.length === 1 && /[τδθζ]/.test(lemmaStem.slice(-1))) return ', and the stem’s final ' + lemmaStem.slice(-1) + ' dropped out before it';
  if (s === 'θ') return '';
  return '';
}
function endRole(sl, tail) {
  const who = sl.person ? PERS_NAME[sl.person] + ' ' + NUM_NAME[sl.number] : '';
  if (sl.mood === 'N') return 'infinitive ending';
  return who ? who + ' ending' : 'ending';
}
function endingNote(sl, tail, shownEnd) {
  tail = tail || {};
  const e = '-' + shownEnd;
  if (sl.mood === 'N') return e + ' is the ' + TENSE_NAME[sl.tense] + ' ' + VOICE_NAME[sl.voice].toLowerCase() + ' infinitive ending.';
  if (!sl.person) return null;
  return e + ' marks the ' + PERS_NAME[sl.person] + ' person ' + NUM_NAME[sl.number] + ' (' + (sl.mood === 'I' ? (tail.signName === 'aorist passive' || (sl.tense === 'A' && /^η/.test(tail.end) && sl.voice !== 'A') ? 'the endings that follow -θη-' : 'the ' + TENSE_NAME[sl.tense] + ' ' + VOICE_NAME[sl.voice].toLowerCase() + ' endings') : MOOD_NAME[sl.mood] + ' endings') + ').';
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
  if (!isV(lemmaStem[0]) && stemSk[0] !== lemmaStem[0] && !DEASP[lemmaStem[0]]) return 'This form is built on a different stem, ' + S + '-, from the one in ' + head + ' (' + lemmaStem + '-). Learn it as a principal part.';
  return 'The stem here is ' + S + '-; the dictionary form ' + head + ' shows ' + lemmaStem + '-, so this tense uses a changed form of the stem.';
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
