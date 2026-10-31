"""Parse the CCAT-style RP files: 'CC:VV WORD STRONGS {MORPH} [STRONGS {MORPH}...] ...'"""
import glob, os, re
from beta import split_word, to_unicode

BOOKS = [  # (file prefix, code, name)
    ('01_MAT', 'MAT', 'Matthew'), ('02_MAR', 'MRK', 'Mark'), ('03_LUK', 'LUK', 'Luke'),
    ('04_JOH', 'JHN', 'John'), ('05_ACT', 'ACT', 'Acts'), ('06_ROM', 'ROM', 'Romans'),
    ('07_1CO', '1CO', '1 Corinthians'), ('08_2CO', '2CO', '2 Corinthians'),
    ('09_GAL', 'GAL', 'Galatians'), ('10_EPH', 'EPH', 'Ephesians'), ('11_PHP', 'PHP', 'Philippians'),
    ('12_COL', 'COL', 'Colossians'), ('13_1TH', '1TH', '1 Thessalonians'),
    ('14_2TH', '2TH', '2 Thessalonians'), ('15_1TI', '1TI', '1 Timothy'), ('16_2TI', '2TI', '2 Timothy'),
    ('17_TIT', 'TIT', 'Titus'), ('18_PHM', 'PHM', 'Philemon'), ('19_HEB', 'HEB', 'Hebrews'),
    ('20_JAM', 'JAS', 'James'), ('21_1PE', '1PE', '1 Peter'), ('22_2PE', '2PE', '2 Peter'),
    ('23_1JO', '1JN', '1 John'), ('24_2JO', '2JN', '2 John'), ('25_3JO', '3JN', '3 John'),
    ('26_JUD', 'JUD', 'Jude'), ('27_REV', 'REV', 'Revelation'),
]
REF = re.compile(r'^(\d+):(\d+)\s+(.*)$')


def parse_book(path):
    """Yield (chapter, verse, [token...]); token = dict(raw, word, punct, analyses=[(strongs, morph)])."""
    with open(path, encoding='latin-1', newline='') as f:
        for ln, line in enumerate(f, 1):
            line = line.rstrip('\r\n')
            if not line.strip():
                continue
            m = REF.match(line)
            if not m:
                raise ValueError('%s:%d: bad line %r' % (path, ln, line[:60]))
            ch, vs, body = int(m.group(1)), int(m.group(2)), m.group(3)
            toks, cur, pend = [], None, None
            for piece in body.split():
                if piece.startswith('{'):
                    if pend is None or cur is None:
                        raise ValueError('%s:%d: morph without strongs: %r' % (path, ln, piece))
                    cur['analyses'].append((pend, piece.strip('{}')))
                    pend = None
                elif piece.isdigit():
                    if cur is None or pend is not None:
                        raise ValueError('%s:%d: stray number %r' % (path, ln, piece))
                    pend = int(piece)
                else:
                    if pend is not None:
                        raise ValueError('%s:%d: strongs without morph before %r' % (path, ln, piece))
                    flag = piece[-1] in '-_'   # trailing '-' or '_' = an em-dash follows this word (no space after it)
                    w, p = split_word(piece[:-1] if flag else piece)
                    if w.endswith(('-', '_')):
                        raise ValueError('%s:%d: unexpected hyphen in %r' % (path, ln, piece))
                    cur = {'raw': piece, 'word': to_unicode(w), 'punct': p, 'flag': flag, 'analyses': []}
                    toks.append(cur)
            if pend is not None:
                raise ValueError('%s:%d: dangling strongs' % (path, ln))
            for t in toks:
                if not t['analyses']:
                    raise ValueError('%s:%d: token %r has no analysis' % (path, ln, t['raw']))
            yield ch, vs, toks


def load_all(rp_dir):
    out = {}
    for prefix, code, name in BOOKS:
        out[code] = list(parse_book(os.path.join(rp_dir, prefix + '.TXT')))
    return out
