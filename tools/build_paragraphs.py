#!/usr/bin/env python3
"""Paragraph marks -> data/paragraphs.json.
Source: sources/paragraphs/paragraphs.txt, one mark per line, BB:CC:VV:WW = book (1 = Matthew), chapter, verse, word.
A paragraph begins at that word. All 27 books; a book without marks would be read as before.
Output: {"MAT": [[chapter, verse, word], ...], ...} in text order. Every mark is checked against the text."""
import json, sys, os
src = sys.argv[1] if len(sys.argv) > 1 else 'sources/paragraphs/paragraphs.txt'
out = sys.argv[2] if len(sys.argv) > 2 else 'data'
books = json.load(open(os.path.join(out, 'books.json')))
res = {}
for n, line in enumerate(open(src, encoding='utf-8'), 1):
    line = line.strip()
    if not line: continue
    b, c, v, w = (int(x) for x in line.split(':'))
    code = books[b - 1]['code']
    text = {(ch, vs): len(t) for ch, vss in json.load(open(os.path.join(out, 'text', code + '.json'))) for vs, t in vss}
    if (c, v) not in text or not 1 <= w <= text[(c, v)]:
        sys.exit('line %d: %s has no word %d' % (n, line, w))
    res.setdefault(code, []).append([c, v, w])
for code, marks in res.items():
    if len(set(map(tuple, marks))) != len(marks): sys.exit(code + ': duplicate mark')
    if marks != sorted(marks): sys.exit(code + ': marks out of order')
json.dump(res, open(os.path.join(out, 'paragraphs.json'), 'w'), separators=(',', ':'))
print('paragraphs.json:', {k: len(v) for k, v in res.items()})
