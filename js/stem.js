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

const PRIMARY_A = { '1S': 'ω', '2S': 'εις', '3S': 'ει', '1P': 'ομεν', '2P': 'ετε', '3P': 'ουσι(ν)' };
const SECOND_A = { '1S': 'ον', '2S': 'ες', '3S': 'ε(ν)', '1P': 'ομεν', '2P': 'ετε', '3P': 'ον' };
const FIRST_AOR = { '1S': 'α', '2S': 'ας', '3S': 'ε(ν)', '1P': 'αμεν', '2P': 'ατε', '3P': 'αν' };
const PERFECT_A = { '1S': 'α', '2S': 'ας', '3S': 'ε(ν)', '1P': 'αμεν', '2P': 'ατε', '3P': 'ασι(ν)' };
const PRIMARY_M = { '1S': 'ομαι', '2S': 'ῃ / ει', '3S': 'εται', '1P': 'ομεθα', '2P': 'εσθε', '3P': 'ονται' };
const SECOND_M = { '1S': 'ομην', '2S': 'ου', '3S': 'ετο', '1P': 'ομεθα', '2P': 'εσθε', '3P': 'οντο' };
const FIRST_AOR_M = { '1S': 'αμην', '2S': 'ω', '3S': 'ατο', '1P': 'αμεθα', '2P': 'ασθε', '3P': 'αντο' };
const AOR_PASS = { '1S': 'ην', '2S': 'ης', '3S': 'η', '1P': 'ημεν', '2P': 'ητε', '3P': 'ησαν' };
const PERS_NAME = { 1: '1st', 2: '2nd', 3: '3rd' }, NUM_NAME = { S: 'singular', P: 'plural' };

function personalEnding(sl) {
  const k = sl.person + sl.number; if (!sl.person) return null;
  const mid = 'MPEDON'.includes(sl.voice), pass = sl.voice === 'P' || sl.voice === 'O';
  let set, label;
  if (sl.mood !== 'I') return null;
  if (sl.tense === 'A' && pass) { set = AOR_PASS; label = 'aorist passive (-θη-/-η- + ending)'; }
  else if (sl.tense === 'A' && sl.second) { set = mid ? SECOND_M : SECOND_A; label = '2nd aorist (imperfect-style ending)'; }
  else if (sl.tense === 'A') { set = mid ? FIRST_AOR_M : FIRST_AOR; label = '1st aorist (-σα- type)'; }
  else if (sl.tense === 'I') { set = mid ? SECOND_M : SECOND_A; label = 'secondary ' + (mid ? 'middle/passive' : 'active'); }
  else if (sl.tense === 'R') { set = mid ? PRIMARY_M : PERFECT_A; label = 'perfect ' + (mid ? 'middle/passive (attached straight to the stem)' : 'active'); }
  else if (sl.tense === 'L') { set = mid ? SECOND_M : { '1S': 'ειν', '2S': 'εις', '3S': 'ει(ν)', '1P': 'εμεν', '2P': 'ετε', '3P': 'εσαν' }; label = 'pluperfect'; }
  else { set = mid ? PRIMARY_M : PRIMARY_A; label = 'primary ' + (mid ? 'middle/passive' : 'active'); }
  return set[k] ? '-' + set[k] + ' = ' + PERS_NAME[sl.person] + ' person ' + NUM_NAME[sl.number] + ', ' + label : null;
}

const PTC = {
  PA: '-ων / -ουσα / -ον (genitive -οντος, -ουσης)', AA: '-σας / -σασα / -σαν (genitive -σαντος, -σασης)', A2A: '-ων / -ουσα / -ον on the 2nd-aorist stem',
  RA: '-κως / -κυια / -κος (genitive -κοτος, -κυιας)', FA: '-σων / -σουσα / -σον', AP: '-θεις / -θεισα / -θεν (genitive -θεντος, -θεισης)', A2P: '-εις / -εισα / -εν',
  PM: '-ομενος / -ομενη / -ομενον', AM: '-σαμενος / -σαμενη / -σαμενον', A2M: '-ομενος / -ομενη / -ομενον', RM: '-μενος / -μενη / -μενον', FM: '-σομενος / -σομενη / -σομενον',
};
const INF = { PA: '-ειν', AA: '-σαι', A2A: '-ειν', RA: '-κεναι', FA: '-σειν', AP: '-θηναι', A2P: '-ηναι', PM: '-εσθαι', AM: '-σασθαι', A2M: '-εσθαι', RM: '-σθαι', FM: '-σεσθαι', IA: '-ειν' };

export function explain(lemmaHead, formText, d) {
  const out = [];
  const sl = d.slots, F = skel(formText);
  if (d.pos === 'V' && /^(ειμι|οιδα|φημι)$/.test(cleanLemma(lemmaHead))) { out.push(skel(lemmaHead) === 'οιδα' ? 'οἶδα is a perfect in form with a present meaning (“I know”); learn its forms as a set.' : 'This verb is irregular; learn its forms as a set rather than building them from a stem.'); const e = sl.mood === 'I' ? personalEnding(sl) : null; return out; }
  if (d.pos === 'V' && sl.tense) verbNotes(cleanLemma(lemmaHead), F, sl, out);
  else if (['N', 'A'].includes(d.pos) || (d.pos === 'T')) nominalNotes(cleanLemma(lemmaHead), F, d, out);
  return out;
}

function verbNotes(L, F, sl, out) {
  const act = sl.voice === 'A' || sl.voice === 'Q';
  const pass = sl.voice === 'P' || sl.voice === 'O';
  const mid = !act && !pass;
  const t = sl.tense, ind = sl.mood === 'I';
  const sp = splitPrefix(L, F);
  const lr = sp ? sp.lemmaRest : L, fr = sp ? sp.formRest : F;
  const parts = lemmaParts(lr), P = lemmaParts(L);
  const pref = sp ? ' (after the prefix ' + sp.prefix + (sp.shown !== sp.prefix ? '→' + sp.shown : '') + '-)' : '';

  // 1. augment / reduplication
  if (ind && (t === 'I' || t === 'A' || t === 'L')) {
    const c0 = lr[0], two = lr.slice(0, 2);
    if (isV(c0)) {
      const to = AUG[two] || AUG[c0] || c0;
      const seen = fr.startsWith(to) ? to : (fr.startsWith('ει') && c0 === 'ε' ? 'ει' : null);
      if (seen && seen !== (AUG[two] ? two : c0)) out.push('Temporal augment' + pref + ': the stem’s opening vowel lengthens (' + (AUG[two] ? two : c0) + ' → ' + seen + ') to mark past time.');
      else out.push('Augment' + pref + ': the opening vowel is already long, so the augment is invisible.');
    } else if (fr.startsWith('ε') && !lr.startsWith('ε')) {
      out.push('Syllabic augment' + pref + ': ε- is added before the stem to mark past time' + (t === 'L' ? ' (on top of the reduplication)' : '') + '.');
    } else if (fr.startsWith('ρρ') || (lr[0] === 'ρ' && fr.startsWith('ερ'))) out.push('Augment: ρ doubles (ρρ) after the ε- augment.');
  }
  if (t === 'R' || t === 'L') {
    const c0 = lr[0];
    if (!isV(c0)) {
      const base = fr.startsWith('ε') && t === 'L' && fr[1] !== 'ε' && fr.slice(1, 3) === (DEASP[c0] || c0) + 'ε' ? fr.slice(1) : fr;
      if (CLUSTER.test(lr) && base.startsWith('ε')) out.push('Perfect stem' + pref + ': stems that open with a cluster (ψ, ξ, ζ, στ, γν…) take ε- instead of true reduplication.');
      else if (base[1] === 'ε' && (base[0] === c0 || base[0] === DEASP[c0])) {
        out.push('Reduplication' + pref + ': the first consonant repeats with ε (' + base.slice(0, 2) + '-' + lr.slice(0, 2) + '…)' + (base[0] !== c0 ? ' — the aspirate ' + c0 + ' is replaced by ' + base[0] + '.' : '.'));
      }
    } else if (isV(c0) && ind) out.push('Perfect of a vowel-initial verb: the opening vowel lengthens, as with an augment.');
  }

  // 2. tense formatives
  const cls = parts.contract ? 'vowel' : lastClass(parts.stem.replace(/(σκ)$/, ''));
  const kAor = parts.type === 'μι' && t === 'A' && !pass && /κ[αε]/.test(F);
  const stemNote = [];
  if (parts.type === 'ω' && /σκω$/.test(P.stem + 'ω') && /σκ$/.test(parts.stem)) stemNote.push('-σκ- is only a present-tense expander; other tenses use the bare root (' + parts.stem.replace(/σκ$/, '') + '-).');
  if (/(αιν|ειν|υν)$/.test(parts.stem) && parts.type === 'ω') stemNote.push('The ι/ν in -' + parts.stem.slice(-3) + 'ω is a present-stem marker; the root is ' + parts.stem.replace(/(αιν|ειν|υν)$/, (m) => m.replace(/ιν$/, 'ν').replace(/^υν$/, 'υν')) + '-.');
  if (/(αν)$/.test(parts.stem) && /(β|λ|θ|μ|γ|κ)αν$/.test(parts.stem) && t !== 'P' && t !== 'I') stemNote.push('Nasal present stem (-αν-): the aorist and other tenses use the shorter root (e.g. λαμβάνω → λαβ-).');
  if (/(ττ|σσ|ζ|λλ|πτ)$/.test(parts.stem) && t !== 'P' && t !== 'I') stemNote.push('The doubled/compound ending of the present stem (' + parts.stem.slice(-2) + ') comes from the root + ι/τ; other tenses go back to the root.');
  if (t !== 'P' && t !== 'I') out.push(...stemNote);

  const contractLong = parts.contract ? { α: 'η (or α after ε, ι, ρ)', ε: 'η', ο: 'ω' }[parts.contract] : null;
  if (parts.contract && ['F', 'A', 'R'].includes(t) && !(t === 'A' && sl.second) && !(pass && t === 'A' && !/θ/.test(F)))
    out.push('Contract verb (-' + parts.contract + 'ω): the stem vowel lengthens to ' + contractLong + ' before the tense marker.');
  if (parts.contract && (t === 'P' || t === 'I') && !(sl.mood === 'N' && false))
    out.push({ α: 'α-contract: α + ε → α, α + ο/ω → ω, α + ει/η → ᾳ, α + ου → ω.', ε: 'ε-contract: ε + ε → ει, ε + ο → ου, ε disappears before a long vowel or ει/ου.', ο: 'ο-contract: ο + ε/ο → ου, ο + η/ω → ω, ο + ει/οι → οι.' }[parts.contract]);
  if (parts.type === 'μι' && (t === 'P' || t === 'I')) out.push('-μι verb: the present reduplicates with ι (δί-δω-μι, τί-θη-μι, ἵ-στη-μι) and the root vowel alternates long/short (δω-/δο-).');
  else if (kAor) out.push('κ-aorist: δίδωμι, τίθημι and ἵημι use -κα in the aorist active (ἔδωκα, ἔθηκα, ἧκα).');

  if (t === 'F' && !pass) {
    if (cls === 'liquid') out.push('Liquid stem (' + parts.stem.slice(-1) + '): no σ in the future; it takes contract-style -εω endings (μενῶ, ἀποστελῶ).');
    else if (cls === 'velar') out.push('Future: velar stem + σ → ξ.');
    else if (cls === 'labial') out.push('Future: labial stem + σ → ψ.');
    else if (cls === 'dental') out.push('Future: dental stem (τ δ θ ζ) drops out before σ.');
    else out.push('Future marker: -σ- between stem and ending.');
  }
  if (t === 'A' && !pass && !kAor) {
    if (sl.second) out.push('2nd aorist: a different (usually shorter) stem' + (parts.stem !== L ? '' : '') + ' with imperfect-style endings and no -σα-' + stemOf(lr, fr) + '.');
    else if (cls === 'liquid') out.push('Liquid stem: the 1st aorist drops σ and lengthens the stem vowel instead (μένω → ἔμεινα, ἀποστέλλω → ἀπέστειλα).');
    else if (cls === 'velar') out.push('1st aorist: velar + σ → ξ, then -α- (ἐδίωξα).');
    else if (cls === 'labial') out.push('1st aorist: labial + σ → ψ, then -α- (ἔπεμψα).');
    else if (cls === 'dental') out.push('1st aorist: the dental drops before σ (ἔπεισα from πείθω).');
    else out.push('1st aorist marker: -σα- (λύ-σα-).');
  }
  if ((t === 'A' || t === 'F') && pass) {
    const fut = t === 'F';
    if (sl.second && !fut) out.push('2nd aorist passive: -ην/-η- without θ (ἐγράφην).');
    else {
      out.push((fut ? 'Future passive: -θησ- (+ middle endings).' : 'Aorist passive: -θη- (ἐ-λύ-θη-ν).') + (cls === 'velar' ? ' A velar before θ becomes χ (διώκω → ἐδιώχθην).' : cls === 'labial' ? ' A labial before θ becomes φ (πέμπω → ἐπέμφθην).' : cls === 'dental' ? ' A dental before θ becomes σ (πείθω → ἐπείσθην).' : ''));
    }
  }
  if (t === 'R' && act) out.push(sl.second ? '2nd perfect: no κ — the stem is aspirated or changed instead (γέγραφα, ἀκήκοα).' : 'Perfect active marker: -κα- (λέ-λυ-κα).');
  if (t === 'R' && !act) out.push('Perfect middle/passive: no κ; endings attach directly to the reduplicated stem' + (cls !== 'vowel' ? ', and the final consonant changes before them (γέγραμμαι, ἤγγελμαι).' : '.'));
  if (t === 'L' && !act) out.push('Pluperfect middle/passive: like the perfect middle/passive with secondary endings.');
  void mid;

  // 3. ablaut / other stem difference
  if (['A', 'R', 'F'].includes(t)) { const ab = ablaut(parts.stem, fr); if (ab) out.push(ab); }

  // 4. mood / endings
  if (sl.mood === 'I') { const e = personalEnding(sl); if (e) out.push('Ending ' + e + '.'); }
  else if (sl.mood === 'S') out.push('Subjunctive: the connecting vowel lengthens (ο → ω, ε → η), so endings look like -ω -ῃς -ῃ -ωμεν -ητε -ωσι.');
  else if (sl.mood === 'O') out.push('Optative: ι joins the ending (-οι-, -αι-, -ειη-), e.g. λύοιμι, λύσαιμι.');
  else if (sl.mood === 'M') out.push('Imperative: 2nd person -ε / -ου / -σον / -θητι; 3rd person adds -τω / -σθω.');
  else if (sl.mood === 'N') { const k = t + (sl.second && t === 'A' ? '2' : '') + (act ? 'A' : pass ? 'P' : 'M'); const v = INF[k] || INF[t + (act ? 'A' : pass ? 'P' : 'M')]; if (v) out.push('Infinitive ending ' + v + '.'); }
  else if (sl.mood === 'P') { const k = t + (sl.second && t === 'A' ? '2' : '') + (act ? 'A' : pass ? 'P' : 'M'); const v = PTC[k] || PTC[t + (act ? 'A' : pass ? 'P' : 'M')]; if (v) out.push('Participle markers (masc / fem / neut): ' + v + '.'); }
}

function stemOf(lr, fr) {
  const S = lemmaParts(lr).stem; if (S.length < 2) return '';
  const f = fr.replace(/^ε/, '');
  let k = isV(S[0]) && isV(fr[0]) ? 1 : 0; while (k < S.length && (fr[k] === S[k] || f[k] === S[k])) k++;
  return k < 1 ? ' — and here the root is completely different from the present (suppletive); learn it as a principal part' : '';
}

function ablaut(S, fr) {
  const core = S.replace(/[^αεηιουω]+$/, '');            // ignore the consonants at the end of the stem
  if (core.length < 2) return '';
  for (const s of [fr.slice(0, core.length), fr[0] === 'ε' ? fr.slice(1, core.length + 1) : null]) {
    if (!s || s === core) continue;
    let diff = 0, at = -1;
    for (let i = 0; i < core.length; i++) if (core[i] !== s[i]) { diff++; at = i; }
    if (diff === 1 && at > 0 && isV(core[at]) && isV(s[at])) return 'Stem vowel change: ' + core[at] + ' → ' + s[at] + ' (' + core + '- → ' + s + '-).';
  }
  return '';
}

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
    out.push('Endings attach to the stem you see in the genitive singular (σῶμα → σώματος, stem σωματ-), so the stem can look different from the lemma; before -σι(ν) the stem’s last consonant changes or drops (σώμασιν).');
    if (/(ν)$/.test(F) && !/(ν)$/.test(L) && sl.case === 'A') out.push('Accusative singular: -α after a consonant stem, -ν after a vowel stem.');
  }
  if (sl.case === 'V' && sl.number === 'P') out.push('The vocative plural always matches the nominative plural.');
}
