import sys, re, collections
sys.path.insert(0, '/home/claude/lexiko/tools')
import rp
books = rp.load_all(sys.argv[1])
by = collections.defaultdict(collections.Counter)
for v in books.values():
    for ch, vs, toks in v:
        for t in toks:
            for s, m in t['analyses']:
                p, _, tail = m.partition('-')
                by[p][tail] += 1
for p in ['N','A','ADV','PRT','COND','CONJ','D','R','P','S','F','X','Q','I','K','C','T']:
    items = by[p]
    odd = {k: v for k, v in items.items() if not re.match(r'^[123]?[NGDAV][SP][MFN]$|^[123][NGDAV][SP]$', k)}
    print(p, '| regular:', sum(v for k, v in items.items() if k not in odd), '| other:', dict(sorted(odd.items(), key=lambda x: -x[1])))
# verbs with unusual tails
vodd = collections.Counter()
for tail, c in by['V'].items():
    if not re.match(r'^2?[PIFARL][AMPEDONQX][IOSMNP](-([123][SP]|[NGDAV][SP][MFN]))?(-ATT)?$', 'x'): pass
print('V sample odd:', [k for k in by['V'] if not re.match(r'^2?[PIFARL][AMPEDONQX][IOSMNP](-([123][SP]|[NGDAV][SP][MFN]))?(-ATT)?$', k)][:20])
