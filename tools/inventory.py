import sys, re, collections, csv
sys.path.insert(0, '/home/claude/lexiko/tools')
import rp
books = rp.load_all(sys.argv[1])
ntok = 0; multi = collections.Counter(); shapes = collections.Counter(); hy = []
strongs = collections.Counter(); alt_strongs = set()
for code, verses in books.items():
    for ch, vs, toks in verses:
        for t in toks:
            ntok += 1
            multi[len(t['analyses'])] += 1
            if '-' in t['raw'] and len(hy) < 8: hy.append((code, ch, vs, t['raw']))
            strongs[t['analyses'][0][0]] += 1
            for s, m in t['analyses'][1:]: alt_strongs.add(s)
            for s, m in t['analyses']:
                shapes[re.sub(r'[A-Z0-9]', 'x', m) if False else m.split('-')[0] + ('-' + m.split('-')[1][:0] if '-' in m else '')] += 1
print('tokens', ntok, 'analyses-per-token', dict(multi))
print('verses', sum(len(v) for v in books.values()))
print('distinct primary strongs', len(strongs))
print('hyphen examples', hy)
# POS prefix inventory
pos = collections.Counter(); ex = {}
for code, verses in books.items():
    for ch, vs, toks in verses:
        for t in toks:
            for s, m in t['analyses']:
                p = m.split('-')[0]; pos[p] += 1; ex.setdefault(p, m)
print(sorted(pos.items(), key=lambda x: -x[1]))
print({k: ex[k] for k in pos})
# dodson coverage
d = {}
for r in csv.reader(open('/home/claude/biblicalhumanities/dodson-greek-lexicon/dodson.csv', encoding='utf-8'), delimiter='\t'):
    if r and r[0].isdigit(): d[int(r[0])] = r
print('dodson entries', len(d))
used = set(strongs) | alt_strongs
missing = sorted(s for s in used if s not in d)
print('RP strongs not in Dodson:', len(missing), missing[:60])
print('missing token total', sum(strongs[s] for s in missing if s in strongs))
