"""Beta Code (CCAT/RP flavour) -> Unicode polytonic Greek."""
import unicodedata

LETTERS = {
    'A': 'α', 'B': 'β', 'G': 'γ', 'D': 'δ', 'E': 'ε', 'Z': 'ζ', 'H': 'η', 'Q': 'θ',
    'I': 'ι', 'K': 'κ', 'L': 'λ', 'M': 'μ', 'N': 'ν', 'C': 'ξ', 'O': 'ο', 'P': 'π',
    'R': 'ρ', 'S': 'σ', 'T': 'τ', 'U': 'υ', 'F': 'φ', 'X': 'χ', 'Y': 'ψ', 'W': 'ω',
}
MARKS = {
    ')': '̓',  # smooth breathing
    '(': '̔',  # rough breathing
    '/': '́',  # acute
    '\\': '̀',  # grave
    '=': '͂',  # circumflex (perispomeni)
    '+': '̈',  # diaeresis
    '|': 'ͅ',  # iota subscript
}
PUNCT = {',': ',', '.': '.', ':': '·', ';': ';'}  # ':' -> ano teleia (middle dot)
APOS = '’'
# canonical stacking order: breathing, diaeresis, accent, iota subscript
ORDER = {'\u0313': 0, '\u0314': 0, '\u0308': 1, '\u0301': 2, '\u0300': 2, '\u0342': 2, '\u0345': 3}


def _marks(ms):
    return ''.join(sorted(ms, key=lambda m: ORDER[m]))



def split_word(tok):
    """Split a raw token into (word_part, trailing_punct).
    Trailing punctuation is , . : ; (never part of a word)."""
    p = ''
    while tok and tok[-1] in PUNCT:
        p = PUNCT[tok[-1]] + p
        tok = tok[:-1]
    return tok, p


def to_unicode(word):
    """Convert a Beta Code word (no trailing punctuation) to Unicode, NFC."""
    out = []
    i, n = 0, len(word)
    cap = False
    while i < n:
        c = word[i]
        if c == '*':
            cap = True
            i += 1
            continue
        if c == "'":
            out.append(APOS)
            i += 1
            continue
        if c == '-':
            out.append('-')
            i += 1
            continue
        if c in LETTERS:
            letter = LETTERS[c]
            i += 1
            marks = []
            # for capitals, diacritics precede the letter: *)A, *(=H
            if cap:
                # collect marks that were consumed before? handled below
                pass
            while i < n and word[i] in MARKS:
                marks.append(MARKS[word[i]])
                i += 1
            if c == 'S':
                letter = 'σ'  # final sigma fixed afterwards
            ch = letter.upper() if cap else letter
            cap = False
            out.append(ch + _marks(marks))
            continue
        if c in MARKS and cap is not None:
            # mark(s) before the letter (capital form: *)=H or *(/A)
            j = i
            pre = []
            while j < n and word[j] in MARKS:
                pre.append(MARKS[word[j]])
                j += 1
            if j < n and word[j] in LETTERS:
                i = j + 1
                letter = LETTERS[word[j]]
                post = []
                while i < n and word[i] in MARKS:
                    post.append(MARKS[word[i]])
                    i += 1
                ch = letter.upper() if cap else letter
                cap = False
                out.append(ch + _marks(pre + post))
                continue
        raise ValueError('cannot convert %r at %d' % (word, i))
    s = ''.join(out)
    s = unicodedata.normalize('NFC', s)
    # final sigma: σ at end of word (ignoring trailing combining marks / apostrophe)
    chars = list(s)
    for k in range(len(chars) - 1, -1, -1):
        ch = chars[k]
        if ch == 'σ':
            if all(not c.isalpha() for c in chars[k + 1:]):
                chars[k] = 'ς'
            break
        if ch.isalpha():
            break
    return ''.join(chars)


if __name__ == '__main__':
    tests = {
        '*)IHSOU=S': 'Ἰησοῦς', 'LO/GOS': 'λόγος', 'H)=N': 'ἦν', 'A)RXH=|': 'ἀρχῇ',
        '*)=HN': 'Ἦν', '*(ESRW/M': 'Ἑσρώμ', 'GENE/SEWS': 'γενέσεως', 'TO\\N': 'τὸν',
        'E)GE/NNHSEN': 'ἐγέννησεν', 'DI\'': 'δι’', 'PROFH/TOU': 'προφήτου',
        'U(MW=N': 'ὑμῶν', '*)ESAI/+AS': 'Ἐσαΐας', '*)ESAI+/AS': 'Ἐσαΐας', 'XRISTOU=': 'χριστοῦ', '*DAUI/D': 'Δαυίδ',
        'O(': 'ὁ', 'KAI\\': 'καὶ', 'R(H=MA': 'ῥῆμα', '*(RAXA/B': 'Ῥαχάβ',
    }
    bad = 0
    for k, v in tests.items():
        got = to_unicode(k)
        flag = '' if v is None or got == v else '   <-- MISMATCH (expected %s)' % v
        if flag: bad += 1
        print('%-14s %s%s' % (k, got, flag))
    print('FAIL' if bad else 'ok')
