"""Greek soft-hyphen insertion (U+00AD) at syllable boundaries.

Rules (after Smyth §§139-141, the usual typesetting convention):
  * a syllable nucleus is a vowel or a diphthong (αι ει οι υι αυ ευ ηυ ου ωυ); a diaeresis on ι/υ
    keeps the vowels apart; iota subscript belongs to its vowel
  * hiatus (two nuclei, no consonant between) may be broken
  * one intervocalic consonant goes with the following vowel
  * a consonant cluster that can begin a Greek word goes with the following vowel; otherwise
    it is split at the earliest point that leaves a valid onset (so geminates and γγ, γκ, μπ, ντ... split)
  * never leave fewer than MIN_LEFT letters before / MIN_RIGHT letters after a break
Compound-word (prefix) boundaries are deliberately not modelled.
"""
import unicodedata

SHY = '­'
MIN_LEFT, MIN_RIGHT, MIN_WORD = 2, 2, 5
VOWELS = set('αεηιουω')
DIPH = {'αι', 'ει', 'οι', 'υι', 'αυ', 'ευ', 'ηυ', 'ου', 'ωυ'}
STOPS = set('πβφκγχτδθ')
LIQ = set('λρ')
ONSET2 = ({a + b for a in STOPS for b in LIQ} - {'τλ', 'δλ'}) | {
    'πν', 'κν', 'γν', 'τμ', 'θν', 'χν', 'μν', 'πτ', 'κτ', 'φθ', 'χθ', 'βδ',
    'σκ', 'σπ', 'στ', 'σφ', 'σχ', 'σθ', 'σβ', 'σμ', 'σν', 'σγ', 'σδ',
}
ONSET3 = {'στρ', 'σπρ', 'σκρ', 'σπλ', 'σκλ', 'σχρ', 'σφρ'}


def _units(word):
    """NFD -> list of (base_lower, marks, nfc_text)."""
    out = []
    for ch in unicodedata.normalize('NFD', word):
        if unicodedata.combining(ch) and out:
            b, m = out[-1]
            out[-1] = (b, m + ch)
        else:
            out.append((ch, ''))
    res = []
    for b, m in out:
        res.append((b.lower(), m, unicodedata.normalize('NFC', b + m)))
    return res


def _is_onset(cons):
    if len(cons) == 1:
        return True
    s = ''.join(cons)
    return (len(cons) == 2 and s in ONSET2) or (len(cons) == 3 and s in ONSET3)


def hyphenate(word):
    units = _units(word)
    letters = [u for u in units if u[0].isalpha()]
    if len(letters) < MIN_WORD or len(letters) != len(units) and any(
            not (u[0].isalpha()) and u[0] != '’' for u in units):
        return word
    # trailing elision mark etc. stays glued to the last unit
    n = len(units)
    isv = [u[0] in VOWELS for u in units]
    # nuclei: list of (start, end) unit index ranges
    nuclei = []
    i = 0
    while i < n:
        if isv[i]:
            j = i + 1
            if j < n and isv[j] and (units[i][0] + units[j][0]) in DIPH and '̈' not in units[j][1]:
                j += 1
            nuclei.append((i, j))
            i = j
        else:
            i += 1
    if len(nuclei) < 2:
        return word
    breaks = []  # unit indices where a break occurs *before* that unit
    for a, b in zip(nuclei, nuclei[1:]):
        cons = [units[k][0] for k in range(a[1], b[0])]
        if not cons:
            breaks.append(b[0])
            continue
        k = 0
        while k < len(cons) - 1 and not _is_onset(cons[k:]):
            k += 1
        breaks.append(a[1] + k)
    out = []
    for idx, (_, _, txt) in enumerate(units):
        if idx in breaks and idx >= MIN_LEFT and (n - idx) >= MIN_RIGHT:
            out.append(SHY)
        out.append(txt)
    return ''.join(out)


if __name__ == '__main__':
    for w in ['ἀνθρώπου', 'ἐγέννησεν', 'Ἰησοῦς', 'βασιλείας', 'ἐστίν', 'ἄγγελος', 'ἁμαρτίας',
              'θεός', 'ἀκούω', 'προφήτου', 'ἔκτισεν', 'Ἐσαΐας', 'ἀδελφοῖς', 'πνεῦμα', 'ἀποκρίνεται',
              'Ἀβραάμ', 'ἔθνεσιν', 'λόγος', 'καρδίαν', 'ἐκκλησία', 'Ἰουδαίων', 'παραλυτικῷ', 'υἱός',
              'Πνεύματος', 'παρακαλέω', 'ἀπέστειλεν', 'οὐρανῶν', 'ἀλλήλους', 'γραμματεῖς']:
        print(w, '->', hyphenate(w).replace(SHY, '·'))
