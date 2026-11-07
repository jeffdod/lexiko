#!/usr/bin/env python3
"""English text for the reader -> data/english/<BOOK>.json, one file per book.
Source: sources/english/NN_XXX.TXT, the American Standard Version Byzantine Text (see sources/english/README.txt):
one verse per line, "CC:VV text", [square brackets] mark words supplied in English.
Run AFTER tools/build_data.py: every verse is checked against data/text (the Greek), and the build stops on any mismatch.
usage: build_english.py [SOURCE_DIR [DATA_DIR]]
Output per book: [[chapter, [[verse, "text"], ...]], ...], the same shape as data/text with text in place of tokens.
The text is stored as in the source, except that straight apostrophes become curly (’). The reader shows [bracketed] words in italics."""
import json, os, re, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = sys.argv[1] if len(sys.argv) > 1 else os.path.join(ROOT, 'sources', 'english')
DATA = sys.argv[2] if len(sys.argv) > 2 else os.path.join(ROOT, 'data')

# The source files are named NN_XXX.TXT in canonical order. These file codes differ from the app's book codes.
APP_CODE = {'MAR': 'MRK', 'JOH': 'JHN', 'JAM': 'JAS', '1JO': '1JN', '2JO': '2JN', '3JO': '3JN'}
FILE_CODE = {v: k for k, v in APP_CODE.items()}
LINE = re.compile(r'^(\d{2}):(\d{2}) (.*)$')


def fail(msg):
    raise SystemExit('build_english: ' + msg)


def check_text(ref, t):
    """Stop on anything that would look wrong on screen. These are glitches in the source, so fix the source, not this script."""
    if t != t.strip() or not t: fail('%s: empty verse, or space at the start or end' % ref)
    if '  ' in t: fail('%s: double space' % ref)
    if re.search(r'[,;:?!][A-Za-z]|[a-z]\.[A-Z]', t): fail('%s: no space after punctuation: %r' % (ref, t))
    if re.search(r"(?<![A-Za-z])'", t): fail('%s: an apostrophe that does not follow a letter (an opening quote?): %r' % (ref, t))
    depth = 0
    for ch in t:
        depth += (ch == '[') - (ch == ']')
        if depth < 0 or depth > 1: fail('%s: square brackets are nested or reversed: %r' % (ref, t))
    if depth: fail('%s: square brackets are not closed: %r' % (ref, t))
    if re.search(r'\[\s|\s\]|\[\]', t): fail('%s: space just inside a bracket, or an empty bracket: %r' % (ref, t))
    if re.search(r'\w\[|\]\w', t): fail('%s: a bracket touches a word: %r' % (ref, t))


def main():
    books = json.load(open(os.path.join(DATA, 'books.json'), encoding='utf-8'))
    outdir = os.path.join(DATA, 'english')
    os.makedirs(outdir, exist_ok=True)
    total = size = 0
    for i, b in enumerate(books):
        code = b['code']
        path = os.path.join(SRC, '%02d_%s.TXT' % (i + 1, FILE_CODE.get(code, code)))
        if not os.path.exists(path): fail('missing source file ' + path)
        text = open(path, encoding='utf-8-sig', newline='').read()
        lines = [l for l in text.replace('\r\n', '\n').split('\n') if l != '']
        chapters, seen, last = [], set(), (0, 0)
        for n, line in enumerate(lines, 1):
            m = LINE.match(line)
            if not m: fail('%s line %d: not in the form "CC:VV text": %r' % (os.path.basename(path), n, line[:60]))
            c, v, t = int(m.group(1)), int(m.group(2)), m.group(3)
            ref = '%s %d:%d' % (code, c, v)
            if (c, v) <= last: fail('%s: verses out of order or repeated' % ref)
            last = (c, v)
            check_text(ref, t)
            t = t.replace("'", '’')
            if not chapters or chapters[-1][0] != c: chapters.append([c, []])
            chapters[-1][1].append([v, t]); seen.add((c, v))
        # the Greek: a verse counts only if it has words (RP leaves a few verse numbers empty)
        greek = {(ch[0], vs[0]) for ch in json.load(open(os.path.join(DATA, 'text', code + '.json'), encoding='utf-8')) for vs in ch[1] if vs[1]}
        if greek != seen:
            no_en = sorted(greek - seen); no_gk = sorted(seen - greek)
            fail('%s: Greek and English do not match. Greek without English: %s. English without Greek: %s' % (
                code, ', '.join('%d:%d' % x for x in no_en[:12]) or 'none', ', '.join('%d:%d' % x for x in no_gk[:12]) or 'none'))
        out = json.dumps(chapters, ensure_ascii=False, separators=(',', ':')) + '\n'
        open(os.path.join(outdir, code + '.json'), 'w', encoding='utf-8', newline='\n').write(out)
        total += len(seen); size += len(out.encode('utf-8'))
    print('english: %d books, %d verses, %.2f MB -> %s' % (len(books), total, size / 1048576, os.path.relpath(outdir, ROOT)))


main()
