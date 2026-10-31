import sys, re, collections
sys.path.insert(0, '/home/claude/lexiko/tools')
import rp
books = rp.load_all(sys.argv[1])
codes = collections.Counter()
for v in books.values():
    for ch, vs, toks in v:
        for t in toks:
            for s, m in t['analyses']: codes[m] += 1
# verbs: V-<tense><voice><mood>-<person><number> | V-..P-<case><num><gender> | V-..N
vt = collections.Counter(); vv = collections.Counter(); vm = collections.Counter(); vsuf = collections.Counter()
nonverb = collections.defaultdict(collections.Counter)
for m, c in codes.items():
    parts = m.split('-')
    if parts[0] == 'V':
        core = parts[1]
        mt = re.match(r'^(2?)([PIFARLY])([AMPEDONQX])([IOSMNP])$', core)
        if not mt: vsuf['ODD ' + m] += c; continue
        vt[mt.group(1) + mt.group(2)] += c; vv[mt.group(3)] += c; vm[mt.group(4)] += c
        vsuf['/'.join(parts[2:]) if len(parts) > 2 else ''] += 0
        tail = '-'.join(parts[2:])
        tail_shape = re.sub(r'[NGDAV]', 'C', re.sub(r'[MFN]$', 'g', tail)) if tail else ''
        vsuf[mt.group(4) + ':' + re.sub(r'^[123]', 'p', tail)[:3] + ('+' + '-'.join(parts[3:]) if len(parts) > 3 else '')] += c
    else:
        nonverb[parts[0]][('-'.join(parts[1:]))] += c
print('verb tenses', dict(vt)); print('voices', dict(vv)); print('moods', dict(vm))
print('verb tail shapes (mood:tail)'); print(sorted(((k, v) for k, v in vsuf.items() if v), key=lambda x: -x[1])[:60])
for pos, cnt in sorted(nonverb.items()):
    # abstract the slots
    shapes = collections.Counter()
    for tail, c in cnt.items():
        shapes[re.sub(r'(?<=-)?[A-Z]', lambda m: m.group(0), tail)] += c
    print(pos, len(cnt), 'distinct;', 'top:', [k for k, _ in cnt.most_common(8)], '| suffixes:', sorted({t.split('-')[-1] for t in cnt if '-' in t})[:12])
