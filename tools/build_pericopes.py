#!/usr/bin/env python3
"""Kretzmann section headings -> data/pericopes.json.
usage: build_pericopes.py HEADINGS_TXT DATA_DIR
Input lines: BB.CC.VV<TAB>Title  (BB = 01..27 canonical book number; the heading comes *before* that verse).
Output: {"MAT": [[chapter, verse, "Title"], ...], ...}. Each section runs to the verse before the next heading."""
import sys, os, json, re
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import rp

def clean(t):
    t = t.strip().replace('``', '“').replace("''", '”')
    t = re.sub(r'"$', '”', t); t = re.sub(r'^"', '“', t)
    t = re.sub(r'(?<=\w)"', '”', t); t = t.replace('"', '“')
    t = t.replace("'", '’')
    return re.sub(r'\s+', ' ', t)

def main(src, data_dir):
    codes = [c for _, c, _ in rp.BOOKS]
    verses = {}   # code -> set of (ch, vs)
    for code in codes:
        d = json.load(open(os.path.join(data_dir, 'text', code + '.json'), encoding='utf-8'))
        verses[code] = {(ch, vs) for ch, vl in d for vs, _ in vl}
    out = {c: [] for c in codes}; problems = []
    for ln, line in enumerate(open(src, encoding='utf-8-sig'), 1):
        line = line.rstrip('\r\n')
        if not line.strip(): continue
        m = re.match(r'^(\d\d)\.(\d\d)\.(\d\d)\t(.+)$', line)
        if not m: problems.append('line %d: unparseable %r' % (ln, line[:60])); continue
        b, ch, vs = int(m.group(1)), int(m.group(2)), int(m.group(3))
        if not 1 <= b <= 27: problems.append('line %d: bad book %d' % (ln, b)); continue
        code = codes[b - 1]
        if (ch, vs) not in verses[code]: problems.append('line %d: %s %d:%d is not a verse in the RP text (%s)' % (ln, code, ch, vs, m.group(4)[:40]))
        out[code].append([ch, vs, clean(m.group(4))])
    for code, lst in out.items():
        if lst and (lst[0][0], lst[0][1]) != (1, 1): problems.append('%s: first heading at %d:%d, not 1:1' % (code, lst[0][0], lst[0][1]))
        if not lst: problems.append('%s: no headings' % code)
        for a, b2 in zip(lst, lst[1:]):
            if (b2[0], b2[1]) <= (a[0], a[1]): problems.append('%s: headings out of order near %d:%d' % (code, b2[0], b2[1]))
    json.dump(out, open(os.path.join(data_dir, 'pericopes.json'), 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
    print('headings:', sum(len(v) for v in out.values()), '| problems:', len(problems))
    for p in problems: print('  -', p)

if __name__ == '__main__':
    main(*sys.argv[1:3])
