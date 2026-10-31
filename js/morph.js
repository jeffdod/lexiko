// Decoder for Robinson-Pierpont morphology codes (e.g. V-2AAI-3S, N-GSM, P-1DS, A-NSM-C).
const POS = {
  N: 'Noun', A: 'Adjective', T: 'Article', R: 'Relative pronoun', C: 'Reciprocal pronoun', D: 'Demonstrative pronoun',
  K: 'Correlative pronoun', I: 'Interrogative pronoun', X: 'Indefinite pronoun', Q: 'Correlative/interrogative pronoun',
  F: 'Reflexive pronoun', S: 'Possessive pronoun', P: 'Personal pronoun', V: 'Verb', ADV: 'Adverb', CONJ: 'Conjunction',
  COND: 'Conditional', PRT: 'Particle', PREP: 'Preposition', INJ: 'Interjection', ARAM: 'Aramaic word', HEB: 'Hebrew word',
};
export const CASE = { N: 'Nominative', G: 'Genitive', D: 'Dative', A: 'Accusative', V: 'Vocative' };
export const NUM = { S: 'Singular', P: 'Plural' };
export const GEN = { M: 'Masculine', F: 'Feminine', N: 'Neuter' };
export const PERS = { 1: '1st', 2: '2nd', 3: '3rd' };
export const TENSE = { P: 'Present', I: 'Imperfect', F: 'Future', A: 'Aorist', R: 'Perfect', L: 'Pluperfect' };
export const VOICE = {
  A: 'Active', M: 'Middle', P: 'Passive', E: 'Middle or passive', D: 'Middle deponent', O: 'Passive deponent',
  N: 'Middle or passive deponent', Q: 'Impersonal active', X: 'No voice',
};
export const MOOD = { I: 'Indicative', S: 'Subjunctive', O: 'Optative', M: 'Imperative', N: 'Infinitive', P: 'Participle' };
const SUFFIX = {
  S: 'superlative', C: 'comparative', N: 'negative', I: 'interrogative', K: 'crasis', ATT: 'Attic form',
  PRI: 'indeclinable proper noun', OI: 'indeclinable noun', LI: 'indeclinable (letter)', NUI: 'indeclinable numeral',
};

const RE_CNG = /^([NGDAV])([SP])([MFN])$/;
const RE_PCN = /^([123])([NGDAV])([SP])$/;

/** decode('V-2AAI-3S') -> {code,pos,posName,slots:{...},summary,short} */
export function decode(code) {
  const [pos, ...rest] = code.split('-');
  const slots = {};
  const bits = [];       // human-readable pieces
  const abbr = [];
  const notes = [];
  const cng = (s) => {
    const m = RE_CNG.exec(s); if (!m) return false;
    slots.case = m[1]; slots.number = m[2]; slots.gender = m[3];
    bits.push(CASE[m[1]], NUM[m[2]], GEN[m[3]]); abbr.push(m[1] + m[2] + m[3]); return true;
  };
  let tail = rest.slice();
  if (pos === 'V') {
    const m = /^(2?)([PIFARL])([AMPEDONQX])([IOSMNP])$/.exec(tail[0] || '');
    if (m) {
      slots.tense = m[2]; slots.second = m[1] === '2'; slots.voice = m[3]; slots.mood = m[4];
      bits.push((m[1] ? '2nd ' : '') + TENSE[m[2]].toLowerCase().replace(/^./, (c) => c.toUpperCase()), VOICE[m[3]], MOOD[m[4]]);
      abbr.push(m[1] + m[2] + m[3] + m[4]);
      tail = tail.slice(1);
      if (m[4] === 'P') { if (tail[0] && cng(tail[0])) tail = tail.slice(1); }
      else if (m[4] !== 'N' && tail[0]) {
        const pn = /^([123])([SP])$/.exec(tail[0]);
        if (pn) { slots.person = pn[1]; slots.number = pn[2]; bits.push(PERS[pn[1]] + ' person', NUM[pn[2]]); abbr.push(pn[1] + pn[2]); tail = tail.slice(1); }
      }
    }
  } else if (pos === 'P') {
    const a = RE_PCN.exec(tail[0] || '');
    if (a) { slots.person = a[1]; slots.case = a[2]; slots.number = a[3]; bits.push(PERS[a[1]] + ' person', CASE[a[2]], NUM[a[3]]); abbr.push(tail[0]); tail = tail.slice(1); }
    else if (RE_CNG.test(tail[0] || '')) { slots.person = '3'; bits.push('3rd person'); cng(tail[0]); tail = tail.slice(1); }
  } else if (pos === 'F') {
    const m = /^([123])([NGDAV])([SP])([MFN])$/.exec(tail[0] || '');
    if (m) {
      Object.assign(slots, { person: m[1], case: m[2], number: m[3], gender: m[4] });
      bits.push(PERS[m[1]] + ' person', CASE[m[2]], NUM[m[3]], GEN[m[4]]); abbr.push(tail[0]); tail = tail.slice(1);
    }
  } else if (pos === 'S') {
    const m = /^([123])([SP])([NGDAV])([SP])([MFN])$/.exec(tail[0] || '');
    if (m) {
      Object.assign(slots, { person: m[1], possessorNumber: m[2], case: m[3], number: m[4], gender: m[5] });
      bits.push('possessor ' + PERS[m[1]] + ' person ' + NUM[m[2]].toLowerCase(), CASE[m[3]], NUM[m[4]], GEN[m[5]]); abbr.push(tail[0]); tail = tail.slice(1);
    }
  } else if (tail[0] && cng(tail[0])) tail = tail.slice(1);
  for (const t of tail) if (t) { notes.push(SUFFIX[t] || t); abbr.push(t); }
  const posName = POS[pos] || pos;
  const summary = [bits.join(' '), notes.length ? '(' + notes.join(', ') + ')' : ''].filter(Boolean).join(' ');
  return { code, pos, posName, slots, bits, notes, summary, short: [pos, ...abbr].join(' ').trim() };
}

export const isInflected = (pos) => !['ADV', 'CONJ', 'COND', 'PRT', 'PREP', 'INJ', 'ARAM', 'HEB'].includes(pos);
