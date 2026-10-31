import sys, csv, json
sys.path.insert(0, '/home/claude/lexiko/tools')
user = {}
for ln in open(sys.argv[1], encoding='latin-1', newline=''):
    p = ln.rstrip('\r\n').split('\t')
    if len(p) != 3: print('ODD LINE', repr(ln[:80])); continue
    user[int(p[0])] = p
dod = {}
for r in csv.reader(open(sys.argv[2], encoding='utf-8'), delimiter='\t'):
    if r and r[0].isdigit(): dod[int(r[0])] = r
rpused = {row[0] for row in json.load(open('/home/claude/lexiko/data/lexicon.json'))}
print('user entries', len(user), 'dodson', len(dod), 'rp-used', len(rpused))
print('RP strongs missing from user lexicon:', sorted(rpused - set(user))[:40], len(rpused - set(user)))
print('user-only numbers:', sorted(set(user) - set(dod))[:20], 'dodson-only:', sorted(set(dod) - set(user))[:20])
dh = dg = 0; ex_h = []; ex_g = []
for n in sorted(set(user) & set(dod)):
    u, d = user[n], dod[n]
    if u[1].lower() != d[2].lower(): dh += 1; ex_h.append((n, u[1], d[2]))
    if u[2].strip() != d[3].strip(): dg += 1; ex_g.append((n, u[2], d[3]))
print('headword diffs', dh, ex_h[:6]); print('gloss diffs', dg)
for x in ex_g[:25]: print(x)
