import sys, os, glob, json
sys.path.insert(0, '/home/claude/lexiko/tools/shim')
from fontTools.ttLib import TTFont
chars = set()
for f in glob.glob('/home/claude/lexiko/data/**/*.json', recursive=True):
    chars |= set(open(f, encoding='utf-8').read())
chars -= set('[]{},:"\\0123456789')  # json syntax/digits are in latin anyway
for fn in sorted(glob.glob('/home/claude/lexiko/fonts/*.woff2')):
    f = TTFont(fn); cmap = f.getBestCmap()
    miss = sorted(c for c in chars if ord(c) not in cmap and c not in '\n\r')
    feats = sorted({fr.FeatureTag for fr in f['GSUB'].table.FeatureList.FeatureRecord}) if 'GSUB' in f else []
    gpos = sorted({fr.FeatureTag for fr in f['GPOS'].table.FeatureList.FeatureRecord}) if 'GPOS' in f else []
    n = {r.nameID: str(r) for r in f['name'].names if r.platformID == 3 and r.langID == 0x409}
    print(os.path.basename(fn), '| missing chars:', [(c, hex(ord(c))) for c in miss] or 'none')
    print('   family=%r full=%r ps=%r' % (n.get(1), n.get(4), n.get(6)))
    print('   GSUB', feats, 'GPOS', gpos)
    print('   copyright:', (n.get(0) or '')[:90], '| RFN text kept:', 'Reserved Font Name' in (n.get(0, '') + n.get(13, '')), '| license url:', n.get(14))
    allnames = ' '.join(str(r) for r in f['name'].names if r.nameID in (1, 2, 3, 4, 6, 16, 17))
    print('   "Gentium" in naming IDs 1-6/16/17?', 'Gentium' in allnames)
